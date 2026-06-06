export type Role =
  | 'consumer'
  | 'commercial'
  | 'driver'
  | 'warehouse_employee'
  | 'warehouse_supervisor'
  | 'partner'
  | 'admin'
  | 'fundraiser'
  | 'fundraiser_admin'      // Phase G.3 — fundraiser org owner/manager
  | 'school_partner'        // Phase G.3 — sub-types all route to fundraiser wizard
  | 'nonprofit_partner'
  | 'church_partner'
  | 'sports_team_partner'
  | 'commercial_customer'   // Phase G.4 — all 10 below route to /onboarding/commercial
  | 'business_customer'
  | 'restaurant_partner'
  | 'bar_partner'
  | 'hospital_partner'
  | 'hotel_partner'
  | 'school_business'
  | 'apartment_partner'
  | 'office_partner'
  | 'manufacturing_partner'
  | 'municipal_viewer'
  | 'municipal_manager'
  | 'city_admin'
  | 'executive'
  | 'investor_viewer'
  | 'regional_admin'
  | 'city_manager'

// ── Fundraiser ───────────────────────────────────────────────────────────────

export type FundraiserOrgType =
  | 'school' | 'church' | 'nonprofit' | 'sports_team' | 'youth_program'
  | 'community_group' | 'pta_pto' | 'booster_club' | 'other'

export type FundraiserVerificationStatus = 'pending' | 'verified' | 'flagged'
export type FundraiserPayoutStatus       = 'pending_setup' | 'manual_review' | 'ready_for_payout' | 'paid'
export type FundraiserCampaignStatus     = 'draft' | 'active' | 'paused' | 'completed'

/** Roles that belong to the fundraiser onboarding/dashboard family. Used by
 *  OnboardingDispatcher and route guards to gate fundraiser-specific surfaces. */
export const FUNDRAISER_ROLES: readonly Role[] = [
  'fundraiser', 'fundraiser_admin',
  'school_partner', 'nonprofit_partner', 'church_partner', 'sports_team_partner',
] as const

export function isFundraiserRole(role: string | null | undefined): boolean {
  return !!role && (FUNDRAISER_ROLES as readonly string[]).includes(role)
}

// ── Commercial Customer Onboarding (Phase G.4) ───────────────────────────────

export type CommercialBusinessType =
  | 'bar' | 'restaurant' | 'hospital' | 'hotel' | 'school' | 'office_building'
  | 'apartment_complex' | 'event_venue' | 'retail_store' | 'grocery_store'
  | 'manufacturing_facility' | 'warehouse' | 'church' | 'nonprofit' | 'other'

export type CommercialAccountStatus =
  | 'draft' | 'pending_review' | 'approved' | 'rejected' | 'active' | 'suspended' | 'pending'

export type CommercialVolumeTier = 'small' | 'medium' | 'large' | 'enterprise'

export type CommercialPickupFrequency =
  | 'one_time' | 'weekly' | 'twice_weekly' | 'three_times_weekly' | 'daily' | 'on_demand'

export type CommercialMaterial =
  | 'cardboard' | 'plastic' | 'aluminum' | 'glass' | 'paper' | 'mixed_recycling'
  | 'food_packaging' | 'pallets' | 'e_waste' | 'other'

/** 10 sub-roles that go through the new /onboarding/commercial wizard. The
 *  legacy 'commercial' role keeps its existing /dashboard/commercial/onboarding
 *  flow. */
export const COMMERCIAL_CUSTOMER_ROLES: readonly Role[] = [
  'commercial_customer', 'business_customer',
  'restaurant_partner', 'bar_partner', 'hospital_partner', 'hotel_partner',
  'school_business', 'apartment_partner', 'office_partner', 'manufacturing_partner',
] as const

export function isCommercialCustomerRole(role: string | null | undefined): boolean {
  return !!role && (COMMERCIAL_CUSTOMER_ROLES as readonly string[]).includes(role)
}

// ── Commercial ───────────────────────────────────────────────────────────────

export type DriverServiceType = 'consumer_only' | 'commercial_only' | 'hybrid'

export type CommercialPickupStatus = 'requested' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
export type CommercialBinType = 'qr_bin' | 'qr_dumpster' | 'qr_compactor' | 'qr_pallet'
export type SafetyCheckResult = 'pass' | 'flag' | 'fail'

export interface CommercialAccount {
  id: string
  user_id: string | null
  business_name: string
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  billing_address: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  industry_type: string | null
  notes: string | null
  plan_name: string | null
  service_plan: string | null
  account_status: 'active' | 'suspended' | 'pending'
  created_at: string
}

