export type Role =
  | 'consumer'
  | 'driver'
  | 'warehouse_employee'
  | 'warehouse_supervisor'
  | 'partner'
  | 'admin'

export type ApprovalStatus = 'pending' | 'approved' | 'rejected'

export interface Profile {
  id: string
  full_name: string
  role: Role
  approval_status: ApprovalStatus
  created_at: string
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
  consumer_id: string | null
  partner_id: string | null
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
