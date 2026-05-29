// MarketingHome — Public BayKid landing page.
//
// Sections:
//   1. Hero               — headline + 3 CTAs (Trial / Demo / Waitlist)
//   2. Feature grid       — the 6 product showcases the spec calls out
//   3. Live counter strip — small "trusted by" social proof row (placeholders)
//   4. Three-up CTA block — Trial / Demo / Waitlist as standalone cards
//   5. Testimonials       — 3 placeholder quote cards
//   6. Final CTA banner   — gradient panel pointing to /signup

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MarketingLayout, Container, SectionHeading, primaryBtn, ghostBtn, tealBtn } from './MarketingLayout'
import { submitSignup } from '../../lib/marketingSignups'

const FEATURES = [
  {
    icon: '✍️',
    title: 'AI Marketing Center',
    body: 'Generate captions, scripts, carousels, and emails with Claude — your brand voice trained in.',
  },
  {
    icon: '⚙️',
    title: 'Automation',
    body: 'Rules that match comments, drafts replies, and create leads — draft-only by design, never auto-posts.',
  },
  {
    icon: '📅',
    title: 'Scheduling',
    body: 'Cross-post across Instagram, TikTok, LinkedIn, X, and Facebook from one queue.',
  },
  {
    icon: '🎯',
    title: 'CRM',
    body: 'Lead pipeline with 6 stages, automated capture from comments + emails, and follow-up tracking.',
  },
  {
    icon: '📊',
    title: 'Analytics',
    body: 'Per-surface engagement, publish-success rate, approval bottlenecks, session times — all live.',
  },
  {
    icon: '🎨',
    title: 'Brand Voice AI',
    body: 'Train the AI on your voice, vocabulary, and do/don\'t list. Outputs stay on-brand every time.',
  },
]

const TESTIMONIALS = [
  { name: 'Sarah · CMO',          company: 'EcoBrand Co.',   quote: "Cyan's Brooklynn cut our content production time by 70%. The brand-voice tuning means I trust what it ships.", accent: '#00c8ff' },
  { name: 'Marcus · Solo founder', company: 'Indie Studio',  quote: 'I run my entire content schedule solo. Automation rules and approval queue make it feel like I have a team.', accent: '#5eead4' },
  { name: 'Priya · Head of Growth', company: 'SaaS startup',  quote: 'The Lead Tracker integration is the killer feature. Comments turn into qualified leads automatically.', accent: '#a855f7' },
]

