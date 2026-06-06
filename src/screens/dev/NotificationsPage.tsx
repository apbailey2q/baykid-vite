import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

// ── Types ──────────────────────────────────────────────────────────────────────

type NotifType   = 'reward' | 'fundraiser' | 'pickup' | 'alert' | 'report'
type NotifStatus = 'Read' | 'Unread'
type FilterTab   = 'All' | 'Rewards' | 'Fundraisers' | 'Pickups' | 'Alerts' | 'Reports'

interface Notification {
  id:      string
  type:    NotifType
  title:   string
  message: string
  time:    string
  icon:    string
  status:  NotifStatus
}

// ── Mock data ──────────────────────────────────────────────────────────────────

const INITIAL: Notification[] = [
  {
    id: 'n-001', type: 'reward', icon: '💰', status: 'Unread',
    title:   'Reward Earned',
    message: 'You earned $2.85 from QR bag CB-NASH-000421.',
    time:    '2 min ago',
  },
  {
    id: 'n-002', type: 'fundraiser', icon: '🏀', status: 'Unread',
    title:   'Fundraiser Contribution',
    message: '$0.85 was donated to East Nashville High Basketball.',
    time:    '5 min ago',
  },
  {
    id: 'n-003', type: 'pickup', icon: '🚚', status: 'Read',
    title:   'Pickup Completed',
    message: 'Your QR bag pickup was completed by the driver.',
    time:    '12 min ago',
  },
  {
    id: 'n-004', type: 'alert', icon: '⚠️', status: 'Unread',
    title:   'Contamination Alert',
    message: 'One bag needs review. Please check recycling tips.',
    time:    '25 min ago',
  },
  {
    id: 'n-005', type: 'report', icon: '📊', status: 'Read',
    title:   'Impact Report Ready',
    message: 'Your May 2026 ESG impact report is ready to view.',
    time:    '1 hr ago',
  },
]

// ── Constants ──────────────────────────────────────────────────────────────────

const TYPE_ROUTES: Record<NotifType, string> = {
  reward:     '/earnings',
  fundraiser: '/my-fundraiser',
  pickup:     '/driver-routes',
  alert:      '/contamination-alerts',
  report:     '/reports',
}

const TYPE_META: Record<NotifType, { color: string; bg: string; border: string; glow: string }> = {
  reward:     { color: '#00c8ff', bg: 'rgba(0,200,255,0.1)',    border: 'rgba(0,200,255,0.28)',   glow: 'rgba(0,200,255,0.07)'   },
  fundraiser: { color: '#4ade80', bg: 'rgba(34,197,94,0.1)',    border: 'rgba(34,197,94,0.28)',   glow: 'rgba(34,197,94,0.06)'   },
  pickup:     { color: '#5eead4', bg: 'rgba(94,234,212,0.1)',   border: 'rgba(94,234,212,0.28)',  glow: 'rgba(94,234,212,0.05)'  },
  alert:      { color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.32)', glow: 'rgba(248,113,113,0.08)' },
  report:     { color: '#c084fc', bg: 'rgba(192,132,252,0.1)',  border: 'rgba(192,132,252,0.28)', glow: 'rgba(192,132,252,0.06)' },
}

const FILTER_TABS: FilterTab[] = ['All', 'Rewards', 'Fundraisers', 'Pickups', 'Alerts', 'Reports']

const TAB_TYPE: Record<FilterTab, NotifType | null> = {
  All:         null,
  Rewards:     'reward',
  Fundraisers: 'fundraiser',
  Pickups:     'pickup',
  Alerts:      'alert',
  Reports:     'report',
}

// ── Notification card ─────────────────────────────────────────────────────────

