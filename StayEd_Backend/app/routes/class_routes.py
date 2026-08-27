from __future__ import annotations

import threading
from datetime import date, timedelta

from flask import Blueprint, current_app, request

from ..authz import current_user_id, role_required, teacher_for_user
from ..db import execute, fetch_all, fetch_one, get_db
from ..helpers import enum_level, enum_semester, error, title_enum
from ..services.prediction_service import trigger_prediction
from ..services.settings_service import get_active_school_year, get_default_module_duration_days

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


# ----------------------------------------------------------------------
# Class module catalog -- "what modules exist for this class" (Module 1,
# 2, 3...), set up once and reused for every release, separate from
# "who has received/returned which module" (still module_record, per
# learner, unchanged).
#
# Existing-data note: module_record rows created before this catalog
# existed (class_module_id IS NULL) are intentionally left as they are, not
# auto-migrated into a fabricated class_module entry. Their module_name was
# typed independently per student with no guarantee of matching spelling
# across learners (e.g. "Module 1" vs "Mod. 1: Comm Skills"), so grouping
# them under one catalog row could silently merge records that don't
# actually belong together -- worse than leaving them alone. They remain
# fully visible via the unchanged Module Release Logbook (per-learner
# history). Only releases made through this new class-level flow use the
# catalog going forward.
# ----------------------------------------------------------------------


def _class_module_row(class_id: int, class_module_id: int):
    return fetch_one(
        "SELECT class_module_id FROM class_module WHERE class_module_id=%s AND class_id=%s",
        (class_module_id, class_id),
    )


def _enrolled_learner_count(class_id: int) -> int:
    row = fetch_one(
        "SELECT COUNT(*) AS n FROM class_enrollment WHERE class_id=%s AND enrollment_status='ENROLLED'",
        (class_id,),
    )
    return int(row["n"]) if row else 0


def _shape_class_module(r: dict, total_learners: int) -> dict:
    released_count = int(r["released_count"] or 0)
    return {
        "id": r["class_module_id"],
        "title": r["module_name"],
        "topic": r.get("topic"),
        "description": r.get("description"),
        "strandCode": r["strand_code"],
        "strandName": r["strand_name"],
        "sequenceNumber": r["sequence_number"],
        "releasedCount": released_count,
        "returnedCount": int(r["returned_count"] or 0),
        "totalLearners": total_learners,
        "lastReleaseDate": r["last_release_date"].strftime("%B %d, %Y") if r.get("last_release_date") else None,
        "isFullyReleased": total_learners > 0 and released_count >= total_learners,
        # Class-level release status is always derived from actual
        # module_record rows, never stored -- a stored status field could
        # drift out of sync with reality; this can't.
        "releaseStatus": "Released" if released_count > 0 else "Not Released",
        "isArchived": bool(r.get("is_archived")),
    }


@bp.get("/classes/<int:class_id>/modules")
@role_required("teacher")
def list_class_modules(class_id: int):
    teacher = teacher_for_user()
    if not teacher or not _owned_class(class_id, teacher["teacher_id"]):
        return error("Class not found.", 404)

    total_learners = _enrolled_learner_count(class_id)
    include_archived = str(request.args.get("includeArchived") or "").lower() in ("1", "true")

    rows = fetch_all(
        f"""
        SELECT cm.class_module_id, cm.module_name, cm.topic, cm.description,
               cm.sequence_number, cm.created_at, cm.is_archived,
               ls.strand_code, ls.strand_name,
               COUNT(DISTINCT mr.enrollment_id) AS released_count,
               COUNT(DISTINCT mr.enrollment_id) FILTER (WHERE mr.date_returned IS NOT NULL) AS returned_count,
               MAX(mr.date_released) AS last_release_date
        FROM class_module cm
        JOIN learning_strand ls ON ls.learning_strand_id = cm.learning_strand_id
        LEFT JOIN module_record mr ON mr.class_module_id = cm.class_module_id
        WHERE cm.class_id = %s {"" if include_archived else "AND cm.is_archived = FALSE"}
        GROUP BY cm.class_module_id, cm.module_name, cm.topic, cm.description, cm.sequence_number,
                 cm.created_at, cm.is_archived, ls.strand_code, ls.strand_name
        ORDER BY cm.sequence_number NULLS LAST, cm.created_at
        """,
        (class_id,),
    )

    data = [_shape_class_module(r, total_learners) for r in rows]

    released_modules = sum(1 for m in data if m["releasedCount"] > 0)
    active_transactions = sum(m["releasedCount"] - m["returnedCount"] for m in data)
    returned_transactions = sum(m["returnedCount"] for m in data)

    return {
        "total": len(data),
        "totalLearners": total_learners,
        "summary": {
            "totalModules": len(data),
            "releasedModules": released_modules,
            "notYetReleased": len(data) - released_modules,
            "activeTransactions": active_transactions,
            "returnedTransactions": returned_transactions,
        },
        "data": data,
    }


