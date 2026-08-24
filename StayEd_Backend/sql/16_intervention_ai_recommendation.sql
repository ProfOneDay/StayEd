-- Adds columns to store the AI-generated recommendation reasoning
-- (title, priority, category, reason, and recommended action) alongside
-- an assigned intervention, so it can be displayed to the teacher instead
-- of being generated once and discarded. Safe to re-run.
BEGIN;
ALTER TABLE intervention
    ADD COLUMN IF NOT EXISTS ai_title VARCHAR(200),
    ADD COLUMN IF NOT EXISTS ai_priority VARCHAR(20),
    ADD COLUMN IF NOT EXISTS ai_category VARCHAR(100),
    ADD COLUMN IF NOT EXISTS ai_reason TEXT,
    ADD COLUMN IF NOT EXISTS ai_recommended_action TEXT;
COMMIT;