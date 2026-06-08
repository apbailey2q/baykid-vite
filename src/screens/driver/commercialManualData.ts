// commercialManualData.ts — Commercial Driver Compliance Manual v1.0
//
// Scope: Commercial recycling pickup drivers only.
// Reading level: ~5th grade (short sentences, plain words, concrete examples).
// Governance: CLAUDE.md Driver Agreement Policy — Commercial document set.
//
// Consumer-only (1099) drivers must NOT see this manual. This is enforced in
// DriverManualStep by isCommercialDriver. Commercial requirements must never
// be shown to consumer-only drivers.

import {
  COMMERCIAL_DRIVER_MANUAL_VERSION,
  COMPLIANCE_EFFECTIVE_DATE,
  COMPLIANCE_LAST_UPDATED,
} from './driverComplianceVersions'

import type { ManualSection, DriverManualData } from './consumerManualData'
export type { ManualSection, DriverManualData }

export const COMMERCIAL_MANUAL: DriverManualData = {
  type:          'commercial',
  title:         'Commercial Driver Compliance Manual',
  subtitle:      'For Commercial Route Drivers',
  version:       COMMERCIAL_DRIVER_MANUAL_VERSION,
  effectiveDate: COMPLIANCE_EFFECTIVE_DATE,
  lastUpdated:   COMPLIANCE_LAST_UPDATED,

  sections: [
    // ── Section 1: Introduction ─────────────────────────────────────────────
    {
      id:    'intro',
      title: 'Introduction and Scope',
      icon:  '📋',
      content: [
        'Welcome to Cyan\'s Brooklynn Recycling. This manual covers everything you need to know to work as a Commercial Driver. Commercial Drivers pick up recycling from business locations — including restaurants, bars, hospitals, office buildings, warehouses, apartment complexes, and event venues.',
        'This manual only applies to Commercial Drivers. Consumer residential pickups (single-family homes, personal recycling bags) are handled by Consumer Drivers and are covered in a separate manual.',
        'Read this entire manual carefully. You will be asked to confirm that you have read and understood it before completing your compliance process.',
      ],
      tip: 'Commercial routes involve heavier materials, business site rules, and more complex logistics. This manual gives you everything you need to do the job safely and professionally.',
    },

    // ── Section 2: Who This Manual Applies To ───────────────────────────────
    {
      id:    'scope',
      title: 'Who This Manual Applies To',
      icon:  '👤',
      content: [
        'This manual applies to Commercial Drivers only. Commercial Drivers are approved, trained drivers who are assigned to commercial accounts — businesses and organizations that generate recyclable materials in large volumes.',
      ],
      bullets: [
        'Restaurant and food-service pickups ✅',
        'Bar and hospitality pickups ✅',
        'Hospital and medical facility pickups (non-hazardous recyclables only) ✅',
        'Office building pickups ✅',
        'Warehouse pickups ✅',
        'Apartment complex pickups (when assigned as commercial) ✅',
        'Event venue pickups ✅',
        'Emergency commercial dispatches ✅ (when authorized)',
        'Residential bag pickups from individual homes ❌ Not your job as a Commercial Driver',
      ],
      warning: 'Consumer-only (1099) drivers are not authorized for commercial routes and must never be assigned commercial pickups. Commercial compliance requirements must never be shown to consumer-only drivers.',
    },

    // ── Section 3: Commercial Accounts ─────────────────────────────────────
    {
      id:    'accounts',
      title: 'Understanding Commercial Accounts',
      icon:  '🏢',
      content: [
        'A commercial account is a business or organization that has a recycling agreement with Cyan\'s Brooklynn Recycling. Each account has specific rules about when pickups happen, what containers to pick up, and how to access the site.',
        'Before you go to a commercial pickup, review the account details in the dispatch app. Every account is different.',
      ],
      bullets: [
        'Check the account name, address, and contact information before each visit.',
        'Review any site-specific notes or access instructions in the app.',
        'Each commercial account may have different container types — bins, totes, carts, or dumpsters.',
        'Some accounts have scheduled windows. Others may have emergency or on-demand pickups.',
        'If you have never been to an account before, allow extra time to find the pickup location.',
      ],
      tip: 'Building a good relationship with site contacts at your regular accounts makes pickups faster and easier. Be professional, on time, and friendly.',
    },

    // ── Section 4: Container Handling ────────────────────────────────────────
    {
      id:    'containers',
      title: 'Bin, Tote, Cart, and Container Handling',
      icon:  '🗑',
      content: [
        'Commercial locations use large containers instead of individual bags. These containers — bins, totes, carts, and roll-off containers — hold much more material than consumer bags and require different handling.',
        'Heavy containers must be moved carefully to avoid injury and property damage.',
      ],
      bullets: [
        'Inspect the container before moving it. Check for damage, leaks, or unsafe materials.',
        'Use proper lifting technique — bend your knees, keep your back straight.',
        'Use the wheels on carts and roll-off containers — do not drag them.',
        'Do not stack or overfill containers during transport.',
        'Return containers to their correct location after pickup if required by the account.',
        'Report any damaged or broken containers to admin.',
        'Never leave a container in a location that blocks emergency exits, fire lanes, or pedestrian paths.',
      ],
      warning: 'If a container appears to contain hazardous materials — chemicals, medical waste, gas containers, sharp medical devices — do NOT move it. Photograph it and report it immediately. Wait for admin guidance before proceeding.',
    },

    // ── Section 5: Emergency Commercial Pickups ──────────────────────────────
    {
      id:    'emergency',
      title: 'Emergency Commercial Pickup Rules',
      icon:  '🚨',
      content: [
        'Some commercial clients may need emergency pickups outside of the regular schedule. Emergency pickups happen when a client has an urgent need — for example, containers that are overflowing, a special event, or a safety-related situation.',
        'Emergency pickups may be dispatched at unusual times, including evenings or weekends.',
      ],
      bullets: [
        'You will receive an emergency dispatch notification in the app.',
        'You are not required to accept every emergency dispatch.',
        'If you are available, respond to the notification within the response window shown in the app.',
        'Emergency dispatches follow the same scanning, photo, and reporting rules as regular pickups.',
        'Emergency pickup rates are listed in the company rate schedule.',
        'Never accept an emergency pickup that was arranged directly by the client without going through the app — all dispatches must be authorized through the system.',
      ],
      tip: 'Drivers who are available for and responsive to emergency dispatches often receive more route assignments and better earnings opportunities.',
    },

    // ── Section 6: Commercial Site Access ───────────────────────────────────
    {
      id:    'site_access',
      title: 'Commercial Site Access Rules',
      icon:  '🚧',
      content: [
        'Commercial locations have their own rules about who can enter, where you can park, and where you can go on the property. You must follow the site rules — not just company rules.',
        'If a site rule is stricter than a company rule, the stricter rule applies.',
      ],
      bullets: [
        'Follow all site access procedures — sign-in sheets, security badges, driver check-in areas.',
        'Park only in designated areas. Never block loading docks, fire lanes, or emergency exits.',
        'Stay in the areas of the site where you need to be. Do not walk through restricted areas.',
        'Never enter a building, kitchen, warehouse, or office without authorization.',
        'If access is blocked or denied, photograph the situation and report to admin.',
        'Never force entry or argue with security staff. Contact admin if there is an access problem.',
      ],
      warning: 'Entering restricted areas — such as hospital patient areas, restaurant kitchens, bar storage rooms, or warehouse secure zones — without authorization is a serious violation and can result in termination and removal from the client account.',
    },

    // ── Section 7: PPE and Safety ────────────────────────────────────────────
    {
      id:    'ppe_safety',
      title: 'Personal Protective Equipment (PPE) and Safety',
      icon:  '🦺',
      content: [
        'Commercial pickups involve heavier materials, busier environments, and more potential hazards than residential pickups. PPE is required on all commercial routes.',
        'Some commercial accounts require additional PPE beyond the standard gloves and closed-toe shoes. Check the account notes in the app before each visit.',
      ],
      bullets: [
        'Always wear gloves on every commercial pickup.',
        'Always wear closed-toe shoes — no sandals, no open-toe footwear.',
        'Watch for forklifts, trucks, and moving vehicles in loading dock areas.',
        'Stand clear of loading dock edges and moving equipment.',
        'Never move a container that is too heavy to handle safely — ask for help or report it.',
        'Report any injury immediately — even minor cuts, bruises, or strains.',
        'Use bright or reflective clothing when working in low-visibility areas.',
      ],
      tip: 'Commercial sites are busy. Before moving a container, look around and make sure the path is clear of people, vehicles, and obstacles.',
    },

    // ── Section 8: Unsafe Materials and Hazardous Waste ─────────────────────
    {
      id:    'hazardous',
      title: 'Unsafe Materials and Hazardous Waste Refusal',
      icon:  '☣️',
      content: [
        'Commercial locations sometimes have materials mixed into recycling containers that should never be there. It is your job to recognize and refuse unsafe or hazardous materials.',
        'You are never required to pick up hazardous materials. Your safety and the safety of the public come first.',
      ],
      bullets: [
        'Refuse any container that smells like chemicals, fumes, or strong gases.',
        'Refuse any container that is leaking liquid — even if it looks like water.',
        'Refuse any container with needles, syringes, or medical sharps visible.',
        'Refuse any container with blood, medical waste, or biohazard labels.',
        'Refuse any container with gas containers, propane, or aerosol cans in large quantities.',
        'Refuse any container that appears to have been modified or tampered with.',
        'Take a photo and report all refusals immediately in the app.',
      ],
      warning: 'Never open a container to inspect the contents if you are unsure what is inside. If in doubt, do not touch it. Photograph and report it.',
    },

    // ── Section 9: Site Contact Communication ───────────────────────────────
    {
      id:    'site_contact',
      title: 'Site Contact Communication',
      icon:  '🤝',
      content: [
        'At commercial locations, you will often interact with a site contact — a manager, supervisor, or staff member who oversees the recycling pickup. Treat them with the same professionalism you would give any important business partner.',
        'Commercial clients are long-term partners of Cyan\'s Brooklynn Recycling. How you treat their staff reflects directly on the company.',
      ],
      bullets: [
        'Introduce yourself and your purpose if a site contact approaches you.',
        'Follow instructions from site contacts about where to park, where to go, and how to handle containers.',
        'If a site contact asks you to do something that violates company policy or safety rules, politely decline and contact admin.',
        'Never discuss pricing, billing, or contract details with site contacts.',
        'Report any site contact complaint or concern in the app within 24 hours.',
        'Never share one client\'s operational details, schedule, or pickups with another client.',
      ],
      tip: 'If you do not know the answer to a site contact\'s question, say: "I\'m not sure about that — I\'ll have our team follow up with you." Then report the question to admin.',
    },

    // ── Section 10: Photo Verification for Commercial Sites ──────────────────
    {
      id:    'photo_verification',
      title: 'Photo Verification for Commercial Pickups',
      icon:  '📷',
      content: [
        'Commercial photo requirements are similar to consumer requirements, but with some additional situations where photos are needed. Photos protect you and the company if a commercial client disputes a pickup.',
        'Photos must be honest, current, and taken at the time of the pickup.',
      ],
      bullets: [
        'Take a photo when the app asks for one.',
        'Take a "before" photo if the container appears damaged before pickup.',
        'Take a photo if the pickup location is blocked or inaccessible.',
        'Take a photo if a container contains hazardous or unsafe materials before refusing the pickup.',
        'Do not photograph people, faces, or confidential documents visible at the commercial site.',
        'Do not photograph the inside of kitchens, offices, patient areas, or other sensitive business spaces.',
        'Never photograph bystanders, customers, or staff of the commercial client.',
        'Never reuse photos from a previous pickup.',
      ],
      warning: 'Fake or reused photos are fraud. Accidental photos of confidential business information or patient information at a hospital must be deleted immediately and reported to admin.',
    },

    // ── Section 11: Commercial Client Privacy ───────────────────────────────
    {
      id:    'client_privacy',
      title: 'Commercial Client Privacy',
      icon:  '🔒',
      content: [
        'Commercial clients share sensitive business information with Cyan\'s Brooklynn Recycling. They trust us to protect that information. As a Commercial Driver, you will sometimes see or hear things at client locations that are not meant for outside eyes or ears.',
        'Commercial client confidentiality applies at a higher standard than consumer privacy — businesses have additional legal protections for their operations and data.',
      ],
      bullets: [
        'Never share a client\'s pickup schedule, volume, or account details with anyone outside the company.',
        'Never share what you observed inside a commercial location — including layout, staffing, equipment, or operations.',
        'Never take unauthorized photos inside any commercial client location.',
        'Never discuss one client\'s business with another client.',
        'Never share client contact names, phone numbers, or email addresses.',
      ],
      warning: 'Leaking confidential business information — even casually — can have serious legal consequences for you and the company. When in doubt, say nothing and contact admin.',
    },

    // ── Section 12: Earnings and Manual Payout ────────────────────────────────
    {
      id:    'payout',
      title: 'Earnings and the Manual Payout System',
      icon:  '💳',
      content: [
        'Cyan\'s Brooklynn Recycling pays Commercial Drivers through a manual payout system. The admin team reviews your completed commercial pickups, calculates your earnings based on the commercial rate schedule, and pays you through an agreed method such as check, cash, Zelle, or CashApp.',
        'Your earnings are tracked in the company payout ledger. You can view your earnings history in the Commercial Wallet inside the app.',
      ],
      bullets: [
        'Earnings are based on verified, completed commercial pickups.',
        'Emergency dispatch pickups have a separate rate shown in the rate schedule.',
        'Earnings may be reduced or reversed for incomplete, disputed, or fraudulent pickups.',
        'The company does not guarantee a minimum earnings amount.',
        'Never accept direct payment from a commercial client for a pickup.',
        'If you have questions about your earnings, contact admin through the app.',
      ],
    },

    // ── Section 13: Warning, Suspension, and Termination Policy ─────────────
    {
      id:    'conduct_policy',
      title: 'Warning, Suspension, and Termination Policy',
      icon:  '🚦',
      content: [
        'Cyan\'s Brooklynn Recycling uses a three-level conduct system for Commercial Drivers. The same system applies to both commercial and consumer activity.',
      ],
      bullets: [
        'Warning: Written notice in the app. Driving privileges are not immediately changed. You must acknowledge the warning.',
        'Suspension: You can log in and view your account, but you cannot accept new pickups on any route — commercial or consumer.',
        'Termination: Your account is fully blocked from all driver services — commercial and consumer. You cannot be reactivated without explicit approval from a company founder.',
      ],
      warning: 'Certain violations result in immediate termination: fraud, fake photos, entering restricted areas without authorization, sharing client data, accepting unauthorized payments from clients, driving while impaired, or any threatening behavior.',
      tip: 'Commercial drivers who maintain a clean record and professional performance are prioritized for new accounts and higher-volume route assignments.',
    },

    // ── Section 14: Reporting and Support ─────────────────────────────────────
    {
      id:    'reporting',
      title: 'Reporting Issues and Getting Support',
      icon:  '📞',
      content: [
        'Commercial routes involve more complex situations than residential pickups. If you encounter anything outside the normal pickup process, report it and contact admin. Do not guess.',
      ],
      bullets: [
        'Report all pickup issues in the dispatch app using the correct status.',
        'Report hazardous materials immediately — do not attempt to move them.',
        'Report any commercial client complaint or incident within 24 hours.',
        'Report site access problems, security issues, or unusual situations promptly.',
        'Use the Support section of the app to message admin.',
        'Driver support email: support@cbrecycling.org',
      ],
    },
  ],
}
