import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { logout } from '../../lib/auth'
import { CommercialLayout } from './CommercialLayout'
import { GlassCard } from '../../components/ui/GlassCard'
import { PrimaryButton } from '../../components/ui/PrimaryButton'
import { StatusBadge } from '../../components/ui/StatusBadge'

// ── Demo data ─────────────────────────────────────────────────────────────────

const BUSINESS_FIELDS = [
  { label: 'Business Name',  value: 'Greenway Office Plaza'              },
  { label: 'Industry Type',  value: 'Commercial Office'                  },
  { label: 'Service Plan',   value: 'Enterprise Weekly'                  },
  { label: 'Warehouse',      value: 'NASH-01'                            },
  { label: 'Service Address', value: '1200 Commerce Blvd, Nashville TN' },
  { label: 'Building / Suite', value: 'Suite 400, Dock B'               },
]

const CONTACT_FIELDS = [
  { label: 'Contact Person',  value: 'Angela Bailey'              },
  { label: 'Title',           value: 'Operations Manager'         },
  { label: 'Email',           value: 'ops@greenway-plaza.com'     },
  { label: 'Phone',           value: '+1 615-800-2240'            },
]

const DOCK_FIELDS = [
  { label: 'Loading Dock Instructions', value: 'Enter through north gate, Dock 3 on left. Call ahead for forklift access.' },
  { label: 'Gate / Access Notes',       value: 'Gate code: 4481. Call Angela 30 min prior to arrival.'                    },
]

const BILLING_FIELDS = [
  { label: 'Billing Contact', value: 'Finance Team'              },
  { label: 'Billing Email',   value: 'billing@greenway-plaza.com' },
  { label: 'Invoice Method',  value: 'Email + Portal'            },
]

const ACCESS_LEVELS: {
  name: string
  role: string
  badge: 'green' | 'cyan' | 'gray' | 'yellow'
}[] = [
  { name: 'Angela Bailey',   role: 'Owner',      badge: 'green'  },
  { name: 'James Thornton',  role: 'Manager',    badge: 'cyan'   },
  { name: 'Sarah M.',        role: 'Staff',      badge: 'gray'   },
  { name: 'Finance Team',    role: 'Accounting', badge: 'yellow' },
]

const NOTIF_ITEMS = [
  { key: 'pickups',       label: 'Pickup Confirmations',    defaultOn: true  },
  { key: 'overflow',      label: 'Overflow Alerts',         defaultOn: true  },
  { key: 'invoiceDue',    label: 'Invoice Due Reminders',   defaultOn: true  },
  { key: 'contamination', label: 'Contamination Notices',   defaultOn: true  },
  { key: 'driverUpdates', label: 'Driver Updates',          defaultOn: false },
  { key: 'reportExports', label: 'Report Exports',          defaultOn: false },
]

const SUPPORT_LINKS = [
  { icon: '📞', label: 'Contact Dispatch',       sub: 'Reach your service coordinator' },
  { icon: '📋', label: 'Request Account Review', sub: 'Update plan or service terms'   },
  { icon: '📄', label: 'View Service Agreement', sub: 'Review your current contract'   },
  { icon: '⏸',  label: 'Pause Service',          sub: 'Temporarily suspend pickups'    },
]

// ── Shared sub-components ─────────────────────────────────────────────────────

