from __future__ import annotations

from datetime import date

from flask import Blueprint, request

from ..authz import role_required, teacher_for_user
from ..db import execute, fetch_all, fetch_one, get_db
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
            COUNT(ce.enrollment_id) FILTER (WHERE ce.enrollment_status = 'ENROLLED')::INT AS learner_count,
            COALESCE(MAX(ce.learning_modality::TEXT)
                FILTER (WHERE ce.enrollment_status = 'ENROLLED'), 'BLENDED') AS modality,
            COUNT(ce.enrollment_id) FILTER (
                WHERE ce.enrollment_status = 'ENROLLED'
                  AND ce.learning_modality IN ('FACE_TO_FACE', 'BLENDED')
            )::INT AS f2f_learner_count
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
            "hasF2FLearners": row["f2f_learner_count"] > 0,
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
        "SELECT COUNT(*)::INT AS n FROM class_enrollment WHERE class_id = %s AND enrollment_status = 'ENROLLED'",
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


# ============================================================================
# Ticket 3 -- F2F meet-up attendance
# ============================================================================


def _owned_class(class_id: int, teacher_id: int):
    return fetch_one(
        "SELECT class_id FROM learning_class WHERE class_id = %s AND teacher_id = %s",
        (class_id, teacher_id),
    )


@bp.get("/classes/<int:class_id>/sessions")
@role_required("teacher")
def list_class_sessions(class_id: int):
    teacher = teacher_for_user()
    if not teacher or not _owned_class(class_id, teacher["teacher_id"]):
        return error("Class not found.", 404)

    rows = fetch_all(
        """
        SELECT cs.session_id, cs.session_date, cs.session_status,
               COUNT(sa.attendance_id) FILTER (WHERE sa.attendance_status = 'PRESENT') AS present_count,
               COUNT(sa.attendance_id) AS recorded_count
        FROM class_session cs
        LEFT JOIN session_attendance sa ON sa.session_id = cs.session_id
        WHERE cs.class_id = %s
        GROUP BY cs.session_id
        ORDER BY cs.session_date DESC
        """,
        (class_id,),
    )
    return {
        "total": len(rows),
        "data": [
            {
                "id": r["session_id"],
                "date": r["session_date"].strftime("%m/%d/%Y"),
                "dateIso": r["session_date"].isoformat(),
                "status": title_enum(r["session_status"]),
                "presentCount": int(r["present_count"] or 0),
                "recordedCount": int(r["recorded_count"] or 0),
            }
            for r in rows
        ],
    }


@bp.post("/classes/<int:class_id>/sessions")
@role_required("teacher")
def create_class_session(class_id: int):
    teacher = teacher_for_user()
    if not teacher or not _owned_class(class_id, teacher["teacher_id"]):
        return error("Class not found.", 404)

    data = request.get_json(silent=True) or {}
    try:
        session_date = date.fromisoformat(str(data.get("date")))
    except (TypeError, ValueError):
        return error("Meet-up date must use YYYY-MM-DD.", 422)

    existing = fetch_one(
        "SELECT session_id FROM class_session WHERE class_id=%s AND session_date=%s",
        (class_id, session_date),
    )
    if existing:
        return {"id": existing["session_id"], "date": session_date.strftime("%m/%d/%Y")}

    row = execute(
        """
        INSERT INTO class_session (class_id, session_date, created_by_teacher_id)
        VALUES (%s, %s, %s)
        RETURNING session_id
        """,
        (class_id, session_date, teacher["teacher_id"]),
        returning=True,
    )
    return {"id": row["session_id"], "date": session_date.strftime("%m/%d/%Y")}, 201


def _f2f_learners(class_id: int, session_date):
    # A learner only belongs on a given meet-up's checklist if they were
    # already enrolled by that date -- without this, saving attendance for
    # an old session after a new learner joins the class would write that
    # learner a fabricated ABSENT record for a date before they existed in
    # this modality at all.
    return fetch_all(
        """
        SELECT ce.enrollment_id, l.learner_id, l.first_name, l.last_name, ce.learning_modality
        FROM class_enrollment ce
        JOIN learner l ON l.learner_id = ce.learner_id
        WHERE ce.class_id = %s AND ce.enrollment_status = 'ENROLLED'
          AND ce.learning_modality IN ('FACE_TO_FACE', 'BLENDED')
          AND ce.enrollment_date <= %s
        ORDER BY l.last_name, l.first_name
        """,
        (class_id, session_date),
    )


