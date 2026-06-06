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
  startMetaOAuth, startLinkedInOAuth, disconnectAccount,
  fetchMetaPending, finalizeMetaConnection,
  type MetaPendingPage,
  isExpiringSoon, isExpired, accountStatusLabel,
} from '../../../lib/platformConnections'
import { uploadPostMedia } from '../../../lib/postMedia'
import {
  loadJobs, loadHistory, subscribeJobs,
  processJob,
  createPublishJob,
  getQueueStats,
} from '../../../lib/publishingEngine'
import type { AIContentResult, PostStatus } from '../../../lib/aiMarketing'
import { STATUS_META } from '../../../lib/aiMarketing'
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
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null)
  const [selectModal, setSelectModal] = useState<{ token: string; fbUserName: string; pages: MetaPendingPage[] } | null>(null)

  // Live updates from Supabase realtime + initial fetch
  useEffect(() => subscribeAccounts(setAccounts), [])

  // OAuth callback handling:
  //   ?connected=meta&fb=N&ig=M           → Meta fast-path success toast
  //   ?meta-select=<token>                → open Meta Page selection modal
  //   ?connected=linkedin&account=<name>  → LinkedIn success toast
  //   ?connected=<x>&error=...            → platform-specific error toast
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const selectToken = params.get('meta-select')
    const connected   = params.get('connected')

    function cleanUrl() {
      const cleaned = new URL(window.location.href)
      cleaned.search = ''
      window.history.replaceState(null, '', cleaned.toString())
    }

    if (selectToken) {
      cleanUrl()
      void (async () => {
        const r = await fetchMetaPending(selectToken)
        if (!r.ok) {
          onToast(`Could not load Page selection: ${r.error}`, 'error')
          return
        }
        if (r.data.pages.length === 0) {
          onToast('No Pages discovered', 'warn')
          return
        }
        setSelectModal({ token: selectToken, fbUserName: r.data.fbUserName, pages: r.data.pages })
      })()
      return
    }

    if (!connected) return
    const err = params.get('error')

    if (connected === 'meta') {
      if (err) {
        onToast(`Meta connect failed: ${err}`, 'error')
      } else {
        const fb = Number(params.get('fb') ?? 0)
        const ig = Number(params.get('ig') ?? 0)
        const bits: string[] = []
        if (fb > 0) bits.push(`${fb} Facebook Page${fb !== 1 ? 's' : ''}`)
        if (ig > 0) bits.push(`${ig} Instagram account${ig !== 1 ? 's' : ''}`)
        onToast(`Connected ${bits.join(' + ') || 'Meta'}`, 'success')
      }
    } else if (connected === 'linkedin') {
      if (err) {
        onToast(`LinkedIn connect failed: ${err}`, 'error')
      } else {
        const account = params.get('account')
        onToast(account ? `Connected LinkedIn as ${account}` : 'Connected LinkedIn', 'success')
      }
    }
    cleanUrl()
  }, [onToast])

  function handleConnect(platform: PlatformId) {
    if (platform === 'facebook' || platform === 'instagram') {
      startMetaOAuth()
      return
    }
    if (platform === 'linkedin') {
      startLinkedInOAuth()
      return
    }
    onToast(`${PLATFORM_CONFIGS[platform].name} connect is not enabled yet`, 'warn')
  }

  async function handleDisconnect(id: string, name: string) {
    setDisconnectingId(id)
    try {
      const r = await disconnectAccount(id)
      if (r.ok) onToast(`Disconnected ${name}`, 'info')
      else      onToast(`Disconnect failed: ${r.error ?? 'unknown'}`, 'error')
    } finally {
      setDisconnectingId(null)
    }
  }

  const activeByPlatform = (platform: PlatformId) =>
    accounts.filter((a) => a.platform === platform)

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ color: '#fff', fontWeight: 700, fontSize: 16, margin: '0 0 4px' }}>🔌 Platform Connections</h3>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, margin: 0 }}>
          Connect your social accounts to enable publishing. Connecting Facebook also connects any linked Instagram Business accounts — they share one Meta authorization.
        </p>
      </div>

      {/* Platform cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {PLATFORM_ORDER.map((platformId) => {
          const cfg = PLATFORM_CONFIGS[platformId]
          const platformAccounts = activeByPlatform(platformId)
          const hasActive = platformAccounts.some((a) => a.isActive)
          const isMeta      = platformId === 'facebook' || platformId === 'instagram'
          const isLinkedIn  = platformId === 'linkedin'
          const isConnectable = isMeta || isLinkedIn
          const connectLabel = !isConnectable
            ? '+ Coming soon'
            : platformId === 'instagram'
              ? '+ Connect via Facebook'
              : '+ Connect'

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
                {!hasActive && (
                  <button
                    onClick={() => handleConnect(platformId)}
                    disabled={!isConnectable}
                    style={{
                      background: isConnectable ? cfg.colorBg : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${isConnectable ? cfg.colorBorder : 'rgba(255,255,255,0.1)'}`,
                      color: isConnectable ? cfg.color : 'rgba(255,255,255,0.3)',
                      borderRadius: 8, padding: '8px 16px',
                      fontWeight: 700, fontSize: 12,
                      cursor: isConnectable ? 'pointer' : 'not-allowed',
                    }}
                  >
                    {connectLabel}
                  </button>
                )}
              </div>

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
                            <button
                              onClick={() => handleDisconnect(acct.id, acct.accountHandle)}
                              disabled={disconnectingId === acct.id}
                              style={ghostBtn({ color: '#fbbf24', borderColor: 'rgba(251,191,36,0.25)', fontSize: 10, padding: '4px 10px', opacity: disconnectingId === acct.id ? 0.5 : 1 })}
                            >
                              {disconnectingId === acct.id ? '…' : 'Disconnect'}
                            </button>
                          ) : (
                            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, fontStyle: 'italic' }}>
                              Reconnect via Facebook
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Not connected state */}
              {platformAccounts.length === 0 && (
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

      {selectModal && (
        <MetaPageSelectModal
          fbUserName={selectModal.fbUserName}
          pages={selectModal.pages}
          onCancel={() => setSelectModal(null)}
          onConfirm={async (pageIds) => {
            const r = await finalizeMetaConnection(selectModal.token, pageIds)
            setSelectModal(null)
            if (!r.ok) {
              onToast(`Connect failed: ${r.error}`, 'error')
              return
            }
            const bits: string[] = []
            if ((r.fbAdded ?? 0) > 0) bits.push(`${r.fbAdded} Facebook Page${r.fbAdded !== 1 ? 's' : ''}`)
            if ((r.igAdded ?? 0) > 0) bits.push(`${r.igAdded} Instagram account${r.igAdded !== 1 ? 's' : ''}`)
            onToast(`Connected ${bits.join(' + ') || 'Meta'}`, 'success')
          }}
        />
      )}
    </div>
  )
}

