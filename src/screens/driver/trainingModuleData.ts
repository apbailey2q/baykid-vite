// trainingModuleData.ts — Content for Driver Compliance Training Modules.
//
// Exports two training programs:
//   CONSUMER_TRAINING_MODULES — 5 modules for residential/consumer drivers
//   COMMERCIAL_TRAINING_MODULES — Commercial route drivers receive the approved commercial training set for the active training version.
//
// Use getTrainingModules(isCommercial) to retrieve the correct set.
//
// Reading level: ~5th grade (short sentences, plain words, concrete examples).
// Each module has: summary, why it matters, must-do, must-not-do, examples,
// outcomes, and a 4-question multiple-choice quiz.
//
// The quiz `correct` field is 0-based index into `options`.

export interface QuizQuestion {
  q:       string
  options: string[]
  correct: number   // 0-based
}

// ── Video content types ───────────────────────────────────────────────────────

/** One scene in a training video storyboard. */
export interface VideoScene {
  scene:         number
  visual:        string   // what is shown on screen
  voiceover:     string   // what the narrator says
  onScreenText:  string   // overlay text / subtitle
  durationSecs:  number   // approximate scene length in seconds
}

/** Structured voiceover script for a training video. */
export interface VideoScript {
  opening:         string
  lesson:          string
  realExample:     string
  mistakeToAvoid:  string
  positiveOutcome: string
  closingReminder: string
}

/** Full video training content for one module. */
export interface TrainingVideoContent {
  estimatedMinutes: number
  script:           VideoScript
  storyboard:       VideoScene[]
}

// ── Module interface ──────────────────────────────────────────────────────────

export interface TrainingModuleContent {
  key:             string   // consumer: 'safety'|'qr_bag'|'pickup'|'customer'|'photo'
                            // commercial: 'comm_safety'|'comm_containers'|'comm_pickup'|'comm_site_contact'|'comm_photo'
  title:           string
  icon:            string
  summary:         string
  whyMatters:      Array<{ who: string; text: string }>
  mustDo:          string[]
  mustNotDo:       string[]
  examples:        string[]
  positiveOutcome: string
  negativeOutcome: string
  quiz:            QuizQuestion[]
  // Populated by getTrainingModules() — absent if video data not loaded
  estimatedMinutes?: number
  video?:            TrainingVideoContent
}

/**
 * Returns the correct training module set (with video data merged in) for this driver type.
 *
 * CONSUMER_VIDEO_DATA / COMMERCIAL_VIDEO_DATA are declared at the END of this file.
 * This works because getTrainingModules() is only ever called at runtime (after the
 * module has fully initialized), so the constants are always available by call time.
 */
export function getTrainingModules(isCommercial: boolean): TrainingModuleContent[] {
  const base = isCommercial ? COMMERCIAL_TRAINING_MODULES : CONSUMER_TRAINING_MODULES
  const vids = isCommercial ? COMMERCIAL_VIDEO_DATA : CONSUMER_VIDEO_DATA
  return base.map(m => {
    const v = vids[m.key]
    return v ? { ...m, estimatedMinutes: v.estimatedMinutes, video: v } : m
  })
}


// ═══════════════════════════════════════════════════════════════════════════════
// CONSUMER TRAINING MODULES — Residential/1099 drivers only
// ═══════════════════════════════════════════════════════════════════════════════

