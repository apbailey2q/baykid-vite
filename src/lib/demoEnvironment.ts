// Demo environment utilities — controls investor/pilot demo mode behavior.
// Set VITE_DEMO_MODE=true in .env.demo to enable.

export const DEMO_ENV = import.meta.env.VITE_DEMO_MODE === 'true'

// When DEMO_ENV is active, call demoGuard() instead of live code for destructive actions.
// realFn is never called in demo mode — demoFallback is returned immediately.
export function demoGuard<T>(realFn: () => Promise<T>, demoFallback: T): Promise<T> {
  if (DEMO_ENV) return Promise.resolve(demoFallback)
  return realFn()
}

// Sync variant for non-async paths.
export function demoGuardSync<T>(realFn: () => T, demoFallback: T): T {
  if (DEMO_ENV) return demoFallback
  return realFn()
}

// Use at the top of Stripe charge / payout triggers:
//   if (isDemoEnv()) { showToast('Demo: payment simulated'); return }
export const isDemoEnv = () => DEMO_ENV

// Demo account emails — shown in DemoOverview to investors.
// Passwords are shared via secure channel (not stored here).
export const DEMO_ACCOUNTS = {
  commercial: 'demo-commercial@cyanrecycling.com',
  driver:     'demo-driver@cyanrecycling.com',
  warehouse:  'demo-warehouse@cyanrecycling.com',
  admin:      'demo-admin@cyanrecycling.com',
} as const

// Investor-facing metrics — seeded/projected numbers for demo environment.
// Update these after pilot launch with real data.
export const DEMO_METRICS = [
  { value: '2.4M',  unit: 'lbs',     label: 'Recycled to Date',       icon: '♻️', color: '#4ade80' },
  { value: '1,200', unit: 'tons',     label: 'CO₂ Prevented',          icon: '🌍', color: '#5eead4' },
  { value: '47',    unit: 'active',   label: 'Commercial Accounts',     icon: '🏢', color: '#00c8ff' },
  { value: '94.7',  unit: '%',        label: 'Route Efficiency',        icon: '🚛', color: '#a78bfa' },
  { value: '12.3',  unit: 'avg/day',  label: 'Stops Per Driver',        icon: '📍', color: '#fbbf24' },
  { value: '18',    unit: '%',        label: 'Contamination Reduction', icon: '🔬', color: '#f87171' },
] as const

// Guard pattern examples for callsites:
//
// Stripe charge:
//   if (isDemoEnv()) { setSuccess('Demo: payment processed'); return }
//   const session = await supabase.functions.invoke('create-checkout', ...)
//
// GPS tracking start:
//   if (isDemoEnv()) return  // skip geolocation in demo
//   navigator.geolocation.watchPosition(...)
//
// Push notification send:
//   if (isDemoEnv()) return  // skip real push in demo
//   await supabase.functions.invoke('send-push', ...)
//
// Destructive admin delete:
//   if (isDemoEnv()) { showToast('Demo: action disabled'); return }
//   await supabase.from('table').delete().eq('id', id)
