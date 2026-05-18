import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CommercialLayout } from './CommercialLayout'
import { GlassCard } from '../../components/ui/GlassCard'
import { PrimaryButton } from '../../components/ui/PrimaryButton'
import { StatusBadge } from '../../components/ui/StatusBadge'

// ── Demo data ─────────────────────────────────────────────────────────────────

type ContainerStatus = 'normal' | 'near_full' | 'flagged' | 'scheduled'

interface Container {
  id:          string
  type:        string
  material:    string
  fill:        number
  lastPickup:  string
  status:      ContainerStatus
  location:    string
  icon:        string
}

const CONTAINERS: Container[] = [
  {
    id:         'BIN-2048',
    type:       'Cardboard Compactor',
    material:   'Cardboard',
    fill:       82,
    lastPickup: 'Yesterday',
    status:     'normal',
    location:   'Rear Dock',
    icon:       '⚙️',
  },
  {
    id:         'BIN-1072',
    type:       'Plastic Bin',
    material:   'Plastic',
    fill:       64,
    lastPickup: '2 days ago',
    status:     'normal',
    location:   'Loading Bay 2',
    icon:       '🗑️',
  },
  {
    id:         'DUMP-3021',
    type:       'Dumpster',
    material:   'Mixed Recycling',
    fill:       91,
    lastPickup: '4 days ago',
    status:     'near_full',
    location:   'North Lot',
    icon:       '🚚',
  },
  {
    id:         'PAL-5509',
    type:       'Pallet',
    material:   'Cardboard',
    fill:       45,
    lastPickup: 'Today',
    status:     'flagged',
    location:   'Warehouse Entrance',
    icon:       '📦',
  },
]

const SUMMARY = [
  { label: 'Total',       value: '18',   color: '#00c8ff' },
  { label: 'Near Full',   value: '4',    color: '#fbbf24' },
  { label: 'Flagged',     value: '1',    color: '#f87171' },
  { label: 'Last Pickup', value: 'Today', color: '#4ade80' },
]

