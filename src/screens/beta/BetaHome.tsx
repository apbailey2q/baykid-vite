import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

function fade(a: boolean, d = 0): React.CSSProperties {
  return {
    opacity:    a ? 1 : 0,
    transform:  a ? 'translateY(0)' : 'translateY(14px)',
    transition: `opacity 0.4s ease ${d}ms, transform 0.4s ease ${d}ms`,
  }
}

const SAFETY_RULES = [
  { icon: '💳', text: 'Payments remain in Stripe test mode — no real charges will occur.' },
  { icon: '🚛', text: 'Use designated demo route stops only. No real hazardous pickups.' },
  { icon: '📍', text: 'Driver GPS tracking is session-only. Locations are not retained after route end.' },
  { icon: '🔔', text: 'No mass push notifications will be sent during beta testing.' },
  { icon: '🔒', text: 'Do not share beta credentials or access real customer production data.' },
]

const BETA_GROUPS = [
  { role: 'Commercial Owner',     icon: '🏢', color: '#00c8ff', email: 'beta.commercial@cbrecycling.org' },
  { role: 'Driver (Commercial)',  icon: '🚛', color: '#a78bfa', email: 'beta.driver.commercial@cbrecycling.org' },
  { role: 'Driver (Hybrid)',      icon: '🔀', color: '#a78bfa', email: 'beta.driver.hybrid@cbrecycling.org' },
  { role: 'Warehouse Staff',      icon: '🏭', color: '#4ade80', email: 'beta.warehouse@cbrecycling.org' },
  { role: 'Warehouse Supervisor', icon: '👷', color: '#4ade80', email: 'beta.supervisor@cbrecycling.org' },
  { role: 'Admin / Operator',     icon: '⚙️', color: '#fbbf24', email: 'beta.admin@cbrecycling.org' },
  { role: 'Partner / Funder',     icon: '🤝', color: '#5eead4', email: 'beta.partner@cbrecycling.org' },
]

