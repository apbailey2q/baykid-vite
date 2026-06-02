// postMedia.ts — Supabase Storage upload helpers for image media on AI posts.
//
// Bucket: 'post_media' (public, image/* only, ≤10MB — see migration
// 20260615000003_post_media_storage.sql).
//
// Returned publicUrl is exactly what we hand to the Meta Graph API as
// image_url for IG /media containers and FB /photos. Must be HTTPS,
// publicly reachable, and within size/format limits Meta accepts.

import { supabase } from './supabase'

const BUCKET    = 'post_media'
const MAX_BYTES = 10 * 1024 * 1024
const ALLOWED   = new Set(['image/jpeg', 'image/png', 'image/webp'])

export interface UploadResult {
  ok:    boolean
  url?:  string
  path?: string
  error?: string
}

function sanitizeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60)
}

function randomSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** Upload an image file to post_media. Returns the public URL on success. */
export async function uploadPostMedia(postId: string, file: File): Promise<UploadResult> {
  if (!file)                return { ok: false, error: 'No file selected' }
  if (file.size > MAX_BYTES) return { ok: false, error: `Image too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 10 MB.` }
  if (!ALLOWED.has(file.type)) return { ok: false, error: `Unsupported image type: ${file.type || 'unknown'}. Use JPEG, PNG, or WebP.` }

  const ext  = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${sanitizeId(postId)}/${randomSuffix()}.${ext}`

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      contentType:  file.type,
      upsert:       false,
      cacheControl: '31536000', // 1y — each path is unique so immutable
    })

  if (upErr) return { ok: false, error: upErr.message }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  if (!data?.publicUrl) return { ok: false, error: 'Upload succeeded but public URL could not be resolved' }

  return { ok: true, url: data.publicUrl, path }
}

/** Best-effort cleanup. Only removes the underlying object — does NOT touch
 *  the post.mediaUrl (the caller owns that). */
export async function deletePostMediaPath(path: string): Promise<{ ok: boolean; error?: string }> {
  if (!path) return { ok: false, error: 'No path' }
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

/** Recover the storage path from a public URL we issued. Returns null if the
 *  URL is not a post_media URL (e.g. user pasted an external URL). */
export function pathFromPublicUrl(url: string): string | null {
  const marker = `/storage/v1/object/public/${BUCKET}/`
  const i = url.indexOf(marker)
  if (i < 0) return null
  return url.slice(i + marker.length)
}
