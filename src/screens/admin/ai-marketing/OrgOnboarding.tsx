// OrgOnboarding.tsx — Organization creation wizard
// Steps: 1. Create Org → 2. Choose Plan → 3. Connect Platforms → 4. Invite Team

import { useState } from 'react'
import { useOrg } from '../../../lib/orgStore'
import { inviteToOrg, generateSlug, PLANS, type OrgRole } from '../../../lib/organizations'

interface OrgOnboardingProps {
  onComplete: () => void
  onSkip?: () => void
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 300,
  background: 'rgba(0,0,0,0.75)',
  backdropFilter: 'blur(8px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 20,
}

const modal: React.CSSProperties = {
  background: '#0d1424',
  border: '1px solid rgba(0,200,255,0.2)',
  borderRadius: 16,
  padding: '32px 36px',
  width: '100%',
  maxWidth: 540,
  position: 'relative',
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8,
  color: '#fff',
  fontSize: 14,
  padding: '10px 14px',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
}

const btnPrimary: React.CSSProperties = {
  background: 'linear-gradient(135deg, #0080ff, #00c8ff)',
  border: 'none',
  borderRadius: 10,
  color: '#fff',
  fontSize: 14,
  fontWeight: 700,
  padding: '11px 24px',
  cursor: 'pointer',
  width: '100%',
}

const btnGhost: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10,
  color: 'rgba(255,255,255,0.5)',
  fontSize: 13,
  fontWeight: 600,
  padding: '9px 20px',
  cursor: 'pointer',
}

// ── Step indicator ────────────────────────────────────────────────────────────

function StepDots({ total, current }: { total: number; current: number }) {
  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 24 }}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          style={{
            width: i === current ? 20 : 8,
            height: 8,
            borderRadius: 4,
            background: i === current ? '#00c8ff' : i < current ? 'rgba(0,200,255,0.4)' : 'rgba(255,255,255,0.12)',
            transition: 'all 0.2s ease',
          }}
        />
      ))}
    </div>
  )
}

// ── Step 1: Create Organization ───────────────────────────────────────────────

function CreateOrgStep({ onNext }: { onNext: () => void }) {
  const { createOrg } = useOrg()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugManual, setSlugManual] = useState(false)
  const [timezone, setTimezone] = useState('America/New_York')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleNameChange = (v: string) => {
    setName(v)
    if (!slugManual) setSlug(generateSlug(v))
  }

  const handleCreate = async () => {
    if (!name.trim() || !slug.trim()) return
    setCreating(true)
    setError(null)
    try {
      await createOrg(name.trim(), slug.trim())
      onNext()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create organization')
    } finally {
      setCreating(false)
    }
  }

  return (
    <>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 36, marginBottom: 10 }}>🏢</div>
        <h2 style={{ margin: 0, color: '#fff', fontSize: 20, fontWeight: 700 }}>Create Your Organization</h2>
        <p style={{ margin: '6px 0 0', color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
          Your organization is the home for your team, content, and settings.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={labelStyle}>Organization Name</label>
          <input
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="e.g. BayKid Recycling"
            style={inputStyle}
            autoFocus
          />
        </div>

        <div>
          <label style={labelStyle}>URL Slug</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, whiteSpace: 'nowrap' }}>baykid.app/</span>
            <input
              value={slug}
              onChange={(e) => { setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')); setSlugManual(true) }}
              placeholder="your-org"
              style={{ ...inputStyle, flex: 1 }}
            />
          </div>
          <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, marginTop: 4 }}>
            Lowercase letters, numbers, and hyphens only. Cannot be changed later.
          </div>
        </div>

        <div>
          <label style={labelStyle}>Default Timezone</label>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            style={{ ...inputStyle, background: '#1a2235', cursor: 'pointer' }}
          >
            {[
              ['UTC', 'UTC'],
              ['America/New_York', 'Eastern (US & Canada)'],
              ['America/Chicago', 'Central (US & Canada)'],
              ['America/Denver', 'Mountain (US & Canada)'],
              ['America/Los_Angeles', 'Pacific (US & Canada)'],
              ['Europe/London', 'London'],
              ['Europe/Paris', 'Paris'],
              ['Asia/Tokyo', 'Tokyo'],
            ].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>

        {error && <div style={{ color: '#ef4444', fontSize: 13, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '8px 12px' }}>{error}</div>}

        <button onClick={handleCreate} disabled={creating || !name.trim() || !slug.trim()} style={btnPrimary}>
          {creating ? 'Creating…' : 'Create Organization →'}
        </button>
      </div>
    </>
  )
}

// ── Step 2: Choose Plan ───────────────────────────────────────────────────────

