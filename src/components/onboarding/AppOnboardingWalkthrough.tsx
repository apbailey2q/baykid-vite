// AppOnboardingWalkthrough — first-time tour overlay for the AI Marketing Center
//
// Renders a stepped modal that introduces the 5 main surfaces. The user can:
//   • Click "Next" through each step
//   • Tap "Skip" to dismiss permanently (records dismissed_at)
//   • Tap "Finish" on the last step (records completed_at)
//
// Persistence is via lib/onboardingProgress (localStorage fast-path +
// onboarding_progress upsert). Surface key: 'ai_marketing_welcome'.
//
// Mount this near the root of admin-only routes:
//   <AppOnboardingWalkthrough />
// It self-checks completion state and renders nothing if already dismissed.

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  isCompletedOrDismissed, markProgress,
} from '../../lib/onboardingProgress'

const SURFACE = 'ai_marketing_welcome'

interface Step {
  id:    string
  icon:  string
  title: string
  body:  string
  cta?:  { label: string; path: string }
}

const STEPS: Step[] = [
  {
    id: 'welcome',
    icon: '✨',
    title: 'Welcome to AI Marketing',
    body: 'Generate, schedule, and approve social content with help from Claude — all from one workspace.',
  },
  {
    id: 'leads',
    icon: '🎯',
    title: 'Lead Tracker',
    body: 'Every comment, email, and post can become a lead. Manual entries and automation rules both feed the pipeline.',
    cta: { label: 'See Lead Tracker', path: '/admin/ai-marketing?section=leads' },
  },
  {
    id: 'automation',
    icon: '⚙️',
    title: 'Automation rules',
    body: 'Rules match incoming comments and create drafts — never auto-post. Every action is reviewable.',
    cta: { label: 'Open Automation Rules', path: '/admin/ai-marketing?section=automation' },
  },
  {
    id: 'billing',
    icon: '💳',
    title: 'Plans & usage',
    body: 'Track your AI generations, scheduled posts, and team seats against plan limits. Upgrade anytime.',
    cta: { label: 'View plans', path: '/admin/billing/plans' },
  },
  {
    id: 'feedback',
    icon: '🚀',
    title: 'You\'re in beta — talk to us',
    body: 'Send a bug, feature idea, or UX note. The team triages every one.',
    cta: { label: 'Send beta feedback', path: '/beta/feedback' },
  },
]

export function AppOnboardingWalkthrough() {
  const navigate = useNavigate()
  const [open,  setOpen]  = useState(false)
  const [step,  setStep]  = useState(0)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    isCompletedOrDismissed(SURFACE).then((done) => {
      if (cancelled) return
      setOpen(!done)
      setReady(true)
    })
    return () => { cancelled = true }
  }, [])

  if (!ready || !open) return null

  const current = STEPS[step]
  const isLast  = step === STEPS.length - 1

  function next() {
    if (isLast) finish()
    else setStep((s) => s + 1)
  }

  function skip() {
    void markProgress({ surface: SURFACE, dismissed: true })
    setOpen(false)
  }

  function finish() {
    void markProgress({
      surface: SURFACE,
      completed: true,
      stepsComplete: STEPS.map((s) => s.id),
    })
    setOpen(false)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(2,6,18,0.78)', backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div style={{
        background: 'linear-gradient(180deg,#0a142b 0%,#06102a 100%)',
        border: '1px solid rgba(0,200,255,0.2)',
        borderRadius: 18, padding: 24,
        width: '100%', maxWidth: 460, color: '#fff',
        boxShadow: '0 20px 60px rgba(0,0,0,0.55)',
      }}>
        {/* Progress dots */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
          {STEPS.map((s, i) => (
            <div key={s.id} style={{
              flex: 1, height: 4, borderRadius: 4,
              background: i <= step ? 'linear-gradient(90deg,#0057e7,#00c8ff)' : 'rgba(255,255,255,0.08)',
              transition: 'background 0.25s',
            }} />
          ))}
        </div>

        <div style={{ fontSize: 38, lineHeight: 1, marginBottom: 12 }}>{current.icon}</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, marginBottom: 8 }}>{current.title}</h2>
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, lineHeight: 1.55, margin: 0 }}>{current.body}</p>

        {current.cta && (
          <button
            onClick={() => {
              // Mark step as visited but don't dismiss the tour.
              navigate(current.cta!.path)
              void markProgress({ surface: SURFACE, stepsComplete: STEPS.slice(0, step + 1).map((s) => s.id) })
              setOpen(false)
            }}
            style={{
              marginTop: 16, background: 'rgba(0,200,255,0.10)',
              border: '1px solid rgba(0,200,255,0.4)', color: '#00c8ff',
              borderRadius: 10, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}
          >
            {current.cta.label} →
          </button>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 22 }}>
          <button
            onClick={skip}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.45)', fontSize: 12, cursor: 'pointer', padding: 4 }}
          >
            Skip tour
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            {step > 0 && (
              <button
                onClick={() => setStep((s) => s - 1)}
                style={{
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  color: 'rgba(255,255,255,0.7)', borderRadius: 8, padding: '8px 14px',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Back
              </button>
            )}
            <button
              onClick={next}
              style={{
                background: 'linear-gradient(135deg,#0057e7,#00c8ff)', color: '#fff',
                border: 'none', borderRadius: 8, padding: '8px 16px',
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 2px 12px rgba(0,190,255,0.35)',
              }}
            >
              {isLast ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
