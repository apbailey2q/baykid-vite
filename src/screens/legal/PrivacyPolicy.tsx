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

export default function PrivacyPolicy() {
  const navigate  = useNavigate()
  const [a, setA] = useState(false)
  useEffect(() => { const id = requestAnimationFrame(() => setA(true)); return () => cancelAnimationFrame(id) }, [])

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden" style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}>
      <div className="pointer-events-none absolute inset-0 grid-bg" />
      <div className="pointer-events-none absolute" style={{ top: -80, left: -60, width: 280, height: 280, background: 'rgba(0,87,231,0.14)', filter: 'blur(72px)', borderRadius: '50%' }} />

      <header className="relative flex items-center justify-between px-4 py-3" style={{ background: 'rgba(4,10,24,0.92)', borderBottom: '1px solid rgba(0,200,255,0.12)', backdropFilter: 'blur(12px)', zIndex: 2 }}>
        <div className="flex items-center gap-3">
          <span className="text-xl font-extrabold" style={{ color: '#00c8ff' }}>BayKid</span>
          <span style={{ color: 'rgba(0,200,255,0.3)' }}>|</span>
          <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>Privacy Policy</span>
        </div>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
          ← Back
        </button>
      </header>

      <div className="relative flex-1 overflow-y-auto pb-20" style={{ zIndex: 1 }}>
        <div className="max-w-[520px] mx-auto px-4 pt-8 pb-8 flex flex-col gap-4">

          {/* Header block */}
          <div style={fade(a, 0)}>
            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest mb-3 inline-block" style={{ background: 'rgba(0,200,255,0.1)', border: '1px solid rgba(0,200,255,0.3)', color: '#00c8ff' }}>
              Legal
            </span>
            <h1 className="text-2xl font-extrabold mb-1.5" style={{ color: '#ffffff' }}>Privacy Policy</h1>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Last updated May 2026. This policy applies to the BayKid platform operated by Cyan's Brooklynn Recycling Enterprise. By using this platform you agree to the practices described here.
            </p>
          </div>

          {/* 1. Who We Are */}
          <Section title="1. Who We Are" delay={60} a={a}>
            <p>
              Cyan's Brooklynn Recycling Enterprise ("we", "us", "our") operates the BayKid platform — a commercial and consumer recycling logistics application. Our platform serves consumers, commercial customers, drivers, warehouse staff, and partner organizations in the Nashville, TN area and beyond.
            </p>
            <p className="mt-2">
              Contact: <a href="mailto:support@cyansbrooklynnrecycling.com" style={{ color: '#00c8ff', textDecoration: 'none' }}>support@cyansbrooklynnrecycling.com</a>
            </p>
          </Section>

          {/* 2. Information We Collect */}
          <Section title="2. Information We Collect" delay={90} a={a}>
            <p>We collect the following information when you use the BayKid platform:</p>
            <p className="mt-3" style={{ fontWeight: 700, color: 'rgba(255,255,255,0.75)' }}>Account Information</p>
            <Ul items={[
              'Full name, email address, and phone number provided at registration.',
              'Your assigned role (consumer, driver, warehouse staff, commercial account, partner, admin).',
              'Approval status and account creation date.',
            ]} />
            <p className="mt-3" style={{ fontWeight: 700, color: 'rgba(255,255,255,0.75)' }}>Location Data</p>
            <Ul items={[
              'GPS coordinates collected from drivers during active commercial route sessions.',
              'Location is used for route tracking, stop sequencing, and estimated arrival times.',
              'Location collection stops when a driver goes offline or completes their route.',
              "Consumer location is never collected by this platform.",
            ]} />
            <p className="mt-3" style={{ fontWeight: 700, color: 'rgba(255,255,255,0.75)' }}>Inspection & Scan Photos</p>
            <Ul items={[
              'Photos captured during commercial load inspections and support requests.',
              'QR bag scans are logged as scan records — not stored as images.',
              'Photos are uploaded to secure cloud storage and may be reviewed by admins and AI systems.',
            ]} />
            <p className="mt-3" style={{ fontWeight: 700, color: 'rgba(255,255,255,0.75)' }}>Financial Records</p>
            <Ul items={[
              'Consumer wallet earning records and payout history.',
              'Commercial account invoice records and payment status.',
              'Driver earning records per route and per bag.',
              'Card numbers and full payment details are handled by Stripe and are never stored on our servers.',
            ]} />
            <p className="mt-3" style={{ fontWeight: 700, color: 'rgba(255,255,255,0.75)' }}>Device & Notification Data</p>
            <Ul items={[
              'Push notification device tokens to deliver operational alerts.',
              'Tokens are removed when you log out or uninstall the application.',
            ]} />
            <p className="mt-3" style={{ fontWeight: 700, color: 'rgba(255,255,255,0.75)' }}>Support & Audit Records</p>
            <Ul items={[
              'Support requests and communications submitted via the app.',
              'Platform audit logs recording key actions: inspections, overrides, route completions, admin decisions. Retained for a minimum of 2 years.',
            ]} />
          </Section>

          {/* 3. How We Use Your Data */}
          <Section title="3. How We Use Your Data" delay={120} a={a}>
            <p>Your data is used only to operate and improve the BayKid platform:</p>
            <Ul items={[
              'Routing drivers to scheduled pickup stops and commercial locations.',
              'Warehouse intake, weight logging, and contamination tracking.',
              'AI-assisted safety inspection analysis (advisory only — never automated decisions).',
              'Billing commercial accounts and processing driver and consumer payouts.',
              'Delivering operational push notifications (route alerts, safety alerts, billing updates, support replies).',
              'Detecting and preventing fraud, policy violations, and unsafe activity.',
              'Compliance with applicable law and regulatory requirements.',
              'Responding to support requests and account inquiries.',
            ]} />
            <p className="mt-3">We do not use your data for advertising or sell it to third parties for marketing purposes.</p>
          </Section>

          {/* 4. GPS Tracking Disclosure */}
          <Section title="4. GPS Tracking Disclosure" delay={150} a={a}>
            <p>
              GPS location data is collected from commercial route drivers only. Location tracking is active only while a driver is online and has an active route session. Tracking stops automatically when the driver marks themselves offline or completes their assigned route.
            </p>
            <p className="mt-2">
              Drivers are not tracked off-duty, between shifts, or while navigating outside of an active route session. Location data is stored per route session and is used solely for route management, stop sequencing, and estimated arrival time calculation.
            </p>
            <p className="mt-2">
              Consumer users are never subject to location tracking by this platform. Commercial customers' facility addresses are stored as part of their service agreement — not live location data.
            </p>
          </Section>

          {/* 5. Photo Upload Disclosure */}
          <Section title="5. Photo Upload Disclosure" delay={180} a={a}>
            <p>
              Inspection photos are uploaded during commercial load inspections and may also be submitted with support requests. Uploaded photos:
            </p>
            <Ul items={[
              'Are stored in secure, access-controlled cloud storage.',
              'May be reviewed by warehouse supervisors and platform administrators.',
              'Are analyzed by AI image classification systems to assist with load safety categorization. AI results are advisory only.',
              'Are retained as part of the inspection audit record for a minimum of 2 years.',
              'Are accessible only to users with a legitimate operational need (admin, warehouse supervisor).',
            ]} />
            <p className="mt-2">
              The app does not access your device photo library without your explicit permission. When you grant photo library access, only the specific photo you select is uploaded.
            </p>
          </Section>

          {/* 6. Push Notifications */}
          <Section title="6. Push Notifications" delay={210} a={a}>
            <p>With your permission, we send push notifications for:</p>
            <Ul items={[
              'Route assignments, schedule changes, and stop alerts (drivers).',
              'Inspection review results and safety escalations (drivers, warehouse staff).',
              'Billing updates and invoice reminders (commercial accounts).',
              'Support replies and account status updates (all users).',
              'Emergency safety alerts during active routes (drivers).',
            ]} />
            <p className="mt-2">
              We do not send marketing, promotional, or unsolicited push notifications. You can manage or disable push notifications at any time in your device settings or through the app's notification preferences.
            </p>
          </Section>

          {/* 7. Payment Processing */}
          <Section title="7. Payment Processing" delay={240} a={a}>
            <p>
              Payments and payouts on the BayKid platform are processed by <strong style={{ color: 'rgba(255,255,255,0.8)' }}>Stripe</strong>, a PCI-compliant payment processor. Cyan's Brooklynn Recycling Enterprise does not store, transmit, or have access to your full card number, CVV, or bank account credentials.
            </p>
            <p className="mt-2">
              Stripe's collection and use of payment data is governed by the <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: '#00c8ff', textDecoration: 'none' }}>Stripe Privacy Policy</a>. Invoice records, payout totals, and payment status are stored in our platform for billing and compliance purposes.
            </p>
          </Section>

          {/* 8. Data Sharing */}
          <Section title="8. Data Sharing" delay={270} a={a}>
            <p>We share your data only in the following limited circumstances:</p>
            <Ul items={[
              'With Stripe for payment processing.',
              'With cloud infrastructure providers (Supabase) who store data on our behalf under data processing agreements.',
              'With AI analysis providers for inspection image classification, under strict data handling terms.',
              'With law enforcement or regulatory authorities when required by applicable law.',
              'With administrators within our organization who have a legitimate operational need.',
            ]} />
            <p className="mt-2">We do not sell, rent, or share your personal data with third parties for advertising or marketing purposes.</p>
          </Section>

          {/* 9. Data Retention */}
          <Section title="9. Data Retention" delay={300} a={a}>
            <p>We retain your data for as long as your account is active and as required by law or operational need:</p>
            <Ul items={[
              'Account profile data: retained while your account is active; deleted within 30 days of a verified deletion request.',
              'Bag scan and route history: retained for the life of your account.',
              'Inspection photos and audit records: retained for a minimum of 2 years for regulatory compliance.',
              'Financial records: retained as required by applicable tax and accounting law (typically 7 years).',
              'Push notification tokens: removed on logout or uninstall.',
              'Support communications: retained for 2 years.',
            ]} />
          </Section>

          {/* 10. Your Rights */}
          <Section title="10. Your Rights" delay={330} a={a}>
            <p>Depending on your location, you may have the following rights regarding your personal data:</p>
            <Ul items={[
              'Access: request a copy of the personal data we hold about you.',
              'Correction: request correction of inaccurate or incomplete data.',
              'Deletion: request deletion of your account and associated personal data (subject to retention requirements for compliance records).',
              'Portability: request an export of your data in a machine-readable format.',
              'Objection: object to certain processing of your data.',
              'Notification preferences: manage or disable push notifications at any time.',
            ]} />
            <p className="mt-2">
              To exercise any of these rights, submit a request to{' '}
              <a href="mailto:support@cyansbrooklynnrecycling.com" style={{ color: '#00c8ff', textDecoration: 'none' }}>support@cyansbrooklynnrecycling.com</a> or use the{' '}
              <Link to="/legal/data-deletion" style={{ color: '#00c8ff', textDecoration: 'none' }}>Data Deletion Request</Link> screen in the app.
              We will respond within 30 days.
            </p>
          </Section>

          {/* 11. Security */}
          <Section title="11. Security" delay={360} a={a}>
            <p>
              All data transmitted between the BayKid app and our servers is encrypted using TLS. Data at rest is encrypted by our cloud storage provider. Access to personal data is restricted by role-based access controls — drivers can only see their own stops, warehouse staff can only access their assigned facility's loads, and consumers can only see their own bag history.
            </p>
            <p className="mt-2">
              While we take reasonable measures to protect your data, no system is completely secure. If you discover a security concern, please report it to <a href="mailto:support@cyansbrooklynnrecycling.com" style={{ color: '#00c8ff', textDecoration: 'none' }}>support@cyansbrooklynnrecycling.com</a>.
            </p>
          </Section>

          {/* 12. Children */}
          <Section title="12. Children's Privacy" delay={390} a={a}>
            <p>
              The BayKid platform is not directed at children under the age of 13 and we do not knowingly collect personal data from children. If you believe a child has provided us with personal data, please contact us immediately and we will delete it.
            </p>
          </Section>

          {/* 13. Changes */}
          <Section title="13. Changes to This Policy" delay={420} a={a}>
            <p>
              We may update this Privacy Policy from time to time. When we do, we will update the "Last updated" date at the top of this page and, where required, notify affected users via push notification or email. Continued use of the platform after the effective date constitutes acceptance of the updated policy.
            </p>
          </Section>

          {/* Contact strip */}
          <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', ...fade(a, 450) }}>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textAlign: 'center', lineHeight: 1.7 }}>
              Privacy questions?{' '}
              <a href="mailto:support@cyansbrooklynnrecycling.com" style={{ color: '#00c8ff', textDecoration: 'none' }}>support@cyansbrooklynnrecycling.com</a>
              <br />Cyan's Brooklynn Recycling Enterprise · Nashville, TN
            </p>
          </div>

          {/* Cross-links */}
          <div className="flex items-center justify-center gap-4" style={fade(a, 470)}>
            <Link to="/legal/terms-of-service" style={{ fontSize: 11, color: 'rgba(0,200,255,0.7)', textDecoration: 'none' }}>Terms of Service</Link>
            <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 11 }}>·</span>
            <Link to="/legal/contact" style={{ fontSize: 11, color: 'rgba(0,200,255,0.7)', textDecoration: 'none' }}>Contact Support</Link>
            <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 11 }}>·</span>
            <Link to="/legal/data-deletion" style={{ fontSize: 11, color: 'rgba(0,200,255,0.7)', textDecoration: 'none' }}>Data Deletion</Link>
          </div>

        </div>
      </div>
    </div>
  )
}