export default function MarketingHome() {
  return (
    <MarketingLayout>
      {/* ── 1. Hero ─────────────────────────────────────────────────────── */}
      <section style={{ paddingTop: 72, paddingBottom: 80 }}>
        <Container>
          <div style={{ textAlign: 'center', maxWidth: 760, margin: '0 auto' }}>
            <span style={{
              display: 'inline-block',
              background: 'rgba(0,200,255,0.10)', border: '1px solid rgba(0,200,255,0.3)',
              color: '#00c8ff', borderRadius: 999, padding: '4px 12px',
              fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase',
              marginBottom: 22,
            }}>
              🚀 Beta · Early access open
            </span>
            <h1 style={{
              color: '#fff', fontSize: 48, fontWeight: 900, lineHeight: 1.05,
              letterSpacing: '-0.02em', marginBottom: 18,
            }}>
              The marketing team{' '}
              <span style={{ background: 'linear-gradient(135deg,#00c8ff,#5eead4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                inside Claude.
              </span>
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 17, lineHeight: 1.6, marginBottom: 32 }}>
              Generate on-brand posts, draft replies, automate lead capture, and ship every approval
              through one workspace. Built on Claude. Designed for small teams that move fast.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 18 }}>
              <Link to="/signup" style={{ ...primaryBtn(), padding: '12px 22px', fontSize: 14 }}>
                Start free trial
              </Link>
              <Link to="/contact?intent=demo" style={{ ...ghostBtn(), padding: '12px 22px', fontSize: 14 }}>
                Book a demo
              </Link>
              <Link to="/contact?intent=waitlist" style={{ ...tealBtn(), padding: '12px 22px', fontSize: 14 }}>
                Join waitlist
              </Link>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
              No credit card required · 10 AI generations / month on free
            </p>
          </div>
        </Container>
      </section>

      {/* ── 2. Feature grid ────────────────────────────────────────────── */}
      <section style={{ paddingTop: 40, paddingBottom: 80 }}>
        <Container>
          <SectionHeading
            eyebrow="What's inside"
            title="Six tools, one workspace"
            kicker="Everything a lean team needs to write, ship, and convert — without bouncing between five SaaS tabs."
          />
          <div className="grid md:grid-cols-3 sm:grid-cols-2 grid-cols-1" style={{ gap: 16 }}>
            {FEATURES.map((f) => (
              <FeatureCard key={f.title} icon={f.icon} title={f.title} body={f.body} />
            ))}
          </div>
        </Container>
      </section>

      {/* ── 3. Social-proof strip ──────────────────────────────────────── */}
      <section style={{ paddingTop: 0, paddingBottom: 60 }}>
        <Container>
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 16, padding: '20px 24px',
            display: 'flex', flexWrap: 'wrap', justifyContent: 'space-around', alignItems: 'center', gap: 24,
          }}>
            <Stat n="3.2k+" l="posts shipped this month" />
            <Stat n="92%"   l="approval-on-first-try" />
            <Stat n="71%"   l="time saved vs manual" />
            <Stat n="< 8s"  l="avg AI generation" />
          </div>
        </Container>
      </section>

      {/* ── 4. Three-up CTA block ──────────────────────────────────────── */}
      <section style={{ paddingTop: 40, paddingBottom: 80 }}>
        <Container>
          <SectionHeading eyebrow="Pick your path" title="Start any way you want" />
          <div className="grid md:grid-cols-3 grid-cols-1" style={{ gap: 16 }}>
            <CTAColumn
              icon="🎉" title="Start a free trial"
              body="Spin up an org in two clicks. 10 AI generations on the house, no credit card."
              cta={<Link to="/signup" style={{ ...primaryBtn(), width: '100%', textAlign: 'center' }}>Create my workspace</Link>}
              accent="#00c8ff"
            />
            <CTAColumn
              icon="🎥" title="Book a 20-min demo"
              body="Quick screen-share with the founders. We'll wire your brand voice + first automation rule live."
              cta={<Link to="/contact?intent=demo" style={{ ...ghostBtn(), width: '100%', textAlign: 'center' }}>Pick a time</Link>}
              accent="#a855f7"
            />
            <WaitlistColumn />
          </div>
        </Container>
      </section>

      {/* ── 5. Testimonials ───────────────────────────────────────────── */}
      <section style={{ paddingTop: 40, paddingBottom: 80 }}>
        <Container>
          <SectionHeading
            eyebrow="What teams say"
            title="Loved by lean marketing teams"
            kicker="Placeholder quotes — replace with your real beta-user testimonials before launch."
          />
          <div className="grid md:grid-cols-3 grid-cols-1" style={{ gap: 16 }}>
            {TESTIMONIALS.map((t) => <TestimonialCard key={t.name} {...t} />)}
          </div>
        </Container>
      </section>

      {/* ── 6. Final CTA ───────────────────────────────────────────────── */}
      <section style={{ paddingTop: 40, paddingBottom: 60 }}>
        <Container>
          <div style={{
            background: 'linear-gradient(135deg, rgba(0,87,231,0.18) 0%, rgba(94,234,212,0.10) 100%)',
            border: '1px solid rgba(0,200,255,0.32)',
            borderRadius: 22, padding: 40, textAlign: 'center',
            boxShadow: '0 12px 60px rgba(0,190,255,0.18)',
          }}>
            <h3 style={{ color: '#fff', fontSize: 28, fontWeight: 800, lineHeight: 1.2, marginBottom: 12 }}>
              Ready to give your marketing a co-pilot?
            </h3>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, marginBottom: 22, maxWidth: 540, margin: '0 auto 22px' }}>
              Sign up takes under a minute. Cancel anytime. Your data stays yours.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/signup" style={{ ...primaryBtn(), padding: '12px 24px', fontSize: 14 }}>Start free trial</Link>
              <Link to="/pricing" style={{ ...ghostBtn(), padding: '12px 24px', fontSize: 14 }}>See pricing</Link>
            </div>
          </div>
        </Container>
      </section>
    </MarketingLayout>
  )
}

