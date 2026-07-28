from __future__ import annotations

from flask import Blueprint, request
from flask_jwt_extended import jwt_required

from ..authz import current_user_id, teacher_for_user
from ..db import get_db
from ..helpers import error, split_name

bp = Blueprint("users", __name__)


@bp.put("/users/profile")
@jwt_required()
def update_profile():
    data = request.get_json(silent=True) or {}
    user_id = current_user_id()
    teacher = teacher_for_user(user_id)
    if not teacher:
        return error("Teacher profile not found.", 404)

    full_name = str(data.get("full_name") or "").strip()
    if full_name:
        first_name, last_name = split_name(full_name)
    else:
        first_name = str(data.get("first_name") or teacher["first_name"]).strip()
        last_name = str(data.get("last_name") or teacher["last_name"]).strip()

    email = str(data.get("email") or teacher.get("email") or "").strip().lower()
    municipality = str(data.get("municipality") or teacher.get("municipality") or "Unassigned").strip()
    contact_number = str(data.get("contact_number") or data.get("phone") or teacher.get("contact_number") or "").strip() or None

    db = get_db()
    try:
        with db.cursor() as cur:
            cur.execute("UPDATE users SET email = %s WHERE user_id = %s", (email, user_id))
            cur.execute(
                """
                UPDATE teacher
                SET first_name = %s, last_name = %s, municipality = %s, contact_number = %s
                WHERE user_id = %s
                """,
                (first_name, last_name, municipality, contact_number, user_id),
            )
        db.commit()
    except Exception:
        db.rollback()
        raise

    return {
        "id": user_id,
        "role": str(teacher["role"]).lower(),
        "email": email,
        "first_name": first_name,
        "last_name": last_name,
        "full_name": f"{first_name} {last_name}".strip(),
        "municipality": municipality,
        "status": "approved" if teacher["account_status"] == "ACTIVE" else teacher["account_status"].lower(),
    }
