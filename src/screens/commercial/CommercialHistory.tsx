import { useState } from 'react'
import { CommercialLayout } from './CommercialLayout'
import { GlassCard } from '../../components/ui/GlassCard'
import { StatusBadge } from '../../components/ui/StatusBadge'

// ── Types ─────────────────────────────────────────────────────────────────────

type EventCategory = 'pickup' | 'scan' | 'overflow' | 'contamination' | 'driver_note' | 'invoice' | 'report'

interface TimelineEvent {
  icon: string
  title: string
  sub: string
  time: string
  category: EventCategory
  detail: { label: string; value: string }[]
}

// ── Demo data ─────────────────────────────────────────────────────────────────

const CATEGORY_COLOR: Record<EventCategory, string> = {
  pickup:        '#4ade80',
  scan:          '#00c8ff',
  overflow:      '#fb923c',
  contamination: '#f87171',
  driver_note:   '#a78bfa',
  invoice:       '#fbbf24',
  report:        '#94a3b8',
}

const CATEGORY_BADGE: Record<EventCategory, { variant: 'green' | 'cyan' | 'amber' | 'red' | 'yellow' | 'gray'; label: string }> = {
  pickup:        { variant: 'green',  label: 'Pickup'        },
  scan:          { variant: 'cyan',   label: 'Scan'          },
  overflow:      { variant: 'amber',  label: 'Overflow'      },
  contamination: { variant: 'red',    label: 'Contamination' },
  driver_note:   { variant: 'gray',   label: 'Driver Note'   },
  invoice:       { variant: 'yellow', label: 'Invoice'       },
  report:        { variant: 'gray',   label: 'Report'        },
}

const EVENTS: TimelineEvent[] = [
  {
    icon: '✅', title: 'Pickup completed', sub: 'Cardboard Recovery Pickup',
    time: 'Today · 8:14 AM', category: 'pickup',
    detail: [
      { label: 'Driver',     value: 'Marcus J.'  },
      { label: 'Containers', value: '8 bins'     },
      { label: 'Weight',     value: '1,240 lbs'  },
      { label: 'Route',      value: 'NASH-RT-04' },
    ],
  },
  {
    icon: '📦', title: 'BIN-2048 scanned', sub: 'Rear Dock · North Gate',
    time: 'Today · 8:09 AM', category: 'scan',
    detail: [
      { label: 'Container',  value: 'BIN-2048'   },
      { label: 'Location',   value: 'Rear Dock'   },
      { label: 'Fill Level', value: '82%'          },
      { label: 'Scanned By', value: 'Marcus J.'   },
    ],
  },
  {
    icon: '🚨', title: 'Overflow request approved', sub: 'Emergency Overflow — Mixed Recycling',
    time: 'May 15 · 2:30 PM', category: 'overflow',
    detail: [
      { label: 'Type',        value: 'Emergency Overflow' },
      { label: 'Material',    value: 'Mixed Recycling'    },
      { label: 'Volume',      value: '15–30 yd³'          },
      { label: 'Approved By', value: 'Dispatch'           },
    ],
  },
  {
    icon: '🧾', title: 'Invoice INV-COMM-1008 created', sub: 'May 2026 billing · $1,840.00',
    time: 'May 15 · 9:00 AM', category: 'invoice',
    detail: [
      { label: 'Invoice',  value: 'INV-COMM-1008' },
      { label: 'Amount',   value: '$1,840.00'     },
      { label: 'Due Date', value: 'May 30, 2026'  },
      { label: 'Period',   value: 'May 2026'      },
    ],
  },
  {
    icon: '✔️', title: 'Contamination notice cleared', sub: 'Plastic wrap in cardboard stream resolved',
    time: 'May 14 · 11:45 AM', category: 'contamination',
    detail: [
      { label: 'Notice ID',   value: 'CONT-0142'   },
      { label: 'Material',    value: 'Cardboard'   },
      { label: 'Issue',       value: 'Plastic wrap' },
      { label: 'Resolved By', value: 'Ops Team'    },
    ],
  },
  {
    icon: '📄', title: 'Monthly report generated', sub: 'May 2026 Sustainability Summary',
    time: 'May 14 · 9:00 AM', category: 'report',
    detail: [
      { label: 'Report',    value: 'May 2026 Summary' },
      { label: 'CO₂ Saved', value: '12.8 tons'        },
      { label: 'Diverted',  value: '18,240 lbs'       },
      { label: 'Diversion', value: '91%'               },
    ],
  },
  {
    icon: '✅', title: 'Pickup completed', sub: 'Plastic Recovery Pickup',
    time: 'May 12 · 10:22 AM', category: 'pickup',
    detail: [
      { label: 'Driver',     value: 'Jenna R.'   },
      { label: 'Containers', value: '5 bins'     },
      { label: 'Weight',     value: '740 lbs'    },
      { label: 'Route',      value: 'NASH-RT-07' },
    ],
  },
  {
    icon: '📝', title: 'Driver note added', sub: '"Gate code updated — notify dispatch."',
    time: 'May 10 · 3:15 PM', category: 'driver_note',
    detail: [
      { label: 'Driver', value: 'Marcus J.'                              },
      { label: 'Note',   value: 'Gate code updated. Notify dispatch.'    },
    ],
  },
  {
    icon: '📦', title: 'BIN-1072 scanned', sub: 'Front Dock · Loading Area',
    time: 'May 10 · 10:05 AM', category: 'scan',
    detail: [
      { label: 'Container',  value: 'BIN-1072'   },
      { label: 'Location',   value: 'Front Dock'  },
      { label: 'Fill Level', value: '64%'          },
      { label: 'Scanned By', value: 'Jenna R.'    },
    ],
  },
  {
    icon: '⚠️', title: 'Contamination notice issued', sub: 'Plastic wrap found in cardboard stream',
    time: 'May 5 · 8:40 AM', category: 'contamination',
    detail: [
      { label: 'Notice ID', value: 'CONT-0142'    },
      { label: 'Container', value: 'BIN-2048'     },
      { label: 'Issue',     value: 'Plastic wrap' },
      { label: 'Status',    value: 'Cleared'      },
    ],
  },
]

