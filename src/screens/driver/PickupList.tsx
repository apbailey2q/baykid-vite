import type { RouteStop, StopStatus } from '../../types'

interface Props {
  stops: RouteStop[]
  onComplete: (id: string) => void
  onSkip: (id: string) => void
}

// ── Status badge styles (dark theme) ────────────────────────────────────────
const STATUS_BADGE: Record<StopStatus, { label: string; bg: string; color: string }> = {
  pending:   { label: 'Pending',  bg: 'rgba(123,144,156,0.15)', color: '#7B909C' },
  completed: { label: 'Done',     bg: 'rgba(0,230,118,0.15)',   color: '#00E676' },
  skipped:   { label: 'Skipped',  bg: 'rgba(255,214,0,0.15)',   color: '#FFD600' },
}

export function PickupList({ stops, onComplete, onSkip }: Props) {
  if (stops.length === 0) {
    return (
      <div
        className="rounded-2xl p-10 text-center"
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px dashed rgba(0,188,212,0.2)',
        }}
      >
        <p className="text-sm" style={{ color: '#7B909C' }}>No stops on this route</p>
      </div>
    )
  }

  // ── Group by ZIP (UNCHANGED logic) ──────────────────────────────────────
  const grouped = stops.reduce<Record<string, RouteStop[]>>((acc, stop) => {
    if (!acc[stop.zip_code]) acc[stop.zip_code] = []
    acc[stop.zip_code].push(stop)
    return acc
  }, {})

  const zips = Object.keys(grouped).sort()

  return (
    <div className="space-y-4">
      {zips.map((zip) => (
        <div
          key={zip}
          className="overflow-hidden rounded-2xl"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(0,188,212,0.15)',
          }}
        >
          {/* ZIP header */}
          <div
            className="flex items-center gap-2 px-4 py-2.5"
            style={{
              background: 'rgba(0,188,212,0.08)',
              borderBottom: '1px solid rgba(0,188,212,0.15)',
            }}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              style={{ color: '#00BCD4' }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
            <span
              className="text-xs font-bold uppercase tracking-wide"
              style={{ color: '#00BCD4' }}
            >
              ZIP {zip}
            </span>
            <span className="ml-auto text-xs" style={{ color: '#7B909C' }}>
              {grouped[zip].filter((s) => s.status === 'completed').length}/{grouped[zip].length} done
            </span>
          </div>

          {/* Stop rows */}
          <div>
            {grouped[zip].map((stop, i) => {
              const badge = STATUS_BADGE[stop.status]
              const isPending = stop.status === 'pending'
              const isLast = i === grouped[zip].length - 1

              return (
                <div
                  key={stop.id}
                  className={`px-4 py-3 transition-opacity ${stop.status !== 'pending' ? 'opacity-50' : ''}`}
                  style={!isLast ? { borderBottom: '1px solid rgba(255,255,255,0.05)' } : {}}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p
                        className={`text-sm font-medium ${stop.status === 'completed' ? 'line-through' : ''}`}
                        style={{ color: stop.status === 'completed' ? '#7B909C' : '#E0F7FA' }}
                      >
                        {stop.address}
                      </p>
                      <p className="mt-0.5 text-xs" style={{ color: '#7B909C' }}>
                        Stop #{stop.stop_order}
                      </p>
                    </div>
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold"
                      style={{ background: badge.bg, color: badge.color }}
                    >
                      {badge.label}
                    </span>
                  </div>

                  {isPending && (
                    <div className="mt-2.5 space-y-2">
                      {/* Navigate button */}
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stop.address + ' ' + stop.zip_code)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-opacity hover:opacity-80"
                        style={{ background: 'rgba(0,188,212,0.1)', border: '1px solid rgba(0,188,212,0.25)', color: '#00BCD4' }}
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                        </svg>
                        Navigate
                      </a>
                      <div className="flex gap-2">
                        <button
                          onClick={() => onComplete(stop.id)}
                          className="flex-1 rounded-lg py-2 text-xs font-bold active:scale-95 transition-transform"
                          style={{ background: 'rgba(0,230,118,0.2)', border: '1px solid rgba(0,230,118,0.4)', color: '#00E676', boxShadow: '0 0 10px rgba(0,230,118,0.15)' }}
                        >
                          ✓ Mark Done
                        </button>
                        <button
                          onClick={() => onSkip(stop.id)}
                          className="rounded-lg px-3 py-2 text-xs font-medium transition-opacity hover:opacity-70"
                          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#7B909C' }}
                        >
                          Skip
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
