import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
  className?: string
}

export function AppShell({ children, className = '' }: Props) {
  return (
    <div className={`relative min-h-screen text-white ${className}`} style={{ background: '#060e24' }}>
      {children}
    </div>
  )
}
