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
