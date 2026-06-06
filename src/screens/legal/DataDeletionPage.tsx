import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

function fade(a: boolean, d = 0): React.CSSProperties {
  return {
    opacity:    a ? 1 : 0,
    transform:  a ? 'translateY(0)' : 'translateY(14px)',
    transition: `opacity 0.4s ease ${d}ms, transform 0.4s ease ${d}ms`,
  }
}

const DELETED_DATA = [
  { icon: '👤', label: 'Account profile',     detail: 'Name, email, phone, and role assignment.' },
  { icon: '📦', label: 'Bag scan history',    detail: 'All QR scan records linked to your account.' },
  { icon: '💳', label: 'Wallet transactions', detail: 'Earning, donation, and payout records.' },
  { icon: '🔔', label: 'Notification tokens', detail: 'Push notification device registrations.' },
  { icon: '📍', label: 'Location sessions',   detail: 'Driver GPS route session data.' },
]

const RETAINED_DATA = [
  { icon: '🧾', label: 'Anonymized audit records', detail: 'Platform audit logs may retain anonymized records for regulatory compliance and fraud prevention. These cannot be linked back to you.' },
  { icon: '🧾', label: 'Completed financial records', detail: 'Completed payout records may be retained for accounting and tax compliance as required by law.' },
]

export default function DataDeletionPage() {
  const navigate   = useNavigate()
  const [a, setA]  = useState(false)
  const [sent, setSent] = useState(false)

  useEffect(() => { const id = requestAnimationFrame(() => setA(true)); return () => cancelAnimationFrame(id) }, [])

  const subject = encodeURIComponent("Cyan's Brooklynn Account Deletion Request")
  const body    = encodeURIComponent(
    `Hello CB Recycling Support,\n\nI am requesting the deletion of my Cyan's Brooklynn account and all associated personal data.\n\nAccount email: [YOUR EMAIL]\n\nI understand this action is permanent and cannot be undone.\n\nThank you.`
  )

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden" style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}>
      <div className="pointer-events-none absolute inset-0 grid-bg" />
      <div className="pointer-events-none absolute" style={{ top: -80, right: -60, width: 240, height: 240, background: 'rgba(248,113,113,0.06)', filter: 'blur(60px)', borderRadius: '50%' }} />

      <header className="relative flex items-center justify-between px-4 py-3" style={{ background: 'rgba(4,10,24,0.92)', borderBottom: '1px solid rgba(0,200,255,0.12)', backdropFilter: 'blur(12px)', zIndex: 2 }}>
        <div className="flex items-center gap-3">
          <span className="text-xl font-extrabold" style={{ color: '#00c8ff' }}>Cyan's Brooklynn</span>
          <span style={{ color: 'rgba(0,200,255,0.3)' }}>|</span>
          <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>Data Deletion Request</span>
        </div>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
          ← Back
        </button>
      </header>

      <div className="relative flex-1 overflow-y-auto pb-20" style={{ zIndex: 1 }}>
        <div className="max-w-[520px] mx-auto px-4 pt-8 pb-8">

          <div className="mb-6" style={fade(a, 0)}>
            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest mb-3 inline-block" style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }}>
              Account
            </span>
            <h1 className="text-2xl font-extrabold mb-1.5" style={{ color: '#ffffff' }}>Request Account Deletion</h1>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
              You have the right to request deletion of your account and personal data. This action is permanent and cannot be undone.
            </p>
          </div>

          {/* ── Warning ── */}
          <div className="rounded-2xl p-5 mb-4" style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)', ...fade(a, 50) }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#f87171', marginBottom: 6 }}>⚠️ Before you continue</p>
            <ul className="flex flex-col gap-1.5">
              {[
                'Your wallet balance will be permanently forfeited. Withdraw any remaining balance before requesting deletion.',
                'Active commercial route assignments will be cancelled.',
                'You will lose access to all fundraiser campaign history.',
                'This request cannot be reversed once processed.',
              ].map(w => (
                <li key={w} style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', lineHeight: 1.55, paddingLeft: 8, borderLeft: '2px solid rgba(248,113,113,0.3)' }}>{w}</li>
              ))}
            </ul>
          </div>

          {/* ── What gets deleted ── */}
          <div className="rounded-2xl p-5 mb-4" style={{ background: 'rgba(0,87,231,0.08)', border: '1px solid rgba(0,200,255,0.15)', ...fade(a, 100) }}>
            <p style={{ fontSize: 13, fontWeight: 800, color: '#ffffff', marginBottom: 14 }}>🗑️ Data that will be deleted</p>
            <div className="flex flex-col gap-0">
              {DELETED_DATA.map((d, i) => (
                <div key={d.label} className="flex items-start gap-3" style={{ paddingTop: i > 0 ? 10 : 0, paddingBottom: i < DELETED_DATA.length - 1 ? 10 : 0, borderBottom: i < DELETED_DATA.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                  <span style={{ fontSize: 15 }}>{d.icon}</span>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#ffffff' }}>{d.label}</p>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>{d.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── What gets retained ── */}
          <div className="rounded-2xl p-5 mb-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', ...fade(a, 150) }}>
            <p style={{ fontSize: 13, fontWeight: 800, color: '#ffffff', marginBottom: 14 }}>📁 Data retained for compliance</p>
            <div className="flex flex-col gap-0">
              {RETAINED_DATA.map((d, i) => (
                <div key={d.label} className="flex items-start gap-3" style={{ paddingTop: i > 0 ? 10 : 0, paddingBottom: i < RETAINED_DATA.length - 1 ? 10 : 0, borderBottom: i < RETAINED_DATA.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                  <span style={{ fontSize: 15 }}>{d.icon}</span>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#ffffff' }}>{d.label}</p>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>{d.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Timeline ── */}
          <div className="rounded-2xl p-4 mb-5" style={{ background: 'rgba(0,87,231,0.06)', border: '1px solid rgba(0,200,255,0.12)', ...fade(a, 180) }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>⏱ Processing timeline</p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.55 }}>
              Deletion requests are processed within <strong style={{ color: 'rgba(255,255,255,0.7)' }}>30 days</strong> of receipt. You will receive a confirmation email when your data has been removed.
            </p>
          </div>

          {/* ── Request button ── */}
          {!sent ? (
            <a
              href={`mailto:support@cbrecycling.org?subject=${subject}&body=${body}`}
              onClick={() => setSent(true)}
              style={{ display: 'block', width: '100%', padding: '14px', borderRadius: 14, background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.35)', color: '#f87171', fontSize: 13, fontWeight: 700, textAlign: 'center', textDecoration: 'none', ...fade(a, 200) }}
            >
              🗑️ Submit Deletion Request via Email
            </a>
          ) : (
            <div className="rounded-2xl p-4" style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)', ...fade(true, 0) }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#4ade80', marginBottom: 4 }}>✓ Request sent</p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.55 }}>
                Your email app should have opened with a pre-filled deletion request. Send the email to complete your request. You'll receive confirmation within 30 days.
              </p>
            </div>
          )}

          <p className="mt-4 text-center" style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', lineHeight: 1.6, ...fade(a, 220) }}>
            Requests can also be sent directly to{' '}
            <a href="mailto:support@cbrecycling.org" style={{ color: 'rgba(0,200,255,0.6)', textDecoration: 'none' }}>support@cbrecycling.org</a>
          </p>

        </div>
      </div>
    </div>
  )
}
