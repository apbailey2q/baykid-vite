import { useState, useEffect, type CSSProperties } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import type { AccessRole } from '../context/AuthProvider'
import { useAuthStore } from '../store/authStore'
import { GlassCard } from '../components/ui/GlassCard'
import { PrimaryButton } from '../components/ui/PrimaryButton'
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


  // Read auth state from the central store (set by useAuthInit in App) —
  // avoids a redundant getSession() call that conflicts with the Web Lock.
  const { user: storeUser, role: storeRole, profile: storeProfile, approvalStatus, isLoading: authLoading } = useAuthStore()

  useEffect(() => {
    if (authLoading || !storeUser) return
    // Never pre-empt an in-flight sign-in — handleSubmit owns that redirect,
    // including the selected-vs-DB-role mismatch error. This is the resume-an-
    // existing-session path only.
    if (loading) return

    if (approvalStatus !== 'approved') {
      // Drivers get a role-specific pending screen with driver copy.
      const target = storeRole === 'driver' ? '/driver/pending-approval' : '/pending-approval'
      navigate(target, { replace: true })
      return
    }

    // /real-login is live-only. DB role is always authoritative here.
    // Admins may use the dropdown to preview a role's dashboard.
    const realRole = normalizeRole(storeRole)
    const targetRole = realRole === 'admin' ? selectedRole : realRole
    const path = getRoleDashboardPath({ ...storeProfile, role: targetRole })

    // Returning users who are "ready to use" see the Welcome Back celebration
    // first, then auto-redirect into their actual dashboard. WelcomeBack reads
    // the destination from the `to` query param so it isn't consumer-only.
    const isCompletedConsumer =
      realRole === 'consumer' &&
      (storeProfile as { onboarding_completed?: boolean } | null)?.onboarding_completed === true
    const isApprovedDriver = realRole === 'driver' && approvalStatus === 'approved'
    if (isCompletedConsumer || isApprovedDriver) {
      // Drivers land on the mode selector after the welcome celebration.
      // If they previously chose a mode in this browser, we send them straight
      // to that mode's landing (they can still switch via the "Switch mode"
      // button on each landing).
      let to: string
      if (isApprovedDriver) {
        const savedMode = (() => { try { return localStorage.getItem('baykid-driver-mode') } catch { return null } })()
        // Residential lands on the legacy Driver Dashboard at /dashboard/driver.
        // Commercial still uses the new /driver/commercial landing.
        to = savedMode === 'residential' ? '/dashboard/driver'
          :  savedMode === 'commercial'  ? '/driver/commercial'
          :                                 '/driver/mode'
      } else {
        to = path && path !== '/real-login' ? path : '/dashboard/consumer'
      }
      console.log('[login] resume session → /welcome-back', { to })
      navigate(`/welcome-back?to=${encodeURIComponent(to)}`, { replace: true })
      return
    }
    if (path && path !== '/real-login') navigate(path, { replace: true })
  }, [authLoading, loading, storeUser, storeRole, storeProfile, approvalStatus, selectedRole, navigate])

  const fade = (delay = 0): CSSProperties => ({
    opacity: animate ? 1 : 0,
    transform: animate ? 'translateY(0)' : 'translateY(14px)',
    transition: `opacity 0.4s ease ${delay}ms, transform 0.4s ease ${delay}ms`,
  })

  // Creates a minimal profile when one is missing (first sign-in only).
  // Uses INSERT — never UPSERT — so an existing profile row is never touched.
  // If the row already exists (duplicate-key error) we ignore the error and let
  // the caller's retry fetch return the real DB role unchanged. This prevents
  // a transient fetch failure from stamping the dropdown value over an existing
  // driver/warehouse/etc. profile.
  async function createProfile(userId: string) {
    const roleForProfile = selectedRole as string
    const autoApproved = roleForProfile === 'consumer' ? 'approved' : 'pending'

    const { error: profileErr } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        email,
        full_name: fullName.trim() || null,
        city: city.trim() || null,
        role: roleForProfile,
        approval_status: autoApproved,
      })

    // Duplicate-key = profile already exists; that's fine — retry will read it.
    if (profileErr && !profileErr.code?.includes('23505') && !profileErr.message?.includes('duplicate')) {
      if (import.meta.env.DEV) console.error('[createProfile]', profileErr.message)
    }

    // user_roles is an AUDIT / HISTORY table (old_role, new_role, changed_by,
    // reason, created_at). Multiple rows per user are by design — there's no
    // UNIQUE(user_id, new_role) constraint, so any upsert with onConflict
    // returns 400 "no unique or exclusion constraint matching the ON CONFLICT
    // specification". Plain insert is correct here; a 23505 (duplicate) would
    // only fire if a stricter constraint is added later, which we silence.
    const { error: roleErr } = await supabase
      .from('user_roles')
      .insert({ user_id: userId, new_role: roleForProfile })

    if (
      roleErr &&
      !roleErr.code?.includes('23505') &&
      !roleErr.message?.toLowerCase().includes('duplicate')
    ) {
      if (import.meta.env.DEV) console.error('[createUserRole]', roleErr.message)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (loading) return

    setError(null)
    setSuccess(null)
    setLoading(true)

    try {
      if (!isSupabaseConfigured) {
        setError('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
        return
      }

      const { data, error } = await withTimeout(
        supabase.auth.signInWithPassword({ email, password }),
        10000
      )

      if (error) {
        setError(error.message)
        return
      }

      const userId = data.user?.id

      if (!userId) {
        setError('No user ID returned from Supabase.')
        return
      }

      let { data: profile, error: profileError } = await withTimeout(
        supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
        10000
      )

      if (profileError || !profile) {
        await createProfile(userId)

        const retry = await withTimeout(
          supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
          10000
        )
        profile = retry.data
        profileError = retry.error
      }

      if (profileError || !profile) {
        setError(profileError?.message ?? 'Profile not found. Please contact support.')
        return
      }

      // Approval gate — drivers get the driver-specific copy.
      if (profile.approval_status !== 'approved') {
        const target = profile.role === 'driver' ? '/driver/pending-approval' : '/pending-approval'
        navigate(target, { replace: true })
        return
      }

      // DB role is always authoritative in live mode.
      // Admins may use the dropdown to preview any role's dashboard.
      const databaseRole = normalizeRole(profile.role) as AccessRole | null

      if (!databaseRole) {
        setError('Unable to load account role. Please contact support.')
        return
      }

      const isAdmin = databaseRole === 'admin'
      const targetRole: AccessRole = isAdmin ? selectedRole : databaseRole
      const dashboardPath = getRoleDashboardPath({ ...profile, role: targetRole })

      if (!dashboardPath || dashboardPath === '/real-login') {
        setError(`No dashboard route found for role: ${targetRole}`)
        return
      }

      // Store last-used email for convenience only — not for auth decisions.
      localStorage.setItem('baykid-last-email', email)

      console.log('[login] success', { userId, role: databaseRole })
      console.log('[login] profile loaded', { name: (profile as { full_name?: string }).full_name, avatar: (profile as { avatar_url?: string }).avatar_url })

      // "Ready to use" users see the Welcome Back celebration, then
      // auto-redirect into their actual dashboard. WelcomeBack reads the
      // destination from the `to` query param so it isn't consumer-only.
      //   • completed consumer → /welcome-back?to=/dashboard/consumer
      //   • approved driver    → /welcome-back?to=/dashboard/driver
      //   • everyone else      → straight to their dashboard
      const isCompletedConsumer =
        databaseRole === 'consumer' &&
        (profile as { onboarding_completed?: boolean }).onboarding_completed === true
      const isApprovedDriver = databaseRole === 'driver'   // approval gate above already passed
      if (isCompletedConsumer || isApprovedDriver) {
        // Drivers go to mode selector (or last-used mode landing if remembered).
        let to = dashboardPath
        if (isApprovedDriver) {
          const savedMode = (() => { try { return localStorage.getItem('baykid-driver-mode') } catch { return null } })()
          to = savedMode === 'residential' ? '/driver/residential'
            :  savedMode === 'commercial'  ? '/driver/commercial'
            :                                 '/driver/mode'
        }
        console.log('[login] routing → /welcome-back', { to })
        navigate(`/welcome-back?to=${encodeURIComponent(to)}`)
      } else {
        console.log('[login] routing →', dashboardPath)
        navigate(dashboardPath)
      }
    } catch (err: unknown) {
      if (import.meta.env.DEV) console.error('[RealLogin] error', err)
      setError(err instanceof Error ? err.message : 'Login failed.')
    } finally {
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

          <div className="flex flex-col gap-2 mt-6" style={fade(200)}>
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