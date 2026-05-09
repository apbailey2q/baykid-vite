import type { ReactNode, CSSProperties } from 'react'

// ── Role accent palette ────────────────────────────────────────────────────────

export const ROLE_ACCENTS = {
  consumer:            '#00c8ff',
  driver:              '#3b82f6',
  warehouse_employee:  '#4ade80',
  warehouse_supervisor:'#4ade80',
  partner:             '#a855f7',
  admin:               '#FFD600',
  fundraiser:          '#10b981',
} as const

export type RoleAccent = typeof ROLE_ACCENTS[keyof typeof ROLE_ACCENTS]

// ── SectionLabel (standalone drop-in for section-label headings) ──────────────

interface SectionLabelProps {
  title: string
  accent?: string
  className?: string
}

export function SectionLabel({ title, accent = 'rgba(0,200,255,0.5)', className = '' }: SectionLabelProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`} style={{ marginBottom: 12 }}>
      <div style={{ width: 3, height: 14, borderRadius: 2, background: accent, flexShrink: 0 }} />
      <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
        {title}
      </p>
    </div>
  )
}

// ── LiveBadge ─────────────────────────────────────────────────────────────────

interface LiveBadgeProps {
  connected?: boolean
  label?: string
  accent?: string
}

export function LiveBadge({ connected = true, label = 'LIVE', accent = '#4ade80' }: LiveBadgeProps) {
  if (!connected) return null
  return (
    <span className="flex items-center gap-1">
      <span
        className="rounded-full"
        style={{
          width: 7,
          height: 7,
          background: accent,
          boxShadow: `0 0 6px ${accent}`,
          animation: 'livePulse 1.5s ease-in-out infinite',
          flexShrink: 0,
        }}
      />
      <span style={{ fontSize: 9, color: accent, fontWeight: 700, letterSpacing: '0.06em' }}>
        {label}
      </span>
      <style>{`
        @keyframes livePulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.5; }
        }
      `}</style>
    </span>
  )
}

// ── StatPill ──────────────────────────────────────────────────────────────────

interface StatPillProps {
  label: string
  value: string | number
  accent?: string
  icon?: string
  sublabel?: string
}

export function StatPill({ label, value, accent = '#00c8ff', icon, sublabel }: StatPillProps) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-2xl px-3 py-3 text-center"
      style={{
        background: `${accent}0d`,
        border: `1px solid ${accent}28`,
        minWidth: 72,
      }}
    >
      {icon && <span style={{ fontSize: 18, lineHeight: 1, marginBottom: 4 }}>{icon}</span>}
      <p style={{ fontSize: 22, fontWeight: 700, color: accent, lineHeight: 1 }}>{value}</p>
      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 4 }}>{label}</p>
      {sublabel && (
        <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{sublabel}</p>
      )}
    </div>
  )
}

// ── SectionDivider ────────────────────────────────────────────────────────────

interface SectionDividerProps {
  label?: string
  accent?: string
}

export function SectionDivider({ label, accent = 'rgba(0,200,255,0.15)' }: SectionDividerProps) {
  if (!label) {
    return (
      <div
        style={{
          height: 1,
          background: `linear-gradient(to right, transparent, ${accent}, transparent)`,
          margin: '4px 0',
        }}
      />
    )
  }
  return (
    <div className="flex items-center gap-3" style={{ margin: '4px 0' }}>
      <div style={{ flex: 1, height: 1, background: `linear-gradient(to right, transparent, ${accent})` }} />
      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
        {label}
      </p>
      <div style={{ flex: 1, height: 1, background: `linear-gradient(to left, transparent, ${accent})` }} />
    </div>
  )
}

// ── DashboardSection ──────────────────────────────────────────────────────────

interface DashboardSectionProps {
  title?: string
  children: ReactNode
  accent?: string
  action?: ReactNode
  className?: string
  style?: CSSProperties
  noPadding?: boolean
}

export function DashboardSection({
  title,
  children,
  accent = 'rgba(0,200,255,0.5)',
  action,
  className = '',
  style,
  noPadding = false,
}: DashboardSectionProps) {
  return (
    <div className={`flex flex-col gap-2 ${className}`} style={style}>
      {title && (
        <div className="flex items-center justify-between" style={{ marginBottom: 2 }}>
          <div className="flex items-center gap-2">
            <div style={{ width: 3, height: 14, borderRadius: 2, background: accent, flexShrink: 0 }} />
            <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              {title}
            </p>
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      <div className={noPadding ? '' : ''}>{children}</div>
    </div>
  )
}

// ── DashboardHeader ───────────────────────────────────────────────────────────

interface DashboardHeaderProps {
  title: string
  subtitle?: string
  accent?: string
  rightContent?: ReactNode
  badge?: ReactNode
  compact?: boolean
}

export function DashboardHeader({
  title,
  subtitle,
  accent = '#00c8ff',
  rightContent,
  badge,
  compact = false,
}: DashboardHeaderProps) {
  return (
    <div
      className="flex items-center justify-between"
      style={{
        paddingTop: 'max(env(safe-area-inset-top, 0px), 16px)',
        paddingBottom: compact ? 12 : 16,
        paddingLeft: 16,
        paddingRight: 16,
        background: 'rgba(4,10,24,0.92)',
        borderBottom: `1px solid ${accent}20`,
        backdropFilter: 'blur(12px)',
      }}
    >
      <div className="flex items-center gap-2.5">
        <div>
          <div className="flex items-center gap-2">
            <p style={{ fontSize: compact ? 15 : 16, fontWeight: 700, color: '#ffffff' }}>{title}</p>
            {badge}
          </div>
          {subtitle && (
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>{subtitle}</p>
          )}
        </div>
      </div>
      {rightContent && <div className="flex items-center gap-2">{rightContent}</div>}
    </div>
  )
}
