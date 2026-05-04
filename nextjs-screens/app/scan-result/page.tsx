// app/scan-result/page.tsx
'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  activeFundraiser,
  demoScanRewardSplit,
} from '../../lib/demoFundraisers'

// ── Metric pill ───────────────────────────────────────────────────────────────
function MetricBadge({
  icon,
  label,
  value,
  accent = false,
}: {
  icon:    string
  label:   string
  value:   string
  accent?: boolean
}) {
  return (
    <div
      className={`flex-1 flex flex-col items-center gap-1 rounded-2xl p-3 border ${
        accent
          ? 'bg-cyan-500/8 border-cyan-500/25'
          : 'bg-slate-900 border-slate-800'
      }`}
    >
      <span className="text-xl">{icon}</span>
      <span className={`text-base font-bold ${accent ? 'text-cyan-300' : 'text-white'}`}>
        {value}
      </span>
      <span className="text-[10px] text-slate-500 text-center leading-tight">{label}</span>
    </div>
  )
}

// ── Divider line ──────────────────────────────────────────────────────────────
function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 my-5">
      <div className="flex-1 h-px bg-slate-800" />
      <span className="text-[10px] text-slate-600 uppercase tracking-widest font-semibold">
        {label}
      </span>
      <div className="flex-1 h-px bg-slate-800" />
    </div>
  )
}

