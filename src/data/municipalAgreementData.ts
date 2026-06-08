// municipalAgreementData.ts — Municipal/Government Partner Agreement Definitions
//
// MU.1 — Cyan's Brooklynn Recycling Enterprise LLC
//
// Six required agreements for municipal/government partner onboarding. Each
// agreement ships with a version string, summary, and full professional document text.
//
// When a new version is published, increment MUNICIPAL_AGREEMENT_VERSION and
// update the affected agreement's version field. Previously accepted versions
// remain valid for historical records; partners must re-accept the new version.

export const MUNICIPAL_AGREEMENT_VERSION = 'municipal-v1-2026'

// ── Agreement code constants ──────────────────────────────────────────────────

export const MUNICIPAL_SERVICE_PARTICIPATION = 'MUNICIPAL_SERVICE_PARTICIPATION'
export const DATA_REPORTING_AGREEMENT        = 'DATA_REPORTING_AGREEMENT'
export const ENVIRONMENTAL_COMPLIANCE        = 'ENVIRONMENTAL_COMPLIANCE'
export const SAFETY_ACKNOWLEDGMENT           = 'SAFETY_ACKNOWLEDGMENT'
export const PROCUREMENT_COMPLIANCE          = 'PROCUREMENT_COMPLIANCE'
export const PUBLIC_RECORDS_ACKNOWLEDGMENT   = 'PUBLIC_RECORDS_ACKNOWLEDGMENT'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MunicipalAgreementDefinition {
  code:     string
  title:    string
  version:  string
  summary:  string
  fullText: string
  required: boolean
}

// ── Agreement definitions ─────────────────────────────────────────────────────

