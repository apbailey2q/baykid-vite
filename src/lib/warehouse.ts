import { supabase } from './supabase'
import { recordScan, updateBagStatus } from './bags'
import type { Bag, InspectionStatus } from '../types'

export interface NestedReview {
  id: string
  decision: string
  override_status: string | null
  notes: string | null
  created_at: string
}

export interface InspectionWithDetails {
  id: string
  bag_id: string
  inspector_id: string
  status: InspectionStatus
  notes: string | null
  created_at: string
  bags: { id: string; bag_code: string; status: string } | null
  inspection_photos: Array<{ id: string; photo_url: string }>
  inspection_reviews: NestedReview[]
}

export interface WarehouseStats {
  bagsScannedToday: number
  bagsInspectedToday: number
  passedToday: number
  failedToday: number
  pendingReview: number
}

export async function markBagAtWarehouse(bagId: string, userId: string): Promise<void> {
  const { data: bag } = await supabase
    .from('bags')
    .select('status')
    .eq('id', bagId)
    .maybeSingle()

  await recordScan(bagId, userId)

  if (bag && ['pending', 'assigned', 'picked_up'].includes(bag.status as string)) {
    await updateBagStatus(bagId, 'at_warehouse')
  }
}

export async function getInspectionQueue(): Promise<Bag[]> {
  const { data, error } = await supabase
    .from('bags')
    .select('*')
    .eq('status', 'at_warehouse')
    .order('updated_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as Bag[]
}

export async function getFlaggedInspections(): Promise<InspectionWithDetails[]> {
  const { data, error } = await supabase
    .from('inspections')
    .select('*, bags!bag_id(id, bag_code, status), inspection_photos(*), inspection_reviews(*)')
    .eq('status', 'red')
    .order('created_at', { ascending: false })

  if (error) throw error
  return ((data ?? []) as InspectionWithDetails[]).filter(
    (i) => i.inspection_reviews.length === 0,
  )
}

export async function getAllInspections(limit = 100): Promise<InspectionWithDetails[]> {
  const { data, error } = await supabase
    .from('inspections')
    .select('*, bags!bag_id(id, bag_code, status), inspection_photos(*), inspection_reviews(*)')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []) as InspectionWithDetails[]
}

export async function approveInspection(
  inspectionId: string,
  reviewerId: string,
  notes?: string,
): Promise<void> {
  const { error } = await supabase.from('inspection_reviews').insert({
    inspection_id: inspectionId,
    reviewer_id: reviewerId,
    decision: 'approved',
    notes: notes ?? null,
  })
  if (error) throw error
}

export async function overrideInspection(
  bagId: string,
  originalInspectionId: string,
  reviewerId: string,
  newStatus: InspectionStatus,
  notes?: string,
): Promise<void> {
  const noteText = notes ? `[Supervisor override] ${notes}` : '[Supervisor override]'

  const { error: inspErr } = await supabase.from('inspections').insert({
    bag_id: bagId,
    inspector_id: reviewerId,
    status: newStatus,
    notes: noteText,
  })
  if (inspErr) throw inspErr

  await updateBagStatus(bagId, 'inspected')

  const { error: reviewErr } = await supabase.from('inspection_reviews').insert({
    inspection_id: originalInspectionId,
    reviewer_id: reviewerId,
    decision: 'overridden',
    override_status: newStatus,
    notes: notes ?? null,
  })
  if (reviewErr) throw reviewErr
}

export interface MyStats {
  scansToday: number
  inspectionsToday: number
  greenToday: number
  yellowToday: number
  redToday: number
}

export interface DailyTrend {
  date: string
  day: string
  inspections: number
  passed: number
  failed: number
}

export async function getMyStatsToday(userId: string): Promise<MyStats> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayISO = today.toISOString()

  const [scansResult, inspResult] = await Promise.all([
    supabase.from('bag_scans').select('bag_id').eq('scanned_by', userId).gte('scan_time', todayISO),
    supabase.from('inspections').select('status').eq('inspector_id', userId).gte('created_at', todayISO),
  ])

  const inspections = (inspResult.data ?? []) as Array<{ status: string }>

  return {
    scansToday: new Set((scansResult.data ?? []).map((s: { bag_id: string }) => s.bag_id)).size,
    inspectionsToday: inspections.length,
    greenToday: inspections.filter((i) => i.status === 'green').length,
    yellowToday: inspections.filter((i) => i.status === 'yellow').length,
    redToday: inspections.filter((i) => i.status === 'red').length,
  }
}

export async function getWeeklyInspectionTrend(): Promise<DailyTrend[]> {
  const now = new Date()
  const weekAgo = new Date(now)
  weekAgo.setDate(weekAgo.getDate() - 6)
  weekAgo.setHours(0, 0, 0, 0)

  const { data } = await supabase
    .from('inspections')
    .select('status, created_at')
    .gte('created_at', weekAgo.toISOString())

  const inspections = (data ?? []) as Array<{ status: string; created_at: string }>

  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(now)
    day.setDate(day.getDate() - (6 - i))
    day.setHours(0, 0, 0, 0)
    const next = new Date(day)
    next.setDate(next.getDate() + 1)

    const dayInspections = inspections.filter((b) => {
      const d = new Date(b.created_at)
      return d >= day && d < next
    })

    return {
      date: day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      day: ['S', 'M', 'T', 'W', 'T', 'F', 'S'][day.getDay()],
      inspections: dayInspections.length,
      passed: dayInspections.filter((i) => i.status !== 'red').length,
      failed: dayInspections.filter((i) => i.status === 'red').length,
    }
  })
}

export async function getTodayStats(): Promise<WarehouseStats> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayISO = today.toISOString()

  const [scansResult, inspectionsResult, flaggedResult] = await Promise.all([
    supabase.from('bag_scans').select('bag_id').gte('scan_time', todayISO),
    supabase.from('inspections').select('status').gte('created_at', todayISO),
    supabase.from('inspections').select('id, inspection_reviews(id)').eq('status', 'red'),
  ])

  const scansToday = scansResult.data ?? []
  const inspectionsToday = inspectionsResult.data ?? []
  const redInspections = (flaggedResult.data ?? []) as Array<{
    id: string
    inspection_reviews: Array<{ id: string }>
  }>

  return {
    bagsScannedToday: new Set(scansToday.map((s) => s.bag_id)).size,
    bagsInspectedToday: inspectionsToday.length,
    passedToday: inspectionsToday.filter((i) => i.status !== 'red').length,
    failedToday: inspectionsToday.filter((i) => i.status === 'red').length,
    pendingReview: redInspections.filter((i) => i.inspection_reviews.length === 0).length,
  }
}
