// betaFeedbackV2.ts — Categorized feedback (bug / feature / UX) for the
// AI Marketing Center beta. Separate from any legacy beta_feedback table —
// this one uses the new beta_feedback_v2 table with structured kind/severity.

import { supabase } from './supabaseClient'
import { DEFAULT_ORG_ID } from './billing'
import { APP_VERSION } from './env'
import type {
  BetaFeedbackV2Row, FeedbackKind, FeedbackSeverity,
} from '../types/betaLaunch'

export async function listMyFeedback(): Promise<BetaFeedbackV2Row[]> {
  const { data, error } = await supabase
    .from('beta_feedback_v2')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as BetaFeedbackV2Row[]
}

interface CreateInput {
  kind:      FeedbackKind
  title:     string
  body?:     string
  severity?: FeedbackSeverity
  surface?:  string
  pageUrl?:  string
  orgId?:    string
}

export async function submitFeedback(input: CreateInput): Promise<BetaFeedbackV2Row> {
  const { data: user } = await supabase.auth.getUser()

  const payload = {
    organization_id: input.orgId ?? DEFAULT_ORG_ID,
    kind:            input.kind,
    severity:        input.severity ?? 'minor',
    title:           input.title.trim(),
    body:            input.body?.trim() ?? null,
    surface:         input.surface ?? null,
    page_url:        input.pageUrl ?? (typeof window !== 'undefined' ? window.location.pathname : null),
    user_agent:      typeof navigator !== 'undefined' ? navigator.userAgent : null,
    app_version:     APP_VERSION,
    created_by:      user.user?.id ?? null,
  }

  const { data, error } = await supabase
    .from('beta_feedback_v2')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data as BetaFeedbackV2Row
}
