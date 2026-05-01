import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getAllInspections } from '../../lib/warehouse'
import { Spinner, EmptyState, PhotoLightbox } from '../../components/ui'
import type { InspectionStatus } from '../../types'

type StatusFilter = 'all' | InspectionStatus

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'green', label: 'Green' },
  { value: 'yellow', label: 'Yellow' },
  { value: 'red', label: 'Red' },
]

const STATUS_BADGE: Record<InspectionStatus, { label: string; bg: string; color: string }> = {
  green:  { label: 'Green',  bg: 'rgba(0,230,118,0.15)',  color: '#00E676' },
  yellow: { label: 'Yellow', bg: 'rgba(255,214,0,0.15)',  color: '#FFD600' },
  red:    { label: 'Red',    bg: 'rgba(255,23,68,0.15)',  color: '#FF1744' },
}

const STATUS_STRIP: Record<InspectionStatus, string> = {
  green:  '#00E676',
  yellow: '#FFD600',
  red:    '#FF1744',
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

export function AllInspections() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [lightbox, setLightbox] = useState<{ photos: string[]; initialIndex: number } | null>(null)

  const { data: inspections = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['all-inspections'],
    queryFn: () => getAllInspections(100),
  })

  const filtered = inspections.filter((i) => {
    const matchesStatus = statusFilter === 'all' || i.status === statusFilter
    const query = search.trim().toUpperCase()
    const matchesSearch = !query || (i.bags?.bag_code ?? '').includes(query)
    return matchesStatus && matchesSearch
  })

  const isReviewed = (insp: (typeof inspections)[number]) =>
    insp.inspection_reviews.length > 0

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner size="md" />
      </div>
    )
  }

  if (isError) {
    return (
      <EmptyState
        icon="⚠️"
        title="Failed to load inspections"
        description="Check your connection and try again."
        action={{ label: 'Retry', onClick: () => refetch() }}
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
        {/* Search bar */}
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            style={{ color: '#7B909C' }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search bag code…"
            className="w-full rounded-xl py-2.5 pl-9 pr-4 text-sm outline-none border border-[rgba(0,188,212,0.2)] focus:border-[rgba(0,188,212,0.5)] focus:ring-2 focus:ring-[rgba(0,188,212,0.1)] placeholder:text-[#7B909C]"
            style={{ background: 'rgba(255,255,255,0.06)', color: '#E0F7FA' }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs transition-opacity hover:opacity-70"
              style={{ color: '#7B909C' }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Status filter pills */}
        <div className="flex gap-2 overflow-x-auto pb-0.5">
          {FILTERS.map((f) => {
            const count =
              f.value === 'all'
                ? inspections.length
                : inspections.filter((i) => i.status === f.value).length
            const isActive = statusFilter === f.value
            return (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className="shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all"
                style={
                  isActive
                    ? { background: 'rgba(0,188,212,0.2)', border: '1px solid rgba(0,188,212,0.5)', color: '#00BCD4' }
                    : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#7B909C' }
                }
              >
                {f.label} ({count})
              </button>
            )
          })}
        </div>

        {filtered.length === 0 && (
          <EmptyState
            icon="🔍"
            title="No inspections found"
            description={
              search
                ? `No results for "${search}"`
                : statusFilter === 'all'
                ? 'No inspections recorded yet.'
                : `No ${statusFilter} inspections.`
            }
          />
        )}

        {filtered.map((insp) => {
          const badge = STATUS_BADGE[insp.status]
          const stripColor = STATUS_STRIP[insp.status]
          const bagCode = insp.bags?.bag_code ?? insp.bag_id.slice(0, 8)
          const reviewed = isReviewed(insp)
          const photoUrls = insp.inspection_photos.map((p) => p.photo_url)

          return (
            <div
              key={insp.id}
              className="flex overflow-hidden rounded-2xl"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(0,188,212,0.12)',
              }}
            >
              {/* Colour strip */}
              <div className="w-1.5 shrink-0" style={{ background: stripColor }} />

              <div className="flex-1 p-4 space-y-2.5">
                {/* Header row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      to={`/bag/${insp.bag_id}`}
                      className="font-mono text-sm font-bold transition-opacity hover:opacity-70"
                      style={{ color: '#E0F7FA' }}
                    >
                      {bagCode}
                    </Link>
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{ background: badge.bg, color: badge.color }}
                    >
                      {badge.label}
                    </span>
                    {reviewed && (
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{ background: 'rgba(0,188,212,0.12)', color: '#00BCD4' }}
                      >
                        Reviewed
                      </span>
                    )}
                  </div>
                  <span className="shrink-0 text-xs" style={{ color: '#7B909C' }}>{fmt(insp.created_at)}</span>
                </div>

                {/* Notes */}
                {insp.notes && (
                  <p
                    className="rounded-lg px-3 py-2 text-sm leading-relaxed"
                    style={{ background: 'rgba(255,255,255,0.04)', color: '#E0F7FA' }}
                  >
                    {insp.notes}
                  </p>
                )}

                {/* Photos */}
                {photoUrls.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto">
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
                          className="h-14 w-14 rounded-lg object-cover"
                          style={{ border: '1px solid rgba(0,188,212,0.2)' }}
                        />
                      </button>
                    ))}
                  </div>
                )}

                {/* Review summary */}
                {insp.inspection_reviews.length > 0 && (
                  <div className="flex items-center gap-1.5 text-xs" style={{ color: '#00BCD4' }}>
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Supervisor {insp.inspection_reviews[0].decision}
                    {insp.inspection_reviews[0].override_status && (
                      <span> → {insp.inspection_reviews[0].override_status}</span>
                    )}
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
