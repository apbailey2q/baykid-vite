// ApprovalQueue.tsx — BayKid AI Marketing Center
import { useState, useMemo } from 'react'
import type { AIContentResult, PostStatus, Platform, ActivityEvent } from '../../../lib/aiMarketing'
import { STATUS_META } from '../../../lib/aiMarketing'
import { SchedulePicker } from '../../../components/ai-marketing/SchedulePicker'
import { StatusBadge } from '../../../components/ui/StatusBadge'
import { useMarketing, usePosts } from '../../../lib/marketingStore'

// ── Constants ──────────────────────────────────────────────────────────────────

const CONTENT_TYPE_LABELS: Record<string, string> = {
  social_post:      'Social Post',
  reel_script:      'Reel Script',
  carousel:         'Carousel',
  comment_reply:    'Comment Reply',
  email_reply:      'Email Draft',
  storyboard:       'Storyboard',
  voiceover:        'Voiceover',
  analytics_review: 'Analytics Review',
}

const PLATFORM_ICONS: Record<string, string> = {
  instagram: '📷',
  tiktok:    '🎵',
  facebook:  '👥',
  twitter:   '🐦',
  linkedin:  '💼',
  youtube:   '▶️',
}

const PLATFORM_OPTS: Array<{ value: Platform | 'all'; label: string }> = [
  { value: 'all',       label: 'All Platforms' },
  { value: 'instagram', label: '📷 Instagram'  },
  { value: 'tiktok',    label: '🎵 TikTok'     },
  { value: 'facebook',  label: '👥 Facebook'   },
  { value: 'twitter',   label: '🐦 Twitter/X'  },
  { value: 'linkedin',  label: '💼 LinkedIn'   },
  { value: 'youtube',   label: '▶️ YouTube'    },
]

// ── Style helpers ──────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  color: '#fff',
  borderRadius: 8,
  padding: '8px 12px',
  fontSize: 12,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
}

function ghostBtn(overrides?: React.CSSProperties): React.CSSProperties {
  return {
    background:  'rgba(255,255,255,0.07)',
    border:      '1px solid rgba(255,255,255,0.15)',
    color:       'rgba(255,255,255,0.65)',
    borderRadius: 8,
    padding:     '6px 12px',
    fontWeight:  600,
    fontSize:    11,
    cursor:      'pointer',
    ...overrides,
  }
}

// ── Timestamp helpers ──────────────────────────────────────────────────────────

function fmtDate(iso: string | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  return (
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  )
}

function toLocalInput(iso: string): string {
  const d   = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function defaultSchedule(): string {
  const d = new Date()
  d.setDate(d.getDate() + 2)
  d.setHours(9, 0, 0, 0)
  return toLocalInput(d.toISOString())
}

// ── Edit buffer ────────────────────────────────────────────────────────────────

interface EditBuf {
  title:    string
  hook:     string
  caption:  string
  hashtags: string   // comma-separated
}

// ── ActionButton ───────────────────────────────────────────────────────────────

function ActionButton({
  children, onClick, color, bg, border, disabled,
}: {
  children: React.ReactNode
  onClick:  () => void
  color?:   string
  bg?:      string
  border?:  string
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background:   bg     ?? 'rgba(255,255,255,0.07)',
        border:       `1px solid ${border ?? 'rgba(255,255,255,0.15)'}`,
        color:        color  ?? 'rgba(255,255,255,0.65)',
        borderRadius: 8,
        padding:      '6px 12px',
        fontWeight:   700,
        fontSize:     11,
        cursor:       disabled ? 'not-allowed' : 'pointer',
        opacity:      disabled ? 0.5 : 1,
        display:      'flex',
        alignItems:   'center',
        gap:          4,
      }}
    >
      {children}
    </button>
  )
}

// ── ApprovalQueue (main) ───────────────────────────────────────────────────────
// Scoped to drafts / pending / rejected. Approve · Reject · Edit · Schedule only.

const V2_VISIBLE_STATUSES: PostStatus[] = ['draft', 'pending_approval', 'rejected']

