from __future__ import annotations

import re
import secrets

from flask import Blueprint, request
from werkzeug.security import generate_password_hash

from ..authz import current_user_id, role_required
from ..db import execute, fetch_all, fetch_one, get_db
from ..helpers import error, split_name
from ..services.mailer import send_email
from ..services.settings_service import (
    get_active_school_year,
    get_default_module_duration_days,
    set_active_school_year,
    set_default_module_duration_days,
)

bp = Blueprint("admin", __name__)

_ACCOUNT_STATUS_TO_UI = {"ACTIVE": "active", "INACTIVE": "pending", "SUSPENDED": "deactivated"}

_USER_ROW_QUERY = """
    SELECT
        u.user_id AS id, u.email, u.account_status, u.created_at,
        t.teacher_id, t.employee_id, t.first_name, t.middle_name, t.last_name,
        t.contact_number, t.municipality,
        COALESCE(
            json_agg(c.clc_name) FILTER (WHERE c.clc_name IS NOT NULL), '[]'
        ) AS clcs
    FROM users u
    JOIN teacher t ON t.user_id = u.user_id
    LEFT JOIN teacher_clc tc ON tc.teacher_id = t.teacher_id AND tc.assignment_status = 'ACTIVE'
    LEFT JOIN clc c ON c.clc_id = tc.clc_id
    WHERE u.role = 'TEACHER' AND u.user_id = %s
    GROUP BY u.user_id, t.teacher_id, t.employee_id, t.first_name, t.middle_name,
             t.last_name, t.contact_number, t.municipality
"""


def _admin_teacher_row(row):
    full_name = " ".join(
        str(part) for part in (row.get("first_name"), row.get("middle_name"), row.get("last_name")) if part
    )
    clcs = row.get("clcs") or []
    return {
        "id": row["id"],
        "firstName": row.get("first_name") or "",
        "middleName": row.get("middle_name") or "",
        "lastName": row.get("last_name") or "",
        "name": full_name,
        "email": row.get("email") or "",
        "phone": row.get("contact_number") or "",
        "employeeId": row.get("employee_id") or "",
        "clc": clcs[0] if clcs else "",
        "clcs": clcs,
        "municipality": row.get("municipality") or "",
        "status": _ACCOUNT_STATUS_TO_UI.get(row["account_status"], "pending"),
        "date": row["created_at"].strftime("%b %d, %Y") if row.get("created_at") else "",
    }


def _load_admin_user(user_id: int):
    row = fetch_one(_USER_ROW_QUERY, (user_id,))
    return _admin_teacher_row(row) if row else None


def _merge_field(data: dict, key: str, current):
    if key in data and data[key] is not None:
        return str(data[key]).strip() or None
    return current


def _generate_temp_password() -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"
    return "StayEd-" + "".join(secrets.choice(alphabet) for _ in range(8))


@bp.get("/admin/users")
@role_required("admin")
def list_users():
    rows = fetch_all(
        """
        SELECT
            u.user_id AS id, u.email, u.account_status, u.created_at,
            t.employee_id, t.first_name, t.middle_name, t.last_name,
            t.contact_number, t.municipality,
            COALESCE(
                json_agg(c.clc_name) FILTER (WHERE c.clc_name IS NOT NULL), '[]'
            ) AS clcs
        FROM users u
        JOIN teacher t ON t.user_id = u.user_id
        LEFT JOIN teacher_clc tc ON tc.teacher_id = t.teacher_id AND tc.assignment_status = 'ACTIVE'
        LEFT JOIN clc c ON c.clc_id = tc.clc_id
        WHERE u.role = 'TEACHER'
        GROUP BY u.user_id, t.teacher_id, t.employee_id, t.first_name, t.middle_name,
                 t.last_name, t.contact_number, t.municipality
        ORDER BY u.created_at DESC
        """
    )
    return {"total": len(rows), "data": [_admin_teacher_row(r) for r in rows]}


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
        SELECT u.user_id, u.account_status, u.email, t.teacher_id, t.employee_id, t.first_name
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

    if row.get("email"):
        send_email(
            row["email"],
            "Your StayEd account has been approved",
            f"Hi {row.get('first_name') or ''},\n\n"
            "Your StayEd teacher account has been approved by a Division Administrator. "
            "You can now log in at StayEd using the email and password you registered with.\n\n"
            "— StayEd",
        )

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


