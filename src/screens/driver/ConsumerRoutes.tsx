import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GlassCard } from '../../components/ui/GlassCard'
import { PrimaryButton } from '../../components/ui/PrimaryButton'
import { StatusBadge } from '../../components/ui/StatusBadge'

// ── Demo data ─────────────────────────────────────────────────────────────────

interface Stop {
  id: string
  address: string
  unit: string
  bags: number
}

interface ZipGroup {
  zip: string
  area: string
  stops: Stop[]
}

const ZIP_GROUPS: ZipGroup[] = [
  {
    zip: '37201', area: 'Downtown Nashville',
    stops: [
      { id: 'c1', address: '421 Broadway Ave',  unit: 'House',   bags: 3 },
      { id: 'c2', address: '815 River Rd',       unit: 'Apt #2B', bags: 2 },
      { id: 'c3', address: '1102 Oak St',         unit: 'House',   bags: 2 },
    ],
  },
  {
    zip: '37203', area: 'The Gulch',
    stops: [
      { id: 'c4', address: '338 Cedar Blvd',  unit: 'Apt #4A', bags: 3 },
      { id: 'c5', address: '924 Maple Dr',    unit: 'House',   bags: 2 },
    ],
  },
  {
    zip: '37215', area: 'Green Hills',
    stops: [
      { id: 'c6', address: '205 Elm Way',     unit: 'House',   bags: 2 },
      { id: 'c7', address: '741 Pine Ct',      unit: 'Apt #1C', bags: 3 },
      { id: 'c8', address: '1888 Birch St',    unit: 'House',   bags: 2 },
      { id: 'c9', address: '550 Walnut Ave',   unit: 'House',   bags: 2 },
    ],
  },
]

const WAREHOUSE = { name: 'NASH-01 Facility', address: '900 Industrial Pkwy, Nashville TN' }

