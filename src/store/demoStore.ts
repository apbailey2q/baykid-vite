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
  totalEarnings: 142.50,
  unpaidEarnings: 32.50,
  poundsRecycled: 340,
  co2Reduced: 170,
  bagsCompleted: 28,
}

const INIT_BAGS: DemoBag[] = [
  {
    id: 'seed-1', bagCode: 'CBR-A001', consumerName: 'J. Williams',
    address: '114 S 11th St', notes: 'Green bin at front door',
    status: 'pending_pickup',
    requestedAt: new Date(Date.now() - 28 * 60 * 1000).toISOString(), driverName: '',
  },
  {
    id: 'seed-2', bagCode: 'CBR-A002', consumerName: 'M. Thompson',
    address: '832 Chicamauga Ave', notes: '',
    status: 'pending_pickup',
    requestedAt: new Date(Date.now() - 52 * 60 * 1000).toISOString(), driverName: '',
  },
  {
    id: 'seed-3', bagCode: 'CBR-A003', consumerName: 'T. Harris',
    address: '1409 McGavock Pike', notes: 'Call on arrival',
    status: 'driver_accepted',
    requestedAt: new Date(Date.now() - 110 * 60 * 1000).toISOString(), driverName: 'Dev Driver',
  },
  {
    id: 'seed-4', bagCode: 'CBR-A004', consumerName: 'R. Davis',
    address: '407 S 14th St', notes: '',
    status: 'at_warehouse',
    requestedAt: new Date(Date.now() - 240 * 60 * 1000).toISOString(), driverName: 'Dev Driver',
  },
  {
    id: 'seed-5', bagCode: 'CBR-A005', consumerName: 'A. Johnson',
    address: '918 Glenrose Ave', notes: '',
    status: 'completed',
    requestedAt: new Date(Date.now() - 1440 * 60 * 1000).toISOString(), driverName: 'Dev Driver',
    completedAt: new Date(Date.now() - 1380 * 60 * 1000).toISOString(),
  },
  {
    id: 'seed-6', bagCode: 'CBR-A006', consumerName: 'D. Torres',
    address: '2201 Nolensville Pike', notes: '',
    status: 'completed',
    requestedAt: new Date(Date.now() - 2880 * 60 * 1000).toISOString(), driverName: 'Dev Driver',
    completedAt: new Date(Date.now() - 2820 * 60 * 1000).toISOString(),
  },
]

function parseAddr(addr: string): { base: string; unit: string } {
  const m = addr.match(/\s+(?:Apt|Unit|Suite|#)\s*(\S+)\s*$/i)
  return m ? { base: addr.slice(0, -m[0].length).trim(), unit: m[1] } : { base: addr, unit: '' }
}

export const useDemoStore = create<DemoStore>()(
  persist(
    (set, get) => ({
      bags: INIT_BAGS,
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
    {
      name: 'baykid-demo',
      version: 1,
      migrate: () => ({ bags: INIT_BAGS, stats: INIT_STATS, activeRoute: null }),
    }
  )
)
