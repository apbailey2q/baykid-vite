import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { GlassCard } from '../../components/ui/GlassCard'
import { PrimaryButton } from '../../components/ui/PrimaryButton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { Spinner } from '../../components/ui/Spinner'
import { useNetworkStatus } from '../../hooks/useNetworkStatus'
import { useOfflineSync } from '../../hooks/useOfflineSync'
import { OfflineBanner } from '../../components/offline/OfflineBanner'
import { addDraft } from '../../lib/offlineQueue'

// ── Types ─────────────────────────────────────────────────────────────────────

interface LoadDetail {
  id: string
  pickup_id: string | null
  account_id: string | null
  business_name: string
  material_type: string
  warehouse_id: string | null
  driver_id: string | null
  driver_name: string | null
  bin_count: number | null
  estimated_weight: number | null
  status: string
}

type IntakePhase = 'scan' | 'confirm' | 'success'
type InspectionResult = 'green' | 'yellow' | 'red'

const PROCESSING_LINES = [
  'Cardboard Line A',
  'Cardboard Line B',
  'Mixed Recycling Line',
  'Plastics Line',
  'Glass Line',
]

const INSPECTION_OPTIONS: { value: InspectionResult; label: string; color: string; border: string }[] = [
  { value: 'green',  label: '✅ Green — Clear',          color: 'rgba(74,222,128,0.12)',  border: 'rgba(74,222,128,0.35)'  },
  { value: 'yellow', label: '⚠️ Yellow — Minor Issues',  color: 'rgba(251,191,36,0.1)',   border: 'rgba(251,191,36,0.35)'  },
  { value: 'red',    label: '🚫 Red — Reject / Flag',    color: 'rgba(248,113,113,0.1)',  border: 'rgba(248,113,113,0.35)' },
]

// ── Screen ────────────────────────────────────────────────────────────────────

