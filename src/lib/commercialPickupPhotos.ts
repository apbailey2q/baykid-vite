// commercialPickupPhotos.ts — Supabase Storage helpers for the PRIVATE
// 'commercial-pickup-photos' bucket (Phase G.5).
//
// Bucket:  commercial-pickup-photos (private, 10MB cap, image/* + heic/heif —
//          see supabase/migrations/20260622000001_commercial_pickup_g5_audit_and_photos.sql)
// Path:    '<pickupId>/<uploaderId>-<timestamp>.<ext>' — path-based storage RLS
//          requires the first segment to be a pickup the uploader has access to.
//
// Reads must always go through createSignedUrl — never getPublicUrl on this bucket.

import { supabase } from './supabase'
import type { CommercialPickupPhoto, CommercialPickupPhotoStage } from '../types'

const BUCKET    = 'commercial-pickup-photos'
const MAX_BYTES = 10 * 1024 * 1024
const ALLOWED   = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
])

export interface PhotoUploadResult {
  ok:           boolean
  filePath?:    string
  photoRowId?:  string
  error?:       string
}

function extFor(file: File): string {
  const fromName = file.name.split('.').pop()?.toLowerCase()
  if (fromName && /^[a-z0-9]{1,5}$/.test(fromName)) return fromName
  if (file.type === 'image/png')  return 'png'
  if (file.type === 'image/webp') return 'webp'
  if (file.type === 'image/heic') return 'heic'
  if (file.type === 'image/heif') return 'heif'
  return 'jpg'
}

/**
 * Upload a pickup photo to the private bucket AND insert a
 * commercial_pickup_photos row. RLS on both the bucket and the table
 * enforces that the uploader is either the account owner (for stage
 * 'request' on a pre-dispatch pickup) or the assigned commercial-capable
 * driver (any other stage). driver_1099 is blocked server-side.
 */
export async function uploadPickupPhoto(
  pickupId:    string,
  uploaderId:  string,
  file:        File,
  stage:       CommercialPickupPhotoStage = 'other',
  caption?:    string,
): Promise<PhotoUploadResult> {
  if (!pickupId)               return { ok: false, error: 'Missing pickup id' }
  if (!uploaderId)             return { ok: false, error: 'Missing uploader id' }
  if (!file)                   return { ok: false, error: 'No file selected' }
  if (file.size > MAX_BYTES)   return { ok: false, error: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 10 MB.` }
  if (!ALLOWED.has(file.type)) return { ok: false, error: `Unsupported file type: ${file.type || 'unknown'}. Use JPEG, PNG, WebP, HEIC, or HEIF.` }

  const ext      = extFor(file)
  const filePath = `${pickupId}/${uploaderId}-${Date.now()}.${ext}`

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, file, {
      contentType:  file.type,
      upsert:       false,
      cacheControl: '0',
    })
  if (upErr) return { ok: false, error: upErr.message }

  const { data: row, error: insErr } = await supabase
    .from('commercial_pickup_photos')
    .insert({
      pickup_id:    pickupId,
      uploaded_by:  uploaderId,
      stage,
      storage_path: filePath,
      caption:      caption?.trim() || null,
    })
    .select('id')
    .single()

  if (insErr) {
    // Best-effort cleanup if the row insert fails after upload
    await supabase.storage.from(BUCKET).remove([filePath]).catch(() => undefined)
    return { ok: false, error: insErr.message }
  }

  // Best-effort event log (RLS allows the actor to insert into events table
  // implicitly via the trigger; for a manual note we use the same surface).
  await supabase.from('commercial_pickup_events').insert({
    pickup_id:  pickupId,
    event_type: 'photo_uploaded',
    payload:    { stage, photo_id: row?.id, storage_path: filePath },
  }).then(() => undefined, () => undefined)

  return { ok: true, filePath, photoRowId: row?.id as string }
}

/** Returns a signed URL valid for `expiresSec` seconds (default 1 hour). */
export async function getSignedPickupPhotoUrl(
  storagePath: string,
  expiresSec:  number = 3600,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiresSec)
  if (error || !data?.signedUrl) return { ok: false, error: error?.message ?? 'signed_url_failed' }
  return { ok: true, url: data.signedUrl }
}

/** Bulk-sign every photo in the supplied list. Resolves in parallel. */
export async function signMany(
  photos: CommercialPickupPhoto[],
  expiresSec: number = 3600,
): Promise<Array<CommercialPickupPhoto & { signedUrl: string | null }>> {
  return Promise.all(
    photos.map(async (p) => {
      const r = await getSignedPickupPhotoUrl(p.storage_path, expiresSec)
      return { ...p, signedUrl: r.ok ? (r.url ?? null) : null }
    }),
  )
}

export async function deletePickupPhoto(
  photoRowId:   string,
  storagePath:  string,
): Promise<{ ok: boolean; error?: string }> {
  const { error: delErr } = await supabase.from('commercial_pickup_photos').delete().eq('id', photoRowId)
  if (delErr) return { ok: false, error: delErr.message }
  await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => undefined)
  return { ok: true }
}
