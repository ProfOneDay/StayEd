from __future__ import annotations

import json
from datetime import date, datetime
from io import BytesIO

import pandas as pd
from flask import Blueprint, request

from ..authz import current_user_id, role_required, teacher_for_user
from ..db import execute, fetch_all, fetch_one, get_db
from ..helpers import (
    LRN_RE,
    enum_level,
    enum_modality,
    error,
    split_name,
    title_enum,
)

bp = Blueprint("learners", __name__)


def _teacher_scope():
    teacher = teacher_for_user()
    if not teacher:
        return None
    return teacher


def _active_class(teacher_id: int, clc_name: str | None = None):
    params = [teacher_id]
    condition = ""
    if clc_name:
        condition = "AND LOWER(c.clc_name) = LOWER(%s)"
        params.append(clc_name)
    return fetch_one(
        f"""
        SELECT lc.*, c.clc_name
        FROM learning_class lc
        JOIN clc c ON c.clc_id = lc.clc_id
        WHERE lc.teacher_id = %s AND lc.status = 'ACTIVE'
          {condition}
        ORDER BY lc.created_at DESC
        LIMIT 1
        """,
        tuple(params),
    )


def _latest_risk_join_sql():
    return """
        LEFT JOIN LATERAL (
            SELECT ra.risk_assessment_id, ra.risk_probability, ra.risk_level, ra.assessment_date
            FROM risk_assessment ra
            WHERE ra.enrollment_id = ce.enrollment_id
              AND ra.data_sufficiency_status = 'PREDICTION_GENERATED'
            ORDER BY ra.assessment_date DESC
            LIMIT 1
        ) risk ON TRUE
    """


def _shape_learner(row):
    first = row.get("first_name") or ""
    last = row.get("last_name") or ""
    risk = title_enum(row.get("risk_level")) or "Low"
    probability = float(row.get("risk_probability") or 0)
    return {
        "id": row["learner_id"],
        "lrn": row["lrn"],
        "first_name": first,
        "last_name": last,
        "name": f"{first} {last}".strip(),
        "sex": str(row.get("sex") or "").title(),
        "age": int(row.get("age") or 0),
        "level": title_enum(row.get("learning_level")),
        "section": row.get("class_name") or "A",
        "modality": title_enum(row.get("learning_modality")),
        "clc": row.get("clc_name") or "",
        "status": title_enum(row.get("enrollment_status")),
        "risk": risk,
        "risk_probability": probability,
        "latest_activity": row.get("latest_activity") or "No recent activity",
        "attendance_rate": float(row.get("attendance_rate") or 0) / 100.0,
        "assessment_avg": round(float(row.get("assessment_avg") or 0), 1),
        "distance_km": float(row.get("distance_from_clc_km") or 0),
        "date_generated": row["assessment_date"].isoformat() if row.get("assessment_date") else None,
        "assigned_teacher": row.get("assigned_teacher") or "",
    }


def _learner_query(where: str = "", order: str = "l.last_name, l.first_name"):
    return f"""
        SELECT
            l.learner_id, l.lrn, l.first_name, l.last_name, l.sex,
            DATE_PART('year', AGE(CURRENT_DATE, l.date_of_birth))::INT AS age,
            l.date_of_birth, l.employment_status, l.civil_status,
            l.contact_number, l.guardian_contact_number,
            ce.enrollment_id, ce.learning_modality, ce.distance_from_clc_km,
            ce.enrollment_status, ce.is_re_enrollee, ce.enrollment_date,
            lc.class_id, lc.learning_level, lc.class_name, lc.school_year, lc.semester,
            lc.teacher_id, c.clc_id, c.clc_name,
            CONCAT_WS(' ', t.first_name, t.last_name) AS assigned_teacher,
            risk.risk_assessment_id, risk.risk_probability, risk.risk_level, risk.assessment_date,
            COALESCE(att.session_attendance_rate_percent, 0) AS attendance_rate,
            0 AS assessment_avg,
            COALESCE(activity.latest_activity, 'No recent activity') AS latest_activity
        FROM learner l
        JOIN class_enrollment ce ON ce.learner_id = l.learner_id
        JOIN learning_class lc ON lc.class_id = ce.class_id
        JOIN clc c ON c.clc_id = lc.clc_id
        JOIN teacher t ON t.teacher_id = lc.teacher_id
        {_latest_risk_join_sql()}
        LEFT JOIN vw_session_attendance_summary att ON att.enrollment_id = ce.enrollment_id
        LEFT JOIN LATERAL (
            SELECT latest_activity FROM (
                SELECT
                    ('"' || mr.module_name || '" returned ' || TO_CHAR(mr.date_returned, 'Mon DD')) AS latest_activity,
                    mr.date_returned::timestamp AS happened_at
                FROM module_record mr
                WHERE mr.enrollment_id = ce.enrollment_id AND mr.date_returned IS NOT NULL
                UNION ALL
                SELECT
                    ('Attendance recorded ' || TO_CHAR(cs.session_date, 'Mon DD')),
                    cs.session_date::timestamp
                FROM session_attendance sa
                JOIN class_session cs ON cs.session_id = sa.session_id
                WHERE sa.enrollment_id = ce.enrollment_id
            ) a
            ORDER BY happened_at DESC
            LIMIT 1
        ) activity ON TRUE
        {where}
        ORDER BY {order}
    """


