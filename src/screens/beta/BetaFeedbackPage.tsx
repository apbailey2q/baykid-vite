import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuthStore } from '../../store/authStore'

function fade(a: boolean, d = 0): React.CSSProperties {
  return {
    opacity:    a ? 1 : 0,
    transform:  a ? 'translateY(0)' : 'translateY(14px)',
    transition: `opacity 0.4s ease ${d}ms, transform 0.4s ease ${d}ms`,
  }
}

const SCREENS = [
  'Login / Signup',
  'Commercial Dashboard',
  'Commercial Pickup Request',
  'Commercial Schedule',
  'Commercial Invoices',
  'Commercial Support',
  'Driver Dashboard',
  'Driver Route / Stops',
  'Driver Safety Checklist',
  'Driver Inspection',
  'Driver Scan',
  'Driver Earnings',
  'Dispatch Messages',
  'Warehouse Dashboard',
  'Warehouse Expected Loads',
  'Warehouse Intake',
  'Warehouse Processing',
  'Admin Dashboard',
  'Admin Commercial Dispatch',
  'Admin Inspection Review',
  'Admin Driver Payouts',
  'Admin Reports',
  'Push Notifications',
  'Settings / Notifications',
  'Legal / Privacy',
  'Contact Support',
  'Other',
]

const ISSUE_TYPES = [
  { value: 'bug',             label: '🐛 Bug / Crash' },
  { value: 'ux',              label: '🎨 UI / UX Issue' },
  { value: 'performance',     label: '⚡ Performance' },
  { value: 'feature_request', label: '💡 Feature Request' },
  { value: 'security',        label: '🔒 Security Concern' },
  { value: 'other',           label: '📝 Other' },
]

const SEVERITIES = [
  { value: 'critical',   label: 'Critical',   desc: 'App crash, data loss, or blocked flow',   color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.4)' },
  { value: 'major',      label: 'Major',      desc: 'Significant issue with workaround',        color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.4)'  },
  { value: 'minor',      label: 'Minor',      desc: 'Small glitch or cosmetic issue',           color: '#00c8ff', bg: 'rgba(0,200,255,0.08)',  border: 'rgba(0,200,255,0.3)'   },
  { value: 'suggestion', label: 'Suggestion', desc: 'Improvement idea, not blocking',           color: '#4ade80', bg: 'rgba(74,222,128,0.07)', border: 'rgba(74,222,128,0.3)'  },
]

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 12,
  color: '#ffffff',
  fontSize: 13,
  padding: '10px 14px',
  outline: 'none',
  width: '100%',
}

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'rgba(255,255,255,0.35)',
  marginBottom: 6,
  display: 'block',
}