export interface CommercialBin {
  id: string
  account_id: string
  bin_type: CommercialBinType
  bin_code: string
  material_type: string
  location_label: string
  fill_estimate: number
  last_pickup: string | null
  contamination_status: 'clean' | 'flagged' | 'rejected'
  created_at: string
}

export interface CommercialPickup {
  id: string
  account_id: string
  driver_id: string | null
  status: CommercialPickupStatus
  pickup_type: string
  material_type: string
  estimated_volume: string
  bin_count: number
  preferred_window: string
  business_name: string | null
  pickup_location: string | null
  building_suite: string | null
  loading_dock_notes: string | null
  gate_notes: string | null
  safety_notes: string | null
  contact_person: string
  scheduled_at: string | null
  completed_at: string | null
  created_at: string
}

export interface CommercialInvoice {
  id: string
  account_id: string
  amount: number
  status: 'pending' | 'paid' | 'overdue'
  due_date: string
  issued_at: string
  paid_at: string | null
}

export interface CommercialRouteStop {
  id: string
  pickup_id: string
  driver_id: string | null
  sequence: number
  status: 'pending' | 'arrived' | 'completed' | 'skipped'
  arrived_at: string | null
  completed_at: string | null
  driver_notes: string | null
  created_at: string
}

export interface CommercialInspection {
  id: string
  pickup_id: string
  driver_id: string | null
  checklist_results: Record<string, SafetyCheckResult>
  overall_result: SafetyCheckResult
  notes: string | null
  created_at: string
}

export interface CommercialNotification {
  id: string
  account_id: string
  type: string
  title: string
  body: string
  read: boolean
  created_at: string
}

export interface ExpectedWarehouseLoad {
  id: string
  pickup_id: string
  account_id: string
  business_name: string
  material_type: string
  estimated_volume: string
  expected_arrival: string | null
  status: 'expected' | 'received' | 'rejected'
  warehouse_notes: string | null
  created_at: string
}

export type ApprovalStatus = 'pending' | 'approved' | 'rejected'

export interface Profile {
  id: string
  email: string | null
  full_name: string
  role: Role
  approval_status: ApprovalStatus
  driver_service_type: DriverServiceType | null
  account_type: string | null
  city: string | null
  created_at: string
  // Consumer onboarding — added 2026-05-23. Other roles ignore these.
  onboarding_completed?: boolean
  onboarding_step?: number
  avatar_key?: string | null
  // Unified avatar source — emoji string ('🦊') OR uploaded image URL
  // ('https://…'). Added 2026-05-26. See 20260526 migration.
  avatar_url?: string | null
}

export type BagStatus =
  | 'pending'
  | 'assigned'
  | 'picked_up'
  | 'at_warehouse'
  | 'inspected'
  | 'completed'

export type InspectionStatus = 'green' | 'yellow' | 'red'

export interface Bag {
  id: string
  bag_code: string
  status: BagStatus
  owner_id: string | null
  partner_id: string | null
  // Location fields — written when a consumer claims a bag
  city: string | null
  state: string | null
  pickup_address: string | null
  zip: string | null
  created_at: string
  updated_at: string
}

export interface BagScan {
  id: string
  bag_id: string
  scanned_by: string
  scan_time: string
  location: string | null
}

export interface Inspection {
  id: string
  bag_id: string
  inspector_id: string
  status: InspectionStatus
  notes: string | null
  created_at: string
}

export interface InspectionPhoto {
  id: string
  inspection_id: string
  photo_url: string
  created_at: string
}

// ── Driver ──────────────────────────────────────────────────────────────────

export type RouteStatus = 'pending' | 'active' | 'paused' | 'completed'
export type StopStatus = 'pending' | 'completed' | 'skipped'
export type AlertType =
  | 'medical_emergency'
  | 'hazardous_material'
  | 'safety_threat'
  | 'vehicle_issue'
  | 'contact_support'
export type AlertStatus = 'open' | 'acknowledged' | 'resolved'

export interface DriverStatusRecord {
  id: string
  driver_id: string
  is_online: boolean
  active_route_id: string | null
  last_active_at: string
  updated_at: string
}

