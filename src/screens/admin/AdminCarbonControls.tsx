// AdminCarbonControls.tsx
//
// Admin screen for managing carbon impact configuration.
// Route: /admin/carbon-controls
//
// Reads/writes the carbon_config table:
//   - material_factors (CO2e conversion factors + avg weights)
//   - badge_levels (thresholds)
//   - report_visibility (toggle consumer/commercial screens)
//   - avg_bag_weight_lbs / avg_bin_weight_lbs (global defaults)
//
// Also provides a full aggregate ESG CSV export across all commercial accounts.

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import {
  DEFAULT_MATERIAL_FACTORS,
  BADGE_LEVELS,
  type MaterialFactor,
  type BadgeLevel,
} from '../../lib/carbonCalculations'

// ── Constants ─────────────────────────────────────────────────────────────────

const TEAL    = '#00c8ff'
const GREEN   = '#4ade80'
const RED     = '#f87171'
const BG      = 'linear-gradient(180deg,#060e24 0%,#030d1a 100%)'
const CARD_BG = 'rgba(255,255,255,0.04)'
const CARD_BD = 'rgba(255,255,255,0.09)'

type Tab = 'materials' | 'badges' | 'visibility' | 'export'

interface ReportVisibility {
  consumer_impact:   boolean
  commercial_impact: boolean
  ranking_public:    boolean
  esg_enabled:       boolean
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminCarbonControls() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('materials')

  const [factors,     setFactors]     = useState<MaterialFactor[]>(DEFAULT_MATERIAL_FACTORS)
  const [badges,      setBadges]      = useState<BadgeLevel[]>(BADGE_LEVELS)
  const [visibility,  setVisibility]  = useState<ReportVisibility>({
    consumer_impact: true, commercial_impact: true, ranking_public: false, esg_enabled: true,
  })
  const [avgBagLbs,   setAvgBagLbs]   = useState(15)
  const [avgBinLbs,   setAvgBinLbs]   = useState(150)

  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState<string | null>(null)
  const [feedback,    setFeedback]    = useState<{ key: string; ok: boolean; msg: string } | null>(null)
  const [exporting,   setExporting]   = useState(false)

  const showFeedback = useCallback((key: string, ok: boolean, msg: string) => {
    setFeedback({ key, ok, msg })
    setTimeout(() => setFeedback(null), 3000)
  }, [])

  useEffect(() => { loadConfig() }, [])

  async function loadConfig() {
    setLoading(true)
    const { data } = await supabase.from('carbon_config').select('config_key, config_value')
    setLoading(false)
    if (!data) return

    for (const row of data) {
      try {
        switch (row.config_key) {
          case 'material_factors':
            setFactors(mergeFactors(row.config_value as MaterialFactor[]))
            break
          case 'badge_levels':
            setBadges(mergeBadges(row.config_value as BadgeLevel[]))
            break
          case 'report_visibility':
            setVisibility(row.config_value as ReportVisibility)
            break
          case 'avg_bag_weight_lbs':
            setAvgBagLbs(Number(row.config_value))
            break
          case 'avg_bin_weight_lbs':
            setAvgBinLbs(Number(row.config_value))
            break
        }
      } catch { /* ignore malformed rows */ }
    }
  }

  // Merge DB values onto defaults (in case DB has fewer fields)
  function mergeFactors(dbFactors: Partial<MaterialFactor>[]): MaterialFactor[] {
    return DEFAULT_MATERIAL_FACTORS.map(def => {
      const db = dbFactors.find(d => d.key === def.key)
      return db ? { ...def, ...db } : def
    })
  }
  function mergeBadges(dbBadges: Partial<BadgeLevel>[]): BadgeLevel[] {
    return BADGE_LEVELS.map(def => {
      const db = dbBadges.find(d => d.key === def.key)
      return db ? { ...def, ...db } : def
    })
  }

  async function saveKey(key: string, value: unknown) {
    setSaving(key)
    const { error } = await supabase.from('carbon_config')
      .upsert({ config_key: key, config_value: value, label: key, updated_at: new Date().toISOString() }, { onConflict: 'config_key' })
    setSaving(null)
    if (error) { showFeedback(key, false, error.message) }
    else        { showFeedback(key, true,  'Saved') }
  }

