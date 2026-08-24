from __future__ import annotations

import json
from datetime import date, datetime, timedelta
from io import BytesIO

import pandas as pd
from flask import Blueprint, request

from ..services.ai_intervention_service import generate_ai_recommendation

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
from ..services.learner_service import (
    ACTIVITY_DANGER_DAYS,
    ACTIVITY_WARNING_DAYS,
    _latest_risk_join_sql,
    _learner_query,
    _module_totals,
    _relative_day_phrase,
    _shape_activity,
    _shape_learner,
)
from ..services.prediction_service import trigger_prediction
from ..services.settings_service import get_default_module_duration_days

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
    # Compared explicitly rather than relying on query order, since the
    # default ORDER BY is alphabetical by name (for display), not by
    # enrollment_date -- a first-seen-wins dict insert would silently keep
    # whichever enrollment row Postgres happened to return first.
    unique: dict = {}
    for row in rows:
        existing = unique.get(row["learner_id"])
        if existing is None or (row.get("enrollment_date") or date.min) > (existing.get("enrollment_date") or date.min):
            unique[row["learner_id"]] = row
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
        ("email", "email"),
        ("address", "address"),
        ("guardian_name", "guardian_name"),
        ("guardian_relationship", "guardian_relationship"),
        ("last_grade_completed", "last_grade_completed"),
    ):
        if src in data:
            result[dest] = data.get(src) or None

    if "is_4ps_beneficiary" in data or "is4Ps" in data:
        result["is_4ps_beneficiary"] = bool(data.get("is_4ps_beneficiary", data.get("is4Ps")))

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
                        employment_status, civil_status, contact_number, guardian_contact_number,
                        email, address, guardian_name, guardian_relationship, last_grade_completed
                    ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    RETURNING learner_id
                    """,
                    (
                        clean["lrn"], clean["first_name"], clean["last_name"], clean["sex"],
                        clean["date_of_birth"], clean.get("employment_status"), clean.get("civil_status"),
                        clean.get("contact_number"), clean.get("guardian_contact_number"),
                        clean.get("email"), clean.get("address"), clean.get("guardian_name"),
                        clean.get("guardian_relationship"), clean.get("last_grade_completed"),
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
        SELECT l.*, ce.enrollment_id, ce.is_re_enrollee, ce.distance_from_clc_km, ce.learning_modality
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
        "employment_status", "civil_status", "contact_number", "guardian_contact_number",
        "is_4ps_beneficiary", "is4Ps",
        "email", "address", "guardian_name", "guardian_relationship", "last_grade_completed",
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

    if "distance_from_clc_km" in data or "is_re_enrollee" in data:
        distance = data.get("distance_from_clc_km", row.get("distance_from_clc_km"))
        try:
            distance = float(distance) if distance not in (None, "") else None
        except (TypeError, ValueError):
            return error("Distance from CLC must be a number.", 422)
        is_re_enrollee = bool(data.get("is_re_enrollee", row.get("is_re_enrollee")))
        db = get_db()
        try:
            with db.cursor() as cur:
                cur.execute(
                    "UPDATE class_enrollment SET distance_from_clc_km=%s, is_re_enrollee=%s WHERE enrollment_id=%s",
                    (distance, is_re_enrollee, row["enrollment_id"]),
                )
            db.commit()
        except Exception:
            db.rollback()
            raise

    if "modality" in data:
        new_modality = enum_modality(data.get("modality"))
        old_modality = row.get("learning_modality")
        if new_modality != old_modality:
            reason = str(data.get("modality_change_reason") or "").strip() or None
            db = get_db()
            try:
                with db.cursor() as cur:
                    cur.execute(
                        "UPDATE class_enrollment SET learning_modality=%s WHERE enrollment_id=%s",
                        (new_modality, row["enrollment_id"]),
                    )
                    cur.execute(
                        """
                        INSERT INTO modality_change_log (
                            enrollment_id, old_modality, new_modality, reason, changed_by_teacher_id
                        ) VALUES (%s,%s,%s,%s,%s)
                        """,
                        (row["enrollment_id"], old_modality, new_modality, reason, teacher["teacher_id"]),
                    )
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


def _learner_activity_info(base) -> dict:
    shaped = _shape_learner(base)
    return {
        "activityText": shaped["activity_text"],
        "activityStatus": shaped["activity_status"],
        "daysInactive": shaped["days_inactive"],
        "risk": shaped["risk"],
        "riskProbability": shaped["risk_probability"],
    }


@bp.get("/learners/<int:learner_id>/records-detail")
@role_required("teacher")
def records_detail(learner_id: int):
    base = _profile_base(learner_id)
    if not base:
        return error("Learner not found.", 404)
    enrollment_id = base["enrollment_id"]

    totals = _module_totals(enrollment_id)
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
    return {
        "modules": {
            "total": totals["released"],
            "completed": totals["returned"],
            "active": totals["active"],
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
        "moduleGroups": [
            {"strand": strand, "icon": "menu_book", "modules": rows}
            for strand, rows in groups.items()
        ],
        "moduleHistory": history[:12],
    }


def _engagement_score(enrollment_id: int) -> int:
    row = fetch_one(
        """
        SELECT
            EXISTS (
                SELECT 1 FROM module_record
                WHERE enrollment_id=%s AND date_returned >= CURRENT_DATE - INTERVAL '30 days'
            ) AS returned_recently,
            EXISTS (
                SELECT 1 FROM module_record
                WHERE enrollment_id=%s AND date_released >= CURRENT_DATE - INTERVAL '30 days'
            ) AS released_recently,
            EXISTS (
                SELECT 1 FROM contact_log
                WHERE enrollment_id=%s AND contact_result='SUCCESSFUL'
                  AND contact_date >= CURRENT_DATE - INTERVAL '30 days'
            ) AS contacted_recently,
            NOT EXISTS (
                SELECT 1 FROM module_release_batch mrb
                WHERE mrb.enrollment_id=%s
                  AND mrb.release_date <= CURRENT_DATE - INTERVAL '30 days'
                  AND EXISTS (
                      SELECT 1 FROM module_record mr
                      WHERE mr.release_batch_id = mrb.release_batch_id AND mr.date_returned IS NULL
                  )
            ) AS no_overdue_batch
        """,
        (enrollment_id, enrollment_id, enrollment_id, enrollment_id),
    )
    if not row:
        return 0
    return sum(1 for v in row.values() if v)


@bp.get("/learners/<int:learner_id>/profile")
@role_required("teacher")
def learner_profile(learner_id: int):
    base = _profile_base(learner_id)
    if not base:
        return error("Learner not found.", 404)
    shaped = _shape_learner(base)
    enrollment_id = base["enrollment_id"]
    monitoring_started = bool(base.get("batch_count"))

    # Gate risk history the same way _shape_learner gates the risk badge --
    # a learner isn't "Not Yet Assessed" on one part of the profile and
    # showing a colored trend point on another. In the normal app flow this
    # can't diverge (trigger_prediction refuses to run before any module
    # batch exists), but staying consistent here is cheap insurance against
    # imported/seeded data that bypassed that guard.
    risk_history = fetch_all(
        """
        SELECT assessment_date, risk_probability, risk_level
        FROM risk_assessment
        WHERE enrollment_id=%s AND data_sufficiency_status='PREDICTION_GENERATED'
        ORDER BY assessment_date
        """,
        (enrollment_id,),
    ) if monitoring_started else []
    risk_trend = [
        {
            "date": r["assessment_date"].strftime("%b %d, %Y"),
            "level": title_enum(r["risk_level"]),
            "probability": round(float(r["risk_probability"]) * 100) if r.get("risk_probability") is not None else None,
        }
        for r in risk_history[-6:]
    ]

    totals = _module_totals(enrollment_id)
    modules_released = totals["released"]
    modules_returned = totals["returned"]
    active_modules = totals["active"]
    last_returned = totals["last_returned"]
    # A "days since" value must never be negative. A future-dated return
    # (bad data entry, or a record that legitimately hasn't happened yet)
    # is treated as invalid/unusable here rather than surfaced as e.g. -26 --
    # the frontend falls back to "No return recorded yet" for None.
    if last_returned and last_returned <= date.today():
        days_since_last_return = (date.today() - last_returned).days
    else:
        days_since_last_return = None
    last_activity = shaped["activity_text"]
    module_rate = round(100 * modules_returned / modules_released) if modules_released else None

    overdue_modules = fetch_one(
        """
        SELECT COUNT(*)::INT AS n FROM module_record
        WHERE enrollment_id=%s AND date_returned IS NULL
          AND planned_return_date IS NOT NULL AND planned_return_date < CURRENT_DATE
        """,
        (enrollment_id,),
    )["n"]

    last_contact_event = fetch_one(
        """
        SELECT contact_method, contact_date FROM contact_log
        WHERE enrollment_id=%s AND contact_result='SUCCESSFUL'
        ORDER BY contact_date DESC LIMIT 1
        """,
        (enrollment_id,),
    )
    # ================================================================
    # ITEM 2 FIX:
    # Use the ACTUAL recorded consultation date to calculate the
    # number of days since contact. Never use created_at, updated_at,
    # or the time the teacher saved the record. Future dates are treated
    # as invalid so this value can never become negative.
    # ================================================================
    days_since_contact = None

    if last_contact_event:
        contact_date = last_contact_event.get("contact_date")

        if contact_date and contact_date <= date.today():
            days_since_contact = (
                date.today() - contact_date
            ).days

    interventions = fetch_all(
        """
        SELECT i.*, ra.risk_level, fu.notes AS follow_up_notes, fu.outcome AS follow_up_outcome
        FROM intervention i
        JOIN risk_assessment ra ON ra.risk_assessment_id=i.risk_assessment_id
        LEFT JOIN LATERAL (
            SELECT notes, outcome FROM follow_up WHERE intervention_id=i.intervention_id
            ORDER BY follow_up_date DESC LIMIT 1
        ) fu ON TRUE
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

    risk_pct = round(shaped["risk_probability"] * 100)
    current_risk = shaped["risk"]
    prev_risk = title_enum(risk_history[-2]["risk_level"]) if len(risk_history) >= 2 else current_risk
    engagement_score = _engagement_score(enrollment_id)
    years_enrolled = (date.today() - base["enrollment_date"]).days // 365 if base.get("enrollment_date") else None

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
        if days_since_last_return is None:
            contributor_rows.append({
                "icon": "menu_book", "tone": "error", "title": "No Modules Returned Yet", "level": "High",
                "text": f"{modules_released} module(s) released, none returned so far." if modules_released else "No modules have been released yet.",
            })
        elif days_since_last_return >= 21:
            high = days_since_last_return >= 28
            contributor_rows.append({
                "icon": "event_busy", "tone": "error" if high else "moderate",
                "title": "Module Return Inactivity", "level": "High" if high else "Moderate",
                "text": f"No module returned for {days_since_last_return} days.",
            })
        eng_level = "High" if engagement_score <= 1 else "Moderate" if engagement_score <= 2 else "Low"
        contributor_rows.append({
            "icon": "bolt", "tone": "error" if eng_level == "High" else "moderate" if eng_level == "Moderate" else "neutral",
            "title": "Engagement Score", "level": eng_level,
            "text": f"Engagement Score = {engagement_score} (out of 4).",
        })
        if base.get("is_re_enrollee"):
            contributor_rows.append({
                "icon": "restart_alt", "tone": "moderate", "title": "Re-enrollee", "level": "Moderate",
                "text": "This learner previously dropped out and re-enrolled.",
            })
        if days_since_contact is None or days_since_contact >= 30:
            contributor_rows.append({
                "icon": "phone_missed", "tone": "moderate", "title": "Consultation Contact", "level": "Moderate",
                "text": "No consultation contact on record." if days_since_contact is None else f"No consultation contact in {days_since_contact} days.",
            })
        if years_enrolled is not None:
            contributor_rows.append({
                "icon": "history", "tone": "neutral", "title": "Years Enrolled", "level": "Low",
                "text": f"{years_enrolled} year(s) enrolled in the ALS program.",
            })

    recommendation = []
    if current_risk == "High":
        recommendation = [
            {"priority": "high", "title": "Contact learner", "text": "Immediate follow-up regarding identified risk indicators."},
            {"priority": "high", "title": "Schedule consultation", "text": "Review module return barriers with the learner."},
            {"priority": "medium", "title": "Assign intervention", "text": "Assign a support intervention and track its outcome."},
            {"priority": "medium", "title": "Monitor for 2 weeks", "text": "Track the next module return and engagement signals closely."},
        ]
    elif current_risk == "Moderate":
        recommendation = [
            {"priority": "medium", "title": "Contact learner", "text": "Check in about emerging module-return or engagement barriers."},
            {"priority": "medium", "title": "Monitor for 2 weeks", "text": "Watch for repeated delays before risk increases."},
        ]
    else:
        recommendation = [{"priority": "low", "title": "Continue monitoring", "text": "Maintain regular module tracking and consultation contact."}]

    release_batches = fetch_all(
        """
        SELECT mrb.release_date, COUNT(mr.module_record_id) AS n
        FROM module_release_batch mrb
        JOIN module_record mr ON mr.release_batch_id = mrb.release_batch_id
        WHERE mrb.enrollment_id=%s
        GROUP BY mrb.release_batch_id, mrb.release_date
        ORDER BY mrb.release_date DESC LIMIT 10
        """,
        (enrollment_id,),
    )
    return_events = fetch_all(
        """
        SELECT date_returned, COUNT(*) AS n
        FROM module_record WHERE enrollment_id=%s AND date_returned IS NOT NULL
        GROUP BY date_returned ORDER BY date_returned DESC LIMIT 10
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

    modality_changes = fetch_all(
        """
        SELECT old_modality, new_modality, change_date, reason
        FROM modality_change_log
        WHERE enrollment_id=%s
        ORDER BY change_date DESC, modality_change_id DESC
        """,
        (enrollment_id,),
    )
    modality_since = (
        modality_changes[0]["change_date"].strftime("%B %d, %Y") if modality_changes
        else (base["enrollment_date"].strftime("%B %d, %Y") if base.get("enrollment_date") else None)
    )

    timeline = []
    for m in modality_changes:
        text = f"{title_enum(m['old_modality']) or 'Unknown'} → {title_enum(m['new_modality'])}"
        if m.get("reason"):
            text += f" — Reason: {m['reason']}"
        timeline.append({
            "type": "modality", "title": "Modality Changed", "text": text,
            "date": m["change_date"].strftime("%b %d, %Y"), "_sort": m["change_date"],
        })
    for b in release_batches:
        timeline.append({
            "type": "module", "title": f"Released {b['n']} Module{'s' if b['n'] != 1 else ''}",
            "text": "Module batch released to learner.",
            "date": b["release_date"].strftime("%b %d, %Y"), "_sort": b["release_date"],
        })
    for r in return_events:
        timeline.append({
            "type": "module", "title": f"Returned {r['n']} Module{'s' if r['n'] != 1 else ''}",
            "text": "Learner returned module(s) for review.",
            "date": r["date_returned"].strftime("%b %d, %Y"), "_sort": r["date_returned"],
        })
    for i in interventions[:10]:
        timeline.append({
            "type": "intervention", "title": f"Assigned Intervention: {i['intervention_type']}",
            "text": i["description"], "date": i["date_assigned"].strftime("%b %d, %Y"),
            "_sort": i["date_assigned"],
        })
        if i["status"] == "COMPLETED" and i.get("date_completed"):
            timeline.append({
                "type": "intervention", "title": "Intervention Completed", "text": i["intervention_type"],
                "date": i["date_completed"].strftime("%b %d, %Y"), "_sort": i["date_completed"],
            })
    risk_changes = []
    for idx in range(1, len(risk_history)):
        prev_level = title_enum(risk_history[idx - 1]["risk_level"])
        curr_level = title_enum(risk_history[idx]["risk_level"])
        if prev_level == curr_level:
            continue
        assessed_at = risk_history[idx]["assessment_date"]
        risk_changes.append({
            "icon": "trending_up" if curr_level == "High" else "trending_down" if curr_level == "Low" else "trending_flat",
            "text": f"{prev_level} → {curr_level}",
            "severity": curr_level.lower(),
            "date": assessed_at.strftime("%b %d, %Y"),
        })
        timeline.append({
            "type": "risk", "title": "Risk Updated", "text": f"{prev_level} → {curr_level}",
            "date": assessed_at.strftime("%b %d, %Y"), "_sort": assessed_at.date(),
        })

    timeline.sort(key=lambda t: t["_sort"], reverse=True)
    for item in timeline:
        item.pop("_sort", None)

    response = {
        **shaped,
        "header": {
            "schoolYear": base.get("school_year") or "—",
            "dateEnrolled": base["enrollment_date"].strftime("%B %d, %Y") if base.get("enrollment_date") else "—",
            "assignedTeacher": base.get("assigned_teacher") or "—",
            "currentClass": base.get("class_name") or "—",
            "modalitySince": modality_since or "—",
        },
        "riskTrend": risk_trend,
        "metrics": {
            "engagementScore": engagement_score,
            "engagementScoreMax": 4,
            "modulesReleased": modules_released,
            "modulesReturned": modules_returned,
            "moduleRate": module_rate,
            "moduleRateText": (
                f"{modules_returned} of {modules_released} modules returned" if modules_released else "Not Yet Available"
            ),
            "activeModules": active_modules,
            "overdueModules": overdue_modules,
            "lastActivity": last_activity,
            "daysSinceLastReturn": days_since_last_return,
        },
        "background": {
            "civilStatus": title_enum(base.get("civil_status")) or "—",
            "employment": base.get("employment_status") or "—",
            "distanceCategory": "Far (>5km)" if float(base.get("distance_from_clc_km") or 0) > 5 else "Near (≤5km)",
            "distanceKm": float(base.get("distance_from_clc_km") or 0),
            "reenrollee": "Yes" if base.get("is_re_enrollee") else "No",
            "isReenrollee": bool(base.get("is_re_enrollee")),
            "yearsEnrolled": years_enrolled if years_enrolled is not None else "—",
            "is4Ps": bool(base.get("is_4ps_beneficiary")),
            "civilStatusRaw": base.get("civil_status") or "",
            "employmentRaw": base.get("employment_status") or "",
        },
        "recentActivity": timeline[:5],
        "recommendedActions": recommendation,
        "monitoringHistory": {
            "modules": [
                {"module": m["module_name"], "released": m["date_released"].strftime("%b %d"), "submitted": m["date_returned"].strftime("%b %d") if m.get("date_returned") else "—"}
                for m in module_history
            ],
            "timeline": timeline,
        },
        "riskExplanation": {
            "currentRiskLevel": current_risk,
            "summary": f"StayEd currently classifies this learner as {current_risk} Risk based on the latest available monitoring data.",
            "previousRisk": f"{prev_risk} Risk",
            "currentRisk": f"{current_risk} Risk",
            "changes": risk_changes,
            "contributors": contributor_rows,
            "recommendedAction": recommendation,
            "recordsUsed": "Modules, Interventions, Consultation Contacts, and Enrollment Context",
        },
        "interventions": {
            "active": {
                "id": active["intervention_id"],
                "title": active["intervention_type"],
                "priority": "High Priority" if current_risk == "High" else "Medium Priority",
                "assigned": active["date_assigned"].strftime("%B %d, %Y"),
                "followUp": active["target_date"].strftime("%B %d, %Y") if active.get("target_date") else "—",
                "status": title_enum(active["status"]),
                "assignedBy": base.get("assigned_teacher") or "—",
            } if active else None,
            "history": [
                {
                    "date": i["date_assigned"].strftime("%B %d, %Y"),
                    "intervention": i["intervention_type"],
                    "reason": title_enum(i.get("risk_level")),
                    "priority": "High" if i.get("risk_level") == "HIGH" else "Medium",
                    "status": title_enum(i["status"]),
                    "outcome": "Completed" if i["status"] == "COMPLETED" else "Pending",
                    "remarks": i.get("follow_up_notes") or i.get("follow_up_outcome") or "—",
                } for i in interventions
            ],
            "recommended": [
                {
                    "priority": "High Priority" if r["priority"] == "high" else "Medium Priority",
                    "rank": idx + 1,
                    "title": r["title"].title(),
                    "factor": contributor_rows[min(idx, len(contributor_rows) - 1)]["title"] if contributor_rows else "",
                    "text": r["text"],
                    "action": r["title"].title(),
                }
                for idx, r in enumerate(recommendation)
            ],
        },
    }
    return response


INTERVENTION_TYPES = {
    "Home Visit", "Consultation", "Referral", "Learner Follow-up",
    "Parent/Guardian Conference", "Other",
}


def _ensure_risk_assessment_id(enrollment_id: int) -> int:
    """Return the enrollment's most recent risk_assessment_id, creating a
    placeholder (INSUFFICIENT_DATA, no probability/level) if none exists yet --
    interventions require one via a NOT NULL FK, but most learners have no
    prediction on record while the scoring engine remains unconfigured."""
    existing = fetch_one(
        "SELECT risk_assessment_id FROM risk_assessment WHERE enrollment_id=%s ORDER BY assessment_date DESC LIMIT 1",
        (enrollment_id,),
    )
    if existing:
        return existing["risk_assessment_id"]

    model = fetch_one(
        "SELECT model_id FROM model_info WHERE model_status='ACTIVE' ORDER BY training_date DESC LIMIT 1"
    )
    if not model:
        raise ValueError("No ACTIVE model is registered in model_info.")

    today = date.today()
    created = execute(
        """
        INSERT INTO risk_assessment (model_id, enrollment_id, monitoring_start_date, monitoring_end_date)
        VALUES (%s, %s, %s, %s)
        RETURNING risk_assessment_id
        """,
        (model["model_id"], enrollment_id, today, today),
        returning=True,
    )
    return created["risk_assessment_id"]


@bp.post("/learners/<int:learner_id>/interventions")
@role_required("teacher")
def create_intervention(learner_id: int):
    base = _profile_base(learner_id)
    if not base:
        return error("Learner not found.", 404)
    teacher = _teacher_scope()
    data = request.get_json(silent=True) or {}
    intervention_type = str(data.get("type") or "").strip()
    description = str(data.get("description") or "").strip()
    if not intervention_type:
        return error("Intervention type is required.", 422)
    if not description:
        return error("A short description is required.", 422)
    target_date = None
    if data.get("targetDate"):
        try:
            target_date = date.fromisoformat(str(data["targetDate"]))
        except ValueError:
            return error("Target date must use YYYY-MM-DD.", 422)

    try:
        risk_assessment_id = _ensure_risk_assessment_id(base["enrollment_id"])
    except ValueError as exc:
        return error(str(exc), 503)

    created_row = execute(
        """
        INSERT INTO intervention (risk_assessment_id, assigned_to_teacher_id, intervention_type, description, target_date)        VALUES (%s, %s, %s, %s, %s)
        RETURNING intervention_id
        """,
        (risk_assessment_id, teacher["teacher_id"], intervention_type, description, target_date),
        returning=True,
    )
    intervention_id = created_row["intervention_id"]

    try:
        trigger_prediction(base["enrollment_id"], current_user_id())
    except Exception:
        pass

    risk_row = fetch_one(
        "SELECT risk_level, risk_probability FROM risk_assessment WHERE risk_assessment_id=%s",
        (risk_assessment_id,),
    )
    factor_rows = fetch_all(
        "SELECT factor_name AS name, factor_value AS value FROM risk_factors WHERE risk_assessment_id=%s",
        (risk_assessment_id,),
    )

    ai_result = None
    try:
        ai_result = generate_ai_recommendation(
            risk_level=risk_row["risk_level"] if risk_row else "Unknown",
            risk_probability=float(risk_row["risk_probability"]) if risk_row and risk_row.get("risk_probability") else 0.0,
            factors=[dict(f) for f in factor_rows],
            intervention={
                "title": intervention_type,
                "priority": "High" if risk_row and risk_row.get("risk_level") == "HIGH" else "Medium",
                "category": intervention_type,
                "description": description,
                "reason": description,
                "recommended_action": description,
            },
        )
        if ai_result:
            execute(
                """
                UPDATE intervention
                SET ai_title = %s,
                    ai_priority = %s,
                    ai_category = %s,
                    ai_reason = %s,
                    ai_recommended_action = %s
                WHERE intervention_id = %s
                """,
                (
                    ai_result.get("title"),
                    ai_result.get("priority"),
                    ai_result.get("category"),
                    ai_result.get("reason"),
                    ai_result.get("recommended_action"),
                    intervention_id,
                ),
            )
    except Exception as exc:
        print("AI recommendation failed:", exc)

    return {"message": "Intervention assigned.", "ai_recommendation": ai_result}, 201

@bp.get("/learning-strands")
@role_required("teacher")
def list_learning_strands():
    rows = fetch_all(
        "SELECT learning_strand_id, strand_code, strand_name FROM learning_strand WHERE status='ACTIVE' ORDER BY strand_code"
    )
    return {"data": [{"id": r["learning_strand_id"], "code": r["strand_code"], "name": r["strand_name"]} for r in rows]}


def _batch_status(modules: list[dict], release_date: date, learner_activity: dict) -> dict:
    total = len(modules)
    returned = sum(1 for m in modules if m["status"] == "returned")

    if total and returned == total:
        return_dates = [m["returnedRaw"] for m in modules if m["returnedRaw"]]
        return_date = max(return_dates) if return_dates else release_date
        return {
            "status": "returned",
            "returnDate": return_date.strftime("%B %d, %Y"),
            "daysToReturn": (return_date - release_date).days,
            "returnedCount": returned,
        }

    # Batch status is purely operational -- module completion plus whether
    # the recommended follow-up window has been exceeded -- and must never be
    # derived from the ML risk tier. A batch with modules pending isn't
    # "Moderate Risk"; that's a coincidence of two unrelated concepts. Risk
    # is still reported via **learner_activity below so the frontend can show
    # it as its own separate badge.
    if learner_activity["activityStatus"] == "danger":
        status = "overdue"
    elif learner_activity["activityStatus"] == "warning":
        status = "due"
    elif returned > 0:
        status = "partial"
    else:
        status = "pending"

    return {
        "status": status,
        "returnDate": None,
        "daysToReturn": None,
        "returnedCount": returned,
        **learner_activity,
    }


def _module_overdue_info(date_returned, planned_return_date) -> dict:
    if date_returned is not None or planned_return_date is None:
        return {
            "plannedReturn": None, "plannedReturnIso": None, "plannedReturnRaw": None,
            "overdue": False, "daysOverdue": None,
        }
    overdue = date.today() > planned_return_date
    return {
        "plannedReturn": planned_return_date.strftime("%m/%d/%Y"),
        "plannedReturnIso": planned_return_date.isoformat(),
        "plannedReturnRaw": planned_return_date,
        "overdue": overdue,
        "daysOverdue": (date.today() - planned_return_date).days if overdue else None,
    }


def _logbook(enrollment_id: int, learner_activity: dict) -> dict:
    rows = fetch_all(
        """
        SELECT mr.module_record_id, mr.module_name, mr.date_released, mr.date_returned,
               mr.module_status, mr.remarks, mr.release_batch_id, mr.planned_return_date,
               ls.strand_code, ls.strand_name,
               mrb.release_date AS batch_release_date
        FROM module_record mr
        JOIN module_release_batch mrb ON mrb.release_batch_id = mr.release_batch_id
        LEFT JOIN learning_strand ls ON ls.learning_strand_id = mr.learning_strand_id
        WHERE mr.enrollment_id = %s
        ORDER BY mrb.release_date DESC, ls.strand_code NULLS LAST, mr.module_record_id
        """,
        (enrollment_id,),
    )

    batches: dict[int, dict] = {}
    order: list[int] = []
    for r in rows:
        batch_id = r["release_batch_id"]
        if batch_id not in batches:
            batches[batch_id] = {
                "id": batch_id,
                "releaseDate": r["batch_release_date"].strftime("%B %d, %Y"),
                "releaseDateRaw": r["batch_release_date"],
                "strandsByCode": {},
            }
            order.append(batch_id)

        batch = batches[batch_id]
        strand_code = r["strand_code"] or "General"
        strand = batch["strandsByCode"].setdefault(
            strand_code, {"code": strand_code, "name": r["strand_name"] or "Modules", "modules": []}
        )
        strand["modules"].append(
            {
                "id": r["module_record_id"],
                "title": r["module_name"],
                "status": "returned" if r["module_status"] == "RETURNED" else "active",
                "returned": r["date_returned"].strftime("%B %d, %Y") if r["date_returned"] else None,
                "returnedISO": r["date_returned"].isoformat() if r["date_returned"] else None,
                "returnedRaw": r["date_returned"],
                "remarks": r.get("remarks") or "",
                "strandCode": strand_code,
                **_module_overdue_info(r["date_returned"], r.get("planned_return_date")),
            }
        )

    shaped = []
    for batch_id in order:
        batch = batches[batch_id]
        strands = list(batch["strandsByCode"].values())
        all_modules = [m for s in strands for m in s["modules"]]
        status_info = _batch_status(all_modules, batch["releaseDateRaw"], learner_activity)
        for s in strands:
            for m in s["modules"]:
                m.pop("returnedRaw", None)
                m.pop("plannedReturnRaw", None)
        shaped.append(
            {
                "id": batch["id"],
                "releaseDate": batch["releaseDate"],
                "releaseDateISO": batch["releaseDateRaw"].isoformat(),
                "moduleCount": len(all_modules),
                "strandCount": len(strands),
                "strands": strands,
                **status_info,
            }
        )

    return {"batches": shaped}


@bp.get("/learners/<int:learner_id>/modules")
@role_required("teacher")
def list_learner_modules(learner_id: int):
    base = _profile_base(learner_id)
    if not base:
        return error("Learner not found.", 404)
    learner_activity = _learner_activity_info(base)
    return {
        "learner": {
            "name": f"{base['first_name']} {base['last_name']}",
            "lrn": base["lrn"],
            "clc": base["clc_name"],
            "level": base["learning_level"],
            **learner_activity,
        },
        **_logbook(base["enrollment_id"], learner_activity),
    }


@bp.post("/learners/<int:learner_id>/module-batches")
@role_required("teacher")
def release_module_batch(learner_id: int):
    base = _profile_base(learner_id)
    if not base:
        return error("Learner not found.", 404)
    teacher = _teacher_scope()

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

    strands_in = data.get("strands") or []
    inserts = []
    for strand in strands_in:
        strand_code = str(strand.get("strandCode") or "").strip().upper()
        titles = [str(t).strip() for t in (strand.get("modules") or []) if str(t).strip()]
        if not strand_code or not titles:
            continue
        row = fetch_one("SELECT learning_strand_id FROM learning_strand WHERE strand_code = %s", (strand_code,))
        if not row:
            return error(f"Unknown learning strand: {strand_code}.", 422)
        for title in titles:
            inserts.append((row["learning_strand_id"], title))

    if not inserts:
        return error("At least one learning strand with at least one module is required.", 422)

    db = get_db()
    try:
        with db.cursor() as cur:
            cur.execute(
                """
                INSERT INTO module_release_batch (enrollment_id, release_date, recorded_by_teacher_id)
                VALUES (%s, %s, %s) RETURNING release_batch_id
                """,
                (base["enrollment_id"], release_date, teacher["teacher_id"]),
            )
            batch_id = cur.fetchone()["release_batch_id"]
            for learning_strand_id, title in inserts:
                cur.execute(
                    """
                    INSERT INTO module_record (
                        enrollment_id, learning_strand_id, module_name, date_released,
                        recorded_by_teacher_id, release_batch_id, planned_return_date
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        base["enrollment_id"], learning_strand_id, title, release_date,
                        teacher["teacher_id"], batch_id, planned_return_date,
                    ),
                )
        db.commit()
    except Exception:
        db.rollback()
        raise

    try:
        trigger_prediction(base["enrollment_id"], current_user_id())
    except Exception:
        pass

    base = _profile_base(learner_id)
    learner_activity = _learner_activity_info(base)
    return {
        "message": "Module batch released.",
        "learner": {
            "name": f"{base['first_name']} {base['last_name']}",
            "lrn": base["lrn"],
            "clc": base["clc_name"],
            "level": base["learning_level"],
            **learner_activity,
        },
        **_logbook(base["enrollment_id"], learner_activity),
    }, 201


