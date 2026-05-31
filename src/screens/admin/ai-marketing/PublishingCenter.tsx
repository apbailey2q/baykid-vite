// PublishingCenter.tsx — Social Publishing Engine UI
// BayKid AI Marketing Center
//
// Three sub-tabs:
//   1. Platform Connections — connect / disconnect accounts via mock OAuth
//   2. Publishing Queue    — active jobs (queued / publishing / retrying) + process controls
//   3. Publish History     — completed / failed / cancelled jobs

import { useState, useEffect, useMemo } from 'react'
import type { ConnectedAccount, PlatformId, PublishJob, PublishHistoryEntry } from '../../../lib/publishTypes'
import { PLATFORM_CONFIGS } from '../../../lib/publishTypes'
import {
  loadAccounts, subscribeAccounts,
  completeMockOAuth, disconnectAccount, reconnectAccount, deleteAccount,
  isExpiringSoon, isExpired, accountStatusLabel,
} from '../../../lib/platformConnections'
import {
  loadJobs, loadHistory, subscribeJobs,
  processQueue, processJob, retryJob, cancelJob, deleteJob,
  createPublishJob,
  getQueueStats, PUBLISH_STATUS_META,
} from '../../../lib/publishingEngine'
import type { AIContentResult, PostStatus } from '../../../lib/aiMarketing'
import { WORKFLOW_V2, STATUS_META } from '../../../lib/aiMarketing'
import { useMarketing, usePosts } from '../../../lib/marketingStore'
import { StatusBadge } from '../../../components/ui/StatusBadge'
import { SchedulePicker } from '../../../components/ai-marketing/SchedulePicker'

// ── Style helpers ──────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  color: '#fff', borderRadius: 8, padding: '8px 12px',
  fontSize: 12, outline: 'none', width: '100%', boxSizing: 'border-box',
}

function ghostBtn(o?: React.CSSProperties): React.CSSProperties {
  return {
    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)',
    color: 'rgba(255,255,255,0.65)', borderRadius: 8, padding: '6px 12px',
    fontWeight: 600, fontSize: 11, cursor: 'pointer', ...o,
  }
}

// ── Toast ──────────────────────────────────────────────────────────────────────

interface Toast { id: number; message: string; type: 'success' | 'info' | 'error' | 'warn' }

function ToastStack({ toasts }: { toasts: Toast[] }) {
  const colors = {
    success: 'rgba(34,197,94,0.92)', error: 'rgba(248,113,113,0.92)',
    info: 'rgba(0,200,255,0.92)',    warn: 'rgba(251,146,60,0.92)',
  }
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 9999, pointerEvents: 'none' }}>
      {toasts.map((t) => (
        <div key={t.id} style={{ background: colors[t.type], color: '#fff', borderRadius: 12, padding: '10px 18px', fontWeight: 700, fontSize: 13, boxShadow: '0 4px 20px rgba(0,0,0,0.4)', animation: 'fadeUp 0.25s ease' }}>
          {t.message}
        </div>
      ))}
      <style>{`@keyframes fadeUp { from { opacity:0; transform:translateY(8px);} to { opacity:1; transform:translateY(0);} }`}</style>
    </div>
  )
}

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([])
  function show(message: string, type: Toast['type'] = 'success') {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000)
  }
  return { toasts, show }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDate(iso: string | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtDateTime(iso: string | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return (
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  )
}

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60)   return `${secs}s ago`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400)return `${Math.floor(secs / 3600)}h ago`
  return `${Math.floor(secs / 86400)}d ago`
}

// ══════════════════════════════════════════════════════════════════════════════
// Platform Connections Tab
// ══════════════════════════════════════════════════════════════════════════════

const PLATFORM_ORDER: PlatformId[] = ['instagram', 'tiktok', 'facebook', 'linkedin', 'twitter']

