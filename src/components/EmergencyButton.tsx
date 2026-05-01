import { useState } from 'react'
import { createAlert } from '../lib/driver'
import { useAuthStore } from '../store/authStore'
import type { AlertType } from '../types'

type ModalStep = 'closed' | 'selecting' | 'confirming' | 'sending' | 'sent'

interface AlertOption {
  type: AlertType
  label: string
  icon: string
  color: string
  bg: string
  border: string
}

const ALERT_OPTIONS: AlertOption[] = [
  { type: 'medical_emergency', label: 'Medical Emergency', icon: '🚑', color: '#f87171', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.3)'   },
  { type: 'hazardous_material', label: 'Hazardous Material', icon: '☣️', color: '#fb923c', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.3)'  },
  { type: 'safety_threat',     label: 'Safety Threat',     icon: '🚨', color: '#f87171', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.3)'   },
  { type: 'vehicle_issue',     label: 'Vehicle Issue',     icon: '🚗', color: '#facc15', bg: 'rgba(234,179,8,0.12)',  border: 'rgba(234,179,8,0.3)'   },
  { type: 'contact_support',   label: 'Contact Support',   icon: '📞', color: '#60a5fa', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.3)'  },
]

const GLASS = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(0,190,255,0.15)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
}

interface EmergencyButtonProps {
  variant?: 'floating' | 'inline'
}

export function EmergencyButton({ variant = 'floating' }: EmergencyButtonProps) {
  const { user } = useAuthStore()
  const [step, setStep] = useState<ModalStep>('closed')
  const [selected, setSelected] = useState<AlertOption | null>(null)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  const open = () => setStep('selecting')

  const select = (opt: AlertOption) => {
    setSelected(opt)
    setNotes('')
    setError('')
    setStep('confirming')
  }

  const close = () => {
    setStep('closed')
    setSelected(null)
    setNotes('')
    setError('')
  }

  const send = async () => {
    if (!user || !selected) return
    setStep('sending')
    setError('')
    try {
      await createAlert(user.id, selected.type, notes.trim() || undefined)
      setStep('sent')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send alert')
      setStep('confirming')
    }
  }

  return (
    <>
      {/* Floating button (default) */}
      {variant === 'floating' && (
        <button
          onClick={open}
          aria-label="Emergency"
          className="fixed bottom-6 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
          style={{ background: '#ef4444', boxShadow: '0 4px 20px rgba(239,68,68,0.5)' }}
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
          </svg>
        </button>
      )}

      {/* Inline pill button (header) */}
      {variant === 'inline' && (
        <button
          onClick={open}
          aria-label="Emergency"
          className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold text-white transition-all active:scale-[0.93]"
          style={{
            background: 'rgba(239,68,68,0.88)',
            boxShadow: '0 0 8px rgba(239,68,68,0.35)',
            border: '1px solid rgba(239,68,68,0.45)',
          }}
        >
          <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
          </svg>
          Emergency
        </button>
      )}

      {/* Backdrop */}
      {step !== 'closed' && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-6 sm:items-center"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => e.target === e.currentTarget && close()}
        >
          <div
            className="w-full max-w-sm rounded-2xl"
            style={{ ...GLASS, border: '1px solid rgba(0,190,255,0.15)' }}
          >
            {/* Selecting */}
            {step === 'selecting' && (
              <div className="p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-base font-bold" style={{ color: '#ffffff' }}>Emergency Alert</h2>
                  <button onClick={close} style={{ color: 'rgba(255,255,255,0.4)' }}>
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <p className="mb-4 text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Select the type of emergency:</p>
                <div className="space-y-2">
                  {ALERT_OPTIONS.map((opt) => (
                    <button
                      key={opt.type}
                      onClick={() => select(opt)}
                      className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-opacity hover:opacity-80"
                      style={{ background: opt.bg, border: `1px solid ${opt.border}` }}
                    >
                      <span className="text-2xl">{opt.icon}</span>
                      <span className="text-sm font-semibold" style={{ color: opt.color }}>{opt.label}</span>
                    </button>
                  ))}
                </div>
                <button
                  onClick={close}
                  className="mt-4 w-full rounded-xl py-2.5 text-sm font-medium transition-opacity hover:opacity-70"
                  style={{ color: 'rgba(255,255,255,0.4)' }}
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Confirming */}
            {(step === 'confirming' || step === 'sending') && selected && (
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold" style={{ color: '#ffffff' }}>Confirm Alert</h2>
                  <button onClick={close} style={{ color: 'rgba(255,255,255,0.4)' }}>
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div
                  className="flex items-center gap-3 rounded-xl px-4 py-3"
                  style={{ background: selected.bg, border: `1px solid ${selected.border}` }}
                >
                  <span className="text-2xl">{selected.icon}</span>
                  <span className="text-sm font-bold" style={{ color: selected.color }}>{selected.label}</span>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    Notes <span className="font-normal" style={{ color: 'rgba(255,255,255,0.25)' }}>(optional)</span>
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    placeholder="Location, additional details…"
                    className="w-full resize-none rounded-xl px-3 py-2 text-sm outline-none"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(0,190,255,0.15)',
                      color: '#ffffff',
                    }}
                  />
                </div>
                {error && (
                  <p className="rounded-lg px-3 py-2 text-sm" style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171' }}>{error}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => setStep('selecting')}
                    disabled={step === 'sending'}
                    className="flex-1 rounded-xl py-2.5 text-sm font-medium transition-opacity hover:opacity-70 disabled:opacity-50"
                    style={{ border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.5)' }}
                  >
                    Back
                  </button>
                  <button
                    onClick={send}
                    disabled={step === 'sending'}
                    className="flex-1 rounded-xl py-2.5 text-sm font-bold text-white disabled:opacity-60"
                    style={{ background: '#ef4444', boxShadow: '0 4px 16px rgba(239,68,68,0.4)' }}
                  >
                    {step === 'sending' ? 'Sending…' : 'Send Alert'}
                  </button>
                </div>
              </div>
            )}

            {/* Sent */}
            {step === 'sent' && selected && (
              <div className="p-6 text-center space-y-3">
                <div
                  className="mx-auto flex h-14 w-14 items-center justify-center rounded-full"
                  style={{ background: 'rgba(0,230,118,0.15)', border: '1px solid rgba(0,230,118,0.3)' }}
                >
                  <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: '#00E676' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <h2 className="text-base font-bold" style={{ color: '#ffffff' }}>Alert Sent</h2>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Your <span className="font-medium" style={{ color: '#ffffff' }}>{selected.label}</span> alert has been received.
                  An administrator will respond shortly.
                </p>
                <button
                  onClick={close}
                  className="mt-2 w-full rounded-xl py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-80"
                  style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
