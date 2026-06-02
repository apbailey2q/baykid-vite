// api/_lib/publish/providers/facebook.ts — Real Facebook Page publishing.
//
// Two paths:
//   text-only post  → POST /{page_id}/feed   { message }
//   image post      → POST /{page_id}/photos { url, caption }
//
// Uses the Page Access Token already decrypted by the caller. Returns the
// canonical permalink + the platform's post id so we can store it in
// social_accounts.last_used_at and publish_jobs.posted_url.

const GRAPH_VERSION = process.env.META_GRAPH_VERSION ?? 'v19.0'
const GRAPH         = `https://graph.facebook.com/${GRAPH_VERSION}`

export interface FacebookPublishOpts {
  pageId:          string
  pageAccessToken: string
  message:         string
  /** Optional public image URL — Meta will fetch it. If set, posts via /photos. */
  mediaUrl?:       string
}

export interface FacebookPublishResult {
  url:            string
  platformPostId: string
}

interface MetaResponse {
  id?:      string         // /feed returns "page_id_post_id"
  post_id?: string         // /photos returns this as the feed-linkable id
  error?: {
    message:        string
    type?:          string
    code?:          number
    error_subcode?: number
    fbtrace_id?:    string
  }
}

async function postForm(endpoint: string, fields: Record<string, string>): Promise<MetaResponse> {
  const body = new URLSearchParams(fields)
  const res = await fetch(endpoint, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    body.toString(),
    signal:  AbortSignal.timeout(30_000),
  })
  const json = await res.json().catch(() => ({})) as MetaResponse
  if (!res.ok || json.error) {
    const msg = json.error?.message ?? `HTTP ${res.status}`
    const code = json.error?.code != null ? ` [code ${json.error.code}]` : ''
    throw new Error(`Facebook API: ${msg}${code}`)
  }
  return json
}

export async function publishToFacebookPage(opts: FacebookPublishOpts): Promise<FacebookPublishResult> {
  const { pageId, pageAccessToken, message, mediaUrl } = opts

  if (!pageId)          throw new Error('pageId is required')
  if (!pageAccessToken) throw new Error('pageAccessToken is required')
  if (!message && !mediaUrl) throw new Error('Either message or mediaUrl is required')

  if (mediaUrl) {
    // Image post — Meta pulls the URL server-side.
    const body = await postForm(`${GRAPH}/${encodeURIComponent(pageId)}/photos`, {
      url:          mediaUrl,
      caption:      message ?? '',
      access_token: pageAccessToken,
    })
    const postId = body.post_id ?? body.id
    if (!postId) throw new Error('Facebook /photos returned no post id')
    return {
      url:            `https://www.facebook.com/${postId}`,
      platformPostId: postId,
    }
  }

  // Text-only post.
  const body = await postForm(`${GRAPH}/${encodeURIComponent(pageId)}/feed`, {
    message,
    access_token: pageAccessToken,
  })
  const postId = body.id
  if (!postId) throw new Error('Facebook /feed returned no post id')
  return {
    url:            `https://www.facebook.com/${postId}`,
    platformPostId: postId,
  }
}
