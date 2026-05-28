import { useState, useMemo, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { QrScanner } from '../../components/QrScanner'
import { logout } from '../../lib/auth'
import { useAuthStore } from '../../store/authStore'
import { claimBag } from '../../lib/bags'
import {
  getConsumerBags,
  getBroadcastsForRole,
} from '../../lib/points'
import { useBroadcastAlerts } from '../../hooks/useBroadcastAlerts'
import { Skeleton } from '../../components/ui/Skeleton'
import { EmptyState } from '../../components/ui/EmptyState'
import { useToast } from '../../components/ui/Toast'
import { SectionLabel } from '../../components/ui/dashboard'

async function fetchWalletBalance(userId: string) {
  const [txRes, prRes] = await Promise.all([
    supabase.from('wallet_transactions').select('type, amount').eq('user_id', userId).eq('status', 'completed'),
    supabase.from('payout_requests').select('amount, status').eq('user_id', userId).in('status', ['pending','approved','paid']),
  ])
  const txns    = txRes.data ?? []
  const earned  = txns.filter(t => ['earning','bonus','referral'].includes(t.type)).reduce((s,t) => s + Number(t.amount), 0)
  const committed = (prRes.data ?? []).reduce((s,p) => s + Number(p.amount), 0)
  return { balance: Math.max(0, earned - committed), totalEarned: earned }
}

async function fetchWeeklyEarnings(userId: string) {
  const rows: { label: string; amount: number | null }[] = [{ label: 'Current Week', amount: null }]
  for (let w = 1; w <= 8; w++) {
    const end   = new Date(); end.setDate(end.getDate() - (w - 1) * 7); end.setHours(23,59,59,999)
    const start = new Date(end); start.setDate(start.getDate() - 6); start.setHours(0,0,0,0)
    const { data } = await supabase
      .from('wallet_transactions')
      .select('amount')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .in('type', ['earning','bonus','referral'])
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
    const total = (data ?? []).reduce((s,t) => s + Number(t.amount), 0)
    const label = `${start.toLocaleDateString('en-US',{month:'short',day:'numeric'})}–${end.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}`
    rows.push({ label, amount: total })
  }
  return rows
}

async function fetchWeeklyLbs(userId: string) {
  const rows: { label: string; lbs: number | null }[] = [{ label: 'Current Week', lbs: null }]
  for (let w = 1; w <= 8; w++) {
    const end   = new Date(); end.setDate(end.getDate() - (w - 1) * 7); end.setHours(23,59,59,999)
    const start = new Date(end); start.setDate(start.getDate() - 6); start.setHours(0,0,0,0)
    const { data } = await supabase
      .from('qr_bags')
      .select('co2_saved_lbs')
      .eq('owner_id', userId)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
    const total = Math.round((data ?? []).reduce((s,b) => s + (Number(b.co2_saved_lbs) || 0), 0))
    const label = `${start.toLocaleDateString('en-US',{month:'short',day:'numeric'})}–${end.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}`
    rows.push({ label, amount: total } as unknown as { label: string; lbs: number | null })
  }
  return rows as { label: string; lbs: number | null }[]
}

async function fetchTopFundraiser() {
  const { data } = await supabase
    .from('fundraisers')
    .select('id, name, goal_amount, raised_amount, bag_count')
    .eq('status', 'active')
    .order('raised_amount', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = 'home' | 'bags' | 'deeds' | 'account'

interface BadgeDef {
  id: string
  icon: string
  label: string
  desc: string
  threshold: number
}

interface Particle {
  id: number
  x: number
  delay: number
  duration: number
  color: string
  size: number
}

// ── Constants ─────────────────────────────────────────────────────────────────

const FOR_YOU_CATEGORIES: { icon: string; label: string }[] = [
  { icon: '🛒', label: 'Food & Shop' },
  { icon: '🔧', label: 'Tools'       },
  { icon: '🌱', label: 'Eco Tips'    },
  { icon: '💼', label: 'Jobs'        },
  { icon: '🏘️', label: 'Community'  },
  { icon: '📦', label: 'Supplies'    },
]

// (BAG_STATUS_BADGE removed — the Bags tab now uses SCAN_STATUS_STYLE since
// it renders consumer_bag_scans rows, not qr_bags rows. SCAN_STATUS_STYLE
// covers the same status vocabulary.)

function normalizeBagCode(rawCode: string): string {
  let code = rawCode.trim().toUpperCase()
  if (code.startsWith('QR')) code = code.slice(2)
  const digits = code.replace(/[^0-9]/g, '')
  if (digits.length === 12) return `${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8, 12)}`
  return rawCode.trim().toUpperCase()
}

const CONFETTI_COLORS = ['#00c8ff', '#00E676', '#FFD600', '#FF6D00', '#E040FB', '#FF4081']
const CELEBRATE_MSGS  = ['Way to go', 'You rock', 'Keep it up', 'Amazing work', "You're crushing it"]


// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name.split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2)
}

// ── Sub-component: DashboardAvatar (premium welcome-header avatar) ───────────
// src can be: an http(s) URL (rendered as <img>), a non-empty string (emoji),
// or null/empty (default ♻️). Includes a glow ring and click-to-profile.

// ── Recent scans panel ───────────────────────────────────────────────────────
// Reads from consumer_bag_scans (see migration 20260527). The list updates
// instantly via realtime subscription and via optimistic prepend after a
// successful scan insert in handleConsumerScan.

interface RecentScan {
  id:          string
  qr_code:     string
  bag_id:      string | null
  scan_status: string
  scanned_at:  string
}

// Status colour map. 'active' is the default for newly-scanned bags;
// 'completed' / 'archived' are end-states surfaced under History.
// Legacy values (scanned, pending_pickup, etc.) kept for back-compat with
// any data the operational pipeline might write.
const SCAN_STATUS_STYLE: Record<string, { bg: string; border: string; color: string; label: string }> = {
  active:         { bg: 'rgba(0,200,255,0.10)',  border: 'rgba(0,200,255,0.35)',  color: '#00c8ff', label: 'Active' },
  completed:      { bg: 'rgba(74,222,128,0.12)', border: 'rgba(74,222,128,0.35)', color: '#4ade80', label: 'Completed' },
  archived:       { bg: 'rgba(255,255,255,0.05)',border: 'rgba(255,255,255,0.15)',color: 'rgba(255,255,255,0.5)', label: 'Archived' },
  // legacy / operational pipeline values
  scanned:        { bg: 'rgba(0,200,255,0.10)',  border: 'rgba(0,200,255,0.35)',  color: '#00c8ff', label: 'Scanned' },
  pending_pickup: { bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.35)', color: '#fbbf24', label: 'Pending pickup' },
  picked_up:      { bg: 'rgba(94,234,212,0.12)', border: 'rgba(94,234,212,0.35)', color: '#5eead4', label: 'Picked up' },
  at_warehouse:   { bg: 'rgba(167,139,250,0.12)',border: 'rgba(167,139,250,0.35)',color: '#a78bfa', label: 'At warehouse' },
  processed:      { bg: 'rgba(74,222,128,0.12)', border: 'rgba(74,222,128,0.35)', color: '#4ade80', label: 'Processed' },
  paid_out:       { bg: 'rgba(74,222,128,0.16)', border: 'rgba(74,222,128,0.45)', color: '#4ade80', label: 'Paid out' },
  error:          { bg: 'rgba(248,113,113,0.12)',border: 'rgba(248,113,113,0.35)',color: '#f87171', label: 'Error' },
}

// Status groupings the panel sub-tabs filter by.
// History includes terminal statuses + any status the operational pipeline
// flips bags to once they leave the consumer's hands (picked_up onwards).
const HISTORY_STATUSES = new Set([
  'completed', 'archived', 'picked_up',
  'at_warehouse', 'processed', 'paid_out',
])

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const s  = Math.max(0, Math.floor(ms / 1000))
  if (s < 60)        return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60)        return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24)        return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7)         return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}

