// api/oauth/facebook/pending.ts — Read a pending Meta connection for the
// selection UI.
//
// Route: GET /api/oauth/facebook/pending?token=<selectionToken>
//
// Returns the discovered Pages (without encrypted tokens — those stay
// server-side until the user finalizes their selection).

import { adminClient } from '../../_lib/supabase-admin.js'
import { ACTIVE_ORG_ID } from '../../_lib/org.js'

interface PageSummary {
  pageId:         string
  pageName:       string
  pageAvatarUrl:  string | null
  category:       string | null
  ig: null | {
    id:                 string
    username:           string
    name:               string | null
    profilePictureUrl:  string | null
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Content-Type', 'application/json')

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }

  const url = new URL(req.url ?? '', `https://${req.headers.host ?? 'localhost'}`)
  const token = url.searchParams.get('token')
  if (!token) {
    res.status(400).json({ error: 'missing token' })
    return
  }

  const supa = adminClient()
  const { data, error } = await supa
    .from('meta_pending_connections')
    .select('fb_user_name, discovered_pages, expires_at, consumed_at')
    .eq('token', token)
    .eq('organization_id', ACTIVE_ORG_ID)
    .maybeSingle()

  if (error) {
    res.status(500).json({ error: 'lookup_failed', detail: error.message })
    return
  }
  if (!data) {
    res.status(404).json({ error: 'pending_not_found' })
    return
  }
  if (data.consumed_at) {
    res.status(410).json({ error: 'pending_already_consumed' })
    return
  }
  if (new Date(data.expires_at).getTime() < Date.now()) {
    res.status(410).json({ error: 'pending_expired' })
    return
  }

  const pages: PageSummary[] = (data.discovered_pages as Array<{
    page_id: string; page_name: string; page_avatar_url: string | null; category: string | null
    ig: null | { id: string; username: string; name: string | null; profile_picture_url: string | null }
  }>).map((p) => ({
    pageId:         p.page_id,
    pageName:       p.page_name,
    pageAvatarUrl:  p.page_avatar_url,
    category:       p.category,
    ig: p.ig ? {
      id:                p.ig.id,
      username:          p.ig.username,
      name:              p.ig.name,
      profilePictureUrl: p.ig.profile_picture_url,
    } : null,
  }))

  res.status(200).json({
    fbUserName: data.fb_user_name,
    expiresAt:  data.expires_at,
    pages,
  })
}
