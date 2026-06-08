// ManagementOnboardingWizard.tsx — Management Onboarding Wizard
//
// Phase MG.2 update: replaced all simple checkboxes with AgreementReview components.
// Acceptances are stored in management_agreement_acceptances per-agreement.
//
// Steps (12):
//   welcome → mission →
//   code_of_conduct → confidentiality → conflict_of_interest →
//   cybersecurity → safety → financial_controls →
//   department_training → assessment → agreement_signature → complete
//
// Certification gate: completeOnboarding() requires:
//   • allRequiredAccepted === true  (all 7 agreements accepted)
//   • assessmentPass === true       (assessment score >= 80%)

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuthStore } from '../../store/authStore'
import type { ManagementProfile } from '../../types'
import AgreementReview, { AcceptedBanner } from '../../components/management/AgreementReview'
import {
  MANAGEMENT_AGREEMENT_VERSION,
  REQUIRED_AGREEMENT_CODES,
  getAgreementByCode,
  CODE_OF_CONDUCT,
  CONFIDENTIALITY_AGREEMENT,
  CONFLICT_OF_INTEREST,
  TECHNOLOGY_SECURITY,
  SAFETY_COMPLIANCE,
  FINANCIAL_CONTROLS,
  MANAGEMENT_AGREEMENT,
} from '../../data/managementAgreementData'

// ── Step definitions ──────────────────────────────────────────────────────────

type WizardStep =
  | 'welcome'
  | 'mission'
  | 'code_of_conduct'
  | 'confidentiality'
  | 'conflict_of_interest'
  | 'cybersecurity'
  | 'safety'
  | 'financial_controls'
  | 'department_training'
  | 'assessment'
  | 'agreement_signature'
  | 'complete'

const STEPS: WizardStep[] = [
  'welcome',
  'mission',
  'code_of_conduct',
  'confidentiality',
  'conflict_of_interest',
  'cybersecurity',
  'safety',
  'financial_controls',
  'department_training',
  'assessment',
  'agreement_signature',
  'complete',
]

const STEP_LABELS: Record<WizardStep, string> = {
  welcome:              'Welcome',
  mission:              'Our Mission',
  code_of_conduct:      'Code of Conduct',
  confidentiality:      'Confidentiality',
  conflict_of_interest: 'Conflict of Interest',
  cybersecurity:        'Technology Security',
  safety:               'Safety',
  financial_controls:   'Financial Controls',
  department_training:  'Training Modules',
  assessment:           'Assessment',
  agreement_signature:  'Management Agreement',
  complete:             'Complete',
}

// ── Assessment questions ──────────────────────────────────────────────────────

interface AssessmentQuestion {
  id:      number
  question: string
  options:  string[]
  correct:  number
}

