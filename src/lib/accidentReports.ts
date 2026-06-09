// accidentReports.ts — Accident / Incident Report data layer
//
// Cyan's Brooklynn Recycling Enterprise LLC
//
// Supports both consumer (driver_1099) and commercial (commercial_only/hybrid_driver)
// driver variants. All DB interactions use the authenticated user's session — drivers
// can only read/write their own reports; admins have full access via is_admin() RLS.

import { supabase } from './supabase'

// ── Photo categories ──────────────────────────────────────────────────────────

export const REQUIRED_PHOTO_CATEGORIES = [
  { key: 'entire_scene',     label: 'Entire Scene',       icon: '🌐' },
  { key: 'both_vehicles',    label: 'Both Vehicles',      icon: '🚗' },
  { key: 'license_plates',   label: 'License Plates',     icon: '🔢' },
  { key: 'damage',           label: 'Damage',             icon: '💥' },
  { key: 'road_conditions',  label: 'Road Conditions',    icon: '🛣️'  },
  { key: 'weather_conditions', label: 'Weather Conditions', icon: '🌦️' },
] as const

export type PhotoCategory = typeof REQUIRED_PHOTO_CATEGORIES[number]['key'] | 'other'

// ── Accident types by driver variant ─────────────────────────────────────────

export const CONSUMER_ACCIDENT_TYPES = [
  'Vehicle accident',
  'Property damage',
  'Injury',
  'Customer confrontation',
  'Unsafe pickup location',
  'Animal threat',
  'Road hazard',
  'Weather-related accident',
  'Bag spill or contamination event',
  'Other',
] as const

export const COMMERCIAL_ACCIDENT_TYPES = [
  'Vehicle accident',
  'Loading/unloading accident',
  'Bin/container damage',
  'Business property damage',
  'Hazardous material exposure',
  'Waste spill',
  'Injury',
  'Road hazard',
  'Weather-related accident',
  'Customer site safety issue',
  'Other',
] as const

// ── Checklist step keys ───────────────────────────────────────────────────────

export const CHECKLIST_STEPS = [
  { key: 'stop',       label: 'Stop vehicle immediately.' },
  { key: 'hazards',    label: 'Activate hazard lights.' },
  { key: 'injuries',   label: 'Assess injuries.' },
  { key: 'emergency',  label: 'Call emergency services if required.' },
  { key: 'photos',     label: 'Take photographs.' },
  { key: 'hq_notify',  label: 'Notify dispatch / headquarters.' },
  { key: 'report',     label: 'Complete incident report.' },
  { key: 'await',      label: 'Await instructions.' },
] as const

export type ChecklistKey = typeof CHECKLIST_STEPS[number]['key']

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ManualLocation {
  street:   string
  city:     string
  state:    string
  zip:      string
  landmark: string
  notes:    string
}

export interface CommercialIncidentDetails {
  route_id?:     string
  business_name?: string
  bin_id?:       string
  site_name?:    string
  incident_type?: string  // loading/dock/hazmat/spill/etc.
}

export interface AccidentReport {
  id:                         string
  driver_id:                  string
  driver_name:                string
  driver_type:                'consumer' | 'commercial'
  report_type:                string
  accident_type:              string
  injury_involved:            'yes' | 'no' | 'unknown' | null
  emergency_services_called:  'yes' | 'no' | null
  police_report_number:       string | null
  incident_date:              string | null
  incident_time:              string | null
  gps_latitude:               number | null
  gps_longitude:              number | null
  gps_accuracy:               number | null
  gps_timestamp:              string | null
  gps_address:                string | null
  manual_location:            ManualLocation | null
  weather:                    string | null
  road_conditions:            string | null
  vehicle_id:                 string | null
  damage_description:         string | null
  driver_statement:           string | null
  witness_name:               string | null
  witness_contact:            string | null
  witness_statement:          string | null
  other_party_name:           string | null
  other_party_plate:          string | null
  other_insurance:            string | null
  commercial_route_id:        string | null
  commercial_business_name:   string | null
  commercial_bin_id:          string | null
  commercial_site_name:       string | null
  commercial_incident_details: CommercialIncidentDetails | null
  checklist_completed:        ChecklistKey[]
  all_checklist_done:         boolean
  headquarters_call_clicked:  boolean
  headquarters_call_timestamp: string | null
  photo_safety_exception:     boolean
  photo_safety_reason:        string | null
  status:                     'draft' | 'submitted' | 'under_review' | 'needs_info' | 'escalated' | 'closed'
  admin_notes:                string | null
  dispatch_notes:             string | null
  reviewed_by:                string | null
  reviewed_at:                string | null
  created_at:                 string
  updated_at:                 string
}

export interface AccidentReportPhoto {
  id:          string
  report_id:   string
  driver_id:   string
  photo_url:   string
  category:    PhotoCategory
  caption:     string | null
  uploaded_at: string
}

