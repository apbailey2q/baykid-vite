// OnboardingFlow.tsx — 5-step guided onboarding for BayKid AI Marketing Center
// Shows on first visit; dismissed by setting localStorage flag.
// Steps: Welcome → Connect Platforms → Brand Voice → Invite Team → Done

import { useState, useCallback } from 'react'
import { loadOrgSettings, saveOrgSettings, inviteTeamMember } from '../../../lib/orgSettings'
import { loadUserProfile } from '../../../lib/permissions'
import { validateInput } from '../../../lib/errorHandling'
import type { BrandVoiceSettings } from '../../../lib/orgSettings'
import type { UserRole } from '../../../lib/permissions'

// ── Constants ─────────────────────────────────────────────────────────────────

const ONBOARDING_KEY = 'baykid_onboarding_complete'

export function isOnboardingComplete(): boolean {
  return !!localStorage.getItem(ONBOARDING_KEY)
}

function markOnboardingComplete() {
  localStorage.setItem(ONBOARDING_KEY, new Date().toISOString())
}

// ── Sub-components ────────────────────────────────────────────────────────────

const cardBase: React.CSSProperties = {
  background:   'rgba(255,255,255,0.04)',
  border:       '1px solid rgba(255,255,255,0.1)',
  borderRadius: 14,
  padding:      20,
  marginBottom: 16,
}

const inputStyle: React.CSSProperties = {
  width:        '100%',
  background:   'rgba(255,255,255,0.06)',
  border:       '1px solid rgba(255,255,255,0.15)',
  borderRadius: 8,
  color:        '#fff',
  fontSize:     13,
  padding:      '9px 12px',
  outline:      'none',
  boxSizing:    'border-box',
}

const labelStyle: React.CSSProperties = {
  color:      'rgba(255,255,255,0.6)',
  fontSize:   12,
  fontWeight: 600,
  marginBottom: 6,
  display:    'block',
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
}

// ── Step 1: Welcome ───────────────────────────────────────────────────────────

function WelcomeStep() {
  const checklist = [
    { icon: '🔌', label: 'Connect your social platforms' },
    { icon: '🎨', label: 'Configure your brand voice' },
    { icon: '👥', label: 'Invite your team members' },
    { icon: '🚀', label: 'Start creating AI-powered content' },
  ]

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 56, marginBottom: 12 }}>🤖</div>
        <h2 style={{ color: '#fff', fontSize: 22, fontWeight: 800, margin: '0 0 8px' }}>
          Welcome to BayKid AI Marketing
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, margin: 0, lineHeight: 1.6 }}>
          Let's get you set up in a few quick steps so your team can start generating
          AI-powered content for Nashville's favorite recycling service.
        </p>
      </div>

      <div style={cardBase}>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 16px' }}>
          What we'll set up
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {checklist.map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(0,200,255,0.1)', border: '1px solid rgba(0,200,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                {item.icon}
              </div>
              <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: 500 }}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: 'rgba(0,200,255,0.06)', border: '1px solid rgba(0,200,255,0.15)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{ fontSize: 16 }}>💡</span>
        <p style={{ color: 'rgba(0,200,255,0.8)', fontSize: 12, margin: 0, lineHeight: 1.6 }}>
          You can skip any step and configure everything later in <strong>Settings</strong>.
          All automations are draft-only — nothing will be auto-posted without your approval.
        </p>
      </div>
    </div>
  )
}

// ── Step 2: Connect Platforms ─────────────────────────────────────────────────

const PLATFORM_LIST = [
  { id: 'instagram', icon: '📸', name: 'Instagram',  color: '#e1306c', desc: 'Photos, Reels, Stories' },
  { id: 'tiktok',    icon: '🎵', name: 'TikTok',     color: '#00f2ea', desc: 'Short-form video' },
  { id: 'facebook',  icon: '👥', name: 'Facebook',   color: '#1877f2', desc: 'Posts, Events, Ads' },
  { id: 'linkedin',  icon: '💼', name: 'LinkedIn',   color: '#0a66c2', desc: 'B2B, Professional' },
  { id: 'twitter',   icon: '🐦', name: 'X / Twitter',color: '#1da1f2', desc: 'Real-time updates' },
]

