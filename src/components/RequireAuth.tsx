import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

interface Props { children: React.ReactNode }

type AuthState = 'loading' | 'authenticated' | 'unauthenticated'

export function RequireAuth({ children }: Props) {
  const [state, setState] = useState<AuthState>('loading')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setState(data.session ? 'authenticated' : 'unauthenticated')
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setState(session ? 'authenticated' : 'unauthenticated')
    })

    return () => subscription.unsubscribe()
  }, [])

  if (state === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: '#060e24' }}>
        <div
          className="h-8 w-8 animate-spin rounded-full border-4"
          style={{ borderColor: '#00c8ff', borderTopColor: 'transparent' }}
        />
      </div>
    )
  }

  if (state === 'unauthenticated') {
    return <Navigate to="/real-login" replace />
  }

  return <>{children}</>
}
