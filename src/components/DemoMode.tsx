import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────
type Stage =
  | 'consumer-dash' | 'consumer-scan' | 'consumer-qr' | 'consumer-notify'
  | 'trans-driver'
  | 'driver-dash' | 'driver-pickup' | 'driver-manifest' | 'driver-enroute'
  | 'trans-warehouse'
  | 'wh-dash' | 'wh-check' | 'wh-approved'
  | 'trans-reward'
  | 'reward-count' | 'reward-recap'
  | 'done'

interface Props { onClose: () => void }

// ── Sequence (absolute ms from start) ────────────────────────────────────────
const TOTAL_MS = 120_000

// ── Mock data ─────────────────────────────────────────────────────────────────
const C_NAME   = 'Alexis Carter'
const D_NAME   = 'Marcus Webb'
const BAG_CODE = 'BAG-2024-00847'

const STOPS = [
  { addr: '123 Oak St',    bags: 2, active: true  },
  { addr: '456 Maple Ave', bags: 1, active: false },
  { addr: '789 Pine Blvd', bags: 3, active: false },
]

const MANIFEST_BAGS = [
  { code: 'BAG-2024-00847', type: 'Mixed Plastics' },
  { code: 'BAG-2024-00831', type: 'Glass Bottles'  },
  { code: 'BAG-2024-00819', type: 'Paper / Card'   },
]

const INSPECTION_CHECKS = [
  'Weight verification',
  'Contents inspection',
  'Contamination scan',
  'Condition rating',
]

// ── Design tokens ─────────────────────────────────────────────────────────────
const BG  = '#07111f'
const A   = '#38bdf8'   // accent
const S   = '#4ade80'   // success
const GL  = 'rgba(255,255,255,0.06)'
const BD  = 'rgba(56,189,248,0.2)'

// ── Deterministic confetti pieces ─────────────────────────────────────────────
const CONFETTI_COLORS = ['#38bdf8', '#4ade80', '#fb923c', '#f472b6', '#facc15']
const CONFETTI_PIECES = Array.from({ length: 24 }, (_, i) => ({
  left:  `${(i * 41 + 7) % 97}%`,
  delay: ((i * 13) % 80) / 100,
  dur:   1.6 + ((i * 7) % 14) / 10,
  color: CONFETTI_COLORS[i % 5],
  rot:   (i * 53) % 360,
}))

// ── Shared primitives ─────────────────────────────────────────────────────────
function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 16, padding: '14px 18px', ...style }}>
      {children}
    </div>
  )
}

function Row({ label, val, color }: { label: string; val: string; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' as const, letterSpacing: '0.07em' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: color ?? '#fff' }}>{val}</span>
    </div>
  )
}

function CircleCheck({ size = 48, color = S }: { size?: number; color?: string }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `rgba(74,222,128,0.12)`, border: `2px solid ${color}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <svg width={size * 0.46} height={size * 0.46} viewBox="0 0 24 24" fill="none"
        stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </div>
  )
}

function ScanViewfinder({ size = 200 }: { size?: number }) {
  return (
    <div style={{
      position: 'relative', width: size, height: size,
      border: `2px solid ${A}`, borderRadius: 14, overflow: 'hidden',
      background: 'rgba(56,189,248,0.04)',
    }}>
      {/* Corner brackets */}
      {([
        { top: 0, left: 0 },
        { top: 0, right: 0 },
        { bottom: 0, left: 0 },
        { bottom: 0, right: 0 },
      ] as CSSProperties[]).map((pos, i) => (
        <div key={i} style={{
          position: 'absolute', ...pos, width: 22, height: 22,
          borderTop:    i < 2    ? `3px solid ${A}` : undefined,
          borderBottom: i >= 2   ? `3px solid ${A}` : undefined,
          borderLeft:   i % 2 === 0 ? `3px solid ${A}` : undefined,
          borderRight:  i % 2 === 1 ? `3px solid ${A}` : undefined,
        }} />
      ))}
      {/* Animated scan line */}
      <div style={{
        position: 'absolute', left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, transparent, ${A}, transparent)`,
        boxShadow: `0 0 10px ${A}`,
        animation: 'scanLine 1.8s ease-in-out infinite',
      }} />
      {/* Faint QR grid */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.15 }}>
        <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke={A} strokeWidth="1.2">
          <rect x="3" y="3" width="5" height="5" rx="0.5" />
          <rect x="3" y="16" width="5" height="5" rx="0.5" />
          <rect x="16" y="3" width="5" height="5" rx="0.5" />
          <rect x="9" y="9" width="6" height="6" rx="0.5" />
        </svg>
      </div>
    </div>
  )
}

