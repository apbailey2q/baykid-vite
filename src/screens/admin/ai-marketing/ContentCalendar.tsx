// ContentCalendar.tsx — BayKid AI Marketing Center
import { useState, useMemo } from 'react'
import type { AIContentResult, PostStatus, Platform, ContentType } from '../../../lib/aiMarketing'
import { STATUS_META } from '../../../lib/aiMarketing'
import { duplicatePost } from '../../../lib/postStorage'
import { SchedulePicker, TIMEZONES } from '../../../components/ai-marketing/SchedulePicker'
import { usePosts, useMarketing } from '../../../lib/marketingStore'
import { StatusBadge } from '../../../components/ui/StatusBadge'

// Re-export for back-compat with any consumers still importing from this file.
// New code should import from '../../../components/ai-marketing/SchedulePicker'.
export { SchedulePicker, TIMEZONES }

// ── Constants ──────────────────────────────────────────────────────────────────

export const PLATFORM_ICONS: Record<string, string> = {
  instagram: '📷', tiktok: '🎵', facebook: '👥',
  twitter: '🐦', linkedin: '💼', youtube: '▶️',
}

const PLATFORM_COLORS: Record<string, string> = {
  instagram: '#c13584', tiktok: '#ff3b5c', facebook: '#1877f2',
  twitter: '#1da1f2', linkedin: '#0077b5', youtube: '#ff0000',
}

const CONTENT_TYPE_LABELS: Record<string, string> = {
  social_post: 'Social Post', reel_script: 'Reel', carousel: 'Carousel',
  comment_reply: 'Comment Reply', email_reply: 'Email', storyboard: 'Storyboard',
  voiceover: 'Voiceover', analytics_review: 'Analytics',
}

const MONTHS = ['January','February','March','April','May','June',
                 'July','August','September','October','November','December']
const WEEKDAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

// ── Style helpers ──────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
  color: '#fff', borderRadius: 8, padding: '8px 12px', fontSize: 12,
  outline: 'none', width: '100%', boxSizing: 'border-box',
}

function ghostBtn(o?: React.CSSProperties): React.CSSProperties {
  return { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)',
    color: 'rgba(255,255,255,0.65)', borderRadius: 8, padding: '6px 12px',
    fontWeight: 600, fontSize: 11, cursor: 'pointer', ...o }
}

// ── Types ──────────────────────────────────────────────────────────────────────

type ViewMode = 'month' | 'week' | 'list'
type DateRange = 'all' | 'today' | 'this_week' | 'this_month' | 'next_week' | 'next_month'

interface EditBuf {
  title: string; hook: string; caption: string; hashtags: string
}

interface Toast {
  id: number; message: string; type: 'success' | 'info' | 'error'
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function getBrowserTz(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

function fmtDateTime(iso: string, tz?: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: tz ?? getBrowserTz(),
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
    }).format(new Date(iso))
  } catch { return new Date(iso).toLocaleString() }
}

function fmtTime(iso: string, tz?: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: tz ?? getBrowserTz(), hour: 'numeric', minute: '2-digit',
    }).format(new Date(iso))
  } catch { return '' }
}

function fmtDayLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function defaultScheduleInput(): string {
  const d = new Date(); d.setDate(d.getDate() + 2); d.setHours(9, 0, 0, 0)
  return toLocalInput(d.toISOString())
}

function getWeekDates(ref: Date): Date[] {
  const d = new Date(ref); d.setDate(d.getDate() - d.getDay()); d.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, i) => { const dd = new Date(d); dd.setDate(d.getDate() + i); return dd })
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function isToday(d: Date): boolean { return sameDay(d, new Date()) }

function applyDateRange(posts: AIContentResult[], range: DateRange): AIContentResult[] {
  if (range === 'all') return posts
  const now = new Date(); now.setHours(0, 0, 0, 0)
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1)
  const weekEnd = new Date(now); weekEnd.setDate(now.getDate() - now.getDay() + 7)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const nextWeekStart = new Date(weekEnd)
  const nextWeekEnd = new Date(nextWeekStart); nextWeekEnd.setDate(nextWeekStart.getDate() + 7)
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const nextMonthEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0)

  return posts.filter((p) => {
    if (!p.scheduledFor) return false
    const d = new Date(p.scheduledFor)
    switch (range) {
      case 'today':      return d >= now && d < tomorrow
      case 'this_week':  return d >= now && d <= weekEnd
      case 'this_month': return d >= now && d <= monthEnd
      case 'next_week':  return d >= nextWeekStart && d < nextWeekEnd
      case 'next_month': return d >= nextMonthStart && d <= nextMonthEnd
      default: return true
    }
  })
}