export default function BetaFeedbackPage() {
  const navigate    = useNavigate()
  const user        = useAuthStore(s => s.user)
  const profile     = useAuthStore(s => s.profile)
  const [a, setA]   = useState(false)
  const fileRef     = useRef<HTMLInputElement>(null)

  const [screen,       setScreen]       = useState('')
  const [issueType,    setIssueType]    = useState('')
  const [severity,     setSeverity]     = useState('')
  const [description,  setDescription]  = useState('')
  const [steps,        setSteps]        = useState('')
  const [improvement,  setImprovement]  = useState('')
  const [photoFile,    setPhotoFile]    = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [submitting,   setSubmitting]   = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [submitted,    setSubmitted]    = useState(false)

  useEffect(() => { const id = requestAnimationFrame(() => setA(true)); return () => cancelAnimationFrame(id) }, [])

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setError('Screenshot must be under 5 MB.'); return }
    setPhotoFile(file)
    const reader = new FileReader()
    reader.onload = () => setPhotoPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!screen || !issueType || !severity || !description.trim()) {
      setError('Please fill in all required fields.')
      return
    }
    setError(null)
    setSubmitting(true)

    try {
      let screenshotUrl: string | null = null

      // Upload screenshot if provided
      if (photoFile && user?.id) {
        const ext  = photoFile.name.split('.').pop() ?? 'png'
        const path = `${user.id}/${Date.now()}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('beta-screenshots')
          .upload(path, photoFile, { contentType: photoFile.type, upsert: false })
        if (uploadError) {
          console.warn('[BetaFeedback] screenshot upload failed:', uploadError.message)
        } else {
          const { data: urlData } = supabase.storage.from('beta-screenshots').getPublicUrl(path)
          screenshotUrl = urlData.publicUrl
        }
      }

      const { error: insertError } = await supabase.from('beta_feedback').insert({
        user_id:               user?.id ?? null,
        tester_role:           profile?.role ?? 'unknown',
        screen_tested:         screen,
        issue_type:            issueType,
        severity,
        description:           description.trim(),
        steps_to_reproduce:    steps.trim() || null,
        suggested_improvement: improvement.trim() || null,
        screenshot_url:        screenshotUrl,
      })

      if (insertError) throw new Error(insertError.message)
      setSubmitted(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Submission failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function resetForm() {
    setScreen(''); setIssueType(''); setSeverity('')
    setDescription(''); setSteps(''); setImprovement('')
    setPhotoFile(null); setPhotoPreview(null)
    setSubmitted(false); setError(null)
  }

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden" style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}>
      <div className="pointer-events-none absolute inset-0 grid-bg" />

      <header className="relative flex items-center justify-between px-4 py-3" style={{ background: 'rgba(4,10,24,0.92)', borderBottom: '1px solid rgba(0,200,255,0.12)', backdropFilter: 'blur(12px)', zIndex: 2 }}>
        <div className="flex items-center gap-3">
          <span className="text-xl font-extrabold" style={{ color: '#00c8ff' }}>Cyan&#39;s Brooklynn</span>
          <span style={{ color: 'rgba(0,200,255,0.3)' }}>|</span>
          <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>Beta Feedback</span>
        </div>
        <button onClick={() => navigate('/beta')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
          ← Beta Home
        </button>
      </header>

      <div className="relative flex-1 overflow-y-auto pb-20" style={{ zIndex: 1 }}>
        <div className="max-w-[520px] mx-auto px-4 pt-8 pb-8">

          {submitted ? (
            /* ── Success state ── */
            <div className="text-center pt-16" style={fade(true, 0)}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
              <h2 className="text-xl font-extrabold mb-2" style={{ color: '#ffffff' }}>Feedback submitted</h2>
              <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Thank you! The ops team will review your report. Critical issues are addressed within 24 hours.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={resetForm}
                  className="rounded-2xl py-3 text-sm font-bold transition-all hover:brightness-110"
                  style={{ background: 'rgba(0,200,255,0.12)', border: '1px solid rgba(0,200,255,0.3)', color: '#00c8ff' }}
                >
                  Submit Another
                </button>
                <button
                  onClick={() => navigate('/beta')}
                  className="rounded-2xl py-3 text-sm font-medium transition-all hover:opacity-70"
                  style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}
                >
                  Back to Beta Home
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-6" style={fade(a, 0)}>
                <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest mb-3 inline-block" style={{ background: 'rgba(94,234,212,0.1)', border: '1px solid rgba(94,234,212,0.3)', color: '#5eead4' }}>
                  Beta
                </span>
                <h1 className="text-2xl font-extrabold mb-1.5" style={{ color: '#ffffff' }}>Submit Feedback</h1>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  Report bugs, UX issues, or feature suggestions. All fields marked * are required.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-5">

                {/* Screen tested */}
                <div style={fade(a, 60)}>
                  <label style={labelStyle}>Screen Tested *</label>
                  <select
                    value={screen}
                    onChange={e => setScreen(e.target.value)}
                    required
                    style={{ ...inputStyle, colorScheme: 'dark', cursor: 'pointer' }}
                  >
                    <option value="" style={{ background: '#0d1b3e' }}>Select a screen…</option>
                    {SCREENS.map(s => (
                      <option key={s} value={s} style={{ background: '#0d1b3e' }}>{s}</option>
                    ))}
                  </select>
                </div>

                {/* Issue type */}
                <div style={fade(a, 80)}>
                  <label style={labelStyle}>Issue Type *</label>
                  <div className="grid grid-cols-3 gap-2">
                    {ISSUE_TYPES.map(t => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setIssueType(t.value)}
                        className="rounded-xl py-2.5 px-2 text-center transition-all hover:brightness-110"
                        style={{
                          fontSize: 11,
                          fontWeight: issueType === t.value ? 700 : 500,
                          background: issueType === t.value ? 'rgba(0,200,255,0.15)' : 'rgba(255,255,255,0.04)',
                          border: issueType === t.value ? '1px solid rgba(0,200,255,0.4)' : '1px solid rgba(255,255,255,0.08)',
                          color: issueType === t.value ? '#00c8ff' : 'rgba(255,255,255,0.5)',
                        }}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Severity */}
                <div style={fade(a, 100)}>
                  <label style={labelStyle}>Severity *</label>
                  <div className="flex flex-col gap-2">
                    {SEVERITIES.map(s => (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => setSeverity(s.value)}
                        className="flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all hover:brightness-110"
                        style={{
                          background: severity === s.value ? s.bg : 'rgba(255,255,255,0.03)',
                          border: severity === s.value ? `1px solid ${s.border}` : '1px solid rgba(255,255,255,0.07)',
                        }}
                      >
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                        <div className="flex-1">
                          <span className="text-xs font-bold" style={{ color: severity === s.value ? s.color : 'rgba(255,255,255,0.7)' }}>{s.label}</span>
                          <span className="text-xs ml-2" style={{ color: 'rgba(255,255,255,0.35)' }}>{s.desc}</span>
                        </div>
                        {severity === s.value && <span style={{ color: s.color, fontSize: 12 }}>✓</span>}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Description */}
                <div style={fade(a, 120)}>
                  <label style={labelStyle}>Description *</label>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Describe what happened. Be as specific as possible."
                    rows={4}
                    required
                    style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
                  />
                </div>

                {/* Steps to reproduce */}
                <div style={fade(a, 140)}>
                  <label style={labelStyle}>Steps to Reproduce <span style={{ color: 'rgba(255,255,255,0.2)', fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
                  <textarea
                    value={steps}
                    onChange={e => setSteps(e.target.value)}
                    placeholder="1. Go to…&#10;2. Tap…&#10;3. See…"
                    rows={3}
                    style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
                  />
                </div>

                {/* Screenshot */}
                <div style={fade(a, 160)}>
                  <label style={labelStyle}>Screenshot <span style={{ color: 'rgba(255,255,255,0.2)', fontWeight: 400, textTransform: 'none' }}>(optional, max 5 MB)</span></label>
                  <input ref={fileRef} type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} />
                  {photoPreview ? (
                    <div className="relative rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                      <img src={photoPreview} alt="Screenshot preview" style={{ width: '100%', maxHeight: 200, objectFit: 'cover' }} />
                      <button
                        type="button"
                        onClick={() => { setPhotoFile(null); setPhotoPreview(null); if (fileRef.current) fileRef.current.value = '' }}
                        className="absolute top-2 right-2 rounded-full px-2 py-1 text-xs font-bold"
                        style={{ background: 'rgba(248,113,113,0.8)', color: '#ffffff', border: 'none', cursor: 'pointer' }}
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="w-full rounded-2xl py-4 text-sm transition-all hover:brightness-110"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}
                    >
                      📎 Attach Screenshot
                    </button>
                  )}
                </div>

                {/* Suggested improvement */}
                <div style={fade(a, 180)}>
                  <label style={labelStyle}>Suggested Improvement <span style={{ color: 'rgba(255,255,255,0.2)', fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
                  <textarea
                    value={improvement}
                    onChange={e => setImprovement(e.target.value)}
                    placeholder="What would make this better?"
                    rows={2}
                    style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
                  />
                </div>

                {error && (
                  <div className="rounded-xl px-4 py-3 text-sm" style={{ ...fade(a, 0), background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }}>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-2xl py-4 text-sm font-bold transition-all hover:brightness-110 active:scale-[0.97] disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #0057e7, #00c8ff)', border: 'none', color: '#ffffff', ...fade(a, 200) }}
                >
                  {submitting ? 'Submitting…' : '📋 Submit Feedback'}
                </button>

              </form>
            </>
          )}

        </div>
      </div>
    </div>
  )
}