function Dots3({ color = A }: { color?: string }) {
  return (
    <div style={{ display: 'flex', gap: 5 }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 6, height: 6, borderRadius: '50%', background: color,
          animation: `dotPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
    </div>
  )
}

function Confetti() {
  return (
    <div className="pointer-events-none fixed inset-0" style={{ zIndex: 400 }}>
      {CONFETTI_PIECES.map((p, i) => (
        <div key={i} style={{
          position: 'absolute', left: p.left, top: -20,
          width: 7, height: 12, borderRadius: 2,
          background: p.color, transform: `rotate(${p.rot}deg)`,
          animation: `confettiFall ${p.dur}s ease-in ${p.delay}s both`,
        }} />
      ))}
    </div>
  )
}

// ── Stage label helper ────────────────────────────────────────────────────────
function stageLabel(s: Stage): string {
  if (s === 'trans-driver')    return 'Switching roles…'
  if (s === 'trans-warehouse') return 'Switching roles…'
  if (s === 'trans-reward')    return 'Back to consumer…'
  if (s.startsWith('driver'))  return `Driver — ${D_NAME}`
  if (s.startsWith('wh'))      return 'Warehouse Inspector'
  if (s.startsWith('reward'))  return `Consumer — ${C_NAME}`
  return `Consumer — ${C_NAME}`
}

// ═════════════════════════════════════════════════════════════════════════════
// Stage view components
// ═════════════════════════════════════════════════════════════════════════════

function ConsumerDashView() {
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, animation: 'fadeSlideUp 0.35s ease both' }}>
      <div>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>Good morning,</p>
        <p style={{ fontSize: 26, fontWeight: 700, color: '#fff' }}>{C_NAME} 👋</p>
      </div>

      <Card>
        <p style={{ fontSize: 11, color: `rgba(56,189,248,0.7)`, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total Points</p>
        <p style={{ fontSize: 38, fontWeight: 800, color: A, marginTop: 2 }}>
          240 <span style={{ fontSize: 16, color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}>pts</span>
        </p>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>= $4.80 cash value</p>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Card>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Bags Pending</p>
          <p style={{ fontSize: 30, fontWeight: 700, color: '#fff', marginTop: 4 }}>2</p>
        </Card>
        <Card>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Last Pickup</p>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginTop: 6 }}>3 days ago</p>
        </Card>
      </div>

      {/* Pulsing Scan button — simulates auto-click */}
      <button style={{
        width: '100%', padding: '14px 0', borderRadius: 14, border: 'none',
        background: `linear-gradient(135deg, #0057e7, ${A})`,
        color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'default',
        boxShadow: `0 4px 24px rgba(56,189,248,0.4), 0 0 0 5px rgba(56,189,248,0.1)`,
        animation: 'glowPulse 1.6s ease-in-out infinite',
      }}>
        ⬛ Scan Bag →
      </button>
    </div>
  )
}

function ConsumerScanView() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 16px', gap: 20, animation: 'fadeSlideUp 0.35s ease both' }}>
      <p style={{ fontSize: 13, color: A, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Scanning QR Code</p>
      <ScanViewfinder size={220} />
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>Hold bag QR code in frame…</p>
      <Dots3 />
    </div>
  )
}

function ConsumerQRView() {
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14, animation: 'fadeSlideUp 0.35s ease both' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <CircleCheck size={52} />
        <div>
          <p style={{ fontSize: 17, fontWeight: 700, color: '#fff' }}>Bag Identified!</p>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>QR code scanned successfully</p>
        </div>
      </div>
      <Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Row label="Bag Code"  val={BAG_CODE}        color={A} />
          <Row label="Contents"  val="Mixed Plastics"             />
          <Row label="Weight"    val="2.3 kg"                     />
          <Row label="Status"    val="Awaiting Pickup"  color={A} />
        </div>
      </Card>
      <div style={{ padding: '10px 14px', borderRadius: 12, background: 'rgba(56,189,248,0.08)', border: `1px solid ${BD}`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 18 }}>🚐</span>
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>Driver being matched…</p>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Finding nearest available driver</p>
        </div>
      </div>
    </div>
  )
}