@bp.post("/admin/users/<int:user_id>/reject")
@role_required("admin")
def reject_user(user_id: int):
    row = fetch_one(
        """
        SELECT u.user_id, u.email, t.first_name
        FROM users u
        JOIN teacher t ON t.user_id = u.user_id
        WHERE u.user_id=%s AND u.role='TEACHER' AND u.account_status='INACTIVE'
        """,
        (user_id,),
    )
    if not row:
        return error("Pending teacher registration not found.", 404)

    db = get_db()
    try:
        with db.cursor() as cur:
            cur.execute("DELETE FROM teacher WHERE user_id=%s", (user_id,))
            cur.execute("DELETE FROM users WHERE user_id=%s", (user_id,))
        db.commit()
    except Exception:
        db.rollback()
        raise

    if row.get("email"):
        send_email(
            row["email"],
            "Your StayEd registration was not approved",
            f"Hi {row.get('first_name') or ''},\n\n"
            "Your StayEd teacher account registration was reviewed by a Division Administrator "
            "and was not approved at this time. If you believe this was a mistake, please contact "
            "your Division Office for more information.\n\n"
            "— StayEd",
        )

    return {"success": True, "message": "Registration rejected."}


@bp.put("/admin/users/<int:user_id>")
@role_required("admin")
def update_user(user_id: int):
    existing = fetch_one(
        """
        SELECT u.user_id, u.email, t.teacher_id, t.first_name, t.middle_name, t.last_name,
               t.employee_id, t.contact_number, t.municipality
        FROM users u
        JOIN teacher t ON t.user_id = u.user_id
        WHERE u.user_id = %s AND u.role = 'TEACHER'
        """,
        (user_id,),
    )
    if not existing:
        return error("Teacher account not found.", 404)

    data = request.get_json(silent=True) or {}
    first_name = _merge_field(data, "firstName", existing["first_name"])
    middle_name = _merge_field(data, "middleName", existing.get("middle_name"))
    last_name = _merge_field(data, "lastName", existing["last_name"])
    employee_id = _merge_field(data, "employeeId", existing["employee_id"])
    contact_number = _merge_field(data, "phone", existing.get("contact_number"))
    email = _merge_field(data, "email", existing["email"])
    municipality = _merge_field(data, "municipality", existing.get("municipality")) or "Unassigned"

    if not first_name or not last_name or not email or not employee_id:
        return error("First name, last name, employee ID, and email are required.", 422)
    email = email.lower()

    db = get_db()
    try:
        with db.cursor() as cur:
            cur.execute("UPDATE users SET email = %s WHERE user_id = %s", (email, user_id))
            cur.execute(
                """
                UPDATE teacher
                SET first_name=%s, middle_name=%s, last_name=%s, employee_id=%s,
                    contact_number=%s, municipality=%s
                WHERE user_id=%s
                """,
                (first_name, middle_name, last_name, employee_id, contact_number, municipality, user_id),
            )

            if isinstance(data.get("clcs"), list):
                teacher_id = existing["teacher_id"]
                school_year = str(data.get("schoolYear") or "").strip() or get_active_school_year()
                clc_names = [str(c).strip() for c in data["clcs"] if str(c).strip()]

                clc_ids = []
                for name in clc_names:
                    cur.execute(
                        "SELECT clc_id FROM clc WHERE LOWER(clc_name) = LOWER(%s) LIMIT 1",
                        (name,),
                    )
                    found = cur.fetchone()
                    if found:
                        clc_ids.append(found["clc_id"])

                cur.execute(
                    "SELECT clc_id FROM teacher_clc WHERE teacher_id=%s AND assignment_status='ACTIVE'",
                    (teacher_id,),
                )
                currently_active = {r["clc_id"] for r in cur.fetchall()}
                wanted = set(clc_ids)

                for clc_id in currently_active - wanted:
                    cur.execute(
                        """
                        UPDATE teacher_clc SET assignment_status='INACTIVE'
                        WHERE teacher_id=%s AND clc_id=%s AND assignment_status='ACTIVE'
                        """,
                        (teacher_id, clc_id),
                    )
                for clc_id in wanted - currently_active:
                    cur.execute(
                        """
                        INSERT INTO teacher_clc (teacher_id, clc_id, school_year, assignment_status)
                        VALUES (%s, %s, %s, 'ACTIVE')
                        ON CONFLICT (teacher_id, clc_id, school_year)
                        DO UPDATE SET assignment_status='ACTIVE', assigned_at=CURRENT_DATE
                        """,
                        (teacher_id, clc_id, school_year),
                    )
        db.commit()
    except Exception:
        db.rollback()
        raise

    return {"message": "Teacher account updated.", "data": _load_admin_user(user_id)}


