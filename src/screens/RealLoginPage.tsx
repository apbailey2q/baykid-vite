import { useState, useEffect, type CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import { fetchProfile } from '../lib/auth'
import { useAuth, type AccessRole } from '../context/AuthProvider'
import { GlassCard } from '../components/ui/GlassCard'
import { PrimaryButton } from '../components/ui/PrimaryButton'

type Mode = 'signin' | 'signup'

const ACCESS_ROLES: { value: AccessRole; label: string }[] = [
  { value: 'consumer', label: 'Consumer' },
  { value: 'driver', label: 'Driver' },
  { value: 'warehouse', label: 'Warehouse' },
  { value: 'fundraiser', label: 'Fundraiser' },
  { value: 'partner', label: 'Partner' },
  { value: 'admin', label: 'Admin' },
]

const ROLE_DASHBOARD_PATHS: Record<AccessRole, string> = {
  admin: '/live-admin',
  consumer: '/live-dashboard',
  driver: '/live-bags',
  warehouse: '/live-inspection',
  fundraiser: '/live-fundraisers',
  partner: '/live-wallet',
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
    cleanRole === 'driver' ||
    cleanRole === 'warehouse' ||
    cleanRole === 'fundraiser' ||
    cleanRole === 'partner'
  ) {
    return cleanRole
  }

  return null
}

/**
 * This is the main RBAC permission check for the login screen.
 *
 * Rule:
 * - Admin can access every role dashboard.
 * - Non-admin users can only access their own dashboard.
 */
function canAccessSelectedRole(realRole: AccessRole, selectedRole: AccessRole): boolean {
  if (realRole === 'admin') return true
  return realRole === selectedRole
}

function getDashboardPath(role: AccessRole | null): string | null {
  if (!role) return null
  return ROLE_DASHBOARD_PATHS[role] ?? null
}

export default function RealLoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [animate, setAnimate] = useState(false)
  const [mode] = useState<Mode>('signin')
  const [selectedRole, setSelectedRole] = useState<AccessRole>('consumer')
  const [email, setEmail] = useState(() => localStorage.getItem('baykid-last-email') ?? '')
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

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return

      try {
        const profile = await fetchProfile(data.session.user.id)
        if (!profile) return

        if (profile.approval_status !== 'approved') {
          navigate('/pending-approval', { replace: true })
          return
        }

        const realRole = normalizeRole(profile.role as string)

        /**
         * Admins stay on the login page so they can choose which dashboard
         * they want to enter from the role dropdown.
         */
        const targetRole =
  realRole === 'admin'
    ? selectedRole
    : realRole

const path = getDashboardPath(targetRole as AccessRole)

if (path) navigate(path, { replace: true })
return
      } catch {
        /**
         * Silently ignore here.
         * User can still sign in manually.
         */
      }
    })
  }, [navigate])

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
    setError(null)
    setSuccess(null)

    // Prevent duplicate submits while already in flight
    if (loading) return

    if (!isSupabaseConfigured) {
      setError('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.')
      return
    }

    // setLoading INSIDE try so finally always pairs with it
    try {
      setLoading(true)

      if (mode === 'signin') {
        console.log('[RealLogin] sign-in attempt', { email, selectedRole })

        // Step 1 — Authenticate (10-second timeout)
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 10_000)
        let authResult: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>
        try {
          authResult = await supabase.auth.signInWithPassword({ email, password })
        } finally {
          clearTimeout(timer)
        }
        const { data, error: authErr } = authResult
        console.log('[RealLogin] auth result', { user: data?.user?.id, authErr })

        if (authErr || !data?.user) {
          setError(authErr?.message ?? 'Sign in failed. Please try again.')
          return
        }

        // Step 2 — Fetch real DB profile (source of truth for role)
        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('id, email, role, approval_status')
          .eq('id', data.user.id)
          .maybeSingle()

        console.log('[RealLogin] profile', profile)

        if (profileErr || !profile) {
          await supabase.auth.signOut()
          setError('Profile not found. Please contact support.')
          return
        }

        // Step 3 — Approval gate
        if (profile.approval_status !== 'approved') {
          navigate('/pending-approval', { replace: true })
          return
        }

        // Step 4 — Normalize role (maps warehouse_employee → warehouse, etc.)
        const realRole = normalizeRole(profile.role as string)
        const isAdmin  = realRole === 'admin'
        console.log('[RealLogin] databaseRole', profile.role, '→ normalizedRole', realRole, '| isAdmin', isAdmin)

        if (!realRole) {
          await supabase.auth.signOut()
          setError(`Unrecognized account role "${profile.role}". Please contact support.`)
          return
        }

        // Step 5 — RBAC: admin passes everything, non-admin must match their role
        if (!canAccessSelectedRole(realRole, selectedRole)) {
          setError('Selected role does not match this account. Please choose the correct role and try again.')
          return
        }

        // Step 6 — Navigate to correct dashboard
        const targetRole: AccessRole = isAdmin ? selectedRole : realRole
        const path = getDashboardPath(targetRole)
        console.log('[RealLogin] targetRole', targetRole, '→ path', path)

        if (!path) {
          setError(`No dashboard route found for role "${targetRole}". Please contact support.`)
          return
        }

        localStorage.setItem('baykid-last-email', email)
        login(email, targetRole)
        console.log('[RealLogin] navigating to', path)
        navigate(path, { replace: true })
        return
      }

      // Sign-up mode
      const { data, error: authErr } = await supabase.auth.signUp({ email, password })

      if (authErr) {
        setError(authErr.message)
        return
      }

      if (data.user && data.session) {
        await createProfile(data.user.id)
        navigate('/pending-approval', { replace: true })
        return
      }

      if (data.user) {
        setSuccess('Account created! Check your email to confirm, then sign in.')
      }
    } catch (err: unknown) {
      console.error('[RealLogin] error', err)
      const message = err instanceof Error ? err.message : 'An unexpected login error occurred.'
      setError(message)
    } finally {
      // Always reset spinner — runs even after navigate() triggers unmount
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
        <div className="flex items-center justify-center gap-3 mt-8" style={fade(260)}>
          <Link
            to="/terms"
            style={{
              fontSize: 10,
              color: 'rgba(255,255,255,0.28)',
              textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            Terms
          </Link>

          <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 10 }}>
            ·
          </span>

          <Link
            to="/privacy"
            style={{
              fontSize: 10,
              color: 'rgba(255,255,255,0.28)',
              textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            Privacy
          </Link>

          <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 10 }}>
            ·
          </span>

          <Link
            to="/consent"
            style={{
              fontSize: 10,
              color: '#00c8ff',
              textDecoration: 'none',
              fontWeight: 600,
              opacity: 0.7,
            }}
          >
            User Consent
          </Link>
        </div>
      </div>
    </div>
  )
}