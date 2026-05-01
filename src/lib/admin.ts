import { supabase } from './supabase'
import type { Role, ApprovalStatus, AdminStats, UserRecord, BroadcastAlert, AlertWithDriver } from '../types'

export async function getAdminStats(): Promise<AdminStats> {
  const [profilesRes, bagsCountRes, scansCountRes, inspCountRes, driversRes, alertsRes, bagStatusRes] =
    await Promise.all([
      supabase.from('profiles').select('id, approval_status'),
      supabase.from('bags').select('id', { count: 'exact', head: true }),
      supabase.from('bag_scans').select('id', { count: 'exact', head: true }),
      supabase.from('inspections').select('id', { count: 'exact', head: true }),
      supabase.from('driver_status').select('id').eq('is_online', true),
      supabase.from('alerts').select('id').eq('status', 'open'),
      supabase.from('bags').select('status'),
    ])

  const profiles = profilesRes.data ?? []
  const bagStatusRows = bagStatusRes.data ?? []

  const bagsByStatus: Record<string, number> = {}
  for (const bag of bagStatusRows) {
    bagsByStatus[bag.status as string] = (bagsByStatus[bag.status as string] ?? 0) + 1
  }

  return {
    totalUsers: profiles.length,
    pendingApprovals: profiles.filter((p) => p.approval_status === 'pending').length,
    totalBags: bagsCountRes.count ?? 0,
    totalScans: scansCountRes.count ?? 0,
    totalInspections: inspCountRes.count ?? 0,
    onlineDrivers: (driversRes.data ?? []).length,
    openAlerts: (alertsRes.data ?? []).length,
    bagsByStatus,
  }
}

export async function getAllUsers(): Promise<UserRecord[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as UserRecord[]
}

export async function updateUserRole(userId: string, role: Role): Promise<void> {
  const { error } = await supabase.from('profiles').update({ role }).eq('id', userId)
  if (error) throw error
}

export async function updateUserApproval(userId: string, status: ApprovalStatus): Promise<void> {
  const { error } = await supabase.from('profiles').update({ approval_status: status }).eq('id', userId)
  if (error) throw error
}

export async function sendBroadcastAlert(
  senderId: string,
  targetRole: Role | 'all',
  message: string,
): Promise<void> {
  const { error } = await supabase.from('broadcast_alerts').insert({
    sender_id: senderId,
    target_role: targetRole,
    message,
  })
  if (error) throw error
}

export async function getBroadcastAlerts(): Promise<BroadcastAlert[]> {
  const { data, error } = await supabase
    .from('broadcast_alerts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return (data ?? []) as BroadcastAlert[]
}

export async function getAllAlerts(): Promise<AlertWithDriver[]> {
  const { data, error } = await supabase
    .from('alerts')
    .select('*, profiles!alerts_driver_id_fkey(full_name)')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw error

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    driver_id: row.driver_id as string,
    alert_type: row.alert_type as string,
    status: row.status as string,
    notes: row.notes as string | null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    driver_name: (row.profiles as { full_name: string } | null)?.full_name ?? null,
  })) as AlertWithDriver[]
}

export async function acknowledgeAlert(alertId: string): Promise<void> {
  const { error } = await supabase
    .from('alerts')
    .update({ status: 'acknowledged', updated_at: new Date().toISOString() })
    .eq('id', alertId)
  if (error) throw error
}

export async function resolveAlert(alertId: string): Promise<void> {
  const { error } = await supabase
    .from('alerts')
    .update({ status: 'resolved', updated_at: new Date().toISOString() })
    .eq('id', alertId)
  if (error) throw error
}

export async function getAllDrivers(): Promise<UserRecord[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'driver')
    .eq('approval_status', 'approved')
    .order('full_name', { ascending: true })
  if (error) throw error
  return (data ?? []) as UserRecord[]
}
