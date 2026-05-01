import type { InputHTMLAttributes } from 'react'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export function TextInput({ label, error, hint, className = '', id, ...rest }: Props) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className="space-y-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-semibold uppercase tracking-wide"
          style={{ color: 'rgba(255,255,255,0.4)' }}
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`w-full rounded-xl px-4 py-3 text-sm font-medium outline-none transition-all
          placeholder:text-[rgba(255,255,255,0.25)] focus:ring-2
          ${error ? 'ring-1 ring-red-500/60' : ''} ${className}`}
        style={{
          background: 'rgba(255,255,255,0.06)',
          border: error
            ? '1px solid rgba(239,68,68,0.5)'
            : '1px solid rgba(0,190,255,0.15)',
          color: '#ffffff',
          // @ts-expect-error CSS custom property for focus ring
          '--tw-ring-color': 'rgba(0,200,255,0.3)',
        }}
        {...rest}
      />
      {error && <p className="text-xs font-medium text-red-400">{error}</p>}
      {hint && !error && (
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{hint}</p>
      )}
    </div>
  )
}
