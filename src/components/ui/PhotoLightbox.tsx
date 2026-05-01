import { useState, useEffect, useCallback } from 'react'

interface Props {
  photos: string[]
  initialIndex?: number
  onClose: () => void
}

export function PhotoLightbox({ photos, initialIndex = 0, onClose }: Props) {
  const [idx, setIdx] = useState(initialIndex)

  const prev = useCallback(
    () => setIdx((i) => (i - 1 + photos.length) % photos.length),
    [photos.length],
  )
  const next = useCallback(
    () => setIdx((i) => (i + 1) % photos.length),
    [photos.length],
  )

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, prev, next])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      {/* Image */}
      <div
        className="relative max-h-[85vh] max-w-[90vw]"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={photos[idx]}
          alt={`Inspection photo ${idx + 1}`}
          className="max-h-[85vh] max-w-[90vw] rounded-xl object-contain"
          style={{ boxShadow: '0 0 60px rgba(0,0,0,0.8)' }}
        />
        <div
          className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-semibold"
          style={{ background: 'rgba(0,0,0,0.6)', color: '#ffffff' }}
        >
          {idx + 1} / {photos.length}
        </div>
      </div>

      {/* Close */}
      <button
        onClick={onClose}
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full transition-opacity hover:opacity-70"
        style={{ background: 'rgba(255,255,255,0.1)' }}
      >
        <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Prev / Next */}
      {photos.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); prev() }}
            className="absolute left-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full transition-opacity hover:opacity-70"
            style={{ background: 'rgba(255,255,255,0.1)' }}
          >
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); next() }}
            className="absolute right-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full transition-opacity hover:opacity-70"
            style={{ background: 'rgba(255,255,255,0.1)' }}
          >
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}
    </div>
  )
}
