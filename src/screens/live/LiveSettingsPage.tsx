import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

// ── Sub-component types ────────────────────────────────────────
type ToggleProps   = { on: boolean; onChange: (v: boolean) => void }
type NumInputProps = { value: number; onChange: (v: number) => void; prefix?: string; step?: number; min?: number; width?: number }
type CardProps     = { title: string; icon: string; children: React.ReactNode; style?: React.CSSProperties }
type RowProps      = { label: string; sublabel?: string; children: React.ReactNode; divider?: boolean }

// ── Setting state types ────────────────────────────────────────
type BagRules = {
  defaultValue:      number
  defaultCO2:        number
  defaultPoints:     number
  maxRescanAttempts: number
}

type FundraiserRules = {
  defaultSplit:       number
  minCashDonation:    number
  expiredBlockScans:  boolean
  allowCashDonations: boolean
}

type PayoutMethods = { bank: boolean; cashApp: boolean; paypal: boolean; giftCard: boolean }

type PayoutRules = {
  minPayoutAmount: number
  reviewRequired:  boolean
  allowedMethods:  PayoutMethods
}

type InspectionRules = {
  greenAutoApprove:      boolean
  manualOverrideAllowed: boolean
}

// ── Sub-components ─────────────────────────────────────────────
function Toggle({ on, onChange }: ToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      style={{
        width:      42,
        height:     24,
        borderRadius: 12,
        background:  on ? '#00c8ff' : 'rgba(255,255,255,0.15)',
        border:      'none',
        cursor:      'pointer',
        position:    'relative',
        flexShrink:  0,
        transition:  'background 0.2s ease',
      }}
    >
      <span
        style={{
          position:     'absolute',
          top:          3,
          left:         on ? 21 : 3,
          width:        18,
          height:       18,
          borderRadius: '50%',
          background:   '#ffffff',
          boxShadow:    '0 1px 4px rgba(0,0,0,0.3)',
          transition:   'left 0.2s ease',
        }}
      />
    </button>
  )
}

function NumInput({ value, onChange, prefix, step = 1, min = 0, width = 80 }: NumInputProps) {
  return (
    <div className="flex items-center gap-1.5">
      {prefix && (
        <span style={{ fontSize: 13, color: '#00c8ff', fontWeight: 700 }}>{prefix}</span>
      )}
      <input
        type="number"
        value={value}
        step={step}
        min={min}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(parseFloat(e.target.value) || 0)}
        className="text-right outline-none"
        style={{
          width,
          background:   'rgba(0,200,255,0.07)',
          border:       '1px solid rgba(0,200,255,0.25)',
          borderRadius: 10,
          color:        '#00c8ff',
          fontSize:     13,
          fontWeight:   700,
          padding:      '6px 10px',
        }}
      />
    </div>
  )
}

function SectionCard({ title, icon, children, style }: CardProps) {
  return (
    <div
      className="rounded-2xl p-5 mb-4"
      style={{ background: 'rgba(0,87,231,0.08)', border: '1px solid rgba(0,200,255,0.18)', ...style }}
    >
      <div className="flex items-center gap-2.5 mb-4">
        <span style={{ fontSize: 18 }}>{icon}</span>
        <p style={{ fontSize: 13, fontWeight: 800, color: '#ffffff', letterSpacing: '0.01em' }}>{title}</p>
      </div>
      <div>{children}</div>
    </div>
  )
}

function SettingRow({ label, sublabel, children, divider = true }: RowProps) {
  return (
    <div
      className="flex items-center justify-between gap-4"
      style={{
        paddingTop:    8,
        paddingBottom: 8,
        borderBottom:  divider ? '1px solid rgba(255,255,255,0.06)' : 'none',
        minHeight:     48,
      }}
    >
      <div className="flex-1 min-w-0">
        <p style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.8)', lineHeight: 1.3 }}>{label}</p>
        {sublabel && (
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{sublabel}</p>
        )}
      </div>
      <div className="shrink-0 flex items-center">{children}</div>
    </div>
  )
}

