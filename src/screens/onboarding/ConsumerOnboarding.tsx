// ── Consumer Onboarding (multi-step wizard) ──────────────────────────────────
// Reachable at /onboarding. Gated by ProtectedRoute: any consumer with
// profile.onboarding_completed === false is redirected here.
//
// Design (this revision):
//   • IN-MEMORY STATE. Steps 1–7 advance locally with no Supabase writes.
//     Exit before Done = nothing persisted. Single batch save runs on the Done
//     button: profiles.update + consumer_preferences.upsert + consumer_favorites
//     replace-set + (optional) avatar upload to the avatars bucket.
//   • Every step has Back + Continue (Welcome has only Continue; an "Exit"
//     control in the header handles backing out before step 1).
//   • Exit shows a confirmation modal: "Stay" or "Leave onboarding". Leave
//     navigates to /login. Welcome-step exit skips the modal (nothing to lose).
//   • Avatar step accepts either a preset emoji OR an uploaded photo. The
//     photo is held as a File in memory + a preview blob URL; it only
//     uploads to Supabase Storage on the final commit.
//
// Storage requirements (run once in Supabase SQL Editor):
//   supabase/migrations/20260524_consumer_onboarding_v2.sql  (schema)
//   supabase/migrations/20260524_avatars_storage.sql         (avatars bucket)
//
// Intentional deferrals (parent paste acknowledged):
//   • Step 8 confetti + sound — needs a confetti library and audio assets.
//   • Step 7 permissions — explainer only; the real Notification /
//     getUserMedia / geolocation requests are a separate task. The three
//     permission booleans in consumer_preferences stay false until real grants.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { logout } from '../../lib/auth'
import { useAuthStore } from '../../store/authStore'
import { celebrate, playPop } from '../../lib/celebrate'
import { AvatarBurst, SparkleLayer, RotatingMessage } from '../../components/Celebration'
import { GlassCard } from '../../components/ui/GlassCard'
import { PrimaryButton } from '../../components/ui/PrimaryButton'

// localStorage key prefix for in-progress onboarding state. Per-user so a
// browser shared between accounts can't leak one user's draft to another.
// Form keystrokes + step transitions are saved here continuously while the
// wizard is active. Cleared on: (a) successful Done, (b) Exit & Clear Progress,
// (c) logout() (see lib/auth.ts).
const ONBOARDING_KEY_PREFIX = 'baykid-onboarding:'

// ── Step model ───────────────────────────────────────────────────────────────

const STEPS = [
  'welcome',
  'profile',
  'recycling',
  'favorites',
  'goals',
  'avatar',
  'permissions',
  'done',
] as const
type StepId = typeof STEPS[number]
const STEP_COUNT = STEPS.length

// ── Static option lists ──────────────────────────────────────────────────────

const FREQUENCIES = ['Daily', 'Weekly', 'Monthly', 'Rarely'] as const
const MATERIALS   = ['Plastic', 'Cardboard', 'Aluminum', 'Glass', 'Electronics', 'Mixed recyclables'] as const
const QR_STATUSES = ['Have it set up', 'Need a bag', 'Not sure yet'] as const

const FAV_CATEGORIES: { key: string; label: string; icon: string; items: string[] }[] = [
  { key: 'restaurants',  label: 'Restaurants',   icon: '🍽️', items: ['Local diner', 'Italian', 'Sushi', 'Mexican', 'Burgers', 'Vegan'] },
  { key: 'coffee',       label: 'Coffee Shops',  icon: '☕', items: ['Independent café', 'Roaster', 'Tea house', 'Drive-thru'] },
  { key: 'bars',         label: 'Bars & Lounges',icon: '🍻', items: ['Cocktail bar', 'Brewery', 'Wine bar', 'Sports bar'] },
  { key: 'shopping',     label: 'Shopping',      icon: '🛍️', items: ['Boutique', 'Thrift', 'Mall', 'Outdoor'] },
  { key: 'groceries',    label: 'Groceries',     icon: '🛒', items: ['Farmers market', 'Organic', 'Big-box', 'Bodega'] },
  { key: 'gyms',         label: 'Gyms & Wellness',icon: '🏋️', items: ['Gym', 'Yoga', 'CrossFit', 'Pilates'] },
  { key: 'entertainment',label: 'Entertainment', icon: '🎭', items: ['Concerts', 'Theater', 'Cinema', 'Comedy'] },
  { key: 'sports',       label: 'Sports',        icon: '🏟️', items: ['Football', 'Basketball', 'Baseball', 'Soccer'] },
  { key: 'eco_brands',   label: 'Eco Brands',    icon: '🌱', items: ['Refill stores', 'Zero-waste', 'Local makers'] },
  { key: 'pets',         label: 'Pet Stores',    icon: '🐾', items: ['Pet supply', 'Groomer', 'Vet'] },
]

const GREEN_GOALS = [
  { key: 'earn_rewards',       label: 'Earn rewards',            icon: '🎁' },
  { key: 'help_env',           label: 'Help the environment',    icon: '🌍' },
  { key: 'reduce_waste',       label: 'Reduce waste',            icon: '♻️' },
  { key: 'compete',            label: 'Compete in rankings',     icon: '🏆' },
  { key: 'support_local',      label: 'Support local businesses',icon: '🏪' },
  { key: 'clean_neighborhood', label: 'Cleaner neighborhoods',   icon: '✨' },
] as const