// ── Subcomponents (page-local) ─────────────────────────────────────────────

function FeatureCard({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 16, padding: 20,
      transition: 'transform 0.2s, border-color 0.2s',
    }}>
      <div style={{ fontSize: 30, marginBottom: 10 }}>{icon}</div>
      <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{title}</h3>
      <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 1.55 }}>{body}</p>
    </div>
  )
}

function Stat({ n, l }: { n: string; l: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ color: '#00c8ff', fontWeight: 800, fontSize: 22 }}>{n}</div>
      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 2 }}>{l}</div>
    </div>
  )
}

function CTAColumn({ icon, title, body, cta, accent }: { icon: string; title: string; body: string; cta: React.ReactNode; accent: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: `1px solid ${accent}40`,
      borderRadius: 16, padding: 22,
      display: 'flex', flexDirection: 'column', gap: 14,
      boxShadow: `0 4px 22px ${accent}1A`,
    }}>
      <div style={{ fontSize: 30 }}>{icon}</div>
      <h3 style={{ color: '#fff', fontSize: 17, fontWeight: 700, margin: 0 }}>{title}</h3>
      <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 1.55, flex: 1 }}>{body}</p>
      {cta}
    </div>
  )
}

function WaitlistColumn() {
  const [email, setEmail]   = useState('')
  const [status, setStatus] = useState<'idle' | 'busy' | 'ok' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setStatus('busy'); setErrorMsg('')
    const r = await submitSignup({ kind: 'waitlist', email, sourcePage: '/marketing#cta-block' })
    if (r.ok) { setStatus('ok'); setEmail('') }
    else      { setStatus('error'); setErrorMsg(r.error ?? 'Try again') }
  }

  return (
    <div style={{
      background: 'rgba(94,234,212,0.06)',
      border: '1px solid rgba(94,234,212,0.4)',
      borderRadius: 16, padding: 22,
      display: 'flex', flexDirection: 'column', gap: 14,
      boxShadow: '0 4px 22px rgba(94,234,212,0.1)',
    }}>
      <div style={{ fontSize: 30 }}>📨</div>
      <h3 style={{ color: '#fff', fontSize: 17, fontWeight: 700, margin: 0 }}>Join the waitlist</h3>
      <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 1.55, flex: 1 }}>
        Not ready yet? Drop your email — we'll ping you when new tiers and features ship.
      </p>
      {status === 'ok' ? (
        <p style={{ color: '#22c55e', fontSize: 13, fontWeight: 600 }}>✓ You're on the list.</p>
      ) : (
        <form onSubmit={submit} style={{ display: 'flex', gap: 6 }}>
          <input
            type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com" required
            style={{
              flex: 1, minWidth: 0, boxSizing: 'border-box',
              background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, padding: '8px 10px',
              color: '#fff', fontSize: 13, outline: 'none',
            }}
          />
          <button
            type="submit" disabled={status === 'busy'}
            style={{
              background: 'rgba(94,234,212,0.18)', color: '#5eead4',
              border: '1px solid rgba(94,234,212,0.4)',
              borderRadius: 8, padding: '8px 14px',
              fontWeight: 700, fontSize: 12, cursor: status === 'busy' ? 'wait' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {status === 'busy' ? '…' : 'Notify me'}
          </button>
        </form>
      )}
      {status === 'error' && <p style={{ color: '#f87171', fontSize: 11 }}>{errorMsg}</p>}
    </div>
  )
}

function TestimonialCard({ name, company, quote, accent }: { name: string; company: string; quote: string; accent: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 16, padding: 20,
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <span style={{ color: accent, fontSize: 32, lineHeight: 1, fontWeight: 800 }}>"</span>
      <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, lineHeight: 1.6, fontStyle: 'italic', margin: 0 }}>{quote}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
        <div style={{
          width: 38, height: 38, borderRadius: '50%',
          background: `linear-gradient(135deg, ${accent}, rgba(255,255,255,0.18))`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 800,
        }}>
          {name[0]}
        </div>
        <div>
          <div style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{name}</div>
          <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>{company}</div>
        </div>
      </div>
    </div>
  )
}
