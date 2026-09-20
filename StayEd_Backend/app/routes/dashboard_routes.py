from __future__ import annotations

from flask import Blueprint

from ..authz import role_required, teacher_for_user
from ..db import fetch_all, fetch_one
from .learner_routes import _learner_query, _shape_learner

bp = Blueprint("dashboard", __name__)


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
    if current_class:
        school_year = current_class["school_year"]
        trimester = {"FIRST": "First Trimester", "SECOND": "Second Trimester", "SUMMER": "Third Trimester", "WHOLE_YEAR": "Whole Year"}.get(current_class["semester"], current_class["semester"])
    else:
        school_year, trimester = "—", "—"

    learner_rows = fetch_all(
        _learner_query(
            "WHERE lc.teacher_id = %s AND ce.enrollment_status = 'ENROLLED'",
            "ce.enrollment_date DESC, ce.enrollment_id DESC, l.last_name, l.first_name",
        ),
        (teacher["teacher_id"],),
    )
    latest_by_learner = {}
    for row in learner_rows:
        latest_by_learner.setdefault(row["learner_id"], row)
    learners = [_shape_learner(row) for row in latest_by_learner.values()]

    # Every learner falls into exactly one of these buckets, so high+moderate+low
    # always equals registered -- learners with no completed prediction yet
    # default into Low rather than vanishing from the KPI cards/chart, while
    # `_shape_learner`'s "Not Yet Assessed" risk value (kept as-is on each
    # learner) still lets tables/profiles show the distinction.
    registered = len(learners)
    high = sum(l["risk"] == "High" for l in learners)
    moderate = sum(l["risk"] == "Moderate" for l in learners)
    low_pending = sum(l["risk"] == "Not Yet Assessed" for l in learners)
    low = sum(l["risk"] == "Low" for l in learners) + low_pending
    predicted = registered - low_pending

    model = _model_info()
    latest_date = max((r["assessment_date"] for r in learner_rows if r.get("assessment_date")), default=None)
    algorithm = model["algorithm"] if model else "Random Forest"
    model_version = model["model_version"] if model else "Not registered"
    coverage = round((predicted / registered) * 100) if registered else 0

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

    reminder = fetch_one(
        """
        SELECT COUNT(*) FILTER (WHERE i.target_date < CURRENT_DATE) AS overdue,
               COUNT(*) FILTER (WHERE i.target_date = CURRENT_DATE) AS due_today,
               COUNT(*) FILTER (WHERE i.target_date > CURRENT_DATE) AS due_soon
        FROM intervention i
        WHERE i.assigned_to_teacher_id = %s
          AND i.status IN ('PLANNED', 'ONGOING')
          AND i.target_date IS NOT NULL
          AND i.target_date <= CURRENT_DATE + 3
        """,
        (teacher["teacher_id"],),
    )
    overdue = int(reminder["overdue"] or 0)
    due_today = int(reminder["due_today"] or 0)
    due_soon = int(reminder["due_soon"] or 0)
    # Last 6 months of this teacher's own prediction runs, for the dashboard's
    # Risk Distribution "Trend" chart view -- mirrors the admin dashboard's
    # division-wide riskTrend (admin_routes.admin_dashboard), scoped here to
    # just this teacher's learners.
    trend_rows = fetch_all(
        """
        SELECT date_trunc('month', ra.assessment_date) AS month, ra.risk_level, COUNT(*) AS n
        FROM risk_assessment ra
        JOIN class_enrollment ce ON ce.enrollment_id = ra.enrollment_id
        JOIN learning_class lc ON lc.class_id = ce.class_id
        WHERE lc.teacher_id = %s
          AND ra.data_sufficiency_status = 'PREDICTION_GENERATED'
          AND ra.assessment_date >= (CURRENT_DATE - INTERVAL '6 months')
        GROUP BY 1, 2
        """,
        (teacher["teacher_id"],),
    )
    trend_by_month: dict = {}
    for row in trend_rows:
        key = row["month"].strftime("%Y-%m")
        bucket = trend_by_month.setdefault(key, {"month": row["month"].strftime("%b %Y"), "high": 0, "moderate": 0, "low": 0})
        if row["risk_level"] == "HIGH":
            bucket["high"] += row["n"]
        elif row["risk_level"] == "MODERATE":
            bucket["moderate"] += row["n"]
        elif row["risk_level"] == "LOW":
            bucket["low"] += row["n"]
    risk_trend = [trend_by_month[k] for k in sorted(trend_by_month.keys())]

    return {
        "context": {
            "registered_learners": registered,
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
        },
        "riskDistribution": dist,
        "interventionReminder": {
            "total": overdue + due_today + due_soon,
            "overdue": overdue,
            "dueToday": due_today,
            "dueSoon": due_soon,
        },
        "riskTrend": risk_trend,
        "predictionSummary": {
            "date": latest_date.strftime("%B %d, %Y") if latest_date else "No prediction yet",
            "coverage": f"{coverage}%",
            "model": model_version,
            "confidence": "Available" if predicted else "Pending",
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
