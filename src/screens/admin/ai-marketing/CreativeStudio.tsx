// CreativeStudio.tsx — BayKid AI Marketing Center
// 7-tab AI creative workspace: Carousel, Reel Script, Hook, Caption, Hashtag, Thumbnail, Campaign
import { useState, useEffect } from 'react'
import {
  generateAIContent,
  type AIContentResult,
  type Platform,
  type Tone,
  type ContentType,
} from '../../../lib/aiMarketing'
import { upsertPost } from '../../../lib/postStorage'
import { logEvent } from '../../../lib/activityLog'
import { addNotification } from '../../../lib/notifications'
import { TIMEZONES } from './ContentCalendar'
import type { DbBrandVoice } from '../../../lib/supabaseAiTypes'

// ── Shared styles ─────────────────────────────────────────────────────────────

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
  color: 'rgba(255,255,255,0.55)',
  fontSize: 12,
  fontWeight: 600,
  marginBottom: 6,
  display: 'block',
}

const cardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(0,190,255,0.15)',
  borderRadius: 16,
  padding: 20,
}

// ── Tab config ────────────────────────────────────────────────────────────────

type TabId = 'carousel' | 'reel' | 'hook' | 'caption' | 'hashtag' | 'thumbnail' | 'campaign'

interface TabCfg {
  id: TabId
  label: string
  icon: string
  desc: string
  contentType: ContentType | null
  resultLabel: string
  placeholder: string
  btnLabel: string
}

const TABS: TabCfg[] = [
  {
    id: 'carousel', label: 'Carousel Creator', icon: '🖼️',
    contentType: 'carousel', resultLabel: 'Slide Breakdown',
    desc: 'Multi-slide educational Instagram & Facebook carousels',
    placeholder: 'e.g. 5 reasons to recycle your old electronics',
    btnLabel: 'Generate Carousel',
  },
  {
    id: 'reel', label: 'Reel Script', icon: '🎬',
    contentType: 'reel_script', resultLabel: 'Full Script',
    desc: '15–60 second TikTok / Reels video scripts',
    placeholder: 'e.g. Behind the scenes at BayKid Nashville pickup day',
    btnLabel: 'Generate Reel Script',
  },
  {
    id: 'hook', label: 'Hook Generator', icon: '🎣',
    contentType: 'reel_script', resultLabel: 'Opening Hook',
    desc: 'Scroll-stopping first 3 seconds for any video',
    placeholder: 'e.g. The impact of one electronics recycling trip',
    btnLabel: 'Generate Hooks',
  },
  {
    id: 'caption', label: 'Caption Generator', icon: '✍️',
    contentType: 'social_post', resultLabel: 'Caption',
    desc: 'Engaging captions optimised for each platform',
    placeholder: 'e.g. Monday motivation — our crew in action',
    btnLabel: 'Generate Caption',
  },
  {
    id: 'hashtag', label: 'Hashtag Generator', icon: '#️⃣',
    contentType: 'social_post', resultLabel: 'Hashtag Set',
    desc: 'Niche + trending hashtag sets to maximise reach',
    placeholder: 'e.g. Nashville electronics recycling event',
    btnLabel: 'Generate Hashtags',
  },
  {
    id: 'thumbnail', label: 'Thumbnail Text', icon: '🎨',
    contentType: 'social_post', resultLabel: 'Thumbnail Text Ideas',
    desc: 'Bold text overlays and thumbnail copy ideas',
    placeholder: 'e.g. Before & after a BayKid cleanout',
    btnLabel: 'Generate Thumbnail Text',
  },
  {
    id: 'campaign', label: 'Campaign Builder', icon: '🚀',
    contentType: null, resultLabel: 'Campaign Plan',
    desc: 'Full multi-week content campaign with daily plans',
    placeholder: '',
    btnLabel: 'Build Campaign Plan',
  },
]

// ── Brand voice helpers ───────────────────────────────────────────────────────

function loadBrandVoice(): DbBrandVoice | null {
  try {
    const raw = localStorage.getItem('baykid_ai_brand_voice')
    return raw ? (JSON.parse(raw) as DbBrandVoice) : null
  } catch { return null }
}

