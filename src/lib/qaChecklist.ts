// qaChecklist.ts — QA-checklist runs persistence
//
// Each user can save / submit a QA run for a suite + environment. We store
// the full {check_id: status} map plus pre-computed pass/fail/skip counts so
// admins can spot regressions ("auth passed in last build, fails in this one")
// without a full payload scan.
//
// Local autosave happens via localStorage (key: baykid_qa_run:<suite>:<env>)
// so partial progress survives reloads even before submit.

import { supabase } from './supabaseClient'
import { DEFAULT_ORG_ID } from './billing'
import { APP_VERSION, ENV } from './env'
import type {
  QAChecklistRunRow, QASuite, QAEnvironment, QAItemStatus,
} from '../types/betaLaunch'

type ItemsMap = Record<string, QAItemStatus>

// ── Local autosave ──────────────────────────────────────────────────────────

function key(suite: QASuite, env: QAEnvironment): string {
  return `baykid_qa_run:${suite}:${env}`
}

export function loadDraft(suite: QASuite, env: QAEnvironment): ItemsMap {
  try {
    const raw = localStorage.getItem(key(suite, env))
    return raw ? JSON.parse(raw) as ItemsMap : {}
  } catch { return {} }
}

export function saveDraft(suite: QASuite, env: QAEnvironment, items: ItemsMap): void {
  try { localStorage.setItem(key(suite, env), JSON.stringify(items)) }
  catch { /* storage unavailable */ }
}

export function clearDraft(suite: QASuite, env: QAEnvironment): void {
  try { localStorage.removeItem(key(suite, env)) }
  catch { /* noop */ }
}

// ── Counts ──────────────────────────────────────────────────────────────────

function tally(items: ItemsMap) {
  let pass = 0, fail = 0, skip = 0
  for (const v of Object.values(items)) {
    if      (v === 'pass') pass++
    else if (v === 'fail') fail++
    else if (v === 'skip') skip++
  }
  return { pass, fail, skip }
}

// ── DB ──────────────────────────────────────────────────────────────────────

interface SubmitInput {
  suite:        QASuite
  environment?: QAEnvironment
  items:        ItemsMap
  notes?:       string
  orgId?:       string
}

export async function submitRun(input: SubmitInput): Promise<QAChecklistRunRow> {
  const { data: user } = await supabase.auth.getUser()
  const counts = tally(input.items)
  const env: QAEnvironment = input.environment ?? (ENV === 'local' ? 'local' : ENV === 'production' ? 'production' : 'staging')

  const payload = {
    organization_id: input.orgId ?? DEFAULT_ORG_ID,
    suite:           input.suite,
    environment:     env,
    app_version:     APP_VERSION,
    items:           input.items,
    pass_count:      counts.pass,
    fail_count:      counts.fail,
    skip_count:      counts.skip,
    notes:           input.notes ?? null,
    submitted_at:    new Date().toISOString(),
    created_by:      user.user?.id ?? null,
  }

  const { data, error } = await supabase
    .from('qa_checklist_runs')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data as QAChecklistRunRow
}

export async function listRecentRuns(
  suite: QASuite,
  limit = 10,
  orgId: string = DEFAULT_ORG_ID,
): Promise<QAChecklistRunRow[]> {
  const { data, error } = await supabase
    .from('qa_checklist_runs')
    .select('*')
    .eq('organization_id', orgId)
    .eq('suite', suite)
    .not('submitted_at', 'is', null)
    .order('submitted_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as QAChecklistRunRow[]
}
