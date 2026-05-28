import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { GlassCard } from '../../components/ui/GlassCard'
import { PrimaryButton } from '../../components/ui/PrimaryButton'
import { StatusBadge } from '../../components/ui/StatusBadge'

// ── Types ─────────────────────────────────────────────────────────────────────

interface StopDetails {
  name:       string
  address:    string
  dock:       string | null
  gate:       string | null
  window:     string | null
  materials:  string | null
  bins:       number | null
  weight:     number | null
  contact:    string | null
  phone:      string | null
  safety:     string | null
  warehouse:  string | null
}

const TRUCK_MAX = 5000
type StopStatus = 'pending' | 'arrived' | 'complete'
type GateStatus = 'loading' | 'clear' | 'pending_review' | 'blocked' | 'no_inspection' | 'reinspection_required'

// ── Screen ────────────────────────────────────────────────────────────────────

export default function CommercialStopDetail() {
  const navigate = useNavigate()
  const { stopId } = useParams<{ stopId: string }>()

  const [stopDetails,    setStopDetails]    = useState<StopDetails | null>(null)
  const [stopLoading,    setStopLoading]    = useState(true)
  const [status,         setStatus]         = useState<StopStatus>('pending')
  const [toast,          setToast]          = useState<string | null>(null)
  const [gateStatus,     setGateStatus]     = useState<GateStatus>('loading')
  const [pickupIdForNav, setPickupIdForNav] = useState<string | null>(null)
  const [adminNotes,     setAdminNotes]     = useState<string | null>(null)

  useEffect(() => {
    if (!stopId) { setStopLoading(false); return }

    async function loadStop() {
      try {
        // Fetch the route stop row; try to join pickup + account data
        const { data: routeStop } = await supabase
          .from('commercial_route_stops')
          .select('*')
          .eq('id', stopId)
          .maybeSingle()

        if (!routeStop) { setStopLoading(false); return }

        setPickupIdForNav(routeStop.pickup_id ?? null)

        // Try to resolve business details from the linked pickup / account
        let pickupRow: Record<string, unknown> | null = null
        if (routeStop.pickup_id) {
          const { data } = await supabase
            .from('commercial_pickups')
            .select('*, commercial_accounts(business_name, contact_name, phone, warehouse_id)')
            .eq('id', routeStop.pickup_id)
            .maybeSingle()
          pickupRow = data as Record<string, unknown> | null
        }

        const account = (pickupRow?.commercial_accounts ?? {}) as Record<string, unknown>

        setStopDetails({
          name:      (account.business_name  as string) ?? (pickupRow?.business_name as string) ?? 'Commercial Stop',
          address:   (routeStop.address      as string) ?? (pickupRow?.address       as string) ?? 'Address unavailable',
          dock:      (routeStop.dock_instructions as string | null) ?? (pickupRow?.dock_instructions as string | null) ?? null,
          gate:      (routeStop.gate_code    as string | null) ?? (pickupRow?.gate_code    as string | null) ?? null,
          window:    (routeStop.pickup_window as string | null) ?? (pickupRow?.pickup_window as string | null) ?? null,
          materials: (routeStop.materials    as string | null) ?? (pickupRow?.materials    as string | null) ?? null,
          bins:      (routeStop.bin_count    as number | null) ?? (pickupRow?.bin_count    as number | null) ?? null,
          weight:    (routeStop.estimated_weight as number | null) ?? (pickupRow?.estimated_weight as number | null) ?? null,
          contact:   (account.contact_name   as string | null) ?? null,
          phone:     (account.phone          as string | null) ?? null,
          safety:    (routeStop.safety_notes as string | null) ?? (pickupRow?.safety_notes as string | null) ?? null,
          warehouse: (account.warehouse_id   as string | null) ?? (pickupRow?.warehouse    as string | null) ?? null,
        })

        // ── Inspection gate check ──────────────────────────────────────────
        if (!routeStop.pickup_id) { setGateStatus('no_inspection'); setStopLoading(false); return }

        const { data: insp } = await supabase
          .from('commercial_inspections')
          .select('overall_result, review_status, admin_notes')
          .eq('pickup_id', routeStop.pickup_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (!insp) { setGateStatus('no_inspection'); setStopLoading(false); return }

        const { overall_result, review_status } = insp
        const isPending = review_status === null || review_status === 'pending'

        if (overall_result === 'pass') {
          setGateStatus('clear')
        } else if (overall_result === 'flag' && review_status === 'approved') {
          setGateStatus('clear')
        } else if (review_status === 'reinspection_required') {
          setGateStatus('reinspection_required')
          if (insp.admin_notes) setAdminNotes(insp.admin_notes)
        } else if (overall_result === 'flag' && isPending) {
          setGateStatus('pending_review')
        } else {
          setGateStatus('blocked')
        }
      } catch {
        /* silent — empty state below handles it */
      } finally {
        setStopLoading(false)
      }
    }

    void loadStop()
  }, [stopId])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  const truckImpactPct = stopDetails?.weight != null
    ? Math.round((stopDetails.weight / TRUCK_MAX) * 100)
    : null

  const STATUS_BADGE: Record<StopStatus, { variant: 'cyan' | 'amber' | 'green'; label: string }> = {
    pending:  { variant: 'cyan',  label: 'Pending'     },
    arrived:  { variant: 'amber', label: 'At Location' },
    complete: { variant: 'green', label: 'Completed'   },
  }
  const badge = STATUS_BADGE[status]

  // ── Loading ────────────────────────────────────────────────────────────────

  if (stopLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)' }}>Loading stop…</p>
      </div>
    )
  }

  // ── Not found ──────────────────────────────────────────────────────────────

  if (!stopDetails) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 gap-4" style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}>
        <p style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>Stop not found</p>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>
          This stop could not be loaded. It may have been removed or you may not have access.
        </p>
        <button
          onClick={() => navigate(-1)}
          className="rounded-2xl px-6 py-3 text-sm font-bold text-white"
          style={{ background: 'linear-gradient(135deg,#0057e7,#00c8ff)' }}
        >
          ← Go Back
        </button>
      </div>
    )
  }

  const stop = stopDetails

  // ── Success state ──────────────────────────────────────────────────────────

  if (status === 'complete') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}>
        <div
          className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl mb-5"
          style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)' }}
        >
          ✅
        </div>
        <p style={{ fontSize: 20, fontWeight: 900, color: '#fff', marginBottom: 6 }}>Stop Completed</p>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: 24, maxWidth: 260 }}>
          {stop.name} pickup recorded. Return to route for next stop.
        </p>
        <StatusBadge variant="green" label="Completed" dot />
        <button
          onClick={() => navigate(-1)}
          className="mt-6 px-8 py-3.5 rounded-2xl font-bold text-sm text-white transition-all hover:brightness-110"
          style={{ background: 'linear-gradient(135deg,#0057e7,#00c8ff)', boxShadow: '0 4px 20px rgba(0,190,255,0.3)' }}
        >
          ← Return to Route
        </button>
      </div>
    )
  }

  // ── Main detail view ───────────────────────────────────────────────────────

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
          Stop Detail
        </span>
        <button
          onClick={() => showToast('Emergency dispatch contacted')}
          className="rounded-xl px-2.5 py-1.5 text-xs font-bold transition-all hover:brightness-110"
          style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.35)', color: '#f87171', cursor: 'pointer' }}
        >
          🚨 SOS
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5 pb-28 max-w-xl mx-auto w-full">

        {/* ── Business header card ── */}
        <GlassCard variant="accent" padding="lg" glow className="mb-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0 mr-3">
              <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 3 }}>
                Commercial Stop
              </p>
              <p style={{ fontSize: 18, fontWeight: 900, color: '#fff', lineHeight: 1.2 }}>
                {stop.name}
              </p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
                📍 {stop.address}
              </p>
            </div>
            <StatusBadge variant={badge.variant} label={badge.label} dot />
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {stop.window && <span style={{ fontSize: 11, color: '#00c8ff', fontWeight: 600 }}>🕐 {stop.window}</span>}
            {stop.window && stop.warehouse && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>·</span>}
            {stop.warehouse && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>🏭 {stop.warehouse}</span>}
          </div>
        </GlassCard>

        {/* ── Pickup Details ── */}
        <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
          Pickup Details
        </p>
        <GlassCard padding="md" className="mb-4">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            {[
              { label: 'Materials',    value: stop.materials ?? '—'                                           },
              { label: 'Containers',   value: stop.bins != null ? `${stop.bins} bins` : '—'                  },
              { label: 'Est. Weight',  value: stop.weight != null ? `${stop.weight.toLocaleString()} lbs` : '—' },
              { label: 'Truck Impact', value: truckImpactPct != null ? `${truckImpactPct}% capacity` : '—'   },
              { label: 'Contact',      value: stop.contact ?? '—'                                            },
              { label: 'Phone',        value: stop.phone ?? '—'                                              },
              { label: 'Window',       value: stop.window ?? '—'                                             },
              { label: 'Warehouse',    value: stop.warehouse ?? '—'                                          },
            ].map(row => (
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
        </GlassCard>

        {/* ── Access Instructions ── */}
        {(stop.dock || stop.gate) && (
          <>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
              Access Instructions
            </p>
            <div className="rounded-2xl px-4 py-4 mb-4" style={{ background: 'rgba(0,200,255,0.04)', border: '1px solid rgba(0,200,255,0.18)' }}>
              <div className="flex flex-col gap-3">
                {stop.dock && (
                  <div>
                    <p style={{ fontSize: 9, fontWeight: 700, color: '#00c8ff', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                      Loading Dock
                    </p>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>🏗 {stop.dock}</p>
                  </div>
                )}
                {stop.dock && stop.gate && <div style={{ height: 1, background: 'rgba(0,200,255,0.1)' }} />}
                {stop.gate && (
                  <div>
                    <p style={{ fontSize: 9, fontWeight: 700, color: '#00c8ff', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                      Gate / Access
                    </p>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>🔐 {stop.gate}</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ── Safety Warning ── */}
        {stop.safety && (
          <div className="rounded-2xl px-4 py-4 mb-5" style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.28)' }}>
            <p style={{ fontSize: 9, fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>
              Safety Notes
            </p>
            <p style={{ fontSize: 12, color: '#fbbf24', fontWeight: 600, lineHeight: 1.5 }}>
              ⚠️ {stop.safety}
            </p>
          </div>
        )}

        {/* ── Action Buttons ── */}
        <div className="flex flex-col gap-2.5">

          {status === 'pending' && (
            <PrimaryButton fullWidth size="lg" onClick={() => { setStatus('arrived'); showToast('Arrival logged ✓') }}>
              📍 Mark Arrived
            </PrimaryButton>
          )}

          {status === 'arrived' && (
            <div className="rounded-xl px-3 py-2.5 mb-1" style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)' }}>
              <p style={{ fontSize: 11, color: '#fbbf24', fontWeight: 600, textAlign: 'center' }}>
                ✓ Arrived — complete steps below to finish this stop
              </p>
            </div>
          )}

          {/* ── Reinspection required banner ── */}
          {gateStatus === 'reinspection_required' && (
            <div className="rounded-xl px-4 py-3 mb-1" style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.28)' }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#fbbf24', marginBottom: 4 }}>
                🔄 Reinspection required by admin
              </p>
              {adminNotes && (
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5, marginBottom: 10 }}>
                  "{adminNotes}"
                </p>
              )}
              <div className="flex gap-2 mt-2">
                <div className="flex-1">
                  <button
                    onClick={() => navigate(`/dashboard/driver/commercial-scan?pickup_id=${pickupIdForNav ?? ''}&stop_id=${stopId ?? ''}&reinspection=true`)}
                    className="w-full rounded-xl py-2.5 text-sm font-bold transition-all hover:brightness-110"
                    style={{ background: 'linear-gradient(135deg,#0057e7,#00c8ff)', color: '#fff', border: 'none', cursor: 'pointer' }}
                  >
                    📷 Rescan
                  </button>
                </div>
                <div className="flex-1">
                  <button
                    onClick={() => navigate(`/dashboard/driver/commercial-inspection?pickup_id=${pickupIdForNav ?? ''}&stop_id=${stopId ?? ''}&reinspection=true`)}
                    className="w-full rounded-xl py-2.5 text-sm font-bold transition-all hover:brightness-110"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer' }}
                  >
                    🔍 Reinspect
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Inspection gate banner (non-reinspection states) ── */}
          {status === 'arrived' && gateStatus !== 'loading' && gateStatus !== 'clear' && gateStatus !== 'reinspection_required' && (
            <div
              className="rounded-xl px-4 py-3 mb-1"
              style={{
                background: gateStatus === 'no_inspection' ? 'rgba(251,191,36,0.07)' : 'rgba(248,113,113,0.07)',
                border: `1px solid ${gateStatus === 'no_inspection' ? 'rgba(251,191,36,0.28)' : 'rgba(248,113,113,0.28)'}`,
              }}
            >
              <p style={{ fontSize: 12, fontWeight: 700, color: gateStatus === 'no_inspection' ? '#fbbf24' : '#f87171', marginBottom: 3 }}>
                {gateStatus === 'no_inspection'  && '⚠️ Inspection required'}
                {gateStatus === 'pending_review' && '⏳ Awaiting admin review'}
                {gateStatus === 'blocked'        && '🚫 Stop blocked'}
              </p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
                {gateStatus === 'no_inspection'  && 'Complete the safety inspection before finishing this stop.'}
                {gateStatus === 'pending_review' && 'Your caution inspection was submitted and is pending admin approval. You cannot complete this stop until it is reviewed.'}
                {gateStatus === 'blocked'        && 'This stop was flagged or rejected. You cannot complete it without admin clearance.'}
              </p>
            </div>
          )}

          <PrimaryButton
            fullWidth size="md" variant="secondary"
            onClick={() => navigate('/dashboard/driver/commercial-scan')}
          >
            📦 Scan Containers
          </PrimaryButton>

          <PrimaryButton
            fullWidth size="md" variant="secondary"
            onClick={() => navigate('/dashboard/driver/commercial-inspection')}
          >
            🦺 Start Inspection
          </PrimaryButton>

          <PrimaryButton
            fullWidth size="md" variant="secondary"
            onClick={() => showToast('Reporting issue to dispatch…')}
          >
            ⚠️ Report Issue
          </PrimaryButton>

          {status === 'arrived' && (
            <PrimaryButton
              fullWidth size="lg"
              disabled={gateStatus !== 'clear'}
              onClick={() => setStatus('complete')}
            >
              {gateStatus === 'loading'                  ? 'Checking inspection…'
               : gateStatus === 'clear'                 ? '✅ Complete Stop'
               : gateStatus === 'reinspection_required' ? '🔒 Reinspection Required'
               : '🔒 Completion Blocked'}
            </PrimaryButton>
          )}

          <button
            onClick={() => showToast('Emergency dispatch contacted')}
            className="w-full rounded-2xl py-3.5 text-sm font-bold transition-all hover:brightness-110 mt-1"
            style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171', cursor: 'pointer' }}
          >
            🚨 Emergency / Support
          </button>
        </div>
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
