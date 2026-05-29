import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

function fade(a: boolean, d = 0): React.CSSProperties {
  return {
    opacity:    a ? 1 : 0,
    transform:  a ? 'translateY(0)' : 'translateY(14px)',
    transition: `opacity 0.4s ease ${d}ms, transform 0.4s ease ${d}ms`,
  }
}

type CheckStatus = 'pending' | 'pass' | 'fail' | 'skip'

interface CheckItem {
  id:       string
  label:    string
  hint?:    string
  roles:    string[]
}

const ALL_CHECKS: CheckItem[] = [
  // ── All roles ─────────────────────────────────────────────
  { id: 'login',         label: 'Sign in with beta account',                 hint: 'Use your assigned beta.* email',                     roles: ['all'] },
  { id: 'dashboard',     label: 'Role dashboard loads without blank screen',  hint: 'Should route to the correct dashboard immediately',   roles: ['all'] },
  { id: 'mobile',        label: 'Mobile layout correct at 375px width',       hint: 'Check on an iPhone or dev tools narrow viewport',     roles: ['all'] },
  { id: 'push',          label: 'Push notification delivered to device',      hint: 'Trigger a test action that sends a push',             roles: ['all'] },
  { id: 'logout',        label: 'Sign out works and clears session',          hint: 'After logout, /real-login should appear',             roles: ['all'] },
  { id: 'legal',         label: 'Legal Center links work from login screen',  hint: 'Terms, Privacy, Contact Support all load',            roles: ['all'] },

  // ── Commercial ────────────────────────────────────────────
  { id: 'com_view',      label: 'View active pickups on dashboard',           hint: 'Check status badges and stop count',                  roles: ['commercial'] },
  { id: 'com_request',   label: 'Request a new commercial pickup',            hint: 'Submit form → confirm success toast',                 roles: ['commercial'] },
  { id: 'com_schedule',  label: 'View pickup schedule',                       hint: 'Calendar or list view shows upcoming stops',          roles: ['commercial'] },
  { id: 'com_invoice',   label: 'Open an invoice and check line items',       hint: 'Paid and outstanding invoices should both appear',    roles: ['commercial'] },
  { id: 'com_support',   label: 'Submit a support request',                   hint: 'Opens email or in-app form',                          roles: ['commercial'] },
  { id: 'com_history',   label: 'View pickup history and inspection results', hint: 'Past pickups with green/yellow/red status',           roles: ['commercial'] },

  // ── Driver ───────────────────────────────────────────────
  { id: 'drv_route',     label: "View today's assigned route stops",          hint: 'Stop list shows correct order and status',            roles: ['driver'] },
  { id: 'drv_checklist', label: 'Complete safety checklist before first stop',hint: 'All items required — cannot skip',                   roles: ['driver'] },
  { id: 'drv_arrive',    label: 'Mark a stop as Arrived',                     hint: 'Status badge updates to Arrived',                    roles: ['driver'] },
  { id: 'drv_inspect',   label: 'Perform a bag/bin inspection',               hint: 'AI result + checklist both show',                    roles: ['driver'] },
  { id: 'drv_complete',  label: 'Complete a stop',                            hint: 'Stop moves to Completed in the list',                 roles: ['driver'] },
  { id: 'drv_flag',      label: 'Flag a stop with a reason',                  hint: 'Flagged stops show admin review notice',              roles: ['driver'] },
  { id: 'drv_earnings',  label: 'View earnings dashboard',                    hint: 'Per-stop and total earnings visible',                 roles: ['driver'] },
  { id: 'drv_dispatch',  label: 'Send and receive a dispatch message',        hint: 'Message appears in conversation thread',              roles: ['driver'] },
  { id: 'drv_optimize',  label: 'Trigger route optimization',                 hint: 'Stop order changes after tap',                       roles: ['driver'] },

  // ── Warehouse ─────────────────────────────────────────────
  { id: 'wh_expected',   label: 'View expected incoming loads',               hint: 'En-route loads appear with driver and ETA',          roles: ['warehouse', 'warehouse_supervisor'] },
  { id: 'wh_receive',    label: 'Receive an incoming load',                   hint: 'Scan or manually confirm → status changes',          roles: ['warehouse', 'warehouse_supervisor'] },
  { id: 'wh_weight',     label: 'Log weight and classification',              hint: 'Enter weight, pick green/yellow/red',                 roles: ['warehouse', 'warehouse_supervisor'] },
  { id: 'wh_flag',       label: 'Flag a contamination issue',                 hint: 'Red classification triggers supervisor notice',       roles: ['warehouse', 'warehouse_supervisor'] },
  { id: 'wh_process',    label: 'Move a load to processing queue',            hint: 'Load appears in processing screen',                  roles: ['warehouse', 'warehouse_supervisor'] },
  { id: 'wh_offline',    label: 'Receive a load while offline',               hint: 'Draft saves locally; syncs on reconnect',            roles: ['warehouse', 'warehouse_supervisor'] },

  // ── Admin ─────────────────────────────────────────────────
  { id: 'adm_dashboard', label: 'View full admin dashboard',                  hint: 'Commercial ops, driver payouts, warehouse visible',  roles: ['admin'] },
  { id: 'adm_inspect',   label: 'Review a pending inspection',                hint: 'Approve or request re-inspection',                   roles: ['admin'] },
  { id: 'adm_override',  label: 'Override a driver decision',                 hint: 'Add reason — logged in audit trail',                 roles: ['admin'] },
  { id: 'adm_dispatch',  label: 'Send a dispatch message to a driver',        hint: 'Driver receives push notification',                  roles: ['admin'] },
  { id: 'adm_audit',     label: 'Check the audit log',                        hint: 'Recent events appear with timestamp and user',       roles: ['admin'] },
  { id: 'adm_accounts',  label: 'View commercial accounts',                   hint: 'Account list with status and recent activity',       roles: ['admin'] },
  { id: 'adm_payouts',   label: 'View driver payout summary',                 hint: 'Earnings per driver visible',                        roles: ['admin'] },
]