@bp.get("/learners")
@role_required("teacher")
def list_learners():
    teacher = _teacher_scope()
    if not teacher:
        return {"total": 0, "data": []}

    clauses = ["lc.teacher_id = %s"]
    params: list = [teacher["teacher_id"]]
    search = str(request.args.get("search", "")).strip()
    risk = str(request.args.get("risk", "")).strip().upper()
    modality = str(request.args.get("modality", "")).strip()
    class_id = str(request.args.get("class") or request.args.get("class_id") or "").strip()
    if search:
        clauses.append("(LOWER(l.first_name || ' ' || l.last_name) LIKE LOWER(%s) OR l.lrn LIKE %s)")
        params.extend([f"%{search}%", f"%{search}%"])
    if risk in {"LOW", "MODERATE", "HIGH"}:
        clauses.append("risk.risk_level = %s")
        params.append(risk)
    if modality:
        clauses.append("ce.learning_modality = %s")
        params.append(enum_modality(modality))
    if class_id.isdigit():
        clauses.append("lc.class_id = %s")
        params.append(int(class_id))

    rows = fetch_all(_learner_query("WHERE " + " AND ".join(clauses)), tuple(params))
    # A learner can appear in historical classes; keep the newest enrollment only.
    unique = {}
    for row in rows:
        unique.setdefault(row["learner_id"], row)
    data = [_shape_learner(r) for r in unique.values()]
    return {"total": len(data), "data": data}


@bp.get("/learners/lookup")
@role_required("teacher")
def lookup_learner_by_lrn():
    lrn = str(request.args.get("lrn") or "").strip()
    if not LRN_RE.match(lrn):
        return error("LRN must contain exactly 12 digits.", 422)

    row = fetch_one(
        """
        SELECT learner_id, lrn, first_name, last_name
        FROM learner
        WHERE lrn = %s
        LIMIT 1
        """,
        (lrn,),
    )
    if not row:
        return {"found": False, "data": None}

    return {
        "found": True,
        "data": {
            "id": row["learner_id"],
            "lrn": row["lrn"],
            "name": f"{row.get('first_name') or ''} {row.get('last_name') or ''}".strip(),
        },
    }


@bp.get("/learners/<int:learner_id>")
@role_required("teacher")
def get_learner(learner_id: int):
    teacher = _teacher_scope()
    row = fetch_one(
        _learner_query("WHERE l.learner_id = %s AND lc.teacher_id = %s", "ce.enrollment_date DESC") + " LIMIT 1",
        (learner_id, teacher["teacher_id"]),
    )
    if not row:
        return error("Learner not found.", 404)
    return _shape_learner(row)


def _validate_learner_payload(data, *, partial=False):
    result = {}
    if not partial or "lrn" in data:
        lrn = str(data.get("lrn") or "").strip()
        if not LRN_RE.match(lrn):
            raise ValueError("LRN must contain exactly 12 digits.")
        result["lrn"] = lrn

    if "name" in data or "full_name" in data:
        first, last = split_name(data.get("name") or data.get("full_name"))
        if not first or not last:
            raise ValueError("Learner full name is required.")
        result["first_name"] = first
        result["last_name"] = last
    else:
        if "first_name" in data:
            result["first_name"] = str(data["first_name"]).strip()
        if "last_name" in data:
            result["last_name"] = str(data["last_name"]).strip()

    if not partial or "sex" in data:
        sex = str(data.get("sex") or "").strip().upper()
        if sex not in {"MALE", "FEMALE"}:
            raise ValueError("Sex must be Male or Female.")
        result["sex"] = sex

    if not partial or "birthdate" in data or "date_of_birth" in data:
        dob = str(data.get("birthdate") or data.get("date_of_birth") or "").strip()
        try:
            result["date_of_birth"] = date.fromisoformat(dob)
        except ValueError as exc:
            raise ValueError("Birthdate must use YYYY-MM-DD.") from exc

    for src, dest in (
        ("employment_status", "employment_status"),
        ("civil_status", "civil_status"),
        ("contact_number", "contact_number"),
        ("guardian_contact_number", "guardian_contact_number"),
    ):
        if src in data:
            result[dest] = data.get(src) or None
    return result


