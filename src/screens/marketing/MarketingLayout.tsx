// MarketingLayout — Shared shell for public BayKid marketing pages.
//
// Provides:
//   • Top nav (logo + page links + Login / Start Free Trial CTAs)
//   • Footer (product / company / legal columns, newsletter capture)
//   • Background gradient + grid overlay matching the in-app dark theme
//   • Mobile menu (hamburger that toggles a drop-in panel under the nav)
//
// All five marketing pages render their hero/content INSIDE this layout so
// the chrome stays consistent. The pages handle their own section content
// and CTAs.

import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { submitSignup } from '../../lib/marketingSignups'

const NAV_LINKS = [
  { to: '/marketing', label: 'Home' },
  { to: '/features',  label: 'Features' },
  { to: '/pricing',   label: 'Pricing' },
  { to: '/about',     label: 'About' },
  { to: '/contact',   label: 'Contact' },
]

export function MarketingLayout({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { pathname } = useLocation()

  // Close mobile menu on route change.
  useEffect(() => { setMenuOpen(false) }, [pathname])

  // Lock body scroll while mobile menu is open.
  useEffect(() => {
    if (typeof document === 'undefined') return
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  return (
    <div
      className="relative min-h-screen flex flex-col overflow-hidden"
      style={{ background: 'linear-gradient(180deg,#040a1a 0%,#060e24 100%)', color: '#fff' }}
    >
      {/* Background grid + orbs */}
      <div className="pointer-events-none absolute inset-0" style={{
        backgroundImage:
          'linear-gradient(rgba(0,200,255,0.04) 1px, transparent 1px),' +
          'linear-gradient(90deg, rgba(0,200,255,0.04) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} />
      <div className="pointer-events-none absolute" style={{ top: -120, left: -80, width: 360, height: 360, background: 'rgba(0,87,231,0.22)', filter: 'blur(96px)', borderRadius: '50%' }} />
      <div className="pointer-events-none absolute" style={{ top: 320, right: -60, width: 320, height: 320, background: 'rgba(94,234,212,0.14)', filter: 'blur(88px)', borderRadius: '50%' }} />

      {/* Nav */}
      <header
        className="sticky top-0 z-30"
        style={{
          background: 'rgba(6,14,36,0.78)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          borderBottom: '1px solid rgba(0,190,255,0.12)',
        }}
      >
        <div className="mx-auto flex items-center justify-between px-5 py-3" style={{ maxWidth: 1240 }}>
          <Link to="/marketing" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <Logo />
            <span style={{ color: '#fff', fontWeight: 800, fontSize: 16, letterSpacing: '-0.01em' }}>
              Cyan's Brooklynn <span style={{ color: '#00c8ff' }}>AI</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center" style={{ gap: 24 }}>
            {NAV_LINKS.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                style={{
                  color: pathname === l.to ? '#00c8ff' : 'rgba(255,255,255,0.7)',
                  fontSize: 13, fontWeight: 600, textDecoration: 'none',
                  transition: 'color 0.15s',
                }}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center" style={{ gap: 10 }}>
            <Link to="/real-login" style={ghostBtn()}>Sign in</Link>
            <Link to="/signup" style={primaryBtn()}>Start Free Trial</Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Toggle navigation"
            style={{
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              color: '#fff', borderRadius: 8, width: 36, height: 36,
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}
          >
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>

        {/* Mobile panel */}
        {menuOpen && (
          <div
            className="md:hidden"
            style={{
              background: 'rgba(6,14,36,0.96)',
              borderTop: '1px solid rgba(0,190,255,0.1)',
              padding: '12px 20px 20px',
            }}
          >
            <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {NAV_LINKS.map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  style={{
                    color: pathname === l.to ? '#00c8ff' : 'rgba(255,255,255,0.8)',
                    fontSize: 15, fontWeight: 600, padding: '10px 0', textDecoration: 'none',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                  }}
                >
                  {l.label}
                </Link>
              ))}
            </nav>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
              <Link to="/real-login" style={{ ...ghostBtn(), textAlign: 'center', display: 'block' }}>Sign in</Link>
              <Link to="/signup" style={{ ...primaryBtn(), textAlign: 'center', display: 'block' }}>Start Free Trial</Link>
            </div>
          </div>
        )}
      </header>

      {/* Page content */}
      <main className="relative" style={{ zIndex: 1, flex: 1 }}>
        {children}
      </main>

      {/* Footer */}
      <Footer />
    </div>
  )
}

// ── Footer ──────────────────────────────────────────────────────────────────

function Footer() {
  const [email, setEmail]     = useState('')
  const [status, setStatus]   = useState<'idle' | 'busy' | 'ok' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubscribe(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setStatus('busy'); setErrorMsg('')
    const result = await submitSignup({ kind: 'newsletter', email })
    if (result.ok) { setStatus('ok'); setEmail('') }
    else            { setStatus('error'); setErrorMsg(result.error ?? 'Try again later') }
  }

  return (
    <footer
      style={{
        background: 'rgba(2,6,18,0.7)',
        borderTop: '1px solid rgba(0,190,255,0.12)',
        marginTop: 80, paddingTop: 48, paddingBottom: 32,
        position: 'relative', zIndex: 2,
      }}
    >
      <div className="mx-auto px-5" style={{ maxWidth: 1240 }}>
        <div className="grid md:grid-cols-4 grid-cols-2" style={{ gap: 32, marginBottom: 36 }}>
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1">
            <Link to="/marketing" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', marginBottom: 12 }}>
              <Logo />
              <span style={{ color: '#fff', fontWeight: 800, fontSize: 15 }}>
                Cyan's Brooklynn <span style={{ color: '#00c8ff' }}>AI</span>
              </span>
            </Link>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, lineHeight: 1.6 }}>
              AI-powered marketing for small teams. Write, schedule, automate, and convert — all in one workspace.
            </p>
          </div>

          <FooterCol title="Product" links={[
            { to: '/features', label: 'Features'      },
            { to: '/pricing',  label: 'Pricing'       },
            { to: '/signup',   label: 'Start free'    },
            { to: '/contact',  label: 'Book a demo'   },
          ]} />

          <FooterCol title="Company" links={[
            { to: '/about',   label: 'About'   },
            { to: '/contact', label: 'Contact' },
          ]} />

          {/* Newsletter capture */}
          <div className="col-span-2 md:col-span-1">
            <h4 style={footerColTitle()}>Stay in the loop</h4>
            <form onSubmit={handleSubscribe} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                style={{
                  flex: '1 1 160px', minWidth: 0, boxSizing: 'border-box',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8, padding: '8px 10px',
                  color: '#fff', fontSize: 13, outline: 'none',
                }}
              />
              <button
                type="submit"
                disabled={status === 'busy'}
                style={{
                  background: 'linear-gradient(135deg,#0057e7,#00c8ff)', color: '#fff',
                  border: 'none', borderRadius: 8, padding: '8px 14px',
                  fontWeight: 700, fontSize: 12, cursor: status === 'busy' ? 'wait' : 'pointer',
                  opacity: status === 'busy' ? 0.6 : 1,
                }}
              >
                {status === 'busy' ? '…' : 'Join'}
              </button>
            </form>
            {status === 'ok' && (
              <p style={{ color: '#22c55e', fontSize: 11, marginTop: 8 }}>Thanks — we'll be in touch.</p>
            )}
            {status === 'error' && (
              <p style={{ color: '#f87171', fontSize: 11, marginTop: 8 }}>{errorMsg}</p>
            )}
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 18, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>© {new Date().getFullYear()} Cyan's Brooklynn Recycling. All rights reserved.</span>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>
            <Link to="/legal/privacy" style={{ color: 'inherit', marginRight: 14 }}>Privacy</Link>
            <Link to="/legal/terms"   style={{ color: 'inherit' }}>Terms</Link>
          </span>
        </div>
      </div>
    </footer>
  )
}

function FooterCol({ title, links }: { title: string; links: { to: string; label: string }[] }) {
  return (
    <div>
      <h4 style={footerColTitle()}>{title}</h4>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {links.map((l) => (
          <li key={l.to}>
            <Link to={l.to} style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, textDecoration: 'none' }}>
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

function footerColTitle(): React.CSSProperties {
  return { color: '#fff', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }
}

// ── Branding bits ───────────────────────────────────────────────────────────

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <div
      style={{
        width: size, height: size, borderRadius: '50%',
        background: 'linear-gradient(135deg,#0057e7,#00c8ff)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 0 18px rgba(0,190,255,0.45)',
        flexShrink: 0,
      }}
    >
      <span style={{ color: '#fff', fontSize: size * 0.5, fontWeight: 900, letterSpacing: '-0.04em' }}>B</span>
    </div>
  )
}

// ── Shared button styles (also re-exported for the pages) ──────────────────

export function primaryBtn(): React.CSSProperties {
  return {
    background: 'linear-gradient(135deg,#0057e7,#00c8ff)', color: '#fff',
    border: 'none', borderRadius: 10, padding: '8px 16px',
    fontWeight: 700, fontSize: 13, cursor: 'pointer', textDecoration: 'none',
    boxShadow: '0 2px 14px rgba(0,190,255,0.4)',
    display: 'inline-block',
  }
}

export function ghostBtn(): React.CSSProperties {
  return {
    background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.85)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 10, padding: '8px 14px',
    fontWeight: 600, fontSize: 13, cursor: 'pointer', textDecoration: 'none',
    display: 'inline-block',
  }
}

export function tealBtn(): React.CSSProperties {
  return {
    background: 'rgba(94,234,212,0.10)', color: '#5eead4',
    border: '1px solid rgba(94,234,212,0.4)',
    borderRadius: 10, padding: '8px 16px',
    fontWeight: 700, fontSize: 13, cursor: 'pointer', textDecoration: 'none',
    display: 'inline-block',
  }
}

// ── Shared section wrappers (used by all 5 pages) ──────────────────────────

export function Container({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`mx-auto px-5 ${className}`} style={{ maxWidth: 1180 }}>{children}</div>
}

export function SectionHeading({
  eyebrow, title, kicker,
}: {
  eyebrow?: string
  title: string
  kicker?: string
}) {
  return (
    <div style={{ textAlign: 'center', marginBottom: 36 }}>
      {eyebrow && (
        <span style={{
          color: '#00c8ff', fontSize: 11, fontWeight: 800,
          letterSpacing: '0.16em', textTransform: 'uppercase',
        }}>
          {eyebrow}
        </span>
      )}
      <h2 style={{
        color: '#fff', fontSize: 30, fontWeight: 800, lineHeight: 1.15,
        marginTop: eyebrow ? 10 : 0, marginBottom: kicker ? 12 : 0,
        letterSpacing: '-0.01em',
      }}>
        {title}
      </h2>
      {kicker && (
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, lineHeight: 1.55, maxWidth: 680, margin: '0 auto' }}>
          {kicker}
        </p>
      )}
    </div>
  )
}
