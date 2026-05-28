// ── Celebration helpers ──────────────────────────────────────────────────────
// Shared between WelcomeBack and the onboarding Done step. Wrapped in
// try/catch so a missing AudioContext / blocked autoplay / canvas-confetti
// failure never breaks the celebration screen — it just degrades silently.
//
// Colour palette per spec: cyan blue, hazel green, silver sparkle (+ a teal
// accent so the burst doesn't look monochrome).

import confetti from 'canvas-confetti'

const CONFETTI_COLORS = [
  '#00c8ff', // cyan blue
  '#8FBC8F', // hazel green
  '#C0C0C0', // silver
  '#5eead4', // teal accent
]

/** Single staggered confetti burst lasting ~1s. Safe to call from a click. */
export function burstConfetti(): void {
  try {
    console.log('[celebrate] confetti triggered')
    // Centre burst
    confetti({
      particleCount: 70,
      spread:        80,
      startVelocity: 38,
      origin:        { y: 0.55 },
      colors:        CONFETTI_COLORS,
      scalar:        0.9,
    })
    // Side bursts for fullness
    window.setTimeout(() => {
      confetti({
        particleCount: 40, spread: 100, startVelocity: 32,
        origin: { x: 0.2, y: 0.5 }, colors: CONFETTI_COLORS, scalar: 0.8,
      })
    }, 220)
    window.setTimeout(() => {
      confetti({
        particleCount: 40, spread: 100, startVelocity: 32,
        origin: { x: 0.8, y: 0.5 }, colors: CONFETTI_COLORS, scalar: 0.8,
      })
    }, 360)
    // Sparkle stars at the end
    window.setTimeout(() => {
      confetti({
        particleCount: 30, spread: 120, startVelocity: 28,
        origin: { y: 0.55 }, colors: CONFETTI_COLORS,
        shapes: ['star'], scalar: 1.0,
      })
    }, 600)
  } catch (e) {
    console.warn('[celebrate] confetti failed:', e)
  }
}

/**
 * Synthesised pop sound — short rising tone, no audio asset needed.
 * Modern browsers require a recent user gesture to allow audio. WelcomeBack
 * runs right after the user submits the login form, and the onboarding Done
 * step runs right after the user clicks through the final step, so both have
 * an active gesture and will not be blocked.
 */
export function playPop(): void {
  try {
    interface AudioCtor { new (): AudioContext }
    const Ctor = (window.AudioContext
      ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext) as AudioCtor | undefined
    if (!Ctor) return
    const ctx = new Ctor()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(220, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.09)
    gain.gain.setValueAtTime(0.25, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22)
    osc.start()
    osc.stop(ctx.currentTime + 0.25)
    osc.onended = () => { try { ctx.close() } catch { /* already closed */ } }
  } catch (e) {
    console.warn('[celebrate] pop sound failed:', e)
  }
}

/** Convenience: pop + confetti together. */
export function celebrate(): void {
  playPop()
  burstConfetti()
}
