import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Role } from '../types'

/**
 * Subscribes to INSERT events on `broadcast_alerts` for a given role.
 * Calls `onNew` when a message arrives targeted at this role or 'all'.
 */
export function useBroadcastAlerts(role: Role | null, onNew: (message: string) => void) {
  const channelRef = useRef<RealtimeChannel | null>(null)
  const onNewRef = useRef(onNew)
  onNewRef.current = onNew

  useEffect(() => {
    if (!role) return

    channelRef.current = supabase
      .channel(`broadcasts-${role}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'broadcast_alerts' },
        (payload) => {
          const record = payload.new as { target_role: string; message: string }
          if (record.target_role === 'all' || record.target_role === role) {
            onNewRef.current(record.message)
          }
        },
      )
      .subscribe()

    return () => {
      channelRef.current?.unsubscribe()
    }
  }, [role])
}
