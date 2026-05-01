import { Link, useNavigate, useLocation } from 'react-router-dom'
import { signOut } from '../lib/auth'
import { useAuthStore } from '../store/authStore'

// ── Unchanged logic ───────────────────────────────────────────────────────────
const SCAN_ROLES = new Set(['driver', 'warehouse_employee', 'warehouse_supervisor', 'admin'])

interface Props {
  title: string
  children?: React.ReactNode
}

function getInitials(name: string) {
  return name.split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2)
}

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

export function DashboardShell({ title, children }: Props) {
  const { profile, role, clearAuth } = useAuthStore()
  const navigate  = useNavigate()
  const location  = useLocation()

  const handleSignOut = async () => {
    try { await signOut() } catch { /* no real session in dev bypass — safe to ignore */ }
    clearAuth()
    localStorage.removeItem('baykid-auth')
    navigate('/login', { replace: true })
  }

  // Unchanged
  const showScanBtn = role ? SCAN_ROLES.has(role) : false

  const initials = profile?.full_name ? getInitials(profile.full_name) : '??'
  const onScan   = location.pathname === '/scan'

  return (
    <div
      className="relative min-h-screen"
      style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}
    >
      {/* Grid overlay */}
      <div className="pointer-events-none absolute inset-0 grid-bg" style={{ zIndex: 0 }} />

      {/* Orb top-left */}
      <div
        className="pointer-events-none absolute"
        style={{ top: -80, left: -60, width: 300, height: 300, background: 'rgba(0,87,231,0.3)', filter: 'blur(80px)', borderRadius: '50%', zIndex: 0 }}
      />
      {/* Orb bottom-right */}
      <div
        className="pointer-events-none absolute"
        style={{ bottom: -60, right: -40, width: 260, height: 260, background: 'rgba(0,200,255,0.2)', filter: 'blur(72px)', borderRadius: '50%', zIndex: 0 }}
      />

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-20 flex items-center justify-between px-4 py-3"
        style={{
          background: 'rgba(6,14,36,0.92)',
          borderBottom: '1px solid rgba(0,190,255,0.12)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
        }}
      >
        {/* Branding */}
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
            style={{
              background: 'linear-gradient(135deg, rgba(0,188,212,0.25), rgba(0,100,255,0.15))',
              border: '1px solid rgba(0,188,212,0.35)',
            }}
          >
            <RecyclingIcon size={14} />
          </div>
          <div className="flex items-baseline gap-1.5 leading-none">
            <span className="text-base font-semibold" style={{ color: '#ffffff' }}>Cyan's</span>
            <span className="text-base font-semibold" style={{ color: '#00c8ff' }}>Brooklynn</span>
          </div>
          <span className="hidden text-xs sm:block" style={{ color: 'rgba(255,255,255,0.3)' }}>
            / {title}
          </span>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-3">
          {/* Bell */}
          <button
            className="flex h-8 w-8 items-center justify-center rounded-full transition-opacity hover:opacity-70"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
            aria-label="Notifications"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
          </button>

          {/* Avatar */}
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
            style={{
              background: 'linear-gradient(135deg, rgba(0,87,231,0.5), rgba(0,200,255,0.3))',
              border: '1px solid rgba(0,200,255,0.35)',
              color: '#ffffff',
            }}
          >
            {initials}
          </div>
        </div>
      </header>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <main
        className="relative mx-auto w-full max-w-[430px] px-4 py-5"
        style={{ zIndex: 1, paddingBottom: '88px' }}
      >
        {children ?? (
          <div
            className="mt-4 p-14 text-center"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px dashed rgba(0,190,255,0.15)',
              borderRadius: 20,
            }}
          >
            <p className="text-xl font-semibold" style={{ color: 'rgba(0,200,255,0.5)' }}>{title}</p>
            <p className="mt-2 text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Coming soon in a future phase</p>
            {showScanBtn && (
              <Link
                to="/scan"
                className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{
                  background: 'linear-gradient(135deg, #0057e7, #00c8ff)',
                  borderRadius: 12,
                  boxShadow: '0 4px 20px rgba(0,190,255,0.3)',
                }}
              >
                Scan a Bag
              </Link>
            )}
          </div>
        )}
      </main>

      {/* ── Bottom nav ──────────────────────────────────────────────────────── */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-20 flex items-center justify-around px-4 py-2"
        style={{
          background: 'rgba(6,14,36,0.95)',
          borderTop: '1px solid rgba(0,190,255,0.12)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
        }}
      >
        {/* Home */}
        <Link
          to="/"
          className="flex flex-col items-center gap-1 px-4 py-2 transition-opacity hover:opacity-80"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={!onScan ? '#00c8ff' : 'rgba(255,255,255,0.35)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <span
            className="text-[10px] font-medium"
            style={{ color: !onScan ? '#00c8ff' : 'rgba(255,255,255,0.35)' }}
          >
            Home
          </span>
          {!onScan && (
            <span
              className="absolute bottom-1.5 h-1 w-1 rounded-full"
              style={{ background: '#00c8ff', boxShadow: '0 0 6px #00c8ff' }}
            />
          )}
        </Link>

        {/* Scan — only for eligible roles (unchanged showScanBtn logic) */}
        {showScanBtn && (
          <Link
            to="/scan"
            className="flex flex-col items-center gap-1 px-4 py-2 transition-opacity hover:opacity-80"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={onScan ? '#00c8ff' : 'rgba(255,255,255,0.35)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7V5a2 2 0 0 1 2-2h2" />
              <path d="M17 3h2a2 2 0 0 1 2 2v2" />
              <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
              <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
              <line x1="7" x2="7" y1="8" y2="16" />
              <line x1="12" x2="12" y1="8" y2="16" />
              <line x1="17" x2="17" y1="8" y2="16" />
            </svg>
            <span
              className="text-[10px] font-medium"
              style={{ color: onScan ? '#00c8ff' : 'rgba(255,255,255,0.35)' }}
            >
              Scan
            </span>
            {onScan && (
              <span
                className="absolute bottom-1.5 h-1 w-1 rounded-full"
                style={{ background: '#00c8ff', boxShadow: '0 0 6px #00c8ff' }}
              />
            )}
          </Link>
        )}

        {/* Sign out — unchanged handleSignOut logic */}
        <button
          onClick={handleSignOut}
          className="flex flex-col items-center gap-1 px-4 py-2 transition-opacity hover:opacity-80"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" x2="9" y1="12" y2="12" />
          </svg>
          <span className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Sign Out
          </span>
        </button>
      </nav>
    </div>
  )
}
