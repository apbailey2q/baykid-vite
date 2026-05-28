// marketingSignups.ts — Public-site form submitter
//
// Writes to public.marketing_signups. RLS allows anonymous INSERT only —
// reads stay admin-only. Never throws; surfaces success/error via the return.
//
// The marketing pages call this without any auth dependency; the supabase
// client uses the anon key by default which is exactly what the public RLS
// policy expects.

import { supabase } from './supabaseClient'

export type SignupKind = 'waitlist' | 'demo_request' | 'newsletter' | 'contact'

export interface SubmitInput {
  kind:        SignupKind
  email:       string
  name?:       string
  company?:    string
  message?:    string
  sourcePage?: string
  utm?:        { source?: string; medium?: string; campaign?: string }
}

export interface SubmitResult {
  ok:     boolean
  error?: string
}

function readUtm(): { source?: string; medium?: string; campaign?: string } {
  if (typeof window === 'undefined') return {}
  try {
    const p = new URLSearchParams(window.location.search)
    return {
      source:   p.get('utm_source')   ?? undefined,
      medium:   p.get('utm_medium')   ?? undefined,
      campaign: p.get('utm_campaign') ?? undefined,
    }
  } catch { return {} }
}

/**
 * Submit a marketing-site signup (waitlist / demo / newsletter / contact).
 * Returns { ok: true } on success; { ok: false, error } on failure. Never
 * throws — the form UIs use the result to render success vs error state.
 */
export async function submitSignup(input: SubmitInput): Promise<SubmitResult> {
  const email = input.email.trim().toLowerCase()
  if (!email || !email.includes('@')) {
    return { ok: false, error: 'Please enter a valid email address.' }
  }

  const utm = { ...readUtm(), ...input.utm }

  const payload = {
    kind:         input.kind,
    email,
    name:         input.name?.trim() || null,
    company:      input.company?.trim() || null,
    message:      input.message?.trim() || null,
    source_page:  input.sourcePage ?? (typeof window !== 'undefined' ? window.location.pathname : null),
    utm_source:   utm.source ?? null,
    utm_medium:   utm.medium ?? null,
    utm_campaign: utm.campaign ?? null,
    user_agent:   typeof navigator !== 'undefined' ? navigator.userAgent : null,
  }

  try {
    const { error } = await supabase.from('marketing_signups').insert(payload)
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e) {
    const maybe = (e as { message?: unknown } | null | undefined)?.message
    return { ok: false, error: typeof maybe === 'string' ? maybe : 'Submission failed' }
  }
}
