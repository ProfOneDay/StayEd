from __future__ import annotations

from flask import Blueprint, request

from ..authz import current_user_id, role_required, teacher_for_user
from ..db import fetch_all, fetch_one, get_db
from ..helpers import error

bp = Blueprint("clcs", __name__)


def _clc_card(row):
    return {
        "id": row["clc_id"],
        "name": row["clc_name"],
        "municipality": row["municipality"],
        "location": ", ".join(x for x in [row.get("address"), row.get("barangay"), row.get("municipality")] if x),
        "status": "Active" if row["status"] == "ACTIVE" else "Inactive",
        "icon": "account_balance",
        "totalLearners": int(row.get("total_learners") or 0),
        "teachers": int(row.get("teachers") or 0),
        "schoolYear": row.get("school_year") or "—",
    }


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

    db = get_db()
    try:
        with db.cursor() as cur:
            cur.execute(
                """
                INSERT INTO clc (clc_name, municipality, barangay, address, status)
                VALUES (%s, %s, %s, %s, 'ACTIVE')
                ON CONFLICT DO NOTHING
                RETURNING clc_id
                """,
                (name, municipality, barangay, address),
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

    return {
        "message": "CLC registered successfully.",
        "data": {
            "id": clc_id,
            "name": name,
            "municipality": municipality,
            "schoolYear": school_year,
            "learningLevel": data.get("learningLevel") or "Basic Literacy Program",
            "status": "Active",
            "location": data.get("location") or ", ".join(x for x in [address, municipality] if x),
        },
    }, 201
