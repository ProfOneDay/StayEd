from __future__ import annotations

import re
import secrets
from datetime import datetime, timedelta, timezone

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import create_access_token, get_jwt_identity, jwt_required
from werkzeug.security import check_password_hash, generate_password_hash

from ..authz import current_user_id
from ..db import execute, fetch_all, fetch_one, get_db
from ..helpers import EMAIL_RE, EMPLOYEE_ID_ERROR, EMPLOYEE_ID_RE, error, name_parts, split_name
from ..services import rate_limit
from ..services.mailer import ACCENT_WARNING, render_email, send_email
from ..services.roster_service import find_roster_assignment, is_on_teacher_roster
from ..services.settings_service import get_active_school_year

bp = Blueprint("auth", __name__)

# Brute-force / bot limits for the auth endpoints (see services/rate_limit).
_LIMIT_WINDOW_SECONDS = 15 * 60
_LOGIN_FAILS_PER_EMAIL = 10
_LOGIN_FAILS_PER_IP = 30
_CURRENT_PASSWORD_FAILS = 5
_CODE_REQUESTS = 3
_FORGOT_PER_IP = 5
_FORGOT_PER_EMAIL = 3
_RESET_PER_IP = 10

# Password-change confirmation codes (sql/37_password_change_otp.sql).
_OTP_TTL_MINUTES = 10
_OTP_MAX_ATTEMPTS = 5
_RESET_TTL_MINUTES = 30


def _too_many_attempts():
    return error("Too many attempts. Please wait a few minutes and try again.", 429)


def _client_ip() -> str:
    return request.remote_addr or "unknown"


def _password_problem(password: str) -> str | None:
    """Same rules the Change/Reset Password forms show the user."""
    if len(password) < 8:
        return "Password must be at least 8 characters."
    if not re.search(r"[A-Z]", password) or not re.search(r"[a-z]", password) or not re.search(r"[0-9]", password):
        return "Password must include an uppercase letter, a lowercase letter, and a number."
    return None


def _mask_email(email: str) -> str:
    local, _, domain = str(email or "").partition("@")
    if not domain:
        return email
    return f"{local[:2]}{'*' * max(len(local) - 2, 3)}@{domain}"


def _mail_identity(user_id: int):
    return fetch_one(
        """
        SELECT u.email, COALESCE(t.first_name, u.first_name, u.username) AS first_name
        FROM users u
        LEFT JOIN teacher t ON t.user_id = u.user_id
        WHERE u.user_id = %s
        """,
        (user_id,),
    )


def _send_password_changed_notice(user_id: int) -> None:
    """Heads-up after any password change, so an owner whose account was
    taken over finds out right away."""
    who = _mail_identity(user_id)
    if not who or not who.get("email"):
        return
    paragraphs = [
        "The password for your StayEd account was just changed.",
        "If this was you, no action is needed.",
    ]
    closing = ["If you did NOT change it, reset your password right away and tell your Division Administrator."]
    send_email(
        to=who["email"],
        subject="Your StayEd password was changed",
        body="\n\n".join([f"Hi {who['first_name']},", *paragraphs, *closing]),
        html=render_email(
            heading="Password changed",
            greeting_name=who["first_name"],
            paragraphs=paragraphs,
            accent=ACCENT_WARNING,
            closing=closing,
        ),
    )


def _check_current_password(user_id: int, current_password: str):
    """Returns an error response when the current password is wrong (or
    has been guessed wrong too often), else None. Only failures count."""
    key = f"current-password:{user_id}"
    if rate_limit.is_limited(key, _CURRENT_PASSWORD_FAILS, _LIMIT_WINDOW_SECONDS):
        return _too_many_attempts()
    row = fetch_one("SELECT password_hash FROM users WHERE user_id = %s", (user_id,))
    if not row or not check_password_hash(row["password_hash"], current_password):
        rate_limit.record(key, _LIMIT_WINDOW_SECONDS)
        return error("Current password is incorrect.", 422)
    rate_limit.clear(key)
    return None


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
        # Only meaningful for admins (see sql/36_admin_permissions.sql); a
        # teacher row has none of these, so they're always falsy/None for one.
        "isSuperAdmin": bool(row.get("is_super_admin")),
        "canManageClcs": bool(row.get("can_manage_clcs")),
        "canManageUsers": bool(row.get("can_manage_users")),
        "adminTitle": row.get("admin_title") or "",
        "mustChangePassword": bool(row.get("must_change_password")),
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


