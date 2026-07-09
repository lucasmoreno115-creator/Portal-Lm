const FEMALE_ALIASES = new Set(['female', 'feminino', 'mulher', 'f', 'fem']);
const MALE_ALIASES = new Set(['male', 'masculino', 'homem', 'm', 'masc']);

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

const FEMALE_WEEK_KEYS = Object.freeze({ 1: 'lower_a', 2: 'upper_a', 3: 'cardio_day', 4: 'lower_b', 5: 'upper_b', 6: 'cardio_day', 0: 'rest_day' });
const MALE_WEEK_KEYS = Object.freeze({ 1: 'upper_a', 2: 'lower_a', 3: 'cardio_day', 4: 'upper_b', 5: 'lower_b', 6: 'cardio_day', 0: 'rest_day' });

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

export function resolveWorkoutProfile(sex) {
  return sex === 'male' ? 'GYM_MALE' : 'GYM_FEMALE';
}

function resolveDate(value) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function titleFor(dayKey, dayIndex) {
  if (dayKey === 'cardio_day' && dayIndex === 6) return 'Cardio opcional';
  return DAY_META[dayKey]?.title || 'Treino Projeto LM';
}

function buildWeekDay(dayIndex, dayKey, todayIndex) {
  const labels = WEEKDAY_LABELS[dayIndex];
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
  const sex = normalizeWorkoutSex(firstValue(input, ['sex', 'sexo', 'gender', 'genero', 'gênero'])) || 'female';
  const date = resolveDate(firstValue(input, ['date', 'currentDate', 'today']));
  const todayIndex = date.getDay();
  const weekKeys = sex === 'male' ? MALE_WEEK_KEYS : FEMALE_WEEK_KEYS;
  const week = [1, 2, 3, 4, 5, 6, 0].map((dayIndex) => buildWeekDay(dayIndex, weekKeys[dayIndex], todayIndex));
  const today = buildWeekDay(todayIndex, weekKeys[todayIndex], todayIndex);
  const nextWorkouts = [];

  for (let offset = 1; nextWorkouts.length < 3 && offset <= 10; offset += 1) {
    const dayIndex = (todayIndex + offset) % 7;
    const dayKey = weekKeys[dayIndex];
    if (dayKey === 'rest_day') continue;
    const day = buildWeekDay(dayIndex, dayKey, todayIndex);
    nextWorkouts.push({ label: day.label, dayKey: day.dayKey, title: day.title, type: day.type });
  }

  return {
    workoutProfile: resolveWorkoutProfile(sex),
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