const AVATARS = ['🦊', '🐢', '🐳', '🦉', '🐝', '🌿'] as const

// ── Shared styles ────────────────────────────────────────────────────────────

const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 12,
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(0,190,255,0.2)',
  color: '#fff',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
}

// ── Form state ───────────────────────────────────────────────────────────────

interface FormState {
  // → profiles
  full_name: string
  phone: string
  address: string
  apartment_unit: string
  city: string
  state: string
  zip_code: string
  // → consumer_preferences
  recycling_frequency: string
  recycle_types: string[]
  household_size: string                  // string in form; coerced to int on save
  qr_bag_status: string
  green_goals: string[]
  avatar_choice: string                   // emoji or existing URL
  // → consumer_favorites
  favorites: Record<string, string[]>     // category → selected item_names
}

const BLANK_FORM: FormState = {
  full_name: '', phone: '', address: '', apartment_unit: '', city: '', state: '', zip_code: '',
  recycling_frequency: '', recycle_types: [], household_size: '',
  qr_bag_status: '', green_goals: [], avatar_choice: '', favorites: {},
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ConsumerOnboarding() {
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()

  const [stepIdx, setStepIdx]       = useState(0)
  const [form, setForm]             = useState<FormState>(() => ({
    ...BLANK_FORM,
    // Convenience pre-fill from existing profile (does NOT count as "saved
    // onboarding data"; just removes re-typing for the name field).
    full_name: profile?.full_name ?? '',
  }))
  const [avatarFile, setAvatarFile]       = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [showExit, setShowExit]           = useState(false)
  const [error, setError]                 = useState<string | null>(null)
  const [hydrated, setHydrated]           = useState(false)

  const onboardingKey = user ? `${ONBOARDING_KEY_PREFIX}${user.id}` : null
  const lastLoggedStep = useRef<number | null>(null)

  // ── Already-completed users skip the wizard entirely ─────────────────────

  useEffect(() => {
    if (profile && (profile as { onboarding_completed?: boolean }).onboarding_completed) {
      console.log('[onboarding] already completed — redirecting to /dashboard/consumer')
      navigate('/dashboard/consumer', { replace: true })
    }
  }, [profile, navigate])

  // ── Hydrate from localStorage so refresh resumes mid-flow ────────────────
  // Runs once per user. The avatar File can't be serialised, so an uploaded
  // photo is lost across refresh (the rest of the form survives). The emoji
  // `avatar_choice` is a string and persists fine.

  useEffect(() => {
    if (!onboardingKey) return
    try {
      const raw = localStorage.getItem(onboardingKey)
      if (raw) {
        const saved = JSON.parse(raw) as { stepIdx?: number; form?: Partial<FormState> }
        if (saved.form) {
          setForm(prev => ({ ...prev, ...saved.form }))
        }
        if (typeof saved.stepIdx === 'number' && saved.stepIdx >= 0 && saved.stepIdx < STEP_COUNT) {
          setStepIdx(saved.stepIdx)
          lastLoggedStep.current = saved.stepIdx
        }
        console.log('[onboarding] restored from storage', {
          stepIdx: saved.stepIdx,
          fieldsRestored: saved.form ? Object.keys(saved.form).length : 0,
        })
      }
    } catch (e) {
      console.warn('[onboarding] failed to restore from storage:', e)
    }
    setHydrated(true)
  }, [onboardingKey])

  // ── Persist on every form / step change (post-hydration) ─────────────────
  // Step-change persistence is logged (meaningful checkpoint). Per-keystroke
  // saves still happen but are silent to keep the console readable.

  useEffect(() => {
    if (!hydrated || !onboardingKey) return
    try {
      localStorage.setItem(onboardingKey, JSON.stringify({ stepIdx, form }))
      if (lastLoggedStep.current !== stepIdx) {
        console.log('[onboarding] data persisted', { stepIdx })
        lastLoggedStep.current = stepIdx
      }
    } catch (e) {
      console.warn('[onboarding] failed to persist:', e)
    }
  }, [hydrated, onboardingKey, stepIdx, form])

  function clearOnboardingStorage() {
    if (!onboardingKey) return
    try { localStorage.removeItem(onboardingKey) } catch { /* non-fatal */ }
    console.log('[onboarding] cleared')
  }

  // ── Object-URL cleanup for the avatar preview ────────────────────────────

  useEffect(() => () => { if (avatarPreview) URL.revokeObjectURL(avatarPreview) }, [avatarPreview])

  // ── Helpers ───────────────────────────────────────────────────────────────

  const step: StepId = STEPS[stepIdx]
  const progress = ((stepIdx + 1) / STEP_COUNT) * 100

  const setField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }, [])

  function goNext() {
    // Per-step validation (in-memory only — no DB write).
    if (step === 'profile') {
      if (
        !form.full_name.trim() || !form.address.trim() ||
        !form.city.trim() || !form.state.trim() || !form.zip_code.trim()
      ) {
        setError('Full name, address, city, state, and ZIP are required.')
        return
      }
    }
    setError(null)
    const next = STEPS[Math.min(stepIdx + 1, STEP_COUNT - 1)]
    console.log('[onboarding] step changed', { from: step, to: next, direction: 'next' })
    setStepIdx(i => Math.min(i + 1, STEP_COUNT - 1))
  }

  function goBack() {
    setError(null)
    const prev = STEPS[Math.max(stepIdx - 1, 0)]
    console.log('[onboarding] step changed', { from: step, to: prev, direction: 'back' })
    setStepIdx(i => Math.max(i - 1, 0))
  }

  // ── Exit flow ─────────────────────────────────────────────────────────────
  // Always confirm. Confirming clears local onboarding state AND signs the
  // user out, then hard-redirects to /real-login (the real email/password
  // screen — /login is the demo-role launcher, not the real auth form).
  // Signing out is required to avoid a routing loop: a still-signed-in
  // consumer with onboarding_completed=false would be bounced back to
  // /onboarding by ProtectedRoute the moment they hit /real-login.

  function tryExit() {
    console.log('[onboarding] exit requested')
    setShowExit(true)
  }
  async function confirmExit() {
    console.log('[onboarding] exit confirmed — clearing onboarding state')
    clearOnboardingStorage()
    console.log('[onboarding] redirected to login')
    // logout() in lib/auth.ts: signOut + clearAuth + clears auth localStorage
    // keys (including all baykid-onboarding:*) + hard nav to /real-login.
    await logout()
  }
  function cancelExit() {
    console.log('[onboarding] exit cancelled — staying in onboarding')
    setShowExit(false)
  }

  // ── Avatar file selection ────────────────────────────────────────────────

  function onPickAvatarFile(file: File | null) {
    console.log('[onboarding] avatar: file selected', { name: file?.name, size: file?.size, type: file?.type })
    if (avatarPreview) URL.revokeObjectURL(avatarPreview)
    setAvatarFile(file)
    if (file) {
      setAvatarPreview(URL.createObjectURL(file))
      // Clear emoji choice — uploaded photo wins when set.
      setForm(prev => ({ ...prev, avatar_choice: '' }))
    } else {
      setAvatarPreview(null)
    }
  }
  function clearAvatarFile() {
    console.log('[onboarding] avatar: cleared uploaded photo')
    if (avatarPreview) URL.revokeObjectURL(avatarPreview)
    setAvatarFile(null)
    setAvatarPreview(null)
  }

  // ── Done-step state: celebration + auto-save + auto-redirect ─────────────

  const [committing, setCommitting]     = useState(false)
  const [committed, setCommitted]       = useState(false)
  const [commitError, setCommitError]   = useState<string | null>(null)
  const doneRanOnceRef                  = useRef(false)

  // Pure commit — saves to Supabase, throws on error, no UI state side-effects
  // and no redirect. Called by runDoneFlow (which handles UI + redirect).
  async function commitToSupabase() {
    if (!user) throw new Error('Not signed in.')

    const wrap = (label: string, err: unknown): Error => {
      console.error(`[onboarding] ${label} error (full):`, err)
      const e = err as { message?: string; code?: string; hint?: string }
      return new Error(
        [e?.message, e?.code && `(${e.code})`, e?.hint && `hint: ${e.hint}`]
          .filter(Boolean).join(' ') || `${label} failed`,
      )
    }

    let avatarValue: string | null = form.avatar_choice || null

    // 0. Upload avatar photo if the user chose one
    if (avatarFile) {
        const ext = (avatarFile.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
        const path = `${user.id}/${Date.now()}.${ext}`
        console.log('[onboarding] avatar: uploading to avatars/' + path)
        const { error: upErr } = await supabase.storage.from('avatars').upload(path, avatarFile, {
          contentType: avatarFile.type || 'image/jpeg',
          upsert: true,
        })
        if (upErr) {
          console.error('[onboarding] avatar: upload error (full):', upErr)
          const msg = upErr.message?.toLowerCase() ?? ''
          if (msg.includes('bucket') || msg.includes('not found')) {
            throw new Error(
              'Avatar upload failed: the "avatars" storage bucket is missing. ' +
              'Run supabase/migrations/20260524_avatars_storage.sql in the Supabase SQL Editor, then try again.',
            )
          }
          throw new Error(`Avatar upload failed: ${upErr.message}`)
        }
        const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path)
        avatarValue = pub?.publicUrl ?? null
        console.log('[onboarding] avatar: uploaded →', avatarValue)
      }

    // 1. profiles — identity + completion state + avatar
    // avatar_url is the unified avatar column the dashboard / Welcome Back
    // page read from. We also still write avatar_choice on consumer_preferences
    // below for back-compat with any existing reader.
    const profPayload: Record<string, unknown> = {
      full_name:               form.full_name.trim() || null,
      phone:                   form.phone.trim() || null,
      address:                 form.address.trim() || null,
      apartment_unit:          form.apartment_unit.trim() || null,
      city:                    form.city.trim() || null,
      state:                   form.state.trim() || null,
      zip_code:                form.zip_code.trim() || null,
      avatar_url:              avatarValue,
      onboarding_step:         STEP_COUNT - 1,
      onboarding_completed:    true,
      onboarding_completed_at: new Date().toISOString(),
    }
    console.log('[onboarding] save: profiles.update', profPayload)
    const { error: profErr } = await supabase.from('profiles').update(profPayload).eq('id', user.id)
    if (profErr) throw wrap('profiles.update', profErr)

    // 2. consumer_preferences — upsert keyed by user_id
    const prefPayload: Record<string, unknown> = {
      user_id:               user.id,
      recycling_frequency:   form.recycling_frequency || null,
      recycle_types:         form.recycle_types,
      household_size:        form.household_size ? parseInt(form.household_size, 10) || null : null,
      qr_bag_status:         form.qr_bag_status || null,
      green_goals:           form.green_goals,
      avatar_choice:         avatarValue,
    }
    console.log('[onboarding] save: consumer_preferences.upsert', prefPayload)
    const { error: prefErr } = await supabase
      .from('consumer_preferences')
      .upsert(prefPayload, { onConflict: 'user_id' })
    if (prefErr) throw wrap('consumer_preferences.upsert', prefErr)

    // 3. consumer_favorites — replace set
    const rows: { user_id: string; category: string; item_name: string }[] = []
    for (const [cat, items] of Object.entries(form.favorites)) {
      for (const item_name of items) rows.push({ user_id: user.id, category: cat, item_name })
    }
    console.log('[onboarding] save: consumer_favorites replace-set →', rows.length, 'rows')
    const { error: delErr } = await supabase.from('consumer_favorites').delete().eq('user_id', user.id)
    if (delErr) throw wrap('consumer_favorites.delete', delErr)
    if (rows.length > 0) {
      const { error: insErr } = await supabase.from('consumer_favorites').insert(rows)
      if (insErr) throw wrap('consumer_favorites.insert', insErr)
    }

    // Wipe the draft now that it's been committed to Supabase.
    clearOnboardingStorage()
  }

  // ── Done-flow runner: celebrate + commit + min-hold + redirect ────────────
  // Auto-fires when the wizard reaches the Done step. The user does NOT need
  // to click anything; a "Go now" button is offered as a manual skip but is
  // only enabled once the save has succeeded.

  const runDoneFlow = useCallback(async () => {
    if (committing) return
    setCommitting(true)
    setCommitError(null)
    // Enforce minimum display time so the celebration is visible even when
    // the Supabase write returns in <100ms.
    const minHold = new Promise<void>(r => window.setTimeout(r, 2800))
    try {
      await Promise.all([minHold, commitToSupabase()])
      setCommitted(true)
      console.log('[celebration] auto redirect started → /dashboard/consumer')
      // Hard nav so the auth-store gate re-evaluates against the fresh
      // onboarding_completed = true on next render.
      console.log('[celebration] redirected to dashboard')
      window.location.href = '/dashboard/consumer'
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Save failed'
      console.error('[onboarding] commit error:', msg)
      setCommitError(msg)
      doneRanOnceRef.current = false   // allow retry from the UI
    } finally {
      setCommitting(false)
    }
    // commitToSupabase reads form/avatarFile/user via closure — refs are stable
    // so we only need committing as a guard dep here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committing])

  useEffect(() => {
    if (step !== 'done') return
    if (doneRanOnceRef.current) return
    doneRanOnceRef.current = true
    console.log('[celebration] mounted (onboarding done)')
    window.setTimeout(() => {
      playPop()
      console.log('[celebration] sound played')
      celebrate()
      console.log('[celebration] confetti fired')
    }, 180)
    runDoneFlow()
  }, [step, runDoneFlow])

  function goNowFromDone() {
    if (!committed) return       // gated until save succeeds
    console.log('[onboarding] Go now clicked → /dashboard/consumer')
    window.location.href = '/dashboard/consumer'
  }
  function retryCommit() {
    console.log('[onboarding] retry commit')
    doneRanOnceRef.current = false
    runDoneFlow()
  }

  // ── UI ────────────────────────────────────────────────────────────────────

  return (
    <div
      className="relative min-h-screen flex flex-col items-center px-4 pt-10 pb-12 overflow-hidden"
      style={{ background: 'linear-gradient(180deg,#060e24 0%,#040a1a 100%)' }}
    >
      <div className="pointer-events-none absolute inset-0 grid-bg" />
      <div className="pointer-events-none absolute" style={{ top: -90, left: -50, width: 300, height: 300, background: 'rgba(0,87,231,0.22)', filter: 'blur(72px)', borderRadius: '50%' }} />
      <div className="pointer-events-none absolute" style={{ bottom: -60, right: -40, width: 220, height: 220, background: 'rgba(94,234,212,0.08)', filter: 'blur(64px)', borderRadius: '50%' }} />

      <div className="relative w-full max-w-md" style={{ zIndex: 1 }}>
        {/* Header row: progress + exit */}
        <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Step {stepIdx + 1} of {STEP_COUNT}
              </span>
              <span style={{ fontSize: 10, color: '#00c8ff', fontWeight: 700 }}>{Math.round(progress)}%</span>
            </div>
            <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg,#0057e7,#00c8ff)', borderRadius: 4, transition: 'width 0.5s ease' }} />
            </div>
          </div>
          <button
            onClick={tryExit}
            type="button"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 999,
              color: 'rgba(255,255,255,0.55)',
              padding: '6px 12px',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            ← Exit
          </button>
        </div>

        <GlassCard padding="none" className="w-full px-5 py-7">
          {step === 'welcome'     && <StepWelcome onContinue={goNext} />}
          {step === 'profile'     && <StepProfile     form={form} setField={setField} onBack={goBack} onContinue={goNext} />}
          {step === 'recycling'   && <StepRecycling   form={form} setField={setField} onBack={goBack} onContinue={goNext} />}
          {step === 'favorites'   && <StepFavorites   form={form} setForm={setForm}   onBack={goBack} onContinue={goNext} onSkip={goNext} />}
          {step === 'goals'       && <StepGoals       form={form} setField={setField} onBack={goBack} onContinue={goNext} />}
          {step === 'avatar'      && (
            <StepAvatar
              form={form} setField={setField}
              avatarFile={avatarFile} avatarPreview={avatarPreview}
              onPickFile={onPickAvatarFile} onClearFile={clearAvatarFile}
              onBack={goBack} onContinue={goNext}
            />
          )}
          {step === 'permissions' && <StepPermissions onBack={goBack} onContinue={goNext} />}
          {step === 'done'        && (
            <StepDone
              form={form} avatarPreview={avatarPreview}
              committing={committing} committed={committed} commitError={commitError}
              onGoNow={goNowFromDone} onRetry={retryCommit}
            />
          )}

          {error && (
            <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', fontSize: 13, lineHeight: 1.5 }}>
              {error}
            </div>
          )}
        </GlassCard>
      </div>

      {showExit && <ExitConfirm onStay={cancelExit} onLeave={confirmExit} />}
    </div>
  )
}

// ── Step components ──────────────────────────────────────────────────────────

function StepWelcome({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="text-center" style={{ animation: 'fadeSlideUp 0.4s ease both' }}>
      <div style={{ position: 'relative', display: 'inline-flex', marginBottom: 20 }}>
        <div style={{ position: 'absolute', inset: -20, background: 'radial-gradient(circle, rgba(0,200,255,0.35), transparent 70%)', filter: 'blur(20px)' }} />
        <img src="/logo.png" alt="" style={{ width: 160, height: 160, position: 'relative' }} />
      </div>
      <h1 style={{ fontSize: 24, fontWeight: 600, color: '#fff', marginBottom: 8 }}>
        Welcome to Cyan&apos;s Brooklynn Recycling Enterprise
      </h1>
      <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', marginBottom: 28, lineHeight: 1.6 }}>
        Recycle smarter. Earn rewards. Help your community.
      </p>
      <PrimaryButton onClick={onContinue}>Get started →</PrimaryButton>
    </div>
  )
}

function StepProfile({ form, setField, onBack, onContinue }: {
  form: FormState
  setField: <K extends keyof FormState>(k: K, v: FormState[K]) => void
  onBack: () => void; onContinue: () => void
}) {
  return (
    <div>
      <StepHeader title="Profile setup" subtitle="We need a few details to set up your pickups." />
      <Labeled label="Full name *">
        <input style={INPUT_STYLE} value={form.full_name} onChange={e => setField('full_name', e.target.value)} placeholder="Jane Smith" />
      </Labeled>
      <Labeled label="Phone number">
        <input style={INPUT_STYLE} value={form.phone} onChange={e => setField('phone', e.target.value)} placeholder="(555) 123-4567" />
      </Labeled>
      <Labeled label="Address *">
        <input style={INPUT_STYLE} value={form.address} onChange={e => setField('address', e.target.value)} placeholder="123 Main St" />
      </Labeled>
      <Labeled label="Apartment / Unit">
        <input style={INPUT_STYLE} value={form.apartment_unit} onChange={e => setField('apartment_unit', e.target.value)} placeholder="Apt 4B" />
      </Labeled>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10 }}>
        <Labeled label="City *">
          <input style={INPUT_STYLE} value={form.city} onChange={e => setField('city', e.target.value)} />
        </Labeled>
        <Labeled label="State *">
          <input style={INPUT_STYLE} value={form.state} onChange={e => setField('state', e.target.value)} placeholder="TN" maxLength={2} />
        </Labeled>
        <Labeled label="ZIP *">
          <input style={INPUT_STYLE} value={form.zip_code} onChange={e => setField('zip_code', e.target.value)} maxLength={10} />
        </Labeled>
      </div>
      <NavRow onBack={onBack} onContinue={onContinue} />
    </div>
  )
}

