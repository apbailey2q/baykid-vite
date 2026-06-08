// ManagementOnboardingWizard.tsx — Management Onboarding Wizard
//
// 11-step wizard for management personnel onboarding at Cyan's Brooklynn Recycling.
// Covers: welcome → mission → code_of_conduct → confidentiality →
//         conflict_of_interest → cybersecurity → safety →
//         department_training → assessment → agreement_signature → complete
//
// On completion: sets onboarding_completed, certified, status=active in management_profiles.

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuthStore } from '../../store/authStore'
import type { ManagementProfile } from '../../types'

// ── Step definitions ──────────────────────────────────────────────────────────

type WizardStep =
  | 'welcome'
  | 'mission'
  | 'code_of_conduct'
  | 'confidentiality'
  | 'conflict_of_interest'
  | 'cybersecurity'
  | 'safety'
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
  'department_training',
  'assessment',
  'agreement_signature',
  'complete',
]

const STEP_LABELS: Record<WizardStep, string> = {
  welcome:             'Welcome',
  mission:             'Our Mission',
  code_of_conduct:     'Code of Conduct',
  confidentiality:     'Confidentiality',
  conflict_of_interest:'Conflict of Interest',
  cybersecurity:       'Cybersecurity',
  safety:              'Safety',
  department_training: 'Training Modules',
  assessment:          'Assessment',
  agreement_signature: 'Agreement',
  complete:            'Complete',
}

// ── Assessment questions (20 questions, 80% = 16 correct to pass) ─────────────

interface AssessmentQuestion {
  id:       number
  question: string
  options:  string[]
  correct:  number
}

