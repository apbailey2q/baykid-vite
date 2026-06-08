// types/compliance.ts — Domain types for the compliance system.
//
// Tables (see migration 20260705000001_compliance_documents.sql):
//   compliance_documents
//   document_review_events
//   compliance_notifications
//   account_compliance_status
//   route_completion_alerts
//   driver_need_alerts

import type { Role } from './index'

// ── Document types ──────────────────────────────────────────────────────────

export type ComplianceDocumentType =
  | 'driver_license'
  | 'vehicle_insurance'
  | 'commercial_vehicle_insurance'
  | 'business_insurance'
  | 'background_check_acknowledgment'
  | 'independent_contractor_agreement'
  | 'commercial_driver_agreement'
  | 'consumer_driver_agreement'
  | 'warehouse_safety_agreement'
  | 'management_agreement'
  | 'w9_tax_form'
  | 'training_certificate'
  | 'hazmat_acknowledgment'
  | 'vehicle_inspection'
  | 'admin_custom'

export type DocumentStatus =
  | 'missing'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'update_requested'

export type DocumentReviewAction =
  | 'approved'
  | 'rejected'
  | 'update_requested'
  | 'expiration_set'
  | 'note_added'
  | 'countdown_started'
  | 'countdown_paused'
  | 'countdown_reset'
  | 'marked_required'
  | 'marked_optional'
  | 'temporarily_deactivated'
  | 'reinstated'
  | 'custom_request'

// Human-readable labels — used everywhere a label is rendered. Keeping it
// here so any new caller can import the same list.
export const DOCUMENT_TYPE_LABELS: Record<ComplianceDocumentType, string> = {
  driver_license:                   'Driver License',
  vehicle_insurance:                'Vehicle Insurance',
  commercial_vehicle_insurance:     'Commercial Vehicle Insurance',
  business_insurance:               'Business Insurance',
  background_check_acknowledgment:  'Background Check Acknowledgment',
  independent_contractor_agreement: 'Independent Contractor Agreement',
  commercial_driver_agreement:      'Commercial Driver Agreement',
  consumer_driver_agreement:        'Consumer Driver Agreement',
  warehouse_safety_agreement:       'Warehouse Safety Agreement',
  management_agreement:             'Management Agreement',
  w9_tax_form:                      'W-9 Tax Form',
  training_certificate:             'Training Certificate',
  hazmat_acknowledgment:            'Hazardous Material Acknowledgment',
  vehicle_inspection:               'Vehicle Inspection',
  admin_custom:                     'Admin-Requested Document',
}

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  missing:          'Missing',
  pending_review:   'Pending Review',
  approved:         'Approved',
  rejected:         'Rejected',
  expired:          'Expired',
  update_requested: 'Update Requested',
}

// ── Account compliance status ───────────────────────────────────────────────

export type AccountComplianceStatus =
  | 'compliant'
  | 'warning'
  | 'countdown_active'
  | 'temporarily_deactivated'
  | 'reinstated'

export const ACCOUNT_COMPLIANCE_LABELS: Record<AccountComplianceStatus, string> = {
  compliant:                'Compliant',
  warning:                  'Warning',
  countdown_active:         'Countdown Active',
  temporarily_deactivated:  'Temporarily Deactivated',
  reinstated:               'Reinstated',
}

// ── Notification types ──────────────────────────────────────────────────────

export type ComplianceNotificationType =
  | 'document_expiring'
  | 'document_expired'
  | 'document_missing'
  | 'document_rejected'
  | 'document_update_requested'
  | 'countdown_started'
  | 'temporary_deactivation_warning'
  | 'account_temporarily_deactivated'
  | 'account_reinstated'
  | 'route_incomplete'
  | 'driver_needed'
  | 'emergency_pickup_driver_needed'

export type NotificationSeverity = 'info' | 'warning' | 'urgent' | 'critical'

// ── Route + driver-need alerts ──────────────────────────────────────────────

export type RouteAlertReason =
  | 'accepted_not_completed'
  | 'pickup_window_passed'
  | 'missed_completion_scan'
  | 'commercial_route_still_open'
  | 'consumer_pickup_not_marked_complete'

export type RouteAlertStatus = 'open' | 'in_progress' | 'resolved' | 'dismissed' | 'escalated'

