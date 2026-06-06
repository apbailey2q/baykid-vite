import { useState, useEffect, useCallback } from 'react'
import { AppShell } from '../../components/ui/AppShell'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { PrimaryButton } from '../../components/ui/PrimaryButton'

// ── Types ──────────────────────────────────────────────────────────────────────

type CheckStatus    = 'pending' | 'pass' | 'fail'
type PhaseStatus    = 'pending' | 'active' | 'complete'
type PriorityStatus = 'pending' | 'in_progress' | 'done' | 'blocked'
type TabId          = 'qa' | 'roadmap' | 'priority'

interface StoredState {
  qa:          Record<string, CheckStatus>
  phaseItems:  Record<string, boolean>
  priority:    Record<string, PriorityStatus>
}

// ── Static data ────────────────────────────────────────────────────────────────

const QA_FORECASTING: { id: string; text: string }[] = [
  { id: 'qf1',  text: 'Forecast cards load from Supabase or fall back to demo data' },
  { id: 'qf2',  text: 'Confidence scores render as percentage bar' },
  { id: 'qf3',  text: 'Region labels appear on each forecast card' },
  { id: 'qf4',  text: 'Priority badges show Critical / High / Medium / Info correctly' },
  { id: 'qf5',  text: 'Approve button transitions forecast to "approved" status' },
  { id: 'qf6',  text: 'Ignore button transitions forecast to "ignored" status' },
  { id: 'qf7',  text: 'Escalate requires a note — cannot confirm with empty field' },
  { id: 'qf8',  text: 'Escalated forecasts remain in Active tab with Escalated badge' },
  { id: 'qf9',  text: 'Resolved tab shows approved and ignored forecasts only' },
  { id: 'qf10', text: 'No auto-dispatch occurs — admin must explicitly approve each action' },
]

const QA_SAFETY: { id: string; text: string }[] = [
  { id: 'qs1',  text: 'AI cannot automatically approve commercial inspection results' },
  { id: 'qs2',  text: 'AI cannot reject or cancel commercial pickup requests' },
  { id: 'qs3',  text: 'AI cannot reroute drivers without explicit admin confirmation' },
  { id: 'qs4',  text: 'AI cannot override admin decisions or change admin settings' },
  { id: 'qs5',  text: 'Private invoices (Stripe, bank) not present in forecast summaries' },
  { id: 'qs6',  text: 'Exact customer addresses not exposed to municipal or executive users' },
  { id: 'qs7',  text: 'Driver exact GPS coordinates excluded from all forecast outputs' },
  { id: 'qs8',  text: 'Driver earnings not included in any forecasting output' },
  { id: 'qs9',  text: 'Contamination and safety alerts never suppressed by forecasting logic' },
  { id: 'qs10', text: 'Every admin action logs acted_by, timestamp, and note for audit' },
]

interface Phase {
  id:    string
  phase: number
  title: string
  color: string
  items: { id: string; text: string }[]
}

