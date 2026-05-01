import { createContext, useContext, useState, useCallback } from 'react'
import type { ReactNode } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: string
  message: string
  type: ToastType
}

interface ToastContextValue {
  success: (msg: string) => void
  error: (msg: string) => void
  info: (msg: string) => void
}

// ── Context ───────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue>({
  success: () => {},
  error: () => {},
  info: () => {},
})

// ── Provider ──────────────────────────────────────────────────────────────────

const STYLES: Record<ToastType, { bg: string; border: string; color: string; icon: string }> = {
  success: { bg: 'rgba(0,230,118,0.12)',  border: 'rgba(0,230,118,0.35)',  color: '#00E676', icon: '✓' },
  error:   { bg: 'rgba(255,23,68,0.12)',  border: 'rgba(255,23,68,0.35)',  color: '#FF1744', icon: '✕' },
  info:    { bg: 'rgba(0,200,255,0.12)',  border: 'rgba(0,200,255,0.35)',  color: '#00c8ff', icon: 'ℹ' },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const add = useCallback((message: string, type: ToastType) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500)
  }, [])

  const value: ToastContextValue = {
    success: (msg) => add(msg, 'success'),
    error: (msg) => add(msg, 'error'),
    info: (msg) => add(msg, 'info'),
  }

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* Toast container */}
      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex flex-col gap-2 max-w-xs w-full">
        {toasts.map((t) => {
          const s = STYLES[t.type]
          return (
            <div
              key={t.id}
              className="pointer-events-auto flex items-start gap-3 rounded-xl px-4 py-3 text-sm font-medium shadow-xl"
              style={{
                background: s.bg,
                border: `1px solid ${s.border}`,
                color: s.color,
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                animation: 'fadeSlideUp 0.2s ease both',
              }}
            >
              <span className="shrink-0 font-bold">{s.icon}</span>
              <span style={{ color: '#ffffff' }}>{t.message}</span>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useToast() {
  return useContext(ToastContext)
}