@bp.post("/admin/users/<int:user_id>/reset-password")
@role_required("admin")
def reset_user_password(user_id: int):
    row = fetch_one(
        "SELECT user_id FROM users WHERE user_id=%s AND role='TEACHER'",
        (user_id,),
    )
    if not row:
        return error("Teacher account not found.", 404)

    temp_password = _generate_temp_password()
    execute(
        "UPDATE users SET password_hash=%s WHERE user_id=%s",
        (generate_password_hash(temp_password), user_id),
    )
    return {"success": True, "message": "Password reset.", "temp_password": temp_password}


@bp.post("/admin/users")
@role_required("admin")
def create_user():
    data = request.get_json(silent=True) or {}
    first_name = str(data.get("firstName") or "").strip()
    last_name = str(data.get("lastName") or "").strip()
    email = str(data.get("email") or "").strip().lower()
    if not first_name or not last_name or not email:
        return error("First name, last name, and email are required.", 422)

    if fetch_one("SELECT user_id FROM users WHERE LOWER(email) = LOWER(%s)", (email,)):
        return error("Email already exists.", 409)

    account_role = str(data.get("role") or "teacher").strip().lower()
    if account_role not in {"teacher", "admin"}:
        return error("Role must be either 'teacher' or 'admin'.", 422)

    middle_name = str(data.get("middleName") or "").strip() or None
    contact_number = str(data.get("phone") or "").strip() or None

    username_base = email.split("@", 1)[0][:80] or account_role
    username = username_base
    suffix = 1
    while fetch_one("SELECT user_id FROM users WHERE username = %s", (username,)):
        suffix += 1
        username = f"{username_base}{suffix}"

    temp_password = _generate_temp_password()

    db = get_db()
    try:
        with db.cursor() as cur:
            if account_role == "admin":
                # Admin accounts have no `teacher` row -- name/phone live
                # directly on `users` (see sql/04_user_profile_fields.sql).
                cur.execute(
                    """
                    INSERT INTO users (
                        username, password_hash, email, role, account_status,
                        first_name, last_name, contact_number
                    )
                    VALUES (%s, %s, %s, 'ADMIN', 'ACTIVE', %s, %s, %s)
                    RETURNING user_id
                    """,
                    (username, generate_password_hash(temp_password), email, first_name, last_name, contact_number),
                )
                user_id = cur.fetchone()["user_id"]
            else:
                municipality = str(data.get("municipality") or "Unassigned").strip()
                employee_id = str(data.get("employeeId") or "").strip()
                clc_name = str(data.get("clc") or "").strip()

                cur.execute(
                    """
                    INSERT INTO users (username, password_hash, email, role, account_status)
                    VALUES (%s, %s, %s, 'TEACHER', 'ACTIVE')
                    RETURNING user_id
                    """,
                    (username, generate_password_hash(temp_password), email),
                )
                user_id = cur.fetchone()["user_id"]

                final_employee_id = employee_id or f"ALS-TEACHER-{user_id}"
                cur.execute(
                    """
                    INSERT INTO teacher (
                        user_id, employee_id, first_name, middle_name, last_name,
                        contact_number, municipality, status
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, 'ACTIVE')
                    RETURNING teacher_id
                    """,
                    (user_id, final_employee_id, first_name, middle_name, last_name, contact_number, municipality),
                )
                teacher_id = cur.fetchone()["teacher_id"]

                if clc_name:
                    cur.execute(
                        "SELECT clc_id FROM clc WHERE LOWER(clc_name) = LOWER(%s) LIMIT 1",
                        (clc_name,),
                    )
                    clc_row = cur.fetchone()
                    if clc_row:
                        cur.execute(
                            """
                            INSERT INTO teacher_clc (teacher_id, clc_id, school_year, assignment_status)
                            VALUES (%s, %s, %s, 'ACTIVE')
                            ON CONFLICT (teacher_id, clc_id, school_year) DO NOTHING
                            """,
                            (teacher_id, clc_row["clc_id"], str(data.get("schoolYear") or "").strip() or get_active_school_year()),
                        )
        db.commit()
    except Exception:
        db.rollback()
        raise

    if account_role == "admin":
        return {
            "message": "Admin account created.",
            "data": {
                "id": user_id,
                "name": f"{first_name} {last_name}".strip(),
                "email": email,
                "role": "admin",
            },
            "temp_password": temp_password,
        }, 201

    return {
        "message": "Teacher account created.",
        "data": _load_admin_user(user_id),
        "temp_password": temp_password,
    }, 201


