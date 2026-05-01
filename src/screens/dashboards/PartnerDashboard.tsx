import { useState } from 'react'
import { DashboardShell } from '../../components/DashboardShell'
import { PartnerStats } from '../partner/PartnerStats'
import { PartnerReports } from '../partner/PartnerReports'

type Tab = 'overview' | 'reports'

export default function PartnerDashboard() {
  const [tab, setTab] = useState<Tab>('overview')

  return (
    <DashboardShell title="Partner">
      {/* Tabs */}
      <div
        className="flex overflow-x-auto mb-4 -mx-4 px-4 sm:mx-0 sm:px-0"
        style={{ borderBottom: '1px solid rgba(0,188,212,0.15)' }}
      >
        {([['overview', 'Overview'], ['reports', 'Reports']] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="shrink-0 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors"
            style={
              tab === t
                ? { borderBottomColor: '#00BCD4', color: '#00BCD4' }
                : { borderBottomColor: 'transparent', color: '#7B909C' }
            }
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <PartnerStats />}
      {tab === 'reports' && <PartnerReports />}
    </DashboardShell>
  )
}
