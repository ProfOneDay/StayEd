from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import create_access_token, get_jwt_identity, jwt_required
from werkzeug.security import check_password_hash, generate_password_hash

from ..authz import current_user_id
from ..db import execute, fetch_one, get_db
from ..helpers import error, split_name

bp = Blueprint("auth", __name__)


def _safe_user(row):
    full_name = " ".join(
        p for p in [row.get("first_name"), row.get("middle_name"), row.get("last_name")] if p
    ).strip()
    return {
        "id": row["user_id"],
        "role": str(row["role"]).lower(),
        "status": "approved" if row["account_status"] == "ACTIVE" else row["account_status"].lower(),
        "email": row.get("email"),
        "first_name": row.get("first_name") or row.get("username"),
        "last_name": row.get("last_name") or "",
        "full_name": full_name or row.get("username"),
        "phone": row.get("contact_number") or "",
        "school": row.get("clc_name") or "",
        "municipality": row.get("municipality") or "",
    }


def _user_by_email(email: str):
    return fetch_one(
        """
        SELECT
            u.user_id, u.username, u.password_hash, u.email, u.role, u.account_status,
            t.teacher_id, t.middle_name, t.municipality,
            COALESCE(t.first_name, u.first_name) AS first_name,
            COALESCE(t.last_name, u.last_name) AS last_name,
            COALESCE(t.contact_number, u.contact_number) AS contact_number,
            c.clc_name
        FROM users u
        LEFT JOIN teacher t ON t.user_id = u.user_id
        LEFT JOIN LATERAL (
            SELECT c.clc_name
            FROM teacher_clc tc
            JOIN clc c ON c.clc_id = tc.clc_id
            WHERE tc.teacher_id = t.teacher_id
              AND tc.assignment_status = 'ACTIVE'
            ORDER BY tc.assigned_at DESC
            LIMIT 1
        ) c ON TRUE
        WHERE LOWER(u.email) = LOWER(%s)
        """,
        (email,),
    )


@bp.post("/auth/login")
def login():
    data = request.get_json(silent=True) or {}
    email = str(data.get("email", "")).strip()
    password = str(data.get("password", ""))
    if not email or not password:
        return error("Email and password are required.", 422)

    user = _user_by_email(email)
    if not user or not check_password_hash(user["password_hash"], password):
        return error("Invalid email or password.", 401)
    if user["account_status"] != "ACTIVE":
        return error("Your account is not active yet.", 403)

    token = create_access_token(
        identity=str(user["user_id"]),
        additional_claims={"role": str(user["role"]).lower()},
    )
    return {"token": token, "user": _safe_user(user)}


@bp.post("/auth/logout")
@jwt_required()
def logout():
    # Stateless access tokens are discarded by the frontend. A deny-list can be
    # added later if immediate server-side token revocation becomes necessary.
    return {"success": True, "message": "Logged out."}


@bp.get("/auth/me")
@jwt_required()
def me():
    row = fetch_one(
        """
        SELECT
            u.user_id, u.username, u.email, u.role, u.account_status,
            t.middle_name, t.municipality,
            COALESCE(t.first_name, u.first_name) AS first_name,
            COALESCE(t.last_name, u.last_name) AS last_name,
            COALESCE(t.contact_number, u.contact_number) AS contact_number,
            c.clc_name
        FROM users u
        LEFT JOIN teacher t ON t.user_id = u.user_id
        LEFT JOIN LATERAL (
            SELECT c.clc_name
            FROM teacher_clc tc
            JOIN clc c ON c.clc_id = tc.clc_id
            WHERE tc.teacher_id = t.teacher_id
              AND tc.assignment_status = 'ACTIVE'
            ORDER BY tc.assigned_at DESC
            LIMIT 1
        ) c ON TRUE
        WHERE u.user_id = %s
        """,
        (current_user_id(),),
    )
    if not row:
        return error("User not found.", 404)
    return _safe_user(row)


