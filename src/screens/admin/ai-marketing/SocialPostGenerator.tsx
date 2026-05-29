import { useState, useEffect } from 'react'
import {
  generateAIContent,
  type AIContentParams,
  type AIContentResult,
} from '../../../lib/aiMarketing'
import { upsertPost, loadPosts } from '../../../lib/postStorage'
import { SchedulePicker } from './ContentCalendar'

// ── Style constants ────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  color: '#fff',
  borderRadius: 10,
  padding: '10px 14px',
  fontSize: 13,
  width: '100%',
  outline: 'none',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  color: 'rgba(255,255,255,0.6)',
  fontSize: 12,
  fontWeight: 600,
  marginBottom: 6,
  display: 'block',
}

const primaryBtn: React.CSSProperties = {
  background: 'linear-gradient(135deg,#0057e7,#00c8ff)',
  color: '#fff',
  borderRadius: 12,
  padding: '10px 20px',
  fontWeight: 700,
  fontSize: 13,
  border: 'none',
  cursor: 'pointer',
}

const ghostBtn: React.CSSProperties = {
  background: 'rgba(255,255,255,0.07)',
  border: '1px solid rgba(255,255,255,0.15)',
  color: 'rgba(255,255,255,0.7)',
  borderRadius: 10,
  padding: '8px 16px',
  fontWeight: 600,
  fontSize: 12,
  cursor: 'pointer',
}

const cardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(0,190,255,0.15)',
  borderRadius: 16,
}

// ── Count helpers (derived from unified postStorage) ──────────────────────────

function countByStatus(status: AIContentResult['status']): number {
  return loadPosts().filter((p) => p.status === status).length
}

// ── Types ──────────────────────────────────────────────────────────────────────

type OutputTab = 'hook' | 'caption' | 'hashtags' | 'script' | 'schedule'

interface FormData {
  topic: string
  platform: AIContentParams['platform']
  tone: AIContentParams['tone']
  goal: string
  callToAction: string
}

interface Toast {
  id: number
  message: string
  type: 'success' | 'info'
}

// ── Status badge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: AIContentResult['status'] }) {
  const map: Record<AIContentResult['status'], { label: string; color: string; bg: string }> = {
    draft:            { label: 'DRAFT',            color: 'rgba(255,255,255,0.5)', bg: 'rgba(255,255,255,0.07)' },
    pending_approval: { label: 'PENDING APPROVAL', color: '#fbbf24', bg: 'rgba(251,191,36,0.1)' },
    approved:         { label: 'APPROVED',          color: '#22c55e', bg: 'rgba(34,197,94,0.1)'  },
    scheduled:        { label: 'SCHEDULED',         color: '#00c8ff', bg: 'rgba(0,200,255,0.1)'  },
    posted:           { label: 'POSTED',            color: '#a855f7', bg: 'rgba(168,85,247,0.1)' },
    rejected:         { label: 'REJECTED',          color: '#f87171', bg: 'rgba(248,113,113,0.1)'},
    failed:           { label: 'FAILED',            color: '#fb923c', bg: 'rgba(251,146,60,0.1)' },
  }
  const s = map[status]
  return (
    <span
      style={{
        background: s.bg,
        color: s.color,
        borderRadius: 20,
        padding: '3px 10px',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.04em',
      }}
    >
      {s.label}
    </span>
  )
}

// ── Toast component ────────────────────────────────────────────────────────────

