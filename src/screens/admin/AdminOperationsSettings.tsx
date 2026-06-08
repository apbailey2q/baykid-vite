/**
 * AdminOperationsSettings — Admin UI for pickup windows, fees, and dispatch rules.
 *
 * Route: /dashboard/admin/operations
 * Access: admin only (enforced by routePermissions + RLS)
 *
 * Tabs:
 *   Consumer — free pickup window, convenience fee, schedule visibility
 *   Commercial — bin scanning, emergency pickup fee, priority dispatch
 *
 * Changes are saved per-city. The 'default' row applies to all cities that
 * don't have their own row. City-specific rows (Nashville, Memphis, etc.)
 * can be added to support future multi-city customization.
 *
 * Fee columns are for bookkeeping only — the platform does NOT process
 * payments. See CLAUDE.md Official Payout System Directive.
 */

import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getOperationsSettings, listOperationsSettings, upsertOperationsSettings, formatWindowTime } from '../../lib/operationsSettings'
import { DEFAULT_OPERATIONS_SETTINGS } from '../../types/operationsSettings'
import type { OperationsSettings } from '../../types/operationsSettings'
import { GlassCard } from '../../components/ui/GlassCard'
import { PrimaryButton } from '../../components/ui/PrimaryButton'

// ── Styles ────────────────────────────────────────────────────────────────────

const INPUT: React.CSSProperties = {
  width: '100%',
  padding: '11px 14px',
  borderRadius: 12,
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(0,200,255,0.2)',
  color: '#fff',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
}

const LABEL: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 700,
  color: 'rgba(255,255,255,0.4)',
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  marginBottom: 6,
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <p style={{
      fontSize: 10,
      fontWeight: 700,
      color: 'rgba(255,255,255,0.28)',
      textTransform: 'uppercase',
      letterSpacing: '0.1em',
      marginBottom: 16,
      marginTop: 4,
    }}>
      {label}
    </p>
  )
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={LABEL}>{label}</label>
      {children}
    </div>
  )
}

function Toggle({
  value,
  onChange,
  labelOn  = 'Enabled',
  labelOff = 'Disabled',
}: {
  value:     boolean
  onChange:  (v: boolean) => void
  labelOn?:  string
  labelOff?: string
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      style={{
        display:        'flex',
        alignItems:     'center',
        gap:            10,
        background:     value ? 'rgba(0,200,255,0.12)' : 'rgba(255,255,255,0.05)',
        border:         `1px solid ${value ? 'rgba(0,200,255,0.35)' : 'rgba(255,255,255,0.1)'}`,
        borderRadius:   12,
        padding:        '9px 14px',
        cursor:         'pointer',
        transition:     'all 0.15s',
        width:          '100%',
        textAlign:      'left',
      }}
    >
      {/* pill */}
      <div style={{
        width:          36,
        height:         20,
        borderRadius:   10,
        background:     value ? '#00c8ff' : 'rgba(255,255,255,0.15)',
        position:       'relative',
        flexShrink:     0,
        transition:     'background 0.15s',
      }}>
        <div style={{
          position:   'absolute',
          top:        3,
          left:       value ? 18 : 3,
          width:      14,
          height:     14,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left 0.15s',
        }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 600, color: value ? '#00c8ff' : 'rgba(255,255,255,0.4)' }}>
        {value ? labelOn : labelOff}
      </span>
    </button>
  )
}

function FeeInput({
  label,
  value,
  onChange,
  note,
}: {
  label:    string
  value:    number
  onChange: (v: number) => void
  note?:    string
}) {
  return (
    <FieldRow label={label}>
      <div style={{ position: 'relative' }}>
        <span style={{
          position:  'absolute',
          left:      13,
          top:       '50%',
          transform: 'translateY(-50%)',
          color:     'rgba(255,255,255,0.4)',
          fontSize:  14,
          fontWeight: 600,
          pointerEvents: 'none',
        }}>$</span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={value}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          style={{ ...INPUT, paddingLeft: 26 }}
        />
      </div>
      {note && (
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 5, lineHeight: 1.5 }}>
          {note}
        </p>
      )}
    </FieldRow>
  )
}

// ── Time input (HH:MM:SS ↔ <input type="time">) ───────────────────────────────

function TimeInput({
  label,
  value,
  onChange,
}: {
  label:    string
  value:    string   // HH:MM:SS
  onChange: (v: string) => void
}) {
  // <input type="time"> uses HH:MM — strip the seconds for the control
  const hhmm = value.slice(0, 5) // '18:00'

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    // Restore seconds on the way out
    onChange(e.target.value + ':00')
  }

  return (
    <FieldRow label={label}>
      <input
        type="time"
        value={hhmm}
        onChange={handleChange}
        style={{ ...INPUT, colorScheme: 'dark' }}
      />
    </FieldRow>
  )
}

// ── City selector ─────────────────────────────────────────────────────────────

const SELECT: React.CSSProperties = {
  ...INPUT,
  appearance: 'none' as const,
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='rgba(255,255,255,0.35)' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 14px center',
  paddingRight: 38,
  cursor: 'pointer',
}