@bp.post("/auth/register")
def register():
    data = request.get_json(silent=True) or {}
    full_name = str(data.get("full_name", "")).strip()
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))
    if not full_name or not email or len(password) < 8:
        return error("Full name, email, and a password of at least 8 characters are required.", 422)

    if fetch_one("SELECT user_id FROM users WHERE LOWER(email) = LOWER(%s)", (email,)):
        return error("Email already exists.", 409)

    first_name, last_name = split_name(full_name)
    username_base = email.split("@", 1)[0][:80] or "teacher"
    username = username_base
    suffix = 1
    while fetch_one("SELECT user_id FROM users WHERE username = %s", (username,)):
        suffix += 1
        username = f"{username_base}{suffix}"

    db = get_db()
    try:
        with db.cursor() as cur:
            cur.execute(
                """
                INSERT INTO users (username, password_hash, email, role, account_status)
                VALUES (%s, %s, %s, 'TEACHER', 'INACTIVE')
                RETURNING user_id
                """,
                (username, generate_password_hash(password), email),
            )
            user_id = cur.fetchone()["user_id"]
            cur.execute(
                """
                INSERT INTO teacher (
                    user_id, employee_id, first_name, last_name, municipality, status
                ) VALUES (%s, %s, %s, %s, %s, 'INACTIVE')
                """,
                (user_id, f"PENDING-{user_id}", first_name, last_name, "Unassigned"),
            )
        db.commit()
    except Exception:
        db.rollback()
        raise

    return {"success": True, "message": "Registration submitted."}, 201


@bp.post("/auth/change-password")
@jwt_required()
def change_password():
    data = request.get_json(silent=True) or {}
    current_password = str(data.get("current_password") or data.get("currentPassword") or "")
    new_password = str(data.get("password") or data.get("new_password") or data.get("newPassword") or "")
    if not current_password:
        return error("Current password is required.", 422)
    if len(new_password) < 8:
        return error("New password must be at least 8 characters.", 422)

    row = fetch_one("SELECT password_hash FROM users WHERE user_id = %s", (current_user_id(),))
    if not row or not check_password_hash(row["password_hash"], current_password):
        return error("Current password is incorrect.", 422)

    execute(
        "UPDATE users SET password_hash = %s WHERE user_id = %s",
        (generate_password_hash(new_password), current_user_id()),
    )
    return {"success": True, "message": "Password successfully changed."}


@bp.post("/auth/forgot-password")
def forgot_password():
    data = request.get_json(silent=True) or {}
    email = str(data.get("email", "")).strip().lower()
    row = fetch_one("SELECT user_id FROM users WHERE LOWER(email) = LOWER(%s)", (email,))
    if not row:
        # Do not reveal whether an account exists.
        return {"success": True, "message": "If the account exists, a reset link will be issued."}

    token = secrets.token_urlsafe(32)
    execute(
        """
        INSERT INTO password_reset_token (user_id, token, expires_at)
        VALUES (%s, %s, %s)
        """,
        (row["user_id"], token, datetime.now(timezone.utc) + timedelta(minutes=30)),
    )
    payload = {"success": True, "message": "Password reset request created."}
    if current_app.debug:
        payload["reset_token"] = token
    return payload


@bp.post("/auth/reset-password")
def reset_password():
    data = request.get_json(silent=True) or {}
    token = str(data.get("token", ""))
    password = str(data.get("password", ""))
    if not token or len(password) < 8:
        return error("A valid reset token and an 8-character password are required.", 422)

    row = fetch_one(
        """
        SELECT reset_id, user_id
        FROM password_reset_token
        WHERE token = %s AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP
        """,
        (token,),
    )
    if not row:
        return error("Reset token is invalid or expired.", 422)

    db = get_db()
    try:
        with db.cursor() as cur:
            cur.execute(
                "UPDATE users SET password_hash = %s WHERE user_id = %s",
                (generate_password_hash(password), row["user_id"]),
            )
            cur.execute(
                "UPDATE password_reset_token SET used_at = CURRENT_TIMESTAMP WHERE reset_id = %s",
                (row["reset_id"],),
            )
        db.commit()
    except Exception:
        db.rollback()
        raise
    return {"success": True, "message": "Password updated successfully."}


@bp.post("/auth/verify-email")
def verify_email():
    # Kept for frontend contract compatibility. Registration approval should
    # eventually be handled by the administrator module.
    data = request.get_json(silent=True) or {}
    token = str(data.get("token", ""))
    if not token:
        return error("Verification token is required.", 422)
    return {"success": True, "message": "Email verification endpoint is ready for provider integration."}
