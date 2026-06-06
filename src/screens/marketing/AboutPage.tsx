// AboutPage — Mission, principles, team placeholders.
//
// Pure marketing content — no DB calls. Replace the team placeholder names
// with real photos + bios before launch.

import { Link } from 'react-router-dom'
import { MarketingLayout, Container, SectionHeading, primaryBtn, ghostBtn } from './MarketingLayout'

const PRINCIPLES = [
  {
    icon: '🤝',
    title: 'Human in the loop, always.',
    body: 'Automation drafts; humans ship. Every rule is draft-only by design. Nothing public, ever, without a reviewer click.',
  },
  {
    icon: '🔬',
    title: 'Brand voice is sacred.',
    body: 'AI that sounds like everyone else is worse than no AI. We train on your voice and stay there.',
  },
  {
    icon: '🪶',
    title: 'Small + fast wins.',
    body: 'We optimize for indie teams of 1–10. If a feature only matters at 100+ seats, it can wait.',
  },
  {
    icon: '🔐',
    title: 'Your data is yours.',
    body: 'Per-org RLS, no cross-tenant training, exportable anytime. We sell software, not your content.',
  },
]

const TEAM = [
  { name: 'Founder Placeholder',  role: 'Co-founder · Product',    accent: '#00c8ff' },
  { name: 'Founder Placeholder',  role: 'Co-founder · Engineering', accent: '#a855f7' },
  { name: 'Designer Placeholder', role: 'Design Lead',              accent: '#5eead4' },
  { name: 'CSM Placeholder',      role: 'Customer Success',         accent: '#fbbf24' },
]

export default function AboutPage() {
  return (
    <MarketingLayout>
      {/* Hero */}
      <section style={{ paddingTop: 64, paddingBottom: 40 }}>
        <Container>
          <div style={{ textAlign: 'center', maxWidth: 760, margin: '0 auto' }}>
            <span style={{ color: '#00c8ff', fontSize: 11, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
              About Cyan's Brooklynn
            </span>
            <h1 style={{ color: '#fff', fontSize: 40, fontWeight: 900, lineHeight: 1.1, marginTop: 10, marginBottom: 16, letterSpacing: '-0.02em' }}>
              We're building the marketing tool we wished we had.
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 16, lineHeight: 1.6 }}>
              Cyan's Brooklynn is for small teams that need to ship content fast — without losing brand voice, control, or quality.
              We use Claude under the hood, but we built every workflow around the marketer, not the model.
            </p>
          </div>
        </Container>
      </section>

      {/* Principles */}
      <section style={{ paddingTop: 32, paddingBottom: 60 }}>
        <Container>
          <SectionHeading eyebrow="What we believe" title="Four principles that shape every decision" />
          <div className="grid md:grid-cols-2 grid-cols-1" style={{ gap: 16 }}>
            {PRINCIPLES.map((p) => (
              <div key={p.title} style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 16, padding: 22,
              }}>
                <div style={{ fontSize: 30, marginBottom: 10 }}>{p.icon}</div>
                <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{p.title}</h3>
                <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, lineHeight: 1.6 }}>{p.body}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* Story */}
      <section style={{ paddingTop: 40, paddingBottom: 60 }}>
        <Container>
          <div style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(0,200,255,0.18)',
            borderRadius: 20, padding: 30,
            maxWidth: 820, margin: '0 auto',
          }}>
            <span style={{ color: '#00c8ff', fontSize: 11, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
              Our story
            </span>
            <h3 style={{ color: '#fff', fontSize: 22, fontWeight: 800, marginTop: 8, marginBottom: 14, lineHeight: 1.25 }}>
              Built by founders who got tired of stitching together 7 SaaS tools.
            </h3>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, lineHeight: 1.7, marginBottom: 12 }}>
              We ran marketing at two startups before Cyan's Brooklynn. Both times we duct-taped together a CMS,
              a scheduler, a lead form, a CRM, an analytics tool, an approval workflow, and an AI writer.
              Every tool was great in isolation. None of them talked to each other.
            </p>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, lineHeight: 1.7 }}>
              Cyan's Brooklynn is the workspace we wanted: one place to write, schedule, automate, approve, and learn —
              all wired into the same brand voice and the same lead pipeline. Built on Claude, designed for
              the team that wishes they were a team of 10.
            </p>
          </div>
        </Container>
      </section>

      {/* Team */}
      <section style={{ paddingTop: 32, paddingBottom: 60 }}>
        <Container>
          <SectionHeading eyebrow="Team" title="The humans behind Cyan's Brooklynn" kicker="Placeholder bios — swap with real ones before public launch." />
          <div className="grid md:grid-cols-4 sm:grid-cols-2 grid-cols-1" style={{ gap: 16 }}>
            {TEAM.map((m, i) => (
              <div key={i} style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 14, padding: 18, textAlign: 'center',
              }}>
                <div style={{
                  width: 60, height: 60, borderRadius: '50%',
                  background: `linear-gradient(135deg, ${m.accent}, rgba(255,255,255,0.18))`,
                  margin: '0 auto 12px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 22, fontWeight: 800,
                }}>
                  {m.name[0]}
                </div>
                <div style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{m.name}</div>
                <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 4 }}>{m.role}</div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* CTA */}
      <section style={{ paddingTop: 24, paddingBottom: 60 }}>
        <Container>
          <div style={{
            background: 'linear-gradient(135deg, rgba(0,87,231,0.16) 0%, rgba(94,234,212,0.10) 100%)',
            border: '1px solid rgba(0,200,255,0.32)',
            borderRadius: 22, padding: 36, textAlign: 'center',
          }}>
            <h3 style={{ color: '#fff', fontSize: 24, fontWeight: 800, marginBottom: 14 }}>
              Want to chat?
            </h3>
            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14, marginBottom: 20 }}>
              We answer every email. Tell us what you're working on.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/contact" style={{ ...primaryBtn(), padding: '12px 22px', fontSize: 14 }}>Get in touch</Link>
              <Link to="/signup" style={{ ...ghostBtn(), padding: '12px 22px', fontSize: 14 }}>Or just try it</Link>
            </div>
          </div>
        </Container>
      </section>
    </MarketingLayout>
  )
}
