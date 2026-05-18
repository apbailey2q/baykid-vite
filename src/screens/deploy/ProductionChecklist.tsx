import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

function fade(a: boolean, d = 0): React.CSSProperties {
  return {
    opacity:    a ? 1 : 0,
    transform:  a ? 'translateY(0)' : 'translateY(12px)',
    transition: `opacity 0.4s ease ${d}ms, transform 0.4s ease ${d}ms`,
  }
}

interface CheckItem {
  id:       string
  label:    string
  detail?:  string
  critical: boolean
}

interface Section {
  icon:   string
  title:  string
  color:  string
  items:  CheckItem[]
}

const SECTIONS: Section[] = [
  {
    icon:  '🌐', title: 'Environment & Infrastructure', color: '#00c8ff',
    items: [
      { id: 'e1', label: 'Separate production Supabase project created',         detail: 'Not the dev project. Separate database, storage, and Edge Functions.',                  critical: true  },
      { id: 'e2', label: 'Production frontend deployed (Vercel/Netlify)',         detail: 'Production branch deployed, not a preview URL.',                                        critical: true  },
      { id: 'e3', label: 'Production env vars configured in Vercel dashboard',    detail: 'VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_STRIPE_PUBLISHABLE_KEY',               critical: true  },
      { id: 'e4', label: 'VITE_DEV_BYPASS_AUTH is NOT set in production',        detail: 'Confirm in Vercel → Settings → Environment Variables.',                                critical: true  },
      { id: 'e5', label: 'VITE_DEMO_MODE is NOT set in production',              detail: 'Demo mode must be off for live users.',                                                 critical: true  },
      { id: 'e6', label: 'Security headers confirmed via vercel.json',            detail: 'X-Frame-Options, CSP, HSTS, Permissions-Policy all in place.',                         critical: false },
    ],
  },
  {
    icon:  '🗄️', title: 'Database & Security', color: '#a78bfa',
    items: [
      { id: 'd1', label: 'RLS enabled on all critical tables',                    detail: 'Run production_readiness_check() — all rows must show ✓.',                            critical: true  },
      { id: 'd2', label: 'No overly permissive policies (qual = true)',           detail: 'Review pg_policies query from hardening migration.',                                   critical: true  },
      { id: 'd3', label: 'No dev/bypass/demo RLS policies active',               detail: 'Hardening migration runs DROP on any policy matching *demo*, *bypass*, *dev_*.',      critical: true  },
      { id: 'd4', label: 'Daily database backups enabled',                        detail: 'Supabase Dashboard → Database → Backups → Enable.',                                  critical: true  },
      { id: 'd5', label: 'Storage buckets are private (not public)',              detail: 'inspection-photos and beta-screenshots must not allow anonymous reads.',               critical: true  },
      { id: 'd6', label: 'Supabase trusted origins set to production domain only',detail: 'Remove localhost from allowed origins before launch.',                               critical: true  },
      { id: 'd7', label: 'Demo/test seed data removed or isolated',               detail: 'No demo-*.@cyanrecycling.com accounts in production DB.',                            critical: false },
    ],
  },
  {
    icon:  '💳', title: 'Stripe Production', color: '#4ade80',
    items: [
      { id: 's1', label: 'Stripe account switched to live mode',                  detail: 'Dashboard shows Live, not Test.',                                                      critical: true  },
      { id: 's2', label: 'Live publishable key in frontend env (pk_live_…)',      detail: 'VITE_STRIPE_PUBLISHABLE_KEY starts with pk_live_.',                                   critical: true  },
      { id: 's3', label: 'Live secret key in Supabase Edge Function secrets',     detail: 'STRIPE_SECRET_KEY = sk_live_… — never in frontend.',                                 critical: true  },
      { id: 's4', label: 'Webhook URL registered with production domain',         detail: 'Stripe Dashboard → Webhooks → Add endpoint → your production URL.',                  critical: true  },
      { id: 's5', label: 'Webhook signing secret in Edge Function secrets',       detail: 'STRIPE_WEBHOOK_SECRET = whsec_… from the webhook endpoint.',                         critical: true  },
      { id: 's6', label: 'Internal test payment completed ($1.00)',               detail: 'End-to-end: invoice → checkout → paid status confirmed in DB.',                       critical: true  },
      { id: 's7', label: 'Payout flow tested with real bank account',             detail: 'Small payout issued to a test driver account. Confirmed in Stripe.',                 critical: false },
    ],
  },
  {
    icon:  '🔔', title: 'Push Notifications', color: '#fbbf24',
    items: [
      { id: 'p1', label: 'APNs credentials uploaded to push provider',            detail: 'Apple Developer → Certificates → APNs key uploaded to Expo.',                       critical: true  },
      { id: 'p2', label: 'Firebase FCM credentials configured',                   detail: 'Firebase project server key in push provider settings.',                             critical: true  },
      { id: 'p3', label: 'iOS push notification tested on production device',     detail: 'Not simulator — real iOS device with production build.',                             critical: true  },
      { id: 'p4', label: 'Android push notification tested on production device', detail: 'Real Android device, not emulator.',                                                 critical: true  },
      { id: 'p5', label: 'Deep link navigation tested after tap',                 detail: 'Tap push → correct screen opens (e.g., /dashboard/driver/commercial-routes).',       critical: false },
      { id: 'p6', label: 'Notification preferences opt-out respected',            detail: 'User who disables route alerts does not receive them.',                              critical: false },
    ],
  },
  {
    icon:  '🌍', title: 'Domain & SSL', color: '#5eead4',
    items: [
      { id: 'c1', label: 'Custom domain configured',                              detail: 'e.g. app.cyansbrooklynnrecycling.com — not a Vercel subdomain.',                    critical: false },
      { id: 'c2', label: 'HTTPS certificate active and auto-renewing',            detail: 'SSL valid, not expiring within 30 days.',                                           critical: true  },
      { id: 'c3', label: 'HSTS header confirmed (Strict-Transport-Security)',     detail: 'Verify with securityheaders.com or curl -I on production URL.',                    critical: false },
      { id: 'c4', label: 'All redirects go to HTTPS',                            detail: 'HTTP → HTTPS redirect active. No mixed content warnings in browser.',                critical: true  },
      { id: 'c5', label: 'Production URL in Supabase Auth redirect list',        detail: 'Authentication → URL Configuration → Redirect URLs.',                               critical: true  },
    ],
  },
  {
    icon:  '📊', title: 'Monitoring & Logging', color: '#f87171',
    items: [
      { id: 'm1', label: 'Supabase Edge Function logs accessible',                detail: 'Supabase Dashboard → Edge Functions → Logs tab.',                                   critical: true  },
      { id: 'm2', label: 'Payment failure logging wired (monitor.payment.error)', detail: 'Callsites in invoice/checkout code use monitoring.ts.',                            critical: true  },
      { id: 'm3', label: 'Push delivery errors logged',                           detail: 'monitor.push.error() called on Expo push failure responses.',                       critical: false },
      { id: 'm4', label: 'GPS sync errors logged',                                detail: 'watchPosition error handler calls monitor.gps.error().',                           critical: false },
      { id: 'm5', label: 'Inspection escalation notifications tested',            detail: 'Red inspection triggers supervisor alert. Confirmed received.',                     critical: true  },
      { id: 'm6', label: 'External error monitoring configured (optional)',       detail: 'Wire VITE_SENTRY_DSN in monitoring.ts for production error capture.',              critical: false },
    ],
  },
  {
    icon:  '📱', title: 'Mobile Builds', color: '#00c8ff',
    items: [
      { id: 'b1', label: 'iOS build submitted to TestFlight',                     detail: 'Production EAS build profile. App Review passed or internal testing active.',      critical: false },
      { id: 'b2', label: 'Android AAB uploaded to Google Play internal testing',  detail: 'Production signed AAB. Not debug build.',                                          critical: false },
      { id: 'b3', label: 'Camera permission tested on device',                   detail: 'QR scan and inspection photo both work on real device.',                            critical: true  },
      { id: 'b4', label: 'GPS/Location permission tested on device',             detail: 'Driver GPS tracking starts and stops correctly during route.',                      critical: true  },
      { id: 'b5', label: 'Offline mode tested on real mobile connection loss',   detail: 'Airplane mode → inspect → reconnect → draft syncs.',                               critical: true  },
      { id: 'b6', label: 'App opens from push notification deep link',           detail: 'Tap push on locked screen → correct dashboard opens.',                             critical: false },
    ],
  },
  {
    icon:  '✅', title: 'Final QA', color: '#4ade80',
    items: [
      { id: 'q1',  label: 'No blank screens across all role dashboards',          detail: 'Test consumer, driver, warehouse, commercial, admin, partner.',                     critical: true  },
      { id: 'q2',  label: 'No console errors in production build',               detail: 'npm run build → serve dist → open DevTools → zero errors.',                        critical: true  },
      { id: 'q3',  label: 'No demo/test data visible to real users',             detail: 'Production DB contains no demo-* accounts or seeded fake businesses.',             critical: true  },
      { id: 'q4',  label: 'Legal pages live and accessible without auth',        detail: '/legal, /legal/privacy-policy, /legal/terms-of-service all load.',                critical: true  },
      { id: 'q5',  label: 'Contact support email works',                         detail: 'Send test email to support@cyansbrooklynnrecycling.com — inbox confirms receipt.', critical: true  },
      { id: 'q6',  label: 'Inspection flow tested end-to-end',                   detail: 'Photo → AI result → checklist → submit → warehouse receives → admin reviews.',     critical: true  },
      { id: 'q7',  label: 'Route optimization tested with real GPS',             detail: 'Driver online → optimize → stops reorder correctly.',                             critical: true  },
      { id: 'q8',  label: 'Warehouse intake tested with a real scan',            detail: 'Barcode or manual entry → load received → weight logged.',                        critical: true  },
      { id: 'q9',  label: 'Invoice cycle complete: create → pay → confirmed',    detail: 'Commercial account invoice → Stripe checkout → paid status in DB.',               critical: true  },
      { id: 'q10', label: 'Mobile layout verified at 375px (iPhone SE)',         detail: 'No horizontal overflow, all buttons reachable, text readable.',                   critical: true  },
    ],
  },
  {
    icon:  '🚀', title: 'Go-Live & Rollback Plan', color: '#fbbf24',
    items: [
      { id: 'g1', label: 'Rollback procedure documented and tested',              detail: 'Vercel rollback to previous deployment. DB backup restore tested.',                critical: true  },
      { id: 'g2', label: 'Emergency contacts identified for launch week',         detail: 'Supabase on-call, Stripe support, team escalation chain documented.',             critical: true  },
      { id: 'g3', label: 'All pilot users invited and accounts approved',         detail: 'Profiles have approval_status = approved. Accounts tested by each user.',        critical: true  },
      { id: 'g4', label: 'Support inbox monitored during first live week',        detail: 'support@cyansbrooklynnrecycling.com has a live monitor.',                        critical: true  },
      { id: 'g5', label: 'Pilot rollout order documented (admin → warehouse → driver → commercial)', detail: 'Staged rollout reduces blast radius of any issues.',          critical: false },
    ],
  },
]

