from __future__ import annotations

from datetime import date

from ..db import fetch_one
from ..helpers import title_enum

ACTIVITY_WARNING_DAYS = 21
ACTIVITY_DANGER_DAYS = 30


def _module_totals(enrollment_id: int) -> dict:
    """Single source of truth for module counts -- the Module Release Logbook,
    Learner Records table, and Learner Profile must never each compute their
    own answer to "how many modules has this learner been released/returned."
    """
    row = fetch_one(
        """
        SELECT
            COUNT(*) AS released,
            COUNT(*) FILTER (WHERE date_returned IS NOT NULL) AS returned,
            MAX(date_returned) AS last_returned
        FROM module_record
        WHERE enrollment_id = %s
        """,
        (enrollment_id,),
    ) or {}
    released = int(row.get("released") or 0)
    returned = int(row.get("returned") or 0)
    return {
        "released": released,
        "returned": returned,
        "active": max(released - returned, 0),
        "last_returned": row.get("last_returned"),
    }


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


def _relative_day_phrase(days: int) -> str:
    if days <= 0:
        return "today"
    if days == 1:
        return "yesterday"
    return f"{days} days ago"


def _shape_activity(row):
    """Build the learner's latest activity from actual recorded event dates.

    Sources:
      - Module release -> module_release_batch.release_date
      - Module return  -> module_record.date_returned
      - Consultation   -> contact_log.contact_date

    Do not use created_at, updated_at, or record-save timestamps.
    """
    # No released module means monitoring hasn't started yet.
    if not row.get("batch_count"):
        return "No modules released yet", "none", 0

    modality_raw = row.get("learning_modality") or ""

    # ITEM 2 FIX:
    # Never allow a missing event label to render as "undefined".
    # The query normally supplies Module released / Module returned /
    # Consultation completed, but this fallback keeps the UI readable
    # for incomplete/imported data.
    event_label = row.get("event_label") or "Learner activity"
    event_date = row.get("event_date")
    enrollment_date = row.get("enrollment_date")

    # The SQL query already determines the newest actual activity date.
    reference_date = event_date or enrollment_date

    # Never allow a negative inactivity value.
    days_inactive = (
        max(0, (date.today() - reference_date).days) if reference_date else 0
    )

    # Show the actual latest activity while it's within the warning window.
    if event_date is not None and days_inactive < ACTIVITY_WARNING_DAYS:
        activity_text = f"{event_label} {_relative_day_phrase(days_inactive)}"
    else:
        primary_noun = (
            "consultation" if modality_raw == "FACE_TO_FACE" else "module return"
        )
        if days_inactive > 0:
            day_word = "day" if days_inactive == 1 else "days"
            activity_text = f"No {primary_noun} for {days_inactive} {day_word}"
        else:
            activity_text = "No activity recorded"

    if days_inactive >= ACTIVITY_DANGER_DAYS:
        activity_status = "danger"
    elif days_inactive >= ACTIVITY_WARNING_DAYS:
        activity_status = "warning"
    else:
        activity_status = "ok"

    return activity_text, activity_status, days_inactive


