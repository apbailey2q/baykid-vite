import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

function fade(a: boolean, d = 0): React.CSSProperties {
  return {
    opacity:    a ? 1 : 0,
    transform:  a ? 'translateY(0)' : 'translateY(14px)',
    transition: `opacity 0.4s ease ${d}ms, transform 0.4s ease ${d}ms`,
  }
}

const SECTIONS = [
  {
    icon:  '✅',
    title: 'Pre-Route Safety Checklist',
    items: [
      'Complete the in-app driver safety checklist before departing for the first stop.',
      'Verify your vehicle is road-worthy: tires, mirrors, lights, and cargo area secure.',
      'Confirm you have PPE in the vehicle: gloves, safety vest, and eye protection.',
      'Do not begin a route if you feel impaired, ill, or fatigued.',
    ],
  },
  {
    icon:  '🔍',
    title: 'Inspecting Loads at the Curb',
    items: [
      'Observe the bag or bin from a safe distance before approaching.',
      'Do not lift or move a bag that is leaking, has visible sharp protrusions, or emits unusual odors.',
      'If an AI scan result is available, review it before picking up the load.',
      'You have the right — and the obligation — to refuse any load that appears unsafe.',
      'Document all refusals in the app with a photo and a brief reason.',
    ],
  },
  {
    icon:  '🚫',
    title: 'Automatic Refusal Criteria',
    items: [
      'Visible needles, glass shards, or sharp metal protruding from the bag.',
      'Leaking fluids that are not clearly water.',
      'Visible biological material or strong biological odor.',
      'Smoke, heat, or fire risk from the bag or surrounding area.',
      'Any bag flagged RED by the AI system unless an admin has explicitly cleared it.',
      'Bags left at locations that pose physical access risks (steep drop-offs, traffic hazard).',
    ],
  },
  {
    icon:  '🤖',
    title: 'Using AI Inspection Results',
    items: [
      'AI results are advisory. A GREEN result does not guarantee safety.',
      'A RED result locks the stop. You may not proceed without an admin override.',
      'A YELLOW result means proceed with extra caution and document your observation.',
      'You may override AI recommendations with a documented reason. All overrides are reviewed.',
      'Never falsify an inspection result or skip the checklist to meet time targets.',
    ],
  },
  {
    icon:  '🚛',
    title: 'Safe Loading Practices',
    items: [
      'Use proper lifting technique — bend at the knees, keep loads close to your body.',
      'Do not exceed the per-bag weight limit established in your route assignment.',
      'Secure all loads before moving the vehicle. No loose bags in the cab.',
      'Do not overload the vehicle beyond its rated capacity.',
    ],
  },
  {
    icon:  '🏁',
    title: 'Completing a Stop',
    items: [
      'Mark each stop as Completed only after the bag or bin has been physically collected.',
      'If a stop cannot be completed (resident not home, access blocked, safety refusal), mark it as Skipped or Flagged with a reason.',
      'Do not mark a stop Completed and then skip it — this creates a false audit record.',
      'Deliver loads only to your assigned warehouse. Do not divert loads.',
    ],
  },
  {
    icon:  '🚨',
    title: 'Emergency Procedures',
    items: [
      'If you encounter fire, a chemical spill, or immediate physical danger — leave the area immediately.',
      'Call 911 first. Your safety and bystander safety come before app reporting.',
      'After calling 911, flag the stop in the app and call your dispatcher.',
      'Do not re-enter a hazardous area for any reason.',
      'All emergency events must be reported via the app before your shift ends.',
    ],
  },
  {
    icon:  '📋',
    title: 'Incident Reporting',
    items: [
      'Report all accidents, near-misses, injuries, and safety refusals in the app on the same day.',
      'Include photos, location, and a written description.',
      'Incidents are logged with your driver ID and are reviewed by safety administration.',
      'Retaliation for good-faith safety reports is prohibited.',
    ],
  },
]

export default function DriverSafetyPage() {
  const navigate  = useNavigate()
  const [a, setA] = useState(false)
  useEffect(() => { const id = requestAnimationFrame(() => setA(true)); return () => cancelAnimationFrame(id) }, [])

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden" style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}>
      <div className="pointer-events-none absolute inset-0 grid-bg" />
      <div className="pointer-events-none absolute" style={{ top: -60, right: -40, width: 220, height: 220, background: 'rgba(0,87,231,0.14)', filter: 'blur(60px)', borderRadius: '50%' }} />

      <header className="relative flex items-center justify-between px-4 py-3" style={{ background: 'rgba(4,10,24,0.92)', borderBottom: '1px solid rgba(0,200,255,0.12)', backdropFilter: 'blur(12px)', zIndex: 2 }}>
        <div className="flex items-center gap-3">
          <span className="text-xl font-extrabold" style={{ color: '#00c8ff' }}>Cyan's Brooklynn</span>
          <span style={{ color: 'rgba(0,200,255,0.3)' }}>|</span>
          <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>Driver Safety</span>
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
            <h1 className="text-2xl font-extrabold mb-1.5" style={{ color: '#ffffff' }}>Driver Safety Guidelines</h1>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Last updated May 2026. Required reading for all commercial route drivers. These guidelines are mandatory — not optional.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            {SECTIONS.map((s, i) => (
              <div key={s.title} className="rounded-2xl p-5" style={{ background: 'rgba(0,87,231,0.08)', border: '1px solid rgba(0,200,255,0.15)', ...fade(a, 60 + i * 35) }}>
                <div className="flex items-center gap-2.5 mb-3">
                  <span style={{ fontSize: 18 }}>{s.icon}</span>
                  <p style={{ fontSize: 13, fontWeight: 800, color: '#ffffff' }}>{s.title}</p>
                </div>
                <ul className="flex flex-col gap-2">
                  {s.items.map((item, j) => (
                    <li key={j} className="flex gap-2" style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>
                      <span style={{ color: 'rgba(0,200,255,0.5)', flexShrink: 0, marginTop: 1 }}>›</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="rounded-2xl p-4 mt-5" style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)', ...fade(a, 60 + SECTIONS.length * 35) }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#f87171', marginBottom: 4 }}>🚨 Emergency: call 911 first</p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.55 }}>
              For fire, chemical exposure, or immediate physical danger — leave the area and call 911 before using the app. After ensuring your safety, flag the stop and contact your dispatcher.
            </p>
          </div>

          <div className="rounded-2xl p-4 mt-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', ...fade(a, 60 + SECTIONS.length * 35 + 40) }}>
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
