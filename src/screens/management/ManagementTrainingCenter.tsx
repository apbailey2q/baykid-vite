// ManagementTrainingCenter.tsx — Management Training Center
//
// Displays all 10 management training modules. Tracks completion per-module
// via management_training_completions. Requires a management_profiles row.

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuthStore } from '../../store/authStore'
import {
  getManagementTrainingModules,
  MANAGEMENT_TRAINING_VERSION,
  type ManagementTrainingModule,
  type ManagementQuizQuestion,
} from './managementTrainingData'
import type { ManagementProfile } from '../../types'

const BRAND        = '#00c8ff'
const BRAND_DIM    = 'rgba(0,200,255,0.08)'
const BRAND_BORDER = 'rgba(0,200,255,0.25)'
const SUCCESS      = '#4ade80'
const WARN         = '#fbbf24'

interface CompletionRecord {
  module_id:   string
  passed:      boolean
  quiz_score:  number | null
}

export default function ManagementTrainingCenter() {
  const { user, role } = useAuthStore()
  const navigate = useNavigate()

  const modules = getManagementTrainingModules()

  const [profile,     setProfile]     = useState<ManagementProfile | null>(null)
  const [completions, setCompletions] = useState<CompletionRecord[]>([])
  const [loading,     setLoading]     = useState(true)
  const [activeId,    setActiveId]    = useState<string | null>(null)
  const [answers,     setAnswers]     = useState<Record<number, number>>({})
  const [quizDone,    setQuizDone]    = useState(false)
  const [quizPassed,  setQuizPassed]  = useState(false)
  const [quizScore,   setQuizScore]   = useState(0)
  const [saving,      setSaving]      = useState(false)

  useEffect(() => {
    if (!user) return
    async function load() {
      setLoading(true)
      try {
        if (role !== 'admin') {
          const { data: mp } = await supabase
            .from('management_profiles')
            .select('*')
            .eq('user_id', user!.id)
            .maybeSingle()
          if (!mp || !(mp as ManagementProfile).onboarding_completed) {
            navigate('/management/onboarding', { replace: true })
            return
          }
          setProfile(mp as ManagementProfile)
        }
        const { data: comps } = await supabase
          .from('management_training_completions')
          .select('module_id, passed, quiz_score')
          .eq('management_profile_id', profile?.id ?? '')
        setCompletions((comps ?? []) as CompletionRecord[])
      } finally {
        setLoading(false)
      }
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, role])

  const isComplete = (id: string) => completions.some(c => c.module_id === id && c.passed)

  const completedCount = modules.filter(m => isComplete(m.id)).length

  function openModule(id: string) {
    setActiveId(id)
    setAnswers({})
    setQuizDone(false)
    setQuizPassed(false)
    setQuizScore(0)
  }

  async function submitQuiz(mod: ManagementTrainingModule) {
    const correct = mod.quizQuestions.filter((q, i) => answers[i] === q.correct).length
    const passed  = correct >= mod.passingScore
    setQuizScore(correct)
    setQuizDone(true)
    setQuizPassed(passed)

    if (passed && profile) {
      setSaving(true)
      try {
        await supabase
          .from('management_training_completions')
          .upsert({
            management_profile_id: profile.id,
            module_id:             mod.id,
            module_title:          mod.title,
            completed:             true,
            completed_at:          new Date().toISOString(),
            quiz_score:            correct,
            passed:                true,
            training_version:      MANAGEMENT_TRAINING_VERSION,
          }, { onConflict: 'management_profile_id,module_id' })
        setCompletions(prev => {
          const filtered = prev.filter(c => c.module_id !== mod.id)
          return [...filtered, { module_id: mod.id, passed: true, quiz_score: correct }]
        })
      } finally {
        setSaving(false)
      }
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: '#060e24' }}>
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-t-transparent"
          style={{ borderColor: BRAND, borderTopColor: 'transparent' }} />
      </div>
    )
  }

  const activeModule = modules.find(m => m.id === activeId)

  return (
    <div className="min-h-screen" style={{ background: '#060e24' }}>
      {/* Header */}
      <div className="sticky top-0 z-10 px-4 py-3"
        style={{ background: 'rgba(6,14,36,0.95)', borderBottom: '1px solid rgba(0,200,255,0.1)', backdropFilter: 'blur(10px)' }}>
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-xs font-bold tracking-widest" style={{ color: BRAND }}>CYAN'S BROOKLYNN RECYCLING</p>
            <p className="text-white font-bold text-lg">Management Training Center</p>
          </div>
          <div className="text-right">
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{completedCount} / {modules.length} complete</p>
            <div className="mt-1 h-1.5 w-24 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
              <div className="h-full rounded-full transition-all" style={{ background: SUCCESS, width: `${(completedCount / modules.length) * 100}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {!activeModule ? (
          // Module list
          <div className="space-y-3">
            <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Complete all 10 modules to maintain your Management Certification. Each module requires passing the quiz at {' '}
              80%+ correct.
            </p>
            {modules.map((mod, idx) => {
              const done  = isComplete(mod.id)
              const comp  = completions.find(c => c.module_id === mod.id)
              return (
                <div
                  key={mod.id}
                  className="rounded-2xl p-5 cursor-pointer transition-all hover:brightness-110"
                  style={{ background: done ? 'rgba(74,222,128,0.05)' : 'rgba(255,255,255,0.03)', border: `1px solid ${done ? 'rgba(74,222,128,0.2)' : 'rgba(255,255,255,0.07)'}` }}
                  onClick={() => openModule(mod.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <span className="text-xl mt-0.5">{done ? '✅' : `${idx + 1}.`}</span>
                      <div>
                        <p className="font-semibold text-white text-sm">{mod.title}</p>
                        <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>{mod.description}</p>
                        <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>~{mod.estimatedMinutes} min</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {done ? (
                        <p className="text-xs font-semibold" style={{ color: SUCCESS }}>
                          {comp?.quiz_score}/{mod.quizQuestions.length}
                        </p>
                      ) : (
                        <span className="text-xs px-2 py-1 rounded-full" style={{ background: BRAND_DIM, color: BRAND, border: `1px solid ${BRAND_BORDER}` }}>
                          Start
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          // Module detail
          <div>
            <button
              onClick={() => setActiveId(null)}
              className="mb-6 text-sm px-4 py-2 rounded-xl transition-all"
              style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              ← Back to Modules
            </button>

            <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(0,200,255,0.12)' }}>
              <h2 className="text-xl font-bold text-white mb-1">{activeModule.title}</h2>
              <p className="text-xs mb-6" style={{ color: 'rgba(255,255,255,0.4)' }}>~{activeModule.estimatedMinutes} min · {activeModule.quizQuestions.length} questions · {activeModule.passingScore}+ correct to pass</p>

              {/* Content sections */}
              <div className="space-y-6 mb-8">
                {activeModule.contentSections.map(sec => (
                  <div key={sec.heading}>
                    <h3 className="text-sm font-bold mb-2" style={{ color: BRAND }}>{sec.heading}</h3>
                    <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: 'rgba(255,255,255,0.72)' }}>{sec.body}</p>
                  </div>
                ))}
              </div>

              {/* Quiz */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1.5rem' }}>
                <h3 className="text-sm font-bold text-white mb-4">Quiz — {activeModule.quizQuestions.length} Questions</h3>
                {quizDone && quizPassed && (
                  <div className="mb-4 p-3 rounded-xl text-center" style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)' }}>
                    <p className="font-bold" style={{ color: SUCCESS }}>✅ Passed! {quizScore}/{activeModule.quizQuestions.length}</p>
                    {saving && <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Saving…</p>}
                  </div>
                )}
                {quizDone && !quizPassed && (
                  <div className="mb-4 p-3 rounded-xl text-center" style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)' }}>
                    <p className="font-bold" style={{ color: WARN }}>Score: {quizScore}/{activeModule.quizQuestions.length} — Need {activeModule.passingScore} to pass</p>
                    <button onClick={() => { setAnswers({}); setQuizDone(false) }} className="mt-2 text-xs underline" style={{ color: WARN }}>Retry</button>
                  </div>
                )}

                <div className="space-y-6">
                  {activeModule.quizQuestions.map((q: ManagementQuizQuestion, qi: number) => (
                    <div key={qi}>
                      <p className="text-sm font-semibold text-white mb-3">{qi + 1}. {q.question}</p>
                      <div className="space-y-2">
                        {q.options.map((opt: string, oi: number) => {
                          const selected   = answers[qi] === oi
                          const isCorrect  = quizDone && oi === q.correct
                          const isWrong    = quizDone && selected && oi !== q.correct
                          return (
                            <label
                              key={oi}
                              className="flex items-center gap-3 p-3 rounded-xl transition-all"
                              style={{
                                background: isCorrect ? 'rgba(74,222,128,0.1)' : isWrong ? 'rgba(239,68,68,0.1)' : selected ? BRAND_DIM : 'rgba(255,255,255,0.02)',
                                border: `1px solid ${isCorrect ? 'rgba(74,222,128,0.35)' : isWrong ? 'rgba(239,68,68,0.35)' : selected ? BRAND_BORDER : 'rgba(255,255,255,0.06)'}`,
                                cursor: quizDone ? 'default' : 'pointer',
                              }}
                            >
                              <input
                                type="radio" name={`q${qi}`} value={oi}
                                checked={selected} disabled={quizDone}
                                onChange={() => setAnswers(prev => ({ ...prev, [qi]: oi }))}
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

                {!quizDone && (
                  <button
                    onClick={() => submitQuiz(activeModule)}
                    disabled={Object.keys(answers).length < activeModule.quizQuestions.length}
                    className="mt-6 w-full py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-40"
                    style={{ background: BRAND, color: '#000' }}
                  >
                    {Object.keys(answers).length < activeModule.quizQuestions.length
                      ? `Answer all ${activeModule.quizQuestions.length} questions to submit`
                      : 'Submit Quiz'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