@bp.post("/learners/<int:learner_id>/module-batches/<int:batch_id>/return")
@role_required("teacher")
def return_module_batch(learner_id: int, batch_id: int):
    base = _profile_base(learner_id)
    if not base:
        return error("Learner not found.", 404)

    batch = fetch_one(
        "SELECT release_batch_id, release_date FROM module_release_batch WHERE release_batch_id=%s AND enrollment_id=%s",
        (batch_id, base["enrollment_id"]),
    )
    if not batch:
        return error("Release batch not found.", 404)

    data = request.get_json(silent=True) or {}
    module_ids = [int(m) for m in (data.get("moduleIds") or []) if str(m).strip().lstrip("-").isdigit()]
    if not module_ids:
        return error("Select at least one module to return.", 422)

    try:
        return_date = date.fromisoformat(str(data.get("returnDate"))) if data.get("returnDate") else date.today()
    except ValueError:
        return error("Return date must use YYYY-MM-DD.", 422)

    if return_date > date.today():
        return error("Return date cannot be later than the current date.", 422)
    if return_date < batch["release_date"]:
        return error("Return date cannot be earlier than the module release date.", 422)

    remarks = data.get("remarks") or None

    owned = fetch_all(
        "SELECT module_record_id, module_status FROM module_record WHERE release_batch_id=%s AND module_record_id = ANY(%s)",
        (batch_id, module_ids),
    )
    if len(owned) != len(set(module_ids)):
        return error("One or more selected modules do not belong to this batch.", 422)
    if any(r["module_status"] == "RETURNED" for r in owned):
        return error("One or more selected modules have already been returned.", 422)

    execute(
        """
        UPDATE module_record
        SET date_returned=%s, module_status='RETURNED', remarks=%s
        WHERE release_batch_id=%s AND module_record_id = ANY(%s)
        """,
        (return_date, remarks, batch_id, module_ids),
    )

    try:
        trigger_prediction(base["enrollment_id"], current_user_id())
    except Exception:
        pass

    base = _profile_base(learner_id)
    learner_activity = _learner_activity_info(base)
    return {
        "message": "Module return recorded.",
        "learner": {
            "name": f"{base['first_name']} {base['last_name']}",
            "lrn": base["lrn"],
            "clc": base["clc_name"],
            "level": base["learning_level"],
            **learner_activity,
        },
        **_logbook(base["enrollment_id"], learner_activity),
    }


