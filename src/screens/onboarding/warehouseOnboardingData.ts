// warehouseOnboardingData.ts — Static content for the warehouse onboarding wizard.
//
// Everything here is OPERATIONAL onboarding, not legal advice. Safety-first
// language matches OSHA-style workplace expectations: stop work if unsafe,
// report hazards immediately, never handle unknown hazardous materials,
// escalate red-bag conditions, follow supervisor instructions, use PPE.
//
// Versions: when content materially changes, bump WAREHOUSE_*_VERSION.
// The version is written to driver_acknowledgments / certifications so admins
// can see which version each worker completed.

import type {
  WarehouseTrainingModule,
  WarehouseAcknowledgment,
  WarehouseExamQuestion,
  BagStatusRule,
} from '../../types/warehouse'

// ── Version constants ────────────────────────────────────────────────────────

export const WAREHOUSE_TRAINING_VERSION       = '1.0'
export const WAREHOUSE_CERTIFICATION_VERSION  = '1.0'
export const WAREHOUSE_AGREEMENTS_VERSION     = '1.0'
export const CERTIFICATION_VALID_DAYS         = 365
export const EXAM_PASSING_SCORE_PCT           = 80

// ── Shift types + employment roles ───────────────────────────────────────────

export const WAREHOUSE_SHIFT_TYPES = [
  { value: 'morning',    label: 'Morning (6 AM – 2 PM)' },
  { value: 'afternoon',  label: 'Afternoon (2 PM – 10 PM)' },
  { value: 'overnight',  label: 'Overnight (10 PM – 6 AM)' },
  { value: 'flexible',   label: 'Flexible / On-call' },
] as const

export const WAREHOUSE_EMPLOYMENT_ROLES = [
  { value: 'warehouse_employee',   label: 'Warehouse Worker',     description: 'Frontline intake, scanning, sorting, and inspection.' },
  { value: 'warehouse_supervisor', label: 'Warehouse Supervisor', description: 'Shift lead — reviews onboarding, signs off red-bag escalations.' },
  { value: 'warehouse_manager',    label: 'Warehouse Manager',    description: 'Facility manager — staff compliance, reports, certifications.' },
  { value: 'warehouse_admin',      label: 'Warehouse Admin',      description: 'Warehouse-level admin — distinct from global app admin.' },
] as const

// ── Green / Yellow / Red bag rules ───────────────────────────────────────────

export const BAG_STATUS_RULES: BagStatusRule[] = [
  {
    status: 'green',
    label: 'GREEN — Accepted',
    shortMeaning: 'Bag passes inspection. Accepted immediately and processed.',
    requiresSupervisor: false,
    examples: [
      'Properly sealed bag',
      'Correct, readable QR code',
      'No visible contamination',
      'No hazardous materials',
      'Bag weight appears safe to handle',
    ],
  },
  {
    status: 'yellow',
    label: 'YELLOW — Needs Review',
    shortMeaning: 'Bag needs a rescan, a closer look, or supervisor judgment before processing.',
    requiresSupervisor: false,
    examples: [
      'Torn bag (minor)',
      'Wet bag',
      'Missing or partial label',
      'Possible contamination — uncertain',
      'QR code unclear or unreadable on first scan',
      'Overweight concern — heavier than normal',
    ],
  },
  {
    status: 'red',
    label: 'RED — Rejected + Escalated',
    shortMeaning: 'Stop. Do not process. Escalate to supervisor immediately. Photograph the bag in place.',
    requiresSupervisor: true,
    examples: [
      'Hazardous material (any unknown chemical)',
      'Medical waste',
      'Biohazard symbol',
      'Chemicals, solvents, paints',
      'Needles / sharps',
      'Ammunition',
      'Explosives / fireworks',
      'Illegal substances',
      'Strong / unusual odor',
      'Leaking bag with unidentified liquid',
      'Any unsafe condition that puts you or others at risk',
    ],
  },
]

// ── Training modules ──────────────────────────────────────────────────────────
//
// Each module: short written lesson + an acknowledgment the worker checks +
// a 3-question quiz. Quiz passing score is per-module (default 67% — 2 of 3
// correct). The certification exam at the end of the wizard is separate and
// requires EXAM_PASSING_SCORE_PCT.

