// AnalyticsSection.tsx — AI Analytics Intelligence
// BayKid AI Marketing Center
//
// Tabs: Overview · Platform Breakdown · Content Performance · Hashtags ·
//       Best Times · Campaigns · AI Insights

import { useState, useMemo, useRef, useEffect } from 'react'
import { generateAIContent } from '../../../lib/aiMarketing'
import type { Platform } from '../../../lib/aiMarketing'
import {
  generateTimeSeries,
  buildCombinedSeries,
  buildChartData,
  getPlatformSummaries,
  getTopPosts,
  getLowPosts,
  HASHTAG_PERF,
  getTopTimeSlots,
  getBestTimesMatrix,
  CAMPAIGNS,
  getPredictedEngagement,
  getAlerts,
  PLATFORM_META,
  fmtNum,
  pctChange,
  sumMetric,
  avgMetric,
  type ChartPeriod,
  type PlatformSummary,
  type Campaign,
} from '../../../lib/analyticsData'

// ── Style helpers ──────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  color: '#fff', borderRadius: 8, padding: '7px 12px',
  fontSize: 12, outline: 'none', boxSizing: 'border-box',
}

function ghostBtn(o?: React.CSSProperties): React.CSSProperties {
  return {
    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)',
    color: 'rgba(255,255,255,0.65)', borderRadius: 8, padding: '6px 12px',
    fontWeight: 600, fontSize: 11, cursor: 'pointer', ...o,
  }
}

function card(o?: React.CSSProperties): React.CSSProperties {
  return {
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14, ...o,
  }
}

// ── Sub-tab types ──────────────────────────────────────────────────────────────

type AnalyticsTab = 'overview' | 'platforms' | 'content' | 'hashtags' | 'times' | 'campaigns' | 'ai'

// ── Helpers ────────────────────────────────────────────────────────────────────

function trendLabel(pct: number) {
  const color = pct >= 0 ? '#22c55e' : '#f87171'
  const arrow = pct >= 0 ? '↑' : '↓'
  return <span style={{ color, fontWeight: 700, fontSize: 11 }}>{arrow}{Math.abs(pct).toFixed(1)}%</span>
}

function pctLabel(rate: number) {
  return (rate * 100).toFixed(1) + '%'
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Spark-line (pure SVG, zero dependencies) ──────────────────────────────────

function Sparkline({ values, color = '#00c8ff', height = 36, width = 120 }: {
  values: number[]; color?: string; height?: number; width?: number
}) {
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width
    const y = height - ((v - min) / range) * (height - 4) - 2
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1].split(',')[0]} cy={pts[pts.length - 1].split(',')[1]} r={2.5} fill={color} />
    </svg>
  )
}

// ── Bar chart (pure SVG) ───────────────────────────────────────────────────────

interface BarChartProps {
  data:     Array<{ label: string; value: number }>
  color?:   string
  height?:  number
  maxBars?: number
}

