import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { getAllBags } from '../../lib/bags'
import { supabase } from '../../lib/supabase'
import { isDemoModeActive } from '../../lib/devBypass'
const DEV_BYPASS_AUTH = isDemoModeActive()
import type { Bag, BagStatus } from '../../types'

// ── Mock data ──────────────────────────────────────────────────────────────────

const NOW = new Date('2026-05-07T14:00:00Z')
function ts(minsAgo: number) {
  return new Date(NOW.getTime() - minsAgo * 60_000).toISOString()
}

const MOCK_BAGS: Bag[] = [
  { id: 'm1',  bag_code: 'BAG-MRC0001', status: 'completed',    owner_id: 'c1', partner_id: null, created_at: ts(180), updated_at: ts(15)  },
  { id: 'm2',  bag_code: 'BAG-TBR0002', status: 'at_warehouse', owner_id: 'c2', partner_id: null, created_at: ts(160), updated_at: ts(22)  },
  { id: 'm3',  bag_code: 'BAG-DCT0003', status: 'inspected',    owner_id: 'c3', partner_id: null, created_at: ts(140), updated_at: ts(10)  },
  { id: 'm4',  bag_code: 'BAG-RJH0004', status: 'picked_up',    owner_id: 'c4', partner_id: null, created_at: ts(120), updated_at: ts(35)  },
  { id: 'm5',  bag_code: 'BAG-AMR0005', status: 'assigned',     owner_id: 'c5', partner_id: null, created_at: ts(100), updated_at: ts(50)  },
  { id: 'm6',  bag_code: 'BAG-JHS0006', status: 'pending',      owner_id: 'c6', partner_id: null, created_at: ts(80),  updated_at: ts(80)  },
  { id: 'm7',  bag_code: 'BAG-MRC0007', status: 'completed',    owner_id: 'c7', partner_id: null, created_at: ts(240), updated_at: ts(60)  },
  { id: 'm8',  bag_code: 'BAG-TBR0008', status: 'picked_up',    owner_id: 'c8', partner_id: null, created_at: ts(90),  updated_at: ts(45)  },
  { id: 'm9',  bag_code: 'BAG-DCT0009', status: 'at_warehouse', owner_id: 'c9', partner_id: null, created_at: ts(75),  updated_at: ts(18)  },
  { id: 'm10', bag_code: 'BAG-RJH0010', status: 'pending',      owner_id: null, partner_id: null, created_at: ts(30),  updated_at: ts(30)  },
]

// ── Status config ──────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<BagStatus, { label: string; bg: string; color: string; step: number }> = {
  pending:      { label: 'Pending',      bg: 'rgba(245,158,11,0.15)',  color: '#fde047', step: 0 },
  assigned:     { label: 'Assigned',     bg: 'rgba(139,92,246,0.18)', color: '#a78bfa', step: 1 },
  picked_up:    { label: 'Picked Up',    bg: 'rgba(0,190,255,0.15)',  color: '#00c8ff', step: 2 },
  at_warehouse: { label: 'At Warehouse', bg: 'rgba(0,190,255,0.12)',  color: '#67e8f9', step: 3 },
  inspected:    { label: 'Inspected',    bg: 'rgba(255,214,0,0.15)',  color: '#FFD600', step: 4 },
  completed:    { label: 'Completed',    bg: 'rgba(34,197,94,0.15)',  color: '#4ade80', step: 5 },
}

const LIFECYCLE_STEPS: BagStatus[] = ['pending', 'assigned', 'picked_up', 'at_warehouse', 'inspected', 'completed']

type FilterStatus = 'all' | 'active' | 'completed'

