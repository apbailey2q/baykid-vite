import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuthStore } from '../../store/authStore'

type Fundraiser = {
  id:               string
  name:             string
  organization:     string | null
  goal_amount:      number
  raised_amount:    number
  bag_count:        number
  percent_to_cause: number
  status:           string
  start_date:       string | null
  end_date:         string | null
  city:             string | null
}

type RawContrib = {
  id:             string
  type:           string
  amount:         number
  bag_id:         string | null
  contributor_id: string | null
  created_at:     string
  notes:          string | null
  contributor:    { full_name: string | null } | null
}

type TopContrib = {
  cid:      string
  name:     string
  total:    number
  count:    number
  cash:     number
  bags:     number   // monetary value of bag contributions
  bagCount: number   // number of bag contributions
}

type DayData = {
  fullDate: string
  date:     string
  cash:     number
  bags:     number
  total:    number
  count:    number
}

function displayName(c: RawContrib): string {
  if (c.contributor?.full_name) return c.contributor.full_name
  return 'Unknown Contributor'
}

function fmtAmt(n: number): string {
  return `$${n.toFixed(2)}`
}

function timeAgo(ts: string, now: number): string {
  const secs = Math.floor((now - new Date(ts).getTime()) / 1000)
  if (secs < 30)  return 'Just now'
  if (secs < 90)  return '1 min ago'
  const mins = Math.floor(secs / 60)
  if (mins < 60)  return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `${hrs} hr ago`
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function activityText(c: RawContrib): string {
  if (c.type === 'cash')  return `donated ${fmtAmt(c.amount)}`
  if (c.type === 'bag')   return `recycled a bag (${fmtAmt(c.amount)})`
  if (c.type === 'bonus') return `received a bonus (${fmtAmt(c.amount)})`
  return `contributed ${fmtAmt(c.amount)}`
}

function typeColor(t: string): string {
  if (t === 'cash')  return '#4ade80'
  if (t === 'bag')   return '#00c8ff'
  if (t === 'bonus') return '#fbbf24'
  return '#ffffff'
}

function typeBg(t: string): string {
  if (t === 'cash')  return 'rgba(74,222,128,0.12)'
  if (t === 'bag')   return 'rgba(0,200,255,0.12)'
  if (t === 'bonus') return 'rgba(251,191,36,0.12)'
  return 'rgba(255,255,255,0.08)'
}

function typeBorder(t: string): string {
  if (t === 'cash')  return 'rgba(74,222,128,0.3)'
  if (t === 'bag')   return 'rgba(0,200,255,0.3)'
  if (t === 'bonus') return 'rgba(251,191,36,0.3)'
  return 'rgba(255,255,255,0.15)'
}

function typeIcon(t: string): string {
  if (t === 'cash')  return '💰'
  if (t === 'bag')   return '♻️'
  if (t === 'bonus') return '⭐'
  return '📋'
}

function fmtShortDate(ymd: string): string {
  return new Date(ymd + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function LiveFundraiserDashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [animate, setAnimate]         = useState(false)
  const [now, setNow]                 = useState(() => Date.now())
  const [fundraisers, setFundraisers] = useState<Fundraiser[]>([])
  const [selectedFid, setSelectedFid] = useState('')
  const [contributions, setContribs]  = useState<RawContrib[]>([])
  const [newIds, setNewIds]           = useState<Set<string>>(new Set())
  const [memberCount, setMemberCount] = useState(0)
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError]     = useState<string | null>(null)
  const [detailLoad, setDetailLoad]   = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  useEffect(() => {
    const f = requestAnimationFrame(() => setAnimate(true))
    return () => cancelAnimationFrame(f)
  }, [])

  // ── Ticker — keeps relative timestamps fresh ────────────────
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  // ── Load fundraiser list on mount ───────────────────────────
  useEffect(() => {
    let mounted = true

    async function load() {
      if (!user) { navigate('/real-login', { replace: true }); return }

      const { data, error } = await supabase
        .from('fundraisers')
        .select('id, name, organization, goal_amount, raised_amount, bag_count, percent_to_cause, status, start_date, end_date, city')
        .in('status', ['active', 'expired', 'completed'])
        .order('created_at', { ascending: false })

      if (!mounted) return
      if (error) { setListError(error.message); setListLoading(false); return }

      const list = (data ?? []) as Fundraiser[]
      setFundraisers(list)
      if (list.length > 0) setSelectedFid(list[0].id)
      setListLoading(false)
    }

    load()
    return () => { mounted = false }
  }, [navigate])

  // ── Load contributions + member count when selected FID changes ──
  useEffect(() => {
    if (!selectedFid) return
    let mounted = true
    setDetailLoad(true)
    setDetailError(null)
    setContribs([])
    setMemberCount(0)
    setNewIds(new Set())

    const CONTRIB_SELECT = 'id, type, amount, bag_id, contributor_id, created_at, notes, contributor:profiles!fundraiser_contributions_contributor_id_fkey(full_name)'

    async function loadDetail() {
      const [cRes, mRes] = await Promise.all([
        supabase
          .from('fundraiser_contributions')
          .select(CONTRIB_SELECT)
          .eq('fundraiser_id', selectedFid)
          .order('created_at', { ascending: false })
          .limit(200),
        supabase
          .from('fundraiser_members')
          .select('id', { count: 'exact', head: true })
          .eq('fundraiser_id', selectedFid),
      ])

      if (!mounted) return
      if (cRes.error) setDetailError(`${cRes.error.message}`)
      else setContribs((cRes.data ?? []) as unknown as RawContrib[])
      setMemberCount(mRes.count ?? 0)
      setDetailLoad(false)
    }

    loadDetail()

    // Realtime — prepend new inserts to the feed instantly
    const channel = supabase
      .channel(`fd-feed-${selectedFid}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'fundraiser_contributions', filter: `fundraiser_id=eq.${selectedFid}` },
        async (payload) => {
          if (!mounted) return
          const { data } = await supabase
            .from('fundraiser_contributions')
            .select(CONTRIB_SELECT)
            .eq('id', (payload.new as { id: string }).id)
            .single()
          if (!mounted || !data) return
          const row = data as unknown as RawContrib
          setContribs(prev => [row, ...prev])
          setNewIds(prev => new Set([...prev, row.id]))
          setTimeout(() => {
            setNewIds(prev => { const s = new Set(prev); s.delete(row.id); return s })
          }, 3000)
        }
      )
      .subscribe()

    return () => {
      mounted = false
      supabase.removeChannel(channel)
    }
  }, [selectedFid])

  // ── Aggregates (computed from contributions) ────────────────
  const fundraiser  = fundraisers.find(f => f.id === selectedFid) ?? null
  const cashTotal   = contributions.filter(c => c.type === 'cash').reduce((s, c) => s + c.amount, 0)
  const bagTotal    = contributions.filter(c => c.type === 'bag').reduce((s, c) => s + c.amount, 0)
  const bagsCount   = contributions.filter(c => c.type === 'bag' || c.bag_id !== null).length
  const totalCount  = contributions.length
  const pct         = fundraiser && fundraiser.goal_amount > 0
    ? Math.min(100, Math.round((fundraiser.raised_amount / fundraiser.goal_amount) * 100))
    : 0
  const recentContribs = contributions.slice(0, 10)

  const topContribs: TopContrib[] = (() => {
    const map = new Map<string, TopContrib>()
    for (const c of contributions) {
      const key = c.contributor_id ?? '__anon__'
      const existing = map.get(key) ?? {
        cid: key, name: displayName(c), total: 0, count: 0, cash: 0, bags: 0, bagCount: 0,
      }
      existing.total += c.amount
      existing.count += 1
      if (c.type === 'cash') existing.cash += c.amount
      if (c.type === 'bag')  { existing.bags += c.amount; existing.bagCount += 1 }
      map.set(key, existing)
    }
    return [...map.values()].sort((a, b) => b.total - a.total).slice(0, 5)
  })()

  const dailyData: DayData[] = (() => {
    const map = new Map<string, DayData>()
    for (const c of contributions) {
      const key      = c.created_at.split('T')[0]
      const existing = map.get(key) ?? { fullDate: key, date: fmtShortDate(key), cash: 0, bags: 0, total: 0, count: 0 }
      existing.total += c.amount
      existing.count += 1
      if (c.type === 'cash') existing.cash += c.amount
      if (c.type === 'bag')  existing.bags += c.amount
      map.set(key, existing)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v)
  })()

  const chartDays       = dailyData.slice(-30)
  const maxDayTotal     = Math.max(...chartDays.map(d => d.total), 0.01)
  const bestDay         = dailyData.length > 0 ? dailyData.reduce((b, d) => d.total > b.total ? d : b) : null
  const totalDaysActive = dailyData.length
  const avgDaily        = totalDaysActive > 0 ? dailyData.reduce((s, d) => s + d.total, 0) / totalDaysActive : 0

  const fade = (d = 0): React.CSSProperties => ({
    opacity:    animate ? 1 : 0,
    transform:  animate ? 'translateY(0)' : 'translateY(14px)',
    transition: `opacity 0.4s ease ${d}ms, transform 0.4s ease ${d}ms`,
  })

  const MEDALS = ['🥇', '🥈', '🥉']

  return (
    <div
      className="relative min-h-screen flex flex-col overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}
    >
      <style>{`
        @keyframes spinFDB   { to { transform: rotate(360deg); } }
        @keyframes fdFeedIn  { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes livePulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>
      <div className="pointer-events-none absolute inset-0 grid-bg" />
      <div className="pointer-events-none absolute" style={{ top: -80, left: -60, width: 300, height: 300, background: 'rgba(74,222,128,0.12)', filter: 'blur(80px)', borderRadius: '50%' }} />
      <div className="pointer-events-none absolute" style={{ bottom: -60, right: -40, width: 250, height: 250, background: 'rgba(0,200,255,0.08)', filter: 'blur(70px)', borderRadius: '50%' }} />

      {/* Header */}
      <header
        className="relative flex items-center justify-between px-4 py-3"
        style={{ background: 'rgba(4,10,24,0.92)', borderBottom: '1px solid rgba(0,200,255,0.12)', backdropFilter: 'blur(12px)', zIndex: 2 }}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl font-extrabold" style={{ color: '#00c8ff' }}>Cyan&#39;s Brooklynn</span>
          <span style={{ color: 'rgba(0,200,255,0.3)' }}>|</span>
          <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>Fundraiser Dashboard</span>
        </div>
        <Link to="/live-fundraisers" className="text-sm transition-opacity hover:opacity-70" style={{ color: 'rgba(255,255,255,0.4)' }}>
          ← Fundraisers
        </Link>
      </header>

      <div className="relative flex-1 overflow-y-auto pb-24" style={{ zIndex: 1 }}>
        <div className="max-w-[640px] mx-auto px-4 pt-8">

          {/* Heading */}
          <div className="mb-6" style={fade(0)}>
            <span
              className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest mb-3 inline-block"
              style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80' }}
            >
              Live Mode
            </span>
            <h1 className="text-2xl font-extrabold mb-1" style={{ color: '#ffffff' }}>Fundraiser Dashboard</h1>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>Real-time performance from Supabase.</p>
          </div>

          {/* List loading */}
          {listLoading && (
            <div className="flex items-center gap-3 py-12 justify-center">
              <span className="w-5 h-5 rounded-full border-2" style={{ borderColor: 'rgba(74,222,128,0.2)', borderTopColor: '#4ade80', animation: 'spinFDB 0.7s linear infinite' }} />
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Loading fundraisers…</span>
            </div>
          )}

          {/* List error */}
          {!listLoading && listError && (
            <div className="rounded-xl px-4 py-3 mb-4 text-sm" style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }}>
              {listError}
            </div>
          )}

          {/* Empty */}
          {!listLoading && !listError && fundraisers.length === 0 && (
            <div className="rounded-2xl p-10 text-center mb-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ fontSize: 40, display: 'block', marginBottom: 12 }}>📊</span>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)' }}>No fundraisers found.</p>
            </div>
          )}

          {!listLoading && fundraisers.length > 0 && (
            <>
              {/* Fundraiser selector — only shown when multiple exist */}
              {fundraisers.length > 1 && (
                <div className="mb-5" style={fade(60)}>
                  <label className="block text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    Select Fundraiser
                  </label>
                  <div className="relative">
                    <select
                      value={selectedFid}
                      onChange={e => setSelectedFid(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl text-sm font-semibold outline-none appearance-none"
                      style={{
                        background: 'rgba(255,255,255,0.06)',
                        border:     '1px solid rgba(0,200,255,0.25)',
                        color:      '#ffffff',
                        cursor:     'pointer',
                      }}
                    >
                      {fundraisers.map(f => (
                        <option key={f.id} value={f.id} style={{ background: '#0a1530' }}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                    <span
                      className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2"
                      style={{ color: 'rgba(0,200,255,0.5)', fontSize: 10 }}
                    >▼</span>
                  </div>
                </div>
              )}

              {/* Detail loading */}
              {detailLoad && (
                <div className="flex items-center gap-2 py-8 justify-center">
                  <span className="w-4 h-4 rounded-full border-2" style={{ borderColor: 'rgba(0,200,255,0.2)', borderTopColor: '#00c8ff', animation: 'spinFDB 0.7s linear infinite' }} />
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Loading stats…</span>
                </div>
              )}

              {!detailLoad && detailError && (
                <div className="rounded-xl px-4 py-3 mb-4 text-sm" style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }}>
                  {detailError}
                </div>
              )}

              {!detailLoad && fundraiser && (
                <>
                  {/* ── Campaign card ─────────────────────────────────── */}
                  <div className="rounded-2xl p-5 mb-4" style={{ background: 'rgba(0,87,231,0.1)', border: '1px solid rgba(0,200,255,0.22)', ...fade(80) }}>
                    <p style={{ fontSize: 18, fontWeight: 800, color: '#ffffff', marginBottom: 2 }}>{fundraiser.name}</p>
                    {fundraiser.organization && (
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 14 }}>{fundraiser.organization}</p>
                    )}

                    {/* Progress bar */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-1.5">
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>Progress toward goal</span>
                        <span style={{ fontSize: 14, fontWeight: 800, color: '#4ade80' }}>{pct}%</span>
                      </div>
                      <div style={{ height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 8, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', width: `${pct}%`,
                          background: 'linear-gradient(90deg, #0057e7, #00c8ff 60%, #4ade80)',
                          borderRadius: 8, transition: 'width 0.8s ease',
                        }} />
                      </div>
                      <div className="flex justify-between mt-1.5">
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                          Raised <strong style={{ color: '#4ade80' }}>{fmtAmt(fundraiser.raised_amount)}</strong>
                        </span>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                          Goal {fmtAmt(fundraiser.goal_amount)}
                        </span>
                      </div>
                    </div>

                    {/* Quick meta row */}
                    <div className="flex flex-wrap gap-x-5 gap-y-1">
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                        📦 <strong style={{ color: '#ffffff' }}>{fundraiser.bag_count}</strong> bags
                      </span>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                        👥 <strong style={{ color: '#ffffff' }}>{memberCount}</strong> members
                      </span>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                        💚 <strong style={{ color: '#ffffff' }}>{fundraiser.percent_to_cause}%</strong> to cause
                      </span>
                      <span
                        className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide"
                        style={{
                          background: fundraiser.status === 'active' ? 'rgba(74,222,128,0.12)' : 'rgba(148,163,184,0.1)',
                          border:     fundraiser.status === 'active' ? '1px solid rgba(74,222,128,0.3)' : '1px solid rgba(148,163,184,0.25)',
                          color:      fundraiser.status === 'active' ? '#4ade80' : '#94a3b8',
                        }}
                      >
                        {fundraiser.status}
                      </span>
                    </div>
                  </div>

                  {/* ── Stats grid ────────────────────────────────────── */}
                  <div className="grid grid-cols-2 gap-3 mb-4" style={fade(120)}>
                    {[
                      { icon: '📊', label: 'Total Contributions', value: totalCount.toString(),                  color: '#ffffff'  },
                      { icon: '👥', label: 'Members Joined',      value: memberCount.toString(),                  color: '#ffffff'  },
                      { icon: '💰', label: 'Cash Donated',        value: fmtAmt(cashTotal),                       color: '#4ade80'  },
                      { icon: '♻️', label: 'Recycling Value',     value: `${fmtAmt(bagTotal)}`,                   color: '#00c8ff'  },
                      { icon: '📦', label: 'Bags Donated',        value: bagsCount.toString(),                    color: '#5eead4'  },
                      { icon: '💵', label: 'Total Raised',        value: fmtAmt(fundraiser.raised_amount),        color: '#fbbf24'  },
                    ].map(s => (
                      <div
                        key={s.label}
                        className="rounded-2xl p-4"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                      >
                        <p style={{ fontSize: 20, marginBottom: 6 }}>{s.icon}</p>
                        <p style={{ fontSize: 18, fontWeight: 800, color: s.color, marginBottom: 4, lineHeight: 1 }}>{s.value}</p>
                        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* No contributions empty state */}
                  {totalCount === 0 && (
                    <div className="rounded-2xl p-8 text-center mb-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', ...fade(160) }}>
                      <span style={{ fontSize: 36, display: 'block', marginBottom: 10 }}>📭</span>
                      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>No contributions recorded yet.</p>
                    </div>
                  )}

                  {/* ── Donations Over Time ──────────────────────────── */}
                  <div className="mb-4" style={fade(155)}>
                    <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>

                      {/* Header row */}
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>
                          Donations Over Time
                        </p>
                        {dailyData.length > 0 && (
                          <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1 text-[9px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                              <span style={{ width: 8, height: 8, borderRadius: 2, background: 'rgba(74,222,128,0.85)', flexShrink: 0, display: 'inline-block' }} />
                              Cash
                            </span>
                            <span className="flex items-center gap-1 text-[9px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                              <span style={{ width: 8, height: 8, borderRadius: 2, background: 'rgba(0,200,255,0.85)', flexShrink: 0, display: 'inline-block' }} />
                              Recycling
                            </span>
                          </div>
                        )}
                      </div>

                      {dailyData.length === 0 ? (
                        <div className="py-8 text-center">
                          <span style={{ fontSize: 32, display: 'block', marginBottom: 10 }}>📈</span>
                          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                            Donation trends will appear after contributions are recorded.
                          </p>
                        </div>
                      ) : (
                        <>
                          {/* Summary stats */}
                          <div className="grid grid-cols-3 gap-2 mb-5">
                            {([
                              { label: 'Best Day',   value: fmtAmt(bestDay!.total), sub: bestDay!.date },
                              { label: 'Days Active', value: String(totalDaysActive),  sub: null },
                              { label: 'Avg / Day',  value: fmtAmt(avgDaily),         sub: null },
                            ] as { label: string; value: string; sub: string | null }[]).map(s => (
                              <div
                                key={s.label}
                                className="rounded-xl p-3 text-center"
                                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                              >
                                <p style={{ fontSize: 14, fontWeight: 800, color: '#00c8ff', marginBottom: 2, lineHeight: 1 }}>{s.value}</p>
                                {s.sub && <p style={{ fontSize: 9, color: '#4ade80', marginBottom: 2 }}>{s.sub}</p>}
                                <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</p>
                              </div>
                            ))}
                          </div>

                          {/* Bar chart — scrolls horizontally on mobile */}
                          <div className="overflow-x-auto" style={{ marginLeft: -4, marginRight: -4 }}>
                            <div className="flex items-end gap-1.5 px-1 pb-1" style={{ minWidth: 'max-content' }}>
                              {chartDays.map(d => {
                                const BAR_H  = 100
                                const cashH  = (d.cash  / maxDayTotal) * BAR_H
                                const bagsH  = (d.bags  / maxDayTotal) * BAR_H
                                const otherH = Math.max(0, ((d.total - d.cash - d.bags) / maxDayTotal) * BAR_H)
                                return (
                                  <div key={d.fullDate} className="flex flex-col items-center gap-1" style={{ minWidth: 40 }}>
                                    {/* Amount above bar */}
                                    <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.38)', whiteSpace: 'nowrap' }}>
                                      {fmtAmt(d.total)}
                                    </span>
                                    {/* Stacked bar — column-reverse so first child sits at bottom */}
                                    <div style={{ width: 28, height: BAR_H, display: 'flex', flexDirection: 'column-reverse', background: 'rgba(255,255,255,0.04)', borderRadius: 6, overflow: 'hidden' }}>
                                      <div style={{ width: '100%', flexShrink: 0, height: animate ? `${cashH}px` : 0, background: 'linear-gradient(180deg,rgba(74,222,128,0.9),rgba(74,222,128,0.55))', transition: 'height 0.8s ease 0.2s' }} />
                                      <div style={{ width: '100%', flexShrink: 0, height: animate ? `${bagsH}px` : 0, background: 'linear-gradient(180deg,rgba(0,200,255,0.9),rgba(0,200,255,0.55))', transition: 'height 0.8s ease 0.2s' }} />
                                      {otherH > 0.5 && (
                                        <div style={{ width: '100%', flexShrink: 0, height: animate ? `${otherH}px` : 0, background: 'rgba(255,255,255,0.18)', transition: 'height 0.8s ease 0.2s' }} />
                                      )}
                                    </div>
                                    {/* Date label */}
                                    <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap' }}>
                                      {d.date}
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* ── Activity Feed ────────────────────────────────── */}
                  {recentContribs.length > 0 && (
                    <div className="mb-4" style={fade(160)}>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>
                          Recent Activity
                        </p>
                        <span
                          className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide"
                          style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80' }}
                        >
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#4ade80', display: 'inline-block', animation: 'livePulse 1.5s ease-in-out infinite' }} />
                          Live
                        </span>
                      </div>
                      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                        {recentContribs.map((c, i) => {
                          const isNew = newIds.has(c.id)
                          return (
                            <div
                              key={c.id}
                              className="flex items-center gap-3 px-4 py-3"
                              style={{
                                background:   isNew ? 'rgba(74,222,128,0.07)' : i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.015)',
                                borderBottom: i < recentContribs.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                                transition:   'background 1.5s ease',
                                animation:    isNew ? 'fdFeedIn 0.35s ease' : undefined,
                              }}
                            >
                              {/* Type icon */}
                              <span
                                className="flex items-center justify-center w-8 h-8 rounded-full shrink-0 text-sm"
                                style={{ background: typeBg(c.type), border: `1px solid ${typeBorder(c.type)}` }}
                              >
                                {typeIcon(c.type)}
                              </span>
                              {/* Message + timestamp */}
                              <div className="flex-1 min-w-0">
                                <p style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.85)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  <span style={{ fontWeight: 700, color: typeColor(c.type) }}>{displayName(c)}</span>
                                  {' '}
                                  <span>{activityText(c)}</span>
                                </p>
                                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.32)', marginTop: 2 }}>
                                  {timeAgo(c.created_at, now)}
                                </p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* ── Top Contributors Leaderboard ─────────────────── */}
                  <div className="mb-6" style={fade(200)}>
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      Top Contributors
                    </p>

                    {topContribs.length === 0 ? (
                      <div className="rounded-2xl p-8 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <span style={{ fontSize: 32, display: 'block', marginBottom: 10 }}>🏆</span>
                        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                          Top contributors will appear after donations are recorded.
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {topContribs.map((c, i) => {
                          const medal   = i < 3 ? MEDALS[i] : null
                          const isFirst = i === 0
                          return (
                            <div
                              key={c.cid}
                              className="rounded-2xl p-4"
                              style={{
                                background: isFirst
                                  ? 'linear-gradient(135deg, rgba(251,191,36,0.1) 0%, rgba(251,191,36,0.04) 100%)'
                                  : 'rgba(255,255,255,0.04)',
                                border:    isFirst
                                  ? '1px solid rgba(251,191,36,0.4)'
                                  : '1px solid rgba(255,255,255,0.08)',
                                boxShadow: isFirst
                                  ? '0 0 28px rgba(251,191,36,0.1), inset 0 1px 0 rgba(251,191,36,0.15)'
                                  : 'none',
                              }}
                            >
                              {/* Name row */}
                              <div className="flex items-center gap-3 mb-2.5">
                                {medal ? (
                                  <span style={{ fontSize: 24, lineHeight: 1, flexShrink: 0 }}>{medal}</span>
                                ) : (
                                  <span
                                    className="flex items-center justify-center w-7 h-7 rounded-full shrink-0 text-[11px] font-bold"
                                    style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.45)' }}
                                  >
                                    {i + 1}
                                  </span>
                                )}
                                <p
                                  className="flex-1 min-w-0 font-bold"
                                  style={{ fontSize: 14, color: isFirst ? '#fbbf24' : '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                >
                                  {c.name}
                                </p>
                                <p style={{ fontSize: 17, fontWeight: 800, color: isFirst ? '#fbbf24' : '#4ade80', flexShrink: 0 }}>
                                  {fmtAmt(c.total)}
                                </p>
                              </div>

                              {/* Breakdown row */}
                              <div className="flex flex-wrap gap-x-4 gap-y-1" style={{ paddingLeft: 36 }}>
                                {c.cash > 0 && (
                                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>
                                    💰 <span style={{ color: '#4ade80', fontWeight: 600 }}>{fmtAmt(c.cash)}</span> cash
                                  </span>
                                )}
                                {c.bags > 0 && (
                                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>
                                    ♻️ <span style={{ color: '#00c8ff', fontWeight: 600 }}>{fmtAmt(c.bags)}</span> recycling
                                  </span>
                                )}
                                {c.bagCount > 0 && (
                                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>
                                    📦 <span style={{ color: '#5eead4', fontWeight: 600 }}>{c.bagCount}</span> bag{c.bagCount !== 1 ? 's' : ''}
                                  </span>
                                )}
                                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)' }}>
                                  {c.count} contribution{c.count !== 1 ? 's' : ''}
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* ── City Impact ──────────────────────────────────── */}
                  {(() => {
                    const city      = fundraiser.city ?? 'Nashville'
                    const co2Saved  = fundraiser.bag_count * 4.2
                    const GOAL_BAGS = 10_000
                    const goalPct   = Math.min(100, Math.round((fundraiser.bag_count / GOAL_BAGS) * 100))

                    const cityCards = [
                      { icon: '🌆', label: 'City',            value: `${city}, TN`,             color: '#00c8ff' },
                      { icon: '🏭', label: 'Warehouse',       value: 'NASH-01',                  color: '#00c8ff' },
                      { icon: '📦', label: 'Bags Donated',    value: String(fundraiser.bag_count), color: '#5eead4' },
                      { icon: '♻️', label: 'Recycling Value', value: fmtAmt(bagTotal),            color: '#00c8ff' },
                      { icon: '💰', label: 'Cash Donations',  value: fmtAmt(cashTotal),           color: '#4ade80' },
                      { icon: '🌱', label: 'CO₂ Saved',       value: `${co2Saved.toFixed(1)} lbs`, color: '#4ade80' },
                    ]

                    return (
                      <div className="mb-4" style={fade(220)}>
                        <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                          City Impact
                        </p>
                        <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.35)' }}>
                          See how this fundraiser contributes to {city}'s recycling goals.
                        </p>

                        {/* Stat cards */}
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          {cityCards.map(card => (
                            <div
                              key={card.label}
                              className="rounded-xl p-3"
                              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                            >
                              <span style={{ fontSize: 16, display: 'block', marginBottom: 4 }}>{card.icon}</span>
                              <p style={{ fontSize: 13, fontWeight: 700, color: card.color, marginBottom: 2, lineHeight: 1.2 }}>{card.value}</p>
                              <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{card.label}</p>
                            </div>
                          ))}
                        </div>

                        {/* Community Recycling Goal */}
                        <div className="rounded-2xl p-4 mb-3" style={{ background: 'rgba(0,200,255,0.06)', border: '1px solid rgba(0,200,255,0.18)' }}>
                          <p style={{ fontSize: 12, fontWeight: 700, color: '#ffffff', marginBottom: 10 }}>
                            Community Recycling Goal
                          </p>
                          <div className="flex items-center justify-between mb-2">
                            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
                              Goal: <strong style={{ color: '#00c8ff' }}>10,000 bags</strong>
                            </span>
                            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
                              Current: <strong style={{ color: '#4ade80' }}>{fundraiser.bag_count.toLocaleString()}</strong>
                            </span>
                          </div>
                          <div style={{ height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 8, overflow: 'hidden', marginBottom: 6 }}>
                            <div style={{
                              height: '100%', width: `${animate ? goalPct : 0}%`,
                              background: 'linear-gradient(90deg, #00c8ff, #4ade80)',
                              borderRadius: 8, transition: 'width 1s ease 0.3s',
                            }} />
                          </div>
                          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
                            {goalPct}% of community goal · {(GOAL_BAGS - fundraiser.bag_count).toLocaleString()} bags remaining
                          </p>
                        </div>

                        {/* Insight card */}
                        <div className="rounded-2xl px-4 py-3" style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)' }}>
                          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
                            💡 This fundraiser is helping <span style={{ color: '#4ade80', fontWeight: 600 }}>{city}</span> increase recycling participation while raising money for local programs.
                          </p>
                        </div>
                      </div>
                    )
                  })()}
                </>
              )}
            </>
          )}

          {/* ── Action buttons ──────────────────────────────────── */}
          <div className="flex flex-col gap-2" style={fade(240)}>
            <div className="grid grid-cols-2 gap-2">
              <Link
                to="/live-scan"
                className="flex items-center justify-center gap-1.5 py-3 rounded-xl text-xs font-bold transition-all hover:brightness-110"
                style={{ background: 'linear-gradient(135deg, rgba(0,87,231,0.3), rgba(0,200,255,0.15))', border: '1px solid rgba(0,200,255,0.3)', color: '#00c8ff', textDecoration: 'none' }}
              >
                ♻️ Scan Bags
              </Link>
              <Link
                to="/live-notifications"
                className="flex items-center justify-center gap-1.5 py-3 rounded-xl text-xs font-bold transition-all hover:brightness-110"
                style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', color: '#fbbf24', textDecoration: 'none' }}
              >
                🔔 Notifications
              </Link>
            </div>
            <Link
              to="/live-fundraisers"
              className="w-full flex items-center justify-center py-3 rounded-2xl text-sm font-medium transition-all hover:brightness-110"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}
            >
              ← Back to Live Fundraisers
            </Link>
          </div>

        </div>
      </div>
    </div>
  )
}