export const CONSUMER_TRAINING_MODULES: TrainingModuleContent[] = [
  // ── Module 1: Safety ─────────────────────────────────────────────────────────
  {
    key:   'safety',
    title: 'Safety Training',
    icon:  '🦺',
    summary:
      'This module teaches you how to stay safe on every pickup. ' +
      'Safety comes first — before any bag, before any route. ' +
      'You need to protect yourself from injuries and from dangerous materials. ' +
      'A safe driver is a trusted driver.',

    whyMatters: [
      {
        who:  'You',
        text: 'If you get hurt, it can affect your health and your income. Knowing the rules keeps you safe every shift.',
      },
      {
        who:  'The Customer',
        text: 'A safe driver handles materials carefully and does not create a mess or danger near a customer\'s home.',
      },
      {
        who:  'The Company',
        text: 'Unsafe drivers create legal problems and damage the company\'s reputation. Safe drivers protect everyone.',
      },
      {
        who:  'The Public',
        text: 'Hazardous waste handled incorrectly can hurt neighbors, bystanders, and people nearby.',
      },
      {
        who:  'The Environment',
        text: 'Chemicals, batteries, and medical waste must never enter the regular recycling stream. Proper handling protects the environment.',
      },
    ],

    mustDo: [
      'Wear gloves on every pickup.',
      'Wear closed-toe shoes on every shift.',
      'Lift heavy bags by bending your knees — not your waist.',
      'Check each bag before picking it up. Look for leaks, damage, or strange smells.',
      'Watch for traffic before you step out of your vehicle.',
      'Keep your vehicle clean and free of spills.',
      'Report any injury right away through the app or to your supervisor.',
      'If you see needles, blood, chemicals, or anything dangerous — stop, do NOT touch it, and report it.',
    ],

    mustNotDo: [
      'Never touch loose trash with your bare hands.',
      'Never pick up a bag that is leaking, smells like chemicals, or has sharp objects sticking out.',
      'Never pick up hazardous waste (needles, batteries, paint, gasoline, medical waste, dead animals) unless admin specifically approves it.',
      'Never ignore an injury — even a small cut or scrape should be reported.',
      'Never work while feeling dizzy, sick, or unsafe.',
      'Never rush through pickups so fast that you skip safety checks.',
    ],

    examples: [
      '🛑 You arrive at a pickup and the bag is leaking a dark liquid that smells strange. You do NOT pick it up. You take a photo, mark it "Unsafe Bag" in the app, and report it before moving on.',
      '🛑 You see a plastic bag with a needle sticking out the side. You do NOT touch it. You mark it as hazardous and report it to admin.',
      '✅ You are lifting a very heavy bag. Instead of yanking it up with your arms, you bend your knees and lift with your legs to protect your back.',
      '✅ Before stepping out of your vehicle, you check both ways for traffic. This takes two seconds and could save your life.',
      '✅ While picking up a bag, you cut your finger on broken glass inside. You report it right away and clean the cut properly.',
    ],

    positiveOutcome:
      'When you follow safety rules on every pickup, you protect yourself from injury, you protect customers from risk, ' +
      'and you keep the recycling program safe and clean. Safe drivers earn a great reputation and keep their routes.',

    negativeOutcome:
      'If you skip safety steps, you could hurt yourself or others. You may get injured with no way to prove it happened on ' +
      'the job. You could be exposed to dangerous chemicals. You could lose your driving privileges or face legal consequences.',

    quiz: [
      {
        q: 'You arrive at a pickup and the bag is leaking and smells like chemicals. What should you do?',
        options: [
          'Pick it up quickly and get away from the smell.',
          'Mark it as "Unsafe Bag" and report it — do NOT pick it up.',
          'Open the bag to find out what is inside.',
          'Leave without saying anything.',
        ],
        correct: 1,
      },
      {
        q: 'Which of the following is an example of hazardous waste you should NOT touch?',
        options: [
          'A sealed bag of newspaper and cardboard.',
          'A heavy bag of aluminum cans.',
          'A bag with a needle sticking through the outside.',
          'A large bag of plastic bottles.',
        ],
        correct: 2,
      },
      {
        q: 'What is the right way to lift a heavy recycling bag?',
        options: [
          'Bend at the waist and pull with your arms.',
          'Ask the customer to help you carry it.',
          'Bend your knees and lift with your legs.',
          'Drag it across the ground to your vehicle.',
        ],
        correct: 2,
      },
      {
        q: 'What should you always wear on every pickup shift?',
        options: [
          'Sandals and comfortable shorts.',
          'Just gloves — shoes do not really matter.',
          'No special gear is required.',
          'Gloves and closed-toe shoes.',
        ],
        correct: 3,
      },
    ],
  },

  // ── Module 2: QR Bag ─────────────────────────────────────────────────────────
  {
    key:   'qr_bag',
    title: 'QR Bag Scanning',
    icon:  '📱',
    summary:
      'Every recycling bag has a QR code that links it to the customer\'s pickup order. ' +
      'Scanning the QR code before pickup is required — every time, no exceptions. ' +
      'It protects your pay, keeps customer records accurate, and makes sure the right bag ' +
      'matches the right pickup.',

    whyMatters: [
      {
        who:  'You',
        text: 'Scanning proves you completed the pickup. Without a scan, you may not receive credit or pay for that stop.',
      },
      {
        who:  'The Customer',
        text: 'QR tracking lets the customer see their pickup was completed and their bag was handled correctly.',
      },
      {
        who:  'The Company',
        text: 'Every scan creates a record that protects both the driver and the company if there is ever a dispute.',
      },
      {
        who:  'The Public',
        text: 'Accurate bag tracking ensures materials go to the right facility and are actually recycled.',
      },
      {
        who:  'The Environment',
        text: 'Proper tracking makes sure recycled materials are processed correctly — not mixed with regular trash.',
      },
    ],

    mustDo: [
      'Scan the QR code on every bag before picking it up.',
      'Confirm the bag ID in the app matches the bag you are about to pick up.',
      'If the QR code will not scan, report it in the app and follow the manual steps.',
      'If the bag or code looks damaged, take a photo and report it to admin.',
      'If the wrong bag is at the location, report the mismatch — do not take it.',
    ],

    mustNotDo: [
      'Never guess a bag number — always scan it.',
      'Never scan one bag and claim credit for multiple bags. This is fraud.',
      'Never pick up a bag that has not been verified in the app.',
      'Never skip the scan because you are in a hurry.',
      'Never use a bag number from a previous pickup to fill in a missing scan.',
    ],

    examples: [
      '🛑 The QR code on the bag is torn and will not scan. You do NOT take the bag. You photo the damaged code, mark it "QR Code Problem" in the app, and wait for admin guidance.',
      '🛑 The app shows Bag #1042 but the bag outside says #1039. You do NOT take the wrong bag. You report the mismatch so it can be fixed.',
      '✅ You arrive, scan the bag, and the ID matches. You complete the pickup normally. This is how every pickup should go.',
      '🛑 A driver scans one bag but marks two bags as picked up. This is fraud and leads to immediate termination.',
      '✅ The code is covered in mud. You gently clean it off and try again. It scans. You proceed normally.',
    ],

    positiveOutcome:
      'Every successful scan creates a clear record that protects your pay and keeps the whole system honest. ' +
      'Drivers who scan every bag build a reliable record and are trusted with more routes.',

    negativeOutcome:
      'Skipping scans or entering false bag information is fraud. It can result in lost pay, disputes you cannot prove ' +
      'your side of, and termination. There is no shortcut worth that risk.',

    quiz: [
      {
        q: 'What must you do before picking up any bag?',
        options: [
          'Just grab it if it looks like the right one.',
          'Ask the customer what is inside it.',
          'Scan the QR code and confirm the bag ID matches.',
          'Take a photo first and scan later.',
        ],
        correct: 2,
      },
      {
        q: 'The QR code is damaged and will not scan. What do you do?',
        options: [
          'Skip the bag and leave without reporting it.',
          'Scan a different bag to replace it.',
          'Report it in the app and wait for admin guidance.',
          'Write the number down and scan it later.',
        ],
        correct: 2,
      },
      {
        q: 'Is it okay to pick up a bag without scanning it first?',
        options: [
          'Yes, if you are running late.',
          'Yes, if the customer says it is fine.',
          'Yes, if it looks like the right bag.',
          'No — every bag must be verified in the app.',
        ],
        correct: 3,
      },
      {
        q: 'Why does scanning the QR code protect you as a driver?',
        options: [
          'It creates a record proving you completed the pickup.',
          'It does not really help you — it only helps the company.',
          'It is just a rule with no real purpose.',
          'It only matters for commercial pickups.',
        ],
        correct: 0,
      },
    ],
  },

  // ── Module 3: Pickup Procedures ───────────────────────────────────────────────
  {
    key:   'pickup',
    title: 'Pickup Procedures',
    icon:  '📦',
    summary:
      'Pickup procedures are the steps you follow every time you complete a stop — ' +
      'from checking the address to marking the status in the app. ' +
      'Following the right steps every time keeps pickups running smoothly, ' +
      'protects customers, and makes sure you get credit for your work.',

    whyMatters: [
      {
        who:  'You',
        text: 'Correct statuses in the app prove your work and protect you if a customer ever claims their bag was not picked up.',
      },
      {
        who:  'The Customer',
        text: 'Customers trust that their bags will be picked up at the right place and time.',
      },
      {
        who:  'The Company',
        text: 'Pickup records help the company plan routes, resolve complaints, and improve the service.',
      },
      {
        who:  'The Public',
        text: 'Pickups done correctly mean recycling actually gets processed — not lost or mishandled.',
      },
      {
        who:  'The Environment',
        text: 'Proper pickups ensure recyclable materials reach the right facility instead of going to waste.',
      },
    ],

    mustDo: [
      'Check the address before every stop — confirm you are at the right location.',
      'Confirm you are within the correct pickup time window.',
      'Know the difference between consumer pickups (homes) and commercial pickups (businesses).',
      'Pick up bags from the designated spot — usually the curb or marked area.',
      'Mark the correct pickup status in the app right after each attempt.',
      'Take a photo when the app asks for one, or whenever there is a problem.',
      'Report any unsafe, blocked, or missing bags through the app.',
    ],

    mustNotDo: [
      'Never go inside a customer\'s home or business unless admin specifically instructs you.',
      'Never assume a pickup is complete without marking it in the app.',
      'Never mark a pickup as "Picked Up" if you did not collect the bag.',
      'Never ignore a problem — always report it.',
      'Never show up outside the time window without checking with admin first.',
    ],

    examples: [
      '✅ You arrive, scan the bag, pick it up, mark it "Picked Up," take a photo, and move to the next stop. This is the correct flow.',
      '🛑 There is no bag at the curb. You mark it "Bag Missing," take a photo of the empty location, and notify admin.',
      '🛑 The bag is blocked by a parked car. You report it as blocked and contact admin — you do not try to reach it unsafely.',
      '🛑 You go to the wrong address. You mark "Wrong Address" in the app and navigate to the correct location.',
      '✅ You arrive at a commercial stop 30 minutes early and they are not open yet. You wait for the time window to begin or contact admin.',
    ],

    positiveOutcome:
      'When every pickup is handled and recorded correctly, customers are happy, the company runs well, ' +
      'and you build a record as a reliable driver. Reliable drivers get more routes and more opportunities.',

    negativeOutcome:
      'Skipping steps, marking pickups wrong, or failing to report problems creates confusion. ' +
      'It can lead to complaints against you, lost pay, or suspension. False records are treated as fraud.',

    quiz: [
      {
        q: 'What should you check first when you arrive at a pickup location?',
        options: [
          'Whether there is a good parking spot nearby.',
          'The address and pickup time window.',
          'How many bags are outside.',
          'Whether the customer is watching.',
        ],
        correct: 1,
      },
      {
        q: 'There is no bag at the pickup location. What do you do?',
        options: [
          'Wait one hour and then leave.',
          'Mark the pickup "Picked Up" and move on.',
          'Mark it "Bag Missing" in the app and notify admin.',
          'Call the customer\'s personal phone number.',
        ],
        correct: 2,
      },
      {
        q: 'Which status do you use when a bag looks dangerous or could be hazardous?',
        options: [
          'Picked Up.',
          'Bag Missing.',
          'Unsafe Bag.',
          'Customer Not Available.',
        ],
        correct: 2,
      },
      {
        q: 'Is it okay to mark a pickup "Picked Up" even if you did not take the bag?',
        options: [
          'Yes, if you planned to come back later.',
          'Yes, if it is a commercial stop.',
          'No — only mark "Picked Up" when you actually collected the bag.',
          'Yes, to keep your completion rate high.',
        ],
        correct: 2,
      },
    ],
  },

  // ── Module 4: Customer Interaction ───────────────────────────────────────────
  {
    key:   'customer',
    title: 'Customer Interaction',
    icon:  '🤝',
    summary:
      'You are the face of Cyan\'s Brooklynn Recycling. Every time you interact with a customer, ' +
      'you represent the company. Being respectful, calm, and professional is required — ' +
      'even when a customer is upset. How you act directly affects the company\'s reputation.',

    whyMatters: [
      {
        who:  'You',
        text: 'Professional behavior protects your job and builds your reputation as a trusted driver.',
      },
      {
        who:  'The Customer',
        text: 'Customers deserve to be treated with respect when they use our service.',
      },
      {
        who:  'The Company',
        text: 'One bad interaction can damage the company\'s reputation and lead to lost customers.',
      },
      {
        who:  'The Public',
        text: 'Drivers in company vehicles are seen by neighbors and community members. Your behavior reflects on all of us.',
      },
      {
        who:  'The Environment',
        text: 'Good customer relationships keep more people engaged in the recycling program — which helps the environment.',
      },
    ],

    mustDo: [
      'Greet customers politely if you see them.',
      'Stay calm if a customer is upset — do not match their anger.',
      'Apologize for problems, even if they were not your fault.',
      'Report issues in the app instead of making promises to customers.',
      'Keep all customer information private — names, addresses, schedules, and photos.',
      'Contact admin or support if you cannot resolve a situation at the pickup.',
    ],

    mustNotDo: [
      'Never argue with a customer, even if you are right.',
      'Never enter a customer\'s home or business without specific admin instruction.',
      'Never ask customers for personal information like phone numbers, emails, or payment.',
      'Never accept cash or tips for extra services unless the company specifically authorizes it.',
      'Never use rude, threatening, or inappropriate language.',
      'Never flirt with or make personal comments to customers.',
      'Never share customer addresses, schedules, or photos with anyone outside the company.',
    ],

    examples: [
      '✅ A customer says: "My bag wasn\'t picked up last week." You say: "I\'m sorry for the inconvenience. I will report this in the app right away." You do not argue — you just log it and move on.',
      '🛑 A customer offers you $40 cash to take extra bags not in the system. You politely decline: "Extra pickups need to go through the app. I can\'t take them today, but our team can set that up."',
      '🛑 A customer asks for their neighbor\'s pickup schedule. You say: "I\'m not able to share other customers\' information. You\'re welcome to contact our support team." Then you move on.',
      '✅ A customer is upset that you cannot take a leaking bag. You say: "For safety, I\'m unable to pick up this bag. I\'ll make a note so our team can follow up with you."',
      '✅ A customer gives you a compliment. You say: "Thank you — I appreciate it!" Then you complete the pickup professionally.',
    ],

    positiveOutcome:
      'Drivers who are calm, respectful, and professional build trust with customers and the company. ' +
      'This leads to better routes, more opportunities, and a strong reputation that follows you throughout your career.',

    negativeOutcome:
      'Rude or unprofessional behavior — even once — can result in customer complaints, removal from routes, ' +
      'suspension, or termination. Your behavior is visible to customers, neighbors, and the community.',

    quiz: [
      {
        q: 'A customer is yelling at you about a missed pickup from last week. What do you do?',
        options: [
          'Yell back and explain that it was not your fault.',
          'Stay calm, apologize, and log the issue in the app.',
          'Drive away without saying anything.',
          'Tell them to call the company themselves.',
        ],
        correct: 1,
      },
      {
        q: 'A customer offers you $20 cash to take extra bags that are not in the system. What do you do?',
        options: [
          'Accept it — it is extra money.',
          'Accept it but do not report it.',
          'Ask for more money before deciding.',
          'Decline politely and explain extra pickups must go through the app.',
        ],
        correct: 3,
      },
      {
        q: 'Is it okay to go inside a customer\'s home to pick up bags if they invite you in?',
        options: [
          'Yes, if they personally invite you.',
          'Yes, if the bags are just inside the front door.',
          'No — you must always stay outside.',
          'Yes, if it is raining outside.',
        ],
        correct: 2,
      },
      {
        q: 'A customer asks you to share their neighbor\'s pickup schedule. What do you do?',
        options: [
          'Look it up in the app and tell them.',
          'Politely decline — customer information is private.',
          'Tell them since they are neighbors so it is probably fine.',
          'Give the neighbor\'s address to be helpful.',
        ],
        correct: 1,
      },
    ],
  },

  // ── Module 5: Photo Verification ─────────────────────────────────────────────
  {
    key:   'photo',
    title: 'Photo Verification',
    icon:  '📷',
    summary:
      'Photos are required for certain pickups as proof that the job was done. ' +
      'A clear, honest photo protects your pay, helps resolve disputes, and gives admins ' +
      'what they need to review any problems. Photos must always be real, current, and taken properly.',

    whyMatters: [
      {
        who:  'You',
        text: 'Photos prove you completed the pickup. Without them, you cannot prove your side of a dispute.',
      },
      {
        who:  'The Customer',
        text: 'Customers trust the system when photos confirm their bag was collected.',
      },
      {
        who:  'The Company',
        text: 'Photos help the company verify work, respond to complaints, and identify safety issues quickly.',
      },
      {
        who:  'The Public',
        text: 'Accurate photo records keep the program trustworthy and transparent.',
      },
      {
        who:  'The Environment',
        text: 'Documented pickups ensure materials are tracked all the way through the recycling process.',
      },
    ],

    mustDo: [
      'Take a photo when the app asks for one.',
      'Take a photo whenever a bag is unsafe, damaged, or cannot be picked up.',
      'Take a photo of an empty location when marking a bag as missing.',
      'Hold the phone steady and make sure there is enough light.',
      'Include the bag or bin clearly in the frame.',
      'Show the pickup location (curb, building entrance, etc.) when possible.',
    ],

    mustNotDo: [
      'Never upload a blurry or unusable photo.',
      'Never photograph children, people\'s faces, or the inside of homes when possible.',
      'Never capture license plates, private documents, or unrelated people.',
      'Never upload a photo from a previous pickup — every photo must be current.',
      'Never upload a fake or edited photo.',
      'Never take inappropriate photos of customers, their property, or their family.',
    ],

    examples: [
      '✅ Correct: A clear, well-lit photo of a sealed recycling bag sitting at the curb.',
      '✅ Correct: A photo of a leaking bag before reporting it as unsafe.',
      '✅ Correct: A photo of an empty pickup location when marking a bag as missing.',
      '❌ Incorrect: A blurry photo where the bag is not clearly visible.',
      '❌ Incorrect: A selfie — the photo should show the bag, not the driver.',
      '❌ Incorrect: A photo of the customer\'s child playing in the front yard.',
      '❌ Incorrect: Reusing a photo from yesterday\'s pickup for today\'s record.',
    ],

    positiveOutcome:
      'Good photos make your job easier. They prove your work, speed up dispute resolution, and show admins ' +
      'that you are a professional, honest driver. Drivers with clear photo records have fewer problems.',

    negativeOutcome:
      'Missing, fake, or inappropriate photos can result in unpaid pickups, disputes you cannot resolve, ' +
      'or suspension. Uploading fake or inappropriate photos is grounds for immediate termination.',

    quiz: [
      {
        q: 'When is a photo required during a pickup?',
        options: [
          'Only when you feel like taking one.',
          'When the app asks for one, or when there is an unsafe or incomplete pickup.',
          'Only during your first week of work.',
          'Never — photos are optional.',
        ],
        correct: 1,
      },
      {
        q: 'What makes a good pickup photo?',
        options: [
          'A selfie showing you were at the location.',
          'A photo of the inside of the bag to show the contents.',
          'A clear, well-lit photo of the bag at the pickup location.',
          'A photo taken from across the street.',
        ],
        correct: 2,
      },
      {
        q: 'What should you try to avoid capturing in pickup photos?',
        options: [
          'The bag or bin.',
          'The curb or pickup area.',
          'The pickup address.',
          'Children\'s faces, license plates, or the inside of someone\'s home.',
        ],
        correct: 3,
      },
      {
        q: 'Is it okay to reuse a photo from a previous pickup if today\'s photo came out blurry?',
        options: [
          'Yes, if the location looks similar.',
          'Yes, if the photo is from the same week.',
          'No — every photo must be real and taken at the time of pickup.',
          'Yes, as long as you note it in the app.',
        ],
        correct: 2,
      },
    ],
  },
]

// ═══════════════════════════════════════════════════════════════════════════════
// COMMERCIAL EMPLOYEE TRAINING MODULES — 10 modules, commercial employees only
// driver_1099 (consumer) drivers must never see these modules.
// ═══════════════════════════════════════════════════════════════════════════════

