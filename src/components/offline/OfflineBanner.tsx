// OfflineBanner — connectivity status bar + sync action badges.
// Renders nothing when online and queue is empty.

import type { OfflineSyncState } from '../../hooks/useOfflineSync'

interface Props {
  isOnline:  boolean
  syncState: OfflineSyncState
}

const S = {
  bar: (bg: string): React.CSSProperties => ({
    padding: '8px 16px',
    background: bg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap' as const,
  }),
  left: {
    display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const,
  } as React.CSSProperties,
  badge: (color: string, bg: string): React.CSSProperties => ({
    fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
    background: bg, color, border: `1px solid ${color}40`,
  }),
  msg: {
    fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: 500,
  } as React.CSSProperties,
  btn: {
    fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6,
    background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
    color: '#fff', cursor: 'pointer',
  } as React.CSSProperties,
}

export function OfflineBanner({ isOnline, syncState }: Props) {
  const { pendingCount, failedCount, conflictCount, isSyncing, syncNow, clearSynced } = syncState
  const totalQueued = pendingCount + failedCount + conflictCount

  // ── Offline bar ───────────────────────────────────────────────────────────
  if (!isOnline) {
    return (
      <div style={S.bar('rgba(31,24,0,0.95)')}>
        <div style={S.left}>
          <span style={S.badge('#fbbf24', 'rgba(251,191,36,0.15)')}>📵 Offline Mode</span>
          <span style={S.msg}>Actions are saved as drafts and will sync automatically when reconnected.</span>
        </div>
        {pendingCount > 0 && (
          <span style={S.badge('#fbbf24', 'rgba(251,191,36,0.1)')}>
            {pendingCount} pending
          </span>
        )}
      </div>
    )
  }

  // ── Syncing bar ───────────────────────────────────────────────────────────
  if (isSyncing) {
    return (
      <div style={S.bar('rgba(14,36,31,0.95)')}>
        <div style={S.left}>
          <span style={S.badge('#4ade80', 'rgba(74,222,128,0.12)')}>↑ Syncing</span>
          <span style={S.msg}>Syncing pending actions…</span>
        </div>
        {pendingCount > 0 && (
          <span style={{ ...S.msg, opacity: 0.6 }}>{pendingCount} remaining</span>
        )}
      </div>
    )
  }

  // ── Online, queue clear ───────────────────────────────────────────────────
  if (totalQueued === 0) return null

  // ── Conflict bar (highest priority) ──────────────────────────────────────
  if (conflictCount > 0) {
    return (
      <div style={S.bar('rgba(40,10,10,0.97)')}>
        <div style={S.left}>
          <span style={S.badge('#f87171', 'rgba(248,113,113,0.15)')}>⚠ Sync Conflict</span>
          <span style={S.msg}>
            {conflictCount} action{conflictCount > 1 ? 's' : ''} changed while you were offline.
            Review before syncing.
          </span>
        </div>
        <button style={S.btn} onClick={() => void syncNow()}>Review & Retry</button>
      </div>
    )
  }

  // ── Failed bar ────────────────────────────────────────────────────────────
  if (failedCount > 0) {
    return (
      <div style={S.bar('rgba(40,10,10,0.97)')}>
        <div style={S.left}>
          <span style={S.badge('#f87171', 'rgba(248,113,113,0.15)')}>✗ Sync Failed</span>
          <span style={S.msg}>
            {failedCount} action{failedCount > 1 ? 's' : ''} could not sync.
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={S.btn} onClick={() => void syncNow()}>Retry</button>
          <button style={{ ...S.btn, opacity: 0.6 }} onClick={clearSynced}>Dismiss</button>
        </div>
      </div>
    )
  }

  // ── Pending (online but queue has items) ──────────────────────────────────
  return (
    <div style={S.bar('rgba(14,36,31,0.95)')}>
      <div style={S.left}>
        <span style={S.badge('#4ade80', 'rgba(74,222,128,0.12)')}>⏳ Pending Sync</span>
        <span style={S.msg}>
          {pendingCount} action{pendingCount > 1 ? 's' : ''} waiting to sync.
        </span>
      </div>
      <button style={S.btn} onClick={() => void syncNow()}>Sync Now</button>
    </div>
  )
}
