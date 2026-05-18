// BayKid — optimize-route Edge Function
//
// POST /optimize-route
// Authorization: Bearer <user-jwt>   (required — anon is rejected)
//
// Body:
//   {
//     stops: Array<{
//       id:               string   // commercial_route_stops.id
//       pickup_id:        string   // commercial_pickups.id (for geocode persistence)
//       lat?:             number | null
//       lng?:             number | null
//       pickup_location?: string | null  // text address — Nominatim geocoded if no lat/lng
//       priority:         string | null  // 'emergency' | 'high' | 'normal' | 'low'
//       is_overflow:      boolean
//       preferred_window: string | null  // e.g. "9AM", "2PM"
//       bin_count:        number
//     }>
//     driver_lat?: number | null
//     driver_lng?: number | null
//   }
//
// Returns:
//   {
//     order: Array<{ id: string; stop_order: number }>
//     method: 'osrm' | 'priority_sort'
//     osrm_duration_minutes?: number
//     geocoded_count: number
//   }
//
// Strategy:
//   1. Geocode stops with missing lat/lng via Nominatim (OSM, free).
//      Persists coords back to commercial_pickups so subsequent calls skip geocoding.
//   2. If >= 2 stops have coords AND driver has GPS:
//      Call OSRM Trip for road-distance-optimal ordering.
//      Emergency/overflow stops are kept first regardless of OSRM output.
//   3. Stops without coords fall back to priority sort (window → priority → bins).
//   4. Returns the fully merged order for all input stops.
//
// Auto-provided by Supabase Edge runtime:
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON_KEY     = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const OSRM_BASE = 'https://router.project-osrm.org/trip/v1/driving'
const NOM_BASE  = 'https://nominatim.openstreetmap.org/search'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface StopInput {
  id:               string
  pickup_id:        string
  lat?:             number | null
  lng?:             number | null
  pickup_location?: string | null
  priority:         string | null
  is_overflow:      boolean
  preferred_window: string | null
  bin_count:        number
}

interface OsrmWaypoint { waypoint_index: number }
interface OsrmTrip     { duration: number }
interface OsrmResponse { code: string; waypoints: OsrmWaypoint[]; trips: OsrmTrip[] }

// ── Priority sort ─────────────────────────────────────────────────────────────

const PRIORITY_RANK: Record<string, number> = { emergency: 0, high: 1, normal: 2, low: 3 }

function parseWindowHour(window: string | null): number | null {
  if (!window) return null
  const m = window.match(/(\d{1,2})(AM|PM)/i)
  if (!m) return null
  let h = parseInt(m[1], 10)
  if (m[2].toUpperCase() === 'PM' && h !== 12) h += 12
  if (m[2].toUpperCase() === 'AM' && h === 12) h = 0
  return h
}

function prioritySort(stops: StopInput[]): StopInput[] {
  return [...stops].sort((a, b) => {
    const aUrgent = (a.is_overflow || a.priority === 'emergency') ? 0 : 1
    const bUrgent = (b.is_overflow || b.priority === 'emergency') ? 0 : 1
    if (aUrgent !== bUrgent) return aUrgent - bUrgent
    const aHour = parseWindowHour(a.preferred_window)
    const bHour = parseWindowHour(b.preferred_window)
    if (aHour !== null && bHour !== null && aHour !== bHour) return aHour - bHour
    if (aHour !== null && bHour === null) return -1
    if (aHour === null && bHour !== null) return 1
    const aPri = PRIORITY_RANK[a.priority ?? 'normal'] ?? 2
    const bPri = PRIORITY_RANK[b.priority ?? 'normal'] ?? 2
    if (aPri !== bPri) return aPri - bPri
    return b.bin_count - a.bin_count
  })
}

// ── Nominatim geocoding ───────────────────────────────────────────────────────

async function geocodeAddress(
  address: string,
): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `${NOM_BASE}?q=${encodeURIComponent(address)}&format=json&limit=1`
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'BayKid-RouteOptimizer/1.0',
        'Accept-Language': 'en',
      },
      signal: AbortSignal.timeout(5_000),
    })
    if (!resp.ok) return null
    const data = await resp.json() as Array<{ lat: string; lon: string }>
    if (!data.length) return null
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
  } catch {
    return null
  }
}

// ── OSRM Trip ─────────────────────────────────────────────────────────────────
// Returns ordered stop IDs (excludes driver position) and total trip duration.
// Null on any OSRM error — caller falls back to priority sort.

