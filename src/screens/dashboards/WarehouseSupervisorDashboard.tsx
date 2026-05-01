import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { DashboardShell } from '../../components/DashboardShell'
import { FlaggedBags } from '../warehouse/FlaggedBags'
import { AllInspections } from '../warehouse/AllInspections'
import { WarehouseReports } from '../warehouse/WarehouseReports'
import { getFlaggedInspections } from '../../lib/warehouse'

type Tab = 'flagged' | 'all' | 'reports'

export default function WarehouseSupervisorDashboard() {
  const [tab, setTab] = useState<Tab>('flagged')

  const { data: flagged = [] } = useQuery({
    queryKey: ['flagged-inspections'],
    queryFn: getFlaggedInspections,
    refetchInterval: 60_000,
  })

  const tabs: { value: Tab; label: string }[] = [
    { value: 'flagged', label: `Flagged${flagged.length > 0 ? ` (${flagged.length})` : ''}` },
    { value: 'all', label: 'All Inspections' },
    { value: 'reports', label: 'Reports' },
  ]

  return (
    <DashboardShell title="Supervisor">
      {/* Tabs */}
      <div
        className="flex overflow-x-auto mb-4 -mx-4 px-4 sm:mx-0 sm:px-0"
        style={{ borderBottom: '1px solid rgba(0,188,212,0.15)' }}
      >
        {tabs.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className="shrink-0 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors"
            style={
              tab === value
                ? { borderBottomColor: '#00BCD4', color: '#00BCD4' }
                : {
                    borderBottomColor: 'transparent',
                    color: value === 'flagged' && flagged.length > 0 ? '#FFD600' : '#7B909C',
                  }
            }
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'flagged' && <FlaggedBags />}
      {tab === 'all' && <AllInspections />}
      {tab === 'reports' && <WarehouseReports />}
    </DashboardShell>
  )
}
