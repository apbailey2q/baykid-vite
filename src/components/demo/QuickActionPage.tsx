// DEMO — full-screen overlay for all 10 quick-action pages
import { useState } from 'react'

export type QuickPage =
  | 'food-shop' | 'tools' | 'eco-tips' | 'jobs'
  | 'community' | 'supplies' | 'rewards' | 'messages'
  | 'profile' | 'recycling'

interface Props { page: QuickPage; onClose: () => void }

const A = '#00c8ff'
const S = '#4ade80'
const GL = 'rgba(255,255,255,0.06)'
const BD = 'rgba(0,190,255,0.15)'

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 16, padding: '14px 16px', ...style }}>
      {children}
    </div>
  )
}

function SectionLabel({ children }: { children: string }) {
  return <p style={{ fontSize: 11, color: 'rgba(0,210,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.09em', fontWeight: 500, marginBottom: 10 }}>{children}</p>
}

function CTAButton({ label, color = A }: { label: string; color?: string }) {
  return (
    <button style={{
      padding: '7px 14px', borderRadius: 10, cursor: 'pointer', fontSize: 12, fontWeight: 700,
      background: color === S ? 'rgba(74,222,128,0.15)' : 'rgba(0,200,255,0.12)',
      border: `1px solid ${color === S ? 'rgba(74,222,128,0.3)' : 'rgba(0,200,255,0.3)'}`,
      color: color,
    } as React.CSSProperties}>
      {label}
    </button>
  )
}

// ── Page content definitions ───────────────────────────────────────────────

function FoodShopPage() {
  const stores = [
    { icon: '🛒', name: 'Green Market Grocery', dist: '0.3 mi', tag: 'Eco-Friendly', desc: 'Locally sourced produce, bulk bins, zero-waste packaging.' },
    { icon: '🥗', name: 'Fresh & Local Co-op', dist: '0.6 mi', tag: 'Organic', desc: 'Member-owned co-op with organic meats, dairy, and produce.' },
    { icon: '♻️', name: 'EcoMart Brooklyn',     dist: '1.1 mi', tag: 'Zero Waste',  desc: 'Refillable cleaning supplies, compostable bags, bulk goods.' },
    { icon: '🍕', name: 'The Green Fork Café',  dist: '0.4 mi', tag: 'Vegan',       desc: 'Plant-based meals made from locally sourced ingredients.' },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <SectionLabel>Nearby Eco-Friendly Stores</SectionLabel>
      {stores.map(s => (
        <Card key={s.name}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <span style={{ fontSize: 28, flexShrink: 0 }}>{s.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{s.name}</p>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{s.dist}</span>
              </div>
              <span style={{ fontSize: 10, fontWeight: 600, color: S, background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 6, padding: '1px 7px' }}>{s.tag}</span>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 6, lineHeight: 1.5 }}>{s.desc}</p>
              <div style={{ marginTop: 8 }}><CTAButton label="View Store" /></div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

function ToolsPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionLabel>Recycling Tools</SectionLabel>
      <Card>
        <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 6 }}>📱 Bag QR Scanner</p>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>Use your phone camera to scan any BayKid recycling bag QR code. Scanning logs your bag and alerts the nearest driver for pickup.</p>
        <div style={{ marginTop: 10 }}><CTAButton label="Open Scanner" /></div>
      </Card>
      <Card>
        <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 8 }}>✅ Pickup Checklist</p>
        {['Bag is tied securely', 'QR code is visible', 'Bag weight under 30 lbs', 'No hazardous materials', 'Placed at pickup location'].map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: i < 4 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
            <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(74,222,128,0.15)', border: '1.5px solid rgba(74,222,128,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={S} strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{item}</span>
          </div>
        ))}
      </Card>
      <Card>
        <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 6 }}>📦 Bag Prep Guide</p>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>Rinse containers, remove lids, and flatten cardboard before placing in your BayKid bag. Clean recyclables = faster processing = more points.</p>
      </Card>
    </div>
  )
}