export type DriverNeedStatus = 'open' | 'resolved' | 'dismissed'

// ── Row shapes ──────────────────────────────────────────────────────────────

export interface ComplianceDocument {
  id:                        string
  user_id:                   string
  role_type:                 string
  document_type:             ComplianceDocumentType
  status:                    DocumentStatus
  file_url:                  string | null
  expiration_date:           string | null      // YYYY-MM-DD
  uploaded_at:               string | null
  reviewed_at:               string | null
  reviewed_by:               string | null
  rejection_reason:          string | null
  admin_notes:               string | null
  countdown_started_at:      string | null
  temporary_deactivation_at: string | null
  is_required:               boolean
  created_at:                string
  updated_at:                string
}

export interface DocumentReviewEvent {
  id:          string
  document_id: string
  actor_id:    string
  action:      DocumentReviewAction
  notes:       string | null
  metadata:    Record<string, unknown>
  created_at:  string
}

export interface ComplianceNotification {
  id:                  string
  user_id:             string | null
  role_type:           string | null
  notification_type:   ComplianceNotificationType
  severity:            NotificationSeverity
  title:               string
  message:             string
  related_entity_type: string | null
  related_entity_id:   string | null
  action_url:          string | null
  is_read:             boolean
  expires_at:          string | null
  created_at:          string
}

export interface AccountComplianceStatusRow {
  user_id:                   string
  status:                    AccountComplianceStatus
  countdown_started_at:      string | null
  countdown_due_at:          string | null
  temporary_deactivation_at: string | null
  reinstated_at:             string | null
  reinstated_by:             string | null
  reason:                    string | null
  reason_details:            string | null
  latest_event_at:           string
  created_at:                string
  updated_at:                string
}

export interface RouteCompletionAlert {
  id:               string
  driver_id:        string | null
  route_id:         string | null
  route_label:      string | null
  pickup_type:      'consumer' | 'commercial' | null
  warehouse_id:     string | null
  alert_reason:     RouteAlertReason
  status:           RouteAlertStatus
  resolution_notes: string | null
  resolved_by:      string | null
  resolved_at:      string | null
  detected_at:      string
  created_at:       string
  updated_at:       string
}

export interface DriverNeedAlert {
  id:                      string
  market:                  string
  warehouse_id:            string | null
  open_request_count:      number
  available_drivers:       number
  assigned_drivers:        number
  emergency_pickup_count:  number
  recommended_action:      string | null
  severity:                NotificationSeverity
  status:                  DriverNeedStatus
  resolved_by:             string | null
  resolved_at:             string | null
  detected_at:             string
  created_at:              string
  updated_at:              string
}

// ── Role → required document mapping ────────────────────────────────────────
// Used by complianceDocuments.ensureRequiredRows() to seed missing rows when
// a user first lands on the Document Center.

export const REQUIRED_DOCUMENTS_BY_ROLE: Partial<Record<Role, ComplianceDocumentType[]>> = {
  driver: [
    'driver_license',
    'vehicle_insurance',
    'vehicle_inspection',
    'background_check_acknowledgment',
    'consumer_driver_agreement',
    'w9_tax_form',
    'training_certificate',
  ],
  warehouse_employee: [
    'background_check_acknowledgment',
    'warehouse_safety_agreement',
    'training_certificate',
    'hazmat_acknowledgment',
  ],
  warehouse_supervisor: [
    'background_check_acknowledgment',
    'warehouse_safety_agreement',
    'training_certificate',
    'hazmat_acknowledgment',
  ],
  warehouse_manager: [
    'background_check_acknowledgment',
    'warehouse_safety_agreement',
    'management_agreement',
    'training_certificate',
  ],
  warehouse_admin: [
    'background_check_acknowledgment',
    'warehouse_safety_agreement',
    'management_agreement',
    'training_certificate',
  ],
  operations_manager:             ['background_check_acknowledgment', 'management_agreement', 'training_certificate'],
  compliance_manager:             ['background_check_acknowledgment', 'management_agreement', 'training_certificate'],
  community_fundraising_manager:  ['background_check_acknowledgment', 'management_agreement', 'training_certificate'],
  municipal_relations_manager:    ['background_check_acknowledgment', 'management_agreement', 'training_certificate'],
  executive:                      ['background_check_acknowledgment', 'management_agreement'],
}

