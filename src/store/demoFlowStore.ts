import { create } from 'zustand'
import { useDemoStore } from './demoStore'

export const DEMO_BAG_CODE = 'BAG-2026-DEMO'

type FlowRole = 'consumer' | 'driver' | 'warehouse'

export interface DemoFlowStep {
  index:       number
  label:       string
  role:        FlowRole
  path:        string
  bagStatus:   'pending_pickup' | 'driver_accepted' | 'at_warehouse' | 'completed'
  description: string
  personName:  string
}

export const DEMO_FLOW_STEPS: DemoFlowStep[] = [
  {
    index:       0,
    label:       'Consumer scheduled pickup',
    role:        'consumer',
    path:        '/dashboard/consumer',
    bagStatus:   'pending_pickup',
    description: 'Alex schedules a recycling pickup at 114 S 11th St',
    personName:  'Alex',
  },
  {
    index:       1,
    label:       'Driver accepted pickup',
    role:        'driver',
    path:        '/dashboard/driver',
    bagStatus:   'driver_accepted',
    description: 'Bertha accepts the pickup and heads to the address',
    personName:  'Bertha',
  },
  {
    index:       2,
    label:       'Warehouse received bag',
    role:        'warehouse',
    path:        '/dashboard/warehouse',
    bagStatus:   'at_warehouse',
    description: 'Bag arrives at the warehouse — Key begins inspection',
    personName:  'Key',
  },
  {
    index:       3,
    label:       'Processing completed',
    role:        'warehouse',
    path:        '/dashboard/warehouse',
    bagStatus:   'completed',
    description: 'Bag verified and marked complete — ready for payout',
    personName:  'Key',
  },
  {
    index:       4,
    label:       'Consumer sees impact',
    role:        'consumer',
    path:        '/dashboard/consumer',
    bagStatus:   'completed',
    description: 'Alex sees the bag completed and eco impact updated',
    personName:  'Alex',
  },
]

interface DemoFlowStore {
  isRunning: boolean
  step:      number
  startDemo: () => void
  goToStep:  (n: number) => void
  stopDemo:  () => void
}

function applyBagStatus(stepConfig: DemoFlowStep) {
  useDemoStore.setState(s => ({
    bags: s.bags.map(b => {
      if (b.bagCode !== DEMO_BAG_CODE) return b
      const isComplete = stepConfig.bagStatus === 'completed'
      return {
        ...b,
        status:      stepConfig.bagStatus,
        driverName:  stepConfig.bagStatus !== 'pending_pickup' ? 'Bertha' : '',
        completedAt: isComplete
          ? (b.completedAt ?? new Date().toISOString())
          : undefined,
      }
    }),
  }))
}

export const useDemoFlowStore = create<DemoFlowStore>((set) => ({
  isRunning: false,
  step:      0,

  startDemo: () => {
    // Insert or reset BAG-2026-DEMO in demoStore
    const bags = useDemoStore.getState().bags
    const exists = bags.some(b => b.bagCode === DEMO_BAG_CODE)
    if (exists) {
      useDemoStore.setState(s => ({
        bags: s.bags.map(b =>
          b.bagCode === DEMO_BAG_CODE
            ? { ...b, status: 'pending_pickup', driverName: '', completedAt: undefined }
            : b
        ),
      }))
    } else {
      useDemoStore.setState(s => ({
        bags: [
          {
            id:          'demo-flow-bag',
            bagCode:     DEMO_BAG_CODE,
            consumerName:'Alex',
            address:     '114 S 11th St',
            notes:       'Front door — recyclables ready',
            status:      'pending_pickup' as const,
            requestedAt: new Date().toISOString(),
            driverName:  '',
          },
          ...s.bags,
        ],
      }))
    }
    set({ isRunning: true, step: 0 })
  },

  goToStep: (n: number) => {
    const clamped = Math.max(0, Math.min(DEMO_FLOW_STEPS.length - 1, n))
    applyBagStatus(DEMO_FLOW_STEPS[clamped])
    set({ step: clamped })
  },

  stopDemo: () => set({ isRunning: false }),
}))
