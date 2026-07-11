// AUTO-GENERATED FROM src/projeto-lm — DO NOT EDIT DIRECTLY
import profiles from './profiles.json' with { type: 'json' };
import { getFood, getMealTemplate, getNutritionSlots, getPortion, getSubstitutions } from './nutritionLibrary.js';

const INTERNAL_KEYS = ['calories', 'macros', 'profile_internal', 'id', 'code'];

export function validateNutritionInput(input) {
  if (!input || !profiles[input.profile]) throw new Error('Perfil nutricional inválido para o Projeto LM.');
  for (const slot of getNutritionSlots()) {
    if (!getMealTemplate(input[slot.key])) throw new Error(`Refeição inválida: ${slot.key}.`);
  }
  return true;
}

export function validateNutritionData(profile, mealIds) {
  for (const mealId of mealIds) {
    const template = getMealTemplate(mealId);
    for (const foodId of template.foods) {
      if (!getFood(foodId)) throw new Error(`Alimento inválido: ${foodId}.`);
      if (!getPortion(foodId, profile)) throw new Error(`Porção ausente para ${foodId} no perfil ${profile}.`);
      if (!Array.isArray(getSubstitutions(foodId))) throw new Error(`Substituição inválida para ${foodId}.`);
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