@bp.post("/classes/<int:class_id>/modules")
@role_required("teacher")
def create_class_module(class_id: int):
    teacher = teacher_for_user()
    if not teacher or not _owned_class(class_id, teacher["teacher_id"]):
        return error("Class not found.", 404)

    data = request.get_json(silent=True) or {}
    strand_code = str(data.get("strandCode") or "").strip().upper()
    title = str(data.get("title") or "").strip()
    topic = str(data.get("topic") or "").strip() or None
    description = str(data.get("description") or "").strip() or None

    if not strand_code or not title:
        return error("A learning strand and module title are required.", 422)

    strand = fetch_one("SELECT learning_strand_id FROM learning_strand WHERE strand_code = %s", (strand_code,))
    if not strand:
        return error(f"Unknown learning strand: {strand_code}.", 422)

    next_seq = fetch_one(
        "SELECT COALESCE(MAX(sequence_number), 0) + 1 AS n FROM class_module WHERE class_id=%s",
        (class_id,),
    )["n"]

    row = execute(
        """
        INSERT INTO class_module (
            class_id, learning_strand_id, module_name, topic, description,
            sequence_number, created_by_teacher_id
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        RETURNING class_module_id, created_at
        """,
        (class_id, strand["learning_strand_id"], title, topic, description, next_seq, teacher["teacher_id"]),
        returning=True,
    )

    return {
        "id": row["class_module_id"],
        "title": title,
        "topic": topic,
        "description": description,
        "strandCode": strand_code,
        "sequenceNumber": next_seq,
        "releasedCount": 0,
        "returnedCount": 0,
        "totalLearners": _enrolled_learner_count(class_id),
        "lastReleaseDate": None,
        "isFullyReleased": False,
        "releaseStatus": "Not Released",
        "isArchived": False,
    }, 201


@bp.put("/classes/<int:class_id>/modules/<int:class_module_id>")
@role_required("teacher")
def update_class_module(class_id: int, class_module_id: int):
    teacher = teacher_for_user()
    if not teacher or not _owned_class(class_id, teacher["teacher_id"]):
        return error("Class not found.", 404)
    if not _class_module_row(class_id, class_module_id):
        return error("Module not found.", 404)

    data = request.get_json(silent=True) or {}
    updates = {}

    if "title" in data:
        title = str(data.get("title") or "").strip()
        if not title:
            return error("Module title cannot be blank.", 422)
        updates["module_name"] = title

    if "strandCode" in data:
        strand_code = str(data.get("strandCode") or "").strip().upper()
        strand = fetch_one("SELECT learning_strand_id FROM learning_strand WHERE strand_code = %s", (strand_code,))
        if not strand:
            return error(f"Unknown learning strand: {strand_code}.", 422)
        updates["learning_strand_id"] = strand["learning_strand_id"]

    if "topic" in data:
        updates["topic"] = str(data.get("topic") or "").strip() or None

    if "description" in data:
        updates["description"] = str(data.get("description") or "").strip() or None

    if "sequenceNumber" in data:
        try:
            updates["sequence_number"] = int(data.get("sequenceNumber"))
        except (TypeError, ValueError):
            return error("Module number must be a number.", 422)

    if updates:
        columns = list(updates)
        values = [updates[c] for c in columns]
        set_clause = ", ".join(f"{c}=%s" for c in columns)
        execute(
            f"UPDATE class_module SET {set_clause} WHERE class_module_id=%s",
            (*values, class_module_id),
        )

    return {"message": "Module updated."}


