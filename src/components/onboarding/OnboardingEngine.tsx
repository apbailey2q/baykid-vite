/**
 * OnboardingEngine — shared step UI for all role-specific onboarding flows.
 *
 * Provides:
 *  • Progress bar + step indicator
 *  • Animated step transitions (slide + fade)
 *  • Back / Next / Skip navigation buttons
 *  • Resume detection banner (when returning mid-flow)
 *  • Consistent Cyan's Brooklynn dark-glass visual style
 *
 * Usage:
 *   <OnboardingEngine
 *     steps={STEP_TITLES}
 *     currentStep={step}
 *     total={TOTAL_STEPS}
 *     onNext={handleNext}
 *     onBack={() => setStep(s => s - 1)}
 *     onSkip={handleSkip}
 *     canProceed={isValid}
 *     isSubmitting={saving}
 *     resumed={resumedFromDB}
 *   >
 *     {renderStepContent(step)}
 *   </OnboardingEngine>
 */

import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OnboardingEngineProps {
  /** Array of step titles shown in progress header. */
  steps:        string[]
  /** Zero-based index of the current step. */
  currentStep:  number
  /** Called when the user clicks Next / Submit. */
  onNext:       () => void
  /** Called when the user clicks Back. Undefined = hides the Back button. */
  onBack?:      () => void
  /** Called when the user clicks Skip tour. Undefined = hides the Skip link. */
  onSkip?:      () => void
  /** Whether the Next button is enabled. Defaults to true. */
  canProceed?:  boolean
  /** Shows a spinner on the Next/Submit button. */
  isSubmitting?: boolean
  /** When true, shows a "Resuming your progress" banner. */
  resumed?:     boolean
  /** The step content to render. */
  children:     ReactNode
  /** Heading shown above children for the current step. Falls back to steps[currentStep]. */
  stepTitle?:   string
  /** Optional subtitle for the current step. */
  stepSubtitle?: string
  /** Role label shown in the top badge, e.g. "Driver", "Warehouse", "Consumer". */
  roleLabel?:   string
  /** Role icon emoji shown beside roleLabel. */
  roleIcon?:    string
}

// ── Component ─────────────────────────────────────────────────────────────────

