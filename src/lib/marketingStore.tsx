// marketingStore.tsx — Central state management for BayKid AI Marketing Center
//
// Architecture: React Context + useReducer for normalized, in-memory entity state.
//
// Design principles:
//   1. ADDITIVE — existing components reading directly from localStorage continue to work.
//      The store is opt-in; new code and settings/onboarding surfaces use the store.
//   2. LOCAL-FIRST — store hydrates from localStorage on mount; writes always hit
//      localStorage first, then Supabase in the background (preserving existing pattern).
//   3. REACTIVE — in-tab pub/sub via context; cross-tab via StorageEvent.
//   4. NORMALIZED — entities stored as Record<id, entity> to prevent duplicates.

import {
  createContext, useContext, useReducer, useEffect, useCallback,
  useMemo, type ReactNode,
} from 'react'
import type { AIContentResult, Lead } from './aiMarketing'
import type { AutomationRule } from './automationRules'
import type { AppNotification } from './notifications'
import { loadPosts, upsertPost, removePost }   from './postStorage'
import { loadLeads, upsertLead }               from './leadStorage'
import { loadRules }                           from './automationRules'
import { activeNotifications, markRead, dismissNotification } from './notifications'
import { loadUserProfile, type UserProfile }   from './permissions'
import { loadOrgSettings, type OrgSettings }   from './orgSettings'

// ── State shape ───────────────────────────────────────────────────────────────

interface EntityState<T> {
  byId:    Record<string, T>
  ids:     string[]
  loading: boolean
  error:   string | null
  page:    number
  total:   number
}

function emptyEntity<T>(): EntityState<T> {
  return { byId: {}, ids: [], loading: false, error: null, page: 0, total: 0 }
}

function normalize<T extends { id: string }>(items: T[]): EntityState<T> {
  const byId: Record<string, T> = {}
  const ids: string[] = []
  for (const item of items) { byId[item.id] = item; ids.push(item.id) }
  return { byId, ids, loading: false, error: null, page: 0, total: items.length }
}

export interface MarketingState {
  posts:         EntityState<AIContentResult>
  leads:         EntityState<Lead>
  rules:         EntityState<AutomationRule>
  notifications: EntityState<AppNotification>
  currentUser:   UserProfile | null
  orgSettings:   OrgSettings | null
  initialized:   boolean
  globalError:   string | null
  toasts:        ToastMessage[]
}

// ── Toast type ────────────────────────────────────────────────────────────────

export interface ToastMessage {
  id:      string
  message: string
  type:    'success' | 'error' | 'info' | 'warn'
  ttl?:    number   // ms until auto-dismiss (default 3000)
}

// ── Actions ───────────────────────────────────────────────────────────────────

type MarketingAction =
  | { type: 'INIT'; payload: Pick<MarketingState, 'posts' | 'leads' | 'rules' | 'notifications' | 'currentUser' | 'orgSettings'> }
  | { type: 'SET_LOADING';  entity: 'posts' | 'leads' | 'rules' | 'notifications'; loading: boolean }
  | { type: 'SET_ERROR';    entity: 'posts' | 'leads' | 'rules' | 'notifications'; error: string | null }
  | { type: 'UPSERT_POST';  post: AIContentResult }
  | { type: 'DELETE_POST';  id: string }
  | { type: 'UPSERT_LEAD';  lead: Lead }
  | { type: 'DELETE_LEAD';  id: string }
  | { type: 'UPSERT_RULE';  rule: AutomationRule }
  | { type: 'DELETE_RULE';  id: string }
  | { type: 'RELOAD_POSTS' }
  | { type: 'RELOAD_LEADS' }
  | { type: 'RELOAD_RULES' }
  | { type: 'RELOAD_NOTIFICATIONS' }
  | { type: 'SET_USER';     user: UserProfile }
  | { type: 'SET_ORG';      org: OrgSettings }
  | { type: 'SET_GLOBAL_ERROR'; error: string | null }
  | { type: 'ADD_TOAST';    toast: ToastMessage }
  | { type: 'REMOVE_TOAST'; id: string }
  | { type: 'MARK_NOTIFICATION_READ'; id: string }
  | { type: 'DISMISS_NOTIFICATION';   id: string }

// ── Reducer ───────────────────────────────────────────────────────────────────

function upsertEntity<T extends { id: string }>(
  state: EntityState<T>,
  item:  T,
): EntityState<T> {
  const exists = !!state.byId[item.id]
  return {
    ...state,
    byId:  { ...state.byId, [item.id]: item },
    ids:   exists ? state.ids : [item.id, ...state.ids],
    total: exists ? state.total : state.total + 1,
  }
}