const ROLE_LABELS: Record<string, string> = {
  commercial:          'Commercial',
  driver:              'Driver',
  warehouse:           'Warehouse',
  warehouse_supervisor:'Warehouse Supervisor',
  admin:               'Admin',
}

const STORAGE_KEY = 'baykid_beta_checklist'

function loadState(): Record<string, CheckStatus> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

export default function BetaChecklist() {
  const navigate    = useNavigate()
  const profile     = useAuthStore(s => s.profile)
  const [a, setA]   = useState(false)

  const detectedRole = profile?.role ?? 'driver'
  const [selectedRole, setSelectedRole] = useState(detectedRole)
  const [statuses, setStatuses]         = useState<Record<string, CheckStatus>>(loadState)

  useEffect(() => { const id = requestAnimationFrame(() => setA(true)); return () => cancelAnimationFrame(id) }, [])

  // Persist on every change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(statuses))
  }, [statuses])

  function setStatus(id: string, status: CheckStatus) {
    setStatuses(prev => ({ ...prev, [id]: status }))
  }

  function cycleStatus(id: string) {
    const current = statuses[id] ?? 'pending'
    const next: Record<CheckStatus, CheckStatus> = { pending: 'pass', pass: 'fail', fail: 'skip', skip: 'pending' }
    setStatus(id, next[current])
  }

  const visibleChecks = ALL_CHECKS.filter(c =>
    c.roles.includes('all') || c.roles.includes(selectedRole)
  )

  const passed  = visibleChecks.filter(c => statuses[c.id] === 'pass').length
  const failed  = visibleChecks.filter(c => statuses[c.id] === 'fail').length
  const skipped = visibleChecks.filter(c => statuses[c.id] === 'skip').length
  const pending = visibleChecks.length - passed - failed - skipped
  const pct     = Math.round((passed / visibleChecks.length) * 100) || 0

  const statusStyle = (status: CheckStatus): React.CSSProperties => ({
    pass:    { color: '#4ade80', border: '1.5px solid rgba(74,222,128,0.5)',  background: 'rgba(74,222,128,0.1)'  },
    fail:    { color: '#f87171', border: '1.5px solid rgba(248,113,113,0.5)', background: 'rgba(248,113,113,0.08)' },
    skip:    { color: 'rgba(255,255,255,0.35)', border: '1.5px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.03)' },
    pending: { color: 'rgba(255,255,255,0.25)', border: '1.5px solid rgba(255,255,255,0.1)',  background: 'transparent' },
  }[status])

  const statusLabel: Record<CheckStatus, string> = { pass: '✓', fail: '✗', skip: '—', pending: '○' }

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden" style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}>
      <div className="pointer-events-none absolute inset-0 grid-bg" />

      <header className="relative flex items-center justify-between px-4 py-3" style={{ background: 'rgba(4,10,24,0.92)', borderBottom: '1px solid rgba(0,200,255,0.12)', backdropFilter: 'blur(12px)', zIndex: 2 }}>
        <div className="flex items-center gap-3">
          <span className="text-xl font-extrabold" style={{ color: '#00c8ff' }}>Cyan's Brooklynn</span>
          <span style={{ color: 'rgba(0,200,255,0.3)' }}>|</span>
          <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>Test Checklist</span>
        </div>
        <button onClick={() => navigate('/beta')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
          ← Beta Home
        </button>
      </header>

      <div className="relative flex-1 overflow-y-auto pb-20" style={{ zIndex: 1 }}>
        <div className="max-w-[520px] mx-auto px-4 pt-6 pb-8">

          {/* Role selector */}
          <div className="mb-5" style={fade(a, 0)}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)', marginBottom: 8 }}>Testing As</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(ROLE_LABELS).map(([role, label]) => (
                <button
                  key={role}
                  onClick={() => setSelectedRole(role as import('../../types').Role)}
                  className="px-3 py-1.5 rounded-full text-xs font-bold transition-all"
                  style={{
                    background: selectedRole === role ? 'rgba(0,200,255,0.15)' : 'rgba(255,255,255,0.04)',
                    border: selectedRole === role ? '1px solid rgba(0,200,255,0.4)' : '1px solid rgba(255,255,255,0.08)',
                    color: selectedRole === role ? '#00c8ff' : 'rgba(255,255,255,0.4)',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Progress bar */}
          <div className="rounded-2xl p-4 mb-5" style={{ background: 'rgba(0,87,231,0.08)', border: '1px solid rgba(0,200,255,0.13)', ...fade(a, 40) }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold" style={{ color: '#ffffff' }}>Progress — {ROLE_LABELS[selectedRole]}</p>
              <span className="text-xs font-extrabold" style={{ color: pct === 100 ? '#4ade80' : '#00c8ff' }}>{pct}%</span>
            </div>
            <div className="rounded-full overflow-hidden" style={{ height: 6, background: 'rgba(255,255,255,0.06)' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? '#4ade80' : 'linear-gradient(90deg, #0057e7, #00c8ff)', transition: 'width 0.4s ease', borderRadius: 999 }} />
            </div>
            <div className="flex gap-4 mt-2.5">
              {[
                { label: 'Pass',   count: passed,  color: '#4ade80' },
                { label: 'Fail',   count: failed,  color: '#f87171' },
                { label: 'Skip',   count: skipped, color: 'rgba(255,255,255,0.3)' },
                { label: 'Pending',count: pending, color: 'rgba(255,255,255,0.2)' },
              ].map(({ label, count, color }) => (
                <div key={label} className="flex items-center gap-1">
                  <span style={{ fontSize: 10, fontWeight: 700, color }}>{count}</span>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Tap-to-cycle hint */}
          <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.25)', ...fade(a, 60) }}>
            Tap any item to cycle: Pending → Pass → Fail → Skip
          </p>

          {/* Checklist items */}
          <div className="flex flex-col gap-2" style={fade(a, 80)}>
            {visibleChecks.map((item, i) => {
              const status = statuses[item.id] ?? 'pending'
              return (
                <button
                  key={item.id}
                  onClick={() => cycleStatus(item.id)}
                  className="flex items-start gap-3 rounded-2xl px-4 py-3.5 text-left w-full transition-all hover:brightness-110"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    animationDelay: `${80 + i * 20}ms`,
                  }}
                >
                  {/* Status badge */}
                  <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm" style={statusStyle(status)}>
                    {statusLabel[status]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-snug" style={{ color: status === 'pass' ? '#4ade80' : status === 'fail' ? '#f87171' : '#ffffff', textDecoration: status === 'skip' ? 'line-through' : 'none', opacity: status === 'skip' ? 0.4 : 1 }}>
                      {item.label}
                    </p>
                    {item.hint && (
                      <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{item.hint}</p>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-6" style={fade(a, 200)}>
            <button
              onClick={() => navigate('/beta/feedback')}
              className="flex-1 rounded-2xl py-3 text-sm font-bold transition-all hover:brightness-110"
              style={{ background: 'rgba(94,234,212,0.08)', border: '1px solid rgba(94,234,212,0.2)', color: '#5eead4' }}
            >
              Report an Issue →
            </button>
            <button
              onClick={() => {
                const reset: Record<string, CheckStatus> = {}
                visibleChecks.forEach(c => { reset[c.id] = 'pending' })
                setStatuses(prev => ({ ...prev, ...reset }))
              }}
              className="rounded-2xl px-4 py-3 text-xs font-bold transition-all hover:opacity-70"
              style={{ background: 'none', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)' }}
            >
              Reset
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
