export type BadgeVariant =
  // Generic variants (retained for legacy consumers)
  | 'green'
  | 'yellow'
  | 'red'
  | 'cyan'
  | 'blue'
  | 'amber'
  | 'gray'
  // Workflow status variants — see lib/aiMarketing.ts STATUS_META
  | 'draft'
  | 'pending'
  | 'approved'
  | 'queued'
  | 'scheduled'
  | 'publishing'
  | 'posted'
  | 'failed'
  | 'rejected'
  | 'cancelled'

interface Props {
  variant: BadgeVariant
  label: string
  dot?: boolean
  size?: 'sm' | 'md'
}

const STYLES: Record<BadgeVariant, { bg: string; text: string; dot: string; pulse?: boolean }> = {
  green:   { bg: 'rgba(34,197,94,0.15)',   text: '#4ade80',                dot: '#22c55e' },
  yellow:  { bg: 'rgba(234,179,8,0.15)',   text: '#facc15',                dot: '#eab308' },
  red:     { bg: 'rgba(239,68,68,0.15)',   text: '#f87171',                dot: '#ef4444' },
  cyan:    { bg: 'rgba(0,200,255,0.12)',   text: '#00c8ff',                dot: '#00c8ff' },
  blue:    { bg: 'rgba(59,130,246,0.15)',  text: '#60a5fa',                dot: '#3b82f6' },
  amber:   { bg: 'rgba(245,158,11,0.15)',  text: '#fbbf24',                dot: '#f59e0b' },
  gray:    { bg: 'rgba(255,255,255,0.08)', text: 'rgba(255,255,255,0.4)',  dot: 'rgba(255,255,255,0.3)' },

  draft:      { bg: 'rgba(252,211,77,0.10)',  text: '#fcd34d', dot: '#f59e0b' },
  pending:    { bg: 'rgba(216,180,254,0.10)', text: '#d8b4fe', dot: '#a855f7' },
  approved:   { bg: 'rgba(103,232,249,0.10)', text: '#67e8f9', dot: '#06b6d4' },
  queued:     { bg: 'rgba(147,197,253,0.10)', text: '#93c5fd', dot: '#3b82f6' },
  scheduled:  { bg: 'rgba(165,180,252,0.10)', text: '#a5b4fc', dot: '#6366f1' },
  publishing: { bg: 'rgba(94,234,212,0.15)',  text: '#5eead4', dot: '#14b8a6', pulse: true },
  posted:     { bg: 'rgba(110,231,183,0.10)', text: '#6ee7b7', dot: '#10b981' },
  failed:     { bg: 'rgba(252,165,165,0.10)', text: '#fca5a5', dot: '#ef4444' },
  rejected:   { bg: 'rgba(251,113,133,0.10)', text: '#fb7185', dot: '#e11d48' },
  cancelled:  { bg: 'rgba(253,186,116,0.10)', text: '#fdba74', dot: '#f97316' },
}

const SIZE_CLS = {
  sm: 'px-2 py-0.5 text-[10px]',
  md: 'px-2.5 py-1 text-xs',
}

export function StatusBadge({ variant, label, dot = false, size = 'md' }: Props) {
  const s = STYLES[variant]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${SIZE_CLS[size]} ${s.pulse ? 'animate-pulse' : ''}`}
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
