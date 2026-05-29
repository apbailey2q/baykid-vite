// automationRules.ts — BayKid AI Marketing Center
// Automation Rules Engine: types, storage, condition evaluation, test runner
// All automations are DRAFT-ONLY. Nothing is auto-posted or auto-sent.

import type { Platform } from './aiMarketing'
import { upsertPost } from './postStorage'
import { logEvent } from './activityLog'
import { addNotification } from './notifications'
import { createLeadFromRule } from './leads'
import { sbUpsertRule, sbDeleteRule } from './aiMarketingDb'

// ── Rule types ────────────────────────────────────────────────────────────────

export type RuleType =
  | 'auto_reply_comment'   // Auto-reply to social comments
  | 'auto_draft_email'     // Auto-draft email replies
  | 'create_lead'          // Create lead from interested comment
  | 'high_risk_approval'   // Send high-risk comments to approval queue
  | 'suggest_posting_time' // Suggest best posting time

export const RULE_TYPE_META: Record<RuleType, { label: string; icon: string; color: string; bg: string; border: string; description: string }> = {
  auto_reply_comment:   { label: 'Auto-Reply Comment',    icon: '💬', color: '#00c8ff', bg: 'rgba(0,200,255,0.1)',    border: 'rgba(0,200,255,0.25)',    description: 'Automatically draft a reply to matching social comments' },
  auto_draft_email:     { label: 'Auto-Draft Email',      icon: '📧', color: '#a855f7', bg: 'rgba(168,85,247,0.1)',   border: 'rgba(168,85,247,0.25)',   description: 'Automatically draft replies to matching email messages' },
  create_lead:          { label: 'Create Lead',           icon: '🎯', color: '#22c55e', bg: 'rgba(34,197,94,0.1)',    border: 'rgba(34,197,94,0.25)',    description: 'Create a lead record from comments showing purchase intent' },
  high_risk_approval:   { label: 'High-Risk → Approval',  icon: '⚠️', color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',   border: 'rgba(251,191,36,0.25)',   description: 'Flag negative or sensitive comments for human review' },
  suggest_posting_time: { label: 'Suggest Posting Time',  icon: '📅', color: '#fb923c', bg: 'rgba(251,146,60,0.1)',   border: 'rgba(251,146,60,0.25)',   description: 'Recommend optimal posting windows based on platform data' },
}

// ── Condition types ───────────────────────────────────────────────────────────

export type ConditionField =
  | 'comment_text'      // if comment contains keyword
  | 'platform'          // if platform equals
  | 'sentiment'         // if sentiment is positive/negative/question
  | 'message_category'  // if message contains pricing/pickup/apartment/school/sponsor/complaint

export const CONDITION_FIELD_LABELS: Record<ConditionField, string> = {
  comment_text:      'Comment contains keyword',
  platform:          'Platform equals',
  sentiment:         'Sentiment is',
  message_category:  'Message category is',
}

export type SentimentValue = 'positive' | 'negative' | 'question'
export type MessageCategory = 'pricing' | 'pickup' | 'apartment' | 'school' | 'sponsor' | 'complaint'
export type RulePlatform = 'instagram' | 'tiktok' | 'facebook' | 'twitter' | 'linkedin' | 'youtube' | 'email'

export const SENTIMENT_OPTIONS: Array<{ value: SentimentValue; label: string }> = [
  { value: 'positive',  label: 'Positive'  },
  { value: 'negative',  label: 'Negative'  },
  { value: 'question',  label: 'Question'  },
]

export const MESSAGE_CATEGORY_OPTIONS: Array<{ value: MessageCategory; label: string }> = [
  { value: 'pricing',   label: 'Pricing / Cost'      },
  { value: 'pickup',    label: 'Pickup / Scheduling'  },
  { value: 'apartment', label: 'Apartment / Complex'  },
  { value: 'school',    label: 'School / PTA'         },
  { value: 'sponsor',   label: 'Sponsorship'          },
  { value: 'complaint', label: 'Complaint / Issue'    },
]

export const PLATFORM_OPTIONS: Array<{ value: RulePlatform; label: string }> = [
  { value: 'instagram', label: '📷 Instagram' },
  { value: 'tiktok',    label: '🎵 TikTok'    },
  { value: 'facebook',  label: '👥 Facebook'  },
  { value: 'twitter',   label: '🐦 Twitter/X' },
  { value: 'linkedin',  label: '💼 LinkedIn'  },
  { value: 'youtube',   label: '▶️ YouTube'   },
  { value: 'email',     label: '📧 Email'     },
]

export interface RuleCondition {
  id: string
  field: ConditionField
  value: string  // keyword text, platform name, sentiment value, or category
}

// ── Action types ──────────────────────────────────────────────────────────────

export type ActionType =
  | 'generate_reply'      // Generate AI draft reply (saved as draft only)
  | 'save_draft'          // Save incoming message + context as draft post
  | 'send_to_approval'    // Route to Approval Queue for human review
  | 'create_lead'         // Create a lead record in Lead Tracker
  | 'notify_admin'        // Flag for admin notification (in-app only)

export const ACTION_META: Record<ActionType, { label: string; icon: string; color: string; description: string }> = {
  generate_reply:    { label: 'Generate Reply',       icon: '🤖', color: '#00c8ff', description: 'AI drafts a reply — saved as draft, not posted' },
  save_draft:        { label: 'Save Draft',           icon: '💾', color: '#818cf8', description: 'Save message/context as a content draft'         },
  send_to_approval:  { label: 'Send to Approval',     icon: '✅', color: '#fbbf24', description: 'Route to Approval Queue for human review'          },
  create_lead:       { label: 'Create Lead',          icon: '🎯', color: '#22c55e', description: 'Add contact to Lead Tracker as a new lead'         },
  notify_admin:      { label: 'Notify Admin',         icon: '🔔', color: '#f87171', description: 'Flag item in admin notifications (in-app only)'    },
}

// ── Rule interface ────────────────────────────────────────────────────────────

export interface AutomationRule {
  id:             string
  name:           string
  ruleType:       RuleType
  conditionLogic: 'all' | 'any'   // ALL = AND logic, ANY = OR logic
  conditions:     RuleCondition[]
  actions:        ActionType[]
  enabled:        boolean
  draftOnly:      true             // Safety guardrail — always true
  createdAt:      string
  updatedAt:      string
  triggerCount:   number
  lastTriggered?: string
}

// ── Default seed rules ────────────────────────────────────────────────────────

const DEFAULT_RULES: AutomationRule[] = [
  {
    id: 'rule-pricing-draft',
    name: 'Pricing Inquiry → Auto-Draft Reply',
    ruleType: 'auto_reply_comment',
    conditionLogic: 'any',
    conditions: [
      { id: 'c1', field: 'message_category', value: 'pricing' },
      { id: 'c2', field: 'comment_text',     value: 'how much' },
      { id: 'c3', field: 'comment_text',     value: 'cost' },
    ],
    actions: ['generate_reply', 'save_draft'],
    enabled: true,
    draftOnly: true,
    createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    triggerCount: 31,
    lastTriggered: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'rule-high-risk',
    name: 'High-Risk Comment → Approval Queue',
    ruleType: 'high_risk_approval',
    conditionLogic: 'any',
    conditions: [
      { id: 'c1', field: 'sentiment',        value: 'negative' },
      { id: 'c2', field: 'message_category', value: 'complaint' },
    ],
    actions: ['send_to_approval', 'notify_admin'],
    enabled: true,
    draftOnly: true,
    createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    triggerCount: 8,
    lastTriggered: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'rule-lead-capture',
    name: 'Interested Comment → Lead',
    ruleType: 'create_lead',
    conditionLogic: 'any',
    conditions: [
      { id: 'c1', field: 'message_category', value: 'pickup'    },
      { id: 'c2', field: 'message_category', value: 'apartment' },
      { id: 'c3', field: 'sentiment',        value: 'positive'  },
    ],
    actions: ['create_lead', 'notify_admin'],
    enabled: true,
    draftOnly: true,
    createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 10 * 86400000).toISOString(),
    triggerCount: 14,
    lastTriggered: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: 'rule-school-sponsor',
    name: 'School / Sponsor Inquiry → Lead',
    ruleType: 'create_lead',
    conditionLogic: 'any',
    conditions: [
      { id: 'c1', field: 'message_category', value: 'school'  },
      { id: 'c2', field: 'message_category', value: 'sponsor' },
    ],
    actions: ['create_lead', 'notify_admin', 'generate_reply'],
    enabled: true,
    draftOnly: true,
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    triggerCount: 6,
    lastTriggered: new Date(Date.now() - 172800000).toISOString(),
  },
  {
    id: 'rule-email-draft',
    name: 'Email Message → Auto-Draft Reply',
    ruleType: 'auto_draft_email',
    conditionLogic: 'all',
    conditions: [
      { id: 'c1', field: 'platform', value: 'email' },
    ],
    actions: ['generate_reply', 'save_draft'],
    enabled: false,
    draftOnly: true,
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    triggerCount: 0,
    lastTriggered: undefined,
  },
]

