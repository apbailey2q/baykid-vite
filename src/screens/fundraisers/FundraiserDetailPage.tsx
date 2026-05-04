import { useState, useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
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
      <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
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

function NotFound() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
      style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}
    >
      <span style={{ fontSize: 48, marginBottom: 16 }}>♻️</span>
      <h2 className="text-lg font-semibold mb-2" style={{ color: '#ffffff' }}>Fundraiser not found</h2>
      <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.4)' }}>
        This fundraiser may have ended or the link is incorrect.
      </p>
      <Link
        to="/fundraisers"
        className="text-sm font-semibold px-5 py-2.5 rounded-xl transition-all"
        style={{ background: 'linear-gradient(135deg, #0057e7, #00c8ff)', color: '#ffffff' }}
      >
        Browse Fundraisers
      </Link>
    </div>
  )
}

export default function FundraiserDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [animate, setAnimate] = useState(false)
  const [joined, setJoined] = useState(false)

  useEffect(() => {
    const t = requestAnimationFrame(() => setAnimate(true))
    return () => cancelAnimationFrame(t)
  }, [])

  const fundraiser: Fundraiser | undefined = demoFundraisers.find((f) => f.id === id)

  if (!fundraiser) return <NotFound />

  const colors = typeAccent(fundraiser.type)
  const p      = pctFunded(fundraiser.raised, fundraiser.goal)

  const fade = (delay = 0): React.CSSProperties => ({
    opacity:    animate ? 1 : 0,
    transform:  animate ? 'translateY(0)' : 'translateY(14px)',
    transition: `opacity 0.4s ease ${delay}ms, transform 0.4s ease ${delay}ms`,
  })

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
          <div style={fade(0)}>
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 text-sm mb-6 transition-opacity hover:opacity-70"
              style={{ color: 'rgba(255,255,255,0.45)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 5l-7 7 7 7" />
              </svg>
              Fundraisers
            </button>
          </div>

          {/* Hero */}
          <div className="mb-6" style={fade(60)}>
            <div className="flex items-start gap-4 mb-4">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(0,190,255,0.15)', fontSize: 30 }}
              >
                {fundraiser.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <span
                  className="inline-block text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full mb-2"
                  style={{ color: colors.text, background: colors.bg, border: `1px solid ${colors.border}` }}
                >
                  {fundraiser.type}
                </span>
                <h1 className="text-xl font-bold leading-snug" style={{ color: '#ffffff' }}>
                  {fundraiser.name}
                </h1>
              </div>
            </div>

            {/* Pills */}
            <div className="flex flex-wrap gap-2">
              {[
                { icon: '👥', label: `${fundraiser.supporters} supporters` },
                { icon: '♻️', label: `${fundraiser.percentToCause}% goes to cause` },
                { icon: '📍', label: 'Nashville, TN' },
              ].map((pill) => (
                <div
                  key={pill.label}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)' }}
                >
                  <span style={{ fontSize: 12 }}>{pill.icon}</span>
                  {pill.label}
                </div>
              ))}
            </div>
          </div>

          {/* Progress card */}
          <div
            className="rounded-2xl p-5 mb-4"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(0,190,255,0.15)', ...fade(120) }}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Campaign Progress
              </span>
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                {fmtNum(fundraiser.supporters)} supporters
              </span>
            </div>
            <ProgressBar raised={fundraiser.raised} goal={fundraiser.goal} animate={animate} />

            {/* Milestone dots */}
            <div className="flex justify-between mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              {[25, 50, 75, 100].map((milestone) => (
                <div key={milestone} className="flex flex-col items-center gap-1">
                  <div
                    className="w-2 h-2 rounded-full transition-all duration-700"
                    style={{ background: p >= milestone ? '#00c8ff' : 'rgba(255,255,255,0.12)' }}
                  />
                  <span className="text-[10px]" style={{ color: p >= milestone ? '#00c8ff' : 'rgba(255,255,255,0.25)' }}>
                    {milestone}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* About + Impact */}
          <div className="flex flex-col gap-3 mb-4" style={fade(180)}>
            {[
              { icon: '📋', title: 'About this fundraiser', body: fundraiser.description, accent: false },
              { icon: '🌍', title: 'Your impact', body: fundraiser.impact, accent: true },
            ].map((card) => (
              <div
                key={card.title}
                className="rounded-2xl p-4"
                style={{
                  background: card.accent ? 'rgba(0,200,255,0.05)' : 'rgba(255,255,255,0.06)',
                  border: card.accent ? '1px solid rgba(0,200,255,0.2)' : '1px solid rgba(0,190,255,0.15)',
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span style={{ fontSize: 16 }}>{card.icon}</span>
                  <span
                    className="text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: card.accent ? '#00c8ff' : 'rgba(255,255,255,0.4)' }}
                  >
                    {card.title}
                  </span>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  {card.body}
                </p>
              </div>
            ))}
          </div>

          {/* Per-bag split */}
          <div
            className="rounded-2xl p-5 mb-6"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(0,190,255,0.15)', ...fade(240) }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Per-bag earnings split
            </p>
            <div className="flex items-center gap-3">
              <div className="flex-1 rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div className="text-lg font-bold" style={{ color: '#ffffff' }}>{100 - fundraiser.percentToCause}%</div>
                <div className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>You keep</div>
              </div>
              <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 18 }}>⇄</div>
              <div
                className="flex-1 rounded-xl p-3 text-center"
                style={{ background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.2)' }}
              >
                <div className="text-lg font-bold" style={{ color: '#00c8ff' }}>{fundraiser.percentToCause}%</div>
                <div className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Fundraiser</div>
              </div>
            </div>
            <p className="text-[11px] text-center mt-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Every bag you scan contributes {fundraiser.percentToCause}% of earnings to this cause.
            </p>
          </div>

          {/* CTAs */}
          <div className="flex flex-col gap-3" style={fade(300)}>
            <button
              onClick={() => setJoined(true)}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-sm transition-all duration-300"
              style={
                joined
                  ? { background: 'rgba(20,184,166,0.15)', border: '1px solid rgba(20,184,166,0.4)', color: '#5eead4', cursor: 'default' }
                  : { background: 'linear-gradient(135deg, #0057e7, #00c8ff)', color: '#ffffff', border: 'none' }
              }
            >
              {joined ? (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Fundraiser Joined
                </>
              ) : (
                <>♻️ Join Fundraiser</>
              )}
            </button>

            <Link
              to="/my-fundraiser"
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-medium transition-all"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)' }}
            >
              View My Fundraiser Dashboard
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

        </div>
      </div>
    </div>
  )
}
