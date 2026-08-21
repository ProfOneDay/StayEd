from __future__ import annotations

import os
from datetime import date, timedelta

import psycopg
from psycopg.rows import dict_row
from dotenv import load_dotenv
from werkzeug.security import generate_password_hash

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:StayEd2026DB@127.0.0.1:5433/stayed_db")

REFERENCE_CLCS = [
    ("Poblacion CLC", "Binalonan", "Poblacion", "Poblacion, Binalonan, Pangasinan"),
    ("San Felipe Sur CLC", "Binalonan", "San Felipe Sur", "San Felipe Sur, Binalonan, Pangasinan"),
    ("San Felipe Norte CLC", "Binalonan", "San Felipe Norte", "San Felipe Norte, Binalonan, Pangasinan"),
    ("Cabalitian CLC", "Binalonan", "Cabalitian", "Cabalitian, Binalonan, Pangasinan"),
    ("Alacan CLC", "Binalonan", "Alacan", "Alacan, Binalonan, Pangasinan"),
    ("Buenlag CLC", "Binalonan", "Buenlag", "Buenlag, Binalonan, Pangasinan"),
    ("Poblacion Manaoag CLC", "Manaoag", "Poblacion", "Poblacion, Manaoag, Pangasinan"),
    ("Pantal CLC", "Manaoag", "Pantal", "Pantal, Manaoag, Pangasinan"),
    ("Nancamaliran CLC", "Urdaneta City", "Nancamaliran", "Nancamaliran, Urdaneta City, Pangasinan"),
    ("Bactad CLC", "Urdaneta City", "Bactad", "Bactad, Urdaneta City, Pangasinan"),
]

LEARNERS = [
    ("100000000041", "Juan", "Santos", "MALE", "2009-03-14", "FACE_TO_FACE", 3.0, .82),
    ("100000000038", "Maria", "Clara", "FEMALE", "2007-07-21", "MODULAR", 8.0, .54),
    ("100000000102", "Ricardo", "Dalisay", "MALE", "2010-01-30", "BLENDED", 12.0, .19),
    ("100000000015", "Elena", "Torres", "FEMALE", "2008-09-02", "FACE_TO_FACE", 1.0, .48),
    ("100000000089", "Pedro", "Villa", "MALE", "2006-05-19", "MODULAR", 5.0, .22),
    ("100000000044", "Ana", "Batungbakal", "FEMALE", "2004-11-08", "FACE_TO_FACE", .5, .77),
    ("100000000051", "Miguel", "Reyes", "MALE", "2009-04-05", "BLENDED", 4.0, .14),
    ("100000000063", "Sofia", "Mendoza", "FEMALE", "2008-02-17", "MODULAR", 15.0, .51),
    ("100000000071", "Gabriel", "Lim", "MALE", "2007-12-23", "FACE_TO_FACE", 2.0, .24),
    ("100000000088", "Isabel", "Ramos", "FEMALE", "2005-06-11", "BLENDED", 9.0, .79),
    ("100000000094", "Diego", "Castro", "MALE", "2008-08-28", "MODULAR", 7.0, .49),
    ("100000000107", "Carmen", "Ocampo", "FEMALE", "2006-10-15", "FACE_TO_FACE", 3.0, .17),
]


