// ─────────────────────────────────────────────────────────────────────────────
// BayKid AI Marketing Center — aiMarketing.ts
// ─────────────────────────────────────────────────────────────────────────────

import type { BadgeVariant } from '../components/ui/StatusBadge'
import { supabase } from './supabaseClient'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ContentType =
  | 'social_post'
  | 'reel_script'
  | 'carousel'
  | 'comment_reply'
  | 'email_reply'
  | 'storyboard'
  | 'voiceover'
  | 'analytics_review'

export type Platform =
  | 'instagram'
  | 'tiktok'
  | 'facebook'
  | 'twitter'
  | 'linkedin'
  | 'youtube'

export type Tone =
  | 'professional'
  | 'friendly'
  | 'urgent'
  | 'educational'
  | 'inspiring'
  | 'humorous'

export type PostStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'queued'          // approved + has a PublishJob, no scheduledFor yet
  | 'scheduled'
  | 'publishing'      // transient — mirrors PublishJob.publishing during processJob
  | 'posted'
  | 'rejected'
  | 'failed'
  | 'cancelled'       // manual cancel from Publishing Queue — post reverts to 'approved' but the cancellation is logged

/** Which workflow stage a status belongs to. A post lives in exactly one
 *  stage at a time — this is the rule that fixes the duplicate-display bug. */
export type WorkflowStage = 'approval' | 'publishing' | 'calendar' | 'analytics' | 'terminal'

/** Canonical metadata for every PostStatus. Single source of truth for
 *  label / icon / badge variant / workflow stage. Per-screen STATUS_META
 *  copies in ApprovalQueue/ContentCalendar/PublishingCenter will migrate to
 *  this in later refactor steps. */
export const STATUS_META: Record<PostStatus, {
  label:        string
  badgeVariant: BadgeVariant
  icon:         string
  stage:        WorkflowStage
}> = {
  draft:            { label: 'Draft',            badgeVariant: 'draft',      icon: '📝', stage: 'approval'   },
  pending_approval: { label: 'Pending Approval', badgeVariant: 'pending',    icon: '⏳', stage: 'approval'   },
  approved:         { label: 'Approved',         badgeVariant: 'approved',   icon: '✅', stage: 'publishing' },
  queued:           { label: 'Queued',           badgeVariant: 'queued',     icon: '📋', stage: 'publishing' },
  scheduled:        { label: 'Scheduled',        badgeVariant: 'scheduled',  icon: '📅', stage: 'publishing' },
  publishing:       { label: 'Publishing',       badgeVariant: 'publishing', icon: '🚀', stage: 'publishing' },
  posted:           { label: 'Posted',           badgeVariant: 'posted',     icon: '📢', stage: 'analytics'  },
  rejected:         { label: 'Rejected',         badgeVariant: 'rejected',   icon: '✗',  stage: 'terminal'   },
  failed:           { label: 'Failed',           badgeVariant: 'failed',     icon: '⚠️', stage: 'publishing' },
  cancelled:        { label: 'Cancelled',        badgeVariant: 'cancelled',  icon: '🚫', stage: 'terminal'   },
}

export interface AIContentParams {
  contentType: ContentType
  topic: string
  platform?: Platform
  tone?: Tone
  goal?: string
  callToAction?: string
  audience?: string
}

// ── Activity timeline ─────────────────────────────────────────────────────────

export type ActivityEventType =
  | 'generated'        // AI content first created
  | 'edited'           // User manually edited content
  | 'sent_to_queue'    // Moved to Approval Queue
  | 'approved'         // Approved by admin
  | 'rejected'         // Rejected in Approval Queue
  | 'scheduled'        // Scheduled for posting
  | 'posted'           // Marked as posted
  | 'rescheduled'      // Schedule changed
  | 'lead_created'     // Lead created from this post/comment
  | 'rule_triggered'   // Automation rule fired
  | 'note'             // Free-form note

export interface ActivityEvent {
  id:        string
  type:      ActivityEventType
  label:     string           // Human-readable description
  ts:        string           // ISO timestamp
  actor?:    string           // 'AI' | 'Admin' | rule name
  meta?:     Record<string, string>  // extra kv pairs (leadId, ruleId, etc.)
}

export interface AIContentResult {
  id: string
  contentType: ContentType
  title: string
  hook: string
  caption: string
  hashtags: string[]
  script: string
  storyboard: string
  emailDraft: string
  commentReply: string
  status: PostStatus
  platform?: Platform
  tone?: Tone
  goal?: string
  callToAction?: string
  createdAt: string
  scheduledFor?: string
  /** IANA timezone string for display (e.g. 'America/Chicago') */
  timezone?: string
  /** 'claude' = real API response · 'demo' = local mock fallback */
  _source?: 'claude' | 'demo'
  /** Populated when _source==='demo' due to an API error */
  _error?: string
  /** Optional public HTTPS image URL. Required when publishing to Instagram
   *  (IG Graph API rejects text-only posts). Optional for Facebook (Page
   *  posts go via /photos when set, /feed when not). */
  mediaUrl?: string
  // ── Cross-system references ──────────────────────────────────────────────
  /** Lead created from or linked to this post */
  linkedLeadId?: string
  /** Automation rule that created or triggered this post */
  linkedRuleId?: string
  linkedRuleName?: string
  /** Original comment/email text that triggered creation (via automation) */
  linkedCommentText?: string
  /** Per-record activity timeline */
  activity?: ActivityEvent[]
}

// Lead pipeline stages. Replaces the legacy 5-stage list ('qualified' is
// rolled into 'interested'). Order here = pipeline column order in the
// Lead Tracker board view.
export type LeadStatus =
  | 'new'         // Just landed — not yet contacted
  | 'contacted'   // We've reached out, awaiting reply
  | 'interested'  // Replied positively, qualifying need
  | 'follow_up'   // Active conversation needing a scheduled next touch
  | 'converted'   // Signed up / closed-won
  | 'lost'        // Closed-lost

// Where the lead originated. 'manual' = added by hand from the Lead Tracker
// UI. The rest are automation-rule entry points used by createLeadFrom*().
export type LeadSource = 'manual' | 'comment' | 'email' | 'post'

// Social / acquisition platform the lead surfaced on. Free-form string is
// permitted so older MOCK_LEADS rows ('google', 'referral') still validate.
export type LeadPlatform =
  | 'instagram' | 'tiktok' | 'facebook' | 'twitter' | 'linkedin' | 'youtube'
  | 'email'     | 'google' | 'referral' | 'website' | 'other'

export interface Lead {
  id: string
  name: string
  email: string
  phone: string
  city: string
  platform: LeadPlatform | string
  need: string
  status: LeadStatus
  followUpDate: string
  notes: string
  createdAt: string
  // Where this lead came from. Optional for back-compat with seed data that
  // pre-dates this field; defaults to 'manual' in UI display logic.
  source?: LeadSource
  // Raw text snippet that triggered the lead (comment body, email body,
  // post caption). Stored so reviewers can see WHY a lead was auto-created.
  // Only populated for automation-sourced leads.
  sourceText?: string
  // Free-form id of the originating artifact (post id, email id, comment
  // id). Lets future surfaces deep-link back to the source.
  sourceRef?: string
  // ── Cross-system references ──────────────────────────────────────────────
  /** Post that is linked to this lead (e.g. the reply post in the queue) */
  linkedPostId?: string
  /** Automation rule that created this lead */
  linkedRuleId?: string
  linkedRuleName?: string
  /** Per-record activity timeline */
  activity?: ActivityEvent[]
}

export interface ContentCalendarItem {
  id: string
  platform: Platform
  title: string
  status: PostStatus
  callToAction: string
  scheduledFor: string
  contentType: ContentType
}

// ── Mock Posts ─────────────────────────────────────────────────────────────────

