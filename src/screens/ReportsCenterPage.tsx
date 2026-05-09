import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

// ── Types ──────────────────────────────────────────────────────────────────────

type ReportStatus = 'Draft' | 'Submitted' | 'Approved'
type RAGColor     = 'Green' | 'Yellow' | 'Red'

interface Report {
  name:       string
  dateRange:  string
  city:       string
  department: string
  status:     ReportStatus
  rag:        RAGColor
  approval:   string
}

interface CategoryData {
  id:      string
  label:   string
  icon:    string
  accent:  string
  reports: Report[]
}

// ── Style helpers ──────────────────────────────────────────────────────────────

function ragStyle(rag: RAGColor) {
  if (rag === 'Green')  return { color: '#4ade80', bg: 'rgba(34,197,94,0.12)',   border: 'rgba(34,197,94,0.3)'   }
  if (rag === 'Yellow') return { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.3)'  }
  return                       { color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.3)' }
}

function statusStyle(status: ReportStatus) {
  if (status === 'Approved')  return { color: '#4ade80',              bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.28)'  }
  if (status === 'Submitted') return { color: '#fbbf24',              bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.28)' }
  return                             { color: 'rgba(255,255,255,0.45)', bg: 'rgba(255,255,255,0.08)', border: 'rgba(255,255,255,0.15)' }
}

// ── Data helper ────────────────────────────────────────────────────────────────

function r(
  name:       string,
  status:     ReportStatus = 'Draft',
  rag:        RAGColor     = 'Green',
  city                     = 'Nashville, TN',
  department               = 'Operations',
  dateRange                = 'May 1–31, 2026',
  approval                 = 'Pending Signature',
): Report {
  return { name, status, rag, city, department, dateRange, approval }
}

// ── Mock data ──────────────────────────────────────────────────────────────────

