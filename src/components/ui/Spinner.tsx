interface Props {
  size?: 'sm' | 'md' | 'lg'
  color?: string
}

const SIZES = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-8 w-8' }

export function Spinner({ size = 'md', color = '#00c8ff' }: Props) {
  return (
    <div
      className={`${SIZES[size]} animate-spin rounded-full border-2 border-t-transparent shrink-0`}
      style={{ borderColor: color, borderTopColor: 'transparent' }}
    />
  )
}

export function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center" style={{ background: '#060e24' }}>
      <Spinner size="lg" />
    </div>
  )
}
