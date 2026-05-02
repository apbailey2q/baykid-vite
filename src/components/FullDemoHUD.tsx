import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDemoFlowStore, DEMO_FLOW_STEPS, DEMO_BAG_CODE } from '../store/demoFlowStore'
import { useAuthStore } from '../store/authStore'
import { getMockUser, getMockProfile } from '../lib/devBypass'

// ── Config ────────────────────────────────────────────────────────────────────
const STEP_DURATION  = 5000   // ms per step  (5 steps × 5s = 25s total)
const TICK_MS        = 50
const TICK_INCREMENT = (TICK_MS / STEP_DURATION) * 100

// Narration shown while each step plays
const NARRATIONS = [
  'Alex opens the app and schedules a recycling pickup at 114 S 11th St.',
  'A driver accepts the pickup and heads to the address.',
  'Bertha picks up all bags and heads to the warehouse.',
  'Key inspects and verifies each bag at the warehouse.',
  'Alex sees the completed bag and updated eco‑impact.',
]

const STATUS_LABEL: Record<string, string> = {
  pending_pickup:  'Pending Pickup',
  driver_accepted: 'Driver Accepted',
  at_warehouse:    'At Warehouse',
  completed:       'Completed',
}

const STATUS_COLOR: Record<string, string> = {
  pending_pickup:  '#fbbf24',
  driver_accepted: '#60a5fa',
  at_warehouse:    '#a78bfa',
  completed:       '#4ade80',
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function FullDemoHUD() {
  const navigate                = useNavigate()
  const { setUser, setProfile } = useAuthStore()
  const { isRunning, step, stopDemo } = useDemoFlowStore()

  const [isPlaying,    setIsPlaying]    = useState(true)
  const [stepProgress, setStepProgress] = useState(0)   // 0–100 within current step

  // Refs for the interval — avoids stale closures
  const playingRef     = useRef(true)
  const stepRef        = useRef(0)
  const progressRef    = useRef(0)
  const isRunningRef   = useRef(false)

  useEffect(() => { playingRef.current   = isPlaying  }, [isPlaying])
  useEffect(() => { stepRef.current      = step        }, [step])
  useEffect(() => { isRunningRef.current = isRunning   }, [isRunning])

  // Reset per-step progress bar whenever step changes
  useEffect(() => {
    progressRef.current = 0
    setStepProgress(0)
  }, [step])

  // When the demo starts / restarts, ensure auto-play is on
  useEffect(() => {
    if (isRunning) {
      setIsPlaying(true)
      playingRef.current = true
    }
  }, [isRunning])

  // Navigate + switch auth role on every step change
  useEffect(() => {
    if (!isRunning) return
    const s = DEMO_FLOW_STEPS[step]
    if (!s) return
    setUser(getMockUser(s.role))
    setProfile(getMockProfile(s.role))
    navigate(s.path)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, isRunning])

  // Main auto-advance ticker — mounted once, reads only from refs
  useEffect(() => {
    const id = setInterval(() => {
      if (!isRunningRef.current || !playingRef.current) return

      const next = progressRef.current + TICK_INCREMENT

      if (next >= 100) {
        const nextStep = stepRef.current + 1

        if (nextStep >= DEMO_FLOW_STEPS.length) {
          // Reached the end — hold at 100 % and stop
          progressRef.current = 100
          setStepProgress(100)
          playingRef.current = false
          setIsPlaying(false)
          return
        }

        // Advance to the next step
        progressRef.current = 0
        // goToStep calls the Zustand action; stepRef will sync on next render
        useDemoFlowStore.getState().goToStep(nextStep)
      } else {
        progressRef.current = next
        setStepProgress(next)
      }
    }, TICK_MS)
    return () => clearInterval(id)
  }, []) // intentionally empty — interval reads only from refs

  // ── Hooks must be called before any early return ──────────────────────────
  if (!isRunning) return null
  const current = DEMO_FLOW_STEPS[step]
  if (!current) return null

  // ── Event handlers ────────────────────────────────────────────────────────
  const togglePlay = () => {
    const next = !isPlaying
    playingRef.current = next
    setIsPlaying(next)
  }

  const handleRestart = () => {
    progressRef.current = 0
    setStepProgress(0)
    playingRef.current = true
    setIsPlaying(true)
    useDemoFlowStore.getState().startDemo()
  }

  const handleClose = () => {
    stopDemo()
    navigate('/login')
  }

  // ── Derived values ────────────────────────────────────────────────────────
  const bagStatus   = current.bagStatus
  const statusLabel = STATUS_LABEL[bagStatus] ?? bagStatus
  const statusColor = STATUS_COLOR[bagStatus] ?? '#00c8ff'
  const narration   = NARRATIONS[step] ?? current.description
  const total       = DEMO_FLOW_STEPS.length

  return (
    <div
      className="fixed bottom-0 left-0 right-0 flex justify-center"
      style={{ zIndex: 9999, padding: '0 12px 12px' }}
    >
      <div
        className="w-full max-w-[480px] rounded-2xl overflow-hidden"
        style={{
          background:     'rgba(3,8,24,0.97)',
          border:         '1px solid rgba(0,200,255,0.22)',
          boxShadow:      '0 -2px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,200,255,0.08)',
          backdropFilter: 'blur(20px)',
        }}
      >
        {/* ── Header row ────────────────────────────────────────────────── */}
        <div
          className="flex items-center justify-between px-4 py-2"
          style={{
            background:   'rgba(0,200,255,0.05)',
            borderBottom: '1px solid rgba(0,200,255,0.1)',
          }}
        >
          <div className="flex items-center gap-1.5">
            <span style={{ fontSize: 13 }}>♻️</span>
            <span className="text-xs font-semibold" style={{ color: 'rgba(0,200,255,0.85)' }}>
              Full Demo
            </span>
          </div>

          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Step {step + 1} of {total}: {current.label}
          </span>

          <div className="flex items-center gap-1.5">
            {/* Pause / Resume */}
            <button
              onClick={togglePlay}
              title={isPlaying ? 'Pause' : 'Resume'}
              className="w-6 h-6 flex items-center justify-center rounded-md transition-all hover:brightness-125"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              {isPlaying ? (
                <svg width="9" height="9" viewBox="0 0 24 24" fill="white">
                  <rect x="5" y="4" width="5" height="16" rx="1" />
                  <rect x="14" y="4" width="5" height="16" rx="1" />
                </svg>
              ) : (
                <svg width="9" height="9" viewBox="0 0 24 24" fill="white">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              )}
            </button>

            {/* Restart */}
            <button
              onClick={handleRestart}
              title="Restart"
              className="w-6 h-6 flex items-center justify-center rounded-md transition-all hover:brightness-125"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
            </button>

            {/* Close */}
            <button
              onClick={handleClose}
              title="Exit demo"
              className="text-xs leading-none transition-opacity hover:opacity-60"
              style={{ color: 'rgba(255,255,255,0.3)', marginLeft: 2 }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* ── Bag status + narration ─────────────────────────────────────── */}
        <div className="px-4 pt-3 pb-2">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono font-semibold text-white tracking-wide">
              {DEMO_BAG_CODE}
            </span>
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
              style={{
                background: `${statusColor}22`,
                color:       statusColor,
                border:      `1px solid ${statusColor}55`,
              }}
            >
              {statusLabel}
            </span>
          </div>
          <p className="text-[11px] leading-snug" style={{ color: 'rgba(255,255,255,0.5)' }}>
            {narration}
          </p>
        </div>

        {/* ── Segmented step progress ────────────────────────────────────── */}
        <div className="flex gap-1 px-4 mb-2">
          {DEMO_FLOW_STEPS.map((_, i) => (
            <div
              key={i}
              className="flex-1 h-0.5 rounded-full overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.08)' }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: i < step
                    ? '100%'
                    : i === step
                    ? `${stepProgress}%`
                    : '0%',
                  background: 'linear-gradient(90deg, #0057e7, #00c8ff)',
                  transition: i === step && isPlaying
                    ? `width ${TICK_MS}ms linear`
                    : 'none',
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
