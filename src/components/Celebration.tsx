// ── Celebration primitives ───────────────────────────────────────────────────
// Shared between WelcomeBack and the onboarding Done step. Three pieces:
//   • AvatarBurst     — circle with bounce-in (badgePop) + pulsing glow ring
//   • SparkleLayer    — 12 silver twinkles drifting around the avatar
//   • RotatingMessage — crossfades between an array of messages on a timer
//
// Confetti + pop sound live in lib/celebrate.ts (call celebrate() on mount).

import { useEffect, useMemo, useState } from 'react'

// ── AvatarBurst ──────────────────────────────────────────────────────────────

export function AvatarBurst({ avatar, size = 112 }: { avatar: string; size?: number }) {
  const isImg = !!avatar && /^https?:\/\//i.test(avatar)
  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      {/* Soft pulsing glow ring */}
      <span style={{
        position: 'absolute', inset: -Math.round(size * 0.16),
        background: 'radial-gradient(circle, rgba(0,200,255,0.5), transparent 70%)',
        filter: 'blur(20px)',
        animation: 'glowPulse 2.4s ease-in-out infinite',
        pointerEvents: 'none',
      }} />
      {/* Avatar circle — bounce-in via the existing badgePop keyframe */}
      <span style={{
        position: 'relative',
        width: size, height: size, borderRadius: '50%',
        background: 'rgba(0,200,255,0.08)',
        border: '2px solid rgba(0,200,255,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: Math.round(size * 0.5), overflow: 'hidden',
        boxShadow: '0 12px 40px rgba(0,87,231,0.35)',
        animation: 'badgePop 0.9s cubic-bezier(.5,1.6,.4,1) both',
      }}>
        {isImg
          ? <img src={avatar} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : (avatar || '✨')}
      </span>
    </div>
  )
}

// ── SparkleLayer ─────────────────────────────────────────────────────────────
// 12 small silver dots positioned in a ring around the centre. Each fades in,
// scales up, then fades out on a staggered loop. The CSS keyframe is injected
// once via a module-level <style> so we don't have to touch index.css.

const SPARKLE_STYLE_ID = 'celebration-sparkle-keyframes'

function ensureSparkleStyles() {
  if (typeof document === 'undefined') return
  if (document.getElementById(SPARKLE_STYLE_ID)) return
  const el = document.createElement('style')
  el.id = SPARKLE_STYLE_ID
  el.textContent = `
    @keyframes celebrationTwinkle {
      0%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(0.2); }
      50%      { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    }
  `
  document.head.appendChild(el)
}

export function SparkleLayer({ count = 12, radius = 110 }: { count?: number; radius?: number }) {
  useEffect(ensureSparkleStyles, [])

  // Stable random distribution per mount so the sparkles don't jitter on re-renders.
  const sparkles = useMemo(() => {
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4
      const r     = radius * (0.7 + Math.random() * 0.4)
      const size  = 3 + Math.random() * 4
      const delay = Math.random() * 1.6
      const dur   = 1.4 + Math.random() * 1.0
      return {
        x: Math.cos(angle) * r,
        y: Math.sin(angle) * r,
        size, delay, dur,
      }
    })
  }, [count, radius])

  return (
    <div
      aria-hidden
      style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <div style={{ position: 'relative', width: 0, height: 0 }}>
        {sparkles.map((s, i) => (
          <span
            key={i}
            style={{
              position: 'absolute',
              left: s.x, top: s.y,
              width: s.size, height: s.size,
              borderRadius: '50%',
              background: '#E8E8EE',
              boxShadow: '0 0 6px rgba(232,232,238,0.95), 0 0 12px rgba(192,192,192,0.55)',
              opacity: 0,
              animation: `celebrationTwinkle ${s.dur}s ease-in-out ${s.delay}s infinite`,
              transformOrigin: 'center',
            }}
          />
        ))}
      </div>
    </div>
  )
}

// ── RotatingMessage ──────────────────────────────────────────────────────────
// Crossfades through an ordered list of headlines on a timer. Last message
// stays visible after the rotation completes.

export function RotatingMessage({
  messages, intervalMs = 1400, fadeMs = 320,
  style,
}: {
  messages: string[]
  intervalMs?: number
  fadeMs?: number
  style?: React.CSSProperties
}) {
  const [idx, setIdx] = useState(0)
  useEffect(() => {
    if (messages.length <= 1) return
    const id = window.setInterval(() => {
      setIdx(i => Math.min(i + 1, messages.length - 1))
    }, intervalMs)
    return () => window.clearInterval(id)
  }, [messages.length, intervalMs])

  return (
    <div style={{ position: 'relative', minHeight: '1.2em', ...style }}>
      {messages.map((m, i) => (
        <span
          key={i}
          style={{
            position: i === idx ? 'relative' : 'absolute',
            inset: 0,
            opacity: i === idx ? 1 : 0,
            transition: `opacity ${fadeMs}ms ease`,
            pointerEvents: 'none',
          }}
        >
          {m}
        </span>
      ))}
    </div>
  )
}
