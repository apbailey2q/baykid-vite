import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const ITEMS = [
  { id: 'ppe',        label: 'PPE Worn',                   sub: 'Hard hat, gloves, hi-vis vest, safety boots' },
  { id: 'vehicle',    label: 'Vehicle Pre-Trip Inspected',  sub: 'Lights, brakes, mirrors, tires, fluid levels' },
  { id: 'spotter',    label: 'Spotter Assigned',            sub: 'Spotter present for blind-spot reversing' },
  { id: 'hazmat',     label: 'Hazmat Check',                sub: 'No unauthorized hazardous materials in load' },
  { id: 'weight',     label: 'Load Weight Verified',        sub: 'Estimated load within vehicle GVWR limits' },
  { id: 'dock',       label: 'Dock / Gate Clear',           sub: 'Area free of pedestrians and obstructions' },
  { id: 'lockout',    label: 'Compactor Locked Out',        sub: 'Compactor power off / LOTO tag if applicable' },
  { id: 'spillkit',   label: 'Spill Kit On Board',          sub: 'Absorbents and containment equipment present' },
  { id: 'manifest',   label: 'Waste Manifest Signed',       sub: 'Customer signature obtained for regulated loads' },
]

type ItemResult = 'pass' | 'flag' | 'fail' | null

export default function CommercialSafetyChecklist() {
  const navigate = useNavigate()
  const [results, setResults] = useState<Record<string, ItemResult>>({})
  const [submitted, setSubmitted] = useState(false)
  const [notes, setNotes] = useState('')

  function setResult(id: string, val: ItemResult) {
    setResults(prev => ({ ...prev, [id]: val === prev[id] ? null : val }))
  }

  const total   = ITEMS.length
  const checked = Object.values(results).filter(Boolean).length
  const passes  = Object.values(results).filter(v => v === 'pass').length
  const flags   = Object.values(results).filter(v => v === 'flag').length
  const fails   = Object.values(results).filter(v => v === 'fail').length
  const allChecked = checked === total

  function handleSubmit() {
    setSubmitted(true)
  }

  if (submitted) {
    const overallPass = fails === 0
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}>
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 text-3xl"
          style={{ background: overallPass ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)', border: `1px solid ${overallPass ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)'}` }}
        >
          {overallPass ? '✅' : '🚫'}
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 8 }}>
          {overallPass ? 'Checklist Cleared' : 'Safety Issues Found'}
        </h2>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 1.6, marginBottom: 20 }}>
          {overallPass
            ? 'All items passed. You are cleared to begin this commercial stop.'
            : `${fails} item(s) failed. Do not proceed until hazards are resolved.`}
        </p>
        <div className="flex gap-3 mb-8">
          {[
            { label: `${passes} Pass`,  color: '#4ade80' },
            { label: `${flags} Flag`,   color: '#fbbf24' },
            { label: `${fails} Fail`,   color: '#f87171' },
          ].map(s => (
            <div key={s.label} className="px-3 py-1.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.07)' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{s.label}</span>
            </div>
          ))}
        </div>
        <button
          onClick={() => navigate(-1)}
          className="w-full max-w-xs py-4 rounded-2xl font-bold text-sm text-white"
          style={{ background: 'linear-gradient(135deg,#0057e7,#00c8ff)', boxShadow: '0 4px 20px rgba(0,190,255,0.4)' }}
        >
          Back to Route
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}>
      <header className="flex items-center gap-3 px-4 py-3 shrink-0" style={{ background: 'rgba(4,10,24,0.94)', borderBottom: '1px solid rgba(0,200,255,0.12)', backdropFilter: 'blur(12px)' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>← Back</button>
        <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: '#fff', textAlign: 'center' }}>Safety Checklist</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: checked === total ? '#4ade80' : 'rgba(255,255,255,0.4)' }}>{checked}/{total}</span>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5 pb-24 max-w-xl mx-auto w-full">

        {/* Progress bar */}
        <div className="h-1.5 rounded-full overflow-hidden mb-6" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${(checked / total) * 100}%`, background: fails > 0 ? '#f87171' : flags > 0 ? '#fbbf24' : '#4ade80' }}
          />
        </div>

        <div className="flex flex-col gap-3 mb-5">
          {ITEMS.map(item => {
            const result = results[item.id]
            return (
              <div
                key={item.id}
                className="rounded-2xl px-4 py-4"
                style={{
                  background: result === 'pass' ? 'rgba(74,222,128,0.06)' : result === 'flag' ? 'rgba(251,191,36,0.06)' : result === 'fail' ? 'rgba(248,113,113,0.06)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${result === 'pass' ? 'rgba(74,222,128,0.25)' : result === 'flag' ? 'rgba(251,191,36,0.25)' : result === 'fail' ? 'rgba(248,113,113,0.25)' : 'rgba(255,255,255,0.09)'}`,
                }}
              >
                <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 3 }}>{item.label}</p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 10 }}>{item.sub}</p>
                <div className="flex gap-2">
                  {([
                    { val: 'pass' as ItemResult, label: '✓ Pass',  active: 'rgba(74,222,128,0.2)',  activeBorder: 'rgba(74,222,128,0.4)',  activeColor: '#4ade80' },
                    { val: 'flag' as ItemResult, label: '⚠ Flag',  active: 'rgba(251,191,36,0.2)',  activeBorder: 'rgba(251,191,36,0.4)',  activeColor: '#fbbf24' },
                    { val: 'fail' as ItemResult, label: '✗ Fail',  active: 'rgba(248,113,113,0.2)', activeBorder: 'rgba(248,113,113,0.4)', activeColor: '#f87171' },
                  ] as const).map(btn => (
                    <button
                      key={btn.val}
                      onClick={() => setResult(item.id, btn.val)}
                      className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
                      style={{
                        background: result === btn.val ? btn.active : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${result === btn.val ? btn.activeBorder : 'rgba(255,255,255,0.1)'}`,
                        color: result === btn.val ? btn.activeColor : 'rgba(255,255,255,0.4)',
                        cursor: 'pointer',
                      }}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* Notes */}
        <div className="mb-5">
          <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
            Additional Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Document any hazards, damaged equipment, or special conditions…"
            style={{ width: '100%', padding: '12px 14px', borderRadius: 14, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(0,200,255,0.2)', color: '#fff', fontSize: 13, outline: 'none', minHeight: 80, resize: 'vertical' }}
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={!allChecked}
          className="w-full py-4 rounded-2xl font-bold text-sm text-white transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-40"
          style={{ background: fails > 0 ? 'linear-gradient(135deg,#dc2626,#f87171)' : 'linear-gradient(135deg,#16a34a,#4ade80)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}
        >
          {!allChecked ? `Complete all ${total - checked} remaining items` : fails > 0 ? '🚫 Submit (Hazards Present)' : '✅ Submit & Clear for Service'}
        </button>
      </div>
    </div>
  )
}
