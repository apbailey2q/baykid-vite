// PAYMENT PROCESSORS DISABLED BY FOUNDER DIRECTIVE.
// Do not enable Stripe, ACH, billing portals, checkout sessions, routing numbers,
// bank accounts, or third-party payment processors unless explicitly authorized.
//
// This component previously opened the Stripe Customer Portal.
// It now shows a static directive notice in place of the portal button.

interface Props {
  orgId:       string
  returnPath?: string
  label?:      string
  variant?:    'primary' | 'ghost'
}

// orgId / returnPath / label / variant retained so call-sites compile without changes.
export function BillingPortalButton({ label = 'Manage billing' }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
      <button
        disabled
        title="Billing activation is currently disabled by founder directive."
        style={{
          background: 'rgba(255,255,255,0.04)',
          color: 'rgba(255,255,255,0.3)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 10, padding: '8px 16px',
          fontWeight: 700, fontSize: 13, cursor: 'not-allowed',
          opacity: 0.6,
        }}
      >
        {label}
      </button>
      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textAlign: 'right', maxWidth: 220, lineHeight: 1.4 }}>
        Billing activation is currently disabled by founder directive.
        Contact administration to discuss plan access.
      </span>
    </div>
  )
}
