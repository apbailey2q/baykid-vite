import { supabase } from './supabaseClient'
import { useAuthStore } from '../store/authStore'
import { getMockUser, getMockProfile, type BypassKey } from './devBypass'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// Derive the localStorage key Supabase uses for the session token.
function getStorageKey(): string {
  const match = (SUPABASE_URL ?? '').match(/https?:\/\/([^.]+)/)
  return match ? `sb-${match[1]}-auth-token` : 'sb-auth-token'
}

// Fetch the profile row directly via REST — bypasses supabase.auth.getSession()
// which acquires the Web Lock and deadlocks during startup.
async function fetchProfileDirect(userId: string, accessToken: string) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null
  const url = `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=*`
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  })
  if (!res.ok) return null
  const rows = await res.json()
  return Array.isArray(rows) ? (rows[0] ?? null) : null
}

// Read the Supabase session from localStorage WITHOUT acquiring the Web Lock.
// Also handles demo mode: injects a mock user/profile when the real session is absent.
async function bootstrapFromStorage(): Promise<void> {
  const { setUser, setProfile, setLoading } = useAuthStore.getState()
  try {
    const raw = localStorage.getItem(getStorageKey())
    if (raw) {
      const session = JSON.parse(raw)
      const now = Math.floor(Date.now() / 1000)
      if (session?.user && session?.access_token && session?.expires_at && session.expires_at > now) {
        setUser(session.user)
        try {
          const profile = await fetchProfileDirect(session.user.id, session.access_token)
          profile ? setProfile(profile) : setProfile(null)
        } catch {
          setProfile(null)
        }
        return
      }
    }

    // No real session — check for demo mode
    if (localStorage.getItem('baykid-demo-mode') === 'true') {
      const demoRole = (localStorage.getItem('baykid-demo-role') ?? 'consumer') as BypassKey
      setUser(getMockUser(demoRole))
      setProfile(getMockProfile(demoRole))
    }
  } catch {
    // malformed storage — ignore
  } finally {
    setLoading(false)
  }
}

// Initialized once at module load — safe from React StrictMode double-invoke.
export function initAuth(): () => void {
  // Fast path: hydrate store from localStorage immediately (no Web Lock).
  bootstrapFromStorage()

  // Reactive path: keep store in sync with Supabase auth events (sign-in,
  // sign-out, token refresh). onAuthStateChange uses the Web Lock internally
  // and may fire after bootstrapFromStorage completes — that's fine; it is
  // always authoritative and will override any stale bootstrap state.
  const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
    const { setUser, setProfile, clearAuth, setLoading } = useAuthStore.getState()

    if (session?.user) {
      setUser(session.user)
      try {
        // Use direct REST fetch — avoids re-entering the Web Lock from within
        // the onAuthStateChange callback (which itself holds the lock).
        const profile = await fetchProfileDirect(session.user.id, session.access_token)
        profile ? setProfile(profile) : setProfile(null)
      } catch {
        setProfile(null)
      }
    } else if (localStorage.getItem('baykid-demo-mode') !== 'true') {
      // Only clear auth when not in demo mode — demo sessions have no Supabase session
      clearAuth()
    }
    setLoading(false)
  })

  return () => subscription.unsubscribe()
}
