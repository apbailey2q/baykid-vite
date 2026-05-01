import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getAllDrivers, createRouteForDriver } from '../../lib/driver'
import { useToast } from '../../components/ui/Toast'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import type { Route } from '../../types'

interface StopInput {
  id: number
  address: string
  zipCode: string
  bagCode: string
}

let stopIdCounter = 1

function newStop(): StopInput {
  return { id: stopIdCounter++, address: '', zipCode: '', bagCode: '' }
}

export function RouteDispatch() {
  const qc = useQueryClient()
  const toast = useToast()

  const [routeName, setRouteName] = useState('')
  const [driverId, setDriverId] = useState('')
  const [stops, setStops] = useState<StopInput[]>([newStop()])
  const [created, setCreated] = useState<Route | null>(null)

  const { data: drivers = [], isLoading: loadingDrivers } = useQuery({
    queryKey: ['all-drivers'],
    queryFn: getAllDrivers,
  })

  const createMut = useMutation({
    mutationFn: () =>
      createRouteForDriver(
        driverId,
        routeName.trim() || 'New Route',
        stops
          .filter((s) => s.address.trim())
          .map((s) => ({ address: s.address.trim(), zipCode: s.zipCode.trim(), bagCode: s.bagCode.trim() || undefined })),
      ),
    onSuccess: (route) => {
      setCreated(route)
      qc.invalidateQueries({ queryKey: ['admin-stats'] })
      toast.success(`Route "${route.name}" dispatched to driver`)
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to create route'),
  })

  const addStop = () => setStops((s) => [...s, newStop()])
  const removeStop = (id: number) => setStops((s) => s.filter((st) => st.id !== id))
  const updateStop = (id: number, field: keyof StopInput, value: string) =>
    setStops((s) => s.map((st) => (st.id === id ? { ...st, [field]: value } : st)))

  const canSubmit = driverId && stops.some((s) => s.address.trim()) && !createMut.isPending

  const resetForm = () => {
    setRouteName('')
    setDriverId('')
    setStops([newStop()])
    setCreated(null)
  }

  // ── Success state ────────────────────────────────────────────────────────────
  if (created) {
    return (
      <div className="space-y-4">
        <div
          className="rounded-2xl p-6 text-center space-y-3"
          style={{ background: 'rgba(0,230,118,0.06)', border: '1px solid rgba(0,230,118,0.25)' }}
        >
          <span className="text-4xl block">✅</span>
          <p className="text-base font-extrabold" style={{ color: '#4ade80' }}>Route Dispatched!</p>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
            <span style={{ color: '#ffffff' }}>{created.name}</span> is now pending for the assigned driver.
          </p>
          <button
            onClick={resetForm}
            className="mt-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
            style={{ background: 'linear-gradient(135deg,#0057e7,#00c8ff)', boxShadow: '0 4px 16px rgba(0,190,255,0.3)' }}
          >
            Create Another Route
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">

      {/* Route name */}
      <div>
        <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Route Name
        </label>
        <input
          value={routeName}
          onChange={(e) => setRouteName(e.target.value)}
          placeholder="e.g. Monday AM – South District"
          className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(0,190,255,0.15)',
            color: '#ffffff',
          }}
        />
      </div>

      {/* Driver selector */}
      <div>
        <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Assign Driver
        </label>
        {loadingDrivers ? (
          <div className="flex items-center gap-2 py-2">
            <Spinner size="sm" />
            <span className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Loading drivers…</span>
          </div>
        ) : drivers.length === 0 ? (
          <EmptyState icon="🚗" title="No approved drivers" description="Approve a driver first in the Users tab." />
        ) : (
          <select
            value={driverId}
            onChange={(e) => setDriverId(e.target.value)}
            className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: `1px solid ${driverId ? 'rgba(0,200,255,0.4)' : 'rgba(0,190,255,0.15)'}`,
              color: driverId ? '#ffffff' : 'rgba(255,255,255,0.4)',
            }}
          >
            <option value="" style={{ background: '#060e24' }}>Select a driver…</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id} style={{ background: '#060e24' }}>
                {d.full_name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Stops */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Stops ({stops.length})
          </label>
          <button
            onClick={addStop}
            className="text-xs font-semibold transition-opacity hover:opacity-70"
            style={{ color: '#00c8ff' }}
          >
            + Add Stop
          </button>
        </div>

        <div className="space-y-3">
          {stops.map((stop, idx) => (
            <div
              key={stop.id}
              className="rounded-xl p-3 space-y-2"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(0,190,255,0.15)' }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold" style={{ color: '#00c8ff' }}>Stop #{idx + 1}</span>
                {stops.length > 1 && (
                  <button
                    onClick={() => removeStop(stop.id)}
                    className="text-xs transition-opacity hover:opacity-70"
                    style={{ color: '#FF1744' }}
                  >
                    Remove
                  </button>
                )}
              </div>

              <input
                value={stop.address}
                onChange={(e) => updateStop(stop.id, 'address', e.target.value)}
                placeholder="Street address *"
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#ffffff',
                }}
              />

              <div className="flex gap-2">
                <input
                  value={stop.zipCode}
                  onChange={(e) => updateStop(stop.id, 'zipCode', e.target.value)}
                  placeholder="ZIP code"
                  className="w-28 rounded-lg px-3 py-2 text-sm outline-none"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#ffffff',
                  }}
                />
                <input
                  value={stop.bagCode}
                  onChange={(e) => updateStop(stop.id, 'bagCode', e.target.value.toUpperCase())}
                  placeholder="Bag code (optional)"
                  className="flex-1 rounded-lg px-3 py-2 font-mono text-sm outline-none"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#ffffff',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Submit */}
      <button
        onClick={() => createMut.mutate()}
        disabled={!canSubmit}
        className="w-full rounded-xl py-3.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40 flex items-center justify-center gap-2"
        style={{ background: 'linear-gradient(135deg,#0057e7,#00c8ff)', boxShadow: '0 4px 24px rgba(0,190,255,0.35)' }}
      >
        {createMut.isPending ? (
          <><Spinner size="sm" color="#fff" /> Dispatching…</>
        ) : (
          'Dispatch Route'
        )}
      </button>
    </div>
  )
}
