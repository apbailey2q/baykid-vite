// ─────────────────────────────────────────────────────────────────────────────
// CO.2 — Commercial Compliance Document Definitions
// ─────────────────────────────────────────────────────────────────────────────
//
// Defines the required and optional compliance documents for commercial accounts.
// Each definition maps to a compliance_documents row with:
//   owner_type     = 'commercial'
//   document_type  = definition.id   (free-text; no DB check constraint)
//   document_title = definition.title
//
// These are stored against the commercial account's primary user_id via
// owner_user_id = commercial_accounts.user_id.
// ─────────────────────────────────────────────────────────────────────────────

export type CommercialDocumentCategory =
  | 'legal'
  | 'insurance'
  | 'service'
  | 'access'
  | 'safety'
  | 'policy'

export interface CommercialDocumentDefinition {
  /** Stored as `document_type` in compliance_documents. Stable identifier. */
  id:                     string
  title:                  string
  description:            string
  required:               boolean
  /** Whether the document has an expiration date that must be tracked */
  expires:                boolean
  /** If expires=true, the number of months before the document expires */
  defaultExpirationMonths: number | null
  ownerType:              'commercial'
  category:               CommercialDocumentCategory
}

// ── Required + optional commercial documents ─────────────────────────────────

export const COMMERCIAL_DOCUMENT_DEFINITIONS: CommercialDocumentDefinition[] = [
  {
    id:                      'business_license',
    title:                   'Business License',
    description:             'Current city or state business operating license. '
                           + 'Must be valid and match the registered business address on file.',
    required:                true,
    expires:                 true,
    defaultExpirationMonths: 12,
    ownerType:               'commercial',
    category:                'legal',
  },
  {
    id:                      'certificate_of_insurance',
    title:                   'Certificate of Insurance',
    description:             'General liability insurance certificate naming Cyan\'s Brooklynn Recycling '
                           + 'as additional insured. Minimum coverage per service agreement.',
    required:                true,
    expires:                 true,
    defaultExpirationMonths: 12,
    ownerType:               'commercial',
    category:                'insurance',
  },
  {
    id:                      'commercial_service_agreement',
    title:                   'Commercial Service Agreement',
    description:             'Signed copy of the Commercial Recycling Service Agreement '
                           + 'with Cyan\'s Brooklynn Recycling Enterprise LLC.',
    required:                true,
    expires:                 false,
    defaultExpirationMonths: null,
    ownerType:               'commercial',
    category:                'service',
  },
  {
    id:                      'waste_handling_acknowledgment',
    title:                   'Waste Handling Acknowledgment',
    description:             'Acknowledgment of approved and prohibited waste material types, '
                           + 'contamination policies, and disposal regulations.',
    required:                true,
    expires:                 false,
    defaultExpirationMonths: null,
    ownerType:               'commercial',
    category:                'policy',
  },
  {
    id:                      'authorized_contact_verification',
    title:                   'Authorized Contact Verification',
    description:             'Verified list of individuals authorized to schedule pickups, '
                           + 'modify service, and receive invoice notices on behalf of the business.',
    required:                true,
    expires:                 false,
    defaultExpirationMonths: null,
    ownerType:               'commercial',
    category:                'legal',
  },
  {
    id:                      'property_access_instructions',
    title:                   'Property Access / Gate Instructions',
    description:             'Site access instructions, gate codes, loading dock procedures, '
                           + 'and any special entry requirements for drivers.',
    required:                false,
    expires:                 false,
    defaultExpirationMonths: null,
    ownerType:               'commercial',
    category:                'access',
  },
  {
    id:                      'emergency_pickup_authorization',
    title:                   'Emergency Pickup Authorization',
    description:             'Signed authorization allowing Cyan\'s Brooklynn Recycling to dispatch '
                           + 'emergency overflow pickups with same-day service when capacity is exceeded.',
    required:                true,
    expires:                 false,
    defaultExpirationMonths: null,
    ownerType:               'commercial',
    category:                'safety',
  },
  {
    id:                      'contamination_policy_acknowledgment',
    title:                   'Contamination Policy Acknowledgment',
    description:             'Acknowledgment of contamination detection procedures, rejection rights, '
                           + 'associated fees, and remediation steps.',
    required:                true,
    expires:                 false,
    defaultExpirationMonths: null,
    ownerType:               'commercial',
    category:                'policy',
  },
]

// ── Required subset (for completeness checks) ────────────────────────────────

export const REQUIRED_COMMERCIAL_DOCUMENTS = COMMERCIAL_DOCUMENT_DEFINITIONS.filter(d => d.required)

// ── Lookup map ────────────────────────────────────────────────────────────────

export const COMMERCIAL_DOCUMENT_BY_ID = Object.fromEntries(
  COMMERCIAL_DOCUMENT_DEFINITIONS.map(d => [d.id, d]),
) as Record<string, CommercialDocumentDefinition>

// ── Category labels ───────────────────────────────────────────────────────────

export const COMMERCIAL_CATEGORY_LABELS: Record<CommercialDocumentCategory, string> = {
  legal:     'Legal',
  insurance: 'Insurance',
  service:   'Service',
  access:    'Access',
  safety:    'Safety',
  policy:    'Policy',
}

export const COMMERCIAL_CATEGORY_COLOR: Record<CommercialDocumentCategory, string> = {
  legal:     '#00c8ff',
  insurance: '#4ade80',
  service:   '#a78bfa',
  access:    '#fbbf24',
  safety:    '#f97316',
  policy:    '#e879f9',
}
