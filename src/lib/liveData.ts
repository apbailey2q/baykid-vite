/**
 * Central access point for all live Supabase data used by /live-* pages.
 * All functions here hit real database tables — no mock data, no fallbacks.
 */
import { supabase } from './supabaseClient'
import { getAllBags } from './bags'
import { getAdminStats } from './admin'
import { fetchProfile } from './auth'

export type { AdminStats, Bag, Profile } from '../types/index'

// ── Fundraisers ──────────────────────────────────────────────────────────────

export interface LiveFundraiser {
  id: string
  name: string
  description: string | null
  organization: string | null
  goal_amount: number
  raised_amount: number
  bag_count: number
  percent_to_cause: number
  status: string
  start_date: string | null
  end_date: string | null
  city: string | null
}

export async function fetchLiveFundraisers(): Promise<LiveFundraiser[]> {
  const { data, error } = await supabase
    .from('fundraisers')
    .select('id, name, description, organization, goal_amount, raised_amount, bag_count, percent_to_cause, status, start_date, end_date, city')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as LiveFundraiser[]
}

// ── Bags ─────────────────────────────────────────────────────────────────────

export { getAllBags as fetchLiveBags }

// ── Wallet ───────────────────────────────────────────────────────────────────

export interface LiveWalletTransaction {
  id: string
  type: string
  amount: number
  description: string | null
  status: string
  created_at: string
  bag_id: string | null
  reference: string | null
}

export interface LivePayoutRequest {
  id: string
  amount: number
  method: string
  status: string
  requested_at: string
}

export async function fetchLiveWalletTransactions(userId: string): Promise<LiveWalletTransaction[]> {
  const { data, error } = await supabase
    .from('wallet_transactions')
    .select('id, type, amount, description, status, created_at, bag_id, reference')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return (data ?? []) as LiveWalletTransaction[]
}

export async function fetchLiveWalletBalance(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('wallet_transactions')
    .select('amount, type')
    .eq('user_id', userId)
    .eq('status', 'completed')
  if (error) throw error
  return (data ?? []).reduce((sum, tx) => {
    const credit = ['earning', 'bonus', 'referral', 'adjustment'].includes(tx.type as string)
    return sum + (credit ? (tx.amount as number) : -(tx.amount as number))
  }, 0)
}

export async function fetchLivePayoutRequests(userId: string): Promise<LivePayoutRequest[]> {
  const { data, error } = await supabase
    .from('payout_requests')
    .select('id, amount, method, status, requested_at')
    .eq('user_id', userId)
    .order('requested_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as LivePayoutRequest[]
}

// ── Admin stats ───────────────────────────────────────────────────────────────

export { getAdminStats as fetchLiveAdminStats }

// ── Profile ───────────────────────────────────────────────────────────────────

export { fetchProfile as fetchLiveProfile }
