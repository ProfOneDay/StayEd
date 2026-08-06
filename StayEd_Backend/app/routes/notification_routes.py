from __future__ import annotations

from datetime import date

from flask import Blueprint

from ..authz import current_user_id, role_required, teacher_for_user
from ..db import execute, fetch_all, fetch_one
from ..helpers import error
from ..services.learner_service import _learner_query, _shape_learner

bp = Blueprint("notifications", __name__)


def _shape(row):
    return {
        "id": row["notification_id"],
        "type": row["notification_type"].lower(),
        "title": row["title"],
        "message": row["message"],
        "metaLabel": row.get("meta_label"),
        "time": row["created_at"].strftime("%b %d, %Y %I:%M %p"),
        "read": bool(row["is_read"]),
        "link": row.get("link"),
    }


def _insert_alert(user_id, notification_type, title, message, link, meta_label, dedup_key):
    execute(
        """
        INSERT INTO notification (user_id, notification_type, title, message, link, meta_label, dedup_key)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (user_id, dedup_key) WHERE dedup_key IS NOT NULL DO NOTHING
        """,
        (user_id, notification_type, title, message, link, meta_label, dedup_key),
    )


def _generate_alerts(teacher_id: int, user_id: int) -> None:
    """Best-effort sync: (re)derive risk/inactivity/intervention-due alerts from
    current data on every notifications-page load. There's no scheduler in this
    app, so this is what makes "automatic" notifications -- and backfilling
    already-Moderate/High learners -- work without a cron job. Idempotent via
    the notification.dedup_key unique index.
    """
    prefs_row = fetch_one("SELECT preferences FROM users WHERE user_id=%s", (user_id,))
    risk_alerts_enabled = (prefs_row["preferences"] or {}).get("ewa-alerts") is not False if prefs_row else True

    if risk_alerts_enabled:
        rows = fetch_all(
            _learner_query("WHERE lc.teacher_id = %s AND ce.enrollment_status = 'ENROLLED'"),
            (teacher_id,),
        )
        seen_learners = set()
        for row in rows:
            if row["learner_id"] in seen_learners:
                continue
            seen_learners.add(row["learner_id"])
            learner = _shape_learner(row)
            link = f"learner-profile.html?id={learner['id']}"

            if learner["risk"] in ("Moderate", "High"):
                _insert_alert(
                    user_id,
                    "RISK",
                    f"{learner['risk']}-Risk Learner Needs Review",
                    f"{learner['name']} is now classified as {learner['risk']} Risk. {learner['activity_text']}.",
                    link,
                    f"{learner['risk']} Risk",
                    f"risk:{row['risk_assessment_id']}:{learner['risk']}",
                )

            if learner["activity_status"] in ("warning", "danger"):
                urgent = learner["activity_status"] == "danger"
                reason = learner["activity_text"]
                reason = reason[0].lower() + reason[1:] if reason else "no recent activity"
                _insert_alert(
                    user_id,
                    "RISK",
                    "Learner Requires Immediate Follow-up" if urgent else "Learner Needs a Check-In",
                    f"{learner['name']} has had {reason}.",
                    link,
                    f"{learner['days_inactive']} Days Inactive",
                    f"inactivity:{row['enrollment_id']}:{learner['activity_status']}",
                )

    due_interventions = fetch_all(
        """
        SELECT i.intervention_id, i.intervention_type, i.target_date, i.assigned_to_teacher_id,
               ce.learner_id, CONCAT_WS(' ', l.first_name, l.last_name) AS learner_name
        FROM intervention i
        JOIN risk_assessment ra ON ra.risk_assessment_id = i.risk_assessment_id
        JOIN class_enrollment ce ON ce.enrollment_id = ra.enrollment_id
        JOIN learner l ON l.learner_id = ce.learner_id
        WHERE i.assigned_to_teacher_id = %s
          AND i.status IN ('PLANNED', 'ONGOING')
          AND i.target_date IS NOT NULL
          AND i.target_date <= CURRENT_DATE
        """,
        (teacher_id,),
    )
    for row in due_interventions:
        overdue = row["target_date"] < date.today()
        link = f"learner-profile.html?id={row['learner_id']}&tab=interventions"
        _insert_alert(
            user_id,
            "INTERVENTION",
            "Intervention Follow-up Overdue" if overdue else "Intervention Follow-up Due",
            f"The {row['intervention_type']} intervention for {row['learner_name']} "
            f"was due on {row['target_date'].strftime('%B %d, %Y')}.",
            link,
            "Overdue" if overdue else "Due Today",
            f"intervention_due:{row['intervention_id']}:{row['target_date'].isoformat()}",
        )


@bp.get("/notifications")
@role_required("teacher", "admin", "coordinator")
def list_notifications():
    teacher = teacher_for_user()
    if teacher:
        _generate_alerts(teacher["teacher_id"], current_user_id())

    rows = fetch_all(
        "SELECT * FROM notification WHERE user_id=%s ORDER BY created_at DESC",
        (current_user_id(),),
    )
    data = [_shape(r) for r in rows]
    return {"total": len(data), "unread": sum(not n["read"] for n in data), "data": data}


@bp.post("/notifications/<int:notification_id>/read")
@role_required("teacher", "admin", "coordinator")
def mark_read(notification_id: int):
    row = fetch_one(
        "SELECT notification_id FROM notification WHERE notification_id=%s AND user_id=%s",
        (notification_id, current_user_id()),
    )
    if not row:
        return error("Notification not found.", 404)
    execute("UPDATE notification SET is_read=TRUE WHERE notification_id=%s", (notification_id,))
    return {"message": "Notification marked as read."}


@bp.post("/notifications/read-all")
@role_required("teacher", "admin", "coordinator")
def mark_all_read():
    execute("UPDATE notification SET is_read=TRUE WHERE user_id=%s", (current_user_id(),))
    return {"message": "All notifications marked as read."}


@bp.delete("/notifications/<int:notification_id>")
@role_required("teacher", "admin", "coordinator")
def delete_notification(notification_id: int):
    execute(
        "DELETE FROM notification WHERE notification_id=%s AND user_id=%s",
        (notification_id, current_user_id()),
    )
    return {"message": "Notification removed."}