function filterBags(bags: Bag[], filter: FilterStatus): Bag[] {
  if (filter === 'completed') return bags.filter((b) => b.status === 'completed')
  if (filter === 'active') return bags.filter((b) => b.status !== 'completed')
  return bags
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ── Bag row ────────────────────────────────────────────────────────────────────

function BagRow({ bag }: { bag: Bag }) {
  const cfg = STATUS_CONFIG[bag.status]
  const currentStep = cfg.step
  const isCompleted = bag.status === 'completed'

  return (
    <div
      className="rounded-2xl px-4 py-3.5 space-y-3"
      style={{
        background: isCompleted ? 'rgba(34,197,94,0.04)' : 'rgba(255,255,255,0.05)',
        border: `1px solid ${isCompleted ? 'rgba(34,197,94,0.2)' : 'rgba(0,190,255,0.12)'}`,
      }}
    >
      {/* Top row: code + badge + time */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-mono font-bold" style={{ fontSize: 13, color: '#E0F7FA' }}>{bag.bag_code}</p>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
            Updated {relativeTime(bag.updated_at)}
          </p>
        </div>
        <span
          className="shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold"
          style={{ background: cfg.bg, color: cfg.color }}
        >
          {cfg.label}
        </span>
      </div>

      {/* Lifecycle bar */}
      <div className="flex items-center gap-0.5">
        {LIFECYCLE_STEPS.map((step, i) => {
          const done    = i <= currentStep
          const current = i === currentStep
          return (
            <div key={step} className="flex-1 flex items-center gap-0.5">
              <div
                className="flex-1 rounded-full transition-all"
                style={{
                  height: 4,
                  background: done
                    ? (current ? cfg.color : 'rgba(34,197,94,0.5)')
                    : 'rgba(255,255,255,0.08)',
                }}
              />
              {i < LIFECYCLE_STEPS.length - 1 && (
                <div
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    flexShrink: 0,
                    background: i < currentStep ? 'rgba(34,197,94,0.6)' : i === currentStep ? cfg.color : 'rgba(255,255,255,0.1)',
                    transition: 'background 0.3s',
                  }}
                />
              )}
              {/* label under first and last step only */}
              {(i === 0 || i === LIFECYCLE_STEPS.length - 1) && false}
            </div>
          )
        })}
      </div>

      {/* Step labels: first and last */}
      <div className="flex items-center justify-between" style={{ marginTop: -8 }}>
        <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Pending</p>
        <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Done</p>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function LiveBagsPage() {
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [bags, setBags] = useState<Bag[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isError, setIsError] = useState(false)
  const [liveConnected, setLiveConnected] = useState(false)

  const loadBags = useCallback(async () => {
    setIsLoading(true)
    setIsError(false)
    try {
      if (DEV_BYPASS_AUTH) {
        setBags(MOCK_BAGS)
        return
      }
      const data = await getAllBags()
      console.log('[LiveBags] rows', data)
      setBags(data ?? [])
    } catch (error) {
      console.error('[LiveBags] error', error)
      setIsError(true)
      setBags([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadBags()
  }, [loadBags])

  // Realtime subscription (prod only)
  useEffect(() => {
    if (DEV_BYPASS_AUTH) return

    const channel = supabase
      .channel('live-bags-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'qr_bags' },
        () => {
          loadBags()
        },
      )
      .subscribe((status) => {
        setLiveConnected(status === 'SUBSCRIBED')
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadBags])

  const visible = filterBags(bags, filter)

  const pendingCount   = bags.filter((b) => b.status === 'pending').length
  const activeCount    = bags.filter((b) => b.status !== 'completed' && b.status !== 'pending').length
  const completedCount = bags.filter((b) => b.status === 'completed').length

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden" style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}>
      <div className="pointer-events-none absolute inset-0 grid-bg" />
      <div className="pointer-events-none absolute" style={{ top: -80, left: -60, width: 280, height: 280, background: 'rgba(0,87,231,0.22)', filter: 'blur(72px)', borderRadius: '50%' }} />

      {/* Header */}
      <header
        className="relative flex items-center justify-between px-4 py-3"
        style={{ background: 'rgba(4,10,24,0.92)', borderBottom: '1px solid rgba(0,200,255,0.12)', backdropFilter: 'blur(12px)', zIndex: 2 }}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl font-extrabold" style={{ color: '#00c8ff' }}>BayKid</span>
          <span style={{ color: 'rgba(0,200,255,0.3)' }}>|</span>
          <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>Live Bags</span>
          {(DEV_BYPASS_AUTH || liveConnected) && (
            <span className="flex items-center gap-1">
              <span
                className="rounded-full"
                style={{ width: 7, height: 7, background: '#4ade80', boxShadow: '0 0 6px #4ade80', animation: 'dotPulse 1.5s ease-in-out infinite' }}
              />
              <span style={{ fontSize: 9, color: '#4ade80', fontWeight: 600 }}>LIVE</span>
            </span>
          )}
        </div>
        <Link to="/live-dashboard" className="text-sm transition-opacity hover:opacity-70" style={{ color: 'rgba(255,255,255,0.4)' }}>← Dashboard</Link>
      </header>

      <div className="relative flex-1 overflow-y-auto pb-8" style={{ zIndex: 1 }}>
        <div className="max-w-[520px] mx-auto px-4 pt-6">

          {/* Summary stat pills */}
          <div className="grid grid-cols-3 gap-2 mb-5">
            {[
              { label: 'Pending',  value: pendingCount,   color: '#fde047', bg: 'rgba(245,158,11,0.1)'  },
              { label: 'Active',   value: activeCount,    color: '#00c8ff', bg: 'rgba(0,190,255,0.08)'  },
              { label: 'Done',     value: completedCount, color: '#4ade80', bg: 'rgba(34,197,94,0.08)'  },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-2xl p-3 flex flex-col gap-1"
                style={{ background: s.bg, border: `1px solid ${s.color}28` }}
              >
                <p style={{ fontSize: 22, color: s.color, fontWeight: 700, lineHeight: 1 }}>{s.value}</p>
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Filter pills */}
          <div
            className="flex mb-4 p-[3px]"
            style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12 }}
          >
            {(['all', 'active', 'completed'] as FilterStatus[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="flex-1 py-2 text-xs font-semibold capitalize transition-all"
                style={{
                  borderRadius: 9,
                  ...(filter === f
                    ? { background: 'rgba(0,130,255,0.3)', color: '#00c8ff' }
                    : { color: 'rgba(255,255,255,0.4)' }),
                }}
              >
                {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                {f === 'all' && bags.length > 0 && ` (${bags.length})`}
              </button>
            ))}
          </div>

          {/* Bag list */}
          {isLoading && (
            <div className="flex justify-center py-12">
              <div
                className="h-7 w-7 animate-spin rounded-full border-4"
                style={{ borderColor: '#00c8ff', borderTopColor: 'transparent' }}
              />
            </div>
          )}

          {isError && (
            <div
              className="rounded-2xl p-5 text-center space-y-3"
              style={{ background: 'rgba(255,23,68,0.08)', border: '1px solid rgba(255,23,68,0.25)' }}
            >
              <p className="text-sm font-semibold" style={{ color: '#FF1744' }}>Failed to load bags</p>
              <button
                onClick={() => loadBags()}
                className="text-xs font-medium underline"
                style={{ color: '#FF5252' }}
              >
                Try again
              </button>
            </div>
          )}

          {!isLoading && !isError && visible.length === 0 && (
            <div
              className="rounded-2xl p-8 text-center"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(0,190,255,0.12)' }}
            >
              <p style={{ fontSize: 32, marginBottom: 12 }}>📦</p>
              <p style={{ fontSize: 13, color: '#ffffff', fontWeight: 600 }}>No bags found yet</p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
                {filter === 'all' ? 'No bags in the system yet.' : `No ${filter} bags right now.`}
              </p>
            </div>
          )}

          {!isLoading && !isError && visible.length > 0 && (
            <div className="space-y-2.5">
              {visible.map((bag) => (
                <BagRow key={bag.id} bag={bag} />
              ))}
            </div>
          )}

          {/* Back links */}
          <div className="flex flex-col gap-2 mt-6">
            <Link
              to="/bag-lifecycle"
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold transition-all hover:brightness-110"
              style={{ background: 'rgba(0,200,255,0.07)', border: '1px solid rgba(0,200,255,0.22)', color: '#00c8ff' }}
            >
              📦 View Bag Lifecycle Demo
            </Link>
            <Link
              to="/live-dashboard"
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-medium transition-all hover:brightness-110"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}
            >
              ← Back to Live Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
