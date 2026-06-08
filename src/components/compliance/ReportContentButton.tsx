// ReportContentButton.tsx — User-facing "Report" CTA for any piece of content.
//
// Used wherever user-generated content appears (community posts, fundraiser
// posts, partner/public content). Opens a small modal, captures reason +
// optional details, submits to public.content_reports.
//
// Props:
//   contentId        — stable identifier for the reported content
//   contentType      — short tag describing the surface, e.g. 'fundraiser_post'
//   reportedUserId   — optional UID of the user who created the content
//   variant          — visual variant of the trigger button
//   className        — pass-through for layout

import { useState } from 'react'
import { createContentReport } from '../../lib/complianceCenter'
import type { ReportReason } from '../../types/compliance'
import { REPORT_REASON_LABELS } from '../../types/compliance'

const REASONS: ReportReason[] = [
  'spam', 'harassment', 'hate_speech', 'dangerous_content',
  'scam_fraud', 'illegal_activity', 'impersonation', 'other',
]

interface Props {
  contentId:       string
  contentType:     string
  reportedUserId?: string
  variant?:        'inline' | 'icon' | 'menu'
  className?:      string
}

export default function ReportContentButton({
  contentId, contentType, reportedUserId, variant = 'inline', className = '',
}: Props) {
  const [open, setOpen]           = useState(false)
  const [reason, setReason]       = useState<ReportReason | ''>('')
  const [details, setDetails]     = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError]         = useState<string | null>(null)

  const trigger = (() => {
    if (variant === 'icon') {
      return (
        <button
          onClick={() => setOpen(true)}
          className={className}
          aria-label="Report content"
          title="Report"
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'rgba(255,255,255,0.4)', fontSize: 14, padding: 4,
          }}
        >
          🚩
        </button>
      )
    }
    if (variant === 'menu') {
      return (
        <button
          onClick={() => setOpen(true)}
          className={className}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#f87171', fontSize: 12, fontWeight: 600, padding: 0,
          }}
        >
          🚩 Report
        </button>
      )
    }
    return (
      <button
        onClick={() => setOpen(true)}
        className={className}
        style={{
          background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.28)',
          color: '#f87171', borderRadius: 10, padding: '6px 12px',
          fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}
      >
        🚩 Report
      </button>
    )
  })()

  const submit = async () => {
    if (!reason) {
      setError('Please choose a reason.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const r = await createContentReport({
        reportedContentId: contentId,
        contentType,
        reportedUserId,
        reason,
        details: details.trim() || undefined,
      })
      if (r.ok) {
        setSubmitted(true)
      } else {
        setError(r.error ?? 'Could not submit the report.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const close = () => {
    setOpen(false)
    setReason('')
    setDetails('')
    setSubmitted(false)
    setError(null)
  }

  return (
    <>
      {trigger}
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
              width: '100%', maxWidth: 460, margin: '0 16px',
              background: 'rgba(12,20,28,0.97)',
              border: '1px solid rgba(248,113,113,0.25)',
              borderRadius: 18, padding: 24,
            }}
          >
            <div className="flex items-center gap-3 mb-3">
              <span style={{ fontSize: 22 }}>🚩</span>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: '#fff', margin: 0 }}>Report content</h2>
            </div>

            {submitted ? (
              <>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.78)', marginBottom: 16 }}>
                  Thank you. A moderator will review this report. You can see the status of your reports in your account settings.
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
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginBottom: 12 }}>
                  Help keep Cyan&rsquo;s Brooklynn Recycling safe. Choose the closest reason; add details if helpful.
                </p>

                <div className="flex flex-col gap-2 mb-3">
                  {REASONS.map(r => {
                    const selected = reason === r
                    return (
                      <label key={r} className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="report-reason"
                          checked={selected}
                          onChange={() => setReason(r)}
                          style={{ marginTop: 3, accentColor: '#f87171' }}
                        />
                        <span style={{ fontSize: 13, color: selected ? '#fff' : 'rgba(255,255,255,0.78)' }}>
                          {REPORT_REASON_LABELS[r]}
                        </span>
                      </label>
                    )
                  })}
                </div>

                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 6 }}>
                  Additional details (optional)
                </label>
                <textarea
                  value={details}
                  onChange={e => setDetails(e.target.value)}
                  placeholder="What happened?"
                  rows={3}
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
                    disabled={submitting || !reason}
                    style={{
                      flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 700,
                      background: submitting || !reason ? 'rgba(248,113,113,0.30)' : 'linear-gradient(135deg, #ef4444, #dc2626)',
                      border: 'none', color: '#fff',
                      cursor: submitting || !reason ? 'not-allowed' : 'pointer',
                      boxShadow: submitting || !reason ? 'none' : '0 4px 16px rgba(239,68,68,0.3)',
                    }}
                  >
                    {submitting ? 'Submitting…' : 'Submit report'}
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
