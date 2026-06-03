// ── send-email-notification ──────────────────────────────────────────────────
// Supabase Edge Function — transactional email dispatcher (Resend).
//
// Called from:
//   • Database (pg_net HTTP via dispatch_email_notification)
//   • Server-side code (supabase.functions.invoke with service role)
//
// Payload:
//   { user_id, subject, body, notification_type?, data? }
//
// Delivery:
//   1. Resolve user email from auth.users (service-role read)
//   2. Wrap body in a branded HTML template (Cyan's Brooklynn Marketing)
//   3. POST to Resend API
//   4. Best-effort log to push_delivery_log with event_type='email:<type>'
//      so admins can audit email + push in one place
//
// Always returns HTTP 200 — email is best-effort, never blocks the caller.
//
// Required secrets (set via supabase secrets set ...):
//   RESEND_API_KEY            — from resend.com dashboard
//   RESEND_FROM_ADDRESS       — verified sender, e.g. 'notifications@cbrecycling.org'
//   RESEND_REPLY_TO           — optional, e.g. 'support@cbrecycling.org'
//
// Auto-injected by Supabase:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonRes(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

interface InboundPayload {
  user_id?:           string
  subject?:           string
  body?:              string
  notification_type?: string
  data?:              Record<string, unknown>
}

const RESEND_URL    = 'https://api.resend.com/emails'
const APP_BASE_URL  = Deno.env.get('APP_BASE_URL') ?? 'https://app.cbrecycling.org'
const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

function brandedHtml(subject: string, body: string, targetRoute?: string): string {
  const cta = targetRoute
    ? `<p style="text-align:center;margin:24px 0;">
         <a href="${APP_BASE_URL}${targetRoute}"
            style="background:#0057e7;color:#fff;text-decoration:none;
                   padding:12px 24px;border-radius:8px;font-weight:600;
                   display:inline-block;">Open Cyan's Brooklynn</a>
       </p>`
    : ''

  return `<!doctype html>
<html><body style="font-family:-apple-system,Segoe UI,sans-serif;background:#f3f4f6;margin:0;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;
              padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <h1 style="color:#0057e7;font-size:18px;font-weight:700;margin:0 0 4px;">
      Cyan's Brooklynn Recycling
    </h1>
    <div style="color:#6b7280;font-size:12px;margin-bottom:24px;">
      Notification
    </div>
    <h2 style="color:#111827;font-size:20px;font-weight:700;margin:0 0 12px;line-height:1.3;">
      ${subject.replace(/</g, '&lt;')}
    </h2>
    <div style="color:#374151;font-size:15px;line-height:1.6;white-space:pre-wrap;">
      ${body.replace(/</g, '&lt;')}
    </div>
    ${cta}
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0 16px;" />
    <div style="color:#9ca3af;font-size:11px;text-align:center;">
      You're receiving this email because notifications are enabled on your Cyan's Brooklynn account.<br/>
      Manage your preferences at <a href="${APP_BASE_URL}/settings/notifications" style="color:#0057e7;">Notification Settings</a>.
    </div>
  </div>
</body></html>`
}

async function logDelivery(
  supa: ReturnType<typeof createClient>,
  userId: string | null,
  notificationType: string,
  subject: string,
  status: 'sent' | 'failed' | 'skipped',
  error?: string,
): Promise<void> {
  try {
    await supa.from('push_delivery_log').insert({
      user_id:    userId,
      event_type: `email:${notificationType}`,
      title:      subject,
      status,
      error:      error ?? null,
    })
  } catch { /* best-effort */ }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }
  if (req.method !== 'POST') {
    return jsonRes({ error: 'method_not_allowed' }, 405)
  }

  let payload: InboundPayload
  try {
    payload = await req.json() as InboundPayload
  } catch {
    return jsonRes({ error: 'invalid_json' }, 400)
  }

  const userId  = payload.user_id?.trim()
  const subject = payload.subject?.trim()
  const body    = payload.body?.trim()
  const notifType = payload.notification_type?.trim() || 'general'
  const targetRoute = typeof payload.data?.target_route === 'string' ? payload.data.target_route : undefined

  if (!userId || !subject || !body) {
    return jsonRes({ error: 'missing_fields' }, 400)
  }

  const apiKey      = Deno.env.get('RESEND_API_KEY')
  const fromAddress = Deno.env.get('RESEND_FROM_ADDRESS')
  const replyTo     = Deno.env.get('RESEND_REPLY_TO')

  const supa = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  if (!apiKey || !fromAddress) {
    await logDelivery(supa, userId, notifType, subject, 'skipped', 'RESEND_API_KEY or RESEND_FROM_ADDRESS not set')
    return jsonRes({ ok: true, skipped: true, reason: 'resend_not_configured' })
  }

  // Resolve user email
  const { data: userData, error: userErr } = await supa.auth.admin.getUserById(userId)
  if (userErr || !userData?.user?.email) {
    await logDelivery(supa, userId, notifType, subject, 'failed', userErr?.message ?? 'no_email')
    return jsonRes({ ok: true, sent: false, reason: 'user_email_not_found' })
  }
  const toAddress = userData.user.email

  // Send via Resend
  try {
    const res = await fetch(RESEND_URL, {
      method:  'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:     fromAddress,
        to:       [toAddress],
        subject,
        html:     brandedHtml(subject, body, targetRoute),
        text:     body,
        reply_to: replyTo || undefined,
        tags:     [{ name: 'notification_type', value: notifType }],
      }),
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      await logDelivery(supa, userId, notifType, subject, 'failed', `Resend HTTP ${res.status}: ${errText.slice(0, 200)}`)
      return jsonRes({ ok: true, sent: false, error: `resend_${res.status}` })
    }

    await logDelivery(supa, userId, notifType, subject, 'sent')
    return jsonRes({ ok: true, sent: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await logDelivery(supa, userId, notifType, subject, 'failed', msg)
    return jsonRes({ ok: true, sent: false, error: msg })
  }
})