export interface AccidentReportResult<T = void> {
  ok:    boolean
  data?: T
  error?: string
}

// ── HEADQUARTERS PHONE ────────────────────────────────────────────────────────
// Update this number for production deployment.
export const HQ_PHONE_NUMBER  = '+1-800-CBR-SAFE'
export const HQ_PHONE_TEL     = 'tel:+18002277233'   // placeholder — update before launch

// ── Create a new draft report ────────────────────────────────────────────────

export async function createDraftAccidentReport(
  driverUserId: string,
  driverName:   string,
  driverType:   'consumer' | 'commercial',
): Promise<AccidentReportResult<AccidentReport>> {
  try {
    const now = new Date()
    const dateStr = now.toISOString().slice(0, 10)
    const timeStr = now.toTimeString().slice(0, 5)

    const { data, error } = await supabase
      .from('accident_reports')
      .insert({
        driver_id:    driverUserId,
        driver_name:  driverName,
        driver_type:  driverType,
        incident_date: dateStr,
        incident_time: timeStr,
        status:       'draft',
      })
      .select('*')
      .single()

    if (error) return { ok: false, error: error.message }
    return { ok: true, data: data as AccidentReport }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ── Update report fields (partial) ───────────────────────────────────────────

export async function updateAccidentReport(
  reportId: string,
  updates:  Partial<Omit<AccidentReport, 'id' | 'driver_id' | 'created_at' | 'updated_at'>>,
): Promise<AccidentReportResult<AccidentReport>> {
  try {
    const { data, error } = await supabase
      .from('accident_reports')
      .update(updates)
      .eq('id', reportId)
      .select('*')
      .single()

    if (error) return { ok: false, error: error.message }
    return { ok: true, data: data as AccidentReport }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ── Submit a completed report ─────────────────────────────────────────────────

export async function submitAccidentReport(
  reportId: string,
): Promise<AccidentReportResult<AccidentReport>> {
  return updateAccidentReport(reportId, { status: 'submitted' })
}

// ── Save an emergency draft (partial submit) ──────────────────────────────────

export async function saveEmergencyDraft(
  reportId: string,
  updates:  Partial<Omit<AccidentReport, 'id' | 'driver_id' | 'created_at' | 'updated_at'>>,
): Promise<AccidentReportResult<AccidentReport>> {
  return updateAccidentReport(reportId, { ...updates, status: 'draft' })
}

// ── Upload a photo ────────────────────────────────────────────────────────────

export async function uploadAccidentPhoto(
  reportId:  string,
  driverId:  string,
  file:      File,
  category:  PhotoCategory,
): Promise<AccidentReportResult<AccidentReportPhoto>> {
  try {
    // Validate size (max 5 MB)
    if (file.size > 5 * 1024 * 1024) {
      return { ok: false, error: 'Photo must be 5 MB or smaller.' }
    }

    // Upload to Supabase Storage
    const ext      = file.name.split('.').pop() ?? 'jpg'
    const filePath = `${driverId}/${reportId}/${category}_${Date.now()}.${ext}`

    const { error: uploadErr } = await supabase.storage
      .from('accident-report-photos')
      .upload(filePath, file, { upsert: false })

    if (uploadErr) return { ok: false, error: uploadErr.message }

    const { data: urlData } = supabase.storage
      .from('accident-report-photos')
      .getPublicUrl(filePath)

    const photoUrl = urlData.publicUrl

    // Insert record
    const { data, error } = await supabase
      .from('accident_report_photos')
      .insert({ report_id: reportId, driver_id: driverId, photo_url: photoUrl, category })
      .select('*')
      .single()

    if (error) return { ok: false, error: error.message }
    return { ok: true, data: data as AccidentReportPhoto }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ── Delete a photo ────────────────────────────────────────────────────────────

export async function deleteAccidentPhoto(photoId: string): Promise<AccidentReportResult> {
  try {
    const { error } = await supabase
      .from('accident_report_photos')
      .delete()
      .eq('id', photoId)

    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ── Fetch photos for a report ─────────────────────────────────────────────────

export async function getReportPhotos(
  reportId: string,
): Promise<AccidentReportResult<AccidentReportPhoto[]>> {
  try {
    const { data, error } = await supabase
      .from('accident_report_photos')
      .select('*')
      .eq('report_id', reportId)
      .order('uploaded_at', { ascending: true })

    if (error) return { ok: false, error: error.message }
    return { ok: true, data: (data ?? []) as AccidentReportPhoto[] }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ── Fetch driver's own reports ────────────────────────────────────────────────

export async function getDriverAccidentReports(
  driverId: string,
): Promise<AccidentReportResult<AccidentReport[]>> {
  try {
    const { data, error } = await supabase
      .from('accident_reports')
      .select('*')
      .eq('driver_id', driverId)
      .order('created_at', { ascending: false })

    if (error) return { ok: false, error: error.message }
    return { ok: true, data: (data ?? []) as AccidentReport[] }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ── Admin: fetch all reports (paginated) ──────────────────────────────────────

export async function getAllAccidentReports(opts?: {
  status?:  AccidentReport['status']
  limit?:   number
  offset?:  number
}): Promise<AccidentReportResult<AccidentReport[]>> {
  try {
    let q = supabase
      .from('accident_reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(opts?.limit ?? 50)

    if (opts?.status) q = q.eq('status', opts.status)
    if (opts?.offset)  q = q.range(opts.offset, (opts.offset) + (opts.limit ?? 50) - 1)

    const { data, error } = await q
    if (error) return { ok: false, error: error.message }
    return { ok: true, data: (data ?? []) as AccidentReport[] }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ── Admin: update report status or notes ─────────────────────────────────────

export async function adminUpdateAccidentReport(
  reportId: string,
  updates:  {
    status?:       AccidentReport['status']
    admin_notes?:  string
    dispatch_notes?: string
    reviewed_by?:  string
    reviewed_at?:  string
  },
): Promise<AccidentReportResult<AccidentReport>> {
  return updateAccidentReport(reportId, updates)
}

// ── GPS location capture helper ───────────────────────────────────────────────

export interface GpsResult {
  latitude:  number
  longitude: number
  accuracy:  number
  timestamp: string
  address?:  string
}

export async function captureGpsLocation(): Promise<
  { ok: true; data: GpsResult } | { ok: false; error: string }
> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ ok: false, error: 'Geolocation is not supported by this device.' })
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          ok: true,
          data: {
            latitude:  pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy:  pos.coords.accuracy,
            timestamp: new Date(pos.timestamp).toISOString(),
          },
        })
      },
      (err) => {
        const msg =
          err.code === 1 ? 'Location permission denied. Please enter location manually.' :
          err.code === 2 ? 'Location unavailable. Please enter location manually.' :
          err.code === 3 ? 'Location request timed out. Please enter location manually.' :
          'Could not get location. Please enter location manually.'
        resolve({ ok: false, error: msg })
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    )
  })
}

// ── Validate required fields before submission ────────────────────────────────

export interface ValidationResult {
  valid:    boolean
  missing:  string[]
}

export function validateAccidentReport(
  report:      Partial<AccidentReport>,
  photos:      AccidentReportPhoto[],
): ValidationResult {
  const missing: string[] = []

  if (!report.all_checklist_done)         missing.push('Safety checklist not complete')
  if (!report.headquarters_call_clicked)  missing.push('Headquarters call not initiated')
  if (!report.incident_date)              missing.push('Date is required')
  if (!report.incident_time)              missing.push('Time is required')
  if (!report.accident_type)             missing.push('Accident type is required')
  if (!report.injury_involved)           missing.push('Injury status is required')
  if (!report.emergency_services_called) missing.push('Emergency services question is required')
  if (!report.driver_statement?.trim())  missing.push('Driver statement is required')

  const hasLocation = (report.gps_latitude != null && report.gps_longitude != null)
    || (report.manual_location && (
      (report.manual_location as ManualLocation).street?.trim() ||
      (report.manual_location as ManualLocation).city?.trim()
    ))
  if (!hasLocation) missing.push('Location (GPS or manual) is required')

  if (!report.photo_safety_exception) {
    const uploadedCategories = new Set(photos.map((p) => p.category))
    const missing_photos = REQUIRED_PHOTO_CATEGORIES.filter(
      (c) => !uploadedCategories.has(c.key as PhotoCategory),
    )
    if (missing_photos.length > 0) {
      missing.push(`Photos required: ${missing_photos.map((c) => c.label).join(', ')}`)
    }
  } else {
    if (!report.photo_safety_reason?.trim()) {
      missing.push('Safety exception reason is required when photos cannot be taken')
    }
  }

  return { valid: missing.length === 0, missing }
}

// ── Emergency draft validation ────────────────────────────────────────────────

export function validateEmergencyDraft(
  report: Partial<AccidentReport>,
  photos: AccidentReportPhoto[],
): ValidationResult {
  const missing: string[] = []

  if (!report.headquarters_call_clicked) missing.push('Headquarters call must be initiated before saving draft')

  const hasLocation = (report.gps_latitude != null && report.gps_longitude != null)
    || (report.manual_location && (
      (report.manual_location as ManualLocation).street?.trim() ||
      (report.manual_location as ManualLocation).city?.trim()
    ))
  if (!hasLocation) missing.push('Location is required for emergency draft')

  if (!report.driver_statement?.trim()?.length) missing.push('Driver statement is required for emergency draft')

  const hasPhotoOrException = photos.length > 0 || report.photo_safety_exception
  if (!hasPhotoOrException) missing.push('At least one photo or a safety exception is required for emergency draft')

  return { valid: missing.length === 0, missing }
}
