/**
 * useDriverLocation
 *
 * React hook that starts / stops GPS tracking based on the driver's online
 * status.  Internally uses driverLocationService to handle browser
 * geolocation and write to driver_live_locations.
 *
 * @example
 * ```tsx
 * const { isTracking, permState, lastCoordAt, gpsError } = useDriverLocation({
 *   enabled: isOnline,
 *   userId:  user?.id ?? null,
 * })
 * ```
 */

import { useEffect, useRef, useState } from 'react'
import {
  startLocationTracking,
  markDriverOffline,
  type GpsPermState,
  type GpsCoords,
} from '../lib/tracking/driverLocationService'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UseDriverLocationOptions {
  /** When true the hook requests location and streams updates to Supabase. */
  enabled: boolean
  /** Supabase auth user ID — tracking is skipped if null. */
  userId:  string | null
}

export interface DriverLocationState {
  /** Whether geolocation is currently active and writing to Supabase. */
  isTracking:  boolean
  /** Browser permission state for geolocation. */
  permState:   GpsPermState
  /** The most recent GPS coordinates, or null before first fix. */
  coords:      GpsCoords | null
  /** Timestamp of the most recent successful GPS fix. */
  lastCoordAt: Date | null
  /** Human-readable error string, or null if no error. */
  gpsError:    string | null
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useDriverLocation({ enabled, userId }: UseDriverLocationOptions): DriverLocationState {
  const [state, setState] = useState<DriverLocationState>({
    isTracking:  false,
    permState:   'prompt',
    coords:      null,
    lastCoordAt: null,
    gpsError:    null,
  })

  // Hold the service cleanup function across renders
  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    // ── Disabled or no user ───────────────────────────────────────────────
    if (!enabled || !userId) {
      // If we were tracking, stop now and mark offline
      if (cleanupRef.current) {
        cleanupRef.current()
        cleanupRef.current = null
        setState(s => ({ ...s, isTracking: false }))
      }
      // best-effort offline mark — userId was valid before, may still be valid
      if (userId) void markDriverOffline(userId)
      return
    }

    // ── Start tracking ────────────────────────────────────────────────────
    setState(s => ({ ...s, isTracking: true, gpsError: null }))

    const stop = startLocationTracking(userId, {
      onCoords(coords) {
        setState(s => ({
          ...s,
          coords,
          lastCoordAt: new Date(),
          gpsError:    null,
          isTracking:  true,
        }))
      },
      onPermState(permState) {
        setState(s => ({
          ...s,
          permState,
          // Denied = tracking can't continue
          isTracking: permState === 'denied' ? false : s.isTracking,
        }))
      },
      onError(msg) {
        setState(s => ({ ...s, gpsError: msg }))
      },
    })

    cleanupRef.current = stop

    // ── Cleanup on enabled→false or userId change ─────────────────────────
    return () => {
      stop()
      cleanupRef.current = null
      setState(s => ({ ...s, isTracking: false }))
      // Mark driver offline — fire-and-forget
      void markDriverOffline(userId)
    }
  }, [enabled, userId])

  return state
}
