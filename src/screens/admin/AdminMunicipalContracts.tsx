// AdminMunicipalContracts.tsx — Admin Municipal Contract Editor
//
// MU.2 — Cyan's Brooklynn Recycling Enterprise LLC
//
// Route: /admin/municipal-contracts
//
// Tabs: All | Draft | Pending Review | Active | Expiring Soon | Expired | Cancelled | Needs Review
//
// Admin capabilities:
//   create, edit, change status, renew, cancel, add notes, view history
//
// WARNING (shown in UI):
//   This municipal contract editor records service terms and reporting requirements only.
//   It does not process payments.
//
// Rules:
//   No Stripe, ACH, bank accounts, routing numbers, GPS (CLAUDE.md)
//   No external e-signature services
//   No "BayKid" in user-facing text

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuthStore } from '../../store/authStore'
import type { MunicipalContract, MunicipalContractHistory, MunicipalContractStatus } from '../../types'
import {
  SERVICE_LEVEL_LABELS, PROGRAM_TYPE_LABELS, REPORTING_FREQUENCY_LABELS,
  CONTRACT_STATUS_LABELS, CONTRACT_STATUS_COLORS,
  daysUntilDate, isMunicipalContractExpiringSoon, isMunicipalContractExpired,
} from '../../data/municipalContractData'
import {
  createMunicipalContract, updateMunicipalContract,
  changeMunicipalContractStatus, renewMunicipalContract,
  getMunicipalContractHistory,
} from '../../lib/municipalContracts'

// ── Types ─────────────────────────────────────────────────────────────────────

interface MunicipalProfileOption {
  id:          string
  agency_name: string
  agency_type: string | null
}

type Tab = 'all' | 'draft' | 'pending_review' | 'active' | 'expiring_soon' | 'expired' | 'cancelled' | 'needs_review'

// ── Styles ────────────────────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
  background: 'rgba(0,200,255,0.04)',
  border: '1px solid rgba(0,200,255,0.15)',
  borderRadius: 12,
  padding: '1.25rem',
  marginBottom: '1rem',
}

const INPUT: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(0,200,255,0.2)',
  borderRadius: 8,
  color: '#e0f7ff',
  padding: '0.6rem 0.8rem',
  fontSize: '0.9rem',
  outline: 'none',
  boxSizing: 'border-box',
}

const BTN_PRIMARY: React.CSSProperties = {
  background: 'linear-gradient(135deg,#00c8ff,#0077b6)',
  border: 'none', borderRadius: 8, color: '#fff',
  fontWeight: 700, fontSize: '0.9rem', padding: '0.6rem 1.3rem', cursor: 'pointer',
}

const BTN_SECONDARY: React.CSSProperties = {
  background: 'rgba(0,200,255,0.08)',
  border: '1px solid rgba(0,200,255,0.25)',
  borderRadius: 8, color: '#00c8ff',
  fontWeight: 600, fontSize: '0.85rem', padding: '0.5rem 1rem', cursor: 'pointer',
}

// ── Empty form ────────────────────────────────────────────────────────────────

