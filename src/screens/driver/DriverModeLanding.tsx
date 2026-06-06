// ── Driver Mode Landing ──────────────────────────────────────────────────────
// Shared landing for both Residential (/driver/residential) and Commercial
// (/driver/commercial). Mode-specific copy + action cards.
// Action cards route to either NEW driver screens (e.g. /driver/scan) or
// existing screens (e.g. /dashboard/driver/route) — no functionality is
// duplicated, this is just the navigation surface for the chosen mode.

import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { setDriverMode, type DriverMode } from './DriverModeSelect'
import { setDriverOnlineSync } from '../../lib/driverOnlineSync'

interface Action {
  icon:  string
  title: string
  desc:  string
  to:    string
  accent?: 'cyan' | 'teal'
}

const RESIDENTIAL_ACTIONS: Action[] = [
  { icon: '📷', title: 'Scan Bag',           desc: 'QR scan + safety inspection',          to: '/driver/scan',                       accent: 'cyan' },
  { icon: '🗺️', title: 'Active Route',       desc: 'Your current pickup route',            to: '/dashboard/driver/route' },
  { icon: '📦', title: 'Available Pickups',  desc: 'Consumer scans waiting for pickup',    to: '/dashboard/driver' },
  { icon: '🏭', title: 'Warehouse Drop-Off', desc: 'Check in completed bags',              to: '/dashboard/driver/warehouse-checkin' },
  { icon: '💰', title: 'Earnings',           desc: 'Today, weekly, lifetime',              to: '/dashboard/driver/earnings' },
]

const COMMERCIAL_ACTIONS: Action[] = [
  { icon: '📷', title: 'Scan Container / Bag', desc: 'Container QR + safety inspection',  to: '/driver/commercial-scan',           accent: 'teal' },
  { icon: '🛣️', title: 'Business Routes',     desc: 'Your commercial pickup route',       to: '/dashboard/driver/commercial-routes' },
  { icon: '🏢', title: 'Commercial Pickups',  desc: 'Pending commercial pickups',         to: '/dashboard/driver/commercial-routes' },
  { icon: '📋', title: 'Manifest Tracking',   desc: 'Loads en route to warehouse',        to: '/dashboard/driver/route' },
  { icon: '🚛', title: 'Warehouse Delivery',  desc: 'Drop off completed loads',           to: '/dashboard/driver/warehouse-checkin' },
  { icon: '⚠️', title: 'Compliance Alerts',   desc: 'Safety and compliance updates',      to: '/dashboard/driver/dispatch-messages' },
]

const COPY: Record<DriverMode, { title: string; subtitle: string; actions: Action[]; accent: string }> = {
  residential: {
    title:    'Residential Driver Dashboard',
    subtitle: 'Household recycling pickups and QR bag scans.',
    actions:  RESIDENTIAL_ACTIONS,
    accent:   '#00c8ff',
  },
  commercial: {
    title:    'Commercial Driver Dashboard',
    subtitle: 'Business pickups, container scans and manifest tracking.',
    actions:  COMMERCIAL_ACTIONS,
    accent:   '#5eead4',
  },
}

export default function DriverModeLanding({ mode }: { mode: DriverMode }) {
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()
  const firstName = (profile?.full_name ?? '').split(' ')[0] || 'Driver'
  const copy = COPY[mode]

  function switchMode() {
    console.log('[driver] switching mode — returning to /driver/mode')
    // Don't clear the persisted mode here — the user might cancel out of
    // the selector. /driver/mode shows the cards; pick to commit.
    navigate('/driver/mode')
  }

  function goOnlineToggle() {
    // Phase G.9 — setDriverOnlineSync writes localStorage (preserving the
    // existing 'driver-online-toggle' event) AND mirrors into driver_status
    // so admin dispatch sees the change. Fire-and-forget — the local write
    // is synchronous before the await so the reload below still reflects
    // the new value.
    try {
      const cur = localStorage.getItem('driverOnline') === 'true'
      const next = !cur
      void setDriverOnlineSync(user?.id, next)
      console.log('[driver] online state:', next)
      // Visible feedback via reload of the landing (cheap, predictable).
      // Reload preserves URL so user stays on this landing.
      window.location.reload()
    } catch (e) {
      console.warn('[driver] online toggle failed:', e)
    }
  }

  const isOnline = (() => {
    try { return localStorage.getItem('driverOnline') === 'true' } catch { return false }
  })()

  return (
    <div
      className="relative min-h-screen overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}
    >
      <div className="pointer-events-none absolute inset-0 grid-bg" />

      <div className="relative max-w-md mx-auto px-5 pt-8 pb-12" style={{ zIndex: 1 }}>
        {/* Header */}
        <div style={{ animation: 'fadeSlideUp 0.4s ease both' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              {mode === 'residential' ? 'Residential' : 'Commercial'} mode
            </p>
            <button
              onClick={switchMode}
              style={{
                fontSize: 11, fontWeight: 600,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.6)',
                padding: '4px 10px', borderRadius: 999, cursor: 'pointer',
              }}
            >
              Switch mode
            </button>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{copy.title}</h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginBottom: 18 }}>
            Welcome, {firstName}. {copy.subtitle}
          </p>
        </div>

        {/* Online / Offline */}
        <button
          onClick={goOnlineToggle}
          style={{
            width: '100%', padding: '14px 18px', borderRadius: 14,
            marginBottom: 18, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: isOnline ? 'rgba(91,255,176,0.10)' : 'rgba(255,255,255,0.04)',
            border:     isOnline ? '1px solid rgba(91,255,176,0.4)' : '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: isOnline ? '#5BFFB0' : 'rgba(255,255,255,0.3)',
              boxShadow:  isOnline ? '0 0 12px #5BFFB0' : 'none',
            }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>
              {isOnline ? "You're online" : "You're offline"}
            </span>
          </span>
          <span style={{ fontSize: 12, color: isOnline ? '#5BFFB0' : 'rgba(255,255,255,0.5)', fontWeight: 600 }}>
            {isOnline ? 'Tap to go offline' : 'Tap to go online'}
          </span>
        </button>

        {/* Action cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {copy.actions.map((a, i) => (
            <button
              key={a.title}
              onClick={() => {
                // Persist mode again on any nav so it stays sticky.
                setDriverMode(mode)
                navigate(a.to)
              }}
              style={{
                width: '100%', textAlign: 'left',
                padding: '14px 16px', borderRadius: 14, cursor: 'pointer',
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${a.accent === 'cyan' ? 'rgba(0,200,255,0.35)' : a.accent === 'teal' ? 'rgba(94,234,212,0.35)' : 'rgba(255,255,255,0.08)'}`,
                display: 'flex', alignItems: 'center', gap: 14,
                animation: `fadeSlideUp 0.35s ease both`,
                animationDelay: `${0.05 * i}s`,
              }}
            >
              <span style={{
                width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                background: `${copy.accent}18`,
                border: `1px solid ${copy.accent}40`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18,
              }}>{a.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, color: '#fff', fontWeight: 600 }}>{a.title}</p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{a.desc}</p>
              </div>
              <span style={{ color: copy.accent, fontSize: 16, flexShrink: 0 }}>→</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
