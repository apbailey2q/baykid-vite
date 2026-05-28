// MarketingPricingPage — Public pricing page.
//
// Uses the PLAN_CATALOG from lib/billing.ts as the source of truth so this
// page and the in-app /admin/billing/plans page never drift. The CTA on each
// plan routes to /signup with the chosen plan stamped in query params so the
// signup flow can default to it. Enterprise has a "Contact sales" CTA that
// routes to the Contact page with a pre-filled intent.

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MarketingLayout, Container, SectionHeading, primaryBtn, ghostBtn } from './MarketingLayout'
import { PLAN_CATALOG, formatPriceCents, formatLimit } from '../../lib/billing'
import type { PlanCode, PlanLimits } from '../../types/billing'

const FAQS = [
  {
    q: 'Can I switch plans anytime?',
    a: 'Yes. Upgrade or downgrade from inside the app; Stripe prorates automatically and the new limits apply immediately.',
  },
  {
    q: 'What counts as an AI generation?',
    a: 'One Claude API call from any tool in the AI Marketing Center — caption, script, carousel, reply, etc. Failed calls are not counted.',
  },
  {
    q: 'Do you offer annual billing?',
    a: 'Yes. Save ~17% by paying yearly. The toggle at the top of this page flips the prices in real time.',
  },
  {
    q: 'Is there a free trial?',
    a: 'The Free plan is permanent and includes 10 AI generations / month. No credit card required for Free.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. From the Customer Portal, hit "Cancel subscription" — you keep access through the end of the current billing period.',
  },
]

export default function MarketingPricingPage() {
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly')

  return (
    <MarketingLayout>
      {/* Hero */}
      <section style={{ paddingTop: 64, paddingBottom: 32 }}>
        <Container>
          <div style={{ textAlign: 'center', maxWidth: 720, margin: '0 auto' }}>
            <span style={{ color: '#00c8ff', fontSize: 11, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
              Pricing
            </span>
            <h1 style={{ color: '#fff', fontSize: 40, fontWeight: 900, lineHeight: 1.1, marginTop: 10, marginBottom: 14, letterSpacing: '-0.02em' }}>
              Simple plans. Real limits.
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 16, lineHeight: 1.55 }}>
              No "contact us for pricing" theater. Start free, pay only when you outgrow it.
              Cancel anytime — your data stays yours.
            </p>
          </div>

          {/* Cycle toggle */}
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 28 }}>
            <div style={{
              display: 'inline-flex',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 12, padding: 4,
            }}>
              {(['monthly', 'yearly'] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setCycle(c)}
                  style={{
                    padding: '8px 18px', borderRadius: 8, border: 'none',
                    background:    cycle === c ? 'rgba(0,200,255,0.16)' : 'transparent',
                    color:         cycle === c ? '#00c8ff' : 'rgba(255,255,255,0.55)',
                    fontWeight: 700, fontSize: 12, textTransform: 'capitalize',
                    cursor: 'pointer',
                  }}
                >
                  {c} {c === 'yearly' && <span style={{ marginLeft: 4, color: '#22c55e', fontSize: 10 }}>save 17%</span>}
                </button>
              ))}
            </div>
          </div>
        </Container>
      </section>

      {/* Plan grid */}
      <section style={{ paddingTop: 24, paddingBottom: 50 }}>
        <Container>
          <div className="grid lg:grid-cols-4 md:grid-cols-2 grid-cols-1" style={{ gap: 16 }}>
            {PLAN_CATALOG.map((plan) => {
              const priceCents = cycle === 'yearly' ? plan.priceYearlyCents : plan.priceMonthlyCents
              return (
                <PlanCard
                  key={plan.code}
                  code={plan.code}
                  name={plan.name}
                  description={plan.description}
                  priceLabel={formatPriceCents(priceCents)}
                  cycle={cycle}
                  limits={plan.limits}
                  features={plan.features}
                  highlight={plan.code === 'pro'}
                />
              )
            })}
          </div>
        </Container>
      </section>

      {/* Comparison */}
      <section style={{ paddingTop: 36, paddingBottom: 50 }}>
        <Container>
          <SectionHeading eyebrow="Compare" title="Side by side" />
          <ComparisonTable />
        </Container>
      </section>

      {/* FAQ */}
      <section style={{ paddingTop: 40, paddingBottom: 60 }}>
        <Container>
          <SectionHeading eyebrow="FAQ" title="Pricing questions, answered" />
          <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {FAQS.map((f) => <FaqRow key={f.q} q={f.q} a={f.a} />)}
          </div>
        </Container>
      </section>

      {/* Final CTA */}
      <section style={{ paddingTop: 20, paddingBottom: 60 }}>
        <Container>
          <div style={{
            background: 'linear-gradient(135deg, rgba(0,87,231,0.16) 0%, rgba(94,234,212,0.10) 100%)',
            border: '1px solid rgba(0,200,255,0.32)',
            borderRadius: 22, padding: 36, textAlign: 'center',
          }}>
            <h3 style={{ color: '#fff', fontSize: 24, fontWeight: 800, marginBottom: 14 }}>
              Still on the fence?
            </h3>
            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14, marginBottom: 20 }}>
              Start free, no credit card. Upgrade only when the team outgrows it.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/signup" style={{ ...primaryBtn(), padding: '12px 22px', fontSize: 14 }}>Start free</Link>
              <Link to="/contact?intent=demo" style={{ ...ghostBtn(), padding: '12px 22px', fontSize: 14 }}>Book a demo</Link>
            </div>
          </div>
        </Container>
      </section>
    </MarketingLayout>
  )
}

