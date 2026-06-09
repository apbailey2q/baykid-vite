// AccidentReportWizard.tsx
//
// Full-screen accident/incident report wizard for Consumer and Commercial drivers.
// Opened via /driver/accident-report route.
//
// Steps:
//   1. Safety Checklist     — 8 checkbox steps; must all be checked
//   2. Location             — GPS capture + manual fallback
//   3. Documentation        — Form fields (varies by driver type)
//   4. Photos               — Upload with required category tags
//   5. Review & Submit      — Validation summary + submit or save draft
//
// Closeout protection: driver cannot close until required fields are complete.
// Emergency Draft: available once HQ call + location + statement + 1 photo done.

import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import {
  CHECKLIST_STEPS,
  REQUIRED_PHOTO_CATEGORIES,
  CONSUMER_ACCIDENT_TYPES,
  COMMERCIAL_ACCIDENT_TYPES,
  HQ_PHONE_TEL,
  HQ_PHONE_NUMBER,
  createDraftAccidentReport,
  updateAccidentReport,
  submitAccidentReport,
  saveEmergencyDraft,
  uploadAccidentPhoto,
  deleteAccidentPhoto,
  captureGpsLocation,
  validateAccidentReport,
  validateEmergencyDraft,
} from '../../lib/accidentReports'
import type {
  AccidentReport,
  AccidentReportPhoto,
  ManualLocation,
  PhotoCategory,
} from '../../lib/accidentReports'

// ── Constants ─────────────────────────────────────────────────────────────────

const ACCENT    = '#ff6b35'   // warm orange — urgent but not alarming
const ACCENT_BG = 'rgba(255,107,53,0.10)'
const ACCENT_BD = 'rgba(255,107,53,0.30)'

type WizardStep = 'checklist' | 'location' | 'documentation' | 'photos' | 'review'

const STEPS: { key: WizardStep; label: string; icon: string }[] = [
  { key: 'checklist',     label: 'Safety',   icon: '🛡️'  },
  { key: 'location',      label: 'Location', icon: '📍' },
  { key: 'documentation', label: 'Details',  icon: '📋' },
  { key: 'photos',        label: 'Photos',   icon: '📷' },
  { key: 'review',        label: 'Submit',   icon: '✅' },
]

type DriverVariant = 'consumer' | 'commercial'

// ── Root component ────────────────────────────────────────────────────────────