_USER_SELECT = f"""
    SELECT
        u.user_id, u.username, u.password_hash, u.email, u.role, u.account_status, u.avatar,
        u.is_super_admin, u.can_manage_clcs, u.can_manage_users, u.admin_title, u.must_change_password,
        t.teacher_id, t.middle_name, t.municipality, t.employee_id, t.created_at, t.setup_completed,
        COALESCE(t.first_name, u.first_name) AS first_name,
        COALESCE(t.last_name, u.last_name) AS last_name,
        COALESCE(t.contact_number, u.contact_number) AS contact_number,
        {_TEACHER_CLC_NAMES_SUBQUERY}
    FROM users u
    LEFT JOIN teacher t ON t.user_id = u.user_id
"""


def _user_by_email(email: str):
    return fetch_one(_USER_SELECT + " WHERE LOWER(u.email) = LOWER(%s)", (email,))


def _user_by_id(user_id: int):
    return fetch_one(_USER_SELECT + " WHERE u.user_id = %s", (user_id,))


def _issue_token(user) -> str:
    return create_access_token(
        identity=str(user["user_id"]),
        additional_claims={
            "role": str(user["role"]).lower(),
            "is_super_admin": bool(user.get("is_super_admin")),
            "can_manage_clcs": bool(user.get("can_manage_clcs")),
            "can_manage_users": bool(user.get("can_manage_users")),
            # While set, app/__init__.py refuses everything but setting a
            # new password (sql/38_must_change_password.sql).
            "must_change_password": bool(user.get("must_change_password")),
        },
    )


@bp.post("/auth/login")
def login():
    data = request.get_json(silent=True) or {}
    email = str(data.get("email", "")).strip()
    password = str(data.get("password", ""))
    if not email or not password:
        return error("Email and password are required.", 422)

    # Only wrong passwords count, per account and per IP, so a bot can't
    # keep guessing -- and a real user who finally gets it right is reset.
    email_key = f"login-email:{email.lower()}"
    ip_key = f"login-ip:{_client_ip()}"
    if rate_limit.is_limited(email_key, _LOGIN_FAILS_PER_EMAIL, _LIMIT_WINDOW_SECONDS) or rate_limit.is_limited(
        ip_key, _LOGIN_FAILS_PER_IP, _LIMIT_WINDOW_SECONDS
    ):
        return _too_many_attempts()

    user = _user_by_email(email)
    if not user or not check_password_hash(user["password_hash"], password):
        rate_limit.record(email_key, _LIMIT_WINDOW_SECONDS)
        rate_limit.record(ip_key, _LIMIT_WINDOW_SECONDS)
        return error("The email or password is incorrect.", 401)
    rate_limit.clear(email_key)
    if user["account_status"] != "ACTIVE":
        return error("Your account is not active yet. Please wait for a Division Administrator to approve it.", 403)

    return {"token": _issue_token(user), "user": _safe_user(user)}


@bp.post("/auth/logout")
@jwt_required()
def logout():
    # Stateless access tokens are discarded by the frontend. A deny-list can be
    # added later if immediate server-side token revocation becomes necessary.
    return {"success": True, "message": "Logged out."}


@bp.get("/auth/me")
@jwt_required()
def me():
    row = _user_by_id(current_user_id())
    if not row:
        return error("We could not find your account. Please log in again.", 404)
    return _safe_user(row)


