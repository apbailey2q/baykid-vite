import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { getUserRoles } from '../lib/roles'

type Props = {
  roles: string[]
  children: React.ReactNode
}

export function RequireRole({ roles, children }: Props) {
  const [checking, setChecking]       = useState(true)
  const [allowed, setAllowed]         = useState(false)
  const [userRoles, setUserRoles]     = useState<string[]>([])
  const rolesKey = roles.join(',')

  useEffect(() => {
    let mounted = true
    async function check() {
      setChecking(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!mounted) return
      if (!user) { setAllowed(false); setChecking(false); return }
      const fetched = await getUserRoles(user.id)
      if (!mounted) return
      setUserRoles(fetched)
      setAllowed(roles.some(r => fetched.includes(r)))
      setChecking(false)
    }
    check()
    return () => { mounted = false }
    // rolesKey is a stable string dep derived from the roles array
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rolesKey])

  if (checking) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}
      >
        <div
          className="h-7 w-7 rounded-full border-2 animate-spin"
          style={{ borderColor: 'rgba(0,200,255,0.2)', borderTopColor: '#00c8ff' }}
        />
      </div>
    )
  }

  if (!allowed) {
    const required = roles.join(' or ')
    const current  = userRoles.length > 0 ? userRoles.join(', ') : 'unknown'
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center px-6 text-center"
        style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}
      >
        <div
          className="rounded-2xl p-8 max-w-sm w-full"
          style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.25)' }}
        >
          <span style={{ fontSize: 40, display: 'block', marginBottom: 16 }}>🚫</span>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#ffffff', marginBottom: 8 }}>
            Access Denied
          </h2>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, marginBottom: 6 }}>
            This page requires <span style={{ color: '#f87171', fontWeight: 700 }}>{required}</span> access.
          </p>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginBottom: 24 }}>
            Your role: <span style={{ color: '#fbbf24', fontWeight: 600 }}>{current}</span>
          </p>
          <Link
            to="/"
            className="block py-3 rounded-2xl text-sm font-bold transition-all hover:brightness-110"
            style={{ background: 'rgba(0,200,255,0.1)', border: '1px solid rgba(0,200,255,0.3)', color: '#00c8ff', textDecoration: 'none' }}
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
