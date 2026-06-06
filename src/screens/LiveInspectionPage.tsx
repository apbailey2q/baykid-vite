import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuthStore } from '../store/authStore'

// ── Types ────────────────────────────────────────────────────────────────────

type RagStatus = 'green' | 'yellow' | 'red'
type AiOutcome = 'CLEAN' | 'NEEDS_REVIEW' | 'CONTAMINATED'
type AiPhase   = 'idle' | 'analyzing' | 'done' | 'error'

interface AiResult {
  result:                 AiOutcome
  confidence:             number
  detected_objects:       string[]
  contamination_detected: string[]
  notes:                  string
}

type Bag = {
  id:       string
  bag_code: string
  status:   string
  owner_id: string | null
}

type BagScan = {
  id:        string
  scan_time: string
  location:  string | null
}

const AI_TO_RAG: Record<AiOutcome, RagStatus> = {
  CLEAN:       'green',
  NEEDS_REVIEW:'yellow',
  CONTAMINATED:'red',
}

// ── RAG config ───────────────────────────────────────────────────────────────

const RAG: Record<RagStatus, {
  label:        string
  icon:         string
  color:        string
  bg:           string
  border:       string
  newBagStatus: string
}> = {
  green:  { label: 'Clean Bag',    icon: '✅', color: '#4ade80', bg: 'rgba(74,222,128,0.12)',  border: 'rgba(74,222,128,0.35)',  newBagStatus: 'inspected'    },
  yellow: { label: 'Needs Review', icon: '⚠️', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.35)',  newBagStatus: 'needs_review' },
  red:    { label: 'Contaminated', icon: '🚫', color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.35)', newBagStatus: 'contaminated' },
}

const ESTIMATED_VALUE  = 2.85
const USER_SHARE       = 2.00
const FUNDRAISER_SHARE = 0.85
const CO2_SAVED_LBS    = 4.2
const POINTS_EARNED    = 285

// ── Helpers ──────────────────────────────────────────────────────────────────

function confidenceColor(c: number): string {
  if (c >= 80) return '#4ade80'
  if (c >= 55) return '#fbbf24'
  return '#f87171'
}

async function compressImage(dataUrl: string, maxPx = 1024): Promise<string> {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width  = img.width  * scale
      canvas.height = img.height * scale
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.82))
    }
    img.src = dataUrl
  })
}

// ── Component ────────────────────────────────────────────────────────────────

