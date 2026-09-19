from __future__ import annotations

import json

from flask import Blueprint, request

from ..authz import current_user_id, role_required, teacher_for_user
from ..db import execute, fetch_all, fetch_one
from ..helpers import enum_modality, error, title_enum
from ..services.learner_service import _learner_query, _shape_learner
from .intervention_routes import INTERVENTION_STATUS_LABELS, INTERVENTION_STATUSES

bp = Blueprint("reports", __name__)

# Every report a teacher can generate can also be escalated to admins.
REPORT_SUBMISSION_TYPES = {
    "AT_RISK": "At-Risk Learners List",
    "INTERVENTION": "Intervention Tracking Report",
    "LEARNER_PROGRESS": "Individual Learner Progress Report",
    "CLASS_LIST": "Class List Report",
    "ATTENDANCE": "Attendance List Report",
}


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


def _shape_submission(row):
    return {
        "id": row["submission_id"],
        "reportType": row["report_type"],
        "reportTypeLabel": REPORT_SUBMISSION_TYPES.get(row["report_type"], row["report_type"]),
        "title": row["title"],
        "subtitle": row.get("subtitle"),
        "teacherName": row.get("teacher_name"),
        "status": row["status"],
        "submittedAt": row["submitted_at"].strftime("%B %d, %Y %I:%M %p"),
        "reviewedAt": row["reviewed_at"].strftime("%B %d, %Y %I:%M %p") if row.get("reviewed_at") else None,
    }


@bp.post("/reports/submissions")
@role_required("teacher")
def submit_report_to_admin():
    """A teacher escalates an already-generated report to admins. The exact
    snapshot the teacher was looking at (meta + sections, same shape the
    ReportPrinter renders) is stored so the admin sees precisely what was
    sent, not a live re-query that could have moved on since."""
    teacher = teacher_for_user()
    if not teacher:
        return error("Teacher profile not found.", 404)

    data = request.get_json(silent=True) or {}
    report_type = str(data.get("reportType") or "").strip().upper()
    title = str(data.get("title") or "").strip()
    subtitle = str(data.get("subtitle") or "").strip() or None
    meta = data.get("meta") or []
    sections = data.get("sections") or []

    if report_type not in REPORT_SUBMISSION_TYPES:
        return error("This report type cannot be sent to admin.", 422)
    if not title or not sections:
        return error("A report title and at least one section are required.", 422)

    snapshot = json.dumps({"meta": meta, "sections": sections})

    row = execute(
        """
        INSERT INTO teacher_report_submission (teacher_id, report_type, title, subtitle, snapshot)
        VALUES (%s, %s, %s, %s, %s::jsonb)
        RETURNING submission_id, submitted_at
        """,
        (teacher["teacher_id"], report_type, title, subtitle, snapshot),
        returning=True,
    )

    teacher_name = f"{teacher['first_name']} {teacher['last_name']}".strip()
    admins = fetch_all("SELECT user_id FROM users WHERE role='ADMIN' AND account_status='ACTIVE'")
    for admin in admins:
        execute(
            """
            INSERT INTO notification (user_id, notification_type, title, message, link, meta_label, dedup_key)
            VALUES (%s, 'REPORT', %s, %s, %s, %s, %s)
            ON CONFLICT (user_id, dedup_key) WHERE dedup_key IS NOT NULL DO NOTHING
            """,
            (
                admin["user_id"],
                "New Report Submitted",
                f"{teacher_name} sent a {REPORT_SUBMISSION_TYPES[report_type]}: \"{title}\".",
                "reports.html?submission=" + str(row["submission_id"]),
                REPORT_SUBMISSION_TYPES[report_type],
                f"report_submission:{row['submission_id']}",
            ),
        )

    return {"message": "Report sent to admin.", "id": row["submission_id"]}, 201


@bp.get("/admin/reports/submissions")
@role_required("admin")
def list_report_submissions():
    status = str(request.args.get("status") or "").strip().upper()
    clauses = []
    params: list = []
    if status in ("UNREVIEWED", "REVIEWED"):
        clauses.append("s.status = %s")
        params.append(status)
    where_sql = ("WHERE " + " AND ".join(clauses)) if clauses else ""

    rows = fetch_all(
        f"""
        SELECT s.submission_id, s.report_type, s.title, s.subtitle, s.status,
               s.submitted_at, s.reviewed_at,
               CONCAT_WS(' ', t.first_name, t.last_name) AS teacher_name
        FROM teacher_report_submission s
        JOIN teacher t ON t.teacher_id = s.teacher_id
        {where_sql}
        ORDER BY s.submitted_at DESC
        """,
        tuple(params),
    )
    data = [_shape_submission(r) for r in rows]
    return {"total": len(data), "unreviewed": sum(r["status"] == "UNREVIEWED" for r in data), "data": data}


@bp.get("/admin/reports/submissions/<int:submission_id>")
@role_required("admin")
def get_report_submission(submission_id: int):
    row = fetch_one(
        """
        SELECT s.submission_id, s.report_type, s.title, s.subtitle, s.status,
               s.submitted_at, s.reviewed_at, s.snapshot,
               CONCAT_WS(' ', t.first_name, t.last_name) AS teacher_name
        FROM teacher_report_submission s
        JOIN teacher t ON t.teacher_id = s.teacher_id
        WHERE s.submission_id = %s
        """,
        (submission_id,),
    )
    if not row:
        return error("Report submission not found.", 404)

    return {
        **_shape_submission(row),
        "meta": (row["snapshot"] or {}).get("meta", []),
        "sections": (row["snapshot"] or {}).get("sections", []),
    }


@bp.post("/admin/reports/submissions/<int:submission_id>/review")
@role_required("admin")
def review_report_submission(submission_id: int):
    row = fetch_one(
        "SELECT submission_id FROM teacher_report_submission WHERE submission_id=%s",
        (submission_id,),
    )
    if not row:
        return error("Report submission not found.", 404)

    execute(
        """
        UPDATE teacher_report_submission
        SET status='REVIEWED', reviewed_at=NOW(), reviewed_by_user_id=%s
        WHERE submission_id=%s
        """,
        (current_user_id(), submission_id),
    )
    return {"message": "Marked as reviewed."}

