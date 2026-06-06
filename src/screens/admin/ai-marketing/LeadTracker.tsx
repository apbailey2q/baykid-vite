// LeadTracker.tsx — BayKid AI Marketing Center
//
// Full CRM surface for leads. Sources:
//   • manual (Add Lead button)
//   • automation rules (lib/leadStorage.createLeadFrom{Comment,Email,Post})
//
// All persistence is in localStorage via lib/leadStorage. No network calls,
// no real emails. The board view is a 6-column pipeline (one per LeadStatus)
// with click-to-move and ‹ / › arrow buttons on each card. The list view is
// a vertical list of cards with the same controls. Both views share the
// same detail panel and Add/Edit modal.

import { useEffect, useMemo, useState } from 'react'
import type { Lead, LeadStatus, LeadSource } from '../../../lib/aiMarketing'
import {
  initializeLeads,
  subscribe,
  upsertLead,
  removeLead,
  setLeadStatus,
  createManualLead,
} from '../../../lib/leadStorage'

// ── Stage / source / platform metadata ────────────────────────────────────────

const STAGE_ORDER: LeadStatus[] = ['new', 'contacted', 'interested', 'follow_up', 'converted', 'lost']

const STAGE_META: Record<LeadStatus, { label: string; color: string; bg: string; border: string; icon: string }> = {
  new:        { label: 'New',        color: '#00c8ff', bg: 'rgba(0,200,255,0.10)',   border: 'rgba(0,200,255,0.25)',   icon: '✨' },
  contacted:  { label: 'Contacted',  color: '#fbbf24', bg: 'rgba(251,191,36,0.10)',  border: 'rgba(251,191,36,0.25)',  icon: '📞' },
  interested: { label: 'Interested', color: '#a855f7', bg: 'rgba(168,85,247,0.10)',  border: 'rgba(168,85,247,0.25)',  icon: '🔥' },
  follow_up:  { label: 'Follow-Up',  color: '#fb923c', bg: 'rgba(251,146,60,0.10)',  border: 'rgba(251,146,60,0.25)',  icon: '⏰' },
  converted:  { label: 'Converted',  color: '#22c55e', bg: 'rgba(34,197,94,0.10)',   border: 'rgba(34,197,94,0.25)',   icon: '✅' },
  lost:       { label: 'Lost',       color: '#f87171', bg: 'rgba(248,113,113,0.10)', border: 'rgba(248,113,113,0.25)', icon: '✗'  },
}

const SOURCE_META: Record<LeadSource, { label: string; icon: string }> = {
  manual:  { label: 'Manual',  icon: '✍️' },
  comment: { label: 'Comment', icon: '💬' },
  email:   { label: 'Email',   icon: '📧' },
  post:    { label: 'Post',    icon: '📢' },
}

const PLATFORM_OPTS = [
  'instagram', 'tiktok', 'facebook', 'twitter', 'linkedin', 'youtube',
  'email', 'google', 'referral', 'website', 'other',
] as const

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayIso(): string { return new Date().toISOString().slice(0, 10) }

function isFollowUpDue(lead: Lead): boolean {
  if (!lead.followUpDate) return false
  if (lead.status === 'converted' || lead.status === 'lost') return false
  return lead.followUpDate <= todayIso()
}

