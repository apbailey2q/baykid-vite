import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getAllAlerts, acknowledgeAlert, resolveAlert } from '../../lib/admin'
import { useRealtimeAlerts } from '../../hooks/useRealtimeAlerts'
import { useToast } from '../../components/ui/Toast'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import type { AlertWithDriver } from '../../types'

const ALERT_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  medical_emergency:  { label: 'Medical Emergency',  color: '#FF1744', icon: '🚨' },
  hazardous_material: { label: 'Hazardous Material',  color: '#FF6D00', icon: '☣️' },
  safety_threat:      { label: 'Safety Threat',       color: '#FF6D00', icon: '⚠️' },
  vehicle_issue:      { label: 'Vehicle Issue',        color: '#FFD600', icon: '🚗' },
  contact_support:    { label: 'Contact Support',      color: '#00c8ff', icon: '📞' },
}

const STATUS_STYLE: Record<string, { bg: string; border: string; color: string }> = {
  open:         { bg: 'rgba(255,23,68,0.08)',   border: 'rgba(255,23,68,0.3)',   color: '#FF1744' },
  acknowledged: { bg: 'rgba(255,193,7,0.08)',   border: 'rgba(255,193,7,0.3)',   color: '#FFD600' },
  resolved:     { bg: 'rgba(0,230,118,0.06)',   border: 'rgba(0,230,118,0.2)',   color: '#00E676' },
}

export function EmergencyAlerts() {
  const qc = useQueryClient()
  const toast = useToast()

  const refetch = useCallback(() => qc.invalidateQueries({ queryKey: ['admin-alerts'] }), [qc])

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['admin-alerts'],
    queryFn: getAllAlerts,
    refetchInterval: 30_000,
  })

  useRealtimeAlerts(refetch)

  const acknowledgeMut = useMutation({
    mutationFn: acknowledgeAlert,
    onSuccess: () => { refetch(); toast.success('Alert acknowledged') },
    onError: () => toast.error('Failed to acknowledge alert'),
  })

  const resolveMut = useMutation({
    mutationFn: resolveAlert,
    onSuccess: () => { refetch(); toast.success('Alert resolved') },
    onError: () => toast.error('Failed to resolve alert'),
  })

  const openCount = alerts.filter((a) => a.status === 'open').length

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    )
  }

  if (alerts.length === 0) {
    return (
      <EmptyState
        icon="🟢"
        title="No alerts"
        description="Driver emergency alerts will appear here in real-time."
      />
    )
  }

  return (
    <div className="space-y-4">
      {openCount > 0 && (
        <div
          className="flex items-center gap-3 rounded-xl px-4 py-3"
          style={{ background: 'rgba(255,23,68,0.08)', border: '1px solid rgba(255,23,68,0.3)' }}
        >
          <span className="text-lg">🚨</span>
          <p className="text-sm font-bold" style={{ color: '#FF1744' }}>
            {openCount} open alert{openCount !== 1 ? 's' : ''} require attention
          </p>
        </div>
      )}

      {alerts.map((alert) => {
        const meta = ALERT_LABELS[alert.alert_type] ?? { label: alert.alert_type, color: 'rgba(255,255,255,0.4)', icon: '❓' }
        const statusStyle = STATUS_STYLE[alert.status]
        const busy = acknowledgeMut.isPending || resolveMut.isPending

        return (
          <div
            key={alert.id}
            className="rounded-2xl p-4 space-y-3"
            style={{ background: statusStyle.bg, border: `1px solid ${statusStyle.border}` }}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{meta.icon}</span>
                <div>
                  <p className="text-sm font-bold" style={{ color: meta.color }}>
                    {meta.label}
                  </p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    Driver: <span style={{ color: '#ffffff' }}>
                      {(alert as AlertWithDriver).driver_name ?? alert.driver_id.slice(0, 8)}
                    </span>
                  </p>
                </div>
              </div>
              <span
                className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize"
                style={{ background: `${statusStyle.border}22`, color: statusStyle.color }}
              >
                {alert.status}
              </span>
            </div>

            {alert.notes && (
              <p
                className="rounded-lg px-3 py-2 text-sm"
                style={{ background: 'rgba(255,255,255,0.05)', color: '#ffffff' }}
              >
                {alert.notes}
              </p>
            )}

            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {new Date(alert.created_at).toLocaleString('en-US', {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
              })}
            </p>

            {/* Actions */}
            {alert.status === 'open' && (
              <div className="flex gap-2">
                <button
                  onClick={() => acknowledgeMut.mutate(alert.id)}
                  disabled={busy}
                  className="flex-1 rounded-xl py-2 text-xs font-bold transition-opacity hover:opacity-80 disabled:opacity-50"
                  style={{ background: 'rgba(255,193,7,0.15)', border: '1px solid rgba(255,193,7,0.3)', color: '#FFD600' }}
                >
                  {acknowledgeMut.isPending ? <Spinner size="sm" color="#FFD600" /> : 'Acknowledge'}
                </button>
                <button
                  onClick={() => resolveMut.mutate(alert.id)}
                  disabled={busy}
                  className="flex-1 rounded-xl py-2 text-xs font-bold transition-opacity hover:opacity-80 disabled:opacity-50"
                  style={{ background: 'rgba(0,230,118,0.12)', border: '1px solid rgba(0,230,118,0.3)', color: '#00E676' }}
                >
                  {resolveMut.isPending ? <Spinner size="sm" color="#00E676" /> : 'Resolve'}
                </button>
              </div>
            )}
            {alert.status === 'acknowledged' && (
              <button
                onClick={() => resolveMut.mutate(alert.id)}
                disabled={busy}
                className="w-full rounded-xl py-2 text-xs font-bold transition-opacity hover:opacity-80 disabled:opacity-50"
                style={{ background: 'rgba(0,230,118,0.12)', border: '1px solid rgba(0,230,118,0.3)', color: '#00E676' }}
              >
                Mark Resolved
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
