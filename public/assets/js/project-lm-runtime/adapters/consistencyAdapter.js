// AUTO-GENERATED FROM src/projeto-lm — DO NOT EDIT DIRECTLY
import { adaptContinuityCheckin } from './continuityCheckinAdapter.js';

const CONTINUITY_STATUSES = new Set(['strong_day', 'continued', 'plan_b_win']);
const KNOWN_STATUSES = new Set(['strong_day', 'continued', 'plan_b_win', 'recovery_day', 'missed_day']);

const WEEKLY_MESSAGES = Object.freeze({
  on_track: Object.freeze({
    title: 'Você venceu a semana.',
    body: 'Você manteve continuidade em pelo menos 5 dos últimos 7 dias. Esse é o objetivo do Projeto LM.',
    nextAction: 'Mantenha o básico hoje. Não complique.'
  }),
  building: Object.freeze({
    title: 'Você ainda está no jogo.',
    body: 'A semana não precisa ser perfeita. Agora o foco é transformar mais um dia em continuidade.',
    nextAction: 'Escolha uma ação simples hoje e proteja o básico.'
  }),
  restart_without_punishment: Object.freeze({
    title: 'Sem punição. Sem recomeço do zero.',
    body: 'O próximo passo é recuperar uma ação simples hoje.',
    nextAction: 'Faça uma ação mínima agora: água, próxima refeição ou movimento leve.'
  }),
  no_data: Object.freeze({
    title: 'Sua semana começa com uma ação.',
    body: 'Registre o próximo passo simples para começar a construir continuidade.',
    nextAction: 'Registre uma ação simples hoje.'
  })
});

const EMPTY_COUNTS = Object.freeze({
  strongDays: 0,
  continuedDays: 0,
  planBDays: 0,
  recoveryDays: 0,
  missedDays: 0
});

function cloneCounts() {
  return { ...EMPTY_COUNTS };
}

function normalizeDateValue(value) {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : time;
}

function normalizeStatus(checkin) {
  if (checkin?.status && KNOWN_STATUSES.has(checkin.status)) return checkin.status;
  return adaptContinuityCheckin(checkin).status;
}

function normalizeCheckins(checkins) {
  if (!Array.isArray(checkins)) return [];
  return checkins
    .filter((checkin) => checkin && typeof checkin === 'object')
    .map((checkin, index) => ({
      index,
      dateTime: normalizeDateValue(checkin.date),
      status: normalizeStatus(checkin)
    }))
    .sort((a, b) => {
      if (a.dateTime !== null && b.dateTime !== null && a.dateTime !== b.dateTime) return a.dateTime - b.dateTime;
      if (a.dateTime !== null && b.dateTime === null) return -1;
      if (a.dateTime === null && b.dateTime !== null) return 1;
      return a.index - b.index;
    })
    .slice(-7);
}

function countStatuses(normalizedCheckins) {
  const counts = cloneCounts();
  for (const checkin of normalizedCheckins) {
    if (checkin.status === 'strong_day') counts.strongDays += 1;
    if (checkin.status === 'continued') counts.continuedDays += 1;
    if (checkin.status === 'plan_b_win') counts.planBDays += 1;
    if (checkin.status === 'recovery_day') counts.recoveryDays += 1;
    if (checkin.status === 'missed_day') counts.missedDays += 1;
  }
  return counts;
}

function resolveWeeklyStatus(continuityDays) {
  if (continuityDays >= 5) return 'on_track';
  if (continuityDays >= 3) return 'building';
  return 'restart_without_punishment';
}

function buildStudentVisible(message, continuityDays, totalDays) {
  return {
    title: message.title,
    body: message.body,
    progressLabel: `${continuityDays} de ${totalDays} dias de continuidade`,
    nextAction: message.nextAction
  };
}

export function adaptWeeklyConsistency(checkins = []) {
  const normalizedCheckins = normalizeCheckins(checkins);
  const totalDays = normalizedCheckins.length;

  if (totalDays === 0) {
    const message = WEEKLY_MESSAGES.no_data;
    return {
      weeklyStatus: 'no_data',
      continuityDays: 0,
      totalDays: 0,
      counts: cloneCounts(),
      message: { title: message.title, body: message.body, nextAction: message.nextAction },
      student_visible: buildStudentVisible(message, 0, 0)
    };
  }

  const counts = countStatuses(normalizedCheckins);
  const continuityDays = normalizedCheckins.filter((checkin) => CONTINUITY_STATUSES.has(checkin.status)).length;
  const weeklyStatus = resolveWeeklyStatus(continuityDays);
  const message = WEEKLY_MESSAGES[weeklyStatus];

  return {
    weeklyStatus,
    continuityDays,
    totalDays,
    counts,
    message: { title: message.title, body: message.body, nextAction: message.nextAction },
    student_visible: buildStudentVisible(message, continuityDays, totalDays)
  };
}

export const consistencyAdapter = Object.freeze({
  adaptWeeklyConsistency
});
