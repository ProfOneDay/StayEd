from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import create_access_token, get_jwt_identity, jwt_required
from werkzeug.security import check_password_hash, generate_password_hash

from ..authz import current_user_id
from ..db import execute, fetch_all, fetch_one, get_db
from ..helpers import EMAIL_RE, error, split_name
from ..services.roster_service import find_roster_assignment, is_on_teacher_roster
from ..services.settings_service import get_active_school_year

bp = Blueprint("auth", __name__)


def _safe_user(row):
    full_name = " ".join(
        p for p in [row.get("first_name"), row.get("middle_name"), row.get("last_name")] if p
    ).strip()
    # A teacher can have several ACTIVE teacher_clc rows (e.g. a cluster
    # coordinator covering multiple CLCs) -- "school" stays a single string
    # for anything that only ever showed one, "schools" is the full list so
    # Profile Settings can show all of them instead of just the newest.
    schools = row.get("clc_names") or []
    return {
        "id": row["user_id"],
        "role": str(row["role"]).lower(),
        "status": "approved" if row["account_status"] == "ACTIVE" else row["account_status"].lower(),
        "email": row.get("email"),
        "first_name": row.get("first_name") or row.get("username"),
        "last_name": row.get("last_name") or "",
        "full_name": full_name or row.get("username"),
        "phone": row.get("contact_number") or "",
        "school": schools[0] if schools else "",
        "schools": schools,
        "municipality": row.get("municipality") or "",
        "avatar": row.get("avatar") or "",
        "employee_id": row.get("employee_id") or "",
        "join_date": row["created_at"].date().isoformat() if row.get("created_at") else "",
        # Only meaningful for teachers (see sql/34_teacher_setup_wizard_flag.sql);
        # admins have no teacher row, so this is None -- treat that as "nothing
        # to complete" rather than "not completed".
        "setup_completed": True if row.get("setup_completed") is None else bool(row["setup_completed"]),
    }


_TEACHER_CLC_NAMES_SUBQUERY = """
    (
        SELECT json_agg(c.clc_name ORDER BY tc.assigned_at DESC)
        FROM teacher_clc tc
        JOIN clc c ON c.clc_id = tc.clc_id
        WHERE tc.teacher_id = t.teacher_id
          AND tc.assignment_status = 'ACTIVE'
    ) AS clc_names
"""


def _user_by_email(email: str):
    return fetch_one(
        f"""
        SELECT
            u.user_id, u.username, u.password_hash, u.email, u.role, u.account_status, u.avatar,
            t.teacher_id, t.middle_name, t.municipality, t.employee_id, t.created_at, t.setup_completed,
            COALESCE(t.first_name, u.first_name) AS first_name,
            COALESCE(t.last_name, u.last_name) AS last_name,
            COALESCE(t.contact_number, u.contact_number) AS contact_number,
            {_TEACHER_CLC_NAMES_SUBQUERY}
        FROM users u
        LEFT JOIN teacher t ON t.user_id = u.user_id
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
        f"""
        SELECT
            u.user_id, u.username, u.email, u.role, u.account_status, u.avatar,
            t.middle_name, t.municipality, t.employee_id, t.created_at, t.setup_completed,
            COALESCE(t.first_name, u.first_name) AS first_name,
            COALESCE(t.last_name, u.last_name) AS last_name,
            COALESCE(t.contact_number, u.contact_number) AS contact_number,
            {_TEACHER_CLC_NAMES_SUBQUERY}
        FROM users u
        LEFT JOIN teacher t ON t.user_id = u.user_id
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
    employee_id = str(data.get("employee_id") or data.get("employeeId") or "").strip()
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))
    if not full_name or not employee_id or not email or len(password) < 8:
        return error("Full name, employee ID, email, and a password of at least 8 characters are required.", 422)
    if not EMAIL_RE.match(email):
        return error("Enter a valid email address.", 422)

    if fetch_one("SELECT user_id FROM users WHERE LOWER(email) = LOWER(%s)", (email,)):
        return error("Email already exists.", 409)

    # A name not on the division's official ALS Teachers roster no longer
    # blocks registration outright -- it still goes through, but flagged
    # (isOnRoster, surfaced in the admin review screen same as isDepedVerified)
    # so an admin manually verifies it before approving, instead of nobody
    # ever checking.
    on_roster = is_on_teacher_roster(full_name)

    first_name, last_name = split_name(full_name)
    username_base = email.split("@", 1)[0][:80] or "teacher"
    username = username_base
    suffix = 1
    while fetch_one("SELECT user_id FROM users WHERE username = %s", (username,)):
        suffix += 1
        username = f"{username_base}{suffix}"

    # Being on the roster (checked above) only proves the name is a real ALS
    # teacher -- it doesn't guarantee their listed station school has a
    # matching clc row yet, so this can legitimately come back empty. That's
    # not an error: the teacher still registers, just as "Unassigned" for an
    # admin to assign manually later, same as before this existed. The
    # municipality still comes from the roster's ALS district when the station
    # school has no clc row, so the admin only has to pick the CLC.
    roster = find_roster_assignment(full_name)
    roster_clc = roster if roster and roster["clc_id"] else None
    municipality = (roster or {}).get("municipality") or "Unassigned"

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
                RETURNING teacher_id
                """,
                (user_id, employee_id, first_name, last_name, municipality),
            )
            teacher_id = cur.fetchone()["teacher_id"]

            if roster_clc:
                cur.execute(
                    """
                    INSERT INTO teacher_clc (teacher_id, clc_id, school_year, assignment_status)
                    VALUES (%s, %s, %s, 'ACTIVE')
                    ON CONFLICT (teacher_id, clc_id, school_year) DO NOTHING
                    """,
                    (teacher_id, roster_clc["clc_id"], get_active_school_year()),
                )

            admins = fetch_all("SELECT user_id FROM users WHERE role = 'ADMIN' AND account_status = 'ACTIVE'")
            for admin in admins:
                cur.execute(
                    """
                    INSERT INTO notification (user_id, notification_type, title, message, link, meta_label, dedup_key)
                    VALUES (%s, 'INFO', %s, %s, %s, %s, %s)
                    ON CONFLICT (user_id, dedup_key) WHERE dedup_key IS NOT NULL DO NOTHING
                    """,
                    (
                        admin["user_id"],
                        "New Teacher Registration",
                        f"{full_name} ({email}) has registered and is awaiting approval."
                        + ("" if on_roster else " Not found on the official ALS Teachers roster -- verify manually."),
                        "user-management.html",
                        "Pending" if on_roster else "Not on Roster",
                        f"registration:{user_id}",
                    ),
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
    if not email or not EMAIL_RE.match(email):
        return error("Enter a valid email address.", 422)

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
