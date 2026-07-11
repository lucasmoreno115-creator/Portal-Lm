// AUTO-GENERATED FROM src/projeto-lm — DO NOT EDIT DIRECTLY
import foods from './foods.json' with { type: 'json' };
import mealLibrary from './meal_library.json' with { type: 'json' };
import mealTemplates from './meal_templates.json' with { type: 'json' };
import portions from './portions.json' with { type: 'json' };
import substitutions from './substitutions.json' with { type: 'json' };
import planB from './plan_b.json' with { type: 'json' };

const foodById = Object.freeze(Object.fromEntries(foods.map((food) => [food.id, food])));
const slotByKey = Object.freeze(Object.fromEntries(mealLibrary.slots.map((slot) => [slot.key, slot])));

export function getNutritionSlots() {
  return mealLibrary.slots;
}

export function getDefaultMealSelections() {
  return Object.fromEntries(mealLibrary.slots.map((slot) => [slot.key, slot.default]));
}

export function getAllowedMeals(slotKey) {
  return slotByKey[slotKey]?.meals || [];
}

export function getMealSlot(slotKey) {
  return slotByKey[slotKey] || null;
}

export function getMealTemplate(mealId) {
  return mealTemplates[mealId] || null;
}

export function getFood(foodId) {
  return foodById[foodId] || null;
}

export function getPortion(foodId, profile) {
  return portions[foodId]?.[profile] || null;
}

export function getSubstitutions(foodId) {
  return substitutions[foodId] || null;
}

export function getPlanB(slotKey) {
  return planB[slotKey] || [];
}

export function getNutritionTitle() {
  return mealLibrary.title;
}

export function getNutritionGuidance() {
  return mealLibrary.guidance;
}

export function getMealNote() {
  return mealLibrary.meal_note;
}

export const nutritionLibrary = Object.freeze({
  foodById,
  mealLibrary,
  mealTemplates,
  portions,
  substitutions,
  planB
});