// ── Storage ───────────────────────────────────────────────────────────────────

export const RULES_KEY    = 'baykid_ai_rules'
const SEEDED_FLAG  = 'baykid_ai_rules_seeded'

function safeParseRules(raw: string | null): AutomationRule[] {
  if (!raw) return []
  try { return JSON.parse(raw) as AutomationRule[] } catch { return [] }
}

export function loadRules(): AutomationRule[] {
  const raw = localStorage.getItem(RULES_KEY)
  if (raw) return safeParseRules(raw)
  return []
}

export function saveRules(rules: AutomationRule[]): void {
  localStorage.setItem(RULES_KEY, JSON.stringify(rules))
}

export function upsertRule(rule: AutomationRule): AutomationRule[] {
  const all = loadRules()
  const idx = all.findIndex(r => r.id === rule.id)
  if (idx >= 0) all[idx] = rule
  else all.unshift(rule)
  saveRules(all)
  sbUpsertRule(rule).catch(() => {})
  return all
}

export function removeRule(id: string): AutomationRule[] {
  const all = loadRules().filter(r => r.id !== id)
  saveRules(all)
  sbDeleteRule(id).catch(() => {})
  return all
}

/** Seeds DEFAULT_RULES on first load. Subsequent user changes are persisted. */
export function initializeRules(): AutomationRule[] {
  const seeded = localStorage.getItem(SEEDED_FLAG) === 'true'
  if (seeded) return loadRules()
  const existing = loadRules()
  const existingIds = new Set(existing.map(r => r.id))
  const newDefaults = DEFAULT_RULES.filter(r => !existingIds.has(r.id))
  const merged = [...existing, ...newDefaults]
  saveRules(merged)
  localStorage.setItem(SEEDED_FLAG, 'true')
  return merged
}