const CATEGORIES: CategoryData[] = [
  {
    id: 'investor', label: 'Investor Reports', icon: '📈', accent: '#00c8ff',
    reports: [
      r('Quarterly Investor Report',   'Submitted', 'Green',  'Nashville, TN', 'Finance',    'Q1 2026',   'Signed'      ),
      r('Annual Investor Report',      'Approved',  'Green',  'Nashville, TN', 'Finance',    'FY 2025',   'Signed'      ),
      r('Investor Update Letter',      'Draft',     'Green',  'Nashville, TN', 'Executive',  'May 2026'                 ),
      r('Financial Snapshot',          'Submitted', 'Yellow', 'Nashville, TN', 'Finance',    'Apr 2026',  'Under Review'),
      r('Cap Table / Ownership Update','Draft',     'Green',  'Nashville, TN', 'Legal',      'May 2026'                 ),
      r('Funding Use Report',          'Approved',  'Green',  'Nashville, TN', 'Finance',    'Q1 2026',   'Signed'      ),
    ],
  },
  {
    id: 'partner', label: 'Partner Reports', icon: '🤝', accent: '#5eead4',
    reports: [
      r('Partner Performance Report',        'Submitted', 'Green',  'Memphis, TN',     'Partnerships',    'May 2026',  'Under Review'),
      r('City / Government Partner Report',  'Draft',     'Yellow', 'Nashville, TN',   'Gov. Relations',  'May 2026'                 ),
      r('Vendor Report',                     'Approved',  'Green',  'Chattanooga, TN', 'Operations',      'Apr 2026',  'Signed'      ),
      r('Recycling Facility Partner Report', 'Draft',     'Green',  'Nashville, TN',   'Operations',      'May 2026'                 ),
      r('Sponsorship Report',                'Submitted', 'Green',  'Nashville, TN',   'Marketing',       'Q1 2026',   'Under Review'),
      r('Contract Compliance Report',        'Draft',     'Red',    'Knoxville, TN',   'Legal',           'May 2026',  'Needs Action'),
    ],
  },
  {
    id: 'project', label: 'Project Reports', icon: '📋', accent: '#a78bfa',
    reports: [
      r('Project Status Report',     'Draft',     'Green',  'Nashville, TN',   'Project Mgmt', 'May 2026'               ),
      r('Project Budget Report',     'Submitted', 'Yellow', 'Nashville, TN',   'Finance',      'May 2026', 'Under Review'),
      r('Project Timeline Report',   'Draft',     'Green',  'Nashville, TN',   'Project Mgmt', 'May 2026'               ),
      r('Project Risk Report',       'Draft',     'Yellow', 'Memphis, TN',     'Risk Mgmt',    'May 2026'               ),
      r('Project Milestone Report',  'Approved',  'Green',  'Nashville, TN',   'Project Mgmt', 'Q1 2026',  'Signed'     ),
      r('Project Completion Report', 'Approved',  'Green',  'Chattanooga, TN', 'Project Mgmt', 'Mar 2026', 'Signed'     ),
    ],
  },
  {
    id: 'operations', label: 'Recycling Operations Reports', icon: '♻️', accent: '#4ade80',
    reports: [
      r('Daily Collection Report',        'Submitted', 'Green',  'Nashville, TN',   'Operations',      'May 5, 2026',       'Auto-Approved'),
      r('Weekly Recycling Volume Report',  'Approved',  'Green',  'Nashville, TN',   'Operations',      'Apr 27–May 3, 2026','Signed'       ),
      r('Monthly Waste Diversion Report',  'Draft',     'Green',  'Nashville, TN',   'Operations',      'May 2026'                          ),
      r('Contamination Report',            'Submitted', 'Yellow', 'Memphis, TN',     'Quality Control', 'May 2026',          'Under Review' ),
      r('Route Performance Report',        'Approved',  'Green',  'Nashville, TN',   'Logistics',       'Apr 2026',          'Signed'       ),
      r('Driver Performance Report',       'Draft',     'Green',  'Nashville, TN',   'HR',              'May 2026'                          ),
      r('Warehouse Intake Report',         'Submitted', 'Green',  'Chattanooga, TN', 'Operations',      'May 2026',          'Under Review' ),
      r('Bag Scan Report',                 'Approved',  'Green',  'Nashville, TN',   'Operations',      'Apr 2026',          'Signed'       ),
      r('QR Bag Tracking Report',          'Submitted', 'Green',  'All Cities',      'Technology',      'May 2026',          'Under Review' ),
    ],
  },
  {
    id: 'financial', label: 'Financial Reports', icon: '💰', accent: '#fbbf24',
    reports: [
      r('Profit & Loss Report',     'Submitted', 'Green',  'Nashville, TN', 'Finance', 'Q1 2026',  'Under Review'),
      r('Cash Flow Report',         'Draft',     'Yellow', 'Nashville, TN', 'Finance', 'May 2026'               ),
      r('Balance Sheet',            'Approved',  'Green',  'Nashville, TN', 'Finance', 'Q1 2026',  'Signed'      ),
      r('Budget vs Actual Report',  'Draft',     'Yellow', 'All Cities',    'Finance', 'May 2026'               ),
      r('Revenue by City Report',   'Submitted', 'Green',  'All Cities',    'Finance', 'Apr 2026', 'Under Review'),
      r('Revenue by Partner Report','Draft',     'Green',  'Nashville, TN', 'Finance', 'May 2026'               ),
      r('Expense Report',           'Submitted', 'Green',  'Nashville, TN', 'Finance', 'May 2026', 'Under Review'),
      r('Grant Spending Report',    'Approved',  'Green',  'Nashville, TN', 'Finance', 'Q1 2026',  'Signed'      ),
    ],
  },
  {
    id: 'environmental', label: 'Environmental Impact Reports', icon: '🌍', accent: '#34d399',
    reports: [
      r('Tons Diverted from Landfills', 'Approved',  'Green',  'All Cities',    'Environmental',  'Q1 2026',  'Signed'      ),
      r('CO₂ Reduction Report',         'Approved',  'Green',  'All Cities',    'Environmental',  'Q1 2026',  'Signed'      ),
      r('Recycling Rate Report',        'Submitted', 'Green',  'Nashville, TN', 'Environmental',  'May 2026', 'Under Review'),
      r('Energy Produced Report',       'Draft',     'Yellow', 'Nashville, TN', 'Environmental',  'May 2026'               ),
      r('Material Recovery Report',     'Submitted', 'Green',  'All Cities',    'Environmental',  'Q1 2026',  'Under Review'),
      r('Community Impact Report',      'Approved',  'Green',  'Nashville, TN', 'Community Rel.', 'Q1 2026',  'Signed'      ),
    ],
  },
  {
    id: 'compliance', label: 'Compliance Reports', icon: '🛡️', accent: '#f87171',
    reports: [
      r('Permit Status Report',            'Approved',  'Green',  'Nashville, TN', 'Compliance', 'May 2026',    'Signed'      ),
      r('Safety Inspection Report',        'Submitted', 'Yellow', 'Memphis, TN',   'Safety',     'May 2026',    'Under Review'),
      r('OSHA / Workplace Safety Report',  'Approved',  'Green',  'Nashville, TN', 'Safety',     'Q1 2026',     'Signed'      ),
      r('Fire Safety Report',              'Approved',  'Green',  'Nashville, TN', 'Facilities', 'Q1 2026',     'Signed'      ),
      r('Environmental Compliance Report', 'Submitted', 'Green',  'All Cities',    'Compliance', 'May 2026',    'Under Review'),
      r('Insurance Report',                'Approved',  'Green',  'Nashville, TN', 'Finance',    'FY 2025',     'Signed'      ),
      r('Incident Report',                 'Draft',     'Red',    'Memphis, TN',   'Safety',     'May 5, 2026', 'Needs Action'),
    ],
  },
  {
    id: 'customer', label: 'Customer / User Reports', icon: '👥', accent: '#67e8f9',
    reports: [
      r('Consumer Recycling Activity', 'Submitted', 'Green',  'Nashville, TN', 'Product',          'May 2026', 'Under Review'),
      r('Rewards Earned Report',       'Approved',  'Green',  'All Cities',    'Finance',          'Apr 2026', 'Signed'      ),
      r('Missed Pickup Report',        'Draft',     'Yellow', 'Nashville, TN', 'Operations',       'May 2026'               ),
      r('Customer Complaints Report',  'Submitted', 'Yellow', 'Memphis, TN',   'Customer Success', 'May 2026', 'Under Review'),
      r('Customer Growth Report',      'Approved',  'Green',  'All Cities',    'Marketing',        'Q1 2026',  'Signed'      ),
      r('Active Users Report',         'Submitted', 'Green',  'All Cities',    'Product',          'May 2026', 'Under Review'),
    ],
  },
  {
    id: 'grants', label: 'Grant Reports', icon: '🏆', accent: '#c084fc',
    reports: [
      r('Grant Application Tracker', 'Draft',     'Green',  'Nashville, TN', 'Development', 'May 2026'               ),
      r('Grant Award Report',        'Approved',  'Green',  'Nashville, TN', 'Development', 'Q1 2026',  'Signed'      ),
      r('Grant Spending Report',     'Submitted', 'Green',  'Nashville, TN', 'Finance',     'Q1 2026',  'Under Review'),
      r('Grant Compliance Report',   'Approved',  'Green',  'Nashville, TN', 'Compliance',  'Q1 2026',  'Signed'      ),
      r('Grant Outcome Report',      'Draft',     'Yellow', 'Nashville, TN', 'Development', 'May 2026'               ),
      r('Matching Funds Report',     'Submitted', 'Green',  'Nashville, TN', 'Finance',     'Q1 2026',  'Under Review'),
    ],
  },
  {
    id: 'executive', label: 'Executive Dashboard', icon: '🎯', accent: '#fb923c',
    reports: [
      r('Company Snapshot',            'Submitted', 'Green',  'All Cities',       'Executive',  'May 2026', 'Under Review'),
      r('Monthly Performance Summary', 'Submitted', 'Green',  'All Cities',       'Executive',  'Apr 2026', 'Under Review'),
      r('City-by-City Performance',    'Approved',  'Green',  'All Cities',       'Executive',  'Q1 2026',  'Signed'      ),
      r('Risk Dashboard',              'Draft',     'Yellow', 'All Cities',       'Risk Mgmt',  'May 2026'               ),
      r('Expansion Readiness Report',  'Draft',     'Green',  'Murfreesboro, TN', 'Strategy',   'May 2026'               ),
      r('Next Quarter Goals',          'Draft',     'Green',  'All Cities',       'Executive',  'Q2 2026'                ),
    ],
  },
]