@bp.post("/learners")
@role_required("teacher")
def create_learner():
    data = request.get_json(silent=True) or {}
    teacher = _teacher_scope()
    if not teacher:
        return error("Teacher profile not found.", 404)
    try:
        clean = _validate_learner_payload(data)
    except ValueError as exc:
        return error(str(exc), 422)

    class_row = _active_class(teacher["teacher_id"], data.get("clc")) or _active_class(teacher["teacher_id"])
    if not class_row:
        return error("Create an active class before enrolling learners.", 422)

    db = get_db()
    try:
        with db.cursor() as cur:
            cur.execute(
                "SELECT learner_id FROM learner WHERE lrn = %s",
                (clean["lrn"],),
            )
            existing = cur.fetchone()

            if existing:
                learner_id = existing["learner_id"]
            else:
                cur.execute(
                    """
                    INSERT INTO learner (
                        lrn, first_name, last_name, sex, date_of_birth,
                        employment_status, civil_status, contact_number, guardian_contact_number
                    ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    RETURNING learner_id
                    """,
                    (
                        clean["lrn"], clean["first_name"], clean["last_name"], clean["sex"],
                        clean["date_of_birth"], clean.get("employment_status"), clean.get("civil_status"),
                        clean.get("contact_number"), clean.get("guardian_contact_number"),
                    ),
                )
                learner_id = cur.fetchone()["learner_id"]

            cur.execute(
                """
                SELECT enrollment_id
                FROM class_enrollment
                WHERE class_id = %s AND learner_id = %s
                LIMIT 1
                """,
                (class_row["class_id"], learner_id),
            )
            prior_enrollment = cur.fetchone()
            is_re_enrollee = bool(
                data.get("is_re_enrollee", data.get("reenrollee", existing is not None))
            )

            if prior_enrollment:
                cur.execute(
                    """
                    UPDATE class_enrollment
                    SET learning_modality = %s,
                        is_re_enrollee = %s,
                        distance_from_clc_km = %s,
                        enrollment_status = 'ENROLLED'
                    WHERE enrollment_id = %s
                    """,
                    (
                        enum_modality(data.get("modality")),
                        is_re_enrollee,
                        data.get("distance_km") or None,
                        prior_enrollment["enrollment_id"],
                    ),
                )
            else:
                cur.execute(
                    """
                    INSERT INTO class_enrollment (
                        class_id, learner_id, learning_modality, is_re_enrollee,
                        distance_from_clc_km, enrollment_status
                    ) VALUES (%s,%s,%s,%s,%s,'ENROLLED')
                    """,
                    (
                        class_row["class_id"], learner_id, enum_modality(data.get("modality")),
                        is_re_enrollee, data.get("distance_km") or None,
                    ),
                )
        db.commit()
    except Exception:
        db.rollback()
        raise

    row = fetch_one(
        _learner_query("WHERE l.learner_id = %s AND lc.teacher_id = %s", "ce.enrollment_date DESC") + " LIMIT 1",
        (learner_id, teacher["teacher_id"]),
    )
    return _shape_learner(row), 201


@bp.put("/learners/<int:learner_id>")
@role_required("teacher")
def update_learner(learner_id: int):
    data = request.get_json(silent=True) or {}
    teacher = _teacher_scope()
    row = fetch_one(
        """
        SELECT l.*, ce.enrollment_id
        FROM learner l
        JOIN class_enrollment ce ON ce.learner_id=l.learner_id
        JOIN learning_class lc ON lc.class_id=ce.class_id
        WHERE l.learner_id=%s AND lc.teacher_id=%s
        ORDER BY ce.enrollment_date DESC LIMIT 1
        """,
        (learner_id, teacher["teacher_id"]),
    )
    if not row:
        return error("Learner not found.", 404)

    status = str(data.get("status") or "").strip().lower()
    if status:
        mapped = {"archived": "WITHDRAWN", "active": "ENROLLED", "inactive": "DROPPED", "completed": "COMPLETED"}.get(status)
        if not mapped:
            return error("Unsupported learner status.", 422)
        db = get_db()
        try:
            with db.cursor() as cur:
                cur.execute("UPDATE class_enrollment SET enrollment_status=%s WHERE enrollment_id=%s", (mapped, row["enrollment_id"]))
            db.commit()
        except Exception:
            db.rollback()
            raise

    editable = {k: v for k, v in data.items() if k in {
        "lrn", "name", "full_name", "first_name", "last_name", "sex", "birthdate", "date_of_birth",
        "employment_status", "civil_status", "contact_number", "guardian_contact_number"
    }}
    if editable:
        try:
            clean = _validate_learner_payload(editable, partial=True)
        except ValueError as exc:
            return error(str(exc), 422)
        if clean:
            columns = list(clean)
            values = [clean[c] for c in columns]
            set_clause = ", ".join(f"{c}=%s" for c in columns)
            db = get_db()
            try:
                with db.cursor() as cur:
                    cur.execute(f"UPDATE learner SET {set_clause} WHERE learner_id=%s", (*values, learner_id))
                db.commit()
            except Exception:
                db.rollback()
                raise

    refreshed = fetch_one(
        _learner_query("WHERE l.learner_id = %s AND lc.teacher_id = %s", "ce.enrollment_date DESC") + " LIMIT 1",
        (learner_id, teacher["teacher_id"]),
    )
    return _shape_learner(refreshed)


