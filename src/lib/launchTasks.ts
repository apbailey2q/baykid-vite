// launchTasks.ts — Internal task tracker (bugs, features, chores, deploy notes).
// Members read; creators + assignees update; admins do anything.

import { supabase } from './supabaseClient'
import { DEFAULT_ORG_ID } from './billing'
import type {
  LaunchTaskRow, LaunchTaskStatus, LaunchTaskType, LaunchTaskPriority,
} from '../types/launch'

interface ListOpts {
  orgId?:    string
  type?:     LaunchTaskType | 'all'
  status?:   LaunchTaskStatus | 'open_only' | 'all'
  release?:  string
  limit?:    number
}

export async function listTasks(opts: ListOpts = {}): Promise<LaunchTaskRow[]> {
  let q = supabase
    .from('launch_tasks')
    .select('*')
    .eq('organization_id', opts.orgId ?? DEFAULT_ORG_ID)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(opts.limit ?? 100)

  if (opts.type && opts.type !== 'all') q = q.eq('task_type', opts.type)

  if (opts.status === 'open_only') {
    q = q.in('status', ['open', 'in_progress', 'in_review', 'blocked'])
  } else if (opts.status && opts.status !== 'all') {
    q = q.eq('status', opts.status)
  }

  if (opts.release) q = q.eq('target_release', opts.release)

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as LaunchTaskRow[]
}

interface CreateInput {
  title:          string
  description?:   string
  task_type?:     LaunchTaskType
  priority?:      LaunchTaskPriority
  target_release?: string
  due_at?:        string
  labels?:        string[]
  source_kind?:   LaunchTaskRow['source_kind']
  source_ref?:    string
  orgId?:         string
}

export async function createTask(input: CreateInput): Promise<LaunchTaskRow> {
  const { data: user } = await supabase.auth.getUser()

  const payload = {
    organization_id: input.orgId ?? DEFAULT_ORG_ID,
    task_type:       input.task_type ?? 'feature',
    status:          'open' as LaunchTaskStatus,
    priority:        input.priority ?? 'p2',
    title:           input.title.trim(),
    description:     input.description?.trim() ?? null,
    target_release:  input.target_release ?? null,
    due_at:          input.due_at ?? null,
    labels:          input.labels ?? [],
    source_kind:     input.source_kind ?? null,
    source_ref:      input.source_ref ?? null,
    created_by:      user.user?.id ?? null,
  }

  const { data, error } = await supabase
    .from('launch_tasks')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data as LaunchTaskRow
}

export async function updateTask(id: string, patch: Partial<LaunchTaskRow>): Promise<LaunchTaskRow> {
  // Only allow whitelisted columns to be updated from the client.
  const safe: Partial<LaunchTaskRow> = {}
  for (const k of ['status', 'priority', 'title', 'description', 'target_release', 'assignee', 'due_at', 'shipped_at', 'task_type'] as const) {
    if (k in patch) (safe as Record<string, unknown>)[k] = (patch as Record<string, unknown>)[k]
  }
  const { data, error } = await supabase
    .from('launch_tasks')
    .update(safe)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as LaunchTaskRow
}

/**
 * Spawn a launch task from a feedback row. Used by the Feedback tab when a
 * triage-ready entry needs to enter the engineering pipeline.
 */
export async function spawnFromFeedback(args: {
  feedbackId:     string
  title:          string
  taskType:       LaunchTaskType
  priority?:      LaunchTaskPriority
  targetRelease?: string
}): Promise<LaunchTaskRow> {
  return createTask({
    title:          args.title,
    task_type:      args.taskType,
    priority:       args.priority,
    target_release: args.targetRelease,
    source_kind:    'beta_feedback',
    source_ref:     args.feedbackId,
  })
}
