// OrgSwitcher.tsx — Organization switcher dropdown for the header
// Shows current org name + initials, lists all user orgs, "Create Organization" option

import { useState, useRef, useEffect } from 'react'
import { useOrg } from '../lib/orgStore'
import type { Organization } from '../lib/organizations'

interface OrgSwitcherProps {
  onCreateOrg?: () => void
}

function orgInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

function OrgAvatar({ org, size = 28 }: { org: Organization; size?: number }) {
  if (org.logoUrl) {
    return (
      <img
        src={org.logoUrl}
        alt={org.name}
        style={{ width: size, height: size, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }}
      />
    )
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 6,
        background: 'linear-gradient(135deg, rgba(0,200,255,0.3), rgba(167,139,250,0.3))',
        border: '1px solid rgba(0,200,255,0.25)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.38,
        fontWeight: 700,
        color: '#00c8ff',
        flexShrink: 0,
      }}
    >
      {orgInitials(org.name)}
    </div>
  )
}

export function OrgSwitcher({ onCreateOrg }: OrgSwitcherProps) {
  const { activeOrg, allOrgs, loading, switchOrg } = useOrg()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ width: 22, height: 22, borderRadius: 5, background: 'rgba(255,255,255,0.1)', animation: 'ai-spin 1s linear infinite' }} />
        <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>Loading…</span>
      </div>
    )
  }

  if (!activeOrg) return null

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        title="Switch organization"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          padding: '4px 10px 4px 6px',
          background: open ? 'rgba(0,200,255,0.08)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${open ? 'rgba(0,200,255,0.35)' : 'rgba(255,255,255,0.1)'}`,
          borderRadius: 8,
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          maxWidth: 200,
        }}
      >
        <OrgAvatar org={activeOrg} size={22} />
        <span
          style={{
            color: open ? '#00c8ff' : 'rgba(255,255,255,0.75)',
            fontSize: 12,
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: 120,
          }}
        >
          {activeOrg.name}
        </span>
        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, marginLeft: 2 }}>
          {open ? '▲' : '▼'}
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 200,
            background: '#0d1424',
            border: '1px solid rgba(0,200,255,0.2)',
            borderRadius: 10,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            minWidth: 220,
            overflow: 'hidden',
          }}
        >
          {/* Section label */}
          <div style={{ padding: '8px 12px 6px', color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Your Organizations
          </div>

          {/* Org list */}
          {allOrgs.map((org) => {
            const isActive = org.id === activeOrg.id
            return (
              <button
                key={org.id}
                onClick={() => { switchOrg(org.id); setOpen(false) }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '8px 12px',
                  background: isActive ? 'rgba(0,200,255,0.08)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.12s ease',
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
              >
                <OrgAvatar org={org} size={26} />
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ color: isActive ? '#00c8ff' : 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {org.name}
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, marginTop: 1 }}>
                    {org.plan.charAt(0).toUpperCase() + org.plan.slice(1)} · {(org as Organization & { memberRole?: string }).memberRole ?? 'member'}
                  </div>
                </div>
                {isActive && (
                  <span style={{ color: '#00c8ff', fontSize: 12, flexShrink: 0 }}>✓</span>
                )}
              </button>
            )
          })}

          {/* Divider + create */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', margin: '4px 0' }} />
          <button
            onClick={() => { setOpen(false); onCreateOrg?.() }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '9px 12px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'rgba(255,255,255,0.5)',
              fontSize: 12,
              fontWeight: 600,
              textAlign: 'left',
              transition: 'color 0.12s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#00c8ff' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.5)' }}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>＋</span>
            Create Organization
          </button>
        </div>
      )}
    </div>
  )
}
