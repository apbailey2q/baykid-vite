import { useQuery } from '@tanstack/react-query'
import { getAdminStats } from '../../lib/admin'
import type { AdminStats } from '../../types'

const BAG_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  assigned: 'Assigned',
  picked_up: 'Picked Up',
  at_warehouse: 'At Warehouse',
  inspected: 'Inspected',
  completed: 'Completed',
}

const BAG_STATUS_COLOR: Record<string, string> = {
  pending:      '#9E9E9E',
  assigned:     '#60a5fa',
  picked_up:    '#a5b4fc',
  at_warehouse: '#00c8ff',
  inspected:    '#FFD600',
  completed:    '#4ade80',
}

const CARD_COLORS = {
  blue:   { bg: 'rgba(66,165,245,0.08)',  border: 'rgba(66,165,245,0.2)' },
  amber:  { bg: 'rgba(255,193,7,0.08)',   border: 'rgba(255,193,7,0.2)' },
  green:  { bg: 'rgba(0,230,118,0.06)',   border: 'rgba(0,230,118,0.2)' },
  red:    { bg: 'rgba(255,23,68,0.08)',   border: 'rgba(255,23,68,0.25)' },
  indigo: { bg: 'rgba(124,77,255,0.08)',  border: 'rgba(124,77,255,0.2)' },
  cyan:   { bg: 'rgba(0,200,255,0.08)',   border: 'rgba(0,200,255,0.25)' },
  gray:   { bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.1)' },
} as const

function StatCard({
  label,
  value,
  sub,
  color,
  highlight,
}: {
  label: string
  value: number
  sub?: string
  color: keyof typeof CARD_COLORS
  highlight?: boolean
}) {
  const { bg, border } = CARD_COLORS[color]
  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: bg,
        border: `1px solid ${highlight ? 'rgba(255,193,7,0.5)' : border}`,
        boxShadow: highlight ? '0 0 0 1px rgba(255,193,7,0.3)' : undefined,
      }}
    >
      <p className="text-2xl font-extrabold" style={{ color: '#ffffff' }}>{value.toLocaleString()}</p>
      <p className="mt-0.5 text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.6)' }}>{label}</p>
      {sub && <p className="mt-0.5 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{sub}</p>}
    </div>
  )
}

export function AdminOverview() {
  const { data: stats, isLoading, isError, refetch, isFetching } = useQuery<AdminStats>({
    queryKey: ['admin-stats'],
    queryFn: getAdminStats,
    refetchInterval: 2 * 60 * 1000,
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <div
          className="h-7 w-7 animate-spin rounded-full border-4"
          style={{ borderColor: '#00c8ff', borderTopColor: 'transparent' }}
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
        <p className="text-sm font-semibold" style={{ color: '#FF1744' }}>Failed to load stats</p>
        <button onClick={() => refetch()} className="text-xs underline" style={{ color: '#FF5252' }}>Try again</button>
      </div>
    )
  }

  const totalBagsByStatus = Object.values(stats?.bagsByStatus ?? {}).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-5">
      {/* Refresh */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold" style={{ color: '#ffffff' }}>System Overview</p>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(0,190,255,0.15)',
            color: 'rgba(255,255,255,0.4)',
          }}
        >
          <svg className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Users row */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>Users</p>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Total Users" value={stats?.totalUsers ?? 0} sub="all roles" color="blue" />
          <StatCard
            label="Pending Approval"
            value={stats?.pendingApprovals ?? 0}
            sub="awaiting review"
            color="amber"
            highlight={(stats?.pendingApprovals ?? 0) > 0}
          />
        </div>
      </div>

      {/* Operations row */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>Operations</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard label="Online Drivers" value={stats?.onlineDrivers ?? 0} color="green" />
          <StatCard label="Open Alerts" value={stats?.openAlerts ?? 0} color="red" highlight={(stats?.openAlerts ?? 0) > 0} />
          <StatCard label="Inspections" value={stats?.totalInspections ?? 0} color="indigo" />
        </div>
      </div>

      {/* Bags row */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>Bags</p>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Total Bags" value={stats?.totalBags ?? 0} sub="in system" color="cyan" />
          <StatCard label="Total Scans" value={stats?.totalScans ?? 0} sub="all time" color="gray" />
        </div>
      </div>

      {/* Bag pipeline */}
      {totalBagsByStatus > 0 && (
        <div
          className="rounded-2xl p-4 space-y-3"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(0,190,255,0.15)' }}
        >
          <p className="text-sm font-semibold" style={{ color: '#ffffff' }}>Bag Pipeline</p>
          {Object.entries(stats?.bagsByStatus ?? {})
            .sort((a, b) => {
              const order = ['pending', 'assigned', 'picked_up', 'at_warehouse', 'inspected', 'completed']
              return order.indexOf(a[0]) - order.indexOf(b[0])
            })
            .map(([status, count]) => (
              <div key={status}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{BAG_STATUS_LABELS[status] ?? status}</span>
                  <span className="text-xs font-semibold" style={{ color: '#ffffff' }}>{count}</span>
                </div>
                <div className="h-2 w-full rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{
                      width: `${(count / totalBagsByStatus) * 100}%`,
                      background: BAG_STATUS_COLOR[status] ?? '#9E9E9E',
                    }}
                  />
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}
