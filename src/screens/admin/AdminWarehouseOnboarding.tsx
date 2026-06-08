// AdminWarehouseOnboarding.tsx — Admin oversight of warehouse staff onboarding.
//
// Route: /dashboard/admin/warehouse-onboarding
// Access: admin, warehouse_admin, warehouse_manager
//
// Shows:
//   • Warehouse staff list with onboarding status
//   • Pending vs completed vs failed-exam vs expired-certification breakdown
//   • Training progress per staff member
//   • Recent safety incidents
//
// Safe-fail: if warehouse_* tables aren't applied yet (initial dev / staging),
// every load returns empty and the UI renders a "no data — backend not yet
// applied" notice instead of crashing.

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { DashboardShell } from '../../components/DashboardShell'
import { GlassCard } from '../../components/ui/GlassCard'
import { supabase } from '../../lib/supabase'
import { warehouseRoleLabel } from '../../lib/warehouseCompliance'
import { WAREHOUSE_TRAINING_MODULES } from '../onboarding/warehouseOnboardingData'
import type { WarehouseProfile, WarehouseIncident, WarehouseRole } from '../../types/warehouse'

interface StaffRow {
  user_id:               string
  full_name:             string | null
  email:                 string | null
  warehouse_role:        WarehouseRole | null
  assigned_warehouse_id: string | null
  shift_type:            string | null
  onboarding_status:     string | null
  certification_expires_at: string | null
  trainingPct:           number  // computed client-side from training_progress
  examPassed:            boolean
}

type Tab = 'all' | 'pending' | 'completed' | 'failed_exam' | 'expired' | 'incidents'

