// ── Driver: Available Pickups (real consumer scans only) ────────────────────
// Data source: public.consumer_bag_scans WHERE scan_status IN ('active',
// 'pending_pickup'). RLS for drivers is granted by migration
// 20260528_drivers_can_read_consumer_scans.sql — without it, this query
// returns zero rows for any driver.
//
// Per spec: NO mock/demo/sample/fallback data. If the query returns nothing,
// the user sees an empty state — never a placeholder list.

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PickupInput {
  id:      string
  address: string
  bags:    number
}

interface AvailablePickup {
  id:          string
  qr_code:     string
  bag_id:      string | null
  scan_status: string
  scanned_at:  string
}

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  active:         { label: 'Active',         color: '#5BFFB0', bg: 'rgba(91,255,176,0.10)' },
  pending_pickup: { label: 'Pending pickup', color: '#FFB340', bg: 'rgba(255,179,64,0.10)' },
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const s  = Math.max(0, Math.floor(ms / 1000))
  if (s < 60)  return `${s}s ago`
  const m = Math.floor(s / 60); if (m < 60)  return `${m}m ago`
  const h = Math.floor(m / 60); if (h < 24)  return `${h}h ago`
  const d = Math.floor(h / 24); if (d < 7)   return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}

// ── Shared offline/online bar ─────────────────────────────────────────────────

function StatusBar({ isOnline }: { isOnline: boolean }) {
  if (!isOnline) {
    return (
      <div className="flex items-center justify-center mb-4">
        <div
          className="flex items-center gap-2 rounded-full px-4 py-2"
          style={{ background: 'rgba(255,60,60,0.10)', border: '1px solid rgba(255,80,80,0.35)' }}
        >
          <span style={{ fontSize: 12 }}>⚠️</span>
          <p style={{ fontSize: 11, color: 'rgba(255,120,120,0.95)', fontWeight: 500 }}>
            View only — tap status badge to go online
          </p>
        </div>
      </div>
    )
  }
  return (
    <div
      className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 mb-4"
      style={{ background: 'rgba(0,188,212,0.07)', border: '1px solid rgba(0,188,212,0.2)' }}
    >
      <span style={{ fontSize: 13 }}>ℹ️</span>
      <p style={{ fontSize: 11, color: 'rgba(0,210,255,0.75)' }}>
        Select pickups &amp; add to your route
      </p>
    </div>
  )
}

// ── Component ──────────────────────────────────────────────────────────────────

export function PickupsNearYou({
  isOnline,
  onSelectionChange,
  resetKey = 0,
}: {
  isOnline: boolean
  onSelectionChange: (count: number, pickups: PickupInput[]) => void
  resetKey?: number
}) {
  const [liveSelectedIds, setLiveSelectedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (resetKey > 0) setLiveSelectedIds(new Set())
  }, [resetKey])

  // Real consumer scans only — no fallback, no mock data.
  const { data: liveScans = [], isLoading: liveLoading } = useQuery<AvailablePickup[]>({
    queryKey: ['driver-available-pickups'],
    queryFn: async () => {
      console.log('[driver] loading real driver pickups from Supabase')
      const { data, error } = await supabase
        .from('consumer_bag_scans')
        .select('id, qr_code, bag_id, scan_status, scanned_at')
        .in('scan_status', ['active', 'pending_pickup'])
        .order('scanned_at', { ascending: false })
        .limit(50)
      if (error) {
        console.error('[driver] consumer_bag_scans query failed:', error)
        // No demo data fallback — return empty so the empty state renders.
        return []
      }
      console.log('[driver] real pickup count', data?.length ?? 0, '— no demo data used')
      return (data ?? []) as AvailablePickup[]
    },
    refetchInterval: 30_000,
  })

  // Notify parent of selection changes.
  // NOTE: onSelectionChange MUST be referentially stable (wrap with useCallback
  // at the call site). If it's an inline arrow it changes every render → this
  // effect re-fires → parent re-renders → new callback → "Maximum update
  // depth exceeded". DriverDashboard wraps with useCallback as of this revision.
  useEffect(() => {
    const inputs: PickupInput[] = liveScans
      .filter(s => liveSelectedIds.has(s.id))
      .map(s => ({
        id:      s.id,
        address: s.qr_code,  // no location column on consumer_bag_scans yet
        bags:    1,
      }))
    if (inputs.length > 0) {
      console.log('[driver] selected pickup added to route', { count: inputs.length, ids: inputs.map(i => i.id) })
    }
    onSelectionChange(liveSelectedIds.size, inputs)
  }, [liveSelectedIds, liveScans, onSelectionChange])

  const toggleLive = (id: string) => {
    if (!isOnline) return
    setLiveSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  return (
    <div className="px-4 pt-4 pb-4" style={{ animation: 'fadeSlideUp 0.3s ease both' }}>
      <StatusBar isOnline={isOnline} />

      <p style={{ fontSize: 10, color: '#00BCD4', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
        AVAILABLE PICKUPS
      </p>

      {liveLoading ? (
        <div className="rounded-2xl px-4 py-6 text-center" style={{ background: 'rgba(255,255,255,0.04)' }}>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>Loading pickups…</p>
        </div>
      ) : liveScans.length === 0 ? (
        <div className="rounded-2xl px-4 py-8 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p style={{ fontSize: 22, marginBottom: 8 }}>📭</p>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>No available pickups yet.</p>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
            Consumer bag scans will appear here when customers scan bags.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {liveScans.map(scan => {
            const isSelected = liveSelectedIds.has(scan.id)
            const status     = STATUS_STYLE[scan.scan_status] ?? { label: scan.scan_status, color: '#7B909C', bg: 'rgba(255,255,255,0.04)' }
            const bagSuffix  = scan.bag_id ? String(scan.bag_id).slice(0, 8) : null

            return (
              <button
                key={scan.id}
                onClick={() => toggleLive(scan.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left rounded-2xl active:opacity-75 transition-all"
                style={{
                  background: isSelected ? 'rgba(0,200,255,0.07)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${isSelected ? 'rgba(0,200,255,0.35)' : 'rgba(255,255,255,0.06)'}`,
                  boxShadow: isSelected ? '0 0 14px rgba(0,200,255,0.18)' : 'none',
                  transition: 'all 0.18s ease',
                  opacity: !isOnline ? 0.55 : 1,
                  cursor: isOnline ? 'pointer' : 'default',
                }}
              >
                {/* Checkbox */}
                <div style={{
                  width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                  border: `1.5px solid ${isSelected ? '#00D9FF' : 'rgba(255,255,255,0.18)'}`,
                  background: isSelected ? 'rgba(0,200,255,0.14)' : 'transparent',
                  boxShadow: isSelected ? '0 0 9px rgba(0,200,255,0.38)' : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.18s ease',
                }}>
                  {isSelected && (
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="#00D9FF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-mono font-bold" style={{
                    fontSize: 13, color: isSelected ? '#00c8ff' : 'rgba(255,255,255,0.82)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {scan.qr_code}
                  </p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>
                    {bagSuffix ? `Bag #${bagSuffix} · ` : ''}{relativeTime(scan.scanned_at)}
                  </p>
                </div>

                <span style={{
                  fontSize: 9, fontWeight: 700,
                  color: status.color,
                  background: status.bg,
                  borderRadius: 99, padding: '2px 8px', whiteSpace: 'nowrap',
                }}>
                  {status.label}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