@bp.patch("/learners/<int:learner_id>/module-batches/<int:batch_id>/modules/<int:module_record_id>")
@role_required("teacher")
def update_module_planned_return(learner_id: int, batch_id: int, module_record_id: int):
    base = _profile_base(learner_id)
    if not base:
        return error("Learner not found.", 404)

    module = fetch_one(
        """
        SELECT mr.module_record_id, mr.date_released FROM module_record mr
        JOIN module_release_batch mrb ON mrb.release_batch_id = mr.release_batch_id
        WHERE mr.module_record_id=%s AND mr.release_batch_id=%s AND mrb.enrollment_id=%s
        """,
        (module_record_id, batch_id, base["enrollment_id"]),
    )
    if not module:
        return error("Module not found.", 404)

    data = request.get_json(silent=True) or {}
    try:
        planned_return_date = date.fromisoformat(str(data.get("plannedReturnDate")))
    except (TypeError, ValueError):
        return error("Planned return date must use YYYY-MM-DD.", 422)
    if planned_return_date < module["date_released"]:
        return error("Planned return date cannot be earlier than the module's release date.", 422)

    execute(
        "UPDATE module_record SET planned_return_date=%s WHERE module_record_id=%s",
        (planned_return_date, module_record_id),
    )

    base = _profile_base(learner_id)
    learner_activity = _learner_activity_info(base)
    return {
        "message": "Planned return date updated.",
        "learner": {
            "name": f"{base['first_name']} {base['last_name']}",
            "lrn": base["lrn"],
            "clc": base["clc_name"],
            "level": base["learning_level"],
            **learner_activity,
        },
        **_logbook(base["enrollment_id"], learner_activity),
    }


