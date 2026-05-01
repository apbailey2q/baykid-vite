import { create } from 'zustand'
import type { DriverStatusRecord, Route, RouteStop } from '../types'

interface DriverState {
  driverStatus: DriverStatusRecord | null
  activeRoute: Route | null
  activeRouteStops: RouteStop[]
  lastActiveAt: Date
  offlineWarningOpen: boolean
  autoPausedAt: Date | null

  setDriverStatus: (s: DriverStatusRecord | null) => void
  setActiveRoute: (r: Route | null) => void
  setActiveRouteStops: (stops: RouteStop[]) => void
  updateStop: (stopId: string, patch: Partial<RouteStop>) => void
  recordActivity: () => void
  setOfflineWarning: (open: boolean) => void
  setAutoPaused: (at: Date | null) => void
}

export const useDriverStore = create<DriverState>((set) => ({
  driverStatus: null,
  activeRoute: null,
  activeRouteStops: [],
  lastActiveAt: new Date(),
  offlineWarningOpen: false,
  autoPausedAt: null,

  setDriverStatus: (driverStatus) => set({ driverStatus }),
  setActiveRoute: (activeRoute) => set({ activeRoute }),
  setActiveRouteStops: (activeRouteStops) => set({ activeRouteStops }),
  updateStop: (stopId, patch) =>
    set((s) => ({
      activeRouteStops: s.activeRouteStops.map((stop) =>
        stop.id === stopId ? { ...stop, ...patch } : stop,
      ),
    })),
  recordActivity: () => set({ lastActiveAt: new Date() }),
  setOfflineWarning: (offlineWarningOpen) => set({ offlineWarningOpen }),
  setAutoPaused: (autoPausedAt) => set({ autoPausedAt }),
}))