const ASSESSMENT_QUESTIONS: AssessmentQuestion[] = [
  {
    id: 1,
    question: 'What is the public brand name used with customers and partners?',
    options: ["BayKid Platform", "Cyan's Brooklynn Recycling", "CBR Enterprise", "Green Community LLC"],
    correct: 1,
  },
  {
    id: 2,
    question: 'Which of the following payment integrations is PROHIBITED without founder approval?',
    options: ['Check payments recorded manually', 'Cash payments recorded manually', 'Stripe Connect / ACH / routing numbers', 'Zelle payments recorded manually'],
    correct: 2,
  },
  {
    id: 3,
    question: 'Under OSHA, a workplace fatality must be reported within:',
    options: ['24 hours', '8 hours', '48 hours', '72 hours'],
    correct: 1,
  },
  {
    id: 4,
    question: 'What does a red inspection result at the warehouse require?',
    options: ['Process immediately at lower priority', 'Quarantine and supervisor review', 'Return to driver', 'Accept and document only'],
    correct: 1,
  },
  {
    id: 5,
    question: 'The official financial system for Cyan\'s Brooklynn is:',
    options: ['Stripe + QuickBooks', 'ACH disbursement service', 'Internal Wallet and Manual Payout Ledger', 'PayPal Business'],
    correct: 2,
  },
  {
    id: 6,
    question: 'A conflict of interest must be handled by:',
    options: ['Managing it privately to avoid attention', 'Disclosing in writing and recusing from related decisions', 'Asking a peer to handle the decision instead', 'Proceeding if the impact is minor'],
    correct: 1,
  },
  {
    id: 7,
    question: 'Driver earnings are recorded in which table?',
    options: ['wallet_transactions', 'driver_payments', 'payout_ledger', 'earnings_log'],
    correct: 2,
  },
  {
    id: 8,
    question: 'What is the contamination rate threshold requiring a root cause investigation?',
    options: ['Any contamination at all', 'Greater than 5% for any material stream', 'Greater than 20% overall', 'Greater than 10% monthly'],
    correct: 1,
  },
  {
    id: 9,
    question: 'Which OSHA regulation covers Personal Protective Equipment?',
    options: ['29 CFR 1910.147', '29 CFR 1910.132', '29 CFR 1910.38', '29 CFR 1910.1200'],
    correct: 1,
  },
  {
    id: 10,
    question: 'Retaliating against an employee for reporting a safety concern is:',
    options: ['Acceptable if the report was false', 'A minor policy infraction', 'Illegal under OSHA Section 11(c)', 'Acceptable under state law only'],
    correct: 2,
  },
  {
    id: 11,
    question: 'How quickly must a Severity 1 incident be escalated to director/executive?',
    options: ['Within 24 hours', 'Within 4 hours', 'Within 1 hour', 'Within 48 hours'],
    correct: 2,
  },
  {
    id: 12,
    question: 'MFA is required for management platform accounts:',
    options: ['Only for admin-level accounts', 'Only for accounts with finance access', 'For all management accounts, business email, and data-access tools', 'Only when accessing from outside the office'],
    correct: 2,
  },
  {
    id: 13,
    question: 'A warehouse_supervisor\'s primary responsibility during intake is:',
    options: ['Operating the scale equipment', 'Approving inspections and managing floor assignments', 'Collecting payment from drivers', 'Updating the commercial customer dashboard'],
    correct: 1,
  },
  {
    id: 14,
    question: 'What is the correct first step in any incident investigation?',
    options: ['Identify the responsible employee', 'Secure the scene to prevent further harm or evidence loss', 'Submit the OSHA form', 'Conduct group witness interviews'],
    correct: 1,
  },
  {
    id: 15,
    question: 'Fundraiser campaign payouts should be communicated as ready for disbursement:',
    options: ['Once balance reaches $100', 'After 30 days of activity', 'Only after explicit founder authorization of the disbursement phase', 'Automatically when the campaign ends'],
    correct: 2,
  },
  {
    id: 16,
    question: 'The Anthropic API key must be stored:',
    options: ['In a VITE_ prefixed env variable', 'In browser localStorage', 'Server-side only — never in browser-visible code', 'In the public GitHub repository'],
    correct: 2,
  },
  {
    id: 17,
    question: 'What federal law primarily governs solid waste handling at a recycling facility?',
    options: ['OSHA General Industry Standard', 'Clean Air Act', 'RCRA (Resource Conservation and Recovery Act)', 'Fair Labor Standards Act'],
    correct: 2,
  },
  {
    id: 18,
    question: 'Which driver type completes a W-9, insurance verification, and payout deposit setup?',
    options: ['commercial_only', 'hybrid_driver (commercial mode only)', 'driver_1099', 'All driver types'],
    correct: 2,
  },
  {
    id: 19,
    question: 'An employee reports suspected financial record falsification to you. You should:',
    options: ['Investigate personally and correct it', 'Dismiss the concern as a misunderstanding', 'Escalate to admin and protect the reporting employee from retaliation', 'Ask for a written complaint first'],
    correct: 2,
  },
  {
    id: 20,
    question: 'The "5 Whys" root cause analysis technique is used to:',
    options: ['Identify and punish the responsible individual', 'Meet OSHA documentation requirements only', 'Get past surface symptoms and identify the underlying system failure', 'Create a timeline of events for legal review'],
    correct: 2,
  },
]

const PASSING_SCORE = Math.ceil(ASSESSMENT_QUESTIONS.length * 0.8) // 16 of 20

// ── Shared UI helpers ────────────────────────────────────────────────────────

const BRAND = '#00c8ff'
const BRAND_DIM = 'rgba(0,200,255,0.12)'
const BRAND_BORDER = 'rgba(0,200,255,0.3)'
const SUCCESS = '#4ade80'
const WARN = '#fbbf24'

function WizardCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl p-6 sm:p-8"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(0,200,255,0.12)' }}
    >
      {children}
    </div>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-base font-bold mb-2" style={{ color: BRAND }}>
      {children}
    </h3>
  )
}

