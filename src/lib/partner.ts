import { supabase } from './supabase'
import type { PartnerStats } from '../types'

export async function getPartnerStats(): Promise<PartnerStats> {
  const { data: { user } } = await supabase.auth.getUser()
  const partnerId = user?.id

  const [bagsRes, inspRes, redRes] = await Promise.all([
    supabase
      .from('bags')
      .select('id, status, created_at')
      .eq('partner_id', partnerId!),
    supabase
      .from('inspections')
      .select('status, bags!inner(partner_id)')
      .eq('bags.partner_id', partnerId!),
    supabase
      .from('inspections')
      .select('id, inspection_reviews(id), bags!inner(partner_id)')
      .eq('status', 'red')
      .eq('bags.partner_id', partnerId!),
  ])

  const bags = bagsRes.data ?? []
  const inspections = inspRes.data ?? []
  const redInspections = (redRes.data ?? []) as Array<{
    id: string
    inspection_reviews: Array<{ id: string }>
  }>

  const now = new Date()
  const weeklyActivity = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(now)
    day.setDate(day.getDate() - (6 - i))
    day.setHours(0, 0, 0, 0)
    const next = new Date(day)
    next.setDate(next.getDate() + 1)
    const count = bags.filter((b) => {
      const created = new Date(b.created_at as string)
      return created >= day && created < next
    }).length
    return {
      date: day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      bags: count,
    }
  })

  return {
    totalBags: bags.length,
    completedBags: bags.filter((b) => b.status === 'completed').length,
    inspectedBags: bags.filter((b) =>
      ['inspected', 'completed'].includes(b.status as string),
    ).length,
    passedInspections: inspections.filter((i) => i.status !== 'red').length,
    failedInspections: inspections.filter((i) => i.status === 'red').length,
    pendingReview: redInspections.filter((i) => i.inspection_reviews.length === 0).length,
    weeklyActivity,
  }
}