function BarChart({ data, color = '#00c8ff', height = 120, maxBars = 30 }: BarChartProps) {
  const visible = data.slice(-maxBars)
  const max = Math.max(...visible.map((d) => d.value), 1)
  const barW = Math.max(2, Math.floor(560 / visible.length) - 2)
  const totalW = visible.length * (barW + 2)

  // Only show labels every N bars to avoid crowding
  const labelStep = Math.ceil(visible.length / 7)

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={Math.max(560, totalW)} height={height + 28} style={{ display: 'block' }}>
        {visible.map((d, i) => {
          const barH = Math.max(2, (d.value / max) * height)
          const x = i * (barW + 2)
          const y = height - barH
          const showLabel = i % labelStep === 0 || i === visible.length - 1
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={barH} rx={2} fill={color} opacity={0.75} />
              {showLabel && (
                <text x={x + barW / 2} y={height + 16} textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize={9}>
                  {d.label}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ── Multi-line chart (pure SVG) ────────────────────────────────────────────────

interface LineChartProps {
  data:    Array<{ label: string; [key: string]: number | string }>
  lines:   Array<{ key: string; color: string; label: string }>
  height?: number
}

function LineChart({ data, lines, height = 140 }: LineChartProps) {
  const W = 560
  if (data.length < 2) return <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, padding: 20 }}>Not enough data</div>

  const allVals = data.flatMap((d) => lines.map((l) => Number(d[l.key]) || 0))
  const max = Math.max(...allVals, 1)
  const labelStep = Math.ceil(data.length / 7)

  const path = (key: string) =>
    data.map((d, i) => {
      const x = (i / (data.length - 1)) * W
      const y = height - (Number(d[key]) / max) * (height - 8) - 4
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    }).join(' ')

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={W} height={height + 32} style={{ display: 'block' }}>
        {/* Grid lines */}
        {[0.25, 0.5, 0.75, 1].map((t) => (
          <line key={t} x1={0} y1={(height - t * (height - 8) - 4)} x2={W} y2={(height - t * (height - 8) - 4)}
            stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
        ))}
        {/* Lines */}
        {lines.map((l) => (
          <path key={l.key} d={path(l.key)} fill="none" stroke={l.color} strokeWidth={2}
            strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {/* Dots at last point */}
        {lines.map((l) => {
          const last = data[data.length - 1]
          const x = W
          const y = height - (Number(last[l.key]) / max) * (height - 8) - 4
          return <circle key={l.key} cx={x} cy={y} r={3} fill={l.color} />
        })}
        {/* X axis labels */}
        {data.map((d, i) => {
          if (i % labelStep !== 0 && i !== data.length - 1) return null
          const x = (i / (data.length - 1)) * W
          return (
            <text key={i} x={x} y={height + 16} textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize={9}>
              {d.label}
            </text>
          )
        })}
      </svg>
    </div>
  )
}

// ── Heat map (best times) ──────────────────────────────────────────────────────

function HeatMap() {
  const matrix = getBestTimesMatrix()
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
  const hours = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]

  function scoreColor(score: number) {
    if (score >= 85) return '#22c55e'
    if (score >= 70) return '#86efac'
    if (score >= 50) return '#fbbf24'
    if (score >= 30) return 'rgba(251,191,36,0.3)'
    return 'rgba(255,255,255,0.04)'
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: `48px repeat(${days.length}, 1fr)`, gap: 2, minWidth: 420 }}>
        {/* Header */}
        <div />
        {days.map((d) => (
          <div key={d} style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 700, textAlign: 'center', padding: '3px 0' }}>{d}</div>
        ))}
        {/* Rows */}
        {hours.map((hour) => {
          const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
          const ampm = hour < 12 ? 'a' : 'p'
          return [
            <div key={`label-${hour}`} style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, textAlign: 'right', paddingRight: 8, alignSelf: 'center' }}>
              {h12}{ampm}
            </div>,
            ...days.map((_, dayIdx) => {
              const slot = matrix.find((s) => s.hour === hour && s.dayOfWeek === dayIdx)
              const score = slot?.engagementScore ?? 0
              return (
                <div
                  key={`${hour}-${dayIdx}`}
                  title={`${days[dayIdx]} ${h12}${ampm}m — Score: ${score}`}
                  style={{
                    height: 22, borderRadius: 4,
                    background: scoreColor(score),
                    opacity: score > 0 ? 1 : 0.3,
                  }}
                />
              )
            }),
          ]
        })}
      </div>
      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        {[['#22c55e','Best (85+)'],['#86efac','Good (70–84)'],['#fbbf24','Fair (50–69)'],['rgba(255,255,255,0.12)','Low (<50)']].map(([color, label]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 12, height: 12, background: color, borderRadius: 2 }} />
            <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10 }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Stat card ──────────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, trend, color, sub }: {
  icon: string; label: string; value: string; trend?: number
  color: string; sub?: string
}) {
  return (
    <div style={{ ...card({ padding: '16px 18px' }) }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 15 }}>{icon}</span>
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ color, fontWeight: 800, fontSize: 24, lineHeight: 1 }}>{value}</span>
        {trend !== undefined && trendLabel(trend)}
      </div>
      {sub && <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10, marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

// ── Alert banner ───────────────────────────────────────────────────────────────

function AlertBanner() {
  const alerts = getAlerts()
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const visible = alerts.filter((a) => !dismissed.has(a.id))
  if (visible.length === 0) return null

  const colors = { info: '#00c8ff', warn: '#fbbf24', critical: '#f87171' }
  const bgs    = { info: 'rgba(0,200,255,0.06)', warn: 'rgba(251,191,36,0.07)', critical: 'rgba(248,113,113,0.07)' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
      {visible.slice(0, 3).map((a) => (
        <div key={a.id} style={{ background: bgs[a.severity], border: `1px solid ${colors[a.severity]}33`, borderRadius: 10, padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ color: colors[a.severity], fontSize: 13, flexShrink: 0, marginTop: 1 }}>
            {a.severity === 'info' ? 'ℹ️' : a.severity === 'warn' ? '⚠️' : '🚨'}
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ color: '#fff', fontWeight: 600, fontSize: 12 }}>{a.message}</div>
            {a.detail && <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 2 }}>{a.detail}</div>}
          </div>
          <button onClick={() => setDismissed((s) => new Set([...s, a.id]))}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 14, cursor: 'pointer', padding: '0 2px', flexShrink: 0 }}>
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// OVERVIEW TAB
// ══════════════════════════════════════════════════════════════════════════════

