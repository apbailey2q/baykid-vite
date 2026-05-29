// helpContent.ts — BayKid AI Marketing Center Documentation Content
//
// All help articles, FAQs, and tutorials are defined here.
// HelpCenter.tsx consumes this data for rendering.
// Admin article overrides and custom articles live in localStorage.

// ── Types ──────────────────────────────────────────────────────────────────────

export type HelpBlock =
  | { type: 'p';      text: string }
  | { type: 'h2';     text: string }
  | { type: 'h3';     text: string }
  | { type: 'steps';  items: string[] }
  | { type: 'list';   items: string[] }
  | { type: 'tip';    text: string }
  | { type: 'warning'; text: string }
  | { type: 'code';   text: string; lang?: string }
  | { type: 'video';  title: string; duration: string; description?: string }
  | { type: 'table';  headers: string[]; rows: string[][] }

export interface HelpArticle {
  id:          string
  categoryId:  string
  title:       string
  summary:     string
  content:     HelpBlock[]
  tags:        string[]
  readMinutes: number
  updatedAt:   string
  featured?:   boolean
  adminOnly?:  boolean
  draft?:      boolean
}

export interface HelpCategory {
  id:          string
  label:       string
  icon:        string
  description: string
  color:       string
}

export interface FAQ {
  id:         string
  question:   string
  answer:     string
  categoryId?: string
}

export interface TutorialStep {
  title:       string
  description: string
  tip?:        string
  appSection?: string   // sidebar section id to navigate to
}

export interface Tutorial {
  id:               string
  categoryId:       string
  title:            string
  description:      string
  icon:             string
  difficulty:       'beginner' | 'intermediate' | 'advanced'
  estimatedMinutes: number
  steps:            TutorialStep[]
}

export interface SupportTicket {
  id:         string
  subject:    string
  category:   string
  priority:   'low' | 'medium' | 'high' | 'urgent'
  message:    string
  email:      string
  status:     'open' | 'in_progress' | 'resolved'
  createdAt:  string
  resolvedAt?: string
}

export interface ArticleOverride {
  draft?:        boolean
  hidden?:       boolean
  pinned?:       boolean
  customTitle?:  string
  customSummary?: string
}

// ── Storage keys ───────────────────────────────────────────────────────────────

const VIEWED_KEY          = 'baykid_help_viewed'
const VOTES_KEY           = 'baykid_help_votes'
const CUSTOM_ARTICLES_KEY = 'baykid_help_custom_articles'
const OVERRIDES_KEY       = 'baykid_help_overrides'
const TICKETS_KEY         = 'baykid_support_tickets'

// ── Storage helpers ────────────────────────────────────────────────────────────

export function trackArticleView(id: string): void {
  try {
    const viewed: string[] = JSON.parse(localStorage.getItem(VIEWED_KEY) ?? '[]')
    const deduped = [id, ...viewed.filter((v) => v !== id)].slice(0, 6)
    localStorage.setItem(VIEWED_KEY, JSON.stringify(deduped))
  } catch { /* ignore */ }
}

export function getRecentlyViewed(): string[] {
  try { return JSON.parse(localStorage.getItem(VIEWED_KEY) ?? '[]') }
  catch { return [] }
}

export function voteArticle(id: string, vote: 'up' | 'down'): void {
  try {
    const votes: Record<string, string> = JSON.parse(localStorage.getItem(VOTES_KEY) ?? '{}')
    votes[id] = vote
    localStorage.setItem(VOTES_KEY, JSON.stringify(votes))
  } catch { /* ignore */ }
}

export function getArticleVote(id: string): 'up' | 'down' | null {
  try {
    const votes: Record<string, string> = JSON.parse(localStorage.getItem(VOTES_KEY) ?? '{}')
    return (votes[id] as 'up' | 'down') ?? null
  } catch { return null }
}

export function getOverrides(): Record<string, ArticleOverride> {
  try { return JSON.parse(localStorage.getItem(OVERRIDES_KEY) ?? '{}') }
  catch { return {} }
}

export function saveOverride(articleId: string, override: Partial<ArticleOverride>): void {
  try {
    const all = getOverrides()
    all[articleId] = { ...all[articleId], ...override }
    localStorage.setItem(OVERRIDES_KEY, JSON.stringify(all))
  } catch { /* ignore */ }
}

export function getCustomArticles(): HelpArticle[] {
  try { return JSON.parse(localStorage.getItem(CUSTOM_ARTICLES_KEY) ?? '[]') }
  catch { return [] }
}

export function saveCustomArticle(article: HelpArticle): void {
  try {
    const existing = getCustomArticles()
    const idx = existing.findIndex((a) => a.id === article.id)
    if (idx >= 0) existing[idx] = article
    else existing.push(article)
    localStorage.setItem(CUSTOM_ARTICLES_KEY, JSON.stringify(existing))
  } catch { /* ignore */ }
}

export function deleteCustomArticle(id: string): void {
  try {
    const existing = getCustomArticles().filter((a) => a.id !== id)
    localStorage.setItem(CUSTOM_ARTICLES_KEY, JSON.stringify(existing))
  } catch { /* ignore */ }
}

export function getSupportTickets(): SupportTicket[] {
  try { return JSON.parse(localStorage.getItem(TICKETS_KEY) ?? '[]') }
  catch { return [] }
}

export function saveSupportTicket(ticket: SupportTicket): void {
  try {
    const all = getSupportTickets()
    const idx = all.findIndex((t) => t.id === ticket.id)
    if (idx >= 0) all[idx] = ticket
    else all.unshift(ticket)
    localStorage.setItem(TICKETS_KEY, JSON.stringify(all))
  } catch { /* ignore */ }
}

export function updateTicketStatus(id: string, status: SupportTicket['status']): void {
  try {
    const all = getSupportTickets().map((t) =>
      t.id === id
        ? { ...t, status, resolvedAt: status === 'resolved' ? new Date().toISOString() : t.resolvedAt }
        : t
    )
    localStorage.setItem(TICKETS_KEY, JSON.stringify(all))
  } catch { /* ignore */ }
}

// ── Search ─────────────────────────────────────────────────────────────────────

function extractText(blocks: HelpBlock[]): string {
  return blocks.map((b) => {
    if ('text' in b)  return b.text
    if ('items' in b) return b.items.join(' ')
    if (b.type === 'table') return [...b.headers, ...b.rows.flat()].join(' ')
    if (b.type === 'video') return `${b.title} ${b.description ?? ''}`
    return ''
  }).join(' ')
}

export function searchArticles(query: string): HelpArticle[] {
  const q = query.toLowerCase().trim()
  if (!q) return []
  const terms = q.split(/\s+/)
  const all = [...HELP_ARTICLES, ...getCustomArticles()]
  const overrides = getOverrides()
  return all.filter((a) => {
    if (a.draft) return false
    if (overrides[a.id]?.hidden) return false
    const haystack = [a.title, a.summary, a.tags.join(' '), extractText(a.content)].join(' ').toLowerCase()
    return terms.every((t) => haystack.includes(t))
  })
}

export function getAllArticles(): HelpArticle[] {
  const overrides = getOverrides()
  return [...HELP_ARTICLES, ...getCustomArticles()].map((a) => ({
    ...a,
    title:   overrides[a.id]?.customTitle   ?? a.title,
    summary: overrides[a.id]?.customSummary ?? a.summary,
    draft:   overrides[a.id]?.draft         ?? a.draft,
  }))
}

export function getVisibleArticles(): HelpArticle[] {
  const overrides = getOverrides()
  return getAllArticles().filter((a) => !a.draft && !overrides[a.id]?.hidden)
}

export function getArticlesByCategory(categoryId: string): HelpArticle[] {
  return getVisibleArticles().filter((a) => a.categoryId === categoryId)
}

export function getArticleById(id: string): HelpArticle | undefined {
  return getAllArticles().find((a) => a.id === id)
}

// ── Categories ─────────────────────────────────────────────────────────────────

