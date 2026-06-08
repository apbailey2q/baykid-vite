// managementAgreementData.ts — Management Agreement & Compliance Document Definitions
//
// Phase MG.2 — Cyan's Brooklynn Recycling Enterprise LLC
//
// Seven required agreements for management onboarding. Each agreement ships with
// a version string, summary, and full professional document text.
//
// When a new version is published, increment MANAGEMENT_AGREEMENT_VERSION and
// update the affected agreement's version field. Previously accepted versions
// remain valid for historical records; users must re-accept the new version.

export const MANAGEMENT_AGREEMENT_VERSION = 'management-v1-2026'

// ── Agreement code constants ──────────────────────────────────────────────────

export const CODE_OF_CONDUCT           = 'CODE_OF_CONDUCT'
export const CONFIDENTIALITY_AGREEMENT = 'CONFIDENTIALITY_AGREEMENT'
export const CONFLICT_OF_INTEREST      = 'CONFLICT_OF_INTEREST'
export const TECHNOLOGY_SECURITY       = 'TECHNOLOGY_SECURITY'
export const SAFETY_COMPLIANCE         = 'SAFETY_COMPLIANCE'
export const FINANCIAL_CONTROLS        = 'FINANCIAL_CONTROLS'
export const MANAGEMENT_AGREEMENT      = 'MANAGEMENT_AGREEMENT'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AgreementDefinition {
  code:     string
  title:    string
  version:  string
  summary:  string
  fullText: string
  required: boolean
}

// ── Agreement definitions ─────────────────────────────────────────────────────

