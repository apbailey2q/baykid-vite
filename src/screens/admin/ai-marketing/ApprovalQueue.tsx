// ApprovalQueue.tsx — BayKid AI Marketing Center
import { useState, useMemo } from 'react'
import type { AIContentResult, PostStatus, Platform, ActivityEvent } from '../../../lib/aiMarketing'
import { initializePosts, upsertPost, removePost } from '../../../lib/postStorage'
import { SchedulePicker } from './ContentCalendar'
import type { ConnectedAccount } from '../../../lib/publishTypes'
import { PLATFORM_CONFIGS } from '../../../lib/publishTypes'
import { loadAccounts } from '../../../lib/platformConnections'
import { createPublishJob } from '../../../lib/publishingEngine'

// ── Constants ──────────────────────────────────────────────────────────────────

const STATUS_ORDER: PostStatus[] = [
  'pending_approval', 'draft', 'approved', 'scheduled', 'posted', 'rejected',
]

const STATUS_META: Record<PostStatus, {
  label: string; icon: string; color: string; bg: string; border: string
}> = {
  pending_approval: { label: 'Pending',  icon: '⏳', color: '#fbbf24',              bg: 'rgba(251,191,36,0.1)',   border: 'rgba(251,191,36,0.25)'  },
  draft:            { label: 'Draft',    icon: '📝', color: 'rgba(255,255,255,0.5)', bg: 'rgba(255,255,255,0.07)', border: 'rgba(255,255,255,0.15)' },
  approved:         { label: 'Approved', icon: '✅', color: '#22c55e',              bg: 'rgba(34,197,94,0.1)',    border: 'rgba(34,197,94,0.25)'   },
  scheduled:        { label: 'Scheduled',icon: '📅', color: '#00c8ff',              bg: 'rgba(0,200,255,0.1)',    border: 'rgba(0,200,255,0.25)'   },
  posted:           { label: 'Posted',   icon: '📢', color: '#a855f7',              bg: 'rgba(168,85,247,0.1)',   border: 'rgba(168,85,247,0.25)'  },
  rejected:         { label: 'Rejected', icon: '✗',  color: '#f87171',              bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.25)' },
  failed:           { label: 'Failed',   icon: '⚠️', color: '#fb923c',              bg: 'rgba(251,146,60,0.1)',  border: 'rgba(251,146,60,0.25)'  },
}

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

const STATUS_FILTER_OPTS: Array<{ value: PostStatus | 'all'; label: string }> = [
  { value: 'all',              label: 'All'       },
  { value: 'pending_approval', label: 'Pending'   },
  { value: 'draft',            label: 'Draft'     },
  { value: 'approved',         label: 'Approved'  },
  { value: 'scheduled',        label: 'Scheduled' },
  { value: 'posted',           label: 'Posted'    },
  { value: 'rejected',         label: 'Rejected'  },
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

// ── Toast ──────────────────────────────────────────────────────────────────────

interface Toast {
  id: number
  message: string
  type: 'success' | 'info' | 'error'
}

function ToastStack({ toasts }: { toasts: Toast[] }) {
  const colors: Record<Toast['type'], string> = {
    success: 'rgba(34,197,94,0.92)',
    error:   'rgba(248,113,113,0.92)',
    info:    'rgba(0,200,255,0.92)',
  }
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 9999, pointerEvents: 'none' }}>
      {toasts.map((t) => (
        <div key={t.id} style={{ background: colors[t.type], color: '#fff', borderRadius: 12, padding: '10px 18px', fontWeight: 700, fontSize: 13, boxShadow: '0 4px 20px rgba(0,0,0,0.4)', animation: 'fadeUp 0.25s ease' }}>
          {t.message}
        </div>
      ))}
      <style>{`@keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }`}</style>
    </div>
  )
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

// ── PublishModal ───────────────────────────────────────────────────────────────

interface PublishModalProps {
  post:     AIContentResult
  onClose:  () => void
  onQueued: (msg: string) => void
}