function ToastStack({ toasts }: { toasts: Toast[] }) {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            background: t.type === 'success'
              ? 'rgba(34,197,94,0.92)'
              : 'rgba(0,200,255,0.92)',
            color: '#fff',
            borderRadius: 12,
            padding: '10px 18px',
            fontWeight: 700,
            fontSize: 13,
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            animation: 'fadeUp 0.25s ease',
          }}
        >
          {t.message}
        </div>
      ))}
      <style>{`@keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }`}</style>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function SocialPostGenerator() {
  const [formData, setFormData] = useState<FormData>({
    topic: '',
    platform: 'instagram',
    tone: 'friendly',
    goal: '',
    callToAction: '',
  })
  const [isGenerating, setIsGenerating] = useState(false)
  const [result, setResult]             = useState<AIContentResult | null>(null)
  const [activeTab, setActiveTab]       = useState<OutputTab>('hook')
  const [copied, setCopied]             = useState(false)
  const [isEditing, setIsEditing]       = useState(false)
  const [editValue, setEditValue]       = useState('')
  const [toasts, setToasts]             = useState<Toast[]>([])
  const [draftCount, setDraftCount]     = useState<number>(() => countByStatus('draft'))
  const [queueCount, setQueueCount]     = useState<number>(() => countByStatus('pending_approval'))
  const [isScheduling, setIsScheduling] = useState(false)
  const [scheduleValue, setScheduleValue] = useState('')
  const [scheduleTz, setScheduleTz]     = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone)

  // Exit edit mode whenever we switch tabs
  useEffect(() => {
    setIsEditing(false)
  }, [activeTab])

  // ── Toast helper ─────────────────────────────────────────────────────────────

  function showToast(message: string, type: Toast['type'] = 'success') {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 2800)
  }

  // ── Field updater ────────────────────────────────────────────────────────────

  function updateField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }

  // ── Generate ─────────────────────────────────────────────────────────────────

  async function handleGenerate() {
    if (!formData.topic.trim()) return
    setIsGenerating(true)
    setResult(null)
    setIsEditing(false)
    setActiveTab('hook')
    try {
      const params: AIContentParams = {
        contentType: 'social_post',
        topic: formData.topic,
        platform: formData.platform,
        tone: formData.tone,
        goal: formData.goal || undefined,
        callToAction: formData.callToAction || undefined,
      }
      const res = await generateAIContent(params)
      setResult(res)
      // Auto-save as draft immediately after generation
      const all = upsertPost(res)
      setDraftCount(all.filter((p) => p.status === 'draft').length)
    } finally {
      setIsGenerating(false)
    }
  }

  // ── Copy ─────────────────────────────────────────────────────────────────────

  async function handleCopy() {
    if (!result) return
    const text = isEditing ? editValue : getTabContent()
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard not available in some envs
    }
  }

  // ── Edit mode ────────────────────────────────────────────────────────────────

  function handleEditStart() {
    setEditValue(getTabContent())
    setIsEditing(true)
  }

  function handleEditDone() {
    if (!result) return
    // Commit the edited value back into result
    setResult((prev) => {
      if (!prev) return prev
      switch (activeTab) {
        case 'hook':     return { ...prev, hook: editValue }
        case 'caption':  return { ...prev, caption: editValue }
        case 'hashtags': return { ...prev, hashtags: editValue.split('\n').map((s) => s.trim()).filter(Boolean) }
        case 'script':   return { ...prev, script: editValue }
        default:         return prev
      }
    })
    setIsEditing(false)
  }

  function handleEditCancel() {
    setIsEditing(false)
  }

  // ── Save Draft ───────────────────────────────────────────────────────────────

  function handleSaveDraft() {
    if (!result) return
    const all    = upsertPost(result)
    const drafts = all.filter((p) => p.status === 'draft').length
    setDraftCount(drafts)
    showToast(`💾 Draft saved! (${drafts} total)`, 'success')
  }

  // ── Send to Approval Queue ───────────────────────────────────────────────────

  function handleSendToQueue() {
    if (!result) return
    const queued: AIContentResult = { ...result, status: 'pending_approval' }
    setResult(queued)
    const all     = upsertPost(queued)
    const pending = all.filter((p) => p.status === 'pending_approval').length
    setQueueCount(pending)
    showToast(`✅ Sent to Approval Queue! (${pending} pending)`, 'success')
  }

  // ── Discard ──────────────────────────────────────────────────────────────────

  function handleDiscard() {
    setResult(null)
    setIsEditing(false)
    setIsScheduling(false)
  }

  // ── Schedule ─────────────────────────────────────────────────────────────────

  function handleScheduleStart() {
    if (!result) return
    if (result.scheduledFor) {
      const d = new Date(result.scheduledFor)
      const pad = (n: number) => String(n).padStart(2, '0')
      setScheduleValue(`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`)
      setScheduleTz(result.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone)
    } else {
      const d = new Date(); d.setDate(d.getDate() + 2); d.setHours(9, 0, 0, 0)
      const pad = (n: number) => String(n).padStart(2, '0')
      setScheduleValue(`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`)
    }
    setIsScheduling(true)
    setIsEditing(false)
  }

  function handleScheduleConfirm() {
    if (!result || !scheduleValue) return
    const scheduled: AIContentResult = {
      ...result,
      status: 'scheduled',
      scheduledFor: new Date(scheduleValue).toISOString(),
      timezone: scheduleTz,
    }
    setResult(scheduled)
    const all = upsertPost(scheduled)
    setDraftCount(all.filter((p) => p.status === 'draft').length)
    setIsScheduling(false)
    showToast('📅 Post scheduled!', 'success')
  }

  function handleScheduleCancel() {
    setIsScheduling(false)
  }

  // ── Tab content ──────────────────────────────────────────────────────────────

  function getTabContent(): string {
    if (!result) return ''
    switch (activeTab) {
      case 'hook':     return result.hook
      case 'caption':  return result.caption
      case 'hashtags': return result.hashtags.join('\n')
      case 'script':   return result.script || '(No script for this content type.)'
      case 'schedule':
        return result.scheduledFor
          ? `Scheduled for: ${new Date(result.scheduledFor).toLocaleString()}`
          : 'Not yet scheduled. Use the Approval Queue to schedule this post.'
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const OUTPUT_TABS: { id: OutputTab; label: string }[] = [
    { id: 'hook',     label: 'Hook'     },
    { id: 'caption',  label: 'Caption'  },
    { id: 'hashtags', label: 'Hashtags' },
    { id: 'script',   label: 'Script'   },
    { id: 'schedule', label: 'Schedule' },
  ]

  const canEdit = result && activeTab !== 'schedule'

  return (
    <div style={{ maxWidth: 960 }}>
      {/* Page header */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 20, margin: 0 }}>
            ✍️ Social Post Generator
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 4 }}>
            Generate AI-powered social media content for Cyan's Brooklynn Recycling in seconds.
          </p>
        </div>
        {/* Draft / Queue counters */}
        <div style={{ display: 'flex', gap: 8 }}>
          {draftCount > 0 && (
            <span style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.5)', borderRadius: 20, padding: '4px 12px', fontSize: 11, fontWeight: 700 }}>
              💾 {draftCount} Draft{draftCount !== 1 ? 's' : ''}
            </span>
          )}
          {queueCount > 0 && (
            <span style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)', color: '#fbbf24', borderRadius: 20, padding: '4px 12px', fontSize: 11, fontWeight: 700 }}>
              ✅ {queueCount} In Queue
            </span>
          )}
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: result ? '1fr 1fr' : '1fr',
          gap: 20,
          alignItems: 'start',
        }}
      >
        {/* ── Form ── */}
        <div style={{ ...cardStyle, padding: 24 }}>
          <h3 style={{ color: '#fff', fontWeight: 700, fontSize: 15, margin: '0 0 20px' }}>
            Content Parameters
          </h3>

          {/* Topic */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Topic *</label>
            <input
              style={inputStyle}
              placeholder="e.g. Why recycling matters for Nashville families"
              value={formData.topic}
              onChange={(e) => updateField('topic', e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
            />
          </div>

          {/* Platform */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Platform</label>
            <select
              style={inputStyle}
              value={formData.platform}
              onChange={(e) => updateField('platform', e.target.value as FormData['platform'])}
            >
              <option value="instagram">Instagram</option>
              <option value="tiktok">TikTok</option>
              <option value="facebook">Facebook</option>
              <option value="twitter">Twitter / X</option>
              <option value="linkedin">LinkedIn</option>
              <option value="youtube">YouTube</option>
            </select>
          </div>

          {/* Tone */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Tone</label>
            <select
              style={inputStyle}
              value={formData.tone}
              onChange={(e) => updateField('tone', e.target.value as FormData['tone'])}
            >
              <option value="professional">Professional</option>
              <option value="friendly">Friendly</option>
              <option value="urgent">Urgent</option>
              <option value="educational">Educational</option>
              <option value="inspiring">Inspiring</option>
              <option value="humorous">Humorous</option>
            </select>
          </div>

          {/* Goal */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Goal</label>
            <input
              style={inputStyle}
              placeholder="e.g. Increase signups, Drive awareness"
              value={formData.goal}
              onChange={(e) => updateField('goal', e.target.value)}
            />
          </div>

          {/* CTA */}
          <div style={{ marginBottom: 24 }}>
            <label style={labelStyle}>Call-to-Action</label>
            <input
              style={inputStyle}
              placeholder="e.g. Sign up at cbrecycling.org"
              value={formData.callToAction}
              onChange={(e) => updateField('callToAction', e.target.value)}
            />
          </div>

          {/* Generate button */}
          <button
            style={{
              ...primaryBtn,
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              opacity: isGenerating || !formData.topic.trim() ? 0.65 : 1,
              cursor: isGenerating || !formData.topic.trim() ? 'not-allowed' : 'pointer',
            }}
            onClick={handleGenerate}
            disabled={isGenerating || !formData.topic.trim()}
          >
            {isGenerating ? (
              <>
                <Spinner />
                Generating...
              </>
            ) : (
              '🤖 Generate Content'
            )}
          </button>

          {/* Hint */}
          <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, textAlign: 'center', marginTop: 10 }}>
            Generated content is automatically saved as a draft
          </p>
        </div>

        {/* ── Output panel ── */}
        {result && (
          <div style={{ ...cardStyle, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <h3 style={{ color: '#fff', fontWeight: 700, fontSize: 15, margin: 0 }}>
                  {result.title}
                </h3>
                <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center' }}>
                  <StatusBadge status={result.status} />
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>
                    {result.platform} · {result.tone}
                  </span>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 12 }}>
              {OUTPUT_TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 8,
                    border: activeTab === tab.id
                      ? '1px solid rgba(0,200,255,0.4)'
                      : '1px solid transparent',
                    background: activeTab === tab.id ? 'rgba(0,200,255,0.1)' : 'transparent',
                    color: activeTab === tab.id ? '#00c8ff' : 'rgba(255,255,255,0.4)',
                    fontSize: 12,
                    fontWeight: activeTab === tab.id ? 700 : 500,
                    cursor: 'pointer',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Content box */}
            <div style={{ position: 'relative' }}>
              {isEditing ? (
                /* ── Edit mode ── */
                <textarea
                  autoFocus
                  style={{
                    ...inputStyle,
                    minHeight: 160,
                    maxHeight: 300,
                    resize: 'vertical',
                    padding: '14px',
                    lineHeight: 1.65,
                    fontFamily: 'inherit',
                  }}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                />
              ) : (
                /* ── View mode ── */
                <div
                  style={{
                    background: 'rgba(0,0,0,0.25)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 10,
                    padding: '14px 14px 40px',
                    minHeight: 120,
                    maxHeight: 300,
                    overflowY: 'auto',
                    color: 'rgba(255,255,255,0.85)',
                    fontSize: 13,
                    lineHeight: 1.65,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {getTabContent()}
                </div>
              )}

              {/* Copy button (absolute bottom-right of view, top-right of edit) */}
              {!isEditing && (
                <button
                  onClick={handleCopy}
                  style={{
                    position: 'absolute',
                    bottom: 8,
                    right: 8,
                    ...ghostBtn,
                    fontSize: 11,
                    padding: '5px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  {copied ? '✓ Copied' : '📋 Copy'}
                </button>
              )}
            </div>

            {/* Edit mode controls */}
            {isEditing && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  style={{ ...primaryBtn, fontSize: 12, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 5 }}
                  onClick={handleEditDone}
                >
                  ✓ Done Editing
                </button>
                <button
                  style={{ ...ghostBtn, fontSize: 12 }}
                  onClick={handleCopy}
                >
                  {copied ? '✓ Copied' : '📋 Copy'}
                </button>
                <button
                  style={{ ...ghostBtn, fontSize: 12, color: 'rgba(248,113,113,0.8)', borderColor: 'rgba(248,113,113,0.2)' }}
                  onClick={handleEditCancel}
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Hashtag pills (only on hashtags tab, view mode) */}
            {activeTab === 'hashtags' && !isEditing && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {result.hashtags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      background: 'rgba(0,200,255,0.08)',
                      border: '1px solid rgba(0,200,255,0.15)',
                      color: '#00c8ff',
                      borderRadius: 20,
                      padding: '3px 10px',
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* ── Action buttons ── */}
            {!isEditing && !isScheduling && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Row 1: Edit + Copy */}
                <div style={{ display: 'flex', gap: 8 }}>
                  {canEdit && (
                    <button
                      style={{ ...ghostBtn, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                      onClick={handleEditStart}
                    >
                      ✏️ Edit
                    </button>
                  )}
                  <button
                    style={{ ...ghostBtn, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                    onClick={handleCopy}
                  >
                    {copied ? '✓ Copied' : '📋 Copy'}
                  </button>
                </div>

                {/* Row 2: Save Draft + Schedule + Send to Queue */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    style={{
                      ...ghostBtn,
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 5,
                      background: 'rgba(99,102,241,0.1)',
                      borderColor: 'rgba(99,102,241,0.25)',
                      color: '#818cf8',
                    }}
                    onClick={handleSaveDraft}
                  >
                    💾 Save Draft
                  </button>
                  <button
                    style={{
                      ...ghostBtn,
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 5,
                      background: result.status === 'scheduled'
                        ? 'rgba(0,200,255,0.08)'
                        : 'rgba(0,200,255,0.1)',
                      borderColor: result.status === 'scheduled'
                        ? 'rgba(0,200,255,0.2)'
                        : 'rgba(0,200,255,0.3)',
                      color: '#00c8ff',
                    }}
                    onClick={handleScheduleStart}
                  >
                    📅 {result.status === 'scheduled' ? 'Reschedule' : 'Schedule'}
                  </button>
                  <button
                    style={{
                      ...ghostBtn,
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 5,
                      background: result.status === 'pending_approval'
                        ? 'rgba(251,191,36,0.08)'
                        : 'rgba(34,197,94,0.08)',
                      borderColor: result.status === 'pending_approval'
                        ? 'rgba(251,191,36,0.25)'
                        : 'rgba(34,197,94,0.2)',
                      color: result.status === 'pending_approval' ? '#fbbf24' : '#22c55e',
                      opacity: result.status === 'pending_approval' ? 0.7 : 1,
                      cursor: result.status === 'pending_approval' ? 'not-allowed' : 'pointer',
                    }}
                    onClick={handleSendToQueue}
                    disabled={result.status === 'pending_approval'}
                  >
                    {result.status === 'pending_approval' ? '⏳ In Queue' : '✅ Send to Queue'}
                  </button>
                </div>

                {/* Row 3: Discard */}
                <button
                  style={{
                    ...ghostBtn,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 5,
                    color: 'rgba(248,113,113,0.7)',
                    borderColor: 'rgba(248,113,113,0.15)',
                    fontSize: 12,
                  }}
                  onClick={handleDiscard}
                >
                  🗑️ Discard
                </button>
              </div>
            )}

            {/* ── Inline SchedulePicker ── */}
            {isScheduling && (
              <SchedulePicker
                value={scheduleValue}
                timezone={scheduleTz}
                onValueChange={setScheduleValue}
                onTimezoneChange={setScheduleTz}
                onConfirm={handleScheduleConfirm}
                onCancel={handleScheduleCancel}
              />
            )}

            {/* Demo / error fallback banner */}
            {result._source === 'demo' && (
              <DemoFallbackBanner error={result._error} />
            )}

            {/* Approval status banner */}
            {result.status === 'pending_approval' && (
              <div
                style={{
                  background: 'rgba(251,191,36,0.08)',
                  border: '1px solid rgba(251,191,36,0.2)',
                  borderRadius: 10,
                  padding: '10px 14px',
                  color: '#fbbf24',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                ⏳ Sent to Approval Queue — visible in the Queue tab.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom spacer */}
      <div style={{ height: 40 }} />

      {/* Toast notifications */}
      <ToastStack toasts={toasts} />
    </div>
  )
}

// ── DemoFallbackBanner ────────────────────────────────────────────────────────

function DemoFallbackBanner({ error }: { error?: string }) {
  const isCreditError = !!error && (
    error.toLowerCase().includes('credit') ||
    error.toLowerCase().includes('balance') ||
    error.toLowerCase().includes('insufficient')
  )

  if (isCreditError) {
    return (
      <div style={{
        background: 'rgba(251,191,36,0.08)',
        border: '1px solid rgba(251,191,36,0.25)',
        borderRadius: 10,
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
      }}>
        <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
        <div>
          <span style={{ color: '#fbbf24', fontWeight: 700, fontSize: 12, display: 'block' }}>
            Anthropic credit balance too low — showing demo content
          </span>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, margin: '4px 0 0', lineHeight: 1.5 }}>
            Add credits at{' '}
            <a
              href="https://console.anthropic.com/billing"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#fbbf24', textDecoration: 'underline' }}
            >
              console.anthropic.com/billing
            </a>
            {' '}to enable live Claude-generated content.
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{
        background: 'rgba(251,191,36,0.08)',
        border: '1px solid rgba(251,191,36,0.25)',
        borderRadius: 10,
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
      }}>
        <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
        <div>
          <span style={{ color: '#fbbf24', fontWeight: 700, fontSize: 12, display: 'block' }}>
            Claude API error — showing demo content
          </span>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, margin: '3px 0 0' }}>{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 10,
      padding: '10px 14px',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
    }}>
      <span style={{ fontSize: 14 }}>ℹ️</span>
      <span style={{ color: 'rgba(255,255,255,0.45)', fontWeight: 700, fontSize: 12 }}>
        Demo content — add{' '}
        <code style={{ fontFamily: 'monospace', fontSize: 11 }}>ANTHROPIC_API_KEY</code>
        {' '}to <code style={{ fontFamily: 'monospace', fontSize: 11 }}>.env.local</code> to enable live generation.
      </span>
    </div>
  )
}

// ── Spinner ────────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 14,
        height: 14,
        border: '2px solid rgba(255,255,255,0.3)',
        borderTop: '2px solid #fff',
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
      }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </span>
  )
}
