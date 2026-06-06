// driverDocuments.ts — Supabase Storage helpers for the PRIVATE
// 'driver_documents' bucket.
//
// Bucket:  driver_documents (private, 15MB cap, image/* or PDF — see
//          supabase/migrations/20260605000002_driver_compliance.sql)
// Path:    '<driverId>/<documentType>-<timestamp>.<ext>'   — path-based RLS
//          requires the first segment to equal auth.uid().
//
// Reads are always signed-URL only; never expose getPublicUrl for this bucket.

import { supabase } from './supabase'
import type { DriverDocument, DriverDocumentType } from '../types'

const BUCKET    = 'driver_documents'
const MAX_BYTES = 15 * 1024 * 1024
const ALLOWED   = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])

export interface DocumentUploadResult {
  ok:        boolean
  filePath?: string
  error?:    string
}

function extFor(file: File): string {
  const fromName = file.name.split('.').pop()?.toLowerCase()
  if (fromName && /^[a-z0-9]{1,5}$/.test(fromName)) return fromName
  if (file.type === 'application/pdf') return 'pdf'
  if (file.type === 'image/png')       return 'png'
  if (file.type === 'image/webp')      return 'webp'
  return 'jpg'
}

/**
 * Upload a driver compliance document and upsert the driver_documents row.
 * The authenticated user must be the driver themselves OR an admin — RLS on
 * storage.objects (path-based) and on driver_documents both enforce this.
 */
export async function uploadDriverDocument(
  driverId:     string,
  documentType: DriverDocumentType,
  file:         File,
): Promise<DocumentUploadResult> {
  if (!driverId)               return { ok: false, error: 'Missing driver id' }
  if (!file)                   return { ok: false, error: 'No file selected' }
  if (file.size > MAX_BYTES)   return { ok: false, error: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 15 MB.` }
  if (!ALLOWED.has(file.type)) return { ok: false, error: `Unsupported file type: ${file.type || 'unknown'}. Use JPEG, PNG, WebP, or PDF.` }

  const ext      = extFor(file)
  const filePath = `${driverId}/${documentType}-${Date.now()}.${ext}`

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, file, {
      contentType:  file.type,
      upsert:       false,
      cacheControl: '0', // private bucket — never cache
    })
  if (upErr) return { ok: false, error: upErr.message }

  // Upsert the row — one current document per (driver_id, document_type).
  // status resets to 'pending_review' on every re-upload; clear any prior
  // review verdict so admins re-evaluate the new file.
  const { error: dbErr } = await supabase
    .from('driver_documents')
    .upsert(
      {
        driver_id:     driverId,
        document_type: documentType,
        file_path:     filePath,
        status:        'pending_review',
        uploaded_at:   new Date().toISOString(),
        reviewed_at:   null,
        reviewed_by:   null,
        notes:         null,
      },
      { onConflict: 'driver_id,document_type' },
    )
  if (dbErr) return { ok: false, error: dbErr.message }

  return { ok: true, filePath }
}

/**
 * Mint a signed URL for a private object. Expires in `expiresSec` seconds
 * (default 1 hour). Returns null if the path is empty or Supabase rejects
 * the request (RLS denial, missing object).
 */
export async function getSignedUrl(filePath: string, expiresSec = 3600): Promise<string | null> {
  if (!filePath) return null
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(filePath, expiresSec)
  if (error || !data?.signedUrl) return null
  return data.signedUrl
}

/** Convenience — same shape as loadDriverDocuments in driverCompliance.ts but
 *  scoped to this module so the upload UI can refresh in-place after upsert. */
export async function listDriverDocuments(driverId: string): Promise<DriverDocument[]> {
  if (!driverId) return []
  const { data, error } = await supabase
    .from('driver_documents')
    .select('*')
    .eq('driver_id', driverId)
    .order('uploaded_at', { ascending: false })
  if (error) throw error
  return (data as DriverDocument[] | null) ?? []
}