function CheckItem({
  id, label, checked, onChange,
}: { id: string; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label
      htmlFor={id}
      className="flex items-start gap-3 cursor-pointer p-3 rounded-xl transition-all"
      style={{ background: checked ? 'rgba(0,200,255,0.07)' : 'rgba(255,255,255,0.02)', border: `1px solid ${checked ? BRAND_BORDER : 'rgba(255,255,255,0.06)'}` }}
    >
      <input
        type="checkbox" id={id} checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 accent-cyan-400 shrink-0"
      />
      <span className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.85)' }}>
        {label}
      </span>
    </label>
  )
}

function NavButtons({
  onBack, onNext, nextLabel = 'Continue', nextDisabled = false, saving = false,
}: {
  onBack?: () => void
  onNext: () => void
  nextLabel?: string
  nextDisabled?: boolean
  saving?: boolean
}) {
  return (
    <div className="flex justify-between mt-8 gap-4">
      {onBack ? (
        <button
          onClick={onBack}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          ← Back
        </button>
      ) : <div />}
      <button
        onClick={onNext}
        disabled={nextDisabled || saving}
        className="px-6 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
        style={{ background: BRAND, color: '#000' }}
      >
        {saving ? 'Saving…' : nextLabel}
      </button>
    </div>
  )
}

// ── Main wizard component ─────────────────────────────────────────────────────