// ── PlanCard ────────────────────────────────────────────────────────────────

function PlanCard({
  code, name, description, priceLabel, cycle, limits, features, highlight,
}: {
  code:        PlanCode
  name:        string
  description: string
  priceLabel:  string
  cycle:       'monthly' | 'yearly'
  limits:      PlanLimits
  features:    string[]
  highlight:   boolean
}) {
  const isEnterprise = code === 'enterprise'
  const isFree       = code === 'free'

  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: highlight ? '1px solid rgba(0,200,255,0.5)' : '1px solid rgba(255,255,255,0.1)',
      borderRadius: 18, padding: 22, position: 'relative',
      boxShadow: highlight ? '0 12px 50px rgba(0,190,255,0.18)' : 'none',
      display: 'flex', flexDirection: 'column', gap: 14, minHeight: 480,
    }}>
      {highlight && (
        <span style={{
          position: 'absolute', top: -10, left: 22,
          background: 'linear-gradient(135deg,#0057e7,#00c8ff)', color: '#fff',
          fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 999,
          letterSpacing: '0.06em', textTransform: 'uppercase',
        }}>Most Popular</span>
      )}

      <div>
        <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 800, margin: 0 }}>{name}</h3>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 4, lineHeight: 1.45 }}>{description}</p>
      </div>

      <div>
        <span style={{ color: '#fff', fontSize: 32, fontWeight: 800, lineHeight: 1.1 }}>{priceLabel}</span>
        {!isFree && (
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginLeft: 4 }}>
            /{cycle === 'yearly' ? 'yr' : 'mo'}
          </span>
        )}
      </div>

      {/* Compact limits */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <LimitRow label="AI generations"     v={limits.ai_generations_per_month}  s=" / mo" />
        <LimitRow label="Scheduled posts"    v={limits.scheduled_posts_per_month} s=" / mo" />
        <LimitRow label="Connected accounts" v={limits.connected_accounts} />
        <LimitRow label="Team seats"          v={limits.team_members} />
        <LimitRow label="Automation rules"   v={limits.automation_rules} />
      </div>

      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
        {features.map((f) => (
          <li key={f} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
            <span style={{ color: '#22c55e', fontSize: 11 }}>✓</span>
            <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, lineHeight: 1.45 }}>{f}</span>
          </li>
        ))}
      </ul>

      <div style={{ marginTop: 'auto' }}>
        {isEnterprise ? (
          <Link to="/contact?intent=demo&plan=enterprise" style={{ ...ghostBtn(), display: 'block', textAlign: 'center', width: '100%', padding: '10px 14px' }}>
            Contact sales
          </Link>
        ) : (
          <Link
            to={`/signup?plan=${code}&cycle=${cycle}`}
            style={{
              ...(highlight ? primaryBtn() : ghostBtn()),
              display: 'block', textAlign: 'center', width: '100%', padding: '10px 14px',
            }}
          >
            {isFree ? 'Start free' : `Choose ${name}`}
          </Link>
        )}
      </div>
    </div>
  )
}

