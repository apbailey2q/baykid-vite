import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { DashboardShell } from '../../components/DashboardShell'
import { AdminOverview } from '../admin/AdminOverview'
import { UserManagement } from '../admin/UserManagement'
import { AdminAlerts } from '../admin/AdminAlerts'
import { EmergencyAlerts } from '../admin/EmergencyAlerts'
import { RouteDispatch } from '../admin/RouteDispatch'
import { getAllUsers, getAllAlerts } from '../../lib/admin'

type Tab = 'overview' | 'users' | 'broadcasts' | 'emergencies' | 'dispatch'

export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>('overview')

  const { data: users = [] } = useQuery({
    queryKey: ['admin-users'],
    queryFn: getAllUsers,
    refetchInterval: 60_000,
  })

  const { data: alerts = [] } = useQuery({
    queryKey: ['admin-alerts'],
    queryFn: getAllAlerts,
    refetchInterval: 30_000,
  })

  const pendingCount = users.filter((u) => u.approval_status === 'pending').length
  const openAlerts   = alerts.filter((a) => a.status === 'open').length

  const tabs: { value: Tab; label: string; urgent?: boolean }[] = [
    { value: 'overview',    label: 'Overview' },
    { value: 'users',       label: `Users${pendingCount > 0 ? ` (${pendingCount})` : ''}`, urgent: pendingCount > 0 },
    { value: 'emergencies', label: `Emergencies${openAlerts > 0 ? ` (${openAlerts})` : ''}`, urgent: openAlerts > 0 },
    { value: 'dispatch',    label: 'Dispatch' },
    { value: 'broadcasts',  label: 'Broadcasts' },
  ]

  return (
    <DashboardShell title="Admin">
      <div
        className="flex overflow-x-auto mb-4 -mx-4 px-4 sm:mx-0 sm:px-0"
        style={{ borderBottom: '1px solid rgba(0,188,212,0.15)' }}
      >
        {tabs.map(({ value, label, urgent }) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className="shrink-0 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors"
            style={
              tab === value
                ? { borderBottomColor: '#00BCD4', color: '#00BCD4' }
                : { borderBottomColor: 'transparent', color: urgent ? '#FFD600' : '#7B909C' }
            }
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview'    && <AdminOverview />}
      {tab === 'users'       && <UserManagement />}
      {tab === 'emergencies' && <EmergencyAlerts />}
      {tab === 'dispatch'    && <RouteDispatch />}
      {tab === 'broadcasts'  && <AdminAlerts />}
    </DashboardShell>
  )
}