export default function ManagementOnboardingWizard() {
  const { user } = useAuthStore()
  const navigate = useNavigate()

  const [profile, setProfile] = useState<ManagementProfile | null>(null)
  const [progressId, setProgressId] = useState<string | null>(null)
  const [currentStep, setCurrentStep] = useState<WizardStep>('welcome')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step-local acceptance state
  const [conductAccepted,   setConductAccepted]   = useState(false)
  const [confidAccepted,    setConfidAccepted]    = useState(false)
  const [conflictAccepted,  setConflictAccepted]  = useState(false)
  const [cyberAccepted,     setCyberAccepted]     = useState(false)
  const [safetyAccepted,    setSafetyAccepted]    = useState(false)
  const [trainingAcknowledged, setTrainingAcknowledged] = useState(false)

  // Assessment state
  const [answers,        setAnswers]        = useState<Record<number, number>>({})
  const [assessmentDone, setAssessmentDone] = useState(false)
  const [assessmentPass, setAssessmentPass] = useState(false)
  const [score,          setScore]          = useState(0)

  // Agreement state
  const [sigName,           setSigName]           = useState('')
  const [agreementAccepted, setAgreementAccepted] = useState(false)

  // ── Load existing profile / progress ──────────────────────────────────────
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

      if (!mp) {
        setLoading(false)
        return
      }

      setProfile(mp as ManagementProfile)

      if (mp.onboarding_completed) {
        navigate('/management/dashboard', { replace: true })
        return
      }

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
        setSigName(prog.signature_name ?? '')
        setAgreementAccepted(prog.agreement_accepted ?? false)
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

  // ── Complete onboarding ────────────────────────────────────────────────────
  const completeOnboarding = useCallback(async () => {
    if (!profile) return
    setSaving(true)
    try {
      const now = new Date().toISOString()
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
  }, [profile, saveStep, sigName, score])

  // ── Step navigation ────────────────────────────────────────────────────────
  const goToStep = (step: WizardStep) => saveStep(step)

  const stepIdx = STEPS.indexOf(currentStep)

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: '#060e24' }}>
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-t-transparent" style={{ borderColor: BRAND, borderTopColor: 'transparent' }} />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6" style={{ background: '#060e24' }}>
        <p className="text-white/60 text-center max-w-sm">
          No management profile found for your account. Please contact an administrator to set up your management profile before completing onboarding.
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: '#060e24' }}>
      {/* Header */}
      <div className="sticky top-0 z-10 px-4 py-3" style={{ background: 'rgba(6,14,36,0.95)', borderBottom: '1px solid rgba(0,200,255,0.1)', backdropFilter: 'blur(10px)' }}>
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-xs font-bold tracking-widest" style={{ color: BRAND }}>
              CYAN'S BROOKLYNN RECYCLING
            </p>
            <p className="text-white font-bold text-lg leading-tight">Management Onboarding</p>
          </div>
          <div className="text-right">
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Step {stepIdx + 1} of {STEPS.length}</p>
            <p className="text-sm font-semibold text-white">{STEP_LABELS[currentStep]}</p>
          </div>
        </div>
        {/* Progress bar */}
        <div className="max-w-2xl mx-auto mt-2 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <div
            className="h-1 rounded-full transition-all duration-500"
            style={{ background: BRAND, width: `${((stepIdx + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      {error && (
        <div className="max-w-2xl mx-auto mt-4 px-4">
          <div className="p-3 rounded-xl text-sm text-red-300" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
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
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
                Cyan's Brooklynn Recycling Enterprise LLC
              </p>
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
                  <li>• Code of conduct and key policies</li>
                  <li>• Safety, compliance, and security training</li>
                  <li>• Department-specific overview</li>
                  <li>• 20-question assessment (80% required to pass)</li>
                  <li>• Management Agreement digital signature</li>
                </ul>
              </div>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Estimated time: 60–90 minutes. Your progress is saved automatically.
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
                  unreliable, or economically unattractive to individuals and small businesses. We build the connection between
                  communities who want to recycle and the processing infrastructure that can handle it — with a fair payout
                  system that incentivizes participation.
                </p>
              </div>
              <div>
                <SectionHeading>Management's Role in the Mission</SectionHeading>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>
                  Management personnel are the operational backbone. You keep routes running, warehouses safe, compliance current,
                  and teams motivated. Every decision you make either reinforces or undermines the mission. You are expected to
                  make decisions that prioritize community benefit, fairness, and long-term sustainability over short-term shortcuts.
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

        {/* ── Code of Conduct ── */}
        {currentStep === 'code_of_conduct' && (
          <WizardCard>
            <h2 className="text-xl font-bold text-white mb-2">Code of Conduct</h2>
            <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.5)' }}>Read each section carefully, then acknowledge below.</p>
            <div className="space-y-4 mb-6">
              {[
                ['Honesty', 'Represent facts accurately at all times. Do not mislead customers, partners, employees, regulators, or other team members.'],
                ['Integrity', 'Do what you commit to. If you cannot follow through, communicate early and specifically.'],
                ['Respect', 'Treat every person with dignity regardless of role, background, or circumstances. Harassment and discrimination have zero tolerance.'],
                ['Accountability', 'Own your decisions and their consequences. Do not deflect blame to team members, technology, or circumstances.'],
                ['Fairness', 'Apply policies, recognition, and discipline consistently across all team members regardless of personal relationship or preference.'],
                ['Conflicts of Interest', 'Disclose any conflict of interest in writing before taking any related action. Recuse yourself from decisions where a conflict exists.'],
              ].map(([heading, body]) => (
                <div key={heading}>
                  <SectionHeading>{heading}</SectionHeading>
                  <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>{body}</p>
                </div>
              ))}
            </div>
            <CheckItem
              id="conduct"
              label="I have read and understand the Code of Conduct. I agree to uphold these standards in my role at Cyan's Brooklynn Recycling."
              checked={conductAccepted}
              onChange={setConductAccepted}
            />
            <NavButtons
              onBack={() => goToStep('mission')}
              onNext={() => goToStep('confidentiality')}
              nextDisabled={!conductAccepted}
              saving={saving}
            />
          </WizardCard>
        )}

        {/* ── Confidentiality ── */}
        {currentStep === 'confidentiality' && (
          <WizardCard>
            <h2 className="text-xl font-bold text-white mb-2">Confidentiality</h2>
            <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.5)' }}>Understand what is confidential and your obligations.</p>
            <div className="space-y-4 mb-6">
              <div>
                <SectionHeading>What Is Confidential</SectionHeading>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  Customer PII (names, addresses, contact information, pickup history), driver personal information
                  and earnings records, commercial account contracts and billing data, financial records, payout
                  ledger data, platform architecture, trade secrets, and any information not publicly available.
                </p>
              </div>
              <div>
                <SectionHeading>Your Obligations</SectionHeading>
                <ul className="text-sm space-y-2" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  <li>• Do not share confidential information with unauthorized individuals inside or outside the company.</li>
                  <li>• Do not download or export data to personal devices or unapproved cloud storage.</li>
                  <li>• Do not share data with external parties without admin approval and a signed data sharing agreement.</li>
                  <li>• Report any accidental disclosure immediately to admin.</li>
                </ul>
              </div>
              <div>
                <SectionHeading>Trade Secrets</SectionHeading>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  Platform algorithms, routing logic, pricing models, payout structures, and commercial partnerships
                  constitute trade secrets. Disclosure to competitors or unauthorized parties may constitute
                  misappropriation of trade secrets under applicable law.
                </p>
              </div>
              <div>
                <SectionHeading>Duration</SectionHeading>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  Confidentiality obligations survive termination of employment. You remain bound by these
                  obligations after your role at Cyan's Brooklynn ends.
                </p>
              </div>
            </div>
            <CheckItem
              id="confidentiality"
              label="I understand my confidentiality obligations and agree to protect Cyan's Brooklynn's confidential information during and after my employment."
              checked={confidAccepted}
              onChange={setConfidAccepted}
            />
            <NavButtons
              onBack={() => goToStep('code_of_conduct')}
              onNext={() => goToStep('conflict_of_interest')}
              nextDisabled={!confidAccepted}
              saving={saving}
            />
          </WizardCard>
        )}

        {/* ── Conflict of Interest ── */}
        {currentStep === 'conflict_of_interest' && (
          <WizardCard>
            <h2 className="text-xl font-bold text-white mb-2">Conflict of Interest</h2>
            <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.5)' }}>Know what constitutes a conflict and how to handle it.</p>
            <div className="space-y-4 mb-6">
              <div>
                <SectionHeading>What Is a Conflict of Interest</SectionHeading>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  A conflict of interest exists when your personal interests — financial, personal, or relational —
                  could influence or appear to influence decisions you make in your professional role.
                </p>
              </div>
              <div>
                <SectionHeading>Examples</SectionHeading>
                <ul className="text-sm space-y-1" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  <li>• Hiring a family member or close friend for a position you oversee</li>
                  <li>• Approving a vendor contract with a company you have a financial interest in</li>
                  <li>• Making operational decisions that benefit a business you personally own</li>
                  <li>• Sharing confidential data with a competitor or personal business</li>
                </ul>
              </div>
              <div>
                <SectionHeading>Required Actions</SectionHeading>
                <ul className="text-sm space-y-2" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  <li>• Disclose any potential conflict in writing to your supervisor and HR <em>before</em> taking any related action.</li>
                  <li>• Recuse yourself from decisions where a conflict exists.</li>
                  <li>• Do not attempt to manage the conflict yourself — disclosure and recusal are mandatory.</li>
                </ul>
              </div>
            </div>
            <CheckItem
              id="conflict"
              label="I understand what constitutes a conflict of interest. I will disclose any conflict in writing and recuse myself from related decisions."
              checked={conflictAccepted}
              onChange={setConflictAccepted}
            />
            <NavButtons
              onBack={() => goToStep('confidentiality')}
              onNext={() => goToStep('cybersecurity')}
              nextDisabled={!conflictAccepted}
              saving={saving}
            />
          </WizardCard>
        )}

        {/* ── Cybersecurity ── */}
        {currentStep === 'cybersecurity' && (
          <WizardCard>
            <h2 className="text-xl font-bold text-white mb-2">Cybersecurity & Data Handling</h2>
            <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.5)' }}>Your obligations to protect platform and customer data.</p>
            <div className="space-y-4 mb-6">
              {[
                ['Password & MFA Requirements', 'Use a password manager. Minimum 12-character passwords, never reused. MFA is required for all management accounts, business email, and any tool with access to customer or financial data.'],
                ['Phishing Awareness', 'Do not click links or open attachments in suspicious messages. Forward phishing attempts to admin/IT. Verify unusual requests using known contact numbers — not numbers provided in the suspicious message.'],
                ['Data Access Limits', 'Access only data you need for your specific job function. Do not export data to personal devices or unapproved cloud storage.'],
                ['API Key Security', 'The platform\'s API keys must never appear in browser-visible code. If you observe a VITE_ANTHROPIC_ variable or API key in source code, report it to the technology team immediately.'],
                ['Breach Response', 'Report any suspected breach, unauthorized access, or accidental data disclosure to admin immediately. Do not attempt to contain a breach on your own.'],
              ].map(([heading, body]) => (
                <div key={heading}>
                  <SectionHeading>{heading}</SectionHeading>
                  <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>{body}</p>
                </div>
              ))}
            </div>
            <CheckItem
              id="cyber"
              label="I understand my cybersecurity obligations including MFA, password requirements, phishing awareness, and data handling rules."
              checked={cyberAccepted}
              onChange={setCyberAccepted}
            />
            <NavButtons
              onBack={() => goToStep('conflict_of_interest')}
              onNext={() => goToStep('safety')}
              nextDisabled={!cyberAccepted}
              saving={saving}
            />
          </WizardCard>
        )}

        {/* ── Safety ── */}
        {currentStep === 'safety' && (
          <WizardCard>
            <h2 className="text-xl font-bold text-white mb-2">Workplace Safety</h2>
            <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.5)' }}>OSHA obligations, PPE, emergency procedures, and incident reporting.</p>
            <div className="space-y-4 mb-6">
              <div>
                <SectionHeading>Your Legal Obligations</SectionHeading>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  As a manager or supervisor, you have legal duties under OSHA. You must ensure your team has the training,
                  equipment, and procedures to work safely. Failure to meet OSHA standards can result in citations, fines,
                  and personal liability.
                </p>
              </div>
              <div>
                <SectionHeading>PPE and Shift Walkthroughs</SectionHeading>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  Conduct a safety walkthrough at the start of every shift in your area. Check PPE availability, clear
                  walkways, unblocked exits, guards in place, and spill cleanup access. Document hazards found and
                  corrective actions taken.
                </p>
              </div>
              <div>
                <SectionHeading>Emergency Reporting</SectionHeading>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  Call 911 first during emergencies. Account for all personnel at the assembly point. Do not re-enter
                  until the all-clear. Document incidents in the platform within 4 hours. OSHA-recordable incidents
                  require Form 300 completion.
                </p>
              </div>
              <div>
                <SectionHeading>No Retaliation for Safety Reports</SectionHeading>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  You must never discourage employees from reporting injuries or safety concerns. Retaliation is
                  illegal under OSHA Section 11(c) and is grounds for immediate termination.
                </p>
              </div>
            </div>
            <CheckItem
              id="safety"
              label="I understand my safety obligations as a manager including OSHA requirements, PPE, emergency procedures, and no-retaliation rules."
              checked={safetyAccepted}
              onChange={setSafetyAccepted}
            />
            <NavButtons
              onBack={() => goToStep('cybersecurity')}
              onNext={() => goToStep('department_training')}
              nextDisabled={!safetyAccepted}
              saving={saving}
            />
          </WizardCard>
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
                ['🏢', 'Company Overview'],
                ['👔', 'Leadership Expectations'],
                ['🦺', 'OSHA & Workplace Safety'],
                ['♻️', 'EPA & Recycling Compliance'],
                ['🚚', 'Driver Operations'],
                ['🏭', 'Warehouse Operations'],
                ['🔐', 'Data Security'],
                ['💰', 'Financial Controls'],
                ['🔍', 'Incident Investigations'],
                ['⚖️', 'Ethics & Professional Conduct'],
              ].map(([icon, title]) => (
                <div key={title} className="flex items-center gap-2 p-3 rounded-xl text-sm" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <span>{icon}</span>
                  <span style={{ color: 'rgba(255,255,255,0.7)' }}>{title}</span>
                </div>
              ))}
            </div>
            <CheckItem
              id="training-ack"
              label="I understand that I must complete all 10 training modules in the Management Training Center within 30 days of activation."
              checked={trainingAcknowledged}
              onChange={setTrainingAcknowledged}
            />
            <NavButtons
              onBack={() => goToStep('safety')}
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
              {assessmentDone && !assessmentPass && ' You did not pass. Please review the policy sections and try again.'}
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
                    <p className="text-sm font-semibold text-white mb-3">
                      {qi + 1}. {q.question}
                    </p>
                    <div className="space-y-2">
                      {q.options.map((opt, oi) => {
                        const selected = answers[q.id] === oi
                        const isCorrect = assessmentDone && oi === q.correct
                        const isWrong   = assessmentDone && selected && oi !== q.correct
                        return (
                          <label
                            key={oi}
                            className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all"
                            style={{
                              background: isCorrect ? 'rgba(74,222,128,0.1)' : isWrong ? 'rgba(239,68,68,0.1)' : selected ? BRAND_DIM : 'rgba(255,255,255,0.02)',
                              border: `1px solid ${isCorrect ? 'rgba(74,222,128,0.35)' : isWrong ? 'rgba(239,68,68,0.35)' : selected ? BRAND_BORDER : 'rgba(255,255,255,0.06)'}`,
                              cursor: assessmentDone ? 'default' : 'pointer',
                            }}
                          >
                            <input
                              type="radio" name={`q${q.id}`} value={oi}
                              checked={selected} disabled={assessmentDone}
                              onChange={() => setAnswers(prev => ({ ...prev, [q.id]: oi }))}
                              className="accent-cyan-400"
                            />
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
                  // Grade the assessment
                  const correct = ASSESSMENT_QUESTIONS.filter(q => answers[q.id] === q.correct).length
                  const passed  = correct >= PASSING_SCORE
                  setScore(correct)
                  setAssessmentDone(true)
                  setAssessmentPass(passed)
                  if (passed) {
                    saveStep('assessment', { assessment_score: correct, assessment_passed: true })
                  }
                } else {
                  // Failed — reset for retry
                  setAnswers({})
                  setAssessmentDone(false)
                  setAssessmentPass(false)
                }
              }}
              nextLabel={
                assessmentPass ? 'Continue to Agreement' :
                assessmentDone ? 'Retry Assessment' :
                Object.keys(answers).length < ASSESSMENT_QUESTIONS.length ? `Answer all ${ASSESSMENT_QUESTIONS.length} questions to submit` : 'Submit Assessment'
              }
              nextDisabled={!assessmentPass && !assessmentDone && Object.keys(answers).length < ASSESSMENT_QUESTIONS.length}
              saving={saving}
            />

            {assessmentDone && !assessmentPass && (
              <div className="mt-3 p-3 rounded-xl text-sm text-center" style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', color: WARN }}>
                Score: {score}/{ASSESSMENT_QUESTIONS.length} — Need {PASSING_SCORE} to pass. Click "Retry Assessment" to try again.
              </div>
            )}
          </WizardCard>
        )}

        {/* ── Agreement Signature ── */}
        {currentStep === 'agreement_signature' && (
          <WizardCard>
            <h2 className="text-xl font-bold text-white mb-2">Management Agreement</h2>
            <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Version 1.0 · Effective 2026-07-03 · Cyan's Brooklynn Recycling Enterprise LLC
            </p>

            <div
              className="rounded-xl p-4 mb-6 text-xs leading-relaxed space-y-3 overflow-y-auto"
              style={{ maxHeight: 320, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.65)' }}
            >
              <p><strong className="text-white">1. Management Responsibilities.</strong> You agree to carry out your management duties with diligence, professionalism, and in the best interests of Cyan's Brooklynn Recycling Enterprise LLC and the communities it serves.</p>
              <p><strong className="text-white">2. Confidential Information.</strong> You agree to protect all confidential information as defined in the Confidentiality section of this onboarding program. This obligation survives termination of your role.</p>
              <p><strong className="text-white">3. Trade Secrets.</strong> Platform architecture, routing logic, pricing models, payout structures, and commercial partnerships are trade secrets. Unauthorized disclosure may constitute misappropriation of trade secrets under applicable law.</p>
              <p><strong className="text-white">4. Data Security.</strong> You agree to comply with all platform data security requirements including MFA, password standards, access limits, and breach reporting obligations.</p>
              <p><strong className="text-white">5. Conflict of Interest.</strong> You agree to disclose any conflict of interest in writing and to recuse yourself from related decisions. You will not make decisions that benefit personal financial interests at the expense of the company or its employees.</p>
              <p><strong className="text-white">6. Financial Controls.</strong> You acknowledge that the Internal Wallet and Manual Payout Ledger is the official financial system. You agree that Stripe Connect, ACH, routing numbers, bank account collection, and external payment processors are PROHIBITED without explicit founder approval. You agree to comply with all expense authorization levels.</p>
              <p><strong className="text-white">7. Environmental Compliance.</strong> You agree to uphold EPA recycling compliance standards, contamination prevention procedures, and chain-of-custody documentation requirements.</p>
              <p><strong className="text-white">8. Safety Compliance.</strong> You agree to fulfill all OSHA obligations including PPE requirements, emergency procedures, incident reporting, and no-retaliation standards.</p>
              <p><strong className="text-white">9. Incident Reporting.</strong> You agree to report and properly investigate all incidents in accordance with the severity escalation timeline defined in management training.</p>
              <p><strong className="text-white">10. Company Property.</strong> Company equipment, software access, and credentials are for business use only. All company property must be returned upon separation.</p>
              <p><strong className="text-white">11. Termination and Access Removal.</strong> Upon separation from this role for any reason, all access credentials will be immediately revoked. Confidentiality and non-disclosure obligations remain in effect.</p>
              <p><strong className="text-white">12. Digital Acknowledgement.</strong> By entering your full name below and checking the acknowledgement box, you confirm that you have read, understand, and agree to the terms of this Management Agreement. This constitutes a valid digital signature.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-white mb-2">Full Legal Name (Digital Signature)</label>
                <input
                  type="text"
                  value={sigName}
                  onChange={e => setSigName(e.target.value)}
                  placeholder="Enter your full legal name"
                  className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 outline-none"
                  style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${sigName.trim().length > 2 ? BRAND_BORDER : 'rgba(255,255,255,0.1)'}` }}
                />
              </div>
              <CheckItem
                id="agreement"
                label="I have read and agree to the Management Agreement above. I understand this digital signature is legally binding."
                checked={agreementAccepted}
                onChange={setAgreementAccepted}
              />
            </div>

            <NavButtons
              onBack={() => goToStep('assessment')}
              onNext={completeOnboarding}
              nextLabel="Complete Onboarding"
              nextDisabled={!agreementAccepted || sigName.trim().length < 2}
              saving={saving}
            />
          </WizardCard>
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
                <p className="text-white font-semibold">{sigName || profile.management_type} — {profile.department} department</p>
                <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Assessment score: {score}/{ASSESSMENT_QUESTIONS.length}</p>
              </div>
              <div className="space-y-3 text-left mb-8">
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>
                  ✅ Code of Conduct accepted<br />
                  ✅ Confidentiality agreement accepted<br />
                  ✅ Conflict of Interest policy accepted<br />
                  ✅ Cybersecurity obligations accepted<br />
                  ✅ Safety obligations accepted<br />
                  ✅ Management Agreement signed
                </p>
              </div>
              <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Complete all 10 training modules in the Management Training Center within 30 days.
              </p>
              <button
                onClick={() => navigate('/management/dashboard')}
                className="px-8 py-3 rounded-xl text-sm font-bold transition-all"
                style={{ background: BRAND, color: '#000' }}
              >
                Go to Management Dashboard
              </button>
            </div>
          </WizardCard>
        )}
      </div>
    </div>
  )
}
