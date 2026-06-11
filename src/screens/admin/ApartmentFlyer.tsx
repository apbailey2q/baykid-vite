// ApartmentFlyer — /dashboard/admin/apartment/flyer/:slug
// Printable resident invite flyer for each apartment community.
// Access is admin-only (falls under /dashboard/admin/apartment prefix in routePermissions).

import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getPropertyBySlug, type Property } from '../../lib/apartment'
import { inviteLink } from '../../lib/apartmentInviteTemplates'

const STEPS = [
  { n: 1, label: 'Scan the QR code or visit the link below' },
  { n: 2, label: 'Verify your name, email, and unit number' },
  { n: 3, label: 'Create your account password' },
  { n: 4, label: 'Watch the short orientation video' },
  { n: 5, label: 'Accept the program terms and conditions' },
  { n: 6, label: 'Download the Cyan\'s Brooklynn Recycling app' },
  { n: 7, label: 'Complete your in-app profile — you\'re ready!' },
]

export default function ApartmentFlyer() {
  const { slug } = useParams<{ slug: string }>()
  const [property, setProperty] = useState<Property | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)

  useEffect(() => {
    if (!slug) { setError('No property slug provided.'); setLoading(false); return }
    getPropertyBySlug(slug)
      .then(result => {
        if (!result) setError('Property not found.')
        else setProperty(result.property)
        setLoading(false)
      })
      .catch(() => { setError('Failed to load property.'); setLoading(false) })
  }, [slug])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#060e24' }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', border: '4px solid rgba(0,200,255,0.3)', borderTopColor: '#00c8ff', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }

  if (error || !property) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#060e24', color: '#fff', gap: 16, textAlign: 'center', padding: 24 }}>
        <span style={{ fontSize: 48 }}>⚠️</span>
        <p style={{ fontSize: 15 }}>{error ?? 'Property not found.'}</p>
        <Link to="/dashboard/admin/apartment" style={{ color: '#00c8ff', textDecoration: 'none', fontWeight: 700 }}>← Back to Apartment Dashboard</Link>
      </div>
    )
  }

  const link = inviteLink(slug!)
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(link)}&bgcolor=ffffff&color=000000&margin=10`

  return (
    <>
      {/* Print / screen styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
          .flyer-page { box-shadow: none !important; border: none !important; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Admin toolbar — hidden on print */}
      <div
        className="no-print"
        style={{
          background: 'rgba(6,14,36,0.95)',
          borderBottom: '1px solid rgba(0,200,255,0.15)',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link
            to="/dashboard/admin/apartment"
            style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, textDecoration: 'none', fontWeight: 600 }}
          >
            ← Back
          </Link>
          <span style={{ color: '#fff', fontWeight: 800, fontSize: 14 }}>
            Flyer — {property.property_name}
          </span>
        </div>
        <button
          onClick={() => window.print()}
          style={{
            background: 'linear-gradient(135deg,#00c8ff,#0057e7)',
            color: '#fff',
            border: 'none',
            borderRadius: 99,
            padding: '9px 22px',
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          🖨 Print / Save PDF
        </button>
      </div>

      {/* Flyer page — centered, print-ready */}
      <div
        style={{
          minHeight: '100vh',
          background: '#f0f4f8',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '40px 24px 80px',
        }}
      >
        <div
          className="flyer-page"
          style={{
            width: 680,
            maxWidth: '100%',
            background: '#fff',
            borderRadius: 16,
            boxShadow: '0 4px 40px rgba(0,0,0,0.12)',
            overflow: 'hidden',
            fontFamily: 'system-ui, -apple-system, Arial, sans-serif',
          }}
        >
          {/* Header band */}
          <div
            style={{
              background: 'linear-gradient(135deg,#0057e7,#00c8ff)',
              padding: '32px 40px 28px',
              color: '#fff',
              textAlign: 'center',
            }}
          >
            <p style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', opacity: 0.85, margin: '0 0 8px' }}>
              ♻️ Community Recycling Program
            </p>
            <h1 style={{ fontSize: 30, fontWeight: 900, margin: '0 0 6px', lineHeight: 1.2 }}>
              {property.property_name}
            </h1>
            <p style={{ fontSize: 15, opacity: 0.9, margin: 0 }}>
              Recycling pickup is now available in your community
            </p>
          </div>

          {/* Main body */}
          <div style={{ padding: '32px 40px' }}>
            {/* Two-column: QR + steps */}
            <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start', marginBottom: 28 }}>
              {/* QR code */}
              <div style={{ flexShrink: 0, textAlign: 'center' }}>
                <img
                  src={qrUrl}
                  alt="QR code to join the recycling program"
                  width={160}
                  height={160}
                  style={{
                    display: 'block',
                    border: '2px solid #e2e8f0',
                    borderRadius: 12,
                    background: '#fff',
                  }}
                />
                <p style={{ fontSize: 11, color: '#64748b', margin: '8px 0 0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Scan to Enroll
                </p>
              </div>

              {/* Steps */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginBottom: 14, marginTop: 0 }}>
                  How to Get Started
                </h2>
                <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {STEPS.map(s => (
                    <li
                      key={s.n}
                      style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: '#334155' }}
                    >
                      <span
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg,#0057e7,#00c8ff)',
                          color: '#fff',
                          fontWeight: 800,
                          fontSize: 11,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          marginTop: 1,
                        }}
                      >
                        {s.n}
                      </span>
                      <span style={{ lineHeight: 1.45, paddingTop: 2 }}>{s.label}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            {/* Link box */}
            <div
              style={{
                background: '#f8fafc',
                border: '1.5px solid #0057e7',
                borderRadius: 10,
                padding: '14px 18px',
                marginBottom: 20,
              }}
            >
              <p style={{ fontSize: 11, fontWeight: 700, color: '#0057e7', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px' }}>
                Your Enrollment Link
              </p>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: 0, wordBreak: 'break-all' }}>
                {link}
              </p>
            </div>

            {/* App download note */}
            <div
              style={{
                background: '#f0fdf4',
                border: '1px solid #86efac',
                borderRadius: 10,
                padding: '12px 18px',
                marginBottom: 20,
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
              }}
            >
              <span style={{ fontSize: 18, flexShrink: 0 }}>📱</span>
              <p style={{ fontSize: 13, color: '#166534', margin: 0, lineHeight: 1.5 }}>
                <strong>Download the app after completing website enrollment.</strong>{' '}
                You must finish all enrollment steps on the website before downloading and logging into the app.
              </p>
            </div>

            {/* Footer */}
            <div
              style={{
                borderTop: '1px solid #e2e8f0',
                paddingTop: 16,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>
                Questions? <strong style={{ color: '#64748b' }}>support@cbrecycling.org</strong>
              </p>
              <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>
                Cyan&rsquo;s Brooklynn Recycling Enterprise LLC
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
