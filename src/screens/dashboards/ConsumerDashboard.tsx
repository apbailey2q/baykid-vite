import { useState, useMemo, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { signOut } from '../../lib/auth'
import { useAuthStore } from '../../store/authStore'
import {
  getConsumerPoints,
  getConsumerBags,
  getConsumerWeeklyActivity,
  getConsumerStreak,
  getBroadcastsForRole,
} from '../../lib/points'
import { useBroadcastAlerts } from '../../hooks/useBroadcastAlerts'
import { Skeleton } from '../../components/ui/Skeleton'
import { EmptyState } from '../../components/ui/EmptyState'
import { useToast } from '../../components/ui/Toast'
import { useDemoStore } from '../../store/demoStore'
import ScanModal from '../../components/demo/ScanModal'
import QuickActionPage, { type QuickPage } from '../../components/demo/QuickActionPage'
import PaidOutModal from '../../components/demo/PaidOutModal'

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

const FOR_YOU_CATEGORIES: { icon: string; label: string; page: QuickPage }[] = [
  { icon: '🛒', label: 'Food & Shop', page: 'food-shop' },
  { icon: '🔧', label: 'Tools',       page: 'tools'     },
  { icon: '🌱', label: 'Eco Tips',    page: 'eco-tips'  },
  { icon: '💼', label: 'Jobs',        page: 'jobs'      },
  { icon: '🏘️', label: 'Community',  page: 'community' },
  { icon: '📦', label: 'Supplies',    page: 'supplies'  },
]

const DEEDS_STEPS = [
  { key: 'pending',      label: 'Requested',     activeLabel: 'Creating request...' },
  { key: 'assigned',     label: 'Assigned',       activeLabel: 'Driver assigned...' },
  { key: 'picked_up',    label: 'Picked Up',      activeLabel: 'Driver en route...' },
  { key: 'at_warehouse', label: 'At Warehouse',   activeLabel: 'In progress...' },
  { key: 'completed',    label: 'Reward Issued',  activeLabel: 'Processing reward...' },
]

const DEEDS_STEP_IDX: Record<string, number> = {
  pending: 0, assigned: 1, picked_up: 2, at_warehouse: 3, inspected: 3, completed: 4,
}

const BAG_STATUS_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  pending:      { label: 'Pending',      bg: 'rgba(245,158,11,0.15)',  color: '#fde047' },
  assigned:     { label: 'Assigned',     bg: 'rgba(139,92,246,0.18)', color: '#a78bfa' },
  picked_up:    { label: 'Picked Up',    bg: 'rgba(0,190,255,0.15)',  color: '#00c8ff' },
  at_warehouse: { label: 'At Warehouse', bg: 'rgba(0,190,255,0.12)',  color: '#67e8f9' },
  inspected:    { label: 'Inspected',    bg: 'rgba(255,214,0,0.15)',  color: '#FFD600' },
  completed:    { label: 'Delivered',    bg: 'rgba(34,197,94,0.15)',  color: '#4ade80' },
}

