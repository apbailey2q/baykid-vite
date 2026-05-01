import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
  className?: string
  glow?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
  variant?: 'default' | 'elevated' | 'accent'
}

const PAD = { none: '', sm: 'p-3', md: 'p-4', lg: 'p-6' } as const

const BASE: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(0,190,255,0.15)',
  borderRadius: '16px',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
}

export function GlassCard({ children, className = '', glow = false, padding = 'md', variant = 'default' }: Props) {
  const extraShadow = glow ? '0 0 24px rgba(0,200,255,0.22), ' : ''

  const style: React.CSSProperties =
    variant === 'accent'
      ? {
          ...BASE,
          background: 'rgba(0,100,255,0.12)',
          border: '1px solid rgba(0,190,255,0.25)',
          boxShadow: `${extraShadow}0 8px 32px rgba(0,0,0,0.3)`,
        }
      : variant === 'elevated'
      ? {
          ...BASE,
          background: 'rgba(255,255,255,0.09)',
          border: '1px solid rgba(0,190,255,0.2)',
          boxShadow: `${extraShadow}0 12px 40px rgba(0,0,0,0.35)`,
        }
      : {
          ...BASE,
          boxShadow: glow ? `0 0 24px rgba(0,200,255,0.22), 0 8px 32px rgba(0,0,0,0.25)` : undefined,
        }

  return (
    <div
      className={`transition-all duration-200 hover-glow ${PAD[padding]} ${className}`}
      style={style}
    >
      {children}
    </div>
  )
}
