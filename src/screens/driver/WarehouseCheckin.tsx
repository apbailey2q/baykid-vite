// ── WarehouseCheckin ────────────────────────────────────────────────────────
// Phase-based warehouse arrival + bag check-in screen.
//
// URL params:
//   route_id       — active driver route (required)
//   warehouse_code — expected warehouse QR code, e.g. NASH-01 (default: NASH-01)
//   warehouse_name — display name shown in header (default: Warehouse)
//
// Flow:
//   loading      → fetch accepted bags for the route
//   qr-scanning  → driver scans warehouse entrance QR code
//   qr-mismatch  → QR scanned didn't match expected code (retry)
//   bag-checkin  → driver scans each collected bag in any order; list tracks progress
//   submitting   → saving session + bag records to DB, completing route
//   submitted    → celebration, auto-navigate to dashboard after 4 s
//   error        → something went wrong; back button shown

import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase }          from '../../lib/supabase'
import { useAuthStore }      from '../../store/authStore'
import { useDriverStore }    from '../../store/driverStore'
import { completeRoute }     from '../../lib/driver'
import { QrScanner }         from '../../components/QrScanner'

// ── Types ─────────────────────────────────────────────────────────────────────

type Phase = 'loading' | 'qr-scanning' | 'qr-mismatch' | 'bag-checkin' | 'submitting' | 'submitted' | 'error'

interface AcceptedBag {
  bag_qr_code:  string
  stop_id:      string | null
  stop_address: string | null
  checkedIn:    boolean
}

// ── Component ─────────────────────────────────────────────────────────────────

