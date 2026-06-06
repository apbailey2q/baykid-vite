// ── Phase G.3 — User Payout Wallet Page ──────────────────────────────────────
import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { GlassCard } from '../../components/ui/GlassCard'
import { Spinner } from '../../components/ui/Spinner'
import { useAuthStore } from '../../store/authStore'
import { getWalletSummary } from '../../lib/payout'
import { supabase } from '../../lib/supabase'
import type { LedgerEntry, LedgerStatus, LedgerSourceType, PayoutAccount, PayoutStatus } from '../../types/payout'

// ── Constants ──────────────────────────────────────────────────────────────────

const BG = '#060e24'

const STATUS_COLOR: Record<LedgerStatus, string> = {
  pending:  '#fbbf24',
  approved: '#00c8ff',
  rejected: '#f87171',
  paid:     '#4ade80',
}

const STATUS_LABEL: Record<LedgerStatus, string> = {
  pending:  'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  paid:     'Paid',
}

const SOURCE_ICON: Record<LedgerSourceType, string> = {
  consumer_pickup:      '🏠',
  commercial_pickup:    '🏢',
  fundraiser_campaign:  '🎗',
  bonus:                '⭐',
  adjustment:           '⚙',
  penalty:              '⚠',
}

const SOURCE_LABEL: Record<LedgerSourceType, string> = {
  consumer_pickup:      'Residential Pickup',
  commercial_pickup:    'Commercial Pickup',
  fundraiser_campaign:  'Fundraiser Campaign',
  bonus:                'Bonus',
  adjustment:           'Adjustment',
  penalty:              'Penalty',
}

const PAYOUT_STATUS_INFO: Record<PayoutStatus, { label: string; color: string; bg: string; border: string; message: string }> = {
  not_started:   {
    label:   'Setup Required',
    color:   '#fbbf24',
    bg:      'rgba(251,191,36,0.08)',
    border:  'rgba(251,191,36,0.25)',
    message: 'Payout setup hasn\'t been started yet. Online setup coming soon — payments are currently processed manually.',
  },
  pending_setup: {
    label:   'Setup In Progress',
    color:   '#00c8ff',
    bg:      'rgba(0,200,255,0.08)',
    border:  'rgba(0,200,255,0.25)',
    message: 'Your payout setup is in progress. A team member will contact you to complete the process.',
  },
  active: {
    label:   'Active',
    color:   '#4ade80',
    bg:      'rgba(74,222,128,0.08)',
    border:  'rgba(74,222,128,0.25)',
    message: 'Your payout account is active. Approved earnings will be sent manually by the CBR team.',
  },
  suspended: {
    label:   'Suspended',
    color:   '#f87171',
    bg:      'rgba(248,113,113,0.08)',
    border:  'rgba(248,113,113,0.25)',
    message: 'Your payout account has been suspended. Please contact support for assistance.',
  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Status Badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: LedgerStatus }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold shrink-0"
      style={{
        background: `${STATUS_COLOR[status]}22`,
        color:      STATUS_COLOR[status],
        border:     `1px solid ${STATUS_COLOR[status]}44`,
      }}
    >
      {STATUS_LABEL[status]}
    </span>
  )
}

// ── Payout Account Banner ─────────────────────────────────────────────────────

function PayoutStatusBanner({ account }: { account: PayoutAccount | null }) {
  const info = account
    ? PAYOUT_STATUS_INFO[account.payout_status]
    : PAYOUT_STATUS_INFO['not_started']

  return (
    <GlassCard padding="md" className="flex items-start gap-3">
      <div
        className="mt-0.5 w-2.5 h-2.5 rounded-full shrink-0"
        style={{ background: info.color, boxShadow: `0 0 6px ${info.color}` }}
      />
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-semibold text-white">Payout Account</span>
          <span
            className="text-xs rounded-full px-2 py-0.5 font-semibold"
            style={{ background: info.bg, color: info.color, border: `1px solid ${info.border}` }}
          >
            {info.label}
          </span>
        </div>
        <p className="text-sm text-gray-300">{info.message}</p>
      </div>
    </GlassCard>
  )
}

// ── Ledger Entry Row ──────────────────────────────────────────────────────────

function EntryRow({ entry }: { entry: LedgerEntry }) {
  return (
    <div
      className="flex items-center gap-3 py-3"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
        style={{ background: 'rgba(255,255,255,0.06)' }}
      >
        {SOURCE_ICON[entry.source_type]}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-white">{SOURCE_LABEL[entry.source_type]}</div>
        {entry.description && (
          <div className="text-xs text-gray-400 truncate">{entry.description}</div>
        )}
        <div className="text-xs text-gray-500 mt-0.5">{fmtDate(entry.earned_at)}</div>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span
          className="text-sm font-bold"
          style={{ color: entry.amount_cents > 0 ? '#4ade80' : '#9ca3af' }}
        >
          {entry.amount_cents > 0 ? fmtCents(entry.amount_cents) : 'TBD'}
        </span>
        <StatusBadge status={entry.ledger_status} />
      </div>
    </div>
  )
}

// ── Balance Card ──────────────────────────────────────────────────────────────

interface BalanceCardProps {
  label:  string
  cents:  number
  color:  string
  sub?:   string
}

