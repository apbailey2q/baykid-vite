// Re-exports the shared Supabase client and exposes a config guard.
// Use isSupabaseConfigured before making live API calls.
export { supabase } from './supabase'

export const isSupabaseConfigured = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY,
)
