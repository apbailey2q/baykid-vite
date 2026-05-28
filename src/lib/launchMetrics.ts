// launchMetrics.ts — Aggregation fetchers for the Launch Center.
//
// Each helper calls one of the SECURITY DEFINER RPCs from
// 20260530_launch_execution_schema.sql, which run as the function owner so
// admin-gated reads work without exposing the underlying tables to members.
//
// Reads are safe to call from React effects — they throw on failure so the
// caller can render an error state.

import { supabase } from './supabaseClient'
import type {
  LaunchSummaryCounts, LaunchOperationsMetrics,
  LaunchProductAnalytics, LaunchFeedbackSummary,
} from '../types/launch'

export async function fetchSummaryCounts(): Promise<LaunchSummaryCounts> {
  const { data, error } = await supabase.rpc('launch_summary_counts', { p_org_id: null })
  if (error) throw error
  return data as LaunchSummaryCounts
}

export async function fetchOperationsMetrics(): Promise<LaunchOperationsMetrics> {
  const { data, error } = await supabase.rpc('launch_operations_metrics')
  if (error) throw error
  return data as LaunchOperationsMetrics
}

export async function fetchProductAnalytics(): Promise<LaunchProductAnalytics> {
  const { data, error } = await supabase.rpc('launch_product_analytics')
  if (error) throw error
  return data as LaunchProductAnalytics
}

export async function fetchFeedbackSummary(): Promise<LaunchFeedbackSummary> {
  const { data, error } = await supabase.rpc('launch_feedback_summary')
  if (error) throw error
  return data as LaunchFeedbackSummary
}

// ── Formatting helpers shared by the UI ─────────────────────────────────────

/** cost_micros is in 10⁻⁸ USD (millionths of a USD cent). Convert to dollars. */
export function microsToDollars(cents: number): string {
  const dollars = cents / 100_000_000  // 10⁻⁸ → 1 USD
  if (dollars === 0) return '$0.00'
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(dollars)
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString()
}
