// app/fundraisers/[id]/page.tsx
'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  demoFundraisers,
  typeAccent,
  pct,
  fmt,
  type Fundraiser,
} from '../../../lib/demoFundraisers'

// ── Progress bar ──────────────────────────────────────────────────────────────
function ProgressBar({
  raised,
  goal,
  animate,
}: {
  raised:  number
  goal:    number
  animate: boolean
}) {
  const p = pct(raised, goal)
  return (
    <div>
      <div className="flex justify-between text-sm mb-2">
        <span className="font-semibold text-white">
          ${fmt(raised)}
          <span className="text-slate-400 font-normal ml-1 text-xs">raised</span>
        </span>
        <span className="text-slate-400 text-xs">${fmt(goal)} goal</span>
      </div>
      <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-teal-400 transition-all duration-[1200ms] ease-out"
          style={{ width: animate ? `${p}%` : '0%' }}
        />
      </div>
      <div className="flex items-center gap-2 mt-1.5">
        <span className="text-xs font-semibold text-cyan-400">{p}% funded</span>
        {p >= 80 && (
          <span className="text-[10px] font-medium text-teal-300 bg-teal-400/10 border border-teal-400/25 px-1.5 py-px rounded-full">
            Almost there!
          </span>
        )}
      </div>
    </div>
  )
}

// ── Stat pill ─────────────────────────────────────────────────────────────────
function StatPill({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 bg-slate-800/70 border border-slate-700/50 px-3 py-1.5 rounded-full">
      <span className="text-sm">{icon}</span>
      <span className="text-xs text-slate-300 font-medium">{label}</span>
    </div>
  )
}