const PHASES: Phase[] = [
  {
    id: 'phase1', phase: 1, title: 'Internal Demo', color: '#60a5fa',
    items: [
      { id: 'p1a', text: 'Demo accounts (consumer, driver, warehouse, commercial, admin)' },
      { id: 'p1b', text: 'Investor dashboard with aggregated metrics' },
      { id: 'p1c', text: 'Admin dashboard with full operational view' },
      { id: 'p1d', text: 'Commercial workflow (request → pickup → invoice)' },
      { id: 'p1e', text: 'Driver workflow (hybrid routing, scan, inspection)' },
      { id: 'p1f', text: 'Warehouse workflow (intake, processing, commercial sorting)' },
    ],
  },
  {
    id: 'phase2', phase: 2, title: 'Closed Beta', color: '#a78bfa',
    items: [
      { id: 'p2a', text: '1–3 commercial customers onboarded' },
      { id: 'p2b', text: '1–2 drivers tested end-to-end' },
      { id: 'p2c', text: '1 warehouse operational with live intake' },
      { id: 'p2d', text: '1 admin / operator trained and running live operations' },
      { id: 'p2e', text: 'Push notifications live and verified across all roles' },
      { id: 'p2f', text: 'Stripe test mode validated with real payment flow' },
    ],
  },
  {
    id: 'phase3', phase: 3, title: 'Pilot Launch', color: '#4ade80',
    items: [
      { id: 'p3a', text: 'Real commercial pickup requests active' },
      { id: 'p3b', text: 'Real warehouse intake and sorting live' },
      { id: 'p3c', text: 'Stripe test-to-live payment transition completed' },
      { id: 'p3d', text: 'Monitored driver routing with admin fallback' },
      { id: 'p3e', text: 'RLS security audit passed — all unauthorized access blocked' },
      { id: 'p3f', text: 'Insurance and compliance confirmed for operations' },
    ],
  },
  {
    id: 'phase4', phase: 4, title: 'City / Partner Demo', color: '#5eead4',
    items: [
      { id: 'p4a', text: 'Municipal dashboard configured for Nashville' },
      { id: 'p4b', text: 'ESG reports generated and exported (PDF + CSV)' },
      { id: 'p4c', text: 'Impact metrics published and verified' },
      { id: 'p4d', text: 'Coverage map displayed in city dashboard' },
      { id: 'p4e', text: 'City partnership agreement signed' },
    ],
  },
  {
    id: 'phase5', phase: 5, title: 'Production Expansion', color: '#fbbf24',
    items: [
      { id: 'p5a', text: 'Multi-region support active (Memphis, Chattanooga)' },
      { id: 'p5b', text: 'Additional warehouses operational' },
      { id: 'p5c', text: 'Driver network expanded (25+ drivers)' },
      { id: 'p5d', text: 'Commercial accounts scaled (100+ accounts)' },
      { id: 'p5e', text: 'AI forecasting activated with live production data' },
      { id: 'p5f', text: 'National expansion readiness assessment complete' },
    ],
  },
]

interface PriorityItem {
  id:   string
  num:  number
  text: string
  desc: string
}

const PRIORITY_ITEMS: PriorityItem[] = [
  { id: 'pr1',  num: 1,  text: 'RLS / security tests',
    desc: 'Verify all row-level security policies block unauthorized access across every role' },
  { id: 'pr2',  num: 2,  text: 'Commercial pickup end-to-end',
    desc: 'Request → dispatch → driver pickup → warehouse intake → invoice generation' },
  { id: 'pr3',  num: 3,  text: 'Driver inspection / review test',
    desc: 'Bag scan → inspection form → contamination flag → admin review workflow' },
  { id: 'pr4',  num: 4,  text: 'Warehouse intake test',
    desc: 'Commercial load arrival → intake checklist → capacity update → sorting assignment' },
  { id: 'pr5',  num: 5,  text: 'Invoice / payment test',
    desc: 'Stripe billing cycle, invoice generation, payment confirmation, admin payout view' },
  { id: 'pr6',  num: 6,  text: 'Push notification test',
    desc: 'Pickup alerts, driver dispatch messages, approval notifications across all roles' },
  { id: 'pr7',  num: 7,  text: 'Mobile 375px QA',
    desc: 'All screens pass at minimum mobile viewport with no horizontal scroll or overflow' },
  { id: 'pr8',  num: 8,  text: 'Demo environment polish',
    desc: 'Seed data, demo accounts, HUD controls, presentation mode fully functional' },
  { id: 'pr9',  num: 9,  text: 'Beta tester onboarding',
    desc: 'Account setup, training guide, feedback collection loop established' },
  { id: 'pr10', num: 10, text: 'Production deployment',
    desc: 'Environment variables, domain DNS, SSL, Supabase prod migration, monitoring setup' },
]

// ── Persistence ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'baykid_launch_v1'

function defaultState(): StoredState {
  return { qa: {}, phaseItems: {}, priority: {} }
}

function loadState(): StoredState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as StoredState) : defaultState()
  } catch {
    return defaultState()
  }
}

function saveState(s: StoredState) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) } catch { /* quota */ }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fade(v: boolean, delay = 0): React.CSSProperties {
  return {
    opacity: v ? 1 : 0,
    transform: v ? 'translateY(0)' : 'translateY(12px)',
    transition: `opacity 0.35s ease ${delay}ms, transform 0.35s ease ${delay}ms`,
  }
}

function cycleCheck(c: CheckStatus): CheckStatus {
  return c === 'pending' ? 'pass' : c === 'pass' ? 'fail' : 'pending'
}

function cyclePriority(c: PriorityStatus): PriorityStatus {
  const order: PriorityStatus[] = ['pending', 'in_progress', 'done', 'blocked']
  return order[(order.indexOf(c) + 1) % order.length]
}