// ── Main screen ───────────────────────────────────────────────────────────────

type Tab = 'consumer' | 'commercial'

export default function AdminOperationsSettings() {
  const queryClient = useQueryClient()

  const [activeTab,  setActiveTab]  = useState<Tab>('consumer')
  const [cityCode,   setCityCode]   = useState('default')
  const [form,       setForm]       = useState<OperationsSettings>(DEFAULT_OPERATIONS_SETTINGS)
  const [saving,     setSaving]     = useState(false)
  const [saveMsg,    setSaveMsg]    = useState<{ ok: boolean; text: string } | null>(null)

  // Load city list for selector
  const { data: cityRows = [] } = useQuery<OperationsSettings[]>({
    queryKey:  ['operations-settings-list'],
    queryFn:   listOperationsSettings,
    staleTime: 60_000,
  })

  // Load settings for selected city
  const { data: loaded } = useQuery<OperationsSettings>({
    queryKey:  ['operations-settings', cityCode],
    queryFn:   () => getOperationsSettings(cityCode),
    staleTime: 30_000,
  })

  // Sync form when city changes
  useEffect(() => {
    if (loaded) setForm(loaded)
  }, [loaded])

  function set<K extends keyof OperationsSettings>(key: K, value: OperationsSettings[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
    setSaveMsg(null)
  }

  async function handleSave() {
    setSaving(true)
    setSaveMsg(null)
    const { error } = await upsertOperationsSettings(form)
    setSaving(false)
    if (error) {
      setSaveMsg({ ok: false, text: error })
    } else {
      setSaveMsg({ ok: true, text: 'Settings saved.' })
      // Invalidate so other tabs / hooks pick up the new values
      void queryClient.invalidateQueries({ queryKey: ['operations-settings'] })
      void queryClient.invalidateQueries({ queryKey: ['operations-settings-list'] })
    }
  }

  // ── Window preview ────────────────────────────────────────────────────────

  const windowPreview = `${formatWindowTime(form.consumer_free_window_start)} – ${formatWindowTime(form.consumer_free_window_end)}`

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen px-4 pb-16 pt-6"
      style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)', maxWidth: 640, margin: '0 auto' }}
    >
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
          Admin · Operations
        </p>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: '#fff', margin: 0 }}>
          Pickup Management
        </h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
          Control pickup windows, fees, and dispatch rules. Changes apply immediately.
        </p>
      </div>

      {/* City selector */}
      <GlassCard padding="md" className="mb-5">
        <SectionHeader label="City Configuration" />
        <FieldRow label="Editing settings for">
          <select
            value={cityCode}
            onChange={e => setCityCode(e.target.value)}
            style={SELECT}
          >
            {cityRows.map(r => (
              <option key={r.city_code} value={r.city_code}>
                {r.city_label}
              </option>
            ))}
          </select>
        </FieldRow>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', lineHeight: 1.5 }}>
          The <strong style={{ color: 'rgba(255,255,255,0.5)' }}>Default</strong> row applies to all cities without a city-specific override.
          To add Nashville or Memphis settings, insert a row via the Supabase dashboard and it will appear here.
        </p>
      </GlassCard>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['consumer', 'commercial'] as Tab[]).map(tab => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            style={{
              flex:         1,
              padding:      '10px 0',
              borderRadius: 12,
              fontSize:     13,
              fontWeight:   700,
              cursor:       'pointer',
              border:       activeTab === tab ? '1px solid rgba(0,200,255,0.4)' : '1px solid rgba(255,255,255,0.08)',
              background:   activeTab === tab ? 'rgba(0,200,255,0.1)' : 'rgba(255,255,255,0.03)',
              color:        activeTab === tab ? '#00c8ff' : 'rgba(255,255,255,0.4)',
              transition:   'all 0.15s',
            }}
          >
            {tab === 'consumer' ? '👤 Consumer' : '🏢 Commercial'}
          </button>
        ))}
      </div>

      {/* ── Consumer tab ─────────────────────────────────────────────────── */}

      {activeTab === 'consumer' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Free pickup window */}
          <GlassCard padding="md">
            <SectionHeader label="Free Pickup Window" />

            <div
              style={{
                background:   'rgba(0,200,255,0.07)',
                border:       '1px solid rgba(0,200,255,0.2)',
                borderRadius: 12,
                padding:      '10px 14px',
                marginBottom: 16,
              }}
            >
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                Current free window:{' '}
                <strong style={{ color: '#00c8ff' }}>{windowPreview}</strong> local time
              </p>
            </div>

            <TimeInput
              label="Window Start Time"
              value={form.consumer_free_window_start}
              onChange={v => set('consumer_free_window_start', v)}
            />

            <TimeInput
              label="Window End Time"
              value={form.consumer_free_window_end}
              onChange={v => set('consumer_free_window_end', v)}
            />

            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', lineHeight: 1.5 }}>
              Consumers who request a pickup during this window pay no convenience fee.
              Outside this window they see a gate with convenience pickup and next free day options.
            </p>
          </GlassCard>

          {/* Convenience pickup */}
          <GlassCard padding="md">
            <SectionHeader label="Convenience Pickup" />

            <FieldRow label="Convenience Pickup">
              <Toggle
                value={form.consumer_convenience_enabled}
                onChange={v => set('consumer_convenience_enabled', v)}
                labelOn="Enabled — consumers can pay for an off-window pickup"
                labelOff="Disabled — only free window pickups allowed"
              />
            </FieldRow>

            <FeeInput
              label="Convenience Fee"
              value={form.consumer_convenience_fee}
              onChange={v => set('consumer_convenience_fee', v)}
              note="Recorded for manual bookkeeping. The platform does not process payments."
            />
          </GlassCard>

          {/* Scheduling options */}
          <GlassCard padding="md">
            <SectionHeader label="Scheduling Options" />

            <FieldRow label="Show 'Next Available Free Pickup' option">
              <Toggle
                value={form.consumer_next_free_visible}
                onChange={v => set('consumer_next_free_visible', v)}
                labelOn="Visible"
                labelOff="Hidden"
              />
            </FieldRow>

            <FieldRow label="Show Schedule Date/Time picker">
              <Toggle
                value={form.consumer_schedule_visible}
                onChange={v => set('consumer_schedule_visible', v)}
                labelOn="Visible"
                labelOff="Hidden"
              />
            </FieldRow>
          </GlassCard>
        </div>
      )}

      {/* ── Commercial tab ───────────────────────────────────────────────── */}

      {activeTab === 'commercial' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Availability */}
          <GlassCard padding="md">
            <SectionHeader label="Pickup Availability" />

            <FieldRow label="Bin Scanning">
              <Toggle
                value={form.commercial_bin_scan_24_7}
                onChange={v => set('commercial_bin_scan_24_7', v)}
                labelOn="24/7 — scan anytime, day or night"
                labelOff="Hours restricted"
              />
            </FieldRow>

            <FieldRow label="Normal Pickup Requests">
              <Toggle
                value={form.commercial_normal_anytime}
                onChange={v => set('commercial_normal_anytime', v)}
                labelOn="Anytime — any time of day"
                labelOff="Window-restricted"
              />
            </FieldRow>
          </GlassCard>

          {/* Emergency pickup */}
          <GlassCard padding="md">
            <SectionHeader label="Emergency Pickup" />

            <FieldRow label="Emergency Overflow Pickups">
              <Toggle
                value={form.commercial_emergency_enabled}
                onChange={v => set('commercial_emergency_enabled', v)}
                labelOn="Enabled — commercial clients can request emergency pickups"
                labelOff="Disabled — emergency option hidden from clients"
              />
            </FieldRow>

            <FeeInput
              label="Emergency Fee (during hours)"
              value={form.commercial_emergency_fee}
              onChange={v => set('commercial_emergency_fee', v)}
              note="Shown to the commercial client before they confirm an emergency request. Recorded for bookkeeping only."
            />

            <FeeInput
              label="After-Hours Emergency Fee"
              value={form.commercial_after_hours_fee}
              onChange={v => set('commercial_after_hours_fee', v)}
              note="Applied when emergency pickup is requested outside normal business hours. Recorded for bookkeeping only."
            />
          </GlassCard>

          {/* Dispatch */}
          <GlassCard padding="md">
            <SectionHeader label="Dispatch Rules" />

            <FieldRow label="Priority Dispatch">
              <Toggle
                value={form.commercial_priority_dispatch}
                onChange={v => set('commercial_priority_dispatch', v)}
                labelOn="On — Emergency Overflow pickups jump to the top of the dispatch queue"
                labelOff="Off — Emergency Overflow pickups are queued in order of submission"
              />
            </FieldRow>

            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', lineHeight: 1.5 }}>
              When enabled, emergency pickups are marked <code style={{ color: '#00c8ff', fontSize: 10 }}>is_priority = true</code> and
              sorted to the top of the commercial dispatch queue for admin dispatchers.
            </p>
          </GlassCard>
        </div>
      )}

      {/* Save bar */}
      <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {saveMsg && (
          <div
            style={{
              padding:      '10px 14px',
              borderRadius: 12,
              fontSize:     13,
              fontWeight:   600,
              background:   saveMsg.ok ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
              border:       saveMsg.ok ? '1px solid rgba(74,222,128,0.3)' : '1px solid rgba(248,113,113,0.3)',
              color:        saveMsg.ok ? '#4ade80' : '#f87171',
            }}
          >
            {saveMsg.ok ? '✅' : '⚠️'} {saveMsg.text}
          </div>
        )}
        <PrimaryButton fullWidth size="lg" disabled={saving} onClick={() => void handleSave()}>
          {saving ? 'Saving…' : `Save ${activeTab === 'consumer' ? 'Consumer' : 'Commercial'} Settings`}
        </PrimaryButton>
      </div>
    </div>
  )
}
