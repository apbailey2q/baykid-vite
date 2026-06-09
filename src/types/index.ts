export type Role =
  | 'consumer'
  | 'commercial'
  | 'driver'
  | 'warehouse_employee'    // a.k.a. "warehouse worker" in user-facing copy
  | 'warehouse_supervisor'
  | 'warehouse_manager'     // Phase WH.1 — facility manager
  | 'warehouse_admin'       // Phase WH.1 — warehouse-level admin (distinct from global admin)
  | 'operations_manager'    // Phase MG.1 — driver/dispatch oversight, escalation handling
  | 'compliance_manager'    // Phase MG.1 — driver/warehouse approvals, audit prep
  | 'community_fundraising_manager' // Phase MG.1 — fundraiser + nonprofit relationships
  | 'municipal_relations_manager'   // Phase MG.1 — city contracts + government partnerships
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
  | 'county_admin'              // MU.1 — county-level government partner
  | 'public_works_director'     // MU.1 — public works department lead
  | 'sustainability_director'   // MU.1 — sustainability/environmental program lead
  | 'procurement_officer'       // MU.1 — procurement/purchasing officer
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

// ── Municipal (MU.1) ─────────────────────────────────────────────────────────

/** All municipal / government partner roles. Includes the 3 legacy roles +
 *  the 4 new MU.1 roles. Used by routePermissions and OnboardingDispatcher. */
export const MUNICIPAL_ROLES: readonly Role[] = [
  'municipal_viewer', 'municipal_manager', 'city_admin',
  'county_admin', 'public_works_director',
  'sustainability_director', 'procurement_officer',
] as const

export function isMunicipalRole(role: string | null | undefined): boolean {
  return !!role && (MUNICIPAL_ROLES as readonly string[]).includes(role)
}

// ── Commercial ───────────────────────────────────────────────────────────────

// DB CHECK on profiles.driver_service_type: ('driver_1099','commercial_only','hybrid_driver')
// (see supabase/migrations/20260701000001_commercial_driver_access_model.sql)
// driver_1099     — 1099 independent contractor, consumer pickups only
// commercial_only — Commercial employee (company vehicles/equipment only)
// hybrid_driver   — Approved for both commercial AND consumer routes
export type DriverServiceType = 'driver_1099' | 'commercial_only' | 'hybrid_driver'

// Admin-set access type for commercial drivers — stored for audit trail
export type DriverAccessType = 'commercial_only' | 'hybrid_driver'

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
  id:                  string
  account_id:          string | null
  driver_id:           string | null
  // Use CommercialPickupStatusG5 for G5-era records; CommercialPickupStatus for legacy
  status:              CommercialPickupStatusG5 | CommercialPickupStatus
  priority_level:      CommercialPickupPriority  // low | normal | high | emergency
  pickup_type:         string
  material_type:       string | null
  estimated_volume:    number | null
  bin_count:           number
  preferred_window:    string | null    // customer-requested time window
  pickup_window:       string | null    // legacy alias for preferred_window
  business_name:       string | null
  pickup_location:     string | null
  building_suite:      string | null
  loading_dock_notes:  string | null
  gate_notes:          string | null
  safety_notes:        string | null
  contact_person:      string | null
  assigned_warehouse:  string | null    // warehouse code (text) for dispatch display
  assigned_warehouse_id: string | null  // warehouse UUID FK
  // G5 fields
  scheduled_at:        string | null
  completed_at:        string | null
  submitted_at:        string | null
  submitted_by:        string | null
  preferred_date:      string | null
  special_instructions: string | null
  container_count:     number
  created_at:          string
  updated_at:          string | null
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

export type CommercialInspectionResultColor = 'green' | 'yellow' | 'red'
export type CommercialInspectionSource = 'driver' | 'warehouse'

export interface CommercialInspection {
  id: string
  pickup_id: string
  driver_id: string | null
  checklist_results: Record<string, SafetyCheckResult>
  overall_result: SafetyCheckResult
  notes: string | null
  created_at: string
  // Phase G.6 — warehouse inspection layer (additive, opt-in)
  result_color?: CommercialInspectionResultColor | null
  contamination_notes?: string | null
  quantity_received?: number | null
  materials_verified?: Record<string, unknown>
  supervisor_required?: boolean
  warehouse_inspector_id?: string | null
  inspection_started_at?: string | null
  inspection_completed_at?: string | null
  inspection_source?: CommercialInspectionSource
}

// ── Commercial Warehouse Processing — Phase G.6 view rows ───────────────────

