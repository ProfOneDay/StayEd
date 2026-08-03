from __future__ import annotations

from flask import Blueprint, request

from ..authz import role_required, teacher_for_user
from ..db import execute, fetch_all, fetch_one, get_db
from ..helpers import enum_level, error, title_enum

bp = Blueprint("clcs", __name__)


def _location_string(address, barangay, municipality):
    """Join address/barangay/municipality without repeating parts that are
    already present in the address (the seeded reference CLCs store a full
    "Barangay, Municipality, Province" string as their address, so naively
    appending barangay and municipality again produced duplicated text like
    "Alacan, Binalonan, Pangasinan, Alacan, Binalonan")."""
    address = (address or "").strip()
    parts = [address] if address else []
    for part in (barangay, municipality):
        part = (part or "").strip()
        if part and (not address or part.lower() not in address.lower()):
            parts.append(part)
    return ", ".join(parts)


def _clc_card(row):
    return {
        "id": row["clc_id"],
        "name": row["clc_name"],
        "municipality": row["municipality"],
        "location": _location_string(row.get("address"), row.get("barangay"), row.get("municipality")),
        "status": "Active" if row["status"] == "ACTIVE" else "Inactive",
        "icon": "account_balance",
        "totalLearners": int(row.get("total_learners") or 0),
        "teachers": int(row.get("teachers") or 0),
        "schoolYear": row.get("school_year") or "—",
    }


_PROFILE_QUERY = """
    SELECT
        c.*,
        COUNT(DISTINCT tc.teacher_id) FILTER (WHERE tc.assignment_status = 'ACTIVE') AS teachers,
        COUNT(DISTINCT ce.learner_id) FILTER (WHERE ce.enrollment_status = 'ENROLLED') AS total_learners,
        COUNT(DISTINCT lc.class_id) FILTER (WHERE lc.status = 'ACTIVE') AS active_classes,
        MAX(tc.school_year) AS school_year
    FROM clc c
    LEFT JOIN teacher_clc tc ON tc.clc_id = c.clc_id
    LEFT JOIN learning_class lc ON lc.clc_id = c.clc_id
    LEFT JOIN class_enrollment ce ON ce.class_id = lc.class_id
    WHERE c.clc_id = %s
    GROUP BY c.clc_id
"""

_PROFILE_TEACHERS_QUERY = """
    SELECT t.teacher_id, t.employee_id, t.first_name, t.last_name, t.status
    FROM teacher_clc tc
    JOIN teacher t ON t.teacher_id = tc.teacher_id
    WHERE tc.clc_id = %s AND tc.assignment_status = 'ACTIVE'
    ORDER BY t.last_name, t.first_name
"""


def _clc_profile(row, teachers):
    return {
        "id": row["clc_id"],
        "name": row["clc_name"],
        "municipality": row["municipality"],
        "barangay": row.get("barangay") or "",
        "address": row.get("address") or "",
        "province": row.get("province") or "",
        "zip": row.get("zip_code") or "",
        "phone": row.get("contact_number") or "",
        "email": row.get("email") or "",
        "coordinatorName": row.get("coordinator_name") or "",
        "coordinatorEmail": row.get("coordinator_email") or "",
        "learningLevel": title_enum(row.get("learning_level")),
        "schoolYear": row.get("school_year") or "",
        "status": "Active" if row["status"] == "ACTIVE" else "Inactive",
        "stats": {
            "totalLearners": int(row.get("total_learners") or 0),
            "teachers": int(row.get("teachers") or 0),
            "activeClasses": int(row.get("active_classes") or 0),
        },
        "teachers": [
            {
                "id": t["teacher_id"],
                "employeeId": t["employee_id"],
                "name": " ".join(p for p in [t.get("first_name"), t.get("last_name")] if p),
                "status": t["status"],
            }
            for t in teachers
        ],
        "createdAt": row["created_at"].isoformat() if row.get("created_at") else None,
    }


