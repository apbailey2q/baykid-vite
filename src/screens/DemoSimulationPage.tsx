import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

const STEP_DURATION = 4000
const TICK_MS = 50
const TICK_INCREMENT = (TICK_MS / STEP_DURATION) * 100
const STEP_COUNT = 5

// ── Data ─────────────────────────────────────────────────────────────────────
const ACCEPTED  = 6
const CAUTION   = 2
const REJECTED  = 7
const TOTAL_BAGS = ACCEPTED + CAUTION + REJECTED  // 15
const PAYABLE    = ACCEPTED + CAUTION              // 8

type BagResult = 'accepted' | 'caution' | 'rejected'

// 6 accepted, 2 caution, 7 rejected — verified
const BAG_RESULTS: BagResult[] = [
  'accepted', 'accepted', 'caution',  'rejected', 'accepted',
  'rejected', 'caution',  'rejected', 'accepted', 'rejected',
  'rejected', 'accepted', 'rejected', 'accepted', 'rejected',
]

const STOPS = [
  { address: '114 S 11th St',      bags: 3 },
  { address: '832 Chicamauga Ave', bags: 4 },
  { address: '1409 McGavock Pike', bags: 4 },
  { address: '407 S 14th St',      bags: 4 },
]

interface GuideConfig { text: string; top: number; left: number }

const GUIDE_CONFIGS: GuideConfig[] = [
  { text: 'Alex taps "Schedule 15 Bags"',                  top: 255, left: 20  },
  { text: 'Bertha accepts the 4-stop route',               top: 185, left: 155 },
  { text: 'Bertha completes all 4 stops — 15 bags ready',  top: 200, left: 16  },
  { text: 'Key scans 15 bags — 8 pass inspection',         top: 115, left: 16  },
  { text: '8 bags × $5.00 — $40.00 payout processed',      top: 240, left: 100 },
]

const STEP_ICONS  = ['♻️', '🚐', '📦', '🏭', '💰']
const STEP_PEOPLE = ['Alex', 'Bertha', 'Bertha', 'Key', 'Payout']

