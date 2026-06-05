import { supabase } from './supabaseClient'
import { useAuthStore } from '../store/authStore'
import type { DriverComplianceStatus } from '../types'

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

// Fetch the driver_profiles.status (Driver Compliance Pack V1) for the given
// driver. Returns null for non-drivers or when no driver_profile exists yet.
// Failure is silently swallowed so a missing row never blocks login.
async function fetchDriverComplianceStatus(userId: string, accessToken: string): Promise<string | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null
  try {
    const url = `${SUPABASE_URL}/rest/v1/driver_profiles?driver_id=eq.${encodeURIComponent(userId)}&select=status`
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    })
    if (!res.ok) return null
    const rows = await res.json()
    return Array.isArray(rows) && rows[0]?.status ? String(rows[0].status) : null
  } catch {
    return null
  }
}

const DRIVER_COMPLIANCE_STATUSES: ReadonlySet<DriverComplianceStatus> = new Set([
  'pending_review',
  'documents_submitted',
  'approved_for_dispatch',
  'rejected',
  'more_info_required',
])

function coerceDriverComplianceStatus(v: string | null): DriverComplianceStatus | null {
  if (!v) return null
  return DRIVER_COMPLIANCE_STATUSES.has(v as DriverComplianceStatus)
    ? (v as DriverComplianceStatus)
    : null
}

// Read the Supabase session from localStorage WITHOUT acquiring the Web Lock.
// This avoids the StrictMode double-invoke deadlock on the Web Lock.
async function bootstrapFromStorage(): Promise<void> {
  const { setUser, setProfile, setDriverComplianceStatus, setLoading } = useAuthStore.getState()
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
          if (profile?.role === 'driver') {
            const status = await fetchDriverComplianceStatus(session.user.id, session.access_token)
            setDriverComplianceStatus(coerceDriverComplianceStatus(status))
          } else {
            setDriverComplianceStatus(null)
          }
        } catch {
          setProfile(null)
          setDriverComplianceStatus(null)
        }
        return
      }
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
    const { setUser, setProfile, setDriverComplianceStatus, clearAuth, setLoading } = useAuthStore.getState()

    if (session?.user) {
      setUser(session.user)
      try {
        // Use direct REST fetch — avoids re-entering the Web Lock from within
        // the onAuthStateChange callback (which itself holds the lock).
        const profile = await fetchProfileDirect(session.user.id, session.access_token)
        profile ? setProfile(profile) : setProfile(null)
        if (profile?.role === 'driver') {
          const status = await fetchDriverComplianceStatus(session.user.id, session.access_token)
          setDriverComplianceStatus(coerceDriverComplianceStatus(status))
        } else {
          setDriverComplianceStatus(null)
        }
      } catch {
        setProfile(null)
        setDriverComplianceStatus(null)
      }
    } else {
      clearAuth()
    }
    setLoading(false)
  })

  return () => subscription.unsubscribe()
}
