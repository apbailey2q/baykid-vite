import type { ReactNode } from 'react'

export interface BottomNavItem {
  label:   string
  icon:    ReactNode
  active:  boolean
  onClick: () => void
  badge?:  number
}

interface Props {
  items: BottomNavItem[]
}

export function BottomNav({ items }: Props) {
  return (
    <nav
      aria-label="Main navigation"
      className="fixed bottom-0 left-0 right-0 z-40 flex"
      style={{
        background:           'rgba(6,14,36,0.95)',
        borderTop:            '1px solid rgba(0,190,255,0.15)',
        backdropFilter:       'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        paddingBottom:        'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {items.map((item, i) => (
        <button
          key={i}
          onClick={item.onClick}
          // aria-current="page" tells screen readers which section is active
          aria-current={item.active ? 'page' : undefined}
          // Combine label + badge count into one accessible name so
          // screen readers announce e.g. "Notifications, 3 unread"
          aria-label={
            item.badge && item.badge > 0
              ? `${item.label}, ${item.badge > 99 ? '99+' : item.badge} unread`
              : item.label
          }
          className={[
            'relative flex flex-1 flex-col items-center gap-1 py-3',
            'transition-all duration-150 active:scale-90',
            // Explicit focus ring for keyboard navigation
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-1 focus-visible:ring-offset-[#060e24]',
          ].join(' ')}
        >
          {/* Icon — hidden from assistive tech since button has aria-label */}
          <span
            aria-hidden="true"
            className="relative z-10 transition-all"
            style={{ color: item.active ? '#00c8ff' : 'rgba(255,255,255,0.35)' }}
          >
            {item.icon}

            {/* Badge — visual only; count is in button aria-label */}
            {item.badge != null && item.badge > 0 && (
              <span
                aria-hidden="true"
                className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
                style={{ backgroundColor: '#ef4444' }}
              >
                {item.badge > 99 ? '99+' : item.badge}
              </span>
            )}
          </span>

          {/* Visible label — aria-hidden since the button already has aria-label */}
          <span
            aria-hidden="true"
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
