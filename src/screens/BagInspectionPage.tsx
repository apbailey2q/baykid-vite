import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'

// ── Mock data ──────────────────────────────────────────────────────────────────

const BAG = {
  id:             'CB-NASH-000421',
  warehouse:      'NASH-01',
  source:         'Consumer Scan',
  fundraiser:     'East Nashville High Basketball',
  estimatedValue: '$2.85',
  co2Saved:       '4.2 lbs',
}

// ── AI decision config ─────────────────────────────────────────────────────────

type AIStatus = 'green' | 'yellow' | 'red'

const DECISIONS: Record<AIStatus, {
  label:      string
  icon:       string
  confidence: number
  message:    string
  nextStep:   string
  ctaLabel:   string
  ctaRoute?:  string
  barColor:   string
  bg:         string
  border:     string
  textColor:  string
}> = {
  green: {
    label:      'Green — Clean Bag',
    icon:       '✅',
    confidence: 94,
    message:    'Bag appears clean and ready for processing.',
    nextStep:   'Send to Lifecycle',
    ctaLabel:   'Send to Lifecycle',
    ctaRoute:   '/bag-lifecycle',
    barColor:   '#4ade80',
    bg:         'rgba(34,197,94,0.08)',
    border:     'rgba(34,197,94,0.35)',
    textColor:  '#4ade80',
  },
  yellow: {
    label:      'Yellow — Needs Review',
    icon:       '⚠️',
    confidence: 76,
    message:    'Possible contamination detected. Second review recommended.',
    nextStep:   'Request Second Review',
    ctaLabel:   'Request Second Review',
    barColor:   '#fbbf24',
    bg:         'rgba(245,158,11,0.08)',
    border:     'rgba(245,158,11,0.35)',
    textColor:  '#fbbf24',
  },
  red: {
    label:      'Red — Contaminated',
    icon:       '🚫',
    confidence: 88,
    message:    'High contamination risk. Consumer education alert recommended.',
    nextStep:   'Flag and Notify Consumer',
    ctaLabel:   'Create Education Alert',
    ctaRoute:   '/contamination-alerts',
    barColor:   '#f87171',
    bg:         'rgba(239,68,68,0.08)',
    border:     'rgba(239,68,68,0.35)',
    textColor:  '#f87171',
  },
}

const RESCAN = {
  confidence: 91,
  message:    'Rescan complete. Status improved to Green.',
  ctaLabel:   'Send to Lifecycle',
  ctaRoute:   '/bag-lifecycle',
  barColor:   '#4ade80',
  textColor:  '#4ade80',
}

const OVERRIDE_REASONS = [
  'Bag appears clean after visual review',
  'AI scan error',
  'Photo quality issue',
  'Second review approved',
  'Other',
]

// ── Helpers ────────────────────────────────────────────────────────────────────

