import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuthStore } from '../../store/authStore'

// ── Types ─────────────────────────────────────────────────────────────────────

type InspPhoto = { photo_url: string }
type InspRecord = {
  id:         string
  status:     string
  notes:      string | null
  created_at: string
  inspection_photos: InspPhoto[]
}

type ReviewBag = {
  id:                string
  bag_code:          string
  status:            string
  updated_at:        string
  inspections:       InspRecord[]
}

type Decision = 'approve' | 'reject'

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(ts: string): string {
  const secs = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (secs < 30)  return 'just now'
  if (secs < 90)  return '1 min ago'
  const mins = Math.floor(secs / 60)
  if (mins < 60)  return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `${hrs}h ago`
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LiveWarehouseReviewPage() {
  const { user } = useAuthStore()

  const [animate, setAnimate]     = useState(false)
  const [bags, setBags]           = useState<ReviewBag[]>([])
  const [loading, setLoading]     = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [submitting, setSubmitting] = useState<string | null>(null) // bagId being submitted
  const [notes, setNotes]         = useState<Record<string, string>>({})
  const [decided, setDecided]     = useState<Record<string, Decision>>({})
  const [toastMsg, setToastMsg]   = useState<string | null>(null)

  const fetchBags = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)

    const { data, error: err } = await supabase
      .from('qr_bags')
      .select(`
        id, bag_code, status, updated_at,
        inspections(id, status, notes, created_at, inspection_photos(photo_url))
      `)
      .eq('status', 'needs_review')
      .order('updated_at', { ascending: false })

    if (err) {
      setError(err.message)
      setLoading(false)
      setRefreshing(false)
      return
    }

    setBags((data ?? []) as ReviewBag[])
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimate(true))
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => { fetchBags() }, [fetchBags])

  function showToast(msg: string) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3500)
  }

  async function handleDecision(bag: ReviewBag, decision: Decision) {
    if (!user) return
    setSubmitting(bag.id)

    const newStatus = decision === 'approve' ? 'inspected' : 'contaminated'
    const note = notes[bag.id]?.trim() || null
    const latestInsp = bag.inspections
      .slice()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]

    // 1. Update bag status
    const { error: bagErr } = await supabase
      .from('qr_bags')
      .update({ status: newStatus })
      .eq('id', bag.id)

    if (bagErr) {
      showToast(`Error: ${bagErr.message}`)
      setSubmitting(null)
      return
    }

    // 2. Add inspection_review if there's an inspection record
    if (latestInsp) {
      await supabase.from('inspection_reviews').insert({
        inspection_id:   latestInsp.id,
        reviewer_id:     user.id,
        decision:        decision === 'approve' ? 'approved' : 'overridden',
        override_status: decision === 'approve' ? null : 'red',
        notes:           note,
      })
    }

    // 3. Record lifecycle event
    await supabase.from('bag_lifecycle_events').insert({
      bag_id:      bag.id,
      actor_id:    user.id,
      from_status: 'needs_review',
      to_status:   newStatus,
      notes:       note ?? `Supervisor ${decision === 'approve' ? 'approved' : 'rejected'} bag after review`,
      metadata:    { source: 'warehouse_review', decision },
    })

    setDecided(prev => ({ ...prev, [bag.id]: decision }))
    showToast(decision === 'approve'
      ? `Bag ${bag.bag_code} approved — marked as inspected.`
      : `Bag ${bag.bag_code} rejected — marked as contaminated.`
    )

    // Remove from list after short delay
    setTimeout(() => {
      setBags(prev => prev.filter(b => b.id !== bag.id))
      setDecided(prev => { const copy = { ...prev }; delete copy[bag.id]; return copy })
    }, 1800)

    setSubmitting(null)
  }

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: 'linear-gradient(180deg,#060e24 0%,#040a1a 100%)' }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2" style={{ borderColor: 'rgba(0,200,255,0.2)', borderTopColor: '#00c8ff' }} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6" style={{ background: 'linear-gradient(180deg,#060e24 0%,#040a1a 100%)' }}>
        <p style={{ color: '#f87171', marginBottom: 16 }}>{error}</p>
        <button onClick={() => fetchBags()} style={{ color: '#00c8ff', fontSize: 14 }}>Retry</button>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen pb-16"
      style={{
        background: 'linear-gradient(180deg,#060e24 0%,#040a1a 100%)',
        opacity: animate ? 1 : 0,
        transform: animate ? 'none' : 'translateY(8px)',
        transition: 'opacity 0.4s ease, transform 0.4s ease',
      }}
    >
      {/* ── Header ── */}
      <div
        className="sticky top-0 z-10 px-4 py-4 flex items-center justify-between"
        style={{ background: 'rgba(6,14,36,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(251,191,36,0.15)' }}
      >
        <div className="flex items-center gap-3">
          <Link
            to="/live-warehouse"
            className="flex items-center justify-center rounded-xl transition-all hover:brightness-110"
            style={{ width: 36, height: 36, background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.2)', color: '#00c8ff', fontSize: 16 }}
          >
            ←
          </Link>
          <div>
            <h1 style={{ fontSize: 17, fontWeight: 800, color: '#ffffff', lineHeight: 1.2 }}>Review Queue</h1>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>
              {bags.length} bag{bags.length !== 1 ? 's' : ''} pending review
            </p>
          </div>
        </div>
        <button
          onClick={() => fetchBags(true)}
          disabled={refreshing}
          className="flex items-center justify-center rounded-xl transition-all hover:brightness-110"
          style={{ width: 36, height: 36, background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.2)', color: refreshing ? 'rgba(0,200,255,0.4)' : '#00c8ff', fontSize: 16 }}
        >
          {refreshing ? '⟳' : '↻'}
        </button>
      </div>

      {/* ── Toast ── */}
      {toastMsg && (
        <div
          className="fixed bottom-6 left-1/2 z-50 rounded-2xl px-5 py-3 text-sm font-bold shadow-lg"
          style={{
            transform: 'translateX(-50%)',
            background: 'rgba(6,14,36,0.96)',
            border: '1px solid rgba(0,200,255,0.3)',
            color: '#ffffff',
            maxWidth: '90vw',
          }}
        >
          {toastMsg}
        </div>
      )}

      <div className="px-4 pt-4 flex flex-col gap-4" style={{ maxWidth: 600, margin: '0 auto' }}>

        {/* ── Empty state ── */}
        {bags.length === 0 && (
          <div
            className="rounded-2xl p-10 text-center"
            style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)' }}
          >
            <p style={{ fontSize: 40, marginBottom: 12 }}>✅</p>
            <p style={{ fontSize: 16, fontWeight: 800, color: '#4ade80', marginBottom: 6 }}>Queue Clear</p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
              No bags are currently waiting for review.
            </p>
          </div>
        )}

        {/* ── Bag cards ── */}
        {bags.map(bag => {
          const latestInsp = bag.inspections
            .slice()
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
          const photo = latestInsp?.inspection_photos?.[0]?.photo_url ?? null
          const isSubmitting = submitting === bag.id
          const wasDecided = decided[bag.id]

          return (
            <div
              key={bag.id}
              className="rounded-2xl overflow-hidden"
              style={{
                border: '1px solid rgba(251,191,36,0.25)',
                background: wasDecided === 'approve'
                  ? 'rgba(74,222,128,0.06)'
                  : wasDecided === 'reject'
                  ? 'rgba(248,113,113,0.06)'
                  : 'rgba(255,255,255,0.02)',
                transition: 'background 0.3s ease, border-color 0.3s ease',
                borderColor: wasDecided === 'approve'
                  ? 'rgba(74,222,128,0.3)'
                  : wasDecided === 'reject'
                  ? 'rgba(248,113,113,0.3)'
                  : 'rgba(251,191,36,0.25)',
              }}
            >
              {/* Bag header */}
              <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 800, color: '#ffffff', fontFamily: 'monospace' }}>{bag.bag_code}</p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>
                    ⚠️ Needs Review · {timeAgo(bag.updated_at)}
                  </p>
                </div>
                {wasDecided && (
                  <span
                    className="rounded-xl px-3 py-1.5 text-xs font-bold"
                    style={{
                      background: wasDecided === 'approve' ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)',
                      color: wasDecided === 'approve' ? '#4ade80' : '#f87171',
                    }}
                  >
                    {wasDecided === 'approve' ? '✅ Approved' : '🚫 Rejected'}
                  </span>
                )}
              </div>

              {/* Photo */}
              {photo && (
                <div style={{ position: 'relative', height: 180, background: '#000', overflow: 'hidden' }}>
                  <img
                    src={photo}
                    alt={`Bag ${bag.bag_code}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.9 }}
                  />
                  <div
                    style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0, height: 60,
                      background: 'linear-gradient(to top, rgba(6,14,36,0.95), transparent)',
                    }}
                  />
                </div>
              )}

              {/* AI notes */}
              {latestInsp?.notes && (
                <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>AI INSPECTION NOTES</p>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6 }}>{latestInsp.notes}</p>
                </div>
              )}

              {/* No inspection data */}
              {!latestInsp && (
                <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', fontStyle: 'italic' }}>
                    No inspection record found — manually flagged for review.
                  </p>
                </div>
              )}

              {/* Reviewer notes */}
              <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>REVIEWER NOTES (OPTIONAL)</p>
                <textarea
                  value={notes[bag.id] ?? ''}
                  onChange={e => setNotes(prev => ({ ...prev, [bag.id]: e.target.value }))}
                  placeholder="Add notes for this decision..."
                  disabled={isSubmitting || !!wasDecided}
                  rows={2}
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 10,
                    color: '#ffffff',
                    fontSize: 12,
                    padding: '8px 10px',
                    resize: 'none',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2 px-4 py-3">
                <button
                  onClick={() => handleDecision(bag, 'approve')}
                  disabled={isSubmitting || !!wasDecided}
                  className="flex-1 rounded-xl py-3 text-sm font-bold transition-all hover:brightness-110 disabled:opacity-40"
                  style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80' }}
                >
                  {isSubmitting ? '...' : '✅ Approve'}
                </button>
                <button
                  onClick={() => handleDecision(bag, 'reject')}
                  disabled={isSubmitting || !!wasDecided}
                  className="flex-1 rounded-xl py-3 text-sm font-bold transition-all hover:brightness-110 disabled:opacity-40"
                  style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }}
                >
                  {isSubmitting ? '...' : '🚫 Reject'}
                </button>
              </div>
            </div>
          )
        })}

      </div>
    </div>
  )
}
