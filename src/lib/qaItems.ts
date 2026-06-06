// qaItems.ts — Canonical QA checklist definition for the BayKid AI Marketing Center
//
// Each item maps to an entry in `QAChecklistRunRow.items` (Record<id, QAItemStatus>).
// The id is the persistence key — never rename it without migrating saved runs.
//
// Sections are rendered in the order they appear here.

import type { QAItemStatus } from '../types/betaLaunch'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface QAItem {
  /** Unique stable key — used as the Record<string, QAItemStatus> key. */
  id:           string
  label:        string
  /** Short description of how to test this item. Shown in the expanded panel. */
  steps?:       string[]
  /** If true, item must PASS before release (blocks deployment). */
  critical?:    boolean
  /** Linked section id in the app (used to navigate directly). */
  appSection?:  string
}

export interface QASection {
  id:     string
  label:  string
  icon:   string
  items:  QAItem[]
}

// ── Checklist definition ──────────────────────────────────────────────────────

export const QA_SECTIONS: QASection[] = [
  {
    id:    'auth',
    label: 'Authentication',
    icon:  '🔐',
    items: [
      {
        id:       'auth.sign_up',
        label:    'Sign up',
        critical: true,
        steps: [
          'Navigate to the sign-up page',
          'Enter a new email and password',
          'Confirm the account is created and user is redirected to onboarding',
          'Verify email appears in Supabase Auth → Users',
        ],
      },
      {
        id:       'auth.login',
        label:    'Login',
        critical: true,
        steps: [
          'Navigate to the login page',
          'Enter valid credentials',
          'Confirm redirect to AI Marketing Center dashboard',
          'Verify session persists after page refresh',
        ],
      },
      {
        id:    'auth.logout',
        label: 'Logout',
        steps: [
          'While logged in, trigger logout (user menu or settings)',
          'Confirm redirect to login page',
          'Confirm navigating to /admin/ai-marketing redirects back to login',
        ],
      },
      {
        id:    'auth.password_reset',
        label: 'Password reset',
        steps: [
          'Click "Forgot password" on the login page',
          'Enter email address',
          'Confirm success message is shown',
          'Check email delivery (or Supabase Auth logs in dev)',
          'Follow reset link → set new password → confirm login works',
        ],
      },
      {
        id:       'auth.invite_acceptance',
        label:    'Invite acceptance',
        critical: true,
        appSection: 'organization',
        steps: [
          'As an admin, send an invitation from Team & Org → Team',
          'Open the invitation email (or copy the token from Supabase)',
          'Accept the invitation as the invitee',
          'Confirm invitee appears in the team member list with the correct role',
          'Confirm invitee can access the org after acceptance',
        ],
      },
    ],
  },

  {
    id:    'org',
    label: 'Organizations',
    icon:  '🏢',
    items: [
      {
        id:       'org.create_org',
        label:    'Create org',
        critical: true,
        appSection: 'organization',
        steps: [
          'Open the OrgSwitcher in the header → "Create Organization"',
          'Fill in name, slug, and timezone',
          'Submit and confirm the new org appears in the OrgSwitcher',
          'Verify row exists in Supabase ai_organizations',
          'Verify creator is added as owner in ai_organization_members',
        ],
      },
      {
        id:    'org.switch_org',
        label: 'Switch org',
        appSection: 'organization',
        steps: [
          'Create or have at least 2 orgs',
          'Click OrgSwitcher → select a different org',
          'Confirm the active org name updates in the header',
          'Confirm posts/leads load for the new org',
          'Confirm baykid_active_org_id in localStorage updates',
        ],
      },
      {
        id:       'org.invite_member',
        label:    'Invite member',
        critical: true,
        appSection: 'organization',
        steps: [
          'Team & Org → Team → enter email + role → Send Invite',
          'Confirm success message appears',
          'Navigate to Invitations tab → confirm invitation is listed as Pending',
          'Resend invitation → confirm resentAt timestamp updates',
          'Cancel invitation → confirm it disappears from the list',
        ],
      },
      {
        id:       'org.role_permissions',
        label:    'Role permissions',
        critical: true,
        appSection: 'organization',
        steps: [
          'Log in as a Viewer role user',
          'Confirm no Approve/Reject buttons in Approval Queue',
          'Confirm no Publish button in Publishing',
          'Confirm no invite form in Team & Org',
          'Log in as Content Reviewer → confirm Approve/Reject visible but no Publish',
          'Log in as Marketing Manager → confirm Publish visible but no billing',
        ],
      },
    ],
  },

  {
    id:    'ai',
    label: 'AI Features',
    icon:  '🤖',
    items: [
      {
        id:       'ai.generate_content',
        label:    'Generate content',
        critical: true,
        appSection: 'social-post',
        steps: [
          'Navigate to Social Post Generator',
          'Select content type (Social Post), platform (Instagram), tone (Friendly)',
          'Enter a descriptive topic',
          'Click Generate',
          'Confirm ⚡ LIVE badge is shown (not DEMO MODE)',
          'Confirm content appears in the output tabs (Hook, Caption, Hashtags)',
          'Confirm post is saved with status = draft',
          'Try each content type (Reel Script, Carousel, Email Reply, etc.)',
        ],
      },
      {
        id:    'ai.brand_voice',
        label: 'Brand voice',
        appSection: 'settings',
        steps: [
          'Navigate to Settings → Brand Voice',
          'Enter a distinctive brand voice description',
          'Save settings',
          'Generate new content → verify output reflects the brand voice',
          'Clear brand voice → generate again → verify neutral output',
        ],
      },
      {
        id:    'ai.comment_replies',
        label: 'Comment replies',
        appSection: 'comments',
        steps: [
          'Navigate to Comment Replies section',
          'Verify the section loads without errors',
          'Note: section is partially implemented — verify error boundary catches any crash',
        ],
      },
      {
        id:    'ai.email_replies',
        label: 'Email replies',
        appSection: 'emails',
        steps: [
          'Navigate to Email Replies section',
          'Verify the section loads without errors',
          'Note: section is partially implemented — verify error boundary catches any crash',
        ],
      },
    ],
  },

  {
    id:    'workflow',
    label: 'Workflow',
    icon:  '⚡',
    items: [
      {
        id:    'workflow.draft',
        label: 'Draft',
        steps: [
          'Generate a post → confirm it appears in Social Post Generator as Draft',
          'Verify status badge shows "Draft"',
          'Verify post is in Supabase ai_posts with status = draft',
        ],
      },
      {
        id:       'workflow.approval',
        label:    'Approval',
        critical: true,
        appSection: 'queue',
        steps: [
          'Generate a post → Send to Approval Queue',
          'Navigate to Approval Queue → confirm post is listed as Pending Approval',
          'Approve the post → confirm status changes to Approved',
          'Generate a second post → Reject it with a note',
          'Confirm rejected post shows in Social Post Generator as Rejected',
          'Verify audit log entry for both approve and reject actions',
        ],
      },
      {
        id:       'workflow.schedule',
        label:    'Schedule',
        critical: true,
        appSection: 'calendar',
        steps: [
          'Approve a post → click Schedule → select a future date/time and timezone',
          'Confirm post appears in Content Calendar (Month and Week view)',
          'Open List view → confirm post is shown',
          'Click Reschedule → change the date → confirm update is reflected in calendar',
        ],
      },
      {
        id:       'workflow.publish',
        label:    'Publish',
        critical: true,
        appSection: 'publish',
        steps: [
          'Schedule a post for the near future (or manually trigger via queue)',
          'Navigate to Publishing → Queue tab',
          'Confirm job appears and is processed',
          'Check Publishing → History tab for the result',
          'If publish failed: verify retry option is available',
          'If publish succeeded: verify post status becomes "Posted"',
        ],
      },
      {
        id:    'workflow.retry_failed_post',
        label: 'Retry failed post',
        appSection: 'publish',
        steps: [
          'Find a failed publish job in Publishing → History',
          'Click Retry',
          'Confirm job re-enters the queue with attempt counter incremented',
          'Verify retry queue entry in localStorage (baykid_retry_queue)',
          'After max retries: verify job is not stuck (either resolved or discarded)',
        ],
      },
    ],
  },

  {
    id:    'crm',
    label: 'CRM',
    icon:  '🎯',
    items: [
      {
        id:    'crm.create_lead',
        label: 'Create lead',
        critical: true,
        appSection: 'leads',
        steps: [
          'Navigate to Lead Tracker',
          'Click + Add Lead → fill in name, contact, platform, source',
          'Confirm lead appears in the "New" column',
          'Verify lead is in Supabase ai_leads',
          'Test automation-created lead: trigger a "create_lead" automation rule',
        ],
      },
      {
        id:    'crm.update_lead_stage',
        label: 'Update lead stage',
        appSection: 'leads',
        steps: [
          'Open a lead in Lead Tracker',
          'Change status from New → Contacted → Interested → Follow-Up',
          'Confirm stage updates in the Kanban column',
          'Verify activity trail in the lead shows each status change',
          'Test Converted and Lost paths',
        ],
      },
      {
        id:    'crm.follow_up_reminders',
        label: 'Follow-up reminders',
        appSection: 'leads',
        steps: [
          'Edit a lead → set a Follow-up Date to today',
          'Navigate to Dashboard → confirm follow-up count badge is shown',
          'Lead Tracker → confirm lead is highlighted as overdue',
          'Verify notification (if wired) appears for the follow-up',
        ],
      },
    ],
  },

  {
    id:    'automation',
    label: 'Automation',
    icon:  '⚙️',
    items: [
      {
        id:    'automation.trigger_rule',
        label: 'Trigger rule',
        appSection: 'automation',
        steps: [
          'Navigate to Automation Rules',
          'Enable the "Pricing Inquiry Auto-Reply" default rule',
          'Use the Test button → enter a comment containing a pricing keyword',
          'Confirm the rule shows as "Would trigger"',
          'Verify the runs counter increments after a test',
        ],
      },
      {
        id:    'automation.queue_content',
        label: 'Queue content',
        appSection: 'automation',
        steps: [
          'Trigger a rule whose action is "Send to Approval Queue"',
          'Navigate to Approval Queue → confirm draft content appears',
          'Verify the source shows the automation rule name',
          'Confirm no auto-publishing occurred (must be Draft status)',
        ],
      },
      {
        id:    'automation.generate_ai_response',
        label: 'Generate AI response',
        appSection: 'automation',
        steps: [
          'Trigger a rule whose action is "Generate Reply"',
          'Confirm a draft reply is created via the AI generation pipeline',
          'Verify reply appears in the Approval Queue (not auto-published)',
          'Verify status is "draft" (never "posted" from automation)',
        ],
      },
    ],
  },

  {
    id:    'billing',
    label: 'Billing',
    icon:  '💳',
    items: [
      {
        id:    'billing.upgrade_plan',
        label: 'Upgrade plan',
        appSection: 'organization',
        steps: [
          'Team & Org → Overview → click Upgrade Plan',
          'Confirm the plan cards display with correct prices and features',
          'Select a higher plan → confirm plan updates in the org overview',
          'Verify plan is updated in Supabase ai_organizations',
          '(If Stripe is connected) Verify Stripe checkout initiates',
        ],
      },
      {
        id:    'billing.downgrade',
        label: 'Downgrade',
        appSection: 'organization',
        steps: [
          'While on a paid plan, select a lower-tier plan',
          'Confirm downgrade succeeds (no error)',
          'Verify plan is reflected in the org overview',
          'Verify limits (members, posts, AI gens) are adjusted to the lower plan',
        ],
      },
      {
        id:    'billing.trial_expiration',
        label: 'Trial expiration',
        steps: [
          'Set subscription_status to "trialing" in Supabase for the test org',
          'Manually expire the trial (update expires_at to a past date)',
          'Confirm the UI reflects the expired trial state',
          'Confirm user is prompted to subscribe or downgrade to Free',
          '(Requires Stripe webhook integration for full end-to-end test)',
        ],
      },
    ],
  },

  {
    id:    'notifications',
    label: 'Notifications',
    icon:  '🔔',
    items: [
      {
        id:       'notifications.approval_alerts',
        label:    'Approval alerts',
        critical: true,
        steps: [
          'Submit a post for approval (Send to Approval Queue)',
          'Confirm the notification bell count increments in the header',
          'Click the bell → navigate to Dashboard',
          'Confirm the new notification is listed',
          'Approve the post → confirm an "approved" notification is created for the author',
        ],
      },
      {
        id:    'notifications.failed_jobs',
        label: 'Failed jobs',
        steps: [
          'Trigger a publish job that is expected to fail (e.g. platform not connected)',
          'Confirm a "Publish Failed" notification is created',
          'Verify the notification appears in the dashboard notification list',
          'Confirm the bell count reflects the new unread notification',
        ],
      },
      {
        id:    'notifications.follow_up_reminders',
        label: 'Follow-up reminders',
        appSection: 'leads',
        steps: [
          'Set a lead follow-up date to today',
          'Navigate to Dashboard → confirm a follow-up reminder notification exists',
          'Verify the notification links to the correct lead',
          'Mark the lead as Converted → confirm reminder is cleared',
        ],
      },
    ],
  },
]