function StepRecycling({ form, setField, onBack, onContinue }: {
  form: FormState
  setField: <K extends keyof FormState>(k: K, v: FormState[K]) => void
  onBack: () => void; onContinue: () => void
}) {
  return (
    <div>
      <StepHeader title="Your recycling profile" subtitle="Helps us schedule pickups that fit your life." />
      <Labeled label="How often do you recycle?">
        <ChipRow options={FREQUENCIES as readonly string[]} value={form.recycling_frequency} onSelect={v => setField('recycling_frequency', v)} />
      </Labeled>
      <Labeled label="What do you recycle most? (pick any)">
        <ChipMultiRow
          options={MATERIALS as readonly string[]}
          values={form.recycle_types}
          onToggle={v => setField('recycle_types',
            form.recycle_types.includes(v)
              ? form.recycle_types.filter(x => x !== v)
              : [...form.recycle_types, v],
          )}
        />
      </Labeled>
      <Labeled label="Household size">
        <input type="number" min={1} max={20} style={INPUT_STYLE} value={form.household_size} onChange={e => setField('household_size', e.target.value)} placeholder="1" />
      </Labeled>
      <Labeled label="QR bag setup">
        <ChipRow options={QR_STATUSES as readonly string[]} value={form.qr_bag_status} onSelect={v => setField('qr_bag_status', v)} />
      </Labeled>
      <NavRow onBack={onBack} onContinue={onContinue} />
    </div>
  )
}

