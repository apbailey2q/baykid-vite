import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

const CONTAINER_ID = 'html5-qr-container'

interface Props {
  onScan: (value: string) => void
  onPermissionDenied?: () => void
}

type Status = 'starting' | 'active' | 'error'

export function QrScanner({ onScan, onPermissionDenied }: Props) {
  const onScanRef = useRef(onScan)
  onScanRef.current = onScan

  const [status, setStatus] = useState<Status>('starting')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    const scanner = new Html5Qrcode(CONTAINER_ID)
    let scanned = false
    let started = false

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decoded) => {
          if (scanned) return
          scanned = true
          // Don't stop here — let cleanup handle it to avoid double-stop DOM conflict
          try {
            onScanRef.current(decoded)
          } catch (e) {
            console.error('[QrScanner] onScan callback error', e)
          }
        },
        () => {}, // suppress per-frame scan errors
      )
      .then(() => {
        started = true
        setStatus('active')
      })
      .catch((err: unknown) => {
        const msg = String(err).toLowerCase()
        const isPermission =
          msg.includes('permission') ||
          msg.includes('denied') ||
          msg.includes('notallowed') ||
          msg.includes('not allowed')

        if (isPermission) {
          onPermissionDenied?.()
        } else {
          setStatus('error')
          setErrorMsg('Could not start camera. Try refreshing or check browser permissions.')
          console.error('[QrScanner] start error', err)
        }
      })

    return () => {
      if (started) {
        scanner.stop().catch(() => {})
      }
    }
  }, [])

  return (
    <div
      className="relative overflow-hidden rounded-xl bg-black"
      style={{ minHeight: 280 }}
    >
      {/* Real camera feed — html5-qrcode injects video into this div */}
      <div id={CONTAINER_ID} className="w-full" />

      {/* Loading overlay — shown until camera feed is active */}
      {status === 'starting' && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-3"
          style={{ background: 'rgba(0,0,0,0.85)' }}
        >
          <div
            className="w-8 h-8 rounded-full border-4"
            style={{ borderColor: 'rgba(0,200,255,0.2)', borderTopColor: '#00c8ff', animation: 'spin 0.8s linear infinite' }}
          />
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Starting camera…</p>
        </div>
      )}

      {/* Scan frame overlay — shown once camera is active */}
      {status === 'active' && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            style={{
              width: 220,
              height: 220,
              border: '2px solid rgba(0,200,255,0.7)',
              borderRadius: 16,
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
            }}
          >
            {/* Corner brackets */}
            {[
              { top: -2, left: -2,    borderTop: '3px solid #00c8ff', borderLeft:  '3px solid #00c8ff' },
              { top: -2, right: -2,   borderTop: '3px solid #00c8ff', borderRight: '3px solid #00c8ff' },
              { bottom: -2, left: -2, borderBottom: '3px solid #00c8ff', borderLeft: '3px solid #00c8ff' },
              { bottom: -2, right: -2,borderBottom: '3px solid #00c8ff', borderRight:'3px solid #00c8ff' },
            ].map((s, i) => (
              <div key={i} style={{ position: 'absolute', width: 22, height: 22, ...s }} />
            ))}
            {/* Scan line */}
            <div style={{
              position: 'absolute', left: 0, right: 0, height: 2,
              background: 'linear-gradient(90deg, transparent, #00c8ff, transparent)',
              animation: 'scanLine 1.8s ease-in-out infinite',
            }} />
          </div>
          <p style={{
            position: 'absolute', bottom: 18, fontSize: 11,
            color: 'rgba(255,255,255,0.6)', letterSpacing: '0.05em',
          }}>
            Align QR code within frame
          </p>
        </div>
      )}

      {/* Error state */}
      {status === 'error' && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center"
          style={{ background: 'rgba(0,0,0,0.9)' }}
        >
          <span style={{ fontSize: 28 }}>📷</span>
          <p style={{ fontSize: 13, color: '#f87171', fontWeight: 600 }}>Camera unavailable</p>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
            {errorMsg}
          </p>
        </div>
      )}

      <style>{`
        @keyframes scanLine {
          0%   { top: 0; opacity: 1; }
          49%  { opacity: 1; }
          50%  { top: calc(100% - 2px); opacity: 0; }
          51%  { top: 0; opacity: 0; }
          52%  { opacity: 1; }
          100% { top: calc(100% - 2px); opacity: 1; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
