import { createPremiumUseCase } from './create-use-case.js';

export function createGetNutritionPlanUseCase(handler) {
  return createPremiumUseCase('get-nutrition-plan', handler);
}
