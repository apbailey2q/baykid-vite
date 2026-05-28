// StagingQA.tsx — Interactive staging QA checklist for BayKid AI Marketing Center
//
// Features:
//   • 8 sections, 30 items (from qaItems.ts)
//   • Per-item status: pass ✓ | fail ✗ | skip ⏭ | pending —
//   • Step-by-step test instructions (expandable)
//   • Live progress bar + section progress pills
//   • Auto-saves draft to localStorage every change
//   • Submit to Supabase (qa_checklist_runs) for history tracking
//   • History panel shows last 10 submitted runs
//   • Critical items are flagged — all must pass before release

import { useState, useEffect, useCallback } from 'react'
import {
  QA_SECTIONS, QA_ALL_ITEMS, emptyItemsMap, tallyItems, tallySections,
  type QAItem, type QASection,
} from '../../../lib/qaItems'
import { loadDraft, saveDraft, clearDraft, submitRun, listRecentRuns } from '../../../lib/qaChecklist'
import type { QAItemStatus, QAEnvironment, QAChecklistRunRow } from '../../../types/betaLaunch'

// ── Constants ─────────────────────────────────────────────────────────────────

const SUITE   = 'ai_marketing' as const
const ENVS: QAEnvironment[] = ['local', 'staging', 'production']

const STATUS_META: Record<QAItemStatus, { icon: string; label: string; color: string; bg: string; border: string }> = {
  pending: { icon: '—',  label: 'Pending', color: 'rgba(255,255,255,0.3)',  bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.1)'  },
  pass:    { icon: '✓',  label: 'Pass',    color: '#22c55e',                bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.3)'   },
  fail:    { icon: '✗',  label: 'Fail',    color: '#f87171',                bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.3)'   },
  skip:    { icon: '⏭',  label: 'Skip',    color: '#fbbf24',                bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.25)' },
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background:   'rgba(255,255,255,0.04)',
  border:       '1px solid rgba(255,255,255,0.08)',
  borderRadius: 12,
  padding:      '16px 18px',
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ pct, criticalFails }: { pct: number; criticalFails: number }) {
  const color = criticalFails > 0 ? '#ef4444' : pct === 100 ? '#22c55e' : '#00c8ff'
  return (
    <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.3s ease' }} />
    </div>
  )
}

// ── Item status button group ──────────────────────────────────────────────────

