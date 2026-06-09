-- OP.2 Phase 8 — Compliance Notification Deduplication Index
-- Prevent duplicate active notifications for the same owner + type combination.
-- One active (unread) notification per recipient+type+owner is sufficient;
-- additional inserts are ignored so the user's inbox doesn't fill with repeats.
--
-- NOTE: The partial index is ON (recipient_user_id, notification_type, owner_type)
-- WHERE is_read = false. Once a notification is marked read it is excluded from
-- the unique constraint so future alerts for the same event can be created again.

CREATE UNIQUE INDEX IF NOT EXISTS compliance_notifications_active_dedup
  ON public.compliance_notifications (recipient_user_id, notification_type, owner_type)
  WHERE (is_read = false);

COMMENT ON INDEX public.compliance_notifications_active_dedup IS
  'OP.2 — Prevents duplicate unread notifications. '
  'Application code uses ON CONFLICT DO NOTHING on this index to skip duplicates.';