function emptyForm(profileId = ''): Omit<MunicipalContract, 'id' | 'created_at' | 'updated_at'> {
  return {
    municipal_profile_id:            profileId,
    contract_title:                  'Municipal Recycling Service Agreement',
    agency_name:                     null, agency_type: null,
    service_level:                   'standard',
    program_type:                    'recycling_collection',
    service_zones:                   [], covered_locations: [],
    reporting_frequency:             'monthly',
    council_reporting_required:      false,
    grant_reporting_required:        false,
    public_education_required:       false,
    contamination_threshold_percent: null,
    start_date:                      null, end_date: null, renewal_date: null,
    status:                          'draft',
    estimated_monthly_volume_lbs:    null,
    estimated_annual_diversion_lbs:  null,
    notes:                           null,
    created_by:                      null, updated_by: null,
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminMunicipalContracts() {
  const { user }  = useAuthStore()
  const [contracts, setContracts]   = useState<MunicipalContract[]>([])
  const [profiles, setProfiles]     = useState<MunicipalProfileOption[]>([])
  const [loading, setLoading]       = useState(true)
  const [tab, setTab]               = useState<Tab>('all')
  const [search, setSearch]         = useState('')
  const [toast, setToast]           = useState('')
  const [editingId, setEditingId]   = useState<string | 'new' | null>(null)
  const [form, setForm]             = useState<Omit<MunicipalContract, 'id' | 'created_at' | 'updated_at'>>(emptyForm())
  const [saving, setSaving]         = useState(false)
  const [historyMap, setHistoryMap] = useState<Record<string, MunicipalContractHistory[]>>({})
  const [showHistoryFor, setShowHistoryFor] = useState<string | null>(null)
  // Renew modal state
  const [renewId, setRenewId]       = useState<string | null>(null)
  const [renewDate, setRenewDate]   = useState('')
  const [newEndDate, setNewEndDate] = useState('')
  const [zoneInput, setZoneInput]   = useState('')
  const [locationInput, setLocationInput] = useState('')

  // ── Load ───────────────────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    setLoading(true)
    const [contractRes, profileRes] = await Promise.all([
      supabase.from('municipal_contracts').select('*').order('created_at', { ascending: false }),
      supabase.from('municipal_profiles').select('id, agency_name, agency_type').eq('onboarding_status', 'approved'),
    ])
    setContracts((contractRes.data ?? []) as MunicipalContract[])
    setProfiles((profileRes.data ?? []) as MunicipalProfileOption[])
    setLoading(false)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // ── Toast ──────────────────────────────────────────────────────────────────

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  // ── Tab filtering ──────────────────────────────────────────────────────────

  const filterByTab = (c: MunicipalContract): boolean => {
    if (search && ![c.contract_title, c.agency_name, c.status].some(f => f?.toLowerCase().includes(search.toLowerCase()))) return false
    if (tab === 'all')          return true
    if (tab === 'expiring_soon') return isMunicipalContractExpiringSoon(c)
    return c.status === tab
  }

  const filtered = contracts.filter(filterByTab)

  const tabCount = (t: Tab) => {
    if (t === 'expiring_soon') return contracts.filter(c => isMunicipalContractExpiringSoon(c)).length
    if (t === 'all')           return contracts.length
    return contracts.filter(c => c.status === t).length
  }

  // ── Renewal check ──────────────────────────────────────────────────────────

  const runRenewalCheck = async () => {
    let expired = 0
    const now   = new Date().toISOString().split('T')[0]
    for (const c of contracts) {
      if (c.status === 'active' && c.end_date && c.end_date < now) {
        await changeMunicipalContractStatus(c.id, 'expired', 'Auto-expired by renewal check.', user?.id)
        expired++
      }
    }
    await loadAll()
    showToast(expired > 0 ? `${expired} contract(s) marked expired` : 'No expired contracts found')
  }

  // ── Editor save ────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!form.municipal_profile_id) { showToast('Select a municipal profile first'); return }
    setSaving(true)
    if (editingId === 'new') {
      const res = await createMunicipalContract({ ...form, created_by: user?.id })
      if (res.ok) {
        showToast('Contract created')
        setContracts(prev => [res.data!, ...prev])
        setEditingId(null)
      } else {
        showToast(`Error: ${res.error}`)
      }
    } else if (editingId) {
      const res = await updateMunicipalContract(editingId, form, user?.id)
      if (res.ok) {
        showToast('Contract saved')
        setContracts(prev => prev.map(c => c.id === editingId ? res.data! : c))
        setEditingId(null)
      } else {
        showToast(`Error: ${res.error}`)
      }
    }
    setSaving(false)
  }

  const openNew = () => {
    setForm(emptyForm())
    setZoneInput('')
    setLocationInput('')
    setEditingId('new')
  }

  const openEdit = (c: MunicipalContract) => {
    setForm({ ...c })
    setZoneInput('')
    setLocationInput('')
    setEditingId(c.id)
  }

  // ── History ────────────────────────────────────────────────────────────────

  const toggleHistory = async (contractId: string) => {
    if (showHistoryFor === contractId) { setShowHistoryFor(null); return }
    if (!historyMap[contractId]) {
      const res = await getMunicipalContractHistory(contractId)
      if (res.ok) setHistoryMap(prev => ({ ...prev, [contractId]: res.data! }))
    }
    setShowHistoryFor(contractId)
  }

  // ── Status actions ─────────────────────────────────────────────────────────

  const changeStatus = async (contractId: string, status: MunicipalContractStatus, note?: string) => {
    const res = await changeMunicipalContractStatus(contractId, status, note, user?.id)
    if (res.ok) {
      setContracts(prev => prev.map(c => c.id === contractId ? { ...c, status } : c))
      showToast(`Status → ${CONTRACT_STATUS_LABELS[status]}`)
    } else {
      showToast(`Error: ${res.error}`)
    }
  }

  const handleRenew = async () => {
    if (!renewId || !renewDate || !newEndDate) return
    const res = await renewMunicipalContract(renewId, renewDate, newEndDate, user?.id)
    if (res.ok) {
      setContracts(prev => prev.map(c => c.id === renewId ? res.data! : c))
      showToast('Contract renewed')
      setRenewId(null)
    } else {
      showToast(`Error: ${res.error}`)
    }
  }

  // ── Form helpers ──────────────────────────────────────────────────────────

  const fset = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const val = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value
    setForm(f => ({ ...f, [field]: val }))
  }

  const fnum = (field: 'estimated_monthly_volume_lbs' | 'estimated_annual_diversion_lbs' | 'contamination_threshold_percent') =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value === '' ? null : parseFloat(e.target.value)
      setForm(f => ({ ...f, [field]: v }))
    }

  const addZone     = () => { if (zoneInput.trim()) { setForm(f => ({ ...f, service_zones: [...f.service_zones, zoneInput.trim()] })); setZoneInput('') } }
  const removeZone  = (z: string) => setForm(f => ({ ...f, service_zones: f.service_zones.filter(x => x !== z) }))
  const addLocation = () => { if (locationInput.trim()) { setForm(f => ({ ...f, covered_locations: [...f.covered_locations, locationInput.trim()] })); setLocationInput('') } }
  const removeLocation = (l: string) => setForm(f => ({ ...f, covered_locations: f.covered_locations.filter(x => x !== l) }))

  const TABS: { key: Tab; label: string }[] = [
    { key: 'all',           label: 'All' },
    { key: 'draft',         label: 'Draft' },
    { key: 'pending_review',label: 'Pending Review' },
    { key: 'active',        label: 'Active' },
    { key: 'expiring_soon', label: 'Expiring Soon' },
    { key: 'expired',       label: 'Expired' },
    { key: 'cancelled',     label: 'Cancelled' },
    { key: 'needs_review',  label: 'Needs Review' },
  ]

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: '#060e24', color: '#e0f7ff', padding: '1.5rem' }}>
      <div style={{ maxWidth: 1040, margin: '0 auto' }}>

        {/* Toast */}
        {toast && (
          <div style={{ position: 'fixed', top: 24, right: 24, zIndex: 1000, background: '#1e293b', border: '1px solid #4ade80', borderRadius: 8, color: '#4ade80', padding: '0.65rem 1.25rem', fontWeight: 600, fontSize: '0.9rem', boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>
            ✓ {toast}
          </div>
        )}

        {/* Header */}
        <div style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#7ec8e3', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
              Cyan's Brooklynn Recycling Enterprise LLC — Admin
            </div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#e0f7ff', margin: 0 }}>
              📄 Municipal Contracts
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={runRenewalCheck} style={BTN_SECONDARY}>🔍 Run Renewal Check</button>
            <button onClick={openNew} style={BTN_PRIMARY}>+ New Contract</button>
          </div>
        </div>

        {/* Warning banner */}
        <div style={{ ...CARD, borderColor: 'rgba(255,214,0,0.25)', background: 'rgba(255,214,0,0.04)', marginBottom: '1.25rem', fontSize: '0.82rem', color: '#FFD600' }}>
          ⚠️ This municipal contract editor records service terms and reporting requirements only. It does not process payments.
        </div>

        {/* Search + summary chips */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'center' }}>
          {[{label: 'Total', count: contracts.length}, {label: 'Active', count: tabCount('active')}, {label: 'Expiring', count: tabCount('expiring_soon')}, {label: 'Expired', count: tabCount('expired')}].map(s => (
            <div key={s.label} style={{ padding: '3px 10px', borderRadius: 20, fontSize: '0.8rem', fontWeight: 600, background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.2)', color: '#7ec8e3' }}>
              {s.label}: {s.count}
            </div>
          ))}
          <div style={{ marginLeft: 'auto' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(0,200,255,0.2)', borderRadius: 8, color: '#e0f7ff', padding: '0.4rem 0.8rem', fontSize: '0.85rem', outline: 'none' }} />
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid rgba(0,200,255,0.15)', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem 0.9rem', color: tab === t.key ? '#00c8ff' : '#64748b', fontWeight: tab === t.key ? 700 : 500, fontSize: '0.85rem', borderBottom: tab === t.key ? '2px solid #00c8ff' : '2px solid transparent' }}>
              {t.label} ({tabCount(t.key)})
            </button>
          ))}
        </div>

        {/* Editor modal */}
        {editingId && (
          <div style={{ ...CARD, borderColor: 'rgba(0,200,255,0.35)', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ color: '#00c8ff', fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>
                {editingId === 'new' ? '+ New Municipal Contract' : '✏️ Edit Contract'}
              </h2>
              <button onClick={() => setEditingId(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
              <FormField label="Municipal Profile *">
                <select style={INPUT} value={form.municipal_profile_id} onChange={fset('municipal_profile_id')}>
                  <option value="">Select approved agency…</option>
                  {profiles.map(p => <option key={p.id} value={p.id}>{p.agency_name}</option>)}
                </select>
              </FormField>

              <FormField label="Contract Title">
                <input style={INPUT} value={form.contract_title ?? ''} onChange={fset('contract_title')} />
              </FormField>

              <FormField label="Service Level">
                <select style={INPUT} value={form.service_level} onChange={fset('service_level')}>
                  {Object.entries(SERVICE_LEVEL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </FormField>

              <FormField label="Program Type">
                <select style={INPUT} value={form.program_type} onChange={fset('program_type')}>
                  {Object.entries(PROGRAM_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </FormField>

              <FormField label="Reporting Frequency">
                <select style={INPUT} value={form.reporting_frequency} onChange={fset('reporting_frequency')}>
                  {Object.entries(REPORTING_FREQUENCY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </FormField>

              <FormField label="Status">
                <select style={INPUT} value={form.status} onChange={fset('status')}>
                  {Object.entries(CONTRACT_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </FormField>

              <FormField label="Start Date">
                <input style={INPUT} type="date" value={form.start_date ?? ''} onChange={fset('start_date')} />
              </FormField>

              <FormField label="End Date">
                <input style={INPUT} type="date" value={form.end_date ?? ''} onChange={fset('end_date')} />
              </FormField>

              <FormField label="Renewal Date">
                <input style={INPUT} type="date" value={form.renewal_date ?? ''} onChange={fset('renewal_date')} />
              </FormField>

              <FormField label="Contamination Threshold (%)">
                <input style={INPUT} type="number" min="0" max="100" step="0.1"
                  value={form.contamination_threshold_percent ?? ''}
                  onChange={fnum('contamination_threshold_percent')} placeholder="e.g. 5.0" />
              </FormField>

              <FormField label="Est. Monthly Volume (lbs)">
                <input style={INPUT} type="number" min="0"
                  value={form.estimated_monthly_volume_lbs ?? ''}
                  onChange={fnum('estimated_monthly_volume_lbs')} />
              </FormField>

              <FormField label="Est. Annual Diversion (lbs)">
                <input style={INPUT} type="number" min="0"
                  value={form.estimated_annual_diversion_lbs ?? ''}
                  onChange={fnum('estimated_annual_diversion_lbs')} />
              </FormField>
            </div>

            {/* Checkboxes */}
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginTop: '1rem' }}>
              {([
                ['council_reporting_required', 'Council Reporting Required'],
                ['grant_reporting_required',   'Grant Reporting Required'],
                ['public_education_required',  'Public Education Required'],
              ] as [keyof typeof form, string][]).map(([field, label]) => (
                <label key={field} style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', fontSize: '0.88rem' }}>
                  <input type="checkbox" checked={!!form[field]} onChange={fset(field)} />
                  <span style={{ color: '#e0f7ff' }}>{label}</span>
                </label>
              ))}
            </div>

            {/* Service zones */}
            <div style={{ marginTop: '1rem' }}>
              <div style={{ color: '#7ec8e3', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>Service Zones</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                <input style={{ ...INPUT, flex: 1 }} value={zoneInput} onChange={e => setZoneInput(e.target.value)}
                  placeholder="Add zone…" onKeyDown={e => e.key === 'Enter' && addZone()} />
                <button onClick={addZone} style={BTN_SECONDARY}>Add</button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {form.service_zones.map(z => (
                  <span key={z} onClick={() => removeZone(z)} style={{ background: 'rgba(0,200,255,0.1)', border: '1px solid rgba(0,200,255,0.25)', borderRadius: 6, color: '#00c8ff', fontSize: '0.8rem', padding: '2px 8px', cursor: 'pointer' }}>
                    {z} ✕
                  </span>
                ))}
              </div>
            </div>

            {/* Covered locations */}
            <div style={{ marginTop: '1rem' }}>
              <div style={{ color: '#7ec8e3', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>Covered Locations</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                <input style={{ ...INPUT, flex: 1 }} value={locationInput} onChange={e => setLocationInput(e.target.value)}
                  placeholder="Add location…" onKeyDown={e => e.key === 'Enter' && addLocation()} />
                <button onClick={addLocation} style={BTN_SECONDARY}>Add</button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {form.covered_locations.map(l => (
                  <span key={l} onClick={() => removeLocation(l)} style={{ background: 'rgba(0,200,255,0.1)', border: '1px solid rgba(0,200,255,0.25)', borderRadius: 6, color: '#00c8ff', fontSize: '0.8rem', padding: '2px 8px', cursor: 'pointer' }}>
                    {l} ✕
                  </span>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div style={{ marginTop: '1rem' }}>
              <div style={{ color: '#7ec8e3', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>Notes</div>
              <textarea style={{ ...INPUT, minHeight: 80, resize: 'vertical' }} value={form.notes ?? ''} onChange={fset('notes')} placeholder="Internal notes…" />
            </div>

            {/* Save */}
            <div style={{ display: 'flex', gap: 10, marginTop: '1.25rem' }}>
              <button onClick={handleSave} disabled={saving} style={{ ...BTN_PRIMARY, opacity: saving ? 0.6 : 1 }}>
                {saving ? '…Saving' : editingId === 'new' ? 'Create Contract' : 'Save Changes'}
              </button>
              <button onClick={() => setEditingId(null)} style={BTN_SECONDARY}>Cancel</button>
            </div>
          </div>
        )}

        {/* Renew modal */}
        {renewId && (
          <div style={{ ...CARD, borderColor: 'rgba(74,222,128,0.3)', background: 'rgba(74,222,128,0.04)', marginBottom: '1.25rem' }}>
            <h3 style={{ color: '#4ade80', margin: '0 0 0.75rem 0', fontSize: '0.95rem' }}>↺ Renew Contract</h3>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <FormField label="Renewal Note Date">
                <input style={{ ...INPUT, width: 180 }} type="date" value={renewDate} onChange={e => setRenewDate(e.target.value)} />
              </FormField>
              <FormField label="New End Date">
                <input style={{ ...INPUT, width: 180 }} type="date" value={newEndDate} onChange={e => setNewEndDate(e.target.value)} />
              </FormField>
              <button onClick={handleRenew} style={{ ...BTN_PRIMARY, background: 'linear-gradient(135deg,#4ade80,#22c55e)' }}>Confirm Renewal</button>
              <button onClick={() => setRenewId(null)} style={BTN_SECONDARY}>Cancel</button>
            </div>
          </div>
        )}

        {/* Contract list */}
        {loading ? (
          <div style={{ color: '#00c8ff', padding: '2rem 0' }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ color: '#64748b', textAlign: 'center', padding: '3rem 0' }}>
            No contracts in this view.
          </div>
        ) : (
          filtered.map(contract => {
            const st     = CONTRACT_STATUS_COLORS[contract.status] ?? CONTRACT_STATUS_COLORS.draft
            const expiring = isMunicipalContractExpiringSoon(contract)
            const expired  = isMunicipalContractExpired(contract)
            const days     = daysUntilDate(contract.end_date)
            const hist     = historyMap[contract.id]

            return (
              <div key={contract.id} style={{ ...CARD, borderColor: expiring ? 'rgba(255,214,0,0.3)' : expired ? 'rgba(248,113,113,0.25)' : 'rgba(0,200,255,0.15)' }}>
                {/* Header row */}
                <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, color: '#e0f7ff', fontSize: '0.95rem' }}>{contract.contract_title}</span>
                      <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '2px 8px', borderRadius: 20, color: st.color, background: st.bg, border: `1px solid ${st.color}44` }}>
                        {CONTRACT_STATUS_LABELS[contract.status]}
                      </span>
                      {expiring && <span style={{ fontSize: '0.72rem', color: '#FFD600', background: 'rgba(255,214,0,0.1)', padding: '2px 6px', borderRadius: 4, border: '1px solid rgba(255,214,0,0.3)' }}>⚠ Expiring Soon</span>}
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: '0.84rem' }}>
                      {contract.agency_name ?? '—'} · {SERVICE_LEVEL_LABELS[contract.service_level]} · {PROGRAM_TYPE_LABELS[contract.program_type]}
                    </div>
                    <div style={{ color: '#64748b', fontSize: '0.78rem', marginTop: 2 }}>
                      {contract.start_date ?? '?'} → {contract.end_date ?? '?'}
                      {days !== null && ` · ${days >= 0 ? `${days}d remaining` : `${Math.abs(days)}d past end`}`}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <ABtn label="✏️ Edit"    color="#00c8ff"  onClick={() => openEdit(contract)} />
                    {contract.status === 'draft'          && <ABtn label="→ Review"  color="#a78bfa" onClick={() => changeStatus(contract.id, 'pending_review')} />}
                    {contract.status === 'pending_review' && <ABtn label="✓ Activate" color="#4ade80" onClick={() => changeStatus(contract.id, 'active')} />}
                    {contract.status === 'active'         && <ABtn label="↺ Renew"   color="#4ade80" onClick={() => { setRenewId(contract.id); setRenewDate(''); setNewEndDate('') }} />}
                    {contract.status === 'active'         && <ABtn label="⚠ Review"  color="#fb923c" onClick={() => changeStatus(contract.id, 'needs_review')} />}
                    {contract.status !== 'cancelled'      && <ABtn label="✕ Cancel"  color="#f87171" onClick={() => changeStatus(contract.id, 'cancelled', 'Cancelled by admin.')} />}
                    <ABtn label={showHistoryFor === contract.id ? '▲ History' : '▼ History'} color="#7ec8e3" onClick={() => toggleHistory(contract.id)} />
                  </div>
                </div>

                {/* History */}
                {showHistoryFor === contract.id && (
                  <div style={{ marginTop: '1rem', borderTop: '1px solid rgba(0,200,255,0.1)', paddingTop: '1rem' }}>
                    <div style={{ color: '#7ec8e3', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>History</div>
                    {!hist || hist.length === 0
                      ? <p style={{ color: '#64748b', fontSize: '0.82rem' }}>No history records.</p>
                      : hist.map(h => (
                          <div key={h.id} style={{ display: 'flex', gap: 12, fontSize: '0.82rem', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: 6, marginBottom: 6 }}>
                            <span style={{ color: '#7ec8e3', flexShrink: 0, minWidth: 90, fontSize: '0.75rem' }}>
                              {new Date(h.created_at).toLocaleDateString()}
                            </span>
                            <div>
                              <span style={{ color: '#e0f7ff', fontWeight: 600, textTransform: 'capitalize' }}>{h.action_type.replace(/_/g, ' ')}</span>
                              {h.change_summary && <div style={{ color: '#94a3b8', marginTop: 2 }}>{h.change_summary}</div>}
                            </div>
                          </div>
                        ))
                    }
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ABtn({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ background: `${color}18`, border: `1px solid ${color}44`, borderRadius: 6, color, fontWeight: 600, fontSize: '0.76rem', padding: '0.3rem 0.7rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
      {label}
    </button>
  )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', color: '#7ec8e3', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  )
}
