import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useDispatchMessageStore } from '../../store/dispatchMessageStore'
import {
  MSG_TYPE_LABEL, MSG_TYPE_ICON,
  MSG_PRIORITY_COLOR, MSG_PRIORITY_BG, MSG_PRIORITY_LABEL,
} from '../../store/dispatchMessageStore'
import type { DispatchMessage } from '../../store/dispatchMessageStore'
import { GlassCard } from '../../components/ui/GlassCard'
import { Spinner } from '../../components/ui/Spinner'
import { MessagePanel } from '../../components/dispatch/MessagePanel'
import { supabase } from '../../lib/supabase'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  const d   = new Date(iso)
  const now = new Date()
  const min = (now.getTime() - d.getTime()) / 60000
  if (min < 1)    return 'Just now'
  if (min < 60)   return `${Math.floor(min)}m ago`
  if (min < 1440) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

type FilterMode = 'all' | 'unread'

// ── Screen ────────────────────────────────────────────────────────────────────

export default function DriverDispatchMessages() {
  const navigate    = useNavigate()
  const { user }    = useAuthStore()
  const {
    messages, loadMessages, markRead, markAllRead, acknowledge,
    loadError, addLocal,
  } = useDispatchMessageStore()

  const [loading,      setLoading]      = useState(true)
  const [filter,       setFilter]       = useState<FilterMode>('all')
  const [replyTarget,  setReplyTarget]  = useState<DispatchMessage | null>(null)
  const [expanded,     setExpanded]     = useState<string | null>(null)
  const [acking,       setAcking]       = useState<string | null>(null)

  // ── Load + realtime ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!user) return
    loadMessages(user.id).finally(() => setLoading(false))

    const channel = supabase
      .channel(`driver-msgs-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'commercial_dispatch_messages',
        filter: `recipient_id=eq.${user.id}`,
      }, (payload) => {
        addLocal(payload.new as DispatchMessage)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user, loadMessages, addLocal])

  // ── Derived ───────────────────────────────────────────────────────────────

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#060e24' }}>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Sign in required.</p>
      </div>
    )
  }

  // Messages addressed to this driver from admin (newest first)
  const inbox = messages.filter(m => m.recipient_id === user.id && m.sender_role === 'admin')
  const displayed = filter === 'unread' ? inbox.filter(m => !m.read) : inbox
  const unreadCount = inbox.filter(m => !m.read).length

  // Emergency messages that need ack
  const pendingEmergency = inbox.filter(
    m => m.priority === 'emergency' && !m.acknowledged
  )

  // ── Actions ───────────────────────────────────────────────────────────────

  async function handleAcknowledge(msg: DispatchMessage) {
    setAcking(msg.id)
    await acknowledge(msg.id)
    setAcking(null)
  }

  function openReply(msg: DispatchMessage) {
    if (!msg.read) markRead(msg.id)
    setReplyTarget(msg)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
    <style>{`@keyframes emergPulse { 0%,100%{opacity:1;border-color:rgba(239,68,68,0.4)} 50%{opacity:0.7;border-color:rgba(239,68,68,0.8)} }`}</style>
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}>

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
          Dispatch Messages
        </span>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllRead(user.id)}
            style={{ fontSize: 10, fontWeight: 700, color: '#00c8ff', background: 'rgba(0,200,255,0.1)', border: '1px solid rgba(0,200,255,0.25)', borderRadius: 8, padding: '4px 8px', cursor: 'pointer' }}
          >
            Mark all read
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-24 max-w-xl mx-auto w-full">

        {/* ── Pending emergency banner ── */}
        {pendingEmergency.length > 0 && (
          <div
            style={{
              borderRadius: 14, padding: '12px 14px', marginBottom: 14,
              background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)',
              animation: 'emergPulse 1.8s ease-in-out infinite',
            }}
          >
            <p style={{ fontSize: 12, fontWeight: 800, color: '#ef4444', marginBottom: 2 }}>
              🚨 {pendingEmergency.length} Emergency Message{pendingEmergency.length > 1 ? 's' : ''} Require Acknowledgment
            </p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
              Scroll down to review and acknowledge.
            </p>
          </div>
        )}

        {/* ── Filter tabs ── */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {(['all', 'unread'] as FilterMode[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                background: filter === f ? 'rgba(0,200,255,0.14)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${filter === f ? 'rgba(0,200,255,0.35)' : 'rgba(255,255,255,0.08)'}`,
                color: filter === f ? '#00c8ff' : 'rgba(255,255,255,0.45)',
              }}
            >
              {f === 'all' ? `All (${inbox.length})` : `Unread (${unreadCount})`}
            </button>
          ))}
        </div>

        {/* ── Loading ── */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
            <Spinner />
          </div>
        ) : loadError ? (
          <GlassCard padding="lg" className="text-center">
            <p style={{ fontSize: 28, marginBottom: 10 }}>⚠️</p>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#f87171', marginBottom: 6 }}>Failed to load messages</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{loadError}</p>
          </GlassCard>
        ) : displayed.length === 0 ? (
          <GlassCard padding="lg" className="text-center">
            <p style={{ fontSize: 36, marginBottom: 12 }}>💬</p>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>
              {filter === 'unread' ? 'All caught up' : 'No dispatch messages'}
            </p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
              {filter === 'unread' ? 'No unread messages from dispatch.' : 'Messages from dispatch will appear here.'}
            </p>
          </GlassCard>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {displayed.map(msg => {
              const isOpen       = expanded === msg.id
              const pColor       = MSG_PRIORITY_COLOR[msg.priority]
              const isEmergency  = msg.priority === 'emergency'
              const needsAck     = isEmergency && !msg.acknowledged

              return (
                <div
                  key={msg.id}
                  style={{
                    borderRadius: 16,
                    background: needsAck
                      ? 'rgba(239,68,68,0.08)'
                      : msg.read ? 'rgba(255,255,255,0.03)' : 'rgba(0,200,255,0.05)',
                    border: `1px solid ${needsAck ? 'rgba(239,68,68,0.4)' : msg.read ? 'rgba(255,255,255,0.07)' : 'rgba(0,200,255,0.2)'}`,
                    overflow: 'hidden',
                  }}
                >
                  {/* Message header row */}
                  <button
                    onClick={() => {
                      setExpanded(isOpen ? null : msg.id)
                      if (!msg.read) markRead(msg.id)
                    }}
                    style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '12px 14px' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      {/* Type icon */}
                      <div style={{
                        width: 36, height: 36, flexShrink: 0, borderRadius: 10,
                        background: `${pColor}14`, border: `1px solid ${pColor}30`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                      }}>
                        {MSG_TYPE_ICON[msg.msg_type]}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                          {/* Subject or type label */}
                          <p style={{ fontSize: 13, fontWeight: msg.read ? 600 : 800, color: msg.read ? 'rgba(255,255,255,0.6)' : '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
                            {msg.subject || MSG_TYPE_LABEL[msg.msg_type]}
                          </p>
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0, marginLeft: 6 }}>
                            {/* Unread dot */}
                            {!msg.read && (
                              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#00c8ff', display: 'inline-block' }} />
                            )}
                            {/* Priority badge */}
                            <span style={{ fontSize: 8, fontWeight: 700, color: pColor, background: MSG_PRIORITY_BG[msg.priority], border: `1px solid ${pColor}30`, borderRadius: 6, padding: '1px 5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              {MSG_PRIORITY_LABEL[msg.priority]}
                            </span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 5, padding: '1px 5px' }}>
                            {MSG_TYPE_ICON[msg.msg_type]} {MSG_TYPE_LABEL[msg.msg_type]}
                          </span>
                          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginLeft: 8 }}>
                            {formatTime(msg.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* Expanded body */}
                  {isOpen && (
                    <div style={{ padding: '0 14px 14px' }}>
                      <div style={{ borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', padding: '10px 12px', marginBottom: 10 }}>
                        <p style={{ fontSize: 13, color: '#fff', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                          {msg.message}
                        </p>
                      </div>

                      {/* Emergency acknowledgment — required, cannot be dismissed silently */}
                      {needsAck ? (
                        <button
                          onClick={() => handleAcknowledge(msg)}
                          disabled={acking === msg.id}
                          style={{
                            width: '100%', padding: '11px 0', borderRadius: 12, fontSize: 12, fontWeight: 800, cursor: 'pointer',
                            background: acking === msg.id ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.18)',
                            border: '1px solid rgba(239,68,68,0.45)', color: '#ef4444',
                          }}
                        >
                          {acking === msg.id ? 'Acknowledging…' : '🚨 Acknowledge Emergency Instruction'}
                        </button>
                      ) : (
                        <div style={{ display: 'flex', gap: 6 }}>
                          {msg.acknowledged && isEmergency && (
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#4ade80', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.25)', borderRadius: 8, padding: '4px 10px' }}>
                              ✓ Acknowledged
                            </span>
                          )}
                          <button
                            onClick={() => openReply(msg)}
                            style={{
                              flex: 1, padding: '8px 0', borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                              background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.25)', color: '#00c8ff',
                            }}
                          >
                            💬 Reply to Dispatch
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>

    {/* Reply panel */}
    {replyTarget && user && (
      <MessagePanel
        selfId={user.id}
        selfRole="driver"
        selfName="Driver"
        partnerId={replyTarget.sender_id}
        partnerName={replyTarget.sender_name ?? 'Dispatch'}
        title="Reply to Dispatch"
        stopLabel={replyTarget.subject ?? undefined}
        onClose={() => setReplyTarget(null)}
      />
    )}
    </>
  )
}
