from __future__ import annotations

from flask import Blueprint, request

from ..authz import role_required
from ..db import fetch_all, fetch_one, get_db
from ..helpers import error

bp = Blueprint("admin", __name__)


@bp.get("/admin/users/pending")
@role_required("admin")
def pending_users():
    rows = fetch_all(
        """
        SELECT
            u.user_id AS id,
            u.email,
            u.username,
            u.account_status,
            t.employee_id,
            t.first_name,
            t.middle_name,
            t.last_name,
            t.municipality,
            t.status AS teacher_status,
            u.created_at
        FROM users u
        JOIN teacher t ON t.user_id = u.user_id
        WHERE u.role = 'TEACHER' AND u.account_status = 'INACTIVE'
        ORDER BY u.created_at ASC
        """
    )
    return {
        "total": len(rows),
        "data": [
            {
                **dict(row),
                "full_name": " ".join(
                    str(part) for part in (
                        row.get("first_name"), row.get("middle_name"), row.get("last_name")
                    ) if part
                ),
                "created_at": row["created_at"].isoformat(),
            }
            for row in rows
        ],
    }


@bp.post("/admin/users/<int:user_id>/approve")
@role_required("admin")
def approve_user(user_id: int):
    data = request.get_json(silent=True) or {}
    employee_id = str(data.get("employee_id") or "").strip()

    row = fetch_one(
        """
        SELECT u.user_id, u.account_status, t.teacher_id, t.employee_id
        FROM users u
        JOIN teacher t ON t.user_id = u.user_id
        WHERE u.user_id = %s AND u.role = 'TEACHER'
        """,
        (user_id,),
    )
    if not row:
        return error("Teacher account not found.", 404)

    db = get_db()
    try:
        with db.cursor() as cur:
            cur.execute(
                "UPDATE users SET account_status='ACTIVE' WHERE user_id=%s",
                (user_id,),
            )
            if employee_id:
                cur.execute(
                    "UPDATE teacher SET status='ACTIVE', employee_id=%s WHERE user_id=%s",
                    (employee_id, user_id),
                )
            else:
                cur.execute(
                    "UPDATE teacher SET status='ACTIVE' WHERE user_id=%s",
                    (user_id,),
                )
        db.commit()
    except Exception:
        db.rollback()
        raise

    return {"success": True, "message": "Teacher account approved."}


@bp.post("/admin/users/<int:user_id>/suspend")
@role_required("admin")
def suspend_user(user_id: int):
    row = fetch_one(
        "SELECT user_id FROM users WHERE user_id=%s AND role='TEACHER'",
        (user_id,),
    )
    if not row:
        return error("Teacher account not found.", 404)

    db = get_db()
    try:
        with db.cursor() as cur:
            cur.execute(
                "UPDATE users SET account_status='SUSPENDED' WHERE user_id=%s",
                (user_id,),
            )
            cur.execute(
                "UPDATE teacher SET status='INACTIVE' WHERE user_id=%s",
                (user_id,),
            )
        db.commit()
    except Exception:
        db.rollback()
        raise
    return {"success": True, "message": "Teacher account suspended."}


@bp.get("/admin/model")
@role_required("admin")
def active_model():
    row = fetch_one(
        """
        SELECT model_id, model_name, algorithm, model_version, training_date,
               model_status, description
        FROM model_info
        WHERE model_status='ACTIVE'
        ORDER BY training_date DESC, model_id DESC
        LIMIT 1
        """
    )
    if not row:
        return {"data": None}
    data = dict(row)
    data["training_date"] = row["training_date"].isoformat()
    return {"data": data}
