// ── Driver Route View ─────────────────────────────────────────────────────────
// Route stop list with arrive → scan pickup flow.
//
// Flow per stop:
//   pending → tap "🚗 Arrived" → consumer notified → "📷 Scan Pickup" appears
//   "📷 Scan Pickup" → navigates to /driver/scan?stop_id=...&route_id=...&address=...
//   DriverScanInspect handles QR + green/yellow/red + DB save + completeStop
//   On return the stop shows as completed (Zustand store updated by DriverScanInspect)

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { RouteStop } from '../../types'

// ── Map positions ──────────────────────────────────────────────────────────────

const STOP_POSITIONS = [
  { x: 13, y: 62 }, { x: 28, y: 30 }, { x: 45, y: 54 }, { x: 61, y: 26 },
  { x: 76, y: 56 }, { x: 55, y: 78 }, { x: 36, y: 70 }, { x: 69, y: 40 },
  { x: 22, y: 44 }, { x: 83, y: 65 },
]
const WAREHOUSE_POS = { x: 90, y: 78 }

// ── Notification helper ────────────────────────────────────────────────────────

async function notifyArrived(stop: RouteStop) {
  try {
    await supabase.functions.invoke('send-push-notification', {
      body: {
        stop_id: stop.id,
        bag_id:  stop.bag_id,
        title:   '🚗 Your driver has arrived!',
        body:    'Your recycling driver is outside. Please bring your bag to the door.',
        data:    { type: 'driver_arrived', stop_id: stop.id },
      },
    })
  } catch { /* best-effort */ }
}

// ── Map dot color ──────────────────────────────────────────────────────────────

function dotColor(status: string, isArrived: boolean) {
  if (status === 'completed') return '#22c55e'
  if (isArrived)              return '#fbbf24'
  return '#3b82f6'
}

// ── Component ──────────────────────────────────────────────────────────────────

