interface StatCardProps {
  value: string
  label: string
}

export function StatCard({ value, label }: StatCardProps) {
  return (
    <div
      className="rounded-2xl p-3 flex flex-col gap-1"
      style={{
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(0,190,255,0.15)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <p style={{ fontSize: 18, color: '#ffffff', fontWeight: 700, lineHeight: 1.2 }}>{value}</p>
      <p
        style={{
          fontSize: 10,
          color: '#00BCD4',
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </p>
    </div>
  )
}