// ── Sentiment detection ───────────────────────────────────────────────────────

const POSITIVE_SIGNALS = [
  'love', 'great', 'awesome', 'amazing', 'yes', 'want', 'interested', 'sign up',
  'join', 'sign me up', 'how do i', 'need this', 'perfect', 'excellent', 'fantastic',
  'wonderful', 'definitely', 'absolutely', 'would love', 'can you help', 'ready',
  'please', 'looking for', 'interested in', 'would like',
]
const NEGATIVE_SIGNALS = [
  'bad', 'terrible', 'hate', 'scam', 'disappointed', 'never', 'worst', 'awful',
  'horrible', 'rude', 'waste', 'broken', 'failed', 'useless', 'disgusting',
  'outraged', 'fraud', 'liar', 'cheated', 'ridiculous', 'unacceptable', 'pathetic',
]
const QUESTION_SIGNALS = [
  '?', 'how', 'when', 'where', 'what', 'who', 'why', 'can you', 'do you', 'will you',
  'is there', 'are you', 'could you', 'would you', 'does it', 'is it',
]

export function detectSentiment(text: string): SentimentValue {
  const lower = text.toLowerCase()
  const negScore = NEGATIVE_SIGNALS.filter(s => lower.includes(s)).length
  const posScore = POSITIVE_SIGNALS.filter(s => lower.includes(s)).length
  const qScore   = QUESTION_SIGNALS.filter(s => lower.includes(s)).length

  if (negScore > 0 && negScore >= posScore) return 'negative'
  if (lower.includes('?') || (qScore >= 2 && posScore === 0)) return 'question'
  if (posScore > 0) return 'positive'
  if (qScore > 0)   return 'question'
  return 'positive' // neutral defaults to positive
}

// ── Message category detection ────────────────────────────────────────────────

