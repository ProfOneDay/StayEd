from __future__ import annotations

from flask import Blueprint, request

from ..authz import role_required, teacher_for_user
from ..db import fetch_all
from ..helpers import enum_modality, title_enum
from ..services.learner_service import _learner_query, _shape_learner
from .intervention_routes import INTERVENTION_STATUS_LABELS, INTERVENTION_STATUSES

bp = Blueprint("reports", __name__)


@bp.get("/reports/at-risk")
@role_required("teacher")
def at_risk_report():
    """Learners currently flagged High or Moderate risk, for the teacher's own classes."""
    teacher = teacher_for_user()
    if not teacher:
        return {"total": 0, "data": []}

    class_id = str(request.args.get("class_id") or "").strip()
    search = str(request.args.get("search") or "").strip()

    clauses = ["lc.teacher_id = %s"]
    params: list = [teacher["teacher_id"]]
    if class_id.isdigit():
        clauses.append("lc.class_id = %s")
        params.append(int(class_id))
    if search:
        clauses.append("(LOWER(l.first_name || ' ' || l.last_name) LIKE LOWER(%s) OR l.lrn LIKE %s OR LOWER(c.clc_name) LIKE LOWER(%s) OR LOWER(lc.class_name) LIKE LOWER(%s))")
        params.extend([f"%{search}%", f"%{search}%", f"%{search}%", f"%{search}%"])

    rows = fetch_all(
        _learner_query(
            "WHERE " + " AND ".join(clauses),
            "risk.risk_probability DESC NULLS LAST, l.last_name, l.first_name",
        ),
        tuple(params),
    )
    # A learner can appear in historical classes; keep the newest enrollment only.
    unique = {}
    for row in rows:
        unique.setdefault(row["learner_id"], row)
    # Filter on the *shaped* risk, not the raw SQL risk_level -- _shape_learner
    # downgrades a risk_assessment row to "Not Yet Assessed" when no module
    # batch exists yet (seeded/imported data can have a stale HIGH/MODERATE
    # row despite monitoring never having started), and this report must
    # never call a learner "at risk" that the rest of the app calls unassessed.
    data = [r for r in (_shape_learner(row) for row in unique.values()) if r["risk"] in {"High", "Moderate"}]
    return {"total": len(data), "data": data}


@bp.get("/reports/interventions")
@role_required("teacher")
def intervention_tracking_report():
    """Full intervention history (method, status, outcome) for the teacher's learners."""
    teacher = teacher_for_user()
    if not teacher:
        return {"total": 0, "data": []}

    class_id = str(request.args.get("class_id") or "").strip()
    status = str(request.args.get("status") or "").strip().upper()
    search = str(request.args.get("search") or "").strip()

    clauses = ["lc.teacher_id = %s"]
    params: list = [teacher["teacher_id"]]
    if class_id.isdigit():
        clauses.append("lc.class_id = %s")
        params.append(int(class_id))
    if status in INTERVENTION_STATUSES:
        clauses.append("i.status = %s")
        params.append(status)
    if search:
        clauses.append("(LOWER(l.first_name || ' ' || l.last_name) LIKE LOWER(%s) OR l.lrn LIKE %s OR LOWER(i.intervention_type) LIKE LOWER(%s) OR LOWER(i.description) LIKE LOWER(%s) OR LOWER(lc.class_name) LIKE LOWER(%s))")
        params.extend([f"%{search}%", f"%{search}%", f"%{search}%", f"%{search}%", f"%{search}%"])

    rows = fetch_all(
        f"""
        SELECT i.intervention_id AS id, i.intervention_type, i.description,
               i.date_assigned, i.target_date, i.date_completed, i.status,
               CONCAT_WS(' ', l.first_name, l.last_name) AS learner_name, l.lrn,
               lc.class_name, ra.risk_level,
               fu.notes AS follow_up_notes, fu.outcome AS follow_up_outcome, fu.follow_up_date
        FROM intervention i
        JOIN risk_assessment ra ON ra.risk_assessment_id = i.risk_assessment_id
        JOIN class_enrollment ce ON ce.enrollment_id = ra.enrollment_id
        JOIN learning_class lc ON lc.class_id = ce.class_id
        JOIN learner l ON l.learner_id = ce.learner_id
        LEFT JOIN LATERAL (
            SELECT notes, outcome, follow_up_date FROM follow_up
            WHERE intervention_id = i.intervention_id
            ORDER BY follow_up_date DESC LIMIT 1
        ) fu ON TRUE
        WHERE {" AND ".join(clauses)}
        ORDER BY i.date_assigned DESC
        """,
        tuple(params),
    )
    data = [{**dict(r), "status": INTERVENTION_STATUS_LABELS.get(r["status"], r["status"])} for r in rows]
    return {"total": len(data), "data": data}