export default function BetaHome() {
  const navigate  = useNavigate()
  const [a, setA] = useState(false)
  const profile   = useAuthStore(s => s.profile)

  useEffect(() => { const id = requestAnimationFrame(() => setA(true)); return () => cancelAnimationFrame(id) }, [])

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden" style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}>
      <div className="pointer-events-none absolute inset-0 grid-bg" />
      <div className="pointer-events-none absolute" style={{ top: -80, right: -60, width: 280, height: 280, background: 'rgba(94,234,212,0.07)', filter: 'blur(72px)', borderRadius: '50%' }} />

      <header className="relative flex items-center justify-between px-4 py-3" style={{ background: 'rgba(4,10,24,0.92)', borderBottom: '1px solid rgba(0,200,255,0.12)', backdropFilter: 'blur(12px)', zIndex: 2 }}>
        <div className="flex items-center gap-3">
          <span className="text-xl font-extrabold" style={{ color: '#00c8ff' }}>BayKid</span>
          <span style={{ color: 'rgba(0,200,255,0.3)' }}>|</span>
          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest" style={{ background: 'rgba(94,234,212,0.12)', border: '1px solid rgba(94,234,212,0.3)', color: '#5eead4' }}>
            Beta
          </span>
        </div>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
          ← Back
        </button>
      </header>

      <div className="relative flex-1 overflow-y-auto pb-20" style={{ zIndex: 1 }}>
        <div className="max-w-[520px] mx-auto px-4 pt-8 pb-8">

          {/* Header */}
          <div className="mb-7" style={fade(a, 0)}>
            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest mb-3 inline-block" style={{ background: 'rgba(94,234,212,0.1)', border: '1px solid rgba(94,234,212,0.3)', color: '#5eead4' }}>
              Beta Testing Program
            </span>
            <h1 className="text-2xl font-extrabold mb-1.5" style={{ color: '#ffffff' }}>Welcome, Beta Tester</h1>
            {profile?.full_name && (
              <p className="text-sm mb-2" style={{ color: '#00c8ff' }}>{profile.full_name}</p>
            )}
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
              You're helping shape the BayKid platform before public launch. Thank you. Use the tools below to track your testing progress and report issues.
            </p>
          </div>

          {/* Beta period banner */}
          <div className="rounded-2xl p-4 mb-5 flex items-center gap-3" style={{ background: 'rgba(94,234,212,0.06)', border: '1px solid rgba(94,234,212,0.2)', ...fade(a, 50) }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>📅</span>
            <div>
              <p className="text-xs font-bold mb-0.5" style={{ color: '#5eead4' }}>Beta Period</p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>May 2026 – Target public launch Q3 2026. Report all issues before the close of beta.</p>
            </div>
          </div>

          {/* Action cards */}
          <div className="grid grid-cols-2 gap-3 mb-6" style={fade(a, 80)}>
            <Link
              to="/beta/checklist"
              style={{ textDecoration: 'none' }}
            >
              <div className="rounded-2xl p-5 flex flex-col gap-2 h-full hover:brightness-110 transition-all active:scale-[0.97]" style={{ background: 'rgba(0,87,231,0.12)', border: '1px solid rgba(0,200,255,0.2)' }}>
                <span style={{ fontSize: 24 }}>✅</span>
                <p className="font-bold text-sm" style={{ color: '#ffffff' }}>Test Checklist</p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>Step-by-step testing tasks for your role. Track what you've tested.</p>
              </div>
            </Link>
            <Link
              to="/beta/feedback"
              style={{ textDecoration: 'none' }}
            >
              <div className="rounded-2xl p-5 flex flex-col gap-2 h-full hover:brightness-110 transition-all active:scale-[0.97]" style={{ background: 'rgba(94,234,212,0.07)', border: '1px solid rgba(94,234,212,0.2)' }}>
                <span style={{ fontSize: 24 }}>📋</span>
                <p className="font-bold text-sm" style={{ color: '#ffffff' }}>Submit Feedback</p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>Report bugs, UX issues, or suggestions. Attach a screenshot.</p>
              </div>
            </Link>
          </div>

          {/* Beta Groups */}
          <div className="rounded-2xl overflow-hidden mb-5" style={{ background: 'rgba(0,87,231,0.07)', border: '1px solid rgba(0,200,255,0.13)', ...fade(a, 120) }}>
            <div className="px-5 pt-4 pb-2 flex items-center gap-2">
              <span style={{ fontSize: 14 }}>👥</span>
              <p style={{ fontSize: 13, fontWeight: 800, color: '#ffffff' }}>Beta Testing Accounts</p>
            </div>
            {BETA_GROUPS.map((g, i) => (
              <div key={g.role} className="flex items-center gap-3 px-5" style={{ paddingTop: 11, paddingBottom: 11, borderTop: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>{g.icon}</span>
                <div className="flex-1 min-w-0">
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#ffffff' }}>{g.role}</p>
                  <p className="truncate" style={{ fontSize: 10, color: g.color, opacity: 0.8 }}>{g.email}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Safety Rules */}
          <div className="rounded-2xl p-5 mb-5" style={{ background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.15)', ...fade(a, 160) }}>
            <p className="text-xs font-bold mb-3" style={{ color: '#fbbf24' }}>⚠️ Beta Safety Rules</p>
            <div className="flex flex-col gap-2.5">
              {SAFETY_RULES.map(rule => (
                <div key={rule.text} className="flex gap-2.5">
                  <span style={{ fontSize: 13, flexShrink: 0 }}>{rule.icon}</span>
                  <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>{rule.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Escalation */}
          <div className="rounded-2xl p-4 mb-5" style={{ background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.15)', ...fade(a, 200) }}>
            <p className="text-xs font-bold mb-1" style={{ color: '#f87171' }}>🚨 Critical Issue Escalation</p>
            <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
              For blockers, data leaks, or security issues during beta, contact the ops team directly:{' '}
              <a href="mailto:beta@cbrecycling.org" style={{ color: '#f87171', textDecoration: 'none' }}>beta@cbrecycling.org</a>
            </p>
          </div>

          {/* Success criteria */}
          <div className="rounded-2xl p-5" style={{ background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.15)', ...fade(a, 240) }}>
            <p className="text-xs font-bold mb-3" style={{ color: '#4ade80' }}>🎯 Beta Success Criteria</p>
            <div className="flex flex-col gap-1.5">
              {[
                'No major crashes or blank screens across roles',
                'Role access controls work — no unauthorized data visible',
                'Payment flow behaves correctly in Stripe test mode',
                'Inspection flow completes without getting stuck',
                'Mobile layout correct at 375px (iPhone SE width)',
                'Push notifications delivered to at least one device per role',
              ].map(item => (
                <div key={item} className="flex gap-2">
                  <span style={{ color: '#4ade80', flexShrink: 0, fontSize: 11 }}>›</span>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{item}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
