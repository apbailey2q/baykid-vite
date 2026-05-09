import { useState } from 'react'

// ── Data ──────────────────────────────────────────────────────────────────────

type CityName = 'Nashville' | 'Memphis' | 'Chattanooga' | 'Knoxville' | 'Murfreesboro' | 'Clarksville'
type CityStatus = 'Active' | 'Pilot' | 'Coming Soon'

interface CityData {
  warehouse:   string
  bags:        number
  pounds:      number
  co2:         number
  fundraisers: number
  drivers:     number
  status:      CityStatus
}

const CITIES: CityName[] = [
  'Nashville', 'Memphis', 'Chattanooga', 'Knoxville', 'Murfreesboro', 'Clarksville',
]

const cityImpact: Record<CityName, CityData> = {
  Nashville:    { warehouse: 'NASH-01',  bags: 5280, pounds: 18400, co2: 8400, fundraisers: 12, drivers: 6, status: 'Active'      },
  Memphis:      { warehouse: 'MEM-01',   bags: 3180, pounds: 12100, co2: 5300, fundraisers: 8,  drivers: 4, status: 'Active'      },
  Chattanooga:  { warehouse: 'CHATT-01', bags: 2210, pounds: 8700,  co2: 3900, fundraisers: 6,  drivers: 3, status: 'Active'      },
  Knoxville:    { warehouse: 'KNOX-01',  bags: 2310, pounds: 9100,  co2: 4100, fundraisers: 5,  drivers: 3, status: 'Pilot'       },
  Murfreesboro: { warehouse: 'MURF-01',  bags: 980,  pounds: 3400,  co2: 1500, fundraisers: 3,  drivers: 2, status: 'Coming Soon' },
  Clarksville:  { warehouse: 'CLARK-01', bags: 760,  pounds: 2900,  co2: 1200, fundraisers: 2,  drivers: 2, status: 'Coming Soon' },
}

// ── Status styling ────────────────────────────────────────────────────────────

