import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

// ── Mock data ──────────────────────────────────────────────────────────────────

type Priority = 'High' | 'Medium' | 'Low'

interface Stop {
  id:         string
  order:      number
  location:   string
  address:    string
  bags:       number
  priority:   Priority
  fundraiser: string
}

const STOPS: Stop[] = [
  {
    id:         'stop-001',
    order:      1,
    location:   'East Nashville High School',
    address:    '110 Gallatin Ave',
    bags:       12,
    priority:   'High',
    fundraiser: 'East Nashville High Basketball',
  },
  {
    id:         'stop-002',
    order:      2,
    location:   'Brooklynn Community Center',
    address:    '450 Community Way',
    bags:       8,
    priority:   'Medium',
    fundraiser: 'Brooklynn Community Outreach',
  },
  {
    id:         'stop-003',
    order:      3,
    location:   'Nashville Youth STEM Club',
    address:    '720 STEM Lane',
    bags:       6,
    priority:   'Medium',
    fundraiser: 'Nashville Youth STEM Club',
  },
]

const ROUTE_SUMMARY = [
  { label: 'Route ID',      value: 'NASH-ROUTE-07', mono: true  },
  { label: 'Stops',         value: '3'                           },
  { label: 'Bags Expected', value: '26'                          },
  { label: 'Est. Miles',    value: '18.6 mi'                     },
  { label: 'Est. Time',     value: '1 hr 35 min'                 },
  { label: 'CO₂ Reduced',   value: '21.4 lbs', green: true       },
]

// ── Helpers ────────────────────────────────────────────────────────────────────

function priorityBadge(p: Priority): React.CSSProperties {
  if (p === 'High')   return { background: 'rgba(239,68,68,0.15)',  border: '1px solid rgba(239,68,68,0.4)',  color: '#f87171' }
  if (p === 'Medium') return { background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)', color: '#fbbf24' }
  return                     { background: 'rgba(0,190,255,0.10)',  border: '1px solid rgba(0,190,255,0.3)',  color: '#67e8f9' }
}

