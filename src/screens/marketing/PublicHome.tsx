// PublicHome — Main landing page at / for unauthenticated visitors.
// Shows the three service verticals: Consumer, Commercial, Fundraiser.
// Uses the same dark-teal aesthetic as MarketingLayout.

import { Link } from 'react-router-dom'

const CARD_STYLE: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(0,200,255,0.18)',
  borderRadius: 20,
  padding: '36px 28px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
  gap: 16,
  textDecoration: 'none',
  transition: 'border-color 0.2s, transform 0.2s',
}

const VERTICALS = [
  {
    icon: '♻️',
    title: 'Residents',
    body: 'Scan QR bags, schedule pickups, earn rewards, and track your environmental impact from your phone.',
    cta: 'Get Started',
    to: '/consumer',
    accent: '#00c8ff',
  },
  {
    icon: '🏢',
    title: 'Businesses',
    body: 'Managed recycling for restaurants, bars, hotels, offices, and apartment communities.',
    cta: 'Learn More',
    to: '/commercial',
    accent: '#5eead4',
  },
  {
    icon: '🎯',
    title: 'Organizations',
    body: 'Run recycling fundraisers for your school, church, sports team, or nonprofit.',
    cta: 'Start a Campaign',
    to: '/fundraiser',
    accent: '#a855f7',
  },
]

const STATS = [
  { value: '50K+', label: 'Bags Recycled' },
  { value: '200+', label: 'Partner Businesses' },
  { value: '12',   label: 'Neighborhoods Served' },
  { value: '$80K', label: 'Raised by Fundraisers' },
]

