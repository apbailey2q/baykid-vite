// app/my-fundraiser/page.tsx
'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  activeFundraiser,
  myFundraiserStats,
  typeAccent,
  pct,
  fmt,
} from '../../lib/demoFundraisers'

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({
  icon,
  label,
  value,
  sub,
  accent = false,
  delay   = 0,
  animate = false,
}: {
  icon:    string
  label:   string
  value:   string
  sub?:    string
  accent?: boolean
  delay?:  number
  animate: boolean
}) {
  return (
    <div
      className={`rounded-2xl p-4 border flex flex-col gap-1 ${
        accent
          ? 'bg-cyan-500/8 border-cyan-500/22'
          : 'bg-slate-900 border-slate-800'
      }`}
      style={{
        opacity:    animate ? 1 : 0,
        transform:  animate ? 'translateY(0) scale(1)' : 'translateY(10px) scale(0.97)',
        transition: `opacity 0.4s ease ${delay}ms, transform 0.4s ease ${delay}ms`,
      }}
    >
      <span className="text-xl">{icon}</span>
      <span
        className={`text-2xl font-bold leading-tight ${
          accent ? 'text-cyan-300' : 'text-white'
        }`}
      >
        {value}
      </span>
      <span className="text-xs text-slate-400">{label}</span>
      {sub && (
        <span className="text-[10px] text-slate-600">{sub}</span>
      )}
    </div>
  )
}

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
          <span className="text-slate-400 font-normal text-xs ml-1">raised</span>
        </span>
        <span className="text-slate-400 text-xs">${fmt(goal)} goal</span>
      </div>
      <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-teal-400 transition-all duration-[1200ms] ease-out"
          style={{ width: animate ? `${p}%` : '0%' }}
        />
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-xs font-semibold text-cyan-400">{p}% funded</span>
        <span className="text-xs text-slate-500">{activeFundraiser.supporters} supporters</span>
      </div>
    </div>
  )
}

