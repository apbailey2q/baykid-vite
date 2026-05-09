import { useState, useEffect, useRef } from 'react'

const IMPACT_STATS = {
  bagsRecycled:      12980,
  co2Saved:          21480,
  rewardsPaid:       18450.75,
  fundraiserRaised:  128450,
}

type Metric = {
  key:    keyof typeof IMPACT_STATS
  label:  string
  icon:   string
  prefix: string
  suffix: string
  color:  string
  bg:     string
  border: string
  decimals?: number
}

const METRICS: Metric[] = [
  { key: 'bagsRecycled',     label: 'Bags Recycled',     icon: '♻️', prefix: '',  suffix: '',    color: '#00c8ff', bg: 'rgba(0,200,255,0.07)',  border: 'rgba(0,200,255,0.18)'  },
  { key: 'co2Saved',         label: 'CO₂ Saved (lbs)',  icon: '🌿', prefix: '',  suffix: ' lbs', color: '#5eead4', bg: 'rgba(94,234,212,0.07)', border: 'rgba(94,234,212,0.18)' },
  { key: 'rewardsPaid',      label: 'Rewards Paid',      icon: '💰', prefix: '$', suffix: '',    color: '#fbbf24', bg: 'rgba(251,191,36,0.07)', border: 'rgba(251,191,36,0.18)', decimals: 2 },
  { key: 'fundraiserRaised', label: 'Fundraiser Raised', icon: '🌱', prefix: '$', suffix: '',    color: '#4ade80', bg: 'rgba(34,197,94,0.07)',  border: 'rgba(34,197,94,0.18)'  },
]

function fmtNum(n: number, decimals = 0): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function useCountUp(target: number, duration: number, enabled: boolean) {
  const [val, setVal] = useState(0)
  const raf = useRef<number>(0)

  useEffect(() => {
    if (!enabled) return
    const start = performance.now()
    const tick = (now: number) => {
      const p    = Math.min((now - start) / duration, 1)
      const ease = 1 - Math.pow(1 - p, 3)
      setVal(ease * target)
      if (p < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [target, duration, enabled])

  return val
}

function MetricCell({ metric, enabled }: { metric: Metric; enabled: boolean }) {
  const raw = useCountUp(IMPACT_STATS[metric.key], 1500, enabled)
  const decimals = metric.decimals ?? 0
  const display  = `${metric.prefix}${fmtNum(raw, decimals)}${metric.suffix}`

  return (
    <div
      className="flex flex-col items-center gap-1.5 py-4 px-2 rounded-2xl"
      style={{ background: metric.bg, border: `1px solid ${metric.border}` }}
    >
      <span style={{ fontSize: 20 }}>{metric.icon}</span>
      <p style={{ fontSize: 17, fontWeight: 800, color: metric.color, letterSpacing: '-0.02em', lineHeight: 1 }}>
        {display}
      </p>
      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', textAlign: 'center', lineHeight: 1.3 }}>
        {metric.label}
      </p>
    </div>
  )
}

interface LiveImpactCounterProps {
  className?: string
  style?: React.CSSProperties
}

export default function LiveImpactCounter({ className, style }: LiveImpactCounterProps) {
  const [visible, setVisible] = useState(false)
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    const t1 = requestAnimationFrame(() => setVisible(true))
    const t2 = setTimeout(() => setEnabled(true), 100)
    return () => { cancelAnimationFrame(t1); clearTimeout(t2) }
  }, [])

  return (
    <div
      className={className}
      style={{
        opacity:    visible ? 1 : 0,
        transform:  visible ? 'translateY(0)' : 'translateY(14px)',
        transition: 'opacity 0.45s ease, transform 0.45s ease',
        ...style,
      }}
    >
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background:    'rgba(255,255,255,0.04)',
          border:        '1px solid rgba(0,200,255,0.18)',
          backdropFilter: 'blur(12px)',
          boxShadow:     '0 4px 32px rgba(0,87,231,0.12)',
        }}
      >
        {/* Header bar */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: '#4ade80', animation: 'licPulse 1.6s ease-in-out infinite', boxShadow: '0 0 5px rgba(74,222,128,0.7)' }}
            />
            <span
              className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80' }}
            >
              LIVE
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#ffffff' }}>Impact Counter</span>
          </div>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>Systemwide</span>
        </div>

        {/* Metric grid */}
        <div className="grid grid-cols-2 gap-2 p-3">
          {METRICS.map((m) => (
            <MetricCell key={m.key} metric={m} enabled={enabled} />
          ))}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-center gap-1.5 px-4 py-2.5"
          style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
        >
          <div
            className="w-1 h-1 rounded-full"
            style={{ background: '#00c8ff', animation: 'licPulse 2s ease-in-out infinite 0.5s' }}
          />
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
            Systemwide impact updating in real time
          </p>
        </div>
      </div>

      <style>{`
        @keyframes licPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.4; transform: scale(0.75); }
        }
      `}</style>
    </div>
  )
}