export default function PublicHome() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg,#040a1a 0%,#060e24 100%)',
        color: '#fff',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        overflowX: 'hidden',
      }}
    >
      {/* Grid overlay */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,200,255,0.03) 1px,transparent 1px),' +
            'linear-gradient(90deg,rgba(0,200,255,0.03) 1px,transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

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
        <div
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            padding: '12px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>♻️</span>
            <span style={{ fontWeight: 800, fontSize: 15 }}>
              Cyan&rsquo;s Brooklynn <span style={{ color: '#00c8ff' }}>Recycling</span>
            </span>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Link
              to="/real-login"
              style={{
                color: 'rgba(255,255,255,0.7)',
                textDecoration: 'none',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              Sign In
            </Link>
            <Link
              to="/consumer"
              style={{
                background: 'rgba(0,200,255,0.12)',
                border: '1px solid rgba(0,200,255,0.4)',
                color: '#00c8ff',
                padding: '8px 18px',
                borderRadius: 99,
                fontSize: 13,
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section style={{ textAlign: 'center', padding: '96px 24px 80px' }}>
        <p
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.14em',
            color: '#00c8ff',
            textTransform: 'uppercase',
            marginBottom: 16,
          }}
        >
          Brooklyn's Recycling Platform
        </p>
        <h1
          style={{
            fontSize: 'clamp(36px, 6vw, 60px)',
            fontWeight: 900,
            lineHeight: 1.1,
            marginBottom: 24,
          }}
        >
          Recycle Smarter.{' '}
          <span
            style={{
              background: 'linear-gradient(90deg,#00c8ff,#5eead4)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Earn More.
          </span>
        </h1>
        <p
          style={{
            fontSize: 18,
            color: 'rgba(255,255,255,0.6)',
            maxWidth: 560,
            margin: '0 auto 40px',
            lineHeight: 1.65,
          }}
        >
          Cyan&rsquo;s Brooklynn Recycling connects residents, businesses, and organizations
          with smarter, rewarding recycling.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link
            to="/consumer"
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
            I&rsquo;m a Resident
          </Link>
          <Link
            to="/commercial"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: '#fff',
              padding: '14px 32px',
              borderRadius: 99,
              fontWeight: 700,
              fontSize: 15,
              textDecoration: 'none',
            }}
          >
            I&rsquo;m a Business
          </Link>
        </div>
      </section>

      {/* Customer Demo */}
      <section
        style={{
          maxWidth: 760,
          margin: '0 auto 80px',
          padding: '40px 32px',
          background: 'rgba(0,200,255,0.04)',
          border: '1px solid rgba(0,200,255,0.18)',
          borderRadius: 24,
          textAlign: 'center',
        }}
      >
        <p
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.14em',
            color: '#5eead4',
            textTransform: 'uppercase',
            marginBottom: 12,
          }}
        >
          Customer Demo
        </p>
        <h2
          style={{
            fontSize: 'clamp(22px, 3.5vw, 30px)',
            fontWeight: 800,
            lineHeight: 1.2,
            marginBottom: 16,
          }}
        >
          See How Cyan&rsquo;s Brooklynn Recycling Works
        </h2>
        <p
          style={{
            fontSize: 15,
            color: 'rgba(255,255,255,0.65)',
            lineHeight: 1.65,
            maxWidth: 560,
            margin: '0 auto 28px',
          }}
        >
          Watch how customers sign up, prepare their recycling bag, scan the QR code,
          request pickup, and track their bag from pickup through warehouse arrival.
        </p>
        <a
          href="https://app.heygen.com/videos/cyan-s-brooklynn-recycling-customer-app-demo-0e7e450245bf483c9eed95fe679579e3"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-block',
            background: 'linear-gradient(135deg,#00c8ff,#0057e7)',
            color: '#fff',
            padding: '14px 32px',
            borderRadius: 99,
            fontWeight: 800,
            fontSize: 15,
            textDecoration: 'none',
          }}
        >
          ▶ Watch Customer Demo
        </a>
      </section>

      {/* Stats strip */}
      <div
        style={{
          maxWidth: 900,
          margin: '0 auto 80px',
          padding: '0 24px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))',
          gap: 16,
        }}
      >
        {STATS.map(s => (
          <div
            key={s.label}
            style={{
              background: 'rgba(0,200,255,0.05)',
              border: '1px solid rgba(0,200,255,0.15)',
              borderRadius: 16,
              padding: '20px 16px',
              textAlign: 'center',
            }}
          >
            <p style={{ fontSize: 28, fontWeight: 900, color: '#00c8ff', margin: 0 }}>{s.value}</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: '4px 0 0' }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Three verticals */}
      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto 100px',
          padding: '0 24px',
        }}
      >
        <h2
          style={{
            textAlign: 'center',
            fontSize: 28,
            fontWeight: 800,
            marginBottom: 40,
          }}
        >
          Who is it for?
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))',
            gap: 24,
          }}
        >
          {VERTICALS.map(v => (
            <Link
              key={v.to}
              to={v.to}
              style={{ ...CARD_STYLE }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement
                el.style.borderColor = v.accent
                el.style.transform = 'translateY(-4px)'
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement
                el.style.borderColor = 'rgba(0,200,255,0.18)'
                el.style.transform = 'translateY(0)'
              }}
            >
              <span style={{ fontSize: 44 }}>{v.icon}</span>
              <h3 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: v.accent }}>{v.title}</h3>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 1.65, margin: 0 }}>
                {v.body}
              </p>
              <span
                style={{
                  marginTop: 8,
                  padding: '10px 24px',
                  borderRadius: 99,
                  border: `1px solid ${v.accent}`,
                  color: v.accent,
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                {v.cta} →
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* Property Managers CTA */}
      <section
        style={{
          background: 'rgba(0,200,255,0.04)',
          borderTop: '1px solid rgba(0,200,255,0.1)',
          borderBottom: '1px solid rgba(0,200,255,0.1)',
          padding: '64px 24px',
          textAlign: 'center',
          marginBottom: 80,
        }}
      >
        <span style={{ fontSize: 40, display: 'block', marginBottom: 16 }}>🏠</span>
        <h2 style={{ fontSize: 26, fontWeight: 800, marginBottom: 12 }}>
          Are you a Property Manager?
        </h2>
        <p
          style={{
            fontSize: 15,
            color: 'rgba(255,255,255,0.6)',
            maxWidth: 500,
            margin: '0 auto 28px',
            lineHeight: 1.65,
          }}
        >
          Partner with us to bring recycling to your apartment community. Register your
          property and give residents a seamless enrollment experience.
        </p>
        <Link
          to="/join"
          style={{
            background: 'linear-gradient(135deg,#00c8ff,#0057e7)',
            color: '#fff',
            padding: '14px 36px',
            borderRadius: 99,
            fontWeight: 800,
            fontSize: 15,
            textDecoration: 'none',
            display: 'inline-block',
          }}
        >
          Register Your Property
        </Link>
      </section>

      {/* Footer */}
      <footer
        style={{
          borderTop: '1px solid rgba(255,255,255,0.07)',
          padding: '32px 24px',
          textAlign: 'center',
        }}
      >
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', margin: 0 }}>
          &copy; {new Date().getFullYear()} Cyan&rsquo;s Brooklynn Recycling Enterprise LLC &mdash;{' '}
          <Link to="/legal/privacy-policy" style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>Privacy</Link>
          {' · '}
          <Link to="/legal/terms-of-service" style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>Terms</Link>
        </p>
      </footer>
    </div>
  )
}