def _load_profile(clc_id: int):
    row = fetch_one(_PROFILE_QUERY, (clc_id,))
    if not row:
        return None
    teachers = fetch_all(_PROFILE_TEACHERS_QUERY, (clc_id,))
    return _clc_profile(row, teachers)


@bp.get("/clcs")
@role_required("teacher", "admin", "coordinator")
def list_clcs():
    rows = fetch_all(
        """
        SELECT
            c.clc_id, c.clc_name, c.municipality, c.barangay, c.address, c.status,
            COUNT(DISTINCT tc.teacher_id) FILTER (WHERE tc.assignment_status = 'ACTIVE') AS teachers,
            COUNT(DISTINCT ce.learner_id) FILTER (WHERE ce.enrollment_status = 'ENROLLED') AS total_learners,
            MAX(tc.school_year) AS school_year
        FROM clc c
        LEFT JOIN teacher_clc tc ON tc.clc_id = c.clc_id
        LEFT JOIN learning_class lc ON lc.clc_id = c.clc_id
        LEFT JOIN class_enrollment ce ON ce.class_id = lc.class_id
        GROUP BY c.clc_id
        ORDER BY c.clc_name
        """
    )
    return {"total": len(rows), "data": [_clc_card(r) for r in rows]}


@bp.get("/clcs/current")
@role_required("teacher")
def current_clc():
    teacher = teacher_for_user()
    if not teacher:
        return error("Teacher profile not found.", 404)
    row = fetch_one(
        """
        SELECT c.*, tc.school_year,
               lc.learning_level
        FROM teacher_clc tc
        JOIN clc c ON c.clc_id = tc.clc_id
        LEFT JOIN LATERAL (
            SELECT learning_level
            FROM learning_class
            WHERE teacher_id = tc.teacher_id AND clc_id = tc.clc_id
            ORDER BY created_at DESC
            LIMIT 1
        ) lc ON TRUE
        WHERE tc.teacher_id = %s AND tc.assignment_status = 'ACTIVE'
        ORDER BY tc.assigned_at DESC
        LIMIT 1
        """,
        (teacher["teacher_id"],),
    )
    if not row:
        return error("No active CLC assignment found.", 404)
    level_map = {
        "BLP": "Basic Literacy Program",
        "ELEMENTARY": "Elementary A&E",
        "JUNIOR_HIGH_SCHOOL": "Junior High School A&E",
        "SENIOR_HIGH_SCHOOL": "Senior High School A&E",
    }
    return {
        "id": row["clc_id"],
        "name": row["clc_name"],
        "municipality": row["municipality"],
        "address": row.get("address") or "",
        "schoolYear": row.get("school_year") or "",
        "learningLevel": level_map.get(row.get("learning_level"), "Basic Literacy Program"),
    }


@bp.get("/clcs/<int:clc_id>")
@role_required("teacher", "admin", "coordinator")
def get_clc(clc_id: int):
    profile = _load_profile(clc_id)
    if not profile:
        return error("Community Learning Center not found.", 404)
    return {"data": profile}


