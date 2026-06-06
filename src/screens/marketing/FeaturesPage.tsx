// FeaturesPage — Deep dive into the 6 product areas.
//
// Each area gets its own alternating left/right detail block with: icon,
// title, kicker, 4 bullet points, and a small mock visualization.

import { Link } from 'react-router-dom'
import { MarketingLayout, Container, SectionHeading, primaryBtn, ghostBtn } from './MarketingLayout'

interface FeatureBlock {
  id:       string
  icon:     string
  eyebrow:  string
  title:    string
  kicker:   string
  bullets:  string[]
  accent:   string
  mock:     React.ReactNode
}

const BLOCKS: FeatureBlock[] = [
  {
    id: 'ai-marketing', icon: '✍️', eyebrow: 'AI Marketing Center', accent: '#00c8ff',
    title: 'Generate every format from one brief.',
    kicker: 'Captions, reels scripts, carousels, email replies, voiceovers — Claude writes the first draft so you can ship the polish.',
    bullets: [
      '8 content types out of the box — social posts, scripts, carousels, comment replies, email drafts, storyboards, voiceovers, analytics reviews.',
      'Reuse prompts via Templates with variables for lead name, city, product, etc.',
      'Every generation logs as a draft — nothing posts without review.',
      'Optional Claude API fallback to a local "demo" mode when keys are missing so dev never blocks.',
    ],
    mock: <PostMock />,
  },
  {
    id: 'automation', icon: '⚙️', eyebrow: 'Automation', accent: '#a855f7',
    title: 'Rules that draft, never auto-post.',
    kicker: 'Match comments by keyword, sentiment, or category. Draft a reply, route to approval, create a lead — all with a human in the loop.',
    bullets: [
      '5 rule types — auto-reply, auto-draft email, create lead, high-risk → approval, suggest posting time.',
      'ALL or ANY condition logic, mix-and-match across keyword / platform / sentiment / category.',
      'Draft-only by design — no rule ever posts publicly without a reviewer click.',
      'Trigger counts + last-run timestamps surfaced on each rule for at-a-glance health.',
    ],
    mock: <RuleMock />,
  },
  {
    id: 'scheduling', icon: '📅', eyebrow: 'Scheduling', accent: '#5eead4',
    title: 'Cross-post from one queue.',
    kicker: 'One approved post can fan out to Instagram, TikTok, LinkedIn, X, Facebook, and YouTube — each on its own platform-side schedule.',
    bullets: [
      'Per-platform timezone awareness so you hit local-time peaks everywhere.',
      'Retry tracking — attempt_count + last_error on every scheduled row.',
      'Calendar view groups by date; queue view sorts by next-up time.',
      'Cancellation flows that reflect platform-side status correctly.',
    ],
    mock: <CalendarMock />,
  },
  {
    id: 'crm', icon: '🎯', eyebrow: 'CRM', accent: '#fbbf24',
    title: '6-stage lead pipeline, automated capture.',
    kicker: 'Comments and emails that show purchase intent turn into leads automatically. Every lead carries the source quote so you know exactly why it landed.',
    bullets: [
      'Stages: New → Contacted → Interested → Follow-Up → Converted → Lost.',
      'Pipeline board + list view; both share the same detail panel + add/edit modal.',
      'Stats: New, Follow-Ups Due, Converted, Lost — live counters refresh on writes.',
      'createLeadFromComment/Email/Post — clean entry points the rules engine calls.',
    ],
    mock: <LeadMock />,
  },
  {
    id: 'analytics', icon: '📊', eyebrow: 'Analytics', accent: '#fb923c',
    title: 'See what works without leaving the app.',
    kicker: 'Publish-success rate, approval bottlenecks, most-used surfaces, average session — pulled from your own data, not third-party pixels.',
    bullets: [
      'Publish success rate computed from ai_posts status distribution.',
      'Approval bottleneck = avg minutes from create to decided across 7 days.',
      'Top-8 most-used surfaces ranked from app_events table.',
      'Optional PostHog integration when you want full-fidelity product analytics.',
    ],
    mock: <AnalyticsMock />,
  },
  {
    id: 'brand-voice', icon: '🎨', eyebrow: 'Brand Voice AI', accent: '#00c8ff',
    title: 'Train the AI on how you sound.',
    kicker: 'Persona, tone, do/don\'t vocabulary, example post, example reply — all stored per-org and injected into every generation.',
    bullets: [
      'One-time setup; every Claude call reads from ai_brand_voice automatically.',
      'Per-org separation — RLS guarantees the AI never bleeds voice across tenants.',
      'Update once, all subsequent generations follow the new voice.',
      'Optional example_post + example_reply for few-shot priming the model.',
    ],
    mock: <BrandVoiceMock />,
  },
]

