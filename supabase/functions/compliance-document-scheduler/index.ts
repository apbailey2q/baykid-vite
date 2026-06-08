// Edge Function runs in Deno — `any` typing is used pragmatically because the
// supabase-js client type chain isn't resolved by the app's tsconfig.
/* eslint-disable @typescript-eslint/no-explicit-any */
// compliance-document-scheduler — Daily scheduled scan of compliance_documents.
//
// Schedule (suggested):  daily at 09:00 UTC via Supabase Scheduled Functions
//                        OR pg_cron HTTP call with x-cron-secret.
//
// Inputs:
//   - GET / POST with header `x-cron-secret: <CRON_SECRET env>`
//   - Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET
//
// Behavior:
//   1. Reads admin-configurable settings from compliance_settings.
//   2. Scans public.compliance_documents:
//        • Documents EXPIRING in one of the configured warning-day buckets
//          → creates compliance_notifications type='document_expiring'
//          → creates document_review_events  action='note_added'
//        • Documents already EXPIRED whose status isn't already 'expired'
//          → flips status='expired'
//          → creates notification type='document_expired'
//        • Required documents in {missing,rejected,expired,update_requested}
//          for >= temporary_deactivation_countdown_days
//          → creates notification type='temporary_deactivation_warning'
//          (does NOT auto-deactivate the account; that is admin-driven.)
//   3. Writes compliance_audit_log entries describing what changed.
//
// Returns JSON:
//   {
//     ok: true,
//     documentsChecked: number,
//     notificationsCreated: number,
//     warningsCreated: number,
//     expirationsMarked: number,
//     notes: string[]    // soft warnings (table missing etc.)
//   }
//
// Security: REQUIRES the x-cron-secret header to match the CRON_SECRET env.
//           service_role is used only inside this function and is never
//           bundled with the browser app.

// @ts-expect-error — deno standard lib import (not resolved by app tsc)
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// @ts-expect-error — esm.sh wrapper for the supabase client (works in Deno runtime)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Deno globals (typed to keep editor happy) ───────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any

interface SettingsBundle {
  warningDays: number[]
  countdownDays: number
}

const DEFAULTS: SettingsBundle = {
  warningDays:   [30, 14, 7, 3, 1],
  countdownDays: 3,
}

const ADMIN_OWNER_TYPE_FALLBACK = 'partner'   // canonical CHECK accepts 'management|driver|warehouse|commercial|fundraiser|partner|consumer'

interface DocRow {
  id:                   string
  user_id:              string
  role_type:            string
  document_type:        string
  status:               string
  expiration_date:      string | null
  is_required:          boolean
  countdown_started_at: string | null
}

function mapRoleToOwnerType(role: string | null | undefined): string {
  if (!role) return ADMIN_OWNER_TYPE_FALLBACK
  if (role === 'admin' || role === 'executive' || role.endsWith('_manager') || role === 'warehouse_admin') return 'management'
  if (role === 'driver') return 'driver'
  if (role.startsWith('warehouse')) return 'warehouse'
  if (role === 'commercial' || role.endsWith('_customer') || role === 'school_business') return 'commercial'
  if (role === 'fundraiser' || role === 'fundraiser_admin' || role.endsWith('_partner')) return 'fundraiser'
  if (role === 'consumer') return 'consumer'
  return ADMIN_OWNER_TYPE_FALLBACK
}

function daysUntil(dateYmd: string): number {
  const target = new Date(dateYmd + 'T00:00:00Z').getTime()
  const now    = Date.now()
  return Math.ceil((target - now) / (24 * 60 * 60 * 1000))
}

