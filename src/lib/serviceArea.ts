// serviceArea.ts — Service-area check + waitlist signup for consumer onboarding.

import { supabase } from './supabase'

export interface ServiceAreaCheckResult {
  inService: boolean
  areaId?:   string
  areaName?: string
  error?:    string
}

/** Returns true when the ZIP is in an active service area. Used as the gate
 *  between StepProfile and the rest of the consumer wizard. */
export async function checkZipInServiceArea(zip: string): Promise<ServiceAreaCheckResult> {
  const cleaned = zip.replace(/\D/g, '').slice(0, 5)
  if (cleaned.length < 5) return { inService: false, error: 'Enter a 5-digit ZIP code' }

  const { data, error } = await supabase
    .rpc('find_service_area_for_zip', { p_zip: cleaned })

  if (error) return { inService: false, error: error.message }

  const row = Array.isArray(data) ? data[0] : null
  if (!row) return { inService: false }
  return { inService: true, areaId: row.id, areaName: row.name }
}

export interface MarkServiceAreaVerifiedInput {
  userId:   string
  areaId:   string
}

export async function markServiceAreaVerified(input: MarkServiceAreaVerifiedInput): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('profiles')
    .update({
      service_area_id:          input.areaId,
      service_area_verified_at: new Date().toISOString(),
    })
    .eq('id', input.userId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export interface WaitlistSignupInput {
  name?:    string
  email:    string
  phone?:   string
  zip?:     string
  city?:    string
  state?:   string
}

/** Persists an out-of-area lead to the existing marketing_signups table with
 *  kind='waitlist'. Returns ok=true even on duplicate email — the waitlist
 *  table dedupes on email at the DB level. */
export async function addToWaitlist(input: WaitlistSignupInput): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('marketing_signups')
    .insert({
      kind:    'waitlist',
      email:   input.email.trim().toLowerCase(),
      name:    input.name?.trim() || null,
      phone:   input.phone?.trim() || null,
      payload: {
        zip:   input.zip,
        city:  input.city,
        state: input.state,
      },
    })
  if (error) {
    // Treat duplicate-email as success (idempotent)
    if (error.code === '23505') return { ok: true }
    return { ok: false, error: error.message }
  }
  return { ok: true }
}
