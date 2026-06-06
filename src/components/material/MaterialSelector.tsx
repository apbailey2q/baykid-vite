/**
 * MaterialSelector — multi-select grid for recyclable material types.
 *
 * Loads material types from Supabase (with hardcoded fallback for offline/unauthenticated).
 * Renders as a 2-column chip grid. Selected chips glow cyan.
 *
 * Usage:
 *   <MaterialSelector value={selectedCodes} onChange={setSelectedCodes} />
 *
 * Props:
 *   value      — array of selected material codes, e.g. ['plastic', 'glass']
 *   onChange   — called with the updated array whenever selection changes
 *   max        — optional max selections (default unlimited)
 *   disabled   — greys out all chips
 *   className  — extra wrapper class
 */

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────

interface MaterialType {
  code:        string
  name:        string
  icon:        string
  description: string
  color:       string
}

// ── Fallback data (shown before DB loads or on error) ─────────────────────────

const FALLBACK_MATERIALS: MaterialType[] = [
  { code: 'plastic',     name: 'Plastic',       icon: '🧴', description: 'Bottles, containers, bags',       color: '#00c8ff' },
  { code: 'glass',       name: 'Glass',         icon: '🍶', description: 'Bottles and jars',                color: '#60a5fa' },
  { code: 'aluminum',    name: 'Aluminum',      icon: '🥫', description: 'Cans, foil, and trays',           color: '#94a3b8' },
  { code: 'steel',       name: 'Steel',         icon: '🔩', description: 'Steel cans, scrap metal',         color: '#64748b' },
  { code: 'cardboard',   name: 'Cardboard',     icon: '📦', description: 'Flattened boxes, paperboard',     color: '#f59e0b' },
  { code: 'mixed_paper', name: 'Mixed Paper',   icon: '📄', description: 'Newspapers, magazines, paper',    color: '#fbbf24' },
  { code: 'electronics', name: 'Electronics',   icon: '💻', description: 'E-waste: phones, computers',      color: '#a78bfa' },
  { code: 'custom',      name: 'Other / Mixed', icon: '🗂️', description: 'Mixed recyclables',              color: '#4ade80' },
]

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  value:     string[]
  onChange:  (codes: string[]) => void
  max?:      number
  disabled?: boolean
  className?: string
  /** Show description subtexts under each chip */
  showDescriptions?: boolean
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MaterialSelector({
  value,
  onChange,
  max,
  disabled = false,
  className = '',
  showDescriptions = false,
}: Props) {
  const [materials, setMaterials] = useState<MaterialType[]>(FALLBACK_MATERIALS)
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const { data } = await supabase
          .from('material_types')
          .select('code, name, icon, description, color')
          .eq('is_active', true)
          .order('sort_order')
        if (cancelled) return
        if (data && data.length > 0) setMaterials(data as MaterialType[])
      } catch {
        /* use fallback data */
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Set loading false after a tick even if supabase hasn't finished, so UI isn't stuck.
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 400)
    return () => clearTimeout(t)
  }, [])

  function toggle(code: string) {
    if (disabled) return
    if (value.includes(code)) {
      onChange(value.filter(c => c !== code))
    } else {
      if (max && value.length >= max) return
      onChange([...value, code])
    }
  }

  if (loading) {
    return (
      <div
        className={className}
        style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
        }}
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            style={{
              height: 56, borderRadius: 12,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.07)',
              animation: 'materialPulse 1.4s ease-in-out infinite',
              animationDelay: `${i * 0.08}s`,
            }}
          />
        ))}
        <style>{`
          @keyframes materialPulse {
            0%, 100% { opacity: 0.4; }
            50%       { opacity: 0.7; }
          }
        `}</style>
      </div>
    )
  }

  return (
    <div
      className={className}
      style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}
    >
      {materials.map(m => {
        const selected = value.includes(m.code)
        const atMax    = !selected && max != null && value.length >= max

        return (
          <button
            key={m.code}
            type="button"
            onClick={() => toggle(m.code)}
            disabled={disabled || atMax}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px',
              borderRadius: 12,
              background: selected
                ? `${m.color}18`
                : 'rgba(255,255,255,0.04)',
              border: `1.5px solid ${selected ? m.color + '60' : 'rgba(255,255,255,0.08)'}`,
              cursor: disabled || atMax ? 'default' : 'pointer',
              opacity: atMax ? 0.4 : 1,
              textAlign: 'left',
              transition: 'all 0.15s',
              boxShadow: selected ? `0 0 14px ${m.color}20` : 'none',
              position: 'relative',
            }}
          >
            {/* Selected checkmark */}
            {selected && (
              <div style={{
                position: 'absolute', top: 5, right: 6,
                width: 14, height: 14, borderRadius: '50%',
                background: m.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 8, fontWeight: 900, color: '#000',
              }}>
                ✓
              </div>
            )}

            <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>{m.icon}</span>

            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontSize: 13, fontWeight: selected ? 700 : 600,
                color: selected ? '#fff' : 'rgba(255,255,255,0.7)',
                lineHeight: 1.2,
                margin: 0,
                transition: 'color 0.15s',
              }}>
                {m.name}
              </p>
              {showDescriptions && (
                <p style={{
                  fontSize: 10, color: 'rgba(255,255,255,0.35)',
                  marginTop: 2, lineHeight: 1.3,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {m.description}
                </p>
              )}
            </div>
          </button>
        )
      })}

      {max && (
        <p style={{
          gridColumn: '1 / -1',
          fontSize: 11, color: 'rgba(255,255,255,0.35)',
          textAlign: 'center', marginTop: 4,
        }}>
          {value.length} of {max} selected
        </p>
      )}
    </div>
  )
}
