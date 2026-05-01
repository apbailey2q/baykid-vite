import { useQuery } from '@tanstack/react-query'
import { getPartnerStats } from '../../lib/partner'
import type { PartnerStats as PartnerStatsType } from '../../types'

const LBS_PER_BAG = 2.5
const CO2_PER_LB = 0.82

const CARD_COLORS = {
  cyan:   { bg: 'rgba(0,188,212,0.08)',  border: 'rgba(0,188,212,0.25)' },
  green:  { bg: 'rgba(0,230,118,0.06)',  border: 'rgba(0,230,118,0.2)' },
  indigo: { bg: 'rgba(124,77,255,0.08)', border: 'rgba(124,77,255,0.2)' },
  amber:  { bg: 'rgba(255,193,7,0.08)',  border: 'rgba(255,193,7,0.2)' },
} as const

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: string | number
  sub?: string
  color: keyof typeof CARD_COLORS
}) {
  const { bg, border } = CARD_COLORS[color]
  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: bg, border: `1px solid ${border}` }}
    >
      <p className="text-2xl font-extrabold" style={{ color: '#E0F7FA' }}>{value}</p>
      <p className="mt-0.5 text-sm font-semibold" style={{ color: '#B0BEC5' }}>{label}</p>
      {sub && <p className="mt-0.5 text-xs" style={{ color: '#7B909C' }}>{sub}</p>}
    </div>
  )
}

export function PartnerStats() {
  const { data: stats, isLoading, isError, refetch, isFetching } = useQuery<PartnerStatsType>({
    queryKey: ['partner-stats'],
    queryFn: getPartnerStats,
    refetchInterval: 5 * 60 * 1000,
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <div
          className="h-7 w-7 animate-spin rounded-full border-4"
          style={{ borderColor: '#00BCD4', borderTopColor: 'transparent' }}
        />
      </div>
    )
  }

  if (isError) {
    return (
      <div
        className="rounded-2xl p-6 text-center space-y-3"
        style={{ background: 'rgba(255,23,68,0.08)', border: '1px solid rgba(255,23,68,0.25)' }}
      >
        <p className="text-sm font-semibold" style={{ color: '#FF1744' }}>Failed to load recycling stats</p>
        <button onClick={() => refetch()} className="text-xs underline" style={{ color: '#FF5252' }}>Try again</button>
      </div>
    )
  }

  const totalInspections = (stats?.passedInspections ?? 0) + (stats?.failedInspections ?? 0)
  const passRate = totalInspections > 0
    ? Math.round(((stats?.passedInspections ?? 0) / totalInspections) * 100)
    : 0

  const lbsRecycled = ((stats?.completedBags ?? 0) * LBS_PER_BAG).toFixed(0)
  const co2Saved = ((stats?.completedBags ?? 0) * LBS_PER_BAG * CO2_PER_LB).toFixed(1)

  const maxWeekly = Math.max(...(stats?.weeklyActivity.map((d) => d.bags) ?? [1]), 1)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold" style={{ color: '#E0F7FA' }}>Recycling Activity</p>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(0,188,212,0.2)',
            color: '#7B909C',
          }}
        >
          <svg className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Volume stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Total Bags" value={stats?.totalBags ?? 0} sub="all time" color="cyan" />
        <StatCard label="Completed" value={stats?.completedBags ?? 0} sub="fully processed" color="green" />
        <StatCard label="Inspected" value={stats?.inspectedBags ?? 0} sub="passed QC" color="indigo" />
        <StatCard label="Pending Review" value={stats?.pendingReview ?? 0} sub="flagged bags" color="amber" />
      </div>

      {/* Pass rate */}
      {totalInspections > 0 && (
        <div
          className="rounded-2xl p-4 space-y-2"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(0,188,212,0.15)' }}
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold" style={{ color: '#E0F7FA' }}>Inspection Pass Rate</p>
            <p className="text-sm font-bold" style={{ color: '#00E676' }}>{passRate}%</p>
          </div>
          <div className="h-2 w-full rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div
              className="h-2 rounded-full transition-all"
              style={{ width: `${passRate}%`, background: '#00E676' }}
            />
          </div>
          <p className="text-xs" style={{ color: '#7B909C' }}>
            {stats?.passedInspections} passed · {stats?.failedInspections} flagged
          </p>
        </div>
      )}

      {/* Environmental impact */}
      <div
        className="rounded-2xl p-4 space-y-3"
        style={{ background: 'rgba(0,200,83,0.06)', border: '1px solid rgba(0,200,83,0.2)' }}
      >
        <div className="flex items-center gap-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full"
            style={{ background: 'rgba(0,200,83,0.15)' }}
          >
            <svg className="h-4 w-4" style={{ color: '#00E676' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
            </svg>
          </div>
          <p className="text-sm font-bold" style={{ color: '#00E676' }}>Environmental Impact</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xl font-extrabold" style={{ color: '#E0F7FA' }}>{Number(lbsRecycled).toLocaleString()} lbs</p>
            <p className="text-xs" style={{ color: '#7B909C' }}>Material recycled (est.)</p>
          </div>
          <div>
            <p className="text-xl font-extrabold" style={{ color: '#E0F7FA' }}>{Number(co2Saved).toLocaleString()} lbs</p>
            <p className="text-xs" style={{ color: '#7B909C' }}>CO₂ emissions avoided</p>
          </div>
        </div>
        <p className="text-xs" style={{ color: 'rgba(0,200,83,0.7)' }}>Based on {LBS_PER_BAG} lbs/bag average · {CO2_PER_LB} lbs CO₂/lb</p>
      </div>

      {/* Weekly activity bar chart */}
      <div
        className="rounded-2xl p-4 space-y-3"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(0,188,212,0.15)' }}
      >
        <p className="text-sm font-semibold" style={{ color: '#E0F7FA' }}>Bags — Last 7 Days</p>
        <div className="flex items-end gap-1.5 h-20">
          {(stats?.weeklyActivity ?? []).map((day) => (
            <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
              <div className="w-full flex items-end justify-center" style={{ height: '56px' }}>
                <div
                  className="w-full rounded-t transition-all"
                  style={{
                    height: `${Math.max((day.bags / maxWeekly) * 56, day.bags > 0 ? 4 : 0)}px`,
                    background: '#00BCD4',
                  }}
                />
              </div>
              <p className="text-xs whitespace-nowrap" style={{ color: '#7B909C' }}>{day.date.split(' ')[1]}</p>
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs" style={{ color: '#7B909C' }}>
          {(stats?.weeklyActivity ?? []).map((day) => (
            <span key={day.date} className="text-center">{day.bags}</span>
          ))}
        </div>
      </div>
    </div>
  )
}
