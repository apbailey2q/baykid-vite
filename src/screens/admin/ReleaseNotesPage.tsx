// ReleaseNotesPage — `/admin/release-notes`
//
// Internal release-notes feed. Members see published notes (sorted by
// highlight + published date). Admins additionally see drafts and the
// "Add note" form (RLS handles the access control; the UI just hides
// the form for non-admins for cleanliness).
//
// Markdown is rendered as plain text with simple paragraph breaks — no
// remote markdown parser. Good enough for internal beta notes.

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { listAll, listPublished, createNote, publishNote } from '../../lib/releaseNotes'
import type { ReleaseNoteRow, ReleaseAudience } from '../../types/betaLaunch'

export default function ReleaseNotesPage() {
  const navigate = useNavigate()
  const { profile } = useAuthStore()
  const isAdmin = profile?.role === 'admin'

  const [notes,   setNotes]   = useState<ReleaseNoteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  // Add form (admin only)
  const [showForm,  setShowForm]  = useState(false)
  const [title,     setTitle]     = useState('')
  const [version,   setVersion]   = useState('')
  const [body,      setBody]      = useState('')
  const [audience,  setAudience]  = useState<ReleaseAudience>('org_members')
  const [highlight, setHighlight] = useState(false)
  const [publish,   setPublish]   = useState(true)
  const [busy,      setBusy]      = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = isAdmin ? await listAll() : await listPublished()
      setNotes(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load notes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [isAdmin])

  async function handleCreate() {
    if (!title.trim() || !body.trim()) return
    setBusy(true)
    try {
      await createNote({ title, version: version || undefined, body, audience, highlight, publish })
      setTitle(''); setVersion(''); setBody('')
      setHighlight(false); setPublish(true); setShowForm(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed')
    } finally {
      setBusy(false)
    }
  }

  async function handlePublish(id: string) {
    try {
      await publishNote(id)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish failed')
    }
  }

  return (
    <div className="min-h-screen px-5 py-8" style={{ background: 'linear-gradient(180deg,#060e24 0%,#040a1a 100%)' }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>

        <button
          onClick={() => navigate(-1)}
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', borderRadius: 8, padding: '4px 10px', fontSize: 11, cursor: 'pointer', marginBottom: 10 }}
        >‹ Back</button>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14, marginBottom: 18 }}>
          <div>
            <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 700, margin: 0 }}>📝 Release notes</h1>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 6 }}>
              What changed in Cyan's Brooklynn Marketing — for the team.
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowForm((s) => !s)}
              style={{
                background: 'linear-gradient(135deg,#0057e7,#00c8ff)', color: '#fff',
                border: 'none', borderRadius: 10, padding: '8px 14px',
                fontWeight: 700, fontSize: 12, cursor: 'pointer',
                boxShadow: '0 2px 12px rgba(0,190,255,0.35)',
              }}
            >
              {showForm ? 'Cancel' : '+ Add note'}
            </button>
          )}
        </div>

        {error && <Notice tone="error">{error}</Notice>}

        {/* Admin add form */}
        {isAdmin && showForm && (
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 16, marginBottom: 18 }}>
            <Field label="Title">
              <input value={title} onChange={(e) => setTitle(e.target.value)} style={input()} placeholder="Lead Tracker v2 ships" />
            </Field>
            <Row>
              <Field label="Version (optional)">
                <input value={version} onChange={(e) => setVersion(e.target.value)} style={input()} placeholder="beta-2026.05.29" />
              </Field>
              <Field label="Audience">
                <select value={audience} onChange={(e) => setAudience(e.target.value as ReleaseAudience)} style={input()}>
                  <option value="internal">Internal only</option>
                  <option value="org_members">All org members</option>
                  <option value="public">Public</option>
                </select>
              </Field>
            </Row>
            <Field label="Body (markdown)">
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} style={{ ...input(), resize: 'vertical', fontFamily: 'inherit' }} placeholder="What changed, why it matters, who's affected." />
            </Field>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={check()}><input type="checkbox" checked={highlight} onChange={(e) => setHighlight(e.target.checked)} /> Pin to top</label>
              <label style={check()}><input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} /> Publish immediately</label>
              <button
                onClick={handleCreate}
                disabled={busy || !title.trim() || !body.trim()}
                style={{
                  marginLeft: 'auto',
                  background: 'linear-gradient(135deg,#0057e7,#00c8ff)', color: '#fff',
                  border: 'none', borderRadius: 10, padding: '8px 16px',
                  fontWeight: 700, fontSize: 12,
                  cursor: busy ? 'wait' : 'pointer',
                  opacity: busy || !title.trim() || !body.trim() ? 0.6 : 1,
                }}
              >
                {busy ? 'Saving…' : 'Save note'}
              </button>
            </div>
          </div>
        )}

        {/* List */}
        {loading ? (
          <Skeleton />
        ) : notes.length === 0 ? (
          <Empty isAdmin={isAdmin} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {notes.map((n) => (
              <NoteCard key={n.id} note={n} isAdmin={isAdmin} onPublish={() => handlePublish(n.id)} />
            ))}
          </div>
        )}

        <div style={{ height: 40 }} />
      </div>
    </div>
  )
}

function NoteCard({ note, isAdmin, onPublish }: { note: ReleaseNoteRow; isAdmin: boolean; onPublish: () => void }) {
  const isDraft = !note.published_at
  return (
    <article style={{
      background: note.highlight ? 'rgba(0,200,255,0.05)' : 'rgba(255,255,255,0.04)',
      border:     note.highlight ? '1px solid rgba(0,200,255,0.3)' : '1px solid rgba(255,255,255,0.08)',
      borderRadius: 14, padding: 18,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
        <div>
          {note.version && <code style={{ color: '#00c8ff', fontSize: 11, marginRight: 8 }}>{note.version}</code>}
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>
            {note.published_at ? note.published_at.slice(0, 10) : 'DRAFT'}
          </span>
          {note.highlight && (
            <span style={{ marginLeft: 8, color: '#fbbf24', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>📌 Pinned</span>
          )}
        </div>
        {isAdmin && isDraft && (
          <button
            onClick={onPublish}
            style={{ background: 'rgba(0,200,255,0.12)', border: '1px solid rgba(0,200,255,0.4)', color: '#00c8ff', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
          >
            Publish
          </button>
        )}
      </div>
      <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 700, margin: '4px 0 8px' }}>{note.title}</h3>
      <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
        {note.body}
      </div>
    </article>
  )
}

function Empty({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 14, padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
      No release notes yet.
      {isAdmin && <div style={{ marginTop: 6, fontSize: 12 }}>Click "+ Add note" to publish the first one.</div>}
    </div>
  )
}

function Skeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[0,1,2].map((i) => (
        <div key={i} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, height: 100 }} />
      ))}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', flex: 1, marginBottom: 12 }}>
      <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 5 }}>{label}</span>
      {children}
    </label>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', gap: 10 }}>{children}</div>
}

function input(): React.CSSProperties {
  return {
    width: '100%', boxSizing: 'border-box',
    background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8, padding: 10, color: '#fff', fontSize: 13, outline: 'none',
  }
}

function check(): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 6,
    color: 'rgba(255,255,255,0.7)', fontSize: 12, cursor: 'pointer',
  }
}

function Notice({ tone, children }: { tone: 'error'; children: React.ReactNode }) {
  const m = { error: { bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.3)', color: '#f87171' } }[tone]
  return (
    <div style={{ background: m.bg, border: `1px solid ${m.border}`, color: m.color, borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 12 }}>
      {children}
    </div>
  )
}