function emptyForm(): Omit<Lead, 'id' | 'createdAt' | 'source'> {
  return {
    name: '', email: '', phone: '', city: '',
    platform: 'instagram', need: '', status: 'new',
    followUpDate: '', notes: '',
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function LeadTracker() {
  const [leads,    setLeads]    = useState<Lead[]>(() => initializeLeads())
  const [view,     setView]     = useState<'list' | 'pipeline'>('list')
  const [search,   setSearch]   = useState('')
  const [stageFilter,    setStageFilter]    = useState<LeadStatus | 'all'>('all')
  const [platformFilter, setPlatformFilter] = useState<string>('all')

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingId,  setEditingId]  = useState<string | 'new' | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // React to programmatic writes (automation rules, other tabs).
  useEffect(() => subscribe(setLeads), [])

  const selected = selectedId ? leads.find((l) => l.id === selectedId) ?? null : null

  // ── Derived: filtered list ─────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return leads.filter((l) => {
      if (stageFilter    !== 'all' && l.status !== stageFilter)       return false
      if (platformFilter !== 'all' && l.platform !== platformFilter) return false
      if (!q) return true
      return [l.name, l.email, l.phone, l.city, l.need, l.notes]
        .filter(Boolean)
        .some((s) => s.toLowerCase().includes(q))
    })
  }, [leads, search, stageFilter, platformFilter])

  // ── Derived: stats ─────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    newCount:        leads.filter((l) => l.status === 'new').length,
    followUpsDue:    leads.filter(isFollowUpDue).length,
    convertedCount:  leads.filter((l) => l.status === 'converted').length,
    lostCount:       leads.filter((l) => l.status === 'lost').length,
  }), [leads])

  // ── Handlers ───────────────────────────────────────────────────────────────
  function moveStage(id: string, dir: -1 | 1) {
    const lead = leads.find((l) => l.id === id)
    if (!lead) return
    const idx = STAGE_ORDER.indexOf(lead.status)
    const next = STAGE_ORDER[idx + dir]
    if (!next) return
    setLeads(setLeadStatus(id, next))
  }

  function handleDelete(id: string) {
    setLeads(removeLead(id))
    setConfirmDeleteId(null)
    if (selectedId === id) setSelectedId(null)
  }

  return (
    <div style={{ maxWidth: 1180 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 16 }}>
        <div>
          <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 20, margin: 0 }}>🎯 Lead Tracker</h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 4 }}>
            Track every lead — manual entries, comment/email replies, and post conversions. Internal only — no messages are sent.
          </p>
        </div>
        <button
          onClick={() => setEditingId('new')}
          style={{
            background: 'linear-gradient(135deg,#0057e7,#00c8ff)', color: '#fff',
            border: 'none', borderRadius: 10, padding: '10px 16px',
            fontWeight: 700, fontSize: 13, cursor: 'pointer',
            boxShadow: '0 2px 12px rgba(0,190,255,0.35)', flexShrink: 0,
          }}
        >
          + Add Lead
        </button>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        <StatCard label="New Leads"      value={stats.newCount}       color={STAGE_META.new.color}       icon="✨" />
        <StatCard label="Follow-Ups Due" value={stats.followUpsDue}   color="#fb923c"                    icon="⏰" />
        <StatCard label="Converted"      value={stats.convertedCount} color={STAGE_META.converted.color} icon="✅" />
        <StatCard label="Lost"           value={stats.lostCount}      color={STAGE_META.lost.color}      icon="✗"  />
      </div>

      {/* Search + filters + view toggle */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, need, notes…"
          style={{
            flex: '1 1 240px', minWidth: 220,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 10, padding: '8px 12px',
            color: '#fff', fontSize: 13, outline: 'none',
          }}
        />
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value as LeadStatus | 'all')}
          style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 10, padding: '8px 12px', color: '#fff', fontSize: 12, cursor: 'pointer',
          }}
        >
          <option value="all">All Stages</option>
          {STAGE_ORDER.map((s) => <option key={s} value={s}>{STAGE_META[s].label}</option>)}
        </select>
        <select
          value={platformFilter}
          onChange={(e) => setPlatformFilter(e.target.value)}
          style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 10, padding: '8px 12px', color: '#fff', fontSize: 12, cursor: 'pointer',
          }}
        >
          <option value="all">All Platforms</option>
          {PLATFORM_OPTS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>

        {/* View toggle */}
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: 2 }}>
          {(['list', 'pipeline'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                padding: '6px 14px', borderRadius: 8,
                background: view === v ? 'rgba(0,200,255,0.15)' : 'transparent',
                color: view === v ? '#00c8ff' : 'rgba(255,255,255,0.5)',
                border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 700, textTransform: 'capitalize',
              }}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div style={{ display: 'grid', gridTemplateColumns: selected && view === 'list' ? '1fr 380px' : '1fr', gap: 20, alignItems: 'start' }}>
        {view === 'list' ? (
          <ListView
            leads={filtered}
            selectedId={selectedId}
            onSelect={(id) => setSelectedId(selectedId === id ? null : id)}
            onMove={moveStage}
            onEdit={(id) => setEditingId(id)}
            onDelete={(id) => setConfirmDeleteId(id)}
          />
        ) : (
          <PipelineView
            leads={filtered}
            onSelect={(id) => { setSelectedId(id); setEditingId(id) }}
            onMove={moveStage}
          />
        )}

        {selected && view === 'list' && (
          <DetailPanel
            lead={selected}
            onClose={() => setSelectedId(null)}
            onEdit={() => setEditingId(selected.id)}
            onDelete={() => setConfirmDeleteId(selected.id)}
          />
        )}
      </div>

      {/* Add / Edit modal */}
      {editingId !== null && (
        <LeadFormModal
          lead={editingId === 'new' ? null : leads.find((l) => l.id === editingId) ?? null}
          onCancel={() => setEditingId(null)}
          onSave={(values) => {
            if (editingId === 'new') {
              const created = createManualLead(values)
              setLeads(initializeLeads()) // refresh from storage
              setSelectedId(created.id)
            } else {
              const existing = leads.find((l) => l.id === editingId)
              if (existing) setLeads(upsertLead({ ...existing, ...values }))
            }
            setEditingId(null)
          }}
        />
      )}

      {/* Delete confirmation */}
      {confirmDeleteId && (
        <ConfirmDelete
          name={leads.find((l) => l.id === confirmDeleteId)?.name ?? 'this lead'}
          onCancel={() => setConfirmDeleteId(null)}
          onConfirm={() => handleDelete(confirmDeleteId)}
        />
      )}

      <div style={{ height: 40 }} />
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: string }) {
  return (
    <div
      style={{
        background: `${color}14`, border: `1px solid ${color}33`,
        borderRadius: 12, padding: '14px 16px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}
    >
      <span style={{ fontSize: 22, lineHeight: 1 }}>{icon}</span>
      <div>
        <div style={{ color, fontWeight: 800, fontSize: 22, lineHeight: 1.1 }}>{value}</div>
        <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 2 }}>{label}</div>
      </div>
    </div>
  )
}

