// ── Driver Mode Selection ────────────────────────────────────────────────────
// Approved drivers land here after WelcomeBack. They pick Residential or
// Commercial; the choice routes them to the corresponding mode landing.
// Choice is persisted to localStorage so the same browser remembers the
// last-used mode for the "Switch mode" affordance on each landing.

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { canAccessCommercialDriver } from '../../lib/auth'

const MODE_KEY = 'baykid-driver-mode'

export type DriverMode = 'residential' | 'commercial'

export function setDriverMode(mode: DriverMode) {
  try { localStorage.setItem(MODE_KEY, mode) } catch { /* storage unavailable */ }
  console.log('[driver] mode selected:', mode)
}

export function getDriverMode(): DriverMode | null {
  try {
    const v = localStorage.getItem(MODE_KEY)
    return v === 'residential' || v === 'commercial' ? v : null
  } catch { return null }
}

export default function DriverModeSelect() {
  const navigate = useNavigate()
  const { profile } = useAuthStore()
  const firstName = (profile?.full_name ?? '').split(' ')[0]

  // Consumer-only 1099 drivers must NEVER see the selection screen. Whether
  // they got here via direct URL or stale localStorage, route them straight
  // to their consumer-routes dashboard. The server-side RLS gate
  // (is_commercial_capable_driver) is the authoritative defense; this is
  // the matching client-side UX guard.
  useEffect(() => {
    if (profile && !canAccessCommercialDriver(profile)) {
      setDriverMode('residential')
      navigate('/dashboard/driver/consumer-routes', { replace: true })
    }
  }, [profile, navigate])

  function choose(mode: DriverMode) {
    setDriverMode(mode)
    // Consumer routes → consumer/residential driver dashboard
    // Commercial routes → commercial driver dashboard
    navigate(
      mode === 'residential'
        ? '/dashboard/driver/consumer-routes'
        : '/dashboard/driver/commercial-routes',
      { replace: true },
    )
  }

  return (
    <div
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-5 py-10"
      style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}
    >
      <div className="pointer-events-none absolute inset-0 grid-bg" />
      <div className="pointer-events-none absolute" style={{ top: -90, left: -50, width: 300, height: 300, background: 'rgba(0,87,231,0.22)', filter: 'blur(72px)', borderRadius: '50%' }} />
      <div className="pointer-events-none absolute" style={{ bottom: -60, right: -40, width: 220, height: 220, background: 'rgba(94,234,212,0.10)', filter: 'blur(64px)', borderRadius: '50%' }} />

      <div className="relative w-full max-w-md" style={{ zIndex: 1, animation: 'fadeSlideUp 0.5s ease both' }}>
        <header className="text-center mb-6">
          <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>
            {firstName ? `Hi, ${firstName}` : 'Driver'}
          </p>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
            Choose Driver Mode
          </h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 1.55 }}>
            Select the type of pickups you will perform today.
          </p>
        </header>

        <ModeCard
          accent="#00c8ff"
          icon="🏠"
          title="Consumer Driver"
          body="Residential recycling pickups, QR bag scans, apartment routes, and customer pickup tracking."
          cta="Consumer Routes"
          onClick={() => choose('residential')}
        />

        <div style={{ height: 14 }} />

        <ModeCard
          accent="#5eead4"
          icon="🏢"
          title="Commercial Driver"
          body="Business pickups, bulk container scans, commercial routes, manifests, and warehouse delivery tracking."
          cta="Commercial Routes"
          onClick={() => choose('commercial')}
        />

        <p style={{
          marginTop: 18, textAlign: 'center', fontSize: 11,
          color: 'rgba(255,255,255,0.3)', lineHeight: 1.55,
        }}>
          You can switch modes at any time from this screen.
        </p>
      </div>
    </div>
  )
}

function ModeCard({
  accent, icon, title, body, cta, onClick,
}: {
  accent: string; icon: string; title: string; body: string; cta: string; onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left', padding: '20px 18px',
        borderRadius: 18, cursor: 'pointer',
        background: 'rgba(255,255,255,0.04)',
        border: `1px solid ${accent}40`,
        boxShadow: `0 8px 32px ${accent}18`,
        transition: 'transform 0.18s ease, border-color 0.18s ease',
        display: 'block',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <span style={{
          width: 44, height: 44, borderRadius: 12,
          background: `${accent}1A`, border: `1px solid ${accent}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, flexShrink: 0,
        }}>{icon}</span>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: '#fff' }}>{title}</h2>
      </div>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.55, marginBottom: 14 }}>
        {body}
      </p>
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '8px 16px', borderRadius: 999,
        background: accent, color: '#04101e',
        fontSize: 13, fontWeight: 700,
      }}>
        {cta} <span>→</span>
      </span>
    </button>
  )
}
