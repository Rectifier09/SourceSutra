-- ============================================================================
-- SourceSutra — migration 0013: cap email-send retries (BP-2 · INT-3 hardening).
--
-- Found during live verification: a row that permanently fails to send (no org
-- member with a real email, or a sandbox-restricted recipient) never gets
-- sent_at set, so it's re-selected by every future run of
-- send-notification-emails forever — a handful of permanently-failing rows can
-- occupy the whole BATCH_SIZE window and starve genuinely new notifications.
--
-- send_attempts lets the function give up after MAX_SEND_ATTEMPTS (see the
-- function source) instead of retrying indefinitely.
-- ============================================================================

alter table notifications add column send_attempts int not null default 0;

drop index notifications_unsent_email;
create index notifications_unsent_email on notifications (created_at)
  where channel = 'email' and sent_at is null and send_attempts < 5;
