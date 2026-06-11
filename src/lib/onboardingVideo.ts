// AP.3D — Onboarding video data layer.

import { supabase } from './supabase'

export interface OnboardingVideo {
  id: string
  title: string
  description: string | null
  video_url: string
  storage_path: string
  audience: string
  version: number
  is_active: boolean
  uploaded_by: string | null
  created_at: string
  updated_at: string
}

export async function getActiveOnboardingVideo(
  audience = 'consumer',
): Promise<OnboardingVideo | null> {
  const { data, error } = await supabase
    .from('onboarding_videos')
    .select('*')
    .eq('audience', audience)
    .eq('is_active', true)
    .single()

  if (error) {
    // PGRST116 = no rows found — not a real error here
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data as OnboardingVideo
}

export async function getAllOnboardingVideos(): Promise<OnboardingVideo[]> {
  const { data, error } = await supabase
    .from('onboarding_videos')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as OnboardingVideo[]
}

export interface UploadVideoOptions {
  file: File
  title: string
  description: string
  audience: string
  uploadedBy: string
}

export async function uploadOnboardingVideo(
  opts: UploadVideoOptions,
): Promise<OnboardingVideo> {
  const ext = opts.file.name.split('.').pop() ?? 'mp4'
  const timestamp = Date.now()
  const storagePath = `${opts.audience}/${timestamp}.${ext}`

  // Upload to storage
  const { error: uploadError } = await supabase.storage
    .from('onboarding-videos')
    .upload(storagePath, opts.file, {
      contentType: opts.file.type,
      upsert: false,
    })

  if (uploadError) throw uploadError

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('onboarding-videos')
    .getPublicUrl(storagePath)

  // Compute next version number for this audience
  const { data: existing } = await supabase
    .from('onboarding_videos')
    .select('version')
    .eq('audience', opts.audience)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()

  const version = existing ? (existing as { version: number }).version + 1 : 1

  const { data, error } = await supabase
    .from('onboarding_videos')
    .insert({
      title: opts.title,
      description: opts.description || null,
      video_url: urlData.publicUrl,
      storage_path: storagePath,
      audience: opts.audience,
      version,
      is_active: false,
      uploaded_by: opts.uploadedBy,
    })
    .select('*')
    .single()

  if (error) throw error
  return data as OnboardingVideo
}

export async function setVideoActive(
  videoId: string,
  audience: string,
): Promise<void> {
  // Deactivate all other videos for this audience first
  const { error: deactivateError } = await supabase
    .from('onboarding_videos')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('audience', audience)
    .neq('id', videoId)

  if (deactivateError) throw deactivateError

  // Activate the selected video
  const { error } = await supabase
    .from('onboarding_videos')
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .eq('id', videoId)

  if (error) throw error
}

export async function setVideoInactive(videoId: string): Promise<void> {
  const { error } = await supabase
    .from('onboarding_videos')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', videoId)

  if (error) throw error
}

export async function deleteOnboardingVideo(
  video: OnboardingVideo,
): Promise<void> {
  // Remove from storage
  const { error: storageError } = await supabase.storage
    .from('onboarding-videos')
    .remove([video.storage_path])

  // Non-fatal: storage object may already be gone; still delete the DB record
  if (storageError) console.warn('[onboardingVideo] storage delete failed:', storageError)

  const { error } = await supabase
    .from('onboarding_videos')
    .delete()
    .eq('id', video.id)

  if (error) throw error
}