@bp.delete("/learners/<int:learner_id>")
@role_required("teacher")
def delete_learner(learner_id: int):
    teacher = _teacher_scope()
    row = fetch_one(
        """
        SELECT l.learner_id
        FROM learner l
        JOIN class_enrollment ce ON ce.learner_id=l.learner_id
        JOIN learning_class lc ON lc.class_id=ce.class_id
        WHERE l.learner_id=%s AND lc.teacher_id=%s LIMIT 1
        """,
        (learner_id, teacher["teacher_id"]),
    )
    if not row:
        return error("Learner not found.", 404)
    db = get_db()
    try:
        with db.cursor() as cur:
            cur.execute("DELETE FROM class_enrollment WHERE learner_id=%s", (learner_id,))
            cur.execute("DELETE FROM learner WHERE learner_id=%s", (learner_id,))
        db.commit()
    except Exception:
        db.rollback()
        raise
    return {"success": True}


def _profile_base(learner_id: int):
    teacher = _teacher_scope()
    return fetch_one(
        _learner_query("WHERE l.learner_id = %s AND lc.teacher_id = %s", "ce.enrollment_date DESC") + " LIMIT 1",
        (learner_id, teacher["teacher_id"]),
    )


@bp.get("/learners/<int:learner_id>/records-detail")
@role_required("teacher")
def records_detail(learner_id: int):
    base = _profile_base(learner_id)
    if not base:
        return error("Learner not found.", 404)
    enrollment_id = base["enrollment_id"]

    progress = fetch_one(
        "SELECT * FROM vw_module_progress WHERE enrollment_id=%s", (enrollment_id,)
    ) or {}
    att = fetch_one(
        "SELECT * FROM vw_session_attendance_summary WHERE enrollment_id=%s", (enrollment_id,)
    ) or {}
    contact = fetch_one(
        """
        SELECT contact_result, contact_date
        FROM contact_log WHERE enrollment_id=%s
        ORDER BY contact_date DESC LIMIT 1
        """,
        (enrollment_id,),
    )
    modules = fetch_all(
        """
        SELECT mr.*, ls.strand_code, ls.strand_name
        FROM module_record mr
        LEFT JOIN learning_strand ls ON ls.learning_strand_id=mr.learning_strand_id
        WHERE mr.enrollment_id=%s
        ORDER BY ls.strand_code NULLS LAST, mr.date_released DESC
        """,
        (enrollment_id,),
    )
    groups = {}
    history = []
    for m in modules:
        strand = f"{m.get('strand_code') or 'General'} – {m.get('strand_name') or 'Modules'}"
        status = "returned" if m["module_status"] == "RETURNED" else "in_progress"
        groups.setdefault(strand, []).append({
            "title": m["module_name"],
            "released": m["date_released"].strftime("%B %d, %Y"),
            "due": m["date_returned"].strftime("%B %d, %Y") if m.get("date_returned") else "—",
            "status": status,
            "overdueDays": 0,
            "remarks": m.get("remarks") or "",
        })
        if m.get("date_returned"):
            history.append({
                "module": m["module_name"],
                "strand": m.get("strand_code") or "—",
                "completedDate": m["date_returned"].strftime("%B %d, %Y"),
                "score": "—",
            })

    last_session = fetch_one(
        """
        SELECT cs.session_date, sa.attendance_status
        FROM session_attendance sa JOIN class_session cs ON cs.session_id=sa.session_id
        WHERE sa.enrollment_id=%s ORDER BY cs.session_date DESC LIMIT 1
        """,
        (enrollment_id,),
    )
    next_session = fetch_one(
        """
        SELECT session_date FROM class_session
        WHERE class_id=%s AND session_date >= CURRENT_DATE AND session_status='SCHEDULED'
        ORDER BY session_date LIMIT 1
        """,
        (base["class_id"],),
    )
    total = int(progress.get("total_modules_released") or 0)
    completed = int(progress.get("total_modules_returned") or 0)
    return {
        "modules": {
            "total": total,
            "completed": completed,
            "active": max(total - completed, 0),
            "contactStatus": "Contacted" if contact and contact["contact_result"] == "SUCCESSFUL" else "Follow-up Needed",
        },
        "attendance": {
            "totalSessions": int(att.get("total_scheduled_sessions") or 0),
            "attended": int(att.get("total_sessions_attended") or 0),
            "missed": int(att.get("total_sessions_missed") or 0),
            "excused": 0,
            "lastSession": {
                "date": last_session["session_date"].strftime("%b %d, %Y") if last_session else "—",
                "status": title_enum(last_session["attendance_status"]) if last_session else "—",
            },
            "nextSession": {
                "date": next_session["session_date"].strftime("%b %d, %Y") if next_session else "—",
                "status": "Scheduled" if next_session else "—",
            },
        },
        "lastInteraction": contact["contact_date"].strftime("%b %d, %Y") if contact else "—",
        "moduleGroups": [
            {"strand": strand, "icon": "menu_book", "modules": rows}
            for strand, rows in groups.items()
        ],
        "moduleHistory": history[:12],
    }


