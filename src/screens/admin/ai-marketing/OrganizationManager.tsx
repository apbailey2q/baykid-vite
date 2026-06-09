// OrganizationManager.tsx — Full organization + team management UI
// Tabs: Overview | Team Members | Invitations | Activity | Settings

import { useState, useEffect, useCallback } from 'react'
import { useOrg } from '../../../lib/orgStore'
import { usePermission } from '../../../lib/permissions'
import {
  getOrgMembers, getOrgInvitations, getOrgActivity,
  inviteToOrg, resendInvitation, cancelInvitation,
  changeOrgMemberRole, removeOrgMember,
  ORG_ROLE_META, PLANS, DEFAULT_ORG_SETTINGS,
  type OrgMember, type OrgInvitation, type TeamActivityEntry, type OrgRole,
  type OrganizationSettings,
} from '../../../lib/organizations'

// ── Helpers ───────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

function RoleBadge({ role }: { role: OrgRole }) {
  const meta = ORG_ROLE_META[role]
  return (
    <span style={{ background: meta.bg, border: `1px solid ${meta.border}`, color: meta.color, borderRadius: 20, padding: '2px 9px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
      {meta.label}
    </span>
  )
}

// ── Tab: Overview ─────────────────────────────────────────────────────────────

function OverviewTab() {
  const { activeOrg, patchActiveOrg } = useOrg()
  const { can } = usePermission()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(activeOrg?.name ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  if (!activeOrg) return null

  const plan = PLANS[activeOrg.plan] ?? PLANS.free

  const handleSave = async () => {
    setSaving(true)
    await patchActiveOrg({ name })
    setSaving(false)
    setEditing(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Org identity card */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          {/* Avatar */}
          <div style={{ width: 64, height: 64, borderRadius: 12, background: 'linear-gradient(135deg, rgba(0,200,255,0.25), rgba(167,139,250,0.25))', border: '1px solid rgba(0,200,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, color: '#00c8ff', flexShrink: 0 }}>
            {activeOrg.name.slice(0, 2).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            {editing ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{ ...inputStyle, fontSize: 18, fontWeight: 700, flex: 1 }}
                  autoFocus
                />
                <button onClick={handleSave} disabled={saving} style={btnPrimary}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button onClick={() => { setEditing(false); setName(activeOrg.name) }} style={btnGhost}>
                  Cancel
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h2 style={{ margin: 0, color: '#fff', fontSize: 20, fontWeight: 700 }}>{activeOrg.name}</h2>
                {can('org:manage') && (
                  <button onClick={() => setEditing(true)} style={btnGhost}>✏️ Edit</button>
                )}
                {saved && <span style={{ color: '#22c55e', fontSize: 12 }}>✓ Saved</span>}
              </div>
            )}
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 4 }}>
              Slug: <code style={{ color: 'rgba(255,255,255,0.55)', background: 'rgba(255,255,255,0.05)', padding: '1px 6px', borderRadius: 4 }}>{activeOrg.slug}</code>
            </div>
          </div>
        </div>
      </div>

      {/* Plan card */}
      <div style={card}>
        <h3 style={sectionTitle}>Subscription Plan</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>{plan.name}</span>
              <span style={{ background: activeOrg.subscriptionStatus === 'active' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', border: `1px solid ${activeOrg.subscriptionStatus === 'active' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, color: activeOrg.subscriptionStatus === 'active' ? '#22c55e' : '#ef4444', borderRadius: 20, padding: '2px 9px', fontSize: 11, fontWeight: 700 }}>
                {activeOrg.subscriptionStatus}
              </span>
            </div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 4 }}>
              {plan.priceMonthly === 0 ? 'Free forever' : `$${(plan.priceMonthly / 100).toFixed(0)}/month · $${(plan.priceAnnual / 100).toFixed(0)}/year`}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              {plan.highlights.map((f) => (
                <span key={f} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', borderRadius: 20, padding: '2px 9px', fontSize: 11 }}>
                  ✓ {f}
                </span>
              ))}
            </div>
          </div>
          {can('billing:manage') && (
            <button style={btnPrimary}>Upgrade Plan</button>
          )}
        </div>
      </div>

      {/* Limits grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
        {[
          { label: 'Members', value: plan.features.maxMembers === -1 ? '∞' : plan.features.maxMembers },
          { label: 'Posts/month', value: plan.features.maxPostsMonth === -1 ? '∞' : plan.features.maxPostsMonth },
          { label: 'Automations', value: plan.features.maxAutomations === -1 ? '∞' : plan.features.maxAutomations },
          { label: 'AI Generations', value: plan.features.aiGensMonth === -1 ? '∞' : `${plan.features.aiGensMonth}/mo` },
        ].map(({ label, value }) => (
          <div key={label} style={{ ...card, textAlign: 'center', padding: '14px 12px' }}>
            <div style={{ color: '#00c8ff', fontSize: 22, fontWeight: 800 }}>{value}</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Tab: Team Members ─────────────────────────────────────────────────────────

const ORG_ROLES: OrgRole[] = ['owner', 'super_admin', 'admin', 'marketing_manager', 'content_reviewer', 'viewer']

function TeamTab() {
  const { activeOrg } = useOrg()
  const { can } = usePermission()
  const [members, setMembers] = useState<OrgMember[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<OrgRole>('viewer')
  const [inviting, setInviting] = useState(false)
  const [inviteMsg, setInviteMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const load = useCallback(async () => {
    if (!activeOrg) return
    setLoading(true)
    const m = await getOrgMembers(activeOrg.id)
    setMembers(m)
    setLoading(false)
  }, [activeOrg])

  useEffect(() => { void load() }, [load])

  const handleInvite = async () => {
    if (!activeOrg || !inviteEmail.trim()) return
    setInviting(true)
    try {
      await inviteToOrg(activeOrg.id, inviteEmail.trim(), inviteRole, 'Admin')
      setInviteEmail('')
      setInviteMsg({ ok: true, text: `Invitation sent to ${inviteEmail}` })
    } catch (err) {
      setInviteMsg({ ok: false, text: err instanceof Error ? err.message : 'Failed to send invitation' })
    } finally {
      setInviting(false)
      setTimeout(() => setInviteMsg(null), 4000)
    }
  }

  const handleRoleChange = async (memberId: string, orgId: string, role: OrgRole) => {
    await changeOrgMemberRole(orgId, memberId, role)
    setMembers((prev) => prev.map((m) => m.userId === memberId ? { ...m, role } : m))
  }

  const handleRemove = async (member: OrgMember) => {
    if (!window.confirm(`Remove ${member.name ?? member.email} from the organization?`)) return
    await removeOrgMember(member.orgId, member.userId)
    setMembers((prev) => prev.filter((m) => m.userId !== member.userId))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Invite form */}
      {can('team:invite') && (
        <div style={card}>
          <h3 style={sectionTitle}>Invite Team Member</h3>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <input
              type="email"
              placeholder="Email address"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
              style={{ ...inputStyle, flex: 1, minWidth: 200 }}
            />
            <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as OrgRole)} style={selectStyle}>
              {ORG_ROLES.filter((r) => r !== 'owner').map((r) => (
                <option key={r} value={r}>{ORG_ROLE_META[r].label}</option>
              ))}
            </select>
            <button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()} style={btnPrimary}>
              {inviting ? 'Sending…' : 'Send Invite'}
            </button>
          </div>
          {inviteMsg && (
            <div style={{ marginTop: 8, fontSize: 12, color: inviteMsg.ok ? '#22c55e' : '#ef4444' }}>
              {inviteMsg.text}
            </div>
          )}
        </div>
      )}

      {/* Members list */}
      <div style={card}>
        <h3 style={sectionTitle}>Members ({members.length})</h3>
        {loading ? (
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>Loading…</div>
        ) : members.length === 0 ? (
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>No members found.</div>
        ) : (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {members.map((m) => (
              <div key={m.userId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
                {/* Avatar */}
                <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(0,200,255,0.15)', border: '1px solid rgba(0,200,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#00c8ff', flexShrink: 0 }}>
                  {(m.name ?? m.email ?? '?').slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ color: '#fff', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.name ?? m.email ?? m.userId}
                  </div>
                  {m.name && <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>{m.email}</div>}
                  {m.joinedAt && <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, marginTop: 2 }}>Joined {relTime(m.joinedAt)}</div>}
                </div>
                {can('team:manage_roles') && m.role !== 'owner' ? (
                  <select
                    value={m.role}
                    onChange={(e) => handleRoleChange(m.userId, m.orgId, e.target.value as OrgRole)}
                    style={{ ...selectStyle, fontSize: 11, padding: '3px 8px' }}
                  >
                    {ORG_ROLES.filter((r) => r !== 'owner').map((r) => (
                      <option key={r} value={r}>{ORG_ROLE_META[r].label}</option>
                    ))}
                  </select>
                ) : (
                  <RoleBadge role={m.role} />
                )}
                {can('team:remove') && m.role !== 'owner' && (
                  <button
                    onClick={() => handleRemove(m)}
                    title="Remove member"
                    style={{ background: 'transparent', border: 'none', color: 'rgba(239,68,68,0.5)', cursor: 'pointer', fontSize: 14, padding: '4px 6px', borderRadius: 6, transition: 'color 0.12s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444' }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(239,68,68,0.5)' }}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Tab: Invitations ──────────────────────────────────────────────────────────

function InvitationsTab() {
  const { activeOrg } = useOrg()
  const { can } = usePermission()
  const [invitations, setInvitations] = useState<OrgInvitation[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!activeOrg) return
    setLoading(true)
    const inv = await getOrgInvitations(activeOrg.id)
    setInvitations(inv)
    setLoading(false)
  }, [activeOrg])

  useEffect(() => { void load() }, [load])

  const handleResend = async (inv: OrgInvitation) => {
    await resendInvitation(inv.id, inv.orgId)
    setInvitations((prev) => prev.map((i) => i.id === inv.id ? { ...i, resentAt: new Date().toISOString() } : i))
  }

  const handleCancel = async (inv: OrgInvitation) => {
    if (!window.confirm(`Cancel invitation to ${inv.email}?`)) return
    await cancelInvitation(inv.id, inv.orgId)
    setInvitations((prev) => prev.filter((i) => i.id !== inv.id))
  }

  function invStatus(inv: OrgInvitation): { label: string; color: string } {
    if (inv.acceptedAt) return { label: 'Accepted', color: '#22c55e' }
    if (inv.declinedAt) return { label: 'Declined', color: '#ef4444' }
    if (new Date(inv.expiresAt) < new Date()) return { label: 'Expired', color: '#f59e0b' }
    return { label: 'Pending', color: '#00c8ff' }
  }

  return (
    <div style={card}>
      <h3 style={sectionTitle}>Invitations</h3>
      {loading ? (
        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>Loading…</div>
      ) : invitations.length === 0 ? (
        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>No invitations yet.</div>
      ) : (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {invitations.map((inv) => {
            const status = invStatus(inv)
            const isPending = !inv.acceptedAt && !inv.declinedAt && new Date(inv.expiresAt) >= new Date()
            return (
              <div key={inv.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{inv.email}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 3, flexWrap: 'wrap' }}>
                    <RoleBadge role={inv.role} />
                    <span style={{ color: status.color, fontSize: 11, fontWeight: 600 }}>● {status.label}</span>
                    <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>Invited {relTime(inv.createdAt)}</span>
                    {inv.resentAt && <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>· Resent {relTime(inv.resentAt)}</span>}
                  </div>
                </div>
                {can('team:invite') && isPending && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => handleResend(inv)} style={{ ...btnGhost, fontSize: 11, padding: '4px 10px' }}>Resend</button>
                    <button onClick={() => handleCancel(inv)} style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Tab: Activity Feed ────────────────────────────────────────────────────────

const ACTIVITY_ICONS: Record<string, string> = {
  member_invited: '📧', member_joined: '👋', member_removed: '🚫',
  role_changed: '🔄', post_approved: '✅', post_rejected: '❌',
  post_published: '🚀', automation_created: '⚡', automation_deleted: '🗑️',
  settings_updated: '⚙️', plan_changed: '💳', org_created: '🏢',
}

function ActivityTab() {
  const { activeOrg } = useOrg()
  const [activity, setActivity] = useState<TeamActivityEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!activeOrg) return
    setLoading(true)
    getOrgActivity(activeOrg.id, 50).then(setActivity).finally(() => setLoading(false))
  }, [activeOrg])

  return (
    <div style={card}>
      <h3 style={sectionTitle}>Team Activity</h3>
      {loading ? (
        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>Loading…</div>
      ) : activity.length === 0 ? (
        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>No activity yet.</div>
      ) : (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 0 }}>
          {activity.map((entry, i) => (
            <div key={entry.id} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: i < activity.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
                {ACTIVITY_ICONS[entry.action] ?? '📋'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>
                  <span style={{ color: '#fff', fontWeight: 600 }}>{entry.actorName ?? 'Someone'}</span>
                  {' '}{entry.action}{entry.entityName ? ` ${entry.entityName}` : ''}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 2 }}>{relTime(entry.createdAt)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Tab: Settings ─────────────────────────────────────────────────────────────

const TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Anchorage', 'Pacific/Honolulu', 'Europe/London', 'Europe/Paris', 'Europe/Berlin',
  'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Kolkata', 'Australia/Sydney',
]

function OrgSettingsTab() {
  const { activeOrg, patchActiveOrg } = useOrg()
  const { can } = usePermission()
  const [settings, setSettings] = useState<OrganizationSettings>(activeOrg?.settings ?? DEFAULT_ORG_SETTINGS)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [deleteInfoShown, setDeleteInfoShown] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await patchActiveOrg({ settings })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
        {children}
      </div>
    )
  }

  const disabled = !can('settings:manage')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={card}>
        <h3 style={sectionTitle}>Organization Settings</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 14 }}>
          <Field label="Default Timezone">
            <select
              value={(settings as unknown as Record<string, string>).timezone ?? 'UTC'}
              onChange={(e) => setSettings((s) => ({ ...s, timezone: e.target.value }) as unknown as OrganizationSettings)}
              disabled={disabled}
              style={selectStyle}
            >
              {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </Field>

          <Field label="Brand Voice">
            <textarea
              value={(settings as unknown as Record<string, string>).brandVoice ?? ''}
              onChange={(e) => setSettings((s) => ({ ...s, brandVoice: e.target.value }) as unknown as OrganizationSettings)}
              disabled={disabled}
              rows={3}
              placeholder="Describe your brand's tone and voice…"
              style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }}
            />
          </Field>

          <Field label="Default Post Language">
            <select
              value={(settings as unknown as Record<string, string>).defaultLanguage ?? 'en'}
              onChange={(e) => setSettings((s) => ({ ...s, defaultLanguage: e.target.value }) as unknown as OrganizationSettings)}
              disabled={disabled}
              style={selectStyle}
            >
              {[['en', 'English'], ['es', 'Spanish'], ['fr', 'French'], ['de', 'German'], ['pt', 'Portuguese'], ['ja', 'Japanese']].map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </Field>

          <Field label="Email Notifications">
            {(['weekly_digest', 'approval_needed', 'post_published'] as const).map((key) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: disabled ? 'default' : 'pointer' }}>
                <input
                  type="checkbox"
                  checked={Boolean((settings as unknown as Record<string, boolean>)[key])}
                  onChange={(e) => setSettings((s) => ({ ...s, [key]: e.target.checked }) as unknown as OrganizationSettings)}
                  disabled={disabled}
                  style={{ accentColor: '#00c8ff', width: 14, height: 14 }}
                />
                <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13 }}>
                  {{ weekly_digest: 'Weekly performance digest', approval_needed: 'Post needs approval', post_published: 'Post published successfully' }[key]}
                </span>
              </label>
            ))}
          </Field>

          {can('settings:manage') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={handleSave} disabled={saving} style={btnPrimary}>
                {saving ? 'Saving…' : 'Save Settings'}
              </button>
              {saved && <span style={{ color: '#22c55e', fontSize: 13 }}>✓ Saved</span>}
            </div>
          )}
        </div>
      </div>

      {/* Danger zone */}
      {can('org:delete') && (
        <div style={{ ...card, border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.04)' }}>
          <h3 style={{ ...sectionTitle, color: '#ef4444' }}>Danger Zone</h3>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, margin: '8px 0 14px' }}>
            Deleting the organization is permanent and cannot be undone.
          </p>
          <button
            onClick={() => setDeleteInfoShown(true)}
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', borderRadius: 8, padding: '8px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
          >
            Delete Organization
          </button>
          {deleteInfoShown && (
            <p style={{ marginTop: 10, fontSize: 13, color: 'rgba(255,255,255,0.65)' }}
               role="status" aria-live="polite">
              ℹ️ Organization deletion requires contacting support at{' '}
              <a href="mailto:support@cbrecycling.org" style={{ color: '#7ec8e3', textDecoration: 'underline' }}>
                support@cbrecycling.org
              </a>
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 12,
  padding: '16px 18px',
}

const sectionTitle: React.CSSProperties = {
  margin: 0,
  color: '#fff',
  fontSize: 14,
  fontWeight: 700,
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8,
  color: '#fff',
  fontSize: 13,
  padding: '8px 12px',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
}

const selectStyle: React.CSSProperties = {
  background: '#1a2235',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8,
  color: '#fff',
  fontSize: 13,
  padding: '8px 12px',
  cursor: 'pointer',
  outline: 'none',
}

const btnPrimary: React.CSSProperties = {
  background: 'linear-gradient(135deg, #0080ff, #00c8ff)',
  border: 'none',
  borderRadius: 8,
  color: '#fff',
  fontSize: 13,
  fontWeight: 700,
  padding: '8px 18px',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

const btnGhost: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8,
  color: 'rgba(255,255,255,0.65)',
  fontSize: 13,
  fontWeight: 600,
  padding: '6px 14px',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

// ── Main component ────────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview',     label: '🏢 Overview'    },
  { id: 'team',         label: '👥 Team'         },
  { id: 'invitations',  label: '📧 Invitations'  },
  { id: 'activity',     label: '📋 Activity'     },
  { id: 'org-settings', label: '⚙️ Settings'     },
] as const

type TabId = typeof TABS[number]['id']

export function OrganizationManager() {
  const { activeOrg, loading } = useOrg()
  const [tab, setTab] = useState<TabId>('overview')

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>
        Loading organization…
      </div>
    )
  }

  if (!activeOrg) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>
        No organization found.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div>
        <h2 style={{ margin: 0, color: '#fff', fontSize: 20, fontWeight: 700 }}>🏢 Team & Organization</h2>
        <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
          Manage your team, invitations, and organization settings
        </p>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 0 }}>
        {TABS.map((t) => {
          const active = t.id === tab
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom: `2px solid ${active ? '#00c8ff' : 'transparent'}`,
                color: active ? '#00c8ff' : 'rgba(255,255,255,0.45)',
                fontSize: 13,
                fontWeight: active ? 700 : 500,
                padding: '8px 14px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
                marginBottom: -1,
              }}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Content */}
      {tab === 'overview'     && <OverviewTab />}
      {tab === 'team'         && <TeamTab />}
      {tab === 'invitations'  && <InvitationsTab />}
      {tab === 'activity'     && <ActivityTab />}
      {tab === 'org-settings' && <OrgSettingsTab />}
    </div>
  )
}
