// SchedulePicker.tsx — shared schedule picker for AI Marketing.
// Extracted from screens/admin/ai-marketing/ContentCalendar.tsx so
// ApprovalQueue / CreativeStudio / SocialPostGenerator can import it
// without depending on the calendar screen.

export const TIMEZONES = [
  { value: 'America/New_York',    label: 'ET — Eastern Time'  },
  { value: 'America/Chicago',     label: 'CT — Central Time'  },
  { value: 'America/Denver',      label: 'MT — Mountain Time' },
  { value: 'America/Phoenix',     label: 'MT — Mountain (AZ)' },
  { value: 'America/Los_Angeles', label: 'PT — Pacific Time'  },
  { value: 'America/Anchorage',   label: 'AKT — Alaska Time'  },
  { value: 'Pacific/Honolulu',    label: 'HT — Hawaii Time'   },
  { value: 'UTC',                 label: 'UTC'                },
]

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
  color: '#fff', borderRadius: 8, padding: '8px 12px', fontSize: 12,
  outline: 'none', width: '100%', boxSizing: 'border-box',
}

const ghostBtn: React.CSSProperties = {
  background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)',
  color: 'rgba(255,255,255,0.65)', borderRadius: 8, padding: '6px 12px',
  fontWeight: 600, fontSize: 11, cursor: 'pointer',
}

export interface SchedulePickerProps {
  value:            string
  timezone:         string
  onValueChange:    (v: string) => void
  onTimezoneChange: (tz: string) => void
  onConfirm:        () => void
  onCancel:         () => void
}

export function SchedulePicker({ value, timezone, onValueChange, onTimezoneChange, onConfirm, onCancel }: SchedulePickerProps) {
  return (
    <div style={{ background: 'rgba(0,200,255,0.05)', border: '1px solid rgba(0,200,255,0.18)', borderRadius: 12, padding: 16 }}>
      <div style={{ color: '#00c8ff', fontSize: 11, fontWeight: 700, marginBottom: 12 }}>📅 Set Publish Date &amp; Time</div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 700, display: 'block', marginBottom: 4 }}>Date &amp; Time</label>
          <input type="datetime-local" style={{ ...inputStyle, colorScheme: 'dark' }}
            value={value} onChange={(e) => onValueChange(e.target.value)} />
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 700, display: 'block', marginBottom: 4 }}>Timezone</label>
          <select style={inputStyle} value={timezone} onChange={(e) => onTimezoneChange(e.target.value)}>
            {TIMEZONES.map((tz) => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onConfirm} disabled={!value}
          style={{ background: 'rgba(0,200,255,0.15)', border: '1px solid rgba(0,200,255,0.35)', color: '#00c8ff',
            borderRadius: 8, padding: '7px 18px', fontWeight: 700, fontSize: 12, cursor: value ? 'pointer' : 'not-allowed', opacity: value ? 1 : 0.5 }}>
          Confirm Schedule
        </button>
        <button onClick={onCancel} style={ghostBtn}>Cancel</button>
      </div>
    </div>
  )
}