export default function AccidentReportWizard() {
  const navigate                = useNavigate()
  const location                = useLocation()
  const { user, profile }       = useAuthStore()

  // Determine driver variant from profile or URL state
  const driverType  = useRef<DriverVariant>(
    (location.state as { driverType?: DriverVariant } | null)?.driverType ??
    (profile?.driver_service_type === 'driver_1099' ? 'consumer' : 'commercial'),
  )

  // ── Report state ───────────────────────────────────────────────────────────

  const [reportId,      setReportId]      = useState<string | null>(null)
  const [report,        setReport]        = useState<Partial<AccidentReport>>({
    driver_type:              driverType.current,
    checklist_completed:      [],
    all_checklist_done:       false,
    headquarters_call_clicked: false,
    photo_safety_exception:   false,
    injury_involved:          null,
    emergency_services_called: null,
  })
  const [photos,        setPhotos]        = useState<AccidentReportPhoto[]>([])
  const [step,          setStep]          = useState<WizardStep>('checklist')
  const [saving,        setSaving]        = useState(false)
  const [submitting,    setSubmitting]    = useState(false)
  const [exitWarning,   setExitWarning]   = useState(false)
  const [draftSaved,    setDraftSaved]    = useState(false)
  const [submitted,     setSubmitted]     = useState(false)
  const [error,         setError]         = useState<string | null>(null)
  const [initError,     setInitError]     = useState<string | null>(null)
  const [toast,         setToast]         = useState<string | null>(null)

  const isCommercial = driverType.current === 'commercial'
  const accidentTypes = isCommercial ? COMMERCIAL_ACCIDENT_TYPES : CONSUMER_ACCIDENT_TYPES

  // ── Create draft on mount ──────────────────────────────────────────────────

  useEffect(() => {
    if (!user) return
    const driverName = profile?.full_name ?? user.email ?? 'Driver'

    createDraftAccidentReport(user.id, driverName, driverType.current).then((res) => {
      if (res.ok && res.data) {
        setReportId(res.data.id)
        setReport(prev => ({
          ...prev,
          id:           res.data!.id,
          driver_id:    user.id,
          driver_name:  driverName,
          incident_date: res.data!.incident_date,
          incident_time: res.data!.incident_time,
        }))
      } else {
        setInitError(res.error ?? 'Could not create report. Please try again.')
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // ── Auto-save to DB whenever report changes ───────────────────────────────

  const autoSave = useCallback(async (updates: Partial<AccidentReport>) => {
    if (!reportId) return
    setReport(prev => ({ ...prev, ...updates }))
    await updateAccidentReport(reportId, updates)
  }, [reportId])

  // ── Progress bar ──────────────────────────────────────────────────────────

  const stepIndex  = STEPS.findIndex(s => s.key === step)

  // ── Show toast ────────────────────────────────────────────────────────────

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  // ── Handle back / exit attempt ────────────────────────────────────────────

  function handleExitAttempt() {
    setExitWarning(true)
  }

  function handleContinueReport() {
    setExitWarning(false)
  }

  async function handleSaveEmergencyDraft() {
    if (!reportId) return
    const validation = validateEmergencyDraft(report, photos)
    if (!validation.valid) {
      setError(validation.missing.join('\n'))
      return
    }
    setSaving(true)
    const res = await saveEmergencyDraft(reportId, report)
    setSaving(false)
    if (res.ok) {
      setDraftSaved(true)
    } else {
      setError(res.error ?? 'Could not save draft.')
    }
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!reportId) return
    const validation = validateAccidentReport(report, photos)
    if (!validation.valid) {
      setError(validation.missing.map(m => `• ${m}`).join('\n'))
      return
    }
    setSubmitting(true)
    // Final sync of all fields
    await updateAccidentReport(reportId, { ...report, all_checklist_done: true })
    const res = await submitAccidentReport(reportId)
    setSubmitting(false)
    if (res.ok) {
      setSubmitted(true)
    } else {
      setError(res.error ?? 'Could not submit report. Please try again.')
    }
  }

  // ── Submitted screen ───────────────────────────────────────────────────────

  if (submitted) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center px-6 text-center"
        style={{ background: 'linear-gradient(160deg,#0d1117 0%,#0a1a2e 100%)', zIndex: 9999 }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
        <p style={{ fontSize: 22, fontWeight: 900, color: '#fff', marginBottom: 10 }}>
          Report Submitted
        </p>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', maxWidth: 320, lineHeight: 1.6 }}>
          Your accident / incident report has been submitted to Cyan's Brooklynn Recycling.
          A team member will review it shortly.
        </p>
        <div style={{
          marginTop: 20, padding: '12px 18px',
          background: ACCENT_BG, border: `1px solid ${ACCENT_BD}`,
          borderRadius: 14, maxWidth: 320, width: '100%',
        }}>
          <p style={{ fontSize: 12, color: ACCENT, fontWeight: 700 }}>
            ⚠️ Do not leave the scene unless authorized by law enforcement, emergency personnel, headquarters, or dispatch.
          </p>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="mt-8 w-full max-w-sm py-4 rounded-2xl font-bold text-sm"
          style={{ background: ACCENT, color: '#fff' }}
        >
          Return to Dashboard
        </button>
      </div>
    )
  }

  // ── Draft saved screen ─────────────────────────────────────────────────────

  if (draftSaved) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center px-6 text-center"
        style={{ background: 'linear-gradient(160deg,#0d1117 0%,#0a1a2e 100%)', zIndex: 9999 }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>💾</div>
        <p style={{ fontSize: 22, fontWeight: 900, color: '#fff', marginBottom: 10 }}>
          Emergency Draft Saved
        </p>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', maxWidth: 320, lineHeight: 1.6 }}>
          Your draft has been saved. Return to the report when you are in a safe location
          to complete and submit the full report.
        </p>
        <a
          href={HQ_PHONE_TEL}
          className="mt-6 w-full max-w-sm py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2"
          style={{ background: ACCENT_BG, border: `1px solid ${ACCENT_BD}`, color: ACCENT }}
        >
          📞 Call Headquarters — {HQ_PHONE_NUMBER}
        </a>
        <button
          onClick={() => { setDraftSaved(false); setExitWarning(false) }}
          className="mt-3 w-full max-w-sm py-4 rounded-2xl font-bold text-sm"
          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }}
        >
          Continue Report
        </button>
        <button
          onClick={() => navigate(-1)}
          className="mt-3 text-xs"
          style={{ color: 'rgba(255,255,255,0.35)' }}
        >
          Return to Dashboard
        </button>
      </div>
    )
  }

  // ── Init error ─────────────────────────────────────────────────────────────

  if (initError) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center px-6 text-center"
        style={{ background: 'linear-gradient(160deg,#0d1117 0%,#0a1a2e 100%)', zIndex: 9999 }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
        <p style={{ fontSize: 18, fontWeight: 700, color: '#f87171', marginBottom: 8 }}>Unable to Start Report</p>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 24 }}>{initError}</p>
        <a href={HQ_PHONE_TEL} className="w-full max-w-sm py-4 rounded-2xl font-bold text-sm text-center"
          style={{ background: ACCENT, color: '#fff', display: 'block' }}>
          📞 Call Headquarters Now — {HQ_PHONE_NUMBER}
        </a>
        <button onClick={() => navigate(-1)} className="mt-4 text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
          Go Back
        </button>
      </div>
    )
  }

  // ── Exit warning dialog ────────────────────────────────────────────────────

  if (exitWarning) {
    const draftValidation = validateEmergencyDraft(report, photos)

    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center px-6"
        style={{ background: 'rgba(0,0,0,0.92)', zIndex: 9999 }}>
        <div style={{
          background: 'linear-gradient(160deg,#0d1117,#0a1a2e)',
          border: `1px solid ${ACCENT_BD}`,
          borderRadius: 24, padding: 28, maxWidth: 380, width: '100%',
        }}>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
            <p style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 10 }}>
              You must complete this accident report before closing.
            </p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
              This protects you, the company, the customer, and the public.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              onClick={handleContinueReport}
              className="w-full py-4 rounded-2xl font-bold text-sm"
              style={{ background: ACCENT, color: '#fff' }}
            >
              📋 Continue Report
            </button>

            <a
              href={HQ_PHONE_TEL}
              className="w-full py-4 rounded-2xl font-bold text-sm text-center"
              style={{ background: ACCENT_BG, border: `1px solid ${ACCENT_BD}`, color: ACCENT, display: 'block' }}
            >
              📞 Call Headquarters — {HQ_PHONE_NUMBER}
            </a>

            {draftValidation.valid ? (
              <button
                onClick={handleSaveEmergencyDraft}
                disabled={saving}
                className="w-full py-4 rounded-2xl font-bold text-sm"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)' }}
              >
                {saving ? 'Saving…' : '💾 Save Emergency Draft'}
              </button>
            ) : (
              <div style={{
                padding: '10px 14px',
                background: 'rgba(255,255,255,0.04)',
                borderRadius: 14,
                border: '1px solid rgba(255,255,255,0.08)',
              }}>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>
                  Complete these to unlock emergency draft:
                </p>
                {draftValidation.missing.map((m, i) => (
                  <p key={i} style={{ fontSize: 11, color: '#f87171', marginTop: 4 }}>• {m}</p>
                ))}
              </div>
            )}

            {error && (
              <p style={{ fontSize: 12, color: '#f87171', textAlign: 'center' }}>{error}</p>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Main layout ────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 flex flex-col"
      style={{ background: 'linear-gradient(160deg,#0d1117 0%,#0a1a2e 100%)', zIndex: 9999 }}>

      {/* ── Header ── */}
      <div style={{
        padding: '16px 20px 0',
        borderBottom: '1px solid rgba(255,107,53,0.15)',
        background: 'rgba(0,0,0,0.3)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, color: ACCENT, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              🛡️ {isCommercial ? 'Commercial' : 'Consumer'} Driver
            </p>
            <p style={{ fontSize: 16, fontWeight: 900, color: '#fff', marginTop: 1 }}>
              Accident / Incident Report
            </p>
          </div>
          <button onClick={handleExitAttempt}
            style={{ fontSize: 22, color: 'rgba(255,255,255,0.3)', background: 'none', border: 'none', padding: 4, cursor: 'pointer' }}>
            ✕
          </button>
        </div>

        {/* Progress bar */}
        <div style={{ display: 'flex', gap: 6, paddingBottom: 14 }}>
          {STEPS.map((s, i) => (
            <div key={s.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{
                height: 4, width: '100%', borderRadius: 2,
                background: i <= stepIndex ? ACCENT : 'rgba(255,255,255,0.12)',
                transition: 'background 0.3s',
              }} />
              <p style={{ fontSize: 9, color: i <= stepIndex ? ACCENT : 'rgba(255,255,255,0.3)', fontWeight: 700 }}>
                {s.icon} {s.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Step content ── */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '20px 20px 100px' }}>

        {step === 'checklist' && (
          <StepChecklist
            report={report}
            onUpdate={autoSave}
            onNext={() => setStep('location')}
          />
        )}

        {step === 'location' && (
          <StepLocation
            report={report}
            onUpdate={autoSave}
            onNext={() => setStep('documentation')}
            onBack={() => setStep('checklist')}
          />
        )}

        {step === 'documentation' && (
          <StepDocumentation
            report={report}
            isCommercial={isCommercial}
            accidentTypes={[...accidentTypes]}
            onUpdate={autoSave}
            onNext={() => setStep('photos')}
            onBack={() => setStep('location')}
          />
        )}

        {step === 'photos' && (
          <StepPhotos
            reportId={reportId}
            driverId={user?.id ?? ''}
            photos={photos}
            report={report}
            onPhotosChange={setPhotos}
            onUpdate={autoSave}
            onNext={() => setStep('review')}
            onBack={() => setStep('documentation')}
            showToast={showToast}
          />
        )}

        {step === 'review' && (
          <StepReview
            report={report}
            photos={photos}
            isCommercial={isCommercial}
            submitting={submitting}
            error={error}
            onClearError={() => setError(null)}
            onSubmit={handleSubmit}
            onBack={() => setStep('photos')}
          />
        )}

      </div>

      {/* ── Toast ── */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-sm font-semibold"
          style={{
            background: 'rgba(255,107,53,0.15)',
            border: `1px solid ${ACCENT_BD}`,
            color: ACCENT,
            backdropFilter: 'blur(12px)',
            whiteSpace: 'nowrap',
            maxWidth: 'calc(100vw - 32px)',
          }}>
          {toast}
        </div>
      )}
    </div>
  )
}

// ── Step 1: Safety Checklist ──────────────────────────────────────────────────

function StepChecklist({
  report,
  onUpdate,
  onNext,
}: {
  report:   Partial<AccidentReport>
  onUpdate: (u: Partial<AccidentReport>) => void
  onNext:   () => void
}) {
  const checked  = new Set<string>(report.checklist_completed ?? [])
  const allDone  = CHECKLIST_STEPS.every(s => checked.has(s.key))

  function toggle(key: string) {
    const next = new Set<string>(checked)
    if (next.has(key)) next.delete(key); else next.add(key)
    const arr = CHECKLIST_STEPS.map(s => s.key).filter(k => next.has(k))
    onUpdate({ checklist_completed: arr, all_checklist_done: arr.length === CHECKLIST_STEPS.length })
  }

  const hqClicked    = report.headquarters_call_clicked ?? false
  const hqTimestamp  = report.headquarters_call_timestamp

  function handleHqCall() {
    const ts = new Date().toISOString()
    onUpdate({ headquarters_call_clicked: true, headquarters_call_timestamp: ts })
  }

  return (
    <div style={{ maxWidth: 520, margin: '0 auto' }}>
      <p style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 6 }}>
        🛡️ Accident Safety Checklist
      </p>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 20, lineHeight: 1.5 }}>
        Complete each step in order. All steps must be checked before you can submit
        the incident report.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* Steps 1–4 */}
        {[
          { key: 'stop',     num: 1, label: 'Stop vehicle immediately.' },
          { key: 'hazards',  num: 2, label: 'Activate hazard lights.' },
          { key: 'injuries', num: 3, label: 'Assess injuries.' },
          { key: 'emergency',num: 4, label: 'Call emergency services if required.' },
        ].map(s => (
          <ChecklistItem
            key={s.key}
            stepNum={s.num}
            label={s.label}
            checked={checked.has(s.key)}
            onToggle={() => toggle(s.key)}
          />
        ))}

        {/* Emergency note */}
        <div style={{
          padding: '12px 14px',
          background: 'rgba(248,113,113,0.08)',
          border: '1px solid rgba(248,113,113,0.25)',
          borderRadius: 14,
          marginLeft: 8,
        }}>
          <p style={{ fontSize: 12, color: '#f87171', fontWeight: 600, lineHeight: 1.5 }}>
            🚨 If anyone is injured, if there is fire, danger, blocked roadway, hazardous material,
            or serious property damage, call 911 immediately.
          </p>
        </div>

        {/* Step 5 — Photos */}
        <ChecklistItem
          stepNum={5}
          label="Take photographs."
          checked={checked.has('photos')}
          onToggle={() => toggle('photos')}
          subItems={[
            'Entire scene', 'Both vehicles', 'License plates',
            'Damage', 'Road conditions', 'Weather conditions',
          ]}
        />

        {/* Step 6 — HQ notification */}
        <div>
          <ChecklistItem
            stepNum={6}
            label="Notify dispatch / headquarters."
            checked={checked.has('hq_notify') && hqClicked}
            onToggle={() => toggle('hq_notify')}
          />
          <div style={{ marginLeft: 36, marginTop: 8 }}>
            {hqClicked ? (
              <div style={{
                padding: '10px 14px',
                background: 'rgba(74,222,128,0.08)',
                border: '1px solid rgba(74,222,128,0.2)',
                borderRadius: 12,
              }}>
                <p style={{ fontSize: 12, color: '#4ade80', fontWeight: 700 }}>
                  ☑ Headquarters call initiated
                  {hqTimestamp && (
                    <span style={{ fontWeight: 400, color: 'rgba(74,222,128,0.7)', marginLeft: 6 }}>
                      at {new Date(hqTimestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </span>
                  )}
                </p>
              </div>
            ) : (
              <a
                href={HQ_PHONE_TEL}
                onClick={handleHqCall}
                style={{
                  display: 'block', padding: '14px 18px',
                  background: ACCENT_BG, border: `2px solid ${ACCENT}`,
                  borderRadius: 14, textAlign: 'center',
                  color: ACCENT, fontWeight: 800, fontSize: 15,
                  textDecoration: 'none',
                }}
              >
                📞 Call Headquarters Now
              </a>
            )}
          </div>
        </div>

        {/* Steps 7–8 */}
        <ChecklistItem
          stepNum={7}
          label="Complete incident report."
          checked={checked.has('report')}
          onToggle={() => toggle('report')}
        />
        <ChecklistItem
          stepNum={8}
          label="Await instructions."
          checked={checked.has('await')}
          onToggle={() => toggle('await')}
        />

        {/* Await warning */}
        <div style={{
          padding: '12px 14px',
          background: 'rgba(251,191,36,0.08)',
          border: '1px solid rgba(251,191,36,0.25)',
          borderRadius: 14,
          marginLeft: 8,
        }}>
          <p style={{ fontSize: 12, color: '#fbbf24', fontWeight: 600, lineHeight: 1.5 }}>
            ⚠️ Do not leave the scene or continue the route until headquarters, dispatch,
            law enforcement, or emergency personnel instruct you to do so.
          </p>
        </div>

      </div>

      {/* Next button */}
      <div style={{ marginTop: 28 }}>
        {!allDone && (
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', textAlign: 'center', marginBottom: 10 }}>
            Complete all {CHECKLIST_STEPS.length} steps to continue
            ({CHECKLIST_STEPS.length - checked.size} remaining)
          </p>
        )}
        {!hqClicked && (
          <p style={{ fontSize: 12, color: '#f87171', textAlign: 'center', marginBottom: 10 }}>
            You must press "Call Headquarters Now" before continuing
          </p>
        )}
        <button
          onClick={onNext}
          disabled={!allDone || !hqClicked}
          style={{
            width: '100%', padding: '16px', borderRadius: 18,
            background: allDone && hqClicked ? ACCENT : 'rgba(255,255,255,0.07)',
            color: allDone && hqClicked ? '#fff' : 'rgba(255,255,255,0.3)',
            border: 'none', fontSize: 15, fontWeight: 800, cursor: allDone && hqClicked ? 'pointer' : 'default',
            transition: 'background 0.2s',
          }}
        >
          Continue to Location →
        </button>
      </div>
    </div>
  )
}