function deleteEntity<T>(state: EntityState<T>, id: string): EntityState<T> {
  const { [id]: _removed, ...rest } = state.byId
  return {
    ...state,
    byId:  rest,
    ids:   state.ids.filter((x) => x !== id),
    total: Math.max(0, state.total - 1),
  }
}

function reducer(state: MarketingState, action: MarketingAction): MarketingState {
  switch (action.type) {
    case 'INIT':
      return { ...state, ...action.payload, initialized: true, globalError: null }

    case 'SET_LOADING':
      return { ...state, [action.entity]: { ...state[action.entity], loading: action.loading } }

    case 'SET_ERROR':
      return { ...state, [action.entity]: { ...state[action.entity], error: action.error, loading: false } }

    case 'UPSERT_POST':
      return { ...state, posts: upsertEntity(state.posts, action.post) }

    case 'DELETE_POST':
      return { ...state, posts: deleteEntity(state.posts, action.id) }

    case 'UPSERT_LEAD':
      return { ...state, leads: upsertEntity(state.leads, action.lead) }

    case 'DELETE_LEAD':
      return { ...state, leads: deleteEntity(state.leads, action.id) }

    case 'UPSERT_RULE':
      return { ...state, rules: upsertEntity(state.rules, action.rule) }

    case 'DELETE_RULE':
      return { ...state, rules: deleteEntity(state.rules, action.id) }

    case 'RELOAD_POSTS':
      return { ...state, posts: normalize(loadPosts()) }

    case 'RELOAD_LEADS':
      return { ...state, leads: normalize(loadLeads()) }

    case 'RELOAD_RULES':
      return { ...state, rules: normalize(loadRules()) }

    case 'RELOAD_NOTIFICATIONS':
      return { ...state, notifications: normalize(activeNotifications()) }

    case 'SET_USER':
      return { ...state, currentUser: action.user }

    case 'SET_ORG':
      return { ...state, orgSettings: action.org }

    case 'SET_GLOBAL_ERROR':
      return { ...state, globalError: action.error }

    case 'ADD_TOAST':
      return { ...state, toasts: [...state.toasts, action.toast] }

    case 'REMOVE_TOAST':
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.id) }

    case 'MARK_NOTIFICATION_READ': {
      const n = state.notifications.byId[action.id]
      if (!n) return state
      return { ...state, notifications: upsertEntity(state.notifications, { ...n, read: true }) }
    }

    case 'DISMISS_NOTIFICATION':
      return { ...state, notifications: deleteEntity(state.notifications, action.id) }

    default:
      return state
  }
}

// ── Initial state ─────────────────────────────────────────────────────────────

const INITIAL_STATE: MarketingState = {
  posts:         emptyEntity<AIContentResult>(),
  leads:         emptyEntity<Lead>(),
  rules:         emptyEntity<AutomationRule>(),
  notifications: emptyEntity<AppNotification>(),
  currentUser:   null,
  orgSettings:   null,
  initialized:   false,
  globalError:   null,
  toasts:        [],
}

// ── Context ───────────────────────────────────────────────────────────────────

interface MarketingContextValue {
  state:    MarketingState
  dispatch: React.Dispatch<MarketingAction>
  // High-level action helpers
  actions: {
    upsertPost:  (post: AIContentResult) => void
    deletePost:  (id: string) => void
    upsertLead:  (lead: Lead) => void
    deleteLead:  (id: string) => void
    reloadPosts: () => void
    reloadLeads: () => void
    toast:       (message: string, type?: ToastMessage['type'], ttl?: number) => void
    clearToast:  (id: string) => void
    markNotifRead: (id: string) => void
    dismissNotif:  (id: string) => void
  }
}

const MarketingContext = createContext<MarketingContextValue | null>(null)

// ── Provider ──────────────────────────────────────────────────────────────────

