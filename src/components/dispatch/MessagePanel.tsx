import { useEffect, useRef, useState } from 'react'
import { useDispatchMessageStore } from '../../store/dispatchMessageStore'
import {
  MSG_TYPE_LABEL, MSG_TYPE_ICON, MSG_PRIORITY_COLOR, MSG_PRIORITY_BG, MSG_PRIORITY_LABEL,
} from '../../store/dispatchMessageStore'
import type { MsgType, MsgPriority, MsgSenderRole } from '../../store/dispatchMessageStore'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  selfId:       string
  selfRole:     MsgSenderRole
  selfName:     string
  partnerId:    string
  partnerName:  string
  routeId?:     string | null
  stopId?:      string | null
  stopLabel?:   string
  title?:       string
  onClose:      () => void
  onMessageSent?: (msgType: MsgType, priority: MsgPriority, subject: string) => void
}

// ── Admin message types the UI exposes ────────────────────────────────────────

const ADMIN_MSG_TYPES: MsgType[] = [
  'route_update',
  'delay_notice',
  'safety_warning',
  'warehouse_reroute',
  'emergency_instruction',
  'general_dispatch',
]

const PRIORITY_OPTIONS: MsgPriority[] = ['info', 'warning', 'critical', 'emergency']

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  const d   = new Date(iso)
  const now = new Date()
  const min = (now.getTime() - d.getTime()) / 60000
  if (min < 1)    return 'Just now'
  if (min < 60)   return `${Math.floor(min)}m ago`
  if (min < 1440) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MessagePanel({
  selfId, selfRole, selfName,
  partnerId, partnerName,
  routeId, stopId, stopLabel,
  title, onClose, onMessageSent,
}: Props) {
  const { messages, sending, loadMessages, sendMessage, markAllRead } = useDispatchMessageStore()

  const [draft,    setDraft]    = useState('')
  const [subject,  setSubject]  = useState('')
  const [msgType,  setMsgType]  = useState<MsgType>('general_dispatch')
  const [priority, setPriority] = useState<MsgPriority>('info')
  const [sendErr,  setSendErr]  = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const isAdmin   = selfRole === 'admin'

  useEffect(() => {
    loadMessages(selfId)
    markAllRead(selfId)
  }, [selfId, loadMessages, markAllRead])

  const thread = messages.filter(m =>
    (m.sender_id === selfId    && m.recipient_id === partnerId) ||
    (m.sender_id === partnerId && m.recipient_id === selfId)
  ).slice().reverse()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [thread.length])

  async function handleSend() {
    const text = draft.trim()
    if (!text || sending) return
    setSendErr(null)
    const res = await sendMessage({
      route_id:     routeId  ?? null,
      stop_id:      stopId   ?? null,
      sender_id:    selfId,
      sender_role:  selfRole,
      recipient_id: partnerId,
      subject:      isAdmin ? subject : undefined,
      message:      text,
      msg_type:     isAdmin ? msgType  : 'text',
      priority:     isAdmin ? priority : 'info',
      sender_name:  selfName,
    })
    if (res.ok) {
      onMessageSent?.(
        isAdmin ? msgType  : 'text',
        isAdmin ? priority : 'info',
        isAdmin ? subject  : '',
      )
      setDraft('')
      if (isAdmin) { setSubject(''); setMsgType('general_dispatch'); setPriority('info') }
    } else {
      setSendErr(res.error ?? 'Failed to send')
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 110 }}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
      />

      {/* Panel */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        maxWidth: 640, margin: '0 auto',
        background: 'linear-gradient(180deg, #0a1530 0%, #060e24 100%)',
        border: '1px solid rgba(0,200,255,0.14)', borderBottom: 'none',
        borderRadius: '22px 22px 0 0',
        display: 'flex', flexDirection: 'column',
        maxHeight: '85vh', zIndex: 1,
      }}>
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 14 }}>
          <div style={{ width: 36, height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.14)' }} />
        </div>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px 10px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{title ?? `Message ${partnerName}`}</p>
            {stopLabel && (
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                Re: <span style={{ color: '#00c8ff' }}>{stopLabel}</span>
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 999, width: 30, height: 30, cursor: 'pointer', color: 'rgba(255,255,255,0.6)', fontSize: 16 }}
          >×</button>
        </div>

        {/* Thread */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {thread.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <p style={{ fontSize: 28, marginBottom: 8 }}>💬</p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
                {isAdmin ? 'Send a message to this driver.' : 'No messages from dispatch yet.'}
              </p>
            </div>
          ) : (
            thread.map(msg => {
              const isSelf    = msg.sender_id === selfId
              const pColor    = MSG_PRIORITY_COLOR[msg.priority]
              const isEmerg   = msg.priority === 'emergency'
              const typeLabel = MSG_TYPE_LABEL[msg.msg_type]
              const typeIcon  = MSG_TYPE_ICON[msg.msg_type]
              return (
                <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isSelf ? 'flex-end' : 'flex-start' }}>
                  {/* Type + priority tag (admin messages only) */}
                  {msg.sender_role === 'admin' && (
                    <div style={{ display: 'flex', gap: 4, marginBottom: 4, alignItems: 'center', flexWrap: 'wrap', justifyContent: isSelf ? 'flex-end' : 'flex-start' }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: pColor, background: MSG_PRIORITY_BG[msg.priority], border: `1px solid ${pColor}30`, borderRadius: 6, padding: '1px 6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {MSG_PRIORITY_LABEL[msg.priority]}
                      </span>
                      <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '1px 6px' }}>
                        {typeIcon} {typeLabel}
                      </span>
                    </div>
                  )}
                  {/* Subject */}
                  {msg.subject && (
                    <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 3, alignSelf: isSelf ? 'flex-end' : 'flex-start' }}>
                      {msg.subject}
                    </p>
                  )}
                  {/* Bubble */}
                  <div style={{
                    maxWidth: '80%',
                    background: isEmerg && !isSelf
                      ? 'rgba(239,68,68,0.12)'
                      : isSelf ? 'rgba(0,200,255,0.12)' : 'rgba(255,255,255,0.06)',
                    border: `1px solid ${isEmerg && !isSelf ? 'rgba(239,68,68,0.35)' : isSelf ? 'rgba(0,200,255,0.25)' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: isSelf ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    padding: '9px 13px',
                  }}>
                    <p style={{ fontSize: 13, color: '#fff', lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {msg.message}
                    </p>
                  </div>
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.28)', marginTop: 3 }}>
                    {isSelf ? 'You' : partnerName} · {formatTime(msg.created_at)}
                    {isSelf && msg.read && <span style={{ marginLeft: 4, color: '#4ade80' }}>✓ Read</span>}
                    {!isSelf && isEmerg && msg.acknowledged && <span style={{ marginLeft: 4, color: '#4ade80' }}>✓ Acknowledged</span>}
                  </span>
                </div>
              )
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Admin compose fields */}
        {isAdmin && (
          <div style={{ padding: '8px 14px 0', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <select
                value={msgType}
                onChange={e => setMsgType(e.target.value as MsgType)}
                style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: '#fff', fontSize: 11, padding: '6px 8px' }}
              >
                {ADMIN_MSG_TYPES.map(t => (
                  <option key={t} value={t} style={{ background: '#0a1530' }}>
                    {MSG_TYPE_ICON[t]} {MSG_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as MsgPriority)}
                style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${MSG_PRIORITY_COLOR[priority]}50`, borderRadius: 10, color: MSG_PRIORITY_COLOR[priority], fontSize: 11, fontWeight: 700, padding: '6px 8px' }}
              >
                {PRIORITY_OPTIONS.map(p => (
                  <option key={p} value={p} style={{ background: '#0a1530', color: MSG_PRIORITY_COLOR[p] }}>
                    {MSG_PRIORITY_LABEL[p]}
                  </option>
                ))}
              </select>
            </div>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Subject (optional)"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontSize: 11, padding: '6px 10px', outline: 'none' }}
            />
          </div>
        )}

        {/* Compose row */}
        <div style={{ padding: `${isAdmin ? 8 : 10}px 14px 28px`, borderTop: isAdmin ? 'none' : '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isAdmin ? 'Type message… (Enter to send)' : 'Reply to dispatch… (Enter to send)'}
            rows={2}
            style={{
              flex: 1, resize: 'none',
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 14, padding: '10px 12px',
              color: '#fff', fontSize: 13, lineHeight: 1.5,
              outline: 'none', fontFamily: 'inherit',
            }}
          />
          <button
            onClick={handleSend}
            disabled={!draft.trim() || sending}
            style={{
              flexShrink: 0, width: 44, height: 44, borderRadius: '50%',
              background: !draft.trim() || sending ? 'rgba(0,200,255,0.08)' : '#00c8ff',
              border: '1px solid rgba(0,200,255,0.3)',
              cursor: !draft.trim() || sending ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, transition: 'background 0.15s',
            }}
          >➤</button>
        </div>
        {sendErr && (
          <p style={{ fontSize: 11, color: '#f87171', textAlign: 'center', padding: '0 14px 12px' }}>{sendErr}</p>
        )}
      </div>
    </div>
  )
}
