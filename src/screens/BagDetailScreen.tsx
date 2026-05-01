import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getBagWithLatestInspection } from '../lib/bags'
import { useAuthStore } from '../store/authStore'
import { BagStatusBadge, InspectionStatusBadge } from '../components/BagStatusBadge'
import { FullPageSpinner, PhotoLightbox } from '../components/ui'

function fmt(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

export default function BagDetailScreen() {
  const { bagId } = useParams<{ bagId: string }>()
  const navigate = useNavigate()
  const { role } = useAuthStore()
  const [overrideConfirm, setOverrideConfirm] = useState(false)
  const [lightbox, setLightbox] = useState<{ photos: string[]; initialIndex: number } | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['bag', bagId],
    queryFn: () => getBagWithLatestInspection(bagId!),
    enabled: !!bagId,
  })

  if (isLoading) return <FullPageSpinner />

  if (error || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4" style={{ background: '#060e24' }}>
        <p className="text-sm" style={{ color: '#FF1744' }}>Failed to load bag</p>
        <Link
          to="/scan"
          className="text-sm transition-opacity hover:opacity-70"
          style={{ color: '#00c8ff' }}
        >
          ← Back to scanner
        </Link>
      </div>
    )
  }

  const { bag, latestInspection } = data
  const isRedLocked = latestInspection?.status === 'red'
  const isSupervisor = role === 'warehouse_supervisor' || role === 'admin'
  const photoUrls = latestInspection?.inspection_photos?.map((p) => p.photo_url) ?? []

  return (
    <div className="min-h-screen" style={{ background: '#060e24' }}>
      {lightbox && (
        <PhotoLightbox
          photos={lightbox.photos}
          initialIndex={lightbox.initialIndex}
          onClose={() => setLightbox(null)}
        />
      )}

      <header
        className="flex items-center justify-between px-4 py-3"
        style={{
          background: 'rgba(6,14,36,0.95)',
          borderBottom: '1px solid rgba(0,190,255,0.15)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl font-extrabold" style={{ color: '#ffffff' }}>Cyan's</span>
          <span className="text-xl font-extrabold" style={{ color: '#00c8ff' }}>Brooklynn</span>
          <span style={{ color: 'rgba(0,200,255,0.3)' }}>|</span>
          <span className="font-mono text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.6)' }}>{bag.bag_code}</span>
        </div>
        <Link
          to="/scan"
          className="text-sm transition-opacity hover:opacity-70"
          style={{ color: 'rgba(255,255,255,0.4)' }}
        >
          ← Scan
        </Link>
      </header>

      <main className="mx-auto max-w-sm px-4 py-6 space-y-4">
        {/* Bag info card */}
        <div
          className="rounded-2xl p-5 space-y-3"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(0,190,255,0.15)',
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>Bag Code</span>
            <span className="font-mono text-sm font-bold" style={{ color: '#ffffff' }}>{bag.bag_code}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>Status</span>
            <BagStatusBadge status={bag.status} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>Created</span>
            <span className="text-xs" style={{ color: '#ffffff' }}>{fmt(bag.created_at)}</span>
          </div>
          {bag.updated_at !== bag.created_at && (
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>Updated</span>
              <span className="text-xs" style={{ color: '#ffffff' }}>{fmt(bag.updated_at)}</span>
            </div>
          )}
        </div>

        {/* Latest inspection card */}
        <div
          className="rounded-2xl p-5"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(0,190,255,0.15)',
          }}
        >
          <h2 className="mb-3 text-sm font-semibold" style={{ color: '#ffffff' }}>Latest Inspection</h2>
          {latestInspection ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>Result</span>
                <InspectionStatusBadge status={latestInspection.status} />
              </div>
              {latestInspection.notes && (
                <div>
                  <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>Notes</span>
                  <p
                    className="mt-1 rounded-lg px-3 py-2 text-sm"
                    style={{ background: 'rgba(255,255,255,0.05)', color: '#ffffff' }}
                  >
                    {latestInspection.notes}
                  </p>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>Date</span>
                <span className="text-xs" style={{ color: '#ffffff' }}>{fmt(latestInspection.created_at)}</span>
              </div>
              {photoUrls.length > 0 && (
                <div>
                  <span
                    className="mb-1.5 block text-xs font-medium uppercase tracking-wide"
                    style={{ color: 'rgba(255,255,255,0.4)' }}
                  >
                    Photos ({photoUrls.length})
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {photoUrls.map((url, i) => (
                      <button
                        key={latestInspection.inspection_photos![i].id}
                        type="button"
                        onClick={() => setLightbox({ photos: photoUrls, initialIndex: i })}
                        className="transition-opacity hover:opacity-80"
                      >
                        <img
                          src={url}
                          alt="Inspection"
                          className="h-20 w-full rounded-lg object-cover"
                          style={{ border: '1px solid rgba(0,190,255,0.15)' }}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>No inspections recorded yet.</p>
          )}
        </div>

        {/* Red lock notice */}
        {isRedLocked && (
          <div
            className="rounded-xl p-4 flex items-start gap-3"
            style={{
              background: 'rgba(255,23,68,0.08)',
              border: '1px solid rgba(255,23,68,0.25)',
            }}
          >
            <svg
              className="mt-0.5 h-5 w-5 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              style={{ color: '#FF1744' }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#FF1744' }}>Bag is Red-Locked</p>
              <p className="mt-0.5 text-xs" style={{ color: 'rgba(255,23,68,0.7)' }}>
                {isSupervisor
                  ? 'Supervisor override required to re-inspect.'
                  : 'Only a warehouse supervisor or admin can re-inspect this bag.'}
              </p>
            </div>
          </div>
        )}

        {/* Primary action */}
        {!isRedLocked && (
          <button
            onClick={() => navigate(`/bag/${bagId}/inspect`)}
            className="w-full rounded-xl py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{
              background: 'linear-gradient(135deg, #0057e7, #00c8ff)',
              boxShadow: '0 4px 24px rgba(0,190,255,0.35)',
            }}
          >
            Inspect This Bag
          </button>
        )}

        {/* Supervisor override flow */}
        {isRedLocked && isSupervisor && !overrideConfirm && (
          <button
            onClick={() => setOverrideConfirm(true)}
            className="w-full rounded-xl py-3 text-sm font-semibold transition-opacity hover:opacity-70"
            style={{
              background: 'rgba(255,23,68,0.1)',
              border: '1px solid rgba(255,23,68,0.3)',
              color: '#FF1744',
            }}
          >
            Override Lock &amp; Re-Inspect
          </button>
        )}

        {isRedLocked && isSupervisor && overrideConfirm && (
          <div
            className="rounded-xl p-4 space-y-3"
            style={{
              background: 'rgba(255,23,68,0.08)',
              border: '1px solid rgba(255,23,68,0.25)',
            }}
          >
            <p className="text-sm font-semibold" style={{ color: '#FF1744' }}>Confirm supervisor override?</p>
            <p className="text-xs" style={{ color: 'rgba(255,23,68,0.7)' }}>
              You are overriding the red lock as a supervisor. This action will be logged.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setOverrideConfirm(false)}
                className="flex-1 rounded-lg py-2 text-sm font-medium transition-opacity hover:opacity-70"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,23,68,0.25)',
                  color: '#FF1744',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => navigate(`/bag/${bagId}/inspect`, { state: { supervisorOverride: true } })}
                className="flex-1 rounded-lg py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{
                  background: '#FF1744',
                  boxShadow: '0 0 12px rgba(255,23,68,0.3)',
                }}
              >
                Confirm Override
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
