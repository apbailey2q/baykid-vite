// commercialOnboarding.ts — helpers for the CommercialOnboarding wizard
// (Phase G.4) and the CommercialDashboard.
//
// Writes to:
//   public.commercial_accounts            (extended in 20260620 migration)
//   public.commercial_locations           (primary location at submit)
//   public.commercial_material_profiles   (one row per selected material)
//   public.commercial_service_preferences (frequency + days + logistics)
//
// Stripe / payments / contracts are intentionally NOT touched here — the
// spec says onboarding ends at account_status='pending_review'.

import { supabase } from './supabase'
import type {
  CommercialBusinessType,
  CommercialAccountStatus,
  CommercialVolumeTier,
  CommercialPickupFrequency,
  CommercialMaterial,
} from '../types'

// ── Inputs ───────────────────────────────────────────────────────────────────

export interface UpsertCommercialAccountInput {
  userId:              string
  businessName:        string
  dbaName?:            string
  businessType?:       CommercialBusinessType | null
  ein?:                string
  website?:            string

  contactName:         string
  contactTitle?:       string
  contactEmail:        string
  contactPhone?:       string

  // Service address
  serviceAddressLine1: string
  serviceCity:         string
  serviceState:        string
  serviceZip:          string

  // Billing
  billingSameAsService: boolean
  billingAddressLine1?: string
  billingCity?:         string
  billingState?:        string
  billingZip?:          string

  // Volume + containers
  estimatedVolumeTier?: CommercialVolumeTier | null
  bagsPerWeek?:         number | null
  needsContainers:      boolean
  containerType?:       string
  containerQuantity?:   number | null

  // Logistics (also stored on service_preferences, kept on account for
  // single-row dashboard reads).
  loadingDockAvailable: boolean
  forkliftAccess:       boolean
  parkingInstructions?: string
  specialInstructions?: string
}

export interface UpsertResult {
  ok:        boolean
  accountId?: string
  error?:    string
}

// ── Account upsert ───────────────────────────────────────────────────────────

/** Idempotent: writes or updates the user's single commercial_accounts row.
 *  Existing rows are matched on user_id; the wizard always works against
 *  one account per user. */
export async function upsertCommercialAccount(
  input: UpsertCommercialAccountInput,
  initialStatus: CommercialAccountStatus = 'draft',
): Promise<UpsertResult> {
  if (!input.businessName.trim()) return { ok: false, error: 'Business name is required' }
  if (!input.contactName.trim())  return { ok: false, error: 'Contact name is required' }
  if (!input.contactEmail.trim()) return { ok: false, error: 'Contact email is required' }
  if (!input.serviceAddressLine1.trim()) return { ok: false, error: 'Service address is required' }

  const row = {
    user_id:                 input.userId,
    business_name:           input.businessName.trim(),
    dba_name:                input.dbaName?.trim() || null,
    business_type:           input.businessType ?? null,
    ein:                     input.ein?.trim() || null,
    website:                 input.website?.trim() || null,
    contact_name:            input.contactName.trim(),
    contact_title:           input.contactTitle?.trim() || null,
    contact_email:           input.contactEmail.trim().toLowerCase(),
    contact_phone:           input.contactPhone?.trim() || null,
    address:                 input.serviceAddressLine1.trim(),
    city:                    input.serviceCity.trim(),
    state:                   input.serviceState.trim(),
    zip:                     input.serviceZip.trim(),
    billing_same_as_service: input.billingSameAsService,
    billing_address_line1:   input.billingSameAsService ? null : (input.billingAddressLine1?.trim() || null),
    billing_city:            input.billingSameAsService ? null : (input.billingCity?.trim() || null),
    billing_state:           input.billingSameAsService ? null : (input.billingState?.trim() || null),
    billing_zip:             input.billingSameAsService ? null : (input.billingZip?.trim() || null),
    estimated_volume_tier:   input.estimatedVolumeTier ?? null,
    bags_per_week:           input.bagsPerWeek ?? null,
    needs_containers:        input.needsContainers,
    container_type:          input.containerType?.trim() || null,
    container_quantity:      input.containerQuantity ?? null,
    loading_dock_available:  input.loadingDockAvailable,
    forklift_access:         input.forkliftAccess,
    parking_instructions:    input.parkingInstructions?.trim() || null,
    special_instructions:    input.specialInstructions?.trim() || null,
    account_status:          initialStatus,
  }

  const existing = await supabase
    .from('commercial_accounts')
    .select('id')
    .eq('user_id', input.userId)
    .maybeSingle()

  if (existing.error) return { ok: false, error: existing.error.message }

  if (existing.data?.id) {
    const { error } = await supabase
      .from('commercial_accounts')
      .update(row)
      .eq('id', existing.data.id)
    if (error) return { ok: false, error: error.message }
    return { ok: true, accountId: existing.data.id }
  }

  const { data, error } = await supabase
    .from('commercial_accounts')
    .insert(row)
    .select('id')
    .single()
  if (error) return { ok: false, error: error.message }
  return { ok: true, accountId: data?.id as string }
}