export const HELP_CATEGORIES: HelpCategory[] = [
  { id: 'getting-started', label: 'Getting Started',    icon: '🚀', description: 'Platform overview, first login, and core workflow',         color: '#00c8ff' },
  { id: 'organizations',   label: 'Organizations',       icon: '🏢', description: 'Orgs, team members, roles, and permissions',                color: '#a78bfa' },
  { id: 'ai-marketing',    label: 'AI Marketing',        icon: '🤖', description: 'Content generation, brand voice, and content types',       color: '#34d399' },
  { id: 'scheduling',      label: 'Scheduling',          icon: '📅', description: 'Content calendar, scheduling, and rescheduling',            color: '#fbbf24' },
  { id: 'approvals',       label: 'Approvals',           icon: '✅', description: 'Approval queue, review workflow, and role permissions',     color: '#22c55e' },
  { id: 'automation',      label: 'Automation Rules',    icon: '⚡', description: 'Automated drafting, triggers, conditions, and actions',    color: '#f59e0b' },
  { id: 'billing',         label: 'Billing',             icon: '💳', description: 'Plans, upgrades, downgrades, and trial periods',           color: '#ec4899' },
  { id: 'troubleshooting', label: 'Troubleshooting',     icon: '🔧', description: 'Common issues, error messages, and contacting support',    color: '#f87171' },
]

// ── Articles ───────────────────────────────────────────────────────────────────

