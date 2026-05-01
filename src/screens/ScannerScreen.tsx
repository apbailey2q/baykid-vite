import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { QrScanner } from '../components/QrScanner'
import { lookupOrCreateBag, checkDuplicateScan, recordScan } from '../lib/bags'
import { useAuthStore } from '../store/authStore'
import { DEV_BYPASS_AUTH } from '../lib/devBypass'
import type { Bag } from '../types'

type Mode = 'camera' | 'manual'
type ScanState = 'idle' | 'processing' | 'duplicate' | 'error'

export default function ScannerScreen() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [mode, setMode] = useState<Mode>(DEV_BYPASS_AUTH ? 'manual' : 'camera')
  const [scannerKey, setScannerKey] = useState(0)
  const [manualInput, setManualInput] = useState('')
  const [scanState, setScanState] = useState<ScanState>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [pendingBag, setPendingBag] = useState<Bag | null>(null)
  const [cameraBlocked, setCameraBlocked] = useState(false)

  const processScan = async (rawCode: string) => {
    if (!user) return
    setScanState('processing')
    setErrorMsg('')
    try {
      const bag = await lookupOrCreateBag(rawCode)
      const isDuplicate = await checkDuplicateScan(bag.id)
      if (isDuplicate) {
        setPendingBag(bag)
        setScanState('duplicate')
        return
      }
      await recordScan(bag.id, user.id)
      navigate(`/bag/${bag.id}`)
    } catch (err: unknown) {
      setScanState('error')
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  const proceedAnyway = async () => {
    if (!pendingBag || !user) return
    setScanState('processing')
    try {
      await recordScan(pendingBag.id, user.id)
      navigate(`/bag/${pendingBag.id}`)
    } catch (err: unknown) {
      setScanState('error')
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  const reset = () => {
    setScanState('idle')
    setPendingBag(null)
    setErrorMsg('')
    setManualInput('')
    setScannerKey((k) => k + 1)
  }

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (manualInput.trim()) processScan(manualInput.trim())
  }

  const switchMode = (m: Mode) => {
    setMode(m)
    reset()
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#061426' }}>
      <header
        className="flex items-center justify-between px-4 py-3"
        style={{
          background: 'rgba(6,20,38,0.95)',
          borderBottom: '1px solid rgba(0,188,212,0.15)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl font-extrabold" style={{ color: '#00BCD4' }}>BayKid</span>
          <span style={{ color: 'rgba(0,188,212,0.3)' }}>|</span>
          <span className="text-sm font-medium" style={{ color: '#7B909C' }}>Scan Bag</span>
        </div>
        <Link
          to="/"
          className="text-sm transition-opacity hover:opacity-70"
          style={{ color: '#7B909C' }}
        >
          ← Back
        </Link>
      </header>

      <main className="mx-auto max-w-sm px-4 py-6 space-y-4">
        {/* Mode toggle */}
        <div
          className="flex rounded-xl p-1"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(0,188,212,0.15)',
          }}
        >
          {(['camera', 'manual'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className="flex-1 rounded-lg py-2 text-sm font-medium transition-all"
              style={
                mode === m
                  ? {
                      background: 'linear-gradient(135deg, #00BCD4, #0097A7)',
                      color: '#fff',
                      boxShadow: '0 0 10px rgba(0,188,212,0.3)',
                    }
                  : { color: '#7B909C' }
              }
            >
              {m === 'camera' ? 'Camera' : 'Enter Manually'}
            </button>
          ))}
        </div>

        {/* Camera view */}
        {mode === 'camera' && (
          <>
            {cameraBlocked ? (
              <div
                className="rounded-xl p-5 text-center"
                style={{
                  background: 'rgba(255,193,7,0.08)',
                  border: '1px solid rgba(255,193,7,0.25)',
                }}
              >
                <p className="text-sm font-semibold" style={{ color: '#FFD600' }}>Camera access denied</p>
                <p className="mt-1 text-xs" style={{ color: '#B8960C' }}>
                  Allow camera in your browser settings, or use manual entry.
                </p>
                <button
                  onClick={() => switchMode('manual')}
                  className="mt-3 rounded-lg px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                  style={{
                    background: 'rgba(255,193,7,0.25)',
                    border: '1px solid rgba(255,193,7,0.4)',
                    color: '#FFD600',
                  }}
                >
                  Use Manual Entry
                </button>
              </div>
            ) : (
              scanState === 'idle' && (
                <>
                  <QrScanner
                    key={scannerKey}
                    onScan={processScan}
                    onPermissionDenied={() => setCameraBlocked(true)}
                  />
                  <p className="text-center text-xs" style={{ color: '#7B909C' }}>
                    Point your camera at the bag's QR code
                  </p>
                </>
              )
            )}
          </>
        )}

        {/* Manual entry */}
        {mode === 'manual' && scanState !== 'duplicate' && (
          <form onSubmit={handleManualSubmit} className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium" style={{ color: '#E0F7FA' }}>
                Bag ID or Code
              </label>
              <input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value.toUpperCase())}
                placeholder="e.g. BAG-00123"
                autoFocus
                className="w-full rounded-lg px-3 py-2.5 text-sm font-mono outline-none transition border border-[rgba(0,188,212,0.2)] focus:border-[rgba(0,188,212,0.5)] focus:ring-2 focus:ring-[rgba(0,188,212,0.1)] placeholder:text-[#7B909C]"
                style={{ background: 'rgba(255,255,255,0.06)', color: '#E0F7FA' }}
              />
            </div>
            <button
              type="submit"
              disabled={!manualInput.trim() || scanState === 'processing'}
              className="w-full rounded-lg py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{
                background: 'linear-gradient(135deg, #00BCD4, #0097A7)',
                boxShadow: '0 0 12px rgba(0,188,212,0.3)',
              }}
            >
              {scanState === 'processing' ? 'Looking up…' : 'Look Up Bag'}
            </button>
          </form>
        )}

        {/* Processing spinner */}
        {scanState === 'processing' && (
          <div
            className="flex items-center justify-center gap-2 rounded-xl p-4"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(0,188,212,0.15)',
            }}
          >
            <div
              className="h-5 w-5 animate-spin rounded-full border-2 border-t-transparent"
              style={{ borderColor: '#00BCD4', borderTopColor: 'transparent' }}
            />
            <span className="text-sm" style={{ color: '#7B909C' }}>Looking up bag…</span>
          </div>
        )}

        {/* Duplicate warning */}
        {scanState === 'duplicate' && pendingBag && (
          <div
            className="rounded-xl p-4 space-y-3"
            style={{
              background: 'rgba(255,193,7,0.08)',
              border: '1px solid rgba(255,193,7,0.25)',
            }}
          >
            <div className="flex items-start gap-2.5">
              <svg
                className="mt-0.5 h-5 w-5 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                style={{ color: '#FFD600' }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
              </svg>
              <div>
                <p className="text-sm font-semibold" style={{ color: '#FFD600' }}>Duplicate Scan</p>
                <p className="mt-0.5 text-xs" style={{ color: '#B8960C' }}>
                  <span className="font-mono font-bold">{pendingBag.bag_code}</span> was already scanned
                  in the last 5 minutes.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={reset}
                className="flex-1 rounded-lg py-2 text-sm font-medium transition-opacity hover:opacity-70"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,193,7,0.3)',
                  color: '#FFD600',
                }}
              >
                Cancel
              </button>
              <button
                onClick={proceedAnyway}
                className="flex-1 rounded-lg py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{
                  background: 'rgba(255,193,7,0.25)',
                  border: '1px solid rgba(255,193,7,0.4)',
                  color: '#FFD600',
                }}
              >
                Proceed Anyway
              </button>
            </div>
            <button
              onClick={() => navigate(`/bag/${pendingBag.id}`)}
              className="w-full text-center text-xs transition-opacity hover:opacity-70"
              style={{ color: '#FFD600' }}
            >
              View bag without scanning →
            </button>
          </div>
        )}

        {/* Error */}
        {scanState === 'error' && (
          <div
            className="rounded-xl p-4"
            style={{
              background: 'rgba(255,23,68,0.08)',
              border: '1px solid rgba(255,23,68,0.25)',
            }}
          >
            <p className="text-sm font-medium" style={{ color: '#FF1744' }}>{errorMsg}</p>
            <button
              onClick={reset}
              className="mt-2 text-xs font-medium transition-opacity hover:opacity-70"
              style={{ color: '#FF1744' }}
            >
              Try again
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
