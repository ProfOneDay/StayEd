from __future__ import annotations

import json

from flask import Blueprint, request
from flask_jwt_extended import jwt_required

from ..authz import current_user_id, teacher_for_user
from ..db import execute, fetch_one, get_db
from ..helpers import EMAIL_RE, error, split_name

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
    if email and not EMAIL_RE.match(email):
        return error("Enter a valid email address.", 422)
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


@bp.get("/users/settings")
@jwt_required()
def get_settings():
    user_id = current_user_id()
    row = fetch_one("SELECT preferences, avatar FROM users WHERE user_id = %s", (user_id,))
    if not row:
        return error("Account not found.", 404)
    return {"preferences": row["preferences"] or {}, "avatar": row.get("avatar")}


@bp.put("/users/settings")
@jwt_required()
def update_settings():
    user_id = current_user_id()
    data = request.get_json(silent=True) or {}
    incoming = data.get("preferences")
    if not isinstance(incoming, dict):
        return error("preferences must be an object.", 422)

    row = fetch_one("SELECT preferences FROM users WHERE user_id = %s", (user_id,))
    if not row:
        return error("Account not found.", 404)

    merged = {**(row["preferences"] or {}), **incoming}

    execute(
        "UPDATE users SET preferences = %s::jsonb WHERE user_id = %s",
        (json.dumps(merged), user_id),
    )

    return {"preferences": merged}


@bp.put("/users/settings/avatar")
@jwt_required()
def update_avatar():
    user_id = current_user_id()
    data = request.get_json(silent=True) or {}
    avatar = data.get("avatar")

    if avatar is not None:
        allowed_prefixes = (
            "data:image/jpeg;base64,",
            "data:image/png;base64,",
            "data:image/webp;base64,",
        )
        if not isinstance(avatar, str) or not avatar.startswith(allowed_prefixes):
            return error("Profile photo must be a JPG, PNG, or WEBP image.", 422)
        # The browser limits the source file to 2 MB. Base64 encoding expands
        # the payload by roughly one third, so 3 MB safely accommodates the
        # encoded image while still preventing unusually large values.
        if len(avatar) > 3 * 1024 * 1024:
            return error("Image is too large. Please choose a photo that is 2 MB or smaller.", 422)

    execute("UPDATE users SET avatar = %s WHERE user_id = %s", (avatar, user_id))

    return {"avatar": avatar}