export const WAREHOUSE_TRAINING_MODULES: WarehouseTrainingModule[] = [
  {
    id: 'safety',
    title: 'Warehouse Safety',
    description: 'Core safety rules for every shift on the warehouse floor.',
    required: true,
    estimatedMinutes: 8,
    content:
`The warehouse floor is a shared workspace with moving equipment, heavy materials, and active intake.
Safety is the first rule, every shift, every time.

Five rules that never change:
1. Wear your PPE before you step onto the floor. Gloves and closed-toe shoes at minimum; high-vis vest when working near vehicles or loading docks.
2. Look up, look down, look around. Forklifts, pallet jacks, and rolling carts move quietly. Make eye contact with operators.
3. Lift with your legs, not your back. Anything over 50 lbs needs a partner or a dolly.
4. Wet floor signs are not suggestions. If you spill anything, contain it and post the sign before walking away.
5. Stop work if anything feels unsafe. Tell your supervisor. You will never be in trouble for stopping unsafe work.

You are the first line of defense against accidents. Trust your instincts.`,
    acknowledgmentText:
      'I have read the Warehouse Safety rules. I will wear PPE, I will stop work if a situation feels unsafe, and I will report hazards to my supervisor immediately.',
    passingScore: 67,
    quizQuestions: [
      {
        q: 'You see a wet patch on the warehouse floor near intake. What do you do FIRST?',
        options: [
          'Walk around it and continue your shift.',
          'Contain the spill, post a wet floor sign, then notify your supervisor.',
          'Wait until end of shift to mop it up.',
          'Ignore it — someone else will see it.',
        ],
        correct: 1,
      },
      {
        q: 'A bag looks like it might weigh more than 50 lbs. What is the right move?',
        options: [
          'Lift it yourself — you are strong enough.',
          'Use a dolly or get a partner. Never lift unsafe loads alone.',
          'Drag it across the floor.',
          'Skip the bag and move on.',
        ],
        correct: 1,
      },
      {
        q: 'You feel unsafe doing a task your supervisor assigned. What can you do?',
        options: [
          'Do it anyway — the supervisor decides.',
          'Stop the task and explain the safety concern to your supervisor. You will not be in trouble.',
          'Quit your shift.',
          'Ask a coworker to do it instead.',
        ],
        correct: 1,
      },
    ],
  },
  {
    id: 'ppe',
    title: 'PPE Rules',
    description: 'Personal protective equipment — what to wear and when.',
    required: true,
    estimatedMinutes: 5,
    content:
`PPE means Personal Protective Equipment. It is required, not optional.

Minimum PPE for every shift:
- Cut-resistant gloves
- Closed-toe, non-slip shoes
- Eye protection when sorting or handling unknown bags
- High-visibility vest in loading-dock or vehicle areas

Specialty PPE when needed:
- N95 mask: dusty intake, mold or odor concerns
- Chemical-resistant gloves: handling cleaning agents
- Hard hat: any area with overhead work
- Hearing protection: near compactors or balers

Inspect your PPE before each shift. Replace anything torn, worn, or contaminated.
Damaged PPE protects no one.`,
    acknowledgmentText:
      'I will wear required PPE during every shift and replace damaged equipment before starting work.',
    passingScore: 67,
    quizQuestions: [
      {
        q: 'Which PPE is required for every shift?',
        options: [
          'Cut-resistant gloves and closed-toe shoes (minimum).',
          'Just a t-shirt.',
          'A hard hat only when sorting.',
          'PPE is optional in indoor areas.',
        ],
        correct: 0,
      },
      {
        q: 'You notice your gloves are torn. What do you do?',
        options: [
          'Tape them and keep working.',
          'Replace them before starting your shift — damaged PPE protects no one.',
          'Skip gloves for today.',
          'Ask a coworker for theirs.',
        ],
        correct: 1,
      },
      {
        q: 'You are sorting bags in a dusty area. Which extra PPE is appropriate?',
        options: [
          'An N95 mask.',
          'No additional PPE needed.',
          'A baseball cap.',
          'Headphones.',
        ],
        correct: 0,
      },
    ],
  },
  {
    id: 'hazmat',
    title: 'Hazardous Material Awareness',
    description: 'Recognize hazardous materials, never handle them, escalate immediately.',
    required: true,
    estimatedMinutes: 7,
    content:
`Hazardous materials show up in recycling streams more often than you might expect.
Your job is NOT to handle them. Your job is to RECOGNIZE them and STOP.

Common hazards in a warehouse intake stream:
- Chemicals, solvents, paint, automotive fluids
- Aerosol cans (especially partially full)
- Batteries (lithium-ion batteries can catch fire)
- Medical waste — sharps, syringes, blood-stained materials
- Pressurized containers
- Unknown liquids — anything leaking from a bag

The protocol when you see a hazard:
1. STOP. Do not touch the bag again.
2. Mark the area — cone or wet floor sign — so others stay clear.
3. Photograph the bag in place if it is safe to do so from a distance.
4. Notify your supervisor immediately. Use radio or phone — do not leave the area unattended.
5. Do not move the bag. Do not open it. Do not "see if it's really hazardous."

Your supervisor will follow the hazmat response procedure. You did your job by stopping.`,
    acknowledgmentText:
      'I will stop work, mark the area, photograph from a safe distance, and escalate hazardous materials to my supervisor. I will never attempt to handle unknown hazardous materials.',
    passingScore: 67,
    quizQuestions: [
      {
        q: 'A bag is leaking a dark liquid with a strong chemical smell. What do you do FIRST?',
        options: [
          'Open it to see what is inside.',
          'Stop, do not touch it, mark the area, and notify your supervisor.',
          'Carry it outside to ventilate the smell.',
          'Mix it with a sealing material.',
        ],
        correct: 1,
      },
      {
        q: 'You see a lithium-ion battery in a recycling bag. What is the rule?',
        options: [
          'Toss it in the regular recycling stream.',
          'Crush it to deactivate it.',
          'Stop, isolate it, and escalate to your supervisor for hazmat handling.',
          'Put it back in the bag.',
        ],
        correct: 2,
      },
      {
        q: 'A bag contains needles and you can see them through a tear. What do you do?',
        options: [
          'Pick them out by hand.',
          'Reseal the bag with tape.',
          'STOP. Mark the area. Escalate as a RED bag — medical waste / sharps.',
          'Wear thicker gloves and continue.',
        ],
        correct: 2,
      },
    ],
  },
  {
    id: 'qr_scanning',
    title: 'QR Bag Scanning',
    description: 'How to scan QR-coded bags accurately and what to do when scans fail.',
    required: true,
    estimatedMinutes: 6,
    content:
`Every bag in our system has a QR code that links the bag to the consumer who filled it, the driver who picked it up, and the recycling stream it belongs to. Accurate scans are the foundation of everything downstream — earnings, audits, contamination tracking.

The scanning workflow:
1. Find the QR code on the bag's label. It is usually on a tear-resistant tag tied to the drawstring.
2. Scan with the warehouse intake station scanner or the mobile app camera.
3. Wait for the confirmation tone or the green check on screen.
4. Move the bag to the assigned bin based on the on-screen instruction (Green/Yellow/Red).

Common scan failures:
- Label torn or smudged — try scanning a clear corner. If it still fails, mark the bag YELLOW.
- Label missing entirely — mark the bag YELLOW. Supervisor decides whether to accept or return.
- Scanner unable to focus — clean the lens, increase lighting, try a fresh angle.
- App says "already scanned" — flag it. Either a duplicate scan or a duplicated QR.

Never make up a QR code. Never enter a code manually unless your supervisor instructs you to.`,
    acknowledgmentText:
      'I will scan every bag accurately, mark scan failures as YELLOW for supervisor review, and never fabricate or guess QR codes.',
    passingScore: 67,
    quizQuestions: [
      {
        q: 'The QR code on a bag is smudged and will not scan. What do you do?',
        options: [
          'Make up a code and enter it manually.',
          'Mark the bag YELLOW for supervisor review.',
          'Discard the bag.',
          'Process it as if it scanned successfully.',
        ],
        correct: 1,
      },
      {
        q: 'After scanning, the app says "already scanned." What does this mean?',
        options: [
          'You can ignore it and continue.',
          'It is likely a duplicate scan or a duplicated QR — flag it to your supervisor.',
          'Scan it three more times.',
          'Throw out the original bag.',
        ],
        correct: 1,
      },
      {
        q: 'What does an accurate QR scan affect?',
        options: [
          'Nothing important.',
          'The consumer\'s earnings, the audit trail, and contamination tracking.',
          'Only the warehouse layout.',
          'The driver\'s schedule for tomorrow.',
        ],
        correct: 1,
      },
    ],
  },
  {
    id: 'bag_inspection',
    title: 'Green / Yellow / Red Bag Inspection',
    description: 'How to triage every bag during intake using the three-status system.',
    required: true,
    estimatedMinutes: 8,
    content:
`Every bag is sorted into Green, Yellow, or Red based on what you see during intake.

GREEN — Accepted immediately.
The bag is sealed, the QR is readable, no contamination is visible, no hazardous materials, and the weight feels safe to handle. Process the bag and move on.

YELLOW — Needs review.
Anything uncertain. A torn bag, a wet bag, a partial label, possible contamination, an unreadable QR, or weight that seems off. Do not reject — flag the bag and let your supervisor decide. YELLOW is not a problem; it is the system working correctly.

RED — Rejected and escalated.
Anything dangerous. Hazardous materials, medical waste, biohazard symbols, chemicals, needles, ammunition, explosives, illegal substances, strong odors, leaking bags with unknown contents, or any unsafe condition. STOP. Mark the area. Photograph the bag from a safe distance. Notify your supervisor immediately. RED bags require supervisor sign-off before any further action.

The golden rule: when in doubt, go up one level. A questionable GREEN becomes a YELLOW. A questionable YELLOW becomes a RED. Over-caution is never punished here.`,
    acknowledgmentText:
      'I understand the Green / Yellow / Red bag inspection system. I will escalate every uncertain bag and require supervisor sign-off on every RED bag before any further action.',
    passingScore: 67,
    quizQuestions: [
      {
        q: 'A bag is sealed, the QR reads cleanly, and you see no contamination. What status?',
        options: ['Red', 'Yellow', 'Green', 'Skip it'],
        correct: 2,
      },
      {
        q: 'A bag has a partial label and is slightly damp. The contents look normal. What status?',
        options: ['Red', 'Yellow — let the supervisor decide', 'Green', 'Hide it'],
        correct: 1,
      },
      {
        q: 'A bag has a biohazard symbol on it. What do you do?',
        options: [
          'Process it as Green since the bag is sealed.',
          'Open it and check.',
          'Mark it RED, photograph it, and escalate to your supervisor immediately.',
          'Mark it Yellow and continue.',
        ],
        correct: 2,
      },
    ],
  },
  {
    id: 'commercial_load',
    title: 'Commercial Load Receiving',
    description: 'How to receive, verify, and intake a commercial driver delivery.',
    required: true,
    estimatedMinutes: 6,
    content:
`Commercial deliveries are larger and have a different workflow than consumer drop-offs.

When a commercial driver arrives:
1. Confirm the delivery against the expected loads list. Open the warehouse app and check the dispatch.
2. Verify the driver's identity and account match the dispatch record.
3. Walk the load before unloading. Look for obvious damage, leaks, or hazards.
4. Direct the driver to the assigned dock or bay based on material type and capacity.
5. Sign the intake. Do not sign unless the load matches the manifest.

What to flag:
- Manifest mismatch (wrong material, wrong account, wrong driver)
- Visible damage or contamination
- Hazardous material concerns (escalate as RED)
- Overweight load — the bay may not be rated for the actual weight

You are the gatekeeper. If something is wrong on intake, it costs the company much less than discovering it after processing.`,
    acknowledgmentText:
      'I will verify every commercial load against the manifest, walk it before unloading, and flag mismatches or hazards to my supervisor before signing.',
    passingScore: 67,
    quizQuestions: [
      {
        q: 'A commercial driver arrives. What is your FIRST step?',
        options: [
          'Sign the intake immediately.',
          'Confirm the delivery against the expected loads list and verify driver identity.',
          'Send them away.',
          'Begin unloading.',
        ],
        correct: 1,
      },
      {
        q: 'The manifest says 12 totes of cardboard but you see 8 totes plus 4 bags of mixed plastic. What do you do?',
        options: [
          'Sign anyway — close enough.',
          'Flag the mismatch to your supervisor before signing.',
          'Make up a new manifest.',
          'Refuse the delivery without telling anyone.',
        ],
        correct: 1,
      },
      {
        q: 'You see liquid leaking from one tote during walk-around. What do you do?',
        options: [
          'Sign and let processing deal with it.',
          'Stop, mark the area, escalate as a potential RED bag, and do not sign.',
          'Mop it up and continue.',
          'Tell the driver to bring it back next week.',
        ],
        correct: 1,
      },
    ],
  },
  {
    id: 'driver_dropoff',
    title: 'Driver Drop-Off Verification',
    description: 'How to verify and process a consumer-route driver drop-off.',
    required: true,
    estimatedMinutes: 5,
    content:
`Consumer-route drivers drop off bags collected from individual households throughout the day.

Verification workflow:
1. Greet the driver and ask for their route ID. Cross-check with the day's dispatch.
2. Count the bags. The driver app shows expected count.
3. Spot-check a sample for QR readability and obvious issues.
4. If counts match and spot-check passes, accept the drop-off and confirm in the app.
5. The driver app updates the manifest and assigns earnings credit.

If counts do NOT match:
- Recount with the driver present.
- If the recount confirms the discrepancy, log the difference in the app.
- Do not argue with the driver. Log facts and let supervisors reconcile.

Spot-check failures (multiple bags with unreadable QR, multiple Yellow/Red indicators) should also be logged so dispatch can address route issues.`,
    acknowledgmentText:
      'I will verify route ID, count bags, spot-check QR readability, and log discrepancies in the app rather than arguing with the driver.',
    passingScore: 67,
    quizQuestions: [
      {
        q: 'The driver says 47 bags. You count 45. What do you do?',
        options: [
          'Sign for 47 to keep the driver happy.',
          'Sign for 45 without telling anyone.',
          'Recount with the driver present, and if the discrepancy confirms, log it in the app.',
          'Send the driver away.',
        ],
        correct: 2,
      },
      {
        q: 'Five bags in a row have unreadable QR codes. What does this likely mean?',
        options: [
          'A route issue worth logging so dispatch can address it.',
          'Normal — ignore it.',
          'The driver is dishonest.',
          'Discard those bags.',
        ],
        correct: 0,
      },
      {
        q: 'You disagree with the driver over a count. What is the right move?',
        options: [
          'Argue until one of you backs down.',
          'Recount, log the facts, and let supervisors reconcile.',
          'Fight about it on radio.',
          'Refuse to sign anything.',
        ],
        correct: 1,
      },
    ],
  },
  {
    id: 'equipment',
    title: 'Equipment Awareness',
    description: 'Forklifts, balers, compactors, conveyors — recognize, respect, never improvise.',
    required: true,
    estimatedMinutes: 6,
    content:
`The warehouse uses several pieces of powered equipment. You must be specifically trained and authorized to operate each one. Awareness is required for everyone.

Equipment you may encounter:
- Forklifts and pallet jacks — operators have right-of-way; make eye contact before crossing their path
- Balers — compress recycling into bales; never reach into a baler; never bypass safety interlocks
- Compactors — same rule, more force; lockout/tagout before maintenance
- Conveyors — never reach over a moving belt; emergency stops are on every section
- Loading-dock plates and levelers — yellow and black striping is not decoration; stay clear

If you are not authorized to operate a piece of equipment, do not operate it. Even in an emergency, do not improvise.

Lockout / tagout: any time a machine is being serviced or cleared, the power must be locked out and tagged. If you see a lockout tag, do not remove it. The person whose name is on the tag is the only one who removes it.`,
    acknowledgmentText:
      'I will only operate equipment I am trained and authorized for. I will respect lockout/tagout tags. I will not improvise around safety interlocks.',
    passingScore: 67,
    quizQuestions: [
      {
        q: 'You are not trained on the baler but it has a jam. What do you do?',
        options: [
          'Reach in and clear it.',
          'Find a trained operator. Do not improvise.',
          'Bypass the safety interlock.',
          'Hit it with a wrench.',
        ],
        correct: 1,
      },
      {
        q: 'You see a lockout tag on a conveyor with another worker\'s name. What do you do?',
        options: [
          'Remove it so you can use the conveyor.',
          'Ignore it.',
          'Leave it alone. Only the person on the tag removes it.',
          'Sign your own name over theirs.',
        ],
        correct: 2,
      },
      {
        q: 'A forklift is reversing toward where you need to walk. What do you do?',
        options: [
          'Cross quickly behind it.',
          'Wait, make eye contact with the operator, and cross only when acknowledged.',
          'Yell loudly.',
          'Wave your arms.',
        ],
        correct: 1,
      },
    ],
  },
  {
    id: 'incident',
    title: 'Incident Reporting',
    description: 'How to report safety incidents, near-misses, and hazards.',
    required: true,
    estimatedMinutes: 5,
    content:
`Every incident — even minor — gets reported. So do near-misses. Reporting is how the warehouse learns and improves.

What counts as an incident:
- Injury, even minor (cut, slip, strain)
- Property or equipment damage
- Spill or chemical release
- Near-miss (something almost happened — somebody almost got hurt)
- Hazardous material discovery
- Security incident (theft, trespass, unsafe person on site)

How to report:
1. Stop. Make sure no one is in immediate danger.
2. Notify your supervisor immediately. By radio or in person — not by text.
3. Use the incident report form in the warehouse app. Fill out: what happened, where, when, who was involved, what you did about it, any photos.
4. Do not speculate or assign blame. Stick to what you saw and did.
5. Submit before you leave for the day.

Late reports are still reports. A late report is always better than no report.`,
    acknowledgmentText:
      'I will report every incident and near-miss to my supervisor and submit an incident report before leaving for the day.',
    passingScore: 67,
    quizQuestions: [
      {
        q: 'You almost slipped on a wet spot but caught yourself. Do you report this?',
        options: [
          'No, nothing happened.',
          'Yes — near-misses get reported so the warehouse can fix the hazard before someone gets hurt.',
          'Only if a supervisor saw it.',
          'Tell a coworker but not management.',
        ],
        correct: 1,
      },
      {
        q: 'You forgot to file an incident report yesterday. What do you do today?',
        options: [
          'Skip it — too late.',
          'File it today. A late report is always better than no report.',
          'Make up the date.',
          'Wait for someone to ask.',
        ],
        correct: 1,
      },
      {
        q: 'When filling out an incident report, what should you focus on?',
        options: [
          'Speculation about whose fault it was.',
          'Facts: what you saw, what you did, where, when, who was involved.',
          'A story that makes you look good.',
          'Nothing — keep it vague.',
        ],
        correct: 1,
      },
    ],
  },
  {
    id: 'data_security',
    title: 'Data Security',
    description: 'Protect consumer, driver, and account information at all times.',
    required: true,
    estimatedMinutes: 5,
    content:
`The warehouse app shows information about consumers, drivers, and commercial accounts. This information is confidential.

Rules that always apply:
- Do not share account information with anyone outside the company.
- Do not share screenshots of the warehouse app with anyone — friends, family, social media.
- Lock your tablet or workstation whenever you step away.
- Do not write down passwords. Use the company password manager.
- If you receive a suspicious email or message asking for account information, do not respond. Forward to your supervisor.
- If you suspect your login has been compromised, change your password immediately and notify your supervisor.

If you see something concerning in the app — an account that looks fraudulent, repeated suspicious activity, anything off — flag it. Do not investigate on your own. That is a security team job.

Your access is logged. Activity in the warehouse app is auditable.`,
    acknowledgmentText:
      'I will protect consumer, driver, and account information. I will not share screenshots or credentials. I will report suspicious activity to my supervisor rather than investigating myself.',
    passingScore: 67,
    quizQuestions: [
      {
        q: 'A friend asks for a screenshot of the warehouse app "just to see what it looks like." What do you do?',
        options: [
          'Send it — it is harmless.',
          'Decline. Warehouse app data is confidential and screenshots are not shared.',
          'Send a redacted version.',
          'Post it to social media.',
        ],
        correct: 1,
      },
      {
        q: 'You suspect your login has been compromised. What do you do FIRST?',
        options: [
          'Wait and see what happens.',
          'Change your password immediately and notify your supervisor.',
          'Tell coworkers but not management.',
          'Ignore it.',
        ],
        correct: 1,
      },
      {
        q: 'You step away from your workstation for a quick break. What do you do?',
        options: [
          'Leave it logged in — you\'ll be right back.',
          'Lock the workstation.',
          'Turn off the screen only.',
          'Ask a coworker to watch it.',
        ],
        correct: 1,
      },
    ],
  },
  {
    id: 'environmental',
    title: 'Environmental Compliance',
    description: 'Why proper sorting matters for environmental outcomes and regulatory compliance.',
    required: true,
    estimatedMinutes: 4,
    content:
`The whole point of this work is to keep recyclable materials out of landfills and to make sure they reach the right downstream processor. Sorting accuracy is not a nice-to-have — it is the product.

Why this matters:
- Contaminated loads (recyclables mixed with trash or with the wrong material type) are often rejected by downstream processors and sent to landfill — wasting everyone's effort.
- Proper sorting is part of how Cyan's Brooklynn Recycling reports environmental impact and meets municipal and state recycling regulations.
- Recurring contamination from a route can result in that route losing its recyclables contract.

What this means for your shift:
- Sort accurately. When unsure of a material, ask. Do not guess.
- Treat YELLOW bags as a chance to fix sorting problems early.
- Flag recurring issues (a route or account with repeated contamination) so account managers can address them.

The work you do here is the difference between a recycled bottle and a bottle in a landfill.`,
    acknowledgmentText:
      'I understand that accurate sorting is the core product of this work. I will sort accurately, ask when uncertain, and flag recurring contamination patterns to my supervisor.',
    passingScore: 67,
    quizQuestions: [
      {
        q: 'What happens to a contaminated load at a downstream processor?',
        options: [
          'It is processed normally.',
          'It is often rejected and sent to landfill — wasting the recycling effort.',
          'It is cleaned automatically.',
          'It is sold at a discount.',
        ],
        correct: 1,
      },
      {
        q: 'You see repeated contamination from one specific route over several days. What do you do?',
        options: [
          'Ignore it.',
          'Flag the pattern to your supervisor so account managers can address the route.',
          'Sort it all yourself silently.',
          'Send the bags back.',
        ],
        correct: 1,
      },
      {
        q: 'You are unsure whether a material belongs in the plastic stream or general waste. What do you do?',
        options: [
          'Guess and move on.',
          'Throw it out.',
          'Ask a supervisor — do not guess.',
          'Take it home.',
        ],
        correct: 2,
      },
    ],
  },
  {
    id: 'emergency',
    title: 'Emergency Procedures',
    description: 'Fire, medical, evacuation, and active-threat response.',
    required: true,
    estimatedMinutes: 6,
    content:
`Every shift you should know two things: where the nearest emergency exit is, and where the meeting point outside the building is.

Fire:
1. Pull the nearest alarm.
2. Evacuate using the nearest safe exit.
3. Do NOT use elevators.
4. Walk to the designated outdoor meeting point.
5. Do not re-enter the building until cleared by emergency responders.
6. Account for your team — let your supervisor know you made it out.

Medical:
1. Call for help. Use the radio: "MEDICAL, [location]."
2. Do not move the person unless they are in immediate danger.
3. Stay with them until trained help arrives.
4. If you have first-aid training, provide care within your training.
5. Report the incident in the app after the situation is stable.

Evacuation (non-fire — chemical, gas leak, etc.):
1. Same exits, same meeting point.
2. Move calmly, do not run.
3. Help anyone with mobility limitations.

Active threat (unsafe person, weapon, violent situation):
1. Run if you can safely escape.
2. Hide if you cannot escape — pick a location that locks or blocks.
3. Fight only as a last resort.
4. Call 911 as soon as it is safe.
5. Do not return to the building until cleared by law enforcement.

Know your exits. Know your meeting point. Know your supervisor's radio call sign.`,
    acknowledgmentText:
      'I know my nearest emergency exit and the outdoor meeting point. I will follow the fire, medical, evacuation, and active-threat procedures and will not improvise during an emergency.',
    passingScore: 67,
    quizQuestions: [
      {
        q: 'A fire alarm goes off. What do you do?',
        options: [
          'Take the elevator down.',
          'Walk to the nearest safe exit, then to the outdoor meeting point. Do not use elevators.',
          'Finish the bag you are sorting first.',
          'Wait for someone to tell you to leave.',
        ],
        correct: 1,
      },
      {
        q: 'A coworker collapses. What do you do FIRST?',
        options: [
          'Move them to a comfortable spot.',
          'Call for help on the radio: "MEDICAL, [location]." Do not move them unless in immediate danger.',
          'Take a picture.',
          'Continue your shift.',
        ],
        correct: 1,
      },
      {
        q: 'An unsafe person enters the warehouse with what appears to be a weapon. What is the priority order?',
        options: [
          'Fight first.',
          'Run if safe, hide if not, fight only as last resort. Call 911 as soon as safe.',
          'Confront them and ask them to leave.',
          'Hide first, always.',
        ],
        correct: 1,
      },
    ],
  },
]

