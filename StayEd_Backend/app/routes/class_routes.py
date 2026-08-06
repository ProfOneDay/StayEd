from __future__ import annotations

from flask import Blueprint, request

from ..authz import role_required, teacher_for_user
from ..db import fetch_all, fetch_one, get_db
from ..helpers import enum_level, enum_semester, error, title_enum
from ..services.settings_service import get_active_school_year

bp = Blueprint("classes", __name__)

LEVEL_LABELS = {
    "BLP": "Basic Literacy Program",
    "ELEMENTARY": "Elementary A&E",
    "JUNIOR_HIGH_SCHOOL": "Junior High School A&E",
    "SENIOR_HIGH_SCHOOL": "Senior High School A&E",
}
SEM_LABELS = {
    "FIRST": "First Trimester",
    "SECOND": "Second Trimester",
    "SUMMER": "Third Trimester",
    "WHOLE_YEAR": "Whole Year",
}


def _shape(row):
    return {
        "id": row["class_id"],
        "communityLearningCenter": row["clc_name"],
        "schoolYear": row["school_year"],
        "semester": SEM_LABELS.get(row["semester"], row["semester"]),
        "learningLevel": LEVEL_LABELS.get(row["learning_level"], row["learning_level"]),
        "className": row.get("class_name") or "",
        "status": row["status"].title(),
    }


@bp.get("/teacher-classes")
@role_required("teacher")
def teacher_class_cards():
    """Return the compact card shape used by the updated Class Management screen."""
    teacher = teacher_for_user()
    if not teacher:
        return {"total": 0, "data": []}

    rows = fetch_all(
        """
        SELECT
            lc.class_id, lc.school_year, lc.learning_level, c.clc_name,
            COUNT(ce.enrollment_id)::INT AS learner_count,
            COALESCE(MAX(ce.learning_modality::TEXT), 'BLENDED') AS modality
        FROM learning_class lc
        JOIN clc c ON c.clc_id = lc.clc_id
        LEFT JOIN class_enrollment ce ON ce.class_id = lc.class_id
        WHERE lc.teacher_id = %s
        GROUP BY lc.class_id, lc.school_year, lc.learning_level, c.clc_name, lc.created_at
        ORDER BY lc.created_at DESC
        """,
        (teacher["teacher_id"],),
    )

    level_labels = {
        "BLP": "Basic Literacy Program",
        "ELEMENTARY": "Elementary",
        "JUNIOR_HIGH_SCHOOL": "Junior High School",
        "SENIOR_HIGH_SCHOOL": "Senior High School",
    }
    icons = {
        "BLP": "menu_book",
        "ELEMENTARY": "auto_stories",
        "JUNIOR_HIGH_SCHOOL": "school",
        "SENIOR_HIGH_SCHOOL": "school",
    }

    data = [
        {
            "id": row["class_id"],
            "clc": row["clc_name"],
            "level": level_labels.get(row["learning_level"], title_enum(row["learning_level"])),
            "modality": title_enum(row["modality"]),
            "schoolYear": row["school_year"],
            "learnerCount": row["learner_count"],
            "icon": icons.get(row["learning_level"], "school"),
        }
        for row in rows
    ]
    return {"total": len(data), "data": data}


@bp.get("/classes")
@role_required("teacher")
def list_classes():
    teacher = teacher_for_user()
    if not teacher:
        return {"total": 0, "data": []}
    rows = fetch_all(
        """
        SELECT lc.*, c.clc_name
        FROM learning_class lc
        JOIN clc c ON c.clc_id = lc.clc_id
        WHERE lc.teacher_id = %s
        ORDER BY lc.created_at DESC
        """,
        (teacher["teacher_id"],),
    )
    return {"total": len(rows), "data": [_shape(r) for r in rows]}


@bp.get("/classes/current")
@role_required("teacher")
def current_class():
    teacher = teacher_for_user()
    if not teacher:
        return error("Teacher profile not found.", 404)
    row = fetch_one(
        """
        SELECT lc.*, c.clc_name
        FROM learning_class lc
        JOIN clc c ON c.clc_id = lc.clc_id
        WHERE lc.teacher_id = %s AND lc.status = 'ACTIVE'
        ORDER BY lc.created_at DESC
        LIMIT 1
        """,
        (teacher["teacher_id"],),
    )
    if not row:
        return error("No active class found.", 404)
    return _shape(row)


