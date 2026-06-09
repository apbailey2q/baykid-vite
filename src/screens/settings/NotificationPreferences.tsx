import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { AppShell } from '../../components/ui/AppShell'
import { PageHeader } from '../../components/ui/PageHeader'
import { GlassCard } from '../../components/ui/GlassCard'
import { PrimaryButton } from '../../components/ui/PrimaryButton'
import { isPushConfigured } from '../../lib/vapid'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NotifPrefs {
  email_enabled:      boolean
  push_enabled:       boolean
  operational_alerts: boolean
  billing_alerts:     boolean
  dispatch_messages:  boolean
  support_updates:    boolean
  warehouse_alerts:   boolean
  inspection_alerts:  boolean
  marketing_updates:  boolean
  emergency_alerts:   boolean
}

const DEFAULT_PREFS: NotifPrefs = {
  email_enabled:      true,
  push_enabled:       true,
  operational_alerts: true,
  billing_alerts:     true,
  dispatch_messages:  true,
  support_updates:    true,
  warehouse_alerts:   true,
  inspection_alerts:  true,
  marketing_updates:  false,
  emergency_alerts:   true,
}

// Roles that cannot turn off emergency_alerts
const EMERGENCY_LOCK_ROLES = new Set([
  'driver', 'warehouse_employee', 'warehouse_supervisor', 'admin',
])

// ── Category definitions ──────────────────────────────────────────────────────

interface PrefCategory {
  key:         keyof NotifPrefs
  icon:        string
  label:       string
  description: string
}

const PREF_CATEGORIES: PrefCategory[] = [
  { key: 'operational_alerts', icon: '🚛', label: 'Operational Alerts',  description: 'Pickup status updates and driver assignments'      },
  { key: 'billing_alerts',     icon: '🧾', label: 'Billing Alerts',      description: 'Invoice due reminders and payment confirmations'   },
  { key: 'dispatch_messages',  icon: '📡', label: 'Dispatch Messages',   description: 'Direct messages from the dispatch team'            },
  { key: 'support_updates',    icon: '💬', label: 'Support Updates',     description: 'Responses to your support requests'                },
  { key: 'warehouse_alerts',   icon: '🏭', label: 'Warehouse Alerts',    description: 'Warehouse check-ins and bay assignments'           },
  { key: 'inspection_alerts',  icon: '🔍', label: 'Inspection Alerts',   description: 'Inspection results and contamination flags'        },
  { key: 'marketing_updates',  icon: '📣', label: 'Product Updates',     description: 'New features, announcements, and tips'             },
  { key: 'emergency_alerts',   icon: '🚨', label: 'Emergency Alerts',    description: 'Critical safety alerts — always on for your role' },
]

// ── Toggle pill ───────────────────────────────────────────────────────────────

