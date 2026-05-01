type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

interface Props {
  size?: Size
}

const DIM: Record<Size, { outer: string; icon: number }> = {
  xs: { outer: 'h-6 w-6',   icon: 10 },
  sm: { outer: 'h-8 w-8',   icon: 13 },
  md: { outer: 'h-10 w-10', icon: 16 },
  lg: { outer: 'h-14 w-14', icon: 22 },
  xl: { outer: 'h-20 w-20', icon: 32 },
}

export function LogoBadge({ size = 'md' }: Props) {
  const d = DIM[size]
  return (
    <div
      className={`${d.outer} flex shrink-0 items-center justify-center rounded-full`}
      style={{
        background: 'linear-gradient(135deg,rgba(0,188,212,0.25),rgba(0,100,255,0.15))',
        border: '1px solid rgba(0,188,212,0.35)',
        boxShadow: '0 0 24px rgba(0,190,255,0.2)',
      }}
    >
      <svg
        width={d.icon}
        height={d.icon}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#00c8ff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M7 19H4.815a1.83 1.83 0 0 1-1.57-.881 1.785 1.785 0 0 1-.004-1.784L7.196 9.5" />
        <path d="M11 19h8.203a1.83 1.83 0 0 0 1.556-.89 1.784 1.784 0 0 0 0-1.775l-1.226-2.12" />
        <path d="m14 16 3 3-3 3" />
        <path d="M8.293 13.596 7.196 9.5 3.1 10.598" />
        <path d="m9.344 5.811 1.093-1.892A1.83 1.83 0 0 1 11.985 3a1.784 1.784 0 0 1 1.546.888l3.943 6.843" />
        <path d="m13.378 9.633 4.096 1.098 1.097-4.096" />
      </svg>
    </div>
  )
}