// ── Toast ──────────────────────────────────────────────────────────────────────

function ToastStack({ toasts }: { toasts: Toast[] }) {
  const colors = { success: 'rgba(34,197,94,0.92)', error: 'rgba(248,113,113,0.92)', info: 'rgba(0,200,255,0.92)' }
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

// ── Stats Cards ────────────────────────────────────────────────────────────────

function StatsCards({ posts }: { posts: AIContentResult[] }) {
  const now = new Date(); now.setHours(0, 0, 0, 0)
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1)
  const weekEnd = new Date(now); weekEnd.setDate(now.getDate() - now.getDay() + 7)

  const scheduledToday = posts.filter((p) => {
    if (p.status !== 'scheduled' || !p.scheduledFor) return false
    const d = new Date(p.scheduledFor)
    return d >= now && d < tomorrow
  }).length

  const scheduledWeek = posts.filter((p) => {
    if (p.status !== 'scheduled' || !p.scheduledFor) return false
    const d = new Date(p.scheduledFor)
    return d >= now && d <= weekEnd
  }).length

  const posted  = posts.filter((p) => p.status === 'posted').length
  const failed  = posts.filter((p) => p.status === 'failed').length

  const cards = [
    { label: 'Scheduled Today', value: scheduledToday, color: '#00c8ff', bg: 'rgba(0,200,255,0.08)',  border: 'rgba(0,200,255,0.2)',    icon: '📅' },
    { label: 'This Week',       value: scheduledWeek,  color: '#22c55e', bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.2)',    icon: '📆' },
    { label: 'Posted',          value: posted,         color: '#a855f7', bg: 'rgba(168,85,247,0.08)',  border: 'rgba(168,85,247,0.2)',  icon: '📢' },
    { label: 'Failed',          value: failed,         color: '#fb923c', bg: 'rgba(251,146,60,0.08)', border: 'rgba(251,146,60,0.2)',  icon: '⚠️' },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
      {cards.map((c) => (
        <div key={c.label} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 14, padding: '16px 18px' }}>
          <div style={{ fontSize: 20, marginBottom: 6 }}>{c.icon}</div>
          <div style={{ color: c.color, fontWeight: 800, fontSize: 26, lineHeight: 1 }}>{c.value}</div>
          <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 4, fontWeight: 600 }}>{c.label}</div>
        </div>
      ))}
    </div>
  )
}

// SchedulePicker + TIMEZONES are imported from components/ai-marketing/SchedulePicker
// (extracted so non-calendar screens don't depend on this file).

// ── PostActionRow ──────────────────────────────────────────────────────────────

interface PostActionRowProps {
  post:              AIContentResult
  onReschedule:      () => void
  onMarkPosted:      () => void
  onDuplicate:       () => void
  onDelete:          () => void
  onEdit:            () => void
}

function PostActionRow({ post, onReschedule, onMarkPosted, onDuplicate, onDelete, onEdit }: PostActionRowProps) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
      <button onClick={onEdit} style={ghostBtn()}>✏️ Edit</button>
      {(post.status === 'scheduled' || post.status === 'queued' || post.status === 'approved' || post.status === 'pending_approval' || post.status === 'draft') && (
        <button onClick={onReschedule} style={ghostBtn({ color: '#00c8ff', borderColor: 'rgba(0,200,255,0.25)', background: 'rgba(0,200,255,0.08)' })}>📅 Reschedule</button>
      )}
      {(post.status === 'scheduled' || post.status === 'queued') && (
        <button onClick={onMarkPosted} style={ghostBtn({ color: '#a855f7', borderColor: 'rgba(168,85,247,0.3)', background: 'rgba(168,85,247,0.08)' })}>📢 Mark as Posted</button>
      )}
      {post.status === 'posted' && (
        <button onClick={onReschedule} style={ghostBtn({ color: '#00c8ff', borderColor: 'rgba(0,200,255,0.25)' })}>📅 Reshare</button>
      )}
      {post.status === 'failed' && (
        <button onClick={onReschedule} style={ghostBtn({ color: '#00c8ff', borderColor: 'rgba(0,200,255,0.25)' })}>📅 Retry Schedule</button>
      )}
      <button onClick={onDuplicate} style={ghostBtn()}>⧉ Duplicate</button>
      <button onClick={onDelete} style={ghostBtn({ color: 'rgba(248,113,113,0.7)', borderColor: 'rgba(248,113,113,0.2)' })}>🗑️</button>
    </div>
  )
}

// ── PostCard (list / week / detail panel) ─────────────────────────────────────

