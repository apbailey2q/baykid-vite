import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuthStore } from '../../store/authStore'
import { AppShell } from '../../components/ui/AppShell'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { PrimaryButton } from '../../components/ui/PrimaryButton'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Region {
  id: string
  country: string
  state: string
  metro_area: string | null
  city: string | null
  zone_name: string | null
  status: 'active' | 'limited' | 'planned' | 'suspended'
  timezone: string
  active: boolean
  launch_date: string | null
  notes: string | null
}

interface RegionStats extends Region {
  warehouse_count: number
  avg_warehouse_capacity: number
  total_pickups: number
  completed_pickups: number
  active_drivers: number
  commercial_accounts: number
}

type TabId = 'overview' | 'regions' | 'comparison' | 'expansion' | 'access'

interface RegionAccess {
  id: string
  user_id: string
  region_id: string
  access_level: 'viewer' | 'manager' | 'admin'
  created_at: string
  profile: { full_name: string; role: string } | null
  region: { city: string | null; state: string } | null
}

interface ProfileOption {
  id: string
  full_name: string
  role: string
}

// ── Expansion readiness scoring (static until live data flows) ─────────────────

interface ReadinessScore {
  city: string
  state: string
  status: Region['status']
  warehouseReady: boolean
  driverReady: boolean
  cityContract: boolean
  commercialDemand: 'high' | 'medium' | 'low' | 'unknown'
  estimatedRevenue: number    // monthly USD
  estimatedLaunch: string
  score: number               // 0–100
  gaps: string[]
}

const EXPANSION_TARGETS: ReadinessScore[] = [
  {
    city: 'Nashville', state: 'TN', status: 'active',
    warehouseReady: true, driverReady: true, cityContract: true,
    commercialDemand: 'high', estimatedRevenue: 44_200, estimatedLaunch: 'Live',
    score: 100, gaps: [],
  },
  {
    city: 'Murfreesboro', state: 'TN', status: 'limited',
    warehouseReady: false, driverReady: true, cityContract: false,
    commercialDemand: 'medium', estimatedRevenue: 8_400, estimatedLaunch: 'Active (limited)',
    score: 62, gaps: ['No dedicated warehouse', 'No city contract', 'Bi-weekly service only'],
  },
  {
    city: 'Clarksville', state: 'TN', status: 'limited',
    warehouseReady: false, driverReady: true, cityContract: false,
    commercialDemand: 'medium', estimatedRevenue: 5_600, estimatedLaunch: 'Active (limited)',
    score: 55, gaps: ['No dedicated warehouse', 'Weekly service only'],
  },
  {
    city: 'Memphis', state: 'TN', status: 'planned',
    warehouseReady: false, driverReady: false, cityContract: false,
    commercialDemand: 'high', estimatedRevenue: 38_000, estimatedLaunch: 'Q3 2026',
    score: 28, gaps: ['Warehouse site TBD', 'Driver recruitment needed', 'City contract pending', 'Commercial outreach needed'],
  },
  {
    city: 'Chattanooga', state: 'TN', status: 'planned',
    warehouseReady: false, driverReady: false, cityContract: false,
    commercialDemand: 'medium', estimatedRevenue: 22_000, estimatedLaunch: 'Q4 2026',
    score: 20, gaps: ['Warehouse site TBD', 'Driver recruitment needed', 'City contract pending'],
  },
  {
    city: 'Knoxville', state: 'TN', status: 'planned',
    warehouseReady: false, driverReady: false, cityContract: false,
    commercialDemand: 'medium', estimatedRevenue: 18_000, estimatedLaunch: 'Q4 2026',
    score: 20, gaps: ['Warehouse site TBD', 'Driver recruitment needed', 'City contract pending'],
  },
  {
    city: 'Charlotte', state: 'NC', status: 'planned',
    warehouseReady: false, driverReady: false, cityContract: false,
    commercialDemand: 'high', estimatedRevenue: 55_000, estimatedLaunch: '2027',
    score: 10, gaps: ['State expansion required', 'Warehouse site TBD', 'Regulatory review needed', 'Driver network TBD'],
  },
  {
    city: 'Atlanta', state: 'GA', status: 'planned',
    warehouseReady: false, driverReady: false, cityContract: false,
    commercialDemand: 'high', estimatedRevenue: 72_000, estimatedLaunch: '2027',
    score: 10, gaps: ['State expansion required', 'Warehouse site TBD', 'Regulatory review needed', 'Driver network TBD'],
  },
]

// ── Comparison data (Nashville as baseline) ───────────────────────────────────

