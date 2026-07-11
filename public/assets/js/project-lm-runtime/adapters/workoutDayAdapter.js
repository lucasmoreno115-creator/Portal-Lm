import { getWorkoutDayKey, resolveLegacyWorkoutProfile, resolveWorkoutProgram, WEEKDAY_KEYS } from '../engines/training/workoutLibrary.js';

const FEMALE_ALIASES = new Set(['female', 'feminino', 'mulher', 'f', 'fem']);
const MALE_ALIASES = new Set(['male', 'masculino', 'homem', 'm', 'masc']);
const OFFICIAL_NUTRITION_PROFILES = new Set(['M1', 'M2', 'M3', 'H1', 'H2', 'H3']);

const REST_GUIDANCE = 'Hoje é dia de descanso. Se quiser se movimentar, faça uma caminhada leve e mantenha a alimentação planejada.';

const WEEKDAY_LABELS = Object.freeze({
  0: { weekday: 'sunday', label: 'Domingo' },
  1: { weekday: 'monday', label: 'Segunda' },
  2: { weekday: 'tuesday', label: 'Terça' },
  3: { weekday: 'wednesday', label: 'Quarta' },
  4: { weekday: 'thursday', label: 'Quinta' },
  5: { weekday: 'friday', label: 'Sexta' },
  6: { weekday: 'saturday', label: 'Sábado' }
});

const DAY_META = Object.freeze({
  lower_a: { title: 'Inferiores A', type: 'strength', rest_day: false },
  upper_a: { title: 'Superiores A', type: 'strength', rest_day: false },
  lower_b: { title: 'Inferiores B', type: 'strength', rest_day: false },
  upper_b: { title: 'Superiores B', type: 'strength', rest_day: false },
  cardio_day: { title: 'Cardio e mobilidade', type: 'cardio', rest_day: false },
  rest_day: { title: 'Descanso', type: 'rest', rest_day: true }
});

function firstValue(source, keys) {
  for (const key of keys) {
    if (source?.[key] !== undefined && source[key] !== null && source[key] !== '') return source[key];
  }
  return undefined;
}

export function normalizeWorkoutSex(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (FEMALE_ALIASES.has(normalized)) return 'female';
  if (MALE_ALIASES.has(normalized)) return 'male';
  return null;
}

function normalizeOfficialProfile(value) {
  const normalized = String(value ?? '').trim().toUpperCase();
  return OFFICIAL_NUTRITION_PROFILES.has(normalized) ? normalized : null;
}

function fallbackProfileForSex(sex) {
  return sex === 'male' ? 'H2' : 'M2';
}

function resolveProfile(input = {}) {
  return normalizeOfficialProfile(firstValue(input, ['profile', 'perfil', 'nutrition_profile', 'nutritionProfile', 'nutrition_plan_id', 'nutritionPlanId', 'nutrition_plan_code', 'nutritionPlanCode']))
    || fallbackProfileForSex(normalizeWorkoutSex(firstValue(input, ['sex', 'sexo', 'gender', 'genero', 'gênero'])) || 'female');
}

export function resolveWorkoutProfile(sexOrProfile) {
  const profile = normalizeOfficialProfile(sexOrProfile) || fallbackProfileForSex(normalizeWorkoutSex(sexOrProfile) || 'female');
  return resolveLegacyWorkoutProfile(resolveWorkoutProgram(profile));
}

function resolveDate(value) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function titleFor(dayKey, dayIndex) {
  if (dayKey === 'cardio_day' && dayIndex === 6) return 'Cardio opcional';
  return DAY_META[dayKey]?.title || 'Treino Projeto LM';
}

function buildWeekDay(profile, dayIndex, todayIndex) {
  const labels = WEEKDAY_LABELS[dayIndex];
  const dayKey = getWorkoutDayKey(profile, WEEKDAY_KEYS[dayIndex]) || 'rest_day';
  const meta = DAY_META[dayKey] || DAY_META.rest_day;
  const title = titleFor(dayKey, dayIndex);
  return {
    weekday: labels.weekday,
    label: labels.label,
    dayKey,
    title,
    type: meta.type,
    rest_day: meta.rest_day,
    isToday: dayIndex === todayIndex,
    ...(meta.rest_day ? { message: REST_GUIDANCE } : {})
  };
}

export function adaptWorkoutDay(input = {}) {
  const profile = resolveProfile(input);
  const date = resolveDate(firstValue(input, ['date', 'currentDate', 'today']));
  const todayIndex = date.getDay();
  const week = [1, 2, 3, 4, 5, 6, 0].map((dayIndex) => buildWeekDay(profile, dayIndex, todayIndex));
  const today = buildWeekDay(profile, todayIndex, todayIndex);
  const nextWorkouts = [];

  for (let offset = 1; nextWorkouts.length < 3 && offset <= 10; offset += 1) {
    const dayIndex = (todayIndex + offset) % 7;
    const day = buildWeekDay(profile, dayIndex, todayIndex);
    if (day.dayKey === 'rest_day') continue;
    nextWorkouts.push({ label: day.label, dayKey: day.dayKey, title: day.title, type: day.type });
  }

  return {
    workoutProfile: resolveWorkoutProfile(profile),
    sourceProfile: profile,
    today: {
      dayKey: today.dayKey,
      label: today.title,
      title: today.title,
      type: today.type,
      rest_day: today.rest_day,
      ...(today.rest_day ? { message: REST_GUIDANCE } : {})
    },
    week,
    nextWorkouts
  };
}

export const workoutDayAdapter = Object.freeze({
  adaptWorkoutDay,
  normalizeWorkoutSex,
  resolveWorkoutProfile
});
