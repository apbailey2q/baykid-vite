// AutomationRules.tsx — BayKid AI Marketing Center
// Full CRUD rule builder: condition evaluator, test runner, localStorage persistence.
// All automations are DRAFT-ONLY. Nothing is auto-posted or auto-sent.

import { useState, useMemo } from 'react'
import {
  type AutomationRule, type RuleType, type ConditionField,
  type ActionType, type RuleCondition, type RulePlatform,
  type RuleTestResult,
  RULE_TYPE_META, CONDITION_FIELD_LABELS, ACTION_META,
  SENTIMENT_OPTIONS, MESSAGE_CATEGORY_OPTIONS, PLATFORM_OPTIONS,
  initializeRules, saveRules, upsertRule, removeRule,
  evaluateRule, executeRuleActions, fmtRelative, newRuleId, newConditionId,
} from '../../../lib/automationRules'

// ── Style constants ────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  color: '#fff',
  borderRadius: 8,
  padding: '8px 12px',
  fontSize: 12,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
}

function ghostBtn(o?: React.CSSProperties): React.CSSProperties {
  return {
    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)',
    color: 'rgba(255,255,255,0.65)', borderRadius: 8, padding: '6px 12px',
    fontWeight: 600, fontSize: 11, cursor: 'pointer', ...o,
  }
}

const RULE_TYPE_OPTIONS = (Object.keys(RULE_TYPE_META) as RuleType[]).map(rt => ({
  value: rt, ...RULE_TYPE_META[rt],
}))

// ── Toast ──────────────────────────────────────────────────────────────────────

interface Toast { id: number; message: string; type: 'success' | 'info' | 'error' }

function ToastStack({ toasts }: { toasts: Toast[] }) {
  const colors = { success: 'rgba(34,197,94,0.92)', error: 'rgba(248,113,113,0.92)', info: 'rgba(0,200,255,0.92)' }
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 9999, pointerEvents: 'none' }}>
      {toasts.map(t => (
        <div key={t.id} style={{ background: colors[t.type], color: '#fff', borderRadius: 12, padding: '10px 18px', fontWeight: 700, fontSize: 13, boxShadow: '0 4px 20px rgba(0,0,0,0.4)', animation: 'fadeUp 0.25s ease' }}>
          {t.message}
        </div>
      ))}
      <style>{`@keyframes fadeUp { from { opacity:0;transform:translateY(8px);} to { opacity:1;transform:translateY(0);} }`}</style>
    </div>
  )
}

