// Warehouse Check-in Page — driver confirms warehouse QR then checks in each bag
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDemoStore } from '../../store/demoStore'

const A  = '#00c8ff'
const BD = 'rgba(0,190,255,0.15)'
const GL = 'rgba(255,255,255,0.06)'

const CONFETTI = Array.from({ length: 36 }, (_, i) => ({
  left:  `${(i * 2.8 + 1) % 100}%`,
  delay: `${(i * 0.055).toFixed(2)}s`,
  dur:   `${1.4 + (i % 5) * 0.26}s`,
  size:  13 + (i % 6) * 3,
  cyan:  i % 3 !== 2,
}))

export default function WarehouseCheckinPage() {
  const navigate = useNavigate()
  const { activeRoute, confirmWarehouseCode, checkinBagAtWarehouse, clearDriverRoute } = useDemoStore()

  const [phase, setPhase]           = useState<'warehouse_qr' | 'bag_checkin' | 'complete'>('warehouse_qr')
  const [warehouseInput, setWarehouseInput] = useState('')
  const [showManualWH, setShowManualWH]     = useState(false)
  const [bagInput, setBagInput]             = useState('')
  const [showBagManual, setShowBagManual]   = useState(false)
  const [scanning, setScanning]             = useState(false)
  const [lastChecked, setLastChecked]       = useState<string | null>(null)

  if (!activeRoute) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6" style={{ background: '#060e24' }}>
        <div className="text-center space-y-3">
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>No active route found.</p>
          <button
            onClick={() => navigate('/dashboard/driver')}
            className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
            style={{ background: 'linear-gradient(135deg,#0057e7,#00c8ff)' }}
          >← Back to Dashboard</button>
        </div>
      </div>
    )
  }

  const totalBags      = activeRoute.stops.reduce((n, s) => n + s.bagCount, 0)
  const checkedIn      = activeRoute.checkedInBags.length
  const allCheckedIn   = checkedIn >= totalBags
  const currentPhase   = activeRoute.routeStatus

  // If store already says completed, show the complete screen
  const showComplete = phase === 'complete' || currentPhase === 'completed'

  const handleWarehouseScan = () => {
    setScanning(true)
    setTimeout(() => {
      setScanning(false)
      const code = 'WH-CBR-001'
      confirmWarehouseCode(code)
      setPhase('bag_checkin')
    }, 800)
  }

  const handleWarehouseManual = () => {
    const code = warehouseInput.trim().toUpperCase() || 'WH-CBR-001'
    confirmWarehouseCode(code)
    setWarehouseInput('')
    setShowManualWH(false)
    setPhase('bag_checkin')
  }

  const handleBagScan = () => {
    setScanning(true)
    setTimeout(() => {
      setScanning(false)
      const code = `BAG-ROUTE-${String(checkedIn + 1).padStart(3, '0')}`
      checkinBagAtWarehouse(code)
      setLastChecked(code)
      if (checkedIn + 1 >= totalBags) {
        setTimeout(() => setPhase('complete'), 400)
      }
    }, 700)
  }

  const handleBagManual = () => {
    const code = bagInput.trim().toUpperCase()
    if (!code) return
    checkinBagAtWarehouse(code)
    setLastChecked(code)
    setBagInput('')
    setShowBagManual(false)
    if (checkedIn + 1 >= totalBags) {
      setTimeout(() => setPhase('complete'), 400)
    }
  }

  const handleDone = () => {
    clearDriverRoute()
    navigate('/dashboard/driver')
  }

  return (
    <div className="relative flex flex-col min-h-screen" style={{ background: '#060e24' }}>
      <div className="pointer-events-none absolute inset-0 grid-bg" style={{ zIndex: 0 }} />
      <div className="pointer-events-none absolute" style={{ bottom: 20, right: -40, width: 200, height: 200, background: 'rgba(0,190,255,0.25)', filter: 'blur(52px)', borderRadius: '50%', zIndex: 0 }} />

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
        <p style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Warehouse Check-in</p>
        <div style={{ width: 60 }} />
      </header>

      <main className="relative flex-1 overflow-y-auto pb-10" style={{ zIndex: 1 }}>

        {/* ── COMPLETE ────────────────────────────────── */}
        {showComplete ? (
          <>
            {/* Confetti */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 5 }}>
              {CONFETTI.map((p, i) => (
                <span
                  key={i}
                  style={{
                    position: 'absolute',
                    left: p.left,
                    top: '-20px',
                    fontSize: p.size,
                    animation: `confettiFall ${p.dur} ease-in ${p.delay} both`,
                    filter: p.cyan ? 'hue-rotate(0deg)' : 'hue-rotate(90deg)',
                  }}
                >
                  ♻️
                </span>
              ))}
            </div>

            <div className="flex flex-col items-center justify-center px-6 py-20 gap-5" style={{ position: 'relative', zIndex: 6 }}>
              <div
                style={{
                  width: 80, height: 80, borderRadius: '50%',
                  background: 'rgba(0,190,255,0.12)', border: '2px solid #00c8ff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 0 40px rgba(0,190,255,0.4)',
                  animation: 'badgePop 0.5s ease both',
                }}
              >
                <span style={{ fontSize: 38 }}>🎉</span>
              </div>

              <div className="text-center">
                <p style={{ fontSize: 24, fontWeight: 700, color: '#fff' }}>Route Complete!</p>
                <p style={{ fontSize: 14, color: A, marginTop: 8 }}>
                  All bags have been checked in successfully.
                </p>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
                  {totalBags} bag{totalBags !== 1 ? 's' : ''} checked in at Cyan's Brooklynn Warehouse
                </p>
              </div>

              <div
                className="w-full rounded-2xl p-4"
                style={{ background: GL, border: `1px solid ${BD}` }}
              >
                <div className="flex justify-between mb-2">
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Bags Checked In</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#4ade80' }}>{totalBags}/{totalBags}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Warehouse</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: A }}>{activeRoute.warehouseCode ?? 'WH-CBR-001'}</span>
                </div>
              </div>

              <button
                onClick={handleDone}
                className="w-full rounded-2xl py-4 text-sm font-bold text-white"
                style={{ background: 'linear-gradient(135deg,#0057e7,#00c8ff)', boxShadow: '0 4px 20px rgba(0,190,255,0.35)' }}
              >
                Done — Back to Pickups
              </button>
            </div>
          </>
        ) : phase === 'warehouse_qr' ? (
          /* ── WAREHOUSE QR PHASE ────────────── */
          <div className="px-5 pt-6 space-y-5">
            <div className="text-center space-y-1">
              <p style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>Scan Warehouse QR Code</p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Scan or enter the warehouse code to begin check-in</p>
            </div>

            {/* Fake QR viewfinder */}
            <div
              className="mx-auto flex items-center justify-center rounded-2xl"
              style={{ width: 220, height: 220, background: 'rgba(0,0,0,0.45)', border: `2px solid ${A}`, position: 'relative', overflow: 'hidden' }}
            >
              {[{ top: 0, left: 0 }, { top: 0, right: 0 }, { bottom: 0, left: 0 }, { bottom: 0, right: 0 }].map((pos, i) => (
                <div key={i} style={{
                  position: 'absolute', ...pos, width: 22, height: 22,
                  borderTop: i < 2 ? `3px solid ${A}` : undefined,
                  borderBottom: i >= 2 ? `3px solid ${A}` : undefined,
                  borderLeft: i % 2 === 0 ? `3px solid ${A}` : undefined,
                  borderRight: i % 2 === 1 ? `3px solid ${A}` : undefined,
                }} />
              ))}
              <div style={{
                position: 'absolute', left: 0, right: 0, height: 2,
                background: `linear-gradient(90deg,transparent,${A},transparent)`,
                animation: 'scanLine 1.8s ease-in-out infinite',
              }} />
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '0 20px' }}>
                🏭 Position warehouse QR here
              </span>
            </div>

            <button
              onClick={handleWarehouseScan}
              disabled={scanning}
              className="w-full rounded-2xl py-4 text-sm font-bold text-white disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg,#0057e7,#00c8ff)', boxShadow: '0 4px 20px rgba(0,190,255,0.3)' }}
            >
              {scanning ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Scanning…
                </span>
              ) : '📷 Scan Warehouse QR Code'}
            </button>

            {!showManualWH ? (
              <button
                onClick={() => setShowManualWH(true)}
                className="w-full rounded-xl py-2.5 text-sm font-medium"
                style={{ background: GL, border: `1px solid ${BD}`, color: 'rgba(0,210,255,0.6)' }}
              >
                Enter code manually →
              </button>
            ) : (
              <div className="space-y-3">
                <input
                  autoFocus
                  value={warehouseInput}
                  onChange={(e) => setWarehouseInput(e.target.value.toUpperCase())}
                  placeholder="e.g. WH-CBR-001"
                  className="w-full rounded-xl px-4 py-3 font-mono text-sm outline-none"
                  style={{ background: 'rgba(255,255,255,0.07)', border: `1px solid ${BD}`, color: '#fff' }}
                  onKeyDown={(e) => e.key === 'Enter' && handleWarehouseManual()}
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowManualWH(false)}
                    className="flex-1 rounded-xl py-2.5 text-sm font-medium"
                    style={{ background: GL, border: `1px solid ${BD}`, color: 'rgba(255,255,255,0.5)' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleWarehouseManual}
                    disabled={!warehouseInput.trim()}
                    className="flex-1 rounded-xl py-2.5 text-sm font-bold text-white disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg,#0057e7,#00c8ff)' }}
                  >
                    Confirm
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ── BAG CHECK-IN PHASE ────────────── */
          <div className="px-5 pt-6 space-y-5">
            {/* Progress */}
            <div
              className="rounded-2xl p-4"
              style={{ background: GL, border: `1px solid ${BD}` }}
            >
              <div className="flex items-center justify-between mb-3">
                <p style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Bag Check-In Progress</p>
                <span style={{ fontSize: 13, fontWeight: 700, color: allCheckedIn ? '#4ade80' : A }}>
                  {checkedIn}/{totalBags}
                </span>
              </div>
              <div className="rounded-full overflow-hidden" style={{ height: 6, background: 'rgba(255,255,255,0.08)' }}>
                <div
                  className="rounded-full transition-all"
                  style={{ height: '100%', width: `${totalBags > 0 ? (checkedIn / totalBags) * 100 : 0}%`, background: allCheckedIn ? '#4ade80' : `linear-gradient(90deg,#0057e7,${A})` }}
                />
              </div>
            </div>

            {lastChecked && (
              <div
                className="flex items-center gap-3 rounded-xl px-4 py-3"
                style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)' }}
              >
                <span style={{ fontSize: 18 }}>✅</span>
                <div>
                  <p style={{ fontSize: 12, color: '#4ade80', fontWeight: 600 }}>Checked in</p>
                  <p className="font-mono" style={{ fontSize: 13, color: '#fff' }}>{lastChecked}</p>
                </div>
              </div>
            )}

            <button
              onClick={handleBagScan}
              disabled={scanning || allCheckedIn}
              className="w-full rounded-2xl py-4 text-sm font-bold text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#0057e7,#00c8ff)', boxShadow: '0 4px 20px rgba(0,190,255,0.3)' }}
            >
              {scanning ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Scanning…
                </span>
              ) : '📷 Scan Bag'}
            </button>

            {!showBagManual ? (
              <button
                onClick={() => setShowBagManual(true)}
                disabled={allCheckedIn}
                className="w-full rounded-xl py-2.5 text-sm font-medium disabled:opacity-40"
                style={{ background: GL, border: `1px solid ${BD}`, color: 'rgba(0,210,255,0.6)' }}
              >
                ✏️ Manual Entry
              </button>
            ) : (
              <div className="space-y-3">
                <input
                  autoFocus
                  value={bagInput}
                  onChange={(e) => setBagInput(e.target.value.toUpperCase())}
                  placeholder="Enter bag code"
                  className="w-full rounded-xl px-4 py-3 font-mono text-sm outline-none"
                  style={{ background: 'rgba(255,255,255,0.07)', border: `1px solid ${BD}`, color: '#fff' }}
                  onKeyDown={(e) => e.key === 'Enter' && handleBagManual()}
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => { setBagInput(''); setShowBagManual(false) }}
                    className="flex-1 rounded-xl py-2.5 text-sm font-medium"
                    style={{ background: GL, border: `1px solid ${BD}`, color: 'rgba(255,255,255,0.5)' }}
                  >
                    Cancel
                  </button>
                  <button
                    disabled={!bagInput.trim()}
                    onClick={handleBagManual}
                    className="flex-1 rounded-xl py-2.5 text-sm font-bold text-white disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg,#0057e7,#00c8ff)' }}
                  >
                    Submit
                  </button>
                </div>
              </div>
            )}

            {/* Checked-in list */}
            {activeRoute.checkedInBags.length > 0 && (
              <div>
                <p className="section-label mb-3">CHECKED IN</p>
                <div className="space-y-1.5">
                  {activeRoute.checkedInBags.map((code) => (
                    <div
                      key={code}
                      className="flex items-center gap-3 rounded-xl px-4 py-2.5"
                      style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.2)' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      <p className="font-mono" style={{ fontSize: 13, color: '#fff' }}>{code}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
