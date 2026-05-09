import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { DashboardShell } from '../../components/DashboardShell'
import { SectionLabel } from '../../components/ui/dashboard'
import { supabase } from '../../lib/supabaseClient'

const ACCENT = '#10b981'

type Tab = 'overview' | 'campaigns'

type Fundraiser = {
  id: string
  name: string
  organization: string | null
  goal_amount: number
  raised_amount: number
  bag_count: number
  percent_to_cause: number
  status: string
}

type OverviewStats = {
  totalRaised: number
  cashTotal: number
  bagTotal: number
  bagsCount: number
  memberCount: number
  activeCampaigns: number
}

async function fetchOverviewStats(): Promise<OverviewStats> {
  const [fundraisersRes, contribRes, memberRes] = await Promise.all([
    supabase
      .from('fundraisers')
      .select('raised_amount, status'),
    supabase
      .from('fundraiser_contributions')
      .select('type, amount, bag_id'),
    supabase
      .from('fundraiser_members')
      .select('id', { count: 'exact', head: true }),
  ])

  const fundraisers = fundraisersRes.data ?? []
  const contribs    = contribRes.data ?? []

  return {
    totalRaised:      fundraisers.reduce((s, f) => s + (f.raised_amount ?? 0), 0),
    cashTotal:        contribs.filter(c => c.type === 'cash').reduce((s, c) => s + c.amount, 0),
    bagTotal:         contribs.filter(c => c.type === 'bag').reduce((s, c) => s + c.amount, 0),
    bagsCount:        contribs.filter(c => c.type === 'bag' || c.bag_id !== null).length,
    memberCount:      memberRes.count ?? 0,
    activeCampaigns:  fundraisers.filter(f => f.status === 'active').length,
  }
}

async function fetchCampaigns(): Promise<Fundraiser[]> {
  const { data, error } = await supabase
    .from('fundraisers')
    .select('id, name, organization, goal_amount, raised_amount, bag_count, percent_to_cause, status')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as Fundraiser[]
}

function fmtAmt(n: number) {
  return `$${n.toFixed(2)}`
}

function Spinner() {
  return (
    <div className="flex items-center gap-2 py-8 justify-center">
      <div
        className="w-4 h-4 rounded-full border-2 animate-spin"
        style={{ borderColor: 'rgba(16,185,129,0.2)', borderTopColor: ACCENT }}
      />
      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Loading…</span>
    </div>
  )
}