function InfoRow({ icon, text, badge, badgeColor, badgeBg, badgeBorder, divider = true }: {
  icon: string; text: string; badge: string;
  badgeColor: string; badgeBg: string; badgeBorder: string; divider?: boolean
}) {
  return (
    <div
      className="flex items-start gap-3"
      style={{ paddingTop: 8, paddingBottom: 8, borderBottom: divider ? '1px solid rgba(255,255,255,0.06)' : 'none' }}
    >
      <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5, flex: 1 }}>{text}</p>
      <span
        className="shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide"
        style={{ background: badgeBg, border: `1px solid ${badgeBorder}`, color: badgeColor }}
      >
        {badge}
      </span>
    </div>
  )
}

// ── Default values ─────────────────────────────────────────────
const DEFAULT_BAG: BagRules = {
  defaultValue:      2.85,
  defaultCO2:        4.2,
  defaultPoints:     285,
  maxRescanAttempts: 3,
}

const DEFAULT_FUNDRAISER: FundraiserRules = {
  defaultSplit:       0.85,
  minCashDonation:    5,
  expiredBlockScans:  true,
  allowCashDonations: true,
}

const DEFAULT_PAYOUT: PayoutRules = {
  minPayoutAmount: 25,
  reviewRequired:  true,
  allowedMethods:  { bank: true, cashApp: true, paypal: true, giftCard: true },
}

const DEFAULT_INSPECTION: InspectionRules = {
  greenAutoApprove:      true,
  manualOverrideAllowed: true,
}

const PAYOUT_METHOD_LABELS: Record<keyof PayoutMethods, string> = {
  bank:     'Bank Transfer',
  cashApp:  'Cash App',
  paypal:   'PayPal',
  giftCard: 'Gift Card',
}

