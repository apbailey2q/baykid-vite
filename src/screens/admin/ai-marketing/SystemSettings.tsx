// SystemSettings.tsx — AI Marketing Center System Settings
// BayKid AI Marketing Center
//
// Tabs:
//   Organization · API · Brand Voice · Automation Defaults · Notifications · Team · Audit Log

import { useState, useEffect } from 'react'
import {
  loadOrgSettings, saveOrgSettings, patchOrgSettings,
  inviteTeamMember, updateMemberRole, removeMember, getActiveTeam,
  type OrgSettings, type TeamMember,
} from '../../../lib/orgSettings'
import {
  loadUserProfile, saveUserProfile, ALL_ROLES, ROLE_META, type UserRole,
  usePermission,
} from '../../../lib/permissions'
import { loadAuditLog, clearAuditLog, AUDIT_ACTION_META, type AuditEntry } from '../../../lib/auditLog'
import { logAudit } from '../../../lib/auditLog'
import { usePaginatedData, useDebounceValue } from '../../../lib/errorHandling'

// ── Style helpers ──────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  color: '#fff', borderRadius: 8, padding: '8px 12px',
  fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700,
  display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em',
}

function card(o?: React.CSSProperties): React.CSSProperties {
  return { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, ...o }
}

function ghostBtn(o?: React.CSSProperties): React.CSSProperties {
  return { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.65)', borderRadius: 8, padding: '7px 14px', fontWeight: 600, fontSize: 12, cursor: 'pointer', ...o }
}

function saveBtn(o?: React.CSSProperties): React.CSSProperties {
  return { background: 'linear-gradient(135deg,#0057e7,#00c8ff)', border: 'none', color: '#fff', borderRadius: 8, padding: '8px 20px', fontWeight: 700, fontSize: 12, cursor: 'pointer', ...o }
}

// ── Toast ──────────────────────────────────────────────────────────────────────

interface Toast { id: number; msg: string; type: 'success' | 'error' | 'info' }
function useLocalToasts() {
  const [toasts, setToasts] = useState<Toast[]>([])
  function show(msg: string, type: Toast['type'] = 'success') {
    const id = Date.now()
    setToasts((p) => [...p, { id, msg, type }])
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 2800)
  }
  const colors = { success: 'rgba(34,197,94,.9)', error: 'rgba(248,113,113,.9)', info: 'rgba(0,200,255,.9)' }
  const Stack = () => (
    <div style={{ position: 'fixed', bottom: 24, right: 24, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 9999, pointerEvents: 'none' }}>
      {toasts.map((t) => (
        <div key={t.id} style={{ background: colors[t.type], color: '#fff', borderRadius: 12, padding: '10px 18px', fontWeight: 700, fontSize: 13, boxShadow: '0 4px 20px rgba(0,0,0,.4)', animation: 'fadeUp .25s ease' }}>
          {t.msg}
        </div>
      ))}
    </div>
  )
  return { show, Stack }
}

type Tab = 'org' | 'api' | 'brand' | 'automation' | 'notifications' | 'team' | 'audit'