function ConsumerNotifyView() {
  const timeline = [
    { label: 'Bag Scanned',     done: true  },
    { label: 'Driver Assigned', done: true  },
    { label: 'En Route',        done: false },
  ]
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14, animation: 'fadeSlideUp 0.35s ease both' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 0', gap: 14 }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: 'rgba(74,222,128,0.12)', border: `2px solid ${S}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 0 28px rgba(74,222,128,0.3)`,
          animation: 'glowPulse 2s ease-in-out infinite',
        }}>
          <span style={{ fontSize: 34 }}>🚐</span>
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>Driver Notified!</p>
          <p style={{ fontSize: 13, color: S, marginTop: 3 }}>{D_NAME} is on the way</p>
        </div>
      </div>
      <Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {timeline.map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                background: item.done ? 'rgba(74,222,128,0.15)' : GL,
                border: `1.5px solid ${item.done ? S : 'rgba(255,255,255,0.12)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {item.done && (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={S} strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
              <span style={{ flex: 1, fontSize: 13, color: item.done ? '#fff' : 'rgba(255,255,255,0.4)' }}>{item.label}</span>
              {!item.done && <div style={{ width: 7, height: 7, borderRadius: '50%', background: A, animation: 'dotPulse 1.2s ease-in-out infinite' }} />}
            </div>
          ))}
        </div>
      </Card>
      <p style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>Estimated arrival: ~15 min</p>
    </div>
  )
}

function TransitionView({ icon, label }: { icon: string; label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '62vh', animation: 'fadeSlideUp 0.35s ease both' }}>
      <div style={{ fontSize: 54, marginBottom: 16, animation: 'badgePop 0.5s ease both' }}>{icon}</div>
      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>Switching to</p>
      <p style={{ fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 24 }}>{label}</p>
      <Dots3 />
    </div>
  )
}

function DriverDashView() {
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, animation: 'fadeSlideUp 0.35s ease both' }}>
      <div>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>Driver Dashboard</p>
        <p style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>{D_NAME}</p>
      </div>
      <div style={{ padding: '10px 14px', borderRadius: 12, background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.25)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: S, boxShadow: `0 0 8px ${S}`, animation: 'dotPulse 1.2s ease-in-out infinite' }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: S }}>Route Active — 3 stops</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {STOPS.map((stop, i) => (
          <Card key={i} style={{
            border: stop.active ? `1px solid rgba(56,189,248,0.55)` : `1px solid ${BD}`,
            background: stop.active ? 'rgba(56,189,248,0.07)' : GL,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                  background: stop.active ? 'rgba(56,189,248,0.15)' : GL,
                  border: `1.5px solid ${stop.active ? A : 'rgba(255,255,255,0.12)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, color: stop.active ? A : 'rgba(255,255,255,0.35)',
                }}>
                  {i + 1}
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: stop.active ? '#fff' : 'rgba(255,255,255,0.45)' }}>{stop.addr}</p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{stop.bags} bag{stop.bags !== 1 ? 's' : ''}</p>
                </div>
              </div>
              {stop.active && <span style={{ fontSize: 10, fontWeight: 700, color: A, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Active</span>}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

function DriverPickupView() {
  const [phase, setPhase] = useState<'photo' | 'qr' | 'done'>('photo')

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('qr'),   7_000)
    const t2 = setTimeout(() => setPhase('done'), 12_000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  if (phase === 'done') {
    return (
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, paddingTop: 40, animation: 'fadeSlideUp 0.35s ease both' }}>
        <CircleCheck size={60} />
        <p style={{ fontSize: 17, fontWeight: 700, color: '#fff' }}>Pickup Complete!</p>
        <Card style={{ width: '100%' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Row label="Bag Code" val={BAG_CODE}       color={A} />
            <Row label="Contents" val="Mixed Plastics"            />
            <Row label="Weight"   val="2.3 kg"                    />
          </div>
        </Card>
      </div>
    )
  }

  if (phase === 'qr') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '36px 16px', gap: 20, animation: 'fadeSlideUp 0.35s ease both' }}>
        <p style={{ fontSize: 13, color: A, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Confirm Bag Code</p>
        <ScanViewfinder size={180} />
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Scanning bag label…</p>
      </div>
    )
  }

  // photo phase
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '36px 16px', gap: 20, animation: 'fadeSlideUp 0.35s ease both' }}>
      <p style={{ fontSize: 13, color: A, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Photo Capture</p>
      <div style={{
        width: 200, height: 200, borderRadius: 16, overflow: 'hidden',
        background: 'rgba(56,189,248,0.05)', border: `2px dashed rgba(56,189,248,0.3)`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14,
      }}>
        <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke={A} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
          <circle cx="12" cy="13" r="3" />
        </svg>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Capturing bag photo…</p>
        <Dots3 />
      </div>
    </div>
  )
}

