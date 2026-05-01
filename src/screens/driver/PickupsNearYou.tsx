import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDemoStore, type PickupInput } from '../../store/demoStore'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Pickup {
  id: string
  address: string
  customer: string
  distance: string
  eta: string
  bags: number
}

interface ZipZone {
  zip: string
  neighborhood: string
  distanceRange: string
  demandLevel: string
  pickupCount: number
  bagTotal: number
  iconBg: string
  dotColor: string
  pillBg: string
  pillColor: string
  pickups: Pickup[]
}

// ── Demo data (sorted highest demand first) ────────────────────────────────────

const ZONES: ZipZone[] = [
  {
    zip: '37206',
    neighborhood: 'East Nashville',
    distanceRange: '0.6–2.1 mi',
    demandLevel: 'Highest demand',
    pickupCount: 4,
    bagTotal: 11,
    iconBg: 'rgba(0,230,118,0.15)',
    dotColor: '#00E676',
    pillBg: 'rgba(0,230,118,0.15)',
    pillColor: '#00E676',
    pickups: [
      { id: 'p1', address: '114 S 11th St',     customer: 'J. Williams', distance: '0.6 mi', eta: '3 min', bags: 3 },
      { id: 'p2', address: '832 Chicamauga Ave', customer: 'M. Thompson', distance: '1.2 mi', eta: '5 min', bags: 3 },
      { id: 'p3', address: '1409 McGavock Pike', customer: 'T. Harris',   distance: '1.7 mi', eta: '7 min', bags: 2 },
      { id: 'p4', address: '407 S 14th St',      customer: 'R. Davis',    distance: '2.1 mi', eta: '9 min', bags: 3 },
    ],
  },
  {
    zip: '37210',
    neighborhood: 'South Nashville',
    distanceRange: '1.4–2.0 mi',
    demandLevel: 'High demand',
    pickupCount: 3,
    bagTotal: 8,
    iconBg: 'rgba(74,222,128,0.13)',
    dotColor: '#4ade80',
    pillBg: 'rgba(74,222,128,0.13)',
    pillColor: '#4ade80',
    pickups: [
      { id: 'p6', address: '800 Wedgewood Ave', customer: 'C. Smith',  distance: '1.4 mi', eta: '6 min', bags: 3 },
      { id: 'p7', address: '1102 Kirkwood Ave', customer: 'L. Brown',  distance: '1.7 mi', eta: '7 min', bags: 2 },
      { id: 'p8', address: '310 Chestnut St',   customer: 'P. Wilson', distance: '2.0 mi', eta: '8 min', bags: 3 },
    ],
  },
  {
    zip: '37201',
    neighborhood: 'Downtown Nashville',
    distanceRange: '0.8–1.2 mi',
    demandLevel: 'Moderate demand',
    pickupCount: 2,
    bagTotal: 4,
    iconBg: 'rgba(251,191,36,0.12)',
    dotColor: '#FBBF24',
    pillBg: 'rgba(251,191,36,0.12)',
    pillColor: '#FBBF24',
    pickups: [
      { id: 'p9',  address: '111 Commerce St', customer: 'N. Moore',  distance: '0.8 mi', eta: '4 min', bags: 2 },
      { id: 'p10', address: '200 4th Ave N',   customer: 'K. Taylor', distance: '1.2 mi', eta: '5 min', bags: 2 },
    ],
  },
  {
    zip: '37207',
    neighborhood: 'North Nashville',
    distanceRange: '3.2 mi',
    demandLevel: 'Low demand',
    pickupCount: 2,
    bagTotal: 4,
    iconBg: 'rgba(14,165,233,0.10)',
    dotColor: '#38bdf8',
    pillBg: 'rgba(14,165,233,0.10)',
    pillColor: '#38bdf8',
    pickups: [
      { id: 'p11', address: '1502 Haynes St Apt 503', customer: 'D. Jackson',  distance: '3.2 mi', eta: '14 min', bags: 2 },
      { id: 'p12', address: '1502 Haynes St Apt 405', customer: 'A. Peterson', distance: '3.2 mi', eta: '14 min', bags: 2 },
    ],
  },
]

// ── Component ──────────────────────────────────────────────────────────────────