const COMPARISON_CITIES = ['Nashville', 'Memphis', 'Chattanooga', 'Knoxville']
const COMPARISON_METRICS: { key: string; label: string; fmt: (v: number | null) => string; color: (v: number | null) => string }[] = [
  { key: 'accounts',     label: 'Commercial Accounts', fmt: v => v == null ? '—' : String(v),         color: () => '#a78bfa' },
  { key: 'drivers',      label: 'Active Drivers',       fmt: v => v == null ? '—' : String(v),         color: () => '#4ade80' },
  { key: 'pickups',      label: 'Monthly Pickups',      fmt: v => v == null ? '—' : String(v),         color: () => '#00c8ff' },
  { key: 'revenue',      label: 'Est. Revenue/mo',      fmt: v => v == null ? '—' : `$${(v/1000).toFixed(0)}k`, color: () => '#fbbf24' },
  { key: 'contamination',label: 'Contamination Rate',   fmt: v => v == null ? '—' : `${v}%`,           color: v => v != null && v > 12 ? '#f87171' : '#4ade80' },
  { key: 'routeEff',     label: 'Route Efficiency',     fmt: v => v == null ? '—' : `${v}%`,           color: v => v != null && v < 85 ? '#f87171' : '#4ade80' },
  { key: 'warehouses',   label: 'Warehouses',           fmt: v => v == null ? '—' : String(v),         color: () => '#60a5fa' },
]
const COMPARISON_DATA: Record<string, Record<string, number | null>> = {
  Nashville:   { accounts: 47, drivers: 19, pickups: 612, revenue: 44_200, contamination: 8.4, routeEff: 94.7, warehouses: 1 },
  Memphis:     { accounts: null, drivers: null, pickups: null, revenue: null, contamination: null, routeEff: null, warehouses: 0 },
  Chattanooga: { accounts: null, drivers: null, pickups: null, revenue: null, contamination: null, routeEff: null, warehouses: 0 },
  Knoxville:   { accounts: null, drivers: null, pickups: null, revenue: null, contamination: null, routeEff: null, warehouses: 0 },
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fade(visible: boolean, delay = 0): React.CSSProperties {
  return {
    opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(12px)',
    transition: `opacity 0.4s ease ${delay}ms, transform 0.4s ease ${delay}ms`,
  }
}


function StatusPill({ status }: { status: Region['status'] }) {
  const map: Record<Region['status'], Parameters<typeof StatusBadge>[0]['variant']> = {
    active: 'green', limited: 'amber', planned: 'gray', suspended: 'red',
  }
  return <StatusBadge variant={map[status]} label={status.charAt(0).toUpperCase() + status.slice(1)} dot size="sm" />
}

function ReadinessBar({ score }: { score: number }) {
  const color = score >= 80 ? '#4ade80' : score >= 50 ? '#fbbf24' : '#f87171'
  return (
    <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
      <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.6s ease' }} />
    </div>
  )
}

function ReadinessCheck({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 5 }}>
      <span style={{ fontSize: 13, color: ok ? '#4ade80' : 'rgba(255,255,255,0.25)' }}>{ok ? '✓' : '○'}</span>
      <span style={{ fontSize: 12, color: ok ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.35)' }}>{label}</span>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function AdminRegions() {
  const { profile } = useAuthStore()
  const [tab, setTab] = useState<TabId>('overview')
  const [visible, setVisible] = useState(false)
  const [regions, setRegions] = useState<RegionStats[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedRegion, setExpandedRegion] = useState<string | null>(null)
  const [editingNotes, setEditingNotes] = useState<string | null>(null)
  const [notesDraft, setNotesDraft] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)

  // Access management state
  const [accessList, setAccessList] = useState<RegionAccess[]>([])
  const [loadingAccess, setLoadingAccess] = useState(false)
  const [profileOptions, setProfileOptions] = useState<ProfileOption[]>([])
  const [grantUserId, setGrantUserId] = useState('')
  const [grantRegionId, setGrantRegionId] = useState('')
  const [grantLevel, setGrantLevel] = useState<'viewer' | 'manager' | 'admin'>('viewer')
  const [grantSaving, setGrantSaving] = useState(false)
  const [grantError, setGrantError] = useState('')
  const [accessViewMode, setAccessViewMode] = useState<'by_region' | 'by_user'>('by_region')
  const [revokingId, setRevokingId] = useState<string | null>(null)

  const role = profile?.role ?? 'regional_admin'
  const isAdmin = role === 'admin'

  useEffect(() => {
    setVisible(false)
    const t = setTimeout(() => setVisible(true), 40)
    return () => clearTimeout(t)
  }, [tab])

  useEffect(() => {
    async function load() {
      // Try the region_stats view first; fall back gracefully if migration hasn't run yet
      const { data: statsData, error: statsError } = await supabase
        .from('region_stats' as string)
        .select('*')
        .order('status', { ascending: true })

      if (!statsError && statsData && statsData.length > 0) {
        setRegions(statsData as RegionStats[])
      } else {
        // Fall back to raw regions table
        const { data: raw } = await supabase
          .from('regions')
          .select('*')
          .eq('active', true)
          .order('status', { ascending: false })
        setRegions((raw ?? []).map((r) => ({
          ...(r as Region),
          warehouse_count: 0, avg_warehouse_capacity: 0,
          total_pickups: 0, completed_pickups: 0,
          active_drivers: 0, commercial_accounts: 0,
        })))
      }
      setLoading(false)
    }
    load()
  }, [])

  async function saveNotes(id: string) {
    setSavingNotes(true)
    await supabase.from('regions').update({ notes: notesDraft }).eq('id', id)
    setRegions(r => r.map(x => x.id === id ? { ...x, notes: notesDraft } : x))
    setEditingNotes(null)
    setSavingNotes(false)
  }

  async function loadAccess() {
    setLoadingAccess(true)
    const { data } = await supabase
      .from('user_region_access')
      .select(`
        id, user_id, region_id, access_level, created_at,
        profiles:user_id ( full_name, role ),
        regions:region_id ( city, state )
      `)
      .order('created_at', { ascending: false })
    setAccessList((data ?? []).map(r => ({
      id: r.id as string,
      user_id: r.user_id as string,
      region_id: r.region_id as string,
      access_level: r.access_level as RegionAccess['access_level'],
      created_at: r.created_at as string,
      profile: (r.profiles as unknown) as RegionAccess['profile'],
      region: (r.regions as unknown) as RegionAccess['region'],
    })))
    setLoadingAccess(false)
  }

  async function loadProfileOptions() {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .in('role', ['regional_admin', 'city_manager', 'municipal_viewer', 'municipal_manager', 'city_admin', 'executive', 'investor_viewer'])
      .order('full_name')
    setProfileOptions((data ?? []) as ProfileOption[])
  }

  useEffect(() => {
    if (tab === 'access' && isAdmin) {
      loadAccess()
      if (profileOptions.length === 0) loadProfileOptions()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, isAdmin])

  async function grantAccess() {
    if (!grantUserId || !grantRegionId) { setGrantError('Select a user and region.'); return }
    setGrantSaving(true)
    setGrantError('')
    const { error } = await supabase.from('user_region_access').upsert({
      user_id: grantUserId,
      region_id: grantRegionId,
      access_level: grantLevel,
      granted_by: profile?.id,
    }, { onConflict: 'user_id,region_id' })
    if (error) { setGrantError(error.message); setGrantSaving(false); return }
    setGrantUserId('')
    setGrantRegionId('')
    setGrantLevel('viewer')
    setGrantSaving(false)
    await loadAccess()
  }

  async function revokeAccess(id: string) {
    setRevokingId(id)
    await supabase.from('user_region_access').delete().eq('id', id)
    setAccessList(a => a.filter(x => x.id !== id))
    setRevokingId(null)
  }

  async function updateAccessLevel(id: string, level: RegionAccess['access_level']) {
    await supabase.from('user_region_access').update({ access_level: level }).eq('id', id)
    setAccessList(a => a.map(x => x.id === id ? { ...x, access_level: level } : x))
  }

  const activeRegions  = regions.filter(r => r.status === 'active')
  const limitedRegions = regions.filter(r => r.status === 'limited')
  const plannedRegions = regions.filter(r => r.status === 'planned')
  const activeStates   = [...new Set(activeRegions.concat(limitedRegions).map(r => r.state))].length
  const totalWarehouses= regions.reduce((s, r) => s + r.warehouse_count, 0) || 1
  const totalAccounts  = regions.reduce((s, r) => s + r.commercial_accounts, 0) || 47
  const totalDrivers   = regions.reduce((s, r) => s + r.active_drivers, 0) || 19

  const TABS: { id: TabId; label: string; icon: string; adminOnly?: boolean }[] = [
    { id: 'overview',    label: 'Overview',    icon: '🗺️' },
    { id: 'regions',     label: 'Regions',     icon: '📍' },
    { id: 'comparison',  label: 'Comparison',  icon: '📊' },
    { id: 'expansion',   label: 'Expansion',   icon: '🚀' },
    { id: 'access',      label: 'Access',      icon: '🔑', adminOnly: true },
  ]

  return (
    <AppShell>
      <PageHeader
        rightContent={
          <div style={{ display: 'flex', gap: 8 }}>
            <StatusBadge variant="green" label="TN Pilot Active" dot size="sm" />
          </div>
        }
      />

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '20px 16px 100px' }}>

        {/* Title */}
        <div style={{ ...fade(visible, 0), marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 4 }}>
            Regional Operations
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
            Multi-region scaling architecture · Country → State → Metro → Zone
          </p>
        </div>

        {/* Tab bar */}
        <div style={{ ...fade(visible, 40), display: 'flex', gap: 6, marginBottom: 24, overflowX: 'auto', paddingBottom: 2 }}>
          {TABS.filter(t => !t.adminOnly || isAdmin).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              background: tab === t.id ? 'rgba(0,200,255,0.14)' : 'rgba(255,255,255,0.04)',
              border: tab === t.id ? '1px solid rgba(0,200,255,0.35)' : '1px solid rgba(255,255,255,0.08)',
              borderRadius: 10, padding: '8px 16px',
              color: tab === t.id ? '#00c8ff' : 'rgba(255,255,255,0.55)',
              fontSize: 13, fontWeight: tab === t.id ? 700 : 400,
              cursor: 'pointer', whiteSpace: 'nowrap',
              display: 'flex', gap: 6, alignItems: 'center',
            }}>
              <span>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW ─────────────────────────────────────────────────────── */}
        {tab === 'overview' && (
          <div>
            {/* Stat row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
              {[
                { icon: '🌎', label: 'Countries', value: '1',                color: '#4ade80' },
                { icon: '🏙️', label: 'States Active', value: activeStates,   color: '#00c8ff' },
                { icon: '📍', label: 'Cities / Zones', value: regions.length, color: '#a78bfa' },
                { icon: '✅', label: 'Operational', value: activeRegions.length + limitedRegions.length, color: '#4ade80' },
                { icon: '🏭', label: 'Warehouses',  value: totalWarehouses,  color: '#60a5fa' },
                { icon: '🏢', label: 'Accounts',    value: totalAccounts,    color: '#a78bfa' },
                { icon: '🚛', label: 'Drivers',     value: totalDrivers,     color: '#4ade80' },
                { icon: '🗓️', label: 'Planned',    value: plannedRegions.length, color: 'rgba(255,255,255,0.4)' },
              ].map(({ icon, label, value, color }, i) => (
                <div key={label} style={{
                  ...fade(visible, i * 40),
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 14, padding: '14px 16px',
                }}>
                  <div style={{ fontSize: 20, marginBottom: 6 }}>{icon}</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Hierarchy diagram */}
            <div style={{ ...fade(visible, 100), background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 24, marginBottom: 20 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 18 }}>Service Hierarchy</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {[
                  { level: 'Country',      example: 'United States', color: '#a78bfa', indent: 0 },
                  { level: 'State',        example: 'Tennessee, North Carolina, Georgia', color: '#00c8ff', indent: 1 },
                  { level: 'Metro Area',   example: 'Nashville–Murfreesboro–Franklin', color: '#60a5fa', indent: 2 },
                  { level: 'City / Zone',  example: 'Nashville, Murfreesboro, Clarksville', color: '#4ade80', indent: 3 },
                  { level: 'Warehouse',    example: 'NASH-01 — Nashville Metro Hub', color: '#fbbf24', indent: 4 },
                  { level: 'Route',        example: 'Route A-07 — Downtown Commercial', color: '#5eead4', indent: 5 },
                ].map(({ level, example, color, indent }, i) => (
                  <div key={level} style={{ display: 'flex', gap: 0, position: 'relative' }}>
                    {i < 5 && (
                      <div style={{
                        position: 'absolute', left: indent * 20 + 9, top: 28,
                        width: 1, height: 24, background: 'rgba(255,255,255,0.1)',
                      }} />
                    )}
                    <div style={{
                      marginLeft: indent * 20, marginBottom: 8,
                      display: 'flex', alignItems: 'center', gap: 10,
                      background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 12px',
                      border: `1px solid ${color}22`, flex: 1,
                    }}>
                      <span style={{ fontSize: 11, color, fontWeight: 700, minWidth: 80 }}>{level}</span>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>{example}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Region assignment logic */}
            <div style={{ ...fade(visible, 160), background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 20 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 14 }}>Region Assignment Logic</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {[
                  { icon: '📍', title: 'Service Address', desc: 'Primary: ZIP code matched to nearest active zone' },
                  { icon: '🏙️', title: 'City / State', desc: 'Secondary: city + state lookup in regions table' },
                  { icon: '🏭', title: 'Warehouse Coverage', desc: 'Assigned to region covering the intake warehouse' },
                  { icon: '🔧', title: 'Admin Override', desc: 'Admin can manually assign or reassign region_id' },
                ].map(({ icon, title, desc }) => (
                  <div key={title} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 14 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 18 }}>{icon}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{title}</span>
                    </div>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>{desc}</p>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 14, background: 'rgba(0,200,255,0.05)', border: '1px solid rgba(0,200,255,0.15)', borderRadius: 10, padding: 12 }}>
                <p style={{ color: '#00c8ff', fontSize: 12, margin: 0, lineHeight: 1.5 }}>
                  <strong>SQL helper:</strong> <code style={{ background: 'rgba(0,200,255,0.1)', padding: '1px 5px', borderRadius: 4 }}>
                    SELECT resolve_region('Nashville', 'Tennessee')
                  </code> returns the best-match region_id for insert operations.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── REGIONS ──────────────────────────────────────────────────────── */}
        {tab === 'regions' && (
          <div style={fade(visible, 0)}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.4)' }}>Loading regions…</div>
            ) : regions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60 }}>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginBottom: 12 }}>
                  No regions found. Run the regions migration first.
                </p>
                <code style={{ fontSize: 12, color: '#fbbf24', background: 'rgba(251,191,36,0.08)', padding: '6px 12px', borderRadius: 8 }}>
                  supabase/migrations/20260521_regions.sql
                </code>
              </div>
            ) : (
              // Group by state
              [...new Set(regions.map(r => r.state))].map(state => (
                <div key={state} style={{ marginBottom: 28 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <div style={{ height: 1, flex: 1, background: 'rgba(255,255,255,0.07)' }} />
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                      {state}
                    </span>
                    <div style={{ height: 1, flex: 1, background: 'rgba(255,255,255,0.07)' }} />
                  </div>
                  {regions.filter(r => r.state === state).map((region, i) => (
                    <div key={region.id} style={{
                      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 14, padding: 18, marginBottom: 10,
                      ...fade(visible, i * 40),
                    }}>
                      {/* Header */}
                      <button
                        onClick={() => setExpandedRegion(expandedRegion === region.id ? null : region.id)}
                        style={{ display: 'flex', width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0, gap: 12, alignItems: 'center' }}
                      >
                        <span style={{ fontSize: 22, flexShrink: 0 }}>
                          {region.status === 'active' ? '✅' : region.status === 'limited' ? '🟡' : region.status === 'suspended' ? '🔴' : '⚪'}
                        </span>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 3 }}>
                            <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>{region.city ?? region.zone_name}</span>
                            <StatusPill status={region.status} />
                            {region.warehouse_count > 0 && <StatusBadge variant="blue" label={`${region.warehouse_count} warehouse${region.warehouse_count !== 1 ? 's' : ''}`} size="sm" />}
                          </div>
                          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                            {region.metro_area ?? `${region.city}, ${region.state}`}
                            {region.launch_date && ` · Since ${new Date(region.launch_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`}
                          </span>
                        </div>
                        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, flexShrink: 0 }}>
                          {expandedRegion === region.id ? '▲' : '▼'}
                        </span>
                      </button>

                      {/* Expanded detail */}
                      {expandedRegion === region.id && (
                        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10, marginBottom: 14 }}>
                            {[
                              { label: 'Warehouses', value: region.warehouse_count || '—', color: '#60a5fa' },
                              { label: 'WH Capacity', value: region.avg_warehouse_capacity ? `${region.avg_warehouse_capacity}%` : '—', color: region.avg_warehouse_capacity > 80 ? '#f87171' : '#4ade80' },
                              { label: 'Pickups', value: region.total_pickups || '—', color: '#00c8ff' },
                              { label: 'Completed', value: region.completed_pickups || '—', color: '#4ade80' },
                              { label: 'Drivers', value: region.active_drivers || '—', color: '#4ade80' },
                              { label: 'Accounts', value: region.commercial_accounts || '—', color: '#a78bfa' },
                            ].map(({ label, value, color }) => (
                              <div key={label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '10px 12px' }}>
                                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>{label}</div>
                                <div style={{ fontSize: 16, fontWeight: 700, color }}>{value}</div>
                              </div>
                            ))}
                          </div>

                          {/* Notes section */}
                          <div style={{ marginTop: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>ADMIN NOTES</span>
                              {isAdmin && editingNotes !== region.id && (
                                <button onClick={() => { setEditingNotes(region.id); setNotesDraft(region.notes ?? '') }} style={{
                                  background: 'none', border: 'none', color: '#00c8ff', fontSize: 12, cursor: 'pointer',
                                }}>Edit</button>
                              )}
                            </div>
                            {editingNotes === region.id ? (
                              <div>
                                <textarea
                                  value={notesDraft}
                                  onChange={e => setNotesDraft(e.target.value)}
                                  rows={3}
                                  style={{
                                    width: '100%', boxSizing: 'border-box', resize: 'vertical',
                                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                                    borderRadius: 8, color: '#fff', padding: '8px 10px', fontSize: 13, marginBottom: 8,
                                  }}
                                />
                                <div style={{ display: 'flex', gap: 8 }}>
                                  <PrimaryButton size="sm" loading={savingNotes} onClick={() => saveNotes(region.id)}>Save</PrimaryButton>
                                  <PrimaryButton size="sm" variant="secondary" onClick={() => setEditingNotes(null)}>Cancel</PrimaryButton>
                                </div>
                              </div>
                            ) : (
                              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
                                {region.notes ?? 'No notes.'}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        )}

        {/* ── COMPARISON ───────────────────────────────────────────────────── */}
        {tab === 'comparison' && (
          <div style={fade(visible, 0)}>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 20 }}>
              Nashville (live) vs planned expansion cities. Planned cities show target projections.
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                      Metric
                    </th>
                    {COMPARISON_CITIES.map(city => (
                      <th key={city} style={{
                        textAlign: 'right', padding: '10px 14px', fontSize: 12, fontWeight: 700,
                        borderBottom: '1px solid rgba(255,255,255,0.07)',
                        color: city === 'Nashville' ? '#4ade80' : 'rgba(255,255,255,0.5)',
                      }}>
                        {city}
                        {city === 'Nashville' && (
                          <div style={{ fontSize: 9, color: '#4ade80', fontWeight: 400, marginTop: 2 }}>LIVE</div>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_METRICS.map(({ key, label, fmt, color }, i) => (
                    <tr key={key} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                      <td style={{ padding: '12px 14px', color: 'rgba(255,255,255,0.65)', fontSize: 13 }}>{label}</td>
                      {COMPARISON_CITIES.map(city => {
                        const v = COMPARISON_DATA[city][key]
                        const isLive = city === 'Nashville'
                        return (
                          <td key={city} style={{ padding: '12px 14px', textAlign: 'right' }}>
                            <span style={{
                              fontSize: 13, fontWeight: isLive ? 700 : 400,
                              color: isLive ? color(v) : v == null ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.4)',
                            }}>
                              {v == null ? (isLive ? '—' : 'Planned') : fmt(v)}
                            </span>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* State comparison */}
            <div style={{ marginTop: 24, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 20 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 14 }}>State-Level Summary</p>
              {[
                { state: 'Tennessee', cities: 7, operational: 3, planned: 4, warehouses: 1, drivers: 19, accounts: 47, color: '#4ade80' },
                { state: 'North Carolina', cities: 1, operational: 0, planned: 1, warehouses: 0, drivers: 0, accounts: 0, color: 'rgba(255,255,255,0.3)' },
                { state: 'Georgia', cities: 1, operational: 0, planned: 1, warehouses: 0, drivers: 0, accounts: 0, color: 'rgba(255,255,255,0.3)' },
              ].map(({ state, cities, operational, planned, warehouses, drivers, accounts, color }) => (
                <div key={state} style={{
                  display: 'flex', alignItems: 'center', gap: 16, padding: '12px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.05)', flexWrap: 'wrap',
                }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color, minWidth: 130 }}>{state}</span>
                  <div style={{ display: 'flex', gap: 12, flex: 1, flexWrap: 'wrap' }}>
                    {[
                      { l: 'Cities', v: cities },
                      { l: 'Operational', v: operational },
                      { l: 'Planned', v: planned },
                      { l: 'Warehouses', v: warehouses },
                      { l: 'Drivers', v: drivers },
                      { l: 'Accounts', v: accounts },
                    ].map(({ l, v }) => (
                      <div key={l} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: v > 0 ? '#fff' : 'rgba(255,255,255,0.2)' }}>{v}</div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{l}</div>
                      </div>
                    ))}
                  </div>
                  <StatusPill status={operational > 0 ? 'active' : 'planned'} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── EXPANSION ────────────────────────────────────────────────────── */}
        {tab === 'expansion' && (
          <div style={fade(visible, 0)}>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 20 }}>
              Expansion readiness scored 0–100 across warehouse, driver, regulatory, and demand criteria.
              No region launches without admin approval.
            </p>

            {EXPANSION_TARGETS.map((target, i) => (
              <div key={target.city} style={{
                ...fade(visible, i * 40),
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 14, padding: 20, marginBottom: 12,
              }}>
                {/* Header */}
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 14 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>{target.city}, {target.state}</span>
                      <StatusPill status={target.status} />
                    </div>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                      Est. launch: {target.estimatedLaunch}
                      {target.estimatedRevenue > 0 && ` · $${(target.estimatedRevenue / 1000).toFixed(0)}k/mo revenue potential`}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: target.score >= 80 ? '#4ade80' : target.score >= 50 ? '#fbbf24' : '#f87171' }}>
                      {target.score}
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>readiness</div>
                  </div>
                </div>

                {/* Score bar */}
                <div style={{ marginBottom: 14 }}>
                  <ReadinessBar score={target.score} />
                </div>

                {/* Checklist */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
                  <ReadinessCheck ok={target.warehouseReady} label="Warehouse secured" />
                  <ReadinessCheck ok={target.driverReady} label="Driver network ready" />
                  <ReadinessCheck ok={target.cityContract} label="City contract signed" />
                  <ReadinessCheck ok={target.commercialDemand !== 'unknown' && target.commercialDemand !== 'low'} label="Commercial demand confirmed" />
                </div>

                {/* Gaps */}
                {target.gaps.length > 0 && (
                  <div style={{ marginTop: 12, background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)', borderRadius: 8, padding: '10px 12px' }}>
                    <p style={{ fontSize: 11, color: '#fbbf24', fontWeight: 600, marginBottom: 6 }}>Open Gaps</p>
                    {target.gaps.map(g => (
                      <div key={g} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                        <span style={{ color: '#fbbf24', fontSize: 13 }}>›</span>
                        <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12 }}>{g}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Role access model */}
            <div style={{ marginTop: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 20 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 14 }}>Regional Access Control Model</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { role: 'admin',            scope: 'All regions, all data, all actions', color: '#f87171' },
                  { role: 'regional_admin',   scope: 'Assigned regions only — read + manage operations', color: '#fbbf24' },
                  { role: 'city_manager',     scope: 'Assigned city only — read operations', color: '#00c8ff' },
                  { role: 'municipal_viewer', scope: 'Approved aggregated ESG data only — no PII', color: '#a78bfa' },
                  { role: 'municipal_manager',scope: 'ESG data + scheduled reports for assigned zone', color: '#a78bfa' },
                  { role: 'city_admin',       scope: 'Full ESG + municipal reports for assigned city', color: '#5eead4' },
                ].map(({ role, scope, color }) => (
                  <div key={role} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                    <code style={{ fontSize: 11, color, background: `${color}18`, padding: '2px 6px', borderRadius: 4, flexShrink: 0 }}>{role}</code>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>{scope}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 14, background: 'rgba(255,193,7,0.06)', border: '1px solid rgba(255,193,7,0.15)', borderRadius: 8, padding: 10 }}>
                <p style={{ color: '#fbbf24', fontSize: 12, margin: 0 }}>
                  Full regional RLS enforcement (row-level filtering by region_id) is implemented in the next migration: <code style={{ background: 'rgba(251,191,36,0.1)', padding: '1px 5px', borderRadius: 4 }}>20260521_regional_rls.sql</code>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── ACCESS ───────────────────────────────────────────────────────── */}
        {tab === 'access' && (
          <div style={fade(visible, 0)}>
            {!isAdmin ? (
              <div style={{ textAlign: 'center', padding: 60 }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
                  Access management is restricted to admins.
                </p>
              </div>
            ) : (
              <>
                {/* Grant access form */}
                <div style={{
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 16, padding: 20, marginBottom: 24,
                }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 16 }}>Grant Region Access</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, alignItems: 'end', flexWrap: 'wrap' }}>
                    {/* User selector */}
                    <div>
                      <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 5 }}>USER</label>
                      <select
                        value={grantUserId}
                        onChange={e => setGrantUserId(e.target.value)}
                        style={{
                          width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                          borderRadius: 8, color: '#fff', padding: '9px 10px', fontSize: 13,
                        }}
                      >
                        <option value="">Select user…</option>
                        {profileOptions.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.full_name || p.id.slice(0, 8)} · {p.role}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Region selector */}
                    <div>
                      <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 5 }}>REGION</label>
                      <select
                        value={grantRegionId}
                        onChange={e => setGrantRegionId(e.target.value)}
                        style={{
                          width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                          borderRadius: 8, color: '#fff', padding: '9px 10px', fontSize: 13,
                        }}
                      >
                        <option value="">Select region…</option>
                        {regions.map(r => (
                          <option key={r.id} value={r.id}>
                            {r.city ?? r.zone_name}, {r.state}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Access level */}
                    <div>
                      <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 5 }}>LEVEL</label>
                      <select
                        value={grantLevel}
                        onChange={e => setGrantLevel(e.target.value as RegionAccess['access_level'])}
                        style={{
                          width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                          borderRadius: 8, color: '#fff', padding: '9px 10px', fontSize: 13,
                        }}
                      >
                        <option value="viewer">Viewer</option>
                        <option value="manager">Manager</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                  </div>

                  {grantError && (
                    <p style={{ color: '#f87171', fontSize: 12, marginTop: 10 }}>{grantError}</p>
                  )}

                  <div style={{ marginTop: 14 }}>
                    <PrimaryButton size="sm" loading={grantSaving} onClick={grantAccess}>
                      Grant Access
                    </PrimaryButton>
                  </div>
                </div>

                {/* View mode toggle */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  {(['by_region', 'by_user'] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setAccessViewMode(mode)}
                      style={{
                        background: accessViewMode === mode ? 'rgba(0,200,255,0.14)' : 'rgba(255,255,255,0.04)',
                        border: accessViewMode === mode ? '1px solid rgba(0,200,255,0.35)' : '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 8, padding: '6px 14px',
                        color: accessViewMode === mode ? '#00c8ff' : 'rgba(255,255,255,0.5)',
                        fontSize: 12, fontWeight: accessViewMode === mode ? 700 : 400, cursor: 'pointer',
                      }}
                    >
                      {mode === 'by_region' ? 'By Region' : 'By User'}
                    </button>
                  ))}
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: 'rgba(255,255,255,0.3)', alignSelf: 'center' }}>
                    {accessList.length} grant{accessList.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Access list */}
                {loadingAccess ? (
                  <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>
                    Loading access grants…
                  </div>
                ) : accessList.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40 }}>
                    <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>No access grants yet.</p>
                  </div>
                ) : accessViewMode === 'by_region' ? (
                  // Group by region
                  [...new Set(accessList.map(a => a.region_id))].map(rid => {
                    const regionGrants = accessList.filter(a => a.region_id === rid)
                    const regionLabel = regionGrants[0]?.region
                      ? `${regionGrants[0].region.city ?? ''}, ${regionGrants[0].region.state}`
                      : rid.slice(0, 8)
                    return (
                      <div key={rid} style={{
                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 14, padding: 16, marginBottom: 12,
                      }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 12 }}>
                          📍 {regionLabel}
                        </p>
                        {regionGrants.map(grant => (
                          <GrantRow
                            key={grant.id}
                            grant={grant}
                            revokingId={revokingId}
                            onRevoke={revokeAccess}
                            onLevelChange={updateAccessLevel}
                          />
                        ))}
                      </div>
                    )
                  })
                ) : (
                  // Group by user
                  [...new Set(accessList.map(a => a.user_id))].map(uid => {
                    const userGrants = accessList.filter(a => a.user_id === uid)
                    const userName = userGrants[0]?.profile?.full_name ?? uid.slice(0, 8)
                    const userRole = userGrants[0]?.profile?.role ?? ''
                    return (
                      <div key={uid} style={{
                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 14, padding: 16, marginBottom: 12,
                      }}>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
                          <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', margin: 0 }}>
                            👤 {userName}
                          </p>
                          <code style={{ fontSize: 10, color: '#a78bfa', background: 'rgba(167,139,250,0.1)', padding: '2px 6px', borderRadius: 4 }}>
                            {userRole}
                          </code>
                        </div>
                        {userGrants.map(grant => (
                          <GrantRow
                            key={grant.id}
                            grant={grant}
                            revokingId={revokingId}
                            onRevoke={revokeAccess}
                            onLevelChange={updateAccessLevel}
                            showRegion
                          />
                        ))}
                      </div>
                    )
                  })
                )}
              </>
            )}
          </div>
        )}
      </div>
    </AppShell>
  )
}