export function OnboardingEngine({
  steps,
  currentStep,
  onNext,
  onBack,
  onSkip,
  canProceed = true,
  isSubmitting = false,
  resumed = false,
  children,
  stepTitle,
  stepSubtitle,
  roleLabel,
  roleIcon,
}: OnboardingEngineProps) {
  const navigate   = useNavigate()
  const total      = steps.length
  const isFirst    = currentStep === 0
  const isLast     = currentStep === total - 1
  const pct        = total > 1 ? (currentStep / (total - 1)) * 100 : 100
  const displayTitle = stepTitle ?? steps[currentStep] ?? ''

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'linear-gradient(160deg,#020818 0%,#05122e 60%,#020818 100%)',
        display: 'flex',
        flexDirection: 'column',
        overflowX: 'hidden',
      }}
    >
      {/* ── Top bar ── */}
      <div
        style={{
          position: 'sticky', top: 0, zIndex: 20,
          background: 'rgba(2,8,24,0.85)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          borderBottom: '1px solid rgba(0,200,255,0.1)',
          padding: '12px 16px',
        }}
      >
        {/* Role badge + skip */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {roleIcon && <span style={{ fontSize: 16 }}>{roleIcon}</span>}
            {roleLabel && (
              <span style={{
                fontSize: 10, fontWeight: 700, color: '#00c8ff',
                textTransform: 'uppercase', letterSpacing: '0.1em',
                background: 'rgba(0,200,255,0.1)',
                border: '1px solid rgba(0,200,255,0.2)',
                borderRadius: 6, padding: '2px 7px',
              }}>
                {roleLabel} Setup
              </span>
            )}
          </div>
          {onSkip && (
            <button
              onClick={onSkip}
              style={{
                background: 'none', border: 'none',
                color: 'rgba(255,255,255,0.35)', fontSize: 12,
                cursor: 'pointer', padding: '4px 6px',
              }}
            >
              Skip
            </button>
          )}
        </div>

        {/* Step count */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)' }}>
            Step {currentStep + 1} of {total}
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#00c8ff' }}>
            {Math.round(pct)}%
          </span>
        </div>

        {/* Progress bar */}
        <div style={{
          height: 4, borderRadius: 4, background: 'rgba(255,255,255,0.07)',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', borderRadius: 4,
            background: 'linear-gradient(90deg, #0057e7, #00c8ff)',
            width: `${pct}%`,
            transition: 'width 0.35s ease',
            boxShadow: '0 0 8px rgba(0,200,255,0.5)',
          }} />
        </div>

        {/* Step dots */}
        <div style={{ display: 'flex', gap: 5, marginTop: 8, justifyContent: 'center' }}>
          {steps.map((_, i) => (
            <div
              key={i}
              style={{
                width:  i === currentStep ? 18 : 7,
                height: 7,
                borderRadius: 4,
                background: i < currentStep
                  ? '#00c8ff'
                  : i === currentStep
                  ? 'linear-gradient(90deg,#0057e7,#00c8ff)'
                  : 'rgba(255,255,255,0.1)',
                boxShadow: i === currentStep ? '0 0 8px rgba(0,200,255,0.6)' : 'none',
                transition: 'width 0.25s ease, background 0.25s ease',
              }}
            />
          ))}
        </div>
      </div>

      {/* ── Resume banner ── */}
      {resumed && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 16px',
          background: 'rgba(0,200,255,0.07)',
          borderBottom: '1px solid rgba(0,200,255,0.15)',
        }}>
          <span style={{ fontSize: 14 }}>🔄</span>
          <p style={{ fontSize: 12, color: '#00c8ff', fontWeight: 600 }}>
            Resuming your progress — pick up where you left off.
          </p>
        </div>
      )}

      {/* ── Step content ── */}
      <div
        key={currentStep}
        style={{
          flex: 1,
          padding: '24px 16px',
          maxWidth: 540,
          width: '100%',
          margin: '0 auto',
          animation: 'onbFadeUp 0.3s ease both',
        }}
      >
        {/* Step heading */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: '#fff', lineHeight: 1.2, margin: 0 }}>
            {displayTitle}
          </h1>
          {stepSubtitle && (
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 6, lineHeight: 1.5 }}>
              {stepSubtitle}
            </p>
          )}
        </div>

        {children}
      </div>

      {/* ── Bottom navigation ── */}
      <div
        style={{
          position: 'sticky', bottom: 0,
          background: 'rgba(2,8,24,0.9)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          padding: '12px 16px',
          display: 'flex',
          gap: 10,
          maxWidth: 540,
          width: '100%',
          margin: '0 auto',
          boxSizing: 'border-box',
        }}
      >
        {!isFirst && onBack ? (
          <button
            onClick={onBack}
            disabled={isSubmitting}
            style={{
              flex: '0 0 80px',
              padding: '14px 0',
              borderRadius: 14,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.6)',
              fontSize: 14, fontWeight: 700,
              cursor: 'pointer',
              transition: 'opacity 0.15s',
            }}
          >
            ← Back
          </button>
        ) : (
          <button
            onClick={() => navigate(-1)}
            style={{
              flex: '0 0 80px',
              padding: '14px 0',
              borderRadius: 14,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.07)',
              color: 'rgba(255,255,255,0.3)',
              fontSize: 14, fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ← Exit
          </button>
        )}

        <button
          onClick={onNext}
          disabled={!canProceed || isSubmitting}
          style={{
            flex: 1,
            padding: '14px 0',
            borderRadius: 14,
            background: canProceed && !isSubmitting
              ? 'linear-gradient(135deg,#0057e7,#00c8ff)'
              : 'rgba(255,255,255,0.07)',
            border: 'none',
            color: canProceed && !isSubmitting ? '#fff' : 'rgba(255,255,255,0.25)',
            fontSize: 15, fontWeight: 800,
            cursor: canProceed && !isSubmitting ? 'pointer' : 'default',
            boxShadow: canProceed && !isSubmitting ? '0 4px 20px rgba(0,190,255,0.35)' : 'none',
            transition: 'all 0.2s',
            letterSpacing: '0.01em',
          }}
        >
          {isSubmitting
            ? 'Saving…'
            : isLast
            ? 'Submit Application'
            : 'Continue →'}
        </button>
      </div>

      {/* Animation keyframes */}
      <style>{`
        @keyframes onbFadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
