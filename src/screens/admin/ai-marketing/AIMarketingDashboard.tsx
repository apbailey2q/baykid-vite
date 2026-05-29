// AIMarketingDashboard.tsx — BayKid AI Marketing Center
// Live stats from localStorage + notifications panel + real activity feed.

import { useState, useEffect } from 'react'
import { loadPosts } from '../../../lib/postStorage'
import { loadLeads } from '../../../lib/leadStorage'
import { loadRules } from '../../../lib/automationRules'
import {
  activeNotifications, markRead, dismissNotification, markAllRead,
  autoGenerateNotifications,
  type AppNotification, NOTIF_META,
} from '../../../lib/notifications'
import { recentEvents, EVENT_META, fmtEventTime, type ActivityEvent } from '../../../lib/activityLog'

// ── Live stats ─────────────────────────────────────────────────────────────────

function computeStats() {
  const posts  = loadPosts()
  const leads  = loadLeads()
  const rules  = loadRules()
  const today  = new Date().toISOString().split('T')[0]

  return {
    drafts:      posts.filter(p => p.status === 'draft').length,
    pending:     posts.filter(p => p.status === 'pending_approval').length,
    scheduled:   posts.filter(p => p.status === 'scheduled').length,
    posted:      posts.filter(p => p.status === 'posted').length,
    newLeads:    leads.filter(l => l.status === 'new').length,
    totalLeads:  leads.length,
    followUpsDue: leads.filter(l =>
      l.followUpDate && l.followUpDate <= today
      && l.status !== 'converted' && l.status !== 'lost'
    ).length,
    activeRules: rules.filter(r => r.enabled).length,
    totalTriggers: rules.reduce((acc, r) => acc + r.triggerCount, 0),
  }
}

// ── Notification item ──────────────────────────────────────────────────────────

function NotifItem({
  notif,
  onRead,
  onDismiss,
}: {
  notif: AppNotification
  onRead: () => void
  onDismiss: () => void
}) {
  const m = NOTIF_META[notif.type]
  return (
    <div
      onClick={onRead}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        padding: '10px 14px',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        background: notif.read ? 'transparent' : 'rgba(255,255,255,0.03)',
        cursor: 'pointer', transition: 'background 0.15s',
      }}
    >
      <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1, filter: notif.read ? 'grayscale(0.5) opacity(0.5)' : 'none' }}>{m.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: notif.read ? 'rgba(255,255,255,0.4)' : '#fff', fontSize: 12, fontWeight: notif.read ? 500 : 700, marginBottom: 1 }}>
          {notif.title}
        </div>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, lineHeight: 1.45 }}>{notif.body}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
        <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10, whiteSpace: 'nowrap' }}>
          {fmtEventTime(notif.ts)}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onDismiss() }}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', fontSize: 12, cursor: 'pointer', padding: '0 2px', lineHeight: 1 }}
          title="Dismiss"
        >✕</button>
      </div>
    </div>
  )
}

// ── Activity feed item ─────────────────────────────────────────────────────────

function ActivityRow({ ev, last }: { ev: ActivityEvent; last: boolean }) {
  const m = EVENT_META[ev.type] ?? { icon: '•', color: '#94a3b8' }
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '11px 16px',
      borderBottom: last ? 'none' : '1px solid rgba(255,255,255,0.04)',
    }}>
      <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{m.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ color: 'rgba(255,255,255,0.72)', fontSize: 12, lineHeight: 1.5 }}>{ev.label}</span>
        {ev.actor && <span style={{ color: 'rgba(255,255,255,0.28)', fontSize: 11, marginLeft: 6 }}>· {ev.actor}</span>}
      </div>
      <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, flexShrink: 0, marginTop: 1, whiteSpace: 'nowrap' }}>
        {fmtEventTime(ev.ts)}
      </span>
    </div>
  )
}

// ── Stat card ──────────────────────────────────────────────────────────────────

