import { createPremiumUseCase } from './create-use-case.js';

export function createSaveNutritionPlanUseCase(handler) {
  return createPremiumUseCase('save-nutrition-plan', handler);
}
