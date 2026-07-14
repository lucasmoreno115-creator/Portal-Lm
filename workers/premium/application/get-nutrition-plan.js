import { createPremiumUseCase } from './create-use-case.js';
import { dualReadByIdentity } from './dual-write-helpers.js';

export function createGetNutritionPlanUseCase(depsOrHandler) {
  if (typeof depsOrHandler === 'function') return createPremiumUseCase('get-nutrition-plan', depsOrHandler);
  const deps = depsOrHandler;
  return createPremiumUseCase('get-nutrition-plan', async ({ email, route, method }) => dualReadByIdentity({
    identityService: deps.identityService,
    repository: deps.nutritionPlanRepository,
    email,
    byStudentId: 'findCurrentByStudentId',
    byEmail: 'findCurrentByEmail',
    log: deps.log,
    area: 'premium_nutrition_plan',
    route,
    method,
    allowLegacyFallback: true,
  }));
}