function OverviewTab() {
  const [period, setPeriod] = useState<ChartPeriod>('weekly')
  const [metric, setMetric] = useState<'impressions' | 'clicks' | 'shares' | 'saves' | 'comments' | 'followerGrowth' | 'leadConversions'>('impressions')

  const summaries = useMemo(() => getPlatformSummaries(30), [])
  const chartData = useMemo(() => buildCombinedSeries(period), [period])

  const totals = useMemo(() => {
    const s = summaries
    return {
      impressions:    s.reduce((a, x) => a + x.totalImpressions, 0),
      clicks:         s.reduce((a, x) => a + x.totalClicks, 0),
      shares:         s.reduce((a, x) => a + x.totalShares, 0),
      saves:          s.reduce((a, x) => a + x.totalSaves, 0),
      comments:       s.reduce((a, x) => a + x.totalComments, 0),
      followerGrowth: s.reduce((a, x) => a + x.followerGrowth, 0),
      leads:          s.reduce((a, x) => a + x.leadConversions, 0),
      avgEngagement:  s.reduce((a, x) => a + x.avgEngagement, 0) / s.length,
      trendAvg:       s.reduce((a, x) => a + x.trendPct, 0) / s.length,
    }
  }, [summaries])

  const metricOptions = [
    { key: 'impressions',    label: 'Impressions',     color: '#00c8ff' },
    { key: 'clicks',         label: 'Clicks',          color: '#22c55e' },
    { key: 'shares',         label: 'Shares',          color: '#a855f7' },
    { key: 'saves',          label: 'Saves',           color: '#fbbf24' },
    { key: 'comments',       label: 'Comments',        color: '#fb923c' },
    { key: 'followerGrowth', label: 'Follower Growth', color: '#e1306c' },
    { key: 'leadConversions',label: 'Lead Conversions',color: '#10b981' },
  ] as const

  const activeMetric = metricOptions.find((m) => m.key === metric)!
  const barData = chartData.map((d) => ({ label: d.label, value: (d as Record<string, number | string>)[metric] as number }))

  return (
    <div>
      <AlertBanner />

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 24 }}>
        <StatCard icon="📡" label="Total Reach"        value={fmtNum(totals.impressions)} trend={totals.trendAvg}  color="#00c8ff" sub="30-day impressions" />
        <StatCard icon="💚" label="Avg Engagement"     value={pctLabel(totals.avgEngagement)} color="#22c55e" sub="across all platforms" />
        <StatCard icon="👥" label="Follower Growth"    value={`+${fmtNum(totals.followerGrowth)}`} color="#a855f7" sub="net new this month" />
        <StatCard icon="🎯" label="Lead Conversions"   value={String(totals.leads)} color="#fbbf24" sub="social → lead pipeline" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 24 }}>
        <StatCard icon="🔗" label="Total Clicks"   value={fmtNum(totals.clicks)}   color="#22c55e" />
        <StatCard icon="↗️" label="Total Shares"   value={fmtNum(totals.shares)}   color="#a855f7" />
        <StatCard icon="🔖" label="Total Saves"    value={fmtNum(totals.saves)}    color="#fbbf24" />
        <StatCard icon="💬" label="Total Comments" value={fmtNum(totals.comments)} color="#fb923c" />
      </div>

      {/* Chart */}
      <div style={{ ...card({ padding: '18px 20px', marginBottom: 24 }) }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>📊 Performance Over Time</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Metric selector */}
            <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.25)', borderRadius: 8, padding: 3 }}>
              {metricOptions.map((m) => (
                <button key={m.key} onClick={() => setMetric(m.key)}
                  style={{ padding: '4px 10px', borderRadius: 5, border: 'none', background: metric === m.key ? 'rgba(0,200,255,0.18)' : 'transparent', color: metric === m.key ? '#00c8ff' : 'rgba(255,255,255,0.4)', fontWeight: metric === m.key ? 700 : 500, fontSize: 10, cursor: 'pointer' }}>
                  {m.label}
                </button>
              ))}
            </div>
            {/* Period selector */}
            <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.25)', borderRadius: 8, padding: 3 }}>
              {(['daily','weekly','monthly'] as ChartPeriod[]).map((p) => (
                <button key={p} onClick={() => setPeriod(p)}
                  style={{ padding: '4px 10px', borderRadius: 5, border: 'none', background: period === p ? 'rgba(0,200,255,0.18)' : 'transparent', color: period === p ? '#00c8ff' : 'rgba(255,255,255,0.4)', fontWeight: period === p ? 700 : 500, fontSize: 11, cursor: 'pointer', textTransform: 'capitalize' }}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>
        <BarChart data={barData} color={activeMetric.color} height={130} maxBars={period === 'daily' ? 30 : period === 'weekly' ? 12 : 6} />
      </div>

      {/* Platform mini-cards */}
      <div style={{ ...card({ padding: '16px 20px' }) }}>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 13, marginBottom: 14 }}>Platform Quick View</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {summaries.map((s) => {
            const meta = PLATFORM_META[s.platform]
            const spark30 = generateTimeSeries(s.platform, 30).map((d) => d.impressions)
            return (
              <div key={s.platform} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 80px 80px 80px 80px 80px', gap: 8, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 14 }}>{meta.icon}</span>
                  <span style={{ color: '#fff', fontSize: 12, fontWeight: 600, textTransform: 'capitalize' }}>{s.platform}</span>
                </div>
                <div><Sparkline values={spark30} color={meta.color} /></div>
                <div style={{ color: '#fff', fontSize: 12, fontWeight: 600, textAlign: 'right' }}>{fmtNum(s.totalImpressions)}</div>
                <div style={{ color: '#22c55e', fontSize: 12, textAlign: 'right' }}>{pctLabel(s.avgEngagement)}</div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, textAlign: 'right' }}>{fmtNum(s.totalClicks)}</div>
                <div style={{ color: s.followerGrowth >= 0 ? '#22c55e' : '#f87171', fontSize: 12, textAlign: 'right', fontWeight: 700 }}>
                  {s.followerGrowth >= 0 ? '+' : ''}{fmtNum(s.followerGrowth)}
                </div>
                <div style={{ textAlign: 'right' }}>{trendLabel(s.trendPct)}</div>
              </div>
            )
          })}
          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 80px 80px 80px 80px 80px', gap: 8, paddingTop: 4 }}>
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9, textTransform: 'uppercase' }} />
            <div />
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9, textAlign: 'right' }}>REACH</div>
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9, textAlign: 'right' }}>ENG.</div>
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9, textAlign: 'right' }}>CLICKS</div>
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9, textAlign: 'right' }}>FOLLOWERS</div>
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9, textAlign: 'right' }}>TREND</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// PLATFORM BREAKDOWN TAB
// ══════════════════════════════════════════════════════════════════════════════

