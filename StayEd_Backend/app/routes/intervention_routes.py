from __future__ import annotations

from flask import Blueprint

from ..authz import role_required, teacher_for_user
from ..db import fetch_all

bp = Blueprint("interventions", __name__)


@bp.get("/interventions")
@role_required("teacher")
def interventions():
    teacher = teacher_for_user()
    rows = fetch_all(
        """
        SELECT i.intervention_id AS id, i.risk_assessment_id AS prediction_id,
               CONCAT_WS(' ', l.first_name, l.last_name) AS learner,
               i.description AS recommended_action,
               i.status, fu.outcome AS teacher_feedback
        FROM intervention i
        JOIN risk_assessment ra ON ra.risk_assessment_id=i.risk_assessment_id
        JOIN class_enrollment ce ON ce.enrollment_id=ra.enrollment_id
        JOIN learning_class lc ON lc.class_id=ce.class_id
        JOIN learner l ON l.learner_id=ce.learner_id
        LEFT JOIN LATERAL (
            SELECT outcome FROM follow_up WHERE intervention_id=i.intervention_id
            ORDER BY follow_up_date DESC LIMIT 1
        ) fu ON TRUE
        WHERE lc.teacher_id=%s
        ORDER BY i.date_assigned DESC
        """,
        (teacher["teacher_id"],),
    )
    status_map = {"PLANNED": "Pending", "ONGOING": "In Progress", "COMPLETED": "Completed", "CANCELLED": "Cancelled"}
    data = [{**dict(r), "status": status_map.get(r["status"], r["status"])} for r in rows]
    return {"total": len(data), "data": data}
