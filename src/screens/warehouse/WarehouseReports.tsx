import { useQuery } from '@tanstack/react-query'
import { getTodayStats, getWeeklyInspectionTrend } from '../../lib/warehouse'
import { Spinner, EmptyState } from '../../components/ui'

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: number
  sub?: string
  accent: string
}) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: 'rgba(255,255,255,0.05)',
        border: `1px solid ${accent}44`,
      }}
    >
      <p className="text-2xl font-extrabold" style={{ color: accent }}>{value}</p>
      <p className="mt-0.5 text-sm font-semibold" style={{ color: '#E0F7FA' }}>{label}</p>
      {sub && <p className="mt-0.5 text-xs" style={{ color: '#7B909C' }}>{sub}</p>}
    </div>
  )
}

export function WarehouseReports() {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })

  const {
    data: stats,
    isLoading: statsLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['warehouse-stats'],
    queryFn: getTodayStats,
    refetchInterval: 5 * 60 * 1000,
  })

  const { data: trend = [], isLoading: trendLoading } = useQuery({
    queryKey: ['warehouse-weekly-trend'],
    queryFn: getWeeklyInspectionTrend,
  })

  const maxInspections = Math.max(...trend.map((d) => d.inspections), 1)

  if (statsLoading || trendLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner size="md" />
      </div>
    )
  }

  if (isError) {
    return (
      <EmptyState
        icon="⚠️"
        title="Failed to load stats"
        description="Check your connection and try again."
        action={{ label: 'Retry', onClick: () => refetch() }}
      />
    )
  }

  const passedToday = stats?.passedToday ?? 0
  const inspectedToday = stats?.bagsInspectedToday ?? 0
  const passRate = inspectedToday > 0 ? Math.round((passedToday / inspectedToday) * 100) : null
  const pendingReview = stats?.pendingReview ?? 0

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-base font-bold" style={{ color: '#E0F7FA' }}>Today's Report</p>
          <p className="text-xs" style={{ color: '#7B909C' }}>{today}</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-70 disabled:opacity-50"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(0,188,212,0.2)',
            color: '#7B909C',
          }}
        >
          <svg
            className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          Refresh
        </button>
      </div>

      {/* 2×2 stat grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Bags Scanned" value={stats?.bagsScannedToday ?? 0} sub="unique bags" accent="#00BCD4" />
        <StatCard label="Inspected"    value={inspectedToday}                sub="logged today"  accent="#7C4DFF" />
        <StatCard label="Passed"       value={passedToday}                   sub="green + yellow" accent="#00E676" />
        <StatCard label="Failed"       value={stats?.failedToday ?? 0}       sub="red flags"     accent="#FF1744" />
      </div>

      {/* Pending review */}
      <div
        className="rounded-2xl p-4"
        style={{
          background: pendingReview > 0 ? 'rgba(255,214,0,0.06)' : 'rgba(255,255,255,0.04)',
          border: pendingReview > 0 ? '1px solid rgba(255,214,0,0.3)' : '1px solid rgba(0,188,212,0.12)',
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-extrabold" style={{ color: pendingReview > 0 ? '#FFD600' : '#E0F7FA' }}>
              {pendingReview}
            </p>
            <p className="mt-0.5 text-sm font-semibold" style={{ color: '#E0F7FA' }}>Pending Review</p>
            <p className="text-xs" style={{ color: '#7B909C' }}>Red bags awaiting supervisor</p>
          </div>
          {pendingReview > 0 && (
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full"
              style={{ background: 'rgba(255,214,0,0.12)' }}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: '#FFD600' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* Pass rate bar */}
      {passRate !== null && (
        <div
          className="rounded-2xl p-4"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(0,188,212,0.12)',
          }}
        >
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-sm font-semibold" style={{ color: '#E0F7FA' }}>Pass Rate Today</p>
            <p className="text-sm font-bold" style={{ color: passRate >= 80 ? '#00E676' : passRate >= 60 ? '#FFD600' : '#FF1744' }}>
              {passRate}%
            </p>
          </div>
          <div className="h-2 w-full rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div
              className="h-2 rounded-full transition-all"
              style={{
                width: `${passRate}%`,
                background: passRate >= 80
                  ? 'linear-gradient(90deg, #00E676, #00BCD4)'
                  : passRate >= 60
                  ? 'linear-gradient(90deg, #FFD600, #FF9800)'
                  : '#FF1744',
              }}
            />
          </div>
        </div>
      )}

      {/* 7-day trend chart */}
      <div
        className="rounded-2xl p-4"
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(0,188,212,0.12)',
        }}
      >
        <p className="mb-4 text-sm font-semibold" style={{ color: '#E0F7FA' }}>7-Day Inspections</p>
        <div className="flex items-end gap-1.5" style={{ height: 72 }}>
          {trend.map((d) => (
            <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex w-full flex-col-reverse" style={{ height: 60 }}>
                {/* Passed — grows from bottom */}
                <div
                  className="w-full rounded-sm transition-all"
                  style={{
                    height: `${(d.passed / maxInspections) * 60}px`,
                    minHeight: d.inspections > 0 ? 3 : 0,
                    background: 'linear-gradient(180deg, #00BCD4, #00E676)',
                  }}
                />
                {/* Failed — stacked above */}
                {d.failed > 0 && (
                  <div
                    className="w-full rounded-sm transition-all"
                    style={{
                      height: `${(d.failed / maxInspections) * 60}px`,
                      background: '#FF1744',
                      opacity: 0.85,
                    }}
                  />
                )}
                {d.inspections === 0 && (
                  <div
                    className="w-full rounded-sm"
                    style={{ height: 3, background: 'rgba(255,255,255,0.08)' }}
                  />
                )}
              </div>
              <span className="text-[10px] font-medium" style={{ color: '#7B909C' }}>{d.day}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-3 rounded-sm" style={{ background: 'linear-gradient(90deg, #00BCD4, #00E676)' }} />
            <span className="text-[10px]" style={{ color: '#7B909C' }}>Passed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-3 rounded-sm" style={{ background: '#FF1744', opacity: 0.85 }} />
            <span className="text-[10px]" style={{ color: '#7B909C' }}>Failed</span>
          </div>
        </div>
      </div>
    </div>
  )
}