async function callOsrm(
  driverLat: number,
  driverLng: number,
  stops: Array<{ id: string; lat: number; lng: number }>,
): Promise<{ orderedIds: string[]; durationSeconds: number } | null> {
  // OSRM uses longitude,latitude order
  const coordStr = [
    `${driverLng},${driverLat}`,
    ...stops.map(s => `${s.lng},${s.lat}`),
  ].join(';')

  const url = `${OSRM_BASE}/${coordStr}?roundtrip=false&source=first`

  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(10_000) })
    if (!resp.ok) {
      console.warn('[OSRM] HTTP error:', resp.status)
      return null
    }
    const data = await resp.json() as OsrmResponse
    if (data.code !== 'Ok' || !data.waypoints?.length) {
      console.warn('[OSRM] Non-ok response:', data.code)
      return null
    }

    // waypoints[i].waypoint_index = position of input coord i in the optimized trip.
    // Input indices: 0 = driver, 1..N = stops[0..N-1]
    const n = stops.length + 1 // includes driver
    const slotToInput = new Array<number | null>(n).fill(null)
    data.waypoints.forEach((wp, inputIdx) => {
      slotToInput[wp.waypoint_index] = inputIdx
    })

    // Reconstruct stop order, skipping driver (inputIdx 0)
    const orderedIds = slotToInput
      .filter((inputIdx): inputIdx is number => inputIdx !== null && inputIdx !== 0)
      .map(inputIdx => stops[inputIdx - 1].id)

    return {
      orderedIds,
      durationSeconds: data.trips?.[0]?.duration ?? 0,
    }
  } catch (err) {
    console.warn('[OSRM] Fetch failed:', err)
    return null
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })

  try {
    // ── 1. Auth ───────────────────────────────────────────────────────────────

    const authHeader = req.headers.get('Authorization') ?? ''
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Authentication required' }, 401)

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authErr } = await userClient.auth.getUser()
    if (authErr || !user) return json({ error: 'Invalid or expired authentication' }, 401)

    // ── 2. Parse body ─────────────────────────────────────────────────────────

    let body: { stops: StopInput[]; driver_lat?: number | null; driver_lng?: number | null }
    try { body = await req.json() } catch {
      return json({ error: 'Request body must be valid JSON' }, 400)
    }

    const { stops, driver_lat, driver_lng } = body
    if (!Array.isArray(stops) || stops.length === 0) {
      return json({ error: 'stops array is required and must not be empty' }, 400)
    }

    const db = createClient(SUPABASE_URL, SERVICE_KEY)

    // ── 3. Geocode stops with missing coords (Nominatim, sequential for rate limit) ──

    let geocodedCount = 0
    for (const stop of stops) {
      if ((stop.lat == null || stop.lng == null) && stop.pickup_location?.trim()) {
        console.log('[Geocode] Attempting:', stop.pickup_location)
        const coords = await geocodeAddress(stop.pickup_location)
        if (coords) {
          stop.lat = coords.lat
          stop.lng  = coords.lng
          geocodedCount++
          // Persist so next optimize call reads coords from DB directly
          const { error } = await db
            .from('commercial_pickups')
            .update({ latitude: coords.lat, longitude: coords.lng })
            .eq('id', stop.pickup_id)
          if (error) console.warn('[Geocode] DB persist failed:', error.message)
        }
        // Nominatim usage policy: max 1 req/sec
        await new Promise(r => setTimeout(r, 1100))
      }
    }

    // ── 4. Build optimized order ──────────────────────────────────────────────

    // Separate urgent (always first: emergency priority or overflow) from normal
    const urgent = stops.filter(s => s.is_overflow || s.priority === 'emergency')
    const normal = stops.filter(s => !s.is_overflow && s.priority !== 'emergency')

    const urgentSorted = prioritySort(urgent)

    // OSRM: requires driver coords + at least 2 normal stops with coordinates
    const coordinated = normal.filter(
      s => s.lat != null && s.lng != null,
    ) as Array<StopInput & { lat: number; lng: number }>
    const uncoordinated = normal.filter(s => s.lat == null || s.lng == null)

    let method: 'osrm' | 'priority_sort' = 'priority_sort'
    let durationSeconds = 0
    let normalOrdered: StopInput[]

    const hasDriverGps  = driver_lat != null && driver_lng != null
    const canUseOsrm    = hasDriverGps && coordinated.length >= 2

    if (canUseOsrm) {
      const osrmResult = await callOsrm(driver_lat!, driver_lng!, coordinated)
      if (osrmResult) {
        method          = 'osrm'
        durationSeconds = osrmResult.durationSeconds
        // Map orderedIds back to StopInput objects
        const coordMap = new Map(coordinated.map(s => [s.id, s]))
        const osrmOrdered = osrmResult.orderedIds
          .map(id => coordMap.get(id))
          .filter((s): s is StopInput => s != null)
        normalOrdered = [...osrmOrdered, ...prioritySort(uncoordinated)]
      } else {
        // OSRM failed — fall back to priority sort for all normal stops
        normalOrdered = prioritySort(normal)
      }
    } else {
      normalOrdered = prioritySort(normal)
    }

    // Merge: urgent first → optimized normal
    const ordered = [...urgentSorted, ...normalOrdered]

    // Assign stop_order values (1-based)
    const order = ordered.map((stop, idx) => ({ id: stop.id, stop_order: idx + 1 }))

    return json({
      order,
      method,
      osrm_duration_minutes: method === 'osrm' ? Math.round(durationSeconds / 60) : undefined,
      geocoded_count: geocodedCount,
    })

  } catch (err) {
    console.error('[optimize-route] Unhandled error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})