export function DriverRouteView({
  stops,
  routeId,
}: {
  stops:    RouteStop[]
  routeId:  string
  /** Kept for API compatibility — stop completion is handled inside DriverScanInspect via completeStop + Zustand */
  onComplete?: (id: string) => void
}) {
  const navigate = useNavigate()

  const sorted       = [...stops].sort((a, b) => a.stop_order - b.stop_order)
  const doneCount    = stops.filter(s => s.status === 'completed' || s.status === 'skipped').length
  const pendingCount = stops.filter(s => s.status === 'pending').length
  const allDone      = pendingCount === 0 && stops.length > 0

  // Which stop the driver has tapped "Arrived" for (local — awaiting scan)
  const [arrivedStopId, setArrivedStopId] = useState<string | null>(null)
  const [notifying,     setNotifying]     = useState(false)
  const [scanningStopId,setScanningStopId]= useState<string | null>(null) // loading while fetching expected QR
  const [toast,         setToast]         = useState<string | null>(null)

  function showToast(msg: string, ms = 2600) {
    setToast(msg)
    setTimeout(() => setToast(null), ms)
  }

  async function handleArrive(stop: RouteStop) {
    setNotifying(true)
    await notifyArrived(stop)
    setNotifying(false)
    setArrivedStopId(stop.id)
    showToast('📍 Consumer notified — you\'ve arrived!')
  }

  async function handleScanPickup(stop: RouteStop) {
    setScanningStopId(stop.id)

    // Look up the exact expected QR code for this stop's bag so the scanner
    // can do strict equality validation (prevents accepting wrong bag codes).
    let expectedQr: string | null = null
    if (stop.bag_id) {
      try {
        const { data } = await supabase
          .from('qr_bags')
          .select('bag_code')
          .eq('id', stop.bag_id)
          .maybeSingle()
        expectedQr = data?.bag_code ?? null
      } catch {
        /* proceed without validation if lookup fails */
      }
    }

    setScanningStopId(null)

    const params = new URLSearchParams({
      stop_id:  stop.id,
      route_id: routeId,
      address:  stop.address,
      mode:     'residential',
    })
    if (expectedQr) params.set('expected_qr', expectedQr)
    navigate(`/driver/scan?${params.toString()}`)
  }

  // "You" dot position = next pending stop
  const nextIdx = sorted.findIndex(s => s.status === 'pending')
  const youBase = nextIdx >= 0 && STOP_POSITIONS[nextIdx]
    ? STOP_POSITIONS[nextIdx]
    : STOP_POSITIONS[0] ?? { x: 50, y: 50 }
  const youPos  = { x: youBase.x - 4, y: youBase.y - 9 }

  return (
    <>
      <style>{`
        @keyframes dotPulse    { 0%,100%{opacity:1;transform:scale(1)}   50%{opacity:0.55;transform:scale(0.82)} }
        @keyframes fadeSlideUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      <div style={{ animation: 'fadeSlideUp 0.3s ease both' }}>

        {/* ── Summary bar ─────────────────────────────────────────────────── */}
        <div className="px-5 pt-4 pb-4 grid grid-cols-3 gap-2.5">
          {[
            { value: String(sorted.length), label: 'STOPS' },
            { value: String(sorted.length), label: 'BAGS'  },
            { value: String(doneCount),     label: 'DONE'  },
          ].map(card => (
            <div
              key={card.label}
              className="rounded-2xl p-3 flex flex-col gap-1"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(0,190,255,0.15)' }}
            >
              <p style={{ fontSize: 18, color: '#ffffff', fontWeight: 700, lineHeight: 1.2 }}>{card.value}</p>
              <p style={{ fontSize: 10, color: '#00c8ff', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                {card.label}
              </p>
            </div>
          ))}
        </div>

        {/* ── Mini route map ───────────────────────────────────────────────── */}
        <div className="px-5 mb-4">
          <div
            className="relative rounded-2xl overflow-hidden"
            style={{ height: 170, background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(0,190,255,0.2)' }}
          >
            {/* Grid */}
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `
                  linear-gradient(rgba(0,190,255,0.06) 1px,transparent 1px),
                  linear-gradient(90deg,rgba(0,190,255,0.06) 1px,transparent 1px)
                `,
                backgroundSize: '20px 20px',
              }}
            />
            {/* Road lines */}
            {['37%', '64%'].map(t => (
              <div key={t} className="absolute" style={{ top: t, left: 0, right: 0, height: 1, background: 'rgba(0,190,255,0.08)' }} />
            ))}
            {['32%', '66%'].map(l => (
              <div key={l} className="absolute" style={{ left: l, top: 0, bottom: 0, width: 1, background: 'rgba(0,190,255,0.08)' }} />
            ))}

            {/* Route lines */}
            <svg className="absolute inset-0" style={{ width: '100%', height: '100%' }} viewBox="0 0 100 100" preserveAspectRatio="none">
              {sorted.map((stop, i) => {
                if (i === 0) return null
                const from = STOP_POSITIONS[i - 1]
                const to   = STOP_POSITIONS[i]
                if (!from || !to) return null
                const prev  = sorted[i - 1]
                const color = (prev.status === 'completed' && stop.status === 'completed')
                  ? '#22c55e' : 'rgba(59,130,246,0.5)'
                return (
                  <line key={`line-${stop.id}`}
                    x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                    stroke={color} strokeWidth="0.9" strokeOpacity="0.75"
                  />
                )
              })}
              {sorted.length > 0 && STOP_POSITIONS[sorted.length - 1] && (
                <line
                  x1={STOP_POSITIONS[sorted.length - 1].x} y1={STOP_POSITIONS[sorted.length - 1].y}
                  x2={WAREHOUSE_POS.x} y2={WAREHOUSE_POS.y}
                  stroke="rgba(251,191,36,0.45)" strokeWidth="0.9" strokeDasharray="3,2"
                />
              )}
            </svg>

            {/* Stop dots */}
            {sorted.map((stop, i) => {
              const pos      = STOP_POSITIONS[i]
              if (!pos) return null
              const isActive = stop.id === arrivedStopId
              const color    = dotColor(stop.status, isActive)
              return (
                <div key={stop.id} className="absolute flex flex-col items-center"
                  style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translate(-50%,-50%)' }}>
                  <div style={{
                    width: isActive ? 16 : 13, height: isActive ? 16 : 13,
                    borderRadius: '50%', background: color,
                    boxShadow: `0 0 ${isActive ? 10 : 6}px ${color}80`,
                    animation: isActive ? 'dotPulse 1.2s ease-in-out infinite' : 'none',
                  }} />
                  <span style={{ fontSize: 8, color, fontWeight: 700, marginTop: 1, lineHeight: 1 }}>
                    {stop.status === 'completed' ? '✓' : `#${i + 1}`}
                  </span>
                </div>
              )
            })}

            {/* Warehouse */}
            <div className="absolute flex flex-col items-center"
              style={{ left: `${WAREHOUSE_POS.x}%`, top: `${WAREHOUSE_POS.y}%`, transform: 'translate(-50%,-50%)' }}>
              <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fbbf24', boxShadow: '0 0 8px rgba(251,191,36,0.55)' }} />
              <span style={{ fontSize: 8, color: '#fbbf24', fontWeight: 700, marginTop: 1 }}>WH</span>
            </div>

            {/* You */}
            <div className="absolute flex flex-col items-center"
              style={{ left: `${youPos.x}%`, top: `${youPos.y}%`, transform: 'translate(-50%,-50%)', gap: 2 }}>
              <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#00c8ff', animation: 'dotPulse 1.5s ease-in-out infinite' }} />
              <span style={{ fontSize: 8, color: '#00c8ff', fontWeight: 600 }}>You</span>
            </div>

            {/* Legend */}
            <div className="absolute bottom-2 right-2.5 space-y-0.5"
              style={{ background: 'rgba(0,0,0,0.5)', borderRadius: 8, padding: '5px 8px' }}>
              {[
                { color: '#22c55e', label: 'Complete' },
                { color: '#3b82f6', label: 'Upcoming' },
                { color: '#fbbf24', label: 'At Stop'  },
                { color: '#fbbf24', label: 'Warehouse' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-1.5">
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.55)' }}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Warning banner ───────────────────────────────────────────────── */}
        {!allDone && (
          <div
            className="mx-5 mb-4 flex items-center gap-2.5 rounded-xl px-3.5 py-2.5"
            style={{ background: 'rgba(255,23,68,0.07)', border: '1px solid rgba(255,23,68,0.22)' }}
          >
            <span style={{ fontSize: 14 }}>⚠️</span>
            <p style={{ fontSize: 11, color: 'rgba(255,100,100,0.9)' }}>
              Scan all stops to go offline &amp; get paid
            </p>
          </div>
        )}

        {/* ── Stop list ────────────────────────────────────────────────────── */}
        <div className="px-5 space-y-2.5 mb-4">
          {sorted.map((stop, i) => {
            const isDone    = stop.status === 'completed' || stop.status === 'skipped'
            const isArrived = stop.id === arrivedStopId
            const dotC      = dotColor(stop.status, isArrived)

            return (
              <div
                key={stop.id}
                className="rounded-2xl overflow-hidden"
                style={{
                  background: isArrived ? 'rgba(251,191,36,0.04)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${
                    isArrived ? 'rgba(251,191,36,0.35)' :
                    isDone    ? 'rgba(34,197,94,0.2)'   :
                               'rgba(0,190,255,0.12)'
                  }`,
                  transition: 'border 0.3s ease',
                }}
              >
                <div className="px-4 py-3 flex items-center gap-3">
                  {/* Step circle */}
                  <div
                    className="shrink-0 flex items-center justify-center"
                    style={{ width: 32, height: 32, borderRadius: '50%', background: `${dotC}18`, border: `1.5px solid ${dotC}` }}
                  >
                    {isDone ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={dotC} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    ) : isArrived ? (
                      <span style={{ fontSize: 14 }}>📍</span>
                    ) : (
                      <span style={{ fontSize: 11, fontWeight: 700, color: dotC }}>{i + 1}</span>
                    )}
                  </div>

                  {/* Address */}
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize: 13, color: '#ffffff', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {stop.address}
                    </p>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                      {stop.zip_code} · Stop #{i + 1}
                      {isArrived && <span style={{ color: '#fbbf24', marginLeft: 6, fontWeight: 700 }}>· At location</span>}
                    </p>
                  </div>

                  {/* CTA */}
                  {isDone ? (
                    <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 700, flexShrink: 0 }}>Done ✓</span>
                  ) : isArrived ? (
                    <button
                      onClick={() => handleScanPickup(stop)}
                      disabled={scanningStopId === stop.id}
                      className="rounded-xl px-3 py-1.5 text-xs font-bold transition-all active:scale-[0.93] disabled:opacity-60"
                      style={{
                        background: 'rgba(0,200,255,0.12)', border: '1px solid rgba(0,200,255,0.4)',
                        color: '#00c8ff', flexShrink: 0, cursor: scanningStopId === stop.id ? 'default' : 'pointer',
                      }}
                    >
                      {scanningStopId === stop.id ? '⏳ Loading…' : '📷 Scan Pickup'}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleArrive(stop)}
                      disabled={notifying || (!!arrivedStopId && arrivedStopId !== stop.id)}
                      className="rounded-xl px-2.5 py-1.5 text-xs font-bold transition-all active:scale-[0.93] disabled:opacity-40"
                      style={{
                        background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.4)',
                        color: '#60a5fa', flexShrink: 0, cursor: 'pointer',
                      }}
                    >
                      🚗 Arrived
                    </button>
                  )}
                </div>
              </div>
            )
          })}

          {/* Warehouse row */}
          <div
            className="rounded-2xl px-4 py-3 flex items-center gap-3"
            style={{
              background: allDone ? 'rgba(251,191,36,0.08)' : 'rgba(251,191,36,0.05)',
              border: `1px solid ${allDone ? 'rgba(251,191,36,0.35)' : 'rgba(251,191,36,0.2)'}`,
              transition: 'all 0.3s ease',
            }}
          >
            <div className="shrink-0 flex items-center justify-center"
              style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(251,191,36,0.12)', fontSize: 16 }}>
              🏭
            </div>
            <div className="flex-1 min-w-0">
              <p style={{ fontSize: 13, color: '#fbbf24', fontWeight: 600 }}>Nashville Main Warehouse</p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                {allDone ? 'All stops complete — head to warehouse now!' : 'Final destination · Drop off all accepted bags'}
              </p>
            </div>
            {allDone && (
              <button
                onClick={() => {
                  const p = new URLSearchParams({
                    route_id:       routeId,
                    warehouse_code: 'NASH-01',
                    warehouse_name: 'Nashville Main',
                  })
                  navigate(`/driver/warehouse-checkin?${p.toString()}`)
                }}
                className="rounded-xl px-3 py-1.5 text-xs font-bold transition-all active:scale-[0.93] shrink-0"
                style={{
                  background: 'rgba(251,191,36,0.15)',
                  border:     '1px solid rgba(251,191,36,0.45)',
                  color:      '#fbbf24',
                  cursor:     'pointer',
                }}
              >
                Arrived →
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Toast ─────────────────────────────────────────────────────────────── */}
      {toast && (
        <div
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-sm font-semibold"
          style={{
            background: 'rgba(0,200,255,0.15)', border: '1px solid rgba(0,200,255,0.3)',
            color: '#00c8ff', backdropFilter: 'blur(12px)',
            whiteSpace: 'nowrap', boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          }}
        >
          {toast}
        </div>
      )}
    </>
  )
}
