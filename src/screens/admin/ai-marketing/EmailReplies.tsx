// EmailReplies.tsx — BayKid AI Marketing Center
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

const SAMPLE_EMAILS = [
  'Hi, I run a restaurant on 12th Ave and we generate a lot of cardboard and glass. Do you offer commercial pickup?',
  'We\'re a property manager for a 120-unit apartment complex in Brentwood. What would recycling look like for us?',
  'I saw your post about school programs. I\'m the principal at an elementary school and we\'d love to get involved.',
  'How much does the residential subscription cost? Is there a free trial?',
  'We\'re interested in sponsoring Cyan\'s Brooklynn as part of our community sustainability initiative.',
]

function Spinner() {
  return (
    <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </span>
  )
}

export function EmailReplies() {
  const [emailBody, setEmailBody] = useState('')
  const [senderName, setSenderName] = useState('')
  const [tone, setTone] = useState<'professional' | 'friendly'>('professional')
  const [isGenerating, setIsGenerating] = useState(false)
  const [result, setResult] = useState<AIContentResult | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleGenerate() {
    if (!emailBody.trim()) return
    setIsGenerating(true)
    setResult(null)
    try {
      const topic = senderName ? `Email from ${senderName}: ${emailBody}` : emailBody
      const res = await generateAIContent({ contentType: 'email_reply', topic, tone })
      setResult(res)
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleCopy() {
    if (!result?.emailDraft) return
    try {
      await navigator.clipboard.writeText(result.emailDraft)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 20, margin: 0 }}>📧 Email Replies</h2>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 4 }}>Paste an incoming email and generate a professional Cyan's Brooklynn reply.</p>
      </div>

      <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(0,190,255,0.15)', borderRadius: 16, padding: 20, marginBottom: 20 }}>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, margin: '0 0 10px', fontWeight: 600 }}>SAMPLE EMAILS — click to load</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {SAMPLE_EMAILS.map((e) => (
            <button key={e} onClick={() => setEmailBody(e)}
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 12px', color: 'rgba(255,255,255,0.6)', fontSize: 12, cursor: 'pointer', textAlign: 'left' }}>
              "{e}"
            </button>
          ))}
        </div>
      </div>

      <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(0,190,255,0.15)', borderRadius: 16, padding: 24, marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>Sender Name (optional)</label>
            <input style={inputStyle} placeholder="e.g. Marcus Johnson" value={senderName} onChange={(e) => setSenderName(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Reply Tone</label>
            <select style={inputStyle} value={tone} onChange={(e) => setTone(e.target.value as typeof tone)}>
              <option value="professional">Professional</option>
              <option value="friendly">Friendly</option>
            </select>
          </div>
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Incoming Email *</label>
          <textarea
            style={{ ...inputStyle, minHeight: 100, resize: 'vertical' }}
            placeholder="Paste the incoming email here..."
            value={emailBody}
            onChange={(e) => setEmailBody(e.target.value)}
          />
        </div>
        <button
          style={{ background: 'linear-gradient(135deg,#0057e7,#00c8ff)', color: '#fff', borderRadius: 12, padding: '10px 20px', fontWeight: 700, fontSize: 13, border: 'none', cursor: isGenerating || !emailBody.trim() ? 'not-allowed' : 'pointer', opacity: isGenerating || !emailBody.trim() ? 0.65 : 1, display: 'flex', alignItems: 'center', gap: 8 }}
          onClick={handleGenerate}
          disabled={isGenerating || !emailBody.trim()}
        >
          {isGenerating ? <><Spinner /> Generating...</> : '🤖 Generate Reply'}
        </button>
      </div>

      {result && (
        <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(0,190,255,0.2)', borderRadius: 16, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <span style={{ color: '#00c8ff', fontWeight: 700, fontSize: 13 }}>📨 {result.title}</span>
            </div>
            <button onClick={handleCopy}
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)', borderRadius: 10, padding: '6px 12px', fontWeight: 600, fontSize: 11, cursor: 'pointer' }}>
              {copied ? '✓ Copied' : '📋 Copy'}
            </button>
          </div>
          <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 16, color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
            {result.emailDraft}
          </div>
        </div>
      )}
      <div style={{ height: 40 }} />
    </div>
  )
}