function statusStyle(s: CityStatus) {
  switch (s) {
    case 'Active':      return { text: '#4ade80', bg: 'rgba(34,197,94,0.10)',   border: 'rgba(34,197,94,0.32)',   dot: '#4ade80', glow: 'rgba(34,197,94,0.25)'   }
    case 'Pilot':       return { text: '#fbbf24', bg: 'rgba(251,191,36,0.10)',  border: 'rgba(251,191,36,0.32)',  dot: '#fbbf24', glow: 'rgba(251,191,36,0.2)'   }
    case 'Coming Soon': return { text: '#67e8f9', bg: 'rgba(103,232,249,0.10)', border: 'rgba(103,232,249,0.32)', dot: '#67e8f9', glow: 'rgba(103,232,249,0.15)' }
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  label?: string
}

export default function CitySelector({ label = 'City Explorer' }: Props) {
  const [selected, setSelected] = useState<CityName>('Nashville')

  const city = cityImpact[selected]
  const sty  = statusStyle(city.status)

  const metrics = [
    { icon: '♻️', label: 'Bags Collected',  value: city.bags.toLocaleString(),          color: '#00c8ff', mono: false },
    { icon: '⚖️', label: 'Pounds Recycled', value: `${city.pounds.toLocaleString()} lbs`, color: '#ffffff', mono: false },
    { icon: '🌍', label: 'CO₂ Saved',       value: `${city.co2.toLocaleString()} lbs`,   color: '#5eead4', mono: false },
    { icon: '🌱', label: 'Fundraisers',      value: city.fundraisers.toString(),          color: '#4ade80', mono: false },
    { icon: '🚐', label: 'Active Drivers',   value: city.drivers.toString(),              color: '#ffffff', mono: false },
    { icon: '🏭', label: 'Warehouse',        value: city.warehouse,                        color: 'rgba(0,200,255,0.7)', mono: true },
  ]

  return (
    <div>
      {/* Section label */}
      <p
        style={{
          fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: 'rgba(255,255,255,0.38)', marginBottom: 12,
        }}
      >
        {label}
      </p>

      {/* ── Scrollable city tab strip ─────────────────────────────────────── */}
      <div
        className="flex gap-2 mb-4"
        style={{ overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 }}
      >
        {CITIES.map((name) => {
          const isSelected = name === selected
          const dot        = statusStyle(cityImpact[name].status).dot
          return (
            <button
              key={name}
              onClick={() => setSelected(name)}
              className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11px] font-semibold transition-all"
              style={{
                background: isSelected ? 'rgba(0,200,255,0.14)' : 'rgba(255,255,255,0.05)',
                border:     isSelected ? '1px solid rgba(0,200,255,0.45)' : '1px solid rgba(255,255,255,0.1)',
                color:      isSelected ? '#00c8ff' : 'rgba(255,255,255,0.48)',
                cursor:     'pointer',
                boxShadow:  isSelected ? '0 0 14px rgba(0,200,255,0.18)' : 'none',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease',
              }}
            >
              {/* Status dot per city */}
              <span
                style={{
                  display:      'inline-block',
                  width:        6,
                  height:       6,
                  borderRadius: '50%',
                  background:   dot,
                  flexShrink:   0,
                  boxShadow:    isSelected ? `0 0 5px ${dot}` : 'none',
                }}
              />
              {name}
            </button>
          )
        })}
      </div>

      {/* ── City detail card ──────────────────────────────────────────────── */}
      <div
        key={selected}
        className="rounded-2xl overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.05)',
          border:     '1px solid rgba(0,190,255,0.18)',
          boxShadow:  `0 0 32px ${sty.glow}`,
          animation:  'cityCardIn 0.28s ease',
        }}
      >
        {/* Card header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ background: 'rgba(0,87,231,0.1)', borderBottom: '1px solid rgba(0,190,255,0.1)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(0,190,255,0.12)', border: '1px solid rgba(0,190,255,0.28)', fontSize: 17 }}
            >
              🏙️
            </div>
            <div>
              <p style={{ fontSize: 16, fontWeight: 800, color: '#ffffff', lineHeight: 1.1 }}>{selected}</p>
              <p className="font-mono" style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', marginTop: 2, letterSpacing: '0.04em' }}>
                {city.warehouse}
              </p>
            </div>
          </div>

          {/* Status badge */}
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full shrink-0"
            style={{ background: sty.bg, border: `1px solid ${sty.border}` }}
          >
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: sty.dot,
                boxShadow:  `0 0 5px ${sty.dot}`,
                animation:  city.status === 'Active' ? 'statusPulse 2s ease-in-out infinite' : 'none',
              }}
            />
            <span style={{ fontSize: 10, fontWeight: 700, color: sty.text, letterSpacing: '0.04em' }}>
              {city.status}
            </span>
          </div>
        </div>

        {/* ── Metrics 2-col grid ────────────────────────────────────────── */}
        <div
          className="grid grid-cols-2"
          style={{ gap: '1px', background: 'rgba(255,255,255,0.06)' }}
        >
          {metrics.map((m, i) => {
            const isLastRow  = i >= 4
            const isRightCol = i % 2 === 1
            return (
              <div
                key={m.label}
                className="flex flex-col gap-1.5 px-4 py-3.5"
                style={{
                  background:   'rgba(6,14,36,0.6)',
                  borderBottom: !isLastRow ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  borderRight:  !isRightCol ? '1px solid rgba(255,255,255,0.05)' : 'none',
                }}
              >
                <div className="flex items-center gap-1.5">
                  <span style={{ fontSize: 13, lineHeight: 1 }}>{m.icon}</span>
                  <span
                    style={{
                      fontSize:      10,
                      fontWeight:    600,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color:         'rgba(255,255,255,0.35)',
                    }}
                  >
                    {m.label}
                  </span>
                </div>
                <p
                  className={m.mono ? 'font-mono' : ''}
                  style={{ fontSize: 17, fontWeight: 800, color: m.color, lineHeight: 1, letterSpacing: m.mono ? '0.02em' : '-0.02em' }}
                >
                  {m.value}
                </p>
              </div>
            )
          })}
        </div>

        {/* ── Status footer message ─────────────────────────────────────── */}
        {city.status !== 'Active' && (
          <div
            className="flex items-center gap-2.5 px-5 py-3"
            style={{
              background:  city.status === 'Pilot' ? 'rgba(251,191,36,0.05)' : 'rgba(103,232,249,0.05)',
              borderTop:   `1px solid ${sty.border}`,
            }}
          >
            <span style={{ fontSize: 14, flexShrink: 0 }}>
              {city.status === 'Pilot' ? '🔬' : '🚧'}
            </span>
            <p style={{ fontSize: 11, color: sty.text, lineHeight: 1.5, opacity: 0.8 }}>
              {city.status === 'Pilot'
                ? 'Pilot program active — routes and data are still being optimized.'
                : 'Launching soon — bags are being registered and routes are being planned.'}
            </p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes cityCardIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
        @keyframes statusPulse {
          0%,100% { opacity: 1;   transform: scale(1);    }
          50%      { opacity: 0.4; transform: scale(0.75); }
        }
      `}</style>
    </div>
  )
}
