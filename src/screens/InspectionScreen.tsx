import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getBagWithLatestInspection, createInspection, uploadInspectionPhoto } from '../lib/bags'
import { useAuthStore } from '../store/authStore'
import { InspectionStatusBadge } from '../components/BagStatusBadge'
import { FullPageSpinner, Spinner, useToast } from '../components/ui'
import type { InspectionStatus } from '../types'

interface LocationState {
  supervisorOverride?: boolean
}

const STATUS_OPTS: {
  status: InspectionStatus
  label: string
  activeStyle: React.CSSProperties
  idleStyle: React.CSSProperties
}[] = [
  {
    status: 'green',
    label: 'Green',
    activeStyle: {
      background: '#00E676',
      color: '#061426',
      boxShadow: '0 0 0 2px rgba(0,230,118,0.6), 0 0 0 4px rgba(0,230,118,0.15)',
    },
    idleStyle: {
      background: 'rgba(0,230,118,0.1)',
      border: '1px solid rgba(0,230,118,0.3)',
      color: '#00E676',
    },
  },
  {
    status: 'yellow',
    label: 'Yellow',
    activeStyle: {
      background: '#FFD600',
      color: '#061426',
      boxShadow: '0 0 0 2px rgba(255,214,0,0.6), 0 0 0 4px rgba(255,214,0,0.15)',
    },
    idleStyle: {
      background: 'rgba(255,214,0,0.1)',
      border: '1px solid rgba(255,214,0,0.3)',
      color: '#FFD600',
    },
  },
  {
    status: 'red',
    label: 'Red',
    activeStyle: {
      background: '#FF1744',
      color: '#fff',
      boxShadow: '0 0 0 2px rgba(255,23,68,0.6), 0 0 0 4px rgba(255,23,68,0.15)',
    },
    idleStyle: {
      background: 'rgba(255,23,68,0.1)',
      border: '1px solid rgba(255,23,68,0.3)',
      color: '#FF1744',
    },
  },
]

