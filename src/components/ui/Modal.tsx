// Modal.tsx — Accessible, focus-trapped modal overlay
// Works with the dark BayKid UI system (no Tailwind class dependencies for overlay)

import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export interface ModalProps {
  open:        boolean
  onClose:     () => void
  title?:      string
  description?: string
  width?:      number | string
  /** If true, clicking the backdrop closes the modal. Default: true */
  closeOnBackdrop?: boolean
  /** If true, pressing Escape closes the modal. Default: true */
  closeOnEscape?: boolean
  children:    ReactNode
  footer?:     ReactNode
  maxHeight?:  string
}

export function Modal({
  open,
  onClose,
  title,
  description,
  width = 520,
  closeOnBackdrop = true,
  closeOnEscape   = true,
  children,
  footer,
  maxHeight = '90vh',
}: ModalProps) {
  const panelRef  = useRef<HTMLDivElement>(null)
  const prevFocus = useRef<Element | null>(null)

  // Trap focus & restore on close
  useEffect(() => {
    if (!open) return
    prevFocus.current = document.activeElement
    // Focus first focusable element
    const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )
    focusable?.[0]?.focus()
    return () => {
      (prevFocus.current as HTMLElement | null)?.focus()
    }
  }, [open])

  // Escape key handler
  useEffect(() => {
    if (!open || !closeOnEscape) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose() }
    }
    document.addEventListener('keydown', handler, { capture: true })
    return () => document.removeEventListener('keydown', handler, { capture: true })
  }, [open, closeOnEscape, onClose])

  // Lock body scroll
  useEffect(() => {
    if (!open) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = original }
  }, [open])

  if (!open) return null

  const content = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
      aria-describedby={description ? 'modal-desc' : undefined}
      style={{
        position:       'fixed',
        inset:          0,
        zIndex:         400,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        padding:        20,
        background:     'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(6px)',
      }}
      onMouseDown={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        style={{
          background:   '#0d1424',
          border:       '1px solid rgba(0,200,255,0.2)',
          borderRadius: 14,
          boxShadow:    '0 20px 60px rgba(0,0,0,0.6)',
          width:        '100%',
          maxWidth:     typeof width === 'number' ? `${width}px` : width,
          maxHeight,
          display:      'flex',
          flexDirection:'column',
          overflow:     'hidden',
        }}
      >
        {/* Header */}
        {(title || description) && (
          <div style={{ padding: '20px 22px 0', flexShrink: 0 }}>
            {title && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <h2
                  id="modal-title"
                  style={{ margin: 0, color: '#fff', fontSize: 17, fontWeight: 700 }}
                >
                  {title}
                </h2>
                <button
                  onClick={onClose}
                  aria-label="Close dialog"
                  style={{
                    background:   'rgba(255,255,255,0.07)',
                    border:       '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 8,
                    color:        'rgba(255,255,255,0.5)',
                    cursor:       'pointer',
                    fontSize:     16,
                    lineHeight:   1,
                    padding:      '4px 8px',
                    flexShrink:   0,
                  }}
                >
                  ✕
                </button>
              </div>
            )}
            {description && (
              <p id="modal-desc" style={{ margin: '6px 0 0', color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>
                {description}
              </p>
            )}
            <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '16px 0 0' }} />
          </div>
        )}

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px' }}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div style={{ flexShrink: 0, padding: '14px 22px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  )

  return createPortal(content, document.body)
}

// ── Convenience: Confirm dialog ───────────────────────────────────────────────

export interface ConfirmModalProps {
  open:         boolean
  onConfirm:    () => void
  onCancel:     () => void
  title:        string
  message:      string
  confirmLabel?: string
  cancelLabel?:  string
  dangerous?:   boolean
}

export function ConfirmModal({
  open, onConfirm, onCancel,
  title, message,
  confirmLabel = 'Confirm',
  cancelLabel  = 'Cancel',
  dangerous    = false,
}: ConfirmModalProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      width={420}
      footer={
        <>
          <button
            onClick={onCancel}
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: 'rgba(255,255,255,0.65)', fontSize: 13, fontWeight: 600, padding: '8px 18px', cursor: 'pointer' }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            style={{
              background:   dangerous ? 'rgba(239,68,68,0.15)' : 'linear-gradient(135deg,#0080ff,#00c8ff)',
              border:       dangerous ? '1px solid rgba(239,68,68,0.35)' : 'none',
              borderRadius: 8,
              color:        dangerous ? '#f87171' : '#fff',
              fontSize:     13,
              fontWeight:   700,
              padding:      '8px 20px',
              cursor:       'pointer',
            }}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p style={{ margin: 0, color: 'rgba(255,255,255,0.65)', fontSize: 14, lineHeight: 1.6 }}>{message}</p>
    </Modal>
  )
}