interface PostCardProps {
  post:          AIContentResult
  isEditing:     boolean
  editBuf:       EditBuf
  isRescheduling: boolean
  scheduleValue: string
  scheduleTz:    string
  onEditBufChange:      (d: Partial<EditBuf>) => void
  onScheduleChange:     (v: string) => void
  onTimezoneChange:     (tz: string) => void
  onEditStart:    () => void
  onEditSave:     () => void
  onEditCancel:   () => void
  onReschedule:   () => void
  onScheduleConfirm: () => void
  onScheduleCancel:  () => void
  onMarkPosted:   () => void
  onDuplicate:    () => void
  onDelete:       () => void
  compact?:       boolean
}

function PostCard({
  post, isEditing, editBuf, isRescheduling, scheduleValue, scheduleTz,
  onEditBufChange, onScheduleChange, onTimezoneChange,
  onEditStart, onEditSave, onEditCancel,
  onReschedule, onScheduleConfirm, onScheduleCancel,
  onMarkPosted, onDuplicate, onDelete,
  compact = false,
}: PostCardProps) {
  const canonicalMeta = STATUS_META[post.status] ?? STATUS_META.draft
  const tz   = post.timezone ?? getBrowserTz()
  const tzLabel = TIMEZONES.find((t) => t.value === tz)?.label ?? tz

  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: compact ? 12 : 16, transition: 'border-color 0.2s' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>
            {post.title}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 4 }}>
            <StatusBadge variant={canonicalMeta.badgeVariant} label={canonicalMeta.label} size="sm" />
            {post.platform && (
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>
                {PLATFORM_ICONS[post.platform]} {post.platform}
              </span>
            )}
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>
              {CONTENT_TYPE_LABELS[post.contentType] ?? post.contentType}
            </span>
          </div>
          {post.scheduledFor && (
            <div style={{ color: post.status === 'scheduled' ? '#00c8ff' : 'rgba(255,255,255,0.3)', fontSize: 11 }}>
              📅 {fmtDateTime(post.scheduledFor, tz)} · {tzLabel}
            </div>
          )}
        </div>
        {!isEditing && !isRescheduling && (
          <button onClick={onDelete} style={{ background: 'transparent', border: 'none', color: 'rgba(248,113,113,0.45)', fontSize: 14, cursor: 'pointer', padding: '2px 4px', flexShrink: 0 }} title="Delete">🗑️</button>
        )}
      </div>

      {/* Preview (view mode only) */}
      {!isEditing && !isRescheduling && !compact && post.hook && (
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, lineHeight: 1.5, margin: '10px 0 6px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {post.hook}
        </p>
      )}
      {!isEditing && !isRescheduling && !compact && post.hashtags.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
          {post.hashtags.slice(0, 4).map((t) => (
            <span key={t} style={{ background: 'rgba(0,200,255,0.06)', color: 'rgba(0,200,255,0.5)', borderRadius: 20, padding: '1px 6px', fontSize: 10 }}>{t}</span>
          ))}
          {post.hashtags.length > 4 && <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10, padding: '1px 3px' }}>+{post.hashtags.length - 4}</span>}
        </div>
      )}

      {/* Edit mode */}
      {isEditing && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(['title','hook','caption'] as const).map((field) => (
            <div key={field}>
              <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 700, display: 'block', marginBottom: 3, textTransform: 'capitalize' }}>{field}</label>
              {field === 'title'
                ? <input style={inputStyle} value={editBuf[field]} onChange={(e) => onEditBufChange({ [field]: e.target.value })} />
                : <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
                    value={editBuf[field]} onChange={(e) => onEditBufChange({ [field]: e.target.value })} />
              }
            </div>
          ))}
          <div>
            <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 700, display: 'block', marginBottom: 3 }}>Hashtags <span style={{ fontWeight: 400 }}>(comma-separated)</span></label>
            <input style={inputStyle} value={editBuf.hashtags} onChange={(e) => onEditBufChange({ hashtags: e.target.value })} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onEditSave} style={{ background: 'linear-gradient(135deg,#0057e7,#00c8ff)', color: '#fff', borderRadius: 8, padding: '7px 18px', fontWeight: 700, fontSize: 12, border: 'none', cursor: 'pointer' }}>✓ Save</button>
            <button onClick={onEditCancel} style={ghostBtn()}>Cancel</button>
          </div>
        </div>
      )}

      {/* Reschedule picker */}
      {isRescheduling && (
        <div style={{ marginTop: 12 }}>
          <SchedulePicker
            value={scheduleValue} timezone={scheduleTz}
            onValueChange={onScheduleChange} onTimezoneChange={onTimezoneChange}
            onConfirm={onScheduleConfirm} onCancel={onScheduleCancel}
          />
        </div>
      )}

      {/* Actions (view mode) */}
      {!isEditing && !isRescheduling && (
        <PostActionRow
          post={post}
          onReschedule={onReschedule}
          onMarkPosted={onMarkPosted}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          onEdit={onEditStart}
        />
      )}
    </div>
  )
}

