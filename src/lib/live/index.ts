// ─────────────────────────────────────────────────────────────────────────────
// LIVE-ONLY logic. Canonical home for real Supabase / backend access.
//
// Rule: nothing in here may import from lib/demo or reference mock/fake data.
// This is the path used whenever isLiveMode() is true (the default).
//
// Consolidation note: the Supabase client currently lives at lib/supabase.ts
// (and lib/supabaseClient.ts). It is re-exported here so new live code has one
// canonical entry point. Collapsing the duplicate client files is deferred —
// tracked in the audit report under "areas still needing cleanup".
// ─────────────────────────────────────────────────────────────────────────────

export { supabase } from '../supabase'
export { isLiveMode } from '../mode'
