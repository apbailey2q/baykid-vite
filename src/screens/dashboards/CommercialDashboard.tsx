import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { supabase } from '../../lib/supabaseClient'
import { logout } from '../../lib/auth'

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = 'home' | 'pickups' | 'bins' | 'reports' | 'account'

type PickupSummary = {
  id: string
  status: string
  pickup_type: string
  scheduled_at: string | null
  bin_count: number
  material_type: string
}

type BinSummary = {
  id: string
  bin_code: string
  bin_type: string
  fill_estimate: number
  contamination_status: string
  location_label: string
}

type InvoiceSummary = {
  id: string
  amount: number
  status: string
  due_date: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ACCENT = '#00c8ff'

const STATUS_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  requested:  { bg: 'rgba(251,191,36,0.15)',  color: '#fbbf24', label: 'Requested'  },
  scheduled:  { bg: 'rgba(0,200,255,0.15)',   color: '#00c8ff', label: 'Scheduled'  },
  en_route:   { bg: 'rgba(139,92,246,0.18)',  color: '#a78bfa', label: 'En Route'   },
  completed:  { bg: 'rgba(74,222,128,0.15)',  color: '#4ade80', label: 'Completed'  },
  cancelled:  { bg: 'rgba(248,113,113,0.15)', color: '#f87171', label: 'Cancelled'  },
}

const FILL_COLOR = (pct: number) =>
  pct >= 90 ? '#f87171' : pct >= 70 ? '#fbbf24' : '#4ade80'

// ── Sub-component: BottomNav ──────────────────────────────────────────────────