def _shape_learner(row):
    first = row.get("first_name") or ""
    last = row.get("last_name") or ""
    risk_level = row.get("risk_level")
    monitoring_started = bool(row.get("batch_count"))
    risk = title_enum(risk_level) if risk_level and monitoring_started else "Not Yet Assessed"
    probability = float(row.get("risk_probability") or 0) if monitoring_started else 0.0
    activity_text, activity_status, days_inactive = _shape_activity(row)
    return {
        "id": row["learner_id"],
        "lrn": row["lrn"],
        "first_name": first,
        "last_name": last,
        "name": f"{first} {last}".strip(),
        "sex": str(row.get("sex") or "").title(),
        "age": int(row.get("age") or 0),
        "birthdate": row["date_of_birth"].isoformat() if row.get("date_of_birth") else None,
        "civil_status": row.get("civil_status") or "",
        "contact_number": row.get("contact_number") or "",
        "guardian_contact_number": row.get("guardian_contact_number") or "",
        "employment_status": row.get("employment_status") or "",
        "email": row.get("email") or "",
        "address": row.get("address") or "",
        "guardian_name": row.get("guardian_name") or "",
        "guardian_relationship": row.get("guardian_relationship") or "",
        "last_grade_completed": row.get("last_grade_completed") or "",
        "is_4ps_beneficiary": bool(row.get("is_4ps_beneficiary")),
        "level": title_enum(row.get("learning_level")),
        "section": row.get("class_name") or "A",
        "modality": title_enum(row.get("learning_modality")),
        "clc": row.get("clc_name") or "",
        "status": title_enum(row.get("enrollment_status")),
        "risk": risk,
        "risk_probability": probability,
        "activity_text": activity_text,
        "activity_status": activity_status,
        "days_inactive": days_inactive,
        "distance_km": float(row.get("distance_from_clc_km") or 0),
        "date_generated": row["assessment_date"].isoformat() if row.get("assessment_date") else None,
        "assigned_teacher": row.get("assigned_teacher") or "",
        "birthdate": row["date_of_birth"].isoformat() if row.get("date_of_birth") else None,
        "civil_status": row.get("civil_status") or "",
        "contact_number": row.get("contact_number") or "",
        "email": row.get("email") or "",
        "address": row.get("address") or "",
        "guardian_name": row.get("guardian_name") or "",
        "guardian_relationship": row.get("guardian_relationship") or "",
        "guardian_contact_number": row.get("guardian_contact_number") or "",
        "employment_status": row.get("employment_status") or "",
        "last_grade_completed": row.get("last_grade_completed") or "",
        "is_4ps_beneficiary": bool(row.get("is_4ps_beneficiary")),
        "school_year": row.get("school_year") or "",
    }


def _learner_query(
    where: str = "",
    order: str = "l.last_name, l.first_name",
):
    return f"""
        SELECT
            l.learner_id, l.lrn, l.first_name, l.last_name, l.sex,
            DATE_PART('year', AGE(CURRENT_DATE, l.date_of_birth))::INT AS age,
            l.date_of_birth, l.employment_status, l.civil_status,
            l.contact_number, l.guardian_contact_number, l.is_4ps_beneficiary,
            l.email, l.address, l.guardian_name, l.guardian_relationship, l.last_grade_completed,
            ce.enrollment_id, ce.learning_modality, ce.distance_from_clc_km,
            ce.enrollment_status, ce.is_re_enrollee, ce.enrollment_date,
            lc.class_id, lc.learning_level, lc.class_name, lc.school_year, lc.semester,
            lc.teacher_id, c.clc_id, c.clc_name,
            CONCAT_WS(' ', t.first_name, t.last_name) AS assigned_teacher,
            risk.risk_assessment_id, risk.risk_probability, risk.risk_level, risk.assessment_date,
            0 AS assessment_avg,
            latest_event.event_label, latest_event.event_date,
            (SELECT COUNT(*) FROM module_release_batch mrb WHERE mrb.enrollment_id = ce.enrollment_id) AS batch_count
        FROM learner l
        JOIN class_enrollment ce ON ce.learner_id = l.learner_id
        JOIN learning_class lc ON lc.class_id = ce.class_id
        JOIN clc c ON c.clc_id = lc.clc_id
        JOIN teacher t ON t.teacher_id = lc.teacher_id
        {_latest_risk_join_sql()}
        LEFT JOIN LATERAL (
            SELECT event_label, event_date FROM (
                -- Newest of: module release, module return, consultation.
                -- Priority 1 beats priority 2 on same-date ties.
                SELECT 'Module released' AS event_label, MAX(mrb.release_date) AS event_date, 2 AS priority
                FROM module_release_batch mrb
                WHERE mrb.enrollment_id = ce.enrollment_id
                HAVING MAX(mrb.release_date) IS NOT NULL
                UNION ALL
                SELECT 'Module returned', MAX(mr.date_returned), 1
                FROM module_record mr
                WHERE mr.enrollment_id = ce.enrollment_id AND mr.date_returned IS NOT NULL
                HAVING MAX(mr.date_returned) IS NOT NULL
                UNION ALL
                SELECT 'Consultation completed', MAX(cl.contact_date), 1
                FROM contact_log cl
                WHERE cl.enrollment_id = ce.enrollment_id AND cl.contact_result = 'SUCCESSFUL'
                  AND ce.learning_modality IN ('FACE_TO_FACE', 'BLENDED')
                HAVING MAX(cl.contact_date) IS NOT NULL
            ) events
            ORDER BY event_date DESC, priority ASC
            LIMIT 1
        ) latest_event ON TRUE
        {where}
        ORDER BY {order}
    """
