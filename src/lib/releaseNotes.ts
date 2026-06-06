// releaseNotes.ts — Internal release-notes feed for the AI Marketing Center
//
// Published notes are visible to all org members; drafts (published_at NULL)
// are admin-only by RLS. The UI surfaces only published notes by default and
// pinned/highlighted notes float to the top.

import { supabase } from './supabaseClient'
import { DEFAULT_ORG_ID } from './billing'
import type { ReleaseNoteRow, ReleaseAudience } from '../types/betaLaunch'

export async function listPublished(orgId: string = DEFAULT_ORG_ID): Promise<ReleaseNoteRow[]> {
  const { data, error } = await supabase
    .from('release_notes')
    .select('*')
    .eq('organization_id', orgId)
    .not('published_at', 'is', null)
    .order('highlight',    { ascending: false })
    .order('published_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as ReleaseNoteRow[]
}

export async function listAll(orgId: string = DEFAULT_ORG_ID): Promise<ReleaseNoteRow[]> {
  // Admin-only: RLS blocks drafts for non-admins.
  const { data, error } = await supabase
    .from('release_notes')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as ReleaseNoteRow[]
}

interface CreateInput {
  title:     string
  body:      string
  version?:  string
  audience?: ReleaseAudience
  highlight?: boolean
  publish?:  boolean
  orgId?:    string
}

export async function createNote(input: CreateInput): Promise<ReleaseNoteRow> {
  const { data: user } = await supabase.auth.getUser()

  const payload = {
    organization_id: input.orgId ?? DEFAULT_ORG_ID,
    version:         input.version ?? null,
    title:           input.title.trim(),
    body:            input.body,
    audience:        input.audience ?? 'internal',
    highlight:       input.highlight ?? false,
    published_at:    input.publish ? new Date().toISOString() : null,
    created_by:      user.user?.id ?? null,
  }

  const { data, error } = await supabase
    .from('release_notes')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data as ReleaseNoteRow
}

export async function publishNote(id: string): Promise<void> {
  const { error } = await supabase
    .from('release_notes')
    .update({ published_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}
