from __future__ import annotations

from datetime import date

from flask import Blueprint, request

from ..authz import current_user_id, role_required, teacher_for_user
from ..db import execute, fetch_all, fetch_one
from ..helpers import error
from ..services.prediction_service import trigger_prediction

bp = Blueprint("interventions", __name__)

INTERVENTION_STATUSES = {"PLANNED", "ONGOING", "COMPLETED", "CANCELLED"}


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


@bp.patch("/interventions/<int:intervention_id>")
@role_required("teacher")
def update_intervention_status(intervention_id: int):
    teacher = teacher_for_user()
    row = fetch_one(
        "SELECT intervention_id, risk_assessment_id FROM intervention WHERE intervention_id=%s AND assigned_to_teacher_id=%s",
        (intervention_id, teacher["teacher_id"]),
    )
    if not row:
        return error("Intervention not found.", 404)

    data = request.get_json(silent=True) or {}
    status = str(data.get("status") or "").strip().upper()
    if status not in INTERVENTION_STATUSES:
        return error(f"Status must be one of {', '.join(sorted(INTERVENTION_STATUSES))}.", 422)

    if status == "COMPLETED":
        execute(
            "UPDATE intervention SET status=%s, date_completed=CURRENT_DATE WHERE intervention_id=%s",
            (status, intervention_id),
        )
    else:
        execute(
            "UPDATE intervention SET status=%s, date_completed=NULL WHERE intervention_id=%s",
            (status, intervention_id),
        )

    ra = fetch_one("SELECT enrollment_id FROM risk_assessment WHERE risk_assessment_id=%s", (row["risk_assessment_id"],))
    if ra:
        try:
            trigger_prediction(ra["enrollment_id"], current_user_id())
        except Exception:
            pass

    return {"message": "Intervention status updated."}


@bp.post("/interventions/<int:intervention_id>/follow-up")
@role_required("teacher")
def add_intervention_follow_up(intervention_id: int):
    teacher = teacher_for_user()
    row = fetch_one(
        "SELECT intervention_id FROM intervention WHERE intervention_id=%s AND assigned_to_teacher_id=%s",
        (intervention_id, teacher["teacher_id"]),
    )
    if not row:
        return error("Intervention not found.", 404)

    data = request.get_json(silent=True) or {}
    notes = str(data.get("notes") or "").strip()
    outcome = str(data.get("outcome") or "").strip() or None
    if not notes:
        return error("Follow-up notes are required.", 422)

    execute(
        """
        INSERT INTO follow_up (intervention_id, follow_up_date, notes, outcome, created_by_user_id)
        VALUES (%s, %s, %s, %s, %s)
        """,
        (intervention_id, date.today(), notes, outcome, current_user_id()),
    )

    return {"message": "Follow-up recorded."}, 201
