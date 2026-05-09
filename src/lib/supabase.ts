import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables.\n' +
    'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in your .env file.\n' +
    'See .env.example for reference.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
