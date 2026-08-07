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
    # Monitoring hasn't started at all until a module batch has been released
    # -- the same signal _shape_learner uses to gate the risk badge to "Not
    # Yet Assessed". Without this, a learner with zero released modules falls
    # back to days-since-enrollment and gets told a module return is overdue,
    # even though there was never a module to return in the first place.
    if not row.get("batch_count"):
        return "No modules released yet", "none", 0

    # Inactivity is always measured from the single most recent valid activity
    # of any kind (release, return, or consultation -- whichever is newest),
    # falling back to the enrollment date only when nothing has ever happened.
    # A prior version measured the fallback text's day-count from a
    # "primary event" (return-only) instead of this same reference, which let
    # a fresh module release with zero returns fall back to days-since-
    # enrollment for its inactivity count -- showing a batch released weeks
    # ago as "1 day ago" whenever the learner happened to enroll recently.
    modality_raw = row.get("learning_modality") or ""
    event_label = row.get("event_label")
    event_date = row.get("event_date")
    reference_date = event_date or row.get("enrollment_date")

    # Inactivity can never be negative -- a saved activity date shouldn't ever
    # land in the future, but clamp defensively rather than ever surface a
    # value like "-26 days inactive" if one somehow does (bad data entry,
    # clock skew, etc).
    days_inactive = max(0, (date.today() - reference_date).days) if reference_date else 0

    if event_date is not None and days_inactive < ACTIVITY_WARNING_DAYS:
        activity_text = f"{event_label} {_relative_day_phrase(days_inactive)}"
    else:
        primary_noun = "consultation" if modality_raw == "FACE_TO_FACE" else "module return"
        day_word = "day" if days_inactive == 1 else "days"
        activity_text = (
            f"No {primary_noun} for {days_inactive} {day_word}" if days_inactive > 0 else "No activity recorded"
        )

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
    }


def _learner_query(where: str = "", order: str = "l.last_name, l.first_name"):
    return f"""
        SELECT
            l.learner_id, l.lrn, l.first_name, l.last_name, l.sex,
            DATE_PART('year', AGE(CURRENT_DATE, l.date_of_birth))::INT AS age,
            l.date_of_birth, l.employment_status, l.civil_status,
            l.contact_number, l.guardian_contact_number, l.is_4ps_beneficiary,
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
                SELECT 'Modules released' AS event_label, MAX(mr.date_released) AS event_date, 2 AS priority
                FROM module_record mr
                WHERE mr.enrollment_id = ce.enrollment_id
                  AND ce.learning_modality IN ('MODULAR', 'BLENDED')
                GROUP BY event_label
                HAVING MAX(mr.date_released) IS NOT NULL
                UNION ALL
                SELECT 'Module returned', MAX(mr.date_returned), 1
                FROM module_record mr
                WHERE mr.enrollment_id = ce.enrollment_id AND mr.date_returned IS NOT NULL
                GROUP BY 1
                HAVING MAX(mr.date_returned) IS NOT NULL
                UNION ALL
                SELECT 'Consultation completed', MAX(cl.contact_date), 1
                FROM contact_log cl
                WHERE cl.enrollment_id = ce.enrollment_id AND cl.contact_result = 'SUCCESSFUL'
                  AND ce.learning_modality IN ('FACE_TO_FACE', 'BLENDED')
                GROUP BY 1
                HAVING MAX(cl.contact_date) IS NOT NULL
            ) events
            ORDER BY event_date DESC, priority ASC
            LIMIT 1
        ) latest_event ON TRUE
        {where}
        ORDER BY {order}
    """