const CONFETTI_COLORS = ['#00c8ff', '#00E676', '#FFD600', '#FF6D00', '#E040FB', '#FF4081']
const CELEBRATE_MSGS  = ['Way to go', 'You rock', 'Keep it up', 'Amazing work', "You're crushing it"]

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name.split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2)
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
  const { user, profile, clearAuth } = useAuthStore()
  const navigate = useNavigate()
  const toast = useToast()
  const firstName = profile?.full_name?.split(' ')[0] ?? 'Friend'
  const initials  = profile?.full_name ? getInitials(profile.full_name) : '??'

  const [tab, setTab]               = useState<Tab>('home')
  const [code, setCode]             = useState('')
  const [celebBadge, setCelebBadge] = useState<(BadgeDef & { unlocked: boolean }) | null>(null)
  const [msgIdx, setMsgIdx]         = useState(0)
  const [signingOut, setSigningOut] = useState(false)
  const [newMsgBanner, setNewMsgBanner] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState('Eco Tips')
  const [bagTab, setBagTab]           = useState<'active' | 'history' | 'all'>('active')
  const [showManual, setShowManual]   = useState(false)
  const [earningsTab, setEarningsTab] = useState<'daily' | 'weekly' | 'monthly'>('weekly')
  const [recycledTab, setRecycledTab] = useState<'daily' | 'weekly' | 'monthly'>('weekly')
  const [activePage, setActivePage]   = useState<QuickPage | null>(null)
  const [showScan, setShowScan]       = useState(false)
  const [showPaidOut, setShowPaidOut] = useState(false)
  const [scanInitialCode, setScanInitialCode] = useState<string | null>(null)

  const { bags: demoBags, stats: demoStats, processPayout } = useDemoStore()

  // ── Data queries ───────────────────────────────────────────────────────────
  useQuery({
    queryKey: ['consumer-points', user?.id],
    queryFn: () => getConsumerPoints(user!.id),
    enabled: !!user,
    staleTime: 30_000,
  })

  const { data: myBags = [], isLoading: loadingBags } = useQuery({
    queryKey: ['consumer-bags', user?.id],
    queryFn: () => getConsumerBags(user!.id),
    enabled: !!user,
    staleTime: 30_000,
  })

  const { data: weeklyData = [] } = useQuery({
    queryKey: ['consumer-weekly', user?.id],
    queryFn: () => getConsumerWeeklyActivity(user!.id),
    enabled: !!user,
  })

  useQuery({
    queryKey: ['consumer-streak', user?.id],
    queryFn: () => getConsumerStreak(user!.id),
    enabled: !!user,
  })

  const { data: broadcasts = [] } = useQuery({
    queryKey: ['consumer-broadcasts'],
    queryFn: () => getBroadcastsForRole('consumer'),
    refetchInterval: 60_000,
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
  const completedBags = myBags.filter((b) => b.status === 'completed').length
  const activeBags    = myBags.filter((b) => b.status !== 'completed').length
  const lbsDiverted   = Math.round(completedBags * 2.5)
  const co2Saved      = Math.round(completedBags * 1.2)
  const earnings      = (completedBags * 3.75).toFixed(2)
  const treesPlanted  = completedBags
  const unreadMsgCount = broadcasts.length

  const filteredBags =
    bagTab === 'active'  ? myBags.filter((b) => b.status !== 'completed') :
    bagTab === 'history' ? myBags.filter((b) => b.status === 'completed') :
    myBags

  const todayBags = weeklyData[weeklyData.length - 1]?.bags ?? 0
  const weekBags  = weeklyData.reduce((s, d) => s + d.bags, 0)
  const avgPerDay = weekBags / 7

  const earningsValue =
    earningsTab === 'daily'  ? `$${(todayBags * 3.75).toFixed(2)}` :
    earningsTab === 'weekly' ? `$${(weekBags  * 3.75).toFixed(2)}` :
                               `$${earnings}`

  const recycledValue =
    recycledTab === 'daily'  ? `${Math.round(todayBags * 2.5)} lbs` :
    recycledTab === 'weekly' ? `${Math.round(weekBags  * 2.5)} lbs` :
                               `${lbsDiverted} lbs`

  const earningsMiniCards = [
    { label: 'Today',   value: `$${(todayBags * 3.75).toFixed(2)}` },
    { label: 'Avg/day', value: `$${(avgPerDay * 3.75).toFixed(2)}` },
    { label: 'Pickups', value: String(weekBags) },
  ]
  const recycledMiniCards = [
    { label: 'Today',   value: `${Math.round(todayBags * 2.5)} lbs` },
    { label: 'Avg/wk',  value: `${Math.round(weekBags  * 2.5)} lbs` },
    { label: 'Bags',    value: String(myBags.length) },
  ]

  const currentProgressBag = myBags.find((b) => b.status !== 'completed') ?? myBags[0] ?? null
  const completedBagsList  = myBags.filter((b) => b.status === 'completed').slice(0, 5)

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

  // ── Manual bag request (opens ScanModal pre-seeded) ──────────────────────
  const handleManualRequest = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = code.trim()
    if (!trimmed) return
    setScanInitialCode(trimmed.toUpperCase())
    setCode('')
    setShowManual(false)
    setShowScan(true)
  }

  const handleSignOut = async () => {
    setSigningOut(true)
    try { await signOut() } catch { /* no real session in dev bypass — safe to ignore */ }
    clearAuth()
    localStorage.removeItem('baykid-auth')
    navigate('/login', { replace: true })
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
        {/* Left: recycling icon + wordmark */}
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
            style={{
              background: 'linear-gradient(135deg,rgba(0,188,212,0.25),rgba(0,100,255,0.15))',
              border: '1px solid rgba(0,188,212,0.35)',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#00c8ff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 19H4.815a1.83 1.83 0 0 1-1.57-.881 1.785 1.785 0 0 1-.004-1.784L7.196 9.5" />
              <path d="M11 19h8.203a1.83 1.83 0 0 0 1.556-.89 1.784 1.784 0 0 0 0-1.775l-1.226-2.12" />
              <path d="m14 16 3 3-3 3" />
              <path d="M8.293 13.596 7.196 9.5 3.1 10.598" />
              <path d="m9.344 5.811 1.093-1.892A1.83 1.83 0 0 1 11.985 3a1.784 1.784 0 0 1 1.546.888l3.943 6.843" />
              <path d="m13.378 9.633 4.096 1.098 1.097-4.096" />
            </svg>
          </div>
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
              className="flex h-9 w-9 items-center justify-center rounded-full transition-opacity hover:opacity-80 active:scale-90"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(0,190,255,0.2)' }}
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
            <div className="px-5 pt-6 pb-4">
              <p style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.01em', lineHeight: 1 }}>
                Welcome back,
              </p>
              <p style={{ fontSize: 28, fontWeight: 700, color: '#ffffff', lineHeight: 1.2, marginTop: 4 }}>
                {firstName}
              </p>
            </div>

            {/* ── Earnings strip — 3 glass cards ─────────────────────────────── */}
            <div className="px-5 grid grid-cols-3 gap-2.5 mb-4">
              {[
                { value: `$${earnings}`,          label: 'Earnings'      },
                { value: `${lbsDiverted} lbs`,    label: 'Recycled'      },
                { value: String(treesPlanted),    label: 'Trees Planted' },
              ].map((card) => (
                <div
                  key={card.label}
                  className="rounded-2xl px-3 py-3.5 flex flex-col gap-1.5"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(0,190,255,0.15)',
                    backdropFilter: 'blur(12px)',
                  }}
                >
                  {loadingBags ? (
                    <Skeleton height="h-5" />
                  ) : (
                    <p style={{ fontSize: 16, color: '#ffffff', fontWeight: 700, lineHeight: 1.1 }}>
                      {card.value}
                    </p>
                  )}
                  <p style={{ fontSize: 9, color: '#00c8ff', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                    {card.label}
                  </p>
                </div>
              ))}
            </div>

            {/* ── Scan Bag — gradient primary, full width, QR icon ───────────── */}
            <div className="px-5 mb-5">
              <button
                onClick={() => setShowScan(true)}
                className="w-full flex items-center justify-center gap-2.5 rounded-2xl py-4 text-sm font-bold text-white transition-all hover:brightness-110 active:scale-[0.98]"
                style={{
                  background: 'linear-gradient(135deg,#0057e7,#00c8ff)',
                  boxShadow: '0 4px 24px rgba(0,190,255,0.35)',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
                  <rect x="7" y="7" width="10" height="10" rx="1" />
                </svg>
                Scan Bag
              </button>
            </div>

            {/* ── Quick Access — 3 glass tiles ───────────────────────────────── */}
            <div className="px-5 mb-5">
              <p className="section-label mb-3">QUICK ACCESS</p>
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { icon: '♻️', label: 'Recycling', badge: activeBags,    action: () => setActivePage('recycling') },
                  { icon: '🎁', label: 'Rewards',   badge: 0,              action: () => setActivePage('rewards')   },
                  { icon: '🌍', label: 'Community', badge: unreadMsgCount, action: () => setActivePage('community') },
                ].map((tile) => (
                  <button
                    key={tile.label}
                    onClick={tile.action}
                    className="relative flex flex-col items-center gap-2 py-4 transition-all active:scale-[0.92] hover:brightness-110"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(0,190,255,0.15)',
                      borderRadius: 16,
                    }}
                  >
                    {tile.badge > 0 && (
                      <span
                        className="absolute top-2 right-2 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold"
                        style={{ background: '#FF1744', color: '#fff' }}
                      >
                        {tile.badge}
                      </span>
                    )}
                    <span style={{ fontSize: 22 }}>{tile.icon}</span>
                    <span style={{ fontSize: 11, color: '#ffffff', fontWeight: 600 }}>{tile.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* ── For You — horizontal scroll row ────────────────────────────── */}
            <div className="mb-5">
              <div className="px-5 flex items-center justify-between mb-2.5">
                <p className="section-label">FOR YOU</p>
                <span style={{ fontSize: 11, color: 'rgba(0,200,255,0.5)', fontWeight: 500 }}>swipe ›</span>
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
                      onClick={() => { setSelectedCategory(cat.label); setActivePage(cat.page) }}
                      className="shrink-0 flex flex-col items-center gap-1.5 py-3.5 rounded-2xl transition-all active:scale-[0.92]"
                      style={{
                        width: 76,
                        background: selected ? 'rgba(0,130,255,0.2)' : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${selected ? 'rgba(0,210,255,0.5)' : 'rgba(0,190,255,0.15)'}`,
                        boxShadow: selected ? '0 0 12px rgba(0,200,255,0.12)' : 'none',
                      }}
                    >
                      <span style={{ fontSize: 22 }}>{cat.icon}</span>
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
              <p className="section-label mb-3">NEWS & UPDATES</p>
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
                      <div
                        className="mt-0.5 shrink-0 h-7 w-7 flex items-center justify-center rounded-lg text-sm"
                        style={{ background: 'rgba(0,190,255,0.1)' }}
                      >
                        📢
                      </div>
                      <div>
                        <p style={{ fontSize: 13, color: '#ffffff', fontWeight: 700, lineHeight: 1.3 }}>{item.title}</p>
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 3, lineHeight: 1.45 }}>{item.desc}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

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

            {/* QR Scanner card */}
            <div className="px-5 mb-5">
              <div
                className="rounded-2xl p-5 space-y-4"
                style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(0,190,255,0.25)', backdropFilter: 'blur(12px)' }}
              >
                {/* QR frame visual */}
                <div className="flex justify-center">
                  <div className="relative" style={{ width: 180, height: 180 }}>
                    {/* Dark interior */}
                    <div className="absolute inset-0 rounded-xl" style={{ background: 'rgba(0,10,30,0.6)' }} />

                    {/* 5×5 faint grid */}
                    <div
                      className="absolute grid"
                      style={{
                        inset: '24px',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(5, 1fr)',
                        gridTemplateRows: 'repeat(5, 1fr)',
                        gap: '6px',
                      }}
                    >
                      {Array.from({ length: 25 }).map((_, i) => (
                        <div key={i} className="rounded-sm" style={{ background: 'rgba(0,200,255,0.2)' }} />
                      ))}
                    </div>

                    {/* Corner brackets */}
                    <div className="absolute top-0 left-0" style={{ width: 20, height: 20, borderTop: '3px solid #00c8ff', borderLeft: '3px solid #00c8ff', borderRadius: '4px 0 0 0' }} />
                    <div className="absolute top-0 right-0" style={{ width: 20, height: 20, borderTop: '3px solid #00c8ff', borderRight: '3px solid #00c8ff', borderRadius: '0 4px 0 0' }} />
                    <div className="absolute bottom-0 left-0" style={{ width: 20, height: 20, borderBottom: '3px solid #00c8ff', borderLeft: '3px solid #00c8ff', borderRadius: '0 0 0 4px' }} />
                    <div className="absolute bottom-0 right-0" style={{ width: 20, height: 20, borderBottom: '3px solid #00c8ff', borderRight: '3px solid #00c8ff', borderRadius: '0 0 4px 0' }} />

                    {/* Animated scan line */}
                    <div
                      className="absolute left-1 right-1"
                      style={{
                        height: '1.5px',
                        background: 'rgba(0,200,255,0.7)',
                        boxShadow: '0 0 8px 2px rgba(0,200,255,0.4)',
                        animation: 'scanLine 2.2s ease-in-out infinite',
                      }}
                    />
                  </div>
                </div>

                <p className="text-center text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Point camera at your QR-coded bag
                </p>

                {/* Primary scan button */}
                <button
                  onClick={() => setShowScan(true)}
                  className="w-full flex items-center justify-center gap-2.5 rounded-xl py-3.5 text-sm font-bold text-white transition-all hover:brightness-110 active:scale-[0.98]"
                  style={{ background: 'linear-gradient(135deg,#0057e7,#00c8ff)', boxShadow: '0 4px 20px rgba(0,190,255,0.35)' }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
                    <rect x="7" y="7" width="10" height="10" rx="1" />
                  </svg>
                  Scan Bag
                </button>

                {/* Manual entry toggle */}
                <button
                  onClick={() => { setShowManual((v) => !v); setCode('') }}
                  className="w-full text-sm font-medium transition-opacity hover:opacity-80"
                  style={{ color: showManual ? '#00c8ff' : 'rgba(255,255,255,0.45)' }}
                >
                  {showManual ? '✕ Close manual entry' : '+ Enter bag code manually'}
                </button>

                {showManual && (
                  <form onSubmit={handleManualRequest} className="flex gap-2">
                    <input
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="Any code — letters, numbers, symbols"
                      autoFocus
                      className="flex-1 rounded-xl px-4 py-2.5 text-sm outline-none"
                      style={{
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(0,200,255,0.25)',
                        color: '#ffffff',
                      }}
                    />
                    <button
                      type="submit"
                      disabled={!code.trim()}
                      className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 whitespace-nowrap"
                      style={{ background: 'linear-gradient(135deg,#0057e7,#00c8ff)' }}
                    >
                      Request Pickup
                    </button>
                  </form>
                )}
              </div>
            </div>

            {/* Active bags list */}
            <div className="px-5 pb-4">
                <p className="section-label mb-3">ACTIVE BAGS</p>

                {/* Tab filter pill */}
                <div
                  className="flex mb-4 p-[3px]"
                  style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 10 }}
                >
                  {(['active', 'history', 'all'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setBagTab(t)}
                      className="flex-1 py-1.5 text-xs font-semibold transition-all"
                      style={{
                        borderRadius: 8,
                        ...(bagTab === t
                          ? { background: 'rgba(0,130,255,0.3)', color: '#00c8ff' }
                          : { color: 'rgba(255,255,255,0.4)' }),
                      }}
                    >
                      {t === 'all' ? 'All bags' : t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>

                {/* Bag cards */}
                {loadingBags ? (
                  <div className="space-y-3">
                    {[0, 1, 2].map((i) => <Skeleton key={i} height="h-16" rounded="rounded-2xl" />)}
                  </div>
                ) : filteredBags.length === 0 && demoBags.length === 0 ? (
                  <EmptyState
                    icon="♻️"
                    title={bagTab === 'history' ? 'No completed bags yet' : 'No active bags'}
                    description={bagTab === 'history' ? 'Completed bags will appear here.' : 'Scan a bag to get started.'}
                    action={bagTab !== 'history' ? { label: 'Scan Bag', onClick: () => setShowScan(true) } : undefined}
                  />
                ) : (
                  <div className="space-y-2.5">
                    {filteredBags.map((bag) => {
                      const badge = BAG_STATUS_BADGE[bag.status] ?? { label: bag.status, bg: 'rgba(255,255,255,0.08)', color: '#7B909C' }
                      const d = new Date(bag.created_at)
                      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                      return (
                        <div
                          key={bag.id}
                          className="rounded-2xl px-4 py-3.5 flex items-center justify-between"
                          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(0,190,255,0.12)' }}
                        >
                          <div>
                            <p className="font-mono font-bold" style={{ fontSize: 14, color: '#ffffff' }}>{bag.bag_code}</p>
                            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                              {dateStr} · {timeStr} · 1 bag
                            </p>
                          </div>
                          <span
                            className="rounded-full px-2.5 py-0.5 text-xs font-semibold shrink-0"
                            style={{ background: badge.bg, color: badge.color }}
                          >
                            {badge.label}
                          </span>
                        </div>
                      )
                    })}
                    {demoBags.map((bag) => {
                      const DEMO_STATUS_BADGE: Record<string, { label: string; bg: string; color: string }> = {
                        pending_pickup:   { label: 'Pending',      bg: 'rgba(245,158,11,0.15)',  color: '#fde047' },
                        driver_accepted:  { label: 'Driver Assigned', bg: 'rgba(139,92,246,0.18)', color: '#a78bfa' },
                        at_warehouse:     { label: 'At Warehouse', bg: 'rgba(0,190,255,0.12)',   color: '#67e8f9' },
                        completed:        { label: 'Delivered',    bg: 'rgba(34,197,94,0.15)',   color: '#4ade80' },
                      }
                      const badge = DEMO_STATUS_BADGE[bag.status] ?? { label: bag.status, bg: 'rgba(255,255,255,0.08)', color: '#7B909C' }
                      const d = new Date(bag.requestedAt)
                      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                      return (
                        <div
                          key={bag.id}
                          className="rounded-2xl px-4 py-3.5 flex items-center justify-between"
                          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(0,190,255,0.12)' }}
                        >
                          <div>
                            <p className="font-mono font-bold" style={{ fontSize: 14, color: '#ffffff' }}>{bag.bagCode}</p>
                            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                              {dateStr} · {timeStr} · 1 bag
                            </p>
                          </div>
                          <span
                            className="rounded-full px-2.5 py-0.5 text-xs font-semibold shrink-0"
                            style={{ background: badge.bg, color: badge.color }}
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

            {/* Page title */}
            <div className="px-5 pt-5 pb-4">
              <p style={{ fontSize: 22, color: '#ffffff', fontWeight: 500 }}>Deeds</p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>Track your recycling impact</p>
            </div>

            {/* ── BOX 1: EARNINGS ─────────────────────────────────────── */}
            <div className="px-5 mb-4">
              <div
                className="rounded-2xl p-4 space-y-3"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(0,190,255,0.15)' }}
              >
                <div className="flex items-center justify-between">
                  <p className="section-label">EARNINGS</p>
                  <button
                    onClick={() => setShowPaidOut(true)}
                    className="font-semibold text-white"
                    style={{
                      background: 'linear-gradient(135deg,#0057e7,#00c8ff)',
                      borderRadius: 20,
                      fontSize: 11,
                      padding: '5px 14px',
                    }}
                  >
                    Paid Out
                  </button>
                </div>

                <p style={{ fontSize: 32, color: '#ffffff', fontWeight: 500, lineHeight: 1 }}>
                  {demoStats.unpaidEarnings > 0 ? `$${demoStats.unpaidEarnings.toFixed(2)}` : earningsValue}
                </p>

                <div className="flex p-[3px]" style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 10 }}>
                  {(['daily', 'weekly', 'monthly'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setEarningsTab(t)}
                      className="flex-1 py-1.5 text-xs font-semibold capitalize transition-all"
                      style={{
                        borderRadius: 8,
                        ...(earningsTab === t
                          ? { background: 'rgba(0,130,255,0.3)', color: '#00c8ff' }
                          : { color: 'rgba(255,255,255,0.4)' }),
                      }}
                    >
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {earningsMiniCards.map((card) => (
                    <div
                      key={card.label}
                      className="rounded-xl p-2.5"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(0,190,255,0.1)' }}
                    >
                      <p style={{ fontSize: 13, color: '#ffffff', fontWeight: 600 }}>{card.value}</p>
                      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{card.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── BOX 2: TOTAL RECYCLED ────────────────────────────────── */}
            <div className="px-5 mb-4">
              <div
                className="rounded-2xl p-4 space-y-3"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(0,190,255,0.15)' }}
              >
                <p className="section-label">TOTAL RECYCLED</p>

                <p style={{ fontSize: 32, color: '#ffffff', fontWeight: 500, lineHeight: 1 }}>
                  {demoStats.poundsRecycled > 0 ? `${demoStats.poundsRecycled} lbs` : recycledValue}
                </p>

                <div className="flex p-[3px]" style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 10 }}>
                  {(['daily', 'weekly', 'monthly'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setRecycledTab(t)}
                      className="flex-1 py-1.5 text-xs font-semibold capitalize transition-all"
                      style={{
                        borderRadius: 8,
                        ...(recycledTab === t
                          ? { background: 'rgba(0,130,255,0.3)', color: '#00c8ff' }
                          : { color: 'rgba(255,255,255,0.4)' }),
                      }}
                    >
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {recycledMiniCards.map((card) => (
                    <div
                      key={card.label}
                      className="rounded-xl p-2.5"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(0,190,255,0.1)' }}
                    >
                      <p style={{ fontSize: 13, color: '#ffffff', fontWeight: 600 }}>{card.value}</p>
                      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{card.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── CURRENT BAG PROGRESS ─────────────────────────────────── */}
            {currentProgressBag && (
              <div className="px-5 mb-4">
                <p className="section-label mb-3">CURRENT BAG PROGRESS</p>
                <div
                  className="rounded-2xl p-4"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(0,190,255,0.15)' }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <p className="font-mono font-bold" style={{ fontSize: 14, color: '#ffffff' }}>
                      {currentProgressBag.bag_code}
                    </p>
                    <span style={{ fontSize: 12, color: '#00c8ff' }}>
                      {currentProgressBag.status === 'completed' ? 'Completed' : 'In progress'}
                    </span>
                  </div>

                  {DEEDS_STEPS.map((step, i) => {
                    const curIdx    = DEEDS_STEP_IDX[currentProgressBag.status] ?? 0
                    const isDone    = i < curIdx
                    const isCurrent = i === curIdx
                    const bagDate   = new Date(currentProgressBag.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

                    return (
                      <div key={step.key} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div
                            style={{
                              width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                              background: isDone ? '#22c55e' : isCurrent ? '#00c8ff' : 'rgba(255,255,255,0.2)',
                              animation: isCurrent ? 'dotPulse 1.5s ease-in-out infinite' : 'none',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                          >
                            {isDone && (
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M4.5 12.75l6 6 9-13.5" />
                              </svg>
                            )}
                            {isCurrent && (
                              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />
                            )}
                          </div>
                          {i < DEEDS_STEPS.length - 1 && (
                            <div style={{ width: 1.5, flex: 1, minHeight: 20, marginTop: 3, marginBottom: 3, background: 'rgba(0,190,255,0.15)' }} />
                          )}
                        </div>
                        <div style={{ paddingBottom: i < DEEDS_STEPS.length - 1 ? 14 : 0 }}>
                          <p style={{
                            fontSize: 13,
                            color: isDone || isCurrent ? '#ffffff' : 'rgba(255,255,255,0.35)',
                            fontWeight: isDone || isCurrent ? 600 : 400,
                          }}>
                            {step.label}
                          </p>
                          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                            {isDone ? bagDate : isCurrent ? step.activeLabel : 'Pending'}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── BAG HISTORY ──────────────────────────────────────────── */}
            {completedBagsList.length > 0 && (
              <div className="px-5 mb-4">
                <p className="section-label mb-3">BAG HISTORY</p>
                <div
                  className="rounded-2xl overflow-hidden"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(0,190,255,0.15)' }}
                >
                  {completedBagsList.map((bag, i) => (
                    <div
                      key={bag.id}
                      className="px-4 py-3 flex items-center justify-between"
                      style={{ borderBottom: i < completedBagsList.length - 1 ? '1px solid rgba(0,190,255,0.08)' : 'none' }}
                    >
                      <div>
                        <p className="font-mono font-bold" style={{ fontSize: 13, color: '#ffffff' }}>{bag.bag_code}</p>
                        <p style={{ fontSize: 11, color: '#00c8ff', marginTop: 1 }}>$3.75 earned</p>
                        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>
                          {new Date(bag.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                      <span
                        className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                        style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80' }}
                      >
                        ✓ Passed
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── IMPACT BREAKDOWN ─────────────────────────────────────── */}
            <div className="px-5 mb-5">
              <p className="section-label mb-3">IMPACT BREAKDOWN</p>
              <div
                className="rounded-2xl overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(0,190,255,0.15)' }}
              >
                {[
                  { icon: '♻️', label: 'Waste diverted', sub: 'From landfill this month',  value: `${lbsDiverted} lbs`, iconBg: 'rgba(0,200,255,0.12)' },
                  { icon: '🌍', label: 'CO₂ reduced',     sub: 'Carbon footprint saved',    value: `${co2Saved} lbs`,    iconBg: 'rgba(0,230,118,0.1)'  },
                  { icon: '🌱', label: 'Trees planted',   sub: 'Via recycling credits',     value: String(treesPlanted), iconBg: 'rgba(0,200,83,0.1)'   },
                  { icon: '💰', label: 'Total earned',    sub: 'Since joining',             value: `$${earnings}`,       iconBg: 'rgba(255,193,7,0.12)' },
                ].map((row, i, arr) => (
                  <div
                    key={row.label}
                    className="px-4 py-3.5 flex items-center gap-3"
                    style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(0,190,255,0.08)' : 'none' }}
                  >
                    <div
                      className="flex items-center justify-center shrink-0"
                      style={{ width: 36, height: 36, borderRadius: 10, background: row.iconBg, fontSize: 18 }}
                    >
                      {row.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p style={{ fontSize: 13, color: '#ffffff', fontWeight: 600 }}>{row.label}</p>
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>{row.sub}</p>
                    </div>
                    <p style={{ fontSize: 14, color: '#00c8ff', fontWeight: 500, flexShrink: 0 }}>{row.value}</p>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* ── ACCOUNT ───────────────────────────────────────────────────────── */}
        {tab === 'account' && (
          <div style={{ animation: 'fadeSlideUp 0.3s ease both' }}>

            {/* Profile Card */}
            <div className="px-5 pt-5 mb-5">
              <div
                className="rounded-2xl p-4 flex items-center gap-4"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(0,190,255,0.15)' }}
              >
                {/* Avatar with verified badge */}
                <div className="relative shrink-0">
                  <div
                    className="flex items-center justify-center rounded-full font-extrabold"
                    style={{
                      width: 60, height: 60,
                      background: 'linear-gradient(135deg,#0057e7,#00c8ff)',
                      color: '#ffffff',
                      fontSize: 20,
                      boxShadow: '0 0 20px rgba(0,190,255,0.35)',
                    }}
                  >
                    {initials}
                  </div>
                  <div
                    className="absolute flex items-center justify-center"
                    style={{
                      width: 18, height: 18, borderRadius: '50%',
                      background: '#22c55e',
                      border: '2px solid #060e24',
                      bottom: 0, right: 0,
                    }}
                  >
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p style={{ fontSize: 17, color: '#ffffff', fontWeight: 600 }}>{profile?.full_name ?? '—'}</p>
                  <p style={{ fontSize: 11, color: '#00c8ff', marginTop: 3 }}>Verified Eco Member</p>
                  <button
                    className="mt-2 rounded-full px-3 py-1 font-semibold transition-opacity hover:opacity-80 active:scale-[0.96]"
                    style={{
                      background: 'rgba(0,190,255,0.08)',
                      border: '1px solid rgba(0,190,255,0.2)',
                      color: 'rgba(0,210,255,0.7)',
                      fontSize: 11,
                    }}
                  >
                    Edit profile
                  </button>
                </div>
              </div>
            </div>

            {/* MY IMPACT */}
            <div className="px-5 mb-5">
              <p className="section-label mb-3">MY IMPACT</p>
              <div
                className="rounded-2xl overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(0,190,255,0.15)' }}
              >
                {[
                  { icon: '🌍', iconBg: 'rgba(0,230,118,0.1)',   label: 'CO₂ Impact',    sub: `You saved ${co2Saved} lbs of CO₂` },
                  { icon: '♻️', iconBg: 'rgba(0,200,255,0.12)',  label: 'Waste Reduced', sub: `${lbsDiverted} lbs recycled`      },
                ].map((row, i, arr) => (
                  <button
                    key={row.label}
                    className="w-full flex items-center gap-3 px-4 py-3.5 transition-opacity hover:opacity-80 active:opacity-70"
                    style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(0,190,255,0.08)' : 'none' }}
                  >
                    <div
                      className="flex items-center justify-center shrink-0"
                      style={{ width: 36, height: 36, borderRadius: 10, background: row.iconBg, fontSize: 18 }}
                    >
                      {row.icon}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p style={{ fontSize: 13, color: '#ffffff', fontWeight: 600 }}>{row.label}</p>
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{row.sub}</p>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>

            {/* EARNINGS & WALLET */}
            <div className="px-5 mb-5">
              <p className="section-label mb-3">EARNINGS & WALLET</p>
              <div
                className="rounded-2xl overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(0,190,255,0.15)' }}
              >
                {[
                  { icon: '💰', iconBg: 'rgba(255,193,7,0.12)',  label: 'Rewards',   sub: `$${earnings} earned`,  badge: null  },
                  { icon: '💳', iconBg: 'rgba(139,92,246,0.15)', label: 'Wallet',    sub: 'Manage payments',      badge: null  },
                  { icon: '🎁', iconBg: 'rgba(0,230,118,0.1)',   label: 'Referrals', sub: 'Invite friends',       badge: '+$5' },
                ].map((row, i, arr) => (
                  <button
                    key={row.label}
                    className="w-full flex items-center gap-3 px-4 py-3.5 transition-opacity hover:opacity-80 active:opacity-70"
                    style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(0,190,255,0.08)' : 'none' }}
                  >
                    <div
                      className="flex items-center justify-center shrink-0"
                      style={{ width: 36, height: 36, borderRadius: 10, background: row.iconBg, fontSize: 18 }}
                    >
                      {row.icon}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p style={{ fontSize: 13, color: '#ffffff', fontWeight: 600 }}>{row.label}</p>
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{row.sub}</p>
                    </div>
                    {row.badge && (
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-bold mr-1"
                        style={{ background: 'rgba(0,200,255,0.12)', color: '#00c8ff', border: '1px solid rgba(0,190,255,0.25)' }}
                      >
                        {row.badge}
                      </span>
                    )}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>

            {/* ACCOUNT */}
            <div className="px-5 mb-6">
              <p className="section-label mb-3">ACCOUNT</p>
              <div
                className="rounded-2xl overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(0,190,255,0.15)' }}
              >
                {[
                  { icon: '⚙️', iconBg: 'rgba(0,190,255,0.1)', label: 'Settings',        sub: 'Preferences & notifications' },
                  { icon: '❓', iconBg: 'rgba(255,193,7,0.1)',  label: 'Help & Support',  sub: 'FAQ & contact us'            },
                  { icon: '🔒', iconBg: 'rgba(255,23,68,0.08)', label: 'Privacy & Terms', sub: 'Data & legal'                },
                ].map((row, i, arr) => (
                  <button
                    key={row.label}
                    className="w-full flex items-center gap-3 px-4 py-3.5 transition-opacity hover:opacity-80 active:opacity-70"
                    style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(0,190,255,0.08)' : 'none' }}
                  >
                    <div
                      className="flex items-center justify-center shrink-0"
                      style={{ width: 36, height: 36, borderRadius: 10, background: row.iconBg, fontSize: 18 }}
                    >
                      {row.icon}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p style={{ fontSize: 13, color: '#ffffff', fontWeight: 600 }}>{row.label}</p>
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{row.sub}</p>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>

          </div>
        )}
      </main>

      <BottomNav tab={tab} onTab={setTab} msgCount={unreadMsgCount} />

      {/* ── DEMO OVERLAYS ─────────────────────────────────────────────────── */}
      {activePage && <QuickActionPage page={activePage} onClose={() => setActivePage(null)} />}
      {showScan    && <ScanModal consumerName={firstName} initialCode={scanInitialCode ?? undefined} onClose={() => { setShowScan(false); setScanInitialCode(null) }} />}
      {showPaidOut && <PaidOutModal stats={demoStats} onClose={() => setShowPaidOut(false)} onConfirm={() => processPayout()} />}

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
