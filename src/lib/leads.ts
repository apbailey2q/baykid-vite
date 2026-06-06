// leads.ts — thin re-export shim
// automationRules.ts does `import('./leads')` to avoid circular deps.
// This file simply forwards everything from leadStorage so the import path works.
export {
  loadLeads, saveLeads, upsertLead, removeLead, setLeadStatus,
  initializeLeads, subscribe,
  createManualLead, createLeadFromRule,
  createLeadFromComment, createLeadFromEmail, createLeadFromPost,
  LEAD_STATUS_META, LEAD_SOURCE_LABELS,
  leadPipelineStats, followUpsDueCount,
  LEADS_KEY,
} from './leadStorage'
export type { CreateLeadFromRuleOpts } from './leadStorage'
export type { Lead, LeadStatus, LeadSource } from './aiMarketing'
