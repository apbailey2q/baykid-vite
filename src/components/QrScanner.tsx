import { useEffect, useRef } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

const CONTAINER_ID = 'html5-qr-container'

interface Props {
  onScan: (value: string) => void
  onPermissionDenied?: () => void
}

export function QrScanner({ onScan, onPermissionDenied }: Props) {
  const onScanRef = useRef(onScan)
  onScanRef.current = onScan

  useEffect(() => {
    const scanner = new Html5Qrcode(CONTAINER_ID)
    let scanned = false

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decoded) => {
          if (scanned) return
          scanned = true
          scanner.stop().catch(() => {})
          onScanRef.current(decoded)
        },
        () => {}, // suppress per-frame scan errors
      )
      .catch((err: unknown) => {
        const msg = String(err).toLowerCase()
        if (
          msg.includes('permission') ||
          msg.includes('denied') ||
          msg.includes('notallowed') ||
          msg.includes('not allowed')
        ) {
          onPermissionDenied?.()
        }
      })

    return () => {
      scanner.stop().catch(() => {})
    }
  }, [])

  return (
    <div className="overflow-hidden rounded-xl bg-black">
      <div id={CONTAINER_ID} className="w-full" />
    </div>
  )
}
