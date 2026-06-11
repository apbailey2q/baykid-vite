// AP.3C — Apartment resident invite templates.
// Pure string generators — no side effects, no imports, easy to unit-test.

const APP_ORIGIN =
  typeof window !== 'undefined'
    ? window.location.origin
    : (import.meta.env.VITE_APP_URL as string | undefined) ?? 'https://cbrecycling.org'

export function inviteLink(slug: string): string {
  return `${APP_ORIGIN}/join/${slug}`
}

export function managerEmailTemplate(propertyName: string, joinLink: string): string {
  return `Subject: New Recycling Program Now Available at ${propertyName}

Dear ${propertyName} Resident,

We are excited to announce that Cyan's Brooklynn Recycling is now available at ${propertyName}.

This program makes recycling easy and rewarding. Residents who participate help divert waste from landfills while earning rewards for each bag recycled.

How to get started:
1. Click your enrollment link: ${joinLink}
2. Verify your information
3. Create your password
4. Watch the short orientation video
5. Accept the program terms
6. Download the Cyan's Brooklynn Recycling app
7. Complete your in-app profile setup — you're ready to recycle!

Your property enrollment link:
${joinLink}

If you have any questions or need assistance, please contact us at support@cbrecycling.org.

Thank you for your participation,
${propertyName} Management`
}

export function residentEmailTemplate(propertyName: string, joinLink: string): string {
  return `Subject: Join the Recycling Program at ${propertyName}

Hi there,

Recycling pickup is now available at your community through Cyan's Brooklynn Recycling!

Get started here: ${joinLink}

It only takes a few minutes to enroll:
1. Click the link above
2. Enter your information and create a password
3. Watch the short orientation video
4. Accept the participation terms
5. Download the free Cyan's Brooklynn Recycling app
6. Finish your in-app profile setup

Once enrolled, you'll be ready to start recycling and earning rewards.

Have questions? Email us: support@cbrecycling.org

— ${propertyName} Recycling Team`
}

export function smsTemplate(propertyName: string, joinLink: string): string {
  return `Cyan's Brooklynn Recycling is now available at ${propertyName}. Join here: ${joinLink}. Create your account, watch the short video, and download the app to begin.`
}
