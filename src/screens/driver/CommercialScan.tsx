import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { logMode } from '../../lib/mode'
import { GlassCard } from '../../components/ui/GlassCard'
import { PrimaryButton } from '../../components/ui/PrimaryButton'
import { StatusBadge } from '../../components/ui/StatusBadge'

// ── Demo scan result ──────────────────────────────────────────────────────────

const SCAN_RESULT = {
  containerId: 'BIN-2048',
  business:    'Greenway Office Plaza',
  material:    'Cardboard',
  fillEst:     82,
  status:      'Verified' as const,
}

type ScanPhase = 'scanning' | 'result' | 'confirmed'

// ── Screen ────────────────────────────────────────────────────────────────────

export default function CommercialScan() {
  const navigate = useNavigate()
  const [searchParams]  = useSearchParams()
  const pickupId        = searchParams.get('pickup_id')
  const stopId          = searchParams.get('stop_id')
  const isReinspection  = searchParams.get('reinspection') === 'true'

  const inspectionPath = isReinspection && pickupId
    ? `/dashboard/driver/commercial-inspection?pickup_id=${pickupId}&stop_id=${stopId ?? ''}&reinspection=true`
    : '/dashboard/driver/commercial-inspection'

  const [phase, setPhase]       = useState<ScanPhase>('scanning')
  const [manualCode, setManualCode] = useState('')
  const [toast, setToast]       = useState<string | null>(null)

  useEffect(() => { logMode('qr-scan') }, [])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  function handleScan() {
    setPhase('result')
  }

  function handleConfirm() {
    setPhase('confirmed')
    showToast('Container confirmed ✓')
  }

  function handleRescan() {
    setManualCode('')
    setPhase('scanning')
  }

  // ── Confirmed state ────────────────────────────────────────────────────────

  if (phase === 'confirmed') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}>
        <div
          className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl mb-5"
          style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)' }}
        >
          ✅
        </div>
        <p style={{ fontSize: 20, fontWeight: 900, color: '#fff', marginBottom: 6 }}>
          Container Confirmed
        </p>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: 5, maxWidth: 260 }}>
          <span style={{ color: '#00c8ff', fontWeight: 700 }}>{SCAN_RESULT.containerId}</span> — {SCAN_RESULT.business}
        </p>
        <StatusBadge variant="green" label="Verified" dot />

        <div className="flex gap-3 mt-8 w-full max-w-xs">
          <div className="flex-1">
            <PrimaryButton fullWidth size="md" variant="secondary" onClick={handleRescan}>
              📷 Scan Next
            </PrimaryButton>
          </div>
          <div className="flex-1">
            <PrimaryButton fullWidth size="md" onClick={() => navigate(inspectionPath)}>
              🦺 Inspection
            </PrimaryButton>
          </div>
        </div>
        <button
          onClick={() => navigate(-1)}
          style={{ marginTop: 16, color: 'rgba(255,255,255,0.35)', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer' }}
        >
          ← Return to Route
        </button>
      </div>
    )
  }

  // ── Main scan view ─────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}>
      <style>{`
        @keyframes scanLine {
          0%   { transform: translateY(0px);   opacity: 0.8; }
          50%  { transform: translateY(160px); opacity: 1;   }
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
          {isReinspection ? 'Reinspection Scan' : 'Scan Commercial Bin'}
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

        {/* ── Instruction card ── */}
        <div className="rounded-2xl px-4 py-3 mb-4 flex items-center gap-3" style={{ background: 'rgba(0,200,255,0.07)', border: '1px solid rgba(0,200,255,0.18)' }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>🏭</span>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
            Point the camera at the QR code on the commercial bin, dumpster, or compactor.
          </p>
        </div>

        {isReinspection && (
          <div className="rounded-2xl px-4 py-3 mb-4 flex items-center gap-3" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.28)' }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>🔄</span>
            <p style={{ fontSize: 12, color: '#fbbf24', fontWeight: 700, lineHeight: 1.5 }}>
              Reinspection mode — scan and re-inspect containers before completing this stop.
            </p>
          </div>
        )}

        {phase === 'scanning' && (
          <>
            {/* ── Scanner placeholder ── */}
            <div
              className="relative rounded-2xl overflow-hidden mb-4"
              style={{
                height: 200,
                background: 'rgba(0,0,0,0.55)',
                border: '2px solid rgba(0,200,255,0.3)',
              }}
            >
              {/* Corner brackets */}
              {[
                { top: 12, left: 12, borderTop: '2px solid #00c8ff', borderLeft: '2px solid #00c8ff', width: 24, height: 24 },
                { top: 12, right: 12, borderTop: '2px solid #00c8ff', borderRight: '2px solid #00c8ff', width: 24, height: 24 },
                { bottom: 12, left: 12, borderBottom: '2px solid #00c8ff', borderLeft: '2px solid #00c8ff', width: 24, height: 24 },
                { bottom: 12, right: 12, borderBottom: '2px solid #00c8ff', borderRight: '2px solid #00c8ff', width: 24, height: 24 },
              ].map((s, i) => (
                <div key={i} style={{ position: 'absolute', borderRadius: 2, ...s }} />
              ))}

              {/* Scan line */}
              <div style={{
                position: 'absolute',
                left: '15%',
                right: '15%',
                height: 2,
                background: 'linear-gradient(90deg, transparent, #00c8ff, transparent)',
                top: 20,
                animation: 'scanLine 2.5s ease-in-out infinite',
              }} />

              {/* Center text */}
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <p style={{ fontSize: 11, color: '#00c8ff', fontWeight: 700, animation: 'scanPulse 1.5s ease-in-out infinite' }}>
                  ● Scanning…
                </p>
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 6 }}>
                  Align QR code within frame
                </p>
              </div>
            </div>

            {/* ── Simulate scan button ── */}
            <PrimaryButton fullWidth size="md" className="mb-4" onClick={handleScan}>
              📷 Simulate Scan (Demo)
            </PrimaryButton>

            {/* ── Manual entry ── */}
            <GlassCard padding="md">
              <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 10 }}>
                Manual QR Entry
              </p>
              <div className="flex gap-2">
                <input
                  value={manualCode}
                  onChange={e => setManualCode(e.target.value)}
                  placeholder="e.g. BIN-2048"
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    borderRadius: 12,
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(0,200,255,0.2)',
                    color: '#fff',
                    fontSize: 14,
                    outline: 'none',
                  }}
                />
                <button
                  onClick={handleScan}
                  className="rounded-xl px-4 py-2.5 text-sm font-bold transition-all hover:brightness-110"
                  style={{ background: 'linear-gradient(135deg,#0057e7,#00c8ff)', color: '#fff', border: 'none', cursor: 'pointer', flexShrink: 0 }}
                >
                  Scan
                </button>
              </div>
            </GlassCard>
          </>
        )}

        {phase === 'result' && (
          <>
            {/* ── Scanned result card ── */}
            <GlassCard variant="elevated" padding="lg" className="mb-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.09em' }}>
                    Container Found
                  </p>
                  <p style={{ fontSize: 20, fontWeight: 900, color: '#00c8ff', marginTop: 3 }}>
                    {SCAN_RESULT.containerId}
                  </p>
                </div>
                <StatusBadge variant="green" label={SCAN_RESULT.status} dot />
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-3 mb-4">
                {[
                  { label: 'Business',     value: SCAN_RESULT.business                 },
                  { label: 'Material',     value: SCAN_RESULT.material                 },
                  { label: 'Fill Estimate', value: `${SCAN_RESULT.fillEst}%`           },
                  { label: 'Status',       value: SCAN_RESULT.status                   },
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

              {/* Fill bar */}
              <div style={{ marginBottom: 4 }}>
                <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                  <div style={{
                    width: `${SCAN_RESULT.fillEst}%`,
                    height: '100%',
                    background: SCAN_RESULT.fillEst > 85 ? '#f87171' : SCAN_RESULT.fillEst > 60 ? '#fbbf24' : '#4ade80',
                    borderRadius: 999,
                    boxShadow: SCAN_RESULT.fillEst > 85 ? '0 0 7px rgba(248,113,113,0.5)' : '0 0 7px rgba(251,191,36,0.5)',
                  }} />
                </div>
              </div>
            </GlassCard>

            {/* ── Action buttons ── */}
            <div className="flex flex-col gap-2.5">
              <PrimaryButton fullWidth size="lg" onClick={handleConfirm}>
                ✓ Confirm Container
              </PrimaryButton>
              <PrimaryButton fullWidth size="md" variant="secondary" onClick={handleRescan}>
                🔄 Rescan
              </PrimaryButton>
              <PrimaryButton fullWidth size="md" variant="secondary" onClick={() => navigate(inspectionPath)}>
                🦺 Start Inspection
              </PrimaryButton>
            </div>
          </>
        )}
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
