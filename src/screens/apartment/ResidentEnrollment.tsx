// ResidentEnrollment — /join/:slug
// 5-step resident onboarding flow for apartment communities.
//
// Steps:
//   1. Verify   — Name, Email, Unit, Phone
//   2. Password — Creates Supabase Auth account + profile + links pre-registration
//   3. Video    — Mandatory orientation video (no skip allowed)
//   4. Terms    — Accept ToS, Privacy, Recycling Participation Agreement
//   5. Download — App Store / Play Store links
//
// RULE: The user MUST complete Step 3 (video) before Terms can be accepted.
// RULE: The user MUST complete Step 4 (terms) before Step 5 shows.
// RULE: A single account is created — do NOT create a second account.

import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import {
  getPropertyBySlug,
  createPreRegistration,
  linkUserToPreRegistration,
  markVideoStarted,
  markVideoCompleted,
  markTermsAccepted,
  trackAppDownload,
  type Property,
  type ResidentPreRegistration,
} from '../../lib/apartment'
import { APPLE_APP_STORE_URL, GOOGLE_PLAY_URL } from '../../lib/appConfig'
import { getActiveOnboardingVideo, type OnboardingVideo } from '../../lib/onboardingVideo'

const INPUT: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 12,
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(0,200,255,0.2)',
  color: '#fff',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
}

const LABEL: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: 'rgba(255,255,255,0.6)',
  marginBottom: 6,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.06em',
}

// ── Types ────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4 | 5

interface VerifyData {
  resident_name: string
  email: string
  unit_number: string
  phone: string
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 32 }}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          style={{
            width: i + 1 === current ? 24 : 8,
            height: 8,
            borderRadius: 99,
            background: i + 1 <= current ? '#00c8ff' : 'rgba(255,255,255,0.15)',
            transition: 'all 0.3s',
          }}
        />
      ))}
    </div>
  )
}

function PropertyBadge({ property }: { property: Property }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: 'rgba(0,200,255,0.05)',
        border: '1px solid rgba(0,200,255,0.15)',
        borderRadius: 12,
        padding: '10px 14px',
        marginBottom: 28,
      }}
    >
      <span style={{ fontSize: 20 }}>🏠</span>
      <div>
        <p style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>{property.property_name}</p>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', margin: 0 }}>
          {property.address}, {property.city}, {property.state}
        </p>
      </div>
    </div>
  )
}

// ── Step 1: Verify ────────────────────────────────────────────────────────────

function Step1Verify({
  property,
  onNext,
}: {
  property: Property
  onNext: (data: VerifyData) => void
}) {
  const [form, setForm] = useState<VerifyData>({ resident_name: '', email: '', unit_number: '', phone: '' })
  const [error, setError] = useState<string | null>(null)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!form.resident_name.trim() || !form.email.trim()) {
      setError('Name and email are required.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError('Please enter a valid email address.')
      return
    }
    onNext(form)
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PropertyBadge property={property} />
      <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Welcome! Let&rsquo;s verify you.</h2>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>
        Tell us a bit about yourself so we can set up your recycling account.
      </p>
      <div>
        <label style={LABEL}>Full Name *</label>
        <input style={INPUT} value={form.resident_name} onChange={e => setForm(f => ({ ...f, resident_name: e.target.value }))} placeholder="Jane Smith" required />
      </div>
      <div>
        <label style={LABEL}>Email Address *</label>
        <input style={INPUT} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="jane@example.com" required />
      </div>
      <div>
        <label style={LABEL}>Unit Number</label>
        <input style={INPUT} value={form.unit_number} onChange={e => setForm(f => ({ ...f, unit_number: e.target.value }))} placeholder="4B" />
      </div>
      <div>
        <label style={LABEL}>Phone Number</label>
        <input style={INPUT} type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="(718) 555-0100" />
      </div>
      {error && <p style={{ fontSize: 13, color: '#fca5a5', margin: 0 }}>{error}</p>}
      <button
        type="submit"
        style={{
          background: 'linear-gradient(135deg,#00c8ff,#0057e7)',
          color: '#fff',
          border: 'none',
          borderRadius: 99,
          padding: '14px',
          fontWeight: 800,
          fontSize: 15,
          cursor: 'pointer',
          marginTop: 8,
        }}
      >
        Continue →
      </button>
    </form>
  )
}

