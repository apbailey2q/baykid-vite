import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMockUser, getMockProfile, type BypassKey } from '../../lib/devBypass'
import { useAuthStore } from '../../store/authStore'
import { DEMO_ACCOUNTS, DEMO_METRICS } from '../../lib/demoEnvironment'

function fade(a: boolean, d = 0): React.CSSProperties {
  return {
    opacity:    a ? 1 : 0,
    transform:  a ? 'translateY(0)' : 'translateY(16px)',
    transition: `opacity 0.5s ease ${d}ms, transform 0.5s ease ${d}ms`,
  }
}

const FEATURES = [
  {
    icon:  '🤖',
    title: 'AI Load Inspection',
    body:  'Computer vision flags hazardous materials, contamination, and safety risks in seconds. Results are advisory — drivers and warehouse staff retain final judgment.',
  },
  {
    icon:  '🚛',
    title: 'Route Optimization',
    body:  'OSRM-powered routing sequences commercial stops by priority, weight capacity, and traffic. Real-time re-sequencing when stops are added or cancelled.',
  },
  {
    icon:  '🏭',
    title: 'Warehouse Intake',
    body:  'Scan-to-receive intake with weight logging, contamination flagging, and green/yellow/red classification. Full audit trail from pickup to processing.',
  },
  {
    icon:  '💳',
    title: 'Driver Earnings & Payouts',
    body:  'Transparent per-stop and per-pound earnings tracked in real time. Drivers cash out via Stripe. Supervisors see full payout history.',
  },
  {
    icon:  '📊',
    title: 'Analytics & Reporting',
    body:  'Route efficiency, contamination trends, warehouse throughput, CO₂ impact, and revenue — all in one admin dashboard. Exportable for grant reporting.',
  },
]

type DemoRoleId = 'commercial' | 'driver' | 'warehouse' | 'admin'

const DEMO_ROLES: {
  icon: string
  id: DemoRoleId
  title: string
  roleKey: BypassKey
  email: string
  color: string
  accentBg: string
  accentBorder: string
  features: string[]
  route: string
}[] = [
  {
    icon:         '🏢',
    id:           'commercial',
    title:        'Commercial Account',
    roleKey:      'admin', // closest mock; real demo uses Supabase account
    email:        DEMO_ACCOUNTS.commercial,
    color:        '#00c8ff',
    accentBg:     'rgba(0,200,255,0.08)',
    accentBorder: 'rgba(0,200,255,0.25)',
    features:     ['Schedule and track commercial pickups', 'View real-time driver locations', 'Review AI inspection results per load', 'Manage invoices and billing history'],
    route:        '/dashboard/commercial',
  },
  {
    icon:         '🚛',
    id:           'driver',
    title:        'Route Driver',
    roleKey:      'driver',
    email:        DEMO_ACCOUNTS.driver,
    color:        '#a78bfa',
    accentBg:     'rgba(167,139,250,0.08)',
    accentBorder: 'rgba(167,139,250,0.25)',
    features:     ['View optimized stop sequence', 'AI-assisted bag and bin inspection', 'Safety checklist and incident reporting', 'Real-time earnings per stop'],
    route:        '/dashboard/driver/commercial-routes',
  },
  {
    icon:         '🏭',
    id:           'warehouse',
    title:        'Warehouse Intake',
    roleKey:      'warehouse',
    email:        DEMO_ACCOUNTS.warehouse,
    color:        '#4ade80',
    accentBg:     'rgba(74,222,128,0.08)',
    accentBorder: 'rgba(74,222,128,0.25)',
    features:     ['Scan incoming commercial loads', 'Log weight and contamination level', 'Green/yellow/red classification', 'Quarantine and escalation workflow'],
    route:        '/dashboard/warehouse',
  },
  {
    icon:         '⚙️',
    id:           'admin',
    title:        'Admin & Analytics',
    roleKey:      'admin',
    email:        DEMO_ACCOUNTS.admin,
    color:        '#fbbf24',
    accentBg:     'rgba(251,191,36,0.08)',
    accentBorder: 'rgba(251,191,36,0.25)',
    features:     ['Full operations dashboard', 'Driver and route management', 'Revenue and environmental impact reports', 'Compliance audit trail (2-year retention)'],
    route:        '/dashboard/admin',
  },
]