@bp.get("/learners/<int:learner_id>/profile")
@role_required("teacher")
def learner_profile(learner_id: int):
    base = _profile_base(learner_id)
    if not base:
        return error("Learner not found.", 404)
    shaped = _shape_learner(base)
    enrollment_id = base["enrollment_id"]

    risk_history = fetch_all(
        """
        SELECT assessment_date, risk_probability, risk_level
        FROM risk_assessment
        WHERE enrollment_id=%s AND data_sufficiency_status='PREDICTION_GENERATED'
        ORDER BY assessment_date
        """,
        (enrollment_id,),
    )
    risk_trend = [
        {"month": r["assessment_date"].strftime("%b"), "value": round(float(r["risk_probability"] or 0) * 100)}
        for r in risk_history[-6:]
    ]
    if not risk_trend:
        risk_trend = [{"month": datetime.now().strftime("%b"), "value": round(shaped["risk_probability"] * 100)}]

    mod = fetch_one("SELECT * FROM vw_module_progress WHERE enrollment_id=%s", (enrollment_id,)) or {}
    att = fetch_one("SELECT * FROM vw_session_attendance_summary WHERE enrollment_id=%s", (enrollment_id,)) or {}
    contacts = fetch_all(
        "SELECT * FROM contact_log WHERE enrollment_id=%s ORDER BY contact_date DESC LIMIT 10",
        (enrollment_id,),
    )
    interventions = fetch_all(
        """
        SELECT i.*, ra.risk_level
        FROM intervention i
        JOIN risk_assessment ra ON ra.risk_assessment_id=i.risk_assessment_id
        WHERE ra.enrollment_id=%s
        ORDER BY i.date_assigned DESC
        """,
        (enrollment_id,),
    )
    active = next((i for i in interventions if i["status"] in {"PLANNED", "ONGOING"}), None)

    factors = []
    if base.get("risk_assessment_id"):
        factors = fetch_all(
            """
            SELECT factor_name, factor_value, importance_score
            FROM risk_factors WHERE risk_assessment_id=%s
            ORDER BY importance_score DESC NULLS LAST
            """,
            (base["risk_assessment_id"],),
        )

    attendance_rate = round(float(att.get("session_attendance_rate_percent") or 0))
    total_modules = int(mod.get("total_modules_released") or 0)
    completed_modules = int(mod.get("total_modules_returned") or 0)
    risk_pct = round(shaped["risk_probability"] * 100)
    current_risk = shaped["risk"]
    prev_risk = title_enum(risk_history[-2]["risk_level"]) if len(risk_history) >= 2 else current_risk

    contributor_rows = []
    for f in factors[:4]:
        name = f["factor_name"].replace("_", " ").title()
        importance = float(f.get("importance_score") or 0)
        level = "High" if importance >= .6 else "Moderate" if importance >= .3 else "Low"
        contributor_rows.append({
            "icon": "analytics", "tone": "error" if level == "High" else "moderate",
            "title": name, "level": level,
            "text": f"Current value: {f.get('factor_value') if f.get('factor_value') is not None else 'n/a'}.",
        })
    if not contributor_rows:
        contributor_rows = [
            {"icon": "event_busy", "tone": "error" if attendance_rate < 70 else "neutral", "title": "Attendance Consistency", "level": "High" if attendance_rate < 70 else "Low", "text": f"Attendance rate is {attendance_rate}%."},
            {"icon": "history_edu", "tone": "moderate", "title": "Module Completion", "level": "Moderate", "text": f"{completed_modules} of {total_modules} released modules are submitted/completed."},
        ]

    recommendation = []
    if current_risk == "High":
        recommendation = [
            {"priority": "high", "title": "Contact learner", "text": "Immediate follow-up regarding identified risk indicators."},
            {"priority": "high", "title": "Schedule consultation", "text": "Review attendance and module barriers with the learner."},
            {"priority": "medium", "title": "Monitor next activity", "text": "Track the next session and module submission closely."},
        ]
    elif current_risk == "Moderate":
        recommendation = [
            {"priority": "medium", "title": "Check in with learner", "text": "Discuss emerging attendance or learning barriers."},
            {"priority": "medium", "title": "Monitor next module", "text": "Watch for repeated delays before risk increases."},
        ]
    else:
        recommendation = [{"priority": "low", "title": "Continue monitoring", "text": "Maintain regular attendance and module tracking."}]

    att_history = fetch_all(
        """
        SELECT cs.session_date, cs.session_topic, sa.attendance_status
        FROM session_attendance sa JOIN class_session cs ON cs.session_id=sa.session_id
        WHERE sa.enrollment_id=%s ORDER BY cs.session_date DESC LIMIT 8
        """,
        (enrollment_id,),
    )
    module_history = fetch_all(
        """
        SELECT module_name, date_released, date_returned
        FROM module_record WHERE enrollment_id=%s ORDER BY date_released DESC LIMIT 8
        """,
        (enrollment_id,),
    )

    timeline = []
    for a in att_history[:5]:
        timeline.append({
            "type": "attendance", "title": f"Attendance: {title_enum(a['attendance_status'])}",
            "text": a.get("session_topic") or "Class session", "date": a["session_date"].strftime("%b %d, %Y")
        })
    for i in interventions[:5]:
        timeline.append({
            "type": "intervention", "title": i["intervention_type"], "text": i["description"],
            "date": i["date_assigned"].strftime("%b %d, %Y")
        })

    response = {
        **shaped,
        "riskTrend": risk_trend,
        "metrics": {
            "attendanceRate": attendance_rate,
            "attendanceDelta": 0,
            "modulesCompleted": completed_modules,
            "modulesTotal": total_modules,
            "submissionTimeliness": int(mod.get("module_completion_progress_percent") or 0),
            "consultationsAttended": sum(1 for c in contacts if c["contact_result"] == "SUCCESSFUL"),
            "consultationsTotal": len(contacts),
        },
        "background": {
            "civilStatus": title_enum(base.get("civil_status")) or "—",
            "employment": base.get("employment_status") or "—",
            "distanceCategory": "Far (>5km)" if float(base.get("distance_from_clc_km") or 0) > 5 else "Near (≤5km)",
            "reenrollee": "Yes" if base.get("is_re_enrollee") else "No",
            "yearsEnrolled": "—",
            "beneficiary4Ps": "—",
        },
        "recentActivity": timeline[:4],
        "recommendedActions": recommendation,
        "monitoringHistory": {
            "attendance": [
                {"date": a["session_date"].strftime("%b %d"), "session": a.get("session_topic") or "Session", "status": "Attended" if a["attendance_status"] == "PRESENT" else title_enum(a["attendance_status"])}
                for a in att_history
            ],
            "modules": [
                {"module": m["module_name"], "released": m["date_released"].strftime("%b %d"), "submitted": m["date_returned"].strftime("%b %d") if m.get("date_returned") else "—"}
                for m in module_history
            ],
            "timeline": timeline,
        },
        "riskExplanation": {
            "probability": risk_pct,
            "confidence": "Available" if risk_history else "Pending",
            "model": "Random Forest",
            "lastPrediction": base["assessment_date"].strftime("%b %d, %Y %I:%M %p") if base.get("assessment_date") else "No prediction yet",
            "summary": f"StayEd currently classifies this learner as {current_risk} Risk based on the latest available monitoring data.",
            "previousRisk": f"{prev_risk} Risk",
            "currentRisk": f"{current_risk} Risk",
            "changes": [],
            "contributors": contributor_rows,
            "recordsUsed": "Attendance, Modules, Assessments, Contacts, and Enrollment Context",
        },
        "interventions": {
            "active": {
                "title": active["intervention_type"],
                "priority": "High Priority" if current_risk == "High" else "Medium Priority",
                "assigned": active["date_assigned"].strftime("%B %d, %Y"),
                "followUp": active["target_date"].strftime("%B %d, %Y") if active.get("target_date") else "—",
                "status": title_enum(active["status"]),
            } if active else None,
            "history": [
                {
                    "date": i["date_assigned"].strftime("%B %d, %Y"),
                    "intervention": i["intervention_type"],
                    "reason": title_enum(i.get("risk_level")),
                    "priority": "High" if i.get("risk_level") == "HIGH" else "Medium",
                    "status": title_enum(i["status"]),
                    "outcome": "Completed" if i["status"] == "COMPLETED" else "Pending",
                } for i in interventions
            ],
            "recommended": [
                {
                    "priority": "High Priority" if r["priority"] == "high" else "Medium Priority",
                    "rank": idx + 1,
                    "title": r["title"].title(),
                    "factor": contributor_rows[min(idx, len(contributor_rows)-1)]["title"],
                    "text": r["text"],
                    "action": r["title"].title(),
                }
                for idx, r in enumerate(recommendation)
            ],
        },
    }
    return response