  async function exportAggregateESG() {
    setExporting(true)
    const { data: pickups } = await supabase
      .from('commercial_pickups')
      .select('account_id, bin_count, material_type, completed_at, created_at, status, business_name')
      .eq('status', 'completed')

    if (!pickups?.length) { setExporting(false); return }

    const lines: string[] = [
      'Account ID,Business Name,Material,Bins,Est. Lbs Diverted,Est. Lbs CO2 Avoided,Pickup Date',
    ]
    for (const p of pickups) {
      const mat = (p.material_type ?? 'mixed').toLowerCase()
      const f   = factors.find(x => mat.includes(x.key)) ?? factors[0]
      const bins  = p.bin_count ?? 1
      const lbs   = bins * f.avgBinLbs
      const co2   = lbs * f.lbsCo2PerLb
      const date  = (p.completed_at ?? p.created_at ?? '').slice(0, 10)
      lines.push(`"${p.account_id ?? ''}","${p.business_name ?? 'Commercial Account'}","${f.label}",${bins},${lbs.toFixed(2)},${co2.toFixed(2)},${date}`)
    }

    const csv  = lines.join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `cbr-aggregate-esg-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    setExporting(false)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

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
          <p style={{ fontSize: 10, fontWeight: 700, color: GREEN, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            ⚙️ Admin
          </p>
          <p style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginTop: 1 }}>
            Carbon Controls
          </p>
        </div>
        <div style={{ width: 40 }} />
      </header>

      {/* Tabs */}
      <div className="px-4 pt-4">
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
          {([
            { key: 'materials',  label: '♻️ Factors'   },
            { key: 'badges',     label: '🏆 Badges'    },
            { key: 'visibility', label: '👁 Visibility' },
            { key: 'export',     label: '📊 Export'    },
          ] as { key: Tab; label: string }[]).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{
                padding: '8px 14px', borderRadius: 14, fontSize: 12, fontWeight: 700,
                whiteSpace: 'nowrap',
                background: tab === t.key ? 'rgba(0,200,255,0.15)' : CARD_BG,
                border: `1px solid ${tab === t.key ? 'rgba(0,200,255,0.5)' : CARD_BD}`,
                color: tab === t.key ? TEAL : 'rgba(255,255,255,0.45)',
                cursor: 'pointer', flexShrink: 0,
              }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 pb-6 max-w-lg mx-auto">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2"
              style={{ borderColor: TEAL, borderTopColor: 'transparent' }} />
          </div>
        ) : (
          <>
            {tab === 'materials' && (
              <MaterialsTab
                factors={factors} setFactors={setFactors}
                avgBagLbs={avgBagLbs} setAvgBagLbs={setAvgBagLbs}
                avgBinLbs={avgBinLbs} setAvgBinLbs={setAvgBinLbs}
                saving={saving} saveKey={saveKey} feedback={feedback}
              />
            )}
            {tab === 'badges' && (
              <BadgesTab badges={badges} setBadges={setBadges} saving={saving} saveKey={saveKey} feedback={feedback} />
            )}
            {tab === 'visibility' && (
              <VisibilityTab visibility={visibility} setVisibility={setVisibility} saving={saving} saveKey={saveKey} feedback={feedback} />
            )}
            {tab === 'export' && (
              <ExportTab onExport={exportAggregateESG} exporting={exporting} />
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Materials tab ─────────────────────────────────────────────────────────────

function MaterialsTab({
  factors, setFactors, avgBagLbs, setAvgBagLbs, avgBinLbs, setAvgBinLbs,
  saving, saveKey, feedback,
}: {
  factors: MaterialFactor[]; setFactors: (f: MaterialFactor[]) => void
  avgBagLbs: number; setAvgBagLbs: (n: number) => void
  avgBinLbs: number; setAvgBinLbs: (n: number) => void
  saving: string | null
  saveKey: (k: string, v: unknown) => void
  feedback: { key: string; ok: boolean; msg: string } | null
}) {
  function updateFactor(key: string, field: keyof MaterialFactor, raw: string) {
    const val = field === 'lbsCo2PerLb' || field === 'avgBagLbs' || field === 'avgBinLbs' ? parseFloat(raw) || 0 : raw
    setFactors(factors.map(f => f.key === key ? { ...f, [field]: val } : f))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Global defaults */}
      <Section title="Global Defaults">
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <p style={LABEL_STYLE}>Default Bag Weight (lbs)</p>
            <input type="number" min="1" step="0.5" value={avgBagLbs}
              onChange={e => setAvgBagLbs(parseFloat(e.target.value) || 15)}
              style={INPUT_STYLE} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={LABEL_STYLE}>Default Bin Weight (lbs)</p>
            <input type="number" min="1" step="1" value={avgBinLbs}
              onChange={e => setAvgBinLbs(parseFloat(e.target.value) || 150)}
              style={INPUT_STYLE} />
          </div>
        </div>
        <SaveRow label="Save Defaults" skey="defaults" saving={saving === 'avg_bag_weight_lbs'} feedback={feedback}
          onSave={() => {
            saveKey('avg_bag_weight_lbs', avgBagLbs)
            saveKey('avg_bin_weight_lbs', avgBinLbs)
          }} />
      </Section>

      {/* Per-material factors */}
      {factors.map(f => (
        <Section key={f.key} title={`${f.icon} ${f.label}`}>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <p style={LABEL_STYLE}>lbs CO₂ per lb</p>
              <input type="number" min="0" step="0.01" value={f.lbsCo2PerLb}
                onChange={e => updateFactor(f.key, 'lbsCo2PerLb', e.target.value)}
                style={INPUT_STYLE} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={LABEL_STYLE}>Avg Bag lbs</p>
              <input type="number" min="1" step="0.5" value={f.avgBagLbs}
                onChange={e => updateFactor(f.key, 'avgBagLbs', e.target.value)}
                style={INPUT_STYLE} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={LABEL_STYLE}>Avg Bin lbs</p>
              <input type="number" min="1" step="1" value={f.avgBinLbs}
                onChange={e => updateFactor(f.key, 'avgBinLbs', e.target.value)}
                style={INPUT_STYLE} />
            </div>
          </div>
          <SaveRow label="Save" skey={`mat_${f.key}`} saving={saving === 'material_factors'} feedback={feedback}
            onSave={() => saveKey('material_factors', factors)} />
        </Section>
      ))}
    </div>
  )
}

// ── Badges tab ────────────────────────────────────────────────────────────────

function BadgesTab({
  badges, setBadges, saving, saveKey, feedback,
}: {
  badges: BadgeLevel[]; setBadges: (b: BadgeLevel[]) => void
  saving: string | null
  saveKey: (k: string, v: unknown) => void
  feedback: { key: string; ok: boolean; msg: string } | null
}) {
  function updateBadge(key: string, field: keyof BadgeLevel, raw: string) {
    const val = field === 'minLbsCo2' ? parseFloat(raw) || 0 : raw
    setBadges(badges.map(b => b.key === key ? { ...b, [field]: val } : b))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {badges.map(b => (
        <Section key={b.key} title={`${b.icon} ${b.label}`}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <p style={LABEL_STYLE}>Min lbs CO₂ (lifetime)</p>
              <input type="number" min="0" step="1" value={b.minLbsCo2}
                onChange={e => updateBadge(b.key, 'minLbsCo2', e.target.value)}
                style={INPUT_STYLE} />
            </div>
            <div style={{ flex: 2 }}>
              <p style={LABEL_STYLE}>Description</p>
              <input value={b.description}
                onChange={e => updateBadge(b.key, 'description', e.target.value)}
                style={INPUT_STYLE} />
            </div>
          </div>
          <SaveRow label="Save" skey={`badge_${b.key}`} saving={saving === 'badge_levels'} feedback={feedback}
            onSave={() => saveKey('badge_levels', badges)} />
        </Section>
      ))}
    </div>
  )
}

// ── Visibility tab ────────────────────────────────────────────────────────────

function VisibilityTab({
  visibility, setVisibility, saving, saveKey, feedback,
}: {
  visibility: ReportVisibility; setVisibility: (v: ReportVisibility) => void
  saving: string | null
  saveKey: (k: string, v: unknown) => void
  feedback: { key: string; ok: boolean; msg: string } | null
}) {
  const TOGGLES: { key: keyof ReportVisibility; label: string; desc: string }[] = [
    { key: 'consumer_impact',   label: 'Consumer Impact Center',     desc: 'Show /consumer/impact to consumer users'           },
    { key: 'commercial_impact', label: 'Commercial Impact Center',   desc: 'Show /commercial/impact to commercial users'       },
    { key: 'ranking_public',    label: 'Community Rankings Visible', desc: 'Show /commercial/impact/ranking — public leaderboard' },
    { key: 'esg_enabled',       label: 'ESG CSV Download',           desc: 'Allow commercial users to download their ESG report' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {TOGGLES.map(t => (
        <div key={t.key} style={{ padding: '16px', borderRadius: 18, background: CARD_BG, border: `1px solid ${CARD_BD}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{t.label}</p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{t.desc}</p>
            </div>
            <Toggle
              on={visibility[t.key]}
              onToggle={() => setVisibility({ ...visibility, [t.key]: !visibility[t.key] })}
            />
          </div>
        </div>
      ))}
      <SaveRow label="Save Visibility Settings" skey="report_visibility" saving={saving === 'report_visibility'} feedback={feedback}
        onSave={() => saveKey('report_visibility', visibility)} />
    </div>
  )
}

