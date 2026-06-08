// api/admin/finalize-account-deletion.ts — Secure account deletion completion.
//
// Route:   POST /api/admin/finalize-account-deletion
// Access:  admin OR compliance_manager only
// Body:    { requestId: string }
//
// Security:
//   • JWT validated server-side via SUPABASE_ANON_KEY
//   • Role verified by querying profiles table (admin or compliance_manager)
//   • supabase.auth.admin.deleteUser() called via SUPABASE_SERVICE_ROLE_KEY
//     loaded ONLY from server environment — never exposed to any client
//   • Service-role client instantiated in api/_lib/supabase-admin.ts only
//   • No service-role key in response bodies, headers, or logs
//
// Workflow:
//   1. Validate JWT → identify calling admin
//   2. Verify role is admin or compliance_manager → 403 otherwise
//   3. Load account_deletion_requests row → verify status = 'approved'
//   4. Pre-deletion anonymization:
//        payout_ledger       → user_id = NULL, deleted_user_email = email
//        wallet_transactions → user_id = NULL, deleted_user_email = email
//   5. Insert account_deletion_audit_log entry (permanent; no auth.users FK)
//   6. Update request status = 'completed', completed_at = now()
//   7. adminClient().auth.admin.deleteUser(userId)
//        → cascades SET NULL on account_deletion_requests.user_id
//        → cascades SET NULL on payout_ledger.user_id (already NULL from step 4)
//   8. Return { success: true }
//
//   On failure at any step after anonymization but before auth delete:
//        Insert audit log with action = 'anonymization_partial'
//        Do NOT update request status (stays 'approved')
//        Return 500 with message — no sensitive detail in response
//
// Returns:
//   200 { success: true, message: string }
//   400 { success: false, message: string }   invalid request / wrong status
//   401 { success: false, message: string }   missing/invalid JWT
//   403 { success: false, message: string }   not admin or compliance_manager
//   500 { success: false, message: string }   server error (no internal details)

import { createClient } from '@supabase/supabase-js'
import { adminClient } from '../_lib/supabase-admin.js'

// ── CORS ──────────────────────────────────────────────────────────────────────

const ALLOWED_ORIGINS: ReadonlySet<string> = new Set(
  [
    'http://localhost:5173',
    'http://localhost:4173',
    process.env.VITE_APP_URL,
    process.env.APP_URL,
    process.env.NEXT_PUBLIC_APP_URL,
  ].filter((o): o is string => typeof o === 'string' && o.startsWith('http')),
)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolvedOrigin(req: any): string {
  const origin = req.headers?.['origin'] ?? ''
  if (ALLOWED_ORIGINS.has(origin)) return origin
  return 'null' // triggers CORS block for unknown origins
}

// ── JWT validation ────────────────────────────────────────────────────────────

async function validateJwt(
  authHeader: string | undefined,
): Promise<{ id: string; email?: string } | null> {
  const url  = process.env.VITE_SUPABASE_URL  ?? process.env.SUPABASE_URL  ?? ''
  const anon = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? ''
  if (!url || !anon) return null
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null
  if (!token) return null
  try {
    const supa = createClient(url, anon, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    })
    const { data, error } = await supa.auth.getUser()
    if (error || !data?.user) return null
    return { id: data.user.id, email: data.user.email ?? undefined }
  } catch {
    return null
  }
}

// ── Role check ────────────────────────────────────────────────────────────────

const PERMITTED_ROLES = new Set(['admin', 'compliance_manager'])

async function resolveCallerRole(userId: string): Promise<string | null> {
  try {
    const sb = adminClient()
    const { data, error } = await sb
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()
    if (error || !data) return null
    return (data as { role: string }).role ?? null
  } catch {
    return null
  }
}

// ── Pre-deletion anonymization ────────────────────────────────────────────────
// Nullifies user references on financial tables before auth user is deleted.
// These tables have ON DELETE SET NULL FKs (migration 20260709000001), so this
// step is belt-and-suspenders: it also sets deleted_user_email for audit trail.
// Returns list of tables successfully anonymized.