// ── Step 2: Password / Account Creation ───────────────────────────────────────

function Step2Password({
  property,
  verifyData,
  preRegId,
  onNext,
}: {
  property: Property
  verifyData: VerifyData
  preRegId: string
  onNext: () => void
}) {
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm)  { setError('Passwords do not match.'); return }

    setLoading(true)
    try {
      // Create Supabase Auth account
      const { data, error: signUpErr } = await supabase.auth.signUp({
        email:    verifyData.email.trim(),
        password: password,
        options: {
          data: {
            full_name: verifyData.resident_name.trim(),
            role:      'consumer',
          },
        },
      })

      if (signUpErr) throw signUpErr
      const userId = data.user?.id
      if (!userId) throw new Error('Account creation failed — no user ID returned.')

      // Insert/update profile row (the auth trigger creates a stub; update it)
      const { error: profErr } = await supabase.from('profiles').upsert({
        id:              userId,
        full_name:       verifyData.resident_name.trim(),
        email:           verifyData.email.trim(),
        phone:           verifyData.phone.trim() || null,
        apartment_unit:  verifyData.unit_number.trim() || null,
        city:            property.city,
        state:           property.state,
        address:         property.address,
        role:            'consumer',
        onboarding_completed: false,
      }, { onConflict: 'id' })

      if (profErr) console.warn('[enrollment] profile upsert warning:', profErr)

      // Link the pre-registration record to this user
      await linkUserToPreRegistration(preRegId, userId)

      onNext()
    } catch (err: unknown) {
      const msg = (err as { message?: string }).message ?? 'Account creation failed.'
      // Surface a friendlier message for duplicate email
      if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('already exists')) {
        setError('An account with this email already exists. Please sign in instead.')
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PropertyBadge property={property} />
      <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Create Your Account</h2>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>
        You&rsquo;re signing up as <strong style={{ color: '#fff' }}>{verifyData.email}</strong>
      </p>
      <div>
        <label style={LABEL}>Password *</label>
        <input
          style={INPUT}
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>
      <div>
        <label style={LABEL}>Confirm Password *</label>
        <input
          style={INPUT}
          type="password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          placeholder="Repeat your password"
          required
          autoComplete="new-password"
        />
      </div>
      {error && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#fca5a5' }}>
          {error}
          {error.includes('already exists') && (
            <span> <Link to="/real-login" style={{ color: '#00c8ff' }}>Sign in →</Link></span>
          )}
        </div>
      )}
      <button
        type="submit"
        disabled={loading}
        style={{
          background: loading ? 'rgba(0,200,255,0.3)' : 'linear-gradient(135deg,#00c8ff,#0057e7)',
          color: '#fff',
          border: 'none',
          borderRadius: 99,
          padding: '14px',
          fontWeight: 800,
          fontSize: 15,
          cursor: loading ? 'not-allowed' : 'pointer',
          marginTop: 8,
        }}
      >
        {loading ? 'Creating account...' : 'Create Account →'}
      </button>
    </form>
  )
}

// ── Step 3: Video ─────────────────────────────────────────────────────────────

