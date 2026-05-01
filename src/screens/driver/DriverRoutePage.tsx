import { useNavigate } from 'react-router-dom'
import { useDemoStore } from '../../store/demoStore'
import { DriverHeader } from '../../components/driver/DriverHeader'
import { DriverBottomNav } from '../../components/driver/DriverBottomNav'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatSubtitle() {
  const now = new Date()
  const day  = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  return `${day} · Nashville, TN`
}

// ── Static route map placeholder ──────────────────────────────────────────────

function RouteMapPlaceholder({
  totalStops,
  doneCount,
  activeIdx,
}: {
  totalStops: number
  doneCount: number
  activeIdx: number
}) {
  const visibleCount = Math.min(totalStops, 5)
  const slotWidth    = 100 / (visibleCount + 1)

  const dots = Array.from({ length: visibleCount }, (_, i) => {
    const isDone    = i < doneCount
    const isActive  = i === activeIdx
    const xPct      = slotWidth * (i + 1)
    return { i, isDone, isActive, xPct }
  })

  return (
    <div
      className="relative rounded-2xl overflow-hidden"
      style={{
        height: 160,
        background: 'rgba(0,0,0,0.35)',
        border: '1px solid rgba(0,188,212,0.2)',
      }}
    >
      {/* Grid */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,188,212,0.07) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,188,212,0.07) 1px, transparent 1px)
          `,
          backgroundSize: '20px 20px',
        }}
      />

      {/* Full map button */}
      <button
        className="absolute top-3 right-3 rounded-full px-3 py-1 text-xs font-semibold"
        style={{
          background: 'rgba(0,188,212,0.12)',
          border: '1px solid rgba(0,188,212,0.3)',
          color: '#00BCD4',
          zIndex: 2,
        }}
      >
        Full map ›
      </button>

      {/* Route line + dots */}
      <div className="absolute" style={{ left: '8%', right: '8%', top: '50%', transform: 'translateY(-50%)' }}>
        {/* Line */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: 0,
            right: 0,
            height: 2,
            transform: 'translateY(-50%)',
            background: 'rgba(255,255,255,0.1)',
          }}
        />

        {/* You dot */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: '#00BCD4',
              boxShadow: '0 0 10px rgba(0,188,212,0.8)',
              animation: 'dotPulse 1.5s ease-in-out infinite',
            }}
          />
          <span style={{ fontSize: 9, color: '#00BCD4', fontWeight: 700, whiteSpace: 'nowrap', marginTop: 26 }}>
            You
          </span>
        </div>

        {/* Stop dots */}
        {dots.map(({ i, isDone, isActive, xPct }) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${xPct}%`,
              top: '50%',
              transform: 'translate(-50%, -50%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <div
              style={{
                width: isDone ? 12 : isActive ? 14 : 11,
                height: isDone ? 12 : isActive ? 14 : 11,
                borderRadius: '50%',
                background: isDone
                  ? '#00E676'
                  : isActive
                  ? '#FFD600'
                  : 'rgba(255,255,255,0.2)',
                border: isActive ? '2px solid rgba(255,214,0,0.6)' : isDone ? '2px solid rgba(0,230,118,0.5)' : '1px solid rgba(255,255,255,0.3)',
                boxShadow: isDone
                  ? '0 0 6px rgba(0,230,118,0.5)'
                  : isActive
                  ? '0 0 8px rgba(255,214,0,0.6)'
                  : 'none',
              }}
            />
            <span
              style={{
                fontSize: 9,
                color: isDone ? '#00E676' : isActive ? '#FFD600' : 'rgba(255,255,255,0.35)',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                marginTop: 26,
              }}
            >
              Stop {i + 1}
            </span>
          </div>
        ))}

        {/* Warehouse dot */}
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: '50%',
            transform: 'translate(50%, -50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              width: 11,
              height: 11,
              borderRadius: '50%',
              background: 'rgba(251,191,36,0.25)',
              border: '1px solid rgba(251,191,36,0.4)',
            }}
          />
          <span style={{ fontSize: 9, color: 'rgba(251,191,36,0.7)', fontWeight: 600, whiteSpace: 'nowrap', marginTop: 30 }}>
            WH
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Badge helpers ─────────────────────────────────────────────────────────────