export const COMMERCIAL_TRAINING_MODULES: TrainingModuleContent[] = [

  // ── Module 1: Company Mission ────────────────────────────────────────────────
  {
    key:   'comm_mission',
    title: 'Company Mission',
    icon:  '♻️',
    summary:
      "Cyan's Brooklynn Recycling exists to make recycling easy and reliable for homes and businesses. " +
      'As a commercial driver, you are the face of the company at every business stop. ' +
      'Understanding our mission helps you make smart decisions that protect the company and the environment.',
    whyMatters: [
      {
        who:  'The Environment',
        text: 'Every bin you pick up correctly keeps recyclable material out of landfills and helps the planet.',
      },
      {
        who:  'The Company',
        text: "Your attitude and professionalism shape how clients see Cyan's Brooklynn Recycling. A good impression earns repeat business.",
      },
    ],
    mustDo: [
      'Represent the company professionally at all times.',
      'Follow pickup procedures on every route — no shortcuts.',
      'Report problems through the app so issues get fixed fast.',
      'Treat every client site like it belongs to someone you respect.',
    ],
    mustNotDo: [
      "Do not share client information — what you see at a business stays confidential.",
      'Do not skip stops without notifying dispatch first.',
      'Do not argue with business staff — escalate to your supervisor.',
      "Do not use the company's name or logo for personal purposes.",
    ],
    examples: [
      "A client asks why their bin wasn't picked up. You calmly explain you're looking into it and report it in the app right away.",
      "You notice a recycling bin is full of trash. You document it with a photo and flag it through the app instead of ignoring it.",
    ],
    positiveOutcome: "Drivers who represent the mission well build client trust, earn route bonuses, and open doors for career growth within the company.",
    negativeOutcome: "Drivers who cut corners or act unprofessionally risk losing client accounts, receiving formal warnings, or being removed from routes.",
    quiz: [
      {
        q:       "What is Cyan's Brooklynn Recycling's main goal?",
        options: [
          'Make recycling easy and reliable for homes and businesses',
          'Deliver packages faster than competitors',
          'Replace city garbage collection services',
          'Only serve residential customers',
        ],
        correct: 0,
      },
      {
        q:       'As a commercial driver, you are the face of the company. What does that mean?',
        options: [
          'Your behavior at every stop affects how clients view the company',
          'You need to wear a uniform with the company logo at all times',
          'You are responsible for signing new client contracts',
          'You must call clients before every pickup',
        ],
        correct: 0,
      },
      {
        q:       'A business client complains about a missed pickup. What should you do?',
        options: [
          'Apologize professionally and report it in the app',
          'Ignore it — dispatch handles all complaints',
          'Blame the previous driver on the route',
          'Promise to make it up by picking up extra bins next visit',
        ],
        correct: 0,
      },
      {
        q:       'You see a recycling bin full of trash at a business stop. What is the right action?',
        options: [
          'Document it with a photo and flag it in the app',
          'Pick it up anyway to avoid a complaint',
          'Leave it and move on without reporting',
          'Call the client directly to let them know',
        ],
        correct: 0,
      },
    ],
  },

  // ── Module 2: Commercial Customer Service ────────────────────────────────────
  {
    key:   'comm_customer',
    title: 'Commercial Customer Service',
    icon:  '🤝',
    summary:
      'Business clients expect a higher level of service than residential customers. ' +
      'You will interact with managers, receiving staff, and site contacts who have strict schedules. ' +
      'How you communicate and handle issues on-site directly affects whether the client renews their contract.',
    whyMatters: [
      {
        who:  'The Client',
        text: 'Business clients pay monthly service fees and expect drivers to be professional, punctual, and easy to work with.',
      },
      {
        who:  'The Company',
        text: 'One rude interaction can end a long-term contract worth thousands of dollars. Every driver protects revenue by being professional.',
      },
    ],
    mustDo: [
      'Greet site contacts politely when you arrive.',
      'Let the site contact know if there is an issue with a container or pickup.',
      'Report conflicts or complaints to your supervisor — never argue on-site.',
      'Complete pickups within the scheduled time window.',
    ],
    mustNotDo: [
      'Do not use your personal phone for personal calls while on a client site.',
      'Do not share one client\'s information with another client.',
      'Do not promise service changes without supervisor approval.',
      'Do not eat, drink, or smoke on client property without explicit permission.',
    ],
    examples: [
      "A restaurant manager asks why the grease bin smells. You explain the pickup schedule and offer to note it for the next service review.",
      "A building super is rude to you. You stay calm, complete the pickup, and report the interaction to your supervisor.",
    ],
    positiveOutcome: 'Professional drivers who build good relationships with business contacts are often requested by name and receive the best route assignments.',
    negativeOutcome: 'Drivers who create conflict with clients risk removal from the route, formal warnings, and possible contract loss for the company.',
    quiz: [
      {
        q:       'A business site contact asks you a question you do not know the answer to. What should you do?',
        options: [
          'Tell them you will find out and report it to your supervisor',
          'Make up an answer so you do not look uninformed',
          'Tell them to call the main office themselves',
          'Ignore the question and finish the pickup',
        ],
        correct: 0,
      },
      {
        q:       'A client manager is rude to you on site. What is the correct response?',
        options: [
          'Stay calm, complete the pickup, and report the interaction to your supervisor',
          'Argue back to stand your ground',
          'Leave the site and report that the pickup was completed',
          'Call dispatch immediately and refuse to continue',
        ],
        correct: 0,
      },
      {
        q:       "Why is it important NOT to share one client's information with another?",
        options: [
          'Client information is confidential and sharing it violates their privacy',
          'Clients might compete with each other for better rates',
          'It is against the law in all cases',
          'Only managers are allowed to share client information',
        ],
        correct: 0,
      },
      {
        q:       'A business client asks you to change their pickup schedule on the spot. What do you do?',
        options: [
          'Tell them you will pass the request to your supervisor',
          'Agree and change the schedule yourself in the app',
          'Tell them changes are not possible',
          'Call the next driver on the route to coordinate',
        ],
        correct: 0,
      },
    ],
  },

  // ── Module 3: Commercial Pickup Procedures ───────────────────────────────────
  {
    key:   'comm_pickup',
    title: 'Commercial Pickup Procedures',
    icon:  '🚛',
    summary:
      'Commercial pickups follow a strict process to protect you, the client, and the environment. ' +
      'You must check in at each site, verify the container, perform the pickup, and document completion. ' +
      'Skipping any step creates liability and causes problems for the next driver on the route.',
    whyMatters: [
      {
        who:  'You',
        text: 'Following the correct procedure protects you from injury and from being blamed for damage or missing material.',
      },
      {
        who:  'The Client',
        text: 'Clients need accurate records of every pickup for their own compliance and billing purposes.',
      },
    ],
    mustDo: [
      'Check in at the site through the app before touching any container.',
      'Confirm the container type and bin code match your route assignment.',
      'Complete the safety check before every lift or move.',
      'Photograph the container before and after service.',
      'Mark the pickup complete in the app before leaving the site.',
    ],
    mustNotDo: [
      'Do not pick up containers not assigned to your route without dispatch approval.',
      'Do not skip the pre-pickup safety check even if you are running late.',
      'Do not mark a pickup complete if you did not actually complete it.',
      'Do not leave material on the ground after a pickup.',
    ],
    examples: [
      "You arrive at a site and the bin is locked. You photograph it, note it in the app, and contact dispatch for instructions.",
      "You accidentally spill recyclable material during a pickup. You clean it up, document it, and report it.",
    ],
    positiveOutcome: 'Drivers who follow the full procedure have clean records, fewer complaints, and qualify for route performance bonuses.',
    negativeOutcome: 'Skipping steps or falsely marking pickups complete leads to client complaints, audit flags, and possible termination.',
    quiz: [
      {
        q:       'What is the first thing you must do when you arrive at a commercial pickup site?',
        options: [
          'Check in at the site through the app',
          'Move the container to a more convenient location',
          'Call the site contact to announce your arrival',
          'Start the pickup immediately to save time',
        ],
        correct: 0,
      },
      {
        q:       'The bin at a site is locked and you cannot access it. What do you do?',
        options: [
          'Photograph it, note it in the app, and contact dispatch',
          'Move on and come back later without reporting',
          'Mark it complete since it was not your fault',
          'Break the lock so the pickup can be completed',
        ],
        correct: 0,
      },
      {
        q:       'When should you mark a pickup complete in the app?',
        options: [
          'After you have fully completed the pickup and before leaving the site',
          'As soon as you arrive at the site',
          'When you get back to the truck',
          'At the end of your entire route',
        ],
        correct: 0,
      },
      {
        q:       'You accidentally spill recyclable material during a pickup. What is the right action?',
        options: [
          'Clean it up, document it, and report it',
          'Leave it and mark the pickup complete',
          'Call the client to apologize and let them clean it',
          'Photograph it and move on without cleaning up',
        ],
        correct: 0,
      },
    ],
  },

  // ── Module 4: Container Handling ─────────────────────────────────────────────
  {
    key:   'comm_container',
    title: 'Container Handling',
    icon:  '🗑️',
    summary:
      'Commercial containers — bins, totes, carts, dumpsters, and compactors — are heavy and require proper technique. ' +
      'Incorrect handling causes back injuries, container damage, and client complaints. ' +
      'This module teaches you how to move, position, and document containers safely every time.',
    whyMatters: [
      {
        who:  'You',
        text: 'Back injuries from improper lifting are the most common commercial driver injury. Correct technique protects your long-term health.',
      },
      {
        who:  'The Client',
        text: 'Clients are billed for damaged containers. Careless handling creates cost disputes and damaged relationships.',
      },
    ],
    mustDo: [
      'Use proper lifting technique: bend knees, keep back straight, lift with legs.',
      'Use mechanical aids (hand trucks, dollies) for containers over 50 lbs whenever available.',
      'Check container condition before and after every move.',
      'Report damaged containers through the app with a photo.',
      'Return containers to their designated storage area after service.',
    ],
    mustNotDo: [
      'Do not drag containers across pavement — use wheels or mechanical aids.',
      'Do not overfill containers beyond the fill line.',
      'Do not stack containers on top of each other during transport.',
      'Do not use damaged containers — document and report them before pickup.',
    ],
    examples: [
      "You arrive at a restaurant and the grease cart is overloaded. You photograph it, flag it as overweight, and contact dispatch before attempting the pickup.",
      "A bin has a cracked wheel. You complete the pickup, photograph the damage, and report it so it can be replaced.",
    ],
    positiveOutcome: 'Drivers with clean container handling records avoid injury claims, keep clients happy, and are trusted with higher-value routes.',
    negativeOutcome: 'Damaged containers, unreported defects, or injury from improper technique creates liability for you and the company.',
    quiz: [
      {
        q:       'What is the correct lifting technique for heavy commercial containers?',
        options: [
          'Bend knees, keep back straight, lift with legs',
          'Bend at the waist and use your back to lift',
          'Ask the site contact to help you lift it',
          'Drag the container to a nearby vehicle ramp',
        ],
        correct: 0,
      },
      {
        q:       'You notice a bin has a cracked wheel before pickup. What should you do?',
        options: [
          'Complete the pickup, photograph the damage, and report it in the app',
          'Skip the pickup and leave without reporting',
          'Try to fix it yourself with tools from the truck',
          'Tell the site contact and let them handle it',
        ],
        correct: 0,
      },
      {
        q:       'Where should containers be returned after service?',
        options: [
          'Their designated storage area at the client site',
          'Wherever is most convenient for the next pickup',
          'Against the building wall nearest the exit',
          'In the truck until the route is complete',
        ],
        correct: 0,
      },
      {
        q:       'A container is overloaded past the fill line. What is the right action?',
        options: [
          'Photograph it, flag it as overweight, and contact dispatch',
          'Pick it up anyway since the client filled it',
          'Empty some material onto the ground first',
          'Mark the stop as incomplete and move on',
        ],
        correct: 0,
      },
    ],
  },

  // ── Module 5: Material Identification ───────────────────────────────────────
  {
    key:   'comm_material',
    title: 'Material Identification',
    icon:  '🔍',
    summary:
      'Not all materials placed in recycling containers should be there. ' +
      'Some materials are hazardous, some are restricted, and some simply cannot be processed. ' +
      'Knowing what materials you are collecting — and what does not belong — protects you, the client, and the environment.',
    whyMatters: [
      {
        who:  'You',
        text: 'Handling hazardous materials without knowing it puts your health and safety at serious risk.',
      },
      {
        who:  'The Company',
        text: 'Contaminated loads create processing problems at the warehouse and can result in regulatory fines.',
      },
    ],
    mustDo: [
      'Know what materials your assigned route containers are supposed to hold.',
      'Visually inspect the top layer of each container before pickup.',
      'Report suspected hazardous or restricted materials immediately — do not touch them.',
      'Document any contamination with a photo before and after pickup.',
    ],
    mustNotDo: [
      'Do not pick up containers with obvious hazardous materials (chemicals, needles, flammables).',
      'Do not reach into containers to check contents — visual inspection only.',
      'Do not mix different material types into the same container.',
      'Do not accept additional material from clients that is not part of your scheduled pickup.',
    ],
    examples: [
      "You see a container at a hospital that has what looks like sharps (needles) on top. You photograph it, do not touch it, and immediately report it to dispatch.",
      "A restaurant staff member tries to hand you a bag of kitchen waste to go in the recycling bin. You politely decline and explain what the bin is for.",
    ],
    positiveOutcome: 'Drivers who correctly identify and report material issues protect the company from fines, protect themselves from health risks, and earn trust from warehouse staff.',
    negativeOutcome: 'Picking up contaminated or restricted material creates warehouse processing failures, possible regulatory penalties, and health risks for you and others.',
    quiz: [
      {
        q:       'You see what looks like chemical containers on top of a recycling bin. What do you do?',
        options: [
          'Photograph it, do not touch it, and report it to dispatch immediately',
          'Carefully remove the chemical containers and then pick up the bin',
          'Pick up the bin since the client put it there',
          'Skip the stop and move on without reporting',
        ],
        correct: 0,
      },
      {
        q:       'How should you inspect a container before pickup?',
        options: [
          'Visual inspection of the top layer only',
          'Reach in and sort through the contents',
          'Weigh the container to estimate the contents',
          'Ask the site contact what is inside',
        ],
        correct: 0,
      },
      {
        q:       'A client staff member tries to give you extra bags of material not on your scheduled pickup. What do you do?',
        options: [
          'Politely decline and explain what your pickup covers',
          'Accept it to keep the client happy',
          'Accept it and report it in the app after the fact',
          'Tell the client to call dispatch themselves',
        ],
        correct: 0,
      },
      {
        q:       'What materials should NEVER be picked up under any circumstances?',
        options: [
          'Obvious hazardous materials — chemicals, needles, flammables',
          'Cardboard that is wet from rain',
          'Bins that are less than half full',
          'Containers that are heavier than expected',
        ],
        correct: 0,
      },
    ],
  },

  // ── Module 6: Photo Verification ─────────────────────────────────────────────
  {
    key:   'comm_photo',
    title: 'Photo Verification',
    icon:  '📸',
    summary:
      'Every commercial pickup requires before and after photos. ' +
      'These photos are your proof that the job was done right and the container was in good condition. ' +
      'They also protect you if a client later claims the container was damaged or the pickup was skipped.',
    whyMatters: [
      {
        who:  'You',
        text: 'A good photo proves you did the job correctly. Without it, your word is against the client\'s.',
      },
      {
        who:  'The Client',
        text: 'Clients use photo records to verify service and for their own compliance reporting.',
      },
    ],
    mustDo: [
      'Take a clear before photo showing the container at the start of service.',
      'Take a clear after photo showing the container after service is complete.',
      'Make sure photos show the bin code or QR code when possible.',
      'Upload photos through the app immediately — do not wait until end of route.',
    ],
    mustNotDo: [
      'Do not use photos from a previous visit — all photos must be current.',
      'Do not submit blurry or dark photos — retake if needed.',
      'Do not take photos of people — only containers and site conditions.',
      "Do not skip photos even when you're running behind schedule.",
    ],
    examples: [
      "You arrive at a site and the container has pre-existing damage. You take a before photo to document the damage so you are not blamed for it.",
      "After pickup, the bin is dented from the lift mechanism. You take an after photo, note the damage in the app, and report it to dispatch.",
    ],
    positiveOutcome: 'Drivers with consistent photo records are protected from false complaints and build a track record that qualifies them for route management roles.',
    negativeOutcome: "Missing or poor-quality photos leave you unprotected if a client disputes a pickup or claims damage you didn't cause.",
    quiz: [
      {
        q:       'When should you upload pickup photos in the app?',
        options: [
          'Immediately after each pickup — before leaving the site',
          'At the end of your entire route',
          'Only when there is visible damage',
          'Once a week when you do your route report',
        ],
        correct: 0,
      },
      {
        q:       'You arrive at a site and see the container has existing damage. What do you do first?',
        options: [
          'Take a before photo to document the pre-existing damage',
          'Complete the pickup and note the damage after',
          'Skip the pickup to avoid being blamed for the damage',
          'Ask the site contact to sign off on the damage',
        ],
        correct: 0,
      },
      {
        q:       'A client later claims you damaged their container. What protects you?',
        options: [
          'Clear before and after photos uploaded through the app',
          'Your verbal explanation of what happened',
          'The signature from the site contact',
          'Your supervisor\'s confirmation that you were on the route',
        ],
        correct: 0,
      },
      {
        q:       'Your photo comes out blurry. What should you do?',
        options: [
          'Retake the photo until it is clear',
          'Submit it anyway — blurry is better than nothing',
          'Skip the photo for this stop',
          'Describe what the photo would have shown in the app notes',
        ],
        correct: 0,
      },
    ],
  },

  // ── Module 7: Safety & Compliance ───────────────────────────────────────────
  {
    key:   'comm_safety',
    title: 'Safety & Compliance',
    icon:  '🦺',
    summary:
      'Commercial sites include loading docks, narrow alleys, parking garages, and areas with heavy vehicle traffic. ' +
      'Following safety rules at every site protects you, other workers, and the public. ' +
      'Compliance with safety standards is not optional — it is a condition of your employment.',
    whyMatters: [
      {
        who:  'You',
        text: 'Injuries at commercial sites can be serious. PPE and safe practices are your first line of defense.',
      },
      {
        who:  'The Company',
        text: 'Safety violations at a client site create liability and can result in losing the account permanently.',
      },
    ],
    mustDo: [
      'Wear required PPE — gloves, high-visibility vest, safety-toe footwear — on every site visit.',
      'Follow posted site safety rules and speed limits in loading areas.',
      'Use spotters or vehicle guides when backing in tight spaces.',
      'Report any near-miss incidents, slips, or falls immediately — even if you are not injured.',
    ],
    mustNotDo: [
      "Do not remove PPE until you are back in your vehicle and off the client's property.",
      'Do not work under suspended loads or near unstable stacks.',
      'Do not operate equipment at a client site that you have not been trained to use.',
      'Do not ignore safety warning signs or cones placed by site staff.',
    ],
    examples: [
      "You arrive at a warehouse loading dock and the floor is wet. You report it to the site contact and wait for it to be marked before proceeding.",
      "While backing your vehicle, you feel uncertain about clearance. You stop, exit, physically check the space, and then back in slowly.",
    ],
    positiveOutcome: 'Drivers with perfect safety records qualify for senior route assignments, supervisor roles, and performance recognition.',
    negativeOutcome: 'Safety violations — even minor ones — are recorded and can result in suspension, retraining requirements, or termination.',
    quiz: [
      {
        q:       'Which PPE is required on every commercial site visit?',
        options: [
          'Gloves, high-visibility vest, and safety-toe footwear',
          'Hard hat and safety goggles only',
          'PPE is optional if the site looks safe',
          'Only gloves are required for recycling pickups',
        ],
        correct: 0,
      },
      {
        q:       'You experience a minor slip in a loading dock but are not injured. What should you do?',
        options: [
          'Report it immediately as a near-miss incident',
          'Say nothing since you were not hurt',
          'Tell only your direct supervisor at the end of the day',
          'Fill out a form only if you feel pain later',
        ],
        correct: 0,
      },
      {
        q:       'The floor at a client site is wet and unmarked. What is the correct action?',
        options: [
          'Report it to the site contact and wait for it to be addressed before proceeding',
          'Proceed carefully and hurry through the area',
          'Place your own cones and continue',
          'Skip the stop and report it to dispatch',
        ],
        correct: 0,
      },
      {
        q:       'You are unsure about clearance while backing your vehicle. What do you do?',
        options: [
          'Stop, exit the vehicle, physically check the space, then back in slowly',
          'Go slowly and hope for the best',
          'Ask a bystander to watch the back of your vehicle',
          'Use your mirrors only and continue backing',
        ],
        correct: 0,
      },
    ],
  },

  // ── Module 8: Restricted Materials ──────────────────────────────────────────
  {
    key:   'comm_restricted',
    title: 'Restricted Materials',
    icon:  '⚠️',
    summary:
      'Some materials are completely off-limits — no exceptions. ' +
      'Restricted materials include hazardous waste, electronics, medical waste, and certain chemicals. ' +
      'Picking up restricted materials — even by accident — can result in regulatory fines, criminal liability, and serious harm.',
    whyMatters: [
      {
        who:  'You',
        text: 'Exposure to hazardous materials without proper protection can cause serious, lasting health damage.',
      },
      {
        who:  'The Company',
        text: 'Transporting restricted materials without proper permits is illegal and can result in large fines and business closure.',
      },
    ],
    mustDo: [
      'Know the restricted materials list before starting your route.',
      'Refuse pickup if restricted materials are present — photograph and report.',
      'Wash hands thoroughly after any suspected contact with unknown materials.',
      'Report any restricted material find to dispatch and your supervisor immediately.',
    ],
    mustNotDo: [
      'Do not pick up medical waste, needles, or sharps under any circumstances.',
      'Do not transport chemicals, paint, motor oil, or flammable liquids in recycling containers.',
      'Do not handle electronics waste (TVs, computers, batteries) in regular recycling routes.',
      'Do not accept verbal assurances from clients that a material is "safe" — follow the restricted list.',
    ],
    examples: [
      "A bin at a medical clinic contains sealed bags that look like medical waste. You step back, photograph the bin from a safe distance, and call dispatch before touching anything.",
      "A client leaves old car batteries next to the recycling bin. You photograph them, explain to the site contact they are restricted, and note it in the app.",
    ],
    positiveOutcome: 'Drivers who correctly identify and refuse restricted materials protect themselves, their coworkers, and the company from serious legal and health consequences.',
    negativeOutcome: 'Picking up restricted materials — even unknowingly — can expose you to disciplinary action, health risks, and potential criminal liability.',
    quiz: [
      {
        q:       'You find what appear to be used medical needles (sharps) in a recycling bin. What do you do?',
        options: [
          'Step back, photograph the bin from a distance, and call dispatch immediately',
          'Use gloves to remove the needles and then pick up the bin',
          'Pick up the bin since it is your assigned stop',
          'Tell the site contact and leave without reporting to dispatch',
        ],
        correct: 0,
      },
      {
        q:       "A client says the chemicals in a bin are 'totally safe.' What do you do?",
        options: [
          'Refuse the pickup and follow the restricted materials list regardless',
          'Trust the client since they know their own materials',
          'Accept the pickup but document it in the app',
          'Call your supervisor and wait for their decision before deciding',
        ],
        correct: 0,
      },
      {
        q:       'Which of the following is ALWAYS restricted in commercial recycling pickups?',
        options: [
          'Medical waste and sharps (needles)',
          'Wet cardboard from rain',
          'Plastic bags inside bins',
          'Glass containers with residue',
        ],
        correct: 0,
      },
      {
        q:       'After suspected contact with an unknown material, what should you do first?',
        options: [
          'Wash hands thoroughly and report the contact to dispatch',
          'Continue your route and monitor yourself for symptoms',
          'Call a hospital immediately',
          'Ask a coworker if they think the material is dangerous',
        ],
        correct: 0,
      },
    ],
  },

  // ── Module 9: Route Management ───────────────────────────────────────────────
  {
    key:   'comm_routes',
    title: 'Route Management',
    icon:  '🗺️',
    summary:
      'Managing your route efficiently means completing all scheduled stops on time, communicating delays, and keeping accurate records. ' +
      'Route performance is measured and reviewed — on-time completion and accurate app entries directly affect your standing as a driver.',
    whyMatters: [
      {
        who:  'Business Clients',
        text: 'Businesses have strict schedules. A missed or late pickup disrupts their operations and creates complaints.',
      },
      {
        who:  'Your Performance Record',
        text: 'On-time completion rates, missed stop counts, and app accuracy are all tracked and reviewed.',
      },
    ],
    mustDo: [
      'Review your route in the app before starting your shift.',
      'Follow the assigned stop order unless dispatch approves a change.',
      'Notify dispatch immediately if you expect to miss a time window.',
      'Mark each stop complete in the app before leaving — not at the end of the route.',
    ],
    mustNotDo: [
      'Do not skip stops without dispatch authorization — even if the stop seems small.',
      'Do not batch-enter pickups at the end of the day — entries must be real-time.',
      "Do not change route order on your own without supervisor approval.",
      'Do not leave a site before marking the pickup complete.',
    ],
    examples: [
      "You hit unexpected traffic and realize you will miss a pickup window. You immediately notify dispatch so they can adjust the schedule or send coverage.",
      "A new stop was added to your route mid-day through the app. You confirm the addition with dispatch before rerouting.",
    ],
    positiveOutcome: 'Drivers with strong route performance records qualify for preferred schedules, pay increases, and route supervisor opportunities.',
    negativeOutcome: 'Repeated missed stops, late entries, or unauthorized route changes result in performance reviews and possible removal from routes.',
    quiz: [
      {
        q:       'When should you mark a stop complete in the app?',
        options: [
          'Immediately after completing the pickup — before leaving the site',
          'At the end of your full route',
          'At the end of your work shift',
          'Only when the client requests a confirmation',
        ],
        correct: 0,
      },
      {
        q:       'You realize you will miss a scheduled pickup time window. What should you do?',
        options: [
          'Notify dispatch immediately so they can adjust or send coverage',
          'Try to rush through earlier stops to make up time',
          'Skip the stop and pick it up tomorrow',
          'Complete the missed stop at the end of your route without telling anyone',
        ],
        correct: 0,
      },
      {
        q:       'Can you change your route stop order without approval?',
        options: [
          'No — route order changes require supervisor approval',
          'Yes — drivers can manage their own stop order',
          'Yes — as long as you complete all stops by end of shift',
          'Only if the new order saves more than 20 minutes',
        ],
        correct: 0,
      },
      {
        q:       'A new stop appears in your app mid-route. What do you do?',
        options: [
          'Confirm the addition with dispatch before rerouting',
          'Complete it immediately without stopping to confirm',
          'Ignore it until your next scheduled shift',
          'Call the new client directly to confirm their address',
        ],
        correct: 0,
      },
    ],
  },

  // ── Module 10: Incident Reporting ────────────────────────────────────────────
  {
    key:   'comm_incident',
    title: 'Incident Reporting',
    icon:  '📋',
    summary:
      'Every incident — from a minor scrape to a serious accident — must be reported immediately and documented accurately. ' +
      'Prompt reporting protects you legally, helps the company respond quickly, and ensures injured parties get help. ' +
      'Delayed or incomplete reporting is treated as a serious policy violation.',
    whyMatters: [
      {
        who:  'You',
        text: 'An unreported incident can be used against you later. Reporting first protects your account of what happened.',
      },
      {
        who:  'The Company',
        text: 'Late incident reports create legal problems, increase insurance costs, and damage the company\'s reputation.',
      },
    ],
    mustDo: [
      'Report any vehicle contact, injury, spill, or property damage immediately through the app and by phone.',
      'Stay at the scene until dispatch instructs you to leave.',
      'Take photos of all damage, the scene, and any relevant signage before anything moves.',
      'Get the name and contact information of any witnesses.',
    ],
    mustNotDo: [
      "Do not leave the scene of an incident without dispatch's knowledge.",
      'Do not agree to settle or make payment promises at the scene.',
      'Do not move vehicles or containers until you have documented the scene.',
      'Do not wait until the end of your route to report — report immediately.',
    ],
    examples: [
      "Your vehicle makes contact with a client's fence while maneuvering in a tight loading area. You stop, photograph the contact point, call dispatch, and wait for instructions.",
      "A coworker slips while assisting with a heavy container. You call dispatch immediately and stay with your coworker until help arrives.",
    ],
    positiveOutcome: 'Drivers who report promptly and accurately are protected by the company, trusted with more responsibility, and have their records kept clean.',
    negativeOutcome: 'Failure to report an incident — or delayed reporting — is a serious policy violation that can result in immediate suspension or termination.',
    quiz: [
      {
        q:       'Your vehicle makes minor contact with a client\'s property. What do you do first?',
        options: [
          'Stop, photograph the scene, and call dispatch immediately',
          'Assess the damage and decide if it is worth reporting',
          'Leave a note and continue your route',
          'Wait until the end of your shift and then file a report',
        ],
        correct: 0,
      },
      {
        q:       'When can you leave the scene of an incident?',
        options: [
          'Only after dispatch instructs you to leave',
          'As soon as you have taken photos',
          'Once you have called your supervisor',
          'After the client gives you permission',
        ],
        correct: 0,
      },
      {
        q:       'A coworker is injured while assisting you on a stop. What should you do?',
        options: [
          'Call dispatch immediately and stay with your coworker until help arrives',
          'Finish the stop and then call for help',
          'Have the coworker call for their own help',
          'Complete your route first so the schedule is not disrupted',
        ],
        correct: 0,
      },
      {
        q:       'You make an agreement at the scene of an incident to handle damage privately. Is this allowed?',
        options: [
          'No — never agree to settle or make promises at the scene',
          'Yes — as long as you tell dispatch about it later',
          'Yes — minor damage can be handled privately',
          "Yes — if the client requests it and no one was hurt",
        ],
        correct: 0,
      },
    ],
  },
]