// ── Activity row ──────────────────────────────────────────────────────────────
function ActivityRow({
  icon,
  label,
  time,
  amount,
}: {
  icon:   string
  label:  string
  time:   string
  amount: string
}) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-slate-800 last:border-0">
      <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-base shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-medium">{label}</p>
        <p className="text-xs text-slate-500">{time}</p>
      </div>
      <span className="text-sm font-semibold text-cyan-400 shrink-0">{amount}</span>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function MyFundraiserPage() {
  const [animate, setAnimate] = useState(false)

  useEffect(() => {
    const t = requestAnimationFrame(() => setAnimate(true))
    return () => cancelAnimationFrame(t)
  }, [])

  const fund   = activeFundraiser
  const stats  = myFundraiserStats
  const colors = typeAccent(fund.type)

  const fade = (delay = 0): React.CSSProperties => ({
    opacity:    animate ? 1 : 0,
    transform:  animate ? 'translateY(0)' : 'translateY(14px)',
    transition: `opacity 0.4s ease ${delay}ms, transform 0.4s ease ${delay}ms`,
  })

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="max-w-lg mx-auto px-4 pt-10 pb-28">

        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="mb-7" style={fade(0)}>
          <Link
            href="/fundraisers"
            className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white text-sm transition-colors mb-5 group"
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

          <h1 className="text-2xl font-bold text-white mb-1">My Fundraiser</h1>
          <p className="text-slate-400 text-sm">
            Track how your recycling supports your selected cause.
          </p>
        </div>

        {/* ── Active fundraiser chip ─────────────────────────────────────── */}
        <Link href={`/fundraisers/${fund.id}`}>
          <div
            className="flex items-center gap-3 bg-slate-900 border border-slate-800 hover:border-cyan-500/35 rounded-2xl p-4 mb-6 transition-all group"
            style={fade(60)}
          >
            <div className="w-11 h-11 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-2xl shrink-0">
              {fund.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <span
                className={`text-[10px] font-bold uppercase tracking-widest ${colors.text}`}
              >
                {fund.type}
              </span>
              <p className="text-white font-semibold text-sm leading-snug truncate group-hover:text-cyan-50 transition-colors">
                {fund.name}
              </p>
            </div>
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="rgba(148,163,184,0.5)" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"
              className="shrink-0 group-hover:stroke-cyan-400 transition-colors"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </div>
        </Link>

        {/* ── Stats grid ────────────────────────────────────────────────── */}
        <div className="mb-2" style={{ opacity: animate ? 1 : 0, transition: 'opacity 0.3s ease 80ms' }}>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-3">
            Your Contributions
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <StatCard
            icon="💵"
            label="Total Contributed"
            value={`$${stats.contributed.toFixed(2)}`}
            sub="Lifetime donations"
            accent
            delay={80}
            animate={animate}
          />
          <StatCard
            icon="♻️"
            label="Bags Recycled"
            value={String(stats.bagsRecycled)}
            sub="Supporting this cause"
            delay={140}
            animate={animate}
          />
          <StatCard
            icon="🌿"
            label="CO₂ Saved"
            value={`${stats.co2Saved} lbs`}
            sub="From landfills"
            delay={200}
            animate={animate}
          />
          <StatCard
            icon="⭐"
            label="Points Donated"
            value={stats.pointsDonated.toLocaleString()}
            sub="Toward the cause"
            delay={260}
            animate={animate}
          />
        </div>

        {/* ── Fundraiser progress ────────────────────────────────────────── */}
        <div
          className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-4"
          style={fade(320)}
        >
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-4">
            Campaign Progress
          </p>
          <ProgressBar raised={fund.raised} goal={fund.goal} animate={animate} />

          {/* Your share of raised */}
          <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Your contribution</p>
              <p className="text-lg font-bold text-cyan-400">
                ${stats.contributed.toFixed(2)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">of total raised</p>
              <p className="text-sm text-slate-300 font-semibold">
                ${fmt(fund.raised)}
              </p>
            </div>
          </div>
        </div>

        {/* ── Impact message ─────────────────────────────────────────────── */}
        <div
          className="bg-cyan-500/6 border border-cyan-500/18 rounded-2xl p-5 mb-4"
          style={fade(380)}
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl shrink-0">🏆</span>
            <div>
              <p className="text-sm font-semibold text-white mb-1">Your Impact</p>
              <p className="text-sm text-slate-300 leading-relaxed">
                Your recycling is helping fund uniforms, travel, equipment, and student support for the{' '}
                <span className="text-cyan-400 font-medium">{fund.name}</span>.
              </p>
              <p className="text-xs text-slate-500 mt-2">{fund.impact}</p>
            </div>
          </div>
        </div>

        {/* ── Recent activity ────────────────────────────────────────────── */}
        <div
          className="bg-slate-900 border border-slate-800 rounded-2xl px-5 py-4 mb-6"
          style={fade(420)}
        >
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1">
            Recent Activity
          </p>
          <ActivityRow
            icon="♻️"
            label="Bag CB-NASH-000421 scanned"
            time="Just now"
            amount="+$0.85"
          />
          <ActivityRow
            icon="♻️"
            label="Bag CB-NASH-000398 scanned"
            time="2 days ago"
            amount="+$0.85"
          />
          <ActivityRow
            icon="♻️"
            label="Bag CB-NASH-000371 scanned"
            time="5 days ago"
            amount="+$0.85"
          />
        </div>

        {/* ── CTAs ──────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3" style={fade(460)}>
          <Link
            href="/scan"
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-sm transition-all hover:shadow-lg hover:shadow-cyan-500/20 active:scale-[0.98]"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7V5a2 2 0 0 1 2-2h2" />
              <path d="M17 3h2a2 2 0 0 1 2 2v2" />
              <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
              <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
            </svg>
            Recycle Another Bag
          </Link>

          <Link
            href="/fundraisers"
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white text-sm font-medium transition-all"
          >
            Browse Fundraisers
          </Link>
        </div>

      </div>
    </div>
  )
}
