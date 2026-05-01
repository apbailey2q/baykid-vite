// DEMO STATE — shared across Consumer, Driver, Warehouse for competition demo
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface DemoBag {
  id: string
  bagCode: string
  consumerName: string
  address: string
  notes: string
  status: 'pending_pickup' | 'driver_accepted' | 'at_warehouse' | 'completed'
  requestedAt: string
  driverName: string
  completedAt?: string
}

export interface DemoStats {
  totalEarnings: number   // lifetime $
  unpaidEarnings: number  // since last payout $
  poundsRecycled: number
  co2Reduced: number      // kg
  bagsCompleted: number
}

export type BagResult = 'green' | 'yellow' | 'red'

export interface DemoRouteStop {
  id: string
  address: string            // base address (no unit suffix)
  units: string[]            // unit numbers sorted descending (empty = no units)
  bagCount: number
  status: 'pending' | 'active' | 'completed'
  scannedBags: Array<{ code: string; result: BagResult }>
}

export interface DemoRoute {
  id: string
  stops: DemoRouteStop[]
  routeStatus: 'active' | 'all_stops_done' | 'warehouse_checkin' | 'completed'
  warehouseCode: string | null
  checkedInBags: string[]   // bag codes confirmed at warehouse
  createdAt: string
}

export interface PickupInput {
  id: string
  address: string
  bags: number
}

interface DemoStore {
  bags: DemoBag[]
  stats: DemoStats
  activeRoute: DemoRoute | null

  // bag lifecycle
  addBag: (bagCode: string, consumerName: string, address: string, notes: string) => void
  acceptPickup: (bagId: string, driverName: string) => void
  markAtWarehouse: (bagId: string) => void
  completeBag: (bagId: string) => void
  scanAtWarehouse: (bagCode: string) => void
  processPayout: () => void
  resetDemo: () => void

  // driver route lifecycle
  createRoute: (pickups: PickupInput[]) => void
  scanBagAtStop: (stopId: string, bagCode: string, result: BagResult) => void
  completeRouteStop: (stopId: string) => void
  confirmWarehouseCode: (code: string) => void
  checkinBagAtWarehouse: (bagCode: string) => void
  finishDriverRoute: () => void
  clearDriverRoute: () => void
}

const INIT_STATS: DemoStats = {
  totalEarnings: 0,
  unpaidEarnings: 0,
  poundsRecycled: 0,
  co2Reduced: 0,
  bagsCompleted: 0,
}