@bp.post("/classes")
@role_required("teacher")
def create_class():
    data = request.get_json(silent=True) or {}
    teacher = teacher_for_user()
    if not teacher:
        return error("Teacher profile not found.", 404)

    clc_name = str(data.get("communityLearningCenter") or data.get("clc") or "").strip()
    municipality = str(data.get("municipality") or "").strip()
    school_year = get_active_school_year()
    learning_level = enum_level(data.get("learningLevel"))
    semester = enum_semester(data.get("semester"))
    if not clc_name:
        return error("Community Learning Center is required.", 422)

    if municipality:
        clc = fetch_one(
            """
            SELECT clc_id FROM clc
            WHERE LOWER(clc_name) = LOWER(%s)
              AND LOWER(municipality) = LOWER(%s)
            LIMIT 1
            """,
            (clc_name, municipality),
        )
    else:
        clc = fetch_one(
            "SELECT clc_id FROM clc WHERE LOWER(clc_name) = LOWER(%s) LIMIT 1",
            (clc_name,),
        )
    if not clc:
        return error(
            "Selected Community Learning Center is not registered in this municipality.",
            422,
        )

    db = get_db()
    try:
        with db.cursor() as cur:
            cur.execute(
                """
                INSERT INTO learning_class (
                    teacher_id, clc_id, school_year, semester,
                    learning_level, class_name, status
                ) VALUES (%s, %s, %s, %s, %s, %s, 'ACTIVE')
                ON CONFLICT DO NOTHING
                RETURNING class_id
                """,
                (
                    teacher["teacher_id"], clc["clc_id"], school_year,
                    semester, learning_level, data.get("className"),
                ),
            )
            created = cur.fetchone()
            if created:
                class_id = created["class_id"]
            else:
                cur.execute(
                    """
                    SELECT class_id FROM learning_class
                    WHERE teacher_id = %s AND clc_id = %s AND school_year = %s
                      AND semester = %s AND learning_level = %s
                      AND LOWER(COALESCE(class_name, '')) = LOWER(COALESCE(%s, ''))
                    LIMIT 1
                    """,
                    (
                        teacher["teacher_id"], clc["clc_id"], school_year,
                        semester, learning_level, data.get("className"),
                    ),
                )
                class_id = cur.fetchone()["class_id"]

            cur.execute(
                """
                INSERT INTO teacher_clc (teacher_id, clc_id, school_year, assignment_status)
                VALUES (%s, %s, %s, 'ACTIVE')
                ON CONFLICT (teacher_id, clc_id, school_year)
                DO UPDATE SET assignment_status = 'ACTIVE'
                """,
                (teacher["teacher_id"], clc["clc_id"], school_year),
            )
        db.commit()
    except Exception:
        db.rollback()
        raise

    row = fetch_one(
        "SELECT lc.*, c.clc_name FROM learning_class lc JOIN clc c ON c.clc_id=lc.clc_id WHERE lc.class_id=%s",
        (class_id,),
    )
    return {"message": "Class created successfully.", "data": _shape(row)}, 201


@bp.delete("/classes/<int:class_id>")
@role_required("teacher")
def delete_class(class_id: int):
    teacher = teacher_for_user()
    if not teacher:
        return error("Teacher profile not found.", 404)

    owned = fetch_one(
        "SELECT class_id FROM learning_class WHERE class_id = %s AND teacher_id = %s",
        (class_id, teacher["teacher_id"]),
    )
    if not owned:
        return error("Class not found.", 404)

    enrolled = fetch_one(
        "SELECT COUNT(*)::INT AS n FROM class_enrollment WHERE class_id = %s",
        (class_id,),
    )
    if enrolled and enrolled["n"] > 0:
        return error(
            "This class still has enrolled learners. Move or remove them before deleting the class.",
            409,
        )

    db = get_db()
    try:
        with db.cursor() as cur:
            cur.execute("DELETE FROM learning_class WHERE class_id = %s", (class_id,))
        db.commit()
    except Exception:
        db.rollback()
        raise

    return {"message": "Class deleted."}
