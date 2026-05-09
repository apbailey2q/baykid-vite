import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

// ── Mock data ──────────────────────────────────────────────────────────────────

const receipt = {
  receiptId:      'CBR-DON-2026-000421',
  date:           'May 4, 2026',
  donorName:      'Alex Johnson',
  fundraiser:     'East Nashville High Basketball Team',
  bagId:          'CB-NASH-000421',
  donationAmount: 0.85,
  totalBagValue:  2.85,
  co2Saved:       4.2,
  pointsEarned:   285,
  status:         'Recorded',
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DonationReceiptPage() {
  const [animate,    setAnimate]    = useState(false)
  const [downloaded, setDownloaded] = useState(false)

  useEffect(() => {
    const t = requestAnimationFrame(() => setAnimate(true))
    return () => cancelAnimationFrame(t)
  }, [])

  const fade = (delay = 0): React.CSSProperties => ({
    opacity:    animate ? 1 : 0,
    transform:  animate ? 'translateY(0)' : 'translateY(14px)',
    transition: `opacity 0.4s ease ${delay}ms, transform 0.4s ease ${delay}ms`,
  })

  const handleDownload = () => {
    setDownloaded(true)
    setTimeout(() => setDownloaded(false), 3500)
  }

  const divider: React.CSSProperties = {
    borderTop:  'none',
    borderLeft: 'none',
    borderRight:'none',
    borderBottom: '1px dashed rgba(255,255,255,0.09)',
    margin: '0',
  }

  return (
    <div
      className="relative min-h-screen flex flex-col overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}
    >
      <div className="pointer-events-none absolute inset-0 grid-bg" />
      <div className="pointer-events-none absolute" style={{ top: -80, left: -50, width: 280, height: 280, background: 'rgba(34,197,94,0.22)', filter: 'blur(72px)', borderRadius: '50%' }} />
      <div className="pointer-events-none absolute" style={{ bottom: -60, right: -40, width: 240, height: 240, background: 'rgba(0,200,255,0.16)', filter: 'blur(64px)', borderRadius: '50%' }} />

      <div className="relative flex-1 overflow-y-auto pb-24" style={{ zIndex: 1 }}>
        <div className="max-w-[480px] mx-auto px-4 pt-10 pb-6">

          {/* ── Page header ───────────────────────────────────────────────────── */}
          <div className="flex flex-col items-center text-center mb-7" style={fade(0)}>
            <div
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-full mb-4"
              style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.35)' }}
            >
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: '#4ade80', boxShadow: '0 0 5px rgba(74,222,128,0.9)', animation: animate ? 'rcptDot 2s ease-in-out infinite' : 'none' }}
              />
              <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#4ade80' }}>
                Donation Confirmed
              </span>
            </div>

            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
              style={{
                background: 'rgba(34,197,94,0.1)',
                border:     '2px solid rgba(34,197,94,0.5)',
                boxShadow:  animate ? '0 0 32px rgba(34,197,94,0.22)' : 'none',
                fontSize:   28,
              }}
            >
              🌱
            </div>

            <h1 className="text-2xl font-bold mb-1" style={{ color: '#ffffff' }}>Donation Receipt</h1>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Proof of recycling-based fundraiser contribution.
            </p>
          </div>

          {/* ── Receipt card ──────────────────────────────────────────────────── */}
          <div
            className="rounded-2xl overflow-hidden mb-5"
            style={{
              background: 'rgba(7,14,38,0.97)',
              border:     '1px solid rgba(0,200,255,0.28)',
              boxShadow:  '0 0 48px rgba(0,200,255,0.1), 0 8px 32px rgba(0,0,0,0.4)',
              ...fade(80),
            }}
          >
            {/* ── Brand header ── */}
            <div
              style={{
                background:   'linear-gradient(135deg, rgba(0,87,231,0.45), rgba(0,200,255,0.18))',
                borderBottom: '1px solid rgba(0,200,255,0.18)',
                padding:      '20px 22px 18px',
              }}
            >
              <div className="flex items-start justify-between gap-3 mb-5">
                {/* Logo + company */}
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(0,200,255,0.2)', border: '1px solid rgba(0,200,255,0.45)', fontSize: 19 }}
                  >
                    ♻️
                  </div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 800, color: '#ffffff', lineHeight: 1.1 }}>
                      Cyan's Brooklynn
                    </p>
                    <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
                      Recycling Enterprise
                    </p>
                  </div>
                </div>
                {/* Demo badge */}
                <div
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg shrink-0"
                  style={{ background: 'rgba(251,191,36,0.14)', border: '1px solid rgba(251,191,36,0.42)' }}
                >
                  <span style={{ fontSize: 8, fontWeight: 900, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    Demo Receipt
                  </span>
                </div>
              </div>

              {/* Receipt ID block */}
              <div>
                <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(0,200,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 5 }}>
                  Donation Receipt
                </p>
                <p className="font-mono font-bold" style={{ fontSize: 15, color: '#ffffff', letterSpacing: '0.02em' }}>
                  {receipt.receiptId}
                </p>
              </div>
            </div>

            {/* ── Perforated divider ── */}
            <div style={divider} />

            {/* ── Donor & Fundraiser ── */}
            <div style={{ padding: '16px 22px' }}>
              <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.22)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 13 }}>
                Contribution Details
              </p>
              <div className="flex flex-col gap-3.5">
                {[
                  { label: 'Date',       value: receipt.date,        icon: '📅', mono: false, green: false  },
                  { label: 'Donor',      value: receipt.donorName,   icon: '👤', mono: false, green: false  },
                  { label: 'Fundraiser', value: receipt.fundraiser,  icon: '🌱', mono: false, green: true   },
                ].map(row => (
                  <div key={row.label} className="flex items-start gap-3">
                    <span style={{ fontSize: 14, flexShrink: 0, lineHeight: 1, marginTop: 1 }}>{row.icon}</span>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.36)', flexShrink: 0, minWidth: 72 }}>{row.label}</span>
                    <span
                      style={{
                        fontSize:   12,
                        fontWeight: 600,
                        color:      row.green ? '#4ade80' : '#ffffff',
                        lineHeight: 1.4,
                        flex:       1,
                        textAlign:  'right',
                      }}
                    >
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div style={divider} />

            {/* ── Bag details ── */}
            <div style={{ padding: '16px 22px' }}>
              <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.22)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 13 }}>
                Bag Details
              </p>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.36)' }}>Bag ID</span>
                  <span className="font-mono" style={{ fontSize: 11, fontWeight: 700, color: '#67e8f9' }}>
                    {receipt.bagId}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.36)' }}>Total Bag Value</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#ffffff' }}>
                    ${receipt.totalBagValue.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.36)' }}>CO₂ Saved</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#5eead4' }}>
                    {receipt.co2Saved} lbs
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.36)' }}>Points Earned</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#fbbf24' }}>
                    {receipt.pointsEarned.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            <div style={divider} />

            {/* ── Donation amount — hero row ── */}
            <div
              style={{
                padding:      '18px 22px',
                background:   'rgba(34,197,94,0.07)',
                borderTop:    '1px solid rgba(34,197,94,0.12)',
                borderBottom: '1px solid rgba(34,197,94,0.12)',
              }}
            >
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(74,222,128,0.5)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 5 }}>
                    Donation Amount
                  </p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.36)', lineHeight: 1.4 }}>
                    Credited to fundraiser
                  </p>
                </div>
                <p style={{ fontSize: 36, fontWeight: 900, color: '#4ade80', letterSpacing: '-0.03em', lineHeight: 1 }}>
                  ${receipt.donationAmount.toFixed(2)}
                </p>
              </div>
            </div>

            {/* ── Status ── */}
            <div style={{ padding: '14px 22px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="flex items-center justify-between">
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.36)' }}>Status</span>
                <div
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full"
                  style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.38)' }}
                >
                  <div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: '#4ade80', boxShadow: '0 0 4px #4ade80' }}
                  />
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#4ade80' }}>
                    {receipt.status}
                  </span>
                </div>
              </div>
            </div>

            {/* ── Disclaimer note ── */}
            <div style={{ padding: '14px 22px 16px' }}>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', lineHeight: 1.7, textAlign: 'center' }}>
                This demo receipt confirms recycling value credited to a fundraiser. Tax-deductible status depends on the fundraiser organization and production setup.
              </p>
            </div>
          </div>

          {/* ── Buttons ───────────────────────────────────────────────────────── */}
          <div className="flex flex-col gap-3" style={fade(200)}>
            <button
              onClick={handleDownload}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-sm hover:brightness-110 active:scale-[0.98] transition-all"
              style={{
                background: downloaded
                  ? 'rgba(34,197,94,0.12)'
                  : 'linear-gradient(135deg, #0057e7, #00c8ff)',
                border:     downloaded ? '1px solid rgba(34,197,94,0.4)' : 'none',
                color:      downloaded ? '#4ade80' : '#ffffff',
                boxShadow:  downloaded ? 'none' : '0 4px 20px rgba(0,87,231,0.35)',
                cursor:     'pointer',
                transition: 'all 0.3s ease',
              }}
            >
              {downloaded ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Demo receipt generated.
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Download Receipt
                </>
              )}
            </button>

            <Link
              to="/my-fundraiser"
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold transition-all hover:brightness-110"
              style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.28)', color: '#4ade80' }}
            >
              <span style={{ fontSize: 14 }}>🌱</span>
              View My Fundraiser Impact
            </Link>

            <Link
              to="/scan"
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-medium transition-all"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)' }}
            >
              <span>♻️</span>
              Scan Another Bag
            </Link>
          </div>

        </div>
      </div>

      <style>{`
        @keyframes rcptDot {
          0%, 100% { opacity: 1;   transform: scale(1);    }
          50%       { opacity: 0.4; transform: scale(0.75); }
        }
      `}</style>
    </div>
  )
}
