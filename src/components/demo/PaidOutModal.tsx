// DEMO — PaidOutModal with confetti + payout confirmation
import { useState } from 'react'
import type { DemoStats } from '../../store/demoStore'

interface Props {
  stats: DemoStats
  onClose: () => void
  onConfirm: () => void
}

const S = '#4ade80'
const A = '#00c8ff'
const GL = 'rgba(255,255,255,0.06)'
const BD = 'rgba(0,190,255,0.15)'

// Deterministic confetti (recycling symbols + colored squares)
const CONFETTI_COLORS = ['#38bdf8', '#4ade80', '#fb923c', '#f472b6', '#facc15']
const PIECES = Array.from({ length: 30 }, (_, i) => ({
  left:   `${(i * 31 + 11) % 95}%`,
  delay:  ((i * 7)  % 60) / 100,
  dur:    1.4 + ((i * 11) % 12) / 10,
  color:  CONFETTI_COLORS[i % 5],
  rot:    (i * 47) % 360,
  isSymbol: i % 5 === 0,
}))

function Confetti() {
  return (
    <div className="pointer-events-none fixed inset-0" style={{ zIndex: 400 }}>
      {PIECES.map((p, i) =>
        p.isSymbol ? (
          <div key={i} style={{
            position: 'absolute', left: p.left, top: -24, fontSize: 18,
            animation: `confettiFall ${p.dur}s ease-in ${p.delay}s both`,
          }}>♻️</div>
        ) : (
          <div key={i} style={{
            position: 'absolute', left: p.left, top: -20,
            width: 7, height: 12, borderRadius: 2,
            background: p.color, transform: `rotate(${p.rot}deg)`,
            animation: `confettiFall ${p.dur}s ease-in ${p.delay}s both`,
          }}/>
        )
      )}
    </div>
  )
}

export default function PaidOutModal({ stats, onClose, onConfirm }: Props) {
  const [paid, setPaid] = useState(false)

  const handlePay = () => {
    onConfirm()
    setPaid(true)
  }

  return (
    <>
      <Confetti />
      <div
        className="fixed inset-0 z-[350] flex items-end justify-center"
        style={{ background: 'rgba(4,10,26,0.85)', backdropFilter: 'blur(12px)' }}
        onClick={onClose}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{
            width: '100%', maxWidth: 430,
            background: 'linear-gradient(180deg,#0a1830,#060e24)',
            border: `1px solid ${BD}`,
            borderRadius: '24px 24px 0 0',
            padding: '24px 20px 36px',
            animation: 'fadeSlideUp 0.3s ease both',
          }}
        >
          {!paid ? (
            <>
              {/* Header */}
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <div style={{
                  width: 64, height: 64, borderRadius: '50%', margin: '0 auto 12px',
                  background: 'rgba(74,222,128,0.12)', border: `2px solid ${S}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: `0 0 28px rgba(74,222,128,0.3)`,
                  animation: 'badgePop 0.5s ease both',
                }}>
                  <span style={{ fontSize: 30 }}>💸</span>
                </div>
                <p style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>Payout Summary</p>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>Confirm your recycling earnings</p>
              </div>

              {/* Stats */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                <div style={{ padding: '14px 16px', borderRadius: 14, background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.25)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>Total Payout</span>
                  <span style={{ fontSize: 22, fontWeight: 800, color: S }}>${stats.unpaidEarnings.toFixed(2)}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ padding: '10px 12px', borderRadius: 12, background: GL, border: `1px solid ${BD}`, textAlign: 'center' }}>
                    <p style={{ fontSize: 18, fontWeight: 700, color: A }}>{stats.bagsCompleted}</p>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>Bags Completed</p>
                  </div>
                  <div style={{ padding: '10px 12px', borderRadius: 12, background: GL, border: `1px solid ${BD}`, textAlign: 'center' }}>
                    <p style={{ fontSize: 18, fontWeight: 700, color: A }}>{stats.poundsRecycled} lbs</p>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>Recycled</p>
                  </div>
                </div>
              </div>

              {/* Message */}
              <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(56,189,248,0.06)', border: `1px solid rgba(56,189,248,0.15)`, marginBottom: 20 }}>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, textAlign: 'center' }}>
                  Great work! You're helping keep recyclable materials out of landfills. ♻️
                </p>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={onClose}
                  style={{ flex: 1, padding: '13px 0', borderRadius: 12, border: `1px solid ${BD}`, background: GL, color: 'rgba(255,255,255,0.5)', fontSize: 14, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handlePay}
                  disabled={stats.unpaidEarnings <= 0}
                  style={{
                    flex: 2, padding: '13px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
                    background: stats.unpaidEarnings > 0 ? `linear-gradient(135deg,#0057e7,${A})` : 'rgba(255,255,255,0.08)',
                    color: '#fff', fontSize: 14, fontWeight: 700,
                    boxShadow: stats.unpaidEarnings > 0 ? '0 4px 20px rgba(0,190,255,0.3)' : 'none',
                    opacity: stats.unpaidEarnings > 0 ? 1 : 0.5,
                  }}
                >
                  {stats.unpaidEarnings > 0 ? `Pay $${stats.unpaidEarnings.toFixed(2)}` : 'Nothing to pay out'}
                </button>
              </div>
            </>
          ) : (
            /* Success state */
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, paddingTop: 8 }}>
              <div style={{
                width: 72, height: 72, borderRadius: '50%',
                background: 'rgba(74,222,128,0.12)', border: `2px solid ${S}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 0 28px rgba(74,222,128,0.35)`,
                animation: 'badgePop 0.5s ease both',
              }}>
                <span style={{ fontSize: 34 }}>🎉</span>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>Payment Confirmed!</p>
                <p style={{ fontSize: 14, color: S, marginTop: 4 }}>Your earnings are on the way</p>
              </div>
              <div style={{ padding: '12px 20px', borderRadius: 12, background: GL, border: `1px solid ${BD}`, textAlign: 'center', width: '100%' }}>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Lifetime impact</p>
                <p style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginTop: 4 }}>
                  {stats.poundsRecycled} lbs recycled · {stats.co2Reduced} kg CO₂ reduced
                </p>
              </div>
              <button
                onClick={onClose}
                style={{
                  width: '100%', padding: '14px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
                  background: `linear-gradient(135deg,#0057e7,${A})`,
                  color: '#fff', fontSize: 14, fontWeight: 700,
                  boxShadow: '0 4px 20px rgba(0,190,255,0.3)',
                }}
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
