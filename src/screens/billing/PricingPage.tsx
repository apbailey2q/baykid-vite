// PricingPage — `/admin/billing/plans`
//
// Renders the four plans (Free, Starter, Pro, Enterprise) as cards. Highlights
// the org's current plan with an "Active" badge and swaps the CTA for "Manage
// billing". Other plans get a "Choose <plan>" button that calls Stripe Checkout
// via the stripe-create-checkout Edge Function and redirects to the hosted URL.
//
// Cycle toggle (Monthly / Yearly) applies to the price display + the price ID
// sent to Checkout.

import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  PLAN_CATALOG, findStaticPlan, fetchCurrentSubscription,
  createCheckoutSession, formatPriceCents, formatLimit, getActiveOrgId,
  isStripeConfigured,
} from '../../lib/billing'
import type { PlanCode, BillingCycle, SubscriptionWithPlan } from '../../types/billing'
import { BillingPortalButton } from '../../components/billing/BillingPortalButton'

export default function PricingPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const [orgId,    setOrgId]    = useState<string | null>(null)
  const [sub,      setSub]      = useState<SubscriptionWithPlan | null>(null)
  const [cycle,    setCycle]    = useState<BillingCycle>('monthly')
  const [busyPlan, setBusyPlan] = useState<PlanCode | null>(null)
  const [error,    setError]    = useState<string | null>(null)
  const canceled = params.get('canceled') === '1'

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const id = await getActiveOrgId()
        if (!mounted) return
        setOrgId(id)
        const s = await fetchCurrentSubscription(id).catch(() => null)
        if (!mounted) return
        setSub(s)
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : 'Could not load billing')
      }
    })()
    return () => { mounted = false }
  }, [])

  async function chooseplan(planCode: PlanCode) {
    if (!orgId) return
    setBusyPlan(planCode)
    setError(null)
    try {
      const { url } = await createCheckoutSession({ planCode, cycle, orgId })
      window.location.assign(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start checkout')
      setBusyPlan(null)
    }
  }

  const currentPlanCode = sub?.plan?.code ?? null

  return (
    <div
      className="min-h-screen px-5 py-8"
      style={{ background: 'linear-gradient(180deg,#060e24 0%,#040a1a 100%)' }}
    >
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
          <div>
            <button
              onClick={() => navigate(-1)}
              style={{
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.6)', borderRadius: 8, padding: '4px 10px',
                fontSize: 11, cursor: 'pointer', marginBottom: 10,
              }}
            >
              ‹ Back
            </button>
            <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 700, margin: 0 }}>
              Choose your plan
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginTop: 6 }}>
              Cancel or change anytime. Yearly saves ~17%.
            </p>
            {!isStripeConfigured() && (
              <p style={{ color: '#fbbf24', fontSize: 12, marginTop: 8 }}>
                ⚠️ Stripe not configured — clicking a plan will redirect to a mock URL.
                Set <code>VITE_STRIPE_PUBLISHABLE_KEY</code> and deploy the Edge Functions to go live.
              </p>
            )}
          </div>

          {sub && sub.stripe_customer_id && orgId && (
            <BillingPortalButton orgId={orgId} returnPath="/admin/billing/plans" />
          )}
        </div>

        {/* Cycle toggle */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: 3 }}>
            {(['monthly', 'yearly'] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCycle(c)}
                style={{
                  padding: '8px 18px', borderRadius: 8, border: 'none',
                  background:    cycle === c ? 'rgba(0,200,255,0.16)' : 'transparent',
                  color:         cycle === c ? '#00c8ff' : 'rgba(255,255,255,0.5)',
                  fontWeight: 700, fontSize: 12, textTransform: 'capitalize',
                  cursor: 'pointer',
                }}
              >
                {c} {c === 'yearly' && <span style={{ marginLeft: 4, color: '#22c55e', fontSize: 10 }}>save 17%</span>}
              </button>
            ))}
          </div>
        </div>

        {canceled && (
          <Notice tone="warn">Checkout canceled. Pick a plan when you're ready.</Notice>
        )}
        {error && (
          <Notice tone="error">{error}</Notice>
        )}

        {/* Plan grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 16,
        }}>
          {PLAN_CATALOG.map((plan) => {
            const isCurrent = currentPlanCode === plan.code
            const priceCents = cycle === 'yearly' ? plan.priceYearlyCents : plan.priceMonthlyCents
            return (
              <PlanCard
                key={plan.code}
                plan={plan}
                cycle={cycle}
                priceLabel={formatPriceCents(priceCents)}
                isCurrent={isCurrent}
                busy={busyPlan === plan.code}
                disabled={busyPlan !== null && busyPlan !== plan.code}
                onChoose={() => chooseplan(plan.code)}
              />
            )
          })}
        </div>

        <div style={{ textAlign: 'center', marginTop: 28 }}>
          <button
            onClick={() => navigate('/admin/billing/usage')}
            style={{
              background: 'none', border: 'none', color: 'rgba(0,200,255,0.7)',
              fontSize: 13, cursor: 'pointer',
            }}
          >
            See your current usage →
          </button>
        </div>
      </div>
    </div>
  )
}

// ── PlanCard ─────────────────────────────────────────────────────────────────

function PlanCard({
  plan, cycle, priceLabel, isCurrent, busy, disabled, onChoose,
}: {
  plan: ReturnType<typeof findStaticPlan>
  cycle: BillingCycle
  priceLabel: string
  isCurrent: boolean
  busy: boolean
  disabled: boolean
  onChoose: () => void
}) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: plan.highlight ? '1px solid rgba(0,200,255,0.5)' : '1px solid rgba(255,255,255,0.1)',
        borderRadius: 16, padding: 22, position: 'relative',
        boxShadow: plan.highlight ? '0 8px 28px rgba(0,190,255,0.15)' : 'none',
        display: 'flex', flexDirection: 'column', gap: 14, minHeight: 460,
      }}
    >
      {plan.highlight && (
        <span style={{
          position: 'absolute', top: -10, left: 22,
          background: 'linear-gradient(135deg,#0057e7,#00c8ff)', color: '#fff',
          fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 999,
          letterSpacing: '0.06em', textTransform: 'uppercase',
        }}>Most Popular</span>
      )}
      {isCurrent && (
        <span style={{
          position: 'absolute', top: -10, right: 22,
          background: 'rgba(34,197,94,0.18)', color: '#22c55e',
          border: '1px solid rgba(34,197,94,0.5)',
          fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 999,
          letterSpacing: '0.06em', textTransform: 'uppercase',
        }}>Current Plan</span>
      )}

      <div>
        <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 700, margin: 0 }}>{plan.name}</h3>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 4, lineHeight: 1.45 }}>
          {plan.description}
        </p>
      </div>

      <div>
        <span style={{ color: '#fff', fontSize: 30, fontWeight: 800, lineHeight: 1.1 }}>
          {priceLabel}
        </span>
        {plan.priceMonthlyCents > 0 && (
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginLeft: 4 }}>
            /{cycle === 'yearly' ? 'yr' : 'mo'}
          </span>
        )}
      </div>

      {/* Limits summary */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <LimitRow label="AI generations"  v={plan.limits.ai_generations_per_month}  suffix=" / mo" />
        <LimitRow label="Scheduled posts" v={plan.limits.scheduled_posts_per_month} suffix=" / mo" />
        <LimitRow label="Connected accounts" v={plan.limits.connected_accounts} />
        <LimitRow label="Team members"    v={plan.limits.team_members} />
        <LimitRow label="Automation rules" v={plan.limits.automation_rules} />
      </div>

      {/* Features */}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {plan.features.map((f) => (
          <li key={f} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <span style={{ color: '#22c55e', fontSize: 12 }}>✓</span>
            <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, lineHeight: 1.45 }}>{f}</span>
          </li>
        ))}
      </ul>

      <div style={{ marginTop: 'auto' }}>
        <button
          onClick={onChoose}
          disabled={isCurrent || busy || disabled}
          style={{
            width: '100%',
            background: isCurrent
              ? 'rgba(34,197,94,0.1)'
              : plan.highlight
                ? 'linear-gradient(135deg,#0057e7,#00c8ff)'
                : 'rgba(255,255,255,0.08)',
            border: isCurrent ? '1px solid rgba(34,197,94,0.4)' : 'none',
            color: isCurrent ? '#22c55e' : '#fff',
            borderRadius: 10, padding: '10px 14px',
            fontWeight: 700, fontSize: 13,
            cursor: isCurrent || busy || disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.5 : 1,
          }}
        >
          {isCurrent ? 'Current Plan' : busy ? 'Opening Checkout…' : `Choose ${plan.name}`}
        </button>
      </div>
    </div>
  )
}

function LimitRow({ label, v, suffix }: { label: string; v: number | null; suffix?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
      <span style={{ color: 'rgba(255,255,255,0.5)' }}>{label}</span>
      <span style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>
        {formatLimit(v)}{v !== null && suffix ? suffix : ''}
      </span>
    </div>
  )
}

// ── Notice ───────────────────────────────────────────────────────────────────

function Notice({ tone, children }: { tone: 'warn' | 'error'; children: React.ReactNode }) {
  const colorMap = {
    warn:  { bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.3)', color: '#fbbf24' },
    error: { bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.3)', color: '#f87171' },
  }[tone]
  return (
    <div style={{
      background: colorMap.bg, border: `1px solid ${colorMap.border}`,
      borderRadius: 10, padding: '10px 14px', marginBottom: 18,
      color: colorMap.color, fontSize: 12,
    }}>
      {children}
    </div>
  )
}