export const MOCK_POSTS: AIContentResult[] = [
  {
    id: 'post-001',
    contentType: 'social_post',
    title: 'Why Nashville Families Are Choosing Curbside Recycling',
    hook: 'Did you know the average Nashville family throws away 4.4 lbs of recyclables every single day? 😱',
    caption:
      `That's over 1,600 lbs a year going straight to the landfill — and it doesn't have to be that way.\n\nCyan's Brooklynn makes recycling effortless. We pick up right from your curb, so there's no sorting, no hauling, and no guesswork.\n\n♻️ Cardboard, plastic, glass, e-waste — we handle it all.\n📍 Now serving Nashville and surrounding communities.\n\nReady to make a real difference without the extra effort? Link in bio to sign up in under 2 minutes.`,
    hashtags: [
      '#Nashville',
      '#RecycleNashville',
      '#CyansBrooklynn',
      '#CurbsideRecycling',
      '#EcoFriendly',
      '#GreenLiving',
      '#SustainableNashville',
      '#ZeroWaste',
      '#RecyclingPickup',
      '#NashvilleGreen',
    ],
    script:
      `Open on a family putting recyclables in a bin outside their Nashville home. Cut to Cyan's Brooklynn truck pulling up. Driver smiles, grabs bin, waves. Text overlay: "We handle the recycling — you handle the living." Close on Cyan's Brooklynn logo with website URL.`,
    storyboard:
      `Scene 1: Family sorting items at kitchen table (5s). Scene 2: Dad placing bin at curb (3s). Scene 3: Cyan's Brooklynn truck arrives — bright logo visible (4s). Scene 4: Driver loads bin, gives thumbs up (3s). Scene 5: Family relaxing inside, text overlay "Recycling handled." (5s). Scene 6: Logo + cbrecycling.org CTA (3s).`,
    emailDraft: '',
    commentReply: '',
    status: 'approved',
    platform: 'instagram',
    tone: 'friendly',
    goal: 'Increase signups',
    callToAction: 'Sign up at cbrecycling.org',
    createdAt: '2026-05-20T10:00:00Z',
    scheduledFor: '2026-05-28T14:00:00Z',
  },
  {
    id: 'post-002',
    contentType: 'reel_script',
    title: 'POV: You Finally Found a Recycling Service That Actually Shows Up',
    hook: 'POV: You scheduled a curbside recycling pickup and they actually showed up on time 👀',
    caption:
      `No more excuses. No more "I'll drop it off later." Cyan's Brooklynn shows up so you don't have to go anywhere.\n\n✅ Reliable weekly or bi-weekly pickups\n✅ Text reminders so you never forget\n✅ Eco-certified handling for every material\n\nNashville — your recycling game just leveled up. 🙌\n\nComment "PICKUP" and we'll send you our service area map!`,
    hashtags: [
      '#RecyclingTikTok',
      '#NashvilleTikTok',
      '#EcoTok',
      '#CyansBrooklynn',
      '#SustainableLiving',
      '#RecyclePOV',
      '#GreenTok',
      '#WasteReduction',
      '#CurbsidePickup',
      '#NashvilleLife',
    ],
    script:
      `Hook (0–3s): Close-up of phone notification: "Your Cyan's Brooklynn pickup is scheduled for tomorrow!" React with surprise and excitement.\nBody (3–18s): Time-lapse of filling recycling bin — cardboard boxes, plastic bottles, old electronics. Cut to morning: bin at curb. Cyan's Brooklynn truck rolls up exactly at scheduled time. Driver loads everything efficiently.\nClose (18–25s): Back inside — cozy, relaxed. Text: "That's it. That's the whole video." Logo + "cbrecycling.org" fades in.`,
    storyboard:
      `Frame 1: Phone screen with pickup notification (POV). Frame 2: Montage of filling bin with recyclables. Frame 3: Bin placed at curb at dawn. Frame 4: Cyan's Brooklynn truck arrives — wide shot of neighborhood. Frame 5: Driver loads bin, waves at camera. Frame 6: Creator relaxes indoors, smiles. Frame 7: CTA overlay + logo.`,
    emailDraft: '',
    commentReply: '',
    status: 'pending_approval',
    platform: 'tiktok',
    tone: 'humorous',
    goal: 'Brand awareness and engagement',
    callToAction: 'Comment PICKUP for service area map',
    createdAt: '2026-05-22T09:15:00Z',
  },
  {
    id: 'post-003',
    contentType: 'carousel',
    title: `5 Items You Didn't Know Cyan's Brooklynn Recycles`,
    hook: 'Most people recycle bottles and cans. But what about these? 👇 (Swipe to see what we take)',
    caption:
      `You'd be surprised what can be recycled with Cyan's Brooklynn.\n\nSwipe through to see 5 items most people throw away — that we pick up for free as part of your subscription.\n\nFrom old electronics to foam packaging, we've got you covered.\n\n📍 Nashville-area pickup available now.\n👇 Drop a "🙋" if one of these surprised you!`,
    hashtags: [
      '#RecyclingFacts',
      '#Nashville',
      '#CyansBrooklynnRecycling',
      '#EWaste',
      '#SustainableHome',
      '#ZeroWasteTips',
      '#EcoEducation',
      '#RecyclingTips',
      '#NashvilleEnvironment',
      '#GoGreen',
    ],
    script:
      `Slide 1: "5 Things Cyan's Brooklynn Recycles That You're Probably Throwing Away" (title card). Slide 2: Electronics — old phones, chargers, keyboards. Slide 3: Foam packaging — packing peanuts, styrofoam trays. Slide 4: Shredded paper — yes, even the confetti kind. Slide 5: Batteries — AA, AAA, rechargeable. Slide 6: Broken glass — handled safely so you don't cut yourself. Slide 7: CTA — "Sign up at cbrecycling.org. We pick it all up."`,
    storyboard:
      `Carousel layout: 7 slides. Each slide has a large emoji icon, bold item name, short description (2 lines), and Cyan's Brooklynn brand color accent. Final slide is CTA with gradient background and website URL.`,
    emailDraft: '',
    commentReply: '',
    status: 'draft',
    platform: 'instagram',
    tone: 'educational',
    goal: 'Educate audience, reduce stigma about recycling complexity',
    callToAction: 'Sign up at cbrecycling.org',
    createdAt: '2026-05-23T14:30:00Z',
  },
  {
    id: 'post-004',
    contentType: 'social_post',
    title: `Cyan's Brooklynn Partners With Local Nashville Schools`,
    hook: `🏫 Big news, Nashville! Cyan's Brooklynn is now partnering with local schools to bring recycling education AND pickup right to the campus.`,
    caption:
      `We believe the next generation of eco-warriors is in classrooms right now — and we want to help them make an impact today.\n\nOur school program includes:\n📦 Weekly curbside pickup for the cafeteria, classrooms, and offices\n📚 Free recycling curriculum for K–8 students\n🏆 School leaderboard — compete for the most recycled materials in Nashville!\n\nInterested in bringing Cyan's Brooklynn to your school? Email us at schools@cbrecycling.org or tag a teacher below. 🙌`,
    hashtags: [
      '#NashvilleSchools',
      '#EducationForSustainability',
      '#CyansBrooklynn',
      '#SchoolRecycling',
      '#MetroNashville',
      '#GreenSchools',
      '#KidsWhoRecycle',
      '#NashvilleCommunity',
      '#EcoKids',
      '#RecycleForSchools',
    ],
    script: '',
    storyboard: '',
    emailDraft: '',
    commentReply: '',
    status: 'scheduled',
    platform: 'facebook',
    tone: 'inspiring',
    goal: 'Partnerships with schools',
    callToAction: 'Email schools@cbrecycling.org',
    createdAt: '2026-05-21T11:00:00Z',
    scheduledFor: '2026-05-29T09:00:00Z',
  },
  {
    id: 'post-005',
    contentType: 'social_post',
    title: 'Summer Recycling Challenge — Nashville Edition',
    hook: `☀️ This summer, Nashville — let's see who can recycle the most. We're issuing the Cyan's Brooklynn Summer Challenge.`,
    caption:
      `Here's how it works:\n\n1️⃣ Sign up for Cyan's Brooklynn curbside pickup\n2️⃣ Track your recycling weight each week (we log it for you)\n3️⃣ Share your progress with #CyansBrooklynnSummerChallenge\n\nTop recycling household each month wins a $50 gift card to a local Nashville restaurant. 🍕\n\nChallenge starts June 1st. Don't wait — spots are limited for new subscribers this month!\n\n👇 Tag a neighbor to compete with!`,
    hashtags: [
      '#CyansBrooklynnSummerChallenge',
      '#NashvilleRecycles',
      '#SummerChallenge',
      '#EcoChallenge',
      '#CyansBrooklynn',
      '#GreenSummer',
      '#NashvilleContest',
      '#RecycleToWin',
      '#SustainableNashville',
      '#CommunityChallenge',
    ],
    script: '',
    storyboard: '',
    emailDraft: '',
    commentReply: '',
    status: 'draft',
    platform: 'instagram',
    tone: 'urgent',
    goal: 'Drive new subscriptions before summer',
    callToAction: 'Sign up before June 1st at cbrecycling.org',
    createdAt: '2026-05-24T08:45:00Z',
  },
  {
    id: 'post-006',
    contentType: 'social_post',
    title: `Why Your Business Should Recycle With Cyan's Brooklynn`,
    hook: '📊 Nashville businesses: Did you know proper recycling can reduce your waste disposal costs by up to 30%?',
    caption:
      `Cyan's Brooklynn's commercial recycling program is built for Nashville businesses that want to do right by the planet — and their bottom line.\n\nWhat's included:\n🏢 Scheduled pickups that fit your operating hours\n📋 Monthly recycling reports for sustainability reporting\n♻️ Certified handling for regulated materials (electronics, batteries, metals)\n💼 Dedicated account manager for your business\n\nWe serve restaurants, offices, retail stores, apartments, and more across Greater Nashville.\n\nDM us or visit cbrecycling.org/business to request a free quote.`,
    hashtags: [
      '#NashvilleBusiness',
      '#CommercialRecycling',
      '#CyansBrooklynn',
      '#SustainableBusiness',
      '#NashvilleEntrepreneur',
      '#GreenBusiness',
      '#WasteManagement',
      '#BusinessSustainability',
      '#NashvilleB2B',
      '#EcoCommerce',
    ],
    script: '',
    storyboard: '',
    emailDraft: '',
    commentReply: '',
    status: 'pending_approval',
    platform: 'linkedin',
    tone: 'professional',
    goal: 'Generate commercial leads',
    callToAction: 'Visit cbrecycling.org/business for a free quote',
    createdAt: '2026-05-25T13:00:00Z',
  },
]