@bp.get("/reports/class-list")
@role_required("teacher", "admin")
def class_list_report():
    """Class roster list report with learner demographics, modality, and status."""
    teacher = teacher_for_user()
    class_id = str(request.args.get("class_id") or "").strip()
    modality = str(request.args.get("modality") or "").strip()
    search = str(request.args.get("search") or "").strip()

    clauses = ["ce.enrollment_status = 'ENROLLED'"]
    params: list = []

    if teacher:
        clauses.append("lc.teacher_id = %s")
        params.append(teacher["teacher_id"])

    if class_id.isdigit():
        clauses.append("lc.class_id = %s")
        params.append(int(class_id))

    if modality:
        mod_enum = enum_modality(modality)
        if mod_enum:
            clauses.append("ce.learning_modality = %s")
            params.append(mod_enum)

    if search:
        clauses.append("(LOWER(l.first_name || ' ' || l.last_name) LIKE LOWER(%s) OR l.lrn LIKE %s OR LOWER(c.clc_name) LIKE LOWER(%s) OR LOWER(lc.class_name) LIKE LOWER(%s))")
        params.extend([f"%{search}%", f"%{search}%", f"%{search}%", f"%{search}%"])

    where_clause = "WHERE " + " AND ".join(clauses)
    rows = fetch_all(
        _learner_query(
            where_clause,
            "c.clc_name, lc.learning_level, l.last_name, l.first_name",
        ),
        tuple(params),
    )
    unique = {}
    for row in rows:
        unique.setdefault(row["learner_id"], row)

    data = [_shape_learner(row) for row in unique.values()]
    return {"total": len(data), "data": data}