export default function FeaturesPage() {
  return (
    <MarketingLayout>
      {/* Hero */}
      <section style={{ paddingTop: 64, paddingBottom: 40 }}>
        <Container>
          <div style={{ textAlign: 'center', maxWidth: 720, margin: '0 auto' }}>
            <span style={{ color: '#00c8ff', fontSize: 11, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
              Features
            </span>
            <h1 style={{ color: '#fff', fontSize: 40, fontWeight: 900, lineHeight: 1.1, marginTop: 10, marginBottom: 14, letterSpacing: '-0.02em' }}>
              Six tools, one workspace.
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 16, lineHeight: 1.55 }}>
              Each tool is built to play nicely with the others. Generate a post, route it through approval,
              schedule it, watch comments convert into leads, review the analytics — all without switching tabs.
            </p>
          </div>
        </Container>
      </section>

      {/* Feature blocks */}
      <section style={{ paddingTop: 20, paddingBottom: 60 }}>
        <Container>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 72 }}>
            {BLOCKS.map((b, i) => (
              <FeatureRow key={b.id} block={b} reverse={i % 2 === 1} />
            ))}
          </div>
        </Container>
      </section>

      {/* Bottom CTA */}
      <section style={{ paddingTop: 40, paddingBottom: 60 }}>
        <Container>
          <SectionHeading title="See it in action" kicker="A 20-minute demo is faster than reading another features page." />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/signup" style={{ ...primaryBtn(), padding: '12px 22px', fontSize: 14 }}>Start free trial</Link>
            <Link to="/contact?intent=demo" style={{ ...ghostBtn(), padding: '12px 22px', fontSize: 14 }}>Book a demo</Link>
          </div>
        </Container>
      </section>
    </MarketingLayout>
  )
}

function FeatureRow({ block, reverse }: { block: FeatureBlock; reverse: boolean }) {
  return (
    <div
      className={`grid md:grid-cols-2 grid-cols-1 items-center`}
      style={{ gap: 32 }}
    >
      <div style={{ order: reverse ? 2 : 1 }}>
        <span style={{
          color: block.accent, fontSize: 11, fontWeight: 800,
          letterSpacing: '0.16em', textTransform: 'uppercase',
        }}>
          {block.icon} {block.eyebrow}
        </span>
        <h3 style={{ color: '#fff', fontSize: 28, fontWeight: 800, lineHeight: 1.2, marginTop: 10, marginBottom: 12, letterSpacing: '-0.01em' }}>
          {block.title}
        </h3>
        <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14, lineHeight: 1.65, marginBottom: 16 }}>
          {block.kicker}
        </p>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {block.bullets.map((b, i) => (
            <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <span style={{ color: block.accent, fontSize: 14, lineHeight: 1.5 }}>✓</span>
              <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, lineHeight: 1.6 }}>{b}</span>
            </li>
          ))}
        </ul>
      </div>
      <div style={{ order: reverse ? 1 : 2 }}>
        {block.mock}
      </div>
    </div>
  )
}

// ── Mock visualizations (pure SVG/CSS, no real data) ───────────────────────

function MockFrame({ children, accent }: { children: React.ReactNode; accent: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: `1px solid ${accent}40`,
      borderRadius: 16, padding: 20,
      boxShadow: `0 8px 36px ${accent}1A`,
    }}>
      {children}
    </div>
  )
}

function PostMock() {
  return (
    <MockFrame accent="#00c8ff">
      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Draft · social_post</div>
      <div style={{ color: '#fff', fontSize: 13, lineHeight: 1.6, marginBottom: 10 }}>
        Friday wins: shipped 4 new automation rules + Lead Tracker v2. The AI Marketing Center is feeling
        more like a teammate every week.
      </div>
      <div style={{ color: '#00c8ff', fontSize: 11 }}>#CyansBrooklynn #AIWorkflows #BuildInPublic</div>
      <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
        <Pill bg="rgba(0,200,255,0.12)" color="#00c8ff">Pending approval</Pill>
        <Pill bg="rgba(255,255,255,0.06)" color="rgba(255,255,255,0.6)">Instagram</Pill>
      </div>
    </MockFrame>
  )
}