// ── Mock Leads ─────────────────────────────────────────────────────────────────

export const MOCK_LEADS: Lead[] = [
  {
    id: 'lead-001',
    name: 'Marcus Johnson',
    email: 'mjohnson@thebrewnashville.com',
    phone: '(615) 555-0142',
    city: 'Nashville',
    platform: 'instagram',
    need: 'Commercial recycling for restaurant — glass, cardboard, food containers',
    status: 'interested',
    followUpDate: '2026-05-28',
    notes: 'Runs The Brew Nashville on 12th Ave. Very interested. Wants weekly pickup. Has existing waste contract expiring July.',
    createdAt: '2026-05-18T10:30:00Z',
  },
  {
    id: 'lead-002',
    name: 'Keisha Williams',
    email: 'keisha.w@meharrymed.edu',
    phone: '(615) 555-0287',
    city: 'Nashville',
    platform: 'facebook',
    need: 'School/university recycling program — e-waste, paper, plastics',
    status: 'contacted',
    followUpDate: '2026-05-30',
    notes: 'Sustainability coordinator at Meharry Medical College. Needs a proposal with pricing and a campus map of pickup zones.',
    createdAt: '2026-05-19T14:15:00Z',
  },
  {
    id: 'lead-003',
    name: 'Pastor David Osei',
    email: 'pastor@gracechapelnashville.org',
    phone: '(615) 555-0391',
    city: 'Antioch',
    platform: 'referral',
    need: 'Church recycling — paper bulletins, plastic cups, cardboard boxes from food pantry',
    status: 'new',
    followUpDate: '2026-05-27',
    notes: 'Grace Chapel has ~400 members. Interested in a community recycling event AND ongoing pickup. Referred by Marcus Johnson.',
    createdAt: '2026-05-22T09:00:00Z',
  },
  {
    id: 'lead-004',
    name: 'Tanya Reeves',
    email: 'treeves@greenviewapts.com',
    phone: '(615) 555-0456',
    city: 'Brentwood',
    platform: 'google',
    need: 'Apartment complex recycling — 120 units, centralized dumpster area',
    status: 'interested',
    followUpDate: '2026-05-29',
    notes: 'Property manager at Greenview Apartments. Currently has no recycling program. HOA is pushing for one. Decision maker.',
    createdAt: '2026-05-20T16:45:00Z',
  },
  {
    id: 'lead-005',
    name: 'Derek Huang',
    email: 'derek@nashvillegreenfund.org',
    phone: '(615) 555-0578',
    city: 'Nashville',
    platform: 'linkedin',
    need: `Sponsorship / grant funding for Cyan's Brooklynn community program`,
    status: 'contacted',
    followUpDate: '2026-06-01',
    notes: 'Program officer at Nashville Green Fund. Interested in co-sponsoring free recycling for 3 low-income zip codes. Needs impact numbers.',
    createdAt: '2026-05-21T11:30:00Z',
  },
  {
    id: 'lead-006',
    name: 'Sandra Mitchell',
    email: 'smitchell@hermitageelementary.mnps.org',
    phone: '(615) 555-0634',
    city: 'Hermitage',
    platform: 'facebook',
    need: 'Elementary school recycling education + curbside pickup',
    status: 'new',
    followUpDate: '2026-05-28',
    notes: 'Principal at Hermitage Elementary. Saw our Facebook post about school partnerships. Has budget for a pilot program this fall.',
    createdAt: '2026-05-23T08:15:00Z',
  },
  {
    id: 'lead-007',
    name: 'James "JT" Thompson',
    email: 'jt@nashvilleautobody.com',
    phone: '(615) 555-0712',
    city: 'Madison',
    platform: 'tiktok',
    need: 'Auto shop recycling — metal scrap, used oil containers, cardboard',
    status: 'converted',
    followUpDate: '2026-06-05',
    notes: 'Signed up for commercial plan on 5/24. First pickup scheduled for June 5th. Great brand advocate — already shared our TikTok.',
    createdAt: '2026-05-15T13:00:00Z',
  },
  {
    id: 'lead-008',
    name: 'Alicia Barton',
    email: 'alicia@nashvilleartmarket.com',
    phone: '(615) 555-0891',
    city: 'East Nashville',
    platform: 'instagram',
    need: 'Event recycling for monthly outdoor art market — 500–1,000 attendees',
    status: 'new',
    followUpDate: '2026-05-30',
    notes: 'Organizer of Nashville Art Market held every 3rd Saturday. Wants recycling stations + post-event pickup. Potential recurring monthly contract.',
    createdAt: '2026-05-25T10:00:00Z',
  },
]

// ── Mock Calendar ──────────────────────────────────────────────────────────────

