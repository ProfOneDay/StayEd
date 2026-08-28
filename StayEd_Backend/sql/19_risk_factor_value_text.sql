-- Adds a text column for storing non-numeric contributing-factor values
-- (categorical fields like sex/modality, and boolean fields like
-- is_re_enrollee). The existing factor_value column is NUMERIC(12,4) and
-- can only hold numeric features (age, distance_km); categorical/boolean
-- factors were previously stored as NULL and displayed as "n/a" even
-- though they were counted toward the risk score. Safe to re-run.

BEGIN;

ALTER TABLE risk_factors
    ADD COLUMN IF NOT EXISTS factor_value_text VARCHAR(150);

COMMIT;