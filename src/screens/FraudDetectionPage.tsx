import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

// ── Types ──────────────────────────────────────────────────────────────────────

type CheckStatus = 'Passed' | 'Review' | 'Clear' | 'Verified' | 'Protected'
type RiskLevel   = 'Low' | 'Medium' | 'High'
type ActionState = 'idle' | 'running' | 'done'

interface DetectionCard {
  id:      string
  icon:    string
  title:   string
  status:  CheckStatus
  message: string
}

interface ActivityRow {
  id:     string
  type:   string
  bagId:  string
  user:   string
  action: string
  risk:   RiskLevel
}

// ── Style helpers ──────────────────────────────────────────────────────────────

function statusMeta(s: CheckStatus) {
  if (s === 'Passed')    return { color: '#4ade80', bg: 'rgba(34,197,94,0.1)',    border: 'rgba(34,197,94,0.3)',    label: 'Passed'    }
  if (s === 'Review')    return { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',   border: 'rgba(251,191,36,0.3)',   label: 'Review'    }
  if (s === 'Clear')     return { color: '#5eead4', bg: 'rgba(94,234,212,0.1)',   border: 'rgba(94,234,212,0.3)',   label: 'Clear'     }
  if (s === 'Verified')  return { color: '#00c8ff', bg: 'rgba(0,200,255,0.1)',    border: 'rgba(0,200,255,0.3)',    label: 'Verified'  }
  return                        { color: '#a78bfa', bg: 'rgba(167,139,250,0.1)',  border: 'rgba(167,139,250,0.3)',  label: 'Protected' }
}

function riskMeta(r: RiskLevel) {
  if (r === 'Low')    return { color: '#4ade80', bg: 'rgba(34,197,94,0.1)',    border: 'rgba(34,197,94,0.3)'    }
  if (r === 'Medium') return { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.3)'   }
  return                     { color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.3)'  }
}

// ── Mock data ──────────────────────────────────────────────────────────────────

const CHECKS: DetectionCard[] = [
  { id: 'c1', icon: '🔒', title: 'Duplicate QR Scan Prevention',  status: 'Passed',    message: 'QR bag CB-NASH-000421 already verified. Duplicate payout blocked.' },
  { id: 'c2', icon: '⚠️', title: 'Suspicious Scan Pattern',       status: 'Review',    message: 'Multiple scans from the same device in a short time window.' },
  { id: 'c3', icon: '🏀', title: 'Fundraiser Abuse Check',        status: 'Clear',     message: 'Donation activity matches active fundraiser rules and expiration dates.' },
  { id: 'c4', icon: '✅', title: 'Bag ID Validation',             status: 'Verified',  message: 'QR bag ID matches warehouse-issued inventory.' },
  { id: 'c5', icon: '💰', title: 'Payout Protection',             status: 'Protected', message: 'Reward payout requires verified scan, inspection approval, and lifecycle completion.' },
]

const ACTIVITY: ActivityRow[] = [
  { id: 'risk-001', type: 'Duplicate Scan',             bagId: 'CB-NASH-000421', user: 'Alex',      action: 'Blocked',                      risk: 'Low'    },
  { id: 'risk-002', type: 'Fast Repeat Scans',          bagId: 'Multiple',       user: 'Demo User', action: 'Needs Review',                  risk: 'Medium' },
  { id: 'risk-003', type: 'Expired Fundraiser Attempt', bagId: 'CB-NASH-000399', user: 'Maya',      action: 'Redirected to Personal Account', risk: 'Low'    },
]

const EDUCATION_CHIPS = [
  'Duplicate scan prevention',
  'Verified QR bag inventory',
  'Fundraiser expiration checks',
  'Payout protection',
  'Admin review',
]

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FraudDetectionPage() {
  const [animate, setAnimate]       = useState(false)
  const [scanState, setScanState]   = useState<ActionState>('idle')
  const [blockState, setBlockState] = useState<ActionState>('idle')
  const [clearState, setClearState] = useState<ActionState>('idle')
  const [toast, setToast]           = useState<string | null>(null)

  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimate(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const fade = (delay = 0): React.CSSProperties => ({
    opacity:    animate ? 1 : 0,
    transform:  animate ? 'translateY(0)' : 'translateY(16px)',
    transition: `opacity 0.4s ease ${delay}ms, transform 0.4s ease ${delay}ms`,
  })

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  function runAction(
    setState: (s: ActionState) => void,
    msg: string,
  ) {
    setState('running')
    setTimeout(() => {
      setState('done')
      showToast(msg)
      setTimeout(() => setState('idle'), 2200)
    }, 1100)
  }

  return (
    <div
      className="relative min-h-screen flex flex-col overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}
    >
      <style>{`
        @keyframes fraudDot {
          0%,100% { opacity:1; transform:scale(1);    }
          50%      { opacity:.4; transform:scale(.7); }
        }
        @keyframes toastIn {
          from { opacity:0; transform:translate(-50%,-10px); }
          to   { opacity:1; transform:translate(-50%,0);     }
        }
        @keyframes spin { to { transform:rotate(360deg); } }
      `}</style>

      {/* Toast */}
      {toast && (
        <div
          className="fixed top-5 left-1/2 z-50 px-5 py-3 rounded-2xl text-sm font-semibold"
          style={{
            transform:  'translateX(-50%)',
            background: 'rgba(7,14,38,0.97)',
            border:     '1px solid rgba(0,200,255,0.35)',
            color:      '#00c8ff',
            animation:  'toastIn 0.22s ease',
            whiteSpace: 'nowrap',
            boxShadow:  '0 4px 32px rgba(0,200,255,0.18)',
          }}
        >
          {toast}
        </div>
      )}

      {/* Background glows */}
      <div className="pointer-events-none absolute inset-0 grid-bg" />
      <div className="pointer-events-none absolute" style={{ top: -80,   left: -60,  width: 300, height: 300, background: 'rgba(0,87,231,0.28)',   filter: 'blur(72px)', borderRadius: '50%' }} />
      <div className="pointer-events-none absolute" style={{ bottom: -60, right: -40, width: 240, height: 240, background: 'rgba(248,113,113,0.1)', filter: 'blur(64px)', borderRadius: '50%' }} />

      {/* Header */}
      <header
        className="relative flex items-center justify-between px-4 py-3"
        style={{
          background:    'rgba(4,10,24,0.92)',
          borderBottom:  '1px solid rgba(0,200,255,0.12)',
          backdropFilter:'blur(12px)',
          zIndex:        2,
        }}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl font-extrabold" style={{ color: '#00c8ff' }}>Cyan's Brooklynn</span>
          <span style={{ color: 'rgba(0,200,255,0.3)' }}>|</span>
          <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>Security</span>
        </div>
        <Link
          to="/"
          className="text-sm transition-opacity hover:opacity-70"
          style={{ color: 'rgba(255,255,255,0.4)' }}
        >
          ← Back
        </Link>
      </header>

      <div className="relative flex-1 overflow-y-auto pb-24" style={{ zIndex: 1 }}>
        <div className="max-w-[520px] mx-auto px-4 pt-8 pb-8">

          {/* ── Page heading ───────────────────────────────────────────────────── */}
          <div className="mb-6" style={fade(0)}>
            <div className="flex items-center gap-2.5 mb-2">
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{
                  background: '#f87171',
                  boxShadow:  '0 0 8px rgba(248,113,113,0.8)',
                  animation:  'fraudDot 1.6s ease-in-out infinite',
                }}
              />
              <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#f87171' }}>
                Live Protection
              </span>
            </div>
            <h1 className="text-2xl font-extrabold leading-tight mb-2" style={{ color: '#ffffff' }}>
              Fraud &amp; Abuse Detection
            </h1>
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Protect rewards, fundraisers, and QR bag tracking from suspicious activity.
            </p>
          </div>

          {/* ── System Risk Score ──────────────────────────────────────────────── */}
          <div
            className="rounded-2xl p-5 mb-6"
            style={{
              background: 'rgba(34,197,94,0.06)',
              border:     '1px solid rgba(34,197,94,0.28)',
              boxShadow:  '0 0 32px rgba(34,197,94,0.08)',
              ...fade(60),
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  System Risk Score
                </p>
                <p className="text-lg font-bold" style={{ color: '#4ade80' }}>Low</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span style={{ fontSize: 36, fontWeight: 900, color: '#4ade80', lineHeight: 1 }}>18</span>
                <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>out of 100</span>
              </div>
            </div>
            {/* Risk meter */}
            <div className="h-2.5 rounded-full mb-3" style={{ background: 'rgba(255,255,255,0.07)' }}>
              <div
                className="h-full rounded-full"
                style={{
                  width:      animate ? '18%' : '0%',
                  background: 'linear-gradient(90deg, #16a34a, #4ade80)',
                  transition: 'width 1.2s ease 200ms',
                  boxShadow:  '0 0 8px rgba(74,222,128,0.5)',
                }}
              />
            </div>
            <div className="flex justify-between mb-4">
              <span className="text-[9px] font-semibold" style={{ color: '#4ade80' }}>Low Risk (0–33)</span>
              <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.25)' }}>Medium (34–66)</span>
              <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.25)' }}>High (67–100)</span>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Most QR bag scans are verified and matched to valid bag IDs.
            </p>
          </div>

          {/* ── Detection Cards ────────────────────────────────────────────────── */}
          <div className="mb-6" style={fade(120)}>
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Detection Checks
            </p>
            <div className="flex flex-col gap-3">
              {CHECKS.map((card) => {
                const meta = statusMeta(card.status)
                const isReview = card.status === 'Review'
                return (
                  <div
                    key={card.id}
                    className="rounded-2xl p-4"
                    style={{
                      background: isReview ? 'rgba(251,191,36,0.06)' : 'rgba(255,255,255,0.04)',
                      border:     isReview ? '1px solid rgba(251,191,36,0.28)' : '1px solid rgba(255,255,255,0.09)',
                      boxShadow:  isReview ? '0 0 24px rgba(251,191,36,0.08)' : 'none',
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: meta.bg, border: `1px solid ${meta.border}`, fontSize: 18 }}
                      >
                        {card.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="text-sm font-semibold leading-tight" style={{ color: '#ffffff' }}>{card.title}</p>
                          <span
                            className="shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide"
                            style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}
                          >
                            {meta.label}
                          </span>
                        </div>
                        <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>{card.message}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Demo Action Buttons ────────────────────────────────────────────── */}
          <div className="mb-6" style={fade(200)}>
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Demo Actions
            </p>
            <div className="flex flex-col gap-3">

              {/* Run Fraud Scan */}
              <button
                onClick={() => runAction(setScanState, 'Fraud scan completed.')}
                disabled={scanState !== 'idle'}
                className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl font-semibold text-sm transition-all hover:brightness-110 active:scale-[0.98]"
                style={{
                  background: scanState === 'done'
                    ? 'rgba(34,197,94,0.12)'
                    : 'linear-gradient(135deg, #0057e7, #00c8ff)',
                  color:   scanState === 'done' ? '#4ade80' : '#ffffff',
                  border:  scanState === 'done' ? '1px solid rgba(34,197,94,0.35)' : 'none',
                  cursor:  scanState !== 'idle' ? 'not-allowed' : 'pointer',
                  boxShadow: scanState === 'idle' ? '0 4px 24px rgba(0,190,255,0.28)' : 'none',
                  opacity: scanState !== 'idle' ? 0.85 : 1,
                }}
              >
                {scanState === 'running' ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2" style={{ borderColor: 'rgba(255,255,255,0.2)', borderTopColor: '#ffffff', animation: 'spin 0.7s linear infinite' }} />
                    Running Scan…
                  </>
                ) : scanState === 'done' ? '✓ Fraud scan completed.' : '🔍 Run Fraud Scan'}
              </button>

              {/* Block Duplicate Scan */}
              <button
                onClick={() => runAction(setBlockState, 'Duplicate payout blocked.')}
                disabled={blockState !== 'idle'}
                className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl font-semibold text-sm transition-all hover:brightness-110 active:scale-[0.98]"
                style={{
                  background: blockState === 'done'
                    ? 'rgba(34,197,94,0.12)'
                    : 'rgba(248,113,113,0.1)',
                  color:  blockState === 'done' ? '#4ade80' : '#f87171',
                  border: blockState === 'done' ? '1px solid rgba(34,197,94,0.35)' : '1px solid rgba(248,113,113,0.3)',
                  cursor: blockState !== 'idle' ? 'not-allowed' : 'pointer',
                  opacity: blockState !== 'idle' ? 0.85 : 1,
                }}
              >
                {blockState === 'running' ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2" style={{ borderColor: 'rgba(248,113,113,0.25)', borderTopColor: '#f87171', animation: 'spin 0.7s linear infinite' }} />
                    Blocking…
                  </>
                ) : blockState === 'done' ? '✓ Duplicate payout blocked.' : '🔒 Block Duplicate Scan'}
              </button>

              {/* Clear Review */}
              <button
                onClick={() => runAction(setClearState, 'Review cleared.')}
                disabled={clearState !== 'idle'}
                className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl font-semibold text-sm transition-all hover:brightness-110 active:scale-[0.98]"
                style={{
                  background: clearState === 'done'
                    ? 'rgba(34,197,94,0.12)'
                    : 'rgba(251,191,36,0.08)',
                  color:  clearState === 'done' ? '#4ade80' : '#fbbf24',
                  border: clearState === 'done' ? '1px solid rgba(34,197,94,0.35)' : '1px solid rgba(251,191,36,0.28)',
                  cursor: clearState !== 'idle' ? 'not-allowed' : 'pointer',
                  opacity: clearState !== 'idle' ? 0.85 : 1,
                }}
              >
                {clearState === 'running' ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2" style={{ borderColor: 'rgba(251,191,36,0.25)', borderTopColor: '#fbbf24', animation: 'spin 0.7s linear infinite' }} />
                    Clearing…
                  </>
                ) : clearState === 'done' ? '✓ Review cleared.' : '✅ Clear Review'}
              </button>
            </div>
          </div>

          {/* ── Flagged Activity Table ─────────────────────────────────────────── */}
          <div className="mb-6" style={fade(260)}>
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Recent Flagged Activity
            </p>
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(0,190,255,0.15)' }}
            >
              {/* Table header */}
              <div
                className="grid px-4 py-2.5"
                style={{
                  gridTemplateColumns: '1fr 1fr 1fr 72px',
                  background:    'rgba(0,87,231,0.12)',
                  borderBottom:  '1px solid rgba(0,190,255,0.12)',
                }}
              >
                {['Type', 'Bag ID', 'Action', 'Risk'].map(h => (
                  <span key={h} className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    {h}
                  </span>
                ))}
              </div>
              {/* Rows */}
              {ACTIVITY.map((row, i) => {
                const rm = riskMeta(row.risk)
                const isLast = i === ACTIVITY.length - 1
                return (
                  <div
                    key={row.id}
                    className="grid px-4 py-3 items-center"
                    style={{
                      gridTemplateColumns: '1fr 1fr 1fr 72px',
                      borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.05)',
                    }}
                  >
                    <span className="text-xs font-medium" style={{ color: '#ffffff' }}>{row.type}</span>
                    <span className="text-[10px] font-mono" style={{ color: 'rgba(0,200,255,0.7)' }}>{row.bagId}</span>
                    <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.45)' }}>{row.action}</span>
                    <span
                      className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide w-fit"
                      style={{ background: rm.bg, color: rm.color, border: `1px solid ${rm.border}` }}
                    >
                      {row.risk}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Why This Matters ───────────────────────────────────────────────── */}
          <div
            className="rounded-2xl p-5 mb-6"
            style={{
              background: 'rgba(0,87,231,0.07)',
              border:     '1px solid rgba(0,200,255,0.2)',
              ...fade(320),
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(0,200,255,0.12)', border: '1px solid rgba(0,200,255,0.3)', fontSize: 16 }}
              >
                🛡️
              </div>
              <p className="text-sm font-bold" style={{ color: '#ffffff' }}>Why This Matters</p>
            </div>
            <p className="text-xs leading-relaxed mb-4" style={{ color: 'rgba(255,255,255,0.55)' }}>
              Fraud detection protects consumer rewards, fundraiser donations, sponsor reporting,
              and citywide recycling data.
            </p>
            <div className="flex flex-wrap gap-2">
              {EDUCATION_CHIPS.map(chip => (
                <span
                  key={chip}
                  className="px-3 py-1 rounded-full text-[10px] font-semibold"
                  style={{ background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.22)', color: '#00c8ff' }}
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>

          {/* ── Back link ──────────────────────────────────────────────────────── */}
          <div style={fade(380)}>
            <Link
              to="/"
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-medium transition-all hover:brightness-110"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}
            >
              ← Back to Dashboard
            </Link>
          </div>

        </div>
      </div>
    </div>
  )
}
