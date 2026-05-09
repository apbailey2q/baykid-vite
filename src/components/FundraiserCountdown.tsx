import { useState, useEffect } from 'react'
import { getCountdownParts } from '../lib/demoFundraisers'

interface Props {
  endDate:  string
  compact?: boolean
}

export default function FundraiserCountdown({ endDate, compact = false }: Props) {
  const [parts, setParts] = useState(() => getCountdownParts(endDate))

  useEffect(() => {
    const id = setInterval(() => setParts(getCountdownParts(endDate)), 60_000)
    return () => clearInterval(id)
  }, [endDate])

  if (parts.status === 'expired') {
    return (
      <div
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
        style={{
          background: 'rgba(239,68,68,0.12)',
          border:     '1px solid rgba(239,68,68,0.3)',
        }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: '#ef4444' }}
        />
        <span
          className="font-semibold"
          style={{ fontSize: compact ? 9 : 10, color: '#f87171', letterSpacing: '0.04em' }}
        >
          Fundraiser Ended
        </span>
      </div>
    )
  }

  const isExpiringSoon = parts.status === 'expiring_soon'

  const timeLabel = parts.days > 0
    ? `${parts.days}d ${parts.hours}h ${parts.minutes}m`
    : parts.hours > 0
      ? `${parts.hours}h ${parts.minutes}m`
      : `${parts.minutes}m`

  return (
    <div className="inline-flex items-center gap-1.5">
      <div
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
        style={{
          background: isExpiringSoon ? 'rgba(251,191,36,0.1)' : 'rgba(0,200,255,0.08)',
          border:     isExpiringSoon ? '1px solid rgba(251,191,36,0.3)' : '1px solid rgba(0,200,255,0.2)',
        }}
      >
        <svg
          width={compact ? 9 : 10}
          height={compact ? 9 : 10}
          viewBox="0 0 24 24"
          fill="none"
          stroke={isExpiringSoon ? '#fbbf24' : '#00c8ff'}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        <span
          className="font-semibold tabular-nums"
          style={{ fontSize: compact ? 9 : 10, color: isExpiringSoon ? '#fbbf24' : '#00c8ff' }}
        >
          Ends in {timeLabel}
        </span>
      </div>
      {isExpiringSoon && (
        <span
          className="px-2 py-0.5 rounded-full font-bold uppercase"
          style={{
            fontSize:   compact ? 8 : 9,
            letterSpacing: '0.06em',
            background: 'rgba(251,191,36,0.15)',
            border:     '1px solid rgba(251,191,36,0.4)',
            color:      '#fbbf24',
          }}
        >
          Expiring Soon
        </span>
      )}
    </div>
  )
}
