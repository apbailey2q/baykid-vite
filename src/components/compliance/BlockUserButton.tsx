// BlockUserButton.tsx — User-facing "Block" CTA.
//
// Confirmation modal -> writes blocked_users row + audit log entry. The app's
// existing surfaces should treat a blocked user's content as hidden; that
// integration is per-surface and lives outside this component.

import { useState } from 'react'
import { blockUser } from '../../lib/complianceCenter'

interface Props {
  userId:    string
  userName?: string
  className?: string
}

export default function BlockUserButton({ userId, userName, className = '' }: Props) {
  const [open, setOpen]             = useState(false)
  const [reason, setReason]         = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted]   = useState(false)
  const [error, setError]           = useState<string | null>(null)

  const close = () => {
    setOpen(false)
    setReason('')
    setError(null)
    setSubmitted(false)
  }

  const submit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const r = await blockUser(userId, reason.trim() || undefined)
      if (r.ok) setSubmitted(true)
      else setError(r.error ?? 'Could not block this user.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={className}
        style={{
          background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.28)',
          color: '#f87171', borderRadius: 10, padding: '6px 12px',
          fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}
      >
        🚫 Block {userName ? `${userName.split(' ')[0]}` : 'user'}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)',
          }}
          onClick={close}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 420, margin: '0 16px',
              background: 'rgba(12,20,28,0.97)',
              border: '1px solid rgba(248,113,113,0.25)',
              borderRadius: 18, padding: 24,
            }}
          >
            <div className="flex items-center gap-3 mb-3">
              <span style={{ fontSize: 22 }}>🚫</span>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: '#fff', margin: 0 }}>Block this user</h2>
            </div>

            {submitted ? (
              <>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.78)', marginBottom: 16 }}>
                  {userName ? `${userName} has` : 'The user has'} been blocked. You can manage your blocked users from settings.
                </p>
                <button
                  onClick={close}
                  style={{
                    width: '100%', padding: '10px 0', borderRadius: 10, fontSize: 14, fontWeight: 700,
                    background: 'linear-gradient(135deg, #0057e7, #00c8ff)', border: 'none',
                    color: '#fff', cursor: 'pointer',
                  }}
                >
                  Done
                </button>
              </>
            ) : (
              <>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginBottom: 12 }}>
                  Blocking {userName ? userName : 'this user'} will hide their content from your view across Cyan&rsquo;s Brooklynn Recycling.
                  You can unblock them later from your account settings.
                </p>

                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 6 }}>
                  Reason (optional, for your records)
                </label>
                <textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="Why are you blocking?"
                  rows={2}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 10,
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                    color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box',
                    fontFamily: 'inherit', resize: 'vertical', marginBottom: 12,
                  }}
                />

                {error && <p style={{ fontSize: 12, color: '#fca5a5', marginBottom: 10 }}>{error}</p>}

                <div className="flex gap-2">
                  <button
                    onClick={close}
                    disabled={submitting}
                    style={{
                      flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 700,
                      background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                      color: 'rgba(255,255,255,0.8)', cursor: submitting ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submit}
                    disabled={submitting}
                    style={{
                      flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 700,
                      background: submitting ? 'rgba(248,113,113,0.30)' : 'linear-gradient(135deg, #ef4444, #dc2626)',
                      border: 'none', color: '#fff',
                      cursor: submitting ? 'not-allowed' : 'pointer',
                      boxShadow: submitting ? 'none' : '0 4px 16px rgba(239,68,68,0.3)',
                    }}
                  >
                    {submitting ? 'Blocking…' : 'Block'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
