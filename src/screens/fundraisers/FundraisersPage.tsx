import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import LiveImpactCounter from '../../components/LiveImpactCounter'
import FundraiserCountdown from '../../components/FundraiserCountdown'
import {
  demoFundraisers,
  activeFundraiser,
  pctFunded,
  fmtNum,
  typeAccent,
  getFundraiserStatus,
  type Fundraiser,
} from '../../lib/demoFundraisers'

// ── Celebration overlay config ────────────────────────────────────────────────
const FLOAT_ITEMS = [
  { emoji: '♻️', left: '6%',  bottom: '18%', delay: '0ms',   size: 28, dur: '2.3s' },
  { emoji: '💵', left: '20%', bottom: '25%', delay: '140ms', size: 22, dur: '2.6s' },
  { emoji: '🌱', left: '36%', bottom: '15%', delay: '280ms', size: 26, dur: '2.1s' },
  { emoji: '💰', left: '52%', bottom: '22%', delay: '70ms',  size: 24, dur: '2.4s' },
  { emoji: '🏀', left: '68%', bottom: '18%', delay: '210ms', size: 22, dur: '2.5s' },
  { emoji: '🏫', left: '82%', bottom: '24%', delay: '350ms', size: 20, dur: '2.2s' },
  { emoji: '♻️', left: '13%', bottom: '38%', delay: '420ms', size: 18, dur: '2.7s' },
  { emoji: '💵', left: '45%', bottom: '40%', delay: '500ms', size: 18, dur: '2.3s' },
  { emoji: '🌱', left: '76%', bottom: '35%', delay: '320ms', size: 20, dur: '2.5s' },
  { emoji: '💰', left: '88%', bottom: '42%', delay: '180ms', size: 16, dur: '2.4s' },
]

// Live donation ticker mock data
const DONATION_TICKER = [
  { name: 'Maya',             action: 'recycled 3 QR bags',   amount: '$4.20',  cause: 'East Nashville High Basketball', icon: '♻️' },
  { name: 'Coach Davis',      action: 'joined a fundraiser',  amount: null,     cause: 'Nashville Youth STEM Club',       icon: '🏀' },
  { name: 'Brooklynn Outreach', action: 'received support',   amount: '$18.75', cause: 'Community Cleanup Fund',          icon: '💰' },
  { name: 'Jordan',           action: 'recycled 5 QR bags',   amount: '$7.10',  cause: 'East Nashville High Basketball',  icon: '💵' },
]

// Platform-wide impact numbers (mock)
const PLATFORM_STATS = [
  { icon: '💰', label: 'Total Raised',           target: 128450, prefix: '$', suffix: '',  duration: 1600 },
  { icon: '🏘️', label: 'Communities Supported',  target: 37,     prefix: '',  suffix: '',  duration: 1200 },
  { icon: '♻️', label: 'Bags Recycled',          target: 12980,  prefix: '',  suffix: '',  duration: 1500 },
]

// ── Count-up hook ─────────────────────────────────────────────────────────────
function useCountUp(target: number, duration: number, enabled: boolean): number {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!enabled) return
    let rafId: number
    const start = performance.now()
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      const eased    = 1 - Math.pow(1 - progress, 3)
      setCount(Math.round(target * eased))
      if (progress < 1) rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [enabled, target, duration])
  return count
}

// ── Platform stat card ────────────────────────────────────────────────────────
function ImpactStatCard({
  icon, label, target, prefix, suffix, duration, enabled, delay,
}: {
  icon: string; label: string; target: number; prefix: string; suffix: string
  duration: number; enabled: boolean; delay: number
}) {
  const count = useCountUp(target, duration, enabled)
  return (
    <div
      className="rounded-2xl p-3 flex flex-col items-center text-center gap-1"
      style={{
        background: 'rgba(255,255,255,0.05)',
        border:     '1px solid rgba(0,190,255,0.15)',
        boxShadow:  '0 0 20px rgba(0,87,231,0.08)',
        opacity:    enabled ? 1 : 0,
        transform:  enabled ? 'translateY(0)' : 'translateY(12px)',
        transition: `opacity 0.5s ease ${delay}ms, transform 0.5s ease ${delay}ms`,
      }}
    >
      <span style={{ fontSize: 20, lineHeight: 1 }}>{icon}</span>
      <span
        className="text-xl font-bold tabular-nums"
        style={{
          background:            'linear-gradient(135deg, #00c8ff, #5eead4)',
          WebkitBackgroundClip:  'text',
          WebkitTextFillColor:   'transparent',
          backgroundClip:        'text',
        } as React.CSSProperties}
      >
        {prefix}{count.toLocaleString()}{suffix}
      </span>
      <span className="text-[10px] font-medium leading-tight" style={{ color: 'rgba(255,255,255,0.4)' }}>
        {label}
      </span>
    </div>
  )
}