function RecentScansPanel({
  scans, loading, error,
}: {
  scans: RecentScan[]; loading: boolean; error: string | null
}) {
  const [tab, setTab] = useState<'active' | 'history'>('active')

  const active  = scans.filter(s => !HISTORY_STATUSES.has(s.scan_status))
  const history = scans.filter(s =>  HISTORY_STATUSES.has(s.scan_status))
  const list    = tab === 'active' ? active : history

  console.log('[scan] activeBags updated count', active.length)
  console.log('[scan] historyBags updated count', history.length)
  console.log('[scan] display rendered', {
    tab, activeCount: active.length, historyCount: history.length, loading, error,
  })

  return (
    <div className="px-5 mt-6">
      <div className="flex items-center justify-between mb-3">
        <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Recent scans
        </p>
        <div style={{ display: 'flex', gap: 4 }}>
          <SubTab label={`Active${active.length ? ` (${active.length})` : ''}`}
                  active={tab === 'active'} onClick={() => setTab('active')} />
          <SubTab label={`History${history.length ? ` (${history.length})` : ''}`}
                  active={tab === 'history'} onClick={() => setTab('history')} />
        </div>
      </div>

      <div style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(0,190,255,0.15)',
        borderRadius: 14,
        overflow: 'hidden',
      }}>
        {loading && (
          <div style={{ padding: '20px 16px', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
            Loading scans…
          </div>
        )}

        {!loading && error && (
          <div style={{ padding: '14px 16px', color: '#f87171', fontSize: 12, lineHeight: 1.5 }}>
            Couldn&apos;t load recent scans: {error}
          </div>
        )}

        {!loading && !error && list.length === 0 && (
          <div style={{ padding: '24px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{tab === 'active' ? '♻️' : '📭'}</div>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>
              {tab === 'active' ? 'No active bags' : 'No history yet'}
            </p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
              {tab === 'active' ? 'Scan a QR bag to get started.' : 'Completed pickups will appear here.'}
            </p>
          </div>
        )}

        {!loading && !error && list.map((s, i) => {
          const style = SCAN_STATUS_STYLE[s.scan_status] ?? SCAN_STATUS_STYLE.active
          return (
            <div
              key={s.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px',
                borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.05)',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontSize: 13, color: '#fff', fontWeight: 600,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {s.qr_code}
                </p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                  {s.bag_id ? `Bag #${String(s.bag_id).slice(0, 8)} · ` : ''}{relativeTime(s.scanned_at)}
                </p>
              </div>
              <span style={{
                background: style.bg, border: `1px solid ${style.border}`, color: style.color,
                fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 999,
                whiteSpace: 'nowrap',
              }}>
                {style.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SubTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '4px 10px', borderRadius: 999, fontSize: 10, fontWeight: 700,
        letterSpacing: '0.05em', cursor: 'pointer',
        background: active ? 'rgba(0,200,255,0.14)' : 'transparent',
        border: active ? '1px solid rgba(0,200,255,0.35)' : '1px solid rgba(255,255,255,0.06)',
        color: active ? '#00c8ff' : 'rgba(255,255,255,0.5)',
      }}
    >
      {label}
    </button>
  )
}

function DashboardAvatar({ src, onClick }: { src: string | null; onClick: () => void }) {
  const isImg = !!src && /^https?:\/\//i.test(src)
  // Debug log so future devs can trace which branch rendered.
  console.log('[dashboard] avatar render source:', isImg ? 'upload' : src ? 'emoji' : 'default')
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open profile"
      style={{
        position: 'relative', padding: 0, background: 'none', border: 'none',
        cursor: 'pointer', display: 'inline-flex',
      }}
    >
      <span style={{
        position: 'absolute', inset: -8,
        background: 'radial-gradient(circle, rgba(0,200,255,0.45), transparent 70%)',
        filter: 'blur(12px)',
      }} />
      <span style={{
        position: 'relative',
        width: 56, height: 56, borderRadius: '50%',
        background: 'rgba(0,200,255,0.08)',
        border: '2px solid rgba(0,200,255,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 26, overflow: 'hidden',
        boxShadow: '0 6px 20px rgba(0,87,231,0.3)',
      }}>
        {isImg
          ? <img src={src!} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : (src || '♻️')}
      </span>
    </button>
  )
}

// ── Sub-component: BottomNav ──────────────────────────────────────────────────

function BottomNav({
  tab,
  onTab,
  msgCount,
}: {
  tab: Tab
  onTab: (t: Tab) => void
  msgCount: number
}) {
  const items: { id: Tab; label: string; icon: (active: boolean) => React.ReactNode }[] = [
    {
      id: 'home', label: 'Home',
      icon: (a) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill={a ? '#00c8ff' : 'none'} stroke={a ? '#00c8ff' : 'rgba(255,255,255,0.35)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      ),
    },
    {
      id: 'bags', label: 'Bags',
      icon: (a) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill={a ? '#00c8ff' : 'none'} stroke={a ? '#00c8ff' : 'rgba(255,255,255,0.35)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
      ),
    },
    {
      id: 'deeds', label: 'Deeds',
      icon: (a) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill={a ? '#00c8ff' : 'none'} stroke={a ? '#00c8ff' : 'rgba(255,255,255,0.35)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="6" />
          <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" />
        </svg>
      ),
    },
    {
      id: 'account', label: 'Account',
      icon: (a) => (
        <div className="relative">
          <svg width="22" height="22" viewBox="0 0 24 24" fill={a ? '#00c8ff' : 'none'} stroke={a ? '#00c8ff' : 'rgba(255,255,255,0.35)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          {msgCount > 0 && (
            <span
              className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold"
              style={{ background: '#FF1744', color: '#fff' }}
            >
              {msgCount > 9 ? '9+' : msgCount}
            </span>
          )}
        </div>
      ),
    },
  ]

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 flex items-end justify-around px-2"
      style={{
        background: 'rgba(6,14,36,0.95)',
        borderTop: '1px solid rgba(0,190,255,0.15)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
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
          >
            <span
              className="relative z-10"
              style={{ filter: active ? 'drop-shadow(0 0 6px rgba(0,200,255,0.7))' : 'none' }}
            >
              {item.icon(active)}
            </span>
            <span className="relative z-10 text-[10px] font-semibold" style={{ color: active ? '#00c8ff' : 'rgba(255,255,255,0.35)' }}>
              {item.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ConsumerDashboard() {
  const { user, profile } = useAuthStore()
  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()
  const ACCENT = '#00c8ff'
  const firstName = profile?.full_name?.split(' ')[0] ?? 'Friend'
  const initials  = profile?.full_name ? getInitials(profile.full_name) : '??'

  const [tab, setTab]               = useState<Tab>('home')
  const [celebBadge, setCelebBadge] = useState<(BadgeDef & { unlocked: boolean }) | null>(null)
  const [msgIdx, setMsgIdx]         = useState(0)
  const [signingOut, setSigningOut] = useState(false)
  const [newMsgBanner, setNewMsgBanner] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState('Eco Tips')
  const [bagTab, setBagTab]           = useState<'active' | 'history'>('active')
  const [earningsWeekIdx, setEarningsWeekIdx] = useState(0)
  const [recycledWeekIdx, setRecycledWeekIdx]  = useState(0)

  // Scan state
  const [showCameraOverlay, setShowCameraOverlay] = useState(false)
  const [showQrModal, setShowQrModal]             = useState(false)
  const [qrModalCode, setQrModalCode]             = useState('')
  const [scanSaving, setScanSaving]               = useState(false)
  const [scanError, setScanError]                 = useState<string | null>(null)

  // Recent scans (consumer_bag_scans, owner-scoped, realtime-fed).
  // Interface declared at module scope (above this file's default export) so
  // the RecentScansPanel sub-component can share the type.
  const [recentScans, setRecentScans]             = useState<RecentScan[]>([])
  const [recentScansLoading, setRecentScansLoading] = useState(true)
  const [recentScansError, setRecentScansError]   = useState<string | null>(null)

  // (Payout flow handled by /cashout page — no inline modal state needed)


  // ── Data queries ───────────────────────────────────────────────────────────
  const { data: myBags = [] } = useQuery({
    queryKey: ['consumer-bags', user?.id],
    queryFn: () => getConsumerBags(user!.id),
    enabled: !!user,
    staleTime: 30_000,
  })

  const { data: broadcasts = [] } = useQuery({
    queryKey: ['consumer-broadcasts'],
    queryFn: () => getBroadcastsForRole('consumer'),
    refetchInterval: 60_000,
  })

  const { data: walletData } = useQuery({
    queryKey: ['consumer-wallet', user?.id],
    queryFn: () => fetchWalletBalance(user!.id),
    enabled: !!user,
    staleTime: 30_000,
  })

  const { data: WEEKLY_EARNINGS = [{ label: 'Current Week', amount: null }] } = useQuery({
    queryKey: ['consumer-weekly-earnings', user?.id],
    queryFn: () => fetchWeeklyEarnings(user!.id),
    enabled: !!user,
    staleTime: 60_000,
  })

  const { data: WEEKLY_RECYCLED = [{ label: 'Current Week', lbs: null }] } = useQuery({
    queryKey: ['consumer-weekly-lbs', user?.id],
    queryFn: () => fetchWeeklyLbs(user!.id),
    enabled: !!user,
    staleTime: 60_000,
  })

  const { data: topFundraiser } = useQuery({
    queryKey: ['top-fundraiser'],
    queryFn: fetchTopFundraiser,
    staleTime: 120_000,
  })

  // ── Realtime broadcast listener ────────────────────────────────────────────
  useBroadcastAlerts(
    profile?.role ?? null,
    useCallback((msg: string) => {
      setNewMsgBanner(msg)
      toast.info('New message from admin')
    }, [toast]),
  )

  // ── Derived stats ──────────────────────────────────────────────────────────
  // Renamed from `activeBags` → `activeBagCount` to free up the name for the
  // list (see below). This one is the badge number on the Recycling tab pill.
  const activeBagCount = myBags.filter((b) => !['inspected','completed','recycled'].includes(b.status)).length
  const lbsDiverted    = Math.round(myBags.reduce((s, b) => s + (Number((b as unknown as { co2_saved_lbs?: number }).co2_saved_lbs) || 0), 0))
  const co2Saved       = lbsDiverted
  const balance        = walletData?.balance ?? 0
  const earnings       = (walletData?.totalEarned ?? 0).toFixed(2)
  const unreadMsgCount = broadcasts.length
  const realProgress   = Math.min(100, lbsDiverted > 0 ? Math.round((lbsDiverted / 17) * 100) : 0)

  // Bags tab now derives directly from `recentScans` (consumer_bag_scans) so
  // a fresh scan shows up here immediately via the same setRecentScans path
  // that updates the Home-tab panel. The old `myBags` (qr_bags) source meant
  // the Bags tab showed "No active bags" even when the scan succeeded,
  // because qr_bags ownership wasn't always being set in lock-step.
  const activeBags  = recentScans.filter(s => !HISTORY_STATUSES.has(s.scan_status))
  const historyBags = recentScans.filter(s =>  HISTORY_STATUSES.has(s.scan_status))
  const filteredBags = bagTab === 'history' ? historyBags : activeBags
  console.log('[render] activeBags length', activeBags.length)
  console.log('[render] historyBags length', historyBags.length)

  const newsItems = broadcasts.length > 0
    ? broadcasts.slice(0, 2).map((b) => ({ title: 'Admin Update', desc: b.message }))
    : [
        { title: 'Recycling Milestone!', desc: 'Your community has recycled 10,000 lbs this month' },
        { title: 'New Reward Program',   desc: 'Earn 2x points on your next 5 bags' },
      ]


  // ── Confetti ───────────────────────────────────────────────────────────────
  const particles = useMemo<Particle[]>(() => {
    if (!celebBadge) return []
    return Array.from({ length: 32 }, (_, i) => ({
      id: i,
      x: (i * 37 + 13) % 100,
      delay: (i * 0.11) % 1.8,
      duration: 2.2 + (i % 5) * 0.3,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      size: 6 + (i % 4) * 2,
    }))
  }, [celebBadge])

  useEffect(() => {
    if (!celebBadge) return
    const id = setInterval(() => setMsgIdx((i) => (i + 1) % CELEBRATE_MSGS.length), 1800)
    return () => clearInterval(id)
  }, [celebBadge])

  // ── Recent scans: initial fetch + realtime subscription ────────────────────
  // Owner-scoped (RLS enforces auth.uid() = user_id). Realtime feed picks up
  // any insert from this device or another (e.g. /live-scan page) instantly.

  const fetchRecentScans = useCallback(async () => {
    if (!user) return
    setRecentScansError(null)
    // Log the Supabase URL the app is actually talking to. If the schema
    // cache 404 persists after running the SQL, this proves whether the
    // frontend is pointing at the SAME project where the table was created.
    console.log('[scan] table query started', {
      table:        'consumer_bag_scans',
      userId:       user.id,
      supabaseUrl:  import.meta.env.VITE_SUPABASE_URL,
    })
    const { data, error } = await supabase
      .from('consumer_bag_scans')
      .select('id, qr_code, bag_id, scan_status, scanned_at')
      .eq('user_id', user.id)
      .order('scanned_at', { ascending: false })
      .limit(50)
    if (error) {
      console.error('[scan] recent scans fetch failed:', error)
      // Special-case the most likely "you forgot to run the SQL" failure
      if (/schema cache|relation .* does not exist/i.test(error.message)) {
        setRecentScansError(
          'The consumer_bag_scans table is missing. Run ' +
          'supabase/migrations/20260527_consumer_bag_scans.sql in your ' +
          'Supabase SQL Editor (Dashboard → SQL Editor → New query → paste → Run).',
        )
      } else {
        setRecentScansError(error.message)
      }
      return
    }
    console.log('[scan] fetch scans count', data?.length ?? 0)
    setRecentScans((data ?? []) as RecentScan[])
  }, [user])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    setRecentScansLoading(true)
    fetchRecentScans().finally(() => {
      if (!cancelled) setRecentScansLoading(false)
    })
    return () => { cancelled = true }
  }, [user, fetchRecentScans])

  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel(`consumer-scans-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'consumer_bag_scans',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as RecentScan
          console.log('[scan] realtime insert received', row)
          setRecentScans(prev => {
            if (prev.some(s => s.id === row.id)) return prev   // de-dupe vs optimistic
            return [row, ...prev].slice(0, 20)
          })
        },
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user])


  // ── Bag scan logic ────────────────────────────────────────────────────────
  async function handleConsumerScan(rawCode: string) {
    console.log('[scan] QR code scanned', { rawCode })
    const code = normalizeBagCode(rawCode)
    if (!user || !code) { setScanError('Invalid bag code.'); return }
    console.log('[scan] user id found', { userId: user.id, normalized: code })
    setScanSaving(true)
    setScanError(null)
    try {
      // owner_id is the correct column (not consumer_id)
      const { data: bag, error: lookupErr } = await supabase
        .from('qr_bags')
        .select('id, owner_id')
        .eq('bag_code', code)
        .maybeSingle()
      if (lookupErr) { setScanError(`Lookup failed: ${lookupErr.message}`); return }
      if (!bag) { setScanError('Bag not found. Check the code and try again.'); return }
      if (bag.owner_id && bag.owner_id !== user.id) {
        setScanError('This bag is already registered to another account.'); return
      }
      if (!bag.owner_id) {
        // Claim bag and stamp pickup location so drivers see the city immediately
        await claimBag(bag.id, user.id, { city: profile?.city ?? null })
      }

      // ── Log the scan into consumer_bag_scans ──────────────────────────────
      // The previous code wrote to `bag_scans` without `scan_type` (NOT NULL),
      // which failed silently. consumer_bag_scans is the per-user log that
      // powers the Recent Scans panel + realtime feed.
      console.log('[scan] inserting into consumer_bag_scans', { qr_code: code, bag_id: bag.id })
      const { data: inserted, error: scanErr } = await supabase
        .from('consumer_bag_scans')
        .insert({
          user_id:     user.id,
          qr_code:     code,
          bag_id:      bag.id,
          scan_status: 'active',
        })
        .select('id, qr_code, bag_id, scan_status, scanned_at')
        .single()

      if (scanErr) {
        console.error('[scan] consumer_bag_scans insert failed (full):', scanErr)
        if (/schema cache|relation .* does not exist/i.test(scanErr.message ?? '')) {
          setScanError(
            'Scan saved locally but Supabase says the consumer_bag_scans ' +
            'table is missing. Run supabase/migrations/20260527_consumer_bag_scans.sql ' +
            'in the Supabase SQL Editor, then retry.',
          )
        } else {
          setScanError(`Scan saved partially: ${scanErr.message}`)
        }
      } else {
        console.log('[scan] insert row returned', inserted)
        if (inserted) {
          // Optimistic UI: prepend immediately so the user sees it before the
          // realtime broadcast catches up.
          setRecentScans(prev => {
            const next = [inserted as RecentScan, ...prev.filter(s => s.id !== inserted.id)].slice(0, 50)
            const active  = next.filter(s => !HISTORY_STATUSES.has(s.scan_status)).length
            const history = next.length - active
            console.log('[scan] activeBags updated count', active)
            console.log('[scan] historyBags updated count', history)
            return next
          })
          // Belt-and-suspenders refetch — pulls the canonical server state
          // in case anything changed in the moment after our insert.
          fetchRecentScans()
        }
      }

      setShowCameraOverlay(false)
      setShowQrModal(false)
      setQrModalCode('')
      setScanError(null)
      queryClient.invalidateQueries({ queryKey: ['consumer-bags', user.id] })
      toast.success('Bag registered! Pickup requested.')
      setTab('bags')
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Scan failed. Try again.')
    } finally {
      setScanSaving(false)
    }
  }

  const handleQrModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = qrModalCode.trim()
    if (!trimmed) return
    await handleConsumerScan(trimmed)
  }

  const handleSignOut = async () => {
    setSigningOut(true)
    await logout()
  }

  return (
    <div className="relative flex flex-col min-h-screen" style={{ background: '#060e24' }}>

      {/* Background orbs */}
      <div className="pointer-events-none absolute inset-0 grid-bg" style={{ zIndex: 0 }} />
      <div className="pointer-events-none absolute" style={{ top: -60, left: -40, width: 220, height: 220, background: 'rgba(0,100,255,0.4)', filter: 'blur(52px)', borderRadius: '50%', zIndex: 0 }} />
      <div className="pointer-events-none absolute" style={{ bottom: 20, right: -30, width: 180, height: 180, background: 'rgba(0,190,255,0.3)', filter: 'blur(52px)', borderRadius: '50%', zIndex: 0 }} />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header
        className="relative flex items-center justify-between px-5"
        style={{
          paddingTop: 'max(env(safe-area-inset-top, 0px), 16px)',
          paddingBottom: '12px',
          borderBottom: '1px solid rgba(0,190,255,0.15)',
          background: 'rgba(6,14,36,0.9)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          zIndex: 10,
        }}
      >
        {/* Left: logo + wordmark */}
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="Cyan's Brooklynn" style={{ width: 54, height: 54, objectFit: 'contain', filter: 'drop-shadow(0 0 10px rgba(0,200,255,0.7)) drop-shadow(0 0 20px rgba(0,100,255,0.4))' }} />
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#ffffff', lineHeight: 1.1 }}>Cyan's Brooklynn</p>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', lineHeight: 1.2, letterSpacing: '0.04em' }}>Recycling Enterprise</p>
          </div>
        </div>

        {/* Right: logout on account tab, else bell + avatar */}
        {tab === 'account' ? (
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="rounded-full px-4 py-1.5 text-xs font-semibold disabled:opacity-50 transition-opacity hover:opacity-80 active:scale-[0.96]"
            style={{
              background: 'rgba(0,190,255,0.08)',
              border: '1px solid rgba(0,190,255,0.2)',
              color: 'rgba(0,210,255,0.7)',
            }}
          >
            {signingOut ? 'Signing out…' : 'Logout'}
          </button>
        ) : (
          <div className="flex items-center gap-2.5">
            <button
              className="flex items-center justify-center transition-opacity hover:opacity-80 active:scale-90"
              style={{ padding: '6px' }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </button>
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-extrabold"
              style={{
                background: 'linear-gradient(135deg,#0057e7,#00c8ff)',
                color: '#ffffff',
                boxShadow: '0 0 14px rgba(0,190,255,0.4)',
              }}
            >
              {initials}
            </div>
          </div>
        )}
      </header>

      {/* New message banner */}
      {newMsgBanner && (
        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{ background: 'rgba(0,200,255,0.08)', borderBottom: '1px solid rgba(0,200,255,0.2)', zIndex: 9, position: 'relative' }}
        >
          <span className="text-base">📢</span>
          <p className="flex-1 text-xs" style={{ color: '#ffffff' }}>{newMsgBanner}</p>
          <button onClick={() => setNewMsgBanner(null)} className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>✕</button>
        </div>
      )}

      {/* Scrollable body */}
      <main className="relative flex-1 overflow-y-auto pb-24" style={{ zIndex: 1 }}>

        {/* ── HOME ─────────────────────────────────────────────────────────── */}
        {tab === 'home' && (
          <div style={{ animation: 'fadeSlideUp 0.3s ease both' }}>

            {/* ── Welcome ────────────────────────────────────────────────────── */}
            {/* Avatar source order: avatar_url (URL → <img>, emoji → text), else ♻️.
                Clicking the avatar opens the account/settings area. */}
            <div className="px-5 pt-6 pb-4 flex items-center justify-between" style={{ animation: 'fadeSlideUp 0.45s ease both' }}>
              <div className="flex items-center gap-3">
                <DashboardAvatar
                  src={(profile as { avatar_url?: string | null } | null)?.avatar_url ?? null}
                  onClick={() => navigate('/settings/notifications')}
                />
                <div>
                  <p style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.01em', lineHeight: 1 }}>
                    Welcome back,
                  </p>
                  <p style={{ fontSize: 28, fontWeight: 700, color: '#ffffff', lineHeight: 1.2, marginTop: 4 }}>
                    {firstName}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p style={{ fontSize: 22, fontWeight: 700, color: '#ffffff', lineHeight: 1 }}>${earnings}</p>
                <p style={{ fontSize: 9, color: '#00c8ff', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', marginTop: 3 }}>Earnings</p>
              </div>
            </div>

            {/* ── Scan Bag ── */}
            <div className="px-5 mb-5 mt-20">
              <button
                onClick={() => setShowCameraOverlay(true)}
                className="w-full flex items-center justify-center gap-3 rounded-2xl py-6 text-lg font-bold text-white transition-all hover:brightness-110 active:scale-[0.98]"
                style={{
                  background: 'linear-gradient(135deg,#0057e7,#00c8ff)',
                  boxShadow: '0 6px 28px rgba(0,190,255,0.4)',
                  letterSpacing: '0.02em',
                }}
              >
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
                  <rect x="7" y="7" width="10" height="10" rx="1" />
                </svg>
                Scan Bag
              </button>
            </div>


            {/* ── Quick Access — horizontal icon-only scroll ──────────────────── */}
            <div className="mb-5">
              <div className="px-5">
                <SectionLabel title="Quick Access" accent={ACCENT} />
              </div>
              <div className="flex gap-7 overflow-x-auto px-5 pb-1" style={{ scrollbarWidth: 'none' }}>
                {[
                  { icon: '♻️', label: 'Recycling', badge: activeBagCount, action: () => setTab('bags')    },
                  { icon: '🎁', label: 'Rewards',   badge: 0,              action: () => setTab('deeds')   },
                  { icon: '🌍', label: 'Community', badge: unreadMsgCount, action: () => setTab('account') },
                ].map((tile) => (
                  <button
                    key={tile.label}
                    onClick={tile.action}
                    className="relative flex shrink-0 flex-col items-center gap-1.5 transition-all active:scale-[0.92] hover:brightness-110"
                  >
                    {tile.badge > 0 && (
                      <span
                        className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold"
                        style={{ background: '#FF1744', color: '#fff' }}
                      >
                        {tile.badge}
                      </span>
                    )}
                    <span style={{ fontSize: 28 }}>{tile.icon}</span>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>{tile.label}</span>
                  </button>
                ))}
              </div>
            </div>


            {/* ── Community Fundraisers ──────────────────────────────────────── */}
            <div className="px-5 mb-5">
              <div
                className="rounded-2xl overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(0,190,255,0.15)' }}
              >
                {/* Banner header */}
                <div
                  className="flex items-center justify-between px-4 py-3"
                  style={{ background: 'rgba(0,87,231,0.18)', borderBottom: '1px solid rgba(0,190,255,0.12)' }}
                >
                  <div className="flex items-center gap-2">
                    <img src="/logo.png" alt="" style={{ width: 36, height: 36, objectFit: 'contain', filter: 'drop-shadow(0 0 8px rgba(0,200,255,0.7)) drop-shadow(0 0 16px rgba(0,100,255,0.45))' }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#ffffff' }}>Community Fundraisers</span>
                  </div>
                  <button
                    onClick={() => navigate('/fundraisers')}
                    style={{ fontSize: 11, color: '#00c8ff', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    See all →
                  </button>
                </div>
                {/* Featured fundraiser row */}
                {topFundraiser && (
                  <div className="px-4 py-3 flex items-center gap-3">
                    <span className="shrink-0" style={{ fontSize: 24 }}>🌱</span>
                    <div className="flex-1 min-w-0">
                      <p style={{ fontSize: 12, fontWeight: 600, color: '#ffffff', marginBottom: 2 }}>
                        {topFundraiser.name}
                      </p>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                        <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.round((Number(topFundraiser.raised_amount) / Number(topFundraiser.goal_amount)) * 100))}%`, background: 'linear-gradient(90deg, #0057e7, #00c8ff)' }} />
                      </div>
                      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                        {Math.min(100, Math.round((Number(topFundraiser.raised_amount) / Number(topFundraiser.goal_amount)) * 100))}% funded · {topFundraiser.bag_count} supporters
                      </p>
                    </div>
                    <button
                      onClick={() => navigate(`/fundraisers/${topFundraiser.id}`)}
                      style={{ fontSize: 11, color: '#00c8ff', fontWeight: 600, background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.25)', borderRadius: 10, padding: '4px 10px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                      View
                    </button>
                  </div>
                )}
                {/* My Fundraiser Impact row */}
                <div
                  className="px-4 py-3 flex items-center justify-between"
                  style={{ borderTop: '1px solid rgba(0,190,255,0.08)' }}
                >
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: 14 }}>🏆</span>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>My Fundraiser Impact</span>
                  </div>
                  <button
                    onClick={() => navigate('/my-fundraiser')}
                    style={{ fontSize: 11, color: '#00c8ff', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    View →
                  </button>
                </div>
              </div>
            </div>

            {/* ── For You — horizontal scroll row ────────────────────────────── */}
            <div className="mb-5">
              <div className="px-5 mb-2.5">
                <SectionLabel title="For You" accent={ACCENT} />
              </div>
              <div
                className="flex gap-2.5 overflow-x-auto px-5 pb-2"
                style={{ scrollbarWidth: 'none' }}
              >
                {FOR_YOU_CATEGORIES.map((cat) => {
                  const selected = selectedCategory === cat.label
                  return (
                    <button
                      key={cat.label}
                      onClick={() => setSelectedCategory(cat.label)}
                      className="shrink-0 flex flex-col items-center gap-1.5 transition-all active:scale-[0.92]"
                      style={{ width: 64 }}
                    >
                      <span style={{ fontSize: 26, filter: selected ? 'drop-shadow(0 0 6px rgba(0,200,255,0.5))' : 'none' }}>{cat.icon}</span>
                      <span style={{ fontSize: 10, color: selected ? '#00c8ff' : 'rgba(255,255,255,0.7)', fontWeight: 600, textAlign: 'center', lineHeight: 1.2 }}>
                        {cat.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* ── News — glass card, exactly 2 items ─────────────────────────── */}
            <div className="px-5 mb-5">
              <SectionLabel title="News & Updates" accent={ACCENT} />
              <div
                className="rounded-2xl overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(0,190,255,0.15)' }}
              >
                {newsItems.map((item, i) => (
                  <div
                    key={i}
                    className="px-4 py-4"
                    style={{ borderBottom: i === 0 ? '1px solid rgba(0,190,255,0.08)' : 'none' }}
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 shrink-0" style={{ fontSize: 18 }}>📢</span>
                      <div>
                        <p style={{ fontSize: 13, color: '#ffffff', fontWeight: 700, lineHeight: 1.3 }}>{item.title}</p>
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 3, lineHeight: 1.45 }}>{item.desc}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Recent Scans (consumer_bag_scans, owner-scoped + realtime) ── */}
            <RecentScansPanel
              scans={recentScans}
              loading={recentScansLoading}
              error={recentScansError}
            />

          </div>
        )}

        {/* ── BAGS ─────────────────────────────────────────────────────────── */}
        {tab === 'bags' && (
          <div style={{ animation: 'fadeSlideUp 0.3s ease both' }}>

            {/* Page title */}
            <div className="px-5 pt-5 pb-4">
              <p style={{ fontSize: 22, color: '#ffffff', fontWeight: 500, lineHeight: 1.3 }}>Bags</p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
                Scan, track and manage your recycling bags
              </p>
            </div>

            {/* Scan actions */}
            <div className="px-5 mb-5">
              <button
                onClick={() => setShowCameraOverlay(true)}
                className="w-full flex items-center justify-center gap-3 rounded-2xl py-5 text-base font-bold text-white transition-all hover:brightness-110 active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg,#0057e7,#00c8ff)', boxShadow: '0 6px 28px rgba(0,190,255,0.45)' }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
                  <rect x="7" y="7" width="10" height="10" rx="1" />
                </svg>
                Scan Bag
              </button>
              <div className="flex justify-end mt-2">
                <button
                  onClick={() => { setScanError(null); setShowQrModal(true) }}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold transition-all hover:brightness-110"
                  style={{ background: 'transparent', border: '1px solid rgba(0,200,255,0.35)', color: '#00c8ff', letterSpacing: '0.04em' }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
                    <path d="M14 14h.01M18 14h.01M14 18h.01M18 18h.01"/>
                  </svg>
                  QR #
                </button>
              </div>
            </div>

            {/* Active bags list */}
            <div className="px-5 pb-4">
                <SectionLabel title="Active Bags" accent={ACCENT} />

                {/* Tab filter pill */}
                <div
                  className="flex mb-4 p-[3px]"
                  style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 10 }}
                >
                  {(['active', 'history'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setBagTab(t)}
                      className="flex-1 py-2 text-xs font-semibold transition-all"
                      style={{
                        borderRadius: 8,
                        ...(bagTab === t
                          ? { background: 'rgba(0,130,255,0.3)', color: '#00c8ff' }
                          : { color: 'rgba(255,255,255,0.4)' }),
                      }}
                    >
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>

                {/* Bag cards — sourced from recentScans (consumer_bag_scans) */}
                {recentScansLoading ? (
                  <div className="space-y-3">
                    {[0, 1, 2].map((i) => <Skeleton key={i} height="h-16" rounded="rounded-2xl" />)}
                  </div>
                ) : filteredBags.length === 0 ? (
                  <EmptyState
                    icon="♻️"
                    title={bagTab === 'history' ? 'No completed bags yet' : 'No active bags'}
                    description={bagTab === 'history' ? 'Completed bags will appear here.' : 'Scan a bag to get started.'}
                    action={bagTab !== 'history' ? { label: 'Scan Bag', onClick: () => setShowCameraOverlay(true) } : undefined}
                  />
                ) : (
                  <div className="space-y-2.5">
                    {filteredBags.map((scan) => {
                      const badge = SCAN_STATUS_STYLE[scan.scan_status] ?? SCAN_STATUS_STYLE.active
                      const d = new Date(scan.scanned_at)
                      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                      return (
                        <div
                          key={scan.id}
                          className="px-1 py-3 flex items-center justify-between"
                          style={{ borderBottom: '1px solid rgba(0,190,255,0.07)' }}
                        >
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <p className="font-mono font-bold" style={{
                              fontSize: 14, color: '#ffffff',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>{scan.qr_code}</p>
                            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                              {scan.bag_id ? `Bag #${String(scan.bag_id).slice(0, 8)} · ` : ''}{dateStr} · {timeStr}
                            </p>
                          </div>
                          <span
                            className="rounded-full px-2.5 py-0.5 text-xs font-semibold shrink-0"
                            style={{
                              background: badge.bg,
                              border:     `1px solid ${badge.border}`,
                              color:      badge.color,
                            }}
                          >
                            {badge.label}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
          </div>
        )}

        {/* ── DEEDS ────────────────────────────────────────────────────────── */}
        {tab === 'deeds' && (
          <div style={{ animation: 'fadeSlideUp 0.3s ease both' }}>

            <style>{`
              @keyframes progressShimmer {
                0%   { background-position: 0% center; }
                100% { background-position: 200% center; }
              }
              @keyframes logoSpin {
                from { transform: rotate(0deg); }
                to   { transform: rotate(360deg); }
              }
              @keyframes ecoFloat {
                0%, 100% { transform: translateY(0px) scale(1);   opacity: 0.75; }
                50%       { transform: translateY(-10px) scale(1.2); opacity: 1;    }
              }
              @keyframes confettiFall {
                0%   { transform: translateY(-16px) rotate(0deg);   opacity: 1; }
                100% { transform: translateY(110px) rotate(400deg); opacity: 0; }
              }
              @keyframes logoBloom {
                0%, 100% { opacity: 0.12; transform: scale(1); }
                50%       { opacity: 0.24; transform: scale(1.08); }
              }
            `}</style>

            {/* ── BALANCE ─────────────────────────────────────────────────── */}
            <div className="px-5 pt-6 pb-2 text-center">
              <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>
                Current Balance
              </p>
              <p style={{ fontSize: 56, fontWeight: 800, color: '#ffffff', lineHeight: 1, letterSpacing: '-0.02em' }}>
                ${balance.toFixed(2)}
              </p>
              <p style={{ fontSize: 12, color: 'rgba(0,210,255,0.75)', marginTop: 10, fontWeight: 500 }}>
                Payout scheduled for 5/11
              </p>
            </div>

            {/* ── PAYOUT BUTTON ───────────────────────────────────────────── */}
            <div className="px-5 mt-5 mb-6">
              <button
                onClick={() => navigate('/cashout')}
                className="w-full py-3.5 rounded-2xl font-bold text-sm text-white transition-all hover:brightness-110 active:scale-[0.97]"
                style={{
                  background: 'linear-gradient(135deg,#0057e7,#00c8ff)',
                  boxShadow: '0 4px 20px rgba(0,190,255,0.45)',
                  letterSpacing: '0.01em',
                }}
              >
                Cash out now
              </button>
            </div>

            {/* ── IMPACT + MILESTONES + STATS + BANNER ────────────────────── */}
            {(() => {
              const progressPct = realProgress
              const wLbs        = lbsDiverted
              const tier: 1 | 2 | 3 = wLbs >= 17 ? 3 : wLbs >= 10 ? 2 : 1

              const tierColor    = tier === 3 ? '#00D9FF'                   : tier === 2 ? '#3DFFD4'                   : '#5BFFB0'
              const tierGlow     = tier === 3 ? 'rgba(0,217,255,0.18)'     : tier === 2 ? 'rgba(61,255,212,0.12)'    : 'rgba(91,255,176,0.13)'
              const tierMsg      = tier === 3 ? 'Great job! You reached the goal!' : tier === 2 ? 'Making progress! Keep it up!' : 'More effort needed'
              const tierSub      = tier === 3 ? 'The planet thanks you! 🌍'        : tier === 2 ? 'Almost there, keep recycling!'  : 'Every bag makes a difference!'
              const tierProgGrad = tier === 3
                ? 'linear-gradient(90deg,#0099cc 0%,#00D9FF 50%,#4EDBFF 100%)'
                : tier === 2
                ? 'linear-gradient(90deg,#3DFFD4 0%,#39E6FF 50%,#3DFFD4 100%)'
                : 'linear-gradient(90deg,#00e890 0%,#5BFFB0 50%,#72FFCC 100%)'
              const level       = progressPct >= 100 ? 'Community Hero'
                                : progressPct >= 65  ? 'Planet Protector'
                                : progressPct >= 25  ? 'Eco Warrior'
                                                     : 'Eco Starter'
              // Ring is cyan/teal for all incomplete states; switches to eco green only at 100%
              const ringColor     = progressPct >= 100 ? '#5BFFB0' : '#00D9FF'
              const ringSecondary = progressPct >= 100 ? '#3DFFd4cc' : '#00D9FF66'
              const ringDuration  = progressPct >= 100 ? '1.5s' : tier === 3 ? '2s' : '3.5s'

              return (
                <>
                  {/* ── Logo gamified progress ──────────────────────── */}
                  <div className="px-5 mb-4">
                    <div className="rounded-3xl overflow-hidden" style={{ boxShadow: `0 8px 44px ${tierGlow}` }}>

                      {/* Level + progress header */}
                      <div className="px-5 pt-4 pb-4" style={{ background: 'rgba(3,10,26,0.98)' }}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.32)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 3 }}>
                              Your Level
                            </p>
                            <p style={{ fontSize: 17, fontWeight: 800, color: tierColor, letterSpacing: '-0.01em' }}>{level}</p>
                            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', marginTop: 2 }}>{tierSub}</p>
                          </div>
                          <div className="text-right">
                            <p style={{ fontSize: 34, fontWeight: 900, color: tierColor, lineHeight: 1, letterSpacing: '-0.03em' }}>{progressPct}%</p>
                            <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.32)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Goal Progress</p>
                          </div>
                        </div>
                      </div>

                      {/* Logo animation zone */}
                      <div style={{ position: 'relative', background: 'linear-gradient(180deg,#010812 0%,#020f1e 100%)', padding: '28px 20px 24px', textAlign: 'center', overflow: 'hidden' }}>

                        {/* Background bloom */}
                        <div style={{ position: 'absolute', top: '5%', left: '50%', transform: 'translateX(-50%)', width: 260, height: 260, background: `${tierColor}12`, filter: 'blur(60px)', borderRadius: '50%', pointerEvents: 'none', animationName: 'logoBloom', animationDuration: '4s', animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite' }} />
                        {tier === 3 && (
                          <div style={{ position: 'absolute', top: '-5%', left: '50%', transform: 'translateX(-50%)', width: 340, height: 340, background: 'rgba(0,217,255,0.07)', filter: 'blur(80px)', borderRadius: '50%', pointerEvents: 'none' }} />
                        )}

                        {/* Logo — 180×180, centered */}
                        <div style={{ position: 'relative', width: 180, height: 180, margin: '0 auto' }}>

                          {/* Grayscale base */}
                          <img
                            src="/logo.png"
                            alt=""
                            draggable={false}
                            style={{
                              position: 'absolute', top: 0, left: 0,
                              width: '100%', height: '100%',
                              objectFit: 'contain',
                              userSelect: 'none',
                              filter: 'grayscale(1) brightness(0.28)',
                            }}
                          />

                          {/* Color reveal — radial clip-path fills from center */}
                          <img
                            src="/logo.png"
                            alt=""
                            draggable={false}
                            style={{
                              position: 'absolute', top: 0, left: 0,
                              width: '100%', height: '100%',
                              objectFit: 'contain',
                              userSelect: 'none',
                              clipPath: `circle(${(Math.min(71, progressPct * 0.71)).toFixed(1)}% at 50% 50%)`,
                              transition: 'clip-path 1.8s cubic-bezier(0.34,1.56,0.64,1)',
                              filter: progressPct >= 65
                                ? `drop-shadow(0 0 22px ${tierColor}cc) drop-shadow(0 0 44px ${tierColor}44)`
                                : progressPct >= 25
                                ? `drop-shadow(0 0 14px ${tierColor}88)`
                                : `drop-shadow(0 0 6px ${tierColor}44)`,
                            }}
                          />

                          {/* Eco spin ring (tier 2+) — cyan/teal below 100%, green at 100% */}
                          {tier >= 2 && (
                            <div style={{
                              position: 'absolute', top: -12, left: -12, right: -12, bottom: -12,
                              borderRadius: '50%',
                              border: '2px solid transparent',
                              borderTopColor: ringColor,
                              borderRightColor: (tier === 3 || progressPct >= 100) ? ringSecondary : 'transparent',
                              boxShadow: progressPct >= 100
                                ? `0 0 16px rgba(91,255,176,0.6), 0 0 30px rgba(91,255,176,0.25)`
                                : 'none',
                              animationName: 'logoSpin',
                              animationDuration: ringDuration,
                              animationTimingFunction: 'linear',
                              animationIterationCount: 'infinite',
                              opacity: 0.9,
                              transition: 'border-top-color 1.2s ease, border-right-color 1.2s ease, box-shadow 1.2s ease',
                            }} />
                          )}

                          {/* Outer bloom ring — only at 100% */}
                          {progressPct >= 100 && (
                            <div style={{
                              position: 'absolute', top: -22, left: -22, right: -22, bottom: -22,
                              borderRadius: '50%',
                              border: '1px solid rgba(91,255,176,0.28)',
                              boxShadow: '0 0 14px rgba(91,255,176,0.18), inset 0 0 8px rgba(91,255,176,0.1)',
                              pointerEvents: 'none',
                              animationName: 'logoBloom',
                              animationDuration: '2.4s',
                              animationTimingFunction: 'ease-in-out',
                              animationIterationCount: 'infinite',
                            }} />
                          )}

                          {/* Eco particles (tier 2+) */}
                          {tier >= 2 && [0, 72, 144, 216, 288].map((angle, i) => {
                            const r   = 100 + (i % 2) * 7
                            const rad = (angle * Math.PI) / 180
                            const cx  = 90 + Math.cos(rad) * r
                            const cy  = 90 + Math.sin(rad) * r
                            return (
                              <div key={i} style={{
                                position: 'absolute', left: cx, top: cy,
                                width: tier === 3 ? 7 : 5, height: tier === 3 ? 7 : 5,
                                borderRadius: '50%', background: tierColor,
                                opacity: 0.78, filter: 'blur(1px)',
                                animationName: 'ecoFloat',
                                animationDuration: `${2.2 + i * 0.4}s`,
                                animationDelay: `${i * 0.46}s`,
                                animationTimingFunction: 'ease-in-out',
                                animationIterationCount: 'infinite',
                              }} />
                            )
                          })}

                          {/* Confetti at 100% */}
                          {progressPct >= 100 && (
                            <div style={{ position: 'absolute', inset: -30, pointerEvents: 'none', overflow: 'hidden' }}>
                              {Array.from({ length: 18 }).map((_, i) => (
                                <div key={i} style={{
                                  position: 'absolute', top: -16,
                                  left: `${(i * 17 + 4) % 92}%`,
                                  width: 5, height: 9, borderRadius: 2,
                                  background: ['#5BFFB0','#00D9FF','#3DFFD4','#72FFCC','#00B8FF','#5BFFB0'][i % 6],
                                  animationName: 'confettiFall',
                                  animationDuration: `${1.3 + (i % 5) * 0.18}s`,
                                  animationDelay: `${(i * 0.09) % 0.6}s`,
                                  animationTimingFunction: 'ease-in',
                                  animationIterationCount: 'infinite',
                                }} />
                              ))}
                            </div>
                          )}
                        </div>

                        {/* GOAL ACHIEVED banner */}
                        {progressPct >= 100 && (
                          <p style={{ marginTop: 16, fontSize: 15, fontWeight: 900, color: '#00D9FF', letterSpacing: '0.14em', textTransform: 'uppercase', textShadow: '0 0 22px rgba(0,217,255,0.9), 0 0 44px rgba(0,184,255,0.45)' }}>
                            GOAL ACHIEVED ✦
                          </p>
                        )}

                        {/* Progress bar */}
                        <div style={{ marginTop: progressPct >= 100 ? 12 : 22 }}>
                          <div className="flex items-center justify-between mb-2">
                            <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.36)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Logo Activation</p>
                            <p style={{ fontSize: 11, fontWeight: 800, color: tierColor }}>{progressPct}% filled</p>
                          </div>
                          <div style={{ height: 7, borderRadius: 999, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                            <div style={{
                              height: '100%', width: `${progressPct}%`,
                              background: tierProgGrad, backgroundSize: '200% auto',
                              borderRadius: 999, boxShadow: `0 0 10px ${tierColor}99`,
                              transition: 'width 1.8s cubic-bezier(0.4,0,0.2,1)',
                              animationName: 'progressShimmer', animationDuration: '2.5s',
                              animationTimingFunction: 'linear', animationIterationCount: 'infinite',
                            }} />
                          </div>
                          <p style={{ fontSize: 10, color: tierColor, fontWeight: 600, marginTop: 6 }}>{tierMsg}</p>
                        </div>

                      </div>

                      {/* 3 milestone glass cards */}
                      <div style={{ display: 'flex', gap: 7, padding: '12px 14px 14px', background: 'rgba(3,10,26,0.98)' }}>
                        {([
                          { range: '0–9 lbs',   label: 'Keep\nrecycling!',    color: '#5BFFB0', glow: 'rgba(91,255,176,0.22)',  border: 'rgba(91,255,176,0.30)',  bg: 'rgba(91,255,176,0.08)',  active: tier === 1 },
                          { range: '10–16 lbs', label: 'Eco\nenergy rising!', color: '#3DFFD4', glow: 'rgba(61,255,212,0.22)',  border: 'rgba(61,255,212,0.30)',  bg: 'rgba(61,255,212,0.07)',  active: tier === 2 },
                          { range: '17+ lbs',   label: 'Goal\nreached! ✦',    color: '#00D9FF', glow: 'rgba(0,217,255,0.28)',   border: 'rgba(0,217,255,0.34)',   bg: 'rgba(0,217,255,0.09)',   active: tier === 3 },
                        ] as const).map((ms, i) => (
                          <div
                            key={i}
                            style={{
                              flex: 1, borderRadius: 14, padding: '10px 6px 9px',
                              background: ms.active ? ms.bg : 'rgba(255,255,255,0.02)',
                              border: 'none',
                              boxShadow: ms.active ? `0 0 24px ${ms.glow}, inset 0 0 14px ${ms.glow}` : 'none',
                              textAlign: 'center' as const, transition: 'all 0.4s ease',
                            }}
                          >
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: ms.color, margin: '0 auto 6px', boxShadow: ms.active ? `0 0 10px ${ms.color}, 0 0 4px ${ms.color}` : 'none', transition: 'box-shadow 0.4s ease' }} />
                            <p style={{ fontSize: 10, fontWeight: 800, color: ms.color, marginBottom: 3, lineHeight: 1.2 }}>{ms.range}</p>
                            <p style={{ fontSize: 8.5, color: ms.active ? 'rgba(255,255,255,0.62)' : 'rgba(255,255,255,0.28)', lineHeight: 1.35, whiteSpace: 'pre-line' }}>{ms.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>


                  {/* Weekly stats */}
                  <div className="px-5 mb-4">
                    <div className="grid grid-cols-2 gap-3">
                      {/* Earnings card */}
                      <div className="rounded-2xl p-4" style={{ background: 'rgba(0,87,231,0.12)', boxShadow: '0 4px 28px rgba(0,130,255,0.14), inset 0 0 20px rgba(0,100,200,0.07)', position: 'relative', overflow: 'hidden' }}>
                        <p style={{ fontSize: 9, fontWeight: 700, color: '#00c8ff', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                          Weekly total earnings
                        </p>
                        <p style={{ fontSize: 28, fontWeight: 800, color: '#ffffff', lineHeight: 1.1, marginBottom: 6 }}>
                          {earningsWeekIdx === 0
                            ? `$${balance.toFixed(2)}`
                            : `$${(WEEKLY_EARNINGS[earningsWeekIdx]?.amount ?? 0).toFixed(2)}`}
                        </p>
                        <p style={{ fontSize: 10, color: '#22c55e', fontWeight: 600, marginBottom: 6 }}>Keep up the good work!</p>
                        <select
                          value={earningsWeekIdx}
                          onChange={e => setEarningsWeekIdx(Number(e.target.value))}
                          style={{
                            display: 'block', width: '100%',
                            background: 'rgba(0,0,0,0.38)',
                            border: '1px solid rgba(0,200,255,0.15)',
                            borderRadius: 6, outline: 'none', cursor: 'pointer',
                            color: 'rgba(255,255,255,0.52)',
                            fontSize: 8.5, fontWeight: 600, letterSpacing: '0.02em',
                            padding: '3px 5px',
                            colorScheme: 'dark',
                          }}
                        >
                          {WEEKLY_EARNINGS.map((w, i) => (
                            <option key={i} value={i} style={{ background: '#0a1628' }}>
                              {i === 0 ? 'Current Week' : w.label}
                            </option>
                          ))}
                        </select>
                        {/* Floating $ icon */}
                        <span style={{
                          position: 'absolute', top: 10, right: 14,
                          fontSize: 22, fontWeight: 900, color: '#00c8ff',
                          filter: 'drop-shadow(0 0 8px rgba(0,200,255,0.7)) drop-shadow(0 0 16px rgba(0,180,255,0.35))',
                          lineHeight: 1,
                        }}>$</span>
                      </div>
                      {/* Recycled card */}
                      <div className="rounded-2xl p-4" style={{ background: 'rgba(0,150,80,0.10)', boxShadow: '0 4px 28px rgba(61,255,212,0.10), inset 0 0 20px rgba(0,150,80,0.06)', position: 'relative', overflow: 'hidden' }}>
                        <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(34,197,94,0.85)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                          Weekly total recycled
                        </p>
                        <p style={{ fontSize: 28, fontWeight: 800, color: '#ffffff', lineHeight: 1.1, marginBottom: 6 }}>
                          {recycledWeekIdx === 0
                            ? `${lbsDiverted} lbs`
                            : `${WEEKLY_RECYCLED[recycledWeekIdx]?.lbs ?? 0} lbs`}
                        </p>
                        <p style={{ fontSize: 10, color: '#22c55e', fontWeight: 600, marginBottom: 6 }}>Keep up the good work!</p>
                        <select
                          value={recycledWeekIdx}
                          onChange={e => setRecycledWeekIdx(Number(e.target.value))}
                          style={{
                            display: 'block', width: '100%',
                            background: 'rgba(0,0,0,0.38)',
                            border: '1px solid rgba(91,255,176,0.15)',
                            borderRadius: 6, outline: 'none', cursor: 'pointer',
                            color: 'rgba(255,255,255,0.52)',
                            fontSize: 8.5, fontWeight: 600, letterSpacing: '0.02em',
                            padding: '3px 5px',
                            colorScheme: 'dark',
                          }}
                        >
                          {WEEKLY_RECYCLED.map((w, i) => (
                            <option key={i} value={i} style={{ background: '#0a1628' }}>
                              {i === 0 ? 'Current Week' : w.label}
                            </option>
                          ))}
                        </select>
                        {/* Floating recycled bottle SVG */}
                        <svg
                          width="22" height="34"
                          viewBox="0 0 22 34"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          style={{
                            position: 'absolute', top: 8, right: 14,
                            filter: 'drop-shadow(0 0 7px rgba(91,255,176,0.7)) drop-shadow(0 0 14px rgba(61,255,212,0.35))',
                          }}
                        >
                          {/* Cap */}
                          <rect x="7" y="0" width="8" height="4" rx="1.5" fill="#3DFFD4" opacity="0.9" />
                          {/* Neck */}
                          <rect x="8.5" y="4" width="5" height="3" rx="1" fill="#5BFFB0" opacity="0.85" />
                          {/* Body */}
                          <path d="M5 7 Q3 9 3 12 L3 28 Q3 31 5.5 31.5 L16.5 31.5 Q19 31 19 28 L19 12 Q19 9 17 7 Z" fill="rgba(91,255,176,0.18)" stroke="#3DFFD4" strokeWidth="1.1" strokeOpacity="0.7" />
                          {/* Recycle arrows — simplified ♻ path */}
                          <text x="11" y="23" textAnchor="middle" fontSize="10" fill="#5BFFB0" opacity="0.9" fontWeight="bold">♻</text>
                          {/* Water line shimmer */}
                          <path d="M5 22 Q11 20 17 22" stroke="#3DFFD4" strokeWidth="0.8" strokeOpacity="0.45" fill="none" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Motivation banner */}
                  <div className="px-5 mb-6">
                    <div
                      className="rounded-2xl px-4 py-4 flex items-center gap-3"
                      style={{ background: 'rgba(0,87,231,0.08)', boxShadow: '0 4px 24px rgba(0,190,255,0.08), inset 0 0 16px rgba(0,100,200,0.05)', backdropFilter: 'blur(12px)' }}
                    >
                      <span style={{ fontSize: 28, filter: 'drop-shadow(0 0 8px rgba(34,197,94,0.6))' }}>🌍</span>
                      <div className="flex-1">
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', lineHeight: 1.3 }}>Recycling more helps the planet</p>
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>Every pound counts. Thank you!</p>
                      </div>
                      <span style={{ fontSize: 18 }}>🌿</span>
                    </div>
                  </div>
                </>
              )
            })()}

          </div>
        )}

        {/* ── ACCOUNT ───────────────────────────────────────────────────────── */}
        {tab === 'account' && (
          <div style={{ animation: 'fadeSlideUp 0.3s ease both' }}>

            {/* Profile Header — borderless */}
            <div className="px-5 pt-6 pb-5 flex items-center gap-4">
              <div className="relative shrink-0">
                <div style={{ width: 62, height: 62, borderRadius: '50%', background: 'linear-gradient(135deg,#0057e7,#00c8ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 21, color: '#fff', boxShadow: '0 0 28px rgba(0,190,255,0.45)' }}>
                  {initials}
                </div>
                <div style={{ position: 'absolute', bottom: 0, right: 0, width: 18, height: 18, borderRadius: '50%', background: '#22c55e', border: '2px solid #060e24', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 12.75l6 6 9-13.5" /></svg>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p style={{ fontSize: 18, color: '#ffffff', fontWeight: 700, letterSpacing: '-0.01em' }}>{profile?.full_name ?? '—'}</p>
                <p style={{ fontSize: 11, color: '#00c8ff', marginTop: 3 }}>Verified Eco Member</p>
                <div className="flex items-center gap-3 mt-2">
                  <button style={{ fontSize: 11, color: 'rgba(0,210,255,0.75)', fontWeight: 600, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                    Edit profile
                  </button>
                  <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 10 }}>·</span>
                  <button
                    onClick={handleSignOut}
                    disabled={signingOut}
                    style={{ fontSize: 11, color: 'rgba(248,113,113,0.75)', fontWeight: 600, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                  >
                    {signingOut ? 'Signing out…' : 'Sign out'}
                  </button>
                </div>
              </div>
            </div>

            {/* MY IMPACT */}
            <div className="px-5 mb-4">
              <SectionLabel title="My Impact" accent={ACCENT} />
              {[
                { icon: '🌍', label: 'CO₂ Impact',    sub: `You saved ${co2Saved} lbs of CO₂`, glow: 'rgba(91,255,176,0.55)'  },
                { icon: '♻️', label: 'Waste Reduced', sub: `${lbsDiverted} lbs recycled`,       glow: 'rgba(0,217,255,0.55)'  },
              ].map((row) => (
                <button key={row.label} className="w-full flex items-center gap-4 py-3 transition-opacity hover:opacity-75 active:opacity-60">
                  <span style={{ fontSize: 23, width: 28, textAlign: 'center', filter: `drop-shadow(0 0 7px ${row.glow})`, flexShrink: 0 }}>{row.icon}</span>
                  <div className="flex-1 min-w-0 text-left">
                    <p style={{ fontSize: 13, color: '#ffffff', fontWeight: 600 }}>{row.label}</p>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', marginTop: 1 }}>{row.sub}</p>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                </button>
              ))}
            </div>

            {/* EARNINGS & WALLET */}
            <div className="px-5 mb-4">
              <SectionLabel title="Earnings & Wallet" accent={ACCENT} />
              {[
                { icon: '💰', label: 'Rewards',   sub: `$${earnings} earned`, badge: null,  glow: 'rgba(255,193,7,0.55)'   },
                { icon: '💳', label: 'Wallet',    sub: 'Manage payments',     badge: null,  glow: 'rgba(139,92,246,0.55)'  },
                { icon: '🎁', label: 'Referrals', sub: 'Invite friends',      badge: '+$5', glow: 'rgba(91,255,176,0.55)'  },
              ].map((row) => (
                <button key={row.label} className="w-full flex items-center gap-4 py-3 transition-opacity hover:opacity-75 active:opacity-60">
                  <span style={{ fontSize: 23, width: 28, textAlign: 'center', filter: `drop-shadow(0 0 7px ${row.glow})`, flexShrink: 0 }}>{row.icon}</span>
                  <div className="flex-1 min-w-0 text-left">
                    <p style={{ fontSize: 13, color: '#ffffff', fontWeight: 600 }}>{row.label}</p>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', marginTop: 1 }}>{row.sub}</p>
                  </div>
                  {row.badge && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#00c8ff', background: 'rgba(0,200,255,0.1)', borderRadius: 99, padding: '2px 8px', marginRight: 4 }}>
                      {row.badge}
                    </span>
                  )}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                </button>
              ))}
            </div>

            {/* ACCOUNT SETTINGS */}
            <div className="px-5 mb-8">
              <SectionLabel title="Account" accent={ACCENT} />
              {[
                { icon: '⚙️', label: 'Settings',        sub: 'Preferences & notifications', glow: 'rgba(0,217,255,0.5)'   },
                { icon: '❓', label: 'Help & Support',  sub: 'FAQ & contact us',            glow: 'rgba(255,193,7,0.5)'   },
                { icon: '🔒', label: 'Privacy & Terms', sub: 'Data & legal',                glow: 'rgba(248,113,113,0.4)' },
              ].map((row) => (
                <button key={row.label} className="w-full flex items-center gap-4 py-3 transition-opacity hover:opacity-75 active:opacity-60">
                  <span style={{ fontSize: 23, width: 28, textAlign: 'center', filter: `drop-shadow(0 0 7px ${row.glow})`, flexShrink: 0 }}>{row.icon}</span>
                  <div className="flex-1 min-w-0 text-left">
                    <p style={{ fontSize: 13, color: '#ffffff', fontWeight: 600 }}>{row.label}</p>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', marginTop: 1 }}>{row.sub}</p>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                </button>
              ))}
            </div>

          </div>
        )}
      </main>

      <BottomNav tab={tab} onTab={setTab} msgCount={unreadMsgCount} />


      {/* ── CAMERA OVERLAY (real users) ───────────────────────────────────── */}
      {showCameraOverlay && (
        <div className="fixed inset-0 flex flex-col" style={{ background: '#060e24', zIndex: 60 }}>
          <div className="pointer-events-none absolute inset-0 grid-bg" />
          <header
            className="relative flex items-center justify-between px-5 shrink-0"
            style={{ paddingTop: 'max(env(safe-area-inset-top,0px),16px)', paddingBottom: 14, background: 'rgba(4,10,24,0.95)', borderBottom: '1px solid rgba(0,200,255,0.12)', backdropFilter: 'blur(12px)', zIndex: 2 }}
          >
            <span className="text-base font-bold" style={{ color: '#ffffff' }}>Scan Bag</span>
            <button
              onClick={() => { setShowCameraOverlay(false); setScanError(null) }}
              className="text-sm transition-opacity hover:opacity-70"
              style={{ color: 'rgba(255,255,255,0.5)' }}
            >
              ✕ Cancel
            </button>
          </header>
          <div className="relative flex-1 flex flex-col px-5 pt-6 pb-8 overflow-y-auto" style={{ zIndex: 1 }}>
            {scanSaving ? (
              <div className="flex flex-col items-center justify-center flex-1 gap-3">
                <div className="h-8 w-8 rounded-full border-4 animate-spin" style={{ borderColor: 'rgba(0,200,255,0.2)', borderTopColor: '#00c8ff' }} />
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>Saving scan…</p>
              </div>
            ) : (
              <QrScanner
                onScan={(decoded) => { setShowCameraOverlay(false); handleConsumerScan(decoded) }}
                onPermissionDenied={() => {
                  setScanError('Camera permission denied. Use QR # to enter the bag code manually.')
                  setShowCameraOverlay(false)
                }}
              />
            )}
            {scanError && (
              <div className="mt-4 rounded-2xl px-4 py-3" style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)' }}>
                <p className="text-sm" style={{ color: '#f87171' }}>{scanError}</p>
              </div>
            )}
            <button
              onClick={() => { setShowCameraOverlay(false); setScanError(null); setShowQrModal(true) }}
              className="mt-4 w-full py-3 rounded-2xl text-sm font-medium transition-all hover:brightness-110"
              style={{ background: 'transparent', border: '1px solid rgba(0,200,255,0.3)', color: '#00c8ff' }}
            >
              Enter code manually (QR #)
            </button>
          </div>
        </div>
      )}

      {/* ── QR # MANUAL ENTRY MODAL ───────────────────────────────────────── */}
      {showQrModal && (
        <div
          className="fixed inset-0 flex items-end justify-center"
          style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)', zIndex: 60 }}
          onClick={(e) => { if (e.target === e.currentTarget) { setShowQrModal(false); setScanError(null); setQrModalCode('') } }}
        >
          <form
            onSubmit={handleQrModalSubmit}
            className="w-full max-w-lg rounded-t-3xl px-6 pt-6 pb-10"
            style={{ background: 'linear-gradient(180deg,#080f26 0%,#060e24 100%)', border: '1px solid rgba(0,200,255,0.18)', borderBottom: 'none' }}
          >
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: 'rgba(255,255,255,0.15)' }} />
            <h3 className="text-lg font-bold mb-5" style={{ color: '#ffffff' }}>Bag Code</h3>

            <label className="block text-xs font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.45)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Enter Bag Code
            </label>
            <input
              type="text"
              value={qrModalCode}
              onChange={(e) => setQrModalCode(e.target.value.toUpperCase())}
              placeholder="CB-NASH-000421"
              autoFocus
              className="w-full rounded-xl px-4 py-3 text-sm font-mono outline-none mb-1"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(0,200,255,0.28)', color: '#ffffff' }}
            />
            <p className="text-[10px] mb-4" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Enter the code printed on your recycling bag
            </p>

            {scanError && (
              <div className="rounded-xl px-3 py-2.5 mb-4" style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)' }}>
                <p className="text-xs" style={{ color: '#f87171' }}>{scanError}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setShowQrModal(false); setScanError(null); setQrModalCode('') }}
                className="flex-1 py-3 rounded-2xl text-sm font-semibold transition-all hover:brightness-110"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!qrModalCode.trim() || scanSaving}
                className="flex-1 py-3 rounded-2xl text-sm font-bold text-white disabled:opacity-50 transition-all hover:brightness-110"
                style={{ background: 'linear-gradient(135deg,#0057e7,#00c8ff)', boxShadow: '0 4px 18px rgba(0,190,255,0.35)' }}
              >
                {scanSaving ? 'Saving…' : 'Submit'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── CELEBRATION MODAL ─────────────────────────────────────────────── */}
      {celebBadge && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center"
          style={{ background: 'rgba(6,14,36,0.94)', backdropFilter: 'blur(12px)' }}
        >
          <div className="pointer-events-none fixed inset-0 overflow-hidden">
            {particles.map((p) => (
              <div
                key={p.id}
                className="absolute rounded-sm"
                style={{
                  left: `${p.x}%`, top: '-20px',
                  width: p.size, height: p.size,
                  backgroundColor: p.color,
                  animation: `confettiFall ${p.duration}s ${p.delay}s ease-in forwards`,
                }}
              />
            ))}
          </div>

          <div
            className="relative z-10 flex flex-col items-center gap-5 rounded-3xl px-8 py-10 mx-6 text-center"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(0,190,255,0.2)',
              backdropFilter: 'blur(20px)',
              animation: 'glowPulse 2s ease-in-out infinite',
            }}
          >
            <div
              className="flex h-20 w-20 items-center justify-center rounded-full text-4xl"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1.5px solid rgba(0,190,255,0.25)', animation: 'badgePop 0.6s ease both' }}
            >
              {celebBadge.icon}
            </div>
            <div>
              <p className="text-2xl font-extrabold" style={{ color: '#ffffff' }}>
                {CELEBRATE_MSGS[msgIdx]}, {firstName}!
              </p>
              <p className="text-base font-bold mt-1" style={{ color: '#00c8ff' }}>{celebBadge.label}</p>
              <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{celebBadge.desc}</p>
            </div>
            <button
              onClick={() => setCelebBadge(null)}
              className="mt-2 rounded-xl px-8 py-3 text-sm font-bold text-white"
              style={{ background: 'linear-gradient(135deg,#0057e7,#00c8ff)', boxShadow: '0 4px 20px rgba(0,190,255,0.3)' }}
            >
              Awesome!
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