def _audit(user_id: int, action: str, table_name: str, record_id: int, description: str) -> None:
    """Append-only trail for corrections made via the Module Release Logbook
    Edit action -- corrected records are updated in place (so the rest of the
    app always reads one current value), but nothing about the prior value is
    silently lost; it is always recoverable from user_activity_log."""
    execute(
        """
        INSERT INTO user_activity_log (user_id, action, table_name, record_id, description)
        VALUES (%s, %s, %s, %s, %s)
        """,
        (user_id, action, table_name, record_id, description),
    )


@bp.put("/learners/<int:learner_id>/module-batches/<int:batch_id>")
@role_required("teacher")
def edit_module_batch(learner_id: int, batch_id: int):
    """Correct a previously-encoded release batch: the batch's Release Date,
    and per module within it, Module Name / Learning Strand / Return Date /
    Remarks. Teachers use this to fix typos and mis-encoded dates -- not to
    delete history, so every applied field change is written to
    user_activity_log before being applied (see _audit above)."""
    base = _profile_base(learner_id)
    if not base:
        return error("Learner not found.", 404)
    teacher = _teacher_scope()
    user_id = current_user_id()

    batch = fetch_one(
        "SELECT release_batch_id, release_date FROM module_release_batch WHERE release_batch_id=%s AND enrollment_id=%s",
        (batch_id, base["enrollment_id"]),
    )
    if not batch:
        return error("Release batch not found.", 404)

    data = request.get_json(silent=True) or {}
    today = date.today()

    new_release_date = batch["release_date"]
    if "releaseDate" in data and data.get("releaseDate") not in (None, ""):
        try:
            new_release_date = date.fromisoformat(str(data.get("releaseDate")))
        except ValueError:
            return error("Release date must use YYYY-MM-DD.", 422)
        if new_release_date > today:
            return error("Release date cannot be later than the current date.", 422)

    existing_modules = fetch_all(
        """
        SELECT module_record_id, module_name, learning_strand_id, date_returned, remarks
        FROM module_record WHERE release_batch_id=%s
        """,
        (batch_id,),
    )
    existing_by_id = {m["module_record_id"]: m for m in existing_modules}

    module_edits_in = data.get("modules") or []
    if not isinstance(module_edits_in, list):
        return error("modules must be a list.", 422)

    planned: list[dict] = []
    strand_cache: dict[str, int] = {}
    for edit in module_edits_in:
        try:
            module_id = int(edit.get("id"))
        except (TypeError, ValueError):
            return error("Each module edit requires a valid id.", 422)
        current = existing_by_id.get(module_id)
        if not current:
            return error(f"Module {module_id} does not belong to this release batch.", 422)

        plan = {"id": module_id, "current": current}

        if "moduleName" in edit and edit.get("moduleName") is not None:
            name = str(edit["moduleName"]).strip()
            if not name:
                return error("Module name cannot be blank.", 422)
            plan["module_name"] = name

        if "strandCode" in edit and edit.get("strandCode") is not None:
            code = str(edit["strandCode"]).strip().upper()
            if code not in strand_cache:
                strand_row = fetch_one("SELECT learning_strand_id FROM learning_strand WHERE strand_code=%s", (code,))
                if not strand_row:
                    return error(f"Unknown learning strand: {code}.", 422)
                strand_cache[code] = strand_row["learning_strand_id"]
            plan["learning_strand_id"] = strand_cache[code]

        if "remarks" in edit:
            plan["remarks"] = (str(edit["remarks"]).strip() or None) if edit.get("remarks") is not None else None

        if "returnDate" in edit:
            raw = edit.get("returnDate")
            if raw in (None, ""):
                plan["date_returned"] = None
            else:
                try:
                    plan["date_returned"] = date.fromisoformat(str(raw))
                except ValueError:
                    return error("Return date must use YYYY-MM-DD.", 422)

        planned.append(plan)

    # Validate the resulting state of every module in the batch (not just the
    # edited ones) against the *effective* release date, so an edit can never
    # save a batch into an inconsistent state.
    planned_by_id = {p["id"]: p for p in planned}
    for module_id, current in existing_by_id.items():
        plan = planned_by_id.get(module_id, {})
        effective_return = plan["date_returned"] if "date_returned" in plan else current["date_returned"]
        if effective_return is None:
            continue
        if effective_return > today:
            return error("Return date cannot be later than the current date.", 422)
        if effective_return < new_release_date:
            return error("Return date cannot be earlier than the module release date.", 422)

    db = get_db()
    try:
        with db.cursor() as cur:
            if new_release_date != batch["release_date"]:
                _audit(
                    user_id, "MODULE_BATCH_EDIT", "module_release_batch", batch_id,
                    f"release_date: {batch['release_date'].isoformat()} -> {new_release_date.isoformat()}",
                )
                cur.execute(
                    "UPDATE module_release_batch SET release_date=%s WHERE release_batch_id=%s",
                    (new_release_date, batch_id),
                )
                cur.execute(
                    "UPDATE module_record SET date_released=%s WHERE release_batch_id=%s",
                    (new_release_date, batch_id),
                )

            for plan in planned:
                current = plan["current"]
                sets, params, changes = [], [], []

                if "module_name" in plan and plan["module_name"] != current["module_name"]:
                    sets.append("module_name=%s")
                    params.append(plan["module_name"])
                    changes.append(f"module_name: {current['module_name']!r} -> {plan['module_name']!r}")

                if "learning_strand_id" in plan and plan["learning_strand_id"] != current["learning_strand_id"]:
                    sets.append("learning_strand_id=%s")
                    params.append(plan["learning_strand_id"])
                    changes.append(f"learning_strand_id: {current['learning_strand_id']} -> {plan['learning_strand_id']}")

                if "remarks" in plan and plan["remarks"] != current["remarks"]:
                    sets.append("remarks=%s")
                    params.append(plan["remarks"])
                    changes.append("remarks updated")

                if "date_returned" in plan and plan["date_returned"] != current["date_returned"]:
                    sets.append("date_returned=%s")
                    params.append(plan["date_returned"])
                    old_val = current["date_returned"].isoformat() if current["date_returned"] else "none"
                    new_val = plan["date_returned"].isoformat() if plan["date_returned"] else "none"
                    changes.append(f"date_returned: {old_val} -> {new_val}")

                if not sets:
                    continue

                for change in changes:
                    _audit(user_id, "MODULE_RECORD_EDIT", "module_record", plan["id"], change)

                params.append(plan["id"])
                cur.execute(f"UPDATE module_record SET {', '.join(sets)} WHERE module_record_id=%s", params)
        db.commit()
    except Exception:
        db.rollback()
        raise

    try:
        trigger_prediction(base["enrollment_id"], current_user_id())
    except Exception:
        pass

    base = _profile_base(learner_id)
    learner_activity = _learner_activity_info(base)
    return {
        "message": "Release batch updated.",
        "learner": {
            "name": f"{base['first_name']} {base['last_name']}",
            "lrn": base["lrn"],
            "clc": base["clc_name"],
            "level": base["learning_level"],
            **learner_activity,
        },
        **_logbook(base["enrollment_id"], learner_activity),
    }