const ASSESSMENT_QUESTIONS: AssessmentQuestion[] = [
  { id: 1,  question: 'What is the public brand name used with customers and partners?',
    options: ["BayKid Platform", "Cyan's Brooklynn Recycling", "CBR Enterprise", "Green Community LLC"], correct: 1 },
  { id: 2,  question: 'Which of the following payment integrations is PROHIBITED without founder approval?',
    options: ['Check payments recorded manually', 'Cash payments recorded manually', 'Stripe Connect / ACH / routing numbers', 'Zelle payments recorded manually'], correct: 2 },
  { id: 3,  question: 'Under OSHA, a workplace fatality must be reported within:',
    options: ['24 hours', '8 hours', '48 hours', '72 hours'], correct: 1 },
  { id: 4,  question: 'What does a red inspection result at the warehouse require?',
    options: ['Process immediately at lower priority', 'Quarantine and supervisor review', 'Return to driver', 'Accept and document only'], correct: 1 },
  { id: 5,  question: "The official financial system for Cyan's Brooklynn is:",
    options: ['Stripe + QuickBooks', 'ACH disbursement service', 'Internal Wallet and Manual Payout Ledger', 'PayPal Business'], correct: 2 },
  { id: 6,  question: 'A conflict of interest must be handled by:',
    options: ['Managing it privately to avoid attention', 'Disclosing in writing and recusing from related decisions', 'Asking a peer to handle the decision instead', 'Proceeding if the impact is minor'], correct: 1 },
  { id: 7,  question: 'Driver earnings are recorded in which table?',
    options: ['wallet_transactions', 'driver_payments', 'payout_ledger', 'earnings_log'], correct: 2 },
  { id: 8,  question: 'What is the contamination rate threshold requiring a root cause investigation?',
    options: ['Any contamination at all', 'Greater than 5% for any material stream', 'Greater than 20% overall', 'Greater than 10% monthly'], correct: 1 },
  { id: 9,  question: 'Which OSHA regulation covers Personal Protective Equipment?',
    options: ['29 CFR 1910.147', '29 CFR 1910.132', '29 CFR 1910.38', '29 CFR 1910.1200'], correct: 1 },
  { id: 10, question: 'Retaliating against an employee for reporting a safety concern is:',
    options: ['Acceptable if the report was false', 'A minor policy infraction', 'Illegal under OSHA Section 11(c)', 'Acceptable under state law only'], correct: 2 },
  { id: 11, question: 'How quickly must a Severity 1 incident be escalated to director/executive?',
    options: ['Within 24 hours', 'Within 4 hours', 'Within 1 hour', 'Within 48 hours'], correct: 2 },
  { id: 12, question: 'MFA is required for management platform accounts:',
    options: ['Only for admin-level accounts', 'Only for accounts with finance access', 'For all management accounts, business email, and data-access tools', 'Only when accessing from outside the office'], correct: 2 },
  { id: 13, question: "A warehouse_supervisor's primary responsibility during intake is:",
    options: ['Operating the scale equipment', 'Approving inspections and managing floor assignments', 'Collecting payment from drivers', 'Updating the commercial customer dashboard'], correct: 1 },
  { id: 14, question: 'What is the correct first step in any incident investigation?',
    options: ['Identify the responsible employee', 'Secure the scene to prevent further harm or evidence loss', 'Submit the OSHA form', 'Conduct group witness interviews'], correct: 1 },
  { id: 15, question: 'Fundraiser campaign payouts should be communicated as ready for disbursement:',
    options: ['Once balance reaches $100', 'After 30 days of activity', 'Only after explicit founder authorization of the disbursement phase', 'Automatically when the campaign ends'], correct: 2 },
  { id: 16, question: 'The Anthropic API key must be stored:',
    options: ['In a VITE_ prefixed env variable', 'In browser localStorage', 'Server-side only — never in browser-visible code', 'In the public GitHub repository'], correct: 2 },
  { id: 17, question: 'What federal law primarily governs solid waste handling at a recycling facility?',
    options: ['OSHA General Industry Standard', 'Clean Air Act', 'RCRA (Resource Conservation and Recovery Act)', 'Fair Labor Standards Act'], correct: 2 },
  { id: 18, question: 'Which driver type completes a W-9, insurance verification, and payout deposit setup?',
    options: ['commercial_only', 'hybrid_driver (commercial mode only)', 'driver_1099', 'All driver types'], correct: 2 },
  { id: 19, question: 'An employee reports suspected financial record falsification to you. You should:',
    options: ['Investigate personally and correct it', 'Dismiss the concern as a misunderstanding', 'Escalate to admin and protect the reporting employee from retaliation', 'Ask for a written complaint first'], correct: 2 },
  { id: 20, question: 'The "5 Whys" root cause analysis technique is used to:',
    options: ['Identify and punish the responsible individual', 'Meet OSHA documentation requirements only', 'Get past surface symptoms and identify the underlying system failure', 'Create a timeline of events for legal review'], correct: 2 },
]

const PASSING_SCORE = Math.ceil(ASSESSMENT_QUESTIONS.length * 0.8) // 16 of 20

// ── Acceptance record type ────────────────────────────────────────────────────

interface AcceptanceRecord {
  signatureName: string
  acceptedAt:    string
  version:       string
}

// ── Shared UI helpers ────────────────────────────────────────────────────────

const BRAND        = '#00c8ff'
const BRAND_DIM    = 'rgba(0,200,255,0.12)'
const BRAND_BORDER = 'rgba(0,200,255,0.3)'
const SUCCESS      = '#4ade80'
const WARN         = '#fbbf24'

function WizardCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-6 sm:p-8"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(0,200,255,0.12)' }}>
      {children}
    </div>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-base font-bold mb-2" style={{ color: BRAND }}>{children}</h3>
  )
}

