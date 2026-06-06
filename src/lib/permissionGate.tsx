// permissionGate.tsx — PermissionGate JSX component
// Separated from permissions.ts because .ts files cannot contain JSX.

import type { ReactNode } from 'react'
import { loadUserProfile, can, type Permission } from './permissions'

interface PermissionGateProps {
  action:    Permission
  fallback?: ReactNode
  children:  ReactNode
}

export function PermissionGate({ action, fallback = null, children }: PermissionGateProps) {
  const profile = loadUserProfile()
  if (can(profile.role, action)) return <>{children}</>
  if (fallback) return <>{fallback}</>
  return null
}
