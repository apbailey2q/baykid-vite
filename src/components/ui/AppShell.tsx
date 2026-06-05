import type { ReactNode } from 'react'

interface Props {
  children:  ReactNode
  className?: string
}

export function AppShell({ children, className = '' }: Props) {
  return (
    // id="main-content" is the target of the skip-link in index.html.
    // role="main" ensures assistive tech identifies this as primary content.
    <div
      id="main-content"
      role="main"
      className={`relative min-h-screen text-white ${className}`}
      style={{ background: '#060e24' }}
    >
      {children}
    </div>
  )
}
