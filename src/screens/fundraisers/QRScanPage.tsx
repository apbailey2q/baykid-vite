import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Html5Qrcode } from 'html5-qrcode'
import { supabase } from '../../lib/supabase'
import { claimBag, checkDuplicateScan } from '../../lib/bags'
import { useAuthStore } from '../../store/authStore'

// ── Types ─────────────────────────────────────────────────────────────────────

type ScanState = 'idle' | 'camera' | 'loading' | 'done' | 'error' | 'duplicate'

type ErrorKind =
  | 'not_found'
  | 'not_authenticated'
  | 'camera_denied'
  | 'network'

interface ScanResult {
  bagCode:          string
  bagId:            string
  estimatedValue:   number
  co2SavedLbs:      number
  pointsEarned:     number
  userAmount:       number
  fundraiserAmount: number
  fundraiser:       { name: string; emoji: string; percentToCause: number } | null
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function QRScanPage() {
  const navigate = useNavigate()
  const user     = useAuthStore(s => s.user)

  const [animate,         setAnimate]         = useState(false)
  const [scanState,       setScanState]       = useState<ScanState>('idle')
  const [showCelebration, setShowCelebration] = useState(false)
  const [soundOn,         setSoundOn]         = useState(true)
  const [showFlash,       setShowFlash]       = useState(false)
  const [codeInput,       setCodeInput]       = useState('')
  const [result,          setResult]          = useState<ScanResult | null>(null)
  const [_errorKind,      setErrorKind]       = useState<ErrorKind | null>(null)
  const [errorMsg,        setErrorMsg]        = useState('')

  const qrRef      = useRef<Html5Qrcode | null>(null)
  const handledRef = useRef(false) // prevent double-handling a scanned code

  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimate(true))
    return () => cancelAnimationFrame(id)
  }, [])

  // Stop camera on unmount
  useEffect(() => {
    return () => { void stopCamera() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const stopCamera = useCallback(async () => {
    if (qrRef.current) {
      try { await qrRef.current.stop() } catch { /* ignore */ }
      qrRef.current = null
    }
  }, [])

  const startCamera = async () => {
    setScanState('camera')
    handledRef.current = false

    // Let DOM render the qr-reader div before attaching
    await new Promise<void>(r => setTimeout(r, 80))

    try {
      const qr = new Html5Qrcode('qr-reader')
      await qr.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 200, height: 200 } },
        async (decodedText) => {
          if (handledRef.current) return
          handledRef.current = true
          await stopCamera()
          await processCode(decodedText)
        },
        undefined,
      )
      qrRef.current = qr
    } catch (err) {
      const msg = (err as Error).message ?? ''
      if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('denied')) {
        setErrorKind('camera_denied')
        setErrorMsg('Camera permission denied. Please enter the bag code manually.')
      } else {
        setErrorKind('network')
        setErrorMsg('Camera failed to start. Please enter the bag code manually.')
      }
      setScanState('error')
    }
  }

  const handleManualSubmit = async () => {
    const code = codeInput.trim()
    if (!code) return
    await processCode(code)
  }

  const processCode = async (rawCode: string) => {
    setScanState('loading')

    if (!user) {
      setErrorKind('not_authenticated')
      setErrorMsg('Please sign in to scan bags.')
      setScanState('error')
      return
    }

    try {
      const code = rawCode.trim().toUpperCase()

      // 1. Lookup bag with fundraiser join
      const { data: bagRow, error: bagErr } = await supabase
        .from('qr_bags')
        .select('*, fundraisers(*)')
        .eq('bag_code', code)
        .maybeSingle()

      if (bagErr) throw bagErr

      if (!bagRow) {
        setErrorKind('not_found')
        setErrorMsg(`No bag found for code "${code}". Please check the code and try again.`)
        setScanState('error')
        return
      }

      // 2. Duplicate scan check (5-minute window)
      const isDuplicate = await checkDuplicateScan(bagRow.id)
      if (isDuplicate) {
        setScanState('duplicate')
        return
      }

      // 3. Claim if unowned
      if (bagRow.owner_id === null) {
        await claimBag(bagRow.id, user.id, { city: null })
      }

      // 4. Reward calculation
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bag             = bagRow as any
      const estimatedValue: number = bag.estimated_value   ?? 0
      const co2SavedLbs:    number = bag.co2_saved_lbs    ?? 0
      const fundraiserRow:  any    = bag.fundraisers       ?? null // eslint-disable-line @typescript-eslint/no-explicit-any
      const percentToCause: number = fundraiserRow?.percent_to_cause ?? 0
      const fundraiserAmt:  number = parseFloat((estimatedValue * percentToCause / 100).toFixed(2))
      const userAmt:        number = parseFloat((estimatedValue - fundraiserAmt).toFixed(2))
      const pointsEarned:   number = Math.round(estimatedValue * 100)

      // 5. Record scan in bag_scans (includes fundraiser_id column added by migration)
      const { error: scanErr } = await supabase.from('bag_scans').insert({
        bag_id:       bagRow.id,
        scanned_by:   user.id,
        fundraiser_id: bag.fundraiser_id ?? null,
        location:     null,
      })
      if (scanErr) throw scanErr

      // 6. Fundraiser contribution + counter update
      if (fundraiserRow && bag.fundraiser_id) {
        await supabase.from('fundraiser_contributions').insert({
          fundraiser_id:  bag.fundraiser_id,
          contributor_id: user.id,
          bag_id:         bagRow.id,
          type:           'bag',
          amount:         fundraiserAmt,
        })

        // Read-then-increment fundraiser totals (safe for low-concurrency MVP)
        const { data: fr } = await supabase
          .from('fundraisers')
          .select('raised_amount, bag_count')
          .eq('id', bag.fundraiser_id)
          .single()

        if (fr) {
          await supabase.from('fundraisers').update({
            raised_amount: (fr.raised_amount ?? 0) + fundraiserAmt,
            bag_count:     (fr.bag_count     ?? 0) + 1,
          }).eq('id', bag.fundraiser_id)
        }
      }

      // 7. Consumer earning in wallet_transactions
      if (userAmt > 0) {
        await supabase.from('wallet_transactions').insert({
          user_id: user.id,
          bag_id:  bagRow.id,
          type:    'earning',
          amount:  userAmt,
          status:  'pending',
        })
      }

      // 8. Build result
      const scanResult: ScanResult = {
        bagCode:          bagRow.bag_code,
        bagId:            bagRow.id,
        estimatedValue,
        co2SavedLbs,
        pointsEarned,
        userAmount:       userAmt,
        fundraiserAmount: fundraiserAmt,
        fundraiser: fundraiserRow
          ? {
              name:           fundraiserRow.name           ?? 'Unknown Fundraiser',
              emoji:          fundraiserRow.emoji          ?? '🎯',
              percentToCause,
            }
          : null,
      }

      // 9. Flash → done → celebrate
      setResult(scanResult)
      setShowFlash(true)
      setTimeout(() => setShowFlash(false), 260)
      setScanState('done')
      setShowCelebration(true)
      setTimeout(() => setShowCelebration(false), 1600)

    } catch (err) {
      const msg = (err as Error).message ?? 'Unknown error'
      setErrorKind('network')
      setErrorMsg(msg)
      setScanState('error')
    }
  }

  const reset = async () => {
    await stopCamera()
    setResult(null)
    setErrorKind(null)
    setErrorMsg('')
    setCodeInput('')
    handledRef.current = false
    setScanState('idle')
  }

  const isIdle   = scanState === 'idle'
  const isCamera = scanState === 'camera'
  const isLoad   = scanState === 'loading'
  const isDone   = scanState === 'done'
  const isError  = scanState === 'error'
  const isDup    = scanState === 'duplicate'
  const isScan   = isCamera || isLoad // states where the scan beam animates fast

  const fade = (delay = 0): React.CSSProperties => ({
    opacity:    animate ? 1 : 0,
    transform:  animate ? 'translateY(0)' : 'translateY(14px)',
    transition: `opacity 0.4s ease ${delay}ms, transform 0.4s ease ${delay}ms`,
  })

  const bracketColor = isDone ? '#4ade80' : isError || isDup ? '#f87171' : '#00c8ff'

  const BRACKETS = [
    { top: 10, left: 10,  borderTop:    `3px solid ${bracketColor}`, borderLeft:   `3px solid ${bracketColor}`, borderRadius: '7px 0 0 0' },
    { top: 10, right: 10, borderTop:    `3px solid ${bracketColor}`, borderRight:  `3px solid ${bracketColor}`, borderRadius: '0 7px 0 0' },
    { bottom: 10, left:  10, borderBottom: `3px solid ${bracketColor}`, borderLeft:  `3px solid ${bracketColor}`, borderRadius: '0 0 0 7px' },
    { bottom: 10, right: 10, borderBottom: `3px solid ${bracketColor}`, borderRight: `3px solid ${bracketColor}`, borderRadius: '0 0 7px 0' },
  ] as const

  const scanResult  = result
  const fundraiser  = result?.fundraiser

  const resultRows = scanResult
    ? [
        { label: 'Bag Code',              value: scanResult.bagCode,                                    mono: true  },
        { label: 'Estimated Value',       value: `$${scanResult.estimatedValue.toFixed(2)}`,            mono: false },
        ...(fundraiser ? [
          { label: 'Fundraiser',          value: `${fundraiser.emoji} ${fundraiser.name}`,             mono: false, accent: true },
          { label: 'Fundraiser Receives', value: `$${scanResult.fundraiserAmount.toFixed(2)}`,         mono: false, accent: true },
        ] : []),
        { label: 'Your Earnings',         value: `$${scanResult.userAmount.toFixed(2)}`,               mono: false },
        { label: 'CO₂ Saved',             value: `${scanResult.co2SavedLbs.toFixed(1)} lbs`,           mono: false },
        { label: 'Points Earned',         value: scanResult.pointsEarned.toLocaleString(),             mono: false },
      ]
    : []

  return (
    <div
      className="relative min-h-screen flex flex-col overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}
    >
      {/* ── Camera flash overlay ── */}
      {showFlash && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{ background: 'rgba(255,255,255,0.88)', zIndex: 300, animation: 'flashFade 0.26s ease forwards' }}
        />
      )}

      {/* Background glows */}
      <div className="pointer-events-none absolute inset-0 grid-bg" />
      <div className="pointer-events-none absolute" style={{ top: -80, left: -60, width: 300, height: 300, background: 'rgba(0,87,231,0.3)', filter: 'blur(72px)', borderRadius: '50%' }} />
      <div className="pointer-events-none absolute" style={{ bottom: -60, right: -40, width: 240, height: 240, background: 'rgba(0,200,255,0.15)', filter: 'blur(64px)', borderRadius: '50%' }} />

      <div className="relative flex-1 overflow-y-auto pb-24" style={{ zIndex: 1 }}>
        <div className="max-w-[480px] mx-auto px-4 pt-10 pb-8">

          {/* ── Back ── */}
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

          {/* ── Header row ── */}
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
                <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {isDone   ? 'Scan complete'
                   : isCamera ? 'Align the bag QR code in frame'
                   : 'Enter bag code or use camera'}
                </p>
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
              <span className="text-[11px] font-semibold" style={{ color: soundOn ? '#00c8ff' : 'rgba(255,255,255,0.35)' }}>
                Sound: {soundOn ? 'On' : 'Off'}
              </span>
            </button>
          </div>

          {/* ── Camera frame area ── */}
          <div className="flex flex-col items-center mb-5" style={fade(80)}>

            {/* Status pill */}
            <div
              className="flex items-center gap-2 mb-3 px-3.5 py-1.5 rounded-full"
              style={{ background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)' }}
            >
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{
                  background: isDone           ? '#4ade80'
                            : isError || isDup ? '#f87171'
                            : isScan           ? '#ef4444'
                            : 'rgba(255,255,255,0.25)',
                  boxShadow:  isDone           ? '0 0 6px rgba(74,222,128,0.8)'
                            : isError || isDup ? '0 0 6px rgba(248,113,113,0.8)'
                            : isScan           ? '0 0 6px rgba(239,68,68,0.8)'
                            : 'none',
                  animation:  isScan ? 'recordDot 1s ease-in-out infinite' : 'none',
                  transition: 'background 0.3s ease, box-shadow 0.3s ease',
                }}
              />
              <span className="text-[11px] font-semibold tracking-wide" style={{ color: 'rgba(255,255,255,0.65)' }}>
                {isDone           ? 'Verified'
                 : isError        ? 'Scan Error'
                 : isDup          ? 'Duplicate'
                 : isCamera       ? 'Camera Mode'
                 : isLoad         ? 'Processing…'
                 : 'Ready'}
              </span>
              {isCamera && <span className="text-[9px] font-bold tracking-widest" style={{ color: 'rgba(255,255,255,0.25)' }}>HD</span>}
            </div>

            {/* ── Camera frame ── */}
            <div
              className="relative flex items-center justify-center"
              style={{
                width:          280,
                height:         280,
                background:     'linear-gradient(145deg, rgba(4,10,24,0.92) 0%, rgba(6,14,36,0.88) 100%)',
                border:         `2px solid ${
                  isDone           ? 'rgba(74,222,128,0.65)'
                  : isError || isDup ? 'rgba(248,113,113,0.65)'
                  : isScan         ? 'rgba(0,200,255,0.8)'
                  : 'rgba(0,200,255,0.38)'
                }`,
                borderRadius:   20,
                backdropFilter: 'blur(14px)',
                overflow:       'hidden',
                boxShadow:      isDone
                  ? '0 0 48px rgba(74,222,128,0.28), inset 0 0 60px rgba(74,222,128,0.05)'
                  : isError || isDup
                    ? '0 0 28px rgba(248,113,113,0.18), inset 0 0 40px rgba(248,113,113,0.04)'
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
                style={{ opacity: 0.09, zIndex: 2 }}
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
                  style={{ ...s, width: 28, height: 28, transition: 'border-color 0.4s ease', zIndex: 3 }}
                />
              ))}

              {/* Animated scan line (visible unless done/error/duplicate) */}
              {!isDone && !isError && !isDup && (
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
                    zIndex: 2,
                  }}
                />
              )}

              {/* html5-qrcode live camera feed */}
              {isCamera && (
                <div
                  id="qr-reader"
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1 }}
                />
              )}

              {/* Idle placeholder */}
              {isIdle && (
                <div className="flex flex-col items-center gap-3" style={{ opacity: 0.45 }}>
                  <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="rgba(0,200,255,0.6)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/>
                    <rect width="5" height="5" x="3" y="16" rx="1"/>
                    <path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/>
                    <path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/>
                    <path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v-1"/>
                  </svg>
                  <span className="font-mono text-[10px] font-medium tracking-widest" style={{ color: 'rgba(0,200,255,0.5)' }}>
                    READY TO SCAN
                  </span>
                </div>
              )}

              {/* Loading overlay */}
              {isLoad && (
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center gap-3"
                  style={{ background: 'rgba(4,10,24,0.75)', animation: 'fadeIn 0.2s ease', zIndex: 4 }}
                >
                  <span
                    className="w-8 h-8 rounded-full border-2 animate-spin"
                    style={{ borderColor: 'rgba(0,200,255,0.25)', borderTopColor: '#00c8ff' }}
                  />
                  <span className="text-[11px] font-semibold" style={{ color: '#00c8ff' }}>Processing scan…</span>
                </div>
              )}

              {/* Error / Duplicate overlay */}
              {(isError || isDup) && (
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6"
                  style={{ background: 'rgba(4,10,24,0.75)', animation: 'fadeIn 0.3s ease', zIndex: 4 }}
                >
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center mb-1"
                    style={{ background: 'rgba(248,113,113,0.15)', border: '2px solid rgba(248,113,113,0.4)', boxShadow: '0 0 28px rgba(248,113,113,0.2)', animation: 'popIn 0.45s cubic-bezier(0.34,1.56,0.64,1)' }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      {isDup
                        ? <path d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 0 1 0 12h-3"/>
                        : <path d="M18 6L6 18M6 6l12 12"/>
                      }
                    </svg>
                  </div>
                  <p className="text-xs font-bold text-center" style={{ color: '#f87171' }}>
                    {isDup ? 'Already Scanned' : 'Scan Failed'}
                  </p>
                  <p className="text-[10px] text-center leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    {isDup
                      ? 'This bag was scanned recently. Each bag can only be scanned once per 5 minutes.'
                      : errorMsg}
                  </p>
                </div>
              )}

              {/* Verified checkmark */}
              {isDone && (
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  style={{ background: 'rgba(74,222,128,0.06)', animation: 'fadeIn 0.3s ease', zIndex: 4 }}
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

            {/* Bottom status label */}
            <p className="text-[11px] mt-3 text-center">
              {isDone
                ? <span style={{ color: '#4ade80', fontWeight: 700 }}>QR Bag Verified ✓</span>
                : isError
                  ? <span style={{ color: '#f87171' }}>Tap "Try Again" to retry</span>
                  : isDup
                    ? <span style={{ color: '#f87171' }}>Duplicate scan blocked</span>
                    : <span style={{ color: isScan ? 'rgba(0,200,255,0.6)' : 'rgba(255,255,255,0.35)' }}>
                        {isCamera ? 'Align QR bag code inside the frame'
                         : isLoad   ? 'Processing scan…'
                         : 'Enter bag code or tap "Use Camera"'}
                      </span>
              }
            </p>
          </div>

          {/* ── Manual entry + camera button (idle / error / duplicate) ── */}
          {(isIdle || isError || isDup) && (
            <div style={fade(110)} className="flex flex-col gap-3">
              <div
                className="rounded-2xl p-4"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.28)' }}>
                  {isError || isDup ? 'Try Again' : 'Enter Bag Code'}
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={codeInput}
                    onChange={e => setCodeInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') void handleManualSubmit() }}
                    placeholder="e.g. CB-NASH-000421"
                    className="flex-1 rounded-xl px-3.5 py-2.5 text-sm font-mono"
                    style={{
                      background:    'rgba(0,0,0,0.35)',
                      border:        '1px solid rgba(0,200,255,0.22)',
                      color:         '#ffffff',
                      outline:       'none',
                      letterSpacing: '0.04em',
                    }}
                  />
                  <button
                    onClick={() => void handleManualSubmit()}
                    disabled={!codeInput.trim()}
                    className="px-4 rounded-xl text-sm font-semibold transition-all"
                    style={{
                      background: codeInput.trim() ? 'linear-gradient(135deg, #0057e7, #00c8ff)' : 'rgba(0,200,255,0.08)',
                      color:      codeInput.trim() ? '#ffffff' : 'rgba(0,200,255,0.4)',
                      border:     codeInput.trim() ? 'none' : '1px solid rgba(0,200,255,0.15)',
                      cursor:     codeInput.trim() ? 'pointer' : 'not-allowed',
                    }}
                  >
                    Scan
                  </button>
                </div>
              </div>

              <button
                onClick={() => void startCamera()}
                className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl font-semibold text-sm transition-all"
                style={{
                  background: 'linear-gradient(135deg, #0057e7, #00c8ff)',
                  color:      '#ffffff',
                  border:     'none',
                  cursor:     'pointer',
                  boxShadow:  '0 4px 28px rgba(0,190,255,0.32)',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
                  <circle cx="12" cy="13" r="3"/>
                </svg>
                Use Camera
              </button>
            </div>
          )}

          {/* ── Camera active — stop button ── */}
          {isCamera && (
            <div style={fade(110)}>
              <button
                onClick={async () => { await stopCamera(); setScanState('idle') }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-medium transition-all"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="6" y="6" width="12" height="12" rx="2"/>
                </svg>
                Stop Camera
              </button>
            </div>
          )}

          {/* ── Verified result ── */}
          {isDone && scanResult && (
            <div style={{ animation: 'slideUp 0.4s ease' }}>

              {/* Success header */}
              <div className="text-center mb-4">
                <p className="text-xl font-bold mb-0.5" style={{ color: '#4ade80' }}>QR Bag Verified ✓</p>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Scan complete — results below</p>
              </div>

              {/* Duplicate prevention badge */}
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
                  { icon: '🌿', label: `${scanResult.co2SavedLbs.toFixed(1)} lbs CO₂`                                                          },
                  { icon: '⭐', label: `${scanResult.pointsEarned} pts`                                                                         },
                  fundraiser
                    ? { icon: '💰', label: `+$${scanResult.fundraiserAmount.toFixed(2)} to cause` }
                    : { icon: '💰', label: `+$${scanResult.userAmount.toFixed(2)} earned`         },
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
                  to="/live-inspection"
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-sm"
                  style={{ background: 'linear-gradient(135deg, #0057e7, #00c8ff)', color: '#ffffff' }}
                >
                  Continue to Bag Inspection
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </Link>
                <button
                  onClick={() => void reset()}
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

      {/* ── Celebration burst ── */}
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
          0%   { opacity: 1; transform: translateY(0)      scale(1);   }
          20%  { opacity: 1; }
          100% { opacity: 0; transform: translateY(-130px) scale(0.5); }
        }
        @keyframes impactPop {
          0%   { opacity: 0; transform: translate(-50%,-50%) scale(0.4);  }
          30%  { opacity: 1; transform: translate(-50%,-50%) scale(1.08); }
          55%  {             transform: translate(-50%,-50%) scale(0.97); }
          70%  { opacity: 1; transform: translate(-50%,-50%) scale(1);    }
          100% { opacity: 0; transform: translate(-50%,-50%) scale(0.9);  }
        }
        #qr-reader video { width: 100% !important; height: 100% !important; object-fit: cover; }
        #qr-reader { border: none !important; }
        #qr-reader img { display: none; }
        #qr-reader__scan_region { border: none !important; }
        #qr-reader__header_message { display: none; }
        #qr-reader__status_span    { display: none; }
      `}</style>
    </div>
  )
}