export default function AdminWarehouseOnboarding() {
  const [tab, setTab]               = useState<Tab>('all')
  const [staff, setStaff]           = useState<StaffRow[]>([])
  const [incidents, setIncidents]   = useState<WarehouseIncident[]>([])
  const [loading, setLoading]       = useState(true)
  const [backendReady, setBackendReady] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        // Pull warehouse profiles + join the profiles table for name/email
        const { data: whp, error: whpErr } = await supabase
          .from('warehouse_profiles')
          .select('user_id, warehouse_role, assigned_warehouse_id, shift_type, onboarding_status, certification_expires_at')
        if (whpErr) {
          // Most likely the table doesn't exist yet — switch to backend-not-ready mode
          if (!cancelled) {
            setBackendReady(false)
            setStaff([])
            setIncidents([])
          }
          return
        }
        const profiles = (whp ?? []) as Pick<WarehouseProfile, 'user_id' | 'warehouse_role' | 'assigned_warehouse_id' | 'shift_type' | 'onboarding_status' | 'certification_expires_at'>[]

        // Hydrate names from public.profiles
        const userIds = profiles.map(p => p.user_id)
        const namesById: Record<string, { full_name: string | null; email: string | null }> = {}
        if (userIds.length > 0) {
          const { data: peopleData } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', userIds)
          ;(peopleData ?? []).forEach((p: { id: string; full_name: string | null; email: string | null }) => {
            namesById[p.id] = { full_name: p.full_name, email: p.email }
          })
        }

        // Training progress: count per user_id of passed=true
        const trainPassedById: Record<string, number> = {}
        if (userIds.length > 0) {
          const { data: tps } = await supabase
            .from('warehouse_training_progress')
            .select('user_id, passed')
            .in('user_id', userIds)
          ;(tps ?? []).forEach((row: { user_id: string; passed: boolean }) => {
            if (row.passed) trainPassedById[row.user_id] = (trainPassedById[row.user_id] ?? 0) + 1
          })
        }

        // Latest exam result per user_id — single query, sort + dedup client-side
        const examPassedById: Record<string, boolean> = {}
        if (userIds.length > 0) {
          const { data: exams } = await supabase
            .from('warehouse_exam_results')
            .select('user_id, passed, attempted_at')
            .in('user_id', userIds)
            .order('attempted_at', { ascending: false })
          ;(exams ?? []).forEach((e: { user_id: string; passed: boolean }) => {
            if (examPassedById[e.user_id] === undefined) examPassedById[e.user_id] = e.passed
          })
        }

        const trainingTotal = WAREHOUSE_TRAINING_MODULES.length
        const rows: StaffRow[] = profiles.map(p => ({
          user_id:                  p.user_id,
          full_name:                namesById[p.user_id]?.full_name ?? null,
          email:                    namesById[p.user_id]?.email ?? null,
          warehouse_role:           p.warehouse_role,
          assigned_warehouse_id:    p.assigned_warehouse_id,
          shift_type:               p.shift_type,
          onboarding_status:        p.onboarding_status,
          certification_expires_at: p.certification_expires_at,
          trainingPct: trainingTotal > 0
            ? Math.round(((trainPassedById[p.user_id] ?? 0) / trainingTotal) * 100)
            : 0,
          examPassed: !!examPassedById[p.user_id],
        }))

        // Incidents
        const { data: incs } = await supabase
          .from('warehouse_incidents')
          .select('*')
          .order('reported_at', { ascending: false })
          .limit(20)

        if (!cancelled) {
          setStaff(rows)
          setIncidents((incs ?? []) as WarehouseIncident[])
          setBackendReady(true)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // Snapshot "now" each time the staff list changes so cert-expiry comparisons
  // are stable across the render and the same instant is used everywhere on
  // screen. Date.now() is impure and must run in an effect, not in render.
  const [now, setNow] = useState(0)
  useEffect(() => {
    // Date.now() is impure (lint rule react-hooks-must-be-pure), so the read
    // happens here and the result is stored. Setting state in this effect is
    // the canonical pattern for snapshotting "now" alongside async data.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now())
  }, [staff])

  const filtered = staff.filter(s => {
    switch (tab) {
      case 'pending':     return s.onboarding_status !== 'approved' && s.onboarding_status !== 'rejected'
      case 'completed':   return s.onboarding_status === 'approved'
      case 'failed_exam': return !s.examPassed && s.trainingPct === 100
      case 'expired':     return !!s.certification_expires_at && new Date(s.certification_expires_at).getTime() < now
      case 'all':
      default:            return true
    }
  })

  const counts = {
    all:         staff.length,
    pending:     staff.filter(s => s.onboarding_status !== 'approved' && s.onboarding_status !== 'rejected').length,
    completed:   staff.filter(s => s.onboarding_status === 'approved').length,
    failed_exam: staff.filter(s => !s.examPassed && s.trainingPct === 100).length,
    expired:     staff.filter(s => !!s.certification_expires_at && new Date(s.certification_expires_at).getTime() < now).length,
    incidents:   incidents.length,
  }

  return (
    <DashboardShell title="Warehouse Onboarding">
      <div className="mb-4 flex gap-2 flex-wrap">
        <Link
          to="/onboarding/warehouse"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:brightness-110"
          style={{ background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.28)', color: '#00c8ff', textDecoration: 'none' }}
        >
          🧾 Open onboarding wizard (preview)
        </Link>
      </div>

      {!backendReady && (
        <GlassCard padding="md" className="mb-4">
          <p style={{ fontSize: 13, color: 'rgba(254,215,170,1)', margin: 0 }}>
            <strong>Backend not yet applied.</strong> The warehouse onboarding tables are defined in migration
            <code style={{ fontSize: 12, padding: '0 4px' }}> 20260702000001_warehouse_onboarding.sql </code>
            but have not been applied to this environment. The wizard works in-memory; this admin view stays empty until the migration runs.
          </p>
        </GlassCard>
      )}

      <div className="flex overflow-x-auto mb-4 -mx-4 px-4 sm:mx-0 sm:px-0"
           style={{ borderBottom: '1px solid rgba(0,188,212,0.15)', scrollbarWidth: 'none' }}>
        {([
          { v: 'all',         l: `All (${counts.all})` },
          { v: 'pending',     l: `Pending Onboarding (${counts.pending})` },
          { v: 'completed',   l: `Completed (${counts.completed})` },
          { v: 'failed_exam', l: `Failed Exam (${counts.failed_exam})` },
          { v: 'expired',     l: `Expired Certs (${counts.expired})` },
          { v: 'incidents',   l: `Safety Incidents (${counts.incidents})` },
        ] as { v: Tab; l: string }[]).map(t => (
          <button
            key={t.v}
            onClick={() => setTab(t.v)}
            className="shrink-0 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors"
            style={tab === t.v
              ? { borderBottomColor: '#FFD600', color: '#FFD600' }
              : { borderBottomColor: 'transparent', color: '#7B909C' }}
          >
            {t.l}
          </button>
        ))}
      </div>

      {loading && <GlassCard padding="md"><p style={{ color: 'rgba(255,255,255,0.6)' }}>Loading…</p></GlassCard>}

      {!loading && tab === 'incidents' && <IncidentsList incidents={incidents} />}

      {!loading && tab !== 'incidents' && (
        <StaffList rows={filtered} now={now} />
      )}
    </DashboardShell>
  )
}

// ── Staff list ─────────────────────────────────────────────────────────────

function StaffList({ rows, now }: { rows: StaffRow[]; now: number }) {
  if (rows.length === 0) {
    return (
      <GlassCard padding="md">
        <p style={{ color: 'rgba(255,255,255,0.6)' }}>No warehouse staff match this filter yet.</p>
      </GlassCard>
    )
  }
  return (
    <div className="space-y-2">
      {rows.map(row => (
        <GlassCard key={row.user_id} padding="md">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 2 }}>
                {row.full_name ?? '(no name)'}
              </p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{row.email ?? '—'}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Chip label={row.warehouse_role ? warehouseRoleLabel(row.warehouse_role) : 'Role not set'} tone="cyan" />
                <Chip label={`Warehouse: ${row.assigned_warehouse_id ?? '—'}`} tone="muted" />
                <Chip label={`Shift: ${row.shift_type ?? '—'}`} tone="muted" />
                <Chip label={statusChip(row.onboarding_status)} tone={statusTone(row.onboarding_status)} />
                {row.certification_expires_at && (
                  <Chip
                    label={`Cert exp: ${new Date(row.certification_expires_at).toLocaleDateString()}`}
                    tone={new Date(row.certification_expires_at).getTime() < now ? 'red' : 'green'}
                  />
                )}
              </div>
            </div>
            <div className="text-right shrink-0">
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', margin: 0 }}>Training</p>
              <p style={{ fontSize: 22, fontWeight: 800, color: row.trainingPct === 100 ? '#4ade80' : '#fff', margin: 0 }}>
                {row.trainingPct}%
              </p>
              <p style={{ fontSize: 11, color: row.examPassed ? '#4ade80' : '#f59e0b', marginTop: 4 }}>
                Exam: {row.examPassed ? 'Passed' : 'Not passed'}
              </p>
            </div>
          </div>
        </GlassCard>
      ))}
    </div>
  )
}

