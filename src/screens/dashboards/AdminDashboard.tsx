import { useState } from 'react'
import { Link } from 'react-router-dom'
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

  const tabs: { value: Tab; label: string; urgent?: boolean; muted?: boolean }[] = [
    { value: 'overview',    label: 'Overview' },
    { value: 'users',       label: `Users${pendingCount > 0 ? ` (${pendingCount})` : ''}`, urgent: pendingCount > 0 },
    { value: 'emergencies', label: `Emergencies${openAlerts > 0 ? ` (${openAlerts})` : ''}`, urgent: openAlerts > 0 },
    { value: 'dispatch',    label: 'Dispatch' },
    { value: 'broadcasts',  label: 'Broadcasts', muted: true },
  ]

  return (
    <DashboardShell title="Admin">
      <div className="mb-4 flex gap-2 flex-wrap">
        <Link
          to="/live-admin"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:brightness-110"
          style={{ background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.28)', color: '#00c8ff', textDecoration: 'none' }}
        >
          🛡️ Admin Center
        </Link>
        <Link
          to="/live-payout-admin"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:brightness-110"
          style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', textDecoration: 'none' }}
        >
          💰 Payout Admin
          {pendingCount > 0 && (
            <span style={{ background: '#fbbf24', color: '#000', borderRadius: '999px', fontSize: 10, fontWeight: 800, padding: '1px 6px' }}>
              Live
            </span>
          )}
        </Link>
        <Link
          to="/dashboard/admin/commercial"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:brightness-110"
          style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.28)', color: '#4ade80', textDecoration: 'none' }}
        >
          🏢 Commercial Ops
        </Link>
        <Link
          to="/dashboard/admin/ai-marketing"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:brightness-110"
          style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.35)', color: '#c084fc', textDecoration: 'none' }}
        >
          🤖 AI Marketing
        </Link>
        <Link
          to="/dashboard/admin/analytics"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:brightness-110"
          style={{ background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.25)', color: '#00c8ff', textDecoration: 'none' }}
        >
          ♻️ Recycling Analytics
        </Link>
        <Link
          to="/dashboard/admin/investor"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:brightness-110"
          style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.28)', color: '#fbbf24', textDecoration: 'none' }}
        >
          💼 Investor Dashboard
        </Link>
        <Link
          to="/dashboard/admin/dispatch-map"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:brightness-110"
          style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.25)', color: '#4ade80', textDecoration: 'none' }}
        >
          🗺️ Dispatcher Map
        </Link>
      </div>
      <div
        className="flex overflow-x-auto mb-4 -mx-4 px-4 sm:mx-0 sm:px-0"
        style={{ borderBottom: '1px solid rgba(0,188,212,0.15)', scrollbarWidth: 'none' }}
      >
        {tabs.map(({ value, label, urgent, muted }) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className="shrink-0 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors"
            style={
              tab === value
                ? { borderBottomColor: '#FFD600', color: '#FFD600' }
                : { borderBottomColor: 'transparent', color: urgent ? '#FFD600' : muted ? 'rgba(255,255,255,0.25)' : '#7B909C' }
            }
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview'    && <div style={{ animation: 'fadeSlideUp 0.25s ease both' }}><AdminOverview /></div>}
      {tab === 'users'       && <div style={{ animation: 'fadeSlideUp 0.25s ease both' }}><UserManagement /></div>}
      {tab === 'emergencies' && <div style={{ animation: 'fadeSlideUp 0.25s ease both' }}><EmergencyAlerts /></div>}
      {tab === 'dispatch'    && <div style={{ animation: 'fadeSlideUp 0.25s ease both' }}><RouteDispatch /></div>}
      {tab === 'broadcasts'  && <div style={{ animation: 'fadeSlideUp 0.25s ease both' }}><AdminAlerts /></div>}
    </DashboardShell>
  )
}