function buildBvContext(bv: DbBrandVoice): string {
  const parts: string[] = []
  if (bv.persona) parts.push(`Brand persona: ${bv.persona}`)
  if (bv.tone)    parts.push(`Brand tone: ${bv.tone}`)
  if (bv.vocabulary?.length) parts.push(`Key vocabulary: ${bv.vocabulary.join(', ')}`)
  if (bv.do_use?.length)     parts.push(`Always include: ${bv.do_use.join(', ')}`)
  if (bv.dont_use?.length)   parts.push(`Avoid: ${bv.dont_use.join(', ')}`)
  return parts.join('. ')
}

// ── Spinner ───────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <span style={{
      display: 'inline-block', width: 14, height: 14,
      border: '2px solid rgba(255,255,255,0.3)',
      borderTop: '2px solid #fff',
      borderRadius: '50%',
      animation: 'ai-spin 0.7s linear infinite',
    }} />
  )
}

// ── Copy button with flash ────────────────────────────────────────────────────

function CopyBtn({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false)
  async function doCopy() {
    try { await navigator.clipboard.writeText(text) } catch { /* silent */ }
    setOk(true)
    setTimeout(() => setOk(false), 2000)
  }
  return (
    <button onClick={doCopy} style={{
      background: ok ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.08)',
      border: ok ? '1px solid rgba(34,197,94,0.35)' : '1px solid rgba(255,255,255,0.15)',
      color: ok ? '#22c55e' : 'rgba(255,255,255,0.7)',
      borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600,
      cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap',
    }}>
      {ok ? '✓ Copied' : `📋 ${label}`}
    </button>
  )
}

// ── Schedule mini-modal ───────────────────────────────────────────────────────

interface SchedModalProps {
  onConfirm: (iso: string, tz: string) => void
  onCancel: () => void
}

