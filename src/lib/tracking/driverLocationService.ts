/**
 * Driver Location Service
 *
 * Manages browser Geolocation watching and writes location data to
 * driver_live_locations in Supabase.  Designed to be framework-agnostic —
 * use the useDriverLocation React hook for component integration.
 *
 * Design notes:
 * - One row per driver — the table has a unique index on driver_id.
 *   All writes use upsert with onConflict:'driver_id'.
 * - Errors never throw — every DB write is fire-and-forget; a GPS failure
 *   notifies via callbacks but does not crash the calling context.
 * - The returned cleanup function must be called to stop watching.
 */

import { supabase } from '../supabase'

// ── Public types ──────────────────────────────────────────────────────────────

export type GpsPermState = 'prompt' | 'granted' | 'denied' | 'unavailable'

export interface GpsCoords {
  lat:      number
  lng:      number
  heading:  number | null
  speed:    number | null
  accuracy: number | null
}

export type DriverLocationStatus = 'en_route' | 'at_stop' | 'returning' | 'offline'

export interface LocationCallbacks {
  /** Called every time a new GPS position arrives. */
  onCoords(coords: GpsCoords): void
  /** Called when the browser permission state is known or changes. */
  onPermState(state: GpsPermState): void
  /** Called on non-fatal GPS errors (permission denied, timeout, etc.). */
  onError(msg: string): void
}

// ── Core service ──────────────────────────────────────────────────────────────

/**
 * Start geolocation watching and writing to driver_live_locations.
 *
 * @param userId     The Supabase auth user ID of the driver.
 * @param callbacks  Notification callbacks (all optional to call).
 * @returns          A cleanup function — call it to stop tracking.
 *
 * @example
 * ```ts
 * const stop = startLocationTracking(user.id, {
 *   onCoords: c  => console.log(c.lat, c.lng),
 *   onPermState: s => setPermState(s),
 *   onError: msg => console.warn(msg),
 * })
 * // Later:
 * stop()
 * ```
 */
export function startLocationTracking(userId: string, callbacks: LocationCallbacks): () => void {
  if (!navigator.geolocation) {
    callbacks.onPermState('unavailable')
    callbacks.onError('GPS not available on this device')
    return () => {}
  }

  let watchId: number | null = null

  // ── Success handler ───────────────────────────────────────────────────────

  const onSuccess = (pos: GeolocationPosition) => {
    const coords: GpsCoords = {
      lat:      pos.coords.latitude,
      lng:      pos.coords.longitude,
      heading:  pos.coords.heading,
      speed:    pos.coords.speed,
      accuracy: pos.coords.accuracy,
    }
    callbacks.onPermState('granted')
    callbacks.onCoords(coords)

    // Upsert current location — fire-and-forget, never throws
    void upsertLocation(userId, coords, 'en_route')
  }

  // ── Error handler ─────────────────────────────────────────────────────────

  const onError = (err: GeolocationPositionError) => {
    if (err.code === err.PERMISSION_DENIED) {
      callbacks.onPermState('denied')
      callbacks.onError('Location access denied — enable in device settings')
    } else if (err.code === err.POSITION_UNAVAILABLE) {
      callbacks.onError('GPS unavailable — check signal or move to open sky')
    } else {
      // TIMEOUT — watchPosition will keep retrying; notify but don't stop
      callbacks.onError('GPS timed out — retrying…')
    }
  }

  // ── Start watching ────────────────────────────────────────────────────────

  const startWatch = () => {
    watchId = navigator.geolocation.watchPosition(onSuccess, onError, {
      enableHighAccuracy: true,
      timeout:            15_000,
      maximumAge:         30_000,  // Accepts cached positions for battery saver mode
    })
  }

  // Check permission non-intrusively before triggering the browser prompt
  if (navigator.permissions) {
    navigator.permissions.query({ name: 'geolocation' })
      .then(result => {
        callbacks.onPermState(result.state as GpsPermState)
        if (result.state !== 'denied') {
          startWatch()
        } else {
          callbacks.onError('Location access denied — enable in device settings')
        }
        // Listen for the user granting/revoking permission later
        result.addEventListener('change', () => {
          callbacks.onPermState(result.state as GpsPermState)
          if (result.state === 'granted' && watchId == null) startWatch()
        })
      })
      .catch(() => startWatch())   // Permissions API unavailable — start directly
  } else {
    startWatch()
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────

  return () => {
    if (watchId != null) {
      navigator.geolocation.clearWatch(watchId)
      watchId = null
    }
  }
}

/**
 * Mark driver as offline in driver_live_locations.
 * Should be called when the driver goes offline or logs out.
 */
export async function markDriverOffline(userId: string): Promise<void> {
  if (!userId) return
  try {
    await supabase
      .from('driver_live_locations')
      .update({ status: 'offline', updated_at: new Date().toISOString() })
      .eq('driver_id', userId)
  } catch {
    // Silent — best-effort update only
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

async function upsertLocation(
  userId:  string,
  coords:  GpsCoords,
  status:  DriverLocationStatus,
  options?: { routeStopId?: string; commercialPickupId?: string },
): Promise<void> {
  try {
    await supabase.from('driver_live_locations').upsert(
      {
        driver_id:            userId,
        latitude:             coords.lat,
        longitude:            coords.lng,
        heading:              coords.heading,
        speed:                coords.speed,
        accuracy:             coords.accuracy,
        status,
        route_stop_id:        options?.routeStopId        ?? null,
        commercial_pickup_id: options?.commercialPickupId ?? null,
        updated_at:           new Date().toISOString(),
      },
      { onConflict: 'driver_id' },
    )
  } catch {
    // Silent — GPS tracking must never crash the app
  }
}
