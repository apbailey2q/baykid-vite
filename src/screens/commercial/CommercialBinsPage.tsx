import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuthStore } from '../../store/authStore'
import type { CommercialBin, CommercialBinType } from '../../types'

const ACCENT = '#00c8ff'

const BIN_TYPE_META: Record<CommercialBinType, { icon: string; label: string; color: string }> = {
  qr_bin:       { icon: '🗑️',  label: 'QR Bin',       color: ACCENT   },
  qr_dumpster:  { icon: '🚚',  label: 'QR Dumpster',  color: '#a78bfa' },
  qr_compactor: { icon: '⚙️',  label: 'QR Compactor', color: '#fbbf24' },
  qr_pallet:    { icon: '📦',  label: 'QR Pallet',    color: '#4ade80' },
}

const FILL_COLOR = (pct: number) => pct >= 90 ? '#f87171' : pct >= 70 ? '#fbbf24' : '#4ade80'

export default function CommercialBinsPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [bins, setBins]         = useState<CommercialBin[]>([])
  const [loading, setLoading]   = useState(true)
  const [accountId, setAccountId] = useState<string | null>(null)
  const [selected, setSelected] = useState<CommercialBin | null>(null)

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
      .from('commercial_bins')
      .select('*')
      .eq('account_id', accountId)
      .then(({ data }) => {
        setBins((data ?? []) as CommercialBin[])
        setLoading(false)
      })
  }, [accountId])

  const flagged = bins.filter(b => b.contamination_status === 'flagged').length

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}>
      <header className="flex items-center gap-3 px-4 py-3 shrink-0" style={{ background: 'rgba(4,10,24,0.94)', borderBottom: '1px solid rgba(0,200,255,0.12)', backdropFilter: 'blur(12px)' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>← Back</button>
        <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: '#fff', textAlign: 'center' }}>Bins & Containers</span>
        <span style={{ width: 52 }} />
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5 pb-24 max-w-xl mx-auto w-full">

        {/* Summary row */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          {[
            { label: 'Total Bins',   value: bins.length,  color: ACCENT    },
            { label: 'Near Full',    value: bins.filter(b => b.fill_estimate >= 70).length, color: '#fbbf24' },
            { label: 'Flagged',      value: flagged,       color: flagged > 0 ? '#f87171' : '#4ade80' },
          ].map(s => (
            <div key={s.label} className="rounded-2xl px-3 py-3 text-center" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}>
              <p style={{ fontSize: 22, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</p>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</p>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-7 h-7 rounded-full border-4 animate-spin" style={{ borderColor: 'rgba(0,200,255,0.2)', borderTopColor: ACCENT }} />
          </div>
        ) : bins.length === 0 ? (
          <div className="rounded-2xl px-4 py-10 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <p style={{ fontSize: 28, marginBottom: 10 }}>🗑️</p>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>No containers registered</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 6 }}>Contact dispatch to register your containers.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {bins.map((b) => {
              const meta = BIN_TYPE_META[b.bin_type as CommercialBinType] ?? BIN_TYPE_META.qr_bin
              const fillColor = FILL_COLOR(b.fill_estimate)
              return (
                <button
                  key={b.id}
                  onClick={() => setSelected(selected?.id === b.id ? null : b)}
                  className="rounded-2xl px-4 py-4 text-left transition-all hover:brightness-110 w-full"
                  style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${b.contamination_status === 'flagged' ? 'rgba(251,191,36,0.35)' : 'rgba(255,255,255,0.09)'}`, cursor: 'pointer' }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: 'rgba(255,255,255,0.07)' }}>
                        {meta.icon}
                      </div>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{b.bin_code}</p>
                        <p style={{ fontSize: 11, color: meta.color, fontWeight: 600 }}>{meta.label}</p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{
                      background: b.contamination_status === 'flagged' ? 'rgba(251,191,36,0.15)' : b.contamination_status === 'rejected' ? 'rgba(248,113,113,0.15)' : 'rgba(74,222,128,0.15)',
                      color:      b.contamination_status === 'flagged' ? '#fbbf24'               : b.contamination_status === 'rejected' ? '#f87171'               : '#4ade80',
                    }}>
                      {b.contamination_status.charAt(0).toUpperCase() + b.contamination_status.slice(1)}
                    </span>
                  </div>

                  {/* Fill bar */}
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                      <div style={{ width: `${b.fill_estimate}%`, height: '100%', background: fillColor, borderRadius: 999 }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: fillColor, minWidth: 36 }}>{b.fill_estimate}%</span>
                  </div>
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>📍 {b.location_label}</p>

                  {/* Expanded detail */}
                  {selected?.id === b.id && (
                    <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                      <div className="grid grid-cols-2 gap-2 text-left">
                        {[
                          { label: 'Material',     value: b.material_type },
                          { label: 'Last Pickup',  value: b.last_pickup ? new Date(b.last_pickup).toLocaleDateString() : 'Never' },
                          { label: 'Bin Type',     value: meta.label },
                          { label: 'Fill Level',   value: `${b.fill_estimate}%` },
                        ].map(row => (
                          <div key={row.label}>
                            <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>{row.label}</p>
                            <p style={{ fontSize: 12, color: '#fff', fontWeight: 600, marginTop: 2 }}>{row.value}</p>
                          </div>
                        ))}
                      </div>
                      {b.fill_estimate >= 70 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate('/dashboard/commercial/pickup') }}
                          className="mt-3 w-full py-2.5 rounded-xl text-xs font-bold transition-all hover:brightness-110"
                          style={{ background: 'rgba(0,200,255,0.1)', border: '1px solid rgba(0,200,255,0.3)', color: ACCENT }}
                        >
                          Request Pickup for this Bin
                        </button>
                      )}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