// Optional documents the user can upload even if not required for their role.
export const OPTIONAL_DOCUMENTS_BY_ROLE: Partial<Record<Role, ComplianceDocumentType[]>> = {
  driver:               ['commercial_vehicle_insurance', 'commercial_driver_agreement', 'independent_contractor_agreement', 'hazmat_acknowledgment'],
  commercial:           ['business_insurance', 'w9_tax_form'],
  commercial_customer:  ['business_insurance', 'w9_tax_form'],
}

// ════════════════════════════════════════════════════════════════════════════
// Sprint C — Moderation + Audit + Permission Disclosure
// ════════════════════════════════════════════════════════════════════════════

// ── Content reports ────────────────────────────────────────────────────────

export type ReportReason =
  | 'spam'
  | 'harassment'
  | 'hate_speech'
  | 'dangerous_content'
  | 'scam_fraud'
  | 'illegal_activity'
  | 'impersonation'
  | 'other'

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  spam:             'Spam',
  harassment:       'Harassment',
  hate_speech:      'Hate Speech',
  dangerous_content:'Dangerous Content',
  scam_fraud:       'Scam or Fraud',
  illegal_activity: 'Illegal Activity',
  impersonation:    'Impersonation',
  other:            'Other',
}

export type ReportStatus =
  | 'pending'
  | 'reviewing'
  | 'resolved'
  | 'dismissed'
  | 'removed'
  | 'escalated'

export interface ContentReport {
  id:                  string
  reporter_id:         string | null
  reported_user_id:    string | null
  reported_content_id: string | null
  content_type:        string
  reason:              ReportReason
  details:             string | null
  status:              ReportStatus
  reviewed_by:         string | null
  reviewed_at:         string | null
  admin_notes:         string | null
  created_at:          string
  updated_at:          string
}

// ── Blocked users ──────────────────────────────────────────────────────────

export interface BlockedUser {
  id:         string
  blocker_id: string
  blocked_id: string
  reason:     string | null
  created_at: string
}

// ── Compliance audit log ───────────────────────────────────────────────────

export type ComplianceAuditAction =
  | 'CONTENT_REPORT_CREATED'
  | 'CONTENT_REPORT_REVIEWED'
  | 'CONTENT_REMOVED'
  | 'USER_BLOCKED'
  | 'USER_UNBLOCKED'
  | 'ACCOUNT_DELETION_APPROVED'
  | 'ACCOUNT_DELETION_COMPLETED'
  | 'DOCUMENT_EXPIRING'
  | 'ACCOUNT_TEMP_DEACTIVATION_WARNING'
  | 'ROUTE_INCOMPLETE_ALERT'
  | 'DRIVER_SHORTAGE_ALERT'
  | 'PERMISSION_DISCLOSURE_ACCEPTED'

export interface ComplianceAuditLog {
  id:             string
  actor_id:       string | null
  target_user_id: string | null
  action:         ComplianceAuditAction | string
  entity_type:    string | null
  entity_id:      string | null
  metadata:       Record<string, unknown>
  created_at:     string
}

// ── Permission disclosure ──────────────────────────────────────────────────

export type PermissionType =
  | 'camera'
  | 'photos'
  | 'location_consumer'
  | 'location_driver'
  | 'notifications'

export const PERMISSION_DISCLOSURE_TEXT: Record<PermissionType, { title: string; message: string }> = {
  camera: {
    title:   'Camera Access',
    message: 'Camera access is required to scan recycling bag QR codes and verify bag condition.',
  },
  photos: {
    title:   'Photo Library Access',
    message: 'Photo access is used to upload recycling verification images.',
  },
  location_consumer: {
    title:   'Location Access',
    message: 'Location helps determine pickup eligibility and available recycling services during active app use.',
  },
  location_driver: {
    title:   'Location Access (Driver)',
    message: 'Location is used during active pickup work for route navigation, pickup verification, and service completion records.',
  },
  notifications: {
    title:   'Notification Access',
    message: 'Notifications are used for pickup updates, compliance reminders, expiring documents, account status alerts, and important service messages.',
  },
}