function StatusButtons({
  current, onChange,
}: { current: QAItemStatus; onChange: (s: QAItemStatus) => void }) {
  return (
    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
      {(['pass', 'fail', 'skip', 'pending'] as QAItemStatus[]).map((s) => {
        const m       = STATUS_META[s]
        const active  = current === s
        return (
          <button
            key={s}
            onClick={(e) => { e.stopPropagation(); onChange(s) }}
            title={m.label}
            style={{
              background:   active ? m.bg    : 'rgba(255,255,255,0.04)',
              border:       `1px solid ${active ? m.border : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 6,
              color:        active ? m.color : 'rgba(255,255,255,0.3)',
              cursor:       'pointer',
              fontSize:     13,
              fontWeight:   700,
              minWidth:     30,
              padding:      '4px 8px',
              transition:   'all 0.12s ease',
            }}
          >
            {m.icon}
          </button>
        )
      })}
    </div>
  )
}

// ── Single checklist item ─────────────────────────────────────────────────────

function ChecklistItem({
  item, status, onStatusChange, onNavigate,
}: {
  item:           QAItem
  status:         QAItemStatus
  onStatusChange: (id: string, s: QAItemStatus) => void
  onNavigate?:    (section: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const m = STATUS_META[status]

  return (
    <div
      style={{
        background:   m.bg,
        border:       `1px solid ${m.border}`,
        borderRadius: 8,
        overflow:     'hidden',
        transition:   'border-color 0.15s ease',
      }}
    >
      {/* Row */}
      <div
        onClick={() => setExpanded((v) => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', cursor: 'pointer' }}
      >
        {/* Status dot */}
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: m.color, flexShrink: 0, marginTop: 1 }} />

        {/* Label */}
        <span style={{ flex: 1, color: status === 'fail' ? '#f87171' : status === 'pass' ? '#d1fae5' : '#fff', fontSize: 13, fontWeight: 500 }}>
          {item.label}
          {item.critical && (
            <span title="Critical — must pass before release" style={{ marginLeft: 6, fontSize: 10, color: '#fbbf24', fontWeight: 700 }}>
              ★ CRITICAL
            </span>
          )}
        </span>

        {/* Navigate shortcut */}
        {item.appSection && onNavigate && (
          <button
            onClick={(e) => { e.stopPropagation(); onNavigate(item.appSection!) }}
            title={`Open ${item.appSection} section`}
            style={{ background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.15)', borderRadius: 5, color: 'rgba(0,200,255,0.7)', cursor: 'pointer', fontSize: 10, padding: '2px 7px', whiteSpace: 'nowrap' }}
          >
            → Open
          </button>
        )}

        {/* Step count */}
        {item.steps && (
          <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, whiteSpace: 'nowrap' }}>
            {expanded ? '▲' : '▼'} {item.steps.length} step{item.steps.length !== 1 ? 's' : ''}
          </span>
        )}

        {/* Status buttons */}
        <StatusButtons current={status} onChange={(s) => onStatusChange(item.id, s)} />
      </div>

      {/* Expanded steps */}
      {expanded && item.steps && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '10px 12px 12px 28px' }}>
          <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {item.steps.map((step, i) => (
              <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ color: '#00c8ff', fontSize: 11, fontWeight: 700, minWidth: 18, marginTop: 1 }}>
                  {i + 1}.
                </span>
                <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, lineHeight: 1.6 }}>{step}</span>
              </li>
            ))}
          </ol>
          {/* Quick set all steps to pass */}
          <button
            onClick={() => onStatusChange(item.id, 'pass')}
            style={{ marginTop: 10, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 6, color: '#22c55e', cursor: 'pointer', fontSize: 11, fontWeight: 700, padding: '4px 10px' }}
          >
            ✓ Mark as Pass
          </button>
          <button
            onClick={() => onStatusChange(item.id, 'fail')}
            style={{ marginLeft: 6, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 6, color: '#f87171', cursor: 'pointer', fontSize: 11, fontWeight: 700, padding: '4px 10px' }}
          >
            ✗ Mark as Fail
          </button>
        </div>
      )}
    </div>
  )
}

// ── Section card ──────────────────────────────────────────────────────────────

function SectionCard({
  section, items, onStatusChange, onNavigate,
}: {
  section:        QASection
  items:          Record<string, QAItemStatus>
  onStatusChange: (id: string, s: QAItemStatus) => void
  onNavigate?:    (sec: string) => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const pass    = section.items.filter((i) => items[i.id] === 'pass').length
  const fail    = section.items.filter((i) => items[i.id] === 'fail').length
  const pending = section.items.filter((i) => items[i.id] === 'pending').length
  const total   = section.items.length
  const done    = pass + fail + section.items.filter((i) => items[i.id] === 'skip').length

  // Quick-fill helpers
  const setAll = (s: QAItemStatus) => section.items.forEach((i) => onStatusChange(i.id, s))

  const sectionColor = fail > 0 ? '#ef4444' : done === total ? '#22c55e' : '#00c8ff'

  return (
    <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div
        onClick={() => setCollapsed((v) => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', cursor: 'pointer', borderBottom: collapsed ? 'none' : '1px solid rgba(255,255,255,0.06)' }}
      >
        <span style={{ fontSize: 18 }}>{section.icon}</span>
        <span style={{ color: '#fff', fontSize: 14, fontWeight: 700, flex: 1 }}>{section.label}</span>

        {/* Section mini-stats */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {pass > 0    && <span style={{ background: 'rgba(34,197,94,0.12)',  border: '1px solid rgba(34,197,94,0.25)',  color: '#22c55e', borderRadius: 20, padding: '1px 8px', fontSize: 11, fontWeight: 700 }}>{pass}✓</span>}
          {fail > 0    && <span style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', borderRadius: 20, padding: '1px 8px', fontSize: 11, fontWeight: 700 }}>{fail}✗</span>}
          {pending > 0 && <span style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)', borderRadius: 20, padding: '1px 8px', fontSize: 11 }}>{pending} left</span>}
        </div>

        {/* Mini progress */}
        <div style={{ width: 60, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', flexShrink: 0 }}>
          <div style={{ height: '100%', width: `${Math.round((done / total) * 100)}%`, background: sectionColor, borderRadius: 2, transition: 'width 0.3s ease' }} />
        </div>

        {/* Quick-fill buttons */}
        <div style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
          <button onClick={() => setAll('pass')} title="Mark all Pass" style={quickBtn('#22c55e')}>All ✓</button>
          <button onClick={() => setAll('skip')} title="Mark all Skip" style={quickBtn('#fbbf24')}>All ⏭</button>
        </div>

        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>{collapsed ? '▼' : '▲'}</span>
      </div>

      {/* Items */}
      {!collapsed && (
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {section.items.map((item) => (
            <ChecklistItem
              key={item.id}
              item={item}
              status={items[item.id] ?? 'pending'}
              onStatusChange={onStatusChange}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function quickBtn(color: string): React.CSSProperties {
  return {
    background: `${color}18`,
    border:     `1px solid ${color}44`,
    borderRadius: 5,
    color,
    cursor:    'pointer',
    fontSize:  10,
    fontWeight:700,
    padding:   '2px 7px',
    whiteSpace:'nowrap',
  }
}

// ── History panel ─────────────────────────────────────────────────────────────

function RunHistory({ runs, onLoad }: { runs: QAChecklistRunRow[]; onLoad: (r: QAChecklistRunRow) => void }) {
  if (runs.length === 0) {
    return <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, margin: 0 }}>No submitted runs yet.</p>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {runs.map((r) => {
        const total = QA_ALL_ITEMS.length
        const pct   = Math.round((r.pass_count / total) * 100)
        const envColor = r.environment === 'production' ? '#f87171' : r.environment === 'staging' ? '#fbbf24' : 'rgba(255,255,255,0.4)'
        return (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ color: envColor, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{r.environment}</span>
                <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>{r.app_version ?? 'dev'}</span>
                <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11 }}>
                  {r.submitted_at ? new Date(r.submitted_at).toLocaleString() : '—'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <span style={{ color: '#22c55e', fontSize: 11 }}>✓ {r.pass_count}</span>
                <span style={{ color: '#f87171', fontSize: 11 }}>✗ {r.fail_count}</span>
                <span style={{ color: '#fbbf24', fontSize: 11 }}>⏭ {r.skip_count}</span>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{pct}%</span>
              </div>
            </div>
            <button
              onClick={() => onLoad(r)}
              style={{ background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.2)', borderRadius: 7, color: '#00c8ff', cursor: 'pointer', fontSize: 11, fontWeight: 600, padding: '5px 10px' }}
            >
              Load
            </button>
          </div>
        )
      })}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  /** Called when the user clicks the "→ Open" shortcut next to an item */
  onNavigate?: (section: string) => void
}

export function StagingQA({ onNavigate }: Props) {
  const [env,         setEnv]         = useState<QAEnvironment>('staging')
  const [items,       setItems]       = useState<Record<string, QAItemStatus>>(emptyItemsMap)
  const [notes,       setNotes]       = useState('')
  const [submitting,  setSubmitting]  = useState(false)
  const [submitMsg,   setSubmitMsg]   = useState<{ ok: boolean; text: string } | null>(null)
  const [runs,        setRuns]        = useState<QAChecklistRunRow[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [filter,      setFilter]      = useState<'all' | 'pending' | 'fail'>('all')

  // ── Load draft on mount ────────────────────────────────────────────────────
  useEffect(() => {
    const draft = loadDraft(SUITE, env)
    if (Object.keys(draft).length > 0) {
      setItems((prev) => ({ ...prev, ...draft }))
    }
  }, [env])

  // ── Auto-save draft on every change ───────────────────────────────────────
  const handleStatusChange = useCallback((id: string, status: QAItemStatus) => {
    setItems((prev) => {
      const next = { ...prev, [id]: status }
      saveDraft(SUITE, env, next)
      return next
    })
  }, [env])

  // ── Load history ───────────────────────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    try {
      const data = await listRecentRuns(SUITE)
      setRuns(data)
    } catch { /* Supabase unavailable in dev */ }
  }, [])

  useEffect(() => { void loadHistory() }, [loadHistory])

  // ── Submit run ─────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setSubmitting(true)
    setSubmitMsg(null)
    try {
      await submitRun({ suite: SUITE, environment: env, items, notes: notes.trim() || undefined })
      clearDraft(SUITE, env)
      setSubmitMsg({ ok: true, text: 'Run submitted successfully!' })
      void loadHistory()
    } catch (err) {
      setSubmitMsg({ ok: false, text: err instanceof Error ? err.message : 'Submit failed' })
    } finally {
      setSubmitting(false)
    }
  }

  // ── Reset ──────────────────────────────────────────────────────────────────
  const handleReset = () => {
    if (!window.confirm('Reset all items to Pending? This clears your current progress.')) return
    const fresh = emptyItemsMap()
    setItems(fresh)
    clearDraft(SUITE, env)
    setNotes('')
    setSubmitMsg(null)
  }

  // ── Load a historical run ──────────────────────────────────────────────────
  const handleLoadRun = (run: QAChecklistRunRow) => {
    setItems((prev) => ({ ...prev, ...run.items }))
    setEnv(run.environment)
    setShowHistory(false)
    setSubmitMsg(null)
  }

  // ── Computed stats ─────────────────────────────────────────────────────────
  const tally    = tallyItems(items)
  const sections = tallySections(items)
  const canSubmit = tally.pass + tally.fail + tally.skip > 0 && !submitting
  const readyToRelease = tally.allCriticalPass && tally.fail === 0

  // ── Filter items ───────────────────────────────────────────────────────────
  const filterItem = (item: QAItem) => {
    if (filter === 'pending') return items[item.id] === 'pending'
    if (filter === 'fail')    return items[item.id] === 'fail'
    return true
  }

  const visibleSections = QA_SECTIONS.map((s) => ({
    ...s,
    items: s.items.filter(filterItem),
  })).filter((s) => s.items.length > 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, color: '#fff', fontSize: 20, fontWeight: 700 }}>🧪 Staging QA Checklist</h2>
          <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
            {QA_ALL_ITEMS.length} checks across {QA_SECTIONS.length} sections · auto-saves as you go
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Environment selector */}
          <select
            value={env}
            onChange={(e) => setEnv(e.target.value as QAEnvironment)}
            style={{ background: '#1a2235', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#fff', fontSize: 13, padding: '7px 10px', cursor: 'pointer' }}
          >
            {ENVS.map((e) => (
              <option key={e} value={e}>{e.charAt(0).toUpperCase() + e.slice(1)}</option>
            ))}
          </select>
          <button onClick={() => { setShowHistory((v) => !v) }} style={ghostBtn}>
            {showHistory ? '← Back to Checklist' : '📋 History'}
          </button>
          <button onClick={handleReset} style={ghostBtn}>↺ Reset</button>
        </div>
      </div>

      {showHistory ? (
        /* ── History view ── */
        <div style={card}>
          <h3 style={{ margin: '0 0 14px', color: '#fff', fontSize: 14, fontWeight: 700 }}>Recent Runs</h3>
          <RunHistory runs={runs} onLoad={handleLoadRun} />
        </div>
      ) : (
        <>
          {/* ── Overall progress ── */}
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <Stat color="#22c55e" label="Pass"    value={tally.pass} />
                <Stat color="#f87171" label="Fail"    value={tally.fail} />
                <Stat color="#fbbf24" label="Skip"    value={tally.skip} />
                <Stat color="rgba(255,255,255,0.3)" label="Pending" value={tally.pending} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
                  {tally.pass}/{QA_ALL_ITEMS.length} ({tally.pct}%)
                </span>
                {readyToRelease ? (
                  <span style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
                    ✓ READY TO RELEASE
                  </span>
                ) : tally.criticalFails > 0 ? (
                  <span style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
                    ✗ {tally.criticalFails} CRITICAL FAIL{tally.criticalFails > 1 ? 'S' : ''}
                  </span>
                ) : (
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>{tally.pending} remaining</span>
                )}
              </div>
            </div>
            <ProgressBar pct={tally.pct} criticalFails={tally.criticalFails} />

            {/* Section progress row */}
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              {sections.map((s) => {
                const pct = Math.round(((s.pass + s.skip) / s.items.length) * 100)
                const color = s.fail > 0 ? '#f87171' : pct === 100 ? '#22c55e' : '#00c8ff'
                return (
                  <div key={s.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 13 }}>{s.icon}</span>
                    <div style={{ width: 32, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: color }} />
                    </div>
                    <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>{pct}%</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Filter bar ── */}
          <div style={{ display: 'flex', gap: 6 }}>
            {(['all', 'pending', 'fail'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  background:   filter === f ? 'rgba(0,200,255,0.1)' : 'rgba(255,255,255,0.04)',
                  border:       `1px solid ${filter === f ? 'rgba(0,200,255,0.35)' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 8,
                  color:        filter === f ? '#00c8ff' : 'rgba(255,255,255,0.45)',
                  cursor:       'pointer',
                  fontSize:     12,
                  fontWeight:   filter === f ? 700 : 500,
                  padding:      '6px 14px',
                }}
              >
                {f === 'all' ? `All (${QA_ALL_ITEMS.length})` : f === 'pending' ? `Pending (${tally.pending})` : `Fails (${tally.fail})`}
              </button>
            ))}
            <div style={{ flex: 1 }} />
            {/* Quick-pass all visible */}
            {filter !== 'all' && (
              <button
                onClick={() => visibleSections.flatMap((s) => s.items).forEach((i) => handleStatusChange(i.id, 'pass'))}
                style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, color: '#22c55e', cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: '6px 14px' }}
              >
                ✓ Pass All Visible
              </button>
            )}
          </div>

          {/* ── Section cards ── */}
          {visibleSections.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>
              🎉 No {filter} items!
            </div>
          ) : (
            visibleSections.map((section) => (
              <SectionCard
                key={section.id}
                section={section}
                items={items}
                onStatusChange={handleStatusChange}
                onNavigate={onNavigate}
              />
            ))
          )}

          {/* ── Notes + submit ── */}
          <div style={card}>
            <h3 style={{ margin: '0 0 10px', color: '#fff', fontSize: 14, fontWeight: 700 }}>Run Notes</h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any issues, blockers, or observations to include with this QA run…"
              rows={3}
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', fontSize: 13, padding: '9px 12px', resize: 'vertical', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' }}
            />

            {submitMsg && (
              <div style={{ marginTop: 8, padding: '8px 12px', background: submitMsg.ok ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${submitMsg.ok ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`, borderRadius: 8, color: submitMsg.ok ? '#22c55e' : '#f87171', fontSize: 13 }}>
                {submitMsg.text}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>
                Progress auto-saved · Submit to persist to the run history
              </span>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                style={{
                  background:   canSubmit ? 'linear-gradient(135deg,#0080ff,#00c8ff)' : 'rgba(255,255,255,0.06)',
                  border:       'none',
                  borderRadius: 10,
                  color:        canSubmit ? '#fff' : 'rgba(255,255,255,0.3)',
                  cursor:       canSubmit ? 'pointer' : 'default',
                  fontSize:     14,
                  fontWeight:   700,
                  padding:      '10px 24px',
                  transition:   'opacity 0.15s ease',
                }}
              >
                {submitting ? 'Submitting…' : '📋 Submit QA Run'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Micro components ──────────────────────────────────────────────────────────

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ color, fontSize: 20, fontWeight: 800, lineHeight: 1 }}>{value}</span>
      <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, lineHeight: 1 }}>{label}</span>
    </div>
  )
}

const ghostBtn: React.CSSProperties = {
  background:   'rgba(255,255,255,0.06)',
  border:       '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  color:        'rgba(255,255,255,0.6)',
  cursor:       'pointer',
  fontSize:     12,
  fontWeight:   600,
  padding:      '7px 14px',
  whiteSpace:   'nowrap',
}
