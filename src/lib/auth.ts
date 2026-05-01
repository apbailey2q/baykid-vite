import { supabase } from './supabase'
import type { Role } from '../types'

export const AUTO_APPROVED_ROLES: Role[] = ['consumer', 'admin']

const ROLE_DASHBOARD: Record<Role, string> = {
  consumer: '/dashboard/consumer',
  driver: '/dashboard/driver',
  warehouse_employee: '/dashboard/warehouse',
  warehouse_supervisor: '/dashboard/warehouse-supervisor',
  partner: '/dashboard/partner',
  admin: '/dashboard/admin',
}

export function getRoleDashboardPath(role: Role): string {
  return ROLE_DASHBOARD[role]
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signUp(
  email: string,
  password: string,
  fullName: string,
  role: Role,
) {
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error

  if (data.user) {
    const approvalStatus = AUTO_APPROVED_ROLES.includes(role) ? 'approved' : 'pending'
    const { error: profileError } = await supabase.from('profiles').insert({
      id: data.user.id,
      full_name: fullName,
      role,
      approval_status: approvalStatus,
    })
    if (profileError) throw profileError
  }

  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function fetchProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  return data as import('../types').Profile | null
}
