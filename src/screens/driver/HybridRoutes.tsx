import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GlassCard } from '../../components/ui/GlassCard'
import { StatusBadge } from '../../components/ui/StatusBadge'

const CONSUMER_FEATURES = [
  { icon: '🏘️', label: 'ZIP Grouped Routes' },
  { icon: '🛍️', label: 'Bag Scan & Collect' },
  { icon: '📍', label: 'Apartment Stops'    },
]

const COMMERCIAL_FEATURES = [
  { icon: '🏭', label: 'Business Accounts'  },
  { icon: '📦', label: 'Bin & QR Scanning'  },
  { icon: '🦺', label: 'Safety Checklists'  },
]

export default function HybridRoutes() {
  const navigate = useNavigate()
  const [toast, setToast] = useState<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}>

      {/* ── Header ── */}
      <header
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ background: 'rgba(4,10,24,0.94)', borderBottom: '1px solid rgba(0,200,255,0.12)', backdropFilter: 'blur(12px)' }}
      >
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', fontSize: 14, padding: '4px 6px' }}
        >
          ← Back
        </button>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Driver Hub</span>
        <button
          onClick={() => showToast('Emergency dispatch contacted')}
          className="rounded-xl px-2.5 py-1.5 text-xs font-bold transition-all hover:brightness-110"
          style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.35)', color: '#f87171', cursor: 'pointer' }}
        >
          🚨 SOS
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6 pb-24 max-w-xl mx-auto w-full">

        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 20, textAlign: 'center' }}>
          Select your service type for this shift
        </p>

        {/* ── Consumer Pickups card ── */}
        <button
          onClick={() => navigate('/dashboard/driver/consumer-routes')}
          className="w-full rounded-3xl p-5 mb-4 text-left transition-all hover:brightness-110 active:scale-[0.98]"
          style={{
            background: 'linear-gradient(135deg, rgba(0,87,231,0.22), rgba(0,200,255,0.12))',
            border: '1px solid rgba(0,200,255,0.28)',
            cursor: 'pointer',
          }}
        >
          <div className="flex items-center gap-4 mb-3">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0"
              style={{ background: 'rgba(0,200,255,0.12)', border: '1px solid rgba(0,200,255,0.2)' }}
            >
              ♻️
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <p style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>Consumer Pickups</p>
                <StatusBadge variant="cyan" label="9 stops" size="sm" />
              </div>
              <p style={{ fontSize: 12, color: '#00c8ff', fontWeight: 600 }}>Residential · Bag Scans</p>
            </div>
          </div>

          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, marginBottom: 14 }}>
            Residential bag pickups grouped by ZIP code and apartment building. Scan QR bags and complete route stops.
          </p>

          {/* Stats mini */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { label: 'Stops', value: '9' },
              { label: 'Bags',  value: '21' },
              { label: 'ZIPs',  value: '3'  },
            ].map(s => (
              <div key={s.label} className="rounded-xl px-3 py-2 text-center" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <p style={{ fontSize: 16, fontWeight: 800, color: '#00c8ff', lineHeight: 1 }}>{s.value}</p>
                <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{s.label}</p>
              </div>
            ))}
          </div>

          <GlassCard padding="sm">
            <div className="flex gap-2 flex-wrap">
              {CONSUMER_FEATURES.map(f => (
                <div key={f.label} className="flex items-center gap-1.5 px-2 py-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <span style={{ fontSize: 12 }}>{f.icon}</span>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>{f.label}</span>
                </div>
              ))}
            </div>
          </GlassCard>

          <div className="mt-3 flex items-center justify-end">
            <span style={{ fontSize: 13, fontWeight: 700, color: '#00c8ff' }}>Open Consumer Routes →</span>
          </div>
        </button>

        {/* ── Commercial Service card ── */}
        <button
          onClick={() => navigate('/dashboard/driver/commercial-routes')}
          className="w-full rounded-3xl p-5 text-left transition-all hover:brightness-110 active:scale-[0.98]"
          style={{
            background: 'linear-gradient(135deg, rgba(74,222,128,0.1), rgba(0,200,255,0.07))',
            border: '1px solid rgba(74,222,128,0.22)',
            cursor: 'pointer',
          }}
        >
          <div className="flex items-center gap-4 mb-3">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0"
              style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.18)' }}
            >
              🚛
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <p style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>Commercial Service</p>
                <StatusBadge variant="green" label="3 stops" size="sm" />
              </div>
              <p style={{ fontSize: 12, color: '#4ade80', fontWeight: 600 }}>Business · Bulk Pickups</p>
            </div>
          </div>

          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, marginBottom: 14 }}>
            Commercial bulk pickups at business locations. Run safety checklists, scan QR bins, and collect dumpsters and compactors.
          </p>

          {/* Stats mini */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { label: 'Stops',  value: '3'    },
              { label: 'Bins',   value: '25'   },
              { label: 'Weight', value: '3.9t' },
            ].map(s => (
              <div key={s.label} className="rounded-xl px-3 py-2 text-center" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <p style={{ fontSize: 16, fontWeight: 800, color: '#4ade80', lineHeight: 1 }}>{s.value}</p>
                <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{s.label}</p>
              </div>
            ))}
          </div>

          <GlassCard padding="sm">
            <div className="flex gap-2 flex-wrap">
              {COMMERCIAL_FEATURES.map(f => (
                <div key={f.label} className="flex items-center gap-1.5 px-2 py-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <span style={{ fontSize: 12 }}>{f.icon}</span>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>{f.label}</span>
                </div>
              ))}
            </div>
          </GlassCard>

          <div className="mt-3 flex items-center justify-end">
            <span style={{ fontSize: 13, fontWeight: 700, color: '#4ade80' }}>Open Commercial Routes →</span>
          </div>
        </button>
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-sm font-semibold"
          style={{
            background: 'rgba(0,200,255,0.15)',
            border: '1px solid rgba(0,200,255,0.3)',
            color: '#00c8ff',
            backdropFilter: 'blur(12px)',
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          }}
        >
          {toast}
        </div>
      )}
    </div>
  )
}