function phaseStatus(phase: Phase, items: Record<string, boolean>): PhaseStatus {
  const done = phase.items.filter(i => items[i.id]).length
  if (done === 0) return 'pending'
  if (done === phase.items.length) return 'complete'
  return 'active'
}

function CheckIcon({ status }: { status: CheckStatus }) {
  if (status === 'pass') return <span style={{ color: '#4ade80', fontSize: 15, fontWeight: 800 }}>✓</span>
  if (status === 'fail') return <span style={{ color: '#f87171', fontSize: 15, fontWeight: 800 }}>✗</span>
  return <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>○</span>
}

function PriorityStatusBadge({ status }: { status: PriorityStatus }) {
  const map: Record<PriorityStatus, { variant: Parameters<typeof StatusBadge>[0]['variant']; label: string }> = {
    pending:     { variant: 'gray',  label: 'Pending' },
    in_progress: { variant: 'blue',  label: 'In Progress' },
    done:        { variant: 'green', label: 'Done' },
    blocked:     { variant: 'red',   label: 'Blocked' },
  }
  const { variant, label } = map[status]
  return <StatusBadge variant={variant} label={label} dot size="sm" />
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function AdminLaunchRoadmap() {
  const [tab, setTab]       = useState<TabId>('qa')
  const [visible, setVisible] = useState(false)
  const [state, setState_]  = useState<StoredState>(loadState)

  function setState(next: StoredState) {
    setState_(next)
    saveState(next)
  }

  useEffect(() => {
    setVisible(false)
    const t = setTimeout(() => setVisible(true), 40)
    return () => clearTimeout(t)
  }, [tab])

  function toggleQa(id: string) {
    const next = { ...state, qa: { ...state.qa, [id]: cycleCheck(state.qa[id] ?? 'pending') } }
    setState(next)
  }

  function togglePhaseItem(id: string) {
    const next = { ...state, phaseItems: { ...state.phaseItems, [id]: !state.phaseItems[id] } }
    setState(next)
  }

  function togglePriority(id: string) {
    const next = { ...state, priority: { ...state.priority, [id]: cyclePriority(state.priority[id] ?? 'pending') } }
    setState(next)
  }

  function resetAll() {
    if (!confirm('Reset all progress? This cannot be undone.')) return
    setState(defaultState())
  }

  const allQa        = [...QA_FORECASTING, ...QA_SAFETY]
  const qaPassed     = allQa.filter(i => state.qa[i.id] === 'pass').length
  const qaFailed     = allQa.filter(i => state.qa[i.id] === 'fail').length
  const phasesDone   = PHASES.filter(p => phaseStatus(p, state.phaseItems) === 'complete').length
  const priorityDone = PRIORITY_ITEMS.filter(i => state.priority[i.id] === 'done').length

  const overallPct = Math.round(
    ((qaPassed + phasesDone * 4 + priorityDone * 3) /
     (allQa.length + PHASES.length * 4 + PRIORITY_ITEMS.length * 3)) * 100,
  )

  const exportSummary = useCallback(() => {
    const lines: string[] = [
      `Cyan&#39;s Brooklynn Launch Readiness — ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
      '='.repeat(52),
      '',
      `OVERALL READINESS: ${overallPct}%`,
      '',
      `── FORECASTING QA (${QA_FORECASTING.filter(i => state.qa[i.id] === 'pass').length}/${QA_FORECASTING.length} passed) ──`,
      ...QA_FORECASTING.map(i => {
        const s = state.qa[i.id] ?? 'pending'
        const mark = s === 'pass' ? '[✓]' : s === 'fail' ? '[✗]' : '[ ]'
        return `  ${mark} ${i.text}`
      }),
      '',
      `── SAFETY CHECKS (${QA_SAFETY.filter(i => state.qa[i.id] === 'pass').length}/${QA_SAFETY.length} passed) ──`,
      ...QA_SAFETY.map(i => {
        const s = state.qa[i.id] ?? 'pending'
        const mark = s === 'pass' ? '[✓]' : s === 'fail' ? '[✗]' : '[ ]'
        return `  ${mark} ${i.text}`
      }),
      '',
      `── LAUNCH ROADMAP (${phasesDone}/${PHASES.length} phases complete) ──`,
      ...PHASES.map(p => {
        const ps = phaseStatus(p, state.phaseItems)
        const done = p.items.filter(i => state.phaseItems[i.id]).length
        return `  Phase ${p.phase} — ${p.title}: ${ps.toUpperCase()} (${done}/${p.items.length})`
      }),
      '',
      `── PRIORITY LIST (${priorityDone}/${PRIORITY_ITEMS.length} done) ──`,
      ...PRIORITY_ITEMS.map(i => {
        const s = state.priority[i.id] ?? 'pending'
        const mark = s === 'done' ? '[✓]' : s === 'blocked' ? '[!]' : s === 'in_progress' ? '[→]' : '[ ]'
        return `  ${mark} ${i.num}. ${i.text}`
      }),
      '',
      '─ Generated by Cyan&#39;s Brooklynn Admin · Confidential ─',
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `baykid-launch-readiness-${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }, [state, overallPct, phasesDone, priorityDone])

  const TABS: { id: TabId; label: string; icon: string }[] = [
    { id: 'qa',       label: 'QA Checks',    icon: '🔬' },
    { id: 'roadmap',  label: 'Roadmap',       icon: '🗺️' },
    { id: 'priority', label: 'Priority List', icon: '📋' },
  ]

  return (
    <AppShell>
      <PageHeader
        rightContent={
          <PrimaryButton size="sm" variant="secondary" onClick={exportSummary}>
            Export Summary
          </PrimaryButton>
        }
      />

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '20px 16px 100px' }}>

        {/* Title */}
        <div style={{ ...fade(visible, 0), marginBottom: 16 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 4 }}>
            Launch Readiness
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
            Forecasting QA · Security Checks · Roadmap · Priority List
          </p>
        </div>

        {/* Overall progress bar */}
        <div style={{ ...fade(visible, 40), marginBottom: 24 }}>
          <div style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14, padding: '16px 20px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Overall Readiness</span>
              <span style={{ fontSize: 20, fontWeight: 800, color: overallPct >= 80 ? '#4ade80' : overallPct >= 50 ? '#fbbf24' : '#f87171' }}>
                {overallPct}%
              </span>
            </div>
            <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                width: `${overallPct}%`, height: '100%', borderRadius: 4,
                background: overallPct >= 80 ? '#4ade80' : overallPct >= 50 ? '#fbbf24' : '#f87171',
                transition: 'width 0.7s ease',
              }} />
            </div>
          </div>
        </div>

        {/* Stat row */}
        <div style={{ ...fade(visible, 60), display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 24 }}>
          {[
            { icon: '✅', label: 'QA Passed',    value: `${qaPassed}/${allQa.length}`,          color: '#4ade80' },
            { icon: '❌', label: 'QA Failed',     value: qaFailed > 0 ? String(qaFailed) : '0',  color: qaFailed > 0 ? '#f87171' : 'rgba(255,255,255,0.3)' },
            { icon: '🚀', label: 'Phases Done',   value: `${phasesDone}/${PHASES.length}`,        color: '#60a5fa' },
            { icon: '📋', label: 'Priority Done', value: `${priorityDone}/${PRIORITY_ITEMS.length}`, color: '#a78bfa' },
          ].map(({ icon, label, value, color }) => (
            <div key={label} style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 14, padding: '14px 16px',
            }}>
              <div style={{ fontSize: 18, marginBottom: 5 }}>{icon}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Tab bar */}
        <div style={{ ...fade(visible, 80), display: 'flex', gap: 6, marginBottom: 24, flexWrap: 'wrap' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              background: tab === t.id ? 'rgba(0,200,255,0.14)' : 'rgba(255,255,255,0.04)',
              border: tab === t.id ? '1px solid rgba(0,200,255,0.35)' : '1px solid rgba(255,255,255,0.08)',
              borderRadius: 10, padding: '8px 16px',
              color: tab === t.id ? '#00c8ff' : 'rgba(255,255,255,0.55)',
              fontSize: 13, fontWeight: tab === t.id ? 700 : 400,
              cursor: 'pointer', display: 'flex', gap: 6, alignItems: 'center',
            }}>
              <span>{t.icon}</span>{t.label}
            </button>
          ))}
          <button onClick={resetAll} style={{
            marginLeft: 'auto', background: 'none',
            border: '1px solid rgba(248,113,113,0.2)',
            borderRadius: 10, padding: '8px 14px',
            color: 'rgba(248,113,113,0.5)', fontSize: 12, cursor: 'pointer',
          }}>
            Reset All
          </button>
        </div>

        {/* ── QA CHECKS ────────────────────────────────────────────────────── */}
        {tab === 'qa' && (
          <div style={fade(visible, 0)}>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 20 }}>
              Click any item to cycle: <span style={{ color: 'rgba(255,255,255,0.25)' }}>Pending</span> →{' '}
              <span style={{ color: '#4ade80' }}>Pass</span> → <span style={{ color: '#f87171' }}>Fail</span> → Pending
            </p>

            {/* Forecasting QA */}
            <CheckSection
              title="Forecasting QA"
              items={QA_FORECASTING}
              qa={state.qa}
              onToggle={toggleQa}
            />

            {/* Safety Checks */}
            <CheckSection
              title="Forecast Safety Checks"
              items={QA_SAFETY}
              qa={state.qa}
              onToggle={toggleQa}
              accent="#f87171"
            />
          </div>
        )}

        {/* ── ROADMAP ───────────────────────────────────────────────────────── */}
        {tab === 'roadmap' && (
          <div style={fade(visible, 0)}>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 20 }}>
              Check off items as each phase completes. Phase status updates automatically.
            </p>

            {PHASES.map((phase, pi) => {
              const ps      = phaseStatus(phase, state.phaseItems)
              const doneN   = phase.items.filter(i => state.phaseItems[i.id]).length
              const pctDone = Math.round((doneN / phase.items.length) * 100)
              const psVariant: Record<PhaseStatus, Parameters<typeof StatusBadge>[0]['variant']> = {
                pending: 'gray', active: 'blue', complete: 'green',
              }
              const psLabel: Record<PhaseStatus, string> = {
                pending: 'Pending', active: 'In Progress', complete: 'Complete',
              }
              return (
                <div key={phase.id} style={{
                  ...fade(visible, pi * 60),
                  background: 'rgba(255,255,255,0.04)',
                  border: `1px solid ${ps === 'complete' ? phase.color + '30' : 'rgba(255,255,255,0.08)'}`,
                  borderLeft: `3px solid ${phase.color}`,
                  borderRadius: 14, padding: 20, marginBottom: 14,
                }}>
                  {/* Phase header */}
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 14 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                      background: `${phase.color}18`, border: `1px solid ${phase.color}40`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 800, color: phase.color,
                    }}>
                      {phase.phase}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                        <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>
                          Phase {phase.phase} — {phase.title}
                        </span>
                        <StatusBadge variant={psVariant[ps]} label={psLabel[ps]} dot size="sm" />
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{
                            width: `${pctDone}%`, height: '100%', borderRadius: 4,
                            background: phase.color, transition: 'width 0.6s ease',
                          }} />
                        </div>
                        <span style={{ fontSize: 11, color: phase.color, fontWeight: 600, minWidth: 36 }}>
                          {doneN}/{phase.items.length}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Items */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {phase.items.map(item => {
                      const done = !!state.phaseItems[item.id]
                      return (
                        <button
                          key={item.id}
                          onClick={() => togglePhaseItem(item.id)}
                          style={{
                            display: 'flex', gap: 10, alignItems: 'center',
                            background: done ? `${phase.color}08` : 'none',
                            border: `1px solid ${done ? phase.color + '25' : 'rgba(255,255,255,0.04)'}`,
                            borderRadius: 8, padding: '8px 12px',
                            cursor: 'pointer', textAlign: 'left',
                          }}
                        >
                          <span style={{
                            fontSize: 14, flexShrink: 0,
                            color: done ? phase.color : 'rgba(255,255,255,0.2)',
                            fontWeight: done ? 800 : 400,
                          }}>
                            {done ? '✓' : '○'}
                          </span>
                          <span style={{
                            fontSize: 13,
                            color: done ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.5)',
                            textDecoration: done ? 'none' : 'none',
                            lineHeight: 1.4,
                          }}>
                            {item.text}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── PRIORITY LIST ─────────────────────────────────────────────────── */}
        {tab === 'priority' && (
          <div style={fade(visible, 0)}>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 20 }}>
              Click status badge to cycle: Pending → In Progress → Done → Blocked. Work top-to-bottom.
            </p>

            {PRIORITY_ITEMS.map((item, i) => {
              const status = state.priority[item.id] ?? 'pending'
              const borderColor = status === 'done' ? '#4ade80' : status === 'blocked' ? '#f87171' : status === 'in_progress' ? '#00c8ff' : 'rgba(255,255,255,0.06)'
              return (
                <div key={item.id} style={{
                  ...fade(visible, i * 40),
                  background: 'rgba(255,255,255,0.04)',
                  border: `1px solid ${borderColor}`,
                  borderLeft: `3px solid ${borderColor}`,
                  borderRadius: 12, padding: '14px 18px',
                  marginBottom: 10,
                  opacity: status === 'done' ? 0.65 : 1,
                }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    {/* Number */}
                    <div style={{
                      width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                      background: 'rgba(255,255,255,0.06)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.5)',
                    }}>
                      {item.num}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                        <span style={{
                          color: status === 'done' ? 'rgba(255,255,255,0.5)' : '#fff',
                          fontWeight: 700, fontSize: 14,
                          textDecoration: status === 'done' ? 'line-through' : 'none',
                        }}>
                          {item.text}
                        </span>
                        <button
                          onClick={() => togglePriority(item.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                        >
                          <PriorityStatusBadge status={status} />
                        </button>
                      </div>
                      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: 0, lineHeight: 1.5 }}>
                        {item.desc}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Completion note */}
            <div style={{
              marginTop: 16, background: 'rgba(0,200,255,0.06)',
              border: '1px solid rgba(0,200,255,0.18)', borderRadius: 14, padding: 20,
            }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#00c8ff', marginBottom: 8 }}>
                After all 10 items — you're ready to monitor production.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  'Keep the admin dashboard open at all times during pilot week',
                  'Check contamination alerts daily — flag anything above 10%',
                  'Review warehouse capacity before each morning dispatch window',
                  'Monitor driver online status and respond to shortfalls within 2 hours',
                  'Run weekly ESG export for city partnership reporting',
                  'Review AI forecasting daily — approve or escalate all open items',
                ].map(tip => (
                  <div key={tip} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ color: '#00c8ff', fontSize: 13, flexShrink: 0 }}>›</span>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>{tip}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}

// ── CheckSection ───────────────────────────────────────────────────────────────

function CheckSection({
  title, items, qa, onToggle, accent = '#4ade80',
}: {
  title:   string
  items:   { id: string; text: string }[]
  qa:      Record<string, CheckStatus>
  onToggle: (id: string) => void
  accent?: string
}) {
  const passed  = items.filter(i => qa[i.id] === 'pass').length
  const failed  = items.filter(i => qa[i.id] === 'fail').length
  const pending = items.length - passed - failed

  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderLeft: `3px solid ${accent}`,
      borderRadius: 14, padding: 20, marginBottom: 20,
    }}>
      {/* Section header */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>{title}</span>
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
          <span style={{ fontSize: 11, color: '#4ade80', background: 'rgba(74,222,128,0.1)', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>
            {passed} passed
          </span>
          {failed > 0 && (
            <span style={{ fontSize: 11, color: '#f87171', background: 'rgba(248,113,113,0.1)', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>
              {failed} failed
            </span>
          )}
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: 10 }}>
            {pending} pending
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 4, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{
          width: `${Math.round((passed / items.length) * 100)}%`,
          height: '100%', background: accent, borderRadius: 4, transition: 'width 0.5s ease',
        }} />
      </div>

      {/* Items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {items.map(item => {
          const status = qa[item.id] ?? 'pending'
          return (
            <button
              key={item.id}
              onClick={() => onToggle(item.id)}
              style={{
                display: 'flex', gap: 12, alignItems: 'flex-start',
                background: status === 'pass'
                  ? 'rgba(74,222,128,0.04)'
                  : status === 'fail'
                  ? 'rgba(248,113,113,0.04)'
                  : 'none',
                border: '1px solid transparent',
                borderRadius: 8, padding: '8px 10px',
                cursor: 'pointer', textAlign: 'left', width: '100%',
              }}
            >
              <span style={{ flexShrink: 0, marginTop: 1 }}>
                <CheckIcon status={status} />
              </span>
              <span style={{
                fontSize: 13,
                color: status === 'pass'
                  ? 'rgba(255,255,255,0.7)'
                  : status === 'fail'
                  ? '#f87171'
                  : 'rgba(255,255,255,0.55)',
                lineHeight: 1.5,
                textDecoration: status === 'pass' ? 'line-through' : 'none',
                textDecorationColor: 'rgba(255,255,255,0.25)',
              }}>
                {item.text}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
