import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

/**
 * Subscribes to INSERT events on the `alerts` table and calls `onNew`
 * whenever an admin's realtime listener should react (e.g. re-fetch).
 */
export function useRealtimeAlerts(onNew: () => void) {
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    channelRef.current = supabase
      .channel('realtime-alerts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'alerts' },
        () => onNew(),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'alerts' },
        () => onNew(),
      )
      .subscribe()

    return () => {
      channelRef.current?.unsubscribe()
    }
  }, [onNew])
}
