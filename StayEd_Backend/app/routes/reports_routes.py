from __future__ import annotations

from flask import Blueprint, request

from ..authz import role_required, teacher_for_user
from ..db import fetch_all
from ..helpers import title_enum
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
    clauses = ["lc.teacher_id = %s"]
    params: list = [teacher["teacher_id"]]
    if class_id.isdigit():
        clauses.append("lc.class_id = %s")
        params.append(int(class_id))

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

    clauses = ["lc.teacher_id = %s"]
    params: list = [teacher["teacher_id"]]
    if class_id.isdigit():
        clauses.append("lc.class_id = %s")
        params.append(int(class_id))
    if status in INTERVENTION_STATUSES:
        clauses.append("i.status = %s")
        params.append(status)

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
