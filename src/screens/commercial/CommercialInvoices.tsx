// PAYMENT PROCESSORS DISABLED BY FOUNDER DIRECTIVE.
// Do not enable Stripe, ACH, or third-party processors unless explicitly authorized.
// The platform records payments after the fact only. Invoice status is updated
// manually by admin/billing staff via the Admin Commercial dashboard.
// See: CLAUDE.md → "OFFICIAL PAYOUT SYSTEM DIRECTIVE"

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { CommercialLayout } from './CommercialLayout'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { GlassCard } from '../../components/ui/GlassCard'
import { PrimaryButton } from '../../components/ui/PrimaryButton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { Spinner } from '../../components/ui/Spinner'

// ── Types ─────────────────────────────────────────────────────────────────────

type InvoiceStatus = 'pending' | 'paid' | 'overdue'

interface InvoiceRow {
  id: string
  invoice_number: string | null
  billing_period: string | null
  billing_month: string | null
  amount: number
  status: InvoiceStatus
  due_date: string
  issued_at: string
  base_service: number | null
  pickup_fee: number | null
  overflow_fee: number | null
  container_fee: number | null
  report_fee: number | null
}

type PageState    = 'loading' | 'no_user' | 'no_account' | 'ready' | 'error'
type ToastVariant = 'info' | 'success' | 'warning' | 'error'

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<InvoiceStatus, { variant: 'amber' | 'green' | 'red'; label: string }> = {
  pending: { variant: 'amber', label: 'Due Soon' },
  overdue: { variant: 'red',   label: 'Overdue'  },
  paid:    { variant: 'green', label: 'Paid'      },
}

