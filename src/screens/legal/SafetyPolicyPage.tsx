import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

function fade(a: boolean, d = 0): React.CSSProperties {
  return {
    opacity:    a ? 1 : 0,
    transform:  a ? 'translateY(0)' : 'translateY(14px)',
    transition: `opacity 0.4s ease ${d}ms, transform 0.4s ease ${d}ms`,
  }
}

const PILLARS = [
  {
    icon:  '🤖',
    title: 'AI-Assisted Safety Review',
    body:  'Our platform uses AI image analysis to flag potential safety concerns in commercial recycling loads — including hazardous materials, sharp objects, leaking fluids, and biological contamination. AI results are advisory only and never replace driver or admin judgment. Drivers may override AI recommendations with a documented reason, and all overrides are reviewed by admins.',
  },
  {
    icon:  '🚛',
    title: 'Driver Safety Standards',
    body:  'All commercial route drivers are required to complete the driver safety checklist before each stop. Drivers must refuse loads that pose an immediate safety risk, even if no AI system is available. Red inspection results lock the route until an admin review is complete.',
  },
  {
    icon:  '🏭',
    title: 'Warehouse Intake Safety',
    body:  'Warehouse staff inspect incoming loads at intake. Green, yellow, and red classifications determine processing path. Red-classified loads are quarantined and escalated to a supervisor before any processing begins.',
  },
  {
    icon:  '🚨',
    title: 'Emergency Protocol',
    body:  'If a driver encounters an immediate safety threat — fire, hazardous chemical, or physical danger — they must leave the area immediately and call 911. After ensuring personal safety, they should flag the stop in the app and notify their dispatcher. Do not re-enter a hazardous area.',
  },
  {
    icon:  '📋',
    title: 'Incident Reporting',
    body:  'All safety incidents, near-misses, and override events are logged in the platform audit trail with timestamp, driver ID, AI result, driver decision, and admin review outcome. This log is retained for a minimum of 2 years.',
  },
  {
    icon:  '🔒',
    title: 'Data Safety',
    body:  'All inspection photos, GPS data, and personal information are encrypted in transit and at rest. Access is restricted by role-based controls. Drivers can only see their own assigned stops. Warehouse staff can only access loads assigned to their facility.',
  },
]

export default function SafetyPolicyPage() {
  const navigate  = useNavigate()
  const [a, setA] = useState(false)
  useEffect(() => { const id = requestAnimationFrame(() => setA(true)); return () => cancelAnimationFrame(id) }, [])

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden" style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}>
      <div className="pointer-events-none absolute inset-0 grid-bg" />
      <div className="pointer-events-none absolute" style={{ bottom: -60, right: -40, width: 220, height: 220, background: 'rgba(0,87,231,0.15)', filter: 'blur(60px)', borderRadius: '50%' }} />

      <header className="relative flex items-center justify-between px-4 py-3" style={{ background: 'rgba(4,10,24,0.92)', borderBottom: '1px solid rgba(0,200,255,0.12)', backdropFilter: 'blur(12px)', zIndex: 2 }}>
        <div className="flex items-center gap-3">
          <span className="text-xl font-extrabold" style={{ color: '#00c8ff' }}>Cyan's Brooklynn</span>
          <span style={{ color: 'rgba(0,200,255,0.3)' }}>|</span>
          <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>Safety Policy</span>
        </div>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
          ← Back
        </button>
      </header>

      <div className="relative flex-1 overflow-y-auto pb-20" style={{ zIndex: 1 }}>
        <div className="max-w-[520px] mx-auto px-4 pt-8 pb-8">

          <div className="mb-6" style={fade(a, 0)}>
            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest mb-3 inline-block" style={{ background: 'rgba(94,234,212,0.1)', border: '1px solid rgba(94,234,212,0.3)', color: '#5eead4' }}>
              Safety
            </span>
            <h1 className="text-2xl font-extrabold mb-1.5" style={{ color: '#ffffff' }}>Safety Policy</h1>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Last updated May 2026. Safety of our drivers, warehouse teams, and communities is our highest priority.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            {PILLARS.map((p, i) => (
              <div key={p.title} className="rounded-2xl p-5" style={{ background: 'rgba(0,87,231,0.08)', border: '1px solid rgba(0,200,255,0.15)', ...fade(a, 60 + i * 40) }}>
                <div className="flex items-center gap-2.5 mb-3">
                  <span style={{ fontSize: 18 }}>{p.icon}</span>
                  <p style={{ fontSize: 13, fontWeight: 800, color: '#ffffff' }}>{p.title}</p>
                </div>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.65 }}>{p.body}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl p-4 mt-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', ...fade(a, 340) }}>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textAlign: 'center', lineHeight: 1.6 }}>
              Safety questions?{' '}
              <a href="mailto:safety@cbrecycling.org" style={{ color: '#00c8ff', textDecoration: 'none' }}>safety@cbrecycling.org</a>
              {' '}· CB Recycling · Nashville, TN
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}