function ConnectionsTab({ onToast }: { onToast: (msg: string, type?: Toast['type']) => void }) {
  const [accounts,      setAccounts]      = useState<ConnectedAccount[]>(() => loadAccounts())
  const [connecting,    setConnecting]    = useState<PlatformId | null>(null)
  const [showHandleFor, setShowHandleFor] = useState<PlatformId | null>(null)
  const [customHandle,  setCustomHandle]  = useState('')

  // Live updates when another component changes accounts
  useEffect(() => subscribeAccounts(setAccounts), [])

  async function handleConnect(platform: PlatformId) {
    setConnecting(platform)
    setShowHandleFor(null)
    try {
      const result = await completeMockOAuth(platform, customHandle.trim() || undefined)
      if (result.success && result.account) {
        setAccounts(loadAccounts())
        onToast(`✅ Connected to ${PLATFORM_CONFIGS[platform].name}`, 'success')
      } else {
        onToast(`❌ ${result.error ?? 'Connection failed'}`, 'error')
      }
    } catch {
      onToast('❌ OAuth error — try again', 'error')
    } finally {
      setConnecting(null)
      setCustomHandle('')
    }
  }

  function handleDisconnect(id: string, name: string) {
    disconnectAccount(id)
    setAccounts(loadAccounts())
    onToast(`Disconnected ${name}`, 'info')
  }

  function handleReconnect(id: string, name: string) {
    reconnectAccount(id)
    setAccounts(loadAccounts())
    onToast(`Reconnected ${name}`, 'success')
  }

  function handleDelete(id: string) {
    deleteAccount(id)
    setAccounts(loadAccounts())
    onToast('Account removed', 'info')
  }

  const activeByPlatform = (platform: PlatformId) =>
    accounts.filter((a) => a.platform === platform)

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ color: '#fff', fontWeight: 700, fontSize: 16, margin: '0 0 4px' }}>🔌 Platform Connections</h3>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, margin: 0 }}>
          Connect your social accounts to enable publishing. Tokens are stored as metadata only — actual OAuth flow is mocked for demo.
        </p>
      </div>

      {/* Platform cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {PLATFORM_ORDER.map((platformId) => {
          const cfg = PLATFORM_CONFIGS[platformId]
          const platformAccounts = activeByPlatform(platformId)
          const hasActive = platformAccounts.some((a) => a.isActive)
          const isLoading = connecting === platformId
          const showingHandle = showHandleFor === platformId

          return (
            <div
              key={platformId}
              style={{
                background: hasActive ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${hasActive ? cfg.colorBorder : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 14,
                padding: 16,
                transition: 'border-color 0.2s',
              }}
            >
              {/* Platform header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* Icon + name */}
                <div style={{ width: 40, height: 40, borderRadius: 10, background: cfg.colorBg, border: `1px solid ${cfg.colorBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                  {cfg.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>{cfg.name}</div>
                  <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>
                    {cfg.scopes.slice(0, 2).join(' · ')}{cfg.scopes.length > 2 ? ` +${cfg.scopes.length - 2}` : ''}
                  </div>
                </div>

                {/* Connect button */}
                {!hasActive && !showingHandle && (
                  <button
                    onClick={() => { setShowHandleFor(platformId); setCustomHandle('') }}
                    disabled={isLoading}
                    style={{
                      background: cfg.colorBg, border: `1px solid ${cfg.colorBorder}`,
                      color: cfg.color, borderRadius: 8, padding: '8px 16px',
                      fontWeight: 700, fontSize: 12, cursor: isLoading ? 'wait' : 'pointer',
                      opacity: isLoading ? 0.6 : 1,
                    }}
                  >
                    {isLoading ? '⏳ Connecting…' : '+ Connect'}
                  </button>
                )}
              </div>

              {/* Connect form (handle input) */}
              {showingHandle && !hasActive && (
                <div style={{ marginTop: 14, background: 'rgba(0,0,0,0.2)', borderRadius: 10, padding: 14 }}>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, marginBottom: 8 }}>
                    Simulating OAuth for {cfg.name}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <input
                        style={inputStyle}
                        placeholder={`Handle (default: ${cfg.mockHandle})`}
                        value={customHandle}
                        onChange={(e) => setCustomHandle(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleConnect(platformId)}
                      />
                    </div>
                    <button
                      onClick={() => handleConnect(platformId)}
                      disabled={isLoading}
                      style={{ background: `linear-gradient(135deg, ${cfg.color}, ${cfg.color}cc)`, border: 'none', color: '#fff', borderRadius: 8, padding: '8px 18px', fontWeight: 700, fontSize: 12, cursor: 'pointer', opacity: isLoading ? 0.6 : 1 }}
                    >
                      {isLoading ? '⏳ Connecting…' : 'Authorize →'}
                    </button>
                    <button onClick={() => setShowHandleFor(null)} style={ghostBtn()}>Cancel</button>
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10, marginTop: 8 }}>
                    In production this would redirect to {cfg.name}'s OAuth consent screen.
                  </div>
                </div>
              )}

              {/* Connected accounts list */}
              {platformAccounts.length > 0 && (
                <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {platformAccounts.map((acct) => {
                    const statusInfo = accountStatusLabel(acct)
                    const expired    = isExpired(acct)
                    const expiring   = isExpiringSoon(acct)

                    return (
                      <div key={acct.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                        {/* Status dot */}
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusInfo.color, flexShrink: 0 }} />

                        {/* Info */}
                        <div style={{ flex: 1 }}>
                          <div style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>{acct.accountHandle}</div>
                          <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, display: 'flex', gap: 10, marginTop: 2, flexWrap: 'wrap' }}>
                            <span>{acct.accountName}</span>
                            <span>Connected {fmtDate(acct.connectedAt)}</span>
                            {acct.expiresAt && (
                              <span style={{ color: expired ? '#f87171' : expiring ? '#fbbf24' : 'rgba(255,255,255,0.3)' }}>
                                {expired ? '⚠️ Token expired' : expiring ? `⚡ Expires ${fmtDate(acct.expiresAt)}` : `Expires ${fmtDate(acct.expiresAt)}`}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Status badge */}
                        <span style={{ color: statusInfo.color, fontSize: 10, fontWeight: 700, background: 'rgba(255,255,255,0.05)', borderRadius: 20, padding: '2px 8px', flexShrink: 0 }}>
                          {statusInfo.label}
                        </span>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: 6 }}>
                          {acct.isActive ? (
                            <button onClick={() => handleDisconnect(acct.id, acct.accountHandle)} style={ghostBtn({ color: '#fbbf24', borderColor: 'rgba(251,191,36,0.25)', fontSize: 10, padding: '4px 10px' })}>
                              Disconnect
                            </button>
                          ) : (
                            <button onClick={() => handleReconnect(acct.id, acct.accountHandle)} style={ghostBtn({ color: '#22c55e', borderColor: 'rgba(34,197,94,0.25)', fontSize: 10, padding: '4px 10px' })}>
                              Reconnect
                            </button>
                          )}
                          <button onClick={() => handleDelete(acct.id)} style={ghostBtn({ color: 'rgba(248,113,113,0.7)', borderColor: 'rgba(248,113,113,0.2)', fontSize: 10, padding: '4px 8px' })}>
                            ✕
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Not connected state */}
              {platformAccounts.length === 0 && !showingHandle && (
                <div style={{ marginTop: 10, color: 'rgba(255,255,255,0.2)', fontSize: 11 }}>
                  Not connected
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Summary */}
      {accounts.filter((a) => a.isActive).length > 0 && (
        <div style={{ marginTop: 20, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 12, padding: '12px 16px' }}>
          <div style={{ color: '#22c55e', fontWeight: 700, fontSize: 12 }}>
            ✅ {accounts.filter((a) => a.isActive).length} platform{accounts.filter((a) => a.isActive).length !== 1 ? 's' : ''} connected — ready to publish
          </div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 4 }}>
            Go to <strong style={{ color: 'rgba(255,255,255,0.6)' }}>Approval Queue</strong> → approve a post → click <strong style={{ color: 'rgba(255,255,255,0.6)' }}>🚀 Publish Now</strong> to queue it.
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Publishing Queue Tab — V2 (post-centric, behind WORKFLOW_V2)
// ══════════════════════════════════════════════════════════════════════════════

// v2 only — Approval Queue owns drafts/pending/rejected; Calendar/History own 'posted'.
const QUEUE_V2_VISIBLE_STATUSES: PostStatus[] = [
  'approved', 'queued', 'scheduled', 'publishing', 'failed',
]

function defaultScheduleLocal(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(9, 0, 0, 0)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function QueueTabV2({ onToast }: { onToast: (msg: string, type?: Toast['type']) => void }) {
  const posts = usePosts()
  const { schedulePost, cancelPost, retryPost } = useMarketing()
  const [jobs, setJobs] = useState<PublishJob[]>(() => loadJobs())
  const [busyId, setBusyId] = useState<string | null>(null)
  const [reschedulingId, setReschedulingId] = useState<string | null>(null)
  const [scheduleValue, setScheduleValue] = useState('')
  const [scheduleTz, setScheduleTz] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone)

  useEffect(() => {
    console.info('[v2] QueueTabV2 mounted', { visibleStatuses: QUEUE_V2_VISIBLE_STATUSES, totalPosts: posts.length })
    return subscribeJobs(setJobs)
  }, [])

  const visible = useMemo(() => {
    const matched = posts
      .filter((p) => QUEUE_V2_VISIBLE_STATUSES.includes(p.status))
      .sort((a, b) => {
        const aTime = a.scheduledFor ? new Date(a.scheduledFor).getTime() : new Date(a.createdAt).getTime()
        const bTime = b.scheduledFor ? new Date(b.scheduledFor).getTime() : new Date(b.createdAt).getTime()
        return aTime - bTime
      })
    console.info('[v2] QueueTabV2 filter', {
      allowed: QUEUE_V2_VISIBLE_STATUSES,
      matched: matched.length,
      total: posts.length,
      byStatus: posts.reduce<Record<string, number>>((acc, p) => { acc[p.status] = (acc[p.status] ?? 0) + 1; return acc }, {}),
    })
    return matched
  }, [posts])

  const stats = useMemo(() => {
    const s: Record<PostStatus, number> = {
      draft: 0, pending_approval: 0, approved: 0, queued: 0, scheduled: 0,
      publishing: 0, posted: 0, rejected: 0, failed: 0, cancelled: 0,
    }
    for (const p of visible) s[p.status]++
    return s
  }, [visible])

  function jobForPost(postId: string): PublishJob | undefined {
    return jobs.find(
      (j) =>
        j.postId === postId &&
        (j.status === 'queued' || j.status === 'publishing' || j.status === 'retrying' || j.status === 'failed'),
    )
  }

  async function handlePublishNow(post: AIContentResult) {
    if (busyId) return
    setBusyId(post.id)
    try {
      let job = jobForPost(post.id)
      if (!job) {
        const account = loadAccounts().find((a) => a.isActive && (!post.platform || a.platform === post.platform))
          ?? loadAccounts().find((a) => a.isActive)
        if (!account) {
          onToast('Connect a social account first', 'warn')
          return
        }
        try {
          job = createPublishJob({ postId: post.id, accountId: account.id, autoPublishAllowed: true })
        } catch (err) {
          onToast(err instanceof Error ? err.message : 'Failed to queue post', 'error')
          return
        }
      }
      await processJob(job.id)
      setJobs(loadJobs())
      onToast(`Publishing "${post.title}"…`, 'info')
    } finally {
      setBusyId(null)
    }
  }

  function handleRescheduleStart(post: AIContentResult) {
    setReschedulingId(post.id)
    setScheduleValue(defaultScheduleLocal())
  }

  async function handleRescheduleConfirm(post: AIContentResult) {
    if (!scheduleValue) return
    const iso = new Date(scheduleValue).toISOString()
    const r = await schedulePost(post.id, iso, scheduleTz)
    if (r.ok) onToast(`Rescheduled "${post.title}" for ${new Date(iso).toLocaleString()}`, 'success')
    setReschedulingId(null)
  }

  async function handleCancel(post: AIContentResult) {
    if (busyId) return
    setBusyId(post.id)
    try {
      const r = await cancelPost(post.id)
      if (r.ok) onToast(`Cancelled "${post.title}"`, 'info')
    } finally {
      setBusyId(null)
    }
  }

  async function handleRetry(post: AIContentResult) {
    if (busyId) return
    setBusyId(post.id)
    try {
      const r = await retryPost(post.id)
      if (r.ok) onToast(`Requeued "${post.title}" for retry`, 'info')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ color: '#fff', fontWeight: 700, fontSize: 16, margin: '0 0 4px' }}>📡 Publishing Queue</h3>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, margin: 0 }}>
          Approved, queued, scheduled, publishing and failed posts. Use Publish Now to send immediately or Reschedule to adjust timing.
        </p>
      </div>

      {/* Stats row — counts by post.status */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {QUEUE_V2_VISIBLE_STATUSES.map((status) => {
          const count = stats[status]
          if (count === 0) return null
          const meta = STATUS_META[status]
          return (
            <div key={status} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '5px 12px', display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>{count}</span>
              <StatusBadge variant={meta.badgeVariant} label={`${meta.icon} ${meta.label}`} size="sm" />
            </div>
          )
        })}
      </div>

      {/* Post list */}
      {visible.length === 0 ? (
        <div style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: 60, fontSize: 13, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16 }}>
          Nothing in the publishing pipeline.<br />
          Approve a post in the Approval Queue to send it here.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {visible.map((post) => {
            const meta = STATUS_META[post.status]
            const job = jobForPost(post.id)
            const cfg = post.platform ? PLATFORM_CONFIGS[post.platform as PlatformId] : null
            const isBusy = busyId === post.id
            const isRescheduling = reschedulingId === post.id
            const canPublishNow = post.status === 'approved' || post.status === 'queued' || post.status === 'scheduled' || post.status === 'failed'
            const canReschedule = post.status === 'queued' || post.status === 'scheduled' || post.status === 'approved'
            const canCancel = post.status === 'queued' || post.status === 'scheduled' || post.status === 'publishing'
            const canRetry = post.status === 'failed'

            return (
              <div key={post.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  {cfg && (
                    <div style={{ width: 34, height: 34, borderRadius: 8, background: cfg.colorBg, border: `1px solid ${cfg.colorBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                      {cfg.icon}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#fff', fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {post.title}
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 3, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      {cfg && <span>{cfg.name}{job?.accountHandle ? ` · ${job.accountHandle}` : ''}</span>}
                      {post.scheduledFor && <span>📅 {fmtDateTime(post.scheduledFor)}</span>}
                      <span>{timeAgo(post.createdAt)}</span>
                    </div>
                    {job?.lastError && post.status === 'failed' && (
                      <div style={{ color: '#f87171', fontSize: 11, marginTop: 5, background: 'rgba(248,113,113,0.08)', borderRadius: 6, padding: '4px 8px' }}>
                        ⚠️ {job.lastError}
                        {job.retryCount > 0 && <span style={{ opacity: 0.7 }}> (attempt {job.retryCount}/{job.maxRetries})</span>}
                      </div>
                    )}
                  </div>
                  <div style={{ flexShrink: 0 }}>
                    <StatusBadge variant={meta.badgeVariant} label={`${meta.icon} ${meta.label}`} />
                  </div>
                </div>

                {isRescheduling && (
                  <div style={{ marginTop: 12 }}>
                    <SchedulePicker
                      value={scheduleValue}
                      timezone={scheduleTz}
                      onValueChange={setScheduleValue}
                      onTimezoneChange={setScheduleTz}
                      onConfirm={() => handleRescheduleConfirm(post)}
                      onCancel={() => setReschedulingId(null)}
                    />
                  </div>
                )}

                {!isRescheduling && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                    {canPublishNow && (
                      <button
                        onClick={() => handlePublishNow(post)}
                        disabled={isBusy}
                        style={ghostBtn({ color: '#a78bfa', borderColor: 'rgba(167,139,250,0.3)', background: 'rgba(167,139,250,0.08)', fontSize: 10, padding: '4px 10px', opacity: isBusy ? 0.5 : 1, cursor: isBusy ? 'wait' : 'pointer' })}
                      >
                        🚀 Publish Now
                      </button>
                    )}
                    {canReschedule && (
                      <button
                        onClick={() => handleRescheduleStart(post)}
                        disabled={isBusy}
                        style={ghostBtn({ color: '#00c8ff', borderColor: 'rgba(0,200,255,0.3)', background: 'rgba(0,200,255,0.08)', fontSize: 10, padding: '4px 10px', opacity: isBusy ? 0.5 : 1 })}
                      >
                        📅 Reschedule
                      </button>
                    )}
                    {canCancel && (
                      <button
                        onClick={() => handleCancel(post)}
                        disabled={isBusy}
                        style={ghostBtn({ color: '#f87171', borderColor: 'rgba(248,113,113,0.25)', fontSize: 10, padding: '4px 10px', opacity: isBusy ? 0.5 : 1 })}
                      >
                        ✕ Cancel
                      </button>
                    )}
                    {canRetry && (
                      <button
                        onClick={() => handleRetry(post)}
                        disabled={isBusy}
                        style={ghostBtn({ color: '#fbbf24', borderColor: 'rgba(251,191,36,0.3)', background: 'rgba(251,191,36,0.08)', fontSize: 10, padding: '4px 10px', opacity: isBusy ? 0.5 : 1 })}
                      >
                        🔄 Retry
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Publishing Queue Tab
// ══════════════════════════════════════════════════════════════════════════════

function QueueTab({ onToast }: { onToast: (msg: string, type?: Toast['type']) => void }) {
  if (WORKFLOW_V2) return <QueueTabV2 onToast={onToast} />
  const [jobs,       setJobs]       = useState<PublishJob[]>(() => loadJobs())
  const [processing, setProcessing] = useState(false)
  const [autoRun,    setAutoRun]    = useState(false)

  // Live updates
  useEffect(() => subscribeJobs(setJobs), [])

  // Auto-process interval (when enabled)
  useEffect(() => {
    if (!autoRun) return
    const id = setInterval(() => {
      processQueue().then((count) => {
        if (count > 0) setJobs(loadJobs())
      })
    }, 8000)
    return () => clearInterval(id)
  }, [autoRun])

  async function handleProcessNow() {
    setProcessing(true)
    try {
      const count = await processQueue()
      setJobs(loadJobs())
      onToast(count > 0 ? `⚡ Processed ${count} job${count !== 1 ? 's' : ''}` : 'No due jobs', 'info')
    } finally {
      setProcessing(false)
    }
  }

  function handleRetry(jobId: string) {
    retryJob(jobId)
    setJobs(loadJobs())
    onToast('🔄 Job queued for retry', 'info')
  }

  function handleCancel(jobId: string) {
    cancelJob(jobId)
    setJobs(loadJobs())
    onToast('✕ Job cancelled', 'info')
  }

  function handleDelete(jobId: string) {
    deleteJob(jobId)
    setJobs(loadJobs())
    onToast('🗑️ Job removed', 'info')
  }

  const stats = (() => {
    const s = { queued: 0, publishing: 0, retrying: 0, posted: 0, failed: 0, cancelled: 0 }
    for (const j of jobs) if (j.status in s) (s as Record<string, number>)[j.status]++
    return s
  })()

  const active    = jobs.filter((j) => j.status === 'queued' || j.status === 'publishing' || j.status === 'retrying')
  const completed = jobs.filter((j) => j.status === 'posted' || j.status === 'failed' || j.status === 'cancelled')

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ color: '#fff', fontWeight: 700, fontSize: 16, margin: '0 0 4px' }}>📡 Publishing Queue</h3>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, margin: 0 }}>
            Jobs are processed sequentially to avoid rate limits. Mock mode active (85% success rate).
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Auto-run toggle */}
          <button
            onClick={() => setAutoRun((v) => !v)}
            style={ghostBtn({ color: autoRun ? '#22c55e' : 'rgba(255,255,255,0.5)', borderColor: autoRun ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.15)', background: autoRun ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.07)' })}
          >
            {autoRun ? '⏸ Auto-run ON' : '▶ Auto-run OFF'}
          </button>
          <button
            onClick={handleProcessNow}
            disabled={processing || active.length === 0}
            style={{
              background: 'rgba(0,200,255,0.15)', border: '1px solid rgba(0,200,255,0.35)',
              color: '#00c8ff', borderRadius: 8, padding: '7px 16px',
              fontWeight: 700, fontSize: 12,
              cursor: processing || active.length === 0 ? 'not-allowed' : 'pointer',
              opacity: active.length === 0 ? 0.5 : 1,
            }}
          >
            {processing ? '⏳ Processing…' : '⚡ Process Now'}
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {(Object.entries(PUBLISH_STATUS_META) as [string, typeof PUBLISH_STATUS_META[keyof typeof PUBLISH_STATUS_META]][]).map(([status, meta]) => {
          const count = (stats as Record<string, number>)[status] ?? 0
          if (count === 0) return null
          return (
            <div key={status} style={{ background: meta.bg, border: `1px solid ${meta.border}`, borderRadius: 10, padding: '5px 12px', display: 'flex', gap: 5, alignItems: 'center' }}>
              <span style={{ color: meta.color, fontWeight: 700, fontSize: 14 }}>{count}</span>
              <span style={{ color: meta.color, fontSize: 11 }}>{meta.icon} {meta.label}</span>
            </div>
          )
        })}
      </div>

      {/* Active jobs */}
      {active.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 10 }}>
            Active ({active.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {active.map((job) => <JobCard key={job.id} job={job} onRetry={handleRetry} onCancel={handleCancel} onDelete={handleDelete} />)}
          </div>
        </div>
      )}

      {/* Recent completed (last 10) */}
      {completed.length > 0 && (
        <div>
          <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 10 }}>
            Recent Completed
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {completed.slice(0, 10).map((job) => <JobCard key={job.id} job={job} onRetry={handleRetry} onCancel={handleCancel} onDelete={handleDelete} />)}
          </div>
        </div>
      )}

      {jobs.length === 0 && (
        <div style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: 60, fontSize: 13, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16 }}>
          No publish jobs yet.<br />
          Approve a post → click <strong style={{ color: 'rgba(255,255,255,0.5)' }}>🚀 Publish Now</strong> in the Approval Queue.
        </div>
      )}
    </div>
  )
}