@bp.get("/learning-strands")
@role_required("teacher")
def list_learning_strands():
    rows = fetch_all(
        "SELECT learning_strand_id, strand_code, strand_name FROM learning_strand WHERE status='ACTIVE' ORDER BY strand_code"
    )
    return {"data": [{"id": r["learning_strand_id"], "code": r["strand_code"], "name": r["strand_name"]} for r in rows]}


def _shape_module(row):
    return {
        "id": row["module_record_id"],
        "strandCode": row.get("strand_code") or "",
        "strandName": row.get("strand_name") or "",
        "title": row["module_name"],
        "released": row["date_released"].strftime("%B %d, %Y"),
        "returned": row["date_returned"].strftime("%B %d, %Y") if row.get("date_returned") else None,
        "status": "returned" if row["module_status"] == "RETURNED" else "released",
        "remarks": row.get("remarks") or "",
    }


def _module_summary(enrollment_id: int):
    rows = fetch_all(
        """
        SELECT mr.*, ls.strand_code, ls.strand_name
        FROM module_record mr
        LEFT JOIN learning_strand ls ON ls.learning_strand_id = mr.learning_strand_id
        WHERE mr.enrollment_id = %s
        ORDER BY ls.strand_code NULLS LAST, mr.date_released DESC
        """,
        (enrollment_id,),
    )
    modules = [_shape_module(r) for r in rows]
    total = len(modules)
    returned = sum(1 for m in modules if m["status"] == "returned")
    return {
        "summary": {
            "total": total,
            "returned": returned,
            "inProgress": total - returned,
            "completionPercent": round(100 * returned / total) if total else 0,
        },
        "modules": modules,
    }


@bp.get("/learners/<int:learner_id>/modules")
@role_required("teacher")
def list_learner_modules(learner_id: int):
    base = _profile_base(learner_id)
    if not base:
        return error("Learner not found.", 404)
    return _module_summary(base["enrollment_id"])