function StepFavorites({ form, setForm, onBack, onContinue, onSkip }: {
  form: FormState
  setForm: React.Dispatch<React.SetStateAction<FormState>>
  onBack: () => void; onContinue: () => void; onSkip: () => void
}) {
  function toggle(category: string, name: string) {
    setForm(prev => {
      const cur = prev.favorites[category] ?? []
      const next = cur.includes(name) ? cur.filter(n => n !== name) : [...cur, name]
      return { ...prev, favorites: { ...prev.favorites, [category]: next } }
    })
  }
  const totalSelected = Object.values(form.favorites).reduce((n, arr) => n + arr.length, 0)
  return (
    <div>
      <StepHeader
        title="Favorites & community interests"
        subtitle="Your community favorites help us create better rewards."
      />
      <div style={{ maxHeight: 380, overflowY: 'auto', marginBottom: 14, paddingRight: 4 }}>
        {FAV_CATEGORIES.map(cat => (
          <div key={cat.key} style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>{cat.icon}</span>{cat.label}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {cat.items.map(name => {
                const sel = (form.favorites[cat.key] ?? []).includes(name)
                return (
                  <button key={name} onClick={() => toggle(cat.key, name)} type="button"
                    style={{
                      padding: '6px 12px', borderRadius: 999, fontSize: 12, cursor: 'pointer',
                      background: sel ? 'rgba(0,200,255,0.14)' : 'rgba(255,255,255,0.04)',
                      border: sel ? '1px solid rgba(0,200,255,0.4)' : '1px solid rgba(255,255,255,0.08)',
                      color: sel ? '#00c8ff' : 'rgba(255,255,255,0.55)',
                      fontWeight: sel ? 700 : 400,
                    }}>{name}</button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 12, textAlign: 'center' }}>
        {totalSelected} selected
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <PrimaryButton variant="secondary" onClick={onBack}>Back</PrimaryButton>
        <PrimaryButton variant="secondary" onClick={onSkip}>Skip</PrimaryButton>
        <div style={{ flex: 1 }}>
          <PrimaryButton onClick={onContinue}>Continue</PrimaryButton>
        </div>
      </div>
    </div>
  )
}

function StepGoals({ form, setField, onBack, onContinue }: {
  form: FormState
  setField: <K extends keyof FormState>(k: K, v: FormState[K]) => void
  onBack: () => void; onContinue: () => void
}) {
  function toggle(key: string) {
    setField('green_goals',
      form.green_goals.includes(key) ? form.green_goals.filter(g => g !== key) : [...form.green_goals, key],
    )
  }
  return (
    <div>
      <StepHeader title="Your green goals" subtitle="What do you most want to get out of recycling?" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
        {GREEN_GOALS.map(g => {
          const sel = form.green_goals.includes(g.key)
          return (
            <button key={g.key} onClick={() => toggle(g.key)} type="button"
              style={{
                padding: '14px 12px', borderRadius: 14, cursor: 'pointer',
                background: sel ? 'rgba(0,200,255,0.1)' : 'rgba(255,255,255,0.04)',
                border: sel ? '1px solid rgba(0,200,255,0.4)' : '1px solid rgba(255,255,255,0.08)',
                color: '#fff', textAlign: 'left',
              }}>
              <div style={{ fontSize: 22, marginBottom: 4 }}>{g.icon}</div>
              <div style={{ fontSize: 12, fontWeight: sel ? 700 : 500 }}>{g.label}</div>
            </button>
          )
        })}
      </div>
      <NavRow onBack={onBack} onContinue={onContinue} />
    </div>
  )
}

function StepAvatar({
  form, setField, avatarFile, avatarPreview, onPickFile, onClearFile, onBack, onContinue,
}: {
  form: FormState
  setField: <K extends keyof FormState>(k: K, v: FormState[K]) => void
  avatarFile: File | null
  avatarPreview: string | null
  onPickFile: (f: File | null) => void
  onClearFile: () => void
  onBack: () => void; onContinue: () => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const hasUpload = !!avatarFile && !!avatarPreview

  return (
    <div>
      <StepHeader title="Pick your avatar" subtitle="Choose a preset or upload your own photo. You can change it later." />

      {/* Preview ring */}
      <div style={{ textAlign: 'center', marginBottom: 22 }}>
        <div style={{ position: 'relative', display: 'inline-flex', width: 96, height: 96, alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: -10, background: 'radial-gradient(circle, rgba(0,200,255,0.45), transparent 70%)', filter: 'blur(16px)' }} />
          <div style={{
            position: 'relative', width: 88, height: 88, borderRadius: '50%',
            background: 'rgba(0,200,255,0.08)', border: '2px solid rgba(0,200,255,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 44, overflow: 'hidden',
            animation: 'fadeSlideUp 0.35s ease both',
          }}>
            {hasUpload
              ? <img src={avatarPreview!} alt="avatar preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : (form.avatar_choice || '🙂')}
          </div>
        </div>
      </div>

      {/* Emoji picker — disabled visually when a photo is uploaded */}
      <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
        Preset avatars
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginBottom: 18, opacity: hasUpload ? 0.5 : 1 }}>
        {AVATARS.map(a => {
          const sel = !hasUpload && form.avatar_choice === a
          return (
            <button key={a} type="button"
              onClick={() => {
                if (hasUpload) onClearFile()
                setField('avatar_choice', a)
              }}
              style={{
                width: 56, height: 56, borderRadius: '50%', fontSize: 26, cursor: 'pointer',
                background: sel ? 'rgba(0,200,255,0.14)' : 'rgba(255,255,255,0.05)',
                border: sel ? '2px solid rgba(0,200,255,0.5)' : '1px solid rgba(255,255,255,0.08)',
                transform: sel ? 'scale(1.08)' : 'scale(1)', transition: 'all 0.18s ease',
              }}>{a}</button>
          )
        })}
      </div>

      {/* Upload section */}
      <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
        Or upload your own
      </p>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        style={{ display: 'none' }}
        onChange={e => {
          const f = e.target.files?.[0] ?? null
          if (f && f.size > 5 * 1024 * 1024) {
            console.warn('[onboarding] avatar: file too large', f.size)
            alert('Image must be 5MB or smaller.')
            e.target.value = ''
            return
          }
          onPickFile(f)
          e.target.value = ''
        }}
      />
      <div style={{ display: 'flex', gap: 8, marginBottom: 22 }}>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          style={{
            flex: 1, padding: '10px 12px', borderRadius: 12, cursor: 'pointer',
            background: 'rgba(0,200,255,0.06)', border: '1px dashed rgba(0,200,255,0.35)',
            color: '#00c8ff', fontSize: 13, fontWeight: 600,
          }}
        >
          {hasUpload ? 'Choose a different photo' : '📷 Upload photo'}
        </button>
        {hasUpload && (
          <button
            type="button"
            onClick={onClearFile}
            style={{
              padding: '10px 14px', borderRadius: 12, cursor: 'pointer',
              background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)',
              color: '#f87171', fontSize: 13, fontWeight: 600,
            }}
          >
            Remove
          </button>
        )}
      </div>

      <NavRow onBack={onBack} onContinue={onContinue} />
    </div>
  )
}

function StepPermissions({ onBack, onContinue }: { onBack: () => void; onContinue: () => void }) {
  return (
    <div>
      <StepHeader title="App permissions" subtitle="We only ask for what each feature needs." />
      <PermissionCard icon="📷" label="Camera" reason="Scan QR codes on your recycling bags." />
      <PermissionCard icon="🔔" label="Notifications" reason="Pickup confirmations, reward unlocks, route updates." />
      <PermissionCard icon="📍" label="Location" reason="Match you to local drivers and neighborhood rewards." />
      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 14, lineHeight: 1.5 }}>
        You&apos;ll be asked by your browser when each feature is first used. You can change these anytime in your device settings.
      </p>
      <NavRow onBack={onBack} onContinue={onContinue} continueLabel="Continue" />
    </div>
  )
}

// Done is the AUTO-celebration screen — no Back, no manual Finish.
// The parent kicks off save + confetti + pop + min-hold and hard-redirects
// when both finish. "Go now →" is offered as a manual skip once the save
// has succeeded. On error a Retry button is shown. Visual primitives match
// the WelcomeBack screen for a consistent celebration feel across both entry
// points (login + onboarding completion).
function StepDone({
  form, avatarPreview, committing, committed, commitError, onGoNow, onRetry,
}: {
  form: FormState
  avatarPreview: string | null
  committing: boolean
  committed: boolean
  commitError: string | null
  onGoNow: () => void
  onRetry: () => void
}) {
  const name = form.full_name.split(' ')[0] || 'friend'
  const isUpload = !!avatarPreview
  const avatarValue = isUpload ? avatarPreview! : (form.avatar_choice || '✨')

  // First-time celebration messages (excludes "Welcome back" since this is the
  // very first time they're finishing onboarding).
  const messages = [
    `Way to go, ${name}!`,
    `Way to go green, ${name}!`,
    `Keep it up, ${name}!`,
  ]

  return (
    <div className="text-center">
      {/* Avatar (bounce-in + glow) surrounded by silver sparkles */}
      <div style={{ position: 'relative', height: 150, marginBottom: 18 }}>
        <SparkleLayer count={14} radius={100} />
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <AvatarBurst avatar={avatarValue} size={96} />
        </div>
      </div>

      {/* Rotating headline + subtitle */}
      <div style={{ animation: 'fadeSlideUp 0.5s ease both', animationDelay: '0.3s' }}>
        <RotatingMessage
          messages={messages}
          intervalMs={1100}
          style={{
            fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 6,
            lineHeight: 1.25,
          }}
        />
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 20 }}>
          Welcome to the Green Community.
        </p>
      </div>

      {/* Stats incl. Badge Unlocked (new user celebration) */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 22,
        animation: 'fadeSlideUp 0.5s ease both', animationDelay: '0.55s',
      }}>
        <Stat label="Badge unlocked" value="Recycler I" accent="#C0C0C0" />
        <Stat label="Eco Points"      value="+25"        accent="#5eead4" />
      </div>

      {/* Status / action area — fades in last */}
      <div style={{ animation: 'fadeSlideUp 0.4s ease both', animationDelay: '0.8s' }}>
        {commitError ? (
          <>
            <p style={{ fontSize: 13, color: '#f87171', marginBottom: 10 }}>
              We couldn&apos;t save your onboarding: {commitError}
            </p>
            <PrimaryButton onClick={onRetry} loading={committing}>Retry</PrimaryButton>
          </>
        ) : (
          <>
            <PrimaryButton variant="secondary" onClick={onGoNow}>
              {committed ? 'Go now →' : 'Saving…'}
            </PrimaryButton>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 10, letterSpacing: '0.05em' }}>
              {committed ? 'Heading to your dashboard…' : 'Saving your onboarding…'}
            </p>
          </>
        )}
      </div>
    </div>
  )
}

