import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { demoFundraisers, pctFunded, fmtNum, typeAccent, type Fundraiser } from '../../lib/demoFundraisers'

function ProgressBar({ raised, goal, animate }: { raised: number; goal: number; animate: boolean }) {
  const p = pctFunded(raised, goal)
  return (
    <div>
      <div className="flex justify-between text-xs mb-2">
        <span className="font-semibold" style={{ color: '#ffffff' }}>
          ${fmtNum(raised)}
          <span className="font-normal ml-1" style={{ color: 'rgba(255,255,255,0.4)' }}>raised</span>
        </span>
        <span style={{ color: 'rgba(255,255,255,0.4)' }}>${fmtNum(goal)} goal</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <div
          className="h-full rounded-full"
          style={{
            width: animate ? `${p}%` : '0%',
            background: 'linear-gradient(90deg, #0057e7, #00c8ff)',
            transition: 'width 1200ms ease-out',
          }}
        />
      </div>
      <div className="flex items-center gap-2 mt-1.5">
        <span className="text-xs font-semibold" style={{ color: '#00c8ff' }}>{p}% funded</span>
        {p >= 80 && (
          <span
            className="text-[10px] font-semibold px-1.5 py-px rounded-full"
            style={{ background: 'rgba(20,184,166,0.12)', color: '#5eead4', border: '1px solid rgba(20,184,166,0.3)' }}
          >
            Almost there!
          </span>
        )}
      </div>
    </div>
  )
}

function FundraiserCard({ fundraiser, delay, animate }: { fundraiser: Fundraiser; delay: number; animate: boolean }) {
  const colors = typeAccent(fundraiser.type)
  return (
    <Link
      to={`/fundraisers/${fundraiser.id}`}
      className="block"
      style={{
        opacity:    animate ? 1 : 0,
        transform:  animate ? 'translateY(0)' : 'translateY(16px)',
        transition: `opacity 0.4s ease ${delay}ms, transform 0.4s ease ${delay}ms`,
      }}
    >
      <div
        className="rounded-2xl p-5 transition-all duration-300"
        style={{
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(0,190,255,0.15)',
          backdropFilter: 'blur(12px)',
        }}
      >
        {/* Top row */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <span style={{ fontSize: 24 }}>{fundraiser.emoji}</span>
            <span
              className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
              style={{ color: colors.text, background: colors.bg, border: `1px solid ${colors.border}` }}
            >
              {fundraiser.type}
            </span>
          </div>
          <div
            className="flex items-center gap-1 px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>{fundraiser.supporters}</span>
          </div>
        </div>

        {/* Name + description */}
        <p className="text-base font-semibold mb-1" style={{ color: '#ffffff', lineHeight: 1.3 }}>
          {fundraiser.name}
        </p>
        <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>
          {fundraiser.description}
        </p>

        <ProgressBar raised={fundraiser.raised} goal={fundraiser.goal} animate={animate} />

        <div className="h-px my-4" style={{ background: 'rgba(255,255,255,0.07)' }} />

        {/* CTA */}
        <div
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: 'linear-gradient(135deg, #0057e7, #00c8ff)', color: '#ffffff' }}
        >
          View Fundraiser
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </Link>
  )
}

export default function FundraisersPage() {
  const navigate = useNavigate()
  const [animate, setAnimate] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimate(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const totalRaised     = demoFundraisers.reduce((s, f) => s + f.raised, 0)
  const totalSupporters = demoFundraisers.reduce((s, f) => s + f.supporters, 0)

  return (
    <div
      className="relative min-h-screen flex flex-col overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}
    >
      <div className="pointer-events-none absolute inset-0 grid-bg" />
      <div className="pointer-events-none absolute" style={{ top: -80, left: -60, width: 280, height: 280, background: 'rgba(0,87,231,0.3)', filter: 'blur(72px)', borderRadius: '50%' }} />
      <div className="pointer-events-none absolute" style={{ bottom: -60, right: -40, width: 240, height: 240, background: 'rgba(0,200,255,0.18)', filter: 'blur(64px)', borderRadius: '50%' }} />

      <div className="relative flex-1 overflow-y-auto pb-24" style={{ zIndex: 1 }}>
        <div className="max-w-[480px] mx-auto px-4 pt-10 pb-6">

          {/* Back */}
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm mb-6 transition-opacity hover:opacity-70"
            style={{ opacity: animate ? 1 : 0, transition: 'opacity 0.35s ease', color: 'rgba(255,255,255,0.45)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            Back
          </button>

          {/* Header */}
          <div
            className="mb-7"
            style={{ opacity: animate ? 1 : 0, transform: animate ? 'translateY(0)' : 'translateY(-10px)', transition: 'opacity 0.4s ease 40ms, transform 0.4s ease 40ms' }}
          >
            <div className="flex items-center gap-3 mb-1">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(0,200,255,0.12)', border: '1px solid rgba(0,200,255,0.25)' }}
              >
                <span style={{ fontSize: 18 }}>🌱</span>
              </div>
              <h1 className="text-xl font-bold" style={{ color: '#ffffff' }}>Fundraisers</h1>
            </div>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Support your community while recycling.{' '}
              <span style={{ color: '#00c8ff' }}>Every bag counts.</span>
            </p>
          </div>

          {/* Summary strip */}
          <div
            className="grid grid-cols-3 gap-2 mb-7"
            style={{ opacity: animate ? 1 : 0, transition: 'opacity 0.4s ease 100ms' }}
          >
            {[
              { label: 'Active', value: String(demoFundraisers.length) },
              { label: 'Total Raised', value: `$${fmtNum(totalRaised)}` },
              { label: 'Supporters', value: String(totalSupporters) },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-2xl p-3 text-center"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(0,190,255,0.15)' }}
              >
                <div className="text-base font-bold" style={{ color: '#ffffff' }}>{s.value}</div>
                <div className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Section label */}
          <div
            className="flex items-center gap-2 mb-4"
            style={{ opacity: animate ? 1 : 0, transition: 'opacity 0.4s ease 160ms' }}
          >
            <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Active Campaigns
            </span>
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
          </div>

          {/* Cards */}
          <div className="flex flex-col gap-4">
            {demoFundraisers.map((f, i) => (
              <FundraiserCard key={f.id} fundraiser={f} delay={i * 80} animate={animate} />
            ))}
          </div>

          {/* My fundraiser link */}
          <div
            className="mt-6"
            style={{ opacity: animate ? 1 : 0, transition: `opacity 0.5s ease ${demoFundraisers.length * 80 + 200}ms` }}
          >
            <Link
              to="/my-fundraiser"
              className="flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-medium transition-all"
              style={{ background: 'rgba(0,200,255,0.07)', border: '1px solid rgba(0,200,255,0.2)', color: '#00c8ff' }}
            >
              View My Fundraiser Impact →
            </Link>
          </div>

        </div>
      </div>
    </div>
  )
}
