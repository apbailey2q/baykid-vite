import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

type DataType = { icon: string; label: string; detail: string }

const DATA_COLLECTED: DataType[] = [
  { icon: '📦', label: 'QR Scans',               detail: 'Bag ID, scan timestamp, drop-off location (when provided), and the user account associated with each scan.' },
  { icon: '💳', label: 'Wallet Activity',         detail: 'Transaction amounts, types (earning, donation, payout, bonus), timestamps, and payout method preferences.' },
  { icon: '🌱', label: 'Fundraiser Participation', detail: 'Which fundraisers you contribute to, contribution amounts, frequency, and campaign identifiers.' },
  { icon: '🔬', label: 'Inspection Data',         detail: 'AI-generated inspection results (green / yellow / red), bag condition flags, and any manual override records.' },
  { icon: '🔔', label: 'Notifications',            detail: 'Delivery status and read state of platform notifications sent to your account.' },
]

type UsageItem = { title: string; desc: string }

const DATA_USAGE: UsageItem[] = [
  { title: 'Process bag scan rewards',        desc: 'We use scan data to calculate and credit wallet earnings after successful inspections.' },
  { title: 'Support fundraiser campaigns',    desc: 'Contribution records are used to track fundraiser progress and distribute earnings accurately.' },
  { title: 'Detect fraud and duplicates',     desc: 'Scan timestamps and bag IDs are cross-referenced to prevent duplicate submissions and fraudulent activity.' },
  { title: 'Send account notifications',      desc: 'We send relevant updates about your scans, inspection results, and payout status.' },
  { title: 'Generate compliance reports',     desc: 'Aggregated, anonymized data is used to produce environmental impact and financial compliance reports.' },
]

function fade(animate: boolean, d = 0): React.CSSProperties {
  return {
    opacity:    animate ? 1 : 0,
    transform:  animate ? 'translateY(0)' : 'translateY(14px)',
    transition: `opacity 0.4s ease ${d}ms, transform 0.4s ease ${d}ms`,
  }
}

