// api/_lib/oauth/providers/meta-persist.ts — shared social_accounts INSERT logic.
//
// Used by both the OAuth callback (single-Page fast path) and the
// /finalize endpoint (multi-Page selection). Decoupled from the callback
// so the selection step doesn't have to re-discover anything.

import { adminClient } from '../../supabase-admin.js'
import { ACTIVE_ORG_ID } from '../../org.js'
import { encryptToken } from '../../encrypt.js'
import { META_SCOPES } from './meta.js'
import type { MetaPage } from './meta.js'

export interface PersistPagesParams {
  pages:                  MetaPage[]
  fbUserId:               string
  fbUserName:             string
  longLivedExpiresInSec?: number | null
}

export interface PersistPagesResult {
  fbAdded: number
  igAdded: number
  errors:  string[]
}

export async function persistPages(p: PersistPagesParams): Promise<PersistPagesResult> {
  const supa = adminClient()
  const nowIso = new Date().toISOString()
  const expiresAt = p.longLivedExpiresInSec
    ? new Date(Date.now() + p.longLivedExpiresInSec * 1000).toISOString()
    : null

  let fbAdded = 0
  let igAdded = 0
  const errors: string[] = []

  for (const page of p.pages) {
    const pageTokenEnc = encryptToken(page.access_token)

    const fbRow = {
      organization_id:         ACTIVE_ORG_ID,
      platform:                'facebook',
      account_name:            page.name,
      account_handle:          page.name,
      account_avatar_url:      page.picture_url ?? null,
      external_account_id:     page.id,
      access_token_encrypted:  pageTokenEnc,
      refresh_token_encrypted: null,
      token_type:              'Bearer',
      scopes:                  Array.from(META_SCOPES),
      expires_at:              expiresAt,
      platform_metadata:       {
        fb_user_id:   p.fbUserId,
        fb_user_name: p.fbUserName,
        page_id:      page.id,
        category:     page.category ?? null,
      },
      is_active:               true,
      last_used_at:            null,
      last_error:              null,
      connected_at:            nowIso,
      disconnected_at:         null,
    }

    const { error: fbErr } = await supa
      .from('social_accounts')
      .upsert(fbRow, { onConflict: 'organization_id,platform,external_account_id' })

    if (fbErr) {
      errors.push(`page ${page.id}: ${fbErr.message}`)
      continue
    }
    fbAdded++

    const ig = page.instagram_business_account
    if (!ig) continue

    const igRow = {
      organization_id:         ACTIVE_ORG_ID,
      platform:                'instagram',
      account_name:            ig.name ?? ig.username,
      account_handle:          `@${ig.username}`,
      account_avatar_url:      ig.profile_picture_url ?? null,
      external_account_id:     ig.id,
      access_token_encrypted:  pageTokenEnc,
      refresh_token_encrypted: null,
      token_type:              'Bearer',
      scopes:                  Array.from(META_SCOPES),
      expires_at:              expiresAt,
      platform_metadata:       {
        fb_user_id:    p.fbUserId,
        page_id:       page.id,
        page_name:     page.name,
        ig_user_id:    ig.id,
        ig_username:   ig.username,
      },
      is_active:               true,
      last_used_at:            null,
      last_error:              null,
      connected_at:            nowIso,
      disconnected_at:         null,
    }

    const { error: igErr } = await supa
      .from('social_accounts')
      .upsert(igRow, { onConflict: 'organization_id,platform,external_account_id' })

    if (igErr) {
      errors.push(`ig ${ig.id}: ${igErr.message}`)
      continue
    }
    igAdded++
  }

  return { fbAdded, igAdded, errors }
}