export function PickupsNearYou({
  isOnline,
  onSelectionChange,
  resetKey = 0,
}: {
  isOnline: boolean
  onSelectionChange: (count: number, pickups: PickupInput[]) => void
  resetKey?: number
}) {
  const navigate            = useNavigate()
  const { activeRoute }     = useDemoStore()

  const [expandedZip, setExpandedZip]         = useState<string | null>('37206')
  const [selectedPickups, setSelectedPickups] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (resetKey > 0) setSelectedPickups(new Set())
  }, [resetKey])

  const totalSelected = selectedPickups.size
  const totalPickups  = ZONES.reduce((s, z) => s + z.pickupCount, 0)
  const totalBags     = ZONES.reduce((s, z) => s + z.bagTotal, 0)
  const totalZips     = ZONES.length

  const getPickupInputs = (ids: Set<string>): PickupInput[] => {
    const result: PickupInput[] = []
    for (const zone of ZONES) {
      for (const p of zone.pickups) {
        if (ids.has(p.id)) result.push({ id: p.id, address: p.address, bags: p.bags })
      }
    }
    return result
  }

  useEffect(() => {
    onSelectionChange(totalSelected, getPickupInputs(selectedPickups))
  }, [totalSelected, onSelectionChange])

  const togglePickup = (id: string) => {
    if (!isOnline) return
    setSelectedPickups((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const toggleZipAll = (zone: ZipZone) => {
    if (!isOnline) return
    const ids = zone.pickups.map((p) => p.id)
    const allSelected = ids.every((id) => selectedPickups.has(id))
    setSelectedPickups((prev) => {
      const next = new Set(prev)
      ids.forEach((id) => (allSelected ? next.delete(id) : next.add(id)))
      return next
    })
  }

  const selectedInZone = (zone: ZipZone) =>
    zone.pickups.filter((p) => selectedPickups.has(p.id)).length

  return (
    <div className="px-4 pt-4 pb-4" style={{ animation: 'fadeSlideUp 0.3s ease both' }}>

      {/* ── Active Route hero card ───────────────────────────────────────── */}
      {activeRoute && activeRoute.routeStatus !== 'completed' && (() => {
        const totalStops = activeRoute.stops.length
        const doneStops  = activeRoute.stops.filter((s) => s.status === 'completed').length

        return (
          <button
            type="button"
            onClick={() => navigate('/dashboard/driver/route-map')}
            className="w-full p-6 rounded-2xl border border-cyan-400/30 bg-gradient-to-r from-cyan-500/10 to-transparent shadow-[0_0_20px_rgba(0,188,212,0.25)] text-left mb-5 active:scale-[0.98] transition-transform"
          >
            {/* Label */}
            <div className="flex items-center justify-between mb-1">
              <p className="text-lg font-bold" style={{ color: '#ffffff' }}>
                Active Route
              </p>
              <span className="text-green-400 text-xs font-semibold">
                ● Active
              </span>
            </div>

            {/* Stop count */}
            <p className="text-sm text-gray-300">
              {totalStops} stop{totalStops !== 1 ? 's' : ''} · {doneStops} done
            </p>

            {/* View Route button */}
            <div className="mt-4">
              <span className="text-cyan-400 font-semibold hover:text-cyan-300 cursor-pointer">
                View Route →
              </span>
            </div>
          </button>
        )
      })()}

      {/* ── Summary strip ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {[
          { value: String(totalPickups),  label: 'PICKUPS'    },
          { value: String(totalBags),     label: 'BAGS'       },
          { value: String(totalSelected), label: 'SELECTED',   hl: totalSelected > 0 },
          { value: String(totalZips),     label: 'ZIP ZONES'  },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-2xl p-2.5 flex flex-col gap-0.5"
            style={{
              background: card.hl ? 'rgba(0,188,212,0.1)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${card.hl ? 'rgba(0,188,212,0.4)' : 'rgba(255,255,255,0.08)'}`,
            }}
          >
            <p style={{ fontSize: 17, color: card.hl ? '#00BCD4' : '#ffffff', fontWeight: 700, lineHeight: 1.15 }}>
              {card.value}
            </p>
            <p style={{ fontSize: 9, color: card.hl ? '#00BCD4' : 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', lineHeight: 1.2 }}>
              {card.label}
            </p>
          </div>
        ))}
      </div>

      {/* ── Offline pill / online info bar ───────────────────────────────── */}
      {!isOnline ? (
        <div className="flex items-center justify-center mb-4">
          <div
            className="flex items-center gap-2 rounded-full px-4 py-2"
            style={{ background: 'rgba(255,60,60,0.10)', border: '1px solid rgba(255,80,80,0.35)' }}
          >
            <span style={{ fontSize: 12 }}>⚠️</span>
            <p style={{ fontSize: 11, color: 'rgba(255,120,120,0.95)', fontWeight: 500 }}>
              View only — tap status badge to go online
            </p>
          </div>
        </div>
      ) : (
        <div
          className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 mb-4"
          style={{ background: 'rgba(0,188,212,0.07)', border: '1px solid rgba(0,188,212,0.2)' }}
        >
          <span style={{ fontSize: 13 }}>ℹ️</span>
          <p style={{ fontSize: 11, color: 'rgba(0,210,255,0.75)' }}>
            Tap a ZIP card to expand, select pickups &amp; add to route
          </p>
        </div>
      )}

      {/* ── Section label ────────────────────────────────────────────────── */}
      <p
        style={{
          fontSize: 10,
          color: '#00BCD4',
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: 12,
        }}
      >
        PICKUPS NEAR YOU — SORTED BY DEMAND
      </p>

      {/* ── ZIP accordion cards ──────────────────────────────────────────── */}
      <div className="space-y-3">
        {ZONES.map((zone) => {
          const isExpanded = expandedZip === zone.zip
          const selCount   = selectedInZone(zone)

          return (
            <div
              key={zone.zip}
              className="rounded-2xl overflow-hidden"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${isExpanded ? `${zone.dotColor}35` : 'rgba(255,255,255,0.08)'}`,
                boxShadow: isExpanded ? `0 0 18px ${zone.dotColor}10` : 'none',
                transition: 'border-color 0.25s, box-shadow 0.25s',
              }}
            >
              {/* ── Header row ── */}
              <button
                onClick={() => setExpandedZip(isExpanded ? null : zone.zip)}
                className="w-full flex items-center gap-3 px-4 py-4 text-left active:opacity-80 transition-opacity"
              >
                {/* Circular demand icon */}
                <div
                  className="shrink-0 flex items-center justify-center rounded-full"
                  style={{
                    width: 44,
                    height: 44,
                    background: zone.iconBg,
                    border: `1.5px solid ${zone.dotColor}50`,
                    boxShadow: `0 0 12px ${zone.dotColor}20`,
                  }}
                >
                  <div
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      background: zone.dotColor,
                      boxShadow: `0 0 6px ${zone.dotColor}80`,
                    }}
                  />
                </div>

                {/* ZIP + neighborhood + distance */}
                <div className="flex-1 min-w-0">
                  <p style={{ fontSize: 16, color: '#ffffff', fontWeight: 700, lineHeight: 1.2 }}>
                    {zone.zip}
                  </p>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 1 }}>
                    {zone.neighborhood}
                  </p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.30)', marginTop: 1 }}>
                    {zone.distanceRange}
                  </p>
                </div>

                {/* Badge + demand + chevron */}
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span
                    className="rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap"
                    style={{ background: zone.pillBg, color: zone.pillColor }}
                  >
                    {zone.pickupCount} pickups · {zone.bagTotal} bags
                  </span>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
                    {zone.demandLevel}
                  </span>
                </div>

                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="rgba(255,255,255,0.35)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="shrink-0 ml-1"
                  style={{
                    transition: 'transform 0.3s ease',
                    transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                  }}
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>

              {/* ── Expanded content ── */}
              <div
                style={{
                  maxHeight: isExpanded ? 1200 : 0,
                  overflow: 'hidden',
                  transition: 'max-height 0.35s ease',
                }}
              >
                <div style={{ borderTop: `1px solid ${zone.dotColor}18` }}>

                  {/* Pickup rows */}
                  {zone.pickups.map((pickup, i) => {
                    const checked = selectedPickups.has(pickup.id)
                    return (
                      <button
                        key={pickup.id}
                        onClick={() => togglePickup(pickup.id)}
                        className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors"
                        style={{
                          borderBottom: i < zone.pickups.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                          opacity: !isOnline ? 0.5 : 1,
                          cursor: isOnline ? 'pointer' : 'default',
                          background: checked ? `${zone.dotColor}08` : 'transparent',
                        }}
                      >
                        {/* Checkbox */}
                        <div
                          className="shrink-0 flex items-center justify-center rounded-md"
                          style={{
                            width: 22,
                            height: 22,
                            background: checked ? `${zone.dotColor}22` : 'rgba(255,255,255,0.05)',
                            border: `1.5px solid ${checked ? zone.dotColor : 'rgba(255,255,255,0.18)'}`,
                            transition: 'border-color 0.15s, background 0.15s',
                          }}
                        >
                          {checked && (
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke={zone.dotColor}
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          )}
                        </div>

                        {/* Address + meta */}
                        <div className="flex-1 min-w-0">
                          <p style={{ fontSize: 13, color: '#ffffff', fontWeight: 600 }}>
                            {pickup.address}
                          </p>
                          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', marginTop: 2 }}>
                            {pickup.customer} · {pickup.distance} · {pickup.eta}
                          </p>
                        </div>

                        {/* Bag count */}
                        <div className="shrink-0 flex flex-col items-end gap-0.5">
                          <span style={{ fontSize: 18, fontWeight: 700, color: '#fde047', lineHeight: 1 }}>
                            {pickup.bags}
                          </span>
                          <span style={{ fontSize: 9, color: 'rgba(253,224,71,0.55)', fontWeight: 600, letterSpacing: '0.04em' }}>
                            BAGS
                          </span>
                        </div>
                      </button>
                    )
                  })}

                  {/* Accept-all button for this ZIP */}
                  <div className="px-4 pb-4 pt-3">
                    <button
                      onClick={() => toggleZipAll(zone)}
                      disabled={!isOnline}
                      className="w-full rounded-xl py-3 text-xs font-bold transition-all disabled:cursor-not-allowed"
                      style={
                        selCount > 0 && isOnline
                          ? {
                              background: `linear-gradient(135deg, ${zone.dotColor}80, ${zone.dotColor}40)`,
                              border: `1px solid ${zone.dotColor}60`,
                              color: '#fff',
                              boxShadow: `0 3px 14px ${zone.dotColor}25`,
                            }
                          : {
                              background: 'rgba(255,255,255,0.04)',
                              border: '1px solid rgba(255,255,255,0.10)',
                              color: 'rgba(255,255,255,0.35)',
                            }
                      }
                    >
                      {selCount > 0
                        ? `Deselect all in ${zone.zip} (${selCount} selected)`
                        : `Select all pickups in ${zone.zip}`}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

    </div>
  )
}
