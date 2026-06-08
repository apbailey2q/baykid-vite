// DriverTrainingModules.tsx — Full-content training modules for the Driver
// Compliance Wizard training step.
//
// Replaces the old five-checkbox StepTraining with interactive modules:
//   • Drivers must open and read each module
//   • A 4-question quiz must be passed (all correct answers selected)
//   • A per-module confirmation checkbox must be checked
//   • Only after all 5 modules are complete can the driver submit
//
// Progress is tracked in component state (reopened modules retain answers).
// Once the driver submits, training_completed_at is written to driver_profiles.

import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { AppShell, GlassCard, PrimaryButton } from '../../components/ui'
import { getTrainingModules } from './trainingModuleData'
import type { TrainingModuleContent } from './trainingModuleData'
import { trainingKey } from './driverComplianceVersions'
import type { DriverProfile } from '../../types'

// ── Types ─────────────────────────────────────────────────────────────────────

/** Map of module key → completion flag. Keys vary by driver type. */
export type TrainingInfo = Record<string, boolean>

type ModuleKey = string

interface ModuleProgress {
  opened:             boolean
  answers:            (number | null)[]   // one entry per quiz question; null = not answered
  videoAcknowledged:  boolean             // driver confirmed they reviewed the training video
  confirmed:          boolean             // final module confirmation checkbox
}

type ProgressMap = Record<ModuleKey, ModuleProgress>

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeBlankProgress(quizLen: number): ModuleProgress {
  return {
    opened:            false,
    answers:           Array<number | null>(quizLen).fill(null),
    videoAcknowledged: false,
    confirmed:         false,
  }
}

function isQuizPassed(prog: ModuleProgress, mod: TrainingModuleContent): boolean {
  return mod.quiz.every((q, i) => prog.answers[i] === q.correct)
}

/** Module is complete when: video acknowledged + quiz passed + confirmation checked. */
function isModuleComplete(prog: ModuleProgress, mod: TrainingModuleContent): boolean {
  return prog.videoAcknowledged && isQuizPassed(prog, mod) && prog.confirmed
}

function quizScore(prog: ModuleProgress, mod: TrainingModuleContent): number {
  return mod.quiz.filter((q, i) => prog.answers[i] === q.correct).length
}

function getStatus(prog: ModuleProgress, mod: TrainingModuleContent): 'not_started' | 'in_progress' | 'completed' {
  if (isModuleComplete(prog, mod)) return 'completed'
  if (prog.opened) return 'in_progress'
  return 'not_started'
}

// ── Shared local UI pieces ────────────────────────────────────────────────────

function ProgressBar({ stepIndex, totalSteps }: { stepIndex: number; totalSteps: number }) {
  const pct = Math.round(((stepIndex + 1) / totalSteps) * 100)
  return (
    <div className="space-y-1.5">
      <div
        className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide"
        style={{ color: 'rgba(255,255,255,0.55)' }}
      >
        <span>Step {stepIndex + 1} of {totalSteps}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <div className="h-full transition-all duration-300"
             style={{ width: `${pct}%`, background: 'var(--gradient-primary)' }} />
      </div>
    </div>
  )
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-widest"
       style={{ color: 'rgba(0,200,255,0.85)', marginTop: 8 }}>
      {children}
    </p>
  )
}

function Divider() {
  return <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '14px 0' }} />
}

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  not_started: { label: 'Not Started', bg: 'rgba(255,255,255,0.08)', fg: 'rgba(255,255,255,0.5)' },
  in_progress: { label: 'In Progress', bg: 'rgba(245,158,11,0.15)',  fg: 'rgba(253,186,116,1)'   },
  completed:   { label: 'Completed ✓', bg: 'rgba(34,197,94,0.15)',   fg: 'rgba(134,239,172,1)'    },
} as const

function StatusBadge({ status }: { status: keyof typeof STATUS_CONFIG }) {
  const { label, bg, fg } = STATUS_CONFIG[status]
  return (
    <span style={{
      display:      'inline-block',
      padding:      '2px 10px',
      borderRadius: 999,
      fontSize:     11,
      fontWeight:   700,
      background:   bg,
      color:        fg,
    }}>
      {label}
    </span>
  )
}

