import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { GlassCard } from '../../components/ui/GlassCard'
import { PrimaryButton } from '../../components/ui/PrimaryButton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'

// ── Types ─────────────────────────────────────────────────────────────────────

type Stage = 'received' | 'inspected' | 'sorted' | 'processed' | 'stored' | 'outbound'
type ContamStatus = 'clean' | 'flagged' | 'rejected'

const STAGES: { key: Stage; label: string }[] = [
  { key: 'received',  label: 'Received'         },
  { key: 'inspected', label: 'Inspected'         },
  { key: 'sorted',    label: 'Sorted'            },
  { key: 'processed', label: 'Processed'         },
  { key: 'stored',    label: 'Baled / Stored'    },
  { key: 'outbound',  label: 'Outbound Shipment' },
]

const STAGE_ORDER: Stage[] = ['received', 'inspected', 'sorted', 'processed', 'stored', 'outbound']

function nextStage(s: Stage): Stage | null {
  const i = STAGE_ORDER.indexOf(s)
  return i >= 0 && i < STAGE_ORDER.length - 1 ? STAGE_ORDER[i + 1] : null
}

interface BatchRow {
  id: string
  commercial_pickup_id: string | null
  commercial_account_id: string | null
  warehouse_id: string | null
  material_type: string
  actual_weight: number | null
  contamination_status: ContamStatus
  processing_line: string | null
  status: Stage
  business_name: string
  created_at: string
}