function RuleMock() {
  return (
    <MockFrame accent="#a855f7">
      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Rule · create_lead</div>
      <Row label="WHEN" value="comment_text contains 'apartment'" />
      <Row label="THEN" value="create_lead(source=comment)" />
      <Row label="THEN" value="send_to_approval" />
      <div style={{ marginTop: 12, padding: 8, background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 6, fontSize: 11, color: '#a855f7', fontWeight: 700 }}>
        🛡 draftOnly = true (always)
      </div>
    </MockFrame>
  )
}

function CalendarMock() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  return (
    <MockFrame accent="#5eead4">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
        {days.map((d, i) => (
          <div key={d} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 8, minHeight: 64 }}>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 700 }}>{d}</div>
            {i % 2 === 0 && (
              <div style={{ marginTop: 6, padding: 4, background: 'rgba(94,234,212,0.18)', border: '1px solid rgba(94,234,212,0.45)', borderRadius: 4, fontSize: 9, color: '#5eead4', fontWeight: 700 }}>
                📷 IG · 2pm
              </div>
            )}
            {i === 1 && (
              <div style={{ marginTop: 4, padding: 4, background: 'rgba(0,200,255,0.16)', border: '1px solid rgba(0,200,255,0.4)', borderRadius: 4, fontSize: 9, color: '#00c8ff', fontWeight: 700 }}>
                🎵 TikTok · 6pm
              </div>
            )}
          </div>
        ))}
      </div>
    </MockFrame>
  )
}

function LeadMock() {
  const stages = ['New', 'Contacted', 'Interested', 'Follow-Up']
  const colors = ['#00c8ff', '#fbbf24', '#a855f7', '#fb923c']
  return (
    <MockFrame accent="#fbbf24">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
        {stages.map((s, i) => (
          <div key={s} style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${colors[i]}40`, borderRadius: 8, padding: 6, minHeight: 80 }}>
            <div style={{ color: colors[i], fontSize: 9, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{s}</div>
            <div style={{ marginTop: 6, background: 'rgba(0,0,0,0.25)', borderRadius: 4, padding: 4, fontSize: 9, color: 'rgba(255,255,255,0.75)' }}>
              Marcus J.
            </div>
            {i < 2 && (
              <div style={{ marginTop: 3, background: 'rgba(0,0,0,0.25)', borderRadius: 4, padding: 4, fontSize: 9, color: 'rgba(255,255,255,0.75)' }}>
                Keisha W.
              </div>
            )}
          </div>
        ))}
      </div>
    </MockFrame>
  )
}

function AnalyticsMock() {
  return (
    <MockFrame accent="#fb923c">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Bar label="Publish success" pct={92} color="#22c55e" />
        <Bar label="Approval on first try" pct={76} color="#00c8ff" />
        <Bar label="Open blockers" pct={12} color="#f87171" inverted />
        <Bar label="Avg session" pct={68} color="#a855f7" rightLabel="12.4 min" />
      </div>
    </MockFrame>
  )
}

function BrandVoiceMock() {
  return (
    <MockFrame accent="#00c8ff">
      <Row label="PERSONA" value="Friendly indie founder" />
      <Row label="TONE" value="Warm, direct, no jargon" />
      <Row label="DO USE" value="we, build, ship, real" />
      <Row label="DON'T" value="leverage, synergy, robust" />
      <div style={{ marginTop: 12, padding: 8, background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.3)', borderRadius: 6 }}>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: 700, letterSpacing: '0.06em' }}>EXAMPLE POST</div>
        <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, lineHeight: 1.5, marginTop: 4 }}>
          "Shipped the Lead Tracker today. It just works."
        </div>
      </div>
    </MockFrame>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 6 }}>
      <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', minWidth: 70 }}>{label}</span>
      <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12 }}>{value}</span>
    </div>
  )
}

function Pill({ children, bg, color }: { children: React.ReactNode; bg: string; color: string }) {
  return (
    <span style={{
      background: bg, color, borderRadius: 20, padding: '2px 8px',
      fontSize: 9, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase',
    }}>
      {children}
    </span>
  )
}

function Bar({ label, pct, color, inverted, rightLabel }: { label: string; pct: number; color: string; inverted?: boolean; rightLabel?: string }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
        <span style={{ color: 'rgba(255,255,255,0.6)' }}>{label}</span>
        <span style={{ color, fontWeight: 700 }}>{rightLabel ?? `${pct}%`}</span>
      </div>
      <div style={{ background: 'rgba(255,255,255,0.06)', height: 5, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: inverted ? '#f87171' : color }} />
      </div>
    </div>
  )
}
