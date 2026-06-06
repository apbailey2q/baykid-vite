// ── Driver online state sync (Phase G.9) ─────────────────────────────────────
// Per [[feedback_driver_online_state]]: the `driverOnline` localStorage key
// remains the single source of truth for driver-side UI gates (CommercialRoutes
// GPS upsert, DriverModeLanding badge, etc.). This module does NOT replace
// that — it adds two thin layers around it:
//
//   1. setDriverOnlineSync()   — write-through: writes localStorage first
//      (preserves all existing readers + the 'driver-online-toggle' event),
//      then mirrors into driver_status.is_online (Supabase) so admin dispatch
//      can observe the bit flip. Network failure does NOT roll back the
//      local toggle — drivers must still be able to flip themselves offline
//      while disconnected.
//
//   2. bootSyncDriverOnline()  — read-back: on driver login, reads
//      driver_status.is_online from Supabase and writes it back into
//      localStorage. If admin set is_online=false on the server, the driver
//      app reflects that on next launch.
//
// No new driver-side state is introduced. Existing call sites should route
// their localStorage writes through setDriverOnlineSync(), and the App-level
// boot manager calls bootSyncDriverOnline(userId) once per driver login.

import { getOrCreateDriverStatus, setDriverOnline } from './driver'

const KEY = 'driverOnline'
const EVT = 'driver-online-toggle'

/** Read the current localStorage value (safe in non-browser contexts). */
export function getDriverOnlineLocal(): boolean {
  try { return localStorage.getItem(KEY) === 'true' } catch { return false }
}

/**
 * Mirror a value into localStorage['driverOnline'] and dispatch the existing
 * 'driver-online-toggle' window event. Use this from code paths that already
 * wrote Supabase (e.g. DriverDashboard handlers) and just need the local key
 * brought into agreement.
 */
export function mirrorDriverOnlineLocal(next: boolean): void {
  try {
    localStorage.setItem(KEY, String(next))
    window.dispatchEvent(new Event(EVT))
  } catch {
    /* non-fatal — storage may be unavailable */
  }
}

/**
 * Toggle helper for driver-facing screens (DriverModeLanding, etc.).
 * Writes localStorage first (preserves all existing readers + the event),
 * then fires a best-effort write-through to driver_status.is_online so
 * admin dispatch sees the change. Network failure does not roll back the
 * local toggle — drivers must still be able to flip themselves offline
 * while disconnected.
 */
export async function setDriverOnlineSync(
  userId: string | null | undefined,
  next: boolean,
): Promise<void> {
  mirrorDriverOnlineLocal(next)
  if (!userId) return
  try {
    await setDriverOnline(userId, next)
  } catch (err) {
    console.warn('[driverOnlineSync] Supabase mirror failed:', err)
  }
}

/**
 * Boot-time read-back. Called once per driver login from App.tsx. Reads
 * driver_status.is_online and brings localStorage['driverOnline'] into
 * agreement. If admin set is_online=false on the server, the driver app
 * reflects that on next launch.
 */
export async function bootSyncDriverOnline(
  userId: string | null | undefined,
): Promise<void> {
  if (!userId) return
  try {
    const status = await getOrCreateDriverStatus(userId)
    mirrorDriverOnlineLocal(Boolean(status.is_online))
  } catch (err) {
    console.warn('[driverOnlineSync] boot read-back failed:', err)
  }
}
