from __future__ import annotations

from flask import Blueprint

from ..authz import current_user_id, role_required
from ..db import execute, fetch_all, fetch_one
from ..helpers import error

bp = Blueprint("notifications", __name__)


def _shape(row):
    return {
        "id": row["notification_id"],
        "type": row["notification_type"].lower(),
        "title": row["title"],
        "message": row["message"],
        "time": row["created_at"].strftime("%b %d, %Y %I:%M %p"),
        "read": bool(row["is_read"]),
        "link": row.get("link"),
    }


@bp.get("/notifications")
@role_required("teacher", "admin", "coordinator")
def list_notifications():
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
