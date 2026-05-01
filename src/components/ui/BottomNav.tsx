import type { ReactNode } from 'react'

export interface BottomNavItem {
  label: string
  icon: ReactNode
  active: boolean
  onClick: () => void
  badge?: number
}

interface Props {
  items: BottomNavItem[]
}

export function BottomNav({ items }: Props) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex"
      style={{
        background: 'rgba(6,14,36,0.95)',
        borderTop: '1px solid rgba(0,190,255,0.15)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {items.map((item, i) => (
        <button
          key={i}
          onClick={item.onClick}
          className="relative flex flex-1 flex-col items-center gap-1 py-3 transition-all duration-150 active:scale-90"
        >
          {item.badge != null && item.badge > 0 && (
            <span
              className="absolute right-1/4 top-1.5 z-10 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
              style={{ backgroundColor: '#ef4444' }}
            >
              {item.badge > 99 ? '99+' : item.badge}
            </span>
          )}
          <span
            className="relative z-10 transition-all"
            style={{ color: item.active ? '#00c8ff' : 'rgba(255,255,255,0.35)' }}
          >
            {item.icon}
          </span>
          <span
            className="relative z-10 text-[10px] transition-colors"
            style={{ fontWeight: 500, color: item.active ? '#00c8ff' : 'rgba(255,255,255,0.35)' }}
          >
            {item.label}
          </span>
        </button>
      ))}
    </nav>
  )
}
