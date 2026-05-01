// Route Stop Page — bag scanning + inspection for a single route stop
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useDemoStore, type BagResult } from '../../store/demoStore'

const A  = '#00c8ff'
const BD = 'rgba(0,190,255,0.15)'
const GL = 'rgba(255,255,255,0.06)'

const RESULT_OPTS: { value: BagResult; label: string; color: string; bg: string }[] = [
  { value: 'green',  label: '🟢 Green',  color: '#4ade80', bg: 'rgba(34,197,94,0.15)'  },
  { value: 'yellow', label: '🟡 Yellow', color: '#facc15', bg: 'rgba(234,179,8,0.15)'  },
  { value: 'red',    label: '🔴 Red',    color: '#f87171', bg: 'rgba(239,68,68,0.15)'  },
]

type ModalState =
  | { kind: 'none' }
  | { kind: 'manual' }
  | { kind: 'scan_error' }
  | { kind: 'override_confirm' }
  | { kind: 'inspect'; bagCode: string }

function nextBagCode(idx: number) {
  return `BAG-ROUTE-${String(idx + 1).padStart(3, '0')}`
}

export default function RouteStopPage() {
  const { stopId } = useParams<{ stopId: string }>()
  const navigate   = useNavigate()
  const { activeRoute, scanBagAtStop, completeRouteStop } = useDemoStore()

  const stop = activeRoute?.stops.find((s) => s.id === stopId)

  const [modal, setModal]           = useState<ModalState>({ kind: 'none' })
  const [manualInput, setManualInput] = useState('')
  const [scanning, setScanning]     = useState(false)
  const [pendingCode, setPendingCode] = useState('')
  const [pendingResult, setPendingResult] = useState<BagResult | null>(null)

  if (!stop) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6" style={{ background: '#060e24' }}>
        <div className="text-center space-y-3">
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>Stop not found.</p>
          <button
            onClick={() => navigate('/dashboard/driver/route')}
            className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
            style={{ background: 'linear-gradient(135deg,#0057e7,#00c8ff)' }}
          >
            ← Back to Route
          </button>
        </div>
      </div>
    )
  }

  const totalBags      = stop.bagCount
  const scannedCount   = stop.scannedBags.length
  const canComplete    = scannedCount > 0
  const allRoutesDone  = activeRoute!.routeStatus === 'all_stops_done' || activeRoute!.routeStatus === 'warehouse_checkin' || activeRoute!.routeStatus === 'completed'

  const handleSimulateScan = () => {
    setScanning(true)
    setTimeout(() => {
      setScanning(false)
      const code = nextBagCode(scannedCount)
      setPendingCode(code)
      setPendingResult(null)
      setModal({ kind: 'inspect', bagCode: code })
    }, 900)
  }

  const handleManualSubmit = () => {
    const code = manualInput.trim().toUpperCase()
    if (!code) return
    setManualInput('')
    setPendingCode(code)
    setPendingResult(null)
    setModal({ kind: 'inspect', bagCode: code })
  }

  const handleConfirmInspect = () => {
    if (!pendingCode || !pendingResult) return
    scanBagAtStop(stop.id, pendingCode, pendingResult)
    setPendingCode('')
    setPendingResult(null)
    setModal({ kind: 'none' })
  }

  const handleCompleteStop = () => {
    completeRouteStop(stop.id)
    navigate('/dashboard/driver/route')
  }

  const handleOverrideAccept = () => {
    // Mark stop complete without full scan
    completeRouteStop(stop.id)
    setModal({ kind: 'none' })
    navigate('/dashboard/driver/route')
  }

  return (
    <div className="relative flex flex-col min-h-screen" style={{ background: '#060e24' }}>
      <div className="pointer-events-none absolute inset-0 grid-bg" style={{ zIndex: 0 }} />
      <div className="pointer-events-none absolute" style={{ top: -60, right: -40, width: 200, height: 200, background: 'rgba(0,190,255,0.25)', filter: 'blur(52px)', borderRadius: '50%', zIndex: 0 }} />

      {/* Header */}
      <header
        className="relative flex items-center justify-between px-4 py-3"
        style={{ borderBottom: `1px solid ${BD}`, background: 'rgba(6,14,36,0.9)', backdropFilter: 'blur(20px)', zIndex: 10, paddingTop: 'max(env(safe-area-inset-top,0px),12px)' }}
      >
        <button
          onClick={() => navigate('/dashboard/driver/route')}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
          style={{ background: GL, border: `1px solid ${BD}`, color: 'rgba(0,210,255,0.7)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Route
        </button>
        <p style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Stop Pickup</p>
        <div style={{ width: 60 }} />
      </header>

      <main className="relative flex-1 overflow-y-auto pb-40" style={{ zIndex: 1, padding: '20px 20px 0' }}>

        {/* Stop info card */}
        <div className="rounded-2xl p-4 mb-5" style={{ background: GL, border: `1px solid rgba(34,197,94,0.3)` }}>
          <p style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{stop.address}</p>
          {stop.units.length > 0 && (
            <p style={{ fontSize: 12, color: A, marginBottom: 4 }}>
              Units: {stop.units.join(', ')}
            </p>
          )}
          <div className="flex gap-4 mt-2">
            {stop.units.length > 0 && (
              <div>
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Units</p>
                <p style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{stop.units.length}</p>
              </div>
            )}
            <div>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Bags</p>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{totalBags}</p>
            </div>
            <div>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Scanned</p>
              <p style={{ fontSize: 16, fontWeight: 700, color: scannedCount > 0 ? '#4ade80' : '#fff' }}>
                {scannedCount}/{totalBags}
              </p>
            </div>
          </div>
        </div>

        {/* Scan actions */}
        <div className="space-y-3 mb-5">
          <button
            onClick={handleSimulateScan}
            disabled={scanning}
            className="w-full rounded-2xl py-4 text-sm font-bold text-white transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg,#0057e7,#00c8ff)', boxShadow: '0 4px 20px rgba(0,190,255,0.3)' }}
          >
            {scanning ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Scanning…
              </span>
            ) : (
              '📷 Scan Pickup'
            )}
          </button>

          <button
            onClick={() => setModal({ kind: 'manual' })}
            className="w-full rounded-2xl py-3.5 text-sm font-bold"
            style={{ background: GL, border: `1px solid ${BD}`, color: A }}
          >
            ✏️ Manual Entry
          </button>

          <button
            onClick={() => setModal({ kind: 'override_confirm' })}
            className="w-full rounded-xl py-2.5 text-xs font-semibold"
            style={{ background: 'none', border: '1px solid rgba(255,193,7,0.3)', color: 'rgba(255,193,7,0.7)' }}
          >
            ⚠️ Override Camera Scanner
          </button>
        </div>

        {/* Scanned bags */}
        {stop.scannedBags.length > 0 && (
          <div>
            <p className="section-label mb-3">SCANNED BAGS</p>
            <div className="space-y-2">
              {stop.scannedBags.map((b) => {
                const opt = RESULT_OPTS.find((o) => o.value === b.result)!
                return (
                  <div
                    key={b.code}
                    className="rounded-xl px-4 py-3 flex items-center justify-between"
                    style={{ background: opt.bg, border: `1px solid ${opt.color}44` }}
                  >
                    <p className="font-mono font-bold" style={{ fontSize: 13, color: '#fff' }}>{b.code}</p>
                    <span style={{ fontSize: 12, fontWeight: 600, color: opt.color }}>{opt.label}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </main>

      {/* Pinned bottom buttons */}
      <div className="fixed bottom-0 left-0 right-0 z-20 px-5 pb-6 pt-3 space-y-2" style={{ background: 'rgba(6,14,36,0.95)', borderTop: `1px solid ${BD}` }}>
        <button
          disabled={!canComplete}
          onClick={handleCompleteStop}
          className="w-full rounded-2xl py-3.5 text-sm font-bold text-white disabled:cursor-not-allowed"
          style={
            canComplete
              ? { background: 'linear-gradient(135deg,#0d9e3e,#22c55e)', boxShadow: '0 4px 16px rgba(34,197,94,0.3)' }
              : { background: GL, border: `1px solid ${BD}`, color: 'rgba(255,255,255,0.3)' }
          }
        >
          {canComplete ? `✓ Complete Stop (${scannedCount} bag${scannedCount !== 1 ? 's' : ''} scanned)` : 'Scan at least one bag to complete'}
        </button>

        <button
          disabled={!allRoutesDone}
          onClick={() => allRoutesDone && navigate('/dashboard/driver/warehouse-checkin')}
          className="w-full rounded-xl py-2.5 text-xs font-bold disabled:cursor-not-allowed"
          style={
            allRoutesDone
              ? { background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.4)', color: '#fbbf24' }
              : { background: GL, border: `1px solid ${BD}`, color: 'rgba(255,255,255,0.2)' }
          }
        >
          🏭 Warehouse Check-in {!allRoutesDone && '(complete all stops first)'}
        </button>
      </div>

      {/* ── Modal overlays ── */}
      {modal.kind !== 'none' && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-6"
          style={{ background: 'rgba(0,0,0,0.65)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setModal({ kind: 'none' }) }}
        >
          <div
            className="w-full max-w-sm rounded-3xl p-5 space-y-4"
            style={{ background: 'rgba(6,14,36,0.98)', border: `1px solid ${BD}`, boxShadow: '0 0 60px rgba(0,0,0,0.7)' }}
          >
            {/* Manual entry */}
            {modal.kind === 'manual' && (
              <>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Manual Entry</p>
                <input
                  autoFocus
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value.toUpperCase())}
                  placeholder="Enter bag QR code"
                  className="w-full rounded-xl px-4 py-3 font-mono text-sm outline-none"
                  style={{ background: 'rgba(255,255,255,0.07)', border: `1px solid ${BD}`, color: '#fff' }}
                  onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => { setManualInput(''); setModal({ kind: 'none' }) }}
                    className="flex-1 rounded-xl py-2.5 text-sm font-medium"
                    style={{ background: GL, border: `1px solid ${BD}`, color: 'rgba(255,255,255,0.5)' }}
                  >
                    Cancel
                  </button>
                  <button
                    disabled={!manualInput.trim()}
                    onClick={handleManualSubmit}
                    className="flex-1 rounded-xl py-2.5 text-sm font-bold text-white disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg,#0057e7,#00c8ff)' }}
                  >
                    Submit
                  </button>
                </div>
              </>
            )}

            {/* Scan error */}
            {modal.kind === 'scan_error' && (
              <>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: 'rgba(239,68,68,0.15)' }}>
                    <span style={{ fontSize: 22 }}>❌</span>
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>QR Code Scan Error</p>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
                      We could not read this bag's QR code. Please try again or enter the QR code manually.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setModal({ kind: 'none' })}
                  className="w-full rounded-xl py-2.5 text-sm font-bold text-white"
                  style={{ background: 'linear-gradient(135deg,#0057e7,#00c8ff)' }}
                >
                  OK
                </button>
              </>
            )}

            {/* Override confirm */}
            {modal.kind === 'override_confirm' && (
              <>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: 'rgba(255,193,7,0.15)' }}>
                    <span style={{ fontSize: 22 }}>⚠️</span>
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Override Camera Scanner</p>
                    <p style={{ fontSize: 12, color: 'rgba(255,193,7,0.8)', marginTop: 2 }}>
                      This override bypasses standard bag inspection. The stop will be marked complete without a full scan. This action is logged.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setModal({ kind: 'none' })}
                    className="flex-1 rounded-xl py-2.5 text-sm font-medium"
                    style={{ background: GL, border: `1px solid ${BD}`, color: 'rgba(255,255,255,0.5)' }}
                  >
                    Reject
                  </button>
                  <button
                    onClick={handleOverrideAccept}
                    className="flex-1 rounded-xl py-2.5 text-sm font-bold"
                    style={{ background: 'rgba(255,193,7,0.15)', border: '1px solid rgba(255,193,7,0.4)', color: '#fbbf24' }}
                  >
                    Accept Override
                  </button>
                </div>
              </>
            )}

            {/* Inspect: choose G/Y/R */}
            {modal.kind === 'inspect' && (
              <>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Bag Inspection</p>
                  <p className="font-mono mt-1" style={{ fontSize: 13, color: A }}>{modal.bagCode}</p>
                </div>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>Select bag condition:</p>
                <div className="space-y-2">
                  {RESULT_OPTS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setPendingResult(opt.value)}
                      className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-left transition-all"
                      style={{
                        background: pendingResult === opt.value ? opt.bg : GL,
                        border: `1.5px solid ${pendingResult === opt.value ? opt.color : BD}`,
                        color: opt.color,
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <button
                  disabled={!pendingResult}
                  onClick={handleConfirmInspect}
                  className="w-full rounded-xl py-2.5 text-sm font-bold text-white disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#0057e7,#00c8ff)' }}
                >
                  Confirm Inspection
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