function NavButtons({
  onBack, onNext, nextLabel = 'Continue', nextDisabled = false, saving = false,
}: {
  onBack?:        () => void
  onNext:         () => void
  nextLabel?:     string
  nextDisabled?:  boolean
  saving?:        boolean
}) {
  return (
    <div className="flex justify-between mt-8 gap-4">
      {onBack ? (
        <button onClick={onBack}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.08)' }}>
          ← Back
        </button>
      ) : <div />}
      <button onClick={onNext} disabled={nextDisabled || saving}
        className="px-6 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
        style={{ background: BRAND, color: '#000' }}>
        {saving ? 'Saving…' : nextLabel}
      </button>
    </div>
  )
}

// ── Main wizard component ─────────────────────────────────────────────────────

export default function ManagementOnboardingWizard() {
  const { user } = useAuthStore()
  const navigate = useNavigate()

  const [profile,      setProfile]      = useState<ManagementProfile | null>(null)
  const [progressId,   setProgressId]   = useState<string | null>(null)
  const [currentStep,  setCurrentStep]  = useState<WizardStep>('welcome')
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  // Agreement acceptance records — keyed by agreement code
  const [acceptances, setAcceptances] = useState<Record<string, AcceptanceRecord>>({})

  // Assessment state
  const [answers,        setAnswers]        = useState<Record<number, number>>({})
  const [assessmentDone, setAssessmentDone] = useState(false)
  const [assessmentPass, setAssessmentPass] = useState(false)
  const [score,          setScore]          = useState(0)

  // Training acknowledgment (department_training step)
  const [trainingAcknowledged, setTrainingAcknowledged] = useState(false)

  // Certification gate: all 7 required agreements must be accepted
  const allRequiredAccepted = REQUIRED_AGREEMENT_CODES.every(code => !!acceptances[code])

  // ── Load profile + progress + acceptances ──────────────────────────────────
  const loadProfile = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const { data: mp, error: mpErr } = await supabase
        .from('management_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (mpErr) throw mpErr
      if (!mp) { setLoading(false); return }

      setProfile(mp as ManagementProfile)

      if (mp.onboarding_completed) {
        navigate('/management/dashboard', { replace: true })
        return
      }

      // Load progress
      const { data: prog, error: progErr } = await supabase
        .from('management_onboarding_progress')
        .select('*')
        .eq('management_profile_id', mp.id)
        .maybeSingle()

      if (progErr) throw progErr

      if (prog) {
        setProgressId(prog.id)
        setCurrentStep((prog.current_step as WizardStep) ?? 'welcome')
        setScore(prog.assessment_score ?? 0)
        setAssessmentPass(prog.assessment_passed ?? false)
        setAssessmentDone(prog.assessment_passed ?? false)
      }

      // Load existing agreement acceptances for this profile
      const { data: acceptData, error: acceptErr } = await supabase
        .from('management_agreement_acceptances')
        .select('agreement_code, agreement_version, signature_name, accepted_at')
        .eq('management_profile_id', mp.id)
        .eq('accepted', true)

      if (acceptErr) throw acceptErr

      if (acceptData && acceptData.length > 0) {
        const map: Record<string, AcceptanceRecord> = {}
        for (const row of acceptData) {
          // Only count acceptances for the current version
          if (row.agreement_version === MANAGEMENT_AGREEMENT_VERSION) {
            map[row.agreement_code] = {
              signatureName: row.signature_name ?? '',
              acceptedAt:    row.accepted_at ?? new Date().toISOString(),
              version:       row.agreement_version,
            }
          }
        }
        setAcceptances(map)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile')
    } finally {
      setLoading(false)
    }
  }, [user, navigate])

  useEffect(() => { loadProfile() }, [loadProfile])

  // ── Persist step progress ──────────────────────────────────────────────────
  const saveStep = useCallback(async (step: WizardStep, extra?: Record<string, unknown>) => {
    if (!profile) return
    setSaving(true)
    try {
      if (progressId) {
        const { error: upErr } = await supabase
          .from('management_onboarding_progress')
          .update({ current_step: step, ...extra })
          .eq('id', progressId)
        if (upErr) throw upErr
      } else {
        const { data: ins, error: insErr } = await supabase
          .from('management_onboarding_progress')
          .insert({ management_profile_id: profile.id, current_step: step, ...extra })
          .select('id')
          .single()
        if (insErr) throw insErr
        setProgressId(ins.id as string)
      }
      setCurrentStep(step)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }, [profile, progressId])

  const goToStep = (step: WizardStep) => saveStep(step)

  // ── Save agreement acceptance ──────────────────────────────────────────────
  const handleAcceptAgreement = useCallback(async (
    code:      string,
    sigName:   string,
    nextStep:  WizardStep,
  ) => {
    if (!profile) return
    setSaving(true)
    try {
      const now = new Date().toISOString()
      const { error: accErr } = await supabase
        .from('management_agreement_acceptances')
        .upsert({
          management_profile_id: profile.id,
          agreement_code:        code,
          agreement_version:     MANAGEMENT_AGREEMENT_VERSION,
          accepted:              true,
          signature_name:        sigName,
          accepted_at:           now,
        }, { onConflict: 'management_profile_id,agreement_code,agreement_version' })

      if (accErr) throw accErr

      setAcceptances(prev => ({
        ...prev,
        [code]: { signatureName: sigName, acceptedAt: now, version: MANAGEMENT_AGREEMENT_VERSION },
      }))

      await saveStep(nextStep)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save acceptance')
    } finally {
      setSaving(false)
    }
  }, [profile, saveStep])

  // ── Complete onboarding (final step — Management Agreement accepted) ───────
  const handleFinalAccept = useCallback(async (sigName: string) => {
    if (!profile) return
    if (!assessmentPass) {
      setError('Assessment must be passed before completing onboarding.')
      return
    }
    setSaving(true)
    try {
      const now = new Date().toISOString()

      // 1. Save the MANAGEMENT_AGREEMENT acceptance
      const { error: accErr } = await supabase
        .from('management_agreement_acceptances')
        .upsert({
          management_profile_id: profile.id,
          agreement_code:        MANAGEMENT_AGREEMENT,
          agreement_version:     MANAGEMENT_AGREEMENT_VERSION,
          accepted:              true,
          signature_name:        sigName,
          accepted_at:           now,
        }, { onConflict: 'management_profile_id,agreement_code,agreement_version' })

      if (accErr) throw accErr

      setAcceptances(prev => ({
        ...prev,
        [MANAGEMENT_AGREEMENT]: { signatureName: sigName, acceptedAt: now, version: MANAGEMENT_AGREEMENT_VERSION },
      }))

      // 2. Mark profile as certified + active
      const { error: profErr } = await supabase
        .from('management_profiles')
        .update({
          onboarding_completed:    true,
          onboarding_completed_at: now,
          certified:               true,
          certified_at:            now,
          status:                  'active',
        })
        .eq('id', profile.id)

      if (profErr) throw profErr

      // 3. Save final wizard step
      await saveStep('complete', {
        agreement_accepted: true,
        signature_name:     sigName,
        signature_date:     now,
        assessment_passed:  true,
        assessment_score:   score,
      })

      setCurrentStep('complete')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete onboarding')
    } finally {
      setSaving(false)
    }
  }, [profile, assessmentPass, score, saveStep])

  // ── Step index for progress bar ────────────────────────────────────────────
  const stepIdx = STEPS.indexOf(currentStep)

  // ── Agreement step helper ──────────────────────────────────────────────────
  // Renders AgreementReview or AcceptedBanner depending on whether the
  // agreement has already been accepted.
  function AgreementStep({
    code, prevStep, nextStep, acceptLabel,
  }: {
    code:         string
    prevStep:     WizardStep
    nextStep:     WizardStep
    acceptLabel?: string
  }) {
    const def        = getAgreementByCode(code)
    const acceptance = acceptances[code]

    if (!def) return null

    if (acceptance) {
      return (
        <WizardCard>
          <AcceptedBanner
            title={def.title}
            signatureName={acceptance.signatureName}
            acceptedAt={acceptance.acceptedAt}
          />
          <NavButtons
            onBack={() => goToStep(prevStep)}
            onNext={() => goToStep(nextStep)}
            saving={saving}
          />
        </WizardCard>
      )
    }

    return (
      <AgreementReview
        agreement={def}
        onAccept={sig => handleAcceptAgreement(code, sig, nextStep)}
        onBack={() => goToStep(prevStep)}
        saving={saving}
        acceptLabel={acceptLabel}
      />
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: '#060e24' }}>
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-t-transparent"
          style={{ borderColor: BRAND, borderTopColor: 'transparent' }} />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6" style={{ background: '#060e24' }}>
        <p className="text-white/60 text-center max-w-sm">
          No management profile found. Please contact an administrator to set up your management profile before completing onboarding.
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: '#060e24' }}>
      {/* Header */}
      <div className="sticky top-0 z-10 px-4 py-3"
        style={{ background: 'rgba(6,14,36,0.95)', borderBottom: '1px solid rgba(0,200,255,0.1)', backdropFilter: 'blur(10px)' }}>
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-xs font-bold tracking-widest" style={{ color: BRAND }}>CYAN'S BROOKLYNN RECYCLING</p>
            <p className="text-white font-bold text-lg leading-tight">Management Onboarding</p>
          </div>
          <div className="text-right">
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Step {stepIdx + 1} of {STEPS.length}</p>
            <p className="text-sm font-semibold text-white">{STEP_LABELS[currentStep]}</p>
          </div>
        </div>
        <div className="max-w-2xl mx-auto mt-2 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <div className="h-1 rounded-full transition-all duration-500"
            style={{ background: BRAND, width: `${((stepIdx + 1) / STEPS.length) * 100}%` }} />
        </div>
        {/* Agreement progress indicator */}
        {stepIdx >= 2 && stepIdx <= 10 && (
          <div className="max-w-2xl mx-auto mt-1.5">
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Agreements: {Object.keys(acceptances).filter(k => REQUIRED_AGREEMENT_CODES.includes(k)).length}/{REQUIRED_AGREEMENT_CODES.length} accepted
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="max-w-2xl mx-auto mt-4 px-4">
          <div className="p-3 rounded-xl text-sm text-red-300"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
            {error} — <button className="underline" onClick={() => setError(null)}>Dismiss</button>
          </div>
        </div>
      )}

      {/* Step content */}
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* ── Welcome ── */}
        {currentStep === 'welcome' && (
          <WizardCard>
            <div className="text-center mb-8">
              <div className="text-5xl mb-4">🏢</div>
              <h1 className="text-2xl font-bold text-white mb-2">Welcome to Management Onboarding</h1>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>Cyan's Brooklynn Recycling Enterprise LLC</p>
            </div>
            <div className="space-y-4 mb-8">
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>
                Welcome, <strong className="text-white">{profile.management_type}</strong> — {profile.department} department.
                This onboarding program covers everything you need to lead effectively and compliantly at Cyan's Brooklynn Recycling.
              </p>
              <div className="p-4 rounded-xl" style={{ background: BRAND_DIM, border: `1px solid ${BRAND_BORDER}` }}>
                <p className="text-xs font-bold mb-2" style={{ color: BRAND }}>What to expect</p>
                <ul className="text-sm space-y-1" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  <li>• Mission and company overview</li>
                  <li>• 7 required policy agreements — each requiring a digital signature</li>
                  <li>• Department training overview and acknowledgment</li>
                  <li>• 20-question management assessment (80% required to pass)</li>
                  <li>• Final Management Agreement and certification</li>
                </ul>
              </div>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Estimated time: 60–90 minutes. Progress saved automatically.
              </p>
            </div>
            <NavButtons onNext={() => goToStep('mission')} nextLabel="Begin Onboarding" saving={saving} />
          </WizardCard>
        )}

        {/* ── Mission ── */}
        {currentStep === 'mission' && (
          <WizardCard>
            <h2 className="text-xl font-bold text-white mb-6">Our Mission</h2>
            <div className="space-y-5">
              <div>
                <SectionHeading>Why We Exist</SectionHeading>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>
                  Cyan's Brooklynn Recycling exists to make recycling accessible, rewarding, and economically fair for everyone.
                  We believe that the people doing the work — drivers, warehouse employees, community fundraisers — deserve
                  transparent compensation and a platform that treats them as valued partners, not just labor.
                </p>
              </div>
              <div>
                <SectionHeading>The Problem We Solve</SectionHeading>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>
                  Too much recyclable material ends up in landfills because the infrastructure to collect it is fragmented,
                  unreliable, or economically unattractive. We build the connection between communities who want to recycle
                  and the processing infrastructure that can handle it — with a fair payout system that incentivizes participation.
                </p>
              </div>
              <div>
                <SectionHeading>Management's Role</SectionHeading>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>
                  Management personnel are the operational backbone. You keep routes running, warehouses safe, compliance current,
                  and teams motivated. Every decision you make either reinforces or undermines the mission.
                </p>
              </div>
              <div className="p-4 rounded-xl" style={{ background: 'rgba(74,222,128,0.07)', border: '1px solid rgba(74,222,128,0.2)' }}>
                <p className="text-xs font-bold mb-1" style={{ color: SUCCESS }}>Our Five Core Values</p>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  Community First · Fairness · Transparency · Environmental Responsibility · Continuous Improvement
                </p>
              </div>
            </div>
            <NavButtons onBack={() => goToStep('welcome')} onNext={() => goToStep('code_of_conduct')} saving={saving} />
          </WizardCard>
        )}

        {/* ── Code of Conduct (AgreementReview) ── */}
        {currentStep === 'code_of_conduct' && (
          <AgreementStep
            code={CODE_OF_CONDUCT}
            prevStep="mission"
            nextStep="confidentiality"
          />
        )}

        {/* ── Confidentiality (AgreementReview) ── */}
        {currentStep === 'confidentiality' && (
          <AgreementStep
            code={CONFIDENTIALITY_AGREEMENT}
            prevStep="code_of_conduct"
            nextStep="conflict_of_interest"
          />
        )}

        {/* ── Conflict of Interest (AgreementReview) ── */}
        {currentStep === 'conflict_of_interest' && (
          <AgreementStep
            code={CONFLICT_OF_INTEREST}
            prevStep="confidentiality"
            nextStep="cybersecurity"
          />
        )}

        {/* ── Technology Security (AgreementReview) ── */}
        {currentStep === 'cybersecurity' && (
          <AgreementStep
            code={TECHNOLOGY_SECURITY}
            prevStep="conflict_of_interest"
            nextStep="safety"
          />
        )}

        {/* ── Safety Compliance (AgreementReview) ── */}
        {currentStep === 'safety' && (
          <AgreementStep
            code={SAFETY_COMPLIANCE}
            prevStep="cybersecurity"
            nextStep="financial_controls"
          />
        )}

        {/* ── Financial Controls (AgreementReview) — NEW IN MG.2 ── */}
        {currentStep === 'financial_controls' && (
          <AgreementStep
            code={FINANCIAL_CONTROLS}
            prevStep="safety"
            nextStep="department_training"
          />
        )}

        {/* ── Department Training ── */}
        {currentStep === 'department_training' && (
          <WizardCard>
            <h2 className="text-xl font-bold text-white mb-2">Training Modules</h2>
            <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Your full training is available in the Management Training Center after you complete onboarding.
              The 10-module program covers company overview, leadership, OSHA, EPA compliance, driver operations,
              warehouse operations, data security, financial controls, incident investigations, and ethics.
              All modules must be completed within 30 days of your activation date.
            </p>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {[
                ['🏢', 'Company Overview'],       ['👔', 'Leadership Expectations'],
                ['🦺', 'OSHA & Workplace Safety'], ['♻️', 'EPA & Recycling Compliance'],
                ['🚚', 'Driver Operations'],        ['🏭', 'Warehouse Operations'],
                ['🔐', 'Data Security'],            ['💰', 'Financial Controls'],
                ['🔍', 'Incident Investigations'],  ['⚖️', 'Ethics & Professional Conduct'],
              ].map(([icon, title]) => (
                <div key={title} className="flex items-center gap-2 p-3 rounded-xl text-sm"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <span>{icon}</span>
                  <span style={{ color: 'rgba(255,255,255,0.7)' }}>{title}</span>
                </div>
              ))}
            </div>
            <label
              htmlFor="training-ack"
              className="flex items-start gap-3 cursor-pointer p-3 rounded-xl transition-all"
              style={{
                background: trainingAcknowledged ? 'rgba(0,200,255,0.07)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${trainingAcknowledged ? BRAND_BORDER : 'rgba(255,255,255,0.06)'}`,
              }}
            >
              <input type="checkbox" id="training-ack"
                checked={trainingAcknowledged}
                onChange={e => setTrainingAcknowledged(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-cyan-400 shrink-0" />
              <span className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.85)' }}>
                I understand that I must complete all 10 training modules in the Management Training Center within 30 days of activation.
              </span>
            </label>
            <NavButtons
              onBack={() => goToStep('financial_controls')}
              onNext={() => goToStep('assessment')}
              nextDisabled={!trainingAcknowledged}
              saving={saving}
            />
          </WizardCard>
        )}

        {/* ── Assessment ── */}
        {currentStep === 'assessment' && (
          <WizardCard>
            <h2 className="text-xl font-bold text-white mb-2">Management Assessment</h2>
            <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.5)' }}>
              20 questions. You need {PASSING_SCORE} or more correct ({Math.round((PASSING_SCORE / ASSESSMENT_QUESTIONS.length) * 100)}%) to pass.
              {assessmentDone && !assessmentPass && ' You did not pass. Please review and try again.'}
            </p>

            {assessmentDone && assessmentPass ? (
              <div className="text-center py-8">
                <div className="text-5xl mb-3">✅</div>
                <p className="text-lg font-bold" style={{ color: SUCCESS }}>Assessment Passed!</p>
                <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  Score: {score} / {ASSESSMENT_QUESTIONS.length} ({Math.round((score / ASSESSMENT_QUESTIONS.length) * 100)}%)
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {ASSESSMENT_QUESTIONS.map((q, qi) => (
                  <div key={q.id}>
                    <p className="text-sm font-semibold text-white mb-3">{qi + 1}. {q.question}</p>
                    <div className="space-y-2">
                      {q.options.map((opt, oi) => {
                        const selected  = answers[q.id] === oi
                        const isCorrect = assessmentDone && oi === q.correct
                        const isWrong   = assessmentDone && selected && oi !== q.correct
                        return (
                          <label key={oi} className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all"
                            style={{
                              background: isCorrect ? 'rgba(74,222,128,0.1)' : isWrong ? 'rgba(239,68,68,0.1)' : selected ? BRAND_DIM : 'rgba(255,255,255,0.02)',
                              border: `1px solid ${isCorrect ? 'rgba(74,222,128,0.35)' : isWrong ? 'rgba(239,68,68,0.35)' : selected ? BRAND_BORDER : 'rgba(255,255,255,0.06)'}`,
                              cursor: assessmentDone ? 'default' : 'pointer',
                            }}>
                            <input type="radio" name={`q${q.id}`} value={oi}
                              checked={selected} disabled={assessmentDone}
                              onChange={() => setAnswers(prev => ({ ...prev, [q.id]: oi }))}
                              className="accent-cyan-400" />
                            <span className="text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>{opt}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <NavButtons
              onBack={() => goToStep('department_training')}
              onNext={() => {
                if (assessmentPass) {
                  goToStep('agreement_signature')
                } else if (!assessmentDone) {
                  const correct = ASSESSMENT_QUESTIONS.filter(q => answers[q.id] === q.correct).length
                  const passed  = correct >= PASSING_SCORE
                  setScore(correct)
                  setAssessmentDone(true)
                  setAssessmentPass(passed)
                  if (passed) saveStep('assessment', { assessment_score: correct, assessment_passed: true })
                } else {
                  setAnswers({})
                  setAssessmentDone(false)
                  setAssessmentPass(false)
                }
              }}
              nextLabel={
                assessmentPass ? 'Continue to Agreement' :
                assessmentDone ? 'Retry Assessment' :
                Object.keys(answers).length < ASSESSMENT_QUESTIONS.length
                  ? `Answer all ${ASSESSMENT_QUESTIONS.length} questions to submit`
                  : 'Submit Assessment'
              }
              nextDisabled={!assessmentPass && !assessmentDone && Object.keys(answers).length < ASSESSMENT_QUESTIONS.length}
              saving={saving}
            />

            {assessmentDone && !assessmentPass && (
              <div className="mt-3 p-3 rounded-xl text-sm text-center"
                style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', color: WARN }}>
                Score: {score}/{ASSESSMENT_QUESTIONS.length} — Need {PASSING_SCORE} to pass. Click "Retry Assessment" to try again.
              </div>
            )}
          </WizardCard>
        )}

        {/* ── Management Agreement (final agreement — completes onboarding) ── */}
        {currentStep === 'agreement_signature' && (
          acceptances[MANAGEMENT_AGREEMENT] ? (
            // Should not normally reach this state (completing this step triggers completeOnboarding)
            // but handle gracefully in case of page refresh mid-completion
            <WizardCard>
              <AcceptedBanner
                title="Management Agreement"
                signatureName={acceptances[MANAGEMENT_AGREEMENT].signatureName}
                acceptedAt={acceptances[MANAGEMENT_AGREEMENT].acceptedAt}
              />
              {!allRequiredAccepted && (
                <div className="mt-4 p-3 rounded-xl text-sm" style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', color: WARN }}>
                  Some required agreements are still pending. Please go back and complete all agreements before finishing.
                </div>
              )}
              <NavButtons
                onBack={() => goToStep('assessment')}
                onNext={allRequiredAccepted ? () => setCurrentStep('complete') : undefined!}
                nextLabel="Complete Onboarding"
                nextDisabled={!allRequiredAccepted}
                saving={saving}
              />
            </WizardCard>
          ) : (
            <AgreementReview
              agreement={getAgreementByCode(MANAGEMENT_AGREEMENT)!}
              onAccept={handleFinalAccept}
              onBack={() => goToStep('assessment')}
              saving={saving}
              acceptLabel="Accept & Complete Onboarding"
            />
          )
        )}

        {/* ── Complete ── */}
        {currentStep === 'complete' && (
          <WizardCard>
            <div className="text-center py-8">
              <div className="text-6xl mb-4">🎓</div>
              <h1 className="text-2xl font-bold text-white mb-2">Onboarding Complete!</h1>
              <p className="text-sm mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Cyan's Brooklynn Recycling Enterprise LLC</p>
              <div className="mt-6 mb-8 p-4 rounded-xl inline-block" style={{ background: 'rgba(74,222,128,0.07)', border: '1px solid rgba(74,222,128,0.25)' }}>
                <p className="text-xs font-bold tracking-widest mb-1" style={{ color: SUCCESS }}>MANAGEMENT CERTIFIED</p>
                <p className="text-white font-semibold">
                  {acceptances[MANAGEMENT_AGREEMENT]?.signatureName || profile.management_type} — {profile.department} department
                </p>
                <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Assessment score: {score}/{ASSESSMENT_QUESTIONS.length}</p>
              </div>

              {/* Agreements accepted summary */}
              <div className="text-left mb-8 space-y-2 max-w-sm mx-auto">
                {[
                  [CODE_OF_CONDUCT,           '⚖️ Code of Conduct'],
                  [CONFIDENTIALITY_AGREEMENT, '🔒 Confidentiality Agreement'],
                  [CONFLICT_OF_INTEREST,      '🔍 Conflict of Interest Disclosure'],
                  [TECHNOLOGY_SECURITY,       '🔐 Technology & Data Security Agreement'],
                  [SAFETY_COMPLIANCE,         '🦺 Safety & Compliance Acknowledgment'],
                  [FINANCIAL_CONTROLS,        '💰 Financial Controls Acknowledgment'],
                  [MANAGEMENT_AGREEMENT,      '📋 Management Agreement'],
                ].map(([code, label]) => (
                  <div key={code} className="flex items-center gap-2 text-sm" style={{ color: acceptances[code] ? 'rgba(74,222,128,0.9)' : 'rgba(255,255,255,0.3)' }}>
                    <span>{acceptances[code] ? '✅' : '⏳'}</span>
                    <span>{label}</span>
                  </div>
                ))}
              </div>

              <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Complete all 10 training modules in the Management Training Center within 30 days.
              </p>
              <button
                onClick={() => navigate('/management/dashboard')}
                className="px-8 py-3 rounded-xl text-sm font-bold transition-all"
                style={{ background: BRAND, color: '#000' }}>
                Go to Management Dashboard
              </button>
            </div>
          </WizardCard>
        )}

      </div>
    </div>
  )
}
