export const PendingItemStatus = Object.freeze({ OPEN: 'OPEN', RESOLVED: 'RESOLVED', DISMISSED: 'DISMISSED' });
export const PendingItemPriority = Object.freeze({ NORMAL: 'NORMAL', HIGH: 'HIGH' });
export const PendingItemType = Object.freeze({
  ANALYZE_ANAMNESIS: 'ANALYZE_ANAMNESIS',
  CREATE_NUTRITION_PLAN: 'CREATE_NUTRITION_PLAN',
  ANALYZE_WEEKLY_FEEDBACK: 'ANALYZE_WEEKLY_FEEDBACK',
  CONTACT_STUDENT: 'CONTACT_STUDENT',
  REQUEST_INFORMATION: 'REQUEST_INFORMATION',
  CUSTOM: 'CUSTOM',
});
const statuses = new Set(Object.values(PendingItemStatus));
const priorities = new Set(Object.values(PendingItemPriority));
const types = new Set(Object.values(PendingItemType));
export function assertPendingItemStatus(status) { if (!statuses.has(status)) throw new Error(`INVALID_PENDING_ITEM_STATUS:${status}`); return status; }
export function assertPendingItemPriority(priority) { if (!priorities.has(priority)) throw new Error(`INVALID_PENDING_ITEM_PRIORITY:${priority}`); return priority; }
export function assertPendingItemType(type) { if (!types.has(type)) throw new Error(`INVALID_PENDING_ITEM_TYPE:${type}`); return type; }