@bp.post("/classes/<int:class_id>/modules/<int:class_module_id>/archive")
@role_required("teacher")
def archive_class_module(class_id: int, class_module_id: int):
    teacher = teacher_for_user()
    if not teacher or not _owned_class(class_id, teacher["teacher_id"]):
        return error("Class not found.", 404)
    if not _class_module_row(class_id, class_module_id):
        return error("Module not found.", 404)

    # Archiving only hides the module from the active catalog -- it never
    # touches module_record, so historical learner transactions (and every
    # page that reads them: Module Release Logbook, Learner Profile,
    # dashboard, risk prediction) are completely unaffected either way.
    execute("UPDATE class_module SET is_archived = TRUE WHERE class_module_id=%s", (class_module_id,))
    return {"message": "Module archived."}


@bp.post("/classes/<int:class_id>/modules/<int:class_module_id>/unarchive")
@role_required("teacher")
def unarchive_class_module(class_id: int, class_module_id: int):
    teacher = teacher_for_user()
    if not teacher or not _owned_class(class_id, teacher["teacher_id"]):
        return error("Class not found.", 404)
    if not _class_module_row(class_id, class_module_id):
        return error("Module not found.", 404)

    execute("UPDATE class_module SET is_archived = FALSE WHERE class_module_id=%s", (class_module_id,))
    return {"message": "Module unarchived."}


