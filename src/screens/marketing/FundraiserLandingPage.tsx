// FundraiserLandingPage — /fundraiser public landing page.
// Targets schools, churches, nonprofits, sports teams.

import { Link } from 'react-router-dom'

const ORG_TYPES = [
  { icon: '🏫', label: 'Schools' },
  { icon: '⛪', label: 'Churches' },
  { icon: '💜', label: 'Nonprofits' },
  { icon: '🏟️', label: 'Sports Teams' },
  { icon: '🎭', label: 'Community Groups' },
  { icon: '🌱', label: 'Eco Organizations' },
]

const HOW_IT_WORKS = [
  { icon: '📋', step: '1', title: 'Create a Campaign', body: 'Register your organization and launch a recycling fundraiser in minutes.' },
  { icon: '📢', step: '2', title: 'Spread the Word', body: 'Share your unique campaign link. Supporters recycle — you earn for every bag.' },
  { icon: '♻️', step: '3', title: 'Community Recycles', body: 'Participants use the app to scan and schedule pickups tied to your campaign.' },
  { icon: '💰', step: '4', title: 'Earn & Track', body: 'Watch your earnings grow in real time. Receive payout when you hit your goal.' },
]

export default function FundraiserLandingPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg,#040a1a 0%,#060e24 100%)',
        color: '#fff',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Nav */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 30,
          background: 'rgba(6,14,36,0.85)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(0,190,255,0.12)',
        }}
      >
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: '#fff' }}>
            <span style={{ fontSize: 22 }}>♻️</span>
            <span style={{ fontWeight: 800, fontSize: 15 }}>Cyan&rsquo;s Brooklynn <span style={{ color: '#a855f7' }}>Recycling</span></span>
          </Link>
          <Link
            to="/real-login"
            style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}
          >
            Sign In →
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section style={{ textAlign: 'center', padding: '80px 24px 64px' }}>
        <span style={{ fontSize: 56, display: 'block', marginBottom: 16 }}>🎯</span>
        <h1 style={{ fontSize: 'clamp(30px,5vw,52px)', fontWeight: 900, lineHeight: 1.1, marginBottom: 20 }}>
          Fundraise Through{' '}
          <span style={{ background: 'linear-gradient(90deg,#a855f7,#00c8ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Recycling
          </span>
        </h1>
        <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.6)', maxWidth: 520, margin: '0 auto 36px', lineHeight: 1.65 }}>
          Turn your community&rsquo;s recycling into real dollars for your cause.
          Cyan&rsquo;s Brooklynn Recycling makes fundraising sustainable — literally.
        </p>
        <Link
          to="/signup"
          style={{
            background: 'linear-gradient(135deg,#a855f7,#0057e7)',
            color: '#fff',
            padding: '14px 36px',
            borderRadius: 99,
            fontWeight: 800,
            fontSize: 15,
            textDecoration: 'none',
            display: 'inline-block',
          }}
        >
          Start Your Fundraiser
        </Link>
      </section>

      {/* Who it's for */}
      <section style={{ maxWidth: 820, margin: '0 auto 72px', padding: '0 24px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 28, color: 'rgba(255,255,255,0.85)' }}>
          For organizations that want to do good while doing good
        </h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
          {ORG_TYPES.map(o => (
            <div
              key={o.label}
              style={{
                background: 'rgba(168,85,247,0.06)',
                border: '1px solid rgba(168,85,247,0.2)',
                borderRadius: 99,
                padding: '10px 18px',
                fontSize: 13,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span>{o.icon}</span> {o.label}
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section style={{ maxWidth: 960, margin: '0 auto 80px', padding: '0 24px' }}>
        <h2 style={{ textAlign: 'center', fontSize: 26, fontWeight: 800, marginBottom: 36 }}>How It Works</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 20 }}>
          {HOW_IT_WORKS.map(h => (
            <div
              key={h.step}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(168,85,247,0.15)',
                borderRadius: 18,
                padding: '28px 20px',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'rgba(168,85,247,0.2)',
                  border: '1px solid rgba(168,85,247,0.4)',
                  color: '#a855f7',
                  fontWeight: 800,
                  fontSize: 14,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                }}
              >
                {h.step}
              </div>
              <span style={{ fontSize: 32, display: 'block', marginBottom: 12 }}>{h.icon}</span>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>{h.title}</h3>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, margin: 0 }}>{h.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Impact stats */}
      <section
        style={{
          background: 'rgba(168,85,247,0.04)',
          border: '1px solid rgba(168,85,247,0.1)',
          borderRadius: 24,
          maxWidth: 720,
          margin: '0 auto 80px',
          padding: '48px 32px',
          textAlign: 'center',
        }}
      >
        <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 24 }}>Why Organizations Love It</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20, marginBottom: 28 }}>
          {[
            { v: '$80K+', l: 'Total Raised' },
            { v: '120+', l: 'Campaigns Run' },
            { v: '92%', l: 'Campaign Success Rate' },
          ].map(s => (
            <div key={s.l}>
              <p style={{ fontSize: 26, fontWeight: 900, color: '#a855f7', margin: 0 }}>{s.v}</p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: '4px 0 0' }}>{s.l}</p>
            </div>
          ))}
        </div>
        <Link
          to="/signup"
          style={{
            background: 'linear-gradient(135deg,#a855f7,#0057e7)',
            color: '#fff',
            padding: '13px 32px',
            borderRadius: 99,
            fontWeight: 800,
            fontSize: 14,
            textDecoration: 'none',
            display: 'inline-block',
          }}
        >
          Register Your Organization
        </Link>
      </section>

      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '24px', textAlign: 'center' }}>
        <Link to="/" style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', textDecoration: 'none' }}>← Back to home</Link>
      </footer>
    </div>
  )
}