function DriverManifestView() {
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, animation: 'fadeSlideUp 0.35s ease both' }}>
      <div style={{ padding: '10px 14px', borderRadius: 12, background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.25)' }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: S }}>✓ All Pickups Complete</p>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>3 bags collected — heading to warehouse</p>
      </div>
      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Cargo Manifest</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {MANIFEST_BAGS.map((bag, i) => (
          <Card key={i}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 20 }}>📦</span>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#fff', fontFamily: 'monospace' }}>{bag.code}</p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{bag.type}</p>
                </div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={S} strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

function DriverEnrouteView() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '62vh', animation: 'fadeSlideUp 0.35s ease both' }}>
      <div style={{ fontSize: 50, marginBottom: 16, animation: 'floatBob 2.5s ease-in-out infinite' }}>🏭</div>
      <p style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 6 }}>En Route to Warehouse</p>
      <p style={{ fontSize: 13, color: A, marginBottom: 20 }}>ETA: ~12 minutes</p>
      <div style={{ padding: '8px 20px', borderRadius: 20, background: 'rgba(56,189,248,0.08)', border: `1px solid ${BD}` }}>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>3 bags on board · 0 remaining stops</p>
      </div>
    </div>
  )
}

function WHDashView() {
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, animation: 'fadeSlideUp 0.35s ease both' }}>
      <div>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>Warehouse Dashboard</p>
        <p style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>Incoming Bags</p>
      </div>
      <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(56,189,248,0.08)', border: `1px solid rgba(56,189,248,0.3)`, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 26, animation: 'floatBob 2s ease-in-out infinite' }}>🚐</span>
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>Driver arriving now</p>
          <p style={{ fontSize: 11, color: A }}>3 bags · {D_NAME}</p>
        </div>
      </div>
      <Card>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Priority Bag</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Row label="Code"            val={BAG_CODE}       color={A} />
          <Row label="Contents"        val="Mixed Plastics"            />
          <Row label="Action Required" val="Inspect ›"      color={A} />
        </div>
      </Card>
    </div>
  )
}

