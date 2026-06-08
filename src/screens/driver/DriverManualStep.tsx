// DriverManualStep.tsx — In-app compliance manual reading step for the
// Driver Compliance Wizard.
//
// Shows the correct manual based on driver type:
//   isCommercialDriver=false → Consumer Driver Compliance Manual
//   isCommercialDriver=true  → Commercial Driver Compliance Manual
//
// Consumer-only (1099) drivers must never see the Commercial Manual.
// This is enforced by the isCommercialDriver prop — which is derived from
// driver_profiles.driver_service_type at the wizard level.
//
// On acknowledgment, upserts manual_acknowledged_at and manual_version
// to driver_profiles. Fast-tracks if manual_acknowledged_at is already set.

import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { AppShell, GlassCard, PrimaryButton } from '../../components/ui'
import { CONSUMER_MANUAL } from './consumerManualData'
import { COMMERCIAL_MANUAL } from './commercialManualData'
import { manualKey } from './driverComplianceVersions'
import type { ManualSection, DriverManualData } from './consumerManualData'
import type { DriverProfile } from '../../types'

// ── Props ─────────────────────────────────────────────────────────────────────

export interface DriverManualStepProps {
  stepIndex:          number
  totalSteps:         number
  driverId:           string
  isCommercialDriver: boolean
  driverProfile:      DriverProfile | null
  onBack:             () => void
  onNext:             () => void | Promise<void>
}

// ── Shared local UI helpers ───────────────────────────────────────────────────

function ProgressBar({ stepIndex, totalSteps }: { stepIndex: number; totalSteps: number }) {
  const pct = Math.round(((stepIndex + 1) / totalSteps) * 100)
  return (
    <div className="space-y-1.5">
      <div
        className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide"
        style={{ color: 'rgba(255,255,255,0.55)' }}
      >
        <span>Step {stepIndex + 1} of {totalSteps}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <div className="h-full transition-all duration-300"
             style={{ width: `${pct}%`, background: 'var(--gradient-primary)' }} />
      </div>
    </div>
  )
}

// ── Section accordion ─────────────────────────────────────────────────────────

interface SectionAccordionProps {
  section:  ManualSection
  index:    number
  isOpen:   boolean
  onToggle: () => void
}

