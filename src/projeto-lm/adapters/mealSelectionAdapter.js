import { getAllowedMeals, getDefaultMealSelections } from '../engines/nutrition/nutritionLibrary.js';

export const DEFAULT_MEAL_SELECTIONS = Object.freeze(getDefaultMealSelections());

const MEAL_KEY_ALIASES = Object.freeze({
  breakfast: ['breakfast', 'cafe_da_manha', 'café_da_manhã', 'cafeDaManha', 'caféDaManhã', 'cafe', 'manhã', 'manha'],
  lunch: ['lunch', 'almoco', 'almoço'],
  snack: ['snack', 'lanche'],
  dinner: ['dinner', 'jantar']
});

const SELECTION_SOURCE_KEYS = Object.freeze([
  'selectedMeals',
  'mealSelections',
  'projectLmMealSelections'
]);

function normalizeKey(value) {
  return String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s-]+/g, '_')
    .toLowerCase();
}

const NORMALIZED_ALIAS_TO_SLOT = Object.freeze(
  Object.fromEntries(
    Object.entries(MEAL_KEY_ALIASES).flatMap(([slot, aliases]) => aliases.map((alias) => [normalizeKey(alias), slot]))
  )
);

function firstObject(...values) {
  return values.find((value) => value && typeof value === 'object' && !Array.isArray(value)) || {};
}

export function extractMealSelections(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  return firstObject(
    source.selectedMeals,
    source.mealSelections,
    source.projectLmMealSelections,
    source.profile?.selectedMeals,
    source.profile?.mealSelections,
    ...SELECTION_SOURCE_KEYS.map((key) => source.student?.[key]),
    source.student?.profile?.selectedMeals,
    source.student?.profile?.mealSelections
  );
}

function normalizeMealSelections(rawSelections = {}) {
  const normalized = {};
  for (const [rawKey, value] of Object.entries(rawSelections || {})) {
    const slot = NORMALIZED_ALIAS_TO_SLOT[normalizeKey(rawKey)];
    if (slot && value !== undefined && value !== null && value !== '') normalized[slot] = String(value).trim();
  }
  return normalized;
}

export function adaptMealSelection(input = {}) {
  const rawSelections = firstObject(input?.selectedMeals, input?.mealSelections, input?.projectLmMealSelections, input);
  const normalizedSelections = normalizeMealSelections(rawSelections);

  return Object.fromEntries(
    Object.entries(DEFAULT_MEAL_SELECTIONS).map(([slot, fallbackId]) => {
      const candidate = normalizedSelections[slot];
      const allowedIds = getAllowedMeals(slot);
      return [slot, allowedIds.includes(candidate) ? candidate : fallbackId];
    })
  );
}

export const mealSelectionAdapter = Object.freeze({
  adaptMealSelection,
  extractMealSelections,
  DEFAULT_MEAL_SELECTIONS
});