// ── Meta Page selection modal (shown when user manages 2+ Pages) ─────────────

interface MetaPageSelectModalProps {
  fbUserName: string
  pages:      MetaPendingPage[]
  onConfirm:  (pageIds: string[]) => Promise<void>
  onCancel:   () => void
}

function MetaPageSelectModal({ fbUserName, pages, onConfirm, onCancel }: MetaPageSelectModalProps) {
  // Default: all pages selected (matches the previous auto-connect behavior)
  const [selected, setSelected] = useState<Set<string>>(() => new Set(pages.map((p) => p.pageId)))
  const [busy, setBusy] = useState(false)

  function toggle(pageId: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(pageId)) next.delete(pageId); else next.add(pageId)
      return next
    })
  }
  function selectAll() { setSelected(new Set(pages.map((p) => p.pageId))) }
  function selectNone() { setSelected(new Set()) }

  async function handleConfirm() {
    if (selected.size === 0) return
    setBusy(true)
    try {
      await onConfirm(Array.from(selected))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
      onClick={(e) => { if (e.target === e.currentTarget && !busy) onCancel() }}
    >
      <div style={{
        background: '#0f1628', border: '1px solid rgba(0,190,255,0.25)',
        borderRadius: 16, padding: 24, width: '100%', maxWidth: 560,
        boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        maxHeight: '85vh', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ marginBottom: 14 }}>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>Select Facebook Pages to connect</div>
          <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 4 }}>
            Signed in as <strong style={{ color: 'rgba(255,255,255,0.7)' }}>{fbUserName}</strong>. We discovered{' '}
            <strong style={{ color: 'rgba(255,255,255,0.7)' }}>{pages.length} Pages</strong>. Pick which ones can publish from Cyan's Brooklynn Marketing.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 12, fontSize: 11 }}>
          <button onClick={selectAll}  style={{ background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.25)', color: '#00c8ff', borderRadius: 6, padding: '4px 10px', fontWeight: 700, cursor: 'pointer' }}>Select all</button>
          <button onClick={selectNone} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.5)', borderRadius: 6, padding: '4px 10px', fontWeight: 600, cursor: 'pointer' }}>Select none</button>
          <div style={{ flex: 1 }} />
          <div style={{ color: 'rgba(255,255,255,0.4)', alignSelf: 'center' }}>{selected.size} of {pages.length} selected</div>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {pages.map((p) => {
            const isChecked = selected.has(p.pageId)
            return (
              <label
                key={p.pageId}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: isChecked ? 'rgba(0,200,255,0.06)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isChecked ? 'rgba(0,200,255,0.3)' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 10, padding: '10px 14px', cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggle(p.pageId)}
                  style={{ accentColor: '#00c8ff', width: 16, height: 16 }}
                />
                {p.pageAvatarUrl ? (
                  <img src={p.pageAvatarUrl} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>📘</div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#fff', fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.pageName}</div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {p.category && <span>{p.category}</span>}
                    {p.ig && (
                      <span style={{ color: 'rgba(193,53,132,0.85)' }}>
                        📷 also connects @{p.ig.username}
                      </span>
                    )}
                  </div>
                </div>
              </label>
            )
          })}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 18, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            disabled={busy}
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.65)', borderRadius: 8, padding: '8px 18px', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={busy || selected.size === 0}
            style={{
              background: selected.size === 0 ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg, #0057e7, #00c8ff)',
              border: 'none', color: selected.size === 0 ? 'rgba(255,255,255,0.3)' : '#fff',
              borderRadius: 8, padding: '8px 20px', fontWeight: 700, fontSize: 12,
              cursor: selected.size === 0 ? 'not-allowed' : 'pointer',
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? 'Connecting…' : `Connect ${selected.size} Page${selected.size !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Publishing Queue Tab
// ══════════════════════════════════════════════════════════════════════════════

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

function QueueTab({ onToast }: { onToast: (msg: string, type?: Toast['type']) => void }) {
  const posts = usePosts()
  const { actions, schedulePost, cancelPost, retryPost } = useMarketing()
  const [jobs, setJobs] = useState<PublishJob[]>(() => loadJobs())
  const [busyId, setBusyId] = useState<string | null>(null)
  const [reschedulingId, setReschedulingId] = useState<string | null>(null)
  const [scheduleValue, setScheduleValue] = useState('')
  const [scheduleTz, setScheduleTz] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone)
  const [mediaUrlDrafts, setMediaUrlDrafts] = useState<Record<string, string>>({})
  const [uploadingId, setUploadingId] = useState<string | null>(null)

  useEffect(() => subscribeJobs(setJobs), [])

  function mediaUrlFor(post: AIContentResult): string {
    return mediaUrlDrafts[post.id] ?? post.mediaUrl ?? ''
  }
  function setMediaUrlDraft(postId: string, value: string) {
    setMediaUrlDrafts((prev) => ({ ...prev, [postId]: value }))
  }
  /** Persist a draft mediaUrl onto the post (only if it changed). Returns
   *  the value to publish with. */
  function commitMediaUrlDraft(post: AIContentResult): string | undefined {
    const draft = mediaUrlDrafts[post.id]
    if (draft === undefined) return post.mediaUrl?.trim() || undefined
    const trimmed = draft.trim()
    const current = post.mediaUrl?.trim() ?? ''
    if (trimmed === current) return trimmed || undefined
    actions.upsertPost({ ...post, mediaUrl: trimmed || undefined })
    return trimmed || undefined
  }
  /** Persist mediaUrl back to the post and clear any pending paste-draft. */
  function applyMediaUrl(post: AIContentResult, url: string | undefined) {
    actions.upsertPost({ ...post, mediaUrl: url })
    setMediaUrlDrafts((prev) => {
      if (!(post.id in prev)) return prev
      const next = { ...prev }; delete next[post.id]; return next
    })
  }
  async function handleUpload(post: AIContentResult, file: File | undefined) {
    if (!file) return
    setUploadingId(post.id)
    try {
      const r = await uploadPostMedia(post.id, file)
      if (!r.ok || !r.url) {
        onToast(r.error ?? 'Upload failed', 'error')
        return
      }
      applyMediaUrl(post, r.url)
      onToast('Image uploaded', 'success')
    } finally {
      setUploadingId(null)
    }
  }

  const visible = useMemo(() => {
    return posts
      .filter((p) => QUEUE_V2_VISIBLE_STATUSES.includes(p.status))
      .sort((a, b) => {
        const aTime = a.scheduledFor ? new Date(a.scheduledFor).getTime() : new Date(a.createdAt).getTime()
        const bTime = b.scheduledFor ? new Date(b.scheduledFor).getTime() : new Date(b.createdAt).getTime()
        return aTime - bTime
      })
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
    // For IG, persist any mediaUrl draft before publishing — createPublishJob
    // snapshots it onto the new publish_jobs row.
    const mediaUrl = commitMediaUrlDraft(post)
    if (post.platform === 'instagram' && !mediaUrl) {
      onToast('Instagram needs an image URL — paste a public HTTPS link first.', 'warn')
      return
    }
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
          job = await createPublishJob({ postId: post.id, accountId: account.id, autoPublishAllowed: true })
        } catch (err) {
          onToast(err instanceof Error ? err.message : 'Failed to queue post', 'error')
          return
        }
      }
      if (!job) {
        onToast('Failed to queue post', 'error')
        return
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

                {!isRescheduling && post.platform === 'instagram' && (
                  <div style={{ marginTop: 10 }}>
                    <label style={{ display: 'block', fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 600, marginBottom: 6 }}>
                      📷 Image (required for Instagram)
                    </label>

                    {mediaUrlFor(post).trim() && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <img
                          src={mediaUrlFor(post)}
                          alt=""
                          style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
                          onError={(e) => { (e.currentTarget.style.display = 'none') }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {mediaUrlFor(post)}
                          </div>
                        </div>
                        <button
                          onClick={() => applyMediaUrl(post, undefined)}
                          disabled={uploadingId === post.id}
                          style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171', borderRadius: 6, padding: '3px 8px', fontSize: 10, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
                          title="Remove image"
                        >
                          ✕
                        </button>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      <label
                        style={{
                          background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.3)', color: '#00c8ff',
                          borderRadius: 6, padding: '5px 10px', fontSize: 10, fontWeight: 700,
                          cursor: uploadingId === post.id ? 'wait' : 'pointer',
                          opacity: uploadingId === post.id ? 0.5 : 1,
                          flexShrink: 0,
                        }}
                      >
                        {uploadingId === post.id ? '⏳ Uploading…' : (mediaUrlFor(post).trim() ? '🔄 Replace image' : '📤 Upload image')}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          disabled={uploadingId === post.id}
                          onChange={(e) => { void handleUpload(post, e.target.files?.[0]); e.currentTarget.value = '' }}
                          style={{ display: 'none' }}
                        />
                      </label>
                      <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>or paste URL:</span>
                      <input
                        type="url"
                        inputMode="url"
                        placeholder="https://…"
                        value={mediaUrlDrafts[post.id] ?? (mediaUrlFor(post).startsWith('http') ? mediaUrlFor(post) : '')}
                        onChange={(e) => setMediaUrlDraft(post.id, e.target.value)}
                        onBlur={() => commitMediaUrlDraft(post)}
                        disabled={uploadingId === post.id}
                        style={{
                          ...inputStyle,
                          flex: 1, minWidth: 140,
                          fontSize: 11, padding: '5px 9px',
                          borderColor: mediaUrlFor(post).trim() ? 'rgba(167,139,250,0.3)' : 'rgba(248,113,113,0.35)',
                        }}
                      />
                    </div>
                  </div>
                )}

                {!isRescheduling && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                    {canPublishNow && (
                      <button
                        onClick={() => handlePublishNow(post)}
                        disabled={isBusy || (post.platform === 'instagram' && !mediaUrlFor(post).trim())}
                        title={post.platform === 'instagram' && !mediaUrlFor(post).trim() ? 'Add an image URL above to publish to Instagram' : undefined}
                        style={ghostBtn({
                          color: '#a78bfa', borderColor: 'rgba(167,139,250,0.3)', background: 'rgba(167,139,250,0.08)',
                          fontSize: 10, padding: '4px 10px',
                          opacity: (isBusy || (post.platform === 'instagram' && !mediaUrlFor(post).trim())) ? 0.5 : 1,
                          cursor: isBusy ? 'wait' : ((post.platform === 'instagram' && !mediaUrlFor(post).trim()) ? 'not-allowed' : 'pointer'),
                        })}
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
