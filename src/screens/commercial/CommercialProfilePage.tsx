import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuthStore } from '../../store/authStore'

const ACCENT = '#00c8ff'

export default function CommercialProfilePage() {
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()
  const [account, setAccount] = useState<Record<string, string> | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({
    business_name:  '',
    contact_email:  '',
    contact_phone:  '',
    billing_address:'',
    industry_type:  '',
    notes:          '',
  })

  useEffect(() => {
    if (!user?.id) return
    supabase
      .from('commercial_accounts')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setAccount(data as Record<string, string>)
          setForm({
            business_name:   data.business_name   ?? profile?.full_name ?? '',
            contact_email:   data.contact_email   ?? user.email ?? '',
            contact_phone:   data.contact_phone   ?? '',
            billing_address: data.billing_address ?? '',
            industry_type:   data.industry_type   ?? '',
            notes:           data.notes           ?? '',
          })
        }
        setLoading(false)
      })
  }, [user?.id, profile?.full_name, user?.email])

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm(prev => ({ ...prev, [field]: e.target.value }))
      setSaved(false)
    }
  }

  async function handleSave() {
    if (!user?.id) return
    const upsert = { ...form, user_id: user.id, ...(account?.id ? { id: account.id } : {}) }
    await supabase.from('commercial_accounts').upsert(upsert)
    setSaved(true)
    setEditing(false)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 14px', borderRadius: 12,
    background: editing ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
    border: `1px solid ${editing ? 'rgba(0,200,255,0.3)' : 'rgba(255,255,255,0.09)'}`,
    color: '#fff', fontSize: 14, outline: 'none',
  }

  const FIELDS: { key: keyof typeof form; label: string; placeholder: string; multiline?: boolean }[] = [
    { key: 'business_name',   label: 'Business Name',   placeholder: 'Acme Corp' },
    { key: 'contact_email',   label: 'Contact Email',   placeholder: 'ops@acme.com' },
    { key: 'contact_phone',   label: 'Contact Phone',   placeholder: '+1 555-000-0000' },
    { key: 'billing_address', label: 'Billing Address', placeholder: '123 Industrial Blvd, City, ST 00000' },
    { key: 'industry_type',   label: 'Industry Type',   placeholder: 'e.g. Manufacturing, Retail, Hospitality' },
    { key: 'notes',           label: 'Special Notes',   placeholder: 'Access instructions, contacts, preferences…', multiline: true },
  ]

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}>
      <header className="flex items-center gap-3 px-4 py-3 shrink-0" style={{ background: 'rgba(4,10,24,0.94)', borderBottom: '1px solid rgba(0,200,255,0.12)', backdropFilter: 'blur(12px)' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>← Back</button>
        <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: '#fff', textAlign: 'center' }}>Account Profile</span>
        <button
          onClick={() => editing ? handleSave() : setEditing(true)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: ACCENT, fontSize: 13, fontWeight: 700 }}
        >
          {editing ? 'Save' : 'Edit'}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5 pb-24 max-w-xl mx-auto w-full">

        {/* Avatar / business badge */}
        <div className="flex items-center gap-4 mb-6 px-4 py-4 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black" style={{ background: 'linear-gradient(135deg,#0057e7,#00c8ff)', color: '#fff' }}>
            {(form.business_name || 'B').charAt(0).toUpperCase()}
          </div>
          <div>
            <p style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{form.business_name || 'Your Business'}</p>
            <p style={{ fontSize: 11, color: ACCENT, fontWeight: 600, marginTop: 2 }}>Commercial Account</p>
            {account?.plan_name && (
              <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80' }}>{account.plan_name}</span>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-7 h-7 rounded-full border-4 animate-spin" style={{ borderColor: 'rgba(0,200,255,0.2)', borderTopColor: ACCENT }} />
          </div>
        ) : (
          <>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>Account Information</p>

            <div className="flex flex-col gap-4 mb-6">
              {FIELDS.map(f => (
                <div key={f.key}>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                    {f.label}
                  </label>
                  {f.multiline ? (
                    <textarea
                      style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }}
                      value={form[f.key]}
                      onChange={set(f.key)}
                      placeholder={f.placeholder}
                      disabled={!editing}
                    />
                  ) : (
                    <input
                      style={inputStyle}
                      value={form[f.key]}
                      onChange={set(f.key)}
                      placeholder={f.placeholder}
                      disabled={!editing}
                    />
                  )}
                </div>
              ))}
            </div>

            {saved && (
              <div className="rounded-xl px-4 py-3 mb-4 text-center" style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80', fontSize: 13, fontWeight: 700 }}>
                ✓ Profile saved
              </div>
            )}

            {editing && (
              <button
                onClick={handleSave}
                className="w-full py-4 rounded-2xl font-bold text-sm text-white transition-all hover:brightness-110 active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg,#0057e7,#00c8ff)', boxShadow: '0 4px 20px rgba(0,190,255,0.35)' }}
              >
                Save Profile
              </button>
            )}

            {/* Danger zone */}
            <div className="mt-8 rounded-2xl px-4 py-4" style={{ border: '1px solid rgba(248,113,113,0.2)' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(248,113,113,0.6)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Support</p>
              {[
                { label: 'Contact Dispatch', sub: 'Reach your service coordinator', icon: '📞' },
                { label: 'Request Account Review', sub: 'Update plan or service terms', icon: '📋' },
                { label: 'Pause Service', sub: 'Temporarily suspend pickups', icon: '⏸' },
              ].map(item => (
                <button
                  key={item.label}
                  className="flex items-center gap-3 w-full py-3 text-left"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                >
                  <span style={{ fontSize: 18 }}>{item.icon}</span>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>{item.label}</p>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{item.sub}</p>
                  </div>
                  <span style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.25)', fontSize: 14 }}>›</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
