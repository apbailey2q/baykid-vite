import { supabase } from './supabase'

export interface DriverBagScanInput {
  driverId:          string
  routeId?:          string | null
  stopId?:           string | null
  bagQrCode:         string
  stopAddress?:      string | null
  unitNumber?:       string | null
  bagStatus:         'green' | 'yellow' | 'red'
  finalDecision:     'accepted' | 'rejected'
  scanMethod:        'qr_scan' | 'manual_entry'
  inspectionMethod:  'camera' | 'override'
  notes?:            string | null
  overrideReason?:   string | null
  /** Confidence score 0–100 returned by AI vision (null when camera was bypassed). */
  aiConfidence?:     number | null
  /** Short explanation returned by AI vision for the bag status. */
  aiReason?:         string | null
  /** Supabase Storage URL of the captured bag inspection photo. */
  photoUrl?:         string | null
}

export async function saveDriverBagScan(input: DriverBagScanInput): Promise<void> {
  const { error } = await supabase.from('driver_bag_scans').insert({
    driver_id:          input.driverId,
    route_id:           input.routeId           ?? null,
    stop_id:            input.stopId            ?? null,
    bag_qr_code:        input.bagQrCode,
    stop_address:       input.stopAddress       ?? null,
    unit_number:        input.unitNumber        ?? null,
    bag_status:         input.bagStatus,
    final_decision:     input.finalDecision,
    scan_method:        input.scanMethod,
    inspection_method:  input.inspectionMethod,
    notes:              input.notes             ?? null,
    override_reason:    input.overrideReason    ?? null,
    ai_confidence:      input.aiConfidence      ?? null,
    ai_reason:          input.aiReason          ?? null,
    photo_url:          input.photoUrl          ?? null,
  })
  if (error) throw error
}

/** Fetch recent scans for a driver (for route history / admin dashboard). */
export async function getDriverBagScans(driverId: string, limit = 50) {
  const { data, error } = await supabase
    .from('driver_bag_scans')
    .select('*')
    .eq('driver_id', driverId)
    .order('scanned_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

/** Fetch all scans for a single stop (for warehouse drop-off list). */
export async function getBagScansByStop(stopId: string) {
  const { data, error } = await supabase
    .from('driver_bag_scans')
    .select('*')
    .eq('stop_id', stopId)
    .order('scanned_at', { ascending: false })
  if (error) throw error
  return data ?? []
}