// ── Export tab ────────────────────────────────────────────────────────────────

function ExportTab({ onExport, exporting }: { onExport: () => void; exporting: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Section title="📊 Aggregate ESG Export">
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5, marginBottom: 16 }}>
          Download a CSV of all completed commercial pickups across every account. Includes estimated lbs diverted and CO₂ avoided per pickup, calculated from the current material factors.
        </p>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 14 }}>
          Columns: Account ID, Business Name, Material, Bins, Est. Lbs Diverted, Est. Lbs CO₂ Avoided, Pickup Date
        </p>
        <button onClick={onExport} disabled={exporting}
          style={{
            width: '100%', padding: '14px', borderRadius: 16,
            background: exporting ? 'rgba(74,222,128,0.05)' : 'rgba(74,222,128,0.12)',
            border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80',
            fontSize: 14, fontWeight: 700, cursor: exporting ? 'default' : 'pointer',
          }}>
          {exporting ? 'Generating…' : '⬇ Download Aggregate ESG CSV'}
        </button>
      </Section>

      <Section title="ℹ️ Methodology">
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.55 }}>
          CO₂ estimates are based on the EPA Waste Reduction Model (WARM) v16. Lbs CO₂e saved per lb of material diverted from landfill.
          Actual emission reductions may vary based on local grid mix, transport distances, and facility efficiency.
          These figures are estimates suitable for ESG reporting and sustainability tracking purposes.
        </p>
      </Section>
    </div>
  )
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '16px', borderRadius: 18, background: CARD_BG, border: `1px solid ${CARD_BD}` }}>
      <p style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 12 }}>{title}</p>
      {children}
    </div>
  )
}