export const MUNICIPAL_AGREEMENTS: MunicipalAgreementDefinition[] = [

  // ── 1. Municipal Service Participation Agreement ──────────────────────────

  {
    code:     MUNICIPAL_SERVICE_PARTICIPATION,
    title:    'Municipal Service Participation Agreement',
    version:  MUNICIPAL_AGREEMENT_VERSION,
    required: true,
    summary:
      'Governs the terms under which your government agency participates in the Cyan\'s Brooklynn ' +
      'Recycling service program, including service scope, agency obligations, and program enrollment.',
    fullText: `CYAN'S BROOKLYNN RECYCLING ENTERPRISE LLC
MUNICIPAL SERVICE PARTICIPATION AGREEMENT
Version: municipal-v1-2026 | Effective: July 18, 2026

INTRODUCTION

This Municipal Service Participation Agreement ("Agreement") is entered into by and between Cyan's Brooklynn Recycling Enterprise LLC ("Company") and the government agency or department identified in the onboarding registration ("Agency"). The purpose of this Agreement is to establish the terms and conditions under which the Agency participates in the Company's recycling and materials recovery services.

PROGRAM SCOPE

The Company's municipal service program provides waste diversion, recyclables collection, materials processing, and sustainability reporting services to participating government agencies. The specific services available to the Agency will be determined based on the Agency's service area, operational capacity, and applicable local agreements.

AGENCY OBLIGATIONS

The Agency agrees to:

1. Designate an authorized representative who holds the legal authority to enter into service agreements on behalf of the Agency and who can receive communications from the Company.

2. Provide accurate information during onboarding, including agency contact information, jurisdiction description, service area details, and program goals. The Agency agrees to update this information promptly when changes occur.

3. Comply with all applicable federal, state, and local laws governing waste management, public procurement, environmental protection, and public agency operations.

4. Communicate transparently with the Company regarding service performance, issues, complaints, and any changes to the Agency's operational needs.

5. Participate in any required training, onboarding, or orientation programs established by the Company for municipal partners.

6. Ensure that agency personnel who interact with Company representatives conduct themselves professionally and in accordance with applicable public employee conduct standards.

COMPANY OBLIGATIONS

The Company agrees to:

1. Provide municipal partners with a dedicated account portal through which the Agency can monitor program status, compliance documents, service updates, and notifications.

2. Maintain records of the Agency's participation, compliance documents, and program agreements in accordance with applicable data retention requirements.

3. Notify the Agency of material changes to service terms, pricing structures, or program requirements within a reasonable time prior to the effective date of such changes.

4. Treat all Agency information with appropriate confidentiality, subject to applicable public records laws.

FINANCIAL TERMS

This Agreement does not establish specific pricing or payment obligations. Financial terms for specific services will be documented in separate service orders or addenda to this Agreement. The Company does not collect payment through this platform. Service fees, where applicable, are invoiced separately and recorded in the Company's manual payout ledger for reference purposes only. No payment processing is performed through this system.

TERM AND TERMINATION

This Agreement remains in effect for so long as the Agency maintains an active account in the Company's municipal partner program. Either party may terminate participation upon thirty (30) days written notice. The Company reserves the right to suspend or terminate Agency participation for cause, including material breach of this Agreement, non-compliance with applicable laws, or conduct that poses a risk to the Company's operations or other partners.

LIMITATION OF LIABILITY

To the maximum extent permitted by applicable law, the Company's total liability for any claim arising under this Agreement shall not exceed the total fees paid by the Agency to the Company in the twelve (12) months preceding the claim. In no event shall either party be liable for indirect, incidental, consequential, or punitive damages.

GOVERNING LAW

This Agreement is governed by the laws of the state in which the Agency's principal place of business is located, without regard to conflict-of-law provisions. Disputes shall be resolved in good faith between the parties before any formal proceedings are initiated.

ACKNOWLEDGMENT

By accepting this Agreement, the authorized representative of the Agency acknowledges that they have read and understood these terms, that they are authorized to bind the Agency, and that the Agency agrees to comply with the obligations set forth above.`,
  },

  // ── 2. Data Reporting Agreement ───────────────────────────────────────────

  {
    code:     DATA_REPORTING_AGREEMENT,
    title:    'Data Reporting Agreement',
    version:  MUNICIPAL_AGREEMENT_VERSION,
    required: true,
    summary:
      'Establishes data reporting obligations and data sharing expectations for municipal ' +
      'partners, including program metrics, collection volumes, and compliance reporting.',
    fullText: `CYAN'S BROOKLYNN RECYCLING ENTERPRISE LLC
DATA REPORTING AGREEMENT — MUNICIPAL PARTNERS
Version: municipal-v1-2026 | Effective: July 18, 2026

PURPOSE

This Data Reporting Agreement ("Agreement") governs the collection, sharing, and use of program-related data between government Agency partners ("Agency") and Cyan's Brooklynn Recycling Enterprise LLC ("Company"). Accurate data reporting is essential to measuring program effectiveness, maintaining compliance, and improving service quality.

DATA THE AGENCY AGREES TO PROVIDE

1. Program Participation Data: The Agency agrees to provide information relevant to the scope of its participation, including the number of facilities, properties, or zones enrolled in the program, estimated population served, and service area boundaries.

2. Contact and Administrative Data: The Agency agrees to maintain accurate contact information for its designated program representative and to update such information within five (5) business days of any change.

3. Compliance Documentation: The Agency agrees to provide and maintain current compliance documents, certifications, and authorizations as required by the Company's municipal partner program.

4. Feedback and Incident Reporting: The Agency agrees to report material service failures, safety incidents, or contamination events to the Company within a reasonable timeframe after becoming aware of such events.

DATA THE COMPANY COLLECTS AND REPORTS

1. Program Metrics: The Company will provide the Agency with reports on materials collected, estimated diversion rates, and program performance where available.

2. Compliance Status: The Company will maintain records of the Agency's compliance document status and notify the Agency of documents that are missing, pending review, or approaching expiration.

3. Notification History: The Company will maintain records of notifications sent to the Agency regarding service changes, compliance requirements, and program updates.

DATA USE RESTRICTIONS

The Company agrees:

1. Not to sell or disclose Agency data to third parties for commercial purposes without the Agency's written consent.

2. To handle Agency data in accordance with applicable state and federal privacy laws.

3. To retain Agency records for the period required by applicable law or the Company's data retention policy, whichever is longer.

4. To respond to lawful government data requests in accordance with applicable law.

PUBLIC RECORDS

The Agency acknowledges that it may be subject to public records laws that require disclosure of contracts, agreements, and correspondence with service providers. Nothing in this Agreement shall be construed to restrict the Agency from fulfilling its public records obligations.

DATA ACCURACY

The Agency represents that all data provided to the Company is accurate to the best of the Agency's knowledge at the time of submission. The Agency agrees to correct inaccurate data promptly after discovering any errors.

ACCEPTANCE

By accepting this Agreement, the Agency's authorized representative confirms they have the authority to bind the Agency to these data reporting obligations.`,
  },

  // ── 3. Environmental Compliance Agreement ────────────────────────────────

  {
    code:     ENVIRONMENTAL_COMPLIANCE,
    title:    'Environmental Compliance Agreement',
    version:  MUNICIPAL_AGREEMENT_VERSION,
    required: true,
    summary:
      'Documents the Agency\'s commitment to environmental compliance standards, ' +
      'waste handling regulations, and sustainability program requirements.',
    fullText: `CYAN'S BROOKLYNN RECYCLING ENTERPRISE LLC
ENVIRONMENTAL COMPLIANCE AGREEMENT — MUNICIPAL PARTNERS
Version: municipal-v1-2026 | Effective: July 18, 2026

COMMITMENT TO ENVIRONMENTAL STANDARDS

This Environmental Compliance Agreement ("Agreement") documents the mutual commitment of the government Agency partner ("Agency") and Cyan's Brooklynn Recycling Enterprise LLC ("Company") to uphold environmental compliance standards throughout their program partnership.

APPLICABLE REGULATIONS

The Agency acknowledges that the recycling and waste diversion services covered under this program are subject to federal, state, and local environmental regulations, including but not limited to:

- EPA regulations governing solid waste management and recyclable materials
- State solid waste management laws and associated agency regulations
- Local ordinances governing collection, transport, and processing of recyclable materials
- Any applicable environmental justice requirements applicable to the Agency's jurisdiction

AGENCY ENVIRONMENTAL OBLIGATIONS

1. The Agency agrees to ensure that materials designated for recycling collection through this program are not commingled with hazardous waste, regulated medical waste, or other materials prohibited under applicable environmental laws.

2. The Agency agrees to cooperate with the Company in identifying and resolving contamination events that could affect the quality of collected materials.

3. The Agency agrees to maintain any environmental certifications, permits, or authorizations required for its participation in the program and to provide documentation of such certifications upon request.

4. The Agency agrees to promptly notify the Company of any environmental enforcement actions, consent orders, or regulatory findings that materially affect the Agency's ability to participate in the program.

5. The Agency agrees not to direct collection activities toward properties or facilities that are subject to environmental remediation orders without first disclosing such conditions to the Company.

ENVIRONMENTAL GOALS

The Company and Agency share the following environmental goals:

- Increasing diversion of recyclable materials from landfill disposal
- Reducing contamination rates in collected materials streams
- Supporting local sustainability and environmental justice initiatives where consistent with applicable law
- Providing transparent reporting on program environmental performance

SUSTAINABILITY REPORTING

The Company will provide available program performance data that the Agency may use for sustainability reporting, grant applications, or regulatory compliance purposes. The Agency acknowledges that such data is provided for reference purposes and should be independently verified before use in official regulatory filings.

CONTINUOUS IMPROVEMENT

Both parties agree to communicate openly about environmental performance challenges and to work collaboratively toward continuous improvement in program sustainability metrics.

ACCEPTANCE

By accepting this Agreement, the Agency's authorized representative confirms the Agency's commitment to environmental compliance and acknowledges the obligations described above.`,
  },

  // ── 4. Safety Acknowledgment ──────────────────────────────────────────────

  {
    code:     SAFETY_ACKNOWLEDGMENT,
    title:    'Safety Acknowledgment',
    version:  MUNICIPAL_AGREEMENT_VERSION,
    required: true,
    summary:
      'Acknowledges the Agency\'s responsibility for safety protocols at collection ' +
      'points, access requirements for service personnel, and incident reporting obligations.',
    fullText: `CYAN'S BROOKLYNN RECYCLING ENTERPRISE LLC
SAFETY ACKNOWLEDGMENT — MUNICIPAL PARTNERS
Version: municipal-v1-2026 | Effective: July 18, 2026

PURPOSE

This Safety Acknowledgment documents the Agency's understanding of safety requirements and obligations related to participation in the Cyan's Brooklynn Recycling municipal service program.

COLLECTION POINT SAFETY

The Agency agrees to:

1. Ensure that designated collection points, bin locations, and staging areas within Agency-controlled properties are maintained in a safe and accessible condition, free of hazards that could injure collection personnel or members of the public.

2. Ensure adequate access for collection vehicles at designated service locations, including sufficient clearance, turning radius, and load-bearing surface where applicable.

3. Notify the Company promptly of any temporary access restrictions, construction activities, or other conditions that may affect safe collection operations at Agency facilities or public spaces.

4. Ensure that bins and containers provided for the program are used only for approved recyclable materials and are not used for storage of hazardous materials, flammable substances, or prohibited waste.

INCIDENT REPORTING

The Agency agrees to report to the Company within one (1) business day any of the following events occurring in connection with the program:

- Injuries to Agency employees, contractors, or members of the public in connection with program activities
- Vehicle accidents involving Company collection vehicles on Agency-controlled property
- Spills or releases of materials from collection containers in public areas
- Any security incidents involving Company personnel at Agency facilities

EMERGENCY CONTACTS

The Agency agrees to provide and maintain current emergency contact information for Agency personnel who can be reached in the event of a safety emergency at an Agency facility or collection point.

TRAINING AND COMMUNICATION

The Agency agrees to communicate applicable safety requirements to Agency employees, contractors, and facility managers who interact with Company service personnel.

PROHIBITED MATERIALS

The Agency acknowledges that the following materials are prohibited from collection under this program and agrees to take reasonable steps to prevent their placement in program containers:

- Hazardous waste, including paints, solvents, batteries (except as specifically authorized), and chemical products
- Medical or pharmaceutical waste
- Electronic waste not included in designated e-waste collection programs
- Construction and demolition debris
- Materials contaminated with food waste beyond accepted limits

GOOD FAITH COOPERATION

Both parties agree to cooperate in good faith to resolve safety concerns promptly and to share safety-relevant information as appropriate.

ACCEPTANCE

By accepting this Acknowledgment, the Agency's authorized representative confirms awareness of these safety obligations and commits the Agency to uphold them.`,
  },

  // ── 5. Procurement Compliance Acknowledgment ──────────────────────────────

  {
    code:     PROCUREMENT_COMPLIANCE,
    title:    'Procurement Compliance Acknowledgment',
    version:  MUNICIPAL_AGREEMENT_VERSION,
    required: true,
    summary:
      'Acknowledges the Agency\'s procurement authorization, compliance with applicable ' +
      'public procurement laws, and confirmation that proper approvals have been obtained.',
    fullText: `CYAN'S BROOKLYNN RECYCLING ENTERPRISE LLC
PROCUREMENT COMPLIANCE ACKNOWLEDGMENT — MUNICIPAL PARTNERS
Version: municipal-v1-2026 | Effective: July 18, 2026

PURPOSE

This Procurement Compliance Acknowledgment documents the government Agency partner's confirmation that its participation in the Cyan's Brooklynn Recycling municipal service program is consistent with applicable public procurement laws, regulations, and internal Agency procurement policies.

AUTHORIZATION CONFIRMATION

By accepting this Acknowledgment, the Agency's authorized representative confirms:

1. Proper Authorization: The representative has obtained all required internal approvals to enter into this program participation, including any required approvals from procurement officers, department heads, governing boards, city councils, county commissions, or other bodies with oversight authority over Agency contracts and service agreements.

2. Procurement Law Compliance: The Agency's participation in this program complies with applicable state and local public procurement laws, including any competitive bidding, sole source authorization, or cooperative purchasing requirements that apply to the Agency's procurement activity.

3. No Conflict of Interest: To the best of the representative's knowledge, no Agency official involved in the decision to participate in this program has a financial interest in Cyan's Brooklynn Recycling Enterprise LLC or its affiliated entities that would constitute a prohibited conflict of interest under applicable law.

4. Budget Authority: The Agency has or expects to have available funding authority for any fees associated with participation in this program, if applicable.

COOPERATIVE PURCHASING

Where the Agency is participating in this program through a cooperative purchasing arrangement, intergovernmental agreement, or other established procurement vehicle, the Agency confirms that:

1. The applicable cooperative purchasing agreement or intergovernmental contract is valid and current.
2. The Agency has complied with all applicable procedures for accessing the cooperative contract.
3. The Company is an authorized provider under the applicable cooperative agreement if one is being relied upon.

DOCUMENTATION AVAILABILITY

The Agency agrees to maintain documentation of the procurement approvals and authorizations underlying this program participation and to provide copies of such documentation to the Company upon request and as required by the Company's compliance review process.

CHANGE IN AUTHORITY

The Agency agrees to notify the Company promptly if there is a change in the personnel holding the designated authorized representative role, or if any prior authorization for the Agency's program participation is rescinded or challenged.

ACCEPTANCE

By accepting this Acknowledgment, the Agency's authorized representative confirms that the Agency's participation complies with applicable procurement requirements and that proper authorization has been obtained.`,
  },

  // ── 6. Public Records Acknowledgment ──────────────────────────────────────

  {
    code:     PUBLIC_RECORDS_ACKNOWLEDGMENT,
    title:    'Public Records Acknowledgment',
    version:  MUNICIPAL_AGREEMENT_VERSION,
    required: true,
    summary:
      'Acknowledges that communications and agreements with the Company may be subject ' +
      'to public records disclosure laws and establishes mutual understanding of applicable obligations.',
    fullText: `CYAN'S BROOKLYNN RECYCLING ENTERPRISE LLC
PUBLIC RECORDS ACKNOWLEDGMENT — MUNICIPAL PARTNERS
Version: municipal-v1-2026 | Effective: July 18, 2026

PURPOSE

This Public Records Acknowledgment establishes the mutual understanding of the government Agency partner ("Agency") and Cyan's Brooklynn Recycling Enterprise LLC ("Company") regarding the applicability of public records and open government laws to their program relationship.

AGENCY PUBLIC RECORDS OBLIGATIONS

The Agency acknowledges that:

1. As a government entity, the Agency is subject to applicable state and local public records laws, open meetings laws, and government transparency requirements.

2. Contracts, agreements, correspondence, and other documents exchanged between the Agency and the Company may be subject to disclosure in response to public records requests submitted to the Agency.

3. Nothing in any agreement with the Company restricts the Agency from fulfilling its legal obligations to disclose records in response to valid public records requests.

4. The Agency is responsible for making its own determinations regarding which records are subject to disclosure and for applying any applicable exemptions in accordance with state law.

COMPANY RECORDS AND TRADE SECRETS

The Company may from time to time provide the Agency with materials that contain proprietary operational information, pricing structures, or methodology that the Company considers confidential business information or trade secrets. Where the Company provides such materials and asserts a claim of trade secret protection, the Agency agrees to:

1. Notify the Company promptly upon receipt of a public records request that encompasses materials the Company has identified as potentially proprietary.
2. Allow the Company a reasonable opportunity — consistent with applicable law and the Agency's response deadline — to assert exemption claims or seek judicial protection.
3. Make its own independent legal determination regarding applicable exemptions, recognizing that the Agency bears ultimate responsibility for its public records compliance.

PLATFORM DATA

The Agency acknowledges that data entered into the Company's platform (including agency profile information, contact information, and program participation records) will be maintained by the Company in accordance with the Data Reporting Agreement and applicable data retention laws.

TRANSPARENCY SUPPORT

The Company is committed to supporting the Agency's transparency and public accountability obligations. The Company will provide the Agency with clear and accurate records of agreements, compliance documents, and program participation history to facilitate the Agency's record-keeping and disclosure obligations.

RECORD RETENTION

Both parties agree to retain records related to this program relationship for the periods required by applicable law. Where record retention requirements differ, both parties agree to the longer applicable retention period for shared records.

ACCEPTANCE

By accepting this Acknowledgment, the Agency's authorized representative confirms their understanding of the public records considerations applicable to this program relationship.`,
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getMunicipalAgreement(code: string): MunicipalAgreementDefinition | undefined {
  return MUNICIPAL_AGREEMENTS.find(a => a.code === code)
}

export function getMunicipalRequiredAgreements(): MunicipalAgreementDefinition[] {
  return MUNICIPAL_AGREEMENTS.filter(a => a.required)
}

export function isMunicipalAgreementsComplete(accepted: Record<string, string>): boolean {
  return getMunicipalRequiredAgreements().every(a => !!accepted[a.code])
}
