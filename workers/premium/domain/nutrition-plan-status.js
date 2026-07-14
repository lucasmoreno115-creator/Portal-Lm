export const NUTRITION_PLAN_STATUS = Object.freeze({ DRAFT: 'DRAFT', PUBLISHED: 'PUBLISHED', ARCHIVED: 'ARCHIVED' });
export const NUTRITION_PLAN_STATUSES = Object.freeze(Object.values(NUTRITION_PLAN_STATUS));
export function isValidNutritionPlanStatus(status) { return NUTRITION_PLAN_STATUSES.includes(status); }
export function assertValidNutritionPlanStatus(status) { if (!isValidNutritionPlanStatus(status)) throw new Error('INVALID_NUTRITION_PLAN_STATUS'); return status; }
export function canEditNutritionPlan(plan) { return plan?.status === NUTRITION_PLAN_STATUS.DRAFT; }
export function assertDraftEditable(plan) { if (!canEditNutritionPlan(plan)) throw new Error('NUTRITION_PLAN_NOT_EDITABLE'); return plan; }
export function normalizeLifecycleStatus(row) {
  if (row?.status) return assertValidNutritionPlanStatus(row.status);
  return Number(row?.is_active) === 1 ? NUTRITION_PLAN_STATUS.PUBLISHED : NUTRITION_PLAN_STATUS.ARCHIVED;
}
export function isLifecycleCompatible(row) {
  const status = normalizeLifecycleStatus(row);
  return !((status === NUTRITION_PLAN_STATUS.DRAFT || status === NUTRITION_PLAN_STATUS.ARCHIVED) && Number(row?.is_active) === 1);
}
