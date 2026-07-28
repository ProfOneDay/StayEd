from __future__ import annotations

from functools import wraps

from flask_jwt_extended import get_jwt, get_jwt_identity, verify_jwt_in_request

from .db import fetch_one


def current_user_id() -> int:
    return int(get_jwt_identity())


def role_required(*roles: str):
    allowed = {r.lower() for r in roles}

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            role = str(get_jwt().get("role", "")).lower()
            if role not in allowed:
                return {"message": "You are not authorized to perform this action."}, 403
            return fn(*args, **kwargs)

        return wrapper

    return decorator


def teacher_for_user(user_id: int | None = None):
    uid = user_id or current_user_id()
    return fetch_one(
        """
        SELECT t.*, u.email, u.username, u.role, u.account_status
        FROM users u
        JOIN teacher t ON t.user_id = u.user_id
        WHERE u.user_id = %s
        """,
        (uid,),
    )