export const MANAGEMENT_AGREEMENTS: AgreementDefinition[] = [

  // ── 1. Code of Conduct ────────────────────────────────────────────────────

  {
    code:    CODE_OF_CONDUCT,
    title:   'Code of Conduct',
    version: MANAGEMENT_AGREEMENT_VERSION,
    required: true,
    summary:
      'Establishes the ethical standards, professional behavior expectations, and anti-harassment ' +
      'policies that apply to all management personnel at Cyan\'s Brooklynn Recycling Enterprise LLC.',
    fullText: `CYAN'S BROOKLYNN RECYCLING ENTERPRISE LLC
CODE OF CONDUCT
Version: management-v1-2026 | Effective: July 3, 2026

INTRODUCTION

Cyan's Brooklynn Recycling Enterprise LLC is built on the belief that recycling and environmental responsibility can be both a community benefit and an economic opportunity. As a member of management, you are responsible for upholding and modeling the standards of conduct that make this mission possible. This Code of Conduct applies to all management personnel and governs behavior at all company locations, during company-related travel, at client and partner sites, and in any capacity where you represent Cyan's Brooklynn Recycling.

PROFESSIONAL STANDARDS

Management personnel are expected to perform their duties with competence, diligence, and integrity. You are accountable for the quality and accuracy of your work, for meeting your commitments, and for communicating early and specifically when you cannot follow through. Represent facts, data, and performance metrics accurately at all times. Do not exaggerate results to leadership, partners, or employees. When you identify a problem, bring it forward with relevant information rather than concealing it.

ETHICAL OBLIGATIONS

All management personnel must act in the best interests of the company, its employees, customers, and the communities it serves. You must not use your position to obtain personal benefits beyond your authorized compensation. You must not make decisions that create private financial advantages at the expense of the company or its workforce. Gifts from vendors, contractors, or business partners must be disclosed and must not exceed nominal value. Do not solicit gifts, meals, or entertainment that could create an appearance of partiality in vendor or contract decisions.

ANTI-HARASSMENT POLICY

Cyan's Brooklynn Recycling has zero tolerance for workplace harassment of any kind. Harassment includes, but is not limited to, unwanted verbal or physical conduct of a sexual nature, threatening or intimidating behavior, offensive communications via any medium, and conduct that creates a hostile work environment based on race, color, religion, sex, national origin, age, disability, sexual orientation, gender identity, or any other characteristic protected by law. As a manager, you are responsible not only for refraining from harassing behavior yourself, but also for preventing and addressing it in your team. Report any complaint or observation of harassment to HR or administration immediately. Failure to report a known harassment situation is itself a policy violation.

NON-DISCRIMINATION

All employment decisions within your span of control, including hiring, assignment, training, promotion, discipline, and termination, must be made without regard to any protected characteristic. Apply policies and procedures consistently across all employees. Document the business basis for employment decisions.

WORKPLACE BEHAVIOR

Maintain a professional tone in all written and verbal communications. Do not make demeaning, derogatory, or disrespectful remarks about employees, customers, partners, or competitors. Arrive prepared for meetings, follow through on action items, and keep the people depending on you informed. Manage disagreements professionally through appropriate channels rather than public conflict or passive resistance.

REPORTING CONCERNS

If you observe a potential violation of this Code of Conduct, a safety issue, suspected financial misconduct, or any other concern, you are required to report it to administration or HR. Failure to report known violations may itself constitute a policy violation. The company strictly prohibits retaliation against any person who, in good faith, reports a concern or participates in an investigation. If you experience or observe retaliation, report it immediately.

CONSEQUENCES

Violations of this Code of Conduct may result in disciplinary action up to and including immediate termination of employment, notification of appropriate regulatory agencies, and civil or criminal referral where warranted by law.

ACKNOWLEDGMENT

By accepting this document with your digital signature, you confirm that you have read, understood, and agree to comply with this Code of Conduct in all aspects of your role at Cyan's Brooklynn Recycling Enterprise LLC.`,
  },

  // ── 2. Confidentiality Agreement ─────────────────────────────────────────

  {
    code:    CONFIDENTIALITY_AGREEMENT,
    title:   'Confidentiality and Non-Disclosure Agreement',
    version: MANAGEMENT_AGREEMENT_VERSION,
    required: true,
    summary:
      'Defines what constitutes confidential information — including trade secrets, customer data, driver records, ' +
      'commercial account data, and financial records — and specifies your binding obligations to protect it during and after your employment.',
    fullText: `CYAN'S BROOKLYNN RECYCLING ENTERPRISE LLC
CONFIDENTIALITY AND NON-DISCLOSURE AGREEMENT
Version: management-v1-2026 | Effective: July 3, 2026

PURPOSE

In your management role at Cyan's Brooklynn Recycling Enterprise LLC, you will have access to sensitive information that is essential to our competitive position, the privacy of the people we serve, and the operational integrity of our platform. This agreement defines that information and specifies your legal and ethical obligations to protect it.

DEFINITION OF CONFIDENTIAL INFORMATION

"Confidential Information" means any information, in any form, that is not generally available to the public and that relates to the business, operations, technology, finances, customers, employees, or partners of Cyan's Brooklynn Recycling Enterprise LLC. This includes, without limitation:

Trade Secrets: Platform architecture, routing algorithms, pricing models, payout structures and formulas, operational workflows, software systems and source code, product roadmaps, and competitive strategy. These constitute trade secrets protected under applicable law.

Customer Information: Names, addresses, contact details, pickup history, account status, payment records, and any other personally identifiable information relating to consumer, commercial, fundraiser, or partner accounts.

Driver and Employee Information: Personal identification, earnings records, payout ledger data, compliance status, training records, background check results, licensing information, and any other personnel or contractor records.

Commercial Account Information: Contract terms, billing arrangements, service histories, usage data, account contacts, and any negotiated rate structures with commercial clients.

Financial Records: Revenue data, expense records, payout batch information, internal cost structures, investor materials, and any financial projections or performance data.

Vendor and Partner Information: Vendor contracts, negotiated pricing, partnership terms, and any proprietary information shared by vendors or partners in confidence.

Internal Systems and Security: System credentials, access control configurations, API keys, integration architectures, and any technical information that, if disclosed, could compromise platform security.

YOUR OBLIGATIONS

You agree to:
1. Access Confidential Information only as necessary for your specific job function.
2. Not disclose, copy, reproduce, or distribute Confidential Information to any unauthorized person inside or outside the company.
3. Not download or transfer data to personal devices, personal cloud storage, or any unapproved external system.
4. Not share any Confidential Information with a competitor, prospective employer, outside business, or any other third party without explicit written authorization from company leadership.
5. Report any accidental disclosure, suspected breach, or unauthorized access involving Confidential Information immediately to administration.
6. Follow all data security requirements applicable to your role, including MFA, password standards, and access limits.

TRADE SECRETS

Platform algorithms, routing logic, pricing and payout formulas, and commercial partnership structures are trade secrets. Unauthorized disclosure of trade secrets may constitute misappropriation under the Defend Trade Secrets Act (18 U.S.C. § 1836) and applicable state law, and may expose you to civil liability and criminal prosecution.

DURATION

Your confidentiality obligations survive the termination of your employment or engagement with Cyan's Brooklynn Recycling Enterprise LLC for as long as the information remains confidential or constitutes a trade secret, regardless of the reason for termination. You understand that this is a binding legal obligation, not merely a workplace policy.

RETURN OF INFORMATION

Upon separation from the company for any reason, you agree to return or destroy all company data, materials, and access credentials in your possession and to confirm in writing that you have done so.

ACKNOWLEDGMENT

By accepting this agreement with your digital signature, you confirm that you have read and understood this Confidentiality and Non-Disclosure Agreement and agree to be bound by its terms during and after your employment at Cyan's Brooklynn Recycling Enterprise LLC.`,
  },

  // ── 3. Conflict of Interest ───────────────────────────────────────────────

  {
    code:    CONFLICT_OF_INTEREST,
    title:   'Conflict of Interest Disclosure and Policy',
    version: MANAGEMENT_AGREEMENT_VERSION,
    required: true,
    summary:
      'Defines conflicts of interest and requires disclosure of any situation where your personal interests could ' +
      'influence — or appear to influence — your professional decisions. Includes outside business interests, vendor relationships, and family connections.',
    fullText: `CYAN'S BROOKLYNN RECYCLING ENTERPRISE LLC
CONFLICT OF INTEREST DISCLOSURE AND POLICY
Version: management-v1-2026 | Effective: July 3, 2026

PURPOSE

A conflict of interest exists when your personal interests — financial, personal, or relational — could influence or appear to influence decisions you make in your professional role. Cyan's Brooklynn Recycling Enterprise LLC requires management personnel to identify, disclose, and properly manage conflicts of interest to protect the integrity of company operations, maintain employee and partner trust, and comply with applicable law.

DEFINITION

A conflict of interest arises when your personal interests compete with your duty to act in the best interests of the company. This includes situations where:
• You stand to gain financially from a decision you are in a position to influence.
• A close family member or personal relationship stands to benefit from a company decision under your authority.
• Your outside employment, business ownership, or investment interests create competing loyalties.
• Your personal or professional relationship with a vendor, contractor, or partner could bias a business decision.
• You receive gifts, favors, or other benefits from parties who do business with or seek to do business with the company.

EXAMPLES OF CONFLICTS

The following situations constitute actual or potential conflicts of interest and must be disclosed:
• Hiring, promoting, or influencing the employment of a family member or close friend in a role you supervise or influence.
• Approving a vendor, contractor, or supplier contract in which you or a family member has a financial interest.
• Making operational, procurement, or financial decisions that benefit a business you personally own or co-own.
• Sharing company data, leads, or opportunities with an outside business you are associated with.
• Accepting gifts, meals, entertainment, or services from a vendor that exceed nominal value or are offered in connection with a business decision.
• Serving on the board of, or as a consultant to, a company that competes with or seeks to contract with Cyan's Brooklynn Recycling, without prior written approval.

OUTSIDE EMPLOYMENT AND BUSINESS INTERESTS

You may engage in outside employment or operate a business outside your role at Cyan's Brooklynn Recycling, provided that: (a) it does not interfere with your job duties or availability; (b) it does not involve the use of company resources, facilities, data, or relationships; (c) it does not compete with the company's business interests; and (d) you have disclosed it in writing as required below.

FAMILY RELATIONSHIPS IN THE WORKPLACE

You must disclose any situation in which a family member or person with whom you have a close personal relationship reports to you, is evaluated by you, or benefits from decisions you make. You must recuse yourself from employment decisions that affect such individuals.

FINANCIAL INTERESTS

You must disclose any direct or indirect financial interest in a company that does business with or is being considered to do business with Cyan's Brooklynn Recycling, and recuse yourself from any related decision.

SELF-REPORTING REQUIREMENTS

Disclosure must occur in writing before you take any action related to the potential conflict. You must report to your direct supervisor and to administration. The company will determine whether recusal, reassignment, or another remedy is appropriate. Self-reporting is not optional — it is a legal and ethical obligation. Failing to disclose a known conflict and proceeding with a related decision may constitute a breach of fiduciary duty and grounds for immediate termination.

ACKNOWLEDGMENT

By accepting this document with your digital signature, you confirm that you have read and understood this Conflict of Interest Policy, that you will disclose any actual or potential conflict of interest before taking related action, and that you will recuse yourself from decisions where a conflict exists.`,
  },

  // ── 4. Technology & Data Security Agreement ───────────────────────────────

  {
    code:    TECHNOLOGY_SECURITY,
    title:   'Technology and Data Security Agreement',
    version: MANAGEMENT_AGREEMENT_VERSION,
    required: true,
    summary:
      'Specifies your obligations regarding password security, multi-factor authentication, device use, data access limits, ' +
      'phishing awareness, customer privacy, and security incident response.',
    fullText: `CYAN'S BROOKLYNN RECYCLING ENTERPRISE LLC
TECHNOLOGY AND DATA SECURITY AGREEMENT
Version: management-v1-2026 | Effective: July 3, 2026

PURPOSE

Cyan's Brooklynn Recycling Enterprise LLC operates a platform that handles sensitive personal data for consumers, drivers, commercial clients, and fundraising partners. As a member of management, you have access to platform systems and data. This agreement defines your obligations to protect that access and the data it reaches.

PASSWORD REQUIREMENTS

You must use unique, strong passwords for all company accounts, systems, and tools. Passwords must be a minimum of twelve (12) characters and must include a combination of letters, numbers, and symbols. You must never reuse a password that you have used for another account, personal or professional. You must use an approved password manager to generate and store your credentials. You must never share your credentials with a colleague, vendor, or any other person, including for purposes of delegation or emergency access.

MULTI-FACTOR AUTHENTICATION

Multi-factor authentication (MFA) is mandatory for:
• Your Cyan's Brooklynn Recycling platform account
• Your company-associated business email account
• Any tool, dashboard, or application that provides access to customer data, financial records, or platform configuration
MFA must be configured before you begin accessing these systems. If a system you use does not offer MFA and handles sensitive data, report it to the technology team as a security gap.

APPROVED DEVICES AND SYSTEMS

Access company data only from approved or personally-owned devices that are secured with full-disk encryption, current operating system updates, and active antivirus/endpoint protection. Do not access company systems from shared computers, public kiosks, or devices belonging to unauthorized individuals. Do not install unapproved software or browser extensions on devices used to access company systems.

DATA ACCESS AND HANDLING

Access only the data you need for your specific job function. Do not browse, query, or export data beyond your operational requirements. Do not download customer lists, driver records, financial reports, or other bulk data exports to personal devices or unapproved cloud storage. Sharing data via personal email accounts, consumer file sharing services, or messaging apps that are not approved for company use is prohibited. When data must be transferred, use approved channels and notify administration.

PHISHING AND SOCIAL ENGINEERING

Phishing attacks frequently target management personnel with authority to approve payments or access sensitive systems. You must not click links or open attachments in unsolicited or suspicious messages. If you receive a request to approve a payment, transfer data, change account settings, or take any sensitive action via email, text, or messaging platform, verify the request using a known contact method before acting. Report phishing attempts to administration immediately.

API AND SYSTEM SECURITY

Company API keys, database credentials, and service account tokens must never appear in browser-visible code, public repositories, client-side applications, or any location accessible without authentication. Specifically: the ANTHROPIC_API_KEY and all other server-side API keys must never be prefixed with VITE_ or otherwise exposed to the browser. If you observe a potential API key exposure, report it to the technology team immediately. Do not attempt to handle or contain it yourself.

CUSTOMER PRIVACY

Customer data — including names, addresses, pickup history, earnings, and contact information — is collected for operational purposes only. You must not use customer data for personal purposes, share it with unauthorized parties, or retain it after your employment ends. Access to customer data must be logged and limited to operational necessity.

SECURITY INCIDENT RESPONSE

If you discover or suspect a security incident — including unauthorized account access, data exposure, lost or stolen devices containing company data, or a potential breach — you must report it to administration immediately. Do not attempt to investigate, contain, or remediate the incident on your own. Do not disclose a suspected breach to third parties until administration has assessed the situation and determined the appropriate response.

ACKNOWLEDGMENT

By accepting this document with your digital signature, you confirm that you have read and understood this Technology and Data Security Agreement and agree to comply with all requirements described herein.`,
  },

  // ── 5. Safety & Compliance Acknowledgment ────────────────────────────────

  {
    code:    SAFETY_COMPLIANCE,
    title:   'Safety and Compliance Acknowledgment',
    version: MANAGEMENT_AGREEMENT_VERSION,
    required: true,
    summary:
      'Acknowledges your legal obligations as a manager under OSHA, including PPE requirements, shift safety walkthroughs, ' +
      'emergency procedures, incident reporting timelines, environmental compliance, and the strict prohibition on retaliation for safety reports.',
    fullText: `CYAN'S BROOKLYNN RECYCLING ENTERPRISE LLC
SAFETY AND COMPLIANCE ACKNOWLEDGMENT
Version: management-v1-2026 | Effective: July 3, 2026

PURPOSE

As a manager or supervisor at Cyan's Brooklynn Recycling Enterprise LLC, you have specific legal duties under the Occupational Safety and Health Act of 1970 (OSHA) and related regulations. Failure to fulfill these duties can result in regulatory citations, financial penalties, personal civil liability, and, most importantly, preventable injury to employees. This acknowledgment confirms that you understand and accept these responsibilities.

LEGAL OBLIGATIONS UNDER OSHA

Under the OSHA General Duty Clause (Section 5(a)(1)), employers and supervisors must provide a workplace free from recognized hazards that are causing or are likely to cause death or serious physical harm. As a manager, you are the primary point of accountability for your team's safety environment. Your obligations include ensuring that employees have the training, equipment, and safe procedures necessary to perform their work without preventable injury.

PERSONAL PROTECTIVE EQUIPMENT

You must ensure that PPE appropriate to your team's work activities — including gloves, safety footwear, high-visibility vests, respiratory protection, and eye protection where applicable — is available and in good condition at all times. You must verify that employees are trained in proper PPE use and must enforce its use during applicable activities. You must replace worn or damaged PPE without delay.

SHIFT SAFETY WALKTHROUGHS

At the start of every shift in your assigned area, you must conduct a safety walkthrough to verify: walkways are clear of obstructions; emergency exits are unblocked and accessible; safety guards and machine barriers are in place; spill cleanup materials are accessible; PPE is available and stocked; and any previously identified hazards have been corrected. Document each walkthrough and any corrective actions taken.

EMERGENCY PROCEDURES

In any emergency — fire, chemical spill, medical crisis, or structural hazard — your immediate responsibilities are: (1) call 911 for life safety emergencies; (2) initiate evacuation if required; (3) account for all personnel at the designated assembly point; (4) prevent re-entry until the all-clear is issued by emergency responders. Do not re-enter an unsafe area to retrieve equipment or personal property. Following the emergency, document the event in the platform within four (4) hours.

INCIDENT REPORTING

All workplace incidents — including injuries, near-misses, property damage, and environmental releases — must be reported immediately upon discovery. OSHA-recordable incidents require completion of OSHA Form 300 within the required timeline. Fatalities and incidents resulting in the hospitalization of three or more employees must be reported to OSHA within eight (8) hours. You must preserve incident scenes to the extent possible until administration has determined that the scene can be cleared.

ENVIRONMENTAL COMPLIANCE

Cyan's Brooklynn Recycling operates under applicable EPA recycling regulations and state environmental requirements. You are responsible for ensuring that materials in your area are handled, stored, and processed in accordance with those requirements. Contamination prevention, proper segregation of material streams, and chain-of-custody documentation are part of your operational compliance duties.

ANTI-RETALIATION

It is illegal under OSHA Section 11(c) to retaliate against any employee for reporting a safety concern, filing an OSHA complaint, or participating in an investigation. Retaliation includes adverse employment actions, reduced hours, hostile treatment, or any other action that would discourage a reasonable person from reporting a safety concern. Any act of retaliation — including subtle forms — is grounds for immediate termination and potential civil and criminal referral.

RECORDKEEPING

You are responsible for maintaining accurate records of safety walkthroughs, incident reports, PPE inspections, and training completion for employees under your supervision. Records must be retained for the periods required by applicable regulation and must be made available upon request by administration or regulatory authorities.

ACKNOWLEDGMENT

By accepting this document with your digital signature, you confirm that you have read, understood, and agree to fulfill your safety and compliance obligations as described in this acknowledgment.`,
  },

  // ── 6. Financial Controls Acknowledgment ─────────────────────────────────

  {
    code:    FINANCIAL_CONTROLS,
    title:   'Financial Controls and Payment Systems Acknowledgment',
    version: MANAGEMENT_AGREEMENT_VERSION,
    required: true,
    summary:
      'Acknowledges that the Internal Wallet and Manual Payout Ledger is the official financial system. ' +
      'Explicitly prohibits the introduction of Stripe Connect, ACH processing, bank account collection, routing numbers, ' +
      'or any external payment processor without written founder approval.',
    fullText: `CYAN'S BROOKLYNN RECYCLING ENTERPRISE LLC
FINANCIAL CONTROLS AND PAYMENT SYSTEMS ACKNOWLEDGMENT
Version: management-v1-2026 | Effective: July 3, 2026

PURPOSE

Cyan's Brooklynn Recycling Enterprise LLC uses a specific financial architecture that has been deliberately designed to comply with applicable financial regulations, protect employee and contractor data, and maintain operational control. This acknowledgment ensures that management personnel understand and are bound by the financial systems policy.

THE OFFICIAL FINANCIAL SYSTEM

The Internal Wallet and Manual Payout Ledger is the official and sole authorized financial system for Cyan's Brooklynn Recycling Enterprise LLC. All earnings, bonuses, adjustments, and penalties for drivers, commercial drivers, fundraisers, warehouse personnel, and any other payee role must be recorded in the payout_ledger table. Payments are made manually outside the platform application by authorized management, then recorded in the system after the fact with the payment method and reference information.

The supported manual payment methods — recorded for bookkeeping only — are: check, cash, Zelle, Cash App, bank transfer, and other (with description). The platform records these payments; it does not process them.

PROHIBITED FINANCIAL SYSTEMS AND INTEGRATIONS

The following are STRICTLY PROHIBITED without explicit written approval from the founder of Cyan's Brooklynn Recycling Enterprise LLC:

• Stripe Connect or any Stripe financial product
• ACH (Automated Clearing House) processing of any kind
• Bank account number collection from employees, contractors, or any platform user
• Routing number collection from any party
• Debit card or credit card collection or processing
• PayPal, Venmo Business, Dwolla, Plaid, or any similar payment processor or financial data aggregator
• Any payout API integration, webhook-based payment trigger, or automated disbursement system
• Any financial system that creates a direct connection between the platform and a banking institution on behalf of a user

This prohibition applies to all platform features, integrations, vendor contracts, and internal tools. No management personnel may contract with, install, configure, demo, or evaluate any such system in connection with Cyan's Brooklynn Recycling without prior written approval from the founder.

EXPENSE AUTHORIZATION

All expenditures on behalf of the company must be authorized in advance at the appropriate level. Unauthorized commitments made in the company's name are the personal financial liability of the person who made them. The approval levels and thresholds are established by company leadership and communicated through operational policy documents.

FINANCIAL RECORD INTEGRITY

You must ensure that all financial records within your area of responsibility — including payout ledger entries, expense reports, vendor invoices, and earnings records — are accurate and complete. Do not alter, delete, or falsify financial records. If you identify an error in a financial record, report it to administration and request a formal correction through the adjustment process. Self-correction of ledger records without documentation and approval is prohibited.

LEDGER COMPLIANCE

Any future financial features — fundraiser earnings, referral bonuses, driver incentives, commercial account incentives, warehouse bonuses, municipal revenue sharing — must integrate with the existing payout_accounts, payout_ledger, and payout_batches tables. No parallel payment system, shadow ledger, or off-platform tracking system may be created without explicit written authorization.

REPORTING OBLIGATIONS

If you are approached by a vendor, employee, or contractor who requests the addition of any prohibited payment feature, or if you discover an unauthorized integration or financial system in use, you must report it to administration immediately.

ACKNOWLEDGMENT

By accepting this document with your digital signature, you confirm that you have read and understood the Financial Controls and Payment Systems Policy, that you understand the Internal Wallet and Manual Payout Ledger is the authorized financial system, and that you agree never to introduce prohibited payment integrations or systems without explicit written founder approval.`,
  },

  // ── 7. Management Agreement ───────────────────────────────────────────────

  {
    code:    MANAGEMENT_AGREEMENT,
    title:   'Management Agreement',
    version: MANAGEMENT_AGREEMENT_VERSION,
    required: true,
    summary:
      'The primary employment agreement for management personnel. Covers duties, authority, leadership expectations, ' +
      'reporting obligations, compliance responsibilities, company property use, and the terms of access revocation upon separation.',
    fullText: `CYAN'S BROOKLYNN RECYCLING ENTERPRISE LLC
MANAGEMENT AGREEMENT
Version: management-v1-2026 | Effective: July 3, 2026

This Management Agreement ("Agreement") is entered into between Cyan's Brooklynn Recycling Enterprise LLC ("Company") and the management personnel completing this onboarding ("Manager"). By accepting this Agreement with a digital signature, Manager acknowledges and agrees to the following terms and conditions.

1. MANAGEMENT RESPONSIBILITIES

Manager agrees to carry out all duties associated with their assigned management role, department, and level with diligence, competence, and in the best interests of the Company, its employees, and the communities it serves. Management responsibilities include, but are not limited to: supervising assigned personnel; maintaining operational standards in the assigned area; ensuring regulatory and policy compliance; reporting accurately to senior leadership; and supporting the Company's mission of accessible, fair, and environmentally responsible recycling services.

Manager acknowledges that these responsibilities evolve with the needs of the business and that additional duties may be assigned within the scope of the management role.

2. AUTHORITY AND DECISION-MAKING

Manager is authorized to make operational decisions within the scope of their role and consistent with Company policies and leadership direction. Decisions involving capital expenditures above authorized thresholds, new vendor relationships, personnel actions affecting pay or employment status, changes to financial systems or integrations, or matters with significant regulatory implications must be escalated to the appropriate leadership level before action is taken.

Manager may not commit the Company to contractual obligations, financial liabilities, or operational changes outside their defined authority without prior written approval from administration.

3. LEADERSHIP STANDARDS

Manager is expected to model the behaviors and standards described in the Code of Conduct. This includes treating all employees with dignity and fairness, making personnel decisions based on documented business rationale rather than personal preference, providing employees with clear expectations and timely feedback, and advocating for the resources and conditions necessary for their team to succeed. Poor leadership that creates hostile work environments, drives avoidable turnover, or results in compliance failures is grounds for disciplinary action.

4. REPORTING OBLIGATIONS

Manager shall provide accurate and timely reports to direct supervisors and executive leadership on operational performance, compliance status, safety incidents, personnel issues, and any material developments affecting the Company's mission or legal obligations. Manager must not knowingly withhold material information from leadership. Omission of relevant facts in reports or communications is treated as a violation equivalent to providing false information.

5. COMPLIANCE RESPONSIBILITIES

Manager is responsible for ensuring that operations within their area comply with all applicable federal, state, and local laws and regulations, including OSHA workplace safety standards, EPA recycling and environmental regulations, RCRA solid waste handling requirements, and all employment laws governing the Manager's team. Manager must stay current on applicable regulatory changes and communicate compliance requirements to their team.

6. CONFIDENTIALITY AND DATA SECURITY

Manager's obligations under the separately accepted Confidentiality and Non-Disclosure Agreement and the Technology and Data Security Agreement are incorporated into this Management Agreement by reference. These obligations remain in full force during and after employment.

7. FINANCIAL CONTROLS

Manager acknowledges that the Internal Wallet and Manual Payout Ledger is the Company's official financial system. Manager's obligations under the separately accepted Financial Controls and Payment Systems Acknowledgment are incorporated into this Management Agreement by reference. Manager agrees never to introduce or authorize prohibited payment integrations without explicit written founder approval.

8. CONFLICT OF INTEREST

Manager's obligations under the separately accepted Conflict of Interest Disclosure and Policy are incorporated into this Management Agreement by reference. Manager agrees to disclose any actual or potential conflict in writing and to recuse from related decisions.

9. COMPANY PROPERTY

All equipment, software licenses, credentials, data, and other Company property provided to Manager for the performance of their duties remain the property of Cyan's Brooklynn Recycling Enterprise LLC. Company property must be used primarily for business purposes. Upon separation, Manager agrees to return all Company property and to confirm in writing the destruction or return of all Company data in their possession.

10. TERMINATION AND ACCESS REVOCATION

Employment may be terminated at any time by either party consistent with applicable law and Company policy. Upon separation — voluntary or involuntary — all platform access, credentials, and authorization will be immediately revoked. Confidentiality, non-disclosure, and financial controls obligations survive the termination of this Agreement.

11. DIGITAL ACKNOWLEDGMENT

By entering Manager's full legal name below and accepting this Agreement, Manager confirms that they have: (a) read and understood the full contents of this Management Agreement; (b) completed all required onboarding modules and policy reviews; (c) passed the Management Certification Assessment; and (d) accepted all other required onboarding agreements. This digital signature constitutes a legally valid acknowledgment of Manager's agreement to the terms set forth herein.

This Agreement is governed by the laws of the state in which Cyan's Brooklynn Recycling Enterprise LLC is registered, without regard to conflicts of law principles.`,
  },

] // end MANAGEMENT_AGREEMENTS

