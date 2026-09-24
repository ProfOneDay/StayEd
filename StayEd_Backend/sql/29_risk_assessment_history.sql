-- Preserve every completed risk prediction as a separate history point.
-- Previously uq_risk_assessment_period + ON CONFLICT caused repeated runs for
-- the same learner/monitoring window to overwrite the earlier assessment,
-- which left Risk Trend Over Time with only one point.

ALTER TABLE risk_assessment
    DROP CONSTRAINT IF EXISTS uq_risk_assessment_period;