export default function PrivacyPage() {
  const [animate, setAnimate] = useState(false)

  useEffect(() => {
    const f = requestAnimationFrame(() => setAnimate(true))
    return () => cancelAnimationFrame(f)
  }, [])

  return (
    <div
      className="relative min-h-screen flex flex-col overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}
    >
      <div className="pointer-events-none absolute inset-0 grid-bg" />
      <div className="pointer-events-none absolute" style={{ top: -80, left: -60, width: 280, height: 280, background: 'rgba(94,234,212,0.08)', filter: 'blur(72px)', borderRadius: '50%' }} />
      <div className="pointer-events-none absolute" style={{ bottom: -60, right: -40, width: 220, height: 220, background: 'rgba(0,87,231,0.15)', filter: 'blur(60px)', borderRadius: '50%' }} />

      {/* Header */}
      <header
        className="relative flex items-center justify-between px-4 py-3"
        style={{ background: 'rgba(4,10,24,0.92)', borderBottom: '1px solid rgba(0,200,255,0.12)', backdropFilter: 'blur(12px)', zIndex: 2 }}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl font-extrabold" style={{ color: '#00c8ff' }}>BayKid</span>
          <span style={{ color: 'rgba(0,200,255,0.3)' }}>|</span>
          <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>Privacy Policy</span>
        </div>
        <Link to="/real-login" className="text-sm transition-opacity hover:opacity-70" style={{ color: 'rgba(255,255,255,0.4)' }}>
          ← Back
        </Link>
      </header>

      <div className="relative flex-1 overflow-y-auto pb-20" style={{ zIndex: 1 }}>
        <div className="max-w-[520px] mx-auto px-4 pt-8 pb-8">

          {/* Heading */}
          <div className="mb-6" style={fade(animate, 0)}>
            <span
              className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest mb-3 inline-block"
              style={{ background: 'rgba(94,234,212,0.1)', border: '1px solid rgba(94,234,212,0.3)', color: '#5eead4' }}
            >
              Legal
            </span>
            <h1 className="text-2xl font-extrabold mb-1.5" style={{ color: '#ffffff' }}>Privacy Policy</h1>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Last updated May 2026. We are committed to protecting your personal data.
            </p>
          </div>

          {/* ── What We Collect ─────────────────────────────────── */}
          <div
            className="rounded-2xl p-5 mb-4"
            style={{ background: 'rgba(0,87,231,0.08)', border: '1px solid rgba(0,200,255,0.15)', ...fade(animate, 60) }}
          >
            <div className="flex items-center gap-2.5 mb-4">
              <span style={{ fontSize: 18 }}>🗂️</span>
              <p style={{ fontSize: 13, fontWeight: 800, color: '#ffffff' }}>What We Collect</p>
            </div>
            <div className="flex flex-col gap-0">
              {DATA_COLLECTED.map((item, i) => (
                <div
                  key={item.label}
                  className="flex items-start gap-3"
                  style={{
                    paddingTop:    i > 0 ? 12 : 0,
                    paddingBottom: i < DATA_COLLECTED.length - 1 ? 12 : 0,
                    borderBottom:  i < DATA_COLLECTED.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.2)', fontSize: 16 }}
                  >
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#ffffff', marginBottom: 3 }}>{item.label}</p>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.48)', lineHeight: 1.6 }}>{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── How We Use It ────────────────────────────────────── */}
          <div
            className="rounded-2xl p-5 mb-4"
            style={{ background: 'rgba(0,87,231,0.08)', border: '1px solid rgba(0,200,255,0.15)', ...fade(animate, 120) }}
          >
            <div className="flex items-center gap-2.5 mb-3">
              <span style={{ fontSize: 18 }}>⚙️</span>
              <p style={{ fontSize: 13, fontWeight: 800, color: '#ffffff' }}>How We Use Your Data</p>
            </div>
            <ul className="flex flex-col gap-2">
              {DATA_USAGE.map((u, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span style={{ fontSize: 7, color: '#5eead4', marginTop: 6, flexShrink: 0 }}>●</span>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>{u.title} — </span>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>{u.desc}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* ── Data Retention ───────────────────────────────────── */}
          <div
            className="rounded-2xl p-5 mb-4"
            style={{ background: 'rgba(0,87,231,0.08)', border: '1px solid rgba(0,200,255,0.15)', ...fade(animate, 180) }}
          >
            <div className="flex items-center gap-2.5 mb-3">
              <span style={{ fontSize: 18 }}>🗄️</span>
              <p style={{ fontSize: 13, fontWeight: 800, color: '#ffffff' }}>Data Retention</p>
            </div>
            <ul className="flex flex-col gap-2">
              {[
                'Active account data is retained for the duration of your account.',
                'Accounts that are deleted are anonymized within 30 days.',
                'Transaction and payout records may be retained for up to 7 years for financial compliance.',
                'Scan and inspection logs are retained for 2 years for fraud prevention.',
              ].map((pt, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span style={{ fontSize: 7, color: '#a78bfa', marginTop: 6, flexShrink: 0 }}>●</span>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.65 }}>{pt}</p>
                </li>
              ))}
            </ul>
          </div>

          {/* ── Your Rights ──────────────────────────────────────── */}
          <div
            className="rounded-2xl p-5 mb-6"
            style={{ background: 'rgba(0,87,231,0.08)', border: '1px solid rgba(74,222,128,0.2)', ...fade(animate, 220) }}
          >
            <div className="flex items-center gap-2.5 mb-3">
              <span style={{ fontSize: 18 }}>🛡️</span>
              <p style={{ fontSize: 13, fontWeight: 800, color: '#ffffff' }}>Your Rights</p>
            </div>
            <ul className="flex flex-col gap-2">
              {[
                'Request a copy of all personal data associated with your account.',
                'Request deletion of your account and associated data at any time.',
                'Opt out of non-essential notifications in your account settings.',
                'Contact support to correct inaccurate profile information.',
              ].map((pt, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span style={{ fontSize: 7, color: '#4ade80', marginTop: 6, flexShrink: 0 }}>●</span>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.65 }}>{pt}</p>
                </li>
              ))}
            </ul>
          </div>

          {/* Nav */}
          <div className="flex flex-col gap-2" style={fade(animate, 260)}>
            <div className="flex gap-2">
              <Link
                to="/terms"
                className="flex-1 flex items-center justify-center py-3 rounded-2xl text-xs font-semibold transition-all hover:brightness-110"
                style={{ background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.25)', color: '#00c8ff', textDecoration: 'none' }}
              >
                Terms of Service →
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