// ── Main ──────────────────────────────────────────────────────────────────────
export default function DemoSimulationPage() {
  const navigate = useNavigate()
  const [step,        setStep]        = useState(0)
  const [progress,    setProgress]    = useState(0)
  const [isPlaying,   setIsPlaying]   = useState(true)
  const [scannedBags, setScannedBags] = useState<Array<{ code: string; result: BagResult }>>([])

  const stepRef     = useRef(0)
  const progressRef = useRef(0)
  const playingRef  = useRef(true)

  useEffect(() => { playingRef.current = isPlaying }, [isPlaying])

  // Auto-advance ticker
  useEffect(() => {
    const id = setInterval(() => {
      if (!playingRef.current) return
      const next = progressRef.current + TICK_INCREMENT
      if (next >= 100) {
        const nextStep = stepRef.current + 1
        if (nextStep >= STEP_COUNT) {
          playingRef.current = false
          setIsPlaying(false)
          progressRef.current = 100
          setProgress(100)
          return
        }
        stepRef.current     = nextStep
        progressRef.current = 0
        setStep(nextStep)
        setProgress(0)
      } else {
        progressRef.current = next
        setProgress(next)
      }
    }, TICK_MS)
    return () => clearInterval(id)
  }, [])

  // Bag scan animation — triggered when entering warehouse step (3)
  useEffect(() => {
    if (step !== 3) { setScannedBags([]); return }
    setScannedBags([])
    let idx = 0
    const id = setInterval(() => {
      if (idx >= TOTAL_BAGS) { clearInterval(id); return }
      const i = idx
      setScannedBags(prev => [...prev, {
        code:   `CBR-D${String(i + 1).padStart(3, '0')}`,
        result: BAG_RESULTS[i],
      }])
      idx++
    }, 220)
    return () => clearInterval(id)
  }, [step])

  const goToStep = useCallback((n: number) => {
    const clamped = Math.max(0, Math.min(STEP_COUNT - 1, n))
    stepRef.current     = clamped
    progressRef.current = 0
    setStep(clamped)
    setProgress(0)
  }, [])

  const restart = useCallback(() => {
    goToStep(0)
    playingRef.current = true
    setIsPlaying(true)
  }, [goToStep])

  const togglePlay = useCallback(() => {
    setIsPlaying(p => { playingRef.current = !p; return !p })
  }, [])

  const guide          = GUIDE_CONFIGS[step]
  const overallPct     = ((step * 100 + progress) / (STEP_COUNT * 100)) * 100

  return (
    <div
      className="relative min-h-screen flex flex-col items-center overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}
    >
      <div className="pointer-events-none absolute inset-0 grid-bg" />
      <div className="pointer-events-none absolute" style={{ top: -80, left: -60, width: 280, height: 280, background: 'rgba(0,87,231,0.3)', filter: 'blur(72px)', borderRadius: '50%' }} />
      <div className="pointer-events-none absolute" style={{ bottom: -60, right: -40, width: 240, height: 240, background: 'rgba(0,200,255,0.2)', filter: 'blur(64px)', borderRadius: '50%' }} />

      <div className="relative w-full max-w-[420px] flex flex-col min-h-screen px-4 pt-6 pb-4" style={{ zIndex: 1 }}>

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-base font-semibold text-white">Live Demo</h1>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Cyan's Brooklynn Recycling</p>
          </div>
          <button
            onClick={() => navigate('/login')}
            className="text-xs px-3 py-1.5 rounded-lg transition-all hover:brightness-110"
            style={{ background: 'rgba(0,200,255,0.1)', color: '#00c8ff', border: '1px solid rgba(0,200,255,0.3)' }}
          >
            Enter App →
          </button>
        </div>

        {/* Step dots — clickable */}
        <div className="flex gap-1.5 mb-5">
          {STEP_ICONS.map((icon, i) => (
            <button key={i} onClick={() => goToStep(i)} className="flex-1 flex flex-col gap-1 items-center">
              <div
                className="h-1 w-full rounded-full"
                style={{
                  background: step > i
                    ? '#00c8ff'
                    : step === i
                    ? `rgba(0,200,255,${0.2 + (progress / 100) * 0.8})`
                    : 'rgba(255,255,255,0.1)',
                  transition: 'background 0.08s',
                }}
              />
              <span className="text-[9px]">{icon}</span>
            </button>
          ))}
        </div>

        {/* Screen + floating guide */}
        <div
          className="relative flex-1 rounded-2xl overflow-hidden"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(0,190,255,0.12)',
            backdropFilter: 'blur(24px)',
            minHeight: 400,
          }}
        >
          {step === 0 && <ScreenConsumer />}
          {step === 1 && <ScreenDriverAccept />}
          {step === 2 && <ScreenDriverPickup />}
          {step === 3 && <ScreenWarehouseScan scannedBags={scannedBags} />}
          {step === 4 && <ScreenPayout />}

          {/* Floating guide wrapper — transitions position */}
          <div
            style={{
              position: 'absolute',
              top:  guide.top,
              left: guide.left,
              transition: 'top 0.65s cubic-bezier(0.34,1.2,0.64,1), left 0.65s cubic-bezier(0.34,1.2,0.64,1)',
              zIndex: 20,
              maxWidth: 205,
              pointerEvents: 'none',
            }}
          >
            {/* keyed so fade-in re-fires on each step */}
            <div
              key={step}
              className="flex items-start gap-2 px-3 py-2 rounded-2xl text-xs text-white"
              style={{
                background: 'rgba(2,12,42,0.95)',
                border: '1.5px solid rgba(0,200,255,0.65)',
                boxShadow: '0 0 24px rgba(0,200,255,0.45), 0 6px 24px rgba(0,0,0,0.6)',
                backdropFilter: 'blur(12px)',
                lineHeight: 1.45,
                animation: 'demoFadeIn 0.35s ease forwards, demoFloat 2.6s 0.5s ease-in-out infinite',
              }}
            >
              <span style={{ fontSize: 16, flexShrink: 0 }}>♻️</span>
              <span style={{ color: 'rgba(255,255,255,0.92)' }}>{guide.text}</span>
            </div>
          </div>
        </div>

        {/* Overall progress bar */}
        <div className="mt-4 h-1 w-full rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
          <div
            className="h-full rounded-full"
            style={{
              width: `${overallPct}%`,
              background: 'linear-gradient(90deg, #0057e7, #00c8ff)',
              transition: isPlaying ? `width ${TICK_MS}ms linear` : 'none',
            }}
          />
        </div>

        {/* Controls */}
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs w-16" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {STEP_PEOPLE[step]}
          </span>

          <div className="flex items-center gap-2">
            {/* Back */}
            <button
              onClick={() => goToStep(step - 1)}
              disabled={step === 0}
              className="w-8 h-8 flex items-center justify-center rounded-full transition-all hover:brightness-110 disabled:opacity-25"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            {/* Restart */}
            <button
              onClick={restart}
              className="w-8 h-8 flex items-center justify-center rounded-full transition-all hover:brightness-110"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
            </button>

            {/* Play / Pause */}
            <button
              onClick={togglePlay}
              className="w-11 h-11 flex items-center justify-center rounded-full transition-all hover:brightness-110 active:scale-95"
              style={{
                background: 'linear-gradient(135deg, #0057e7, #00c8ff)',
                boxShadow: '0 4px 20px rgba(0,190,255,0.45)',
              }}
            >
              {isPlaying ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              )}
            </button>

            {/* Forward */}
            <button
              onClick={() => goToStep(step + 1)}
              disabled={step >= STEP_COUNT - 1}
              className="w-8 h-8 flex items-center justify-center rounded-full transition-all hover:brightness-110 disabled:opacity-25"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>

          <span className="text-xs w-16 text-right" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {step + 1} / {STEP_COUNT}
          </span>
        </div>
      </div>

      <style>{`
        @keyframes demoFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes demoFloat {
          0%, 100% { transform: translateY(0);   }
          50%       { transform: translateY(-5px); }
        }
        @keyframes demoGlow {
          0%, 100% { box-shadow: 0 4px 20px rgba(0,190,255,0.4); }
          50%       { box-shadow: 0 4px 40px rgba(0,190,255,0.85); }
        }
      `}</style>
    </div>
  )
}

