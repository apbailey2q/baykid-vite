/**
 * DispatcherLiveMap
 *
 * Admin/dispatcher screen showing all currently-active drivers with their
 * latest GPS location, status, and assigned pickup info.
 *
 * Uses a Supabase realtime subscription so the list updates automatically
 * without manual refresh.  Falls back to polling every 20 s if realtime
 * is unavailable.
 */

import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────

interface LiveLocation {
  id:                   string
  driver_id:            string
  latitude:             number
  longitude:            number
  heading:              number | null
  speed:                number | null
  accuracy:             number | null
  route_stop_id:        string | null
  commercial_pickup_id: string | null
  status:               'en_route' | 'at_stop' | 'returning' | 'offline'
  updated_at:           string
}

interface DriverProfile {
  id:                  string
  full_name:           string
  driver_service_type: string | null
}

interface DriverRow {
  loc:     LiveLocation
  profile: DriverProfile | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function gpsAge(updatedAt: string): { minutes: number; stale: boolean } {
  const minutes = Math.floor((Date.now() - new Date(updatedAt).getTime()) / 60_000)
  return { minutes, stale: minutes > 5 }
}

function formatCoord(n: number, decimals = 4): string {
  return n.toFixed(decimals)
}

function statusLabel(status: LiveLocation['status']): { text: string; color: string } {
  const map: Record<LiveLocation['status'], { text: string; color: string }> = {
    en_route:  { text: 'En Route',     color: '#4ade80' },
    at_stop:   { text: 'At Stop',      color: '#fbbf24' },
    returning: { text: 'Returning',    color: '#00c8ff' },
    offline:   { text: 'Offline',      color: '#6b7280' },
  }
  return map[status] ?? { text: status, color: '#6b7280' }
}

function headingArrow(heading: number | null): string {
  if (heading == null) return '○'
  const dirs = ['↑','↗','→','↘','↓','↙','←','↖']
  return dirs[Math.round(heading / 45) % 8]
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function DispatcherLiveMap() {
  const navigate = useNavigate()
  const [drivers, setDrivers]   = useState<DriverRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [lastSync, setLastSync] = useState<Date | null>(null)
  const [error, setError]       = useState<string | null>(null)

  // ── Data fetch ─────────────────────────────────────────────────────────────

  const fetchDrivers = useCallback(async () => {
    try {
      // 1. Active driver locations (exclude offline)
      const { data: locs, error: locErr } = await supabase
        .from('driver_live_locations')
        .select('*')
        .neq('status', 'offline')
        .order('updated_at', { ascending: false })

      if (locErr) throw locErr

      if (!locs || locs.length === 0) {
        setDrivers([])
        setLastSync(new Date())
        setLoading(false)
        return
      }

      // 2. Driver profiles (driver_live_locations.driver_id → profiles.id)
      const driverIds = locs.map((l) => l.driver_id)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, driver_service_type')
        .in('id', driverIds)

      const profileMap = new Map<string, DriverProfile>()
      for (const p of profiles ?? []) profileMap.set(p.id, p)

      const rows: DriverRow[] = locs.map((loc) => ({
        loc:     loc as LiveLocation,
        profile: profileMap.get(loc.driver_id) ?? null,
      }))

      setDrivers(rows)
      setLastSync(new Date())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load driver locations')
    } finally {
      setLoading(false)
    }
  }, [])

  // ── Initial load ───────────────────────────────────────────────────────────

  useEffect(() => {
    void fetchDrivers()
  }, [fetchDrivers])

  // ── Realtime subscription ──────────────────────────────────────────────────

  useEffect(() => {
    const channel = supabase
      .channel('dispatcher-live-map')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'driver_live_locations' },
        () => { void fetchDrivers() },
      )
      .subscribe()

    // Polling fallback (20 s) in case realtime is unavailable
    const interval = setInterval(() => { void fetchDrivers() }, 20_000)

    return () => {
      void supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [fetchDrivers])

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen" style={{ background: '#060e24' }}>

      {/* Background orbs */}
      <div className="pointer-events-none fixed inset-0" style={{ zIndex: 0 }}>
        <div style={{ position: 'absolute', top: -80, left: -60, width: 260, height: 260, background: 'rgba(0,100,255,0.25)', filter: 'blur(70px)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: 40, right: -40, width: 200, height: 200, background: 'rgba(0,190,255,0.2)', filter: 'blur(60px)', borderRadius: '50%' }} />
      </div>

      <div className="relative" style={{ zIndex: 1 }}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div
          style={{
            position:         'sticky',
            top:              0,
            zIndex:           20,
            background:       'rgba(6,14,36,0.9)',
            backdropFilter:   'blur(20px)',
            borderBottom:     '1px solid rgba(0,200,255,0.15)',
            padding:          '16px 20px',
            display:          'flex',
            alignItems:       'center',
            gap:              12,
          }}
        >
          <button
            onClick={() => navigate('/dashboard/admin')}
            style={{
              background:   'rgba(0,200,255,0.08)',
              border:       '1px solid rgba(0,200,255,0.2)',
              borderRadius: 10,
              color:        '#00c8ff',
              fontSize:     13,
              fontWeight:   700,
              padding:      '6px 14px',
              cursor:       'pointer',
            }}
          >
            ‹ Admin
          </button>

          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 17, fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>
              🗺️ Dispatcher Live Map
            </p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
              Active drivers · updates in real-time
            </p>
          </div>

          {/* Sync indicator */}
          <div style={{ textAlign: 'right' }}>
            {lastSync && (
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
                Synced {lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </p>
            )}
            <div
              style={{
                display:      'inline-flex',
                alignItems:   'center',
                gap:          5,
                fontSize:      11,
                fontWeight:    700,
                color:         '#4ade80',
                marginTop:     2,
              }}
            >
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 6px #4ade80' }} />
              Live
            </div>
          </div>
        </div>

        {/* ── Summary strip ──────────────────────────────────────────────── */}
        <div
          style={{
            display:      'flex',
            gap:          12,
            padding:      '14px 20px',
            borderBottom: '1px solid rgba(0,200,255,0.08)',
          }}
        >
          {[
            { label: 'Active Drivers', value: drivers.length },
            { label: 'En Route',       value: drivers.filter(d => d.loc.status === 'en_route').length },
            { label: 'At Stop',        value: drivers.filter(d => d.loc.status === 'at_stop').length },
            { label: 'Returning',      value: drivers.filter(d => d.loc.status === 'returning').length },
          ].map(({ label, value }) => (
            <div
              key={label}
              style={{
                flex:         1,
                background:   'rgba(0,200,255,0.05)',
                border:       '1px solid rgba(0,200,255,0.12)',
                borderRadius: 12,
                padding:      '10px 12px',
                textAlign:    'center',
              }}
            >
              <p style={{ fontSize: 20, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{value}</p>
              <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 3 }}>{label}</p>
            </div>
          ))}
        </div>

        {/* ── Content ────────────────────────────────────────────────────── */}
        <div style={{ padding: '16px 20px', paddingBottom: 40 }}>

          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200, flexDirection: 'column', gap: 12 }}>
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" style={{ borderColor: '#00c8ff', borderTopColor: 'transparent' }} />
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Loading driver locations…</p>
            </div>
          )}

          {error && !loading && (
            <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 14, padding: '16px 18px', marginBottom: 16 }}>
              <p style={{ fontSize: 13, color: '#f87171', fontWeight: 600 }}>⚠ Failed to load locations</p>
              <p style={{ fontSize: 12, color: 'rgba(248,113,113,0.7)', marginTop: 4 }}>{error}</p>
              <button
                onClick={() => void fetchDrivers()}
                style={{ marginTop: 10, fontSize: 12, color: '#00c8ff', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && drivers.length === 0 && (
            <div
              style={{
                display:        'flex',
                flexDirection:  'column',
                alignItems:     'center',
                justifyContent: 'center',
                minHeight:      280,
                gap:            14,
                textAlign:      'center',
              }}
            >
              <div
                style={{
                  width:        64,
                  height:       64,
                  borderRadius: 20,
                  background:   'rgba(0,200,255,0.07)',
                  border:       '1px solid rgba(0,200,255,0.15)',
                  display:      'flex',
                  alignItems:   'center',
                  justifyContent: 'center',
                  fontSize:     28,
                }}
              >
                🚛
              </div>
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>No active drivers</p>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 6, maxWidth: 240, lineHeight: 1.5 }}>
                  Drivers appear here when they go online and their device shares location.
                </p>
              </div>
            </div>
          )}

