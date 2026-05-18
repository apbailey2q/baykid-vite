// BayKid — optimize-commercial-route Edge Function
//
// POST /optimize-commercial-route
// Authorization: Bearer <user-jwt>  (driver or admin required)
//
// Body:
//   {
//     route_stop_ids:    string[]                              // commercial_route_stops.id values to optimize
//     current_location?: { lat: number; lng: number } | null  // driver GPS position
//     warehouse_code?:   string | null                        // warehouses.code, e.g. 'NASH-01' (final OSRM leg)
//   }
//
// Returns:
//   {
//     optimized:              Array<{ stop_id, stop_order, business_name, pickup_location, estimated_weight_lbs }>
//     total_stops:            number
//     total_bins:             number
//     estimated_weight_lbs:   number
//     estimated_drive_minutes?: number   // total OSRM trip duration excluding warehouse leg
//     warehouse_eta_minutes?:  number    // OSRM leg from last stop to warehouse
//     method:                 'osrm' | 'priority_sort'
//     geocoded_count:         number     // stops whose coordinates were freshly geocoded
//   }
//
// Strategy:
//   1. Fetch all stop + pickup + account data from DB by route_stop_ids.
//      Drivers may only optimize their own stops. Admins may optimize any.
//   2. Geocode stops missing lat/lng via Nominatim (OSM, free, 1 req/sec).
//      Coordinates are persisted back to commercial_pickups for future calls.
//   3. Emergency/overflow stops always go first regardless of routing.
//   4. Remaining stops with coords + driver GPS → OSRM Trip (road-distance optimal).
//      If warehouse_code supplied, warehouse becomes OSRM final destination.
//   5. Stops without coords or OSRM failure → priority sort fallback.
//   6. Writes the new stop_order values to commercial_route_stops in DB.
//   7. Returns a full route summary (use on driver screen and admin dispatch).
//
// Provider: OSRM (Open Source Routing Machine) — free, OSM-based, no API key needed.
// To switch to Google Routes / Mapbox when billing is ready:
//   - Add ROUTING_PROVIDER secret ('osrm' | 'google' | 'mapbox')
//   - Add GOOGLE_ROUTES_API_KEY or MAPBOX_API_KEY secret
//   - Implement callGoogle() / callMapbox() with the same return shape
//   - Swap callOsrm() call with the provider function
//
// Auto-provided by Supabase Edge runtime:
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON_KEY     = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const OSRM_BASE = 'https://router.project-osrm.org/trip/v1/driving'
const NOM_BASE  = 'https://nominatim.openstreetmap.org/search'
const LBS_PER_BIN = 150

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── DB row shapes ─────────────────────────────────────────────────────────────

interface StopRow {
  id:          string
  pickup_id:   string
  sequence:    number
  stop_order:  number | null
  status:      string
  priority:    string | null
  is_overflow: boolean
  commercial_pickups: {
    id:               string
    pickup_location:  string | null
    preferred_window: string | null
    bin_count:        number
    latitude:         number | null
    longitude:        number | null
    assigned_warehouse: string | null
    commercial_accounts: { business_name: string } | null
  } | null
}

// ── Priority sort helpers ─────────────────────────────────────────────────────

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

function prioritySort(rows: StopRow[]): StopRow[] {
  return [...rows].sort((a, b) => {
    const pa = a.commercial_pickups
    const pb = b.commercial_pickups
    const aUrgent = (a.is_overflow || a.priority === 'emergency') ? 0 : 1
    const bUrgent = (b.is_overflow || b.priority === 'emergency') ? 0 : 1
    if (aUrgent !== bUrgent) return aUrgent - bUrgent
    const aHour = parseWindowHour(pa?.preferred_window ?? null)
    const bHour = parseWindowHour(pb?.preferred_window ?? null)
    if (aHour !== null && bHour !== null && aHour !== bHour) return aHour - bHour
    if (aHour !== null && bHour === null) return -1
    if (aHour === null && bHour !== null) return 1
    const aPri = PRIORITY_RANK[a.priority ?? 'normal'] ?? 2
    const bPri = PRIORITY_RANK[b.priority ?? 'normal'] ?? 2
    if (aPri !== bPri) return aPri - bPri
    return (pb?.bin_count ?? 0) - (pa?.bin_count ?? 0)
  })
}