export interface CommercialIntakeQueueRow {
  load_id:              string
  pickup_id:            string
  source_pickup_id:     string | null
  source:               'route_stop' | 'commercial_request'
  account_id:           string
  business_name:        string
  material_type:        string
  estimated_volume:     string
  bin_count:            number | null
  estimated_weight:     number | null
  actual_weight:        number | null
  intake_result:        CommercialInspectionResultColor | null
  load_status:          string
  warehouse_id:         string | null
  driver_id:            string | null
  expected_arrival:     string | null
  arrived_at:           string | null
  intake_started_at:    string | null
  processed_at:         string | null
  intake_user_id:       string | null
  warehouse_notes:      string | null
  pickup_status:        string
  contact_person:       string | null
  special_instructions: string | null
  priority_level:       'low' | 'normal' | 'high' | 'emergency' | null
  pickup_type:          string | null
  photo_count:          number
  last_event_at:        string | null
  driver_name:          string | null
}

export interface CommercialVolumeSummaryRow {
  account_id:             string
  business_name:          string
  day:                    string
  completed_count:        number
  processed_count:        number
  in_review_count:        number
  flagged_count:          number
  cancelled_count:        number
  green_count:            number
  yellow_count:           number
  red_count:              number
  clean_weight_lbs:       number
  total_weight_lbs:       number
  contamination_rate_pct: number
}

export interface CommercialGyrCountsRow {
  warehouse_id:     string | null
  day:              string
  green_count:      number
  yellow_count:     number
  red_count:        number
  total_loads:      number
  total_weight_lbs: number
}

export interface CommercialDriverCompletionRow {
  driver_id:         string
  driver_name:       string | null
  day:               string
  completed_count:   number
  flagged_count:     number
  cancelled_count:   number
  total_assignments: number
}

export interface CommercialBusinessActivityRow {
  account_id:            string
  user_id:               string | null
  business_name:         string
  total_pickups:         number
  processed_count:       number
  in_review_count:       number
  flagged_count:         number
  total_weight_lbs:      number
  clean_weight_lbs:      number
  co2_saved_tons_approx: number
  diversion_pct:         number
  last_completed_at:     string | null
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
  source_pickup_id: string | null
  source: 'route_stop' | 'commercial_request'
  account_id: string
  business_name: string
  material_type: string
  estimated_volume: string
  expected_arrival: string | null
  // Expanded by 20260516000020 + Phase G.5 — includes the full lifecycle.
  status: 'expected' | 'arrived' | 'intake_started' | 'received' | 'flagged' | 'processed' | 'cancelled' | 'rejected'
  warehouse_notes: string | null
  driver_id: string | null
  warehouse_id: string | null
  bin_count: number | null
  estimated_weight: number | null
  arrived_at: string | null
  created_at: string
}

// ── Commercial Pickup — Phase G.5 audit + photo layer ───────────────────────

export type CommercialPickupPriority = 'low' | 'normal' | 'high' | 'emergency'

export type CommercialPickupStatusG5 =
  | 'draft' | 'submitted'
  | 'requested' | 'assigned' | 'scheduled' | 'in_progress'
  | 'in_review' | 'at_warehouse' | 'flagged' | 'processed'
  | 'completed' | 'cancelled'

export type CommercialPickupEventType =
  | 'created' | 'submitted' | 'scheduled' | 'assigned' | 'unassigned'
  | 'started' | 'arrived' | 'checked_in' | 'completed' | 'cancelled'
  | 'flagged' | 'reassigned' | 'photo_uploaded' | 'priority_changed' | 'note'

export type CommercialPickupPhotoStage =
  | 'request' | 'arrival' | 'load' | 'completion' | 'other'

export type CommercialPickupAssignmentStatus =
  | 'active' | 'reassigned' | 'completed' | 'cancelled'

export interface CommercialPickupAssignment {
  id:              string
  pickup_id:       string
  driver_id:       string | null
  assigned_by:     string | null
  assigned_at:     string
  unassigned_at:   string | null
  status:          CommercialPickupAssignmentStatus
  notes:           string | null
  priority_level:  CommercialPickupPriority
  scheduled_for:   string | null
}

export interface CommercialPickupEvent {
  id:          string
  pickup_id:   string
  event_type:  CommercialPickupEventType
  from_status: string | null
  to_status:   string | null
  actor_id:    string | null
  actor_role:  string | null
  payload:     Record<string, unknown>
  created_at:  string
}