@bp.put("/admin/profile")
@role_required("admin")
def update_own_admin_profile():
    """Self-service profile edit for the logged-in admin. Separate from
    PUT /users/profile, which only works for teacher accounts (it requires a
    `teacher` row) - admin/coordinator accounts have no such row, so their
    name/phone live directly on `users` instead."""
    user_id = current_user_id()
    existing = fetch_one(
        "SELECT user_id, email, first_name, last_name, contact_number FROM users WHERE user_id=%s",
        (user_id,),
    )
    if not existing:
        return error("Account not found.", 404)

    data = request.get_json(silent=True) or {}
    full_name = str(data.get("fullName") or "").strip()
    if full_name:
        first_name, last_name = split_name(full_name)
    else:
        first_name = existing.get("first_name") or ""
        last_name = existing.get("last_name") or ""

    contact_number = _merge_field(data, "phone", existing.get("contact_number"))
    email = _merge_field(data, "email", existing.get("email"))
    if not first_name or not last_name or not email:
        return error("Full name and email are required.", 422)
    email = email.lower()

    execute(
        "UPDATE users SET first_name=%s, last_name=%s, contact_number=%s, email=%s WHERE user_id=%s",
        (first_name, last_name, contact_number, email, user_id),
    )
    return {
        "message": "Profile updated.",
        "data": {
            "id": user_id,
            "fullName": f"{first_name} {last_name}".strip(),
            "email": email,
            "phone": contact_number or "",
        },
    }


@bp.post("/admin/self/deactivate")
@role_required("admin")
def deactivate_self():
    user_id = current_user_id()
    active_admins = fetch_one(
        "SELECT COUNT(*) AS n FROM users WHERE role='ADMIN' AND account_status='ACTIVE'"
    )["n"]
    if active_admins <= 1:
        return error(
            "You are the only active administrator. Create another admin account before deactivating this one.",
            409,
        )

    execute("UPDATE users SET account_status='SUSPENDED' WHERE user_id=%s", (user_id,))
    return {"success": True, "message": "Your account has been deactivated."}


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