export const MOCK_CALENDAR: ContentCalendarItem[] = [
  {
    id: 'cal-001',
    platform: 'instagram',
    title: 'Why Nashville Families Are Choosing Curbside Recycling',
    status: 'scheduled',
    callToAction: 'Sign up at cbrecycling.org',
    scheduledFor: '2026-05-28T14:00:00Z',
    contentType: 'social_post',
  },
  {
    id: 'cal-002',
    platform: 'tiktok',
    title: 'POV: Curbside Pickup That Actually Shows Up',
    status: 'pending_approval',
    callToAction: 'Comment PICKUP for service area map',
    scheduledFor: '2026-05-28T17:00:00Z',
    contentType: 'reel_script',
  },
  {
    id: 'cal-003',
    platform: 'facebook',
    title: `Cyan's Brooklynn Partners With Local Nashville Schools`,
    status: 'scheduled',
    callToAction: 'Email schools@cbrecycling.org',
    scheduledFor: '2026-05-29T09:00:00Z',
    contentType: 'social_post',
  },
  {
    id: 'cal-004',
    platform: 'instagram',
    title: `5 Items You Didn't Know Cyan's Brooklynn Recycles`,
    status: 'draft',
    callToAction: 'Sign up at cbrecycling.org',
    scheduledFor: '2026-05-30T12:00:00Z',
    contentType: 'carousel',
  },
  {
    id: 'cal-005',
    platform: 'linkedin',
    title: `Why Your Business Should Recycle With Cyan's Brooklynn`,
    status: 'pending_approval',
    callToAction: 'Visit cbrecycling.org/business',
    scheduledFor: '2026-05-30T14:00:00Z',
    contentType: 'social_post',
  },
  {
    id: 'cal-006',
    platform: 'youtube',
    title: `Cyan's Brooklynn Behind the Scenes: A Day on the Route`,
    status: 'draft',
    callToAction: 'Subscribe for weekly eco tips',
    scheduledFor: '2026-06-01T10:00:00Z',
    contentType: 'storyboard',
  },
  {
    id: 'cal-007',
    platform: 'tiktok',
    title: 'Recycling Myth-Busting: Nashville Edition',
    status: 'approved',
    callToAction: 'Share with a Nashville neighbor',
    scheduledFor: '2026-06-02T16:00:00Z',
    contentType: 'reel_script',
  },
  {
    id: 'cal-008',
    platform: 'instagram',
    title: 'Summer Recycling Challenge — Nashville Edition',
    status: 'draft',
    callToAction: 'Sign up before June 1st at cbrecycling.org',
    scheduledFor: '2026-06-03T13:00:00Z',
    contentType: 'social_post',
  },
  {
    id: 'cal-009',
    platform: 'facebook',
    title: 'Customer Spotlight: Greenview Apartments',
    status: 'draft',
    callToAction: 'Get a free quote at cbrecycling.org/business',
    scheduledFor: '2026-06-05T09:00:00Z',
    contentType: 'social_post',
  },
  {
    id: 'cal-010',
    platform: 'instagram',
    title: 'Friday Recycling Tip: What to Do With Old Batteries',
    status: 'approved',
    callToAction: 'Schedule a pickup at cbrecycling.org',
    scheduledFor: '2026-06-06T11:00:00Z',
    contentType: 'social_post',
  },
]

// ── Claude Prompts ─────────────────────────────────────────────────────────────

export const CLAUDE_PROMPTS: Record<ContentType, string> = {
  social_post: `You are a social media marketing expert for Cyan's Brooklynn Recycling — a curbside recycling pickup service based in Nashville, TN. Cyan's Brooklynn makes recycling effortless for families, businesses, schools, and apartment communities by picking up recyclables directly from the curb on a scheduled basis.

Your task: Write a compelling social media post based on the topic and parameters provided.

Return ONLY valid JSON matching this exact structure:
{
  "id": "generated-uuid",
  "contentType": "social_post",
  "title": "Short descriptive title",
  "hook": "Attention-grabbing opening line (1–2 sentences)",
  "caption": "Full post body with line breaks, emojis, and call-to-action",
  "hashtags": ["#array", "#of", "#relevant", "#hashtags"],
  "script": "",
  "storyboard": "",
  "emailDraft": "",
  "commentReply": "",
  "status": "draft",
  "platform": "platform from params",
  "tone": "tone from params",
  "goal": "goal from params",
  "callToAction": "cta from params",
  "createdAt": "ISO timestamp"
}

Cyan's Brooklynn voice: Community-first, eco-motivated, approachable. Always tie environmental impact to local Nashville identity. Never preachy — practical and positive.`,

  reel_script: `You are a video content strategist for Cyan's Brooklynn Recycling — a Nashville, TN curbside recycling pickup service. Your specialty is writing short-form video scripts (15–60 seconds) optimized for TikTok and Instagram Reels.

Your task: Write a compelling reel script based on the topic and parameters provided.

Return ONLY valid JSON matching this exact structure:
{
  "id": "generated-uuid",
  "contentType": "reel_script",
  "title": "Short descriptive title",
  "hook": "Opening line / first 3 seconds — must stop the scroll",
  "caption": "Post caption with hashtags area",
  "hashtags": ["#relevant", "#hashtags"],
  "script": "Full timestamped script: Hook (0-3s): ... Body (3-25s): ... CTA (25-30s): ...",
  "storyboard": "Scene-by-scene shot list",
  "emailDraft": "",
  "commentReply": "",
  "status": "draft",
  "platform": "platform from params",
  "tone": "tone from params",
  "goal": "goal from params",
  "callToAction": "cta from params",
  "createdAt": "ISO timestamp"
}

Script style: Authentic, fast-paced, mobile-first. Use trending formats (POV, Day-in-the-life, Myth vs. Fact) adapted for recycling content.`,

  carousel: `You are a social media designer and copywriter for Cyan's Brooklynn Recycling — a Nashville, TN curbside recycling pickup service. Your specialty is educational Instagram carousel posts that teach and convert.

Your task: Write a multi-slide carousel post (5–8 slides) based on the topic and parameters provided.

Return ONLY valid JSON matching this exact structure:
{
  "id": "generated-uuid",
  "contentType": "carousel",
  "title": "Short descriptive title",
  "hook": "Slide 1 headline — must make people want to swipe",
  "caption": "Post caption encouraging swipes, with CTA",
  "hashtags": ["#relevant", "#hashtags"],
  "script": "Slide-by-slide copy: Slide 1: [headline]. Slide 2: [content]. ...",
  "storyboard": "Visual layout description for each slide",
  "emailDraft": "",
  "commentReply": "",
  "status": "draft",
  "platform": "instagram",
  "tone": "tone from params",
  "goal": "goal from params",
  "callToAction": "cta from params",
  "createdAt": "ISO timestamp"
}

Carousel style: Each slide should deliver one clear insight. Use numbers, bold claims, and visual contrast. Final slide is always CTA.`,

  comment_reply: `You are a community manager for Cyan's Brooklynn Recycling — a Nashville, TN curbside recycling pickup service. Your role is to respond to comments on social media in a way that builds community, answers questions accurately, and occasionally converts commenters into customers.

Your task: Write a thoughtful, on-brand reply to the comment or question provided.

Return ONLY valid JSON matching this exact structure:
{
  "id": "generated-uuid",
  "contentType": "comment_reply",
  "title": "Brief description of the comment being addressed",
  "hook": "",
  "caption": "",
  "hashtags": [],
  "script": "",
  "storyboard": "",
  "emailDraft": "",
  "commentReply": "The full reply text (2–4 sentences, conversational, on-brand)",
  "status": "draft",
  "platform": "platform from params",
  "tone": "friendly",
  "goal": "goal from params",
  "callToAction": "cta from params",
  "createdAt": "ISO timestamp"
}

Reply style: Warm, helpful, never defensive. Use the commenter's name if provided. Address concerns directly. Always end with an invitation (to DM, visit the site, or ask more questions).`,

  email_reply: `You are a customer success specialist for Cyan's Brooklynn Recycling — a Nashville, TN curbside recycling pickup service. You write professional, friendly email replies that solve problems, answer questions, and move prospects toward conversion.

Your task: Write a polished email reply based on the context provided.

Return ONLY valid JSON matching this exact structure:
{
  "id": "generated-uuid",
  "contentType": "email_reply",
  "title": "Email subject line",
  "hook": "",
  "caption": "",
  "hashtags": [],
  "script": "",
  "storyboard": "",
  "emailDraft": "Full email body including greeting, paragraphs, and sign-off. Use \\n for line breaks.",
  "commentReply": "",
  "status": "draft",
  "platform": "email",
  "tone": "tone from params",
  "goal": "goal from params",
  "callToAction": "cta from params",
  "createdAt": "ISO timestamp"
}

Email voice: Professional but warm. Clear structure: acknowledge → answer/resolve → next step → sign-off. Signature: [Name], Cyan's Brooklynn Recycling Team | hello@cbrecycling.org | cbrecycling.org`,

  storyboard: `You are a video director and content strategist for Cyan's Brooklynn Recycling — a Nashville, TN curbside recycling pickup service. You create detailed storyboards for brand videos, explainers, and social content.

Your task: Write a detailed storyboard based on the topic and parameters provided.

Return ONLY valid JSON matching this exact structure:
{
  "id": "generated-uuid",
  "contentType": "storyboard",
  "title": "Video title",
  "hook": "Opening scene description — what viewers see and hear first",
  "caption": "YouTube/social description for this video",
  "hashtags": ["#relevant", "#hashtags"],
  "script": "Full voiceover/dialogue script synced to scenes",
  "storyboard": "Detailed scene-by-scene breakdown: Scene N (Xs): [Visual] | [Audio] | [Text Overlay]",
  "emailDraft": "",
  "commentReply": "",
  "status": "draft",
  "platform": "platform from params",
  "tone": "tone from params",
  "goal": "goal from params",
  "callToAction": "cta from params",
  "createdAt": "ISO timestamp"
}

Storyboard style: Cinematic but achievable with a smartphone and basic editing. Focus on real Nashville locations and authentic Cyan's Brooklynn moments.`,

  voiceover: `You are a voiceover scriptwriter for Cyan's Brooklynn Recycling — a Nashville, TN curbside recycling pickup service. You write punchy, professional voiceover scripts for ads, explainers, and social videos.

Your task: Write a voiceover script based on the topic and parameters provided.

Return ONLY valid JSON matching this exact structure:
{
  "id": "generated-uuid",
  "contentType": "voiceover",
  "title": "Script title",
  "hook": "Opening line (first words the audience hears)",
  "caption": "Post or video description",
  "hashtags": ["#relevant", "#hashtags"],
  "script": "Full voiceover script with [PAUSE], [MUSIC UP], [SFX] directions. Duration noted in parens.",
  "storyboard": "",
  "emailDraft": "",
  "commentReply": "",
  "status": "draft",
  "platform": "platform from params",
  "tone": "tone from params",
  "goal": "goal from params",
  "callToAction": "cta from params",
  "createdAt": "ISO timestamp"
}

Voiceover style: Conversational yet polished. Rhythm matters — write to be spoken aloud. Match tone to the platform (energetic for TikTok, warm for Facebook, authoritative for LinkedIn).`,

  analytics_review: `You are a digital marketing analyst for Cyan's Brooklynn Recycling — a Nashville, TN curbside recycling pickup service. You analyze social media and marketing performance data and provide actionable recommendations.

Your task: Write a marketing analytics review and recommendation report based on the metrics and context provided.

Return ONLY valid JSON matching this exact structure:
{
  "id": "generated-uuid",
  "contentType": "analytics_review",
  "title": "Analytics Review: [Period/Topic]",
  "hook": "Key insight or headline finding (1 sentence)",
  "caption": "Executive summary (3–4 sentences)",
  "hashtags": [],
  "script": "Full analytics narrative: Performance Summary → Top Performers → Areas for Improvement → Recommendations → Next 30-Day Plan",
  "storyboard": "",
  "emailDraft": "",
  "commentReply": "",
  "status": "draft",
  "platform": "instagram",
  "tone": "professional",
  "goal": "goal from params",
  "callToAction": "cta from params",
  "createdAt": "ISO timestamp"
}

Analysis style: Data-first, insight-driven. Always connect metrics to business outcomes (signups, leads, brand awareness). Recommendations should be specific and achievable within the next 30 days.`,
}