// ── List view ────────────────────────────────────────────────────────────────

function ListView({
  leads, selectedId, onSelect, onMove, onEdit, onDelete,
}: {
  leads: Lead[]
  selectedId: string | null
  onSelect: (id: string) => void
  onMove:   (id: string, dir: -1 | 1) => void
  onEdit:   (id: string) => void
  onDelete: (id: string) => void
}) {
  if (leads.length === 0) {
    return (
      <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, textAlign: 'center', padding: 40, background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 12 }}>
        No leads match. Add one or clear filters.
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {leads.map((lead) => (
        <LeadCard
          key={lead.id}
          lead={lead}
          active={selectedId === lead.id}
          onClick={() => onSelect(lead.id)}
          onMove={(dir) => onMove(lead.id, dir)}
          onEdit={() => onEdit(lead.id)}
          onDelete={() => onDelete(lead.id)}
          dense={false}
        />
      ))}
    </div>
  )
}

// ── Pipeline view ─────────────────────────────────────────────────────────────

function PipelineView({
  leads, onSelect, onMove,
}: {
  leads: Lead[]
  onSelect: (id: string) => void
  onMove:   (id: string, dir: -1 | 1) => void
}) {
  const columns = useMemo(() => {
    const grouped: Record<LeadStatus, Lead[]> = {
      new: [], contacted: [], interested: [], follow_up: [], converted: [], lost: [],
    }
    for (const l of leads) grouped[l.status].push(l)
    return grouped
  }, [leads])

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${STAGE_ORDER.length}, minmax(180px, 1fr))`,
        gap: 12,
        overflowX: 'auto',
        paddingBottom: 8,
      }}
    >
      {STAGE_ORDER.map((stage) => {
        const meta = STAGE_META[stage]
        const colLeads = columns[stage]
        return (
          <div
            key={stage}
            style={{
              background: 'rgba(255,255,255,0.025)',
              border: `1px solid ${meta.border}`,
              borderRadius: 12, padding: 10,
              minHeight: 240,
              display: 'flex', flexDirection: 'column', gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ color: meta.color, fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                {meta.icon} {meta.label}
              </span>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 700 }}>{colLeads.length}</span>
            </div>
            {colLeads.length === 0 ? (
              <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11, textAlign: 'center', padding: '20px 4px' }}>—</div>
            ) : (
              colLeads.map((lead) => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  active={false}
                  onClick={() => onSelect(lead.id)}
                  onMove={(dir) => onMove(lead.id, dir)}
                  onEdit={() => onSelect(lead.id)}
                  onDelete={() => { /* delete is via edit panel in pipeline mode */ }}
                  dense
                />
              ))
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Lead card ─────────────────────────────────────────────────────────────────

function LeadCard({
  lead, active, onClick, onMove, onEdit, onDelete, dense,
}: {
  lead: Lead
  active: boolean
  onClick: () => void
  onMove:  (dir: -1 | 1) => void
  onEdit:  () => void
  onDelete: () => void
  dense: boolean
}) {
  const meta = STAGE_META[lead.status]
  const sourceMeta = lead.source ? SOURCE_META[lead.source] : SOURCE_META.manual
  const due = isFollowUpDue(lead)
  const stopProp = (e: React.MouseEvent) => e.stopPropagation()

  return (
    <div
      onClick={onClick}
      style={{
        background: active ? 'rgba(0,200,255,0.08)' : 'rgba(255,255,255,0.04)',
        border: active ? '1px solid rgba(0,200,255,0.4)' : `1px solid ${meta.border}`,
        borderRadius: 12, padding: dense ? '10px 12px' : '14px 16px',
        cursor: 'pointer', transition: 'background 0.15s',
        display: 'flex', flexDirection: 'column', gap: dense ? 4 : 6,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: dense ? 12 : 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {lead.name || '(unnamed)'}
        </span>
        <span style={{ background: meta.bg, color: meta.color, borderRadius: 20, padding: '2px 8px', fontSize: 9, fontWeight: 800, flexShrink: 0, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          {meta.label}
        </span>
      </div>

      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <span title={`Source: ${sourceMeta.label}`}>{sourceMeta.icon} {sourceMeta.label}</span>
        <span>·</span>
        <span>{lead.platform || 'unknown'}</span>
        {lead.city && <><span>·</span><span>{lead.city}</span></>}
        {lead.followUpDate && (
          <>
            <span>·</span>
            <span style={{ color: due ? '#fb923c' : 'rgba(255,255,255,0.4)', fontWeight: due ? 700 : 500 }}>
              {due ? '⚠ ' : ''}Follow-up {lead.followUpDate}
            </span>
          </>
        )}
      </div>

      {!dense && lead.need && (
        <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, lineHeight: 1.5 }}>
          {lead.need}
        </div>
      )}

      {/* Card actions */}
      <div onClick={stopProp} style={{ display: 'flex', gap: 6, marginTop: dense ? 4 : 8, flexWrap: 'wrap' }}>
        <button onClick={() => onMove(-1)} disabled={STAGE_ORDER.indexOf(lead.status) === 0}
          style={iconBtnStyle(STAGE_ORDER.indexOf(lead.status) === 0)} title="Move back a stage">‹</button>
        <button onClick={() => onMove(1)} disabled={STAGE_ORDER.indexOf(lead.status) === STAGE_ORDER.length - 1}
          style={iconBtnStyle(STAGE_ORDER.indexOf(lead.status) === STAGE_ORDER.length - 1)} title="Move forward a stage">›</button>
        <button onClick={onEdit} style={ghostBtnStyle()}>Edit</button>
        {!dense && (
          <button onClick={onDelete} style={ghostBtnStyle('#f87171')}>Delete</button>
        )}
      </div>
    </div>
  )
}

function iconBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    width: 24, height: 24, borderRadius: 6,
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: disabled ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.7)',
    fontSize: 14, fontWeight: 800, cursor: disabled ? 'not-allowed' : 'pointer',
    padding: 0, lineHeight: 1,
  }
}

function ghostBtnStyle(accent?: string): React.CSSProperties {
  return {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: accent ?? 'rgba(255,255,255,0.7)',
    borderRadius: 6, padding: '3px 10px',
    fontSize: 10, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.04em',
  }
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function DetailPanel({
  lead, onClose, onEdit, onDelete,
}: {
  lead: Lead
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const meta = STAGE_META[lead.status]
  const sourceMeta = lead.source ? SOURCE_META[lead.source] : SOURCE_META.manual
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(0,190,255,0.18)', borderRadius: 14, padding: 18, position: 'sticky', top: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h3 style={{ color: '#fff', fontWeight: 700, fontSize: 15, margin: 0 }}>{lead.name || '(unnamed)'}</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 18, cursor: 'pointer', padding: 4 }}>×</button>
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        <span style={{ background: meta.bg, color: meta.color, borderRadius: 20, padding: '3px 10px', fontSize: 10, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          {meta.icon} {meta.label}
        </span>
        <span style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', borderRadius: 20, padding: '3px 10px', fontSize: 10, fontWeight: 700 }}>
          {sourceMeta.icon} {sourceMeta.label}
        </span>
      </div>

      {[
        ['Email',     lead.email],
        ['Phone',     lead.phone],
        ['City',      lead.city],
        ['Platform',  lead.platform],
        ['Follow-Up', lead.followUpDate || '—'],
        ['Created',   lead.createdAt?.slice(0, 10) ?? '—'],
      ].map(([label, value]) => (
        <div key={label} style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, minWidth: 80 }}>{label}</span>
          <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, wordBreak: 'break-word' }}>{value || '—'}</span>
        </div>
      ))}

      {lead.need && (
        <div style={{ marginTop: 12 }}>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 4 }}>Need</div>
          <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, lineHeight: 1.55 }}>{lead.need}</div>
        </div>
      )}

      {lead.notes && (
        <div style={{ marginTop: 12 }}>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 4 }}>Notes</div>
          <div style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: 10, color: 'rgba(255,255,255,0.8)', fontSize: 12, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
            {lead.notes}
          </div>
        </div>
      )}

      {lead.sourceText && (
        <div style={{ marginTop: 12 }}>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 4 }}>Original source text</div>
          <div style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: 10, color: 'rgba(255,255,255,0.6)', fontSize: 11, fontStyle: 'italic', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
            “{lead.sourceText}”
          </div>
        </div>
      )}

      {/* ── Cross-system references ─────────────────────────────────────── */}
      {(lead.linkedRuleName || lead.linkedPostId) && (
        <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {lead.linkedRuleName && (
            <span style={{ background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.2)', color: '#fb923c', borderRadius: 20, padding: '2px 10px', fontSize: 10, fontWeight: 700 }}>
              ⚡ Rule: {lead.linkedRuleName}
            </span>
          )}
          {lead.linkedPostId && (
            <span style={{ background: 'rgba(0,200,255,0.06)', border: '1px solid rgba(0,200,255,0.15)', color: '#00c8ff', borderRadius: 20, padding: '2px 10px', fontSize: 10, fontWeight: 700 }}>
              📝 Linked Post
            </span>
          )}
        </div>
      )}

      {/* ── Activity timeline ───────────────────────────────────────────── */}
      {lead.activity && lead.activity.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 700, marginBottom: 8, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Activity</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {lead.activity.slice(0, 8).map((ev) => (
              <div key={ev.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 12, flexShrink: 0, marginTop: 1 }}>
                  {ev.type === 'rule_triggered' ? '⚡' : ev.type === 'edited' ? '✏️' : ev.type === 'generated' ? '✨' : '📝'}
                </span>
                <div style={{ flex: 1 }}>
                  <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>{ev.label}</span>
                  {ev.actor && <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, marginLeft: 6 }}>· {ev.actor}</span>}
                </div>
                <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10, flexShrink: 0 }}>
                  {new Date(ev.ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button
          onClick={onEdit}
          style={{ flex: 1, background: 'rgba(0,200,255,0.1)', border: '1px solid rgba(0,200,255,0.3)', color: '#00c8ff', borderRadius: 8, padding: '8px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
        >
          Edit
        </button>
        <button
          onClick={onDelete}
          style={{ flex: 1, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', borderRadius: 8, padding: '8px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
        >
          Delete
        </button>
      </div>
    </div>
  )
}

// ── Add / Edit modal ──────────────────────────────────────────────────────────

function LeadFormModal({
  lead, onCancel, onSave,
}: {
  lead: Lead | null
  onCancel: () => void
  onSave: (values: Omit<Lead, 'id' | 'createdAt' | 'source'>) => void
}) {
  const [form, setForm] = useState<Omit<Lead, 'id' | 'createdAt' | 'source'>>(() => {
    if (!lead) return emptyForm()
    const {
      id: _id, createdAt: _c, source: _s, sourceText: _st, sourceRef: _sr,
      linkedPostId: _lp, linkedRuleId: _lr, linkedRuleName: _lrn, activity: _act,
      ...rest
    } = lead
    return rest
  })

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  const canSave = form.name.trim().length > 0 || form.email.trim().length > 0

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}
    >
      <div style={{ background: '#070f23', border: '1px solid rgba(0,190,255,0.2)', borderRadius: 14, padding: 22, width: '100%', maxWidth: 520, maxHeight: '92vh', overflowY: 'auto' }}>
        <h3 style={{ color: '#fff', fontWeight: 700, fontSize: 16, margin: '0 0 14px' }}>
          {lead ? 'Edit Lead' : 'Add Lead'}
        </h3>

        <Field label="Name">
          <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)} style={inputStyle()} placeholder="Marcus Johnson" />
        </Field>
        <Row>
          <Field label="Email">
            <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} style={inputStyle()} placeholder="lead@example.com" />
          </Field>
          <Field label="Phone">
            <input type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} style={inputStyle()} placeholder="(615) 555-0142" />
          </Field>
        </Row>
        <Row>
          <Field label="City">
            <input type="text" value={form.city} onChange={(e) => set('city', e.target.value)} style={inputStyle()} placeholder="Nashville" />
          </Field>
          <Field label="Source Platform">
            <select value={form.platform} onChange={(e) => set('platform', e.target.value)} style={inputStyle()}>
              {PLATFORM_OPTS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
        </Row>
        <Row>
          <Field label="Stage">
            <select value={form.status} onChange={(e) => set('status', e.target.value as LeadStatus)} style={inputStyle()}>
              {STAGE_ORDER.map((s) => <option key={s} value={s}>{STAGE_META[s].label}</option>)}
            </select>
          </Field>
          <Field label="Follow-Up Date">
            <input type="date" value={form.followUpDate} onChange={(e) => set('followUpDate', e.target.value)} style={inputStyle()} />
          </Field>
        </Row>
        <Field label="Need">
          <textarea value={form.need} onChange={(e) => set('need', e.target.value)} rows={2} style={{ ...inputStyle(), resize: 'vertical', fontFamily: 'inherit' }} placeholder="What recycling service do they need?" />
        </Field>
        <Field label="Notes">
          <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={4} style={{ ...inputStyle(), resize: 'vertical', fontFamily: 'inherit' }} placeholder="Internal notes — never sent to the lead." />
        </Field>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <button onClick={onCancel} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={!canSave}
            style={{
              background: canSave ? 'linear-gradient(135deg,#0057e7,#00c8ff)' : 'rgba(255,255,255,0.06)',
              border: 'none', color: canSave ? '#fff' : 'rgba(255,255,255,0.3)',
              borderRadius: 8, padding: '8px 18px',
              fontSize: 13, fontWeight: 700, cursor: canSave ? 'pointer' : 'not-allowed',
              boxShadow: canSave ? '0 2px 12px rgba(0,190,255,0.35)' : 'none',
            }}
          >
            {lead ? 'Save' : 'Add Lead'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', flex: 1, marginBottom: 12 }}>
      <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
        {label}
      </span>
      {children}
    </label>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', gap: 10 }}>{children}</div>
}

function inputStyle(): React.CSSProperties {
  return {
    width: '100%',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8, padding: '8px 10px',
    color: '#fff', fontSize: 13, outline: 'none',
    boxSizing: 'border-box',
  }
}

// ── Delete confirm ────────────────────────────────────────────────────────────

function ConfirmDelete({
  name, onCancel, onConfirm,
}: {
  name: string
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}
    >
      <div style={{ background: '#070f23', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 14, padding: 22, width: '100%', maxWidth: 380 }}>
        <h3 style={{ color: '#fff', fontWeight: 700, fontSize: 15, margin: '0 0 8px' }}>Delete this lead?</h3>
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, lineHeight: 1.55, marginBottom: 18 }}>
          “{name}” will be permanently removed from the Lead Tracker. This can’t be undone.
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onCancel} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={onConfirm} style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.4)', color: '#f87171', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