@bp.get("/classes/<int:class_id>/sessions/<int:session_id>/attendance")
@role_required("teacher")
def get_session_attendance(class_id: int, session_id: int):
    teacher = teacher_for_user()
    if not teacher or not _owned_class(class_id, teacher["teacher_id"]):
        return error("Class not found.", 404)

    session = fetch_one(
        "SELECT session_id, session_date FROM class_session WHERE session_id=%s AND class_id=%s",
        (session_id, class_id),
    )
    if not session:
        return error("Meet-up date not found.", 404)

    learners = _f2f_learners(class_id, session["session_date"])
    existing_rows = fetch_all(
        "SELECT enrollment_id, attendance_status FROM session_attendance WHERE session_id=%s",
        (session_id,),
    )
    existing = {r["enrollment_id"]: r["attendance_status"] for r in existing_rows}

    result = [
        {
            "enrollmentId": l["enrollment_id"],
            "name": f"{l['first_name']} {l['last_name']}".strip(),
            "modality": title_enum(l["learning_modality"]),
            "present": existing.get(l["enrollment_id"]) == "PRESENT",
        }
        for l in learners
    ]

    # A learner who already has a real recorded row for this exact session
    # (e.g. they've since withdrawn or switched to Modular) must stay
    # visible/editable here even though they no longer currently qualify --
    # otherwise their history silently disappears from the checklist.
    listed_ids = {l["enrollment_id"] for l in learners}
    missing_ids = [eid for eid in existing if eid not in listed_ids]
    if missing_ids:
        historical = fetch_all(
            """
            SELECT ce.enrollment_id, l.first_name, l.last_name, ce.learning_modality
            FROM class_enrollment ce JOIN learner l ON l.learner_id = ce.learner_id
            WHERE ce.enrollment_id = ANY(%s)
            """,
            (missing_ids,),
        )
        result.extend(
            {
                "enrollmentId": h["enrollment_id"],
                "name": f"{h['first_name']} {h['last_name']}".strip(),
                "modality": title_enum(h["learning_modality"]),
                "present": existing.get(h["enrollment_id"]) == "PRESENT",
                "noLongerEnrolled": True,
            }
            for h in historical
        )

    return {"date": session["session_date"].strftime("%m/%d/%Y"), "learners": result}


@bp.post("/classes/<int:class_id>/sessions/<int:session_id>/attendance")
@role_required("teacher")
def save_session_attendance(class_id: int, session_id: int):
    teacher = teacher_for_user()
    if not teacher or not _owned_class(class_id, teacher["teacher_id"]):
        return error("Class not found.", 404)

    session = fetch_one(
        "SELECT session_id, session_date FROM class_session WHERE session_id=%s AND class_id=%s",
        (session_id, class_id),
    )
    if not session:
        return error("Meet-up date not found.", 404)

    data = request.get_json(silent=True) or {}
    present_ids = {int(x) for x in (data.get("presentEnrollmentIds") or []) if str(x).isdigit()}

    learners = _f2f_learners(class_id, session["session_date"])
    valid_ids = {l["enrollment_id"] for l in learners}

    db = get_db()
    try:
        with db.cursor() as cur:
            for enrollment_id in valid_ids:
                status = "PRESENT" if enrollment_id in present_ids else "ABSENT"
                cur.execute(
                    """
                    INSERT INTO session_attendance (
                        session_id, enrollment_id, attendance_status, recorded_by_teacher_id
                    ) VALUES (%s, %s, %s, %s)
                    ON CONFLICT (session_id, enrollment_id) DO UPDATE
                        SET attendance_status = EXCLUDED.attendance_status,
                            recorded_by_teacher_id = EXCLUDED.recorded_by_teacher_id,
                            updated_at = CURRENT_TIMESTAMP
                    """,
                    (session_id, enrollment_id, status, teacher["teacher_id"]),
                )
            cur.execute(
                "UPDATE class_session SET session_status='COMPLETED' WHERE session_id=%s",
                (session_id,),
            )
        db.commit()
    except Exception:
        db.rollback()
        raise

    return {"message": "Attendance saved.", "presentCount": len(present_ids & valid_ids), "totalCount": len(valid_ids)}