function Step3Video({
  preRegId,
  onNext,
}: {
  preRegId: string
  onNext: () => void
}) {
  const [videoWatched, setVideoWatched] = useState(false)
  const [started,      setStarted]      = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [videoRecord,  setVideoRecord]  = useState<OnboardingVideo | null | undefined>(undefined) // undefined = loading
  const videoRef    = useRef<HTMLVideoElement | null>(null)
  // Track the furthest point the user has reached; prevents forward-scrubbing
  const maxReached  = useRef(0)

  useEffect(() => {
    getActiveOnboardingVideo('consumer')
      .then(v => setVideoRecord(v))
      .catch(() => setVideoRecord(null))
  }, [])

  async function handleVideoEnd() {
    setVideoWatched(true)
    setSaving(true)
    try {
      await markVideoCompleted(preRegId)
    } catch (e) {
      console.warn('[enrollment] markVideoCompleted failed:', e)
    } finally {
      setSaving(false)
    }
  }

  async function handlePlay() {
    if (!started) {
      setStarted(true)
      try { await markVideoStarted(preRegId) } catch { /* non-fatal */ }
    }
  }

  function handleTimeUpdate(e: React.SyntheticEvent<HTMLVideoElement>) {
    const vid = e.currentTarget
    if (vid.currentTime > maxReached.current) {
      maxReached.current = vid.currentTime
    }
  }

  function handleSeeking(e: React.SyntheticEvent<HTMLVideoElement>) {
    if (videoWatched) return
    const vid = e.currentTarget
    // Allow rewinding but not scrubbing forward past what has been played
    if (vid.currentTime > maxReached.current + 2) {
      vid.currentTime = maxReached.current
    }
  }

  // Loading state
  if (videoRecord === undefined) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Watch the Orientation</h2>
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid rgba(0,200,255,0.2)', borderTopColor: '#00c8ff', animation: 'spin 0.8s linear infinite' }} />
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // No active video configured
  if (videoRecord === null) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Watch the Orientation</h2>
        <div
          style={{
            background: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.3)',
            borderRadius: 14,
            padding: '28px 24px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <span style={{ fontSize: 36 }}>🎬</span>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#fbbf24', margin: 0 }}>
            Onboarding video is not configured yet.
          </p>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: 0 }}>
            Please contact support at{' '}
            <a href="mailto:support@cbrecycling.org" style={{ color: '#00c8ff' }}>
              support@cbrecycling.org
            </a>
          </p>
        </div>
        <button
          disabled
          style={{
            background: 'rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.3)',
            border: 'none',
            borderRadius: 99,
            padding: '14px',
            fontWeight: 800,
            fontSize: 15,
            cursor: 'not-allowed',
          }}
        >
          Watch the video to continue
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Watch the Orientation</h2>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
        Before you can use the app, please watch this short video about how our
        recycling program works. It takes about 2 minutes.
      </p>

      {/* Video title + description */}
      <div style={{ marginBottom: -8 }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', margin: '0 0 2px' }}>
          {videoRecord.title}
        </p>
        {videoRecord.description && (
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', margin: 0 }}>
            {videoRecord.description}
          </p>
        )}
      </div>

      {/* Video player */}
      <div
        style={{
          borderRadius: 16,
          overflow: 'hidden',
          background: '#000',
          border: '1px solid rgba(0,200,255,0.2)',
          aspectRatio: '16/9',
          position: 'relative',
        }}
      >
        <video
          ref={videoRef}
          src={videoRecord.video_url}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          controls
          controlsList="nodownload"
          onPlay={handlePlay}
          onEnded={handleVideoEnd}
          onTimeUpdate={handleTimeUpdate}
          onSeeking={handleSeeking}
        />
      </div>

      {!videoWatched && (
        <div
          style={{
            background: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.25)',
            borderRadius: 12,
            padding: '12px 14px',
            fontSize: 13,
            color: 'rgba(254,215,170,1)',
          }}
        >
          ⚠ You must watch the entire video before continuing.
        </div>
      )}

      <button
        onClick={onNext}
        disabled={!videoWatched || saving}
        style={{
          background: videoWatched && !saving
            ? 'linear-gradient(135deg,#00c8ff,#0057e7)'
            : 'rgba(255,255,255,0.1)',
          color: videoWatched && !saving ? '#fff' : 'rgba(255,255,255,0.3)',
          border: 'none',
          borderRadius: 99,
          padding: '14px',
          fontWeight: 800,
          fontSize: 15,
          cursor: videoWatched && !saving ? 'pointer' : 'not-allowed',
          transition: 'all 0.3s',
        }}
      >
        {saving ? 'Saving...' : videoWatched ? "I've Watched the Video →" : 'Watch the video to continue'}
      </button>
    </div>
  )
}

// ── Step 4: Terms ─────────────────────────────────────────────────────────────

