import foods from './foods.json' with { type: 'json' };
import portions from './portions.json' with { type: 'json' };
import substitutions from './substitutions.json' with { type: 'json' };
import templates from './meal_templates.json' with { type: 'json' };
import profiles from './profiles.json' with { type: 'json' };

const INTERNAL_KEYS = ['calories', 'macros', 'profile_internal', 'id', 'code'];

export function validateNutritionInput(input) {
  if (!input || !profiles[input.profile]) throw new Error('Perfil nutricional inválido para o Projeto LM.');
  for (const key of ['breakfast', 'lunch', 'snack', 'dinner']) {
    if (!templates[input[key]]) throw new Error(`Refeição inválida: ${key}.`);
  }
  return true;
}

export function validateNutritionData(profile, mealIds) {
  const foodIds = new Set(foods.map((food) => food.id));
  for (const mealId of mealIds) {
    const template = templates[mealId];
    for (const foodId of template.foods) {
      if (!foodIds.has(foodId)) throw new Error(`Alimento inválido: ${foodId}.`);
      if (!portions[foodId]?.[profile]) throw new Error(`Porção ausente para ${foodId} no perfil ${profile}.`);
      if (!Array.isArray(substitutions[foodId])) throw new Error(`Substituição inválida para ${foodId}.`);
    }
  }
  return true;
}

function walkVisibleKeys(value, visitor) {
  if (Array.isArray(value)) {
    value.forEach((item) => walkVisibleKeys(item, visitor));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      visitor(key);
      walkVisibleKeys(child, visitor);
    }
  }
}

export function assertStudentNutritionOutputSafe(studentVisible) {
  walkVisibleKeys(studentVisible, (key) => {
    if (INTERNAL_KEYS.includes(key)) throw new Error(`Campo interno encontrado na saída visível: ${key}.`);
  });
  return true;
}
