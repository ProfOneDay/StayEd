from __future__ import annotations

from datetime import date, timedelta

from flask import Blueprint, current_app, request

from ..authz import current_user_id, role_required, teacher_for_user
from ..db import fetch_all, fetch_one, get_db
from ..helpers import error
from ..services.prediction_service import run_external_model

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
        "SELECT model_version, algorithm FROM model_info WHERE model_status='ACTIVE' ORDER BY training_date DESC LIMIT 1"
    )
    latest = max((r["assessment_date"] for r in assessed), default=None)
    high = sum(r["risk_level"] == "HIGH" for r in assessed)
    return {
        "date": latest.strftime("%B %d, %Y") if latest else "No prediction yet",
        "coverage": f"{round(len(assessed) / len(rows) * 100) if rows else 0}%",
        "model": model["model_version"] if model else "Not registered",
        "confidence": "Available" if assessed else "Pending",
        "algorithm": model["algorithm"] if model else "Random Forest",
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

    model = fetch_one(
        "SELECT model_id, model_version, algorithm FROM model_info WHERE model_status='ACTIVE' ORDER BY training_date DESC LIMIT 1"
    )
    if not model:
        return error("No ACTIVE model is registered in model_info.", 503)

    command = current_app.config.get("MODEL_COMMAND")
    if not command:
        return error(
            "The prediction API is ready, but MODEL_COMMAND is not configured with the trained Random Forest bridge yet.",
            503,
        )

    model_payload = data.get("features") if isinstance(data.get("features"), dict) else data
    try:
        result = run_external_model(command, model_payload)
        probability = float(result["risk_probability"])
    except (RuntimeError, ValueError, KeyError) as exc:
        return error(f"Prediction bridge failed: {exc}", 502)

    try:
        monitoring_end = date.fromisoformat(str(data.get("monitoring_end_date"))) if data.get("monitoring_end_date") else date.today()
        monitoring_start = date.fromisoformat(str(data.get("monitoring_start_date"))) if data.get("monitoring_start_date") else monitoring_end - timedelta(days=30)
    except ValueError:
        return error("Monitoring dates must use YYYY-MM-DD.", 422)

    db = get_db()
    try:
        with db.cursor() as cur:
            cur.execute(
                """
                INSERT INTO risk_assessment (
                    model_id, enrollment_id, monitoring_start_date, monitoring_end_date,
                    data_sufficiency_status, risk_probability, generated_by_user_id
                ) VALUES (%s,%s,%s,%s,'PREDICTION_GENERATED',%s,%s)
                ON CONFLICT (model_id, enrollment_id, monitoring_start_date, monitoring_end_date)
                DO UPDATE SET data_sufficiency_status='PREDICTION_GENERATED',
                              risk_probability=EXCLUDED.risk_probability,
                              generated_by_user_id=EXCLUDED.generated_by_user_id,
                              assessment_date=CURRENT_TIMESTAMP
                RETURNING risk_assessment_id, risk_probability, risk_level, assessment_date
                """,
                (
                    model["model_id"], enrollment["enrollment_id"], monitoring_start,
                    monitoring_end, probability, current_user_id(),
                ),
            )
            saved = cur.fetchone()

            for factor in result.get("factors", []) if isinstance(result.get("factors"), list) else []:
                name = str(factor.get("name") or factor.get("factor_name") or "").strip()
                if not name:
                    continue
                cur.execute(
                    """
                    INSERT INTO risk_factors (risk_assessment_id, factor_name, factor_value, importance_score)
                    VALUES (%s,%s,%s,%s)
                    ON CONFLICT (risk_assessment_id, factor_name)
                    DO UPDATE SET factor_value=EXCLUDED.factor_value, importance_score=EXCLUDED.importance_score
                    """,
                    (
                        saved["risk_assessment_id"], name,
                        factor.get("value") if factor.get("value") is not None else factor.get("factor_value"),
                        factor.get("importance") if factor.get("importance") is not None else factor.get("importance_score"),
                    ),
                )

            if saved["risk_level"] == "HIGH":
                cur.execute(
                    """
                    INSERT INTO notification (user_id, notification_type, title, message, link)
                    VALUES (%s,'RISK','High Risk prediction generated',
                            'A learner was classified as High Risk and should be reviewed.',
                            '../teacher/early-warning.html')
                    """,
                    (current_user_id(),),
                )
        db.commit()
    except Exception:
        db.rollback()
        raise

    return {
        "risk_assessment_id": saved["risk_assessment_id"],
        "learner_id": int(learner_id),
        "risk_probability": float(saved["risk_probability"]),
        "risk_level": saved["risk_level"],
        "assessment_date": saved["assessment_date"].isoformat(),
        "model": {"version": model["model_version"], "algorithm": model["algorithm"]},
    }