function ConnectPlatformsStep() {
  const [connected, setConnected] = useState<string[]>([])
  const [connecting, setConnecting] = useState<string | null>(null)

  const handleConnect = (id: string) => {
    if (connected.includes(id)) return
    setConnecting(id)
    setTimeout(() => {
      setConnected((prev) => [...prev, id])
      setConnecting(null)
    }, 1200)
  }

  return (
    <div>
      <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, lineHeight: 1.6, marginTop: 0, marginBottom: 20 }}>
        Connect your social media accounts so the AI can tailor content for each platform.
        You can always connect more later in the <strong style={{ color: '#00c8ff' }}>Publishing</strong> section.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {PLATFORM_LIST.map((p) => {
          const isConnected  = connected.includes(p.id)
          const isConnecting = connecting === p.id
          return (
            <div key={p.id} style={{ ...cardBase, marginBottom: 0, display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px' }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: `${p.color}22`, border: `1px solid ${p.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                {p.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>{p.name}</div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>{p.desc}</div>
              </div>
              <button
                onClick={() => handleConnect(p.id)}
                disabled={isConnected || isConnecting}
                style={{
                  background:   isConnected ? 'rgba(34,197,94,0.15)' : isConnecting ? 'rgba(255,255,255,0.06)' : `${p.color}22`,
                  border:       `1px solid ${isConnected ? 'rgba(34,197,94,0.4)' : isConnecting ? 'rgba(255,255,255,0.1)' : p.color + '66'}`,
                  color:        isConnected ? '#22c55e' : isConnecting ? 'rgba(255,255,255,0.4)' : p.color,
                  borderRadius: 8,
                  padding:      '6px 16px',
                  fontSize:     12,
                  fontWeight:   700,
                  cursor:       isConnected ? 'default' : 'pointer',
                  transition:   'all 0.2s',
                  minWidth:     90,
                  textAlign:    'center',
                }}
              >
                {isConnected ? '✓ Connected' : isConnecting ? '…Connecting' : '+ Connect'}
              </button>
            </div>
          )
        })}
      </div>

      {connected.length > 0 && (
        <div style={{ marginTop: 16, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 10, padding: '10px 14px', color: '#22c55e', fontSize: 13, fontWeight: 600 }}>
          ✅ {connected.length} platform{connected.length > 1 ? 's' : ''} connected — you can add more later.
        </div>
      )}
    </div>
  )
}

// ── Step 3: Brand Voice ───────────────────────────────────────────────────────

