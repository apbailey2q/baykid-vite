// VendorSustainabilityTracker.tsx
//
// CRUD screen for commercial vendor sustainability records.
// Route: /commercial/vendors
//
// Reads/writes vendor_sustainability_entries for the logged-in commercial
// account. Admins can see all entries regardless of account.

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { supabase } from '../../lib/supabase'

// ── Constants ─────────────────────────────────────────────────────────────────

const TEAL    = '#00c8ff'
const GREEN   = '#4ade80'
const AMBER   = '#fbbf24'
const RED     = '#f87171'
const BG      = 'linear-gradient(180deg,#060e24 0%,#030d1a 100%)'
const CARD_BG = 'rgba(255,255,255,0.04)'
const CARD_BD = 'rgba(255,255,255,0.09)'

const CATEGORIES = [
  { key: 'waste_management',     label: 'Waste Management',       icon: '🗑️' },
  { key: 'recycling_partner',    label: 'Recycling Partner',       icon: '♻️' },
  { key: 'energy',               label: 'Energy',                  icon: '⚡' },
  { key: 'transportation',       label: 'Transportation',          icon: '🚛' },
  { key: 'packaging',            label: 'Packaging',               icon: '📦' },
  { key: 'supply_chain',         label: 'Supply Chain',            icon: '🔗' },
  { key: 'green_certification',  label: 'Green Certification',     icon: '🏅' },
  { key: 'other',                label: 'Other',                   icon: '📋' },
  { key: 'general',              label: 'General',                 icon: '🌿' },
]

const CONTRACT_STATUSES = [
  { key: 'active',        label: 'Active',        color: GREEN },
  { key: 'pending',       label: 'Pending',        color: AMBER },
  { key: 'expired',       label: 'Expired',        color: RED },
  { key: 'cancelled',     label: 'Cancelled',      color: 'rgba(255,255,255,0.4)' },
  { key: 'under_review',  label: 'Under Review',   color: TEAL },
]

// ── Types ─────────────────────────────────────────────────────────────────────

interface VendorEntry {
  id:                        string
  account_id:                string | null
  vendor_name:               string
  vendor_category:           string
  sustainability_contribution: string
  estimated_co2_reduction_lbs: number | null
  certification_name:        string | null
  certification_doc_url:     string | null
  notes:                     string | null
  contract_status:           string
  renewal_date:              string | null
  created_at:                string
  updated_at:                string
}