export function WarehouseCheckin() {
  const [params]  = useSearchParams()
  const navigate  = useNavigate()
  const { user }  = useAuthStore()
  const { setActiveRoute, setActiveRouteStops } = useDriverStore()

  const routeId       = params.get('route_id')       ?? ''
  const warehouseCode = params.get('warehouse_code') ?? 'NASH-01'
  const warehouseName = params.get('warehouse_name') ?? 'Warehouse'

  const [phase,      setPhase]      = useState<Phase>('loading')
  const [bags,       setBags]       = useState<AcceptedBag[]>([])
  const [scannerKey, setScannerKey] = useState(0)
  const [scannedQr,  setScannedQr]  = useState<string | null>(null)
  const [toast,      setToast]      = useState<string | null>(null)
  const [toastColor, setToastColor] = useState('#00c8ff')
  const [errorMsg,   setErrorMsg]   = useState<string | null>(null)
  const permDenied = useRef(false)

  const checkedCount = bags.filter(b => b.checkedIn).length
  const totalCount   = bags.length
  const allCheckedIn = totalCount > 0 && checkedCount === totalCount

  // ── Load accepted bags ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!routeId) {
      setErrorMsg('No route ID provided. Return to route and try again.')
      setPhase('error')
      return
    }

    async function load() {
      const { data, error } = await supabase
        .from('driver_bag_scans')
        .select('bag_qr_code, stop_id, stop_address')
        .eq('route_id', routeId)
        .eq('final_decision', 'accepted')
        .order('scanned_at', { ascending: true })

      if (error) {
        console.error('[WarehouseCheckin] load error:', error)
        setErrorMsg('Failed to load bag list. Please check connection and try again.')
        setPhase('error')
        return
      }

      // De-duplicate by bag_qr_code (safety net — shouldn't normally happen)
      const seen = new Set<string>()
      const accepted: AcceptedBag[] = []
      for (const row of data ?? []) {
        if (!seen.has(row.bag_qr_code)) {
          seen.add(row.bag_qr_code)
          accepted.push({
            bag_qr_code:  row.bag_qr_code,
            stop_id:      row.stop_id     ?? null,
            stop_address: row.stop_address ?? null,
            checkedIn:    false,
          })
        }
      }

      setBags(accepted)
      setPhase('qr-scanning')
    }

    load()
  }, [routeId])

  // ── Auto-navigate after celebration ───────────────────────────────────────

  useEffect(() => {
    if (phase !== 'submitted') return
    const timer = setTimeout(() => navigate('/dashboard/driver', { replace: true }), 4000)
    return () => clearTimeout(timer)
  }, [phase, navigate])

  // ── Toast helper ──────────────────────────────────────────────────────────

  function showToast(msg: string, color = '#00c8ff', ms = 2500) {
    setToast(msg)
    setToastColor(color)
    setTimeout(() => setToast(null), ms)
  }

  // ── Warehouse QR scan handler ─────────────────────────────────────────────

  function handleWarehouseScan(value: string) {
    const cleaned = value.trim().toUpperCase()
    if (cleaned === warehouseCode.toUpperCase()) {
      setPhase('bag-checkin')
    } else {
      setScannedQr(cleaned)
      setPhase('qr-mismatch')
    }
  }

  // ── Bag QR scan handler ───────────────────────────────────────────────────

  function handleBagScan(value: string) {
    const code = value.trim().toUpperCase()

    const existing = bags.find(b => b.bag_qr_code.toUpperCase() === code)

    if (existing?.checkedIn) {
      showToast('⚠️ Already checked in!', '#fbbf24')
      setScannerKey(k => k + 1)
      return
    }

    if (!existing) {
      showToast('❌ Bag not on your route!', '#f87171')
      setScannerKey(k => k + 1)
      return
    }

    setBags(prev =>
      prev.map(b => b.bag_qr_code.toUpperCase() === code ? { ...b, checkedIn: true } : b)
    )
    showToast(`✅ ${code} checked in!`, '#22c55e')
    setScannerKey(k => k + 1)
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!user?.id || !routeId) return
    setPhase('submitting')

    try {
      // 1. Create check-in session record
      const { data: session, error: sessionErr } = await supabase
        .from('warehouse_checkin_sessions')
        .insert({
          route_id:        routeId,
          driver_id:       user.id,
          warehouse_code:  warehouseCode,
          warehouse_name:  warehouseName,
          total_bags:      totalCount,
          checked_in_bags: checkedCount,
          status:          'completed',
          completed_at:    new Date().toISOString(),
        })
        .select('id')
        .single()

      if (sessionErr) throw sessionErr

      // 2. Insert one record per scanned bag
      const bagInserts = bags
        .filter(b => b.checkedIn)
        .map(b => ({
          session_id:  session.id,
          driver_id:   user.id,
          route_id:    routeId,
          stop_id:     b.stop_id ?? null,
          bag_qr_code: b.bag_qr_code,
        }))

      if (bagInserts.length > 0) {
        const { error: bagsErr } = await supabase
          .from('warehouse_bag_scans')
          .insert(bagInserts)
        if (bagsErr) console.error('[WarehouseCheckin] bag inserts error:', bagsErr)
      }

      // 3. Mark route complete + clear driver status
      await completeRoute(routeId, user.id)

      // 4. Clear Zustand store so dashboard doesn't show stale route
      setActiveRoute(null)
      setActiveRouteStops([])

      setPhase('submitted')
    } catch (err) {
      console.error('[WarehouseCheckin] submit error:', err)
      setErrorMsg('Failed to submit check-in. Please check connection and try again.')
      setPhase('error')
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const headerTitle =
    phase === 'loading'     ? '⏳ Loading…'          :
    phase === 'qr-scanning' ||
    phase === 'qr-mismatch' ? '🏭 Arrive at Warehouse' :
    phase === 'bag-checkin' ? '📦 Bag Check-In'       :
    phase === 'submitting'  ? '⏳ Submitting…'         :
    phase === 'submitted'   ? '🎉 Route Complete!'     :
                              '⚠️ Error'

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0a0e1a', color: '#ffffff' }}>
      <style>{`
        @keyframes fadeSlideUp  { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes resultBounce { 0%{transform:scale(0.5);opacity:0} 60%{transform:scale(1.15)} 100%{transform:scale(1);opacity:1} }
        @keyframes spin         { to{transform:rotate(360deg)} }
      `}</style>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-4 py-4 shrink-0"
        style={{ background: 'rgba(0,0,0,0.4)', borderBottom: '1px solid rgba(0,190,255,0.15)' }}
      >
        {phase !== 'submitting' && phase !== 'submitted' && (
          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center rounded-xl shrink-0"
            style={{ width: 36, height: 36, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
            aria-label="Back"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5" strokeLinecap="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        )}

        <div className="flex-1 min-w-0">
          <h1 style={{ fontSize: 16, fontWeight: 700, color: '#ffffff' }}>{headerTitle}</h1>
          {warehouseName && phase !== 'loading' && (
            <p style={{ fontSize: 11, color: '#fbbf24', marginTop: 1 }}>{warehouseName}</p>
          )}
        </div>

        {/* Bag counter badge — shown during check-in */}
        {phase === 'bag-checkin' && (
          <div
            className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 shrink-0"
            style={{
              background: allCheckedIn ? 'rgba(34,197,94,0.15)' : 'rgba(0,200,255,0.1)',
              border:     `1px solid ${allCheckedIn ? 'rgba(34,197,94,0.3)' : 'rgba(0,200,255,0.25)'}`,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: allCheckedIn ? '#22c55e' : '#00c8ff' }}>
              {checkedCount} / {totalCount}
            </span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>bags</span>
          </div>
        )}
      </div>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-5 py-5" style={{ animation: 'fadeSlideUp 0.3s ease both' }}>

        {/* Loading */}
        {phase === 'loading' && (
          <div className="flex flex-col items-center gap-4 mt-16">
            <div
              className="w-10 h-10 rounded-full border-4"
              style={{ borderColor: 'rgba(0,200,255,0.2)', borderTopColor: '#00c8ff', animation: 'spin 0.8s linear infinite' }}
            />
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>Loading your bags…</p>
          </div>
        )}

        {/* Warehouse QR scan */}
        {phase === 'qr-scanning' && (
          <div className="space-y-4">
            <div
              className="rounded-2xl px-4 py-3.5 flex items-center gap-3"
              style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)' }}
            >
              <span style={{ fontSize: 22 }}>🏭</span>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#fbbf24' }}>Scan the warehouse QR code</p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
                  Find the QR code at the warehouse entrance or reception
                </p>
              </div>
            </div>

            <QrScanner
              key={`wh-${scannerKey}`}
              onScan={handleWarehouseScan}
              onPermissionDenied={() => {
                permDenied.current = true
                showToast('Camera permission denied — cannot scan', '#f87171', 5000)
              }}
            />

            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
              Expected code:{' '}
              <span style={{ color: 'rgba(255,255,255,0.55)', fontFamily: 'monospace' }}>
                {warehouseCode}
              </span>
            </p>
          </div>
        )}

        {/* QR mismatch */}
        {phase === 'qr-mismatch' && (
          <div className="space-y-4 mt-4">
            <div
              className="rounded-2xl px-4 py-5 space-y-3"
              style={{ background: 'rgba(255,23,68,0.08)', border: '1px solid rgba(255,23,68,0.3)' }}
            >
              <p style={{ fontSize: 17, fontWeight: 700, color: '#f87171' }}>❌ Wrong Warehouse</p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
                The QR code you scanned doesn't match this warehouse. Make sure you're at the correct drop-off location.
              </p>
              <div className="space-y-1 pt-1">
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                  Expected:{' '}
                  <span style={{ color: '#fbbf24', fontFamily: 'monospace', fontWeight: 700 }}>
                    {warehouseCode}
                  </span>
                </p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                  Scanned:{'  '}
                  <span style={{ color: '#f87171', fontFamily: 'monospace', fontWeight: 700 }}>
                    {scannedQr}
                  </span>
                </p>
              </div>
            </div>

            <button
              onClick={() => { setScannerKey(k => k + 1); setPhase('qr-scanning') }}
              className="w-full rounded-2xl py-4 text-sm font-bold transition-all hover:brightness-110 active:scale-[0.98]"
              style={{ background: 'rgba(0,200,255,0.1)', border: '1px solid rgba(0,200,255,0.35)', color: '#00c8ff' }}
            >
              🔄 Try Again
            </button>
          </div>
        )}

        {/* Bag check-in */}
        {phase === 'bag-checkin' && (
          <div className="space-y-4">
            {/* Live scanner */}
            <div>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>
                Scan each collected bag's QR code to check it in
              </p>
              <QrScanner
                key={`bag-${scannerKey}`}
                onScan={handleBagScan}
                onPermissionDenied={() => showToast('Camera permission denied', '#f87171', 5000)}
              />
            </div>

            {/* Bag list */}
            <div className="space-y-2">
              <p style={{ fontSize: 11, color: '#00c8ff', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Collected Bags
              </p>

              {bags.length === 0 ? (
                <div
                  className="rounded-xl px-4 py-4 text-center"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                    No accepted bags found for this route
                  </p>
                </div>
              ) : (
                bags.map(bag => (
                  <div
                    key={bag.bag_qr_code}
                    className="rounded-xl px-4 py-3 flex items-center gap-3"
                    style={{
                      background:  bag.checkedIn ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.04)',
                      border:      `1px solid ${bag.checkedIn ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.1)'}`,
                      transition:  'all 0.25s ease',
                    }}
                  >
                    {/* Checkbox circle */}
                    <div
                      className="shrink-0 flex items-center justify-center rounded-full"
                      style={{
                        width: 28, height: 28,
                        background: bag.checkedIn ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.06)',
                        border: `1.5px solid ${bag.checkedIn ? '#22c55e' : 'rgba(255,255,255,0.2)'}`,
                      }}
                    >
                      {bag.checkedIn ? (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      ) : (
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(255,255,255,0.2)' }} />
                      )}
                    </div>

                    {/* Bag info */}
                    <div className="flex-1 min-w-0">
                      <p style={{
                        fontSize: 13, fontFamily: 'monospace', fontWeight: 600,
                        color: bag.checkedIn ? '#22c55e' : '#ffffff',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {bag.bag_qr_code}
                      </p>
                      {bag.stop_address && (
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {bag.stop_address}
                        </p>
                      )}
                    </div>

                    <span style={{ fontSize: 11, fontWeight: 600, flexShrink: 0, color: bag.checkedIn ? '#22c55e' : 'rgba(255,255,255,0.25)' }}>
                      {bag.checkedIn ? 'In ✓' : 'Pending'}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Progress reminder */}
            {!allCheckedIn && totalCount > 0 && (
              <div
                className="rounded-xl px-4 py-3 text-center"
                style={{ background: 'rgba(0,200,255,0.05)', border: '1px solid rgba(0,200,255,0.15)' }}
              >
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
                  {totalCount - checkedCount} bag{totalCount - checkedCount !== 1 ? 's' : ''} remaining — scan to continue
                </p>
              </div>
            )}

            {/* Submit button — only visible once all bags are checked in */}
            {allCheckedIn && (
              <button
                onClick={handleSubmit}
                className="w-full rounded-2xl py-4 text-sm font-bold text-white transition-all hover:brightness-110 active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg,#0d9e3e,#22c55e)', boxShadow: '0 4px 24px rgba(34,197,94,0.35)', marginTop: 4 }}
              >
                ✅ Submit Check-In — Complete Route
              </button>
            )}
          </div>
        )}

        {/* Submitting */}
        {phase === 'submitting' && (
          <div className="flex flex-col items-center gap-5 mt-16">
            <div
              className="w-12 h-12 rounded-full border-4"
              style={{ borderColor: 'rgba(34,197,94,0.2)', borderTopColor: '#22c55e', animation: 'spin 0.8s linear infinite' }}
            />
            <p style={{ fontSize: 15, fontWeight: 600, color: '#ffffff' }}>Submitting check-in…</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
              Saving {checkedCount} bag{checkedCount !== 1 ? 's' : ''} · Completing route
            </p>
          </div>
        )}

        {/* Submitted / Celebration */}
        {phase === 'submitted' && (
          <div className="flex flex-col items-center gap-5 mt-8 text-center">
            <div style={{ fontSize: 72, animation: 'resultBounce 0.6s ease both' }}>🎉</div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: '#22c55e' }}>Route Complete!</h2>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, maxWidth: 280 }}>
              All {totalCount} bag{totalCount !== 1 ? 's' : ''} checked in at {warehouseName}. Great work today!
            </p>
            <div
              className="rounded-2xl px-6 py-4 w-full"
              style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)' }}
            >
              <p style={{ fontSize: 13, color: '#22c55e', fontWeight: 600 }}>✅ {checkedCount} bag{checkedCount !== 1 ? 's' : ''} delivered</p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>Returning to dashboard in a few seconds…</p>
            </div>
            <button
              onClick={() => navigate('/dashboard/driver', { replace: true })}
              className="w-full rounded-2xl py-4 text-sm font-bold text-white transition-all hover:brightness-110 active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg,#0d9e3e,#22c55e)' }}
            >
              Go to Dashboard →
            </button>
          </div>
        )}

        {/* Error */}
        {phase === 'error' && (
          <div className="space-y-4 mt-4">
            <div
              className="rounded-2xl px-4 py-5"
              style={{ background: 'rgba(255,23,68,0.08)', border: '1px solid rgba(255,23,68,0.3)' }}
            >
              <p style={{ fontSize: 17, fontWeight: 700, color: '#f87171' }}>⚠️ Something went wrong</p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 8, lineHeight: 1.5 }}>
                {errorMsg ?? 'An unexpected error occurred.'}
              </p>
            </div>
            <button
              onClick={() => navigate('/dashboard/driver/route-map', { replace: true })}
              className="w-full rounded-2xl py-4 text-sm font-bold transition-all hover:brightness-110 active:scale-[0.98]"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)' }}
            >
              ← Back to Route
            </button>
          </div>
        )}
      </div>

      {/* ── Toast ────────────────────────────────────────────────────────────── */}
      {toast && (
        <div
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-sm font-semibold"
          style={{
            background:     `${toastColor}22`,
            border:         `1px solid ${toastColor}55`,
            color:           toastColor,
            backdropFilter: 'blur(12px)',
            whiteSpace:     'nowrap',
            boxShadow:      '0 4px 24px rgba(0,0,0,0.4)',
          }}
        >
          {toast}
        </div>
      )}
    </div>
  )
}
