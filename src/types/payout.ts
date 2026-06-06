// ── Phase G.3 — Internal Wallet & Payout Ledger Types ────────────────────────

export type PayoutAccountType   = 'driver_1099' | 'commercial_driver' | 'fundraiser' | 'contractor'
export type PayoutStatus        = 'not_started' | 'pending_setup' | 'active' | 'suspended'
export type LedgerStatus        = 'pending' | 'approved' | 'rejected' | 'paid'
export type LedgerSourceType    = 'consumer_pickup' | 'commercial_pickup' | 'fundraiser_campaign' | 'bonus' | 'adjustment' | 'penalty'
export type ManualPaymentMethod = 'check' | 'cash' | 'zelle' | 'cash_app' | 'bank_transfer' | 'other'
export type BatchStatus         = 'draft' | 'approved' | 'paid' | 'canceled'

export interface PayoutAccount {
  id:            string
  user_id:       string
  account_type:  PayoutAccountType
  display_name:  string | null
  payout_status: PayoutStatus
  created_at:    string
  updated_at:    string
}

export interface LedgerEntry {
  id:                      string
  user_id:                 string
  account_id:              string | null
  source_type:             LedgerSourceType
  source_id:               string | null
  amount_cents:            number
  description:             string | null
  ledger_status:           LedgerStatus
  earned_at:               string
  approved_at:             string | null
  approved_by:             string | null
  paid_at:                 string | null
  paid_by:                 string | null
  manual_payment_method:   ManualPaymentMethod | null
  manual_reference_number: string | null
  notes:                   string | null   // only visible to admins
  created_at:              string
  updated_at:              string
  // joined fields
  payee_name?:             string
  payee_email?:            string
}

export interface PayoutBatch {
  id:                 string
  batch_name:         string
  status:             BatchStatus
  total_amount_cents: number
  payout_count:       number
  created_by:         string
  approved_by:        string | null
  paid_by:            string | null
  created_at:         string
  approved_at:        string | null
  paid_at:            string | null
}

export interface PayoutBatchItem {
  id:           string
  batch_id:     string
  ledger_id:    string
  user_id:      string
  amount_cents: number
  created_at:   string
}

export interface WalletSummary {
  pending_cents:  number
  approved_cents: number
  paid_cents:     number
  lifetime_cents: number
  entries:        LedgerEntry[]
}
