// AdminMunicipalReporting.tsx — Admin Municipal Reporting Management
//
// MU.2 — Cyan's Brooklynn Recycling Enterprise LLC
//
// Route: /admin/municipal-reporting
//
// Admin can:
//   create reporting requirement, edit, pause, complete,
//   view upcoming reports, view by agency, view by report type
//
// Rules: No Stripe/ACH/bank/routing/GPS. No "BayKid" in user-facing text.

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabaseClient'
import type { MunicipalReportingRequirement } from '../../types'
import {
  REPORT_TYPE_LABELS, REPORTING_FREQUENCY_LABELS,
  COMMON_REPORTING_METRICS,
} from '../../data/municipalContractData'
import { daysUntilDate } from '../../data/municipalContractData'
import {
  createMunicipalReportingRequirement,
  updateMunicipalReportingRequirement,
  pauseMunicipalReportingRequirement,
  completeMunicipalReportingRequirement,
  getUpcomingMunicipalReports,
} from '../../lib/municipalReporting'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProfileOption { id: string; agency_name: string }
interface ContractOption { id: string; contract_title: string; municipal_profile_id: string }

type GroupBy = 'all' | 'agency' | 'type' | 'upcoming'

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
  borderRadius: 8, color: '#e0f7ff',
  padding: '0.55rem 0.8rem', fontSize: '0.88rem',
  outline: 'none', boxSizing: 'border-box',
}

const BTN_P: React.CSSProperties = {
  background: 'linear-gradient(135deg,#00c8ff,#0077b6)',
  border: 'none', borderRadius: 8, color: '#fff',
  fontWeight: 700, fontSize: '0.88rem', padding: '0.55rem 1.2rem', cursor: 'pointer',
}