// ── Toggle switch ──────────────────────────────────────────────────────────────

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      aria-label={on ? 'Disable rule' : 'Enable rule'}
      style={{ width: 44, height: 24, borderRadius: 12, background: on ? '#22c55e' : 'rgba(255,255,255,0.12)', border: 'none', cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}
    >
      <span style={{ position: 'absolute', top: 2, left: on ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', display: 'block' }} />
    </button>
  )
}

// ── Condition value input (field-aware) ────────────────────────────────────────

function ConditionValueInput({ field, value, onChange }: { field: ConditionField; value: string; onChange: (v: string) => void }) {
  if (field === 'sentiment') {
    return (
      <select style={inputStyle} value={value} onChange={e => onChange(e.target.value)}>
        <option value="">— select sentiment —</option>
        {SENTIMENT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    )
  }
  if (field === 'platform') {
    return (
      <select style={inputStyle} value={value} onChange={e => onChange(e.target.value)}>
        <option value="">— select platform —</option>
        {PLATFORM_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    )
  }
  if (field === 'message_category') {
    return (
      <select style={inputStyle} value={value} onChange={e => onChange(e.target.value)}>
        <option value="">— select category —</option>
        {MESSAGE_CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    )
  }
  // comment_text → free text
  return (
    <input
      style={inputStyle}
      placeholder="keyword to match (e.g. service area)"
      value={value}
      onChange={e => onChange(e.target.value)}
    />
  )
}

// ── Rule Editor (inline create / edit form) ────────────────────────────────────

interface EditorBuf {
  name:           string
  ruleType:       RuleType
  conditionLogic: 'all' | 'any'
  conditions:     RuleCondition[]
  actions:        ActionType[]
  enabled:        boolean
}

function emptyBuf(): EditorBuf {
  return {
    name: '',
    ruleType: 'auto_reply_comment',
    conditionLogic: 'any',
    conditions: [{ id: newConditionId(), field: 'comment_text', value: '' }],
    actions: ['generate_reply', 'save_draft'],
    enabled: true,
  }
}

function ruleToEditorBuf(rule: AutomationRule): EditorBuf {
  return {
    name:           rule.name,
    ruleType:       rule.ruleType,
    conditionLogic: rule.conditionLogic,
    conditions:     rule.conditions.map(c => ({ ...c })),
    actions:        [...rule.actions],
    enabled:        rule.enabled,
  }
}

interface RuleEditorProps {
  initial?: EditorBuf
  onSave:   (buf: EditorBuf) => void
  onCancel: () => void
  isNew:    boolean
}

function RuleEditor({ initial, onSave, onCancel, isNew }: RuleEditorProps) {
  const [buf, setBuf] = useState<EditorBuf>(initial ?? emptyBuf())

  function updateCondition(id: string, delta: Partial<RuleCondition>) {
    setBuf(prev => ({
      ...prev,
      conditions: prev.conditions.map(c => c.id === id ? { ...c, ...delta } : c),
    }))
  }

  function addCondition() {
    setBuf(prev => ({
      ...prev,
      conditions: [...prev.conditions, { id: newConditionId(), field: 'comment_text', value: '' }],
    }))
  }

  function removeCondition(id: string) {
    setBuf(prev => ({ ...prev, conditions: prev.conditions.filter(c => c.id !== id) }))
  }

  function toggleAction(a: ActionType) {
    setBuf(prev => ({
      ...prev,
      actions: prev.actions.includes(a) ? prev.actions.filter(x => x !== a) : [...prev.actions, a],
    }))
  }

  const canSave = buf.name.trim() && buf.conditions.length > 0 && buf.conditions.every(c => c.value.trim()) && buf.actions.length > 0

  return (
    <div style={{ background: 'rgba(0,200,255,0.04)', border: '1px solid rgba(0,200,255,0.2)', borderRadius: 14, padding: 20 }}>
      {/* Header */}
      <div style={{ color: '#00c8ff', fontWeight: 700, fontSize: 13, marginBottom: 16 }}>
        {isNew ? '+ Create New Rule' : '✏️ Edit Rule'}
      </div>

      {/* Rule name */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 5 }}>Rule Name *</label>
        <input
          style={inputStyle}
          placeholder="e.g. Pricing Inquiry → Draft Reply"
          value={buf.name}
          onChange={e => setBuf(p => ({ ...p, name: e.target.value }))}
        />
      </div>

      {/* Rule type */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 5 }}>Rule Type *</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {RULE_TYPE_OPTIONS.map(rt => {
            const active = buf.ruleType === rt.value
            return (
              <button
                key={rt.value}
                onClick={() => setBuf(p => ({ ...p, ruleType: rt.value }))}
                style={{
                  background: active ? rt.bg : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${active ? rt.border : 'rgba(255,255,255,0.1)'}`,
                  color: active ? rt.color : 'rgba(255,255,255,0.4)',
                  borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}
              >
                <span>{rt.icon}</span><span>{rt.label}</span>
              </button>
            )
          })}
        </div>
        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, marginTop: 6 }}>
          {RULE_TYPE_META[buf.ruleType].description}
        </div>
      </div>

      {/* Condition logic */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 8 }}>
          Trigger when <span style={{ color: 'rgba(255,255,255,0.25)', fontWeight: 400 }}>(choose logic)</span>
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['all', 'any'] as const).map(logic => (
            <button key={logic} onClick={() => setBuf(p => ({ ...p, conditionLogic: logic }))}
              style={{
                padding: '5px 14px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                background: buf.conditionLogic === logic ? 'rgba(0,200,255,0.15)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${buf.conditionLogic === logic ? 'rgba(0,200,255,0.4)' : 'rgba(255,255,255,0.1)'}`,
                color: buf.conditionLogic === logic ? '#00c8ff' : 'rgba(255,255,255,0.35)',
              }}
            >
              {logic === 'all' ? 'ALL conditions match (AND)' : 'ANY condition matches (OR)'}
            </button>
          ))}
        </div>
      </div>

      {/* Conditions */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {buf.conditions.map((cond, i) => (
            <div key={cond.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10, fontWeight: 700, width: 32, flexShrink: 0 }}>
                {i === 0 ? 'IF' : (buf.conditionLogic === 'all' ? 'AND' : 'OR')}
              </span>
              {/* Field selector */}
              <select
                style={{ ...inputStyle, flex: '0 0 200px' }}
                value={cond.field}
                onChange={e => updateCondition(cond.id, { field: e.target.value as ConditionField, value: '' })}
              >
                {(Object.keys(CONDITION_FIELD_LABELS) as ConditionField[]).map(f => (
                  <option key={f} value={f}>{CONDITION_FIELD_LABELS[f]}</option>
                ))}
              </select>
              {/* Value input */}
              <div style={{ flex: 1 }}>
                <ConditionValueInput
                  field={cond.field}
                  value={cond.value}
                  onChange={v => updateCondition(cond.id, { value: v })}
                />
              </div>
              {/* Remove */}
              {buf.conditions.length > 1 && (
                <button onClick={() => removeCondition(cond.id)}
                  style={{ background: 'transparent', border: 'none', color: 'rgba(248,113,113,0.5)', fontSize: 14, cursor: 'pointer', padding: '2px 6px', flexShrink: 0 }}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        <button onClick={addCondition} style={{ ...ghostBtn({ marginTop: 8 }), fontSize: 11 }}>
          + Add Condition
        </button>
      </div>

      {/* Actions */}
      <div style={{ marginBottom: 18 }}>
        <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 8 }}>
          Then do… <span style={{ color: 'rgba(255,255,255,0.25)', fontWeight: 400 }}>(select all that apply)</span>
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(Object.keys(ACTION_META) as ActionType[]).map(a => {
            const meta = ACTION_META[a]
            const active = buf.actions.includes(a)
            return (
              <button key={a} onClick={() => toggleAction(a)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px',
                  borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  background: active ? 'rgba(0,200,255,0.1)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${active ? 'rgba(0,200,255,0.3)' : 'rgba(255,255,255,0.1)'}`,
                  color: active ? '#00c8ff' : 'rgba(255,255,255,0.35)',
                }}
                title={meta.description}
              >
                <span>{meta.icon}</span><span>{meta.label}</span>
              </button>
            )
          })}
        </div>
        <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10, marginTop: 8 }}>
          ⚠️ Draft-only mode — no content is auto-posted or auto-sent
        </div>
      </div>

      {/* Save / Cancel */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          onClick={() => onSave(buf)}
          disabled={!canSave}
          style={{
            background: canSave ? 'linear-gradient(135deg,#0057e7,#00c8ff)' : 'rgba(255,255,255,0.08)',
            color: canSave ? '#fff' : 'rgba(255,255,255,0.25)',
            border: 'none', borderRadius: 10, padding: '8px 20px',
            fontWeight: 700, fontSize: 12, cursor: canSave ? 'pointer' : 'not-allowed',
          }}
        >
          {isNew ? '✓ Create Rule' : '✓ Save Changes'}
        </button>
        <button onClick={onCancel} style={ghostBtn()}>Cancel</button>
        {!canSave && (
          <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10 }}>
            Fill in rule name, all condition values, and at least one action
          </span>
        )}
      </div>
    </div>
  )
}

// ── Test Panel ─────────────────────────────────────────────────────────────────

interface TestPanelProps {
  rule:   AutomationRule
  onClose: () => void
}

function TestPanel({ rule, onClose }: TestPanelProps) {
  const [testText, setTestText]         = useState('')
  const [testPlatform, setTestPlatform] = useState<RulePlatform>('instagram')
  const [result, setResult]             = useState<RuleTestResult | null>(null)
  const [ran, setRan]                   = useState(false)
  const [executing, setExecuting]       = useState(false)
  const [execSummary, setExecSummary]   = useState<string[] | null>(null)

  function runTest() {
    if (!testText.trim()) return
    const r = evaluateRule(rule, { text: testText, platform: testPlatform })
    setResult(r)
    setRan(true)
    setExecSummary(null)
  }

  async function runExecute() {
    if (!result || !result.ruleMatches) return
    setExecuting(true)
    try {
      const out = await executeRuleActions(rule, { text: testText, platform: testPlatform }, result)
      setExecSummary(out.summary.length > 0 ? out.summary : ['✅ Actions executed (nothing to persist for this action set)'])
    } catch (e) {
      setExecSummary([`❌ Error: ${String(e)}`])
    } finally {
      setExecuting(false)
    }
  }

  return (
    <div style={{ background: 'rgba(251,191,36,0.04)', border: '1px solid rgba(251,191,36,0.15)', borderRadius: 12, padding: 16, marginTop: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ color: '#fbbf24', fontWeight: 700, fontSize: 12 }}>🧪 Test Rule: "{rule.name}"</span>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 14, cursor: 'pointer' }}>✕</button>
      </div>

      {/* Input */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <label style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 700, display: 'block', marginBottom: 4 }}>Sample Comment or Message</label>
          <textarea
            style={{ ...inputStyle, minHeight: 72, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
            placeholder="e.g. How much does Cyan's Brooklynn cost? Do you serve Green Hills apartments?"
            value={testText}
            onChange={e => { setTestText(e.target.value); setRan(false); setResult(null) }}
          />
        </div>
        <div style={{ flexShrink: 0, width: 150 }}>
          <label style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 700, display: 'block', marginBottom: 4 }}>Platform</label>
          <select style={inputStyle} value={testPlatform} onChange={e => { setTestPlatform(e.target.value as RulePlatform); setRan(false); setResult(null) }}>
            {PLATFORM_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
      </div>

      <button
        onClick={runTest}
        disabled={!testText.trim()}
        style={{
          background: testText.trim() ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.05)',
          border: `1px solid ${testText.trim() ? 'rgba(251,191,36,0.35)' : 'rgba(255,255,255,0.08)'}`,
          color: testText.trim() ? '#fbbf24' : 'rgba(255,255,255,0.2)',
          borderRadius: 8, padding: '7px 16px', fontWeight: 700, fontSize: 12,
          cursor: testText.trim() ? 'pointer' : 'not-allowed', marginBottom: result ? 14 : 0,
        }}
      >
        ▶ Run Test
      </button>

      {/* Results */}
      {ran && result && (
        <div>
          {/* Detection */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', alignSelf: 'center' }}>Detected:</span>
            <span style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 600 }}>
              Sentiment: {result.detectedSentiment}
            </span>
            {result.detectedCategories.map(cat => (
              <span key={cat} style={{ background: 'rgba(0,200,255,0.06)', color: 'rgba(0,200,255,0.6)', borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 600 }}>
                {cat}
              </span>
            ))}
          </div>

          {/* Conditions */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: 700, marginBottom: 6 }}>
              CONDITIONS ({rule.conditionLogic.toUpperCase()} logic):
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {result.conditionResults.map((cr, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{ flexShrink: 0, fontSize: 12, marginTop: 1 }}>{cr.matched ? '✅' : '❌'}</span>
                  <div>
                    <span style={{ color: cr.matched ? '#22c55e' : '#f87171', fontSize: 11, fontWeight: 600 }}>
                      {CONDITION_FIELD_LABELS[cr.condition.field]} "{cr.condition.value}"
                    </span>
                    <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10, marginLeft: 8 }}>— {cr.reason}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Verdict */}
          <div style={{
            background: result.ruleMatches ? 'rgba(34,197,94,0.08)' : 'rgba(248,113,113,0.08)',
            border: `1px solid ${result.ruleMatches ? 'rgba(34,197,94,0.2)' : 'rgba(248,113,113,0.2)'}`,
            borderRadius: 10, padding: '10px 14px', marginBottom: result.ruleMatches ? 12 : 0,
          }}>
            <span style={{ color: result.ruleMatches ? '#22c55e' : '#f87171', fontWeight: 700, fontSize: 12 }}>
              {result.ruleMatches ? '✅ Rule MATCHES — the following actions would trigger:' : '✗ Rule does NOT match — no actions triggered'}
            </span>
            {result.ruleMatches && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}>
                {result.triggeredActions.map(a => (
                  <span key={a} style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 20, padding: '2px 10px', fontSize: 10, fontWeight: 700 }}>
                    {ACTION_META[a].icon} {ACTION_META[a].label}
                  </span>
                ))}
                <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10, alignSelf: 'center', marginLeft: 4 }}>
                  (draft-only — nothing posted)
                </span>
                <button
                  onClick={runExecute}
                  disabled={executing || !!execSummary}
                  style={{
                    marginLeft: 'auto', background: executing ? 'rgba(255,255,255,0.05)' : 'rgba(34,197,94,0.15)',
                    border: '1px solid rgba(34,197,94,0.35)', color: executing ? 'rgba(255,255,255,0.3)' : '#22c55e',
                    borderRadius: 8, padding: '5px 12px', fontWeight: 700, fontSize: 11,
                    cursor: executing || !!execSummary ? 'not-allowed' : 'pointer', flexShrink: 0,
                  }}
                >
                  {executing ? '⏳ Executing…' : execSummary ? '✅ Executed' : '⚡ Execute Actions'}
                </button>
              </div>
            )}
          </div>

          {/* Execute results */}
          {execSummary && (
            <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 10, padding: '12px 14px', marginBottom: 10, marginTop: 10 }}>
              <div style={{ color: '#22c55e', fontSize: 10, fontWeight: 700, marginBottom: 8 }}>⚡ EXECUTION RESULTS (saved to storage):</div>
              {execSummary.map((line, i) => (
                <div key={i} style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, lineHeight: 1.6 }}>{line}</div>
              ))}
              <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10, marginTop: 8 }}>
                Check Lead Tracker and Approval Queue to see the created records.
              </div>
            </div>
          )}

          {/* Generated reply */}
          {result.ruleMatches && result.generatedReply && (
            <div style={{ background: 'rgba(0,200,255,0.05)', border: '1px solid rgba(0,200,255,0.15)', borderRadius: 10, padding: '12px 14px', marginBottom: 10 }}>
              <div style={{ color: '#00c8ff', fontSize: 10, fontWeight: 700, marginBottom: 6 }}>
                🤖 GENERATED DRAFT REPLY (saved as draft — not posted):
              </div>
              <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, lineHeight: 1.65, margin: 0 }}>
                {result.generatedReply}
              </p>
            </div>
          )}

          {/* Lead data */}
          {result.ruleMatches && result.leadData && (
            <div style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: 10, padding: '12px 14px', marginBottom: 10 }}>
              <div style={{ color: '#22c55e', fontSize: 10, fontWeight: 700, marginBottom: 8 }}>🎯 LEAD RECORD CREATED (draft — not sent):</div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {Object.entries(result.leadData).map(([k, v]) => (
                  <div key={k}>
                    <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 700 }}>{k.toUpperCase()}</div>
                    <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 2 }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Posting time */}
          {result.ruleMatches && result.postingTimeSuggestion && (
            <div style={{ background: 'rgba(251,146,60,0.05)', border: '1px solid rgba(251,146,60,0.15)', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ color: '#fb923c', fontSize: 10, fontWeight: 700, marginBottom: 4 }}>📅 POSTING TIME SUGGESTION:</div>
              <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, lineHeight: 1.55, margin: 0 }}>{result.postingTimeSuggestion}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Condition summary (display only) ──────────────────────────────────────────