function PlatformTab() {
  const [selected, setSelected] = useState<Platform>('instagram')
  const [period, setPeriod]     = useState<ChartPeriod>('weekly')

  const summaries = useMemo(() => getPlatformSummaries(30), [])
  const summary   = summaries.find((s) => s.platform === selected)!
  const meta      = PLATFORM_META[selected]

  const allDays = useMemo(() => generateTimeSeries(selected, 90), [selected])
  const chartData = useMemo(() => buildChartData(allDays, period), [allDays, period])

  const predictions = useMemo(() => getPredictedEngagement(selected, 14), [selected])

  const metrics = [
    { label: 'Followers',      value: fmtNum(summary.followers),                    color: meta.color  },
    { label: 'Impressions',    value: fmtNum(summary.totalImpressions),              color: '#00c8ff'   },
    { label: 'Avg Engagement', value: pctLabel(summary.avgEngagement),               color: '#22c55e'   },
    { label: 'Clicks',         value: fmtNum(summary.totalClicks),                   color: '#22c55e'   },
    { label: 'Shares',         value: fmtNum(summary.totalShares),                   color: '#a855f7'   },
    { label: 'Saves',          value: fmtNum(summary.totalSaves),                    color: '#fbbf24'   },
    { label: 'Comments',       value: fmtNum(summary.totalComments),                 color: '#fb923c'   },
    { label: 'Follower Growth',value: `${summary.followerGrowth >= 0 ? '+' : ''}${fmtNum(summary.followerGrowth)}`, color: summary.followerGrowth >= 0 ? '#22c55e' : '#f87171' },
    { label: 'Lead Conversions',value: String(summary.leadConversions),              color: '#10b981'   },
  ]

  const lineData = chartData.map((d) => ({
    label: d.label, impressions: d.impressions, clicks: d.clicks,
    shares: d.shares, comments: d.comments, saves: d.saves,
  }))

  return (
    <div>
      {/* Platform selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {(Object.keys(PLATFORM_META).filter((p) => p !== 'youtube') as Platform[]).map((p) => {
          const m = PLATFORM_META[p]
          const active = selected === p
          return (
            <button key={p} onClick={() => setSelected(p)}
              style={{ padding: '8px 16px', borderRadius: 10, border: `1px solid ${active ? m.color : 'rgba(255,255,255,0.1)'}`, background: active ? m.colorBg : 'transparent', color: active ? m.color : 'rgba(255,255,255,0.5)', fontWeight: active ? 700 : 500, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s' }}>
              <span>{m.icon}</span><span style={{ textTransform: 'capitalize' }}>{p}</span>
            </button>
          )
        })}
      </div>

      {/* Metrics grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 20 }}>
        {metrics.map((m) => (
          <div key={m.label} style={{ ...card({ padding: '12px 14px' }) }}>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 600, marginBottom: 4 }}>{m.label}</div>
            <div style={{ color: m.color, fontWeight: 800, fontSize: 20 }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Multi-metric line chart */}
      <div style={{ ...card({ padding: '16px 18px', marginBottom: 20 }) }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 13, textTransform: 'capitalize' }}>
            {meta.icon} {selected} — Engagement Breakdown
          </div>
          <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.25)', borderRadius: 8, padding: 3 }}>
            {(['daily','weekly','monthly'] as ChartPeriod[]).map((p) => (
              <button key={p} onClick={() => setPeriod(p)}
                style={{ padding: '4px 10px', borderRadius: 5, border: 'none', background: period === p ? 'rgba(0,200,255,0.18)' : 'transparent', color: period === p ? '#00c8ff' : 'rgba(255,255,255,0.4)', fontWeight: period === p ? 700 : 500, fontSize: 11, cursor: 'pointer', textTransform: 'capitalize' }}>
                {p}
              </button>
            ))}
          </div>
        </div>
        {/* Legend */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 10, flexWrap: 'wrap' }}>
          {[['Impressions','#00c8ff'],['Clicks','#22c55e'],['Shares','#a855f7'],['Comments','#fb923c'],['Saves','#fbbf24']].map(([label, color]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 10, height: 3, background: color, borderRadius: 1 }} />
              <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10 }}>{label}</span>
            </div>
          ))}
        </div>
        <LineChart data={lineData} height={130}
          lines={[
            { key: 'impressions', color: '#00c8ff', label: 'Impressions' },
            { key: 'clicks',      color: '#22c55e', label: 'Clicks' },
            { key: 'shares',      color: '#a855f7', label: 'Shares' },
            { key: 'comments',    color: '#fb923c', label: 'Comments' },
            { key: 'saves',       color: '#fbbf24', label: 'Saves' },
          ]}
        />
      </div>

      {/* Predicted engagement */}
      <div style={{ ...card({ padding: '16px 18px' }) }}>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 13, marginBottom: 4 }}>🔮 Predicted Engagement — Next 14 Days</div>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginBottom: 12 }}>
          Based on historical patterns and day-of-week trends.
        </div>
        <BarChart
          data={predictions.map((p) => ({ label: p.label.slice(0, 6), value: Math.round(p.predicted * 1000) }))}
          color={meta.color} height={80} maxBars={14}
        />
        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, marginTop: 4 }}>
          Y-axis: engagement rate × 1000 (e.g. 50 = 5.0%)
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// CONTENT PERFORMANCE TAB
// ══════════════════════════════════════════════════════════════════════════════