export default function CommercialIntake() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const loadId   = searchParams.get('load_id')
  const pickupId = searchParams.get('pickup_id') || null

  const { isOnline } = useNetworkStatus()
  const offlineSync  = useOfflineSync()

  const [phase, setPhase]               = useState<IntakePhase>(loadId ? 'confirm' : 'scan')
  const [loadDetail, setLoadDetail]     = useState<LoadDetail | null>(null)
  const [loadState, setLoadState]       = useState<'loading' | 'error' | 'ready'>(loadId ? 'loading' : 'ready')
  const [manualCode, setManualCode]     = useState('')
  const [actualWeight, setActualWeight] = useState('')
  const [line, setLine]                 = useState(PROCESSING_LINES[0])
  const [intakeNotes, setIntakeNotes]   = useState('')
  const [inspection, setInspection]     = useState<InspectionResult | null>(null)
  const [submitting, setSubmitting]     = useState(false)
  const [flagged, setFlagged]           = useState(false)
  const [toast, setToast]               = useState<string | null>(null)

  // ── Load expected load when arriving from expected loads screen ──────────

  useEffect(() => {
    if (!loadId) return
    async function fetchLoad() {
      setLoadState('loading')
      const { data, error } = await supabase
        .from('expected_warehouse_loads')
        .select('id, pickup_id, account_id, business_name, material_type, warehouse_id, driver_id, bin_count, estimated_weight, status')
        .eq('id', loadId!)
        .maybeSingle()

      if (error || !data) { setLoadState('error'); return }

      let driverName: string | null = null
      if (data.driver_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', data.driver_id)
          .maybeSingle()
        driverName = profile?.full_name ?? null
      }

      setLoadDetail({ ...data, driver_name: driverName })
      setActualWeight(data.estimated_weight != null ? String(data.estimated_weight) : '')
      setLoadState('ready')
      setPhase('confirm')
    }
    fetchLoad()
  }, [loadId])

  // ── Toast ─────────────────────────────────────────────────────────────────

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  // ── Scan (demo) — simulate finding a load ─────────────────────────────────

  function handleScan() {
    setPhase('confirm')
  }

  // ── Confirm Intake ────────────────────────────────────────────────────────

  async function handleConfirmIntake() {
    if (!inspection) { showToast('Select an inspection result before confirming'); return }
    if (!actualWeight || isNaN(Number(actualWeight))) { showToast('Enter a valid actual weight'); return }

    const effectiveLoadId   = loadId   ?? null
    const effectivePickupId = pickupId ?? loadDetail?.pickup_id ?? null

    // ── Offline path ──────────────────────────────────────────────────────────
    if (!isOnline) {
      addDraft({
        user_id:     'warehouse',   // warehouse staff — auth user not available here without useAuthStore
        action_type: 'warehouse_intake',
        payload: {
          load_id:      effectiveLoadId,
          pickup_id:    effectivePickupId,
          inspection,
          actual_weight: Number(actualWeight),
          line,
          notes:        intakeNotes || null,
          warehouse_id: loadDetail?.warehouse_id ?? null,
          account_id:   loadDetail?.account_id   ?? null,
          material_type:loadDetail?.material_type ?? 'Unknown',
          batch_exists: false,
        },
      })
      setPhase('success')
      showToast('Intake draft saved offline — will sync when reconnected')
      return
    }

    if (inspection === 'red') {
      // Red inspection → flag, not receive
      setSubmitting(true)
      try {
        if (effectiveLoadId) {
          await supabase
            .from('expected_warehouse_loads')
            .update({ status: 'flagged', intake_result: 'red', warehouse_notes: intakeNotes || null })
            .eq('id', effectiveLoadId)
        }
        if (effectivePickupId) {
          await supabase
            .from('commercial_pickups')
            .update({ status: 'flagged' })
            .eq('id', effectivePickupId)
        }
        setFlagged(true)
        showToast('Load flagged — supervisor notified')
        setTimeout(() => navigate(-1), 1800)
      } catch (err: unknown) {
        showToast(err instanceof Error ? err.message : 'Update failed')
      } finally {
        setSubmitting(false)
      }
      return
    }

    // Green or yellow → mark received
    setSubmitting(true)
    try {
      if (effectiveLoadId) {
        const { error: loadErr } = await supabase
          .from('expected_warehouse_loads')
          .update({
            status:          'received',
            intake_result:   inspection,
            actual_weight:   Number(actualWeight),
            processing_line: line,
            warehouse_notes: intakeNotes || null,
          })
          .eq('id', effectiveLoadId)
        if (loadErr) throw loadErr
      }

      if (effectivePickupId) {
        await supabase
          .from('commercial_pickups')
          .update({ status: 'processed' })
          .eq('id', effectivePickupId)
      }

      // Best-effort batch creation with duplicate prevention
      try {
        let hasBatch = false
        if (effectivePickupId) {
          const { data: existingBatch } = await supabase
            .from('material_batches')
            .select('id')
            .eq('commercial_pickup_id', effectivePickupId)
            .maybeSingle()
          hasBatch = !!existingBatch
        }
        if (!hasBatch) {
          await supabase.from('material_batches').insert({
            commercial_pickup_id:  effectivePickupId ?? null,
            expected_load_id:      effectiveLoadId   ?? null,
            warehouse_id:          loadDetail?.warehouse_id ?? null,
            commercial_account_id: loadDetail?.account_id  ?? null,
            material_type:         loadDetail?.material_type ?? 'Unknown',
            actual_weight:         Number(actualWeight),
            contamination_status:  inspection === 'yellow' ? 'flagged' : 'clean',
            processing_line:       line,
            status:                'received',
          })
        }
      } catch (err) {
        console.warn('Batch creation failed:', err)
      }

      setPhase('success')
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Flag Issue ────────────────────────────────────────────────────────────

  async function handleFlagIssue() {
    const effectiveLoadId   = loadId   ?? null
    const effectivePickupId = pickupId ?? loadDetail?.pickup_id ?? null

    if (!isOnline) {
      addDraft({
        user_id:     'warehouse',
        action_type: 'warehouse_flag',
        payload: { load_id: effectiveLoadId, pickup_id: effectivePickupId, notes: intakeNotes || null },
      })
      setFlagged(true)
      showToast('Flag saved offline — will sync when reconnected')
      setTimeout(() => navigate(-1), 1800)
      return
    }

    setSubmitting(true)
    try {
      if (effectiveLoadId) {
        await supabase
          .from('expected_warehouse_loads')
          .update({ status: 'flagged', warehouse_notes: intakeNotes || null })
          .eq('id', effectiveLoadId)
      }
      if (effectivePickupId) {
        await supabase
          .from('commercial_pickups')
          .update({ status: 'flagged' })
          .eq('id', effectivePickupId)
      }
      setFlagged(true)
      showToast('Issue flagged — supervisor notified')
      setTimeout(() => navigate(-1), 1800)
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Success state ─────────────────────────────────────────────────────────

  if (phase === 'success') {
    const detail = loadDetail
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}>
        <div
          className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl mb-5"
          style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)' }}
        >
          ✅
        </div>
        <p style={{ fontSize: 20, fontWeight: 900, color: '#fff', marginBottom: 6 }}>
          Load Received
        </p>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: 20, maxWidth: 280 }}>
          Commercial load received successfully. Container logged to{' '}
          <span style={{ color: '#00c8ff', fontWeight: 700 }}>{line}</span>.
        </p>

        <GlassCard padding="md" className="w-full max-w-xs mb-6">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {[
              { label: 'Business',    value: detail?.business_name ?? '—'    },
              { label: 'Driver',      value: detail?.driver_name  ?? '—'     },
              { label: 'Material',    value: detail?.material_type ?? '—'    },
              { label: 'Weight',      value: `${actualWeight} lbs`           },
              { label: 'Line',        value: line                            },
              { label: 'Inspection',  value: inspection === 'green' ? '✅ Clear' : '⚠️ Approved' },
            ].map(row => (
              <div key={row.label}>
                <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  {row.label}
                </p>
                <p style={{ fontSize: 12, color: '#fff', fontWeight: 600, marginTop: 1 }}>
                  {row.value}
                </p>
              </div>
            ))}
          </div>
        </GlassCard>

        <div className="flex gap-3 w-full max-w-xs">
          <div className="flex-1">
            <PrimaryButton fullWidth size="md" variant="secondary" onClick={() => navigate('/dashboard/warehouse/commercial-expected-loads')}>
              🚛 More Loads
            </PrimaryButton>
          </div>
          <div className="flex-1">
            <PrimaryButton fullWidth size="md" onClick={() => navigate('/dashboard/warehouse/commercial-processing')}>
              ⚙️ Processing
            </PrimaryButton>
          </div>
        </div>
        <button
          onClick={() => navigate(-1)}
          style={{ marginTop: 16, color: 'rgba(255,255,255,0.35)', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer' }}
        >
          ← Back to Loads
        </button>
      </div>
    )
  }

  // ── Loading state (fetching load by ID) ──────────────────────────────────

  if (loadState === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}>
        <Spinner size="lg" />
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Loading intake record…</p>
      </div>
    )
  }

  if (loadState === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}>
        <GlassCard padding="lg" className="w-full max-w-sm text-center">
          <p style={{ fontSize: 28, marginBottom: 12 }}>⚠️</p>
          <p style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Load not found</p>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 20 }}>
            This intake record may have been removed or the link is invalid.
          </p>
          <PrimaryButton fullWidth onClick={() => navigate(-1)}>← Go Back</PrimaryButton>
        </GlassCard>
      </div>
    )
  }

  // ── Main view ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}>
      <OfflineBanner isOnline={isOnline} syncState={offlineSync} />
      <style>{`
        @keyframes scanLine {
          0%   { transform: translateY(0px);   opacity: 0.8; }
          50%  { transform: translateY(140px); opacity: 1;   }
          100% { transform: translateY(0px);   opacity: 0.8; }
        }
        @keyframes scanPulse {
          0%,100% { opacity: 0.4; }
          50%     { opacity: 1;   }
        }
      `}</style>

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
          Commercial Intake
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
            onClick={() => navigate('/dashboard/warehouse/commercial-processing')}
            className="flex-1 rounded-xl py-2.5 text-xs font-bold transition-all hover:brightness-110"
            style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.18)', color: '#4ade80', cursor: 'pointer' }}
          >
            ⚙️ Processing
          </button>
        </div>

        {/* ── Step indicator ── */}
        {!loadId && (
          <div className="flex items-center gap-2 mb-5">
            {(['scan', 'confirm'] as IntakePhase[]).map((p, i) => (
              <div key={p} className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{
                    background: phase === p || (p === 'scan' && phase === 'confirm') ? '#00c8ff' : 'rgba(255,255,255,0.08)',
                    color:      phase === p || (p === 'scan' && phase === 'confirm') ? '#000'     : 'rgba(255,255,255,0.3)',
                  }}
                >
                  {p === 'scan' && phase === 'confirm' ? '✓' : i + 1}
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: phase === p ? '#fff' : 'rgba(255,255,255,0.3)' }}>
                  {p === 'scan' ? 'Find Load' : 'Confirm'}
                </span>
                {i < 1 && <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)', minWidth: 20 }} />}
              </div>
            ))}
          </div>
        )}

        {/* ── Scan / find load phase ── */}
        {phase === 'scan' && (
          <>
            <div className="rounded-2xl px-4 py-3 mb-4 flex items-center gap-3" style={{ background: 'rgba(0,200,255,0.07)', border: '1px solid rgba(0,200,255,0.18)' }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>📦</span>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
                Scan the QR code on the incoming commercial container or enter the load ID manually.
              </p>
            </div>

            {/* Scanner UI */}
            <div
              className="relative rounded-2xl overflow-hidden mb-4"
              style={{ height: 180, background: 'rgba(0,0,0,0.55)', border: '2px solid rgba(0,200,255,0.3)' }}
            >
              {[
                { top: 12, left: 12, borderTop: '2px solid #00c8ff', borderLeft: '2px solid #00c8ff', width: 24, height: 24 },
                { top: 12, right: 12, borderTop: '2px solid #00c8ff', borderRight: '2px solid #00c8ff', width: 24, height: 24 },
                { bottom: 12, left: 12, borderBottom: '2px solid #00c8ff', borderLeft: '2px solid #00c8ff', width: 24, height: 24 },
                { bottom: 12, right: 12, borderBottom: '2px solid #00c8ff', borderRight: '2px solid #00c8ff', width: 24, height: 24 },
              ].map((s, i) => (
                <div key={i} style={{ position: 'absolute', borderRadius: 2, ...s }} />
              ))}
              <div style={{
                position: 'absolute', left: '15%', right: '15%', height: 2,
                background: 'linear-gradient(90deg, transparent, #00c8ff, transparent)',
                top: 20, animation: 'scanLine 2.5s ease-in-out infinite',
              }} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <p style={{ fontSize: 11, color: '#00c8ff', fontWeight: 700, animation: 'scanPulse 1.5s ease-in-out infinite' }}>
                  ● Scanning…
                </p>
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 6 }}>
                  Align QR code within frame
                </p>
              </div>
            </div>

            <PrimaryButton fullWidth size="md" className="mb-4" onClick={handleScan}>
              📷 Simulate Scan (Demo)
            </PrimaryButton>

            <GlassCard padding="md">
              <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 10 }}>
                Manual Load ID
              </p>
              <div className="flex gap-2">
                <input
                  value={manualCode}
                  onChange={e => setManualCode(e.target.value)}
                  placeholder="e.g. BIN-2048 or paste UUID"
                  style={{
                    flex: 1, padding: '10px 12px', borderRadius: 12,
                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(0,200,255,0.2)',
                    color: '#fff', fontSize: 14, outline: 'none',
                  }}
                />
                <button
                  onClick={handleScan}
                  className="rounded-xl px-4 py-2.5 text-sm font-bold transition-all hover:brightness-110"
                  style={{ background: 'linear-gradient(135deg,#0057e7,#00c8ff)', color: '#fff', border: 'none', cursor: 'pointer', flexShrink: 0 }}
                >
                  Lookup
                </button>
              </div>
            </GlassCard>
          </>
        )}

        {/* ── Confirm / form phase ── */}
        {phase === 'confirm' && (
          <>
            {/* Load summary card */}
            <GlassCard variant="elevated" padding="lg" className="mb-4">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.09em' }}>
                    {loadDetail ? 'Expected Load' : 'Commercial Load'}
                  </p>
                  <p style={{ fontSize: 20, fontWeight: 900, color: '#00c8ff', marginTop: 3 }}>
                    {loadDetail?.business_name ?? 'Unknown Business'}
                  </p>
                </div>
                {flagged && <StatusBadge variant="red" label="Flagged" size="sm" />}
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                {[
                  { label: 'Material',    value: loadDetail?.material_type     ?? '—'  },
                  { label: 'Driver',      value: loadDetail?.driver_name       ?? '—'  },
                  { label: 'Containers',  value: loadDetail?.bin_count != null ? `${loadDetail.bin_count} bins` : '—' },
                  { label: 'Est. Weight', value: loadDetail?.estimated_weight != null ? `${loadDetail.estimated_weight.toLocaleString()} lbs` : '—' },
                  { label: 'Warehouse',   value: loadDetail?.warehouse_id      ?? '—'  },
                  { label: 'Status',      value: loadDetail?.status            ?? '—'  },
                ].map(row => (
                  <div key={row.label}>
                    <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                      {row.label}
                    </p>
                    <p style={{ fontSize: 13, color: '#fff', fontWeight: 600, marginTop: 2 }}>
                      {row.value}
                    </p>
                  </div>
                ))}
              </div>

              {flagged && (
                <div className="rounded-xl px-3 py-2 mt-3" style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)' }}>
                  <p style={{ fontSize: 11, color: '#f87171', fontWeight: 700 }}>⚠️ Issue flagged — supervisor notified</p>
                </div>
              )}
            </GlassCard>

            {/* Actual weight */}
            <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
              Actual Weight
            </p>
            <GlassCard padding="md" className="mb-4">
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={actualWeight}
                  onChange={e => setActualWeight(e.target.value)}
                  placeholder="0"
                  style={{
                    flex: 1, padding: '10px 12px', borderRadius: 12,
                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(0,200,255,0.2)',
                    color: '#fff', fontSize: 16, fontWeight: 700, outline: 'none',
                  }}
                />
                <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>lbs</span>
              </div>
            </GlassCard>

            {/* Processing line */}
            <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
              Processing Line
            </p>
            <GlassCard padding="md" className="mb-4">
              <div className="flex flex-col gap-2">
                {PROCESSING_LINES.map(l => (
                  <button
                    key={l}
                    onClick={() => setLine(l)}
                    className="w-full text-left px-3 py-2.5 rounded-xl transition-all"
                    style={{
                      background: line === l ? 'rgba(0,200,255,0.12)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${line === l ? 'rgba(0,200,255,0.35)' : 'rgba(255,255,255,0.07)'}`,
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 600, color: line === l ? '#00c8ff' : 'rgba(255,255,255,0.6)' }}>
                      {line === l ? '✓ ' : ''}{l}
                    </span>
                  </button>
                ))}
              </div>
            </GlassCard>

            {/* Intake notes */}
            <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
              Intake Notes (optional)
            </p>
            <GlassCard padding="md" className="mb-4">
              <textarea
                value={intakeNotes}
                onChange={e => setIntakeNotes(e.target.value)}
                placeholder="Contamination observations, discrepancies, access issues…"
                rows={3}
                style={{
                  width: '100%', padding: '10px 0', borderRadius: 0,
                  background: 'transparent', border: 'none',
                  color: '#fff', fontSize: 13, outline: 'none', resize: 'none',
                  lineHeight: 1.55,
                }}
              />
            </GlassCard>

            {/* Inspection result */}
            <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
              Inspection Result
            </p>
            <GlassCard padding="md" className="mb-5">
              <div className="flex flex-col gap-2">
                {INSPECTION_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setInspection(opt.value)}
                    className="w-full text-left px-3 py-3 rounded-xl transition-all"
                    style={{
                      background: inspection === opt.value ? opt.color : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${inspection === opt.value ? opt.border : 'rgba(255,255,255,0.07)'}`,
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 700, color: inspection === opt.value ? '#fff' : 'rgba(255,255,255,0.6)' }}>
                      {opt.label}
                    </span>
                  </button>
                ))}
              </div>
            </GlassCard>

            {/* Action buttons */}
            <div className="flex flex-col gap-2.5">
              <PrimaryButton
                fullWidth size="lg"
                disabled={submitting || flagged}
                onClick={handleConfirmIntake}
              >
                {submitting ? 'Saving…' : '✓ Confirm Intake'}
              </PrimaryButton>
              {!flagged && (
                <PrimaryButton
                  fullWidth size="md" variant="secondary"
                  disabled={submitting}
                  onClick={handleFlagIssue}
                >
                  ⚠️ Flag Issue
                </PrimaryButton>
              )}
              {!loadId && (
                <button
                  onClick={() => { setPhase('scan'); setManualCode('') }}
                  style={{ marginTop: 4, color: 'rgba(255,255,255,0.35)', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'center' }}
                >
                  ← Find Different Load
                </button>
              )}
            </div>
          </>
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
