import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'

interface PolicyLink {
  icon:     string
  title:    string
  desc:     string
  href:     string
  external: boolean
}

const POLICIES: PolicyLink[] = [
  { icon: '🔒', title: 'Privacy Policy',             desc: 'What data we collect, how we use it, and your rights.',           href: '/legal/privacy-policy',     external: false },
  { icon: '📋', title: 'Terms of Service',            desc: "The rules and conditions for using the Cyan's Brooklynn platform.",         href: '/legal/terms-of-service',   external: false },
  { icon: '🛡️', title: 'Safety Policy',               desc: 'How we keep drivers, warehouse staff, and communities safe.',     href: '/legal/safety',             external: false },
  { icon: '🚛', title: 'Driver Safety Guidelines',   desc: 'Required safety standards for all commercial route drivers.',     href: '/legal/driver-safety',      external: false },
  { icon: '🏢', title: 'Commercial Service Terms',   desc: 'Terms specific to commercial recycling accounts and pickups.',    href: '/legal/commercial-terms',   external: false },
  { icon: '🗑️', title: 'Data Deletion Request',       desc: 'Request deletion of your account and personal data.',            href: '/legal/data-deletion',      external: false },
  { icon: '💬', title: 'Contact Support',             desc: 'Get help, report issues, or reach our team directly.',           href: '/legal/contact',            external: false },
]

const PERMISSIONS = [
  {
    icon:   '📷',
    name:   'Camera',
    why:    'Required for QR code scanning of recycling bags and for capturing commercial inspection photos.',
    when:   'Used only when you actively open the scan or inspection screen.',
    stored: 'Photos are uploaded to secure cloud storage. QR scans are not stored as images.',
  },
  {
    icon:   '📍',
    name:   'Location',
    why:    'Used by commercial drivers to enable real-time route tracking while completing assigned stops.',
    when:   'Collected only while you are online and actively on a commercial route. Stops when you go offline or complete the route.',
    stored: 'Location data is stored per route session and not retained after route completion.',
  },
  {
    icon:   '🔔',
    name:   'Notifications',
    why:    'Delivers route alerts, inspection review results, safety alerts, and support updates.',
    when:   'Sent when there is an update relevant to your account. You can manage or disable them in settings.',
    stored: 'Notification tokens are stored securely and removed when you log out or uninstall.',
  },
  {
    icon:   '🖼️',
    name:   'Photo Library',
    why:    'Allows selecting existing photos for commercial inspection uploads and support attachments.',
    when:   'Only when you explicitly choose a photo from your device library.',
    stored: 'Selected photos are uploaded once and not retained on the device by the app.',
  },
]

function fade(a: boolean, d = 0): React.CSSProperties {
  return {
    opacity:    a ? 1 : 0,
    transform:  a ? 'translateY(0)' : 'translateY(14px)',
    transition: `opacity 0.4s ease ${d}ms, transform 0.4s ease ${d}ms`,
  }
}

export default function LegalHubPage() {
  const navigate  = useNavigate()
  const [a, setA] = useState(false)
  useEffect(() => { const id = requestAnimationFrame(() => setA(true)); return () => cancelAnimationFrame(id) }, [])

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden" style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}>
      <div className="pointer-events-none absolute inset-0 grid-bg" />
      <div className="pointer-events-none absolute" style={{ top: -80, left: -60, width: 280, height: 280, background: 'rgba(94,234,212,0.08)', filter: 'blur(72px)', borderRadius: '50%' }} />

      <header className="relative flex items-center justify-between px-4 py-3" style={{ background: 'rgba(4,10,24,0.92)', borderBottom: '1px solid rgba(0,200,255,0.12)', backdropFilter: 'blur(12px)', zIndex: 2 }}>
        <div className="flex items-center gap-3">
          <span className="text-xl font-extrabold" style={{ color: '#00c8ff' }}>Cyan's Brooklynn</span>
          <span style={{ color: 'rgba(0,200,255,0.3)' }}>|</span>
          <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>Legal & Policies</span>
        </div>
        <button onClick={() => navigate(-1)} className="text-sm transition-opacity hover:opacity-70" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}>
          ← Back
        </button>
      </header>

      <div className="relative flex-1 overflow-y-auto pb-20" style={{ zIndex: 1 }}>
        <div className="max-w-[520px] mx-auto px-4 pt-8 pb-8">

          <div className="mb-6" style={fade(a, 0)}>
            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest mb-3 inline-block" style={{ background: 'rgba(94,234,212,0.1)', border: '1px solid rgba(94,234,212,0.3)', color: '#5eead4' }}>
              Legal
            </span>
            <h1 className="text-2xl font-extrabold mb-1.5" style={{ color: '#ffffff' }}>Legal Center</h1>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
              CB Recycling · Cyan's Brooklynn Platform · All policies last updated May 2026.
            </p>
          </div>

          {/* ── Policy Directory ── */}
          <div className="rounded-2xl overflow-hidden mb-5" style={{ background: 'rgba(0,87,231,0.08)', border: '1px solid rgba(0,200,255,0.15)', ...fade(a, 60) }}>
            <div className="px-5 pt-4 pb-2 flex items-center gap-2">
              <span style={{ fontSize: 16 }}>📁</span>
              <p style={{ fontSize: 13, fontWeight: 800, color: '#ffffff' }}>Documents</p>
            </div>
            {POLICIES.map((p, i) => (
              <Link
                key={p.href}
                to={p.href}
                className="flex items-start gap-3 px-5 hover:bg-white/5 transition-colors"
                style={{ paddingTop: 12, paddingBottom: 12, borderTop: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none', textDecoration: 'none' }}
              >
                <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>{p.icon}</span>
                <div className="flex-1">
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', marginBottom: 2 }}>{p.title}</p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>{p.desc}</p>
                </div>
                <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 14, alignSelf: 'center' }}>›</span>
              </Link>
            ))}
          </div>

          {/* ── Permission Explanations ── */}
          <div className="rounded-2xl p-5 mb-5" style={{ background: 'rgba(0,87,231,0.08)', border: '1px solid rgba(0,200,255,0.15)', ...fade(a, 120) }}>
            <div className="flex items-center gap-2 mb-4">
              <span style={{ fontSize: 16 }}>🔐</span>
              <p style={{ fontSize: 13, fontWeight: 800, color: '#ffffff' }}>Why We Request Permissions</p>
            </div>
            <div className="flex flex-col gap-0">
              {PERMISSIONS.map((perm, i) => (
                <div key={perm.name} style={{ paddingTop: i > 0 ? 14 : 0, paddingBottom: i < PERMISSIONS.length - 1 ? 14 : 0, borderBottom: i < PERMISSIONS.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span style={{ fontSize: 15 }}>{perm.icon}</span>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#ffffff' }}>{perm.name}</p>
                  </div>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', lineHeight: 1.55, marginBottom: 4 }}><strong style={{ color: 'rgba(255,255,255,0.75)' }}>Why:</strong> {perm.why}</p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', lineHeight: 1.55, marginBottom: 4 }}><strong style={{ color: 'rgba(255,255,255,0.75)' }}>When:</strong> {perm.when}</p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', lineHeight: 1.55 }}><strong style={{ color: 'rgba(255,255,255,0.75)' }}>Data:</strong> {perm.stored}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Contact strip ── */}
          <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', ...fade(a, 180) }}>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textAlign: 'center', lineHeight: 1.6 }}>
              Questions about these policies?{' '}
              <a href="mailto:support@cbrecycling.org" style={{ color: '#00c8ff', textDecoration: 'none' }}>support@cbrecycling.org</a>
              {' '}· CB Recycling · Nashville, TN
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}