function parseAddr(addr: string): { base: string; unit: string } {
  const m = addr.match(/\s+(?:Apt|Unit|Suite|#)\s*(\S+)\s*$/i)
  return m ? { base: addr.slice(0, -m[0].length).trim(), unit: m[1] } : { base: addr, unit: '' }
}

export const useDemoStore = create<DemoStore>()(
  persist(
    (set, get) => ({
      bags: [],
      stats: INIT_STATS,
      activeRoute: null,

      addBag: (bagCode, consumerName, address, notes) =>
        set((s) => ({
          bags: [
            ...s.bags,
            {
              id: `demo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              bagCode,
              consumerName,
              address,
              notes,
              status: 'pending_pickup',
              requestedAt: new Date().toISOString(),
              driverName: '',
            },
          ],
        })),

      acceptPickup: (bagId, driverName) =>
        set((s) => ({
          bags: s.bags.map((b) =>
            b.id === bagId ? { ...b, status: 'driver_accepted', driverName } : b
          ),
        })),

      markAtWarehouse: (bagId) =>
        set((s) => ({
          bags: s.bags.map((b) =>
            b.id === bagId ? { ...b, status: 'at_warehouse' } : b
          ),
        })),

      completeBag: (bagId) =>
        set((s) => ({
          bags: s.bags.map((b) =>
            b.id === bagId
              ? { ...b, status: 'completed', completedAt: new Date().toISOString() }
              : b
          ),
          stats: {
            ...s.stats,
            totalEarnings:  s.stats.totalEarnings + 5,
            unpaidEarnings: s.stats.unpaidEarnings + 5,
            poundsRecycled: s.stats.poundsRecycled + 10,
            co2Reduced:     s.stats.co2Reduced + 5,
            bagsCompleted:  s.stats.bagsCompleted + 1,
          },
        })),

      scanAtWarehouse: (bagCode) =>
        set((s) => ({
          bags: [
            ...s.bags,
            {
              id: `demo-wh-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              bagCode: bagCode.toUpperCase(),
              consumerName: 'Walk-in / Manual',
              address: 'Warehouse Drop-off',
              notes: '',
              status: 'at_warehouse' as const,
              requestedAt: new Date().toISOString(),
              driverName: '',
            },
          ],
        })),

      processPayout: () =>
        set((s) => ({ stats: { ...s.stats, unpaidEarnings: 0 } })),

      resetDemo: () => set({ bags: [], stats: INIT_STATS, activeRoute: null }),

      createRoute: (pickups) => {
        const grouped = new Map<string, { unit: string; bags: number }[]>()
        for (const p of pickups) {
          const { base, unit } = parseAddr(p.address)
          if (!grouped.has(base)) grouped.set(base, [])
          grouped.get(base)!.push({ unit, bags: p.bags })
        }
        let idx = 0
        const stops: DemoRouteStop[] = []
        for (const [base, items] of grouped.entries()) {
          const units = items.map((i) => i.unit).filter(Boolean).sort((a, b) => Number(b) - Number(a))
          const bagCount = items.reduce((s, i) => s + i.bags, 0)
          stops.push({
            id: `stop-${Date.now()}-${idx}`,
            address: base,
            units,
            bagCount,
            status: idx === 0 ? 'active' : 'pending',
            scannedBags: [],
          })
          idx++
        }
        set({
          activeRoute: {
            id: `route-${Date.now()}`,
            stops,
            routeStatus: 'active',
            warehouseCode: null,
            checkedInBags: [],
            createdAt: new Date().toISOString(),
          },
        })
      },

      scanBagAtStop: (stopId, bagCode, result) =>
        set((s) => {
          if (!s.activeRoute) return s
          return {
            activeRoute: {
              ...s.activeRoute,
              stops: s.activeRoute.stops.map((st) =>
                st.id === stopId
                  ? { ...st, scannedBags: [...st.scannedBags.filter((b) => b.code !== bagCode), { code: bagCode, result }] }
                  : st
              ),
            },
          }
        }),

      completeRouteStop: (stopId) =>
        set((s) => {
          if (!s.activeRoute) return s
          const stops = s.activeRoute.stops.map((st) =>
            st.id === stopId ? { ...st, status: 'completed' as const } : st
          )
          const nextPendingIdx = stops.findIndex((st) => st.status === 'pending')
          if (nextPendingIdx >= 0) {
            stops[nextPendingIdx] = { ...stops[nextPendingIdx], status: 'active' }
          }
          const allDone = stops.every((st) => st.status === 'completed')
          return {
            activeRoute: {
              ...s.activeRoute,
              stops,
              routeStatus: allDone ? 'all_stops_done' : 'active',
            },
          }
        }),

      confirmWarehouseCode: (code) =>
        set((s) => ({
          activeRoute: s.activeRoute
            ? { ...s.activeRoute, warehouseCode: code, routeStatus: 'warehouse_checkin' }
            : null,
        })),

      checkinBagAtWarehouse: (bagCode) =>
        set((s) => {
          if (!s.activeRoute) return s
          const checkedInBags = [...s.activeRoute.checkedInBags, bagCode]
          const totalBags = s.activeRoute.stops.reduce((n, st) => n + st.bagCount, 0)
          const routeStatus = checkedInBags.length >= totalBags ? 'completed' : 'warehouse_checkin'
          return { activeRoute: { ...s.activeRoute, checkedInBags, routeStatus } }
        }),

      finishDriverRoute: () =>
        set((s) => ({
          activeRoute: s.activeRoute ? { ...s.activeRoute, routeStatus: 'completed' } : null,
        })),

      clearDriverRoute: () => set({ activeRoute: null }),

      // expose get for selectors
      ...({} as { _get: typeof get }),
    }),
    { name: 'baykid-demo' }
  )
)
