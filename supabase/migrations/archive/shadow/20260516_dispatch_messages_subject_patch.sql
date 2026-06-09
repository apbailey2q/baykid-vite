-- ============================================================
-- Add subject, message_type, priority, acknowledged columns
-- to commercial_dispatch_messages
-- ============================================================

alter table public.commercial_dispatch_messages
  add column if not exists subject        text,
  add column if not exists priority       text not null default 'info'
    check (priority in ('info', 'warning', 'critical', 'emergency')),
  add column if not exists acknowledged   boolean not null default false;

-- message_type already exists as msg_type with a narrower check.
-- Extend the check to include the new dispatch-specific subtypes.
-- Drop old constraint and replace with broader one.
alter table public.commercial_dispatch_messages
  drop constraint if exists commercial_dispatch_messages_msg_type_check;

alter table public.commercial_dispatch_messages
  add constraint commercial_dispatch_messages_msg_type_check
    check (msg_type in (
      'text',
      'dispatch_change',
      'system',
      'route_update',
      'delay_notice',
      'safety_warning',
      'warehouse_reroute',
      'emergency_instruction',
      'general_dispatch'
    ));

-- Index for unread queries
create index if not exists idx_cdm_unread
  on public.commercial_dispatch_messages (recipient_id, read, priority)
  where read = false;
