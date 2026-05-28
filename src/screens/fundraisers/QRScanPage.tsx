import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
// TODO: Replace with real scan data from route state or Supabase query
const demoScanRewardSplit = {
  bagId: 'BAG-DEMO0001',
  totalEarnings: 1.40,
  co2Saved: 2.1,
  pointsEarned: 140,
  userAmount: 0.98,
  fundraiserAmount: 0.42,
}
const activeFundraiser = {
  emoji: '🏀',
  name: 'East Nashville High Basketball',
  percentToCause: 30,
}

type ScanState = 'idle' | 'scanning' | 'verified'

// ── Fake QR block ─────────────────────────────────────────────────────────────
function FakeQR() {
  return (
    <svg width="100" height="100" viewBox="0 0 24 24" opacity={0.8}>
      {/* Top-left finder */}
      <rect x="1" y="1" width="7" height="7" fill="none" stroke="rgba(0,200,255,0.9)" strokeWidth="0.7" rx="0.4"/>
      <rect x="2.5" y="2.5" width="4" height="4" fill="none" stroke="rgba(0,200,255,0.9)" strokeWidth="0.4"/>
      <rect x="3.5" y="3.5" width="2" height="2" fill="rgba(0,200,255,0.95)"/>
      {/* Top-right finder */}
      <rect x="16" y="1" width="7" height="7" fill="none" stroke="rgba(0,200,255,0.9)" strokeWidth="0.7" rx="0.4"/>
      <rect x="17.5" y="2.5" width="4" height="4" fill="none" stroke="rgba(0,200,255,0.9)" strokeWidth="0.4"/>
      <rect x="18.5" y="3.5" width="2" height="2" fill="rgba(0,200,255,0.95)"/>
      {/* Bottom-left finder */}
      <rect x="1" y="16" width="7" height="7" fill="none" stroke="rgba(0,200,255,0.9)" strokeWidth="0.7" rx="0.4"/>
      <rect x="2.5" y="17.5" width="4" height="4" fill="none" stroke="rgba(0,200,255,0.9)" strokeWidth="0.4"/>
      <rect x="3.5" y="18.5" width="2" height="2" fill="rgba(0,200,255,0.95)"/>
      {/* Timing pattern */}
      {[9,11,13].map(x => <rect key={`tx${x}`} x={x} y="8" width="1.2" height="1.2" fill="rgba(0,200,255,0.6)" rx="0.1"/>)}
      {[9,11,13].map(y => <rect key={`ty${y}`} x="8" y={y} width="1.2" height="1.2" fill="rgba(0,200,255,0.6)" rx="0.1"/>)}
      {/* Data modules */}
      {[
        [9,1],[11,1],[13,1],[10,2],[12,2],[9,3],[13,3],[11,5],[9,6],[13,6],
        [1,9],[3,9],[5,9],[9,10],[11,10],[13,10],[15,10],[17,10],[19,10],[21,10],
        [1,11],[5,11],[9,12],[13,12],[17,12],[21,12],
        [1,13],[3,13],[7,13],[11,13],[15,13],[19,13],
        [9,16],[11,16],[15,16],[17,16],[21,16],
        [10,17],[13,17],[15,17],[19,17],
        [9,18],[11,18],[13,18],[17,18],[21,18],
        [10,19],[14,19],[16,19],[20,19],
        [9,20],[13,20],[17,20],[21,20],
      ].map(([x, y], i) => (
        <rect key={i} x={x} y={y} width="1.3" height="1.3" fill="rgba(0,200,255,0.78)" rx="0.15"/>
      ))}
    </svg>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function QRScanPage() {
  const navigate = useNavigate()
  const [animate, setAnimate]               = useState(false)
  const [scanState, setScanState]           = useState<ScanState>('idle')
  const [showCelebration, setShowCelebration] = useState(false)
  const [soundOn, setSoundOn]               = useState(true)
  const [showFlash, setShowFlash]           = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimate(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const handleScan = () => {
    if (scanState !== 'idle') return
    setScanState('scanning')
    setTimeout(() => {
      // Camera flash shutter effect
      setShowFlash(true)
      setTimeout(() => setShowFlash(false), 260)
      setScanState('verified')
      setShowCelebration(true)
      setTimeout(() => setShowCelebration(false), 1600)
    }, 1050)
  }

  const reset = () => setScanState('idle')

  const scan    = demoScanRewardSplit
  const fund    = activeFundraiser
  const isIdle  = scanState === 'idle'
  const isScan  = scanState === 'scanning'
  const isDone  = scanState === 'verified'

  const fade = (delay = 0): React.CSSProperties => ({
    opacity:    animate ? 1 : 0,
    transform:  animate ? 'translateY(0)' : 'translateY(14px)',
    transition: `opacity 0.4s ease ${delay}ms, transform 0.4s ease ${delay}ms`,
  })

  const resultRows = [
    { label: 'Bag ID',              value: scan.bagId,                              mono: true  },
    { label: 'Warehouse',           value: 'NASH-01',                               mono: true  },
    { label: 'Estimated Value',     value: `$${scan.totalEarnings.toFixed(2)}`,     mono: false },
    { label: 'Fundraiser',          value: fund.name,                               mono: false, accent: true },
    { label: 'Fundraiser Receives', value: `$${scan.fundraiserAmount.toFixed(2)}`,  mono: false, accent: true },
    { label: 'CO₂ Saved',           value: `${scan.co2Saved} lbs`,                 mono: false },
    { label: 'Points Earned',       value: scan.pointsEarned.toLocaleString(),      mono: false },
  ]

  // ── Corner bracket factory ─────────────────────────────────────────────────
  const bracketColor = isDone ? '#4ade80' : '#00c8ff'
  const BRACKETS = [
    { top: 10, left: 10,  borderTop: `3px solid ${bracketColor}`, borderLeft:   `3px solid ${bracketColor}`, borderRadius: '7px 0 0 0' },
    { top: 10, right: 10, borderTop: `3px solid ${bracketColor}`, borderRight:  `3px solid ${bracketColor}`, borderRadius: '0 7px 0 0' },
    { bottom: 10, left:  10, borderBottom: `3px solid ${bracketColor}`, borderLeft:  `3px solid ${bracketColor}`, borderRadius: '0 0 0 7px' },
    { bottom: 10, right: 10, borderBottom: `3px solid ${bracketColor}`, borderRight: `3px solid ${bracketColor}`, borderRadius: '0 0 7px 0' },
  ] as const

  return (
    <div
      className="relative min-h-screen flex flex-col overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}
    >
      {/* ── Camera flash overlay ───────────────────────────────────────────────── */}
      {showFlash && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{ background: 'rgba(255,255,255,0.88)', zIndex: 300, animation: 'flashFade 0.26s ease forwards' }}
        />
      )}

      {/* Background */}
      <div className="pointer-events-none absolute inset-0 grid-bg" />
      <div className="pointer-events-none absolute" style={{ top: -80, left: -60, width: 300, height: 300, background: 'rgba(0,87,231,0.3)', filter: 'blur(72px)', borderRadius: '50%' }} />
      <div className="pointer-events-none absolute" style={{ bottom: -60, right: -40, width: 240, height: 240, background: 'rgba(0,200,255,0.15)', filter: 'blur(64px)', borderRadius: '50%' }} />

      <div className="relative flex-1 overflow-y-auto pb-24" style={{ zIndex: 1 }}>
        <div className="max-w-[480px] mx-auto px-4 pt-10 pb-8">

          {/* Back */}
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm mb-6 hover:opacity-70 transition-opacity"
            style={{ ...fade(0), color: 'rgba(255,255,255,0.45)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            Back
          </button>

          {/* ── Header row ────────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between mb-5" style={fade(40)}>
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(0,200,255,0.12)', border: '1px solid rgba(0,200,255,0.3)', boxShadow: '0 0 16px rgba(0,200,255,0.2)' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00c8ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/>
                  <rect width="5" height="5" x="3" y="16" rx="1"/>
                  <path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/>
                  <path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/>
                  <path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v-1"/>
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold leading-tight" style={{ color: '#ffffff' }}>QR Bag Scan</h1>
                <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Simulate a camera scan</p>
              </div>
            </div>

            {/* Sound toggle */}
            <button
              onClick={() => setSoundOn(s => !s)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all"
              style={{
                background: soundOn ? 'rgba(0,200,255,0.1)' : 'rgba(255,255,255,0.05)',
                border:     soundOn ? '1px solid rgba(0,200,255,0.3)' : '1px solid rgba(255,255,255,0.1)',
                cursor:     'pointer',
              }}
            >
              <span style={{ fontSize: 12, lineHeight: 1 }}>{soundOn ? '🔊' : '🔇'}</span>
              <span
                className="text-[11px] font-semibold"
                style={{ color: soundOn ? '#00c8ff' : 'rgba(255,255,255,0.35)' }}
              >
                Sound: {soundOn ? 'On' : 'Off'}
              </span>
            </button>
          </div>

          {/* ── Camera Mode scanner ───────────────────────────────────────────── */}
          <div className="flex flex-col items-center mb-5" style={fade(80)}>

            {/* "Camera Mode" top label */}
            <div
              className="flex items-center gap-2 mb-3 px-3.5 py-1.5 rounded-full"
              style={{ background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)' }}
            >
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{
                  background: isDone ? '#4ade80' : isScan ? '#ef4444' : 'rgba(255,255,255,0.25)',
                  boxShadow:  isDone ? '0 0 6px rgba(74,222,128,0.8)' : isScan ? '0 0 6px rgba(239,68,68,0.8)' : 'none',
                  animation:  isScan ? 'recordDot 1s ease-in-out infinite' : 'none',
                  transition: 'background 0.3s ease, box-shadow 0.3s ease',
                }}
              />
              <span className="text-[11px] font-semibold tracking-wide" style={{ color: 'rgba(255,255,255,0.65)' }}>
                Camera Mode
              </span>
              <span className="text-[9px] font-bold tracking-widest" style={{ color: 'rgba(255,255,255,0.25)' }}>HD</span>
            </div>

            {/* ── Camera frame ──────────────────────────────────────────────── */}
            <div
              className="relative flex items-center justify-center"
              style={{
                width:          280,
                height:         280,
                background:     'linear-gradient(145deg, rgba(4,10,24,0.92) 0%, rgba(6,14,36,0.88) 100%)',
                border:         `2px solid ${isDone ? 'rgba(74,222,128,0.65)' : isScan ? 'rgba(0,200,255,0.8)' : 'rgba(0,200,255,0.38)'}`,
                borderRadius:   20,
                backdropFilter: 'blur(14px)',
                overflow:       'hidden',
                boxShadow:      isDone
                  ? '0 0 48px rgba(74,222,128,0.28), inset 0 0 60px rgba(74,222,128,0.05)'
                  : isScan
                    ? '0 0 48px rgba(0,200,255,0.35), inset 0 0 60px rgba(0,87,231,0.12)'
                    : '0 0 28px rgba(0,200,255,0.12), inset 0 0 40px rgba(0,87,231,0.06)',
                transition:     'border-color 0.4s ease, box-shadow 0.4s ease',
              }}
            >
              {/* Camera grid overlay */}
              <svg
                className="absolute inset-0 pointer-events-none"
                width="100%"
                height="100%"
                style={{ opacity: 0.09 }}
              >
                <line x1="33%" y1="0"   x2="33%" y2="100%" stroke="white" strokeWidth="0.6" />
                <line x1="66%" y1="0"   x2="66%" y2="100%" stroke="white" strokeWidth="0.6" />
                <line x1="0"   y1="33%" x2="100%" y2="33%" stroke="white" strokeWidth="0.6" />
                <line x1="0"   y1="66%" x2="100%" y2="66%" stroke="white" strokeWidth="0.6" />
              </svg>

              {/* Corner brackets */}
              {BRACKETS.map((s, i) => (
                <div
                  key={i}
                  className="absolute"
                  style={{ ...s, width: 28, height: 28, transition: 'border-color 0.4s ease' }}
                />
              ))}

              {/* Animated scan line — hidden once verified */}
              {!isDone && (
                <div
                  className="absolute left-2 right-2"
                  style={{
                    height:     2,
                    background: 'linear-gradient(90deg, transparent 0%, rgba(0,200,255,0.95) 50%, transparent 100%)',
                    boxShadow:  '0 0 12px rgba(0,200,255,0.7), 0 0 24px rgba(0,200,255,0.3)',
                    top:        0,
                    animation:  isScan
                      ? 'scanBeam 0.85s ease-in-out infinite'
                      : 'scanBeamIdle 3.2s ease-in-out infinite',
                  }}
                />
              )}

              {/* QR block (idle + scanning, fades while scanning) */}
              {!isDone && (
                <div
                  className="flex flex-col items-center gap-3"
                  style={{ opacity: isScan ? 0.45 : 1, transition: 'opacity 0.35s ease' }}
                >
                  <FakeQR />
                  <span
                    className="font-mono text-[10px] font-medium tracking-widest"
                    style={{ color: 'rgba(0,200,255,0.6)', letterSpacing: '0.08em' }}
                  >
                    CB-NASH-000421
                  </span>
                </div>
              )}

              {/* Scanning spinner overlay */}
              {isScan && (
                <div
                  className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-2"
                  style={{ animation: 'fadeIn 0.2s ease' }}
                >
                  <span
                    className="w-3 h-3 rounded-full border-2 animate-spin"
                    style={{ borderColor: 'rgba(0,200,255,0.25)', borderTopColor: '#00c8ff' }}
                  />
                  <span className="text-[11px] font-semibold" style={{ color: '#00c8ff' }}>
                    Scanning QR code…
                  </span>
                </div>
              )}

              {/* Verified checkmark */}
              {isDone && (
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  style={{ background: 'rgba(74,222,128,0.06)', animation: 'fadeIn 0.3s ease' }}
                >
                  <div
                    className="w-20 h-20 rounded-full flex items-center justify-center"
                    style={{
                      background: 'rgba(74,222,128,0.18)',
                      border:     '2px solid rgba(74,222,128,0.55)',
                      boxShadow:  '0 0 48px rgba(74,222,128,0.35)',
                      animation:  'popIn 0.45s cubic-bezier(0.34,1.56,0.64,1)',
                    }}
                  >
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom label */}
            <p className="text-[11px] mt-3 text-center">
              {isDone
                ? <span style={{ color: '#4ade80', fontWeight: 700 }}>QR Bag Verified ✓</span>
                : <span style={{ color: isScan ? 'rgba(0,200,255,0.6)' : 'rgba(255,255,255,0.35)' }}>
                    {isScan ? 'Scanning QR code…' : 'Align QR bag code inside the frame'}
                  </span>
              }
            </p>
          </div>

          {/* ── Scan Accuracy Card ────────────────────────────────────────────── */}
          {!isDone && (
            <div
              className="rounded-2xl p-4 mb-4"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', ...fade(110) }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.28)' }}>
                Scan Accuracy
              </p>
              <div className="flex flex-col gap-2.5">
                {[
                  { label: 'QR Detection',        value: '99%',      color: '#00c8ff' },
                  { label: 'Bag Match',            value: 'Verified', color: '#5eead4' },
                  { label: 'Duplicate Scan Check', value: 'Passed',   color: '#4ade80' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background: item.color, boxShadow: `0 0 5px ${item.color}` }}
                      />
                      <span className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>{item.label}</span>
                    </div>
                    <span className="text-xs font-semibold" style={{ color: item.color }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Scan button ───────────────────────────────────────────────────── */}
          {!isDone && (
            <div style={fade(150)}>
              <button
                onClick={handleScan}
                disabled={isScan}
                className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl font-semibold text-sm transition-all"
                style={{
                  background: isScan
                    ? 'rgba(0,200,255,0.08)'
                    : 'linear-gradient(135deg, #0057e7, #00c8ff)',
                  color:      isScan ? '#00c8ff' : '#ffffff',
                  border:     isScan ? '1px solid rgba(0,200,255,0.25)' : 'none',
                  cursor:     isScan ? 'not-allowed' : 'pointer',
                  boxShadow:  isIdle ? '0 4px 28px rgba(0,190,255,0.32)' : 'none',
                }}
              >
                {isScan ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(0,200,255,0.3)', borderTopColor: '#00c8ff' }} />
                    Scanning QR code…
                  </>
                ) : (
                  <>
                    {/* Camera shutter icon */}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
                      <circle cx="12" cy="13" r="3"/>
                    </svg>
                    Simulate Camera Scan
                  </>
                )}
              </button>
            </div>
          )}

          {/* ── Verified result ───────────────────────────────────────────────── */}
          {isDone && (
            <div style={{ animation: 'slideUp 0.4s ease' }}>

              {/* Success header */}
              <div className="text-center mb-4">
                <p className="text-xl font-bold mb-0.5" style={{ color: '#4ade80' }}>QR Bag Verified ✓</p>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Scan complete — results below</p>
              </div>

              {/* Duplicate scan prevention badge */}
              <div
                className="flex items-center gap-2.5 rounded-xl px-4 py-2.5 mb-4"
                style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.22)' }}
              >
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.35)' }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
                <p className="text-[11px] font-medium" style={{ color: '#4ade80' }}>
                  Duplicate scan prevented by QR bag ID
                </p>
              </div>

              {/* Result card */}
              <div
                className="rounded-2xl overflow-hidden mb-4"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(0,190,255,0.18)' }}
              >
                <div
                  className="flex items-center gap-3 px-5 py-4"
                  style={{ background: 'rgba(0,87,231,0.12)', borderBottom: '1px solid rgba(0,190,255,0.1)' }}
                >
                  <span style={{ fontSize: 22 }}>📦</span>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest mb-0.5" style={{ color: 'rgba(0,200,255,0.7)' }}>
                      Scan Result
                    </p>
                    <p className="text-sm font-bold" style={{ color: '#ffffff' }}>QR Bag Verified</p>
                  </div>
                </div>

                {resultRows.map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between px-5 py-3"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{row.label}</span>
                    <span
                      className={row.mono ? 'font-mono' : ''}
                      style={{
                        fontSize:   row.mono ? 11 : 12,
                        fontWeight: 600,
                        color:      (row as { accent?: boolean }).accent ? '#00c8ff' : '#ffffff',
                        maxWidth:   '55%',
                        textAlign:  'right',
                      }}
                    >
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Impact chips */}
              <div className="flex gap-2 mb-5">
                {[
                  { icon: '🌿', label: `${scan.co2Saved} lbs CO₂` },
                  { icon: '⭐', label: `${scan.pointsEarned} pts` },
                  { icon: '💰', label: `+$${scan.fundraiserAmount.toFixed(2)} to cause` },
                ].map((chip) => (
                  <div
                    key={chip.label}
                    className="flex-1 flex flex-col items-center gap-1 rounded-xl py-2.5"
                    style={{ background: 'rgba(0,200,128,0.07)', border: '1px solid rgba(0,200,128,0.2)' }}
                  >
                    <span style={{ fontSize: 16 }}>{chip.icon}</span>
                    <span style={{ fontSize: 10, color: '#5eead4', fontWeight: 600, textAlign: 'center', lineHeight: 1.3 }}>
                      {chip.label}
                    </span>
                  </div>
                ))}
              </div>

              {/* CTAs */}
              <div className="flex flex-col gap-3">
                <Link
                  to="/bag-inspection"
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-sm"
                  style={{ background: 'linear-gradient(135deg, #0057e7, #00c8ff)', color: '#ffffff' }}
                >
                  Continue to Bag Inspection
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </Link>
                <button
                  onClick={reset}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-medium"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)', cursor: 'pointer' }}
                >
                  <span>♻️</span>
                  Scan Another Bag
                </button>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── Celebration burst ─────────────────────────────────────────────────── */}
      {showCelebration && (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{ zIndex: 50, pointerEvents: 'none' }}
        >
          {[
            { e: '💰', x: -90,  delay: 0   },
            { e: '♻️', x:  0,   delay: 60  },
            { e: '🌱', x:  90,  delay: 120 },
            { e: '💵', x: -45,  delay: 30  },
            { e: '🎉', x:  45,  delay: 90  },
            { e: '💰', x: -120, delay: 160 },
            { e: '🌱', x:  120, delay: 45  },
          ].map((item, i) => (
            <div
              key={i}
              style={{
                position:        'absolute',
                fontSize:        26,
                top:             '42%',
                left:            '50%',
                marginLeft:      item.x,
                animation:       `celebBurst 1.4s ease-out ${item.delay}ms forwards`,
                transformOrigin: 'center bottom',
              }}
            >
              {item.e}
            </div>
          ))}
          <div
            style={{
              position:   'absolute',
              top:        '38%',
              left:       '50%',
              transform:  'translate(-50%, -50%)',
              animation:  'impactPop 1.5s ease forwards',
              whiteSpace: 'nowrap',
              textAlign:  'center',
            }}
          >
            <div
              style={{
                background:   'rgba(0,0,0,0.72)',
                border:       '1px solid rgba(0,200,128,0.5)',
                borderRadius: 16,
                padding:      '10px 22px',
                boxShadow:    '0 0 36px rgba(0,200,128,0.35)',
              }}
            >
              <span
                style={{
                  fontSize:             20,
                  fontWeight:           700,
                  background:           'linear-gradient(90deg, #00c8ff, #5eead4)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor:  'transparent',
                } as React.CSSProperties}
              >
                Impact Created!
              </span>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes scanBeam {
          0%   { transform: translateY(0px);   opacity: 0; }
          8%   { opacity: 1; }
          88%  { opacity: 1; }
          100% { transform: translateY(248px); opacity: 0; }
        }
        @keyframes scanBeamIdle {
          0%,100% { transform: translateY(32px);  opacity: 0.28; }
          50%      { transform: translateY(140px); opacity: 0.5;  }
        }
        @keyframes recordDot {
          0%,100% { opacity: 1;   }
          50%      { opacity: 0.2; }
        }
        @keyframes popIn {
          0%   { transform: scale(0.35); opacity: 0; }
          65%  { transform: scale(1.12); opacity: 1; }
          100% { transform: scale(1);    opacity: 1; }
        }
        @keyframes flashFade {
          0%   { opacity: 0.88; }
          100% { opacity: 0;    }
        }
        @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes celebBurst {
          0%   { opacity: 1; transform: translateY(0)      scale(1);    }
          20%  { opacity: 1; }
          100% { opacity: 0; transform: translateY(-130px) scale(0.5);  }
        }
        @keyframes impactPop {
          0%   { opacity: 0; transform: translate(-50%,-50%) scale(0.4);  }
          30%  { opacity: 1; transform: translate(-50%,-50%) scale(1.08); }
          55%  {             transform: translate(-50%,-50%) scale(0.97); }
          70%  { opacity: 1; transform: translate(-50%,-50%) scale(1);    }
          100% { opacity: 0; transform: translate(-50%,-50%) scale(0.9);  }
        }
      `}</style>
    </div>
  )
}