// ── Mock Responses for generateAIContent ──────────────────────────────────────

const MOCK_RESPONSES: Partial<Record<ContentType, AIContentResult>> = {
  social_post: {
    id: `mock-${Date.now()}`,
    contentType: 'social_post',
    title: `Cyan's Brooklynn Recycling — Nashville's Easiest Green Habit`,
    hook: '♻️ Nashville, what if recycling was as easy as putting your trash out?',
    caption:
      `With Cyan's Brooklynn, it is.\n\nWe pick up your recyclables right from your curb — cardboard, glass, plastic, e-waste — on a schedule that works for you.\n\nNo sorting stress. No drop-off trips. Just easy, reliable recycling that actually makes a difference for our city.\n\n📍 Serving Nashville and surrounding communities.\n✅ Weekly and bi-weekly plans available.\n\nSign up in under 2 minutes at cbrecycling.org — your neighborhood (and your conscience) will thank you. 🌿`,
    hashtags: [
      '#Nashville',
      '#RecycleNashville',
      '#CyansBrooklynn',
      '#CurbsideRecycling',
      '#EcoFriendly',
      '#SustainableNashville',
      '#GreenLiving',
      '#ZeroWaste',
      '#NashvilleLife',
      '#RecyclingMadeEasy',
    ],
    script:
      `Open on Nashville skyline at sunrise. Cut to a family placing their Cyan's Brooklynn recycling bin at the curb. Cyan's Brooklynn truck pulls up — driver waves. Text overlay: "Recycling, handled." Close on cbrecycling.org CTA with bright green logo.`,
    storyboard:
      `Scene 1 (3s): Aerial Nashville at dawn. Scene 2 (4s): Family carries full recycling bin to curb — smiling. Scene 3 (3s): Cyan's Brooklynn truck arrives, logo visible. Scene 4 (4s): Driver loads bin efficiently, gives thumbs up. Scene 5 (5s): Family inside looking relaxed — text: "Recycling handled. cbrecycling.org." Scene 6 (3s): Logo card with website and subscribe CTA.`,
    emailDraft: '',
    commentReply: '',
    status: 'draft',
    platform: 'instagram',
    tone: 'friendly',
    goal: 'Increase signups',
    callToAction: 'Sign up at cbrecycling.org',
    createdAt: new Date().toISOString(),
  },
  reel_script: {
    id: `mock-${Date.now()}`,
    contentType: 'reel_script',
    title: `A Day With Cyan's Brooklynn — Nashville Curbside Recycling`,
    hook: `What if your recycling actually got picked up? 👀 (Nashville, this one's for you)`,
    caption:
      `We know, we know — you've been meaning to recycle more. Cyan's Brooklynn makes it effortless.\n\n♻️ Schedule. Set out. Done.\n\nComment "PICKUP" for our Nashville service map!`,
    hashtags: [
      '#RecyclingTikTok',
      '#NashvilleTikTok',
      '#EcoTok',
      '#CyansBrooklynn',
      '#CurbsidePickup',
      '#SustainableLiving',
      '#GreenTok',
      '#NashvilleLife',
    ],
    script:
      `Hook (0-3s): Creator holds up overflowing recycling bag. "Okay, Nashville — I finally found a recycling service that doesn't cancel on you."\nBody (3-22s): Show phone — schedule pickup in the Cyan's Brooklynn app. Next morning: bin placed at curb (time-lapse sunrise). Cyan's Brooklynn truck rolls up exactly on time. Driver loads everything. Creator waves from front door.\nCTA (22-28s): Text overlay "cbrecycling.org — curbside recycling in Nashville." Creator: "Link in bio. Thank me later."`,
    storyboard:
      `Frame 1: Creator with full recycling bag, talking to camera (hook). Frame 2: Phone screen — scheduling pickup in app. Frame 3: Time-lapse — sun rising, bin appears at curb. Frame 4: Cyan's Brooklynn truck arrives — wide residential shot. Frame 5: Driver loads bin, waves. Frame 6: Creator at door giving thumbs up. Frame 7: Text CTA overlay + logo.`,
    emailDraft: '',
    commentReply: '',
    status: 'draft',
    platform: 'tiktok',
    tone: 'humorous',
    goal: 'Brand awareness',
    callToAction: 'Link in bio',
    createdAt: new Date().toISOString(),
  },
  carousel: {
    id: `mock-${Date.now()}`,
    contentType: 'carousel',
    title: '5 Recycling Myths Nashville Residents Still Believe',
    hook: '🚨 Swipe before you put anything in the recycling bin. These myths are costing Nashville tons of landfill space.',
    caption:
      `Recycling is more confusing than it should be — and that's not your fault.\n\nSwipe through to bust 5 common myths and learn what Cyan's Brooklynn actually accepts. 👇\n\nSave this post the next time you're unsure what goes where! ♻️`,
    hashtags: [
      '#RecyclingMyths',
      '#Nashville',
      '#CyansBrooklynn',
      '#RecyclingFacts',
      '#SustainableLiving',
      '#ZeroWasteTips',
      '#EcoEducation',
      '#NashvilleGreen',
    ],
    script:
      `Slide 1: "5 Recycling Myths Nashville Residents Still Believe" (bold title card, Cyan's Brooklynn branding).\nSlide 2: Myth #1 — "Greasy pizza boxes can't be recycled." Truth: Tear off the clean top half — that can be recycled!\nSlide 3: Myth #2 — "All plastics are recyclable." Truth: Look for #1 and #2 — those are the most accepted.\nSlide 4: Myth #3 — "You have to rinse containers perfectly." Truth: A quick rinse is enough. Bone dry isn't needed.\nSlide 5: Myth #4 — "Small items like bottle caps are too small to recycle." Truth: Screw caps back on the bottle before recycling.\nSlide 6: Myth #5 — "Recycling doesn't actually make a difference." Truth: Nashville diverted 12,000 tons of recyclables last year — every bin counts.\nSlide 7: "Cyan's Brooklynn picks up what others leave behind. Start your Nashville recycling pickup at cbrecycling.org."`,
    storyboard:
      `Each slide: Dark background with Cyan's Brooklynn cyan accent. Bold myth in red/crossed-out font. Truth in white below. Icon per category (pizza, plastic bottle, water drop, cap, globe). Final slide: gradient background, logo centered, website URL large.`,
    emailDraft: '',
    commentReply: '',
    status: 'draft',
    platform: 'instagram',
    tone: 'educational',
    goal: 'Educate audience',
    callToAction: 'Start pickup at cbrecycling.org',
    createdAt: new Date().toISOString(),
  },
  comment_reply: {
    id: `mock-${Date.now()}`,
    contentType: 'comment_reply',
    title: 'Reply to service area question',
    hook: '',
    caption: '',
    hashtags: [],
    script: '',
    storyboard: '',
    emailDraft: '',
    commentReply:
      `Hey! Great question 🙌 We currently serve Nashville proper, Brentwood, Antioch, Madison, and Hermitage — with more neighborhoods being added monthly. You can check our full service map at cbrecycling.org/service-area or DM us your zip code and we'll let you know instantly! We'd love to have you on board. ♻️`,
    status: 'draft',
    platform: 'instagram',
    tone: 'friendly',
    goal: 'Convert commenter to customer',
    callToAction: 'Check cbrecycling.org/service-area',
    createdAt: new Date().toISOString(),
  },
  email_reply: {
    id: `mock-${Date.now()}`,
    contentType: 'email_reply',
    title: 'Re: Interested in Commercial Recycling for Our Business',
    hook: '',
    caption: '',
    hashtags: [],
    script: '',
    storyboard: '',
    emailDraft:
      `Hi [Name],\n\nThank you so much for reaching out — we love hearing from Nashville businesses that want to make recycling part of their operations!\n\nCyan's Brooklynn's commercial program is designed to be completely hassle-free. We offer scheduled weekly or bi-weekly pickups at times that work around your business hours, and we handle cardboard, plastics, glass, e-waste, metals, and more.\n\nHere's how we'd get started:\n1. Quick 15-minute call to understand your volume and materials\n2. We'll send over a custom quote within 24 hours\n3. First pickup can happen within the week\n\nWould you have 15 minutes this week for a quick call? I'd love to put together a proposal that works for your business.\n\nLooking forward to hearing from you!\n\nBest,\nCyan's Brooklynn Recycling Team\nhello@cbrecycling.org | cbrecycling.org/business`,
    commentReply: '',
    status: 'draft',
    platform: 'instagram',
    tone: 'professional',
    goal: 'Book discovery call',
    callToAction: 'Schedule a 15-minute call',
    createdAt: new Date().toISOString(),
  },
  storyboard: {
    id: `mock-${Date.now()}`,
    contentType: 'storyboard',
    title: `Cyan's Brooklynn: A Day on the Route — Nashville`,
    hook: `Aerial shot of Nashville at 6:00 AM — city waking up. Cyan's Brooklynn truck rolls out of the depot, logo gleaming in morning light.`,
    caption:
      `Follow Cyan's Brooklynn's recycling crew through a full day of pickups across Nashville. From East Nashville bungalows to Brentwood apartment complexes — we show up, every time.\n\n🎥 Behind the scenes of Nashville's favorite recycling pickup service.`,
    hashtags: [
      '#CyansBrooklynn',
      '#NashvilleRecycles',
      '#BehindTheScenes',
      '#EcoNashville',
      '#RecyclingPickup',
      '#NashvilleLife',
    ],
    script:
      `VO: "Every morning in Nashville, something good is happening."\n[Scene: Sunrise, truck leaves depot]\nVO: "The Cyan's Brooklynn team hits the road before most people have their coffee."\n[Scene: Route through East Nashville neighborhoods]\nVO: "We pick up recyclables from families, businesses, and schools — so they don't have to make a single trip."\n[Scene: Driver loading bins from apartment complex]\nVO: "By noon, we've collected enough material to fill a small warehouse."\n[Scene: Materials sorted at facility]\nVO: "And by end of day, that's hundreds of pounds of plastic, glass, and cardboard that won't end up in a landfill."\n[Scene: Cyan's Brooklynn team high-fiving at depot at sunset]\nVO: "Cyan's Brooklynn. Nashville's recycling crew. Join us at cbrecycling.org."`,
    storyboard:
      `Scene 1 (5s): Aerial Nashville dawn. BG music begins soft and building. | VO intro.\nScene 2 (4s): Wide shot of Cyan's Brooklynn depot — truck pulls out. Logo visible. | VO: "before most people have their coffee."\nScene 3 (6s): Truck drives through tree-lined East Nashville street. | VO: pickup benefits.\nScene 4 (5s): Driver exits truck, loads bins from front porch. Homeowner waves. | VO: "families and businesses."\nScene 5 (5s): Time-lapse of sorting facility — materials flowing. | VO: "enough material to fill a warehouse."\nScene 6 (4s): Crew high-fives at end of shift — golden hour lighting. | VO: impact stats.\nScene 7 (5s): Logo card. cbrecycling.org URL. "Join the route." | Music resolves.`,
    emailDraft: '',
    commentReply: '',
    status: 'draft',
    platform: 'youtube',
    tone: 'inspiring',
    goal: 'Brand storytelling',
    callToAction: 'Visit cbrecycling.org',
    createdAt: new Date().toISOString(),
  },
  voiceover: {
    id: `mock-${Date.now()}`,
    contentType: 'voiceover',
    title: `Cyan's Brooklynn 30-Second Radio / Pre-Roll Ad`,
    hook: 'Nashville — what if recycling was the easiest thing you did all week?',
    caption: `30-second Cyan's Brooklynn voiceover ad. Perfect for Instagram pre-roll, YouTube, or local radio.`,
    hashtags: ['#CyansBrooklynn', '#Nashville', '#RecyclingAd'],
    script:
      `[MUSIC: Upbeat acoustic guitar fades in]\n\nVO: "Nashville — what if recycling was the easiest thing you did all week?"\n\n[PAUSE 0.5s]\n\nVO: "With Cyan's Brooklynn, it is. We pick up your recyclables right from your curb — cardboard, plastic, glass, even old electronics — on a schedule that works for you."\n\n[MUSIC: Slightly brighter]\n\nVO: "No sorting. No drop-off trips. Just curbside recycling that actually shows up."\n\n[PAUSE 0.5s]\n\nVO: "Join thousands of Nashville families and businesses already making a difference with Cyan's Brooklynn."\n\n[MUSIC: Resolves to logo sting]\n\nVO: "Sign up today at cbrecycling.org. Cyan's Brooklynn — recycling, handled."\n\n[MUSIC OUT]\n\n[Total runtime: ~28 seconds]`,
    storyboard: '',
    emailDraft: '',
    commentReply: '',
    status: 'draft',
    platform: 'youtube',
    tone: 'friendly',
    goal: 'Brand awareness and signups',
    callToAction: 'Sign up at cbrecycling.org',
    createdAt: new Date().toISOString(),
  },
  analytics_review: {
    id: `mock-${Date.now()}`,
    contentType: 'analytics_review',
    title: `Analytics Review: May 2026 — Cyan's Brooklynn Social Performance`,
    hook: 'TikTok drove 68% of new website visits in May — but Instagram remains the top conversion channel.',
    caption:
      `May 2026 social media performance summary for Cyan's Brooklynn Recycling. TikTok growth is accelerating while Instagram continues converting leads. Facebook engagement is declining and needs a content refresh.`,
    hashtags: [],
    script:
      `PERFORMANCE SUMMARY — MAY 2026\n\nTotal Reach: 41,200 (up 22% vs April)\nInstagram: 18,400 reach | 312 profile visits | 47 link clicks | 8 signups\nTikTok: 19,800 reach | 1,240 video completions | 89 profile visits | 4 signups\nFacebook: 3,000 reach | 44 engagements | 2 signups\nLinkedIn: 1,200 reach | 34 engagements | 3 commercial inquiries\n\nTOP PERFORMERS:\n1. "POV: Curbside Pickup That Actually Shows Up" (TikTok) — 19,800 views, 8.4% engagement rate\n2. "Why Nashville Families Choose Cyan's Brooklynn" (Instagram) — 6,200 reach, 12 signups attributed\n3. "5 Items You Didn't Know Cyan's Brooklynn Recycles" (Instagram carousel) — 4,100 reach, saved 340 times\n\nAREAS FOR IMPROVEMENT:\nFacebook reach dropped 31% — current content format is not optimized for Facebook's algorithm. Video content performs 4x better than static images on this platform.\nLinkedIn commercial lead quality is high but volume is low — posting frequency needs to increase from 2x/month to 1x/week.\n\nRECOMMENDATIONS:\n1. Increase TikTok posting to 4x/week — this platform has the lowest competition and highest organic reach for Cyan's Brooklynn content.\n2. Convert top Instagram carousels to Facebook video format — use the existing storyboard assets.\n3. Launch LinkedIn thought leadership series: "Sustainable Business in Nashville" — 1 post/week targeting property managers and business owners.\n4. A/B test Instagram Stories with swipe-up link vs. "DM for info" CTA — measure conversion rate difference.\n\nNEXT 30-DAY PLAN:\n- Week 1: Launch Summer Recycling Challenge on all platforms\n- Week 2: School partnership announcement (organic + boosted Facebook post)\n- Week 3: Behind-the-scenes YouTube video + TikTok clips\n- Week 4: Customer spotlight series begins (Greenview Apartments)`,
    storyboard: '',
    emailDraft: '',
    commentReply: '',
    status: 'draft',
    platform: 'instagram',
    tone: 'professional',
    goal: 'Monthly performance review',
    callToAction: 'Schedule strategy call',
    createdAt: new Date().toISOString(),
  },
}