export interface PermissionDisclosureAcknowledgment {
  id:               string
  user_id:          string
  permission_type:  PermissionType
  disclosure_text:  string
  accepted_at:      string
}

// ── Notification severity (Sprint C re-export — already defined above) ─────

export type ComplianceSeverity = NotificationSeverity   // re-export with the Sprint C name

// ── Sprint C notification types are a superset of MG.4's. Both lib layers
//    write to the same compliance_notifications table; the union below is
//    what the canonical table's CHECK constraint accepts after the Sprint C
//    migration runs.
export type SprintCNotificationType =
  | 'document_missing'
  | 'document_expiring'
  | 'document_expired'
  | 'document_rejected'
  | 'countdown_started'
  | 'temporary_deactivation'
  | 'temporary_deactivation_warning'
  | 'reactivation'
  | 'account_deactivated'
  | 'route_not_completed'
  | 'route_incomplete'
  | 'drivers_needed'
  | 'admin_review_required'
  | 'commercial_pickup_overflow'
  | 'warehouse_certification_expiring'
  | 'insurance_expiring'
  | 'vehicle_inspection_expiring'
  | 'training_expiring'

// ════════════════════════════════════════════════════════════════════════════
// Enterprise Safety + Compliance (Sprint D) — incidents, complaints,
// investigations, violations, scores, rules engine, fraud flags, legal holds
// ════════════════════════════════════════════════════════════════════════════

// ── Incidents ──────────────────────────────────────────────────────────────

export type IncidentType =
  | 'vehicle_accident' | 'injury' | 'near_miss' | 'slip_fall'
  | 'chemical_spill' | 'hazardous_waste' | 'fire' | 'explosion'
  | 'unsafe_condition' | 'aggressive_customer' | 'property_damage'
  | 'vehicle_damage' | 'equipment_failure' | 'warehouse_incident'
  | 'medical_emergency' | 'weather_event' | 'animal_attack'
  | 'needle_discovery' | 'biohazard_discovery' | 'other'

export const INCIDENT_TYPE_LABELS: Record<IncidentType, string> = {
  vehicle_accident: 'Vehicle Accident', injury: 'Injury', near_miss: 'Near Miss',
  slip_fall: 'Slip / Fall', chemical_spill: 'Chemical Spill',
  hazardous_waste: 'Hazardous Waste Discovery', fire: 'Fire', explosion: 'Explosion',
  unsafe_condition: 'Unsafe Condition', aggressive_customer: 'Aggressive Customer',
  property_damage: 'Property Damage', vehicle_damage: 'Vehicle Damage',
  equipment_failure: 'Equipment Failure', warehouse_incident: 'Warehouse Incident',
  medical_emergency: 'Medical Emergency', weather_event: 'Weather Event',
  animal_attack: 'Animal Attack', needle_discovery: 'Needle Discovery',
  biohazard_discovery: 'Biohazard Discovery', other: 'Other',
}

export type IncidentSeverity = 'low' | 'moderate' | 'high' | 'critical'
export type IncidentStatus = 'open' | 'under_review' | 'escalated' | 'investigating' | 'resolved' | 'closed'

export interface IncidentReport {
  id:                          string
  reporter_id:                 string
  subject_user_id:             string | null
  incident_type:               IncidentType
  severity:                    IncidentSeverity
  status:                      IncidentStatus
  location_label:              string | null
  warehouse_id:                string | null
  vehicle_id:                  string | null
  occurred_at:                 string
  description:                 string
  immediate_action:            string | null
  injuries_reported:           boolean
  property_damage:             boolean
  emergency_services_called:   boolean
  assigned_to:                 string | null
  resolved_at:                 string | null
  resolution_notes:            string | null
  metadata:                    Record<string, unknown>
  created_at:                  string
  updated_at:                  string
}

export interface IncidentEvidence {
  id:          string
  incident_id: string
  uploaded_by: string | null
  kind:        'photo' | 'document' | 'witness_note' | 'video' | 'other'
  file_url:    string | null
  note:        string | null
  created_at:  string
}

// ── Complaints ─────────────────────────────────────────────────────────────

