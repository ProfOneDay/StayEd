"""Fills in the operational tables seed_demo.py never touches (sessions,
attendance, contact logs, modality changes, follow-ups, extra interventions,
teacher report submissions, assessment scores, and a couple more admin
accounts) so every page in the frontend has something real to show instead
of an empty state. Idempotent like seed_demo.py -- safe to re-run.
"""
from __future__ import annotations

import json
import os
import random
from datetime import date, timedelta, time

import psycopg
from psycopg.rows import dict_row
from dotenv import load_dotenv
from werkzeug.security import generate_password_hash

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:StayEd2026DB@127.0.0.1:5433/stayed_db")

random.seed(42)

TEACHER_ID = 1
TEACHER_USER_ID = 1
CLASS_ID = 1

SESSION_TOPICS = [
    "Module 1 review: Reading comprehension",
    "Numeracy skills workshop",
    "Life skills session: Budgeting basics",
    "Module 2 review: Filipino literacy",
    "Group activity: Community mapping",
    "Numeracy skills workshop (cont.)",
    "Module 3 review: Science concepts",
    "Learner check-in and recap",
]
UPCOMING_TOPICS = [
    "Module 4 preview: Civic awareness",
    "Mid-quarter learner conference",
]

CONTACT_METHODS = ["CALL", "SMS", "HOME_VISIT", "CHAT"]

MODALITIES = ["FACE_TO_FACE", "MODULAR", "BLENDED"]

ASSESSMENT_SCORE_ROW_IDS = (
    "pis", "abl_neo", "abl_post",
    "flt_ls1_en_mc", "flt_ls1_en_writing", "flt_ls1_en_listening",
    "flt_ls1_fil_mc", "flt_ls1_fil_writing", "flt_ls1_fil_listening",
    "flt_ls2", "flt_ls3", "flt_ls4", "flt_ls5", "flt_ls6",
)
ASSESSMENT_PORTFOLIO_FIELD_IDS = (
    "ls1_en", "ls1_fil", "ls2", "ls3", "ls4", "ls5", "ls6",
    "revalida_oral_reading", "revalida_writing", "revalida_interview",
)

# New interventions: (enrollment_id, type, status, days_ago_assigned, target_in_days, completed)
NEW_INTERVENTIONS = [
    (14, "Home Visit", "ONGOING", 10, 7, False),
    (16, "Parent/Guardian Conference", "COMPLETED", 20, 10, True),
    (18, "Referral", "PLANNED", 2, 7, False),
    (20, "Consultation", "ONGOING", 6, 5, False),
    (13, "Learner Follow-up", "COMPLETED", 25, 14, True),
    (15, "Home Visit", "CANCELLED", 15, 7, False),
    (19, "Parent/Guardian Conference", "PLANNED", 1, 7, False),
    (17, "Consultation", "ONGOING", 8, 6, False),
]

REPORT_SUBMISSIONS = [
    (1, "AT_RISK", "Weekly At-Risk Learner Summary", "Basic Literacy Program - A, Week of Oct 5", "REVIEWED"),
    (1, "ATTENDANCE", "October Attendance Report", "Basic Literacy Program - A", "UNREVIEWED"),
    (3, "LEARNER_PROGRESS", "Learner Progress Update", "Nancamaliran CLC class", "UNREVIEWED"),
    (4, "CLASS_LIST", "Current Class List", "Alacan CLC class", "REVIEWED"),
    (1, "INTERVENTION", "Intervention Status Report", "Basic Literacy Program - A", "UNREVIEWED"),
]