@bp.post("/classes/<int:class_id>/modules/<int:class_module_id>/release")
@role_required("teacher")
def release_class_module(class_id: int, class_module_id: int):
    teacher = teacher_for_user()
    if not teacher or not _owned_class(class_id, teacher["teacher_id"]):
        return error("Class not found.", 404)

    catalog_row = fetch_one(
        "SELECT class_module_id, learning_strand_id, module_name FROM class_module WHERE class_module_id=%s AND class_id=%s",
        (class_module_id, class_id),
    )
    if not catalog_row:
        return error("Module not found.", 404)

    data = request.get_json(silent=True) or {}
    try:
        release_date = date.fromisoformat(str(data.get("releaseDate"))) if data.get("releaseDate") else date.today()
    except ValueError:
        return error("Release date must use YYYY-MM-DD.", 422)

    if release_date > date.today():
        return error("Release date cannot be later than the current date.", 422)

    if data.get("plannedReturnDate"):
        try:
            planned_return_date = date.fromisoformat(str(data.get("plannedReturnDate")))
        except ValueError:
            return error("Planned return date must use YYYY-MM-DD.", 422)
    else:
        planned_return_date = release_date + timedelta(days=get_default_module_duration_days())

    requested_ids = data.get("learnerIds")

    enrolled = fetch_all(
        "SELECT enrollment_id FROM class_enrollment WHERE class_id=%s AND enrollment_status='ENROLLED'",
        (class_id,),
    )
    enrolled_ids = {r["enrollment_id"] for r in enrolled}

    if requested_ids:
        try:
            target_ids = {int(x) for x in requested_ids}
        except (TypeError, ValueError):
            return error("learnerIds must be a list of enrollment ids.", 422)
        invalid = target_ids - enrolled_ids
        if invalid:
            return error("One or more selected learners are not enrolled in this class.", 422)
    else:
        target_ids = set(enrolled_ids)

    already_released = fetch_all(
        "SELECT DISTINCT enrollment_id FROM module_record WHERE class_module_id=%s",
        (class_module_id,),
    )
    already_released_ids = {r["enrollment_id"] for r in already_released}

    to_release = sorted(target_ids - already_released_ids)
    skipped = sorted(target_ids & already_released_ids)

    if not to_release:
        return error(
            "All selected learners already have this module released. Nothing to do.", 422
        )

    db = get_db()
    try:
        with db.cursor() as cur:
            for enrollment_id in to_release:
                cur.execute(
                    """
                    INSERT INTO module_release_batch (enrollment_id, release_date, recorded_by_teacher_id)
                    VALUES (%s, %s, %s) RETURNING release_batch_id
                    """,
                    (enrollment_id, release_date, teacher["teacher_id"]),
                )
                batch_id = cur.fetchone()["release_batch_id"]
                cur.execute(
                    """
                    INSERT INTO module_record (
                        enrollment_id, learning_strand_id, module_name, date_released,
                        recorded_by_teacher_id, release_batch_id, planned_return_date, class_module_id
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        enrollment_id, catalog_row["learning_strand_id"], catalog_row["module_name"],
                        release_date, teacher["teacher_id"], batch_id, planned_return_date, class_module_id,
                    ),
                )
        db.commit()
    except Exception:
        db.rollback()
        raise

    # trigger_prediction() shells out to the model bridge per enrollment and
    # is genuinely slow (this is the same subprocess call every other
    # single-learner write already triggers synchronously). Doing that N
    # times in a row here, in the request/response cycle, is exactly the
    # kind of delay that produces a "release failed" timeout on the frontend
    # even though the release itself already committed successfully -- so
    # for a bulk release specifically, refresh predictions in the background
    # instead of making the teacher wait on all of them before the response
    # returns. Each background call still catches/ignores its own failure,
    # matching trigger_prediction()'s documented "best-effort" contract.
    app_obj = current_app._get_current_object()
    changed_by = current_user_id()

    def _refresh_predictions_in_background(enrollment_ids, user_id):
        with app_obj.app_context():
            for eid in enrollment_ids:
                try:
                    trigger_prediction(eid, user_id)
                except Exception:
                    pass

    threading.Thread(
        target=_refresh_predictions_in_background,
        args=(to_release, changed_by),
        daemon=True,
    ).start()

    return {
        "message": f"Module released to {len(to_release)} learner(s).",
        "releasedCount": len(to_release),
        "skippedCount": len(skipped),
    }, 201


@bp.get("/classes/<int:class_id>/modules/<int:class_module_id>/roster")
@role_required("teacher")
def class_module_roster(class_id: int, class_module_id: int):
    teacher = teacher_for_user()
    if not teacher or not _owned_class(class_id, teacher["teacher_id"]):
        return error("Class not found.", 404)
    if not _class_module_row(class_id, class_module_id):
        return error("Module not found.", 404)

    rows = fetch_all(
        """
        SELECT ce.enrollment_id, l.learner_id, l.first_name, l.last_name,
               mr.module_record_id, mr.release_batch_id, mr.date_released, mr.date_returned
        FROM class_enrollment ce
        JOIN learner l ON l.learner_id = ce.learner_id
        LEFT JOIN module_record mr
            ON mr.enrollment_id = ce.enrollment_id AND mr.class_module_id = %s
        WHERE ce.class_id = %s AND ce.enrollment_status = 'ENROLLED'
        ORDER BY l.last_name, l.first_name
        """,
        (class_module_id, class_id),
    )

    return {
        "data": [
            {
                # enrollmentId is what release/return actions target (a
                # learner can have more than one enrollment across classes
                # or re-enrollment periods); learnerId is only for display
                # / linking to the Learner Profile.
                "enrollmentId": r["enrollment_id"],
                "learnerId": r["learner_id"],
                "name": f"{r['first_name']} {r['last_name']}".strip(),
                "moduleRecordId": r["module_record_id"],
                "releaseBatchId": r["release_batch_id"],
                "released": r["date_released"] is not None,
                "releaseDate": r["date_released"].strftime("%B %d, %Y") if r["date_released"] else None,
                "returned": r["date_returned"] is not None,
                "returnDate": r["date_returned"].strftime("%B %d, %Y") if r["date_returned"] else None,
            }
            for r in rows
        ]
    }
