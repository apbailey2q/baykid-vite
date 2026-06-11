// CommercialLandingPage — /commercial public landing page.
// Targets businesses: restaurants, bars, hotels, offices, apartments, etc.

import { Link } from 'react-router-dom'

const BUSINESS_TYPES = [
  { icon: '🍽️', label: 'Restaurants' },
  { icon: '🍻', label: 'Bars & Lounges' },
  { icon: '🏨', label: 'Hotels' },
  { icon: '🏢', label: 'Offices' },
  { icon: '🏥', label: 'Healthcare' },
  { icon: '🏠', label: 'Apartment Communities' },
  { icon: '🏫', label: 'Schools' },
  { icon: '🏭', label: 'Manufacturing' },
]

const BENEFITS = [
  { icon: '📅', title: 'Scheduled Pickups', body: 'Set recurring pickup windows that match your waste output — daily, weekly, or on-demand.' },
  { icon: '📊', title: 'Waste Analytics', body: 'Track your recycling volume, contamination rate, and diversion metrics on a live dashboard.' },
  { icon: '📋', title: 'Compliance Reports', body: 'Export reports for city compliance, ESG documentation, or your own sustainability goals.' },
  { icon: '🤝', title: 'Dedicated Support', body: 'A commercial account manager handles setup, billing, and service adjustments.' },
]

export default function CommercialLandingPage() {
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
            <span style={{ fontWeight: 800, fontSize: 15 }}>Cyan&rsquo;s Brooklynn <span style={{ color: '#5eead4' }}>Recycling</span></span>
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
        <span style={{ fontSize: 56, display: 'block', marginBottom: 16 }}>🏢</span>
        <h1 style={{ fontSize: 'clamp(30px,5vw,52px)', fontWeight: 900, lineHeight: 1.1, marginBottom: 20 }}>
          Commercial Recycling{' '}
          <span style={{ background: 'linear-gradient(90deg,#5eead4,#00c8ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            That Actually Works
          </span>
        </h1>
        <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.6)', maxWidth: 540, margin: '0 auto 36px', lineHeight: 1.65 }}>
          Managed recycling pickup for Brooklyn businesses of all sizes. Reduce
          contamination, track your diversion rate, and stay compliant — effortlessly.
        </p>
        <Link
          to="/signup"
          style={{
            background: 'linear-gradient(135deg,#5eead4,#0057e7)',
            color: '#fff',
            padding: '14px 36px',
            borderRadius: 99,
            fontWeight: 800,
            fontSize: 15,
            textDecoration: 'none',
            display: 'inline-block',
          }}
        >
          Get a Quote
        </Link>
      </section>

      {/* Business types */}
      <section style={{ maxWidth: 860, margin: '0 auto 80px', padding: '0 24px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 28, color: 'rgba(255,255,255,0.85)' }}>
          We serve all types of businesses
        </h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
          {BUSINESS_TYPES.map(bt => (
            <div
              key={bt.label}
              style={{
                background: 'rgba(94,234,212,0.06)',
                border: '1px solid rgba(94,234,212,0.2)',
                borderRadius: 99,
                padding: '10px 18px',
                fontSize: 13,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span>{bt.icon}</span> {bt.label}
            </div>
          ))}
        </div>
      </section>

      {/* Benefits grid */}
      <section style={{ maxWidth: 960, margin: '0 auto 80px', padding: '0 24px' }}>
        <h2 style={{ textAlign: 'center', fontSize: 26, fontWeight: 800, marginBottom: 36 }}>What You Get</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 20 }}>
          {BENEFITS.map(b => (
            <div
              key={b.title}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(94,234,212,0.15)',
                borderRadius: 18,
                padding: '28px 20px',
              }}
            >
              <span style={{ fontSize: 32, display: 'block', marginBottom: 12 }}>{b.icon}</span>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{b.title}</h3>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, margin: 0 }}>{b.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section
        style={{
          background: 'rgba(94,234,212,0.04)',
          border: '1px solid rgba(94,234,212,0.1)',
          borderRadius: 24,
          maxWidth: 640,
          margin: '0 auto 80px',
          padding: '48px 32px',
          textAlign: 'center',
        }}
      >
        <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>Ready to get started?</h2>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 1.65, marginBottom: 28 }}>
          Create a commercial account and our team will contact you to set up service.
        </p>
        <Link
          to="/signup"
          style={{
            background: 'linear-gradient(135deg,#5eead4,#0057e7)',
            color: '#fff',
            padding: '14px 36px',
            borderRadius: 99,
            fontWeight: 800,
            fontSize: 15,
            textDecoration: 'none',
            display: 'inline-block',
          }}
        >
          Create Commercial Account
        </Link>
      </section>

      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '24px', textAlign: 'center' }}>
        <Link to="/" style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', textDecoration: 'none' }}>← Back to home</Link>
      </footer>
    </div>
  )
}
