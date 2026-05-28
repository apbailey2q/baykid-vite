// ContactPage — Public-facing contact / demo-request / waitlist form.
//
// One form, three "intents" you can deep-link with ?intent=contact|demo|waitlist.
// All three submit through lib/marketingSignups.submitSignup() into the same
// marketing_signups table, keyed by kind.

import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { MarketingLayout, Container, primaryBtn } from './MarketingLayout'
import { submitSignup, type SignupKind } from '../../lib/marketingSignups'

type Intent = 'contact' | 'demo' | 'waitlist'

const INTENT_META: Record<Intent, {
  kind:      SignupKind
  title:     string
  kicker:    string
  cta:       string
  showCompany: boolean
  showMessage: boolean
  messagePlaceholder: string
  accent:    string
}> = {
  contact: {
    kind: 'contact',
    title: 'Get in touch',
    kicker: "Tell us what you're working on. We answer every email.",
    cta: 'Send message',
    showCompany: true,
    showMessage: true,
    messagePlaceholder: 'What\'s on your mind?',
    accent: '#00c8ff',
  },
  demo: {
    kind: 'demo_request',
    title: 'Book a 20-minute demo',
    kicker: 'A founder will walk through the workspace with you and wire your first brand voice + automation rule live.',
    cta: 'Request demo',
    showCompany: true,
    showMessage: true,
    messagePlaceholder: 'What would you like to see? (Optional)',
    accent: '#a855f7',
  },
  waitlist: {
    kind: 'waitlist',
    title: 'Join the waitlist',
    kicker: "We'll email you when new tiers, integrations, or features ship.",
    cta: 'Join waitlist',
    showCompany: false,
    showMessage: false,
    messagePlaceholder: '',
    accent: '#5eead4',
  },
}

