import { useState, useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuthStore } from '../../store/authStore'
import CashDonateModal from '../../components/CashDonateModal'
import ReportContentButton from '../../components/compliance/ReportContentButton'

type Fundraiser = {
  id:               string
  name:             string
  description:      string | null
  organization:     string | null
  goal_amount:      number
  raised_amount:    number
  bag_count:        number
  percent_to_cause: number
  status:           string
  start_date:       string | null
  end_date:         string | null
  city:             string | null
}

type Membership = {
  id:              string
  bags_donated:    number
  cash_donated:    number
  recycling_value: number
  joined_at:       string
}

function isJoinable(f: Fundraiser): boolean {
  if (f.status !== 'active') return false
  const today = new Date().toISOString().split('T')[0]
  if (f.start_date && today < f.start_date) return false
  if (f.end_date   && today > f.end_date)   return false
  return true
}

export default function LiveFundraiserDetailPage() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const userId   = user?.id ?? null

  const [animate, setAnimate]       = useState(false)
  const [fundraiser, setFundraiser] = useState<Fundraiser | null>(null)
  const [membership, setMembership] = useState<Membership | null>(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [joining, setJoining]       = useState(false)
  const [joinError, setJoinError]   = useState<string | null>(null)
  const [donateOpen, setDonateOpen] = useState(false)

  useEffect(() => {
    const frame = requestAnimationFrame(() => setAnimate(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    if (!id) return
    let mounted = true

    async function load() {
      if (!user) { navigate('/real-login', { replace: true }); return }

      const [fRes, mRes] = await Promise.all([
        supabase
          .from('fundraisers')
          .select('id, name, description, organization, goal_amount, raised_amount, bag_count, percent_to_cause, status, start_date, end_date, city')
          .eq('id', id)
          .maybeSingle(),
        supabase
          .from('fundraiser_members')
          .select('id, bags_donated, cash_donated, recycling_value, joined_at')
          .eq('fundraiser_id', id)
          .eq('user_id', user.id)
          .maybeSingle(),
      ])

      if (!mounted) return

      if (fRes.error || !fRes.data) {
        setError(fRes.error?.message ?? 'Fundraiser not found.')
      } else {
        setFundraiser(fRes.data as Fundraiser)
      }
      if (mRes.data) setMembership(mRes.data as Membership)
      setLoading(false)
    }

    load()
    return () => { mounted = false }
  }, [id, navigate])

  const fade = (d = 0): React.CSSProperties => ({
    opacity:    animate ? 1 : 0,
    transform:  animate ? 'translateY(0)' : 'translateY(14px)',
    transition: `opacity 0.4s ease ${d}ms, transform 0.4s ease ${d}ms`,
  })

  async function handleJoin() {
    if (!fundraiser || !userId) return
    setJoinError(null)
    setJoining(true)

    const { data, error: joinErr } = await supabase
      .from('fundraiser_members')
      .insert({ fundraiser_id: fundraiser.id, user_id: userId, bags_donated: 0, cash_donated: 0, recycling_value: 0 })
      .select('id, bags_donated, cash_donated, recycling_value, joined_at')
      .single()

    if (joinErr) {
      setJoinError(`Could not join: ${joinErr.message}`)
    } else if (data) {
      setMembership(data as Membership)
    }
    setJoining(false)
  }

  function handleDonateSuccess(amount: number) {
    setFundraiser(prev => prev ? { ...prev, raised_amount: prev.raised_amount + amount } : prev)
  }

  const pct = fundraiser && fundraiser.goal_amount > 0
    ? Math.min(100, Math.round((fundraiser.raised_amount / fundraiser.goal_amount) * 100))
    : 0

  return (
    <div
      className="relative min-h-screen flex flex-col overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}
    >
      <style>{`
        @keyframes spinFD { to { transform: rotate(360deg); } }
        @keyframes fdPop  { from { transform: scale(0.92); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      `}</style>
      <div className="pointer-events-none absolute inset-0 grid-bg" />
      <div className="pointer-events-none absolute" style={{ top: -80, left: -60, width: 280, height: 280, background: 'rgba(0,200,128,0.18)', filter: 'blur(72px)', borderRadius: '50%' }} />

      {/* Header */}
      <header
        className="relative flex items-center justify-between px-4 py-3"
        style={{ background: 'rgba(4,10,24,0.92)', borderBottom: '1px solid rgba(0,200,255,0.12)', backdropFilter: 'blur(12px)', zIndex: 2 }}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl font-extrabold" style={{ color: '#00c8ff' }}>Cyan&#39;s Brooklynn</span>
          <span style={{ color: 'rgba(0,200,255,0.3)' }}>|</span>
          <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>Fundraiser</span>
        </div>
        <Link to="/live-fundraisers" className="text-sm transition-opacity hover:opacity-70" style={{ color: 'rgba(255,255,255,0.4)' }}>
          ← Fundraisers
        </Link>
      </header>

      {donateOpen && fundraiser && userId && (
        <CashDonateModal
          fundraiserId={fundraiser.id}
          fundraiserName={fundraiser.name}
          userId={userId}
          onClose={() => setDonateOpen(false)}
          onSuccess={handleDonateSuccess}
        />
      )}

      <div className="relative flex-1 overflow-y-auto pb-24" style={{ zIndex: 1 }}>
        <div className="max-w-[520px] mx-auto px-4 pt-8">

          {/* Loading */}
          {loading && (
            <div className="flex items-center gap-3 py-12 justify-center" style={fade(0)}>
              <span
                className="w-5 h-5 rounded-full border-2"
                style={{ borderColor: 'rgba(74,222,128,0.2)', borderTopColor: '#4ade80', animation: 'spinFD 0.7s linear infinite' }}
              />
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Loading fundraiser…</span>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div
              className="rounded-xl px-4 py-3 mb-4 text-sm"
              style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }}
            >
              {error}
              <Link to="/live-fundraisers" className="block mt-2 font-semibold" style={{ color: '#00c8ff' }}>
                ← Back to Fundraisers
              </Link>
            </div>
          )}

          {!loading && fundraiser && (
            <>
              {/* Heading */}
              <div className="mb-5" style={fade(0)}>
                <span
                  className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest mb-3 inline-block"
                  style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80' }}
                >
                  Live Mode
                </span>
                <h1 className="text-2xl font-extrabold mb-1 leading-tight" style={{ color: '#ffffff' }}>
                  {fundraiser.name}
                </h1>
                {(fundraiser.organization || fundraiser.city) && (
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 3 }}>
                    {[fundraiser.organization, fundraiser.city].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>

              {/* Description (user-generated content — reportable per Apple 1.2) */}
              {fundraiser.description && (
                <div
                  className="rounded-2xl p-4 mb-5"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', ...fade(60) }}
                >
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.65 }}>
                    {fundraiser.description}
                  </p>
                  <div className="mt-3 flex justify-end">
                    <ReportContentButton
                      contentType="fundraiser"
                      contentId={fundraiser.id}
                      variant="inline"
                    />
                  </div>
                </div>
              )}

              {/* Stats card */}
              <div
                className="rounded-2xl p-5 mb-5"
                style={{ background: 'rgba(0,87,231,0.1)', border: '1px solid rgba(0,200,255,0.22)', ...fade(100) }}
              >
                {/* Progress bar */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>Campaign Progress</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: '#4ade80' }}>{pct}%</span>
                  </div>
                  <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 6, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #00c8ff, #4ade80)', borderRadius: 6 }} />
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                      Raised: <strong style={{ color: '#4ade80' }}>${fundraiser.raised_amount.toFixed(2)}</strong>
                    </span>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                      Goal: ${fundraiser.goal_amount.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Meta rows */}
                {[
                  { label: 'Bags Donated',   value: `${fundraiser.bag_count}` },
                  { label: '% to Cause',     value: `${fundraiser.percent_to_cause}%` },
                  { label: 'Campaign Dates', value: [fundraiser.start_date, fundraiser.end_date].filter(Boolean).join(' → ') || '—' },
                  { label: 'Status',         value: fundraiser.status },
                ].map((row, i, arr) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between"
                    style={{ paddingTop: 10, paddingBottom: i < arr.length - 1 ? 10 : 0, borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}
                  >
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)' }}>{row.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#ffffff' }}>{row.value}</span>
                  </div>
                ))}
              </div>

              {/* Join / Membership panel */}
              <div className="mb-5" style={fade(160)}>
                {membership ? (
                  <div
                    className="rounded-2xl p-5 text-center"
                    style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.3)', animation: 'fdPop 0.4s ease' }}
                  >
                    <span style={{ fontSize: 36, display: 'block', marginBottom: 10 }}>🌱</span>
                    <p style={{ fontSize: 15, fontWeight: 800, color: '#4ade80', marginBottom: 4 }}>You're a Member!</p>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 16 }}>
                      Joined {new Date(membership.joined_at).toLocaleDateString()}
                    </p>

                    {/* Contribution stats */}
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      {[
                        { label: 'Bags',      value: `${membership.bags_donated}` },
                        { label: 'Donated',   value: `$${membership.cash_donated.toFixed(2)}` },
                        { label: 'Recycling', value: `$${membership.recycling_value.toFixed(2)}` },
                      ].map(s => (
                        <div
                          key={s.label}
                          className="rounded-xl py-3 px-2 text-center"
                          style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)' }}
                        >
                          <p style={{ fontSize: 16, fontWeight: 800, color: '#4ade80' }}>{s.value}</p>
                          <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</p>
                        </div>
                      ))}
                    </div>

                    <Link
                      to="/live-scan"
                      className="w-full flex items-center justify-center py-3 rounded-xl text-sm font-bold transition-all hover:brightness-110"
                      style={{ background: 'linear-gradient(135deg, #0057e7, #00c8ff)', color: '#ffffff', textDecoration: 'none' }}
                    >
                      📦 Scan a Bag for This Fundraiser
                    </Link>
                  </div>

                ) : isJoinable(fundraiser) ? (
                  <div>
                    {joinError && (
                      <div
                        className="rounded-xl px-4 py-3 mb-3 text-sm"
                        style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }}
                      >
                        {joinError}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={handleJoin}
                      disabled={joining}
                      className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-sm transition-all hover:brightness-110 active:scale-[0.98]"
                      style={{
                        background: 'linear-gradient(135deg, #059669, #4ade80)',
                        color:      '#ffffff',
                        border:     'none',
                        cursor:     joining ? 'not-allowed' : 'pointer',
                        opacity:    joining ? 0.75 : 1,
                        boxShadow:  '0 4px 24px rgba(74,222,128,0.25)',
                      }}
                    >
                      {joining ? (
                        <>
                          <span
                            className="w-4 h-4 rounded-full border-2"
                            style={{ borderColor: 'rgba(255,255,255,0.25)', borderTopColor: '#ffffff', animation: 'spinFD 0.7s linear infinite' }}
                          />
                          Joining…
                        </>
                      ) : '🌱 Join This Fundraiser'}
                    </button>
                    <p className="text-center text-[10px] mt-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      Free to join. Your scanned bags will count toward this campaign.
                    </p>
                  </div>

                ) : (
                  <div
                    className="rounded-2xl px-4 py-5 text-center"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
                      This fundraiser is no longer accepting new members.
                    </p>
                  </div>
                )}
              </div>

              {/* Donate Cash — shown whenever fundraiser is joinable */}
              {isJoinable(fundraiser) && userId && (
                <button
                  type="button"
                  onClick={() => setDonateOpen(true)}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-bold transition-all hover:brightness-110 active:scale-[0.98] mb-3"
                  style={{
                    background: 'rgba(0,200,255,0.08)',
                    border:     '1px solid rgba(0,200,255,0.28)',
                    color:      '#00c8ff',
                    cursor:     'pointer',
                    ...fade(240),
                  }}
                >
                  💰 Donate Cash
                </button>
              )}

              <Link
                to="/live-fundraisers"
                className="w-full flex items-center justify-center py-3 rounded-2xl text-sm font-medium transition-all hover:brightness-110"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', textDecoration: 'none', ...fade(260) }}
              >
                ← Back to Fundraisers
              </Link>
            </>
          )}

        </div>
      </div>
    </div>
  )
}
