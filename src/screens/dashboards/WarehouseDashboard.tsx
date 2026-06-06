import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { DashboardShell } from '../../components/DashboardShell'
import { QrScanner } from '../../components/QrScanner'
import { lookupOrCreateBag } from '../../lib/bags'
import { markBagAtWarehouse, getInspectionQueue, getMyStatsToday } from '../../lib/warehouse'
import { loadCommercialIntakeQueue } from '../../lib/commercialWarehouseIntake'
import { useAuthStore } from '../../store/authStore'
import { Spinner } from '../../components/ui'
import { EmptyState } from '../../components/ui/EmptyState'
import { SectionLabel } from '../../components/ui/dashboard'

const ACCENT = '#4ade80'

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = 'queue' | 'scan' | 'history' | 'stats'

type ScanPhase = 'idle' | 'scanning' | 'manual' | 'processing' | 'found' | 'success' | 'error'
type ScanState =
  | { phase: 'idle' }
  | { phase: 'scanning' }
  | { phase: 'manual' }
  | { phase: 'processing' }
  | { phase: 'found'; bagCode: string }
  | { phase: 'success'; bagCode: string; bagId: string }
  | { phase: 'error'; message: string }

interface ScanEntry {
  id: string
  bagCode: string
  last4: string
  consumerName: string
  driverName: string
  workerInitials: string
  workerName: string
  completedTs: string
  consumerPayoutStatus: 'triggered' | 'pending'
  driverPayoutStatus: 'triggered' | 'pending'
}

// ── (mock data removed — live data only) ─────────────────────────────────────


// ── Queue Tab — real inspection queue ────────────────────────────────────────

// Phase G.6 — banner linking to the commercial intake queue with a live count
// of arrived / expected / intake_started commercial loads. Pulls from the
// v_warehouse_commercial_intake_queue view so it auto-respects warehouse RLS.
function CommercialIntakeCard() {
  const { data: loads = [] } = useQuery({
    queryKey:        ['commercial-intake-queue-count'],
    queryFn:         () => loadCommercialIntakeQueue(),
    refetchInterval: 30_000,
  })
  const active = loads.filter((l) => ['expected', 'arrived', 'intake_started'].includes(l.load_status))
  const arrived = loads.filter((l) => l.load_status === 'arrived').length

  return (
    <Link
      to="/dashboard/warehouse/commercial-expected-loads"
      className="block rounded-2xl px-4 py-4 transition-opacity hover:opacity-90 active:opacity-75"
      style={{ background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.3)', textDecoration: 'none' }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p style={{ fontSize: 10, fontWeight: 800, color: '#00c8ff', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            🏢 Commercial Intake
          </p>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginTop: 4 }}>
            {active.length} active load{active.length === 1 ? '' : 's'}
          </p>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
            {arrived > 0 ? `${arrived} arrived · ready for G/Y/R inspection` : 'No commercial loads waiting'}
          </p>
        </div>
        <span style={{ fontSize: 24, color: 'rgba(0,200,255,0.8)' }}>→</span>
      </div>
    </Link>
  )
}

