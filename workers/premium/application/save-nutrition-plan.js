import { createPremiumUseCase } from './create-use-case.js';
import { resolvePremiumIdentityForLegacyEmail } from './dual-write-helpers.js';

export function createSaveNutritionPlanUseCase(depsOrHandler) {
  if (typeof depsOrHandler === 'function') return createPremiumUseCase('save-nutrition-plan', depsOrHandler);
  const deps = depsOrHandler;
  return createPremiumUseCase('save-nutrition-plan', async ({ plan, route, method }) => {
    const identity = await resolvePremiumIdentityForLegacyEmail({ identityService: deps.identityService, email: plan.student_email, log: deps.log, area: 'premium_nutrition_plan', route, method, allowLegacyFallback: true });
    if (identity.blocked) return { ok: false, blocked: true, reason: identity.reason, identity };
    const saved = await deps.nutritionPlanRepository.saveCurrent({ ...plan, student_id: identity.student_id, allowLegacyFallback: identity.allowFallback });
    await deps.eventRepository?.append?.({ id: deps.randomUUID(), student_id: identity.student_id, student_email: plan.student_email, event_type: 'PLAN_UPDATED', source: 'admin', title: 'Plano alimentar atualizado', metadata: { nutrition_plan_id: plan.id }, created_at: plan.updated_at });
    return { saved, identity };
  });
}
