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
import { supabase } from '../../lib/supabaseClient'

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

  // Phase MG.5 — compliance document status counts for Document Review tile
  const { data: complianceCounts } = useQuery({
    queryKey: ['admin-compliance-doc-counts'],
    queryFn: async () => {
      try {
        const now = new Date().toISOString()
        const { data, error } = await supabase
          .from('compliance_documents')
          .select('status, deactivation_countdown_started_at, temporary_deactivation_at, reactivated_at')
          .eq('owner_type', 'management')

        if (error || !data) return { pending: 0, countdowns: 0, deactivated: 0 }

        const pending    = data.filter(d => ['pending', 'missing', 'rejected'].includes(d.status)).length
        const countdowns = data.filter(d =>
          d.deactivation_countdown_started_at &&
          !d.reactivated_at &&
          (!d.temporary_deactivation_at || new Date(d.temporary_deactivation_at).toISOString() > now)
        ).length
        const deactivated = data.filter(d =>
          d.temporary_deactivation_at &&
          new Date(d.temporary_deactivation_at).toISOString() <= now &&
          !d.reactivated_at
        ).length

        return { pending, countdowns, deactivated }
      } catch {
        return { pending: 0, countdowns: 0, deactivated: 0 }
      }
    },
    refetchInterval: 5 * 60 * 1000,
    staleTime:       60_000,
  })

  const docReviewTotal = (complianceCounts?.pending ?? 0)
    + (complianceCounts?.countdowns ?? 0)
    + (complianceCounts?.deactivated ?? 0)

  // Phase MG.6 — operational notification open counts for tile badge
  const { data: opNotifCounts } = useQuery({
    queryKey: ['admin-op-notif-counts'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('operational_notification_events')
          .select('severity')
          .eq('status', 'open')

        if (error || !data) return { open: 0, urgent: 0 }

        const rows    = data as { severity: string }[]
        const open   = rows.length
        const urgent = rows.filter(r => r.severity === 'urgent' || r.severity === 'critical').length
        return { open, urgent }
      } catch {
        return { open: 0, urgent: 0 }
      }
    },
    refetchInterval: 5 * 60 * 1000,
    staleTime:       60_000,
  })

  const opOpen   = opNotifCounts?.open   ?? 0
  const opUrgent = opNotifCounts?.urgent ?? 0

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
          to="/dashboard/admin/warehouse-onboarding"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:brightness-110"
          style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.28)', color: '#a855f7', textDecoration: 'none' }}
        >
          🏭 Warehouse Onboarding
        </Link>
        <Link
          to="/admin/management-onboarding"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:brightness-110"
          style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.28)', color: '#fbbf24', textDecoration: 'none' }}
        >
          🏢 Management Oversight
        </Link>
        <Link
          to="/admin/document-review"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:brightness-110"
          style={{
            background: docReviewTotal > 0 ? 'rgba(249,115,22,0.13)' : 'rgba(249,115,22,0.08)',
            border: `1px solid ${docReviewTotal > 0 ? 'rgba(249,115,22,0.45)' : 'rgba(249,115,22,0.28)'}`,
            color: '#f97316',
            textDecoration: 'none',
          }}
          title="Review uploaded documents, expiration alerts, missing requirements, and temporary deactivation countdowns."
        >
          📋 Document Review
          {/* Phase MG.5 — status count badges */}
          {(complianceCounts?.deactivated ?? 0) > 0 && (
            <span style={{ background: '#f87171', color: '#fff', borderRadius: '999px', fontSize: 10, fontWeight: 800, padding: '1px 6px' }}>
              {complianceCounts!.deactivated} deactivated
            </span>
          )}
          {(complianceCounts?.countdowns ?? 0) > 0 && (
            <span style={{ background: '#f97316', color: '#fff', borderRadius: '999px', fontSize: 10, fontWeight: 800, padding: '1px 6px' }}>
              {complianceCounts!.countdowns} countdown
            </span>
          )}
          {(complianceCounts?.pending ?? 0) > 0 && (
            <span style={{ background: '#fbbf24', color: '#000', borderRadius: '999px', fontSize: 10, fontWeight: 800, padding: '1px 6px' }}>
              {complianceCounts!.pending} pending
            </span>
          )}
        </Link>
        <Link
          to="/dashboard/admin/account-deletion-requests"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:brightness-110"
          style={{ background: 'rgba(248,113,113,0.10)', border: '1px solid rgba(248,113,113,0.32)', color: '#f87171', textDecoration: 'none' }}
        >
          🗑️ Deletion Requests
        </Link>
        <Link
          to="/dashboard/admin/route-alerts"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:brightness-110"
          style={{ background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.32)', color: '#fbbf24', textDecoration: 'none' }}
        >
          ⚠️ Route & Driver Alerts
        </Link>
        {/* Phase MG.6 — Operational Notifications tile */}
        <Link
          to="/admin/operational-notifications"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:brightness-110"
          style={{
            background:      opUrgent > 0 ? 'rgba(249,115,22,0.13)' : opOpen > 0 ? 'rgba(251,191,36,0.10)' : 'rgba(74,222,128,0.07)',
            border:          `1px solid ${opUrgent > 0 ? 'rgba(249,115,22,0.40)' : opOpen > 0 ? 'rgba(251,191,36,0.32)' : 'rgba(74,222,128,0.22)'}`,
            color:           opUrgent > 0 ? '#f97316' : opOpen > 0 ? '#fbbf24' : '#4ade80',
            textDecoration:  'none',
          }}
          title="Review route issues, driver coverage needs, document issues, warehouse staffing, and commercial pickup alerts. Manual notification checks available inside."
        >
          🔔 Operational Notifications
          {opUrgent > 0 && (
            <span style={{ background: '#f97316', color: '#fff', borderRadius: '999px', fontSize: 10, fontWeight: 800, padding: '1px 6px' }}>
              {opUrgent} urgent
            </span>
          )}
          {opOpen > 0 && opUrgent === 0 && (
            <span style={{ background: '#fbbf24', color: '#000', borderRadius: '999px', fontSize: 10, fontWeight: 800, padding: '1px 6px' }}>
              {opOpen} open
            </span>
          )}
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.04em', color: 'rgba(255,255,255,0.32)', background: 'rgba(255,255,255,0.06)', borderRadius: '6px', padding: '1px 5px' }}>
            ⚙ checks
          </span>
        </Link>
        <Link
          to="/dashboard/admin/moderation-center"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:brightness-110"
          style={{ background: 'rgba(168,85,247,0.10)', border: '1px solid rgba(168,85,247,0.32)', color: '#a855f7', textDecoration: 'none' }}
          title="Review content reports, blocked users, compliance alerts, audit logs, and Apple safety requirements."
        >
          🛡️ Moderation & Compliance
        </Link>
        <Link
          to="/dashboard/admin/compliance-settings"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:brightness-110"
          style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.32)', color: '#4ade80', textDecoration: 'none' }}
          title="Configure document warnings, deactivation countdowns, route alert timing, and driver coverage thresholds."
        >
          ⚙️ Compliance Settings
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
