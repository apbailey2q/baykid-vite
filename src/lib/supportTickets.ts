// supportTickets.ts — Internal contact / support system
//
// Stores user-submitted tickets in public.support_tickets. No email is sent
// — admins triage in-app. Add an email/Slack notifier later by hooking the
// `notify_admin_on_new_ticket` Postgres trigger (TODO) to a webhook.

import { supabase } from './supabaseClient'
import { DEFAULT_ORG_ID } from './billing'
import type {
  SupportTicketRow, SupportCategory, SupportPriority,
} from '../types/betaLaunch'

export async function listMyTickets(): Promise<SupportTicketRow[]> {
  const { data, error } = await supabase
    .from('support_tickets')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as SupportTicketRow[]
}

interface CreateInput {
  subject:       string
  body:          string
  category?:     SupportCategory
  priority?:     SupportPriority
  contactEmail?: string
  pageUrl?:      string
  orgId?:        string
}

export async function createTicket(input: CreateInput): Promise<SupportTicketRow> {
  const { data: user } = await supabase.auth.getUser()
  const userId = user.user?.id

  const payload = {
    organization_id: input.orgId ?? DEFAULT_ORG_ID,
    category:        input.category ?? 'question',
    priority:        input.priority ?? 'normal',
    subject:         input.subject.trim(),
    body:            input.body.trim(),
    contact_email:   input.contactEmail ?? user.user?.email ?? null,
    page_url:        input.pageUrl ?? (typeof window !== 'undefined' ? window.location.pathname : null),
    created_by:      userId,
  }

  const { data, error } = await supabase
    .from('support_tickets')
    .insert(payload)
    .select()
    .single()

  if (error) throw error
  return data as SupportTicketRow
}
