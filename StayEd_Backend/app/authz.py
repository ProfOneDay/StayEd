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


_UNAUTHORIZED = {"message": "You are not authorized to perform this action."}, 403


def super_admin_required(fn):
    """Only an admin with is_super_admin=True -- assigning other admins'
    permissions/titles, or promoting/demoting super_admin itself, is
    reserved for this tier (see sql/36_admin_permissions.sql)."""

    @wraps(fn)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()
        claims = get_jwt()
        if str(claims.get("role", "")).lower() != "admin" or not claims.get("is_super_admin"):
            return _UNAUTHORIZED
        return fn(*args, **kwargs)

    return wrapper


def admin_permission_required(permission: str):
    """Admin-only route additionally gated by one of the scoped permission
    flags (can_manage_clcs / can_manage_users). A super admin always passes
    regardless of the flag, same as it bypasses both everywhere else.

    These flags are baked into the JWT at login (see auth_routes.py) rather
    than checked against the database on every request, same tradeoff the
    existing `role` claim already makes -- a permission change by a super
    admin takes effect next login/token refresh, not mid-session.
    """

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            claims = get_jwt()
            if str(claims.get("role", "")).lower() != "admin":
                return _UNAUTHORIZED
            if not claims.get("is_super_admin") and not claims.get(permission):
                return _UNAUTHORIZED
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
