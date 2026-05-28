# Team Onboarding Guide

> BayKid AI Marketing Center · Last updated: 2026-05-28
> For: New team members joining the platform

---

## Welcome

BayKid AI Marketing Center is a multi-tenant AI content generation and publishing platform for recycling and environmental organizations. This guide gets you productive in < 30 minutes.

---

## Your Role & Permissions

Your access level is set by your organization admin. Here's what each role can do:

| Role | Generate Content | Approve/Reject | Publish | Invite Team | Billing |
|------|:-:|:-:|:-:|:-:|:-:|
| **Owner** | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Super Admin** | ✓ | ✓ | ✓ | ✓ | View |
| **Admin** | ✓ | ✓ | ✓ | ✓ | View |
| **Marketing Manager** | ✓ | ✓ | ✓ | — | — |
| **Content Reviewer** | — | ✓ | — | — | — |
| **Viewer** | — | — | — | — | — |

If you can't access a feature, ask your admin to adjust your role in **Team & Org → Team**.

---

## First Login

1. You'll receive an invitation email
2. Click the link → create your password
3. You'll land in the AI Marketing Center
4. The **Onboarding Flow** wizard walks you through: brand voice, platform connections, and inviting your team

---

## Navigation

The sidebar has 14 sections:

| Section | What you do here |
|---------|-----------------|
| 📊 Dashboard | Overview stats, notifications, recent activity |
| ✍️ Social Post | Generate AI content for social media |
| 🎬 Creative Studio | Build multi-format content (carousels, reels, emails) |
| 💬 Comment Replies | Draft AI replies to social comments |
| 📧 Email Replies | Draft AI replies to emails |
| 🎯 Lead Tracker | Manage your customer pipeline |
| 📅 Content Calendar | See scheduled content in month/week view |
| ✅ Approval Queue | Review and approve/reject content |
| 🚀 Publishing | Queue and monitor social media publishing |
| ⚡ Automation Rules | Set up automated drafting triggers |
| 📈 Analytics | Performance metrics and recommendations |
| 🏢 Team & Org | Manage team members, invitations, org settings |
| ⚙️ Settings | Brand voice, API keys, notification prefs |
| ❤️ System Health | Service status, deployment checks |

---

## Core Workflow: Generate → Approve → Publish

### Step 1: Generate content

1. Click **✍️ Social Post**
2. Choose content type (Social Post, Reel Script, Carousel, etc.)
3. Select platform, tone, and goal
4. Type your topic (e.g., "Benefits of recycling electronics")
5. Click **Generate** — Claude AI creates a full post in seconds
6. Review the output tabs: Hook, Caption, Hashtags, Script, Schedule

The post is saved as **Draft** automatically.

### Step 2: Submit for approval

From the Social Post Generator:
- Click **Send to Approval Queue**
- The post status changes to **Pending Approval**

### Step 3: Review & approve (Content Reviewer / Admin)

1. Click **✅ Approval Queue**
2. Find the pending post
3. Click **Approve** or **Reject** (add a note if rejecting)
4. Approved posts can then be **Scheduled**

### Step 4: Schedule & publish

1. From Approval Queue → click **Schedule** on an approved post
2. Pick date, time, and timezone
3. The post appears in **📅 Content Calendar**
4. At the scheduled time, **🚀 Publishing** processes the job

---

## Generating Different Content Types

| Type | Best for | Platform |
|------|---------|---------|
| **Social Post** | Quick updates, news | Instagram, Facebook, Twitter |
| **Reel Script** | Short video content | Instagram, TikTok |
| **Carousel** | Step-by-step guides | Instagram, LinkedIn |
| **Comment Reply** | Engaging with comments | Any |
| **Email Reply** | Customer email responses | — |
| **Storyboard** | Video planning | YouTube, TikTok |
| **Voiceover** | Narration scripts | YouTube |
| **Analytics Review** | Performance insights | — |

---

## Lead Tracker

### Pipeline stages

```
New → Contacted → Interested → Follow-Up → Converted
                                          └→ Lost
```

### Add a lead manually

**Lead Tracker** → **+ Add Lead** → fill in name, contact, platform, notes.

### Lead sources

Leads can come from:
- **Manual entry** — you add them directly
- **Comment automation** — automation rule detects an interested comment
- **Email automation** — automation rule detects an interested email
- **AI analysis** — Creative Studio content analysis suggests leads

### Set a follow-up date

Click any lead → **Edit** → set **Follow-up Date**. The Dashboard shows overdue follow-ups.

---

## Automation Rules

Rules run automatically when triggered (e.g., a new comment comes in matching conditions).

**All automation output is DRAFT-ONLY.** No content is published without a human approving it first.

### Example rules (pre-configured)

1. **Pricing Inquiry Auto-Reply** — When a comment contains pricing keywords → Draft a reply
2. **High-Risk Comment Flag** — When a comment contains negative keywords → Send to Approval Queue

### Create a rule

**⚡ Automation Rules** → **+ New Rule** → choose type, set conditions, choose actions.

---

## Content Calendar

Switch between views:
- **Month** — bird's eye view of what's scheduled
- **Week** — detailed day-by-day view
- **List** — all upcoming posts in a table

### Actions from the calendar

| Action | What it does |
|--------|-------------|
| **Edit** | Change caption, hashtags inline |
| **Reschedule** | Pick a new date/time and timezone |
| **Duplicate** | Create a draft copy of the post |
| **Delete** | Remove the post entirely |
| **Mark as Posted** | Manually mark as published (without the publishing queue) |

---

## Settings: Brand Voice

The AI uses your brand voice to shape all generated content.

1. **⚙️ Settings** → **Brand Voice**
2. Describe your organization's personality, values, and style
3. Add keywords and phrases you always/never want used
4. Save → the next generation immediately reflects the new voice

---

## Tips & Best Practices

### Getting better AI output

- **Be specific** in the Topic field: "Benefits of e-waste recycling at BayKid drop-off locations in Nashville" → better than "recycling"
- **Use the Goal field**: "Drive drop-off registrations" helps Claude focus the call-to-action
- **Try different tones**: Professional for LinkedIn, Friendly for Facebook, Inspiring for Instagram

### Content calendar hygiene

- Review and approve/reject posts within 48 hours
- Keep the Approval Queue under 10 pending items
- Schedule posts 3–5 days ahead for better engagement timing

### Lead management

- Update lead status after every touchpoint
- Set follow-up dates immediately when a lead goes to "Contacted"
- Archive converted and lost leads monthly to keep the pipeline clean

---

## Getting Help

| Issue | Where to look |
|-------|--------------|
| Feature question | This guide + `docs/ADMIN_OPERATIONS.md` |
| Something broken | **❤️ System Health** → check service status |
| Missing permission | Ask your org admin (Team & Org → Team) |
| Platform bug | GitHub Issues |
| Urgent production issue | Escalation contacts in `docs/ADMIN_OPERATIONS.md` |
