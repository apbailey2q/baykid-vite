import { useState, useEffect, type CSSProperties } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import { useAuth, type AccessRole } from '../context/AuthProvider'
import { useAuthStore } from '../store/authStore'
import { GlassCard } from '../components/ui/GlassCard'
import { PrimaryButton } from '../components/ui/PrimaryButton'

const ACCESS_ROLES: { value: AccessRole; label: string }[] = [
  { value: 'consumer',   label: 'Consumer' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'driver',     label: 'Driver' },
  { value: 'warehouse',  label: 'Warehouse' },
  { value: 'fundraiser', label: 'Fundraiser' },
  { value: 'partner',    label: 'Partner' },
  { value: 'admin',      label: 'Admin' },
]

const ROLE_DASHBOARD_PATHS: Record<AccessRole, string> = {
  admin:      '/dashboard/admin',
  consumer:   '/dashboard/consumer',
  commercial: '/dashboard/commercial',
  driver:     '/dashboard/driver',
  warehouse:  '/dashboard/warehouse',
  fundraiser: '/dashboard/fundraiser',
  partner:    '/dashboard/partner',
}

/**
 * Normalizes old/legacy database role names into the current app role names.
 *
 * Your current clean roles should be:
 * admin
 * consumer
 * driver
 * warehouse
 * partner
 * fundraiser
 */
function normalizeRole(role: string | null | undefined): AccessRole | null {
  if (!role) return null

  const cleanRole = role.toLowerCase().trim()

  if (cleanRole === 'warehouse_employee') return 'warehouse'
  if (cleanRole === 'warehouse_supervisor') return 'warehouse'

  if (
    cleanRole === 'admin' ||
    cleanRole === 'consumer' ||
    cleanRole === 'commercial' ||
    cleanRole === 'driver' ||
    cleanRole === 'warehouse' ||
    cleanRole === 'fundraiser' ||
    cleanRole === 'partner'
  ) {
    return cleanRole as AccessRole
  }

  return null
}

type ProfileShape = {
  role: string | null
  account_type?: string | null
  driver_service_type?: string | null
}

function getDashboardPath(
  role: AccessRole | null,
  profile?: ProfileShape | null,
): string | null {
  if (!role) return null

  // Commercial accounts regardless of role field
  if (role === 'commercial' || profile?.account_type === 'commercial') {
    return '/dashboard/commercial'
  }

  // Drivers branch by service type
  if (role === 'driver') {
    const dst = profile?.driver_service_type
    if (dst === 'consumer_only')  return '/dashboard/driver/consumer-routes'
    if (dst === 'commercial_only') return '/dashboard/driver/commercial-routes'
    return '/dashboard/driver'
  }

  return ROLE_DASHBOARD_PATHS[role] ?? null
}

// Accepts PromiseLike so it works with both Promise and PostgrestBuilder
function withTimeout<T>(promise: PromiseLike<T>, ms = 10000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error('Login request timed out. Please check your Supabase connection.'))
    }, ms)
    Promise.resolve(promise)
      .then(value => { window.clearTimeout(timer); resolve(value) })
      .catch(error => { window.clearTimeout(timer); reject(error) })
  })
}

