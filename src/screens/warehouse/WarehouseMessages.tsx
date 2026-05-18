import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { PrimaryButton } from '../../components/ui/PrimaryButton'
import { EmptyState } from '../../components/ui/EmptyState'
import { Spinner } from '../../components/ui/Spinner'
import { PageHeader } from '../../components/ui/PageHeader'
import { BottomNav } from '../../components/ui/BottomNav'
import type { BottomNavItem } from '../../components/ui/BottomNav'
import { useAuthStore } from '../../store/authStore'

// ── Types ─────────────────────────────────────────────────────────────────────

type MsgPriority = 'info' | 'warning' | 'critical' | 'emergency'
type MsgType     = 'capacity_warning' | 'bay_assignment' | 'incoming_load' | 'contamination' | 'equipment_issue' | 'emergency' | 'general'

interface WarehouseMessage {
  id:           string
  warehouse_id: string | null
  message_type: MsgType
  priority:     MsgPriority
  subject:      string | null
  message:      string
  read:         boolean
  acknowledged: boolean
  created_at:   string
  warehouse_name?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function priorityVariant(p: MsgPriority): 'cyan' | 'amber' | 'red' {
  if (p === 'emergency' || p === 'critical') return 'red'
  if (p === 'warning')                       return 'amber'
  return 'cyan'
}

function priorityLabel(p: MsgPriority): string {
  return p.charAt(0).toUpperCase() + p.slice(1)
}

function priorityBorder(p: MsgPriority): string {
  if (p === 'emergency') return '#ef4444'
  if (p === 'critical')  return '#f87171'
  if (p === 'warning')   return '#f59e0b'
  return '#60a5fa'
}

function msgTypeIcon(t: MsgType): string {
  const map: Record<MsgType, string> = {
    capacity_warning: '⚠️',
    bay_assignment:   '🔲',
    incoming_load:    '🚛',
    contamination:    '☣️',
    equipment_issue:  '🔧',
    emergency:        '🚨',
    general:          '📋',
  }
  return map[t]
}

function msgTypeLabel(t: MsgType): string {
  const map: Record<MsgType, string> = {
    capacity_warning: 'Capacity Warning',
    bay_assignment:   'Bay Assignment',
    incoming_load:    'Incoming Load Alert',
    contamination:    'Contamination Alert',
    equipment_issue:  'Equipment Issue',
    emergency:        'Emergency Instruction',
    general:          'General Operations',
  }
  return map[t]
}

function fmtTime(iso: string): string {
  const d   = new Date(iso)
  const now = new Date()
  const m   = Math.floor((now.getTime() - d.getTime()) / 60_000)
  if (m < 1)   return 'just now'
  if (m < 60)  return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h}h ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function WarehouseMessages() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [messages,   setMessages]   = useState<WarehouseMessage[]>([])
  const [loading,    setLoading]    = useState(true)
  const [working,    setWorking]    = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filterTab,  setFilterTab]  = useState<'unread' | 'all'>('unread')
  const [toast,      setToast]      = useState<{ msg: string; ok: boolean } | null>(null)

  function notify(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  // ── Load ─────────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)

    // RLS returns only messages for this user's warehouse + any direct messages
    const { data: raw, error } = await supabase
      .from('warehouse_messages')
      .select('id,warehouse_id,message_type,priority,subject,message,read,acknowledged,created_at')
      .order('created_at', { ascending: false })
      .limit(60)

    if (error) { setLoading(false); return }

    const msgs = (raw ?? []) as WarehouseMessage[]

    // Resolve warehouse names
    const whIds = [...new Set(msgs.map(m => m.warehouse_id).filter(Boolean))] as string[]
    const whNameMap: Record<string, string> = {}
    if (whIds.length) {
      const { data: whs } = await supabase.from('warehouses').select('id,code,name').in('id', whIds)
      ;(whs ?? []).forEach((w: { id: string; code: string; name: string }) => {
        whNameMap[w.id] = `${w.name} (${w.code})`
      })
    }

    setMessages(msgs.map(m => ({
      ...m,
      warehouse_name: m.warehouse_id ? (whNameMap[m.warehouse_id] ?? 'Warehouse') : 'Direct Message',
    })))
    setLoading(false)
  }, [user])

  useEffect(() => { void load() }, [load])

  // Realtime — new messages arrive instantly
  useEffect(() => {
    if (!user) return
    const ch = supabase
      .channel('wh-messages-staff')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'warehouse_messages' }, () => { void load() })
      .subscribe()
    return () => { void supabase.removeChannel(ch) }
  }, [user, load])

  // ── Mark as read ──────────────────────────────────────────────────────────────
  async function markRead(msgId: string) {
    setWorking(msgId)
    const { error } = await supabase
      .from('warehouse_messages')
      .update({ read: true })
      .eq('id', msgId)
    if (!error) {
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, read: true } : m))
    }
    setWorking(null)
  }

  // ── Acknowledge ───────────────────────────────────────────────────────────────
  async function acknowledge(msg: WarehouseMessage) {
    if (working) return
    setWorking(msg.id)
    const { error } = await supabase
      .from('warehouse_messages')
      .update({ acknowledged: true, read: true })
      .eq('id', msg.id)
    if (error) {
      notify('Acknowledgment failed. Please try again.', false)
    } else {
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, acknowledged: true, read: true } : m))
      notify(msg.priority === 'emergency' ? 'Emergency instruction acknowledged.' : 'Message acknowledged.')
    }
    setWorking(null)
  }

  // Auto-mark expanded messages as read
  function handleExpand(msgId: string) {
    const current = expandedId === msgId ? null : msgId
    setExpandedId(current)
    if (current) {
      const msg = messages.find(m => m.id === msgId)
      if (msg && !msg.read) void markRead(msgId)
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────────
  const unread           = messages.filter(m => !m.read)
  const emergencyUnacked = messages.filter(m => m.priority === 'emergency' && !m.acknowledged)
  const displayMessages  = filterTab === 'unread' ? unread : messages

  const navItems: BottomNavItem[] = [
    { label: 'Loads',    icon: '📦', active: false, onClick: () => navigate('/dashboard/warehouse/expected-loads')      },
    { label: 'Intake',   icon: '🏭', active: false, onClick: () => navigate('/dashboard/warehouse/commercial-intake')   },
    { label: 'Process',  icon: '⚙️', active: false, onClick: () => navigate('/dashboard/warehouse/commercial-processing') },
    { label: 'Messages', icon: '📨', active: true,  onClick: () => {}, badge: unread.length || undefined               },
  ]

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#060e24', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spinner />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#060e24', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif', paddingBottom: 80 }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
          background: toast.ok ? '#065f46' : '#7f1d1d', color: '#fff',
          padding: '10px 20px', borderRadius: 10, zIndex: 9999,
          fontSize: 14, maxWidth: 340, textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        }}>
          {toast.msg}
        </div>
      )}

      <div style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)', minHeight: '100vh' }}>
        <PageHeader rightContent={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {unread.length > 0 && (
              <span style={{ background: '#ef4444', color: '#fff', borderRadius: '50%', width: 22, height: 22, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {unread.length > 9 ? '9+' : unread.length}
              </span>
            )}
          </div>
        } />

        <div style={{ padding: '16px 16px 0', maxWidth: 600, margin: '0 auto' }}>

          {/* Page title */}
          <div style={{ marginBottom: 16 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 2 }}>Messages</h1>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
              {unread.length > 0 ? `${unread.length} unread` : 'All caught up'}
              {emergencyUnacked.length > 0 && ` · ${emergencyUnacked.length} emergency requiring acknowledgment`}
            </p>
          </div>

          {/* Emergency acknowledgment banner */}
          {emergencyUnacked.length > 0 && (
            <div style={{
              background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)',
              borderRadius: 12, padding: '12px 16px', marginBottom: 16,
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <span style={{ fontSize: 24, flexShrink: 0 }}>🚨</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: '#fca5a5', fontSize: 14 }}>
                  {emergencyUnacked.length} Emergency Message{emergencyUnacked.length !== 1 ? 's' : ''} — Acknowledgment Required
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                  Emergency instructions cannot be dismissed. Tap each to read and acknowledge.
                </div>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {[
              { key: 'unread' as const, label: `Unread (${unread.length})` },
              { key: 'all'    as const, label: `All (${messages.length})`  },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilterTab(tab.key)}
                style={{
                  background: filterTab === tab.key ? '#00c8ff' : 'rgba(255,255,255,0.07)',
                  color: filterTab === tab.key ? '#000' : 'rgba(255,255,255,0.5)',
                  border: 'none', borderRadius: 20, padding: '6px 16px',
                  fontSize: 13, fontWeight: filterTab === tab.key ? 700 : 400, cursor: 'pointer',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Message list */}
          {displayMessages.length === 0 ? (
            <EmptyState
              icon={filterTab === 'unread' ? '✅' : '📭'}
              title={filterTab === 'unread' ? 'All caught up!' : 'No messages yet'}
              description={filterTab === 'unread' ? 'No unread messages. Switch to "All" to see history.' : 'Messages from admin will appear here.'}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {displayMessages.map(msg => {
                const expanded    = expandedId === msg.id
                const isUnread    = !msg.read
                const isEmergency = msg.priority === 'emergency'
                const needsAck    = isEmergency && !msg.acknowledged

                return (
                  <div
                    key={msg.id}
                    style={{
                      background: isEmergency && !msg.acknowledged
                        ? 'rgba(239,68,68,0.07)'
                        : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${isUnread ? priorityBorder(msg.priority) + '55' : 'rgba(255,255,255,0.09)'}`,
                      borderLeft: `3px solid ${isUnread ? priorityBorder(msg.priority) : '#334155'}`,
                      borderRadius: 14,
                      cursor: 'pointer',
                      transition: 'opacity 0.2s',
                      opacity: msg.read && !needsAck ? 0.78 : 1,
                    }}
                    onClick={() => handleExpand(msg.id)}
                  >
                    {/* Message header */}
                    <div style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <span style={{ fontSize: 20, flexShrink: 0 }}>{msgTypeIcon(msg.message_type)}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
                            <div style={{ fontWeight: isUnread ? 700 : 500, fontSize: 14, color: isUnread ? '#fff' : 'rgba(255,255,255,0.65)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {msg.subject || msgTypeLabel(msg.message_type)}
                            </div>
                            <div style={{ display: 'flex', gap: 4, flexShrink: 0, alignItems: 'center' }}>
                              {isUnread && <span style={{ width: 6, height: 6, borderRadius: '50%', background: priorityBorder(msg.priority), flexShrink: 0 }} />}
                              {msg.acknowledged && <span style={{ fontSize: 10, color: '#34d399' }}>✓</span>}
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                            <StatusBadge variant={priorityVariant(msg.priority)} label={priorityLabel(msg.priority)} size="sm" />
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{msgTypeLabel(msg.message_type)}</span>
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{fmtTime(msg.created_at)}</span>
                          </div>

                          {msg.warehouse_name && (
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 3 }}>
                              {msg.warehouse_name}
                            </div>
                          )}

                          {/* Preview when collapsed */}
                          {!expanded && (
                            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                              {msg.message}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expanded body */}
                    {expanded && (
                      <div style={{ padding: '0 14px 14px' }}>
                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 12, marginBottom: 14 }}>
                          <p style={{ fontSize: 14, color: '#cbd5e1', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                            {msg.message}
                          </p>
                        </div>

                        {/* Emergency: must acknowledge, no silent dismiss */}
                        {isEmergency && !msg.acknowledged ? (
                          <div>
                            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 11, color: '#fca5a5' }}>
                              🚨 This is an emergency instruction. You must acknowledge before continuing.
                            </div>
                            <PrimaryButton
                              onClick={e => { e.stopPropagation(); void acknowledge(msg) }}
                              loading={working === msg.id}
                              variant="danger"
                              fullWidth
                              size="sm"
                            >
                              Acknowledge Emergency Instruction
                            </PrimaryButton>
                          </div>
                        ) : msg.priority !== 'emergency' && !msg.acknowledged ? (
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              onClick={e => { e.stopPropagation(); void acknowledge(msg) }}
                              disabled={working === msg.id}
                              style={{
                                background: 'rgba(0,200,255,0.1)', color: '#00c8ff',
                                border: '1px solid rgba(0,200,255,0.25)', borderRadius: 8,
                                padding: '7px 16px', fontSize: 12, fontWeight: 700,
                                cursor: working === msg.id ? 'wait' : 'pointer',
                                opacity: working === msg.id ? 0.6 : 1,
                              }}
                            >
                              {working === msg.id ? 'Acknowledging…' : '✓ Acknowledge'}
                            </button>
                          </div>
                        ) : msg.acknowledged ? (
                          <div style={{ fontSize: 12, color: '#34d399' }}>✓ Acknowledged</div>
                        ) : null}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <BottomNav items={navItems} />
    </div>
  )
}