@bp.post("/clcs")
@role_required("teacher")
def create_clc():
    data = request.get_json(silent=True) or {}
    name = str(data.get("name") or data.get("clc_name") or "").strip()
    municipality = str(data.get("municipality") or "").strip()
    if not name or not municipality:
        return error("CLC name and municipality are required.", 422)

    teacher = teacher_for_user()
    if not teacher:
        return error("Teacher profile not found.", 404)

    school_year = str(data.get("schoolYear") or "2026-2027").strip()
    address = str(data.get("address") or "").strip() or None
    barangay = str(data.get("barangay") or "").strip() or None
    province = str(data.get("province") or "").strip() or None
    zip_code = str(data.get("zip") or data.get("zipCode") or "").strip() or None
    phone = str(data.get("phone") or data.get("contact_number") or "").strip() or None
    email = str(data.get("email") or "").strip() or None
    coordinator_name = str(data.get("coordinatorName") or "").strip() or None
    coordinator_email = str(data.get("coordinatorEmail") or "").strip() or None
    learning_level = enum_level(data.get("learningLevel")) if data.get("learningLevel") else None

    db = get_db()
    try:
        with db.cursor() as cur:
            cur.execute(
                """
                INSERT INTO clc (
                    clc_name, municipality, barangay, address, province, zip_code,
                    contact_number, email, coordinator_name, coordinator_email,
                    learning_level, status
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'ACTIVE')
                ON CONFLICT DO NOTHING
                RETURNING clc_id
                """,
                (
                    name, municipality, barangay, address, province, zip_code,
                    phone, email, coordinator_name, coordinator_email, learning_level,
                ),
            )
            created = cur.fetchone()
            if created:
                clc_id = created["clc_id"]
            else:
                cur.execute(
                    """
                    SELECT clc_id FROM clc
                    WHERE LOWER(clc_name) = LOWER(%s)
                      AND LOWER(municipality) = LOWER(%s)
                      AND LOWER(COALESCE(barangay, '')) = LOWER(COALESCE(%s, ''))
                    LIMIT 1
                    """,
                    (name, municipality, barangay),
                )
                clc_id = cur.fetchone()["clc_id"]

            cur.execute(
                """
                UPDATE teacher_clc SET assignment_status = 'INACTIVE'
                WHERE teacher_id = %s AND assignment_status = 'ACTIVE'
                """,
                (teacher["teacher_id"],),
            )
            cur.execute(
                """
                INSERT INTO teacher_clc (teacher_id, clc_id, school_year, assignment_status)
                VALUES (%s, %s, %s, 'ACTIVE')
                ON CONFLICT (teacher_id, clc_id, school_year)
                DO UPDATE SET assignment_status = 'ACTIVE', assigned_at = CURRENT_DATE
                """,
                (teacher["teacher_id"], clc_id, school_year),
            )
        db.commit()
    except Exception:
        db.rollback()
        raise

    return {"message": "CLC registered successfully.", "data": _load_profile(clc_id)}, 201


def _merge_field(data: dict, key: str, current, *aliases: str):
    """Use a submitted value if the key is present, otherwise keep the current
    value. Lets PUT /clcs/<id> accept partial payloads without blanking out
    fields the caller didn't touch."""
    for k in (key, *aliases):
        if k in data and data[k] is not None:
            return str(data[k]).strip() or None
    return current


@bp.put("/clcs/<int:clc_id>")
@role_required("teacher")
def update_clc(clc_id: int):
    existing = fetch_one("SELECT * FROM clc WHERE clc_id = %s", (clc_id,))
    if not existing:
        return error("Community Learning Center not found.", 404)

    data = request.get_json(silent=True) or {}
    name = _merge_field(data, "name", existing["clc_name"], "clc_name")
    municipality = _merge_field(data, "municipality", existing["municipality"])
    if not name or not municipality:
        return error("CLC name and municipality are required.", 422)

    barangay = _merge_field(data, "barangay", existing.get("barangay"))
    address = _merge_field(data, "address", existing.get("address"))
    province = _merge_field(data, "province", existing.get("province"))
    zip_code = _merge_field(data, "zip", existing.get("zip_code"), "zipCode")
    phone = _merge_field(data, "phone", existing.get("contact_number"), "contact_number")
    email = _merge_field(data, "email", existing.get("email"))
    coordinator_name = _merge_field(data, "coordinatorName", existing.get("coordinator_name"))
    coordinator_email = _merge_field(data, "coordinatorEmail", existing.get("coordinator_email"))
    learning_level = (
        enum_level(data["learningLevel"]) if data.get("learningLevel") else existing.get("learning_level")
    )

    execute(
        """
        UPDATE clc SET
            clc_name = %s, municipality = %s, barangay = %s, address = %s,
            province = %s, zip_code = %s, contact_number = %s, email = %s,
            coordinator_name = %s, coordinator_email = %s, learning_level = %s
        WHERE clc_id = %s
        """,
        (
            name, municipality, barangay, address, province, zip_code,
            phone, email, coordinator_name, coordinator_email, learning_level,
            clc_id,
        ),
    )
    return {"message": "CLC profile updated.", "data": _load_profile(clc_id)}