export default function ContactPage() {
  const [params] = useSearchParams()
  const intentParam = params.get('intent') as Intent | null
  const [intent, setIntent] = useState<Intent>(intentParam && INTENT_META[intentParam] ? intentParam : 'contact')

  // Reflect intent param changes (deep-links from other pages).
  useEffect(() => {
    if (intentParam && INTENT_META[intentParam]) setIntent(intentParam)
  }, [intentParam])

  const meta = INTENT_META[intent]

  // Form state
  const [name,    setName]    = useState('')
  const [email,   setEmail]   = useState('')
  const [company, setCompany] = useState('')
  const [message, setMessage] = useState('')
  const [status,  setStatus]  = useState<'idle' | 'busy' | 'ok' | 'error'>('idle')
  const [error,   setError]   = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('busy'); setError('')
    const r = await submitSignup({
      kind:    meta.kind,
      email, name, company,
      message,
      sourcePage: '/contact',
    })
    if (r.ok) { setStatus('ok'); setName(''); setEmail(''); setCompany(''); setMessage('') }
    else      { setStatus('error'); setError(r.error ?? 'Submission failed') }
  }

  return (
    <MarketingLayout>
      <section style={{ paddingTop: 64, paddingBottom: 60 }}>
        <Container>
          <div className="grid lg:grid-cols-2 grid-cols-1" style={{ gap: 36, alignItems: 'flex-start' }}>
            {/* Left: header + intent switcher */}
            <div>
              <span style={{ color: meta.accent, fontSize: 11, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
                Contact
              </span>
              <h1 style={{ color: '#fff', fontSize: 38, fontWeight: 900, lineHeight: 1.1, marginTop: 10, marginBottom: 14, letterSpacing: '-0.02em' }}>
                {meta.title}
              </h1>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 15, lineHeight: 1.6, marginBottom: 24 }}>
                {meta.kicker}
              </p>

              {/* Intent picker */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 22 }}>
                {(Object.keys(INTENT_META) as Intent[]).map((i) => {
                  const active = i === intent
                  return (
                    <button
                      key={i}
                      onClick={() => setIntent(i)}
                      style={{
                        background: active ? `${INTENT_META[i].accent}1A` : 'rgba(255,255,255,0.04)',
                        border: active ? `1px solid ${INTENT_META[i].accent}66` : '1px solid rgba(255,255,255,0.1)',
                        color:  active ? INTENT_META[i].accent : 'rgba(255,255,255,0.7)',
                        borderRadius: 10, padding: '8px 14px',
                        fontWeight: 700, fontSize: 12, cursor: 'pointer', textTransform: 'capitalize',
                      }}
                    >
                      {INTENT_META[i].title}
                    </button>
                  )
                })}
              </div>

              {/* Sidebar info */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <SideInfo icon="📧" title="Email us"      body="hello@baykid.example" />
                <SideInfo icon="💬" title="In-app support" body={<Link to="/support/contact" style={{ color: '#00c8ff' }}>Open a ticket</Link>} />
                <SideInfo icon="🐦" title="Follow along"   body="@baykid_ai" />
              </div>
            </div>

            {/* Right: the form */}
            <div style={{
              background: 'rgba(255,255,255,0.04)',
              border: `1px solid ${meta.accent}40`,
              borderRadius: 18, padding: 24,
            }}>
              {status === 'ok' ? (
                <SuccessPanel intent={intent} onAgain={() => setStatus('idle')} />
              ) : (
                <form onSubmit={submit}>
                  <Field label="Email" required>
                    <input
                      type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      required style={input()}
                      placeholder="you@company.com"
                    />
                  </Field>
                  {meta.showCompany && (
                    <div className="grid sm:grid-cols-2 grid-cols-1" style={{ gap: 10 }}>
                      <Field label="Name">
                        <input value={name} onChange={(e) => setName(e.target.value)} style={input()} placeholder="Your name" />
                      </Field>
                      <Field label="Company">
                        <input value={company} onChange={(e) => setCompany(e.target.value)} style={input()} placeholder="Org / company" />
                      </Field>
                    </div>
                  )}
                  {meta.showMessage && (
                    <Field label="Message">
                      <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} style={{ ...input(), resize: 'vertical', fontFamily: 'inherit' }} placeholder={meta.messagePlaceholder} />
                    </Field>
                  )}
                  {status === 'error' && (
                    <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', borderRadius: 10, padding: 10, fontSize: 12, marginBottom: 10 }}>
                      {error}
                    </div>
                  )}
                  <button
                    type="submit" disabled={status === 'busy'}
                    style={{
                      ...primaryBtn(),
                      width: '100%', textAlign: 'center', padding: '12px 16px', fontSize: 14,
                      cursor: status === 'busy' ? 'wait' : 'pointer',
                      opacity: status === 'busy' ? 0.7 : 1,
                    }}
                  >
                    {status === 'busy' ? 'Sending…' : meta.cta}
                  </button>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, marginTop: 10, textAlign: 'center' }}>
                    We respect your inbox. No marketing spam — promise.
                  </p>
                </form>
              )}
            </div>
          </div>
        </Container>
      </section>
    </MarketingLayout>
  )
}

function SuccessPanel({ intent, onAgain }: { intent: Intent; onAgain: () => void }) {
  const msgs: Record<Intent, string> = {
    contact:  'Thanks — we got your message. Expect a reply within 1 business day.',
    demo:     'Got it — we\'ll email you a calendar link for the demo within 1 business day.',
    waitlist: 'You\'re on the list — we\'ll be in touch as soon as there\'s news.',
  }
  return (
    <div style={{ textAlign: 'center', padding: '14px 0' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
      <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 800, marginBottom: 10 }}>Got it.</h3>
      <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, lineHeight: 1.6, marginBottom: 18, maxWidth: 380, margin: '0 auto 18px' }}>{msgs[intent]}</p>
      <button onClick={onAgain} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)', borderRadius: 8, padding: '8px 14px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
        Submit another
      </button>
    </div>
  )
}

function SideInfo({ icon, title, body }: { icon: string; title: string; body: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <div>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{title}</div>
        <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 2 }}>{body}</div>
      </div>
    </div>
  )
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 5 }}>
        {label} {required && <span style={{ color: '#f87171' }}>*</span>}
      </span>
      {children}
    </label>
  )
}

function input(): React.CSSProperties {
  return {
    width: '100%', boxSizing: 'border-box',
    background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8, padding: 10, color: '#fff', fontSize: 13, outline: 'none',
  }
}
