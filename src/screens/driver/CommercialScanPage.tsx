import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuthStore } from '../../store/authStore'
import { QrScanner } from '../../components/QrScanner'

const ACCENT = '#00c8ff'

export default function CommercialScanPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [scanned, setScanned] = useState(false)
  const [binCode, setBinCode] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleScan(code: string) {
    if (scanned) return
    setScanned(true)
    setBinCode(code)
    setSaving(true)
    setError(null)

    try {
      const { data: bin } = await supabase
        .from('commercial_bins')
        .select('id, bin_code, account_id, fill_estimate')
        .eq('bin_code', code)
        .maybeSingle()

      if (!bin) {
        setError(`Bin code "${code}" not found in system.`)
        setSaving(false)
        return
      }

      await supabase.from('commercial_bins').update({
        fill_estimate: 0,
        last_pickup: new Date().toISOString(),
        contamination_status: 'clean',
      }).eq('id', bin.id)

      await supabase.from('commercial_inspections').insert({
        pickup_id: bin.id,
        driver_id: user?.id ?? null,
        checklist_results: {},
        overall_result: 'pass',
        notes: `Bin ${code} scanned and emptied by driver`,
      })

      setSaved(true)
    } catch {
      setError('Scan save failed. Try again.')
    } finally {
      setSaving(false)
    }
  }

  if (saved) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}>
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 text-3xl" style={{ background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.3)' }}>✅</div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 6 }}>Bin Scanned</h2>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: 8 }}>
          <span style={{ color: ACCENT, fontWeight: 700 }}>{binCode}</span> marked emptied.
        </p>
        <div className="flex gap-3 mt-6">
          <button
            onClick={() => { setScanned(false); setSaved(false); setBinCode(''); setError(null) }}
            className="px-5 py-3 rounded-2xl font-bold text-sm transition-all"
            style={{ background: 'rgba(0,200,255,0.1)', border: '1px solid rgba(0,200,255,0.3)', color: ACCENT }}
          >
            Scan Next
          </button>
          <button
            onClick={() => navigate(-1)}
            className="px-5 py-3 rounded-2xl font-bold text-sm text-white transition-all"
            style={{ background: 'linear-gradient(135deg,#0057e7,#00c8ff)' }}
          >
            Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}>
      <header className="flex items-center gap-3 px-4 py-3 shrink-0" style={{ background: 'rgba(4,10,24,0.94)', borderBottom: '1px solid rgba(0,200,255,0.12)', backdropFilter: 'blur(12px)' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>← Back</button>
        <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: '#fff', textAlign: 'center' }}>Scan Commercial Bin</span>
        <span style={{ width: 52 }} />
      </header>

      <div className="flex-1 flex flex-col px-4 py-5 max-w-xl mx-auto w-full">
        <div className="rounded-2xl px-4 py-3 mb-4 flex items-center gap-3" style={{ background: 'rgba(0,200,255,0.07)', border: '1px solid rgba(0,200,255,0.2)' }}>
          <span style={{ fontSize: 18 }}>🏭</span>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>Point camera at the QR code on the commercial bin or dumpster.</p>
        </div>

        {!scanned && (
          <div className="flex-1 rounded-2xl overflow-hidden" style={{ minHeight: 300 }}>
            <QrScanner
              onScan={handleScan}
              onPermissionDenied={() => navigate(-1)}
            />
          </div>
        )}

        {saving && (
          <div className="flex flex-col items-center py-12 gap-4">
            <div className="w-7 h-7 rounded-full border-4 animate-spin" style={{ borderColor: 'rgba(0,200,255,0.2)', borderTopColor: ACCENT }} />
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>Recording scan…</p>
          </div>
        )}

        {error && (
          <div className="rounded-xl px-4 py-3 mt-4" style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', fontSize: 13 }}>
            {error}
          </div>
        )}

        {error && (
          <button
            onClick={() => { setScanned(false); setError(null); setBinCode('') }}
            className="mt-4 w-full py-3.5 rounded-2xl font-bold text-sm transition-all"
            style={{ background: 'rgba(0,200,255,0.1)', border: '1px solid rgba(0,200,255,0.3)', color: ACCENT }}
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  )
}