export type ComplaintCategory =
  | 'missed_pickup' | 'unsafe_driving' | 'property_damage'
  | 'employee_misconduct' | 'driver_misconduct' | 'warehouse_complaint'
  | 'service_quality' | 'contamination' | 'customer_service' | 'fraud' | 'other'

export const COMPLAINT_CATEGORY_LABELS: Record<ComplaintCategory, string> = {
  missed_pickup: 'Missed Pickup', unsafe_driving: 'Unsafe Driving',
  property_damage: 'Property Damage', employee_misconduct: 'Employee Misconduct',
  driver_misconduct: 'Driver Misconduct', warehouse_complaint: 'Warehouse Complaint',
  service_quality: 'Service Quality', contamination: 'Contamination Issue',
  customer_service: 'Customer Service', fraud: 'Fraud', other: 'Other',
}

export type ComplaintStatus = 'open' | 'reviewing' | 'investigating' | 'findings' | 'resolved' | 'closed'

export interface Complaint {
  id:                   string
  reporter_id:          string | null
  subject_user_id:      string | null
  category:             ComplaintCategory
  status:               ComplaintStatus
  severity:             IncidentSeverity
  description:          string
  related_route_id:     string | null
  related_warehouse_id: string | null
  related_account_id:   string | null
  resolution:           string | null
  resolved_at:          string | null
  metadata:             Record<string, unknown>
  created_at:           string
  updated_at:           string
}

// ── Investigations ─────────────────────────────────────────────────────────

export type InvestigationStatus = 'open' | 'active' | 'findings' | 'closed'

export interface Investigation {
  id:                  string
  complaint_id:        string | null
  incident_id:         string | null
  opened_by:           string | null
  assigned_to:         string | null
  status:              InvestigationStatus
  findings:            string | null
  recommended_actions: string | null
  closed_at:           string | null
  closed_by:           string | null
  metadata:            Record<string, unknown>
  created_at:          string
  updated_at:          string
}

// ── Violation points ───────────────────────────────────────────────────────

export type ViolationType =
  | 'late_pickup' | 'missed_pickup' | 'route_incomplete'
  | 'customer_complaint' | 'repeated_scan_failure'
  | 'unsafe_conduct' | 'fraud_attempt' | 'theft_allegation' | 'admin_assigned'

export const VIOLATION_TYPE_LABELS: Record<ViolationType, string> = {
  late_pickup: 'Late Pickup', missed_pickup: 'Missed Pickup',
  route_incomplete: 'Route Incomplete', customer_complaint: 'Customer Complaint',
  repeated_scan_failure: 'Repeated Scan Failure', unsafe_conduct: 'Unsafe Conduct',
  fraud_attempt: 'Fraud Attempt', theft_allegation: 'Theft Allegation',
  admin_assigned: 'Admin Assigned',
}

export const VIOLATION_POINT_DEFAULTS: Record<ViolationType, number> = {
  late_pickup: 1, missed_pickup: 2, route_incomplete: 3,
  customer_complaint: 3, repeated_scan_failure: 2,
  unsafe_conduct: 5, fraud_attempt: 10, theft_allegation: 0,   // review required
  admin_assigned: 0,
}

export const VIOLATION_THRESHOLDS = {
  warning:               5,
  probation:            10,
  temporary_suspension: 15,
  administrative_review: 20,
} as const

export interface ViolationPoint {
  id:                  string
  user_id:             string
  violation_type:      ViolationType
  points:              number
  reason:              string | null
  issued_by:           string | null
  related_entity_type: string | null
  related_entity_id:   string | null
  cleared:             boolean
  cleared_at:          string | null
  cleared_by:          string | null
  cleared_reason:      string | null
  created_at:          string
}

// ── Scores ──────────────────────────────────────────────────────────────────

export type ComplianceRiskLevel = 'excellent' | 'good' | 'watch_list' | 'high_risk'

export const RISK_LEVEL_LABELS: Record<ComplianceRiskLevel, string> = {
  excellent: 'Excellent', good: 'Good', watch_list: 'Watch List', high_risk: 'High Risk',
}

export interface ComplianceScore {
  user_id:     string
  score:       number               // 0-100
  risk_level:  ComplianceRiskLevel
  factors:     Record<string, unknown>
  computed_at: string
}

export type PerformanceRating = 'gold' | 'silver' | 'bronze' | 'probation'

