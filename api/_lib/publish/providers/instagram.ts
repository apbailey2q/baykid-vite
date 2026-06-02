// api/_lib/publish/providers/instagram.ts — Real Instagram Business publishing.
//
// IG Graph API requires the two-step "container" flow (no single-call post):
//   1. POST /{ig_user_id}/media          { image_url, caption, access_token }
//        → returns { id: <container_id> }
//   2. GET  /{container_id}?fields=status_code
//        → poll until status_code === 'FINISHED' (usually instant for images,
//          can take seconds for video)
//   3. POST /{ig_user_id}/media_publish  { creation_id, access_token }
//        → returns { id: <published_media_id> }
//   4. GET  /{media_id}?fields=permalink
//        → returns the live URL we store as posted_url
//
// IG ALSO requires a publicly accessible image URL. Text-only posts are not
// supported by the Graph API — the /api/publish/now route guards this with
// a 400 before calling us, but we double-check here for direct callers.
//
// Phase B.3 scope: IMAGE only. Video + Carousel are documented as TODO.
// Reuses the same Page Access Token (encrypted in social_accounts) — IG
// publishing rides the linked Page's permissions.

const GRAPH_VERSION = process.env.META_GRAPH_VERSION ?? 'v19.0'
const GRAPH         = `https://graph.facebook.com/${GRAPH_VERSION}`

export interface InstagramPublishOpts {
  igUserId:        string
  pageAccessToken: string
  message:         string
  /** REQUIRED for IG — public HTTPS URL to an image. */
  mediaUrl?:       string
}

export interface InstagramPublishResult {
  url:            string
  platformPostId: string
}

interface MetaResponse {
  id?:          string
  status_code?: 'IN_PROGRESS' | 'FINISHED' | 'ERROR' | 'EXPIRED' | 'PUBLISHED'
  status?:      string
  permalink?:   string
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
    const msg  = json.error?.message ?? `HTTP ${res.status}`
    const code = json.error?.code != null ? ` [code ${json.error.code}]` : ''
    throw new Error(`Instagram API: ${msg}${code}`)
  }
  return json
}

async function getJson(url: string): Promise<MetaResponse> {
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
  const json = await res.json().catch(() => ({})) as MetaResponse
  if (!res.ok || json.error) {
    const msg  = json.error?.message ?? `HTTP ${res.status}`
    const code = json.error?.code != null ? ` [code ${json.error.code}]` : ''
    throw new Error(`Instagram API: ${msg}${code}`)
  }
  return json
}

/** Poll the container until it's FINISHED, ERROR, or EXPIRED. */
async function waitForContainer(
  containerId: string,
  token:       string,
  maxMs = 45_000,
  pollMs = 1500,
): Promise<void> {
  const deadline = Date.now() + maxMs
  while (Date.now() < deadline) {
    const status = await getJson(
      `${GRAPH}/${encodeURIComponent(containerId)}?fields=status_code,status&access_token=${encodeURIComponent(token)}`,
    )
    const code = status.status_code
    if (code === 'FINISHED' || code === 'PUBLISHED') return
    if (code === 'ERROR' || code === 'EXPIRED') {
      throw new Error(`Instagram container ${code.toLowerCase()}${status.status ? ': ' + status.status : ''}`)
    }
    // IN_PROGRESS or undefined — wait and retry
    await new Promise((r) => setTimeout(r, pollMs))
  }
  throw new Error(`Instagram container did not become ready within ${Math.round(maxMs / 1000)}s`)
}

/** Fetch the live IG permalink. Retried briefly because Meta sometimes lags
 *  propagating the field for a few seconds after media_publish returns. */
async function fetchPermalink(mediaId: string, token: string): Promise<string | null> {
  const url = `${GRAPH}/${encodeURIComponent(mediaId)}?fields=permalink&access_token=${encodeURIComponent(token)}`
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const json = await getJson(url)
      if (json.permalink) return json.permalink
    } catch {
      // tolerated — IG permalink endpoint can be slow to propagate
    }
    await new Promise((r) => setTimeout(r, 1500))
  }
  return null
}

export async function publishToInstagram(opts: InstagramPublishOpts): Promise<InstagramPublishResult> {
  const { igUserId, pageAccessToken, message, mediaUrl } = opts

  if (!igUserId)        throw new Error('igUserId is required')
  if (!pageAccessToken) throw new Error('pageAccessToken is required')
  if (!mediaUrl)        throw new Error('Instagram requires a public image URL — text-only posts are not supported by the Graph API')

  // Step 1: create the media container.
  const containerResp = await postForm(`${GRAPH}/${encodeURIComponent(igUserId)}/media`, {
    image_url:    mediaUrl,
    caption:      message ?? '',
    access_token: pageAccessToken,
  })
  const containerId = containerResp.id
  if (!containerId) throw new Error('Instagram /media returned no container id')

  // Step 2: wait for the container to finish processing.
  await waitForContainer(containerId, pageAccessToken)

  // Step 3: publish the container.
  const publishResp = await postForm(`${GRAPH}/${encodeURIComponent(igUserId)}/media_publish`, {
    creation_id:  containerId,
    access_token: pageAccessToken,
  })
  const mediaId = publishResp.id
  if (!mediaId) throw new Error('Instagram /media_publish returned no media id')

  // Step 4: fetch the live permalink for posted_url.
  const permalink = await fetchPermalink(mediaId, pageAccessToken)

  return {
    url:            permalink ?? `https://www.instagram.com/`, // fallback — at least clickable
    platformPostId: mediaId,
  }
}
