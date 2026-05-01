import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  loading?: boolean
  variant?: 'primary' | 'secondary' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  fullWidth?: boolean
}

const SIZE = {
  sm: 'px-3 py-2 text-xs',
  md: 'px-4 py-3 text-sm',
  lg: 'px-5 py-3.5 text-sm',
} as const

const VARIANT_STYLE: Record<NonNullable<Props['variant']>, React.CSSProperties> = {
  primary: {
    background: 'linear-gradient(135deg, #0057e7, #00c8ff)',
    border: 'none',
    borderRadius: '14px',
    color: '#ffffff',
    fontWeight: 500,
    boxShadow: '0 4px 20px rgba(0,190,255,0.3)',
  },
  secondary: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(0,190,255,0.2)',
    borderRadius: '14px',
    color: 'rgba(255,255,255,0.65)',
    fontWeight: 500,
  },
  danger: {
    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
    border: 'none',
    borderRadius: '14px',
    color: '#ffffff',
    fontWeight: 500,
    boxShadow: '0 4px 16px rgba(239,68,68,0.3)',
  },
}

export function PrimaryButton({
  children,
  loading = false,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  disabled,
  className = '',
  style,
  ...rest
}: Props) {
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 transition-all duration-200
        hover:brightness-110 active:scale-[0.96] disabled:opacity-50 disabled:shadow-none
        ${SIZE[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      style={{ ...VARIANT_STYLE[variant], ...style }}
      {...rest}
    >
      {loading && (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
      )}
      {children}
    </button>
  )
}