// ── generateAIContent ─────────────────────────────────────────────────────────
// Calls POST /api/ai/generate-content (Vite plugin — server-side, Node.js only).
// The Anthropic API key lives in .env.local and is NEVER sent to the browser.
//
// Fallback chain:
//   1. Server route succeeds → return real Claude output
//   2. Server route returns { demo: true } (key missing) → _generateMock()
//   3. Network / parse error → _generateMock()

// ── Dynamic content builders ──────────────────────────────────────────────────

function _pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function _buildHook(topic: string, platform: Platform | undefined, tone: Tone | undefined): string {
  const t = topic.trim()
  const hooks: Record<NonNullable<Tone>, string[]> = {
    friendly: [
      `Hey Nashville! Here's something worth sharing about ${t}. 💚`,
      `Quick thought on ${t} — and why it matters for your neighborhood. 🌿`,
      `Nashville families are talking about ${t}. Here's the truth. ♻️`,
    ],
    professional: [
      `${t}: what Nashville businesses need to know in 2026.`,
      `The data is clear on ${t}. Here's what it means for your organization.`,
      `${t} is reshaping how Nashville approaches sustainability.`,
    ],
    urgent: [
      `🚨 Nashville — we need to talk about ${t}. Right now.`,
      `Don't scroll past this. ${t} affects every household in our city.`,
      `Time-sensitive: ${t} and what you can do about it today.`,
    ],
    educational: [
      `Did you know? ${t} is one of the most misunderstood topics in recycling. 📚`,
      `Here's what most people get wrong about ${t}:`,
      `3 facts about ${t} that will change how you think about recycling:`,
    ],
    inspiring: [
      `Imagine a Nashville where ${t} is the norm, not the exception. 🌎`,
      `Every day, Nashville residents prove that ${t} is possible. Here's how.`,
      `${t} isn't just a goal — it's already happening in our community. ✨`,
    ],
    humorous: [
      `Nobody panic, but ${t} is actually easier than you think. 😅`,
      `Plot twist: ${t} doesn't have to be complicated. Nashville, we got you.`,
      `POV: You just learned the truth about ${t}. 👀`,
    ],
  }
  const platformHooks: Partial<Record<NonNullable<Platform>, string>> = {
    tiktok: `POV: You finally understand ${t}. Let me explain. 👀`,
    linkedin: `${t} is the sustainability conversation Nashville's business community needs to have.`,
    youtube: `In this video, we're diving deep into ${t} — and what it means for Nashville.`,
  }
  if (platform && platformHooks[platform]) return platformHooks[platform]!
  return _pick(hooks[tone ?? 'friendly'])
}

