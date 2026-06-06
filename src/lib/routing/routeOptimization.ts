/**
 * Route Optimization Foundation
 *
 * Provides a nearest-neighbor greedy algorithm for ordering pickup stops.
 * Each stop must have latitude and longitude to participate in sorting;
 * stops without coordinates are appended at the end in original order.
 *
 * TODO: Replace nearest-neighbor with Google Maps / Mapbox Directions API
 *       for turn-by-turn distance and travel-time optimized ordering.
 *       Integration point: `optimizeRoute()` — swap the return value with
 *       the ordered waypoints from the Directions API response.
 *
 * TODO: Add traffic-aware re-optimization when a stop is added mid-route.
 *
 * TODO: Persist the optimized order to commercial_route_stops.stop_order
 *       via an Edge Function so the driver's app and dispatch see the same
 *       sequence.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GeoPoint {
  lat: number
  lng: number
}

export interface PickupStop extends GeoPoint {
  /** Opaque identifier — passed through unchanged. */
  id: string
  /** Human-readable label for the stop (address, business name, etc.). */
  label?: string
  /** Any extra data you want to carry through the optimization. */
  [key: string]: unknown
}

export interface OptimizedRoute {
  /** Stops in the recommended visit order. */
  stops:              PickupStop[]
  /** Straight-line total distance in kilometers (approximate). */
  totalDistanceKm:    number
  /** Number of stops that had valid coordinates and were actively sorted. */
  geocodedStopCount:  number
  /** Number of stops appended without sorting (missing coordinates). */
  ungeocodedStopCount: number
}

// ── Haversine distance ────────────────────────────────────────────────────────

/**
 * Returns the great-circle distance between two points in kilometres.
 * Uses the Haversine formula — accurate to ~0.5% for distances < 500 km.
 */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R    = 6371          // Earth's mean radius in km
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const chord  = sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng
  return R * 2 * Math.atan2(Math.sqrt(chord), Math.sqrt(1 - chord))
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

// ── Nearest-neighbour algorithm ───────────────────────────────────────────────

/**
 * Sort `stops` using a greedy nearest-neighbour heuristic starting from
 * `origin`.  Complexity is O(n²) — fine up to a few hundred stops.
 *
 * @param origin   Starting point (driver's current location or depot).
 * @param stops    Stops to visit.  Stops missing lat/lng are appended last.
 */
export function nearestNeighbour(origin: GeoPoint, stops: PickupStop[]): PickupStop[] {
  const [geocoded, ungeo] = partition(stops, s => isValidCoord(s.lat, s.lng))

  const ordered: PickupStop[] = []
  const remaining             = [...geocoded]
  let   cursor: GeoPoint      = origin

  while (remaining.length > 0) {
    let bestIdx  = 0
    let bestDist = Infinity
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineKm(cursor, remaining[i])
      if (d < bestDist) { bestDist = d; bestIdx = i }
    }
    const [next] = remaining.splice(bestIdx, 1)
    ordered.push(next)
    cursor = next
  }

  return [...ordered, ...ungeo]
}

// ── Public entry point ────────────────────────────────────────────────────────

/**
 * Optimize a list of pickup stops starting from `origin`.
 *
 * Returns an `OptimizedRoute` with the suggested visit order, approximate
 * total straight-line distance, and counts of geocoded / ungeocoded stops.
 *
 * @example
 * ```ts
 * const result = optimizeRoute(
 *   { lat: 36.165, lng: -86.784 },   // driver location (Nashville, TN)
 *   stops,
 * )
 * assignRouteOrder(result.stops)
 * ```
 */
export function optimizeRoute(origin: GeoPoint, stops: PickupStop[]): OptimizedRoute {
  if (stops.length === 0) {
    return { stops: [], totalDistanceKm: 0, geocodedStopCount: 0, ungeocodedStopCount: 0 }
  }

  const ordered     = nearestNeighbour(origin, stops)
  const geocodedCt  = stops.filter(s => isValidCoord(s.lat, s.lng)).length
  const ungeocodedCt = stops.length - geocodedCt

  // Calculate total distance along the ordered route
  let totalKm  = 0
  let prev: GeoPoint = origin
  for (const stop of ordered) {
    if (isValidCoord(stop.lat, stop.lng)) {
      totalKm += haversineKm(prev, stop)
      prev = stop
    }
  }

  return {
    stops:               ordered,
    totalDistanceKm:     Math.round(totalKm * 10) / 10,
    geocodedStopCount:   geocodedCt,
    ungeocodedStopCount: ungeocodedCt,
  }
}

/**
 * Calculate the straight-line distance between the driver and a single stop.
 * Useful for quick ETA estimation without running the full optimiser.
 *
 * Returns `null` if either point has invalid coordinates.
 */
export function distanceToStop(driver: GeoPoint, stop: Partial<GeoPoint>): number | null {
  if (!isValidCoord(stop.lat, stop.lng)) return null
  if (!isValidCoord(driver.lat, driver.lng)) return null
  return haversineKm(driver, stop as GeoPoint)
}

/**
 * Rough travel-time estimate assuming an average speed.
 * Replace with Directions API travel_duration when available.
 *
 * @param distanceKm    Straight-line distance in kilometres.
 * @param avgSpeedKmh   Average speed in km/h (default 35 — urban driving).
 * @returns             Estimated minutes, rounded to nearest whole number.
 */
export function etaMinutes(distanceKm: number, avgSpeedKmh = 35): number {
  const straightLineFactor = 1.3  // Road distance is typically ~30% longer than straight line
  return Math.round((distanceKm * straightLineFactor / avgSpeedKmh) * 60)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isValidCoord(lat: unknown, lng: unknown): lat is number {
  return (
    typeof lat === 'number' && isFinite(lat) && lat >= -90  && lat <= 90 &&
    typeof lng === 'number' && isFinite(lng) && lng >= -180 && lng <= 180
  )
}

function partition<T>(arr: T[], pred: (item: T) => boolean): [T[], T[]] {
  const yes: T[] = []
  const no:  T[] = []
  for (const item of arr) (pred(item) ? yes : no).push(item)
  return [yes, no]
}
