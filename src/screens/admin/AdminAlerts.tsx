import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { sendBroadcastAlert, getBroadcastAlerts } from '../../lib/admin'
import { useAuthStore } from '../../store/authStore'
import type { Role, BroadcastAlert } from '../../types'

const TARGET_OPTIONS: { value: Role | 'all'; label: string }[] = [
  { value: 'all', label: 'All Users' },
  { value: 'driver', label: 'Drivers only' },
  { value: 'warehouse_employee', label: 'Warehouse Employees only' },
  { value: 'warehouse_supervisor', label: 'Warehouse Supervisors only' },
  { value: 'partner', label: 'Partners only' },
  { value: 'consumer', label: 'Consumers only' },
]

const TARGET_BADGE: Record<string, { bg: string; color: string }> = {
  all:                  { bg: 'rgba(255,255,255,0.08)',  color: 'rgba(255,255,255,0.4)' },
  driver:               { bg: 'rgba(66,165,245,0.12)',   color: '#60a5fa' },
  warehouse_employee:   { bg: 'rgba(0,200,255,0.12)',    color: '#00c8ff' },
  warehouse_supervisor: { bg: 'rgba(124,77,255,0.12)',   color: '#c084fc' },
  partner:              { bg: 'rgba(0,230,118,0.1)',     color: '#4ade80' },
  consumer:             { bg: 'rgba(186,104,200,0.12)',  color: '#e879f9' },
}

const TARGET_LABELS: Record<string, string> = {
  all: 'All Users',
  driver: 'Drivers',
  warehouse_employee: 'Warehouse',
  warehouse_supervisor: 'Supervisors',
  partner: 'Partners',
  consumer: 'Consumers',
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

export function AdminAlerts() {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [target, setTarget] = useState<Role | 'all'>('all')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const { data: alerts = [], isLoading } = useQuery<BroadcastAlert[]>({
    queryKey: ['broadcast-alerts'],
    queryFn: getBroadcastAlerts,
  })

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !message.trim()) return
    setSending(true)
    try {
      await sendBroadcastAlert(user.id, target, message.trim())
      queryClient.invalidateQueries({ queryKey: ['broadcast-alerts'] })
      setMessage('')
      setSent(true)
      setTimeout(() => setSent(false), 3000)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Compose form */}
      <div
        className="rounded-2xl p-4 space-y-3"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(0,190,255,0.15)' }}
      >
        <p className="text-sm font-bold" style={{ color: '#ffffff' }}>Send Broadcast Alert</p>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Recipients
          </label>
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value as Role | 'all')}
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(0,190,255,0.15)',
              color: '#ffffff',
            }}
          >
            {TARGET_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} style={{ background: '#060e24' }}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Message
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder="Type your alert message…"
            className="w-full resize-none rounded-xl px-3 py-2.5 text-sm outline-none"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(0,190,255,0.15)',
              color: '#ffffff',
            }}
          />
        </div>

        <button
          onClick={handleSend}
          disabled={!message.trim() || sending}
          className="w-full rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-50 transition-opacity hover:opacity-90"
          style={{ background: sent ? 'rgba(0,230,118,0.2)' : 'linear-gradient(135deg,#0057e7,#00c8ff)', boxShadow: '0 4px 16px rgba(0,190,255,0.3)' }}
        >
          {sending ? 'Sending…' : sent ? '✓ Sent!' : 'Send Alert'}
        </button>
      </div>

      {/* Alert history */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>Recent Broadcasts</p>

        {isLoading ? (
          <div className="flex justify-center py-6">
            <div
              className="h-6 w-6 animate-spin rounded-full border-4"
              style={{ borderColor: '#00c8ff', borderTopColor: 'transparent' }}
            />
          </div>
        ) : alerts.length === 0 ? (
          <div
            className="rounded-2xl p-8 text-center"
            style={{ border: '1px dashed rgba(0,190,255,0.15)', background: 'rgba(255,255,255,0.02)' }}
          >
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>No broadcasts sent yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => {
              const badge = TARGET_BADGE[alert.target_role] ?? TARGET_BADGE.all
              return (
                <div
                  key={alert.id}
                  className="rounded-2xl p-4 space-y-2"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(0,190,255,0.15)' }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                      style={{ background: badge.bg, color: badge.color }}
                    >
                      → {TARGET_LABELS[alert.target_role] ?? alert.target_role}
                    </span>
                    <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{fmt(alert.created_at)}</span>
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>{alert.message}</p>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