export interface CommercialPickupPhoto {
  id:           string
  pickup_id:    string
  uploaded_by:  string | null
  stage:        CommercialPickupPhotoStage
  storage_path: string
  caption:      string | null
  created_at:   string
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
// driver_1099       ≡ DriverServiceType 'driver_1099'
// commercial_driver ≡ DriverServiceType 'commercial_only' OR 'hybrid_driver'

export type DriverComplianceStatus =
  | 'pending_review'
  | 'documents_submitted'
  | 'approved_for_dispatch'
  | 'rejected'
  | 'more_info_required'

/**
 * Platform-level conduct status — controls access to all driver dispatch
 * surfaces (both commercial and consumer sides). Enforced in ProtectedRoute.
 *   active     — normal operation
 *   warned     — formal written warning on file; dispatch still permitted
 *   suspended  — cannot accept new pickups; can log in and view account
 *   terminated — access to all driver workflows revoked; admin restores only
 */
export type DriverPlatformStatus = 'active' | 'warned' | 'suspended' | 'terminated'

export type DriverDocumentType =
  | 'license_front'
  | 'license_back'
  | 'insurance'      // consumer/1099 only — personal vehicle insurance
  | 'registration'   // consumer/1099 only — personal vehicle registration
  | 'i9'             // commercial employee — Employment Eligibility Verification
  | 'w4'             // commercial employee — Employee's Withholding Certificate

export type DriverDocumentStatus = 'pending_review' | 'approved' | 'rejected'

export type BackgroundCheckStatus = 'pending' | 'clear' | 'flagged' | 'failed'

export type PayoutAccountStatus = 'pending' | 'onboarding' | 'complete' | 'rejected'

export interface DriverProfile {
  driver_id:              string
  driver_type:            'driver_1099' | 'commercial_driver'
  // Admin-set access type — determines routing after approval.
  // commercial_only → /dashboard/commercial-driver
  // hybrid_driver   → /driver-mode-select (both consumer + commercial)
  driver_access_type:     DriverAccessType | null
  status:                 DriverComplianceStatus
  approved_at:            string | null
  approved_by:            string | null
  rejected_at:            string | null
  rejection_reason:       string | null
  // W9 — w9_tin_encrypted is bytea, never exposed to the browser.
  w9_legal_name:          string | null
  w9_address:             string | null
  w9_submitted_at:        string | null
  // Vehicle (consumer/1099 drivers only — commercial drivers use company vehicles)
  vehicle_make:           string | null
  vehicle_model:          string | null
  vehicle_year:           number | null
  vehicle_color:          string | null
  vehicle_plate:          string | null
  // Driver agreement
  agreement_signed_at:    string | null
  agreement_signature:    string | null
  // Compliance document version tracking (see driverComplianceVersions.ts)
  agreement_version:      string | null   // e.g. "consumer_v1.0"
  manual_acknowledged_at: string | null   // when driver read + acknowledged compliance manual
  manual_version:         string | null   // e.g. "consumer_v1.0"
  // Training
  training_completed_at:  string | null
  training_version:       string | null   // e.g. "consumer_v1.0"
  // Platform conduct policy (required for all driver types)
  policy_acknowledged_at: string | null
  // Platform status — governs access to all dispatch surfaces (commercial + consumer)
  platform_status:            DriverPlatformStatus | null
  platform_status_reason:     string | null
  platform_status_updated_at: string | null
  platform_status_updated_by: string | null
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

// ── Management Onboarding System — Phase MG.1 ────────────────────────────────
//
// ManagementType — the tier/level of the management position.
// Distinct from the platform Role (operations_manager, compliance_manager, etc.)
// which controls routing and RBAC. ManagementType is stored in management_profiles
// and describes the seniority level within the organisation.

export type ManagementType =
  | 'executive'
  | 'director'
  | 'manager'
  | 'supervisor'

export type ManagementDepartment =
  | 'operations'
  | 'warehouse'
  | 'compliance'
  | 'hr'
  | 'finance'
  | 'fundraising'
  | 'commercial'
  | 'technology'
  | 'owner'

export type ManagementStatus =
  | 'pending_onboarding'
  | 'active'
  | 'suspended'
  | 'terminated'

export interface ManagementProfile {
  id:                      string
  user_id:                 string
  employee_id?:            string | null
  management_type:         ManagementType
  department:              ManagementDepartment
  status:                  ManagementStatus
  hire_date?:              string | null
  certified:               boolean
  certified_at?:           string | null
  onboarding_completed:    boolean
  onboarding_completed_at?: string | null
  // Phase MG.3 — retraining fields (added by 20260703000003 migration)
  retraining_required:     boolean
  retraining_required_at?: string | null
  retraining_reason?:      string | null
  created_at:              string
  updated_at:              string
}

export interface ManagementPermissions {
  id:                      string
  management_profile_id:   string
  can_view_consumers:      boolean
  can_view_drivers:        boolean
  can_view_commercial:     boolean
  can_view_warehouses:     boolean
  can_view_fundraisers:    boolean
  can_assign_routes:       boolean
  can_dispatch_drivers:    boolean
  can_manage_finances:     boolean
  can_manage_compliance:   boolean
  can_manage_users:        boolean
  can_manage_training:     boolean
  can_view_reports:        boolean
  created_at:              string
  updated_at:              string
}

// Phase MG.3 — Admin action types for management profile audit log

export type ManagementAdminActionType =
  | 'approved'
  | 'suspended'
  | 'terminated'
  | 'certification_revoked'
  | 'certification_restored'
  | 'retraining_required'
  | 'permissions_updated'
  | 'note_added'

export interface ManagementAdminAction {
  id:                    string
  management_profile_id: string
  admin_user_id?:        string | null
  action_type:           ManagementAdminActionType
  reason?:               string | null
  previous_status?:      string | null
  new_status?:           string | null
  metadata:              Record<string, unknown>
  created_at:            string
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase MG.4 — Compliance Notification System
// Reusable across management, driver, warehouse, commercial, fundraiser,
// partner, and consumer owner types.
// ─────────────────────────────────────────────────────────────────────────────

export type OwnerType =
  | 'management'
  | 'driver'
  | 'warehouse'
  | 'commercial'
  | 'fundraiser'
  | 'partner'
  | 'consumer'

export type ComplianceDocumentStatus =
  | 'missing'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'expiring_soon'

export type ComplianceNotificationType =
  | 'document_missing'
  | 'document_expiring'
  | 'document_expired'
  | 'document_rejected'
  | 'countdown_started'
  | 'temporary_deactivation'
  | 'reactivation'
  | 'route_not_completed'
  | 'drivers_needed'
  | 'admin_review_required'

export type ComplianceSeverity =
  | 'info'
  | 'warning'
  | 'urgent'
  | 'critical'

export interface ComplianceDocument {
  id:                                string
  owner_user_id:                     string
  owner_type:                        OwnerType
  owner_profile_id?:                 string | null
  document_type:                     string
  document_title:                    string
  status:                            ComplianceDocumentStatus
  file_url?:                         string | null
  file_name?:                        string | null
  issued_date?:                      string | null
  expiration_date?:                  string | null
  reviewed_by?:                      string | null
  reviewed_at?:                      string | null
  review_notes?:                     string | null
  deactivation_countdown_started_at?: string | null
  temporary_deactivation_at?:        string | null
  reactivated_at?:                   string | null
  created_at:                        string
  updated_at:                        string
}

export interface ComplianceNotification {
  id:                   string
  recipient_user_id:    string
  owner_type:           OwnerType
  owner_profile_id?:    string | null
  notification_type:    ComplianceNotificationType
  severity:             ComplianceSeverity
  title:                string
  message:              string
  related_document_id?: string | null
  is_read:              boolean
  read_at?:             string | null
  action_required:      boolean
  action_url?:          string | null
  created_at:           string
}

export interface ComplianceDeactivationEvent {
  id:                        string
  owner_user_id:             string
  owner_type:                OwnerType
  owner_profile_id?:         string | null
  reason:                    string
  trigger_document_id?:      string | null
  status:                    'active' | 'resolved' | 'cancelled'
  started_at:                string
  temporary_deactivation_at?: string | null
  resolved_at?:              string | null
  created_by?:               string | null
  created_at:                string
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase MG.6 — Operational Notifications
// ─────────────────────────────────────────────────────────────────────────────

export type OperationalNotificationEventType =
  | 'route_not_completed'
  | 'drivers_needed'
  | 'driver_document_issue'
  | 'warehouse_staffing_issue'
  | 'commercial_pickup_issue'
  | 'admin_review_required'
  | 'compliance_escalation'

export type OperationalNotificationStatus =
  | 'open'
  | 'acknowledged'
  | 'resolved'
  | 'dismissed'

export interface OperationalNotificationRule {
  id:              string
  rule_code:       string
  rule_title:      string
  event_type:      OperationalNotificationEventType
  recipient_roles: string[]
  severity:        ComplianceSeverity
  is_active:       boolean
  created_at:      string
  updated_at:      string
}

export interface OperationalNotificationEvent {
  id:                 string
  event_type:         OperationalNotificationEventType
  severity:           ComplianceSeverity
  owner_type?:        OwnerType | null
  owner_profile_id?:  string | null
  recipient_user_id?: string | null
  title:              string
  message:            string
  action_required:    boolean
  action_url?:        string | null
  metadata:           Record<string, unknown>
  status:             OperationalNotificationStatus
  created_by?:        string | null
  acknowledged_at?:   string | null
  resolved_at?:       string | null
  created_at:         string
  updated_at:         string
}

// ─────────────────────────────────────────────────────────────────────────────
// MU.2 — Municipal Contracts & Reporting
// ─────────────────────────────────────────────────────────────────────────────

export type MunicipalContractServiceLevel =
  | 'standard'
  | 'expanded'
  | 'pilot_program'
  | 'grant_funded'
  | 'municipal_wide'
  | 'custom'

export type MunicipalProgramType =
  | 'recycling_collection'
  | 'education_outreach'
  | 'public_works_support'
  | 'waste_reduction'
  | 'grant_reporting'
  | 'custom'

export type MunicipalReportingFrequency =
  | 'monthly'
  | 'quarterly'
  | 'semiannual'
  | 'annual'
  | 'custom'

export type MunicipalContractStatus =
  | 'draft'
  | 'pending_review'
  | 'active'
  | 'expired'
  | 'cancelled'
  | 'needs_review'

export type MunicipalReportType =
  | 'council_report'
  | 'sustainability_report'
  | 'grant_report'
  | 'diversion_report'
  | 'contamination_report'
  | 'public_works_report'
  | 'custom'

export type MunicipalReportingStatus =
  | 'active'
  | 'paused'
  | 'completed'
  | 'cancelled'

// MU.3 — Municipal Contract Signature Status
export type MunicipalContractSignatureStatus =
  | 'not_requested'
  | 'pending_signature'
  | 'signed'
  | 'declined'
  | 'expired'

export interface MunicipalContract {
  id:                              string
  municipal_profile_id:            string
  contract_title:                  string
  agency_name:                     string | null
  agency_type:                     string | null
  service_level:                   MunicipalContractServiceLevel
  program_type:                    MunicipalProgramType
  service_zones:                   string[]
  covered_locations:               string[]
  reporting_frequency:             MunicipalReportingFrequency
  council_reporting_required:      boolean
  grant_reporting_required:        boolean
  public_education_required:       boolean
  contamination_threshold_percent: number | null
  start_date:                      string | null
  end_date:                        string | null
  renewal_date:                    string | null
  status:                          MunicipalContractStatus
  estimated_monthly_volume_lbs:    number | null
  estimated_annual_diversion_lbs:  number | null
  notes:                           string | null
  created_by:                      string | null
  updated_by:                      string | null
  created_at:                      string
  updated_at:                      string
  // MU.3 — Signature lifecycle (added 2026-07-21)
  signature_status:                MunicipalContractSignatureStatus
  signature_requested_at:          string | null
  signature_requested_by:          string | null
  signed_at:                       string | null
  signed_by:                       string | null
}

// MU.3 — Typed signature record. Immutable per RLS (no UPDATE/DELETE for
// non-admins). One row per sign event; latest by signed_at is canonical.
export interface MunicipalContractSignature {
  id:                   string
  contract_id:          string
  municipal_profile_id: string
  signer_user_id:       string | null
  signer_name:          string
  signer_title:         string | null
  signer_email:         string | null
  signature_text:       string
  contract_version:     string
  contract_snapshot:    Record<string, unknown>
  signed_at:            string
  created_at:           string
}

export interface MunicipalContractHistory {
  id:                   string
  contract_id:          string
  municipal_profile_id: string | null
  action_type:          'created' | 'updated' | 'status_changed' | 'renewed' | 'cancelled' | 'expired' | 'note_added'
  previous_status:      string | null
  new_status:           string | null
  change_summary:       string | null
  metadata:             Record<string, unknown>
  changed_by:           string | null
  created_at:           string
}

export interface MunicipalReportingRequirement {
  id:                   string
  municipal_profile_id: string
  contract_id:          string | null
  report_title:         string
  report_type:          MunicipalReportType
  frequency:            MunicipalReportingFrequency
  next_due_date:        string | null
  status:               MunicipalReportingStatus
  required_metrics:     string[]
  notes:                string | null
  created_at:           string
  updated_at:           string
}
