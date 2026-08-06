from __future__ import annotations

from datetime import date

from flask import Blueprint, request

from ..authz import current_user_id, role_required, teacher_for_user
from ..db import fetch_all, fetch_one
from ..helpers import error
from ..services.prediction_service import InsufficientDataError, trigger_prediction

bp = Blueprint("predictions", __name__)


def _risk_rows(teacher_id):
    return fetch_all(
        """
        SELECT DISTINCT ON (ce.enrollment_id)
               ce.enrollment_id, ra.risk_level, ra.risk_probability, ra.assessment_date
        FROM class_enrollment ce
        JOIN learning_class lc ON lc.class_id=ce.class_id
        LEFT JOIN risk_assessment ra ON ra.enrollment_id=ce.enrollment_id
             AND ra.data_sufficiency_status='PREDICTION_GENERATED'
        WHERE lc.teacher_id=%s AND ce.enrollment_status='ENROLLED'
        ORDER BY ce.enrollment_id, ra.assessment_date DESC NULLS LAST
        """,
        (teacher_id,),
    )


@bp.get("/predictions/summary")
@role_required("teacher")
def summary():
    teacher = teacher_for_user()
    rows = _risk_rows(teacher["teacher_id"])
    assessed = [r for r in rows if r.get("risk_level")]
    model = fetch_one(
        """
        SELECT model_version, algorithm, training_date, model_status, description
        FROM model_info WHERE model_status='ACTIVE' ORDER BY training_date DESC LIMIT 1
        """
    )
    latest = max((r["assessment_date"] for r in assessed), default=None)
    high = sum(r["risk_level"] == "HIGH" for r in assessed)
    return {
        "date": latest.strftime("%B %d, %Y") if latest else "No prediction yet",
        "coverage": f"{round(len(assessed) / len(rows) * 100) if rows else 0}%",
        "model": model["model_version"] if model else "Not registered",
        "confidence": "Available" if assessed else "Pending",
        "algorithm": model["algorithm"] if model else "Random Forest",
        "trainingDate": model["training_date"].strftime("%B %Y") if model and model.get("training_date") else "Not trained yet",
        "modelStatus": (model["model_status"] or "INACTIVE").title() if model else "Not Registered",
        "dataset": (model.get("description") if model else None) or "No dataset registered",
        "insights": [
            {"tone": "error" if high else "primary", "text": f"{high} learner(s) are currently High Risk"},
            {"tone": "primary", "text": "Risk levels use the latest generated probability for each learner"},
        ],
    }


@bp.get("/predictions/risk-distribution")
@role_required("teacher")
def distribution():
    teacher = teacher_for_user()
    rows = [r for r in _risk_rows(teacher["teacher_id"]) if r.get("risk_level")]
    high = sum(r["risk_level"] == "HIGH" for r in rows)
    moderate = sum(r["risk_level"] == "MODERATE" for r in rows)
    low = sum(r["risk_level"] == "LOW" for r in rows)
    return {"high": high, "moderate": moderate, "low": low, "scale_max": max(high, moderate, low, 1)}


@bp.post("/predictions/run")
@role_required("teacher")
def run_prediction():
    data = request.get_json(silent=True) or {}
    learner_id = data.get("learner_id")
    if not learner_id:
        return error("learner_id is required.", 422)

    teacher = teacher_for_user()
    enrollment = fetch_one(
        """
        SELECT ce.enrollment_id
        FROM class_enrollment ce
        JOIN learning_class lc ON lc.class_id=ce.class_id
        WHERE ce.learner_id=%s AND lc.teacher_id=%s
        ORDER BY ce.enrollment_date DESC LIMIT 1
        """,
        (learner_id, teacher["teacher_id"]),
    )
    if not enrollment:
        return error("Learner enrollment not found for this teacher.", 404)

    try:
        monitoring_end = date.fromisoformat(str(data.get("monitoring_end_date"))) if data.get("monitoring_end_date") else None
        monitoring_start = date.fromisoformat(str(data.get("monitoring_start_date"))) if data.get("monitoring_start_date") else None
    except ValueError:
        return error("Monitoring dates must use YYYY-MM-DD.", 422)

    try:
        outcome = trigger_prediction(
            enrollment["enrollment_id"], current_user_id(),
            monitoring_start=monitoring_start, monitoring_end=monitoring_end,
        )
    except InsufficientDataError as exc:
        return error(str(exc), 422)
    except RuntimeError as exc:
        return error(str(exc), 503)
    except (ValueError, KeyError) as exc:
        return error(f"Prediction bridge failed: {exc}", 502)

    saved, model = outcome["saved"], outcome["model"]
    return {
        "risk_assessment_id": saved["risk_assessment_id"],
        "learner_id": int(learner_id),
        "risk_probability": float(saved["risk_probability"]),
        "risk_level": saved["risk_level"],
        "assessment_date": saved["assessment_date"].isoformat(),
        "model": {"version": model["model_version"], "algorithm": model["algorithm"]},
    }
