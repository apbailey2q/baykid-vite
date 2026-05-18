import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuthStore } from '../../store/authStore'
import type { CommercialPickup } from '../../types'

const ACCENT = '#00c8ff'

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  requested:  { label: 'Requested',  color: ACCENT,    bg: 'rgba(0,200,255,0.12)'   },
  scheduled:  { label: 'Scheduled',  color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  in_progress:{ label: 'In Progress',color: '#fbbf24', bg: 'rgba(251,191,36,0.12)'  },
  completed:  { label: 'Completed',  color: '#4ade80', bg: 'rgba(74,222,128,0.12)'  },
  cancelled:  { label: 'Cancelled',  color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
}

const ALL_FILTER = 'all'

export default function CommercialHistoryPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [pickups, setPickups] = useState<CommercialPickup[]>([])
  const [loading, setLoading] = useState(true)
  const [accountId, setAccountId] = useState<string | null>(null)
  const [filter, setFilter] = useState(ALL_FILTER)

  useEffect(() => {
    if (!user?.id) return
    supabase
      .from('commercial_accounts')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => { if (data?.id) setAccountId(data.id) })
  }, [user?.id])

  useEffect(() => {
    if (!accountId) return
    setLoading(true)
    supabase
      .from('commercial_pickups')
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setPickups((data ?? []) as CommercialPickup[])
        setLoading(false)
      })
  }, [accountId])

  const filtered = filter === ALL_FILTER ? pickups : pickups.filter(p => p.status === filter)
  const completedCount = pickups.filter(p => p.status === 'completed').length

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}>
      <header className="flex items-center gap-3 px-4 py-3 shrink-0" style={{ background: 'rgba(4,10,24,0.94)', borderBottom: '1px solid rgba(0,200,255,0.12)', backdropFilter: 'blur(12px)' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>← Back</button>
        <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: '#fff', textAlign: 'center' }}>Pickup History</span>
        <span style={{ width: 52 }} />
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5 pb-24 max-w-xl mx-auto w-full">

        {/* Summary row */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          {[
            { label: 'Total',     value: pickups.length,  color: ACCENT     },
            { label: 'Completed', value: completedCount,  color: '#4ade80'  },
            { label: 'Active',    value: pickups.filter(p => ['requested','scheduled','in_progress'].includes(p.status)).length, color: '#fbbf24' },
          ].map(s => (
            <div key={s.label} className="rounded-2xl px-3 py-3 text-center" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}>
              <p style={{ fontSize: 22, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</p>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Status filter */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {[{ value: ALL_FILTER, label: 'All' }, ...Object.entries(STATUS_META).map(([v, m]) => ({ value: v, label: m.label }))].map(opt => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className="shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all"
              style={{
                background: filter === opt.value ? ACCENT : 'rgba(255,255,255,0.07)',
                color: filter === opt.value ? '#000' : 'rgba(255,255,255,0.5)',
                border: filter === opt.value ? 'none' : '1px solid rgba(255,255,255,0.1)',
                cursor: 'pointer',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-7 h-7 rounded-full border-4 animate-spin" style={{ borderColor: 'rgba(0,200,255,0.2)', borderTopColor: ACCENT }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl px-4 py-10 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <p style={{ fontSize: 28, marginBottom: 10 }}>🚛</p>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>No pickups found</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 6 }}>
              {filter === ALL_FILTER ? 'Request your first commercial pickup to get started.' : `No ${STATUS_META[filter]?.label.toLowerCase()} pickups.`}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map(p => {
              const meta = STATUS_META[p.status] ?? STATUS_META.requested
              return (
                <div
                  key={p.id}
                  className="rounded-2xl px-4 py-4"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 mr-3">
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{p.pickup_type}</p>
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{p.material_type}</p>
                    </div>
                    <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    {p.estimated_volume && (
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>📦 {p.estimated_volume}</span>
                    )}
                    {p.preferred_window && (
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>🕐 {p.preferred_window}</span>
                    )}
                  </div>
                  {p.created_at && (
                    <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 6 }}>
                      Submitted {new Date(p.created_at).toLocaleDateString()}
                    </p>
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
