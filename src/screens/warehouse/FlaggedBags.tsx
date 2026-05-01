import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getFlaggedInspections, approveInspection, overrideInspection } from '../../lib/warehouse'
import { useAuthStore } from '../../store/authStore'
import { Spinner, EmptyState, PhotoLightbox } from '../../components/ui'
import { useToast } from '../../components/ui'
import type { InspectionStatus } from '../../types'

type CardMode = 'idle' | 'approving' | 'overriding' | 'busy'

const OVERRIDE_OPTS: { status: InspectionStatus; label: string; style: React.CSSProperties; activeStyle: React.CSSProperties }[] = [
  {
    status: 'green',
    label: 'Green — Pass',
    style: { background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.25)', color: '#00E676' },
    activeStyle: { background: '#00E676', color: '#061426', boxShadow: '0 0 0 2px rgba(0,230,118,0.5)' },
  },
  {
    status: 'yellow',
    label: 'Yellow — Caution',
    style: { background: 'rgba(255,214,0,0.08)', border: '1px solid rgba(255,214,0,0.25)', color: '#FFD600' },
    activeStyle: { background: '#FFD600', color: '#061426', boxShadow: '0 0 0 2px rgba(255,214,0,0.5)' },
  },
]

function fmt(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

export function FlaggedBags() {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [modes, setModes] = useState<Record<string, CardMode>>({})
  const [overrideStatus, setOverrideStatus] = useState<Record<string, InspectionStatus>>({})
  const [overrideNotes, setOverrideNotes] = useState<Record<string, string>>({})
  const [approveNotes, setApproveNotes] = useState<Record<string, string>>({})
  const [lightbox, setLightbox] = useState<{ photos: string[]; initialIndex: number } | null>(null)

  const { data: flagged = [], isLoading } = useQuery({
    queryKey: ['flagged-inspections'],
    queryFn: getFlaggedInspections,
  })

  const setMode = (id: string, mode: CardMode) =>
    setModes((m) => ({ ...m, [id]: mode }))

  const handleApprove = async (inspectionId: string) => {
    if (!user) return
    setMode(inspectionId, 'busy')
    try {
      await approveInspection(inspectionId, user.id, approveNotes[inspectionId])
      queryClient.invalidateQueries({ queryKey: ['flagged-inspections'] })
      queryClient.invalidateQueries({ queryKey: ['all-inspections'] })
      toast.success('Red flag approved and logged.')
    } catch {
      setMode(inspectionId, 'approving')
      toast.error('Failed to save approval. Try again.')
    }
  }

  const handleOverride = async (bagId: string, inspectionId: string) => {
    if (!user) return
    const status = overrideStatus[inspectionId]
    if (!status) return
    setMode(inspectionId, 'busy')
    try {
      await overrideInspection(bagId, inspectionId, user.id, status, overrideNotes[inspectionId])
      queryClient.invalidateQueries({ queryKey: ['flagged-inspections'] })
      queryClient.invalidateQueries({ queryKey: ['all-inspections'] })
      toast.success(`Overridden to ${status}.`)
    } catch {
      setMode(inspectionId, 'overriding')
      toast.error('Override failed. Try again.')
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner size="md" />
      </div>
    )
  }

  if (flagged.length === 0) {
    return (
      <EmptyState
        icon="✅"
        title="No flagged bags"
        description="All red inspections have been reviewed."
      />
    )
  }

  return (
    <>
      {lightbox && (
        <PhotoLightbox
          photos={lightbox.photos}
          initialIndex={lightbox.initialIndex}
          onClose={() => setLightbox(null)}
        />
      )}

      <div className="space-y-4">
        {flagged.map((insp) => {
          const mode = modes[insp.id] ?? 'idle'
          const isBusy = mode === 'busy'
          const bagCode = insp.bags?.bag_code ?? insp.bag_id.slice(0, 8)
          const photoUrls = insp.inspection_photos.map((p) => p.photo_url)

          return (
            <div
              key={insp.id}
              className="overflow-hidden rounded-2xl"
              style={{
                background: 'rgba(255,23,68,0.04)',
                border: '1px solid rgba(255,23,68,0.25)',
              }}
            >
              {/* Card header */}
              <div
                className="flex items-center gap-3 px-4 py-3"
                style={{ borderBottom: '1px solid rgba(255,23,68,0.15)' }}
              >
                <Link
                  to={`/bag/${insp.bag_id}`}
                  className="font-mono text-sm font-bold transition-opacity hover:opacity-70"
                  style={{ color: '#E0F7FA' }}
                >
                  {bagCode}
                </Link>
                <span
                  className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                  style={{ background: 'rgba(255,23,68,0.15)', color: '#FF1744' }}
                >
                  Red
                </span>
                <span className="ml-auto text-xs" style={{ color: '#7B909C' }}>{fmt(insp.created_at)}</span>
              </div>

              {/* Notes */}
              {insp.notes && (
                <div
                  className="px-4 py-2.5"
                  style={{ background: 'rgba(255,23,68,0.06)' }}
                >
                  <p className="text-sm" style={{ color: 'rgba(255,23,68,0.9)' }}>{insp.notes}</p>
                </div>
              )}

              {/* Photos */}
              {photoUrls.length > 0 && (
                <div className="flex gap-2 overflow-x-auto px-4 py-2.5">
                  {photoUrls.map((url, i) => (
                    <button
                      key={insp.inspection_photos[i].id}
                      type="button"
                      onClick={() => setLightbox({ photos: photoUrls, initialIndex: i })}
                      className="shrink-0 transition-opacity hover:opacity-80"
                    >
                      <img
                        src={url}
                        alt=""
                        className="h-16 w-16 rounded-lg object-cover"
                        style={{ border: '1px solid rgba(255,23,68,0.25)' }}
                      />
                    </button>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="px-4 pb-4 pt-2 space-y-3">
                {mode === 'idle' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setMode(insp.id, 'approving')}
                      className="flex-1 rounded-xl py-2.5 text-sm font-semibold transition-opacity hover:opacity-70"
                      style={{
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        color: '#E0F7FA',
                      }}
                    >
                      Approve Red Flag
                    </button>
                    <button
                      onClick={() => setMode(insp.id, 'overriding')}
                      className="flex-1 rounded-xl py-2.5 text-sm font-semibold transition-opacity hover:opacity-80"
                      style={{
                        background: 'rgba(0,188,212,0.15)',
                        border: '1px solid rgba(0,188,212,0.35)',
                        color: '#00BCD4',
                      }}
                    >
                      Override
                    </button>
                  </div>
                )}

                {mode === 'approving' && (
                  <div className="space-y-2.5">
                    <p className="text-xs font-semibold" style={{ color: '#E0F7FA' }}>
                      Confirm this bag is correctly flagged as Red?
                    </p>
                    <p className="text-xs" style={{ color: '#7B909C' }}>The bag will remain locked pending further action.</p>
                    <textarea
                      value={approveNotes[insp.id] ?? ''}
                      onChange={(e) => setApproveNotes((n) => ({ ...n, [insp.id]: e.target.value }))}
                      rows={2}
                      placeholder="Review notes (optional)…"
                      className="w-full resize-none rounded-lg px-3 py-2 text-sm outline-none transition"
                      style={{
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(0,188,212,0.2)',
                        color: '#E0F7FA',
                      }}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => setMode(insp.id, 'idle')}
                        className="flex-1 rounded-xl py-2 text-sm font-medium transition-opacity hover:opacity-70"
                        style={{
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          color: '#7B909C',
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleApprove(insp.id)}
                        disabled={isBusy}
                        className="flex-1 rounded-xl py-2 text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-40"
                        style={{
                          background: 'rgba(255,255,255,0.1)',
                          border: '1px solid rgba(255,255,255,0.15)',
                          color: '#E0F7FA',
                        }}
                      >
                        Confirm Approval
                      </button>
                    </div>
                  </div>
                )}

                {mode === 'overriding' && (
                  <div className="space-y-2.5">
                    <p className="text-xs font-semibold" style={{ color: '#E0F7FA' }}>Override to new status:</p>
                    <div className="flex gap-2">
                      {OVERRIDE_OPTS.map((opt) => (
                        <button
                          key={opt.status}
                          onClick={() => setOverrideStatus((s) => ({ ...s, [insp.id]: opt.status }))}
                          className="flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all"
                          style={overrideStatus[insp.id] === opt.status ? opt.activeStyle : opt.style}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={overrideNotes[insp.id] ?? ''}
                      onChange={(e) => setOverrideNotes((n) => ({ ...n, [insp.id]: e.target.value }))}
                      rows={2}
                      placeholder="Reason for override…"
                      className="w-full resize-none rounded-lg px-3 py-2 text-sm outline-none transition"
                      style={{
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(0,188,212,0.2)',
                        color: '#E0F7FA',
                      }}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => setMode(insp.id, 'idle')}
                        className="flex-1 rounded-xl py-2 text-sm font-medium transition-opacity hover:opacity-70"
                        style={{
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          color: '#7B909C',
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => insp.bags && handleOverride(insp.bags.id, insp.id)}
                        disabled={!overrideStatus[insp.id] || isBusy}
                        className="flex-1 rounded-xl py-2 text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-40"
                        style={{
                          background: 'rgba(0,188,212,0.15)',
                          border: '1px solid rgba(0,188,212,0.35)',
                          color: '#00BCD4',
                        }}
                      >
                        Confirm Override
                      </button>
                    </div>
                  </div>
                )}

                {mode === 'busy' && (
                  <div className="flex items-center justify-center gap-2 py-2">
                    <Spinner size="sm" />
                    <span className="text-xs" style={{ color: '#7B909C' }}>Saving…</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
