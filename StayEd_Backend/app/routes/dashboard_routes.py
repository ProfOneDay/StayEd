from __future__ import annotations

from datetime import datetime

from flask import Blueprint

from ..authz import role_required, teacher_for_user
from ..db import fetch_all, fetch_one
from ..helpers import title_enum
from .learner_routes import _learner_query, _shape_learner

bp = Blueprint("dashboard", __name__)


def _latest_risk_rows(teacher_id: int):
    return fetch_all(
        """
        SELECT DISTINCT ON (ce.enrollment_id)
            ce.enrollment_id, l.learner_id,
            CONCAT_WS(' ', l.first_name, l.last_name) AS learner,
            ra.risk_level, ra.risk_probability, ra.assessment_date
        FROM class_enrollment ce
        JOIN learning_class lc ON lc.class_id=ce.class_id
        JOIN learner l ON l.learner_id=ce.learner_id
        LEFT JOIN risk_assessment ra
            ON ra.enrollment_id=ce.enrollment_id
           AND ra.data_sufficiency_status='PREDICTION_GENERATED'
        WHERE lc.teacher_id=%s AND ce.enrollment_status='ENROLLED'
        ORDER BY ce.enrollment_id, ra.assessment_date DESC NULLS LAST
        """,
        (teacher_id,),
    )


def _model_info():
    return fetch_one(
        """
        SELECT model_name, algorithm, model_version, training_date
        FROM model_info
        WHERE model_status='ACTIVE'
        ORDER BY training_date DESC, model_id DESC
        LIMIT 1
        """
    )


@bp.get("/teacher/dashboard")
@role_required("teacher")
def dashboard():
    teacher = teacher_for_user()
    if not teacher:
        return {
            "context": {}, "statistics": {}, "riskDistribution": {},
            "predictionSummary": {}, "learners": [], "interventions": []
        }

    current_class = fetch_one(
        """
        SELECT lc.*, c.clc_name
        FROM learning_class lc JOIN clc c ON c.clc_id=lc.clc_id
        WHERE lc.teacher_id=%s AND lc.status='ACTIVE'
        ORDER BY lc.created_at DESC LIMIT 1
        """,
        (teacher["teacher_id"],),
    )
    risks = _latest_risk_rows(teacher["teacher_id"])
    registered = len(risks)
    high = sum(r.get("risk_level") == "HIGH" for r in risks)
    moderate = sum(r.get("risk_level") == "MODERATE" for r in risks)
    low = sum(r.get("risk_level") == "LOW" for r in risks)
    assessed = sum(r.get("risk_level") is not None for r in risks)

    model = _model_info()
    latest_date = max((r["assessment_date"] for r in risks if r.get("assessment_date")), default=None)
    algorithm = model["algorithm"] if model else "Random Forest"
    model_version = model["model_version"] if model else "Not registered"
    coverage = round((assessed / registered) * 100) if registered else 0

    if current_class:
        selected_class = f"{title_enum(current_class['learning_level'])}, {current_class['clc_name']}"
        school_year = current_class["school_year"]
        trimester = {"FIRST": "First Trimester", "SECOND": "Second Trimester", "SUMMER": "Third Trimester", "WHOLE_YEAR": "Whole Year"}.get(current_class["semester"], current_class["semester"])
    else:
        selected_class, school_year, trimester = "No active class", "—", "—"

    learner_rows = fetch_all(
        _learner_query(
            "WHERE lc.teacher_id = %s AND ce.enrollment_status = 'ENROLLED'",
            "ce.enrollment_date DESC, l.last_name, l.first_name",
        ),
        (teacher["teacher_id"],),
    )
    latest_by_learner = {}
    for row in learner_rows:
        latest_by_learner.setdefault(row["learner_id"], row)
    learners = [_shape_learner(row) for row in latest_by_learner.values()]

    interventions = fetch_all(
        """
        SELECT i.intervention_id AS id, ra.risk_assessment_id AS prediction_id,
               CONCAT_WS(' ', l.first_name, l.last_name) AS learner,
               i.description AS recommended_action,
               i.status, fu.outcome AS teacher_feedback
        FROM intervention i
        JOIN risk_assessment ra ON ra.risk_assessment_id=i.risk_assessment_id
        JOIN class_enrollment ce ON ce.enrollment_id=ra.enrollment_id
        JOIN learning_class lc ON lc.class_id=ce.class_id
        JOIN learner l ON l.learner_id=ce.learner_id
        LEFT JOIN LATERAL (
            SELECT outcome FROM follow_up
            WHERE intervention_id=i.intervention_id
            ORDER BY follow_up_date DESC LIMIT 1
        ) fu ON TRUE
        WHERE lc.teacher_id=%s
        ORDER BY i.date_assigned DESC LIMIT 8
        """,
        (teacher["teacher_id"],),
    )

    dist = {"high": high, "moderate": moderate, "low": low, "scale_max": max(high, moderate, low, 1)}
    return {
        "context": {
            "registered_learners": registered,
            "selected_class": selected_class,
            "school_year": school_year,
            "trimester": trimester,
            "last_updated": latest_date.strftime("%B %d, %Y") if latest_date else "No prediction run yet",
            "greeting_name": teacher["first_name"],
        },
        "statistics": {
            "registered": registered,
            "high": high,
            "moderate": moderate,
            "low": low,
            "high_delta": 0,
            "moderate_trend": "Stable",
            "low_trend": "Stable",
        },
        "riskDistribution": dist,
        "predictionSummary": {
            "date": latest_date.strftime("%B %d, %Y") if latest_date else "No prediction yet",
            "coverage": f"{coverage}%",
            "model": model_version,
            "confidence": "Available" if assessed else "Pending",
            "algorithm": algorithm,
            "insights": [
                {"tone": "error" if high else "primary", "text": f"{high} learner(s) are currently classified as High Risk"},
                {"tone": "primary", "text": f"Prediction coverage is {coverage}% of active learners"},
            ],
        },
        "learners": learners,
        "interventions": [
            {
                **dict(i),
                "status": {"PLANNED": "Pending", "ONGOING": "In Progress", "COMPLETED": "Completed", "CANCELLED": "Cancelled"}.get(i["status"], i["status"]),
            }
            for i in interventions
        ],
    }