// ── Info card ─────────────────────────────────────────────────────────────────
function InfoCard({
  icon,
  title,
  body,
  accent = false,
}: {
  icon:    string
  title:   string
  body:    string
  accent?: boolean
}) {
  return (
    <div
      className={`rounded-2xl p-4 border ${
        accent
          ? 'bg-cyan-500/5 border-cyan-500/20'
          : 'bg-slate-900 border-slate-800'
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{icon}</span>
        <span
          className={`text-xs font-semibold uppercase tracking-wider ${
            accent ? 'text-cyan-400' : 'text-slate-400'
          }`}
        >
          {title}
        </span>
      </div>
      <p className="text-sm text-slate-300 leading-relaxed">{body}</p>
    </div>
  )
}

// ── Not found state ───────────────────────────────────────────────────────────
function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-6 text-center">
      <span className="text-5xl mb-4">♻️</span>
      <h2 className="text-white font-semibold text-lg mb-2">Fundraiser not found</h2>
      <p className="text-slate-400 text-sm mb-6">
        This fundraiser may have ended or the link is incorrect.
      </p>
      <Link
        href="/fundraisers"
        className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors"
      >
        Browse Fundraisers
      </Link>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function FundraiserDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const [animate, setAnimate] = useState(false)
  const [joined,  setJoined]  = useState(false)

  useEffect(() => {
    const t = requestAnimationFrame(() => setAnimate(true))
    return () => cancelAnimationFrame(t)
  }, [])

  const fundraiser: Fundraiser | undefined = demoFundraisers.find(
    (f) => f.id === params.id
  )

  if (!fundraiser) return <NotFound />

  const colors = typeAccent(fundraiser.type)
  const p      = pct(fundraiser.raised, fundraiser.goal)

  const fade = (delay = 0): React.CSSProperties => ({
    opacity:    animate ? 1 : 0,
    transform:  animate ? 'translateY(0)' : 'translateY(14px)',
    transition: `opacity 0.4s ease ${delay}ms, transform 0.4s ease ${delay}ms`,
  })

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="max-w-lg mx-auto px-4 pt-10 pb-28">

        {/* ── Back link ─────────────────────────────────────────────────── */}
        <div style={fade(0)}>
          <Link
            href="/fundraisers"
            className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white text-sm transition-colors mb-6 group"
          >
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round"
              className="group-hover:-translate-x-0.5 transition-transform"
            >
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            Fundraisers
          </Link>
        </div>

        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <div className="mb-6" style={fade(60)}>
          <div className="flex items-start gap-4 mb-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-3xl shrink-0">
              {fundraiser.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <span
                className={`inline-block text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border mb-2 ${colors.text} ${colors.bg} ${colors.border}`}
              >
                {fundraiser.type}
              </span>
              <h1 className="text-xl font-bold text-white leading-snug">
                {fundraiser.name}
              </h1>
            </div>
          </div>

          {/* Pills row */}
          <div className="flex flex-wrap gap-2">
            <StatPill icon="👥" label={`${fundraiser.supporters} supporters`} />
            <StatPill icon="♻️" label={`${fundraiser.percentToCause}% goes to cause`} />
            <StatPill icon="📍" label="Nashville, TN" />
          </div>
        </div>

        {/* ── Progress card ─────────────────────────────────────────────── */}
        <div
          className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-4"
          style={fade(120)}
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Campaign Progress
            </span>
            <span className="text-xs text-slate-400">
              {fmt(fundraiser.supporters)} supporters
            </span>
          </div>
          <ProgressBar raised={fundraiser.raised} goal={fundraiser.goal} animate={animate} />

          {/* Mini milestone indicators */}
          <div className="flex justify-between mt-4 pt-4 border-t border-slate-800">
            {[25, 50, 75, 100].map((milestone) => (
              <div key={milestone} className="flex flex-col items-center gap-1">
                <div
                  className={`w-2 h-2 rounded-full transition-all duration-700 ${
                    p >= milestone ? 'bg-cyan-400' : 'bg-slate-700'
                  }`}
                />
                <span
                  className={`text-[10px] ${
                    p >= milestone ? 'text-cyan-400' : 'text-slate-600'
                  }`}
                >
                  {milestone}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Description + Impact ──────────────────────────────────────── */}
        <div className="flex flex-col gap-3 mb-4" style={fade(180)}>
          <InfoCard
            icon="📋"
            title="About this fundraiser"
            body={fundraiser.description}
          />
          <InfoCard
            icon="🌍"
            title="Your impact"
            body={fundraiser.impact}
            accent
          />
        </div>

        {/* ── Cause breakdown ───────────────────────────────────────────── */}
        <div
          className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-6"
          style={fade(240)}
        >
          <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-3">
            Per-bag earnings split
          </p>
          <div className="flex items-center gap-3">
            {/* You */}
            <div className="flex-1 bg-slate-800/60 rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-white">
                {100 - fundraiser.percentToCause}%
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">You keep</div>
            </div>
            {/* Arrow */}
            <div className="text-slate-600 text-lg">⇄</div>
            {/* Cause */}
            <div className="flex-1 bg-cyan-500/8 border border-cyan-500/20 rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-cyan-400">
                {fundraiser.percentToCause}%
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Fundraiser</div>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 text-center mt-3">
            Every bag you scan contributes {fundraiser.percentToCause}% of earnings to this cause.
          </p>
        </div>

        {/* ── CTAs ──────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3" style={fade(300)}>
          {/* Join / Joined */}
          <button
            onClick={() => setJoined(true)}
            className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-sm transition-all duration-300 ${
              joined
                ? 'bg-teal-500/15 border border-teal-500/40 text-teal-300 cursor-default'
                : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 hover:shadow-lg hover:shadow-cyan-500/20 active:scale-[0.98]'
            }`}
          >
            {joined ? (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Fundraiser Joined
              </>
            ) : (
              <>
                ♻️ Join Fundraiser
              </>
            )}
          </button>

          {/* Dashboard link */}
          <Link
            href="/my-fundraiser"
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-slate-700 text-slate-300 hover:border-slate-600 hover:text-white text-sm font-medium transition-all"
          >
            View My Fundraiser Dashboard
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

      </div>
    </div>
  )
}