export interface Route {
  id: string
  driver_id: string
  name: string | null
  status: RouteStatus
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export interface RouteStop {
  id: string
  route_id: string
  bag_id: string | null
  address: string
  zip_code: string
  stop_order: number
  status: StopStatus
  completed_at: string | null
  notes: string | null
  created_at: string
}

export interface Alert {
  id: string
  driver_id: string
  alert_type: AlertType
  status: AlertStatus
  notes: string | null
  created_at: string
  updated_at: string
}

// ── Warehouse ────────────────────────────────────────────────────────────────

export interface InspectionReview {
  id: string
  inspection_id: string
  reviewer_id: string
  decision: 'approved' | 'overridden'
  override_status: InspectionStatus | null
  notes: string | null
  created_at: string
}

export interface InspectionWithDetails {
  id: string
  bag_id: string
  inspector_id: string
  status: InspectionStatus
  notes: string | null
  created_at: string
  bags: { id: string; bag_code: string; status: string } | null
  inspection_photos: Array<{ id: string; photo_url: string }>
  inspection_reviews: InspectionReview[]
}

export interface WarehouseStats {
  bagsScannedToday: number
  bagsInspectedToday: number
  passedToday: number
  failedToday: number
  pendingReview: number
}

// ── Admin ────────────────────────────────────────────────────────────────────

export interface AdminStats {
  totalUsers: number
  pendingApprovals: number
  totalBags: number
  totalScans: number
  totalInspections: number
  onlineDrivers: number
  openAlerts: number
  bagsByStatus: Record<string, number>
}

export interface UserRecord {
  id: string
  full_name: string
  role: Role
  approval_status: ApprovalStatus
  created_at: string
}

export interface BroadcastAlert {
  id: string
  sender_id: string
  target_role: Role | 'all'
  message: string
  created_at: string
}

// ── Points ───────────────────────────────────────────────────────────────────

export interface UserPoints {
  id: string
  user_id: string
  total_points: number
  updated_at: string
}

export interface PointEvent {
  id: string
  user_id: string
  bag_id: string | null
  points: number
  reason: string
  created_at: string
}

// ── Alert extended ────────────────────────────────────────────────────────────

export interface AlertWithDriver extends Alert {
  driver_name: string | null
}

// ── Partner ──────────────────────────────────────────────────────────────────

export interface PartnerStats {
  totalBags: number
  completedBags: number
  inspectedBags: number
  passedInspections: number
  failedInspections: number
  pendingReview: number
  weeklyActivity: Array<{ date: string; bags: number }>
}

// ── Driver Compliance Pack V1 ────────────────────────────────────────────────
// Schema lives in supabase/migrations/20260605000002_driver_compliance.sql.
// driver_1099 ≡ DriverServiceType 'consumer_only'
// commercial_driver ≡ DriverServiceType 'hybrid' OR 'commercial_only'

export type DriverComplianceStatus =
  | 'pending_review'
  | 'documents_submitted'
  | 'approved_for_dispatch'
  | 'rejected'
  | 'more_info_required'

export type DriverDocumentType =
  | 'license_front'
  | 'license_back'
  | 'insurance'
  | 'registration'

export type DriverDocumentStatus = 'pending_review' | 'approved' | 'rejected'

export type BackgroundCheckStatus = 'pending' | 'clear' | 'flagged' | 'failed'

export type PayoutAccountStatus = 'pending' | 'onboarding' | 'complete' | 'rejected'

export interface DriverProfile {
  driver_id:              string
  driver_type:            'driver_1099' | 'commercial_driver'
  status:                 DriverComplianceStatus
  approved_at:            string | null
  approved_by:            string | null
  rejected_at:            string | null
  rejection_reason:       string | null
  // W9 — w9_tin_encrypted is bytea, never exposed to the browser.
  w9_legal_name:          string | null
  w9_address:             string | null
  w9_submitted_at:        string | null
  // Vehicle
  vehicle_make:           string | null
  vehicle_model:          string | null
  vehicle_year:           number | null
  vehicle_color:          string | null
  vehicle_plate:          string | null
  // Driver agreement
  agreement_signed_at:    string | null
  agreement_signature:    string | null
  // Training
  training_completed_at:  string | null
  created_at:             string
  updated_at:             string
}

export interface DriverDocument {
  id:            string
  driver_id:     string
  document_type: DriverDocumentType
  file_path:     string
  status:        DriverDocumentStatus
  uploaded_at:   string
  reviewed_at:   string | null
  reviewed_by:   string | null
  expires_at:    string | null
  notes:         string | null
}

export interface DriverBackgroundCheck {
  id:                 string
  driver_id:          string
  consent_timestamp:  string
  consent_ip:         string | null
  status:             BackgroundCheckStatus
  provider:           string
  provider_reference: string | null
  requested_at:       string
  completed_at:       string | null
}

export interface DriverPayoutAccount {
  id:                string
  driver_id:         string
  stripe_account_id: string | null
  status:            PayoutAccountStatus
  onboarding_url:    string | null
  created_at:        string
  updated_at:        string
}
