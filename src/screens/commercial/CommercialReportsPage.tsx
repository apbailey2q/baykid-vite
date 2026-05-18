import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const ACCENT = '#00c8ff'

type Period = 'week' | 'month' | 'quarter' | 'year'

const PERIODS: { value: Period; label: string }[] = [
  { value: 'week',    label: 'This Week'  },
  { value: 'month',   label: 'This Month' },
  { value: 'quarter', label: 'Q1 2026'    },
  { value: 'year',    label: 'YTD 2026'   },
]

const MOCK_STATS: Record<Period, { co2: number; lbs: number; pickups: number; sla: number }> = {
  week:    { co2: 142,   lbs: 1840,  pickups: 3,  sla: 100 },
  month:   { co2: 618,   lbs: 7920,  pickups: 14, sla: 97  },
  quarter: { co2: 1840,  lbs: 23100, pickups: 42, sla: 95  },
  year:    { co2: 5210,  lbs: 64800, pickups: 112, sla: 96 },
}

const BAR_DATA = [14, 22, 18, 30, 25, 19, 28, 35, 22, 40, 31, 27]
const BAR_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function CommercialReportsPage() {
  const navigate = useNavigate()
  const [period, setPeriod] = useState<Period>('month')
  const stats = MOCK_STATS[period]
  const maxBar = Math.max(...BAR_DATA)

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}>
      <header className="flex items-center gap-3 px-4 py-3 shrink-0" style={{ background: 'rgba(4,10,24,0.94)', borderBottom: '1px solid rgba(0,200,255,0.12)', backdropFilter: 'blur(12px)' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>← Back</button>
        <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: '#fff', textAlign: 'center' }}>Sustainability Reports</span>
        <span style={{ width: 52 }} />
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5 pb-24 max-w-xl mx-auto w-full">

        {/* Period picker */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className="shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all"
              style={{
                background: period === p.value ? ACCENT : 'rgba(255,255,255,0.07)',
                color: period === p.value ? '#000' : 'rgba(255,255,255,0.5)',
                border: period === p.value ? 'none' : '1px solid rgba(255,255,255,0.1)',
                cursor: 'pointer',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Key stats */}
        <div className="grid grid-cols-2 gap-2.5 mb-5">
          {[
            { icon: '🌿', label: 'CO₂ Saved',     value: `${stats.co2} lbs`,   color: '#4ade80'  },
            { icon: '♻️', label: 'Waste Diverted', value: `${stats.lbs.toLocaleString()} lbs`, color: ACCENT     },
            { icon: '🚛', label: 'Pickups',        value: stats.pickups,         color: '#a78bfa'  },
            { icon: '📋', label: 'SLA Score',      value: `${stats.sla}%`,       color: stats.sla >= 98 ? '#4ade80' : stats.sla >= 95 ? '#fbbf24' : '#f87171' },
          ].map(s => (
            <div key={s.label} className="rounded-2xl px-4 py-4" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}>
              <span style={{ fontSize: 22 }}>{s.icon}</span>
              <p style={{ fontSize: 26, fontWeight: 900, color: s.color, lineHeight: 1.1, marginTop: 6 }}>{s.value}</p>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 4 }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Volume chart */}
        <div className="rounded-2xl px-4 py-4 mb-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 16 }}>Monthly Volume (tons)</p>
          <div className="flex items-end gap-1.5" style={{ height: 80 }}>
            {BAR_DATA.map((val, i) => (
              <div key={i} className="flex flex-col items-center gap-1 flex-1">
                <div
                  className="w-full rounded-t-sm transition-all"
                  style={{ height: `${(val / maxBar) * 72}px`, background: i === new Date().getMonth() ? ACCENT : 'rgba(0,200,255,0.25)' }}
                />
                <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>{BAR_LABELS[i]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Material breakdown */}
        <div className="rounded-2xl px-4 py-4 mb-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 14 }}>Material Breakdown</p>
          {[
            { label: 'Cardboard / Paper',    pct: 42, color: '#4ade80'  },
            { label: 'Plastics (Mixed)',      pct: 28, color: ACCENT     },
            { label: 'Metals',               pct: 16, color: '#a78bfa'  },
            { label: 'Glass',                pct: 9,  color: '#fbbf24'  },
            { label: 'Other',                pct: 5,  color: '#94a3b8'  },
          ].map(m => (
            <div key={m.label} className="mb-3">
              <div className="flex justify-between mb-1">
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>{m.label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: m.color }}>{m.pct}%</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <div style={{ width: `${m.pct}%`, height: '100%', background: m.color, borderRadius: 999 }} />
              </div>
            </div>
          ))}
        </div>

        {/* Download button */}
        <button
          className="w-full py-4 rounded-2xl font-bold text-sm transition-all hover:brightness-110 active:scale-[0.98]"
          style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80' }}
        >
          ⬇ Download PDF Report
        </button>
      </div>
    </div>
  )
}