// ── Screen ────────────────────────────────────────────────────────────────────

export default function CommercialHistory() {
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  function toggle(i: number) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  const pickupCount = EVENTS.filter(e => e.category === 'pickup').length
  const alertCount  = EVENTS.filter(e => e.category === 'contamination').length

  return (
    <CommercialLayout>
      <div className="px-4 pt-3 max-w-xl mx-auto w-full">

        {/* ── Header ── */}
        <div className="mb-5">
          <p style={{ fontSize: 22, fontWeight: 900, color: '#fff', lineHeight: 1.2 }}>
            Service History
          </p>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 3 }}>
            Account activity and service timeline
          </p>
        </div>

        {/* ── Summary stats ── */}
        <div className="grid grid-cols-3 gap-2.5 mb-5">
          {[
            { label: 'Total Events', value: EVENTS.length, color: '#00c8ff' },
            { label: 'Pickups',      value: pickupCount,   color: '#4ade80' },
            { label: 'Alerts',       value: alertCount,    color: '#f87171' },
          ].map(s => (
            <GlassCard key={s.label} padding="md" className="text-center">
              <p style={{ fontSize: 22, fontWeight: 900, color: s.color, lineHeight: 1 }}>
                {s.value}
              </p>
              <p style={{ fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 5 }}>
                {s.label}
              </p>
            </GlassCard>
          ))}
        </div>

        {/* ── Timeline ── */}
        <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
          Activity Timeline
        </p>

        <div style={{ position: 'relative' }}>
          {/* Vertical connector line */}
          <div style={{
            position: 'absolute',
            left: 11,
            top: 20,
            bottom: 20,
            width: 2,
            background: 'rgba(255,255,255,0.06)',
            borderRadius: 1,
          }} />

          {EVENTS.map((e, i) => {
            const color   = CATEGORY_COLOR[e.category]
            const badge   = CATEGORY_BADGE[e.category]
            const isOpen  = expanded.has(i)

            return (
              <div key={i} style={{ display: 'flex', gap: 14, marginBottom: 12, position: 'relative' }}>

                {/* Timeline dot */}
                <div style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: `${color}18`,
                  border: `2px solid ${color}`,
                  flexShrink: 0,
                  marginTop: 14,
                  zIndex: 1,
                  boxShadow: `0 0 8px ${color}40`,
                }} />

                {/* Card (button wrapper for expand) */}
                <button
                  onClick={() => toggle(i)}
                  className="flex-1 text-left"
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                >
                  <GlassCard padding="md">
                    {/* Top row */}
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex items-center gap-2 flex-1 min-w-0 mr-2">
                        <span style={{ fontSize: 14, flexShrink: 0 }}>{e.icon}</span>
                        <p style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: '#fff',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {e.title}
                        </p>
                      </div>
                      <StatusBadge variant={badge.variant} label={badge.label} size="sm" />
                    </div>

                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 5, lineHeight: 1.4 }}>
                      {e.sub}
                    </p>
                    <p style={{ fontSize: 10, color, fontWeight: 600 }}>
                      🕐 {e.time}
                    </p>

                    {/* Expanded detail */}
                    {isOpen && (
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                          {e.detail.map(row => (
                            <div key={row.label}>
                              <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                                {row.label}
                              </p>
                              <p style={{ fontSize: 12, color: '#fff', fontWeight: 600, marginTop: 2 }}>
                                {row.value}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 8, textAlign: 'right' }}>
                      {isOpen ? '▲ Less' : '▼ Details'}
                    </p>
                  </GlassCard>
                </button>
              </div>
            )
          })}
        </div>

        <div style={{ height: 8 }} />
      </div>
    </CommercialLayout>
  )
}
