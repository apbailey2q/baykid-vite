// onboardingProgress.ts — Tracks first-time walkthrough completion per user
//
// Strategy: optimistic localStorage write for instant UI dismiss, then
// best-effort upsert to onboarding_progress so the state persists across
// devices. Reads prefer the DB (cross-device), fall back to localStorage
// (offline / unauthenticated dev mode).

import { supabase } from './supabaseClient'
import type { OnboardingProgressRow } from '../types/betaLaunch'

const STORAGE_PREFIX = 'baykid_onb:'

function storageKey(surface: string): string {
  return `${STORAGE_PREFIX}${surface}`
}

// Returns true if the surface is complete or dismissed (i.e. shouldn't show).
export async function isCompletedOrDismissed(surface: string): Promise<boolean> {
  // Local fast-path
  try {
    if (localStorage.getItem(storageKey(surface)) === 'done') return true
  } catch { /* noop */ }

  const { data: user } = await supabase.auth.getUser()
  if (!user.user) return false

  const { data } = await supabase
    .from('onboarding_progress')
    .select('completed_at, dismissed_at')
    .eq('user_id', user.user.id)
    .eq('surface', surface)
    .maybeSingle()

  const row = (data as Pick<OnboardingProgressRow, 'completed_at' | 'dismissed_at'> | null) ?? null
  const done = !!(row?.completed_at || row?.dismissed_at)
  if (done) {
    try { localStorage.setItem(storageKey(surface), 'done') }
    catch { /* noop */ }
  }
  return done
}

interface MarkInput {
  surface:        string
  stepsComplete?: string[]
  dismissed?:     boolean
  completed?:     boolean
}

export async function markProgress(input: MarkInput): Promise<void> {
  // Optimistic local mark so UI dismisses immediately.
  if (input.dismissed || input.completed) {
    try { localStorage.setItem(storageKey(input.surface), 'done') }
    catch { /* noop */ }
  }

  const { data: user } = await supabase.auth.getUser()
  if (!user.user) return

  const now = new Date().toISOString()
  const payload = {
    user_id:        user.user.id,
    surface:        input.surface,
    steps_complete: input.stepsComplete ?? [],
    dismissed_at:   input.dismissed ? now : null,
    completed_at:   input.completed ? now : null,
  }

  // Never block the UI on a tracking write — swallow any error.
  try {
    await supabase
      .from('onboarding_progress')
      .upsert(payload, { onConflict: 'user_id,surface' })
  } catch { /* tracking is best-effort */ }
}
