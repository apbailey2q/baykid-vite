import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { getAppMode } from '../lib/mode'
import { useAuthStore } from '../store/authStore'

// Thin always-mounted banner. Recomputes mode on every route change and on
// auth-store changes, since isDemoMode() depends on both the localStorage flag
// and whether a real user is signed in.
export function ModeBanner() {
  const location = useLocation()
  const user = useAuthStore(s => s.user)
  const [mode, setMode] = useState(getAppMode())

  useEffect(() => {
    setMode(getAppMode())
  }, [location.pathname, user])

  const demo = mode === 'demo'

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 99999,
        height: 22,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        pointerEvents: 'none',
        color: demo ? '#0a0a0a' : 'rgba(255,255,255,0.85)',
        background: demo ? '#fbbf24' : 'rgba(0,200,255,0.16)',
        borderBottom: demo
          ? '1px solid rgba(0,0,0,0.2)'
          : '1px solid rgba(0,200,255,0.3)',
      }}
    >
      {demo ? '⚠ DEMO MODE — mock data, no live writes' : 'LIVE APP'}
    </div>
  )
}
