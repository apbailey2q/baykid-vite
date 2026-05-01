import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { DashboardShell } from '../../components/DashboardShell'
import { QrScanner } from '../../components/QrScanner'
import { lookupOrCreateBag } from '../../lib/bags'
import { markBagAtWarehouse, getInspectionQueue, getMyStatsToday } from '../../lib/warehouse'
import { useAuthStore } from '../../store/authStore'

import { DEV_BYPASS_AUTH } from '../../lib/devBypass'
import { Spinner } from '../../components/ui'

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

interface MockBag {
  id: string
  code: string
  last4: string
  ts: string
  consumerName: string
  driverStatus: 'accepted' | 'rejected' | 'caution'
  warehouseStatus: 'waiting' | 'completed' | 'flagged'
  note?: string
}

interface MockDriverGroup {
  id: string
  driverName: string
  area: string
  bags: MockBag[]
}

interface HistoryEntry {
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

// ── Mock data ─────────────────────────────────────────────────────────────────

const REJECT_NOTES = [
  'Bag appeared torn and leaking.',
  'Sharp material visible inside bag.',
  'Contamination detected — non-recyclable waste mixed in.',
  'Unsafe for vehicle transport — bag damaged.',
  'Bag was leaking liquid.',
]

const TIMES = [
  '8:12 AM', '8:45 AM', '9:03 AM', '9:28 AM', '9:55 AM',
  '10:14 AM', '10:42 AM', '11:06 AM', '11:33 AM', '11:58 AM',
  '12:22 PM', '12:50 PM', '1:18 PM', '1:44 PM', '2:10 PM',
]

const CONSUMER_NAMES = [
  'James Wright', 'Lisa Chen', 'Michael Torres', 'Sarah Kim',
  'David Johnson', 'Emily Davis', 'Robert Miller', 'Jennifer Wilson',
  'Thomas Brown', 'Amanda Martinez', 'Christopher Lee', 'Jessica Taylor',
  'Daniel Anderson', 'Stephanie Jackson', 'Matthew White',
]

function makeBags(
  prefix: string,
  count: number,
  rejectAt: number[] = [],
  cautionAt: number[] = [],
): MockBag[] {
  return Array.from({ length: count }, (_, i) => {
    const seq  = String(i + 1).padStart(4, '0')
    const code = `BAG-${prefix}${seq}`
    const isRejected = rejectAt.includes(i)
    const isCaution  = cautionAt.includes(i)
    return {
      id: `${prefix}-${i}`,
      code,
      last4: seq,
      ts: `Today · ${TIMES[i % TIMES.length]}`,
      consumerName: CONSUMER_NAMES[i % CONSUMER_NAMES.length],
      driverStatus: isRejected ? 'rejected' : isCaution ? 'caution' : 'accepted',
      warehouseStatus: i < 2 ? 'completed' : 'waiting',
      note: isRejected ? REJECT_NOTES[i % REJECT_NOTES.length] : undefined,
    }
  })
}

const MOCK_DRIVERS: MockDriverGroup[] = [
  { id: 'mrc', driverName: 'Marcus Reed',   area: 'East Nashville',      bags: makeBags('MRC', 12, [4],     [8])       },
  { id: 'tbr', driverName: 'Tanya Brooks',  area: 'South Nashville',     bags: makeBags('TBR', 14, [2, 9],  [5])       },
  { id: 'dct', driverName: 'Devon Carter',  area: 'Downtown Nashville',  bags: makeBags('DCT', 11, [6],     [3, 10])   },
  { id: 'rjh', driverName: 'Renee Johnson', area: 'North Nashville',     bags: makeBags('RJH', 13, [1, 7],  [4])       },
  { id: 'amr', driverName: 'Alicia Moore',  area: 'Madison / Rivergate', bags: makeBags('AMR', 15, [3, 11], [6])       },
  { id: 'jhs', driverName: 'Jamal Harris',  area: 'Antioch',             bags: makeBags('JHS', 12, [5],     [2, 9])    },
]

const MOCK_HISTORY: HistoryEntry[] = [
  { id: 'h1', bagCode: 'BAG-MRC0001', last4: '1836', consumerName: 'James Wright',   driverName: 'Marcus Reed',   workerInitials: 'DW', workerName: 'David W.',  completedTs: 'Today · 2:44 PM', consumerPayoutStatus: 'triggered', driverPayoutStatus: 'triggered' },
  { id: 'h2', bagCode: 'BAG-TBR0001', last4: 'A2C4', consumerName: 'Lisa Chen',      driverName: 'Tanya Brooks',  workerInitials: 'SK', workerName: 'Sandra K.', completedTs: 'Today · 2:30 PM', consumerPayoutStatus: 'triggered', driverPayoutStatus: 'triggered' },
  { id: 'h3', bagCode: 'BAG-DCT0001', last4: '7A92', consumerName: 'Michael Torres', driverName: 'Devon Carter',  workerInitials: 'DW', workerName: 'David W.',  completedTs: 'Today · 2:10 PM', consumerPayoutStatus: 'triggered', driverPayoutStatus: 'triggered' },
  { id: 'h4', bagCode: 'BAG-RJH0001', last4: 'B381', consumerName: 'Sarah Kim',      driverName: 'Renee Johnson', workerInitials: 'MT', workerName: 'Marco T.',  completedTs: 'Today · 1:58 PM', consumerPayoutStatus: 'triggered', driverPayoutStatus: 'triggered' },
  { id: 'h5', bagCode: 'BAG-AMR0001', last4: 'C044', consumerName: 'David Johnson',  driverName: 'Alicia Moore',  workerInitials: 'DW', workerName: 'David W.',  completedTs: 'Today · 1:32 PM', consumerPayoutStatus: 'triggered', driverPayoutStatus: 'triggered' },
  { id: 'h6', bagCode: 'BAG-JHS0001', last4: 'F217', consumerName: 'Emily Davis',    driverName: 'Jamal Harris',  workerInitials: 'SK', workerName: 'Sandra K.', completedTs: 'Today · 1:10 PM', consumerPayoutStatus: 'triggered', driverPayoutStatus: 'triggered' },
]

// ── Queue Tab ─────────────────────────────────────────────────────────────────

function QueueTab({
  onQueueScanIn,
}: {
  onQueueScanIn: (bagCode: string, driverName: string, consumerName: string) => void
}) {
  const [driverGroups, setDriverGroups] = useState<MockDriverGroup[]>(() =>
    MOCK_DRIVERS.map((g) => ({ ...g, bags: g.bags.map((b) => ({ ...b })) }))
  )
  const [expandedDriver, setExpandedDriver] = useState<string | null>('mrc')

  const handleScanIn = (groupId: string, bag: MockBag, driverName: string) => {
    setDriverGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? { ...g, bags: g.bags.map((b) => b.id === bag.id ? { ...b, warehouseStatus: 'completed' } : b) }
          : g
      )
    )
    onQueueScanIn(bag.code, driverName, bag.consumerName)
  }

  const totalWaiting   = driverGroups.reduce((s, g) => s + g.bags.filter((b) => b.driverStatus !== 'rejected' && b.warehouseStatus !== 'completed').length, 0)
  const acceptedCount  = driverGroups.reduce((s, g) => s + g.bags.filter((b) => b.driverStatus === 'accepted' && b.warehouseStatus !== 'completed').length, 0)
  const cautionCount   = driverGroups.reduce((s, g) => s + g.bags.filter((b) => b.driverStatus === 'caution'  && b.warehouseStatus !== 'completed').length, 0)

  return (
    <div className="space-y-3">
      {/* Counter cards */}
      <div className="grid grid-cols-3 gap-2.5 mb-1">
        {/* Queue Pending */}
        <div className="rounded-2xl p-3.5 flex flex-col gap-1" style={{ background: 'rgba(0,188,212,0.07)', border: '1px solid rgba(0,188,212,0.25)' }}>
          <p style={{ fontSize: 28, color: '#00BCD4', fontWeight: 700, lineHeight: 1 }}>{totalWaiting}</p>
          <p style={{ fontSize: 9, color: 'rgba(0,188,212,0.65)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 3 }}>Queue Pending</p>
        </div>
        {/* Accepted Incoming */}
        <div className="rounded-2xl p-3.5 flex flex-col gap-1" style={{ background: 'rgba(0,230,118,0.06)', border: '1px solid rgba(0,230,118,0.22)' }}>
          <p style={{ fontSize: 28, color: '#00E676', fontWeight: 700, lineHeight: 1 }}>{acceptedCount}</p>
          <p style={{ fontSize: 9, color: 'rgba(0,230,118,0.65)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 3 }}>Accepted</p>
        </div>
        {/* Caution Incoming */}
        <div className="rounded-2xl p-3.5 flex flex-col gap-1" style={{ background: 'rgba(255,214,0,0.06)', border: '1px solid rgba(255,214,0,0.25)' }}>
          <div className="flex items-center gap-1.5">
            <p style={{ fontSize: 28, color: '#FFD600', fontWeight: 700, lineHeight: 1 }}>{cautionCount}</p>
            {cautionCount > 0 && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFD600" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 2, opacity: 0.8 }}>
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            )}
          </div>
          <p style={{ fontSize: 9, color: 'rgba(255,214,0,0.65)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 3 }}>Caution</p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-1">
        <p style={{ fontSize: 10, color: '#00BCD4', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          DRIVER QUEUE
        </p>
        {totalWaiting > 0 && (
          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: 'rgba(255,214,0,0.12)', color: '#FFD600', border: '1px solid rgba(255,214,0,0.3)' }}>
            {totalWaiting} pending
          </span>
        )}
      </div>

      {/* Mock driver groups */}
      {driverGroups.map((group) => {
        const isExpanded  = expandedDriver === group.id
        // Queue shows only accepted + caution bags that have NOT been checked in yet
        const queueBags   = group.bags.filter((b) => b.driverStatus !== 'rejected' && b.warehouseStatus !== 'completed')
        const accepted    = group.bags.filter((b) => b.driverStatus === 'accepted').length
        const rejected    = group.bags.filter((b) => b.driverStatus === 'rejected').length
        const caution     = group.bags.filter((b) => b.driverStatus === 'caution').length
        const pendingWh   = queueBags.length
        const initials    = group.driverName.split(' ').map((p) => p[0]).join('').slice(0, 2)

        // Skip driver groups with nothing left in queue
        if (queueBags.length === 0 && !isExpanded) return null

        return (
          <div
            key={group.id}
            className="rounded-2xl overflow-hidden"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: `1px solid ${isExpanded ? 'rgba(0,188,212,0.3)' : 'rgba(255,255,255,0.08)'}`,
              transition: 'border-color 0.2s',
            }}
          >
            {/* Group header */}
            <button
              onClick={() => setExpandedDriver(isExpanded ? null : group.id)}
              className="w-full flex items-center gap-3 px-4 py-4 text-left"
            >
              <div
                className="shrink-0 flex items-center justify-center rounded-full text-xs font-bold"
                style={{ width: 40, height: 40, background: 'linear-gradient(135deg,rgba(0,87,231,0.4),rgba(0,188,212,0.25))', border: '1.5px solid rgba(0,188,212,0.35)', color: '#ffffff' }}
              >
                {initials}
              </div>

              <div className="flex-1 min-w-0">
                <p style={{ fontSize: 14, color: '#ffffff', fontWeight: 700 }}>{group.driverName}</p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>{group.area}</p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="flex flex-col items-end gap-1">
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold whitespace-nowrap" style={{ background: 'rgba(255,214,0,0.12)', color: '#FFD600', border: '1px solid rgba(255,214,0,0.3)' }}>
                    {pendingWh} in queue
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span style={{ fontSize: 10, color: '#00E676' }}>✓{accepted}</span>
                    {caution  > 0 && <span style={{ fontSize: 10, color: '#FFD600' }}>⚠{caution}</span>}
                    {rejected > 0 && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>✕{rejected} excl.</span>}
                  </div>
                </div>
                <svg
                  width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="rgba(255,255,255,0.35)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  style={{ flexShrink: 0, transition: 'transform 0.3s', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </div>
            </button>

            {/* Expanded bags list — rejected and completed bags excluded */}
            <div style={{ maxHeight: isExpanded ? 2400 : 0, overflow: 'hidden', transition: 'max-height 0.35s ease' }}>
              <div style={{ borderTop: '1px solid rgba(0,188,212,0.1)' }}>
                {queueBags.length === 0 && (
                  <div className="px-4 py-4">
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>All bags checked in or rejected.</p>
                  </div>
                )}
                {queueBags.map((bag, i) => {
                  const isCaution = bag.driverStatus === 'caution'
                  const rowBg     = isCaution ? 'rgba(255,214,0,0.025)' : 'transparent'
                  const statusBg    = isCaution ? 'rgba(255,214,0,0.1)'  : 'rgba(0,230,118,0.08)'
                  const statusBorder = isCaution ? 'rgba(255,214,0,0.28)' : 'rgba(0,230,118,0.25)'
                  const statusColor  = isCaution ? '#FFD600'              : '#00E676'
                  const statusLabel  = isCaution ? 'Caution — Check In Carefully' : 'Ready for Check-In'

                  return (
                    <div
                      key={bag.id}
                      className="px-4 py-3.5"
                      style={{
                        borderBottom: i < queueBags.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                        background: rowBg,
                      }}
                    >
                      {/* Bag code + warehouse status badge */}
                      <div className="flex items-start justify-between gap-2">
                        <p style={{ fontSize: 13, color: '#E0F7FA', fontWeight: 700, fontFamily: 'monospace' }}>{bag.code}</p>
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-bold shrink-0"
                          style={{ background: statusBg, color: statusColor, border: `1px solid ${statusBorder}` }}
                        >
                          {statusLabel}
                        </span>
                      </div>

                      {/* Consumer · Driver · Time */}
                      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', marginTop: 3 }}>
                        {bag.consumerName} · {group.driverName} · {bag.ts}
                      </p>

                      {/* Caution note */}
                      {bag.note && (
                        <p className="mt-1.5 rounded-lg px-2 py-1" style={{ fontSize: 10, color: '#FFD600', fontStyle: 'italic', background: 'rgba(255,214,0,0.06)', border: '1px solid rgba(255,214,0,0.15)' }}>
                          ⚠ {bag.note}
                        </p>
                      )}

                      {/* Check In button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleScanIn(group.id, bag, group.driverName) }}
                        className="mt-2.5 rounded-lg px-3 py-1.5 text-[11px] font-bold text-white"
                        style={{ background: 'linear-gradient(135deg,#0057e7,#00BCD4)', boxShadow: '0 1px 8px rgba(0,188,212,0.25)' }}
                      >
                        Check In
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })}

    </div>
  )
}

// ── Scanner viewfinder (DEV mock) ─────────────────────────────────────────────

function MockViewfinder({ scanning }: { scanning: boolean }) {
  const C = '#00BCD4'
  const bracketStyle = (top: boolean, left: boolean): React.CSSProperties => ({
    position: 'absolute',
    width: 24, height: 24,
    ...(top ? { top: 24 } : { bottom: 24 }),
    ...(left ? { left: 24 } : { right: 24 }),
    borderTop:    top  ? `2.5px solid ${C}` : 'none',
    borderBottom: !top ? `2.5px solid ${C}` : 'none',
    borderLeft:   left  ? `2.5px solid ${C}` : 'none',
    borderRight:  !left ? `2.5px solid ${C}` : 'none',
    borderRadius: top && left ? '4px 0 0 0' : top && !left ? '0 4px 0 0' : !top && left ? '0 0 0 4px' : '0 0 4px 0',
  })

  return (
    <div className="relative overflow-hidden" style={{ aspectRatio: '4/3', background: '#000' }}>
      {/* Brackets */}
      <div style={bracketStyle(true, true)} />
      <div style={bracketStyle(true, false)} />
      <div style={bracketStyle(false, true)} />
      <div style={bracketStyle(false, false)} />

      {/* Scan line */}
      {scanning && (
        <div
          style={{
            position: 'absolute', left: '12%', right: '12%', height: 2,
            background: `linear-gradient(90deg, transparent, ${C}, transparent)`,
            boxShadow: `0 0 8px ${C}`,
            animation: 'scanLine 1.2s ease-in-out infinite',
          }}
        />
      )}

      {/* Icon */}
      {!scanning && (
        <div className="absolute inset-0 flex items-center justify-center">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(0,188,212,0.35)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <path d="M14 14h.01M14 17h3M17 14v3M17 21h4M21 17h-4M21 14v3" />
          </svg>
        </div>
      )}
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
  onSuccessCallback,
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
  recentEntries: HistoryEntry[]
  onSuccessCallback: (code: string) => void
}) {
  const [mockScanning, setMockScanning] = useState(false)

  const triggerMockScan = () => {
    if (mockScanning) return
    setMockScanning(true)
    setTimeout(() => {
      setMockScanning(false)
      const code = `BAG-WH${Date.now().toString().slice(-4)}`
      processScan(code)
    }, 1100)
  }

  const activePhases: ScanPhase[] = ['idle', 'scanning', 'manual']
  const showInput = activePhases.includes(scanState.phase as ScanPhase)

  return (
    <div className="space-y-5">
      {/* ── Scanner area ── */}
      <div className="space-y-3">

        {/* DEV mode: premium mock viewfinder */}
        {DEV_BYPASS_AUTH && showInput && (
          <div
            className="rounded-2xl overflow-hidden"
            style={{ border: '2px solid rgba(0,188,212,0.35)', boxShadow: '0 0 20px rgba(0,188,212,0.1)' }}
          >
            <MockViewfinder scanning={mockScanning} />
            <button
              onClick={triggerMockScan}
              disabled={mockScanning}
              className="w-full py-3.5 text-sm font-bold text-white transition-all active:scale-[0.98] disabled:opacity-70"
              style={{ background: 'linear-gradient(135deg,#0057e7,#00BCD4)', boxShadow: '0 0 12px rgba(0,188,212,0.25)' }}
            >
              {mockScanning ? 'Scanning…' : 'Scan Bag'}
            </button>
          </div>
        )}

        {/* PROD mode: real QrScanner */}
        {!DEV_BYPASS_AUTH && scanState.phase === 'scanning' && (
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

        {/* Manual entry — always shown in DEV, shown on demand in PROD */}
        {(DEV_BYPASS_AUTH || scanState.phase === 'manual') && showInput && (
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
              {!DEV_BYPASS_AUTH && (
                <button
                  type="button"
                  onClick={() => setScanState({ phase: 'scanning' })}
                  className="flex-1 rounded-xl py-2.5 text-sm font-medium"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#7B909C' }}
                >
                  Use Camera
                </button>
              )}
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
              {!DEV_BYPASS_AUTH && scanState.bagId !== 'demo' && (
                <Link
                  to={`/bag/${scanState.bagId}/inspect`}
                  className="flex-1 rounded-xl py-2.5 text-center text-sm font-semibold text-white"
                  style={{ background: 'linear-gradient(135deg,#00BCD4,#0097A7)', boxShadow: '0 0 12px rgba(0,188,212,0.3)' }}
                >
                  Inspect Now
                </Link>
              )}
              {DEV_BYPASS_AUTH && (
                <button
                  onClick={() => { onSuccessCallback(scanState.bagCode); resetScanner() }}
                  className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white"
                  style={{ background: 'linear-gradient(135deg,#0057e7,#00BCD4)', boxShadow: '0 0 12px rgba(0,188,212,0.3)' }}
                >
                  Scan Next Bag
                </button>
              )}
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
          <p style={{ fontSize: 10, color: '#00BCD4', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
            TODAY'S SCAN-INS
          </p>
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

function HistoryTab({ entries }: { entries: HistoryEntry[] }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p style={{ fontSize: 10, color: '#00BCD4', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          COMPLETED BAGS
        </p>
        <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: 'rgba(0,230,118,0.12)', color: '#00E676', border: '1px solid rgba(0,230,118,0.28)' }}>
          {entries.length} total
        </span>
      </div>

      {entries.length === 0 && (
        <div className="py-12 text-center">
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>No completed bags yet today</p>
        </div>
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
            <div className="grid grid-cols-3 gap-2">
              <div>
                <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Consumer</p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2, fontWeight: 500 }}>{entry.consumerName}</p>
              </div>
              <div>
                <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Driver</p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2, fontWeight: 500 }}>{entry.driverName}</p>
              </div>
              <div>
                <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Worker</p>
                <p style={{ fontSize: 11, color: '#00BCD4', marginTop: 2, fontWeight: 600 }}>{entry.workerName}</p>
              </div>
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
    <div className="rounded-2xl p-4 flex flex-col gap-1" style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${accent}35` }}>
      <p style={{ fontSize: 26, color: accent, fontWeight: 700, lineHeight: 1.1 }}>{value}</p>
      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
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
  historyCount,
}: {
  myStats: { scansToday: number; inspectionsToday: number; greenToday: number; yellowToday: number; redToday: number } | null | undefined
  statsLoading: boolean
  historyCount: number
}) {
  const demo = DEV_BYPASS_AUTH

  const today     = demo ? Math.max(historyCount, 38) : (myStats?.scansToday ?? 0)
  const week      = demo ? 187  : 0
  const month     = demo ? 742  : 0
  const year      = demo ? 4891 : 0
  const quality   = demo ? 97   : 0
  const avgTime   = demo ? 18   : 0
  const safetyFlags = demo ? 4  : 0

  const greenToday  = demo ? 34 : (myStats?.greenToday  ?? 0)
  const yellowToday = demo ? 3  : (myStats?.yellowToday ?? 0)
  const redToday    = demo ? 1  : (myStats?.redToday    ?? 0)
  const totalInspections = greenToday + yellowToday + redToday

  if (statsLoading && !demo) {
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
        <p style={{ fontSize: 11, color: '#00BCD4', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>Bags Scanned</p>
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Today',  value: today },
            { label: 'Week',   value: week  },
            { label: 'Month',  value: month },
            { label: 'Year',   value: year  },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl p-2.5 text-center" style={{ background: 'rgba(0,188,212,0.08)', border: '1px solid rgba(0,188,212,0.15)' }}>
              <p style={{ fontSize: 20, color: '#00BCD4', fontWeight: 700 }}>{value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}</p>
              <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>{label}</p>
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
  const [scanState, setScanState]       = useState<ScanState>({ phase: DEV_BYPASS_AUTH ? 'idle' : 'scanning' })
  const [scannerKey, setScannerKey]     = useState(0)
  const [manualCode, setManualCode]     = useState('')
  const [completedEntries, setCompletedEntries] = useState<HistoryEntry[]>(MOCK_HISTORY)

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
        driverName: driverName ?? 'Demo Driver',
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
    setScanState({ phase: 'processing' })
    if (DEV_BYPASS_AUTH) {
      await new Promise((r) => setTimeout(r, 500))
      const code = rawCode.trim().toUpperCase() || `BAG-WH${Date.now().toString().slice(-4)}`
      setScanState({ phase: 'success', bagCode: code, bagId: 'demo' })
      return
    }
    if (!user) return
    try {
      const bag = await lookupOrCreateBag(rawCode)
      await markBagAtWarehouse(bag.id, user.id)
      queryClient.invalidateQueries({ queryKey: ['inspection-queue'] })
      queryClient.invalidateQueries({ queryKey: ['my-stats-today', user.id] })
      setScanState({ phase: 'success', bagCode: bag.bag_code, bagId: bag.id })
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
    setScanState({ phase: DEV_BYPASS_AUTH ? 'idle' : 'scanning' })
    setScannerKey((k) => k + 1)
  }

  const totalWaiting = MOCK_DRIVERS.reduce((s, d) => s + d.bags.filter((b) => b.warehouseStatus === 'waiting').length, 0)
    + (DEV_BYPASS_AUTH ? 0 : queue.length)

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
        style={{ borderBottom: '1px solid rgba(0,188,212,0.15)' }}
      >
        {TABS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className="shrink-0 px-3 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap"
            style={
              tab === value
                ? { borderBottomColor: '#00BCD4', color: '#00BCD4' }
                : { borderBottomColor: 'transparent', color: '#7B909C' }
            }
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Queue tab ── */}
      {tab === 'queue' && (
        <>
          <QueueTab
            onQueueScanIn={(code, driver, consumer) => addEntry(code, driver, consumer)}
          />

          {/* Supabase queue items in PROD */}
          {!DEV_BYPASS_AUTH && queueLoading && (
            <div className="flex justify-center py-8">
              <div className="h-7 w-7 animate-spin rounded-full border-4 border-t-transparent" style={{ borderColor: '#00BCD4', borderTopColor: 'transparent' }} />
            </div>
          )}
          {!DEV_BYPASS_AUTH && !queueLoading && queue.map((bag) => (
            <div key={bag.id} className="mt-2 flex items-center justify-between rounded-2xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(0,188,212,0.15)' }}>
              <div>
                <p className="font-mono text-sm font-bold" style={{ color: '#E0F7FA' }}>{bag.bag_code}</p>
                <p className="text-xs" style={{ color: '#7B909C' }}>Arrived {new Date(bag.updated_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</p>
              </div>
              <Link to={`/bag/${bag.id}/inspect`} className="rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ background: 'linear-gradient(135deg,#00BCD4,#0097A7)' }}>Inspect →</Link>
            </div>
          ))}
        </>
      )}

      {/* ── Scan In tab ── */}
      {tab === 'scan' && (
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
          onSuccessCallback={(code) => addEntry(code)}
        />
      )}

      {/* ── History tab ── */}
      {tab === 'history' && (
        <HistoryTab entries={completedEntries} />
      )}

      {/* ── My Stats tab ── */}
      {tab === 'stats' && (
        <MyStatsTab
          myStats={myStats}
          statsLoading={statsLoading}
          historyCount={completedEntries.length}
        />
      )}
    </DashboardShell>
  )
}
