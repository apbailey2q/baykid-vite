// consumerManualData.ts — Consumer Driver Compliance Manual v1.0
//
// Scope: Residential and consumer recycling pickup drivers only.
// Reading level: ~5th grade (short sentences, plain words, concrete examples).
// Governance: CLAUDE.md Driver Agreement Policy — Consumer document set.
//
// Commercial drivers must NOT see this manual — they receive the Commercial
// Driver Compliance Manual. This is enforced in DriverManualStep by isCommercialDriver.

import {
  CONSUMER_DRIVER_MANUAL_VERSION,
  COMPLIANCE_EFFECTIVE_DATE,
  COMPLIANCE_LAST_UPDATED,
} from './driverComplianceVersions'

export interface ManualSection {
  id:       string
  title:    string
  icon:     string
  content:  string[]   // paragraphs shown in order
  bullets?: string[]   // optional bullet list after content
  warning?: string     // optional red callout
  tip?:     string     // optional green callout
}

export interface DriverManualData {
  type:          'consumer' | 'commercial'
  title:         string
  subtitle:      string
  version:       string
  effectiveDate: string
  lastUpdated:   string
  sections:      ManualSection[]
}

export const CONSUMER_MANUAL: DriverManualData = {
  type:          'consumer',
  title:         'Consumer Driver Compliance Manual',
  subtitle:      'For Residential and Consumer Pickup Drivers',
  version:       CONSUMER_DRIVER_MANUAL_VERSION,
  effectiveDate: COMPLIANCE_EFFECTIVE_DATE,
  lastUpdated:   COMPLIANCE_LAST_UPDATED,

  sections: [
    // ── Section 1: Introduction ─────────────────────────────────────────────
    {
      id:    'intro',
      title: 'Introduction and Scope',
      icon:  '📋',
      content: [
        'Welcome to Cyan\'s Brooklynn Recycling. This manual covers everything you need to know to work as a Consumer Driver. As a Consumer Driver, you pick up recycling bags from homes and residential locations.',
        'This manual only applies to Consumer (residential) pickups. You are not authorized to perform commercial pickups — such as at restaurants, bars, hospitals, or warehouses — unless you have been separately approved and assigned a Commercial Driver role.',
        'Read this entire manual carefully. You will be asked to confirm that you have read and understood it before you can complete your compliance process.',
      ],
      tip: 'This manual protects you. Knowing the rules keeps you safe, helps you get paid correctly, and protects your driver status.',
    },

    // ── Section 2: Who This Manual Applies To ───────────────────────────────
    {
      id:    'scope',
      title: 'Who This Manual Applies To',
      icon:  '👤',
      content: [
        'This manual applies to Consumer Drivers — also called 1099 Consumer Drivers or Residential Drivers. If you see any of these terms in the app, they all mean you.',
        'Consumer Drivers pick up labeled recycling bags from homes, apartments, and curbside residential locations only.',
      ],
      bullets: [
        'Residential curbside pickups ✅',
        'Consumer-scheduled home pickups ✅',
        'Residential apartment complex pickups ✅ (when assigned by admin)',
        'Restaurant, bar, hospital, or warehouse pickups ❌ Not your job',
        'Emergency commercial pickups ❌ Not your job',
      ],
      warning: 'If you are dispatched to a location that looks like a business, restaurant, or warehouse and you were not specifically told this is allowed, do not pick up anything. Contact admin immediately.',
    },

    // ── Section 3: QR Bag Scanning ───────────────────────────────────────────
    {
      id:    'qr_scanning',
      title: 'QR Bag Scanning',
      icon:  '📱',
      content: [
        'Every recycling bag has a QR code on it. That code links the bag to the customer\'s order. You must scan the QR code before you pick up any bag.',
        'Scanning protects your pay. Without a scan, the system has no proof you picked up the bag. If a customer says their bag was not picked up and you have no scan, you cannot prove otherwise.',
      ],
      bullets: [
        'Scan the QR code on every bag before picking it up.',
        'Confirm the bag ID in the app matches the bag you are about to take.',
        'If the code is damaged or will not scan, photograph it and report it in the app.',
        'If the wrong bag is at the location, do not take it — report the mismatch.',
        'Never scan one bag and claim credit for multiple bags. This is fraud.',
        'Never pick up a bag that has not been verified in the app.',
      ],
      warning: 'Falsifying bag scans, scanning multiple pickups with one bag, or claiming credit for bags you did not take is fraud. It results in immediate termination.',
    },

    // ── Section 4: Pickup Time Windows ──────────────────────────────────────
    {
      id:    'time_windows',
      title: 'Pickup Time Windows',
      icon:  '⏰',
      content: [
        'Every pickup has a time window — a start time and an end time. You must arrive and attempt the pickup within that window. The time window is shown in your dispatch app.',
        'Arriving outside the time window causes problems for customers and for the company. Customers plan their day around pickup times.',
      ],
      bullets: [
        'Check the pickup time window before leaving for a stop.',
        'If you are running late, contact admin before the window closes.',
        'Do not arrive early and pick up a bag before the window opens — the customer may not have put it out yet.',
        'Do not arrive after the window closes without checking with admin first.',
        'Always mark the correct status in the app whether or not you completed the pickup.',
      ],
      tip: 'On time pickups build trust with customers and improve your driver rating. Drivers with consistent on-time records receive more route assignments.',
    },

    // ── Section 5: Unsafe Bag Procedures ────────────────────────────────────
    {
      id:    'unsafe_bags',
      title: 'Unsafe Bag Procedures',
      icon:  '⚠️',
      content: [
        'Not every bag is safe to pick up. Some bags contain items that can hurt you or damage your vehicle. You are not required to pick up a bag that appears unsafe. Your safety comes first.',
        'A bag is unsafe if it is leaking, has a bad smell, has sharp objects sticking out, is visibly damaged, or contains anything that looks, smells, or feels like a hazardous material.',
      ],
      bullets: [
        'Inspect each bag before picking it up.',
        'If a bag looks unsafe, do NOT touch it.',
        'Take a photo of the bag.',
        'Mark the pickup as "Unsafe Bag" in the app.',
        'Add a note describing what you see.',
        'Contact admin if you have any questions.',
      ],
      warning: 'Never pick up a bag that contains needles, medical waste, chemicals, gasoline, paint, batteries leaking acid, broken glass, dead animals, or anything that smells like fumes. These are hazardous materials. Contact admin immediately.',
    },

    // ── Section 6: Missing Bag Procedures ────────────────────────────────────
    {
      id:    'missing_bags',
      title: 'Missing Bag Procedures',
      icon:  '🔍',
      content: [
        'Sometimes you will arrive at a pickup location and there is no bag. This can happen for many reasons — the customer forgot to put it out, it was moved, or it was picked up by someone else.',
        'Do not leave without recording what happened. The customer is counting on the system to show an accurate record.',
      ],
      bullets: [
        'Look around the location first — sometimes bags are behind a gate, around a corner, or near the door instead of at the curb.',
        'Take a photo of the empty pickup location.',
        'Mark the pickup as "Bag Missing" in the app.',
        'Add a note with anything you observed.',
        'Move to your next stop — do not spend more than a few minutes waiting.',
      ],
      tip: 'If you regularly have "Bag Missing" at the same address, report it so admin can follow up with the customer.',
    },

    // ── Section 7: Wrong Address Procedures ──────────────────────────────────
    {
      id:    'wrong_address',
      title: 'Wrong Address Procedures',
      icon:  '📍',
      content: [
        'Sometimes the address in the app is wrong or does not exist. This can happen due to data entry errors, apartment number issues, or a new address that is not in the map yet.',
        'Do not guess or go to a nearby address. Picking up from the wrong location can cause serious problems for both customers.',
      ],
      bullets: [
        'Double check the address in the app before leaving your vehicle.',
        'If you cannot find the address, take a photo of where you are.',
        'Mark the pickup as "Wrong Address" in the app.',
        'Add a note with the address shown and what you found.',
        'Contact admin — do not attempt to find the customer on your own.',
        'Never go to a nearby house and pick up a bag that was not assigned to that address.',
      ],
    },

    // ── Section 8: Customer Privacy ──────────────────────────────────────────
    {
      id:    'customer_privacy',
      title: 'Customer Privacy and Confidentiality',
      icon:  '🔒',
      content: [
        'Customers trust Cyan\'s Brooklynn Recycling with their home address, their pickup schedule, and information about their household. That trust is your responsibility to protect.',
        'Customer information is confidential. You may only use it to complete the pickup assigned to you.',
      ],
      bullets: [
        'Never share a customer\'s address, name, phone number, or email with anyone outside the company.',
        'Never share a customer\'s pickup schedule with their neighbors, friends, or anyone else.',
        'Never take photos inside a customer\'s home or yard beyond what the app requires.',
        'Never sell, trade, or give away customer information in any form.',
        'Delete any customer information from personal devices after a route is completed.',
      ],
      warning: 'Sharing customer information without authorization is a serious violation and results in immediate termination. In some cases it may also lead to legal consequences.',
    },

    // ── Section 9: Photo Verification ────────────────────────────────────────
    {
      id:    'photo_verification',
      title: 'Photo Verification Requirements',
      icon:  '📷',
      content: [
        'The app will sometimes ask you to take a photo. This is required, not optional. Photos prove that you completed the pickup, protect your pay, and help resolve any disputes.',
        'Photos must always be honest, real, and taken at the time of the pickup. Never use old photos. Never edit, filter, or fake a photo.',
      ],
      bullets: [
        'Take a photo when the app asks for one.',
        'Take a photo whenever a bag is unsafe or missing.',
        'Make sure the bag is clearly visible in the frame.',
        'Make sure there is enough light — step closer or use a flashlight if needed.',
        'Avoid photographing children, faces, or the inside of homes.',
        'Avoid capturing license plates of bystander vehicles when possible.',
        'Never reuse a photo from a previous pickup.',
        'Never upload a blurry or unusable photo.',
      ],
      warning: 'Uploading fake photos or photos from previous pickups is fraud. It results in immediate termination.',
    },

    // ── Section 10: Earnings and Manual Payout ────────────────────────────────
    {
      id:    'payout',
      title: 'Earnings and the Manual Payout System',
      icon:  '💳',
      content: [
        'Cyan\'s Brooklynn Recycling pays drivers through a manual payout system. This means the admin team reviews your completed pickups, calculates your earnings, and pays you through an agreed payment method such as check, cash, Zelle, or CashApp.',
        'Your earnings are tracked in the company payout ledger. You can view your earnings history in your Driver Wallet inside the app.',
      ],
      bullets: [
        'Earnings are based on verified, completed pickups.',
        'Earnings may be reduced or reversed for incomplete, disputed, or fraudulent pickups.',
        'The company does not guarantee a minimum earnings amount.',
        'Payments are made manually — the app does not automatically send money.',
        'If you have questions about your earnings, contact admin through the app.',
      ],
      warning: 'Do not accept direct cash payments, tips, or side deals from customers for extra pickups. All pickups must go through the app. Accepting unauthorized payments may result in suspension or termination.',
    },

    // ── Section 11: Platform Conduct — Warnings, Suspension, Termination ─────
    {
      id:    'conduct_policy',
      title: 'Warning, Suspension, and Termination Policy',
      icon:  '🚦',
      content: [
        'Cyan\'s Brooklynn Recycling uses a three-level conduct system. Most issues are handled with a warning first. Serious issues may lead directly to suspension or termination.',
      ],
      bullets: [
        'Warning: You receive a written notice in the app. Your driving privileges are not changed. You must acknowledge the warning.',
        'Suspension: You can log in and view your account, but you cannot accept new pickups. You must resolve the issue with admin before returning to active status.',
        'Termination: Your account is blocked from all driver services. You cannot accept pickups on any platform — consumer or commercial.',
      ],
      warning: 'Some violations skip straight to termination. Examples: fraud, fake photos, harassment, sharing customer data, driving under the influence, picking up hazardous waste without authorization, and threatening behavior toward customers or staff.',
      tip: 'If you disagree with a warning or suspension, contact admin through the support section of the app. Keep your communication professional.',
    },

    // ── Section 12: Prohibited Actions ─────────────────────────────────────────
    {
      id:    'prohibited',
      title: 'Prohibited Actions — Never Do These',
      icon:  '🚫',
      content: [
        'Some actions are never allowed, no matter the situation. These rules exist to protect you, the customers, and the company.',
      ],
      bullets: [
        'Never pick up hazardous waste including needles, blood, chemicals, gasoline, paint thinner, leaking batteries, medical waste, or dead animals — unless admin has specifically authorized you for a special pickup.',
        'Never enter a customer\'s home, apartment, or private property without explicit written authorization from admin.',
        'Never accept cash, tips, or other payments directly from customers for extra services.',
        'Never argue with, threaten, or harass a customer — even if they are being difficult.',
        'Never share customer personal information with anyone.',
        'Never falsify scan records, pickup statuses, or photos.',
        'Never drive while impaired by alcohol, drugs, or any substance.',
        'Never pick up bags assigned to another driver\'s route without admin approval.',
        'Never use the app or customer data for personal use or outside the scope of your route.',
      ],
    },

    // ── Section 13: Reporting and Support ─────────────────────────────────────
    {
      id:    'reporting',
      title: 'Reporting Issues and Getting Support',
      icon:  '📞',
      content: [
        'If you encounter a problem during a route, the right thing to do is report it in the app and, if needed, contact admin. Do not guess or make decisions that are not covered in this manual.',
      ],
      bullets: [
        'Report all pickup issues in the dispatch app using the correct status code.',
        'Report safety concerns or hazardous materials immediately — do not touch them first.',
        'Report any customer complaint or incident within 24 hours.',
        'Use the Support section of the app to message admin.',
        'Driver support email: support@cbrecycling.org',
      ],
      tip: 'The app is your best tool. Use it to log everything, report problems, and communicate with the team. Drivers who communicate clearly have fewer disputes and better records.',
    },
  ],
}