function SectionAccordion({ section, index, isOpen, onToggle }: SectionAccordionProps) {
  return (
    <div style={{
      border:       '1px solid rgba(255,255,255,0.09)',
      borderRadius: 12,
      overflow:     'hidden',
    }}>
      {/* Header */}
      <button
        onClick={onToggle}
        style={{
          width:          '100%',
          display:        'flex',
          alignItems:     'center',
          gap:            10,
          padding:        '13px 16px',
          background:     isOpen ? 'rgba(0,200,255,0.07)' : 'rgba(255,255,255,0.03)',
          border:         'none',
          cursor:         'pointer',
          textAlign:      'left',
          transition:     'background 0.15s',
        }}
      >
        <span style={{
          fontSize:     11,
          fontWeight:   700,
          color:        'rgba(0,200,255,0.7)',
          minWidth:     20,
          flexShrink:   0,
        }}>
          {String(index + 1).padStart(2, '0')}
        </span>
        <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{section.icon}</span>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#ffffff' }}>
          {section.title}
        </span>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>
          {isOpen ? '▲' : '▼'}
        </span>
      </button>

      {/* Body */}
      {isOpen && (
        <div style={{ padding: '0 16px 16px', background: 'rgba(255,255,255,0.02)' }}>
          {/* Paragraphs */}
          <div className="space-y-3 pt-4">
            {section.content.map((para, i) => (
              <p key={i} style={{ fontSize: 13, color: 'rgba(255,255,255,0.80)', lineHeight: 1.65 }}>
                {para}
              </p>
            ))}
          </div>

          {/* Bullet list */}
          {section.bullets && section.bullets.length > 0 && (
            <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {section.bullets.map((b, i) => (
                <li key={i} style={{ fontSize: 13, color: 'rgba(255,255,255,0.78)', lineHeight: 1.5, display: 'flex', gap: 8 }}>
                  <span style={{ color: 'rgba(0,200,255,0.7)', flexShrink: 0 }}>•</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Warning callout */}
          {section.warning && (
            <div style={{
              marginTop:    12,
              padding:      '10px 13px',
              borderRadius: 9,
              background:   'rgba(239,68,68,0.09)',
              border:       '1px solid rgba(239,68,68,0.30)',
              fontSize:     12,
              color:        'rgba(254,202,202,1)',
              lineHeight:   1.55,
            }}>
              ⚠️ {section.warning}
            </div>
          )}

          {/* Tip callout */}
          {section.tip && (
            <div style={{
              marginTop:    12,
              padding:      '10px 13px',
              borderRadius: 9,
              background:   'rgba(34,197,94,0.09)',
              border:       '1px solid rgba(34,197,94,0.25)',
              fontSize:     12,
              color:        'rgba(187,247,208,1)',
              lineHeight:   1.55,
            }}>
              💡 {section.tip}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── DriverManualStep component ────────────────────────────────────────────────

export function DriverManualStep({
  stepIndex,
  totalSteps,
  driverId,
  isCommercialDriver,
  driverProfile,
  onBack,
  onNext,
}: DriverManualStepProps) {
  const manual: DriverManualData = isCommercialDriver ? COMMERCIAL_MANUAL : CONSUMER_MANUAL

  // Fast-track if already acknowledged
  const alreadyDone = Boolean(driverProfile?.manual_acknowledged_at)

  // Accordion state — track which sections are open
  const [openSections, setOpenSections] = useState<Set<string>>(new Set())
  const [acknowledged, setAcknowledged] = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  function toggleSection(id: string) {
    setOpenSections(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  function expandAll() {
    setOpenSections(new Set(manual.sections.map(s => s.id)))
  }

  function collapseAll() {
    setOpenSections(new Set())
  }

  async function submit() {
    if (!acknowledged || saving) return
    setSaving(true)
    setError(null)
    try {
      const { error: upErr } = await supabase
        .from('driver_profiles')
        .upsert(
          {
            driver_id:             driverId,
            manual_acknowledged_at: new Date().toISOString(),
            manual_version:        manualKey(isCommercialDriver),
          },
          { onConflict: 'driver_id' },
        )
      if (upErr) throw upErr
      await onNext()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save manual acknowledgment')
    } finally {
      setSaving(false)
    }
  }

  // ── Already done ────────────────────────────────────────────────────────────
  if (alreadyDone) {
    return (
      <AppShell>
        <div className="mx-auto max-w-2xl px-4 py-8">
          <div className="mb-6">
            <ProgressBar stepIndex={stepIndex} totalSteps={totalSteps} />
          </div>
          <GlassCard variant="elevated" padding="lg">
            <div className="space-y-5">
              <header className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider"
                   style={{ color: 'rgba(0,200,255,0.85)' }}>
                  Cyan&rsquo;s Brooklynn Recycling
                </p>
                <h1 className="text-xl font-semibold text-white">{manual.title}</h1>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>
                  You have already acknowledged this compliance manual.
                </p>
              </header>
              <div style={{
                background:   'rgba(34,197,94,0.12)',
                border:       '1px solid rgba(34,197,94,0.35)',
                borderRadius: 12,
                padding:      '14px 16px',
                color:        'rgba(187,247,208,1)',
                fontSize:     13,
                fontWeight:   600,
              }}>
                ✅ Compliance manual acknowledged. Click Continue to proceed.
              </div>
              <div className="flex items-center justify-between gap-3 pt-2">
                <PrimaryButton variant="secondary" onClick={onBack}>Back</PrimaryButton>
                <PrimaryButton onClick={onNext}>Continue</PrimaryButton>
              </div>
            </div>
          </GlassCard>
        </div>
      </AppShell>
    )
  }

  // ── Main view ───────────────────────────────────────────────────────────────
  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-6">
          <ProgressBar stepIndex={stepIndex} totalSteps={totalSteps} />
        </div>
        <GlassCard variant="elevated" padding="lg">
          <div className="space-y-5">

            {/* Header */}
            <header className="space-y-2">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <p className="text-[11px] font-semibold uppercase tracking-wider"
                   style={{ color: 'rgba(0,200,255,0.85)', margin: 0 }}>
                  Cyan&rsquo;s Brooklynn Recycling
                </p>
                {/* Driver type badge */}
                <span style={{
                  display:      'inline-block',
                  padding:      '2px 9px',
                  borderRadius: 999,
                  fontSize:     10,
                  fontWeight:   700,
                  background:   isCommercialDriver ? 'rgba(168,85,247,0.15)' : 'rgba(0,200,255,0.12)',
                  color:        isCommercialDriver ? 'rgba(216,180,254,1)'   : '#00c8ff',
                  border:       isCommercialDriver ? '1px solid rgba(168,85,247,0.4)' : '1px solid rgba(0,200,255,0.35)',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                }}>
                  {isCommercialDriver ? 'Commercial' : 'Consumer'}
                </span>
              </div>
              <h1 className="text-xl font-semibold text-white">{manual.title}</h1>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
                {manual.subtitle}
              </p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                Version {manual.version} &nbsp;·&nbsp; Effective {manual.effectiveDate}
              </p>
            </header>

            {/* Instruction banner */}
            <div style={{
              padding:      '12px 15px',
              borderRadius: 10,
              background:   'rgba(0,200,255,0.07)',
              border:       '1px solid rgba(0,200,255,0.22)',
              fontSize:     13,
              color:        'rgba(186,230,253,1)',
              lineHeight:   1.55,
            }}>
              📘 Read through each section of this compliance manual. When you are done, check the
              acknowledgment box at the bottom and click <strong>I Have Read This Manual</strong>.
            </div>

            {/* Expand / collapse controls */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={expandAll}
                style={{
                  background: 'none',
                  border:     '1px solid rgba(255,255,255,0.14)',
                  color:      'rgba(255,255,255,0.55)',
                  fontSize:   11,
                  borderRadius: 7,
                  padding:    '4px 10px',
                  cursor:     'pointer',
                }}
              >
                Expand All
              </button>
              <button
                onClick={collapseAll}
                style={{
                  background: 'none',
                  border:     '1px solid rgba(255,255,255,0.14)',
                  color:      'rgba(255,255,255,0.55)',
                  fontSize:   11,
                  borderRadius: 7,
                  padding:    '4px 10px',
                  cursor:     'pointer',
                }}
              >
                Collapse All
              </button>
            </div>

            {/* Section accordions */}
            <div className="space-y-2">
              {manual.sections.map((section, index) => (
                <SectionAccordion
                  key={section.id}
                  section={section}
                  index={index}
                  isOpen={openSections.has(section.id)}
                  onToggle={() => toggleSection(section.id)}
                />
              ))}
            </div>

            {/* Acknowledgment checkbox */}
            <div style={{
              padding:      '14px 16px',
              borderRadius: 12,
              background:   'rgba(0,200,255,0.06)',
              border:       '1px solid rgba(0,200,255,0.2)',
            }}>
              <label style={{
                display:    'flex',
                alignItems: 'flex-start',
                gap:        10,
                cursor:     'pointer',
                userSelect: 'none',
              }}>
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={e => setAcknowledged(e.target.checked)}
                  style={{
                    marginTop:   2,
                    accentColor: '#00c8ff',
                    width:       16,
                    height:      16,
                    flexShrink:  0,
                  }}
                />
                <span style={{
                  fontSize:   13,
                  color:      'rgba(255,255,255,0.88)',
                  fontWeight: 600,
                  lineHeight: 1.5,
                }}>
                  I have read and understood the {manual.title} (Version {manual.version},
                  effective {manual.effectiveDate}). I agree to follow all rules and procedures
                  described in this manual while performing services for Cyan&rsquo;s Brooklynn Recycling.
                </span>
              </label>
            </div>

            {/* Error */}
            {error && (
              <p className="rounded-lg border px-3 py-2 text-xs font-medium"
                 style={{
                   background:  'rgba(239,68,68,0.08)',
                   borderColor: 'rgba(239,68,68,0.35)',
                   color:       'rgba(254,202,202,1)',
                 }}>
                {error}
              </p>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <PrimaryButton variant="secondary" onClick={onBack}>Back</PrimaryButton>
              <PrimaryButton
                onClick={submit}
                disabled={!acknowledged}
                loading={saving}
              >
                I Have Read This Manual
              </PrimaryButton>
            </div>

          </div>
        </GlassCard>
      </div>
    </AppShell>
  )
}
