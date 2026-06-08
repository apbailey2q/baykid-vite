// AdminComplianceSettings.tsx — Admin-configurable knobs for the compliance system.
//
// Route:  /dashboard/admin/compliance-settings
// Access: admin + compliance_manager (write); operations_manager (read-only)
//
// Edits go through src/lib/complianceSettings.updateComplianceSetting which
// also writes an audit log entry (best-effort) and busts the in-memory cache
// so the new value is observable immediately.

import { useEffect, useState } from 'react'
import { DashboardShell } from '../../components/DashboardShell'
import { GlassCard } from '../../components/ui/GlassCard'
import { PrimaryButton } from '../../components/ui/PrimaryButton'
import {
  DEFAULTS,
  loadComplianceSettingsBundle,
  updateComplianceSetting,
  type ComplianceSettingsBundle,
} from '../../lib/complianceSettings'

interface FlashMessage {
  text: string
  tone: 'ok' | 'err'
}

export default function AdminComplianceSettings() {
  const [bundle, setBundle]       = useState<ComplianceSettingsBundle | null>(null)
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState<string | null>(null)
  const [flash, setFlash]         = useState<FlashMessage | null>(null)

  // Local draft fields — keep raw strings so users can type freely.
  const [warningDaysDraft, setWarningDaysDraft] = useState('')
  const [countdownDraft, setCountdownDraft]     = useState('')
  const [graceDraft, setGraceDraft]             = useState('')
  const [minDraft, setMinDraft]                 = useState('')
  const [overflowDraft, setOverflowDraft]       = useState('')

  const reload = async () => {
    setLoading(true)
    try {
      const b = await loadComplianceSettingsBundle()
      setBundle(b)
      setWarningDaysDraft(b.documentExpirationWarningDays.join(', '))
      setCountdownDraft(String(b.temporaryDeactivationCountdownDays))
      setGraceDraft(String(b.routeIncompleteGraceMinutes))
      setMinDraft(String(b.driverNeedMinimumAvailable))
      setOverflowDraft(String(b.commercialOverflowThreshold))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload()
  }, [])

  const flashFor = (key: string, msg: FlashMessage) => {
    setFlash(msg)
    // auto-clear after 4s
    setTimeout(() => setFlash(prev => (prev?.text === msg.text ? null : prev)), 4000)
    setSaving(prev => (prev === key ? null : prev))
  }

  const saveWarningDays = async () => {
    const parsed = warningDaysDraft
      .split(',')
      .map(s => parseInt(s.trim(), 10))
      .filter(n => Number.isFinite(n) && n >= 0)
    if (parsed.length === 0) {
      flashFor('warning_days', { tone: 'err', text: 'Provide at least one positive integer (comma-separated).' })
      return
    }
    setSaving('warning_days')
    const r = await updateComplianceSetting('document_expiration_warning_days', { days: parsed })
    flashFor('warning_days', r.ok
      ? { tone: 'ok',  text: `Saved: ${parsed.join(', ')}` }
      : { tone: 'err', text: r.error ?? 'Save failed.' })
    if (r.ok) await reload()
  }

  const saveCountdown = async () => {
    const n = parseInt(countdownDraft, 10)
    if (!Number.isFinite(n) || n < 1) {
      flashFor('countdown', { tone: 'err', text: 'Countdown must be a positive integer (days).' })
      return
    }
    setSaving('countdown')
    const r = await updateComplianceSetting('temporary_deactivation_countdown_days', { days: n })
    flashFor('countdown', r.ok ? { tone: 'ok', text: `Saved: ${n} day${n === 1 ? '' : 's'}` } : { tone: 'err', text: r.error ?? 'Save failed.' })
    if (r.ok) await reload()
  }

  const saveGrace = async () => {
    const n = parseInt(graceDraft, 10)
    if (!Number.isFinite(n) || n < 0) {
      flashFor('grace', { tone: 'err', text: 'Grace minutes must be 0 or higher.' })
      return
    }
    setSaving('grace')
    const r = await updateComplianceSetting('route_incomplete_grace_minutes', { minutes: n })
    flashFor('grace', r.ok ? { tone: 'ok', text: `Saved: ${n} minute${n === 1 ? '' : 's'}` } : { tone: 'err', text: r.error ?? 'Save failed.' })
    if (r.ok) await reload()
  }

  const saveMin = async () => {
    const n = parseInt(minDraft, 10)
    if (!Number.isFinite(n) || n < 0) {
      flashFor('min', { tone: 'err', text: 'Minimum drivers must be 0 or higher.' })
      return
    }
    setSaving('min')
    const r = await updateComplianceSetting('driver_need_minimum_available', { minimum: n })
    flashFor('min', r.ok ? { tone: 'ok', text: `Saved: ${n}` } : { tone: 'err', text: r.error ?? 'Save failed.' })
    if (r.ok) await reload()
  }

  const saveOverflow = async () => {
    const n = parseInt(overflowDraft, 10)
    if (!Number.isFinite(n) || n < 1) {
      flashFor('overflow', { tone: 'err', text: 'Threshold must be a positive integer.' })
      return
    }
    setSaving('overflow')
    const r = await updateComplianceSetting('commercial_overflow_threshold', { open_pickups: n })
    flashFor('overflow', r.ok ? { tone: 'ok', text: `Saved: ${n} open pickups` } : { tone: 'err', text: r.error ?? 'Save failed.' })
    if (r.ok) await reload()
  }

  return (
    <DashboardShell title="Compliance Settings">
      <GlassCard padding="md" className="mb-4">
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', margin: 0 }}>
          Configure thresholds used by the document expiration scheduler, the route + driver alert scheduler, and the user-facing countdown banner. Changes take effect on the next scheduler run and on the next dashboard load.
        </p>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 8 }}>
          Operations managers can read these values; only admins and compliance managers can change them. Edits are audited.
        </p>
      </GlassCard>

      {flash && (
        <GlassCard padding="md" className="mb-3">
          <p style={{ fontSize: 13, color: flash.tone === 'ok' ? '#86efac' : '#fca5a5', margin: 0 }}>
            {flash.tone === 'ok' ? '✅ ' : '❌ '}{flash.text}
          </p>
        </GlassCard>
      )}

      {loading && <GlassCard padding="md"><p style={{ color: 'rgba(255,255,255,0.6)' }}>Loading…</p></GlassCard>}

      {!loading && bundle && (
        <div className="space-y-4">

          <SettingCard
            title="Document expiration warning days"
            description="Days before a document's expiration date when we notify the user (comma-separated)."
            defaultValue={(DEFAULTS.document_expiration_warning_days as number[]).join(', ')}
            currentValue={bundle.documentExpirationWarningDays.join(', ')}
          >
            <input
              type="text"
              value={warningDaysDraft}
              onChange={e => setWarningDaysDraft(e.target.value)}
              placeholder="e.g. 30, 14, 7, 3, 1"
              style={inputStyle}
            />
            <SaveRow saving={saving === 'warning_days'} onSave={saveWarningDays} />
          </SettingCard>

          <SettingCard
            title="Temporary deactivation countdown (days)"
            description="How many days a user has to resolve a missing/expired required document before temporary deactivation."
            defaultValue={String(DEFAULTS.temporary_deactivation_countdown_days)}
            currentValue={String(bundle.temporaryDeactivationCountdownDays)}
          >
            <input
              type="number"
              min={1}
              value={countdownDraft}
              onChange={e => setCountdownDraft(e.target.value)}
              style={inputStyle}
            />
            <SaveRow saving={saving === 'countdown'} onSave={saveCountdown} />
          </SettingCard>

          <SettingCard
            title="Route incomplete grace period (minutes)"
            description="How long after the route should have been completed before an incomplete-route alert is created."
            defaultValue={String(DEFAULTS.route_incomplete_grace_minutes)}
            currentValue={String(bundle.routeIncompleteGraceMinutes)}
          >
            <input
              type="number"
              min={0}
              value={graceDraft}
              onChange={e => setGraceDraft(e.target.value)}
              style={inputStyle}
            />
            <SaveRow saving={saving === 'grace'} onSave={saveGrace} />
          </SettingCard>

          <SettingCard
            title="Driver need minimum available"
            description="When the available driver count in a market drops below this number, the scheduler creates a 'drivers needed' alert."
            defaultValue={String(DEFAULTS.driver_need_minimum_available)}
            currentValue={String(bundle.driverNeedMinimumAvailable)}
          >
            <input
              type="number"
              min={0}
              value={minDraft}
              onChange={e => setMinDraft(e.target.value)}
              style={inputStyle}
            />
            <SaveRow saving={saving === 'min'} onSave={saveMin} />
          </SettingCard>

          <SettingCard
            title="Commercial pickup overflow threshold"
            description="When the open commercial pickup count exceeds this number, the scheduler creates an overflow alert."
            defaultValue={String(DEFAULTS.commercial_overflow_threshold)}
            currentValue={String(bundle.commercialOverflowThreshold)}
          >
            <input
              type="number"
              min={1}
              value={overflowDraft}
              onChange={e => setOverflowDraft(e.target.value)}
              style={inputStyle}
            />
            <SaveRow saving={saving === 'overflow'} onSave={saveOverflow} />
          </SettingCard>

        </div>
      )}
    </DashboardShell>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 10,
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(0,190,255,0.18)',
  color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 12,
}

function SettingCard({
  title, description, defaultValue, currentValue, children,
}: {
  title: string
  description: string
  defaultValue: string
  currentValue: string
  children: React.ReactNode
}) {
  return (
    <GlassCard padding="md">
      <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{title}</p>
      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>{description}</p>
      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 12 }}>
        Current: <strong style={{ color: '#fff' }}>{currentValue}</strong> · Default: <code>{defaultValue}</code>
      </p>
      {children}
    </GlassCard>
  )
}

function SaveRow({ saving, onSave }: { saving: boolean; onSave: () => void }) {
  return (
    <div className="flex justify-end">
      <PrimaryButton size="sm" loading={saving} disabled={saving} onClick={onSave}>
        Save
      </PrimaryButton>
    </div>
  )
}
