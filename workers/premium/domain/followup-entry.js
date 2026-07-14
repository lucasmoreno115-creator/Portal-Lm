export const FollowupEntryType = Object.freeze({
  PROFESSIONAL_NOTE: 'PROFESSIONAL_NOTE',
  PROFESSIONAL_DECISION: 'PROFESSIONAL_DECISION',
  PLAN_CHANGE: 'PLAN_CHANGE',
  ANAMNESIS_REVIEW: 'ANAMNESIS_REVIEW',
  FEEDBACK_REVIEW: 'FEEDBACK_REVIEW',
  CONSULTATION_STATUS_CHANGE: 'CONSULTATION_STATUS_CHANGE',
  PENDING_ITEM_CREATED: 'PENDING_ITEM_CREATED',
  PENDING_ITEM_RESOLVED: 'PENDING_ITEM_RESOLVED',
});
export const ProfessionalDecisionType = Object.freeze({
  KEEP_STRATEGY: 'KEEP_STRATEGY',
  UPDATE_PLAN: 'UPDATE_PLAN',
  CONTACT_STUDENT: 'CONTACT_STUDENT',
  REQUEST_MORE_INFORMATION: 'REQUEST_MORE_INFORMATION',
});
const entryTypes = new Set(Object.values(FollowupEntryType));
const decisions = new Set(Object.values(ProfessionalDecisionType));
export function assertFollowupEntryType(type) { if (!entryTypes.has(type)) throw new Error(`INVALID_FOLLOWUP_ENTRY_TYPE:${type}`); return type; }
export function assertProfessionalDecisionType(type) { if (!decisions.has(type)) throw new Error(`INVALID_PROFESSIONAL_DECISION_TYPE:${type}`); return type; }
export function listFollowupEntryTypes() { return [...entryTypes]; }