function SchedModal({ onConfirm, onCancel }: SchedModalProps) {
  const [dt, setDt] = useState(() => {
    const d = new Date(Date.now() + 24 * 3600000)
    d.setMinutes(0, 0, 0)
    return d.toISOString().slice(0, 16)
  })
  const [tz, setTz] = useState('America/Chicago')

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'rgba(0,0,0,0.72)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#0e1528', border: '1px solid rgba(0,190,255,0.25)',
        borderRadius: 16, padding: 28, width: 360,
      }}>
        <h3 style={{ color: '#fff', fontWeight: 700, fontSize: 15, margin: '0 0 20px' }}>
          📅 Schedule Post
        </h3>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Date &amp; Time</label>
          <input type="datetime-local" value={dt} onChange={(e) => setDt(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ marginBottom: 22 }}>
          <label style={labelStyle}>Timezone</label>
          <select value={tz} onChange={(e) => setTz(e.target.value)} style={inputStyle}>
            {TIMEZONES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => dt && onConfirm(new Date(dt).toISOString(), tz)}
            disabled={!dt}
            style={{
              flex: 1, background: 'linear-gradient(135deg,#0057e7,#00c8ff)',
              color: '#fff', border: 'none', borderRadius: 10, padding: '10px 0',
              fontWeight: 700, fontSize: 13, cursor: dt ? 'pointer' : 'not-allowed', opacity: dt ? 1 : 0.6,
            }}
          >
            Schedule
          </button>
          <button onClick={onCancel} style={{
            flex: 1, background: 'rgba(255,255,255,0.07)',
            color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 10, padding: '10px 0', fontWeight: 600, fontSize: 13, cursor: 'pointer',
          }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Export action bar ─────────────────────────────────────────────────────────

interface ExportBarProps {
  result: AIContentResult
  copyText: string
}

function ExportBar({ result, copyText }: ExportBarProps) {
  const [showSched, setShowSched] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  function flash(m: string) { setMsg(m); setTimeout(() => setMsg(null), 3000) }

  function saveDraft() {
    setBusy('draft')
    upsertPost({ ...result, status: 'draft' })
    logEvent('generated', `Draft saved: ${result.title}`, { meta: { postId: result.id } })
    setBusy(null)
    flash('Draft saved!')
  }

  function sendToQueue() {
    setBusy('queue')
    upsertPost({ ...result, status: 'pending_approval' })
    logEvent('sent_to_queue', `Sent to Approval Queue: ${result.title}`, { meta: { postId: result.id } })
    addNotification(
      'pending_approval',
      'Post Awaiting Approval',
      `"${result.title}" is waiting in the Approval Queue.`,
      { linkSection: 'queue', linkId: `post-${result.id}` },
    )
    setBusy(null)
    flash('Sent to Approval Queue!')
  }

  function handleSchedConfirm(iso: string, tz: string) {
    setShowSched(false)
    upsertPost({ ...result, status: 'scheduled', scheduledFor: iso, timezone: tz })
    logEvent('scheduled', `Scheduled: ${result.title}`, { meta: { postId: result.id } })
    flash('Scheduled! Check Content Calendar.')
  }

  return (
    <>
      {showSched && <SchedModal onConfirm={handleSchedConfirm} onCancel={() => setShowSched(false)} />}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <CopyBtn text={copyText} />
        <button
          onClick={saveDraft}
          disabled={busy === 'draft'}
          style={{
            background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)',
            color: '#818cf8', borderRadius: 8, padding: '6px 14px',
            fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >
          {busy === 'draft' ? '…' : '💾 Save Draft'}
        </button>
        <button
          onClick={sendToQueue}
          disabled={busy === 'queue'}
          style={{
            background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)',
            color: '#fbbf24', borderRadius: 8, padding: '6px 14px',
            fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >
          {busy === 'queue' ? '…' : '📤 Send to Queue'}
        </button>
        <button
          onClick={() => setShowSched(true)}
          style={{
            background: 'rgba(0,200,255,0.1)', border: '1px solid rgba(0,200,255,0.3)',
            color: '#00c8ff', borderRadius: 8, padding: '6px 14px',
            fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >
          📅 Schedule
        </button>
        {msg && (
          <span style={{ color: '#22c55e', fontSize: 12, fontWeight: 600 }}>✓ {msg}</span>
        )}
      </div>
    </>
  )
}

// ── Tag pill ──────────────────────────────────────────────────────────────────

function TagPill({ tag }: { tag: string }) {
  return (
    <span style={{
      background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.22)',
      color: '#00c8ff', borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 600,
    }}>
      {tag.startsWith('#') ? tag : `#${tag}`}
    </span>
  )
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10,
    }}>
      {children}
    </div>
  )
}

const previewBoxStyle: React.CSSProperties = {
  background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 12, padding: 14, color: 'rgba(255,255,255,0.85)', fontSize: 13,
  lineHeight: 1.7, whiteSpace: 'pre-wrap', overflowY: 'auto',
}

// ── Result renderers per tab ──────────────────────────────────────────────────

function CarouselResult({ r }: { r: AIContentResult }) {
  const raw = r.storyboard || ''
  const slides = raw.split('\n').filter((l) => l.trim())
  return (
    <>
      <SectionLabel>Slide Breakdown</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
        {slides.length > 0 ? slides.map((s, i) => (
          <div key={i} style={{ ...previewBoxStyle, padding: '10px 14px' }}>
            {s}
          </div>
        )) : (
          <div style={{ ...previewBoxStyle, color: 'rgba(255,255,255,0.35)', fontStyle: 'italic' }}>
            No slide breakdown generated
          </div>
        )}
      </div>
      {r.hashtags?.length > 0 && (
        <>
          <SectionLabel>Hashtags</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
            {r.hashtags.map((t) => <TagPill key={t} tag={t} />)}
          </div>
        </>
      )}
      <ExportBar result={r} copyText={raw} />
    </>
  )
}

function ReelScriptResult({ r }: { r: AIContentResult }) {
  const [view, setView] = useState<'hook' | 'script'>('hook')
  const content = view === 'hook' ? r.hook : (r.script || '(No script generated)')
  const TabBtn = ({ v, children }: { v: typeof view; children: React.ReactNode }) => (
    <button onClick={() => setView(v)} style={{
      padding: '5px 14px', borderRadius: 8, fontSize: 12, fontWeight: view === v ? 700 : 500,
      border: view === v ? '1px solid rgba(0,200,255,0.4)' : '1px solid rgba(255,255,255,0.1)',
      background: view === v ? 'rgba(0,200,255,0.1)' : 'transparent',
      color: view === v ? '#00c8ff' : 'rgba(255,255,255,0.45)', cursor: 'pointer',
    }}>{children}</button>
  )
  return (
    <>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <TabBtn v="hook">🎣 Hook</TabBtn>
        <TabBtn v="script">📝 Full Script</TabBtn>
      </div>
      <div style={{ ...previewBoxStyle, minHeight: 120, maxHeight: 340 }}>{content}</div>
      <ExportBar result={r} copyText={content} />
    </>
  )
}

function HookResult({ r }: { r: AIContentResult }) {
  return (
    <>
      <SectionLabel>Opening Hook</SectionLabel>
      <div style={{
        background: 'linear-gradient(135deg,rgba(0,87,231,0.1),rgba(0,200,255,0.07))',
        border: '1px solid rgba(0,200,255,0.22)',
        borderRadius: 14, padding: 20,
        color: '#fff', fontSize: 16, fontWeight: 600, lineHeight: 1.6, marginBottom: 14,
      }}>
        "{r.hook}"
      </div>
      {r.script && (
        <>
          <SectionLabel>Continuation Ideas</SectionLabel>
          <div style={{ ...previewBoxStyle, maxHeight: 200, color: 'rgba(255,255,255,0.65)', marginBottom: 14 }}>
            {r.script}
          </div>
        </>
      )}
      <ExportBar result={r} copyText={r.hook} />
    </>
  )
}

function CaptionResult({ r }: { r: AIContentResult }) {
  const caption = r.caption || r.hook
  return (
    <>
      <SectionLabel>Caption</SectionLabel>
      <div style={{ ...previewBoxStyle, minHeight: 90, fontSize: 14, marginBottom: 14 }}>{caption}</div>
      {r.hashtags?.length > 0 && (
        <>
          <SectionLabel>Hashtags</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
            {r.hashtags.map((t) => <TagPill key={t} tag={t} />)}
          </div>
        </>
      )}
      <ExportBar result={r} copyText={`${caption}\n\n${(r.hashtags || []).map((t) => (t.startsWith('#') ? t : `#${t}`)).join(' ')}`} />
    </>
  )
}

function HashtagResult({ r }: { r: AIContentResult }) {
  const tags = r.hashtags ?? []
  const allText = tags.map((t) => (t.startsWith('#') ? t : `#${t}`)).join(' ')
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <SectionLabel>Hashtag Set ({tags.length})</SectionLabel>
        <CopyBtn text={allText} label={`Copy All ${tags.length}`} />
      </div>
      <div style={{
        background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 12, padding: 16, display: 'flex', flexWrap: 'wrap', gap: 7,
        minHeight: 80, marginBottom: 14,
      }}>
        {tags.length > 0
          ? tags.map((t) => <TagPill key={t} tag={t} />)
          : <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, fontStyle: 'italic' }}>No hashtags generated</span>}
      </div>
      {r.caption && (
        <>
          <SectionLabel>Caption (with hashtags)</SectionLabel>
          <div style={{ ...previewBoxStyle, maxHeight: 140, color: 'rgba(255,255,255,0.65)', marginBottom: 14 }}>
            {r.caption}
          </div>
        </>
      )}
      <ExportBar result={r} copyText={allText} />
    </>
  )
}