// Fallback line items for invoices without breakdown columns (legacy or demo rows)
const FALLBACK_CHARGES = [
  { label: 'Base Recurring Service',  amount: 1200 },
  { label: 'Pickup Processing Fee',   amount:   80 },
  { label: 'Container Maintenance',   amount:   10 },
  { label: 'Recycling Report Package',amount:  140 },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function formatAmount(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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

// ── Manual payment info banner ────────────────────────────────────────────────
// Shown in place of Stripe checkout. Guides the customer to contact billing.
function PaymentInfoBanner({ invoiceId, amount }: { invoiceId: string; amount: number }) {
  return (
    <div style={{
      padding: '14px 16px', borderRadius: 16, marginTop: 12,
      background: 'rgba(251,191,36,0.08)',
      border: '1px solid rgba(251,191,36,0.25)',
    }}>
      <p style={{ fontSize: 12, fontWeight: 700, color: '#fbbf24', marginBottom: 6 }}>
        💳 How to Pay This Invoice
      </p>
      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.55, marginBottom: 8 }}>
        Payments are processed by our billing team. Contact your account manager or
        reach out via Support to arrange payment for{' '}
        <span style={{ color: '#fff', fontWeight: 600 }}>{formatAmount(amount)}</span>.
      </p>
      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>
        Invoice ref: {invoiceId.slice(0, 12).toUpperCase()}
      </p>
    </div>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function CommercialInvoices() {
  const { user } = useAuthStore()
  const navigate = useNavigate()

  const [pageState,    setPageState]    = useState<PageState>('loading')
  const [invoices,     setInvoices]     = useState<InvoiceRow[]>([])
  const [toast,        setToast]        = useState<string | null>(null)
  const [toastVariant, setToastVariant] = useState<ToastVariant>('info')
  // Tracks which unpaid invoice's payment info panel is expanded
  const [expandedId,   setExpandedId]   = useState<string | null>(null)

  // ── Load ─────────────────────────────────────────────────────────────────

  const loadInvoices = useCallback(async () => {
    if (!user) { setPageState('no_user'); return }
    setPageState('loading')

    const { data: account } = await supabase
      .from('commercial_accounts')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!account) { setPageState('no_account'); return }

    const { data, error } = await supabase
      .from('commercial_invoices')
      .select('id, invoice_number, billing_period, billing_month, amount, status, due_date, issued_at, base_service, pickup_fee, overflow_fee, container_fee, report_fee')
      .eq('account_id', account.id)
      .order('issued_at', { ascending: false })

    if (error) { setPageState('error'); return }

    setInvoices((data ?? []) as InvoiceRow[])
    setPageState('ready')
  }, [user])

  useEffect(() => { loadInvoices() }, [loadInvoices])

  // Clean up any leftover ?payment= query params from old Stripe redirects
  // without showing Stripe-specific messages (processor is now disabled).
  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get('payment')
    if (param) {
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  // ── Toast ─────────────────────────────────────────────────────────────────

  function showToast(msg: string, variant: ToastVariant = 'info') {
    setToast(msg)
    setToastVariant(variant)
    setTimeout(() => setToast(null), variant === 'success' || variant === 'warning' ? 4000 : 2800)
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const unpaidInvoice  = invoices.find(i => i.status !== 'paid') ?? null
  const currentMonth   = (() => {
    const n = new Date()
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
  })()
  const currentInvoice = invoices.find(i => i.billing_month === currentMonth) ?? unpaidInvoice

  function lineItems(inv: InvoiceRow): { label: string; amount: number }[] {
    if (inv.base_service != null) {
      const items = [{ label: 'Base Recurring Service', amount: inv.base_service }]
      if ((inv.pickup_fee ?? 0) > 0)    items.push({ label: 'Pickup Processing Fee',    amount: inv.pickup_fee!   })
      if ((inv.overflow_fee ?? 0) > 0)  items.push({ label: 'Overflow Pickup Charge',   amount: inv.overflow_fee! })
      if ((inv.container_fee ?? 0) > 0) items.push({ label: 'Container Maintenance',    amount: inv.container_fee! })
      if ((inv.report_fee ?? 0) > 0)    items.push({ label: 'Recycling Report Package', amount: inv.report_fee!   })
      return items
    }
    return FALLBACK_CHARGES
  }

  // ── Loading / error states rendered inside CommercialLayout ───────────────

  if (pageState === 'loading') {
    return (
      <CommercialLayout>
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Spinner size="lg" />
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Loading invoices…</p>
        </div>
      </CommercialLayout>
    )
  }

  if (pageState === 'no_user' || pageState === 'no_account') {
    return (
      <CommercialLayout>
        <div className="px-4 pt-3 max-w-xl mx-auto w-full">
          <GlassCard padding="lg" className="text-center mt-8">
            <p style={{ fontSize: 28, marginBottom: 12 }}>🔒</p>
            <p style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 8 }}>
              {pageState === 'no_user' ? 'Sign in required' : 'No commercial account found'}
            </p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
              {pageState === 'no_user' ? 'Please sign in to view invoices.' : 'Set up your commercial account to view billing.'}
            </p>
          </GlassCard>
        </div>
      </CommercialLayout>
    )
  }

  if (pageState === 'error') {
    return (
      <CommercialLayout>
        <div className="px-4 pt-3 max-w-xl mx-auto w-full">
          <GlassCard padding="lg" className="text-center mt-8">
            <p style={{ fontSize: 28, marginBottom: 12 }}>⚠️</p>
            <p style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Failed to load invoices</p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 20 }}>Check your connection and try again.</p>
            <PrimaryButton fullWidth onClick={loadInvoices}>Retry</PrimaryButton>
          </GlassCard>
        </div>
      </CommercialLayout>
    )
  }

  // ── Ready ─────────────────────────────────────────────────────────────────

  const hasBalance   = unpaidInvoice != null
  const balanceAmt   = unpaidInvoice?.amount ?? 0
  const balanceColor = hasBalance ? '#f87171' : '#4ade80'

  return (
    <CommercialLayout>
      <div className="px-4 pt-3 max-w-xl mx-auto w-full">

        {/* ── 1. Header ── */}
        <div className="mb-5">
          <p style={{ fontSize: 22, fontWeight: 900, color: '#fff', lineHeight: 1.2 }}>
            Commercial Invoices
          </p>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 3 }}>
            Billing history and service charges
          </p>
        </div>

        {/* ── 2. Balance summary card ── */}
        <GlassCard variant="elevated" padding="lg" className="mb-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.09em' }}>
                Current Balance
              </p>
              <p style={{ fontSize: 36, fontWeight: 900, color: balanceColor, lineHeight: 1.1, marginTop: 4 }}>
                {formatAmount(balanceAmt)}
              </p>
            </div>
            {unpaidInvoice ? (
              <StatusBadge variant={STATUS_BADGE[unpaidInvoice.status].variant} label={STATUS_BADGE[unpaidInvoice.status].label} dot />
            ) : (
              <StatusBadge variant="green" label="Paid Up" dot />
            )}
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 mb-4">
            {[
              { label: 'Due Date', value: unpaidInvoice ? formatDate(unpaidInvoice.due_date) : '—' },
              { label: 'Billing',  value: unpaidInvoice?.billing_period ?? currentInvoice?.billing_period ?? '—' },
            ].map(row => (
              <div key={row.label}>
                <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {row.label}
                </p>
                <p style={{ fontSize: 12, color: '#fff', fontWeight: 600, marginTop: 2 }}>
                  {row.value}
                </p>
              </div>
            ))}
          </div>

          {/* Payment action area — manual flow only */}
          {hasBalance ? (
            <div>
              <div className="flex gap-2.5">
                <div className="flex-1">
                  <PrimaryButton
                    fullWidth size="md"
                    onClick={() => setExpandedId(expandedId === unpaidInvoice!.id ? null : unpaidInvoice!.id)}
                  >
                    {expandedId === unpaidInvoice?.id ? '✕ Close Payment Info' : '💳 How to Pay'}
                  </PrimaryButton>
                </div>
                <div className="flex-1">
                  <PrimaryButton
                    fullWidth size="md" variant="secondary"
                    onClick={() => navigate('/dashboard/commercial/support')}
                  >
                    📞 Contact Support
                  </PrimaryButton>
                </div>
              </div>
              {expandedId === unpaidInvoice?.id && (
                <PaymentInfoBanner invoiceId={unpaidInvoice!.id} amount={unpaidInvoice!.amount} />
              )}
            </div>
          ) : (
            <div style={{
              padding: '12px 14px', borderRadius: 14, textAlign: 'center',
              background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)',
            }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#4ade80' }}>✓ All invoices paid</p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 3 }}>
                No outstanding balance.
              </p>
            </div>
          )}
        </GlassCard>

        {/* ── 3. Invoice history ── */}
        <SectionLabel>Invoice History</SectionLabel>

        {invoices.length === 0 ? (
          <GlassCard padding="lg" className="text-center mb-5">
            <p style={{ fontSize: 28, marginBottom: 10 }}>📄</p>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>
              No invoices yet
            </p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
              Invoices are generated after your pickups are processed.
            </p>
          </GlassCard>
        ) : (
          <div className="flex flex-col gap-3 mb-5">
            {invoices.map(inv => {
              const badge     = STATUS_BADGE[inv.status]
              const isPaid    = inv.status === 'paid'
              const displayId = inv.invoice_number ?? inv.id.slice(0, 12).toUpperCase()
              const isExpanded = expandedId === inv.id

              return (
                <GlassCard key={inv.id} padding="md">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0 mr-2">
                      <p style={{ fontSize: 13, fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {displayId}
                      </p>
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                        {inv.billing_period ?? formatDate(inv.issued_at)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <p style={{ fontSize: 18, fontWeight: 900, color: isPaid ? '#4ade80' : '#f87171' }}>
                        {formatAmount(inv.amount)}
                      </p>
                      <StatusBadge variant={badge.variant} label={badge.label} size="sm" />
                    </div>
                  </div>

                  <p style={{
                    fontSize: 11, fontWeight: 600, marginBottom: 10,
                    color: isPaid ? 'rgba(255,255,255,0.3)' : '#fbbf24',
                  }}>
                    {isPaid ? `✓ Paid by ${formatDate(inv.due_date)}` : `⚠ Due ${formatDate(inv.due_date)}`}
                  </p>

                  <div className="flex gap-2">
                    <div className="flex-1">
                      <PrimaryButton fullWidth size="sm" variant="secondary"
                        onClick={() => showToast(`Viewing ${displayId}…`)}>
                        📋 Details
                      </PrimaryButton>
                    </div>
                    <div className="flex-1">
                      <PrimaryButton fullWidth size="sm" variant="secondary"
                        onClick={() => showToast(`Downloading ${displayId}…`)}>
                        ⬇ Download
                      </PrimaryButton>
                    </div>
                    {!isPaid && (
                      <div className="flex-1">
                        <PrimaryButton
                          fullWidth size="sm" variant="secondary"
                          onClick={() => setExpandedId(isExpanded ? null : inv.id)}
                        >
                          {isExpanded ? '✕ Close' : '💳 Pay Info'}
                        </PrimaryButton>
                      </div>
                    )}
                  </div>

                  {/* Expandable payment info panel — no Stripe, manual instructions only */}
                  {isExpanded && !isPaid && (
                    <PaymentInfoBanner invoiceId={inv.id} amount={inv.amount} />
                  )}
                </GlassCard>
              )
            })}
          </div>
        )}

        {/* ── 4. Service charges breakdown for current invoice ── */}
        {currentInvoice && (
          <>
            <SectionLabel>{`Service Charges — ${currentInvoice.billing_period ?? 'Current Period'}`}</SectionLabel>
            <GlassCard padding="md" className="mb-2">
              <div className="flex flex-col gap-3 mb-3">
                {lineItems(currentInvoice).map(c => (
                  <div key={c.label} className="flex items-center justify-between">
                    <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: 500, flex: 1, marginRight: 8 }}>
                      {c.label}
                    </p>
                    <p style={{ fontSize: 13, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                      {formatAmount(c.amount)}
                    </p>
                  </div>
                ))}
              </div>

              <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', marginBottom: 12 }} />
              <div className="flex items-center justify-between">
                <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  Total Due
                </p>
                <p style={{ fontSize: 20, fontWeight: 900, color: currentInvoice.status === 'paid' ? '#4ade80' : '#f87171' }}>
                  {formatAmount(currentInvoice.amount)}
                </p>
              </div>
            </GlassCard>
          </>
        )}

        {/* ── 5. Payment process info footer ── */}
        <div style={{
          margin: '12px 0 8px', padding: '14px 16px', borderRadius: 16,
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
        }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
            ℹ How Billing Works
          </p>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', lineHeight: 1.6 }}>
            Invoices are issued after each service period. Payments are arranged directly with your account manager and recorded manually by our billing team. Once payment is received, your invoice status will update to Paid.
          </p>
          <button
            onClick={() => navigate('/dashboard/commercial/support')}
            style={{
              marginTop: 10, fontSize: 11, fontWeight: 700, color: '#00c8ff',
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            }}
          >
            Contact billing support →
          </button>
        </div>

        <div style={{ height: 8 }} />
      </div>

      {/* ── Toast ── */}
      {toast && (() => {
        const TOAST_STYLE: Record<ToastVariant, { bg: string; border: string; color: string }> = {
          info:    { bg: 'rgba(0,200,255,0.15)',   border: 'rgba(0,200,255,0.3)',   color: '#00c8ff' },
          success: { bg: 'rgba(74,222,128,0.15)',  border: 'rgba(74,222,128,0.35)', color: '#4ade80' },
          warning: { bg: 'rgba(251,191,36,0.15)',  border: 'rgba(251,191,36,0.35)', color: '#fbbf24' },
          error:   { bg: 'rgba(248,113,113,0.15)', border: 'rgba(248,113,113,0.35)',color: '#f87171' },
        }
        const s = TOAST_STYLE[toastVariant]
        return (
          <div
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-sm font-semibold"
            style={{
              background: s.bg, border: `1px solid ${s.border}`, color: s.color,
              backdropFilter: 'blur(12px)', whiteSpace: 'normal', textAlign: 'center',
              maxWidth: 'calc(100vw - 32px)', boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
            }}
          >
            {toast}
          </div>
        )
      })()}
    </CommercialLayout>
  )
}
