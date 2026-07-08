import foods from './foods.json' with { type: 'json' };
import portions from './portions.json' with { type: 'json' };
import substitutions from './substitutions.json' with { type: 'json' };
import templates from './meal_templates.json' with { type: 'json' };
import planB from './plan_b.json' with { type: 'json' };
import { assertStudentNutritionOutputSafe, validateNutritionData, validateNutritionInput } from './validators.js';

const foodById = Object.fromEntries(foods.map((food) => [food.id, food]));
const mealSlots = [
  ['breakfast', 'Café da manhã'],
  ['lunch', 'Almoço'],
  ['snack', 'Lanche'],
  ['dinner', 'Jantar']
];

function buildMeal(profile, slot, mealId) {
  const template = templates[mealId];
  return {
    name: template.name,
    foods: template.foods.map((foodId) => ({
      name: foodById[foodId].name,
      quantity: portions[foodId][profile],
      substitutions: substitutions[foodId]
    })),
    plan_b: planB[slot] ?? [],
    notes: 'Faça o melhor possível na refeição atual e volte ao plano na próxima refeição.'
  };
}

export function generateNutritionPlan(input) {
  validateNutritionInput(input);
  validateNutritionData(input.profile, mealSlots.map(([slot]) => input[slot]));

  const student_visible = {
    title: 'Plano alimentar Projeto LM',
    guidance: 'Use este plano como base do seu dia. Se algo sair do previsto, use o Plano B e mantenha a continuidade.',
    meals: mealSlots.map(([slot, fallbackName]) => ({
      slot_name: fallbackName,
      ...buildMeal(input.profile, slot, input[slot])
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