const FEATURED = [
  { name: 'ESG Impact Report',        category: 'Environmental', rag: 'Green'     as RAGColor, status: 'Submitted' as ReportStatus, city: 'All Cities',    dateRange: 'Q1 2026',   icon: '🌱' },
  { name: 'QR Bag Tracking Report',   category: 'Operations',    rag: 'Green'     as RAGColor, status: 'Submitted' as ReportStatus, city: 'All Cities',    dateRange: 'May 2026',  icon: '📦' },
  { name: 'City-by-City Performance', category: 'Executive',     rag: 'Green'     as RAGColor, status: 'Approved'  as ReportStatus, city: 'All Cities',    dateRange: 'Q1 2026',   icon: '🗺️' },
  { name: 'Grant Spending Report',    category: 'Grants',        rag: 'Green'     as RAGColor, status: 'Submitted' as ReportStatus, city: 'Nashville, TN', dateRange: 'Q1 2026',   icon: '🏆' },
]

const CITY_VOLUMES = [
  { city: 'Nashville',   bags: 5280, pct: 100 },
  { city: 'Memphis',     bags: 3180, pct: 60  },
  { city: 'Knoxville',   bags: 2310, pct: 44  },
  { city: 'Chattanooga', bags: 2210, pct: 42  },
]

const FUNDRAISER_MONTHS = [
  { month: 'Jan', pct: 58  },
  { month: 'Feb', pct: 67  },
  { month: 'Mar', pct: 80  },
  { month: 'Apr', pct: 91  },
  { month: 'May', pct: 100 },
]