// ── COMMERCIAL VIDEO DATA (Employee Program) ──────────────────────────────────

export const COMMERCIAL_VIDEO_DATA: Record<string, TrainingVideoContent> = {

  // ── comm_mission ─────────────────────────────────────────────────────────────
  comm_mission: {
    estimatedMinutes: 2,
    script: {
      opening:
        "Welcome to Cyan's Brooklynn Recycling. You've joined a team that is doing real work for the environment and for the communities we serve.",
      lesson:
        "Our mission is to make recycling easy and reliable. As a commercial driver, you are the most visible part of that mission. Every stop you make, every pickup you complete, every interaction you have with a client — that is the mission in action.",
      realExample:
        "A driver noticed a recycling bin at a restaurant that had clearly been contaminated with food waste for weeks. Instead of just picking it up and moving on, she photographed it, flagged it in the app, and the account team reached out to the client to fix the issue. That's what mission-first looks like.",
      mistakeToAvoid:
        "The mistake is treating this job as just moving bins. Every bin you pick up correctly is material that doesn't go into a landfill. That matters. Carry that with you.",
      positiveOutcome:
        "Drivers who understand and live the mission earn client trust, get first priority on route upgrades, and build careers at this company.",
      closingReminder:
        "You represent Cyan's Brooklynn Recycling at every stop. Make that representation count.",
    },
    storyboard: [
      { scene: 1, durationSecs: 18, visual: "Aerial view of city recycling trucks at work. Cyan's Brooklynn Recycling logo fades in.", voiceover: "Welcome to Cyan's Brooklynn Recycling.", onScreenText: "Your Mission Starts Here" },
      { scene: 2, durationSecs: 20, visual: 'Driver in uniform greeting a business site contact. Professional, friendly exchange.', voiceover: 'As a commercial driver, you are the most visible part of the company mission.', onScreenText: 'You Are the Face of the Company' },
      { scene: 3, durationSecs: 18, visual: 'Driver photographing a contaminated bin and flagging it in the app.', voiceover: 'Mission-first means noticing problems and fixing them — not just moving bins.', onScreenText: 'Notice. Report. Fix.' },
      { scene: 4, durationSecs: 14, visual: 'Time-lapse of recyclables being processed at a facility. Clean, modern equipment.', voiceover: 'Every correct pickup is material that stays out of a landfill.', onScreenText: 'Every Pickup Matters' },
      { scene: 5, durationSecs: 16, visual: 'Driver receiving a route upgrade notification on the app.', voiceover: 'Drivers who live the mission earn trust and career growth.', onScreenText: 'Mission → Performance → Growth' },
      { scene: 6, durationSecs: 14, visual: "Cyan's Brooklynn Recycling logo. Driver waves at a client and drives off.", voiceover: "You represent Cyan's Brooklynn Recycling at every stop.", onScreenText: "Make Every Stop Count" },
    ],
  },

  // ── comm_customer ─────────────────────────────────────────────────────────────
  comm_customer: {
    estimatedMinutes: 2,
    script: {
      opening:
        "Commercial clients are not just customers — they are partners. They count on us to show up on time, handle their material correctly, and communicate professionally.",
      lesson:
        "Business clients expect reliability and respect. That means greeting site contacts politely, handling issues calmly, and never making promises you don't have authority to keep. If a client has a complaint, your job is to listen, document it, and escalate — not to argue or agree to changes on the spot.",
      realExample:
        "A hotel receiving manager was angry about a missed pickup. The driver stayed calm, apologized for the disruption, immediately logged the complaint in the app, and followed up with the account team. The client stayed on the contract.",
      mistakeToAvoid:
        "Arguing with a client on site — even when you are right — is never the correct move. It escalates the problem and makes the company look bad. Always stay calm and escalate.",
      positiveOutcome:
        "Professional drivers who build positive client relationships are requested by name, earn the best routes, and qualify for account management roles.",
      closingReminder:
        "Every client interaction is a contract renewal in progress. Handle it like it matters — because it does.",
    },
    storyboard: [
      { scene: 1, durationSecs: 14, visual: 'Driver arriving at a hotel loading dock. Site contact greets them.', voiceover: 'Commercial clients are partners. They count on reliability and respect.', onScreenText: 'Clients Are Partners' },
      { scene: 2, durationSecs: 18, visual: 'Driver listening calmly to an upset manager. Professional body language.', voiceover: 'If a client has a complaint, listen, document it, and escalate. Never argue.', onScreenText: 'Listen → Document → Escalate' },
      { scene: 3, durationSecs: 16, visual: 'Driver logging a complaint in the app while client watches.', voiceover: 'Logging it in the app shows the client their concern is taken seriously.', onScreenText: 'Document Every Concern' },
      { scene: 4, durationSecs: 14, visual: 'Angry client. Driver stays calm and professional.', voiceover: 'Arguing with a client — even when you are right — makes the company look bad.', onScreenText: 'Stay Calm. Always.' },
      { scene: 5, durationSecs: 16, visual: 'Driver receiving a "preferred driver" tag in the app.', voiceover: 'Professional drivers are requested by name and earn the best routes.', onScreenText: 'Professionalism → Best Routes' },
      { scene: 6, durationSecs: 12, visual: "Cyan's Brooklynn Recycling logo. Handshake graphic.", voiceover: 'Every interaction is a contract renewal in progress.', onScreenText: 'Handle It Like It Matters' },
    ],
  },

  // ── comm_pickup ──────────────────────────────────────────────────────────────
  comm_pickup: {
    estimatedMinutes: 3,
    script: {
      opening:
        'Commercial pickup procedures exist for one reason: to make sure every job is done right, documented correctly, and verified on both ends.',
      lesson:
        'Every pickup follows the same steps: check in through the app, confirm the container matches your assignment, perform the safety check, complete the pickup, photograph before and after, and mark complete in the app before leaving. These are not suggestions — they are requirements.',
      realExample:
        "A driver arrived at a site and the bin was locked. Instead of marking it complete and moving on, he photographed the locked bin, reported it through the app, and waited for dispatch instructions. The client was contacted, the bin was unlocked, and the pickup was completed correctly the same day.",
      mistakeToAvoid:
        'Marking a pickup complete before actually completing it. This is treated as falsification of records and results in immediate termination.',
      positiveOutcome:
        'Drivers who follow the procedure perfectly build a clean record, qualify for route performance bonuses, and are trusted with premium accounts.',
      closingReminder:
        'Check in. Confirm. Safety check. Pickup. Photo. Mark complete. In that order, every time.',
    },
    storyboard: [
      { scene: 1, durationSecs: 14, visual: 'Driver checking in through the app at a business site entrance.', voiceover: 'Every pickup starts with a check-in through the app.', onScreenText: 'Step 1: Check In' },
      { scene: 2, durationSecs: 16, visual: 'Driver scanning bin QR code and confirming it matches route assignment.', voiceover: 'Confirm the container matches your assignment before touching it.', onScreenText: 'Step 2: Confirm Container' },
      { scene: 3, durationSecs: 14, visual: 'Driver performing safety check — checking ground stability, overhead clearance.', voiceover: 'Safety check before every lift. No exceptions.', onScreenText: 'Step 3: Safety Check' },
      { scene: 4, durationSecs: 16, visual: 'Driver performing pickup. Clean technique, proper equipment.', voiceover: 'Complete the pickup using proper procedure.', onScreenText: 'Step 4: Complete Pickup' },
      { scene: 5, durationSecs: 14, visual: 'Driver taking before and after photos. Clear, well-lit.', voiceover: 'Photo before and after. Upload immediately.', onScreenText: 'Step 5: Photo Documentation' },
      { scene: 6, durationSecs: 12, visual: 'Driver marking pickup complete in app before walking to truck.', voiceover: 'Mark complete before you leave the site. Not from the truck. Not later.', onScreenText: 'Step 6: Mark Complete' },
    ],
  },

  // ── comm_container ───────────────────────────────────────────────────────────
  comm_container: {
    estimatedMinutes: 2,
    script: {
      opening:
        'Commercial containers are not like residential bins. They are heavier, sturdier, and require specific handling techniques to move safely.',
      lesson:
        'Use proper lifting technique — knees bent, back straight, lift with legs — for everything under 50 pounds. For anything heavier, use mechanical aids. Always check container condition before and after the move. Damaged containers must be documented and reported, not ignored.',
      realExample:
        "A driver tried to lift an overloaded grease cart without checking the weight first and strained his back. The next driver on the same route noticed the cart was marked as overweight in the app and used a dolly. Same container, two very different outcomes.",
      mistakeToAvoid:
        "Dragging containers across pavement. It damages the container, leaves marks on client property, and creates a noise complaint. Use the wheels or the dolly — it's what they're there for.",
      positiveOutcome:
        'Clean container handling record means no injury claims, no client damage complaints, and access to the highest-value routes.',
      closingReminder:
        'Check the weight. Use the right tool. Document everything. Repeat.',
    },
    storyboard: [
      { scene: 1, durationSecs: 14, visual: 'Various commercial containers — bins, totes, carts. Labels visible.', voiceover: 'Commercial containers require specific handling techniques.', onScreenText: 'Know Your Container Types' },
      { scene: 2, durationSecs: 16, visual: 'Driver demonstrating correct lifting technique — knees bent, back straight.', voiceover: 'Lift with your legs, not your back. Always.', onScreenText: 'Correct Lifting = Safe Lifting' },
      { scene: 3, durationSecs: 14, visual: 'Driver using hand truck for an overweight container.', voiceover: 'For heavy containers, use mechanical aids. That\'s what they\'re for.', onScreenText: 'Use the Right Tool' },
      { scene: 4, durationSecs: 14, visual: 'Driver inspecting container for damage before pickup.', voiceover: 'Check the condition before and after every move.', onScreenText: 'Before + After Inspection' },
      { scene: 5, durationSecs: 14, visual: 'Driver photographing a cracked container wheel and filing report in app.', voiceover: 'Document damage in the app immediately — protect yourself.', onScreenText: 'Document Every Defect' },
      { scene: 6, durationSecs: 12, visual: 'Container being returned to its designated storage spot at client site.', voiceover: 'Return containers exactly where you found them.', onScreenText: 'Return to Designated Location' },
    ],
  },

  // ── comm_material ────────────────────────────────────────────────────────────
  comm_material: {
    estimatedMinutes: 2,
    script: {
      opening:
        "Knowing what's inside a container before you pick it up is not just good practice — it is a safety requirement.",
      lesson:
        "Every container on your route has a designated material type. Your job is to visually inspect the top layer before pickup and confirm what you see matches what should be there. If anything looks wrong — unusual containers, chemical smells, medical materials — you stop, step back, photograph from a safe distance, and report immediately. You do not touch it.",
      realExample:
        "A driver at a hospital clinic saw sealed red bags on top of a recycling bin — the kind used for medical waste. She stepped back, photographed from a distance, called dispatch, and flagged the stop. The clinic had made an error in their waste separation process. A proper disposal crew was sent out the same day.",
      mistakeToAvoid:
        'Reaching into containers to check contents. Visual inspection only. If you cannot see it from the top, report it — do not dig.',
      positiveOutcome:
        'Drivers who correctly identify and report material issues earn trust from warehouse staff and protect everyone in the chain from health risks and fines.',
      closingReminder:
        "If something doesn't look right, it probably isn't. Stop. Photograph. Report. That's the job.",
    },
    storyboard: [
      { scene: 1, durationSecs: 14, visual: "Driver looking at a container label — 'Recyclables Only' clearly visible.", voiceover: 'Every container has a designated material type.', onScreenText: 'Know What Goes Where' },
      { scene: 2, durationSecs: 16, visual: 'Driver doing a visual scan of the top layer of a bin. No reaching in.', voiceover: 'Visual inspection only. Never reach in to check contents.', onScreenText: 'Visual Inspection Only' },
      { scene: 3, durationSecs: 18, visual: 'Driver spots suspicious red bags in recycling bin. Steps back, maintains distance.', voiceover: 'Something looks wrong? Step back. Photograph from a safe distance. Report.', onScreenText: 'Stop. Step Back. Report.' },
      { scene: 4, durationSecs: 14, visual: 'Driver photographing bin from a safe distance. No contact.', voiceover: 'Do not touch it. Photograph from where you are standing.', onScreenText: 'Document Without Contact' },
      { scene: 5, durationSecs: 14, visual: 'Driver calling dispatch, calm and professional.', voiceover: 'Call dispatch immediately. Protect the next person in the chain.', onScreenText: 'Call Dispatch Immediately' },
      { scene: 6, durationSecs: 12, visual: 'Red warning icon overlay. Correct material sort graphic.', voiceover: "If something doesn't look right, it probably isn't. Trust your instincts.", onScreenText: 'When in Doubt — Report' },
    ],
  },

  // ── comm_photo ───────────────────────────────────────────────────────────────
  comm_photo: {
    estimatedMinutes: 2,
    script: {
      opening:
        "A photo is your best defense and your clearest proof. Without it, any claim a client makes about the condition of their container — or whether you showed up — is your word against theirs.",
      lesson:
        "Take a clear before photo showing the container at the start of service. Take a clear after photo when service is complete. Both photos should show the bin code or QR code when possible. Upload them through the app immediately — not at the end of the route, not at the end of the day. Right away.",
      realExample:
        "A client claimed a driver had damaged their dumpster during a pickup. The driver had taken a clear before photo showing existing damage at the site — scratch marks on the side and a bent hinge. The photo resolved the dispute in minutes. No investigation needed.",
      mistakeToAvoid:
        'Using photos from a previous visit. The system can detect timestamp mismatches, and submitting old photos is treated as falsification. Every photo must be current.',
      positiveOutcome:
        "Drivers with consistent, high-quality photo records are protected from false complaints and qualify for route management and mentorship roles.",
      closingReminder:
        'Before. After. Bin code visible. Upload immediately. That is all it takes.',
    },
    storyboard: [
      { scene: 1, durationSecs: 14, visual: 'Driver holding phone up to photograph a container. Clear shot, good lighting.', voiceover: 'A photo is your best defense and your clearest proof.', onScreenText: 'Photo = Protection' },
      { scene: 2, durationSecs: 16, visual: 'Side-by-side: before photo (bin in good condition) and after photo (bin serviced).', voiceover: 'Take a before photo and an after photo for every stop.', onScreenText: 'Before + After. Every Stop.' },
      { scene: 3, durationSecs: 14, visual: 'Close-up of photo showing bin QR code clearly visible.', voiceover: 'Include the bin code or QR code in the shot when possible.', onScreenText: 'Bin Code in Frame When Possible' },
      { scene: 4, durationSecs: 16, visual: 'Driver uploading photos in app immediately after pickup — at the site.', voiceover: 'Upload immediately. Not at the end of the route. Right now.', onScreenText: 'Upload Now — Not Later' },
      { scene: 5, durationSecs: 16, visual: "Photo shown resolving client's complaint about damage — driver's before photo shows pre-existing damage.", voiceover: 'A before photo can resolve a dispute in minutes. It is your first line of defense.', onScreenText: 'Photos Resolve Disputes' },
      { scene: 6, durationSecs: 12, visual: "Cyan's Brooklynn logo. Camera icon. Green checkmark.", voiceover: 'Before. After. Bin code visible. Upload immediately.', onScreenText: 'The 4-Step Photo Standard' },
    ],
  },

  // ── comm_safety ──────────────────────────────────────────────────────────────
  comm_safety: {
    estimatedMinutes: 3,
    script: {
      opening:
        'Safety is not a guideline. It is a condition of your employment at every site you work.',
      lesson:
        "Wear your PPE every time — gloves, high-visibility vest, safety-toe footwear — before you touch anything at a client site. Follow posted site rules and loading dock speed limits. If you are backing in a tight space and feel uncertain, stop the vehicle, get out, physically check the clearance, and then continue. A three-minute delay is not worth a $10,000 incident report.",
      realExample:
        "A driver was rushing through a wet loading dock area and slipped — no injury, but it was a near-miss. He reported it immediately. The site added non-slip mats within two days, protecting the next driver and the next driver after that. Reporting near-misses makes everyone safer.",
      mistakeToAvoid:
        'Removing PPE before you are back in your vehicle and off the client property. It takes 10 seconds to keep it on and can save you from a serious injury on the walk back to the truck.',
      positiveOutcome:
        'Perfect safety records qualify you for senior route assignments, supervisor roles, and performance recognition bonuses.',
      closingReminder:
        'PPE on. Site rules followed. Near-misses reported. Every time, every site.',
    },
    storyboard: [
      { scene: 1, durationSecs: 16, visual: 'Driver suiting up — gloves, high-visibility vest, safety-toe boots. Deliberate, professional.', voiceover: 'PPE on before you touch anything. Every time.', onScreenText: 'PPE = First Line of Defense' },
      { scene: 2, durationSecs: 14, visual: 'Driver reading posted safety signs at a loading dock entrance.', voiceover: 'Follow posted site rules and speed limits. Every site has them.', onScreenText: 'Follow Site Safety Rules' },
      { scene: 3, durationSecs: 18, visual: 'Driver stops vehicle, exits, physically walks the clearance space, then returns and backs in slowly.', voiceover: 'When uncertain about clearance — stop. Get out. Check. Then proceed.', onScreenText: '3 Minutes vs. a $10,000 Incident' },
      { scene: 4, durationSecs: 16, visual: 'Driver slips on wet surface — recovers, no injury. Immediately reports near-miss in app.', voiceover: 'Near-misses must be reported immediately — even if you are not hurt.', onScreenText: 'Report Near-Misses Too' },
      { scene: 5, durationSecs: 14, visual: 'Non-slip mats being installed at loading dock. Safety improvement visible.', voiceover: 'Reporting near-misses protects the next driver and the next driver after that.', onScreenText: 'Your Report Protects Everyone' },
      { scene: 6, durationSecs: 12, visual: 'Driver with clean safety record badge in app. Green "All Clear" status.', voiceover: 'Perfect safety records open doors to senior routes and supervisor roles.', onScreenText: 'Safety Record = Career Record' },
    ],
  },

  // ── comm_restricted ──────────────────────────────────────────────────────────
  comm_restricted: {
    estimatedMinutes: 2,
    script: {
      opening:
        'Restricted materials are not just inconvenient — they are dangerous. Some are health hazards. Some are illegal to transport without permits. All of them are your responsibility to identify and refuse.',
      lesson:
        "The restricted materials list includes: medical waste, sharps (needles), chemicals, motor oil, paint, flammable liquids, batteries, and electronics. If you see any of these in or near a container — step back, do not touch it, photograph from a safe distance, and call dispatch. A client saying it is 'fine' does not override the restricted materials list.",
      realExample:
        "A driver at a car repair shop noticed used motor oil containers next to the recycling bin. The shop owner said 'just take it with the recycling.' The driver refused, photographed the containers, reported them in the app, and contacted dispatch. The shop received proper disposal instructions. No fine. No risk.",
      mistakeToAvoid:
        "Trusting verbal assurances over the restricted list. Clients sometimes don't know what is restricted. That's okay. Your job is to know — and to act on that knowledge regardless of what anyone on-site tells you.",
      positiveOutcome:
        'Drivers who correctly handle restricted material finds are recognized for protecting the company from serious regulatory and health risks.',
      closingReminder:
        "Restricted means restricted. No exceptions. Step back, photograph, report.",
    },
    storyboard: [
      { scene: 1, durationSecs: 14, visual: 'Graphic showing restricted items list: chemicals, needles, batteries, electronics, medical waste.', voiceover: 'Know the restricted materials list before you start your route.', onScreenText: 'Know What Is Restricted' },
      { scene: 2, durationSecs: 16, visual: 'Driver spots chemical containers near a recycling bin. Steps back immediately.', voiceover: 'See something wrong? Step back. Do not touch it.', onScreenText: 'Step Back First' },
      { scene: 3, durationSecs: 14, visual: 'Driver photographing the scene from a safe distance. No contact with materials.', voiceover: 'Photograph from where you are standing. Do not move closer.', onScreenText: 'Document Without Contact' },
      { scene: 4, durationSecs: 16, visual: 'Client says "just take it, it\'s fine." Driver calmly shakes head and steps back.', voiceover: "A client's 'it's fine' does not override the restricted list. Stay firm.", onScreenText: 'Restricted = Non-Negotiable' },
      { scene: 5, durationSecs: 14, visual: 'Driver reporting in app, calling dispatch. Professional and calm.', voiceover: 'Call dispatch. Log the incident. Let the process handle the rest.', onScreenText: 'Report and Let the Process Work' },
      { scene: 6, durationSecs: 12, visual: "Shield icon — 'You Protected the Company.' Cyan's Brooklynn Recycling logo.", voiceover: 'Refusing restricted materials protects you, your coworkers, and the company.', onScreenText: 'Refusal Is the Right Decision' },
    ],
  },

  // ── comm_routes ──────────────────────────────────────────────────────────────
  comm_routes: {
    estimatedMinutes: 2,
    script: {
      opening:
        'Your route is your responsibility. How you manage it — your timing, your communication, your entries — determines your performance record and your career trajectory.',
      lesson:
        "Review your full route in the app before you start your shift. Follow the assigned stop order unless dispatch approves a change. If you expect to miss a time window, notify dispatch immediately — not after it has already happened. Mark each stop complete in the app before leaving the site, not at the end of the day.",
      realExample:
        "A driver hit heavy construction traffic on a major commercial route and knew he would miss three time windows. He called dispatch while still in traffic. Dispatch rerouted another driver to cover two of the stops. Only one stop was slightly delayed. The client never filed a complaint.",
      mistakeToAvoid:
        "Batch-entering all your pickups at the end of the route. The app tracks timestamps, and end-of-route entries look identical and trigger audit flags. Real-time entries protect you and prove your route was completed correctly.",
      positiveOutcome:
        'Drivers with strong route management records get the best schedules, the most stable routes, and first consideration for supervisor openings.',
      closingReminder:
        'Review before you start. Communicate before you miss. Mark complete before you leave. Every stop.',
    },
    storyboard: [
      { scene: 1, durationSecs: 14, visual: 'Driver reviewing route on app screen before starting truck. Deliberate, prepared.', voiceover: 'Review your route before your shift starts. Know what is ahead.', onScreenText: 'Review Before You Start' },
      { scene: 2, durationSecs: 14, visual: 'Route map on app screen. Stops in assigned order highlighted.', voiceover: 'Follow the assigned stop order. Route changes require approval.', onScreenText: 'Follow Assigned Order' },
      { scene: 3, durationSecs: 16, visual: 'Driver stuck in traffic. Immediately calls dispatch. Professional tone.', voiceover: 'Running late? Notify dispatch before you miss the window — not after.', onScreenText: 'Communicate Early' },
      { scene: 4, durationSecs: 16, visual: 'Dispatch rerouting coverage. Route problem solved before client notices.', voiceover: 'Early communication lets dispatch solve the problem before it becomes a complaint.', onScreenText: 'Early Warning = Fast Solution' },
      { scene: 5, durationSecs: 14, visual: 'Driver marking stop complete in app at the client site — not in the truck.', voiceover: 'Mark complete at the site. Real-time entries protect your record.', onScreenText: 'Real-Time Entries Only' },
      { scene: 6, durationSecs: 12, visual: 'Driver performance dashboard — high on-time rate, zero missed stops.', voiceover: 'Strong route management earns you the best schedules and career opportunities.', onScreenText: 'Route Performance = Career Performance' },
    ],
  },

  // ── comm_incident ────────────────────────────────────────────────────────────
  comm_incident: {
    estimatedMinutes: 2,
    script: {
      opening:
        'Incidents happen. What matters is what you do in the first five minutes.',
      lesson:
        "If any vehicle contact, injury, spill, or property damage occurs: stop immediately, stay at the scene, call dispatch, and photograph everything before anything moves. Do not agree to settle or make promises. Do not move vehicles or containers until the scene is documented. Report immediately — not at the end of your route, not at the end of your shift. Right now.",
      realExample:
        "A driver made contact with a fence post while turning in a narrow alley. He stopped immediately, photographed the contact point, the fence, his vehicle, and surrounding area, then called dispatch within two minutes. Because the scene was documented before anything moved, the claim was resolved quickly and fairly. The driver's insurance record stayed clean.",
      mistakeToAvoid:
        'Waiting to report. The longer you wait, the more complicated the situation becomes. Memories fade, scenes change, and delayed reports look suspicious. Report immediately — it always works in your favor.',
      positiveOutcome:
        'Drivers who report promptly are trusted by the company, protected by documentation, and have clean records that support their long-term employment.',
      closingReminder:
        'Stop. Stay. Call. Photograph. Report. In that order. Every time.',
    },
    storyboard: [
      { scene: 1, durationSecs: 14, visual: 'Driver stops vehicle immediately after contact with fence. Calm, controlled response.', voiceover: 'Stop immediately. Stay at the scene.', onScreenText: 'Stop and Stay' },
      { scene: 2, durationSecs: 16, visual: 'Driver photographing contact point, vehicle damage, and surrounding area systematically.', voiceover: 'Photograph everything before anything moves.', onScreenText: 'Document the Scene First' },
      { scene: 3, durationSecs: 14, visual: 'Driver calling dispatch. Two minutes after incident. Clear and factual.', voiceover: 'Call dispatch immediately. Two minutes after the incident — not two hours.', onScreenText: 'Call Within Minutes' },
      { scene: 4, durationSecs: 14, visual: 'Client approaches and wants to settle privately. Driver shakes head, stays professional.', voiceover: "Never agree to settle at the scene. That's a company decision — not yours to make.", onScreenText: 'Never Settle on the Spot' },
      { scene: 5, durationSecs: 14, visual: "Incident resolved quickly. Driver's record shown as clean in the app.", voiceover: 'Quick, accurate reporting resolves claims fast and keeps your record clean.', onScreenText: 'Fast Report = Clean Record' },
      { scene: 6, durationSecs: 12, visual: "Checklist: Stop. Stay. Call. Photograph. Report. Cyan's Brooklynn Recycling logo.", voiceover: 'Stop. Stay. Call. Photograph. Report. In that order. Every time.', onScreenText: 'The 5-Step Incident Protocol' },
    ],
  },
}

