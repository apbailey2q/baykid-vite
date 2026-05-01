interface StatusBadgeProps {
  label?: string
}

export function StatusBadge({ label = 'Driver' }: StatusBadgeProps) {
  return (
    <div
      className="flex items-center gap-1 rounded-full px-2.5 py-1"
      style={{
        border: '1px solid rgba(0,188,212,0.55)',
        background: 'rgba(0,188,212,0.08)',
      }}
    >
      <span style={{ fontSize: 10, color: '#00BCD4', fontWeight: 700, letterSpacing: '0.04em' }}>
        {label}
      </span>
    </div>
  )
}
