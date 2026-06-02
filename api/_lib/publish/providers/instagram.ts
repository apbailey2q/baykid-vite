// api/_lib/publish/providers/instagram.ts — Instagram Business publishing.
//
// Status: NOT YET IMPLEMENTED (Phase B.3).
//
// IG requires the two-step Content Publishing API:
//   1. POST /{ig_user_id}/media          { image_url | video_url, caption }
//        → returns { id: <creation_id> }
//   2. POST /{ig_user_id}/media_publish  { creation_id }
//        → returns { id: <published_media_id> }
//
// IG ALSO requires a publicly accessible media URL — text-only posts are not
// supported on the IG Graph API. Until BayKid generates/stores image media
// for AI posts (Phase B.3+), IG publishes will always be unauthorized by
// content shape, so we surface that intent explicitly rather than failing
// midway through the two-step flow.

export interface InstagramPublishOpts {
  igUserId:        string
  pageAccessToken: string   // IG publishes through the linked Page's token
  message:         string
  mediaUrl?:       string
}

export interface InstagramPublishResult {
  url:            string
  platformPostId: string
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function publishToInstagram(_opts: InstagramPublishOpts): Promise<InstagramPublishResult> {
  throw new Error(
    'Instagram publishing is not yet implemented. IG requires the two-step media flow (' +
    'POST /{ig_user_id}/media then /media_publish) and a public mediaUrl — text-only IG posts are ' +
    'not supported by the Graph API. Coming in Phase B.3.',
  )
}