const CATEGORY_KEYWORDS: Record<MessageCategory, string[]> = {
  pricing:   ['price', 'cost', 'how much', 'charge', 'fee', 'rate', 'pay', 'money', 'expensive', 'cheap', 'afford', 'pricing', 'subscription', 'plan'],
  pickup:    ['pickup', 'pick up', 'pick-up', 'collect', 'schedule', 'available', 'when can', 'when do you', 'service area', 'come to', 'pick my', 'my area'],
  apartment: ['apartment', 'condo', 'complex', 'hoa', 'building', 'unit', 'multi-family', 'multifamily', 'townhouse', 'resident', 'tenants', 'complex'],
  school:    ['school', 'pta', 'fundraiser', 'students', 'teacher', 'classroom', 'kids', 'education', 'principal', 'district', 'campus', 'elementary', 'middle school', 'high school'],
  sponsor:   ['sponsor', 'partner', 'partnership', 'collaboration', 'collab', 'brand deal', 'sponsorship', 'promote', 'advertise', 'affiliate'],
  complaint: ['problem', 'issue', 'complaint', 'broken', 'wrong', "didn't work", 'not working', 'never', 'bad service', 'unacceptable', 'refund', 'disappointed', 'terrible service'],
}

export function detectCategories(text: string): MessageCategory[] {
  const lower = text.toLowerCase()
  return (Object.keys(CATEGORY_KEYWORDS) as MessageCategory[])
    .filter(cat => CATEGORY_KEYWORDS[cat].some(kw => lower.includes(kw)))
}

// ── Condition evaluation ──────────────────────────────────────────────────────

export interface ConditionEvalResult {
  condition: RuleCondition
  matched: boolean
  reason: string
}

export interface TestInput {
  text:     string
  platform: RulePlatform
}

export interface RuleTestResult {
  conditionResults:  ConditionEvalResult[]
  detectedSentiment: SentimentValue
  detectedCategories: MessageCategory[]
  ruleMatches:       boolean
  triggeredActions:  ActionType[]
  generatedReply?:   string
  leadData?:         { name: string; source: string; interest: string }
  postingTimeSuggestion?: string
}

function evaluateCondition(condition: RuleCondition, input: TestInput, sentiment: SentimentValue, categories: MessageCategory[]): ConditionEvalResult {
  const lower = input.text.toLowerCase()
  switch (condition.field) {
    case 'comment_text': {
      const kw = condition.value.toLowerCase()
      const matched = lower.includes(kw)
      return { condition, matched, reason: matched ? `Text contains "${condition.value}"` : `Text does not contain "${condition.value}"` }
    }
    case 'platform': {
      const matched = input.platform === condition.value
      return { condition, matched, reason: matched ? `Platform is ${condition.value}` : `Platform is ${input.platform}, not ${condition.value}` }
    }
    case 'sentiment': {
      const matched = sentiment === condition.value
      return { condition, matched, reason: matched ? `Detected sentiment: ${sentiment}` : `Sentiment is ${sentiment}, not ${condition.value}` }
    }
    case 'message_category': {
      const cat = condition.value as MessageCategory
      const matched = categories.includes(cat)
      return { condition, matched, reason: matched ? `Detected category: ${condition.value}` : `Category "${condition.value}" not detected in text` }
    }
    default:
      return { condition, matched: false, reason: 'Unknown condition type' }
  }
}

