interface Props {
  className?: string
  height?: string
  width?: string
  rounded?: string
}

export function Skeleton({ className = '', height = 'h-4', width = 'w-full', rounded = 'rounded-lg' }: Props) {
  return (
    <div
      className={`${height} ${width} ${rounded} ${className} animate-pulse`}
      style={{ background: 'rgba(255,255,255,0.06)' }}
    />
  )
}

export function StatCardSkeleton() {
  return (
    <div
      className="rounded-2xl p-4 space-y-3"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(0,188,212,0.1)' }}
    >
      <Skeleton height="h-3" width="w-20" />
      <Skeleton height="h-8" width="w-16" />
      <Skeleton height="h-2" width="w-24" />
    </div>
  )
}

export function ListItemSkeleton() {
  return (
    <div
      className="flex items-center gap-3 rounded-xl p-4"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(0,188,212,0.1)' }}
    >
      <Skeleton height="h-10" width="w-10" rounded="rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton height="h-3" width="w-3/4" />
        <Skeleton height="h-2" width="w-1/2" />
      </div>
    </div>
  )
}
