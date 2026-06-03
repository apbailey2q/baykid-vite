/**
 * CommercialBillingDashboard — plan, usage, and payment overview for a commercial account.
 *
 * Sections:
 *   1. Current plan card (plan_name, service_plan, account_status)
 *   2. Outstanding balance card with Pay Now CTA (links to /invoices for checkout)
 *   3. Pickup usage this month (from commercial_pickups)
 *   4. Service reliability (completion rate)
 *   5. Recent invoices (last 3 rows)
 *
 * Stripe note: Commercial recycling accounts use invoice-based billing.
 *   The "Pay Now" button navigates to /dashboard/commercial/invoices which
 *   calls the create-commercial-checkout Edge Function. Stripe Customer Portal
 *   is NOT available for commercial accounts (that's for SaaS subscribers).
 *   Plan upgrades require contacting support.
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { CommercialLayout } from './CommercialLayout'
import { GlassCard } from '../../components/ui/GlassCard'
import { PrimaryButton } from '../../components/ui/PrimaryButton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { Spinner } from '../../components/ui/Spinner'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AccountRow {
  id:               string
  business_name:    string
  plan_name:        string | null
  service_plan:     string | null
  account_status:   string
  stripe_customer_id: string | null
}

interface InvoiceRow {
  id:             string
  invoice_number: string | null
  billing_period: string | null
  amount:         number
  status:         'pending' | 'paid' | 'overdue'
  due_date:       string
  issued_at:      string
}

interface PickupRow {
  id:           string
  status:       string
  scheduled_at: string | null
  created_at:   string
}

type PageState = 'loading' | 'no_user' | 'no_account' | 'ready' | 'error'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt$(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function currentMonthStart(): string {
  const n = new Date()
  return new Date(n.getFullYear(), n.getMonth(), 1).toISOString()
}

function planStatusVariant(status: string): 'green' | 'yellow' | 'red' | 'gray' {
  if (status === 'active')    return 'green'
  if (status === 'pending')   return 'yellow'
  if (status === 'suspended') return 'red'
  return 'gray'
}

function planStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    active:    'Active',
    pending:   'Pending Setup',
    suspended: 'Suspended',
  }
  return labels[status] ?? status
}

function invoiceBadge(status: 'pending' | 'paid' | 'overdue') {
  const map = {
    pending: { variant: 'amber' as const, label: 'Due'     },
    overdue: { variant: 'red'   as const, label: 'Overdue' },
    paid:    { variant: 'green' as const, label: 'Paid'    },
  }
  return map[status]
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p style={{
      fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)',
      textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10,
    }}>
      {children}
    </p>
  )
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ msg }: { msg: string }) {
  return (
    <div
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-sm font-semibold"
      style={{
        background: 'rgba(0,200,255,0.15)', border: '1px solid rgba(0,200,255,0.3)', color: '#00c8ff',
        backdropFilter: 'blur(12px)', whiteSpace: 'nowrap', maxWidth: 'calc(100vw - 32px)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
      }}
    >
      {msg}
    </div>
  )
}

// ── Stat pill ─────────────────────────────────────────────────────────────────

function StatPill({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <GlassCard padding="sm" className="text-center">
      <p style={{ fontSize: 20, fontWeight: 900, color, lineHeight: 1 }}>{value}</p>
      <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 4 }}>
        {label}
      </p>
    </GlassCard>
  )
}

// ── Reliability ring ──────────────────────────────────────────────────────────

function ReliabilityRing({ pct }: { pct: number }) {
  const color = pct >= 90 ? '#4ade80' : pct >= 70 ? '#fbbf24' : '#f87171'
  const r = 26, circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  return (
    <svg width={68} height={68} viewBox="0 0 68 68" style={{ flexShrink: 0 }}>
      <circle cx={34} cy={34} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={7} />
      <circle
        cx={34} cy={34} r={r} fill="none"
        stroke={color} strokeWidth={7}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        transform="rotate(-90 34 34)"
      />
      <text x={34} y={38} textAnchor="middle" fill={color} fontSize={13} fontWeight={800}>{pct}%</text>
    </svg>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function CommercialBillingDashboard() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [pageState, setPageState] = useState<PageState>('loading')
  const [account,   setAccount]   = useState<AccountRow | null>(null)
  const [invoices,  setInvoices]  = useState<InvoiceRow[]>([])
  const [pickups,   setPickups]   = useState<PickupRow[]>([])
  const [toast,     setToast]     = useState<string | null>(null)

  // ── Load ─────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!user) { setPageState('no_user'); return }
    setPageState('loading')

    const { data: acct } = await supabase
      .from('commercial_accounts')
      .select('id, business_name, plan_name, service_plan, account_status, stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!acct) { setPageState('no_account'); return }

    const [invRes, pickRes] = await Promise.all([
      supabase
        .from('commercial_invoices')
        .select('id, invoice_number, billing_period, amount, status, due_date, issued_at')
        .eq('account_id', acct.id)
        .order('issued_at', { ascending: false })
        .limit(20),
      supabase
        .from('commercial_pickups')
        .select('id, status, scheduled_at, created_at')
        .eq('account_id', acct.id)
        .order('created_at', { ascending: false })
        .limit(200),
    ])

    if (invRes.error) { setPageState('error'); return }

    setAccount(acct as AccountRow)
    setInvoices((invRes.data ?? []) as InvoiceRow[])
    setPickups((pickRes.data ?? []) as PickupRow[])
    setPageState('ready')
  }, [user])

  useEffect(() => { void load() }, [load])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  // ── Derived stats ─────────────────────────────────────────────────────────

  const monthStart = currentMonthStart()

  const thisMonth  = pickups.filter(p => (p.scheduled_at ?? p.created_at) >= monthStart)
  const completed  = thisMonth.filter(p => p.status === 'completed').length
  const pending    = thisMonth.filter(p => ['requested', 'assigned', 'scheduled', 'in_progress'].includes(p.status)).length
  const cancelled  = thisMonth.filter(p => p.status === 'cancelled').length
  const flagged    = thisMonth.filter(p => p.status === 'flagged').length

  const allCompleted  = pickups.filter(p => p.status === 'completed').length
  const allTotal      = pickups.filter(p => p.status !== 'cancelled').length
  const reliabilityPct = allTotal > 0 ? Math.min(100, Math.round((allCompleted / allTotal) * 100)) : 100

  const unpaidInvoice  = invoices.find(i => i.status !== 'paid') ?? null
  const pendingBalance = invoices
    .filter(i => i.status !== 'paid')
    .reduce((s, i) => s + i.amount, 0)
  const recentInvoices = invoices.slice(0, 3)

  // ── Guard states ──────────────────────────────────────────────────────────

  if (pageState === 'loading') {
    return (
      <CommercialLayout>
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Spinner size="lg" />
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Loading billing…</p>
        </div>
      </CommercialLayout>
    )
  }

  if (pageState === 'no_user' || pageState === 'no_account') {
    return (
      <CommercialLayout>
        <div className="px-4 pt-3 max-w-xl mx-auto">
          <GlassCard padding="lg" className="text-center mt-8">
            <p style={{ fontSize: 28, marginBottom: 12 }}>🔒</p>
            <p style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 8 }}>
              {pageState === 'no_user' ? 'Sign in required' : 'No commercial account'}
            </p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
              {pageState === 'no_user' ? 'Please sign in to view billing.' : 'Set up your commercial account to view billing.'}
            </p>
          </GlassCard>
        </div>
      </CommercialLayout>
    )
  }

  if (pageState === 'error') {
    return (
      <CommercialLayout>
        <div className="px-4 pt-3 max-w-xl mx-auto">
          <GlassCard padding="lg" className="text-center mt-8">
            <p style={{ fontSize: 28, marginBottom: 12 }}>⚠️</p>
            <p style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Failed to load billing</p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 20 }}>Check your connection and try again.</p>
            <PrimaryButton fullWidth onClick={() => void load()}>Retry</PrimaryButton>
          </GlassCard>
        </div>
      </CommercialLayout>
    )
  }

  // ── Ready ─────────────────────────────────────────────────────────────────

  const acct = account!
  const planDisplay    = acct.plan_name ?? acct.service_plan ?? 'Standard Plan'
  const serviceTier    = acct.service_plan
    ? acct.service_plan.charAt(0).toUpperCase() + acct.service_plan.slice(1)
    : null

  return (
    <CommercialLayout>
      <div className="px-4 pt-3 pb-8 max-w-xl mx-auto w-full">

        {/* ── Header ── */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 22, fontWeight: 900, color: '#fff', lineHeight: 1.1 }}>
            Billing &amp; Plan
          </p>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>
            Subscription, usage, and payment overview
          </p>
        </div>

        {/* ── 1. Current Plan ── */}
        <SectionLabel>Current Plan</SectionLabel>
        <GlassCard variant="elevated" padding="lg" className="mb-5">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.09em' }}>
                Plan
              </p>
              <p style={{ fontSize: 26, fontWeight: 900, color: '#fff', lineHeight: 1.15, marginTop: 3 }}>
                {planDisplay}
              </p>
              {serviceTier && (
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                  {serviceTier} tier · Monthly invoicing
                </p>
              )}
            </div>
            <StatusBadge
              variant={planStatusVariant(acct.account_status)}
              label={planStatusLabel(acct.account_status)}
              dot
            />
          </div>

          <div
            style={{
              display: 'flex', gap: 10, padding: '12px 14px', borderRadius: 10,
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
              marginBottom: 14,
            }}
          >
            <span style={{ fontSize: 18 }}>📋</span>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>Billing model</p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                Monthly invoices generated after each completed service period. Invoices are due within 30 days.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <PrimaryButton
                fullWidth size="sm" variant="secondary"
                onClick={() => showToast('Contact support to upgrade or change your plan.')}
              >
                ⬆ Upgrade Plan
              </PrimaryButton>
            </div>
            <div style={{ flex: 1 }}>
              <PrimaryButton
                fullWidth size="sm" variant="secondary"
                onClick={() => navigate('/dashboard/commercial/support')}
              >
                🎧 Contact Support
              </PrimaryButton>
            </div>
          </div>
        </GlassCard>

        {/* ── 2. Balance Card ── */}
        <SectionLabel>Current Balance</SectionLabel>
        <GlassCard variant="elevated" padding="lg" className="mb-5">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.09em' }}>
                Outstanding
              </p>
              <p style={{
                fontSize: 36, fontWeight: 900, lineHeight: 1.1, marginTop: 4,
                color: pendingBalance > 0 ? '#f87171' : '#4ade80',
              }}>
                {fmt$(pendingBalance)}
              </p>
            </div>
            {unpaidInvoice ? (
              <StatusBadge
                variant={unpaidInvoice.status === 'overdue' ? 'red' : 'amber'}
                label={unpaidInvoice.status === 'overdue' ? 'Overdue' : 'Due Soon'}
                dot
              />
            ) : (
              <StatusBadge variant="green" label="Paid Up" dot />
            )}
          </div>

          {unpaidInvoice && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
              {[
                { label: 'Invoice',  value: unpaidInvoice.invoice_number ?? unpaidInvoice.id.slice(0, 10).toUpperCase() },
                { label: 'Due Date', value: fmtDate(unpaidInvoice.due_date) },
              ].map(r => (
                <div key={r.label}>
                  <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {r.label}
                  </p>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#fff', marginTop: 2 }}>{r.value}</p>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <PrimaryButton
                fullWidth size="md"
                disabled={pendingBalance === 0}
                onClick={() => navigate('/dashboard/commercial/invoices')}
              >
                💳 Pay Now
              </PrimaryButton>
            </div>
            <div style={{ flex: 1 }}>
              <PrimaryButton
                fullWidth size="md" variant="secondary"
                onClick={() => navigate('/dashboard/commercial/invoices')}
              >
                📄 All Invoices
              </PrimaryButton>
            </div>
          </div>
        </GlassCard>

        {/* ── 3. Monthly Usage ── */}
        <SectionLabel>Pickup Usage — This Month</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          <StatPill label="This Month"  value={thisMonth.length} color="#00c8ff" />
          <StatPill label="Completed"   value={completed}        color="#4ade80" />
          <StatPill label="Pending"     value={pending}          color="#fbbf24" />
          <StatPill label="Cancelled"   value={cancelled}        color="#f87171" />
        </div>

        {/* ── 4. Service Reliability ── */}
        <SectionLabel>Service Reliability</SectionLabel>
        <GlassCard padding="md" className="mb-5">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <ReliabilityRing pct={reliabilityPct} />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 6 }}>
                {reliabilityPct >= 90 ? 'Excellent Service' : reliabilityPct >= 70 ? 'Good Service' : 'Needs Attention'}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {[
                  { label: 'Completed pickups', value: allCompleted, color: '#4ade80' },
                  { label: 'Flagged pickups',   value: flagged,      color: '#fbbf24' },
                  { label: 'Total scheduled',   value: allTotal,     color: 'rgba(255,255,255,0.5)' },
                ].map(r => (
                  <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{r.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: r.color }}>{r.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </GlassCard>

        {/* ── 5. Recent Invoices ── */}
        <SectionLabel>Recent Invoices</SectionLabel>
        {recentInvoices.length === 0 ? (
          <GlassCard padding="lg" className="text-center mb-5">
            <p style={{ fontSize: 28, marginBottom: 8 }}>📄</p>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>No invoices yet</p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
              Invoices appear after your first service period.
            </p>
          </GlassCard>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {recentInvoices.map(inv => {
              const b = invoiceBadge(inv.status)
              return (
                <GlassCard key={inv.id} padding="md">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {inv.invoice_number ?? inv.id.slice(0, 12).toUpperCase()}
                      </p>
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                        {inv.billing_period ?? fmtDate(inv.issued_at)} · Due {fmtDate(inv.due_date)}
                      </p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                      <p style={{ fontSize: 16, fontWeight: 900, color: inv.status === 'paid' ? '#4ade80' : '#f87171' }}>
                        {fmt$(inv.amount)}
                      </p>
                      <StatusBadge variant={b.variant} label={b.label} size="sm" />
                    </div>
                  </div>
                </GlassCard>
              )
            })}

            <button
              onClick={() => navigate('/dashboard/commercial/invoices')}
              style={{
                width: '100%', padding: '10px 0', borderRadius: 10,
                background: 'none', border: '1px solid rgba(0,200,255,0.2)',
                color: '#00c8ff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}
            >
              View all invoices →
            </button>
          </div>
        )}

        {/* ── Stripe note ── */}
        <GlassCard padding="md">
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>🔐</span>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: 3 }}>
                Secure Payments via Stripe
              </p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', lineHeight: 1.5 }}>
                Payments are processed securely through Stripe. Your card details are never stored on our servers.
                {!acct.stripe_customer_id && (
                  <span style={{ color: 'rgba(255,165,0,0.8)' }}>
                    {' '}Stripe customer not yet linked — payment will be set up on first invoice.
                  </span>
                )}
              </p>
            </div>
          </div>
        </GlassCard>

      </div>

      {toast && <Toast msg={toast} />}
    </CommercialLayout>
  )
}
