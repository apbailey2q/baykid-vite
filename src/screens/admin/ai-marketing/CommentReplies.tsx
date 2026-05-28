// CommentReplies.tsx — BayKid AI Marketing Center
import { useState } from 'react'
import { generateAIContent, type AIContentResult } from '../../../lib/aiMarketing'

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

const SAMPLE_COMMENTS = [
  `Do you guys serve Antioch? I've been looking for curbside recycling for months.`,
  'What materials do you actually accept? I have a lot of cardboard and plastics.',
  'How much does BayKid cost per month? Is there a family plan?',
  'This sounds great but do you take electronics? I have old phones and laptops.',
  'Can apartments sign up or is this only for houses?',
]

function Spinner() {
  return (
    <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </span>
  )
}

export function CommentReplies() {
  const [comment, setComment] = useState('')
  const [platform, setPlatform] = useState<'instagram' | 'tiktok' | 'facebook' | 'youtube'>('instagram')
  const [isGenerating, setIsGenerating] = useState(false)
  const [result, setResult] = useState<AIContentResult | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleGenerate() {
    if (!comment.trim()) return
    setIsGenerating(true)
    setResult(null)
    try {
      const res = await generateAIContent({ contentType: 'comment_reply', topic: comment, platform })
      setResult(res)
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleCopy() {
    if (!result?.commentReply) return
    try {
      await navigator.clipboard.writeText(result.commentReply)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 20, margin: 0 }}>💬 Comment Replies</h2>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 4 }}>Paste a social media comment and generate an on-brand BayKid reply.</p>
      </div>

      {/* Sample comments */}
      <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(0,190,255,0.15)', borderRadius: 16, padding: 20, marginBottom: 20 }}>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, margin: '0 0 10px', fontWeight: 600 }}>SAMPLE COMMENTS — click to load</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {SAMPLE_COMMENTS.map((c) => (
            <button key={c} onClick={() => setComment(c)}
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 12px', color: 'rgba(255,255,255,0.6)', fontSize: 12, cursor: 'pointer', textAlign: 'left' }}>
              "{c}"
            </button>
          ))}
        </div>
      </div>

      <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(0,190,255,0.15)', borderRadius: 16, padding: 24, marginBottom: 20 }}>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Comment or Question *</label>
          <textarea
            style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
            placeholder="Paste the comment you want to reply to..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Platform</label>
          <select style={{ ...inputStyle, width: 'auto' }} value={platform} onChange={(e) => setPlatform(e.target.value as typeof platform)}>
            <option value="instagram">Instagram</option>
            <option value="tiktok">TikTok</option>
            <option value="facebook">Facebook</option>
            <option value="youtube">YouTube</option>
          </select>
        </div>
        <button
          style={{ background: 'linear-gradient(135deg,#0057e7,#00c8ff)', color: '#fff', borderRadius: 12, padding: '10px 20px', fontWeight: 700, fontSize: 13, border: 'none', cursor: isGenerating || !comment.trim() ? 'not-allowed' : 'pointer', opacity: isGenerating || !comment.trim() ? 0.65 : 1, display: 'flex', alignItems: 'center', gap: 8 }}
          onClick={handleGenerate}
          disabled={isGenerating || !comment.trim()}
        >
          {isGenerating ? <><Spinner /> Generating...</> : '🤖 Generate Reply'}
        </button>
      </div>

      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 16, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ color: '#22c55e', fontWeight: 700, fontSize: 13 }}>✅ Generated Reply</span>
              <button onClick={handleCopy}
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)', borderRadius: 10, padding: '6px 12px', fontWeight: 600, fontSize: 11, cursor: 'pointer' }}>
                {copied ? '✓ Copied' : '📋 Copy'}
              </button>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 1.65, margin: 0 }}>{result.commentReply}</p>
          </div>

          {/* Demo / error fallback banner */}
          {result._source === 'demo' && (
            <div style={{
              background: result._error ? 'rgba(251,191,36,0.08)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${result._error ? 'rgba(251,191,36,0.25)' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 8,
            }}>
              <span style={{ fontSize: 14, flexShrink: 0 }}>{result._error ? '⚠️' : 'ℹ️'}</span>
              <div>
                <span style={{ color: result._error ? '#fbbf24' : 'rgba(255,255,255,0.45)', fontWeight: 700, fontSize: 12 }}>
                  {result._error ? 'Claude API error — showing demo content' : 'Demo content'}
                </span>
                {result._error && (
                  <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, margin: '3px 0 0' }}>{result._error}</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      <div style={{ height: 40 }} />
    </div>
  )
}