function statusButtonStyle(
  status: AIStatus,
  selected: AIStatus | null,
): React.CSSProperties {
  const isSelected = selected === status
  const base = {
    green:  { sel: 'rgba(34,197,94,0.18)',  unsel: 'rgba(34,197,94,0.06)',  selBorder: 'rgba(34,197,94,0.6)',  unselBorder: 'rgba(34,197,94,0.25)',  color: '#4ade80' },
    yellow: { sel: 'rgba(245,158,11,0.18)', unsel: 'rgba(245,158,11,0.06)', selBorder: 'rgba(245,158,11,0.6)', unselBorder: 'rgba(245,158,11,0.25)', color: '#fbbf24' },
    red:    { sel: 'rgba(239,68,68,0.18)',  unsel: 'rgba(239,68,68,0.06)',  selBorder: 'rgba(239,68,68,0.6)',  unselBorder: 'rgba(239,68,68,0.25)',  color: '#f87171' },
  }[status]

  return {
    background:  isSelected ? base.sel : selected ? 'rgba(255,255,255,0.03)' : base.unsel,
    border:      `1.5px solid ${isSelected ? base.selBorder : selected ? 'rgba(255,255,255,0.1)' : base.unselBorder}`,
    color:       isSelected ? base.color : selected ? 'rgba(255,255,255,0.3)' : base.color,
    boxShadow:   isSelected ? `0 0 20px ${base.sel}` : 'none',
    opacity:     selected && !isSelected ? 0.5 : 1,
    transition:  'all 0.25s ease',
  }
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function BagInspectionPage() {
  const navigate = useNavigate()

  const [animate,         setAnimate]         = useState(false)
  const [photoUploaded,   setPhotoUploaded]   = useState(false)
  const [status,          setStatus]          = useState<AIStatus | null>(null)
  const [confAnimate,     setConfAnimate]     = useState(false)
  const [rescanDone,      setRescanDone]      = useState(false)
  const [rescanMsg,       setRescanMsg]       = useState(false)

  // Manual override
  const [staffName,       setStaffName]       = useState('')
  const [overrideReason,  setOverrideReason]  = useState('')
  const [overrideNotes,   setOverrideNotes]   = useState('')
  const [overrideApplied, setOverrideApplied] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimate(true))
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    if (!status) { setConfAnimate(false); return }
    const id = setTimeout(() => setConfAnimate(true), 120)
    return () => clearTimeout(id)
  }, [status])

  const fade = (delay = 0): React.CSSProperties => ({
    opacity:    animate ? 1 : 0,
    transform:  animate ? 'translateY(0)' : 'translateY(16px)',
    transition: `opacity 0.45s ease ${delay}ms, transform 0.45s ease ${delay}ms`,
  })

  const handleStatusSelect = (s: AIStatus) => {
    if (status === s) return
    setStatus(s)
    setRescanDone(false)
    setRescanMsg(false)
    setConfAnimate(false)
    setOverrideApplied(false)
    setStaffName('')
    setOverrideReason('')
    setOverrideNotes('')
  }

  const handleRescan = () => {
    setConfAnimate(false)
    setRescanDone(true)
    setRescanMsg(true)
    setTimeout(() => setConfAnimate(true), 80)
  }

  const handleOverride = () => {
    if (!staffName.trim() || !overrideReason) return
    setOverrideApplied(true)
  }

  const canOverride = staffName.trim().length > 0 && overrideReason !== ''

  // Derive effective result (override wins over rescan wins over status)
  const effectiveStatus  = overrideApplied ? 'green' : rescanDone ? 'green' : status
  const result           = effectiveStatus ? DECISIONS[effectiveStatus] : null
  const confidence       = rescanDone && !overrideApplied ? RESCAN.confidence : result?.confidence ?? 0
  const displayMessage   = rescanDone && !overrideApplied ? RESCAN.message   : result?.message ?? ''
  const displayCtaLabel  = rescanDone && !overrideApplied ? RESCAN.ctaLabel  : result?.ctaLabel ?? ''
  const displayCtaRoute  = rescanDone && !overrideApplied ? RESCAN.ctaRoute  : result?.ctaRoute
  const displayBarColor  = rescanDone && !overrideApplied ? RESCAN.barColor  : result?.barColor ?? '#00c8ff'
  const displayTextColor = rescanDone && !overrideApplied ? RESCAN.textColor : result?.textColor ?? '#ffffff'

  // Show manual override form when yellow or red, not yet overridden, not rescan-resolved
  const showOverrideForm    = (status === 'yellow' || status === 'red') && !overrideApplied && !rescanDone
  const showOverrideSuccess = overrideApplied

  // The original AI status before override (for audit trail)
  const originalStatus = status

  const BAG_ROWS = [
    { label: 'Bag ID',           value: BAG.id,             mono: true  },
    { label: 'Warehouse',        value: BAG.warehouse,      mono: true  },
    { label: 'Source',           value: BAG.source                      },
    { label: 'Fundraiser',       value: BAG.fundraiser,     green: true },
    { label: 'Estimated Value',  value: BAG.estimatedValue, accent: true},
    { label: 'CO₂ Saved',        value: BAG.co2Saved,       green: true },
  ]

  return (
    <div
      className="relative min-h-screen flex flex-col overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}
    >
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 grid-bg" />
      <div className="pointer-events-none absolute" style={{ top: -80, left: -60, width: 300, height: 300, background: 'rgba(0,87,231,0.28)', filter: 'blur(72px)', borderRadius: '50%' }} />
      <div className="pointer-events-none absolute" style={{ bottom: -60, right: -40, width: 240, height: 240, background: 'rgba(0,200,128,0.1)', filter: 'blur(64px)', borderRadius: '50%' }} />

      <div className="relative flex-1 overflow-y-auto pb-16" style={{ zIndex: 1 }}>
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
            Back
          </button>

          {/* ── Header ───────────────────────────────────────────────────────── */}
          <div className="mb-6" style={fade(40)}>
            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(0,200,255,0.12)', border: '1px solid rgba(0,200,255,0.3)', boxShadow: '0 0 20px rgba(0,200,255,0.15)' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00c8ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/>
                </svg>
              </div>
              <h1 className="text-xl font-bold" style={{ color: '#ffffff' }}>AI Bag Inspection</h1>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.42)' }}>
              Review QR bag quality and detect contamination risk before processing.
            </p>
          </div>

          {/* ── Bag Info Card ─────────────────────────────────────────────────── */}
          <div
            className="rounded-2xl overflow-hidden mb-5"
            style={{ ...fade(80), background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(0,190,255,0.15)' }}
          >
            <div
              className="flex items-center gap-3 px-5 py-4"
              style={{ background: 'rgba(0,87,231,0.15)', borderBottom: '1px solid rgba(0,190,255,0.1)' }}
            >
              <span style={{ fontSize: 20 }}>📦</span>
              <div>
                <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(0,200,255,0.7)', marginBottom: 1 }}>
                  Bag Details
                </p>
                <p className="font-mono font-bold" style={{ fontSize: 14, color: '#ffffff' }}>{BAG.id}</p>
              </div>
            </div>
            {BAG_ROWS.slice(1).map((row, i, arr) => (
              <div
                key={row.label}
                className="flex items-center justify-between px-5 py-3"
                style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}
              >
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.42)' }}>{row.label}</span>
                <span
                  className={row.mono ? 'font-mono' : ''}
                  style={{
                    fontSize:   12,
                    fontWeight: 700,
                    color:      row.green ? '#5eead4' : row.accent ? '#00c8ff' : '#ffffff',
                    maxWidth:   '55%',
                    textAlign:  'right',
                  }}
                >
                  {row.value}
                </span>
              </div>
            ))}
          </div>

          {/* ── Photo Upload Card ─────────────────────────────────────────────── */}
          <div
            className="rounded-2xl p-5 mb-6"
            style={{ ...fade(140), background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(0,190,255,0.13)' }}
          >
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.38)', marginBottom: 14 }}>
              Bag Photo Review
            </p>

            {photoUploaded ? (
              <div
                className="rounded-2xl overflow-hidden"
                style={{ border: '1.5px solid rgba(0,200,128,0.4)', animation: 'fadeIn 0.3s ease' }}
              >
                <div
                  className="flex flex-col items-center justify-center gap-2"
                  style={{ height: 160, background: 'linear-gradient(135deg, rgba(0,87,231,0.15), rgba(0,200,128,0.12))' }}
                >
                  <span style={{ fontSize: 40 }}>🖼️</span>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Demo photo uploaded</p>
                </div>
                <div
                  className="flex items-center justify-between px-4 py-3"
                  style={{ background: 'rgba(0,200,128,0.08)', borderTop: '1px solid rgba(0,200,128,0.2)' }}
                >
                  <div className="flex items-center gap-2">
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80', animation: 'liveDot 1.4s ease-in-out infinite' }} />
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#4ade80' }}>AI review ready</p>
                  </div>
                  <button
                    onClick={() => setPhotoUploaded(false)}
                    style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    Replace
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div
                  className="rounded-2xl flex flex-col items-center justify-center gap-3 mb-4"
                  style={{ height: 140, border: '2px dashed rgba(0,190,255,0.25)', background: 'rgba(0,190,255,0.03)' }}
                >
                  <div style={{ fontSize: 32, opacity: 0.4 }}>📷</div>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>No photo uploaded yet</p>
                </div>
                <button
                  onClick={() => setPhotoUploaded(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all hover:brightness-110 active:scale-[0.98]"
                  style={{ background: 'rgba(0,190,255,0.1)', border: '1px solid rgba(0,190,255,0.3)', color: '#00c8ff' }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  Upload Bag Photo
                </button>
              </div>
            )}
          </div>

          {/* ── AI Status Buttons ─────────────────────────────────────────────── */}
          <div className="mb-6" style={fade(200)}>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.38)', marginBottom: 12 }}>
              AI Status Decision
            </p>
            <div className="flex flex-col gap-3">
              {(['green', 'yellow', 'red'] as AIStatus[]).map((s) => {
                const d = DECISIONS[s]
                const isSelected = status === s
                return (
                  <button
                    key={s}
                    onClick={() => handleStatusSelect(s)}
                    className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-left transition-all active:scale-[0.98]"
                    style={statusButtonStyle(s, status)}
                  >
                    <span style={{ fontSize: 24, flexShrink: 0 }}>{d.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p style={{ fontSize: 14, fontWeight: 700, color: 'inherit', marginBottom: 2 }}>{d.label}</p>
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{d.nextStep}</p>
                    </div>
                    {isSelected && (
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                        style={{ background: d.barColor, fontSize: 11 }}
                      >
                        ✓
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── AI Confidence Result Panel ────────────────────────────────────── */}
          <div
            style={{
              maxHeight:  status ? 600 : 0,
              opacity:    status ? 1 : 0,
              overflow:   'hidden',
              transition: 'max-height 0.45s ease, opacity 0.35s ease',
            }}
          >
            {result && (
              <div
                className="rounded-2xl overflow-hidden mb-4"
                style={{
                  background: (rescanDone || overrideApplied) ? DECISIONS.green.bg : result.bg,
                  border:     `1.5px solid ${(rescanDone || overrideApplied) ? DECISIONS.green.border : result.border}`,
                }}
              >
                {/* Result header */}
                <div
                  className="flex items-center gap-3 px-5 py-4"
                  style={{ borderBottom: `1px solid ${(rescanDone || overrideApplied) ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.07)'}` }}
                >
                  <span style={{ fontSize: 22 }}>
                    {(rescanDone || overrideApplied) ? DECISIONS.green.icon : result.icon}
                  </span>
                  <div className="flex-1">
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>
                      AI Inspection Result
                    </p>
                    <p style={{ fontSize: 14, fontWeight: 700, color: overrideApplied ? '#4ade80' : displayTextColor }}>
                      {overrideApplied ? 'Green — Accepted by Manual Override' : rescanDone ? 'Green — Clean Bag' : result.label}
                    </p>
                  </div>
                  {overrideApplied && (
                    <span
                      className="shrink-0 px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider"
                      style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)', color: '#fbbf24' }}
                    >
                      Manual Override
                    </span>
                  )}
                </div>

                <div className="px-5 py-4 flex flex-col gap-4">
                  {/* Confidence bar */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.42)' }}>AI Confidence</p>
                      <p style={{ fontSize: 13, fontWeight: 700, color: overrideApplied ? '#4ade80' : displayTextColor }}>{confidence}%</p>
                    </div>
                    <div className="rounded-full overflow-hidden" style={{ height: 7, background: 'rgba(255,255,255,0.08)' }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width:      confAnimate ? `${confidence}%` : '0%',
                          background: overrideApplied ? '#4ade80' : displayBarColor,
                          transition: 'width 0.9s ease 0.1s',
                          boxShadow:  `0 0 8px ${overrideApplied ? '#4ade80' : displayBarColor}88`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Message */}
                  <div
                    className="rounded-xl px-4 py-3"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                  >
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                      {overrideApplied ? 'Override Decision' : 'AI Message'}
                    </p>
                    <p style={{ fontSize: 13, color: '#ffffff', lineHeight: 1.5 }}>
                      {overrideApplied ? 'Authorized staff accepted this bag after review.' : displayMessage}
                    </p>
                  </div>

                  {/* Next Step label */}
                  <div className="flex items-center justify-between">
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)' }}>Next Step</p>
                    <p style={{ fontSize: 12, fontWeight: 700, color: overrideApplied ? '#4ade80' : displayTextColor }}>
                      {overrideApplied ? 'Send to Processing' : rescanDone ? RESCAN.ctaLabel : result.nextStep}
                    </p>
                  </div>

                  {/* Rescan button (yellow only, before rescan, before override) */}
                  {status === 'yellow' && !rescanDone && !overrideApplied && (
                    <button
                      onClick={handleRescan}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all hover:brightness-110 active:scale-[0.98]"
                      style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.35)', color: '#fbbf24' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>
                      </svg>
                      Rescan Bag
                    </button>
                  )}

                  {/* Rescan success notice */}
                  {rescanMsg && (
                    <div
                      className="flex items-center gap-2.5 rounded-xl px-4 py-3"
                      style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)', animation: 'fadeIn 0.35s ease' }}
                    >
                      <span style={{ fontSize: 15 }}>♻️</span>
                      <p style={{ fontSize: 12, color: '#4ade80', fontWeight: 600 }}>Rescan complete. Status improved to Green.</p>
                    </div>
                  )}

                  {/* Action CTA — hidden when override is in effect */}
                  {!overrideApplied && (
                    displayCtaRoute ? (
                      <Link
                        to={displayCtaRoute}
                        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-sm transition-all hover:brightness-110 active:scale-[0.98]"
                        style={{
                          background: rescanDone || status === 'green'
                            ? 'linear-gradient(135deg,#166534,#4ade80)'
                            : 'linear-gradient(135deg,#7f1d1d,#f87171)',
                          color: '#ffffff',
                          boxShadow: `0 4px 20px ${displayBarColor}44`,
                        }}
                      >
                        {displayCtaLabel}
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12h14M12 5l7 7-7 7"/>
                        </svg>
                      </Link>
                    ) : (
                      <button
                        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-sm transition-all hover:brightness-110 active:scale-[0.98]"
                        style={{
                          background: 'linear-gradient(135deg,#78350f,#fbbf24)',
                          color:      '#ffffff',
                          boxShadow:  '0 4px 20px rgba(245,158,11,0.3)',
                        }}
                      >
                        {displayCtaLabel}
                      </button>
                    )
                  )}

                  {/* Override success CTA */}
                  {overrideApplied && (
                    <Link
                      to="/bag-lifecycle"
                      className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-sm transition-all hover:brightness-110 active:scale-[0.98]"
                      style={{ background: 'linear-gradient(135deg,#166534,#4ade80)', color: '#ffffff', boxShadow: '0 4px 20px rgba(34,197,94,0.3)' }}
                    >
                      Override &amp; Send to Lifecycle
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14M12 5l7 7-7 7"/>
                      </svg>
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Manual Override Form ──────────────────────────────────────────── */}
          <div
            style={{
              maxHeight:  showOverrideForm ? 700 : 0,
              opacity:    showOverrideForm ? 1 : 0,
              overflow:   'hidden',
              transition: 'max-height 0.5s ease, opacity 0.35s ease',
            }}
          >
            <div
              className="rounded-2xl overflow-hidden mb-4"
              style={{ background: 'rgba(245,158,11,0.06)', border: '1.5px solid rgba(245,158,11,0.3)' }}
            >
              {/* Override header */}
              <div
                className="flex items-center gap-3 px-5 py-4"
                style={{ background: 'rgba(245,158,11,0.08)', borderBottom: '1px solid rgba(245,158,11,0.15)' }}
              >
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.35)' }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#fbbf24' }}>Manual Review Override</p>
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', marginTop: 1 }}>Authorized staff only</p>
                </div>
              </div>

              <div className="px-5 py-4 flex flex-col gap-4">
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
                  If the bag looks safe after staff review, authorized staff can override the AI result and accept the bag for processing.
                </p>

                {/* Staff Name */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.38)', marginBottom: 8 }}>
                    Staff Name
                  </label>
                  <input
                    type="text"
                    value={staffName}
                    onChange={(e) => setStaffName(e.target.value)}
                    placeholder="Enter your full name"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 12,
                      border: '1.5px solid rgba(245,158,11,0.25)',
                      background: 'rgba(255,255,255,0.05)',
                      color: '#ffffff',
                      fontSize: 13,
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                {/* Override Reason */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.38)', marginBottom: 8 }}>
                    Override Reason
                  </label>
                  <select
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 12,
                      border: '1.5px solid rgba(245,158,11,0.25)',
                      background: '#0d1a30',
                      color: overrideReason ? '#ffffff' : 'rgba(255,255,255,0.3)',
                      fontSize: 13,
                      outline: 'none',
                      cursor: 'pointer',
                      appearance: 'none',
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value="" style={{ color: 'rgba(255,255,255,0.3)' }}>Select a reason…</option>
                    {OVERRIDE_REASONS.map((r) => (
                      <option key={r} value={r} style={{ color: '#ffffff', background: '#0d1a30' }}>{r}</option>
                    ))}
                  </select>
                </div>

                {/* Notes (optional) */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.38)', marginBottom: 8 }}>
                    Review Notes <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'rgba(255,255,255,0.25)' }}>(optional)</span>
                  </label>
                  <textarea
                    value={overrideNotes}
                    onChange={(e) => setOverrideNotes(e.target.value)}
                    placeholder="Additional review notes…"
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 12,
                      border: '1.5px solid rgba(245,158,11,0.2)',
                      background: 'rgba(255,255,255,0.05)',
                      color: '#ffffff',
                      fontSize: 13,
                      outline: 'none',
                      resize: 'none',
                      lineHeight: 1.5,
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                {/* Override button */}
                <button
                  onClick={handleOverride}
                  disabled={!canOverride}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-sm transition-all active:scale-[0.98]"
                  style={{
                    background: canOverride
                      ? 'linear-gradient(135deg, #92400e, #f59e0b)'
                      : 'rgba(255,255,255,0.06)',
                    color:      canOverride ? '#ffffff' : 'rgba(255,255,255,0.25)',
                    border:     canOverride ? 'none' : '1px solid rgba(255,255,255,0.1)',
                    cursor:     canOverride ? 'pointer' : 'not-allowed',
                    boxShadow:  canOverride ? '0 4px 20px rgba(245,158,11,0.35)' : 'none',
                    transition: 'all 0.25s ease',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>
                  </svg>
                  Override & Accept Bag
                </button>

                {!canOverride && (staffName.trim() === '' || overrideReason === '') && (
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', textAlign: 'center', marginTop: -8 }}>
                    Staff name and override reason required
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ── Audit Trail (after override) ──────────────────────────────────── */}
          <div
            style={{
              maxHeight:  showOverrideSuccess ? 500 : 0,
              opacity:    showOverrideSuccess ? 1 : 0,
              overflow:   'hidden',
              transition: 'max-height 0.5s ease 0.1s, opacity 0.4s ease 0.15s',
            }}
          >
            <div
              className="rounded-2xl overflow-hidden mb-4"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(0,200,255,0.2)' }}
            >
              <div
                className="flex items-center gap-2.5 px-5 py-3.5"
                style={{ background: 'rgba(0,200,255,0.07)', borderBottom: '1px solid rgba(0,200,255,0.12)' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00c8ff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
                </svg>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#00c8ff' }}>Inspection Audit Trail</p>
              </div>

              <div className="flex flex-col">
                {[
                  { label: 'AI Result',       value: originalStatus ? DECISIONS[originalStatus].label : '—', warn: true },
                  { label: 'Staff Override',  value: 'Approved',                      green: true },
                  { label: 'Reviewer',        value: staffName || '—'                              },
                  { label: 'Reason',          value: overrideReason || '—'                         },
                  { label: 'Notes',           value: overrideNotes.trim() || 'None',  muted: true  },
                  { label: 'Final Status',    value: 'Accepted for Processing',       green: true  },
                ].map((row, i, arr) => (
                  <div
                    key={row.label}
                    className="flex items-start justify-between px-5 py-3"
                    style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}
                  >
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', flexShrink: 0, marginRight: 12 }}>{row.label}</span>
                    <span style={{
                      fontSize:   12,
                      fontWeight: 600,
                      color:      row.green ? '#4ade80' : row.warn ? '#f87171' : row.muted ? 'rgba(255,255,255,0.3)' : '#ffffff',
                      textAlign:  'right',
                      maxWidth:   '60%',
                    }}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Demo note */}
          <p className="text-center text-[10px]" style={{ ...fade(400), color: 'rgba(255,255,255,0.2)' }}>
            Demo only — no data submitted or stored.
          </p>

        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes liveDot {
          0%,100% { opacity: 1; transform: scale(1);   }
          50%     { opacity: 0.4; transform: scale(0.7); }
        }
      `}</style>
    </div>
  )
}
