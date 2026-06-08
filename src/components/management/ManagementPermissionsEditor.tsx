// ManagementPermissionsEditor.tsx — Admin-only permission toggle editor
//
// Phase MG.3 — Cyan's Brooklynn Recycling Enterprise LLC
//
// Edits management_permissions for a specific management profile.
// Upserts the record and creates a management_admin_actions audit entry.
// Shows warnings for high-privilege permissions (finances, users, compliance).
//
// Usage:
//   <ManagementPermissionsEditor
//     profileId={profile.id}
//     adminUserId={currentUser?.id}
//     onSaved={() => reload()}
//   />

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabaseClient'

const BRAND        = '#00c8ff'
const BRAND_DIM    = 'rgba(0,200,255,0.10)'
const BRAND_BORDER = 'rgba(0,200,255,0.28)'
const WARN_COLOR   = '#fbbf24'
const DANGER_COLOR = '#f87171'

// ── Permission definitions ────────────────────────────────────────────────────

interface PermDef {
  key:      string
  label:    string
  group:    'view' | 'operations' | 'manage' | 'reports'
  warning?: string
}

const PERMISSION_DEFS: PermDef[] = [
  // View
  { key: 'can_view_consumers',   label: 'View Consumers',   group: 'view' },
  { key: 'can_view_drivers',     label: 'View Drivers',     group: 'view' },
  { key: 'can_view_commercial',  label: 'View Commercial',  group: 'view' },
  { key: 'can_view_warehouses',  label: 'View Warehouses',  group: 'view' },
  { key: 'can_view_fundraisers', label: 'View Fundraisers', group: 'view' },
  // Operations
  { key: 'can_assign_routes',    label: 'Assign Routes',    group: 'operations' },
  { key: 'can_dispatch_drivers', label: 'Dispatch Drivers', group: 'operations' },
  // Manage
  {
    key: 'can_manage_finances',
    label: 'Manage Finances',
    group: 'manage',
    warning: 'Grants access to payout ledger, earnings records, and financial reports. Only assign to authorized finance personnel.',
  },
  {
    key: 'can_manage_compliance',
    label: 'Manage Compliance',
    group: 'manage',
    warning: 'Allows reviewing and approving driver compliance records, incident investigations, and OSHA documentation.',
  },
  {
    key: 'can_manage_users',
    label: 'Manage Users',
    group: 'manage',
    warning: 'Grants ability to modify user account settings and approval statuses. High-privilege — assign with care.',
  },
  { key: 'can_manage_training',  label: 'Manage Training',  group: 'manage' },
  // Reports
  { key: 'can_view_reports',     label: 'View Reports',     group: 'reports' },
]

const GROUP_LABELS: Record<string, string> = {
  view:       'Data Access (View Only)',
  operations: 'Operations',
  manage:     'Administration',
  reports:    'Reports',
}

const GROUPS = ['view', 'operations', 'manage', 'reports'] as const

type PermKey = typeof PERMISSION_DEFS[number]['key']
type PermState = Record<PermKey, boolean>

const DEFAULT_PERMS: PermState = PERMISSION_DEFS.reduce<PermState>((acc, d) => {
  acc[d.key] = false
  return acc
}, {} as PermState)

// ── Component ─────────────────────────────────────────────────────────────────

interface ManagementPermissionsEditorProps {
  profileId:    string
  adminUserId?: string
  onSaved?:     () => void
  compact?:     boolean  // condensed display for use inside roster cards
}

