// AUTO-GENERATED FROM src/projeto-lm — DO NOT EDIT DIRECTLY
const TRUE_VALUES = new Set(['true', '1', 'sim', 's', 'yes', 'y']);
const FALSE_VALUES = new Set(['false', '0', 'nao', 'não', 'n', 'no']);

const MESSAGES = Object.freeze({
  strong_day: Object.freeze({
    title: 'Hoje foi um dia forte.',
    body: 'Você cumpriu o principal. Agora é repetir o básico amanhã.',
    nextAction: 'Mantenha o básico no próximo bloco do dia.'
  }),
  continued: Object.freeze({
    title: 'Você continuou.',
    body: 'Mesmo que não tenha sido perfeito, você não abandonou o processo.',
    nextAction: 'Volte para o plano normal na próxima refeição ou no próximo treino.'
  }),
  plan_b_win: Object.freeze({
    title: 'Plano B também é vitória.',
    body: 'Em dia difícil, manter o mínimo é melhor do que recomeçar do zero.',
    nextAction: 'Volte para o plano normal na próxima refeição ou no próximo treino.'
  }),
  recovery_day: Object.freeze({
    title: 'Dia difícil identificado.',
    body: 'Hoje não precisa virar abandono. O próximo passo é simples: volte na próxima refeição.',
    nextAction: 'Escolha uma ação pequena agora: água, próxima refeição ou caminhada leve.'
  }),
  missed_day: Object.freeze({
    title: 'Um dia não define o processo.',
    body: 'Não tente resolver com exagero. Apenas retome o plano no próximo bloco do dia.',
    nextAction: 'Volte ao plano no próximo bloco do dia, com um passo simples.'
  })
});

function firstValue(source, keys) {
  for (const key of keys) {
    if (source?.[key] !== undefined && source[key] !== null && source[key] !== '') return source[key];
  }
  return undefined;
}

export function normalizeCheckinBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1 ? true : value === 0 ? false : Boolean(value);
  const normalized = String(value ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;
  return false;
}

export function normalizeContinuityCheckin(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  return {
    workout: normalizeCheckinBoolean(firstValue(source, ['workoutDone', 'workout', 'trainingDone', 'treinoFeito', 'treino'])),
    nutrition: normalizeCheckinBoolean(firstValue(source, ['nutritionDone', 'nutrition', 'alimentacaoFeita', 'alimentaçãoFeita', 'alimentacao'])),
    planB: normalizeCheckinBoolean(firstValue(source, ['usedPlanB', 'planB', 'planoB', 'plano_b'])),
    hardDay: normalizeCheckinBoolean(firstValue(source, ['hardDay', 'difficultDay', 'diaDificil', 'diaDifícil', 'dia_dificil']))
  };
}

function resolveStatus(completed) {
  if (completed.planB && completed.hardDay) return 'plan_b_win';
  if (completed.workout && completed.nutrition) return 'strong_day';
  if (completed.workout || completed.nutrition || completed.planB) return 'continued';
  if (completed.hardDay) return 'recovery_day';
  return 'missed_day';
}

function score(completed) {
  return Number(completed.workout) + Number(completed.nutrition) + Number(completed.planB);
}

export function adaptContinuityCheckin(input = {}) {
  const completed = normalizeContinuityCheckin(input);
  const status = resolveStatus(completed);
  const message = MESSAGES[status];
  return {
    status,
    score: score(completed),
    completed,
    message: { title: message.title, body: message.body },
    nextAction: message.nextAction,
    student_visible: {
      title: message.title,
      body: message.body,
      nextAction: message.nextAction
    }
  };
}

export const continuityCheckinAdapter = Object.freeze({
  adaptContinuityCheckin,
  normalizeContinuityCheckin,
  normalizeCheckinBoolean
});
