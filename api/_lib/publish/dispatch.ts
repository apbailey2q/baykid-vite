// api/_lib/publish/dispatch.ts — shared "look up account + decrypt token +
// call the right provider" helper. Used by both /api/publish/now (legacy
// single-shot) and api/_lib/publish/processor.ts (cron + click via run-job).

import type { SupabaseClient } from '@supabase/supabase-js'
import { ACTIVE_ORG_ID } from '../org.js'
import { decodeBytea, decryptToken } from '../encrypt.js'
import { publishToFacebookPage } from './providers/facebook.js'
import { publishToInstagram } from './providers/instagram.js'
import { publishToLinkedIn } from './providers/linkedin.js'

export interface ExecutePublishOpts {
  supa:      SupabaseClient
  accountId: string
  message:   string
  mediaUrl?: string
}

export interface ExecutePublishResult {
  url:            string
  platformPostId: string
  platform:       'facebook' | 'instagram' | 'linkedin'
}

interface AccountRow {
  id:                     string
  platform:               string
  external_account_id:    string
  access_token_encrypted: string | Uint8Array
  platform_metadata:      Record<string, unknown> | null
  is_active:              boolean
}

/** Throws on any failure. The caller (processor / now route) is responsible
 *  for translating the throw into a job-status update or HTTP response. */
export async function executePublish(opts: ExecutePublishOpts): Promise<ExecutePublishResult> {
  const { supa, accountId, message, mediaUrl } = opts

  const { data: account, error: lookupErr } = await supa
    .from('social_accounts')
    .select('id, platform, external_account_id, access_token_encrypted, platform_metadata, is_active')
    .eq('id', accountId)
    .eq('organization_id', ACTIVE_ORG_ID)
    .maybeSingle() as { data: AccountRow | null; error: { message: string } | null }

  if (lookupErr) throw new Error(`account_lookup_failed: ${lookupErr.message}`)
  if (!account)  throw new Error('account_not_found')
  if (!account.is_active) throw new Error('account_disconnected')

  const pageAccessToken = decryptToken(decodeBytea(account.access_token_encrypted))
  const meta   = account.platform_metadata ?? {}
  const pageId = typeof meta.page_id === 'string' ? meta.page_id : account.external_account_id

  if (account.platform === 'instagram' && !mediaUrl) {
    throw new Error('Instagram requires a public image URL — text-only posts are not supported by the Graph API.')
  }
  if (!message && !mediaUrl) {
    throw new Error('missing_content')
  }

  let result: { url: string; platformPostId: string }
  if (account.platform === 'facebook') {
    result = await publishToFacebookPage({ pageId, pageAccessToken, message, mediaUrl })
  } else if (account.platform === 'instagram') {
    const igUserId = typeof meta.ig_user_id === 'string' ? meta.ig_user_id : account.external_account_id
    result = await publishToInstagram({ igUserId, pageAccessToken, message, mediaUrl })
  } else if (account.platform === 'linkedin') {
    // For LinkedIn the "page access token" name is misleading — it's the
    // member access_token decrypted from the same column. external_account_id
    // is the LinkedIn member id (sub).
    result = await publishToLinkedIn({
      memberSub:   account.external_account_id,
      accessToken: pageAccessToken,
      message,
      mediaUrl,
    })
  } else {
    throw new Error(`platform_not_implemented: ${account.platform}`)
  }

  // Bump last_used_at + clear last_error. Best-effort — don't fail the publish.
  await supa
    .from('social_accounts')
    .update({ last_used_at: new Date().toISOString(), last_error: null })
    .eq('id', accountId)
    .then(() => undefined, () => undefined)

  return {
    url:            result.url,
    platformPostId: result.platformPostId,
    platform:       account.platform as 'facebook' | 'instagram' | 'linkedin',
  }
}

/** Best-effort note of a publish failure on the social_accounts row, so the
 *  Platform Connections card surfaces the most recent failure. */
export async function recordAccountError(supa: SupabaseClient, accountId: string, msg: string): Promise<void> {
  await supa
    .from('social_accounts')
    .update({ last_error: msg.slice(0, 500) })
    .eq('id', accountId)
    .then(() => undefined, () => undefined)
}