const CONTAMINATION_TREND = [
  { label: 'Week 1', pct: 14 },
  { label: 'Week 2', pct: 11 },
  { label: 'Week 3', pct: 9  },
  { label: 'Week 4', pct: 7  },
]

const REWARDS_WEEKS = [
  { label: 'Wk 1', amount: '$1,840', pct: 72  },
  { label: 'Wk 2', amount: '$2,110', pct: 83  },
  { label: 'Wk 3', amount: '$1,960', pct: 77  },
  { label: 'Wk 4', amount: '$2,540', pct: 100 },
]

const CITY_OPTIONS    = ['All', 'Nashville, TN', 'Memphis, TN', 'Chattanooga, TN', 'Knoxville, TN', 'All Cities', 'Murfreesboro, TN']
const STATUS_OPTIONS  = ['All', 'Draft', 'Submitted', 'Approved']
const RAG_OPTIONS     = ['All', 'Green', 'Yellow', 'Red']

// ── ReportRow ─────────────────────────────────────────────────────────────────

function ReportRow({
  report,
  onExport,
  isLast,
}: {
  report:   Report
  onExport: (msg: string) => void
  isLast:   boolean
}) {
  const rs = ragStyle(report.rag)
  const ss = statusStyle(report.status)

  return (
    <div
      className="flex items-start gap-3 px-4 py-3.5"
      style={{ borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.05)' }}
    >
      <div
        className="w-2 h-2 rounded-full mt-1.5 shrink-0"
        style={{ background: rs.color, boxShadow: `0 0 5px ${rs.color}` }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold leading-tight" style={{ color: '#ffffff' }}>
            {report.name}
          </p>
          <span
            className="shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide"
            style={{ background: ss.bg, color: ss.color, border: `1px solid ${ss.border}` }}
          >
            {report.status}
          </span>
        </div>
        <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.32)' }}>
          {report.dateRange} · {report.city} · {report.department}
        </p>
        <div className="flex items-center justify-between mt-2 gap-2">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-medium" style={{ color: rs.color }}>
              ● {report.rag} · {report.approval}
            </span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.18)', cursor: 'default' }} title="Notes">📝</span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.18)', cursor: 'default' }} title="Documents">📎</span>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <button
              onClick={() => onExport('Demo export generated.')}
              className="px-2.5 py-0.5 rounded-full text-[9px] font-bold hover:brightness-125 transition-all"
              style={{ background: 'rgba(0,200,255,0.1)', color: '#00c8ff', border: '1px solid rgba(0,200,255,0.25)', cursor: 'pointer' }}
            >
              PDF
            </button>
            <button
              onClick={() => onExport('Demo export generated.')}
              className="px-2.5 py-0.5 rounded-full text-[9px] font-bold hover:brightness-125 transition-all"
              style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.25)', cursor: 'pointer' }}
            >
              XLS
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

const selectStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border:     '1px solid rgba(255,255,255,0.12)',
  color:      'rgba(255,255,255,0.7)',
  borderRadius: 12,
  padding:    '8px 10px',
  fontSize:   11,
  outline:    'none',
  cursor:     'pointer',
  width:      '100%',
}

