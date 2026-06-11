// DownloadPage — /download public page.
// Shows App Store / Play Store links (or "Coming Soon" when not yet published).

import { Link } from 'react-router-dom'

export default function DownloadPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg,#040a1a 0%,#060e24 100%)',
        color: '#fff',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        display: 'flex',
        flexDirection: 'column',
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

      {/* Main content */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '80px 24px',
        }}
      >
        <span style={{ fontSize: 72, display: 'block', marginBottom: 24 }}>📱</span>
        <h1 style={{ fontSize: 'clamp(28px,5vw,48px)', fontWeight: 900, marginBottom: 16 }}>
          Get the App
        </h1>
        <p
          style={{
            fontSize: 16,
            color: 'rgba(255,255,255,0.6)',
            maxWidth: 440,
            margin: '0 auto 40px',
            lineHeight: 1.65,
          }}
        >
          The Cyan&rsquo;s Brooklynn Recycling app is coming soon to iOS and Android.
          Join the waitlist to be the first to know when it&rsquo;s available.
        </p>

        {/* Coming Soon badges */}
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 40 }}>
          <div
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 14,
              padding: '14px 24px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              opacity: 0.7,
            }}
          >
            <span style={{ fontSize: 28 }}>🍎</span>
            <div style={{ textAlign: 'left' }}>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Coming Soon</p>
              <p style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>App Store</p>
            </div>
          </div>
          <div
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 14,
              padding: '14px 24px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              opacity: 0.7,
            }}
          >
            <span style={{ fontSize: 28 }}>🤖</span>
            <div style={{ textAlign: 'left' }}>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Coming Soon</p>
              <p style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Google Play</p>
            </div>
          </div>
        </div>

        {/* Waitlist CTA */}
        <div
          style={{
            background: 'rgba(0,200,255,0.06)',
            border: '1px solid rgba(0,200,255,0.2)',
            borderRadius: 20,
            padding: '32px 28px',
            maxWidth: 420,
            width: '100%',
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Get notified at launch</h2>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 20, lineHeight: 1.5 }}>
            Be first in line when the app goes live.
          </p>
          <Link
            to="/waitlist"
            style={{
              display: 'block',
              background: 'linear-gradient(135deg,#00c8ff,#0057e7)',
              color: '#fff',
              padding: '13px 28px',
              borderRadius: 99,
              fontWeight: 800,
              fontSize: 14,
              textDecoration: 'none',
            }}
          >
            Join the Waitlist
          </Link>
        </div>
      </main>

      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '24px', textAlign: 'center' }}>
        <Link to="/" style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', textDecoration: 'none' }}>← Back to home</Link>
      </footer>
    </div>
  )
}
