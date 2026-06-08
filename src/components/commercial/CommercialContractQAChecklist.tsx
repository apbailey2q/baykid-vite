// ─────────────────────────────────────────────────────────────────────────────
// CO.5 — Commercial Contract QA Checklist Component
// ─────────────────────────────────────────────────────────────────────────────
//
// Renders the structured QA checklist produced by buildContractQAChecklist().
// Used in the admin contracts editor to verify completeness before activation.
// ─────────────────────────────────────────────────────────────────────────────

import type { QAChecklist, QAItem, QAStatus } from '../../lib/commercialContractExports'

// ── Status metadata ───────────────────────────────────────────────────────────

const STATUS_ICON: Record<QAStatus, string>   = { pass: '✅', warn: '⚠️', missing: '❌' }
const STATUS_COLOR: Record<QAStatus, string>  = {
  pass:    '#4ade80',
  warn:    '#fbbf24',
  missing: '#f87171',
}
const STATUS_LABEL: Record<QAStatus, string>  = { pass: 'Pass', warn: 'Warning', missing: 'Missing' }

// ── Single checklist item ─────────────────────────────────────────────────────

function QARow({ item }: { item: QAItem }) {
  return (
    <div style={{
      display:      'flex',
      alignItems:   'flex-start',
      gap:          10,
      padding:      '8px 0',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
    }}>
      <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{STATUS_ICON[item.status]}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: '#fff', margin: '0 0 2px' }}>
          {item.label}
        </p>
        {item.detail && (
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', margin: 0, lineHeight: 1.4 }}>
            {item.detail}
          </p>
        )}
      </div>
      <span style={{
        padding:      '1px 7px',
        borderRadius: 999,
        fontSize:     9,
        fontWeight:   800,
        background:   STATUS_COLOR[item.status] + '22',
        border:       `1px solid ${STATUS_COLOR[item.status]}44`,
        color:        STATUS_COLOR[item.status],
        flexShrink:   0,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
      }}>
        {STATUS_LABEL[item.status]}
      </span>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface CommercialContractQAChecklistProps {
  checklist: QAChecklist
}

export function CommercialContractQAChecklist({ checklist }: CommercialContractQAChecklistProps) {
  const { items, passCount, warnCount, missingCount } = checklist
  const total = items.length

  return (
    <div>
      {/* Summary bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'Passed',   value: passCount,    color: '#4ade80' },
          { label: 'Warnings', value: warnCount,    color: '#fbbf24' },
          { label: 'Missing',  value: missingCount, color: '#f87171' },
          { label: 'Total',    value: total,         color: 'rgba(255,255,255,0.5)' },
        ].map(s => (
          <div key={s.label} style={{
            flex:       1,
            minWidth:   64,
            padding:    '10px 12px',
            borderRadius: 10,
            background: 'rgba(255,255,255,0.04)',
            border:     '1px solid rgba(255,255,255,0.08)',
            textAlign:  'center',
          }}>
            <p style={{ fontSize: 20, fontWeight: 800, color: s.color, margin: '0 0 2px' }}>
              {s.value}
            </p>
            <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
              {s.label}
            </p>
          </div>
        ))}
      </div>

      {/* Overall verdict */}
      {missingCount > 0 ? (
        <div style={{ padding: '8px 12px', borderRadius: 10, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', marginBottom: 14 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#f87171', margin: 0 }}>
            ❌ {missingCount} required field{missingCount !== 1 ? 's' : ''} missing — review before activating
          </p>
        </div>
      ) : warnCount > 0 ? (
        <div style={{ padding: '8px 12px', borderRadius: 10, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', marginBottom: 14 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#fbbf24', margin: 0 }}>
            ⚠️ {warnCount} item{warnCount !== 1 ? 's' : ''} need attention
          </p>
        </div>
      ) : (
        <div style={{ padding: '8px 12px', borderRadius: 10, background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', marginBottom: 14 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#4ade80', margin: 0 }}>
            ✅ All checks passed
          </p>
        </div>
      )}

      {/* Checklist items */}
      <div>
        {items.map(item => <QARow key={item.id} item={item} />)}
      </div>
    </div>
  )
}
