// ManagementDashboard.tsx — Management Dashboard Placeholder
//
// Placeholder dashboard for management personnel at Cyan's Brooklynn Recycling.
// Shows six snapshot cards with placeholder data.
// Advanced data connections are deferred to a future phase.
//
// Access: management roles (operations_manager, compliance_manager,
//         community_fundraising_manager, municipal_relations_manager) + admin.

import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import type { ManagementProfile } from '../../types'

const BRAND       = '#00c8ff'
const BRAND_DIM   = 'rgba(0,200,255,0.08)'
const BRAND_BORDER= 'rgba(0,200,255,0.25)'

interface SnapshotCard {
  icon:    string
  label:   string
  value:   string
  sub?:    string
  color?:  string
}

const PLACEHOLDER_CARDS: SnapshotCard[] = [
  { icon: '📦', label: 'Pickups Today',       value: '—', sub: 'Live data coming soon',       color: BRAND },
  { icon: '🏢', label: 'Commercial Pickups',  value: '—', sub: 'Live data coming soon',       color: '#4ade80' },
  { icon: '🏭', label: 'Warehouse Volume',    value: '—', sub: 'Live data coming soon',       color: '#a78bfa' },
  { icon: '⚠️', label: 'Open Compliance Items', value: '—', sub: 'Live data coming soon',    color: '#fbbf24' },
  { icon: '🎓', label: 'Training Completion', value: '—', sub: 'Live data coming soon',       color: '#34d399' },
  { icon: '👥', label: 'Pending Reviews',     value: '—', sub: 'Live data coming soon',       color: '#f87171' },
]

export default function ManagementDashboard() {
  const { user, role } = useAuthStore()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<ManagementProfile | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    if (!user) return
    // If not admin, load management profile and redirect to onboarding if incomplete
    if (role === 'admin') { setChecking(false); return }

    supabase
      .from('management_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) {
          navigate('/management/onboarding', { replace: true })
          return
        }
        const mp = data as ManagementProfile
        setProfile(mp)
        if (!mp.onboarding_completed) {
          navigate('/management/onboarding', { replace: true })
        } else {
          setChecking(false)
        }
      })
  }, [user, role, navigate])

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: '#060e24' }}>
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-t-transparent"
          style={{ borderColor: BRAND, borderTopColor: 'transparent' }} />
      </div>
    )
  }

  const displayName = profile
    ? `${profile.management_type} — ${profile.department}`
    : role === 'admin' ? 'Admin View' : 'Management'

  return (
    <div className="min-h-screen" style={{ background: '#060e24' }}>
      {/* Header */}
      <div className="sticky top-0 z-10 px-4 py-3"
        style={{ background: 'rgba(6,14,36,0.95)', borderBottom: '1px solid rgba(0,200,255,0.1)', backdropFilter: 'blur(10px)' }}>
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-xs font-bold tracking-widest" style={{ color: BRAND }}>
              CYAN'S BROOKLYNN RECYCLING
            </p>
            <p className="text-white font-bold text-lg leading-tight">Management Dashboard</p>
          </div>
          <div className="text-right">
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{displayName}</p>
            {profile?.certified && (
              <span className="text-xs font-semibold" style={{ color: '#4ade80' }}>✅ Certified</span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">

        {/* Quick nav links */}
        <div className="flex flex-wrap gap-3">
          <Link
            to="/management/training"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:brightness-110"
            style={{ background: BRAND_DIM, border: `1px solid ${BRAND_BORDER}`, color: BRAND, textDecoration: 'none' }}
          >
            🎓 Training Center
          </Link>
          <Link
            to="/dashboard/admin"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:brightness-110"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}
          >
            🛡️ Admin Center
          </Link>
        </div>

        {/* ── Operations Snapshot ── */}
        <section>
          <h2 className="text-sm font-bold tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.35)' }}>
            OPERATIONS SNAPSHOT
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {PLACEHOLDER_CARDS.slice(0, 2).map(card => (
              <SnapshotCardView key={card.label} card={card} />
            ))}
          </div>
        </section>

        {/* ── Warehouse Snapshot ── */}
        <section>
          <h2 className="text-sm font-bold tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.35)' }}>
            WAREHOUSE SNAPSHOT
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <SnapshotCardView card={PLACEHOLDER_CARDS[2]} />
          </div>
        </section>

        {/* ── Compliance Snapshot ── */}
        <section>
          <h2 className="text-sm font-bold tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.35)' }}>
            COMPLIANCE SNAPSHOT
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <SnapshotCardView card={PLACEHOLDER_CARDS[3]} />
          </div>
        </section>

        {/* ── Training Snapshot ── */}
        <section>
          <h2 className="text-sm font-bold tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.35)' }}>
            TRAINING SNAPSHOT
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <SnapshotCardView card={PLACEHOLDER_CARDS[4]} />
          </div>
        </section>

        {/* ── Reports Snapshot ── */}
        <section>
          <h2 className="text-sm font-bold tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.35)' }}>
            REPORTS SNAPSHOT
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <SnapshotCardView card={PLACEHOLDER_CARDS[5]} />
          </div>
        </section>

        {/* Footer note */}
        <div className="p-4 rounded-xl text-center"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Management Dashboard · Cyan's Brooklynn Recycling Enterprise LLC · Advanced reports wired in future phase
          </p>
        </div>
      </div>
    </div>
  )
}

function SnapshotCardView({ card }: { card: SnapshotCard }) {
  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-2"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <div className="flex items-center gap-2">
        <span className="text-xl">{card.icon}</span>
        <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.45)' }}>
          {card.label}
        </span>
      </div>
      <p className="text-2xl font-bold" style={{ color: card.color ?? 'white' }}>{card.value}</p>
      {card.sub && (
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>{card.sub}</p>
      )}
    </div>
  )
}