export function MarketingProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE)

  // ── Hydrate from localStorage on mount ──────────────────────────────────────
  useEffect(() => {
    try {
      dispatch({
        type:    'INIT',
        payload: {
          posts:         normalize(loadPosts()),
          leads:         normalize(loadLeads()),
          rules:         normalize(loadRules()),
          notifications: normalize(activeNotifications()),
          currentUser:   loadUserProfile(),
          orgSettings:   loadOrgSettings(),
        },
      })
    } catch (err) {
      dispatch({ type: 'SET_GLOBAL_ERROR', error: `Store initialization failed: ${err instanceof Error ? err.message : 'Unknown error'}` })
    }
  }, [])

  // ── Cross-tab sync via StorageEvent ─────────────────────────────────────────
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === 'baykid_ai_posts')    dispatch({ type: 'RELOAD_POSTS' })
      if (e.key === 'baykid_ai_leads')    dispatch({ type: 'RELOAD_LEADS' })
      if (e.key === 'baykid_ai_rules')    dispatch({ type: 'RELOAD_RULES' })
      if (e.key === 'baykid_notifications') dispatch({ type: 'RELOAD_NOTIFICATIONS' })
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  // ── Toast auto-dismiss ───────────────────────────────────────────────────────
  useEffect(() => {
    if (state.toasts.length === 0) return
    const latest = state.toasts[state.toasts.length - 1]
    const ttl = latest.ttl ?? 3000
    const id  = setTimeout(() => dispatch({ type: 'REMOVE_TOAST', id: latest.id }), ttl)
    return () => clearTimeout(id)
  }, [state.toasts])

  // ── Action helpers ───────────────────────────────────────────────────────────
  const actions = useMemo(() => ({
    upsertPost: (post: AIContentResult) => {
      upsertPost(post)
      dispatch({ type: 'UPSERT_POST', post })
    },
    deletePost: (id: string) => {
      removePost(id)
      dispatch({ type: 'DELETE_POST', id })
    },
    upsertLead: (lead: Lead) => {
      upsertLead(lead)
      dispatch({ type: 'UPSERT_LEAD', lead })
    },
    deleteLead: (id: string) => {
      dispatch({ type: 'DELETE_LEAD', id })
    },
    reloadPosts: () => dispatch({ type: 'RELOAD_POSTS' }),
    reloadLeads: () => dispatch({ type: 'RELOAD_LEADS' }),
    toast: (message: string, type: ToastMessage['type'] = 'success', ttl = 3000) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`
      dispatch({ type: 'ADD_TOAST', toast: { id, message, type, ttl } })
    },
    clearToast:    (id: string) => dispatch({ type: 'REMOVE_TOAST', id }),
    markNotifRead: (id: string) => { markRead(id); dispatch({ type: 'MARK_NOTIFICATION_READ', id }) },
    dismissNotif:  (id: string) => { dismissNotification(id); dispatch({ type: 'DISMISS_NOTIFICATION', id }) },
  }), [])

  return (
    <MarketingContext.Provider value={{ state, dispatch, actions }}>
      {children}
    </MarketingContext.Provider>
  )
}

// ── Consumer hooks ────────────────────────────────────────────────────────────

export function useMarketing(): MarketingContextValue {
  const ctx = useContext(MarketingContext)
  if (!ctx) throw new Error('useMarketing must be used inside <MarketingProvider>')
  return ctx
}

export function usePosts() {
  const { state } = useMarketing()
  return useMemo(
    () => state.posts.ids.map((id) => state.posts.byId[id]).filter(Boolean),
    [state.posts],
  )
}

export function useLeads() {
  const { state } = useMarketing()
  return useMemo(
    () => state.leads.ids.map((id) => state.leads.byId[id]).filter(Boolean),
    [state.leads],
  )
}

export function useMarketingToasts() {
  const { state, actions } = useMarketing()
  return { toasts: state.toasts, toast: actions.toast, clearToast: actions.clearToast }
}

export function useOrgSettings() {
  const { state, dispatch } = useMarketing()
  const update = useCallback((org: OrgSettings) => {
    dispatch({ type: 'SET_ORG', org })
  }, [dispatch])
  return { org: state.orgSettings, update }
}

export function useCurrentUser() {
  const { state, dispatch } = useMarketing()
  const update = useCallback((user: import('./permissions').UserProfile) => {
    dispatch({ type: 'SET_USER', user })
  }, [dispatch])
  return { user: state.currentUser, update }
}

// ── Global toast stack component ──────────────────────────────────────────────

export function GlobalToastStack() {
  const { state, actions } = useMarketing()
  const colors: Record<ToastMessage['type'], string> = {
    success: 'rgba(34,197,94,0.95)',
    error:   'rgba(248,113,113,0.95)',
    info:    'rgba(0,200,255,0.95)',
    warn:    'rgba(251,146,60,0.95)',
  }
  const icons: Record<ToastMessage['type'], string> = {
    success: '✅', error: '❌', info: 'ℹ️', warn: '⚠️',
  }
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 9999, pointerEvents: 'none', maxWidth: 360 }}>
      {state.toasts.map((t) => (
        <div key={t.id}
          style={{ background: colors[t.type], color: '#fff', borderRadius: 12, padding: '10px 16px', fontWeight: 700, fontSize: 13, boxShadow: '0 4px 24px rgba(0,0,0,0.45)', animation: 'ai-fadeUp 0.25s ease', display: 'flex', alignItems: 'center', gap: 8, pointerEvents: 'auto' }}
          onClick={() => actions.clearToast(t.id)}
        >
          <span>{icons[t.type]}</span>
          <span style={{ flex: 1 }}>{t.message}</span>
        </div>
      ))}
      <style>{`@keyframes ai-fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }`}</style>
    </div>
  )
}