// ── Materials ────────────────────────────────────────────────────────────────

/** Replaces the account's material profile in one batch — deletes everything
 *  not in `materials`, inserts what's missing. Idempotent for repeated wizard
 *  saves. */
export async function setCommercialMaterials(
  accountId: string,
  materials: CommercialMaterial[],
): Promise<{ ok: boolean; error?: string }> {
  const unique = Array.from(new Set(materials))
  const del = await supabase
    .from('commercial_material_profiles')
    .delete()
    .eq('account_id', accountId)
  if (del.error) return { ok: false, error: del.error.message }
  if (unique.length === 0) return { ok: true }

  const { error } = await supabase
    .from('commercial_material_profiles')
    .insert(unique.map((m) => ({ account_id: accountId, material: m })))
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// ── Service preferences ──────────────────────────────────────────────────────

export interface UpsertServicePreferencesInput {
  accountId:            string
  pickupFrequency:      CommercialPickupFrequency
  preferredDays:        string[]
  preferredWindow?:     string
  loadingDockAvailable: boolean
  forkliftAccess:       boolean
  parkingInstructions?: string
  specialInstructions?: string
}

export async function upsertCommercialServicePreferences(
  input: UpsertServicePreferencesInput,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('commercial_service_preferences')
    .upsert({
      account_id:             input.accountId,
      pickup_frequency:       input.pickupFrequency,
      preferred_days:         input.preferredDays,
      preferred_window:       input.preferredWindow?.trim() || null,
      loading_dock_available: input.loadingDockAvailable,
      forklift_access:        input.forkliftAccess,
      parking_instructions:   input.parkingInstructions?.trim() || null,
      special_instructions:   input.specialInstructions?.trim() || null,
    }, { onConflict: 'account_id' })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// ── Primary location ─────────────────────────────────────────────────────────

export interface UpsertPrimaryLocationInput {
  accountId:     string
  addressLine1:  string
  city:          string
  state:         string
  zip:           string
  label?:        string
}

export async function upsertPrimaryCommercialLocation(
  input: UpsertPrimaryLocationInput,
): Promise<{ ok: boolean; error?: string }> {
  const existing = await supabase
    .from('commercial_locations')
    .select('id')
    .eq('account_id', input.accountId)
    .eq('is_primary', true)
    .maybeSingle()
  if (existing.error) return { ok: false, error: existing.error.message }

  const row = {
    account_id:    input.accountId,
    label:         input.label?.trim() || 'Primary',
    is_primary:    true,
    address_line1: input.addressLine1.trim(),
    city:          input.city.trim(),
    state:         input.state.trim(),
    zip:           input.zip.trim(),
  }

  if (existing.data?.id) {
    const { error } = await supabase.from('commercial_locations').update(row).eq('id', existing.data.id)
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  }
  const { error } = await supabase.from('commercial_locations').insert(row)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// ── Status transitions ───────────────────────────────────────────────────────

export async function setCommercialAccountStatus(
  accountId: string,
  status:    CommercialAccountStatus,
): Promise<{ ok: boolean; error?: string }> {
  const update: Record<string, unknown> = { account_status: status }
  if (status === 'pending_review') update.submitted_at = new Date().toISOString()
  if (status === 'approved')       update.approved_at  = new Date().toISOString()
  if (status === 'rejected')       update.rejected_at  = new Date().toISOString()

  const { error } = await supabase
    .from('commercial_accounts')
    .update(update)
    .eq('id', accountId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// ── Dashboard state ──────────────────────────────────────────────────────────

export interface CommercialAccountState {
  accountId:               string
  businessName:            string
  dbaName:                 string | null
  businessType:            string | null
  ein:                     string | null
  website:                 string | null
  contactName:             string
  contactTitle:            string | null
  contactEmail:            string
  contactPhone:            string | null
  serviceAddressLine1:     string | null
  serviceCity:             string | null
  serviceState:            string | null
  serviceZip:              string | null
  billingSameAsService:    boolean
  billingAddressLine1:     string | null
  billingCity:             string | null
  billingState:            string | null
  billingZip:              string | null
  estimatedVolumeTier:     string | null
  bagsPerWeek:             number | null
  needsContainers:         boolean
  containerType:           string | null
  containerQuantity:       number | null
  accountStatus:           CommercialAccountStatus
  submittedAt:             string | null
  approvedAt:              string | null
  rejectedAt:              string | null
  rejectionReason:         string | null
  pickupFrequency:         CommercialPickupFrequency | null
  preferredDays:           string[]
  preferredWindow:         string | null
  loadingDockAvailable:    boolean
  forkliftAccess:          boolean
  parkingInstructions:     string | null
  specialInstructions:     string | null
  materialCount:           number
  locationCount:           number
}

export async function loadCommercialAccountState(userId: string): Promise<CommercialAccountState | null> {
  const { data, error } = await supabase
    .from('commercial_account_state')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data) return null

  return {
    accountId:               data.account_id as string,
    businessName:            data.business_name as string,
    dbaName:                 (data.dba_name as string) ?? null,
    businessType:            (data.business_type as string) ?? null,
    ein:                     (data.ein as string) ?? null,
    website:                 (data.website as string) ?? null,
    contactName:             data.contact_name as string,
    contactTitle:            (data.contact_title as string) ?? null,
    contactEmail:            data.contact_email as string,
    contactPhone:            (data.contact_phone as string) ?? null,
    serviceAddressLine1:     (data.service_address_line1 as string) ?? null,
    serviceCity:             (data.service_city as string) ?? null,
    serviceState:            (data.service_state as string) ?? null,
    serviceZip:              (data.service_zip as string) ?? null,
    billingSameAsService:    Boolean(data.billing_same_as_service),
    billingAddressLine1:     (data.billing_address_line1 as string) ?? null,
    billingCity:             (data.billing_city as string) ?? null,
    billingState:            (data.billing_state as string) ?? null,
    billingZip:              (data.billing_zip as string) ?? null,
    estimatedVolumeTier:     (data.estimated_volume_tier as string) ?? null,
    bagsPerWeek:             (data.bags_per_week as number) ?? null,
    needsContainers:         Boolean(data.needs_containers),
    containerType:           (data.container_type as string) ?? null,
    containerQuantity:       (data.container_quantity as number) ?? null,
    accountStatus:           data.account_status as CommercialAccountStatus,
    submittedAt:             (data.submitted_at as string) ?? null,
    approvedAt:              (data.approved_at as string) ?? null,
    rejectedAt:              (data.rejected_at as string) ?? null,
    rejectionReason:         (data.rejection_reason as string) ?? null,
    pickupFrequency:         (data.pickup_frequency as CommercialPickupFrequency) ?? null,
    preferredDays:           (data.preferred_days as string[]) ?? [],
    preferredWindow:         (data.preferred_window as string) ?? null,
    loadingDockAvailable:    Boolean(data.loading_dock_available),
    forkliftAccess:          Boolean(data.forklift_access),
    parkingInstructions:     (data.parking_instructions as string) ?? null,
    specialInstructions:     (data.special_instructions as string) ?? null,
    materialCount:           Number(data.material_count ?? 0),
    locationCount:           Number(data.location_count ?? 0),
  }
}

export async function loadCommercialMaterials(accountId: string): Promise<CommercialMaterial[]> {
  const { data, error } = await supabase
    .from('commercial_material_profiles')
    .select('material')
    .eq('account_id', accountId)
  if (error || !data) return []
  return data.map((r) => r.material as CommercialMaterial)
}

// ── Display labels ───────────────────────────────────────────────────────────

export const BUSINESS_TYPE_LABELS: Record<CommercialBusinessType, string> = {
  bar:                    'Bar',
  restaurant:             'Restaurant',
  hospital:               'Hospital',
  hotel:                  'Hotel',
  school:                 'School',
  office_building:        'Office Building',
  apartment_complex:      'Apartment Complex',
  event_venue:            'Event Venue',
  retail_store:           'Retail Store',
  grocery_store:          'Grocery Store',
  manufacturing_facility: 'Manufacturing Facility',
  warehouse:              'Warehouse',
  church:                 'Church',
  nonprofit:              'Nonprofit',
  other:                  'Other',
}

export const VOLUME_TIER_LABELS: Record<CommercialVolumeTier, { label: string; sub: string }> = {
  small:      { label: 'Small',      sub: 'Up to ~25 bags / week' },
  medium:     { label: 'Medium',     sub: '~25–100 bags / week' },
  large:      { label: 'Large',      sub: '~100–500 bags / week' },
  enterprise: { label: 'Enterprise', sub: '500+ bags / week or multi-site' },
}

export const FREQUENCY_LABELS: Record<CommercialPickupFrequency, string> = {
  one_time:           'One-Time',
  weekly:             'Weekly',
  twice_weekly:       'Twice Weekly',
  three_times_weekly: 'Three Times Weekly',
  daily:              'Daily',
  on_demand:          'On Demand',
}

export const MATERIAL_LABELS: Record<CommercialMaterial, string> = {
  cardboard:        'Cardboard',
  plastic:          'Plastic',
  aluminum:         'Aluminum',
  glass:            'Glass',
  paper:            'Paper',
  mixed_recycling:  'Mixed Recycling',
  food_packaging:   'Food Packaging',
  pallets:          'Pallets',
  e_waste:          'E-Waste',
  other:            'Other',
}

export const ACCOUNT_STATUS_LABELS: Record<CommercialAccountStatus, { label: string; color: string }> = {
  draft:          { label: 'Draft',          color: '#9ca3af' },
  pending_review: { label: 'Pending Review', color: '#fbbf24' },
  approved:       { label: 'Approved',       color: '#22c55e' },
  rejected:       { label: 'Rejected',       color: '#f87171' },
  active:         { label: 'Active',         color: '#22c55e' },
  suspended:      { label: 'Suspended',      color: '#f87171' },
  pending:        { label: 'Pending',        color: '#fbbf24' },
}
