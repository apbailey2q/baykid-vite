import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { GlassCard } from '../../components/ui/GlassCard'
import { PrimaryButton } from '../../components/ui/PrimaryButton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { BottomNav, type BottomNavItem } from '../../components/ui/BottomNav'

// ── Demo Data ─────────────────────────────────────────────────────────────────

const SUMMARY_METRICS = [
  { label: 'Monthly Revenue',    value: '$24,520',      sub: 'This month',     color: '#4ade80'  },
  { label: 'Pickup Volume',      value: '84 / week',    sub: 'Avg 7-day',      color: '#00c8ff'  },
  { label: 'Recycling Volume',   value: '14,200 lbs',   sub: 'This week',      color: '#a78bfa'  },
  { label: 'Avg Contamination',  value: '2.4%',         sub: 'All accounts',   color: '#fbbf24'  },
  { label: 'SLA Performance',    value: '94%',          sub: 'On-time rate',   color: '#4ade80'  },
  { label: 'Warehouse Load',     value: '68%',          sub: 'NASH-01 cap.',   color: '#00c8ff'  },
]

const MATERIAL_BREAKDOWN = [
  { material: 'Cardboard',        pct: 48, lbs: 6816, color: '#00c8ff'  },
  { material: 'Mixed Recycling',  pct: 28, lbs: 3976, color: '#a78bfa'  },
  { material: 'Plastics',         pct: 14, lbs: 1988, color: '#4ade80'  },
  { material: 'Glass',            pct: 7,  lbs:  994, color: '#fbbf24'  },
  { material: 'Other',            pct: 3,  lbs:  426, color: '#94a3b8'  },
]

const SLA_ACCOUNTS = [
  { business: 'Greenway Office Plaza',   sla: 'On Track', pct: 100, variant: 'green' as const  },
  { business: 'Nashville Retail Center', sla: 'On Track', pct:  96, variant: 'green' as const  },
  { business: 'Metro Office Complex',    sla: 'At Risk',  pct:  78, variant: 'amber' as const  },
  { business: 'Music Row Complex',       sla: 'Breach',   pct:  51, variant: 'red'   as const  },
]

const REPORT_TYPES = [
  { label: 'Monthly Commercial Summary',    icon: '📋', status: 'Ready',     variant: 'green'  as const },
  { label: 'Contamination Incidents Log',   icon: '⚠️', status: 'Ready',     variant: 'green'  as const },
  { label: 'SLA Compliance Report',         icon: '📈', status: 'Ready',     variant: 'green'  as const },
  { label: 'ESG / Environmental Impact',    icon: '🌿', status: 'Available', variant: 'cyan'   as const },
  { label: 'Invoice & Revenue Summary',     icon: '💰', status: 'Ready',     variant: 'green'  as const },
  { label: 'Q2 Commercial Performance',     icon: '📊', status: 'Pending',   variant: 'amber'  as const },
]

// ── Screen ────────────────────────────────────────────────────────────────────

