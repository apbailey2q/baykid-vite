import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'

const ACCENT = '#00c8ff'

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  requested:   { label: 'Pending',     color: '#fbbf24', bg: 'rgba(251,191,36,0.15)'  },
  scheduled:   { label: 'Scheduled',   color: ACCENT,    bg: 'rgba(0,200,255,0.12)'   },
  in_progress: { label: 'In Progress', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  completed:   { label: 'Completed',   color: '#4ade80', bg: 'rgba(74,222,128,0.12)'  },
  cancelled:   { label: 'Cancelled',   color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
}

type Stop = {
  id: string
  business_name: string
  pickup_location: string
  pickup_type: string
  material_type: string
  estimated_volume: string
  preferred_window: string
  status: string
  bin_count: number
  contact_person: string
  safety_notes?: string
  loading_dock_notes?: string
  gate_notes?: string
  created_at: string
}

export default function CommercialRoutesPage() {
  const navigate = useNavigate()
  const [stops, setStops] = useState<Stop[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [completing, setCompleting] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    supabase
      .from('commercial_pickups')
      .select('*')
      .in('status', ['requested', 'scheduled', 'in_progress'])
      .order('preferred_window', { ascending: true })
      .then(({ data }) => {
        setStops((data ?? []) as Stop[])
        setLoading(false)
      })
  }, [])

  async function markInProgress(id: string) {
    await supabase.from('commercial_pickups').update({ status: 'in_progress' }).eq('id', id)
    setStops(prev => prev.map(s => s.id === id ? { ...s, status: 'in_progress' } : s))
  }

  async function markCompleted(id: string) {
    setCompleting(id)
    await supabase.from('commercial_pickups').update({ status: 'completed' }).eq('id', id)
    setStops(prev => prev.filter(s => s.id !== id))
    setCompleting(null)
    setSelected(null)
  }

  const activeCount = stops.filter(s => s.status === 'in_progress').length

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}>
      <header className="flex items-center gap-3 px-4 py-3 shrink-0" style={{ background: 'rgba(4,10,24,0.94)', borderBottom: '1px solid rgba(0,200,255,0.12)', backdropFilter: 'blur(12px)' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>← Back</button>
        <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: '#fff', textAlign: 'center' }}>Commercial Routes</span>
        <span style={{ width: 52 }} />
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5 pb-24 max-w-xl mx-auto w-full">

        {/* Shift summary */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          {[
            { label: 'Stops Today', value: stops.length,  color: ACCENT    },
            { label: 'In Progress', value: activeCount,   color: '#a78bfa' },
            { label: 'Pending',     value: stops.filter(s => s.status !== 'in_progress').length, color: '#fbbf24' },
          ].map(s => (
            <div key={s.label} className="rounded-2xl px-3 py-3 text-center" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}>
              <p style={{ fontSize: 22, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</p>
              <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</p>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-7 h-7 rounded-full border-4 animate-spin" style={{ borderColor: 'rgba(0,200,255,0.2)', borderTopColor: ACCENT }} />
          </div>
        ) : stops.length === 0 ? (
          <div className="rounded-2xl px-4 py-10 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <p style={{ fontSize: 28, marginBottom: 10 }}>✅</p>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>All stops complete</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 6 }}>No pending commercial pickups on your route.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {stops.map((stop, idx) => {
              const meta = STATUS_META[stop.status] ?? STATUS_META.requested
              const isExpanded = selected === stop.id
              return (
                <div
                  key={stop.id}
                  className="rounded-2xl overflow-hidden"
                  style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${stop.status === 'in_progress' ? 'rgba(167,139,250,0.3)' : 'rgba(255,255,255,0.09)'}` }}
                >
                  {/* Stop header */}
                  <button
                    onClick={() => setSelected(isExpanded ? null : stop.id)}
                    className="w-full px-4 py-4 text-left"
                    style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3 flex-1 mr-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shrink-0" style={{ background: 'rgba(0,200,255,0.15)', color: ACCENT }}>
                          {idx + 1}
                        </div>
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{stop.business_name}</p>
                          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 1 }}>📍 {stop.pickup_location}</p>
                        </div>
                      </div>
                      <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
                    </div>
                    <div className="flex gap-3 mt-2 ml-11">
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>🚛 {stop.pickup_type}</span>
                      {stop.preferred_window && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>🕐 {stop.preferred_window}</span>}
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        {[
                          { label: 'Material',  value: stop.material_type },
                          { label: 'Volume',    value: stop.estimated_volume || '—' },
                          { label: 'Bins',      value: String(stop.bin_count) },
                          { label: 'Contact',   value: stop.contact_person },
                        ].map(row => (
                          <div key={row.label}>
                            <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>{row.label}</p>
                            <p style={{ fontSize: 12, color: '#fff', fontWeight: 600, marginTop: 2 }}>{row.value}</p>
                          </div>
                        ))}
                      </div>

                      {(stop.loading_dock_notes || stop.gate_notes || stop.safety_notes) && (
                        <div className="rounded-xl px-3 py-3 mb-3" style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)' }}>
                          {stop.loading_dock_notes && <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>🏗 {stop.loading_dock_notes}</p>}
                          {stop.gate_notes && <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>🔐 {stop.gate_notes}</p>}
                          {stop.safety_notes && <p style={{ fontSize: 11, color: '#fbbf24', fontWeight: 600 }}>⚠️ {stop.safety_notes}</p>}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button
                          onClick={() => navigate(`/dashboard/driver/commercial-stop/${stop.id}`)}
                          className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all hover:brightness-110"
                          style={{ background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.2)', color: ACCENT }}
                        >
                          📋 Details
                        </button>
                        <button
                          onClick={() => navigate('/dashboard/driver/commercial-safety')}
                          className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all hover:brightness-110"
                          style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24' }}
                        >
                          🦺 Safety
                        </button>
                        {stop.status === 'scheduled' || stop.status === 'requested' ? (
                          <button
                            onClick={() => markInProgress(stop.id)}
                            className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all hover:brightness-110"
                            style={{ background: 'rgba(0,200,255,0.1)', border: '1px solid rgba(0,200,255,0.3)', color: ACCENT }}
                          >
                            ▶ Start Stop
                          </button>
                        ) : (
                          <button
                            onClick={() => markCompleted(stop.id)}
                            disabled={completing === stop.id}
                            className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all hover:brightness-110 disabled:opacity-60"
                            style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80' }}
                          >
                            {completing === stop.id ? '…' : '✓ Complete'}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
