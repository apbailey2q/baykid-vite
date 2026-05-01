import { supabase } from './supabase'
import type { DriverStatusRecord, Route, RouteStop, AlertType, UserRecord } from '../types'

export async function getOrCreateDriverStatus(driverId: string): Promise<DriverStatusRecord> {
  const { data: existing } = await supabase
    .from('driver_status')
    .select('*')
    .eq('driver_id', driverId)
    .maybeSingle()

  if (existing) return existing as DriverStatusRecord

  const { data, error } = await supabase
    .from('driver_status')
    .insert({ driver_id: driverId, is_online: false })
    .select()
    .single()

  if (error) throw error
  return data as DriverStatusRecord
}

export async function setDriverOnline(driverId: string, isOnline: boolean): Promise<DriverStatusRecord> {
  const { data, error } = await supabase
    .from('driver_status')
    .update({ is_online: isOnline, updated_at: new Date().toISOString() })
    .eq('driver_id', driverId)
    .select()
    .single()

  if (error) throw error
  return data as DriverStatusRecord
}

export async function touchLastActive(driverId: string): Promise<void> {
  await supabase
    .from('driver_status')
    .update({ last_active_at: new Date().toISOString() })
    .eq('driver_id', driverId)
}

export async function getActiveRoute(driverId: string): Promise<Route | null> {
  const { data } = await supabase
    .from('routes')
    .select('*')
    .eq('driver_id', driverId)
    .in('status', ['pending', 'active', 'paused'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data as Route | null
}

export async function getRouteStops(routeId: string): Promise<RouteStop[]> {
  const { data, error } = await supabase
    .from('route_stops')
    .select('*')
    .eq('route_id', routeId)
    .order('stop_order', { ascending: true })

  if (error) throw error
  return (data ?? []) as RouteStop[]
}

export async function completeStop(stopId: string): Promise<void> {
  const { error } = await supabase
    .from('route_stops')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', stopId)
  if (error) throw error
}

export async function skipStop(stopId: string): Promise<void> {
  const { error } = await supabase
    .from('route_stops')
    .update({ status: 'skipped' })
    .eq('id', stopId)
  if (error) throw error
}

export async function resumeRoute(routeId: string, driverId: string): Promise<void> {
  await supabase.from('routes').update({ status: 'active' }).eq('id', routeId)
  await supabase
    .from('driver_status')
    .update({ active_route_id: routeId, updated_at: new Date().toISOString() })
    .eq('driver_id', driverId)
}

export async function pauseRoute(routeId: string, driverId: string): Promise<void> {
  await supabase.from('routes').update({ status: 'paused' }).eq('id', routeId)
  await supabase
    .from('driver_status')
    .update({ active_route_id: null, is_online: false, updated_at: new Date().toISOString() })
    .eq('driver_id', driverId)
}

export async function completeRoute(routeId: string, driverId: string): Promise<void> {
  await supabase
    .from('routes')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', routeId)
  await supabase
    .from('driver_status')
    .update({ active_route_id: null, updated_at: new Date().toISOString() })
    .eq('driver_id', driverId)
}

export async function createAlert(
  driverId: string,
  alertType: AlertType,
  notes?: string,
): Promise<void> {
  const { error } = await supabase.from('alerts').insert({
    driver_id: driverId,
    alert_type: alertType,
    status: 'open',
    notes: notes ?? null,
  })
  if (error) throw error
}

export async function getAllDrivers(): Promise<UserRecord[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'driver')
    .eq('approval_status', 'approved')
    .order('full_name', { ascending: true })
  if (error) throw error
  return (data ?? []) as UserRecord[]
}

export async function startRoute(routeId: string, driverId: string): Promise<void> {
  await supabase
    .from('routes')
    .update({ status: 'active', started_at: new Date().toISOString() })
    .eq('id', routeId)
  await supabase
    .from('driver_status')
    .update({ active_route_id: routeId, is_online: true, updated_at: new Date().toISOString() })
    .eq('driver_id', driverId)
}

export async function createRouteForDriver(
  driverId: string,
  name: string,
  stops: Array<{ address: string; zipCode: string; bagCode?: string }>,
): Promise<Route> {
  const { data: route, error: routeErr } = await supabase
    .from('routes')
    .insert({ driver_id: driverId, name, status: 'pending' })
    .select()
    .single()
  if (routeErr) throw routeErr

  const stopInserts = stops.map((s, i) => ({
    route_id: route.id,
    address: s.address,
    zip_code: s.zipCode,
    stop_order: i + 1,
    status: 'pending',
  }))

  const { error: stopsErr } = await supabase.from('route_stops').insert(stopInserts)
  if (stopsErr) throw stopsErr

  // Link bag codes to stops when provided
  for (let i = 0; i < stops.length; i++) {
    const bagCode = stops[i].bagCode
    if (!bagCode) continue

    const { data: bag } = await supabase
      .from('bags')
      .select('id')
      .eq('bag_code', bagCode.toUpperCase())
      .maybeSingle()

    if (bag) {
      await supabase
        .from('route_stops')
        .update({ bag_id: bag.id })
        .eq('route_id', route.id)
        .eq('stop_order', i + 1)

      await supabase
        .from('bags')
        .update({ status: 'assigned', updated_at: new Date().toISOString() })
        .eq('id', bag.id)
    }
  }

  return route as Route
}

export async function createDemoRoute(driverId: string): Promise<Route> {
  const { data: route, error } = await supabase
    .from('routes')
    .insert({ driver_id: driverId, name: 'Demo Route', status: 'active', started_at: new Date().toISOString() })
    .select()
    .single()
  if (error) throw error

  await supabase.from('route_stops').insert([
    { route_id: route.id, address: '123 Main St', zip_code: '94105', stop_order: 1 },
    { route_id: route.id, address: '456 Oak Ave', zip_code: '94105', stop_order: 2 },
    { route_id: route.id, address: '789 Pine Rd', zip_code: '94107', stop_order: 3 },
    { route_id: route.id, address: '321 Elm Ct', zip_code: '94107', stop_order: 4 },
  ])

  await supabase
    .from('driver_status')
    .update({ active_route_id: route.id, is_online: true, updated_at: new Date().toISOString() })
    .eq('driver_id', driverId)

  return route as Route
}