// ── Screen: Consumer (Alex) ───────────────────────────────────────────────────
function ScreenConsumer() {
  return (
    <div className="h-full flex flex-col p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 20 }}>♻️</span>
          <span className="text-sm font-semibold text-white">Consumer</span>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: 'rgba(0,200,255,0.12)', color: '#00c8ff', border: '1px solid rgba(0,200,255,0.3)' }}>
          Alex
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        {[{ label: 'Bags', value: '47' }, { label: 'lbs', value: '470' }, { label: 'CO₂ kg', value: '235' }].map(s => (
          <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: 'rgba(0,200,255,0.06)', border: '1px solid rgba(0,200,255,0.14)' }}>
            <div className="text-xl font-bold" style={{ color: '#00c8ff' }}>{s.value}</div>
            <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl p-4 mb-3 flex-1" style={{ background: 'rgba(0,87,231,0.1)', border: '1px solid rgba(0,87,231,0.28)' }}>
        <div className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgba(0,200,255,0.7)' }}>Pickup Request</div>
        <div className="text-white font-semibold text-base mb-0.5">15 Recycling Bags</div>
        <div className="text-xs mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>4 stops · Nashville, TN</div>
        <div className="flex flex-col gap-1.5">
          {STOPS.map((s, i) => (
            <div key={i} className="flex justify-between text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
              <span>📍 {s.address}</span>
              <span style={{ color: '#00c8ff' }}>{s.bags} bags</span>
            </div>
          ))}
        </div>
      </div>

      <button
        className="w-full py-3.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2"
        style={{ background: 'linear-gradient(135deg, #0057e7, #00c8ff)', animation: 'demoGlow 1.8s ease-in-out infinite' }}
      >
        <span>♻️</span>
        Schedule 15 Bags
      </button>
    </div>
  )
}