export default function RealLoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [searchParams] = useSearchParams()

  const [animate, setAnimate] = useState(false)
  const [selectedRole, setSelectedRole] = useState<AccessRole>('consumer')
  const [email, setEmail] = useState(() => searchParams.get('prefill_email') ?? localStorage.getItem('baykid-last-email') ?? '')
  const [password, setPassword] = useState('')
  const [fullName] = useState('')
  const [city] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimate(true))
    return () => cancelAnimationFrame(id)
  }, [])

  // Read auth state from the central store (set by useAuthInit in App) —
  // avoids a redundant getSession() call that conflicts with the Web Lock.
  const { user: storeUser, role: storeRole, profile: storeProfile, approvalStatus, isLoading: authLoading } = useAuthStore()

  useEffect(() => {
    if (authLoading || !storeUser) return

    if (approvalStatus !== 'approved') {
      navigate('/pending-approval', { replace: true })
      return
    }

    const realRole = normalizeRole(storeRole)
    const targetRole = realRole === 'admin' ? selectedRole : realRole
    const path = getDashboardPath(targetRole as AccessRole, storeProfile)
    if (path) navigate(path, { replace: true })
  }, [authLoading, storeUser, storeRole, storeProfile, approvalStatus, navigate])

  const fade = (delay = 0): CSSProperties => ({
    opacity: animate ? 1 : 0,
    transform: animate ? 'translateY(0)' : 'translateY(14px)',
    transition: `opacity 0.4s ease ${delay}ms, transform 0.4s ease ${delay}ms`,
  })

  async function createProfile(userId: string) {
    const { error: profileErr } = await supabase
      .from('profiles')
      .upsert(
        {
          id: userId,
          email,
          full_name: fullName.trim() || null,
          city: city.trim() || null,
          role: 'consumer',
          approval_status: 'pending',
        },
        { onConflict: 'id' }
      )

    if (profileErr) {
      console.error('[createProfile]', profileErr.message)
    }

    const { error: roleErr } = await supabase
      .from('user_roles')
      .insert({ user_id: userId, new_role: 'consumer' })

    if (roleErr && !roleErr.message.includes('duplicate')) {
      console.error('[createUserRole]', roleErr.message)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (loading) return

    // Clear any leftover demo session before real Supabase auth
    localStorage.removeItem('baykid-demo-mode')
    localStorage.removeItem('baykid-demo-role')

    setError(null)
    setSuccess(null)
    setLoading(true)

    try {
      console.log('[1] submit started', { email, selectedRole })

      if (!isSupabaseConfigured) {
        setError('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
        return
      }

      console.log('[2] before supabase sign in')

      const { data, error } = await withTimeout(
        supabase.auth.signInWithPassword({ email, password }),
        10000
      )

      console.log('[3] after supabase sign in', { data, error })

      if (error) {
        setError(error.message)
        return
      }

      const userId = data.user?.id

      if (!userId) {
        setError('No user ID returned from Supabase.')
        return
      }

      console.log('[4] before profile fetch', { userId })

      let { data: profile, error: profileError } = await withTimeout(
        supabase.from('profiles').select('role, approval_status, driver_service_type, account_type').eq('id', userId).single(),
        10000
      )

      console.log('[5] after profile fetch', { profile, profileError })

      if (profileError || !profile) {
        console.log('[6] profile missing, attempting createProfile')
        await createProfile(userId)

        const retry = await withTimeout(
          supabase.from('profiles').select('role, approval_status, driver_service_type, account_type').eq('id', userId).single(),
          10000
        )
        profile = retry.data
        profileError = retry.error

        console.log('[7] after profile retry', { profile, profileError })
      }

      if (profileError || !profile) {
        setError(profileError?.message ?? 'Profile not found. Please contact support.')
        return
      }

      // Approval gate
      if (profile.approval_status !== 'approved') {
        navigate('/pending-approval', { replace: true })
        return
      }

      // Normalize: maps warehouse_employee → warehouse, etc.
      const databaseRole = normalizeRole(profile.role) as AccessRole | null
      const selected = selectedRole

      console.log('[8] role check', { databaseRole, selected })

      if (!databaseRole) {
        setError('Unable to load account role. Please try again.')
        return
      }

      const isAdmin = databaseRole === 'admin'

      if (!isAdmin && databaseRole !== selected) {
        setError('Selected role does not match this account.')
        return
      }

      const targetRole: AccessRole = isAdmin ? selected : databaseRole
      const dashboardPath = getDashboardPath(targetRole, profile)

      console.log('[9] target dashboard', { targetRole, dashboardPath })

      if (!dashboardPath) {
        setError(`No dashboard route found for role: ${targetRole}`)
        return
      }

      // Ensure demo flags are cleared so isDemoModeActive() returns false for real users
      localStorage.removeItem('baykid-demo-mode')
      localStorage.removeItem('baykid-demo-role')

      login(email, targetRole)
      localStorage.setItem('baykid-last-email', email)

      console.log('[10] navigating', dashboardPath)
      navigate(dashboardPath)
    } catch (err: unknown) {
      console.error('[RealLogin] error', err)
      setError(err instanceof Error ? err.message : 'Login failed.')
    } finally {
      console.log('[11] finally stopping loading')
      setLoading(false)
    }
  }

  const labelStyle: CSSProperties = {
    display: 'block',
    fontSize: 10,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: 'rgba(255,255,255,0.35)',
    marginBottom: 8,
  }

  return (
    <div
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-5 py-10"
      style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}
    >
      <div className="pointer-events-none absolute inset-0 grid-bg" />

      <div
        className="pointer-events-none absolute"
        style={{
          top: -80,
          left: -60,
          width: 280,
          height: 280,
          background: 'rgba(0,87,231,0.22)',
          filter: 'blur(72px)',
          borderRadius: '50%',
        }}
      />

      <div
        className="pointer-events-none absolute"
        style={{
          bottom: -60,
          right: -40,
          width: 220,
          height: 220,
          background: 'rgba(94,234,212,0.08)',
          filter: 'blur(64px)',
          borderRadius: '50%',
        }}
      />

      <div className="relative w-full max-w-md mx-auto" style={{ zIndex: 1 }}>
        {/* Logo */}
        <img
          src="/logo.png"
          alt="Cyan's Brooklynn Recycling Enterprise"
          className="logo-glow mx-auto w-[260px] h-[260px] object-contain"
        />

        {/* App name */}
        <h1 className="text-3xl font-semibold text-white text-center mb-2 tracking-tight -mt-4">
          Cyan&apos;s Brooklynn
        </h1>

        {/* Subtitle */}
        <p className="text-[11px] text-cyan-400/85 tracking-widest uppercase text-center mt-1 mb-6">
          Recycling Enterprise
        </p>

        <GlassCard padding="none" className="w-full px-5 py-6">
          {/* Supabase config warning */}
          {!isSupabaseConfigured && (
            <div className="flex justify-center mb-4" style={fade(40)}>
              <div
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
                style={{
                  background: 'rgba(251,191,36,0.1)',
                  border: '1px solid rgba(251,191,36,0.3)',
                  color: '#fbbf24',
                }}
              >
                ⚠️ Supabase not configured
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} style={fade(80)}>
            <div className="flex flex-col space-y-4 mb-4">
              {/* Role selector */}
              <div>
                <p
                  className="text-center text-[11px] mb-2"
                  style={{ color: 'rgba(255,255,255,0.35)' }}
                >
                  I am signing in as
                </p>

                <select
                  value={selectedRole}
                  onChange={e => setSelectedRole(e.target.value as AccessRole)}
                  className="w-full text-sm outline-none"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    borderBottom: '1px solid rgba(255,255,255,0.15)',
                    color: '#ffffff',
                    cursor: 'pointer',
                    colorScheme: 'dark',
                    padding: '6px 0',
                    fontWeight: 500,
                  }}
                >
                  {ACCESS_ROLES.map(role => (
                    <option
                      key={role.value}
                      value={role.value}
                      style={{ background: '#0d1b3e' }}
                    >
                      {role.label}
                    </option>
                  ))}
                </select>

                <p
                  className="text-center text-[11px] mt-2"
                  style={{ color: 'rgba(255,255,255,0.35)' }}
                >
                  Selected destination:{' '}
                  <span style={{ color: '#00c8ff' }}>
                    {ACCESS_ROLES.find(role => role.value === selectedRole)?.label}
                  </span>
                </p>
              </div>

              <div>
                <label style={labelStyle}>Email</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="w-full rounded-xl bg-slate-800/80 border border-white/10 text-white text-sm px-4 py-2.5 outline-none placeholder:text-white/30"
                  autoComplete="email"
                />
              </div>

              <div>
                <label style={labelStyle}>Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full rounded-xl bg-slate-800/80 border border-white/10 text-white text-sm px-4 py-2.5 outline-none placeholder:text-white/30"
                  autoComplete="current-password"
                />
              </div>
            </div>

            {error && (
              <div
                className="rounded-xl px-4 py-3 mb-4 text-sm"
                style={{
                  background: 'rgba(248,113,113,0.1)',
                  border: '1px solid rgba(248,113,113,0.3)',
                  color: '#f87171',
                }}
              >
                {error}
              </div>
            )}

            {success && (
              <div
                className="rounded-xl px-4 py-3 mb-4 text-sm"
                style={{
                  background: 'rgba(74,222,128,0.1)',
                  border: '1px solid rgba(74,222,128,0.3)',
                  color: '#4ade80',
                }}
              >
                {success}
              </div>
            )}

            <PrimaryButton type="submit" fullWidth loading={loading} className="mt-6">
              {!loading && '🔐 Sign In'}
            </PrimaryButton>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6" style={fade(200)}>
            <div
              className="flex-1 h-px"
              style={{ background: 'rgba(255,255,255,0.08)' }}
            />
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>
              or
            </span>
            <div
              className="flex-1 h-px"
              style={{ background: 'rgba(255,255,255,0.08)' }}
            />
          </div>

          <div className="flex flex-col gap-2" style={fade(220)}>
            {/* Continue in Demo Mode */}
            <Link
              to="/login"
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition hover:brightness-110 active:scale-[0.98]"
              style={{
                background: 'rgba(0,200,255,0.07)',
                border: '1px solid rgba(0,200,255,0.25)',
                color: '#00c8ff',
              }}
            >
              🚀 Continue in Demo Mode
            </Link>

            {/* New User */}
            <p className="mt-8 text-sm text-slate-400 text-center">
              New to Cyan&apos;s Brooklynn?{' '}
              <button
                type="button"
                onClick={() => navigate('/signup')}
                className="text-cyan-300 hover:text-cyan-200 underline-offset-2 hover:underline transition"
              >
                Create account
              </button>
            </p>
          </div>
        </GlassCard>

        {/* Legal links */}
        <div className="flex items-center justify-center gap-3 mt-8 flex-wrap" style={fade(260)}>
          <Link
            to="/legal/terms-of-service"
            style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', textDecoration: 'none', fontWeight: 500 }}
          >
            Terms
          </Link>
          <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 10 }}>·</span>
          <Link
            to="/legal/privacy-policy"
            style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', textDecoration: 'none', fontWeight: 500 }}
          >
            Privacy
          </Link>
          <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 10 }}>·</span>
          <Link
            to="/legal/contact"
            style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', textDecoration: 'none', fontWeight: 500 }}
          >
            Support
          </Link>
          <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 10 }}>·</span>
          <Link
            to="/legal"
            style={{ fontSize: 10, color: 'rgba(0,200,255,0.55)', textDecoration: 'none', fontWeight: 600 }}
          >
            Legal Center
          </Link>
        </div>
      </div>
    </div>
  )
}