export default function ReportsCenterPage() {
  const [animate,       setAnimate]       = useState(false)
  const [openCats,      setOpenCats]      = useState<Set<string>>(new Set())
  const [search,        setSearch]        = useState('')
  const [catFilter,     setCatFilter]     = useState('All')
  const [statusFilter,  setStatusFilter]  = useState('All')
  const [cityFilter,    setCityFilter]    = useState('All')
  const [ragFilter,     setRagFilter]     = useState('All')
  const [toast,         setToast]         = useState<string | null>(null)

  useEffect(() => {
    const t = requestAnimationFrame(() => setAnimate(true))
    return () => cancelAnimationFrame(t)
  }, [])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const fade = (delay = 0): React.CSSProperties => ({
    opacity:    animate ? 1 : 0,
    transform:  animate ? 'translateY(0)' : 'translateY(14px)',
    transition: `opacity 0.4s ease ${delay}ms, transform 0.4s ease ${delay}ms`,
  })

  const isFiltered = !!(
    search.trim() ||
    catFilter    !== 'All' ||
    statusFilter !== 'All' ||
    cityFilter   !== 'All' ||
    ragFilter    !== 'All'
  )

  const displayCats = CATEGORIES
    .filter(cat => catFilter === 'All' || cat.label === catFilter)
    .map(cat => {
      const filteredReports = cat.reports.filter(rep => {
        const q = search.trim().toLowerCase()
        if (q && !rep.name.toLowerCase().includes(q) && !rep.department.toLowerCase().includes(q)) return false
        if (statusFilter !== 'All' && rep.status !== statusFilter) return false
        if (cityFilter   !== 'All' && rep.city   !== cityFilter)   return false
        if (ragFilter    !== 'All' && rep.rag     !== ragFilter)    return false
        return true
      })
      return {
        ...cat,
        filteredReports,
        isOpen: isFiltered ? true : openCats.has(cat.id),
      }
    })
    .filter(cat => isFiltered ? cat.filteredReports.length > 0 : true)

  const allReports     = CATEGORIES.flatMap(c => c.reports)
  const totalDraft     = allReports.filter(r => r.status === 'Draft').length
  const totalSubmitted = allReports.filter(r => r.status === 'Submitted').length
  const totalApproved  = allReports.filter(r => r.status === 'Approved').length

  const toggleCat = (id: string) => {
    setOpenCats(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const clearFilters = () => {
    setSearch('')
    setCatFilter('All')
    setStatusFilter('All')
    setCityFilter('All')
    setRagFilter('All')
  }

  return (
    <div
      className="relative min-h-screen flex flex-col overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}
    >
      <div className="pointer-events-none absolute inset-0 grid-bg" />
      <div className="pointer-events-none absolute" style={{ top: -80, left: -60, width: 320, height: 320, background: 'rgba(0,87,231,0.28)', filter: 'blur(80px)', borderRadius: '50%' }} />
      <div className="pointer-events-none absolute" style={{ bottom: -60, right: -40, width: 260, height: 260, background: 'rgba(0,200,255,0.15)', filter: 'blur(70px)', borderRadius: '50%' }} />

      {/* ── Toast ─────────────────────────────────────────────────────────────── */}
      {toast && (
        <div
          className="fixed top-5 left-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-2xl"
          style={{
            transform:      'translateX(-50%)',
            background:     'rgba(6,14,36,0.96)',
            border:         '1px solid rgba(0,200,255,0.4)',
            boxShadow:      '0 4px 24px rgba(0,200,255,0.2)',
            color:          '#00c8ff',
            fontSize:       13,
            fontWeight:     600,
            backdropFilter: 'blur(12px)',
            animation:      'toastIn 0.25s ease',
            whiteSpace:     'nowrap',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          {toast}
        </div>
      )}

      <div className="relative flex-1 overflow-y-auto pb-28" style={{ zIndex: 1 }}>
        <div className="max-w-[640px] mx-auto px-4 pt-10 pb-6">

          {/* ── Header ────────────────────────────────────────────────────────── */}
          <div style={fade(0)}>
            <Link
              to="/admin-dashboard"
              className="inline-flex items-center gap-1.5 mb-6 text-xs font-semibold hover:opacity-70 transition-opacity"
              style={{ color: 'rgba(255,255,255,0.38)', textDecoration: 'none' }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
              Admin Dashboard
            </Link>

            <div className="flex items-start justify-between gap-4 mb-2">
              <div className="flex items-center gap-3">
                <div
                  className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(0,200,255,0.12)', border: '1px solid rgba(0,200,255,0.32)', fontSize: 20 }}
                >
                  📊
                </div>
                <div>
                  <h1 className="text-2xl font-bold" style={{ color: '#ffffff', lineHeight: 1.1 }}>
                    Reports Center
                  </h1>
                  <p className="text-xs mt-1 leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)', maxWidth: 340 }}>
                    Manage investor, partner, operations, financial, environmental, compliance, customer, grant, and executive reports.
                  </p>
                </div>
              </div>
              <button
                onClick={() => showToast('Demo report template created.')}
                className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold hover:brightness-110 active:scale-[0.97] transition-all"
                style={{ background: 'linear-gradient(135deg, #0057e7, #00c8ff)', color: '#ffffff', boxShadow: '0 4px 16px rgba(0,200,255,0.25)', cursor: 'pointer', border: 'none' }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Create New Report
              </button>
            </div>
          </div>

          {/* ── Summary stats ─────────────────────────────────────────────────── */}
          <div className="grid grid-cols-4 gap-2 mt-6 mb-8" style={fade(60)}>
            {[
              { label: 'Total',     value: allReports.length, color: '#00c8ff', bg: 'rgba(0,200,255,0.08)',  border: 'rgba(0,200,255,0.22)'  },
              { label: 'Draft',     value: totalDraft,        color: 'rgba(255,255,255,0.5)', bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.12)' },
              { label: 'Submitted', value: totalSubmitted,    color: '#fbbf24', bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.22)' },
              { label: 'Approved',  value: totalApproved,     color: '#4ade80', bg: 'rgba(34,197,94,0.08)',  border: 'rgba(34,197,94,0.22)'  },
            ].map(s => (
              <div
                key={s.label}
                className="rounded-2xl flex flex-col items-center gap-1 py-3 px-1"
                style={{ background: s.bg, border: `1px solid ${s.border}` }}
              >
                <span className="text-xl font-bold" style={{ color: s.color }}>{s.value}</span>
                <span className="text-[9px] font-semibold uppercase tracking-wider text-center" style={{ color: 'rgba(255,255,255,0.32)' }}>{s.label}</span>
              </div>
            ))}
          </div>

          {/* ── Featured Quick Reports ─────────────────────────────────────────── */}
          <div style={fade(120)}>
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Featured Reports
            </p>
            <div className="grid grid-cols-2 gap-3 mb-8">
              {FEATURED.map(f => {
                const rs = ragStyle(f.rag)
                const ss = statusStyle(f.status)
                return (
                  <div
                    key={f.name}
                    className="rounded-2xl p-4 flex flex-col gap-3"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(0,190,255,0.18)' }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span style={{ fontSize: 22 }}>{f.icon}</span>
                      <span
                        className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide"
                        style={{ background: ss.bg, color: ss.color, border: `1px solid ${ss.border}` }}
                      >
                        {f.status}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold leading-tight" style={{ color: '#ffffff' }}>{f.name}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        {f.dateRange} · {f.city}
                      </p>
                    </div>
                    <div
                      className="flex items-center gap-1.5 px-2 py-1 rounded-full w-fit"
                      style={{ background: rs.bg, border: `1px solid ${rs.border}` }}
                    >
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: rs.color }} />
                      <span className="text-[9px] font-bold" style={{ color: rs.color }}>{f.rag}</span>
                    </div>
                    <div className="flex gap-1.5 mt-auto">
                      <button
                        onClick={() => showToast('Demo export generated.')}
                        className="flex-1 py-1.5 rounded-xl text-[10px] font-semibold hover:brightness-110 active:scale-[0.97] transition-all"
                        style={{ background: 'rgba(0,200,255,0.1)', color: '#00c8ff', border: '1px solid rgba(0,200,255,0.25)', cursor: 'pointer' }}
                      >
                        View
                      </button>
                      <button
                        onClick={() => showToast('Demo export generated.')}
                        className="px-3 py-1.5 rounded-xl text-[10px] font-bold hover:brightness-110 active:scale-[0.97] transition-all"
                        style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer' }}
                      >
                        PDF
                      </button>
                      <button
                        onClick={() => showToast('Demo export generated.')}
                        className="px-3 py-1.5 rounded-xl text-[10px] font-bold hover:brightness-110 active:scale-[0.97] transition-all"
                        style={{ background: 'rgba(74,222,128,0.08)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)', cursor: 'pointer' }}
                      >
                        XLS
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Fraud Detection link ──────────────────────────────────────────── */}
          <div style={fade(160)} className="mb-8">
            <Link
              to="/fraud-detection"
              className="w-full flex items-center gap-3 p-4 rounded-2xl transition-all hover:brightness-110 active:scale-[0.98]"
              style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.22)', textDecoration: 'none' }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.3)', fontSize: 18 }}
              >
                🛡️
              </div>
              <div className="flex-1 min-w-0">
                <p style={{ fontSize: 13, fontWeight: 700, color: '#ffffff' }}>Fraud Detection</p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>
                  Duplicate scan prevention, payout protection, abuse checks
                </p>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(248,113,113,0.55)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          {/* ── Charts Preview ─────────────────────────────────────────────────── */}
          <div style={fade(200)}>
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Reporting Charts Preview
            </p>
            <div className="grid grid-cols-2 gap-3 mb-8">

              {/* Recycling Volume by City */}
              <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(0,190,255,0.15)' }}>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  ♻️ Volume by City
                </p>
                <div className="flex flex-col gap-2.5">
                  {CITY_VOLUMES.map((item, i) => (
                    <div key={item.city}>
                      <div className="flex justify-between mb-1">
                        <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.45)' }}>{item.city}</span>
                        <span className="text-[10px] font-semibold" style={{ color: '#00c8ff' }}>{item.bags.toLocaleString()}</span>
                      </div>
                      <div className="h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.07)' }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width:      animate ? `${item.pct}%` : '0%',
                            background: 'linear-gradient(90deg, #0057e7, #00c8ff)',
                            transition: `width 1s ease ${i * 150}ms`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Fundraiser by Month */}
              <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(0,190,255,0.15)' }}>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  🌱 Fundraiser / Month
                </p>
                <div className="flex items-end justify-between gap-1" style={{ height: 72 }}>
                  {FUNDRAISER_MONTHS.map((m, i) => (
                    <div key={m.month} className="flex-1 flex flex-col items-center gap-1" style={{ height: '100%', justifyContent: 'flex-end' }}>
                      <div
                        className="w-full rounded-t-sm"
                        style={{
                          height:     animate ? `${m.pct}%` : '0%',
                          background: 'linear-gradient(180deg, #4ade80, #0057e7)',
                          transition: `height 0.9s ease ${i * 100}ms`,
                        }}
                      />
                      <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{m.month}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Contamination Trend */}
              <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(0,190,255,0.15)' }}>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  🟡 Contamination Trend
                </p>
                <div className="flex flex-col gap-2.5">
                  {CONTAMINATION_TREND.map((item, i) => (
                    <div key={item.label}>
                      <div className="flex justify-between mb-1">
                        <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.45)' }}>{item.label}</span>
                        <span className="text-[10px] font-semibold" style={{ color: '#fbbf24' }}>{item.pct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.07)' }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width:      animate ? `${item.pct * 5}%` : '0%',
                            background: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
                            transition: `width 0.9s ease ${i * 120}ms`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Rewards by Week */}
              <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(0,190,255,0.15)' }}>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  💰 Rewards Paid / Week
                </p>
                <div className="flex flex-col gap-2.5">
                  {REWARDS_WEEKS.map((item, i) => (
                    <div key={item.label}>
                      <div className="flex justify-between mb-1">
                        <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.45)' }}>{item.label}</span>
                        <span className="text-[10px] font-semibold" style={{ color: '#fbbf24' }}>{item.amount}</span>
                      </div>
                      <div className="h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.07)' }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width:      animate ? `${item.pct}%` : '0%',
                            background: 'linear-gradient(90deg, #92400e, #fbbf24)',
                            transition: `width 0.9s ease ${i * 120}ms`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>

          {/* ── Report Library ────────────────────────────────────────────────── */}
          <div style={fade(280)}>
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Report Library
            </p>

            {/* Filters */}
            <div
              className="rounded-2xl p-4 mb-5"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(0,190,255,0.15)' }}
            >
              {/* Search */}
              <div className="relative mb-3">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  width="13" height="13" viewBox="0 0 24 24" fill="none"
                  stroke="rgba(255,255,255,0.32)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <input
                  type="text"
                  placeholder="Search reports by name or department…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 rounded-xl text-xs"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border:     '1px solid rgba(255,255,255,0.12)',
                    color:      '#ffffff',
                    outline:    'none',
                  }}
                />
              </div>

              {/* Filter dropdowns 2×2 */}
              <div className="grid grid-cols-2 gap-2">
                <select value={catFilter}    onChange={e => setCatFilter(e.target.value)}    style={selectStyle}>
                  <option value="All" style={{ background: '#060e24' }}>All Categories</option>
                  {CATEGORIES.map(c => <option key={c.id} value={c.label} style={{ background: '#060e24' }}>{c.label}</option>)}
                </select>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={selectStyle}>
                  {STATUS_OPTIONS.map(o => <option key={o} value={o} style={{ background: '#060e24' }}>{o === 'All' ? 'All Statuses' : o}</option>)}
                </select>
                <select value={cityFilter}   onChange={e => setCityFilter(e.target.value)}   style={selectStyle}>
                  {CITY_OPTIONS.map(o => <option key={o} value={o} style={{ background: '#060e24' }}>{o === 'All' ? 'All Cities' : o}</option>)}
                </select>
                <select value={ragFilter}    onChange={e => setRagFilter(e.target.value)}    style={selectStyle}>
                  {RAG_OPTIONS.map(o => <option key={o} value={o} style={{ background: '#060e24' }}>{o === 'All' ? 'All RAG' : `${o} RAG`}</option>)}
                </select>
              </div>

              {isFiltered && (
                <button
                  onClick={clearFilters}
                  className="mt-3 text-[10px] font-semibold hover:opacity-70 transition-opacity"
                  style={{ color: '#00c8ff', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  ✕ Clear filters
                </button>
              )}
            </div>
          </div>

          {/* ── Category Accordions ───────────────────────────────────────────── */}
          <div style={fade(340)}>
            {displayCats.length === 0 ? (
              <div
                className="rounded-2xl flex flex-col items-center gap-3 py-14 text-center"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <span style={{ fontSize: 36 }}>🔍</span>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)' }}>No reports match your filters.</p>
                <button
                  onClick={clearFilters}
                  style={{ fontSize: 12, color: '#00c8ff', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {displayCats.map(cat => {
                  const reportsToShow = cat.isOpen ? cat.filteredReports : []
                  return (
                    <div
                      key={cat.id}
                      className="rounded-2xl overflow-hidden"
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        border:     '1px solid rgba(0,190,255,0.12)',
                      }}
                    >
                      {/* Category header */}
                      <button
                        onClick={() => !isFiltered && toggleCat(cat.id)}
                        className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors"
                        style={{
                          background:   cat.isOpen ? 'rgba(0,87,231,0.09)' : 'transparent',
                          borderBottom: cat.isOpen ? '1px solid rgba(0,190,255,0.1)' : 'none',
                          cursor:       isFiltered ? 'default' : 'pointer',
                        }}
                      >
                        <span style={{ fontSize: 17, flexShrink: 0 }}>{cat.icon}</span>
                        <p className="flex-1 font-semibold text-sm" style={{ color: '#ffffff' }}>
                          {cat.label}
                        </p>
                        <span
                          className="px-2 py-0.5 rounded-full text-[9px] font-bold"
                          style={{
                            background: `${cat.accent}1a`,
                            color:      cat.accent,
                            border:     `1px solid ${cat.accent}44`,
                          }}
                        >
                          {cat.filteredReports.length}
                        </span>
                        {!isFiltered && (
                          <svg
                            width="13" height="13" viewBox="0 0 24 24" fill="none"
                            stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                            style={{
                              transform:  cat.isOpen ? 'rotate(180deg)' : 'none',
                              transition: 'transform 0.22s ease',
                              flexShrink: 0,
                            }}
                          >
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        )}
                      </button>

                      {/* Report rows */}
                      {reportsToShow.map((rep, i) => (
                        <ReportRow
                          key={rep.name + i}
                          report={rep}
                          onExport={showToast}
                          isLast={i === reportsToShow.length - 1}
                        />
                      ))}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

        </div>
      </div>

      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(-50%) translateY(-8px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0);    }
        }
      `}</style>
    </div>
  )
}
