-- Removes the 12 sample learners seed_demo.py --sample-data creates (and
-- everything that cascades from them), plus the two static notifications
-- it seeds unconditionally for the demo teacher account.
--
-- DO NOT RUN THIS without checking the SELECT counts in Part 1 first, on a
-- recent backup. If the demo teacher account ("Trisha Santos" /
-- teacher@stayed.com) has since been used for real testing with real
-- imported learners, this script does NOT touch them -- every DELETE below
-- is scoped to exactly the 12 seeded LRNs (or notifications linking to
-- them), never to "everything this teacher owns".
--
-- Cascade chain relied on below (see sql/00_core_schema.sql and later
-- migrations -- all CASCADE from class_enrollment, confirmed for
-- module_record, session_attendance, contact_log, risk_assessment,
-- module_release_batch, learner_session_schedule, risk_factors,
-- intervention, follow_up):
--   DELETE class_enrollment
--     -> CASCADE module_record, session_attendance, contact_log,
--        module_release_batch, learner_session_schedule, risk_assessment
--          -> CASCADE risk_factors, intervention
--               -> CASCADE follow_up (-> follow_up_photo)
-- learner itself is ON DELETE RESTRICT from class_enrollment, so it can
-- only be deleted *after* the enrollment rows above are gone -- Part 3
-- does that last.

BEGIN;

-- ---------------------------------------------------------------------
-- Part 1: READ-ONLY. Run this part alone first and review the counts.
-- ---------------------------------------------------------------------

-- The 12 seeded LRNs (StayEd_Backend/seed_demo.py's LEARNERS list).
CREATE TEMP TABLE _demo_lrns (lrn TEXT) ON COMMIT DROP;
INSERT INTO _demo_lrns (lrn) VALUES
    ('100000000041'), ('100000000038'), ('100000000102'), ('100000000015'),
    ('100000000089'), ('100000000044'), ('100000000051'), ('100000000063'),
    ('100000000071'), ('100000000088'), ('100000000094'), ('100000000107');

CREATE TEMP TABLE _demo_learner_ids (learner_id BIGINT) ON COMMIT DROP;
INSERT INTO _demo_learner_ids (learner_id)
SELECT learner_id FROM learner WHERE lrn IN (SELECT lrn FROM _demo_lrns);

SELECT 'learner rows matching the 12 seeded LRNs' AS what, COUNT(*) AS count
FROM learner WHERE learner_id IN (SELECT learner_id FROM _demo_learner_ids)
UNION ALL
SELECT 'class_enrollment rows for those learners', COUNT(*)
FROM class_enrollment WHERE learner_id IN (SELECT learner_id FROM _demo_learner_ids)
UNION ALL
SELECT 'risk_assessment rows (cascades from the enrollments above)', COUNT(*)
FROM risk_assessment WHERE enrollment_id IN (
    SELECT enrollment_id FROM class_enrollment WHERE learner_id IN (SELECT learner_id FROM _demo_learner_ids)
)
UNION ALL
SELECT 'intervention rows (cascades from those risk assessments)', COUNT(*)
FROM intervention WHERE risk_assessment_id IN (
    SELECT risk_assessment_id FROM risk_assessment WHERE enrollment_id IN (
        SELECT enrollment_id FROM class_enrollment WHERE learner_id IN (SELECT learner_id FROM _demo_learner_ids)
    )
)
UNION ALL
SELECT 'follow_up rows (cascades from those interventions)', COUNT(*)
FROM follow_up WHERE intervention_id IN (
    SELECT intervention_id FROM intervention WHERE risk_assessment_id IN (
        SELECT risk_assessment_id FROM risk_assessment WHERE enrollment_id IN (
            SELECT enrollment_id FROM class_enrollment WHERE learner_id IN (SELECT learner_id FROM _demo_learner_ids)
        )
    )
)
UNION ALL
-- Generated RISK/INTERVENTION alerts whose link points at one of these
-- learners (link is always "...html?id=<learner_id>&..." -- see
-- notification_routes.py's _insert_alert calls).
SELECT 'generated notifications linking to these learners', COUNT(*)
FROM notification
WHERE notification_type IN ('RISK', 'INTERVENTION')
  AND (regexp_match(link, '[?&]id=(\d+)'))[1]::BIGINT IN (SELECT learner_id FROM _demo_learner_ids)
UNION ALL
-- The two notifications seed_demo.py inserts unconditionally for the demo
-- teacher's own user_id, independent of any specific learner.
SELECT 'the 2 static seeded notifications (demo teacher account)', COUNT(*)
FROM notification n
JOIN users u ON u.user_id = n.user_id
WHERE u.email = 'teacher@stayed.com'
  AND n.title IN ('High-risk learners need review', 'StayEd backend connected');

-- Review the 6 counts above. If they look right, run Part 2 + Part 3 in
-- the SAME transaction (they're all inside this one BEGIN) and COMMIT.
-- To abort after just looking at the counts: ROLLBACK; (not COMMIT).

-- ---------------------------------------------------------------------
-- Part 2: deletes the generated notifications + the 2 static ones.
-- ---------------------------------------------------------------------

DELETE FROM notification
WHERE notification_type IN ('RISK', 'INTERVENTION')
  AND (regexp_match(link, '[?&]id=(\d+)'))[1]::BIGINT IN (SELECT learner_id FROM _demo_learner_ids);

DELETE FROM notification n
USING users u
WHERE u.user_id = n.user_id
  AND u.email = 'teacher@stayed.com'
  AND n.title IN ('High-risk learners need review', 'StayEd backend connected');

-- ---------------------------------------------------------------------
-- Part 3: deletes the enrollments (cascades risk_assessment/intervention/
-- follow_up/module_record/session_attendance/contact_log/etc. for them),
-- then the learner rows themselves (blocked by ON DELETE RESTRICT until
-- their enrollments above are gone).
-- ---------------------------------------------------------------------

DELETE FROM class_enrollment WHERE learner_id IN (SELECT learner_id FROM _demo_learner_ids);
DELETE FROM learner WHERE learner_id IN (SELECT learner_id FROM _demo_learner_ids);

COMMIT;
-- Or: ROLLBACK; if anything above looked wrong.