// ── Module list card ──────────────────────────────────────────────────────────

interface ModuleCardProps {
  mod:      TrainingModuleContent
  status:   keyof typeof STATUS_CONFIG
  onOpen:   () => void
}

function ModuleCard({ mod, status, onOpen }: ModuleCardProps) {
  return (
    <div
      style={{
        background:   'rgba(255,255,255,0.04)',
        border:       '1px solid rgba(255,255,255,0.10)',
        borderRadius: 14,
        padding:      '14px 16px',
        display:      'flex',
        alignItems:   'center',
        gap:          12,
      }}
    >
      <span style={{ fontSize: 26, lineHeight: 1, flexShrink: 0 }}>{mod.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ color: '#ffffff', fontWeight: 700, fontSize: 14, margin: 0, lineHeight: 1.3 }}>
          {mod.title}
        </p>
        <div style={{ marginTop: 4 }}>
          <StatusBadge status={status} />
        </div>
      </div>
      <button
        onClick={onOpen}
        style={{
          background:   status === 'completed' ? 'rgba(34,197,94,0.12)' : 'rgba(0,200,255,0.12)',
          border:       `1px solid ${status === 'completed' ? 'rgba(34,197,94,0.35)' : 'rgba(0,200,255,0.35)'}`,
          color:        status === 'completed' ? 'rgba(134,239,172,1)' : '#00c8ff',
          borderRadius: 8,
          padding:      '6px 14px',
          fontSize:     12,
          fontWeight:   700,
          cursor:       'pointer',
          flexShrink:   0,
          whiteSpace:   'nowrap',
        }}
      >
        {status === 'completed' ? 'Review' : status === 'in_progress' ? 'Continue' : 'Open'}
      </button>
    </div>
  )
}

// ── Quiz section ──────────────────────────────────────────────────────────────

interface QuizSectionProps {
  mod:       TrainingModuleContent
  prog:      ModuleProgress
  onChange:  (newAnswers: (number | null)[]) => void
}

function QuizSection({ mod, prog, onChange }: QuizSectionProps) {
  const passed      = isQuizPassed(prog, mod)
  const correctCount = mod.quiz.filter((q, i) => prog.answers[i] === q.correct).length

  return (
    <div>
      <SectionHeader>📝 Knowledge Check</SectionHeader>
      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 12 }}>
        Answer all questions correctly to unlock the confirmation checkbox.
        {' '}{correctCount}/{mod.quiz.length} correct.
      </p>

      <div className="space-y-5">
        {mod.quiz.map((q, qi) => {
          const selected = prog.answers[qi]
          const isAnswered = selected !== null
          const isCorrect  = isAnswered && selected === q.correct

          return (
            <div key={qi}>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)', fontWeight: 600, marginBottom: 8 }}>
                {qi + 1}. {q.q}
              </p>
              <div className="space-y-2">
                {q.options.map((opt, oi) => {
                  const isSelected = selected === oi
                  const isRight    = oi === q.correct
                  // Style logic: show green if selected+correct, red if selected+wrong
                  let bg     = 'rgba(255,255,255,0.04)'
                  let border = 'rgba(255,255,255,0.10)'
                  let fg     = 'rgba(255,255,255,0.75)'
                  let indicator = ''

                  if (isSelected && isRight)  { bg = 'rgba(34,197,94,0.15)';  border = 'rgba(34,197,94,0.45)';  fg = 'rgba(187,247,208,1)'; indicator = '✓ ' }
                  if (isSelected && !isRight) { bg = 'rgba(239,68,68,0.15)';  border = 'rgba(239,68,68,0.45)';  fg = 'rgba(254,202,202,1)'; indicator = '✗ ' }

                  return (
                    <label
                      key={oi}
                      style={{
                        display:      'flex',
                        alignItems:   'center',
                        gap:          10,
                        padding:      '9px 13px',
                        borderRadius: 10,
                        border:       `1px solid ${border}`,
                        background:   bg,
                        cursor:       'pointer',
                        color:        fg,
                        fontSize:     13,
                        userSelect:   'none',
                        transition:   'background 0.15s, border-color 0.15s',
                      }}
                    >
                      <input
                        type="radio"
                        name={`q-${qi}`}
                        value={oi}
                        checked={isSelected}
                        onChange={() => {
                          const next = [...prog.answers]
                          next[qi] = oi
                          onChange(next)
                        }}
                        style={{ accentColor: isRight ? '#22c55e' : '#ef4444', flexShrink: 0 }}
                      />
                      <span>
                        {indicator}{opt}
                      </span>
                    </label>
                  )
                })}
              </div>
              {isAnswered && !isCorrect && (
                <p style={{ fontSize: 12, color: 'rgba(252,165,165,1)', marginTop: 5 }}>
                  That&rsquo;s not right — try a different answer.
                </p>
              )}
              {isAnswered && isCorrect && (
                <p style={{ fontSize: 12, color: 'rgba(134,239,172,1)', marginTop: 5 }}>
                  Correct!
                </p>
              )}
            </div>
          )
        })}
      </div>

      {passed && (
        <div style={{
          marginTop:    14,
          padding:      '10px 14px',
          borderRadius: 10,
          background:   'rgba(34,197,94,0.12)',
          border:       '1px solid rgba(34,197,94,0.35)',
          color:        'rgba(187,247,208,1)',
          fontSize:     13,
          fontWeight:   700,
        }}>
          ✅ All questions correct! Check the box below to complete this module.
        </div>
      )}
    </div>
  )
}