function LiveStatCard({
  icon, label, value, color, bg, border,
}: {
  icon: string; label: string; value: string | number
  color: string; bg: string; border: string
}) {
  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 14, padding: '16px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ color, fontSize: 26, fontWeight: 800, lineHeight: 1, textShadow: `0 0 18px ${color}40` }}>
        {value}
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function AIMarketingDashboard() {
  const [stats, setStats]       = useState(computeStats)
  const [notifs, setNotifs]     = useState(activeNotifications)
  const [activity, setActivity] = useState(() => recentEvents(20))
  const [showAll, setShowAll]   = useState(false)

  useEffect(() => {
    // Generate any missing notifications on mount
    autoGenerateNotifications()
    setStats(computeStats())
    setNotifs(activeNotifications())
    setActivity(recentEvents(20))
  }, [])

  function handleRead(id: string) {
    markRead(id)
    setNotifs(activeNotifications())
  }

  function handleDismiss(id: string) {
    dismissNotification(id)
    setNotifs(activeNotifications())
  }

  function handleReadAll() {
    markAllRead()
    setNotifs(activeNotifications())
  }

  const unread = notifs.filter(n => !n.read).length
  const displayedNotifs = showAll ? notifs : notifs.slice(0, 5)

  return (
    <div style={{ maxWidth: 960 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 22, gap: 16 }}>
        <div>
          <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 20, margin: 0 }}>Marketing Overview</h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 4 }}>
            Cyan's Brooklynn Marketing Center
          </p>
        </div>
        <button
          onClick={() => { setStats(computeStats()); autoGenerateNotifications(); setNotifs(activeNotifications()); setActivity(recentEvents(20)) }}
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
        >
          🔄 Refresh
        </button>
      </div>

      {/* ── Stats grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
        <LiveStatCard icon="📝" label="Draft Posts"    value={stats.drafts}        color="#60a5fa" bg="rgba(96,165,250,0.07)"  border="rgba(96,165,250,0.18)" />
        <LiveStatCard icon="⏳" label="Pending"        value={stats.pending}       color="#fbbf24" bg="rgba(251,191,36,0.07)" border="rgba(251,191,36,0.18)" />
        <LiveStatCard icon="📅" label="Scheduled"      value={stats.scheduled}     color="#00c8ff" bg="rgba(0,200,255,0.07)"  border="rgba(0,200,255,0.18)" />
        <LiveStatCard icon="🚀" label="Posted"         value={stats.posted}        color="#10b981" bg="rgba(16,185,129,0.07)" border="rgba(16,185,129,0.18)" />
        <LiveStatCard icon="🎯" label="New Leads"      value={stats.newLeads}      color="#22c55e" bg="rgba(34,197,94,0.07)"  border="rgba(34,197,94,0.18)" />
        <LiveStatCard icon="🔔" label="Follow-Ups Due" value={stats.followUpsDue}  color="#fb923c" bg="rgba(251,146,60,0.07)" border="rgba(251,146,60,0.18)" />
        <LiveStatCard icon="⚡" label="Active Rules"   value={stats.activeRules}   color="#a855f7" bg="rgba(168,85,247,0.07)" border="rgba(168,85,247,0.18)" />
        <LiveStatCard icon="📊" label="Rule Triggers"  value={stats.totalTriggers} color="#818cf8" bg="rgba(129,140,248,0.07)"border="rgba(129,140,248,0.18)" />
      </div>

      {/* ── Two-column: Notifications + Activity ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>

        {/* Notifications panel */}
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(251,191,36,0.15)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 15 }}>🔔</span>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>Notifications</span>
              {unread > 0 && (
                <span style={{ background: '#ef4444', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 10, fontWeight: 800 }}>
                  {unread}
                </span>
              )}
            </div>
            {notifs.length > 0 && (
              <button
                onClick={handleReadAll}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}
              >
                Mark all read
              </button>
            )}
          </div>
          {notifs.length === 0 ? (
            <div style={{ padding: 20, color: 'rgba(255,255,255,0.3)', fontSize: 12, textAlign: 'center' }}>
              🎉 All caught up — no new notifications.
            </div>
          ) : (
            <>
              {displayedNotifs.map(n => (
                <NotifItem
                  key={n.id}
                  notif={n}
                  onRead={() => handleRead(n.id)}
                  onDismiss={() => handleDismiss(n.id)}
                />
              ))}
              {notifs.length > 5 && (
                <div style={{ padding: '8px 16px', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <button
                    onClick={() => setShowAll(v => !v)}
                    style={{ background: 'none', border: 'none', color: 'rgba(0,200,255,0.6)', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}
                  >
                    {showAll ? 'Show fewer' : `Show all ${notifs.length}`}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Activity feed */}
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(0,190,255,0.12)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 15 }}>🕐</span>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>Recent Activity</span>
          </div>
          {activity.length === 0 ? (
            <div style={{ padding: 20, color: 'rgba(255,255,255,0.3)', fontSize: 12, textAlign: 'center' }}>
              No activity yet — generate a post or trigger a rule to see events here.
            </div>
          ) : (
            activity.slice(0, 12).map((ev, i) => (
              <ActivityRow key={ev.id} ev={ev} last={i === Math.min(activity.length, 12) - 1} />
            ))
          )}
        </div>
      </div>

      {/* ── Pipeline summary ── */}
      <div style={{ marginTop: 18, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 16 }}>
        <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: 700, marginBottom: 12, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Lead Pipeline
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(
            [
              { key: 'newLeads',    label: 'New',       color: '#60a5fa' },
              { key: 'interested',  label: 'Interested', color: '#00c8ff' },
              { key: 'followUp',    label: 'Follow Up',  color: '#fb923c' },
            ] as const
          ).map(item => (
            <div key={item.key} style={{ flex: '1 1 100px', background: `${item.color}12`, border: `1px solid ${item.color}28`, borderRadius: 10, padding: '8px 12px', textAlign: 'center' }}>
              <div style={{ color: item.color, fontSize: 20, fontWeight: 800 }}>
                {item.key === 'newLeads' ? stats.newLeads : item.key === 'followUp' ? stats.followUpsDue : '—'}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, marginTop: 2 }}>{item.label}</div>
            </div>
          ))}
          <div style={{ flex: '1 1 100px', background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 10, padding: '8px 12px', textAlign: 'center' }}>
            <div style={{ color: '#22c55e', fontSize: 20, fontWeight: 800 }}>{stats.totalLeads}</div>
            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, marginTop: 2 }}>Total Leads</div>
          </div>
        </div>
      </div>

      <div style={{ height: 40 }} />
    </div>
  )
}
