import React from 'react'

interface AppBackgroundProps {
  children: React.ReactNode
}

export const AppBackground = ({ children }: AppBackgroundProps) => (
  <div
    style={{
      position: 'relative',
      minHeight: '100vh',
      width: '100%',
      overflow: 'hidden',
      background: '#060e24',
    }}
  >
    {/* Top left orb */}
    <div
      style={{
        position: 'absolute',
        top: '-60px',
        left: '-40px',
        width: '220px',
        height: '220px',
        borderRadius: '50%',
        background: 'rgba(0, 100, 255, 0.4)',
        filter: 'blur(52px)',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />

    {/* Bottom right orb */}
    <div
      style={{
        position: 'absolute',
        bottom: '-20px',
        right: '-30px',
        width: '180px',
        height: '180px',
        borderRadius: '50%',
        background: 'rgba(0, 190, 255, 0.3)',
        filter: 'blur(52px)',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />

    {/* Grid overlay */}
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `
          linear-gradient(rgba(0,180,255,0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,180,255,0.04) 1px, transparent 1px)
        `,
        backgroundSize: '24px 24px',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />

    {/* Content */}
    <div style={{ position: 'relative', zIndex: 1 }}>
      {children}
    </div>
  </div>
)

export default AppBackground
