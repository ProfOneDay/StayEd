-- Contact numbers: exactly 11 digits starting with 09, enforced by the
-- database itself (not just the forms), so "+63 ...", letters, or a
-- 9-digit typo can never be stored again.
--
-- Kept as text, NOT a numeric type, on purpose: a numeric column drops the
-- leading 0 (09171234567 would become 9171234567) and phone numbers are
-- never used in arithmetic. The CHECK constraint is what guarantees
-- "digits only".
--
-- Existing values are cleaned first: spaces/dashes/dots/parentheses are
-- removed and +63 / 63 / bare-9 forms become 09XXXXXXXXX. Anything still
-- invalid after that is copied to contact_number_cleanup_log (so nothing
-- is silently lost) and then cleared, so the constraint can be added.
-- Safe to re-run: cleaning is idempotent and the constraints are only
-- added if missing.
BEGIN;

CREATE TABLE IF NOT EXISTS contact_number_cleanup_log (
    log_id BIGSERIAL PRIMARY KEY,
    table_name TEXT NOT NULL,
    column_name TEXT NOT NULL,
    row_id BIGINT,
    old_value TEXT NOT NULL,
    cleared_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
DECLARE
    target RECORD;
    normalised TEXT := $n$
        CASE
            WHEN regexp_replace(%1$I, '[^0-9]', '', 'g') ~ '^63[0-9]{10}$'
                THEN '0' || substr(regexp_replace(%1$I, '[^0-9]', '', 'g'), 3)
            WHEN regexp_replace(%1$I, '[^0-9]', '', 'g') ~ '^9[0-9]{9}$'
                THEN '0' || regexp_replace(%1$I, '[^0-9]', '', 'g')
            ELSE regexp_replace(%1$I, '[^0-9]', '', 'g')
        END
    $n$;
BEGIN
    FOR target IN
        SELECT * FROM (VALUES
            ('users', 'contact_number', 'user_id', 'ck_users_contact_number'),
            ('teacher', 'contact_number', 'teacher_id', 'ck_teacher_contact_number'),
            ('learner', 'contact_number', 'learner_id', 'ck_learner_contact_number'),
            ('learner', 'guardian_contact_number', 'learner_id', 'ck_learner_guardian_contact_number'),
            ('clc', 'contact_number', 'clc_id', 'ck_clc_contact_number')
        ) AS t(tbl, col, pk, ck)
    LOOP
        -- Column may not exist on a very old schema; skip it then.
        CONTINUE WHEN NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = target.tbl AND column_name = target.col
        );

        -- Blank -> NULL.
        EXECUTE format('UPDATE %I SET %I = NULL WHERE %I IS NOT NULL AND btrim(%I) = ''''',
                       target.tbl, target.col, target.col, target.col);

        -- Fixable formats -> 09XXXXXXXXX.
        EXECUTE format(
            'UPDATE %I SET %I = ' || format(normalised, target.col) ||
            ' WHERE %I IS NOT NULL AND %I !~ ''^09[0-9]{9}$'' AND (' || format(normalised, target.col) || ') ~ ''^09[0-9]{9}$''',
            target.tbl, target.col, target.col, target.col);

        -- Unfixable -> logged, then cleared.
        EXECUTE format(
            'INSERT INTO contact_number_cleanup_log (table_name, column_name, row_id, old_value)
             SELECT %L, %L, %I, %I FROM %I WHERE %I IS NOT NULL AND %I !~ ''^09[0-9]{9}$''',
            target.tbl, target.col, target.pk, target.col, target.tbl, target.col, target.col);
        EXECUTE format('UPDATE %I SET %I = NULL WHERE %I IS NOT NULL AND %I !~ ''^09[0-9]{9}$''',
                       target.tbl, target.col, target.col, target.col);

        -- The column type stays VARCHAR(30): learner's columns are used by
        -- vw_learner_enrollment_profile, which blocks ALTER TYPE, and the
        -- CHECK below already pins the value to exactly 11 digits.
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = target.ck) THEN
            EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK (%I ~ ''^09[0-9]{9}$'')',
                           target.tbl, target.ck, target.col);
        END IF;
    END LOOP;
END $$;

COMMIT;
