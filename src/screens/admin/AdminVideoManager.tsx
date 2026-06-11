// AdminVideoManager — /dashboard/admin/apartment/video
// Upload and manage onboarding orientation videos.
// Access is admin-only via /dashboard/admin/apartment prefix in routePermissions.

import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import {
  getAllOnboardingVideos,
  uploadOnboardingVideo,
  setVideoActive,
  setVideoInactive,
  deleteOnboardingVideo,
  type OnboardingVideo,
} from '../../lib/onboardingVideo'

const AUDIENCE_LABELS: Record<string, string> = {
  consumer:   'Consumer (Resident)',
  commercial: 'Commercial',
  driver:     'Driver',
  warehouse:  'Warehouse',
  fundraiser: 'Fundraiser',
  general:    'General',
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

function VideoCard({
  video,
  onActivate,
  onDeactivate,
  onDelete,
}: {
  video: OnboardingVideo
  onActivate: (v: OnboardingVideo) => void
  onDeactivate: (v: OnboardingVideo) => void
  onDelete: (v: OnboardingVideo) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      style={{
        background: video.is_active
          ? 'rgba(34,197,94,0.05)'
          : 'rgba(255,255,255,0.03)',
        border: video.is_active
          ? '1px solid rgba(34,197,94,0.25)'
          : '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14,
        overflow: 'hidden',
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          padding: '16px 18px',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            {video.is_active && (
              <span
                style={{
                  background: 'rgba(34,197,94,0.12)',
                  color: '#4ade80',
                  borderRadius: 99,
                  padding: '2px 9px',
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                ● Active
              </span>
            )}
            <span
              style={{
                background: 'rgba(0,200,255,0.08)',
                color: '#00c8ff',
                borderRadius: 99,
                padding: '2px 9px',
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {AUDIENCE_LABELS[video.audience] ?? video.audience}
            </span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
              v{video.version}
            </span>
          </div>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#fff', margin: '0 0 2px', lineHeight: 1.3 }}>
            {video.title}
          </p>
          {video.description && (
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', margin: 0 }}>
              {video.description}
            </p>
          )}
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 6 }}>
            Uploaded {formatDate(video.created_at)}
          </p>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
          <button
            onClick={() => setExpanded(v => !v)}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.7)',
              borderRadius: 8,
              padding: '7px 12px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {expanded ? '▲ Hide' : '▶ Preview'}
          </button>

          {video.is_active ? (
            <button
              onClick={() => onDeactivate(video)}
              style={{
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.25)',
                color: '#f87171',
                borderRadius: 8,
                padding: '7px 12px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Deactivate
            </button>
          ) : (
            <button
              onClick={() => onActivate(video)}
              style={{
                background: 'rgba(34,197,94,0.08)',
                border: '1px solid rgba(34,197,94,0.3)',
                color: '#4ade80',
                borderRadius: 8,
                padding: '7px 12px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Set Active
            </button>
          )}

          {!video.is_active && (
            <button
              onClick={() => onDelete(video)}
              style={{
                background: 'rgba(239,68,68,0.06)',
                border: '1px solid rgba(239,68,68,0.2)',
                color: '#f87171',
                borderRadius: 8,
                padding: '7px 12px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Inline video preview */}
      {expanded && (
        <div style={{ padding: '0 18px 18px' }}>
          <video
            src={video.video_url}
            controls
            controlsList="nodownload"
            style={{
              width: '100%',
              borderRadius: 10,
              background: '#000',
              maxHeight: 360,
            }}
          />
        </div>
      )}
    </div>
  )
}

export default function AdminVideoManager() {
  const user = useAuthStore(s => s.user)

  const [videos,        setVideos]        = useState<OnboardingVideo[]>([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState<string | null>(null)
  const [actionError,   setActionError]   = useState<string | null>(null)
  const [busy,          setBusy]          = useState(false)

  // Upload form state
  const [uploading,     setUploading]     = useState(false)
  const [uploadError,   setUploadError]   = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)
  const [title,         setTitle]         = useState('')
  const [description,   setDescription]   = useState('')
  const [audience,      setAudience]      = useState('consumer')
  const [file,          setFile]          = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  function loadVideos() {
    setLoading(true)
    getAllOnboardingVideos()
      .then(setVideos)
      .catch((e: unknown) => setError((e as { message?: string }).message ?? 'Failed to load videos'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadVideos() }, [])

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !title.trim() || !user?.id) return

    setUploadError(null)
    setUploading(true)
    setUploadProgress('Uploading video...')

    try {
      await uploadOnboardingVideo({
        file,
        title: title.trim(),
        description: description.trim(),
        audience,
        uploadedBy: user.id,
      })
      setTitle('')
      setDescription('')
      setAudience('consumer')
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      setUploadProgress('Upload complete!')
      setTimeout(() => setUploadProgress(null), 3000)
      loadVideos()
    } catch (e: unknown) {
      setUploadError((e as { message?: string }).message ?? 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function handleActivate(video: OnboardingVideo) {
    setActionError(null)
    setBusy(true)
    try {
      await setVideoActive(video.id, video.audience)
      loadVideos()
    } catch (e: unknown) {
      setActionError((e as { message?: string }).message ?? 'Failed to activate video')
    } finally {
      setBusy(false)
    }
  }

  async function handleDeactivate(video: OnboardingVideo) {
    setActionError(null)
    setBusy(true)
    try {
      await setVideoInactive(video.id)
      loadVideos()
    } catch (e: unknown) {
      setActionError((e as { message?: string }).message ?? 'Failed to deactivate video')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(video: OnboardingVideo) {
    if (!confirm(`Delete "${video.title}"? This cannot be undone.`)) return
    setActionError(null)
    setBusy(true)
    try {
      await deleteOnboardingVideo(video)
      loadVideos()
    } catch (e: unknown) {
      setActionError((e as { message?: string }).message ?? 'Failed to delete video')
    } finally {
      setBusy(false)
    }
  }

  const activeConsumer = videos.find(v => v.is_active && v.audience === 'consumer')

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg,#060e24 0%,#040a1a 100%)',
        color: '#fff',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: '32px 24px 80px',
      }}
    >
      <div style={{ maxWidth: 860, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
            <Link
              to="/dashboard/admin/apartment"
              style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, textDecoration: 'none', fontWeight: 600 }}
            >
              ← Apartment Dashboard
            </Link>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 900, margin: 0 }}>Onboarding Video Manager</h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>
            Upload and control the orientation video shown to residents during enrollment Step 3.
          </p>
        </div>

        {/* Active consumer video banner */}
        {!loading && (
          <div
            style={{
              background: activeConsumer
                ? 'rgba(34,197,94,0.07)'
                : 'rgba(245,158,11,0.07)',
              border: activeConsumer
                ? '1px solid rgba(34,197,94,0.2)'
                : '1px solid rgba(245,158,11,0.25)',
              borderRadius: 14,
              padding: '16px 20px',
              marginBottom: 28,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}
          >
            <span style={{ fontSize: 24, flexShrink: 0 }}>
              {activeConsumer ? '✅' : '⚠️'}
            </span>
            <div>
              <p style={{ fontWeight: 700, fontSize: 14, margin: '0 0 2px', color: activeConsumer ? '#4ade80' : '#fbbf24' }}>
                {activeConsumer
                  ? `Active consumer video: "${activeConsumer.title}" (v${activeConsumer.version})`
                  : 'No active consumer video — residents cannot complete Step 3'}
              </p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', margin: 0 }}>
                {activeConsumer
                  ? 'This video plays at enrollment Step 3. Residents must watch it fully to continue.'
                  : 'Upload a video below and set it as active to unblock enrollment Step 3.'}
              </p>
            </div>
          </div>
        )}

        {/* Upload form */}
        <div
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(0,200,255,0.12)',
            borderRadius: 16,
            padding: '24px 24px 20px',
            marginBottom: 32,
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 18px', color: '#00c8ff' }}>
            Upload New Video
          </h2>

          <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Resident Orientation v2"
                  required
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Audience *
                </label>
                <select
                  value={audience}
                  onChange={e => setAudience(e.target.value)}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                >
                  {Object.entries(AUDIENCE_LABELS).map(([val, lbl]) => (
                    <option key={val} value={val}>{lbl}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Optional short description shown to residents"
                style={inputStyle}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Video File * (MP4, WebM, MOV — max 500 MB)
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime,video/x-msvideo"
                required
                onChange={e => setFile(e.target.files?.[0] ?? null)}
                style={{
                  ...inputStyle,
                  cursor: 'pointer',
                  paddingTop: 9,
                  paddingBottom: 9,
                }}
              />
              {file && (
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: 0 }}>
                  {file.name} — {formatBytes(file.size)}
                </p>
              )}
            </div>

            {uploadError && (
              <p style={{ fontSize: 13, color: '#f87171', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '8px 12px', margin: 0 }}>
                {uploadError}
              </p>
            )}
            {uploadProgress && (
              <p style={{ fontSize: 13, color: '#4ade80', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, padding: '8px 12px', margin: 0 }}>
                {uploadProgress}
              </p>
            )}

            <button
              type="submit"
              disabled={uploading || !file || !title.trim()}
              style={{
                background: uploading || !file || !title.trim()
                  ? 'rgba(255,255,255,0.1)'
                  : 'linear-gradient(135deg,#00c8ff,#0057e7)',
                color: uploading || !file || !title.trim() ? 'rgba(255,255,255,0.35)' : '#fff',
                border: 'none',
                borderRadius: 99,
                padding: '13px',
                fontWeight: 800,
                fontSize: 14,
                cursor: uploading || !file || !title.trim() ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {uploading ? 'Uploading…' : 'Upload Video'}
            </button>
          </form>
        </div>

        {/* Video list */}
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 14px' }}>
            All Videos
            {videos.length > 0 && (
              <span style={{ fontWeight: 400, fontSize: 13, color: 'rgba(255,255,255,0.4)', marginLeft: 8 }}>
                ({videos.length})
              </span>
            )}
          </h2>

          {actionError && (
            <p style={{ fontSize: 13, color: '#f87171', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '8px 12px', marginBottom: 14 }}>
              {actionError}
            </p>
          )}

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid rgba(0,200,255,0.2)', borderTopColor: '#00c8ff', animation: 'spin 0.8s linear infinite' }} />
            </div>
          ) : error ? (
            <p style={{ color: '#f87171', fontSize: 13 }}>{error}</p>
          ) : videos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 24px', color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>
              No videos uploaded yet. Upload one above to get started.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, opacity: busy ? 0.7 : 1, pointerEvents: busy ? 'none' : 'auto', transition: 'opacity 0.2s' }}>
              {videos.map(v => (
                <VideoCard
                  key={v.id}
                  video={v}
                  onActivate={handleActivate}
                  onDeactivate={handleDeactivate}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 10,
  padding: '10px 14px',
  color: '#fff',
  fontSize: 14,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
}