function QueueTab({
  queue,
  queueLoading,
}: {
  queue: Awaited<ReturnType<typeof getInspectionQueue>>
  queueLoading: boolean
}) {

  if (queueLoading) {
    return (
      <div className="space-y-3">
        <CommercialIntakeCard />
        <div className="flex justify-center py-10"><Spinner size="md" /></div>
      </div>
    )
  }

  if (queue.length === 0) {
    return (
      <div className="space-y-3">
        <CommercialIntakeCard />
        <EmptyState
          icon="📋"
          title="No bags in inspection queue"
          description="Bags checked in will appear here for inspection."
        />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <CommercialIntakeCard />
      <div className="flex items-center justify-between">
        <SectionLabel title="Inspection Queue" accent={ACCENT} />
        <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: 'rgba(255,214,0,0.12)', color: '#FFD600', border: '1px solid rgba(255,214,0,0.3)' }}>
          {queue.length} pending
        </span>
      </div>
      {queue.map((item) => (
        <Link
          key={item.id}
          to={`/bag/${item.id}/inspect`}
          className="block rounded-2xl px-4 py-3.5 transition-opacity hover:opacity-90 active:opacity-75"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(0,188,212,0.2)', textDecoration: 'none' }}
        >
          <div className="flex items-start justify-between gap-2">
            <p style={{ fontSize: 13, color: '#E0F7FA', fontWeight: 700, fontFamily: 'monospace' }}>{item.bag_code}</p>
            <span className="rounded-full px-2 py-0.5 text-[10px] font-bold shrink-0" style={{ background: 'rgba(0,230,118,0.08)', color: '#00E676', border: '1px solid rgba(0,230,118,0.25)' }}>
              Ready to Inspect
            </span>
          </div>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', marginTop: 3 }}>
            {new Date(item.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </p>
        </Link>
      ))}
    </div>
  )
}

// ── Scan In Tab ───────────────────────────────────────────────────────────────

function ScanInTab({
  scanState,
  setScanState,
  scannerKey,
  manualCode,
  setManualCode,
  processScan,
  handleManualSubmit,
  confirmCheckIn,
  resetScanner,
  recentEntries,
}: {
  scanState: ScanState
  setScanState: (s: ScanState) => void
  scannerKey: number
  manualCode: string
  setManualCode: (v: string) => void
  processScan: (code: string) => void
  handleManualSubmit: (e: React.FormEvent) => void
  confirmCheckIn: (code: string) => void
  resetScanner: () => void
  recentEntries: ScanEntry[]
}) {
  const activePhases: ScanPhase[] = ['idle', 'scanning', 'manual']
  const showInput = activePhases.includes(scanState.phase as ScanPhase)

  return (
    <div className="space-y-5">
      {/* ── Scanner area ── */}
      <div className="space-y-3">

        {/* Real QrScanner */}
        {scanState.phase === 'scanning' && (
          <>
            <div className="rounded-2xl overflow-hidden" style={{ border: '2px solid rgba(0,188,212,0.35)' }}>
              <QrScanner key={scannerKey} onScan={processScan} />
            </div>
            <button
              onClick={() => setScanState({ phase: 'manual' })}
              className="w-full rounded-xl py-2.5 text-sm font-medium"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#7B909C' }}
            >
              Enter code manually
            </button>
          </>
        )}

        {/* Manual entry */}
        {scanState.phase === 'manual' && showInput && (
          <form onSubmit={handleManualSubmit} className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide" style={{ color: '#7B909C' }}>
                Manual Bag Code
              </label>
              <input
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                placeholder="e.g. BAG-MRC0001"
                className="w-full rounded-xl px-4 py-3 font-mono text-sm outline-none border placeholder:text-[#7B909C]"
                style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(0,188,212,0.25)', color: '#E0F7FA', caretColor: '#00BCD4' }}
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setScanState({ phase: 'scanning' })}
                className="flex-1 rounded-xl py-2.5 text-sm font-medium"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#7B909C' }}
              >
                Use Camera
              </button>
              <button
                type="submit"
                disabled={!manualCode.trim()}
                className="rounded-xl py-2.5 text-sm font-bold text-white disabled:opacity-50 transition-all active:scale-[0.98]"
                style={{ flex: 1, background: 'linear-gradient(135deg,#0057e7,#00BCD4)', boxShadow: '0 0 12px rgba(0,188,212,0.3)' }}
              >
                Look Up Bag
              </button>
            </div>
          </form>
        )}

        {/* Found state — confirm before check-in */}
        {scanState.phase === 'found' && (
          <div
            className="rounded-2xl p-5 space-y-4"
            style={{ background: 'rgba(0,188,212,0.06)', border: '1px solid rgba(0,188,212,0.28)', animation: 'fadeSlideUp 0.2s ease both' }}
          >
            <div>
              <p style={{ fontSize: 10, color: 'rgba(0,188,212,0.65)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Bag Found</p>
              <p style={{ fontSize: 20, color: '#E0F7FA', fontWeight: 700, fontFamily: 'monospace', marginTop: 6 }}>{scanState.bagCode}</p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
                Ready to be checked in to this warehouse.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={resetScanner}
                className="flex-1 rounded-xl py-2.5 text-sm font-semibold"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#7B909C' }}
              >
                Cancel
              </button>
              <button
                onClick={() => confirmCheckIn(scanState.bagCode)}
                className="flex-1 rounded-xl py-2.5 text-sm font-bold text-white transition-all active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg,#0057e7,#00BCD4)', boxShadow: '0 0 12px rgba(0,188,212,0.3)' }}
              >
                Check In Bag
              </button>
            </div>
          </div>
        )}

        {scanState.phase === 'processing' && (
          <div className="flex flex-col items-center justify-center gap-3 py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" style={{ borderColor: '#00BCD4', borderTopColor: 'transparent' }} />
            <p className="text-sm" style={{ color: '#7B909C' }}>Checking in bag…</p>
          </div>
        )}

        {scanState.phase === 'success' && (
          <div
            className="rounded-2xl p-5 space-y-4"
            style={{ background: 'rgba(0,230,118,0.07)', border: '1px solid rgba(0,230,118,0.3)', animation: 'fadeSlideUp 0.25s ease both' }}
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                style={{ background: 'rgba(0,230,118,0.15)', border: '1.5px solid rgba(0,230,118,0.5)', boxShadow: '0 0 10px rgba(0,230,118,0.25)' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00E676" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <div>
                <p style={{ fontSize: 14, color: '#00E676', fontWeight: 700 }}>Bag checked in</p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace', marginTop: 1 }}>{scanState.bagCode}</p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>
                  Checked In by DW · Today {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Link
                to={`/bag/${scanState.bagId}/inspect`}
                className="flex-1 rounded-xl py-2.5 text-center text-sm font-semibold text-white"
                style={{ background: 'linear-gradient(135deg,#00BCD4,#0097A7)', boxShadow: '0 0 12px rgba(0,188,212,0.3)' }}
              >
                Inspect Now
              </Link>
              <button
                onClick={resetScanner}
                className="flex-1 rounded-xl py-2.5 text-sm font-semibold"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#7B909C' }}
              >
                Close
              </button>
            </div>
          </div>
        )}

        {scanState.phase === 'error' && (
          <div className="rounded-2xl p-4 space-y-3" style={{ background: 'rgba(255,23,68,0.08)', border: '1px solid rgba(255,23,68,0.25)' }}>
            <p className="text-sm font-semibold" style={{ color: '#FF1744' }}>Check-in failed</p>
            <p className="text-xs" style={{ color: 'rgba(255,23,68,0.8)' }}>{scanState.message}</p>
            <button
              onClick={resetScanner}
              className="w-full rounded-xl py-2.5 text-sm font-semibold"
              style={{ background: 'rgba(255,23,68,0.1)', border: '1px solid rgba(255,23,68,0.3)', color: '#FF1744' }}
            >
              Try Again
            </button>
          </div>
        )}
      </div>

      {/* ── Recent scan-ins ── */}
      {recentEntries.length > 0 && (
        <div>
          <SectionLabel title="Today's Scan-ins" accent={ACCENT} />
          <div className="space-y-2.5">
            {recentEntries.slice(0, 10).map((entry) => (
              <div
                key={entry.id}
                className="rounded-2xl px-4 py-3.5 flex items-center gap-3"
                style={{ background: 'rgba(0,230,118,0.05)', border: '1px solid rgba(0,230,118,0.18)' }}
              >
                <div
                  className="shrink-0 flex items-center justify-center rounded-full text-[11px] font-bold"
                  style={{ width: 34, height: 34, background: 'rgba(0,188,212,0.15)', border: '1.5px solid rgba(0,188,212,0.4)', color: '#00BCD4' }}
                >
                  {entry.workerInitials}
                </div>
                <div className="flex-1 min-w-0">
                  <p style={{ fontSize: 12, color: '#E0F7FA', fontWeight: 600, fontFamily: 'monospace' }}>{entry.bagCode}</p>
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>
                    {entry.driverName} · Scanned by {entry.workerName}
                  </p>
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 0.5 }}>{entry.completedTs}</p>
                </div>
                <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: 'rgba(0,230,118,0.12)', color: '#00E676', border: '1px solid rgba(0,230,118,0.28)' }}>
                  Completed
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── History Tab ───────────────────────────────────────────────────────────────

function HistoryTab({ entries }: { entries: ScanEntry[] }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <SectionLabel title="Completed Bags" accent={ACCENT} />
        <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: 'rgba(0,230,118,0.12)', color: '#00E676', border: '1px solid rgba(0,230,118,0.28)' }}>
          {entries.length} total
        </span>
      </div>

      {entries.length === 0 && (
        <EmptyState
          icon="📋"
          title="No completed bags yet"
          description="Bags you check in will appear here."
        />
      )}

      <div className="space-y-3">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="rounded-2xl p-4 space-y-3"
            style={{ background: 'rgba(0,230,118,0.04)', border: '1px solid rgba(0,230,118,0.2)', animation: 'fadeSlideUp 0.2s ease both' }}
          >
            {/* Top row */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <p style={{ fontSize: 13, color: '#E0F7FA', fontWeight: 700, fontFamily: 'monospace' }}>{entry.bagCode}</p>
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>Bag ending ···{entry.last4}</p>
              </div>
              <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold shrink-0" style={{ background: 'rgba(0,230,118,0.15)', color: '#00E676', border: '1px solid rgba(0,230,118,0.35)' }}>
                Completed
              </span>
            </div>

            {/* People */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Consumer</p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2, fontWeight: 500 }}>{entry.consumerName}</p>
              </div>
              <div>
                <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Driver</p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2, fontWeight: 500 }}>{entry.driverName}</p>
              </div>
            </div>
            <div>
              <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Worker</p>
              <p style={{ fontSize: 11, color: '#00BCD4', marginTop: 2, fontWeight: 600 }}>{entry.workerName}</p>
            </div>

            {/* Timestamp */}
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{entry.completedTs}</p>

            {/* Payout status */}
            <div className="flex gap-2 pt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <div
                className="flex-1 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5"
                style={{ background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.2)' }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#00E676" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                <p style={{ fontSize: 10, color: '#00E676', fontWeight: 600 }}>Consumer payout triggered</p>
              </div>
              <div
                className="flex-1 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5"
                style={{ background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.2)' }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#00E676" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                <p style={{ fontSize: 10, color: '#00E676', fontWeight: 600 }}>Driver payout triggered</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── My Stats Tab ──────────────────────────────────────────────────────────────

function StatCard({ value, label, accent, sub }: { value: string; label: string; accent: string; sub?: string }) {
  return (
    <div className="rounded-2xl p-3 flex flex-col gap-1" style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${accent}35` }}>
      <p style={{ fontSize: 22, color: accent, fontWeight: 700, lineHeight: 1.1 }}>{value}</p>
      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
      {sub && <p style={{ fontSize: 11, color: accent, marginTop: 2 }}>{sub}</p>}
    </div>
  )
}

function BarRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>{label}</span>
        <span style={{ fontSize: 12, color, fontWeight: 700 }}>{value}</span>
      </div>
      <div className="h-1.5 w-full rounded-full" style={{ background: 'rgba(255,255,255,0.07)' }}>
        <div className="h-1.5 rounded-full transition-all" style={{ width: `${max > 0 ? (value / max) * 100 : 0}%`, background: color }} />
      </div>
    </div>
  )
}

function MyStatsTab({
  myStats,
  statsLoading,
}: {
  myStats: { scansToday: number; inspectionsToday: number; greenToday: number; yellowToday: number; redToday: number } | null | undefined
  statsLoading: boolean
}) {
  const today       = myStats?.scansToday ?? 0
  const week        = 0
  const month       = 0
  const year        = 0
  const quality     = 0
  const avgTime     = 0
  const safetyFlags = 0

  const greenToday  = myStats?.greenToday  ?? 0
  const yellowToday = myStats?.yellowToday ?? 0
  const redToday    = myStats?.redToday    ?? 0
  const totalInspections = greenToday + yellowToday + redToday

  if (statsLoading) {
    return <div className="flex justify-center py-10"><Spinner size="md" /></div>
  }

  return (
    <div className="space-y-5">
      <div>
        <p style={{ fontSize: 20, color: '#ffffff', fontWeight: 700 }}>My Stats</p>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Volume over time */}
      <div className="rounded-2xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(0,188,212,0.18)' }}>
        <SectionLabel title="Bags Scanned" accent={ACCENT} />
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Today',  value: today },
            { label: 'Week',   value: week  },
            { label: 'Month',  value: month },
            { label: 'Year',   value: year  },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl p-2.5 text-center" style={{ background: 'rgba(0,188,212,0.08)', border: '1px solid rgba(0,188,212,0.15)' }}>
              <p style={{ fontSize: 18, color: '#00BCD4', fontWeight: 700 }}>{value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}</p>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.03em', marginTop: 2 }}>{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-3 gap-2.5">
        <StatCard value={`${quality}%`}  label="Quality"   accent="#00E676" />
        <StatCard value={`${avgTime}s`}  label="Avg time"  accent="#00BCD4" />
        <StatCard value={String(safetyFlags)} label="Flags" accent="#FFD600" />
      </div>

      {/* Quality breakdown */}
      <div className="rounded-2xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(0,230,118,0.18)' }}>
        <p style={{ fontSize: 11, color: '#00E676', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>Quality Breakdown (Today)</p>
        {totalInspections > 0 ? (
          <div className="space-y-3">
            <BarRow label="Accepted bags"  value={greenToday}  max={totalInspections} color="#00E676" />
            <BarRow label="Caution bags"   value={yellowToday} max={totalInspections} color="#FFD600" />
            <BarRow label="Rejected bags"  value={redToday}    max={totalInspections} color="#FF1744" />
          </div>
        ) : (
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>No inspections today</p>
        )}
      </div>

      {/* Safety */}
      <div className="rounded-2xl p-4 space-y-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,214,0,0.18)' }}>
        <p style={{ fontSize: 11, color: '#FFD600', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>Safety</p>
        <div className="flex items-center justify-between">
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>Safety flags reviewed</p>
          <p style={{ fontSize: 18, color: '#FFD600', fontWeight: 700 }}>{safetyFlags}</p>
        </div>
        <div className="flex items-center justify-between">
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>Flags resolved</p>
          <p style={{ fontSize: 18, color: '#00E676', fontWeight: 700 }}>{Math.max(0, safetyFlags - 1)}</p>
        </div>
        <div className="flex items-center justify-between">
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>Caution bags handled</p>
          <p style={{ fontSize: 18, color: '#FFD600', fontWeight: 700 }}>{yellowToday}</p>
        </div>
      </div>

      {/* Productivity */}
      <div className="rounded-2xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(124,77,255,0.18)' }}>
        <p style={{ fontSize: 11, color: '#7C4DFF', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>Productivity</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p style={{ fontSize: 22, color: '#ffffff', fontWeight: 700 }}>{today}</p>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Bags today</p>
          </div>
          <div>
            <p style={{ fontSize: 22, color: '#ffffff', fontWeight: 700 }}>{totalInspections}</p>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Inspections</p>
          </div>
          <div>
            <p style={{ fontSize: 22, color: '#ffffff', fontWeight: 700 }}>{week}</p>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>This week</p>
          </div>
          <div>
            <p style={{ fontSize: 22, color: '#ffffff', fontWeight: 700 }}>{month}</p>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>This month</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function WarehouseDashboard() {
  const { user }      = useAuthStore()
  const queryClient   = useQueryClient()
  const [tab, setTab]                   = useState<Tab>('queue')
  const [scanState, setScanState]       = useState<ScanState>({ phase: 'scanning' })
  const [scannerKey, setScannerKey]     = useState(0)
  const [manualCode, setManualCode]     = useState('')
  const [completedEntries, setCompletedEntries] = useState<ScanEntry[]>([])

  const { data: queue = [], isLoading: queueLoading } = useQuery({
    queryKey: ['inspection-queue'],
    queryFn: getInspectionQueue,
    refetchInterval: 30_000,
  })

  const { data: myStats, isLoading: statsLoading } = useQuery({
    queryKey: ['my-stats-today', user?.id],
    queryFn: () => getMyStatsToday(user!.id),
    enabled: !!user,
    refetchInterval: 60_000,
  })

  const addEntry = useCallback((bagCode: string, driverName?: string, consumerName?: string) => {
    const now = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    setCompletedEntries((prev) => [
      {
        id: `live-${Date.now()}`,
        bagCode,
        last4: bagCode.slice(-4),
        consumerName: consumerName ?? 'Walk-in / Manual',
        driverName: driverName ?? 'Unknown Driver',
        workerInitials: 'DW',
        workerName: 'David W.',
        completedTs: `Today · ${now}`,
        consumerPayoutStatus: 'triggered',
        driverPayoutStatus: 'triggered',
      },
      ...prev,
    ])
  }, [])

  const processScan = useCallback(async (rawCode: string) => {
    if (!user) return
    setScanState({ phase: 'processing' })
    try {
      const bag = await lookupOrCreateBag(rawCode)
      await markBagAtWarehouse(bag.id, user.id)
      queryClient.invalidateQueries({ queryKey: ['inspection-queue'] })
      queryClient.invalidateQueries({ queryKey: ['my-stats-today', user.id] })
      setScanState({ phase: 'success', bagCode: bag.bag_code, bagId: bag.id })
      addEntry(bag.bag_code)
    } catch (err) {
      setScanState({ phase: 'error', message: err instanceof Error ? err.message : 'Unknown error' })
    }
  }, [user, queryClient])

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const code = manualCode.trim().toUpperCase()
    if (code) setScanState({ phase: 'found', bagCode: code })
  }

  const confirmCheckIn = (code: string) => {
    setManualCode('')
    processScan(code)
  }

  const resetScanner = () => {
    setManualCode('')
    setScanState({ phase: 'scanning' })
    setScannerKey((k) => k + 1)
  }

  const totalWaiting = queue.length

  const TABS: { value: Tab; label: string }[] = [
    { value: 'queue',   label: `Queue (${totalWaiting})` },
    { value: 'scan',    label: 'Scan In'                  },
    { value: 'history', label: `History (${completedEntries.length})` },
    { value: 'stats',   label: 'My Stats'                 },
  ]

  return (
    <DashboardShell title="Warehouse">
      {/* ── Tab bar ── */}
      <div
        className="flex mb-5 -mx-4 px-2 overflow-x-auto"
        style={{ borderBottom: '1px solid rgba(0,188,212,0.15)', scrollbarWidth: 'none' }}
      >
        {TABS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className="shrink-0 px-3 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap"
            style={
              tab === value
                ? { borderBottomColor: ACCENT, color: ACCENT }
                : { borderBottomColor: 'transparent', color: '#7B909C' }
            }
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Queue tab ── */}
      {tab === 'queue' && (
        <div style={{ animation: 'fadeSlideUp 0.25s ease both' }}>
          {/* AI Bag Inspection card */}
          <Link
            to="/bag-inspection"
            className="flex items-center gap-3 rounded-2xl px-4 py-4 mb-5 transition-all hover:brightness-110 active:scale-[0.98]"
            style={{ background: 'rgba(0,188,212,0.08)', border: '1px solid rgba(0,188,212,0.3)', boxShadow: '0 0 20px rgba(0,188,212,0.08)', textDecoration: 'none' }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(0,188,212,0.15)', border: '1px solid rgba(0,188,212,0.35)', fontSize: 20 }}
            >
              🤖
            </div>
            <div className="flex-1 min-w-0">
              <p style={{ fontSize: 14, fontWeight: 700, color: '#ffffff', marginBottom: 2 }}>AI Bag Inspection</p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>Green / Yellow / Red quality control flow</p>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(0,188,212,0.6)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </Link>

          <QueueTab queue={queue} queueLoading={queueLoading} />
        </div>
      )}

      {/* ── Scan In tab ── */}
      {tab === 'scan' && (
        <div style={{ animation: 'fadeSlideUp 0.25s ease both' }}>
          <ScanInTab
            scanState={scanState}
            setScanState={setScanState}
            scannerKey={scannerKey}
            manualCode={manualCode}
            setManualCode={setManualCode}
            processScan={processScan}
            handleManualSubmit={handleManualSubmit}
            confirmCheckIn={confirmCheckIn}
            resetScanner={resetScanner}
            recentEntries={completedEntries}
          />
        </div>
      )}

      {/* ── History tab ── */}
      {tab === 'history' && (
        <div style={{ animation: 'fadeSlideUp 0.25s ease both' }}>
          <HistoryTab entries={completedEntries} />
        </div>
      )}

      {/* ── My Stats tab ── */}
      {tab === 'stats' && (
        <div style={{ animation: 'fadeSlideUp 0.25s ease both' }}>
          <MyStatsTab
            myStats={myStats}
            statsLoading={statsLoading}
          />
        </div>
      )}
    </DashboardShell>
  )
}
