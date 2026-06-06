// ── Driver Scan + Bag Inspection ──────────────────────────────────────────────
// Full QR scan → EXACT-MATCH validation → camera inspection → green/yellow/red → save to DB.
//
// URL params (all optional — works standalone or from route map):
//   stop_id     — route stop UUID
//   route_id    — driver route UUID
//   address     — stop address (for display + saved to scan record)
//   expected_qr — exact QR code assigned to this stop's bag (fetched by DriverRouteView)
//   mode        — 'residential' (default) | 'commercial'
//
// Validation rule: scanned code must EXACTLY equal expected_qr (case-insensitive trim).
//   If no expected_qr is provided → REJECT (cannot verify without reference).
//   Mismatch → qr-mismatch phase → Rescan or Manual Entry (both re-validate).
//   No partial / contains / fuzzy matching.
//
// Phase state machine:
//   scanning → qr-verified → camera-inspecting → [analyzing] → inspecting → green | yellow | red
//   green  → accepted (auto-advance)
//   yellow → accepted | rejected (Rescan goes back to camera-inspecting)
//   red    → red-notes → accepted | rejected
//   camera-error / permission-denied → manual override (inspecting with override flag)
//   accepted / rejected → navigate back to route map

import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { QrScanner } from '../../components/QrScanner'
import { useAuthStore } from '../../store/authStore'
import { useDriverStore } from '../../store/driverStore'
import { saveDriverBagScan } from '../../lib/driverBagScan'
import { completeStop } from '../../lib/driver'
import { supabase } from '../../lib/supabase'

// ── Types ──────────────────────────────────────────────────────────────────────

type Phase =
  | 'scanning'
  | 'qr-verified'
  | 'qr-mismatch'         // scanned code does not match expected — locked until correct code
  | 'camera-inspecting'   // live camera viewfinder for visual bag inspection
  | 'ai-result'           // AI has classified the bag — driver confirms/rescans/reports
  | 'ai-error'            // AI network/deployment failure (camera worked fine)
  | 'inspecting'          // FALLBACK: manual RAG selection (camera-error override path)
  | 'green'               // FALLBACK: manual green result
  | 'yellow'              // FALLBACK: manual yellow result
  | 'red'                 // FALLBACK: manual red result
  | 'red-notes'
  | 'accepted'
  | 'rejected'
  | 'permission-denied'
  | 'camera-error'

interface AiResult {
  result:     'green' | 'yellow' | 'red'
  confidence: number    // 0–100
  reason:     string    // one-sentence explanation from Google Gemini
}

type ScanMethod        = 'qr_scan' | 'manual_entry'
type InspectionMethod  = 'camera' | 'override'
type RedAction         = 'accepted' | 'rejected'

// ── Mode copy ──────────────────────────────────────────────────────────────────

interface ModeCopy {
  scanTitle:       string
  scanSubtitle:    string
  qrLabel:         string
  greenTitle:      string
  greenBody:       string
  yellowTitle:     string
  yellowBody:      string
  redTitle:        string
  redBody:         string
  yellowChecklist: string[]
  redChecklist:    string[]
  acceptedLabel:   string
  rejectedLabel:   string
}

const RESIDENTIAL: ModeCopy = {
  scanTitle:    'Scan Residential Bag',
  scanSubtitle: 'Point your camera at the QR sticker on the recycling bag.',
  qrLabel:      'Bag ID',
  greenTitle:   'Bag Approved',
  greenBody:    'This bag passed inspection.',
  yellowTitle:  'Caution Inspection',
  yellowBody:   'This bag may need additional review.',
  redTitle:     'Unsafe Bag Detected',
  redBody:      'This bag may contain unsafe or prohibited materials.',
  yellowChecklist: [
    'Check for leaks or moisture',
    'Check for sharp objects or broken glass',
    'Check for unusual or chemical smells',
    'Check for batteries or electronics',
    'Check for chemicals or paint',
    'Check for medical or human waste',
    'Confirm nothing living is inside (humans, animals, insects, biological hazards)',
    'Confirm bag weight is under 25 lbs',
    'Confirm bag is properly sealed',
    'Confirm QR tag is attached and readable',
  ],
  redChecklist: [
    'Do NOT open the bag',
    'Do NOT shake, compress, or move it aggressively',
    'Look for visible leaks, spills, smoke, or heat',
    'Look for unusual chemical odors',
    'Look for sharp objects, batteries, broken glass, or medical waste',
    'Confirm nothing living is inside (humans, animals, insects, biological hazards)',
    'Use your discretion and company safety rules',
    'Contact dispatch if you suspect a hazard',
  ],
  acceptedLabel: 'Pickup Confirmed',
  rejectedLabel: 'Pickup Rejected',
}

const COMMERCIAL: ModeCopy = {
  scanTitle:    'Scan Commercial Container',
  scanSubtitle: 'Facility QR, container QR, pallet QR, or bag QR.',
  qrLabel:      'Container ID',
  greenTitle:   'Container Approved',
  greenBody:    'This container is approved for transport.',
  yellowTitle:  'Caution: Secondary Inspection Required',
  yellowBody:   'Please complete the secondary checklist before accepting.',
  redTitle:     'Commercial Load Unsafe',
  redBody:      'Do not transport. This container may contain prohibited or hazardous materials.',
  yellowChecklist: [
    'Check container seal is intact',
    'Check for leaks or chemical odor',
    'Check for battery disposal materials',
    'Check for pressurized containers',
    'Check for loose sharp metal',
    'Check for prohibited mixed waste',
    'Check for overweight container',
    'Confirm loading dock safety',
    'Confirm nothing living is inside',
    'Confirm all manifest labels are correct',
  ],
  redChecklist: [
    'Do NOT transport',
    'Do NOT open or disturb the container',
    'Look for industrial chemicals or flammable materials',
    'Look for battery fire risk, smoke, or heat',
    'Look for biohazard or medical waste',
    'Look for leaking fluids or pressurized tanks',
    'Confirm nothing living is inside',
    'Contact dispatch and report immediately',
  ],
  acceptedLabel: 'Load Accepted',
  rejectedLabel: 'Load Rejected',
}

// ── Recycling rules sent to consumer on rejection ──────────────────────────────

const REJECTION_RULES = [
  '♻️ Only plastics #1–7, clean glass, aluminum cans, dry cardboard',
  '🚫 No food waste, liquids, or soiled / greasy items',
  '🚫 No electronics, batteries, or hazardous materials',
  '📦 Bags must be sealed and under 25 lbs',
  '🏷️ Ensure your QR tag is attached and undamaged',
  '📱 See the full Recycling Guide in your app',
]

// ── Notification helpers ───────────────────────────────────────────────────────

async function notifyConsumerRejected(stopId: string | null, bagCode: string) {
  try {
    await supabase.functions.invoke('send-push-notification', {
      body: {
        stop_id: stopId,
        title:   '❌ Your recycling bag was not collected',
        body:    `Bag ${bagCode} was rejected during pickup. Please review the recycling guidelines in your app.`,
        data:    { type: 'bag_rejected', stop_id: stopId, bag_code: bagCode, rules: REJECTION_RULES },
      },
    })
  } catch { /* best-effort */ }
}

// ── Camera inspection viewfinder ──────────────────────────────────────────────
// Opens the rear camera as a live viewfinder. Driver centres the bag in frame
// and taps "Capture & Inspect". A photo is taken via canvas, returned as a
// data-URL, then the caller triggers a brief "Analyzing…" animation before
// advancing to the manual result-selection step.
//
// Falls back to `onError()` if getUserMedia fails (camera blocked or absent).