function NotifCard({
  notif,
  onMarkRead,
}: {
  notif:      Notification
  onMarkRead: (id: string) => void
}) {
  const meta     = TYPE_META[notif.type]
  const isUnread = notif.status === 'Unread'

  return (
    <div
      className="rounded-2xl p-4 transition-all"
      style={{
        background: isUnread ? meta.glow : 'rgba(255,255,255,0.04)',
        border:     `1px solid ${isUnread ? meta.border : 'rgba(255,255,255,0.08)'}`,
        boxShadow:  isUnread ? `0 0 22px ${meta.glow}` : 'none',
      }}
    >
      <div className="flex items-start gap-3">
        {/* Icon with unread badge */}
        <div className="relative shrink-0">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: meta.bg, border: `1px solid ${meta.border}`, fontSize: 22 }}
          >
            {notif.icon}
          </div>
          {isUnread && (
            <div
              className="absolute -top-1 -right-1 w-3 h-3 rounded-full"
              style={{
                background: meta.color,
                boxShadow:  `0 0 6px ${meta.color}`,
                border:     '2px solid #060e24',
              }}
            />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <p
              className="text-sm font-semibold leading-snug"
              style={{ color: isUnread ? '#ffffff' : 'rgba(255,255,255,0.7)' }}
            >
              {notif.title}
            </p>
            <span
              className="text-[10px] shrink-0 font-medium"
              style={{ color: 'rgba(255,255,255,0.28)', marginTop: 1 }}
            >
              {notif.time}
            </span>
          </div>

          <p
            className="text-xs leading-relaxed mb-3"
            style={{ color: isUnread ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.32)' }}
          >
            {notif.message}
          </p>

          {/* Actions row */}
          <div className="flex items-center gap-3">
            <Link
              to={TYPE_ROUTES[notif.type]}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold hover:brightness-110 active:scale-[0.97] transition-all"
              style={{ background: meta.bg, border: `1px solid ${meta.border}`, color: meta.color }}
            >
              View
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>

            {isUnread ? (
              <button
                onClick={() => onMarkRead(notif.id)}
                className="text-[11px] font-medium hover:opacity-60 transition-opacity"
                style={{ color: 'rgba(255,255,255,0.38)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                Mark Read
              </button>
            ) : (
              <span
                className="flex items-center gap-1 text-[10px]"
                style={{ color: 'rgba(255,255,255,0.2)' }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Read
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const [animate,   setAnimate]   = useState(false)
  const [notifs,    setNotifs]    = useState<Notification[]>(INITIAL)
  const [activeTab, setActiveTab] = useState<FilterTab>('All')

  useEffect(() => {
    const t = requestAnimationFrame(() => setAnimate(true))
    return () => cancelAnimationFrame(t)
  }, [])

  const fade = (delay = 0): React.CSSProperties => ({
    opacity:    animate ? 1 : 0,
    transform:  animate ? 'translateY(0)' : 'translateY(14px)',
    transition: `opacity 0.4s ease ${delay}ms, transform 0.4s ease ${delay}ms`,
  })

  const markRead = (id: string) =>
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, status: 'Read' } : n))

  const markAllRead = () =>
    setNotifs(prev => prev.map(n => ({ ...n, status: 'Read' })))

  const totalUnread = notifs.filter(n => n.status === 'Unread').length

  const unreadFor = (tab: FilterTab) => {
    const type = TAB_TYPE[tab]
    return notifs.filter(n => n.status === 'Unread' && (type === null || n.type === type)).length
  }

  const typeFilter = TAB_TYPE[activeTab]
  const filtered   = typeFilter
    ? notifs.filter(n => n.type === typeFilter)
    : notifs

  return (
    <div
      className="relative min-h-screen flex flex-col overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}
    >
      <div className="pointer-events-none absolute inset-0 grid-bg" />
      <div className="pointer-events-none absolute" style={{ top: -80, left: -60, width: 280, height: 280, background: 'rgba(0,87,231,0.26)', filter: 'blur(72px)', borderRadius: '50%' }} />
      <div className="pointer-events-none absolute" style={{ bottom: -60, right: -40, width: 240, height: 240, background: 'rgba(0,200,255,0.14)', filter: 'blur(64px)', borderRadius: '50%' }} />

      <div className="relative flex-1 overflow-y-auto pb-24" style={{ zIndex: 1 }}>
        <div className="max-w-[520px] mx-auto px-4 pt-10 pb-6">

          {/* ── Header ────────────────────────────────────────────────────────── */}
          <div style={fade(0)}>
            <Link
              to="/admin-dashboard"
              className="inline-flex items-center gap-1.5 mb-6 text-xs font-semibold hover:opacity-70 transition-opacity"
              style={{ color: 'rgba(255,255,255,0.38)', textDecoration: 'none' }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 5l-7 7 7 7" />
              </svg>
              Dashboard
            </Link>

            <div className="flex items-start justify-between gap-3 mb-1">
              <div className="flex items-center gap-3">
                {/* Bell icon */}
                <div
                  className="relative w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(0,200,255,0.12)', border: '1px solid rgba(0,200,255,0.32)' }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00c8ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                  </svg>
                  {totalUnread > 0 && (
                    <div
                      className="absolute -top-1 -right-1 min-w-4 h-4 flex items-center justify-center rounded-full px-1 text-[9px] font-bold"
                      style={{ background: '#f87171', color: '#ffffff', border: '2px solid #060e24' }}
                    >
                      {totalUnread}
                    </div>
                  )}
                </div>
                <div>
                  <h1 className="text-2xl font-bold" style={{ color: '#ffffff', lineHeight: 1.1 }}>
                    Notifications
                  </h1>
                  <p className="text-xs mt-1 leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    Stay updated on scans, rewards, pickups, fundraisers, alerts, and reports.
                  </p>
                </div>
              </div>

              {totalUnread > 0 && (
                <button
                  onClick={markAllRead}
                  className="shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-semibold hover:brightness-110 active:scale-[0.97] transition-all"
                  style={{ background: 'rgba(0,200,255,0.1)', border: '1px solid rgba(0,200,255,0.28)', color: '#00c8ff', cursor: 'pointer' }}
                >
                  Mark all read
                </button>
              )}
            </div>
          </div>

          {/* ── Unread summary bar ────────────────────────────────────────────── */}
          {totalUnread > 0 && (
            <div
              className="flex items-center gap-2 mt-4 mb-5 px-4 py-2.5 rounded-2xl"
              style={{ background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.22)', ...fade(60) }}
            >
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: '#f87171', boxShadow: '0 0 5px #f87171', animation: animate ? 'bellDot 2s ease-in-out infinite' : 'none' }}
              />
              <p className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.6)' }}>
                <span style={{ color: '#f87171' }}>{totalUnread}</span> unread notification{totalUnread !== 1 ? 's' : ''}
              </p>
            </div>
          )}

          {/* ── Filter tabs ───────────────────────────────────────────────────── */}
          <div
            className="flex gap-2 mb-5"
            style={{ overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2, ...fade(80) }}
          >
            {FILTER_TABS.map(tab => {
              const unread   = unreadFor(tab)
              const isActive = tab === activeTab
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11px] font-semibold transition-all hover:brightness-110"
                  style={{
                    background: isActive ? 'rgba(0,200,255,0.14)' : 'rgba(255,255,255,0.05)',
                    border:     isActive ? '1px solid rgba(0,200,255,0.45)' : '1px solid rgba(255,255,255,0.1)',
                    color:      isActive ? '#00c8ff' : 'rgba(255,255,255,0.48)',
                    cursor:     'pointer',
                    boxShadow:  isActive ? '0 0 12px rgba(0,200,255,0.18)' : 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {tab}
                  {unread > 0 && (
                    <span
                      className="flex items-center justify-center rounded-full text-[9px] font-bold"
                      style={{
                        minWidth:   16,
                        height:     16,
                        background: isActive ? 'rgba(248,113,113,0.3)' : 'rgba(248,113,113,0.2)',
                        color:      '#f87171',
                        padding:    '0 4px',
                      }}
                    >
                      {unread}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* ── Notification cards ────────────────────────────────────────────── */}
          <div className="flex flex-col gap-3" style={fade(140)}>
            {filtered.length === 0 ? (
              <div
                className="rounded-2xl flex flex-col items-center gap-3 py-14 text-center"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>No notifications in this category.</p>
              </div>
            ) : (
              filtered.map(notif => (
                <NotifCard
                  key={notif.id}
                  notif={notif}
                  onMarkRead={markRead}
                />
              ))
            )}
          </div>

          {/* ── Footer ────────────────────────────────────────────────────────── */}
          {filtered.length > 0 && (
            <p
              className="text-center mt-8 text-[10px]"
              style={{ color: 'rgba(255,255,255,0.18)', ...fade(220) }}
            >
              Showing {filtered.length} notification{filtered.length !== 1 ? 's' : ''} ·{' '}
              {totalUnread > 0
                ? `${totalUnread} unread`
                : 'All caught up ✓'}
            </p>
          )}

        </div>
      </div>

      <style>{`
        @keyframes bellDot {
          0%, 100% { opacity: 1;   transform: scale(1);    }
          50%       { opacity: 0.4; transform: scale(0.75); }
        }
      `}</style>
    </div>
  )
}