// ── Derived helpers ───────────────────────────────────────────────────────────

/** Flat list of all items (for iteration + Record building) */
export const QA_ALL_ITEMS: QAItem[] = QA_SECTIONS.flatMap((s) => s.items)

/** All critical items */
export const QA_CRITICAL_ITEMS: QAItem[] = QA_ALL_ITEMS.filter((i) => i.critical)

/** Build an empty items map (all pending) */
export function emptyItemsMap(): Record<string, QAItemStatus> {
  return Object.fromEntries(QA_ALL_ITEMS.map((i) => [i.id, 'pending']))
}

/** Compute tally from an items map */
export function tallyItems(items: Record<string, QAItemStatus>) {
  const counts = { pass: 0, fail: 0, skip: 0, pending: 0 }
  for (const status of Object.values(items)) counts[status]++
  return {
    ...counts,
    total:          QA_ALL_ITEMS.length,
    pct:            Math.round((counts.pass / QA_ALL_ITEMS.length) * 100),
    criticalFails:  QA_CRITICAL_ITEMS.filter((i) => items[i.id] === 'fail').length,
    allCriticalPass: QA_CRITICAL_ITEMS.every((i) => items[i.id] === 'pass'),
  }
}

/** Section tally */
export function tallySections(items: Record<string, QAItemStatus>) {
  return QA_SECTIONS.map((s) => ({
    ...s,
    pass:    s.items.filter((i) => items[i.id] === 'pass').length,
    fail:    s.items.filter((i) => items[i.id] === 'fail').length,
    pending: s.items.filter((i) => items[i.id] === 'pending').length,
    skip:    s.items.filter((i) => items[i.id] === 'skip').length,
  }))
}
