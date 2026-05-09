import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import type { User } from '@supabase/supabase-js'

// Real table: `bags`       columns: id, bag_code, status, consumer_id
// Real table: `bag_scans`  columns: id, bag_id, scanned_by, scan_time, location
// Real table: `inspections` columns: id, bag_id, inspector_id, status, notes, created_at
// New tables (migration): wallet_transactions, bag_lifecycle_events
// Existing: alerts — columns: driver_id, alert_type, status, notes

type RagStatus = 'green' | 'yellow' | 'red'

type Bag = {
  id:          string
  bag_code:    string
  status:      string
  consumer_id: string | null
}

type BagScan = {
  id:        string
  scan_time: string        // real timestamp column (not created_at)
  location:  string | null // scan_mode stored here (real location column repurposed)
}

const RAG: Record<RagStatus, {
  label:     string
  icon:      string
  color:     string
  bg:        string
  border:    string
  newBagStatus: string
}> = {
  green:  { label: 'Clean Bag',    icon: '✅', color: '#4ade80', bg: 'rgba(74,222,128,0.12)',  border: 'rgba(74,222,128,0.35)',  newBagStatus: 'inspected'    },
  yellow: { label: 'Needs Review', icon: '⚠️', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.35)',  newBagStatus: 'at_warehouse' },
  red:    { label: 'Contaminated', icon: '🚫', color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.35)', newBagStatus: 'at_warehouse' },
}

// Standard defaults — bags table does not store these
const ESTIMATED_VALUE  = 2.85  // personal mode earnings
const USER_SHARE       = 2.00  // user keeps in fundraiser mode
const FUNDRAISER_SHARE = 0.85  // donated to fundraiser
const CO2_SAVED_LBS    = 4.2
const POINTS_EARNED    = 285

