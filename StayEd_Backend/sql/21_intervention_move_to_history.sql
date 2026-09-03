-- Adds a flag so a Completed/Cancelled intervention can stay visible in the
-- "Active Intervention" card (with a "Save to History" action) instead of
-- disappearing into the History table immediately.

ALTER TABLE intervention
    ADD COLUMN IF NOT EXISTS moved_to_history BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE intervention
    ADD COLUMN IF NOT EXISTS history_saved_at TIMESTAMP;