def main():
    with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:
        with conn.cursor() as cur:
            # ---------------------------------------------------------
            # 0. Two more admin accounts, so Manage Admins has more than
            #    a single super admin to test toggles/permissions against.
            # ---------------------------------------------------------
            cur.execute(
                """
                INSERT INTO users (username, password_hash, email, role, account_status,
                                    first_name, last_name, is_super_admin, can_manage_clcs,
                                    can_manage_users, admin_title)
                VALUES ('jonalynpascual', %s, 'jonalynpascual@deped.gov.ph', 'ADMIN', 'ACTIVE',
                        'Jonalyn', 'Pascual', FALSE, TRUE, FALSE, 'CLC Coordinator')
                ON CONFLICT (username) DO UPDATE
                SET role='ADMIN', account_status='ACTIVE', is_super_admin=FALSE,
                    can_manage_clcs=TRUE, can_manage_users=FALSE, admin_title='CLC Coordinator'
                """,
                (generate_password_hash("12345678"),),
            )
            cur.execute(
                """
                INSERT INTO users (username, password_hash, email, role, account_status,
                                    first_name, last_name, is_super_admin, can_manage_clcs,
                                    can_manage_users, admin_title)
                VALUES ('noelvillaruel', %s, 'noelvillaruel@deped.gov.ph', 'ADMIN', 'ACTIVE',
                        'Noel', 'Villaruel', TRUE, TRUE, TRUE, 'Division Supervisor')
                ON CONFLICT (username) DO UPDATE
                SET role='ADMIN', account_status='ACTIVE', is_super_admin=TRUE,
                    can_manage_clcs=TRUE, can_manage_users=TRUE, admin_title='Division Supervisor'
                """,
                (generate_password_hash("12345678"),),
            )

            # ---------------------------------------------------------
            # 1. Enrollments in the main demo class, with their latest
            #    risk probability (drives attendance/contact/intervention
            #    realism below).
            # ---------------------------------------------------------
            cur.execute(
                """
                SELECT ce.enrollment_id, ce.learner_id, l.first_name, l.last_name,
                       ra.risk_probability
                FROM class_enrollment ce
                JOIN learner l ON l.learner_id = ce.learner_id
                LEFT JOIN LATERAL (
                    SELECT risk_probability FROM risk_assessment
                    WHERE enrollment_id = ce.enrollment_id
                    ORDER BY assessment_date DESC LIMIT 1
                ) ra ON TRUE
                WHERE ce.class_id = %s AND ce.enrollment_status = 'ENROLLED'
                  AND ra.risk_probability IS NOT NULL
                ORDER BY ce.enrollment_id
                """,
                (CLASS_ID,),
            )
            enrollments = cur.fetchall()
            high_risk = [r for r in enrollments if float(r["risk_probability"]) >= 0.60]

            # ---------------------------------------------------------
            # 2. class_session: 8 past (COMPLETED) + 2 upcoming (SCHEDULED).
            # ---------------------------------------------------------
            today = date.today()
            past_dates = [today - timedelta(days=d) for d in (28, 24, 21, 17, 14, 10, 7, 3)]
            session_ids = {}
            for d, topic in zip(past_dates, SESSION_TOPICS):
                cur.execute(
                    """
                    INSERT INTO class_session (class_id, session_date, session_topic, session_status, created_by_teacher_id)
                    SELECT %s,%s,%s,'COMPLETED',%s
                    WHERE NOT EXISTS (SELECT 1 FROM class_session WHERE class_id=%s AND session_date=%s)
                    RETURNING session_id
                    """,
                    (CLASS_ID, d, topic, TEACHER_ID, CLASS_ID, d),
                )
                row = cur.fetchone()
                if not row:
                    cur.execute(
                        "SELECT session_id FROM class_session WHERE class_id=%s AND session_date=%s",
                        (CLASS_ID, d),
                    )
                    row = cur.fetchone()
                session_ids[d] = row["session_id"]

            upcoming_dates = [today + timedelta(days=d) for d in (2, 5)]
            for d, topic in zip(upcoming_dates, UPCOMING_TOPICS):
                cur.execute(
                    """
                    INSERT INTO class_session (class_id, session_date, session_topic, session_status, created_by_teacher_id)
                    SELECT %s,%s,%s,'SCHEDULED',%s
                    WHERE NOT EXISTS (SELECT 1 FROM class_session WHERE class_id=%s AND session_date=%s)
                    """,
                    (CLASS_ID, d, topic, TEACHER_ID, CLASS_ID, d),
                )

            # ---------------------------------------------------------
            # 3. session_attendance: one row per (completed session, enrolled
            #    learner), absence chance scaled by that learner's risk
            #    probability so high-risk learners visibly show patchier
            #    attendance.
            # ---------------------------------------------------------
            for d, session_id in session_ids.items():
                for r in enrollments:
                    prob = float(r["risk_probability"])
                    roll = random.random()
                    if roll < prob * 0.45:
                        status = "ABSENT"
                    elif roll < prob * 0.45 + 0.12:
                        status = "EXCUSED"
                    else:
                        status = "PRESENT"
                    cur.execute(
                        """
                        INSERT INTO session_attendance (session_id, enrollment_id, attendance_status, recorded_by_teacher_id)
                        VALUES (%s,%s,%s,%s)
                        ON CONFLICT (session_id, enrollment_id) DO NOTHING
                        """,
                        (session_id, r["enrollment_id"], status, TEACHER_ID),
                    )

            # ---------------------------------------------------------
            # 4. contact_log for the 8 highest-risk learners.
            # ---------------------------------------------------------
            for i, r in enumerate(sorted(high_risk, key=lambda x: -float(x["risk_probability"]))[:8]):
                contact_date = today - timedelta(days=4 + i * 2)
                method = CONTACT_METHODS[i % len(CONTACT_METHODS)]
                result = "SUCCESSFUL" if i % 3 != 0 else "UNSUCCESSFUL"
                notes = (
                    f"Discussed attendance and module pacing with {r['first_name']} {r['last_name']}'s guardian."
                    if result == "SUCCESSFUL"
                    else f"Attempted to reach {r['first_name']} {r['last_name']}'s guardian; no response, will retry."
                )
                cur.execute(
                    """
                    INSERT INTO contact_log (enrollment_id, contact_date, contact_method, contact_result, notes, recorded_by_teacher_id)
                    SELECT %s,%s,%s,%s,%s,%s
                    WHERE NOT EXISTS (
                        SELECT 1 FROM contact_log WHERE enrollment_id=%s AND contact_date=%s
                    )
                    """,
                    (r["enrollment_id"], contact_date, method, result, notes, TEACHER_ID,
                     r["enrollment_id"], contact_date),
                )

            # ---------------------------------------------------------
            # 5. modality_change_log for 5 learners.
            # ---------------------------------------------------------
            cur.execute(
                """
                SELECT enrollment_id, learning_modality FROM class_enrollment
                WHERE class_id=%s AND enrollment_status='ENROLLED'
                ORDER BY enrollment_id LIMIT 5
                """,
                (CLASS_ID,),
            )
            for i, r in enumerate(cur.fetchall()):
                current = r["learning_modality"]
                old = next(m for m in MODALITIES if m != current)
                change_date = today - timedelta(days=30 + i * 5)
                cur.execute(
                    """
                    INSERT INTO modality_change_log (enrollment_id, old_modality, new_modality, change_date, reason, changed_by_teacher_id)
                    SELECT %s,%s,%s,%s,%s,%s
                    WHERE NOT EXISTS (
                        SELECT 1 FROM modality_change_log WHERE enrollment_id=%s AND change_date=%s
                    )
                    """,
                    (r["enrollment_id"], old, current, change_date,
                     "Adjusted modality based on learner's distance from CLC and home situation.",
                     TEACHER_ID, r["enrollment_id"], change_date),
                )

            # ---------------------------------------------------------
            # 6. learner_session_schedule: upcoming check-ins for 6
            #    high-risk learners (one per enrollment, per the unique
            #    constraint -- mirrors "next scheduled session" in the UI).
            # ---------------------------------------------------------
            for i, r in enumerate(high_risk[:6]):
                sched_date = today + timedelta(days=1 + i)
                status = "ATTENDANCE_PENDING" if i == 0 else "SCHEDULED"
                cur.execute(
                    """
                    INSERT INTO learner_session_schedule (enrollment_id, session_date, session_time, schedule_status, note, recorded_by_teacher_id)
                    VALUES (%s,%s,%s,%s,%s,%s)
                    ON CONFLICT (enrollment_id) DO UPDATE
                    SET session_date=EXCLUDED.session_date, schedule_status=EXCLUDED.schedule_status
                    """,
                    (r["enrollment_id"], sched_date, time(9, 0), status,
                     "Follow-up check-in on attendance and module progress.", TEACHER_ID),
                )

            # ---------------------------------------------------------
            # 7. More interventions (varied statuses) + follow_up notes
            #    for the ones that are ONGOING/COMPLETED.
            # ---------------------------------------------------------
            new_intervention_ids = []
            for enrollment_id, itype, status, days_ago, target_days, completed in NEW_INTERVENTIONS:
                cur.execute(
                    "SELECT risk_assessment_id FROM risk_assessment WHERE enrollment_id=%s ORDER BY assessment_date DESC LIMIT 1",
                    (enrollment_id,),
                )
                row = cur.fetchone()
                if not row:
                    continue
                risk_id = row["risk_assessment_id"]
                cur.execute(
                    "SELECT 1 FROM intervention WHERE risk_assessment_id=%s AND intervention_type=%s",
                    (risk_id, itype),
                )
                if cur.fetchone():
                    continue
                assigned = today - timedelta(days=days_ago)
                target = assigned + timedelta(days=target_days)
                date_completed = assigned + timedelta(days=target_days - 1) if completed else None
                cur.execute(
                    """
                    INSERT INTO intervention (risk_assessment_id, assigned_to_teacher_id, intervention_type,
                                               description, date_assigned, target_date, date_completed, status)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
                    RETURNING intervention_id
                    """,
                    (risk_id, TEACHER_ID, itype,
                     f"{itype} for continued risk factors identified in the latest assessment.",
                     assigned, target, date_completed, status),
                )
                new_intervention_ids.append((cur.fetchone()["intervention_id"], status, assigned))

            for intervention_id, status, assigned in new_intervention_ids:
                if status not in ("ONGOING", "COMPLETED"):
                    continue
                follow_up_date = assigned + timedelta(days=4)
                outcome = "Positive response, attendance improving." if status == "COMPLETED" else "Partial progress, continuing to monitor."
                cur.execute(
                    """
                    INSERT INTO follow_up (intervention_id, follow_up_date, notes, outcome, created_by_user_id)
                    SELECT %s,%s,%s,%s,%s
                    WHERE NOT EXISTS (SELECT 1 FROM follow_up WHERE intervention_id=%s AND follow_up_date=%s)
                    """,
                    (intervention_id, follow_up_date,
                     "Checked in with learner and guardian on progress since the intervention was assigned.",
                     outcome, TEACHER_USER_ID, intervention_id, follow_up_date),
                )

            # ---------------------------------------------------------
            # 8. teacher_report_submission: a few reports across types
            #    and review statuses, for the admin review queue.
            # ---------------------------------------------------------
            for teacher_id, report_type, title, subtitle, status in REPORT_SUBMISSIONS:
                cur.execute(
                    "SELECT 1 FROM teacher_report_submission WHERE teacher_id=%s AND title=%s",
                    (teacher_id, title),
                )
                if cur.fetchone():
                    continue
                snapshot = json.dumps({
                    "meta": [
                        {"label": "Class", "value": "Basic Literacy Program - A"},
                        {"label": "School Year", "value": "2026-2027"},
                        {"label": "Generated", "value": today.strftime("%B %d, %Y")},
                    ],
                    "sections": [
                        {
                            "title": title,
                            "columns": ["Learner", "Risk Level", "Status"],
                            "rows": [
                                ["John Reyes", "High", "Ongoing intervention"],
                                ["Carlo Mendoza", "High", "Completed intervention"],
                                ["Maria Clara", "Moderate", "Monitoring"],
                            ],
                        }
                    ],
                })
                reviewed_at = "now()" if status == "REVIEWED" else "NULL"
                cur.execute(
                    f"""
                    INSERT INTO teacher_report_submission (teacher_id, report_type, title, subtitle, snapshot, status, reviewed_at, reviewed_by_user_id)
                    VALUES (%s,%s,%s,%s,%s::jsonb,%s,{reviewed_at},%s)
                    """,
                    (teacher_id, report_type, title, subtitle, snapshot, status,
                     2 if status == "REVIEWED" else None),
                )

            # ---------------------------------------------------------
            # 9. als_assessment_scores for 6 more class-1 learners.
            # ---------------------------------------------------------
            cur.execute("SELECT enrollment_id FROM als_assessment_scores")
            already = {r["enrollment_id"] for r in cur.fetchall()}
            candidates = [r["enrollment_id"] for r in enrollments if r["enrollment_id"] not in already][:6]
            for i, enrollment_id in enumerate(candidates):
                scores = {}
                for row_id in ASSESSMENT_SCORE_ROW_IDS:
                    has_data = random.random() > 0.25
                    pre = round(random.uniform(2, 6), 1) if has_data else None
                    post = round(random.uniform(5, 9.5), 1) if has_data else None
                    scores[row_id] = {"pre": pre, "post": post, "status": None, "likelihood": None}
                portfolio = {
                    field: (round(random.uniform(60, 95), 1) if random.random() > 0.3 else None)
                    for field in ASSESSMENT_PORTFOLIO_FIELD_IDS
                }
                cur.execute(
                    """
                    INSERT INTO als_assessment_scores (enrollment_id, date_of_assessment, scores, portfolio, updated_by_teacher_id)
                    VALUES (%s,%s,%s::jsonb,%s::jsonb,%s)
                    ON CONFLICT (enrollment_id) DO NOTHING
                    """,
                    (enrollment_id, today - timedelta(days=5 + i), json.dumps(scores), json.dumps(portfolio), TEACHER_ID),
                )

            # ---------------------------------------------------------
            # 10. A couple more notifications tying the new activity
            #     together (intervention + report-review queues).
            # ---------------------------------------------------------
            cur.execute(
                """
                INSERT INTO notification (user_id, notification_type, title, message, link)
                SELECT %s,'INTERVENTION','New interventions assigned','Several learners now have active or completed interventions to review.','../teacher/early-warning.html'
                WHERE NOT EXISTS (
                    SELECT 1 FROM notification WHERE user_id=%s AND title='New interventions assigned'
                )
                """,
                (TEACHER_USER_ID, TEACHER_USER_ID),
            )
            cur.execute(
                """
                INSERT INTO notification (user_id, notification_type, title, message, link)
                SELECT %s,'REPORT','New report submissions','Teachers have submitted reports awaiting review.','../admin/reports.html'
                WHERE NOT EXISTS (
                    SELECT 1 FROM notification WHERE user_id=%s AND title='New report submissions'
                )
                """,
                (2, 2),
            )

        conn.commit()

    print("Gap-fill seed complete.")
    print("Extra admins: jonalynpascual@deped.gov.ph / 12345678 (not super admin)")
    print("              noelvillaruel@deped.gov.ph / 12345678 (super admin)")


if __name__ == "__main__":
    main()
