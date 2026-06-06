import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'

type Props = {
  fundraiserId:   string
  fundraiserName: string
  userId:         string
  onClose:        () => void
  onSuccess:      (amount: number) => void
}

const PRESETS = [5, 10, 25]

export default function CashDonateModal({ fundraiserId, fundraiserName, userId, onClose, onSuccess }: Props) {
  const [selected, setSelected] = useState<number | 'custom'>(10)
  const [custom, setCustom]     = useState('')
  const [phase, setPhase]       = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [errMsg, setErrMsg]     = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (selected === 'custom') inputRef.current?.focus()
  }, [selected])

  const finalAmount = selected === 'custom'
    ? parseFloat(custom.replace(/[^0-9.]/g, '')) || 0
    : selected

  async function handleDonate() {
    if (finalAmount <= 0) { setErrMsg('Please enter a valid donation amount.'); return }
    if (phase === 'submitting') return
    setPhase('submitting')
    setErrMsg('')

    const row = {
      fundraiser_id:  fundraiserId,
      contributor_id: userId,
      amount:         finalAmount,
      type:           'cash' as const,
      notes:          'Cash donation via Cyan\'s Brooklynn app',
      recorded_by:    userId,
    }

    const { error: contribErr } = await supabase
      .from('fundraiser_contributions')
      .insert(row)

    if (contribErr) {
      console.error('[CashDonate] insert failed', {
        code: contribErr.code, message: contribErr.message,
        details: contribErr.details, hint: contribErr.hint, row,
      })
      setErrMsg(`Donation failed (${contribErr.code ?? 'ERR'}): ${contribErr.message}`)
      setPhase('error')
      return
    }

    // Non-fatal — fundraiser total update; contribution is already saved above
    const { error: rpcErr } = await supabase
      .rpc('increment_fundraiser_raised', { fid: fundraiserId, delta: finalAmount })
    if (rpcErr) console.error('[CashDonate] rpc failed', rpcErr.message)

    // Non-fatal — in-app notification
    await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type:    'fundraiser',
        title:   'Cash Donation Recorded',
        body:    'Your cash donation was added to the fundraiser.',
        read:    false,
      })

    setPhase('success')
    onSuccess(finalAmount)
  }

  return (
    <div
      className="fixed inset-0 flex items-end justify-center sm:items-center"
      style={{ background: 'rgba(2,6,18,0.82)', backdropFilter: 'blur(8px)', zIndex: 50 }}
      onClick={onClose}
    >
      <style>{`
        @keyframes donateIn      { from { opacity:0; transform:translateY(40px) } to { opacity:1; transform:translateY(0) } }
        @keyframes donatePop     { from { transform:scale(0.75); opacity:0 }      to { transform:scale(1);    opacity:1 } }
        @keyframes donateSpin    { to   { transform:rotate(360deg) } }
        .donate-input::placeholder { color: rgba(255,255,255,0.2); }
        .donate-input::-webkit-outer-spin-button,
        .donate-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        .donate-input[type=number] { -moz-appearance: textfield; }
      `}</style>

      <div
        className="relative w-full max-w-[440px] rounded-t-3xl sm:rounded-3xl px-6 pt-5 pb-8"
        style={{
          background: 'linear-gradient(180deg, #0d1f3e 0%, #070d22 100%)',
          border:     '1px solid rgba(0,200,255,0.18)',
          boxShadow:  '0 -8px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(0,200,255,0.06)',
          animation:  'donateIn 0.35s cubic-bezier(0.34,1.56,0.64,1)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle (mobile) */}
        <div className="mx-auto mb-5 sm:hidden" style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.12)' }} />

        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-full transition-opacity hover:opacity-70"
          style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)', fontSize: 12, border: 'none', cursor: 'pointer' }}
          aria-label="Close"
        >
          ✕
        </button>

        {/* ── Success ─────────────────────────────────────────────── */}
        {phase === 'success' ? (
          <div className="text-center py-6" style={{ animation: 'donatePop 0.45s cubic-bezier(0.34,1.56,0.64,1)' }}>
            <span style={{ fontSize: 58, display: 'block', marginBottom: 18 }}>🎉</span>
            <p style={{ fontSize: 19, fontWeight: 800, color: '#4ade80', marginBottom: 6 }}>Cash donation recorded.</p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginBottom: 28 }}>
              <span style={{ color: '#ffffff', fontWeight: 700 }}>${finalAmount.toFixed(2)}</span>
              {' '}added to{' '}
              <span style={{ color: '#00c8ff' }}>{fundraiserName}</span>
            </p>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3.5 rounded-xl font-bold text-sm transition-all hover:brightness-110"
              style={{ background: 'linear-gradient(135deg, #059669, #4ade80)', color: '#ffffff', border: 'none', cursor: 'pointer', boxShadow: '0 4px 20px rgba(74,222,128,0.3)' }}
            >
              Done
            </button>
          </div>

        ) : (
          /* ── Donation form ─────────────────────────────────────── */
          <>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#ffffff', marginBottom: 4, lineHeight: 1.3 }}>
              Donate Cash
            </h2>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.42)', marginBottom: 22 }}>
              Support <span style={{ color: '#00c8ff', fontWeight: 600 }}>{fundraiserName}</span> directly.
            </p>

            {/* Preset pills */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              {PRESETS.map(p => {
                const active = selected === p
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => { setSelected(p); setErrMsg('') }}
                    className="py-3 rounded-xl font-bold text-sm transition-all hover:brightness-110 active:scale-[0.97]"
                    style={{
                      background: active ? 'rgba(0,200,255,0.16)' : 'rgba(255,255,255,0.05)',
                      border:     `1px solid ${active ? 'rgba(0,200,255,0.55)' : 'rgba(255,255,255,0.1)'}`,
                      color:      active ? '#00c8ff' : 'rgba(255,255,255,0.6)',
                      cursor:     'pointer',
                      boxShadow:  active ? '0 0 12px rgba(0,200,255,0.12)' : 'none',
                    }}
                  >
                    ${p}
                  </button>
                )
              })}
            </div>

            {/* Custom amount */}
            <div
              className="flex items-center gap-2 px-4 py-3 rounded-xl mb-5 transition-all"
              style={{
                background: selected === 'custom' ? 'rgba(0,200,255,0.07)' : 'rgba(255,255,255,0.04)',
                border:     `1px solid ${selected === 'custom' ? 'rgba(0,200,255,0.4)' : 'rgba(255,255,255,0.1)'}`,
                cursor:     'text',
              }}
              onClick={() => { setSelected('custom'); setErrMsg('') }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: selected === 'custom' ? '#00c8ff' : 'rgba(255,255,255,0.3)', flexShrink: 0 }}>$</span>
              <input
                ref={inputRef}
                type="number"
                min="0.01"
                step="0.01"
                placeholder="Custom amount"
                value={custom}
                onFocus={() => { setSelected('custom'); setErrMsg('') }}
                onChange={e => setCustom(e.target.value)}
                className="flex-1 outline-none bg-transparent text-sm font-semibold donate-input"
                style={{ color: '#ffffff', caretColor: '#00c8ff' }}
              />
            </div>

            {/* Error */}
            {errMsg && (
              <div
                className="rounded-xl px-4 py-3 mb-4 text-xs"
                style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }}
              >
                {errMsg}
              </div>
            )}

            {/* Donate Now button */}
            <button
              type="button"
              onClick={handleDonate}
              disabled={phase === 'submitting'}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-sm transition-all active:scale-[0.98] mb-2"
              style={{
                background: phase === 'submitting'
                  ? 'rgba(0,200,255,0.12)'
                  : 'linear-gradient(135deg, #0057e7 0%, #00aaff 100%)',
                border:    '1px solid rgba(0,200,255,0.35)',
                color:     '#ffffff',
                cursor:    phase === 'submitting' ? 'not-allowed' : 'pointer',
                opacity:   phase === 'submitting' ? 0.75 : 1,
                boxShadow: phase !== 'submitting' ? '0 4px 24px rgba(0,150,255,0.3)' : 'none',
              }}
            >
              {phase === 'submitting' ? (
                <>
                  <span
                    className="w-4 h-4 rounded-full border-2 shrink-0"
                    style={{ borderColor: 'rgba(255,255,255,0.2)', borderTopColor: '#ffffff', animation: 'donateSpin 0.7s linear infinite' }}
                  />
                  Processing…
                </>
              ) : (
                'Donate Now'
              )}
            </button>

            {/* Cancel */}
            <button
              type="button"
              onClick={onClose}
              disabled={phase === 'submitting'}
              className="w-full py-3 rounded-xl text-sm font-medium transition-all hover:brightness-110"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border:     '1px solid rgba(255,255,255,0.1)',
                color:      'rgba(255,255,255,0.45)',
                cursor:     phase === 'submitting' ? 'not-allowed' : 'pointer',
              }}
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  )
}
