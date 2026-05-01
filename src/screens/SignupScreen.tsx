import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { signUp, AUTO_APPROVED_ROLES } from '../lib/auth'
import { LogoBadge } from '../components/ui'
import type { Role } from '../types'

const ROLE_OPTIONS: { value: Role; label: string; icon: string; desc: string }[] = [
  { value: 'consumer',             icon: '♻️', label: 'Consumer',            desc: 'Recycle bags & earn rewards'   },
  { value: 'driver',               icon: '🚗', label: 'Driver',               desc: 'Pickup & deliver bags'         },
  { value: 'warehouse_employee',   icon: '📦', label: 'Warehouse Employee',   desc: 'Inspect & process bags'        },
  { value: 'warehouse_supervisor', icon: '🏭', label: 'Warehouse Supervisor', desc: 'Oversee warehouse operations'  },
  { value: 'partner',              icon: '🤝', label: 'Partner',              desc: 'Business partner access'       },
  { value: 'admin',                icon: '⚙️', label: 'Administrator',        desc: 'Manage users & operations'     },
]

export default function SignupScreen() {
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole]         = useState<Role>('consumer')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [roleOpen, setRoleOpen] = useState(false)

  const needsApproval = !AUTO_APPROVED_ROLES.includes(role)
  const selectedOption = ROLE_OPTIONS.find((o) => o.value === role)!

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signUp(email, password, fullName, role)
      navigate(needsApproval ? '/pending-approval' : '/')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign up failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center px-5 py-12 overflow-hidden" style={{ background: '#060e24' }}>

      {/* Grid overlay */}
      <div className="pointer-events-none absolute inset-0 grid-bg" style={{ zIndex: 0 }} />

      {/* Orb 1 */}
      <div className="pointer-events-none absolute" style={{ top: -60, left: -40, width: 220, height: 220, background: 'rgba(0,100,255,0.4)', filter: 'blur(52px)', borderRadius: '50%', zIndex: 0 }} />

      {/* Orb 2 */}
      <div className="pointer-events-none absolute" style={{ bottom: -20, right: -30, width: 180, height: 180, background: 'rgba(0,190,255,0.3)', filter: 'blur(52px)', borderRadius: '50%', zIndex: 0 }} />

      {/* Content */}
      <div className="relative w-full max-w-sm flex flex-col items-center" style={{ zIndex: 1, animation: 'fadeSlideUp 0.35s ease both' }}>

        <LogoBadge size="xl" />
        <div className="mt-5 text-center">
          <h1 className="text-3xl tracking-tight" style={{ color: '#ffffff', fontWeight: 500 }}>
            Cyan's Brooklynn
          </h1>
          <p className="section-label mt-1.5">Recycling Enterprise</p>
        </div>

        {/* Card */}
        <div
          className="mt-8 w-full p-7"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(0,190,255,0.15)',
            borderRadius: 16,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        >
          <h2 className="mb-6 text-lg" style={{ color: '#ffffff', fontWeight: 500 }}>
            Create an account
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">

            <div className="space-y-1.5">
              <label className="section-label block">Full name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Smith"
                className="input-glow w-full px-4 py-3 text-sm outline-none transition-all duration-200"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(0,190,255,0.2)',
                  borderRadius: 12,
                  color: '#ffffff',
                }}
              />
            </div>

            <div className="space-y-1.5">
              <label className="section-label block">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="input-glow w-full px-4 py-3 text-sm outline-none transition-all duration-200"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(0,190,255,0.2)',
                  borderRadius: 12,
                  color: '#ffffff',
                }}
              />
            </div>

            <div className="space-y-1.5">
              <label className="section-label block">Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input-glow w-full px-4 py-3 text-sm outline-none transition-all duration-200"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(0,190,255,0.2)',
                  borderRadius: 12,
                  color: '#ffffff',
                }}
              />
            </div>

            {/* Role picker */}
            <div className="space-y-1.5">
              <label className="section-label block">Role</label>

              <button
                type="button"
                onClick={() => setRoleOpen((o) => !o)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left transition-all duration-200"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: roleOpen ? '1px solid rgba(0,200,255,0.45)' : '1px solid rgba(0,190,255,0.2)',
                  borderRadius: 12,
                  boxShadow: roleOpen ? '0 0 0 3px rgba(0,200,255,0.08)' : 'none',
                }}
              >
                <span className="text-lg leading-none shrink-0">{selectedOption.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm" style={{ color: '#ffffff', fontWeight: 500 }}>{selectedOption.label}</p>
                  <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>{selectedOption.desc}</p>
                </div>
                <svg
                  width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="rgba(255,255,255,0.35)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  className="shrink-0 transition-transform duration-200"
                  style={{ transform: roleOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              {roleOpen && (
                <div
                  className="overflow-hidden"
                  style={{
                    background: 'rgba(6,14,36,0.98)',
                    border: '1px solid rgba(0,190,255,0.15)',
                    borderRadius: 12,
                    backdropFilter: 'blur(20px)',
                    boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
                  }}
                >
                  {ROLE_OPTIONS.map((opt) => {
                    const selected = role === opt.value
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => { setRole(opt.value); setRoleOpen(false) }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-all duration-150 hover:bg-white/5"
                        style={{
                          background: selected ? 'rgba(0,200,255,0.08)' : 'transparent',
                          borderBottom: '1px solid rgba(255,255,255,0.05)',
                        }}
                      >
                        <span className="text-base leading-none shrink-0">{opt.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm" style={{ color: selected ? '#00c8ff' : '#ffffff', fontWeight: 500 }}>{opt.label}</p>
                          <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>{opt.desc}</p>
                        </div>
                        {selected && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00c8ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}

              {needsApproval && (
                <div
                  className="flex items-center gap-2 px-3 py-2"
                  style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)', borderRadius: 10 }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#facc15" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                  <p className="text-xs" style={{ color: '#facc15' }}>Requires admin approval before access.</p>
                </div>
              )}
            </div>

            {error && (
              <div
                className="px-4 py-2.5 text-sm"
                style={{
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.25)',
                  borderRadius: 12,
                  color: '#f87171',
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 w-full flex items-center justify-center gap-2 py-3.5 text-sm text-white transition-all duration-200 hover:brightness-110 active:scale-[0.97] disabled:opacity-50"
              style={{
                background: 'linear-gradient(135deg, #0057e7, #00c8ff)',
                border: 'none',
                borderRadius: 14,
                fontWeight: 500,
                boxShadow: '0 4px 20px rgba(0,190,255,0.3)',
              }}
            >
              {loading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              ) : (
                <>
                  Create account
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </>
              )}
            </button>
          </form>
        </div>

        <p className="mt-8 text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Already have an account?{' '}
          <Link to="/login" className="transition-opacity hover:opacity-80" style={{ color: '#00c8ff', fontWeight: 500 }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
