// DataTable.tsx — Reusable sortable, paginated data table
// Used across Lead Tracker, Approval Queue, Publish History, Audit Log, etc.

import { useState, useMemo, type ReactNode } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

export type SortDirection = 'asc' | 'desc'

export interface Column<T> {
  key:        string
  label:      string
  /** Renders cell content. Default: String(row[key]) */
  render?:    (row: T, index: number) => ReactNode
  /** Enable sorting on this column */
  sortable?:  boolean
  /** Extract raw value for sorting (defaults to row[key]) */
  sortValue?: (row: T) => string | number
  /** Column width (CSS value). Omit for equal distribution */
  width?:     string
  align?:     'left' | 'center' | 'right'
  /** Hide column but keep data accessible */
  hidden?:    boolean
}

export interface DataTableProps<T> {
  data:          T[]
  columns:       Column<T>[]
  keyExtractor:  (row: T, index: number) => string
  pageSize?:     number
  defaultSortKey?:   string
  defaultSortDir?:   SortDirection
  emptyMessage?:     string
  emptyIcon?:        string
  loading?:          boolean
  /** Called when row is clicked */
  onRowClick?:       (row: T) => void
  /** Row-level background override */
  rowStyle?:         (row: T) => React.CSSProperties | undefined
  /** Extra content rendered above the table (filters, search) */
  toolbar?:          ReactNode
  /** Compact row height */
  compact?:          boolean
  /** Override table container styles */
  style?:            React.CSSProperties
}

// ── Pagination controls ───────────────────────────────────────────────────────