const STATUS_BADGE: Record<ContainerStatus, { variant: 'green' | 'yellow' | 'red' | 'cyan'; label: string }> = {
  normal:    { variant: 'green',  label: 'Normal'    },
  near_full: { variant: 'yellow', label: 'Near Full' },
  flagged:   { variant: 'red',    label: 'Flagged'   },
  scheduled: { variant: 'cyan',   label: 'Scheduled' },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fillColor(pct: number): string {
  if (pct > 85) return '#f87171'
  if (pct > 60) return '#fbbf24'
  return '#4ade80'
}

function fillGlow(pct: number): string {
  if (pct > 85) return 'rgba(248,113,113,0.35)'
  if (pct > 60) return 'rgba(251,191,36,0.35)'
  return 'rgba(74,222,128,0.35)'
}

// ── Report Issue modal (local state, no Supabase) ─────────────────────────────

function ReportModal({
  container,
  onClose,
}: {
  container: Container
  onClose: () => void
}) {
  const [submitted, setSubmitted] = useState(false)
  const [note, setNote] = useState('')

  if (submitted) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-end justify-center"
        style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
        onClick={onClose}
      >
        <div
          className="w-full max-w-lg rounded-t-3xl px-6 py-8 flex flex-col items-center gap-4"
          style={{ background: '#0a1628', border: '1px solid rgba(0,200,255,0.15)' }}
          onClick={e => e.stopPropagation()}
        >
          <span style={{ fontSize: 40 }}>✅</span>
          <p style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>Issue Reported</p>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>
            Dispatch has been notified about {container.id}. A team member will follow up shortly.
          </p>
          <PrimaryButton fullWidth onClick={onClose}>Close</PrimaryButton>
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-t-3xl px-5 py-6"
        style={{ background: '#0a1628', border: '1px solid rgba(0,200,255,0.15)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <p style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>Report Issue — {container.id}</p>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 20, cursor: 'pointer' }}
          >
            ×
          </button>
        </div>

        {[
          { icon: '🚫', label: 'Contamination detected' },
          { icon: '🔧', label: 'Bin damaged or broken'  },
          { icon: '📍', label: 'Wrong location'         },
          { icon: '⚠️', label: 'Safety hazard nearby'   },
          { icon: '🔒', label: 'Access blocked'         },
        ].map(item => (
          <button
            key={item.label}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl mb-2 text-left transition-all hover:brightness-110"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', cursor: 'pointer' }}
            onClick={() => setSubmitted(true)}
          >
            <span style={{ fontSize: 18 }}>{item.icon}</span>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: 500 }}>{item.label}</span>
          </button>
        ))}

        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Additional notes (optional)…"
          style={{
            width: '100%',
            marginTop: 8,
            padding: '12px 14px',
            borderRadius: 12,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(0,200,255,0.15)',
            color: '#fff',
            fontSize: 13,
            outline: 'none',
            resize: 'vertical',
            minHeight: 64,
            boxSizing: 'border-box',
          }}
        />

        <PrimaryButton
          fullWidth
          size="lg"
          variant="danger"
          className="mt-4"
          onClick={() => setSubmitted(true)}
        >
          Submit Report
        </PrimaryButton>
      </div>
    </div>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function CommercialBins() {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState<string | null>(null)
  const [reporting, setReporting] = useState<Container | null>(null)

  function toggle(id: string) {
    setExpanded(prev => prev === id ? null : id)
  }

  return (
    <CommercialLayout>
      <div className="px-4 pt-3 max-w-xl mx-auto w-full">

        {/* ── Header ── */}
        <div className="mb-5">
          <p style={{ fontSize: 22, fontWeight: 900, color: '#fff', lineHeight: 1.2 }}>
            Commercial Containers
          </p>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 3 }}>
            Track QR bins, fill levels, and contamination status.
          </p>
        </div>

        {/* ── Summary row ── */}
        <div className="grid grid-cols-4 gap-2 mb-5">
          {SUMMARY.map(s => (
            <GlassCard key={s.label} padding="sm" className="text-center">
              <p style={{ fontSize: 18, fontWeight: 900, color: s.color, lineHeight: 1 }}>
                {s.value}
              </p>
              <p style={{ fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4 }}>
                {s.label}
              </p>
            </GlassCard>
          ))}
        </div>

        {/* ── Container cards ── */}
        <div className="flex flex-col gap-3 mb-4">
          {CONTAINERS.map(c => {
            const badge     = STATUS_BADGE[c.status]
            const fc        = fillColor(c.fill)
            const glow      = fillGlow(c.fill)
            const isOpen    = expanded === c.id

            return (
              <GlassCard
                key={c.id}
                padding="none"
                variant={c.status === 'flagged' ? 'elevated' : 'default'}
                className="overflow-hidden"
              >
                {/* ── Card header row ── */}
                <button
                  onClick={() => toggle(c.id)}
                  className="w-full text-left px-4 pt-4 pb-3"
                  style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0"
                        style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
                      >
                        {c.icon}
                      </div>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' }}>
                          {c.id}
                        </p>
                        <p style={{ fontSize: 11, color: '#00c8ff', fontWeight: 600, marginTop: 1 }}>
                          {c.type}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <StatusBadge variant={badge.variant} label={badge.label} size="sm" dot />
                      <span style={{ fontSize: 16, color: 'rgba(255,255,255,0.25)', lineHeight: 1 }}>
                        {isOpen ? '▲' : '▼'}
                      </span>
                    </div>
                  </div>

                  {/* Fill bar */}
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className="flex-1 rounded-full overflow-hidden"
                      style={{ height: 8, background: 'rgba(255,255,255,0.08)' }}
                    >
                      <div
                        style={{
                          width: `${c.fill}%`,
                          height: '100%',
                          background: fc,
                          borderRadius: 999,
                          boxShadow: `0 0 8px ${glow}`,
                          transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)',
                        }}
                      />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 800, color: fc, minWidth: 38, textAlign: 'right' }}>
                      {c.fill}%
                    </span>
                  </div>

                  <div className="flex items-center gap-4">
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                      📍 {c.location}
                    </span>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                      ♻️ {c.material}
                    </span>
                  </div>
                </button>

                {/* ── Expanded detail ── */}
                {isOpen && (
                  <div
                    className="px-4 pb-4 pt-1"
                    style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
                  >
                    {/* Detail grid */}
                    <div className="grid grid-cols-2 gap-3 mb-4 pt-3">
                      {[
                        { label: 'Container ID', value: c.id         },
                        { label: 'Type',         value: c.type       },
                        { label: 'Material',     value: c.material   },
                        { label: 'Fill Level',   value: `${c.fill}%` },
                        { label: 'Last Pickup',  value: c.lastPickup },
                        { label: 'Location',     value: c.location   },
                      ].map(row => (
                        <div key={row.label}>
                          <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            {row.label}
                          </p>
                          <p style={{ fontSize: 12, color: '#fff', fontWeight: 600, marginTop: 2 }}>
                            {row.value}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Fill level label */}
                    {c.fill > 85 && (
                      <div
                        className="rounded-xl px-3 py-2.5 mb-3 flex items-center gap-2"
                        style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)' }}
                      >
                        <span style={{ fontSize: 14 }}>🔴</span>
                        <p style={{ fontSize: 12, color: '#f87171', fontWeight: 600 }}>
                          Critical fill level — pickup recommended immediately.
                        </p>
                      </div>
                    )}
                    {c.fill > 60 && c.fill <= 85 && (
                      <div
                        className="rounded-xl px-3 py-2.5 mb-3 flex items-center gap-2"
                        style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.22)' }}
                      >
                        <span style={{ fontSize: 14 }}>⚠️</span>
                        <p style={{ fontSize: 12, color: '#fbbf24', fontWeight: 600 }}>
                          Approaching capacity — schedule pickup soon.
                        </p>
                      </div>
                    )}
                    {c.status === 'flagged' && (
                      <div
                        className="rounded-xl px-3 py-2.5 mb-3 flex items-center gap-2"
                        style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}
                      >
                        <span style={{ fontSize: 14 }}>🚩</span>
                        <p style={{ fontSize: 12, color: '#f87171', fontWeight: 600 }}>
                          Container flagged for inspection by dispatch.
                        </p>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2">
                        <PrimaryButton
                          size="sm"
                          variant="secondary"
                          fullWidth
                          onClick={() => navigate('/dashboard/commercial/bins')}
                        >
                          📋 View Details
                        </PrimaryButton>
                        <PrimaryButton
                          size="sm"
                          fullWidth
                          onClick={() => navigate('/dashboard/commercial/pickup')}
                        >
                          🚛 Request Pickup
                        </PrimaryButton>
                      </div>
                      <PrimaryButton
                        size="sm"
                        variant="danger"
                        fullWidth
                        onClick={() => setReporting(c)}
                      >
                        🚩 Report Issue
                      </PrimaryButton>
                    </div>
                  </div>
                )}
              </GlassCard>
            )
          })}
        </div>

        {/* ── Request all pickups CTA ── */}
        <GlassCard variant="accent" padding="md" glow className="mb-2">
          <div className="flex items-center justify-between">
            <div>
              <p style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>4 containers near capacity</p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>Request bulk pickup for all</p>
            </div>
            <PrimaryButton
              size="sm"
              onClick={() => navigate('/dashboard/commercial/pickup')}
            >
              Schedule
            </PrimaryButton>
          </div>
        </GlassCard>

      </div>

      {/* ── Report modal ── */}
      {reporting && (
        <ReportModal
          container={reporting}
          onClose={() => setReporting(null)}
        />
      )}
    </CommercialLayout>
  )
}
