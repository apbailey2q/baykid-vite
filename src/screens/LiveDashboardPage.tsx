import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import type { User } from '@supabase/supabase-js'

type RecentScan = {
  id:        string
  scan_time: string
  location:  string | null
  bags:      { bag_code: string; status: string } | null
}

type Profile = {
  id:              string
  email:           string
  full_name:       string | null
  city:            string | null
  role:            string
  approval_status: string
}

const ROLE_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  consumer:             { label: 'Consumer',            color: '#00c8ff', bg: 'rgba(0,200,255,0.1)',   border: 'rgba(0,200,255,0.3)'   },
  driver:               { label: 'Driver',              color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.3)'  },
  warehouse:            { label: 'Warehouse',           color: '#a78bfa', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.3)' },
  warehouse_supervisor: { label: 'Supervisor',          color: '#f472b6', bg: 'rgba(244,114,182,0.1)', border: 'rgba(244,114,182,0.3)' },
  partner:              { label: 'Partner',             color: '#5eead4', bg: 'rgba(94,234,212,0.1)',  border: 'rgba(94,234,212,0.3)'  },
  admin:                { label: 'Admin',               color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.3)' },
}

const STATUS_META: Record<string, { color: string }> = {
  approved: { color: '#4ade80' },
  pending:  { color: '#fbbf24' },
  rejected: { color: '#f87171' },
}