@bp.post("/auth/set-initial-password")
@jwt_required()
def set_initial_password():
    """Replace an admin-issued temporary password with the user's own --
    the only thing such an account can do until it has (see
    sql/38_must_change_password.sql). No emailed code here: the temporary
    password itself was just delivered to the user's email. Returns a fresh
    token without the must_change_password claim, so the frontend can carry
    on without logging in again."""
    _, current_password, new_password = _password_change_fields()
    user_id = current_user_id()

    if not current_password:
        return error("Enter the temporary password you received.", 422)
    problem = _password_problem(new_password)
    if problem:
        return error(problem, 422)
    failure = _check_current_password(user_id, current_password)
    if failure:
        if failure[1] == 422:
            return error("The temporary password is incorrect.", 422)
        return failure
    if current_password == new_password:
        return error("Choose a new password that's different from the temporary one.", 422)

    execute(
        "UPDATE users SET password_hash = %s, must_change_password = FALSE WHERE user_id = %s",
        (generate_password_hash(new_password), user_id),
    )
    _send_password_changed_notice(user_id)

    user = _user_by_id(user_id)
    return {"success": True, "message": "Password set.", "token": _issue_token(user), "user": _safe_user(user)}


@bp.post("/auth/register")
def register():
    data = request.get_json(silent=True) or {}
    # Separate First/Middle/Surname fields when the form sends them (no
    # guessing which word is the surname); legacy single full_name otherwise.
    parts = name_parts(data)
    if parts is not None:
        first_name, middle_name, last_name = parts
        full_name = " ".join(p for p in (first_name, middle_name, last_name) if p)
        if not first_name or not last_name:
            full_name = ""
    else:
        full_name = str(data.get("full_name", "")).strip()
        first_name, last_name = split_name(full_name)
        middle_name = None
    employee_id = str(data.get("employee_id") or data.get("employeeId") or "").strip()
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))
    if not full_name or not employee_id or not email or len(password) < 8:
        return error("Full name, employee ID, email, and a password of at least 8 characters are required.", 422)
    if not EMPLOYEE_ID_RE.match(employee_id):
        return error(EMPLOYEE_ID_ERROR, 422)
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
                    user_id, employee_id, first_name, middle_name, last_name, municipality, status
                ) VALUES (%s, %s, %s, %s, %s, %s, 'INACTIVE')
                RETURNING teacher_id
                """,
                (user_id, employee_id, first_name, middle_name, last_name, municipality),
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
                        + ("" if on_roster else " Their name is not on the official ALS teachers list, so please check their details before approving."),
                        "user-management.html",
                        "Pending" if on_roster else "Not on teacher list",
                        f"registration:{user_id}",
                    ),
                )
        db.commit()
    except Exception:
        db.rollback()
        raise

    return {"success": True, "message": "Registration submitted."}, 201


def _password_change_fields():
    data = request.get_json(silent=True) or {}
    current_password = str(data.get("current_password") or data.get("currentPassword") or "")
    new_password = str(data.get("password") or data.get("new_password") or data.get("newPassword") or "")
    return data, current_password, new_password


@bp.post("/auth/change-password/request-code")
@jwt_required()
def request_password_change_code():
    """Step 1 of changing a password: check the current password and the
    new one, then email a 6-digit code the user must enter in step 2. The
    code proves the person changing the password also controls the
    account's email -- a stolen session or leaked password alone isn't
    enough."""
    _, current_password, new_password = _password_change_fields()
    user_id = current_user_id()

    if not current_password:
        return error("Current password is required.", 422)
    problem = _password_problem(new_password)
    if problem:
        return error(problem, 422)
    failure = _check_current_password(user_id, current_password)
    if failure:
        return failure
    if current_password == new_password:
        return error("Your new password must be different from your current one.", 422)

    if rate_limit.hit(f"otp-request:{user_id}", _CODE_REQUESTS, _LIMIT_WINDOW_SECONDS):
        return error("You've requested too many codes. Please wait a few minutes and try again.", 429)

    who = _mail_identity(user_id)
    if not who or not who.get("email"):
        return error("Your account has no email address to send a code to. Please contact your Division Administrator.", 422)

    code = f"{secrets.randbelow(1_000_000):06d}"
    db = get_db()
    try:
        with db.cursor() as cur:
            # Only the newest code works.
            cur.execute(
                "UPDATE password_change_otp SET used_at = CURRENT_TIMESTAMP WHERE user_id = %s AND used_at IS NULL",
                (user_id,),
            )
            cur.execute(
                "INSERT INTO password_change_otp (user_id, code_hash, expires_at) VALUES (%s, %s, %s)",
                (user_id, generate_password_hash(code), datetime.now(timezone.utc) + timedelta(minutes=_OTP_TTL_MINUTES)),
            )
        db.commit()
    except Exception:
        db.rollback()
        raise

    paragraphs = [
        "Use this code to confirm your StayEd password change.",
        f"It expires in {_OTP_TTL_MINUTES} minutes.",
    ]
    closing = [
        "If you didn't try to change your password, someone may know it. "
        "Reset it right away and tell your Division Administrator."
    ]
    sent = send_email(
        to=who["email"],
        subject=f"{code} is your StayEd verification code",
        body="\n\n".join([f"Hi {who['first_name']},", paragraphs[0], f"Code: {code}", paragraphs[1], *closing]),
        html=render_email(
            heading="Confirm your password change",
            greeting_name=who["first_name"],
            paragraphs=paragraphs,
            accent=ACCENT_WARNING,
            callout=("Verification code", code),
            closing=closing,
        ),
    )
    if not sent and not current_app.debug:
        return error("We couldn't send the verification code right now. Please try again later.", 503)

    masked = _mask_email(who["email"])
    payload = {
        "success": True,
        "message": f"We sent a 6-digit code to {masked}.",
        "email": masked,
        "expiresInMinutes": _OTP_TTL_MINUTES,
    }
    if current_app.debug:
        # Local dev usually has no SMTP configured -- same idea as
        # forgot_password's reset_token.
        payload["devCode"] = code
    return payload


@bp.post("/auth/change-password")
@jwt_required()
def change_password():
    """Step 2: the same password fields again plus the emailed code."""
    data, current_password, new_password = _password_change_fields()
    code = str(data.get("code") or "").strip()
    user_id = current_user_id()

    if not current_password:
        return error("Current password is required.", 422)
    problem = _password_problem(new_password)
    if problem:
        return error(problem, 422)
    if not re.fullmatch(r"\d{6}", code):
        return error("Enter the 6-digit code we emailed you.", 422)
    failure = _check_current_password(user_id, current_password)
    if failure:
        return failure

    otp = fetch_one(
        """
        SELECT otp_id, code_hash, attempts
        FROM password_change_otp
        WHERE user_id = %s AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP
        ORDER BY created_at DESC
        LIMIT 1
        """,
        (user_id,),
    )
    if not otp:
        return error("This code has expired. Please request a new one.", 422)

    if not check_password_hash(otp["code_hash"], code):
        attempts = otp["attempts"] + 1
        if attempts >= _OTP_MAX_ATTEMPTS:
            execute(
                "UPDATE password_change_otp SET attempts = %s, used_at = CURRENT_TIMESTAMP WHERE otp_id = %s",
                (attempts, otp["otp_id"]),
            )
            return error("Too many wrong codes. Please request a new one.", 422)
        execute("UPDATE password_change_otp SET attempts = %s WHERE otp_id = %s", (attempts, otp["otp_id"]))
        left = _OTP_MAX_ATTEMPTS - attempts
        return error(f"That code is incorrect. {left} {'try' if left == 1 else 'tries'} left.", 422)

    db = get_db()
    try:
        with db.cursor() as cur:
            cur.execute(
                "UPDATE users SET password_hash = %s, must_change_password = FALSE WHERE user_id = %s",
                (generate_password_hash(new_password), user_id),
            )
            cur.execute(
                "UPDATE password_change_otp SET used_at = CURRENT_TIMESTAMP WHERE otp_id = %s",
                (otp["otp_id"],),
            )
        db.commit()
    except Exception:
        db.rollback()
        raise

    _send_password_changed_notice(user_id)
    return {"success": True, "message": "Password successfully changed."}


@bp.post("/auth/forgot-password")
def forgot_password():
    data = request.get_json(silent=True) or {}
    email = str(data.get("email", "")).strip().lower()
    if not email or not EMAIL_RE.match(email):
        return error("Enter a valid email address.", 422)

    if rate_limit.hit(f"forgot-ip:{_client_ip()}", _FORGOT_PER_IP, _LIMIT_WINDOW_SECONDS) or rate_limit.hit(
        f"forgot-email:{email}", _FORGOT_PER_EMAIL, _LIMIT_WINDOW_SECONDS
    ):
        return _too_many_attempts()

    # Same answer whether or not the account exists, so this can't be used
    # to find out which emails are registered.
    generic = {"success": True, "message": "If an account uses that email, we've sent a password reset link to it."}

    row = fetch_one("SELECT user_id FROM users WHERE LOWER(email) = LOWER(%s)", (email,))
    if not row:
        return generic

    token = secrets.token_urlsafe(32)
    db = get_db()
    try:
        with db.cursor() as cur:
            # Only the newest link works.
            cur.execute(
                "UPDATE password_reset_token SET used_at = CURRENT_TIMESTAMP WHERE user_id = %s AND used_at IS NULL",
                (row["user_id"],),
            )
            cur.execute(
                "INSERT INTO password_reset_token (user_id, token, expires_at) VALUES (%s, %s, %s)",
                (row["user_id"], token, datetime.now(timezone.utc) + timedelta(minutes=_RESET_TTL_MINUTES)),
            )
        db.commit()
    except Exception:
        db.rollback()
        raise

    site = current_app.config.get("PUBLIC_SITE_URL", "https://stay-ed.site")
    link = f"{site}/pages/auth/reset-password.html?token={token}"
    who = _mail_identity(row["user_id"]) or {}
    first_name = who.get("first_name") or ""
    paragraphs = [
        "We received a request to reset your StayEd password.",
        f"Click the button below to choose a new one. The link expires in {_RESET_TTL_MINUTES} minutes and works only once.",
    ]
    closing = ["If you didn't ask for this, you can ignore this email. Your password won't change."]
    send_email(
        to=who.get("email") or email,
        subject="Reset your StayEd password",
        body="\n\n".join([f"Hi {first_name}," if first_name else "Hi,", *paragraphs, link, *closing]),
        html=render_email(
            heading="Reset your password",
            greeting_name=first_name,
            paragraphs=paragraphs,
            accent=ACCENT_WARNING,
            button=("Reset password", link),
            closing=closing,
        ),
    )

    if current_app.debug:
        return {**generic, "reset_token": token, "reset_link": link}
    return generic


@bp.post("/auth/reset-password")
def reset_password():
    if rate_limit.hit(f"reset-ip:{_client_ip()}", _RESET_PER_IP, _LIMIT_WINDOW_SECONDS):
        return _too_many_attempts()

    data = request.get_json(silent=True) or {}
    token = str(data.get("token", ""))
    password = str(data.get("password", ""))
    if not token:
        return error("This reset link is not valid. Please request a new one.", 422)
    problem = _password_problem(password)
    if problem:
        return error(problem, 422)

    row = fetch_one(
        """
        SELECT reset_id, user_id
        FROM password_reset_token
        WHERE token = %s AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP
        """,
        (token,),
    )
    if not row:
        return error("This password reset link has expired or was already used. Please request a new one.", 422)

    db = get_db()
    try:
        with db.cursor() as cur:
            cur.execute(
                "UPDATE users SET password_hash = %s, must_change_password = FALSE WHERE user_id = %s",
                (generate_password_hash(password), row["user_id"]),
            )
            # Burns this link and any other outstanding one for the account.
            cur.execute(
                "UPDATE password_reset_token SET used_at = CURRENT_TIMESTAMP WHERE user_id = %s AND used_at IS NULL",
                (row["user_id"],),
            )
        db.commit()
    except Exception:
        db.rollback()
        raise

    rate_limit.clear(f"current-password:{row['user_id']}")
    _send_password_changed_notice(row["user_id"])
    return {"success": True, "message": "Password updated successfully."}


@bp.post("/auth/verify-email")
def verify_email():
    # Kept for frontend contract compatibility. Registration approval should
    # eventually be handled by the administrator module.
    data = request.get_json(silent=True) or {}
    token = str(data.get("token", ""))
    if not token:
        return error("This verification link is not valid.", 422)
    return {"success": True, "message": "Email verification endpoint is ready for provider integration."}
