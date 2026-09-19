-- Lets an admin send a one-off notification to one or more teachers --
-- either an announcement or a request for a specific report -- reusing the
-- existing per-user `notification` table/inbox teachers already have.

BEGIN;

ALTER TABLE notification DROP CONSTRAINT IF EXISTS ck_notification_type;
ALTER TABLE notification ADD CONSTRAINT ck_notification_type CHECK (
    notification_type IN (
        'INFO', 'RISK', 'INTERVENTION', 'SYSTEM', 'SUCCESS', 'WARNING',
        'REPORT', 'ANNOUNCEMENT', 'REPORT_REQUEST'
    )
);

COMMIT;
