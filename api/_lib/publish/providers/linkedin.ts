// api/_lib/publish/providers/linkedin.ts — Real LinkedIn member publishing.
//
// Uses LinkedIn's Versioned API (https://api.linkedin.com/rest/...) which is
// the current standard. The previous /v2 Share endpoints are being
// deprecated. Versioned endpoints require a LinkedIn-Version header
// (YYYYMM date string).
//
// Two paths:
//   text-only post → POST /rest/posts                          (single call)
//   image post     → POST /rest/images?action=initializeUpload (get uploadUrl)
//                  → PUT  <uploadUrl>  (binary)
//                  → POST /rest/posts                          (with image URN)
//
// Image binaries: callers supply a public mediaUrl (Supabase Storage public
// URL or any HTTPS URL). We fetch it server-side and PUT to LinkedIn.
//
// Env vars:
//   LINKEDIN_API_VERSION   optional, defaults to '202410'

const API_VERSION = process.env.LINKEDIN_API_VERSION ?? '202410'
const REST_BASE   = 'https://api.linkedin.com/rest'

const COMMON_HEADERS = {
  'LinkedIn-Version':         API_VERSION,
  'X-Restli-Protocol-Version': '2.0.0',
} as const

export interface LinkedInPublishOpts {
  memberSub:    string         // LinkedIn member id (urn:li:person:<sub>)
  accessToken:  string
  message:      string
  mediaUrl?:    string
  /** Optional alt text for accessibility — required by LI if present is empty */
  altText?:     string
}

export interface LinkedInPublishResult {
  url:            string
  platformPostId: string
}

interface LinkedInErrorBody {
  message?:          string
  serviceErrorCode?: number
  status?:           number
  code?:             string
}

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    ...COMMON_HEADERS,
  }
}

async function checkOk(res: Response, where: string): Promise<void> {
  if (res.ok) return
  const body = await res.text().catch(() => '')
  let parsed: LinkedInErrorBody = {}
  try { parsed = JSON.parse(body) as LinkedInErrorBody } catch { /* */ }
  const msg  = parsed.message ?? body.slice(0, 200) ?? `HTTP ${res.status}`
  const code = parsed.serviceErrorCode ?? parsed.status ?? res.status
  throw new Error(`LinkedIn API (${where}): ${msg} [code ${code}]`)
}

// ── Image upload (Versioned API) ─────────────────────────────────────────────
// Phase 1: initialize upload → get upload URL + image URN
// Phase 2: PUT the binary to the upload URL
// Phase 3: image URN is now usable in /rest/posts

async function initializeImageUpload(
  memberSub: string,
  accessToken: string,
): Promise<{ uploadUrl: string; imageUrn: string }> {
  const res = await fetch(`${REST_BASE}/images?action=initializeUpload`, {
    method:  'POST',
    headers: {
      ...authHeaders(accessToken),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      initializeUploadRequest: { owner: `urn:li:person:${memberSub}` },
    }),
    signal: AbortSignal.timeout(15_000),
  })
  await checkOk(res, '/rest/images:initializeUpload')
  const body = await res.json() as { value?: { uploadUrl?: string; image?: string } }
  const uploadUrl = body.value?.uploadUrl
  const imageUrn  = body.value?.image
  if (!uploadUrl || !imageUrn) throw new Error('LinkedIn initializeUpload returned no uploadUrl/image')
  return { uploadUrl, imageUrn }
}

async function uploadImageBytes(uploadUrl: string, mediaUrl: string): Promise<void> {
  // Fetch the public image from our Storage URL, then PUT the binary to LI's pre-signed URL.
  const imgRes = await fetch(mediaUrl, { signal: AbortSignal.timeout(20_000) })
  if (!imgRes.ok) throw new Error(`Could not fetch source image (${imgRes.status})`)
  const contentType = imgRes.headers.get('content-type') ?? 'image/jpeg'
  const blob = await imgRes.arrayBuffer()

  const putRes = await fetch(uploadUrl, {
    method:  'PUT',
    headers: { 'Content-Type': contentType },
    body:    blob,
    signal:  AbortSignal.timeout(60_000),
  })
  if (!putRes.ok) {
    const text = await putRes.text().catch(() => '')
    throw new Error(`LinkedIn image upload PUT failed (${putRes.status}): ${text.slice(0, 200)}`)
  }
}

// ── Post creation (Versioned API) ────────────────────────────────────────────

interface PostBody {
  author:                    string
  commentary:                string
  visibility:                'PUBLIC' | 'CONNECTIONS'
  distribution: {
    feedDistribution:                  'MAIN_FEED' | 'NONE'
    targetEntities:                    unknown[]
    thirdPartyDistributionChannels:    unknown[]
  }
  lifecycleState:            'PUBLISHED'
  isReshareDisabledByAuthor: boolean
  content?: {
    media: {
      id:       string
      altText?: string
    }
  }
}

async function createPost(accessToken: string, body: PostBody): Promise<string> {
  const res = await fetch(`${REST_BASE}/posts`, {
    method:  'POST',
    headers: {
      ...authHeaders(accessToken),
      'Content-Type': 'application/json',
    },
    body:   JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  })
  await checkOk(res, '/rest/posts')

  // The created post URN comes back in x-restli-id (preferred) or x-linkedin-id
  // depending on API version. Fall back to Location header tail, then JSON body.
  const headerUrn = res.headers.get('x-restli-id')
                 ?? res.headers.get('x-linkedin-id')
                 ?? res.headers.get('location')?.split('/').pop()
  if (headerUrn) return String(headerUrn)

  const json = await res.json().catch(() => ({})) as { id?: string }
  if (!json.id) throw new Error('LinkedIn /rest/posts returned no post URN')
  return json.id
}

// ── Public entry point ───────────────────────────────────────────────────────

export async function publishToLinkedIn(opts: LinkedInPublishOpts): Promise<LinkedInPublishResult> {
  const { memberSub, accessToken, message, mediaUrl, altText } = opts

  if (!memberSub)    throw new Error('memberSub is required')
  if (!accessToken)  throw new Error('accessToken is required')
  if (!message && !mediaUrl) throw new Error('Either message or mediaUrl is required')

  const author: string = `urn:li:person:${memberSub}`

  const body: PostBody = {
    author,
    commentary:               message ?? '',
    visibility:               'PUBLIC',
    distribution: {
      feedDistribution:               'MAIN_FEED',
      targetEntities:                 [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState:            'PUBLISHED',
    isReshareDisabledByAuthor: false,
  }

  if (mediaUrl) {
    const { uploadUrl, imageUrn } = await initializeImageUpload(memberSub, accessToken)
    await uploadImageBytes(uploadUrl, mediaUrl)
    body.content = {
      media: {
        id:      imageUrn,
        altText: altText ?? message?.slice(0, 200),
      },
    }
  }

  const postUrn = await createPost(accessToken, body)
  return {
    url:            `https://www.linkedin.com/feed/update/${postUrn}/`,
    platformPostId: postUrn,
  }
}
