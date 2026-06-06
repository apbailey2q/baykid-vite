/**
 * PWAInstallPrompt
 *
 * Shows an "Add to Home Screen" banner when the browser signals that the app
 * can be installed.  Listens for the `beforeinstallprompt` event (Chrome /
 * Edge / Android) and hides itself automatically on iOS (which uses its own
 * Share-sheet flow) and when the app is already running in standalone mode.
 *
 * The banner is rendered at the bottom of the screen above the BottomNav so
 * it never obscures content.
 */

import { useEffect, useState } from 'react'

// ── Type augmentation for the non-standard browser event ─────────────────────

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PWAInstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed]     = useState(false)
  const [installed, setInstalled]     = useState(false)

  // Detect standalone mode once on mount — avoids re-creating a MediaQueryList on every render.
  const [isStandalone, setIsStandalone] = useState(false)
  useEffect(() => {
    setIsStandalone(
      window.matchMedia('(display-mode: standalone)').matches ||
      ('standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true),
    )
  }, [])

  useEffect(() => {
    if (isStandalone) return   // Already running as installed app

    const handler = (e: Event) => {
      e.preventDefault()
      setPromptEvent(e as BeforeInstallPromptEvent)
    }

    const installedHandler = () => setInstalled(true)

    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', installedHandler)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installedHandler)
    }
  }, [isStandalone])

  const handleInstall = async () => {
    if (!promptEvent) return
    await promptEvent.prompt()
    const choice = await promptEvent.userChoice
    if (choice.outcome === 'accepted') setInstalled(true)
    setPromptEvent(null)
  }

  const handleDismiss = () => {
    setDismissed(true)
    setPromptEvent(null)
  }

  // Don't render if: no prompt, already installed, dismissed, or in standalone mode
  if (!promptEvent || dismissed || installed || isStandalone) return null

  return (
    <div
      role="region"
      aria-label="Install app prompt"
      style={{
        position:       'fixed',
        bottom:         'calc(env(safe-area-inset-bottom, 0px) + 70px)', // above BottomNav
        left:           12,
        right:          12,
        zIndex:         50,
        background:     'rgba(6,14,36,0.97)',
        border:         '1px solid rgba(0,200,255,0.3)',
        borderRadius:   18,
        boxShadow:      '0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,200,255,0.1)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        padding:        '14px 16px',
        display:        'flex',
        alignItems:     'center',
        gap:            12,
        animation:      'fadeSlideUp 0.3s ease both',
      }}
    >
      {/* App icon */}
      <img
        src="/icon-192.png"
        alt=""
        aria-hidden="true"
        style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0 }}
      />

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 800, color: '#fff', lineHeight: 1.3, marginBottom: 2 }}>
          Add to Home Screen
        </p>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.4 }}>
          Install for faster access and offline support
        </p>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <button
          onClick={handleDismiss}
          aria-label="Dismiss install prompt"
          style={{
            background:   'rgba(255,255,255,0.07)',
            border:       '1px solid rgba(255,255,255,0.12)',
            borderRadius: 10,
            color:        'rgba(255,255,255,0.45)',
            fontSize:     12,
            fontWeight:   700,
            padding:      '7px 12px',
            cursor:       'pointer',
          }}
        >
          Not now
        </button>
        <button
          onClick={() => void handleInstall()}
          aria-label="Install the app"
          style={{
            background:   'linear-gradient(135deg,#0057e7,#00c8ff)',
            border:       'none',
            borderRadius: 10,
            color:        '#fff',
            fontSize:     12,
            fontWeight:   800,
            padding:      '7px 14px',
            cursor:       'pointer',
            boxShadow:    '0 2px 12px rgba(0,190,255,0.35)',
          }}
        >
          Install
        </button>
      </div>
    </div>
  )
}
