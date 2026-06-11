// ── Apartment Onboarding Data Layer (Phase AP.1) ─────────────────────────────
// CRUD helpers for properties, property_invites, and resident_pre_registrations.

import { supabase } from './supabase'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Property {
  id: string
  property_name: string
  manager_name: string
  manager_email: string
  phone: string | null
  address: string
  city: string
  state: string
  zip: string
  units: number | null
  status: 'active' | 'inactive' | 'pending'
  created_at: string
}

export interface PropertyInvite {
  id: string
  property_id: string
  invite_code: string
  landing_page: string
  active: boolean
  created_at: string
}

export interface ResidentPreRegistration {
  id: string
  property_id: string
  user_id: string | null
  resident_name: string
  email: string
  phone: string | null
  unit_number: string | null
  video_started: boolean
  video_completed: boolean
  video_completed_at: string | null
  terms_accepted: boolean
  terms_accepted_at: string | null
  account_created: boolean
  consumer_app_onboarding_completed: boolean
  created_at: string
}

export interface PropertyWithStats extends Property {
  invite?: PropertyInvite
  total_residents: number
  video_completed_count: number
  terms_accepted_count: number
  app_onboarded_count: number
}

// ── Slug helpers ──────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 10).toUpperCase()
}

// ── Property operations ───────────────────────────────────────────────────────

export async function createProperty(data: {
  property_name: string
  manager_name: string
  manager_email: string
  phone?: string
  address: string
  city: string
  state: string
  zip: string
  units?: number
}): Promise<{ property: Property; invite: PropertyInvite }> {
  const { data: prop, error: propErr } = await supabase
    .from('properties')
    .insert({
      property_name: data.property_name,
      manager_name:  data.manager_name,
      manager_email: data.manager_email,
      phone:         data.phone ?? null,
      address:       data.address,
      city:          data.city,
      state:         data.state,
      zip:           data.zip,
      units:         data.units ?? null,
      status:        'active',
    })
    .select()
    .single()

  if (propErr) throw propErr

  // Generate a unique slug and invite code for the property
  const baseSlug = slugify(data.property_name)
  let slug = baseSlug
  let attempt = 0
  let invite: PropertyInvite | null = null

  while (!invite) {
    const candidateSlug = attempt === 0 ? slug : `${baseSlug}-${attempt}`
    const { data: inv, error: invErr } = await supabase
      .from('property_invites')
      .insert({
        property_id:  prop.id,
        invite_code:  generateInviteCode(),
        landing_page: candidateSlug,
        active:       true,
      })
      .select()
      .single()

    if (!invErr && inv) {
      invite = inv
    } else if (invErr?.code === '23505') {
      // unique constraint violation — try next suffix
      attempt++
      if (attempt > 50) throw new Error('Could not generate a unique slug after 50 attempts.')
    } else if (invErr) {
      throw invErr
    }
  }

  return { property: prop, invite }
}

export async function getAdminProperties(): Promise<PropertyWithStats[]> {
  const { data: props, error } = await supabase
    .from('properties')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error

  // Fetch invites and pre-registration stats in parallel
  const [invitesResult, statsResult] = await Promise.all([
    supabase.from('property_invites').select('*').eq('active', true),
    supabase
      .from('resident_pre_registrations')
      .select('property_id, video_completed, terms_accepted, consumer_app_onboarding_completed'),
  ])

  const invitesByPropId = new Map<string, PropertyInvite>()
  for (const inv of invitesResult.data ?? []) {
    invitesByPropId.set(inv.property_id, inv)
  }

  const statsByPropId = new Map<string, { total: number; video: number; terms: number; app: number }>()
  for (const row of statsResult.data ?? []) {
    const s = statsByPropId.get(row.property_id) ?? { total: 0, video: 0, terms: 0, app: 0 }
    s.total++
    if (row.video_completed) s.video++
    if (row.terms_accepted) s.terms++
    if (row.consumer_app_onboarding_completed) s.app++
    statsByPropId.set(row.property_id, s)
  }

  return (props ?? []).map(p => {
    const s = statsByPropId.get(p.id) ?? { total: 0, video: 0, terms: 0, app: 0 }
    return {
      ...p,
      invite:                invitesByPropId.get(p.id),
      total_residents:       s.total,
      video_completed_count: s.video,
      terms_accepted_count:  s.terms,
      app_onboarded_count:   s.app,
    }
  })
}

// ── Property invite lookup ────────────────────────────────────────────────────

export async function getPropertyBySlug(
  slug: string,
): Promise<{ property: Property; invite: PropertyInvite } | null> {
  const { data: inv, error } = await supabase
    .from('property_invites')
    .select('*, properties(*)')
    .eq('landing_page', slug)
    .eq('active', true)
    .single()

  if (error || !inv) return null

  const property = (inv as unknown as { properties: Property }).properties
  const invite   = { ...inv, properties: undefined } as unknown as PropertyInvite

  return { property, invite }
}

// ── Resident pre-registration operations ─────────────────────────────────────

export async function createPreRegistration(data: {
  property_id: string
  resident_name: string
  email: string
  phone?: string
  unit_number?: string
}): Promise<ResidentPreRegistration> {
  const { data: row, error } = await supabase
    .from('resident_pre_registrations')
    .insert({
      property_id:    data.property_id,
      resident_name:  data.resident_name,
      email:          data.email,
      phone:          data.phone ?? null,
      unit_number:    data.unit_number ?? null,
    })
    .select()
    .single()

  if (error) throw error
  return row
}

export async function linkUserToPreRegistration(
  preRegId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from('resident_pre_registrations')
    .update({ user_id: userId, account_created: true })
    .eq('id', preRegId)

  if (error) throw error
}

export async function markVideoStarted(preRegId: string): Promise<void> {
  const { error } = await supabase
    .from('resident_pre_registrations')
    .update({ video_started: true })
    .eq('id', preRegId)

  if (error) throw error
}

export async function markVideoCompleted(preRegId: string): Promise<void> {
  const { error } = await supabase
    .from('resident_pre_registrations')
    .update({ video_completed: true, video_completed_at: new Date().toISOString() })
    .eq('id', preRegId)

  if (error) throw error
}

export async function markTermsAccepted(preRegId: string): Promise<void> {
  const { error } = await supabase
    .from('resident_pre_registrations')
    .update({ terms_accepted: true, terms_accepted_at: new Date().toISOString() })
    .eq('id', preRegId)

  if (error) throw error
}

export async function markConsumerOnboardingCompleted(userId: string): Promise<void> {
  const { error } = await supabase
    .from('resident_pre_registrations')
    .update({ consumer_app_onboarding_completed: true })
    .eq('user_id', userId)

  if (error) throw error
}

export async function getResidentPreRegistration(
  userId: string,
): Promise<(ResidentPreRegistration & { property: Property }) | null> {
  const { data, error } = await supabase
    .from('resident_pre_registrations')
    .select('*, properties(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) return null

  const property = (data as unknown as { properties: Property }).properties
  return { ...(data as ResidentPreRegistration), property }
}