// ═══════════════════════════════════════════════════════════════════════════════
// VIDEO DATA — Scripts and storyboards for all 10 training modules.
//
// Keyed by module key. getTrainingModules() merges these into module objects.
// Reading level: ~5th grade. Each video is designed for a 2–4 minute production.
// ═══════════════════════════════════════════════════════════════════════════════

// ── CONSUMER VIDEO DATA ──────────────────────────────────────────────────────

export const CONSUMER_VIDEO_DATA: Record<string, TrainingVideoContent> = {

  // ── safety ──────────────────────────────────────────────────────────────────
  safety: {
    estimatedMinutes: 3,
    script: {
      opening:
        "Welcome to your Safety Training for Cyan's Brooklynn Recycling. " +
        "Before you pick up a single recycling bag, you need to know how to protect yourself. " +
        "Safety is rule number one — on every shift, at every stop.",
      lesson:
        "There are three things you must do before touching any bag. " +
        "First, put on your gloves. Second, make sure you are wearing closed-toe shoes. " +
        "Third, look at the bag before you grab it. Check for leaks, strange smells, sharp objects, or anything unusual. " +
        "If a bag looks unsafe, do not touch it. That's not just a rule — it protects your health and your livelihood.",
      realExample:
        "Here's a real example. A driver arrives at a stop and sees a bag with a dark liquid leaking from the bottom and a strong chemical smell. " +
        "The right move: step back, take a photo, mark it as 'Unsafe Bag' in the app, and move on to the next stop. " +
        "The driver reported it, admin handled it, and the driver stayed healthy. That's how it should work.",
      mistakeToAvoid:
        "The most dangerous mistake is rushing through a safety check. " +
        "A driver once grabbed a bag without looking and cut their hand on broken glass inside. " +
        "The pickup was flagged, the driver lost time, and the injury was painful and preventable. " +
        "Two extra seconds to look at a bag before you grab it can save you from serious harm.",
      positiveOutcome:
        "Drivers who follow safety rules on every pickup stay healthy, stay on route, and build a reputation as professionals. " +
        "Safety-first drivers get more routes and more opportunities because they can be trusted.",
      closingReminder:
        "Remember: gloves on, shoes on, check the bag before you grab it. " +
        "If it looks or smells wrong, don't touch it — report it. " +
        "Safety first. Every pickup. Every time.",
    },
    storyboard: [
      {
        scene: 1, durationSecs: 12,
        visual: "Driver parks vehicle, steps out, and pulls on a pair of gloves. Bright outdoor setting. Calm, professional appearance.",
        voiceover: "Welcome to your Safety Training for Cyan's Brooklynn Recycling. Before you touch any bag, protect yourself.",
        onScreenText: "Safety First — Every Pickup",
      },
      {
        scene: 2, durationSecs: 20,
        visual: "Driver walks toward a recycling bag on the curb. Stops one step away and crouches to visually inspect the bag. Camera shows driver's careful eyes.",
        voiceover: "Before you grab any bag, stop and look at it. Check for leaks, damage, or anything unusual.",
        onScreenText: "Always Inspect Before You Grab",
      },
      {
        scene: 3, durationSecs: 25,
        visual: "Close-up of a leaking bag with red warning overlay. Driver steps back, holds up hand in 'stop' gesture, then takes phone out to photograph it.",
        voiceover: "If a bag is leaking, smells strange, or has something sharp poking out — step back. Take a photo. Mark it Unsafe in the app. Do not touch it.",
        onScreenText: "⚠ Leaking or Damaged Bag = Don't Touch It",
      },
      {
        scene: 4, durationSecs: 25,
        visual: "Driver at a different stop with a clean, sealed bag. Driver scans QR code, bends knees, lifts bag properly with both hands, loads into vehicle.",
        voiceover: "When a bag is safe, scan it, bend your knees to lift it, and load it cleanly. Good posture protects your back.",
        onScreenText: "Scan → Inspect → Lift with Your Knees",
      },
      {
        scene: 5, durationSecs: 20,
        visual: "Driver taps on phone screen, logs the unsafe bag report in the app. App shows green confirmation that the report was submitted.",
        voiceover: "Every unsafe bag must be reported in the app. Never leave without logging what you found.",
        onScreenText: "Always Log Unsafe Bags in the App",
      },
      {
        scene: 6, durationSecs: 10,
        visual: "Driver stands next to vehicle in full gear — gloves on, closed-toe shoes. Gives a thumbs up. Cyan's Brooklynn Recycling logo appears.",
        voiceover: "Gloves, shoes, inspection — every pickup, every time. Stay safe. Stay working.",
        onScreenText: "Cyan's Brooklynn Recycling — Safety First",
      },
    ],
  },

  // ── qr_bag ───────────────────────────────────────────────────────────────────
  qr_bag: {
    estimatedMinutes: 2,
    script: {
      opening:
        "Welcome to QR Bag Scanning training for Cyan's Brooklynn Recycling. " +
        "Every recycling bag has a QR code. That code is your proof that you completed the pickup. " +
        "Scanning it is not optional — it is required every single time.",
      lesson:
        "Here is why the scan matters. The QR code links the bag to the customer's order. " +
        "When you scan it, the system records that you were there, at the right bag, at the right time. " +
        "Without a scan, there is no record. And without a record, you cannot prove you did the work — and you may not get paid for it.",
      realExample:
        "A driver arrives at a stop and the bag is there, ready to go. The driver scans the QR code. " +
        "The app confirms the bag ID. The driver picks up the bag and marks it complete. " +
        "A week later, the customer calls to say their bag was not picked up. " +
        "The driver pulls up the scan record and the dispute is resolved in seconds. That scan saved the driver's pay.",
      mistakeToAvoid:
        "Never pick up a bag without scanning it first. And never scan one bag and claim credit for multiple bags. " +
        "That is fraud. A driver who did this was caught, lost their account, and was permanently removed from the platform. " +
        "There is no shortcut worth that risk.",
      positiveOutcome:
        "Every correct scan protects you, the customer, and the company. " +
        "Drivers who scan every bag build a clean record and earn more route assignments over time.",
      closingReminder:
        "Scan before you grab. Confirm the bag ID. Complete the pickup. " +
        "The scan is your receipt. Never skip it.",
    },
    storyboard: [
      {
        scene: 1, durationSecs: 10,
        visual: "Driver approaches a recycling bag at the curb. Phone is already out. Cyan's Brooklynn Recycling title card.",
        voiceover: "Every bag has a QR code. Scanning it is how you prove the pickup happened.",
        onScreenText: "QR Bag Scanning — Required Every Time",
      },
      {
        scene: 2, durationSecs: 20,
        visual: "Close-up of driver pointing phone camera at the QR code on a bag. App shows 'Bag Verified ✓' with the bag ID.",
        voiceover: "Open the app, scan the QR code, and confirm the bag ID matches your stop. That's the only way to start a pickup.",
        onScreenText: "Step 1: Scan the QR Code",
      },
      {
        scene: 3, durationSecs: 20,
        visual: "Split screen: Left side shows a driver scanning correctly and marking pickup complete. Right side shows a driver grabbing a bag without scanning — red X overlay.",
        voiceover: "Always scan first. Never grab a bag without verifying it in the app — even if you're in a hurry.",
        onScreenText: "No Scan = No Proof = No Pay",
      },
      {
        scene: 4, durationSecs: 20,
        visual: "A bag has a damaged, muddy QR code. Driver tries to scan, can't. Takes a photo of the damaged code, marks it in app as 'QR Code Problem'.",
        voiceover: "If the code won't scan, photograph it, report it in the app, and wait for admin guidance. Never guess.",
        onScreenText: "Damaged Code? Photo + Report",
      },
      {
        scene: 5, durationSecs: 15,
        visual: "Driver on phone — dispute resolution. Admin shows the scan log on screen. Customer complaint resolved.",
        voiceover: "Your scan record is your proof. When a dispute happens, the scan log is what protects you.",
        onScreenText: "Your Scan = Your Protection",
      },
      {
        scene: 6, durationSecs: 10,
        visual: "Driver scanning a bag with confidence. Green checkmark appears on app. Cyan's Brooklynn logo.",
        voiceover: "Scan before you grab. Every bag. Every time.",
        onScreenText: "Scan Every Bag. No Exceptions.",
      },
    ],
  },

  // ── pickup ───────────────────────────────────────────────────────────────────
  pickup: {
    estimatedMinutes: 3,
    script: {
      opening:
        "Welcome to Pickup Procedures training for Cyan's Brooklynn Recycling. " +
        "This module covers exactly what to do at every stop — from checking the address to marking the app when you're done. " +
        "Getting these steps right protects your pay and keeps customers happy.",
      lesson:
        "Every pickup follows the same steps. " +
        "Step one: confirm the address before leaving your vehicle. Step two: check that you are inside the pickup time window. " +
        "Step three: find the bag, scan the QR code, inspect it, and pick it up if it is safe. " +
        "Step four: mark the correct status in the app. Step five: take a photo if the app asks for one or if there is a problem. " +
        "That's it. Five steps. Every time.",
      realExample:
        "Here's what a clean pickup looks like. Driver arrives, confirms address, checks time window, finds the bag at the curb. " +
        "Scans QR code — match confirmed. Bag looks fine. Driver picks it up with proper lifting form, " +
        "marks 'Picked Up' in the app, takes a photo, and drives to the next stop. " +
        "Clean, complete, and documented. That is a professional pickup.",
      mistakeToAvoid:
        "The most common mistake is marking 'Picked Up' without actually completing the stop — or leaving without marking any status at all. " +
        "If a customer says the bag wasn't taken and there's no app record, there's nothing to support you. " +
        "Every stop — even a missed or unsafe one — must be logged with the correct status.",
      positiveOutcome:
        "Drivers who complete every pickup correctly and log every status build a strong, reliable record. " +
        "This leads to more routes, a higher driver rating, and fewer disputes.",
      closingReminder:
        "Confirm address. Check time window. Scan. Inspect. Pickup. Log the status. Take a photo when needed. " +
        "Five steps, every stop. Do them in order and your record will speak for itself.",
    },
    storyboard: [
      {
        scene: 1, durationSecs: 12,
        visual: "Driver sitting in parked vehicle, checking address on phone app. Visible stop location on map.",
        voiceover: "Before stepping out of your vehicle, confirm you are at the right address and inside the pickup window.",
        onScreenText: "Step 1: Confirm Address and Time Window",
      },
      {
        scene: 2, durationSecs: 20,
        visual: "Driver walks to curb. Bag is visible. Driver scans QR code, app shows 'Bag Verified'. Driver inspects bag — looks clean and sealed.",
        voiceover: "Find the bag, scan the QR code, and inspect it before you lift it.",
        onScreenText: "Step 2: Scan and Inspect",
      },
      {
        scene: 3, durationSecs: 20,
        visual: "Driver lifts bag with bent knees. Loads into vehicle. Marks 'Picked Up' in the app. Takes photo.",
        voiceover: "Lift safely, load the bag, mark 'Picked Up' in the app, and take a photo.",
        onScreenText: "Step 3: Pickup → Log → Photo",
      },
      {
        scene: 4, durationSecs: 20,
        visual: "Different stop — no bag at curb. Driver looks around, takes photo of empty location, marks 'Bag Missing' in app.",
        voiceover: "If there's no bag, look around, take a photo of the empty location, and mark 'Bag Missing' in the app.",
        onScreenText: "No Bag? Mark It — Don't Just Leave",
      },
      {
        scene: 5, durationSecs: 20,
        visual: "Another stop — bag is blocked by parked car. Driver photographs the blockage, marks 'Access Blocked' in app, contacts admin.",
        voiceover: "If a bag is blocked or inaccessible, document it and report it. Never take risks to reach a blocked bag.",
        onScreenText: "Blocked? Document and Report",
      },
      {
        scene: 6, durationSecs: 15,
        visual: "Driver completes a stop, app shows completion checkmark. Driver smiles, moves to next stop.",
        voiceover: "Every stop logged. Every status correct. That's what a professional driver does.",
        onScreenText: "Log Every Stop — Every Time",
      },
    ],
  },

  // ── customer ─────────────────────────────────────────────────────────────────
  customer: {
    estimatedMinutes: 3,
    script: {
      opening:
        "Welcome to Customer Service and Privacy training for Cyan's Brooklynn Recycling. " +
        "Every time you interact with a customer, you represent the company. " +
        "How you act — and how you protect customer information — directly affects our reputation.",
      lesson:
        "Good customer interaction is simple. Stay calm, be respectful, and never argue — even if the customer is wrong. " +
        "If a customer has a complaint, listen, apologize, and log it in the app. You are not there to solve every problem on the spot. " +
        "You are there to be professional and report what happened. " +
        "Customer privacy means their name, address, phone number, and pickup schedule stay private — always.",
      realExample:
        "A customer approaches you and says their bag wasn't picked up last week. They're frustrated. " +
        "You don't argue. You say: 'I'm sorry about that. Let me log this right now so our team can follow up with you.' " +
        "You log the complaint in the app and move on. The customer feels heard, the issue is documented, and you stay professional. " +
        "That's how you handle it.",
      mistakeToAvoid:
        "Never accept cash from a customer for extra pickups. Never go inside a customer's home. " +
        "Never share one customer's information with another customer or anyone outside the company. " +
        "A driver who accepted a cash payment from a customer for extra pickups outside the app was terminated immediately. " +
        "All pickups go through the app. No exceptions.",
      positiveOutcome:
        "Professional drivers build trust with customers and with the company. " +
        "This leads to better routes, more opportunities, and a reputation that follows you throughout your career.",
      closingReminder:
        "Stay calm. Be respectful. Log complaints. Protect customer privacy. " +
        "You are the face of Cyan's Brooklynn Recycling. Make it a good one.",
    },
    storyboard: [
      {
        scene: 1, durationSecs: 10,
        visual: "Driver on route, professional appearance, Cyan's Brooklynn Recycling branding visible. Title card.",
        voiceover: "Every interaction you have with a customer represents Cyan's Brooklynn Recycling.",
        onScreenText: "You Are the Face of Cyan's Brooklynn",
      },
      {
        scene: 2, durationSecs: 22,
        visual: "Customer approaches driver with a frustrated expression. Driver stays calm, nods, opens the app.",
        voiceover: "When a customer is upset, stay calm. Listen. Say you'll log it. Never argue — even if you think they're wrong.",
        onScreenText: "Stay Calm. Listen. Log It.",
      },
      {
        scene: 3, durationSecs: 20,
        visual: "Customer offers driver cash. Driver holds up hand politely, shakes head, points to phone — directing customer to the app.",
        voiceover: "If a customer offers you cash for extra pickups, decline politely. Extra pickups must go through the app.",
        onScreenText: "No Off-App Payments. Ever.",
      },
      {
        scene: 4, durationSecs: 20,
        visual: "Customer asks driver a question about their neighbor. Driver smiles, shakes head — 'I can't share that information.'",
        voiceover: "Customer privacy is protected. Never share addresses, schedules, or personal information with anyone.",
        onScreenText: "Customer Privacy Is Protected",
      },
      {
        scene: 5, durationSecs: 20,
        visual: "Driver logs a complaint in the app. Green confirmation appears. Driver continues to next stop — calm and professional.",
        voiceover: "Log complaints in the app. That's how you protect yourself and help the company fix problems.",
        onScreenText: "Log It. Don't Solve It on the Spot.",
      },
      {
        scene: 6, durationSecs: 15,
        visual: "Driver waves goodbye to a satisfied customer. App shows 5-star rating. Cyan's Brooklynn logo.",
        voiceover: "Professional drivers build trust. Trust builds routes. Routes build careers.",
        onScreenText: "Professional Behavior = More Opportunities",
      },
    ],
  },

  // ── photo ────────────────────────────────────────────────────────────────────
  photo: {
    estimatedMinutes: 2,
    script: {
      opening:
        "Welcome to Photo Verification training for Cyan's Brooklynn Recycling. " +
        "Photos are how you prove your work. A clear, honest photo protects your pay and resolves disputes fast.",
      lesson:
        "The app will ask you for a photo at certain pickups. When it does, take one — a clear, well-lit photo of the bag or the pickup location. " +
        "You should also take a photo any time a bag is unsafe, missing, or blocked — even if the app doesn't ask. " +
        "Photos must always be real and taken at the time of the pickup. Never use an old photo. Never edit or fake a photo.",
      realExample:
        "A driver arrives and the pickup location is empty. No bag. The driver takes a clear photo of the empty curb, marks the pickup as 'Bag Missing', and logs it. " +
        "Later, the customer claims the bag was at the curb. The photo shows otherwise. " +
        "The dispute is resolved in the driver's favor — because the photo was there.",
      mistakeToAvoid:
        "Never reuse a photo from a previous pickup. Never upload a blurry or unclear photo. " +
        "A driver once uploaded a photo from a stop they visited three days earlier to cover a pickup they skipped. " +
        "Admin detected the metadata mismatch. The driver was terminated for fraud. " +
        "Your photos are checked. Always take a real one.",
      positiveOutcome:
        "Good photos protect your earnings, resolve disputes quickly, and show the company that you are honest and thorough. " +
        "Drivers with clean photo records have the fewest problems.",
      closingReminder:
        "Take the photo when asked. Make it clear. Make it honest. Make it current. " +
        "Your photo is your evidence.",
    },
    storyboard: [
      {
        scene: 1, durationSecs: 10,
        visual: "Driver at a pickup holding up phone camera, bag visible and centered in frame. Clean outdoor light.",
        voiceover: "Photos prove your work. The app asks for them — and you should take them whenever something looks wrong too.",
        onScreenText: "Photo Verification — Required and Protective",
      },
      {
        scene: 2, durationSecs: 20,
        visual: "Driver takes photo of a sealed bag clearly visible at curb. App accepts it — green checkmark.",
        voiceover: "A good photo is clear, well-lit, and shows the bag at the pickup location.",
        onScreenText: "Clear. Well-Lit. Bag in Frame.",
      },
      {
        scene: 3, durationSecs: 18,
        visual: "Driver arrives at empty curb. Takes photo of empty location. Marks 'Bag Missing'. Log confirmed.",
        voiceover: "If there's no bag, photograph the empty location. That photo is your evidence.",
        onScreenText: "Empty Location = Photo + Report",
      },
      {
        scene: 4, durationSecs: 20,
        visual: "Split screen: Left — driver taking a fresh, clear photo (green check). Right — driver attempting to upload an old photo (red X, 'fraud detected' label).",
        voiceover: "Every photo must be taken right now, at this stop. Never reuse old photos — they are detected and it will end your account.",
        onScreenText: "⚠ Reusing Old Photos = Fraud = Termination",
      },
      {
        scene: 5, durationSecs: 15,
        visual: "Driver and admin reviewing dispute on screen. Driver's photo resolves the issue. Driver shown as verified and cleared.",
        voiceover: "Your photo is what protects you when a customer disputes a pickup.",
        onScreenText: "Your Photo = Your Proof",
      },
      {
        scene: 6, durationSecs: 12,
        visual: "Driver takes clear photo, app confirms. Cyan's Brooklynn Recycling logo.",
        voiceover: "Take the photo when asked. Make it honest. Make it current. That's it.",
        onScreenText: "Honest Photos. Every Time.",
      },
    ],
  },
}

// ── Back-compat alias ────────────────────────────────────────────────────────
// TRAINING_MODULE_DATA was the original export before the consumer/commercial split.
// New code should use getTrainingModules(isCommercial) or the named exports directly.
export const TRAINING_MODULE_DATA: TrainingModuleContent[] = CONSUMER_TRAINING_MODULES
