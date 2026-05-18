import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuthStore } from '../../store/authStore'
import type { CommercialInvoice } from '../../types'

const ACCENT = '#00c8ff'

const STATUS_META: Record<CommercialInvoice['status'], { label: string; color: string; bg: string }> = {
  paid:    { label: 'Paid',    color: '#4ade80', bg: 'rgba(74,222,128,0.15)'  },
  pending: { label: 'Pending', color: '#fbbf24', bg: 'rgba(251,191,36,0.15)'  },
  overdue: { label: 'Overdue', color: '#f87171', bg: 'rgba(248,113,113,0.15)' },
}

export default function CommercialInvoicesPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [invoices, setInvoices] = useState<CommercialInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [accountId, setAccountId] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

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
      .from('commercial_invoices')
      .select('*')
      .eq('account_id', accountId)
      .order('due_date', { ascending: false })
      .then(({ data }) => {
        setInvoices((data ?? []) as CommercialInvoice[])
        setLoading(false)
      })
  }, [accountId])

  const totalOwed = invoices
    .filter(inv => inv.status !== 'paid')
    .reduce((sum, inv) => sum + inv.amount, 0)

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}>
      <header className="flex items-center gap-3 px-4 py-3 shrink-0" style={{ background: 'rgba(4,10,24,0.94)', borderBottom: '1px solid rgba(0,200,255,0.12)', backdropFilter: 'blur(12px)' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>← Back</button>
        <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: '#fff', textAlign: 'center' }}>Invoices & Billing</span>
        <span style={{ width: 52 }} />
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5 pb-24 max-w-xl mx-auto w-full">

        {/* Balance summary */}
        <div className="rounded-2xl px-4 py-4 mb-5" style={{ background: 'linear-gradient(135deg,rgba(0,87,231,0.18),rgba(0,200,255,0.12))', border: '1px solid rgba(0,200,255,0.25)' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.09em' }}>Outstanding Balance</p>
          <p style={{ fontSize: 32, fontWeight: 900, color: totalOwed > 0 ? '#f87171' : '#4ade80', marginTop: 6, lineHeight: 1 }}>
            ${totalOwed.toFixed(2)}
          </p>
          {totalOwed > 0 && (
            <button
              className="mt-3 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:brightness-110"
              style={{ background: 'linear-gradient(135deg,#0057e7,#00c8ff)', color: '#fff' }}
            >
              Pay All Outstanding
            </button>
          )}
        </div>

        {/* Status summary chips */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {(Object.entries(STATUS_META) as [CommercialInvoice['status'], typeof STATUS_META[CommercialInvoice['status']]][]).map(([status, meta]) => {
            const count = invoices.filter(inv => inv.status === status).length
            return (
              <div key={status} className="shrink-0 px-3 py-1.5 rounded-full flex items-center gap-1.5" style={{ background: meta.bg, border: `1px solid ${meta.color}33` }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: meta.color }}>{count} {meta.label}</span>
              </div>
            )
          })}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-7 h-7 rounded-full border-4 animate-spin" style={{ borderColor: 'rgba(0,200,255,0.2)', borderTopColor: ACCENT }} />
          </div>
        ) : invoices.length === 0 ? (
          <div className="rounded-2xl px-4 py-10 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <p style={{ fontSize: 28, marginBottom: 10 }}>🧾</p>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>No invoices yet</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 6 }}>Invoices will appear here after your first service.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {invoices.map(inv => {
              const meta = STATUS_META[inv.status]
              const isExpanded = selected === inv.id
              const isOverdue = inv.status === 'overdue'
              return (
                <button
                  key={inv.id}
                  onClick={() => setSelected(isExpanded ? null : inv.id)}
                  className="rounded-2xl px-4 py-4 text-left transition-all w-full"
                  style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${isOverdue ? 'rgba(248,113,113,0.3)' : 'rgba(255,255,255,0.09)'}`, cursor: 'pointer' }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>
                        Invoice · {new Date(inv.issued_at).toLocaleDateString()}
                      </p>
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                        Due: {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <p style={{ fontSize: 18, fontWeight: 800, color: inv.status === 'paid' ? '#4ade80' : '#fff' }}>
                        ${inv.amount.toFixed(2)}
                      </p>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        {[
                          { label: 'Status',    value: meta.label },
                          { label: 'Amount',    value: `$${inv.amount.toFixed(2)}` },
                          { label: 'Issued',    value: new Date(inv.issued_at).toLocaleDateString() },
                          { label: 'Due Date',  value: inv.due_date ? new Date(inv.due_date).toLocaleDateString() : 'N/A' },
                        ].map(row => (
                          <div key={row.label}>
                            <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>{row.label}</p>
                            <p style={{ fontSize: 12, color: '#fff', fontWeight: 600, marginTop: 2 }}>{row.value}</p>
                          </div>
                        ))}
                      </div>
                      {inv.status !== 'paid' && (
                        <button
                          onClick={e => e.stopPropagation()}
                          className="w-full py-2.5 rounded-xl text-xs font-bold transition-all hover:brightness-110"
                          style={{ background: 'linear-gradient(135deg,#0057e7,#00c8ff)', color: '#fff' }}
                        >
                          Pay ${inv.amount.toFixed(2)}
                        </button>
                      )}
                      <button
                        onClick={e => e.stopPropagation()}
                        className="mt-2 w-full py-2.5 rounded-xl text-xs font-bold transition-all hover:brightness-110"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)' }}
                      >
                        ⬇ Download PDF
                      </button>
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
