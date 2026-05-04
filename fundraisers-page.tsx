// app/fundraisers/page.tsx
// Drop this file into your Next.js App Router project at:
//   app/fundraisers/page.tsx
// Requires: Next.js 13+, Tailwind CSS

'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Fundraiser {
  id:          string
  name:        string
  type:        string
  goal:        number
  raised:      number
  supporters:  number
  emoji:       string
  description: string
}

// ── Mock data ─────────────────────────────────────────────────────────────────
const fundraisers: Fundraiser[] = [
  {
    id:          'fund-001',
    name:        'East Nashville High Basketball Team',
    type:        'School Team',
    goal:        5000,
    raised:      2150,
    supporters:  48,
    emoji:       '🏀',
    description: 'Help our team travel to the state championships this spring.',
  },
  {
    id:          'fund-002',
    name:        'Inglewood Community Garden',
    type:        'Community Program',
    goal:        3000,
    raised:      2760,
    supporters:  134,
    emoji:       '🌱',
    description: 'Growing fresh produce for over 200 Nashville families.',
  },
  {
    id:          'fund-003',
    name:        'Stratford STEM Robotics Club',
    type:        'School Program',
    goal:        2500,
    raised:      875,
    supporters:  29,
    emoji:       '🔬',
    description: 'Building the next generation of engineers and innovators.',
  },
  {
    id:          'fund-004',
    name:        'East Side Youth Soccer League',
    type:        'Youth Sports',
    goal:        4000,
    raised:      3200,
    supporters:  97,
    emoji:       '⚽',
    description: 'Uniforms and equipment for 6 youth teams, ages 6–14.',
  },
  {
    id:          'fund-005',
    name:        'Antioch Senior Center Arts Program',
    type:        'Community Program',
    goal:        1800,
    raised:      540,
    supporters:  21,
    emoji:       '🎨',
    description: 'Weekly art classes for seniors in the Antioch neighborhood.',
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
function pct(raised: number, goal: number) {
  return Math.min(Math.round((raised / goal) * 100), 100)
}

function fmt(n: number) {
  return n.toLocaleString('en-US')
}

// Returns a color pair [text, bg] based on fundraiser type
function typeColor(type: string): { text: string; bg: string; border: string } {
  switch (type) {
    case 'School Team':
      return { text: 'text-cyan-300',    bg: 'bg-cyan-400/10',    border: 'border-cyan-400/25'   }
    case 'School Program':
      return { text: 'text-violet-300',  bg: 'bg-violet-400/10',  border: 'border-violet-400/25' }
    case 'Community Program':
      return { text: 'text-teal-300',    bg: 'bg-teal-400/10',    border: 'border-teal-400/25'   }
    case 'Youth Sports':
      return { text: 'text-sky-300',     bg: 'bg-sky-400/10',     border: 'border-sky-400/25'    }
    default:
      return { text: 'text-slate-300',   bg: 'bg-slate-400/10',   border: 'border-slate-400/25'  }
  }
}

// ── Progress bar ──────────────────────────────────────────────────────────────
function ProgressBar({
  raised,
  goal,
  animate,
}: {
  raised: number
  goal:   number
  animate: boolean
}) {
  const p = pct(raised, goal)

  return (
    <div>
      {/* Amounts */}
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-sm font-semibold text-white">
          ${fmt(raised)}
          <span className="text-xs font-normal text-slate-400 ml-1">raised</span>
        </span>
        <span className="text-xs text-slate-500">
          ${fmt(goal)} goal
        </span>
      </div>

      {/* Track */}
      <div className="relative h-2 bg-slate-800 rounded-full overflow-hidden">
        {/* Filled portion */}
        <div
          className="absolute inset-y-0 left-0 rounded-full
                     bg-gradient-to-r from-cyan-500 to-teal-400
                     transition-all duration-[1200ms] ease-out"
          style={{ width: animate ? `${p}%` : '0%' }}
        />
        {/* Shimmer */}
        {animate && p < 100 && (
          <div
            className="absolute inset-y-0 rounded-full opacity-60"
            style={{
              left:       `calc(${p}% - 24px)`,
              width:      24,
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
              animation:  'shimmer 2s ease-in-out infinite',
            }}
          />
        )}
      </div>

      {/* Percentage */}
      <div className="flex items-center gap-1.5 mt-1.5">
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

// ── Fundraiser Card ───────────────────────────────────────────────────────────
function FundraiserCard({
  fundraiser,
  animateIndex,
  animate,
}: {
  fundraiser:   Fundraiser
  animateIndex: number
  animate:      boolean
}) {
  const colors = typeColor(fundraiser.type)
  const p      = pct(fundraiser.raised, fundraiser.goal)

  return (
    <Link
      href={`/fundraisers/${fundraiser.id}`}
      className="group block"
      style={{
        opacity:   animate ? 1 : 0,
        transform: animate ? 'translateY(0)' : 'translateY(16px)',
        transition: `opacity 0.4s ease ${animateIndex * 80}ms,
                     transform 0.4s ease ${animateIndex * 80}ms`,
      }}
    >
      <div
        className="
          relative bg-slate-900 border border-slate-800 rounded-2xl p-5
          hover:border-cyan-500/35 hover:bg-slate-900/70
          transition-all duration-300
          hover:shadow-xl hover:shadow-cyan-950/60
          active:scale-[0.99]
        "
      >
        {/* Subtle top-edge glow on hover */}
        <div
          className="
            absolute inset-x-0 top-0 h-px rounded-t-2xl
            bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent
            opacity-0 group-hover:opacity-100 transition-opacity duration-300
          "
        />

        {/* ── Top row: type badge + supporters ──────────────────────────── */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <span
              className="text-2xl leading-none"
              role="img"
              aria-label={fundraiser.type}
            >
              {fundraiser.emoji}
            </span>
            <span
              className={`
                text-[10px] font-bold uppercase tracking-widest px-2 py-0.5
                rounded-full border ${colors.text} ${colors.bg} ${colors.border}
              `}
            >
              {fundraiser.type}
            </span>
          </div>

          <div className="flex items-center gap-1 bg-slate-800/80 border border-slate-700/60 px-2.5 py-1 rounded-full">
            <svg
              width="10" height="10" viewBox="0 0 24 24"
              fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className="text-slate-400 shrink-0"
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span className="text-[11px] text-slate-400 font-medium">
              {fundraiser.supporters}
            </span>
          </div>
        </div>

        {/* ── Name ─────────────────────────────────────────────────────── */}
        <h3 className="text-white font-semibold text-[15px] leading-snug mb-1 group-hover:text-cyan-50 transition-colors duration-200">
          {fundraiser.name}
        </h3>
        <p className="text-slate-500 text-xs leading-relaxed mb-4">
          {fundraiser.description}
        </p>

        {/* ── Progress ──────────────────────────────────────────────────── */}
        <ProgressBar raised={fundraiser.raised} goal={fundraiser.goal} animate={animate} />

        {/* ── Divider ───────────────────────────────────────────────────── */}
        <div className="h-px bg-slate-800 my-4" />

        {/* ── CTA button ────────────────────────────────────────────────── */}
        <div
          className="
            w-full flex items-center justify-center gap-2
            bg-cyan-500 hover:bg-cyan-400
            text-slate-950 text-sm font-semibold
            py-2.5 rounded-xl
            transition-colors duration-200
            group-hover:bg-cyan-400
          "
        >
          View Fundraiser
          <svg
            width="14" height="14" viewBox="0 0 24 24"
            fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          >
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </div>

        {/* Completion ribbon */}
        {p >= 100 && (
          <div className="absolute top-3 right-3 bg-teal-500 text-white text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full shadow-lg shadow-teal-900/50">
            Goal Met ✓
          </div>
        )}
      </div>
    </Link>
  )
}

// ── Summary strip ─────────────────────────────────────────────────────────────
function SummaryStrip() {
  const totalRaised     = fundraisers.reduce((s, f) => s + f.raised, 0)
  const totalSupporters = fundraisers.reduce((s, f) => s + f.supporters, 0)

  return (
    <div className="flex gap-3 mb-8">
      {[
        { label: 'Active Fundraisers', value: String(fundraisers.length) },
        { label: 'Total Raised',       value: `$${fmt(totalRaised)}`     },
        { label: 'Supporters',         value: String(totalSupporters)     },
      ].map((stat) => (
        <div
          key={stat.label}
          className="flex-1 bg-slate-900 border border-slate-800 rounded-xl p-3 text-center"
        >
          <div className="text-base font-bold text-white">{stat.value}</div>
          <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">{stat.label}</div>
        </div>
      ))}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function FundraisersPage() {
  const [animate, setAnimate] = useState(false)

  // Trigger entrance animations after mount
  useEffect(() => {
    const t = requestAnimationFrame(() => setAnimate(true))
    return () => cancelAnimationFrame(t)
  }, [])

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Keyframes injected inline — works in Next.js App Router */}
      <style>{`
        @keyframes shimmer {
          0%   { opacity: 0; }
          50%  { opacity: 0.6; }
          100% { opacity: 0; }
        }
      `}</style>

      <div className="max-w-lg mx-auto px-4 pt-12 pb-28">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div
          className="mb-7"
          style={{
            opacity:    animate ? 1 : 0,
            transform:  animate ? 'translateY(0)' : 'translateY(-10px)',
            transition: 'opacity 0.35s ease, transform 0.35s ease',
          }}
        >
          <div className="flex items-center gap-2.5 mb-1">
            {/* Recycling icon */}
            <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/25 flex items-center justify-center shrink-0">
              <svg
                width="18" height="18" viewBox="0 0 24 24"
                fill="none" stroke="#22d3ee"
                strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
              >
                <path d="M7 19H4.815a1.83 1.83 0 0 1-1.57-.881 1.785 1.785 0 0 1-.004-1.784L7.196 9.5" />
                <path d="M11 19h8.203a1.83 1.83 0 0 0 1.556-.89 1.784 1.784 0 0 0 0-1.775l-1.226-2.12" />
                <path d="m14 16 3 3-3 3" />
                <path d="M8.293 13.596 7.196 9.5 3.1 10.598" />
                <path d="m9.344 5.811 1.093-1.892A1.83 1.83 0 0 1 11.985 3a1.784 1.784 0 0 1 1.546.888l3.943 6.843" />
                <path d="m13.378 9.633 4.096 1.098 1.097-4.096" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white leading-tight">Fundraisers</h1>
              <p className="text-xs text-slate-400">Cyan's Brooklynn Recycling Enterprise</p>
            </div>
          </div>
          <p className="text-slate-400 text-sm mt-3">
            Support your community while recycling.{' '}
            <span className="text-cyan-400">Every bag counts.</span>
          </p>
        </div>

        {/* ── Summary strip ───────────────────────────────────────────────── */}
        <div
          style={{
            opacity:    animate ? 1 : 0,
            transform:  animate ? 'translateY(0)' : 'translateY(8px)',
            transition: 'opacity 0.4s ease 80ms, transform 0.4s ease 80ms',
          }}
        >
          <SummaryStrip />
        </div>

        {/* ── Section label ───────────────────────────────────────────────── */}
        <div
          className="flex items-center gap-2 mb-4"
          style={{
            opacity:    animate ? 1 : 0,
            transition: 'opacity 0.4s ease 160ms',
          }}
        >
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Active Campaigns
          </span>
          <div className="flex-1 h-px bg-slate-800" />
        </div>

        {/* ── Cards ───────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          {fundraisers.map((f, i) => (
            <FundraiserCard
              key={f.id}
              fundraiser={f}
              animateIndex={i}
              animate={animate}
            />
          ))}
        </div>

        {/* ── Footer note ─────────────────────────────────────────────────── */}
        <p
          className="text-center text-xs text-slate-600 mt-10"
          style={{
            opacity:    animate ? 1 : 0,
            transition: `opacity 0.5s ease ${fundraisers.length * 80 + 300}ms`,
          }}
        >
          Recycling one bag supports your chosen fundraiser.
        </p>
      </div>
    </div>
  )
}
