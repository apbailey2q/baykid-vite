-- ─────────────────────────────────────────────────────────────────────────────
-- Notification Deep-Link Fields
-- 2026-05-17
-- ─────────────────────────────────────────────────────────────────────────────
-- Adds deep-link routing metadata to commercial_notifications and
-- commercial_dispatch_messages so that tapping a notification navigates
-- the user to the correct screen.
--
-- target_route  — absolute app path  (e.g. /dashboard/commercial/invoices)
-- target_id     — optional UUID of the related entity (pickup, invoice, etc.)
-- related_role  — the role this notification is aimed at ('commercial', 'driver', …)
-- event_type    — semantic event label for client-side route lookup fallback
-- ─────────────────────────────────────────────────────────────────────────────


-- ╔══════════════════════════════════════════════════════════╗
-- ║  1.  commercial_notifications                            ║
-- ╚══════════════════════════════════════════════════════════╝

alter table public.commercial_notifications
  add column if not exists target_route  text,
  add column if not exists target_id     uuid,
  add column if not exists related_role  text,
  add column if not exists event_type    text;


-- ╔══════════════════════════════════════════════════════════╗
-- ║  2.  commercial_dispatch_messages                        ║
-- ╚══════════════════════════════════════════════════════════╝

alter table public.commercial_dispatch_messages
  add column if not exists target_route  text,
  add column if not exists target_id     uuid;


-- ╔══════════════════════════════════════════════════════════╗
-- ║  3.  VERIFICATION                                        ║
-- ╚══════════════════════════════════════════════════════════╝
-- select column_name, data_type
-- from   information_schema.columns
-- where  table_name in ('commercial_notifications', 'commercial_dispatch_messages')
--   and  column_name in ('target_route', 'target_id', 'related_role', 'event_type')
-- order  by table_name, column_name;