// ═════════════════════════════════════════════════════════════════════════════
// Organization Tab
// ═════════════════════════════════════════════════════════════════════════════
function OrgTab({ settings, onSave }: { settings: OrgSettings; onSave: (s: OrgSettings) => void }) {
  const [orgName,    setOrgName]    = useState(settings.orgName)
  const [timezone,   setTimezone]   = useState(settings.timezone)
  const [locale,     setLocale]     = useState(settings.locale)
  const [primaryColor,setPrimaryColor] = useState(settings.primaryColor)

  const TIMEZONES = [
    'America/New_York', 'America/Chicago', 'America/Denver',
    'America/Phoenix', 'America/Los_Angeles', 'America/Anchorage',
    'Pacific/Honolulu', 'UTC',
  ]

  function handleSave() {
    onSave({ ...settings, orgName, timezone, locale, primaryColor })
    logAudit('settings.updated', 'settings', { entityTitle: 'Organization Settings', actor: 'Admin' })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ ...card({ padding: '18px 20px' }) }}>
        <h3 style={{ color: '#fff', fontSize: 14, fontWeight: 700, margin: '0 0 16px' }}>Organization Details</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={labelStyle}>Organization Name</label>
            <input style={inputStyle} value={orgName} onChange={(e) => setOrgName(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Organization ID</label>
            <input style={{ ...inputStyle, opacity: 0.5, cursor: 'not-allowed' }} value={settings.orgId} readOnly />
          </div>
          <div>
            <label style={labelStyle}>Timezone</label>
            <select style={inputStyle} value={timezone} onChange={(e) => setTimezone(e.target.value)}>
              {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Locale</label>
            <select style={inputStyle} value={locale} onChange={(e) => setLocale(e.target.value)}>
              {['en-US', 'en-GB', 'es-US'].map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Brand Color</label>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)}
                style={{ width: 40, height: 36, borderRadius: 6, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }} />
              <input style={{ ...inputStyle, flex: 1 }} value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
            </div>
          </div>
        </div>
      </div>
      <div>
        <button onClick={handleSave} style={saveBtn()}>💾 Save Organization Settings</button>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// API Settings Tab
// ═════════════════════════════════════════════════════════════════════════════
function APITab({ settings, onSave }: { settings: OrgSettings; onSave: (s: OrgSettings) => void }) {
  const [model,       setModel]       = useState(settings.apiSettings.claudeModel)
  const [maxTokens,   setMaxTokens]   = useState(settings.apiSettings.maxTokens)
  const [temperature, setTemperature] = useState(settings.apiSettings.temperature)
  const [rateLimit,   setRateLimit]   = useState(settings.apiSettings.rateLimitPerMin)

  const MODELS = [
    { value: 'claude-opus-4-5',       label: 'Claude Opus 4.5  — Most capable'    },
    { value: 'claude-sonnet-4-5',     label: 'Claude Sonnet 4.5 — Balanced (recommended)' },
    { value: 'claude-haiku-3-5',      label: 'Claude Haiku 3.5  — Fastest / cheapest' },
  ]

  // Check API key status
  const isDemoMode = import.meta.env.VITE_ENABLE_DEMO_ACCESS === 'true'

  function handleSave() {
    onSave({ ...settings, apiSettings: { ...settings.apiSettings, claudeModel: model, maxTokens, temperature, rateLimitPerMin: rateLimit } })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Status banner */}
      <div style={{ background: isDemoMode ? 'rgba(251,191,36,0.08)' : 'rgba(34,197,94,0.08)', border: `1px solid ${isDemoMode ? 'rgba(251,191,36,0.25)' : 'rgba(34,197,94,0.25)'}`, borderRadius: 12, padding: '14px 18px', display: 'flex', gap: 12, alignItems: 'center' }}>
        <span style={{ fontSize: 20 }}>{isDemoMode ? '⚠️' : '✅'}</span>
        <div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>
            {isDemoMode ? 'Demo Mode — Mock AI responses' : 'Live Mode — Claude API connected'}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 }}>
            {isDemoMode
              ? 'Set ANTHROPIC_API_KEY in .env.local and restart to enable real Claude API calls.'
              : 'ANTHROPIC_API_KEY is configured. All AI generation uses live Claude.'}
          </div>
        </div>
      </div>

      <div style={{ ...card({ padding: '18px 20px' }) }}>
        <h3 style={{ color: '#fff', fontSize: 14, fontWeight: 700, margin: '0 0 16px' }}>Claude Model Settings</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelStyle}>Model</label>
            <select style={inputStyle} value={model} onChange={(e) => setModel(e.target.value)}>
              {MODELS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <div>
              <label style={labelStyle}>Max Tokens</label>
              <input type="number" style={inputStyle} value={maxTokens} min={256} max={8192} step={256}
                onChange={(e) => setMaxTokens(Number(e.target.value))} />
            </div>
            <div>
              <label style={labelStyle}>Temperature (0–1)</label>
              <input type="number" style={inputStyle} value={temperature} min={0} max={1} step={0.1}
                onChange={(e) => setTemperature(Number(e.target.value))} />
            </div>
            <div>
              <label style={labelStyle}>Rate Limit (req/min)</label>
              <input type="number" style={inputStyle} value={rateLimit} min={1} max={60}
                onChange={(e) => setRateLimit(Number(e.target.value))} />
            </div>
          </div>
        </div>
      </div>
      <button onClick={handleSave} style={saveBtn()}>💾 Save API Settings</button>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Brand Voice Tab
// ═════════════════════════════════════════════════════════════════════════════
function BrandVoiceTab({ settings, onSave }: { settings: OrgSettings; onSave: (s: OrgSettings) => void }) {
  const bv = settings.brandVoice
  const [toneKeywords,    setToneKeywords]    = useState(bv.toneKeywords.join(', '))
  const [avoidKeywords,   setAvoidKeywords]   = useState(bv.avoidKeywords.join(', '))
  const [signaturePhrase, setSignaturePhrase] = useState(bv.signaturePhrase)
  const [cta,             setCta]             = useState(bv.callToAction)
  const [emojiUsage,      setEmojiUsage]      = useState(bv.emojiUsage)

  // Also sync to legacy baykid_ai_brand_voice key used by CreativeStudio
  function handleSave() {
    const brandVoice = {
      toneKeywords:    toneKeywords.split(',').map((s) => s.trim()).filter(Boolean),
      avoidKeywords:   avoidKeywords.split(',').map((s) => s.trim()).filter(Boolean),
      signaturePhrase, callToAction: cta, emojiUsage,
    }
    onSave({ ...settings, brandVoice })
    // Keep legacy key in sync
    localStorage.setItem('baykid_ai_brand_voice', JSON.stringify({
      toneKeywords: brandVoice.toneKeywords,
      avoidKeywords: brandVoice.avoidKeywords,
      voiceStyle: signaturePhrase,
    }))
    logAudit('settings.updated', 'settings', { entityTitle: 'Brand Voice Settings', actor: 'Admin' })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ ...card({ padding: '18px 20px' }) }}>
        <h3 style={{ color: '#fff', fontSize: 14, fontWeight: 700, margin: '0 0 4px' }}>Brand Voice Configuration</h3>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, margin: '0 0 16px' }}>
          These settings are automatically appended to every AI generation prompt to keep output on-brand.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelStyle}>Tone Keywords <span style={{ fontWeight: 400, textTransform: 'none' }}>(comma-separated)</span></label>
            <input style={inputStyle} value={toneKeywords} onChange={(e) => setToneKeywords(e.target.value)}
              placeholder="e.g. eco-conscious, community-first, approachable, Nashville-proud" />
          </div>
          <div>
            <label style={labelStyle}>Words / Phrases to Avoid <span style={{ fontWeight: 400, textTransform: 'none' }}>(comma-separated)</span></label>
            <input style={inputStyle} value={avoidKeywords} onChange={(e) => setAvoidKeywords(e.target.value)}
              placeholder="e.g. trash, garbage, waste removal" />
          </div>
          <div>
            <label style={labelStyle}>Signature Phrase</label>
            <input style={inputStyle} value={signaturePhrase} onChange={(e) => setSignaturePhrase(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Default Call-to-Action</label>
            <input style={inputStyle} value={cta} onChange={(e) => setCta(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Emoji Usage</label>
            <select style={inputStyle} value={emojiUsage} onChange={(e) => setEmojiUsage(e.target.value as typeof emojiUsage)}>
              <option value="heavy">Heavy — 3+ per post</option>
              <option value="moderate">Moderate — 1–2 per post (recommended)</option>
              <option value="minimal">Minimal — occasional only</option>
              <option value="none">None — text only</option>
            </select>
          </div>
        </div>
      </div>
      <button onClick={handleSave} style={saveBtn()}>💾 Save Brand Voice</button>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Automation Defaults Tab
// ═════════════════════════════════════════════════════════════════════════════
function AutomationTab({ settings, onSave }: { settings: OrgSettings; onSave: (s: OrgSettings) => void }) {
  const [requireApproval,   setRequireApproval]   = useState(settings.requireApproval)
  const [approvalThreshold, setApprovalThreshold] = useState(settings.approvalThreshold)
  const [autoPublish,       setAutoPublish]        = useState(settings.autoPublish)
  const [retentionDays,     setRetentionDays]      = useState(settings.contentRetentionDays)

  function handleSave() {
    onSave({ ...settings, requireApproval, approvalThreshold, autoPublish, contentRetentionDays: retentionDays })
  }

  function Toggle({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div>
          <div style={{ color: '#fff', fontWeight: 600, fontSize: 13 }}>{label}</div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 }}>{desc}</div>
        </div>
        <button onClick={() => onChange(!value)}
          style={{ width: 44, height: 24, borderRadius: 12, border: 'none', background: value ? '#22c55e' : 'rgba(255,255,255,0.15)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
          <div style={{ position: 'absolute', top: 3, left: value ? 22 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ ...card({ padding: '18px 20px' }) }}>
        <h3 style={{ color: '#fff', fontSize: 14, fontWeight: 700, margin: '0 0 4px' }}>Content Workflow</h3>
        <Toggle label="Require Approval Before Publishing" desc="All posts must be approved in the Approval Queue before publishing"
          value={requireApproval} onChange={setRequireApproval} />
        {requireApproval && (
          <div style={{ paddingTop: 12 }}>
            <label style={labelStyle}>Approvals Required</label>
            <select style={{ ...inputStyle, width: 'auto', minWidth: 160 }} value={approvalThreshold} onChange={(e) => setApprovalThreshold(Number(e.target.value))}>
              <option value={1}>1 approver</option>
              <option value={2}>2 approvers</option>
              <option value={3}>3 approvers</option>
            </select>
          </div>
        )}
        <Toggle label="Allow Auto-Publish from Automation Rules" desc="Automation rules with autoPublishAllowed:true can skip the approval gate"
          value={autoPublish} onChange={setAutoPublish} />
      </div>

      <div style={{ ...card({ padding: '18px 20px' }) }}>
        <h3 style={{ color: '#fff', fontSize: 14, fontWeight: 700, margin: '0 0 16px' }}>Data Retention</h3>
        <div>
          <label style={labelStyle}>Keep Content History (Days)</label>
          <select style={{ ...inputStyle, width: 'auto', minWidth: 200 }} value={retentionDays} onChange={(e) => setRetentionDays(Number(e.target.value))}>
            {[30, 60, 90, 180, 365].map((d) => <option key={d} value={d}>{d} days</option>)}
          </select>
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 6 }}>
            Posted and rejected content older than this will be archived.
          </div>
        </div>
      </div>
      <button onClick={handleSave} style={saveBtn()}>💾 Save Automation Defaults</button>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Notifications Tab
// ═════════════════════════════════════════════════════════════════════════════
function NotificationsTab({ settings, onSave }: { settings: OrgSettings; onSave: (s: OrgSettings) => void }) {
  const [prefs, setPrefs] = useState(settings.notifPrefs)
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

  function toggle(key: keyof typeof prefs) {
    setPrefs((p) => ({ ...p, [key]: !p[key] }))
  }

  const notifs: Array<{ key: keyof typeof prefs; label: string; desc: string }> = [
    { key: 'pendingApprovals', label: 'Pending Approvals',   desc: 'When posts are waiting in the Approval Queue'      },
    { key: 'publishFailures',  label: 'Publish Failures',    desc: 'When a scheduled post fails to publish'           },
    { key: 'leadConversions',  label: 'Lead Conversions',    desc: 'When a lead is converted via automation or manual' },
    { key: 'automationFired',  label: 'Automation Fired',    desc: 'Every time an automation rule triggers'            },
    { key: 'followerDrops',    label: 'Follower Drops',      desc: 'When follower growth goes negative'               },
    { key: 'weeklyDigest',     label: 'Weekly Digest Email', desc: 'Summary of performance and pending actions'       },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ ...card({ padding: '18px 20px' }) }}>
        <h3 style={{ color: '#fff', fontSize: 14, fontWeight: 700, margin: '0 0 16px' }}>In-App Notifications</h3>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {notifs.map((n) => (
            <div key={n.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div>
                <div style={{ color: '#fff', fontWeight: 600, fontSize: 13 }}>{n.label}</div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 }}>{n.desc}</div>
              </div>
              <button onClick={() => toggle(n.key)}
                style={{ width: 44, height: 24, borderRadius: 12, border: 'none', background: prefs[n.key] ? '#22c55e' : 'rgba(255,255,255,0.15)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                <div style={{ position: 'absolute', top: 3, left: prefs[n.key] ? 22 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
              </button>
            </div>
          ))}
        </div>
        {prefs.weeklyDigest && (
          <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
            <div>
              <label style={labelStyle}>Digest Day</label>
              <select style={inputStyle} value={prefs.digestDay} onChange={(e) => setPrefs((p) => ({ ...p, digestDay: Number(e.target.value) }))}>
                {days.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Digest Hour (24h)</label>
              <select style={inputStyle} value={prefs.digestHour} onChange={(e) => setPrefs((p) => ({ ...p, digestHour: Number(e.target.value) }))}>
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>{i === 0 ? '12am' : i < 12 ? `${i}am` : i === 12 ? '12pm' : `${i - 12}pm`}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>
      <button onClick={() => onSave({ ...settings, notifPrefs: prefs })} style={saveBtn()}>
        💾 Save Notification Preferences
      </button>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Team Management Tab
// ═════════════════════════════════════════════════════════════════════════════
function TeamTab({ showToast }: { showToast: (msg: string, type?: 'success' | 'error' | 'info') => void }) {
  const { can } = usePermission()
  const [team,    setTeam]    = useState<TeamMember[]>(() => getActiveTeam())
  const [email,   setEmail]   = useState('')
  const [name,    setName]    = useState('')
  const [role,    setRole]    = useState<UserRole>('content_reviewer')
  const [inviting, setInviting] = useState(false)

  function refresh() { setTeam(getActiveTeam()) }

  async function handleInvite() {
    if (!email.trim() || !name.trim()) { showToast('Email and name are required', 'error'); return }
    setInviting(true)
    try {
      inviteTeamMember(email.trim(), name.trim(), role)
      logAudit('team.member_invited', 'team_member', { entityTitle: email, meta: { role, email } })
      showToast(`✉️ Invitation sent to ${email}`)
      setEmail(''); setName('')
      refresh()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Invite failed', 'error')
    } finally {
      setInviting(false)
    }
  }

  function handleRoleChange(memberId: string, newRole: UserRole) {
    updateMemberRole(memberId, newRole)
    logAudit('team.role_changed', 'team_member', { entityId: memberId, meta: { newRole } })
    showToast('Role updated')
    refresh()
  }

  function handleRemove(memberId: string, memberEmail: string) {
    removeMember(memberId)
    logAudit('team.member_removed', 'team_member', { entityId: memberId, entityTitle: memberEmail })
    showToast(`Removed ${memberEmail}`, 'info')
    refresh()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Invite form */}
      {can('team:invite') && (
        <div style={{ ...card({ padding: '18px 20px' }) }}>
          <h3 style={{ color: '#fff', fontSize: 14, fontWeight: 700, margin: '0 0 14px' }}>Invite Team Member</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 160px auto', gap: 10, alignItems: 'flex-end' }}>
            <div>
              <label style={labelStyle}>Email</label>
              <input style={inputStyle} placeholder="name@company.com" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleInvite()} />
            </div>
            <div>
              <label style={labelStyle}>Name</label>
              <input style={inputStyle} placeholder="Full Name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Role</label>
              <select style={inputStyle} value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
                {ALL_ROLES.map((r) => <option key={r} value={r}>{ROLE_META[r].label}</option>)}
              </select>
            </div>
            <button onClick={handleInvite} disabled={inviting} style={saveBtn({ opacity: inviting ? 0.6 : 1, cursor: inviting ? 'wait' : 'pointer', whiteSpace: 'nowrap' })}>
              {inviting ? '⏳ Sending…' : '+ Invite'}
            </button>
          </div>
        </div>
      )}

      {/* Team list */}
      <div style={{ ...card({ padding: '18px 20px' }) }}>
        <h3 style={{ color: '#fff', fontSize: 14, fontWeight: 700, margin: '0 0 14px' }}>Team Members ({team.filter((m) => m.status === 'active').length} active)</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {team.map((member) => {
            const meta = ROLE_META[member.role]
            return (
              <div key={member.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* Avatar */}
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(0,200,255,0.15)', border: '1px solid rgba(0,200,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00c8ff', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                  {(member.name[0] ?? '?').toUpperCase()}
                </div>
                {/* Info */}
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#fff', fontWeight: 600, fontSize: 13 }}>{member.name}</div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{member.email}</div>
                </div>
                {/* Status */}
                <span style={{ background: member.status === 'active' ? 'rgba(34,197,94,0.1)' : 'rgba(251,191,36,0.1)', color: member.status === 'active' ? '#22c55e' : '#fbbf24', border: `1px solid ${member.status === 'active' ? 'rgba(34,197,94,0.25)' : 'rgba(251,191,36,0.25)'}`, borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 700, textTransform: 'capitalize', flexShrink: 0 }}>
                  {member.status}
                </span>
                {/* Role */}
                {can('team:manage_roles') ? (
                  <select style={{ ...inputStyle, width: 'auto', minWidth: 160, fontSize: 11 }} value={member.role}
                    onChange={(e) => handleRoleChange(member.id, e.target.value as UserRole)}>
                    {ALL_ROLES.map((r) => <option key={r} value={r}>{ROLE_META[r].label}</option>)}
                  </select>
                ) : (
                  <span style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}`, borderRadius: 20, padding: '3px 10px', fontSize: 10, fontWeight: 700 }}>
                    {meta.label}
                  </span>
                )}
                {/* Remove */}
                {can('team:remove') && (
                  <button onClick={() => handleRemove(member.id, member.email)} style={ghostBtn({ color: 'rgba(248,113,113,0.7)', borderColor: 'rgba(248,113,113,0.2)', fontSize: 11, padding: '5px 10px' })}>
                    Remove
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Your role */}
      <div style={{ background: 'rgba(0,200,255,0.05)', border: '1px solid rgba(0,200,255,0.15)', borderRadius: 12, padding: '12px 16px' }}>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>
          Your current role: <strong style={{ color: '#00c8ff' }}>{ROLE_META[loadUserProfile().role].label}</strong>
        </div>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Audit Log Tab
// ═════════════════════════════════════════════════════════════════════════════
function AuditLogTab({ showToast }: { showToast: (msg: string, type?: 'success' | 'error' | 'info') => void }) {
  const [entries,    setEntries]    = useState<AuditEntry[]>(() => loadAuditLog())
  const [filterType, setFilterType] = useState<string>('all')
  const [search,     setSearch]     = useState('')
  const debouncedSearch = useDebounceValue(search, 300)

  const filtered = entries.filter((e) => {
    if (filterType !== 'all' && !e.action.startsWith(filterType)) return false
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase()
      return (
        e.action.toLowerCase().includes(q) ||
        (e.actor ?? '').toLowerCase().includes(q) ||
        (e.entityTitle ?? '').toLowerCase().includes(q)
      )
    }
    return true
  })

  const paginated = usePaginatedData(filtered, 25)

  function fmtTime(iso: string) {
    return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  return (
    <div>
      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input style={{ ...inputStyle, maxWidth: 220 }} placeholder="Search action, actor, entity…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select style={{ ...inputStyle, width: 'auto', minWidth: 160 }} value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="all">All Actions</option>
          <option value="post">Posts</option>
          <option value="lead">Leads</option>
          <option value="automation">Automation</option>
          <option value="publish">Publishing</option>
          <option value="team">Team</option>
          <option value="settings">Settings</option>
          <option value="ai">AI</option>
        </select>
        <div style={{ flex: 1 }} />
        <button onClick={() => { setEntries(loadAuditLog()) }} style={ghostBtn()}>🔄 Refresh</button>
        {loadUserProfile().role === 'super_admin' && (
          <button onClick={() => { clearAuditLog(); setEntries([]); showToast('Audit log cleared', 'info') }}
            style={ghostBtn({ color: 'rgba(248,113,113,0.7)', borderColor: 'rgba(248,113,113,0.2)' })}>
            🗑️ Clear Log
          </button>
        )}
      </div>

      {/* Log entries */}
      {entries.length === 0 ? (
        <div style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: 60, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, fontSize: 13 }}>
          No audit events recorded yet. Actions will appear here as they happen.
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {paginated.items.map((entry) => {
              const meta = AUDIT_ACTION_META[entry.action] ?? { icon: '•', color: 'rgba(255,255,255,0.5)', label: entry.action }
              return (
                <div key={entry.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ color: meta.color, fontSize: 14, flexShrink: 0, marginTop: 1 }}>{meta.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ color: meta.color, fontWeight: 700, fontSize: 12 }}>{meta.label}</span>
                      {entry.entityTitle && <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>— {entry.entityTitle}</span>}
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 2, display: 'flex', gap: 10 }}>
                      <span>by {entry.actor}</span>
                      {entry.actorRole && <span>({entry.actorRole})</span>}
                      <span>{fmtTime(entry.ts)}</span>
                    </div>
                    {entry.changes && entry.changes.length > 0 && (
                      <div style={{ marginTop: 4, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {entry.changes.map((c, i) => (
                          <span key={i} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '2px 6px', fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>
                            {c.field}: <span style={{ color: '#f87171' }}>{c.before.slice(0,20)}</span> → <span style={{ color: '#22c55e' }}>{c.after.slice(0,20)}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          {/* Pagination */}
          {paginated.totalPages > 1 && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 16, justifyContent: 'center' }}>
              <button onClick={paginated.prevPage} disabled={!paginated.hasPrev} style={ghostBtn({ opacity: paginated.hasPrev ? 1 : 0.4 })}>‹ Prev</button>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>Page {paginated.page + 1} of {paginated.totalPages} · {paginated.totalCount} entries</span>
              <button onClick={paginated.nextPage} disabled={!paginated.hasNext} style={ghostBtn({ opacity: paginated.hasNext ? 1 : 0.4 })}>Next ›</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// SystemSettings (main export)
// ═════════════════════════════════════════════════════════════════════════════
const TABS: Array<{ id: Tab; icon: string; label: string; perm?: import('../../../lib/permissions').Permission }> = [
  { id: 'org',           icon: '🏢', label: 'Organization'    },
  { id: 'api',           icon: '🔑', label: 'API Settings'    },
  { id: 'brand',         icon: '🎨', label: 'Brand Voice'     },
  { id: 'automation',    icon: '⚙️', label: 'Automation'      },
  { id: 'notifications', icon: '🔔', label: 'Notifications'   },
  { id: 'team',          icon: '👥', label: 'Team',           perm: 'team:view' },
  { id: 'audit',         icon: '📋', label: 'Audit Log',      perm: 'audit:view' },
]

export function SystemSettings() {
  const [tab,      setTab]      = useState<Tab>('org')
  const [settings, setSettings] = useState<OrgSettings>(() => loadOrgSettings())
  const { can }    = usePermission()
  const { show, Stack } = useLocalToasts()

  function handleSave(updated: OrgSettings) {
    saveOrgSettings(updated)
    setSettings(updated)
    show('✅ Settings saved')
  }

  return (
    <div style={{ maxWidth: 900 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 20, margin: '0 0 4px' }}>⚙️ System Settings</h2>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, margin: 0 }}>
          Configure organization settings, API keys, brand voice, team, and security.
        </p>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.25)', borderRadius: 12, padding: 4, marginBottom: 28, overflowX: 'auto' }}>
        {TABS.filter((t) => !t.perm || can(t.perm)).map((t) => {
          const active = tab === t.id
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: active ? 'rgba(0,200,255,0.18)' : 'transparent', color: active ? '#00c8ff' : 'rgba(255,255,255,0.4)', fontWeight: active ? 700 : 500, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap', transition: 'all 0.15s' }}>
              <span>{t.icon}</span><span>{t.label}</span>
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      {tab === 'org'           && <OrgTab           settings={settings} onSave={handleSave} />}
      {tab === 'api'           && <APITab           settings={settings} onSave={handleSave} />}
      {tab === 'brand'         && <BrandVoiceTab    settings={settings} onSave={handleSave} />}
      {tab === 'automation'    && <AutomationTab    settings={settings} onSave={handleSave} />}
      {tab === 'notifications' && <NotificationsTab settings={settings} onSave={handleSave} />}
      {tab === 'team'          && <TeamTab showToast={show} />}
      {tab === 'audit'         && <AuditLogTab showToast={show} />}

      <div style={{ height: 40 }} />
      <Stack />
    </div>
  )
}