function ChoosePlanStep({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const { patchActiveOrg } = useOrg()
  const [selected, setSelected] = useState('free')
  const [saving, setSaving] = useState(false)

  const handleContinue = async () => {
    setSaving(true)
    try {
      await patchActiveOrg({ plan: selected as 'free' | 'starter' | 'pro' | 'enterprise' })
    } finally {
      setSaving(false)
      onNext()
    }
  }

  return (
    <>
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 36, marginBottom: 10 }}>💳</div>
        <h2 style={{ margin: 0, color: '#fff', fontSize: 20, fontWeight: 700 }}>Choose Your Plan</h2>
        <p style={{ margin: '6px 0 0', color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
          Start free — upgrade any time.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
        {PLANS.map((plan) => {
          const active = selected === plan.id
          return (
            <button
              key={plan.id}
              onClick={() => setSelected(plan.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '12px 16px',
                background: active ? 'rgba(0,200,255,0.08)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${active ? 'rgba(0,200,255,0.4)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 10,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${active ? '#00c8ff' : 'rgba(255,255,255,0.2)'}`, background: active ? '#00c8ff' : 'transparent', flexShrink: 0, position: 'relative' }}>
                {active && <div style={{ position: 'absolute', inset: 3, borderRadius: '50%', background: '#fff' }} />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>{plan.name}</span>
                  {plan.id === 'free' && <span style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e', borderRadius: 20, padding: '1px 8px', fontSize: 10, fontWeight: 700 }}>FREE FOREVER</span>}
                  {plan.id === 'pro' && <span style={{ background: 'rgba(0,200,255,0.12)', border: '1px solid rgba(0,200,255,0.3)', color: '#00c8ff', borderRadius: 20, padding: '1px 8px', fontSize: 10, fontWeight: 700 }}>POPULAR</span>}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 }}>
                  {plan.priceMonthly === 0 ? 'Free' : `$${(plan.priceMonthly / 100).toFixed(0)}/mo`}
                  {' · '}{plan.highlights.join(' · ')}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onSkip} style={btnGhost}>Skip for now</button>
        <button onClick={handleContinue} disabled={saving} style={{ ...btnPrimary, flex: 1 }}>
          {saving ? 'Saving…' : 'Continue →'}
        </button>
      </div>
    </>
  )
}

// ── Step 3: Connect Platforms ─────────────────────────────────────────────────

const PLATFORMS = [
  { id: 'facebook',  label: 'Facebook',  icon: '📘', color: '#1877F2' },
  { id: 'instagram', label: 'Instagram', icon: '📸', color: '#E4405F' },
  { id: 'linkedin',  label: 'LinkedIn',  icon: '💼', color: '#0A66C2' },
  { id: 'twitter',   label: 'X / Twitter', icon: '🐦', color: '#1DA1F2' },
  { id: 'tiktok',    label: 'TikTok',    icon: '🎵', color: '#ff0050' },
]

function ConnectPlatformsStep({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const [connected, setConnected] = useState<Set<string>>(new Set())
  const [connecting, setConnecting] = useState<string | null>(null)

  const handleConnect = (id: string) => {
    if (connected.has(id)) return
    setConnecting(id)
    setTimeout(() => {
      setConnected((prev) => new Set([...prev, id]))
      setConnecting(null)
    }, 900)
  }

  return (
    <>
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 36, marginBottom: 10 }}>🔗</div>
        <h2 style={{ margin: 0, color: '#fff', fontSize: 20, fontWeight: 700 }}>Connect Social Platforms</h2>
        <p style={{ margin: '6px 0 0', color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
          Connect your social accounts to enable publishing.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        {PLATFORMS.map((p) => {
          const isConnected = connected.has(p.id)
          const isConnecting = connecting === p.id
          return (
            <div
              key={p.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 14px',
                background: isConnected ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${isConnected ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 10,
              }}
            >
              <span style={{ fontSize: 20 }}>{p.icon}</span>
              <span style={{ color: '#fff', fontSize: 14, fontWeight: 600, flex: 1 }}>{p.label}</span>
              {isConnected ? (
                <span style={{ color: '#22c55e', fontSize: 13, fontWeight: 700 }}>✓ Connected</span>
              ) : (
                <button
                  onClick={() => handleConnect(p.id)}
                  disabled={isConnecting}
                  style={{ background: `rgba(${p.id === 'facebook' ? '24,119,242' : p.id === 'instagram' ? '228,64,95' : p.id === 'linkedin' ? '10,102,194' : p.id === 'twitter' ? '29,161,242' : '255,0,80'},0.15)`, border: `1px solid rgba(${p.id === 'facebook' ? '24,119,242' : p.id === 'instagram' ? '228,64,95' : p.id === 'linkedin' ? '10,102,194' : p.id === 'twitter' ? '29,161,242' : '255,0,80'},0.3)`, color: '#fff', borderRadius: 7, padding: '5px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  {isConnecting ? 'Connecting…' : 'Connect'}
                </button>
              )}
            </div>
          )
        })}
      </div>

      <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, textAlign: 'center', marginBottom: 14 }}>
        You can connect more platforms later in Settings.
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onSkip} style={btnGhost}>Skip for now</button>
        <button onClick={onNext} style={{ ...btnPrimary, flex: 1 }}>
          {connected.size > 0 ? `Continue with ${connected.size} platform${connected.size > 1 ? 's' : ''} →` : 'Continue →'}
        </button>
      </div>
    </>
  )
}

// ── Step 4: Invite Team ───────────────────────────────────────────────────────

const ORG_ROLES: OrgRole[] = ['admin', 'marketing_manager', 'content_reviewer', 'viewer']
const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin', marketing_manager: 'Marketing Manager',
  content_reviewer: 'Content Reviewer', viewer: 'Viewer',
}

function InviteTeamStep({ onComplete }: { onComplete: () => void }) {
  const { activeOrg } = useOrg()
  const [emails, setEmails] = useState([{ email: '', role: 'viewer' as OrgRole }])
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const addRow = () => setEmails((prev) => [...prev, { email: '', role: 'viewer' }])
  const updateRow = (i: number, key: 'email' | 'role', val: string) =>
    setEmails((prev) => prev.map((r, idx) => idx === i ? { ...r, [key]: val } : r))
  const removeRow = (i: number) => setEmails((prev) => prev.filter((_, idx) => idx !== i))

  const handleSend = async () => {
    if (!activeOrg) return onComplete()
    const valid = emails.filter((r) => r.email.trim())
    if (valid.length === 0) return onComplete()
    setSending(true)
    await Promise.allSettled(valid.map((r) => inviteToOrg(activeOrg.id, r.email.trim(), r.role)))
    setSending(false)
    setSent(true)
    setTimeout(onComplete, 1200)
  }

  if (sent) {
    return (
      <div style={{ textAlign: 'center', padding: '32px 0' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
        <h2 style={{ margin: 0, color: '#fff', fontSize: 22, fontWeight: 700 }}>You're all set!</h2>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginTop: 8 }}>Invitations sent. Launching your dashboard…</p>
      </div>
    )
  }

  return (
    <>
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 36, marginBottom: 10 }}>👥</div>
        <h2 style={{ margin: 0, color: '#fff', fontSize: 20, fontWeight: 700 }}>Invite Your Team</h2>
        <p style={{ margin: '6px 0 0', color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
          Invite teammates to collaborate. They'll get an email invite.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
        {emails.map((row, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="email"
              placeholder="Email address"
              value={row.email}
              onChange={(e) => updateRow(i, 'email', e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
            />
            <select
              value={row.role}
              onChange={(e) => updateRow(i, 'role', e.target.value)}
              style={{ background: '#1a2235', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#fff', fontSize: 13, padding: '9px 10px', cursor: 'pointer', outline: 'none' }}
            >
              {ORG_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
            {emails.length > 1 && (
              <button onClick={() => removeRow(i)} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 16, cursor: 'pointer', padding: '4px 6px', flexShrink: 0 }}>✕</button>
            )}
          </div>
        ))}
      </div>

      <button onClick={addRow} style={{ background: 'transparent', border: '1px dashed rgba(255,255,255,0.15)', borderRadius: 8, color: 'rgba(255,255,255,0.4)', fontSize: 13, padding: '8px', cursor: 'pointer', width: '100%', marginBottom: 16 }}>
        + Add another
      </button>

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onComplete} style={btnGhost}>Skip</button>
        <button onClick={handleSend} disabled={sending} style={{ ...btnPrimary, flex: 1 }}>
          {sending ? 'Sending…' : emails.some((r) => r.email.trim()) ? 'Send Invites →' : 'Finish Setup →'}
        </button>
      </div>
    </>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  color: 'rgba(255,255,255,0.5)',
  fontSize: 12,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 6,
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function OrgOnboarding({ onComplete, onSkip }: OrgOnboardingProps) {
  const [step, setStep] = useState(0)
  const TOTAL = 4

  const next = () => setStep((s) => Math.min(s + 1, TOTAL - 1))
  const done = () => onComplete()

  return (
    <div style={overlay}>
      <div style={modal}>
        {onSkip && step === 0 && (
          <button
            onClick={onSkip}
            title="Close"
            style={{ position: 'absolute', top: 14, right: 16, background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}
          >
            ✕
          </button>
        )}

        <StepDots total={TOTAL} current={step} />

        {step === 0 && <CreateOrgStep onNext={next} />}
        {step === 1 && <ChoosePlanStep onNext={next} onSkip={next} />}
        {step === 2 && <ConnectPlatformsStep onNext={next} onSkip={next} />}
        {step === 3 && <InviteTeamStep onComplete={done} />}
      </div>
    </div>
  )
}