// ── Acknowledgments / agreements ─────────────────────────────────────────────

export const WAREHOUSE_ACKNOWLEDGMENTS: WarehouseAcknowledgment[] = [
  {
    id: 'warehouse_operations_agreement',
    title: 'Warehouse Operations Agreement',
    required: true,
    body:
`I acknowledge that I am being onboarded as a warehouse staff member at Cyan's Brooklynn Recycling Enterprise LLC. I understand the operational expectations of the warehouse role I have been assigned, including following supervisor instructions, recording all activity in the warehouse app, and reporting to my assigned shift.`,
  },
  {
    id: 'safety_policy',
    title: 'Safety Policy',
    required: true,
    body:
`I will follow all warehouse safety procedures, wear required PPE, stop work when conditions are unsafe, and report hazards to my supervisor immediately. I understand that I will not be penalized for stopping work I reasonably believe to be unsafe.`,
  },
  {
    id: 'ppe_policy',
    title: 'PPE Policy',
    required: true,
    body:
`I will wear required Personal Protective Equipment during every shift, inspect my PPE before use, and replace any damaged or worn PPE before starting work. I will use additional task-specific PPE when required.`,
  },
  {
    id: 'hazmat_awareness',
    title: 'Hazardous Material Awareness',
    required: true,
    body:
`I will not handle unknown hazardous materials. I will stop work, mark the area, photograph the material from a safe distance, and escalate to my supervisor immediately when I encounter or suspect hazardous materials, including chemicals, batteries, sharps, biohazards, or any leaking unidentified substance.`,
  },
  {
    id: 'confidentiality',
    title: 'Confidentiality Agreement',
    required: true,
    body:
`I will protect consumer, driver, and commercial account information that I access through the warehouse app. I will not share account information, screenshots, or credentials with anyone outside Cyan's Brooklynn Recycling. I understand that warehouse app access is logged and auditable.`,
  },
  {
    id: 'technology_usage',
    title: 'Technology Usage Policy',
    required: true,
    body:
`I will use company-provided devices and software only for work-related activities. I will lock workstations when I step away, use the company password manager rather than writing passwords down, and report suspicious emails or messages requesting account information to my supervisor.`,
  },
  {
    id: 'incident_reporting',
    title: 'Incident Reporting Policy',
    required: true,
    body:
`I will report all incidents and near-misses to my supervisor and complete an incident report in the warehouse app before leaving for the day. I will report facts, not speculation, and I understand that timely reporting is required regardless of incident severity.`,
  },
  {
    id: 'code_of_conduct',
    title: 'Code of Conduct',
    required: true,
    body:
`I will treat coworkers, drivers, and the public with respect. I will follow supervisor instructions and warehouse policies. I will not engage in harassment, discrimination, theft, intoxication on shift, or any behavior that creates an unsafe or hostile work environment.`,
  },
  {
    id: 'environmental_compliance',
    title: 'Environmental Compliance Acknowledgment',
    required: true,
    body:
`I understand that accurate sorting of recyclables is the core product of warehouse work and is part of how Cyan's Brooklynn Recycling meets municipal and state recycling regulations. I will sort accurately, ask supervisors when uncertain, and flag recurring contamination issues.`,
  },
]