// ── Month View ─────────────────────────────────────────────────────────────────

interface MonthViewProps {
  posts:          AIContentResult[]
  year:           number
  month:          number
  selectedId:     string | null
  onSelectPost:   (id: string | null) => void
}

function MonthView({ posts, year, month, selectedId, onSelectPost }: MonthViewProps) {
  const firstDay     = new Date(year, month, 1)
  const daysInMonth  = new Date(year, month + 1, 0).getDate()
  const startPad     = firstDay.getDay()

  const cells: (number | null)[] = [
    ...Array(startPad).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  // Group posts by day number in this month
  const postsByDay: Record<number, AIContentResult[]> = {}
  for (const p of posts) {
    if (!p.scheduledFor) continue
    const d = new Date(p.scheduledFor)
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate()
      if (!postsByDay[day]) postsByDay[day] = []
      postsByDay[day].push(p)
    }
  }

  const todayDate = new Date()
  const todayDay  = todayDate.getFullYear() === year && todayDate.getMonth() === month ? todayDate.getDate() : -1

  return (
    <div>
      {/* Weekday headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, marginBottom: 1 }}>
        {WEEKDAYS_SHORT.map((d) => (
          <div key={d} style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: 700, textAlign: 'center', padding: '6px 0', letterSpacing: '0.06em' }}>{d}</div>
        ))}
      </div>
      {/* Day cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
        {cells.map((day, idx) => {
          if (day === null) return (
            <div key={`empty-${idx}`} style={{ background: 'rgba(0,0,0,0.15)', minHeight: 90, borderRadius: 6 }} />
          )
          const dayPosts = postsByDay[day] ?? []
          const isThisDay = day === todayDay
          return (
            <div key={day} style={{ background: isThisDay ? 'rgba(0,200,255,0.07)' : 'rgba(255,255,255,0.02)', border: `1px solid ${isThisDay ? 'rgba(0,200,255,0.25)' : 'rgba(255,255,255,0.05)'}`, borderRadius: 6, minHeight: 90, padding: 6 }}>
              <div style={{ color: isThisDay ? '#00c8ff' : 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: isThisDay ? 700 : 400, marginBottom: 4 }}>{day}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {dayPosts.slice(0, 3).map((p) => (
                  <div key={p.id} onClick={() => onSelectPost(selectedId === p.id ? null : p.id)}
                    style={{ background: PLATFORM_COLORS[p.platform ?? ''] ?? 'rgba(0,200,255,0.5)', borderRadius: 4, padding: '2px 5px', fontSize: 10, color: '#fff', display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer', overflow: 'hidden', fontWeight: 600, border: selectedId === p.id ? '1px solid #fff' : '1px solid transparent' }}>
                    <span>{PLATFORM_ICONS[p.platform ?? ''] ?? '📱'}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{fmtTime(p.scheduledFor!)}</span>
                  </div>
                ))}
                {dayPosts.length > 3 && (
                  <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 9, textAlign: 'center' }}>+{dayPosts.length - 3} more</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Week View ──────────────────────────────────────────────────────────────────

interface WeekViewProps {
  posts:        AIContentResult[]
  weekDates:    Date[]
  selectedId:   string | null
  onSelectPost: (id: string | null) => void
}

function WeekView({ posts, weekDates, selectedId, onSelectPost }: WeekViewProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
      {weekDates.map((date) => {
        const dayPosts = posts.filter((p) => p.scheduledFor && sameDay(new Date(p.scheduledFor), date))
        const today    = isToday(date)
        return (
          <div key={date.toISOString()} style={{ minHeight: 200 }}>
            {/* Day header */}
            <div style={{ textAlign: 'center', marginBottom: 8, padding: '6px 4px', background: today ? 'rgba(0,200,255,0.1)' : 'rgba(255,255,255,0.03)', border: `1px solid ${today ? 'rgba(0,200,255,0.25)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 8 }}>
              <div style={{ color: today ? '#00c8ff' : 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 700 }}>
                {WEEKDAYS_SHORT[date.getDay()]}
              </div>
              <div style={{ color: today ? '#00c8ff' : '#fff', fontSize: 16, fontWeight: today ? 800 : 600 }}>
                {date.getDate()}
              </div>
            </div>
            {/* Posts */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {dayPosts.map((p) => {
                const canonicalMeta = STATUS_META[p.status] ?? STATUS_META.draft
                return (
                  <div key={p.id} onClick={() => onSelectPost(selectedId === p.id ? null : p.id)}
                    style={{ background: selectedId === p.id ? 'rgba(0,200,255,0.12)' : 'rgba(255,255,255,0.04)', border: `1px solid ${selectedId === p.id ? 'rgba(0,200,255,0.35)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 8, padding: '6px 8px', cursor: 'pointer' }}>
                    <div style={{ fontSize: 14, marginBottom: 2 }}>{PLATFORM_ICONS[p.platform ?? ''] ?? '📱'}</div>
                    <div style={{ color: '#fff', fontSize: 10, fontWeight: 600, lineHeight: 1.3, marginBottom: 3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {p.title}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                      <StatusBadge variant={canonicalMeta.badgeVariant} label={canonicalMeta.label} size="sm" />
                      {p.scheduledFor && <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 9, fontWeight: 600 }}>{fmtTime(p.scheduledFor)}</span>}
                    </div>
                  </div>
                )
              })}
              {dayPosts.length === 0 && (
                <div style={{ color: 'rgba(255,255,255,0.12)', fontSize: 10, textAlign: 'center', padding: '16px 0' }}>—</div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── List View ──────────────────────────────────────────────────────────────────

interface ListViewProps {
  posts:              AIContentResult[]
  editingId:          string | null
  editBuf:            EditBuf
  reschedulingId:     string | null
  scheduleValue:      string
  scheduleTz:         string
  onEditBufChange:    (d: Partial<EditBuf>) => void
  onScheduleChange:   (v: string) => void
  onTimezoneChange:   (tz: string) => void
  onEditStart:        (p: AIContentResult) => void
  onEditSave:         (id: string) => void
  onEditCancel:       () => void
  onRescheduleStart:  (p: AIContentResult) => void
  onScheduleConfirm:  (id: string) => void
  onScheduleCancel:   () => void
  onMarkPosted:       (id: string) => void
  onDuplicate:        (p: AIContentResult) => void
  onDelete:           (id: string) => void
}

function ListView({
  posts, editingId, editBuf, reschedulingId, scheduleValue, scheduleTz,
  onEditBufChange, onScheduleChange, onTimezoneChange,
  onEditStart, onEditSave, onEditCancel,
  onRescheduleStart, onScheduleConfirm, onScheduleCancel,
  onMarkPosted, onDuplicate, onDelete,
}: ListViewProps) {
  // Group by day
  const grouped: { dateKey: string; dateLabel: string; posts: AIContentResult[] }[] = []
  const seen = new Set<string>()
  const unscheduled: AIContentResult[] = []

  for (const p of posts) {
    if (!p.scheduledFor) {
      unscheduled.push(p)
      continue
    }
    const d    = new Date(p.scheduledFor)
    const key  = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    if (!seen.has(key)) {
      seen.add(key)
      grouped.push({ dateKey: key, dateLabel: fmtDayLabel(d), posts: [] })
    }
    grouped[grouped.length - 1].posts.push(p)
  }

  if (unscheduled.length > 0) {
    grouped.unshift({ dateKey: 'no-date', dateLabel: 'No scheduled date', posts: unscheduled })
  }

  if (grouped.length === 0) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {grouped.map(({ dateKey, dateLabel, posts: gPosts }) => (
        <div key={dateKey}>
          <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>{dateLabel}</span>
            <span style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 20, padding: '1px 7px', fontSize: 10 }}>{gPosts.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {gPosts.map((p) => (
              <PostCard
                key={p.id}
                post={p}
                isEditing={editingId === p.id}
                editBuf={editBuf}
                isRescheduling={reschedulingId === p.id}
                scheduleValue={scheduleValue}
                scheduleTz={scheduleTz}
                onEditBufChange={onEditBufChange}
                onScheduleChange={onScheduleChange}
                onTimezoneChange={onTimezoneChange}
                onEditStart={() => onEditStart(p)}
                onEditSave={() => onEditSave(p.id)}
                onEditCancel={onEditCancel}
                onReschedule={() => onRescheduleStart(p)}
                onScheduleConfirm={() => onScheduleConfirm(p.id)}
                onScheduleCancel={onScheduleCancel}
                onMarkPosted={() => onMarkPosted(p.id)}
                onDuplicate={() => onDuplicate(p)}
                onDelete={() => onDelete(p.id)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── ContentCalendar (main) ─────────────────────────────────────────────────────

export function ContentCalendar() {
  // ── View / navigation state ─────────────────────────────────────────────────
  const [viewMode, setViewMode]     = useState<ViewMode>('list')
  const [navDate, setNavDate]       = useState(new Date())   // month/week navigation anchor
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // ── Filter state ────────────────────────────────────────────────────────────
  const [statusFilter, setStatusFilter] = useState<PostStatus | 'all'>('all')
  const [platFilter,   setPlatFilter]   = useState<Platform | 'all'>('all')
  const [typeFilter,   setTypeFilter]   = useState<ContentType | 'all'>('all')
  const [dateRange,    setDateRange]    = useState<DateRange>('all')

  // ── Data state ──────────────────────────────────────────────────────────────
  const storePosts = usePosts()
  const marketing = useMarketing()
  const posts = [...storePosts].sort((a, b) => {
    const ta = a.scheduledFor ? new Date(a.scheduledFor).getTime() : Number.POSITIVE_INFINITY
    const tb = b.scheduledFor ? new Date(b.scheduledFor).getTime() : Number.POSITIVE_INFINITY
    return ta - tb
  })

  // ── Edit state ──────────────────────────────────────────────────────────────
  const [editingId,  setEditingId]  = useState<string | null>(null)
  const [editBuf,    setEditBuf]    = useState<EditBuf>({ title: '', hook: '', caption: '', hashtags: '' })

  // ── Schedule state ──────────────────────────────────────────────────────────
  const [reschedulingId, setReschedulingId] = useState<string | null>(null)
  const [scheduleValue,  setScheduleValue]  = useState('')
  const [scheduleTz,     setScheduleTz]     = useState(() => getBrowserTz())

  // ── Toasts ──────────────────────────────────────────────────────────────────
  const [toasts, setToasts] = useState<Toast[]>([])

  function showToast(message: string, type: Toast['type'] = 'success') {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 2800)
  }

  // ── Derived: filtered posts ─────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let p = posts
    if (statusFilter !== 'all') p = p.filter((x) => x.status === statusFilter)
    if (platFilter   !== 'all') p = p.filter((x) => x.platform === platFilter)
    if (typeFilter   !== 'all') p = p.filter((x) => x.contentType === typeFilter)
    p = applyDateRange(p, dateRange)
    return p
  }, [posts, statusFilter, platFilter, typeFilter, dateRange])

  // ── Navigation ──────────────────────────────────────────────────────────────
  function prevPeriod() {
    const d = new Date(navDate)
    if (viewMode === 'month') d.setMonth(d.getMonth() - 1)
    else d.setDate(d.getDate() - 7)
    setNavDate(d)
  }
  function nextPeriod() {
    const d = new Date(navDate)
    if (viewMode === 'month') d.setMonth(d.getMonth() + 1)
    else d.setDate(d.getDate() + 7)
    setNavDate(d)
  }
  function goToday() { setNavDate(new Date()) }

  // ── State updater helpers ───────────────────────────────────────────────────
  function applyUpdate(updated: AIContentResult, msg: string) {
    marketing.actions.upsertPost(updated)
    showToast(msg)
  }

  function applyDelete(id: string) {
    marketing.actions.deletePost(id)
    showToast('🗑️ Deleted', 'info')
  }

  // ── Edit handlers ───────────────────────────────────────────────────────────
  function handleEditStart(post: AIContentResult) {
    setReschedulingId(null); setSelectedId(null)
    setEditingId(post.id)
    setEditBuf({ title: post.title, hook: post.hook, caption: post.caption, hashtags: post.hashtags.join(', ') })
  }
  function handleEditSave(id: string) {
    const post = posts.find((p) => p.id === id); if (!post) return
    applyUpdate({
      ...post,
      title:    editBuf.title.trim()   || post.title,
      hook:     editBuf.hook.trim()    || post.hook,
      caption:  editBuf.caption.trim() || post.caption,
      hashtags: editBuf.hashtags.split(',').map((s) => s.trim()).filter(Boolean),
    }, '✏️ Changes saved')
    setEditingId(null)
  }
  function handleEditCancel() { setEditingId(null) }

  // ── Reschedule handlers ─────────────────────────────────────────────────────
  function handleRescheduleStart(post: AIContentResult) {
    setEditingId(null); setSelectedId(null)
    setReschedulingId(post.id)
    setScheduleValue(post.scheduledFor ? toLocalInput(post.scheduledFor) : defaultScheduleInput())
    setScheduleTz(post.timezone ?? getBrowserTz())
  }
  function handleScheduleConfirm(id: string) {
    if (!scheduleValue) return
    const iso = new Date(scheduleValue).toISOString()
    void marketing.schedulePost(id, iso, scheduleTz).then((r) => {
      if (r.ok) showToast(`📅 Scheduled for ${fmtDateTime(iso, scheduleTz)}`)
    })
    setReschedulingId(null)
  }
  function handleScheduleCancel() { setReschedulingId(null) }

  // ── Status actions ──────────────────────────────────────────────────────────
  function handleMarkPosted(id: string) {
    void marketing.markPostedPost(id).then((r) => {
      if (r.ok) showToast('📢 Marked as posted')
    })
  }

  // ── Duplicate ───────────────────────────────────────────────────────────────
  function handleDuplicate(post: AIContentResult) {
    const { copy } = duplicatePost(post)
    marketing.actions.upsertPost(copy)
    showToast('⧉ Duplicated as draft', 'info')
  }

  // ── Refresh ─────────────────────────────────────────────────────────────────
  function handleRefresh() {
    marketing.actions.reloadPosts(); setEditingId(null); setReschedulingId(null); setSelectedId(null)
    showToast('🔄 Refreshed', 'info')
  }

  // ── Selected post (detail panel in month/week) ──────────────────────────────
  const selectedPost = selectedId ? posts.find((p) => p.id === selectedId) : null

  // ── Computed nav label ──────────────────────────────────────────────────────
  const navLabel = viewMode === 'month'
    ? `${MONTHS[navDate.getMonth()]} ${navDate.getFullYear()}`
    : (() => {
        const days = getWeekDates(navDate)
        return `${days[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${days[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
      })()

  // ── Content types for filter dropdown ──────────────────────────────────────
  const contentTypes = Object.entries(CONTENT_TYPE_LABELS) as [ContentType, string][]

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 1100 }}>
      {/* Page header */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 20, margin: 0 }}>📅 Content Calendar</h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 4 }}>Schedule, track, and manage all AI-generated content across platforms.</p>
        </div>
        <button onClick={handleRefresh} style={ghostBtn()}>🔄 Refresh</button>
      </div>

      {/* Stats cards */}
      <StatsCards posts={posts} />

      {/* Controls bar */}
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '12px 16px', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* View mode switcher */}
          <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.25)', borderRadius: 8, padding: 3 }}>
            {(['month','week','list'] as ViewMode[]).map((v) => (
              <button key={v} onClick={() => { setViewMode(v); setSelectedId(null) }}
                style={{ padding: '5px 14px', borderRadius: 6, border: 'none', background: viewMode === v ? 'rgba(0,200,255,0.18)' : 'transparent', color: viewMode === v ? '#00c8ff' : 'rgba(255,255,255,0.4)', fontWeight: viewMode === v ? 700 : 500, fontSize: 12, cursor: 'pointer', textTransform: 'capitalize' }}>
                {v}
              </button>
            ))}
          </div>

          {/* Nav arrows (month / week) */}
          {(viewMode === 'month' || viewMode === 'week') && (
            <>
              <button onClick={prevPeriod} style={ghostBtn({ padding: '5px 10px' })}>‹</button>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: 13, minWidth: 180, textAlign: 'center' }}>{navLabel}</span>
              <button onClick={nextPeriod} style={ghostBtn({ padding: '5px 10px' })}>›</button>
              <button onClick={goToday}    style={ghostBtn({ fontSize: 11 })}>Today</button>
            </>
          )}

          <div style={{ flex: 1 }} />

          {/* Filters */}
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as PostStatus | 'all')} style={{ ...inputStyle, width: 'auto', minWidth: 120 }}>
            <option value="all">All Statuses</option>
            {Object.entries(STATUS_META).map(([s, m]) => <option key={s} value={s}>{m.label}</option>)}
          </select>
          <select value={platFilter} onChange={(e) => setPlatFilter(e.target.value as Platform | 'all')} style={{ ...inputStyle, width: 'auto', minWidth: 130 }}>
            <option value="all">All Platforms</option>
            {Object.entries(PLATFORM_ICONS).map(([p, icon]) => <option key={p} value={p}>{icon} {p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
          </select>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as ContentType | 'all')} style={{ ...inputStyle, width: 'auto', minWidth: 130 }}>
            <option value="all">All Types</option>
            {contentTypes.map(([ct, label]) => <option key={ct} value={ct}>{label}</option>)}
          </select>
          <select value={dateRange} onChange={(e) => setDateRange(e.target.value as DateRange)} style={{ ...inputStyle, width: 'auto', minWidth: 130 }}>
            <option value="all">All Dates</option>
            <option value="today">Today</option>
            <option value="this_week">This Week</option>
            <option value="this_month">This Month</option>
            <option value="next_week">Next Week</option>
            <option value="next_month">Next Month</option>
          </select>
        </div>
      </div>

      {/* Calendar content */}
      {viewMode === 'month' && (
        <>
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 16, marginBottom: 16 }}>
            <MonthView
              posts={filtered}
              year={navDate.getFullYear()}
              month={navDate.getMonth()}
              selectedId={selectedId}
              onSelectPost={setSelectedId}
            />
          </div>
          {selectedPost && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: 700, marginBottom: 8 }}>SELECTED POST</div>
              <PostCard
                post={selectedPost}
                isEditing={editingId === selectedPost.id}
                editBuf={editBuf}
                isRescheduling={reschedulingId === selectedPost.id}
                scheduleValue={scheduleValue}
                scheduleTz={scheduleTz}
                onEditBufChange={(d) => setEditBuf((prev) => ({ ...prev, ...d }))}
                onScheduleChange={setScheduleValue}
                onTimezoneChange={setScheduleTz}
                onEditStart={() => handleEditStart(selectedPost)}
                onEditSave={() => handleEditSave(selectedPost.id)}
                onEditCancel={handleEditCancel}
                onReschedule={() => handleRescheduleStart(selectedPost)}
                onScheduleConfirm={() => handleScheduleConfirm(selectedPost.id)}
                onScheduleCancel={handleScheduleCancel}
                onMarkPosted={() => handleMarkPosted(selectedPost.id)}
                onDuplicate={() => handleDuplicate(selectedPost)}
                onDelete={() => { applyDelete(selectedPost.id); setSelectedId(null) }}
              />
            </div>
          )}
        </>
      )}

      {viewMode === 'week' && (
        <>
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 16, marginBottom: 16 }}>
            <WeekView
              posts={filtered}
              weekDates={getWeekDates(navDate)}
              selectedId={selectedId}
              onSelectPost={setSelectedId}
            />
          </div>
          {selectedPost && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: 700, marginBottom: 8 }}>SELECTED POST</div>
              <PostCard
                post={selectedPost}
                isEditing={editingId === selectedPost.id}
                editBuf={editBuf}
                isRescheduling={reschedulingId === selectedPost.id}
                scheduleValue={scheduleValue}
                scheduleTz={scheduleTz}
                onEditBufChange={(d) => setEditBuf((prev) => ({ ...prev, ...d }))}
                onScheduleChange={setScheduleValue}
                onTimezoneChange={setScheduleTz}
                onEditStart={() => handleEditStart(selectedPost)}
                onEditSave={() => handleEditSave(selectedPost.id)}
                onEditCancel={handleEditCancel}
                onReschedule={() => handleRescheduleStart(selectedPost)}
                onScheduleConfirm={() => handleScheduleConfirm(selectedPost.id)}
                onScheduleCancel={handleScheduleCancel}
                onMarkPosted={() => handleMarkPosted(selectedPost.id)}
                onDuplicate={() => handleDuplicate(selectedPost)}
                onDelete={() => { applyDelete(selectedPost.id); setSelectedId(null) }}
              />
            </div>
          )}
        </>
      )}

      {viewMode === 'list' && (
        filtered.length > 0
          ? <ListView
              posts={filtered}
              editingId={editingId}
              editBuf={editBuf}
              reschedulingId={reschedulingId}
              scheduleValue={scheduleValue}
              scheduleTz={scheduleTz}
              onEditBufChange={(d) => setEditBuf((prev) => ({ ...prev, ...d }))}
              onScheduleChange={setScheduleValue}
              onTimezoneChange={setScheduleTz}
              onEditStart={handleEditStart}
              onEditSave={handleEditSave}
              onEditCancel={handleEditCancel}
              onRescheduleStart={handleRescheduleStart}
              onScheduleConfirm={handleScheduleConfirm}
              onScheduleCancel={handleScheduleCancel}
              onMarkPosted={handleMarkPosted}
              onDuplicate={handleDuplicate}
              onDelete={applyDelete}
            />
          : <div style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: 60, fontSize: 13, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16 }}>
              No scheduled content matches the current filters.
              <br />
              <button onClick={() => { setStatusFilter('all'); setPlatFilter('all'); setTypeFilter('all'); setDateRange('all') }}
                style={{ ...ghostBtn(), marginTop: 12 }}>
                Clear filters
              </button>
            </div>
      )}

      {/* No items at all */}
      {posts.length === 0 && (
        <div style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: 60, fontSize: 13 }}>
          No scheduled content yet.<br />
          Approve a post in the <strong style={{ color: 'rgba(255,255,255,0.5)' }}>Approval Queue</strong> and click <strong style={{ color: 'rgba(255,255,255,0.5)' }}>Schedule</strong>.
        </div>
      )}

      <div style={{ height: 40 }} />
      <ToastStack toasts={toasts} />
    </div>
  )
}