@bp.get("/reports/attendance-list")
@role_required("teacher", "admin")
def attendance_list_report():
    """Attendance summary report per learner in face-to-face and blended sessions."""
    teacher = teacher_for_user()
    class_id = str(request.args.get("class_id") or "").strip()
    search = str(request.args.get("search") or "").strip()

    clauses = ["ce.enrollment_status = 'ENROLLED'"]
    params: list = []

    if teacher:
        clauses.append("lc.teacher_id = %s")
        params.append(teacher["teacher_id"])

    if class_id.isdigit():
        clauses.append("lc.class_id = %s")
        params.append(int(class_id))

    if search:
        clauses.append("(LOWER(l.first_name || ' ' || l.last_name) LIKE LOWER(%s) OR l.lrn LIKE %s OR LOWER(c.clc_name) LIKE LOWER(%s) OR LOWER(lc.class_name) LIKE LOWER(%s))")
        params.extend([f"%{search}%", f"%{search}%", f"%{search}%", f"%{search}%"])

    where_sql = "WHERE " + " AND ".join(clauses)

    rows = fetch_all(
        f"""
        SELECT
            l.learner_id, l.lrn, l.first_name, l.last_name, l.sex,
            ce.enrollment_id, ce.learning_modality, ce.enrollment_status,
            lc.class_id, lc.class_name, lc.learning_level, lc.school_year, lc.semester,
            c.clc_name,
            COALESCE(sas.total_scheduled_sessions, 0) AS total_sessions,
            COALESCE(sas.total_sessions_attended, 0) AS sessions_present,
            COALESCE(sas.total_sessions_missed, 0) AS sessions_absent,
            COALESCE(sas.session_attendance_rate_percent, 0.0) AS attendance_rate_percent,
            (
                SELECT cs.session_date
                FROM session_attendance sa
                JOIN class_session cs ON cs.session_id = sa.session_id
                WHERE sa.enrollment_id = ce.enrollment_id AND sa.attendance_status = 'PRESENT'
                ORDER BY cs.session_date DESC
                LIMIT 1
            ) AS last_present_date
        FROM learner l
        JOIN class_enrollment ce ON ce.learner_id = l.learner_id
        JOIN learning_class lc ON lc.class_id = ce.class_id
        JOIN clc c ON c.clc_id = lc.clc_id
        LEFT JOIN vw_session_attendance_summary sas ON sas.enrollment_id = ce.enrollment_id
        {where_sql}
        ORDER BY c.clc_name, lc.school_year DESC, lc.class_name, l.last_name, l.first_name
        """,
        tuple(params),
    )

    data = [
        {
            "learner_id": r["learner_id"],
            "enrollment_id": r["enrollment_id"],
            "lrn": r["lrn"],
            "name": f"{r['first_name']} {r['last_name']}".strip(),
            "first_name": r["first_name"],
            "last_name": r["last_name"],
            "sex": str(r.get("sex") or "").title(),
            "modality": title_enum(r.get("learning_modality")),
            "clc": r["clc_name"],
            "class_name": r.get("class_name") or f"{title_enum(r.get('learning_level'))} ({r.get('school_year')})",
            "learning_level": title_enum(r.get("learning_level")),
            "school_year": r.get("school_year") or "",
            "semester": r.get("semester") or "",
            "total_sessions": int(r["total_sessions"] or 0),
            "sessions_present": int(r["sessions_present"] or 0),
            "sessions_absent": int(r["sessions_absent"] or 0),
            "attendance_rate": float(r["attendance_rate_percent"] or 0.0),
            "last_present_date": r["last_present_date"].strftime("%m/%d/%Y") if r.get("last_present_date") else "—",
            "status": title_enum(r.get("enrollment_status")),
        }
        for r in rows
    ]
    return {"total": len(data), "data": data}


@bp.get("/reports/enrollment-listing")
@role_required("admin")
def enrollment_listing_report():
    """Cross-CLC enrollment listing. Filtering/grouping by CLC, school year,
    semester, teacher, and modality is done client-side against this full set --
    same pattern as the Student Registry's single-fetch-then-filter approach.
    """
    rows = fetch_all(
        """
        SELECT l.learner_id, l.lrn, l.first_name, l.last_name, l.sex,
               ce.enrollment_id, ce.enrollment_status, ce.enrollment_date, ce.learning_modality,
               lc.class_id, lc.class_name, lc.learning_level, lc.school_year, lc.semester,
               c.clc_id, c.clc_name,
               lc.teacher_id, CONCAT_WS(' ', t.first_name, t.last_name) AS teacher_name
        FROM learner l
        JOIN class_enrollment ce ON ce.learner_id = l.learner_id
        JOIN learning_class lc ON lc.class_id = ce.class_id
        JOIN clc c ON c.clc_id = lc.clc_id
        JOIN teacher t ON t.teacher_id = lc.teacher_id
        WHERE ce.enrollment_status = 'ENROLLED'
        ORDER BY c.clc_name, lc.school_year DESC, lc.semester, t.last_name, l.last_name, l.first_name
        """
    )
    data = [
        {
            **dict(r),
            "sex": str(r.get("sex") or "").title(),
            "enrollment_status": title_enum(r.get("enrollment_status")),
            "learning_modality": title_enum(r.get("learning_modality")),
        }
        for r in rows
    ]
    return {"total": len(data), "data": data}