function _buildCaption(
  topic: string, platform: Platform | undefined,
  tone: Tone | undefined, goal: string | undefined, cta: string,
): string {
  const t = topic.trim()
  const g = goal ? `\n\nOur goal: ${goal}.` : ''

  const templates: Record<NonNullable<Tone>, string> = {
    friendly: `When it comes to ${t}, Cyan's Brooklynn makes it simple.\n\nWe pick up your recyclables right from your curb — no sorting stress, no extra trips. Nashville families deserve a recycling service that actually shows up.${g}\n\n♻️ Cardboard, plastic, glass, e-waste — handled.\n📍 Now serving Nashville and surrounding areas.\n\n${cta}`,
    professional: `${t} is a critical component of Nashville's sustainability strategy.\n\nCyan's Brooklynn provides reliable curbside recycling pickup for families, businesses, schools, and apartment communities — with full material traceability and monthly impact reports.${g}\n\n📋 Certified handling\n📍 Nashville metro coverage\n📊 Monthly reporting available\n\n${cta}`,
    urgent: `Nashville — ${t} cannot wait.\n\nEvery week, our city sends thousands of recyclable items to the landfill simply because pickup is inconvenient. Cyan's Brooklynn eliminates that excuse entirely.${g}\n\n⏰ New subscriptions limited this month.\n📍 Service area expanding soon — lock in your spot.\n\n${cta}`,
    educational: `Let's clear up the confusion around ${t}.\n\nMany Nashville residents want to recycle more but aren't sure how. Cyan's Brooklynn removes every barrier — we handle collection, sorting, and certified disposal so you don't have to think about it.${g}\n\n📚 What we accept: cardboard, plastic (#1&#2), glass, electronics, metals, and more.\n📍 Nashville pickup available now.\n\n${cta}`,
    inspiring: `${t} is proof that small actions create real change.\n\nEvery bag Cyan's Brooklynn collects is a bag that doesn't end up in a Nashville landfill. Together, our community has already diverted thousands of pounds of recyclables — and we're just getting started.${g}\n\n🌱 Join Nashville's growing recycling community.\n✨ Your curb. Our truck. Real impact.\n\n${cta}`,
    humorous: `Okay Nashville, real talk about ${t}:\n\nYou've been meaning to recycle more. We've been waiting to pick it up. This is the most low-effort environmental win of your week.${g}\n\nStep 1: Fill your bin.\nStep 2: Put it at the curb.\nStep 3: That's it. That's the whole step.\n\n♻️ Cyan's Brooklynn does the rest. Promise.\n\n${cta}`,
  }

  let caption = templates[tone ?? 'friendly']

  // Platform-specific hashtag density
  if (platform === 'instagram') {
    caption += '\n\n#CyansBrooklynn #Nashville #Recycling #EcoFriendly #CurbsidePickup #SustainableNashville #GreenLiving'
  } else if (platform === 'tiktok') {
    caption += '\n\n#CyansBrooklynn #NashvilleTikTok #EcoTok #RecyclingTikTok #GreenTok'
  } else if (platform === 'facebook') {
    caption += '\n\n#CyansBrooklynn #Nashville #Recycling'
  }

  return caption
}