export default function InspectionScreen() {
  const { bagId } = useParams<{ bagId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { user, role } = useAuthStore()
  const toast = useToast()
  const supervisorOverride = (location.state as LocationState)?.supervisorOverride ?? false

  const [inspStatus, setInspStatus] = useState<InspectionStatus>('green')
  const [notes, setNotes] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [submitLabel, setSubmitLabel] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const previewsRef = useRef<string[]>([])

  const { data, isLoading } = useQuery({
    queryKey: ['bag', bagId],
    queryFn: () => getBagWithLatestInspection(bagId!),
    enabled: !!bagId,
  })

  useEffect(() => {
    previewsRef.current = previews
    return () => previewsRef.current.forEach(URL.revokeObjectURL)
  }, [previews])

  const isRedLocked = data?.latestInspection?.status === 'red'
  const isSupervisor = role === 'warehouse_supervisor' || role === 'admin'
  const isBlocked = isRedLocked && !supervisorOverride && !isSupervisor

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    const newPreviews = files.map((f) => URL.createObjectURL(f))
    setPhotos((p) => [...p, ...files])
    setPreviews((p) => [...p, ...newPreviews])
    e.target.value = ''
  }

  const removePhoto = (idx: number) => {
    URL.revokeObjectURL(previews[idx])
    setPhotos((p) => p.filter((_, i) => i !== idx))
    setPreviews((p) => p.filter((_, i) => i !== idx))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !bagId) return
    setSubmitting(true)

    try {
      setSubmitLabel('Saving inspection…')
      const inspection = await createInspection(bagId, user.id, inspStatus, notes)

      if (photos.length > 0) {
        for (let i = 0; i < photos.length; i++) {
          setSubmitLabel(`Uploading photo ${i + 1} of ${photos.length}…`)
          await uploadInspectionPhoto(inspection.id, photos[i])
        }
      }

      queryClient.invalidateQueries({ queryKey: ['bag', bagId] })
      navigate(`/bag/${bagId}`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Submission failed. Try again.')
      setSubmitting(false)
      setSubmitLabel('')
    }
  }

  if (isLoading) return <FullPageSpinner />

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#061426' }}>
      <header
        className="flex items-center justify-between px-4 py-3"
        style={{
          background: 'rgba(6,20,38,0.95)',
          borderBottom: '1px solid rgba(0,188,212,0.15)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl font-extrabold" style={{ color: '#00BCD4' }}>BayKid</span>
          <span style={{ color: 'rgba(0,188,212,0.3)' }}>|</span>
          <span className="text-sm font-medium" style={{ color: '#7B909C' }}>
            Inspect{' '}
            <span className="font-mono font-bold" style={{ color: '#E0F7FA' }}>{data?.bag.bag_code}</span>
          </span>
        </div>
        <Link
          to={`/bag/${bagId}`}
          className="text-sm transition-opacity hover:opacity-70"
          style={{ color: '#7B909C' }}
        >
          ← Back
        </Link>
      </header>

      <main className="mx-auto max-w-sm px-4 py-6">
        {/* Blocked — non-supervisor on red-locked bag */}
        {isBlocked && (
          <div
            className="rounded-2xl p-6 text-center"
            style={{
              background: 'rgba(255,23,68,0.08)',
              border: '1px solid rgba(255,23,68,0.25)',
            }}
          >
            <svg
              className="mx-auto mb-3 h-10 w-10"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
              style={{ color: '#FF1744' }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
            <p className="font-semibold" style={{ color: '#FF1744' }}>Bag is Red-Locked</p>
            <p className="mt-1 text-xs" style={{ color: 'rgba(255,23,68,0.7)' }}>
              A warehouse supervisor must override this lock before re-inspection.
            </p>
            <Link
              to={`/bag/${bagId}`}
              className="mt-4 inline-block rounded-lg px-4 py-2 text-sm font-medium transition-opacity hover:opacity-70"
              style={{
                background: 'rgba(255,23,68,0.15)',
                border: '1px solid rgba(255,23,68,0.3)',
                color: '#FF1744',
              }}
            >
              Go Back
            </Link>
          </div>
        )}

        {!isBlocked && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Supervisor override banner */}
            {supervisorOverride && (
              <div
                className="flex items-center gap-2 rounded-xl px-3 py-2.5"
                style={{
                  background: 'rgba(255,193,7,0.08)',
                  border: '1px solid rgba(255,193,7,0.25)',
                }}
              >
                <svg
                  className="h-4 w-4 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  style={{ color: '#FFD600' }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <p className="text-xs font-medium" style={{ color: '#FFD600' }}>
                  Supervisor override active — re-inspecting red-locked bag
                </p>
              </div>
            )}

            {/* Previous inspection summary (if locked) */}
            {isRedLocked && isSupervisor && data?.latestInspection && (
              <div
                className="flex items-center justify-between rounded-xl px-4 py-3"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(0,188,212,0.15)',
                }}
              >
                <span className="text-sm" style={{ color: '#7B909C' }}>Previous result</span>
                <InspectionStatusBadge status={data.latestInspection.status} />
              </div>
            )}

            {/* Status selection */}
            <div
              className="rounded-2xl p-5 space-y-3"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(0,188,212,0.15)',
              }}
            >
              <p className="text-sm font-semibold" style={{ color: '#E0F7FA' }}>Inspection Result</p>
              <div className="grid grid-cols-3 gap-3">
                {STATUS_OPTS.map(({ status: s, label, activeStyle, idleStyle }) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setInspStatus(s)}
                    className="rounded-xl py-3.5 text-sm font-bold transition-all"
                    style={inspStatus === s ? activeStyle : idleStyle}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {inspStatus === 'red' && (
                <p
                  className="rounded-lg px-3 py-2 text-xs"
                  style={{ background: 'rgba(255,23,68,0.08)', color: 'rgba(255,23,68,0.9)' }}
                >
                  Red will lock this bag. Only supervisors can re-inspect after this.
                </p>
              )}
            </div>

            {/* Notes */}
            <div
              className="rounded-2xl p-5 space-y-2"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(0,188,212,0.15)',
              }}
            >
              <label className="block text-sm font-semibold" style={{ color: '#E0F7FA' }}>
                Notes{' '}
                <span className="font-normal" style={{ color: '#7B909C' }}>(optional)</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Describe condition, damage, or observations…"
                className="w-full resize-none rounded-lg px-3 py-2.5 text-sm outline-none transition border border-[rgba(0,188,212,0.2)] focus:border-[rgba(0,188,212,0.5)] focus:ring-2 focus:ring-[rgba(0,188,212,0.1)] placeholder:text-[#7B909C]"
                style={{ background: 'rgba(255,255,255,0.06)', color: '#E0F7FA' }}
              />
            </div>

            {/* Photo capture */}
            <div
              className="rounded-2xl p-5 space-y-3"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(0,188,212,0.15)',
              }}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold" style={{ color: '#E0F7FA' }}>Photos</p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-70"
                  style={{
                    background: 'rgba(0,188,212,0.12)',
                    color: '#00BCD4',
                  }}
                >
                  + Add Photo
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                className="hidden"
                onChange={handlePhotoChange}
              />
              {previews.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {previews.map((src, idx) => (
                    <div key={idx} className="relative">
                      <img
                        src={src}
                        alt=""
                        className="h-20 w-full rounded-lg object-cover"
                        style={{ border: '1px solid rgba(0,188,212,0.2)' }}
                      />
                      <button
                        type="button"
                        onClick={() => removePhoto(idx)}
                        className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full shadow"
                        style={{ background: '#FF1744', color: '#fff' }}
                      >
                        <span className="text-xs font-bold leading-none">×</span>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs" style={{ color: '#7B909C' }}>
                  No photos added. Tap "+ Add Photo" to use your camera.
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl py-3.5 text-sm font-bold transition-all disabled:opacity-60"
              style={
                inspStatus === 'green'
                  ? { background: '#00E676', color: '#061426', boxShadow: '0 0 16px rgba(0,230,118,0.3)' }
                  : inspStatus === 'yellow'
                  ? { background: '#FFD600', color: '#061426', boxShadow: '0 0 16px rgba(255,214,0,0.3)' }
                  : { background: '#FF1744', color: '#fff', boxShadow: '0 0 16px rgba(255,23,68,0.3)' }
              }
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Spinner size="sm" color={inspStatus === 'red' ? '#fff' : '#061426'} />
                  {submitLabel}
                </span>
              ) : (
                `Submit ${inspStatus.charAt(0).toUpperCase() + inspStatus.slice(1)} Inspection`
              )}
            </button>
          </form>
        )}
      </main>
    </div>
  )
}