// ── Exit confirmation modal ──────────────────────────────────────────────────

function ExitConfirm({ onStay, onLeave }: { onStay: () => void; onLeave: () => void }) {
  return (
    <div
      onClick={onStay}
      style={{
        position: 'fixed', inset: 0, zIndex: 100, padding: 20,
        background: 'rgba(4,10,24,0.78)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'fadeIn 0.2s ease both',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-labelledby="exit-confirm-title"
        style={{
          width: '100%', maxWidth: 380,
          background: 'rgba(6,14,36,0.96)',
          border: '1px solid rgba(0,200,255,0.2)',
          borderRadius: 18, padding: 24,
          boxShadow: '0 30px 80px rgba(0,0,0,0.55)',
        }}
      >
        <h2 id="exit-confirm-title" style={{ color: '#fff', fontSize: 17, fontWeight: 600, marginBottom: 8 }}>
          Are you sure you want to leave onboarding?
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, lineHeight: 1.55, marginBottom: 18 }}>
          If you exit now, your onboarding progress and information will be cleared.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <PrimaryButton onClick={onStay}>Stay Here</PrimaryButton>
          </div>
          <button
            onClick={onLeave}
            type="button"
            style={{
              padding: '10px 14px', borderRadius: 12, cursor: 'pointer',
              background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)',
              color: '#f87171', fontSize: 13, fontWeight: 600,
            }}
          >
            Exit &amp; Clear Progress
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Small reusable bits ──────────────────────────────────────────────────────

function StepHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, color: '#fff', marginBottom: 4 }}>{title}</h2>
      {subtitle && <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{subtitle}</p>}
    </div>
  )
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  )
}