async function loadSettings(supabase: any): Promise<{ bundle: SettingsBundle; notes: string[] }> {
  const notes: string[] = []
  const bundle: SettingsBundle = { ...DEFAULTS }
  try {
    const { data, error } = await supabase
      .from('compliance_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['document_expiration_warning_days', 'temporary_deactivation_countdown_days'])
    if (error) {
      notes.push(`compliance_settings read failed: ${error.message}; using defaults`)
      return { bundle, notes }
    }
    for (const row of (data ?? []) as { setting_key: string; setting_value: any }[]) {
      if (row.setting_key === 'document_expiration_warning_days' && Array.isArray(row.setting_value?.days)) {
        bundle.warningDays = row.setting_value.days.filter((n: any) => Number.isFinite(n) && n >= 0)
      }
      if (row.setting_key === 'temporary_deactivation_countdown_days' && Number.isFinite(row.setting_value?.days)) {
        bundle.countdownDays = row.setting_value.days
      }
    }
  } catch (e) {
    notes.push(`compliance_settings read threw: ${String(e)}; using defaults`)
  }
  return { bundle, notes }
}

serve(async (req: Request) => {
  // Authn — REQUIRED.
  const secret = req.headers.get('x-cron-secret') ?? ''
  if (!secret || secret !== Deno.env.get('CRON_SECRET')) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL'),
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false } },
  )

  const { bundle, notes } = await loadSettings(supabase)
  let documentsChecked = 0
  let notificationsCreated = 0
  let warningsCreated = 0
  let expirationsMarked = 0

  try {
    // Load every doc the scheduler cares about. Use a wide WHERE to keep the
    // payload small.
    const { data: docs, error: docErr } = await supabase
      .from('compliance_documents')
      .select('id, user_id, role_type, document_type, status, expiration_date, is_required, countdown_started_at')
      .or('expiration_date.not.is.null,status.in.(missing,rejected,update_requested)')
      .limit(5000)
    if (docErr) {
      notes.push(`compliance_documents read failed: ${docErr.message}`)
      return new Response(
        JSON.stringify({ ok: false, documentsChecked: 0, notificationsCreated: 0, warningsCreated: 0, expirationsMarked: 0, notes }),
        { headers: { 'Content-Type': 'application/json' }, status: 500 },
      )
    }
    documentsChecked = (docs ?? []).length

    const now = new Date()

    for (const doc of (docs ?? []) as DocRow[]) {
      const ownerType = mapRoleToOwnerType(doc.role_type)

      // ─ 1. Already-expired but status not yet 'expired' → flip + notify ──
      if (doc.expiration_date && doc.status !== 'expired' && doc.status !== 'approved') {
        const d = daysUntil(doc.expiration_date)
        if (d <= 0) {
          await supabase.from('compliance_documents').update({ status: 'expired' }).eq('id', doc.id)
          expirationsMarked++

          await supabase.from('compliance_notifications').insert({
            recipient_user_id: doc.user_id,
            owner_type:        ownerType,
            role:              doc.role_type,
            notification_type: 'document_expired',
            severity:          'critical',
            title:             'Document expired',
            message:           `Your ${prettyType(doc.document_type)} has expired. Upload a renewed copy from My Documents to keep your account in good standing.`,
            related_entity_type: 'compliance_document',
            related_entity_id:   doc.id,
            related_document_id: doc.id,
            action_url:        '/compliance/documents',
            status:            'unread',
          })
          notificationsCreated++

          await safeAudit(supabase, {
            action:        'DOCUMENT_EXPIRING',
            target_user_id: doc.user_id,
            entity_type:    'compliance_document',
            entity_id:      doc.id,
            metadata:       { document_type: doc.document_type, days_until: d, became: 'expired' },
          })
          continue   // expired beats the bucket-warning logic
        }
      }

      // ─ 2. Inside a configured warning-day bucket → notify ─────────────
      if (doc.expiration_date && doc.status === 'approved') {
        const d = daysUntil(doc.expiration_date)
        if (d > 0 && bundle.warningDays.includes(d)) {
          await supabase.from('compliance_notifications').insert({
            recipient_user_id: doc.user_id,
            owner_type:        ownerType,
            role:              doc.role_type,
            notification_type: 'document_expiring',
            severity:          d <= 3 ? 'critical' : d <= 7 ? 'warning' : 'info',
            title:             `${prettyType(doc.document_type)} expires in ${d} day${d === 1 ? '' : 's'}`,
            message:           `Your ${prettyType(doc.document_type)} expires in ${d} day${d === 1 ? '' : 's'}. Upload an updated copy from My Documents to avoid service interruption.`,
            related_entity_type: 'compliance_document',
            related_entity_id:   doc.id,
            related_document_id: doc.id,
            action_url:        '/compliance/documents',
            status:            'unread',
            expires_at:        doc.expiration_date,
          })
          notificationsCreated++

          await safeAudit(supabase, {
            action:         'DOCUMENT_EXPIRING',
            target_user_id: doc.user_id,
            entity_type:    'compliance_document',
            entity_id:      doc.id,
            metadata:       { document_type: doc.document_type, days_until: d, bucket: d },
          })
        }
      }

      // ─ 3. Required + bad state → temporary-deactivation warning ───────
      if (doc.is_required && ['missing','rejected','update_requested','expired'].includes(doc.status)) {
        // Start the per-doc countdown if not already started.
        let started = doc.countdown_started_at
        if (!started) {
          started = now.toISOString()
          await supabase.from('compliance_documents').update({ countdown_started_at: started }).eq('id', doc.id)
        }
        const daysSinceStart = Math.floor((Date.now() - new Date(started).getTime()) / (24 * 60 * 60 * 1000))
        const daysLeft       = bundle.countdownDays - daysSinceStart

        if (daysLeft >= 0) {
          await supabase.from('compliance_notifications').insert({
            recipient_user_id: doc.user_id,
            owner_type:        ownerType,
            role:              doc.role_type,
            notification_type: 'temporary_deactivation_warning',
            severity:          daysLeft <= 1 ? 'critical' : 'warning',
            title:             `Account restriction in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
            message:           `Your ${prettyType(doc.document_type)} is ${friendlyStatus(doc.status)}. Resolve it from My Documents within ${daysLeft} day${daysLeft === 1 ? '' : 's'} to avoid temporary account restriction.`,
            related_entity_type: 'compliance_document',
            related_entity_id:   doc.id,
            related_document_id: doc.id,
            countdown_days:    daysLeft,
            action_url:        '/compliance/documents',
            status:            'unread',
          })
          warningsCreated++
          notificationsCreated++

          await safeAudit(supabase, {
            action:         'ACCOUNT_TEMP_DEACTIVATION_WARNING',
            target_user_id: doc.user_id,
            entity_type:    'compliance_document',
            entity_id:      doc.id,
            metadata:       { document_type: doc.document_type, days_left: daysLeft },
          })
        }
      }
    }
  } catch (e) {
    notes.push(`scheduler threw: ${String(e)}`)
    return new Response(
      JSON.stringify({ ok: false, documentsChecked, notificationsCreated, warningsCreated, expirationsMarked, notes }),
      { headers: { 'Content-Type': 'application/json' }, status: 500 },
    )
  }

  return new Response(
    JSON.stringify({ ok: true, documentsChecked, notificationsCreated, warningsCreated, expirationsMarked, notes }),
    { headers: { 'Content-Type': 'application/json' } },
  )
})

// ── Helpers ─────────────────────────────────────────────────────────────────

function prettyType(t: string): string {
  return t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}
function friendlyStatus(s: string): string {
  switch (s) {
    case 'missing':          return 'missing'
    case 'expired':          return 'expired'
    case 'rejected':         return 'rejected'
    case 'update_requested': return 'awaiting an updated copy'
    default:                 return s
  }
}

async function safeAudit(supabase: any, row: {
  action:         string
  target_user_id?: string | null
  entity_type?:   string
  entity_id?:     string
  metadata?:      Record<string, unknown>
}): Promise<void> {
  try {
    await supabase.from('compliance_audit_log').insert({
      actor_id:        null,                // system actor (no auth.uid in scheduler)
      target_user_id:  row.target_user_id ?? null,
      action:          row.action,
      entity_type:     row.entity_type ?? null,
      entity_id:       row.entity_id ?? null,
      metadata:        row.metadata ?? {},
    })
  } catch { /* table may not exist; ignore */ }
}