export const HELP_ARTICLES: HelpArticle[] = [

  // ── Getting Started ─────────────────────────────────────────────────────────

  {
    id: 'gs.overview',
    categoryId: 'getting-started',
    title: 'Platform Overview',
    summary: 'What Cyan\'s Brooklynn Marketing Center is, how it works, and who it\'s for.',
    featured: true,
    readMinutes: 3,
    updatedAt: '2026-05-28',
    tags: ['overview', 'intro', 'what is', 'platform'],
    content: [
      { type: 'p', text: 'Cyan\'s Brooklynn Marketing Center is a multi-tenant AI content generation and publishing platform built for recycling and environmental organizations. It uses Claude AI (Anthropic) to generate on-brand social media content, then routes that content through a human approval workflow before publishing.' },
      { type: 'h2', text: 'Three Core Concepts' },
      { type: 'table', headers: ['Concept', 'What it means'], rows: [
        ['Generate', 'Claude AI creates draft content based on your topic, platform, tone, and brand voice'],
        ['Approve', 'A team member reviews and approves (or rejects) the draft before it can be published'],
        ['Publish', 'Approved content is scheduled and published to your connected social platforms'],
      ]},
      { type: 'tip', text: 'Nothing is ever auto-published. Every piece of AI-generated content requires human approval first.' },
      { type: 'h2', text: 'Key Features' },
      { type: 'list', items: [
        'AI content generation for 8 content types across 6 platforms',
        'Multi-organization support — manage multiple recycling programs from one account',
        'Role-based access control — Owners, Admins, Marketing Managers, Content Reviewers, and Viewers',
        'Lead Tracker — CRM pipeline for managing community members and partners',
        'Automation Rules — automatically draft content when conditions are met',
        'Content Calendar — month/week/list views of all scheduled content',
        'System Health Monitor — real-time status of all connected services',
      ]},
      { type: 'h2', text: 'Who Is It For?' },
      { type: 'p', text: 'Cyan\'s Brooklynn is designed for recycling organizations, environmental nonprofits, and sustainability-focused businesses that need to produce consistent social media content without a full-time marketing team. AI handles the first draft; your team handles the final call.' },
    ],
  },

  {
    id: 'gs.first-login',
    categoryId: 'getting-started',
    title: 'Your First Login',
    summary: 'How to accept your invitation, complete the onboarding wizard, and get started.',
    featured: true,
    readMinutes: 4,
    updatedAt: '2026-05-28',
    tags: ['login', 'onboarding', 'invitation', 'setup', 'first time'],
    content: [
      { type: 'h2', text: 'Accepting an Invitation' },
      { type: 'steps', items: [
        'Check your email for a Cyan\'s Brooklynn invitation from your organization admin.',
        'Click the invitation link. You\'ll be taken to the password setup page.',
        'Set a strong password and click Create Account.',
        'You\'ll be automatically signed in and redirected to the AI Marketing Center.',
      ]},
      { type: 'h2', text: 'The Onboarding Wizard' },
      { type: 'p', text: 'On your first login, an onboarding wizard appears that guides you through the essential setup steps. You can skip any step and return later via Settings.' },
      { type: 'list', items: [
        'Brand Voice — describe how your organization sounds (professional, inspiring, friendly)',
        'Platform connections — link your social media accounts',
        'Team invitations — add your colleagues right away',
      ]},
      { type: 'tip', text: 'Take time on Brand Voice — it directly shapes every piece of AI-generated content. The more specific you are, the better the output.' },
      { type: 'h2', text: 'After Onboarding' },
      { type: 'p', text: 'You\'ll land on the Dashboard, which shows your content stats, recent notifications, and upcoming scheduled posts. Use the sidebar to navigate between sections.' },
      { type: 'warning', text: 'If you don\'t receive an invitation email, ask your admin to resend it from Team & Org → Invitations.' },
    ],
  },

  {
    id: 'gs.navigation',
    categoryId: 'getting-started',
    title: 'Navigating the Interface',
    summary: 'A guide to the sidebar, header elements, and where to find everything.',
    readMinutes: 3,
    updatedAt: '2026-05-28',
    tags: ['navigation', 'sidebar', 'interface', 'header', 'sections'],
    content: [
      { type: 'h2', text: 'The Header' },
      { type: 'p', text: 'The sticky header at the top of the screen contains:' },
      { type: 'table', headers: ['Element', 'What it does'], rows: [
        ['← Admin', 'Returns to the main admin dashboard'],
        ['AI Marketing Center', 'The platform logo and name'],
        ['⚡ LIVE / DEMO MODE badge', 'Shows whether you\'re using the real Claude API or demo mode'],
        ['Org Switcher', 'Switches between organizations you belong to'],
        ['🔔 Bell', 'Notification count — click to jump to Dashboard notifications'],
      ]},
      { type: 'h2', text: 'The Sidebar' },
      { type: 'table', headers: ['Section', 'What you do here'], rows: [
        ['📊 Dashboard', 'Stats overview, notifications, recent activity'],
        ['✍️ Social Post', 'Generate AI content for social media'],
        ['🎬 Creative Studio', 'Multi-format content (carousels, reels, emails)'],
        ['💬 Comment Replies', 'AI-draft replies to social comments'],
        ['📧 Email Replies', 'AI-draft replies to customer emails'],
        ['🎯 Lead Tracker', 'CRM pipeline for managing leads'],
        ['📅 Content Calendar', 'Month/week/list views of scheduled posts'],
        ['✅ Approval Queue', 'Review and approve/reject content'],
        ['🚀 Publishing', 'Queue status and publish history'],
        ['⚡ Automation Rules', 'Automated drafting triggers'],
        ['📈 Analytics', 'Performance metrics and insights'],
        ['🏢 Team & Org', 'Team members, invitations, org settings'],
        ['⚙️ Settings', 'Brand voice, API keys, notification preferences'],
        ['❤️ System Health', 'Service status and deployment readiness'],
        ['📚 Help & Docs', 'This help center'],
        ['🧪 QA Checklist', 'Pre-release QA checklist (admin)'],
      ]},
    ],
  },

  {
    id: 'gs.workflow',
    categoryId: 'getting-started',
    title: 'The Core Workflow: Generate → Approve → Publish',
    summary: 'Step-by-step guide to the full content lifecycle from AI generation to live publishing.',
    featured: true,
    readMinutes: 5,
    updatedAt: '2026-05-28',
    tags: ['workflow', 'generate', 'approve', 'publish', 'schedule'],
    content: [
      { type: 'video', title: 'Core Workflow Walkthrough', duration: '4:32', description: 'Watch the complete Generate → Approve → Publish flow in under 5 minutes.' },
      { type: 'h2', text: 'Step 1: Generate Content' },
      { type: 'steps', items: [
        'Navigate to ✍️ Social Post in the sidebar.',
        'Choose a Content Type (e.g. Social Post, Reel Script, Carousel).',
        'Select your Platform (Instagram, TikTok, LinkedIn, etc.).',
        'Pick a Tone (Professional, Friendly, Inspiring, etc.).',
        'Enter a specific Topic — the more detail, the better the output.',
        'Optionally fill in Goal and CTA fields for a more targeted post.',
        'Click Generate. Claude creates draft content in seconds.',
        'Review the output tabs: Hook, Caption, Hashtags, Script, Schedule.',
        'The post is automatically saved as Draft status.',
      ]},
      { type: 'h2', text: 'Step 2: Submit for Approval' },
      { type: 'steps', items: [
        'From the Social Post Generator, click "Send to Approval Queue".',
        'The post status changes from Draft → Pending Approval.',
        'Team members with Content Reviewer role or higher are notified.',
      ]},
      { type: 'h2', text: 'Step 3: Review & Approve' },
      { type: 'steps', items: [
        'Navigate to ✅ Approval Queue.',
        'Find the pending post — review the Hook, Caption, and Hashtags.',
        'Click Approve to approve the post, or Reject with a note explaining why.',
        'Approved posts become available for scheduling.',
        'Rejected posts return to the author with your note visible.',
      ]},
      { type: 'h2', text: 'Step 4: Schedule' },
      { type: 'steps', items: [
        'From the Approval Queue, click Schedule on an approved post.',
        'Pick a date, time, and timezone in the Schedule Picker.',
        'Confirm — the post now appears in 📅 Content Calendar.',
      ]},
      { type: 'h2', text: 'Step 5: Publish' },
      { type: 'steps', items: [
        'At the scheduled time, the 🚀 Publishing system processes the job.',
        'Check Publishing → Queue to see pending jobs.',
        'After processing, the post appears in Publishing → History.',
        'If the publish succeeds, post status becomes "Posted".',
        'If it fails, a retry option is available in History.',
      ]},
      { type: 'tip', text: 'You can also manually mark a post as "Posted" from the Content Calendar if you published it through another channel.' },
    ],
  },

  // ── Organizations ──────────────────────────────────────────────────────────

  {
    id: 'org.create',
    categoryId: 'organizations',
    title: 'Creating and Managing Organizations',
    summary: 'How to create a new organization, switch between orgs, and manage org settings.',
    readMinutes: 4,
    updatedAt: '2026-05-28',
    tags: ['organization', 'create org', 'org switcher', 'multi-tenant'],
    content: [
      { type: 'h2', text: 'What is an Organization?' },
      { type: 'p', text: 'An organization (org) is an isolated workspace with its own team members, content, leads, and settings. If you manage multiple recycling programs or locations, you can create a separate org for each one.' },
      { type: 'h2', text: 'Creating an Organization' },
      { type: 'steps', items: [
        'Click the Org Switcher in the header (shows your current org name).',
        'Click "＋ Create Organization" at the bottom of the dropdown.',
        'The Org Setup wizard opens. Enter:',
        '  • Organization name (e.g. "Cyan\'s Brooklynn Nashville")',
        '  • URL slug — auto-generated from the name, can be customized',
        '  • Timezone — used for scheduling and calendar display',
        'Click Create Organization.',
        'You\'re automatically set as the Owner of the new org.',
        'The wizard continues to Plan selection and optional platform connections.',
      ]},
      { type: 'h2', text: 'Switching Organizations' },
      { type: 'p', text: 'Click the Org Switcher in the header. A dropdown lists all organizations you belong to. Click any org to switch — all content, leads, and settings update to reflect the selected org.' },
      { type: 'tip', text: 'Your active org is saved in the browser. Refreshing the page keeps you in the same org.' },
      { type: 'h2', text: 'Org Overview' },
      { type: 'p', text: 'Navigate to Team & Org → Overview to see your organization\'s plan, member count, post usage, and AI generation usage. Owners and Admins can edit the org name and upgrade the plan from here.' },
    ],
  },

  {
    id: 'org.team',
    categoryId: 'organizations',
    title: 'Inviting Team Members and Managing Roles',
    summary: 'How to invite team members, assign roles, and manage access permissions.',
    readMinutes: 5,
    updatedAt: '2026-05-28',
    tags: ['invite', 'team', 'members', 'roles', 'permissions', 'access'],
    content: [
      { type: 'h2', text: 'Roles at a Glance' },
      { type: 'table', headers: ['Role', 'Generate', 'Approve', 'Publish', 'Invite Team', 'Billing'], rows: [
        ['Owner',             '✓', '✓', '✓', '✓', '✓'],
        ['Super Admin',       '✓', '✓', '✓', '✓', 'View'],
        ['Admin',             '✓', '✓', '✓', '✓', 'View'],
        ['Marketing Manager', '✓', '✓', '✓', '—', '—'],
        ['Content Reviewer',  '—', '✓', '—', '—', '—'],
        ['Viewer',            '—', '—', '—', '—', '—'],
      ]},
      { type: 'h2', text: 'Sending an Invitation' },
      { type: 'steps', items: [
        'Navigate to Team & Org → Team.',
        'Enter the invitee\'s email address in the Invite form.',
        'Select the appropriate role from the dropdown.',
        'Click Send Invite.',
        'The invitation appears in the Invitations tab with "Pending" status.',
        'The invitee receives an email with a link to accept.',
      ]},
      { type: 'h2', text: 'Managing Invitations' },
      { type: 'list', items: [
        'Resend — click Resend on a pending invitation if the email wasn\'t received',
        'Cancel — removes the invitation before it\'s accepted',
        'Accepted invitations move the member to the Team tab',
      ]},
      { type: 'h2', text: 'Changing a Member\'s Role' },
      { type: 'steps', items: [
        'Navigate to Team & Org → Team.',
        'Find the member in the list.',
        'Click the role dropdown next to their name.',
        'Select the new role — the change takes effect immediately.',
      ]},
      { type: 'warning', text: 'Only Owners and Admins can change roles. You cannot change the role of an Owner.' },
      { type: 'h2', text: 'Removing a Member' },
      { type: 'p', text: 'Click the ✕ button next to a member\'s name in the Team list. They immediately lose access to the organization and all its content. Their previously generated content remains.' },
    ],
  },

  {
    id: 'org.settings',
    categoryId: 'organizations',
    title: 'Organization Settings',
    summary: 'Configuring timezone, brand voice, language, notifications, and danger zone.',
    readMinutes: 3,
    updatedAt: '2026-05-28',
    tags: ['settings', 'timezone', 'brand voice', 'language', 'notifications'],
    content: [
      { type: 'p', text: 'Organization settings are found at Team & Org → Org Settings (or ⚙️ Settings for personal preferences).' },
      { type: 'h2', text: 'Timezone' },
      { type: 'p', text: 'Select your organization\'s primary timezone. This affects how scheduled post times are displayed in the Content Calendar and when the publishing system triggers jobs. Always set this to the timezone your social media audience is in.' },
      { type: 'h2', text: 'Brand Voice' },
      { type: 'p', text: 'The Brand Voice field is the most important AI setting. Claude reads this before every content generation. Be specific:' },
      { type: 'list', items: [
        'Describe your organization\'s personality (e.g. "warm and community-focused, never corporate")',
        'List key phrases you always use (e.g. "drop-off", "e-waste")',
        'List words or tones you want to avoid (e.g. "no doom and gloom language")',
        'Mention your target audience (e.g. "homeowners in Nashville ages 25–55")',
      ]},
      { type: 'tip', text: 'After updating brand voice, generate a test post immediately to see how the change affects output.' },
      { type: 'h2', text: 'Default Language' },
      { type: 'p', text: 'Sets the primary language for AI-generated content. Content Reviewer notes and team communications remain in English regardless of this setting.' },
      { type: 'h2', text: 'Email Notifications' },
      { type: 'p', text: 'Configure which events trigger email notifications — approval requests, approvals/rejections, publish failures, follow-up reminders. These are per-member preferences and do not affect other team members.' },
      { type: 'h2', text: 'Danger Zone' },
      { type: 'warning', text: 'The Danger Zone (visible only to Owners) contains the Delete Organization action. This permanently deletes the org, all content, all leads, and all member associations. It cannot be undone.' },
    ],
  },

  // ── AI Marketing ───────────────────────────────────────────────────────────

  {
    id: 'ai.generate',
    categoryId: 'ai-marketing',
    title: 'Generating Your First Social Post',
    summary: 'Step-by-step guide to using the Social Post Generator and getting great AI output.',
    featured: true,
    readMinutes: 5,
    updatedAt: '2026-05-28',
    tags: ['generate', 'social post', 'AI', 'content', 'claude'],
    content: [
      { type: 'video', title: 'Generating Content with Claude AI', duration: '3:15', description: 'Watch a full Social Post generation from topic input to draft saved.' },
      { type: 'h2', text: 'Opening the Generator' },
      { type: 'p', text: 'Click ✍️ Social Post in the sidebar. The Social Post Generator form is on the left; results appear on the right.' },
      { type: 'h2', text: 'Filling in the Form' },
      { type: 'table', headers: ['Field', 'Description', 'Tips'], rows: [
        ['Content Type', 'What you\'re creating', 'Start with Social Post before trying other types'],
        ['Platform', 'Where it will be posted', 'Content is tailored to platform norms'],
        ['Tone', 'The emotional register', 'Match your brand voice setting'],
        ['Topic', 'What the post is about', 'Be specific — the #1 factor in output quality'],
        ['Goal (optional)', 'What action you want', 'e.g. "Drive drop-off registrations"'],
        ['CTA (optional)', 'Call to action text', 'e.g. "Visit cbrecycling.org to schedule"'],
      ]},
      { type: 'tip', text: 'Specific topic → better output. "Benefits of e-waste recycling at Cyan\'s Brooklynn locations in Nashville" beats "recycling" every time.' },
      { type: 'h2', text: 'Reading the Output' },
      { type: 'p', text: 'After generating, results appear in tabs:' },
      { type: 'list', items: [
        'Hook — the attention-grabbing opening line',
        'Caption — the full post body',
        'Hashtags — relevant hashtags for discoverability',
        'Script (Reel/Carousel only) — slide-by-slide or video script',
        'Schedule — suggested best time to post',
      ]},
      { type: 'h2', text: 'What to Do Next' },
      { type: 'list', items: [
        'Edit any tab content directly if needed',
        'Click "Send to Approval Queue" to submit for review',
        'Or "Save Draft" to keep it without submitting',
        'Generate again if you\'re not satisfied — each generation is independent',
      ]},
    ],
  },

  {
    id: 'ai.content-types',
    categoryId: 'ai-marketing',
    title: 'Content Types Explained',
    summary: 'What each content type generates, when to use it, and platform compatibility.',
    readMinutes: 4,
    updatedAt: '2026-05-28',
    tags: ['content types', 'reel script', 'carousel', 'email reply', 'storyboard', 'voiceover'],
    content: [
      { type: 'table', headers: ['Content Type', 'What it generates', 'Best for'], rows: [
        ['Social Post', 'Hook + full caption + hashtags', 'Quick updates, news, events'],
        ['Reel Script', 'Hook + scene-by-scene video script', 'Short-form video (Instagram, TikTok)'],
        ['Carousel', 'Slide titles + copy for each slide', 'Educational content, step-by-step guides'],
        ['Comment Reply', 'Drafted reply to a social comment', 'Community engagement at scale'],
        ['Email Reply', 'Full email response draft', 'Customer inquiry responses'],
        ['Storyboard', 'Shot-by-shot video plan with notes', 'YouTube, longer-form video planning'],
        ['Voiceover', 'Narration script for video content', 'YouTube explainers, ads'],
        ['Analytics Review', 'Plain-language performance summary', 'Monthly reporting, team updates'],
      ]},
      { type: 'tip', text: 'Carousel and Reel Script types are particularly effective for environmental education content — they break complex topics into digestible chunks.' },
    ],
  },

  {
    id: 'ai.platform-tips',
    categoryId: 'ai-marketing',
    title: 'Platform-Specific Content Tips',
    summary: 'How content is tailored per platform and best practices for each.',
    readMinutes: 4,
    updatedAt: '2026-05-28',
    tags: ['instagram', 'tiktok', 'facebook', 'linkedin', 'twitter', 'youtube', 'platforms'],
    content: [
      { type: 'p', text: 'Cyan\'s Brooklynn tailors generated content to each platform\'s norms automatically. Here\'s what to expect:' },
      { type: 'h2', text: 'Instagram' },
      { type: 'list', items: [
        'Caption up to ~2,200 characters with paragraph breaks',
        '3–5 hashtag groups (brand, community, topic)',
        'Hook designed for the "See More" cutoff at ~125 characters',
        'Carousel type generates 5–8 slide captions',
      ]},
      { type: 'h2', text: 'TikTok' },
      { type: 'list', items: [
        'Short captions (under 300 characters)',
        'Hook designed for the first 2 seconds of attention',
        'Reel Script type includes on-screen text and visual cues',
        'Trending hashtag suggestions included',
      ]},
      { type: 'h2', text: 'LinkedIn' },
      { type: 'list', items: [
        'Professional tone by default regardless of tone selection',
        'Longer-form captions with paragraph breaks encouraged',
        'Industry context and data points emphasized when available',
        'No hashtag stuffing — 2–3 relevant hashtags maximum',
      ]},
      { type: 'h2', text: 'Facebook' },
      { type: 'list', items: [
        'Conversational tone with community focus',
        'Includes a clear call-to-action in the caption',
        'Event-style posts can include location and time references',
      ]},
      { type: 'h2', text: 'Twitter / X' },
      { type: 'list', items: [
        'Hard 280-character limit respected',
        'Hook-only style (no separate caption needed)',
        '1–2 hashtags maximum',
      ]},
      { type: 'h2', text: 'YouTube' },
      { type: 'list', items: [
        'Title + description generated separately',
        'Storyboard and Voiceover types are recommended',
        'SEO-optimized description with timestamps placeholder',
      ]},
    ],
  },

  {
    id: 'ai.live-vs-demo',
    categoryId: 'ai-marketing',
    title: 'LIVE vs DEMO MODE Badge',
    summary: 'What the ⚡ LIVE and DEMO MODE badges mean and how to switch between them.',
    readMinutes: 3,
    updatedAt: '2026-05-28',
    tags: ['live', 'demo mode', 'api key', 'badge', 'anthropic'],
    content: [
      { type: 'h2', text: 'What Each Badge Means' },
      { type: 'table', headers: ['Badge', 'Meaning'], rows: [
        ['⚡ LIVE (green)', 'The Claude API is configured and active. Content generation uses the real Anthropic API and consumes API credits.'],
        ['DEMO MODE (blue)', 'No API key is configured or the key failed validation. Content generation returns pre-written mock content. No API credits are consumed.'],
      ]},
      { type: 'h2', text: 'Why You Might See DEMO MODE' },
      { type: 'list', items: [
        'The platform was just deployed and the API key hasn\'t been added to the server environment yet',
        'The API key was entered incorrectly in the server environment',
        'The Anthropic API is temporarily unavailable',
        'The API key has been exhausted (rate limit or billing issue on your Anthropic account)',
      ]},
      { type: 'h2', text: 'How to Switch to LIVE' },
      { type: 'warning', text: 'The API key must be set as a server-side environment variable — never in the browser or prefixed with VITE_. This is a security requirement.' },
      { type: 'p', text: 'For Vercel deployments, the administrator must:' },
      { type: 'steps', items: [
        'Open the Vercel dashboard → Project → Settings → Environment Variables.',
        'Add ANTHROPIC_API_KEY with the value starting with sk-ant-...',
        'Ensure it is NOT prefixed with VITE_ — that would expose it to browsers.',
        'Set it for the Production (and optionally Preview) environments.',
        'Redeploy the project for the change to take effect.',
        'After redeploy, the badge should switch to ⚡ LIVE.',
      ]},
      { type: 'tip', text: 'If you\'re a team member (not the site admin), contact your system administrator or the person who deployed Cyan\'s Brooklynn to configure the API key.' },
    ],
  },

  // ── Scheduling ─────────────────────────────────────────────────────────────

  {
    id: 'sched.calendar',
    categoryId: 'scheduling',
    title: 'Using the Content Calendar',
    summary: 'Month, Week, and List views — how to navigate, view, and act on scheduled posts.',
    readMinutes: 4,
    updatedAt: '2026-05-28',
    tags: ['calendar', 'month view', 'week view', 'list view', 'scheduled'],
    content: [
      { type: 'p', text: 'Navigate to 📅 Content Calendar in the sidebar to see all your scheduled content.' },
      { type: 'h2', text: 'Calendar Views' },
      { type: 'table', headers: ['View', 'Best for'], rows: [
        ['Month', 'Bird\'s-eye overview of the entire month — spot gaps in coverage'],
        ['Week',  'Day-by-day breakdown — see timing across the week'],
        ['List',  'Table view with full metadata — sort, filter, and bulk manage'],
      ]},
      { type: 'h2', text: 'Post Actions from the Calendar' },
      { type: 'table', headers: ['Action', 'What it does'], rows: [
        ['Edit',           'Open the post for inline caption and hashtag editing'],
        ['Reschedule',     'Open the Schedule Picker to change date, time, and timezone'],
        ['Duplicate',      'Create a new Draft copy of the post for a different platform or time'],
        ['Delete',         'Remove the post from the calendar entirely (requires confirmation)'],
        ['Mark as Posted', 'Manually mark the post as published — useful if posted through another tool'],
      ]},
      { type: 'h2', text: 'Navigating Dates' },
      { type: 'p', text: 'Use the ‹ and › arrows to move between months or weeks. Click any day in Month view to jump to the Week view for that day.' },
      { type: 'tip', text: 'The List view is the most useful for bulk operations — you can sort by platform, status, or scheduled date and act on multiple posts quickly.' },
    ],
  },

  {
    id: 'sched.scheduling',
    categoryId: 'scheduling',
    title: 'Scheduling and Rescheduling Posts',
    summary: 'How to schedule an approved post, change its time, and handle timezone correctly.',
    readMinutes: 3,
    updatedAt: '2026-05-28',
    tags: ['schedule', 'reschedule', 'timezone', 'approved post', 'date picker'],
    content: [
      { type: 'h2', text: 'Scheduling an Approved Post' },
      { type: 'steps', items: [
        'Navigate to ✅ Approval Queue.',
        'Find a post with "Approved" status.',
        'Click the Schedule button.',
        'The Schedule Picker opens with a date, time, and timezone selector.',
        'Choose your desired date and time.',
        'Select the correct timezone — defaults to your org timezone.',
        'Click Confirm Schedule.',
        'The post status changes to "Scheduled" and appears in the Content Calendar.',
      ]},
      { type: 'h2', text: 'Rescheduling a Post' },
      { type: 'steps', items: [
        'Navigate to 📅 Content Calendar.',
        'Find the post you want to reschedule.',
        'Click the Reschedule button.',
        'The Schedule Picker opens with the current date/time pre-filled.',
        'Adjust the date, time, or timezone as needed.',
        'Click Confirm — the calendar updates immediately.',
      ]},
      { type: 'warning', text: 'Rescheduling a post that is already in the Publishing queue may not cancel the in-flight job. Check Publishing → Queue and cancel manually if needed.' },
      { type: 'tip', text: 'For best engagement on environmental content, try 9–11 AM or 6–8 PM in your audience\'s local timezone.' },
    ],
  },

  // ── Approvals ──────────────────────────────────────────────────────────────

  {
    id: 'approvals.queue',
    categoryId: 'approvals',
    title: 'Using the Approval Queue',
    summary: 'How to submit, review, approve, and reject content in the Approval Queue.',
    readMinutes: 4,
    updatedAt: '2026-05-28',
    tags: ['approval queue', 'approve', 'reject', 'review', 'pending'],
    content: [
      { type: 'p', text: 'The Approval Queue is the checkpoint between AI-generated content and published content. Nothing goes live without being approved here.' },
      { type: 'h2', text: 'Submitting Content for Approval' },
      { type: 'steps', items: [
        'Generate content in ✍️ Social Post or ⚡ Automation Rules.',
        'From the generator, click "Send to Approval Queue".',
        'The post status changes to "Pending Approval".',
        'Team members with Content Reviewer role or higher are notified.',
      ]},
      { type: 'h2', text: 'Reviewing a Post' },
      { type: 'steps', items: [
        'Navigate to ✅ Approval Queue.',
        'Posts are listed with their Hook, platform, and submission time.',
        'Click on a post to expand the full content (Hook, Caption, Hashtags).',
        'Review the content for accuracy, brand voice, and appropriateness.',
      ]},
      { type: 'h2', text: 'Approving a Post' },
      { type: 'p', text: 'Click the Approve button. The post status changes to "Approved" and it becomes available for scheduling. The post author receives an "approved" notification.' },
      { type: 'h2', text: 'Rejecting a Post' },
      { type: 'steps', items: [
        'Click the Reject button.',
        'A note field appears — enter a brief explanation for the rejection.',
        'Click Confirm Reject.',
        'The post status changes to "Rejected" and the author can see your note.',
        'The author can edit and resubmit, or generate a new version.',
      ]},
      { type: 'tip', text: 'Rejection notes help your team understand the issue. Be specific: "Tone too formal for Facebook audience" is more useful than "Needs revision".' },
    ],
  },

  {
    id: 'approvals.permissions',
    categoryId: 'approvals',
    title: 'Approval Permissions by Role',
    summary: 'Which roles can approve, reject, schedule, and publish — and what Viewers cannot do.',
    readMinutes: 2,
    updatedAt: '2026-05-28',
    tags: ['permissions', 'roles', 'viewer', 'content reviewer', 'approve', 'reject'],
    content: [
      { type: 'table', headers: ['Action', 'Owner', 'Admin', 'Mktg Manager', 'Content Reviewer', 'Viewer'], rows: [
        ['Submit for approval', '✓', '✓', '✓', '—', '—'],
        ['Approve post',        '✓', '✓', '✓', '✓', '—'],
        ['Reject post',         '✓', '✓', '✓', '✓', '—'],
        ['Schedule post',       '✓', '✓', '✓', '—', '—'],
        ['Publish post',        '✓', '✓', '✓', '—', '—'],
      ]},
      { type: 'tip', text: 'Content Reviewer is the right role for stakeholders who need to review and approve content but shouldn\'t be able to schedule or publish.' },
      { type: 'warning', text: 'Viewers can see the Approval Queue but all action buttons are hidden. This is by design for read-only stakeholders.' },
    ],
  },

  // ── Automation ─────────────────────────────────────────────────────────────

  {
    id: 'auto.overview',
    categoryId: 'automation',
    title: 'Introduction to Automation Rules',
    summary: 'What automation rules do, how they work, and the draft-only safety guarantee.',
    readMinutes: 3,
    updatedAt: '2026-05-28',
    tags: ['automation', 'rules', 'trigger', 'draft', 'safety', 'auto-reply'],
    content: [
      { type: 'h2', text: 'What Are Automation Rules?' },
      { type: 'p', text: 'Automation Rules let you configure conditions that trigger AI content generation automatically. When a rule fires, it creates a draft — never publishes directly.' },
      { type: 'warning', text: 'All automation output is DRAFT-ONLY. No content is ever auto-published or auto-sent without a human reviewing and approving it first.' },
      { type: 'h2', text: 'Example Use Cases' },
      { type: 'list', items: [
        'When a social comment contains pricing keywords → draft a polite pricing reply',
        'When a comment contains negative sentiment → flag for team review',
        'When a new lead is detected from a comment → create a draft reply and add to CRM',
        'Scheduled topic: every Monday, draft a weekly environmental tip post',
      ]},
      { type: 'h2', text: 'How Rules Work' },
      { type: 'steps', items: [
        'A trigger fires (e.g. new comment detected)',
        'Cyan\'s Brooklynn checks all enabled rules for matching conditions',
        'If conditions match, the configured action runs',
        'Action outputs a draft to the Approval Queue or Lead Tracker',
        'Your team reviews and takes action from there',
      ]},
      { type: 'tip', text: 'Start with the pre-configured "Pricing Inquiry Auto-Reply" rule to see automation in action before building your own.' },
    ],
  },

  {
    id: 'auto.create',
    categoryId: 'automation',
    title: 'Creating Automation Rules',
    summary: 'How to configure trigger types, conditions, and actions for a new rule.',
    readMinutes: 4,
    updatedAt: '2026-05-28',
    tags: ['create rule', 'trigger', 'conditions', 'actions', 'keywords'],
    content: [
      { type: 'steps', items: [
        'Navigate to ⚡ Automation Rules.',
        'Click "+ New Rule".',
        'Enter a rule name (e.g. "Pricing Inquiry Auto-Reply").',
        'Choose the trigger type:',
        '  • Comment detected — fires when a new social comment arrives',
        '  • Email received — fires when a new customer email arrives',
        '  • Scheduled — fires at a recurring time (daily/weekly)',
        'Set conditions (keywords, sentiment, platform, etc.)',
        'Choose the action:',
        '  • "Generate Reply" — creates a draft AI reply',
        '  • "Send to Approval Queue" — queues existing content for review',
        '  • "Create Lead" — adds the commenter to your CRM',
        'Click Save. Toggle the rule ON to activate it.',
      ]},
      { type: 'h2', text: 'Condition Tips' },
      { type: 'list', items: [
        'Use specific keywords to avoid false positives — "how much" triggers more reliably than "price"',
        'Combine conditions with AND/OR logic for precision',
        'Test every rule before enabling it in production',
      ]},
    ],
  },

  {
    id: 'auto.test',
    categoryId: 'automation',
    title: 'Testing Automation Rules',
    summary: 'How to use the Test button to verify a rule fires correctly before enabling it.',
    readMinutes: 2,
    updatedAt: '2026-05-28',
    tags: ['test rule', 'automation test', 'would trigger', 'debugging'],
    content: [
      { type: 'steps', items: [
        'Navigate to ⚡ Automation Rules.',
        'Find the rule you want to test.',
        'Click the Test button on the rule.',
        'A test panel opens with a text input field.',
        'Enter sample text that should trigger the rule (e.g. "How much does pickup cost?")',
        'Click Run Test.',
        'The result shows either "Would trigger" or "Would not trigger".',
        'If it would trigger, a preview of the AI output is shown.',
      ]},
      { type: 'tip', text: 'Test both positive cases (text that should trigger) and negative cases (text that shouldn\'t trigger) to verify your conditions are precise.' },
      { type: 'p', text: 'Each test run increments the rule\'s test counter. The runs counter in the rule list only counts real triggers — not test runs.' },
    ],
  },

  // ── Billing ────────────────────────────────────────────────────────────────

  {
    id: 'billing.plans',
    categoryId: 'billing',
    title: 'Plans and Pricing',
    summary: 'Comparison of Free, Starter, Pro, and Agency plans and what each includes.',
    readMinutes: 3,
    updatedAt: '2026-05-28',
    tags: ['plans', 'pricing', 'free', 'starter', 'pro', 'agency', 'limits'],
    content: [
      { type: 'table', headers: ['Feature', 'Free', 'Starter', 'Pro', 'Agency'], rows: [
        ['Team members',   '2',        '5',       '15',       'Unlimited'],
        ['Posts/month',    '20',       '100',     '500',      'Unlimited'],
        ['AI generations', '10/month', '100/mo',  '500/mo',   'Unlimited'],
        ['Organizations',  '1',        '1',       '3',        'Unlimited'],
        ['Automation rules', '—',      '3',       'Unlimited','Unlimited'],
        ['Analytics',      'Basic',    'Standard','Advanced', 'Full'],
        ['Support',        'Community','Email',   'Priority', 'Dedicated'],
      ]},
      { type: 'tip', text: 'Most recycling organizations with a small team start on Starter. Upgrade to Pro when you need more AI generations or multiple platform strategies.' },
    ],
  },

  {
    id: 'billing.upgrade',
    categoryId: 'billing',
    title: 'Upgrading or Downgrading Your Plan',
    summary: 'How to change your plan, what happens to existing content, and Stripe checkout.',
    readMinutes: 3,
    updatedAt: '2026-05-28',
    tags: ['upgrade', 'downgrade', 'plan change', 'stripe', 'billing'],
    content: [
      { type: 'h2', text: 'Upgrading' },
      { type: 'steps', items: [
        'Navigate to Team & Org → Overview.',
        'Click "Upgrade Plan".',
        'The plan selection cards appear with pricing.',
        'Click the plan you want.',
        'If Stripe is connected, you\'ll be redirected to Stripe Checkout.',
        'Complete payment — you\'ll return to Cyan\'s Brooklynn with the new plan active.',
        'New limits (members, posts, AI generations) take effect immediately.',
      ]},
      { type: 'h2', text: 'Downgrading' },
      { type: 'p', text: 'Select a lower-tier plan from the plan selection cards. If your current usage exceeds the new plan\'s limits, you\'ll see a warning before confirming. Existing content and data is not deleted — only new creation is limited once you hit the new cap.' },
      { type: 'warning', text: 'Downgrading to Free removes access to Automation Rules. Any configured rules are preserved but disabled until you upgrade again.' },
    ],
  },

  {
    id: 'billing.trial',
    categoryId: 'billing',
    title: 'Trial Period',
    summary: 'What the trial includes, how long it lasts, and what happens when it expires.',
    readMinutes: 2,
    updatedAt: '2026-05-28',
    tags: ['trial', 'trial expiration', 'free trial', 'subscribe'],
    content: [
      { type: 'p', text: 'New organizations start on a free trial of the Pro plan. All Pro features are available during the trial with no payment required.' },
      { type: 'h2', text: 'Trial Duration' },
      { type: 'p', text: 'The standard trial period is 14 days. Your trial expiration date is shown in Team & Org → Overview.' },
      { type: 'h2', text: 'When the Trial Expires' },
      { type: 'list', items: [
        'You\'ll see a notification prompting you to subscribe or continue on Free.',
        'If you take no action, the org moves to the Free plan automatically.',
        'All content, leads, and settings are preserved.',
        'Features above the Free plan limit become read-only (existing data visible, new creation blocked).',
      ]},
      { type: 'tip', text: 'Subscribe before the trial ends to avoid any disruption to your automation rules and team access.' },
    ],
  },

  // ── Troubleshooting ────────────────────────────────────────────────────────

  {
    id: 'ts.common',
    categoryId: 'troubleshooting',
    title: 'Common Issues and Solutions',
    summary: 'Fixes for the most frequently encountered problems in Cyan\'s Brooklynn.',
    featured: true,
    readMinutes: 5,
    updatedAt: '2026-05-28',
    tags: ['troubleshooting', 'error', 'not loading', 'login', 'generation failed'],
    content: [
      { type: 'h2', text: 'Login / Authentication Issues' },
      { type: 'table', headers: ['Problem', 'Solution'], rows: [
        ['Can\'t log in with correct password', 'Use "Forgot Password" to reset. Check for typos in the email address.'],
        ['Invitation email not received', 'Check spam folder. Ask admin to resend from Team & Org → Invitations.'],
        ['Logged out unexpectedly', 'Session expired after inactivity. Log in again — your data is preserved.'],
        ['Redirected to login from a protected page', 'Normal behavior when not logged in. Log in to access the AI Marketing Center.'],
      ]},
      { type: 'h2', text: 'Content Generation Issues' },
      { type: 'table', headers: ['Problem', 'Solution'], rows: [
        ['Generation fails with "network error"', 'Check your internet connection. If DEMO MODE is shown, the API may be down — try again in a few minutes.'],
        ['"Too many requests" message', 'Rate limit reached. Wait 60 seconds and try again. The limit resets per minute.'],
        ['Generated content seems off-brand', 'Review your Brand Voice in Settings. The more specific, the better the output.'],
        ['Output is empty or malformed', 'Regenerate once. If it fails repeatedly, check System Health for API status.'],
      ]},
      { type: 'h2', text: 'Calendar and Scheduling Issues' },
      { type: 'table', headers: ['Problem', 'Solution'], rows: [
        ['Post doesn\'t appear in calendar', 'Post must be "Approved" and then scheduled. Draft and Pending posts don\'t show.'],
        ['Wrong time shown for scheduled post', 'Verify your org timezone in Team & Org → Org Settings.'],
        ['Can\'t reschedule a post', 'Posts in the Publishing queue may be locked. Cancel the queue job first.'],
      ]},
      { type: 'h2', text: 'Permission / Access Issues' },
      { type: 'table', headers: ['Problem', 'Solution'], rows: [
        ['Approve/Reject buttons not visible', 'Your role is Viewer. Ask an admin to change it to Content Reviewer or higher.'],
        ['Can\'t see billing options', 'Billing is Owner-only. Contact your org Owner.'],
        ['Can\'t invite team members', 'Invite access requires Admin role or higher.'],
      ]},
    ],
  },

  {
    id: 'ts.health',
    categoryId: 'troubleshooting',
    title: 'Using System Health to Diagnose Issues',
    summary: 'How the System Health monitor works and what each status indicator means.',
    readMinutes: 3,
    updatedAt: '2026-05-28',
    tags: ['system health', 'status', 'diagnostics', 'services', 'API status'],
    content: [
      { type: 'p', text: 'Navigate to ❤️ System Health in the sidebar to see real-time status of all platform services.' },
      { type: 'h2', text: 'Status Indicators' },
      { type: 'table', headers: ['Status', 'Meaning'], rows: [
        ['🟢 Operational', 'Service is working normally'],
        ['🟡 Degraded',    'Service is working but slower than normal or with reduced functionality'],
        ['🔴 Down',        'Service is unavailable — check back in a few minutes'],
        ['⚪ Unknown',     'Status check hasn\'t completed yet'],
      ]},
      { type: 'h2', text: 'What Each Service Covers' },
      { type: 'list', items: [
        'Claude API — AI content generation (affects Social Post, Creative Studio, Automation)',
        'Supabase — Database connectivity (affects data persistence across sessions)',
        'Publishing — Social media publish queue',
        'Authentication — Login and session management',
      ]},
      { type: 'tip', text: 'If Claude API shows degraded or down, generation will fall back to DEMO MODE automatically. Your content still generates — it just uses pre-written mock content.' },
    ],
  },

  {
    id: 'ts.contact',
    categoryId: 'troubleshooting',
    title: 'Contacting Support',
    summary: 'How to submit a support ticket, what to include, and expected response times.',
    readMinutes: 2,
    updatedAt: '2026-05-28',
    tags: ['support', 'contact', 'help ticket', 'response time'],
    content: [
      { type: 'p', text: 'If you can\'t resolve an issue with the documentation or System Health diagnostics, submit a support ticket.' },
      { type: 'h2', text: 'Submitting a Ticket' },
      { type: 'steps', items: [
        'Navigate to 📚 Help & Docs → Support.',
        'Fill in the subject, category, and priority.',
        'Describe the issue in detail — include:',
        '  • What you were trying to do',
        '  • What happened instead',
        '  • Any error messages you saw',
        '  • Your browser and OS (if a display issue)',
        'Click Submit.',
        'You\'ll receive a confirmation and can track status in your Past Tickets list.',
      ]},
      { type: 'h2', text: 'Response Time by Priority' },
      { type: 'table', headers: ['Priority', 'Response Target'], rows: [
        ['Urgent', 'Within 2 hours (production down, data loss)'],
        ['High',   'Within 4 hours (major feature broken)'],
        ['Medium', 'Within 24 hours (partial functionality)'],
        ['Low',    'Within 48 hours (questions, minor issues)'],
      ]},
      { type: 'tip', text: 'For the fastest response, include your org name, the section of the app affected, and the exact error message if one appeared.' },
    ],
  },

]