// ── Training video section ────────────────────────────────────────────────────

interface VideoSectionProps {
  mod:      TrainingModuleContent
  prog:     ModuleProgress
  onToggle: () => void
}

function VideoSection({ mod, prog, onToggle }: VideoSectionProps) {
  const [showScript,    setShowScript]    = useState(false)
  const [showStoryboard, setShowStoryboard] = useState(false)
  const v = mod.video

  if (!v) return null

  const sectionStyle: React.CSSProperties = {
    background:   'rgba(255,255,255,0.03)',
    border:       '1px solid rgba(255,255,255,0.07)',
    borderRadius: 12,
    padding:      '14px 16px',
  }

  return (
    <div style={{
      background:   'rgba(99,102,241,0.06)',
      border:       '1px solid rgba(99,102,241,0.25)',
      borderRadius: 14,
      padding:      '16px 18px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 22 }}>🎬</span>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#ffffff' }}>
            Training Video Script &amp; Storyboard
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
            Estimated video length: {v.estimatedMinutes} minutes
          </p>
        </div>
        {prog.videoAcknowledged && (
          <span style={{
            fontSize:    10,
            fontWeight:  700,
            background:  'rgba(34,197,94,0.15)',
            color:       'rgba(134,239,172,1)',
            border:      '1px solid rgba(34,197,94,0.35)',
            borderRadius: 999,
            padding:     '2px 9px',
          }}>
            ✓ Reviewed
          </span>
        )}
      </div>

      {/* Video Script accordion */}
      <div style={{ marginBottom: 8 }}>
        <button
          onClick={() => setShowScript(s => !s)}
          style={{
            width:        '100%',
            display:      'flex',
            alignItems:   'center',
            justifyContent: 'space-between',
            background:   'rgba(255,255,255,0.04)',
            border:       '1px solid rgba(255,255,255,0.10)',
            borderRadius: 9,
            padding:      '9px 12px',
            cursor:       'pointer',
            color:        'rgba(255,255,255,0.8)',
            fontSize:     12,
            fontWeight:   700,
          }}
        >
          <span>📝 Video Voiceover Script</span>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{showScript ? '▲' : '▼'}</span>
        </button>
        {showScript && (
          <div style={{ ...sectionStyle, marginTop: 6 }}>
            {(
              [
                { label: 'Opening',           text: v.script.opening          },
                { label: 'Lesson',            text: v.script.lesson           },
                { label: 'Real Example',      text: v.script.realExample      },
                { label: 'Mistake to Avoid',  text: v.script.mistakeToAvoid   },
                { label: 'Positive Outcome',  text: v.script.positiveOutcome  },
                { label: 'Closing Reminder',  text: v.script.closingReminder  },
              ] as const
            ).map(({ label, text }) => (
              <div key={label} style={{ marginBottom: 12 }}>
                <p style={{ fontSize: 10, fontWeight: 800, color: 'rgba(0,200,255,0.75)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px' }}>
                  {label}
                </p>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.78)', lineHeight: 1.6, margin: 0, fontStyle: 'italic' }}>
                  {text}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Storyboard accordion */}
      <div style={{ marginBottom: 12 }}>
        <button
          onClick={() => setShowStoryboard(s => !s)}
          style={{
            width:        '100%',
            display:      'flex',
            alignItems:   'center',
            justifyContent: 'space-between',
            background:   'rgba(255,255,255,0.04)',
            border:       '1px solid rgba(255,255,255,0.10)',
            borderRadius: 9,
            padding:      '9px 12px',
            cursor:       'pointer',
            color:        'rgba(255,255,255,0.8)',
            fontSize:     12,
            fontWeight:   700,
          }}
        >
          <span>🎥 Video Storyboard ({v.storyboard.length} scenes)</span>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{showStoryboard ? '▲' : '▼'}</span>
        </button>
        {showStoryboard && (
          <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {v.storyboard.map(scene => (
              <div key={scene.scene} style={{
                ...sectionStyle,
                borderLeft: '3px solid rgba(99,102,241,0.5)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{
                    fontSize:    10,
                    fontWeight:  800,
                    background:  'rgba(99,102,241,0.2)',
                    color:       'rgba(196,181,253,1)',
                    borderRadius: 6,
                    padding:     '2px 7px',
                  }}>
                    Scene {scene.scene}
                  </span>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
                    ~{scene.durationSecs}s
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
                    <span style={{ fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>Visual: </span>
                    {scene.visual}
                  </p>
                  <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.75)', fontStyle: 'italic' }}>
                    <span style={{ fontWeight: 700, fontStyle: 'normal', color: 'rgba(255,255,255,0.7)' }}>Voiceover: </span>
                    &ldquo;{scene.voiceover}&rdquo;
                  </p>
                  <p style={{ margin: 0, fontSize: 11 }}>
                    <span style={{ fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>On-Screen: </span>
                    <span style={{
                      background:   'rgba(0,0,0,0.3)',
                      color:        '#00c8ff',
                      padding:      '1px 6px',
                      borderRadius: 4,
                      fontWeight:   700,
                    }}>
                      {scene.onScreenText}
                    </span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Video acknowledgment */}
      <div style={{
        background:   prog.videoAcknowledged ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.03)',
        border:       `1px solid ${prog.videoAcknowledged ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.12)'}`,
        borderRadius: 9,
        padding:      '10px 13px',
      }}>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
          <input
            type="checkbox"
            checked={prog.videoAcknowledged}
            onChange={onToggle}
            style={{ marginTop: 2, accentColor: '#22c55e', width: 16, height: 16, flexShrink: 0 }}
          />
          <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>
            I have reviewed this training video script and storyboard for <strong>{mod.title}</strong>.
          </span>
        </label>
        {!prog.videoAcknowledged && (
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: '6px 0 0 26px' }}>
            You must review the video content above before you can confirm this module.
          </p>
        )}
      </div>
    </div>
  )
}

// ── Module detail view ────────────────────────────────────────────────────────

interface ModuleDetailProps {
  mod:       TrainingModuleContent
  prog:      ModuleProgress
  onUpdate:  (next: ModuleProgress) => void
  onBack:    () => void
}

function ModuleDetail({ mod, prog, onUpdate, onBack }: ModuleDetailProps) {
  const quizPassed         = isQuizPassed(prog, mod)
  const canConfirm         = quizPassed && prog.videoAcknowledged

  function updateAnswers(answers: (number | null)[]) {
    onUpdate({ ...prog, answers })
  }

  function toggleVideoAck() {
    onUpdate({ ...prog, videoAcknowledged: !prog.videoAcknowledged })
  }

  function toggleConfirm() {
    if (!canConfirm) return
    onUpdate({ ...prog, confirmed: !prog.confirmed })
  }

  const sectionStyle: React.CSSProperties = {
    background:   'rgba(255,255,255,0.03)',
    border:       '1px solid rgba(255,255,255,0.07)',
    borderRadius: 12,
    padding:      '14px 16px',
  }

  return (
    <div className="space-y-5">
      {/* Back link */}
      <button
        onClick={onBack}
        style={{
          background: 'none',
          border:     'none',
          cursor:     'pointer',
          color:      '#00c8ff',
          fontSize:   13,
          fontWeight: 600,
          padding:    0,
          display:    'flex',
          alignItems: 'center',
          gap:        4,
        }}
      >
        ← Back to Module List
      </button>

      {/* Module header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 32, lineHeight: 1 }}>{mod.icon}</span>
        <div>
          <h2 style={{ fontSize: 19, fontWeight: 800, color: '#ffffff', margin: 0 }}>{mod.title}</h2>
          {mod.estimatedMinutes && (
            <p style={{ margin: '3px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
              ⏱ ~{mod.estimatedMinutes} min · Read + Video + Quiz
            </p>
          )}
        </div>
      </div>

      {/* Summary */}
      <div style={sectionStyle}>
        <SectionHeader>📋 What This Module Teaches</SectionHeader>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 1.65, marginTop: 6 }}>
          {mod.summary}
        </p>
      </div>

      {/* Why it matters */}
      <div style={sectionStyle}>
        <SectionHeader>🛡 Why This Matters</SectionHeader>
        <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0', display: 'flex', flexDirection: 'column', gap: 7 }}>
          {mod.whyMatters.map(({ who, text }) => (
            <li key={who} style={{ fontSize: 13, color: 'rgba(255,255,255,0.78)', lineHeight: 1.5 }}>
              <span style={{ fontWeight: 700, color: 'rgba(0,200,255,0.9)' }}>{who}:</span>{' '}{text}
            </li>
          ))}
        </ul>
      </div>

      {/* Must Do */}
      <div style={sectionStyle}>
        <SectionHeader>✅ What You Must Do</SectionHeader>
        <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {mod.mustDo.map((item, i) => (
            <li key={i} style={{ fontSize: 13, color: 'rgba(187,247,208,1)', lineHeight: 1.5, display: 'flex', gap: 8 }}>
              <span style={{ color: 'rgba(34,197,94,0.9)', flexShrink: 0 }}>•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Must Not Do */}
      <div style={sectionStyle}>
        <SectionHeader>🚫 What You Must Not Do</SectionHeader>
        <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {mod.mustNotDo.map((item, i) => (
            <li key={i} style={{ fontSize: 13, color: 'rgba(254,202,202,1)', lineHeight: 1.5, display: 'flex', gap: 8 }}>
              <span style={{ color: 'rgba(239,68,68,0.9)', flexShrink: 0 }}>•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Examples */}
      <div style={sectionStyle}>
        <SectionHeader>📖 Real-Life Examples</SectionHeader>
        <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {mod.examples.map((ex, i) => (
            <li key={i} style={{
              fontSize:     13,
              color:        'rgba(255,255,255,0.78)',
              lineHeight:   1.55,
              fontStyle:    'italic',
              borderLeft:   '2px solid rgba(0,200,255,0.3)',
              paddingLeft:  12,
            }}>
              {ex}
            </li>
          ))}
        </ul>
      </div>

      {/* Outcomes */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={{
          ...sectionStyle,
          background: 'rgba(34,197,94,0.07)',
          border:     '1px solid rgba(34,197,94,0.2)',
        }}>
          <SectionHeader>🌟 When You Follow the Rules</SectionHeader>
          <p style={{ fontSize: 12, color: 'rgba(187,247,208,0.9)', lineHeight: 1.55, marginTop: 6 }}>
            {mod.positiveOutcome}
          </p>
        </div>
        <div style={{
          ...sectionStyle,
          background: 'rgba(239,68,68,0.07)',
          border:     '1px solid rgba(239,68,68,0.2)',
        }}>
          <SectionHeader>⚠️ When You Break the Rules</SectionHeader>
          <p style={{ fontSize: 12, color: 'rgba(254,202,202,0.9)', lineHeight: 1.55, marginTop: 6 }}>
            {mod.negativeOutcome}
          </p>
        </div>
      </div>

      <Divider />

      {/* Training video — must be acknowledged before confirmation */}
      {mod.video && (
        <VideoSection
          mod={mod}
          prog={prog}
          onToggle={toggleVideoAck}
        />
      )}

      <Divider />

      {/* Quiz */}
      <QuizSection mod={mod} prog={prog} onChange={updateAnswers} />

      <Divider />

      {/* Confirmation checkbox — requires video ack + quiz passed */}
      <div style={{
        ...sectionStyle,
        background: canConfirm ? 'rgba(0,200,255,0.07)' : 'rgba(255,255,255,0.02)',
        border:     `1px solid ${canConfirm ? 'rgba(0,200,255,0.25)' : 'rgba(255,255,255,0.08)'}`,
        opacity:    canConfirm ? 1 : 0.55,
      }}>
        <label style={{
          display:    'flex',
          alignItems: 'flex-start',
          gap:        10,
          cursor:     canConfirm ? 'pointer' : 'not-allowed',
          userSelect: 'none',
        }}>
          <input
            type="checkbox"
            checked={prog.confirmed}
            disabled={!canConfirm}
            onChange={toggleConfirm}
            style={{ marginTop: 2, accentColor: '#00c8ff', width: 16, height: 16, flexShrink: 0 }}
          />
          <span style={{
            fontSize:   13,
            color:      canConfirm ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.45)',
            fontWeight: 600,
            lineHeight: 1.5,
          }}>
            I understand this training module and agree to follow these rules.
          </span>
        </label>
        {!canConfirm && (
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 8, marginLeft: 26 }}>
            {!prog.videoAcknowledged && !quizPassed
              ? 'Review the training video and answer all quiz questions to enable this checkbox.'
              : !prog.videoAcknowledged
              ? 'Review the training video above to enable this checkbox.'
              : 'Answer all quiz questions correctly to enable this checkbox.'}
          </p>
        )}
      </div>

      {/* Save & back */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <PrimaryButton
          onClick={onBack}
          disabled={!isModuleComplete(prog, mod)}
          variant={isModuleComplete(prog, mod) ? undefined : 'secondary'}
        >
          {isModuleComplete(prog, mod) ? 'Save & Back to Modules ✓' : 'Complete this module to continue'}
        </PrimaryButton>
      </div>

      {!isModuleComplete(prog, mod) && (
        <button
          onClick={onBack}
          style={{
            background: 'none',
            border:     'none',
            cursor:     'pointer',
            color:      'rgba(255,255,255,0.4)',
            fontSize:   12,
            display:    'block',
            width:      '100%',
            textAlign:  'center',
            padding:    '4px 0',
          }}
        >
          Save progress and go back to list
        </button>
      )}
    </div>
  )
}

// ── StepTraining (main export) ────────────────────────────────────────────────

export interface StepTrainingProps {
  stepIndex:        number
  totalSteps:       number
  driverId:         string
  driverProfile:    DriverProfile | null
  isCommercialDriver: boolean
  value:            TrainingInfo
  onChange:         (v: TrainingInfo) => void
  onBack:           () => void
  onNext:           () => void | Promise<void>
}

export function StepTraining({
  stepIndex,
  totalSteps,
  driverId,
  driverProfile,
  isCommercialDriver,
  onBack,
  onNext,
}: StepTrainingProps) {
  // Select the correct module set for this driver type.
  const modules = getTrainingModules(isCommercialDriver)

  // If training was already completed (e.g. returning driver), fast-track.
  const alreadyDone = Boolean(driverProfile?.training_completed_at)

  // Per-module progress — persists across module open/close within this step visit.
  const [progress, setProgress] = useState<ProgressMap>(() => {
    const map: ProgressMap = {}
    for (const m of modules) {
      map[m.key] = makeBlankProgress(m.quiz.length)
    }
    return map
  })

  const [openKey,  setOpenKey]  = useState<ModuleKey | null>(null)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  const allComplete = modules.every(m => isModuleComplete(progress[m.key], m))

  function openModule(key: ModuleKey) {
    setProgress(prev => ({
      ...prev,
      [key]: { ...prev[key], opened: true },
    }))
    setOpenKey(key)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function closeModule() {
    setOpenKey(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function updateModuleProgress(key: ModuleKey, next: ModuleProgress) {
    setProgress(prev => ({ ...prev, [key]: next }))
  }

  async function submit() {
    if (!allComplete || saving) return
    setSaving(true)
    setError(null)
    try {
      const now          = new Date().toISOString()
      const trainingType = isCommercialDriver ? 'commercial' : 'consumer'
      const tVersion     = trainingKey(isCommercialDriver)

      // ── 1. Upsert per-module progress records ──────────────────────────────
      const moduleRows = modules.map(m => {
        const prog   = progress[m.key]
        const passed = isModuleComplete(prog, m)
        return {
          driver_id:          driverId,
          training_type:      trainingType,
          training_version:   tVersion,
          module_id:          m.key,
          module_status:      passed ? 'completed' : 'in_progress',
          quiz_score:         quizScore(prog, m),
          quiz_total:         m.quiz.length,
          video_acknowledged: prog.videoAcknowledged,
          completed_at:       passed ? now : null,
        }
      })

      const { error: modErr } = await supabase
        .from('driver_training_module_progress')
        .upsert(moduleRows, { onConflict: 'driver_id,module_id' })
      if (modErr) throw modErr

      // ── 2. Update driver_profiles ──────────────────────────────────────────
      const { data: existing } = await supabase
        .from('driver_profiles')
        .select('driver_type')
        .eq('driver_id', driverId)
        .maybeSingle()
      const driverType = (existing as { driver_type?: string } | null)?.driver_type ?? 'driver_1099'
      const { error: upErr } = await supabase
        .from('driver_profiles')
        .upsert(
          {
            driver_id:             driverId,
            driver_type:           driverType,
            training_completed_at: now,
            training_version:      tVersion,
          },
          { onConflict: 'driver_id' },
        )
      if (upErr) throw upErr
      await onNext()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save training completion')
    } finally {
      setSaving(false)
    }
  }

  const completedCount = modules.filter(m => isModuleComplete(progress[m.key], m)).length

  // ── Render: already done ────────────────────────────────────────────────────
  if (alreadyDone) {
    return (
      <AppShell>
        <div className="mx-auto max-w-2xl px-4 py-8">
          <div className="mb-6">
            <ProgressBar stepIndex={stepIndex} totalSteps={totalSteps} />
          </div>
          <GlassCard variant="elevated" padding="lg">
            <div className="space-y-5">
              <header className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider"
                   style={{ color: 'rgba(0,200,255,0.85)' }}>
                  Cyan&rsquo;s Brooklynn Recycling
                </p>
                <h1 className="text-xl font-semibold text-white">
                  {isCommercialDriver ? 'Commercial Training Modules' : 'Training Modules'}
                </h1>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>
                  You have already completed all training modules.
                </p>
              </header>
              <div style={{
                background:   'rgba(34,197,94,0.12)',
                border:       '1px solid rgba(34,197,94,0.35)',
                borderRadius: 12,
                padding:      '14px 16px',
                color:        'rgba(187,247,208,1)',
                fontSize:     13,
                fontWeight:   600,
              }}>
                ✅ All {modules.length} training modules completed. Click Continue to proceed.
              </div>
              <div className="flex items-center justify-between gap-3 pt-2">
                <PrimaryButton variant="secondary" onClick={onBack}>Back</PrimaryButton>
                <PrimaryButton onClick={onNext}>Continue</PrimaryButton>
              </div>
            </div>
          </GlassCard>
        </div>
      </AppShell>
    )
  }

  // ── Render: module detail ───────────────────────────────────────────────────
  if (openKey) {
    const mod  = modules.find(m => m.key === openKey)!
    const prog = progress[openKey]

    return (
      <AppShell>
        <div className="mx-auto max-w-2xl px-4 py-8">
          <div className="mb-6">
            <ProgressBar stepIndex={stepIndex} totalSteps={totalSteps} />
          </div>
          <GlassCard variant="elevated" padding="lg">
            <ModuleDetail
              mod={mod}
              prog={prog}
              onUpdate={(next) => updateModuleProgress(openKey, next)}
              onBack={closeModule}
            />
          </GlassCard>
        </div>
      </AppShell>
    )
  }

  // ── Render: module list ─────────────────────────────────────────────────────
  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-6">
          <ProgressBar stepIndex={stepIndex} totalSteps={totalSteps} />
        </div>
        <GlassCard variant="elevated" padding="lg">
          <div className="space-y-5">
            {/* Header */}
            <header className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider"
                 style={{ color: 'rgba(0,200,255,0.85)' }}>
                Cyan&rsquo;s Brooklynn Recycling
              </p>
              <h1 className="text-xl font-semibold text-white">
                {isCommercialDriver ? 'Commercial Training Modules' : 'Training Modules'}
              </h1>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>
                Open each module, read it, answer the quiz, and check the confirmation box.
                All {modules.length} modules are required before you can continue.
              </p>
            </header>

            {/* Progress summary */}
            <div style={{
              background:   completedCount === 5 ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.05)',
              border:       `1px solid ${completedCount === 5 ? 'rgba(34,197,94,0.35)' : 'rgba(255,255,255,0.10)'}`,
              borderRadius: 12,
              padding:      '12px 16px',
              display:      'flex',
              alignItems:   'center',
              justifyContent: 'space-between',
            }}>
              <p style={{
                fontSize:   13,
                fontWeight: 700,
                color:      completedCount === modules.length ? 'rgba(134,239,172,1)' : 'rgba(255,255,255,0.75)',
                margin:     0,
              }}>
                {completedCount === modules.length
                  ? '🎉 All modules complete!'
                  : `${completedCount} of ${modules.length} modules completed`}
              </p>
              {/* Mini progress dots */}
              <div style={{ display: 'flex', gap: 5 }}>
                {modules.map(m => {
                  const s = getStatus(progress[m.key], m)
                  return (
                    <div key={m.key} style={{
                      width:        10,
                      height:       10,
                      borderRadius: '50%',
                      background:   s === 'completed' ? 'rgba(34,197,94,0.9)' :
                                    s === 'in_progress' ? 'rgba(245,158,11,0.9)' :
                                    'rgba(255,255,255,0.15)',
                    }} />
                  )
                })}
              </div>
            </div>

            {/* Module cards */}
            <div className="space-y-3">
              {modules.map((mod) => (
                <ModuleCard
                  key={mod.key}
                  mod={mod}
                  status={getStatus(progress[mod.key], mod)}
                  onOpen={() => openModule(mod.key)}
                />
              ))}
            </div>

            {/* Error */}
            {error && (
              <p className="rounded-lg border px-3 py-2 text-xs font-medium"
                 style={{
                   background:  'rgba(239,68,68,0.08)',
                   borderColor: 'rgba(239,68,68,0.35)',
                   color:       'rgba(254,202,202,1)',
                 }}>
                {error}
              </p>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <PrimaryButton variant="secondary" onClick={onBack}>Back</PrimaryButton>
              <PrimaryButton
                onClick={submit}
                disabled={!allComplete}
                loading={saving}
              >
                {allComplete
                  ? 'Complete Training'
                  : `Complete all modules (${completedCount}/${modules.length})`}
              </PrimaryButton>
            </div>
          </div>
        </GlassCard>
      </div>
    </AppShell>
  )
}