export default function LiveInspectionPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [animate, setAnimate]               = useState(false)
  const [bag, setBag]                       = useState<Bag | null>(null)
  const [scan, setScan]                     = useState<BagScan | null>(null)
  const [loading, setLoading]               = useState(true)
  const [loadError, setLoadError]           = useState<string | null>(null)
  const [submitting, setSubmitting]         = useState<RagStatus | null>(null)
  const [submitError, setSubmitError]       = useState<string | null>(null)
  const [result, setResult]                 = useState<RagStatus | null>(null)
  const [fundraiserId, setFundraiserId]     = useState<string | null>(null)
  const [fundraiserName, setFundraiserName] = useState<string | null>(null)
  const [warnings, setWarnings]             = useState<string[]>([])

  // AI state
  const [aiPhase, setAiPhase]             = useState<AiPhase>('idle')
  const [aiResult, setAiResult]           = useState<AiResult | null>(null)
  const [aiError, setAiError]             = useState<string | null>(null)
  const [photoUrl, setPhotoUrl]           = useState<string | null>(null)
  const [suggestedRag, setSuggestedRag]   = useState<RagStatus | null>(null)
  const [statusUpdateMsg, setStatusUpdateMsg] = useState<string | null>(null)
  const fileInputRef                       = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimate(true))
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    let mounted = true
    async function load() {
      const scanId = localStorage.getItem('live_scan_id')
      const bagId  = localStorage.getItem('live_bag_id')
      const fId    = localStorage.getItem('live_fundraiser_id')
      const fName  = localStorage.getItem('live_fundraiser_name')
      if (fId)   setFundraiserId(fId)
      if (fName) setFundraiserName(fName)

      if (!scanId || !bagId) {
        setLoadError('No active scan found. Please scan a bag first.')
        setLoading(false)
        return
      }
      if (!user) { navigate('/real-login', { replace: true }); return }

      const [bagRes, scanRes] = await Promise.all([
        supabase.from('qr_bags').select('id, bag_code, status, owner_id').eq('id', bagId).maybeSingle(),
        supabase.from('bag_scans').select('id, scan_time, location').eq('id', scanId).maybeSingle(),
      ])

      if (!mounted) return
      if (bagRes.data)  setBag(bagRes.data  as Bag)
      if (scanRes.data) setScan(scanRes.data as BagScan)
      if (bagRes.error) setLoadError(`Could not load bag: ${bagRes.error.message}`)
      setLoading(false)
    }
    load()
    return () => { mounted = false }
  }, [navigate, user])

  const fade = (d = 0): React.CSSProperties => ({
    opacity:    animate ? 1 : 0,
    transform:  animate ? 'translateY(0)' : 'translateY(14px)',
    transition: `opacity 0.4s ease ${d}ms, transform 0.4s ease ${d}ms`,
  })

  // ── AI photo analysis ─────────────────────────────────────────────────────

  function handleCameraClick() {
    fileInputRef.current?.click()
  }

  async function handlePhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''   // allow re-selecting the same file

    const reader = new FileReader()
    reader.onloadend = async () => {
      const raw = reader.result as string
      const compressed = await compressImage(raw)
      setPhotoUrl(compressed)
      await runAiAnalysis(compressed)
    }
    reader.readAsDataURL(file)
  }

  async function runAiAnalysis(dataUrl: string) {
    setAiPhase('analyzing')
    setAiError(null)
    setAiResult(null)
    setSuggestedRag(null)

    try {
      const res = await fetch('/api/google-inspect', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ imageBase64: dataUrl }),
      })

      const json = await res.json()

      if (!res.ok) {
        throw new Error(json.error ?? `Server error ${res.status}`)
      }

      const parsed = json as AiResult
      setAiResult(parsed)
      setSuggestedRag(AI_TO_RAG[parsed.result] ?? 'yellow')
      setAiPhase('done')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setAiError(msg)
      setAiPhase('error')
    }
  }

  // ── Save inspection ───────────────────────────────────────────────────────

  async function handleInspect(rag: RagStatus) {
    if (!bag || !user) return
    setSubmitError(null)
    setSubmitting(rag)

    // 1. Insert inspection
    const { data: inspection, error: inspErr } = await supabase
      .from('inspections')
      .insert({
        bag_id:       bag.id,
        inspector_id: user.id,
        status:       rag,
        notes:        aiResult
          ? `AI: ${aiResult.result} (${aiResult.confidence}% confidence). ${aiResult.notes}`
          : 'Manual inspection via Cyan&#39;s Brooklynn app',
      })
      .select('id')
      .single()

    if (inspErr) {
      setSubmitError(`Inspection save failed: ${inspErr.message}`)
      setSubmitting(null)
      return
    }

    // 2. Update bag status in qr_bags + refresh local state
    const newStatus = RAG[rag].newBagStatus
    const { error: bagErr } = await supabase
      .from('qr_bags')
      .update({ status: newStatus })
      .eq('id', bag.id)

    if (bagErr) {
      // Surface the error so we can diagnose constraint issues
      console.error('[qr_bags status update]', bagErr.message, '| attempted status:', newStatus)
      setSubmitError(`Bag status could not be updated: ${bagErr.message}`)
    } else {
      // Refresh local bag state so the bag card reflects the new status immediately
      setBag({ ...bag, status: newStatus })
      setStatusUpdateMsg('Bag status updated successfully.')
      console.log('[qr_bags] status updated to', newStatus)
    }

    // 3. GREEN: wallet + lifecycle + fundraiser
    if (rag === 'green') {
      const newWarnings: string[] = []
      const isFundraiserMode = !!fundraiserId
      const walletAmount = isFundraiserMode ? USER_SHARE : ESTIMATED_VALUE

      // ── Wallet transaction (deduped by bag_id + type) ────────────────────
      const { data: existingTx } = await supabase
        .from('wallet_transactions')
        .select('id')
        .eq('bag_id', bag.id)
        .eq('type', 'earning')
        .maybeSingle()

      if (existingTx) {
        console.log('[wallet_transactions] already exists for bag', bag.id, '— skipping duplicate')
      } else {
        const walletPayload = {
          user_id:     user.id,
          bag_id:      bag.id,
          type:        'earning',
          amount:      walletAmount,
          description: `Bag ${bag.bag_code} approved after live inspection`,
          status:      'completed',
        }
        console.log('Saving wallet transaction', walletPayload)
        const { error: walletErr } = await supabase.from('wallet_transactions').insert(walletPayload)
        if (walletErr) {
          console.error('[wallet_transactions]', walletErr.message)
          newWarnings.push(`Wallet credit failed: ${walletErr.message}`)
        } else {
          await supabase.from('notifications').insert({
            user_id: user.id, type: 'payout', title: 'Reward Earned',
            body: 'Your approved QR bag earned a recycling reward.', read: false,
          })
        }
      }

      const { error: lifecycleErr } = await supabase
        .from('bag_lifecycle_events')
        .insert({
          bag_id: bag.id, actor_id: user.id,
          from_status: bag.status, to_status: 'inspected',
          notes: `Bag ${bag.bag_code} approved after live inspection`,
          metadata: {
            rag_status:    'green',
            source:        'live_inspection',
            co2_saved_lbs: CO2_SAVED_LBS,
            inspection_id: inspection?.id,
            ai_result:     aiResult ?? null,
          },
        })
      if (lifecycleErr) {
        console.error('[bag_lifecycle_events]', lifecycleErr.message)
        newWarnings.push(`Lifecycle event failed: ${lifecycleErr.message}`)
      }

      // ── Point events (deduped by bag_id + reason) ────────────────────────
      const { data: existingPe } = await supabase
        .from('point_events')
        .select('id')
        .eq('bag_id', bag.id)
        .eq('reason', 'clean_bag_approved')
        .maybeSingle()

      if (existingPe) {
        console.log('[point_events] already exists for bag', bag.id, '— skipping duplicate')
      } else {
        const pointPayload = {
          user_id: user.id,
          bag_id:  bag.id,
          points:  POINTS_EARNED,
          reason:  'clean_bag_approved',
        }
        console.log('Saving point event', pointPayload)
        const { error: pointsErr } = await supabase.from('point_events').insert(pointPayload)
        if (pointsErr) {
          console.error('[point_events]', pointsErr.message)
          newWarnings.push(`Points save failed: ${pointsErr.message}`)
        }
      }

      // ── user_points: always sync after CLEAN (independent of point_events dedup) ──
      const { data: existingPts, error: ptsReadErr } = await supabase
        .from('user_points')
        .select('id, total_points')
        .eq('user_id', user.id)
        .maybeSingle()

      if (ptsReadErr) {
        console.error('[user_points read]', ptsReadErr.message)
        newWarnings.push(`Points balance read failed: ${ptsReadErr.message}`)
      } else if (existingPts) {
        const newTotal = existingPts.total_points + POINTS_EARNED
        console.log('[user_points] updating', { user_id: user.id, newTotal })
        const { error: ptsUpdateErr } = await supabase
          .from('user_points')
          .update({ total_points: newTotal, updated_at: new Date().toISOString() })
          .eq('user_id', user.id)
        if (ptsUpdateErr) {
          console.error('[user_points update]', ptsUpdateErr.message)
          newWarnings.push(`Points balance update failed: ${ptsUpdateErr.message}`)
        }
      } else {
        console.log('[user_points] inserting new row', { user_id: user.id, total_points: POINTS_EARNED })
        const { error: ptsInsertErr } = await supabase
          .from('user_points')
          .insert({ user_id: user.id, total_points: POINTS_EARNED, updated_at: new Date().toISOString() })
        if (ptsInsertErr) {
          console.error('[user_points insert]', ptsInsertErr.message)
          newWarnings.push(`Points balance create failed: ${ptsInsertErr.message}`)
        }
      }

      if (isFundraiserMode && fundraiserId) {
        const contribRow = {
          fundraiser_id: fundraiserId, contributor_id: user.id,
          bag_id: bag.id, type: 'bag' as const,
          amount: FUNDRAISER_SHARE,
          notes:  `Bag ${bag.bag_code} donated via live inspection`,
          recorded_by: user.id,
        }
        const { error: contribErr } = await supabase.from('fundraiser_contributions').insert(contribRow)
        if (contribErr) {
          newWarnings.push(`Fundraiser contribution failed: ${contribErr.message}`)
        } else {
          await supabase.from('notifications').insert({
            user_id: user.id, type: 'fundraiser',
            title: 'Recycling Donation Recorded',
            body:  `$${FUNDRAISER_SHARE.toFixed(2)} was donated to your selected fundraiser.`,
            read:  false,
          })
        }
        const { error: rpcErr } = await supabase.rpc('increment_fundraiser_raised', { fid: fundraiserId, delta: FUNDRAISER_SHARE })
        if (rpcErr) newWarnings.push(`Fundraiser total update failed: ${rpcErr.message}`)
      }

      if (newWarnings.length > 0) setWarnings(newWarnings)
    }

    // 4. RED: hazardous alert
    if (rag === 'red') {
      const { error: alertErr } = await supabase
        .from('alerts')
        .insert({
          driver_id: user.id, alert_type: 'hazardous_material',
          status: 'open', notes: `Contaminated bag: ${bag.bag_code}. Inspection: RED.`,
        })
      if (!alertErr) {
        await supabase.from('notifications').insert({
          user_id: user.id, type: 'alert', title: 'Bag Needs Attention',
          body: 'A QR bag was flagged for contamination review.', read: false,
        })
      }
    }

    localStorage.removeItem('live_fundraiser_id')
    localStorage.removeItem('live_fundraiser_name')
    setResult(rag)
    setSubmitting(null)
  }

  function rescanBag() {
    localStorage.removeItem('live_scan_id')
    localStorage.removeItem('live_fundraiser_id')
    localStorage.removeItem('live_fundraiser_name')
    navigate('/live-scan')
  }

  const scanMode = scan?.location ?? 'personal'
  const scanTime = scan?.scan_time ? new Date(scan.scan_time).toLocaleString() : '—'

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="relative min-h-screen flex flex-col overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}
    >
      <style>{`
        @keyframes spinLI  { to { transform: rotate(360deg); } }
        @keyframes liPop   { from { transform: scale(0.93); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes aiPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.55; } }
      `}</style>

      <div className="pointer-events-none absolute inset-0 grid-bg" />
      <div className="pointer-events-none absolute" style={{ top: -80, left: -60, width: 280, height: 280, background: 'rgba(74,222,128,0.15)', filter: 'blur(72px)', borderRadius: '50%' }} />
      <div className="pointer-events-none absolute" style={{ bottom: -60, right: -40, width: 200, height: 200, background: 'rgba(0,200,255,0.07)', filter: 'blur(60px)', borderRadius: '50%' }} />

      {/* Hidden file input — camera on mobile */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handlePhotoSelected}
      />

      {/* Header */}
      <header
        className="relative flex items-center justify-between px-4 py-3"
        style={{ background: 'rgba(4,10,24,0.92)', borderBottom: '1px solid rgba(0,200,255,0.12)', backdropFilter: 'blur(12px)', zIndex: 2 }}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl font-extrabold" style={{ color: '#00c8ff' }}>Cyan&#39;s Brooklynn</span>
          <span style={{ color: 'rgba(0,200,255,0.3)' }}>|</span>
          <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>AI Inspection</span>
        </div>
        <Link to="/live-scan" className="text-sm transition-opacity hover:opacity-70" style={{ color: 'rgba(255,255,255,0.4)' }}>
          ← Scan
        </Link>
      </header>

      <div className="relative flex-1 overflow-y-auto pb-24" style={{ zIndex: 1 }}>
        <div className="max-w-[520px] mx-auto px-4 pt-8">

          {/* Heading */}
          <div className="mb-6" style={fade(0)}>
            <span
              className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest mb-3 inline-block"
              style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80' }}
            >
              Live Mode · AI-Assisted
            </span>
            <h1 className="text-2xl font-extrabold mb-1.5" style={{ color: '#ffffff' }}>Live Bag Inspection</h1>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Take a photo to get an AI quality rating, then confirm the result.
            </p>
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center gap-3 py-10 justify-center" style={fade(60)}>
              <span className="w-5 h-5 rounded-full border-2" style={{ borderColor: 'rgba(0,200,255,0.2)', borderTopColor: '#00c8ff', animation: 'spinLI 0.7s linear infinite' }} />
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Loading bag data…</span>
            </div>
          )}

          {/* Load error */}
          {!loading && loadError && (
            <div className="rounded-xl px-4 py-4 mb-4 text-sm" style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', ...fade(60) }}>
              {loadError}
              <Link to="/live-scan" className="block mt-3 font-semibold" style={{ color: '#00c8ff' }}>
                → Go back to scan a bag
              </Link>
            </div>
          )}

          {/* Bag info card */}
          {!loading && bag && (
            <div className="rounded-2xl p-5 mb-5" style={{ background: 'rgba(0,87,231,0.1)', border: '1px solid rgba(0,200,255,0.25)', ...fade(60) }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.35)' }}>Bag Details</p>
              <div className="flex flex-col">
                {[
                  { label: 'Bag Code',        value: bag.bag_code,                         color: '#00c8ff'               },
                  { label: 'Estimated Value', value: `$${ESTIMATED_VALUE.toFixed(2)}`,     color: '#ffffff'               },
                  { label: 'CO₂ Saved',       value: `${CO2_SAVED_LBS.toFixed(1)} lbs`,   color: '#4ade80'               },
                  { label: 'Points Earned',   value: `${POINTS_EARNED} pts`,               color: '#fbbf24'               },
                  { label: 'Scan Mode',       value: scanMode,                             color: 'rgba(255,255,255,0.6)' },
                  ...(fundraiserName ? [{ label: 'Fundraiser', value: fundraiserName, color: '#4ade80' }] : []),
                  { label: 'Bag Status',      value: bag.status.replace(/_/g, ' '),        color: '#5eead4'               },
                  { label: 'Scanned At',      value: scanTime,                             color: 'rgba(255,255,255,0.45)'},
                ].map((row, i, arr) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between"
                    style={{ paddingTop: i > 0 ? 10 : 0, paddingBottom: i < arr.length - 1 ? 10 : 0, borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}
                  >
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)' }}>{row.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: row.color }}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── AI Photo Analysis Section ─────────────────────────────── */}
          {!loading && bag && !result && (
            <div className="mb-5" style={fade(90)}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Step 1 — AI Photo Scan
              </p>

              {/* Photo preview */}
              {photoUrl && (
                <div className="mb-3 rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(0,200,255,0.2)', maxHeight: 220 }}>
                  <img src={photoUrl} alt="Bag photo" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </div>
              )}

              {/* Camera button */}
              {aiPhase !== 'analyzing' && (
                <button
                  type="button"
                  onClick={handleCameraClick}
                  disabled={submitting !== null}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-sm transition-all hover:brightness-110 active:scale-[0.98]"
                  style={{
                    background: 'rgba(0,200,255,0.08)',
                    border:     '1px solid rgba(0,200,255,0.35)',
                    color:      '#00c8ff',
                    cursor:     submitting !== null ? 'not-allowed' : 'pointer',
                  }}
                >
                  📸 {photoUrl ? 'Retake Photo' : 'Take Photo of Bag Contents'}
                </button>
              )}

              {/* Analyzing spinner */}
              {aiPhase === 'analyzing' && (
                <div
                  className="w-full flex flex-col items-center justify-center gap-3 py-8 rounded-2xl"
                  style={{ background: 'rgba(0,200,255,0.05)', border: '1px solid rgba(0,200,255,0.2)', animation: 'aiPulse 1.8s ease-in-out infinite' }}
                >
                  <span className="w-8 h-8 rounded-full border-2" style={{ borderColor: 'rgba(0,200,255,0.2)', borderTopColor: '#00c8ff', animation: 'spinLI 0.8s linear infinite' }} />
                  <p style={{ fontSize: 13, color: '#00c8ff', fontWeight: 600 }}>AI analyzing bag contents…</p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>Checking recyclables, contamination, bag condition</p>
                </div>
              )}

              {/* AI error */}
              {aiPhase === 'error' && aiError && (
                <div className="rounded-xl px-4 py-3 mt-3 text-xs" style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171' }}>
                  <strong>AI Error:</strong> {aiError}
                </div>
              )}

              {/* ── AI Result Card ──────────────────────────────────────── */}
              {aiPhase === 'done' && aiResult && suggestedRag && (
                <div
                  className="rounded-2xl p-5 mt-3"
                  style={{ background: RAG[suggestedRag].bg, border: `1px solid ${RAG[suggestedRag].border}`, animation: 'liPop 0.4s ease' }}
                >
                  {/* Header row */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: 22 }}>{RAG[suggestedRag].icon}</span>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 800, color: RAG[suggestedRag].color }}>
                          AI: {aiResult.result.replace('_', ' ')}
                        </p>
                        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
                          Suggested: <strong style={{ color: RAG[suggestedRag].color }}>{RAG[suggestedRag].label}</strong>
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p style={{ fontSize: 22, fontWeight: 900, color: confidenceColor(aiResult.confidence) }}>
                        {aiResult.confidence}%
                      </p>
                      <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                        Confidence
                      </p>
                    </div>
                  </div>

                  {/* Details grid */}
                  <div className="flex flex-col gap-2 mb-4">
                    {aiResult.detected_objects.length > 0 && (
                      <div className="rounded-xl px-3 py-2.5" style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)' }}>
                        <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#4ade80', marginBottom: 4 }}>
                          🔍 Materials detected
                        </p>
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>
                          {aiResult.detected_objects.join(' · ')}
                        </p>
                      </div>
                    )}

                    {aiResult.contamination_detected.length > 0 && (
                      <div className="rounded-xl px-3 py-2.5" style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>
                        <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#f87171', marginBottom: 4 }}>
                          ⚠️ Contamination detected
                        </p>
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>
                          {aiResult.contamination_detected.join(' · ')}
                        </p>
                      </div>
                    )}

                    {aiResult.notes && (
                      <div className="rounded-xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontStyle: 'italic', lineHeight: 1.55 }}>
                          "{aiResult.notes}"
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Inspection buttons ─────────────────────────────────────── */}
          {!loading && bag && !result && (
            <div className="mb-6" style={fade(150)}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Step 2 — {suggestedRag ? 'Confirm or Override' : 'Select Inspection Result'}
              </p>

              {!photoUrl && (
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 12, fontStyle: 'italic' }}>
                  📸 Take a photo above to enable inspection buttons.
                </p>
              )}

              {suggestedRag && (
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 12 }}>
                  AI suggests <strong style={{ color: RAG[suggestedRag].color }}>{RAG[suggestedRag].label}</strong>. Tap to confirm or choose a different result.
                </p>
              )}

              <div className="flex flex-col gap-3">
                {(Object.entries(RAG) as [RagStatus, typeof RAG.green][]).map(([rag, meta]) => {
                  const isAiSuggested = suggestedRag === rag
                  const isDisabled = submitting !== null || !photoUrl
                  return (
                    <button
                      key={rag}
                      type="button"
                      onClick={() => handleInspect(rag)}
                      disabled={isDisabled}
                      className="flex items-center gap-4 p-4 rounded-2xl text-sm transition-all hover:brightness-110 active:scale-[0.98]"
                      style={{
                        background: isAiSuggested
                          ? meta.bg.replace('0.12', '0.22')
                          : 'rgba(255,255,255,0.04)',
                        border:  `${isAiSuggested ? '2px' : '1px'} solid ${isAiSuggested ? meta.border : 'rgba(255,255,255,0.1)'}`,
                        color:   isAiSuggested ? meta.color : 'rgba(255,255,255,0.45)',
                        cursor:  isDisabled ? 'not-allowed' : 'pointer',
                        opacity: isDisabled && submitting !== rag ? 0.35 : 1,
                      }}
                    >
                      {submitting === rag ? (
                        <span className="w-6 h-6 rounded-full border-2 shrink-0" style={{ borderColor: `${meta.color}33`, borderTopColor: meta.color, animation: 'spinLI 0.7s linear infinite' }} />
                      ) : (
                        <span style={{ fontSize: 22, flexShrink: 0 }}>{meta.icon}</span>
                      )}
                      <div className="text-left flex-1">
                        <div className="flex items-center gap-2">
                          <p style={{ fontWeight: 700, fontSize: 14 }}>{meta.label}</p>
                          {isAiSuggested && (
                            <span className="px-1.5 py-0.5 rounded-full text-[8px] font-bold" style={{ background: meta.border, color: meta.color }}>
                              AI PICK
                            </span>
                          )}
                        </div>
                        <p style={{ fontSize: 10, opacity: 0.65, marginTop: 3 }}>
                          {rag === 'green'  && (fundraiserId
                            ? `Clean & recyclable. You earn $${USER_SHARE.toFixed(2)}, $${FUNDRAISER_SHARE.toFixed(2)} goes to fundraiser.`
                            : `Clean & recyclable. Earns $${ESTIMATED_VALUE.toFixed(2)} wallet credit.`)}
                          {rag === 'yellow' && 'Some contamination. Flagged for warehouse review.'}
                          {rag === 'red'    && 'High contamination. Alert will be created.'}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>

              {submitError && (
                <div className="rounded-xl px-4 py-3 mt-3 text-sm" style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }}>
                  {submitError}
                </div>
              )}
            </div>
          )}

          {/* ── Result card ────────────────────────────────────────────── */}
          {result && (
            <div
              className="rounded-2xl p-6 mb-6 text-center"
              style={{ background: RAG[result].bg, border: `1px solid ${RAG[result].border}`, animation: 'liPop 0.45s cubic-bezier(0.34,1.56,0.64,1)' }}
            >
              <span style={{ fontSize: 44, display: 'block', marginBottom: 14 }}>{RAG[result].icon}</span>
              <p style={{ fontSize: 17, fontWeight: 800, color: RAG[result].color, marginBottom: 8 }}>
                {result === 'green'  && 'Inspection Complete!'}
                {result === 'yellow' && 'Flagged for Review'}
                {result === 'red'    && 'Bag Rejected'}
              </p>
              {aiResult && (
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 10 }}>
                  AI: {aiResult.result} · {aiResult.confidence}% confidence
                </p>
              )}
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.65, marginBottom: 20 }}>
                {result === 'green' && fundraiserName ? (
                  <>
                    <p style={{ marginBottom: 6 }}>You earned <span style={{ color: '#4ade80', fontWeight: 700 }}>${USER_SHARE.toFixed(2)}</span></p>
                    <p><span style={{ color: '#4ade80', fontWeight: 700 }}>${FUNDRAISER_SHARE.toFixed(2)}</span> donated to <span style={{ color: '#ffffff', fontWeight: 600 }}>{fundraiserName}</span></p>
                  </>
                ) : result === 'green' ? (
                  <p>Bag approved. <span style={{ color: '#4ade80', fontWeight: 700 }}>${ESTIMATED_VALUE.toFixed(2)}</span> added to your wallet.</p>
                ) : result === 'yellow' ? (
                  <p>Inspection saved. Rescan or manual override required at the warehouse.</p>
                ) : (
                  <p>Inspection saved. A hazardous material alert has been opened for staff review.</p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                {result === 'green' && fundraiserName && (
                  <Link to="/live-fundraisers" className="w-full flex items-center justify-center py-3 rounded-xl text-sm font-bold transition-all hover:brightness-110" style={{ background: 'rgba(74,222,128,0.18)', border: '1px solid rgba(74,222,128,0.45)', color: '#4ade80' }}>
                    View Live Fundraisers →
                  </Link>
                )}
                {result === 'green' && (
                  <Link to="/dashboard/consumer" className="w-full flex items-center justify-center py-3 rounded-xl text-sm font-bold transition-all hover:brightness-110" style={{ background: 'rgba(0,200,255,0.1)', border: '1px solid rgba(0,200,255,0.25)', color: '#00c8ff' }}>
                    View Dashboard →
                  </Link>
                )}
                {result === 'green' && (
                  <Link to="/live-wallet" className="w-full flex items-center justify-center py-3 rounded-xl text-sm font-bold transition-all hover:brightness-110" style={{ background: 'rgba(94,234,212,0.1)', border: '1px solid rgba(94,234,212,0.25)', color: '#5eead4' }}>
                    💳 Live Wallet
                  </Link>
                )}
                {result === 'yellow' && (
                  <button type="button" onClick={rescanBag} className="w-full flex items-center justify-center py-3 rounded-xl text-sm font-bold transition-all hover:brightness-110" style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.4)', color: '#fbbf24', cursor: 'pointer' }}>
                    🔄 Rescan This Bag
                  </button>
                )}
                {result === 'red' && (
                  <Link to="/dashboard/consumer" className="w-full flex items-center justify-center py-3 rounded-xl text-sm font-bold transition-all hover:brightness-110" style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.4)', color: '#f87171' }}>
                    View Dashboard →
                  </Link>
                )}
                <Link to="/live-scan" className="w-full flex items-center justify-center py-2.5 rounded-xl text-sm font-medium transition-all hover:brightness-110" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}>
                  Scan Another Bag
                </Link>
              </div>
            </div>
          )}

          {/* Bag status update success */}
          {statusUpdateMsg && (
            <div className="rounded-xl px-4 py-3 mb-4 text-sm text-center font-semibold" style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80' }}>
              ✓ {statusUpdateMsg}
            </div>
          )}

          {/* Partial-failure warnings */}
          {warnings.length > 0 && (
            <div className="rounded-xl px-4 py-4 mb-4" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.3)' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#fbbf24' }}>Partial Save Warning</p>
              <ul className="flex flex-col gap-1">
                {warnings.map(w => (
                  <li key={w} style={{ fontSize: 12, color: 'rgba(251,191,36,0.8)' }}>• {w}</li>
                ))}
              </ul>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
