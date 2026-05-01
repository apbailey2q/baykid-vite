type BadgeVariant =
  | 'green'
  | 'yellow'
  | 'red'
  | 'cyan'
  | 'blue'
  | 'amber'
  | 'gray'

interface Props {
  variant: BadgeVariant
  label: string
  dot?: boolean
  size?: 'sm' | 'md'
}

const STYLES: Record<BadgeVariant, { bg: string; text: string; dot: string }> = {
  green: {
    bg: 'rgba(34,197,94,0.15)',
    text: '#4ade80',
    dot: '#22c55e',
  },
  yellow: {
    bg: 'rgba(234,179,8,0.15)',
    text: '#facc15',
    dot: '#eab308',
  },
  red: {
    bg: 'rgba(239,68,68,0.15)',
    text: '#f87171',
    dot: '#ef4444',
  },
  cyan: {
    bg: 'rgba(0,200,255,0.12)',
    text: '#00c8ff',
    dot: '#00c8ff',
  },
  blue: {
    bg: 'rgba(59,130,246,0.15)',
    text: '#60a5fa',
    dot: '#3b82f6',
  },
  amber: {
    bg: 'rgba(245,158,11,0.15)',
    text: '#fbbf24',
    dot: '#f59e0b',
  },
  gray: {
    bg: 'rgba(255,255,255,0.08)',
    text: 'rgba(255,255,255,0.4)',
    dot: 'rgba(255,255,255,0.3)',
  },
}

const SIZE_CLS = {
  sm: 'px-2 py-0.5 text-[10px]',
  md: 'px-2.5 py-1 text-xs',
}

export function StatusBadge({ variant, label, dot = false, size = 'md' }: Props) {
  const s = STYLES[variant]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${SIZE_CLS[size]}`}
      style={{ background: s.bg, color: s.text }}
    >
      {dot && (
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: s.dot }}
        />
      )}
      {label}
    </span>
  )
}
