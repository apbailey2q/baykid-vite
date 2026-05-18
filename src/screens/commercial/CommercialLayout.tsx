import type { ReactNode } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { AppShell } from '../../components/ui/AppShell'
import { BottomNav } from '../../components/ui/BottomNav'
import { PageHeader } from '../../components/ui/PageHeader'

const NAV_ITEMS = [
  { label: 'Home',     icon: '🏢', path: '/dashboard/commercial' },
  { label: 'Pickup',   icon: '🚛', path: '/dashboard/commercial/pickup' },
  { label: 'Bins',     icon: '🗑️', path: '/dashboard/commercial/bins' },
  { label: 'Reports',  icon: '📊', path: '/dashboard/commercial/reports' },
  { label: 'Invoices', icon: '🧾', path: '/dashboard/commercial/invoices' },
  { label: 'Support',  icon: '🎧', path: '/dashboard/commercial/support' },
  { label: 'Profile',  icon: '👤', path: '/dashboard/commercial/profile' },
]

interface Props {
  children:     ReactNode
  showHeader?:  boolean
  rightContent?: ReactNode
}

export function CommercialLayout({ children, showHeader = true, rightContent }: Props) {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const navItems = NAV_ITEMS.map(item => ({
    label: item.label,
    icon: <span style={{ fontSize: 18 }}>{item.icon}</span>,
    active: pathname === item.path,
    onClick: () => navigate(item.path),
  }))

  return (
    <AppShell>
      {showHeader && <PageHeader rightContent={rightContent} />}
      <div style={{ paddingBottom: 80 }}>
        {children}
      </div>
      <BottomNav items={navItems} />
    </AppShell>
  )
}