// ── Lookup helpers ────────────────────────────────────────────────────────────

/**
 * Returns all agreement definitions.
 */
export function getManagementAgreements(): AgreementDefinition[] {
  return MANAGEMENT_AGREEMENTS
}

/**
 * Returns the agreement definition for the given code, or undefined if not found.
 */
export function getAgreementByCode(code: string): AgreementDefinition | undefined {
  return MANAGEMENT_AGREEMENTS.find(a => a.code === code)
}

/**
 * Returns the codes for all agreements marked required: true.
 * Used by the wizard and certification gate to verify all agreements are accepted.
 */
export const REQUIRED_AGREEMENT_CODES: string[] = MANAGEMENT_AGREEMENTS
  .filter(a => a.required)
  .map(a => a.code)

/**
 * The ordered list of agreement codes as they appear in the wizard flow.
 * Used by ManagementDashboard and ManagementAgreementCompliance to display
 * agreements in a consistent, predictable order.
 */
export const WIZARD_AGREEMENT_ORDER: string[] = [
  CODE_OF_CONDUCT,
  CONFIDENTIALITY_AGREEMENT,
  CONFLICT_OF_INTEREST,
  TECHNOLOGY_SECURITY,
  SAFETY_COMPLIANCE,
  FINANCIAL_CONTROLS,
  MANAGEMENT_AGREEMENT,
]