@bp.post("/learners/<int:learner_id>/modules")
@role_required("teacher")
def release_module(learner_id: int):
    base = _profile_base(learner_id)
    if not base:
        return error("Learner not found.", 404)
    teacher = _teacher_scope()

    data = request.get_json(silent=True) or {}
    title = str(data.get("title") or "").strip()
    strand_code = str(data.get("strandCode") or "").strip().upper()
    if not title or not strand_code:
        return error("Module title and learning strand are required.", 422)

    strand = fetch_one("SELECT learning_strand_id FROM learning_strand WHERE strand_code = %s", (strand_code,))
    if not strand:
        return error("Unknown learning strand.", 422)

    try:
        date_released = date.fromisoformat(str(data.get("dateReleased"))) if data.get("dateReleased") else date.today()
    except ValueError:
        return error("Release date must use YYYY-MM-DD.", 422)

    db = get_db()
    try:
        with db.cursor() as cur:
            cur.execute(
                """
                INSERT INTO module_record (
                    enrollment_id, learning_strand_id, module_name, date_released, recorded_by_teacher_id
                ) VALUES (%s, %s, %s, %s, %s)
                """,
                (base["enrollment_id"], strand["learning_strand_id"], title, date_released, teacher["teacher_id"]),
            )
        db.commit()
    except Exception:
        db.rollback()
        raise

    return {"message": "Module released.", **_module_summary(base["enrollment_id"])}, 201


@bp.put("/learners/<int:learner_id>/modules/<int:module_record_id>")
@role_required("teacher")
def update_module(learner_id: int, module_record_id: int):
    base = _profile_base(learner_id)
    if not base:
        return error("Learner not found.", 404)

    existing = fetch_one(
        "SELECT * FROM module_record WHERE module_record_id=%s AND enrollment_id=%s",
        (module_record_id, base["enrollment_id"]),
    )
    if not existing:
        return error("Module record not found.", 404)

    data = request.get_json(silent=True) or {}
    title = str(data.get("title") or existing["module_name"]).strip()

    date_released = existing["date_released"]
    if data.get("dateReleased"):
        try:
            date_released = date.fromisoformat(str(data["dateReleased"]))
        except ValueError:
            return error("Release date must use YYYY-MM-DD.", 422)

    date_returned = existing["date_returned"]
    if "returned" in data:
        if data["returned"]:
            if data.get("dateReturned"):
                try:
                    date_returned = date.fromisoformat(str(data["dateReturned"]))
                except ValueError:
                    return error("Return date must use YYYY-MM-DD.", 422)
            else:
                date_returned = date.today()
        else:
            date_returned = None

    if date_returned and date_returned < date_released:
        return error("Return date cannot be before the release date.", 422)

    remarks = data.get("remarks", existing.get("remarks"))

    execute(
        """
        UPDATE module_record
        SET module_name=%s, date_released=%s, date_returned=%s, remarks=%s
        WHERE module_record_id=%s
        """,
        (title, date_released, date_returned, remarks, module_record_id),
    )

    return {"message": "Module updated.", **_module_summary(base["enrollment_id"])}


def _read_upload(file_storage):
    name = (file_storage.filename or "").lower()
    raw = file_storage.read()
    if name.endswith(".csv"):
        return pd.read_csv(BytesIO(raw))
    if name.endswith(".xlsx") or name.endswith(".xls"):
        return pd.read_excel(BytesIO(raw))
    raise ValueError("Only CSV, XLSX, or XLS files are supported.")


def _normalise_import_value(value):
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    if isinstance(value, pd.Timestamp):
        return value.date().isoformat()
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return value


def _canonical_rows(frame: pd.DataFrame):
    frame = frame.copy()
    frame.columns = [str(c).strip().lower().replace(" ", "_") for c in frame.columns]
    aliases = {
        "learner_reference_number": "lrn", "full_name": "name", "learner_name": "name",
        "date_of_birth": "birthdate", "dob": "birthdate", "learning_level": "level",
        "learning_modality": "modality",
    }
    frame = frame.rename(columns={k: v for k, v in aliases.items() if k in frame.columns})
    records = frame.where(pd.notna(frame), None).to_dict(orient="records")
    return [
        {key: _normalise_import_value(value) for key, value in row.items()}
        for row in records
    ]


def _parse_import_birthdate(value):
    if not value:
        return None
    if isinstance(value, (date, datetime)):
        return value.date() if isinstance(value, datetime) else value
    text = str(value).strip()
    try:
        return date.fromisoformat(text[:10])
    except ValueError:
        parsed = pd.to_datetime(text, errors="coerce")
        if pd.isna(parsed):
            return None
        return parsed.date()


