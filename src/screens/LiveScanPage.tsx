import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

// Real DB table: `bags`      columns: id, bag_code, status, consumer_id
// Real DB table: `bag_scans` columns: id, bag_id, scanned_by, location, scan_time, fundraiser_id (Phase 3)

type ScanMode = 'personal' | 'fundraiser'

type JoinedFundraiser = { id: string; name: string }

type MembershipRow = {
  fundraiser_id: string
  fundraisers: {
    id:         string
    name:       string
    status:     string
    start_date: string | null
    end_date:   string | null
  } | null
}

export default function LiveScanPage() {
  const navigate = useNavigate()

  const [animate, setAnimate]                     = useState(false)
  const [bagCode, setBagCode]                     = useState('')
  // Auto-set to 'fundraiser' when navigated from fundraiser list via "Donate Bags"
  const [scanMode, setScanMode]                   = useState<ScanMode>(() => {
    const stored = localStorage.getItem('live_scan_mode')
    if (stored === 'fundraiser') {
      localStorage.removeItem('live_scan_mode')
      return 'fundraiser'
    }
    return 'personal'
  })
  const [loading, setLoading]                     = useState(false)
  const [error, setError]                         = useState<string | null>(null)
  const [saved, setSaved]                         = useState(false)

  // Fundraiser picker state
  const [userId, setUserId]                       = useState<string | null>(null)
  const [fundraiserId, setFundraiserId]           = useState<string | null>(null)
  const [joinedFundraisers, setJoinedFundraisers] = useState<JoinedFundraiser[]>([])
  const [fundraisersLoading, setFundraisersLoading] = useState(false)
  // ID pre-selected from fundraiser list; consumed on first fundraiser load
  const [prefillFundraiserId]                     = useState<string | null>(() => {
    const id = localStorage.getItem('selected_live_fundraiser_id')
    if (id) localStorage.removeItem('selected_live_fundraiser_id')
    return id
  })

  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimate(true))
    return () => cancelAnimationFrame(id)
  }, [])

  // Fetch current user ID on mount (needed for fundraiser dropdown)
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id)
    })
  }, [])

  // Fetch joined active fundraisers when mode switches to fundraiser
  useEffect(() => {
    if (scanMode !== 'fundraiser' || !userId) {
      setJoinedFundraisers([])
      setFundraiserId(null)
      setFundraisersLoading(false)
      return
    }

    let mounted = true
    setFundraisersLoading(true)

    supabase
      .from('fundraiser_members')
      .select('fundraiser_id, fundraisers(id, name, status, start_date, end_date)')
      .eq('user_id', userId)
      .then(({ data }) => {
        if (!mounted) return
        const today = new Date().toISOString().split('T')[0]
        const rows  = (data ?? []) as unknown as MembershipRow[]
        const active = rows
          .filter(m => {
            const f = m.fundraisers
            if (!f || f.status !== 'active') return false
            if (f.start_date && today < f.start_date) return false
            if (f.end_date   && today > f.end_date)   return false
            return true
          })
          .map(m => ({ id: m.fundraisers!.id, name: m.fundraisers!.name }))
        setJoinedFundraisers(active)
        // Auto-select: prefer the pre-chosen fundraiser; fallback to single-item
        const prefill = prefillFundraiserId && active.find(f => f.id === prefillFundraiserId)
        if (prefill)              setFundraiserId(prefill.id)
        else if (active.length === 1) setFundraiserId(active[0].id)
        setFundraisersLoading(false)
      })

    return () => { mounted = false }
  }, [scanMode, userId])

  const fade = (d = 0): React.CSSProperties => ({
    opacity:    animate ? 1 : 0,
    transform:  animate ? 'translateY(0)' : 'translateY(14px)',
    transition: `opacity 0.4s ease ${d}ms, transform 0.4s ease ${d}ms`,
  })

  async function handleSave() {
    const code = bagCode.trim().toUpperCase()
    if (!code) { setError('Enter a bag code first.'); return }

    if (scanMode === 'fundraiser' && joinedFundraisers.length > 0 && !fundraiserId) {
      setError('Select a fundraiser to donate this bag to.')
      return
    }

    setError(null)
    setLoading(true)

    const { data: { user }, error: userErr } = await supabase.auth.getUser()
    if (userErr || !user) {
      setError('Not authenticated. Please sign in.')
      setLoading(false)
      return
    }

    // 1. Look up or create the bag
    let bagId: string

    const { data: existing, error: lookupErr } = await supabase
      .from('qr_bags')
      .select('id, consumer_id')
      .eq('bag_code', code)
      .maybeSingle()

    if (lookupErr) {
      setError(`Bag lookup failed: ${lookupErr.message}`)
      setLoading(false)
      return
    }

    if (existing) {
      bagId = existing.id
    } else {
      const { data: created, error: createErr } = await supabase
        .from('qr_bags')
        .insert({ bag_code: code, consumer_id: user.id, status: 'pending' })
        .select('id')
        .single()

      if (createErr || !created) {
        setError(`Could not register bag: ${createErr?.message ?? 'Unknown error'}`)
        setLoading(false)
        return
      }
      bagId = created.id
    }

    // 2. Insert scan — include fundraiser_id when in fundraiser mode
    const scanRow: Record<string, unknown> = {
      bag_id:     bagId,
      scanned_by: user.id,
      location:   scanMode,
    }
    if (scanMode === 'fundraiser' && fundraiserId) {
      scanRow.fundraiser_id = fundraiserId
    }

    const { data: scan, error: scanErr } = await supabase
      .from('bag_scans')
      .insert(scanRow)
      .select('id')
      .single()

    if (scanErr || !scan) {
      setError(`Could not save scan: ${scanErr?.message ?? 'Unknown error'}`)
      setLoading(false)
      return
    }

    // 3. Persist IDs for inspection page
    localStorage.setItem('live_scan_id', scan.id)
    localStorage.setItem('live_bag_id', bagId)

    if (scanMode === 'fundraiser' && fundraiserId) {
      const fname = joinedFundraisers.find(f => f.id === fundraiserId)?.name ?? ''
      localStorage.setItem('live_fundraiser_id',   fundraiserId)
      localStorage.setItem('live_fundraiser_name', fname)
    } else {
      localStorage.removeItem('live_fundraiser_id')
      localStorage.removeItem('live_fundraiser_name')
    }

    setSaved(true)
    setTimeout(() => navigate('/live-inspection'), 700)
  }

  const inputStyle: React.CSSProperties = {
    width:         '100%',
    padding:       '14px 16px',
    borderRadius:  16,
    background:    'rgba(255,255,255,0.06)',
    border:        '1px solid rgba(0,200,255,0.22)',
    color:         '#ffffff',
    fontSize:      16,
    fontWeight:    700,
    letterSpacing: '0.06em',
    outline:       'none',
  }

  return (
    <div
      className="relative min-h-screen flex flex-col overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}
    >
      <style>{`
        @keyframes spinLS { to { transform: rotate(360deg); } }
        @keyframes lsPop  { from { transform: scale(0.92); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      `}</style>

      <div className="pointer-events-none absolute inset-0 grid-bg" />
      <div className="pointer-events-none absolute" style={{ top: -80, left: -60, width: 280, height: 280, background: 'rgba(0,87,231,0.22)', filter: 'blur(72px)', borderRadius: '50%' }} />
      <div className="pointer-events-none absolute" style={{ bottom: -40, right: -40, width: 220, height: 220, background: 'rgba(0,200,255,0.09)', filter: 'blur(60px)', borderRadius: '50%' }} />

      {/* Header */}
      <header
        className="relative flex items-center justify-between px-4 py-3"
        style={{ background: 'rgba(4,10,24,0.92)', borderBottom: '1px solid rgba(0,200,255,0.12)', backdropFilter: 'blur(12px)', zIndex: 2 }}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl font-extrabold" style={{ color: '#00c8ff' }}>BayKid</span>
          <span style={{ color: 'rgba(0,200,255,0.3)' }}>|</span>
          <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>Live Scan</span>
        </div>
        <Link to="/live-dashboard" className="text-sm transition-opacity hover:opacity-70" style={{ color: 'rgba(255,255,255,0.4)' }}>
          ← Dashboard
        </Link>
      </header>

      <div className="relative flex-1 overflow-y-auto pb-24" style={{ zIndex: 1 }}>
        <div className="max-w-[520px] mx-auto px-4 pt-8">

          {/* Heading */}
          <div className="mb-7" style={fade(0)}>
            <span
              className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest mb-3 inline-block"
              style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80' }}
            >
              Live Mode
            </span>
            <h1 className="text-2xl font-extrabold mb-1.5" style={{ color: '#ffffff' }}>Live QR Bag Scan</h1>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Scan or enter a real QR bag code connected to the backend.
            </p>
          </div>

          {/* Bag code input */}
          <div className="mb-5" style={fade(60)}>
            <label
              className="block text-[10px] font-semibold uppercase tracking-widest mb-2"
              style={{ color: 'rgba(255,255,255,0.35)' }}
            >
              Bag Code
            </label>
            <input
              type="text"
              placeholder="CB-NASH-000421"
              value={bagCode}
              onChange={e => setBagCode(e.target.value.toUpperCase())}
              style={inputStyle}
              autoComplete="off"
              spellCheck={false}
            />
            <p className="mt-2 text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
              Format: CB-[CITY]-[6 digits] · New codes are created automatically.
            </p>
          </div>

          {/* Scan mode toggle */}
          <div className="mb-5" style={fade(100)}>
            <label
              className="block text-[10px] font-semibold uppercase tracking-widest mb-2"
              style={{ color: 'rgba(255,255,255,0.35)' }}
            >
              Scan Mode
            </label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: 'personal',   label: '👤 Personal Account',   color: '#00c8ff', bg: 'rgba(0,200,255,0.12)',  border: 'rgba(0,200,255,0.35)'  },
                { value: 'fundraiser', label: '🌱 Fundraiser Donation', color: '#4ade80', bg: 'rgba(74,222,128,0.12)', border: 'rgba(74,222,128,0.35)' },
              ] as const).map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setScanMode(opt.value)}
                  className="py-3.5 px-3 rounded-xl text-xs font-bold transition-all text-center leading-tight"
                  style={{
                    background: scanMode === opt.value ? opt.bg  : 'rgba(255,255,255,0.04)',
                    border:     `1px solid ${scanMode === opt.value ? opt.border : 'rgba(255,255,255,0.1)'}`,
                    color:      scanMode === opt.value ? opt.color : 'rgba(255,255,255,0.35)',
                    cursor:     'pointer',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Fundraiser picker (shown only in fundraiser mode) ── */}
          {scanMode === 'fundraiser' && (
            <div className="mb-5" style={fade(130)}>
              <label
                className="block text-[10px] font-semibold uppercase tracking-widest mb-2"
                style={{ color: 'rgba(255,255,255,0.35)' }}
              >
                Select Fundraiser
              </label>

              {fundraisersLoading ? (
                <div className="flex items-center gap-2 py-3">
                  <span
                    className="w-3.5 h-3.5 rounded-full border-2 shrink-0"
                    style={{ borderColor: 'rgba(74,222,128,0.2)', borderTopColor: '#4ade80', animation: 'spinLS 0.7s linear infinite' }}
                  />
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Loading your fundraisers…</span>
                </div>

              ) : joinedFundraisers.length === 0 ? (
                <div
                  className="rounded-xl px-4 py-3"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 8 }}>
                    You haven't joined any active fundraisers.
                  </p>
                  <Link
                    to="/live-fundraisers"
                    style={{ fontSize: 11, color: '#4ade80', fontWeight: 600, textDecoration: 'none' }}
                  >
                    Browse and join a fundraiser →
                  </Link>
                </div>

              ) : (
                <div className="flex flex-col gap-2">
                  {joinedFundraisers.map(f => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFundraiserId(fundraiserId === f.id ? null : f.id)}
                      className="flex items-center gap-3 p-3 rounded-xl text-left transition-all"
                      style={{
                        background: fundraiserId === f.id ? 'rgba(74,222,128,0.12)' : 'rgba(255,255,255,0.04)',
                        border:     `1px solid ${fundraiserId === f.id ? 'rgba(74,222,128,0.35)' : 'rgba(255,255,255,0.1)'}`,
                        color:      fundraiserId === f.id ? '#4ade80' : 'rgba(255,255,255,0.55)',
                        cursor:     'pointer',
                        width:      '100%',
                      }}
                    >
                      <span style={{ fontSize: 16, flexShrink: 0 }}>🌱</span>
                      <span style={{ fontSize: 12, fontWeight: 600, flex: 1 }}>{f.name}</span>
                      {fundraiserId === f.id && (
                        <span style={{ fontSize: 14 }}>✓</span>
                      )}
                    </button>
                  ))}
                  {!fundraiserId && joinedFundraisers.length > 0 && (
                    <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
                      Tap a fundraiser above to donate this bag.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div
              className="rounded-xl px-4 py-3 mb-4 text-sm"
              style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }}
            >
              {error}
            </div>
          )}

          {/* Success flash */}
          {saved && (
            <div
              className="rounded-xl px-4 py-3 mb-4 text-sm text-center font-semibold"
              style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80', animation: 'lsPop 0.3s ease' }}
            >
              ✓ Scan saved — opening inspection…
            </div>
          )}

          {/* Save button */}
          <button
            type="button"
            onClick={handleSave}
            disabled={loading || saved}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-sm transition-all hover:brightness-110 active:scale-[0.98] mb-6"
            style={{
              background: 'linear-gradient(135deg, #0057e7, #00c8ff)',
              color:      '#ffffff',
              border:     'none',
              cursor:     (loading || saved) ? 'not-allowed' : 'pointer',
              opacity:    (loading || saved) ? 0.75 : 1,
              boxShadow:  '0 4px 24px rgba(0,190,255,0.3)',
              ...fade(160),
            }}
          >
            {loading ? (
              <>
                <span
                  className="w-4 h-4 rounded-full border-2"
                  style={{ borderColor: 'rgba(255,255,255,0.2)', borderTopColor: '#ffffff', animation: 'spinLS 0.7s linear infinite' }}
                />
                Saving scan…
              </>
            ) : '📦 Save Scan → Go to Inspection'}
          </button>

          {/* Info card */}
          <div
            className="rounded-2xl p-4 flex items-start gap-3"
            style={{ background: 'rgba(0,200,255,0.05)', border: '1px solid rgba(0,200,255,0.14)', ...fade(200) }}
          >
            <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>ℹ️</span>
            <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
              <strong style={{ color: 'rgba(255,255,255,0.65)' }}>Saved to Supabase:</strong> one row in{' '}
              <code style={{ color: '#00c8ff' }}>bags</code> (created or reused) and one row in{' '}
              <code style={{ color: '#00c8ff' }}>bag_scans</code>{' '}
              {scanMode === 'fundraiser' && fundraiserId ? (
                <>with <code style={{ color: '#4ade80' }}>fundraiser_id</code> linked.</>
              ) : (
                <>linked to your user ID.</>
              )}
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}