function SectionLabel({ children }: { children: string }) {
  return (
    <p style={{
      fontSize: 10,
      fontWeight: 700,
      color: 'rgba(255,255,255,0.3)',
      textTransform: 'uppercase',
      letterSpacing: '0.1em',
      marginBottom: 10,
    }}>
      {children}
    </p>
  )
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </p>
      <p style={{ fontSize: 13, color: '#fff', fontWeight: 500, marginTop: 3, lineHeight: 1.4 }}>
        {value}
      </p>
    </div>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function CommercialProfile() {
  const navigate = useNavigate()
  const [toast, setToast] = useState<string | null>(null)
  const [notifs, setNotifs] = useState<Record<string, boolean>>(
    Object.fromEntries(NOTIF_ITEMS.map(n => [n.key, n.defaultOn]))
  )

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  function toggleNotif(key: string) {
    setNotifs(prev => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <CommercialLayout>
      <div className="px-4 pt-3 max-w-xl mx-auto w-full">

        {/* ── 1. Business badge card ── */}
        <GlassCard variant="accent" padding="lg" glow className="mb-5">
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black shrink-0"
              style={{ background: 'linear-gradient(135deg,#0057e7,#00c8ff)', color: '#fff' }}
            >
              G
            </div>
            <div className="flex-1 min-w-0">
              <p style={{ fontSize: 17, fontWeight: 800, color: '#fff' }}>Greenway Office Plaza</p>
              <p style={{ fontSize: 12, color: '#00c8ff', fontWeight: 600, marginTop: 2 }}>
                Enterprise Weekly · NASH-01
              </p>
              <div className="mt-2">
                <StatusBadge variant="green" label="Active" dot size="sm" />
              </div>
            </div>
          </div>
        </GlassCard>

        {/* ── 2. Business Information ── */}
        <SectionLabel>Business Information</SectionLabel>
        <GlassCard padding="md" className="mb-4">
          <div className="flex flex-col gap-3.5">
            {BUSINESS_FIELDS.map(f => <FieldRow key={f.label} label={f.label} value={f.value} />)}
          </div>
        </GlassCard>
        <PrimaryButton fullWidth size="md" className="mb-5" onClick={() => showToast('Opening business info editor…')}>
          ✏️ Edit Business Info
        </PrimaryButton>

        {/* ── 3. Contact Person ── */}
        <SectionLabel>Contact Person</SectionLabel>
        <GlassCard padding="md" className="mb-5">
          <div className="flex flex-col gap-3.5">
            {CONTACT_FIELDS.map(f => <FieldRow key={f.label} label={f.label} value={f.value} />)}
          </div>
        </GlassCard>

        {/* ── 4. Service Preferences ── */}
        <SectionLabel>Service Preferences</SectionLabel>
        <GlassCard padding="md" className="mb-5">
          <div className="flex flex-col gap-3.5">
            {DOCK_FIELDS.map(f => <FieldRow key={f.label} label={f.label} value={f.value} />)}
          </div>
        </GlassCard>

        {/* ── 5. Billing Contact ── */}
        <SectionLabel>Billing Contact</SectionLabel>
        <GlassCard padding="md" className="mb-5">
          <div className="flex flex-col gap-3.5">
            {BILLING_FIELDS.map(f => <FieldRow key={f.label} label={f.label} value={f.value} />)}
          </div>
        </GlassCard>

        {/* ── 6. User Access Levels ── */}
        <SectionLabel>User Access Levels</SectionLabel>
        <GlassCard padding="none" className="mb-4">
          {ACCESS_LEVELS.map((u, i) => (
            <div
              key={u.name}
              className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: i < ACCESS_LEVELS.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}
            >
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>{u.name}</p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>{u.role}</p>
              </div>
              <StatusBadge variant={u.badge} label={u.role} size="sm" />
            </div>
          ))}
        </GlassCard>
        <PrimaryButton fullWidth size="md" variant="secondary" className="mb-5" onClick={() => showToast('Opening user management…')}>
          👥 Manage Users
        </PrimaryButton>

        {/* ── 7. Notification Preferences ── */}
        <SectionLabel>Notification Preferences</SectionLabel>
        <GlassCard padding="none" className="mb-3">
          {NOTIF_ITEMS.map((n, i) => {
            const on = notifs[n.key]
            return (
              <button
                key={n.key}
                onClick={() => toggleNotif(n.key)}
                className="flex items-center justify-between w-full px-4 py-3 text-left transition-all hover:brightness-110"
                style={{
                  background: 'none',
                  border: 'none',
                  borderBottom: i < NOTIF_ITEMS.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                  cursor: 'pointer',
                }}
              >
                <p style={{ fontSize: 13, fontWeight: 600, color: on ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.35)' }}>
                  {n.label}
                </p>
                {/* Toggle pill */}
                <div style={{
                  width: 38,
                  height: 22,
                  borderRadius: 999,
                  background: on ? '#00c8ff' : 'rgba(255,255,255,0.1)',
                  position: 'relative',
                  flexShrink: 0,
                  transition: 'background 0.2s',
                }}>
                  <div style={{
                    position: 'absolute',
                    top: 3,
                    left: on ? 19 : 3,
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    background: on ? '#fff' : 'rgba(255,255,255,0.35)',
                    transition: 'left 0.2s',
                  }} />
                </div>
              </button>
            )
          })}
        </GlassCard>
        <PrimaryButton
          fullWidth size="md" variant="secondary" className="mb-5"
          onClick={() => navigate('/settings/notifications')}
        >
          🔔 Manage All Notification Settings
        </PrimaryButton>

        {/* ── 8. Support ── */}
        <SectionLabel>Support</SectionLabel>
        <GlassCard padding="none" className="mb-5">
          {SUPPORT_LINKS.map((item, i) => (
            <button
              key={item.label}
              onClick={() => showToast(`${item.label}…`)}
              className="flex items-center gap-3 w-full px-4 py-3.5 text-left transition-all hover:brightness-110"
              style={{
                background: 'none',
                border: 'none',
                borderBottom: i < SUPPORT_LINKS.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{item.icon}</span>
              <div className="flex-1">
                <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.75)' }}>{item.label}</p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>{item.sub}</p>
              </div>
              <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 16 }}>›</span>
            </button>
          ))}
        </GlassCard>

        {/* ── 9. Sign Out ── */}
        <button
          onClick={() => { void logout() }}
          className="w-full rounded-2xl py-3.5 text-sm font-bold transition-all hover:brightness-110 mb-2"
          style={{
            background: 'rgba(248,113,113,0.08)',
            border: '1px solid rgba(248,113,113,0.2)',
            color: '#f87171',
            cursor: 'pointer',
          }}
        >
          Sign Out
        </button>

        <div style={{ height: 8 }} />
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-sm font-semibold"
          style={{
            background: 'rgba(0,200,255,0.15)',
            border: '1px solid rgba(0,200,255,0.3)',
            color: '#00c8ff',
            backdropFilter: 'blur(12px)',
            whiteSpace: 'nowrap',
            maxWidth: 'calc(100vw - 32px)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          }}
        >
          {toast}
        </div>
      )}
    </CommercialLayout>
  )
}