const BTN_S: React.CSSProperties = {
  background: 'rgba(0,200,255,0.08)',
  border: '1px solid rgba(0,200,255,0.25)',
  borderRadius: 8, color: '#00c8ff',
  fontWeight: 600, fontSize: '0.82rem', padding: '0.4rem 0.9rem', cursor: 'pointer',
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminMunicipalReporting() {
  const [reqs, setReqs]         = useState<MunicipalReportingRequirement[]>([])
  const [profiles, setProfiles] = useState<ProfileOption[]>([])
  const [contracts, setContracts] = useState<ContractOption[]>([])
  const [upcoming, setUpcoming]   = useState<MunicipalReportingRequirement[]>([])
  const [loading, setLoading]     = useState(true)
  const [groupBy, setGroupBy]     = useState<GroupBy>('all')
  const [search, setSearch]       = useState('')
  const [toast, setToast]         = useState('')
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [saving, setSaving]       = useState(false)
  const [form, setForm]           = useState({
    municipal_profile_id: '', contract_id: '', report_title: '',
    report_type: 'council_report', frequency: 'monthly',
    next_due_date: '', notes: '',
    required_metrics: [] as string[],
  })

  // ── Load ───────────────────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    setLoading(true)
    const [reqRes, profRes, contractRes, upcomingRes] = await Promise.all([
      supabase.from('municipal_reporting_requirements').select('*').order('next_due_date', { ascending: true }),
      supabase.from('municipal_profiles').select('id, agency_name'),
      supabase.from('municipal_contracts').select('id, contract_title, municipal_profile_id').eq('status', 'active'),
      getUpcomingMunicipalReports(30),
    ])
    setReqs((reqRes.data ?? []) as MunicipalReportingRequirement[])
    setProfiles((profRes.data ?? []) as ProfileOption[])
    setContracts((contractRes.data ?? []) as ContractOption[])
    if (upcomingRes.ok) setUpcoming(upcomingRes.data!)
    setLoading(false)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  // ── Filtering ──────────────────────────────────────────────────────────────

  const filtered = reqs.filter(r => {
    if (search && ![r.report_title, r.report_type, r.status].some(f => f?.toLowerCase().includes(search.toLowerCase()))) return false
    return true
  })

  // ── Grouping ───────────────────────────────────────────────────────────────

  const grouped: Record<string, MunicipalReportingRequirement[]> = {}
  if (groupBy === 'agency') {
    for (const r of filtered) {
      const pName = profiles.find(p => p.id === r.municipal_profile_id)?.agency_name ?? r.municipal_profile_id
      ;(grouped[pName] ??= []).push(r)
    }
  } else if (groupBy === 'type') {
    for (const r of filtered) {
      const tName = REPORT_TYPE_LABELS[r.report_type] ?? r.report_type
      ;(grouped[tName] ??= []).push(r)
    }
  } else if (groupBy === 'upcoming') {
    grouped['Upcoming (30 days)'] = upcoming
  } else {
    grouped['All Requirements'] = filtered
  }

  // ── Save form ─────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!form.municipal_profile_id || !form.report_title || !form.report_type) {
      showToast('Profile, title, and type are required'); return
    }
    setSaving(true)
    if (editingId === 'new') {
      const res = await createMunicipalReportingRequirement({
        municipal_profile_id: form.municipal_profile_id,
        contract_id:          form.contract_id || null,
        report_title:         form.report_title,
        report_type:          form.report_type,
        frequency:            form.frequency,
        next_due_date:        form.next_due_date || null,
        notes:                form.notes || null,
        required_metrics:     form.required_metrics,
      })
      if (res.ok) { setReqs(p => [...p, res.data!]); showToast('Requirement created'); setEditingId(null) }
      else        showToast(`Error: ${res.error}`)
    } else if (editingId) {
      const res = await updateMunicipalReportingRequirement(editingId, {
        report_title:     form.report_title,
        report_type:      form.report_type as MunicipalReportingRequirement['report_type'],
        frequency:        form.frequency as MunicipalReportingRequirement['frequency'],
        next_due_date:    form.next_due_date || null,
        notes:            form.notes || null,
        required_metrics: form.required_metrics,
      })
      if (res.ok) { setReqs(p => p.map(r => r.id === editingId ? res.data! : r)); showToast('Saved'); setEditingId(null) }
      else        showToast(`Error: ${res.error}`)
    }
    setSaving(false)
  }

  const openNew = () => {
    setForm({ municipal_profile_id: '', contract_id: '', report_title: '', report_type: 'council_report', frequency: 'monthly', next_due_date: '', notes: '', required_metrics: [] })
    setEditingId('new')
  }

  const openEdit = (r: MunicipalReportingRequirement) => {
    setForm({ municipal_profile_id: r.municipal_profile_id, contract_id: r.contract_id ?? '', report_title: r.report_title, report_type: r.report_type, frequency: r.frequency, next_due_date: r.next_due_date ?? '', notes: r.notes ?? '', required_metrics: [...r.required_metrics] })
    setEditingId(r.id)
  }

  const pause = async (id: string) => {
    const res = await pauseMunicipalReportingRequirement(id)
    if (res.ok) { setReqs(p => p.map(r => r.id === id ? res.data! : r)); showToast('Paused') }
  }

  const complete = async (id: string) => {
    const res = await completeMunicipalReportingRequirement(id)
    if (res.ok) { setReqs(p => p.map(r => r.id === id ? res.data! : r)); showToast('Marked completed') }
  }

  const reactivate = async (id: string) => {
    const res = await updateMunicipalReportingRequirement(id, { status: 'active' })
    if (res.ok) { setReqs(p => p.map(r => r.id === id ? res.data! : r)); showToast('Reactivated') }
  }

  const toggleMetric = (m: string) => {
    setForm(f => ({
      ...f,
      required_metrics: f.required_metrics.includes(m)
        ? f.required_metrics.filter(x => x !== m)
        : [...f.required_metrics, m],
    }))
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: '#060e24', color: '#e0f7ff', padding: '1.5rem' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>

        {toast && (
          <div style={{ position: 'fixed', top: 24, right: 24, zIndex: 1000, background: '#1e293b', border: '1px solid #4ade80', borderRadius: 8, color: '#4ade80', padding: '0.65rem 1.25rem', fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>
            ✓ {toast}
          </div>
        )}

        {/* Header */}
        <div style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#7ec8e3', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
              Cyan's Brooklynn Recycling Enterprise LLC — Admin
            </div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#e0f7ff', margin: 0 }}>📊 Municipal Reporting</h1>
          </div>
          <button onClick={openNew} style={BTN_P}>+ New Requirement</button>
        </div>

        {/* Summary + search */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'center' }}>
          {[{l:'Total', c: reqs.length}, {l:'Active', c: reqs.filter(r=>r.status==='active').length}, {l:'Upcoming 30d', c: upcoming.length}, {l:'Paused', c: reqs.filter(r=>r.status==='paused').length}].map(s => (
            <div key={s.l} style={{ padding: '3px 10px', borderRadius: 20, fontSize: '0.8rem', fontWeight: 600, background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.2)', color: '#7ec8e3' }}>{s.l}: {s.c}</div>
          ))}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(0,200,255,0.2)', borderRadius: 8, color: '#e0f7ff', padding: '0.4rem 0.8rem', fontSize: '0.82rem', outline: 'none' }} />
          </div>
        </div>

        {/* Group by tabs */}
        <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid rgba(0,200,255,0.15)', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          {(['all','agency','type','upcoming'] as GroupBy[]).map(g => (
            <button key={g} onClick={() => setGroupBy(g)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem 1rem', color: groupBy === g ? '#00c8ff' : '#64748b', fontWeight: groupBy === g ? 700 : 500, fontSize: '0.85rem', borderBottom: groupBy === g ? '2px solid #00c8ff' : '2px solid transparent', textTransform: 'capitalize' }}>
              {g === 'upcoming' ? 'Upcoming (30d)' : g.charAt(0).toUpperCase() + g.slice(1)}
            </button>
          ))}
        </div>

        {/* Editor */}
        {editingId && (
          <div style={{ ...CARD, borderColor: 'rgba(0,200,255,0.35)', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h2 style={{ color: '#00c8ff', fontSize: '1rem', fontWeight: 700, margin: 0 }}>
                {editingId === 'new' ? '+ New Reporting Requirement' : '✏️ Edit Requirement'}
              </h2>
              <button onClick={() => setEditingId(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.1rem' }}>✕</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
              <FF label="Agency *">
                <select style={INPUT} value={form.municipal_profile_id} onChange={e => setForm(f => ({ ...f, municipal_profile_id: e.target.value }))}>
                  <option value="">Select agency…</option>
                  {profiles.map(p => <option key={p.id} value={p.id}>{p.agency_name}</option>)}
                </select>
              </FF>
              <FF label="Linked Contract (optional)">
                <select style={INPUT} value={form.contract_id} onChange={e => setForm(f => ({ ...f, contract_id: e.target.value }))}>
                  <option value="">None</option>
                  {contracts.filter(c => !form.municipal_profile_id || c.municipal_profile_id === form.municipal_profile_id).map(c => <option key={c.id} value={c.id}>{c.contract_title}</option>)}
                </select>
              </FF>
              <FF label="Report Title *">
                <input style={INPUT} value={form.report_title} onChange={e => setForm(f => ({ ...f, report_title: e.target.value }))} placeholder="e.g. Q1 Council Diversion Report" />
              </FF>
              <FF label="Report Type *">
                <select style={INPUT} value={form.report_type} onChange={e => setForm(f => ({ ...f, report_type: e.target.value }))}>
                  {Object.entries(REPORT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </FF>
              <FF label="Frequency">
                <select style={INPUT} value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}>
                  {Object.entries(REPORTING_FREQUENCY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </FF>
              <FF label="Next Due Date">
                <input style={INPUT} type="date" value={form.next_due_date} onChange={e => setForm(f => ({ ...f, next_due_date: e.target.value }))} />
              </FF>
            </div>

            <div style={{ marginTop: '1rem' }}>
              <FF label="Required Metrics">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                  {COMMON_REPORTING_METRICS.map(m => (
                    <label key={m} style={{ display: 'flex', gap: 5, alignItems: 'center', cursor: 'pointer', padding: '3px 8px', borderRadius: 6, background: form.required_metrics.includes(m) ? 'rgba(0,200,255,0.1)' : 'rgba(255,255,255,0.03)', border: `1px solid ${form.required_metrics.includes(m) ? 'rgba(0,200,255,0.4)' : 'rgba(255,255,255,0.08)'}`, fontSize: '0.78rem' }}>
                      <input type="checkbox" checked={form.required_metrics.includes(m)} onChange={() => toggleMetric(m)} />
                      <span style={{ color: '#e0f7ff' }}>{m}</span>
                    </label>
                  ))}
                </div>
              </FF>
            </div>

            <div style={{ marginTop: '0.75rem' }}>
              <FF label="Notes">
                <textarea style={{ ...INPUT, minHeight: 60, resize: 'vertical' }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes…" />
              </FF>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: '1rem' }}>
              <button onClick={handleSave} disabled={saving} style={{ ...BTN_P, opacity: saving ? 0.6 : 1 }}>
                {saving ? '…Saving' : editingId === 'new' ? 'Create' : 'Save'}
              </button>
              <button onClick={() => setEditingId(null)} style={BTN_S}>Cancel</button>
            </div>
          </div>
        )}

        {/* Requirement list */}
        {loading ? (
          <div style={{ color: '#00c8ff', padding: '2rem' }}>Loading…</div>
        ) : (
          Object.entries(grouped).map(([groupName, items]) => (
            <div key={groupName}>
              {Object.keys(grouped).length > 1 && (
                <div style={{ color: '#7ec8e3', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem', marginTop: '0.75rem' }}>
                  {groupName} ({items.length})
                </div>
              )}
              {items.length === 0 && (
                <div style={{ color: '#64748b', padding: '1.5rem 0', textAlign: 'center', fontSize: '0.88rem' }}>
                  No requirements in this view.
                </div>
              )}
              {items.map(r => {
                const days    = daysUntilDate(r.next_due_date)
                const pName   = profiles.find(p => p.id === r.municipal_profile_id)?.agency_name ?? '—'
                const overdue = days !== null && days < 0
                const soon    = days !== null && days >= 0 && days <= 7

                return (
                  <div key={r.id} style={{ ...CARD, borderColor: overdue ? 'rgba(248,113,113,0.3)' : soon ? 'rgba(255,214,0,0.25)' : 'rgba(0,200,255,0.15)' }}>
                    <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                          <span style={{ fontWeight: 700, color: '#e0f7ff', fontSize: '0.92rem' }}>{r.report_title}</span>
                          <StatusPill status={r.status} />
                          {overdue && <span style={{ fontSize: '0.7rem', color: '#f87171', background: 'rgba(248,113,113,0.1)', padding: '1px 6px', borderRadius: 4, border: '1px solid rgba(248,113,113,0.3)' }}>OVERDUE</span>}
                        </div>
                        <div style={{ color: '#94a3b8', fontSize: '0.82rem' }}>
                          {pName} · {REPORT_TYPE_LABELS[r.report_type] ?? r.report_type} · {REPORTING_FREQUENCY_LABELS[r.frequency] ?? r.frequency}
                        </div>
                        {r.next_due_date && (
                          <div style={{ color: overdue ? '#f87171' : soon ? '#FFD600' : '#64748b', fontSize: '0.78rem', marginTop: 2 }}>
                            Due: {r.next_due_date}
                            {days !== null && ` (${days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'today' : `${days}d`})`}
                          </div>
                        )}
                        {r.required_metrics.length > 0 && (
                          <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: 3 }}>
                            Metrics: {r.required_metrics.slice(0, 3).join(', ')}{r.required_metrics.length > 3 ? ` +${r.required_metrics.length - 3}` : ''}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <ABtn2 label="✏️ Edit"     color="#00c8ff" onClick={() => openEdit(r)} />
                        {r.status === 'active'    && <ABtn2 label="⏸ Pause"   color="#fb923c" onClick={() => pause(r.id)} />}
                        {r.status === 'active'    && <ABtn2 label="✓ Complete" color="#4ade80" onClick={() => complete(r.id)} />}
                        {r.status === 'paused'    && <ABtn2 label="▶ Resume"   color="#4ade80" onClick={() => reactivate(r.id)} />}
                        {r.status === 'completed' && <ABtn2 label="↺ Reactivate" color="#a78bfa" onClick={() => reactivate(r.id)} />}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FF({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', color: '#7ec8e3', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, {c: string}> = {
    active: {c:'#4ade80'}, paused: {c:'#64748b'}, completed: {c:'#a78bfa'}, cancelled: {c:'#f87171'},
  }
  const s = map[status] ?? {c:'#94a3b8'}
  return <span style={{ fontSize: '0.7rem', fontWeight: 600, color: s.c, background: `${s.c}18`, border: `1px solid ${s.c}44`, padding: '1px 6px', borderRadius: 4, textTransform: 'capitalize' }}>{status}</span>
}

function ABtn2({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ background: `${color}18`, border: `1px solid ${color}44`, borderRadius: 6, color, fontWeight: 600, fontSize: '0.74rem', padding: '0.28rem 0.65rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
      {label}
    </button>
  )
}