CONTACT_METHODS = {"CALL", "SMS", "CHAT", "HOME_VISIT", "OTHER"}
CONTACT_RESULTS = {"SUCCESSFUL", "UNSUCCESSFUL"}


@bp.post("/learners/<int:learner_id>/consultations")
@role_required("teacher")
def record_consultation(learner_id: int):
    base = _profile_base(learner_id)
    if not base:
        return error("Learner not found.", 404)
    teacher = _teacher_scope()

    data = request.get_json(silent=True) or {}

    try:
        contact_date = date.fromisoformat(str(data.get("date"))) if data.get("date") else date.today()
    except ValueError:
        return error("Consultation date must use YYYY-MM-DD.", 422)

    method = str(data.get("method") or "").strip().upper()
    result = str(data.get("result") or "").strip().upper()
    if method not in CONTACT_METHODS:
        return error(f"Method must be one of: {', '.join(sorted(CONTACT_METHODS))}.", 422)
    if result not in CONTACT_RESULTS:
        return error(f"Result must be one of: {', '.join(sorted(CONTACT_RESULTS))}.", 422)

    notes = (data.get("notes") or "").strip() or None

    execute(
        """
        INSERT INTO contact_log (enrollment_id, contact_date, contact_method, contact_result, notes, recorded_by_teacher_id)
        VALUES (%s, %s, %s, %s, %s, %s)
        """,
        (base["enrollment_id"], contact_date, method, result, notes, teacher["teacher_id"]),
    )

    try:
        trigger_prediction(base["enrollment_id"], current_user_id())
    except Exception:
        pass

    return {"message": "Consultation recorded."}, 201


