import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getPartnerStats } from '../../lib/partner'
import type { PartnerStats } from '../../types'

const LBS_PER_BAG = 2.5
const CO2_PER_LB = 0.82

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((r) => r.map((cell) => `"${cell}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function buildReportRows(stats: PartnerStats, generatedAt: string): string[][] {
  const totalInspections = stats.passedInspections + stats.failedInspections
  const passRate = totalInspections > 0
    ? ((stats.passedInspections / totalInspections) * 100).toFixed(1)
    : '0'
  const lbsRecycled = (stats.completedBags * LBS_PER_BAG).toFixed(1)
  const co2Saved = (stats.completedBags * LBS_PER_BAG * CO2_PER_LB).toFixed(1)

  return [
    ['BayKid Recycling Partner Report'],
    ['Generated', generatedAt],
    [],
    ['--- Volume Summary ---'],
    ['Metric', 'Value'],
    ['Total Bags in System', String(stats.totalBags)],
    ['Completed Bags', String(stats.completedBags)],
    ['Inspected Bags', String(stats.inspectedBags)],
    ['Pending Supervisor Review', String(stats.pendingReview)],
    [],
    ['--- Inspection Quality ---'],
    ['Metric', 'Value'],
    ['Passed Inspections', String(stats.passedInspections)],
    ['Failed Inspections (Red)', String(stats.failedInspections)],
    ['Pass Rate (%)', passRate],
    [],
    ['--- Environmental Impact (Estimated) ---'],
    ['Metric', 'Value'],
    ['Material Recycled (lbs)', lbsRecycled],
    ['CO2 Emissions Avoided (lbs)', co2Saved],
    ['Avg lbs/bag', String(LBS_PER_BAG)],
    [],
    ['--- Weekly Activity (Last 7 Days) ---'],
    ['Date', 'Bags'],
    ...stats.weeklyActivity.map((d) => [d.date, String(d.bags)]),
  ]
}

export function PartnerReports() {
  const [exporting, setExporting] = useState(false)

  const { data: stats, isLoading } = useQuery<PartnerStats>({
    queryKey: ['partner-stats'],
    queryFn: getPartnerStats,
  })

  const handleExport = () => {
    if (!stats) return
    setExporting(true)
    try {
      const now = new Date().toLocaleString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit',
      })
      const filename = `baykid-report-${new Date().toISOString().slice(0, 10)}.csv`
      downloadCsv(filename, buildReportRows(stats, now))
    } finally {
      setExporting(false)
    }
  }

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

  const totalInspections = (stats?.passedInspections ?? 0) + (stats?.failedInspections ?? 0)
  const passRate = totalInspections > 0
    ? Math.round(((stats?.passedInspections ?? 0) / totalInspections) * 100)
    : 0

  return (
    <div className="space-y-4">
      {/* Export button */}
      <button
        onClick={handleExport}
        disabled={exporting || !stats}
        className="w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold text-white disabled:opacity-50"
        style={{ background: 'linear-gradient(135deg,#00BCD4,#0097A7)', boxShadow: '0 0 16px rgba(0,188,212,0.3)' }}
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
        {exporting ? 'Exporting…' : 'Export CSV Report'}
      </button>
      <p className="text-center text-xs" style={{ color: '#7B909C' }}>Downloads a full summary as a CSV file</p>

      {/* Preview */}
      <div
        className="rounded-2xl p-4 space-y-4"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(0,188,212,0.15)' }}
      >
        <p className="text-sm font-bold" style={{ color: '#E0F7FA' }}>Report Preview</p>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#7B909C' }}>Volume Summary</p>
          {[
            ['Total Bags', stats?.totalBags ?? 0],
            ['Completed', stats?.completedBags ?? 0],
            ['Inspected', stats?.inspectedBags ?? 0],
            ['Pending Review', stats?.pendingReview ?? 0],
          ].map(([label, value]) => (
            <div
              key={label as string}
              className="flex items-center justify-between py-1 last:border-0"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
            >
              <span className="text-sm" style={{ color: '#7B909C' }}>{label}</span>
              <span className="text-sm font-semibold" style={{ color: '#E0F7FA' }}>{Number(value).toLocaleString()}</span>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#7B909C' }}>Inspection Quality</p>
          {[
            ['Passed', stats?.passedInspections ?? 0],
            ['Failed (Red)', stats?.failedInspections ?? 0],
            ['Pass Rate', `${passRate}%`],
          ].map(([label, value]) => (
            <div
              key={label as string}
              className="flex items-center justify-between py-1 last:border-0"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
            >
              <span className="text-sm" style={{ color: '#7B909C' }}>{label}</span>
              <span className="text-sm font-semibold" style={{ color: '#E0F7FA' }}>{value}</span>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#7B909C' }}>Environmental Impact (Est.)</p>
          {[
            ['Material Recycled', `${((stats?.completedBags ?? 0) * LBS_PER_BAG).toLocaleString()} lbs`],
            ['CO₂ Avoided', `${((stats?.completedBags ?? 0) * LBS_PER_BAG * CO2_PER_LB).toFixed(1)} lbs`],
          ].map(([label, value]) => (
            <div
              key={label as string}
              className="flex items-center justify-between py-1 last:border-0"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
            >
              <span className="text-sm" style={{ color: '#7B909C' }}>{label}</span>
              <span className="text-sm font-semibold" style={{ color: '#00E676' }}>{value}</span>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#7B909C' }}>Weekly Activity</p>
          {(stats?.weeklyActivity ?? []).map((day) => (
            <div
              key={day.date}
              className="flex items-center justify-between py-1 last:border-0"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
            >
              <span className="text-sm" style={{ color: '#7B909C' }}>{day.date}</span>
              <span className="text-sm font-semibold" style={{ color: '#E0F7FA' }}>{day.bags} bags</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
