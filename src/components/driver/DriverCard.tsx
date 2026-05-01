import React from 'react'

interface DriverCardProps {
  title: string
  subtitle: string
  icon: React.ReactNode
  onPress?: () => void
}

export function DriverCard({ title, subtitle, icon, onPress }: DriverCardProps) {
  return (
    <div
      onClick={onPress}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onPress?.()}
      className="rounded-2xl p-4 flex items-center justify-between cursor-pointer select-none active:scale-[0.98] transition-transform"
      style={{
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.10)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div className="flex-1 min-w-0">
        <p style={{ fontSize: 15, color: '#ffffff', fontWeight: 600, lineHeight: 1.2 }}>
          {title}
        </p>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 3 }}>
          {subtitle}
        </p>
      </div>
      <div
        className="ml-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
        style={{
          background: 'rgba(0,188,212,0.15)',
          border: '1px solid rgba(0,188,212,0.35)',
        }}
      >
        {icon}
      </div>
    </div>
  )
}