// ── Progress bar ──────────────────────────────────────────────────────────────
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
            width:      animate ? `${p}%` : '0%',
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

// ── Fundraiser card ───────────────────────────────────────────────────────────
function FundraiserCard({ fundraiser, delay, animate }: { fundraiser: Fundraiser; delay: number; animate: boolean }) {
  const colors  = typeAccent(fundraiser.type)
  const status  = getFundraiserStatus(fundraiser.endDate)
  const expired = status === 'expired'

  return (
    <Link
      to={`/fundraisers/${fundraiser.id}`}
      className="block"
      style={{
        opacity:    animate ? (expired ? 0.55 : 1) : 0,
        transform:  animate ? 'translateY(0)' : 'translateY(20px)',
        transition: `opacity 0.5s ease ${delay}ms, transform 0.5s ease ${delay}ms`,
      }}
    >
      <div
        className="rounded-2xl p-5 transition-all duration-300 hover:brightness-110"
        style={{
          background:    expired ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)',
          border:        expired ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,190,255,0.15)',
          backdropFilter:'blur(12px)',
          boxShadow:     '0 4px 24px rgba(0,0,0,0.3)',
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

        <p className="text-base font-semibold mb-1" style={{ color: '#ffffff', lineHeight: 1.3 }}>
          {fundraiser.name}
        </p>
        <p className="text-xs mb-2" style={{ color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>
          {fundraiser.description}
        </p>

        {/* Countdown */}
        <div className="mb-4">
          <FundraiserCountdown endDate={fundraiser.endDate} compact />
        </div>

        <ProgressBar raised={fundraiser.raised} goal={fundraiser.goal} animate={animate} />

        <div className="h-px my-4" style={{ background: 'rgba(255,255,255,0.07)' }} />

        <div
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold"
          style={
            expired
              ? { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)' }
              : { background: 'linear-gradient(135deg, #0057e7, #00c8ff)', color: '#ffffff' }
          }
        >
          {expired ? 'View Ended Fundraiser' : 'View Fundraiser'}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </Link>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function FundraisersPage() {
  const navigate = useNavigate()
  const [animate, setAnimate]           = useState(false)
  const [celebVisible, setCelebVisible] = useState(() => !sessionStorage.getItem('fundraiser-celeb-shown'))
  const [celebOpacity, setCelebOpacity] = useState(1)

  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimate(true))
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    if (!celebVisible) return
    const fadeTimer = setTimeout(() => setCelebOpacity(0),     2300)
    const hideTimer = setTimeout(() => {
      setCelebVisible(false)
      sessionStorage.setItem('fundraiser-celeb-shown', '1')
    }, 2800)
    return () => { clearTimeout(fadeTimer); clearTimeout(hideTimer) }
  }, [])

  // Donation ticker — cross-fades every 2.5s
  const [tickerIndex, setTickerIndex] = useState(0)
  const [tickerVis,   setTickerVis]   = useState(true)

  useEffect(() => {
    let crossfade: ReturnType<typeof setTimeout>
    const cycle = setInterval(() => {
      setTickerVis(false)
      crossfade = setTimeout(() => {
        setTickerIndex(prev => (prev + 1) % DONATION_TICKER.length)
        setTickerVis(true)
      }, 280)
    }, 2500)
    return () => { clearInterval(cycle); clearTimeout(crossfade) }
  }, [])

  const fade = (delay = 0): React.CSSProperties => ({
    opacity:    animate ? 1 : 0,
    transform:  animate ? 'translateY(0)' : 'translateY(12px)',
    transition: `opacity 0.45s ease ${delay}ms, transform 0.45s ease ${delay}ms`,
  })

  return (
    <>
      {/* ── Celebration overlay ───────────────────────────────────────────────── */}
      {celebVisible && (
        <div
          className="pointer-events-none fixed inset-0"
          style={{ zIndex: 100, opacity: celebOpacity, transition: 'opacity 0.5s ease' }}
        >
          {FLOAT_ITEMS.map((item, i) => (
            <span
              key={i}
              style={{
                position:  'absolute',
                left:      item.left,
                bottom:    item.bottom,
                fontSize:  item.size,
                animation: `celebFloat ${item.dur} ${item.delay} ease-out forwards`,
                lineHeight: 1,
              }}
            >
              {item.emoji}
            </span>
          ))}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center"
            style={{ paddingBottom: '10%' }}
          >
            <div
              className="rounded-3xl px-6 py-5"
              style={{
                background:    'rgba(6,14,36,0.82)',
                border:        '1px solid rgba(0,200,255,0.3)',
                backdropFilter:'blur(20px)',
                boxShadow:     '0 0 60px rgba(0,87,231,0.4)',
              }}
            >
              <p className="text-lg font-bold mb-1.5 leading-snug" style={{ color: '#ffffff' }}>
                Recycle. Raise Money.{' '}
                <span style={{ color: '#00c8ff' }}>Support Your Community.</span>
              </p>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
                Every QR bag can help fund schools, teams, and outreach programs.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Main page ─────────────────────────────────────────────────────────── */}
      <div
        className="relative min-h-screen flex flex-col overflow-hidden"
        style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}
      >
        {/* Orbs + grid */}
        <div className="pointer-events-none absolute inset-0 grid-bg" />
        <div className="pointer-events-none absolute" style={{ top: -80, left: -60, width: 320, height: 320, background: 'rgba(0,87,231,0.35)', filter: 'blur(72px)', borderRadius: '50%' }} />
        <div className="pointer-events-none absolute" style={{ bottom: -60, right: -40, width: 240, height: 240, background: 'rgba(0,200,255,0.18)', filter: 'blur(64px)', borderRadius: '50%' }} />
        <div className="pointer-events-none absolute" style={{ top: 30, left: '50%', transform: 'translateX(-50%)', width: 340, height: 160, background: 'rgba(0,200,128,0.1)', filter: 'blur(56px)', borderRadius: '50%' }} />

        {/* Decorative background icons */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ zIndex: 0 }}>
          <span style={{ position: 'absolute', top: '12%',   left: '-6%',  fontSize: 130, opacity: 0.035, transform: 'rotate(-18deg)', lineHeight: 1 }}>♻️</span>
          <span style={{ position: 'absolute', top: '42%',   right: '-8%', fontSize: 110, opacity: 0.035, transform: 'rotate(14deg)',  lineHeight: 1 }}>💰</span>
          <span style={{ position: 'absolute', bottom: '22%',left: '3%',   fontSize: 90,  opacity: 0.03,  transform: 'rotate(-8deg)',  lineHeight: 1 }}>🌱</span>
          <span style={{ position: 'absolute', top: '68%',   right: '1%',  fontSize: 95,  opacity: 0.03,  transform: 'rotate(22deg)',  lineHeight: 1 }}>💵</span>
        </div>

        <div className="relative flex-1 overflow-y-auto pb-24" style={{ zIndex: 1 }}>
          <div className="max-w-[480px] mx-auto px-4 pt-10 pb-6">

            {/* Back */}
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 text-sm mb-6 transition-opacity hover:opacity-70"
              style={{ ...fade(0), color: 'rgba(255,255,255,0.45)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 5l-7 7 7 7" />
              </svg>
              Back
            </button>

            {/* Small header row */}
            <div className="flex items-center gap-3 mb-5" style={fade(40)}>
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: 'rgba(0,200,128,0.15)',
                  border:     '1px solid rgba(0,200,128,0.35)',
                  boxShadow:  '0 0 20px rgba(0,200,128,0.2)',
                }}
              >
                <span style={{ fontSize: 18 }}>🌱</span>
              </div>
              <span
                className="text-[10px] font-bold uppercase tracking-widest"
                style={{ color: 'rgba(0,200,128,0.8)' }}
              >
                Community Fundraisers
              </span>
            </div>

            {/* ── Headline ──────────────────────────────────────────────────────── */}
            <div className="text-center mb-2" style={fade(80)}>
              <h1
                className="text-2xl font-bold leading-tight mb-2"
                style={{
                  background:           'linear-gradient(135deg, #ffffff 30%, #00c8ff 80%, #5eead4 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor:  'transparent',
                  backgroundClip:       'text',
                } as React.CSSProperties}
              >
                Turn Recycling Into Real Funding for Your Community
              </h1>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
                Every QR bag helps support schools, teams, and local programs.
              </p>
            </div>

            {/* ── Start a Fundraiser CTA ───────────────────────────────────────── */}
            <div style={{ ...fade(100), marginTop: 16, marginBottom: 20 }}>
              <Link
                to="/create-fundraiser"
                className="flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all hover:brightness-110"
                style={{
                  background: 'rgba(0,200,128,0.09)',
                  border:     '1px solid rgba(0,200,128,0.28)',
                  boxShadow:  '0 0 20px rgba(0,200,128,0.08)',
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(0,200,128,0.15)', border: '1px solid rgba(0,200,128,0.3)', fontSize: 18 }}
                  >
                    🌱
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: '#5eead4' }}>Start a Fundraiser</p>
                    <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>Schools, teams, nonprofits &amp; more</p>
                  </div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(94,234,212,0.6)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
            </div>

            {/* ── Platform impact stats ─────────────────────────────────────────── */}
            <div className="grid grid-cols-3 gap-2 mb-5" style={{ marginTop: 0 }}>
              {PLATFORM_STATS.map((s, i) => (
                <ImpactStatCard
                  key={s.label}
                  icon={s.icon}
                  label={s.label}
                  target={s.target}
                  prefix={s.prefix}
                  suffix={s.suffix}
                  duration={s.duration}
                  enabled={animate}
                  delay={120 + i * 60}
                />
              ))}
            </div>

            {/* ── Top Contributors link ─────────────────────────────────────────── */}
            <div className="flex justify-end mb-3" style={fade(180)}>
              <button
                onClick={() => navigate('/leaderboard')}
                className="flex items-center gap-1.5 text-xs font-semibold hover:opacity-70 transition-opacity"
                style={{ color: '#fbbf24', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                🏆 Top Contributors
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* ── Live Impact Counter ──────────────────────────────────────────── */}
            <LiveImpactCounter style={{ marginBottom: 20 }} />

            {/* ── Live donation ticker ─────────────────────────────────────────── */}
            <div className="mb-5" style={fade(260)}>
              {/* Header row */}
              <div className="flex items-center gap-2 mb-2.5">
                <div
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: '#ef4444', animation: 'liveDot 1.2s ease-in-out infinite' }}
                  />
                  <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: '#f87171' }}>Live</span>
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Community Support
                </span>
              </div>

              {/* Ticker card */}
              <div
                className="rounded-2xl px-4 py-3 flex items-center gap-3"
                style={{
                  background:  'rgba(255,255,255,0.05)',
                  border:      '1px solid rgba(0,190,255,0.13)',
                  opacity:     tickerVis ? 1 : 0,
                  transform:   tickerVis ? 'translateY(0)' : 'translateY(4px)',
                  transition:  'opacity 0.28s ease, transform 0.28s ease',
                }}
              >
                {/* Icon bubble */}
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.15)', fontSize: 16 }}
                >
                  {DONATION_TICKER[tickerIndex].icon}
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: '#ffffff' }}>
                    <span style={{ color: '#00c8ff' }}>{DONATION_TICKER[tickerIndex].name}</span>
                    {' '}{DONATION_TICKER[tickerIndex].action}
                    {DONATION_TICKER[tickerIndex].amount && (
                      <span style={{ color: '#5eead4', fontWeight: 700 }}> — {DONATION_TICKER[tickerIndex].amount}</span>
                    )}
                  </p>
                  <p className="text-[10px] truncate mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    {DONATION_TICKER[tickerIndex].cause}
                  </p>
                </div>

                {/* Dots indicator */}
                <div className="flex gap-1 shrink-0">
                  {DONATION_TICKER.map((_, i) => (
                    <span
                      key={i}
                      className="w-1 h-1 rounded-full"
                      style={{
                        background: i === tickerIndex ? '#00c8ff' : 'rgba(255,255,255,0.18)',
                        transition: 'background 0.3s ease',
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* ── You're Supporting pill ────────────────────────────────────────── */}
            <div className="mb-6" style={fade(320)}>
              <Link to={`/fundraisers/${activeFundraiser.id}`} className="block">
                <div
                  className="flex items-center gap-3 rounded-2xl px-4 py-3.5"
                  style={{
                    background: 'rgba(0,87,231,0.12)',
                    border:     '1px solid rgba(0,200,255,0.22)',
                    boxShadow:  '0 0 24px rgba(0,87,231,0.15)',
                  }}
                >
                  <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>
                    {activeFundraiser.emoji}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-widest mb-0.5" style={{ color: 'rgba(0,200,255,0.7)' }}>
                      You're now supporting
                    </p>
                    <p className="text-sm font-semibold truncate" style={{ color: '#ffffff' }}>
                      {activeFundraiser.name}
                    </p>
                  </div>
                  {/* Live dot */}
                  <div
                    className="shrink-0 w-2 h-2 rounded-full"
                    style={{
                      background: '#00c8ff',
                      boxShadow:  '0 0 8px rgba(0,200,255,0.8)',
                      animation:  'supportingPulse 2s ease-in-out infinite',
                    }}
                  />
                </div>
              </Link>
            </div>

            {/* ── Before / After ────────────────────────────────────────────────── */}
            <div className="mb-6" style={fade(360)}>
              {/* Section title */}
              <div className="flex items-center gap-2 mb-4">
                <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
                <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Before &amp; After Community Impact
                </span>
                <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
              </div>

              {/* Cards grid */}
              <div className="grid grid-cols-2 gap-3 mb-3">

                {/* Before */}
                <div
                  className="rounded-2xl p-4 flex flex-col"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border:     '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <span
                    className="self-start text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full mb-3"
                    style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.35)' }}
                  >
                    Before
                  </span>
                  <span style={{ fontSize: 26, lineHeight: 1, marginBottom: 8 }}>🗑️</span>
                  <p className="text-xs font-semibold mb-2.5" style={{ color: 'rgba(255,255,255,0.55)', lineHeight: 1.3 }}>
                    Recycling Without Funding
                  </p>
                  <ul className="flex flex-col gap-1.5">
                    {[
                      'Bags go unrewarded',
                      'Schools use old fundraisers',
                      'Communities miss value',
                    ].map((b) => (
                      <li key={b} className="flex items-start gap-1.5" style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', lineHeight: 1.4 }}>
                        <span style={{ color: 'rgba(255,255,255,0.18)', flexShrink: 0, marginTop: 1 }}>—</span>
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* After */}
                <div
                  className="rounded-2xl p-4 flex flex-col"
                  style={{
                    background: 'rgba(0,200,128,0.07)',
                    border:     '1px solid rgba(0,200,128,0.28)',
                    boxShadow:  '0 0 28px rgba(0,200,128,0.12)',
                  }}
                >
                  <span
                    className="self-start text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full mb-3"
                    style={{ background: 'rgba(0,200,128,0.18)', color: '#5eead4' }}
                  >
                    After
                  </span>
                  <span style={{ fontSize: 26, lineHeight: 1, marginBottom: 8 }}>♻️</span>
                  <p className="text-xs font-semibold mb-2.5" style={{ color: '#5eead4', lineHeight: 1.3 }}>
                    Recycling That Raises Money
                  </p>
                  <ul className="flex flex-col gap-1.5">
                    {[
                      'QR bags track real value',
                      'Teams and schools earn',
                      'Financial + eco impact',
                    ].map((b) => (
                      <li key={b} className="flex items-start gap-1.5" style={{ fontSize: 10, color: 'rgba(94,234,212,0.7)', lineHeight: 1.4 }}>
                        <span style={{ color: '#00c8ff', flexShrink: 0, fontWeight: 700, marginTop: 1 }}>✓</span>
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Connector pill */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
                <div
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                  style={{
                    background: 'rgba(0,87,231,0.14)',
                    border:     '1px solid rgba(0,200,255,0.2)',
                    color:      'rgba(0,200,255,0.75)',
                    fontSize:   10,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                  Recycling becomes funding
                </div>
                <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
              </div>
            </div>

            {/* Section label */}
            <div className="flex items-center gap-2 mb-4" style={fade(460)}>
              <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Active Campaigns
              </span>
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
            </div>

            {/* Cards */}
            <div className="flex flex-col gap-4">
              {demoFundraisers.map((f, i) => (
                <FundraiserCard key={f.id} fundraiser={f} delay={520 + i * 100} animate={animate} />
              ))}
            </div>

            {/* My fundraiser link */}
            <div className="mt-6" style={fade(520 + demoFundraisers.length * 100)}>
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

      <style>{`
        @keyframes celebFloat {
          0%   { transform: translateY(0)      scale(1);    opacity: 1; }
          15%  { opacity: 1; }
          100% { transform: translateY(-220px) scale(0.65); opacity: 0; }
        }
        @keyframes supportingPulse {
          0%, 100% { opacity: 1;   transform: scale(1);    box-shadow: 0 0 8px rgba(0,200,255,0.8); }
          50%       { opacity: 0.5; transform: scale(1.35); box-shadow: 0 0 16px rgba(0,200,255,0.4); }
        }
        @keyframes liveDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.3; transform: scale(0.7); }
        }
      `}</style>
    </>
  )
}