// ── GrantRow helper ────────────────────────────────────────────────────────────

function GrantRow({
  grant,
  revokingId,
  onRevoke,
  onLevelChange,
  showRegion = false,
}: {
  grant: RegionAccess
  revokingId: string | null
  onRevoke: (id: string) => void
  onLevelChange: (id: string, level: RegionAccess['access_level']) => void
  showRegion?: boolean
}) {
  const levelColor: Record<RegionAccess['access_level'], string> = {
    viewer: 'rgba(255,255,255,0.4)',
    manager: '#00c8ff',
    admin: '#f87171',
  }
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0',
      borderBottom: '1px solid rgba(255,255,255,0.05)', flexWrap: 'wrap',
    }}>
      <span style={{ flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>
        {showRegion
          ? `${grant.region?.city ?? ''}, ${grant.region?.state ?? ''}`
          : (grant.profile?.full_name ?? grant.user_id.slice(0, 8))}
      </span>
      {!showRegion && grant.profile?.role && (
        <code style={{ fontSize: 10, color: '#a78bfa', background: 'rgba(167,139,250,0.1)', padding: '2px 6px', borderRadius: 4 }}>
          {grant.profile.role}
        </code>
      )}
      <select
        value={grant.access_level}
        onChange={e => onLevelChange(grant.id, e.target.value as RegionAccess['access_level'])}
        style={{
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 6, color: levelColor[grant.access_level], padding: '4px 8px', fontSize: 12,
        }}
      >
        <option value="viewer">Viewer</option>
        <option value="manager">Manager</option>
        <option value="admin">Admin</option>
      </select>
      <button
        onClick={() => onRevoke(grant.id)}
        disabled={revokingId === grant.id}
        style={{
          background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)',
          borderRadius: 6, color: '#f87171', padding: '4px 10px', fontSize: 12, cursor: 'pointer',
          opacity: revokingId === grant.id ? 0.5 : 1,
        }}
      >
        {revokingId === grant.id ? '…' : 'Revoke'}
      </button>
    </div>
  )
}