// ── FAQs ───────────────────────────────────────────────────────────────────────

export const FAQS: FAQ[] = [
  {
    id: 'faq.auto-publish',
    categoryId: 'automation',
    question: 'Will automation rules publish content automatically without human review?',
    answer: 'No. All automation output is DRAFT-ONLY. Automation rules can generate AI drafts and queue them for review, but nothing is published without a human explicitly approving it in the Approval Queue first. This is a core safety guarantee of the platform.',
  },
  {
    id: 'faq.api-key-browser',
    categoryId: 'ai-marketing',
    question: 'Is the Claude API key exposed to users in the browser?',
    answer: 'No. The ANTHROPIC_API_KEY is stored exclusively as a server-side environment variable and is never sent to the browser. API calls are proxied through a secure Vercel serverless function. You will never see the API key in browser DevTools or network requests.',
  },
  {
    id: 'faq.demo-vs-live',
    categoryId: 'ai-marketing',
    question: 'What\'s the difference between DEMO MODE and LIVE mode?',
    answer: 'In DEMO MODE, content generation returns pre-written mock content — no Claude API calls are made and no API credits are used. In LIVE mode (⚡ LIVE badge), the real Claude API is called for every generation. Your admin configures the API key on the server to switch from DEMO to LIVE.',
  },
  {
    id: 'faq.org-isolation',
    categoryId: 'organizations',
    question: 'Is content from different organizations truly isolated?',
    answer: 'Yes. Each organization has strict data isolation enforced at both the application layer and the Supabase Row Level Security (RLS) layer. Users can only access content from organizations they are members of. Switching orgs in the header changes the entire data context.',
  },
  {
    id: 'faq.delete-post',
    categoryId: 'scheduling',
    question: 'If I delete a scheduled post, will it still publish?',
    answer: 'Deleting a scheduled post from the Content Calendar removes it from scheduling and prevents publishing. However, if the post is already processing in the Publishing queue at the moment of deletion, check Publishing → Queue to ensure the job is cancelled.',
  },
  {
    id: 'faq.viewer-role',
    categoryId: 'approvals',
    question: 'What can a Viewer-role user actually see?',
    answer: 'Viewers can navigate all sections of the AI Marketing Center and see content, leads, analytics, and the approval queue. However, all action buttons are hidden — they cannot generate content, approve/reject, schedule, publish, or invite members. It\'s a fully read-only role.',
  },
  {
    id: 'faq.brand-voice-immediate',
    categoryId: 'ai-marketing',
    question: 'Does updating Brand Voice affect previously generated content?',
    answer: 'No. Brand Voice changes only affect new content generations. Existing drafts and approved posts are not retroactively changed. To apply a new brand voice to existing content, regenerate the post from scratch.',
  },
  {
    id: 'faq.retry-failed',
    categoryId: 'troubleshooting',
    question: 'A publish job failed. What should I do?',
    answer: 'Navigate to 🚀 Publishing → History and find the failed job. Click the Retry button to re-queue the job. If it fails again, check that your social media platform connection is valid (authentication may have expired). After the maximum retry attempts, the job is marked as permanently failed and will not auto-retry.',
  },
  {
    id: 'faq.multiple-orgs',
    categoryId: 'organizations',
    question: 'Can I be a member of multiple organizations?',
    answer: 'Yes. You can belong to multiple organizations with different roles in each. Use the Org Switcher in the header to switch between them. Each org\'s content, settings, and leads are completely separate.',
  },
  {
    id: 'faq.mobile',
    categoryId: 'getting-started',
    question: 'Does Cyan\'s Brooklynn work on mobile devices?',
    answer: 'Cyan\'s Brooklynn Marketing Center is optimized for desktop and laptop screens. The interface is accessible on tablets in landscape mode, but the full feature set — especially content generation, calendar management, and team management — works best on a desktop browser.',
  },
  {
    id: 'faq.data-loss',
    categoryId: 'troubleshooting',
    question: 'I refreshed the page and my generated post is gone. Is my data lost?',
    answer: 'All generated posts are saved automatically as drafts in local storage and synced to the database. Navigate to ✍️ Social Post and look for your post in the Drafts list below the generator. If it\'s not there, check ✅ Approval Queue or 📅 Content Calendar depending on its status.',
  },
  {
    id: 'faq.hashtag-count',
    categoryId: 'ai-marketing',
    question: 'How many hashtags does the AI generate?',
    answer: 'The number varies by platform: Instagram gets 15–25 hashtags grouped by reach (brand, community, discovery). LinkedIn gets 2–3 relevant hashtags. TikTok gets 5–8 trending hashtags. Twitter gets 1–2 hashtags. You can always edit the hashtags tab before submitting for approval.',
  },
  {
    id: 'faq.cancel-invite',
    categoryId: 'organizations',
    question: 'Can I cancel an invitation after sending it?',
    answer: 'Yes. Navigate to Team & Org → Invitations and click Cancel on any pending invitation. If the invitee clicks the link after cancellation, they\'ll see an "invitation expired" message. Cancelled invitations cannot be reinstated — send a new invitation if needed.',
  },
  {
    id: 'faq.automation-limit',
    categoryId: 'automation',
    question: 'How many automation rules can I have?',
    answer: 'Rule limits depend on your plan. Free: 0 rules. Starter: 3 rules. Pro and Agency: unlimited rules. Disabled rules still count toward your limit on the Starter plan.',
  },
  {
    id: 'faq.timezone-scheduling',
    categoryId: 'scheduling',
    question: 'If my team is in different timezones, which timezone do scheduled posts use?',
    answer: 'The Schedule Picker lets you choose any timezone when scheduling a post. The selected timezone is shown in the Content Calendar. Your org\'s default timezone (set in Team & Org → Org Settings) pre-fills the timezone dropdown, but you can change it per post.',
  },
]

