import { useState, useEffect, type CSSProperties } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import type { AccessRole } from '../context/AuthProvider'
import { useAuthStore } from '../store/authStore'
import { GlassCard } from '../components/ui/GlassCard'
import { PrimaryButton } from '../components/ui/PrimaryButton'
import { BYPASS_APPROVAL } from '../lib/appMode'
import { logMode, getAppMode } from '../lib/mode'
import { normalizeRole, getRoleDashboardPath } from '../lib/auth'

const ACCESS_ROLES: { value: AccessRole; label: string }[] = [
  { value: 'consumer',   label: 'Consumer' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'driver',     label: 'Driver' },
  { value: 'warehouse',  label: 'Warehouse' },
  { value: 'fundraiser', label: 'Fundraiser' },
  { value: 'partner',    label: 'Partner' },
  { value: 'admin',      label: 'Admin' },
]

// Dashboard path routing is handled by getRoleDashboardPath() from lib/auth.

// normalizeRole and dashboard-path resolution are now in lib/auth.ts.
// Imported above; no local duplicate needed.

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

  // On mount: immediately clear any lingering demo state so isDemoMode()
  // returns false and downstream components (banners, guards, data fetchers)
  // all treat this page as live from the first render.
  // This runs BEFORE handleSubmit, so the banner is already correct on load.
  useEffect(() => {
    localStorage.removeItem('baykid-demo-mode')
    localStorage.removeItem('baykid-demo-role')
  }, [])

  // Read auth state from the central store (set by useAuthInit in App) —
  // avoids a redundant getSession() call that conflicts with the Web Lock.
  const { user: storeUser, role: storeRole, profile: storeProfile, approvalStatus, isLoading: authLoading } = useAuthStore()

  useEffect(() => {
    if (authLoading || !storeUser) return
    // Never pre-empt an in-flight sign-in — handleSubmit owns that redirect,
    // including the selected-vs-DB-role mismatch error. This is the resume-an-
    // existing-session path only.
    if (loading) return

    if (!BYPASS_APPROVAL && approvalStatus !== 'approved') {
      navigate('/pending-approval', { replace: true })
      return
    }

    // /real-login is live-only. DB role is always authoritative here.
    // Admins may use the dropdown to preview a role's dashboard.
    const realRole = normalizeRole(storeRole)
    const targetRole = realRole === 'admin' ? selectedRole : realRole
    const path = getRoleDashboardPath({ ...storeProfile, role: targetRole })
    console.log('Auth user id:', storeUser?.id)
    console.log('DB Role:', realRole)
    console.log('Redirect destination:', path)
    if (path && path !== '/real-login') navigate(path, { replace: true })
  }, [authLoading, loading, storeUser, storeRole, storeProfile, approvalStatus, selectedRole, navigate])

  const fade = (delay = 0): CSSProperties => ({
    opacity: animate ? 1 : 0,
    transform: animate ? 'translateY(0)' : 'translateY(14px)',
    transition: `opacity 0.4s ease ${delay}ms, transform 0.4s ease ${delay}ms`,
  })

  // Creates a minimal profile when one is missing. Uses the selectedRole so a
  // driver/warehouse/admin who signs in for the first time is not demoted to
  // consumer. Approval: consumer is auto-approved; all other roles start pending
  // (an admin must approve them). BYPASS_APPROVAL=true skips that gate for now.
  async function createProfile(userId: string) {
    const roleForProfile = selectedRole as string
    const autoApproved = roleForProfile === 'consumer' ? 'approved' : 'pending'

    const { error: profileErr } = await supabase
      .from('profiles')
      .upsert(
        {
          id: userId,
          email,
          full_name: fullName.trim() || null,
          city: city.trim() || null,
          role: roleForProfile,
          approval_status: autoApproved,
        },
        { onConflict: 'id' }
      )

    if (profileErr) {
      console.error('[createProfile]', profileErr.message)
    }

    const { error: roleErr } = await supabase
      .from('user_roles')
      .insert({ user_id: userId, new_role: roleForProfile })

    if (roleErr && !roleErr.message.includes('duplicate')) {
      console.error('[createUserRole]', roleErr.message)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (loading) return

    logMode('login')

    // /real-login is ALWAYS live Supabase auth — demo mode has no path here.
    // Demo entry points: "Continue in Demo Mode" → /login, or /demo routes.
    // Clear any leftover demo session so isDemoMode() never contaminates live auth.
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
        supabase.from('profiles').select('role, approval_status, driver_service_type, account_type').eq('id', userId).maybeSingle(),
        10000
      )

      console.log('[5] after profile fetch', { profile, profileError })

      if (profileError || !profile) {
        console.log('[6] profile missing, attempting createProfile')
        await createProfile(userId)

        const retry = await withTimeout(
          supabase.from('profiles').select('role, approval_status, driver_service_type, account_type').eq('id', userId).maybeSingle(),
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

      // ── Diagnostic logs (live mode) ─────────────────────────────────────────
      console.log('Auth user id:', data.user?.id)
      console.log('Auth email:', data.user?.email)
      console.log('Fetched profile:', profile)
      console.log('Profile role:', profile?.role)
      console.log('Profile status:', profile?.approval_status)

      // Approval gate (skipped while approval bypass is active — testing only)
      if (!BYPASS_APPROVAL && profile.approval_status !== 'approved') {
        navigate('/pending-approval', { replace: true })
        return
      }

      // DB role is always authoritative in live mode.
      // Admins may use the dropdown to preview any role's dashboard.
      const databaseRole = normalizeRole(profile.role) as AccessRole | null

      console.log('Current App Mode:', getAppMode())
      console.log('[8] role resolved', { databaseRole })

      if (!databaseRole) {
        setError('Unable to load account role. Please contact support.')
        return
      }

      const isAdmin = databaseRole === 'admin'
      const targetRole: AccessRole = isAdmin ? selectedRole : databaseRole
      const dashboardPath = getRoleDashboardPath({ ...profile, role: targetRole })

      console.log('Redirect destination:', dashboardPath)
      console.log('[9] target dashboard', { targetRole, dashboardPath })

      if (!dashboardPath || dashboardPath === '/real-login') {
        setError(`No dashboard route found for role: ${targetRole}`)
        return
      }

      // Ensure demo flags are cleared so isDemoModeActive() returns false for real users
      localStorage.removeItem('baykid-demo-mode')
      localStorage.removeItem('baykid-demo-role')

      // AuthProvider.login() is demo-only; in live mode useAuthStore is the
      // single source of truth (set by initAuth onAuthStateChange above).
      // We store last-used email for convenience only — not for auth decisions.
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