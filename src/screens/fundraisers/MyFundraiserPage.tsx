import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import FundraiserCountdown from '../../components/FundraiserCountdown'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { typeAccent, pctFunded, fmtNum } from '../../lib/fundraisers'

// ── Types ──────────────────────────────────────────────────────────────────────

type FundraiserRow = {
  id:              string
  name:            string
  organization:    string | null
  status:          string
  goal_amount:     number
  raised_amount:   number
  bag_count:       number
  percent_to_cause: number
  start_date:      string | null
  end_date:        string | null
  city:            string | null
}

type MemberRow = {
  id:              string
  bags_donated:    number
  cash_donated:    number
  recycling_value: number
  joined_at:       string
  fundraisers:     FundraiserRow | null
}

type DonationRow = {
  id:         string
  amount:     number
  created_at: string
  notes:      string | null
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function ProgressBar({ raised, goal, supporters, animate }: { raised: number; goal: number; supporters: number; animate: boolean }) {
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
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-xs font-semibold" style={{ color: '#00c8ff' }}>{p}% funded</span>
        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{supporters} supporters</span>
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function MyFundraiserPage() {
  const navigate    = useNavigate()
  const { user }    = useAuthStore()
  const [animate, setAnimate] = useState(false)

  useEffect(() => {
    const t = requestAnimationFrame(() => setAnimate(true))
    return () => cancelAnimationFrame(t)
  }, [])

  const fade = (delay = 0): React.CSSProperties => ({
    opacity:    animate ? 1 : 0,
    transform:  animate ? 'translateY(0)' : 'translateY(14px)',
    transition: `opacity 0.4s ease ${delay}ms, transform 0.4s ease ${delay}ms`,
  })

  const { data: membership, isLoading } = useQuery({
    queryKey: ['my-fundraiser', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('fundraiser_members')
        .select('id, bags_donated, cash_donated, recycling_value, joined_at, fundraisers(id, name, organization, status, goal_amount, raised_amount, bag_count, percent_to_cause, start_date, end_date, city)')
        .eq('user_id', user!.id)
        .order('joined_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      return (data as unknown as MemberRow) ?? null
    },
    enabled: !!user,
  })

  const { data: recentDonations = [] } = useQuery({
    queryKey: ['my-donations', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('wallet_transactions')
        .select('id, amount, created_at, notes')
        .eq('user_id', user!.id)
        .eq('type', 'donation')
        .order('created_at', { ascending: false })
        .limit(5)
      return (data ?? []) as DonationRow[]
    },
    enabled: !!user,
  })

  const fund   = membership?.fundraisers ?? null
  const colors = fund ? typeAccent(fund.organization ?? '') : typeAccent('')

  const stats = {
    contributed:   membership?.cash_donated    ?? 0,
    bagsRecycled:  membership?.bags_donated    ?? 0,
    co2Saved:      Math.round((membership?.bags_donated ?? 0) * 4.2),
    pointsDonated: (membership?.bags_donated ?? 0) * 291,
  }

  const statCards = [
    { icon: '💵', label: 'Total Contributed', value: `$${stats.contributed.toFixed(2)}`, sub: 'Lifetime donations', accent: true },
    { icon: '♻️', label: 'Bags Recycled',     value: String(stats.bagsRecycled),          sub: 'Supporting this cause', accent: false },
    { icon: '🌿', label: 'CO₂ Saved',         value: `${stats.co2Saved} lbs`,             sub: 'From landfills',       accent: false },
    { icon: '⭐', label: 'Points Donated',    value: stats.pointsDonated.toLocaleString(), sub: 'Toward the cause',    accent: false },
  ]

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

          {/* Header */}
          <div className="mb-7" style={fade(0)}>
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 text-sm mb-5 transition-opacity hover:opacity-70"
              style={{ color: 'rgba(255,255,255,0.45)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 5l-7 7 7 7" />
              </svg>
              Fundraisers
            </button>
            <h1 className="text-2xl font-bold mb-1" style={{ color: '#ffffff' }}>My Fundraiser</h1>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Track how your recycling supports your selected cause.
            </p>
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="flex justify-center py-12">
              <div className="h-7 w-7 animate-spin rounded-full border-4 border-t-transparent" style={{ borderColor: '#00c8ff', borderTopColor: 'transparent' }} />
            </div>
          )}

          {/* No fundraiser joined */}
          {!isLoading && !fund && (
            <div style={fade(40)}>
              <div
                className="rounded-2xl p-8 text-center mb-6"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(0,190,255,0.15)' }}
              >
                <p style={{ fontSize: 36, marginBottom: 12 }}>🌱</p>
                <p className="text-base font-semibold mb-2" style={{ color: '#ffffff' }}>No fundraiser yet</p>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  Join a fundraiser to track your contributions and see your recycling impact.
                </p>
              </div>
              <Link
                to="/fundraisers"
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-sm"
                style={{ background: 'linear-gradient(135deg, #0057e7, #00c8ff)', color: '#ffffff' }}
              >
                Browse Fundraisers
              </Link>
            </div>
          )}

          {/* Fundraiser found */}
          {!isLoading && fund && (
            <>
              {/* Active fundraiser chip */}
              <Link to={`/live-fundraisers/${fund.id}`}>
                <div
                  className="flex items-center gap-3 rounded-2xl p-4 mb-6 transition-all"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(0,190,255,0.15)', ...fade(60) }}
                >
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', fontSize: 22 }}
                  >
                    🌱
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-widest block mb-0.5" style={{ color: colors.text }}>
                      {fund.organization ?? 'Fundraiser'}
                    </span>
                    <p className="text-sm font-semibold truncate mb-1.5" style={{ color: '#ffffff' }}>{fund.name}</p>
                    {fund.end_date && <FundraiserCountdown endDate={fund.end_date} compact />}
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>

              {/* Section label */}
              <div style={{ opacity: animate ? 1 : 0, transition: 'opacity 0.3s ease 80ms', marginBottom: 12 }}>
                <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Your Contributions
                </p>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                {statCards.map((s, i) => (
                  <div
                    key={s.label}
                    className="rounded-2xl p-4 flex flex-col gap-1"
                    style={{
                      background: s.accent ? 'rgba(0,200,255,0.08)' : 'rgba(255,255,255,0.06)',
                      border: s.accent ? '1px solid rgba(0,200,255,0.22)' : '1px solid rgba(0,190,255,0.15)',
                      ...fade(80 + i * 60),
                    }}
                  >
                    <span style={{ fontSize: 20 }}>{s.icon}</span>
                    <span className="text-2xl font-bold leading-tight" style={{ color: s.accent ? '#00c8ff' : '#ffffff' }}>
                      {s.value}
                    </span>
                    <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{s.label}</span>
                    <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>{s.sub}</span>
                  </div>
                ))}
              </div>

              {/* Campaign progress */}
              <div
                className="rounded-2xl p-5 mb-4"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(0,190,255,0.15)', ...fade(320) }}
              >
                <p className="text-[11px] font-semibold uppercase tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Campaign Progress
                </p>
                <ProgressBar raised={fund.raised_amount} goal={fund.goal_amount} supporters={fund.bag_count} animate={animate} />
                <div className="flex items-center justify-between mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                  <div>
                    <p className="text-xs mb-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Your contribution</p>
                    <p className="text-lg font-bold" style={{ color: '#00c8ff' }}>${stats.contributed.toFixed(2)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs mb-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>of total raised</p>
                    <p className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.7)' }}>${fmtNum(fund.raised_amount)}</p>
                  </div>
                </div>
              </div>

              {/* Impact callout */}
              <div
                className="rounded-2xl p-5 mb-4"
                style={{ background: 'rgba(0,200,255,0.06)', border: '1px solid rgba(0,200,255,0.18)', ...fade(380) }}
              >
                <div className="flex items-start gap-3">
                  <span style={{ fontSize: 22, flexShrink: 0 }}>🏆</span>
                  <div>
                    <p className="text-sm font-semibold mb-1" style={{ color: '#ffffff' }}>Your Impact</p>
                    <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>
                      Your recycling is helping fund{' '}
                      <span style={{ color: '#00c8ff', fontWeight: 500 }}>{fund.name}</span>.
                    </p>
                    {fund.city && (
                      <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.35)' }}>{fund.city}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Recent activity */}
              <div
                className="rounded-2xl px-5 py-4 mb-6"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(0,190,255,0.15)', ...fade(420) }}
              >
                <p className="text-[11px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Recent Activity
                </p>
                {recentDonations.length === 0 ? (
                  <p className="text-sm py-3" style={{ color: 'rgba(255,255,255,0.35)' }}>No donations yet — start recycling!</p>
                ) : recentDonations.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center gap-3 py-3"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', fontSize: 16 }}
                    >
                      ♻️
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium" style={{ color: '#ffffff' }}>{d.notes ?? 'Bag recycled'}</p>
                      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        {new Date(d.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                    <span className="text-sm font-semibold shrink-0" style={{ color: '#00c8ff' }}>
                      +${Number(d.amount).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* CTAs */}
          {!isLoading && (
            <div className="flex flex-col gap-3" style={fade(460)}>
              <Link
                to="/scan"
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-sm transition-all"
                style={{ background: 'linear-gradient(135deg, #0057e7, #00c8ff)', color: '#ffffff' }}
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
                to="/fundraisers"
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-medium transition-all"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)' }}
              >
                Browse Fundraisers
              </Link>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