function BottomNav({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  const items: { id: Tab; label: string; icon: (a: boolean) => React.ReactNode }[] = [
    {
      id: 'home', label: 'Home',
      icon: (a) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill={a ? ACCENT : 'none'} stroke={a ? ACCENT : 'rgba(255,255,255,0.35)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      ),
    },
    {
      id: 'pickups', label: 'Pickups',
      icon: (a) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a ? ACCENT : 'rgba(255,255,255,0.35)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="3" width="15" height="13" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />
        </svg>
      ),
    },
    {
      id: 'bins', label: 'Bins',
      icon: (a) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a ? ACCENT : 'rgba(255,255,255,0.35)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="21 8 21 21 3 21 3 8" /><rect x="1" y="3" width="22" height="5" /><line x1="10" y1="12" x2="14" y2="12" />
        </svg>
      ),
    },
    {
      id: 'reports', label: 'Reports',
      icon: (a) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a ? ACCENT : 'rgba(255,255,255,0.35)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      ),
    },
    {
      id: 'account', label: 'Account',
      icon: (a) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill={a ? ACCENT : 'none'} stroke={a ? ACCENT : 'rgba(255,255,255,0.35)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
        </svg>
      ),
    },
  ]

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 flex items-end justify-around px-2"
      style={{
        background: 'rgba(6,14,36,0.97)',
        borderTop: '1px solid rgba(0,190,255,0.15)',
        backdropFilter: 'blur(20px)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)',
        paddingTop: '8px',
      }}
    >
      {items.map((item) => {
        const active = tab === item.id
        return (
          <button
            key={item.id}
            onClick={() => onTab(item.id)}
            className="relative flex flex-col items-center gap-0.5 min-w-[52px] py-1 transition-all duration-150 active:scale-[0.88]"
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
          >
            {item.icon(active)}
            <span style={{ fontSize: 10, fontWeight: active ? 700 : 500, color: active ? ACCENT : 'rgba(255,255,255,0.35)', letterSpacing: '0.02em' }}>
              {item.label}
            </span>
            {active && (
              <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full" style={{ background: ACCENT }} />
            )}
          </button>
        )
      })}
    </nav>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, color = ACCENT }: { icon: string; label: string; value: string | number; color?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <p style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1 }}>{value}</p>
      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</p>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CommercialDashboard() {
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()
  const [tab, setTab]           = useState<Tab>('home')
  const [animate, setAnimate]   = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  // Data
  const [pickups, setPickups]   = useState<PickupSummary[]>([])
  const [bins, setBins]         = useState<BinSummary[]>([])
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([])
  const [accountId, setAccountId] = useState<string | null>(null)

  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimate(true))
    return () => cancelAnimationFrame(id)
  }, [])

  // Load commercial account linked to this user
  useEffect(() => {
    if (!user?.id) return
    supabase
      .from('commercial_accounts')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.id) setAccountId(data.id)
      })
  }, [user?.id])

  // Load pickups
  useEffect(() => {
    if (!accountId) return
    supabase
      .from('commercial_pickups')
      .select('id, status, pickup_type, scheduled_at, bin_count, material_type')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => setPickups((data ?? []) as PickupSummary[]))
  }, [accountId])

  // Load bins
  useEffect(() => {
    if (!accountId) return
    supabase
      .from('commercial_bins')
      .select('id, bin_code, bin_type, fill_estimate, contamination_status, location_label')
      .eq('account_id', accountId)
      .then(({ data }) => setBins((data ?? []) as BinSummary[]))
  }, [accountId])

  // Load invoices
  useEffect(() => {
    if (!accountId) return
    supabase
      .from('commercial_invoices')
      .select('id, amount, status, due_date')
      .eq('account_id', accountId)
      .order('due_date', { ascending: true })
      .limit(5)
      .then(({ data }) => setInvoices((data ?? []) as InvoiceSummary[]))
  }, [accountId])

  async function handleSignOut() {
    setSigningOut(true)
    await logout()
  }

  const fade = (d = 0): React.CSSProperties => ({
    opacity: animate ? 1 : 0,
    transform: animate ? 'translateY(0)' : 'translateY(14px)',
    transition: `opacity 0.4s ease ${d}ms, transform 0.4s ease ${d}ms`,
  })

  const businessName = (profile as { business_name?: string } | null)?.business_name
    ?? (profile as { full_name?: string } | null)?.full_name
    ?? 'Your Business'

  const activePickups  = pickups.filter(p => ['requested', 'scheduled', 'en_route'].includes(p.status)).length
  const flaggedBins    = bins.filter(b => b.contamination_status === 'flagged').length
  const overdueInvoice = invoices.find(i => i.status === 'overdue')

  // ── Action buttons shared across tabs ─────────────────────────────────────

  const ActionGrid = () => (
    <div className="grid grid-cols-2 gap-2.5 px-5 mb-5" style={fade(60)}>
      {[
        { label: 'Request Pickup',      icon: '🚛', color: ACCENT,     bg: 'rgba(0,200,255,0.1)',    border: 'rgba(0,200,255,0.3)',   action: () => navigate('/dashboard/commercial/pickup')   },
        { label: 'Emergency Overflow',  icon: '🚨', color: '#f87171',  bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.35)', action: () => navigate('/dashboard/commercial/pickup?type=emergency') },
        { label: 'Manage Bins',         icon: '🗑️', color: '#a78bfa',  bg: 'rgba(139,92,246,0.1)',  border: 'rgba(139,92,246,0.3)',   action: () => setTab('bins')   },
        { label: 'View Reports',        icon: '📊', color: '#4ade80',  bg: 'rgba(74,222,128,0.1)',  border: 'rgba(74,222,128,0.3)',   action: () => setTab('reports') },
        { label: 'Pay Invoice',         icon: '💳', color: '#fbbf24',  bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.3)',   action: () => navigate('/dashboard/commercial/invoices') },
        { label: 'Contact Dispatch',    icon: '📞', color: '#5eead4',  bg: 'rgba(94,234,212,0.1)',  border: 'rgba(94,234,212,0.3)',   action: () => navigate('/dashboard/commercial/profile')  },
      ].map((btn) => (
        <button
          key={btn.label}
          onClick={btn.action}
          className="flex flex-col items-start gap-2 rounded-2xl px-4 py-4 transition-all hover:brightness-110 active:scale-[0.97]"
          style={{ background: btn.bg, border: `1px solid ${btn.border}`, cursor: 'pointer' }}
        >
          <span style={{ fontSize: 22 }}>{btn.icon}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: btn.color, lineHeight: 1.3 }}>{btn.label}</span>
        </button>
      ))}
    </div>
  )

  // ── HOME TAB ──────────────────────────────────────────────────────────────

  const HomeTab = () => (
    <div style={{ animation: 'fadeSlideUp 0.3s ease both' }}>

      {/* Business header */}
      <div className="px-5 pt-6 pb-4" style={fade(0)}>
        <div className="flex items-start justify-between">
          <div>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Commercial Account</p>
            <p style={{ fontSize: 26, fontWeight: 800, color: '#ffffff', lineHeight: 1.15, marginTop: 4 }}>{businessName}</p>
          </div>
          <div className="px-2.5 py-1 rounded-full" style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#4ade80', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Active</span>
          </div>
        </div>
      </div>

      {/* Alert banner: overdue invoice */}
      {overdueInvoice && (
        <div className="mx-5 mb-4 rounded-2xl px-4 py-3 flex items-center gap-3" style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)' }}>
          <span style={{ fontSize: 18 }}>⚠️</span>
          <div className="flex-1">
            <p style={{ fontSize: 12, fontWeight: 700, color: '#f87171' }}>Invoice Overdue</p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 1 }}>${overdueInvoice.amount.toFixed(2)} due {overdueInvoice.due_date}</p>
          </div>
          <button onClick={() => navigate('/dashboard/commercial/invoices')} style={{ fontSize: 11, color: '#f87171', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer' }}>Pay →</button>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2.5 px-5 mb-5" style={fade(30)}>
        <StatCard icon="🚛" label="Active Pickups"  value={activePickups} />
        <StatCard icon="🗑️" label="Bins Managed"    value={bins.length} color="#a78bfa" />
        <StatCard icon={flaggedBins > 0 ? '⚠️' : '✅'} label="Flagged Bins" value={flaggedBins} color={flaggedBins > 0 ? '#fbbf24' : '#4ade80'} />
      </div>

      {/* Action grid */}
      <ActionGrid />

      {/* Recent pickups */}
      <div className="px-5 mb-5" style={fade(90)}>
        <div className="flex items-center justify-between mb-3">
          <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.09em' }}>Recent Pickups</p>
          <button onClick={() => setTab('pickups')} style={{ fontSize: 11, color: ACCENT, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>See all →</button>
        </div>
        {pickups.length === 0 ? (
          <div className="rounded-2xl px-4 py-6 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>No pickups yet</p>
            <button onClick={() => navigate('/dashboard/commercial/pickup')} style={{ marginTop: 10, fontSize: 12, color: ACCENT, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer' }}>
              Schedule your first pickup →
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {pickups.slice(0, 3).map((p) => {
              const s = STATUS_COLORS[p.status] ?? STATUS_COLORS.requested
              return (
                <div key={p.id} className="rounded-2xl px-4 py-3 flex items-center gap-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <span style={{ fontSize: 20, flexShrink: 0 }}>🚛</span>
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{p.pickup_type}</p>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>
                      {p.bin_count} bin{p.bin_count !== 1 ? 's' : ''} · {p.material_type}
                      {p.scheduled_at ? ` · ${new Date(p.scheduled_at).toLocaleDateString()}` : ''}
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0" style={{ background: s.bg, color: s.color }}>{s.label}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Service plan card */}
      <div className="px-5 mb-5" style={fade(120)}>
        <div className="rounded-2xl px-5 py-4" style={{ background: 'linear-gradient(135deg, rgba(0,87,231,0.25), rgba(0,200,255,0.12))', border: '1px solid rgba(0,200,255,0.2)' }}>
          <div className="flex items-center justify-between mb-2">
            <p style={{ fontSize: 12, fontWeight: 700, color: ACCENT, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Recurring Service Plan</p>
            <span style={{ fontSize: 18 }}>♻️</span>
          </div>
          <p style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>Weekly Commercial Pickup</p>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>Next scheduled pickup: Friday 6 AM – 10 AM</p>
          <button onClick={() => navigate('/dashboard/commercial/schedule')} className="mt-3 text-xs font-semibold transition-opacity hover:opacity-70" style={{ color: ACCENT, background: 'none', border: 'none', cursor: 'pointer' }}>
            Manage schedule →
          </button>
        </div>
      </div>

    </div>
  )

  // ── PICKUPS TAB ───────────────────────────────────────────────────────────

  const PickupsTab = () => (
    <div style={{ animation: 'fadeSlideUp 0.3s ease both' }}>
      <div className="px-5 pt-5 pb-4">
        <p style={{ fontSize: 22, color: '#fff', fontWeight: 700 }}>Pickups</p>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>Schedule, track and manage commercial pickups</p>
      </div>
      <div className="px-5 mb-5">
        <button
          onClick={() => navigate('/dashboard/commercial/pickup')}
          className="w-full flex items-center justify-center gap-3 rounded-2xl py-5 text-base font-bold text-white transition-all hover:brightness-110 active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg,#0057e7,#00c8ff)', boxShadow: '0 6px 28px rgba(0,190,255,0.4)' }}
        >
          🚛 Request Pickup
        </button>
        <button
          onClick={() => navigate('/dashboard/commercial/pickup?type=emergency')}
          className="w-full flex items-center justify-center gap-3 rounded-2xl py-3.5 mt-2 text-sm font-bold transition-all hover:brightness-110 active:scale-[0.98]"
          style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.35)', color: '#f87171' }}
        >
          🚨 Emergency Overflow
        </button>
      </div>
      <div className="px-5 flex flex-col gap-2">
        {pickups.length === 0 ? (
          <div className="rounded-2xl px-4 py-8 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>No pickups scheduled</p>
          </div>
        ) : pickups.map((p) => {
          const s = STATUS_COLORS[p.status] ?? STATUS_COLORS.requested
          return (
            <div key={p.id} className="rounded-2xl px-4 py-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{p.pickup_type}</p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{p.material_type} · {p.bin_count} bin{p.bin_count !== 1 ? 's' : ''}</p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold shrink-0" style={{ background: s.bg, color: s.color }}>{s.label}</span>
              </div>
              {p.scheduled_at && (
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Scheduled: {new Date(p.scheduled_at).toLocaleString()}</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )

  // ── BINS TAB ──────────────────────────────────────────────────────────────

  const BinsTab = () => (
    <div style={{ animation: 'fadeSlideUp 0.3s ease both' }}>
      <div className="px-5 pt-5 pb-4">
        <p style={{ fontSize: 22, color: '#fff', fontWeight: 700 }}>Bins & Containers</p>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>Monitor fill levels and contamination status</p>
      </div>
      <div className="px-5 mb-4">
        <button
          onClick={() => navigate('/dashboard/commercial/bins')}
          className="w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold transition-all hover:brightness-110"
          style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)', color: '#a78bfa' }}
        >
          + Manage Containers
        </button>
      </div>
      {bins.length === 0 ? (
        <div className="mx-5 rounded-2xl px-4 py-8 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>No containers registered</p>
        </div>
      ) : (
        <div className="px-5 flex flex-col gap-3">
          {bins.map((b) => {
            const fillColor = FILL_COLOR(b.fill_estimate)
            const contam = b.contamination_status
            return (
              <div key={b.id} className="rounded-2xl px-4 py-4" style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${contam === 'flagged' ? 'rgba(251,191,36,0.3)' : 'rgba(255,255,255,0.08)'}` }}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{b.bin_code}</p>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>{b.bin_type.replace('qr_', '').toUpperCase()} · {b.location_label}</p>
                  </div>
                  {contam === 'flagged' && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}>Flagged</span>
                  )}
                  {contam === 'clean' && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80' }}>Clean</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                    <div style={{ width: `${b.fill_estimate}%`, height: '100%', background: fillColor, borderRadius: 999, transition: 'width 0.6s ease' }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: fillColor, minWidth: 36, textAlign: 'right' }}>{b.fill_estimate}%</span>
                </div>
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>Fill level</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )

  // ── REPORTS TAB ───────────────────────────────────────────────────────────

  const ReportsTab = () => (
    <div style={{ animation: 'fadeSlideUp 0.3s ease both' }}>
      <div className="px-5 pt-5 pb-4">
        <p style={{ fontSize: 22, color: '#fff', fontWeight: 700 }}>Reports</p>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>Sustainability, invoices and service history</p>
      </div>
      <div className="px-5 flex flex-col gap-3">
        {[
          { icon: '🌿', title: 'Sustainability Report',   sub: 'CO₂ saved, waste diverted',              to: '/dashboard/commercial/reports',  color: '#4ade80' },
          { icon: '💳', title: 'Invoice History',         sub: 'All payments and statements',            to: '/dashboard/commercial/invoices', color: '#fbbf24' },
          { icon: '🗂️', title: 'Pickup History',          sub: 'All completed service records',          to: '/dashboard/commercial/history',  color: ACCENT   },
          { icon: '📋', title: 'SLA Performance',         sub: 'Contract compliance and on-time rates',  to: '/dashboard/commercial/reports',  color: '#a78bfa' },
        ].map((item) => (
          <button
            key={item.title}
            onClick={() => navigate(item.to)}
            className="flex items-center gap-4 rounded-2xl px-4 py-4 transition-all hover:brightness-110 active:scale-[0.98] text-left w-full"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', cursor: 'pointer' }}
          >
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 text-xl" style={{ background: 'rgba(255,255,255,0.06)' }}>
              {item.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p style={{ fontSize: 13, fontWeight: 700, color: item.color }}>{item.title}</p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{item.sub}</p>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        ))}
      </div>

      {/* Invoice summary */}
      {invoices.length > 0 && (
        <div className="px-5 mt-5">
          <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 10 }}>Open Invoices</p>
          <div className="flex flex-col gap-2">
            {invoices.filter(i => i.status !== 'paid').map((inv) => (
              <div key={inv.id} className="flex items-center justify-between rounded-2xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${inv.status === 'overdue' ? 'rgba(248,113,113,0.3)' : 'rgba(255,255,255,0.08)'}` }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>${inv.amount.toFixed(2)}</p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>Due {inv.due_date}</p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold" style={{ background: inv.status === 'overdue' ? 'rgba(248,113,113,0.15)' : 'rgba(251,191,36,0.15)', color: inv.status === 'overdue' ? '#f87171' : '#fbbf24' }}>
                  {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  // ── ACCOUNT TAB ───────────────────────────────────────────────────────────

  const AccountTab = () => (
    <div style={{ animation: 'fadeSlideUp 0.3s ease both' }}>
      <div className="px-5 pt-6 pb-5 flex items-center gap-4">
        <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'linear-gradient(135deg,#0057e7,#00c8ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 22, color: '#fff', boxShadow: '0 0 28px rgba(0,190,255,0.4)' }}>
          🏢
        </div>
        <div className="flex-1 min-w-0">
          <p style={{ fontSize: 17, fontWeight: 700, color: '#fff' }}>{businessName}</p>
          <p style={{ fontSize: 11, color: ACCENT, marginTop: 2 }}>Commercial Account</p>
        </div>
      </div>

      <div className="px-5 flex flex-col gap-3">
        {[
          { icon: '🏢', label: 'Business Profile',    sub: 'Address, contacts, account details',   to: '/dashboard/commercial/profile'   },
          { icon: '📅', label: 'Service Schedule',    sub: 'Manage recurring pickup windows',       to: '/dashboard/commercial/schedule'  },
          { icon: '💳', label: 'Invoices & Billing',  sub: 'View statements and pay invoices',      to: '/dashboard/commercial/invoices'  },
          { icon: '📦', label: 'Pickup History',      sub: 'All past service records',              to: '/dashboard/commercial/history'   },
          { icon: '📊', label: 'Sustainability Data', sub: 'Environmental impact reports',          to: '/dashboard/commercial/reports'   },
          { icon: '📞', label: 'Contact Dispatch',    sub: 'Reach the operations team',             to: '/dashboard/commercial/profile'   },
        ].map((item) => (
          <button
            key={item.label}
            onClick={() => navigate(item.to)}
            className="flex items-center gap-4 rounded-2xl px-4 py-3.5 transition-all hover:brightness-110 active:scale-[0.98] text-left w-full"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', cursor: 'pointer' }}
          >
            <span style={{ fontSize: 20, width: 28, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
            <div className="flex-1 min-w-0">
              <p style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{item.label}</p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', marginTop: 1 }}>{item.sub}</p>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        ))}

        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full rounded-2xl py-3.5 mt-2 text-sm font-semibold transition-all hover:brightness-110 disabled:opacity-50"
          style={{ background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171', cursor: 'pointer' }}
        >
          {signingOut ? 'Signing out…' : 'Sign Out'}
        </button>
      </div>
    </div>
  )

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden" style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}>
      <style>{`
        @keyframes fadeSlideUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spinCD { to { transform:rotate(360deg); } }
      `}</style>

      <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(0,200,255,0.04) 1px, transparent 0)', backgroundSize: '32px 32px' }} />
      <div className="pointer-events-none absolute" style={{ top: -80, left: -60, width: 320, height: 320, background: 'rgba(0,87,231,0.22)', filter: 'blur(72px)', borderRadius: '50%' }} />
      <div className="pointer-events-none absolute" style={{ bottom: -60, right: -40, width: 260, height: 260, background: 'rgba(0,200,100,0.1)', filter: 'blur(64px)', borderRadius: '50%' }} />

      {/* Header */}
      <header className="relative flex items-center justify-between px-4 py-3 shrink-0" style={{ background: 'rgba(4,10,24,0.94)', borderBottom: '1px solid rgba(0,200,255,0.12)', backdropFilter: 'blur(12px)', zIndex: 2 }}>
        <div className="flex items-center gap-2.5">
          <span style={{ fontSize: 18, fontWeight: 900, color: ACCENT, letterSpacing: '-0.02em' }}>Cyan&#39;s Brooklynn</span>
          <span style={{ color: 'rgba(0,200,255,0.25)' }}>|</span>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#4ade80', boxShadow: '0 0 5px rgba(74,222,128,0.8)' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.45)' }}>Commercial</span>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider" style={{ background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.25)', color: ACCENT }}>
          Enterprise
        </span>
      </header>

      {/* Scrollable body */}
      <main className="relative flex-1 overflow-y-auto pb-24" style={{ zIndex: 1 }}>
        {tab === 'home'    && <HomeTab />}
        {tab === 'pickups' && <PickupsTab />}
        {tab === 'bins'    && <BinsTab />}
        {tab === 'reports' && <ReportsTab />}
        {tab === 'account' && <AccountTab />}
      </main>

      <BottomNav tab={tab} onTab={setTab} />
    </div>
  )
}
