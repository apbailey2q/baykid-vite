import { create } from 'zustand'
import { supabase } from '../lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────

export type MsgType =
  | 'text'
  | 'dispatch_change'
  | 'system'
  | 'route_update'
  | 'delay_notice'
  | 'safety_warning'
  | 'warehouse_reroute'
  | 'emergency_instruction'
  | 'general_dispatch'

export type MsgPriority  = 'info' | 'warning' | 'critical' | 'emergency'
export type MsgSenderRole = 'admin' | 'driver'

export interface DispatchMessage {
  id:           string
  created_at:   string
  route_id:     string | null
  stop_id:      string | null
  sender_id:    string
  sender_role:  MsgSenderRole
  recipient_id: string
  subject:      string | null
  message:      string
  read:         boolean
  msg_type:     MsgType
  priority:     MsgPriority
  acknowledged: boolean
  sender_name?: string
}

export interface SendParams {
  route_id?:     string | null
  stop_id?:      string | null
  sender_id:     string
  sender_role:   MsgSenderRole
  recipient_id:  string
  subject?:      string
  message:       string
  msg_type?:     MsgType
  priority?:     MsgPriority
  sender_name?:  string
}

interface DispatchMessageStore {
  messages:    DispatchMessage[]
  sending:     boolean
  loadError:   string | null

  loadMessages:    (userId: string) => Promise<void>
  sendMessage:     (params: SendParams) => Promise<{ ok: boolean; error?: string }>
  markRead:        (id: string) => Promise<void>
  markAllRead:     (recipientId: string) => Promise<void>
  acknowledge:     (id: string) => Promise<void>
  addLocal:        (msg: DispatchMessage) => void
  clearMessages:   () => void
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useDispatchMessageStore = create<DispatchMessageStore>((set) => ({
  messages:  [],
  sending:   false,
  loadError: null,

  loadMessages: async (userId) => {
    set({ loadError: null })
    const { data, error } = await supabase
      .from('commercial_dispatch_messages')
      .select('*')
      .or(`recipient_id.eq.${userId},sender_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(300)
    if (error) { set({ loadError: 'Failed to load messages' }); return }
    set({ messages: (data ?? []) as DispatchMessage[] })
  },

  sendMessage: async (params) => {
    if (!params.message.trim()) return { ok: false, error: 'Message body is required' }
    set({ sending: true })
    const payload = {
      route_id:     params.route_id  ?? null,
      stop_id:      params.stop_id   ?? null,
      sender_id:    params.sender_id,
      sender_role:  params.sender_role,
      recipient_id: params.recipient_id,
      subject:      params.subject?.trim() || null,
      message:      params.message.trim(),
      msg_type:     params.msg_type  ?? 'general_dispatch',
      priority:     params.priority  ?? 'info',
      read:         false,
      acknowledged: false,
    }
    const { data, error } = await supabase
      .from('commercial_dispatch_messages')
      .insert(payload)
      .select()
      .single()
    set({ sending: false })
    if (error || !data) return { ok: false, error: error?.message ?? 'Send failed' }
    const inserted = data as DispatchMessage
    set(s => ({
      messages: [{ ...inserted, sender_name: params.sender_name }, ...s.messages],
    }))
    return { ok: true }
  },

  markRead: async (id) => {
    set(s => ({
      messages: s.messages.map(m => m.id === id ? { ...m, read: true } : m),
    }))
    await supabase
      .from('commercial_dispatch_messages')
      .update({ read: true })
      .eq('id', id)
  },

  markAllRead: async (recipientId) => {
    set(s => ({
      messages: s.messages.map(m =>
        m.recipient_id === recipientId && !m.read ? { ...m, read: true } : m
      ),
    }))
    await supabase
      .from('commercial_dispatch_messages')
      .update({ read: true })
      .eq('recipient_id', recipientId)
      .eq('read', false)
  },

  acknowledge: async (id) => {
    set(s => ({
      messages: s.messages.map(m =>
        m.id === id ? { ...m, acknowledged: true, read: true } : m
      ),
    }))
    await supabase
      .from('commercial_dispatch_messages')
      .update({ acknowledged: true, read: true })
      .eq('id', id)
  },

  addLocal: (msg) =>
    set(s => ({ messages: [msg, ...s.messages] })),

  clearMessages: () => set({ messages: [] }),
}))

// ── Label maps (shared across screens) ───────────────────────────────────────

export const MSG_TYPE_LABEL: Record<MsgType, string> = {
  text:                  'Message',
  dispatch_change:       'Dispatch Change',
  system:                'System',
  route_update:          'Route Update',
  delay_notice:          'Delay Notice',
  safety_warning:        'Safety Warning',
  warehouse_reroute:     'Warehouse Reroute',
  emergency_instruction: 'Emergency Instruction',
  general_dispatch:      'General Dispatch',
}

export const MSG_TYPE_ICON: Record<MsgType, string> = {
  text:                  '💬',
  dispatch_change:       '🔄',
  system:                '⚙️',
  route_update:          '🗺️',
  delay_notice:          '⏰',
  safety_warning:        '⚠️',
  warehouse_reroute:     '🏭',
  emergency_instruction: '🚨',
  general_dispatch:      '📋',
}

export const MSG_PRIORITY_COLOR: Record<MsgPriority, string> = {
  info:      '#00c8ff',
  warning:   '#fbbf24',
  critical:  '#f87171',
  emergency: '#ef4444',
}

export const MSG_PRIORITY_BG: Record<MsgPriority, string> = {
  info:      'rgba(0,200,255,0.1)',
  warning:   'rgba(251,191,36,0.1)',
  critical:  'rgba(248,113,113,0.1)',
  emergency: 'rgba(239,68,68,0.15)',
}

export const MSG_PRIORITY_LABEL: Record<MsgPriority, string> = {
  info:      'Info',
  warning:   'Warning',
  critical:  'Critical',
  emergency: 'Emergency',
}