function ContentTab() {
  const topPosts = useMemo(() => getTopPosts(6), [])
  const lowPosts = useMemo(() => getLowPosts(3), [])

  function PostRow({ post, rank, isLow }: { post: ReturnType<typeof getTopPosts>[0]; rank: number; isLow?: boolean }) {
    const meta = PLATFORM_META[post.platform]
    return (
      <div style={{ display: 'flex', gap: 12, padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', alignItems: 'flex-start' }}>
        <div style={{ width: 28, height: 28, borderRadius: 6, background: meta.colorBg, border: `1px solid ${meta.colorBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0, marginTop: 2 }}>{meta.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: '#fff', fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>{post.title}</div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            {[
              { label: 'Reach',     value: fmtNum(post.impressions), color: '#00c8ff' },
              { label: 'Eng.',      value: pctLabel(post.engagement), color: '#22c55e' },
              { label: 'Clicks',    value: fmtNum(post.clicks),      color: 'rgba(255,255,255,0.5)' },
              { label: 'Shares',    value: fmtNum(post.shares),      color: '#a855f7' },
              { label: 'Saves',     value: fmtNum(post.saves),       color: '#fbbf24' },
              { label: 'Comments',  value: fmtNum(post.comments),    color: '#fb923c' },
            ].map((m) => (
              <span key={m.label} style={{ fontSize: 11 }}>
                <span style={{ color: 'rgba(255,255,255,0.3)' }}>{m.label} </span>
                <span style={{ color: m.color, fontWeight: 700 }}>{m.value}</span>
              </span>
            ))}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10, marginTop: 3 }}>
            Posted {fmtDate(post.postedAt)} · <span style={{ textTransform: 'capitalize' }}>{post.platform}</span>
          </div>
        </div>
        <div style={{ flexShrink: 0, textAlign: 'right' }}>
          {isLow ? (
            <span style={{ color: '#f87171', fontSize: 10, fontWeight: 700, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 20, padding: '2px 8px' }}>⚠️ Low</span>
          ) : (
            <span style={{ color: rank === 1 ? '#fbbf24' : '#22c55e', fontWeight: 800, fontSize: 16 }}>#{rank}</span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Top performers */}
      <div style={{ ...card({ padding: '16px 20px', marginBottom: 20 }) }}>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 14, marginBottom: 4 }}>🏆 Top Performing Posts</div>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 16 }}>
          Ranked by composite score (reach × engagement × shares + saves + comments)
        </div>
        {topPosts.map((p, i) => <PostRow key={p.id} post={p} rank={i + 1} />)}
      </div>

      {/* Low performers */}
      <div style={{ ...card({ padding: '16px 20px' }) }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>⚠️ Low-Performing Content</div>
          <span style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171', fontSize: 10, fontWeight: 700, borderRadius: 20, padding: '2px 8px' }}>Alert</span>
        </div>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 16 }}>
          These posts underperformed. Consider different formats, times, or topics.
        </div>
        {lowPosts.map((p, i) => <PostRow key={p.id} post={p} rank={i + 1} isLow />)}

        {/* Recommendations */}
        <div style={{ marginTop: 16, background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.15)', borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ color: '#fbbf24', fontWeight: 700, fontSize: 12, marginBottom: 8 }}>💡 Why They Underperformed</div>
          <ul style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, lineHeight: 1.7, margin: 0, paddingLeft: 18 }}>
            <li>Company update posts consistently get 60–70% below average reach — audiences prefer educational or entertaining content</li>
            <li>Facebook posts with no visual hook get minimal engagement — add a strong opening image or video</li>
            <li>Posts published Mon before 9am see 30% lower engagement than Tue–Thu 9–11am</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// HASHTAGS TAB
// ══════════════════════════════════════════════════════════════════════════════

function HashtagsTab() {
  const [sort, setSort] = useState<'avgReach' | 'avgEngagement' | 'uses'>('avgReach')
  const sorted = useMemo(() =>
    [...HASHTAG_PERF].sort((a, b) => b[sort] - a[sort]),
    [sort]
  )

  const trendColors = { up: '#22c55e', down: '#f87171', stable: '#fbbf24' }
  const trendIcons  = { up: '↑', down: '↓', stable: '→' }

  return (
    <div>
      <div style={{ ...card({ padding: '16px 20px' }) }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>🏷️ Hashtag Performance</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 }}>Last 30 days · All platforms</div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>Sort by:</span>
            {(['avgReach','avgEngagement','uses'] as const).map((k) => (
              <button key={k} onClick={() => setSort(k)}
                style={{ ...ghostBtn(), background: sort === k ? 'rgba(0,200,255,0.12)' : 'rgba(255,255,255,0.07)', color: sort === k ? '#00c8ff' : 'rgba(255,255,255,0.5)', borderColor: sort === k ? 'rgba(0,200,255,0.3)' : 'rgba(255,255,255,0.15)', padding: '5px 10px', fontSize: 10 }}>
                {k === 'avgReach' ? 'Avg Reach' : k === 'avgEngagement' ? 'Avg Eng.' : 'Uses'}
              </button>
            ))}
          </div>
        </div>

        {/* Table header */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 90px 90px 60px', gap: 8, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: 4 }}>
          {['Hashtag','Uses','Avg Reach','Avg Eng.','Trend'].map((h) => (
            <div key={h} style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: h === 'Hashtag' ? 'left' : 'right' }}>{h}</div>
          ))}
        </div>

        {sorted.map((h) => {
          const maxReach = sorted[0].avgReach
          return (
            <div key={h.tag} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 90px 90px 60px', gap: 8, padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'center' }}>
              {/* Tag + bar */}
              <div>
                <div style={{ color: '#00c8ff', fontWeight: 700, fontSize: 12, marginBottom: 3 }}>{h.tag}</div>
                <div style={{ height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: '#00c8ff', width: `${(h.avgReach / maxReach) * 100}%`, borderRadius: 2 }} />
                </div>
              </div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, textAlign: 'right' }}>{h.uses}</div>
              <div style={{ color: '#fff', fontSize: 12, fontWeight: 600, textAlign: 'right' }}>{fmtNum(h.avgReach)}</div>
              <div style={{ color: '#22c55e', fontSize: 12, textAlign: 'right' }}>{pctLabel(h.avgEngagement)}</div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ color: trendColors[h.trend], fontWeight: 700, fontSize: 13 }}>{trendIcons[h.trend]}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Recommendations */}
      <div style={{ ...card({ padding: '16px 20px', marginTop: 20 }) }}>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 13, marginBottom: 12 }}>💡 Hashtag Recommendations</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: 10, padding: 14 }}>
            <div style={{ color: '#22c55e', fontWeight: 700, fontSize: 12, marginBottom: 8 }}>✅ Keep Using</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {HASHTAG_PERF.filter((h) => h.trend === 'up').map((h) => (
                <span key={h.tag} style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', borderRadius: 20, padding: '3px 8px', fontSize: 11, fontWeight: 600 }}>{h.tag}</span>
              ))}
            </div>
          </div>
          <div style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.15)', borderRadius: 10, padding: 14 }}>
            <div style={{ color: '#f87171', fontWeight: 700, fontSize: 12, marginBottom: 8 }}>🔄 Consider Replacing</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {HASHTAG_PERF.filter((h) => h.trend === 'down').map((h) => (
                <span key={h.tag} style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171', borderRadius: 20, padding: '3px 8px', fontSize: 11, fontWeight: 600 }}>{h.tag}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// BEST TIMES TAB
// ══════════════════════════════════════════════════════════════════════════════

function TimesTab() {
  const topSlots = getTopTimeSlots()

  return (
    <div>
      {/* Top 5 slots */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 24 }}>
        {topSlots.map((slot, i) => (
          <div key={slot.label} style={{ ...card({ padding: '14px 12px', textAlign: 'center' }) }}>
            <div style={{ fontSize: 18, marginBottom: 6 }}>
              {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '🕐'}
            </div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>{slot.label}</div>
            <div style={{ color: '#22c55e', fontSize: 11, marginTop: 4, fontWeight: 700 }}>Score {slot.score}</div>
          </div>
        ))}
      </div>

      {/* Heat map */}
      <div style={{ ...card({ padding: '16px 20px' }) }}>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 14, marginBottom: 4 }}>🗓️ Engagement Heat Map</div>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 16 }}>
          Based on 90-day historical performance across all platforms. Darker = better engagement.
        </div>
        <HeatMap />
      </div>

      {/* Insights */}
      <div style={{ ...card({ padding: '16px 20px', marginTop: 20 }) }}>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 13, marginBottom: 12 }}>📌 Timing Insights</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { icon: '📈', text: 'Tuesday–Thursday between 9am–11am and 5pm–7pm are your strongest windows across all platforms.' },
            { icon: '📱', text: 'TikTok and Instagram perform best at 6–7pm weekdays when users are done with work.' },
            { icon: '💼', text: 'LinkedIn posts get 35% more engagement when published Tuesday or Wednesday at 9am CT.' },
            { icon: '📅', text: 'Weekend posts perform 25–35% below weekday average — avoid scheduling key content Sat–Sun.' },
            { icon: '⏰', text: 'Posts before 7am and after 9pm consistently underperform regardless of platform.' },
          ].map((tip, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{tip.icon}</span>
              <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, lineHeight: 1.6 }}>{tip.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// CAMPAIGNS TAB
// ══════════════════════════════════════════════════════════════════════════════

function CampaignsTab() {
  const statusColors = { active: '#22c55e', completed: '#00c8ff', planned: '#fbbf24' }
  const statusBgs    = { active: 'rgba(34,197,94,0.1)', completed: 'rgba(0,200,255,0.1)', planned: 'rgba(251,191,36,0.1)' }

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {CAMPAIGNS.map((c) => (
          <div key={c.id} style={{ ...card({ padding: '18px 20px' }) }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
              <div>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>{c.name}</div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 3 }}>
                  {fmtDate(c.startDate)} – {fmtDate(c.endDate)} · {c.goal}
                </div>
                <div style={{ display: 'flex', gap: 5, marginTop: 8, flexWrap: 'wrap' }}>
                  {c.platforms.map((p) => (
                    <span key={p} style={{ background: PLATFORM_META[p]?.colorBg, color: PLATFORM_META[p]?.color, border: `1px solid ${PLATFORM_META[p]?.colorBorder}`, borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 600 }}>
                      {PLATFORM_META[p]?.icon} {p}
                    </span>
                  ))}
                </div>
              </div>
              <span style={{ background: statusBgs[c.status], color: statusColors[c.status], border: `1px solid ${statusColors[c.status]}44`, borderRadius: 20, padding: '4px 12px', fontSize: 11, fontWeight: 700, flexShrink: 0, textTransform: 'capitalize' }}>
                {c.status}
              </span>
            </div>

            {/* Metrics */}
            {c.status !== 'planned' ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
                {[
                  { label: 'Posts',     value: String(c.postsCount),       color: 'rgba(255,255,255,0.8)' },
                  { label: 'Total Reach',value: fmtNum(c.totalReach),      color: '#00c8ff' },
                  { label: 'Clicks',    value: fmtNum(c.totalClicks),      color: '#22c55e' },
                  { label: 'Leads',     value: String(c.leadConversions),  color: '#fbbf24' },
                ].map((m) => (
                  <div key={m.label} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 600, marginBottom: 3 }}>{m.label}</div>
                    <div style={{ color: m.color, fontWeight: 700, fontSize: 18 }}>{m.value}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.12)', borderRadius: 8, padding: '10px 14px', color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
                📅 Campaign not started yet — no data to display.
              </div>
            )}

            {/* Progress bar for active campaign */}
            {c.status === 'active' && (
              <div style={{ marginTop: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>Campaign progress</span>
                  <span style={{ color: '#22c55e', fontSize: 10, fontWeight: 700 }}>
                    {Math.round(c.leadConversions / 20 * 100)}% toward lead goal
                  </span>
                </div>
                <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3 }}>
                  <div style={{ height: '100%', background: 'linear-gradient(90deg,#22c55e,#00c8ff)', width: `${Math.min(100, c.leadConversions / 20 * 100)}%`, borderRadius: 3 }} />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// AI INSIGHTS TAB
// ══════════════════════════════════════════════════════════════════════════════

type InsightType = 'optimization' | 'posting' | 'summary' | 'hashtags'

const INSIGHT_CONFIGS: Array<{ id: InsightType; icon: string; label: string; desc: string; topic: string }> = [
  {
    id: 'optimization', icon: '⚡', label: 'Optimization Suggestions',
    desc: 'AI analyzes your metrics and suggests specific improvements to boost performance.',
    topic: 'May 2026 BayKid social media performance — provide 5 specific, actionable optimization suggestions based on: TikTok 8.4% eng/19k reach leading all platforms, Facebook declining (-31%), Instagram strong saves (210 avg), LinkedIn good click rate but low reach, low-performing posts are company updates and time-utility posts. Focus on what to change, test, or double down on.',
  },
  {
    id: 'posting', icon: '📅', label: 'Posting Recommendations',
    desc: 'Get a personalized content calendar recommendation for the next 30 days.',
    topic: 'Create a 30-day content posting schedule for BayKid Nashville recycling. Data: Best times Tue-Thu 9-11am and 5-7pm, TikTok and Instagram are top platforms, follower growth strong on TikTok (+38/day), Facebook declining, top content types: POV videos, educational carousels, customer stories. Recommend: frequency per platform, content mix, formats to prioritize, and 3 specific post ideas with suggested captions.',
  },
  {
    id: 'summary', icon: '📊', label: 'Campaign Summary',
    desc: 'AI-written executive summary of the current Nashville Business Push campaign.',
    topic: 'Write an executive summary for the "Nashville Business Push" campaign running May 2026 on LinkedIn, Facebook, and Instagram. Metrics: 12 posts published, 32,000 total reach, 310 clicks, 14 lead conversions vs 20-lead goal (70% to target). Audience: Nashville business owners. Campaign ends May 31. Include: performance vs goal, what worked, what to improve, and recommended next steps.',
  },
  {
    id: 'hashtags', icon: '🏷️', label: 'Hashtag Strategy',
    desc: 'Claude recommends a new hashtag mix based on current performance trends.',
    topic: 'Analyze BayKid hashtag performance and recommend an updated strategy. Current data: #RecyclingTikTok (9.2k reach, 7.8% eng, trending up), #EcoTok (7.8k reach, 7.1% eng, trending up), #Nashville (6.1k reach, 3.8%, stable), #BayKid (4.2k reach, 4.9%, trending up), #ZeroWaste (2.2k reach, 2.8%, trending down), #GreenLiving (1.4k, 1.9%, trending down). Recommend: top 15 hashtags to use, mix strategy (broad/niche/branded), hashtags to drop, and 2 new hashtags to test.',
  },
]

function AIInsightsTab() {
  const [results,     setResults]     = useState<Record<InsightType, string>>({} as Record<InsightType, string>)
  const [loading,     setLoading]     = useState<InsightType | null>(null)
  const [error,       setError]       = useState<InsightType | null>(null)
  const resultRefs = useRef<Record<InsightType, HTMLDivElement | null>>({} as Record<InsightType, HTMLDivElement | null>)

  async function generate(cfg: typeof INSIGHT_CONFIGS[0]) {
    setLoading(cfg.id)
    setError(null)
    try {
      const res = await generateAIContent({
        contentType: 'analytics_review',
        topic:       cfg.topic,
        tone:        'professional',
        goal:        cfg.label,
      })
      const text = res.script || res.caption || res.hook || JSON.stringify(res)
      setResults((prev) => ({ ...prev, [cfg.id]: text }))
      // Scroll to result
      setTimeout(() => {
        resultRefs.current[cfg.id]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }, 100)
    } catch {
      setError(cfg.id)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ ...card({ padding: '16px 20px', marginBottom: 20, background: 'rgba(0,200,255,0.04)', borderColor: 'rgba(0,200,255,0.15)' }) }}>
        <div style={{ color: '#00c8ff', fontWeight: 700, fontSize: 15, marginBottom: 6 }}>🤖 AI Analytics Intelligence</div>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, lineHeight: 1.6 }}>
          Claude analyzes your real performance data and generates tailored recommendations.
          Each insight type uses specific metrics from your dashboard — not generic advice.
        </div>
      </div>

      {INSIGHT_CONFIGS.map((cfg) => {
        const isLoading = loading === cfg.id
        const hasResult = !!results[cfg.id]
        const hasError  = error === cfg.id

        return (
          <div key={cfg.id} style={{ ...card({ padding: '18px 20px', marginBottom: 16 }) }}>
            {/* Card header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: hasResult ? 16 : 0 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 18 }}>{cfg.icon}</span>
                  <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>{cfg.label}</span>
                </div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>{cfg.desc}</div>
              </div>
              <button
                onClick={() => generate(cfg)}
                disabled={isLoading}
                style={{
                  background: isLoading ? 'rgba(0,200,255,0.08)' : 'linear-gradient(135deg,#0057e7,#00c8ff)',
                  border: isLoading ? '1px solid rgba(0,200,255,0.2)' : 'none',
                  color: '#fff', borderRadius: 10, padding: '9px 18px',
                  fontWeight: 700, fontSize: 12,
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  opacity: isLoading ? 0.7 : 1,
                  display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                {isLoading ? (
                  <>
                    <span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'ai-spin 0.7s linear infinite' }} />
                    Analyzing…
                  </>
                ) : hasResult ? '🔄 Regenerate' : '✨ Generate'}
              </button>
            </div>

            {/* Error */}
            {hasError && (
              <div style={{ color: '#f87171', fontSize: 12, background: 'rgba(248,113,113,0.08)', borderRadius: 8, padding: '10px 14px' }}>
                ❌ Generation failed. Check your API connection and try again.
              </div>
            )}

            {/* Result */}
            {hasResult && (
              <div ref={(el) => { resultRefs.current[cfg.id] = el }}>
                <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(0,200,255,0.12)', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ color: '#00c8ff', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 10, textTransform: 'uppercase' }}>
                    ✨ Claude · {cfg.label}
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, lineHeight: 1.8, whiteSpace: 'pre-wrap', maxHeight: 500, overflowY: 'auto' }}>
                    {results[cfg.id]}
                  </div>
                </div>
                {/* Copy button */}
                <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => navigator.clipboard.writeText(results[cfg.id])}
                    style={ghostBtn({ fontSize: 10, padding: '4px 10px' })}
                  >
                    📋 Copy
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// AnalyticsSection (main export)
// ══════════════════════════════════════════════════════════════════════════════

const TABS: Array<{ id: AnalyticsTab; icon: string; label: string }> = [
  { id: 'overview',   icon: '📊', label: 'Overview'    },
  { id: 'platforms',  icon: '📱', label: 'Platforms'   },
  { id: 'content',    icon: '🏆', label: 'Content'     },
  { id: 'hashtags',   icon: '🏷️', label: 'Hashtags'   },
  { id: 'times',      icon: '🕐', label: 'Best Times'  },
  { id: 'campaigns',  icon: '🚀', label: 'Campaigns'   },
  { id: 'ai',         icon: '🤖', label: 'AI Insights' },
]

export function AnalyticsSection() {
  const [tab, setTab] = useState<AnalyticsTab>('overview')

  return (
    <div style={{ maxWidth: 980 }}>
      {/* Page header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 20, margin: '0 0 4px' }}>📈 AI Analytics Intelligence</h2>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, margin: 0 }}>
          May 2026 · Nashville · All Platforms · AI-powered insights and recommendations
        </p>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.25)', borderRadius: 12, padding: 4, marginBottom: 28, overflowX: 'auto', flexShrink: 0 }}>
        {TABS.map((t) => {
          const active = tab === t.id
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: active ? 'rgba(0,200,255,0.18)' : 'transparent', color: active ? '#00c8ff' : 'rgba(255,255,255,0.4)', fontWeight: active ? 700 : 500, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap', transition: 'all 0.15s' }}>
              <span>{t.icon}</span><span>{t.label}</span>
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      {tab === 'overview'  && <OverviewTab  />}
      {tab === 'platforms' && <PlatformTab  />}
      {tab === 'content'   && <ContentTab   />}
      {tab === 'hashtags'  && <HashtagsTab  />}
      {tab === 'times'     && <TimesTab     />}
      {tab === 'campaigns' && <CampaignsTab />}
      {tab === 'ai'        && <AIInsightsTab />}

      <div style={{ height: 40 }} />
    </div>
  )
}