function Pagination({
  page, totalPages, hasNext, hasPrev,
  onNext, onPrev, onPage,
  total, pageSize,
}: {
  page: number; totalPages: number; hasNext: boolean; hasPrev: boolean
  onNext: () => void; onPrev: () => void; onPage: (p: number) => void
  total: number; pageSize: number
}) {
  const start = page * pageSize + 1
  const end   = Math.min((page + 1) * pageSize, total)

  const btnBase: React.CSSProperties = {
    background:   'rgba(255,255,255,0.06)',
    border:       '1px solid rgba(255,255,255,0.1)',
    borderRadius: 7,
    color:        'rgba(255,255,255,0.65)',
    cursor:       'pointer',
    fontSize:     12,
    fontWeight:   600,
    padding:      '4px 10px',
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>
        {total === 0 ? 'No results' : `${start}–${end} of ${total}`}
      </span>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <button onClick={onPrev} disabled={!hasPrev} style={{ ...btnBase, opacity: hasPrev ? 1 : 0.35, cursor: hasPrev ? 'pointer' : 'default' }}>
          ‹ Prev
        </button>
        {/* Page number pills (up to 5 visible) */}
        {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
          const pg = totalPages <= 7 ? i : Math.max(0, Math.min(page - 3 + i, totalPages - 7 + i))
          const isActive = pg === page
          return (
            <button
              key={pg}
              onClick={() => onPage(pg)}
              style={{ ...btnBase, background: isActive ? 'rgba(0,200,255,0.15)' : btnBase.background, border: isActive ? '1px solid rgba(0,200,255,0.4)' : btnBase.border, color: isActive ? '#00c8ff' : 'rgba(255,255,255,0.65)', minWidth: 28 }}
            >
              {pg + 1}
            </button>
          )
        })}
        <button onClick={onNext} disabled={!hasNext} style={{ ...btnBase, opacity: hasNext ? 1 : 0.35, cursor: hasNext ? 'pointer' : 'default' }}>
          Next ›
        </button>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  pageSize = 20,
  defaultSortKey,
  defaultSortDir = 'asc',
  emptyMessage   = 'No data yet.',
  emptyIcon      = '📭',
  loading        = false,
  onRowClick,
  rowStyle,
  toolbar,
  compact        = false,
  style,
}: DataTableProps<T>) {
  const [sortKey, setSortKey]     = useState<string | undefined>(defaultSortKey)
  const [sortDir, setSortDir]     = useState<SortDirection>(defaultSortDir)
  const [page,    setPage]        = useState(0)

  const visibleCols = columns.filter((c) => !c.hidden)

  // Sort
  const sorted = useMemo(() => {
    if (!sortKey) return data
    const col = columns.find((c) => c.key === sortKey)
    return [...data].sort((a, b) => {
      const av = col?.sortValue ? col.sortValue(a) : (a as Record<string, unknown>)[sortKey]
      const bv = col?.sortValue ? col.sortValue(b) : (b as Record<string, unknown>)[sortKey]
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av ?? '').localeCompare(String(bv ?? ''))
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [data, sortKey, sortDir, columns])

  // Paginate
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage   = Math.min(page, totalPages - 1)
  const items      = useMemo(
    () => sorted.slice(safePage * pageSize, (safePage + 1) * pageSize),
    [sorted, safePage, pageSize],
  )

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
    setPage(0)
  }

  const rowPad = compact ? '7px 12px' : '11px 14px'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden', ...style }}>
      {/* Toolbar slot */}
      {toolbar && <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{toolbar}</div>}

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
              {visibleCols.map((col) => (
                <th
                  key={col.key}
                  onClick={() => col.sortable && handleSort(col.key)}
                  style={{
                    padding:     rowPad,
                    textAlign:   col.align ?? 'left',
                    fontSize:    11,
                    fontWeight:  700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color:       col.sortable ? (sortKey === col.key ? '#00c8ff' : 'rgba(255,255,255,0.45)') : 'rgba(255,255,255,0.4)',
                    cursor:      col.sortable ? 'pointer' : 'default',
                    userSelect:  'none',
                    whiteSpace:  'nowrap',
                    width:       col.width,
                    borderBottom: '1px solid rgba(255,255,255,0.07)',
                    transition:  'color 0.12s ease',
                  }}
                  aria-sort={sortKey === col.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  {col.label}
                  {col.sortable && sortKey === col.key && (
                    <span style={{ marginLeft: 4, fontSize: 9 }}>{sortDir === 'asc' ? '▲' : '▼'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              /* Skeleton rows */
              Array.from({ length: Math.min(pageSize, 5) }, (_, i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  {visibleCols.map((col) => (
                    <td key={col.key} style={{ padding: rowPad }}>
                      <div style={{ height: 12, borderRadius: 4, background: 'rgba(255,255,255,0.07)', width: '70%', animation: 'pulse 1.5s ease infinite' }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={visibleCols.length} style={{ textAlign: 'center', padding: '40px 20px' }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>{emptyIcon}</div>
                  <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>{emptyMessage}</div>
                </td>
              </tr>
            ) : (
              items.map((row, i) => (
                <tr
                  key={keyExtractor(row, i)}
                  onClick={() => onRowClick?.(row)}
                  style={{
                    borderBottom:  '1px solid rgba(255,255,255,0.04)',
                    cursor:        onRowClick ? 'pointer' : 'default',
                    transition:    'background 0.1s ease',
                    ...rowStyle?.(row),
                  }}
                  onMouseEnter={(e) => { if (onRowClick) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = (rowStyle?.(row)?.background as string | undefined) ?? 'transparent' }}
                >
                  {visibleCols.map((col) => (
                    <td
                      key={col.key}
                      style={{
                        padding:   rowPad,
                        textAlign: col.align ?? 'left',
                        color:     'rgba(255,255,255,0.75)',
                        fontSize:  13,
                        verticalAlign: 'middle',
                      }}
                    >
                      {col.render
                        ? col.render(row, i)
                        : String((row as Record<string, unknown>)[col.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!loading && sorted.length > pageSize && (
        <Pagination
          page={safePage}
          totalPages={totalPages}
          hasNext={safePage < totalPages - 1}
          hasPrev={safePage > 0}
          onNext={() => setPage((p) => Math.min(p + 1, totalPages - 1))}
          onPrev={() => setPage((p) => Math.max(p - 1, 0))}
          onPage={setPage}
          total={sorted.length}
          pageSize={pageSize}
        />
      )}

      <style>{`@keyframes pulse { 0%,100% { opacity:0.6 } 50% { opacity:1 } }`}</style>
    </div>
  )
}
