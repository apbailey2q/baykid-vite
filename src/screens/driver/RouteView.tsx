import type { RouteStop } from '../../types'

interface Props {
  stops: RouteStop[]
  onComplete: (id: string) => void
  onSkip: (id: string) => void
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  completed: (
    <div
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold"
      style={{ background: 'rgba(0,230,118,0.2)', color: '#00E676', border: '1px solid rgba(0,230,118,0.4)' }}
    >
      ✓
    </div>
  ),
  skipped: (
    <div
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold"
      style={{ background: 'rgba(255,255,255,0.06)', color: '#7B909C', border: '1px solid rgba(255,255,255,0.1)' }}
    >
      →
    </div>
  ),
}

export function RouteView({ stops, onComplete, onSkip }: Props) {
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

  const firstPendingIdx = stops.findIndex((s) => s.status === 'pending')

  return (
    <div className="relative">
      {/* Vertical connector line */}
      <div
        className="absolute left-[19px] top-8 bottom-8 w-0.5"
        style={{ background: 'rgba(0,188,212,0.2)' }}
      />

      <div className="space-y-3 relative">
        {stops.map((stop, idx) => {
          const isCurrent = idx === firstPendingIdx
          const isPending = stop.status === 'pending'

          return (
            <div
              key={stop.id}
              className="flex gap-3 rounded-2xl p-4 transition-shadow"
              style={
                isCurrent
                  ? {
                      background: 'rgba(0,188,212,0.06)',
                      border: '1px solid rgba(0,188,212,0.35)',
                      boxShadow: '0 0 16px rgba(0,188,212,0.1)',
                    }
                  : {
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }
              }
            >
              {/* Step indicator */}
              {stop.status !== 'pending' ? (
                STATUS_ICON[stop.status]
              ) : (
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                  style={
                    isCurrent
                      ? { background: '#00BCD4', color: '#061426' }
                      : { background: 'rgba(255,255,255,0.08)', color: '#7B909C' }
                  }
                >
                  {stop.stop_order}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p
                      className={`text-sm font-semibold ${stop.status === 'completed' ? 'line-through' : ''}`}
                      style={{ color: stop.status === 'completed' ? '#7B909C' : '#E0F7FA' }}
                    >
                      {stop.address}
                    </p>
                    <p className="mt-0.5 text-xs" style={{ color: '#7B909C' }}>
                      ZIP {stop.zip_code}
                    </p>
                  </div>
                  {isCurrent && (
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold"
                      style={{ background: 'rgba(0,188,212,0.15)', color: '#00BCD4' }}
                    >
                      Current
                    </span>
                  )}
                  {stop.status === 'skipped' && (
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{ background: 'rgba(255,214,0,0.15)', color: '#FFD600' }}
                    >
                      Skipped
                    </span>
                  )}
                </div>

                {isPending && (
                  <div className="mt-2.5 space-y-2">
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
                      {!isCurrent && (
                        <button
                          onClick={() => onSkip(stop.id)}
                          className="rounded-lg px-3 py-2 text-xs font-medium transition-opacity hover:opacity-70"
                          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#7B909C' }}
                        >
                          Skip
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