function BrandVoiceStep() {
  const org  = loadOrgSettings()
  const bv   = org.brandVoice

  const [toneInput,   setToneInput]   = useState(bv.toneKeywords.join(', '))
  const [avoidInput,  setAvoidInput]  = useState(bv.avoidKeywords.join(', '))
  const [signature,   setSignature]   = useState(bv.signaturePhrase)
  const [cta,         setCta]         = useState(bv.callToAction)
  const [emojiUsage,  setEmojiUsage]  = useState<BrandVoiceSettings['emojiUsage']>(bv.emojiUsage)
  const [saved,       setSaved]       = useState(false)

  const handleSave = () => {
    const updated: BrandVoiceSettings = {
      toneKeywords:    toneInput.split(',').map((s) => s.trim()).filter(Boolean),
      avoidKeywords:   avoidInput.split(',').map((s) => s.trim()).filter(Boolean),
      signaturePhrase: signature,
      callToAction:    cta,
      emojiUsage,
    }
    const settings = loadOrgSettings()
    saveOrgSettings({ ...settings, brandVoice: updated })
    // Sync to legacy key
    localStorage.setItem('baykid_ai_brand_voice', JSON.stringify(updated))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const emojiOptions: Array<{ value: BrandVoiceSettings['emojiUsage']; label: string }> = [
    { value: 'heavy',    label: '🔥 Heavy — lots of emojis'  },
    { value: 'moderate', label: '😊 Moderate — balanced use'  },
    { value: 'minimal',  label: '✨ Minimal — sparingly'      },
    { value: 'none',     label: '✗ None — text only'          },
  ]

  return (
    <div>
      <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, lineHeight: 1.6, marginTop: 0, marginBottom: 20 }}>
        Tell the AI how BayKid communicates. This shapes every post, reply, and caption it generates.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={labelStyle}>Tone keywords <span style={{ color: 'rgba(255,255,255,0.3)', textTransform: 'none', fontWeight: 400 }}>(comma-separated)</span></label>
          <input
            style={inputStyle}
            value={toneInput}
            onChange={(e) => setToneInput(e.target.value)}
            placeholder="eco-conscious, community-first, approachable…"
          />
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 4 }}>Words that describe BayKid's personality and voice</div>
        </div>

        <div>
          <label style={labelStyle}>Words to avoid <span style={{ color: 'rgba(255,255,255,0.3)', textTransform: 'none', fontWeight: 400 }}>(comma-separated)</span></label>
          <input
            style={inputStyle}
            value={avoidInput}
            onChange={(e) => setAvoidInput(e.target.value)}
            placeholder="trash, garbage, waste removal…"
          />
        </div>

        <div>
          <label style={labelStyle}>Signature phrase</label>
          <input
            style={inputStyle}
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            placeholder="BayKid — Nashville's easiest recycling pickup"
          />
        </div>

        <div>
          <label style={labelStyle}>Default call-to-action</label>
          <input
            style={inputStyle}
            value={cta}
            onChange={(e) => setCta(e.target.value)}
            placeholder="Sign up at baykid.com"
          />
        </div>

        <div>
          <label style={labelStyle}>Emoji usage</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {emojiOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setEmojiUsage(opt.value)}
                style={{
                  background:   emojiUsage === opt.value ? 'rgba(0,200,255,0.15)' : 'rgba(255,255,255,0.05)',
                  border:       `1px solid ${emojiUsage === opt.value ? 'rgba(0,200,255,0.5)' : 'rgba(255,255,255,0.12)'}`,
                  color:        emojiUsage === opt.value ? '#00c8ff' : 'rgba(255,255,255,0.6)',
                  borderRadius: 8,
                  padding:      '7px 14px',
                  fontSize:     12,
                  fontWeight:   600,
                  cursor:       'pointer',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleSave}
          style={{
            background:   saved ? 'rgba(34,197,94,0.15)' : 'rgba(0,200,255,0.12)',
            border:       `1px solid ${saved ? 'rgba(34,197,94,0.4)' : 'rgba(0,200,255,0.35)'}`,
            color:        saved ? '#22c55e' : '#00c8ff',
            borderRadius: 10,
            padding:      '10px 20px',
            fontSize:     13,
            fontWeight:   700,
            cursor:       'pointer',
            transition:   'all 0.2s',
            alignSelf:    'flex-start',
          }}
        >
          {saved ? '✓ Saved' : '💾 Save Brand Voice'}
        </button>
      </div>
    </div>
  )
}

// ── Step 4: Invite Team ───────────────────────────────────────────────────────

