// ── Welcome Back ─────────────────────────────────────────────────────────────
// Auto-celebration transition between login and the consumer dashboard.
// Avatar + glow + sparkles + confetti + greeting. Auto-redirects after exactly
// 3s. NO BUTTONS — fully autonomous, no user interaction required.
//
// THE TIMER MUST NEVER BE CANCELLED BY UNRELATED RE-RENDERS.
// An earlier version combined the celebration trigger and the redirect timer
// in one effect with multiple deps (user/role/profile/etc.). When the auth
// store hydrated after mount, deps changed → cleanup cleared the timer → the
// `celebratedRef` guard then bailed → no new timer was scheduled → redirect
// never fired. The fix below splits them: redirect uses an EMPTY dep array
// (mount-only), the navigate function is captured via a ref so it stays
// current, and a hard-nav safety net fires if React Router is somehow
// swallowed by an upstream guard.

import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { GlassCard } from '../components/ui/GlassCard'
import { celebrate, playPop } from '../lib/celebrate'
import { AvatarBurst, SparkleLayer } from '../components/Celebration'

// Default destination if the caller didn't pass ?to=… (e.g. someone visits
// /welcome-back directly). Consumers were historically the only role here,
// so consumer dashboard is the safe fallback.
const DEFAULT_REDIRECT = '/dashboard/consumer'
const AUTO_DELAY_MS    = 3000
const FALLBACK_MS      = 500     // hard-nav if still on this URL after navigate()

// Whitelist of allowed destinations. Prevents an attacker constructing
// /welcome-back?to=https://evil.example.com or ?to=//evil.example.com from
// hijacking the redirect via this hop.
const ALLOWED_DESTINATIONS = new Set([
  '/dashboard/consumer',
  '/dashboard/driver',
  '/dashboard/warehouse',
  '/dashboard/warehouse-supervisor',
  '/dashboard/admin',
  '/dashboard/partner',
  '/dashboard/fundraiser',
  // Driver flow lands on the mode selector first (or directly into the last
  // chosen mode landing if RealLoginPage decided to skip the selector).
  '/driver/mode',
  '/driver/residential',
  '/driver/commercial',
])

function isImageUrl(v?: string | null): boolean {
  return !!v && /^https?:\/\//i.test(v)
}

export default function WelcomeBack() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { user, profile, isLoading } = useAuthStore()
  const [redirecting, setRedirecting] = useState(false)

  // Capture the destination ONCE at mount via a ref so the empty-deps redirect
  // effect can't re-arm on later renders. The bulletproof timer pattern from
  // the prior fix depends on never re-running this effect, so anything the
  // effect reads must be ref-stable.
  const rawTo = params.get('to')
  const destination = rawTo && ALLOWED_DESTINATIONS.has(rawTo) ? rawTo : DEFAULT_REDIRECT
  const destinationRef = useRef(destination)

  // Stable navigate reference (same reason — captured into the empty-deps timer).
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate

  // ── 1. Mount-only auto-redirect timer ────────────────────────────────────
  // Empty deps → fires exactly once per real mount. React StrictMode in dev
  // will mount/unmount/mount; the cleanup clears the first timer, and the
  // second mount schedules a fresh 3s wait. Net effect: redirect fires once.

  useEffect(() => {
    const to = destinationRef.current
    console.log('[welcome-back] mounted', { destination: to })
    console.log('[welcome-back] auto redirect timer started')

    const primary = window.setTimeout(() => {
      setRedirecting(true)
      console.log('[welcome-back] redirecting to', to)
      navigateRef.current(to, { replace: true })

      // Safety fallback: if some upstream guard swallowed the React Router
      // navigation and we're STILL on /welcome-back after 500ms, force a
      // hard reload to the destination. Belt + suspenders.
      window.setTimeout(() => {
        if (typeof window !== 'undefined' && window.location.pathname === '/welcome-back') {
          console.warn('[welcome-back] navigate appears blocked — forcing window.location.href')
          window.location.href = to
        }
      }, FALLBACK_MS)
    }, AUTO_DELAY_MS)

    return () => {
      console.log('[welcome-back] unmount — clearing timer')
      window.clearTimeout(primary)
    }
  }, [])  // ← intentional: mount-only

  // ── 2. Confetti + pop (separate effect, ref-guarded for StrictMode) ──────

  const celebratedRef = useRef(false)
  useEffect(() => {
    if (celebratedRef.current) return
    celebratedRef.current = true
    const t = window.setTimeout(() => {
      playPop()
      console.log('[welcome-back] sound played')
      celebrate()
      console.log('[welcome-back] confetti fired')
    }, 180)
    return () => window.clearTimeout(t)
  }, [])

  // ── 3. No-session bounce (independent of the timer above) ────────────────

  useEffect(() => {
    if (!isLoading && !user) navigate('/real-login', { replace: true })
  }, [isLoading, user, navigate])

  const name = (profile?.full_name ?? '').split(' ')[0] || 'friend'
  const avatar = (profile as { avatar_url?: string | null } | null)?.avatar_url ?? ''
  const isImg = isImageUrl(avatar)

  return (
    <div
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-5 py-10"
      style={{
        background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)',
        opacity: redirecting ? 0 : 1,
        transition: 'opacity 0.3s ease',
      }}
    >
      <div className="pointer-events-none absolute inset-0 grid-bg" />
      <div className="pointer-events-none absolute" style={{ top: -80, left: -60, width: 280, height: 280, background: 'rgba(0,87,231,0.22)', filter: 'blur(72px)', borderRadius: '50%' }} />
      <div className="pointer-events-none absolute" style={{ bottom: -60, right: -40, width: 220, height: 220, background: 'rgba(94,234,212,0.1)', filter: 'blur(64px)', borderRadius: '50%' }} />

      <div className="relative w-full max-w-md" style={{ zIndex: 1 }}>
        <GlassCard padding="none" className="w-full px-6 py-10 text-center">
          {/* Avatar (bounce-in + glow) surrounded by silver sparkles */}
          <div style={{ position: 'relative', height: 160, marginBottom: 22 }}>
            <SparkleLayer count={14} radius={108} />
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <AvatarBurst avatar={isImg ? avatar : (avatar || '♻️')} size={112} />
            </div>
          </div>

          {/* Greeting + short message — no buttons, no interaction */}
          <div style={{ animation: 'fadeSlideUp 0.5s ease both', animationDelay: '0.3s' }}>
            <h1 style={{
              fontSize: 26, fontWeight: 700, color: '#ffffff', marginBottom: 8,
              lineHeight: 1.25,
            }}>
              Welcome back, {name}!
            </h1>
            <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.6)', lineHeight: 1.55 }}>
              Let&apos;s make today greener.
            </p>
          </div>
        </GlassCard>
      </div>
    </div>
  )
}
