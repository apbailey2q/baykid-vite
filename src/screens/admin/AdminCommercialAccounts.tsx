import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { GlassCard } from '../../components/ui/GlassCard'
import { PrimaryButton } from '../../components/ui/PrimaryButton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { BottomNav, type BottomNavItem } from '../../components/ui/BottomNav'

// ── Types + Demo Data ─────────────────────────────────────────────────────────

type AccountStatus = 'active' | 'pending' | 'suspended'

interface CommAccount {
  id: string
  business:      string
  status:        AccountStatus
  plan:          string
  contact:       string
  warehouse:     string
  revenue:       number
  sla:           string
  contamination: number
  frequency:     string
  email:         string
}

const DEMO_ACCOUNTS: CommAccount[] = [
  { id: 'a1', business: 'Greenway Office Plaza',   status: 'active',    plan: 'Enterprise Weekly',  contact: 'Angela Bailey',  warehouse: 'NASH-01', revenue: 1840, sla: 'On Track', contamination: 2.0, frequency: 'Mon / Wed / Fri', email: 'ops@greenway.com'    },
  { id: 'a2', business: 'Nashville Retail Center', status: 'active',    plan: 'Standard Monthly',   contact: 'Ops Desk',       warehouse: 'NASH-01', revenue:  920, sla: 'On Track', contamination: 3.8, frequency: 'Mon / Thu',       email: 'ops@nashretail.com'  },
  { id: 'a3', business: 'Metro Office Complex',    status: 'pending',   plan: 'Enterprise Weekly',  contact: 'Facilities Desk',warehouse: 'NASH-01', revenue:    0, sla: 'Pending',  contamination: 0.0, frequency: 'TBD',             email: 'mgmt@metro-ofc.com'  },
  { id: 'a4', business: 'Music Row Complex',       status: 'suspended', plan: 'Standard Monthly',   contact: 'Building Mgmt',  warehouse: 'NASH-02', revenue:  680, sla: 'Breach',   contamination: 7.2, frequency: 'Wed',             email: 'admin@musicrow.com'  },
]

const STATUS_BADGE: Record<AccountStatus, { variant: 'green' | 'amber' | 'red'; label: string }> = {
  active:    { variant: 'green', label: 'Active'    },
  pending:   { variant: 'amber', label: 'Pending'   },
  suspended: { variant: 'red',   label: 'Suspended' },
}

type FilterTab = 'all' | AccountStatus

// ── Screen ────────────────────────────────────────────────────────────────────

