// managementTrainingData.ts — Management Onboarding Training Modules
//
// Exports 10 training modules for Cyan's Brooklynn Recycling management personnel.
// All roles (executive, director, manager, supervisor) complete the full set.
//
// Financial Controls module explicitly documents the Internal Wallet + Manual Payout
// Ledger as the official financial system. Use of Stripe Connect, ACH, routing
// numbers, bank account collection, or external payment processors is PROHIBITED
// without explicit founder approval.
//
// Training version: management-v1-2026
// Reading level: professional, plain language, concrete examples.
// Each module: description, estimatedMinutes, requiredFor, contentSections, quizQuestions, passingScore.

export const MANAGEMENT_TRAINING_VERSION = 'management-v1-2026'

export interface ManagementQuizQuestion {
  question: string
  options:  string[]
  correct:  number  // 0-based index
}

export interface ManagementContentSection {
  heading:  string
  body:     string
}

export interface ManagementTrainingModule {
  id:               string
  title:            string
  description:      string
  estimatedMinutes: number
  requiredFor:      ('executive' | 'director' | 'manager' | 'supervisor')[]
  contentSections:  ManagementContentSection[]
  quizQuestions:    ManagementQuizQuestion[]
  passingScore:     number  // minimum correct to pass (out of quizQuestions.length)
}