// ── Section label ─────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-3">
      {children}
    </p>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ScanResultPage() {
  const [animate, setAnimate] = useState(false)
  const [barAnimate, setBarAnimate] = useState(false)

  useEffect(() => {
    const t = requestAnimationFrame(() => setAnimate(true))
    // Stagger bar animation slightly
    const b = setTimeout(() => setBarAnimate(true), 300)
    return () => {
      cancelAnimationFrame(t)
      clearTimeout(b)
    }
  }, [])

  const scan = demoScanRewardSplit
  const fund = activeFundraiser

  const userPct       = Math.round((scan.userAmount / scan.totalEarnings) * 100)
  const fundraiserPct = Math.round((scan.fundraiserAmount / scan.totalEarnings) * 100)

  const fade = (delay = 0): React.CSSProperties => ({
    opacity:    animate ? 1 : 0,
    transform:  animate ? 'translateY(0)' : 'translateY(14px)',
    transition: `opacity 0.4s ease ${delay}ms, transform 0.4s ease ${delay}ms`,
  })

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="max-w-lg mx-auto px-4 pt-10 pb-28">

        {/* ── Confirmed badge ────────────────────────────────────────────── */}
        <div className="flex flex-col items-center text-center mb-8" style={fade(0)}>
          {/* Animated checkmark ring */}
          <div
            className="w-20 h-20 rounded-full border-2 border-cyan-500/60 bg-cyan-500/10 flex items-center justify-center mb-4"
            style={{
              boxShadow:  '0 0 32px rgba(6,182,212,0.25)',
              animation:  animate ? 'ringPulse 2s ease-in-out infinite' : 'none',
            }}
          >
            <svg
              width="32" height="32" viewBox="0 0 24 24" fill="none"
              stroke="#22d3ee" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Scan Complete!</h1>
          <p className="text-slate-400 text-sm">Your bag has been verified and credited.</p>
        </div>

        {/* ── Bag ID card ────────────────────────────────────────────────── */}
        <div
          className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4 flex items-center gap-4"
          style={fade(60)}
        >
          <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
            <svg
              width="22" height="22" viewBox="0 0 24 24" fill="none"
              stroke="#94a3b8" strokeWidth="1.8"
              strokeLinecap="round" strokeLinejoin="round"
            >
              <rect width="5" height="5" x="3" y="3" rx="1" />
              <rect width="5" height="5" x="16" y="3" rx="1" />
              <rect width="5" height="5" x="3" y="16" rx="1" />
              <path d="M21 16h-3a2 2 0 0 0-2 2v3" />
              <path d="M21 21v.01" />
              <path d="M12 7v3a2 2 0 0 1-2 2H7" />
              <path d="M3 12h.01" />
              <path d="M12 3h.01" />
              <path d="M12 16v.01" />
              <path d="M16 12h1" />
              <path d="M21 12v.01" />
              <path d="M12 21v-1" />
            </svg>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-0.5">
              Bag ID
            </p>
            <p className="text-white font-mono font-semibold text-base">{scan.bagId}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Verified · Just now</p>
          </div>
        </div>

        {/* ── Total earnings + impact metrics ───────────────────────────── */}
        <div style={fade(120)}>
          <SectionLabel>Impact Summary</SectionLabel>
          <div className="flex gap-2 mb-4">
            <MetricBadge
              icon="💰"
              label="Total Earnings"
              value={`$${scan.totalEarnings.toFixed(2)}`}
            />
            <MetricBadge
              icon="🌿"
              label="CO₂ Saved"
              value={`${scan.co2Saved} lbs`}
              accent
            />
            <MetricBadge
              icon="⭐"
              label="Points Earned"
              value={scan.pointsEarned.toLocaleString()}
            />
          </div>
        </div>

        <Divider label="Earnings Breakdown" />

        {/* ── Split card ────────────────────────────────────────────────── */}
        <div
          className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden mb-4"
          style={fade(200)}
        >
          {/* Header */}
          <div className="px-5 pt-4 pb-3 border-b border-slate-800">
            <p className="text-sm font-semibold text-white">Earnings split</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Your recycling funds both your account and your fundraiser.
            </p>
          </div>

          {/* Visual split bar */}
          <div className="px-5 py-4 border-b border-slate-800">
            <div className="flex h-3 rounded-full overflow-hidden gap-px bg-slate-800">
              <div
                className="bg-gradient-to-r from-slate-400 to-slate-300 rounded-l-full transition-all duration-[1000ms] ease-out"
                style={{ width: barAnimate ? `${userPct}%` : '0%' }}
              />
              <div
                className="bg-gradient-to-r from-cyan-500 to-teal-400 rounded-r-full transition-all duration-[1000ms] ease-out delay-200"
                style={{ width: barAnimate ? `${fundraiserPct}%` : '0%' }}
              />
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-[10px] text-slate-400">You {userPct}%</span>
              <span className="text-[10px] text-cyan-400">Fundraiser {fundraiserPct}%</span>
            </div>
          </div>

          {/* Line items */}
          {[
            {
              label:  'You keep',
              value:  `$${scan.userAmount.toFixed(2)}`,
              sub:    `${userPct}% of total`,
              icon:   '👤',
              accent: false,
            },
            {
              label:  'Fundraiser receives',
              value:  `$${scan.fundraiserAmount.toFixed(2)}`,
              sub:    `${fundraiserPct}% of total`,
              icon:   '♻️',
              accent: true,
            },
          ].map((row) => (
            <div
              key={row.label}
              className={`flex items-center justify-between px-5 py-3.5 ${
                row.accent ? 'bg-cyan-500/5' : ''
              } border-b border-slate-800 last:border-0`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center text-sm">
                  {row.icon}
                </div>
                <div>
                  <p className="text-sm text-white font-medium">{row.label}</p>
                  <p className="text-[11px] text-slate-500">{row.sub}</p>
                </div>
              </div>
              <span
                className={`text-base font-bold ${
                  row.accent ? 'text-cyan-400' : 'text-white'
                }`}
              >
                {row.value}
              </span>
            </div>
          ))}
        </div>

        <Divider label="Fundraiser Contribution" />

        {/* ── Fundraiser contribution card ──────────────────────────────── */}
        <div
          className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-6"
          style={fade(280)}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-2xl shrink-0">
              {fund.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-cyan-400 font-semibold uppercase tracking-wider mb-0.5">
                Your Active Fundraiser
              </p>
              <p className="text-white font-semibold text-sm leading-snug truncate">
                {fund.name}
              </p>
            </div>
          </div>

          {/* Contribution highlight */}
          <div className="flex items-center justify-between bg-cyan-500/8 border border-cyan-500/20 rounded-xl px-4 py-3 mb-4">
            <div>
              <p className="text-xs text-slate-400">This scan contributed</p>
              <p className="text-2xl font-bold text-cyan-400">
                ${scan.fundraiserAmount.toFixed(2)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400">Points donated</p>
              <p className="text-lg font-bold text-teal-300">
                +{Math.round(scan.pointsEarned * (fund.percentToCause / 100))}
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-500 text-center">
            {fund.impact}
          </p>
        </div>

        {/* ── CTAs ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3" style={fade(340)}>
          <Link
            href="/my-fundraiser"
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-sm transition-all hover:shadow-lg hover:shadow-cyan-500/20 active:scale-[0.98]"
          >
            View Fundraiser Impact
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>

          <Link
            href="/scan"
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white text-sm font-medium transition-all"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7V5a2 2 0 0 1 2-2h2" />
              <path d="M17 3h2a2 2 0 0 1 2 2v2" />
              <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
              <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
              <rect width="7" height="5" x="7" y="7" rx="1" />
              <rect width="7" height="5" x="7" y="12" rx="1" />
            </svg>
            Scan Another Bag
          </Link>
        </div>

      </div>

      <style>{`
        @keyframes ringPulse {
          0%, 100% { box-shadow: 0 0 32px rgba(6,182,212,0.25); }
          50%       { box-shadow: 0 0 48px rgba(6,182,212,0.45); }
        }
      `}</style>
    </div>
  )
}
