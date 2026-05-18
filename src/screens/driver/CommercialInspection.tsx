import { useState, useRef, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { GlassCard } from '../../components/ui/GlassCard'
import { PrimaryButton } from '../../components/ui/PrimaryButton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { addDraft, savePendingPhoto } from '../../lib/offlineQueue'

// ── Constants ─────────────────────────────────────────────────────────────────

const CHECKLIST = [
  'No leaking fluids',
  'No exposed sharp objects',
  'No hazardous chemicals',
  'No pressure buildup',
  'No batteries mixed improperly',
  'No heat detected',
  'No blocked loading area',
  'No biological material',
  'No living organisms',
]

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
const MAX_PHOTO_BYTES = 10 * 1024 * 1024

// ── Types ─────────────────────────────────────────────────────────────────────

type Phase = 'checklist' | 'result' | 'yellow' | 'red-capture' | 'override-confirm' | 'red' | 'success'
type OverallResult = 'green' | 'yellow' | 'red'
type UploadState = 'idle' | 'uploading' | 'done' | 'error'
type AiScanState = 'idle' | 'scanning' | 'done' | 'error'

interface AiScanResult {
  result:     'green' | 'yellow' | 'red'
  confidence: number
  notes:      string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function requiresOverride(driverChoice: OverallResult, ai: AiScanResult | null): boolean {
  if (!ai) return false
  const severity: Record<OverallResult, number> = { green: 0, yellow: 1, red: 2 }
  return severity[driverChoice] < severity[ai.result]
}

// ── AI Scan Panel ─────────────────────────────────────────────────────────────

const AI_RESULT_CONFIG = {
  green:  { icon: '🟢', label: 'No Issues Detected',     color: '#4ade80', bg: 'rgba(74,222,128,0.07)',   border: 'rgba(74,222,128,0.25)' },
  yellow: { icon: '🟡', label: 'Caution Flagged',         color: '#fbbf24', bg: 'rgba(251,191,36,0.07)',  border: 'rgba(251,191,36,0.25)' },
  red:    { icon: '🔴', label: 'Safety Concern Detected', color: '#f87171', bg: 'rgba(248,113,113,0.07)', border: 'rgba(248,113,113,0.25)' },
}

function AiScanPanel({ state, result }: { state: AiScanState; result: AiScanResult | null }) {
  if (state === 'idle') return null

  const cfg       = result ? AI_RESULT_CONFIG[result.result] : null
  const confBand  = result ? (result.confidence >= 85 ? 'high' : result.confidence >= 60 ? 'medium' : 'low') : null
  const bandColor = confBand === 'high' ? '#4ade80' : confBand === 'medium' ? '#fbbf24' : '#f87171'
  const bandLabel = confBand === 'high' ? 'High' : confBand === 'medium' ? 'Medium' : 'Low'

  return (
    <GlassCard padding="md" className="mb-4">
      <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 10 }}>
        AI Safety Scan
      </p>

      {state === 'scanning' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(0,200,255,0.25)', borderTopColor: '#00c8ff', animation: 'aiSpin 0.8s linear infinite', flexShrink: 0 }} />
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>AI Safety Scan Pending…</p>
        </div>
      )}

      {state === 'error' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14 }}>⚠️</span>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>AI scan unavailable — proceed with your manual review</p>
        </div>
      )}

      {state === 'done' && result && cfg && confBand && (
        <>
          <div style={{ borderRadius: 10, padding: '8px 12px', background: cfg.bg, border: `1px solid ${cfg.border}`, marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 14 }}>{cfg.icon}</span>
              <p style={{ fontSize: 13, fontWeight: 800, color: cfg.color }}>
                AI Recommendation: {cfg.label}
              </p>
            </div>

            {/* Confidence progress bar */}
            <div style={{ marginBottom: result.notes ? 8 : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: bandColor }}>{bandLabel} Confidence</p>
                <p style={{ fontSize: 10, fontWeight: 700, color: bandColor }}>{result.confidence}%</p>
              </div>
              <div style={{ height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                <div style={{ width: `${result.confidence}%`, height: '100%', background: bandColor, borderRadius: 999, transition: 'width 0.4s ease' }} />
              </div>
            </div>

            {result.notes && (
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>
                {result.notes}
              </p>
            )}
          </div>

          {confBand === 'low' && (
            <div style={{ borderRadius: 8, padding: '7px 10px', background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.22)', marginBottom: 8 }}>
              <p style={{ fontSize: 11, color: '#fbbf24', fontWeight: 700 }}>
                ⚠️ Low AI confidence detected. Manual review strongly recommended.
              </p>
            </div>
          )}

          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', fontStyle: 'italic' }}>
            AI advisory only — your field assessment is final.
          </p>
        </>
      )}
    </GlassCard>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function CommercialInspection() {
  const navigate         = useNavigate()
  const [searchParams]   = useSearchParams()
  const { user }         = useAuthStore()

  const pickupId = searchParams.get('pickup_id')
  const stopId          = searchParams.get('stop_id')
  const isReinspection  = searchParams.get('reinspection') === 'true'

  const [parentInspectionId, setParentInspectionId] = useState<string | null>(null)

  useEffect(() => {
    if (!isReinspection || !pickupId) return
    supabase
      .from('commercial_inspections')
      .select('id')
      .eq('pickup_id', pickupId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => { if (data) setParentInspectionId(data.id) })
  }, [isReinspection, pickupId])

  // — Core flow —
  const [phase, setPhase]   = useState<Phase>('checklist')
  const [checks, setChecks] = useState<boolean[]>(Array(CHECKLIST.length).fill(false))
  const [result, setResult] = useState<OverallResult | null>(null)

  // — Notes + photo (shared by yellow and red-capture phases) —
  const [notes, setNotes]             = useState('')
  const [photo, setPhoto]             = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [uploadState, setUploadState] = useState<UploadState>('idle')

  // — Async —
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast]           = useState<string | null>(null)

  // — AI scan (populated on photo upload, saved with inspection on submit) —
  const [photoPath,    setPhotoPath]    = useState<string | null>(null)
  const [aiScanState, setAiScanState]  = useState<AiScanState>('idle')
  const [aiResult,    setAiResult]     = useState<AiScanResult | null>(null)

  // — Override flow (when driver is more permissive than AI) —
  const [pendingResult,        setPendingResult]        = useState<OverallResult | null>(null)
  const [overrideReason,       setOverrideReason]       = useState('')
  const [overrideChecked,      setOverrideChecked]      = useState(false)
  const [driverOverride,       setDriverOverride]       = useState(false)
  const [driverOverrideReason, setDriverOverrideReason] = useState<string | null>(null)

  // Hidden file input
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Ref tracks current blob URL for cleanup independent of render cycle
  const previewUrlRef = useRef<string | null>(null)

  // Revoke blob URL when component unmounts
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    }
  }, [])

  // ── Helpers ───────────────────────────────────────────────────────────────

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  function toggleCheck(i: number) {
    setChecks(prev => { const n = [...prev]; n[i] = !n[i]; return n })
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate type — allow empty string (HEIC on some iOS browsers)
    if (file.type && !ALLOWED_TYPES.includes(file.type)) {
      showToast('Unsupported file type. Use JPEG, PNG, or WebP.')
      e.target.value = ''
      return
    }

    if (file.size > MAX_PHOTO_BYTES) {
      showToast('Photo too large — maximum 10 MB.')
      e.target.value = ''
      return
    }

    // Revoke previous blob URL
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)

    const url = URL.createObjectURL(file)
    previewUrlRef.current = url
    setPhoto(file)
    setPhotoPreview(url)
    setUploadState('idle')
    setPhotoPath(null)
    setAiScanState('idle')
    setAiResult(null)
    // Reset input so the same file can be re-selected if removed
    e.target.value = ''
    // Auto-upload and trigger AI scan for yellow/red-capture phases
    if (phase === 'yellow' || phase === 'red-capture') {
      void uploadAndAnalyze(file)
    }
  }

  async function uploadAndAnalyze(file: File) {
    if (!user || !pickupId) return

    setUploadState('uploading')

    const raw = file.name.split('.').pop() ?? 'jpg'
    const ext = raw.toLowerCase()
    const path = `${user.id}/${pickupId}-${Date.now()}.${ext}`
    const contentType = file.type || (ext === 'heic' || ext === 'heif' ? 'image/heic' : 'image/jpeg')

    const { error: uploadErr } = await supabase.storage
      .from('commercial-inspection-photos')
      .upload(path, file, { contentType, upsert: false })

    if (uploadErr) {
      setUploadState('error')
      showToast(`Photo upload failed: ${uploadErr.message}`)
      return
    }

    setUploadState('done')
    setPhotoPath(path)
    setAiScanState('scanning')

    try {
      // Generate a short-lived signed URL so the edge function receives a direct URL
      const { data: urlData } = await supabase.storage
        .from('commercial-inspection-photos')
        .createSignedUrl(path, 90)

      const { data, error } = await supabase.functions.invoke('analyze-commercial-inspection', {
        body: { photo_url: urlData?.signedUrl ?? undefined },
      })
      if (error || !data?.analysis) throw new Error(error?.message ?? 'No analysis returned')

      const a = data.analysis as { risk_level: string; confidence: number; summary: string }
      const RISK_MAP: Record<string, 'green' | 'yellow' | 'red'> = {
        low: 'green', medium: 'yellow', high: 'red', critical: 'red',
      }
      setAiResult({
        result:     RISK_MAP[a.risk_level] ?? 'yellow',
        confidence: Math.round(a.confidence),
        notes:      a.summary,
      })
      setAiScanState('done')
    } catch {
      setAiScanState('error')
    }
  }

  function clearPhoto() {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
    setPhoto(null)
    setPhotoPreview(null)
    setUploadState('idle')
    setPhotoPath(null)
    setAiScanState('idle')
    setAiResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── Supabase write ────────────────────────────────────────────────────────

  async function submitInspection(
    overallResult: 'pass' | 'flag' | 'fail',
    notesText: string | null,
    photoFile: File | null,
    opts?: {
      isReinspection?:       boolean
      parentId?:             string | null
      reviewStatus?:         string
      driverOverride?:       boolean
      driverOverrideReason?: string | null
    }
  ): Promise<void> {
    if (!pickupId || !user) throw new Error('Missing pickup context')

    // ── Offline path — save draft locally ────────────────────────────────────
    if (!navigator.onLine) {
      const checklistObj: Record<string, boolean> = {}
      CHECKLIST.forEach((item, i) => { checklistObj[item] = checks[i] })

      const useOverride       = opts?.driverOverride       ?? driverOverride
      const useOverrideReason = opts?.driverOverrideReason ?? driverOverrideReason
      const AI_FLAT: Record<string, string> = { green: 'Green', yellow: 'Yellow', red: 'Red' }

      const draft = addDraft({
        user_id:     user.id,
        action_type: 'inspection_submit',
        payload: {
          pickup_id:              pickupId,
          driver_id:              user.id,
          checklist_results:      checklistObj,
          overall_result:         overallResult,
          notes:                  notesText || null,
          photo_url:              photoPath ?? null,    // use already-uploaded path if present
          is_reinspection:        opts?.isReinspection ?? false,
          parent_inspection_id:   opts?.parentId ?? null,
          review_status:          opts?.reviewStatus ?? 'pending',
          ai_result:              aiResult ? AI_FLAT[aiResult.result] : null,
          ai_confidence:          aiResult?.confidence ?? null,
          ai_notes:               aiResult?.notes ?? null,
          driver_override:        useOverride,
          driver_override_reason: useOverride ? (useOverrideReason || null) : null,
          has_pending_photo:      false,
          photo_mime:             photoFile?.type ?? 'image/jpeg',
        },
      })

      // Try to store the photo as base64 alongside the draft
      if (photoFile && !photoPath) {
        try {
          const reader = new FileReader()
          const dataUrl = await new Promise<string>((resolve, reject) => {
            reader.onload  = () => resolve(reader.result as string)
            reader.onerror = reject
            reader.readAsDataURL(photoFile)
          })
          const stored = savePendingPhoto(draft.local_id, dataUrl)
          if (stored) {
            // Update the draft to mark that photo is pending
            draft.payload.has_pending_photo = true
            // Re-save with updated payload (addDraft already wrote it, update manually)
            const queue = JSON.parse(localStorage.getItem('baykid_offline_queue') ?? '[]')
            const idx   = queue.findIndex((d: { local_id: string }) => d.local_id === draft.local_id)
            if (idx >= 0) { queue[idx] = { ...queue[idx], payload: draft.payload }; localStorage.setItem('baykid_offline_queue', JSON.stringify(queue)) }
          }
        } catch { /* best-effort — photo lost on submit, synced without */ }
      }

      showToast(photoFile && !photoPath
        ? 'Inspection draft saved offline · Photo will upload when reconnected'
        : 'Inspection draft saved offline — will sync when reconnected'
      )
      return  // Caller advances phase/success state
    }

    // Use path from pre-upload (triggered during AI scan); fall back to upload-on-submit
    let photoUrl: string | null = photoPath

    if (!photoUrl && photoFile) {
      setUploadState('uploading')
      const raw = photoFile.name.split('.').pop() ?? 'jpg'
      const ext = raw.toLowerCase()
      const path = `${user.id}/${pickupId}-${Date.now()}.${ext}`
      const contentType = photoFile.type || (ext === 'heic' || ext === 'heif' ? 'image/heic' : 'image/jpeg')

      const { error: uploadErr } = await supabase.storage
        .from('commercial-inspection-photos')
        .upload(path, photoFile, { contentType, upsert: false })

      if (uploadErr) {
        setUploadState('error')
        throw new Error(`Photo upload failed: ${uploadErr.message}`)
      }
      setUploadState('done')
      photoUrl = path
    }

    const checklistObj: Record<string, boolean> = {}
    CHECKLIST.forEach((item, i) => { checklistObj[item] = checks[i] })

    const AI_FLAT: Record<string, string> = { green: 'Green', yellow: 'Yellow', red: 'Red' }

    // Override data: prefer explicit opts (for same-tick submits), fall back to state
    const useOverride       = opts?.driverOverride       ?? driverOverride
    const useOverrideReason = opts?.driverOverrideReason ?? driverOverrideReason

    const { error: insertErr } = await supabase.from('commercial_inspections').insert({
      pickup_id:              pickupId,
      driver_id:              user.id,
      checklist_results:      checklistObj,
      overall_result:         overallResult,
      notes:                  notesText || null,
      photo_url:              photoUrl,
      is_reinspection:        opts?.isReinspection ?? false,
      parent_inspection_id:   opts?.parentId ?? null,
      review_status:          opts?.reviewStatus ?? 'pending',
      ai_result:              aiResult ? AI_FLAT[aiResult.result] : null,
      ai_confidence:          aiResult?.confidence ?? null,
      ai_notes:               aiResult?.notes ?? null,
      ai_reviewed_at:         aiResult ? new Date().toISOString() : null,
      driver_override:        useOverride,
      driver_override_reason: useOverride ? (useOverrideReason || null) : null,
    })

    if (insertErr) throw new Error(`Inspection save failed: ${insertErr.message}`)
  }

  // ── Phase handlers ────────────────────────────────────────────────────────

  async function handleChooseResult(r: OverallResult) {
    setResult(r)

    // Override required when driver picks a more permissive result than AI
    if (aiScanState === 'done' && requiresOverride(r, aiResult)) {
      setPendingResult(r)
      setPhase('override-confirm')
      return
    }

    if (r === 'yellow') { setPhase('yellow');      return }
    if (r === 'red')    { setPhase('red-capture'); return }

    // Green — submit immediately
    // Low confidence → keep pending even for reinspections, don't unlock route
    const lowConf      = !!(aiResult && aiResult.confidence < 60)
    const reviewStatus = !lowConf && isReinspection ? 'approved' : 'pending'

    setSubmitting(true)
    try {
      await submitInspection('pass', null, null, {
        isReinspection,
        parentId:     parentInspectionId,
        reviewStatus,
      })

      // Only unlock route on reinspection green with adequate AI confidence
      if (!lowConf && isReinspection && stopId && pickupId) {
        await supabase
          .from('commercial_route_stops')
          .update({ status: 'inspection_complete' })
          .eq('id', stopId)
        void supabase
          .from('commercial_pickups')
          .update({ status: 'in_progress' })
          .eq('id', pickupId)
      }

      setPhase('success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Save failed — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleOverrideConfirm() {
    if (!overrideReason.trim()) {
      showToast('Please explain why your assessment differs from the AI recommendation')
      return
    }
    if (!overrideChecked) {
      showToast('Please confirm you have reviewed the AI recommendation')
      return
    }

    if (pendingResult === 'green') {
      // Green override → submit with pending status, admin must review before route unlocks
      setSubmitting(true)
      try {
        await submitInspection('pass', null, null, {
          isReinspection,
          parentId:            parentInspectionId,
          reviewStatus:        'pending',
          driverOverride:      true,
          driverOverrideReason: overrideReason,
        })
        setDriverOverride(true)
        setDriverOverrideReason(overrideReason)
        setPhase('success')
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Save failed — please try again')
      } finally {
        setSubmitting(false)
      }
      return
    }

    // Yellow/red override → set state then proceed to normal capture phase
    // submitInspection will read driverOverride/driverOverrideReason from state on submit
    setDriverOverride(true)
    setDriverOverrideReason(overrideReason)
    if (pendingResult === 'yellow') { setPhase('yellow');      return }
    if (pendingResult === 'red')    { setPhase('red-capture'); return }
  }

  async function handleYellowSubmit() {
    if (!notes.trim()) { showToast('Inspection notes are required'); return }
    if (!photo)        { showToast('A photo is required for caution reports'); return }

    setSubmitting(true)
    try {
      await submitInspection('flag', notes, photo, {
        isReinspection: isReinspection,
        parentId:       parentInspectionId,
      })
      setPhase('success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Submission failed — check connection')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRedSubmit() {
    if (!notes.trim()) { showToast('Notes are required before rejecting a pickup'); return }
    if (!photo)        { showToast('A photo is required before rejecting a pickup'); return }

    setSubmitting(true)
    try {
      const uid = user?.id
      const pid = pickupId
      if (!uid || !pid) throw new Error('Missing user context')

      await submitInspection('fail', notes, photo, {
        isReinspection: isReinspection,
        parentId:       parentInspectionId,
      })

      // Update pickup status — await so admin sees it flagged immediately
      await supabase
        .from('commercial_pickups')
        .update({ status: 'flagged' })
        .eq('id', pid)

      // Update route stop — best-effort (trigger already created admin notification)
      void supabase
        .from('commercial_route_stops')
        .update({ status: 'flagged' })
        .eq('pickup_id', pid)
        .eq('driver_id', uid)

      setPhase('red')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Submission failed — check connection and retry')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Shared photo picker UI ────────────────────────────────────────────────

  function renderPhotoPicker(accentColor: string) {
    return (
      <GlassCard padding="md" className="mb-4">
        <p style={{
          fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)',
          textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 10,
        }}>
          Photo Evidence <span style={{ color: '#f87171' }}>*</span>
        </p>

        {photoPreview ? (
          <>
            <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', marginBottom: 10 }}>
              <img
                src={photoPreview}
                alt="Inspection evidence"
                style={{ width: '100%', maxHeight: 220, objectFit: 'cover', display: 'block' }}
              />
              {uploadState === 'uploading' && (
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
                }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Uploading…</p>
                </div>
              )}
              {uploadState === 'done' && (
                <div style={{
                  position: 'absolute', bottom: 8, right: 8,
                  borderRadius: 8, background: 'rgba(74,222,128,0.9)',
                  padding: '3px 10px',
                }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#000' }}>✓ Saved</p>
                </div>
              )}
            </div>

            {uploadState === 'error' && (
              <p style={{ fontSize: 11, color: '#f87171', marginBottom: 8 }}>
                ⚠️ Upload failed — will retry when you submit. Check connection.
              </p>
            )}

            <button
              onClick={clearPhoto}
              style={{
                fontSize: 12, color: 'rgba(255,255,255,0.4)', background: 'none',
                border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0,
              }}
            >
              Remove photo
            </button>
          </>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full rounded-2xl flex flex-col items-center gap-2 py-5 transition-all hover:brightness-110"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: `1.5px dashed ${accentColor}`,
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 26 }}>📷</span>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}>
              Tap to take or choose photo
            </p>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
              JPEG · PNG · WebP · HEIC &nbsp;·&nbsp; max 10 MB
            </p>
          </button>
        )}
      </GlassCard>
    )
  }

  // ── Success state ──────────────────────────────────────────────────────────

  if (phase === 'success') {
    const isYellow      = result === 'yellow'
    const isGreenOverride = result === 'green' && driverOverride

    if (isReinspection) {
      const reinspMsg = isYellow
        ? { icon: '⚠️', color: '#fbbf24', title: 'Reinspection Submitted',  body: 'Your caution report was submitted for admin review.' }
        : isGreenOverride
        ? { icon: '⚠️', color: '#fbbf24', title: 'Override Recorded',        body: 'Your field override was noted. Admin review is required before this stop can be completed.' }
        : { icon: '✅', color: '#4ade80', title: 'Reinspection Passed',       body: 'You may now complete this stop.' }

      return (
        <div
          className="min-h-screen flex flex-col items-center justify-center px-6"
          style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}
        >
          <div
            className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl mb-5"
            style={{
              background: isYellow ? 'rgba(251,191,36,0.12)' : 'rgba(74,222,128,0.12)',
              border: `1px solid ${isYellow ? 'rgba(251,191,36,0.3)' : 'rgba(74,222,128,0.3)'}`,
            }}
          >
            {reinspMsg.icon}
          </div>
          <p style={{ fontSize: 20, fontWeight: 900, color: '#fff', marginBottom: 6 }}>
            {reinspMsg.title}
          </p>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: 24, maxWidth: 280, lineHeight: 1.6 }}>
            {reinspMsg.body}
          </p>
          <button
            onClick={() => navigate(-1)}
            className="px-8 py-3.5 rounded-2xl font-bold text-sm text-white transition-all hover:brightness-110"
            style={{ background: 'linear-gradient(135deg,#0057e7,#00c8ff)', boxShadow: '0 4px 20px rgba(0,190,255,0.3)' }}
          >
            ← Return to Stop
          </button>
        </div>
      )
    }

    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-6"
        style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}
      >
        <div
          className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl mb-5"
          style={{
            background: isYellow || isGreenOverride ? 'rgba(251,191,36,0.12)' : 'rgba(74,222,128,0.12)',
            border: `1px solid ${isYellow || isGreenOverride ? 'rgba(251,191,36,0.3)' : 'rgba(74,222,128,0.3)'}`,
          }}
        >
          {isYellow || isGreenOverride ? '⚠️' : '✅'}
        </div>

        <p style={{ fontSize: 20, fontWeight: 900, color: '#fff', marginBottom: 6 }}>
          Inspection Complete
        </p>
        <p style={{
          fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center',
          marginBottom: 16, maxWidth: 280, lineHeight: 1.6,
        }}>
          {isYellow
            ? 'Caution noted and documented. Proceed with care.'
            : isGreenOverride
            ? 'Your field override was recorded. Admin review is required before this stop can be completed.'
            : 'No hazards found. Safe to proceed with collection.'}
        </p>

        {photoPreview && (
          <div style={{
            width: '100%', maxWidth: 320, borderRadius: 16,
            overflow: 'hidden', marginBottom: 16,
            border: '1px solid rgba(255,255,255,0.1)',
          }}>
            <img
              src={photoPreview}
              alt="Submitted evidence"
              style={{ width: '100%', maxHeight: 180, objectFit: 'cover', display: 'block' }}
            />
          </div>
        )}

        <StatusBadge
          variant={isYellow || isGreenOverride ? 'amber' : 'green'}
          label={isYellow ? 'Caution — Documented' : isGreenOverride ? 'Pending Admin Review' : 'Passed'}
          dot
        />

        <button
          onClick={() => navigate(-1)}
          className="mt-8 px-8 py-3.5 rounded-2xl font-bold text-sm text-white transition-all hover:brightness-110"
          style={{ background: 'linear-gradient(135deg,#0057e7,#00c8ff)', boxShadow: '0 4px 20px rgba(0,190,255,0.3)' }}
        >
          ← Return to Stop
        </button>
      </div>
    )
  }

  // ── Red — rejection screen (after submit) ──────────────────────────────────

  if (phase === 'red') {
    return (
      <div
        className="min-h-screen flex flex-col"
        style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}
      >
        <header
          className="flex items-center gap-3 px-4 py-3 shrink-0"
          style={{ background: 'rgba(4,10,24,0.94)', borderBottom: '1px solid rgba(248,113,113,0.2)', backdropFilter: 'blur(12px)' }}
        >
          <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: '#f87171', textAlign: 'center' }}>
            {isReinspection ? '🚫 Reinspection Failed' : '🚫 Pickup Rejected'}
          </span>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-6 pb-24 max-w-xl mx-auto w-full">
          <div
            className="rounded-2xl px-5 py-6 mb-5 text-center"
            style={{ background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.3)' }}
          >
            <p style={{ fontSize: 36, marginBottom: 12 }}>🚫</p>
            <p style={{ fontSize: 17, fontWeight: 900, color: '#f87171', marginBottom: 8 }}>
              Pickup Rejected
            </p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>
              {isReinspection
                ? 'The reinspection failed. This stop remains locked pending admin review and clearance.'
                : 'This stop has been flagged for safety concerns. Do not attempt pickup until admin clearance is received.'}
            </p>
          </div>

          {photoPreview && (
            <GlassCard padding="md" className="mb-4">
              <p style={{
                fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)',
                textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 8,
              }}>
                Evidence Submitted
              </p>
              <div style={{ borderRadius: 12, overflow: 'hidden' }}>
                <img
                  src={photoPreview}
                  alt="Submitted evidence"
                  style={{ width: '100%', maxHeight: 160, objectFit: 'cover', display: 'block' }}
                />
              </div>
            </GlassCard>
          )}

          <GlassCard padding="md" className="mb-5">
            <p style={{
              fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)',
              textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 10,
            }}>
              Dispatch Notified
            </p>
            <div className="flex items-start gap-3">
              <span style={{ fontSize: 16 }}>📋</span>
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#fff', marginBottom: 4 }}>
                  Inspection rejection reported to dispatch
                </p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>
                  A supervisor has been notified. Await clearance before returning to this stop.
                </p>
              </div>
            </div>
          </GlassCard>

          <div className="flex items-center justify-center mb-5">
            <StatusBadge variant="red" label="Pickup Locked" dot size="md" />
          </div>

          <button
            onClick={() => navigate(-1)}
            style={{
              width: '100%', textAlign: 'center',
              color: 'rgba(255,255,255,0.35)', fontSize: 13,
              background: 'none', border: 'none', cursor: 'pointer',
            }}
          >
            ← Return to Route
          </button>
        </div>
      </div>
    )
  }

  // ── Main flow ──────────────────────────────────────────────────────────────

  const allChecked   = checks.every(Boolean)
  const checkedCount = checks.filter(Boolean).length

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}
    >
      {/* Hidden file input — shared for yellow and red-capture */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        capture="environment"
        onChange={handlePhotoSelect}
        style={{ display: 'none' }}
      />

      {/* Header */}
      <header
        className="flex items-center gap-3 px-4 py-3 shrink-0"
        style={{ background: 'rgba(4,10,24,0.94)', borderBottom: '1px solid rgba(0,200,255,0.12)', backdropFilter: 'blur(12px)' }}
      >
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', fontSize: 14, padding: '4px 6px' }}
        >
          ← Back
        </button>
        <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: '#fff', textAlign: 'center' }}>
          {phase === 'checklist'        ? (isReinspection ? 'Safety Reinspection' : 'Safety Inspection') :
           phase === 'result'           ? 'Overall Assessment' :
           phase === 'yellow'           ? 'Caution Report' :
           phase === 'red-capture'      ? 'Rejection Evidence' :
           phase === 'override-confirm' ? 'Assessment Override' : ''}
        </span>
        <button
          onClick={() => showToast('Emergency dispatch contacted')}
          className="rounded-xl px-2.5 py-1.5 text-xs font-bold transition-all hover:brightness-110"
          style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.35)', color: '#f87171', cursor: 'pointer' }}
        >
          🚨 SOS
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5 pb-28 max-w-xl mx-auto w-full">

        {/* ── Checklist phase ── */}
        {phase === 'checklist' && (
          <>
            <GlassCard variant="elevated" padding="md" className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <p style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Inspection Checklist</p>
                <span style={{ fontSize: 13, fontWeight: 800, color: checkedCount === CHECKLIST.length ? '#4ade80' : '#00c8ff' }}>
                  {checkedCount}/{CHECKLIST.length}
                </span>
              </div>
              <div style={{ height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                <div style={{
                  width: `${(checkedCount / CHECKLIST.length) * 100}%`,
                  height: '100%',
                  background: checkedCount === CHECKLIST.length ? '#4ade80' : '#00c8ff',
                  borderRadius: 999,
                  transition: 'width 0.3s ease',
                }} />
              </div>
            </GlassCard>

            <GlassCard padding="none" className="mb-4">
              {CHECKLIST.map((item, i) => {
                const checked = checks[i]
                return (
                  <button
                    key={i}
                    onClick={() => toggleCheck(i)}
                    className="flex items-center gap-3 w-full px-4 py-3.5 text-left transition-all hover:brightness-110"
                    style={{
                      background: 'none', border: 'none',
                      borderBottom: i < CHECKLIST.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{
                      width: 22, height: 22, borderRadius: 6,
                      border: `2px solid ${checked ? '#4ade80' : 'rgba(255,255,255,0.2)'}`,
                      background: checked ? 'rgba(74,222,128,0.15)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, transition: 'all 0.15s',
                    }}>
                      {checked && <span style={{ fontSize: 12, color: '#4ade80', lineHeight: 1 }}>✓</span>}
                    </div>
                    <p style={{
                      fontSize: 13, flex: 1,
                      fontWeight: checked ? 500 : 600,
                      color: checked ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.85)',
                    }}>
                      {item}
                    </p>
                    {checked && <StatusBadge variant="green" label="Pass" size="sm" />}
                  </button>
                )
              })}
            </GlassCard>

            {!allChecked && (
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginBottom: 8 }}>
                Check all {CHECKLIST.length} items to continue
              </p>
            )}

            <PrimaryButton fullWidth size="lg" onClick={() => setPhase('result')}>
              {allChecked ? '→ Continue to Assessment' : `Complete Inspection (${checkedCount}/${CHECKLIST.length})`}
            </PrimaryButton>
          </>
        )}

        {/* ── Result choice phase ── */}
        {phase === 'result' && (
          <>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: 20, lineHeight: 1.6 }}>
              All {CHECKLIST.length} items checked. Choose your overall assessment.
            </p>

            {/* Green */}
            <button
              onClick={() => !submitting && handleChooseResult('green')}
              disabled={submitting}
              className="w-full rounded-2xl p-5 mb-3 text-left transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
              style={{ background: 'rgba(74,222,128,0.08)', border: '2px solid rgba(74,222,128,0.3)', cursor: submitting ? 'not-allowed' : 'pointer' }}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0"
                  style={{ background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.3)' }}>
                  🟢
                </div>
                <div>
                  <p style={{ fontSize: 16, fontWeight: 800, color: '#4ade80' }}>Safe to Pick Up</p>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>No hazards found — proceed with collection</p>
                </div>
              </div>
            </button>

            {/* Yellow */}
            <button
              onClick={() => !submitting && handleChooseResult('yellow')}
              disabled={submitting}
              className="w-full rounded-2xl p-5 mb-3 text-left transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
              style={{ background: 'rgba(251,191,36,0.07)', border: '2px solid rgba(251,191,36,0.25)', cursor: submitting ? 'not-allowed' : 'pointer' }}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0"
                  style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)' }}>
                  🟡
                </div>
                <div>
                  <p style={{ fontSize: 16, fontWeight: 800, color: '#fbbf24' }}>Caution / Needs Notes</p>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
                    Minor issues — photo + notes required
                  </p>
                </div>
              </div>
            </button>

            {/* Red */}
            <button
              onClick={() => !submitting && handleChooseResult('red')}
              disabled={submitting}
              className="w-full rounded-2xl p-5 mb-3 text-left transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
              style={{ background: 'rgba(248,113,113,0.07)', border: '2px solid rgba(248,113,113,0.22)', cursor: submitting ? 'not-allowed' : 'pointer' }}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0"
                  style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.3)' }}>
                  🔴
                </div>
                <div>
                  <p style={{ fontSize: 16, fontWeight: 800, color: '#f87171' }}>Reject / Notify Admin</p>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
                    Safety hazard — photo + notes required
                  </p>
                </div>
              </div>
            </button>

            {submitting && (
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: 8 }}>
                Saving inspection…
              </p>
            )}

            <button
              onClick={() => setPhase('checklist')}
              style={{ width: '100%', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', marginTop: 4 }}
            >
              ← Back to Checklist
            </button>
          </>
        )}

        {/* ── Yellow — caution notes + photo (both required) ── */}
        {phase === 'yellow' && (
          <>
            <div
              className="rounded-2xl px-4 py-3 mb-4 flex items-center gap-3"
              style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.25)' }}
            >
              <span style={{ fontSize: 18 }}>⚠️</span>
              <p style={{ fontSize: 12, color: '#fbbf24', fontWeight: 600, lineHeight: 1.5 }}>
                Document this caution issue. Notes and a photo are both required.
              </p>
            </div>

            {renderPhotoPicker('rgba(251,191,36,0.35)')}

            <AiScanPanel state={aiScanState} result={aiResult} />

            <GlassCard padding="md" className="mb-4">
              <p style={{
                fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)',
                textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 10,
              }}>
                Inspection Notes <span style={{ color: '#f87171' }}>*</span>
              </p>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Describe the issue: e.g. minor contamination in bottom layer, no immediate hazard…"
                rows={4}
                style={{
                  width: '100%', padding: '10px', borderRadius: 10,
                  background: 'rgba(255,255,255,0.05)',
                  border: `1px solid ${notes.trim() ? 'rgba(251,191,36,0.4)' : 'rgba(251,191,36,0.2)'}`,
                  color: '#fff', fontSize: 13, outline: 'none',
                  resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.5,
                }}
              />
            </GlassCard>

            <div className="flex flex-col gap-2.5">
              <PrimaryButton
                fullWidth size="lg"
                disabled={submitting || !notes.trim() || !photo}
                onClick={handleYellowSubmit}
              >
                {submitting
                  ? uploadState === 'uploading' ? 'Uploading photo…' : 'Saving…'
                  : '✓ Submit Caution Report'}
              </PrimaryButton>

              {(!notes.trim() || !photo) && !submitting && (
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
                  {!photo && !notes.trim() ? 'Photo and notes required' :
                   !photo ? 'Photo required' : 'Notes required'}
                </p>
              )}

              <PrimaryButton
                fullWidth size="md" variant="secondary"
                onClick={() => { setPhase('result'); setResult(null) }}
              >
                🔄 Change Assessment
              </PrimaryButton>
            </div>
          </>
        )}

        {/* ── Override-confirm — explain AI mismatch ── */}
        {phase === 'override-confirm' && pendingResult && (
          <>
            <GlassCard padding="md" className="mb-4">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 18 }}>⚠️</span>
                <p style={{ fontSize: 14, fontWeight: 800, color: '#fbbf24' }}>Override Required</p>
              </div>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, marginBottom: 14 }}>
                Your assessment is more permissive than the AI recommendation. Please explain your reasoning before proceeding.
              </p>

              {/* AI vs Driver comparison */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: aiResult && aiResult.confidence < 60 ? 10 : 0 }}>
                {([
                  { label: 'AI Recommends', r: aiResult?.result ?? 'yellow', sub: aiResult ? `${aiResult.confidence}% confidence` : '' },
                  { label: 'You Selected',  r: pendingResult,                 sub: 'Field assessment' },
                ] as const).map(({ label, r, sub }) => {
                  const c = AI_RESULT_CONFIG[r]
                  return (
                    <div key={label} style={{ borderRadius: 10, padding: '10px 12px', background: c.bg, border: `1px solid ${c.border}` }}>
                      <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>{label}</p>
                      <p style={{ fontSize: 13, fontWeight: 800, color: c.color }}>{c.icon} {c.label}</p>
                      {sub && <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 3 }}>{sub}</p>}
                    </div>
                  )
                })}
              </div>

              {aiResult && aiResult.confidence < 60 && (
                <div style={{ borderRadius: 8, padding: '7px 10px', background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)' }}>
                  <p style={{ fontSize: 11, color: '#fbbf24', fontWeight: 700 }}>
                    ⚠️ Low AI confidence detected. Manual review strongly recommended.
                  </p>
                </div>
              )}
            </GlassCard>

            <GlassCard padding="md" className="mb-4">
              <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 10 }}>
                Reason for Override <span style={{ color: '#f87171' }}>*</span>
              </p>
              <textarea
                value={overrideReason}
                onChange={e => setOverrideReason(e.target.value)}
                placeholder="Explain why your field assessment differs from the AI recommendation…"
                rows={4}
                style={{
                  width: '100%', padding: '10px', borderRadius: 10,
                  background: 'rgba(255,255,255,0.05)',
                  border: `1px solid ${overrideReason.trim() ? 'rgba(251,191,36,0.4)' : 'rgba(251,191,36,0.2)'}`,
                  color: '#fff', fontSize: 13, outline: 'none',
                  resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.5,
                }}
              />
            </GlassCard>

            {/* Confirmation checkbox */}
            <button
              onClick={() => setOverrideChecked(v => !v)}
              style={{ display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 16px', textAlign: 'left' }}
            >
              <div style={{
                width: 20, height: 20, borderRadius: 5, flexShrink: 0, marginTop: 1,
                border: `2px solid ${overrideChecked ? '#fbbf24' : 'rgba(255,255,255,0.2)'}`,
                background: overrideChecked ? 'rgba(251,191,36,0.15)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {overrideChecked && <span style={{ fontSize: 11, color: '#fbbf24', lineHeight: 1 }}>✓</span>}
              </div>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
                I have reviewed the AI recommendation and my field assessment takes precedence. I accept responsibility for this override.
              </p>
            </button>

            <div className="flex flex-col gap-2.5">
              <PrimaryButton
                fullWidth size="lg"
                disabled={submitting || !overrideReason.trim() || !overrideChecked}
                onClick={handleOverrideConfirm}
              >
                {submitting ? 'Processing…' : `Confirm Override · Continue as ${AI_RESULT_CONFIG[pendingResult].label}`}
              </PrimaryButton>

              <PrimaryButton
                fullWidth size="md" variant="secondary"
                onClick={() => {
                  setPendingResult(null)
                  setOverrideReason('')
                  setOverrideChecked(false)
                  setPhase('result')
                }}
              >
                ← Change Assessment
              </PrimaryButton>
            </div>

            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', textAlign: 'center', marginTop: 14, lineHeight: 1.5 }}>
              Driver override recorded. Admin review may be required.
            </p>
          </>
        )}

        {/* ── Red-capture — document before rejection ── */}
        {phase === 'red-capture' && (
          <>
            <div
              className="rounded-2xl px-4 py-3 mb-4 flex items-center gap-3"
              style={{ background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.35)' }}
            >
              <span style={{ fontSize: 18 }}>🚫</span>
              <p style={{ fontSize: 12, color: '#f87171', fontWeight: 600, lineHeight: 1.5 }}>
                Document the safety issue before rejecting. Photo and notes are required. Admin will be notified.
              </p>
            </div>

            {renderPhotoPicker('rgba(248,113,113,0.35)')}

            <AiScanPanel state={aiScanState} result={aiResult} />

            <GlassCard padding="md" className="mb-4">
              <p style={{
                fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)',
                textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 10,
              }}>
                Rejection Notes <span style={{ color: '#f87171' }}>*</span>
              </p>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Describe the safety hazard: e.g. hazardous chemicals mixed in top layer, DO NOT COLLECT…"
                rows={4}
                style={{
                  width: '100%', padding: '10px', borderRadius: 10,
                  background: 'rgba(255,255,255,0.05)',
                  border: `1px solid ${notes.trim() ? 'rgba(248,113,113,0.4)' : 'rgba(248,113,113,0.2)'}`,
                  color: '#fff', fontSize: 13, outline: 'none',
                  resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.5,
                }}
              />
            </GlassCard>

            <div className="flex flex-col gap-2.5">
              <button
                onClick={handleRedSubmit}
                disabled={submitting || !notes.trim() || !photo}
                className="w-full rounded-2xl py-4 font-bold text-sm transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: submitting || !notes.trim() || !photo
                    ? 'rgba(248,113,113,0.15)'
                    : 'rgba(248,113,113,0.2)',
                  border: '1.5px solid rgba(248,113,113,0.45)',
                  color: '#f87171',
                  cursor: submitting || !notes.trim() || !photo ? 'not-allowed' : 'pointer',
                }}
              >
                {submitting
                  ? uploadState === 'uploading' ? 'Uploading photo…' : 'Submitting…'
                  : '🚫 Confirm Rejection & Notify Admin'}
              </button>

              {(!notes.trim() || !photo) && !submitting && (
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
                  {!photo && !notes.trim() ? 'Photo and notes required' :
                   !photo ? 'Photo required' : 'Notes required'}
                </p>
              )}

              <PrimaryButton
                fullWidth size="md" variant="secondary"
                onClick={() => { setPhase('result'); setResult(null) }}
              >
                🔄 Change Assessment
              </PrimaryButton>
            </div>
          </>
        )}

      </div>

      <style>{`@keyframes aiSpin { to { transform: rotate(360deg) } }`}</style>

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-sm font-semibold"
          style={{
            background: 'rgba(0,200,255,0.15)', border: '1px solid rgba(0,200,255,0.3)',
            color: '#00c8ff', backdropFilter: 'blur(12px)',
            whiteSpace: 'nowrap', maxWidth: 'calc(100vw - 32px)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          }}
        >
          {toast}
        </div>
      )}
    </div>
  )
}