function StopBadge({ status, isNext }: { status: string; isNext: boolean }) {
  if (status === 'completed') {
    return (
      <span
        className="rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap"
        style={{ background: 'rgba(0,230,118,0.12)', color: '#00E676', border: '1px solid rgba(0,230,118,0.3)' }}
      >
        Completed
      </span>
    )
  }
  if (status === 'active' || isNext) {
    return (
      <span
        className="rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap"
        style={{ background: 'rgba(0,188,212,0.12)', color: '#00BCD4', border: '1px solid rgba(0,188,212,0.3)' }}
      >
        Next stop
      </span>
    )
  }
  return (
    <span
      className="rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap"
      style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.1)' }}
    >
      Pending
    </span>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function DriverRoutePage() {
  const navigate                      = useNavigate()
  const { activeRoute, clearDriverRoute } = useDemoStore()

  if (!activeRoute) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center px-6"
        style={{ background: '#061426' }}
      >
        <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>
          No active route.
        </p>
        <button
          onClick={() => navigate('/dashboard/driver')}
          className="mt-4 rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
          style={{ background: 'linear-gradient(135deg,#0057e7,#00BCD4)' }}
        >
          ← Back to Dashboard
        </button>
      </div>
    )
  }

  const { stops, routeStatus } = activeRoute
  const doneCount   = stops.filter((s) => s.status === 'completed').length
  const allDone     = routeStatus === 'all_stops_done' || routeStatus === 'warehouse_checkin' || routeStatus === 'completed'
  const activeIdx   = stops.findIndex((s) => s.status === 'active')
  const nextIdx     = activeIdx >= 0 ? activeIdx : stops.findIndex((s) => s.status === 'pending')
  const pendingCount = stops.filter((s) => s.status === 'pending' || s.status === 'active').length
  const remainingMi = (pendingCount * 1.8).toFixed(0)

  return (
    <div className="relative flex flex-col min-h-screen" style={{ background: '#061426' }}>
      {/* Background orbs */}
      <div className="pointer-events-none absolute inset-0 grid-bg" style={{ zIndex: 0 }} />
      <div
        className="pointer-events-none absolute"
        style={{ top: -60, left: -40, width: 220, height: 220, background: 'rgba(0,100,255,0.35)', filter: 'blur(52px)', borderRadius: '50%', zIndex: 0 }}
      />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
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
      <main className="relative flex-1 overflow-y-auto pb-44" style={{ zIndex: 1 }}>
        <div className="px-5 pt-5 space-y-5" style={{ animation: 'fadeSlideUp 0.3s ease both' }}>

          {/* ── Page title + back ─────────────────────────────────────────── */}
          <div className="flex items-start justify-between">
            <div>
              <p style={{ fontSize: 26, color: '#ffffff', fontWeight: 700, lineHeight: 1.2 }}>
                My Route
              </p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 3 }}>
                {formatSubtitle()}
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

          {/* ── All-done banner ───────────────────────────────────────────── */}
          {allDone && (
            <div
              className="flex items-center gap-2.5 rounded-xl px-4 py-3"
              style={{ background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.3)' }}
            >
              <span style={{ fontSize: 16 }}>✅</span>
              <p style={{ fontSize: 12, color: '#00E676', fontWeight: 600 }}>
                All stops complete — ready for warehouse check-in!
              </p>
            </div>
          )}

          {/* ── Stat cards row ────────────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: String(stops.length),  label: 'STOPS TODAY'  },
              { value: String(doneCount),      label: 'COMPLETED'    },
              { value: `${remainingMi} mi`,    label: 'REMAINING'    },
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-2xl p-3 flex flex-col items-center gap-1"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  backdropFilter: 'blur(12px)',
                }}
              >
                <p style={{ fontSize: 22, color: '#ffffff', fontWeight: 700, lineHeight: 1.1 }}>
                  {card.value}
                </p>
                <p
                  style={{
                    fontSize: 9,
                    color: 'rgba(255,255,255,0.4)',
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    textAlign: 'center',
                  }}
                >
                  {card.label}
                </p>
              </div>
            ))}
          </div>

          {/* ── Route map ─────────────────────────────────────────────────── */}
          <div>
            <p
              style={{
                fontSize: 10,
                color: '#00BCD4',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                marginBottom: 10,
              }}
            >
              ROUTE MAP
            </p>
            <RouteMapPlaceholder
              totalStops={stops.length}
              doneCount={doneCount}
              activeIdx={activeIdx}
            />
          </div>

          {/* ── Stops list ────────────────────────────────────────────────── */}
          <div>
            <p
              style={{
                fontSize: 10,
                color: '#00BCD4',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                marginBottom: 10,
              }}
            >
              ROUTE STOPS
            </p>

            <div className="space-y-2.5">
              {stops.map((stop, i) => {
                const isDone   = stop.status === 'completed'
                const isActive = stop.status === 'active'
                const isNext   = i === nextIdx && !isDone

                return (
                  <div
                    key={stop.id}
                    className="rounded-2xl px-4 py-4 flex items-center gap-3"
                    style={{
                      background: isDone
                        ? 'rgba(0,230,118,0.04)'
                        : isActive || isNext
                        ? 'rgba(0,188,212,0.06)'
                        : 'rgba(255,255,255,0.04)',
                      border: isDone
                        ? '1px solid rgba(0,230,118,0.2)'
                        : isActive || isNext
                        ? '1px solid rgba(0,188,212,0.25)'
                        : '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    {/* Number circle */}
                    <div
                      className="shrink-0 flex items-center justify-center rounded-full"
                      style={{
                        width: 34,
                        height: 34,
                        background: isDone
                          ? 'rgba(0,230,118,0.14)'
                          : isActive || isNext
                          ? 'rgba(0,188,212,0.14)'
                          : 'rgba(255,255,255,0.06)',
                        border: isDone
                          ? '1.5px solid rgba(0,230,118,0.5)'
                          : isActive || isNext
                          ? '1.5px solid rgba(0,188,212,0.55)'
                          : '1.5px solid rgba(255,255,255,0.15)',
                      }}
                    >
                      {isDone ? (
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#00E676"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      ) : (
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: isActive || isNext
                              ? '#00BCD4'
                              : 'rgba(255,255,255,0.45)',
                          }}
                        >
                          {i + 1}
                        </span>
                      )}
                    </div>

                    {/* Address + details */}
                    <div className="flex-1 min-w-0">
                      <p
                        style={{
                          fontSize: 13,
                          color: isDone ? 'rgba(255,255,255,0.45)' : '#ffffff',
                          fontWeight: 600,
                          textDecoration: isDone ? 'line-through' : 'none',
                          lineHeight: 1.3,
                        }}
                      >
                        {stop.address}
                      </p>
                      <p
                        style={{
                          fontSize: 11,
                          color: 'rgba(255,255,255,0.38)',
                          marginTop: 2,
                        }}
                      >
                        {stop.bagCount} bag{stop.bagCount !== 1 ? 's' : ''}
                        {stop.units.length > 0 && ` · Units: ${stop.units.join(', ')}`}
                      </p>
                      {stop.scannedBags.length > 0 && (
                        <div className="flex gap-1 mt-1.5 flex-wrap">
                          {stop.scannedBags.map((b) => (
                            <span
                              key={b.code}
                              className="rounded-full px-1.5 py-0.5 text-[9px] font-bold"
                              style={{
                                background:
                                  b.result === 'green'
                                    ? 'rgba(0,230,118,0.14)'
                                    : b.result === 'yellow'
                                    ? 'rgba(255,214,0,0.14)'
                                    : 'rgba(255,23,68,0.14)',
                                color:
                                  b.result === 'green'
                                    ? '#00E676'
                                    : b.result === 'yellow'
                                    ? '#FFD600'
                                    : '#FF1744',
                              }}
                            >
                              {b.code}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Badge + action */}
                    <div className="shrink-0 flex flex-col items-end gap-2">
                      <StopBadge status={stop.status} isNext={isNext} />
                      {(isActive || isNext) && !isDone && (
                        <button
                          onClick={() => navigate(`/dashboard/driver/route/stop/${stop.id}`)}
                          className="rounded-xl px-3 py-1.5 text-xs font-bold"
                          style={{
                            background: 'rgba(0,188,212,0.18)',
                            border: '1px solid rgba(0,188,212,0.45)',
                            color: '#00BCD4',
                          }}
                        >
                          Open →
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}

              {/* Warehouse row */}
              <div
                className="rounded-2xl px-4 py-4 flex items-center gap-3"
                style={{
                  background: 'rgba(251,191,36,0.04)',
                  border: '1px solid rgba(251,191,36,0.18)',
                }}
              >
                <div
                  className="shrink-0 flex items-center justify-center rounded-full"
                  style={{
                    width: 34,
                    height: 34,
                    background: 'rgba(251,191,36,0.1)',
                    border: '1.5px solid rgba(251,191,36,0.3)',
                    fontSize: 16,
                  }}
                >
                  🏭
                </div>
                <div className="flex-1 min-w-0">
                  <p style={{ fontSize: 13, color: '#fbbf24', fontWeight: 600 }}>
                    Cyan's Brooklynn Warehouse
                  </p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', marginTop: 2 }}>
                    Final destination
                  </p>
                </div>
                <span
                  className="rounded-full px-2.5 py-0.5 text-xs font-bold"
                  style={{
                    background: allDone ? 'rgba(0,230,118,0.12)' : 'rgba(255,255,255,0.05)',
                    color: allDone ? '#00E676' : 'rgba(255,255,255,0.3)',
                    border: allDone ? '1px solid rgba(0,230,118,0.3)' : '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  {allDone ? 'Ready' : 'Locked'}
                </span>
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* ── Pinned warehouse button ──────────────────────────────────────────── */}
      <div
        className="fixed left-0 right-0 z-20 px-5 pb-2"
        style={{
          bottom: 68,
          background: 'linear-gradient(to top, rgba(6,20,38,0.98) 60%, transparent)',
          paddingTop: 16,
        }}
      >
        <button
          disabled={!allDone}
          onClick={() => allDone && navigate('/dashboard/driver/warehouse-checkin')}
          className="w-full rounded-2xl py-3.5 text-sm font-bold text-white transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed"
          style={
            allDone
              ? { background: 'linear-gradient(135deg,#0057e7,#00BCD4)', boxShadow: '0 4px 20px rgba(0,188,212,0.35)' }
              : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.3)' }
          }
        >
          {allDone
            ? '🏭 Proceed to Warehouse Check-in'
            : `Complete All Stops First (${doneCount}/${stops.length})`}
        </button>
        {allDone && (
          <button
            onClick={() => { clearDriverRoute(); navigate('/dashboard/driver') }}
            className="w-full mt-2 rounded-xl py-2 text-xs font-medium"
            style={{ background: 'none', color: 'rgba(255,80,80,0.55)', border: 'none' }}
          >
            Cancel Route
          </button>
        )}
      </div>

      {/* ── Bottom nav ──────────────────────────────────────────────────────── */}
      <DriverBottomNav
        tab="route"
        onTab={(t) => {
          if (t !== 'route') navigate('/dashboard/driver', { state: { tab: t } })
        }}
        pickupCount={0}
      />
    </div>
  )
}
