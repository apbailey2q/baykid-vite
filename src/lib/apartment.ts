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
  // AP.3B funnel tracking
  app_download_clicked: boolean
  app_download_clicked_at: string | null
  app_platform: 'ios' | 'android' | null
  first_app_login_at: string | null
  consumer_app_onboarding_completed_at: string | null
  active_user_at: string | null
  created_at: string
}

export interface PropertyWithStats extends Property {
  invite?: PropertyInvite
  total_residents: number
  accounts_created_count: number
  video_completed_count: number
  terms_accepted_count: number
  download_clicked_count: number
  first_login_count: number
  app_onboarded_count: number
  active_user_count: number
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
  // SECURITY DEFINER RPC — bypasses RLS so anonymous property managers can register
  const { data: result, error } = await supabase.rpc('create_property_public', {
    p_property_name: data.property_name,
    p_manager_name:  data.manager_name,
    p_manager_email: data.manager_email,
    p_phone:         data.phone ?? null,
    p_address:       data.address,
    p_city:          data.city,
    p_state:         data.state,
    p_zip:           data.zip,
    p_units:         data.units ?? null,
  })

  if (error) throw error

  const rpcResult = result as { property_id: string; invite_id: string; slug: string; invite_code: string }

  // Fetch the full records so the caller gets typed objects
  const [{ data: property, error: propErr }, { data: invite, error: invErr }] = await Promise.all([
    supabase.from('properties').select('*').eq('id', rpcResult.property_id).single(),
    supabase.from('property_invites').select('*').eq('id', rpcResult.invite_id).single(),
  ])

  if (propErr) throw propErr
  if (invErr)  throw invErr

  return { property: property as Property, invite: invite as PropertyInvite }
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
      .select(
        'property_id, account_created, video_completed, terms_accepted, ' +
        'app_download_clicked, first_app_login_at, consumer_app_onboarding_completed, active_user_at',
      ),
  ])

  const invitesByPropId = new Map<string, PropertyInvite>()
  for (const inv of invitesResult.data ?? []) {
    invitesByPropId.set(inv.property_id, inv)
  }

  type StatRow = {
    property_id: string
    account_created: boolean
    video_completed: boolean
    terms_accepted: boolean
    app_download_clicked: boolean
    first_app_login_at: string | null
    consumer_app_onboarding_completed: boolean
    active_user_at: string | null
  }
  type RowStats = {
    total: number; accounts: number; video: number; terms: number
    download: number; login: number; app: number; active: number
  }
  const statsByPropId = new Map<string, RowStats>()
  for (const row of ((statsResult.data ?? []) as unknown as StatRow[])) {
    const s = statsByPropId.get(row.property_id)
      ?? { total: 0, accounts: 0, video: 0, terms: 0, download: 0, login: 0, app: 0, active: 0 }
    s.total++
    if (row.account_created)                  s.accounts++
    if (row.video_completed)                  s.video++
    if (row.terms_accepted)                   s.terms++
    if (row.app_download_clicked)             s.download++
    if (row.first_app_login_at != null)       s.login++
    if (row.consumer_app_onboarding_completed) s.app++
    if (row.active_user_at != null)           s.active++
    statsByPropId.set(row.property_id, s)
  }

  return (props ?? []).map(p => {
    const s = statsByPropId.get(p.id)
      ?? { total: 0, accounts: 0, video: 0, terms: 0, download: 0, login: 0, app: 0, active: 0 }
    return {
      ...p,
      invite:                 invitesByPropId.get(p.id),
      total_residents:        s.total,
      accounts_created_count: s.accounts,
      video_completed_count:  s.video,
      terms_accepted_count:   s.terms,
      download_clicked_count: s.download,
      first_login_count:      s.login,
      app_onboarded_count:    s.app,
      active_user_count:      s.active,
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
  if (!property) return null  // property inactive or RLS blocked join

  const invite = { ...inv, properties: undefined } as unknown as PropertyInvite

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
  // SECURITY DEFINER RPC — anon INSERT on resident_pre_registrations is blocked
  // by Supabase's PostgREST/RLS layer despite a permissive policy; RPC bypasses it.
  const { data: result, error } = await supabase.rpc('create_pre_registration_public', {
    p_property_id:   data.property_id,
    p_resident_name: data.resident_name,
    p_email:         data.email,
    p_phone:         data.phone ?? null,
    p_unit_number:   data.unit_number ?? null,
  })

  if (error) throw error

  // RPC returns the full row as JSON — no separate SELECT needed (anon can't SELECT)
  return result as ResidentPreRegistration
}

export async function linkUserToPreRegistration(
  preRegId: string,
  userId: string,
): Promise<void> {
  // SECURITY DEFINER RPC — when called right after signUp(), the pre-reg row
  // still has user_id = NULL so the UPDATE policy (user_id = auth.uid()) won't match.
  const { error } = await supabase.rpc('link_pre_registration_to_user', {
    p_pre_reg_id: preRegId,
    p_user_id:    userId,
  })

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
    .update({
      consumer_app_onboarding_completed:    true,
      consumer_app_onboarding_completed_at: new Date().toISOString(),
    })
    .eq('user_id', userId)

  if (error) throw error
}

// AP.3B — Download click tracking ─────────────────────────────────────────────

export async function trackAppDownload(
  preRegId: string,
  platform: 'ios' | 'android',
): Promise<void> {
  const { error } = await supabase
    .from('resident_pre_registrations')
    .update({
      app_download_clicked:    true,
      app_download_clicked_at: new Date().toISOString(),
      app_platform:            platform,
    })
    .eq('id', preRegId)

  if (error) throw error
}

// AP.3B — First app login (set once; no-op if already stamped) ────────────────

export async function trackFirstAppLogin(userId: string): Promise<void> {
  const { error } = await supabase
    .from('resident_pre_registrations')
    .update({ first_app_login_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('first_app_login_at', null)

  if (error) throw error
}

// AP.3B — Active user (set once when resident first reaches their dashboard) ───

export async function markActiveUser(userId: string): Promise<void> {
  const { error } = await supabase
    .from('resident_pre_registrations')
    .update({ active_user_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('active_user_at', null)

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
