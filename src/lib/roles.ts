import { supabase } from './supabaseClient'

export async function getUserRoles(userId: string): Promise<string[]> {
  const [profileRes, rolesRes] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', userId).maybeSingle(),
    supabase.from('user_roles').select('new_role').eq('user_id', userId),
  ])
  const roles: string[] = []
  if (profileRes.data?.role) roles.push(profileRes.data.role as string)
  if (!rolesRes.error && rolesRes.data) {
    for (const r of rolesRes.data) {
      const role = r.new_role as string
      if (role && !roles.includes(role)) roles.push(role)
    }
  }
  return roles
}