export default function LiveInspectionPage() {
  const navigate = useNavigate()
  const [animate, setAnimate]         = useState(false)
  const [user, setUser]               = useState<User | null>(null)
  const [bag, setBag]                 = useState<Bag | null>(null)
  const [scan, setScan]               = useState<BagScan | null>(null)
  const [loading, setLoading]         = useState(true)
  const [loadError, setLoadError]     = useState<string | null>(null)
  const [submitting, setSubmitting]   = useState<RagStatus | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [result, setResult]           = useState<RagStatus | null>(null)
  const [fundraiserId, setFundraiserId]     = useState<string | null>(null)
  const [fundraiserName, setFundraiserName] = useState<string | null>(null)
  const [warnings, setWarnings]             = useState<string[]>([])

  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimate(true))
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    let mounted = true

    async function load() {
      const scanId      = localStorage.getItem('live_scan_id')
      const bagId       = localStorage.getItem('live_bag_id')
      const fId         = localStorage.getItem('live_fundraiser_id')
      const fName       = localStorage.getItem('live_fundraiser_name')
      if (fId)   setFundraiserId(fId)
      if (fName) setFundraiserName(fName)

      if (!scanId || !bagId) {
        setLoadError('No active scan found. Please scan a bag first.')
        setLoading(false)
        return
      }

      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!mounted) return
      if (!authUser) { navigate('/real-login', { replace: true }); return }
      setUser(authUser)

      // Fetch real tables with real column names
      const [bagRes, scanRes] = await Promise.all([
        supabase
          .from('bags')
          .select('id, bag_code, status, consumer_id')
          .eq('id', bagId)
          .maybeSingle(),
        supabase
          .from('bag_scans')
          .select('id, scan_time, location')
          .eq('id', scanId)
          .maybeSingle(),
      ])

      if (!mounted) return
      if (bagRes.data)  setBag(bagRes.data   as Bag)
      if (scanRes.data) setScan(scanRes.data  as BagScan)
      if (bagRes.error) setLoadError(`Could not load bag: ${bagRes.error.message}`)
      setLoading(false)
    }

    load()
    return () => { mounted = false }
  }, [navigate])

  const fade = (d = 0): React.CSSProperties => ({
    opacity:    animate ? 1 : 0,
    transform:  animate ? 'translateY(0)' : 'translateY(14px)',
    transition: `opacity 0.4s ease ${d}ms, transform 0.4s ease ${d}ms`,
  })

  async function handleInspect(rag: RagStatus) {
    if (!bag || !user) return
    setSubmitError(null)
    setSubmitting(rag)

    // ── 1. Insert inspection ────────────────────────────────────
    // Real inspections columns: bag_id, inspector_id, status, notes
    // status is the green/yellow/red value (not rag_status — wrong column)
    const { data: inspection, error: inspErr } = await supabase
      .from('inspections')
      .insert({
        bag_id:       bag.id,
        inspector_id: user.id,
        status:       rag,
        notes:        'Live inspection via BayKid app',
      })
      .select('id')
      .single()

    if (inspErr) {
      setSubmitError(`Inspection save failed: ${inspErr.message}`)
      setSubmitting(null)
      return
    }

    // ── 2. Update bags.status ───────────────────────────────────
    const { error: bagErr } = await supabase
      .from('bags')
      .update({ status: RAG[rag].newBagStatus })
      .eq('id', bag.id)
    if (bagErr) console.error('[bags update]', bagErr.message)

    // ── 3. GREEN: wallet credit + lifecycle event + fundraiser ──
    if (rag === 'green') {
      const newWarnings: string[] = []
      const isFundraiserMode = !!fundraiserId
      const walletAmount = isFundraiserMode ? USER_SHARE : ESTIMATED_VALUE

      const { error: walletErr } = await supabase
        .from('wallet_transactions')
        .insert({
          user_id:     user.id,
          bag_id:      bag.id,
          type:        'earning',
          amount:      walletAmount,
          description: `Bag ${bag.bag_code} approved after live inspection`,
          status:      'completed',
        })
      if (walletErr) {
        console.error('[wallet_transactions]', walletErr.message)
        newWarnings.push('Wallet credit could not be recorded.')
      } else {
        // Non-fatal — wallet earning notification
        await supabase
          .from('notifications')
          .insert({
            user_id: user.id,
            type:    'payout',
            title:   'Reward Earned',
            body:    'Your approved QR bag earned a recycling reward.',
            read:    false,
          })
      }

      const { error: lifecycleErr } = await supabase
        .from('bag_lifecycle_events')
        .insert({
          bag_id:      bag.id,
          actor_id:    user.id,
          from_status: bag.status,
          to_status:   'inspected',
          notes:       `Bag ${bag.bag_code} approved after live inspection`,
          metadata:    {
            rag_status:    'green',
            source:        'live_inspection',
            co2_saved_lbs: CO2_SAVED_LBS,
            inspection_id: inspection?.id,
          },
        })
      if (lifecycleErr) {
        console.error('[bag_lifecycle_events]', lifecycleErr.message)
        newWarnings.push('Lifecycle event could not be recorded.')
      }

      if (isFundraiserMode && fundraiserId) {
        // Columns used: fundraiser_id, contributor_id (NOT user_id), bag_id, type, amount, notes, recorded_by
        // type CHECK: 'bag' | 'cash' | 'bonus'   —   no bag_scan_id or contribution_type column exists
        const contribRow = {
          fundraiser_id:  fundraiserId,
          contributor_id: user.id,
          bag_id:         bag.id,
          type:           'bag' as const,
          amount:         FUNDRAISER_SHARE,
          notes:          `Bag ${bag.bag_code} donated via live inspection`,
          recorded_by:    user.id,
        }
        const { error: contribErr } = await supabase
          .from('fundraiser_contributions')
          .insert(contribRow)
        if (contribErr) {
          console.error('[fundraiser_contributions] insert failed', {
            code:    contribErr.code,
            message: contribErr.message,
            details: contribErr.details,
            hint:    contribErr.hint,
            row:     contribRow,
          })
          newWarnings.push(`Fundraiser contribution failed (${contribErr.code ?? 'ERR'}): ${contribErr.message}`)
        } else {
          // Non-fatal — fundraiser donation notification
          await supabase
            .from('notifications')
            .insert({
              user_id: user.id,
              type:    'fundraiser',
              title:   'Recycling Donation Recorded',
              body:    `$${FUNDRAISER_SHARE.toFixed(2)} was donated to your selected fundraiser.`,
              read:    false,
            })
        }

        const { error: rpcErr } = await supabase
          .rpc('increment_fundraiser_raised', { fid: fundraiserId, delta: FUNDRAISER_SHARE })
        if (rpcErr) {
          console.error('[increment_fundraiser_raised] rpc failed', {
            code:    rpcErr.code,
            message: rpcErr.message,
            hint:    rpcErr.hint,
          })
          newWarnings.push(`Fundraiser total update failed (${rpcErr.code ?? 'ERR'}): ${rpcErr.message}`)
        }
      }

      if (newWarnings.length > 0) setWarnings(newWarnings)
    }

    // ── 4. RED: open a hazardous material alert ─────────────────
    // alerts columns: driver_id (FK profiles), alert_type, status, notes
    if (rag === 'red') {
      const { error: alertErr } = await supabase
        .from('alerts')
        .insert({
          driver_id:  user.id,
          alert_type: 'hazardous_material',
          status:     'open',
          notes:      `Contaminated bag detected: ${bag.bag_code}. Inspection: RED.`,
        })
      if (alertErr) {
        console.error('[alerts]', alertErr.message)
      } else {
        // Non-fatal — contamination alert notification
        await supabase
          .from('notifications')
          .insert({
            user_id: user.id,
            type:    'alert',
            title:   'Bag Needs Attention',
            body:    'A QR bag was flagged for contamination review.',
            read:    false,
          })
      }
    }

    // Clear fundraiser from localStorage after any inspection outcome
    localStorage.removeItem('live_fundraiser_id')
    localStorage.removeItem('live_fundraiser_name')

    setResult(rag)
    setSubmitting(null)
  }

  function rescanBag() {
    // Keep bag ID, clear scan ID + fundraiser so user selects fresh on next scan
    localStorage.removeItem('live_scan_id')
    localStorage.removeItem('live_fundraiser_id')
    localStorage.removeItem('live_fundraiser_name')
    navigate('/live-scan')
  }

  const scanMode = scan?.location ?? 'personal'
  const scanTime = scan?.scan_time ? new Date(scan.scan_time).toLocaleString() : '—'

  return (
    <div
      className="relative min-h-screen flex flex-col overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}
    >
      <style>{`
        @keyframes spinLI { to { transform: rotate(360deg); } }
        @keyframes liPop  { from { transform: scale(0.93); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      `}</style>

      <div className="pointer-events-none absolute inset-0 grid-bg" />
      <div className="pointer-events-none absolute" style={{ top: -80, left: -60, width: 280, height: 280, background: 'rgba(74,222,128,0.15)', filter: 'blur(72px)', borderRadius: '50%' }} />
      <div className="pointer-events-none absolute" style={{ bottom: -60, right: -40, width: 200, height: 200, background: 'rgba(0,200,255,0.07)', filter: 'blur(60px)', borderRadius: '50%' }} />

      {/* Header */}
      <header
        className="relative flex items-center justify-between px-4 py-3"
        style={{ background: 'rgba(4,10,24,0.92)', borderBottom: '1px solid rgba(0,200,255,0.12)', backdropFilter: 'blur(12px)', zIndex: 2 }}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl font-extrabold" style={{ color: '#00c8ff' }}>BayKid</span>
          <span style={{ color: 'rgba(0,200,255,0.3)' }}>|</span>
          <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>Live Inspection</span>
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
              Live Mode
            </span>
            <h1 className="text-2xl font-extrabold mb-1.5" style={{ color: '#ffffff' }}>Live Bag Inspection</h1>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Record inspection result for the scanned QR bag.
            </p>
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center gap-3 py-10 justify-center" style={fade(60)}>
              <span
                className="w-5 h-5 rounded-full border-2"
                style={{ borderColor: 'rgba(0,200,255,0.2)', borderTopColor: '#00c8ff', animation: 'spinLI 0.7s linear infinite' }}
              />
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Loading bag data…</span>
            </div>
          )}

          {/* Load error */}
          {!loading && loadError && (
            <div
              className="rounded-xl px-4 py-4 mb-4 text-sm"
              style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', ...fade(60) }}
            >
              {loadError}
              <Link to="/live-scan" className="block mt-3 font-semibold" style={{ color: '#00c8ff' }}>
                → Go back to scan a bag
              </Link>
            </div>
          )}

          {/* Bag info card */}
          {!loading && bag && (
            <div
              className="rounded-2xl p-5 mb-6"
              style={{ background: 'rgba(0,87,231,0.1)', border: '1px solid rgba(0,200,255,0.25)', ...fade(60) }}
            >
              <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Bag Details
              </p>
              <div className="flex flex-col">
                {[
                  { label: 'Bag Code',       value: bag.bag_code,                         color: '#00c8ff'               },
                  { label: 'Estimated Value',value: `$${ESTIMATED_VALUE.toFixed(2)}`,     color: '#ffffff'               },
                  { label: 'CO₂ Saved',      value: `${CO2_SAVED_LBS.toFixed(1)} lbs`,   color: '#4ade80'               },
                  { label: 'Points Earned',  value: `${POINTS_EARNED} pts`,               color: '#fbbf24'               },
                  { label: 'Scan Mode',      value: scanMode,                             color: 'rgba(255,255,255,0.6)' },
                  ...(fundraiserName ? [{ label: 'Fundraiser', value: fundraiserName, color: '#4ade80' }] : []),
                  { label: 'Bag Status',     value: bag.status.replace(/_/g, ' '),        color: '#5eead4'               },
                  { label: 'Scanned At',     value: scanTime,                             color: 'rgba(255,255,255,0.45)'},
                ].map((row, i, arr) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between"
                    style={{
                      paddingTop:    i > 0 ? 10 : 0,
                      paddingBottom: i < arr.length - 1 ? 10 : 0,
                      borderBottom:  i < arr.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                    }}
                  >
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)' }}>{row.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: row.color }}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Inspection buttons — only shown before result */}
          {!loading && bag && !result && (
            <div className="mb-6" style={fade(120)}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Select Inspection Result
              </p>
              <div className="flex flex-col gap-3">
                {(Object.entries(RAG) as [RagStatus, typeof RAG.green][]).map(([rag, meta]) => (
                  <button
                    key={rag}
                    type="button"
                    onClick={() => handleInspect(rag)}
                    disabled={submitting !== null}
                    className="flex items-center gap-4 p-4 rounded-2xl text-sm transition-all hover:brightness-110 active:scale-[0.98]"
                    style={{
                      background: meta.bg,
                      border:     `1px solid ${meta.border}`,
                      color:      meta.color,
                      cursor:     submitting !== null ? 'not-allowed' : 'pointer',
                      opacity:    submitting !== null && submitting !== rag ? 0.45 : 1,
                    }}
                  >
                    {submitting === rag ? (
                      <span
                        className="w-6 h-6 rounded-full border-2 shrink-0"
                        style={{ borderColor: `${meta.color}33`, borderTopColor: meta.color, animation: 'spinLI 0.7s linear infinite' }}
                      />
                    ) : (
                      <span style={{ fontSize: 22, flexShrink: 0 }}>{meta.icon}</span>
                    )}
                    <div className="text-left flex-1">
                      <p style={{ fontWeight: 700, fontSize: 14 }}>{meta.label}</p>
                      <p style={{ fontSize: 10, opacity: 0.65, marginTop: 3 }}>
                        {rag === 'green'  && (fundraiserId
                          ? `Clean & recyclable. You earn $${USER_SHARE.toFixed(2)}, $${FUNDRAISER_SHARE.toFixed(2)} goes to fundraiser.`
                          : `Clean & recyclable. Earns $${ESTIMATED_VALUE.toFixed(2)} wallet credit.`)}
                        {rag === 'yellow' && 'Some contamination. Flagged for warehouse review.'}
                        {rag === 'red'    && 'High contamination. Alert will be created.'}
                      </p>
                    </div>
                  </button>
                ))}
              </div>

              {submitError && (
                <div
                  className="rounded-xl px-4 py-3 mt-3 text-sm"
                  style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }}
                >
                  {submitError}
                </div>
              )}
            </div>
          )}

          {/* ── Result card ─────────────────────────────────────────── */}
          {result && (
            <div
              className="rounded-2xl p-6 mb-6 text-center"
              style={{
                background: RAG[result].bg,
                border:     `1px solid ${RAG[result].border}`,
                animation:  'liPop 0.45s cubic-bezier(0.34,1.56,0.64,1)',
              }}
            >
              <span style={{ fontSize: 44, display: 'block', marginBottom: 14 }}>
                {RAG[result].icon}
              </span>
              <p style={{ fontSize: 17, fontWeight: 800, color: RAG[result].color, marginBottom: 8 }}>
                {result === 'green'  && 'Inspection Complete!'}
                {result === 'yellow' && 'Flagged for Review'}
                {result === 'red'    && 'Bag Rejected'}
              </p>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.65, marginBottom: 20 }}>
                {result === 'green' && fundraiserName ? (
                  <>
                    <p style={{ marginBottom: 6 }}>
                      You earned{' '}
                      <span style={{ color: '#4ade80', fontWeight: 700 }}>${USER_SHARE.toFixed(2)}</span>
                    </p>
                    <p>
                      <span style={{ color: '#4ade80', fontWeight: 700 }}>${FUNDRAISER_SHARE.toFixed(2)}</span>
                      {' '}donated to{' '}
                      <span style={{ color: '#ffffff', fontWeight: 600 }}>{fundraiserName}</span>
                    </p>
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
                  <Link
                    to="/live-fundraisers"
                    className="w-full flex items-center justify-center py-3 rounded-xl text-sm font-bold transition-all hover:brightness-110"
                    style={{ background: 'rgba(74,222,128,0.18)', border: '1px solid rgba(74,222,128,0.45)', color: '#4ade80' }}
                  >
                    View Live Fundraisers →
                  </Link>
                )}
                {result === 'green' && (
                  <Link
                    to="/live-dashboard"
                    className="w-full flex items-center justify-center py-3 rounded-xl text-sm font-bold transition-all hover:brightness-110"
                    style={{ background: 'rgba(0,200,255,0.1)', border: '1px solid rgba(0,200,255,0.25)', color: '#00c8ff' }}
                  >
                    View Live Dashboard →
                  </Link>
                )}
                {result === 'green' && (
                  <Link
                    to="/live-wallet"
                    className="w-full flex items-center justify-center py-3 rounded-xl text-sm font-bold transition-all hover:brightness-110"
                    style={{ background: 'rgba(94,234,212,0.1)', border: '1px solid rgba(94,234,212,0.25)', color: '#5eead4' }}
                  >
                    💳 Live Wallet
                  </Link>
                )}

                {result === 'yellow' && (
                  <button
                    type="button"
                    onClick={rescanBag}
                    className="w-full flex items-center justify-center py-3 rounded-xl text-sm font-bold transition-all hover:brightness-110"
                    style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.4)', color: '#fbbf24', cursor: 'pointer' }}
                  >
                    🔄 Rescan This Bag
                  </button>
                )}

                {result === 'red' && (
                  <Link
                    to="/live-dashboard"
                    className="w-full flex items-center justify-center py-3 rounded-xl text-sm font-bold transition-all hover:brightness-110"
                    style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.4)', color: '#f87171' }}
                  >
                    View Dashboard →
                  </Link>
                )}

                <Link
                  to="/live-scan"
                  className="w-full flex items-center justify-center py-2.5 rounded-xl text-sm font-medium transition-all hover:brightness-110"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}
                >
                  Scan Another Bag
                </Link>
              </div>
            </div>
          )}

          {/* Partial-failure warnings */}
          {warnings.length > 0 && (
            <div
              className="rounded-xl px-4 py-4 mb-4"
              style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.3)' }}
            >
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#fbbf24' }}>
                Partial Save Warning
              </p>
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
