import { CommercialLayout } from './CommercialLayout'
import { GlassCard } from '../../components/ui/GlassCard'
import { PrimaryButton } from '../../components/ui/PrimaryButton'
import { StatusBadge } from '../../components/ui/StatusBadge'

const SCHEDULE = [
  { day: 'Monday',    active: true,  window: '6 AM – 10 AM',  next: 'May 19' },
  { day: 'Wednesday', active: true,  window: '6 AM – 10 AM',  next: 'May 21' },
  { day: 'Friday',    active: true,  window: '10 AM – 2 PM',  next: 'May 23' },
  { day: 'Tuesday',   active: false, window: '—',             next: '—'      },
  { day: 'Thursday',  active: false, window: '—',             next: '—'      },
  { day: 'Saturday',  active: false, window: '—',             next: '—'      },
  { day: 'Sunday',    active: false, window: '—',             next: '—'      },
]

export default function CommercialSchedule() {
  return (
    <CommercialLayout>
      <div className="px-4 pt-4">

        <p style={{ fontSize: 22, fontWeight: 900, color: '#fff', marginBottom: 4 }}>Service Schedule</p>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 16 }}>Your recurring pickup windows and next dates.</p>

        {/* Current plan card */}
        <GlassCard variant="accent" padding="lg" glow className="mb-5">
          <div className="flex items-center justify-between">
            <div>
              <p style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>Weekly Commercial Service</p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>3× per week · Mon, Wed, Fri</p>
            </div>
            <StatusBadge variant="green" label="Active" dot />
          </div>
        </GlassCard>

        {/* Schedule list */}
        <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Pickup Days</p>
        <div className="flex flex-col gap-2.5 mb-6">
          {SCHEDULE.map(s => (
            <GlassCard key={s.day} padding="md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: s.active ? '#4ade80' : 'rgba(255,255,255,0.2)' }}
                  />
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: s.active ? '#fff' : 'rgba(255,255,255,0.35)' }}>{s.day}</p>
                    {s.active && (
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>🕐 {s.window}</p>
                    )}
                  </div>
                </div>
                {s.active
                  ? <span style={{ fontSize: 11, color: '#00c8ff', fontWeight: 600 }}>Next: {s.next}</span>
                  : <StatusBadge variant="gray" label="Off" size="sm" />
                }
              </div>
            </GlassCard>
          ))}
        </div>

        <GlassCard padding="md" className="mb-4">
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
            📅 Schedule changes take effect next billing cycle. Contact dispatch to modify your plan.
          </p>
        </GlassCard>

        <PrimaryButton fullWidth size="lg">
          Contact Dispatch to Update Schedule
        </PrimaryButton>
      </div>
    </CommercialLayout>
  )
}