function Step4Terms({
  preRegId,
  onNext,
}: {
  preRegId: string
  onNext: () => void
}) {
  const [tosChecked,      setTosChecked]      = useState(false)
  const [privacyChecked,  setPrivacyChecked]  = useState(false)
  const [recycleChecked,  setRecycleChecked]  = useState(false)
  const [saving,          setSaving]          = useState(false)
  const [error,           setError]           = useState<string | null>(null)

  const allChecked = tosChecked && privacyChecked && recycleChecked

  async function handleAccept() {
    if (!allChecked) return
    setSaving(true)
    setError(null)
    try {
      await markTermsAccepted(preRegId)
      onNext()
    } catch (e: unknown) {
      setError((e as { message?: string }).message ?? 'Failed to save terms. Please try again.')
      setSaving(false)
    }
  }

  const checkStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(0,200,255,0.15)',
    borderRadius: 12,
    padding: '14px 16px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    cursor: 'pointer',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Accept the Terms</h2>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
        Please read and accept the following agreements to complete enrollment.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Terms of Service */}
        <label style={checkStyle} onClick={() => setTosChecked(c => !c)}>
          <div
            style={{
              width: 20,
              height: 20,
              minWidth: 20,
              borderRadius: 6,
              border: `2px solid ${tosChecked ? '#00c8ff' : 'rgba(255,255,255,0.25)'}`,
              background: tosChecked ? 'rgba(0,200,255,0.2)' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
            }}
          >
            {tosChecked && <span style={{ color: '#00c8ff', fontSize: 12, fontWeight: 800 }}>✓</span>}
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 2px' }}>Terms of Service</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', margin: 0 }}>
              I have read and agree to the{' '}
              <Link to="/legal/terms-of-service" target="_blank" style={{ color: '#00c8ff' }}>Terms of Service</Link>.
            </p>
          </div>
        </label>

        {/* Privacy Policy */}
        <label style={checkStyle} onClick={() => setPrivacyChecked(c => !c)}>
          <div
            style={{
              width: 20,
              height: 20,
              minWidth: 20,
              borderRadius: 6,
              border: `2px solid ${privacyChecked ? '#00c8ff' : 'rgba(255,255,255,0.25)'}`,
              background: privacyChecked ? 'rgba(0,200,255,0.2)' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
            }}
          >
            {privacyChecked && <span style={{ color: '#00c8ff', fontSize: 12, fontWeight: 800 }}>✓</span>}
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 2px' }}>Privacy Policy</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', margin: 0 }}>
              I have read and agree to the{' '}
              <Link to="/legal/privacy-policy" target="_blank" style={{ color: '#00c8ff' }}>Privacy Policy</Link>.
            </p>
          </div>
        </label>

        {/* Recycling Participation Agreement */}
        <label style={checkStyle} onClick={() => setRecycleChecked(c => !c)}>
          <div
            style={{
              width: 20,
              height: 20,
              minWidth: 20,
              borderRadius: 6,
              border: `2px solid ${recycleChecked ? '#00c8ff' : 'rgba(255,255,255,0.25)'}`,
              background: recycleChecked ? 'rgba(0,200,255,0.2)' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
            }}
          >
            {recycleChecked && <span style={{ color: '#00c8ff', fontSize: 12, fontWeight: 800 }}>✓</span>}
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 2px' }}>Recycling Participation Agreement</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', margin: 0 }}>
              I agree to recycle in accordance with Cyan&rsquo;s Brooklynn Recycling
              program guidelines, including proper bag use and pickup scheduling.
            </p>
          </div>
        </label>
      </div>

      {error && (
        <p style={{ fontSize: 13, color: '#fca5a5', margin: 0 }}>{error}</p>
      )}

      <button
        onClick={handleAccept}
        disabled={!allChecked || saving}
        style={{
          background: allChecked && !saving
            ? 'linear-gradient(135deg,#00c8ff,#0057e7)'
            : 'rgba(255,255,255,0.1)',
          color: allChecked && !saving ? '#fff' : 'rgba(255,255,255,0.3)',
          border: 'none',
          borderRadius: 99,
          padding: '14px',
          fontWeight: 800,
          fontSize: 15,
          cursor: allChecked && !saving ? 'pointer' : 'not-allowed',
          transition: 'all 0.3s',
        }}
      >
        {saving ? 'Saving...' : 'Accept & Continue →'}
      </button>
    </div>
  )
}

