import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

type Section = { icon: string; title: string; points: string[] }

const SECTIONS: Section[] = [
  {
    icon:   '📱',
    title:  'App Use Rules',
    points: [
      'The BayKid platform is for legal residential and commercial recycling only.',
      'You must be 13 years or older to create an account.',
      'Account sharing is not permitted — each account represents one individual.',
      'Commercial waste disposal requires a separate partner agreement.',
      'You are responsible for all activity that occurs under your account.',
    ],
  },
  {
    icon:   '📦',
    title:  'QR Bag Scanning Rules',
    points: [
      'Each QR bag code may only be scanned once per bag lifecycle.',
      'Bags must contain recyclable materials only and be properly sealed before scanning.',
      'Scanning must occur at an authorized drop-off location or via a scheduled pickup.',
      'Bags submitted with non-recyclable, hazardous, or contaminated materials may be rejected.',
      'Re-submission of a rejected bag requires admin approval and a rescan.',
    ],
  },
  {
    icon:   '✅',
    title:  'Rewards & Verification',
    points: [
      'Bag value credits are applied only after a successful AI inspection review.',
      'Rewards shown on screen are estimates and are not guaranteed until marked "Approved."',
      'Points and wallet credits are non-transferable between accounts.',
      'BayKid reserves the right to adjust reward amounts based on material quality.',
      'Bonus credits for fundraiser contributions are subject to campaign rules.',
    ],
  },
  {
    icon:   '🚫',
    title:  'Fraud & Duplicate Scans',
    points: [
      'Scanning the same QR code more than once is automatically detected and blocked.',
      'Submitting bags that do not belong to you is strictly prohibited.',
      'Suspected fraudulent activity results in immediate account review and potential suspension.',
      'Fraudulent accounts may forfeit all accumulated wallet balances and points.',
      'BayKid cooperates with law enforcement in cases of suspected fraud.',
    ],
  },
  {
    icon:   '💳',
    title:  'Payouts & Approval',
    points: [
      'Payout requests require a minimum wallet balance of $25.00.',
      'All payout requests are reviewed by a BayKid administrator before processing.',
      'Approved payouts are processed within 5–10 business days.',
      'Payout method availability (bank transfer, Cash App, PayPal, gift card) may vary by region.',
      'BayKid reserves the right to delay or deny payouts pending identity or fraud verification.',
    ],
  },
]

function LegalSection({ icon, title, points, delay, fade }: Section & { delay: number; fade: (d: number) => React.CSSProperties }) {
  return (
    <div
      className="rounded-2xl p-5 mb-4"
      style={{ background: 'rgba(0,87,231,0.08)', border: '1px solid rgba(0,200,255,0.15)', ...fade(delay) }}
    >
      <div className="flex items-center gap-2.5 mb-3">
        <span style={{ fontSize: 18 }}>{icon}</span>
        <p style={{ fontSize: 13, fontWeight: 800, color: '#ffffff' }}>{title}</p>
      </div>
      <ul className="flex flex-col gap-2">
        {points.map((pt, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <span style={{ fontSize: 7, color: '#00c8ff', marginTop: 6, flexShrink: 0 }}>●</span>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.65 }}>{pt}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function TermsPage() {
  const [animate, setAnimate] = useState(false)

  useEffect(() => {
    const f = requestAnimationFrame(() => setAnimate(true))
    return () => cancelAnimationFrame(f)
  }, [])

  const fade = (d = 0): React.CSSProperties => ({
    opacity:    animate ? 1 : 0,
    transform:  animate ? 'translateY(0)' : 'translateY(14px)',
    transition: `opacity 0.4s ease ${d}ms, transform 0.4s ease ${d}ms`,
  })

  return (
    <div
      className="relative min-h-screen flex flex-col overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}
    >
      <div className="pointer-events-none absolute inset-0 grid-bg" />
      <div className="pointer-events-none absolute" style={{ top: -80, left: -60, width: 280, height: 280, background: 'rgba(0,87,231,0.2)', filter: 'blur(72px)', borderRadius: '50%' }} />
      <div className="pointer-events-none absolute" style={{ bottom: -60, right: -40, width: 220, height: 220, background: 'rgba(0,200,255,0.06)', filter: 'blur(60px)', borderRadius: '50%' }} />

      {/* Header */}
      <header
        className="relative flex items-center justify-between px-4 py-3"
        style={{ background: 'rgba(4,10,24,0.92)', borderBottom: '1px solid rgba(0,200,255,0.12)', backdropFilter: 'blur(12px)', zIndex: 2 }}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl font-extrabold" style={{ color: '#00c8ff' }}>BayKid</span>
          <span style={{ color: 'rgba(0,200,255,0.3)' }}>|</span>
          <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>Terms of Service</span>
        </div>
        <Link to="/real-login" className="text-sm transition-opacity hover:opacity-70" style={{ color: 'rgba(255,255,255,0.4)' }}>
          ← Back
        </Link>
      </header>

      <div className="relative flex-1 overflow-y-auto pb-20" style={{ zIndex: 1 }}>
        <div className="max-w-[520px] mx-auto px-4 pt-8 pb-8">

          {/* Heading */}
          <div className="mb-6" style={fade(0)}>
            <span
              className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest mb-3 inline-block"
              style={{ background: 'rgba(0,200,255,0.1)', border: '1px solid rgba(0,200,255,0.3)', color: '#00c8ff' }}
            >
              Legal
            </span>
            <h1 className="text-2xl font-extrabold mb-1.5" style={{ color: '#ffffff' }}>Terms of Service</h1>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Last updated May 2026. By using BayKid you agree to these terms.
            </p>
          </div>

          {/* Sections */}
          {SECTIONS.map((s, i) => (
            <LegalSection key={s.title} {...s} delay={60 + i * 40} fade={fade} />
          ))}

          {/* Footer */}
          <div className="rounded-2xl p-4 mb-6 flex items-start gap-3" style={{ background: 'rgba(0,200,255,0.05)', border: '1px solid rgba(0,200,255,0.15)', ...fade(280) }}>
            <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>ℹ️</span>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.65 }}>
              These terms may be updated periodically. Continued use of the platform after changes constitutes acceptance of the revised terms.
            </p>
          </div>

          {/* Nav */}
          <div className="flex flex-col gap-2" style={fade(300)}>
            <div className="flex gap-2">
              <Link
                to="/privacy"
                className="flex-1 flex items-center justify-center py-3 rounded-2xl text-xs font-semibold transition-all hover:brightness-110"
                style={{ background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.25)', color: '#00c8ff', textDecoration: 'none' }}
              >
                Privacy Policy →
              </Link>
              <Link
                to="/consent"
                className="flex-1 flex items-center justify-center py-3 rounded-2xl text-xs font-semibold transition-all hover:brightness-110"
                style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.25)', color: '#4ade80', textDecoration: 'none' }}
              >
                User Consent →
              </Link>
            </div>
            <Link
              to="/real-login"
              className="w-full flex items-center justify-center py-3 rounded-2xl text-sm font-medium transition-all hover:brightness-110"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}
            >
              ← Back to Login
            </Link>
          </div>

        </div>
      </div>
    </div>
  )
}