export interface PerformanceScore {
  user_id:               string
  acceptance_rate:       number | null
  completion_rate:       number | null
  attendance_rate:       number | null
  scan_accuracy:         number | null
  customer_satisfaction: number | null
  safety_score:          number | null
  compliance_score:      number | null
  rating:                PerformanceRating
  computed_at:           string
}

// ── Training renewals ──────────────────────────────────────────────────────

export type TrainingRenewalCadence = 'annual' | 'biennial' | 'policy_change' | 'one_time'
export type TrainingRenewalStatus  = 'current' | 'due_soon' | 'overdue' | 'renewed'

export interface TrainingRenewal {
  id:                string
  user_id:           string
  training_key:      string
  cadence:           TrainingRenewalCadence
  last_completed_at: string | null
  next_due_at:       string | null
  policy_version:    string | null
  acknowledged_at:   string | null
  status:            TrainingRenewalStatus
  metadata:          Record<string, unknown>
  created_at:        string
  updated_at:        string
}

// ── Rules engine ───────────────────────────────────────────────────────────

export interface StateRule {
  id:             string
  state_code:     string
  rule_key:       string
  rule_value:     Record<string, unknown>
  notes:          string | null
  effective_from: string | null
  effective_to:   string | null
  updated_at:     string
}

export interface RoleRule {
  id:         string
  role_type:  string
  rule_key:   string
  rule_value: Record<string, unknown>
  notes:      string | null
  updated_at: string
}

export interface DocumentRequirement {
  id:            string
  role_type:     string
  state_code:    string | null
  document_type: string
  is_required:   boolean
  description:   string | null
  updated_at:    string
}

export interface TrainingRequirement {
  id:           string
  role_type:    string
  state_code:   string | null
  training_key: string
  is_required:  boolean
  cadence:      string | null
  description:  string | null
  updated_at:   string
}

export interface InsuranceRequirement {
  id:             string
  role_type:      string
  state_code:     string | null
  insurance_type: string
  is_required:    boolean
  min_coverage:   string | null
  description:    string | null
  updated_at:     string
}

// ── Fraud + legal holds ────────────────────────────────────────────────────

export type FraudFlagType =
  | 'duplicate_scans' | 'excessive_bag_scans' | 'unusual_route_activity'
  | 'repeated_emergency_requests' | 'excessive_cancellations'
  | 'suspicious_account_behavior' | 'manual_admin_flag'

export const FRAUD_FLAG_LABELS: Record<FraudFlagType, string> = {
  duplicate_scans: 'Duplicate Scans', excessive_bag_scans: 'Excessive Bag Scans',
  unusual_route_activity: 'Unusual Route Activity',
  repeated_emergency_requests: 'Repeated Emergency Requests',
  excessive_cancellations: 'Excessive Cancellations',
  suspicious_account_behavior: 'Suspicious Account Behavior',
  manual_admin_flag: 'Manual Admin Flag',
}

export type FraudFlagStatus = 'open' | 'reviewing' | 'dismissed' | 'confirmed'

export interface FraudFlag {
  id:           string
  user_id:      string | null
  flag_type:    FraudFlagType
  severity:     NotificationSeverity
  description:  string | null
  status:       FraudFlagStatus
  reviewed_by:  string | null
  reviewed_at:  string | null
  review_notes: string | null
  metadata:     Record<string, unknown>
  detected_at:  string
  created_at:   string
  updated_at:   string
}

export type LegalHoldStatus = 'active' | 'archived' | 'released'

export interface LegalHold {
  id:          string
  entity_type: string
  entity_id:   string
  reason:      string | null
  status:      LegalHoldStatus
  placed_by:   string | null
  placed_at:   string
  released_by: string | null
  released_at: string | null
  metadata:    Record<string, unknown>
  created_at:  string
  updated_at:  string
}

// ── Compliance timeline entry (synthesized from multiple sources) ──────────

export interface ComplianceTimelineEntry {
  at:           string
  kind:         'document' | 'violation' | 'incident' | 'complaint'
                | 'countdown' | 'reinstated' | 'note' | 'audit'
  title:        string
  detail?:      string
  severity?:    NotificationSeverity
  link?:        string
}
