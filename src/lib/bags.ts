import { supabase } from './supabase'
import type { Bag, BagStatus, InspectionStatus, Inspection, InspectionPhoto } from '../types'

export type InspectionWithPhotos = Inspection & { inspection_photos: InspectionPhoto[] }

export async function lookupOrCreateBag(rawCode: string): Promise<Bag> {
  const code = rawCode.trim().toUpperCase()

  const { data: existing } = await supabase
    .from('bags')
    .select('*')
    .eq('bag_code', code)
    .maybeSingle()

  if (existing) return existing as Bag

  const { data: { user } } = await supabase.auth.getUser()

  const { data: created, error } = await supabase
    .from('bags')
    .insert({ bag_code: code, status: 'pending', consumer_id: user?.id ?? null })
    .select()
    .single()

  if (error) throw error
  return created as Bag
}

/** Lookup-only — never creates. Returns null if not found. */
export async function lookupBagByCode(rawCode: string): Promise<Bag | null> {
  const code = rawCode.trim().toUpperCase()
  const { data } = await supabase
    .from('bags')
    .select('*')
    .eq('bag_code', code)
    .maybeSingle()
  return data as Bag | null
}

export async function recordScan(bagId: string, scannedBy: string, location?: string) {
  const { error } = await supabase.from('bag_scans').insert({
    bag_id: bagId,
    scanned_by: scannedBy,
    location: location ?? null,
  })
  if (error) throw error
}

export async function checkDuplicateScan(bagId: string): Promise<boolean> {
  const since = new Date(Date.now() - 5 * 60 * 1000).toISOString()
  const { data } = await supabase
    .from('bag_scans')
    .select('id')
    .eq('bag_id', bagId)
    .gte('scan_time', since)
    .limit(1)
  return (data?.length ?? 0) > 0
}

export async function getBagWithLatestInspection(bagId: string): Promise<{
  bag: Bag
  latestInspection: InspectionWithPhotos | null
}> {
  const [bagResult, inspectionResult] = await Promise.all([
    supabase.from('bags').select('*').eq('id', bagId).single(),
    supabase
      .from('inspections')
      .select('*, inspection_photos(*)')
      .eq('bag_id', bagId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (bagResult.error) throw bagResult.error

  return {
    bag: bagResult.data as Bag,
    latestInspection: inspectionResult.data as InspectionWithPhotos | null,
  }
}

export async function updateBagStatus(bagId: string, status: BagStatus) {
  const { error } = await supabase
    .from('bags')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', bagId)
  if (error) throw error
}

export async function createInspection(
  bagId: string,
  inspectorId: string,
  status: InspectionStatus,
  notes: string,
): Promise<Inspection> {
  const { data, error } = await supabase
    .from('inspections')
    .insert({ bag_id: bagId, inspector_id: inspectorId, status, notes: notes || null })
    .select()
    .single()
  if (error) throw error

  await updateBagStatus(bagId, 'inspected')
  return data as Inspection
}

export async function uploadInspectionPhoto(inspectionId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${inspectionId}/${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('inspection-photos')
    .upload(path, file)
  if (uploadError) throw uploadError

  const { data: urlData } = supabase.storage.from('inspection-photos').getPublicUrl(path)

  const { error: recordError } = await supabase
    .from('inspection_photos')
    .insert({ inspection_id: inspectionId, photo_url: urlData.publicUrl })
  if (recordError) throw recordError

  return urlData.publicUrl
}