export default function ManagementPermissionsEditor({
  profileId,
  adminUserId,
  onSaved,
  compact = false,
}: ManagementPermissionsEditorProps) {
  const [perms,     setPerms]     = useState<PermState>(DEFAULT_PERMS)
  const [permId,    setPermId]    = useState<string | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [saved,     setSaved]     = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [dirty,     setDirty]     = useState(false)

  // ── Load existing permissions ──────────────────────────────────────────────
  const loadPerms = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: loadErr } = await supabase
        .from('management_permissions')
        .select('*')
        .eq('management_profile_id', profileId)
        .maybeSingle()

      if (loadErr) throw loadErr

      if (data) {
        setPermId(data.id as string)
        const loaded: PermState = { ...DEFAULT_PERMS }
        PERMISSION_DEFS.forEach(d => {
          loaded[d.key] = Boolean((data as Record<string, unknown>)[d.key])
        })
        setPerms(loaded)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load permissions')
    } finally {
      setLoading(false)
      setDirty(false)
    }
  }, [profileId])

  useEffect(() => { loadPerms() }, [loadPerms])

  // ── Toggle ─────────────────────────────────────────────────────────────────
  function toggle(key: PermKey) {
    setPerms(prev => ({ ...prev, [key]: !prev[key] }))
    setDirty(true)
    setSaved(false)
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  async function save() {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const payload: Record<string, unknown> = {
        management_profile_id: profileId,
        ...perms,
      }

      let newId = permId
      if (permId) {
        const { error: upErr } = await supabase
          .from('management_permissions')
          .update(payload)
          .eq('id', permId)
        if (upErr) throw upErr
      } else {
        const { data: ins, error: insErr } = await supabase
          .from('management_permissions')
          .insert(payload)
          .select('id')
          .single()
        if (insErr) throw insErr
        newId = ins.id as string
        setPermId(newId)
      }

      // Audit log
      await supabase
        .from('management_admin_actions')
        .insert({
          management_profile_id: profileId,
          admin_user_id:         adminUserId ?? null,
          action_type:           'permissions_updated',
          metadata:              { permissions: perms, permissions_record_id: newId },
        })

      setDirty(false)
      setSaved(true)
      onSaved?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4" style={{ color: 'rgba(255,255,255,0.4)' }}>
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-t-transparent"
          style={{ borderColor: BRAND, borderTopColor: 'transparent' }} />
        <span className="text-xs">Loading permissions…</span>
      </div>
    )
  }

  return (
    <div className={compact ? '' : 'rounded-2xl p-5'} style={compact ? {} : { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
      {!compact && (
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-bold text-white">Permission Editor</p>
          <span className="text-xs px-2 py-0.5 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}>
            Admin Only
          </span>
        </div>
      )}

      {error && (
        <div className="p-2 rounded-lg text-xs mb-3" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }}>
          {error}
        </div>
      )}

      <div className={compact ? 'space-y-3' : 'space-y-4'}>
        {GROUPS.map(group => {
          const defs = PERMISSION_DEFS.filter(d => d.group === group)
          return (
            <div key={group}>
              <p className="text-xs font-bold mb-2 tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {GROUP_LABELS[group].toUpperCase()}
              </p>
              <div className="space-y-1.5">
                {defs.map(def => {
                  const active = perms[def.key]
                  const isHighPriv = !!def.warning
                  return (
                    <div key={def.key}>
                      <label
                        className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl cursor-pointer transition-all"
                        style={{
                          background: active
                            ? isHighPriv ? 'rgba(251,191,36,0.08)' : BRAND_DIM
                            : 'rgba(255,255,255,0.02)',
                          border: `1px solid ${active ? (isHighPriv ? 'rgba(251,191,36,0.3)' : BRAND_BORDER) : 'rgba(255,255,255,0.06)'}`,
                        }}
                      >
                        <div className="flex items-center gap-2">
                          {isHighPriv && (
                            <span className="text-xs" style={{ color: active ? WARN_COLOR : 'rgba(255,255,255,0.3)' }}>⚠️</span>
                          )}
                          <span className="text-sm" style={{ color: active ? 'white' : 'rgba(255,255,255,0.55)' }}>
                            {def.label}
                          </span>
                        </div>
                        <button
                          onClick={() => toggle(def.key)}
                          className="shrink-0 relative w-9 h-5 rounded-full transition-all"
                          style={{
                            background: active
                              ? isHighPriv ? WARN_COLOR : BRAND
                              : 'rgba(255,255,255,0.12)',
                          }}
                        >
                          <span
                            className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                            style={{ left: active ? '18px' : '2px' }}
                          />
                        </button>
                      </label>
                      {active && def.warning && (
                        <p className="text-xs mt-1 px-3" style={{ color: `${WARN_COLOR}90` }}>
                          ⚠️ {def.warning}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* High-privilege global warning */}
      {(perms['can_manage_finances'] || perms['can_manage_users']) && (
        <div className="mt-4 p-3 rounded-xl text-xs"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: DANGER_COLOR }}>
          <strong>High-privilege permissions enabled.</strong> Finance and user management access
          should be granted only to specifically authorized personnel and reviewed quarterly.
          These permissions are logged in the admin audit trail.
        </div>
      )}

      {/* Save row */}
      <div className="flex items-center justify-between mt-4 gap-3">
        <button
          onClick={loadPerms}
          disabled={saving || !dirty}
          className="px-4 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-30"
          style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          Reset
        </button>
        <div className="flex items-center gap-3">
          {saved && (
            <span className="text-xs" style={{ color: '#4ade80' }}>✅ Saved</span>
          )}
          <button
            onClick={save}
            disabled={saving || !dirty}
            className="px-5 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-35"
            style={{ background: dirty ? BRAND : 'rgba(255,255,255,0.1)', color: dirty ? '#000' : 'rgba(255,255,255,0.3)' }}
          >
            {saving ? 'Saving…' : 'Save Permissions'}
          </button>
        </div>
      </div>
    </div>
  )
}