def _read_upload(file_storage):
    # dtype=str keeps numeric-looking columns (LRN, contact numbers) as the
    # exact text in the file -- otherwise pandas infers them as integers and
    # silently drops leading zeros (e.g. "09171112222" -> "9171112222").
    name = (file_storage.filename or "").lower()
    raw = file_storage.read()
    if name.endswith(".csv"):
        return pd.read_csv(BytesIO(raw), dtype=str)
    if name.endswith(".xlsx") or name.endswith(".xls"):
        return pd.read_excel(BytesIO(raw), dtype=str)
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
        "re-enrollee_(yes/no)": "re_enrollee", "re-enrollee": "re_enrollee",
        "distance_from_clc_(km)": "distance_from_clc_km",
        "civil_status_(if_applicable)": "civil_status",
        "guardian_contact_number_(if_applicable)": "guardian_contact_number",
        "middle_name_(optional)": "middle_name",
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


def _parse_import_bool(value):
    return str(value or "").strip().lower() in {"yes", "y", "true", "1"}


def _parse_import_distance(value):
    try:
        return float(value) if value not in (None, "") else None
    except (TypeError, ValueError):
        return None


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


def _insert_import_rows(rows, teacher, class_id=None):
    class_row = None
    if class_id:
        class_row = fetch_one(
            """
            SELECT lc.*, c.clc_name
            FROM learning_class lc
            JOIN clc c ON c.clc_id = lc.clc_id
            WHERE lc.class_id = %s AND lc.teacher_id = %s AND lc.status = 'ACTIVE'
            """,
            (class_id, teacher["teacher_id"]),
        )
    if not class_row:
        class_row = _active_class(teacher["teacher_id"])
    if not class_row:
        raise ValueError("Create an active class before importing learners.")
    preview = _preview_rows(rows)
    valid = [r for r in preview if r["status"] == "valid"]
    duplicates = [r for r in preview if r["status"] == "duplicate"]
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
                    INSERT INTO learner (
                        lrn, first_name, middle_name, last_name, sex, date_of_birth,
                        employment_status, civil_status, contact_number, guardian_contact_number
                    )
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING learner_id
                    """,
                    (
                        row["lrn"], first, row.get("middle_name") or None, last, sex, dob,
                        row.get("employment_status") or None,
                        row.get("civil_status") or None,
                        row.get("contact_number") or None,
                        row.get("guardian_contact_number") or None,
                    ),
                )
                learner_id = cur.fetchone()["learner_id"]
                cur.execute(
                    """
                    INSERT INTO class_enrollment (
                        class_id, learner_id, learning_modality, is_re_enrollee,
                        distance_from_clc_km, enrollment_status
                    )
                    VALUES (%s,%s,%s,%s,%s,'ENROLLED')
                    """,
                    (
                        class_row["class_id"], learner_id, enum_modality(row.get("modality")),
                        _parse_import_bool(row.get("re_enrollee")),
                        _parse_import_distance(row.get("distance_from_clc_km")),
                    ),
                )
                imported.append({"lrn": row["lrn"], "name": name, "level": row.get("level") or "Basic Literacy"})

            # Duplicates (LRN already exists) are bypassed, not skipped: the
            # matching existing learner is attached to this class rather than
            # re-inserted, as long as they aren't already enrolled in it.
            duplicates = [r for r in preview if r["status"] == "duplicate"]
            attached = 0
            for row in duplicates:
                cur.execute("SELECT learner_id FROM learner WHERE lrn=%s", (row["lrn"],))
                existing = cur.fetchone()
                if not existing:
                    continue
                cur.execute(
                    "SELECT enrollment_id FROM class_enrollment WHERE class_id=%s AND learner_id=%s",
                    (class_row["class_id"], existing["learner_id"]),
                )
                if cur.fetchone():
                    continue
                cur.execute(
                    """
                    INSERT INTO class_enrollment (
                        class_id, learner_id, learning_modality, is_re_enrollee,
                        distance_from_clc_km, enrollment_status
                    )
                    VALUES (%s,%s,%s,%s,%s,'ENROLLED')
                    """,
                    (
                        class_row["class_id"], existing["learner_id"], enum_modality(row.get("modality")),
                        _parse_import_bool(row.get("re_enrollee")) if row.get("re_enrollee") is not None else True,
                        _parse_import_distance(row.get("distance_from_clc_km")),
                    ),
                )
                attached += 1

            summary = {
                "total": len(preview),
                "imported": len(imported),
                "attached": attached,
                "duplicates": len(duplicates),
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
            class_id = request.form.get("class_id") or request.form.get("class")
        else:
            data = request.get_json(silent=True) or {}
            rows = data.get("learners") or []
            class_id = data.get("class_id") or data.get("class")
        if not rows:
            return error("No learner rows were provided.", 422)
        summary = _insert_import_rows(rows, teacher, class_id=class_id)
    except ValueError as exc:
        return error(str(exc), 422)
    return {
        "message": "Learners imported successfully.",
        "imported": summary["imported"],
        "attached": summary["attached"],
        "skipped": summary["invalid"],
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
