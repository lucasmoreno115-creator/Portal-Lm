import { adaptMealSelection, extractMealSelections } from './mealSelectionAdapter.js';
import { adaptWorkoutDay, resolveWorkoutProfile as resolveWeeklyWorkoutProfile } from './workoutDayAdapter.js';

const FEMALE_ALIASES = new Set(['female', 'feminino', 'mulher', 'f']);
const MALE_ALIASES = new Set(['male', 'masculino', 'homem', 'm']);
const OFFICIAL_NUTRITION_PROFILES = new Set(['M1', 'M2', 'M3', 'H1', 'H2', 'H3']);

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

export function normalizeNutritionProfile(value) {
  const normalized = String(value ?? '').trim().toUpperCase();
  return OFFICIAL_NUTRITION_PROFILES.has(normalized) ? normalized : null;
}

function profileSex(profile) {
  if (!profile) return null;
  return profile.startsWith('H') ? 'male' : 'female';
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
  const rawProfile = firstValue(student, ['profile', 'perfil', 'nutrition_profile', 'nutritionProfile', 'nutrition_plan_id', 'nutritionPlanId', 'nutrition_plan_code', 'nutritionPlanCode']);
  const officialProfile = normalizeNutritionProfile(rawProfile);
  if (!officialProfile && rawProfile !== undefined) warnDevelopment('Perfil oficial inválido no cadastro do aluno; usando fallback seguro.');

  const rawSex = firstValue(student, ['sex', 'sexo', 'gender', 'genero', 'gênero']);
  const sex = normalizeStudentSex(rawSex) || profileSex(officialProfile);
  if (!sex && rawSex !== undefined) warnDevelopment('Sexo inválido no perfil do aluno; usando fallback seguro.');
  if (!sex && rawSex === undefined) warnDevelopment('Sexo ausente no perfil do aluno; usando fallback seguro.');

  const fallbackSex = sex || 'female';
  const weight = normalizeWeight(firstValue(student, ['weight', 'peso', 'weight_kg', 'peso_kg']));
  const workoutDate = firstValue(options, ['date', 'currentDate', 'today']) || firstValue(student, ['date', 'currentDate', 'today', 'createdAt', 'created_at']);
  const weeklyPlan = adaptWorkoutDay({ sex: fallbackSex, date: workoutDate });
  const selectedMeals = adaptMealSelection(extractMealSelections({ student, ...options }));

  return {
    nutritionInput: {
      profile: officialProfile || resolveNutritionProfile(fallbackSex, weight),
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
  resolveWorkoutDay,
  normalizeNutritionProfile
});