def _slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


_ADMIN_DASHBOARD_LEVEL_MAP = {
    "BLP": "BLP",
    "ELEMENTARY": "Elementary",
    "JUNIOR_HIGH_SCHOOL": "JHS",
    "SENIOR_HIGH_SCHOOL": "SHS",
}


@bp.get("/admin/dashboard")
@role_required("admin")
def admin_dashboard():
    """Municipality-aggregated risk overview for the admin map dashboard.
    Kept independent of the per-teacher dashboard (dashboard_routes.py) since
    this spans every teacher's learners division-wide, not just one."""
    clc_counts = fetch_all(
        "SELECT municipality, COUNT(*) AS clc_count FROM clc WHERE status='ACTIVE' GROUP BY municipality"
    )
    learner_rows = fetch_all(
        """
        WITH latest AS (
            SELECT DISTINCT ON (ce.enrollment_id)
                ce.enrollment_id, lc.clc_id, lc.learning_level, ra.risk_level
            FROM class_enrollment ce
            JOIN learning_class lc ON lc.class_id = ce.class_id
            LEFT JOIN risk_assessment ra
                ON ra.enrollment_id = ce.enrollment_id
               AND ra.data_sufficiency_status = 'PREDICTION_GENERATED'
            WHERE ce.enrollment_status = 'ENROLLED'
            ORDER BY ce.enrollment_id, ra.assessment_date DESC NULLS LAST
        )
        SELECT c.municipality, latest.learning_level, latest.risk_level
        FROM latest
        JOIN clc c ON c.clc_id = latest.clc_id
        """
    )

    def _empty_bucket(name):
        return {
            "name": name,
            "total": 0,
            "high": 0,
            "moderate": 0,
            "low": 0,
            "levels": {"BLP": 0, "Elementary": 0, "JHS": 0, "SHS": 0},
            "clcs": 0,
        }

    result = {}
    for row in clc_counts:
        slug = _slugify(row["municipality"])
        bucket = result.setdefault(slug, _empty_bucket(row["municipality"]))
        bucket["clcs"] = row["clc_count"]

    for row in learner_rows:
        slug = _slugify(row["municipality"])
        bucket = result.setdefault(slug, _empty_bucket(row["municipality"]))
        bucket["total"] += 1
        level_key = _ADMIN_DASHBOARD_LEVEL_MAP.get(row["learning_level"])
        if level_key:
            bucket["levels"][level_key] += 1
        if row["risk_level"] == "HIGH":
            bucket["high"] += 1
        elif row["risk_level"] == "MODERATE":
            bucket["moderate"] += 1
        elif row["risk_level"] == "LOW":
            bucket["low"] += 1

    return result


@bp.get("/settings/school-year")
@role_required("teacher", "admin", "coordinator")
def get_school_year():
    return {"schoolYear": get_active_school_year()}


@bp.put("/admin/settings/school-year")
@role_required("admin")
def update_school_year():
    data = request.get_json(silent=True) or {}
    value = str(data.get("schoolYear") or "").strip()
    if not re.match(r"^\d{4}-\d{4}$", value):
        return error("School year must be in the format YYYY-YYYY.", 422)
    set_active_school_year(value, current_user_id())
    return {"schoolYear": value}


@bp.get("/settings/module-duration")
@role_required("teacher", "admin", "coordinator")
def get_module_duration():
    return {"defaultDurationDays": get_default_module_duration_days()}


@bp.put("/admin/settings/module-duration")
@role_required("admin")
def update_module_duration():
    data = request.get_json(silent=True) or {}
    try:
        value = int(data.get("defaultDurationDays"))
    except (TypeError, ValueError):
        return error("Default duration must be a whole number of days.", 422)
    if value < 1 or value > 180:
        return error("Default duration must be between 1 and 180 days.", 422)
    set_default_module_duration_days(value, current_user_id())
    return {"defaultDurationDays": value}