export default function LiveDashboardPage() {
  const navigate = useNavigate()
  const [animate, setAnimate]           = useState(false)
  const [user, setUser]                     = useState<User | null>(null)
  const [profile, setProfile]               = useState<Profile | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [recentScans, setRecentScans]       = useState<RecentScan[]>([])
  const [signingOut, setSigningOut]         = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimate(true))
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    let mounted = true

    async function loadUser() {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!mounted) return
      if (!authUser) {
        navigate('/real-login', { replace: true })
        return
      }
      setUser(authUser)
      await loadProfile(authUser.id, authUser.email ?? '')
    }

    async function loadProfile(userId: string, userEmail: string) {
      if (!mounted) return
      setProfileLoading(true)

      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, city, role, approval_status')
        .eq('id', userId)
        .maybeSingle()

      if (!mounted) return

      if (data) {
        setProfile(data as Profile)
      } else {
        // Profile missing — create it now (handles confirmed-email signup case)
        const { data: created } = await supabase
          .from('profiles')
          .upsert(
            { id: userId, email: userEmail, role: 'consumer', approval_status: 'pending' },
            { onConflict: 'id' }
          )
          .select('id, email, full_name, city, role, approval_status')
          .maybeSingle()
        if (created && mounted) setProfile(created as Profile)
        if (error) console.error('[loadProfile]', error.message)
      }

      setProfileLoading(false)

      // Fetch recent scans
      const { data: scans } = await supabase
        .from('bag_scans')
        .select('id, scan_time, location, qr_bags(bag_code, status)')
        .eq('scanned_by', userId)
        .order('scan_time', { ascending: false })
        .limit(5)
      if (scans && mounted) setRecentScans(scans as unknown as RecentScan[])
    }

    loadUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate('/real-login', { replace: true })
      } else {
        setUser(session.user)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [navigate])

  async function handleSignOut() {
    setSigningOut(true)
    await supabase.auth.signOut()
    navigate('/real-login', { replace: true })
  }

  const fade = (delay = 0): React.CSSProperties => ({
    opacity:    animate ? 1 : 0,
    transform:  animate ? 'translateY(0)' : 'translateY(14px)',
    transition: `opacity 0.4s ease ${delay}ms, transform 0.4s ease ${delay}ms`,
  })

  const roleMeta  = ROLE_META[profile?.role ?? 'consumer']  ?? ROLE_META.consumer
  const statusMeta = STATUS_META[profile?.approval_status ?? 'pending'] ?? STATUS_META.pending

  const LIVE_CARDS = [
    { label: 'Live QR Bags',         route: '/live-bags',              icon: '📦', color: '#00c8ff', bg: 'rgba(0,200,255,0.08)',   border: 'rgba(0,200,255,0.25)'  },
    { label: 'Live Fundraisers',     route: '/live-fundraisers',       icon: '🌱', color: '#4ade80', bg: 'rgba(74,222,128,0.08)',  border: 'rgba(74,222,128,0.25)' },
    { label: 'Live Wallet',          route: '/live-wallet',            icon: '💳', color: '#5eead4', bg: 'rgba(94,234,212,0.08)', border: 'rgba(94,234,212,0.25)' },
    { label: 'Live Notifications',   route: '/live-notifications',     icon: '🔔', color: '#fbbf24', bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.25)' },
    { label: 'Payout Admin',         route: '/live-payout-admin',      icon: '💰', color: '#f87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.25)' },
    { label: 'Live Reports',         route: '/live-reports',           icon: '📊', color: '#a78bfa', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.25)' },
    { label: 'Admin Center',         route: '/live-admin',             icon: '🛡️', color: '#f87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.25)' },
  ]

  return (
    <div
      className="relative min-h-screen flex flex-col overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}
    >
      <style>{`
        @keyframes spinLD { to { transform:rotate(360deg); } }
        @keyframes ldPulse { 0%,100%{opacity:1}50%{opacity:.4} }
      `}</style>

      <div className="pointer-events-none absolute inset-0 grid-bg" />
      <div className="pointer-events-none absolute" style={{ top: -80,   left: -60,  width: 300, height: 300, background: 'rgba(0,87,231,0.25)',  filter: 'blur(72px)', borderRadius: '50%' }} />
      <div className="pointer-events-none absolute" style={{ bottom: -60, right: -40, width: 240, height: 240, background: 'rgba(0,200,128,0.1)',  filter: 'blur(64px)', borderRadius: '50%' }} />

      {/* Header */}
      <header
        className="relative flex items-center justify-between px-4 py-3"
        style={{ background: 'rgba(4,10,24,0.92)', borderBottom: '1px solid rgba(0,200,255,0.12)', backdropFilter: 'blur(12px)', zIndex: 2 }}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl font-extrabold" style={{ color: '#00c8ff' }}>BayKid</span>
          <span style={{ color: 'rgba(0,200,255,0.3)' }}>|</span>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#4ade80', boxShadow: '0 0 6px rgba(74,222,128,0.8)' }} />
            <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>Live</span>
          </div>
          {profile && (
            <span
              className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider"
              style={{ background: roleMeta.bg, border: `1px solid ${roleMeta.border}`, color: roleMeta.color }}
            >
              {roleMeta.label}
            </span>
          )}
        </div>
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="text-sm transition-opacity hover:opacity-70"
          style={{ color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          {signingOut ? 'Signing out…' : 'Sign Out'}
        </button>
      </header>

      <div className="relative flex-1 overflow-y-auto pb-24" style={{ zIndex: 1 }}>
        <div className="max-w-[520px] mx-auto px-4 pt-8 pb-8">

          {/* Heading */}
          <div className="mb-6" style={fade(0)}>
            <div className="flex items-center gap-2 mb-2">
              <span
                className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest"
                style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80' }}
              >
                Live Mode
              </span>
              <span
                className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest"
                style={{ background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.22)', color: '#00c8ff' }}
              >
                Supabase
              </span>
            </div>
            <h1 className="text-2xl font-extrabold leading-tight mb-1.5" style={{ color: '#ffffff' }}>
              Live Dashboard
            </h1>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Connected to the production backend.
            </p>
          </div>

          {/* Profile card */}
          <div
            className="rounded-2xl p-5 mb-6"
            style={{ background: 'rgba(0,87,231,0.1)', border: '1px solid rgba(0,200,255,0.25)', ...fade(60) }}
          >
            {profileLoading ? (
              <div className="flex items-center gap-3 py-2">
                <span
                  className="w-5 h-5 rounded-full border-2 shrink-0"
                  style={{ borderColor: 'rgba(0,200,255,0.2)', borderTopColor: '#00c8ff', animation: 'spinLD 0.7s linear infinite' }}
                />
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Loading profile…</span>
              </div>
            ) : (
              <>
                {/* Avatar row */}
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 text-2xl"
                    style={{ background: 'rgba(0,200,255,0.12)', border: '1px solid rgba(0,200,255,0.3)' }}
                  >
                    👤
                  </div>
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize: 15, fontWeight: 800, color: '#ffffff', lineHeight: 1.2 }}>
                      {profile?.full_name ?? user?.email ?? '—'}
                    </p>
                    {profile?.full_name && (
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', marginTop: 2 }}>
                        {user?.email}
                      </p>
                    )}
                  </div>
                  {/* Role badge */}
                  <span
                    className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0"
                    style={{ background: roleMeta.bg, border: `1px solid ${roleMeta.border}`, color: roleMeta.color }}
                  >
                    {roleMeta.label}
                  </span>
                </div>

                {/* Profile rows */}
                <div className="flex flex-col gap-0">
                  {[
                    { label: 'Email',           value: profile?.email ?? user?.email ?? '—',      color: 'rgba(255,255,255,0.7)' },
                    { label: 'City',            value: profile?.city ?? '—',                      color: 'rgba(255,255,255,0.7)' },
                    { label: 'Role',            value: roleMeta.label,                            color: roleMeta.color         },
                    { label: 'Approval Status', value: profile?.approval_status ?? '—',           color: statusMeta.color       },
                    { label: 'Auth Session',    value: user ? 'Active' : 'Checking…',             color: user ? '#4ade80' : '#fbbf24' },
                    { label: 'Last Sign In',    value: user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : '—', color: 'rgba(255,255,255,0.45)' },
                  ].map((row, i, arr) => (
                    <div
                      key={row.label}
                      className="flex items-center justify-between"
                      style={{
                        paddingTop:    i === 0 ? 0 : 10,
                        paddingBottom: i < arr.length - 1 ? 10 : 0,
                        borderBottom:  i < arr.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                      }}
                    >
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)' }}>{row.label}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: row.color }}>{row.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Live section cards */}
          <div className="mb-6" style={fade(140)}>
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Live Sections
            </p>
            <div className="flex flex-col gap-3">
              {LIVE_CARDS.map(card => (
                <Link
                  key={card.route}
                  to={card.route}
                  className="flex items-center gap-3 p-4 rounded-2xl transition-all hover:brightness-110 active:scale-[0.98]"
                  style={{ background: card.bg, border: `1px solid ${card.border}`, textDecoration: 'none' }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-lg"
                    style={{ background: card.bg, border: `1px solid ${card.border}` }}
                  >
                    {card.icon}
                  </div>
                  <p style={{ flex: 1, fontSize: 14, fontWeight: 700, color: card.color }}>{card.label}</p>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={card.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.55 }}>
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          </div>

          {/* Quick actions */}
          <div className="mb-6" style={fade(180)}>
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Quick Actions
            </p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: '📦 Live QR Scan',      to: '/live-scan',        color: '#00c8ff', bg: 'rgba(0,200,255,0.08)',   border: 'rgba(0,200,255,0.22)'   },
                { label: '🔍 Live Inspection',   to: '/live-inspection',  color: '#5eead4', bg: 'rgba(94,234,212,0.08)',  border: 'rgba(94,234,212,0.22)'  },
                { label: '🚀 Back to Demo',      to: '/login',            color: '#fbbf24', bg: 'rgba(251,191,36,0.08)',  border: 'rgba(251,191,36,0.22)'  },
              ].map(btn => (
                <Link
                  key={btn.to}
                  to={btn.to}
                  className={`flex items-center justify-center py-3 rounded-xl text-xs font-bold transition-all hover:brightness-110 active:scale-[0.98] ${btn.label.includes('Demo') ? 'col-span-2' : ''}`}
                  style={{ background: btn.bg, border: `1px solid ${btn.border}`, color: btn.color, textDecoration: 'none' }}
                >
                  {btn.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Recent scans */}
          {recentScans.length > 0 && (
            <div className="mb-6" style={fade(200)}>
              <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Recent Live Scans
              </p>
              <div className="flex flex-col gap-2">
                {recentScans.map(s => (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    <span style={{ fontSize: 18, flexShrink: 0 }}>📦</span>
                    <div className="flex-1 min-w-0">
                      <p style={{ fontSize: 12, fontWeight: 700, color: '#ffffff' }}>
                        {s.bags?.bag_code ?? 'Unknown bag'}
                      </p>
                      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', marginTop: 1 }}>
                        {s.location ?? 'personal'} · {new Date(s.scan_time).toLocaleDateString()}
                      </p>
                    </div>
                    <span
                      className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide shrink-0"
                      style={{
                        background: s.bags?.status === 'inspected' ? 'rgba(74,222,128,0.12)' : 'rgba(251,191,36,0.12)',
                        border:     s.bags?.status === 'inspected' ? '1px solid rgba(74,222,128,0.3)' : '1px solid rgba(251,191,36,0.3)',
                        color:      s.bags?.status === 'inspected' ? '#4ade80' : '#fbbf24',
                      }}
                    >
                      {(s.bags?.status ?? 'pending').replace(/_/g, ' ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Demo mode link */}
          <div
            className="rounded-2xl p-4 mb-6 flex items-start gap-3"
            style={{ background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.2)', ...fade(260) }}
          >
            <span style={{ fontSize: 16, lineHeight: 1, marginTop: 1, flexShrink: 0 }}>💡</span>
            <div>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>
                Demo flows remain available and unaffected. Live data and demo data are fully separate.
              </p>
              <Link
                to="/login"
                style={{ fontSize: 11, color: '#00c8ff', fontWeight: 600, textDecoration: 'none', display: 'inline-block', marginTop: 6 }}
              >
                → Switch to Demo Mode
              </Link>
            </div>
          </div>

          {/* Legal links */}
          <div className="flex items-center justify-center gap-3 mb-4" style={fade(290)}>
            <Link to="/terms"   style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', textDecoration: 'none', fontWeight: 500 }}>Terms</Link>
            <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 10 }}>·</span>
            <Link to="/privacy" style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', textDecoration: 'none', fontWeight: 500 }}>Privacy</Link>
            <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 10 }}>·</span>
            <Link to="/consent" style={{ fontSize: 10, color: 'rgba(0,200,255,0.5)', textDecoration: 'none', fontWeight: 600 }}>Consent</Link>
          </div>

          {/* Sign out */}
          <div style={fade(300)}>
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold transition-all hover:brightness-110 active:scale-[0.98]"
              style={{ background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.22)', color: '#f87171', cursor: signingOut ? 'not-allowed' : 'pointer' }}
            >
              {signingOut ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2" style={{ borderColor: 'rgba(248,113,113,0.2)', borderTopColor: '#f87171', animation: 'spinLD 0.7s linear infinite' }} />
                  Signing out…
                </>
              ) : '← Sign Out'}
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