def _preview_rows(rows):
    existing_lrns = {r["lrn"] for r in fetch_all("SELECT lrn FROM learner")}
    seen = set()
    preview = []
    for raw in rows:
        lrn = str(raw.get("lrn") or "").strip()
        name = str(raw.get("name") or "").strip()
        status = "valid"
        issue = None
        if not LRN_RE.match(lrn):
            status, issue = "error", "LRN must contain exactly 12 digits"
        elif lrn in existing_lrns or lrn in seen:
            status, issue = "duplicate", "LRN already exists in the system or file"
        elif not name and not (raw.get("first_name") and raw.get("last_name")):
            status, issue = "error", "Missing learner name"
        elif not raw.get("birthdate"):
            status, issue = "error", "Missing required field: Birthdate"
        elif _parse_import_birthdate(raw.get("birthdate")) is None:
            status, issue = "error", "Birthdate must be a valid date"
        elif str(raw.get("sex") or "MALE").strip().upper() not in {"MALE", "FEMALE"}:
            status, issue = "error", "Sex must be Male or Female"
        seen.add(lrn)
        birthdate = _parse_import_birthdate(raw.get("birthdate"))
        preview.append({
            **raw,
            "lrn": lrn,
            "name": name or f"{raw.get('first_name','')} {raw.get('last_name','')}".strip(),
            "birthdate": birthdate.isoformat() if birthdate else raw.get("birthdate"),
            "level": raw.get("level") or "Basic Literacy",
            "modality": raw.get("modality") or "Face-to-Face",
            "status": status,
            "issue": issue,
        })
    return preview


@bp.post("/learners/import/preview")
@role_required("teacher")
def import_preview():
    try:
        if "file" in request.files:
            rows = _canonical_rows(_read_upload(request.files["file"]))
            filename = request.files["file"].filename
        else:
            data = request.get_json(silent=True) or {}
            rows = data.get("learners") or data.get("rows") or []
            filename = data.get("filename") or "learner_import"
        if not rows:
            return error("Attach a CSV/XLSX file or provide learner rows.", 422)
        preview = _preview_rows(rows)
    except ValueError as exc:
        return error(str(exc), 422)

    return {
        "total": len(preview),
        "valid": sum(r["status"] == "valid" for r in preview),
        "duplicates": sum(r["status"] == "duplicate" for r in preview),
        "errors": sum(r["status"] == "error" for r in preview),
        "filename": filename,
        "rows": preview,
    }


def _insert_import_rows(rows, teacher):
    class_row = _active_class(teacher["teacher_id"])
    if not class_row:
        raise ValueError("Create an active class before importing learners.")
    preview = _preview_rows(rows)
    valid = [r for r in preview if r["status"] == "valid"]
    db = get_db()
    imported = []
    try:
        with db.cursor() as cur:
            for row in valid:
                name = row.get("name") or f"{row.get('first_name','')} {row.get('last_name','')}"
                first, last = split_name(name)
                sex = str(row.get("sex") or "MALE").strip().upper()
                if sex not in {"MALE", "FEMALE"}:
                    sex = "MALE"
                dob = _parse_import_birthdate(row.get("birthdate"))
                if not dob:
                    continue
                cur.execute(
                    """
                    INSERT INTO learner (lrn, first_name, last_name, sex, date_of_birth)
                    VALUES (%s,%s,%s,%s,%s) RETURNING learner_id
                    """,
                    (row["lrn"], first, last, sex, dob),
                )
                learner_id = cur.fetchone()["learner_id"]
                cur.execute(
                    """
                    INSERT INTO class_enrollment (class_id, learner_id, learning_modality, enrollment_status)
                    VALUES (%s,%s,%s,'ENROLLED')
                    """,
                    (class_row["class_id"], learner_id, enum_modality(row.get("modality"))),
                )
                imported.append({"lrn": row["lrn"], "name": name, "level": row.get("level") or "Basic Literacy"})

            summary = {
                "total": len(preview),
                "imported": len(imported),
                "duplicates": sum(r["status"] == "duplicate" for r in preview),
                "invalid": sum(r["status"] == "error" for r in preview),
                "learners": imported[:25],
            }
            cur.execute(
                """
                INSERT INTO learner_import_summary (user_id, summary)
                VALUES (%s, %s::jsonb)
                """,
                (current_user_id(), json.dumps(summary)),
            )
        db.commit()
    except Exception:
        db.rollback()
        raise
    return summary


@bp.post("/learners/import")
@role_required("teacher")
def import_learners():
    teacher = _teacher_scope()
    try:
        if "file" in request.files:
            rows = _canonical_rows(_read_upload(request.files["file"]))
        else:
            data = request.get_json(silent=True) or {}
            rows = data.get("learners") or []
        if not rows:
            return error("No learner rows were provided.", 422)
        summary = _insert_import_rows(rows, teacher)
    except ValueError as exc:
        return error(str(exc), 422)
    return {
        "message": "Learners imported successfully.",
        "imported": summary["imported"],
        "skipped": summary["duplicates"] + summary["invalid"],
    }


@bp.get("/learners/import/summary")
@role_required("teacher")
def import_summary():
    row = fetch_one(
        """
        SELECT summary FROM learner_import_summary
        WHERE user_id=%s ORDER BY created_at DESC LIMIT 1
        """,
        (current_user_id(),),
    )
    return row["summary"] if row else {"total": 0, "imported": 0, "duplicates": 0, "invalid": 0, "learners": []}