function conditionLabel(c: RuleCondition): string {
  return `${CONDITION_FIELD_LABELS[c.field]}: "${c.value}"`
}

// ── Rule Card ──────────────────────────────────────────────────────────────────

interface RuleCardProps {
  rule:        AutomationRule
  isEditing:   boolean
  isTesting:   boolean
  onToggle:    () => void
  onEditStart: () => void
  onEditSave:  (buf: EditorBuf) => void
  onEditCancel:() => void
  onTestStart: () => void
  onTestClose: () => void
  onDelete:    () => void
}

function RuleCard({
  rule, isEditing, isTesting,
  onToggle, onEditStart, onEditSave, onEditCancel,
  onTestStart, onTestClose, onDelete,
}: RuleCardProps) {
  const meta = RULE_TYPE_META[rule.ruleType]

  return (
    <div
      style={{
        background: rule.enabled ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.015)',
        border: `1px solid ${rule.enabled ? 'rgba(0,190,255,0.1)' : 'rgba(255,255,255,0.06)'}`,
        borderRadius: 14,
        padding: isEditing ? 0 : 16,
        overflow: 'hidden',
        transition: 'border-color 0.2s',
      }}
    >
      {isEditing ? (
        <RuleEditor
          initial={ruleToEditorBuf(rule)}
          onSave={onEditSave}
          onCancel={onEditCancel}
          isNew={false}
        />
      ) : (
        <>
          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Name + type badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>{rule.name}</span>
                <span style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}`, borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>
                  {meta.icon} {meta.label}
                </span>
                {rule.enabled && (
                  <span style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', borderRadius: 20, padding: '1px 7px', fontSize: 10, fontWeight: 700 }}>
                    Active
                  </span>
                )}
              </div>

              {/* Conditions summary */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 5, flexWrap: 'wrap' }}>
                <span style={{ color: '#fbbf24', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>WHEN</span>
                <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10, flexShrink: 0 }}>({rule.conditionLogic === 'all' ? 'ALL' : 'ANY'} of):</span>
                {rule.conditions.map((c) => (
                  <span key={c.id} style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, background: 'rgba(255,255,255,0.05)', borderRadius: 20, padding: '1px 7px' }}>
                    {conditionLabel(c)}
                  </span>
                ))}
              </div>

              {/* Actions summary */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ color: '#00c8ff', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>THEN:</span>
                {rule.actions.map(a => (
                  <span key={a} style={{ color: ACTION_META[a].color, fontSize: 10, background: 'rgba(255,255,255,0.04)', border: `1px solid rgba(255,255,255,0.08)`, borderRadius: 20, padding: '1px 7px' }}>
                    {ACTION_META[a].icon} {ACTION_META[a].label}
                  </span>
                ))}
              </div>

              {/* Timestamps */}
              <div style={{ marginTop: 8, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10 }}>
                  Triggered: {rule.triggerCount}× · Last: {fmtRelative(rule.lastTriggered)}
                </span>
                <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 10 }}>
                  ⚠️ Draft-only
                </span>
              </div>
            </div>

            {/* Right controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <Toggle on={rule.enabled} onChange={onToggle} />
              <button onClick={onEditStart} style={ghostBtn({ padding: '5px 10px' })} title="Edit rule">✏️</button>
              <button onClick={onTestStart} style={ghostBtn({ padding: '5px 10px', color: '#fbbf24', borderColor: 'rgba(251,191,36,0.25)', background: 'rgba(251,191,36,0.06)' })} title="Test rule">🧪</button>
              <button onClick={onDelete} style={{ background: 'transparent', border: 'none', color: 'rgba(248,113,113,0.4)', fontSize: 14, cursor: 'pointer', padding: '3px 6px' }} title="Delete rule">🗑️</button>
            </div>
          </div>

          {/* Test panel */}
          {isTesting && <TestPanel rule={rule} onClose={onTestClose} />}
        </>
      )}
    </div>
  )
}

// ── Stats Cards ────────────────────────────────────────────────────────────────

function StatsCards({ rules }: { rules: AutomationRule[] }) {
  const activeCount  = rules.filter(r => r.enabled).length
  const totalRuns    = rules.reduce((s, r) => s + r.triggerCount, 0)
  const recentCount  = rules.filter(r => r.lastTriggered && Date.now() - new Date(r.lastTriggered).getTime() < 86400000).length
  const draftOnly    = rules.length

  const cards = [
    { label: 'Active Rules',    value: activeCount, icon: '⚙️', color: '#22c55e', bg: 'rgba(34,197,94,0.08)',    border: 'rgba(34,197,94,0.2)'    },
    { label: 'Total Triggers',  value: totalRuns,   icon: '📊', color: '#00c8ff', bg: 'rgba(0,200,255,0.08)',    border: 'rgba(0,200,255,0.2)'    },
    { label: 'Triggered Today', value: recentCount, icon: '⚡', color: '#fbbf24', bg: 'rgba(251,191,36,0.08)',   border: 'rgba(251,191,36,0.2)'   },
    { label: 'Draft-Only Mode', value: draftOnly,   icon: '🔒', color: '#fb923c', bg: 'rgba(251,146,60,0.08)',   border: 'rgba(251,146,60,0.2)'   },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
      {cards.map(c => (
        <div key={c.label} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 14, padding: '14px 16px' }}>
          <div style={{ fontSize: 18, marginBottom: 4 }}>{c.icon}</div>
          <div style={{ color: c.color, fontWeight: 800, fontSize: 24, lineHeight: 1 }}>{c.value}</div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 4, fontWeight: 600 }}>{c.label}</div>
        </div>
      ))}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function AutomationRules() {
  const [rules, setRules]           = useState<AutomationRule[]>(() => initializeRules())
  const [editingId, setEditingId]   = useState<string | null>(null)
  const [testingId, setTestingId]   = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [filterType, setFilterType] = useState<'all' | 'active' | 'disabled'>('all')
  const [toasts, setToasts]         = useState<Toast[]>([])

  // ── Toast helper ────────────────────────────────────────────────────────────
  function showToast(message: string, type: Toast['type'] = 'success') {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 2800)
  }

  // ── Derived ─────────────────────────────────────────────────────────────────
  const filtered = useMemo(() =>
    rules.filter(r => {
      if (filterType === 'active')   return r.enabled
      if (filterType === 'disabled') return !r.enabled
      return true
    }),
    [rules, filterType],
  )

  // ── CRUD handlers ────────────────────────────────────────────────────────────

  function handleToggle(id: string) {
    const updated = rules.map(r => r.id === id ? { ...r, enabled: !r.enabled, updatedAt: new Date().toISOString() } : r)
    saveRules(updated)
    setRules(updated)
    const rule = updated.find(r => r.id === id)!
    showToast(rule.enabled ? '✅ Rule enabled' : '⏸ Rule disabled', 'info')
  }

  function handleEditStart(id: string) {
    setTestingId(null)
    setIsCreating(false)
    setEditingId(id)
  }

  function handleEditSave(id: string, buf: EditorBuf) {
    const existing = rules.find(r => r.id === id)!
    const updated: AutomationRule = {
      ...existing,
      name:           buf.name.trim(),
      ruleType:       buf.ruleType,
      conditionLogic: buf.conditionLogic,
      conditions:     buf.conditions,
      actions:        buf.actions,
      enabled:        buf.enabled,
      updatedAt:      new Date().toISOString(),
    }
    const all = upsertRule(updated)
    setRules(all)
    setEditingId(null)
    showToast('✏️ Rule updated')
  }

  function handleEditCancel() {
    setEditingId(null)
  }

  function handleDelete(id: string) {
    const all = removeRule(id)
    setRules(all)
    if (editingId === id) setEditingId(null)
    if (testingId === id) setTestingId(null)
    showToast('🗑️ Rule deleted', 'info')
  }

  function handleCreateSave(buf: EditorBuf) {
    const now = new Date().toISOString()
    const newRule: AutomationRule = {
      id:             newRuleId(),
      name:           buf.name.trim(),
      ruleType:       buf.ruleType,
      conditionLogic: buf.conditionLogic,
      conditions:     buf.conditions,
      actions:        buf.actions,
      enabled:        buf.enabled,
      draftOnly:      true,
      createdAt:      now,
      updatedAt:      now,
      triggerCount:   0,
      lastTriggered:  undefined,
    }
    const all = upsertRule(newRule)
    setRules(all)
    setIsCreating(false)
    showToast('🎉 Rule created!')
  }

  function handleCreateCancel() {
    setIsCreating(false)
  }

  function handleTestStart(id: string) {
    setEditingId(null)
    setIsCreating(false)
    setTestingId(testingId === id ? null : id)
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 900 }}>
      {/* ── Page header ── */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 20, margin: 0 }}>⚙️ Automation Rules</h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 4 }}>
            Define trigger-action rules for comments, emails, and leads. All automations save drafts only — nothing is auto-posted.
          </p>
        </div>
        <button
          onClick={() => { setIsCreating(true); setEditingId(null); setTestingId(null) }}
          style={{ background: 'linear-gradient(135deg,#0057e7,#00c8ff)', color: '#fff', border: 'none', borderRadius: 12, padding: '9px 18px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
        >
          + Create Rule
        </button>
      </div>

      {/* ── Stats ── */}
      <StatsCards rules={rules} />

      {/* ── Create rule form ── */}
      {isCreating && (
        <div style={{ marginBottom: 20 }}>
          <RuleEditor onSave={handleCreateSave} onCancel={handleCreateCancel} isNew={true} />
        </div>
      )}

      {/* ── Filter bar ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>Filter:</span>
        {(['all', 'active', 'disabled'] as const).map(f => (
          <button key={f} onClick={() => setFilterType(f)}
            style={{
              padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer',
              background: filterType === f ? 'rgba(0,200,255,0.12)' : 'transparent',
              border: `1px solid ${filterType === f ? 'rgba(0,200,255,0.35)' : 'rgba(255,255,255,0.08)'}`,
              color: filterType === f ? '#00c8ff' : 'rgba(255,255,255,0.35)',
            }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            <span style={{ marginLeft: 5, opacity: 0.7, fontSize: 10 }}>
              {f === 'all' ? rules.length : f === 'active' ? rules.filter(r => r.enabled).length : rules.filter(r => !r.enabled).length}
            </span>
          </button>
        ))}

        {/* Rule type filter */}
        <span style={{ color: 'rgba(255,255,255,0.15)', margin: '0 4px' }}>|</span>
        {(Object.keys(RULE_TYPE_META) as RuleType[]).filter(rt => rules.some(r => r.ruleType === rt)).map(rt => {
          const meta = RULE_TYPE_META[rt]
          return (
            <span key={rt} style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}`, borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>
              {meta.icon} {rules.filter(r => r.ruleType === rt).length}
            </span>
          )
        })}
      </div>

      {/* ── Rules list ── */}
      {filtered.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(rule => (
            <RuleCard
              key={rule.id}
              rule={rule}
              isEditing={editingId === rule.id}
              isTesting={testingId === rule.id}
              onToggle={() => handleToggle(rule.id)}
              onEditStart={() => handleEditStart(rule.id)}
              onEditSave={(buf) => handleEditSave(rule.id, buf)}
              onEditCancel={handleEditCancel}
              onTestStart={() => handleTestStart(rule.id)}
              onTestClose={() => setTestingId(null)}
              onDelete={() => handleDelete(rule.id)}
            />
          ))}
        </div>
      ) : (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 60, textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
          {filterType !== 'all' ? (
            <>
              No {filterType} rules.{' '}
              <button onClick={() => setFilterType('all')} style={{ ...ghostBtn(), marginLeft: 8 }}>Clear filter</button>
            </>
          ) : (
            <>
              No automation rules yet.{' '}
              <button onClick={() => setIsCreating(true)} style={{ ...ghostBtn({ color: '#00c8ff', borderColor: 'rgba(0,200,255,0.3)', background: 'rgba(0,200,255,0.08)' }), marginLeft: 8 }}>
                + Create your first rule
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Draft-only footer note ── */}
      {rules.length > 0 && (
        <div style={{ marginTop: 24, background: 'rgba(251,146,60,0.05)', border: '1px solid rgba(251,146,60,0.15)', borderRadius: 12, padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>🔒</span>
          <div>
            <span style={{ color: '#fb923c', fontWeight: 700, fontSize: 12 }}>Draft-Only Mode Active</span>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, margin: '3px 0 0', lineHeight: 1.5 }}>
              All automation outputs are saved as drafts and routed to the Approval Queue for human review. No content is auto-posted, auto-emailed, or auto-sent. Enable live posting in a future release after QA review.
            </p>
          </div>
        </div>
      )}

      <div style={{ height: 40 }} />
      <ToastStack toasts={toasts} />
    </div>
  )
}
