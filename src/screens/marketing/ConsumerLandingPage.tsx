// ConsumerLandingPage — /consumer public landing page.
// Explains the resident recycling experience: QR bags, scan, rewards, download.

import { Link } from 'react-router-dom'

const STEPS = [
  { icon: '📦', title: 'Get a QR Bag', body: 'Request a free recycling bag with your unique QR code. It tracks every pickup.' },
  { icon: '📱', title: 'Scan & Schedule', body: 'Open the app, scan your bag, and schedule a pickup — all in under a minute.' },
  { icon: '🎁', title: 'Earn Rewards', body: 'Earn points for every bag you recycle. Redeem for discounts at local businesses.' },
  { icon: '🌍', title: 'Track Your Impact', body: 'See your CO₂ saved, materials diverted, and neighborhood ranking in real time.' },
]

export default function ConsumerLandingPage() {
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
            <span style={{ fontWeight: 800, fontSize: 15 }}>Cyan&rsquo;s Brooklynn <span style={{ color: '#00c8ff' }}>Recycling</span></span>
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
        <span style={{ fontSize: 56, display: 'block', marginBottom: 16 }}>♻️</span>
        <h1 style={{ fontSize: 'clamp(30px,5vw,52px)', fontWeight: 900, lineHeight: 1.1, marginBottom: 20 }}>
          Recycle from{' '}
          <span style={{ background: 'linear-gradient(90deg,#00c8ff,#5eead4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Your Doorstep
          </span>
        </h1>
        <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.6)', maxWidth: 520, margin: '0 auto 36px', lineHeight: 1.65 }}>
          Brooklyn residents earn real rewards for recycling. Scan, schedule, and see
          your impact — all from the Cyan&rsquo;s Brooklynn app.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link
            to="/download"
            style={{
              background: 'linear-gradient(135deg,#00c8ff,#0057e7)',
              color: '#fff',
              padding: '14px 32px',
              borderRadius: 99,
              fontWeight: 800,
              fontSize: 15,
              textDecoration: 'none',
            }}
          >
            Download the App
          </Link>
          <Link
            to="/waitlist"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: '#fff',
              padding: '14px 28px',
              borderRadius: 99,
              fontWeight: 700,
              fontSize: 15,
              textDecoration: 'none',
            }}
          >
            Join Waitlist
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section style={{ maxWidth: 900, margin: '0 auto 80px', padding: '0 24px' }}>
        <h2 style={{ textAlign: 'center', fontSize: 26, fontWeight: 800, marginBottom: 40 }}>How It Works</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 20 }}>
          {STEPS.map((s, i) => (
            <div
              key={i}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(0,200,255,0.15)',
                borderRadius: 18,
                padding: '28px 20px',
                textAlign: 'center',
              }}
            >
              <span style={{ fontSize: 38, display: 'block', marginBottom: 12 }}>{s.icon}</span>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{s.title}</h3>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, margin: 0 }}>{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* QR Bag callout */}
      <section
        style={{
          background: 'rgba(0,200,255,0.04)',
          border: '1px solid rgba(0,200,255,0.1)',
          borderRadius: 24,
          maxWidth: 700,
          margin: '0 auto 80px',
          padding: '48px 32px',
          textAlign: 'center',
        }}
      >
        <span style={{ fontSize: 48, display: 'block', marginBottom: 16 }}>🏷️</span>
        <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>Your QR Bag = Your Identity</h2>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 1.65, maxWidth: 440, margin: '0 auto 24px' }}>
          Every bag has a unique QR code tied to your account. Scan it to confirm pickup,
          earn points, and build your recycling history — no guesswork, full accountability.
        </p>
        <Link
          to="/download"
          style={{
            background: 'rgba(0,200,255,0.12)',
            border: '1px solid rgba(0,200,255,0.4)',
            color: '#00c8ff',
            padding: '12px 28px',
            borderRadius: 99,
            fontWeight: 700,
            fontSize: 14,
            textDecoration: 'none',
            display: 'inline-block',
          }}
        >
          Get the App
        </Link>
      </section>

      {/* Bottom CTA */}
      <section style={{ textAlign: 'center', padding: '0 24px 80px' }}>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 16 }}>
          Live in an apartment community?
        </p>
        <Link
          to="/join"
          style={{ color: '#00c8ff', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}
        >
          Ask your property manager to register →
        </Link>
      </section>

      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '24px', textAlign: 'center' }}>
        <Link to="/" style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', textDecoration: 'none' }}>← Back to home</Link>
      </footer>
    </div>
  )
}