function _buildHashtags(topic: string, platform: Platform | undefined): string[] {
  const base = ['#CyansBrooklynn', '#Nashville', '#CurbsideRecycling', '#EcoFriendly', '#SustainableNashville']
  const topicLower = topic.toLowerCase()
  const extra: string[] = []

  if (topicLower.includes('school') || topicLower.includes('kid') || topicLower.includes('education'))
    extra.push('#GreenSchools', '#EcoKids', '#NashvilleSchools')
  if (topicLower.includes('business') || topicLower.includes('commercial') || topicLower.includes('office'))
    extra.push('#SustainableBusiness', '#NashvilleB2B', '#GreenBusiness')
  if (topicLower.includes('apartment') || topicLower.includes('property') || topicLower.includes('community'))
    extra.push('#ApartmentLiving', '#PropertyManagement')
  if (topicLower.includes('electronic') || topicLower.includes('e-waste') || topicLower.includes('tech'))
    extra.push('#EWaste', '#TechRecycling', '#ElectronicsRecycling')
  if (topicLower.includes('plastic') || topicLower.includes('bottle'))
    extra.push('#PlasticFree', '#ZeroWaste', '#PlasticRecycling')
  if (topicLower.includes('summer') || topicLower.includes('challenge'))
    extra.push('#SummerChallenge', '#EcoChallenge')

  const platformTags: Partial<Record<NonNullable<Platform>, string[]>> = {
    instagram: ['#GreenLiving', '#ZeroWaste', '#EcoLife'],
    tiktok: ['#NashvilleTikTok', '#EcoTok', '#RecyclingTikTok', '#GreenTok'],
    facebook: ['#NashvilleCommunity'],
    linkedin: ['#Sustainability', '#NashvilleEntrepreneur', '#ESG'],
    youtube: ['#EcoNashville', '#RecyclingTips'],
    twitter: ['#NashvilleGreen'],
  }
  const platTags = (platform && platformTags[platform]) ?? []

  const all = [...new Set([...base, ...extra, ...platTags])]
  return all.slice(0, 12)
}

function _buildScript(topic: string, platform: Platform | undefined, cta: string): string {
  if (platform === 'linkedin') return ''
  if (platform === 'facebook') return ''
  const t = topic.trim()
  if (platform === 'tiktok' || platform === 'instagram') {
    return [
      `Hook (0-3s): Talk directly to camera — "${_buildHook(t, platform, 'humorous')}"`,
      `Body (3-20s): Quick visual walkthrough of ${t} — show the problem, then the Cyan's Brooklynn solution. Fast cuts, upbeat music.`,
      `CTA (20-28s): Text overlay + voiceover — "${cta}". End on Cyan's Brooklynn logo.`,
    ].join('\n')
  }
  return [
    `INTRO: Establish context — ${t} in Nashville.`,
    `MIDDLE: Cyan's Brooklynn's approach explained — curbside pickup, certified handling, community impact.`,
    `CLOSE: CTA — ${cta}. Logo card with website.`,
  ].join('\n\n')
}

// ── Suggest a publish time (2-4 days from now, 9 AM or 6 PM) ─────────────────

function _suggestSchedule(): string {
  const d = new Date()
  d.setDate(d.getDate() + 2 + Math.floor(Math.random() * 3))
  d.setHours(Math.random() > 0.5 ? 9 : 18, 0, 0, 0)
  return d.toISOString()
}

// ── Public entry point ────────────────────────────────────────────────────────

export async function generateAIContent(params: AIContentParams): Promise<AIContentResult> {
  // ── 1. Try the server-side API route ────────────────────────────────────────
  let apiError: string | undefined

  try {
    // Attach the Supabase session token so the server can validate the caller.
    const { data: sessionData } = await supabase.auth.getSession()
    const accessToken = sessionData?.session?.access_token
    const authHeaders: Record<string, string> = accessToken
      ? { Authorization: `Bearer ${accessToken}` }
      : {}

    const res = await fetch('/api/ai/generate-content', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      // Only send user inputs — the server looks up the system prompt by
      // contentType. The API key and system prompts never leave the server.
      body:    JSON.stringify({
        contentType:   params.contentType,
        topic:         params.topic,
        platform:      params.platform,
        tone:          params.tone,
        goal:          params.goal,
        callToAction:  params.callToAction,
      }),
    })

    if (res.ok) {
      const data = await res.json() as Partial<AIContentResult> & {
        error?: string; demo?: boolean; details?: string; _source?: string
      }

      // demo:true → key not configured or API returned a signal to use mock
      if (data.id && !data.error && !data.demo) {
        return {
          storyboard:   '',
          emailDraft:   '',
          commentReply: '',
          script:       '',
          hashtags:     [],
          ...data,
          id:           data.id,
          status:       'draft',
          platform:     data.platform ?? params.platform,
          tone:         data.tone     ?? params.tone,
          createdAt:    data.createdAt ?? new Date().toISOString(),
          scheduledFor: data.scheduledFor ?? _suggestSchedule(),
          _source:      'claude',
        } as AIContentResult
      }

      // Server responded but signalled demo fallback — capture why
      apiError = data.details ?? data.error ?? 'API not available'
    } else {
      // 4xx / 5xx — try to read the JSON error body
      try {
        const errBody = await res.json() as { error?: string; details?: string }
        apiError = errBody.details ?? errBody.error ?? `Server ${res.status}`
      } catch {
        apiError = `Server ${res.status}`
      }
    }
  } catch (err) {
    // Network error, server not started, JSON parse failure — fall through
    apiError = err instanceof Error ? err.message : 'Network error'
  }

  // ── 2. Fallback: local mock / dynamic generation ─────────────────────────
  return _generateMock(params, apiError)
}

// ── Local demo fallback ───────────────────────────────────────────────────────

async function _generateMock(params: AIContentParams, apiError?: string): Promise<AIContentResult> {
  // Simulate realistic latency so the loading state is visible
  await new Promise((resolve) => setTimeout(resolve, 600 + Math.random() * 600))

  const id  = `gen-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const cta = params.callToAction?.trim() || 'Visit cbrecycling.org to get started'
  const now = new Date().toISOString()

  // If a dedicated mock exists AND no custom topic was provided, use the mock
  const base     = MOCK_RESPONSES[params.contentType]
  const hasTopic = params.topic.trim().length > 0

  if (base && !hasTopic) {
    return {
      ...base,
      id,
      platform:     params.platform ?? base.platform,
      tone:         params.tone     ?? base.tone,
      goal:         params.goal     ?? base.goal ?? '',
      callToAction: cta,
      createdAt:    now,
      status:       'draft',
      scheduledFor: _suggestSchedule(),
      _source:      'demo',
      _error:       apiError,
    }
  }

  // Dynamic generation — topic-aware templates
  const topic    = params.topic.trim() || 'curbside recycling in Nashville'
  const platform = params.platform
  const tone     = params.tone

  const hook      = _buildHook(topic, platform, tone)
  const caption   = _buildCaption(topic, platform, tone, params.goal, cta)
  const hashtags  = _buildHashtags(topic, platform)
  const script    = _buildScript(topic, platform, cta)
  const storyboard = `Scene 1: Establish Nashville neighborhood context (3s).\nScene 2: Illustrate "${topic}" — show the problem or opportunity (5s).\nScene 3: Cyan's Brooklynn truck arrives — driver loads bins, waves (4s).\nScene 4: Text overlay: "Recycling, handled." Logo card. CTA: ${cta} (3s).`

  let emailDraft   = ''
  let commentReply = ''

  if (params.contentType === 'email_reply') {
    emailDraft = `Hi [Name],\n\nThank you for reaching out about ${topic}.\n\nAt Cyan's Brooklynn, we're passionate about making recycling effortless for Nashville families and businesses. Here's how we can help:\n\n• Scheduled weekly or bi-weekly curbside pickup\n• Certified handling for all accepted materials\n• Transparent monthly recycling reports\n\nI'd love to set up a quick 15-minute call to understand your needs and put together a custom proposal.\n\nLooking forward to connecting!\n\nBest,\nCyan's Brooklynn Recycling Team\nhello@cbrecycling.org | ${cta}`
  }

  if (params.contentType === 'comment_reply') {
    commentReply = `Hey! Great question about ${topic} 🙌 We'd love to help — ${cta}. Feel free to DM us directly too! ♻️`
  }

  return {
    id,
    contentType:  params.contentType,
    title:        topic.length > 70 ? topic.slice(0, 67) + '...' : topic,
    hook,
    caption,
    hashtags,
    script,
    storyboard,
    emailDraft,
    commentReply,
    status:       'draft',
    platform,
    tone,
    goal:         params.goal ?? '',
    callToAction: cta,
    createdAt:    now,
    scheduledFor: _suggestSchedule(),
    _source:      'demo',
    _error:       apiError,
  }
}
