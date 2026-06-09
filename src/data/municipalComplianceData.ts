// ─────────────────────────────────────────────────────────────────────────────
// MU.4 — Municipal Compliance Document Definitions
// ─────────────────────────────────────────────────────────────────────────────
//
// Required + optional compliance documents for government/municipal partner
// accounts. Each definition maps to a compliance_documents row with:
//   owner_type     = 'municipal'
//   document_type  = definition.id   (free-text; stable identifier)
//   document_title = definition.title
//
// Stored against the municipal profile's user_id via
//   owner_user_id = municipal_profiles.user_id
//
// No Stripe, ACH, routing numbers, bank accounts, GPS, or payment processors.
// ─────────────────────────────────────────────────────────────────────────────

export type MunicipalDocumentCategory =
  | 'authorization'
  | 'identity'
  | 'agreement'
  | 'compliance'
  | 'procurement'

export interface MunicipalDocumentDefinition {
  /** Stored as `document_type` in compliance_documents. Stable identifier. */
  id:                      string
  title:                   string
  description:             string
  required:                boolean
  /** Whether the document has an expiration date that must be tracked */
  expires:                 boolean
  /** If expires=true, months before document expires */
  defaultExpirationMonths: number | null
  ownerType:               'municipal'
  category:                MunicipalDocumentCategory
}

// ── Required + optional municipal compliance documents ────────────────────────

export const MUNICIPAL_DOCUMENT_DEFINITIONS: MunicipalDocumentDefinition[] = [
  {
    id:                      'agency_authorization_letter',
    title:                   'Agency Authorization Letter',
    description:             'Official letter on agency letterhead authorizing the municipal '
                           + 'recycling program partnership, signed by an authorized '
                           + 'department official (director, manager, or equivalent).',
    required:                true,
    expires:                 false,
    defaultExpirationMonths: null,
    ownerType:               'municipal',
    category:                'authorization',
  },
  {
    id:                      'primary_contact_id',
    title:                   'Primary Contact Government ID',
    description:             'Government-issued photo identification for the designated '
                           + 'primary contact representative authorized to act on behalf '
                           + 'of the agency for program matters.',
    required:                true,
    expires:                 false,
    defaultExpirationMonths: null,
    ownerType:               'municipal',
    category:                'identity',
  },
  {
    id:                      'department_approval',
    title:                   'Department Approval Documentation',
    description:             'Written approval from the relevant department (public works, '
                           + 'sustainability, procurement, or city administration) '
                           + 'authorizing participation in the recycling program.',
    required:                true,
    expires:                 false,
    defaultExpirationMonths: null,
    ownerType:               'municipal',
    category:                'authorization',
  },
  {
    id:                      'municipal_service_agreement',
    title:                   'Municipal Service Agreement',
    description:             'Signed copy of the Municipal Recycling Program Service '
                           + 'Agreement with Cyan\'s Brooklynn Recycling Enterprise LLC. '
                           + 'Electronic acknowledgment completed during onboarding.',
    required:                true,
    expires:                 false,
    defaultExpirationMonths: null,
    ownerType:               'municipal',
    category:                'agreement',
  },
  {
    id:                      'environmental_compliance_cert',
    title:                   'Environmental Compliance Certification',
    description:             'Current environmental compliance certification or '
                           + 'acknowledgment confirming the agency meets applicable local, '
                           + 'state, and federal environmental standards for recycling '
                           + 'program participation. Renewed annually.',
    required:                true,
    expires:                 true,
    defaultExpirationMonths: 12,
    ownerType:               'municipal',
    category:                'compliance',
  },
  {
    id:                      'procurement_compliance_docs',
    title:                   'Procurement Compliance Documentation',
    description:             'Government procurement compliance documentation demonstrating '
                           + 'the agency has followed required purchasing and vendor '
                           + 'approval procedures for the recycling program partnership.',
    required:                true,
    expires:                 false,
    defaultExpirationMonths: null,
    ownerType:               'municipal',
    category:                'procurement',
  },
  {
    id:                      'public_records_acknowledgment',
    title:                   'Public Records Acknowledgment',
    description:             'Signed acknowledgment confirming the agency understands that '
                           + 'program participation data may be subject to public records '
                           + 'requests under applicable open-records laws.',
    required:                true,
    expires:                 false,
    defaultExpirationMonths: null,
    ownerType:               'municipal',
    category:                'compliance',
  },
  {
    id:                      'insurance_certificate',
    title:                   'Municipal Liability Insurance Certificate',
    description:             'Current general liability insurance certificate for the '
                           + 'agency or municipality. Optional for fully self-insured '
                           + 'government entities with documentation on file.',
    required:                false,
    expires:                 true,
    defaultExpirationMonths: 12,
    ownerType:               'municipal',
    category:                'compliance',
  },
]

// ── Required subset ───────────────────────────────────────────────────────────

export const REQUIRED_MUNICIPAL_DOCUMENTS = MUNICIPAL_DOCUMENT_DEFINITIONS.filter(d => d.required)

// ── Lookup map ────────────────────────────────────────────────────────────────

export const MUNICIPAL_DOCUMENT_BY_ID = Object.fromEntries(
  MUNICIPAL_DOCUMENT_DEFINITIONS.map(d => [d.id, d]),
) as Record<string, MunicipalDocumentDefinition>

// ── Category labels ───────────────────────────────────────────────────────────

export const MUNICIPAL_CATEGORY_LABELS: Record<MunicipalDocumentCategory, string> = {
  authorization: 'Authorization',
  identity:      'Identity',
  agreement:     'Agreement',
  compliance:    'Compliance',
  procurement:   'Procurement',
}

export const MUNICIPAL_CATEGORY_COLOR: Record<MunicipalDocumentCategory, string> = {
  authorization: '#00c8ff',
  identity:      '#4ade80',
  agreement:     '#a78bfa',
  compliance:    '#fbbf24',
  procurement:   '#f97316',
}