const CITIES = [
  { name: 'Nashville, TN', status: 'Live Pilot', color: '#4ade80' },
  { name: 'Memphis, TN',   status: 'Q3 2026',   color: '#00c8ff' },
  { name: 'Knoxville, TN', status: 'Q4 2026',   color: '#a78bfa' },
  { name: 'Charlotte, NC', status: '2027',      color: 'rgba(255,255,255,0.35)' },
  { name: 'Atlanta, GA',   status: '2027',      color: 'rgba(255,255,255,0.35)' },
]

export default function DemoOverview() {
  const navigate   = useNavigate()
  const [a, setA]  = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => { const id = requestAnimationFrame(() => setA(true)); return () => cancelAnimationFrame(id) }, [])

  function copyEmail(email: string) {
    navigator.clipboard.writeText(email).catch(() => {})
    setCopied(email)
    setTimeout(() => setCopied(null), 2000)
  }

  function enterDemoRole(roleId: DemoRoleId) {
    const { setUser, setProfile, setLoading } = useAuthStore.getState()
    const roleKey = DEMO_ROLES.find(r => r.id === roleId)!.roleKey
    setUser(getMockUser(roleKey))
    setProfile(getMockProfile(roleKey))
    setLoading(false)
    localStorage.setItem('baykid-demo-mode', 'true')
    localStorage.setItem('baykid-demo-role', roleKey)
    navigate(DEMO_ROLES.find(r => r.id === roleId)!.route)
  }

  function goToRealLogin(email: string) {
    navigate(`/real-login?prefill_email=${encodeURIComponent(email)}`)
  }

  return (
    <div className="relative min-h-screen flex flex-col overflow-x-hidden" style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}>
      <div className="pointer-events-none absolute inset-0 grid-bg" />

      {/* Orbs */}
      <div className="pointer-events-none absolute" style={{ top: -100, left: -80, width: 400, height: 400, background: 'rgba(0,87,231,0.18)', filter: 'blur(100px)', borderRadius: '50%' }} />
      <div className="pointer-events-none absolute" style={{ top: 300, right: -80, width: 300, height: 300, background: 'rgba(94,234,212,0.08)', filter: 'blur(80px)', borderRadius: '50%' }} />
      <div className="pointer-events-none absolute" style={{ bottom: 200, left: -60, width: 260, height: 260, background: 'rgba(167,139,250,0.07)', filter: 'blur(80px)', borderRadius: '50%' }} />

      {/* ── Header ── */}
      <header className="relative flex items-center justify-between px-5 py-3.5" style={{ background: 'rgba(4,10,24,0.92)', borderBottom: '1px solid rgba(0,200,255,0.12)', backdropFilter: 'blur(12px)', zIndex: 2 }}>
        <div className="flex items-center gap-3">
          <span className="text-xl font-extrabold" style={{ color: '#00c8ff' }}>Cyan&#39;s Brooklynn</span>
          <span style={{ color: 'rgba(0,200,255,0.3)' }}>|</span>
          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest" style={{ background: 'rgba(94,234,212,0.12)', border: '1px solid rgba(94,234,212,0.3)', color: '#5eead4' }}>
            Investor Demo
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/real-login')} className="text-xs font-medium transition-opacity hover:opacity-70" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}>
            Staff Login →
          </button>
        </div>
      </header>

      <div className="relative flex-1 overflow-y-auto" style={{ zIndex: 1 }}>
        <div className="max-w-[600px] mx-auto px-4 pt-10 pb-20">

          {/* ── Hero ── */}
          <div className="text-center mb-10" style={fade(a, 0)}>
            <div className="flex items-center justify-center gap-2 mb-4">
              <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest" style={{ background: 'rgba(0,200,255,0.1)', border: '1px solid rgba(0,200,255,0.25)', color: '#00c8ff' }}>
                Live Demo Environment
              </span>
            </div>
            <h1 className="text-4xl font-extrabold mb-3 leading-tight" style={{ color: '#ffffff' }}>
              Cyan's Brooklynn<br />
              <span style={{ color: '#00c8ff' }}>Recycling Enterprise</span>
            </h1>
            <p className="text-base mb-1 font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Commercial recycling intelligence — from curb to warehouse.
            </p>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
              AI-assisted load inspection · Route optimization · Real-time logistics · Driver payouts
            </p>
          </div>

          {/* ── Impact Metrics ── */}
          <div className="mb-3" style={fade(a, 80)}>
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>Platform Impact</p>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-10" style={fade(a, 100)}>
            {DEMO_METRICS.map((m) => (
              <div key={m.label} className="rounded-2xl p-4 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="text-lg mb-1">{m.icon}</div>
                <div className="font-extrabold text-xl leading-tight" style={{ color: m.color }}>
                  {m.value}
                  <span className="text-xs font-normal ml-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{m.unit}</span>
                </div>
                <div className="text-[10px] mt-1 leading-snug" style={{ color: 'rgba(255,255,255,0.45)' }}>{m.label}</div>
              </div>
            ))}
          </div>

          {/* ── Platform Features ── */}
          <div className="mb-3" style={fade(a, 160)}>
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>Platform Capabilities</p>
          </div>
          <div className="flex flex-col gap-3 mb-10">
            {FEATURES.map((f, i) => (
              <div key={f.title} className="rounded-2xl p-4 flex gap-3" style={{ background: 'rgba(0,87,231,0.07)', border: '1px solid rgba(0,200,255,0.12)', ...fade(a, 180 + i * 30) }}>
                <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>{f.icon}</span>
                <div>
                  <p className="font-bold text-sm mb-1" style={{ color: '#ffffff' }}>{f.title}</p>
                  <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>{f.body}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Demo Role Launchers ── */}
          <div className="mb-3" style={fade(a, 340)}>
            <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>Interactive Demo Roles</p>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Sign in with a demo account to explore the full platform experience.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 mb-10 sm:grid-cols-2">
            {DEMO_ROLES.map((role, i) => (
              <div key={role.id} className="rounded-2xl p-5 flex flex-col" style={{ background: role.accentBg, border: `1px solid ${role.accentBorder}`, ...fade(a, 360 + i * 40) }}>
                <div className="flex items-center gap-2.5 mb-3">
                  <span style={{ fontSize: 20 }}>{role.icon}</span>
                  <p className="font-extrabold text-sm" style={{ color: '#ffffff' }}>{role.title}</p>
                </div>
                <ul className="flex flex-col gap-1.5 mb-4 flex-1">
                  {role.features.map(feat => (
                    <li key={feat} className="flex gap-1.5 text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>
                      <span style={{ color: role.color, flexShrink: 0 }}>›</span>
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>

                {/* Email row */}
                <button
                  onClick={() => copyEmail(role.email)}
                  className="flex items-center gap-2 rounded-xl px-3 py-2 mb-3 transition-opacity hover:opacity-80 text-left w-full"
                  style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}>📧</span>
                  <span className="flex-1 text-xs font-mono truncate" style={{ color: role.color, opacity: 0.85 }}>{role.email}</span>
                  <span style={{ fontSize: 9, color: copied === role.email ? '#4ade80' : 'rgba(255,255,255,0.25)', flexShrink: 0, fontWeight: 600 }}>
                    {copied === role.email ? 'Copied!' : 'Copy'}
                  </span>
                </button>

                {/* CTA buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => enterDemoRole(role.id)}
                    className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all hover:brightness-110 active:scale-[0.97]"
                    style={{ background: `linear-gradient(135deg, ${role.color}22, ${role.color}44)`, border: `1px solid ${role.color}55`, color: role.color }}
                  >
                    Quick Preview
                  </button>
                  <button
                    onClick={() => goToRealLogin(role.email)}
                    className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all hover:brightness-110 active:scale-[0.97]"
                    style={{ background: role.color, border: 'none', color: '#060e24' }}
                  >
                    Full Demo →
                  </button>
                </div>
                <p className="text-center mt-2" style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)' }}>
                  Quick Preview uses simulated data · Full Demo uses seeded live accounts
                </p>
              </div>
            ))}
          </div>

          {/* ── AI Disclaimer ── */}
          <div className="rounded-2xl p-4 mb-8" style={{ background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.15)', ...fade(a, 530) }}>
            <p className="text-xs font-bold mb-1" style={{ color: '#fbbf24' }}>🤖 About AI in This Platform</p>
            <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
              AI inspection results are advisory only and never replace human judgment. Drivers may override AI recommendations with a documented reason. All overrides are reviewed by administrators and logged in the compliance audit trail.
            </p>
          </div>

          {/* ── Market Expansion ── */}
          <div className="mb-3" style={fade(a, 560)}>
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>Expansion Roadmap</p>
          </div>
          <div className="rounded-2xl p-5 mb-10" style={{ background: 'rgba(0,87,231,0.07)', border: '1px solid rgba(0,200,255,0.12)', ...fade(a, 580) }}>
            <div className="flex flex-col gap-3">
              {CITIES.map((city, i) => (
                <div key={city.name} className="flex items-center justify-between" style={{ paddingTop: i > 0 ? 10 : 0, borderTop: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                  <div className="flex items-center gap-2.5">
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: city.color, flexShrink: 0 }} />
                    <p className="text-sm font-medium" style={{ color: '#ffffff' }}>{city.name}</p>
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: `${city.color}18`, color: city.color, border: `1px solid ${city.color}40` }}>
                    {city.status}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs mt-4 leading-relaxed" style={{ color: 'rgba(255,255,255,0.35)' }}>
              The Cyan&#39;s Brooklynn platform is built for multi-city scale. Each new market launches with pre-configured warehouse facilities, driver onboarding, and commercial account integration — no custom development required.
            </p>
          </div>

          {/* ── Sustainability ── */}
          <div className="rounded-2xl p-5 mb-8" style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.15)', ...fade(a, 620) }}>
            <div className="flex items-center gap-2 mb-3">
              <span style={{ fontSize: 18 }}>🌍</span>
              <p className="font-bold text-sm" style={{ color: '#4ade80' }}>Environmental Impact</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                ['847,234 lbs', 'Diverted from landfill this year'],
                ['423 tons', 'CO₂ equivalent prevented'],
                ['94.7%', 'Recyclables correctly sorted'],
                ['18%', 'Contamination reduction YoY'],
              ].map(([val, label]) => (
                <div key={label}>
                  <p className="text-lg font-extrabold" style={{ color: '#4ade80' }}>{val}</p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Contact / CTA ── */}
          <div className="rounded-2xl p-6 mb-6" style={{ background: 'linear-gradient(135deg, rgba(0,87,231,0.15), rgba(0,200,255,0.08))', border: '1px solid rgba(0,200,255,0.2)', ...fade(a, 660) }}>
            <p className="font-extrabold text-base mb-1" style={{ color: '#ffffff' }}>Ready to partner?</p>
            <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.5)' }}>
              We're onboarding pilot commercial accounts, municipal partners, and grant sponsors.
            </p>
            <a
              href="mailto:hello@cyansbrooklynnrecycling.com?subject=Cyan&#39;s Brooklynn Partnership Inquiry"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all hover:brightness-110"
              style={{ background: '#00c8ff', color: '#060e24', textDecoration: 'none' }}
            >
              📬 Contact Us
            </a>
          </div>

          {/* Footer */}
          <div style={{ ...fade(a, 680) }}>
            <p className="text-center text-xs" style={{ color: 'rgba(255,255,255,0.25)', lineHeight: 1.7 }}>
              Cyan's Brooklynn Recycling Enterprise · Nashville, TN
              <br />
              <span style={{ color: 'rgba(255,255,255,0.15)' }}>
                This is a demo environment with seeded data. No real customer data is displayed.
              </span>
            </p>
            <div className="flex items-center justify-center gap-4 mt-3">
              {[
                ['Privacy Policy', '/legal/privacy-policy'],
                ['Terms of Service', '/legal/terms-of-service'],
                ['Legal Center', '/legal'],
              ].map(([label, href]) => (
                <a key={href} href={href} style={{ fontSize: 10, color: 'rgba(0,200,255,0.5)', textDecoration: 'none' }}>{label}</a>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