function ThumbnailResult({ r }: { r: AIContentResult }) {
  const ideas = [
    r.title && { label: 'Main Headline', text: r.title },
    r.hook  && { label: 'Sub-text / Overlay', text: r.hook },
    r.caption && { label: 'CTA Text', text: r.caption },
  ].filter(Boolean) as { label: string; text: string }[]
  return (
    <>
      <SectionLabel>Thumbnail Text Ideas</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
        {ideas.map(({ label, text }) => (
          <div key={label} style={{
            background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12, padding: '12px 16px',
          }}>
            <div style={{ color: 'rgba(255,255,255,0.38)', fontSize: 11, fontWeight: 700, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {label}
            </div>
            <div style={{ color: '#fff', fontSize: 15, fontWeight: 700, lineHeight: 1.4 }}>{text}</div>
          </div>
        ))}
      </div>
      {r.storyboard && (
        <>
          <SectionLabel>Visual Concept Notes</SectionLabel>
          <div style={{ ...previewBoxStyle, maxHeight: 160, color: 'rgba(255,255,255,0.6)', marginBottom: 14 }}>
            {r.storyboard}
          </div>
        </>
      )}
      <ExportBar result={r} copyText={r.title} />
    </>
  )
}

function CampaignResult({ r }: { r: AIContentResult }) {
  const plan = r.storyboard || r.script || ''
  return (
    <>
      {r.title && (
        <div style={{
          background: 'linear-gradient(135deg,rgba(0,87,231,0.12),rgba(0,200,255,0.08))',
          border: '1px solid rgba(0,200,255,0.22)',
          borderRadius: 12, padding: '12px 16px', marginBottom: 14,
          color: '#fff', fontSize: 15, fontWeight: 700,
        }}>
          🎯 {r.title}
        </div>
      )}
      <SectionLabel>Weekly Campaign Plan</SectionLabel>
      <div style={{ ...previewBoxStyle, maxHeight: 440, marginBottom: 14 }}>
        {plan || '(No plan generated)'}
      </div>
      {r.hashtags?.length > 0 && (
        <>
          <SectionLabel>Campaign Hashtags</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
            {r.hashtags.map((t) => <TagPill key={t} tag={t} />)}
          </div>
        </>
      )}
      {r.caption && (
        <>
          <SectionLabel>CTA Strategy</SectionLabel>
          <div style={{ ...previewBoxStyle, color: 'rgba(255,255,255,0.65)', marginBottom: 14 }}>
            {r.caption}
          </div>
        </>
      )}
      <ExportBar result={r} copyText={plan} />
    </>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function CreativeStudio() {
  const [activeTab, setActiveTab] = useState<TabId>('reel')
  // Standard form
  const [topic, setTopic] = useState('')
  const [platform, setPlatform] = useState<Platform>('instagram')
  const [tone, setTone] = useState<Tone>('friendly')
  // Campaign builder
  const [campGoal, setCampGoal] = useState('')
  const [campAudience, setCampAudience] = useState('')
  const [campDuration, setCampDuration] = useState<'1_week' | '2_weeks' | '1_month'>('1_week')
  const [campPlatform, setCampPlatform] = useState<Platform>('instagram')
  const [campTone, setCampTone] = useState<Tone>('inspiring')
  // UI state
  const [isGenerating, setIsGenerating] = useState(false)
  const [result, setResult] = useState<AIContentResult | null>(null)
  const [genError, setGenError] = useState<string | null>(null)
  const [brandVoice, setBrandVoice] = useState<DbBrandVoice | null>(null)

  useEffect(() => { setBrandVoice(loadBrandVoice()) }, [])

  const tab = TABS.find((t) => t.id === activeTab)!
  const isCampaign = activeTab === 'campaign'
  const canGenerate = isCampaign ? !!campGoal.trim() : !!topic.trim()

  function switchTab(id: TabId) {
    setActiveTab(id)
    setResult(null)
    setGenError(null)
  }

  async function handleGenerate() {
    if (!canGenerate || isGenerating) return
    setIsGenerating(true)
    setResult(null)
    setGenError(null)
    try {
      const bvCtx = brandVoice ? ` [${buildBvContext(brandVoice)}]` : ''

      if (isCampaign) {
        const durationLabel =
          campDuration === '1_week'   ? '1 week' :
          campDuration === '2_weeks'  ? '2 weeks' : '1 month'
        const campaignTopic =
          `Create a complete ${durationLabel} social media campaign. ` +
          `Goal: ${campGoal}. ` +
          (campAudience ? `Target audience: ${campAudience}. ` : '') +
          `For each day include: post idea, video hook, caption, and hashtags. ` +
          `End with a CTA strategy.${bvCtx}`
        const res = await generateAIContent({
          contentType: 'reel_script',
          topic: campaignTopic,
          platform: campPlatform,
          tone: campTone,
          goal: campGoal,
        })
        setResult(res)
      } else {
        const res = await generateAIContent({
          contentType: tab.contentType!,
          topic: topic + bvCtx,
          platform,
          tone,
        })
        setResult(res)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setGenError(msg)
    } finally {
      setIsGenerating(false)
    }
  }

  const toneOptions: Tone[] = ['friendly', 'inspiring', 'humorous', 'educational', 'professional', 'urgent']
  const platformOptions: { value: Platform; label: string }[] = [
    { value: 'instagram', label: 'Instagram' },
    { value: 'tiktok',    label: 'TikTok'    },
    { value: 'facebook',  label: 'Facebook'  },
    { value: 'youtube',   label: 'YouTube'   },
    { value: 'linkedin',  label: 'LinkedIn'  },
    { value: 'twitter',   label: 'Twitter / X' },
  ]

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', maxWidth: 1100 }}>

      {/* ── Tab sidebar ── */}
      <div style={{
        width: 182, flexShrink: 0,
        background: 'rgba(0,0,0,0.28)',
        border: '1px solid rgba(0,190,255,0.1)',
        borderRadius: 16, overflow: 'hidden',
      }}>
        {TABS.map((t) => {
          const active = t.id === activeTab
          return (
            <button
              key={t.id}
              onClick={() => switchTab(t.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 9,
                padding: '10px 14px', width: '100%', textAlign: 'left',
                background: active ? 'rgba(0,200,255,0.1)' : 'transparent',
                border: 'none',
                borderLeft: active ? '2px solid #00c8ff' : '2px solid transparent',
                color: active ? '#00c8ff' : 'rgba(255,255,255,0.5)',
                fontSize: 12, fontWeight: active ? 700 : 500,
                cursor: 'pointer', transition: 'all 0.15s', outline: 'none',
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                  e.currentTarget.style.color = 'rgba(255,255,255,0.75)'
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'rgba(255,255,255,0.5)'
                }
              }}
            >
              <span style={{ fontSize: 14, flexShrink: 0 }}>{t.icon}</span>
              <span style={{ lineHeight: 1.3 }}>{t.label}</span>
            </button>
          )
        })}
      </div>

      {/* ── Main panel ── */}
      <div style={{ flex: 1, minWidth: 0 }}>

        {/* Header */}
        <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 18, margin: 0 }}>
              {tab.icon} {tab.label}
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 4, marginBottom: 0 }}>
              {tab.desc}
            </p>
          </div>
          {brandVoice && (
            <span style={{
              background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.3)',
              color: '#a855f7', borderRadius: 20, padding: '5px 14px',
              fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0,
            }}>
              🎙️ Brand Voice Active
            </span>
          )}
        </div>

        {/* Form card */}
        <div style={cardStyle}>
          {isCampaign ? (
            /* ── Campaign Builder form ── */
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Campaign Goal *</label>
                <textarea
                  value={campGoal}
                  onChange={(e) => setCampGoal(e.target.value)}
                  placeholder="e.g. Increase brand awareness for BayKid Nashville and drive electronics recycling sign-ups in Q3 2026"
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Target Audience</label>
                <input
                  value={campAudience}
                  onChange={(e) => setCampAudience(e.target.value)}
                  placeholder="e.g. Nashville homeowners 25–45, eco-conscious, tech-savvy"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Campaign Duration</label>
                <select value={campDuration} onChange={(e) => setCampDuration(e.target.value as typeof campDuration)} style={inputStyle}>
                  <option value="1_week">1 Week (7 days)</option>
                  <option value="2_weeks">2 Weeks (14 days)</option>
                  <option value="1_month">1 Month (30 days)</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Primary Platform</label>
                <select value={campPlatform} onChange={(e) => setCampPlatform(e.target.value as Platform)} style={inputStyle}>
                  {platformOptions.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Brand Tone</label>
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                  {toneOptions.map((t) => (
                    <button
                      key={t}
                      onClick={() => setCampTone(t)}
                      style={{
                        padding: '5px 14px', borderRadius: 20, fontSize: 12,
                        fontWeight: campTone === t ? 700 : 500,
                        background: campTone === t ? 'rgba(0,200,255,0.12)' : 'rgba(255,255,255,0.05)',
                        border: campTone === t ? '1px solid rgba(0,200,255,0.4)' : '1px solid rgba(255,255,255,0.1)',
                        color: campTone === t ? '#00c8ff' : 'rgba(255,255,255,0.5)',
                        cursor: 'pointer', textTransform: 'capitalize',
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* ── Standard form ── */
            <>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Topic *</label>
                <input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && canGenerate && !isGenerating) handleGenerate() }}
                  placeholder={tab.placeholder}
                  style={inputStyle}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Platform</label>
                  <select value={platform} onChange={(e) => setPlatform(e.target.value as Platform)} style={inputStyle}>
                    {platformOptions.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Tone</label>
                  <select value={tone} onChange={(e) => setTone(e.target.value as Tone)} style={inputStyle}>
                    {toneOptions.map((t) => <option key={t} value={t} style={{ textTransform: 'capitalize' }}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>
              </div>
            </>
          )}

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !canGenerate}
            style={{
              background: isGenerating || !canGenerate
                ? 'rgba(255,255,255,0.07)'
                : 'linear-gradient(135deg,#0057e7,#00c8ff)',
              color: isGenerating || !canGenerate ? 'rgba(255,255,255,0.3)' : '#fff',
              border: 'none', borderRadius: 12,
              padding: '11px 24px', fontWeight: 700, fontSize: 13,
              cursor: isGenerating || !canGenerate ? 'not-allowed' : 'pointer',
              width: '100%', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 8, marginTop: 16,
            }}
          >
            {isGenerating
              ? <><Spinner /> {isCampaign ? 'Building Campaign…' : 'Generating…'  }</>
              : `🤖 ${tab.btnLabel}`}
          </button>
        </div>

        {/* Error state */}
        {genError && (
          <div style={{
            marginTop: 12, background: 'rgba(248,113,113,0.08)',
            border: '1px solid rgba(248,113,113,0.25)',
            borderRadius: 12, padding: '12px 16px',
            color: '#f87171', fontSize: 13,
          }}>
            ⚠️ Generation error: {genError}
          </div>
        )}

        {/* Result card */}
        {result && !isGenerating && (
          <div style={{ ...cardStyle, marginTop: 16 }}>
            {/* Result header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.07)',
            }}>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>
                {result.title || tab.resultLabel}
              </div>
              <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                {result._source === 'claude' && (
                  <span style={{
                    background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.2)',
                    color: '#00c8ff', borderRadius: 20, padding: '2px 9px',
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
                  }}>⚡ CLAUDE</span>
                )}
                {result._source === 'demo' && (
                  <span style={{
                    background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)',
                    color: '#fbbf24', borderRadius: 20, padding: '2px 9px',
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
                  }}>DEMO</span>
                )}
                <button
                  onClick={handleGenerate}
                  style={{
                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                    color: 'rgba(255,255,255,0.55)', borderRadius: 8,
                    padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  }}
                  title="Regenerate"
                >
                  🔄 Regenerate
                </button>
              </div>
            </div>

            {/* Tab-specific result */}
            {activeTab === 'carousel'  && <CarouselResult   r={result} />}
            {activeTab === 'reel'      && <ReelScriptResult r={result} />}
            {activeTab === 'hook'      && <HookResult       r={result} />}
            {activeTab === 'caption'   && <CaptionResult    r={result} />}
            {activeTab === 'hashtag'   && <HashtagResult    r={result} />}
            {activeTab === 'thumbnail' && <ThumbnailResult  r={result} />}
            {activeTab === 'campaign'  && <CampaignResult   r={result} />}
          </div>
        )}

        <div style={{ height: 40 }} />
      </div>
    </div>
  )
}