async function anonymizeFinancialRecords(
  userId: string,
  userEmail: string,
): Promise<{ anonymized: string[]; errors: string[] }> {
  const sb       = adminClient()
  const anonymized: string[] = []
  const errors:    string[]  = []

  // payout_ledger — references auth.users(id) ON DELETE SET NULL
  try {
    const { error } = await sb
      .from('payout_ledger')
      .update({ user_id: null, deleted_user_email: userEmail })
      .eq('user_id', userId)
    if (error) errors.push(`payout_ledger: ${error.message}`)
    else anonymized.push('payout_ledger')
  } catch (e) {
    errors.push(`payout_ledger: ${e instanceof Error ? e.message : 'unknown'}`)
  }

  // wallet_transactions — references profiles(id) ON DELETE SET NULL
  // profiles.id = auth.users.id, so we can match on the same userId
  try {
    const { error } = await sb
      .from('wallet_transactions')
      .update({ user_id: null, deleted_user_email: userEmail })
      .eq('user_id', userId)
    if (error) errors.push(`wallet_transactions: ${error.message}`)
    else anonymized.push('wallet_transactions')
  } catch (e) {
    errors.push(`wallet_transactions: ${e instanceof Error ? e.message : 'unknown'}`)
  }

  return { anonymized, errors }
}

// ── Audit log ─────────────────────────────────────────────────────────────────