function BalanceCard({ label, cents, color, sub }: BalanceCardProps) {
  return (
    <GlassCard padding="md" className="text-center">
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className="text-2xl font-bold" style={{ color }}>{fmtCents(cents)}</div>
      {sub && <div className="text-xs text-gray-500 mt-0.5">{sub}</div>}
    </GlassCard>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function PayoutWalletPage() {
  const navigate  = useNavigate()
  const { user }  = useAuthStore()

  const userId = user?.id ?? ''

  // Wallet summary
  const {
    data:      wallet,
    isLoading: loadingWallet,
    error:     walletError,
  } = useQuery({
    queryKey:  ['wallet-summary', userId],
    queryFn:   () => getWalletSummary(userId),
    enabled:   !!userId,
    staleTime: 30_000,
  })

  // Payout account record
  const {
    data:      payoutAccount,
    isLoading: loadingAccount,
  } = useQuery<PayoutAccount | null>({
    queryKey: ['payout-account', userId],
    queryFn:  async () => {
      if (!userId) return null
      const { data } = await supabase
        .from('payout_accounts')
        .select('*')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle()
      return (data as PayoutAccount | null) ?? null
    },
    enabled:  !!userId,
    staleTime: 60_000,
  })

  const handleBack = useCallback(() => navigate(-1), [navigate])

  const isLoading = loadingWallet || loadingAccount
  const entries   = (wallet?.entries ?? []).slice(0, 20)

  return (
    <div className="min-h-screen pb-24" style={{ background: BG }}>
      {/* Header */}
      <div
        className="sticky top-0 z-20 flex items-center gap-3 px-4 py-4"
        style={{ background: BG, borderBottom: '1px solid rgba(255,255,255,0.07)' }}
      >
        <button
          onClick={handleBack}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-300 hover:text-white shrink-0"
          style={{ background: 'rgba(255,255,255,0.08)' }}
          aria-label="Go back"
        >
          &#8592;
        </button>
        <div>
          <h1 className="text-lg font-bold text-white leading-none">My Wallet</h1>
          <p className="text-xs text-gray-400 mt-0.5">Payout history &amp; earnings</p>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4 max-w-2xl mx-auto">
        {/* Manual payment notice */}
        <GlassCard padding="md" variant="accent">
          <div className="flex items-start gap-3">
            <span className="text-xl shrink-0">💳</span>
            <p className="text-sm text-gray-200 leading-relaxed">
              <strong className="text-white">Payments are currently processed manually</strong> by Cyan's Brooklynn Recycling. Online payout setup is coming soon.
            </p>
          </div>
        </GlassCard>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : walletError ? (
          <GlassCard padding="lg" className="text-center">
            <p className="text-red-400 text-sm">{walletError instanceof Error ? walletError.message : 'Failed to load wallet'}</p>
          </GlassCard>
        ) : (
          <>
            {/* Payout account status */}
            <PayoutStatusBanner account={payoutAccount ?? null} />

            {/* Balance cards */}
            <div className="grid grid-cols-2 gap-3">
              <BalanceCard
                label="Pending Review"
                cents={wallet?.pending_cents ?? 0}
                color="#fbbf24"
                sub="Awaiting approval"
              />
              <BalanceCard
                label="Approved"
                cents={wallet?.approved_cents ?? 0}
                color="#00c8ff"
                sub="Ready for payout"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <BalanceCard
                label="Paid Out"
                cents={wallet?.paid_cents ?? 0}
                color="#4ade80"
                sub="Received"
              />
              <BalanceCard
                label="Lifetime Earned"
                cents={wallet?.lifetime_cents ?? 0}
                color="#c084fc"
                sub="All time"
              />
            </div>

            {/* How payouts work */}
            <GlassCard padding="md">
              <h2 className="text-sm font-semibold text-white mb-2">How Payouts Work</h2>
              <ol className="space-y-2 text-xs text-gray-300 list-decimal list-inside">
                <li>Earn credit after completing a pickup or campaign</li>
                <li>CBR admin reviews and approves the amount</li>
                <li>A team member contacts you to arrange payment</li>
                <li>Payment is sent via check, Zelle, Cash App, or bank transfer</li>
              </ol>
            </GlassCard>

            {/* Recent history */}
            <GlassCard padding="md">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-white">Recent Earnings</h2>
                <span className="text-xs text-gray-500">{entries.length} entries</span>
              </div>

              {entries.length === 0 ? (
                <div className="py-8 text-center text-gray-500 text-sm">
                  No earnings yet. Complete a pickup to get started.
                </div>
              ) : (
                <div>
                  {entries.map(entry => (
                    <EntryRow key={entry.id} entry={entry} />
                  ))}
                </div>
              )}
            </GlassCard>

            {/* Legend */}
            <GlassCard padding="md">
              <h3 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wide">Status Guide</h3>
              <div className="space-y-2">
                {(Object.entries(STATUS_LABEL) as [LedgerStatus, string][]).map(([status, _label]) => (
                  <div key={status} className="flex items-center gap-2">
                    <StatusBadge status={status} />
                    <span className="text-xs text-gray-400">
                      {status === 'pending'  && '— waiting for admin to review and set amount'}
                      {status === 'approved' && '— amount confirmed, payout being arranged'}
                      {status === 'paid'     && '— payment sent'}
                      {status === 'rejected' && '— entry not approved (contact support if unexpected)'}
                    </span>
                  </div>
                ))}
              </div>
            </GlassCard>
          </>
        )}
      </div>
    </div>
  )
}