function ChecklistItem({
  stepNum, label, checked, onToggle, subItems,
}: {
  stepNum:   number
  label:     string
  checked:   boolean
  onToggle:  () => void
  subItems?: string[]
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'flex-start', gap: 12, width: '100%',
          background: checked ? 'rgba(74,222,128,0.06)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${checked ? 'rgba(74,222,128,0.25)' : 'rgba(255,255,255,0.1)'}`,
          borderRadius: 14, padding: '14px 16px', cursor: 'pointer', textAlign: 'left',
          transition: 'background 0.2s, border-color 0.2s',
        }}
      >
        {/* Checkbox */}
        <div style={{
          width: 24, height: 24, borderRadius: 8, flexShrink: 0, marginTop: 1,
          background: checked ? '#4ade80' : 'rgba(255,255,255,0.08)',
          border: `2px solid ${checked ? '#4ade80' : 'rgba(255,255,255,0.2)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {checked && <span style={{ fontSize: 14, color: '#000', fontWeight: 900 }}>✓</span>}
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: checked ? '#4ade80' : '#fff' }}>
            Step {stepNum} — {label}
          </p>
          {subItems && (
            <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: '4px 10px' }}>
              {subItems.map(item => (
                <p key={item} style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>☐ {item}</p>
              ))}
            </div>
          )}
        </div>
      </button>
    </div>
  )
}

// ── Step 2: Location ──────────────────────────────────────────────────────────

function StepLocation({
  report,
  onUpdate,
  onNext,
  onBack,
}: {
  report:   Partial<AccidentReport>
  onUpdate: (u: Partial<AccidentReport>) => void
  onNext:   () => void
  onBack:   () => void
}) {
  const [gpsLoading,   setGpsLoading]   = useState(false)
  const [gpsStatus,    setGpsStatus]    = useState<'idle' | 'success' | 'failed'>(
    report.gps_latitude != null ? 'success' : 'idle',
  )
  const [gpsError,     setGpsError]     = useState<string | null>(null)
  const [manualMode,   setManualMode]   = useState(
    report.gps_latitude == null && !!(report.manual_location),
  )
  const [manual,       setManual]       = useState<ManualLocation>(
    (report.manual_location as ManualLocation) ?? { street: '', city: '', state: '', zip: '', landmark: '', notes: '' },
  )

  async function handleGetGps() {
    setGpsLoading(true)
    setGpsError(null)
    const res = await captureGpsLocation()
    setGpsLoading(false)
    if (res.ok) {
      setGpsStatus('success')
      onUpdate({
        gps_latitude:  res.data.latitude,
        gps_longitude: res.data.longitude,
        gps_accuracy:  res.data.accuracy,
        gps_timestamp: res.data.timestamp,
      })
    } else {
      setGpsStatus('failed')
      setGpsError(res.error)
      setManualMode(true)
    }
  }

  function updateManual(field: keyof ManualLocation, val: string) {
    const next = { ...manual, [field]: val }
    setManual(next)
    onUpdate({ manual_location: next })
  }

  const hasLocation = gpsStatus === 'success'
    || (manualMode && (manual.street.trim() || manual.city.trim()))

  return (
    <div style={{ maxWidth: 520, margin: '0 auto' }}>
      <p style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 6 }}>📍 Incident Location</p>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 20, lineHeight: 1.5 }}>
        Capture your GPS location now for accurate documentation. If GPS is unavailable,
        enter the location manually.
      </p>

      {/* GPS button */}
      <button
        onClick={handleGetGps}
        disabled={gpsLoading}
        style={{
          width: '100%', padding: '18px', borderRadius: 18,
          background: gpsStatus === 'success' ? 'rgba(74,222,128,0.08)' : ACCENT_BG,
          border: `2px solid ${gpsStatus === 'success' ? 'rgba(74,222,128,0.4)' : ACCENT}`,
          color: gpsStatus === 'success' ? '#4ade80' : ACCENT,
          fontWeight: 800, fontSize: 15, cursor: gpsLoading ? 'default' : 'pointer',
          marginBottom: 12,
        }}
      >
        {gpsLoading ? '📡 Getting location…' :
         gpsStatus === 'success' ? '✅ GPS Location Captured' :
         '📡 Get Accurate GPS Location'}
      </button>

      {/* GPS result */}
      {gpsStatus === 'success' && report.gps_latitude && (
        <div style={{
          padding: '12px 16px',
          background: 'rgba(74,222,128,0.06)',
          border: '1px solid rgba(74,222,128,0.2)',
          borderRadius: 14, marginBottom: 16,
        }}>
          <p style={{ fontSize: 12, color: '#4ade80', fontWeight: 700, marginBottom: 4 }}>
            📍 Location saved
          </p>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
            {report.gps_latitude.toFixed(6)}, {report.gps_longitude?.toFixed(6)}
          </p>
          {report.gps_accuracy != null && (
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
              Accuracy: ±{Math.round(report.gps_accuracy)} m
            </p>
          )}
          {report.gps_timestamp && (
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
              Captured: {new Date(report.gps_timestamp).toLocaleTimeString()}
            </p>
          )}
        </div>
      )}

      {/* GPS error */}
      {gpsError && (
        <div style={{
          padding: '10px 14px', background: 'rgba(248,113,113,0.08)',
          border: '1px solid rgba(248,113,113,0.25)', borderRadius: 12, marginBottom: 16,
        }}>
          <p style={{ fontSize: 12, color: '#f87171' }}>
            ⚠️ GPS unavailable. Enter location manually.
          </p>
        </div>
      )}

      {/* Manual location toggle */}
      <button
        onClick={() => setManualMode(m => !m)}
        style={{
          fontSize: 12, color: manualMode ? 'rgba(255,255,255,0.4)' : ACCENT,
          background: 'none', border: 'none', cursor: 'pointer', marginBottom: 12, padding: 0,
        }}
      >
        {manualMode ? '▼ Manual location fields open' : '+ Enter location manually'}
      </button>

      {/* Manual fields */}
      {manualMode && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Field label="Street / Intersection" value={manual.street} onChange={v => updateManual('street', v)} placeholder="123 Main St or Main & 5th" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="City" value={manual.city} onChange={v => updateManual('city', v)} placeholder="City" />
            <Field label="State" value={manual.state} onChange={v => updateManual('state', v)} placeholder="State" />
          </div>
          <Field label="ZIP Code" value={manual.zip} onChange={v => updateManual('zip', v)} placeholder="ZIP" />
          <Field label="Landmark or Nearby Business" value={manual.landmark} onChange={v => updateManual('landmark', v)} placeholder="Near McDonald's on Oak Ave" />
          <FieldTextarea label="Location Notes" value={manual.notes} onChange={v => updateManual('notes', v)} placeholder="Additional location details…" rows={3} />
        </div>
      )}

      <nav style={{ display: 'flex', gap: 10, marginTop: 28 }}>
        <BackBtn onClick={onBack} />
        <button
          onClick={onNext}
          disabled={!hasLocation}
          style={{
            flex: 1, padding: '16px', borderRadius: 18,
            background: hasLocation ? ACCENT : 'rgba(255,255,255,0.07)',
            color: hasLocation ? '#fff' : 'rgba(255,255,255,0.3)',
            border: 'none', fontWeight: 800, fontSize: 15,
            cursor: hasLocation ? 'pointer' : 'default',
          }}
        >
          Continue to Details →
        </button>
      </nav>
    </div>
  )
}

// ── Step 3: Documentation ─────────────────────────────────────────────────────

function StepDocumentation({
  report,
  isCommercial,
  accidentTypes,
  onUpdate,
  onNext,
  onBack,
}: {
  report:       Partial<AccidentReport>
  isCommercial: boolean
  accidentTypes: string[]
  onUpdate:     (u: Partial<AccidentReport>) => void
  onNext:       () => void
  onBack:       () => void
}) {
  function upd<K extends keyof AccidentReport>(key: K, val: AccidentReport[K]) {
    onUpdate({ [key]: val } as Partial<AccidentReport>)
  }

  const canNext = !!(
    report.accident_type &&
    report.injury_involved &&
    report.emergency_services_called &&
    report.driver_statement?.trim()
  )

  return (
    <div style={{ maxWidth: 520, margin: '0 auto' }}>
      <p style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 6 }}>
        📋 Incident Details
      </p>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 20, lineHeight: 1.5 }}>
        Complete all required fields (marked *). Be as specific as possible — this
        documentation protects you and the company.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        <SectionHeader>Basic Information</SectionHeader>

        <Field label="Driver Name" value={report.driver_name ?? ''} onChange={v => upd('driver_name', v)} />
        <FieldReadOnly label="Driver Type" value={isCommercial ? 'Commercial Driver' : 'Consumer / Residential Driver'} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Date *" value={report.incident_date ?? ''} onChange={v => upd('incident_date', v)} type="date" />
          <Field label="Time *" value={report.incident_time ?? ''} onChange={v => upd('incident_time', v)} type="time" />
        </div>

        <Field label="Vehicle ID or Description" value={report.vehicle_id ?? ''} onChange={v => upd('vehicle_id', v)} placeholder="License plate, make/model, or company vehicle ID" />

        <SectionHeader>Incident Classification</SectionHeader>

        <FieldSelect
          label="Accident / Incident Type *"
          value={report.accident_type ?? ''}
          onChange={v => upd('accident_type', v)}
          options={accidentTypes}
          placeholder="Select type…"
        />

        <FieldRadioGroup
          label="Was anyone injured? *"
          value={report.injury_involved ?? ''}
          onChange={v => upd('injury_involved', v as AccidentReport['injury_involved'])}
          options={[
            { value: 'yes',     label: 'Yes — injury occurred' },
            { value: 'no',      label: 'No injuries' },
            { value: 'unknown', label: 'Unknown at this time' },
          ]}
        />

        <FieldRadioGroup
          label="Were emergency services (911) called? *"
          value={report.emergency_services_called ?? ''}
          onChange={v => upd('emergency_services_called', v as AccidentReport['emergency_services_called'])}
          options={[
            { value: 'yes', label: 'Yes — emergency services called' },
            { value: 'no',  label: 'No — emergency services not needed' },
          ]}
        />

        <Field
          label="Police Report Number"
          value={report.police_report_number ?? ''}
          onChange={v => upd('police_report_number', v)}
          placeholder="Leave blank if no police report"
        />

        <SectionHeader>Conditions</SectionHeader>

        <Field label="Weather Conditions" value={report.weather ?? ''} onChange={v => upd('weather', v)} placeholder="Clear, rain, fog, snow, ice, wind…" />
        <Field label="Road Conditions" value={report.road_conditions ?? ''} onChange={v => upd('road_conditions', v)} placeholder="Dry, wet, icy, construction, potholes…" />

        <SectionHeader>Damage</SectionHeader>

        <FieldTextarea
          label="Damage Description"
          value={report.damage_description ?? ''}
          onChange={v => upd('damage_description', v)}
          placeholder="Describe all visible damage to vehicles, property, cargo, or equipment…"
          rows={4}
        />

        {/* Commercial-only fields */}
        {isCommercial && (
          <>
            <SectionHeader>Commercial Route Details</SectionHeader>
            <Field label="Commercial Route ID" value={report.commercial_route_id ?? ''} onChange={v => upd('commercial_route_id', v)} placeholder="Route/manifest ID if known" />
            <Field label="Business / Customer Name" value={report.commercial_business_name ?? ''} onChange={v => upd('commercial_business_name', v)} placeholder="Business name at pickup site" />
            <Field label="Bin / Container ID" value={report.commercial_bin_id ?? ''} onChange={v => upd('commercial_bin_id', v)} placeholder="Container number if involved" />
            <Field label="Pickup Site Name / Address" value={report.commercial_site_name ?? ''} onChange={v => upd('commercial_site_name', v)} placeholder="Site name or address" />
          </>
        )}

        <SectionHeader>Driver Statement *</SectionHeader>

        <FieldTextarea
          label="Driver Statement (required)"
          value={report.driver_statement ?? ''}
          onChange={v => upd('driver_statement', v)}
          placeholder={isCommercial
            ? 'Describe what happened in detail — include what you were doing (loading, backing, driving), what was struck or damaged, any spill or hazmat concern, and what actions you took…'
            : 'Describe what happened in detail — include your route location, what occurred (collision, damage, injury, confrontation, road hazard), and what actions you took…'}
          rows={6}
        />

        <SectionHeader>Other Party Information</SectionHeader>

        <Field label="Other Vehicle Driver Name" value={report.other_party_name ?? ''} onChange={v => upd('other_party_name', v)} placeholder="If another vehicle was involved" />
        <Field label="Other Vehicle License Plate" value={report.other_party_plate ?? ''} onChange={v => upd('other_party_plate', v)} placeholder="State and plate number" />
        <FieldTextarea label="Other Party Insurance Information" value={report.other_insurance ?? ''} onChange={v => upd('other_insurance', v)} placeholder="Insurance company, policy number, agent name…" rows={3} />

        <SectionHeader>Witness Information</SectionHeader>

        <Field label="Witness Name" value={report.witness_name ?? ''} onChange={v => upd('witness_name', v)} placeholder="First and last name" />
        <Field label="Witness Phone or Email" value={report.witness_contact ?? ''} onChange={v => upd('witness_contact', v)} placeholder="Contact info" />
        <FieldTextarea label="Witness Statement" value={report.witness_statement ?? ''} onChange={v => upd('witness_statement', v)} placeholder="What did the witness see?" rows={4} />

      </div>

      {!canNext && (
        <p style={{ fontSize: 12, color: '#f87171', textAlign: 'center', marginTop: 16 }}>
          Required: accident type, injury status, emergency services answer, and driver statement
        </p>
      )}

      <nav style={{ display: 'flex', gap: 10, marginTop: 28 }}>
        <BackBtn onClick={onBack} />
        <button
          onClick={onNext}
          disabled={!canNext}
          style={{
            flex: 1, padding: '16px', borderRadius: 18,
            background: canNext ? ACCENT : 'rgba(255,255,255,0.07)',
            color: canNext ? '#fff' : 'rgba(255,255,255,0.3)',
            border: 'none', fontWeight: 800, fontSize: 15,
            cursor: canNext ? 'pointer' : 'default',
          }}
        >
          Continue to Photos →
        </button>
      </nav>
    </div>
  )
}

// ── Step 4: Photos ────────────────────────────────────────────────────────────

function StepPhotos({
  reportId,
  driverId,
  photos,
  report,
  onPhotosChange,
  onUpdate,
  onNext,
  onBack,
  showToast,
}: {
  reportId:       string | null
  driverId:       string
  photos:         AccidentReportPhoto[]
  report:         Partial<AccidentReport>
  onPhotosChange: (p: AccidentReportPhoto[]) => void
  onUpdate:       (u: Partial<AccidentReport>) => void
  onNext:         () => void
  onBack:         () => void
  showToast:      (msg: string) => void
}) {
  const [uploading,  setUploading]  = useState<PhotoCategory | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingCat, setPendingCat] = useState<PhotoCategory | null>(null)

  const exception  = report.photo_safety_exception ?? false
  const exReason   = report.photo_safety_reason ?? ''

  const uploadedByCategory = new Map<PhotoCategory, AccidentReportPhoto[]>()
  for (const p of photos) {
    if (!uploadedByCategory.has(p.category as PhotoCategory)) uploadedByCategory.set(p.category as PhotoCategory, [])
    uploadedByCategory.get(p.category as PhotoCategory)!.push(p)
  }

  function triggerUpload(cat: PhotoCategory) {
    if (!reportId) return
    setPendingCat(cat)
    fileInputRef.current?.click()
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !reportId || !pendingCat) return
    e.target.value = ''
    setUploading(pendingCat)

    const res = await uploadAccidentPhoto(reportId, driverId, file, pendingCat)
    setUploading(null)
    setPendingCat(null)

    if (res.ok && res.data) {
      onPhotosChange([...photos, res.data])
      showToast(`Photo uploaded: ${REQUIRED_PHOTO_CATEGORIES.find(c => c.key === pendingCat)?.label ?? pendingCat}`)
    } else {
      showToast(`Upload failed: ${res.error ?? 'Unknown error'}`)
    }
  }

  async function handleDelete(photoId: string) {
    await deleteAccidentPhoto(photoId)
    onPhotosChange(photos.filter(p => p.id !== photoId))
  }

  const missingCategories = exception ? [] : REQUIRED_PHOTO_CATEGORIES.filter(
    c => !uploadedByCategory.has(c.key as PhotoCategory),
  )
  const canNext = exception ? !!exReason.trim() : missingCategories.length === 0

  return (
    <div style={{ maxWidth: 520, margin: '0 auto' }}>
      <p style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 6 }}>📷 Photo Documentation</p>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 20, lineHeight: 1.5 }}>
        Upload photos for each required category. Use your camera or gallery.
        All categories are required unless a safety exception applies.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* Required categories */}
      {!exception && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
          {REQUIRED_PHOTO_CATEGORIES.map(cat => {
            const catPhotos = uploadedByCategory.get(cat.key as PhotoCategory) ?? []
            const done = catPhotos.length > 0
            const isUploading = uploading === cat.key

            return (
              <div key={cat.key} style={{
                background: done ? 'rgba(74,222,128,0.06)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${done ? 'rgba(74,222,128,0.25)' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: 16, padding: '14px 16px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: done ? 10 : 0 }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: done ? '#4ade80' : '#fff' }}>
                      {cat.icon} {cat.label}
                      {done && <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 6, color: 'rgba(74,222,128,0.7)' }}>({catPhotos.length} uploaded)</span>}
                    </p>
                  </div>
                  <button
                    onClick={() => triggerUpload(cat.key as PhotoCategory)}
                    disabled={!!isUploading}
                    style={{
                      padding: '8px 14px', borderRadius: 10,
                      background: done ? 'rgba(74,222,128,0.1)' : ACCENT_BG,
                      border: `1px solid ${done ? 'rgba(74,222,128,0.3)' : ACCENT_BD}`,
                      color: done ? '#4ade80' : ACCENT,
                      fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
                    }}
                  >
                    {isUploading ? '⏳' : done ? '+ Add' : '📷 Upload'}
                  </button>
                </div>

                {/* Photo previews */}
                {catPhotos.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {catPhotos.map(p => (
                      <div key={p.id} style={{ position: 'relative' }}>
                        <img
                          src={p.photo_url}
                          alt={cat.label}
                          style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 10, border: '2px solid rgba(74,222,128,0.3)' }}
                        />
                        <button
                          onClick={() => handleDelete(p.id)}
                          style={{
                            position: 'absolute', top: -6, right: -6,
                            width: 20, height: 20, borderRadius: '50%',
                            background: '#f87171', border: '2px solid #000',
                            color: '#fff', fontSize: 10, fontWeight: 900,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Safety exception */}
      <div style={{
        padding: '14px 16px',
        background: exception ? 'rgba(251,191,36,0.08)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${exception ? 'rgba(251,191,36,0.3)' : 'rgba(255,255,255,0.1)'}`,
        borderRadius: 16, marginBottom: 20,
      }}>
        <button
          onClick={() => onUpdate({ photo_safety_exception: !exception, photo_safety_reason: '' })}
          style={{
            display: 'flex', alignItems: 'center', gap: 10, width: '100%',
            background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
          }}
        >
          <div style={{
            width: 22, height: 22, borderRadius: 6, flexShrink: 0,
            background: exception ? '#fbbf24' : 'rgba(255,255,255,0.08)',
            border: `2px solid ${exception ? '#fbbf24' : 'rgba(255,255,255,0.2)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {exception && <span style={{ fontSize: 12, color: '#000', fontWeight: 900 }}>✓</span>}
          </div>
          <p style={{ fontSize: 13, fontWeight: 700, color: exception ? '#fbbf24' : 'rgba(255,255,255,0.6)' }}>
            Unable to take photo due to safety concern
          </p>
        </button>
        {exception && (
          <FieldTextarea
            label="Explain why photos could not be taken"
            value={exReason}
            onChange={v => onUpdate({ photo_safety_reason: v })}
            placeholder="Describe the safety concern that prevented photo documentation…"
            rows={3}
            style={{ marginTop: 12 }}
          />
        )}
      </div>

      {!canNext && !exception && (
        <p style={{ fontSize: 12, color: '#f87171', textAlign: 'center', marginBottom: 12 }}>
          {missingCategories.length} photo categor{missingCategories.length === 1 ? 'y' : 'ies'} still needed:&nbsp;
          {missingCategories.map(c => c.label).join(', ')}
        </p>
      )}

      <nav style={{ display: 'flex', gap: 10 }}>
        <BackBtn onClick={onBack} />
        <button
          onClick={onNext}
          disabled={!canNext}
          style={{
            flex: 1, padding: '16px', borderRadius: 18,
            background: canNext ? ACCENT : 'rgba(255,255,255,0.07)',
            color: canNext ? '#fff' : 'rgba(255,255,255,0.3)',
            border: 'none', fontWeight: 800, fontSize: 15,
            cursor: canNext ? 'pointer' : 'default',
          }}
        >
          Review & Submit →
        </button>
      </nav>
    </div>
  )
}

// ── Step 5: Review & Submit ───────────────────────────────────────────────────

function StepReview({
  report,
  photos,
  isCommercial,
  submitting,
  error,
  onClearError,
  onSubmit,
  onBack,
}: {
  report:       Partial<AccidentReport>
  photos:       AccidentReportPhoto[]
  isCommercial: boolean
  submitting:   boolean
  error:        string | null
  onClearError: () => void
  onSubmit:     () => void
  onBack:       () => void
}) {
  const validation = validateAccidentReport(report, photos)

  return (
    <div style={{ maxWidth: 520, margin: '0 auto' }}>
      <p style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 6 }}>✅ Review & Submit</p>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 20, lineHeight: 1.5 }}>
        Review your report before submission. Once submitted, your report will be
        sent to Cyan's Brooklynn Recycling for review.
      </p>

      {/* Summary cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        <SummaryRow icon="🛡️" label="Safety checklist" value={report.all_checklist_done ? '✅ Complete' : '⚠️ Incomplete'} ok={report.all_checklist_done} />
        <SummaryRow icon="📞" label="HQ call initiated" value={report.headquarters_call_clicked ? '✅ Yes' : '⚠️ Not yet'} ok={report.headquarters_call_clicked} />
        <SummaryRow icon="📍" label="Location" value={report.gps_latitude ? `GPS (${report.gps_latitude.toFixed(4)}, ${report.gps_longitude?.toFixed(4)})` : report.manual_location ? 'Manual location entered' : '⚠️ Missing'} ok={!!(report.gps_latitude || report.manual_location)} />
        <SummaryRow icon="🚨" label="Accident type" value={report.accident_type || '⚠️ Missing'} ok={!!report.accident_type} />
        <SummaryRow icon="🏥" label="Injury involved" value={report.injury_involved === 'yes' ? 'Yes' : report.injury_involved === 'no' ? 'No' : report.injury_involved === 'unknown' ? 'Unknown' : '⚠️ Not answered'} ok={!!report.injury_involved} />
        <SummaryRow icon="🚑" label="Emergency services" value={report.emergency_services_called === 'yes' ? 'Called' : report.emergency_services_called === 'no' ? 'Not needed' : '⚠️ Not answered'} ok={!!report.emergency_services_called} />
        <SummaryRow icon="📋" label="Driver statement" value={report.driver_statement?.trim() ? `${report.driver_statement.length} chars` : '⚠️ Missing'} ok={!!report.driver_statement?.trim()} />
        <SummaryRow icon="📷" label="Photos" value={report.photo_safety_exception ? `Safety exception: ${report.photo_safety_reason ? 'reason provided' : '⚠️ reason missing'}` : `${photos.length} photo${photos.length === 1 ? '' : 's'} uploaded`} ok={report.photo_safety_exception ? !!report.photo_safety_reason?.trim() : photos.length >= REQUIRED_PHOTO_CATEGORIES.length} />
        {isCommercial && (
          <SummaryRow icon="🏢" label="Route / site" value={report.commercial_route_id || report.commercial_business_name || 'Not provided'} ok={true} />
        )}
      </div>

      {/* Validation errors */}
      {!validation.valid && (
        <div style={{
          padding: '14px 16px',
          background: 'rgba(248,113,113,0.08)',
          border: '1px solid rgba(248,113,113,0.25)',
          borderRadius: 14, marginBottom: 20,
        }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#f87171', marginBottom: 8 }}>
            Complete these before submitting:
          </p>
          {validation.missing.map((m, i) => (
            <p key={i} style={{ fontSize: 12, color: '#f87171', marginTop: 4 }}>• {m}</p>
          ))}
        </div>
      )}

      {error && (
        <div style={{
          padding: '12px 14px',
          background: 'rgba(248,113,113,0.08)',
          border: '1px solid rgba(248,113,113,0.25)',
          borderRadius: 12, marginBottom: 16,
        }}>
          <p style={{ fontSize: 12, color: '#f87171', whiteSpace: 'pre-line' }}>{error}</p>
          <button onClick={onClearError} style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 6, background: 'none', border: 'none', cursor: 'pointer' }}>
            Dismiss
          </button>
        </div>
      )}

      <nav style={{ display: 'flex', gap: 10 }}>
        <BackBtn onClick={onBack} />
        <button
          onClick={onSubmit}
          disabled={!validation.valid || submitting}
          style={{
            flex: 1, padding: '18px', borderRadius: 18,
            background: validation.valid && !submitting ? ACCENT : 'rgba(255,255,255,0.07)',
            color: validation.valid && !submitting ? '#fff' : 'rgba(255,255,255,0.3)',
            border: 'none', fontWeight: 900, fontSize: 16,
            cursor: validation.valid && !submitting ? 'pointer' : 'default',
          }}
        >
          {submitting ? 'Submitting…' : '📤 Submit Report'}
        </button>
      </nav>
    </div>
  )
}

// ── Shared UI components ──────────────────────────────────────────────────────

function Field({
  label, value, onChange, placeholder, type = 'text', style: extraStyle,
}: {
  label:       string
  value:       string
  onChange:    (v: string) => void
  placeholder?: string
  type?:       string
  style?:      React.CSSProperties
}) {
  return (
    <div style={extraStyle}>
      <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </p>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', padding: '12px 14px', borderRadius: 12,
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
          color: '#fff', fontSize: 14, outline: 'none',
          boxSizing: 'border-box',
        }}
      />
    </div>
  )
}

function FieldReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </p>
      <div style={{
        padding: '12px 14px', borderRadius: 12,
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
        color: 'rgba(255,255,255,0.5)', fontSize: 14,
      }}>
        {value}
      </div>
    </div>
  )
}

function FieldTextarea({
  label, value, onChange, placeholder, rows = 4, style: extraStyle,
}: {
  label:       string
  value:       string
  onChange:    (v: string) => void
  placeholder?: string
  rows?:       number
  style?:      React.CSSProperties
}) {
  return (
    <div style={extraStyle}>
      <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </p>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        style={{
          width: '100%', padding: '12px 14px', borderRadius: 12,
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
          color: '#fff', fontSize: 14, outline: 'none', resize: 'vertical',
          boxSizing: 'border-box', lineHeight: 1.5,
        }}
      />
    </div>
  )
}

function FieldSelect({
  label, value, onChange, options, placeholder,
}: {
  label:       string
  value:       string
  onChange:    (v: string) => void
  options:     string[]
  placeholder?: string
}) {
  return (
    <div>
      <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </p>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%', padding: '12px 14px', borderRadius: 12,
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
          color: value ? '#fff' : 'rgba(255,255,255,0.35)', fontSize: 14, outline: 'none',
          boxSizing: 'border-box',
        }}
      >
        <option value="" disabled>{placeholder ?? 'Select…'}</option>
        {options.map(o => <option key={o} value={o} style={{ background: '#1a1a2e', color: '#fff' }}>{o}</option>)}
      </select>
    </div>
  )
}

function FieldRadioGroup({
  label, value, onChange, options,
}: {
  label:   string
  value:   string
  onChange: (v: string) => void
  options:  { value: string; label: string }[]
}) {
  return (
    <div>
      <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {options.map(opt => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
              borderRadius: 12, cursor: 'pointer', textAlign: 'left',
              background: value === opt.value ? ACCENT_BG : 'rgba(255,255,255,0.04)',
              border: `1px solid ${value === opt.value ? ACCENT_BD : 'rgba(255,255,255,0.1)'}`,
            }}
          >
            <div style={{
              width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
              background: value === opt.value ? ACCENT : 'rgba(255,255,255,0.1)',
              border: `2px solid ${value === opt.value ? ACCENT : 'rgba(255,255,255,0.25)'}`,
            }} />
            <p style={{ fontSize: 13, color: value === opt.value ? ACCENT : 'rgba(255,255,255,0.7)', fontWeight: value === opt.value ? 700 : 400 }}>
              {opt.label}
            </p>
          </button>
        ))}
      </div>
    </div>
  )
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)',
      letterSpacing: '0.1em', textTransform: 'uppercase',
      borderTop: '1px solid rgba(255,255,255,0.06)',
      paddingTop: 14, marginTop: 4,
    }}>
      {children}
    </p>
  )
}

function SummaryRow({
  icon, label, value, ok,
}: {
  icon:  string
  label: string
  value: string
  ok:    boolean | undefined
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10,
      padding: '10px 14px', borderRadius: 12,
      background: ok ? 'rgba(74,222,128,0.05)' : 'rgba(248,113,113,0.05)',
      border: `1px solid ${ok ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'}`,
    }}>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap' }}>
        {icon} {label}
      </p>
      <p style={{ fontSize: 12, color: ok ? 'rgba(255,255,255,0.8)' : '#f87171', textAlign: 'right', fontWeight: ok ? 400 : 600 }}>
        {value}
      </p>
    </div>
  )
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '16px 20px', borderRadius: 18,
        background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
        color: 'rgba(255,255,255,0.6)', fontWeight: 700, fontSize: 14, cursor: 'pointer',
      }}
    >
      ← Back
    </button>
  )
}
