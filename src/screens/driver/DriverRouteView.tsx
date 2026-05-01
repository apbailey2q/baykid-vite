import type { RouteStop } from '../../types'

// ── Map layout positions (% of container width/height) ────────────────────────

const STOP_POSITIONS = [
  { x: 13, y: 62 },
  { x: 28, y: 30 },
  { x: 45, y: 54 },
  { x: 61, y: 26 },
  { x: 76, y: 56 },
  { x: 55, y: 78 },
  { x: 36, y: 70 },
  { x: 69, y: 40 },
  { x: 22, y: 44 },
  { x: 83, y: 65 },
]

const WAREHOUSE_POS = { x: 90, y: 78 }

function stopColor(status: string) {
  if (status === 'completed') return '#ef4444'
  if (status === 'skipped')   return '#0ea5e9'
  return '#22c55e'
}

function lineColor(a: string, b: string) {
  if (a === 'completed' && b === 'completed') return '#ef4444'
  if (a === 'skipped'   || b === 'skipped')   return '#0ea5e9'
  return '#22c55e'
}

// ── Component ──────────────────────────────────────────────────────────────────

export function DriverRouteView({
  stops,
  onComplete,
  onCompleteRoute,
  isCompletingRoute,
}: {
  stops: RouteStop[]
  onComplete: (id: string) => void
  onCompleteRoute: () => void
  isCompletingRoute: boolean
}) {
  const sorted      = [...stops].sort((a, b) => a.stop_order - b.stop_order)
  const doneCount   = stops.filter((s) => s.status === 'completed' || s.status === 'skipped').length
  const pendingCount = stops.filter((s) => s.status === 'pending').length
  const allDone     = pendingCount === 0 && stops.length > 0

  const nextIdx  = sorted.findIndex((s) => s.status === 'pending')
  const youBase  = nextIdx >= 0 && STOP_POSITIONS[nextIdx]
    ? STOP_POSITIONS[nextIdx]
    : STOP_POSITIONS[0] ?? { x: 50, y: 50 }
  const youPos   = { x: youBase.x - 4, y: youBase.y - 9 }

  return (
    <div style={{ animation: 'fadeSlideUp 0.3s ease both' }}>

      {/* ── Summary bar ──────────────────────────────────────────────────── */}
      <div className="px-5 pt-4 pb-4 grid grid-cols-3 gap-2.5">
        {[
          { value: String(sorted.length), label: 'STOPS' },
          { value: String(sorted.length), label: 'BAGS'  },
          { value: String(doneCount),     label: 'DONE'  },
        ].map((card) => (
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

      {/* ── Route map ────────────────────────────────────────────────────── */}
      <div className="px-5 mb-4">
        <div
          className="relative rounded-2xl overflow-hidden"
          style={{ height: 180, background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(0,190,255,0.2)' }}
        >
          {/* Grid overlay */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `
                linear-gradient(rgba(0,190,255,0.06) 1px, transparent 1px),
                linear-gradient(90deg, rgba(0,190,255,0.06) 1px, transparent 1px)
              `,
              backgroundSize: '20px 20px',
            }}
          />

          {/* Road lines */}
          <div className="absolute" style={{ top: '37%', left: 0, right: 0, height: 1, background: 'rgba(0,190,255,0.1)' }} />
          <div className="absolute" style={{ top: '64%', left: 0, right: 0, height: 1, background: 'rgba(0,190,255,0.1)' }} />
          <div className="absolute" style={{ left: '32%', top: 0, bottom: 0, width: 1, background: 'rgba(0,190,255,0.1)' }} />
          <div className="absolute" style={{ left: '66%', top: 0, bottom: 0, width: 1, background: 'rgba(0,190,255,0.1)' }} />

          {/* SVG route lines */}
          <svg
            className="absolute inset-0"
            style={{ width: '100%', height: '100%' }}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            {sorted.map((stop, i) => {
              if (i === 0) return null
              const from = STOP_POSITIONS[i - 1]
              const to   = STOP_POSITIONS[i]
              if (!from || !to) return null
              const prev    = sorted[i - 1]
              const color   = lineColor(prev.status, stop.status)
              const dashed  = prev.status === 'skipped' || stop.status === 'skipped'
              return (
                <line
                  key={`line-${stop.id}`}
                  x1={from.x} y1={from.y}
                  x2={to.x}   y2={to.y}
                  stroke={color}
                  strokeWidth="0.9"
                  strokeOpacity="0.75"
                  strokeDasharray={dashed ? '3,2' : undefined}
                />
              )
            })}

            {/* Dashed line to warehouse */}
            {sorted.length > 0 && STOP_POSITIONS[sorted.length - 1] && (
              <line
                x1={STOP_POSITIONS[sorted.length - 1].x}
                y1={STOP_POSITIONS[sorted.length - 1].y}
                x2={WAREHOUSE_POS.x}
                y2={WAREHOUSE_POS.y}
                stroke="rgba(251,191,36,0.45)"
                strokeWidth="0.9"
                strokeDasharray="3,2"
              />
            )}
          </svg>

          {/* Stop dots + labels */}
          {sorted.map((stop, i) => {
            const pos   = STOP_POSITIONS[i]
            if (!pos) return null
            const isDone      = stop.status === 'completed'
            const isRerouted  = stop.status === 'skipped'
            const color = stopColor(stop.status)
            return (
              <div
                key={stop.id}
                className="absolute flex flex-col items-center"
                style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translate(-50%,-50%)' }}
              >
                <div
                  style={{
                    width: 13, height: 13, borderRadius: '50%',
                    background: color,
                    boxShadow: `0 0 6px ${color}80`,
                    animation: isRerouted ? 'dotPulse 1.5s ease-in-out infinite' : 'none',
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: 8, color, fontWeight: 700, marginTop: 1, lineHeight: 1 }}>
                  {isDone ? '✓' : `#${i + 1}`}
                </span>
              </div>
            )
          })}

          {/* Warehouse dot */}
          <div
            className="absolute flex flex-col items-center"
            style={{ left: `${WAREHOUSE_POS.x}%`, top: `${WAREHOUSE_POS.y}%`, transform: 'translate(-50%,-50%)' }}
          >
            <div style={{
              width: 16, height: 16, borderRadius: '50%',
              background: '#fbbf24',
              boxShadow: '0 0 8px rgba(251,191,36,0.55)',
            }} />
            <span style={{ fontSize: 8, color: '#fbbf24', fontWeight: 700, marginTop: 1, lineHeight: 1 }}>WH</span>
          </div>

          {/* You pin */}
          <div
            className="absolute flex flex-col items-center"
            style={{ left: `${youPos.x}%`, top: `${youPos.y}%`, transform: 'translate(-50%,-50%)', gap: 2 }}
          >
            <div style={{
              width: 11, height: 11, borderRadius: '50%',
              background: '#00c8ff',
              animation: 'dotPulse 1.5s ease-in-out infinite',
            }} />
            <span style={{ fontSize: 8, color: '#00c8ff', fontWeight: 600 }}>You</span>
          </div>

          {/* Legend */}
          <div
            className="absolute bottom-2 right-2.5 space-y-0.5"
            style={{ background: 'rgba(0,0,0,0.5)', borderRadius: 8, padding: '5px 8px' }}
          >
            {[
              { color: '#ef4444', label: 'Completed' },
              { color: '#22c55e', label: 'Upcoming'  },
              { color: '#0ea5e9', label: 'Rerouted'  },
              { color: '#fbbf24', label: 'Warehouse' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-1.5">
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.55)' }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Warning bar ──────────────────────────────────────────────────── */}
      {!allDone && (
        <div
          className="mx-5 mb-4 flex items-center gap-2.5 rounded-xl px-3.5 py-2.5"
          style={{ background: 'rgba(255,23,68,0.07)', border: '1px solid rgba(255,23,68,0.22)' }}
        >
          <span style={{ fontSize: 14 }}>⚠️</span>
          <p style={{ fontSize: 11, color: 'rgba(255,100,100,0.9)' }}>
            Complete all stops to go offline &amp; get paid
          </p>
        </div>
      )}

      {/* ── Route list ───────────────────────────────────────────────────── */}
      <div className="px-5 space-y-2.5 mb-4">
        {sorted.map((stop, i) => {
          const isDone     = stop.status === 'completed'
          const isRerouted = stop.status === 'skipped'
          const color      = stopColor(stop.status)
          const circleBg   = isDone     ? 'rgba(239,68,68,0.12)'
                           : isRerouted ? 'rgba(14,165,233,0.12)'
                                        : 'rgba(34,197,94,0.1)'
          return (
            <div
              key={stop.id}
              className="rounded-2xl px-4 py-3 flex items-center gap-3"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(0,190,255,0.12)' }}
            >
              {/* Number / check circle */}
              <div
                className="shrink-0 flex items-center justify-center"
                style={{ width: 32, height: 32, borderRadius: '50%', background: circleBg, border: `1.5px solid ${color}` }}
              >
                {isDone ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : (
                  <span style={{ fontSize: 11, fontWeight: 700, color }}>{i + 1}</span>
                )}
              </div>

              {/* Address + meta */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p style={{ fontSize: 13, color: '#ffffff', fontWeight: 600 }}>{stop.address}</p>
                  {isRerouted && (
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[9px] font-bold"
                      style={{ background: 'rgba(14,165,233,0.15)', color: '#0ea5e9' }}
                    >
                      Rerouted
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                  {stop.zip_code} · Stop #{i + 1}
                </p>
              </div>

              {/* Complete / Done */}
              {isDone ? (
                <span style={{ fontSize: 12, color: '#22c55e', fontWeight: 600, flexShrink: 0 }}>Done</span>
              ) : (
                <button
                  onClick={() => onComplete(stop.id)}
                  className="rounded-xl px-3 py-1.5 text-xs font-semibold transition-all active:scale-[0.94] shrink-0"
                  style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.35)', color: '#22c55e' }}
                >
                  Complete
                </button>
              )}
            </div>
          )
        })}

        {/* Warehouse row */}
        <div
          className="rounded-2xl px-4 py-3 flex items-center gap-3"
          style={{ background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.2)' }}
        >
          <div
            className="shrink-0 flex items-center justify-center"
            style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(251,191,36,0.12)', fontSize: 16 }}
          >
            🏭
          </div>
          <div className="flex-1 min-w-0">
            <p style={{ fontSize: 13, color: '#fbbf24', fontWeight: 600 }}>Cyan's Brooklynn Warehouse</p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
              Final destination · 123 Industrial Blvd
            </p>
          </div>
        </div>
      </div>

      {/* ── Get Paid button (only when all stops done) ───────────────────── */}
      {allDone && (
        <div className="px-5 mb-4">
          <button
            onClick={onCompleteRoute}
            disabled={isCompletingRoute}
            className="w-full rounded-2xl py-4 text-sm font-bold text-white transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
            style={{
              background: 'linear-gradient(135deg,#0d9e3e,#22c55e)',
              boxShadow: '0 4px 24px rgba(34,197,94,0.35)',
            }}
          >
            {isCompletingRoute ? 'Processing…' : '✓ All Complete — Collect Payment'}
          </button>
        </div>
      )}

    </div>
  )
}
