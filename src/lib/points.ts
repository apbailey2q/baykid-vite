import { supabase } from './supabase'
import type { Bag } from '../types'

export interface UserPoints {
  id: string
  user_id: string
  total_points: number
  updated_at: string
}

export interface PointEvent {
  id: string
  user_id: string
  bag_id: string | null
  points: number
  reason: string
  created_at: string
}

export interface WeeklyActivity {
  date: string
  day: string
  bags: number
}

// ── Read ──────────────────────────────────────────────────────────────────────

export async function getConsumerPoints(userId: string): Promise<UserPoints | null> {
  const { data } = await supabase
    .from('user_points')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  return data as UserPoints | null
}

export async function getConsumerBags(userId: string): Promise<Bag[]> {
  const { data, error } = await supabase
    .from('bags')
    .select('*')
    .eq('consumer_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Bag[]
}

export async function getConsumerWeeklyActivity(userId: string): Promise<WeeklyActivity[]> {
  const now = new Date()
  const weekAgo = new Date(now)
  weekAgo.setDate(weekAgo.getDate() - 6)
  weekAgo.setHours(0, 0, 0, 0)

  const { data } = await supabase
    .from('bags')
    .select('created_at')
    .eq('consumer_id', userId)
    .gte('created_at', weekAgo.toISOString())

  const bags = (data ?? []) as Array<{ created_at: string }>

  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(now)
    day.setDate(day.getDate() - (6 - i))
    day.setHours(0, 0, 0, 0)
    const next = new Date(day)
    next.setDate(next.getDate() + 1)

    const count = bags.filter((b) => {
      const d = new Date(b.created_at)
      return d >= day && d < next
    }).length

    return {
      date: day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      day: ['S', 'M', 'T', 'W', 'T', 'F', 'S'][day.getDay()],
      bags: count,
    }
  })
}

export async function getConsumerStreak(userId: string): Promise<number> {
  const { data } = await supabase
    .from('bags')
    .select('created_at')
    .eq('consumer_id', userId)
    .order('created_at', { ascending: false })

  const bags = (data ?? []) as Array<{ created_at: string }>
  if (bags.length === 0) return 0

  const daySet = new Set(
    bags.map((b) => {
      const d = new Date(b.created_at)
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    }),
  )

  let streak = 0
  const today = new Date()
  for (let i = 0; i < 365; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    if (daySet.has(key)) streak++
    else if (i > 0) break
  }
  return streak
}

// ── Write ─────────────────────────────────────────────────────────────────────

export async function awardPoints(
  userId: string,
  bagId: string | null,
  points: number,
  reason: string,
): Promise<void> {
  const { error } = await supabase.rpc('award_points', {
    p_user_id: userId,
    p_bag_id: bagId,
    p_points: points,
    p_reason: reason,
  })
  if (error) throw error
}

export async function getBroadcastsForRole(role: string): Promise<
  Array<{ id: string; target_role: string; message: string; created_at: string }>
> {
  const { data, error } = await supabase
    .from('broadcast_alerts')
    .select('id, target_role, message, created_at')
    .in('target_role', ['all', role])
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) throw error
  return data ?? []
}