          {/* ── Driver cards ──────────────────────────────────────────────── */}
          {!loading && drivers.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {drivers.map(({ loc, profile }) => {
                const age    = gpsAge(loc.updated_at)
                const status = statusLabel(loc.status)

                return (
                  <div
                    key={loc.driver_id}
                    style={{
                      background:   'rgba(255,255,255,0.03)',
                      border:       `1px solid ${age.stale ? 'rgba(251,191,36,0.25)' : 'rgba(0,200,255,0.15)'}`,
                      borderRadius: 18,
                      padding:      '16px 18px',
                    }}
                  >
                    {/* Driver identity + status */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {/* Avatar initial */}
                        <div
                          style={{
                            width:        36,
                            height:       36,
                            borderRadius: '50%',
                            background:   'linear-gradient(135deg,#0057e7,#00c8ff)',
                            display:      'flex',
                            alignItems:   'center',
                            justifyContent: 'center',
                            fontSize:     14,
                            fontWeight:   800,
                            color:        '#fff',
                            flexShrink:   0,
                          }}
                        >
                          {(profile?.full_name ?? 'D').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>
                            {profile?.full_name ?? 'Unknown Driver'}
                          </p>
                          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>
                            {profile?.driver_service_type?.replace('_', ' ') ?? 'Driver'}
                          </p>
                        </div>
                      </div>

                      {/* Status badge */}
                      <div
                        style={{
                          background:   `${status.color}18`,
                          border:       `1px solid ${status.color}40`,
                          borderRadius: 20,
                          padding:      '4px 10px',
                          fontSize:     11,
                          fontWeight:   700,
                          color:        status.color,
                        }}
                      >
                        {status.text}
                      </div>
                    </div>

                    {/* Location row */}
                    <div
                      style={{
                        display:      'flex',
                        alignItems:   'center',
                        gap:          8,
                        padding:      '8px 10px',
                        background:   'rgba(0,200,255,0.04)',
                        borderRadius: 10,
                        marginBottom: 10,
                        flexWrap:     'wrap',
                      }}
                    >
                      <span style={{ fontSize: 18 }}>
                        {headingArrow(loc.heading)}
                      </span>
                      <span style={{ fontSize: 12, color: '#00c8ff', fontFamily: 'monospace', fontWeight: 700 }}>
                        {formatCoord(loc.latitude)}°N, {formatCoord(loc.longitude)}°W
                      </span>
                      {loc.speed != null && loc.speed > 0 && (
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginLeft: 'auto' }}>
                          {(loc.speed * 3.6).toFixed(0)} km/h
                        </span>
                      )}
                      {loc.accuracy != null && (
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                          ±{Math.round(loc.accuracy)}m
                        </span>
                      )}
                    </div>

                    {/* GPS age + assigned pickup */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <p
                        style={{
                          fontSize:   11,
                          fontWeight: 600,
                          color:      age.stale ? '#fbbf24' : 'rgba(255,255,255,0.35)',
                        }}
                      >
                        {age.stale ? '⚠ ' : '● '}
                        GPS {age.minutes === 0 ? 'just now' : `${age.minutes}m ago`}
                        {age.stale ? ' (stale)' : ''}
                      </p>

                      {loc.commercial_pickup_id ? (
                        <p style={{ fontSize: 11, color: '#4ade80', fontWeight: 600 }}>
                          📦 Commercial pickup assigned
                        </p>
                      ) : loc.route_stop_id ? (
                        <p style={{ fontSize: 11, color: '#00c8ff', fontWeight: 600 }}>
                          📍 Route stop assigned
                        </p>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