function ChipMultiRow({ options, values, onToggle }: { options: readonly string[]; values: string[]; onToggle: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {options.map(opt => {
        const sel = values.includes(opt)
        return (
          <button key={opt} onClick={() => onToggle(opt)} type="button"
            style={{
              padding: '7px 12px', borderRadius: 999, fontSize: 12, cursor: 'pointer',
              background: sel ? 'rgba(0,200,255,0.14)' : 'rgba(255,255,255,0.04)',
              border: sel ? '1px solid rgba(0,200,255,0.4)' : '1px solid rgba(255,255,255,0.08)',
              color: sel ? '#00c8ff' : 'rgba(255,255,255,0.6)',
              fontWeight: sel ? 700 : 400,
            }}>{opt}</button>
        )
      })}
    </div>
  )
}

function ChipRow({ options, value, onSelect }: { options: readonly string[]; value: string; onSelect: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {options.map(opt => {
        const sel = value === opt
        return (
          <button key={opt} onClick={() => onSelect(opt)} type="button"
            style={{
              padding: '7px 12px', borderRadius: 999, fontSize: 12, cursor: 'pointer',
              background: sel ? 'rgba(0,200,255,0.14)' : 'rgba(255,255,255,0.04)',
              border: sel ? '1px solid rgba(0,200,255,0.4)' : '1px solid rgba(255,255,255,0.08)',
              color: sel ? '#00c8ff' : 'rgba(255,255,255,0.6)',
              fontWeight: sel ? 700 : 400,
            }}>{opt}</button>
        )
      })}
    </div>
  )
}

function NavRow({ onBack, onContinue, continueLabel = 'Continue' }: {
  onBack: () => void; onContinue: () => void; continueLabel?: string
}) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <PrimaryButton variant="secondary" onClick={onBack}>Back</PrimaryButton>
      <div style={{ flex: 1 }}>
        <PrimaryButton onClick={onContinue}>{continueLabel}</PrimaryButton>
      </div>
    </div>
  )
}

function PermissionCard({ icon, label, reason }: { icon: string; label: string; reason: string }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 14px', marginBottom: 10, borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(0,190,255,0.15)' }}>
      <span style={{ fontSize: 22 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 13, color: '#fff', fontWeight: 600, marginBottom: 2 }}>{label}</p>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>{reason}</p>
      </div>
    </div>
  )
}

function Stat({ label, value, accent = '#00c8ff' }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(0,190,255,0.15)', borderRadius: 12, padding: '12px 10px' }}>
      <p style={{ fontSize: 18, fontWeight: 700, color: accent, marginBottom: 2 }}>{value}</p>
      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>{label}</p>
    </div>
  )
}
