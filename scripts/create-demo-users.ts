import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://huomxfmgpjsiylftisxq.supabase.co'
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  'sb_publishable_qF6fKmXOSaJSibPn6kmsNg_IgirHVqx'

const DEMO_USERS = [
  { email: 'consumer@baykid.com',  password: 'BayKid2026!', role: 'consumer',            fullName: 'Demo Consumer',   approval: 'approved' },
  { email: 'driver@baykid.com',    password: 'BayKid2026!', role: 'driver',              fullName: 'Demo Driver',     approval: 'approved' },
  { email: 'warehouse@baykid.com', password: 'BayKid2026!', role: 'warehouse_employee',  fullName: 'Demo Warehouse',  approval: 'approved' },
  { email: 'admin@baykid.com',     password: 'BayKid2026!', role: 'admin',               fullName: 'Demo Admin',      approval: 'approved' },
  { email: 'partner@baykid.com',   password: 'BayKid2026!', role: 'partner',             fullName: 'Demo Partner',    approval: 'approved' },
] as const

const usingServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY
console.log(`Using ${usingServiceRole ? 'service role key (admin)' : 'anon key (signUp)'}\n`)

for (const user of DEMO_USERS) {
  // Fresh client per user so sessions don't bleed across accounts
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

  // ── Auth ──────────────────────────────────────────────────────────────────
  let userId: string | null = null

  if (usingServiceRole) {
    const { data, error } = await (supabase.auth.admin as any).createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
    })
    if (error) {
      console.error(`✗ auth  ${user.email}: ${error.message}`)
      continue
    }
    userId = data.user.id
  } else {
    const { data, error } = await supabase.auth.signUp({
      email: user.email,
      password: user.password,
    })
    if (error) {
      console.error(`✗ auth  ${user.email}: ${error.message}`)
      continue
    }
    if (!data.user) {
      console.warn(`⚠ auth  ${user.email}: no user returned (check email confirmation settings)`)
      continue
    }
    userId = data.user.id
  }

  // ── Profile ───────────────────────────────────────────────────────────────
  const { error: profileError } = await supabase.from('profiles').upsert({
    id: userId,
    full_name: user.fullName,
    role: user.role,
    approval_status: user.approval,
  }, { onConflict: 'id' })

  if (profileError) {
    console.error(`✗ profile ${user.email}: ${profileError.message}`)
  } else {
    console.log(`✓ ${user.email}  →  ${user.role}  (${user.approval})`)
  }
}

console.log('\nDone.')
