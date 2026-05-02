import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { signIn, fetchProfile, getRoleDashboardPath } from '../lib/auth'
import DemoMode from '../components/DemoMode'
// TEMP DEV BYPASS - remove before production
import { DEV_BYPASS_AUTH, getMockProfile, getMockUser, getMockDashboardPath } from '../lib/devBypass'
import { useAuthStore } from '../store/authStore'
import { useDemoFlowStore } from '../store/demoFlowStore'

// ── Role selector (UI only — does not affect signIn) ──────────────────────────
type RoleTab = 'consumer' | 'driver' | 'warehouse' | 'partner' | 'admin'

const ROLES: { id: RoleTab; label: string; icon: string }[] = [
  { id: 'consumer',  label: 'Consumer',  icon: '♻️' },
  { id: 'driver',    label: 'Driver',    icon: '🚐' },
  { id: 'warehouse', label: 'Warehouse', icon: '🏭' },
  { id: 'partner',   label: 'Partners',  icon: '🤝' },
  { id: 'admin',     label: 'Admin',     icon: '⚙️' },
]

// ── Recycling SVG logo ────────────────────────────────────────────────────────
function RecyclingIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#00c8ff"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 19H4.815a1.83 1.83 0 0 1-1.57-.881 1.785 1.785 0 0 1-.004-1.784L7.196 9.5" />
      <path d="M11 19h8.203a1.83 1.83 0 0 0 1.556-.89 1.784 1.784 0 0 0 0-1.775l-1.226-2.12" />
      <path d="m14 16 3 3-3 3" />
      <path d="M8.293 13.596 7.196 9.5 3.1 10.598" />
      <path d="m9.344 5.811 1.093-1.892A1.83 1.83 0 0 1 11.985 3a1.784 1.784 0 0 1 1.546.888l3.943 6.843" />
      <path d="m13.378 9.633 4.096 1.098 1.097-4.096" />
    </svg>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function LoginScreen() {
  const navigate = useNavigate()
  // TEMP DEV BYPASS - remove before production
  const { setUser, setProfile } = useAuthStore()

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [demoMode, setDemoMode] = useState(false)
  const [role, setRole]         = useState<RoleTab>('consumer')

  const roleLabel = ROLES.find((r) => r.id === role)?.label ?? 'Account'

  // ── Fixed handleSubmit — fetches profile and navigates directly ─────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      // 1. Sign in with Supabase
      const { user } = await signIn(email, password)
      if (!user) throw new Error('Sign in failed — no user returned')

      // 2. Fetch profile to get role + approval status
      const profile = await fetchProfile(user.id)
      if (!profile) throw new Error('Account not set up correctly. Please contact support.')

      // 3. Route based on approval status
      if (profile.approval_status !== 'approved') {
        navigate('/pending-approval')
        return
      }

      // 4. Navigate directly to the correct role dashboard
      navigate(getRoleDashboardPath(profile.role))

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign in failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleEnterDemo = () => {
    setUser(getMockUser(role))
    setProfile(getMockProfile(role))
    navigate(getMockDashboardPath(role))
  }

  const handleRunFullDemo = () => {
    useDemoFlowStore.getState().startDemo()
    // navigation is handled by FullDemoHUD's useEffect once isRunning becomes true
  }

  return (
    <>
      {!DEV_BYPASS_AUTH && demoMode && <DemoMode onClose={() => setDemoMode(false)} />}
      <div
        className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-4 py-12"
        style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}
      >
        {/* Grid overlay */}
        <div className="pointer-events-none absolute inset-0 grid-bg" style={{ zIndex: 0 }} />

        {/* Orb top-left */}
        <div
          className="pointer-events-none absolute"
          style={{
            top: -80, left: -60, width: 280, height: 280,
            background: 'rgba(0,87,231,0.35)',
            filter: 'blur(72px)', borderRadius: '50%', zIndex: 0,
          }}
        />
        {/* Orb bottom-right */}
        <div
          className="pointer-events-none absolute"
          style={{
            bottom: -60, right: -40, width: 240, height: 240,
            background: 'rgba(0,200,255,0.25)',
            filter: 'blur(64px)', borderRadius: '50%', zIndex: 0,
          }}
        />

        {/* Content */}
        <div
          className="relative flex w-full max-w-[430px] flex-col items-center"
          style={{ zIndex: 1, animation: 'fadeSlideUp 0.35s ease both' }}
        >
          {/* Logo badge */}
          <div
            className="flex h-20 w-20 items-center justify-center rounded-full"
            style={{
              background: 'linear-gradient(135deg, rgba(0,188,212,0.25), rgba(0,100,255,0.15))',
              border: '1px solid rgba(0,188,212,0.35)',
              boxShadow: '0 0 40px rgba(0,190,255,0.25)',
            }}
          >
            <RecyclingIcon size={34} />
          </div>

          {/* Wordmark */}
          <div className="mt-5 text-center">
            <h1 className="text-3xl font-medium tracking-tight" style={{ color: '#ffffff' }}>
              Cyan's{' '}
              <span style={{ color: '#00c8ff' }}>Brooklynn</span>
            </h1>
            <p className="section-label mt-1.5">Recycling Enterprise</p>
          </div>

          {/* Glass card */}
          <div
            className="mt-8 w-full p-6"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(0,190,255,0.15)',
              borderRadius: 20,
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
            }}
          >
            {/* Demo mode banner */}
            {DEV_BYPASS_AUTH && (
              <div
                className="mb-4 flex items-center gap-2 rounded-xl px-3 py-2"
                style={{ background: 'rgba(0,200,255,0.07)', border: '1px solid rgba(0,200,255,0.25)' }}
              >
                <span style={{ fontSize: 13 }}>♻️</span>
                <p style={{ fontSize: 11, color: 'rgba(0,200,255,0.85)', fontWeight: 600 }}>
                  Demo Mode — Sample data only
                </p>
              </div>
            )}

            {/* Card heading */}
            <h2 className="mb-5 text-base font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>
              {DEV_BYPASS_AUTH ? 'Enter as' : 'Sign in to'}{' '}
              <span style={{ color: '#ffffff', fontWeight: 600 }}>{roleLabel}</span>
            </h2>

            {/* Role selector */}
            <div className="mb-5 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {ROLES.map((r) => {
                const active = role === r.id
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRole(r.id)}
                    className="flex shrink-0 flex-col items-center gap-1.5 rounded-xl px-3 py-2.5 text-center transition-all duration-150"
                    style={{
                      background: active ? 'rgba(0,200,255,0.12)' : 'rgba(255,255,255,0.04)',
                      border: active ? '1px solid rgba(0,200,255,0.5)' : '1px solid rgba(255,255,255,0.08)',
                      color: active ? '#00c8ff' : 'rgba(255,255,255,0.5)',
                      boxShadow: active ? '0 0 16px rgba(0,200,255,0.15)' : 'none',
                      minWidth: '68px',
                    }}
                  >
                    <span className="text-lg leading-none">{r.icon}</span>
                    <span className="text-[11px] font-medium leading-none">{r.label}</span>
                  </button>
                )
              })}
            </div>

            {DEV_BYPASS_AUTH && (
              <div className="mt-2 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleEnterDemo}
                  className="flex w-full items-center justify-center gap-2 py-3.5 text-sm font-semibold text-white transition-all duration-200 hover:brightness-110 active:scale-[0.97]"
                  style={{
                    background: 'linear-gradient(135deg, #0057e7, #00c8ff)',
                    borderRadius: 14,
                    boxShadow: '0 4px 24px rgba(0,190,255,0.35)',
                  }}
                >
                  Enter Demo
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>

                <button
                  type="button"
                  onClick={handleRunFullDemo}
                  className="flex w-full items-center justify-center gap-2 py-3 text-sm font-semibold transition-all duration-200 hover:brightness-110 active:scale-[0.97]"
                  style={{
                    background: 'rgba(0,200,255,0.08)',
                    border: '1px solid rgba(0,200,255,0.35)',
                    borderRadius: 14,
                    color: '#00c8ff',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  Run Full Demo
                </button>
              </div>
            )}

            {!DEV_BYPASS_AUTH && <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div className="space-y-1.5">
                <label className="section-label block">Email</label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="input-glow w-full px-4 py-3 text-sm outline-none transition-all duration-200"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(0,190,255,0.2)',
                    borderRadius: 12,
                    color: '#ffffff',
                  }}
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="section-label">Password</label>
                  <button
                    type="button"
                    className="text-xs transition-opacity hover:opacity-70"
                    style={{ color: 'rgba(0,200,255,0.7)' }}
                  >
                    Forgot password?
                  </button>
                </div>
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-glow w-full px-4 py-3 text-sm outline-none transition-all duration-200"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(0,190,255,0.2)',
                    borderRadius: 12,
                    color: '#ffffff',
                  }}
                />
              </div>

              {/* Error message */}
              {error && (
                <div
                  className="px-4 py-2.5 text-sm"
                  style={{
                    background: 'rgba(239,68,68,0.1)',
                    border: '1px solid rgba(239,68,68,0.25)',
                    borderRadius: 12,
                    color: '#f87171',
                  }}
                >
                  {error}
                </div>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={loading}
                className="mt-1 flex w-full items-center justify-center gap-2 py-3.5 text-sm font-semibold text-white transition-all duration-200 hover:brightness-110 active:scale-[0.97] disabled:opacity-50"
                style={{
                  background: 'linear-gradient(135deg, #0057e7, #00c8ff)',
                  border: 'none',
                  borderRadius: 14,
                  boxShadow: '0 4px 24px rgba(0,190,255,0.35)',
                }}
              >
                {loading ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                ) : (
                  <>
                    Sign In
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </>
                )}
              </button>
            </form>}

          </div>

          {/* Create account + Run Demo — hidden in demo mode */}
          {!DEV_BYPASS_AUTH && (
            <>
              <p className="mt-7 text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                New to Cyan's Brooklynn?{' '}
                <Link
                  to="/signup"
                  className="font-medium transition-opacity hover:opacity-80"
                  style={{ color: '#00c8ff' }}
                >
                  Create account
                </Link>
              </p>
              <button
                type="button"
                onClick={() => setDemoMode(true)}
                className="mt-5 flex items-center gap-2 text-sm font-medium transition-opacity hover:opacity-80"
                style={{ color: 'rgba(56,189,248,0.6)' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                Run Demo
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}