export default function AdminCommercialAccounts() {
  const navigate = useNavigate()
  const location = useLocation()

  const [statuses, setStatuses] = useState<Record<string, AccountStatus>>(
    Object.fromEntries(DEMO_ACCOUNTS.map(a => [a.id, a.status]))
  )
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filter, setFilter]         = useState<FilterTab>('all')
  const [toast, setToast]           = useState<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  function setStatus(id: string, status: AccountStatus) {
    setStatuses(prev => ({ ...prev, [id]: status }))
    showToast(`Account ${status === 'active' ? 'approved' : status === 'suspended' ? 'suspended' : 'updated'} ✓`)
  }

  const accountsWithState = DEMO_ACCOUNTS.map(a => ({ ...a, status: statuses[a.id] }))
  const filtered = filter === 'all' ? accountsWithState : accountsWithState.filter(a => a.status === filter)

  const FILTER_TABS: { value: FilterTab; label: string }[] = [
    { value: 'all',       label: `All (${accountsWithState.length})`                                    },
    { value: 'active',    label: `Active (${accountsWithState.filter(a => a.status === 'active').length})`    },
    { value: 'pending',   label: `Pending (${accountsWithState.filter(a => a.status === 'pending').length})`   },
    { value: 'suspended', label: `Suspended (${accountsWithState.filter(a => a.status === 'suspended').length})` },
  ]

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
          Commercial Accounts
        </span>
        <span style={{ width: 46 }} />
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5 pb-24 max-w-2xl mx-auto w-full">

        {/* ── Filter tabs ── */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {FILTER_TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className="shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all"
              style={{
                background: filter === tab.value ? '#00c8ff' : 'rgba(255,255,255,0.07)',
                color:      filter === tab.value ? '#000'    : 'rgba(255,255,255,0.5)',
                border:     filter === tab.value ? 'none'    : '1px solid rgba(255,255,255,0.1)',
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Account cards ── */}
        <div className="flex flex-col gap-3">
          {filtered.length === 0 ? (
            <GlassCard padding="lg" className="text-center">
              <p style={{ fontSize: 28, marginBottom: 10 }}>🏢</p>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>No accounts in this category</p>
            </GlassCard>
          ) : filtered.map(acct => {
            const badge  = STATUS_BADGE[acct.status]
            const isOpen = expandedId === acct.id

            return (
              <div
                key={acct.id}
                className="rounded-2xl overflow-hidden"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: `1px solid ${acct.status === 'suspended' ? 'rgba(248,113,113,0.2)' : acct.status === 'pending' ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.09)'}`,
                }}
              >
                {/* Card header */}
                <button
                  onClick={() => setExpandedId(isOpen ? null : acct.id)}
                  className="w-full px-4 py-4 text-left"
                  style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0 mr-2">
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {acct.business}
                      </p>
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                        {acct.plan} · {acct.warehouse}
                      </p>
                    </div>
                    <StatusBadge variant={badge.variant} label={badge.label} size="sm" />
                  </div>
                  <div className="flex gap-3 flex-wrap">
                    <span style={{ fontSize: 11, color: '#4ade80', fontWeight: 600 }}>
                      ${acct.revenue.toLocaleString()}/mo
                    </span>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                      {acct.contact}
                    </span>
                    <span style={{ fontSize: 11, color: acct.contamination > 5 ? '#f87171' : 'rgba(255,255,255,0.4)' }}>
                      {acct.contamination.toFixed(1)}% contam.
                    </span>
                  </div>
                </button>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="px-4 pb-4" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3 pt-3 mb-4">
                      {[
                        { label: 'Business',       value: acct.business      },
                        { label: 'Plan',           value: acct.plan          },
                        { label: 'Contact',        value: acct.contact       },
                        { label: 'Email',          value: acct.email         },
                        { label: 'Warehouse',      value: acct.warehouse     },
                        { label: 'Pickup Days',    value: acct.frequency     },
                        { label: 'Monthly Rev.',   value: `$${acct.revenue.toLocaleString()}` },
                        { label: 'SLA Status',     value: acct.sla           },
                      ].map(row => (
                        <div key={row.label}>
                          <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{row.label}</p>
                          <p style={{ fontSize: 12, color: '#fff', fontWeight: 600, marginTop: 2 }}>{row.value}</p>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-col gap-2">
                      {acct.status === 'pending' && (
                        <PrimaryButton fullWidth size="sm" onClick={() => setStatus(acct.id, 'active')}>
                          ✓ Approve Account
                        </PrimaryButton>
                      )}
                      {acct.status === 'active' && (
                        <PrimaryButton fullWidth size="sm" variant="secondary" onClick={() => setStatus(acct.id, 'suspended')}>
                          🚫 Suspend Account
                        </PrimaryButton>
                      )}
                      {acct.status === 'suspended' && (
                        <PrimaryButton fullWidth size="sm" onClick={() => setStatus(acct.id, 'active')}>
                          ✓ Reinstate Account
                        </PrimaryButton>
                      )}
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <PrimaryButton fullWidth size="sm" variant="secondary" onClick={() => showToast('Plan editor coming soon')}>
                            📋 Edit Plan
                          </PrimaryButton>
                        </div>
                        <div className="flex-1">
                          <PrimaryButton fullWidth size="sm" variant="secondary" onClick={() => showToast(`Viewing ${acct.business}`)}>
                            👁 View Account
                          </PrimaryButton>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
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