const STORAGE_KEY = 'baykid_prod_checklist'

function loadChecked(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') }
  catch { return {} }
}

export default function ProductionChecklist() {
  const navigate   = useNavigate()
  const [a, setA]  = useState(false)
  const [checked, setChecked] = useState<Record<string, boolean>>(loadChecked)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => { const id = requestAnimationFrame(() => setA(true)); return () => cancelAnimationFrame(id) }, [])
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(checked)) }, [checked])

  const allItems    = SECTIONS.flatMap(s => s.items)
  const critical    = allItems.filter(i => i.critical)
  const totalDone   = allItems.filter(i => checked[i.id]).length
  const criticalDone = critical.filter(i => checked[i.id]).length
  const pct         = Math.round((totalDone / allItems.length) * 100) || 0
  const readyToLaunch = criticalDone === critical.length

  function toggle(id: string) {
    setChecked(prev => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden" style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}>
      <div className="pointer-events-none absolute inset-0 grid-bg" />

      <header className="relative flex items-center justify-between px-4 py-3" style={{ background: 'rgba(4,10,24,0.92)', borderBottom: '1px solid rgba(0,200,255,0.12)', backdropFilter: 'blur(12px)', zIndex: 2 }}>
        <div className="flex items-center gap-3">
          <span className="text-xl font-extrabold" style={{ color: '#00c8ff' }}>BayKid</span>
          <span style={{ color: 'rgba(0,200,255,0.3)' }}>|</span>
          <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>Production Launch</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.print()}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.35)', fontSize: 12 }}
          >
            Print
          </button>
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
            ← Back
          </button>
        </div>
      </header>

      <div className="relative flex-1 overflow-y-auto pb-20" style={{ zIndex: 1 }}>
        <div className="max-w-[560px] mx-auto px-4 pt-7 pb-8">

          {/* Header */}
          <div className="mb-6" style={fade(a, 0)}>
            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest mb-3 inline-block" style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24' }}>
              Ops Runbook
            </span>
            <h1 className="text-2xl font-extrabold mb-1.5" style={{ color: '#ffffff' }}>Production Launch Checklist</h1>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Complete every critical item before flipping live. State is saved in this browser.
            </p>
          </div>

          {/* Progress */}
          <div className="rounded-2xl p-5 mb-6" style={{ background: 'rgba(0,87,231,0.08)', border: '1px solid rgba(0,200,255,0.15)', ...fade(a, 40) }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold" style={{ color: '#ffffff' }}>Overall Progress</p>
              <span className="text-sm font-extrabold" style={{ color: pct === 100 ? '#4ade80' : '#00c8ff' }}>{totalDone} / {allItems.length}</span>
            </div>
            <div className="rounded-full overflow-hidden mb-3" style={{ height: 7, background: 'rgba(255,255,255,0.07)' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #0057e7, #00c8ff)', borderRadius: 999, transition: 'width 0.4s ease' }} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold mb-0.5" style={{ color: readyToLaunch ? '#4ade80' : '#f87171' }}>
                  {readyToLaunch ? '✓ All critical items complete — ready to launch' : `⚠ ${critical.length - criticalDone} critical item${critical.length - criticalDone !== 1 ? 's' : ''} remaining`}
                </p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  Critical: {criticalDone}/{critical.length} · Total: {pct}% complete
                </p>
              </div>
              {readyToLaunch && (
                <span className="text-2xl">🚀</span>
              )}
            </div>
          </div>

          {/* Sections */}
          <div className="flex flex-col gap-5">
            {SECTIONS.map((section, si) => {
              const sectionItems  = section.items
              const sectionDone   = sectionItems.filter(i => checked[i.id]).length
              const sectionPct    = Math.round((sectionDone / sectionItems.length) * 100)

              return (
                <div key={section.title} className="rounded-2xl overflow-hidden" style={{ background: 'rgba(0,87,231,0.06)', border: `1px solid ${section.color}22`, ...fade(a, 80 + si * 30) }}>
                  {/* Section header */}
                  <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="flex items-center gap-2.5">
                      <span style={{ fontSize: 16 }}>{section.icon}</span>
                      <p className="font-bold text-sm" style={{ color: '#ffffff' }}>{section.title}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold" style={{ color: sectionPct === 100 ? '#4ade80' : section.color }}>
                        {sectionDone}/{sectionItems.length}
                      </span>
                      <div className="rounded-full overflow-hidden" style={{ width: 40, height: 4, background: 'rgba(255,255,255,0.07)' }}>
                        <div style={{ width: `${sectionPct}%`, height: '100%', background: sectionPct === 100 ? '#4ade80' : section.color, transition: 'width 0.3s ease', borderRadius: 999 }} />
                      </div>
                    </div>
                  </div>

                  {/* Items */}
                  <div>
                    {sectionItems.map((item, ii) => {
                      const done = !!checked[item.id]
                      const isExpanded = expanded === item.id
                      return (
                        <div key={item.id} style={{ borderTop: ii > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                          <button
                            className="w-full flex items-start gap-3 px-5 py-3.5 text-left transition-colors hover:bg-white/[0.02]"
                            onClick={() => toggle(item.id)}
                          >
                            {/* Checkbox */}
                            <div
                              className="flex-shrink-0 mt-0.5 flex items-center justify-center rounded-md"
                              style={{
                                width: 18, height: 18,
                                background: done ? (item.critical ? '#4ade80' : section.color) : 'transparent',
                                border: done ? 'none' : `1.5px solid ${item.critical ? 'rgba(248,113,113,0.5)' : 'rgba(255,255,255,0.2)'}`,
                                transition: 'all 0.15s ease',
                              }}
                            >
                              {done && <span style={{ color: '#060e24', fontSize: 11, fontWeight: 900 }}>✓</span>}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm leading-snug" style={{ color: done ? 'rgba(255,255,255,0.4)' : '#ffffff', textDecoration: done ? 'line-through' : 'none' }}>
                                  {item.label}
                                </p>
                                {item.critical && !done && (
                                  <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider flex-shrink-0" style={{ background: 'rgba(248,113,113,0.12)', color: '#f87171', border: '1px solid rgba(248,113,113,0.25)' }}>
                                    Critical
                                  </span>
                                )}
                              </div>
                              {item.detail && (
                                <button
                                  className="text-left mt-0.5"
                                  onClick={e => { e.stopPropagation(); setExpanded(isExpanded ? null : item.id) }}
                                >
                                  <p className="text-xs" style={{ color: isExpanded ? section.color : 'rgba(255,255,255,0.25)', transition: 'color 0.15s' }}>
                                    {isExpanded ? '▲ Hide detail' : '▼ How to verify'}
                                  </p>
                                </button>
                              )}
                              {isExpanded && item.detail && (
                                <p className="text-xs mt-1.5 leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.03)', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.07)' }}>
                                  {item.detail}
                                </p>
                              )}
                            </div>
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Reset */}
          <div className="mt-6 flex justify-center" style={fade(a, 400)}>
            <button
              onClick={() => { if (window.confirm('Reset all checklist items to unchecked?')) setChecked({}) }}
              className="rounded-xl px-5 py-2.5 text-xs font-bold transition-all hover:opacity-70"
              style={{ background: 'none', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.25)' }}
            >
              Reset All
            </button>
          </div>

          {/* Pilot order */}
          <div className="rounded-2xl p-5 mt-5" style={{ background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.15)', ...fade(a, 420) }}>
            <p className="text-xs font-bold mb-3" style={{ color: '#4ade80' }}>📋 Recommended Pilot Rollout Order</p>
            <ol className="flex flex-col gap-2">
              {[
                ['1', 'Internal admin testing — verify full dashboard, dispatch, audit log'],
                ['2', 'Internal warehouse testing — intake, processing, alerts'],
                ['3', 'Driver pilot (2–3 drivers) — route, inspection, earnings, GPS'],
                ['4', 'Small commercial pilot (2–3 accounts) — request, track, invoice'],
                ['5', 'Multi-warehouse expansion — second facility onboarded'],
                ['6', 'Public expansion — open registration to broader market'],
              ].map(([n, label]) => (
                <li key={n} className="flex gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80' }}>{n}</span>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{label}</p>
                </li>
              ))}
            </ol>
          </div>

        </div>
      </div>
    </div>
  )
}