function SaveRow({
  label, skey, saving, feedback, onSave,
}: {
  label: string; skey: string; saving: boolean
  feedback: { key: string; ok: boolean; msg: string } | null
  onSave: () => void
}) {
  const fb = feedback?.key?.startsWith(skey.replace(/^mat_|^badge_/, ''))
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
      <button onClick={onSave} disabled={saving}
        style={{
          padding: '9px 20px', borderRadius: 14,
          background: saving ? 'rgba(0,200,255,0.06)' : 'rgba(0,200,255,0.15)',
          border: '1px solid rgba(0,200,255,0.4)',
          color: TEAL, fontSize: 13, fontWeight: 700, cursor: saving ? 'default' : 'pointer',
        }}>
        {saving ? 'Saving…' : label}
      </button>
      {fb && (
        <p style={{ fontSize: 11, color: feedback!.ok ? GREEN : RED }}>
          {feedback!.ok ? '✓ ' : '✗ '}{feedback!.msg}
        </p>
      )}
    </div>
  )
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} style={{
      width: 46, height: 26, borderRadius: 13, flexShrink: 0,
      background: on ? 'rgba(0,200,255,0.3)' : 'rgba(255,255,255,0.1)',
      border: `1px solid ${on ? 'rgba(0,200,255,0.6)' : 'rgba(255,255,255,0.2)'}`,
      position: 'relative', cursor: 'pointer', transition: 'background 0.2s',
    }}>
      <div style={{
        position: 'absolute', top: 3, left: on ? 22 : 3, width: 18, height: 18,
        borderRadius: '50%', background: on ? TEAL : 'rgba(255,255,255,0.4)',
        transition: 'left 0.2s, background 0.2s',
      }} />
    </button>
  )
}

const INPUT_STYLE: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 10, fontSize: 13,
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
  color: '#fff', outline: 'none', boxSizing: 'border-box',
}

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.45)', marginBottom: 5,
}