function LimitRow({ label, v, s }: { label: string; v: number | null; s?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
      <span style={{ color: 'rgba(255,255,255,0.5)' }}>{label}</span>
      <span style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>
        {formatLimit(v)}{v !== null && s ? s : ''}
      </span>
    </div>
  )
}

// ── Comparison table ───────────────────────────────────────────────────────

function ComparisonTable() {
  const rows: { label: string; values: (string | boolean)[] }[] = [
    { label: 'AI Marketing Center',     values: [true, true, true, true]                                          },
    { label: 'Automation rules',        values: ['2 enabled', '10 enabled', '50 enabled', 'Unlimited']             },
    { label: 'Connected social accounts', values: ['1', '3', '10', 'Unlimited']                                    },
    { label: 'Cross-platform scheduling', values: [true, true, true, true]                                         },
    { label: 'Lead Tracker',              values: [true, true, true, true]                                         },
    { label: 'Brand Voice training',      values: [true, true, true, true]                                         },
    { label: 'Analytics',                 values: ['Basic', 'Basic', 'Advanced', 'Advanced + custom dashboards']    },
    { label: 'Support',                   values: ['Community', 'Email', 'Priority', 'Dedicated CSM']               },
    { label: 'SSO + SCIM',                values: [false, false, false, true]                                      },
    { label: 'Custom SLA',                values: [false, false, false, true]                                      },
  ]

  const plans = PLAN_CATALOG.map((p) => p.name)

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
        <thead>
          <tr>
            <th style={th()}></th>
            {plans.map((p) => <th key={p} style={th()}>{p}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td style={tdLabel()}>{r.label}</td>
              {r.values.map((v, i) => (
                <td key={i} style={td()}>
                  {typeof v === 'boolean' ? (
                    v ? <span style={{ color: '#22c55e' }}>✓</span> : <span style={{ color: 'rgba(255,255,255,0.25)' }}>—</span>
                  ) : (
                    <span>{v}</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function th(): React.CSSProperties {
  return { textAlign: 'left', padding: '12px 14px', fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800, borderBottom: '1px solid rgba(255,255,255,0.08)' }
}
function tdLabel(): React.CSSProperties { return { padding: '12px 14px', fontSize: 13, color: 'rgba(255,255,255,0.7)', borderBottom: '1px solid rgba(255,255,255,0.04)' } }
function td(): React.CSSProperties      { return { padding: '12px 14px', fontSize: 13, color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.04)' } }

// ── FAQ row ────────────────────────────────────────────────────────────────

function FaqRow({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ width: '100%', textAlign: 'left', padding: '14px 18px', background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}
      >
        <span style={{ fontSize: 14, fontWeight: 700 }}>{q}</span>
        <span style={{ color: 'rgba(255,255,255,0.4)' }}>{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div style={{ padding: '0 18px 14px', color: 'rgba(255,255,255,0.65)', fontSize: 13, lineHeight: 1.6 }}>{a}</div>
      )}
    </div>
  )
}
