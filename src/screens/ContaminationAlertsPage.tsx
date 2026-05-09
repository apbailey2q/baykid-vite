import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const BAG_ID = 'CB-NASH-000421'

const TIPS = [
  { icon: '💧', text: 'Rinse bottles and containers before bagging.' },
  { icon: '🍔', text: 'Keep food waste out of QR recycling bags.' },
  { icon: '📦', text: 'Separate paper, plastic, and mixed waste when required.' },
  { icon: '🚫', text: 'Do not place liquids, diapers, or hazardous items in recycling bags.' },
  { icon: '📋', text: 'Flatten cardboard before placing it in the bag.' },
]

type ActionState = 'idle' | 'sending' | 'sent' | 'closing' | 'closed'

export default function ContaminationAlertsPage() {
  const navigate = useNavigate()
  const [animate,       setAnimate]       = useState(false)
  const [alertState,    setAlertState]    = useState<ActionState>('idle')
  const [closeState,    setCloseState]    = useState<ActionState>('idle')
  const [toast,         setToast]         = useState<string | null>(null)

  useEffect(() => {
    const t = requestAnimationFrame(() => setAnimate(true))
    return () => cancelAnimationFrame(t)
  }, [])

  const fade = (delay = 0): React.CSSProperties => ({
    opacity:    animate ? 1 : 0,
    transform:  animate ? 'translateY(0)' : 'translateY(16px)',
    transition: `opacity 0.4s ease ${delay}ms, transform 0.4s ease ${delay}ms`,
  })

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  const handleSendAlert = () => {
    if (alertState !== 'idle') return
    setAlertState('sending')
    setTimeout(() => {
      setAlertState('sent')
      showToast('Education alert sent to consumer.')
    }, 1200)
  }

  const handleClose = () => {
    if (closeState !== 'idle') return
    setCloseState('closing')
    setTimeout(() => {
      setCloseState('closed')
      showToast('Issue closed. Bag removed from processing flow.')
    }, 900)
  }

  const isClosed = closeState === 'closed'

  return (
    <div
      className="relative min-h-screen flex flex-col overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #0d0606 0%, #0a0404 100%)' }}
    >
      {/* Background glows */}
      <div className="pointer-events-none absolute inset-0 grid-bg" />
      <div className="pointer-events-none absolute" style={{ top: -80, left: -60, width: 300, height: 300, background: 'rgba(220,38,38,0.18)', filter: 'blur(80px)', borderRadius: '50%' }} />
      <div className="pointer-events-none absolute" style={{ bottom: -60, right: -40, width: 240, height: 240, background: 'rgba(239,68,68,0.1)', filter: 'blur(64px)', borderRadius: '50%' }} />
      <div className="pointer-events-none absolute" style={{ top: '50%', right: -40, width: 200, height: 200, background: 'rgba(0,200,255,0.06)', filter: 'blur(60px)', borderRadius: '50%' }} />

      {/* Toast */}
      {toast && (
        <div
          className="fixed top-5 left-1/2 z-50 px-4 py-2.5 rounded-2xl text-sm font-semibold"
          style={{
            transform:  'translateX(-50%)',
            background: 'rgba(34,197,94,0.15)',
            border:     '1px solid rgba(34,197,94,0.4)',
            color:      '#22c55e',
            animation:  'toastIn 0.3s ease',
            whiteSpace: 'nowrap',
          }}
        >
          ✓ {toast}
        </div>
      )}

      <div className="relative flex-1 overflow-y-auto pb-28" style={{ zIndex: 1 }}>
        <div className="max-w-[480px] mx-auto px-4 pt-10 pb-6">

          {/* ── Back + Header ─────────────────────────────────────────────────── */}
          <div className="mb-6" style={fade(0)}>
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 mb-5 text-sm hover:opacity-70 transition-opacity"
              style={{ color: 'rgba(255,255,255,0.35)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 5l-7 7 7 7" />
              </svg>
              Back
            </button>

            <div className="flex items-center gap-3 mb-1">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.35)' }}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold" style={{ color: '#ffffff' }}>Contamination Alerts</h1>
            </div>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)', paddingLeft: 48 }}>
              Reduce contamination, educate users, and protect the recycling stream.
            </p>
          </div>

          {/* ── Status pill ───────────────────────────────────────────────────── */}
          <div className="flex items-center gap-2 mb-5" style={fade(50)}>
            <span
              className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full"
              style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444' }}
            >
              1 Active Alert
            </span>
            {isClosed && (
              <span
                className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full"
                style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e', animation: 'fadeIn 0.3s ease' }}
              >
                Issue Closed
              </span>
            )}
          </div>

          {/* ── Alert Status Card ─────────────────────────────────────────────── */}
          <div
            className="rounded-2xl overflow-hidden mb-5"
            style={{
              background:  isClosed ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.07)',
              border:      `1px solid ${isClosed ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.35)'}`,
              transition:  'background 0.5s ease, border-color 0.5s ease',
              ...fade(80),
            }}
          >
            {/* Card header with pulsing dot */}
            <div
              className="flex items-center justify-between px-5 py-3"
              style={{ borderBottom: `1px solid ${isClosed ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.15)'}`, transition: 'border-color 0.5s ease' }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{
                    background: isClosed ? '#22c55e' : '#ef4444',
                    boxShadow:  isClosed ? '0 0 6px rgba(34,197,94,0.6)' : '0 0 6px rgba(239,68,68,0.7)',
                    animation:  isClosed ? 'none' : 'alertPulse 1.8s ease-in-out infinite',
                    transition: 'background 0.5s ease, box-shadow 0.5s ease',
                  }}
                />
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: isClosed ? '#22c55e' : '#ef4444', transition: 'color 0.5s ease' }}>
                  {isClosed ? 'Issue Closed' : 'Red — Contaminated'}
                </span>
              </div>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>Today 12:38 PM</span>
            </div>

            {/* Bag info rows */}
            <div className="px-5 pt-4 pb-2">
              <div className="flex items-start gap-3 mb-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="5" height="5" x="3" y="3" rx="1" /><rect width="5" height="5" x="16" y="3" rx="1" />
                    <rect width="5" height="5" x="3" y="16" rx="1" /><path d="M21 16h-3a2 2 0 0 0-2 2v3" />
                    <path d="M21 21v.01" /><path d="M12 7v3a2 2 0 0 1-2 2H7" /><path d="M3 12h.01" />
                    <path d="M12 3h.01" /><path d="M12 16v.01" /><path d="M16 12h1" /><path d="M21 12v.01" /><path d="M12 21v-1" />
                  </svg>
                </div>
                <div>
                  <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(255,255,255,0.3)', marginBottom: 2 }}>Bag ID</p>
                  <p className="font-mono font-semibold" style={{ fontSize: 15, color: '#ffffff' }}>{BAG_ID}</p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>Warehouse NASH-01 · Consumer Scan</p>
                </div>
              </div>
            </div>

            {/* Detail rows */}
            {[
              { label: 'AI Confidence',        value: '88%',                            warn: true  },
              { label: 'Processing Status',    value: 'Removed from processing flow',   red: true   },
              { label: 'Recommended Action',   value: 'Send education alert'                        },
            ].map((row, i, arr) => (
              <div
                key={row.label}
                className="flex items-center justify-between px-5 py-3"
                style={{ borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: i === arr.length - 1 ? 'none' : undefined }}
              >
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)' }}>{row.label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: row.red ? '#f87171' : row.warn ? '#fbbf24' : '#ffffff', maxWidth: '60%', textAlign: 'right' }}>
                  {row.value}
                </span>
              </div>
            ))}

            {/* Status message */}
            <div className="px-5 py-3">
              <div
                className="flex items-center gap-2.5 rounded-xl px-4 py-3"
                style={{ background: isClosed ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.1)', border: `1px solid ${isClosed ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.22)'}`, transition: 'all 0.5s ease' }}
              >
                <span style={{ fontSize: 15 }}>{isClosed ? '✅' : '⚠️'}</span>
                <p style={{ fontSize: 13, fontWeight: 600, color: isClosed ? '#22c55e' : '#fca5a5' }}>
                  {isClosed ? 'Issue closed. Bag will not proceed to processing.' : 'High contamination risk detected.'}
                </p>
              </div>
            </div>
          </div>

          {/* ── Consumer Message Preview ──────────────────────────────────────── */}
          <div
            className="rounded-2xl p-4 mb-5"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', ...fade(160) }}
          >
            <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)', marginBottom: 10 }}>
              Consumer Message Preview
            </p>
            <div
              className="rounded-xl px-4 py-3.5"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontStyle: 'italic', lineHeight: 1.65 }}>
                "Your QR recycling bag could not be processed because contamination was detected. Please review the tips below so your next bag can be accepted."
              </p>
            </div>
          </div>

          {/* ── Education Tips ────────────────────────────────────────────────── */}
          <div style={fade(200)}>
            <div className="flex items-center gap-2 mb-4">
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
              <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.25)' }}>
                How to Fix This Next Time
              </span>
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
            </div>

            <div className="flex flex-col gap-2.5 mb-6">
              {TIPS.map((tip, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-2xl px-4 py-3.5"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border:     '1px solid rgba(255,255,255,0.08)',
                    opacity:    animate ? 1 : 0,
                    transform:  animate ? 'translateY(0)' : 'translateY(10px)',
                    transition: `opacity 0.4s ease ${220 + i * 55}ms, transform 0.4s ease ${220 + i * 55}ms`,
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', fontSize: 15 }}
                  >
                    {tip.icon}
                  </div>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.62)', lineHeight: 1.55, paddingTop: 2 }}>{tip.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Education Score Card ──────────────────────────────────────────── */}
          <div
            className="rounded-2xl overflow-hidden mb-5"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(0,200,255,0.18)', ...fade(480) }}
          >
            <div
              className="flex items-center gap-2.5 px-5 py-3.5"
              style={{ background: 'rgba(0,200,255,0.07)', borderBottom: '1px solid rgba(0,200,255,0.1)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00c8ff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>
              </svg>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#00c8ff' }}>User Education Score</p>
            </div>
            <div className="px-5 py-4">
              {/* Score bar */}
              <div className="flex items-center justify-between mb-2">
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Recycling knowledge score</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#fbbf24' }}>82%</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden mb-4" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width:      animate ? '82%' : '0%',
                    background: 'linear-gradient(90deg, #fbbf24, #f59e0b)',
                    transition: 'width 1s ease 0.5s',
                    boxShadow:  '0 0 8px rgba(251,191,36,0.4)',
                  }}
                />
              </div>
              {/* Detail rows */}
              {[
                { label: 'Contamination History',  value: '1 red bag, 2 yellow bags', warn: true  },
                { label: 'Recommended Follow-Up',  value: 'Send recycling guide',     cyan: true  },
              ].map((row, i, arr) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between py-2.5"
                  style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}
                >
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)' }}>{row.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: row.warn ? '#f87171' : row.cyan ? '#00c8ff' : '#ffffff', textAlign: 'right', maxWidth: '55%' }}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Admin Insight ─────────────────────────────────────────────────── */}
          <div
            className="rounded-2xl px-5 py-4 mb-6 flex items-start gap-3"
            style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', ...fade(560) }}
          >
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
              style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)', fontSize: 16 }}
            >
              💡
            </div>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#4ade80', marginBottom: 4 }}>Why This Matters</p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.65 }}>
                Tracking contamination helps improve recycling quality, reduce rejected materials, and educate users before the next pickup.
              </p>
            </div>
          </div>

          {/* ── Action Buttons ────────────────────────────────────────────────── */}
          <div className="flex flex-col gap-3" style={fade(620)}>
            {/* Send Alert */}
            <button
              onClick={handleSendAlert}
              disabled={alertState !== 'idle'}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-sm transition-all active:scale-[0.98]"
              style={{
                background: alertState === 'sent'
                  ? 'rgba(34,197,94,0.15)'
                  : alertState === 'sending'
                  ? 'rgba(239,68,68,0.5)'
                  : 'linear-gradient(135deg, #b91c1c, #ef4444)',
                border:  alertState === 'sent' ? '1px solid rgba(34,197,94,0.4)' : 'none',
                color:   alertState === 'sent' ? '#22c55e' : '#ffffff',
                cursor:  alertState !== 'idle' ? 'default' : 'pointer',
                opacity: alertState === 'sending' ? 0.7 : 1,
                boxShadow: alertState === 'idle' ? '0 4px 20px rgba(239,68,68,0.25)' : 'none',
                transition: 'all 0.3s ease',
              }}
            >
              {alertState === 'sending' && (
                <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              )}
              {alertState === 'sent' ? '✓ Education alert sent to consumer.' : alertState === 'sending' ? 'Sending…' : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.73a16 16 0 0 0 6 6l.92-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 16h.19z" />
                  </svg>
                  Send Alert to Consumer
                </>
              )}
            </button>

            {/* Close Issue */}
            <button
              onClick={handleClose}
              disabled={closeState !== 'idle'}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-sm hover:brightness-110 active:scale-[0.98]"
              style={{
                background: closeState === 'closed'
                  ? 'rgba(34,197,94,0.15)'
                  : closeState === 'closing'
                  ? 'linear-gradient(135deg, #065f46, #0891b2)'
                  : 'linear-gradient(135deg, #059669, #06b6d4)',
                border:    closeState === 'closed' ? '1px solid rgba(34,197,94,0.5)' : '1px solid rgba(6,182,212,0.3)',
                color:     closeState === 'closed' ? '#4ade80' : '#ffffff',
                cursor:    closeState !== 'idle' ? 'default' : 'pointer',
                opacity:   closeState === 'closing' ? 0.75 : 1,
                boxShadow: closeState === 'idle' ? '0 4px 20px rgba(6,182,212,0.25)' : 'none',
                transition: 'all 0.3s ease',
              }}
            >
              {closeState === 'closing' && (
                <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              )}
              {closeState === 'closing' ? 'Closing…' : closeState === 'closed' ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Issue Closed
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Close Issue
                </>
              )}
            </button>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', textAlign: 'center', marginTop: 2 }}>
              Closes this contamination case and prevents the bag from moving forward.
            </p>
          </div>

        </div>
      </div>

      <style>{`
        @keyframes alertPulse {
          0%, 100% { box-shadow: 0 0 6px rgba(239,68,68,0.7); }
          50%       { box-shadow: 0 0 14px rgba(239,68,68,0.9); }
        }
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(-50%) translateY(-8px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
