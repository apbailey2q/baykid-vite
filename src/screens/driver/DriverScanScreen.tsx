import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DriverHeader } from '../../components/driver/DriverHeader'
import { DriverBottomNav } from '../../components/driver/DriverBottomNav'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ScanRecord {
  id: string
  code: string
  last4: string
  ts: string
  status: 'accepted' | 'rejected'
  note?: string
}

// ── Mock history ──────────────────────────────────────────────────────────────

const INITIAL_HISTORY: ScanRecord[] = [
  {
    id: 'h1',
    code: 'BAG-QR2100505A1836',
    last4: '1836',
    ts: 'Today · 2:14 PM',
    status: 'accepted',
  },
  {
    id: 'h2',
    code: 'BAG-QR2100477A7A92',
    last4: '7A92',
    ts: 'Today · 1:42 PM',
    status: 'rejected',
    note: 'Bag appeared torn, leaking, and contained unsafe sharp material.',
  },
]

// ── Scanner viewfinder ────────────────────────────────────────────────────────

function ScannerViewfinder({ scanning }: { scanning: boolean }) {
  const bracketStyle = (corners: React.CSSProperties): React.CSSProperties => ({
    position: 'absolute',
    width: 28,
    height: 28,
    ...corners,
  })

  return (
    <div
      className="relative w-full rounded-2xl overflow-hidden"
      style={{
        height: 210,
        background: 'rgba(0,0,0,0.5)',
        border: '1px solid rgba(0,188,212,0.3)',
        boxShadow: '0 0 28px rgba(0,188,212,0.12)',
      }}
    >
      {/* Corner brackets */}
      <div style={bracketStyle({ top: 16, left: 16, borderTop: '2.5px solid #00BCD4', borderLeft: '2.5px solid #00BCD4' })} />
      <div style={bracketStyle({ top: 16, right: 16, borderTop: '2.5px solid #00BCD4', borderRight: '2.5px solid #00BCD4' })} />
      <div style={bracketStyle({ bottom: 16, left: 16, borderBottom: '2.5px solid #00BCD4', borderLeft: '2.5px solid #00BCD4' })} />
      <div style={bracketStyle({ bottom: 16, right: 16, borderBottom: '2.5px solid #00BCD4', borderRight: '2.5px solid #00BCD4' })} />

      {scanning ? (
        <>
          {/* Scan line */}
          <div
            className="absolute left-4 right-4"
            style={{
              height: 2,
              background: 'linear-gradient(90deg, transparent, #00BCD4, transparent)',
              boxShadow: '0 0 8px rgba(0,188,212,0.9)',
              animation: 'scanLine 1.2s ease-in-out infinite',
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="h-7 w-7 animate-spin rounded-full border-2 border-t-transparent"
              style={{ borderColor: '#00BCD4', borderTopColor: 'transparent' }}
            />
          </div>
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5">
          {/* QR icon */}
          <svg
            width="54"
            height="54"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(0,188,212,0.45)"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="5" y="5" width="3" height="3" fill="rgba(0,188,212,0.3)" stroke="none" />
            <rect x="16" y="5" width="3" height="3" fill="rgba(0,188,212,0.3)" stroke="none" />
            <rect x="5" y="16" width="3" height="3" fill="rgba(0,188,212,0.3)" stroke="none" />
            <path d="M14 14h3v3h-3z" />
            <path d="M17 14h4M17 17h4M17 20h4M14 17h.01M14 20h.01" />
          </svg>
          <p style={{ fontSize: 12, color: 'rgba(0,188,212,0.65)', textAlign: 'center' }}>
            Point camera at BayKid QR code
          </p>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)' }}>
            Driver pickup scan + safety status
          </p>
        </div>
      )}
    </div>
  )
}

// ── Rejected notes modal ──────────────────────────────────────────────────────

function RejectedModal({
  record,
  onClose,
}: {
  record: ScanRecord
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-6"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-5 space-y-4"
        style={{
          background: 'rgba(6,20,38,0.98)',
          border: '1px solid rgba(255,23,68,0.35)',
          boxShadow: '0 0 32px rgba(255,23,68,0.15)',
          animation: 'fadeSlideUp 0.22s ease both',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full"
              style={{ background: 'rgba(255,23,68,0.15)', border: '1px solid rgba(255,23,68,0.4)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FF1744" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <p style={{ fontSize: 15, color: '#ffffff', fontWeight: 700 }}>Rejected Bag Notes</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full"
            style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)' }}
          >
            ✕
          </button>
        </div>

        <div
          className="rounded-xl p-4 space-y-3"
          style={{ background: 'rgba(255,23,68,0.05)', border: '1px solid rgba(255,23,68,0.2)' }}
        >
          <div className="flex justify-between items-start gap-3">
            <div>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Bag ending</p>
              <p style={{ fontSize: 16, color: '#FF6B6B', fontWeight: 700, fontFamily: 'monospace', marginTop: 2 }}>
                ···{record.last4}
              </p>
            </div>
            <span
              className="rounded-full px-2.5 py-0.5 text-xs font-bold"
              style={{ background: 'rgba(255,23,68,0.15)', color: '#FF1744', border: '1px solid rgba(255,23,68,0.35)' }}
            >
              Rejected
            </span>
          </div>

          <div>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Timestamp</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>{record.ts}</p>
          </div>

          <div>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Reason</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>Bag rejected before pickup</p>
          </div>

          <div>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Driver note</p>
            <p style={{ fontSize: 12, color: 'rgba(255,200,200,0.85)', marginTop: 2, lineHeight: 1.55 }}>
              {record.note}
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full rounded-xl py-3 text-sm font-semibold"
          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)' }}
        >
          Close
        </button>
      </div>
    </div>
  )
}

// ── History row ───────────────────────────────────────────────────────────────

function HistoryRow({
  record,
  onRejectedTap,
}: {
  record: ScanRecord
  onRejectedTap: (r: ScanRecord) => void
}) {
  const isRejected = record.status === 'rejected'

  const inner = (
    <div
      className="rounded-2xl px-4 py-3.5 flex items-center gap-3"
      style={{
        background: isRejected ? 'rgba(255,23,68,0.05)' : 'rgba(0,230,118,0.05)',
        border: isRejected ? '1px solid rgba(255,23,68,0.22)' : '1px solid rgba(0,230,118,0.2)',
      }}
    >
      {/* Status dot */}
      <div
        className="shrink-0 flex items-center justify-center rounded-full"
        style={{
          width: 36,
          height: 36,
          background: isRejected ? 'rgba(255,23,68,0.12)' : 'rgba(0,230,118,0.12)',
          border: isRejected ? '1.5px solid rgba(255,23,68,0.4)' : '1.5px solid rgba(0,230,118,0.4)',
        }}
      >
        {isRejected ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FF1744" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00E676" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p
          style={{
            fontSize: 13,
            color: isRejected ? '#FF6B6B' : '#00E676',
            fontWeight: 700,
            lineHeight: 1.2,
          }}
        >
          {isRejected ? 'Rejected' : 'Accepted'}
        </p>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', marginTop: 2 }}>
          {record.ts} · Bag ending {record.last4}
        </p>
      </div>

      {/* Badge / chevron */}
      <div className="shrink-0 flex items-center gap-2">
        <span
          className="rounded-full px-2.5 py-0.5 text-xs font-bold"
          style={
            isRejected
              ? { background: 'rgba(255,23,68,0.15)', color: '#FF1744', border: '1px solid rgba(255,23,68,0.3)' }
              : { background: 'rgba(0,230,118,0.12)', color: '#00E676', border: '1px solid rgba(0,230,118,0.28)' }
          }
        >
          {isRejected ? 'Rejected' : 'Accepted'}
        </span>
        {isRejected && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,80,80,0.6)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        )}
      </div>
    </div>
  )

  if (isRejected) {
    return (
      <button className="w-full text-left active:opacity-80 transition-opacity" onClick={() => onRejectedTap(record)}>
        {inner}
      </button>
    )
  }
  return <div>{inner}</div>
}

// ── Main Component ────────────────────────────────────────────────────────────

type Phase = 'idle' | 'scanning' | 'result' | 'manual'

export default function DriverScanScreen() {
  const navigate = useNavigate()

  const [phase, setPhase]             = useState<Phase>('idle')
  const [manualInput, setManualInput] = useState('')
  const [lastScan, setLastScan]       = useState<ScanRecord | null>(null)
  const [history, setHistory]         = useState<ScanRecord[]>(INITIAL_HISTORY)
  const [rejectedModal, setRejectedModal] = useState<ScanRecord | null>(null)
  const [confirmed, setConfirmed]     = useState(false)

  const triggerScan = (rawCode?: string) => {
    setPhase('scanning')
    setConfirmed(false)
    setTimeout(() => {
      const ts = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      const code = rawCode?.trim().toUpperCase() || `BAG-DRV-${Date.now().toString().slice(-8)}`
      const last4 = code.slice(-4)
      const record: ScanRecord = {
        id: `scan-${Date.now()}`,
        code,
        last4,
        ts: `Today · ${ts}`,
        status: 'accepted',
      }
      setLastScan(record)
      setHistory((prev) => [record, ...prev])
      setPhase('result')
    }, 950)
  }

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualInput.trim()) return
    triggerScan(manualInput)
    setManualInput('')
    setPhase('idle')
  }

  const handleConfirmPickup = () => {
    setConfirmed(true)
    setTimeout(() => {
      setPhase('idle')
      setLastScan(null)
      setConfirmed(false)
    }, 1400)
  }

  const handleReset = () => {
    setPhase('idle')
    setLastScan(null)
    setConfirmed(false)
  }

  return (
    <div className="relative flex flex-col min-h-screen" style={{ background: '#061426' }}>
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 grid-bg" style={{ zIndex: 0 }} />
      <div
        className="pointer-events-none absolute"
        style={{ top: -60, left: -40, width: 220, height: 220, background: 'rgba(0,100,255,0.35)', filter: 'blur(52px)', borderRadius: '50%', zIndex: 0 }}
      />

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header
        className="relative flex items-center justify-between px-4"
        style={{
          paddingTop: 'max(env(safe-area-inset-top, 0px), 16px)',
          paddingBottom: '12px',
          borderBottom: '1px solid rgba(0,190,255,0.15)',
          background: 'rgba(6,20,38,0.92)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          zIndex: 10,
        }}
      >
        <DriverHeader initials="DR" />
      </header>

      {/* ── Scrollable body ─────────────────────────────────────────────────── */}
      <main className="relative flex-1 overflow-y-auto pb-28" style={{ zIndex: 1 }}>
        <div className="px-5 pt-5 space-y-5" style={{ animation: 'fadeSlideUp 0.3s ease both' }}>

          {/* ── Page title ──────────────────────────────────────────────────── */}
          <div className="flex items-start justify-between">
            <div>
              <p style={{ fontSize: 26, color: '#ffffff', fontWeight: 700, lineHeight: 1.2 }}>
                Scan Bag
              </p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 3, lineHeight: 1.5 }}>
                Scan bag QR at pickup before placing bag in vehicle
              </p>
            </div>
            <button
              onClick={() => navigate('/dashboard/driver')}
              className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold shrink-0 mt-1"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(0,190,255,0.2)',
                color: 'rgba(0,210,255,0.7)',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              Back
            </button>
          </div>

          {/* ── Scanner card ────────────────────────────────────────────────── */}
          <div
            className="rounded-2xl p-4 space-y-4"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(0,188,212,0.2)',
              backdropFilter: 'blur(12px)',
              boxShadow: '0 0 32px rgba(0,188,212,0.07)',
            }}
          >
            <ScannerViewfinder scanning={phase === 'scanning'} />

            {/* Mode toggle */}
            <div
              className="flex rounded-xl p-1"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(0,188,212,0.15)' }}
            >
              {(['scan', 'manual'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setPhase(m === 'scan' ? 'idle' : 'manual')}
                  className="flex-1 rounded-lg py-2 text-sm font-medium transition-all"
                  style={
                    (m === 'scan' && phase !== 'manual') || (m === 'manual' && phase === 'manual')
                      ? { background: 'linear-gradient(135deg,#0057e7,#00BCD4)', color: '#fff', boxShadow: '0 0 10px rgba(0,188,212,0.3)' }
                      : { color: 'rgba(255,255,255,0.4)' }
                  }
                >
                  {m === 'scan' ? 'Scan' : 'Enter Manually'}
                </button>
              ))}
            </div>

            {/* Manual entry form */}
            {phase === 'manual' && (
              <form onSubmit={handleManualSubmit} className="space-y-3">
                <input
                  type="text"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value.toUpperCase())}
                  placeholder="e.g. BAG-00123"
                  autoFocus
                  className="w-full rounded-xl px-4 py-3 text-sm font-mono outline-none"
                  style={{
                    background: 'rgba(255,255,255,0.07)',
                    border: '1px solid rgba(0,188,212,0.3)',
                    color: '#E0F7FA',
                    caretColor: '#00BCD4',
                  }}
                />
                <button
                  type="submit"
                  disabled={!manualInput.trim()}
                  className="w-full rounded-full py-3.5 text-sm font-bold text-white disabled:opacity-50 transition-all active:scale-[0.98]"
                  style={{ background: 'linear-gradient(135deg,#0057e7,#00BCD4)', boxShadow: '0 4px 18px rgba(0,188,212,0.35)' }}
                >
                  Scan Bag
                </button>
              </form>
            )}

            {/* Scan button */}
            {phase !== 'manual' && phase !== 'scanning' && phase !== 'result' && (
              <button
                onClick={() => triggerScan()}
                className="w-full rounded-full py-3.5 text-sm font-bold text-white transition-all active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg,#0057e7,#00BCD4)', boxShadow: '0 4px 18px rgba(0,188,212,0.35)' }}
              >
                Scan Bag
              </button>
            )}

            {/* Scanning in progress */}
            {phase === 'scanning' && (
              <button
                disabled
                className="w-full rounded-full py-3.5 text-sm font-bold text-white opacity-70"
                style={{ background: 'linear-gradient(135deg,#0057e7,#00BCD4)' }}
              >
                Scanning…
              </button>
            )}
          </div>

          {/* ── Result card ─────────────────────────────────────────────────── */}
          {phase === 'result' && lastScan && (
            <div
              className="rounded-2xl p-5 space-y-4"
              style={{
                background: 'rgba(0,230,118,0.05)',
                border: '1px solid rgba(0,230,118,0.35)',
                boxShadow: '0 0 24px rgba(0,230,118,0.10)',
                animation: 'fadeSlideUp 0.25s ease both',
              }}
            >
              {/* Status badge */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-full"
                    style={{ background: 'rgba(0,230,118,0.15)', border: '1.5px solid rgba(0,230,118,0.5)', boxShadow: '0 0 10px rgba(0,230,118,0.3)' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00E676" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  </div>
                  <div>
                    <p style={{ fontSize: 13, color: '#00E676', fontWeight: 700 }}>GREEN — Accepted for pickup</p>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>Bag looks safe and ready for transport</p>
                  </div>
                </div>
                <button onClick={handleReset} style={{ color: 'rgba(255,255,255,0.35)', fontSize: 16 }}>✕</button>
              </div>

              {/* Bag details */}
              <div
                className="rounded-xl p-3.5 space-y-2"
                style={{ background: 'rgba(0,230,118,0.05)', border: '1px solid rgba(0,230,118,0.18)' }}
              >
                <div className="flex justify-between items-center">
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Bag Code</p>
                  <p style={{ fontSize: 12, color: '#00E676', fontWeight: 700, fontFamily: 'monospace' }}>{lastScan.code}</p>
                </div>
                <div className="flex justify-between items-center">
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Last 4</p>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontFamily: 'monospace' }}>···{lastScan.last4}</p>
                </div>
                <div className="flex justify-between items-center">
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Scanned</p>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>just now</p>
                </div>
              </div>

              {/* Actions */}
              {confirmed ? (
                <div className="flex items-center justify-center gap-2 py-1">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00E676" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  <span style={{ fontSize: 13, color: '#00E676', fontWeight: 600 }}>Pickup Confirmed!</span>
                </div>
              ) : (
                <div className="flex gap-3">
                  <button
                    onClick={handleReset}
                    className="flex-1 rounded-xl py-3 text-sm font-semibold"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)' }}
                  >
                    Add to Route
                  </button>
                  <button
                    onClick={handleConfirmPickup}
                    className="flex-1 rounded-xl py-3 text-sm font-bold"
                    style={{ background: 'linear-gradient(135deg,rgba(0,230,118,0.3),rgba(0,230,118,0.15))', border: '1px solid rgba(0,230,118,0.45)', color: '#00E676' }}
                  >
                    Confirm Pickup
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Bag History ─────────────────────────────────────────────────── */}
          <div>
            <p
              style={{
                fontSize: 10,
                color: '#00BCD4',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                marginBottom: 12,
              }}
            >
              Bag History
            </p>
            <div className="space-y-2.5">
              {history.map((record) => (
                <HistoryRow
                  key={record.id}
                  record={record}
                  onRejectedTap={setRejectedModal}
                />
              ))}
            </div>
          </div>

        </div>
      </main>

      {/* ── Bottom nav ──────────────────────────────────────────────────────── */}
      <DriverBottomNav
        tab="pickups"
        onTab={() => navigate('/dashboard/driver')}
        pickupCount={0}
      />

      {/* ── Rejected notes modal ────────────────────────────────────────────── */}
      {rejectedModal && (
        <RejectedModal
          record={rejectedModal}
          onClose={() => setRejectedModal(null)}
        />
      )}
    </div>
  )
}