// ── Step 5: Download ──────────────────────────────────────────────────────────

function Step5Download({ preRegId }: { preRegId: string | null }) {
  const [iosFeedback,     setIosFeedback]     = useState<'idle' | 'clicked' | 'coming-soon'>('idle')
  const [androidFeedback, setAndroidFeedback] = useState<'idle' | 'clicked' | 'coming-soon'>('idle')

  async function handleDownload(platform: 'ios' | 'android') {
    const url = platform === 'ios' ? APPLE_APP_STORE_URL : GOOGLE_PLAY_URL
    const setFeedback = platform === 'ios' ? setIosFeedback : setAndroidFeedback

    // Fire-and-forget tracking — never blocks the user
    if (preRegId) {
      trackAppDownload(preRegId, platform).catch(e =>
        console.warn('[enrollment] trackAppDownload failed (non-fatal):', e),
      )
    }

    if (url) {
      setFeedback('clicked')
      window.open(url, '_blank', 'noopener,noreferrer')
    } else {
      setFeedback('coming-soon')
    }
  }

  function DownloadButton({
    platform,
    emoji,
    label,
    feedback,
  }: {
    platform: 'ios' | 'android'
    emoji: string
    label: string
    feedback: 'idle' | 'clicked' | 'coming-soon'
  }) {
    const hasUrl = platform === 'ios' ? !!APPLE_APP_STORE_URL : !!GOOGLE_PLAY_URL
    const sublabel =
      feedback === 'clicked'      ? 'Opening store…' :
      feedback === 'coming-soon'  ? 'Coming Soon'    :
      hasUrl                      ? 'Download now'   : 'Coming Soon'

    return (
      <button
        onClick={() => handleDownload(platform)}
        style={{
          background: hasUrl ? 'rgba(0,200,255,0.1)' : 'rgba(255,255,255,0.05)',
          border: hasUrl
            ? '1px solid rgba(0,200,255,0.35)'
            : '1px solid rgba(255,255,255,0.15)',
          borderRadius: 14,
          padding: '14px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          cursor: 'pointer',
          transition: 'all 0.2s',
          color: '#fff',
          minWidth: 160,
        }}
      >
        <span style={{ fontSize: 28 }}>{emoji}</span>
        <div style={{ textAlign: 'left' }}>
          <p style={{
            fontSize: 10,
            color: hasUrl ? 'rgba(0,200,255,0.8)' : 'rgba(255,255,255,0.5)',
            margin: '0 0 2px',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}>
            {sublabel}
          </p>
          <p style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{label}</p>
        </div>
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 20 }}>
      <span style={{ fontSize: 64 }}>🎉</span>
      <h2 style={{ fontSize: 24, fontWeight: 900, marginBottom: 4 }}>You&rsquo;re All Set!</h2>
      <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', maxWidth: 380, lineHeight: 1.65 }}>
        Your account is ready. Download the Cyan&rsquo;s Brooklynn Recycling app and
        complete your profile to start earning rewards.
      </p>

      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', marginTop: 8 }}>
        <DownloadButton
          platform="ios"
          emoji="🍎"
          label="App Store"
          feedback={iosFeedback}
        />
        <DownloadButton
          platform="android"
          emoji="🤖"
          label="Google Play"
          feedback={androidFeedback}
        />
      </div>

      <div
        style={{
          background: 'rgba(0,200,255,0.06)',
          border: '1px solid rgba(0,200,255,0.2)',
          borderRadius: 16,
          padding: '20px 24px',
          maxWidth: 380,
          width: '100%',
          textAlign: 'left',
        }}
      >
        <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>While you wait for the app:</p>
        <ul style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.8, paddingLeft: 16, margin: 0 }}>
          <li>Sign in to the web portal at <Link to="/real-login" style={{ color: '#00c8ff' }}>cbrecycling.org</Link></li>
          <li>Complete your profile and preferences</li>
          <li>Join the waitlist for app launch notifications</li>
        </ul>
      </div>

      <Link
        to="/real-login"
        style={{
          background: 'linear-gradient(135deg,#00c8ff,#0057e7)',
          color: '#fff',
          padding: '13px 32px',
          borderRadius: 99,
          fontWeight: 800,
          fontSize: 14,
          textDecoration: 'none',
          display: 'inline-block',
          marginTop: 8,
        }}
      >
        Sign In to Your Account →
      </Link>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ResidentEnrollment() {
  const { slug } = useParams<{ slug: string }>()

  const [step,       setStep]       = useState<Step>(1)
  const [loading,    setLoading]    = useState(true)
  const [notFound,   setNotFound]   = useState(false)
  const [property,   setProperty]   = useState<Property | null>(null)
  const [verifyData, setVerifyData] = useState<VerifyData | null>(null)
  const [preRegId,   setPreRegId]   = useState<string | null>(null)

  useEffect(() => {
    if (!slug) { setNotFound(true); setLoading(false); return }
    getPropertyBySlug(slug)
      .then(result => {
        if (!result) { setNotFound(true) } else { setProperty(result.property) }
        setLoading(false)
      })
      .catch(() => { setNotFound(true); setLoading(false) })
  }, [slug])

  async function handleStep1Next(data: VerifyData) {
    if (!property) return
    // Create pre-registration record immediately so we can track state
    const preReg: ResidentPreRegistration = await createPreRegistration({
      property_id:   property.id,
      resident_name: data.resident_name.trim(),
      email:         data.email.trim(),
      phone:         data.phone.trim() || undefined,
      unit_number:   data.unit_number.trim() || undefined,
    })
    setVerifyData(data)
    setPreRegId(preReg.id)
    setStep(2)
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#060e24' }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', border: '4px solid rgba(0,200,255,0.3)', borderTopColor: '#00c8ff', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }

  if (notFound || !property) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#060e24', color: '#fff', textAlign: 'center', padding: 24 }}>
        <span style={{ fontSize: 56, marginBottom: 20 }}>🔍</span>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>Enrollment Link Not Found</h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 28 }}>
          This enrollment link is not active. Contact your property manager for the correct link.
        </p>
        <Link to="/" style={{ color: '#00c8ff', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>← Back to home</Link>
      </div>
    )
  }

  const STEP_LABELS = ['Verify', 'Account', 'Video', 'Terms', 'Download']

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg,#040a1a 0%,#060e24 100%)',
        color: '#fff',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Nav */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 30,
          background: 'rgba(6,14,36,0.85)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(0,190,255,0.12)',
        }}
      >
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: '#fff' }}>
            <span style={{ fontSize: 20 }}>♻️</span>
            <span style={{ fontWeight: 800, fontSize: 14 }}>Cyan&rsquo;s Brooklynn <span style={{ color: '#00c8ff' }}>Recycling</span></span>
          </Link>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>
            Step {step} of 5 — {STEP_LABELS[step - 1]}
          </span>
        </div>
      </header>

      <main style={{ maxWidth: 560, margin: '0 auto', padding: '40px 24px 80px' }}>
        <StepIndicator current={step} total={5} />

        <div
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(0,200,255,0.12)',
            borderRadius: 20,
            padding: '32px 28px',
          }}
        >
          {step === 1 && (
            <Step1Verify property={property} onNext={handleStep1Next} />
          )}
          {step === 2 && verifyData && preRegId && (
            <Step2Password
              property={property}
              verifyData={verifyData}
              preRegId={preRegId}
              onNext={() => setStep(3)}
            />
          )}
          {step === 3 && preRegId && (
            <Step3Video preRegId={preRegId} onNext={() => setStep(4)} />
          )}
          {step === 4 && preRegId && (
            <Step4Terms preRegId={preRegId} onNext={() => setStep(5)} />
          )}
          {step === 5 && (
            <Step5Download preRegId={preRegId} />
          )}
        </div>
      </main>
    </div>
  )
}