// ── Screen: Driver Accept (Bertha) ────────────────────────────────────────────
function ScreenDriverAccept() {
  return (
    <div className="h-full flex flex-col p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 20 }}>🚐</span>
          <span className="text-sm font-semibold text-white">Driver</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full animate-pulse" style={{ background: '#4ade80' }} />
          <span className="text-xs font-medium" style={{ color: '#4ade80' }}>Bertha · Online</span>
        </div>
      </div>

      <div className="rounded-xl p-4 mb-3" style={{ background: 'rgba(0,200,255,0.07)', border: '1.5px solid rgba(0,200,255,0.4)', boxShadow: '0 0 24px rgba(0,200,255,0.15)' }}>
        <div className="flex items-center gap-2 mb-2">
          <div className="h-2 w-2 rounded-full animate-pulse" style={{ background: '#00c8ff' }} />
          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#00c8ff' }}>New Route Available</span>
        </div>
        <div className="text-white font-semibold mb-0.5">4 stops · 15 bags</div>
        <div className="text-xs mb-3" style={{ color: 'rgba(255,255,255,0.45)' }}>Nashville, TN · Est. 45 min</div>
        <div className="flex flex-col gap-1.5 mb-4">
          {STOPS.map((s, i) => (
            <div key={i} className="flex items-center gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
              <span style={{ color: '#00c8ff', fontSize: 8 }}>●</span>
              <span className="flex-1">{s.address}</span>
              <span>{s.bags} bags</span>
            </div>
          ))}
        </div>
        <button
          className="w-full py-3 rounded-xl text-sm font-semibold text-white"
          style={{ background: 'linear-gradient(135deg, #0057e7, #00c8ff)', animation: 'demoGlow 1.8s ease-in-out infinite' }}
        >
          Accept Route →
        </button>
      </div>

      <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Estimated earnings</div>
        <div className="text-xl font-bold" style={{ color: '#4ade80' }}>$40.00 – $75.00</div>
      </div>
    </div>
  )
}