function priorityDot(p: Priority): string {
  if (p === 'High')   return '#f87171'
  if (p === 'Medium') return '#fbbf24'
  return '#67e8f9'
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function DriverRoutesPage() {
  const navigate = useNavigate()

  const [animate,   setAnimate]   = useState(false)
  const [pickedUp,  setPickedUp]  = useState<string[]>([])
  const [toast,     setToast]     = useState(false)
  const [toastMsg,  setToastMsg]  = useState('')
  const [nextAnim,  setNextAnim]  = useState(true)   // triggers Next Pickup card re-entrance

  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimate(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const fade = (delay = 0): React.CSSProperties => ({
    opacity:    animate ? 1 : 0,
    transform:  animate ? 'translateY(0)' : 'translateY(18px)',
    transition: `opacity 0.45s ease ${delay}ms, transform 0.45s ease ${delay}ms`,
  })

  // Derived
  const doneCount  = pickedUp.length
  const totalStops = STOPS.length
  const pct        = Math.round((doneCount / totalStops) * 100)
  const nextStop   = STOPS.find((s) => !pickedUp.includes(s.id)) ?? null
  const allDone    = doneCount === totalStops

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setToast(true)
    setTimeout(() => setToast(false), 2800)
  }

  const markPickedUp = (id: string) => {
    setNextAnim(false)
    setTimeout(() => {
      setPickedUp((prev) => [...prev, id])
      setNextAnim(true)
      showToast(
        STOPS.find((s) => !pickedUp.includes(s.id) && s.id !== id)
          ? 'Pickup completed. Next stop loaded.'
          : 'Final pickup completed. Route done!'
      )
    }, 220)
  }

  return (
    <div
      className="relative min-h-screen flex flex-col overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}
    >
      {/* Background decoration */}
      <div className="pointer-events-none absolute inset-0 grid-bg" />
      <div className="pointer-events-none absolute" style={{ top: -80, left: -60, width: 300, height: 300, background: 'rgba(0,87,231,0.28)', filter: 'blur(72px)', borderRadius: '50%' }} />
      <div className="pointer-events-none absolute" style={{ bottom: -60, right: -40, width: 240, height: 240, background: 'rgba(0,200,255,0.12)', filter: 'blur(64px)', borderRadius: '50%' }} />

      {/* ── Toast ──────────────────────────────────────────────────────────────── */}
      {toast && (
        <div
          className="fixed top-4 left-1/2 z-50 flex items-center gap-2.5 px-5 py-3 rounded-2xl"
          style={{
            transform:      'translateX(-50%)',
            background:     'rgba(34,197,94,0.15)',
            border:         '1px solid rgba(34,197,94,0.45)',
            boxShadow:      '0 0 28px rgba(34,197,94,0.2)',
            backdropFilter: 'blur(12px)',
            animation:      'toastIn 0.3s ease both',
            whiteSpace:     'nowrap',
          }}
        >
          <span style={{ fontSize: 16 }}>✅</span>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#4ade80' }}>{toastMsg}</p>
        </div>
      )}

      {/* Scrollable content */}
      <div className="relative flex-1 overflow-y-auto pb-12" style={{ zIndex: 1 }}>
        <div className="max-w-[480px] mx-auto px-4 pt-10 pb-8">

          {/* Back */}
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm mb-6 hover:opacity-70 transition-opacity"
            style={{ ...fade(0), color: 'rgba(255,255,255,0.45)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            Driver Dashboard
          </button>

          {/* ── Header ───────────────────────────────────────────────────────── */}
          <div className="mb-6" style={fade(40)}>
            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(0,190,255,0.12)', border: '1px solid rgba(0,190,255,0.3)', boxShadow: '0 0 20px rgba(0,190,255,0.18)' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00c8ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold" style={{ color: '#ffffff' }}>Smart Driver Routing</h1>
              </div>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.42)' }}>
              View optimized pickup stops and your next recycling pickup.
            </p>
          </div>

          {/* ── Progress bar ─────────────────────────────────────────────────── */}
          <div
            className="rounded-2xl px-5 py-4 mb-6"
            style={{ ...fade(80), background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(0,190,255,0.13)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.38)' }}>
                Route Progress
              </p>
              <p style={{ fontSize: 12, fontWeight: 700, color: allDone ? '#4ade80' : '#00c8ff' }}>
                {doneCount} of {totalStops} stops completed
              </p>
            </div>
            <div className="rounded-full overflow-hidden" style={{ height: 8, background: 'rgba(255,255,255,0.08)' }}>
              <div
                className="h-full rounded-full"
                style={{
                  width:      `${pct}%`,
                  background: allDone ? 'linear-gradient(90deg,#22c55e,#4ade80)' : 'linear-gradient(90deg,#0057e7,#00c8ff)',
                  transition: 'width 0.55s ease',
                  boxShadow:  '0 0 10px rgba(0,200,255,0.4)',
                  minWidth:   pct > 0 ? 8 : 0,
                }}
              />
            </div>
          </div>

          {/* ── Next Pickup Card ─────────────────────────────────────────────── */}
          <div className="mb-6" style={fade(120)}>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.38)', marginBottom: 12 }}>
              Next Pickup
            </p>

            <div
              style={{
                opacity:    nextAnim ? 1 : 0,
                transform:  nextAnim ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.98)',
                transition: 'opacity 0.25s ease, transform 0.25s ease',
              }}
            >
              {allDone ? (
                /* ── All done state ── */
                <div
                  className="rounded-2xl p-6 text-center"
                  style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.35)', boxShadow: '0 0 32px rgba(34,197,94,0.12)' }}
                >
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                    style={{ background: 'rgba(34,197,94,0.15)', border: '2px solid rgba(34,197,94,0.5)', fontSize: 28 }}
                  >
                    🎉
                  </div>
                  <p className="text-xl font-bold mb-1" style={{ color: '#4ade80' }}>Route Complete!</p>
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
                    All {totalStops} stops picked up. Head back to NASH-01 Warehouse.
                  </p>
                </div>
              ) : nextStop ? (
                /* ── Active next pickup ── */
                <div
                  className="rounded-2xl overflow-hidden"
                  style={{ background: 'rgba(0,87,231,0.10)', border: '1.5px solid rgba(0,190,255,0.45)', boxShadow: '0 0 32px rgba(0,190,255,0.12)' }}
                >
                  {/* Card top band */}
                  <div
                    className="flex items-center justify-between px-5 py-3"
                    style={{ background: 'rgba(0,87,231,0.18)', borderBottom: '1px solid rgba(0,190,255,0.15)' }}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        style={{
                          width: 7, height: 7, borderRadius: '50%',
                          background: '#00c8ff',
                          animation: 'liveDot 1.4s ease-in-out infinite',
                        }}
                      />
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#00c8ff', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                        Next Pickup Location
                      </p>
                    </div>
                    <span
                      className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
                      style={priorityBadge(nextStop.priority)}
                    >
                      {nextStop.priority} Priority
                    </span>
                  </div>

                  {/* Main content */}
                  <div className="px-5 py-5">
                    <p className="text-2xl font-bold mb-1" style={{ color: '#ffffff' }}>{nextStop.location}</p>
                    <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.5)' }}>{nextStop.address}</p>

                    <div className="grid grid-cols-2 gap-3 mb-5">
                      <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(0,190,255,0.15)' }}>
                        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Bags Expected</p>
                        <p style={{ fontSize: 22, fontWeight: 700, color: '#ffffff' }}>{nextStop.bags}</p>
                        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)' }}>QR bags</p>
                      </div>
                      <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(0,200,128,0.07)', border: '1px solid rgba(0,200,128,0.2)' }}>
                        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Fundraiser</p>
                        <p style={{ fontSize: 12, fontWeight: 700, color: '#5eead4', lineHeight: 1.3 }}>{nextStop.fundraiser}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => markPickedUp(nextStop.id)}
                      className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-sm transition-all hover:brightness-110 active:scale-[0.98]"
                      style={{ background: 'linear-gradient(135deg,#0057e7,#00c8ff)', color: '#ffffff', boxShadow: '0 4px 24px rgba(0,190,255,0.3)' }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      Mark Picked Up
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* ── Optimized Route Visual ───────────────────────────────────────── */}
          <div className="mb-6" style={fade(200)}>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.38)', marginBottom: 12 }}>
              Optimized Route
            </p>
            <div
              className="rounded-2xl px-5 py-5"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(0,190,255,0.15)' }}
            >
              {/* Start warehouse */}
              <div className="flex items-center gap-3 mb-1">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(0,87,231,0.2)', border: '2px solid rgba(0,190,255,0.55)', fontSize: 16 }}
                >
                  🏭
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#00c8ff' }}>Start: NASH-01 Warehouse</p>
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>Departure point</p>
                </div>
              </div>

              {/* Stops */}
              {STOPS.map((stop, i) => {
                const done = pickedUp.includes(stop.id)
                const isNext = !done && STOPS.find(s => !pickedUp.includes(s.id))?.id === stop.id
                return (
                  <div key={stop.id} className="flex gap-3">
                    {/* Spine column */}
                    <div className="flex flex-col items-center" style={{ width: 36, flexShrink: 0 }}>
                      <div style={{ width: 2, height: 14, background: done ? 'rgba(34,197,94,0.45)' : 'rgba(0,190,255,0.2)', flexShrink: 0 }} />
                      <div
                        className="flex items-center justify-center rounded-full"
                        style={{
                          width:      32,
                          height:     32,
                          background: done ? 'rgba(34,197,94,0.18)' : isNext ? 'rgba(0,87,231,0.25)' : 'rgba(255,255,255,0.06)',
                          border:     `2px solid ${done ? 'rgba(34,197,94,0.6)' : isNext ? 'rgba(0,190,255,0.7)' : 'rgba(255,255,255,0.15)'}`,
                          fontSize:   12,
                          fontWeight: 700,
                          color:      done ? '#4ade80' : isNext ? '#00c8ff' : 'rgba(255,255,255,0.4)',
                          flexShrink: 0,
                          boxShadow:  isNext ? '0 0 12px rgba(0,200,255,0.3)' : 'none',
                          transition: 'all 0.4s ease',
                        }}
                      >
                        {done ? '✓' : stop.order}
                      </div>
                      {i < STOPS.length - 1 && (
                        <div style={{ width: 2, flex: 1, minHeight: 14, background: done ? 'rgba(34,197,94,0.35)' : 'rgba(0,190,255,0.15)' }} />
                      )}
                    </div>

                    {/* Stop info */}
                    <div className="flex-1 min-w-0 pt-4 pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p style={{ fontSize: 13, fontWeight: 600, color: done ? 'rgba(255,255,255,0.45)' : '#ffffff', textDecoration: done ? 'line-through' : 'none' }}>
                            {stop.location}
                          </p>
                          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>
                            {stop.address} · {stop.bags} bags
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                          <div className="rounded-full" style={{ width: 8, height: 8, background: priorityDot(stop.priority), flexShrink: 0 }} />
                          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{stop.priority}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* End connector + warehouse */}
              <div className="flex gap-3">
                <div className="flex flex-col items-center" style={{ width: 36, flexShrink: 0 }}>
                  <div style={{ width: 2, height: 14, background: allDone ? 'rgba(34,197,94,0.45)' : 'rgba(0,190,255,0.15)', flexShrink: 0 }} />
                  <div
                    className="w-9 h-9 flex items-center justify-center rounded-full"
                    style={{ background: 'rgba(0,87,231,0.12)', border: '2px solid rgba(0,190,255,0.3)', fontSize: 15, flexShrink: 0 }}
                  >
                    🏁
                  </div>
                </div>
                <div className="flex-1 pt-4">
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}>End: NASH-01 Warehouse</p>
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>Return & unload</p>
                </div>
              </div>

              {/* Priority legend */}
              <div className="flex gap-4 mt-5 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                {(['High', 'Medium', 'Low'] as Priority[]).map((p) => (
                  <div key={p} className="flex items-center gap-1.5">
                    <div className="rounded-full" style={{ width: 8, height: 8, background: priorityDot(p) }} />
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{p}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Route Summary ─────────────────────────────────────────────────── */}
          <div style={fade(280)}>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.38)', marginBottom: 12 }}>
              Route Summary
            </p>
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(0,190,255,0.13)' }}
            >
              {ROUTE_SUMMARY.map((row, i) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between px-5 py-3.5"
                  style={{ borderBottom: i < ROUTE_SUMMARY.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}
                >
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.42)' }}>{row.label}</span>
                  <span
                    className={row.mono ? 'font-mono' : ''}
                    style={{ fontSize: 12, fontWeight: 700, color: row.green ? '#5eead4' : '#ffffff' }}
                  >
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translate(-50%, -10px); }
          to   { opacity: 1; transform: translate(-50%, 0); }
        }
        @keyframes liveDot {
          0%,100% { opacity: 1; transform: scale(1); }
          50%     { opacity: 0.4; transform: scale(0.7); }
        }
      `}</style>
    </div>
  )
}
