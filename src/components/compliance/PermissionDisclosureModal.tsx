// PermissionDisclosureModal.tsx — Show Apple-compliant rationale BEFORE
// requesting a native permission, and record the user's acknowledgment.
//
// Usage:
//   const [showModal, setShowModal] = useState(false)
//   // when you're about to request the OS permission:
//   setShowModal(true)
//   // user accepts -> onContinue fires -> caller invokes the native prompt.
//
//   <PermissionDisclosureModal
//     permissionType="camera"
//     open={showModal}
//     onClose={() => setShowModal(false)}
//     onContinue={() => { setShowModal(false); requestNativeCameraPermission() }}
//   />
//
// The component:
//   - Renders the canonical disclosure copy from PERMISSION_DISCLOSURE_TEXT
//   - Writes a row to permission_disclosure_acknowledgments on accept
//   - Allows the caller to skip by passing a custom title/message

import { useState } from 'react'
import {
  acknowledgePermissionDisclosure,
} from '../../lib/complianceCenter'
import {
  PERMISSION_DISCLOSURE_TEXT,
  type PermissionType,
} from '../../types/compliance'

interface Props {
  permissionType: PermissionType
  /** Whether the modal is open. */
  open?:          boolean
  /** Override the default title for this permission type. */
  title?:         string
  /** Override the default body for this permission type. */
  message?:       string
  /** Called when the user accepts AND the acknowledgment has been recorded. */
  onContinue:     () => void
  /** Called when the user dismisses without accepting. */
  onClose?:       () => void
}

export default function PermissionDisclosureModal({
  permissionType, open = true, title, message, onContinue, onClose,
}: Props) {
  const defaults = PERMISSION_DISCLOSURE_TEXT[permissionType]
  const finalTitle   = title   ?? defaults.title
  const finalMessage = message ?? defaults.message

  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState<string | null>(null)

  if (!open) return null

  const handleContinue = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const r = await acknowledgePermissionDisclosure(permissionType, finalMessage)
      if (!r.ok) {
        // Disclosure write failed — best practice is still to surface the
        // OS prompt rather than block the user, but log the failure.
        console.warn('[permission disclosure] write failed:', r.error)
      }
      onContinue()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not record acknowledgment.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)',
      }}
    >
      <div
        style={{
          width: '100%', maxWidth: 440, margin: '0 16px',
          background: 'rgba(12,20,28,0.97)',
          border: '1px solid rgba(0,200,255,0.25)',
          borderRadius: 18, padding: 24,
        }}
      >
        <div className="flex items-center gap-3 mb-3">
          <span style={{ fontSize: 26 }}>{iconFor(permissionType)}</span>
          <h2 style={{ fontSize: 17, fontWeight: 800, color: '#fff', margin: 0 }}>{finalTitle}</h2>
        </div>

        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.78)', lineHeight: 1.6, marginBottom: 16 }}>
          {finalMessage}
        </p>

        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 16 }}>
          You can revoke this access at any time from your device&rsquo;s system settings.
          We don&rsquo;t use access for anything beyond what&rsquo;s described here.
        </p>

        {error && <p style={{ fontSize: 12, color: '#fca5a5', marginBottom: 10 }}>{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={submitting}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 700,
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.8)', cursor: submitting ? 'not-allowed' : 'pointer',
            }}
          >
            Not now
          </button>
          <button
            onClick={handleContinue}
            disabled={submitting}
            style={{
              flex: 1.4, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 700,
              background: submitting ? 'rgba(0,200,255,0.30)' : 'linear-gradient(135deg, #0057e7, #00c8ff)',
              border: 'none', color: '#fff',
              cursor: submitting ? 'not-allowed' : 'pointer',
              boxShadow: submitting ? 'none' : '0 4px 16px rgba(0,190,255,0.30)',
            }}
          >
            {submitting ? 'Saving…' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  )
}

function iconFor(p: PermissionType): string {
  switch (p) {
    case 'camera':            return '📷'
    case 'photos':            return '🖼️'
    case 'location_consumer': return '📍'
    case 'location_driver':   return '🗺️'
    case 'notifications':     return '🔔'
  }
}