// ── JobCard ────────────────────────────────────────────────────────────────────

function JobCard({ job, onRetry, onCancel, onDelete }: {
  job: PublishJob
  onRetry:  (id: string) => void
  onCancel: (id: string) => void
  onDelete: (id: string) => void
}) {
  const meta    = PUBLISH_STATUS_META[job.status]
  const cfg     = PLATFORM_CONFIGS[job.platform]
  const active  = job.status === 'queued' || job.status === 'publishing' || job.status === 'retrying'

  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${meta.border}`, borderRadius: 12, padding: '12px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {/* Platform icon */}
        <div style={{ width: 34, height: 34, borderRadius: 8, background: cfg.colorBg, border: `1px solid ${cfg.colorBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
          {cfg.icon}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {job.postTitle}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 3, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <span>{cfg.name} · {job.accountHandle}</span>
            {job.scheduledFor && <span>📅 {fmtDateTime(job.scheduledFor)}</span>}
            <span>{timeAgo(job.createdAt)}</span>
            {job.isMock && <span style={{ color: 'rgba(0,200,255,0.5)', fontSize: 10 }}>MOCK</span>}
          </div>
          {job.lastError && (
            <div style={{ color: '#f87171', fontSize: 11, marginTop: 5, background: 'rgba(248,113,113,0.08)', borderRadius: 6, padding: '4px 8px' }}>
              ⚠️ {job.lastError}
              {job.retryCount > 0 && <span style={{ opacity: 0.7 }}> (attempt {job.retryCount}/{job.maxRetries})</span>}
            </div>
          )}
          {job.publishedUrl && (
            <div style={{ marginTop: 6 }}>
              <a href={job.publishedUrl} target="_blank" rel="noopener noreferrer"
                style={{ color: '#00c8ff', fontSize: 11, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                🔗 {job.publishedUrl.slice(0, 55)}{job.publishedUrl.length > 55 ? '…' : ''}
              </a>
            </div>
          )}
        </div>

        {/* Status badge */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <span style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}`, borderRadius: 20, padding: '3px 10px', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>
            {meta.icon} {meta.label}
          </span>
          {job.status === 'publishing' && (
            <div style={{ width: 20, height: 20, border: '2px solid rgba(0,200,255,0.3)', borderTopColor: '#00c8ff', borderRadius: '50%', animation: 'ai-spin 0.8s linear infinite' }} />
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
        {job.status === 'failed' && (
          <button onClick={() => onRetry(job.id)} style={ghostBtn({ color: '#a78bfa', borderColor: 'rgba(167,139,250,0.3)', background: 'rgba(167,139,250,0.08)', fontSize: 10, padding: '4px 10px' })}>
            🔄 Retry
          </button>
        )}
        {active && (
          <button onClick={() => onCancel(job.id)} style={ghostBtn({ color: '#f87171', borderColor: 'rgba(248,113,113,0.25)', fontSize: 10, padding: '4px 10px' })}>
            ✕ Cancel
          </button>
        )}
        {!active && (
          <button onClick={() => onDelete(job.id)} style={ghostBtn({ color: 'rgba(248,113,113,0.6)', borderColor: 'rgba(248,113,113,0.2)', fontSize: 10, padding: '4px 10px' })}>
            🗑️ Remove
          </button>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Publish History Tab
// ══════════════════════════════════════════════════════════════════════════════

function HistoryTab() {
  const [history,    setHistory]    = useState<PublishHistoryEntry[]>(() => loadHistory())
  const [platFilter, setPlatFilter] = useState<PlatformId | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'posted' | 'failed' | 'cancelled'>('all')

  // Reload on job changes
  useEffect(() => subscribeJobs(() => setHistory(loadHistory())), [])

  const filtered = history.filter((h) => {
    if (platFilter   !== 'all' && h.platform !== platFilter)  return false
    if (statusFilter !== 'all' && h.status !== statusFilter)  return false
    return true
  })

  const statusColors: Record<string, string> = {
    posted:    '#22c55e',
    failed:    '#f87171',
    cancelled: 'rgba(255,255,255,0.35)',
  }
  const statusIcons: Record<string, string> = {
    posted: '✅', failed: '❌', cancelled: '✕',
  }

  return (
    <div>
      {/* Header + filters */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ color: '#fff', fontWeight: 700, fontSize: 16, margin: '0 0 4px' }}>📋 Publish History</h3>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, margin: 0 }}>
            Last {Math.min(history.length, 200)} publish events across all platforms.
          </p>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} style={{ ...inputStyle, width: 'auto', minWidth: 120 }}>
            <option value="all">All Results</option>
            <option value="posted">Posted ✅</option>
            <option value="failed">Failed ❌</option>
            <option value="cancelled">Cancelled ✕</option>
          </select>
          <select value={platFilter} onChange={(e) => setPlatFilter(e.target.value as PlatformId | 'all')} style={{ ...inputStyle, width: 'auto', minWidth: 130 }}>
            <option value="all">All Platforms</option>
            {(Object.keys(PLATFORM_CONFIGS) as PlatformId[]).map((p) => (
              <option key={p} value={p}>{PLATFORM_CONFIGS[p].icon} {PLATFORM_CONFIGS[p].name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* History list */}
      {filtered.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.map((entry) => {
            const cfg   = PLATFORM_CONFIGS[entry.platform]
            const color = statusColors[entry.status] ?? '#fff'
            const icon  = statusIcons[entry.status]  ?? '•'

            return (
              <div key={entry.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* Platform icon */}
                <div style={{ width: 28, height: 28, borderRadius: 6, background: cfg.colorBg, border: `1px solid ${cfg.colorBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
                  {cfg.icon}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#fff', fontWeight: 600, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {entry.postTitle}
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <span>{cfg.name} · {entry.accountHandle}</span>
                    <span>{fmtDateTime(entry.timestamp)}</span>
                    {entry.isMock && <span style={{ color: 'rgba(0,200,255,0.4)' }}>MOCK</span>}
                  </div>
                  {entry.error && (
                    <div style={{ color: '#f87171', fontSize: 10, marginTop: 3, opacity: 0.8 }}>
                      {entry.error}
                    </div>
                  )}
                  {entry.publishedUrl && (
                    <a href={entry.publishedUrl} target="_blank" rel="noopener noreferrer"
                      style={{ color: '#00c8ff', fontSize: 10, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 3 }}>
                      🔗 {entry.publishedUrl.slice(0, 60)}{entry.publishedUrl.length > 60 ? '…' : ''}
                    </a>
                  )}
                </div>

                {/* Status badge */}
                <span style={{ color, fontSize: 13, flexShrink: 0 }}>{icon}</span>
              </div>
            )
          })}
        </div>
      ) : (
        <div style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: 60, fontSize: 13, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16 }}>
          {history.length === 0 ? 'No publish history yet.' : 'No entries match the current filters.'}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// PublishingCenter (main export)