const EMPTY_FORM: Omit<VendorEntry, 'id' | 'account_id' | 'created_at' | 'updated_at'> = {
  vendor_name:                 '',
  vendor_category:             'general',
  sustainability_contribution: '',
  estimated_co2_reduction_lbs: null,
  certification_name:          null,
  certification_doc_url:       null,
  notes:                       null,
  contract_status:             'active',
  renewal_date:                null,
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function VendorSustainabilityTracker() {
  const navigate        = useNavigate()
  const { user, role }  = useAuthStore()
  const isAdmin         = role === 'admin'

  const [entries,    setEntries]    = useState<VendorEntry[]>([])
  const [accountId,  setAccountId]  = useState<string | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [showForm,   setShowForm]   = useState(false)
  const [editEntry,  setEditEntry]  = useState<VendorEntry | null>(null)
  const [deleteId,   setDeleteId]   = useState<string | null>(null)
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  const [form, setForm] = useState({ ...EMPTY_FORM })

  useEffect(() => {
    if (!user) return
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function loadData() {
    setLoading(true)
    setError(null)

    if (!isAdmin) {
      const { data: acct } = await supabase
        .from('commercial_accounts').select('id').eq('user_id', user!.id).limit(1).single()
      setAccountId(acct?.id ?? null)
    }

    const q = isAdmin
      ? supabase.from('vendor_sustainability_entries').select('*').order('created_at', { ascending: false })
      : supabase.from('vendor_sustainability_entries').select('*').order('created_at', { ascending: false })

    const { data, error: err } = await q
    setLoading(false)
    if (err) { setError(err.message); return }
    setEntries((data ?? []) as VendorEntry[])
  }

  function openNew() {
    setForm({ ...EMPTY_FORM })
    setEditEntry(null)
    setShowForm(true)
  }

  function openEdit(entry: VendorEntry) {
    setForm({
      vendor_name:                 entry.vendor_name,
      vendor_category:             entry.vendor_category,
      sustainability_contribution: entry.sustainability_contribution,
      estimated_co2_reduction_lbs: entry.estimated_co2_reduction_lbs,
      certification_name:          entry.certification_name,
      certification_doc_url:       entry.certification_doc_url,
      notes:                       entry.notes,
      contract_status:             entry.contract_status,
      renewal_date:                entry.renewal_date,
    })
    setEditEntry(entry)
    setShowForm(true)
  }

  async function handleSave() {
    if (!form.vendor_name.trim()) { setError('Vendor name is required.'); return }
    if (!form.sustainability_contribution.trim()) { setError('Sustainability contribution is required.'); return }
    setSaving(true); setError(null)

    const payload = {
      vendor_name:                 form.vendor_name.trim(),
      vendor_category:             form.vendor_category,
      sustainability_contribution: form.sustainability_contribution.trim(),
      estimated_co2_reduction_lbs: form.estimated_co2_reduction_lbs,
      certification_name:          form.certification_name?.trim() || null,
      certification_doc_url:       form.certification_doc_url?.trim() || null,
      notes:                       form.notes?.trim() || null,
      contract_status:             form.contract_status,
      renewal_date:                form.renewal_date || null,
      account_id:                  editEntry?.account_id ?? accountId,
      created_by:                  user!.id,
    }

    let err: { message: string } | null = null
    if (editEntry) {
      const res = await supabase.from('vendor_sustainability_entries').update(payload).eq('id', editEntry.id)
      err = res.error
    } else {
      const res = await supabase.from('vendor_sustainability_entries').insert(payload)
      err = res.error
    }

    setSaving(false)
    if (err) { setError(err.message); return }
    setShowForm(false)
    loadData()
  }

  async function handleDelete() {
    if (!deleteId) return
    setSaving(true)
    await supabase.from('vendor_sustainability_entries').delete().eq('id', deleteId)
    setSaving(false)
    setDeleteId(null)
    loadData()
  }

  function catLabel(key: string) {
    return CATEGORIES.find(c => c.key === key)?.label ?? key
  }
  function catIcon(key: string) {
    return CATEGORIES.find(c => c.key === key)?.icon ?? '📋'
  }
  function statusColor(key: string) {
    return CONTRACT_STATUSES.find(s => s.key === key)?.color ?? 'rgba(255,255,255,0.4)'
  }
  function statusLabel(key: string) {
    return CONTRACT_STATUSES.find(s => s.key === key)?.label ?? key
  }

  const totalCo2 = entries.reduce((s, e) => s + (e.estimated_co2_reduction_lbs ?? 0), 0)
  const activeCount = entries.filter(e => e.contract_status === 'active').length

  return (
    <div className="min-h-screen pb-24" style={{ background: BG }}>

      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 sticky top-0 z-10"
        style={{ background: 'rgba(3,13,26,0.95)', borderBottom: '1px solid rgba(0,200,255,0.12)', backdropFilter: 'blur(12px)' }}>
        <button onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 14, cursor: 'pointer' }}>
          ← Back
        </button>
        <div className="flex-1 text-center">
          <p style={{ fontSize: 10, fontWeight: 700, color: TEAL, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            🌿 Sustainability
          </p>
          <p style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginTop: 1 }}>
            Vendor Tracker
          </p>
        </div>
        <button onClick={openNew}
          style={{
            background: 'rgba(0,200,255,0.15)', border: '1px solid rgba(0,200,255,0.4)',
            color: TEAL, fontSize: 12, fontWeight: 700, borderRadius: 12,
            padding: '6px 14px', cursor: 'pointer',
          }}>
          + Add
        </button>
      </header>

      <div className="px-4 pt-4 pb-6 max-w-lg mx-auto">

        {/* Summary chips */}
        {!loading && entries.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <div style={{ flex: 1, padding: '12px 14px', borderRadius: 16, background: CARD_BG, border: `1px solid ${CARD_BD}` }}>
              <p style={{ fontSize: 20, fontWeight: 900, color: GREEN }}>
                {totalCo2 >= 2000 ? `${(totalCo2 / 2000).toFixed(1)}t` : `${Math.round(totalCo2).toLocaleString()} lbs`}
              </p>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>estimated CO₂ reduction</p>
            </div>
            <div style={{ flex: 1, padding: '12px 14px', borderRadius: 16, background: CARD_BG, border: `1px solid ${CARD_BD}` }}>
              <p style={{ fontSize: 20, fontWeight: 900, color: TEAL }}>{activeCount}</p>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>active vendor partners</p>
            </div>
            <div style={{ flex: 1, padding: '12px 14px', borderRadius: 16, background: CARD_BG, border: `1px solid ${CARD_BD}` }}>
              <p style={{ fontSize: 20, fontWeight: 900, color: AMBER }}>{entries.length}</p>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>total vendor records</p>
            </div>
          </div>
        )}

        {error && (
          <div style={{ padding: '12px 14px', borderRadius: 14, background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: RED, fontSize: 13, marginBottom: 14 }}>
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2"
              style={{ borderColor: TEAL, borderTopColor: 'transparent' }} />
          </div>
        ) : entries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'rgba(255,255,255,0.35)' }}>
            <p style={{ fontSize: 40, marginBottom: 12 }}>🌿</p>
            <p style={{ fontSize: 15, fontWeight: 600 }}>No vendor records yet</p>
            <p style={{ fontSize: 12, marginTop: 4, marginBottom: 20 }}>
              Track your sustainable vendor partnerships here.
            </p>
            <button onClick={openNew}
              style={{
                background: 'rgba(0,200,255,0.15)', border: '1px solid rgba(0,200,255,0.4)',
                color: TEAL, fontSize: 13, fontWeight: 700, borderRadius: 14, padding: '10px 24px', cursor: 'pointer',
              }}>
              Add First Vendor
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {entries.map(entry => (
              <div key={entry.id} style={{ padding: '16px', borderRadius: 18, background: CARD_BG, border: `1px solid ${CARD_BD}` }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                  <div className="flex-1 min-w-0">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <span style={{ fontSize: 16 }}>{catIcon(entry.vendor_category)}</span>
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {entry.vendor_name}
                      </p>
                    </div>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
                      {catLabel(entry.vendor_category)}
                    </p>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.45 }}>
                      {entry.sustainability_contribution}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => openEdit(entry)}
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)', fontSize: 11, borderRadius: 10, padding: '5px 10px', cursor: 'pointer' }}>
                      Edit
                    </button>
                    <button onClick={() => setDeleteId(entry.id)}
                      style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', color: RED, fontSize: 11, borderRadius: 10, padding: '5px 10px', cursor: 'pointer' }}>
                      Delete
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: statusColor(entry.contract_status),
                    background: `${statusColor(entry.contract_status)}18`,
                    border: `1px solid ${statusColor(entry.contract_status)}33`,
                    padding: '3px 8px', borderRadius: 20,
                  }}>
                    {statusLabel(entry.contract_status)}
                  </span>

                  {entry.estimated_co2_reduction_lbs != null && (
                    <span style={{ fontSize: 10, fontWeight: 600, color: GREEN, background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.2)', padding: '3px 8px', borderRadius: 20 }}>
                      {entry.estimated_co2_reduction_lbs >= 2000
                        ? `${(entry.estimated_co2_reduction_lbs / 2000).toFixed(1)}t CO₂`
                        : `${Math.round(entry.estimated_co2_reduction_lbs).toLocaleString()} lbs CO₂`}
                    </span>
                  )}

                  {entry.certification_name && (
                    <span style={{ fontSize: 10, fontWeight: 600, color: AMBER, background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)', padding: '3px 8px', borderRadius: 20 }}>
                      🏅 {entry.certification_name}
                    </span>
                  )}

                  {entry.renewal_date && (
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '3px 8px', borderRadius: 20 }}>
                      Renews {new Date(entry.renewal_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </span>
                  )}
                </div>

                {entry.notes && (
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 8, fontStyle: 'italic' }}>
                    {entry.notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit form modal */}
      {showForm && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'flex-end',
          backdropFilter: 'blur(6px)',
        }} onClick={e => { if (e.target === e.currentTarget) setShowForm(false) }}>
          <div style={{
            width: '100%', maxWidth: 520, margin: '0 auto',
            background: '#0a1628', borderRadius: '24px 24px 0 0',
            border: '1px solid rgba(0,200,255,0.15)', maxHeight: '90vh', overflow: 'auto',
          }}>
            <div style={{ padding: '20px 20px 8px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <p style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>
                {editEntry ? 'Edit Vendor' : 'Add Vendor'}
              </p>
            </div>

            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

              <Field label="Vendor Name *">
                <input value={form.vendor_name} onChange={e => setForm(f => ({ ...f, vendor_name: e.target.value }))}
                  placeholder="Acme Recycling Co." style={INPUT_STYLE} />
              </Field>

              <Field label="Category">
                <select value={form.vendor_category} onChange={e => setForm(f => ({ ...f, vendor_category: e.target.value }))}
                  style={INPUT_STYLE}>
                  {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.icon} {c.label}</option>)}
                </select>
              </Field>

              <Field label="Sustainability Contribution *">
                <textarea value={form.sustainability_contribution}
                  onChange={e => setForm(f => ({ ...f, sustainability_contribution: e.target.value }))}
                  placeholder="Describe how this vendor contributes to sustainability..."
                  rows={3} style={{ ...INPUT_STYLE, resize: 'vertical' }} />
              </Field>

              <Field label="Estimated CO₂ Reduction (lbs/year)">
                <input type="number" min="0" step="0.01"
                  value={form.estimated_co2_reduction_lbs ?? ''}
                  onChange={e => setForm(f => ({ ...f, estimated_co2_reduction_lbs: e.target.value ? parseFloat(e.target.value) : null }))}
                  placeholder="0.00" style={INPUT_STYLE} />
              </Field>

              <Field label="Certification / Standard">
                <input value={form.certification_name ?? ''}
                  onChange={e => setForm(f => ({ ...f, certification_name: e.target.value || null }))}
                  placeholder="e.g. LEED, ISO 14001, B Corp" style={INPUT_STYLE} />
              </Field>

              <Field label="Certification Document URL">
                <input value={form.certification_doc_url ?? ''}
                  onChange={e => setForm(f => ({ ...f, certification_doc_url: e.target.value || null }))}
                  placeholder="https://..." style={INPUT_STYLE} />
              </Field>

              <Field label="Contract Status">
                <select value={form.contract_status} onChange={e => setForm(f => ({ ...f, contract_status: e.target.value }))}
                  style={INPUT_STYLE}>
                  {CONTRACT_STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </Field>

              <Field label="Renewal Date">
                <input type="date" value={form.renewal_date ?? ''}
                  onChange={e => setForm(f => ({ ...f, renewal_date: e.target.value || null }))}
                  style={INPUT_STYLE} />
              </Field>

              <Field label="Notes">
                <textarea value={form.notes ?? ''}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value || null }))}
                  placeholder="Any additional notes..." rows={2}
                  style={{ ...INPUT_STYLE, resize: 'vertical' }} />
              </Field>

              {error && (
                <p style={{ fontSize: 12, color: RED, padding: '8px 12px', background: 'rgba(248,113,113,0.08)', borderRadius: 10, border: '1px solid rgba(248,113,113,0.2)' }}>
                  {error}
                </p>
              )}

              <div style={{ display: 'flex', gap: 10, paddingTop: 4, paddingBottom: 20 }}>
                <button onClick={() => setShowForm(false)}
                  style={{ flex: 1, padding: '13px', borderRadius: 16, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving}
                  style={{ flex: 1.5, padding: '13px', borderRadius: 16, background: saving ? 'rgba(0,200,255,0.1)' : 'rgba(0,200,255,0.2)', border: '1px solid rgba(0,200,255,0.5)', color: TEAL, fontSize: 14, fontWeight: 700, cursor: saving ? 'default' : 'pointer' }}>
                  {saving ? 'Saving…' : (editEntry ? 'Save Changes' : 'Add Vendor')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(6px)' }}>
          <div style={{ background: '#0a1628', borderRadius: 24, padding: '28px 24px', maxWidth: 380, width: '100%', border: '1px solid rgba(248,113,113,0.25)' }}>
            <p style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Delete vendor record?</p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 24 }}>This cannot be undone.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteId(null)}
                style={{ flex: 1, padding: '12px', borderRadius: 14, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleDelete} disabled={saving}
                style={{ flex: 1, padding: '12px', borderRadius: 14, background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.35)', color: RED, fontSize: 14, fontWeight: 700, cursor: saving ? 'default' : 'pointer' }}>
                {saving ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const INPUT_STYLE: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: 12, fontSize: 13,
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
  color: '#fff', outline: 'none', boxSizing: 'border-box',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>{label}</p>
      {children}
    </div>
  )
}