function WHCheckView({ step }: { step: number }) {
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14, animation: 'fadeSlideUp 0.35s ease both' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(56,189,248,0.1)', border: `1.5px solid ${BD}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: 18 }}>🔍</span>
        </div>
        <div>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Inspection: {BAG_CODE}</p>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Running automated checks…</p>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {INSPECTION_CHECKS.map((check, i) => {
          const done   = i < step
          const active = i === step
          return (
            <div key={i} style={{
              padding: '12px 16px', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: done ? 'rgba(74,222,128,0.08)' : active ? 'rgba(56,189,248,0.06)' : GL,
              border: `1px solid ${done ? 'rgba(74,222,128,0.3)' : active ? BD : 'rgba(255,255,255,0.06)'}`,
              transition: 'all 0.4s ease',
            }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: done ? S : active ? A : 'rgba(255,255,255,0.4)' }}>
                {check}
              </span>
              {done ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={S} strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : active ? (
                <div style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${A}`, borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
              ) : (
                <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function WHApprovedView() {
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14, animation: 'fadeSlideUp 0.35s ease both' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0', gap: 12 }}>
        <div style={{
          width: 68, height: 68, borderRadius: '50%',
          background: 'rgba(74,222,128,0.12)', border: `2px solid ${S}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 0 28px rgba(74,222,128,0.35)`,
          animation: 'badgePop 0.5s ease both',
        }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={S} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>Bag Approved</p>
          <p style={{ fontSize: 13, color: S, marginTop: 3 }}>All 4 checks passed</p>
        </div>
      </div>
      <Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {INSPECTION_CHECKS.map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>{c}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={S} strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          ))}
        </div>
      </Card>
      <div style={{ padding: '10px 14px', borderRadius: 12, background: 'rgba(56,189,248,0.08)', border: `1px solid ${BD}`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 18 }}>📱</span>
        <p style={{ fontSize: 13, color: '#fff', fontWeight: 500 }}>Consumer notified — reward pending</p>
      </div>
    </div>
  )
}

function RewardCountView({ points }: { points: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '65vh', animation: 'fadeSlideUp 0.35s ease both', padding: 16 }}>
      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 16 }}>
        Points Rewarded!
      </p>
      <div style={{
        padding: '24px 40px', borderRadius: 22,
        background: 'rgba(74,222,128,0.08)',
        border: `2px solid ${points >= 300 ? S : 'rgba(74,222,128,0.3)'}`,
        textAlign: 'center', marginBottom: 20,
        boxShadow: points >= 300 ? `0 0 36px rgba(74,222,128,0.35)` : 'none',
        transition: 'box-shadow 0.5s ease, border-color 0.5s ease',
      }}>
        <p style={{ fontSize: 56, fontWeight: 800, color: S, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
          {points}
        </p>
        <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.4)', marginTop: 6 }}>pts</p>
      </div>
      {points >= 280 && (
        <div style={{ textAlign: 'center', animation: 'fadeSlideUp 0.3s ease both' }}>
          <p style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>+60 pts added!</p>
          <p style={{ fontSize: 15, color: S, marginTop: 6 }}>Cash value: $6.00</p>
        </div>
      )}
    </div>
  )
}

function RewardRecapView() {
  const steps = [
    { icon: '♻️', label: 'Consumer Scanned Bag',  time: '0:00', color: A },
    { icon: '🚐', label: 'Driver Collected Bag',  time: '0:30', color: A },
    { icon: '🏭', label: 'Warehouse Inspected',   time: '1:05', color: A },
    { icon: '🎁', label: '60 pts Rewarded',        time: '1:35', color: S },
  ]
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14, animation: 'fadeSlideUp 0.35s ease both' }}>
      <div style={{ textAlign: 'center', paddingBottom: 4 }}>
        <p style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>Journey Complete! ♻️</p>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 5 }}>From curb to credit in 2 minutes</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {steps.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, background: GL, border: `1px solid ${BD}` }}>
            <span style={{ fontSize: 22, flexShrink: 0 }}>{s.icon}</span>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{s.label}</p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{s.time}</p>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={s.color} strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        ))}
      </div>
      <Card style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Final Balance</p>
        <p style={{ fontSize: 44, fontWeight: 800, color: S, marginTop: 4 }}>300 pts</p>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>= $6.00 cash value</p>
      </Card>
    </div>
  )
}

// ── Stage dispatcher ──────────────────────────────────────────────────────────
function StageView({ stage, checkStep, points }: { stage: Stage; checkStep: number; points: number }) {
  switch (stage) {
    case 'consumer-dash':    return <ConsumerDashView />
    case 'consumer-scan':    return <ConsumerScanView />
    case 'consumer-qr':      return <ConsumerQRView />
    case 'consumer-notify':  return <ConsumerNotifyView />
    case 'trans-driver':     return <TransitionView icon="🚐" label={`Driver — ${D_NAME}`} />
    case 'driver-dash':      return <DriverDashView />
    case 'driver-pickup':    return <DriverPickupView />
    case 'driver-manifest':  return <DriverManifestView />
    case 'driver-enroute':   return <DriverEnrouteView />
    case 'trans-warehouse':  return <TransitionView icon="🏭" label="Warehouse Inspector" />
    case 'wh-dash':          return <WHDashView />
    case 'wh-check':         return <WHCheckView step={checkStep} />
    case 'wh-approved':      return <WHApprovedView />
    case 'trans-reward':     return <TransitionView icon="♻️" label={`Consumer — ${C_NAME}`} />
    case 'reward-count':     return <RewardCountView points={points} />
    case 'reward-recap':     return <RewardRecapView />
    default:                 return null
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Main DemoMode component
// ═════════════════════════════════════════════════════════════════════════════
export default function DemoMode({ onClose }: Props) {
  const [stage,     setStage]     = useState<Stage>('consumer-dash')
  const [fade,      setFade]      = useState(true)
  const [elapsed,   setElapsed]   = useState(0)
  const [checkStep, setCheckStep] = useState(0)
  const [points,    setPoints]    = useState(240)

  const timersRef  = useRef<ReturnType<typeof setTimeout>[]>([])
  const tickRef    = useRef<ReturnType<typeof setInterval> | null>(null)

  const go = useCallback((s: Stage) => {
    setFade(false)
    setTimeout(() => { setStage(s); setFade(true) }, 200)
  }, [])

  // ── Sequence controller ───────────────────────────────────────────────────
  useEffect(() => {
    const ids = timersRef.current
    const at  = (ms: number, fn: () => void) => ids.push(setTimeout(fn, ms))

    at(0,          () => go('consumer-dash'))
    at(4_000,      () => go('consumer-scan'))
    at(12_000,     () => go('consumer-qr'))
    at(18_000,     () => go('consumer-notify'))
    at(28_000,     () => go('trans-driver'))
    at(32_000,     () => go('driver-dash'))
    at(38_000,     () => go('driver-pickup'))
    at(56_000,     () => go('driver-manifest'))
    at(62_000,     () => go('driver-enroute'))
    at(66_000,     () => go('trans-warehouse'))
    at(70_000,     () => go('wh-dash'))
    at(74_000,     () => { go('wh-check'); setCheckStep(0) })
    at(78_500,     () => setCheckStep(1))
    at(83_000,     () => setCheckStep(2))
    at(87_500,     () => setCheckStep(3))
    at(92_000,     () => setCheckStep(4))
    at(94_000,     () => go('wh-approved'))
    at(98_000,     () => go('trans-reward'))
    at(102_000,    () => go('reward-count'))
    at(115_000,    () => go('reward-recap'))
    at(120_000,    () => { go('done'); onClose() })

    tickRef.current = setInterval(() => {
      setElapsed(e => {
        const next = e + 500
        if (next >= TOTAL_MS) {
          clearInterval(tickRef.current!)
          return TOTAL_MS
        }
        return next
      })
    }, 500)

    return () => {
      ids.forEach(clearTimeout)
      if (tickRef.current) clearInterval(tickRef.current)
    }
  }, [go, onClose])

  // ── Points counter (fires when reward-count stage begins) ─────────────────
  useEffect(() => {
    if (stage !== 'reward-count') return
    setPoints(240)
    let v = 240
    const id = setInterval(() => {
      v = Math.min(v + 2, 300)
      setPoints(v)
      if (v >= 300) clearInterval(id)
    }, 200)
    return () => clearInterval(id)
  }, [stage])

  const progress = Math.min((elapsed / TOTAL_MS) * 100, 100)
  const showConfetti = stage === 'reward-count' || stage === 'reward-recap'

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden"
      style={{ background: BG, zIndex: 200 }}
    >
      {/* Grid overlay */}
      <div className="pointer-events-none absolute inset-0 grid-bg" style={{ opacity: 0.5 }} />

      {/* Top bar */}
      <header
        className="relative z-10 shrink-0 flex items-center justify-between px-4 py-3"
        style={{ background: 'rgba(7,17,31,0.92)', borderBottom: `1px solid ${BD}`, backdropFilter: 'blur(16px)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            padding: '2px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
            background: 'rgba(56,189,248,0.12)', border: `1px solid ${BD}`, color: A,
          }}>
            Demo
          </span>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
            {stageLabel(stage)}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}
          className="transition-opacity hover:opacity-80"
        >
          Skip ×
        </button>
      </header>

      {/* Progress bar */}
      <div className="shrink-0" style={{ height: 2, background: 'rgba(255,255,255,0.06)' }}>
        <div style={{
          height: '100%', width: `${progress}%`,
          background: `linear-gradient(90deg, #0057e7, ${A})`,
          transition: 'width 0.5s linear',
        }} />
      </div>

      {/* Stage content — fades on transition */}
      <div
        className="relative z-10 flex-1 overflow-y-auto"
        style={{ opacity: fade ? 1 : 0, transition: 'opacity 0.2s ease' }}
      >
        <div style={{ maxWidth: 430, margin: '0 auto' }}>
          <StageView stage={stage} checkStep={checkStep} points={points} />
        </div>
      </div>

      {/* Orb bottom-right */}
      <div className="pointer-events-none absolute" style={{ bottom: -60, right: -40, width: 220, height: 220, background: 'rgba(56,189,248,0.15)', filter: 'blur(64px)', borderRadius: '50%', zIndex: 0 }} />

      {showConfetti && <Confetti />}
    </div>
  )
}
