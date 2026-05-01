export type DriverTab = 'home' | 'pickups' | 'route' | 'earnings' | 'schedule' | 'account'

interface DriverBottomNavProps {
  tab: DriverTab
  onTab: (t: DriverTab) => void
  pickupCount?: number
}

export function DriverBottomNav({ tab, onTab, pickupCount = 0 }: DriverBottomNavProps) {
  const items: { id: DriverTab; label: string; icon: (active: boolean) => React.ReactNode }[] = [
    {
      id: 'home',
      label: 'Home',
      icon: (a) => (
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill={a ? '#00BCD4' : 'none'}
          stroke={a ? '#00BCD4' : 'rgba(255,255,255,0.35)'}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      ),
    },
    {
      id: 'pickups',
      label: 'Pickups',
      icon: (a) => (
        <div className="relative">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill={a ? '#00BCD4' : 'none'}
            stroke={a ? '#00BCD4' : 'rgba(255,255,255,0.35)'}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
          {pickupCount > 0 && (
            <span
              className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold"
              style={{ background: '#FF1744', color: '#fff' }}
            >
              {pickupCount > 9 ? '9+' : pickupCount}
            </span>
          )}
        </div>
      ),
    },
    {
      id: 'route',
      label: 'Route',
      icon: (a) => (
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill={a ? '#00BCD4' : 'none'}
          stroke={a ? '#00BCD4' : 'rgba(255,255,255,0.35)'}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="6" cy="19" r="3" />
          <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
          <circle cx="18" cy="5" r="3" />
        </svg>
      ),
    },
    {
      id: 'earnings',
      label: 'Earnings',
      icon: (a) => (
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill={a ? '#00BCD4' : 'none'}
          stroke={a ? '#00BCD4' : 'rgba(255,255,255,0.35)'}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      ),
    },
    {
      id: 'schedule',
      label: 'Schedule',
      icon: (a) => (
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill={a ? '#00BCD4' : 'none'}
          stroke={a ? '#00BCD4' : 'rgba(255,255,255,0.35)'}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      ),
    },
    {
      id: 'account',
      label: 'Account',
      icon: (a) => (
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill={a ? '#00BCD4' : 'none'}
          stroke={a ? '#00BCD4' : 'rgba(255,255,255,0.35)'}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
    },
  ]

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 flex items-end justify-around px-2"
      style={{
        background: 'rgba(6,14,36,0.95)',
        borderTop: '1px solid rgba(0,190,255,0.15)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)',
        paddingTop: '8px',
      }}
    >
      {items.map((item) => {
        const active = tab === item.id
        return (
          <button
            key={item.id}
            onClick={() => onTab(item.id)}
            className="relative flex flex-col items-center gap-0.5 min-w-[52px] py-1 transition-all duration-150 active:scale-[0.88]"
          >
            <span
              className="relative z-10"
              style={{
                filter: active ? 'drop-shadow(0 0 6px rgba(0,188,212,0.7))' : 'none',
              }}
            >
              {item.icon(active)}
            </span>
            <span
              className="relative z-10 text-[10px] font-semibold"
              style={{ color: active ? '#00BCD4' : 'rgba(255,255,255,0.35)' }}
            >
              {item.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
