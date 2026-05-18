import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

function fade(a: boolean, d = 0): React.CSSProperties {
  return {
    opacity:    a ? 1 : 0,
    transform:  a ? 'translateY(0)' : 'translateY(14px)',
    transition: `opacity 0.4s ease ${d}ms, transform 0.4s ease ${d}ms`,
  }
}

const TOPICS = [
  { icon: '🔐', label: 'Account & Login',          email: 'support@cbrecycling.org',    subject: 'Account / Login Issue' },
  { icon: '📦', label: 'Bag Scans & Earnings',     email: 'support@cbrecycling.org',    subject: 'Bag Scan / Earnings Question' },
  { icon: '🚛', label: 'Commercial Routes',        email: 'dispatch@cbrecycling.org',   subject: 'Commercial Route Support' },
  { icon: '🏢', label: 'Commercial Account',       email: 'commercial@cbrecycling.org', subject: 'Commercial Account Question' },
  { icon: '🔍', label: 'Inspection Review',        email: 'safety@cbrecycling.org',     subject: 'Inspection Review Question' },
  { icon: '💳', label: 'Payments & Payouts',       email: 'billing@cbrecycling.org',    subject: 'Payment / Payout Question' },
  { icon: '🛡️', label: 'Safety Concern',           email: 'safety@cbrecycling.org',     subject: 'Safety Concern — BayKid' },
  { icon: '🗑️', label: 'Data Deletion Request',   email: 'support@cbrecycling.org',    subject: 'Account Deletion Request' },
  { icon: '🐛', label: 'Bug Report',               email: 'support@cbrecycling.org',    subject: 'Bug Report — BayKid App' },
]

export default function ContactSupportPage() {
  const navigate  = useNavigate()
  const [a, setA] = useState(false)
  useEffect(() => { const id = requestAnimationFrame(() => setA(true)); return () => cancelAnimationFrame(id) }, [])

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden" style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}>
      <div className="pointer-events-none absolute inset-0 grid-bg" />
      <div className="pointer-events-none absolute" style={{ top: -80, left: -60, width: 280, height: 280, background: 'rgba(94,234,212,0.08)', filter: 'blur(72px)', borderRadius: '50%' }} />

      <header className="relative flex items-center justify-between px-4 py-3" style={{ background: 'rgba(4,10,24,0.92)', borderBottom: '1px solid rgba(0,200,255,0.12)', backdropFilter: 'blur(12px)', zIndex: 2 }}>
        <div className="flex items-center gap-3">
          <span className="text-xl font-extrabold" style={{ color: '#00c8ff' }}>BayKid</span>
          <span style={{ color: 'rgba(0,200,255,0.3)' }}>|</span>
          <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>Contact Support</span>
        </div>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
          ← Back
        </button>
      </header>

      <div className="relative flex-1 overflow-y-auto pb-20" style={{ zIndex: 1 }}>
        <div className="max-w-[520px] mx-auto px-4 pt-8 pb-8">

          <div className="mb-6" style={fade(a, 0)}>
            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest mb-3 inline-block" style={{ background: 'rgba(94,234,212,0.1)', border: '1px solid rgba(94,234,212,0.3)', color: '#5eead4' }}>
              Support
            </span>
            <h1 className="text-2xl font-extrabold mb-1.5" style={{ color: '#ffffff' }}>Contact Support</h1>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Choose a topic below to reach the right team. We typically respond within 1 business day.
            </p>
          </div>

          {/* ── Contact topics ── */}
          <div className="rounded-2xl overflow-hidden mb-5" style={{ background: 'rgba(0,87,231,0.08)', border: '1px solid rgba(0,200,255,0.15)', ...fade(a, 60) }}>
            <div className="px-5 pt-4 pb-2 flex items-center gap-2">
              <span style={{ fontSize: 16 }}>💬</span>
              <p style={{ fontSize: 13, fontWeight: 800, color: '#ffffff' }}>Contact by Topic</p>
            </div>
            {TOPICS.map((t, i) => (
              <a
                key={t.label}
                href={`mailto:${t.email}?subject=${encodeURIComponent(t.subject)}`}
                className="flex items-center gap-3 px-5 hover:bg-white/5 transition-colors"
                style={{ paddingTop: 12, paddingBottom: 12, borderTop: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none', textDecoration: 'none' }}
              >
                <span style={{ fontSize: 18, flexShrink: 0 }}>{t.icon}</span>
                <div className="flex-1">
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#ffffff' }}>{t.label}</p>
                  <p style={{ fontSize: 11, color: 'rgba(0,200,255,0.6)' }}>{t.email}</p>
                </div>
                <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 14 }}>›</span>
              </a>
            ))}
          </div>

          {/* ── Response time ── */}
          <div className="rounded-2xl p-4 mb-4" style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.15)', ...fade(a, 120) }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#4ade80', marginBottom: 4 }}>⏱ Response times</p>
            <ul className="flex flex-col gap-1">
              {[
                ['General support', '1 business day'],
                ['Safety concerns', 'Within 4 hours'],
                ['Billing disputes', '2 business days'],
                ['Data deletion',   '30 days'],
              ].map(([label, time]) => (
                <li key={label} className="flex justify-between" style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                  <span>{label}</span>
                  <span style={{ color: '#4ade80', fontWeight: 600 }}>{time}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* ── Emergency ── */}
          <div className="rounded-2xl p-4" style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)', ...fade(a, 160) }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#f87171', marginBottom: 4 }}>🚨 Immediate safety emergencies</p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.55 }}>
              If there is an immediate safety risk during a pickup — fire, hazardous material exposure, or physical danger — call <strong style={{ color: '#ffffff' }}>911</strong> first, then notify your dispatcher via the app.
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}