// ── Screen: Driver Pickup (Bertha) ────────────────────────────────────────────
function ScreenDriverPickup() {
  return (
    <div className="h-full flex flex-col p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-sm font-semibold text-white">Active Route</div>
          <div className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Bertha · 15 bags total</div>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: 'rgba(34,197,94,0.12)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)' }}>
          ✓ All Done
        </span>
      </div>

      <div className="flex flex-col gap-2 mb-4">
        {STOPS.map((s, i) => (
          <div key={i} className="rounded-xl p-3 flex items-center gap-3" style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.22)' }}>
            <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(34,197,94,0.18)' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-white font-medium truncate">{s.address}</div>
              <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.38)' }}>{s.bags} bags collected</div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl p-4 mt-auto" style={{ background: 'rgba(0,200,255,0.06)', border: '1px solid rgba(0,200,255,0.2)' }}>
        <div className="flex items-center gap-3">
          <span style={{ fontSize: 28 }}>🏭</span>
          <div>
            <div className="text-sm font-semibold text-white">Heading to Warehouse</div>
            <div className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>15 bags · Est. 8 min</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Screen: Warehouse Scan (Key) ──────────────────────────────────────────────
function ScreenWarehouseScan({ scannedBags }: { scannedBags: Array<{ code: string; result: BagResult }> }) {
  const accepted = scannedBags.filter(b => b.result === 'accepted').length
  const caution  = scannedBags.filter(b => b.result === 'caution').length
  const rejected = scannedBags.filter(b => b.result === 'rejected').length

  return (
    <div className="h-full flex flex-col p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 20 }}>🏭</span>
          <div>
            <div className="text-sm font-semibold text-white">Warehouse Scan-In</div>
            <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Key · Bertha's Route</div>
          </div>
        </div>
        <span className="text-xs font-medium" style={{ color: '#00c8ff' }}>
          {scannedBags.length}/{TOTAL_BAGS}
        </span>
      </div>

      <div className="grid grid-cols-5 gap-1.5 mb-4">
        {Array.from({ length: TOTAL_BAGS }).map((_, i) => {
          const bag = scannedBags[i]
          return (
            <div
              key={i}
              className="rounded-lg flex items-center justify-center"
              style={{
                height: 42,
                fontSize: 15,
                background: !bag
                  ? 'rgba(255,255,255,0.06)'
                  : bag.result === 'accepted' ? 'rgba(34,197,94,0.22)'
                  : bag.result === 'caution'  ? 'rgba(234,179,8,0.22)'
                  : 'rgba(239,68,68,0.18)',
                border: `1px solid ${!bag
                  ? 'rgba(255,255,255,0.09)'
                  : bag.result === 'accepted' ? 'rgba(34,197,94,0.45)'
                  : bag.result === 'caution'  ? 'rgba(234,179,8,0.45)'
                  : 'rgba(239,68,68,0.35)'}`,
                transition: 'all 0.25s ease',
              }}
            >
              {bag
                ? bag.result === 'accepted' ? '✅'
                : bag.result === 'caution'  ? '⚠️' : '❌'
                : <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: 9 }}>{i + 1}</span>}
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Accepted', val: accepted, color: '#4ade80', bg: 'rgba(34,197,94,0.1)',  border: 'rgba(34,197,94,0.3)'  },
          { label: 'Caution',  val: caution,  color: '#fbbf24', bg: 'rgba(234,179,8,0.1)',  border: 'rgba(234,179,8,0.3)'  },
          { label: 'Rejected', val: rejected, color: '#f87171', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.28)' },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-2.5 text-center" style={{ background: s.bg, border: `1px solid ${s.border}` }}>
            <div className="text-2xl font-bold" style={{ color: s.color }}>{s.val}</div>
            <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Screen: Payout ────────────────────────────────────────────────────────────
function ScreenPayout() {
  return (
    <div className="h-full flex flex-col p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-sm font-semibold text-white">Payout Summary</div>
          <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Bertha · Route complete</div>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: 'rgba(34,197,94,0.12)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)' }}>
          ✓ Processed
        </span>
      </div>

      <div className="rounded-xl overflow-hidden mb-3" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
        {[
          { label: 'Accepted', count: ACCEPTED, rate: 5, color: '#4ade80' },
          { label: 'Caution',  count: CAUTION,  rate: 5, color: '#fbbf24' },
          { label: 'Rejected', count: REJECTED, rate: 0, color: '#f87171' },
        ].map((row, i) => (
          <div
            key={row.label}
            className="flex items-center justify-between px-4 py-3"
            style={{
              background: i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.12)',
              borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.06)' : 'none',
            }}
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: row.color }} />
              <span className="text-sm text-white">{row.label}</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.38)' }}>
                {row.count} × ${row.rate.toFixed(2)}
              </span>
              <span className="text-sm font-semibold w-14 text-right" style={{ color: row.rate > 0 ? row.color : 'rgba(255,255,255,0.22)' }}>
                ${(row.count * row.rate).toFixed(2)}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl p-4 mb-3" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.28)' }}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>{PAYABLE} bags payable</div>
            <div className="text-3xl font-bold" style={{ color: '#4ade80' }}>${(PAYABLE * 5).toFixed(2)}</div>
          </div>
          <span style={{ fontSize: 36 }}>💰</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {[
          { icon: '⚖️', label: 'lbs diverted', value: `${PAYABLE * 10}` },
          { icon: '🌱', label: 'CO₂ kg saved', value: `${PAYABLE * 5}`  },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="text-xl">{s.icon}</div>
            <div className="text-lg font-bold text-white">{s.value}</div>
            <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
