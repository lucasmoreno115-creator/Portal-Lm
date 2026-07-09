import { adaptMealSelection, extractMealSelections } from './mealSelectionAdapter.js';
import { adaptWorkoutDay, resolveWorkoutProfile as resolveWeeklyWorkoutProfile } from './workoutDayAdapter.js';

const FEMALE_ALIASES = new Set(['female', 'feminino', 'mulher', 'f']);
const MALE_ALIASES = new Set(['male', 'masculino', 'homem', 'm']);

function warnDevelopment(message) {
  const env = globalThis?.process?.env?.NODE_ENV;
  const isLocalhost = globalThis?.window?.location?.hostname === 'localhost';
  if (env === 'development' || isLocalhost) console.warn(`[Projeto LM] ${message}`);
}

function firstValue(source, keys) {
  for (const key of keys) {
    if (source?.[key] !== undefined && source[key] !== null && source[key] !== '') return source[key];
  }
  return undefined;
}

export function normalizeStudentSex(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (FEMALE_ALIASES.has(normalized)) return 'female';
  if (MALE_ALIASES.has(normalized)) return 'male';
  return null;
}

function normalizeWeight(value) {
  const number = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(number) && number > 0 ? number : null;
}

export function resolveNutritionProfile(sex, weight) {
  if (sex === 'male') {
    if (weight === null) return 'H2';
    if (weight < 80) return 'H1';
    if (weight < 100) return 'H2';
    return 'H3';
  }

  if (weight === null) return 'M2';
  if (weight < 70) return 'M1';
  if (weight < 90) return 'M2';
  return 'M3';
}

export function resolveWorkoutProfile(sex) {
  return resolveWeeklyWorkoutProfile(sex);
}

export function resolveWorkoutDay(sex, dateValue) {
  const weeklyPlan = adaptWorkoutDay({ sex, date: dateValue });
  return {
    day: weeklyPlan.today.dayKey,
    rest_day: weeklyPlan.today.rest_day,
    rest_guidance: weeklyPlan.today.message
  };
}

export function adaptStudentProfile(student = {}, options = {}) {
  const rawSex = firstValue(student, ['sex', 'sexo', 'gender', 'genero', 'gênero']);
  const sex = normalizeStudentSex(rawSex);
  if (!sex && rawSex !== undefined) warnDevelopment('Sexo inválido no perfil do aluno; usando fallback seguro.');
  if (!sex && rawSex === undefined) warnDevelopment('Sexo ausente no perfil do aluno; usando fallback seguro.');

  const fallbackSex = sex || 'female';
  const weight = normalizeWeight(firstValue(student, ['weight', 'peso', 'weight_kg', 'peso_kg']));
  const workoutDate = firstValue(options, ['date', 'currentDate', 'today']) || firstValue(student, ['date', 'currentDate', 'today', 'createdAt', 'created_at']);
  const weeklyPlan = adaptWorkoutDay({ sex: fallbackSex, date: workoutDate });
  const selectedMeals = adaptMealSelection(extractMealSelections({ student, ...options }));

  return {
    nutritionInput: {
      profile: resolveNutritionProfile(fallbackSex, weight),
      ...selectedMeals
    },
    workoutInput: {
      profile: weeklyPlan.workoutProfile,
      day: weeklyPlan.today.dayKey,
      rest_day: weeklyPlan.today.rest_day,
      rest_guidance: weeklyPlan.today.message
    },
    weeklyPlan,
    studentMeta: {
      name: firstValue(student, ['name', 'nome']) || '',
      sex: fallbackSex,
      goal: firstValue(student, ['goal', 'objetivo']) || ''
    }
  };
}

export const studentProfileAdapter = Object.freeze({
  adaptStudentProfile,
  normalizeStudentSex,
  resolveNutritionProfile,
  resolveWorkoutProfile,
  resolveWorkoutDay
});