function CameraInspectionView({
  onCapture,
  onError,
  accent,
}: {
  onCapture: (dataUrl: string) => void
  onError:   () => void
  accent:    string
}) {
  const videoRef    = useRef<HTMLVideoElement>(null)
  const streamRef   = useRef<MediaStream | null>(null)
  const [ready,     setReady]     = useState(false)
  const [capturing, setCapturing] = useState(false)

  useEffect(() => {
    let cancelled = false
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } } })
      .then(stream => {
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.onloadedmetadata = () => { if (!cancelled) setReady(true) }
        }
      })
      .catch(() => { if (!cancelled) onError() })
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function capture() {
    const video = videoRef.current
    if (!video || capturing) return
    setCapturing(true)

    const canvas  = document.createElement('canvas')
    canvas.width  = video.videoWidth  || 640
    canvas.height = video.videoHeight || 480
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)

    // Stop camera stream before handing off
    streamRef.current?.getTracks().forEach(t => t.stop())
    onCapture(dataUrl)
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: accent, marginBottom: 4 }}>
          📷 Bag Visual Inspection
        </h1>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.55 }}>
          Point the camera at the bag. When the bag is clearly in frame, tap&nbsp;
          <strong style={{ color: 'rgba(255,255,255,0.8)' }}>Capture &amp; Inspect</strong>.
        </p>
      </div>

      {/* Live viewfinder */}
      <div
        style={{
          position: 'relative', borderRadius: 16, overflow: 'hidden',
          background: '#000', border: `1px solid ${accent}40`,
          minHeight: 260, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{ width: '100%', display: 'block', maxHeight: 380, objectFit: 'cover' }}
        />
        {!ready && (
          <div
            style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 10,
            }}
          >
            <div style={{ fontSize: 32 }}>📷</div>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Starting camera…</p>
          </div>
        )}

        {/* Corner targeting reticle */}
        {ready && (
          <div style={{ position: 'absolute', inset: 16, pointerEvents: 'none' }}>
            {(['top-left','top-right','bottom-left','bottom-right'] as const).map(corner => (
              <div
                key={corner}
                style={{
                  position: 'absolute',
                  top:    corner.startsWith('top')    ?  0 : undefined,
                  bottom: corner.startsWith('bottom') ?  0 : undefined,
                  left:   corner.endsWith('left')     ?  0 : undefined,
                  right:  corner.endsWith('right')    ?  0 : undefined,
                  width: 24, height: 24,
                  borderTop:    corner.startsWith('top')    ? `3px solid ${accent}` : undefined,
                  borderBottom: corner.startsWith('bottom') ? `3px solid ${accent}` : undefined,
                  borderLeft:   corner.endsWith('left')     ? `3px solid ${accent}` : undefined,
                  borderRight:  corner.endsWith('right')    ? `3px solid ${accent}` : undefined,
                  borderRadius: corner === 'top-left'     ? '4px 0 0 0'
                              : corner === 'top-right'    ? '0 4px 0 0'
                              : corner === 'bottom-left'  ? '0 0 0 4px'
                              : '0 0 4px 0',
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div
        className="rounded-xl px-4 py-3"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>
          Check for: leaks · tears · unusual shape · visible hazards · sharp objects · proper seal
        </p>
      </div>

      {/* Capture button */}
      <button
        onClick={capture}
        disabled={!ready || capturing}
        style={{
          width: '100%', padding: '14px 16px', borderRadius: 16,
          fontSize: 15, fontWeight: 800, cursor: (!ready || capturing) ? 'not-allowed' : 'pointer',
          opacity: (!ready || capturing) ? 0.5 : 1,
          background: `linear-gradient(135deg, ${accent}, #0057e7)`,
          color: '#fff', border: 'none', boxShadow: `0 4px 24px ${accent}40`,
        }}
      >
        {capturing ? '📸 Capturing…' : ready ? '📸 Capture & Inspect' : '⏳ Camera starting…'}
      </button>

    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function PhaseCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl p-5 space-y-4"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}
    >
      {children}
    </div>
  )
}

function Checklist({ items, accent }: { items: string[]; accent: string }) {
  return (
    <ul className="space-y-2">
      {items.map(item => (
        <li key={item} className="flex items-start gap-2.5" style={{ fontSize: 12, color: 'rgba(255,255,255,0.72)', lineHeight: 1.55 }}>
          <span style={{ color: accent, flexShrink: 0, marginTop: 2, fontSize: 10 }}>●</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

function ActionBtn({
  children, onClick, variant = 'primary', disabled,
}: {
  children: React.ReactNode
  onClick: () => void
  variant?: 'primary' | 'secondary' | 'danger' | 'caution' | 'success'
  disabled?: boolean
}) {
  const styles: Record<string, React.CSSProperties> = {
    primary:   { background: 'linear-gradient(135deg,#0057e7,#00c8ff)', color: '#fff' },
    secondary: { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.12)' },
    danger:    { background: 'rgba(248,113,113,0.12)', color: '#f87171', border: '1px solid rgba(248,113,113,0.4)' },
    caution:   { background: 'rgba(251,191,36,0.12)',  color: '#fbbf24', border: '1px solid rgba(251,191,36,0.4)' },
    success:   { background: 'rgba(34,197,94,0.12)',   color: '#4ade80', border: '1px solid rgba(34,197,94,0.4)' },
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%', padding: '12px 16px', borderRadius: 14,
        fontSize: 14, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        ...styles[variant],
      }}
    >
      {children}
    </button>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function DriverScanInspect({ mode }: { mode: 'residential' | 'commercial' }) {
  const navigate       = useNavigate()
  const [searchParams] = useSearchParams()
  const { user }       = useAuthStore()
  const { updateStop } = useDriverStore()

  const stopId     = searchParams.get('stop_id')
  const routeId    = searchParams.get('route_id')
  const address    = searchParams.get('address') ?? ''
  // Expected QR code for this stop — fetched by DriverRouteView from qr_bags.bag_code.
  // If absent the stop is unassigned; any scanned code is accepted.
  const expectedQr = searchParams.get('expected_qr')

  const copy   = mode === 'commercial' ? COMMERCIAL : RESIDENTIAL
  const accent = mode === 'commercial' ? '#5eead4' : '#00c8ff'
  const backTo = '/dashboard/driver/route-map'

  // ── State ────────────────────────────────────────────────────────────────────

  const [phase,            setPhase]            = useState<Phase>('scanning')
  const [bagCode,          setBagCode]          = useState('')
  const [invalidCode,      setInvalidCode]      = useState('')     // last rejected scan value
  const [capturedImage,    setCapturedImage]    = useState<string | null>(null)
  const [cameraAnalyzing,  setCameraAnalyzing]  = useState(false)
  const [aiResult,         setAiResult]         = useState<AiResult | null>(null)
  const [cameraErrorCount, setCameraErrorCount] = useState(0)  // camera hardware failures
  const [aiErrorCount,     setAiErrorCount]     = useState(0)  // AI network/deploy failures
  const [showReportSheet,  setShowReportSheet]  = useState(false)
  const [reportNote,       setReportNote]       = useState('')
  const [scanMethod,       setScanMethod]       = useState<ScanMethod>('qr_scan')
  const [inspectionMethod, setInspectionMethod] = useState<InspectionMethod>('camera')
  const [yellowAttempts,   setYellowAttempts]   = useState(0)
  const [redAction,        setRedAction]        = useState<RedAction | null>(null)
  const [notes,            setNotes]            = useState('')
  const [showManualEntry,  setShowManualEntry]  = useState(false)
  const [manualInput,      setManualInput]      = useState('')
  const [isSubmitting,     setIsSubmitting]     = useState(false)
  const [errorMsg,         setErrorMsg]         = useState<string | null>(null)

  // ── QR validation ──────────────────────────────────────────────────────────

  /**
   * Normalize a QR value for comparison.
   *
   * Handles the two formats that appear in the system:
   *   • Residential Scan number stored in qr_bags.bag_code: "2100-5054-1834"
   *   • Physical QR sticker scanned by camera:              "QR210050541834"
   *
   * Steps:
   *   1. Uppercase
   *   2. Strip leading "QR" prefix (physical stickers)
   *   3. Strip all non-alphanumeric characters (dashes, spaces, etc.)
   *
   * Result: "210050541834" for both inputs above → exact match possible.
   */
  function normalizeQr(value: string): string {
    return value
      .toUpperCase()
      .replace(/^QR/, '')          // strip leading QR prefix from physical sticker
      .replace(/[^0-9A-Z]/g, '')   // strip dashes, spaces, and all other non-alphanumeric
  }

  /**
   * Strict exact-match validation after normalization.
   *
   * Source of truth priority:
   *   1. expectedQr URL param — bag code fetched from qr_bags.bag_code by DriverRouteView
   *   2. address URL param    — stop address also encodes the bag code in practice
   *   3. Neither present      → REJECT (cannot verify without a reference)
   *
   * CRITICAL: an empty/missing expected code is an automatic REJECT, not an accept.
   * NO partial / contains / endsWith / startsWith / fuzzy matching.
   */
  function validateQrCode(scanned: string): boolean {
    const rawExpected        = expectedQr || address || ''
    const normalizedExpected = normalizeQr(rawExpected)
    const normalizedScanned  = normalizeQr(scanned)

    // Both sides must be non-empty and exactly equal
    const isValid =
      normalizedExpected.length > 0 &&
      normalizedScanned.length  > 0 &&
      normalizedExpected === normalizedScanned

    console.log('[QR VALIDATION]')
    console.log('Residential Scan Expected Raw       :', rawExpected      || '(missing)')
    console.log('Residential Scan Expected Normalized:', normalizedExpected || '(empty)')
    console.log('Scanned Bag ID Raw                  :', scanned)
    console.log('Scanned Bag ID Normalized           :', normalizedScanned)
    console.log('Result                              :', isValid ? 'VALID ✅' : 'REJECTED ❌')
    console.log('Route ID                            :', routeId ?? '—')
    console.log('Stop ID                             :', stopId  ?? '—')

    return isValid
  }

  // ── QR scan handlers ─────────────────────────────────────────────────────────

  const handleQrScan = useCallback((decoded: string) => {
    const code = decoded.trim().toUpperCase()
    if (!validateQrCode(code)) {
      // Mismatch — lock scanner and show error
      setInvalidCode(code)
      setPhase('qr-mismatch')
      return
    }
    setScanMethod('qr_scan')
    setBagCode(code)
    setPhase('qr-verified')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expectedQr, routeId, stopId])

  const handlePermissionDenied = useCallback(() => {
    setPhase('permission-denied')
  }, [])

  function handleCameraError() {
    setPhase('camera-error')
  }

  // ── Manual entry ──────────────────────────────────────────────────────────────

  function submitManualCode() {
    const code = manualInput.trim().toUpperCase()
    if (!code) return

    if (!validateQrCode(code)) {
      // Still a mismatch from manual entry — reject and show error
      setInvalidCode(code)
      setManualInput('')
      setShowManualEntry(false)
      setPhase('qr-mismatch')
      return
    }

    setScanMethod('manual_entry')
    setBagCode(code)
    setManualInput('')
    setShowManualEntry(false)
    setPhase('qr-verified')
  }

  // ── Camera inspection handlers ────────────────────────────────────────────────

  /**
   * Called by CameraInspectionView once the driver taps "Capture & Inspect".
   * 1. Stores the photo and starts the analyzing animation.
   * 2. Calls the `analyze-bag-image` Supabase Edge Function (Google Gemini vision).
   * 3. Stores the AiResult and advances to the `ai-result` phase.
   *
   * On failure the edge function returns a graceful yellow fallback, so
   * this function only hits the camera-error phase if the network call itself
   * throws (offline / edge function not deployed).
   */
  async function handleCameraCapture(dataUrl: string) {
    setCapturedImage(dataUrl)
    setCameraAnalyzing(true)
    setAiResult(null)

    try {
      // Strip the "data:image/jpeg;base64," prefix for the API
      const commaIdx  = dataUrl.indexOf(',')
      const imageBase64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl
      const mimeMatch   = dataUrl.match(/data:([^;]+);/)
      const mimeType    = mimeMatch ? mimeMatch[1] : 'image/jpeg'

      const { data, error } = await supabase.functions.invoke<AiResult>(
        'analyze-bag-image',
        { body: { imageBase64, mimeType } },
      )

      if (error) throw error

      const validResults = ['green', 'yellow', 'red'] as const
      const result = validResults.includes(data?.result as typeof validResults[number])
        ? (data!.result as AiResult['result'])
        : 'yellow'

      // Track yellow attempts so we know when to show caution checklist vs force-rescan
      if (result === 'yellow') {
        setYellowAttempts(n => n + 1)
      }

      setAiResult({
        result,
        confidence: Math.min(100, Math.max(0, Math.round(Number(data?.confidence) || 50))),
        reason:     String(data?.reason ?? 'AI inspection complete.').slice(0, 120),
      })
      setPhase('ai-result')
    } catch {
      // AI network failure or function not deployed — distinct from camera hardware failure.
      // The camera worked fine; show a targeted AI error state, not "Camera Error".
      setAiErrorCount(n => n + 1)
      setPhase('ai-error')
    } finally {
      setCameraAnalyzing(false)
    }
  }

  /** Camera error during bag inspection (not QR scanning). */
  function handleInspectionCameraError() {
    setCameraErrorCount(n => n + 1)   // gates Manual Safety Review after 2+ failures
    setPhase('camera-error')
  }

  // ── Inspection result ─────────────────────────────────────────────────────────

  function selectResult(result: 'green' | 'yellow' | 'red') {
    if (result === 'yellow') setYellowAttempts(n => n + 1)
    setPhase(result)
  }

  function handleYellowRescan() {
    // Go back to camera for another look
    setCapturedImage(null)
    setCameraAnalyzing(false)
    setPhase('camera-inspecting')
  }

  // ── Save + complete ───────────────────────────────────────────────────────────

  async function finalize(
    bagStatus: 'green' | 'yellow' | 'red',
    finalDecision: 'accepted' | 'rejected',
    finalNotes: string,
    overrideReason?: string,
  ) {
    if (!user) return
    setIsSubmitting(true)
    setErrorMsg(null)
    try {
      await saveDriverBagScan({
        driverId:          user.id,
        routeId:           routeId,
        stopId:            stopId,
        bagQrCode:         bagCode,
        stopAddress:       address || null,
        bagStatus,
        finalDecision,
        scanMethod,
        inspectionMethod,
        notes:             finalNotes || null,
        overrideReason:    overrideReason || null,
        // AI vision fields — null when using manual override path
        aiConfidence:      aiResult?.confidence ?? null,
        aiReason:          aiResult?.reason     ?? null,
        photoUrl:          null, // reserved for when Storage bucket is configured
      })

      // Mark stop complete in DB (both accepted and rejected advance the route)
      if (stopId) {
        await completeStop(stopId)
        updateStop(stopId, { status: 'completed', completed_at: new Date().toISOString() })
      }

      // Notify consumer if bag was rejected
      if (finalDecision === 'rejected') {
        await notifyConsumerRejected(stopId, bagCode)
      }

      setPhase(finalDecision)
    } catch (err) {
      console.error('[DriverScanInspect] Save failed:', err)
      setErrorMsg('Unable to save bag decision. Please check connection or contact admin.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Convenience wrappers for each result path
  function acceptGreen() {
    finalize('green', 'accepted', 'Bag passed green inspection.')
  }

  function acceptYellow() {
    finalize('yellow', 'accepted', 'Driver accepted yellow inspection using discretion.')
  }

  function rejectYellow() {
    finalize('yellow', 'rejected', 'Driver rejected yellow inspection.')
  }

  function openRedNotes(action: RedAction) {
    setRedAction(action)
    setNotes('')
    setPhase('red-notes')
  }

  function confirmRed() {
    if (!redAction || !notes.trim()) return
    if (redAction === 'accepted') {
      finalize('red', 'accepted', '', notes.trim())
    } else {
      finalize('red', 'rejected', '', notes.trim())
    }
  }

  // ── AI result action helpers ──────────────────────────────────────────────────

  /**
   * Accept or reject after AI classification.
   * Uses aiResult to fill in bagStatus and notes automatically.
   */
  function finalizeFromAi(decision: 'accepted' | 'rejected', overrideReason?: string) {
    if (!aiResult) return
    const autoNotes =
      decision === 'accepted'
        ? `AI ${aiResult.result} result accepted by driver. ${aiResult.reason}`
        : `AI ${aiResult.result} result — bag rejected. ${aiResult.reason}`
    finalize(aiResult.result, decision, autoNotes, overrideReason)
  }

  /** Submit a driver report note alongside the AI decision. */
  function submitReport(decision: 'accepted' | 'rejected') {
    if (!aiResult || !reportNote.trim()) return
    finalize(
      aiResult.result,
      decision,
      `Driver report: ${reportNote.trim()} | AI: ${aiResult.reason}`,
    )
    setShowReportSheet(false)
    setReportNote('')
  }

  function goBack() {
    navigate(backTo, { replace: true })
  }

  // ── Auto-advance after pickup confirmed ───────────────────────────────────────
  // After finalize() sets phase to 'accepted'|'rejected', wait 1.5 s then:
  //   • Find the next pending stop in this route → navigate to its scan page
  //   • No more stops → navigate to the route-map (all done)
  // The driver can also tap "Continue Now" to skip the wait immediately.

  async function advanceRoute() {
    if (routeId) {
      try {
        const { data: nextStop } = await supabase
          .from('route_stops')
          .select('id, bag_id, address')
          .eq('route_id', routeId)
          .neq('id', stopId ?? '')   // exclude current stop (already completed)
          .eq('status', 'pending')
          .order('stop_order', { ascending: true })
          .limit(1)
          .maybeSingle()

        if (nextStop) {
          // Look up the bag QR code so the next scan can validate strictly
          let nextExpectedQr: string | null = null
          if (nextStop.bag_id) {
            const { data: bag } = await supabase
              .from('qr_bags')
              .select('bag_code')
              .eq('id', nextStop.bag_id)
              .maybeSingle()
            nextExpectedQr = bag?.bag_code ?? null
          }

          const params = new URLSearchParams({
            stop_id:  nextStop.id,
            route_id: routeId,
            address:  nextStop.address ?? '',
            mode:     'residential',
          })
          if (nextExpectedQr) params.set('expected_qr', nextExpectedQr)
          navigate(`/driver/scan?${params.toString()}`, { replace: true })
          return
        }
      } catch (e) {
        console.warn('[auto-advance] next stop lookup failed:', e)
      }
    }
    // No more pending stops (or no route context) → back to route map
    navigate(backTo, { replace: true })
  }

  // Fire auto-advance 1.5 s after any finalized decision
  useEffect(() => {
    if (phase !== 'accepted' && phase !== 'rejected') return
    let cancelled = false
    const timer = setTimeout(() => { if (!cancelled) advanceRoute() }, 1500)
    return () => { cancelled = true; clearTimeout(timer) }
  // advanceRoute is stable (captures routeId/stopId via closure at render time)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div
      className="relative min-h-screen overflow-y-auto"
      style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}
    >
      <style>{`
        @keyframes resultBounce {
          0%  { transform:scale(0.5); opacity:0; }
          65% { transform:scale(1.1); opacity:1; }
          100%{ transform:scale(1); }
        }
        @keyframes fadeSlideUp {
          from { opacity:0; transform:translateY(14px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes scanLine {
          0%   { transform:translateY(-100%); }
          100% { transform:translateY(100%); }
        }
        @keyframes pulse {
          0%, 100% { transform:scale(0.7); opacity:0.4; }
          50%       { transform:scale(1.2); opacity:1; }
        }
      `}</style>
      <div className="pointer-events-none absolute inset-0 grid-bg" />

      <div className="relative max-w-md mx-auto px-5 pt-5 pb-14" style={{ zIndex: 1 }}>

        {/* ── Top bar ── */}
        <div className="flex items-center justify-between mb-5">
          <button
            onClick={goBack}
            style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 999, color: 'rgba(255,255,255,0.65)',
              padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >
            ← Back
          </button>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            {mode === 'commercial' ? 'Commercial Scan' : 'Residential Scan'}
          </span>
        </div>

        {/* ── Address chip (when available) ── */}
        {address && (
          <div
            className="rounded-xl px-3 py-2 mb-4 flex items-center gap-2"
            style={{ background: 'rgba(0,200,255,0.07)', border: '1px solid rgba(0,200,255,0.18)' }}
          >
            <span style={{ fontSize: 14 }}>📍</span>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.4 }}>{address}</p>
          </div>
        )}

        {/* ── Error banner ── */}
        {errorMsg && (
          <div className="rounded-xl px-4 py-3 mb-4" style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)' }}>
            <p style={{ fontSize: 12, color: '#f87171' }}>{errorMsg}</p>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════
            PHASE: SCANNING
           ════════════════════════════════════════════════════════ */}
        {phase === 'scanning' && (
          <div className="space-y-4">
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: accent, marginBottom: 4 }}>{copy.scanTitle}</h1>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.55 }}>{copy.scanSubtitle}</p>
            </div>

            {/* Real camera QR scanner */}
            <div style={{ borderRadius: 16, overflow: 'hidden', border: `1px solid ${accent}40` }}>
              <QrScanner onScan={handleQrScan} onPermissionDenied={handlePermissionDenied} />
            </div>

            {/* Can't scan — manual entry */}
            <button
              onClick={() => setShowManualEntry(true)}
              style={{ width: '100%', background: 'none', border: 'none', color: accent, fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: '6px 0' }}
            >
              Can't scan? Enter QR code manually →
            </button>

            {/* Camera override */}
            <ActionBtn variant="secondary" onClick={handleCameraError}>
              Override Camera Scanner
            </ActionBtn>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════
            PHASE: QR MISMATCH — wrong bag scanned
           ════════════════════════════════════════════════════════ */}
        {phase === 'qr-mismatch' && (
          <div className="space-y-4" style={{ animation: 'fadeSlideUp 0.3s ease both' }}>
            {/* Error header */}
            <div className="flex flex-col items-center py-4 gap-3">
              <div style={{
                width: 76, height: 76, borderRadius: '50%',
                background: 'rgba(248,113,113,0.12)', border: '3px solid #f87171',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 36, boxShadow: '0 0 30px rgba(248,113,113,0.3)',
              }}>❌</div>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: '#f87171' }}>REJECTED — Incorrect QR Code</h2>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 1.5 }}>
                The scanned Bag ID does not match the Residential Scan number for this pickup. Please scan the correct bag.
              </p>
            </div>

            {/* Mismatch detail card */}
            <div
              className="rounded-2xl p-4 space-y-3"
              style={{ background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.25)' }}
            >
              {/* Residential scan number (expected) */}
              <div>
                <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>
                  Residential Scan Expected
                </p>
                <p className="font-mono" style={{ fontSize: 14, color: '#4ade80', fontWeight: 700 }}>
                  {expectedQr ?? '(unassigned)'}
                </p>
                {expectedQr && (
                  <p className="font-mono" style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                    normalized → {expectedQr.toUpperCase().replace(/^QR/, '').replace(/[^0-9A-Z]/g, '')}
                  </p>
                )}
              </div>
              <div style={{ height: 1, background: 'rgba(255,255,255,0.07)' }} />
              {/* Scanned bag ID */}
              <div>
                <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>
                  Scanned Bag ID
                </p>
                <p className="font-mono" style={{ fontSize: 14, color: '#f87171', fontWeight: 700 }}>
                  {invalidCode}
                </p>
                {invalidCode && (
                  <p className="font-mono" style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                    normalized → {invalidCode.toUpperCase().replace(/^QR/, '').replace(/[^0-9A-Z]/g, '')}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f87171', flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: '#f87171', fontWeight: 600 }}>❌ REJECTED — numbers do not match</span>
              </div>
            </div>

            {/* Actions */}
            <ActionBtn
              onClick={() => {
                setInvalidCode('')
                setManualInput('')
                setPhase('scanning')
              }}
              variant="primary"
            >
              🔄 Scan Again
            </ActionBtn>
            <ActionBtn
              onClick={() => {
                setInvalidCode('')
                setManualInput('')
                setShowManualEntry(true)
                setPhase('scanning')   // backdrop returns to scan if cancelled
              }}
              variant="secondary"
            >
              ✏️ Manual Entry
            </ActionBtn>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════
            PHASE: PERMISSION DENIED
           ════════════════════════════════════════════════════════ */}
        {phase === 'permission-denied' && (
          <div className="space-y-4">
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: '#f87171', marginBottom: 4 }}>Camera Permission Needed</h1>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.55 }}>
                Enable camera access in your browser settings, then try again.
              </p>
            </div>
            <ActionBtn onClick={() => setPhase('scanning')} variant="secondary">Try Again</ActionBtn>
            <ActionBtn onClick={() => { setShowManualEntry(true) }} variant="secondary">Enter QR Code Manually</ActionBtn>
            <ActionBtn onClick={() => { setInspectionMethod('override'); setCapturedImage(null); setPhase('inspecting') }}>
              Override Camera — Manual Inspection
            </ActionBtn>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════
            PHASE: CAMERA ERROR
           ════════════════════════════════════════════════════════ */}
        {phase === 'camera-error' && (
          <div className="space-y-4">
            <PhaseCard>
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <p style={{ fontSize: 36, marginBottom: 10 }}>📷</p>
                <h2 style={{ fontSize: 17, fontWeight: 700, color: '#fbbf24', marginBottom: 6 }}>
                  {cameraErrorCount === 1 ? 'Camera Error — Try Again' : 'Repeated Camera Failure'}
                </h2>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
                  {cameraErrorCount < 2
                    ? 'We could not complete the bag inspection. Please try the camera again.'
                    : 'Camera has failed more than once. You may use manual safety review as a last resort.'}
                </p>
              </div>
            </PhaseCard>

            {/* Always: Rescan Camera (primary action) */}
            <ActionBtn
              onClick={() => { setCapturedImage(null); setCameraAnalyzing(false); setPhase('camera-inspecting') }}
              variant="primary"
            >
              🔄 Rescan Camera
            </ActionBtn>

            {/* Manual Safety Review — only shown after 2+ failures, never as first option */}
            {cameraErrorCount >= 2 && (
              <ActionBtn
                onClick={() => { setInspectionMethod('override'); setCapturedImage(null); setPhase('inspecting') }}
                variant="caution"
              >
                📋 Manual Safety Review
              </ActionBtn>
            )}

          </div>
        )}

        {/* ════════════════════════════════════════════════════════
            PHASE: AI-ERROR — AI network / deployment failure
            Camera hardware worked fine. The problem is the AI service.
            Distinct from camera-error so drivers don't think their camera broke.
           ════════════════════════════════════════════════════════ */}
        {phase === 'ai-error' && (
          <div className="space-y-4">
            <PhaseCard>
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <p style={{ fontSize: 36, marginBottom: 10 }}>🤖</p>
                <h2 style={{ fontSize: 17, fontWeight: 700, color: '#fbbf24', marginBottom: 6 }}>
                  AI Analyzer Unavailable
                </h2>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.55 }}>
                  {aiErrorCount === 1
                    ? 'Could not reach the AI inspection service. Your camera is working — please try again.'
                    : `Failed ${aiErrorCount} times. The AI service may be down or not yet deployed. Try again or use manual review.`}
                </p>
              </div>

              {/* Deployment hint — useful for developer / admin */}
              {aiErrorCount >= 2 && (
                <div
                  className="rounded-xl px-3 py-2.5 mt-2"
                  style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.18)', textAlign: 'left' }}
                >
                  <p style={{ fontSize: 10, fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
                    Setup required
                  </p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.55 }}>
                    Set the GOOGLE_VISION_API_KEY Supabase secret and redeploy the analyze-bag-image edge function.
                  </p>
                </div>
              )}
            </PhaseCard>

            {/* Always: Try Again (camera worked fine, just retry the AI call) */}
            <ActionBtn
              onClick={() => { setCapturedImage(null); setCameraAnalyzing(false); setPhase('camera-inspecting') }}
              variant="primary"
            >
              🔄 Try Again
            </ActionBtn>

            {/* Manual Safety Review — only after 2+ AI failures */}
            {(import.meta.env.DEV || aiErrorCount >= 2) && (
              <ActionBtn
                onClick={() => { setInspectionMethod('override'); setCapturedImage(null); setPhase('inspecting') }}
                variant="caution"
              >
                📋 Manual Safety Review
              </ActionBtn>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════
            PHASE: QR VERIFIED
           ════════════════════════════════════════════════════════ */}
        {phase === 'qr-verified' && (
          <div className="space-y-4">
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#4ade80' }}>
              {scanMethod === 'manual_entry' ? 'Manual Code Entered' : 'QR Code Verified ✓'}
            </h1>
            <PhaseCard>
              <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {copy.qrLabel}
              </p>
              <p className="font-mono" style={{ fontSize: 18, color: accent, fontWeight: 700, wordBreak: 'break-all' }}>
                {bagCode}
              </p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                Scan method: {scanMethod === 'manual_entry' ? 'Manual entry' : 'QR camera scan'}
              </p>
            </PhaseCard>

            <ActionBtn onClick={() => { setCapturedImage(null); setCameraAnalyzing(false); setPhase('camera-inspecting') }}>
              📷 Begin Bag Inspection →
            </ActionBtn>
            <ActionBtn onClick={() => setPhase('scanning')} variant="secondary">
              Rescan QR
            </ActionBtn>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════
            PHASE: CAMERA-INSPECTING — live viewfinder
           ════════════════════════════════════════════════════════ */}
        {phase === 'camera-inspecting' && !cameraAnalyzing && (
          <CameraInspectionView
            onCapture={handleCameraCapture}
            onError={handleInspectionCameraError}
            accent={accent}
          />
        )}


        {/* ════════════════════════════════════════════════════════
            CAMERA ANALYZING — brief AI-analysis animation overlay
           ════════════════════════════════════════════════════════ */}
        {cameraAnalyzing && (
          <div className="flex flex-col items-center justify-center py-12 gap-5" style={{ animation: 'fadeSlideUp 0.3s ease both' }}>
            {capturedImage && (
              <div style={{ position: 'relative', width: '100%', borderRadius: 16, overflow: 'hidden', maxHeight: 240 }}>
                <img src={capturedImage} alt="Captured bag" style={{ width: '100%', objectFit: 'cover', display: 'block', filter: 'brightness(0.65)' }} />
                {/* Scan animation overlay */}
                <div style={{
                  position: 'absolute', inset: 0,
                  background: `linear-gradient(180deg, transparent 0%, ${accent}25 50%, transparent 100%)`,
                  animation: 'scanLine 1.5s ease-in-out infinite',
                }} />
              </div>
            )}
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 22, fontWeight: 800, color: accent, marginBottom: 6 }}>AI Analyzing…</p>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.55 }}>
                Checking bag condition for leaks, tears,<br />
                contamination, and safety hazards.
              </p>
            </div>
            {/* Animated dots */}
            <div className="flex gap-2">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  style={{
                    width: 10, height: 10, borderRadius: '50%', background: accent,
                    animation: `pulse 1.1s ${i * 0.22}s ease-in-out infinite`,
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════
            PHASE: AI-RESULT — AI classification shown to driver
           ════════════════════════════════════════════════════════ */}
        {phase === 'ai-result' && aiResult && (
          <div className="space-y-4" style={{ animation: 'fadeSlideUp 0.35s ease both' }}>

            {/* ── Result hero ── */}
            <div className="flex flex-col items-center py-5 gap-3">
              <div style={{
                width: 88, height: 88, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 44,
                animation: 'resultBounce 0.5s ease both',
                background:
                  aiResult.result === 'green' ? 'rgba(34,197,94,0.15)'
                : aiResult.result === 'yellow' ? 'rgba(251,191,36,0.15)'
                : 'rgba(248,113,113,0.15)',
                border:
                  aiResult.result === 'green' ? '3px solid #22c55e'
                : aiResult.result === 'yellow' ? '3px solid #fbbf24'
                : '3px solid #f87171',
                boxShadow:
                  aiResult.result === 'green' ? '0 0 40px rgba(34,197,94,0.4)'
                : aiResult.result === 'yellow' ? '0 0 40px rgba(251,191,36,0.4)'
                : '0 0 40px rgba(248,113,113,0.4)',
              }}>
                {aiResult.result === 'green' ? '✅' : aiResult.result === 'yellow' ? '⚠️' : '❌'}
              </div>

              <h2 style={{
                fontSize: 22, fontWeight: 800, textAlign: 'center',
                color: aiResult.result === 'green' ? '#4ade80' : aiResult.result === 'yellow' ? '#fbbf24' : '#f87171',
              }}>
                {aiResult.result === 'green'  && 'Bag Approved'}
                {aiResult.result === 'yellow' && 'Rescan Required'}
                {aiResult.result === 'red'    && 'Unsafe — Bag Rejected'}
              </h2>
            </div>

            {/* ── AI details card ── */}
            <div
              className="rounded-2xl p-4 space-y-3"
              style={{
                background:
                  aiResult.result === 'green'  ? 'rgba(34,197,94,0.06)'
                : aiResult.result === 'yellow' ? 'rgba(251,191,36,0.06)'
                : 'rgba(248,113,113,0.06)',
                border:
                  aiResult.result === 'green'  ? '1px solid rgba(34,197,94,0.25)'
                : aiResult.result === 'yellow' ? '1px solid rgba(251,191,36,0.25)'
                : '1px solid rgba(248,113,113,0.25)',
              }}
            >
              {[
                {
                  label: 'AI Result',
                  value: aiResult.result.toUpperCase(),
                  color: aiResult.result === 'green' ? '#4ade80' : aiResult.result === 'yellow' ? '#fbbf24' : '#f87171',
                },
                {
                  label: 'Confidence',
                  value: `${aiResult.confidence}%`,
                  color: aiResult.confidence >= 80 ? '#4ade80' : aiResult.confidence >= 50 ? '#fbbf24' : '#f87171',
                },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between">
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>{row.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: row.color }}>{row.value}</span>
                </div>
              ))}
              <div style={{ paddingTop: 4, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
                  Reason
                </p>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 1.55 }}>
                  {aiResult.reason}
                </p>
              </div>
            </div>

            {/* ── Captured image thumbnail ── */}
            {capturedImage && (
              <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', maxHeight: 140 }}>
                <img src={capturedImage} alt="Inspected bag" style={{ width: '100%', objectFit: 'cover', display: 'block' }} />
              </div>
            )}

            {/* ── Action buttons: GREEN ─────────────────────────────────────────
                Driver accepts — one primary action, no manual choice needed.
               ────────────────────────────────────────────────────────────── */}
            {aiResult.result === 'green' && (
              <>
                <ActionBtn onClick={() => finalizeFromAi('accepted')} disabled={isSubmitting} variant="success">
                  {isSubmitting ? 'Saving…' : '✓ Continue — Accept Pickup'}
                </ActionBtn>
                <ActionBtn onClick={() => { setReportNote(''); setShowReportSheet(true) }} variant="secondary" disabled={isSubmitting}>
                  📋 Report Issue
                </ActionBtn>
                {/* Rescan (rarely needed for green, but keep for edge cases) */}
                <button
                  onClick={() => { setCapturedImage(null); setCameraAnalyzing(false); setYellowAttempts(0); setPhase('camera-inspecting') }}
                  disabled={isSubmitting}
                  style={{
                    width: '100%', background: 'none', border: 'none',
                    color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: 500,
                    cursor: 'pointer', padding: '4px 0', textAlign: 'center',
                  }}
                >
                  Rescan bag
                </button>
              </>
            )}

            {/* ── Action buttons: YELLOW ────────────────────────────────────────
                First yellow  → force rescan (driver must try again).
                Second+ yellow → show caution checklist, then driver decides.
               ────────────────────────────────────────────────────────────── */}
            {aiResult.result === 'yellow' && yellowAttempts < 2 && (
              <>
                {/* First yellow — only Rescan is available */}
                <div
                  className="rounded-xl px-4 py-3"
                  style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)' }}
                >
                  <p style={{ fontSize: 12, color: '#fbbf24', lineHeight: 1.55 }}>
                    The AI was not confident enough to approve this bag. Please rescan for a clearer image.
                  </p>
                </div>
                <ActionBtn
                  onClick={() => { setCapturedImage(null); setCameraAnalyzing(false); setPhase('camera-inspecting') }}
                  variant="primary"
                  disabled={isSubmitting}
                >
                  🔄 Rescan Bag
                </ActionBtn>
                <ActionBtn onClick={() => { setReportNote(''); setShowReportSheet(true) }} variant="secondary" disabled={isSubmitting}>
                  📋 Report Issue
                </ActionBtn>
              </>
            )}
            {aiResult.result === 'yellow' && yellowAttempts >= 2 && (
              <>
                {/* Second+ yellow — show caution checklist, then driver decides */}
                <div
                  className="rounded-xl px-4 py-3"
                  style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.25)' }}
                >
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24', marginBottom: 8 }}>
                    ⚠️ Caution — Check Before Deciding
                  </p>
                  <ul className="space-y-1.5">
                    {copy.yellowChecklist.map(item => (
                      <li key={item} style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5, display: 'flex', gap: 6 }}>
                        <span style={{ color: '#fbbf24', flexShrink: 0 }}>•</span>{item}
                      </li>
                    ))}
                  </ul>
                </div>
                <ActionBtn onClick={() => finalizeFromAi('accepted')} disabled={isSubmitting} variant="caution">
                  {isSubmitting ? 'Saving…' : '✓ Accept with Caution'}
                </ActionBtn>
                <ActionBtn onClick={() => finalizeFromAi('rejected')} disabled={isSubmitting} variant="danger">
                  {isSubmitting ? 'Saving…' : '🚫 Reject Bag'}
                </ActionBtn>
                <ActionBtn onClick={() => { setReportNote(''); setShowReportSheet(true) }} variant="secondary" disabled={isSubmitting}>
                  📋 Report Issue
                </ActionBtn>
              </>
            )}

            {/* ── Action buttons: RED ───────────────────────────────────────────
                AI detected an unsafe bag — auto-reject with one tap.
                Override accept is available but de-emphasized (red-notes path).
               ────────────────────────────────────────────────────────────── */}
            {aiResult.result === 'red' && (
              <>
                <ActionBtn onClick={() => finalizeFromAi('rejected')} disabled={isSubmitting} variant="danger">
                  {isSubmitting ? 'Saving…' : '🚫 Continue — Bag Rejected'}
                </ActionBtn>
                <ActionBtn onClick={() => { setReportNote(''); setShowReportSheet(true) }} variant="secondary" disabled={isSubmitting}>
                  📋 Report Issue
                </ActionBtn>
                {/* Override — de-emphasized text link, not a full button */}
                <button
                  onClick={() => { setRedAction('accepted'); setNotes(''); setPhase('red-notes') }}
                  disabled={isSubmitting}
                  style={{
                    width: '100%', background: 'none', border: 'none',
                    color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: 500,
                    cursor: 'pointer', padding: '4px 0', textAlign: 'center',
                  }}
                >
                  Override Accept (requires supervisor reason)
                </button>
              </>
            )}

            {errorMsg && (
              <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)' }}>
                <p style={{ fontSize: 12, color: '#f87171' }}>{errorMsg}</p>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════
            PHASE: INSPECTING — manual fallback (last resort only)
            Production: only reachable after 2+ camera failures.
            DEV: always renders for testing.
           ════════════════════════════════════════════════════════ */}
        {phase === 'inspecting' && (cameraErrorCount >= 2 || aiErrorCount >= 2) && (
          <div className="space-y-4">
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: accent, marginBottom: 4 }}>
                {inspectionMethod === 'override' ? '⚠️ Manual Override — Select Status' : '🔍 Confirm Bag Status'}
              </h1>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
                {inspectionMethod === 'override'
                  ? 'Camera inspection bypassed. Select the bag status based on your visual inspection.'
                  : 'AI scan complete. Confirm the bag status based on what you observed:'}
              </p>
            </div>

            {/* Captured image thumbnail (when available) */}
            {capturedImage && inspectionMethod !== 'override' && (
              <div style={{ borderRadius: 14, overflow: 'hidden', border: `1px solid ${accent}30`, maxHeight: 160 }}>
                <img src={capturedImage} alt="Inspected bag" style={{ width: '100%', objectFit: 'cover', display: 'block' }} />
              </div>
            )}

            {/* 3-column RAG buttons */}
            <div className="grid grid-cols-3 gap-3">
              {/* GREEN */}
              <button
                onClick={() => selectResult('green')}
                className="rounded-2xl py-6 flex flex-col items-center gap-2 transition-all active:scale-[0.92] hover:brightness-110"
                style={{ background: 'rgba(34,197,94,0.1)', border: '2px solid rgba(34,197,94,0.5)', cursor: 'pointer' }}
              >
                <div style={{
                  width: 48, height: 48, borderRadius: '50%',
                  background: '#22c55e', boxShadow: '0 0 20px rgba(34,197,94,0.55)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
                }}>✅</div>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#4ade80' }}>GREEN</span>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textAlign: 'center', lineHeight: 1.3 }}>
                  Clean recyclables
                </span>
              </button>

              {/* YELLOW */}
              <button
                onClick={() => selectResult('yellow')}
                className="rounded-2xl py-6 flex flex-col items-center gap-2 transition-all active:scale-[0.92] hover:brightness-110"
                style={{ background: 'rgba(251,191,36,0.1)', border: '2px solid rgba(251,191,36,0.5)', cursor: 'pointer' }}
              >
                <div style={{
                  width: 48, height: 48, borderRadius: '50%',
                  background: '#fbbf24', boxShadow: '0 0 20px rgba(251,191,36,0.55)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
                }}>⚠️</div>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#fbbf24' }}>YELLOW</span>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textAlign: 'center', lineHeight: 1.3 }}>
                  Needs review
                </span>
              </button>

              {/* RED */}
              <button
                onClick={() => selectResult('red')}
                className="rounded-2xl py-6 flex flex-col items-center gap-2 transition-all active:scale-[0.92] hover:brightness-110"
                style={{ background: 'rgba(248,113,113,0.1)', border: '2px solid rgba(248,113,113,0.5)', cursor: 'pointer' }}
              >
                <div style={{
                  width: 48, height: 48, borderRadius: '50%',
                  background: '#f87171', boxShadow: '0 0 20px rgba(248,113,113,0.55)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
                }}>❌</div>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#f87171' }}>RED</span>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textAlign: 'center', lineHeight: 1.3 }}>
                  Contaminated
                </span>
              </button>
            </div>

          </div>
        )}

        {/* ════════════════════════════════════════════════════════
            PHASE: GREEN
           ════════════════════════════════════════════════════════ */}
        {phase === 'green' && (
          <div className="space-y-4" style={{ animation: 'fadeSlideUp 0.35s ease both' }}>
            <div className="flex flex-col items-center py-4 gap-3">
              <div style={{
                width: 88, height: 88, borderRadius: '50%',
                background: 'rgba(34,197,94,0.15)', border: '3px solid #22c55e',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 44, boxShadow: '0 0 40px rgba(34,197,94,0.45)',
                animation: 'resultBounce 0.5s ease both',
              }}>✅</div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: '#4ade80' }}>{copy.greenTitle}</h2>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', textAlign: 'center' }}>{copy.greenBody}</p>
            </div>

            <PhaseCard>
              <div className="flex justify-between text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
                <span>Bag</span><span className="font-mono" style={{ color: '#4ade80' }}>{bagCode}</span>
              </div>
              <div className="flex justify-between text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
                <span>Result</span><span style={{ color: '#4ade80', fontWeight: 700 }}>Approved</span>
              </div>
            </PhaseCard>

            <ActionBtn onClick={acceptGreen} disabled={isSubmitting} variant="success">
              {isSubmitting ? 'Saving…' : '✓ Accept — Mark Pickup Complete'}
            </ActionBtn>
            <ActionBtn onClick={acceptGreen} disabled={isSubmitting} variant="secondary">
              OK
            </ActionBtn>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════
            PHASE: YELLOW
           ════════════════════════════════════════════════════════ */}
        {phase === 'yellow' && (
          <div className="space-y-4" style={{ animation: 'fadeSlideUp 0.35s ease both' }}>
            <div className="flex flex-col items-center py-4 gap-2">
              <div style={{
                width: 76, height: 76, borderRadius: '50%',
                background: 'rgba(251,191,36,0.15)', border: '3px solid #fbbf24',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 38, boxShadow: '0 0 35px rgba(251,191,36,0.4)',
                animation: 'resultBounce 0.5s ease both',
              }}>⚠️</div>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: '#fbbf24' }}>{copy.yellowTitle}</h2>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>{copy.yellowBody}</p>
            </div>

            <PhaseCard>
              <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(251,191,36,0.7)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Inspection Checklist
              </p>
              <Checklist items={copy.yellowChecklist} accent="#fbbf24" />
            </PhaseCard>

            {yellowAttempts < 3 && (
              <ActionBtn
                onClick={handleYellowRescan}
                variant="secondary"
              >
                🔄 Rescan — attempt {yellowAttempts + 1} of 3
              </ActionBtn>
            )}
            {yellowAttempts >= 3 && (
              <div
                className="rounded-xl px-4 py-3"
                style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.3)' }}
              >
                <p style={{ fontSize: 12, color: '#fbbf24' }}>
                  Maximum rescans reached ({yellowAttempts}). Driver decision required.
                </p>
              </div>
            )}
            <ActionBtn onClick={acceptYellow} disabled={isSubmitting} variant="caution">
              {isSubmitting ? 'Saving…' : '✓ Accept with Caution'}
            </ActionBtn>
            <ActionBtn onClick={rejectYellow} disabled={isSubmitting} variant="danger">
              {isSubmitting ? 'Saving…' : '🚫 Reject Pickup'}
            </ActionBtn>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════
            PHASE: RED
           ════════════════════════════════════════════════════════ */}
        {phase === 'red' && (
          <div className="space-y-4" style={{ animation: 'fadeSlideUp 0.35s ease both' }}>
            <div className="flex flex-col items-center py-4 gap-2">
              <div style={{
                width: 76, height: 76, borderRadius: '50%',
                background: 'rgba(248,113,113,0.15)', border: '3px solid #f87171',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 38, boxShadow: '0 0 35px rgba(248,113,113,0.45)',
                animation: 'resultBounce 0.5s ease both',
              }}>❌</div>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: '#f87171' }}>{copy.redTitle}</h2>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>{copy.redBody}</p>
            </div>

            <PhaseCard>
              <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(248,113,113,0.7)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Safety Instructions
              </p>
              <Checklist items={copy.redChecklist} accent="#f87171" />
            </PhaseCard>

            <ActionBtn onClick={() => openRedNotes('accepted')} variant="caution">
              ⚠️ Accept with Override (requires reason)
            </ActionBtn>
            <ActionBtn onClick={() => openRedNotes('rejected')} variant="danger">
              🚫 Reject Unsafe Bag (requires reason)
            </ActionBtn>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════
            PHASE: RED NOTES — require reason before confirming
           ════════════════════════════════════════════════════════ */}
        {phase === 'red-notes' && (
          <div className="space-y-4" style={{ animation: 'fadeSlideUp 0.35s ease both' }}>
            <div>
              <h2 style={{ fontSize: 19, fontWeight: 800, color: redAction === 'accepted' ? '#fbbf24' : '#f87171', marginBottom: 4 }}>
                {redAction === 'accepted' ? '⚠️ Confirm Safety Override' : '🚫 Confirm Rejection'}
              </h2>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.55 }}>
                A reason is required for this decision. Describe what you observed.
              </p>
            </div>

            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={
                redAction === 'accepted'
                  ? 'Reason for accepting despite red inspection…'
                  : 'Describe why this bag is unsafe or prohibited…'
              }
              rows={4}
              style={{
                width: '100%', borderRadius: 14, padding: '12px 14px',
                background: 'rgba(255,255,255,0.06)',
                border: `1px solid ${redAction === 'accepted' ? 'rgba(251,191,36,0.3)' : 'rgba(248,113,113,0.3)'}`,
                color: '#fff', fontSize: 13, lineHeight: 1.55, outline: 'none', resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: -8 }}>
              {notes.trim().length}/10 chars min · {notes.trim().length < 10 ? `${10 - notes.trim().length} more needed` : 'OK to submit'}
            </p>

            <ActionBtn
              onClick={confirmRed}
              disabled={isSubmitting || notes.trim().length < 10}
              variant={redAction === 'accepted' ? 'caution' : 'danger'}
            >
              {isSubmitting ? 'Saving…' : redAction === 'accepted' ? '⚠️ Confirm Override' : '🚫 Confirm Rejection'}
            </ActionBtn>
            <ActionBtn onClick={() => setPhase('red')} variant="secondary">
              ← Back
            </ActionBtn>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════
            PHASE: ACCEPTED ✅
           ════════════════════════════════════════════════════════ */}
        {phase === 'accepted' && (
          <div className="flex flex-col items-center py-8 gap-4" style={{ animation: 'fadeSlideUp 0.4s ease both' }}>
            <div style={{ fontSize: 64, animation: 'resultBounce 0.5s ease both' }}>✅</div>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: '#4ade80', textAlign: 'center' }}>{copy.acceptedLabel}</h2>
            <p className="font-mono" style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', wordBreak: 'break-all', textAlign: 'center' }}>
              {bagCode}
            </p>
            <PhaseCard>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 1.5 }}>
                Stop marked complete.
              </p>
              <p style={{ fontSize: 12, color: '#4ade80', textAlign: 'center', fontWeight: 600 }}>
                ▶ Advancing to next stop…
              </p>
            </PhaseCard>
            <ActionBtn onClick={advanceRoute} variant="success">
              Continue Now →
            </ActionBtn>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════
            PHASE: REJECTED 🚫
           ════════════════════════════════════════════════════════ */}
        {phase === 'rejected' && (
          <div className="flex flex-col items-center py-8 gap-4" style={{ animation: 'fadeSlideUp 0.4s ease both' }}>
            <div style={{ fontSize: 64, animation: 'resultBounce 0.5s ease both' }}>🚫</div>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: '#f87171', textAlign: 'center' }}>{copy.rejectedLabel}</h2>
            <p className="font-mono" style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', wordBreak: 'break-all', textAlign: 'center' }}>
              {bagCode}
            </p>
            <div
              className="rounded-2xl px-4 py-4 w-full space-y-2"
              style={{ background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.2)' }}
            >
              <p style={{ fontSize: 12, color: '#f87171', fontWeight: 700 }}>Consumer notified ✓</p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
                The recycling rules have been sent to the bag owner's account.
              </p>
              <p style={{ fontSize: 12, color: '#f87171', fontWeight: 600 }}>
                ▶ Advancing to next stop…
              </p>
            </div>
            <ActionBtn onClick={advanceRoute} variant="danger">
              Continue Route →
            </ActionBtn>
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════
          REPORT ISSUE SHEET — driver notes + final decision
         ════════════════════════════════════════════════════════ */}
      {showReportSheet && aiResult && (
        <>
          <div
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
            onClick={() => setShowReportSheet(false)}
          />
          <div
            className="fixed z-50 left-4 right-4 rounded-3xl p-6 space-y-4"
            style={{
              bottom: 32,
              background: 'linear-gradient(180deg,#0a1628,#060e24)',
              border: '1px solid rgba(251,191,36,0.3)',
              boxShadow: '0 -8px 48px rgba(0,0,0,0.6)',
            }}
          >
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 4 }}>📋 Report Issue</h3>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
                Describe what you observed. Your note will be saved with this scan record.
              </p>
            </div>

            <div
              className="rounded-xl px-3 py-2 flex items-center gap-2"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>AI said:</span>
              <span style={{
                fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                color: aiResult.result === 'green' ? '#4ade80' : aiResult.result === 'yellow' ? '#fbbf24' : '#f87171',
              }}>
                {aiResult.result}
              </span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                — {aiResult.reason}
              </span>
            </div>

            <textarea
              value={reportNote}
              onChange={e => setReportNote(e.target.value)}
              placeholder="Describe the issue or what you observed…"
              rows={3}
              style={{
                width: '100%', borderRadius: 14, padding: '12px 14px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(251,191,36,0.3)',
                color: '#fff', fontSize: 13, lineHeight: 1.55, outline: 'none', resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: -8 }}>
              {reportNote.trim().length} chars{reportNote.trim().length < 10 ? ` · ${10 - reportNote.trim().length} more needed` : ' · OK to submit'}
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => submitReport('rejected')}
                disabled={isSubmitting || reportNote.trim().length < 10}
                style={{
                  flex: 1, padding: '11px 0', borderRadius: 12,
                  background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.35)',
                  color: '#f87171', fontSize: 13, fontWeight: 700,
                  cursor: (isSubmitting || reportNote.trim().length < 10) ? 'not-allowed' : 'pointer',
                  opacity: (isSubmitting || reportNote.trim().length < 10) ? 0.45 : 1,
                }}
              >
                🚫 Reject
              </button>
              <button
                onClick={() => submitReport('accepted')}
                disabled={isSubmitting || reportNote.trim().length < 10}
                style={{
                  flex: 1, padding: '11px 0', borderRadius: 12,
                  background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.35)',
                  color: '#4ade80', fontSize: 13, fontWeight: 700,
                  cursor: (isSubmitting || reportNote.trim().length < 10) ? 'not-allowed' : 'pointer',
                  opacity: (isSubmitting || reportNote.trim().length < 10) ? 0.45 : 1,
                }}
              >
                ✓ Accept
              </button>
            </div>

            <button
              onClick={() => setShowReportSheet(false)}
              style={{
                width: '100%', padding: '10px 0', borderRadius: 12,
                background: 'none', border: 'none',
                color: 'rgba(255,255,255,0.35)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════════════
          MANUAL ENTRY MODAL
         ════════════════════════════════════════════════════════ */}
      {showManualEntry && (
        <>
          <div
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
            onClick={() => setShowManualEntry(false)}
          />
          <div
            className="fixed z-50 left-4 right-4 rounded-3xl p-6 space-y-4"
            style={{
              bottom: 32,
              background: 'linear-gradient(180deg,#0a1628,#060e24)',
              border: '1px solid rgba(0,200,255,0.25)',
              boxShadow: '0 -8px 48px rgba(0,0,0,0.6)',
            }}
          >
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 4 }}>Enter QR Code Manually</h3>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                Type the code exactly as printed on the bag sticker.
              </p>
            </div>

            <input
              value={manualInput}
              onChange={e => setManualInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submitManualCode()}
              placeholder="e.g. BAG-20482"
              autoFocus
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 14,
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(0,200,255,0.3)',
                color: '#fff', fontSize: 15, fontWeight: 600, outline: 'none',
                boxSizing: 'border-box', letterSpacing: '0.05em',
              }}
            />

            <div className="flex gap-3">
              <button
                onClick={() => setShowManualEntry(false)}
                style={{
                  flex: 1, padding: '11px 0', borderRadius: 12,
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                  color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={submitManualCode}
                disabled={!manualInput.trim()}
                style={{
                  flex: 2, padding: '11px 0', borderRadius: 12,
                  background: manualInput.trim() ? 'linear-gradient(135deg,#0057e7,#00c8ff)' : 'rgba(255,255,255,0.06)',
                  color: '#fff', fontSize: 14, fontWeight: 700,
                  cursor: manualInput.trim() ? 'pointer' : 'not-allowed', border: 'none',
                  opacity: manualInput.trim() ? 1 : 0.45,
                }}
              >
                Submit →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