// ══════════════════════════════════════════════════════════════════════════════

type PublishSubTab = 'connections' | 'queue' | 'history'

export function PublishingCenter() {
  const [subTab, setSubTab] = useState<PublishSubTab>('connections')
  const { toasts, show } = useToasts()

  const [stats, setStats] = useState(() => getQueueStats())
  useEffect(() => subscribeJobs(() => setStats(getQueueStats())), [])

  const tabs: Array<{ id: PublishSubTab; label: string; icon: string; badge?: number }> = [
    { id: 'connections', label: 'Connections', icon: '🔌' },
    { id: 'queue',       label: 'Queue',       icon: '📡', badge: stats.queued + stats.retrying },
    { id: 'history',     label: 'History',     icon: '📋' },
  ]

  return (
    <div style={{ maxWidth: 900 }}>
      {/* Page header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 20, margin: '0 0 4px' }}>🚀 Social Publishing Engine</h2>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, margin: 0 }}>
          Connect platforms, publish approved content, and track your posting history.
        </p>
      </div>

      {/* Sub-tab bar */}
      <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.25)', borderRadius: 10, padding: 4, marginBottom: 24, width: 'fit-content' }}>
        {tabs.map((t) => {
          const active = subTab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id)}
              style={{
                padding: '7px 18px', borderRadius: 7, border: 'none',
                background: active ? 'rgba(0,200,255,0.18)' : 'transparent',
                color: active ? '#00c8ff' : 'rgba(255,255,255,0.4)',
                fontWeight: active ? 700 : 500, fontSize: 12, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6, position: 'relative',
              }}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
              {t.badge ? (
                <span style={{ background: '#ef4444', color: '#fff', borderRadius: 10, padding: '0 5px', fontSize: 9, fontWeight: 800, lineHeight: '15px', minWidth: 15, textAlign: 'center' }}>
                  {t.badge}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      {subTab === 'connections' && <ConnectionsTab onToast={show} />}
      {subTab === 'queue'       && <QueueTab       onToast={show} />}
      {subTab === 'history'     && <HistoryTab />}

      <div style={{ height: 40 }} />
      <ToastStack toasts={toasts} />
    </div>
  )
}