export default function AdminCommercialReports() {
  const navigate = useNavigate()
  const location = useLocation()
  const [toast, setToast] = useState<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  const navItems: BottomNavItem[] = [
    { label: 'Overview', icon: <span style={{ fontSize: 18 }}>🏢</span>, active: location.pathname === '/dashboard/admin/commercial',           onClick: () => navigate('/dashboard/admin/commercial')           },
    { label: 'Accounts', icon: <span style={{ fontSize: 18 }}>👥</span>, active: location.pathname === '/dashboard/admin/commercial/accounts',  onClick: () => navigate('/dashboard/admin/commercial/accounts')  },
    { label: 'Pickups',  icon: <span style={{ fontSize: 18 }}>🚛</span>, active: location.pathname === '/dashboard/admin/commercial/pickups',   onClick: () => navigate('/dashboard/admin/commercial/pickups')   },
    { label: 'Alerts',   icon: <span style={{ fontSize: 18 }}>🔔</span>, active: location.pathname === '/dashboard/admin/commercial/alerts',    onClick: () => navigate('/dashboard/admin/commercial/alerts'),   badge: 5 },
    { label: 'Reports',  icon: <span style={{ fontSize: 18 }}>📊</span>, active: location.pathname === '/dashboard/admin/commercial/reports',   onClick: () => navigate('/dashboard/admin/commercial/reports')   },
    { label: 'Dispatch', icon: <span style={{ fontSize: 18 }}>🗺️</span>, active: location.pathname === '/dashboard/admin/commercial/dispatch',  onClick: () => navigate('/dashboard/admin/commercial/dispatch')  },
  ]

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}>

      {/* ── Header ── */}
      <header
        className="flex items-center gap-3 px-4 py-3 shrink-0"
        style={{ background: 'rgba(4,10,24,0.94)', borderBottom: '1px solid rgba(0,200,255,0.12)', backdropFilter: 'blur(12px)' }}
      >
        <button
          onClick={() => navigate('/dashboard/admin/commercial')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', fontSize: 14, padding: '4px 6px' }}
        >
          ← Back
        </button>
        <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: '#fff', textAlign: 'center' }}>
          Commercial Reports
        </span>
        <div style={{ width: 46 }} />
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5 pb-24 max-w-2xl mx-auto w-full">

        {/* ── Summary metrics ── */}
        <div className="grid grid-cols-2 gap-2 mb-5">
          {SUMMARY_METRICS.map(m => (
            <GlassCard key={m.label} padding="md">
              <p style={{ fontSize: 20, fontWeight: 900, color: m.color, lineHeight: 1 }}>{m.value}</p>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>{m.label}</p>
              <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{m.sub}</p>
            </GlassCard>
          ))}
        </div>

        {/* ── Material breakdown ── */}
        <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
          Material Breakdown
        </p>
        <GlassCard padding="md" className="mb-5">
          {MATERIAL_BREAKDOWN.map(m => (
            <div key={m.material} className="mb-3 last:mb-0">
              <div className="flex justify-between mb-1">
                <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>{m.material}</p>
                <p style={{ fontSize: 11, fontWeight: 700, color: m.color }}>{m.lbs.toLocaleString()} lbs ({m.pct}%)</p>
              </div>
              <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                <div style={{ width: `${m.pct}%`, height: '100%', background: m.color, borderRadius: 999, boxShadow: `0 0 7px ${m.color}55` }} />
              </div>
            </div>
          ))}
        </GlassCard>

        {/* ── SLA Performance per account ── */}
        <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
          SLA Performance by Account
        </p>
        <GlassCard padding="md" className="mb-5">
          {SLA_ACCOUNTS.map(a => (
            <div key={a.business} className="flex items-center gap-3 mb-3 last:mb-0">
              <div className="flex-1 min-w-0">
                <p style={{ fontSize: 12, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.business}</p>
                <div className="mt-1" style={{ height: 5, borderRadius: 999, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                  <div style={{
                    width: `${a.pct}%`, height: '100%', borderRadius: 999,
                    background: a.pct >= 90 ? '#4ade80' : a.pct >= 70 ? '#fbbf24' : '#f87171',
                    boxShadow: `0 0 6px ${a.pct >= 90 ? '#4ade8080' : a.pct >= 70 ? '#fbbf2480' : '#f8717180'}`,
                  }} />
                </div>
              </div>
              <div className="shrink-0 flex flex-col items-end gap-1">
                <StatusBadge variant={a.variant} label={a.sla} size="sm" />
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>{a.pct}%</span>
              </div>
            </div>
          ))}
        </GlassCard>

        {/* ── Report types ── */}
        <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
          Available Reports
        </p>
        <GlassCard padding="md" className="mb-5">
          <div className="flex flex-col gap-0">
            {REPORT_TYPES.map((r, i) => (
              <div
                key={r.label}
                className="flex items-center justify-between py-2.5"
                style={{ borderBottom: i < REPORT_TYPES.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}
              >
                <div className="flex items-center gap-2.5">
                  <span style={{ fontSize: 16 }}>{r.icon}</span>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>{r.label}</p>
                </div>
                <StatusBadge variant={r.variant} label={r.status} size="sm" />
              </div>
            ))}
          </div>
        </GlassCard>

        {/* ── Export actions ── */}
        <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
          Export
        </p>
        <div className="flex flex-col gap-2.5">
          <PrimaryButton fullWidth size="lg" onClick={() => showToast('PDF export generated ✓')}>
            📄 Export PDF
          </PrimaryButton>
          <div className="flex gap-2">
            <div className="flex-1">
              <PrimaryButton fullWidth size="md" variant="secondary" onClick={() => showToast('CSV export ready ✓')}>
                📊 Export CSV
              </PrimaryButton>
            </div>
            <div className="flex-1">
              <PrimaryButton fullWidth size="md" variant="secondary" onClick={() => showToast('Monthly report generated ✓')}>
                📅 Monthly Report
              </PrimaryButton>
            </div>
          </div>
          <PrimaryButton fullWidth size="md" variant="secondary" onClick={() => showToast('ESG export generated ✓')}>
            🌿 ESG / Environmental Export
          </PrimaryButton>
        </div>
      </div>

      <BottomNav items={navItems} />

      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-sm font-semibold"
          style={{ background: 'rgba(0,200,255,0.15)', border: '1px solid rgba(0,200,255,0.3)', color: '#00c8ff', backdropFilter: 'blur(12px)', whiteSpace: 'nowrap', boxShadow: '0 4px 24px rgba(0,0,0,0.4)' }}>
          {toast}
        </div>
      )}
    </div>
  )
}