interface ConfirmModalProps {
  title:   string
  message: string
  confirmLabel: string
  confirmColor?: string
  onConfirm: () => void
  onCancel:  () => void
}

function ConfirmModal({ title, message, confirmLabel, confirmColor, onConfirm, onCancel }: ConfirmModalProps) {
  return (
    <>
      <div
        onClick={onCancel}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000 }}
      />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        zIndex: 1001, width: '90%', maxWidth: 420,
        background: '#0f1628', border: '1px solid rgba(0,190,255,0.25)', borderRadius: 16,
        padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
      }}>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 16, marginBottom: 6 }}>{title}</div>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 20, lineHeight: 1.5 }}>{message}</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.65)', borderRadius: 8, padding: '8px 16px', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{ background: confirmColor ?? 'linear-gradient(135deg, #7c3aed, #00c8ff)', border: 'none', color: '#fff', borderRadius: 8, padding: '8px 20px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </>
  )
}

export function ApprovalQueue() {
  const { approvePost, rejectPost, schedulePost, actions } = useMarketing()
  const allPosts = usePosts()

  const [statusFilter, setStatusFilter] = useState<PostStatus | 'all'>('all')
  const [platFilter, setPlatFilter]     = useState<Platform | 'all'>('all')
  const [editingId, setEditingId]       = useState<string | null>(null)
  const [editBuf, setEditBuf]           = useState<EditBuf>({ title: '', hook: '', caption: '', hashtags: '' })
  const [schedulingId, setSchedulingId] = useState<string | null>(null)
  const [scheduleValue, setScheduleValue] = useState('')
  const [scheduleTz, setScheduleTz]     = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone)
  const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set())
  const [confirm, setConfirm]           = useState<ConfirmModalProps | null>(null)

  const visiblePosts = useMemo(
    () => allPosts.filter((p) => V2_VISIBLE_STATUSES.includes(p.status)),
    [allPosts],
  )

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = { all: visiblePosts.length }
    for (const p of visiblePosts) c[p.status] = (c[p.status] ?? 0) + 1
    return c
  }, [visiblePosts])

  const filtered = useMemo(() =>
    visiblePosts.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false
      if (platFilter   !== 'all' && p.platform !== platFilter) return false
      return true
    }),
    [visiblePosts, statusFilter, platFilter],
  )

  const grouped = useMemo(() =>
    V2_VISIBLE_STATUSES
      .map((s) => ({ status: s, posts: filtered.filter((p) => p.status === s) }))
      .filter((g) => g.posts.length > 0),
    [filtered],
  )

  function handleEditStart(post: AIContentResult) {
    setSchedulingId(null)
    setEditingId(post.id)
    setEditBuf({
      title:    post.title,
      hook:     post.hook,
      caption:  post.caption,
      hashtags: post.hashtags.join(', '),
    })
  }

  function handleEditSave(id: string) {
    const post = allPosts.find((p) => p.id === id)
    if (!post) return
    const editEv: ActivityEvent = {
      id:    `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type:  'edited',
      label: 'Content edited',
      ts:    new Date().toISOString(),
      actor: 'Admin',
    }
    actions.upsertPost({
      ...post,
      title:    editBuf.title.trim()   || post.title,
      hook:     editBuf.hook.trim()    || post.hook,
      caption:  editBuf.caption.trim() || post.caption,
      hashtags: editBuf.hashtags.split(',').map((s) => s.trim()).filter(Boolean),
      activity: [editEv, ...(post.activity ?? [])],
    })
    actions.toast('Changes saved', 'success')
    setEditingId(null)
  }

  function handleScheduleStart(post: AIContentResult) {
    setEditingId(null)
    setSchedulingId(post.id)
    setScheduleValue(post.scheduledFor ? toLocalInput(post.scheduledFor) : defaultSchedule())
    setScheduleTz(post.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone)
  }

  async function handleScheduleConfirm(id: string) {
    if (!scheduleValue) return
    const r = await schedulePost(id, new Date(scheduleValue).toISOString(), scheduleTz)
    if (r.ok) actions.toast(`Scheduled for ${fmtDate(new Date(scheduleValue).toISOString())}`, 'success')
    setSchedulingId(null)
  }

  async function handleApprove(id: string) {
    const r = await approvePost(id)
    if (r.ok) actions.toast('Approved and queued', 'success')
  }

  async function handleReject(id: string) {
    const r = await rejectPost(id)
    if (r.ok) actions.toast('Post rejected', 'info')
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function selectAll() {
    setSelectedIds(new Set(filtered.map((p) => p.id)))
  }

  function clearSelection() {
    setSelectedIds(new Set())
  }

  function bulkApprove() {
    const count = selectedIds.size
    setConfirm({
      title:   'Approve posts?',
      message: `This will approve ${count} post(s) and queue them for publishing.`,
      confirmLabel: `Approve ${count}`,
      confirmColor: 'linear-gradient(135deg, #16a34a, #22c55e)',
      onCancel: () => setConfirm(null),
      onConfirm: async () => {
        setConfirm(null)
        let ok = 0
        for (const id of selectedIds) {
          const r = await approvePost(id)
          if (r.ok) ok++
        }
        actions.toast(`Approved ${ok} of ${count} post(s)`, ok === count ? 'success' : 'warn')
        clearSelection()
      },
    })
  }

  function bulkReject() {
    const count = selectedIds.size
    setConfirm({
      title:   'Reject posts?',
      message: `This will mark ${count} post(s) as rejected.`,
      confirmLabel: `Reject ${count}`,
      confirmColor: 'linear-gradient(135deg, #dc2626, #f87171)',
      onCancel: () => setConfirm(null),
      onConfirm: async () => {
        setConfirm(null)
        let ok = 0
        for (const id of selectedIds) {
          const r = await rejectPost(id)
          if (r.ok) ok++
        }
        actions.toast(`Rejected ${ok} of ${count} post(s)`, 'info')
        clearSelection()
      },
    })
  }

  function bulkDelete() {
    const count = selectedIds.size
    setConfirm({
      title:   'Delete posts?',
      message: `This will permanently delete ${count} post(s). This cannot be undone.`,
      confirmLabel: `Delete ${count}`,
      confirmColor: 'linear-gradient(135deg, #b45309, #fb923c)',
      onCancel: () => setConfirm(null),
      onConfirm: () => {
        setConfirm(null)
        for (const id of selectedIds) actions.deletePost(id)
        actions.toast(`Deleted ${count} post(s)`, 'info')
        clearSelection()
      },
    })
  }

  const v2StatusFilterOpts: Array<{ value: PostStatus | 'all'; label: string }> = [
    { value: 'all',              label: 'All'      },
    { value: 'pending_approval', label: STATUS_META.pending_approval.label },
    { value: 'draft',            label: STATUS_META.draft.label            },
    { value: 'rejected',         label: STATUS_META.rejected.label         },
  ]

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 20, margin: 0 }}>✅ Approval Queue</h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 4 }}>
            Review drafts, pending posts, and rejected items. Approve to queue for publishing or schedule for a specific time.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {V2_VISIBLE_STATUSES
          .filter((s) => (statusCounts[s] ?? 0) > 0)
          .map((s) => {
            const meta = STATUS_META[s]
            return (
              <div key={s}
                onClick={() => setStatusFilter(statusFilter === s ? 'all' : s)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', background: statusFilter === s ? 'rgba(0,200,255,0.08)' : 'rgba(255,255,255,0.03)', border: `1px solid ${statusFilter === s ? 'rgba(0,200,255,0.3)' : 'rgba(255,255,255,0.07)'}`, borderRadius: 10, padding: '5px 12px' }}
              >
                <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>{statusCounts[s]}</span>
                <StatusBadge variant={meta.badgeVariant} label={meta.label} size="sm" />
              </div>
            )
          })}
      </div>

      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '12px 16px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6, flex: 1, flexWrap: 'wrap' }}>
          {v2StatusFilterOpts.map((opt) => {
            const active = statusFilter === opt.value
            const count  = opt.value === 'all' ? visiblePosts.length : (statusCounts[opt.value] ?? 0)
            return (
              <button key={opt.value} onClick={() => setStatusFilter(opt.value)}
                style={{
                  padding: '5px 12px', borderRadius: 20,
                  border: active ? '1px solid rgba(0,200,255,0.5)' : '1px solid rgba(255,255,255,0.08)',
                  background: active ? 'rgba(0,200,255,0.1)' : 'transparent',
                  color: active ? '#00c8ff' : 'rgba(255,255,255,0.4)',
                  fontSize: 12, fontWeight: active ? 700 : 500, cursor: 'pointer',
                  display: 'flex', gap: 5, alignItems: 'center',
                }}
              >
                <span>{opt.label}</span>
                {count > 0 && <span style={{ fontSize: 10, opacity: 0.7 }}>{count}</span>}
              </button>
            )
          })}
        </div>

        <select
          value={platFilter}
          onChange={(e) => setPlatFilter(e.target.value as Platform | 'all')}
          style={{ ...inputStyle, width: 'auto', minWidth: 140 }}
        >
          {PLATFORM_OPTS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </div>

      {filtered.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>
            <input
              type="checkbox"
              checked={selectedIds.size === filtered.length && filtered.length > 0}
              onChange={() => selectedIds.size === filtered.length ? clearSelection() : selectAll()}
              style={{ accentColor: '#00c8ff', width: 14, height: 14 }}
            />
            {selectedIds.size === 0 ? 'Select all' : `${selectedIds.size} selected`}
          </label>
          {selectedIds.size > 0 && (
            <>
              <ActionButton onClick={bulkApprove} color="#22c55e" bg="rgba(34,197,94,0.1)" border="rgba(34,197,94,0.25)">
                ✅ Approve {selectedIds.size}
              </ActionButton>
              <ActionButton onClick={bulkReject} color="#f87171" bg="rgba(248,113,113,0.08)" border="rgba(248,113,113,0.2)">
                ✗ Reject {selectedIds.size}
              </ActionButton>
              <ActionButton onClick={bulkDelete} color="#fb923c" bg="rgba(251,146,60,0.06)" border="rgba(251,146,60,0.15)">
                🗑️ Delete {selectedIds.size}
              </ActionButton>
              <button onClick={clearSelection} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 11, cursor: 'pointer', padding: 0 }}>
                ✕ Clear
              </button>
            </>
          )}
        </div>
      )}

      {grouped.length > 0 ? (
        grouped.map(({ status, posts: gPosts }) => {
          const meta = STATUS_META[status]
          return (
            <div key={status} style={{ marginBottom: 32 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <StatusBadge variant={meta.badgeVariant} label={meta.label.toUpperCase()} dot size="md" />
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{gPosts.length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {gPosts.map((post) => {
                  const isEditing    = editingId    === post.id
                  const isScheduling = schedulingId === post.id
                  const isActionable = !isEditing && !isScheduling
                  const postMeta     = STATUS_META[post.status]
                  return (
                    <div key={post.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <div style={{ paddingTop: 20, flexShrink: 0 }}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(post.id)}
                          onChange={() => toggleSelect(post.id)}
                          style={{ accentColor: '#00c8ff', width: 14, height: 14, cursor: 'pointer' }}
                        />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(0,190,255,0.1)', borderRadius: 14, padding: 18 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ color: '#fff', fontWeight: 700, fontSize: 13, marginBottom: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {post.title}
                              </div>
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                                <StatusBadge variant={postMeta.badgeVariant} label={`${postMeta.icon} ${postMeta.label}`} size="sm" />
                                <span style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.45)', borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 600 }}>
                                  {CONTENT_TYPE_LABELS[post.contentType] ?? post.contentType}
                                </span>
                                {post.platform && (
                                  <span style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', borderRadius: 20, padding: '2px 8px', fontSize: 10 }}>
                                    {PLATFORM_ICONS[post.platform] ?? ''} {post.platform}
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)' }}>
                                Created {fmtDate(post.createdAt)}
                              </div>
                            </div>
                          </div>

                          {!isEditing && !isScheduling && (
                            <>
                              {post.hook && (
                                <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, lineHeight: 1.55, margin: '0 0 6px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                  {post.hook}
                                </p>
                              )}
                              {post.caption && (
                                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, lineHeight: 1.5, margin: '0 0 10px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                  {post.caption}
                                </p>
                              )}
                              {post.hashtags.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                                  {post.hashtags.slice(0, 5).map((tag) => (
                                    <span key={tag} style={{ background: 'rgba(0,200,255,0.06)', color: 'rgba(0,200,255,0.55)', borderRadius: 20, padding: '2px 7px', fontSize: 10, fontWeight: 600 }}>
                                      {tag}
                                    </span>
                                  ))}
                                  {post.hashtags.length > 5 && (
                                    <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10, padding: '2px 4px' }}>
                                      +{post.hashtags.length - 5}
                                    </span>
                                  )}
                                </div>
                              )}
                            </>
                          )}

                          {isEditing && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                              <div>
                                <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 4 }}>Title</label>
                                <input style={inputStyle} value={editBuf.title} onChange={(e) => setEditBuf((b) => ({ ...b, title: e.target.value }))} />
                              </div>
                              <div>
                                <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 4 }}>Hook</label>
                                <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical', lineHeight: 1.5, fontFamily: 'inherit' }}
                                  value={editBuf.hook} onChange={(e) => setEditBuf((b) => ({ ...b, hook: e.target.value }))} />
                              </div>
                              <div>
                                <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 4 }}>Caption</label>
                                <textarea style={{ ...inputStyle, minHeight: 90, resize: 'vertical', lineHeight: 1.5, fontFamily: 'inherit' }}
                                  value={editBuf.caption} onChange={(e) => setEditBuf((b) => ({ ...b, caption: e.target.value }))} />
                              </div>
                              <div>
                                <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                                  Hashtags <span style={{ fontWeight: 400, opacity: 0.7 }}>(comma-separated)</span>
                                </label>
                                <input style={inputStyle} value={editBuf.hashtags} onChange={(e) => setEditBuf((b) => ({ ...b, hashtags: e.target.value }))} />
                              </div>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <button
                                  onClick={() => handleEditSave(post.id)}
                                  style={{ background: 'linear-gradient(135deg,#0057e7,#00c8ff)', color: '#fff', borderRadius: 8, padding: '7px 18px', fontWeight: 700, fontSize: 12, border: 'none', cursor: 'pointer' }}
                                >
                                  ✓ Save Changes
                                </button>
                                <button onClick={() => setEditingId(null)} style={ghostBtn()}>Cancel</button>
                              </div>
                            </div>
                          )}

                          {isScheduling && (
                            <div style={{ marginBottom: 14 }}>
                              <SchedulePicker
                                value={scheduleValue}
                                timezone={scheduleTz}
                                onValueChange={setScheduleValue}
                                onTimezoneChange={setScheduleTz}
                                onConfirm={() => handleScheduleConfirm(post.id)}
                                onCancel={() => setSchedulingId(null)}
                              />
                            </div>
                          )}

                          {isActionable && (
                            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                              <ActionButton
                                onClick={() => handleApprove(post.id)}
                                color="#22c55e" bg="rgba(34,197,94,0.12)" border="rgba(34,197,94,0.3)"
                              >
                                ✅ Approve
                              </ActionButton>
                              <ActionButton
                                onClick={() => handleReject(post.id)}
                                color="#f87171" bg="rgba(248,113,113,0.08)" border="rgba(248,113,113,0.2)"
                              >
                                ✗ Reject
                              </ActionButton>
                              <ActionButton onClick={() => handleEditStart(post)}>✏️ Edit</ActionButton>
                              <ActionButton
                                onClick={() => handleScheduleStart(post)}
                                color="#00c8ff" bg="rgba(0,200,255,0.1)" border="rgba(0,200,255,0.25)"
                              >
                                📅 Schedule
                              </ActionButton>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })
      ) : (
        <div style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: 60, fontSize: 13, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16 }}>
          No posts awaiting review.
        </div>
      )}

      <div style={{ height: 40 }} />

      {confirm && <ConfirmModal {...confirm} />}
    </div>
  )
}