function EcoTipsPage() {
  const tips = [
    { icon: '🧼', title: 'Rinse Before Recycling', body: 'Even a quick rinse removes food residue that can contaminate an entire load. Saves processing time and earns you a quality bonus.' },
    { icon: '📦', title: 'Flatten Your Cardboard', body: 'Flattened boxes take up less space in your bag, letting you fit more. This directly increases your payout per pickup.' },
    { icon: '🚫', title: 'No Plastic Bags', body: 'Plastic film (grocery bags, wrap) cannot be processed in standard recycling. They jam machinery. Use dedicated plastic film drop-off bins instead.' },
    { icon: '🔢', title: 'Check the Number', body: 'Look for the resin code (1–7) on plastic items. Types 1 (PET) and 2 (HDPE) are universally accepted. Avoid types 3, 6, and 7 when possible.' },
    { icon: '🍾', title: 'Glass Goes Separate', body: 'Glass is heavy and can break equipment. BayKid handles glass separately — request a glass-only pickup for bottles and jars.' },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <SectionLabel>Recycling Tips</SectionLabel>
      {tips.map(t => (
        <Card key={t.title}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 24, flexShrink: 0 }}>{t.icon}</span>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{t.title}</p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>{t.body}</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

function JobsPage() {
  const jobs = [
    { icon: '🚐', title: 'Pickup Driver', pay: '$18–24/hr', type: 'Part-time / Full-time', desc: 'Drive a designated route, collect BayKid bags, deliver to warehouse. Flexible hours, vehicle provided.' },
    { icon: '🏭', title: 'Warehouse Associate', pay: '$16–20/hr', type: 'Full-time', desc: 'Sort, inspect, and process recycling materials at our Brooklyn facility. No experience required — training provided.' },
    { icon: '🌍', title: 'Community Coordinator', pay: '$20–26/hr', type: 'Full-time', desc: 'Onboard new neighborhoods, run events, manage local partner accounts. Great communication skills required.' },
    { icon: '📱', title: 'App Support Specialist', pay: '$17–22/hr', type: 'Part-time', desc: 'Help consumers, drivers, and partners resolve app issues. Remote-friendly role.' },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <SectionLabel>Open Positions</SectionLabel>
      {jobs.map(j => (
        <Card key={j.title}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 26, flexShrink: 0 }}>{j.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{j.title}</p>
                <span style={{ fontSize: 12, fontWeight: 700, color: S }}>{j.pay}</span>
              </div>
              <p style={{ fontSize: 11, color: A, marginTop: 2, marginBottom: 6 }}>{j.type}</p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>{j.desc}</p>
              <div style={{ marginTop: 8 }}><CTAButton label="Apply Now" color={S} /></div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

function CommunityPage() {
  const events = [
    { icon: '🧹', name: 'Brooklyn Cleanup Day', date: 'Sat May 10 · 9am', loc: 'Prospect Park', desc: 'Join 200+ volunteers for our monthly neighborhood cleanup.' },
    { icon: '♻️', name: 'Recycling Drive', date: 'Sun May 18 · 10am', loc: 'Atlantic Ave', desc: 'Drop off electronics, batteries, and hard-to-recycle items free of charge.' },
    { icon: '🌱', name: 'Community Garden Day', date: 'Sat May 24 · 8am', loc: 'Crown Heights', desc: 'Help plant eco-friendly gardens while learning composting techniques.' },
  ]
  const partners = ['Green Brooklyn Alliance', 'EcoHub NYC', 'Brooklyn Compost Co.', 'Zero Waste Schools NYC']
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionLabel>Upcoming Events</SectionLabel>
      {events.map(e => (
        <Card key={e.name}>
          <div style={{ display: 'flex', gap: 12 }}>
            <span style={{ fontSize: 24, flexShrink: 0 }}>{e.icon}</span>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{e.name}</p>
              <p style={{ fontSize: 11, color: A, marginTop: 2 }}>{e.date} · {e.loc}</p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 4, lineHeight: 1.5 }}>{e.desc}</p>
              <div style={{ marginTop: 8 }}><CTAButton label="RSVP" /></div>
            </div>
          </div>
        </Card>
      ))}
      <SectionLabel>Partner Organizations</SectionLabel>
      {partners.map(p => (
        <Card key={p} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px' }}>
          <span style={{ fontSize: 13, color: '#fff', fontWeight: 500 }}>🤝 {p}</span>
          <CTAButton label="Visit" />
        </Card>
      ))}
    </div>
  )
}

function SuppliesPage() {
  const items = [
    { icon: '🛍️', name: 'QR Recycling Bags (10-pack)', price: 'Free with 5 pickups', desc: 'Pre-coded BayKid bags. Each bag earns up to $5 when processed.' },
    { icon: '🧤', name: 'Recycling Gloves', price: '$4.99', desc: 'Durable reusable gloves for safe sorting. Fits most adult hand sizes.' },
    { icon: '🏷️', name: 'Extra QR Labels (20-pack)', price: '$2.99', desc: 'Stick-on QR labels for unlabeled containers or replacement codes.' },
    { icon: '🗑️', name: 'Pickup Bin (14-gal)', price: '$12.99', desc: 'Weather-resistant curbside bin. Holds 4–6 filled BayKid bags.' },
    { icon: '🦺', name: 'Safety Vest (Hi-Vis)', price: '$8.99', desc: 'For high-visibility sorting. Required for warehouse volunteer events.' },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <SectionLabel>Order Supplies</SectionLabel>
      {items.map(item => (
        <Card key={item.name}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 26, flexShrink: 0 }}>{item.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', flex: 1, marginRight: 8 }}>{item.name}</p>
                <span style={{ fontSize: 12, fontWeight: 700, color: S, flexShrink: 0 }}>{item.price}</span>
              </div>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 4, lineHeight: 1.5 }}>{item.desc}</p>
              <div style={{ marginTop: 8 }}><CTAButton label="Order" color={S} /></div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

function RewardsPage() {
  const options = [
    { icon: '💳', name: 'Cash Transfer', rate: '$1 per 10 pts', desc: 'Transfer earnings directly to your bank or Cash App.' },
    { icon: '🎁', name: 'Gift Cards', rate: '$5 gift cards', desc: 'Amazon, Walmart, Target, and more. Instant delivery.' },
    { icon: '🌱', name: 'Plant a Tree', rate: '50 pts = 1 tree', desc: 'Donate your points to reforestation projects worldwide.' },
    { icon: '🏷️', name: 'Supply Credits', rate: '20 pts = free bag', desc: 'Redeem for free BayKid bags, gloves, or labels.' },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card style={{ textAlign: 'center', padding: '20px 16px' }}>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: 4 }}>Available Balance</p>
        <p style={{ fontSize: 40, fontWeight: 800, color: S }}>$0.00</p>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>Complete pickups to earn</p>
      </Card>
      <SectionLabel>Redemption Options</SectionLabel>
      {options.map(o => (
        <Card key={o.name}>
          <div style={{ display: 'flex', gap: 12 }}>
            <span style={{ fontSize: 24, flexShrink: 0 }}>{o.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{o.name}</p>
                <span style={{ fontSize: 11, color: A }}>{o.rate}</span>
              </div>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>{o.desc}</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

function MessagesPage() {
  const threads = [
    { avatar: '🏭', name: 'Warehouse Team', time: '2h ago', preview: 'Your bag BAG-2026-001 has been processed.', unread: true },
    { avatar: '🚐', name: 'Driver Marcus W.', time: '4h ago', preview: 'On my way — ETA 10 minutes.', unread: false },
    { avatar: '📢', name: 'BayKid Updates', time: 'Yesterday', preview: 'New pickup zones now available in Crown Heights!', unread: false },
  ]
  const [active, setActive] = useState<string | null>(null)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <SectionLabel>Conversations</SectionLabel>
      {threads.map(t => (
        <button
          key={t.name}
          onClick={() => setActive(t.name === active ? null : t.name)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}
        >
          <Card style={{
            display: 'flex', gap: 12, alignItems: 'center',
            border: active === t.name ? `1px solid rgba(0,200,255,0.4)` : `1px solid ${BD}`,
          }}>
            <span style={{ fontSize: 26, flexShrink: 0 }}>{t.avatar}</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{t.name}</p>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{t.time}</span>
              </div>
              <p style={{ fontSize: 12, color: t.unread ? A : 'rgba(255,255,255,0.4)', marginTop: 2 }}>{t.preview}</p>
            </div>
            {t.unread && <div style={{ width: 8, height: 8, borderRadius: '50%', background: A, flexShrink: 0 }}/>}
          </Card>
        </button>
      ))}
      {active && (
        <Card style={{ marginTop: 4 }}>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>Tap to reply — messaging coming soon</p>
        </Card>
      )}
    </div>
  )
}

function ProfilePage() {
  const stats = [
    { label: 'Bags Submitted', value: '0' },
    { label: 'Total Earned', value: '$0.00' },
    { label: 'lbs Recycled', value: '0' },
    { label: 'CO₂ Reduced', value: '0 kg' },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '20px 16px' }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: 'linear-gradient(135deg,rgba(0,87,231,0.5),rgba(0,200,255,0.3))',
          border: '2px solid rgba(0,200,255,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24, fontWeight: 800, color: '#fff',
        }}>DC</div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>Dev Consumer</p>
          <p style={{ fontSize: 12, color: A }}>Consumer · Member since 2026</p>
        </div>
      </Card>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {stats.map(s => (
          <Card key={s.label} style={{ textAlign: 'center', padding: '12px 10px' }}>
            <p style={{ fontSize: 22, fontWeight: 800, color: A }}>{s.value}</p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 3 }}>{s.label}</p>
          </Card>
        ))}
      </div>
      <SectionLabel>Account Settings</SectionLabel>
      {['Edit Profile', 'Notification Preferences', 'Privacy & Security', 'Help & Support'].map(item => (
        <Card key={item} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px' }}>
          <span style={{ fontSize: 13, color: '#fff' }}>{item}</span>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 16 }}>›</span>
        </Card>
      ))}
    </div>
  )
}

function RecyclingPage() {
  const materials = [
    { color: '#38bdf8', label: 'Plastics #1 & #2', examples: 'Water bottles, milk jugs, detergent containers', ok: true },
    { color: '#4ade80', label: 'Cardboard & Paper', examples: 'Flattened boxes, newspapers, office paper', ok: true },
    { color: '#facc15', label: 'Glass (separate)',  examples: 'Bottles, jars — request glass pickup separately', ok: true },
    { color: '#fb923c', label: 'Metals',            examples: 'Aluminum cans, steel cans, foil (clean)', ok: true },
    { color: '#f87171', label: 'Plastic Film',      examples: 'Grocery bags, wrap — drop-off bin only', ok: false },
    { color: '#f87171', label: 'Styrofoam',         examples: 'Coffee cups, packing foam — NOT accepted', ok: false },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <SectionLabel>Materials Guide</SectionLabel>
      {materials.map(m => (
        <Card key={m.label} style={{ border: `1px solid ${m.color}30`, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: m.color, marginTop: 4, flexShrink: 0 }}/>
          <div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 3 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{m.label}</p>
              <span style={{ fontSize: 10, fontWeight: 700, color: m.ok ? S : '#f87171', background: m.ok ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)', border: `1px solid ${m.ok ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)'}`, borderRadius: 6, padding: '1px 6px' }}>
                {m.ok ? '✓ Accepted' : '✗ Not accepted'}
              </span>
            </div>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>{m.examples}</p>
          </div>
        </Card>
      ))}
      <Card style={{ background: 'rgba(0,200,255,0.06)', border: '1px solid rgba(0,200,255,0.2)', marginTop: 4 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: A, marginBottom: 4 }}>💡 Contamination tip</p>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>One contaminated item can reject an entire bag. When in doubt, throw it out — or ask via the app before your pickup.</p>
      </Card>
    </div>
  )
}

// ── Page metadata ──────────────────────────────────────────────────────────────
const PAGE_META: Record<QuickPage, { title: string; icon: string }> = {
  'food-shop': { title: 'Food & Shop',  icon: '🛒' },
  'tools':     { title: 'Tools',        icon: '🔧' },
  'eco-tips':  { title: 'Eco Tips',     icon: '🌱' },
  'jobs':      { title: 'Jobs',         icon: '💼' },
  'community': { title: 'Community',    icon: '🏘️' },
  'supplies':  { title: 'Supplies',     icon: '📦' },
  'rewards':   { title: 'Rewards',      icon: '🎁' },
  'messages':  { title: 'Messages',     icon: '💬' },
  'profile':   { title: 'Profile',      icon: '👤' },
  'recycling': { title: 'Recycling',    icon: '♻️' },
}

const PAGE_CONTENT: Record<QuickPage, React.FC> = {
  'food-shop': FoodShopPage,
  'tools':     ToolsPage,
  'eco-tips':  EcoTipsPage,
  'jobs':      JobsPage,
  'community': CommunityPage,
  'supplies':  SuppliesPage,
  'rewards':   RewardsPage,
  'messages':  MessagesPage,
  'profile':   ProfilePage,
  'recycling': RecyclingPage,
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function QuickActionPage({ page, onClose }: Props) {
  const meta = PAGE_META[page]
  const Content = PAGE_CONTENT[page]

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'linear-gradient(180deg,#060e24 0%,#040a1a 100%)', animation: 'fadeSlideUp 0.25s ease both' }}
    >
      {/* Grid overlay */}
      <div className="pointer-events-none absolute inset-0 grid-bg" style={{ opacity: 0.5 }} />

      {/* Header */}
      <header
        className="relative z-10 shrink-0 flex items-center justify-between px-4 py-3"
        style={{ background: 'rgba(6,14,36,0.92)', borderBottom: `1px solid ${BD}`, backdropFilter: 'blur(20px)' }}
      >
        <button
          onClick={onClose}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
            cursor: 'pointer', color: 'rgba(0,200,255,0.7)', fontSize: 13, fontWeight: 600, padding: 0,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
          Back
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>{meta.icon}</span>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{meta.title}</p>
        </div>
        <div style={{ width: 52 }} />
      </header>

      {/* Scrollable content */}
      <div className="relative z-10 flex-1 overflow-y-auto" style={{ padding: '16px', maxWidth: 430, margin: '0 auto', width: '100%' }}>
        <Content />
      </div>
    </div>
  )
}