// ── Certification exam ────────────────────────────────────────────────────────
// Topics: PPE, hazmat, QR scanning, bag inspection, incident reporting,
// emergency response, data security, environmental compliance.
// 16 questions total — 2 per topic — passing score 80%.

export const WAREHOUSE_EXAM_QUESTIONS: WarehouseExamQuestion[] = [
  // PPE
  { id: 'ex_ppe_1', topic: 'PPE', q: 'Which is the minimum PPE for every warehouse shift?',
    options: ['Just gloves', 'Cut-resistant gloves and closed-toe shoes', 'Sandals', 'PPE is optional'], correct: 1 },
  { id: 'ex_ppe_2', topic: 'PPE', q: 'You notice your safety glasses are cracked. What do you do?',
    options: ['Tape them', 'Replace them before starting work', 'Skip them today', 'Borrow a friend\'s'], correct: 1 },

  // Hazardous material
  { id: 'ex_haz_1', topic: 'Hazardous Material', q: 'A bag is leaking dark liquid and smells of chemicals. What is your FIRST action?',
    options: ['Open the bag', 'Stop, do not touch, mark the area, escalate to supervisor', 'Carry it outside', 'Mix in absorbent'], correct: 1 },
  { id: 'ex_haz_2', topic: 'Hazardous Material', q: 'You spot a lithium-ion battery loose in the recycling stream. What is the right move?',
    options: ['Crush it', 'Toss it in plastic recycling', 'Isolate it and escalate as hazmat', 'Take it home'], correct: 2 },

  // QR scanning
  { id: 'ex_qr_1', topic: 'QR Scanning', q: 'A QR code will not scan after multiple attempts. What do you do?',
    options: ['Make up a code', 'Mark the bag YELLOW for supervisor review', 'Discard the bag', 'Skip the bag silently'], correct: 1 },
  { id: 'ex_qr_2', topic: 'QR Scanning', q: 'The app says "already scanned" for a fresh-looking bag. What does this mean?',
    options: ['Continue', 'Likely a duplicate scan or duplicated QR — flag it', 'Scan three more times', 'Discard it'], correct: 1 },

  // Bag inspection
  { id: 'ex_bag_1', topic: 'Bag Inspection', q: 'A bag is torn and slightly wet but contents look normal. What status?',
    options: ['Green', 'Yellow', 'Red', 'Skip'], correct: 1 },
  { id: 'ex_bag_2', topic: 'Bag Inspection', q: 'A bag has a biohazard symbol on it. What status and what action?',
    options: ['Green — process', 'Yellow — review', 'Red — stop, photograph, escalate, supervisor sign-off', 'Skip'], correct: 2 },

  // Incident reporting
  { id: 'ex_inc_1', topic: 'Incident Reporting', q: 'You almost slipped but caught yourself. Do you report?',
    options: ['No — nothing happened', 'Yes — near-misses are reported', 'Only if a supervisor saw', 'Tell a coworker only'], correct: 1 },
  { id: 'ex_inc_2', topic: 'Incident Reporting', q: 'You forgot to file an incident report yesterday. What do you do?',
    options: ['Skip it', 'File it today — late reports beat no reports', 'Backdate it falsely', 'Wait for someone to ask'], correct: 1 },

  // Emergency response
  { id: 'ex_em_1', topic: 'Emergency Response', q: 'The fire alarm sounds. What is the correct move?',
    options: ['Take the elevator', 'Walk to the nearest safe exit, then to the outdoor meeting point', 'Finish your current bag first', 'Wait for instructions'], correct: 1 },
  { id: 'ex_em_2', topic: 'Emergency Response', q: 'A coworker collapses on the floor. What is the FIRST step?',
    options: ['Move them to a chair', 'Call for help on radio: "MEDICAL, [location]"', 'Take a photo', 'Continue your work'], correct: 1 },

  // Data security
  { id: 'ex_ds_1', topic: 'Data Security', q: 'A friend asks for a screenshot of the warehouse app. What do you do?',
    options: ['Send it', 'Decline — warehouse data is confidential', 'Send a redacted version', 'Post it publicly'], correct: 1 },
  { id: 'ex_ds_2', topic: 'Data Security', q: 'You are stepping away from your workstation for a quick break. What do you do?',
    options: ['Leave it logged in', 'Lock the workstation', 'Turn off the screen only', 'Ask someone to watch'], correct: 1 },

  // Environmental compliance
  { id: 'ex_env_1', topic: 'Environmental Compliance', q: 'You are unsure if a material belongs in plastic or general waste. What do you do?',
    options: ['Guess', 'Throw it out', 'Ask a supervisor — do not guess', 'Send it home'], correct: 2 },
  { id: 'ex_env_2', topic: 'Environmental Compliance', q: 'What is the consequence of a contaminated recycling load at a downstream processor?',
    options: ['It is processed normally', 'Often rejected and sent to landfill — wasting the recycling effort', 'It is sold cheaper', 'Nothing'], correct: 1 },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

export function getModuleById(id: string): WarehouseTrainingModule | undefined {
  return WAREHOUSE_TRAINING_MODULES.find(m => m.id === id)
}

export function getExamQuestionsByTopic(): Record<string, WarehouseExamQuestion[]> {
  const out: Record<string, WarehouseExamQuestion[]> = {}
  WAREHOUSE_EXAM_QUESTIONS.forEach(q => {
    if (!out[q.topic]) out[q.topic] = []
    out[q.topic].push(q)
  })
  return out
}

export function scoreExam(answers: Record<string, number>): { score: number; passed: boolean; correct: number; total: number } {
  const total = WAREHOUSE_EXAM_QUESTIONS.length
  let correct = 0
  for (const q of WAREHOUSE_EXAM_QUESTIONS) {
    if (answers[q.id] === q.correct) correct++
  }
  const score = Math.round((correct / total) * 100)
  return { score, passed: score >= EXAM_PASSING_SCORE_PCT, correct, total }
}

export function scoreModuleQuiz(
  module: WarehouseTrainingModule,
  answers: Record<number, number>
): { score: number; passed: boolean; correct: number; total: number } {
  const total = module.quizQuestions.length
  let correct = 0
  module.quizQuestions.forEach((q, idx) => {
    if (answers[idx] === q.correct) correct++
  })
  const score = total === 0 ? 100 : Math.round((correct / total) * 100)
  return { score, passed: score >= module.passingScore, correct, total }
}