export default function FundraiserDashboard() {
  const [tab, setTab] = useState<Tab>('overview')

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['fundraiser-dashboard-stats'],
    queryFn: fetchOverviewStats,
    refetchInterval: 60_000,
  })

  const { data: campaigns = [], isLoading: campaignsLoading } = useQuery({
    queryKey: ['fundraiser-dashboard-campaigns'],
    queryFn: fetchCampaigns,
    refetchInterval: 60_000,
  })

  return (
    <DashboardShell title="Fundraiser">
      {/* Tabs */}
      <div
        className="flex overflow-x-auto mb-4 -mx-4 px-4 sm:mx-0 sm:px-0"
        style={{ borderBottom: '1px solid rgba(0,188,212,0.15)', scrollbarWidth: 'none' as const }}
      >
        {([['overview', 'Overview'], ['campaigns', 'Campaigns']] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="shrink-0 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors"
            style={
              tab === t
                ? { borderBottomColor: ACCENT, color: ACCENT }
                : { borderBottomColor: 'transparent', color: '#7B909C' }
            }
          >
            {label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div style={{ animation: 'fadeSlideUp 0.25s ease both' }}>
          <SectionLabel title="Campaign Stats" accent={ACCENT} />

          {statsLoading ? <Spinner /> : (
            <div className="grid grid-cols-2 gap-3 mb-6">
              {([
                { label: 'Total Raised',     value: fmtAmt(stats?.totalRaised ?? 0),    color: '#fbbf24' },
                { label: 'Cash Donations',   value: fmtAmt(stats?.cashTotal ?? 0),      color: '#4ade80' },
                { label: 'Bags Donated',     value: String(stats?.bagsCount ?? 0),      color: '#5eead4' },
                { label: 'Recycling Value',  value: fmtAmt(stats?.bagTotal ?? 0),       color: '#00c8ff' },
                { label: 'Members',          value: String(stats?.memberCount ?? 0),    color: '#ffffff'  },
                { label: 'Active Campaigns', value: String(stats?.activeCampaigns ?? 0), color: ACCENT   },
              ] as { label: string; value: string; color: string }[]).map(s => (
                <div
                  key={s.label}
                  className="rounded-2xl p-4"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <p style={{ fontSize: 22, fontWeight: 800, color: s.color, marginBottom: 4, lineHeight: 1 }}>
                    {s.value}
                  </p>
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {s.label}
                  </p>
                </div>
              ))}
            </div>
          )}

          <SectionLabel title="Quick Actions" accent={ACCENT} />
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Link
              to="/live-fundraisers"
              className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all hover:brightness-110"
              style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', color: ACCENT, textDecoration: 'none' }}
            >
              📋 View Fundraisers
            </Link>
            <Link
              to="/live-my-fundraisers"
              className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all hover:brightness-110"
              style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', color: '#fbbf24', textDecoration: 'none' }}
            >
              🎯 My Fundraisers
            </Link>
            <Link
              to="/live-scan"
              className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all hover:brightness-110"
              style={{ background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.25)', color: '#00c8ff', textDecoration: 'none' }}
            >
              ♻️ Scan Bags
            </Link>
            <Link
              to="/create-fundraiser"
              className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all hover:brightness-110"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}
            >
              ➕ New Campaign
            </Link>
          </div>
        </div>
      )}

      {/* Campaigns */}
      {tab === 'campaigns' && (
        <div style={{ animation: 'fadeSlideUp 0.25s ease both' }}>
          <SectionLabel title="All Campaigns" accent={ACCENT} />

          {campaignsLoading ? <Spinner /> : campaigns.length === 0 ? (
            <div className="rounded-2xl p-10 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ fontSize: 36, display: 'block', marginBottom: 12 }}>📊</span>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', marginBottom: 8 }}>No campaigns found.</p>
              <Link to="/create-fundraiser" style={{ color: ACCENT, fontSize: 13 }}>
                + Create your first fundraiser
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {campaigns.map(f => {
                const pct = f.goal_amount > 0
                  ? Math.min(100, Math.round((f.raised_amount / f.goal_amount) * 100))
                  : 0
                return (
                  <Link
                    key={f.id}
                    to={`/live-fundraisers/${f.id}`}
                    className="block rounded-2xl p-4 transition-all hover:brightness-110"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', textDecoration: 'none' }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0 mr-3">
                        <p style={{ fontSize: 14, fontWeight: 700, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {f.name}
                        </p>
                        {f.organization && (
                          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{f.organization}</p>
                        )}
                      </div>
                      <span
                        className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide shrink-0"
                        style={{
                          background: f.status === 'active' ? 'rgba(74,222,128,0.12)' : 'rgba(148,163,184,0.1)',
                          border:     f.status === 'active' ? '1px solid rgba(74,222,128,0.3)' : '1px solid rgba(148,163,184,0.25)',
                          color:      f.status === 'active' ? '#4ade80' : '#94a3b8',
                        }}
                      >
                        {f.status}
                      </span>
                    </div>

                    <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 6, overflow: 'hidden', marginBottom: 6 }}>
                      <div style={{
                        height: '100%',
                        width: `${pct}%`,
                        background: `linear-gradient(90deg, #0057e7, #00c8ff 60%, ${ACCENT})`,
                        borderRadius: 6,
                        transition: 'width 0.8s ease',
                      }} />
                    </div>

                    <div className="flex justify-between mb-2">
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                        Raised <strong style={{ color: ACCENT }}>{fmtAmt(f.raised_amount)}</strong>
                      </span>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                        {pct}% · Goal {fmtAmt(f.goal_amount)}
                      </span>
                    </div>

                    <div className="flex gap-4">
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
                        📦 <strong style={{ color: '#ffffff' }}>{f.bag_count}</strong> bags
                      </span>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
                        💚 <strong style={{ color: '#ffffff' }}>{f.percent_to_cause}%</strong> to cause
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      )}
    </DashboardShell>
  )
}
