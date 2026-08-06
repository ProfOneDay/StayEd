-- Notifications need a way to know "have I already alerted this teacher about
-- this specific thing" (a risk level reached, an inactivity threshold crossed,
-- an intervention becoming due) so the generator can run idempotently on every
-- notifications-page load instead of needing a scheduler. meta_label gives the
-- frontend an explicit "High Risk" / "Overdue" badge instead of scraping it out
-- of the message text. Safe to re-run.

BEGIN;

ALTER TABLE notification ADD COLUMN IF NOT EXISTS meta_label VARCHAR(60);
ALTER TABLE notification ADD COLUMN IF NOT EXISTS dedup_key VARCHAR(200);

CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_user_dedup
    ON notification(user_id, dedup_key) WHERE dedup_key IS NOT NULL;

COMMIT;