def main():
    with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:
        with conn.cursor() as cur:
            # Demo users. Passwords are intentionally only for local development.
            cur.execute(
                """
                INSERT INTO users (username, password_hash, email, role, account_status)
                VALUES ('teacher', %s, 'teacher@stayed.com', 'TEACHER', 'ACTIVE')
                ON CONFLICT (username) DO UPDATE
                SET password_hash=EXCLUDED.password_hash, email=EXCLUDED.email,
                    role='TEACHER', account_status='ACTIVE'
                RETURNING user_id
                """,
                (generate_password_hash("12345678"),),
            )
            teacher_user_id = cur.fetchone()["user_id"]
            cur.execute(
                """
                INSERT INTO teacher (user_id, employee_id, first_name, last_name, municipality, status)
                VALUES (%s, 'ALS-TEACHER-001', 'Trisha', 'Santos', 'Binalonan', 'ACTIVE')
                ON CONFLICT (user_id) DO UPDATE
                SET first_name='Trisha', last_name='Santos', municipality='Binalonan', status='ACTIVE'
                RETURNING teacher_id
                """,
                (teacher_user_id,),
            )
            teacher_id = cur.fetchone()["teacher_id"]

            cur.execute(
                """
                INSERT INTO users (username, password_hash, email, role, account_status)
                VALUES ('admin', %s, 'admin@stayed.com', 'ADMIN', 'ACTIVE')
                ON CONFLICT (username) DO UPDATE
                SET password_hash=EXCLUDED.password_hash, email=EXCLUDED.email,
                    role='ADMIN', account_status='ACTIVE'
                RETURNING user_id
                """,
                (generate_password_hash("12345678"),),
            )
            admin_user_id = cur.fetchone()["user_id"]

            for clc_name, municipality, barangay, address in REFERENCE_CLCS:
                cur.execute(
                    """
                    INSERT INTO clc (clc_name, municipality, barangay, address, status)
                    SELECT %s, %s, %s, %s, 'ACTIVE'
                    WHERE NOT EXISTS (
                        SELECT 1 FROM clc
                        WHERE LOWER(clc_name) = LOWER(%s)
                          AND LOWER(municipality) = LOWER(%s)
                    )
                    """,
                    (clc_name, municipality, barangay, address, clc_name, municipality),
                )

            cur.execute(
                """
                SELECT clc_id FROM clc
                WHERE LOWER(clc_name) = LOWER('San Felipe Sur CLC')
                  AND LOWER(municipality) = LOWER('Binalonan')
                LIMIT 1
                """
            )
            clc_id = cur.fetchone()["clc_id"]

            cur.execute(
                """
                INSERT INTO teacher_clc (teacher_id, clc_id, school_year, assignment_status)
                VALUES (%s, %s, '2026-2027', 'ACTIVE')
                ON CONFLICT (teacher_id, clc_id, school_year)
                DO UPDATE SET assignment_status='ACTIVE'
                """,
                (teacher_id, clc_id),
            )

            cur.execute(
                """
                INSERT INTO learning_class (
                    teacher_id, clc_id, school_year, semester, learning_level, class_name, status
                ) VALUES (%s,%s,'2026-2027','FIRST','BLP','Basic Literacy Program - A','ACTIVE')
                ON CONFLICT DO NOTHING
                RETURNING class_id
                """,
                (teacher_id, clc_id),
            )
            row = cur.fetchone()
            if row:
                class_id = row["class_id"]
            else:
                cur.execute(
                    """
                    SELECT class_id FROM learning_class
                    WHERE teacher_id=%s AND clc_id=%s AND school_year='2026-2027'
                      AND semester='FIRST' AND learning_level='BLP'
                    ORDER BY class_id LIMIT 1
                    """,
                    (teacher_id, clc_id),
                )
                class_id = cur.fetchone()["class_id"]

            cur.execute(
                """
                INSERT INTO model_info (model_name, algorithm, model_version, training_date, model_status, description)
                VALUES ('StayEd Dropout Risk Classifier', 'Random Forest', 'rf-v1-demo', CURRENT_DATE, 'ACTIVE', 'Development/demo registry entry')
                ON CONFLICT (model_version) DO UPDATE SET model_status='ACTIVE', algorithm='Random Forest'
                RETURNING model_id
                """
            )
            model_id = cur.fetchone()["model_id"]

            monitoring_end = date.today()
            monitoring_start = monitoring_end - timedelta(days=30)

            enrollment_ids = []
            for lrn, first, last, sex, dob, modality, distance, probability in LEARNERS:
                cur.execute(
                    """
                    INSERT INTO learner (lrn, first_name, last_name, sex, date_of_birth)
                    VALUES (%s,%s,%s,%s,%s)
                    ON CONFLICT (lrn) DO UPDATE
                    SET first_name=EXCLUDED.first_name, last_name=EXCLUDED.last_name,
                        sex=EXCLUDED.sex, date_of_birth=EXCLUDED.date_of_birth
                    RETURNING learner_id
                    """,
                    (lrn, first, last, sex, dob),
                )
                learner_id = cur.fetchone()["learner_id"]
                cur.execute(
                    """
                    INSERT INTO class_enrollment (
                        class_id, learner_id, learning_modality, is_re_enrollee,
                        distance_from_clc_km, enrollment_status
                    ) VALUES (%s,%s,%s,FALSE,%s,'ENROLLED')
                    ON CONFLICT (class_id, learner_id) DO UPDATE
                    SET learning_modality=EXCLUDED.learning_modality,
                        distance_from_clc_km=EXCLUDED.distance_from_clc_km,
                        enrollment_status='ENROLLED'
                    RETURNING enrollment_id
                    """,
                    (class_id, learner_id, modality, distance),
                )
                enrollment_id = cur.fetchone()["enrollment_id"]
                enrollment_ids.append((enrollment_id, first + " " + last, probability))
                cur.execute(
                    """
                    INSERT INTO risk_assessment (
                        model_id, enrollment_id, monitoring_start_date, monitoring_end_date,
                        data_sufficiency_status, risk_probability, generated_by_user_id
                    ) VALUES (%s,%s,%s,%s,'PREDICTION_GENERATED',%s,%s)
                    ON CONFLICT (model_id, enrollment_id, monitoring_start_date, monitoring_end_date)
                    DO UPDATE SET data_sufficiency_status='PREDICTION_GENERATED',
                                  risk_probability=EXCLUDED.risk_probability,
                                  generated_by_user_id=EXCLUDED.generated_by_user_id
                    RETURNING risk_assessment_id
                    """,
                    (model_id, enrollment_id, monitoring_start, monitoring_end, probability, teacher_user_id),
                )
                risk_id = cur.fetchone()["risk_assessment_id"]

                attendance_factor = max(0.0, min(1.0, probability))
                cur.execute(
                    """
                    INSERT INTO risk_factors (risk_assessment_id, factor_name, factor_value, importance_score)
                    VALUES (%s,'attendance_risk',%s,0.65)
                    ON CONFLICT (risk_assessment_id, factor_name)
                    DO UPDATE SET factor_value=EXCLUDED.factor_value, importance_score=EXCLUDED.importance_score
                    """,
                    (risk_id, round(attendance_factor * 100, 2)),
                )

            # Interventions for highest-risk learners.
            for enrollment_id, learner_name, probability in enrollment_ids:
                if probability < .70:
                    continue
                cur.execute(
                    "SELECT risk_assessment_id FROM risk_assessment WHERE enrollment_id=%s ORDER BY assessment_date DESC LIMIT 1",
                    (enrollment_id,),
                )
                risk_id = cur.fetchone()["risk_assessment_id"]
                cur.execute(
                    """
                    INSERT INTO intervention (
                        risk_assessment_id, assigned_to_teacher_id, intervention_type,
                        description, target_date, status
                    )
                    SELECT %s,%s,'Learner Follow-up','Schedule learner contact and review attendance/module barriers',CURRENT_DATE + 7,'PLANNED'
                    WHERE NOT EXISTS (
                        SELECT 1 FROM intervention WHERE risk_assessment_id=%s AND intervention_type='Learner Follow-up'
                    )
                    """,
                    (risk_id, teacher_id, risk_id),
                )

            cur.execute(
                """
                INSERT INTO notification (user_id, notification_type, title, message, link)
                SELECT %s,'RISK','High-risk learners need review','New or updated High Risk classifications are available.','../teacher/early-warning.html'
                WHERE NOT EXISTS (
                    SELECT 1 FROM notification WHERE user_id=%s AND title='High-risk learners need review'
                )
                """,
                (teacher_user_id, teacher_user_id),
            )
            cur.execute(
                """
                INSERT INTO notification (user_id, notification_type, title, message, link)
                SELECT %s,'SYSTEM','StayEd backend connected','The live Flask/PostgreSQL API is ready for this account.','../teacher/dashboard.html'
                WHERE NOT EXISTS (
                    SELECT 1 FROM notification WHERE user_id=%s AND title='StayEd backend connected'
                )
                """,
                (teacher_user_id, teacher_user_id),
            )

        conn.commit()

    print("StayEd demo data seeded.")
    print("Teacher: teacher@stayed.com / 12345678")
    print("Admin:   admin@stayed.com / 12345678")


if __name__ == "__main__":
    main()
