from __future__ import annotations

from datetime import date

from flask import Blueprint, request

from ..authz import current_user_id, role_required, teacher_for_user
from ..db import execute, fetch_all, fetch_one
from ..helpers import error
from ..services.learner_service import _learner_query, _monitoring_engaged_sql, _shape_learner
from .learner_routes import MODULE_DUE_SOON_DAYS

bp = Blueprint("notifications", __name__)

BROADCAST_KINDS = {
    "ANNOUNCEMENT": "Announcement",
    "REPORT_REQUEST": "Report Request",
}


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

    # Overdue module returns: one alert per learner, not per module, so a
    # learner with several late modules doesn't flood the bell. Keyed on the
    # newest overdue module, so a learner gets a fresh alert each time another
    # module goes overdue, but not again for the same set. Same overdue rule
    # as the learner profile (not returned, past planned_return_date). Not
    # engagement-gated like risk is: a late module is a recorded fact, not a
    # model verdict, and a learner who never returned anything is exactly
    # who this should catch.
    overdue_modules = fetch_all(
        """
        SELECT ce.enrollment_id, ce.learner_id,
               CONCAT_WS(' ', l.first_name, l.last_name) AS learner_name,
               COUNT(*)::INT AS overdue_count,
               MIN(mr.planned_return_date) AS oldest_due,
               MAX(mr.module_record_id) AS newest_overdue_id
        FROM module_record mr
        JOIN class_enrollment ce ON ce.enrollment_id = mr.enrollment_id
        JOIN learning_class lc ON lc.class_id = ce.class_id
        JOIN learner l ON l.learner_id = ce.learner_id
        WHERE lc.teacher_id = %s
          AND ce.enrollment_status = 'ENROLLED'
          AND mr.date_returned IS NULL
          AND mr.planned_return_date IS NOT NULL
          AND mr.planned_return_date < CURRENT_DATE
        GROUP BY ce.enrollment_id, ce.learner_id, l.first_name, l.last_name
        """,
        (teacher_id,),
    )
    for row in overdue_modules:
        count = row["overdue_count"]
        days_late = (date.today() - row["oldest_due"]).days
        modules = "module" if count == 1 else "modules"
        _insert_alert(
            user_id,
            "RISK",
            "Module Return Overdue",
            f"{row['learner_name']} has {count} overdue {modules} not yet returned "
            f"(oldest was due {row['oldest_due'].strftime('%B %d, %Y')}, {days_late} "
            f"{'day' if days_late == 1 else 'days'} ago).",
            f"learner-profile.html?id={row['learner_id']}&tab=monitoring",
            f"{count} Overdue",
            f"module_overdue:{row['enrollment_id']}:{row['newest_overdue_id']}",
        )

    # Early heads-up before a module goes overdue, using the same window the
    # module page labels "Due Soon". Two stages per learner -- within the
    # window, then on the due date itself -- each sent once, so the teacher
    # can nudge the learner while the module can still be returned on time.
    due_modules = fetch_all(
        """
        SELECT ce.enrollment_id, ce.learner_id,
               CONCAT_WS(' ', l.first_name, l.last_name) AS learner_name,
               COUNT(*)::INT AS due_count,
               MIN(mr.planned_return_date) AS nearest_due,
               MAX(mr.module_record_id) AS newest_due_id
        FROM module_record mr
        JOIN class_enrollment ce ON ce.enrollment_id = mr.enrollment_id
        JOIN learning_class lc ON lc.class_id = ce.class_id
        JOIN learner l ON l.learner_id = ce.learner_id
        WHERE lc.teacher_id = %s
          AND ce.enrollment_status = 'ENROLLED'
          AND mr.date_returned IS NULL
          AND mr.planned_return_date BETWEEN CURRENT_DATE AND CURRENT_DATE + %s
        GROUP BY ce.enrollment_id, ce.learner_id, l.first_name, l.last_name
        """,
        (teacher_id, MODULE_DUE_SOON_DAYS),
    )
    for row in due_modules:
        count = row["due_count"]
        days_left = (row["nearest_due"] - date.today()).days
        modules = "module" if count == 1 else "modules"
        due_on = row["nearest_due"].strftime("%B %d, %Y")
        if days_left == 0:
            stage, title, label = "today", "Module Return Due Today", "Due Today"
            when = f"due for return today ({due_on})"
        else:
            stage, title, label = "soon", "Module Return Due Soon", "Due Soon"
            when = f"due for return on {due_on} (in {days_left} {'day' if days_left == 1 else 'days'})"
        _insert_alert(
            user_id,
            "RISK",
            title,
            f"{row['learner_name']} has {count} {modules} {when}. A reminder now can keep it from going overdue.",
            f"learner-profile.html?id={row['learner_id']}&tab=monitoring",
            label,
            f"module_due:{row['enrollment_id']}:{row['newest_due_id']}:{stage}",
        )

    # Intervention-due reminders are a separate category from risk alerts --
    # they run regardless of the "Risk Alert Notifications" toggle above.
    due_interventions = fetch_all(
        f"""
        SELECT i.intervention_id, i.intervention_type, i.target_date, i.assigned_to_teacher_id,
               ce.learner_id, CONCAT_WS(' ', l.first_name, l.last_name) AS learner_name
        FROM intervention i
        JOIN risk_assessment ra ON ra.risk_assessment_id = i.risk_assessment_id
        JOIN class_enrollment ce ON ce.enrollment_id = ra.enrollment_id
        JOIN learner l ON l.learner_id = ce.learner_id
        WHERE i.assigned_to_teacher_id = %s
          AND i.status IN ('PLANNED', 'ONGOING')
          AND i.target_date IS NOT NULL
          AND i.target_date <= CURRENT_DATE + 3
          -- Same engagement gate as the dashboard reminder card: don't
          -- alert on an intervention whose own risk basis is hidden as
          -- unearned everywhere else.
          AND {_monitoring_engaged_sql("ra.enrollment_id")}
        """,
        (teacher_id,),
    )
    for row in due_interventions:
        days_left = (row["target_date"] - date.today()).days
        if days_left < 0:
            stage, title, label = "overdue", "Intervention Follow-up Overdue", "Overdue"
        elif days_left == 0:
            stage, title, label = "due", "Intervention Follow-up Due", "Due Today"
        else:
            stage, title, label = "reminder", "Intervention Follow-up Reminder", "Due Soon"
        verb = "was due" if days_left < 0 else "is due"
        _insert_alert(
            user_id,
            "INTERVENTION",
            title,
            f"The {row['intervention_type']} intervention for {row['learner_name']} "
            f"{verb} on {row['target_date'].strftime('%B %d, %Y')}. Please update its status.",
            f"learner-profile.html?id={row['learner_id']}&tab=interventions",
            label,
            f"intervention_due:{row['intervention_id']}:{stage}:{row['target_date'].isoformat()}",
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


@bp.get("/admin/notifications/teachers")
@role_required("admin")
def list_notifiable_teachers():
    """Active teachers an admin can pick as recipients when sending an
    announcement or report request, each with the active CLC(s) they're
    assigned to so the picker can group and bulk-select them per CLC."""
    rows = fetch_all(
        """
        SELECT u.user_id AS id, CONCAT_WS(' ', t.first_name, t.last_name) AS name, t.municipality,
               COALESCE(
                   jsonb_agg(DISTINCT jsonb_build_object(
                       'id', c.clc_id, 'name', c.clc_name, 'municipality', c.municipality
                   )) FILTER (WHERE c.clc_id IS NOT NULL),
                   '[]'::jsonb
               ) AS clcs
        FROM users u
        JOIN teacher t ON t.user_id = u.user_id
        LEFT JOIN teacher_clc tc ON tc.teacher_id = t.teacher_id AND tc.assignment_status = 'ACTIVE'
        LEFT JOIN clc c ON c.clc_id = tc.clc_id AND c.status = 'ACTIVE'
        WHERE u.role = 'TEACHER' AND u.account_status = 'ACTIVE'
        GROUP BY u.user_id, t.first_name, t.last_name, t.municipality
        ORDER BY t.last_name, t.first_name
        """
    )
    return {"total": len(rows), "data": [dict(r) for r in rows]}


@bp.post("/admin/notifications/broadcast")
@role_required("admin")
def broadcast_notification():
    """Admin sends a one-off announcement or report request to one or more
    teachers -- lands in each teacher's existing notification inbox. Unlike
    the auto-generated risk/intervention alerts, these are never deduped:
    every send is a deliberate, individually-authored message."""
    data = request.get_json(silent=True) or {}
    kind = str(data.get("kind") or "").strip().upper()
    title = str(data.get("title") or "").strip()
    message = str(data.get("message") or "").strip()
    teacher_user_ids = data.get("teacherUserIds")

    if kind not in BROADCAST_KINDS:
        return error("Please choose Announcement or Report Request.", 422)
    if not title or not message:
        return error("A title and message are required.", 422)
    if not isinstance(teacher_user_ids, list) or not teacher_user_ids:
        return error("Select at least one teacher to notify.", 422)

    try:
        target_ids = list({int(x) for x in teacher_user_ids})
    except (TypeError, ValueError):
        return error("Please select teachers from the list.", 422)

    valid_rows = fetch_all(
        "SELECT user_id FROM users WHERE user_id = ANY(%s) AND role='TEACHER' AND account_status='ACTIVE'",
        (target_ids,),
    )
    valid_ids = [r["user_id"] for r in valid_rows]
    if not valid_ids:
        return error("None of the selected teachers could be notified.", 422)

    for user_id in valid_ids:
        _insert_alert(user_id, kind, title, message, None, BROADCAST_KINDS[kind], None)

    return {"message": f"Sent to {len(valid_ids)} teacher(s).", "sent": len(valid_ids)}
