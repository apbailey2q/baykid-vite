import type { BagStatus, InspectionStatus } from '../types'

const BAG_STATUS: Record<BagStatus, { label: string; bg: string; color: string }> = {
  pending:      { label: 'Pending',      bg: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' },
  assigned:     { label: 'Assigned',     bg: 'rgba(59,130,246,0.15)',  color: '#60a5fa' },
  picked_up:    { label: 'Picked Up',    bg: 'rgba(99,102,241,0.15)',  color: '#a5b4fc' },
  at_warehouse: { label: 'At Warehouse', bg: 'rgba(0,200,255,0.12)',   color: '#00c8ff' },
  inspected:    { label: 'Inspected',    bg: 'rgba(168,85,247,0.15)',  color: '#c084fc' },
  completed:    { label: 'Completed',    bg: 'rgba(0,200,255,0.15)',   color: '#00c8ff' },
}

const INSPECTION_STATUS: Record<InspectionStatus, { label: string; bg: string; color: string }> = {
  green:  { label: 'Green',  bg: 'rgba(34,197,94,0.15)',  color: '#4ade80' },
  yellow: { label: 'Yellow', bg: 'rgba(234,179,8,0.15)',  color: '#facc15' },
  red:    { label: 'Red',    bg: 'rgba(239,68,68,0.15)',  color: '#f87171' },
}

export function BagStatusBadge({ status }: { status: BagStatus }) {
  const s = BAG_STATUS[status]
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ background: s.bg, color: s.color }}
    >
      {s.label}
    </span>
  )
}

export function InspectionStatusBadge({ status }: { status: InspectionStatus }) {
  const s = INSPECTION_STATUS[status]
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ background: s.bg, color: s.color }}
    >
      {s.label}
    </span>
  )
}
