// orgStore.tsx — React Context for active organization state
// Provides multi-tenant organization switching + reactive org data
// throughout the AI Marketing Center.

import {
  createContext, useContext, useReducer, useEffect,
  useCallback, useMemo, type ReactNode,
} from 'react'
import {
  getUserOrganizations, createOrganization, updateOrganization,
  getActiveOrgId, setActiveOrgId,
  type Organization, type OrgPlan,
} from './organizations'

// ── State ─────────────────────────────────────────────────────────────────────

interface OrgState {
  orgs:      Organization[]
  activeOrg: Organization | null
  loading:   boolean
  error:     string | null
}

type OrgAction =
  | { type: 'SET_ORGS';      orgs: Organization[] }
  | { type: 'SET_ACTIVE';    org: Organization    }
  | { type: 'SET_LOADING';   loading: boolean     }
  | { type: 'SET_ERROR';     error: string | null }
  | { type: 'UPSERT_ORG';    org: Organization    }
  | { type: 'CLEAR_ERROR'                         }

function orgReducer(state: OrgState, action: OrgAction): OrgState {
  switch (action.type) {
    case 'SET_ORGS':
      return { ...state, orgs: action.orgs, loading: false, error: null }
    case 'SET_ACTIVE':
      return { ...state, activeOrg: action.org }
    case 'SET_LOADING':
      return { ...state, loading: action.loading }
    case 'SET_ERROR':
      return { ...state, error: action.error, loading: false }
    case 'UPSERT_ORG': {
      const exists = state.orgs.some((o) => o.id === action.org.id)
      const orgs   = exists
        ? state.orgs.map((o) => o.id === action.org.id ? action.org : o)
        : [...state.orgs, action.org]
      const activeOrg = state.activeOrg?.id === action.org.id ? action.org : state.activeOrg
      return { ...state, orgs, activeOrg }
    }
    case 'CLEAR_ERROR':
      return { ...state, error: null }
    default:
      return state
  }
}

// ── Context value ─────────────────────────────────────────────────────────────

interface OrgContextValue {
  state:     OrgState
  // Convenience getters
  activeOrg: Organization | null
  allOrgs:   Organization[]
  loading:   boolean
  error:     string | null
  // Actions
  switchOrg:       (orgId: string) => void
  refreshOrgs:     () => Promise<void>
  createOrg:       (name: string, slug: string, plan?: OrgPlan) => Promise<Organization>
  patchActiveOrg:  (patch: Partial<Pick<Organization, 'name' | 'logoUrl' | 'plan' | 'settings'>>) => Promise<void>
  clearError:      () => void
}

const OrgContext = createContext<OrgContextValue | null>(null)

// ── Provider ──────────────────────────────────────────────────────────────────

export function OrgProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(orgReducer, {
    orgs: [], activeOrg: null, loading: true, error: null,
  })

  // ── Initial load ────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', loading: true })
    try {
      const orgs = await getUserOrganizations()
      dispatch({ type: 'SET_ORGS', orgs })

      const activeId = getActiveOrgId()
      const active   = orgs.find((o) => o.id === activeId) ?? orgs[0] ?? null
      if (active) {
        dispatch({ type: 'SET_ACTIVE', org: active })
        setActiveOrgId(active.id)
      }
    } catch (err) {
      dispatch({ type: 'SET_ERROR', error: err instanceof Error ? err.message : 'Failed to load organizations' })
    }
  }, [])

  useEffect(() => { void load() }, [load])

  // ── Cross-tab org switch ─────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const id  = (e as CustomEvent<{ orgId: string }>).detail?.orgId
      if (!id) return
      const org = state.orgs.find((o) => o.id === id)
      if (org) dispatch({ type: 'SET_ACTIVE', org })
    }
    window.addEventListener('baykid_org_switch', handler)
    return () => window.removeEventListener('baykid_org_switch', handler)
  }, [state.orgs])

  // ── Actions ─────────────────────────────────────────────────────────────────
  const switchOrg = useCallback((orgId: string) => {
    const org = state.orgs.find((o) => o.id === orgId)
    if (org) {
      dispatch({ type: 'SET_ACTIVE', org })
      setActiveOrgId(orgId)
    }
  }, [state.orgs])

  const refreshOrgs = useCallback(async () => {
    await load()
  }, [load])

  const createOrg = useCallback(async (name: string, slug: string, plan: OrgPlan = 'free'): Promise<Organization> => {
    const org = await createOrganization(name, slug, plan)
    dispatch({ type: 'UPSERT_ORG', org })
    dispatch({ type: 'SET_ACTIVE', org })
    return org
  }, [])

  const patchActiveOrg = useCallback(async (
    patch: Partial<Pick<Organization, 'name' | 'logoUrl' | 'plan' | 'settings'>>
  ) => {
    if (!state.activeOrg) return
    const updated: Organization = {
      ...state.activeOrg,
      ...patch,
      updatedAt: new Date().toISOString(),
    }
    dispatch({ type: 'UPSERT_ORG', org: updated })
    await updateOrganization(state.activeOrg.id, patch)
  }, [state.activeOrg])

  const clearError = useCallback(() => dispatch({ type: 'CLEAR_ERROR' }), [])

  const value = useMemo<OrgContextValue>(() => ({
    state,
    activeOrg:      state.activeOrg,
    allOrgs:        state.orgs,
    loading:        state.loading,
    error:          state.error,
    switchOrg,
    refreshOrgs,
    createOrg,
    patchActiveOrg,
    clearError,
  }), [state, switchOrg, refreshOrgs, createOrg, patchActiveOrg, clearError])

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useOrg(): OrgContextValue {
  const ctx = useContext(OrgContext)
  if (!ctx) throw new Error('useOrg must be used inside <OrgProvider>')
  return ctx
}

export function useActiveOrg(): Organization | null {
  return useOrg().activeOrg
}

export function useAllOrgs(): Organization[] {
  return useOrg().allOrgs
}