// ── Incidents list ─────────────────────────────────────────────────────────

function IncidentsList({ incidents }: { incidents: WarehouseIncident[] }) {
  if (incidents.length === 0) {
    return (
      <GlassCard padding="md">
        <p style={{ color: 'rgba(255,255,255,0.6)' }}>No incidents logged.</p>
      </GlassCard>
    )
  }
  return (
    <div className="space-y-2">
      {incidents.map(inc => (
        <GlassCard key={inc.id} padding="md">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 2 }}>
                {inc.incident_type.replace(/_/g, ' ').toUpperCase()}
              </p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>{inc.description}</p>
              <div className="flex flex-wrap gap-2">
                <Chip label={inc.status.replace(/_/g, ' ')} tone={statusTone(inc.status)} />
                <Chip label={inc.severity} tone={inc.severity === 'critical' || inc.severity === 'high' ? 'red' : 'muted'} />
                <Chip label={new Date(inc.reported_at).toLocaleString()} tone="muted" />
              </div>
            </div>
          </div>
        </GlassCard>
      ))}
    </div>
  )
}

// ── Chips ──────────────────────────────────────────────────────────────────

function Chip({ label, tone }: { label: string; tone: 'cyan' | 'green' | 'red' | 'amber' | 'muted' }) {
  const styles: Record<typeof tone, React.CSSProperties> = {
    cyan:  { background: 'rgba(0,200,255,0.10)', border: '1px solid rgba(0,200,255,0.30)', color: '#00c8ff' },
    green: { background: 'rgba(74,222,128,0.10)', border: '1px solid rgba(74,222,128,0.30)', color: '#4ade80' },
    red:   { background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.30)', color: '#f87171' },
    amber: { background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.30)', color: '#fbbf24' },
    muted: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' },
  }
  return (
    <span
      className="inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold"
      style={styles[tone]}
    >
      {label}
    </span>
  )
}

function statusChip(s: string | null): string {
  if (!s) return 'Not started'
  return s.replace(/_/g, ' ')
}

function statusTone(s: string | null): 'cyan' | 'green' | 'red' | 'amber' | 'muted' {
  switch (s) {
    case 'approved':
    case 'resolved':         return 'green'
    case 'rejected':
    case 'escalated':        return 'red'
    case 'awaiting_review':
    case 'under_review':
    case 'pending_exam':     return 'amber'
    case 'in_progress':
    case 'open':             return 'cyan'
    default:                 return 'muted'
  }
}
