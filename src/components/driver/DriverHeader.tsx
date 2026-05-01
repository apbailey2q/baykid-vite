import { StatusBadge } from './StatusBadge'
import { EmergencyButton } from '../EmergencyButton'

interface DriverHeaderProps {
  initials: string
}

export function DriverHeader({ initials }: DriverHeaderProps) {
  return (
    <>
      <div className="flex items-center gap-2.5">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
          style={{
            background: 'linear-gradient(135deg,rgba(0,188,212,0.25),rgba(0,100,255,0.15))',
            border: '1px solid rgba(0,188,212,0.35)',
          }}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#00BCD4"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M7 19H4.815a1.83 1.83 0 0 1-1.57-.881 1.785 1.785 0 0 1-.004-1.784L7.196 9.5" />
            <path d="M11 19h8.203a1.83 1.83 0 0 0 1.556-.89 1.784 1.784 0 0 0 0-1.775l-1.226-2.12" />
            <path d="m14 16 3 3-3 3" />
            <path d="M8.293 13.596 7.196 9.5 3.1 10.598" />
            <path d="m9.344 5.811 1.093-1.892A1.83 1.83 0 0 1 11.985 3a1.784 1.784 0 0 1 1.546.888l3.943 6.843" />
            <path d="m13.378 9.633 4.096 1.098 1.097-4.096" />
          </svg>
        </div>
        <div>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#ffffff', lineHeight: 1.1 }}>
            Cyan's Brooklynn
          </p>
          <p
            style={{
              fontSize: 10,
              color: 'rgba(255,255,255,0.35)',
              lineHeight: 1.2,
              letterSpacing: '0.04em',
            }}
          >
            Recycling Enterprise
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <StatusBadge label="Driver" />
        <EmergencyButton variant="inline" />
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-extrabold"
          style={{
            background: 'linear-gradient(135deg,#0057e7,#00BCD4)',
            color: '#ffffff',
            boxShadow: '0 0 14px rgba(0,188,212,0.4)',
          }}
        >
          {initials}
        </div>
      </div>
    </>
  )
}