function PublishModal({ post, onClose, onQueued }: PublishModalProps) {
  const accounts = loadAccounts().filter((a) => a.isActive)
  const [selectedAccountId, setSelectedAccountId] = useState<string>('')
  const [publishNow] = useState(true)
  const [error, setError] = useState('')

  function handleConfirm() {
    if (!selectedAccountId) { setError('Please select a connected account.'); return }
    try {
      createPublishJob({
        postId:    post.id,
        accountId: selectedAccountId,
        scheduledFor: publishNow ? undefined : undefined, // always "now" from this modal
      })
      const acct = accounts.find((a) => a.id === selectedAccountId)
      onQueued(`🚀 Queued for ${acct?.accountHandle ?? 'publishing'} — go to Publishing → Queue to process`)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create publish job')
    }
  }

  // Group accounts by platform
  const byPlatform: Record<string, ConnectedAccount[]> = {}
  for (const a of accounts) {
    if (!byPlatform[a.platform]) byPlatform[a.platform] = []
    byPlatform[a.platform].push(a)
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000 }}
      />
      {/* Modal */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        zIndex: 1001, width: '90%', maxWidth: 480,
        background: '#0f1628', border: '1px solid rgba(0,190,255,0.25)', borderRadius: 16,
        padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
      }}>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 16, marginBottom: 6 }}>🚀 Publish Now</div>
        <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, marginBottom: 20 }}>
          Select a connected account to queue <strong style={{ color: 'rgba(255,255,255,0.7)' }}>"{post.title}"</strong> for publishing.
        </div>

        {accounts.length === 0 ? (
          <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 10, padding: 14, color: '#fbbf24', fontSize: 12, marginBottom: 16 }}>
            ⚠️ No connected accounts found.<br />
            <span style={{ opacity: 0.7 }}>Go to <strong>Publishing → Connections</strong> to add a platform.</span>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 14 }}>
              <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 8 }}>
                Select Account
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {Object.entries(byPlatform).map(([platform, accts]) => {
                  const cfg = PLATFORM_CONFIGS[platform as keyof typeof PLATFORM_CONFIGS]
                  return accts.map((acct) => (
                    <label
                      key={acct.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                        background: selectedAccountId === acct.id ? cfg.colorBg : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${selectedAccountId === acct.id ? cfg.colorBorder : 'rgba(255,255,255,0.08)'}`,
                        borderRadius: 10, padding: '10px 14px', transition: 'all 0.15s',
                      }}
                    >
                      <input
                        type="radio"
                        name="publish-account"
                        value={acct.id}
                        checked={selectedAccountId === acct.id}
                        onChange={() => { setSelectedAccountId(acct.id); setError('') }}
                        style={{ accentColor: cfg.color, width: 14, height: 14 }}
                      />
                      <span style={{ fontSize: 18 }}>{cfg.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ color: '#fff', fontWeight: 600, fontSize: 13 }}>{acct.accountHandle}</div>
                        <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10 }}>{cfg.name}</div>
                      </div>
                      <span style={{ color: '#22c55e', fontSize: 10, fontWeight: 700 }}>● Connected</span>
                    </label>
                  ))
                })}
              </div>
            </div>
          </>
        )}

        {error && (
          <div style={{ color: '#f87171', fontSize: 12, marginBottom: 12, background: 'rgba(248,113,113,0.08)', borderRadius: 8, padding: '8px 12px' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.65)', borderRadius: 8, padding: '8px 16px', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={accounts.length === 0}
            style={{ background: 'linear-gradient(135deg, #7c3aed, #00c8ff)', border: 'none', color: '#fff', borderRadius: 8, padding: '8px 20px', fontWeight: 700, fontSize: 12, cursor: accounts.length === 0 ? 'not-allowed' : 'pointer', opacity: accounts.length === 0 ? 0.5 : 1 }}
          >
            🚀 Queue for Publishing
          </button>
        </div>
      </div>
    </>
  )
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

// ── PostCard ───────────────────────────────────────────────────────────────────

interface PostCardProps {
  post:                 AIContentResult
  isEditing:            boolean
  editBuf:              EditBuf
  isScheduling:         boolean
  scheduleValue:        string
  scheduleTz:           string
  onEditBufChange:      (delta: Partial<EditBuf>) => void
  onScheduleChange:     (v: string) => void
  onScheduleTzChange:   (tz: string) => void
  onStatusChange:       (status: PostStatus, extra?: Partial<AIContentResult>) => void
  onEditStart:          () => void
  onEditSave:           () => void
  onEditCancel:         () => void
  onScheduleStart:      () => void
  onScheduleConfirm:    () => void
  onScheduleCancel:     () => void
  onPublishStart:       () => void
  onDelete:             () => void
}

function PostCard({
  post, isEditing, editBuf, isScheduling, scheduleValue, scheduleTz,
  onEditBufChange, onScheduleChange, onScheduleTzChange,
  onStatusChange, onEditStart, onEditSave, onEditCancel,
  onScheduleStart, onScheduleConfirm, onScheduleCancel, onPublishStart, onDelete,
}: PostCardProps) {
  const meta        = STATUS_META[post.status]
  const isActionable = !isEditing && !isScheduling

  return (
    <div
      style={{
        background:   'rgba(255,255,255,0.04)',
        border:       `1px solid ${isEditing || isScheduling ? meta.border : 'rgba(0,190,255,0.1)'}`,
        borderRadius: 14,
        padding:      18,
        transition:   'border-color 0.2s',
      }}
    >
      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Title */}
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 13, marginBottom: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {post.title}
          </div>
          {/* Meta chips */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}`, borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>
              {meta.icon} {meta.label}
            </span>
            <span style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.45)', borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 600 }}>
              {CONTENT_TYPE_LABELS[post.contentType] ?? post.contentType}
            </span>
            {post.platform && (
              <span style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', borderRadius: 20, padding: '2px 8px', fontSize: 10 }}>
                {PLATFORM_ICONS[post.platform] ?? ''} {post.platform}
              </span>
            )}
            {post.tone && (
              <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10 }}>{post.tone}</span>
            )}
          </div>
          {/* Timestamps */}
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <span>Created {fmtDate(post.createdAt)}</span>
            {post.scheduledFor && (
              <span style={{ color: post.status === 'scheduled' ? '#00c8ff' : 'rgba(255,255,255,0.22)' }}>
                📅 {post.status === 'scheduled' ? 'Scheduled' : 'Suggested'}: {fmtDate(post.scheduledFor)}
              </span>
            )}
          </div>
        </div>
        {/* Delete */}
        {isActionable && (
          <button
            onClick={onDelete}
            title="Delete post"
            style={{ background: 'transparent', border: 'none', color: 'rgba(248,113,113,0.5)', fontSize: 14, cursor: 'pointer', padding: '2px 6px', flexShrink: 0 }}
          >
            🗑️
          </button>
        )}
      </div>

      {/* ── Preview (view mode) ── */}
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
          {post.commentReply && (
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, lineHeight: 1.55, margin: '0 0 10px', fontStyle: 'italic' }}>
              "{post.commentReply.slice(0, 160)}{post.commentReply.length > 160 ? '…' : ''}"
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

          {/* ── Cross-system reference chips ── */}
          {(post.linkedRuleName || post.linkedLeadId || post.linkedCommentText) && (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
              {post.linkedRuleName && (
                <span style={{ background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.2)', color: '#fb923c', borderRadius: 20, padding: '2px 8px', fontSize: 9, fontWeight: 700 }}>
                  ⚡ Rule: {post.linkedRuleName}
                </span>
              )}
              {post.linkedLeadId && (
                <span style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.2)', color: '#22c55e', borderRadius: 20, padding: '2px 8px', fontSize: 9, fontWeight: 700 }}>
                  🎯 Linked Lead
                </span>
              )}
              {post.linkedCommentText && (
                <span title={post.linkedCommentText} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)', borderRadius: 20, padding: '2px 8px', fontSize: 9, fontWeight: 600 }}>
                  💬 "{post.linkedCommentText.slice(0, 40)}{post.linkedCommentText.length > 40 ? '…' : ''}"
                </span>
              )}
            </div>
          )}

          {/* ── Activity timeline (last 4 events) ── */}
          {post.activity && post.activity.length > 0 && (
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8, marginBottom: 6 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {post.activity.slice(0, 4).map((ev) => (
                  <div key={ev.id} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 10, flexShrink: 0 }}>
                      {ev.type === 'rule_triggered' ? '⚡' : ev.type === 'approved' ? '✅' : ev.type === 'scheduled' ? '📅' : ev.type === 'generated' ? '✨' : ev.type === 'sent_to_queue' ? '📤' : '•'}
                    </span>
                    <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, flex: 1 }}>{ev.label}</span>
                    <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 9, flexShrink: 0 }}>
                      {new Date(ev.ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Edit mode ── */}
      {isEditing && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
          <div>
            <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 4 }}>Title</label>
            <input style={inputStyle} value={editBuf.title} onChange={(e) => onEditBufChange({ title: e.target.value })} />
          </div>
          <div>
            <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 4 }}>Hook</label>
            <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical', lineHeight: 1.5, fontFamily: 'inherit' }}
              value={editBuf.hook} onChange={(e) => onEditBufChange({ hook: e.target.value })} />
          </div>
          <div>
            <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 4 }}>Caption</label>
            <textarea style={{ ...inputStyle, minHeight: 90, resize: 'vertical', lineHeight: 1.5, fontFamily: 'inherit' }}
              value={editBuf.caption} onChange={(e) => onEditBufChange({ caption: e.target.value })} />
          </div>
          <div>
            <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 4 }}>
              Hashtags <span style={{ fontWeight: 400, opacity: 0.7 }}>(comma-separated)</span>
            </label>
            <input style={inputStyle} value={editBuf.hashtags} onChange={(e) => onEditBufChange({ hashtags: e.target.value })} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onEditSave}
              style={{ background: 'linear-gradient(135deg,#0057e7,#00c8ff)', color: '#fff', borderRadius: 8, padding: '7px 18px', fontWeight: 700, fontSize: 12, border: 'none', cursor: 'pointer' }}
            >
              ✓ Save Changes
            </button>
            <button onClick={onEditCancel} style={ghostBtn()}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── Schedule picker ── */}
      {isScheduling && (
        <div style={{ marginBottom: 14 }}>
          <SchedulePicker
            value={scheduleValue}
            timezone={scheduleTz}
            onValueChange={onScheduleChange}
            onTimezoneChange={onScheduleTzChange}
            onConfirm={onScheduleConfirm}
            onCancel={onScheduleCancel}
          />
        </div>
      )}

      {/* ── Action buttons (by status) ── */}
      {isActionable && (
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          {post.status === 'draft' && (
            <>
              <ActionButton
                onClick={() => onStatusChange('pending_approval')}
                color="#fbbf24" bg="rgba(251,191,36,0.1)" border="rgba(251,191,36,0.25)"
              >
                → Send to Queue
              </ActionButton>
              <ActionButton onClick={onEditStart}>✏️ Edit</ActionButton>
            </>
          )}

          {post.status === 'pending_approval' && (
            <>
              <ActionButton
                onClick={() => onStatusChange('approved')}
                color="#22c55e" bg="rgba(34,197,94,0.12)" border="rgba(34,197,94,0.3)"
              >
                ✅ Approve
              </ActionButton>
              <ActionButton
                onClick={() => onStatusChange('rejected')}
                color="#f87171" bg="rgba(248,113,113,0.08)" border="rgba(248,113,113,0.2)"
              >
                ✗ Reject
              </ActionButton>
              <ActionButton onClick={onEditStart}>✏️ Edit</ActionButton>
              <ActionButton onClick={() => onStatusChange('draft')}>↩ To Draft</ActionButton>
            </>
          )}

          {post.status === 'approved' && (
            <>
              <ActionButton
                onClick={onPublishStart}
                color="#a78bfa" bg="rgba(167,139,250,0.12)" border="rgba(167,139,250,0.3)"
              >
                🚀 Publish Now
              </ActionButton>
              <ActionButton
                onClick={onScheduleStart}
                color="#00c8ff" bg="rgba(0,200,255,0.1)" border="rgba(0,200,255,0.25)"
              >
                📅 Schedule
              </ActionButton>
              <ActionButton onClick={onEditStart}>✏️ Edit</ActionButton>
              <ActionButton onClick={() => onStatusChange('pending_approval')}>← Back to Queue</ActionButton>
            </>
          )}

          {post.status === 'scheduled' && (
            <>
              <ActionButton
                onClick={onPublishStart}
                color="#a78bfa" bg="rgba(167,139,250,0.12)" border="rgba(167,139,250,0.3)"
              >
                🚀 Publish Now
              </ActionButton>
              <ActionButton
                onClick={() => onStatusChange('posted')}
                color="#a855f7" bg="rgba(168,85,247,0.1)" border="rgba(168,85,247,0.25)"
              >
                📢 Mark as Posted
              </ActionButton>
              <ActionButton
                onClick={onScheduleStart}
                color="#00c8ff" bg="rgba(0,200,255,0.08)" border="rgba(0,200,255,0.2)"
              >
                📅 Reschedule
              </ActionButton>
              <ActionButton onClick={() => onStatusChange('approved')}>Unschedule</ActionButton>
            </>
          )}

          {post.status === 'posted' && (
            <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11, padding: '6px 0' }}>
              Posted {fmtDate(post.scheduledFor ?? post.createdAt)}
            </span>
          )}

          {post.status === 'rejected' && (
            <>
              <ActionButton onClick={() => onStatusChange('draft')}>↩ Move to Draft</ActionButton>
              <ActionButton
                onClick={() => onStatusChange('pending_approval')}
                color="#fbbf24" bg="rgba(251,191,36,0.08)" border="rgba(251,191,36,0.2)"
              >
                → Re-submit
              </ActionButton>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── ApprovalQueue (main) ───────────────────────────────────────────────────────

export function ApprovalQueue() {
  const [posts, setPosts]               = useState<AIContentResult[]>(() => initializePosts())
  const [statusFilter, setStatusFilter] = useState<PostStatus | 'all'>('all')
  const [platFilter, setPlatFilter]     = useState<Platform | 'all'>('all')
  const [editingId, setEditingId]       = useState<string | null>(null)
  const [editBuf, setEditBuf]           = useState<EditBuf>({ title: '', hook: '', caption: '', hashtags: '' })
  const [schedulingId, setSchedulingId] = useState<string | null>(null)
  const [scheduleValue, setScheduleValue] = useState('')
  const [scheduleTz, setScheduleTz]     = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone)
  const [publishingPost, setPublishingPost] = useState<AIContentResult | null>(null)
  const [toasts, setToasts]             = useState<Toast[]>([])

  // ── Toast helper ─────────────────────────────────────────────────────────────

  function showToast(message: string, type: Toast['type'] = 'success') {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 2800)
  }

  // ── Derived state ─────────────────────────────────────────────────────────────

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = { all: posts.length }
    for (const p of posts) c[p.status] = (c[p.status] ?? 0) + 1
    return c
  }, [posts])

  const filtered = useMemo(() =>
    posts.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false
      if (platFilter   !== 'all' && p.platform !== platFilter) return false
      return true
    }),
    [posts, statusFilter, platFilter],
  )

  const grouped = useMemo(() =>
    STATUS_ORDER
      .map((s) => ({ status: s, posts: filtered.filter((p) => p.status === s) }))
      .filter((g) => g.posts.length > 0),
    [filtered],
  )

  // ── State mutators ────────────────────────────────────────────────────────────

  function applyUpdate(updated: AIContentResult, message: string, toastType: Toast['type'] = 'success') {
    upsertPost(updated)
    setPosts((prev) => prev.map((p) => p.id === updated.id ? updated : p))
    showToast(message, toastType)
  }

  // ── Status changes ────────────────────────────────────────────────────────────

  function handleStatusChange(id: string, status: PostStatus, extra?: Partial<AIContentResult>) {
    const post = posts.find((p) => p.id === id)
    if (!post) return

    const activityLabels: Partial<Record<PostStatus, string>> = {
      pending_approval: 'Sent to Approval Queue',
      approved:         'Approved',
      rejected:         'Rejected',
      scheduled:        `Scheduled for ${fmtDate(extra?.scheduledFor ?? post.scheduledFor)}`,
      posted:           'Marked as Posted',
      draft:            'Moved back to Draft',
    }
    const activityTypes: Partial<Record<PostStatus, ActivityEvent['type']>> = {
      pending_approval: 'sent_to_queue',
      approved:         'approved',
      rejected:         'rejected',
      scheduled:        'scheduled',
      posted:           'posted',
      draft:            'edited',
    }
    const ev: ActivityEvent = {
      id:    `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type:  activityTypes[status] ?? 'edited',
      label: activityLabels[status] ?? `Status → ${status}`,
      ts:    new Date().toISOString(),
      actor: 'Admin',
    }
    const updated: AIContentResult = {
      ...post, status, ...extra,
      activity: [ev, ...(post.activity ?? [])],
    }
    const msgs: Partial<Record<PostStatus, string>> = {
      pending_approval: '⏳ Moved to Approval Queue',
      approved:         '✅ Post approved',
      rejected:         '✗ Post rejected',
      scheduled:        `📅 Scheduled for ${fmtDate(extra?.scheduledFor ?? post.scheduledFor)}`,
      posted:           '📢 Marked as posted',
      draft:            '📝 Moved back to draft',
    }
    applyUpdate(updated, msgs[status] ?? 'Status updated')
  }

  // ── Delete ────────────────────────────────────────────────────────────────────

  function handleDelete(id: string) {
    removePost(id)
    setPosts((prev) => prev.filter((p) => p.id !== id))
    showToast('🗑️ Post deleted', 'info')
  }

  // ── Edit ──────────────────────────────────────────────────────────────────────

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
    const post = posts.find((p) => p.id === id)
    if (!post) return
    const editEv: ActivityEvent = {
      id:    `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type:  'edited',
      label: 'Content edited',
      ts:    new Date().toISOString(),
      actor: 'Admin',
    }
    const updated: AIContentResult = {
      ...post,
      title:    editBuf.title.trim()   || post.title,
      hook:     editBuf.hook.trim()    || post.hook,
      caption:  editBuf.caption.trim() || post.caption,
      hashtags: editBuf.hashtags
        .split(',').map((s) => s.trim()).filter(Boolean),
      activity: [editEv, ...(post.activity ?? [])],
    }
    applyUpdate(updated, '✏️ Changes saved')
    setEditingId(null)
  }

  function handleEditCancel() {
    setEditingId(null)
  }

  // ── Schedule ──────────────────────────────────────────────────────────────────

  function handleScheduleStart(post: AIContentResult) {
    setEditingId(null)
    setSchedulingId(post.id)
    setScheduleValue(
      post.scheduledFor ? toLocalInput(post.scheduledFor) : defaultSchedule()
    )
    setScheduleTz(post.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone)
  }

  function handleScheduleConfirm(id: string) {
    if (!scheduleValue) return
    handleStatusChange(id, 'scheduled', {
      scheduledFor: new Date(scheduleValue).toISOString(),
      timezone: scheduleTz,
    })
    setSchedulingId(null)
  }

  function handleScheduleCancel() {
    setSchedulingId(null)
  }

  // ── Refresh ───────────────────────────────────────────────────────────────────

  function handleRefresh() {
    setPosts(initializePosts())
    setEditingId(null)
    setSchedulingId(null)
    showToast('🔄 Refreshed', 'info')
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 900 }}>

      {/* ── Page header ── */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 20, margin: 0 }}>✅ Approval Queue</h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 4 }}>
            Review, edit, approve, and schedule AI-generated content before publishing.
          </p>
        </div>
        <button onClick={handleRefresh} style={ghostBtn()}>🔄 Refresh</button>
      </div>

      {/* ── Status stats row ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {(Object.entries(STATUS_META) as [PostStatus, typeof STATUS_META[PostStatus]][])
          .filter(([s]) => (statusCounts[s] ?? 0) > 0)
          .map(([s, meta]) => (
            <div key={s} style={{ background: meta.bg, border: `1px solid ${meta.border}`, borderRadius: 10, padding: '5px 12px', display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}
              onClick={() => setStatusFilter(statusFilter === s ? 'all' : s)}
            >
              <span style={{ color: meta.color, fontWeight: 700, fontSize: 13 }}>{statusCounts[s]}</span>
              <span style={{ color: meta.color, fontSize: 11 }}>{meta.icon} {meta.label}</span>
            </div>
          ))}
      </div>

      {/* ── Filter bar ── */}
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '12px 16px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {/* Status chips */}
        <div style={{ display: 'flex', gap: 6, flex: 1, flexWrap: 'wrap' }}>
          {STATUS_FILTER_OPTS.map((opt) => {
            const active  = statusFilter === opt.value
            const count   = opt.value === 'all' ? posts.length : (statusCounts[opt.value] ?? 0)
            const smeta   = opt.value !== 'all' ? STATUS_META[opt.value as PostStatus] : null
            return (
              <button key={opt.value} onClick={() => setStatusFilter(opt.value)}
                style={{
                  padding:      '5px 12px',
                  borderRadius: 20,
                  border:       active
                    ? `1px solid ${smeta?.border ?? 'rgba(0,200,255,0.5)'}`
                    : '1px solid rgba(255,255,255,0.08)',
                  background:   active
                    ? (smeta?.bg ?? 'rgba(0,200,255,0.1)')
                    : 'transparent',
                  color:        active
                    ? (smeta?.color ?? '#00c8ff')
                    : 'rgba(255,255,255,0.4)',
                  fontSize:  12,
                  fontWeight: active ? 700 : 500,
                  cursor:    'pointer',
                  display:   'flex',
                  gap:       5,
                  alignItems: 'center',
                }}
              >
                <span>{opt.label}</span>
                {count > 0 && (
                  <span style={{ fontSize: 10, opacity: 0.7 }}>{count}</span>
                )}
              </button>
            )
          })}
        </div>

        {/* Platform select */}
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

      {/* ── Post groups ── */}
      {grouped.length > 0 ? (
        grouped.map(({ status, posts: gPosts }) => {
          const meta = STATUS_META[status]
          return (
            <div key={status} style={{ marginBottom: 32 }}>
              {/* Section header */}
              <div style={{ color: meta.color, fontSize: 12, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>{meta.icon} {meta.label.toUpperCase()}</span>
                <span style={{ background: meta.bg, border: `1px solid ${meta.border}`, borderRadius: 20, padding: '1px 8px', fontSize: 11 }}>
                  {gPosts.length}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {gPosts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    isEditing={editingId === post.id}
                    editBuf={editBuf}
                    isScheduling={schedulingId === post.id}
                    scheduleValue={scheduleValue}
                    scheduleTz={scheduleTz}
                    onEditBufChange={(delta) => setEditBuf((prev) => ({ ...prev, ...delta }))}
                    onScheduleChange={setScheduleValue}
                    onScheduleTzChange={setScheduleTz}
                    onStatusChange={(s, extra) => handleStatusChange(post.id, s, extra)}
                    onEditStart={() => handleEditStart(post)}
                    onEditSave={() => handleEditSave(post.id)}
                    onEditCancel={handleEditCancel}
                    onScheduleStart={() => handleScheduleStart(post)}
                    onScheduleConfirm={() => handleScheduleConfirm(post.id)}
                    onScheduleCancel={handleScheduleCancel}
                    onPublishStart={() => { setEditingId(null); setSchedulingId(null); setPublishingPost(post) }}
                    onDelete={() => handleDelete(post.id)}
                  />
                ))}
              </div>
            </div>
          )
        })
      ) : (
        <div style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: 60, fontSize: 13, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16 }}>
          {statusFilter === 'all' && platFilter === 'all' ? (
            <>
              No posts in the queue.<br />
              Generate content in{' '}
              <strong style={{ color: 'rgba(255,255,255,0.5)' }}>Social Post</strong>
              {' '}and click{' '}
              <strong style={{ color: 'rgba(255,255,255,0.5)' }}>Send to Queue</strong>.
            </>
          ) : (
            <div>
              No posts match the current filters.
              <br />
              <button
                onClick={() => { setStatusFilter('all'); setPlatFilter('all') }}
                style={{ ...ghostBtn(), marginTop: 12 }}
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      )}

      <div style={{ height: 40 }} />

      {/* Publish Modal */}
      {publishingPost && (
        <PublishModal
          post={publishingPost}
          onClose={() => setPublishingPost(null)}
          onQueued={(msg) => showToast(msg, 'success')}
        />
      )}

      <ToastStack toasts={toasts} />
    </div>
  )
}
