import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'

function fade(a: boolean, d = 0): React.CSSProperties {
  return {
    opacity:    a ? 1 : 0,
    transform:  a ? 'translateY(0)' : 'translateY(14px)',
    transition: `opacity 0.4s ease ${d}ms, transform 0.4s ease ${d}ms`,
  }
}

function Section({ title, children, delay, a }: { title: string; children: React.ReactNode; delay: number; a: boolean }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: 'rgba(0,87,231,0.07)', border: '1px solid rgba(0,200,255,0.13)', ...fade(a, delay) }}>
      <p style={{ fontSize: 13, fontWeight: 800, color: '#ffffff', marginBottom: 10 }}>{title}</p>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.75 }}>
        {children}
      </div>
    </div>
  )
}

function Ul({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-1.5 mt-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2">
          <span style={{ color: 'rgba(0,200,255,0.5)', flexShrink: 0 }}>›</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

export default function TermsOfService() {
  const navigate  = useNavigate()
  const [a, setA] = useState(false)
  useEffect(() => { const id = requestAnimationFrame(() => setA(true)); return () => cancelAnimationFrame(id) }, [])

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden" style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}>
      <div className="pointer-events-none absolute inset-0 grid-bg" />
      <div className="pointer-events-none absolute" style={{ bottom: -60, right: -40, width: 240, height: 240, background: 'rgba(94,234,212,0.07)', filter: 'blur(64px)', borderRadius: '50%' }} />

      <header className="relative flex items-center justify-between px-4 py-3" style={{ background: 'rgba(4,10,24,0.92)', borderBottom: '1px solid rgba(0,200,255,0.12)', backdropFilter: 'blur(12px)', zIndex: 2 }}>
        <div className="flex items-center gap-3">
          <span className="text-xl font-extrabold" style={{ color: '#00c8ff' }}>Cyan's Brooklynn</span>
          <span style={{ color: 'rgba(0,200,255,0.3)' }}>|</span>
          <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>Terms of Service</span>
        </div>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
          ← Back
        </button>
      </header>

      <div className="relative flex-1 overflow-y-auto pb-20" style={{ zIndex: 1 }}>
        <div className="max-w-[520px] mx-auto px-4 pt-8 pb-8 flex flex-col gap-4">

          {/* Header block */}
          <div style={fade(a, 0)}>
            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest mb-3 inline-block" style={{ background: 'rgba(94,234,212,0.1)', border: '1px solid rgba(94,234,212,0.3)', color: '#5eead4' }}>
              Legal
            </span>
            <h1 className="text-2xl font-extrabold mb-1.5" style={{ color: '#ffffff' }}>Terms of Service</h1>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Last updated May 2026. These Terms of Service ("Terms") govern your use of the Cyan's Brooklynn platform operated by Cyan's Brooklynn Recycling Enterprise ("we", "us", "our"). By accessing or using the platform, you agree to these Terms.
            </p>
          </div>

          {/* 1. Acceptance */}
          <Section title="1. Acceptance of Terms" delay={60} a={a}>
            <p>
              By creating an account or using any part of the Cyan's Brooklynn platform, you confirm that you are at least 18 years old (or have parental consent), that you have read and understood these Terms, and that you agree to be bound by them. If you do not agree, do not use the platform.
            </p>
          </Section>

          {/* 2. User Responsibilities */}
          <Section title="2. General User Responsibilities" delay={90} a={a}>
            <p>All users of the Cyan's Brooklynn platform agree to:</p>
            <Ul items={[
              'Provide accurate, truthful account information and keep it up to date.',
              'Use the platform only for lawful recycling and logistics purposes.',
              'Not impersonate another user, employee, or organization.',
              'Not attempt to bypass, tamper with, or reverse-engineer any platform security or access control.',
              'Not submit false inspection results, fraudulent bag scans, or inaccurate weight data.',
              'Report safety concerns and incidents promptly and honestly.',
              'Comply with all applicable local, state, and federal laws regarding waste disposal and recycling.',
            ]} />
          </Section>

          {/* 3. Prohibited Materials */}
          <Section title="3. Prohibited Materials" delay={120} a={a}>
            <p>
              The following materials are strictly prohibited from all recycling bags, bins, and loads submitted through the Cyan's Brooklynn platform:
            </p>
            <Ul items={[
              'Medical waste, sharps, needles, or biohazardous materials.',
              'Hazardous chemicals, solvents, pesticides, or flammable materials.',
              'Biological contamination or human/animal waste.',
              'Batteries not designated as accepted by your service agreement.',
              'Any living organism.',
              'Electronics not pre-approved under your service tier.',
              'Any material that poses a risk of fire, explosion, or injury.',
            ]} />
            <p className="mt-2">
              Loads found to contain prohibited materials may be refused, quarantined, or subject to contamination fees. Repeated violations may result in account suspension or termination.
            </p>
          </Section>

          {/* 4. Consumer Terms */}
          <Section title="4. Consumer User Terms" delay={150} a={a}>
            <p>As a consumer account holder, you agree to:</p>
            <Ul items={[
              'Place only clean, sortable recyclables in Cyan\'s Brooklynn-issued bags.',
              'Not tamper with, resell, or transfer assigned QR-coded bags.',
              'Provide accurate pickup location information.',
              'Not attempt to scan bags not assigned to your account.',
              'Accept that bag scan earnings are subject to verification and may be reversed in cases of fraud.',
              'Follow fundraiser campaign rules when directing earnings to a cause.',
            ]} />
          </Section>

          {/* 5. Commercial Service Terms */}
          <Section title="5. Commercial Account Terms" delay={180} a={a}>
            <p>Commercial account holders additionally agree to:</p>
            <Ul items={[
              'Schedule pickups through the app or with your assigned account representative.',
              'Ensure all loads are accessible, properly contained, and within agreed weight limits at the scheduled pickup time.',
              'Comply with all load inspection procedures, including AI-assisted and manual review.',
              'Accept that contaminated loads may be refused or quarantined and billed accordingly.',
              'Pay invoices within 30 days. Late payments accrue interest at 1.5% per month.',
              'Provide 30 days written notice to terminate commercial service.',
              'Inform all staff who interact with recycling bins of these Terms and the prohibited materials list.',
            ]} />
            <p className="mt-2">
              Full commercial account terms are detailed in the{' '}
              <Link to="/legal/commercial-terms" style={{ color: '#00c8ff', textDecoration: 'none' }}>Commercial Service Terms</Link>.
            </p>
          </Section>

          {/* 6. Driver Terms */}
          <Section title="6. Driver Terms" delay={210} a={a}>
            <p>All commercial route drivers agree to:</p>
            <Ul items={[
              'Complete the mandatory driver safety checklist before each route.',
              'Operate vehicles safely and in compliance with all traffic laws.',
              'Complete load inspections as required by the platform and by company policy.',
              'Refuse loads that present an immediate safety risk, regardless of AI result.',
              'Allow GPS location tracking while online and on an active route session.',
              'Comply with all CB Recycling driver safety guidelines.',
              'Report all safety incidents, near-misses, and refusals in the app on the same day.',
              'Not divert loads to unauthorized locations.',
              'Not falsify inspection results, override AI results without a documented reason, or skip mandatory steps.',
            ]} />
            <p className="mt-2">
              Detailed driver safety requirements are in the{' '}
              <Link to="/legal/driver-safety" style={{ color: '#00c8ff', textDecoration: 'none' }}>Driver Safety Guidelines</Link>.
            </p>
          </Section>

          {/* 7. Warehouse Terms */}
          <Section title="7. Warehouse Staff Terms" delay={240} a={a}>
            <p>Warehouse employees and supervisors agree to:</p>
            <Ul items={[
              'Perform intake inspections on all incoming commercial loads using the Cyan\'s Brooklynn platform.',
              'Accurately record load weights, classifications (green/yellow/red), and contamination observations.',
              'Quarantine red-classified loads and escalate to a supervisor before processing.',
              'Not process loads that have not been formally received and classified.',
              'Report platform errors, scanning issues, or safety concerns promptly.',
              'Follow all facility safety protocols, including PPE requirements.',
              'Access only loads assigned to their facility.',
            ]} />
          </Section>

          {/* 8. AI Disclaimer */}
          <Section title="8. AI Inspection Disclaimer" delay={270} a={a}>
            <p>
              The Cyan's Brooklynn platform uses AI image analysis to assist with load inspection and safety classification. AI results are <strong style={{ color: 'rgba(255,255,255,0.85)' }}>advisory only</strong> and do not constitute a final determination of load safety, contamination, or acceptability.
            </p>
            <p className="mt-2">
              AI results must always be reviewed by a qualified driver, warehouse staff member, or administrator before action is taken. AI systems may generate incorrect results. Cyan's Brooklynn Recycling Enterprise is not liable for outcomes resulting from reliance on AI results without human review.
            </p>
            <p className="mt-2">
              No AI result will automatically complete a stop, reject a load, issue a payment, or trigger any action without human confirmation. All AI overrides are logged and reviewed by platform administrators.
            </p>
          </Section>

          {/* 9. Payment Terms */}
          <Section title="9. Payment Terms" delay={300} a={a}>
            <p style={{ fontWeight: 700, color: 'rgba(255,255,255,0.75)' }}>Consumer Earnings</p>
            <p>
              Consumer wallet earnings from bag scans are subject to verification. Fraudulent scans may result in earning reversal and account suspension. Earnings are withdrawn via the payout methods available in the app, subject to minimum withdrawal thresholds.
            </p>
            <p className="mt-3" style={{ fontWeight: 700, color: 'rgba(255,255,255,0.75)' }}>Commercial Invoices</p>
            <p>
              Commercial invoices are due within 30 days of issuance. Billing disputes must be submitted within 14 days of invoice date. Late payments accrue interest at 1.5% per month. We reserve the right to suspend service for accounts more than 60 days past due.
            </p>
            <p className="mt-3" style={{ fontWeight: 700, color: 'rgba(255,255,255,0.75)' }}>Driver Payments</p>
            <p>
              Driver earnings are calculated per stop and per bag weight as specified in the driver agreement. Payouts are processed through the app on the applicable payment schedule. Earnings may be adjusted for cancelled stops, contamination refusals, or fraudulent activity.
            </p>
            <p className="mt-3" style={{ fontWeight: 700, color: 'rgba(255,255,255,0.75)' }}>Payment Processing</p>
            <p>
              All payment processing is handled by Stripe. We do not store card numbers or banking credentials. By using payment features, you also agree to Stripe's Terms of Service.
            </p>
          </Section>

          {/* 10. Account Suspension */}
          <Section title="10. Account Suspension & Termination" delay={330} a={a}>
            <p>We reserve the right to suspend or terminate any account for:</p>
            <Ul items={[
              'Submitting prohibited materials or falsifying load content.',
              'Fraudulent bag scans, payment fraud, or earnings manipulation.',
              'Bypassing or tampering with safety inspection requirements.',
              'Unsafe operation of a vehicle during a route.',
              'Harassment, threats, or abuse directed at platform staff or users.',
              'Repeated contamination of loads after warning.',
              'Violation of any provision of these Terms.',
              'Activity that poses an immediate safety risk to any person.',
            ]} />
            <p className="mt-2">
              Upon suspension, access to the platform is revoked. Outstanding invoices remain due. Pending earnings may be withheld pending investigation. You may appeal a suspension by contacting <a href="mailto:support@cyansbrooklynnrecycling.com" style={{ color: '#00c8ff', textDecoration: 'none' }}>support@cyansbrooklynnrecycling.com</a>.
            </p>
          </Section>

          {/* 11. Limitation of Liability */}
          <Section title="11. Limitation of Liability" delay={360} a={a}>
            <p>
              To the fullest extent permitted by applicable law, Cyan's Brooklynn Recycling Enterprise's liability to you for any claim arising out of or related to your use of the Cyan's Brooklynn platform is limited to the fees you paid for the service in the three months preceding the claim.
            </p>
            <p className="mt-2">We are not liable for:</p>
            <Ul items={[
              'Service interruptions, outages, or delays caused by infrastructure, weather, or force majeure.',
              'Route delays or missed pickups caused by traffic, safety conditions, or driver availability.',
              'Contamination disputes where the commercial account submitted prohibited materials.',
              'Loss of earnings caused by account suspension for policy violations.',
              'Actions or omissions of third-party services including Stripe, OSRM routing, or AI providers.',
              'Indirect, incidental, consequential, or punitive damages.',
            ]} />
            <p className="mt-2">
              Nothing in these Terms limits liability for personal injury caused by our negligence, or for fraud, or where limitation is prohibited by law.
            </p>
          </Section>

          {/* 12. Governing Law */}
          <Section title="12. Governing Law" delay={390} a={a}>
            <p>
              These Terms are governed by the laws of the State of Tennessee. Disputes shall be resolved in the courts of Davidson County, Tennessee. If any provision of these Terms is found to be unenforceable, the remaining provisions continue in full effect. These Terms constitute the entire agreement between you and Cyan's Brooklynn Recycling Enterprise regarding your use of the Cyan's Brooklynn platform.
            </p>
          </Section>

          {/* 13. Changes */}
          <Section title="13. Changes to These Terms" delay={420} a={a}>
            <p>
              We may update these Terms at any time. When we do, we will update the "Last updated" date and notify users via push notification or email where required. Continued use of the platform after the effective date of the updated Terms constitutes your acceptance.
            </p>
          </Section>

          {/* Contact strip */}
          <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', ...fade(a, 450) }}>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textAlign: 'center', lineHeight: 1.7 }}>
              Questions about these Terms?{' '}
              <a href="mailto:support@cyansbrooklynnrecycling.com" style={{ color: '#00c8ff', textDecoration: 'none' }}>support@cyansbrooklynnrecycling.com</a>
              <br />Cyan's Brooklynn Recycling Enterprise · Nashville, TN
            </p>
          </div>

          {/* Cross-links */}
          <div className="flex items-center justify-center gap-4" style={fade(a, 470)}>
            <Link to="/legal/privacy-policy" style={{ fontSize: 11, color: 'rgba(0,200,255,0.7)', textDecoration: 'none' }}>Privacy Policy</Link>
            <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 11 }}>·</span>
            <Link to="/legal/contact" style={{ fontSize: 11, color: 'rgba(0,200,255,0.7)', textDecoration: 'none' }}>Contact Support</Link>
            <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 11 }}>·</span>
            <Link to="/legal" style={{ fontSize: 11, color: 'rgba(0,200,255,0.7)', textDecoration: 'none' }}>Legal Center</Link>
          </div>

        </div>
      </div>
    </div>
  )
}