function InviteTeamStep() {
  const [email,   setEmail]   = useState('')
  const [name,    setName]    = useState('')
  const [role,    setRole]    = useState<UserRole>('marketing_manager')
  const [invited, setInvited] = useState<Array<{ email: string; name: string; role: string }>>([])
  const [error,   setError]   = useState<string | null>(null)

  const profile = loadUserProfile()

  const roleOptions: Array<{ value: UserRole; label: string }> = [
    { value: 'admin',              label: 'Admin'              },
    { value: 'marketing_manager',  label: 'Marketing Manager'  },
    { value: 'content_reviewer',   label: 'Content Reviewer'   },
    { value: 'viewer',             label: 'Viewer'             },
  ]

  const handleInvite = useCallback(() => {
    setError(null)
    const emailErr = validateInput(email, [{ type: 'required' }, { type: 'email' }])
    if (emailErr) { setError(emailErr); return }
    const nameErr = validateInput(name, [{ type: 'required', message: 'Name is required' }])
    if (nameErr)  { setError(nameErr);  return }

    try {
      inviteTeamMember(email, name, role, profile.email ?? 'Admin')
      setInvited((prev) => [...prev, { email, name, role }])
      setEmail('')
      setName('')
      setRole('marketing_manager')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to invite member')
    }
  }, [email, name, role, profile.email])

  return (
    <div>
      <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, lineHeight: 1.6, marginTop: 0, marginBottom: 20 }}>
        Bring your team in. Each member gets a role that controls what they can view and edit.
        Invitations are saved — you can add more in <strong style={{ color: '#00c8ff' }}>Settings → Team</strong>.
      </p>

      <div style={cardBase}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>Email</label>
            <input
              style={inputStyle}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@example.com"
              onKeyDown={(e) => { if (e.key === 'Enter') handleInvite() }}
            />
          </div>
          <div>
            <label style={labelStyle}>Name</label>
            <input
              style={inputStyle}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Smith"
              onKeyDown={(e) => { if (e.key === 'Enter') handleInvite() }}
            />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Role</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {roleOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setRole(opt.value)}
                style={{
                  background:   role === opt.value ? 'rgba(0,200,255,0.15)' : 'rgba(255,255,255,0.05)',
                  border:       `1px solid ${role === opt.value ? 'rgba(0,200,255,0.5)' : 'rgba(255,255,255,0.12)'}`,
                  color:        role === opt.value ? '#00c8ff' : 'rgba(255,255,255,0.6)',
                  borderRadius: 8,
                  padding:      '6px 12px',
                  fontSize:     12,
                  fontWeight:   600,
                  cursor:       'pointer',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 8, padding: '8px 12px', color: '#f87171', fontSize: 12, marginBottom: 12 }}>
            {error}
          </div>
        )}

        <button
          onClick={handleInvite}
          style={{ background: 'rgba(0,200,255,0.12)', border: '1px solid rgba(0,200,255,0.35)', color: '#00c8ff', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
        >
          + Invite Member
        </button>
      </div>

      {invited.length > 0 && (
        <div>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' }}>
            Invited this session
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {invited.map((m, i) => (
              <div key={i} style={{ ...cardBase, marginBottom: 0, display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px' }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(0,200,255,0.1)', border: '1px solid rgba(0,200,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#00c8ff', flexShrink: 0 }}>
                  {(m.name[0] ?? '?').toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#fff', fontWeight: 600, fontSize: 13 }}>{m.name}</div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{m.email}</div>
                </div>
                <span style={{ background: 'rgba(0,200,255,0.1)', border: '1px solid rgba(0,200,255,0.25)', color: '#00c8ff', borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 700 }}>
                  {m.role.replace(/_/g, ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Step 5: Done ──────────────────────────────────────────────────────────────

function DoneStep({ onFinish }: { onFinish: () => void }) {
  const quickLinks = [
    { icon: '✍️', label: 'Generate your first post',    section: 'social-post' },
    { icon: '🎬', label: 'Try Creative Studio',          section: 'creative'    },
    { icon: '🎯', label: 'View Lead Tracker',            section: 'leads'       },
    { icon: '📈', label: 'Explore Analytics',            section: 'analytics'   },
    { icon: '⚙️', label: 'Review all settings',          section: 'settings'    },
  ]

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: 56, marginBottom: 12 }}>🎉</div>
        <h2 style={{ color: '#fff', fontSize: 22, fontWeight: 800, margin: '0 0 8px' }}>
          You're all set!
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, margin: 0, lineHeight: 1.6 }}>
          BayKid AI Marketing is ready to go. Start exploring or jump straight to a feature.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
        {quickLinks.map((link) => (
          <button
            key={link.section}
            onClick={onFinish}
            style={{
              display:       'flex',
              alignItems:    'center',
              gap:           12,
              background:    'rgba(255,255,255,0.04)',
              border:        '1px solid rgba(255,255,255,0.1)',
              borderRadius:  10,
              padding:       '12px 16px',
              color:         'rgba(255,255,255,0.8)',
              fontSize:      13,
              fontWeight:    500,
              cursor:        'pointer',
              textAlign:     'left',
              width:         '100%',
              transition:    'all 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(0,200,255,0.07)'
              e.currentTarget.style.borderColor = 'rgba(0,200,255,0.25)'
              e.currentTarget.style.color = '#fff'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
              e.currentTarget.style.color = 'rgba(255,255,255,0.8)'
            }}
          >
            <span style={{ fontSize: 18 }}>{link.icon}</span>
            <span>{link.label}</span>
            <span style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.3)', fontSize: 16 }}>→</span>
          </button>
        ))}
      </div>

      <button
        onClick={onFinish}
        style={{
          width:        '100%',
          background:   'linear-gradient(135deg, rgba(0,200,255,0.2), rgba(130,80,255,0.2))',
          border:       '1px solid rgba(0,200,255,0.5)',
          color:        '#00c8ff',
          borderRadius: 12,
          padding:      '14px 24px',
          fontSize:     15,
          fontWeight:   800,
          cursor:       'pointer',
          letterSpacing: '0.02em',
          boxShadow:    '0 0 32px rgba(0,200,255,0.15)',
        }}
      >
        🚀 Launch AI Marketing Center
      </button>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

const STEPS = [
  { id: 'welcome',   label: 'Welcome',   icon: '👋' },
  { id: 'platforms', label: 'Platforms', icon: '🔌' },
  { id: 'brand',     label: 'Brand',     icon: '🎨' },
  { id: 'team',      label: 'Team',      icon: '👥' },
  { id: 'done',      label: 'Done',      icon: '🎉' },
]

interface OnboardingFlowProps {
  onComplete: () => void
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [step, setStep] = useState(0)

  const finish = useCallback(() => {
    markOnboardingComplete()
    onComplete()
  }, [onComplete])

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1))
  const prev = () => setStep((s) => Math.max(s - 1, 0))

  const isLast = step === STEPS.length - 1

  return (
    // ── Overlay ──
    <div
      style={{
        position:       'fixed',
        inset:          0,
        background:     'rgba(10,14,26,0.92)',
        backdropFilter: 'blur(12px)',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        zIndex:         1000,
        padding:        20,
      }}
    >
      <div
        style={{
          background:   'rgba(16,22,40,0.98)',
          border:       '1px solid rgba(0,200,255,0.2)',
          borderRadius: 20,
          width:        '100%',
          maxWidth:     560,
          maxHeight:    '90vh',
          display:      'flex',
          flexDirection:'column',
          overflow:     'hidden',
          boxShadow:    '0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,200,255,0.08)',
        }}
      >
        {/* ── Progress header ── */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Setup Wizard
            </span>
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>
              Step {step + 1} of {STEPS.length}
            </span>
          </div>

          {/* Step pills */}
          <div style={{ display: 'flex', gap: 6 }}>
            {STEPS.map((s, i) => {
              const done    = i < step
              const active  = i === step
              const future  = i > step
              return (
                <div
                  key={s.id}
                  style={{
                    flex:         1,
                    display:      'flex',
                    flexDirection:'column',
                    alignItems:   'center',
                    gap:          4,
                    cursor:       done ? 'pointer' : 'default',
                  }}
                  onClick={() => { if (done) setStep(i) }}
                >
                  <div
                    style={{
                      height:       3,
                      borderRadius: 2,
                      background:   done ? '#22c55e' : active ? '#00c8ff' : 'rgba(255,255,255,0.1)',
                      width:        '100%',
                      transition:   'background 0.3s',
                    }}
                  />
                  <span
                    style={{
                      fontSize:   10,
                      fontWeight: active ? 700 : 500,
                      color:      done ? '#22c55e' : active ? '#00c8ff' : future ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.4)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {done ? '✓' : s.icon} {s.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Step content ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 24px 8px' }}>
          {step === 0 && <WelcomeStep />}
          {step === 1 && <ConnectPlatformsStep />}
          {step === 2 && <BrandVoiceStep />}
          {step === 3 && <InviteTeamStep />}
          {step === 4 && <DoneStep onFinish={finish} />}
        </div>

        {/* ── Footer buttons ── */}
        {!isLast && (
          <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              {step > 0 && (
                <button
                  onClick={prev}
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  ← Back
                </button>
              )}
              <button
                onClick={finish}
                style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 12, cursor: 'pointer', padding: '9px 4px' }}
              >
                Skip setup
              </button>
            </div>

            <button
              onClick={next}
              style={{
                background:   'rgba(0,200,255,0.15)',
                border:       '1px solid rgba(0,200,255,0.45)',
                color:        '#00c8ff',
                borderRadius: 10,
                padding:      '10px 24px',
                fontSize:     14,
                fontWeight:   700,
                cursor:       'pointer',
                boxShadow:    '0 0 20px rgba(0,200,255,0.1)',
                transition:   'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(0,200,255,0.22)'
                e.currentTarget.style.boxShadow  = '0 0 28px rgba(0,200,255,0.2)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(0,200,255,0.15)'
                e.currentTarget.style.boxShadow  = '0 0 20px rgba(0,200,255,0.1)'
              }}
            >
              {step === 0 ? "Let's Start →" : step === STEPS.length - 2 ? 'Finish Setup →' : 'Next →'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