const ALL_STOPS = ZIP_GROUPS.flatMap(g => g.stops)
const TOTAL_BAGS  = ALL_STOPS.reduce((s, st) => s + st.bags, 0)

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ConsumerRoutes() {
  const navigate = useNavigate()
  const [completed, setCompleted] = useState<Set<string>>(new Set())
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  function completeStop(id: string) {
    setCompleted(prev => new Set([...prev, id]))
    setExpandedId(null)
    showToast('Stop marked complete ✓')
  }

  const doneCount = completed.size

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}>

      {/* ── Header ── */}
      <header
        className="flex items-center gap-3 px-4 py-3 shrink-0"
        style={{ background: 'rgba(4,10,24,0.94)', borderBottom: '1px solid rgba(0,200,255,0.12)', backdropFilter: 'blur(12px)' }}
      >
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', fontSize: 14, padding: '4px 6px' }}
        >
          ← Back
        </button>
        <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: '#fff', textAlign: 'center' }}>
          Consumer Routes
        </span>
        <button
          onClick={() => showToast('Emergency dispatch contacted')}
          className="rounded-xl px-2.5 py-1.5 text-xs font-bold transition-all hover:brightness-110"
          style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.35)', color: '#f87171', cursor: 'pointer' }}
        >
          🚨 SOS
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5 pb-24 max-w-xl mx-auto w-full">

        {/* ── Stats ── */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { label: 'Total Stops', value: ALL_STOPS.length, color: '#00c8ff' },
            { label: 'Total Bags',  value: TOTAL_BAGS,       color: '#a78bfa' },
            { label: 'Completed',   value: doneCount,         color: '#4ade80' },
          ].map(s => (
            <GlassCard key={s.label} padding="md" className="text-center">
              <p style={{ fontSize: 22, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</p>
              <p style={{ fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 5 }}>
                {s.label}
              </p>
            </GlassCard>
          ))}
        </div>

        {/* ── Optimize button ── */}
        <PrimaryButton
          fullWidth
          size="md"
          variant="secondary"
          className="mb-5"
          onClick={() => showToast('Optimizing route…')}
        >
          🗺️ Optimize Route
        </PrimaryButton>

        {/* ── ZIP groups ── */}
        {ZIP_GROUPS.map(group => {
          const groupDone = group.stops.filter(s => completed.has(s.id)).length
          return (
            <div key={group.zip} className="mb-5">
              {/* Group header */}
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p style={{ fontSize: 11, fontWeight: 800, color: '#00c8ff', letterSpacing: '0.06em' }}>
                    ZIP {group.zip}
                  </p>
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>
                    {group.area} · {group.stops.length} stops
                  </p>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: groupDone === group.stops.length ? '#4ade80' : 'rgba(255,255,255,0.3)' }}>
                  {groupDone}/{group.stops.length}
                </span>
              </div>

              {/* Stop cards */}
              <div className="flex flex-col gap-2">
                {group.stops.map(stop => {
                  const isDone    = completed.has(stop.id)
                  const isExpanded = expandedId === stop.id

                  return (
                    <GlassCard key={stop.id} padding="none">
                      {/* Stop row */}
                      <button
                        onClick={() => !isDone && setExpandedId(isExpanded ? null : stop.id)}
                        className="w-full px-4 py-3 text-left"
                        style={{ background: 'none', border: 'none', cursor: isDone ? 'default' : 'pointer' }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1 min-w-0 mr-2">
                            {/* Dot */}
                            <div style={{
                              width: 10,
                              height: 10,
                              borderRadius: '50%',
                              background: isDone ? '#4ade80' : '#00c8ff',
                              flexShrink: 0,
                            }} />
                            <div className="min-w-0">
                              <p style={{ fontSize: 13, fontWeight: 700, color: isDone ? 'rgba(255,255,255,0.4)' : '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {stop.address}
                              </p>
                              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>
                                {stop.unit} · 🛍️ {stop.bags} bag{stop.bags !== 1 ? 's' : ''}
                              </p>
                            </div>
                          </div>
                          {isDone
                            ? <StatusBadge variant="green" label="Done" size="sm" />
                            : <StatusBadge variant="cyan"  label="Pending" size="sm" />
                          }
                        </div>
                      </button>

                      {/* Expanded actions */}
                      {isExpanded && !isDone && (
                        <div
                          className="px-4 pb-3"
                          style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
                        >
                          <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-3 mb-3">
                            {[
                              { label: 'Unit Type', value: stop.unit             },
                              { label: 'Bags',      value: String(stop.bags)     },
                              { label: 'ZIP',       value: group.zip             },
                              { label: 'Area',      value: group.area            },
                            ].map(row => (
                              <div key={row.label}>
                                <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>{row.label}</p>
                                <p style={{ fontSize: 12, color: '#fff', fontWeight: 600, marginTop: 1 }}>{row.value}</p>
                              </div>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <PrimaryButton fullWidth size="sm" variant="secondary" onClick={() => showToast('Scanning bag…')}>
                                📦 Scan Bag
                              </PrimaryButton>
                            </div>
                            <div className="flex-1">
                              <PrimaryButton fullWidth size="sm" onClick={() => completeStop(stop.id)}>
                                ✓ Complete
                              </PrimaryButton>
                            </div>
                          </div>
                        </div>
                      )}
                    </GlassCard>
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* ── Warehouse destination ── */}
        <GlassCard variant="elevated" padding="md">
          <div className="flex items-center gap-3">
            <span style={{ fontSize: 24 }}>🏭</span>
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Final Destination
              </p>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginTop: 2 }}>{WAREHOUSE.name}</p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>{WAREHOUSE.address}</p>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-sm font-semibold"
          style={{
            background: 'rgba(0,200,255,0.15)',
            border: '1px solid rgba(0,200,255,0.3)',
            color: '#00c8ff',
            backdropFilter: 'blur(12px)',
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          }}
        >
          {toast}
        </div>
      )}
    </div>
  )
}