function generateMockReply(input: TestInput, categories: MessageCategory[], sentiment: SentimentValue): string {
  if (categories.includes('pricing')) {
    return `Great question! 💚 Cyan's Brooklynn Recycling offers flexible plans starting at just $${input.platform === 'linkedin' ? '25/month for businesses' : '12/bag for residential pickups'}. You can sign up at cbrecycling.org or DM us for a custom quote that fits your needs. We serve Nashville and surrounding areas! ♻️`
  }
  if (categories.includes('complaint')) {
    return `We're so sorry to hear about your experience — this is definitely not the standard we hold ourselves to. 🙏 Please DM us your contact info and we'll have someone reach out within 24 hours to make it right. Your feedback helps us improve for everyone in our community.`
  }
  if (categories.includes('pickup')) {
    return `We'd love to help! 🚛 You can schedule a pickup online at cbrecycling.org or text us your zip code and we'll confirm if we serve your area. Pickups are available Mon–Sat and we always send a 30-minute heads-up before we arrive! ♻️`
  }
  if (categories.includes('apartment')) {
    return `Yes! We work with apartment complexes and HOAs across Nashville! 🏢 We can set up a community recycling program with bulk pickup options. Send us a DM or email hello@cbrecycling.org and we'll put together a custom plan for your building. ♻️`
  }
  if (categories.includes('school')) {
    return `We love partnering with schools! 🏫 Our school fundraiser program lets students earn money for their organization while helping Nashville go greener. Email fundraisers@cbrecycling.org to get started — we'd love to have your school join our network! ♻️💚`
  }
  if (categories.includes('sponsor')) {
    return `Thank you for your interest in partnering with Cyan's Brooklynn Recycling! 🤝 We're always open to collaborations that align with our mission of making recycling accessible to every Nashville family. Please reach out to hello@cbrecycling.org with your proposal and we'll get back to you within 2 business days. ♻️`
  }
  if (sentiment === 'positive') {
    return `Thank you so much for the love! 💚 Cyan's Brooklynn is on a mission to make recycling easy and rewarding for every Nashville family. Share this with a friend who wants to make a difference — together we can keep Nashville green! ♻️✨`
  }
  if (sentiment === 'question') {
    return `Great question! 🙌 We'd be happy to help. For the fastest answer, visit cbrecycling.org/faq or DM us directly — our team typically responds within a few hours. Thanks for reaching out! ♻️`
  }
  return `Thanks for reaching out to Cyan's Brooklynn Recycling! 💚 We're Nashville's community recycling service making it easy to do your part. Visit cbrecycling.org or DM us for more info. ♻️`
}

function getPostingTimeSuggestion(platform: RulePlatform): string {
  const suggestions: Record<RulePlatform, string> = {
    instagram: 'Best times: Tue–Fri, 9–11 AM or 6–8 PM CT. Avoid Monday mornings and Sunday evenings.',
    tiktok:    'Best times: Tue–Thu, 7–9 AM or 7–9 PM CT. TikTok trends spike on Thursday evenings.',
    facebook:  'Best times: Tue–Thu, 1–3 PM CT. Facebook engagement peaks mid-week afternoons.',
    twitter:   'Best times: Mon–Fri, 8–10 AM or 12–1 PM CT. Twitter is most active during commute hours.',
    linkedin:  'Best times: Tue–Thu, 8–10 AM CT. LinkedIn is primarily a weekday professional platform.',
    youtube:   'Best times: Thu–Sat, 2–4 PM CT. YouTube viewing peaks on weekend afternoons.',
    email:     'Best times: Tue–Thu, 9–11 AM CT. Email open rates are highest mid-week mornings.',
  }
  return suggestions[platform] ?? 'Best times vary — test Tuesday–Thursday, 9 AM–12 PM for your audience.'
}

export function evaluateRule(rule: AutomationRule, input: TestInput): RuleTestResult {
  const sentiment  = detectSentiment(input.text)
  const categories = detectCategories(input.text)

  const conditionResults = rule.conditions.map(c =>
    evaluateCondition(c, input, sentiment, categories)
  )

  const ruleMatches = rule.conditions.length === 0
    ? false
    : rule.conditionLogic === 'all'
      ? conditionResults.every(r => r.matched)
      : conditionResults.some(r => r.matched)

  const triggeredActions = ruleMatches ? [...rule.actions] : []

  const result: RuleTestResult = {
    conditionResults,
    detectedSentiment: sentiment,
    detectedCategories: categories,
    ruleMatches,
    triggeredActions,
  }

  if (ruleMatches) {
    if (triggeredActions.includes('generate_reply')) {
      result.generatedReply = generateMockReply(input, categories, sentiment)
    }
    if (triggeredActions.includes('create_lead')) {
      result.leadData = {
        name:     'Anonymous Lead',
        source:   `${input.platform.charAt(0).toUpperCase() + input.platform.slice(1)} Comment`,
        interest: categories.length > 0 ? categories.join(', ') : 'General inquiry',
      }
    }
    if (rule.ruleType === 'suggest_posting_time') {
      result.postingTimeSuggestion = getPostingTimeSuggestion(input.platform)
    }
  }

  return result
}

