// commercialPickupRequests.ts — Phase G.5 read-side helpers for the
// commercial pickup audit layer (assignments / events / photos).
//
// These read from the 3 new G.5 tables created in
// 20260622000001_commercial_pickup_g5_audit_and_photos.sql. Writes are
// driven entirely by the status-transition trigger on commercial_pickups
// — clients should mutate commercial_pickups (status / driver_id /
// priority_level) and the audit log + assignment history populate
// automatically.

import { supabase } from './supabase'
import type {
  CommercialPickupAssignment,
  CommercialPickupEvent,
  CommercialPickupPhoto,
  CommercialPickupPriority,
} from '../types'

// ── Reads ────────────────────────────────────────────────────────────────────

export async function loadPickupEvents(pickupId: string): Promise<CommercialPickupEvent[]> {
  const { data, error } = await supabase
    .from('commercial_pickup_events')
    .select('*')
    .eq('pickup_id', pickupId)
    .order('created_at', { ascending: false })
  if (error || !data) return []
  return data as CommercialPickupEvent[]
}

export async function loadPickupAssignments(pickupId: string): Promise<CommercialPickupAssignment[]> {
  const { data, error } = await supabase
    .from('commercial_pickup_assignments')
    .select('*')
    .eq('pickup_id', pickupId)
    .order('assigned_at', { ascending: false })
  if (error || !data) return []
  return data as CommercialPickupAssignment[]
}

export async function loadActiveAssignmentsForDriver(driverId: string): Promise<CommercialPickupAssignment[]> {
  const { data, error } = await supabase
    .from('commercial_pickup_assignments')
    .select('*')
    .eq('driver_id', driverId)
    .eq('status', 'active')
    .order('assigned_at', { ascending: false })
  if (error || !data) return []
  return data as CommercialPickupAssignment[]
}

export async function loadPickupPhotos(pickupId: string): Promise<CommercialPickupPhoto[]> {
  const { data, error } = await supabase
    .from('commercial_pickup_photos')
    .select('*')
    .eq('pickup_id', pickupId)
    .order('created_at', { ascending: false })
  if (error || !data) return []
  return data as CommercialPickupPhoto[]
}

// ── Writes that drive the audit log via triggers ─────────────────────────────

/** Change priority on a pickup. The status-transition trigger will log
 *  a 'priority_changed' event automatically. */
export async function setPickupPriority(
  pickupId: string,
  priority: CommercialPickupPriority,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('commercial_pickups')
    .update({ priority_level: priority })
    .eq('id', pickupId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

/** Submit a draft pickup — flips status from 'draft' to 'submitted'.
 *  The trigger inserts a 'submitted' event row. */
export async function submitPickupRequest(pickupId: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('commercial_pickups')
    .update({ status: 'submitted', submitted_at: new Date().toISOString() })
    .eq('id', pickupId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

/** Cancel a pickup at any pre-completion stage. */
export async function cancelPickupRequest(pickupId: string, reason?: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('commercial_pickups')
    .update({ status: 'cancelled', safety_notes: reason ?? null })
    .eq('id', pickupId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// ── Manual event entry (notes / photo uploaded markers) ─────────────────────

export async function logPickupNote(
  pickupId: string,
  note: string,
  payload: Record<string, unknown> = {},
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('commercial_pickup_events')
    .insert({ pickup_id: pickupId, event_type: 'note', payload: { note, ...payload } })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// ── Display labels ───────────────────────────────────────────────────────────

export const PRIORITY_LABELS: Record<CommercialPickupPriority, { label: string; color: string }> = {
  low:       { label: 'Low',       color: '#9ca3af' },
  normal:    { label: 'Normal',    color: '#00c8ff' },
  high:      { label: 'High',      color: '#fbbf24' },
  emergency: { label: 'Emergency', color: '#f87171' },
}

export const EVENT_TYPE_LABELS: Record<string, string> = {
  created:          'Created',
  submitted:        'Submitted',
  scheduled:        'Scheduled',
  assigned:         'Driver assigned',
  unassigned:       'Driver unassigned',
  started:          'Started',
  arrived:          'Driver arrived',
  checked_in:       'Checked in',
  completed:        'Completed',
  cancelled:        'Cancelled',
  flagged:          'Flagged',
  reassigned:       'Reassigned',
  photo_uploaded:   'Photo uploaded',
  priority_changed: 'Priority changed',
  note:             'Note',
}