// ── Page ───────────────────────────────────────────────────────
export default function LiveSettingsPage() {
  const [animate, setAnimate]         = useState(false)
  const [saved, setSaved]             = useState(false)
  const [bagRules, setBagRules]       = useState<BagRules>(DEFAULT_BAG)
  const [frRules, setFrRules]         = useState<FundraiserRules>(DEFAULT_FUNDRAISER)
  const [payRules, setPayRules]       = useState<PayoutRules>(DEFAULT_PAYOUT)
  const [inspRules, setInspRules]     = useState<InspectionRules>(DEFAULT_INSPECTION)

  useEffect(() => {
    const f = requestAnimationFrame(() => setAnimate(true))
    return () => cancelAnimationFrame(f)
  }, [])

  function handleSave() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  function togglePayMethod(key: keyof PayoutMethods) {
    setPayRules(r => ({ ...r, allowedMethods: { ...r.allowedMethods, [key]: !r.allowedMethods[key] } }))
  }

  const fade = (d = 0): React.CSSProperties => ({
    opacity:    animate ? 1 : 0,
    transform:  animate ? 'translateY(0)' : 'translateY(14px)',
    transition: `opacity 0.4s ease ${d}ms, transform 0.4s ease ${d}ms`,
  })

  return (
    <div
      className="relative min-h-screen flex flex-col overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}
    >
      <div className="pointer-events-none absolute inset-0 grid-bg" />
      <div className="pointer-events-none absolute" style={{ top: -80,   left: -60,  width: 300, height: 300, background: 'rgba(0,87,231,0.22)',  filter: 'blur(80px)', borderRadius: '50%' }} />
      <div className="pointer-events-none absolute" style={{ bottom: -60, right: -40, width: 240, height: 240, background: 'rgba(0,200,128,0.08)', filter: 'blur(64px)', borderRadius: '50%' }} />

      {/* Header */}
      <header
        className="relative flex items-center justify-between px-4 py-3"
        style={{ background: 'rgba(4,10,24,0.92)', borderBottom: '1px solid rgba(0,200,255,0.12)', backdropFilter: 'blur(12px)', zIndex: 2 }}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl font-extrabold" style={{ color: '#00c8ff' }}>Cyan&#39;s Brooklynn</span>
          <span style={{ color: 'rgba(0,200,255,0.3)' }}>|</span>
          <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>Settings</span>
        </div>
        <Link to="/live-admin" className="text-sm transition-opacity hover:opacity-70" style={{ color: 'rgba(255,255,255,0.4)' }}>
          ← Admin
        </Link>
      </header>

      <div className="relative flex-1 overflow-y-auto pb-24" style={{ zIndex: 1 }}>
        <div className="max-w-[520px] mx-auto px-4 pt-8 pb-8">

          {/* Heading */}
          <div className="mb-6" style={fade(0)}>
            <div className="flex items-center gap-2 mb-3">
              <span
                className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest"
                style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }}
              >
                Admin Only
              </span>
              <span
                className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest"
                style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24' }}
              >
                Business Rules
              </span>
            </div>
            <h1 className="text-2xl font-extrabold mb-1.5" style={{ color: '#ffffff' }}>Platform Settings</h1>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Configure platform behavior, rules, and payout policies.
            </p>
          </div>

          {/* ── 1. QR Bag Rules ─────────────────────────────────── */}
          <div style={fade(60)}>
            <SectionCard title="QR Bag Rules" icon="📦">
              <SettingRow label="Default bag value" sublabel="Earned per bag scan">
                <NumInput value={bagRules.defaultValue} onChange={v => setBagRules(r => ({ ...r, defaultValue: v }))} prefix="$" step={0.01} min={0.01} />
              </SettingRow>
              <SettingRow label="Default CO₂ saved" sublabel="Pounds per bag">
                <NumInput value={bagRules.defaultCO2} onChange={v => setBagRules(r => ({ ...r, defaultCO2: v }))} step={0.1} min={0} />
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginLeft: 6 }}>lbs</span>
              </SettingRow>
              <SettingRow label="Default points" sublabel="Points per bag scan">
                <NumInput value={bagRules.defaultPoints} onChange={v => setBagRules(r => ({ ...r, defaultPoints: v }))} step={1} min={0} />
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginLeft: 6 }}>pts</span>
              </SettingRow>
              <SettingRow label="Max rescan attempts" sublabel="Per bag per day" divider={false}>
                <NumInput value={bagRules.maxRescanAttempts} onChange={v => setBagRules(r => ({ ...r, maxRescanAttempts: Math.max(1, Math.round(v)) }))} step={1} min={1} width={60} />
              </SettingRow>
            </SectionCard>
          </div>

          {/* ── 2. Fundraiser Rules ──────────────────────────────── */}
          <div style={fade(100)}>
            <SectionCard title="Fundraiser Rules" icon="🌱">
              <SettingRow label="Default fundraiser split" sublabel="Of each bag value credited to fundraiser">
                <NumInput value={frRules.defaultSplit} onChange={v => setFrRules(r => ({ ...r, defaultSplit: v }))} prefix="$" step={0.01} min={0} />
              </SettingRow>
              <SettingRow label="Minimum cash donation" sublabel="Lowest accepted cash contribution">
                <NumInput value={frRules.minCashDonation} onChange={v => setFrRules(r => ({ ...r, minCashDonation: v }))} prefix="$" step={1} min={1} />
              </SettingRow>
              <SettingRow label="Expired fundraisers block scans" sublabel="Scans won't count toward expired campaigns">
                <Toggle on={frRules.expiredBlockScans} onChange={v => setFrRules(r => ({ ...r, expiredBlockScans: v }))} />
              </SettingRow>
              <SettingRow label="Allow cash donations" sublabel="Users can contribute cash to any fundraiser" divider={false}>
                <Toggle on={frRules.allowCashDonations} onChange={v => setFrRules(r => ({ ...r, allowCashDonations: v }))} />
              </SettingRow>
            </SectionCard>
          </div>

          {/* ── 3. Wallet / Payout Rules ─────────────────────────── */}
          <div style={fade(140)}>
            <SectionCard title="Wallet / Payout Rules" icon="💳">
              <SettingRow label="Minimum payout amount" sublabel="Wallets below this threshold cannot request payout">
                <NumInput value={payRules.minPayoutAmount} onChange={v => setPayRules(r => ({ ...r, minPayoutAmount: v }))} prefix="$" step={1} min={1} />
              </SettingRow>
              <SettingRow label="Payout review required" sublabel="All requests go through admin approval">
                <Toggle on={payRules.reviewRequired} onChange={v => setPayRules(r => ({ ...r, reviewRequired: v }))} />
              </SettingRow>

              {/* Payout methods */}
              <div style={{ paddingTop: 12 }}>
                <p style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
                  Allowed payout methods
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(PAYOUT_METHOD_LABELS) as (keyof PayoutMethods)[]).map(key => {
                    const on = payRules.allowedMethods[key]
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => togglePayMethod(key)}
                        className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all text-left"
                        style={{
                          background: on ? 'rgba(74,222,128,0.1)'  : 'rgba(255,255,255,0.04)',
                          border:     on ? '1px solid rgba(74,222,128,0.35)' : '1px solid rgba(255,255,255,0.1)',
                          cursor:     'pointer',
                        }}
                      >
                        <span
                          style={{
                            width:        16,
                            height:       16,
                            borderRadius: 4,
                            background:   on ? '#4ade80' : 'transparent',
                            border:       `1.5px solid ${on ? '#4ade80' : 'rgba(255,255,255,0.3)'}`,
                            display:      'flex',
                            alignItems:   'center',
                            justifyContent: 'center',
                            flexShrink:   0,
                            fontSize:     9,
                            color:        '#000',
                            fontWeight:   900,
                          }}
                        >
                          {on ? '✓' : ''}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: on ? '#4ade80' : 'rgba(255,255,255,0.45)' }}>
                          {PAYOUT_METHOD_LABELS[key]}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </SectionCard>
          </div>

          {/* ── 4. Inspection Rules ──────────────────────────────── */}
          <div style={fade(180)}>
            <SectionCard title="Inspection Rules" icon="🔬">
              <SettingRow label="Green auto-approve" sublabel="Bags with green AI result are approved immediately">
                <Toggle on={inspRules.greenAutoApprove} onChange={v => setInspRules(r => ({ ...r, greenAutoApprove: v }))} />
              </SettingRow>
              <InfoRow
                icon="⚠️"
                text="Yellow bags are queued for manual rescan or admin review before approval"
                badge="System"
                badgeColor="#fbbf24"
                badgeBg="rgba(251,191,36,0.1)"
                badgeBorder="rgba(251,191,36,0.3)"
              />
              <InfoRow
                icon="🚫"
                text="Red bags trigger a contamination alert and cannot be approved without override"
                badge="System"
                badgeColor="#f87171"
                badgeBg="rgba(248,113,113,0.1)"
                badgeBorder="rgba(248,113,113,0.3)"
              />
              <SettingRow label="Allow manual override" sublabel="Admins can override any AI inspection result" divider={false}>
                <Toggle on={inspRules.manualOverrideAllowed} onChange={v => setInspRules(r => ({ ...r, manualOverrideAllowed: v }))} />
              </SettingRow>
            </SectionCard>
          </div>

          {/* ── 5. Demo Mode Protection ──────────────────────────── */}
          <div style={fade(220)}>
            <SectionCard
              title="Demo Mode Protection"
              icon="🔒"
              style={{ border: '1px solid rgba(74,222,128,0.22)' }}
            >
              <InfoRow
                icon="🎮"
                text="Demo mode is fully isolated and uses mock data — no Supabase writes occur"
                badge="Isolated"
                badgeColor="#4ade80"
                badgeBg="rgba(74,222,128,0.1)"
                badgeBorder="rgba(74,222,128,0.3)"
              />
              <InfoRow
                icon="🔐"
                text="Live app is powered exclusively by the Supabase production backend"
                badge="Live"
                badgeColor="#00c8ff"
                badgeBg="rgba(0,200,255,0.1)"
                badgeBorder="rgba(0,200,255,0.3)"
              />
              <InfoRow
                icon="🛡️"
                text="Demo sessions and live sessions never share auth, data, or wallet state"
                badge="Protected"
                badgeColor="#a78bfa"
                badgeBg="rgba(167,139,250,0.1)"
                badgeBorder="rgba(167,139,250,0.3)"
                divider={false}
              />
            </SectionCard>
          </div>

          {/* ── 6. Account & Privacy ─────────────────────────────── */}
          <div style={fade(240)}>
            <SectionCard title="Account & Privacy" icon="🔐">
              <Link
                to="/legal/privacy-policy"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 0', textDecoration: 'none',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  color: 'inherit',
                }}
              >
                <span style={{ fontSize: 13, color: '#fff' }}>📄 Privacy Policy</span>
                <span style={{ fontSize: 13, color: 'rgba(0,200,255,0.6)' }}>→</span>
              </Link>
              <Link
                to="/legal/terms-of-service"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 0', textDecoration: 'none',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  color: 'inherit',
                }}
              >
                <span style={{ fontSize: 13, color: '#fff' }}>📜 Terms of Service</span>
                <span style={{ fontSize: 13, color: 'rgba(0,200,255,0.6)' }}>→</span>
              </Link>
              <Link
                to="/compliance/documents"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 0', textDecoration: 'none',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  color: 'inherit',
                }}
              >
                <span>
                  <span style={{ fontSize: 13, color: '#fff' }}>📋 My documents</span>
                  <span style={{ display: 'block', fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                    Upload, review status, see expiration warnings.
                  </span>
                </span>
                <span style={{ fontSize: 13, color: 'rgba(0,200,255,0.6)' }}>→</span>
              </Link>
              <Link
                to="/legal/data-deletion"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 0', textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <span>
                  <span style={{ fontSize: 13, color: '#f87171', fontWeight: 600 }}>🗑️ Delete my account</span>
                  <span style={{ display: 'block', fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                    Permanent, requires admin review.
                  </span>
                </span>
                <span style={{ fontSize: 13, color: 'rgba(248,113,113,0.6)' }}>→</span>
              </Link>
            </SectionCard>
          </div>

          {/* ── Save ─────────────────────────────────────────────── */}
          <div className="flex flex-col gap-3" style={fade(260)}>
            <button
              type="button"
              onClick={handleSave}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold transition-all hover:brightness-110 active:scale-[0.98]"
              style={{
                background:  saved ? 'rgba(74,222,128,0.15)' : 'linear-gradient(135deg, #0057e7, #00c8ff)',
                border:      saved ? '1px solid rgba(74,222,128,0.4)' : 'none',
                color:       saved ? '#4ade80' : '#ffffff',
                boxShadow:   saved ? 'none' : '0 4px 24px rgba(0,190,255,0.3)',
                cursor:      'pointer',
                transition:  'all 0.25s ease',
              }}
            >
              {saved ? '✓ Settings saved' : '💾 Save Settings'}
            </button>

            {saved && (
              <p
                className="text-center"
                style={{ fontSize: 11, color: 'rgba(74,222,128,0.8)', fontWeight: 600 }}
              >
                Changes applied to in-session rules.
              </p>
            )}

            <Link
              to="/live-admin"
              className="w-full flex items-center justify-center py-3 rounded-2xl text-sm font-medium transition-all hover:brightness-110"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}
            >
              ← Back to Admin
            </Link>
          </div>

        </div>
      </div>
    </div>
  )
}
