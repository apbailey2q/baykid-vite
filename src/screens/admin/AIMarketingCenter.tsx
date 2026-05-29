import React, { useState, useEffect, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import { autoGenerateNotifications, unreadCount } from '../../lib/notifications'
import { syncFromSupabase } from '../../lib/aiMarketingDb'
import { MarketingProvider, GlobalToastStack } from '../../lib/marketingStore'
import { OrgProvider } from '../../lib/orgStore'
import { OrgSwitcher } from '../../components/OrgSwitcher'
import { OnboardingFlow, isOnboardingComplete } from './ai-marketing/OnboardingFlow'
import { OrgOnboarding } from './ai-marketing/OrgOnboarding'
import { AIMarketingErrorBoundary } from '../../components/ErrorBoundary'
import { trackPageView } from '../../lib/usageAnalytics'

const AIMarketingDashboard  = React.lazy(() => import('./ai-marketing/AIMarketingDashboard').then(m => ({ default: m.AIMarketingDashboard })))
const SocialPostGenerator   = React.lazy(() => import('./ai-marketing/SocialPostGenerator').then(m => ({ default: m.SocialPostGenerator })))
const CreativeStudio        = React.lazy(() => import('./ai-marketing/CreativeStudio').then(m => ({ default: m.CreativeStudio })))
const CommentReplies        = React.lazy(() => import('./ai-marketing/CommentReplies').then(m => ({ default: m.CommentReplies })))
const EmailReplies          = React.lazy(() => import('./ai-marketing/EmailReplies').then(m => ({ default: m.EmailReplies })))
const LeadTracker           = React.lazy(() => import('./ai-marketing/LeadTracker').then(m => ({ default: m.LeadTracker })))
const ContentCalendar       = React.lazy(() => import('./ai-marketing/ContentCalendar').then(m => ({ default: m.ContentCalendar })))
const ApprovalQueue         = React.lazy(() => import('./ai-marketing/ApprovalQueue').then(m => ({ default: m.ApprovalQueue })))
const AutomationRules       = React.lazy(() => import('./ai-marketing/AutomationRules').then(m => ({ default: m.AutomationRules })))
const AnalyticsSection      = React.lazy(() => import('./ai-marketing/AnalyticsSection').then(m => ({ default: m.AnalyticsSection })))
const PublishingCenter      = React.lazy(() => import('./ai-marketing/PublishingCenter').then(m => ({ default: m.PublishingCenter })))
const SystemSettings        = React.lazy(() => import('./ai-marketing/SystemSettings').then(m => ({ default: m.SystemSettings })))
const OrganizationManager   = React.lazy(() => import('./ai-marketing/OrganizationManager').then(m => ({ default: m.OrganizationManager })))
const HealthMonitor         = React.lazy(() => import('./ai-marketing/HealthMonitor').then(m => ({ default: m.HealthMonitor })))
const StagingQA             = React.lazy(() => import('./ai-marketing/StagingQA').then(m => ({ default: m.StagingQA })))
const HelpCenter            = React.lazy(() => import('./ai-marketing/HelpCenter').then(m => ({ default: m.HelpCenter })))

const SECTIONS = [
  { id: 'dashboard',    label: 'Dashboard',       icon: '📊' },
  { id: 'social-post',  label: 'Social Post',      icon: '✍️' },
  { id: 'creative',     label: 'Creative Studio',  icon: '🎬' },
  { id: 'comments',     label: 'Comment Replies',  icon: '💬' },
  { id: 'emails',       label: 'Email Replies',    icon: '📧' },
  { id: 'leads',        label: 'Lead Tracker',     icon: '🎯' },
  { id: 'calendar',     label: 'Content Calendar', icon: '📅' },
  { id: 'queue',        label: 'Approval Queue',   icon: '✅' },
  { id: 'publish',      label: 'Publishing',       icon: '🚀' },
  { id: 'automation',   label: 'Automation Rules', icon: '⚡' },
  { id: 'analytics',    label: 'Analytics',        icon: '📈' },
  { id: 'organization', label: 'Team & Org',       icon: '🏢' },
  { id: 'settings',     label: 'Settings',         icon: '⚙️' },
  { id: 'health',       label: 'System Health',    icon: '❤️' },
  { id: 'help',         label: 'Help & Docs',      icon: '📚' },
  { id: 'qa',           label: 'QA Checklist',     icon: '🧪' },
]

type SectionId = typeof SECTIONS[number]['id']

function renderSection(section: SectionId, onNavigate: (id: SectionId) => void) {
  switch (section) {
    case 'dashboard':    return <AIMarketingDashboard />
    case 'social-post':  return <SocialPostGenerator />
    case 'creative':     return <CreativeStudio />
    case 'comments':     return <CommentReplies />
    case 'emails':       return <EmailReplies />
    case 'leads':        return <LeadTracker />
    case 'calendar':     return <ContentCalendar />
    case 'queue':        return <ApprovalQueue />
    case 'publish':      return <PublishingCenter />
    case 'automation':   return <AutomationRules />
    case 'analytics':    return <AnalyticsSection />
    case 'organization': return <OrganizationManager />
    case 'settings':     return <SystemSettings />
    case 'health':       return <HealthMonitor />
    case 'help':         return <HelpCenter onNavigate={(id) => onNavigate(id as SectionId)} />
    case 'qa':           return <StagingQA onNavigate={(id) => onNavigate(id as SectionId)} />
    default:             return <AIMarketingDashboard />
  }
}

// true  → show DEMO MODE badge (mock data, no real API calls)
// false → show LIVE badge (real Claude API when key is configured)
const IS_DEMO = import.meta.env.VITE_ENABLE_DEMO_ACCESS === 'true'

const ORG_ONBOARDING_KEY = 'baykid_org_onboarding_complete'

function AIMarketingCenterInner() {
  const navigate = useNavigate()
  const [section, setSection] = useState<SectionId>('dashboard')
  const [bellCount, setBellCount] = useState(0)
  const [showOnboarding, setShowOnboarding] = useState(!isOnboardingComplete())
  const [showOrgOnboarding, setShowOrgOnboarding] = useState(
    !localStorage.getItem(ORG_ONBOARDING_KEY)
  )

  useEffect(() => {
    autoGenerateNotifications()
    setBellCount(unreadCount())
    // Sync latest Supabase data into localStorage (non-blocking)
    syncFromSupabase().then(({ posts, leads, rules }) => {
      if (posts + leads + rules > 0) {
        // Trigger a bell count refresh after sync completes
        setBellCount(unreadCount())
      }
    }).catch(() => {})
  }, [])

  const handleSectionChange = (id: SectionId) => {
    setSection(id)
    trackPageView(id)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0e1a', display: 'flex', flexDirection: 'column' }}>
      {/* ── Header ── */}
      <div
        style={{
          background: 'rgba(0,0,0,0.4)',
          borderBottom: '1px solid rgba(0,190,255,0.15)',
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}
      >
        <button
          onClick={() => navigate('/admin')}
          style={{
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.15)',
            color: 'rgba(255,255,255,0.7)',
            borderRadius: 10,
            padding: '8px 16px',
            fontWeight: 600,
            fontSize: 12,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            whiteSpace: 'nowrap',
          }}
        >
          ← Admin
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>
            🤖 Cyan's Brooklynn Marketing
          </span>
          {IS_DEMO ? (
            <span
              style={{
                background: 'rgba(0,200,255,0.12)',
                border: '1px solid rgba(0,200,255,0.3)',
                color: '#00c8ff',
                borderRadius: 20,
                padding: '3px 10px',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.05em',
                textShadow: '0 0 8px rgba(0,200,255,0.6)',
              }}
            >
              DEMO MODE
            </span>
          ) : (
            <span
              style={{
                background: 'rgba(34,197,94,0.12)',
                border: '1px solid rgba(34,197,94,0.35)',
                color: '#22c55e',
                borderRadius: 20,
                padding: '3px 10px',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.05em',
                textShadow: '0 0 8px rgba(34,197,94,0.5)',
              }}
            >
              ⚡ LIVE
            </span>
          )}
        </div>

        {/* Org switcher */}
        <OrgSwitcher onCreateOrg={() => setShowOrgOnboarding(true)} />

        {/* Active section label */}
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
          {SECTIONS.find((s) => s.id === section)?.label}
        </span>

        {/* Notification bell */}
        <button
          onClick={() => { setSection('dashboard'); setBellCount(0) }}
          title="Notifications — view on Dashboard"
          style={{ position: 'relative', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: bellCount > 0 ? '#fbbf24' : 'rgba(255,255,255,0.45)', borderRadius: 10, padding: '6px 12px', fontSize: 16, cursor: 'pointer', flexShrink: 0 }}
        >
          🔔
          {bellCount > 0 && (
            <span style={{ position: 'absolute', top: -5, right: -5, background: '#ef4444', color: '#fff', borderRadius: 10, padding: '0 5px', fontSize: 9, fontWeight: 800, lineHeight: '16px', minWidth: 16, textAlign: 'center' }}>
              {bellCount > 9 ? '9+' : bellCount}
            </span>
          )}
        </button>
      </div>

      {/* ── Body ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* ── Sidebar ── */}
        <div
          style={{
            width: 220,
            background: 'rgba(0,0,0,0.3)',
            borderRight: '1px solid rgba(0,190,255,0.1)',
            display: 'flex',
            flexDirection: 'column',
            padding: '12px 0',
            flexShrink: 0,
          }}
        >
          {SECTIONS.map((s) => {
            const active = section === s.id
            return (
              <button
                key={s.id}
                onClick={() => handleSectionChange(s.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 16px',
                  background: active ? 'rgba(0,200,255,0.1)' : 'transparent',
                  color: active ? '#00c8ff' : 'rgba(255,255,255,0.5)',
                  border: 'none',
                  borderLeftWidth: 2,
                  borderLeftStyle: 'solid',
                  borderLeftColor: active ? '#00c8ff' : 'transparent',
                  width: '100%',
                  textAlign: 'left',
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  outline: 'none',
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                    e.currentTarget.style.color = 'rgba(255,255,255,0.75)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.color = 'rgba(255,255,255,0.5)'
                  }
                }}
              >
                <span style={{ fontSize: 15 }}>{s.icon}</span>
                <span>{s.label}</span>
              </button>
            )
          })}
        </div>

        {/* ── Content Area ── */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 20,
          }}
        >
          <AIMarketingErrorBoundary key={section}>
            <Suspense fallback={
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200, color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
                <span style={{ animation: 'ai-spin 1s linear infinite', display: 'inline-block', marginRight: 8 }}>⟳</span>
                Loading…
              </div>
            }>
              {renderSection(section, handleSectionChange)}
            </Suspense>
          </AIMarketingErrorBoundary>
        </div>
      </div>

      {/* ── Spinner keyframes ── */}
      <style>{`@keyframes ai-spin { to { transform: rotate(360deg); } }`}</style>

      {/* ── Global toast stack ── */}
      <GlobalToastStack />

      {/* ── Onboarding flow (first visit) ── */}
      {showOnboarding && (
        <OnboardingFlow onComplete={() => setShowOnboarding(false)} />
      )}

      {/* ── Org onboarding (new org creation) ── */}
      {!showOnboarding && showOrgOnboarding && (
        <OrgOnboarding
          onComplete={() => {
            localStorage.setItem(ORG_ONBOARDING_KEY, '1')
            setShowOrgOnboarding(false)
          }}
          onSkip={() => {
            localStorage.setItem(ORG_ONBOARDING_KEY, '1')
            setShowOrgOnboarding(false)
          }}
        />
      )}
    </div>
  )
}

export default function AIMarketingCenter() {
  return (
    <OrgProvider>
      <MarketingProvider>
        <AIMarketingCenterInner />
      </MarketingProvider>
    </OrgProvider>
  )
}
