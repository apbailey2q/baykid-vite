// branding.ts — Central brand identity config for user-facing text.
//
// RULE: "BayKid" is the internal code-name (folders, env vars, DB tables,
//       localStorage keys, internal comments). End users must only ever see
//       the values exported from this file.
//
// Usage:
//   import { BRAND } from './branding'
//   <h1>{BRAND.COMPANY_NAME}</h1>
//   placeholder={`Sign up at ${BRAND.WEBSITE}`}

export const BRAND = {
  /** Full legal / display name shown in all user-facing UI */
  COMPANY_NAME:         "Cyan's Brooklynn Recycling",

  /** Short version for tight spaces (headers, badges, dropdowns) */
  SHORT_NAME:           "Cyan's Brooklynn",

  /** Label for the AI Marketing product */
  MARKETING_CENTER_NAME: "Cyan's Brooklynn Marketing",

  /** Primary public website */
  WEBSITE:              'cbrecycling.org',

  /** Primary support e-mail */
  SUPPORT_EMAIL:        'support@cbrecycling.org',

  /** Generic admin / seed account e-mail */
  ADMIN_EMAIL:          'admin@cbrecycling.org',

  /** Default brand voice CTA text */
  DEFAULT_CTA:          'Sign up at cbrecycling.org',

  /** Default TikTok handle */
  TIKTOK_HANDLE:        '@CyansBrooklynn',

  /** Hashtag */
  HASHTAG:              '#CyansBrooklynn',
} as const

export type BrandKeys = keyof typeof BRAND
