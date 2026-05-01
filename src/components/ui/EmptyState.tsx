interface Props {
  icon?: string
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
}

export function EmptyState({ icon = '📭', title, description, action }: Props) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 rounded-2xl p-10 text-center"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px dashed rgba(0,190,255,0.15)',
      }}
    >
      <span className="text-4xl" role="img" aria-label="">
        {icon}
      </span>
      <div>
        <p className="text-sm font-semibold" style={{ color: '#ffffff' }}>
          {title}
        </p>
        {description && (
          <p className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {description}
          </p>
        )}
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-1 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{
            background: 'linear-gradient(135deg,#0057e7,#00c8ff)',
            boxShadow: '0 4px 16px rgba(0,190,255,0.3)',
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
