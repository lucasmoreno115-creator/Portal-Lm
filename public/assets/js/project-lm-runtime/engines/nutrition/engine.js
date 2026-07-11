// AUTO-GENERATED FROM src/projeto-lm — DO NOT EDIT DIRECTLY
import {
  getFood,
  getMealNote,
  getMealSlot,
  getMealTemplate,
  getNutritionGuidance,
  getNutritionSlots,
  getNutritionTitle,
  getPlanB,
  getPortion,
  getSubstitutions
} from './nutritionLibrary.js';
import { assertStudentNutritionOutputSafe, validateNutritionData, validateNutritionInput } from './validators.js';

function buildMeal(profile, slotKey, mealId) {
  const template = getMealTemplate(mealId);
  return {
    name: template.name,
    foods: template.foods.map((foodId) => ({
      name: getFood(foodId).name,
      quantity: getPortion(foodId, profile),
      substitutions: getSubstitutions(foodId)
    })),
    plan_b: getPlanB(slotKey),
    notes: getMealNote()
  };
}

export function generateNutritionPlan(input) {
  validateNutritionInput(input);
  validateNutritionData(input.profile, getNutritionSlots().map((slot) => input[slot.key]));

  const student_visible = {
    title: getNutritionTitle(),
    guidance: getNutritionGuidance(),
    meals: getNutritionSlots().map((slot) => ({
      slot_name: getMealSlot(slot.key).slot_name,
      ...buildMeal(input.profile, slot.key, input[slot.key])
    }))
  };

  assertStudentNutritionOutputSafe(student_visible);

  return {
    product: 'Projeto LM',
    type: 'nutrition_plan',
    profile_internal: input.profile,
    student_visible
  };
}
