import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const ACCENT = '#00c8ff'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const WINDOWS = ['6 AM – 10 AM', '10 AM – 2 PM', '2 PM – 6 PM', '6 PM – 10 PM']

type DayConfig = { enabled: boolean; windows: string[] }

const DEFAULT_SCHEDULE: Record<string, DayConfig> = {
  Mon: { enabled: true,  windows: ['6 AM – 10 AM'] },
  Tue: { enabled: false, windows: [] },
  Wed: { enabled: true,  windows: ['6 AM – 10 AM'] },
  Thu: { enabled: false, windows: [] },
  Fri: { enabled: true,  windows: ['6 AM – 10 AM'] },
  Sat: { enabled: false, windows: [] },
  Sun: { enabled: false, windows: [] },
}

export default function CommercialSchedulePage() {
  const navigate = useNavigate()
  const [schedule, setSchedule] = useState(DEFAULT_SCHEDULE)
  const [saved, setSaved]       = useState(false)

  function toggleDay(day: string) {
    setSchedule(prev => ({ ...prev, [day]: { ...prev[day], enabled: !prev[day].enabled } }))
    setSaved(false)
  }

  function toggleWindow(day: string, window: string) {
    setSchedule(prev => {
      const current = prev[day].windows
      const next = current.includes(window) ? current.filter(w => w !== window) : [...current, window]
      return { ...prev, [day]: { ...prev[day], windows: next } }
    })
    setSaved(false)
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}>
      <header className="flex items-center gap-3 px-4 py-3 shrink-0" style={{ background: 'rgba(4,10,24,0.94)', borderBottom: '1px solid rgba(0,200,255,0.12)', backdropFilter: 'blur(12px)' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>← Back</button>
        <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: '#fff', textAlign: 'center' }}>Service Schedule</span>
        <span style={{ width: 52 }} />
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5 pb-24 max-w-xl mx-auto w-full">

        <div className="rounded-2xl px-4 py-3 mb-5 flex items-center gap-3" style={{ background: 'rgba(0,200,255,0.07)', border: '1px solid rgba(0,200,255,0.2)' }}>
          <span style={{ fontSize: 18 }}>📅</span>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>Configure your recurring pickup windows. Changes take effect next billing cycle.</p>
        </div>

        {/* Current plan */}
        <div className="mb-5">
          <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Current Plan</p>
          <div className="rounded-2xl px-4 py-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}>
            <div className="flex items-center justify-between">
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Weekly Commercial Service</p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 3 }}>3× per week · Mon, Wed, Fri</p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold" style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80' }}>Active</span>
            </div>
          </div>
        </div>

        {/* Day selector */}
        <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Pickup Days</p>

        <div className="flex flex-col gap-3 mb-6">
          {DAYS.map(day => {
            const config = schedule[day]
            return (
              <div key={day} className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${config.enabled ? 'rgba(0,200,255,0.25)' : 'rgba(255,255,255,0.08)'}` }}>
                {/* Day toggle row */}
                <div
                  className="flex items-center justify-between px-4 py-3 cursor-pointer"
                  style={{ background: config.enabled ? 'rgba(0,200,255,0.07)' : 'rgba(255,255,255,0.03)' }}
                  onClick={() => toggleDay(day)}
                >
                  <span style={{ fontSize: 14, fontWeight: 700, color: config.enabled ? ACCENT : 'rgba(255,255,255,0.35)' }}>{day}</span>
                  <div className="relative w-10 h-5 rounded-full transition-all" style={{ background: config.enabled ? ACCENT : 'rgba(255,255,255,0.15)' }}>
                    <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all" style={{ left: config.enabled ? '20px' : '2px' }} />
                  </div>
                </div>

                {/* Window options */}
                {config.enabled && (
                  <div className="px-4 pb-3 pt-2 flex flex-col gap-1.5">
                    {WINDOWS.map(w => {
                      const active = config.windows.includes(w)
                      return (
                        <button
                          key={w}
                          onClick={() => toggleWindow(day, w)}
                          className="flex items-center gap-2 py-2 px-3 rounded-xl text-left transition-all"
                          style={{ background: active ? 'rgba(0,200,255,0.12)' : 'rgba(255,255,255,0.04)', border: `1px solid ${active ? 'rgba(0,200,255,0.3)' : 'rgba(255,255,255,0.08)'}`, cursor: 'pointer', width: '100%' }}
                        >
                          <div className="w-4 h-4 rounded flex items-center justify-center" style={{ background: active ? ACCENT : 'rgba(255,255,255,0.1)', border: active ? 'none' : '1px solid rgba(255,255,255,0.2)' }}>
                            {active && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 12.75l6 6 9-13.5" /></svg>}
                          </div>
                          <span style={{ fontSize: 12, color: active ? ACCENT : 'rgba(255,255,255,0.5)', fontWeight: active ? 700 : 500 }}>{w}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {saved && (
          <div className="rounded-xl px-4 py-3 mb-4 text-center" style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80', fontSize: 13, fontWeight: 700 }}>
            ✓ Schedule saved
          </div>
        )}

        <button
          onClick={() => setSaved(true)}
          className="w-full py-4 rounded-2xl font-bold text-sm text-white transition-all hover:brightness-110 active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg,#0057e7,#00c8ff)', boxShadow: '0 4px 20px rgba(0,190,255,0.35)' }}
        >
          Save Schedule
        </button>
      </div>
    </div>
  )
}
