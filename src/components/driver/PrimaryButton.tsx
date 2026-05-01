interface PrimaryButtonProps {
  label: string
  onClick?: () => void
  disabled?: boolean
  fullWidth?: boolean
}

export function PrimaryButton({ label, onClick, disabled, fullWidth }: PrimaryButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${fullWidth ? 'w-full' : ''} rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all active:scale-[0.96] disabled:opacity-50`}
      style={{
        background: 'linear-gradient(135deg,#0057e7,#00BCD4)',
        boxShadow: '0 4px 20px rgba(0,188,212,0.35)',
      }}
    >
      {label}
    </button>
  )
}