// ── Execute rule actions (persists to storage) ────────────────────────────────
// Import lazily to avoid circular-dependency issues — both modules are
// leaf-level but leads.ts imports from activityLog which imports from
// aiMarketing, so we do dynamic imports only at call-time here.

export interface ExecuteRuleResult {
  createdLeadId?: string
  createdPostId?: string
  actions: ActionType[]
  summary: string[]
}

export async function executeRuleActions(
  rule: AutomationRule,
  input: TestInput,
  testResult: RuleTestResult
): Promise<ExecuteRuleResult> {
  const out: ExecuteRuleResult = { actions: testResult.triggeredActions, summary: [] }
  const now = new Date().toISOString()

  // Log that the rule fired
  logEvent('rule_triggered', `Rule "${rule.name}" triggered`, {
    actor: 'Automation',
    meta: { ruleId: rule.id, platform: input.platform },
  })

  // Bump trigger count in storage
  const all = loadRules()
  const idx = all.findIndex(r => r.id === rule.id)
  if (idx >= 0) {
    all[idx] = { ...all[idx], triggerCount: all[idx].triggerCount + 1, lastTriggered: now }
    saveRules(all)
  }

  // ── create_lead ──────────────────────────────────────────────────────────
  if (testResult.triggeredActions.includes('create_lead') && testResult.leadData) {
    const lead = createLeadFromRule({
      ruleId:    rule.id,
      ruleName:  rule.name,
      platform:  input.platform,
      sourceText: input.text,
      need:      testResult.leadData.interest,
    })
    out.createdLeadId = lead.id
    out.summary.push(`✅ Lead created: "${lead.name}" (id: ${lead.id})`)
  }

  // ── generate_reply / save_draft / send_to_approval ───────────────────────
  const needsPost =
    testResult.triggeredActions.includes('generate_reply') ||
    testResult.triggeredActions.includes('save_draft') ||
    testResult.triggeredActions.includes('send_to_approval')

  if (needsPost && testResult.generatedReply) {
    const postId = `post-rule-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const status: import('./aiMarketing').PostStatus =
      testResult.triggeredActions.includes('send_to_approval')
        ? 'pending_approval'
        : 'draft'

    const post = {
      id:              postId,
      contentType:     'comment_reply' as const,
      title:           `[Rule] ${rule.name} — ${input.platform} reply`,
      hook:            '',
      caption:         testResult.generatedReply,
      hashtags:        [] as string[],
      script:          '',
      storyboard:      '',
      emailDraft:      rule.ruleType === 'auto_draft_email' ? testResult.generatedReply : '',
      commentReply:    testResult.generatedReply,
      status,
      platform:        input.platform as Platform,
      createdAt:       now,
      linkedRuleId:    rule.id,
      linkedRuleName:  rule.name,
      linkedCommentText: input.text,
      linkedLeadId:    out.createdLeadId,
      activity: [{
        id:    `evt-${Date.now()}`,
        type:  'rule_triggered' as const,
        label: `Created by automation rule "${rule.name}"`,
        ts:    now,
        actor: 'Automation',
        meta:  { ruleId: rule.id, platform: input.platform },
      }],
    }

    upsertPost(post)
    out.createdPostId = postId
    out.summary.push(`✅ Draft post created: "${post.title}" (status: ${status})`)

    logEvent('generated', `Draft post created by rule "${rule.name}"`, {
      actor: 'Automation',
      meta:  { postId, ruleId: rule.id, status },
    })

    if (status === 'pending_approval') {
      addNotification('pending_approval', 'Post Awaiting Approval',
        `Rule "${rule.name}" sent a draft to the Approval Queue.`,
        { linkSection: 'queue', linkId: `post-${postId}` }
      )
    }
  }

  // ── notify_admin ─────────────────────────────────────────────────────────
  if (testResult.triggeredActions.includes('notify_admin')) {
    addNotification('automation_fired', `Rule Triggered: ${rule.name}`,
      `Matched on ${input.platform}: "${input.text.slice(0, 80)}${input.text.length > 80 ? '…' : ''}"`,
      { linkSection: 'automation' }
    )
    out.summary.push(`🔔 Admin notification sent`)
  }

  return out
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function fmtRelative(iso: string | undefined): string {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins  <  1) return 'Just now'
  if (mins  < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

export function newRuleId(): string {
  return `rule-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

export function newConditionId(): string {
  return `cond-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}