function TogglePill({ on, locked }: { on: boolean; locked?: boolean }) {
  return (
    <div style={{
      width: 42, height: 24, borderRadius: 999, flexShrink: 0,
      background: locked ? 'rgba(248,113,113,0.3)' : on ? '#00c8ff' : 'rgba(255,255,255,0.1)',
      position: 'relative',
      transition: 'background 0.2s',
      opacity: locked ? 0.7 : 1,
    }}>
      <div style={{
        position: 'absolute',
        top: 4, left: on || locked ? 22 : 4,
        width: 16, height: 16, borderRadius: '50%',
        background: locked ? '#f87171' : on ? '#fff' : 'rgba(255,255,255,0.35)',
        transition: 'left 0.2s',
      }} />
    </div>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function NotificationPreferences() {
  const navigate     = useNavigate()
  const { user, role } = useAuthStore()

  const [prefs,    setPrefs]    = useState<NotifPrefs>(DEFAULT_PREFS)
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [toast,    setToast]    = useState<{ msg: string; ok: boolean } | null>(null)
  const [dirty,    setDirty]    = useState(false)

  const emergencyLocked = EMERGENCY_LOCK_ROLES.has(role ?? '')

  // ── Load ───────────────────────────────────────────────────────────────────

  const loadPrefs = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (data) {
      setPrefs({
        email_enabled:      data.email_enabled ?? true,
        push_enabled:       data.push_enabled ?? true,
        operational_alerts: data.operational_alerts,
        billing_alerts:     data.billing_alerts,
        dispatch_messages:  data.dispatch_messages,
        support_updates:    data.support_updates,
        warehouse_alerts:   data.warehouse_alerts,
        inspection_alerts:  data.inspection_alerts,
        marketing_updates:  data.marketing_updates,
        emergency_alerts:   emergencyLocked ? true : data.emergency_alerts,
      })
    }
    setLoading(false)
  }, [user, emergencyLocked])

  useEffect(() => { loadPrefs() }, [loadPrefs])

  // ── Toggle ─────────────────────────────────────────────────────────────────

  function toggle(key: keyof NotifPrefs) {
    if (key === 'emergency_alerts' && emergencyLocked) return
    setPrefs(p => ({ ...p, [key]: !p[key] }))
    setDirty(true)
  }

  // ── Save ───────────────────────────────────────────────────────────────────

  async function save() {
    if (!user || saving) return
    setSaving(true)
    const payload = { ...prefs, user_id: user.id }
    if (emergencyLocked) payload.emergency_alerts = true

    const { error } = await supabase
      .from('notification_preferences')
      .upsert(payload, { onConflict: 'user_id' })

    setSaving(false)
    if (error) {
      showToast('Failed to save. Please try again.', false)
    } else {
      setDirty(false)
      showToast('Preferences saved', true)
    }
  }

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 2500)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <AppShell>
      <PageHeader
        rightContent={
          <button
            onClick={() => navigate(-1)}
            style={{
              fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.5)',
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 10, padding: '6px 12px', cursor: 'pointer',
            }}
          >
            ← Back
          </button>
        }
      />

      <div className="px-4 pt-5 pb-10 max-w-xl mx-auto w-full">

        {/* ── Header ── */}
        <div className="mb-5">
          <p style={{ fontSize: 22, fontWeight: 900, color: '#fff', lineHeight: 1.2 }}>
            Notification Preferences
          </p>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 3 }}>
            Choose which alerts you receive
          </p>
        </div>

        {/* ── Push not configured banner ── */}
        {!isPushConfigured() && (
          <GlassCard padding="md" className="mb-5">
            <div className="flex items-start gap-3">
              <span style={{ fontSize: 18, flexShrink: 0 }}>🔔</span>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#fbbf24', marginBottom: 3 }}>
                  Push notifications are being prepared
                </p>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
                  Push notifications may not send live alerts yet during the beta period.
                  In-app notification preferences below are active and will be used
                  once push delivery is enabled.
                </p>
              </div>
            </div>
          </GlassCard>
        )}

        {/* ── Emergency lock banner ── */}
        {emergencyLocked && (
          <GlassCard padding="md" className="mb-5">
            <div className="flex items-start gap-3">
              <span style={{ fontSize: 18, flexShrink: 0 }}>🚨</span>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
                Emergency and critical safety alerts are required for operational roles and cannot be disabled.
              </p>
            </div>
          </GlassCard>
        )}

        {/* ── Channel master switches ── */}
        {!loading && (
          <GlassCard padding="none" className="mb-4">
            <div style={{ padding: '10px 16px 4px', color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Delivery channels
            </div>
            {[
              { key: 'email_enabled' as const, icon: '📧', label: 'Email', description: 'Receive notifications by email' },
              { key: 'push_enabled'  as const, icon: '🔔', label: 'Push',  description: 'Receive notifications on this device' },
            ].map((ch, i, arr) => {
              const on = prefs[ch.key]
              return (
                <button
                  key={ch.key}
                  onClick={() => toggle(ch.key)}
                  className="flex items-center gap-3 w-full px-4 py-3.5 text-left"
                  style={{
                    background:   'none',
                    border:       'none',
                    borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                    cursor:       'pointer',
                  }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    background: on ? 'rgba(0,200,255,0.1)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${on ? 'rgba(0,200,255,0.2)' : 'rgba(255,255,255,0.08)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18,
                    transition: 'background 0.2s',
                  }}>{ch.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: on ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)', transition: 'color 0.2s' }}>
                      {ch.label}
                    </p>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2, lineHeight: 1.4 }}>
                      {ch.description}
                    </p>
                  </div>
                  <TogglePill on={on} />
                </button>
              )
            })}
          </GlassCard>
        )}

        {/* ── Preference toggles ── */}
        {!loading && (
          <div style={{ padding: '0 4px 6px', color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Categories
          </div>
        )}
        {loading ? (
          <GlassCard padding="lg" className="text-center mb-5">
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Loading preferences…</p>
          </GlassCard>
        ) : (
          <GlassCard padding="none" className="mb-6">
            {PREF_CATEGORIES.map((cat, i) => {
              const on     = prefs[cat.key]
              const locked = cat.key === 'emergency_alerts' && emergencyLocked
              return (
                <button
                  key={cat.key}
                  onClick={() => toggle(cat.key)}
                  disabled={locked}
                  className="flex items-center gap-3 w-full px-4 py-3.5 text-left"
                  style={{
                    background:   'none',
                    border:       'none',
                    borderBottom: i < PREF_CATEGORIES.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                    cursor:       locked ? 'default' : 'pointer',
                  }}
                >
                  {/* Icon */}
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    background: on || locked ? 'rgba(0,200,255,0.1)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${on || locked ? 'rgba(0,200,255,0.2)' : 'rgba(255,255,255,0.08)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18,
                    transition: 'background 0.2s',
                  }}>
                    {cat.icon}
                  </div>

                  {/* Text */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: 13, fontWeight: 700,
                      color: on || locked ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)',
                      transition: 'color 0.2s',
                    }}>
                      {cat.label}
                      {locked && (
                        <span style={{ fontSize: 10, fontWeight: 600, color: '#f87171', marginLeft: 6 }}>
                          REQUIRED
                        </span>
                      )}
                    </p>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2, lineHeight: 1.4 }}>
                      {cat.description}
                    </p>
                  </div>

                  <TogglePill on={on} locked={locked} />
                </button>
              )
            })}
          </GlassCard>
        )}

        {/* ── Save button ── */}
        {!loading && (
          <PrimaryButton
            fullWidth
            size="md"
            onClick={save}
            disabled={saving || !dirty}
          >
            {saving ? 'Saving…' : dirty ? 'Save Preferences' : 'Saved'}
          </PrimaryButton>
        )}

        {/* ── Privacy & Account ── */}
        <div style={{ marginTop: 16, padding: '14px 18px',
                      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
            Privacy &amp; Account
          </p>
          <Link
            to="/account-deletion"
            style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none',
                     color: '#f87171', fontSize: 13, fontWeight: 600, padding: '6px 0' }}
          >
            <span>🗑️</span>
            <span>Delete My Account</span>
          </Link>
        </div>
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-sm font-semibold"
          style={{
            background:   toast.ok ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)',
            border:       `1px solid ${toast.ok ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)'}`,
            color:        toast.ok ? '#4ade80' : '#f87171',
            backdropFilter: 'blur(12px)',
            whiteSpace:   'nowrap',
            maxWidth:     'calc(100vw - 32px)',
            boxShadow:    '0 4px 24px rgba(0,0,0,0.4)',
          }}
        >
          {toast.msg}
        </div>
      )}
    </AppShell>
  )
}
