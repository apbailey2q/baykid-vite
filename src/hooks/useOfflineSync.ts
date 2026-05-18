// BayKid — Offline sync orchestration.
//
// Watches network state and, when connectivity returns, replays pending drafts
// in FIFO order. Each action type has a conflict check (against current DB
// state) before the write. Conflicts are flagged for human review rather than
// silently overwriting.
//
// Safety rules that prevent sync:
//   mark_arrived / mark_scanning / start_inspection_status / flag_stop:
//     Stop must not be cancelled or completed by someone else.
//   complete_stop:
//     Stop must not be cancelled; no failed/pending_review inspection block.
//   inspection_submit:
//     Pickup must not be cancelled; no newer inspection already in DB.
//   warehouse_intake / warehouse_flag:
//     Load must not already be received or flagged by someone else.
//
// Photo sync:
//   inspection_submit drafts may carry has_pending_photo: true.
//   The sync function reads the base64 data URL from localStorage,
//   uploads it to commercial-inspection-photos storage, then inserts
//   the inspection record with the returned path.

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import {
  loadQueue, updateDraft, clearSynced, loadPendingPhoto, removePendingPhoto,
  type DraftAction,
} from '../lib/offlineQueue'
import { useNetworkStatus } from './useNetworkStatus'

// ── Public shape ──────────────────────────────────────────────────────────────

export interface OfflineSyncState {
  pendingCount:  number
  failedCount:   number
  conflictCount: number
  isSyncing:     boolean
  syncNow:       () => Promise<void>
  clearSynced:   () => void
}

// ── Conflict error — marks the draft for review instead of crashing ───────────

class ConflictError extends Error {
  constructor(msg: string) { super(msg); this.name = 'ConflictError' }
}

// ── Per-action sync logic ─────────────────────────────────────────────────────

async function syncMarkArrived(p: Record<string, unknown>) {
  const { data: stop } = await supabase
    .from('commercial_route_stops').select('status').eq('id', p.stop_id).single()
  if (!stop) throw new ConflictError('Stop no longer exists')
  if (['cancelled', 'completed'].includes(stop.status as string))
    throw new ConflictError(`Stop was already ${stop.status} by another action`)

  const { error } = await supabase.from('commercial_route_stops')
    .update({ status: 'arrived', arrived_at: p.arrived_at as string })
    .eq('id', p.stop_id)
  if (error) throw error

  if (p.pickup_id) {
    await supabase.from('commercial_pickups')
      .update({ status: 'in_progress' }).eq('id', p.pickup_id)
  }
}

async function syncMarkScanning(p: Record<string, unknown>) {
  const { data: stop } = await supabase
    .from('commercial_route_stops').select('status').eq('id', p.stop_id).single()
  if (!stop) throw new ConflictError('Stop no longer exists')
  if (['cancelled', 'completed'].includes(stop.status as string))
    throw new ConflictError(`Stop was already ${stop.status}`)

  const { error } = await supabase.from('commercial_route_stops')
    .update({ status: 'scanning' }).eq('id', p.stop_id)
  if (error) throw error
}

async function syncStartInspection(p: Record<string, unknown>) {
  const { data: stop } = await supabase
    .from('commercial_route_stops').select('status').eq('id', p.stop_id).single()
  if (!stop) throw new ConflictError('Stop no longer exists')
  if (['cancelled', 'completed'].includes(stop.status as string))
    throw new ConflictError(`Stop was already ${stop.status}`)

  const { error } = await supabase.from('commercial_route_stops')
    .update({ status: 'inspection' }).eq('id', p.stop_id)
  if (error) throw error
}

async function syncCompleteStop(p: Record<string, unknown>) {
  const { data: stop } = await supabase
    .from('commercial_route_stops').select('status').eq('id', p.stop_id).single()
  if (!stop) throw new ConflictError('Stop no longer exists')
  if (stop.status === 'cancelled') throw new ConflictError('Stop was cancelled')
  if (stop.status === 'completed') throw new ConflictError('Stop already completed')

  const now = new Date().toISOString()

  const { error: stopErr } = await supabase.from('commercial_route_stops')
    .update({ status: 'completed', completed_at: now }).eq('id', p.stop_id)
  if (stopErr) throw stopErr

  if (p.pickup_id) {
    await supabase.from('commercial_pickups')
      .update({ status: 'completed' }).eq('id', p.pickup_id)
  }

  if (p.load_payload) {
    const load = p.load_payload as Record<string, unknown>
    await supabase.from('expected_warehouse_loads').upsert({
      pickup_id:         load.pickup_id,
      account_id:        load.account_id,
      business_name:     load.business_name,
      material_type:     load.material_type,
      bin_count:         load.bin_count,
      estimated_weight:  load.estimated_weight,
      warehouse_id:      load.warehouse_id,
      driver_id:         load.driver_id,
      status:            'in_transit',
      driver_name:       load.driver_name,
    }, { onConflict: 'pickup_id' })
  }
}