// ── Nominatim geocoding ───────────────────────────────────────────────────────

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `${NOM_BASE}?q=${encodeURIComponent(address)}&format=json&limit=1`
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'BayKid-RouteOptimizer/1.0', 'Accept-Language': 'en' },
      signal: AbortSignal.timeout(5_000),
    })
    if (!resp.ok) return null
    const data = await resp.json() as Array<{ lat: string; lon: string }>
    if (!data.length) return null
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
  } catch { return null }
}

// ── OSRM Trip ─────────────────────────────────────────────────────────────────
// coords[0] = driver position (source=first), coords[1..N] = stops, coords[N+1] = optional warehouse
// Returns null on any error — caller falls back to priority sort.

interface OsrmResult {
  orderedStopIds:    string[]   // stop IDs in road-optimal order (driver + warehouse excluded)
  tripDurationSec:   number     // total trip duration (all legs)
  warehouseLegSec:   number     // duration of final leg to warehouse (0 if no warehouse)
}

async function callOsrm(
  coords: Array<{ id: string | null; lat: number; lng: number }>,
  hasWarehouse: boolean,
): Promise<OsrmResult | null> {
  if (coords.length < 3) return null  // need driver + at least 2 stops

  const coordStr = coords.map(c => `${c.lng},${c.lat}`).join(';')
  const dest     = hasWarehouse ? '&destination=last' : ''
  const url      = `${OSRM_BASE}/${coordStr}?roundtrip=false&source=first${dest}`

  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(10_000) })
    if (!resp.ok) { console.warn('[OSRM] HTTP', resp.status); return null }

    const data = await resp.json() as {
      code:      string
      waypoints: Array<{ waypoint_index: number }>
      trips:     Array<{ duration: number; legs: Array<{ duration: number }> }>
    }
    if (data.code !== 'Ok' || !data.waypoints?.length) {
      console.warn('[OSRM] Non-ok response:', data.code); return null
    }

    // Reconstruct optimized order from waypoint_index
    const n = coords.length
    const slotToInput = new Array<number | null>(n).fill(null)
    data.waypoints.forEach((wp, inputIdx) => { slotToInput[wp.waypoint_index] = inputIdx })

    // Exclude driver (inputIdx 0) and warehouse (inputIdx n-1 when hasWarehouse)
    const stopSlice = slotToInput.filter(
      (inputIdx): inputIdx is number =>
        inputIdx !== null && inputIdx !== 0 && (!hasWarehouse || inputIdx !== n - 1),
    )
    const orderedStopIds = stopSlice.map(inputIdx => coords[inputIdx].id!)

    const trip             = data.trips?.[0]
    const tripDurationSec  = trip?.duration ?? 0
    const warehouseLegSec  = hasWarehouse
      ? (trip?.legs?.[trip.legs.length - 1]?.duration ?? 0)
      : 0

    return { orderedStopIds, tripDurationSec, warehouseLegSec }
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

    // ── 1. Auth + role check ──────────────────────────────────────────────────

    const authHeader = req.headers.get('Authorization') ?? ''
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Authentication required' }, 401)

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authErr } = await userClient.auth.getUser()
    if (authErr || !user) return json({ error: 'Invalid or expired authentication' }, 401)

    const db = createClient(SUPABASE_URL, SERVICE_KEY)

    // Verify role — driver or admin only
    const { data: profile } = await db
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if (!profile || !['driver', 'admin'].includes(profile.role)) {
      return json({ error: 'Driver or admin access required' }, 403)
    }

    // ── 2. Parse body ─────────────────────────────────────────────────────────

    let body: {
      route_stop_ids:    string[]
      current_location?: { lat: number; lng: number } | null
      warehouse_code?:   string | null
    }
    try { body = await req.json() } catch {
      return json({ error: 'Request body must be valid JSON' }, 400)
    }

    const { route_stop_ids, current_location, warehouse_code } = body
    if (!Array.isArray(route_stop_ids) || route_stop_ids.length === 0) {
      return json({ error: 'route_stop_ids must be a non-empty array' }, 400)
    }

    // ── 3. Fetch stops from DB (secure — frontend cannot spoof stop data) ─────

    let stopsQuery = db
      .from('commercial_route_stops')
      .select(`
        id, pickup_id, sequence, stop_order, status, priority, is_overflow,
        commercial_pickups (
          id, pickup_location, preferred_window, bin_count, latitude, longitude, assigned_warehouse,
          commercial_accounts ( business_name )
        )
      `)
      .in('id', route_stop_ids)

    // Drivers may only optimize their own assigned stops
    if (profile.role === 'driver') {
      stopsQuery = stopsQuery.eq('driver_id', user.id)
    }

    const { data: stopsData, error: stopsErr } = await stopsQuery
    if (stopsErr) return json({ error: 'Failed to load route stops' }, 500)
    if (!stopsData?.length) return json({ error: 'No accessible stops found for these IDs' }, 404)

    const allStops = stopsData as unknown as StopRow[]

    // Separate locked (done) from movable
    const LOCKED = new Set(['completed', 'flagged', 'cancelled'])
    const locked  = allStops.filter(s => LOCKED.has(s.status))
    const movable = allStops.filter(s => !LOCKED.has(s.status))

    if (movable.length === 0) {
      return json({ error: 'All stops are done — nothing to optimize' }, 400)
    }

    // ── 4. Geocode stops missing coordinates (Nominatim, sequential) ──────────

    let geocodedCount = 0
    for (const stop of movable) {
      const p = stop.commercial_pickups
      if (!p) continue
      if ((p.latitude == null || p.longitude == null) && p.pickup_location?.trim()) {
        console.log('[Geocode] Attempting:', p.pickup_location)
        const coords = await geocodeAddress(p.pickup_location)
        if (coords) {
          p.latitude  = coords.lat
          p.longitude = coords.lng
          geocodedCount++
          const { error } = await db
            .from('commercial_pickups')
            .update({ latitude: coords.lat, longitude: coords.lng })
            .eq('id', p.id)
          if (error) console.warn('[Geocode] DB persist failed:', error.message)
        }
        // Nominatim usage policy: max 1 req/sec
        await new Promise(r => setTimeout(r, 1100))
      }
    }

    // ── 5. Resolve warehouse coordinates ──────────────────────────────────────
    // Use warehouse_code from body, or fall back to the most common assigned_warehouse in stops.

    let warehouseCoords: { lat: number; lng: number } | null = null
    const resolveCode = warehouse_code
      ?? (() => {
           const counts = new Map<string, number>()
           for (const s of movable) {
             const w = s.commercial_pickups?.assigned_warehouse
             if (w) counts.set(w, (counts.get(w) ?? 0) + 1)
           }
           let best: string | null = null, bestN = 0
           counts.forEach((n, k) => { if (n > bestN) { bestN = n; best = k } })
           return best
         })()

    if (resolveCode) {
      const { data: wh } = await db
        .from('warehouses')
        .select('latitude, longitude')
        .eq('code', resolveCode)
        .single()
      if (wh?.latitude != null && wh?.longitude != null) {
        warehouseCoords = { lat: Number(wh.latitude), lng: Number(wh.longitude) }
      }
    }

    // ── 6. Build optimized order ──────────────────────────────────────────────

    const urgent = movable.filter(s => s.is_overflow || s.priority === 'emergency')
    const normal = movable.filter(s => !s.is_overflow && s.priority !== 'emergency')

    const urgentSorted = prioritySort(urgent)

    const coordinated   = normal.filter(s => s.commercial_pickups?.latitude != null && s.commercial_pickups?.longitude != null)
    const uncoordinated = normal.filter(s => !coordinated.includes(s))

    let method: 'osrm' | 'priority_sort' = 'priority_sort'
    let estimatedDriveSec = 0
    let warehouseEtaSec   = 0
    let normalOrdered: StopRow[]

    const hasDriverGps = current_location != null
    const canUseOsrm   = hasDriverGps && coordinated.length >= 2

    if (canUseOsrm) {
      // Build coordinate list: driver → stops → optional warehouse
      const osrmCoords: Array<{ id: string | null; lat: number; lng: number }> = [
        { id: null, lat: current_location!.lat, lng: current_location!.lng },
        ...coordinated.map(s => ({
          id:  s.id,
          lat: s.commercial_pickups!.latitude!,
          lng: s.commercial_pickups!.longitude!,
        })),
        ...(warehouseCoords ? [{ id: null, ...warehouseCoords }] : []),
      ]

      const osrmResult = await callOsrm(osrmCoords, warehouseCoords != null)
      if (osrmResult) {
        method            = 'osrm'
        estimatedDriveSec = osrmResult.tripDurationSec - osrmResult.warehouseLegSec
        warehouseEtaSec   = osrmResult.warehouseLegSec
        const coordMap    = new Map(coordinated.map(s => [s.id, s]))
        const osrmOrdered = osrmResult.orderedStopIds
          .map(id => coordMap.get(id))
          .filter((s): s is StopRow => s != null)
        normalOrdered = [...osrmOrdered, ...prioritySort(uncoordinated)]
      } else {
        normalOrdered = prioritySort(normal)
      }
    } else {
      normalOrdered = prioritySort(normal)
    }

    // Locked stops retain their relative sequence order at the front
    const lockedOrdered = [...locked].sort(
      (a, b) => (a.stop_order ?? a.sequence) - (b.stop_order ?? b.sequence),
    )
    const lockedCount = lockedOrdered.length

    const movableOrdered = [...urgentSorted, ...normalOrdered]
    const allOrdered     = [...lockedOrdered, ...movableOrdered]

    // ── 7. Persist new stop_order values ──────────────────────────────────────

    const updates = await Promise.all(
      movableOrdered.map((s, idx) =>
        db
          .from('commercial_route_stops')
          .update({ stop_order: lockedCount + idx + 1 })
          .eq('id', s.id),
      ),
    )
    const errs = updates.filter(r => r.error)
    if (errs.length > 0) console.warn('[optimize] Partial DB update errors:', errs.length)

    // ── 8. Build response ─────────────────────────────────────────────────────

    const totalBins = allOrdered.reduce((n, s) => n + (s.commercial_pickups?.bin_count ?? 0), 0)

    return json({
      optimized: allOrdered.map((s, idx) => ({
        stop_id:              s.id,
        stop_order:           idx + 1,
        business_name:        s.commercial_pickups?.commercial_accounts?.business_name ?? null,
        pickup_location:      s.commercial_pickups?.pickup_location ?? null,
        estimated_weight_lbs: (s.commercial_pickups?.bin_count ?? 0) * LBS_PER_BIN,
      })),
      total_stops:             allOrdered.length,
      total_bins:              totalBins,
      estimated_weight_lbs:    totalBins * LBS_PER_BIN,
      estimated_drive_minutes: method === 'osrm' ? Math.round(estimatedDriveSec / 60) : undefined,
      warehouse_eta_minutes:   warehouseEtaSec > 0 ? Math.round(warehouseEtaSec / 60) : undefined,
      method,
      geocoded_count:          geocodedCount,
    })

  } catch (err) {
    console.error('[optimize-commercial-route] Unhandled error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})
