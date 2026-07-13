import { createPassThroughPresenter } from './create-pass-through-presenter.js';

export function createNutritionPlanPresenter() {
  return createPassThroughPresenter('nutrition-plan');
}
