import React from 'react'

interface PageHeaderProps {
  rightContent?: React.ReactNode
}

export const PageHeader = ({ rightContent }: PageHeaderProps) => (
  // role="banner" is implied by <header> at the top level but explicit here
  // because this component is rendered inside a React root (not directly in
  // <body>), which some AT parse differently.
  <header
    role="banner"
    style={{
      display:         'flex',
      alignItems:      'center',
      justifyContent:  'space-between',
      padding:         '36px 18px 0',
    }}
  >
    {/* Left: recycling symbol + wordmark */}
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      {/* Decorative icon — hidden from screen readers */}
      <svg
        aria-hidden="true"
        focusable="false"
        width="18"
        height="18"
        viewBox="0 0 22 22"
        fill="none"
        style={{ animation: 'recyclePulse 3s ease-in-out infinite' }}
      >
        <path
          d="M11 2.5L13.8 6.5H12.2V10L8.5 7L6.8 8.8L11 2.5Z"
          fill="#22c55e"
        />
        <path
          d="M4.5 9.5L3 13.5H6.5L5.8 12L8.8 13.5L6.5 18H12"
          stroke="#22c55e"
          strokeWidth="1.3"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M17.5 9.5L19 13.5H15.5L16.2 12L13.2 13.5L15.5 18"
          stroke="#22c55e"
          strokeWidth="1.3"
          strokeLinecap="round"
          fill="none"
        />
      </svg>

      {/* Wordmark — use a <span> so screen readers read the brand name as text */}
      <span
        style={{
          fontSize:   '14px',
          fontWeight: 500,
          color:      '#ffffff',
        }}
      >
        Cyan's{' '}
        <span style={{ color: '#00c8ff' }}>Brooklynn</span>
      </span>
    </div>

    {/* Right: optional content passed in */}
    {rightContent && (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {rightContent}
      </div>
    )}
  </header>
)

export default PageHeader