export const MANAGEMENT_TRAINING_MODULES: ManagementTrainingModule[] = [

  // ── Module 1: Company Overview ──────────────────────────────────────────────
  {
    id: 'mgmt_company_overview',
    title: 'Company Overview',
    description: 'Learn who we are, what we do, why it matters, and how every team member contributes to our mission.',
    estimatedMinutes: 12,
    requiredFor: ['executive', 'director', 'manager', 'supervisor'],
    contentSections: [
      {
        heading: 'Who We Are',
        body: `Cyan's Brooklynn Recycling Enterprise LLC is a community-first recycling company built to make recycling easy, fair, and rewarding for everyone. We operate a tech-enabled platform that connects consumers, businesses, drivers, warehouse staff, and community fundraisers around a shared goal: diverting recyclable materials from landfills and creating real economic value for the people who make it happen.

Our public brand is Cyan's Brooklynn Recycling. Our founder named the company after a personal commitment to building something meaningful for the community.`,
      },
      {
        heading: 'What We Do',
        body: `We run three interconnected service lines:

Consumer Pickup — Residential customers schedule recycling pickups from their home or apartment. A 1099 independent-contractor driver collects, scans, and delivers material to one of our warehouse partners.

Commercial Pickup — Businesses (restaurants, offices, apartments, hospitals, schools) contract for regular recycling service. Commercial drivers and warehouse teams handle higher-volume, route-based operations.

Community Fundraising — Schools, nonprofits, and community organizations run fundraiser campaigns tied to recycling. When supporters recycle, campaign earnings are credited to the organization's account.

All three lines are supported by a network of warehouse facilities that receive, inspect, sort, weigh, and process materials before they move to end-market buyers.`,
      },
      {
        heading: 'Our Values',
        body: `Community First — Every decision should benefit the neighborhoods we serve.
Fairness — Drivers, workers, and partners earn real compensation for real work.
Transparency — Pricing, payouts, and policies are clear and documented.
Environmental Responsibility — We track contamination, minimize waste, and report impact.
Continuous Improvement — We fix problems quickly and document what we learn.`,
      },
      {
        heading: 'How the Platform Works',
        body: `The platform is a React + Supabase SPA (single-page application). Each user type has a dedicated dashboard — consumer, driver, commercial customer, warehouse employee, fundraiser, and admin. Management personnel have a management dashboard that provides cross-department visibility.

Admins configure operational windows, dispatch rules, fee structures, and approval workflows through the Operations Settings panel. Every significant action is timestamped and stored in the database for audit purposes.`,
      },
      {
        heading: 'Your Role as a Manager',
        body: `Management personnel are responsible for bridging the gap between daily operations and strategic goals. You are expected to know how each department works, identify problems before they escalate, and communicate clearly across teams.

This training program is your foundation. Completing it earns your Management Certification, which is required before you can access full management dashboard features.`,
      },
    ],
    quizQuestions: [
      {
        question: 'What are the three main service lines operated by Cyan\'s Brooklynn Recycling?',
        options: [
          'Consumer Pickup, Commercial Pickup, and Community Fundraising',
          'Driver Training, Warehouse Sorting, and Admin Oversight',
          'Residential Service, B2B Sales, and Municipal Contracts',
          'Online Store, Pickup Scheduling, and Material Resale',
        ],
        correct: 0,
      },
      {
        question: 'What is the public brand name customers and partners see?',
        options: [
          'BayKid Platform',
          'Cyan\'s Brooklynn Recycling',
          'CBR Enterprise',
          'Green Community LLC',
        ],
        correct: 1,
      },
      {
        question: 'What is required before a management employee can access full management dashboard features?',
        options: [
          'A background check approval',
          'Completion of at least 3 training modules',
          'Management Certification earned by completing this training program',
          'A written recommendation from a supervisor',
        ],
        correct: 2,
      },
      {
        question: 'Which of the following best describes Cyan\'s Brooklynn\'s core values?',
        options: [
          'Profit First, Speed First, Growth First',
          'Community First, Fairness, Transparency, Environmental Responsibility, Continuous Improvement',
          'Customer Satisfaction, Brand Awareness, Market Expansion',
          'Compliance Only, Cost Reduction, Standardization',
        ],
        correct: 1,
      },
    ],
    passingScore: 3,
  },

  // ── Module 2: Leadership Expectations ──────────────────────────────────────
  {
    id: 'mgmt_leadership',
    title: 'Leadership Expectations',
    description: 'Understand what it means to lead at Cyan\'s Brooklynn — communication standards, accountability, and team development.',
    estimatedMinutes: 15,
    requiredFor: ['executive', 'director', 'manager', 'supervisor'],
    contentSections: [
      {
        heading: 'Leading by Example',
        body: `At Cyan's Brooklynn, leadership is action. Managers and supervisors are expected to model the behavior they want from their teams. If you expect drivers to submit complete pickup records, verify that your team's records are complete. If you expect warehouse employees to follow PPE rules, wear PPE when you walk the floor.

This is not about perfection. It is about consistency and honesty. Acknowledge mistakes openly, correct them quickly, and document what changed.`,
      },
      {
        heading: 'Communication Standards',
        body: `Internal communication should be:
Clear — Say what you mean. Avoid vague language like "as soon as possible" — give a specific date or time.
Documented — Significant decisions, policy changes, and incidents must be written down and saved.
Respectful — Treat every team member with dignity regardless of role or seniority.
Timely — Respond to urgent operational messages within 2 hours during business hours.

When communicating with drivers, warehouse employees, or commercial customers, use the platform's built-in messaging tools where available. This keeps records attached to the relevant job or account.`,
      },
      {
        heading: 'Accountability and Escalation',
        body: `Managers are accountable for their team's outputs — not just their own individual work.

If a route has repeated pickup failures, the operations manager is accountable for identifying the root cause and fixing it. If a warehouse station has contamination spikes, the warehouse manager is accountable for training and process review.

Escalation is not failure. When a situation requires resources or authority you do not have, escalate immediately. Do not wait for a problem to resolve itself. Document the escalation: what you observed, when you escalated, and who you escalated to.`,
      },
      {
        heading: 'Team Development',
        body: `Your team's growth is part of your job. This includes:
Onboarding — Ensure new team members complete required training before taking on independent tasks.
Feedback — Provide specific, constructive feedback regularly — not only during formal reviews.
Recognition — Acknowledge good work in real time. Public recognition is powerful.
Performance Issues — Address performance problems early, document all coaching conversations, and follow the company's progressive discipline process.`,
      },
      {
        heading: 'Management Authority Limits',
        body: `Managers have broad authority within their departments. Some actions require escalation or admin approval:
Changes to pay rates or payout structures — always requires admin approval.
Termination of employment or contract — requires HR review and admin approval.
Changes to platform fee structures or service pricing — requires admin and founder approval.
Signing any contract with a vendor, partner, or government body — requires director or executive approval.

When in doubt, ask before acting.`,
      },
    ],
    quizQuestions: [
      {
        question: 'What does "leading by example" mean at Cyan\'s Brooklynn?',
        options: [
          'Holding team members to standards that leadership does not follow themselves',
          'Modeling the behavior you expect from your team consistently',
          'Delegating all difficult tasks to senior staff',
          'Prioritizing results over process',
        ],
        correct: 1,
      },
      {
        question: 'How quickly should urgent operational messages be acknowledged during business hours?',
        options: [
          'Within 24 hours',
          'At the next scheduled team meeting',
          'Within 2 hours',
          'Within 15 minutes',
        ],
        correct: 2,
      },
      {
        question: 'Which of the following actions requires admin or founder approval before a manager can proceed?',
        options: [
          'Scheduling a team meeting',
          'Approving a driver\'s time-off request',
          'Changes to pay rates or payout structures',
          'Reassigning a route to a different driver',
        ],
        correct: 2,
      },
      {
        question: 'What is the correct response when a manager encounters a situation that exceeds their authority?',
        options: [
          'Handle it independently to avoid escalation delays',
          'Wait for the situation to resolve on its own',
          'Escalate immediately and document the escalation',
          'Consult team members and take a group vote',
        ],
        correct: 2,
      },
    ],
    passingScore: 3,
  },

  // ── Module 3: OSHA & Workplace Safety ───────────────────────────────────────
  {
    id: 'mgmt_osha_safety',
    title: 'OSHA & Workplace Safety',
    description: 'OSHA standards for recycling operations, PPE requirements, emergency procedures, and your legal obligations as a supervisor.',
    estimatedMinutes: 18,
    requiredFor: ['executive', 'director', 'manager', 'supervisor'],
    contentSections: [
      {
        heading: 'OSHA Overview for Recycling Operations',
        body: `The Occupational Safety and Health Administration (OSHA) sets legally binding workplace safety standards. Recycling facilities and pickup operations fall under multiple OSHA standards, including General Industry (29 CFR Part 1910) and, where applicable, Construction (29 CFR Part 1926).

As a manager or supervisor, you have legal duties beyond those of a regular employee. You are responsible for ensuring your team has the training, equipment, and procedures they need to work safely. Failure to meet OSHA standards can result in citations, fines, and in serious cases, personal liability.

Key OSHA regulations relevant to our operations:
1910.132 — Personal Protective Equipment (PPE)
1910.147 — Lockout/Tagout (energy control)
1910.1200 — Hazard Communication (HazCom / SDS)
1910.36 — Exit Routes
1910.38 — Emergency Action Plans`,
      },
      {
        heading: 'Personal Protective Equipment (PPE)',
        body: `PPE is the last line of defense — engineering and administrative controls come first. But PPE must be available, maintained, and correctly used at all times.

Warehouse floor personnel: safety-toed footwear, cut-resistant gloves, high-visibility vest, eye protection in sorting areas.
Loading dock personnel: hard hat, gloves, safety-toed footwear, high-visibility vest.
Drivers: safety-toed footwear during pickups, gloves when handling bags or bins.

Managers must:
— Conduct PPE hazard assessments for their work areas.
— Ensure PPE is available and in good condition.
— Train employees on correct use, storage, and replacement.
— Document all PPE training and assessments.`,
      },
      {
        heading: 'Emergency Procedures',
        body: `Every facility and operational area must have a written Emergency Action Plan (EAP). The EAP must cover:
— Fire evacuation routes and assembly points
— Medical emergency response (location of first aid kits, AED, and nearest hospital)
— Chemical spill response (relevant to cleaning supplies and battery-containing e-waste)
— Severe weather shelter procedures
— Workplace violence response

Management responsibilities during an emergency:
1. Ensure all personnel evacuate safely.
2. Account for all team members at the assembly point.
3. Do NOT re-enter the building until the all-clear is given.
4. Call 911 first. Notify your supervisor second.
5. Document the incident using the platform's Incident Report tool within 4 hours.`,
      },
      {
        heading: 'Incident Reporting Obligations',
        body: `OSHA requires employers to report:
— Fatalities: within 8 hours
— In-patient hospitalizations, amputations, or eye loss: within 24 hours

All workplace injuries and near-misses must be recorded internally, regardless of severity. Use the platform's Incident Report module. For OSHA-recordable incidents, complete OSHA Form 300 (Log of Work-Related Injuries and Illnesses).

Managers must never discourage employees from reporting injuries. Retaliation against an employee for reporting a safety concern is illegal under OSHA Section 11(c).`,
      },
      {
        heading: 'Supervisor Safety Walkthrough',
        body: `Supervisors should conduct a safety walkthrough of their area at the start of every shift. Check:
— PPE availability and condition
— Walkways clear of obstructions
— Emergency exits unblocked
— Machinery guards in place
— Spill cleanup supplies accessible
— No unauthorized materials in the work area

Document any hazards found and the corrective action taken. If a hazard cannot be immediately corrected, restrict access to the affected area until it is resolved.`,
      },
    ],
    quizQuestions: [
      {
        question: 'Under OSHA, who has legal responsibilities for ensuring team members have training and equipment to work safely?',
        options: [
          'Only the company owner',
          'HR department only',
          'Each individual employee',
          'Managers and supervisors',
        ],
        correct: 3,
      },
      {
        question: 'A workplace fatality must be reported to OSHA within:',
        options: [
          '24 hours',
          '72 hours',
          '8 hours',
          '48 hours',
        ],
        correct: 2,
      },
      {
        question: 'Which of the following is PROHIBITED by OSHA Section 11(c)?',
        options: [
          'Requiring PPE on the warehouse floor',
          'Documenting safety incidents',
          'Retaliating against an employee for reporting a safety concern',
          'Conducting shift safety walkthroughs',
        ],
        correct: 2,
      },
      {
        question: 'During an emergency evacuation, what is the FIRST thing a manager should do after exiting the building?',
        options: [
          'Call the company owner',
          'Re-enter to verify everyone is out',
          'Account for all team members at the assembly point',
          'Write up the incident report',
        ],
        correct: 2,
      },
    ],
    passingScore: 3,
  },

  // ── Module 4: EPA & Recycling Compliance ────────────────────────────────────
  {
    id: 'mgmt_epa_compliance',
    title: 'EPA & Recycling Compliance',
    description: 'EPA standards for recycling material handling, contamination prevention, documentation requirements, and audit readiness.',
    estimatedMinutes: 18,
    requiredFor: ['executive', 'director', 'manager', 'supervisor'],
    contentSections: [
      {
        heading: 'EPA Overview for Recycling Operations',
        body: `The Environmental Protection Agency (EPA) regulates the collection, handling, transportation, and processing of solid waste and recyclable materials. Recycling companies must comply with:
— Resource Conservation and Recovery Act (RCRA) — governs solid and hazardous waste
— Clean Air Act — relevant to dust and emissions from processing
— Toxic Substances Control Act (TSCA) — relevant to e-waste containing lead, mercury, or PCBs
— State-level solid waste management regulations (which may be stricter than federal)

Non-compliance can result in facility shutdowns, fines, and loss of operating permits. Compliance is a business continuity issue, not just a legal formality.`,
      },
      {
        heading: 'Accepted and Prohibited Materials',
        body: `Our platform specifies accepted material types for each pickup type:
Accepted: cardboard, plastic bottles/containers, aluminum cans, glass bottles, paper, mixed recycling, food packaging (empty and rinsed), pallets.

Prohibited (consumer and commercial streams):
— Hazardous waste (paints, pesticides, motor oil, solvents)
— Medical waste or sharps
— Electronic waste containing batteries (accept only through designated e-waste channels)
— Contaminated food waste (food-soiled paper and containers not rinsed)
— Construction and demolition debris

Management must ensure drivers and warehouse employees know what they can and cannot accept. Contamination that enters the facility costs money, creates liability, and can contaminate entire batches of recyclables.`,
      },
      {
        heading: 'Contamination Prevention',
        body: `Contamination occurs when non-recyclable or prohibited materials enter the recycling stream. Sources include:
— Customer error (incorrect sorting at source)
— Driver acceptance of prohibited bags or bins
— Warehouse cross-contamination (mixing clean and contaminated materials)

Prevention measures:
At pickup: Drivers must visually check bags/bins before accepting. Visibly contaminated loads should be flagged using the platform's contamination reporting tool.
At warehouse: Incoming loads receive a visual inspection and color-coded inspection result (green/yellow/red). Red loads must be quarantined and reviewed by a supervisor before processing.
Documentation: All contamination incidents must be logged in the platform. Trends are reviewed monthly.`,
      },
      {
        heading: 'Material Documentation and Chain of Custody',
        body: `A complete chain of custody documents:
1. Who collected the material (driver ID, route stop ID)
2. When it was collected (timestamp)
3. What was collected (material type, estimated weight)
4. Where it went (warehouse ID, processing station)
5. How it was processed (inspection result, actual weight, buyer)

This documentation is required for environmental reporting, customer-facing impact reports, and any regulatory audit. Managers are responsible for ensuring their team's records are complete, accurate, and submitted on time.

Missing or falsified records are grounds for disciplinary action, up to and including termination.`,
      },
      {
        heading: 'Audit Readiness',
        body: `Regulatory audits can occur with little or no advance notice. To be audit-ready at all times:
— All required permits and licenses must be current and displayed/accessible.
— Training records must be complete for all employees.
— Incident logs must be current.
— Material flow documentation must be available for at least the prior 3 years.
— Emergency Action Plans must be posted.
— PPE inspection logs must be current.

Managers must conduct quarterly internal compliance audits of their area. Document findings and corrective actions. These records demonstrate good-faith compliance effort if a regulatory audit finds a deficiency.`,
      },
    ],
    quizQuestions: [
      {
        question: 'Which federal law primarily governs solid and hazardous waste handling at a recycling facility?',
        options: [
          'OSHA General Industry Standard',
          'Resource Conservation and Recovery Act (RCRA)',
          'Fair Labor Standards Act (FLSA)',
          'Clean Water Act',
        ],
        correct: 1,
      },
      {
        question: 'A driver arrives at a pickup and the bag contains what appears to be motor oil containers. What should the driver do?',
        options: [
          'Accept the bag — oil containers are recyclable',
          'Accept the bag and flag it for warehouse inspection',
          'Refuse the pickup and flag it using the contamination reporting tool',
          'Accept it and set it aside at the warehouse',
        ],
        correct: 2,
      },
      {
        question: 'How long must material flow documentation be retained for audit purposes?',
        options: [
          '6 months',
          '1 year',
          'At least 3 years',
          'At least 10 years',
        ],
        correct: 2,
      },
      {
        question: 'What does a red inspection result at the warehouse mean?',
        options: [
          'The load is clean and can be processed immediately',
          'The load has minor contamination that can be sorted out',
          'The load must be quarantined and reviewed by a supervisor before processing',
          'The load is a high-priority commercial order',
        ],
        correct: 2,
      },
    ],
    passingScore: 3,
  },

  // ── Module 5: Driver Operations ─────────────────────────────────────────────
  {
    id: 'mgmt_driver_ops',
    title: 'Driver Operations',
    description: 'How the driver side of the platform works — driver types, onboarding, dispatch, compliance, and how managers interact with driver workflows.',
    estimatedMinutes: 15,
    requiredFor: ['executive', 'director', 'manager', 'supervisor'],
    contentSections: [
      {
        heading: 'Driver Classifications',
        body: `There are three driver service types on the platform:

driver_1099 — Independent contractor. Handles consumer (residential) pickups only. Earns via the payout ledger. Receives a 1099 at tax time. Responsible for their own vehicle, insurance, and fuel.

commercial_only — Company employee. Handles commercial route pickups only using company vehicles and equipment. Does NOT complete W-9 or personal payout setup — payroll is handled externally.

hybrid_driver — Approved for both consumer and commercial work. Can switch between residential and commercial modes using the Driver Mode Select screen. Both service lines earn through the platform's payout ledger.

Driver service type is set by admin at the time of approval. It controls which screens and routes the driver can access.`,
      },
      {
        heading: 'Driver Onboarding and Compliance',
        body: `All drivers complete the Driver Compliance Pack before becoming active:
— License documentation (front and back)
— Background check consent
— Agreement and training (separate agreements for consumer vs commercial drivers)
— For 1099 drivers: W-9, insurance verification, vehicle info, payout deposit, policy acknowledgement
— For commercial drivers: I-9, W-4

The compliance function driver_meets_success_criteria() in the database evaluates completion. Admin reviews and approves or rejects applications. Rejected drivers can reapply with corrected documents.

Managers with can_view_drivers permission can view driver compliance status in the Management Dashboard.`,
      },
      {
        heading: 'Dispatch and Route Assignment',
        body: `Consumer pickups are requested by customers and fulfilled by available drivers in the service area. The admin dispatch screen shows open requests and allows manual assignment.

Commercial pickups are scheduled in advance and dispatched to commercial or hybrid drivers via the Admin Commercial Dispatch screen. Route stops are prioritized automatically (emergency/priority pickups sort first). Managers with can_dispatch_drivers permission can perform dispatch actions.

The is_priority flag on commercial pickups is set automatically when:
— The pickup type is emergency
— commercial_emergency_enabled is true in Operations Settings
— commercial_priority_dispatch is true in Operations Settings

All three conditions must be true for the priority flag to activate.`,
      },
      {
        heading: 'Driver Platform Status',
        body: `Drivers have a platform status separate from their approval status:
active — Working normally.
warned — A policy violation has been flagged. The driver is notified and has 7 days to respond.
suspended — Access to driver routes is suspended. Driver can still log in but cannot accept pickups.
terminated — Account is deactivated. All active routes are reassigned.

Status changes are made by admin. Managers can recommend status changes through the driver compliance review screen but cannot change status directly unless granted can_manage_compliance permission.`,
      },
      {
        heading: 'Driver Earnings and Payout',
        body: `Driver earnings are recorded in the payout_ledger table. Each entry has a source_type (consumer_pickup, commercial_pickup, bonus, adjustment, penalty).

The payout flow:
1. Earnings are generated and held as pending.
2. Admin reviews and approves earnings batches.
3. Admin marks payouts as paid (check, cash, Zelle, bank transfer, Cash App, or other).
4. Drivers view their history in the Driver Wallet.

IMPORTANT: The platform does NOT process payments. It records them after the fact. Do not add, integrate, or suggest Stripe Connect, ACH transfers, routing numbers, bank account collection, or any payment processor to the driver payout workflow.`,
      },
    ],
    quizQuestions: [
      {
        question: 'Which driver type handles ONLY commercial route pickups using company vehicles?',
        options: [
          'driver_1099',
          'hybrid_driver',
          'commercial_only',
          'residential_driver',
        ],
        correct: 2,
      },
      {
        question: 'What three conditions must ALL be true for a commercial pickup to receive the is_priority flag?',
        options: [
          'Driver is hybrid, customer is premium, pickup is overdue',
          'Pickup is emergency type, commercial_emergency_enabled is true, commercial_priority_dispatch is true',
          'Route distance is over 10 miles, bin count exceeds 5, and admin approves manually',
          'Customer requests priority, driver accepts, and admin confirms',
        ],
        correct: 1,
      },
      {
        question: 'Who can directly change a driver\'s platform status (active/warned/suspended/terminated)?',
        options: [
          'Any management employee',
          'The driver\'s direct supervisor',
          'Admin only (managers can recommend via compliance review)',
          'Any warehouse supervisor',
        ],
        correct: 2,
      },
      {
        question: 'Which of the following is PROHIBITED in the driver payout workflow?',
        options: [
          'Recording payouts by check or cash',
          'Admin marking a batch as paid',
          'Drivers viewing their wallet history',
          'Adding Stripe Connect or ACH transfers to the payout flow',
        ],
        correct: 3,
      },
    ],
    passingScore: 3,
  },

  // ── Module 6: Warehouse Operations ──────────────────────────────────────────
  {
    id: 'mgmt_warehouse_ops',
    title: 'Warehouse Operations',
    description: 'Warehouse intake, inspection, processing, staffing tiers, compliance requirements, and how management interacts with warehouse workflows.',
    estimatedMinutes: 15,
    requiredFor: ['executive', 'director', 'manager', 'supervisor'],
    contentSections: [
      {
        heading: 'Warehouse Staff Tiers',
        body: `Warehouse personnel have four role tiers:
warehouse_employee — Floor worker. Receives, sorts, scans, and processes material.
warehouse_supervisor — Shift lead. Approves inspections, manages floor assignments, handles exceptions.
warehouse_manager — Facility manager. Oversees operations, compliance, staffing, and reporting for a single facility.
warehouse_admin — Warehouse-level administrator. Has elevated data access for the facility.

Each tier has separate onboarding requirements. All warehouse staff complete the Warehouse Onboarding V2 program (18-step wizard) before independent operation.`,
      },
      {
        heading: 'Intake Process',
        body: `When a driver arrives at the warehouse:
1. The driver checks in using the platform's Warehouse Check-in screen.
2. A warehouse employee opens the intake queue (Commercial Expected Loads or Consumer Intake).
3. The load is weighed and visually inspected.
4. An inspection result is recorded: green (clean), yellow (minor contamination), or red (significant contamination or prohibited materials).
5. Green and yellow loads proceed to sorting. Red loads are quarantined pending supervisor review.
6. The actual weight is recorded. This updates the driver's delivery record and triggers any weight-based payout calculations.`,
      },
      {
        heading: 'Contamination Review',
        body: `Contamination review is a supervisor-level responsibility. When a load is flagged red:
1. The supervisor reviews the flagged load record in the platform.
2. The supervisor documents the contamination type and source.
3. The supervisor decides: reject the load, partial accept, or remediate and accept.
4. The driver is notified of the outcome.
5. Repeated contamination from a single driver is escalated to the operations manager.

Warehouse managers review contamination trend reports monthly. If contamination rates exceed 5% for any material stream, a root cause investigation is required.`,
      },
      {
        heading: 'Commercial Load Processing',
        body: `Commercial loads have more detailed processing requirements:
— Bin count verification against the route stop record
— Material type verification (what was dispatched vs. what arrived)
— Actual weight recording
— Photo documentation for contamination or damage claims
— Chain of custody completion in the platform

Commercial inspections are linked to the commercial_pickups record and are visible to the commercial customer in their account dashboard. Accuracy and professionalism in commercial processing directly affect customer retention.`,
      },
      {
        heading: 'Warehouse Compliance and Alerts',
        body: `Warehouse alerts are generated automatically for:
— Overdue expected loads (driver did not arrive within the dispatch window)
— Red-flagged loads awaiting supervisor review
— Contamination rates exceeding thresholds
— Equipment or safety issues logged by floor staff

Managers with can_view_warehouses permission can view alerts in the Management Dashboard. Alerts that are not acknowledged within 24 hours are escalated automatically. Supervisors are responsible for clearing alerts within their shift.`,
      },
    ],
    quizQuestions: [
      {
        question: 'Which warehouse staff tier is responsible for approving inspections and managing floor assignments?',
        options: [
          'warehouse_employee',
          'warehouse_admin',
          'warehouse_manager',
          'warehouse_supervisor',
        ],
        correct: 3,
      },
      {
        question: 'What happens to a load that receives a red inspection result?',
        options: [
          'It is processed immediately at a lower priority',
          'It is returned to the driver without documentation',
          'It is quarantined pending supervisor review',
          'It is accepted but flagged for a second inspection',
        ],
        correct: 2,
      },
      {
        question: 'At what contamination rate does a root cause investigation become required?',
        options: [
          'Any contamination triggers an investigation',
          'Greater than 5% for any material stream',
          'Greater than 20% overall',
          'Only when a customer complaint is filed',
        ],
        correct: 1,
      },
      {
        question: 'Why does accuracy in commercial load processing matter beyond just internal records?',
        options: [
          'It affects the warehouse employee\'s performance score only',
          'Commercial inspection records are visible to the commercial customer in their account dashboard',
          'It determines how much the warehouse facility is reimbursed',
          'It is required only for government-contracted commercial accounts',
        ],
        correct: 1,
      },
    ],
    passingScore: 3,
  },

  // ── Module 7: Data Security ──────────────────────────────────────────────────
  {
    id: 'mgmt_data_security',
    title: 'Data Security',
    description: 'Passwords, MFA, phishing awareness, handling of customer, driver, and financial data, and your obligations as a manager.',
    estimatedMinutes: 14,
    requiredFor: ['executive', 'director', 'manager', 'supervisor'],
    contentSections: [
      {
        heading: 'Why Data Security Matters',
        body: `Cyan's Brooklynn holds sensitive data about consumers, drivers, commercial businesses, and financial records. A breach can expose personally identifiable information (PII), cause financial harm to customers and partners, expose the company to regulatory fines, and permanently damage trust.

As a manager, you have access to more data than most team members. You are a high-value target for social engineering and phishing. Protecting the data you can access is a core professional responsibility.`,
      },
      {
        heading: 'Passwords and Multi-Factor Authentication',
        body: `Password requirements:
— Minimum 12 characters
— Mix of uppercase, lowercase, numbers, and symbols
— Never reused across platforms
— Changed immediately if compromise is suspected

Use a password manager (1Password, Bitwarden, or equivalent). Do not write passwords on paper or store them in plain-text files.

Multi-Factor Authentication (MFA) is REQUIRED for:
— Platform admin and management accounts
— Email accounts used for company business
— Any tool with access to customer or financial data

If you lose access to your MFA device, report it to IT/admin immediately. Do not attempt to bypass MFA.`,
      },
      {
        heading: 'Phishing and Social Engineering',
        body: `Phishing attacks arrive as emails, texts, or calls that appear to be from a trusted source. Signs of a phishing attempt:
— Urgency or fear tactics ("Your account will be suspended")
— Requests for credentials, payment, or sensitive data
— Links to URLs that look similar to known sites but are slightly different
— Unexpected attachments
— Requests to bypass normal approval processes

If you receive a suspicious message:
1. Do NOT click links or open attachments.
2. Do NOT provide credentials or financial information.
3. Forward the message to admin/IT.
4. If the message claims to be from a vendor or partner, verify by calling them directly using a known number — not a number provided in the suspicious message.`,
      },
      {
        heading: 'Customer, Driver, and Commercial Data',
        body: `Categories of sensitive data you may access:
Customer PII — name, address, phone, email, pickup history.
Driver PII — name, address, license information, background check status, earnings records.
Commercial account data — business name, contact information, contract terms, billing history.
Financial records — payout ledger entries, batch records, payment method descriptions.

Handling rules:
— Access only data you need for your specific job function.
— Do not download or export data to personal devices or unapproved cloud storage.
— Do not share data with external parties without admin approval and a signed data sharing agreement.
— Report any accidental disclosure immediately to admin.`,
      },
      {
        heading: 'Platform API Key Security',
        body: `The platform uses an Anthropic API key for AI-assisted content features. This key is SERVER-SIDE ONLY. It must never appear in browser-visible code or environment variables prefixed with VITE_.

If you are in a technical role and you observe a VITE_ANTHROPIC_ variable, a public API key in any .env file committed to source control, or any direct browser-side call to api.anthropic.com, report it to the technology team immediately.

Similarly, no credentials for Supabase, payment services, or third-party APIs should ever be hardcoded in front-end source files or committed to version control.`,
      },
    ],
    quizQuestions: [
      {
        question: 'MFA (Multi-Factor Authentication) is required for which accounts?',
        options: [
          'Only the CEO and CTO',
          'Only accounts that process financial transactions',
          'Platform admin/management accounts, business email, and any tool with access to customer or financial data',
          'Only accounts with access to warehouse floor systems',
        ],
        correct: 2,
      },
      {
        question: 'You receive an urgent email claiming to be from your bank, asking you to click a link and verify your account credentials. What should you do?',
        options: [
          'Click the link and verify — banks send legitimate urgent notices',
          'Reply to the email asking for more information',
          'Do not click the link, forward the message to admin/IT, and call the bank using a known number',
          'Delete the email and take no further action',
        ],
        correct: 2,
      },
      {
        question: 'You accidentally send a customer\'s address and pickup history to the wrong email address. What should you do?',
        options: [
          'Wait to see if anyone notices before reporting',
          'Send a follow-up email asking the recipient to delete it',
          'Report the accidental disclosure immediately to admin',
          'Contact the customer directly without notifying admin',
        ],
        correct: 2,
      },
      {
        question: 'Where must the Anthropic API key be stored to comply with platform security rules?',
        options: [
          'In a VITE_ prefixed environment variable for browser access',
          'In a public GitHub repository for team visibility',
          'Server-side only — never in browser-visible code or VITE_ prefixed variables',
          'In the browser\'s localStorage for caching purposes',
        ],
        correct: 2,
      },
    ],
    passingScore: 3,
  },

  // ── Module 8: Financial Controls ────────────────────────────────────────────
  {
    id: 'mgmt_financial_controls',
    title: 'Financial Controls',
    description: 'The Internal Wallet and Manual Payout Ledger system, financial authorization rules, expense controls, and what is strictly prohibited.',
    estimatedMinutes: 16,
    requiredFor: ['executive', 'director', 'manager', 'supervisor'],
    contentSections: [
      {
        heading: 'The Official Financial System',
        body: `Cyan's Brooklynn Recycling uses the Internal Wallet and Manual Payout Ledger as its financial system. This is the authoritative source of all earnings, payouts, adjustments, and penalties recorded on the platform.

The system is intentional. It allows the company to operate, track obligations, and issue payouts without the cost, compliance burden, and technical complexity of automated payment processing.

The payout flow:
1. An earning is generated (consumer pickup completed, commercial pickup completed, fundraiser campaign contribution, bonus, or adjustment).
2. The earning is recorded in the payout_ledger table with a pending status.
3. Admin reviews and approves the earning batch.
4. Admin records the payment using an offline method (check, cash, Zelle, Cash App, bank transfer, or other).
5. Admin marks the payout as paid in the platform.
6. The recipient can view their payment history in their wallet.`,
      },
      {
        heading: 'Prohibited Financial Integrations',
        body: `The following are STRICTLY PROHIBITED without explicit written approval from the founder:

— Stripe Connect or any Stripe OAuth flow
— ACH (Automated Clearing House) processing
— Routing number collection from employees, drivers, or partners
— Bank account number collection from employees, drivers, or partners
— Debit or credit card collection or processing for any purpose
— Integration with any payment processor (Stripe, Plaid, Dwolla, Square, PayPal, Venmo Business, etc.)
— Any payout API that moves money automatically
— Any third-party billing or subscription management system not already in use

These are not policy suggestions — they are hard technical and business constraints. If a vendor or partner proposes adding payment processing features, escalate the request to the founder before any discussion proceeds. Do not agree, trial, or prototype without explicit founder approval.`,
      },
      {
        heading: 'Expense Authorization Levels',
        body: `All expenses must be approved before being incurred. Authorization levels:

Supervisor — up to $500 per expense, with department manager approval.
Manager — up to $2,500 per expense, with director approval.
Director — up to $10,000 per expense, with executive approval.
Executive — up to $25,000 per expense, with founder approval.
Any expense above $25,000 — founder approval required.

Recurring expenses (subscriptions, contracts) require approval at the level covering their ANNUAL cost, not monthly cost. Emergency expenses (safety equipment, facility repairs that cannot wait) may be authorized retroactively, but must be documented and submitted for approval within 24 hours.`,
      },
      {
        heading: 'Financial Record Integrity',
        body: `All financial records must be accurate, complete, and timely. This includes payout ledger entries, expense reports, vendor invoices, and driver earning records.

Falsifying, deleting, or intentionally miscoding a financial record is grounds for immediate termination and may constitute fraud under applicable law.

Managers with can_manage_finances permission can view and annotate financial records. They cannot delete records. Adjustments to existing records must go through the admin correction workflow with an explanation documented.`,
      },
      {
        heading: 'Fundraiser Financial Rules',
        body: `Fundraiser campaign earnings follow the same payout ledger structure. The source_type for fundraiser entries is fundraiser_campaign. Fundraisers can view their pending balance in their Fundraiser Wallet.

Current status: Fundraiser payout status is pending_setup. Campaigns operate normally and credits accumulate in the ledger. Actual payout disbursement will be authorized in a future phase.

Managers must not tell fundraiser partners that payouts are ready for disbursement until the founder explicitly authorizes that phase. Setting incorrect payout expectations damages trust and may create legal obligations.`,
      },
    ],
    quizQuestions: [
      {
        question: 'What is the official financial system for Cyan\'s Brooklynn Recycling?',
        options: [
          'Stripe Connect integrated with the platform',
          'QuickBooks with ACH disbursement',
          'The Internal Wallet and Manual Payout Ledger',
          'PayPal Business with automated payout rules',
        ],
        correct: 2,
      },
      {
        question: 'A vendor proposes adding Stripe Connect to automate driver payouts. What is the correct response?',
        options: [
          'Evaluate the proposal and proceed if the pricing is favorable',
          'Pilot it with a small group of drivers to test feasibility',
          'Escalate to the founder immediately — no agreement, trial, or prototype without explicit founder approval',
          'Ask the technology team to review and implement it',
        ],
        correct: 2,
      },
      {
        question: 'What is the expense authorization limit for a Manager (without escalation to director)?',
        options: [
          '$500',
          '$5,000',
          '$2,500',
          '$10,000',
        ],
        correct: 2,
      },
      {
        question: 'Fundraiser campaign credits accumulate in the payout ledger. When should a manager tell a fundraiser partner that their payout is ready to disburse?',
        options: [
          'As soon as their balance reaches $100',
          'After 30 days of campaign activity',
          'Only after the founder explicitly authorizes the fundraiser payout disbursement phase',
          'When the fundraiser files a written request',
        ],
        correct: 2,
      },
    ],
    passingScore: 3,
  },

  // ── Module 9: Incident Investigations ──────────────────────────────────────
  {
    id: 'mgmt_incident_investigations',
    title: 'Incident Investigations',
    description: 'How to investigate workplace incidents, driver incidents, contamination events, customer complaints, and platform anomalies.',
    estimatedMinutes: 14,
    requiredFor: ['executive', 'director', 'manager', 'supervisor'],
    contentSections: [
      {
        heading: 'Types of Incidents Requiring Investigation',
        body: `An incident is any unplanned event that causes or could have caused harm, loss, or a compliance violation. Categories relevant to our operations:

Workplace Safety Incidents — injuries, near-misses, equipment failures, emergency responses.
Driver Incidents — contaminated pickups, missed routes, bag damage, vehicle accidents, customer complaints.
Warehouse Incidents — intake failures, contamination events, equipment damage, theft or loss of materials.
Platform Anomalies — data errors, duplicate records, unauthorized access attempts, system downtime.
Customer/Partner Complaints — any formal complaint from a consumer, commercial customer, or fundraiser partner.
Financial Discrepancies — any mismatch between expected and recorded earnings, expenses, or payouts.`,
      },
      {
        heading: 'Investigation Process',
        body: `Every investigation follows the same core steps:

1. Secure the scene (if physical) — prevent further harm or evidence loss.
2. Gather facts — interview witnesses, collect platform records, review photographs, pull system logs.
3. Identify the root cause — use the "5 Whys" technique: ask "why did this happen?" five times to get past surface symptoms to underlying causes.
4. Document findings — write a clear, factual summary. Do not include opinion or conjecture unless clearly labeled as such.
5. Recommend corrective actions — specific, measurable steps that address the root cause.
6. Follow up — verify that corrective actions were completed and effective.

All investigation documentation must be stored in the platform's Incident Report module and attached to the relevant order, route, or account.`,
      },
      {
        heading: 'Witness Interviews',
        body: `Effective witness interviews:
— Conduct interviews promptly — memory fades quickly.
— Interview witnesses separately to avoid anchoring.
— Ask open questions: "Tell me what you saw" not "Did you see the driver skip the stop?"
— Document the exact words witnesses use, not your interpretation.
— Do not make promises about outcomes or disciplinary action during an interview.

After completing interviews, review any contradictions and, if necessary, follow up with a second brief interview to clarify specific points.`,
      },
      {
        heading: 'Root Cause Analysis',
        body: `The 5 Whys technique:
Observation: A commercial pickup was marked complete but the warehouse has no record of receiving the load.
Why 1: The driver marked complete without delivering.
Why 2: The driver's route included a stop that was inaccessible (gate was locked).
Why 3: The commercial account's gate code was not updated in the system.
Why 4: The account manager changed the gate code but did not update the platform.
Why 5: There is no process requiring account managers to update access codes in the platform when they change.

Root cause: No documented process for access code updates.
Corrective action: Create a checklist item in the account management workflow for gate/access code updates.

This technique prevents repeat incidents by addressing the system failure, not just the individual behavior.`,
      },
      {
        heading: 'Escalation and Reporting Timelines',
        body: `Severity 1 — Immediate threat to safety or operations:
Escalate to director/executive within 1 hour. Notify admin. Document within 4 hours.

Severity 2 — Significant operational impact or compliance concern:
Escalate to director within 4 hours. Full documentation within 24 hours.

Severity 3 — Notable but contained incident:
Document within 24 hours. Review at next management meeting.

Severity 4 — Minor incident, resolved without escalation:
Document within 48 hours. No escalation required.

Under-reporting or misclassifying severity is a performance issue. When in doubt, escalate — you can always downgrade after review.`,
      },
    ],
    quizQuestions: [
      {
        question: 'What is the first step in the investigation process for any incident?',
        options: [
          'Interview all witnesses at the same time',
          'Secure the scene to prevent further harm or evidence loss',
          'Submit the incident report to OSHA',
          'Identify the responsible employee',
        ],
        correct: 1,
      },
      {
        question: 'Why should witnesses be interviewed separately?',
        options: [
          'To save time by conducting multiple interviews at once',
          'To avoid anchoring — one person\'s account influencing another\'s',
          'Because group interviews are not legally permissible',
          'To ensure witnesses do not collaborate on corrections',
        ],
        correct: 1,
      },
      {
        question: 'What is the goal of the "5 Whys" technique?',
        options: [
          'To identify and punish the responsible individual',
          'To meet OSHA documentation requirements',
          'To get past surface symptoms and identify the underlying system failure',
          'To create a timeline of events for legal review',
        ],
        correct: 2,
      },
      {
        question: 'A Severity 1 incident (immediate safety or operational threat) must be escalated to a director or executive within:',
        options: [
          '24 hours',
          '4 hours',
          '48 hours',
          '1 hour',
        ],
        correct: 3,
      },
    ],
    passingScore: 3,
  },

  // ── Module 10: Ethics & Professional Conduct ─────────────────────────────────
  {
    id: 'mgmt_ethics',
    title: 'Ethics & Professional Conduct',
    description: 'Ethical decision-making, conflict of interest, harassment prevention, whistleblower protections, and Cyan\'s Brooklynn\'s code of conduct.',
    estimatedMinutes: 14,
    requiredFor: ['executive', 'director', 'manager', 'supervisor'],
    contentSections: [
      {
        heading: 'The Code of Conduct',
        body: `Cyan's Brooklynn's Code of Conduct applies to all management personnel at all times — on the job, at company events, and when representing the company externally.

Core principles:
Honesty — Represent facts accurately. Do not mislead customers, partners, employees, or regulators.
Integrity — Do what you said you would do. If you cannot, communicate early and clearly.
Respect — Treat every person with dignity regardless of their role, background, or circumstances.
Accountability — Own your decisions and their consequences. Do not deflect blame.
Fairness — Apply policies, rewards, and discipline consistently across all team members.

Violations of the Code of Conduct are investigated and may result in corrective action up to and including termination.`,
      },
      {
        heading: 'Conflict of Interest',
        body: `A conflict of interest exists when your personal interests — financial, personal, or relational — could influence (or appear to influence) decisions you make in your professional role.

Examples:
— Hiring a family member or close friend for a position you oversee.
— Approving a vendor contract with a company in which you have a financial interest.
— Sharing confidential customer or driver data with a competitor or personal business.
— Making operational decisions that benefit a business you personally own.

Required actions:
— Disclose any potential conflict of interest to your supervisor and HR in writing before taking any related action.
— Recuse yourself from decisions where a conflict exists.
— Do not attempt to manage the conflict yourself — disclosure and recusal are mandatory.`,
      },
      {
        heading: 'Harassment and Discrimination',
        body: `Cyan's Brooklynn has zero tolerance for harassment or discrimination based on race, color, national origin, sex, religion, age, disability, sexual orientation, gender identity, or any other protected characteristic.

Harassment includes:
— Unwanted physical contact
— Verbal or written comments that demean or intimidate
— Creating a hostile work environment
— Quid pro quo (exchanging work benefits for personal favors)

Manager responsibilities:
— Prevent harassment in your team by modeling professional conduct.
— Respond promptly and seriously to any complaint or concern — even informal ones.
— Do NOT investigate complaints against yourself; escalate to HR/admin.
— Do NOT retaliate against anyone for making a harassment complaint.

Retaliation against a harassment complainant is illegal and grounds for immediate termination.`,
      },
      {
        heading: 'Whistleblower Protections',
        body: `Employees and contractors have the right to report suspected illegal activity, safety violations, or ethics violations without fear of retaliation. This is protected by law under multiple federal and state statutes.

If you become aware of:
— Financial fraud or falsification of records
— Safety violations that create imminent danger
— Discrimination or harassment
— Regulatory violations

You have an obligation to report it. Reports can be made to your supervisor, HR, admin, or directly to the relevant regulatory agency.

Managers must never threaten, discipline, or penalize an employee for making a good-faith report. Doing so is illegal and will be treated as a Severity 1 conduct violation.`,
      },
      {
        heading: 'Ethical Decision-Making Framework',
        body: `When facing a difficult decision, apply this framework:

1. Is it legal? If it violates any law or regulation, the answer is no — stop there.
2. Does it comply with company policy? If not, escalate before proceeding.
3. Would you be comfortable if it were reported publicly? If the answer is no, reconsider.
4. Does it treat everyone involved fairly? If one party is disadvantaged unfairly, find a better path.
5. Does it align with Cyan's Brooklynn's values? Community first, fairness, transparency, environmental responsibility, continuous improvement.

If you cannot answer yes to all five questions, escalate to your supervisor before acting. Ethical uncertainty is not weakness — it is professional judgment.`,
      },
    ],
    quizQuestions: [
      {
        question: 'A manager discovers that a team member they supervise is also their cousin. What is the required action?',
        options: [
          'No action needed — family members can work in the same team as long as they are professional',
          'Disclose the relationship to HR and supervisor in writing and recuse from performance evaluations involving that team member',
          'Transfer the team member to a different department without documentation',
          'Handle it privately to avoid drawing attention to the relationship',
        ],
        correct: 1,
      },
      {
        question: 'An employee files a harassment complaint against a peer. The manager\'s correct response is to:',
        options: [
          'Investigate the complaint personally to resolve it quickly',
          'Ask the complainant to work it out with the other employee directly',
          'Respond promptly and seriously, escalate to HR/admin, and protect the complainant from retaliation',
          'Wait to see if more complaints come in before taking action',
        ],
        correct: 2,
      },
      {
        question: 'A team member reports to you that they believe a financial record was falsified. What should you do?',
        options: [
          'Investigate the allegation yourself and correct the record if needed',
          'Dismiss the concern — employees misunderstand financial records frequently',
          'Escalate to admin and protect the reporting employee from any retaliation',
          'Ask the employee to submit a formal written complaint before you take any action',
        ],
        correct: 2,
      },
      {
        question: 'Which of the following is NOT one of the five questions in the ethical decision-making framework?',
        options: [
          'Is it legal?',
          'Does it comply with company policy?',
          'Will it increase quarterly revenue?',
          'Does it treat everyone involved fairly?',
        ],
        correct: 2,
      },
    ],
    passingScore: 3,
  },

]

/** Return the full management training module list. */
export function getManagementTrainingModules(): ManagementTrainingModule[] {
  return MANAGEMENT_TRAINING_MODULES
}

/** Return a single module by id, or undefined if not found. */
export function getManagementModuleById(id: string): ManagementTrainingModule | undefined {
  return MANAGEMENT_TRAINING_MODULES.find(m => m.id === id)
}
