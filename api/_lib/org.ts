// api/_lib/org.ts — Single-tenant org scoping for Phase 2.
//
// Every server route currently writes against this constant. When Phase 3
// multi-tenant lands, replace ACTIVE_ORG_ID with a session-derived lookup
// (e.g. resolveOrgFromRequest(req)) and every handler is upgraded in one
// diff. The schema already supports multi-tenant via the organization_id
// column on social_accounts / oauth_state / publish_jobs.

export const ACTIVE_ORG_ID = '00000000-0000-0000-0000-00000000ba47'