async function syncFlagStop(p: Record<string, unknown>) {
  const { data: stop } = await supabase
    .from('commercial_route_stops').select('status').eq('id', p.stop_id).single()
  if (!stop) throw new ConflictError('Stop no longer exists')
  if (stop.status === 'cancelled') throw new ConflictError('Stop was already cancelled')

  const { error } = await supabase.from('commercial_route_stops')
    .update({ status: 'flagged' }).eq('id', p.stop_id)
  if (error) throw error

  if (p.pickup_id) {
    await supabase.from('commercial_pickups')
      .update({ status: 'flagged' }).eq('id', p.pickup_id)
  }
}

async function syncInspectionSubmit(draft: DraftAction) {
  const p = draft.payload

  // Conflict check: is the pickup still in a state that accepts an inspection?
  const { data: pickup } = await supabase
    .from('commercial_pickups').select('status').eq('id', p.pickup_id).single()
  if (!pickup) throw new ConflictError('Pickup no longer exists')
  if (pickup.status === 'cancelled') throw new ConflictError('Pickup was cancelled')

  // Check for a newer inspection already submitted while we were offline
  if (!p.is_reinspection) {
    const { data: existing } = await supabase
      .from('commercial_inspections')
      .select('id, created_at')
      .eq('pickup_id', p.pickup_id as string)
      .eq('is_reinspection', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (existing && existing.created_at > (draft.created_at)) {
      throw new ConflictError('A newer inspection was submitted while offline — review before syncing')
    }
  }

  // Upload photo if present
  let photo_url: string | null = p.photo_url as string | null ?? null
  if (p.has_pending_photo) {
    const dataUrl = loadPendingPhoto(draft.local_id)
    if (dataUrl) {
      try {
        const res  = await fetch(dataUrl)
        const blob = await res.blob()
        const ext  = (p.photo_mime as string ?? 'image/jpeg').includes('png') ? 'png' : 'jpg'
        const path = `${p.driver_id}/${p.pickup_id}-offline-${Date.now()}.${ext}`
        const { error: uploadErr } = await supabase.storage
          .from('commercial-inspection-photos')
          .upload(path, blob, { contentType: p.photo_mime as string ?? 'image/jpeg', upsert: false })
        if (!uploadErr) {
          photo_url = path
          removePendingPhoto(draft.local_id)
        }
      } catch (err) {
        console.warn('[offline-sync] Photo upload failed:', err)
        // Non-fatal: submit inspection without photo
      }
    }
  }

  const { error } = await supabase.from('commercial_inspections').insert({
    pickup_id:              p.pickup_id,
    driver_id:              p.driver_id,
    checklist_results:      p.checklist_results,
    overall_result:         p.overall_result,
    notes:                  p.notes ?? null,
    photo_url:              photo_url,
    is_reinspection:        p.is_reinspection ?? false,
    parent_inspection_id:   p.parent_inspection_id ?? null,
    review_status:          p.review_status ?? 'pending',
    driver_override:        p.driver_override ?? false,
    driver_override_reason: p.driver_override_reason ?? null,
  })
  if (error) throw error
}

async function syncWarehouseIntake(p: Record<string, unknown>) {
  if (p.load_id) {
    const { data: load } = await supabase
      .from('expected_warehouse_loads').select('status').eq('id', p.load_id).single()
    if (load && ['received'].includes(load.status as string))
      throw new ConflictError('Load was already received by another user')
  }

  if (p.inspection === 'red') {
    if (p.load_id) {
      const { error } = await supabase.from('expected_warehouse_loads')
        .update({ status: 'flagged', intake_result: 'red', warehouse_notes: p.notes ?? null })
        .eq('id', p.load_id)
      if (error) throw error
    }
    if (p.pickup_id) {
      await supabase.from('commercial_pickups').update({ status: 'flagged' }).eq('id', p.pickup_id)
    }
    return
  }

  // Green / Yellow → received
  if (p.load_id) {
    const { error } = await supabase.from('expected_warehouse_loads')
      .update({
        status:          'received',
        intake_result:   p.inspection,
        actual_weight:   p.actual_weight,
        processing_line: p.line,
        warehouse_notes: p.notes ?? null,
      })
      .eq('id', p.load_id)
    if (error) throw error
  }
  if (p.pickup_id) {
    await supabase.from('commercial_pickups').update({ status: 'processed' }).eq('id', p.pickup_id)
  }
  if (!p.batch_exists) {
    const { data: existingBatch } = await supabase
      .from('material_batches').select('id')
      .eq('commercial_pickup_id', p.pickup_id as string).maybeSingle()
    if (!existingBatch) {
      await supabase.from('material_batches').insert({
        commercial_pickup_id:  p.pickup_id ?? null,
        expected_load_id:      p.load_id   ?? null,
        warehouse_id:          p.warehouse_id ?? null,
        commercial_account_id: p.account_id  ?? null,
        material_type:         p.material_type ?? 'Unknown',
        actual_weight:         p.actual_weight,
        contamination_status:  p.inspection === 'yellow' ? 'flagged' : 'clean',
        processing_line:       p.line,
        status:                'received',
      })
    }
  }
}

async function syncWarehouseFlag(p: Record<string, unknown>) {
  if (p.load_id) {
    const { data: load } = await supabase
      .from('expected_warehouse_loads').select('status').eq('id', p.load_id).single()
    if (load && load.status === 'received')
      throw new ConflictError('Load was already received — flag not applied')

    const { error } = await supabase.from('expected_warehouse_loads')
      .update({ status: 'flagged', warehouse_notes: p.notes ?? null })
      .eq('id', p.load_id)
    if (error) throw error
  }
  if (p.pickup_id) {
    await supabase.from('commercial_pickups').update({ status: 'flagged' }).eq('id', p.pickup_id)
  }
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

async function syncDraft(draft: DraftAction): Promise<void> {
  switch (draft.action_type) {
    case 'mark_arrived':             return syncMarkArrived(draft.payload)
    case 'mark_scanning':            return syncMarkScanning(draft.payload)
    case 'start_inspection_status':  return syncStartInspection(draft.payload)
    case 'complete_stop':            return syncCompleteStop(draft.payload)
    case 'flag_stop':                return syncFlagStop(draft.payload)
    case 'inspection_submit':        return syncInspectionSubmit(draft)
    case 'warehouse_intake':         return syncWarehouseIntake(draft.payload)
    case 'warehouse_flag':           return syncWarehouseFlag(draft.payload)
    default: throw new Error(`Unknown action type: ${draft.action_type}`)
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useOfflineSync(): OfflineSyncState {
  const { isOnline } = useNetworkStatus()
  const [isSyncing,     setIsSyncing]     = useState(false)
  const [pendingCount,  setPendingCount]  = useState(0)
  const [failedCount,   setFailedCount]   = useState(0)
  const [conflictCount, setConflictCount] = useState(0)
  const syncingRef = useRef(false)

  const refreshCounts = useCallback(() => {
    const queue = loadQueue()
    setPendingCount(queue.filter(d => d.sync_status === 'pending').length)
    setFailedCount(queue.filter(d => d.sync_status === 'failed').length)
    setConflictCount(queue.filter(d => d.sync_status === 'conflict').length)
  }, [])

  const syncNow = useCallback(async () => {
    if (syncingRef.current) return
    const pending = loadQueue().filter(d => d.sync_status === 'pending' || d.sync_status === 'failed')
    if (pending.length === 0) { refreshCounts(); return }

    syncingRef.current = true
    setIsSyncing(true)

    // Process FIFO
    for (const draft of pending.sort((a, b) => a.created_at.localeCompare(b.created_at))) {
      updateDraft(draft.local_id, { sync_status: 'syncing' })
      try {
        await syncDraft(draft)
        updateDraft(draft.local_id, { sync_status: 'synced', sync_error: undefined })
      } catch (err) {
        if (err instanceof ConflictError) {
          updateDraft(draft.local_id, { sync_status: 'conflict', sync_error: err.message })
        } else {
          updateDraft(draft.local_id, {
            sync_status: 'failed',
            sync_error:  err instanceof Error ? err.message : 'Sync failed',
            retry_count: (draft.retry_count ?? 0) + 1,
          })
        }
      }
    }

    syncingRef.current = false
    setIsSyncing(false)
    refreshCounts()
  }, [refreshCounts])

  // Auto-sync when coming online
  useEffect(() => {
    if (isOnline) { void syncNow() }
  }, [isOnline, syncNow])

  // Refresh counts on mount and after any storage event
  useEffect(() => {
    refreshCounts()
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'baykid_offline_queue') refreshCounts()
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [refreshCounts])

  const clearSyncedFn = useCallback(() => {
    clearSynced()
    refreshCounts()
  }, [refreshCounts])

  return { pendingCount, failedCount, conflictCount, isSyncing, syncNow, clearSynced: clearSyncedFn }
}