// ── Tutorials ──────────────────────────────────────────────────────────────────

export const TUTORIALS: Tutorial[] = [
  {
    id: 'tut.first-post',
    categoryId: 'getting-started',
    title: 'Generate Your First Post',
    description: 'Go from blank page to approved draft in under 10 minutes.',
    icon: '✍️',
    difficulty: 'beginner',
    estimatedMinutes: 8,
    steps: [
      {
        title: 'Open the Social Post Generator',
        description: 'Click ✍️ Social Post in the left sidebar. You\'ll see the generator form on the left and an empty results area on the right.',
        appSection: 'social-post',
      },
      {
        title: 'Choose your content type and platform',
        description: 'Select "Social Post" as the content type and "Instagram" as the platform. These can be changed later — just start somewhere.',
        tip: 'Instagram is a great platform to start with because the output format is the most flexible.',
      },
      {
        title: 'Pick a tone',
        description: 'Select "Friendly" for your first post. This tone works well for community-oriented recycling content and is the most natural-sounding.',
      },
      {
        title: 'Enter a specific topic',
        description: 'In the Topic field, type something specific about your organization. For example: "Benefits of dropping off old electronics at our recycling center rather than throwing them away". Specific topics produce much better content than vague ones.',
        tip: 'Avoid one-word topics like "recycling" — Claude needs context to write something compelling and specific to your org.',
      },
      {
        title: 'Click Generate',
        description: 'Click the Generate button. The loading indicator shows Claude is working. This usually takes 3–8 seconds. Watch for the ⚡ LIVE badge — if it shows DEMO MODE, you\'re seeing sample content.',
      },
      {
        title: 'Review the output tabs',
        description: 'Click through the Hook, Caption, and Hashtags tabs to see the generated content. The Hook is your attention-grabber, the Caption is the full post body, and Hashtags are ready to copy.',
        tip: 'If the output doesn\'t feel right, try rephrasing the topic or switching the tone and generate again. Each generation is fresh.',
      },
      {
        title: 'Send to Approval Queue',
        description: 'Click "Send to Approval Queue". The post status changes to "Pending Approval" and any team members with Content Reviewer role or higher are notified.',
        appSection: 'queue',
      },
      {
        title: 'Approve the post',
        description: 'Navigate to ✅ Approval Queue, find your post, expand it, and click Approve. You\'ve completed the full Generate → Approve flow. The post is now ready to schedule!',
        appSection: 'queue',
      },
    ],
  },

  {
    id: 'tut.setup-team',
    categoryId: 'organizations',
    title: 'Set Up Your Team',
    description: 'Invite team members, assign the right roles, and configure brand voice.',
    icon: '🏢',
    difficulty: 'beginner',
    estimatedMinutes: 10,
    steps: [
      {
        title: 'Navigate to Team & Org',
        description: 'Click 🏢 Team & Org in the sidebar. This is your organization management hub.',
        appSection: 'organization',
      },
      {
        title: 'Review current team members',
        description: 'The Team tab shows all current members. Check that your role is Owner or Admin — you\'ll need this to send invitations.',
      },
      {
        title: 'Invite a Content Reviewer',
        description: 'In the Team tab, find the invitation form. Enter the email of someone who should review content — a manager, director, or stakeholder. Select "Content Reviewer" as the role. Click Send Invite.',
        tip: 'Content Reviewers can approve/reject posts but cannot generate content or manage the team. This is the safest role for executive stakeholders.',
      },
      {
        title: 'Invite a Marketing Manager',
        description: 'Send a second invitation to your content creator — the person who will be generating posts. Select "Marketing Manager" as the role. They can generate, approve, reject, and schedule content.',
      },
      {
        title: 'Check the Invitations tab',
        description: 'Click the Invitations tab to see both pending invitations. From here you can resend if an email wasn\'t received or cancel if you made a mistake.',
      },
      {
        title: 'Set your Brand Voice',
        description: 'Click the Org Settings tab. Find the Brand Voice field and write a description of your organization\'s tone and personality. Be specific about vocabulary, style, and what to avoid.',
        tip: 'Example: "Warm, community-focused, and educational. We celebrate small wins and avoid guilt-based environmental messaging. We use \'drop off\' not \'dispose\'. Our audience is suburban homeowners."',
        appSection: 'settings',
      },
      {
        title: 'Save and test',
        description: 'Click Save in Org Settings. Then navigate to Social Post and generate a test post. Review whether the output reflects the brand voice you just set.',
        appSection: 'social-post',
      },
    ],
  },

  {
    id: 'tut.automation-rule',
    categoryId: 'automation',
    title: 'Build an Automation Rule',
    description: 'Create and test a rule that auto-drafts a reply when a pricing question is detected.',
    icon: '⚡',
    difficulty: 'intermediate',
    estimatedMinutes: 12,
    steps: [
      {
        title: 'Open Automation Rules',
        description: 'Navigate to ⚡ Automation Rules in the sidebar.',
        appSection: 'automation',
      },
      {
        title: 'Review the default rules',
        description: 'Cyan\'s Brooklynn ships with two default rules: "Pricing Inquiry Auto-Reply" and "High-Risk Comment Flag". Read through them to understand the structure before creating your own.',
      },
      {
        title: 'Create a new rule',
        description: 'Click "+ New Rule". Give it a descriptive name like "E-Waste Drop-Off Hours Reply".',
      },
      {
        title: 'Set the trigger',
        description: 'Select "Comment detected" as the trigger type. This rule will fire whenever a new comment is received on a connected social account.',
      },
      {
        title: 'Add conditions',
        description: 'Add a keyword condition: the comment must contain any of these words — "hours", "open", "when", "time", "schedule". This targets people asking about operating hours.',
        tip: 'Keep conditions specific enough to avoid false positives. Test before enabling.',
      },
      {
        title: 'Choose an action',
        description: 'Set the action to "Generate Reply". This tells Cyan\'s Brooklynn to use Claude AI to draft a reply to the comment and send it to the Approval Queue.',
      },
      {
        title: 'Save the rule',
        description: 'Click Save. The rule appears in your rules list with a toggle — it\'s OFF by default. Don\'t enable it yet.',
      },
      {
        title: 'Test the rule',
        description: 'Click the Test button on your new rule. Enter "Hey, what are your drop-off hours on weekends?" and click Run Test. You should see "Would trigger" and a preview of the AI reply.',
      },
      {
        title: 'Test a negative case',
        description: 'Run the test again with "Great post, love what you do!" — this should show "Would not trigger". This confirms your conditions are specific enough.',
        tip: 'Always test both positive and negative cases before enabling a rule in production.',
      },
      {
        title: 'Enable the rule',
        description: 'Toggle the rule ON. It will now automatically draft replies for matching comments and send them to your Approval Queue for human review before anything is sent.',
        appSection: 'automation',
      },
    ],
  },

  {
    id: 'tut.full-publish',
    categoryId: 'scheduling',
    title: 'Full Publish Workflow',
    description: 'Generate content, approve it, schedule it, and track the publish result.',
    icon: '🚀',
    difficulty: 'intermediate',
    estimatedMinutes: 15,
    steps: [
      {
        title: 'Generate a post',
        description: 'Open ✍️ Social Post. Create a LinkedIn post with Professional tone about your organization\'s environmental impact. Fill in a specific topic like "Our recycling program diverted 50,000 pounds of e-waste from landfills last quarter."',
        appSection: 'social-post',
      },
      {
        title: 'Review and edit',
        description: 'Look through the Hook and Caption tabs. Make any edits directly in the text areas — perhaps add a specific statistic or adjust the CTA. The edits are saved automatically.',
      },
      {
        title: 'Send to Approval Queue',
        description: 'Click "Send to Approval Queue". Note the post status badge changes to "Pending Approval".',
      },
      {
        title: 'Approve from the queue',
        description: 'Navigate to ✅ Approval Queue. Expand the post and review it once more. Click Approve.',
        appSection: 'queue',
      },
      {
        title: 'Schedule the post',
        description: 'Click the Schedule button on the approved post. The Schedule Picker opens. Pick tomorrow at 10:00 AM in your org\'s timezone. Click Confirm Schedule.',
      },
      {
        title: 'Find it in the Calendar',
        description: 'Navigate to 📅 Content Calendar. Switch to Week view. Find your post tomorrow at 10:00 AM. The post card shows the platform and hook preview.',
        appSection: 'calendar',
      },
      {
        title: 'Check Publishing queue',
        description: 'Navigate to 🚀 Publishing → Queue tab. If the scheduled time is in the past or very near, your post may already appear here. At the scheduled time, Cyan\'s Brooklynn processes it.',
        appSection: 'publish',
      },
      {
        title: 'Review publish history',
        description: 'After the post processes, navigate to Publishing → History. Find your post and confirm the status — either "Published" or a failure reason with a Retry button.',
      },
      {
        title: 'Check the stats',
        description: 'Navigate to 📊 Dashboard. The Published count in your stats should have incremented by 1. Congratulations — you\'ve completed the full Generate → Approve → Schedule → Publish flow!',
        appSection: 'dashboard',
      },
    ],
  },
]
