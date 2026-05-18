import { useState, useEffect, useCallback } from 'react'
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

// ── Screen ────────────────────────────────────────────────────────────────────

export default function CommercialInvoices() {
  const { user } = useAuthStore()

  const [pageState,     setPageState]     = useState<PageState>('loading')
  const [invoices,      setInvoices]      = useState<InvoiceRow[]>([])
  const [toast,         setToast]         = useState<string | null>(null)
  const [toastVariant,  setToastVariant]  = useState<ToastVariant>('info')
  const [payingId,      setPayingId]      = useState<string | null>(null)

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

  // Handle Stripe return URLs: ?payment=success | ?payment=cancelled
  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get('payment')
    if (param === 'success') {
      showToast('Payment processing. Your invoice will update shortly.', 'success')
      window.history.replaceState({}, '', window.location.pathname)
      void loadInvoices()
    } else if (param === 'cancelled') {
      showToast('Payment was cancelled. You can try again anytime.', 'warning')
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  // ── Toast ─────────────────────────────────────────────────────────────────

  function showToast(msg: string, variant: ToastVariant = 'info') {
    setToast(msg)
    setToastVariant(variant)
    setTimeout(() => setToast(null), variant === 'success' || variant === 'warning' ? 4000 : 2800)
  }

  // ── Pay ───────────────────────────────────────────────────────────────────

  async function payInvoice(invoiceId: string, currentStatus: InvoiceStatus) {
    if (payingId) return

    // Client-side guard: don't attempt checkout on a paid invoice
    if (currentStatus === 'paid') {
      showToast('This invoice is already paid.', 'info')
      return
    }

    setPayingId(invoiceId)
    try {
      const { data, error } = await supabase.functions.invoke(
        'create-commercial-checkout',
        { body: { invoice_id: invoiceId } },
      )

      // Parse Edge Function errors into user-friendly messages
      if (error) {
        const msg = error.message ?? ''
        if (msg.includes('already paid'))     showToast('This invoice has already been paid.', 'info')
        else if (msg.includes('not found'))   showToast('Invoice not found — refresh and try again.', 'error')
        else if (msg.includes('Forbidden'))   showToast('You do not have permission to pay this invoice.', 'error')
        else if (msg.includes('unavailable')) showToast('Payment provider is temporarily unavailable. Try again shortly.', 'error')
        else                                  showToast('Checkout failed — check your connection and try again.', 'error')
        return
      }

      if (!data?.url) {
        showToast('No checkout URL returned — try again.', 'error')
        return
      }

      // Redirect to Stripe Checkout — setPayingId stays set intentionally
      // (spinner remains while the browser navigates away)
      window.location.href = data.url as string
    } catch {
      showToast('Network error — check your connection and try again.', 'error')
      setPayingId(null)
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const unpaidInvoice = invoices.find(i => i.status !== 'paid') ?? null
  const currentMonth  = (() => {
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
            Billing, payments, and service charges
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
              { label: 'Due Date',     value: unpaidInvoice ? formatDate(unpaidInvoice.due_date) : '—' },
              { label: 'Billing',      value: unpaidInvoice?.billing_period ?? currentInvoice?.billing_period ?? '—' },
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

          <div className="flex gap-2.5">
            <div className="flex-1">
              <PrimaryButton
                fullWidth size="md"
                disabled={!unpaidInvoice || !!payingId}
                onClick={() => unpaidInvoice && payInvoice(unpaidInvoice.id, unpaidInvoice.status)}
              >
                {payingId === unpaidInvoice?.id ? 'Preparing secure checkout...' : '💳 Pay Now'}
              </PrimaryButton>
            </div>
            <div className="flex-1">
              <PrimaryButton fullWidth size="md" variant="secondary" onClick={() => showToast('AutoPay coming soon')}>
                🔄 AutoPay
              </PrimaryButton>
            </div>
          </div>
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
              const badge  = STATUS_BADGE[inv.status]
              const isPaid = inv.status === 'paid'
              const displayId = inv.invoice_number ?? inv.id.slice(0, 12).toUpperCase()
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
                      <PrimaryButton fullWidth size="sm" variant="secondary" onClick={() => showToast(`Viewing ${displayId}…`)}>
                        📋 Details
                      </PrimaryButton>
                    </div>
                    <div className="flex-1">
                      <PrimaryButton fullWidth size="sm" variant="secondary" onClick={() => showToast(`Downloading ${displayId}…`)}>
                        ⬇ Download
                      </PrimaryButton>
                    </div>
                    {!isPaid && (
                      <div className="flex-1">
                        <PrimaryButton
                          fullWidth size="sm"
                          disabled={!!payingId}
                          onClick={() => payInvoice(inv.id, inv.status)}
                        >
                          {payingId === inv.id ? 'Preparing...' : '💳 Pay'}
                        </PrimaryButton>
                      </div>
                    )}
                  </div>
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