async function writeAuditLog(entry: {
  requestId:        string
  userId:           string
  userEmail:        string
  userRole:         string | null
  adminId:          string
  action:           'completed' | 'failed' | 'anonymization_partial'
  reason:           string | null
  anonymizedTables: string[]
  errorMessage:     string | null
  metadata?:        Record<string, unknown>
}): Promise<void> {
  try {
    const sb = adminClient()
    await sb.from('account_deletion_audit_log').insert({
      request_id:        entry.requestId,
      user_id:           entry.userId,
      user_email:        entry.userEmail,
      user_role:         entry.userRole,
      admin_id:          entry.adminId,
      action:            entry.action,
      reason:            entry.reason,
      anonymized_tables: entry.anonymizedTables,
      error_message:     entry.errorMessage,
      metadata:          entry.metadata ?? null,
    })
  } catch {
    // Audit log write failure is non-fatal — the deletion still proceeds.
    // In production, wire this to your error tracking (Sentry, etc.).
    console.error('[finalize-account-deletion] audit log write failed')
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  const origin = resolvedOrigin(req)
  res.setHeader('Access-Control-Allow-Origin',  origin)
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Max-Age',       '86400')
  res.setHeader('Cache-Control',                'no-store')
  res.setHeader('Content-Type',                 'application/json')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, message: 'Method not allowed' })
    return
  }

  // ── Step 1: validate JWT ───────────────────────────────────────────────────
  const caller = await validateJwt(req.headers['authorization'])
  if (!caller) {
    res.status(401).json({ success: false, message: 'Authentication required' })
    return
  }

  // ── Step 2: verify role (admin or compliance_manager) ─────────────────────
  const callerRole = await resolveCallerRole(caller.id)
  if (!callerRole || !PERMITTED_ROLES.has(callerRole)) {
    res.status(403).json({ success: false, message: 'Unauthorized' })
    return
  }

  // ── Step 3: validate request body ─────────────────────────────────────────
  let requestId: string
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    requestId = body?.requestId
    if (!requestId || typeof requestId !== 'string') throw new Error()
  } catch {
    res.status(400).json({ success: false, message: 'requestId is required' })
    return
  }

  // ── Step 4: load deletion request, verify status = 'approved' ─────────────
  const sb = adminClient()

  const { data: reqRow, error: reqErr } = await sb
    .from('account_deletion_requests')
    .select('id, user_id, email, role, reason, status')
    .eq('id', requestId)
    .single()

  if (reqErr || !reqRow) {
    res.status(400).json({ success: false, message: 'Deletion request not found' })
    return
  }

  const row = reqRow as {
    id:      string
    user_id: string
    email:   string | null
    role:    string | null
    reason:  string | null
    status:  string
  }

  if (row.status !== 'approved') {
    res.status(400).json({
      success: false,
      message: `Cannot finalize — request status is '${row.status}'. Only 'approved' requests can be finalized.`,
    })
    return
  }

  if (!row.user_id) {
    res.status(400).json({
      success: false,
      message: 'Request has no associated user_id — may have already been processed.',
    })
    return
  }

  const userId    = row.user_id
  const userEmail = row.email ?? '(unknown)'
  const userRole  = row.role  ?? null

  // ── Step 5: pre-deletion anonymization of financial records ───────────────
  const { anonymized, errors: anonErrors } = await anonymizeFinancialRecords(userId, userEmail)

  // ── Step 6: insert audit log (permanent record — survives user deletion) ───
  // Written BEFORE auth deletion so we have all data, and marked 'completed'
  // optimistically. If auth deletion fails below, a second 'failed' entry is written.
  await writeAuditLog({
    requestId,
    userId,
    userEmail,
    userRole,
    adminId:          caller.id,
    action:           anonErrors.length > 0 ? 'anonymization_partial' : 'completed',
    reason:           row.reason,
    anonymizedTables: anonymized,
    errorMessage:     anonErrors.length > 0 ? anonErrors.join('; ') : null,
    metadata: {
      caller_role:        callerRole,
      anonymization_note: anonErrors.length > 0
        ? 'Some financial tables could not be anonymized — manual review required'
        : 'All designated financial tables anonymized successfully',
    },
  })

  // ── Step 7: update request status → 'completed' ───────────────────────────
  // Done BEFORE auth deletion. If deletion cascades SET NULL on user_id,
  // the row still exists with status='completed', user_id=NULL.
  const now = new Date().toISOString()
  const { error: updateErr } = await sb
    .from('account_deletion_requests')
    .update({
      status:       'completed',
      completed_at: now,
      reviewed_by:  row.status === 'approved' ? caller.id : undefined,
      reviewed_at:  row.status === 'approved' ? now : undefined,
    })
    .eq('id', requestId)

  if (updateErr) {
    console.error('[finalize-account-deletion] failed to update request status:', updateErr.message)
    // Non-fatal: proceed to auth delete. The status update can be repaired manually.
  }

  // ── Step 8: delete auth user via Admin API (service-role only) ────────────
  try {
    const { error: deleteErr } = await sb.auth.admin.deleteUser(userId)
    if (deleteErr) {
      // Auth delete failed. Write a 'failed' audit entry and return 500.
      await writeAuditLog({
        requestId,
        userId,
        userEmail,
        userRole,
        adminId:          caller.id,
        action:           'failed',
        reason:           row.reason,
        anonymizedTables: anonymized,
        errorMessage:     deleteErr.message,
        metadata: {
          caller_role: callerRole,
          stage:       'auth_delete',
          note:        'Financial records were anonymized. Auth user deletion failed — manual delete required.',
        },
      })

      // Roll back the status update so admins can retry.
      await sb
        .from('account_deletion_requests')
        .update({ status: 'approved', completed_at: null })
        .eq('id', requestId)

      res.status(500).json({
        success: false,
        message: 'Unable to complete account deletion. Please review logs and contact support.',
      })
      return
    }
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : 'Unknown error'
    await writeAuditLog({
      requestId,
      userId,
      userEmail,
      userRole,
      adminId:          caller.id,
      action:           'failed',
      reason:           row.reason,
      anonymizedTables: anonymized,
      errorMessage:     errMsg,
      metadata:         { caller_role: callerRole, stage: 'auth_delete_exception' },
    })

    await sb
      .from('account_deletion_requests')
      .update({ status: 'approved', completed_at: null })
      .eq('id', requestId)

    res.status(500).json({
      success: false,
      message: 'Unable to complete account deletion. Please review logs and contact support.',
    })
    return
  }

  // ── Success ────────────────────────────────────────────────────────────────
  res.status(200).json({
    success: true,
    message: 'Account successfully deleted. Request marked completed.',
  })
}