// Raw Supabase shape
interface RawBatch {
  id: string
  commercial_pickup_id: string | null
  commercial_account_id: string | null
  warehouse_id: string | null
  material_type: string
  actual_weight: number | null
  contamination_status: string
  processing_line: string | null
  status: string
  created_at: string
  commercial_accounts: { business_name: string } | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STAGE_BADGE: Record<Stage, { variant: 'cyan' | 'green' | 'amber' | 'yellow' | 'blue' | 'gray'; label: string }> = {
  received:  { variant: 'cyan',   label: 'Received'    },
  inspected: { variant: 'yellow', label: 'Inspection'  },
  sorted:    { variant: 'blue',   label: 'Sorting'     },
  processed: { variant: 'amber',  label: 'Processed'   },
  stored:    { variant: 'green',  label: 'Baled'       },
  outbound:  { variant: 'green',  label: 'Outbound'    },
}

const CONTAM_COLOR: Record<ContamStatus, string> = {
  clean:    '#4ade80',
  flagged:  '#fbbf24',
  rejected: '#f87171',
}

const CONTAM_LABEL: Record<ContamStatus, string> = {
  clean:    'Clean',
  flagged:  'Minor — Flagged',
  rejected: 'Rejected',
}

// ── Helper ────────────────────────────────────────────────────────────────────

function flattenBatch(raw: RawBatch): BatchRow {
  return {
    id:                    raw.id,
    commercial_pickup_id:  raw.commercial_pickup_id,
    commercial_account_id: raw.commercial_account_id,
    warehouse_id:          raw.warehouse_id,
    material_type:        raw.material_type,
    actual_weight:        raw.actual_weight,
    contamination_status: (raw.contamination_status as ContamStatus) ?? 'clean',
    processing_line:      raw.processing_line,
    status:               (raw.status as Stage) ?? 'received',
    business_name:        raw.commercial_accounts?.business_name ?? 'Unknown Business',
    created_at:           raw.created_at,
  }
}

function shortId(id: string): string {
  return `BATCH-${id.slice(0, 8).toUpperCase()}`
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function CommercialProcessing() {
  const navigate = useNavigate()

  const [pageState, setPageState]   = useState<'loading' | 'error' | 'ready'>('loading')
  const [batches, setBatches]       = useState<BatchRow[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [working, setWorking]       = useState<string | null>(null)
  const [toast, setToast]           = useState<string | null>(null)

  // ── Load ─────────────────────────────────────────────────────────────────

  const loadBatches = useCallback(async () => {
    setPageState('loading')
    const { data, error } = await supabase
      .from('material_batches')
      .select(`
        id, commercial_pickup_id, commercial_account_id, warehouse_id, material_type, actual_weight,
        contamination_status, processing_line, status, created_at,
        commercial_accounts ( business_name )
      `)
      .order('created_at', { ascending: false })

    if (error) { setPageState('error'); return }
    setBatches((data ?? []).map(r => flattenBatch(r as unknown as RawBatch)))
    setPageState('ready')
  }, [])

  useEffect(() => { loadBatches() }, [loadBatches])

  // ── Toast ─────────────────────────────────────────────────────────────────

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  // ── Inventory upsert (best-effort) ────────────────────────────────────────

  async function upsertInventory(warehouseId: string, materialType: string, addWeight: number): Promise<void> {
    try {
      const { data: existing } = await supabase
        .from('warehouse_inventory')
        .select('id, total_weight')
        .eq('warehouse_id', warehouseId)
        .eq('material_type', materialType)
        .maybeSingle()

      if (existing) {
        await supabase
          .from('warehouse_inventory')
          .update({
            total_weight: (existing.total_weight as number) + addWeight,
            last_updated: new Date().toISOString(),
          })
          .eq('id', existing.id)
      } else {
        await supabase
          .from('warehouse_inventory')
          .insert({
            warehouse_id:  warehouseId,
            material_type: materialType,
            total_weight:  addWeight,
            last_updated:  new Date().toISOString(),
          })
      }
    } catch (err) {
      console.warn('Inventory update failed:', err)
    }
  }

  // ── Invoice upsert (best-effort) ─────────────────────────────────────────

  async function upsertInvoice(batch: BatchRow): Promise<void> {
    if (!batch.commercial_account_id) return
    try {
      const now          = new Date()
      const billingMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const billingPeriod = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

      let binCount   = 1
      let isOverflow = false
      if (batch.commercial_pickup_id) {
        const { data: pickup } = await supabase
          .from('commercial_pickups')
          .select('bin_count, pickup_type')
          .eq('id', batch.commercial_pickup_id)
          .maybeSingle()
        if (pickup) {
          binCount   = pickup.bin_count ?? 1
          isOverflow = pickup.pickup_type === 'Emergency Overflow'
        }
      }

      const baseService   = 1200
      const pickupFee     = 80
      const overflowFee   = isOverflow ? 320 : 0
      const containerFee  = binCount * 10
      const reportFee     = 140
      const total         = baseService + pickupFee + overflowFee + containerFee + reportFee

      const businessShort  = batch.business_name.replace(/\s+/g, '').slice(0, 8).toUpperCase()
      const monthStr       = billingMonth.replace('-', '')
      const invoiceNumber  = `INV-COMM-${monthStr}-${businessShort}`
      const lastDay        = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      const dueDate        = lastDay.toISOString().split('T')[0]

      const { data: existing } = await supabase
        .from('commercial_invoices')
        .select('id')
        .eq('account_id', batch.commercial_account_id)
        .eq('billing_month', billingMonth)
        .maybeSingle()

      if (existing) {
        await supabase
          .from('commercial_invoices')
          .update({
            amount:         total,
            base_service:   baseService,
            pickup_fee:     pickupFee,
            overflow_fee:   overflowFee,
            container_fee:  containerFee,
            report_fee:     reportFee,
          })
          .eq('id', existing.id)
      } else {
        await supabase.from('commercial_invoices').insert({
          account_id:     batch.commercial_account_id,
          invoice_number: invoiceNumber,
          billing_period: billingPeriod,
          billing_month:  billingMonth,
          amount:         total,
          status:         'pending',
          due_date:       dueDate,
          base_service:   baseService,
          pickup_fee:     pickupFee,
          overflow_fee:   overflowFee,
          container_fee:  containerFee,
          report_fee:     reportFee,
        })
      }

      try {
        await supabase.from('commercial_notifications').insert({
          account_id: batch.commercial_account_id,
          type:       'invoice_ready',
          title:      'Invoice updated',
          body:       'Your commercial recycling invoice has been updated for the current billing period.',
          read:       false,
        })
      } catch { /* best-effort */ }
    } catch (err) {
      console.warn('Invoice upsert failed:', err)
    }
  }

  // ── Move to next stage ────────────────────────────────────────────────────

  async function moveToNextStage(batch: BatchRow) {
    const next = nextStage(batch.status)
    if (!next) return

    setWorking(batch.id)
    try {
      const { error } = await supabase
        .from('material_batches')
        .update({ status: next, updated_at: new Date().toISOString() })
        .eq('id', batch.id)
      if (error) throw error

      setBatches(prev => prev.map(b => b.id === batch.id ? { ...b, status: next } : b))

      // Inventory update when batch reaches stored
      if (next === 'stored' && batch.warehouse_id && batch.actual_weight) {
        await upsertInventory(batch.warehouse_id, batch.material_type, batch.actual_weight)
      }

      // Invoice generation at processed or stored
      if (next === 'processed' || next === 'stored') {
        await upsertInvoice(batch)
      }

      showToast(`Advanced to ${STAGES.find(s => s.key === next)?.label ?? next} ✓`)
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setWorking(null)
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const totalWeight    = batches.reduce((sum, b) => sum + (b.actual_weight ?? 0), 0)
  const flaggedCount   = batches.filter(b => b.contamination_status !== 'clean').length
  const activeCount    = batches.filter(b => b.status !== 'outbound').length

  // ── Loading / Error ───────────────────────────────────────────────────────

  if (pageState === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}>
        <Spinner size="lg" />
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Loading batches…</p>
      </div>
    )
  }

  if (pageState === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}>
        <GlassCard padding="lg" className="w-full max-w-sm text-center">
          <p style={{ fontSize: 28, marginBottom: 12 }}>⚠️</p>
          <p style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Failed to load batches</p>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 20 }}>Check your connection and try again.</p>
          <PrimaryButton fullWidth onClick={loadBatches}>Retry</PrimaryButton>
        </GlassCard>
      </div>
    )
  }

  // ── Ready ─────────────────────────────────────────────────────────────────

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
          Commercial Processing
        </span>
        <div style={{ width: 46 }} />
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5 pb-24 max-w-xl mx-auto w-full">

        {/* ── Quick nav ── */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => navigate('/dashboard/warehouse/commercial-expected-loads')}
            className="flex-1 rounded-xl py-2.5 text-xs font-bold transition-all hover:brightness-110"
            style={{ background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.2)', color: '#00c8ff', cursor: 'pointer' }}
          >
            🚛 Expected Loads
          </button>
          <button
            onClick={() => navigate('/dashboard/warehouse/commercial-intake')}
            className="flex-1 rounded-xl py-2.5 text-xs font-bold transition-all hover:brightness-110"
            style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', color: '#fbbf24', cursor: 'pointer' }}
          >
            📥 Intake
          </button>
        </div>

        {/* ── Summary stats ── */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          {[
            { label: 'Batches',      value: batches.length,                          color: '#00c8ff' },
            { label: 'Total Weight', value: `${Math.round(totalWeight).toLocaleString()} lbs`, color: '#fff' },
            { label: 'Flagged',      value: flaggedCount,                             color: flaggedCount > 0 ? '#f87171' : '#4ade80' },
          ].map(s => (
            <GlassCard key={s.label} padding="md" className="text-center">
              <p style={{ fontSize: 16, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</p>
              <p style={{ fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 4 }}>
                {s.label}
              </p>
            </GlassCard>
          ))}
        </div>

        {/* ── Stage pipeline ── */}
        <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
          Stage Pipeline
        </p>
        <div className="rounded-2xl px-4 py-4 mb-5 overflow-x-auto" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-1 min-w-max">
            {STAGES.map((s, i) => {
              const count  = batches.filter(b => b.status === s.key).length
              const active = count > 0
              return (
                <div key={s.key} className="flex items-center gap-1">
                  <div className="flex flex-col items-center" style={{ minWidth: 56 }}>
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold mb-1"
                      style={{
                        background: active ? 'rgba(0,200,255,0.2)'          : 'rgba(255,255,255,0.05)',
                        border:     active ? '2px solid rgba(0,200,255,0.5)' : '2px solid rgba(255,255,255,0.1)',
                        color:      active ? '#00c8ff' : 'rgba(255,255,255,0.25)',
                        boxShadow:  active ? '0 0 10px rgba(0,200,255,0.25)' : 'none',
                      }}
                    >
                      {active ? count : i + 1}
                    </div>
                    <p style={{ fontSize: 8, fontWeight: 700, color: active ? '#fff' : 'rgba(255,255,255,0.25)', textAlign: 'center', lineHeight: 1.2, maxWidth: 52 }}>
                      {s.label}
                    </p>
                  </div>
                  {i < STAGES.length - 1 && (
                    <div style={{ width: 16, height: 2, background: 'rgba(255,255,255,0.1)', flexShrink: 0 }} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Batch cards ── */}
        <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
          {activeCount > 0 ? 'Active Batches' : 'All Batches'}
        </p>

        {batches.length === 0 ? (
          <EmptyState
            icon="♻️"
            title="No batches in processing"
            description="Batches appear here after warehouse intake is confirmed."
            action={{ label: 'Refresh', onClick: loadBatches }}
          />
        ) : (
          <div className="flex flex-col gap-3">
            {batches.map(batch => {
              const badge      = STAGE_BADGE[batch.status]
              const isOpen     = expandedId === batch.id
              const isDone     = batch.status === 'outbound'
              const isBusy     = working === batch.id
              const contamColor = CONTAM_COLOR[batch.contamination_status]
              const next       = nextStage(batch.status)

              return (
                <div
                  key={batch.id}
                  className="rounded-2xl overflow-hidden"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: `1px solid ${isDone ? 'rgba(74,222,128,0.2)' : 'rgba(255,255,255,0.09)'}`,
                  }}
                >
                  {/* Card header */}
                  <button
                    onClick={() => setExpandedId(isOpen ? null : batch.id)}
                    className="w-full px-4 py-4 text-left"
                    style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0 mr-2">
                        <p style={{ fontSize: 13, fontWeight: 800, color: '#00c8ff', fontFamily: 'monospace' }}>
                          {shortId(batch.id)}
                        </p>
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {batch.business_name}
                        </p>
                      </div>
                      <StatusBadge variant={badge.variant} label={badge.label} size="sm" />
                    </div>

                    <div className="flex gap-3 flex-wrap">
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>
                        ♻️ {batch.material_type}
                      </span>
                      {batch.actual_weight != null && (
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                          ⚖️ {batch.actual_weight.toLocaleString()} lbs
                        </span>
                      )}
                      <span style={{ fontSize: 11, color: contamColor, fontWeight: 700 }}>
                        {CONTAM_LABEL[batch.contamination_status]}
                      </span>
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isOpen && (
                    <div className="px-4 pb-4" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-3 pt-3 mb-4">
                        {[
                          { label: 'Batch ID',      value: shortId(batch.id)                                              },
                          { label: 'Business',      value: batch.business_name                                            },
                          { label: 'Material',      value: batch.material_type                                            },
                          { label: 'Actual Weight', value: batch.actual_weight != null ? `${batch.actual_weight.toLocaleString()} lbs` : '—' },
                          { label: 'Contamination', value: CONTAM_LABEL[batch.contamination_status]                      },
                          { label: 'Line',          value: batch.processing_line ?? '—'                                  },
                          { label: 'Warehouse',     value: batch.warehouse_id ?? '—'                                     },
                          { label: 'Current Stage', value: STAGES.find(s => s.key === batch.status)?.label ?? batch.status },
                          { label: 'Next Stage',    value: next ? (STAGES.find(s => s.key === next)?.label ?? '—') : 'Complete' },
                        ].map(row => (
                          <div key={row.label}>
                            <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                              {row.label}
                            </p>
                            <p style={{ fontSize: 12, color: row.label === 'Contamination' ? contamColor : '#fff', fontWeight: 600, marginTop: 2 }}>
                              {row.value}
                            </p>
                          </div>
                        ))}
                      </div>

                      {/* Contamination indicator */}
                      <div className="rounded-xl px-3 py-2.5 mb-4" style={{
                        background: batch.contamination_status === 'clean'
                          ? 'rgba(74,222,128,0.07)'
                          : batch.contamination_status === 'flagged'
                            ? 'rgba(251,191,36,0.07)'
                            : 'rgba(248,113,113,0.07)',
                        border: `1px solid ${contamColor}33`,
                      }}>
                        <div className="flex items-center justify-between">
                          <p style={{ fontSize: 11, fontWeight: 700, color: contamColor }}>
                            Contamination: {CONTAM_LABEL[batch.contamination_status]}
                          </p>
                          <div
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ background: contamColor, boxShadow: `0 0 6px ${contamColor}` }}
                          />
                        </div>
                      </div>

                      {/* Inventory note when approaching stored */}
                      {next === 'stored' && (
                        <div className="rounded-xl px-3 py-2.5 mb-3" style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)' }}>
                          <p style={{ fontSize: 11, color: '#4ade80', fontWeight: 600 }}>
                            📦 Advancing to Stored will update warehouse inventory
                          </p>
                        </div>
                      )}

                      {/* Actions */}
                      {!isDone ? (
                        <div className="flex flex-col gap-2">
                          {next && (
                            <PrimaryButton fullWidth size="md" disabled={isBusy} onClick={() => moveToNextStage(batch)}>
                              {isBusy ? 'Updating…' : `➡️ Move to ${STAGES.find(s => s.key === next)?.label ?? 'Next Stage'}`}
                            </PrimaryButton>
                          )}
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <PrimaryButton fullWidth size="sm" variant="secondary" disabled={isBusy} onClick={() => showToast('Issue flagged to supervisor')}>
                                ⚠️ Flag Issue
                              </PrimaryButton>
                            </div>
                            <div className="flex-1">
                              <PrimaryButton fullWidth size="sm" variant="secondary" disabled={isBusy} onClick={() => showToast(`${shortId(batch.id)} assigned to ${batch.processing_line ?? 'line'}`)}>
                                🔧 Assign Line
                              </PrimaryButton>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-xl px-3 py-2.5 text-center" style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)' }}>
                          <p style={{ fontSize: 12, color: '#4ade80', fontWeight: 700 }}>✓ Outbound — Processing Complete</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-sm font-semibold"
          style={{
            background: 'rgba(0,200,255,0.15)', border: '1px solid rgba(0,200,255,0.3)',
            color: '#00c8ff', backdropFilter: 'blur(12px)',
            whiteSpace: 'nowrap', maxWidth: 'calc(100vw - 32px)', boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          }}
        >
          {toast}
        </div>
      )}
    </div>
  )
}
