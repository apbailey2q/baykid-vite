import { useNavigate } from 'react-router-dom'

const ACCENT = '#00c8ff'

export default function DriverHybridDashboard() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}>
      <header className="flex items-center justify-center px-4 py-4 shrink-0" style={{ background: 'rgba(4,10,24,0.94)', borderBottom: '1px solid rgba(0,200,255,0.12)', backdropFilter: 'blur(12px)' }}>
        <span style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>Driver Hub</span>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6 pb-24 max-w-xl mx-auto w-full">

        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 20, textAlign: 'center' }}>Select your service type for this shift</p>

        {/* Consumer Pickups card */}
        <button
          onClick={() => navigate('/dashboard/driver')}
          className="w-full rounded-3xl p-6 mb-4 text-left transition-all hover:brightness-110 active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg, rgba(0,87,231,0.25), rgba(0,200,255,0.15))', border: '1px solid rgba(0,200,255,0.3)', cursor: 'pointer' }}
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl" style={{ background: 'rgba(0,200,255,0.15)', border: '1px solid rgba(0,200,255,0.25)' }}>
              ♻️
            </div>
            <div>
              <p style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>Consumer Pickups</p>
              <p style={{ fontSize: 12, color: ACCENT, fontWeight: 600 }}>Residential · Bag Scans</p>
            </div>
          </div>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, marginBottom: 16 }}>
            Handle residential recycling bag pickups. Scan consumer QR bags, inspect loads, and complete route stops.
          </p>
          <div className="flex gap-3">
            {[
              { icon: '📦', label: 'Bag Scans' },
              { icon: '🗺️', label: 'Route Map' },
              { icon: '✅', label: 'Inspections' },
            ].map(f => (
              <div key={f.label} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.07)' }}>
                <span style={{ fontSize: 13 }}>{f.icon}</span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>{f.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-end">
            <span style={{ fontSize: 13, fontWeight: 700, color: ACCENT }}>Open Driver Dashboard →</span>
          </div>
        </button>

        {/* Commercial Service card */}
        <button
          onClick={() => navigate('/dashboard/driver/commercial-routes')}
          className="w-full rounded-3xl p-6 text-left transition-all hover:brightness-110 active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg, rgba(74,222,128,0.12), rgba(0,200,255,0.08))', border: '1px solid rgba(74,222,128,0.25)', cursor: 'pointer' }}
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl" style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.2)' }}>
              🚛
            </div>
            <div>
              <p style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>Commercial Service</p>
              <p style={{ fontSize: 12, color: '#4ade80', fontWeight: 600 }}>Business · Bulk Pickups</p>
            </div>
          </div>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, marginBottom: 16 }}>
            Complete commercial bulk pickups. Navigate to business locations, run safety checklists, and collect dumpsters and compactors.
          </p>
          <div className="flex gap-3">
            {[
              { icon: '🏭', label: 'Commercial' },
              { icon: '🦺', label: 'Safety' },
              { icon: '📋', label: 'Manifests' },
            ].map(f => (
              <div key={f.label} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.07)' }}>
                <span style={{ fontSize: 13 }}>{f.icon}</span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>{f.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-end">
            <span style={{ fontSize: 13, fontWeight: 700, color: '#4ade80' }}>Open Commercial Routes →</span>
          </div>
        </button>

      </div>
    </div>
  )
}
