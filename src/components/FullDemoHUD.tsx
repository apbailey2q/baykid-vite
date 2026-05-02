import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDemoFlowStore, DEMO_FLOW_STEPS, DEMO_BAG_CODE } from '../store/demoFlowStore'
import { useAuthStore } from '../store/authStore'
import { getMockUser, getMockProfile } from '../lib/devBypass'

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

const ROLE_ICON: Record<string, string> = {
  consumer:  '♻️',
  driver:    '🚐',
  warehouse: '🏭',
}

export default function FullDemoHUD() {
  const navigate              = useNavigate()
  const { setUser, setProfile } = useAuthStore()
  const { isRunning, step, goToStep, stopDemo } = useDemoFlowStore()

  const current = DEMO_FLOW_STEPS[step]
  const total   = DEMO_FLOW_STEPS.length

  // Navigate + switch auth whenever the active step changes
  useEffect(() => {
    if (!isRunning || !current) return
    setUser(getMockUser(current.role))
    setProfile(getMockProfile(current.role))
    navigate(current.path)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, isRunning])

  // Always call hooks before early return
  if (!isRunning || !current) return null

  const bagStatus  = current.bagStatus
  const statusLabel = STATUS_LABEL[bagStatus] ?? bagStatus
  const statusColor = STATUS_COLOR[bagStatus] ?? '#00c8ff'

  const handleNext = () => {
    if (step < total - 1) {
      goToStep(step + 1)
    } else {
      stopDemo()
      navigate('/login')
    }
  }

  const handlePrev = () => {
    if (step > 0) goToStep(step - 1)
  }

  const handleRestart = () => {
    useDemoFlowStore.getState().stopDemo()
    useDemoFlowStore.getState().startDemo()
  }

  const handleClose = () => {
    stopDemo()
    navigate('/login')
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 flex justify-center"
      style={{ zIndex: 9999, padding: '0 12px 12px' }}
    >
      <div
        className="w-full max-w-[480px] rounded-2xl overflow-hidden"
        style={{
          background:    'rgba(3,8,24,0.97)',
          border:        '1px solid rgba(0,200,255,0.22)',
          boxShadow:     '0 -2px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,200,255,0.08)',
          backdropFilter:'blur(20px)',
        }}
      >
        {/* Step header */}
        <div
          className="flex items-center justify-between px-4 py-2"
          style={{
            background:   'rgba(0,200,255,0.05)',
            borderBottom: '1px solid rgba(0,200,255,0.1)',
          }}
        >
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 14 }}>
              {ROLE_ICON[current.role] ?? '♻️'}
            </span>
            <span className="text-xs font-semibold" style={{ color: 'rgba(0,200,255,0.85)' }}>
              Full Demo
            </span>
          </div>
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Step {step + 1} of {total}: {current.label}
          </span>
          <button
            onClick={handleClose}
            className="text-xs transition-opacity hover:opacity-70"
            style={{ color: 'rgba(255,255,255,0.3)' }}
          >
            ✕
          </button>
        </div>

        {/* Bag spotlight + controls */}
        <div className="px-4 py-3 flex items-center gap-3">
          {/* Bag info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
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
            <p className="text-[11px] leading-snug" style={{ color: 'rgba(255,255,255,0.45)' }}>
              {current.description}
            </p>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={handlePrev}
              disabled={step === 0}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all hover:brightness-110 disabled:opacity-25"
              style={{
                background: 'rgba(255,255,255,0.07)',
                color:      'rgba(255,255,255,0.7)',
                border:     '1px solid rgba(255,255,255,0.1)',
              }}
            >
              ← Prev
            </button>

            <button
              onClick={handleRestart}
              title="Restart demo"
              className="w-7 h-7 flex items-center justify-center rounded-lg transition-all hover:brightness-110"
              style={{
                background: 'rgba(255,255,255,0.07)',
                border:     '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
            </button>

            <button
              onClick={handleNext}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:brightness-110 active:scale-95"
              style={{
                background: 'linear-gradient(135deg, #0057e7, #00c8ff)',
                color:      '#fff',
                boxShadow:  '0 2px 12px rgba(0,190,255,0.35)',
              }}
            >
              {step === total - 1 ? 'Finish ✓' : 'Next →'}
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div
          className="mx-4 mb-3 h-0.5 rounded-full overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.07)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width:      `${((step + 1) / total) * 100}%`,
              background: 'linear-gradient(90deg, #0057e7, #00c8ff)',
            }}
          />
        </div>
      </div>
    </div>
  )
}
