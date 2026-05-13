import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuthStore } from '../../store/authStore'

type Notif = {
  id:         string
  type:       string
  title:      string
  body:       string | null
  read:       boolean
  read_at:    string | null
  created_at: string
  priority:   string
}

const TYPE_META: Record<string, { icon: string; color: string; bg: string; border: string }> = {
  fundraiser: { icon: '🌱', color: '#4ade80', bg: 'rgba(74,222,128,0.1)',   border: 'rgba(74,222,128,0.25)'  },
  payout:     { icon: '💳', color: '#00c8ff', bg: 'rgba(0,200,255,0.1)',    border: 'rgba(0,200,255,0.25)'   },
  alert:      { icon: '🚨', color: '#f87171', bg: 'rgba(248,113,113,0.1)',  border: 'rgba(248,113,113,0.25)' },
  bag_update: { icon: '📦', color: '#5eead4', bg: 'rgba(94,234,212,0.1)',   border: 'rgba(94,234,212,0.25)'  },
  inspection: { icon: '🔍', color: '#a78bfa', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.25)' },
  fraud:      { icon: '⚠️', color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',   border: 'rgba(251,191,36,0.25)'  },
  driver:     { icon: '🚗', color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',   border: 'rgba(251,191,36,0.25)'  },
  system:     { icon: '⚙️', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.25)' },
}

function typeMeta(type: string) {
  return TYPE_META[type] ?? TYPE_META.system
}

function timeAgo(ts: string): string {
  const secs = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (secs < 30)  return 'Just now'
  if (secs < 90)  return '1 min ago'
  const mins = Math.floor(secs / 60)
  if (mins < 60)  return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `${hrs} hr ago`
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function LiveNotificationsPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [animate, setAnimate]       = useState(false)
  const [notifications, setNotifs]  = useState<Notif[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [markingAll, setMarkingAll] = useState(false)

  useEffect(() => {
    const f = requestAnimationFrame(() => setAnimate(true))
    return () => cancelAnimationFrame(f)
  }, [])

  useEffect(() => {
    let mounted = true

    async function load() {
      if (!user) { navigate('/real-login', { replace: true }); return }

      const { data, error: fetchErr } = await supabase
        .from('notifications')
        .select('id, type, title, body, read, read_at, created_at, priority')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (!mounted) return
      if (fetchErr) setError(fetchErr.message)
      else          setNotifs((data ?? []) as Notif[])
      setLoading(false)
    }

    load()
    return () => { mounted = false }
  }, [navigate])

  async function markRead(id: string) {
    await supabase
      .from('notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .eq('id', id)
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  async function markAllRead() {
    const unread = notifications.filter(n => !n.read).map(n => n.id)
    if (unread.length === 0) return
    setMarkingAll(true)
    await supabase
      .from('notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .in('id', unread)
    setNotifs(prev => prev.map(n => ({ ...n, read: true })))
    setMarkingAll(false)
  }

  const unreadCount = notifications.filter(n => !n.read).length

  const fade = (d = 0): React.CSSProperties => ({
    opacity:    animate ? 1 : 0,
    transform:  animate ? 'translateY(0)' : 'translateY(14px)',
    transition: `opacity 0.4s ease ${d}ms, transform 0.4s ease ${d}ms`,
  })

  return (
    <div
      className="relative min-h-screen flex flex-col overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}
    >
      <style>{`@keyframes spinLN { to { transform: rotate(360deg); } }`}</style>
      <div className="pointer-events-none absolute inset-0 grid-bg" />
      <div className="pointer-events-none absolute" style={{ top: -80, left: -60, width: 280, height: 280, background: 'rgba(74,222,128,0.12)', filter: 'blur(72px)', borderRadius: '50%' }} />
      <div className="pointer-events-none absolute" style={{ bottom: -40, right: -40, width: 220, height: 220, background: 'rgba(0,200,255,0.07)', filter: 'blur(60px)', borderRadius: '50%' }} />

      {/* Header */}
      <header
        className="relative flex items-center justify-between px-4 py-3"
        style={{ background: 'rgba(4,10,24,0.92)', borderBottom: '1px solid rgba(0,200,255,0.12)', backdropFilter: 'blur(12px)', zIndex: 2 }}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl font-extrabold" style={{ color: '#00c8ff' }}>BayKid</span>
          <span style={{ color: 'rgba(0,200,255,0.3)' }}>|</span>
          <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>Notifications</span>
          {unreadCount > 0 && (
            <span
              className="flex items-center justify-center min-w-[18px] h-[18px] rounded-full px-1 text-[10px] font-bold"
              style={{ background: '#f87171', color: '#ffffff' }}
            >
              {unreadCount}
            </span>
          )}
        </div>
        <Link to="/live-dashboard" className="text-sm transition-opacity hover:opacity-70" style={{ color: 'rgba(255,255,255,0.4)' }}>
          ← Dashboard
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
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-extrabold mb-1" style={{ color: '#ffffff' }}>Notifications</h1>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  disabled={markingAll}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all hover:brightness-110"
                  style={{
                    background: 'rgba(0,200,255,0.1)',
                    border:     '1px solid rgba(0,200,255,0.25)',
                    color:      '#00c8ff',
                    cursor:     markingAll ? 'not-allowed' : 'pointer',
                    opacity:    markingAll ? 0.6 : 1,
                  }}
                >
                  {markingAll ? 'Marking…' : 'Mark all read'}
                </button>
              )}
            </div>
            {unreadCount > 0 && (
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
                {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center gap-3 py-12 justify-center" style={fade(60)}>
              <span className="w-5 h-5 rounded-full border-2" style={{ borderColor: 'rgba(0,200,255,0.2)', borderTopColor: '#00c8ff', animation: 'spinLN 0.7s linear infinite' }} />
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Loading notifications…</span>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="rounded-xl px-4 py-3 mb-4 text-sm" style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', ...fade(60) }}>
              Could not load notifications: {error}
            </div>
          )}

          {/* Empty */}
          {!loading && !error && notifications.length === 0 && (
            <div className="rounded-2xl p-10 text-center mb-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', ...fade(60) }}>
              <span style={{ fontSize: 42, display: 'block', marginBottom: 12 }}>🔔</span>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#ffffff', marginBottom: 6 }}>No notifications yet</p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                Activity from donations, scans, and alerts will appear here.
              </p>
            </div>
          )}

          {/* Notification list */}
          {!loading && notifications.length > 0 && (
            <div className="flex flex-col gap-2" style={fade(80)}>
              {notifications.map(n => {
                const meta    = typeMeta(n.type)
                const isUnread = !n.read
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => { if (isUnread) markRead(n.id) }}
                    className="text-left w-full rounded-2xl p-4 transition-all hover:brightness-110"
                    style={{
                      background: isUnread ? meta.bg : 'rgba(255,255,255,0.03)',
                      border:     `1px solid ${isUnread ? meta.border : 'rgba(255,255,255,0.08)'}`,
                      cursor:     isUnread ? 'pointer' : 'default',
                    }}
                  >
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <span
                        className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0 text-lg"
                        style={{ background: meta.bg, border: `1px solid ${meta.border}` }}
                      >
                        {meta.icon}
                      </span>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p style={{ fontSize: 13, fontWeight: isUnread ? 700 : 600, color: isUnread ? '#ffffff' : 'rgba(255,255,255,0.65)' }}>
                            {n.title}
                          </p>
                          {isUnread && (
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: meta.color, flexShrink: 0, display: 'inline-block' }} />
                          )}
                        </div>
                        {n.body && (
                          <p style={{ fontSize: 11, color: isUnread ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.38)', lineHeight: 1.5, marginBottom: 4 }}>
                            {n.body}
                          </p>
                        )}
                        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
                          {timeAgo(n.created_at)}
                          {isUnread && <span style={{ color: meta.color, marginLeft: 6, fontWeight: 600 }}>· Tap to mark read</span>}
                        </p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {/* Back nav */}
          <div className="mt-6 flex flex-col gap-2" style={fade(200)}>
            <Link
              to="/live-wallet"
              className="w-full flex items-center justify-center py-3 rounded-2xl text-sm font-semibold transition-all hover:brightness-110"
              style={{ background: 'rgba(94,234,212,0.08)', border: '1px solid rgba(94,234,212,0.2)', color: '#5eead4', textDecoration: 'none' }}
            >
              💳 Live Wallet
            </Link>
            <Link
              to="/live-dashboard"
              className="w-full flex items-center justify-center py-3 rounded-2xl text-sm font-medium transition-all hover:brightness-110"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}
            >
              ← Back to Dashboard
            </Link>
          </div>

        </div>
      </div>
    </div>
  )
}
