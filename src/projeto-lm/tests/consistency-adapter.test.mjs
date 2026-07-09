import test from 'node:test';
import assert from 'node:assert/strict';
import { adaptWeeklyConsistency } from '../adapters/consistencyAdapter.js';

const continuity = ['strong_day', 'continued', 'plan_b_win'];
const nonContinuity = ['recovery_day', 'missed_day'];
const makeStatuses = (statuses) => statuses.map((status, index) => ({ date: `2026-07-${String(index + 1).padStart(2, '0')}`, status }));
const textOf = (result) => JSON.stringify(result).toLowerCase();

test('status semanal: 5/7 retorna on_track', () => {
  const result = adaptWeeklyConsistency(makeStatuses([...continuity, 'strong_day', 'continued', ...nonContinuity]));
  assert.equal(result.weeklyStatus, 'on_track');
  assert.equal(result.continuityDays, 5);
  assert.equal(result.student_visible.title, 'Você venceu a semana.');
});

test('status semanal: 7/7 retorna on_track', () => {
  const result = adaptWeeklyConsistency(makeStatuses(['strong_day', 'continued', 'plan_b_win', 'strong_day', 'continued', 'plan_b_win', 'strong_day']));
  assert.equal(result.weeklyStatus, 'on_track');
  assert.equal(result.continuityDays, 7);
});

test('status semanal: 4/7 retorna building', () => {
  const result = adaptWeeklyConsistency(makeStatuses(['strong_day', 'continued', 'plan_b_win', 'strong_day', 'recovery_day', 'missed_day', 'missed_day']));
  assert.equal(result.weeklyStatus, 'building');
  assert.equal(result.student_visible.title, 'Você ainda está no jogo.');
});

test('status semanal: 3/7 retorna building', () => {
  const result = adaptWeeklyConsistency(makeStatuses(['strong_day', 'continued', 'plan_b_win', 'recovery_day', 'missed_day', 'missed_day', 'recovery_day']));
  assert.equal(result.weeklyStatus, 'building');
});

test('status semanal: 2/7 retorna restart_without_punishment', () => {
  const result = adaptWeeklyConsistency(makeStatuses(['strong_day', 'continued', 'recovery_day', 'missed_day', 'missed_day', 'recovery_day', 'missed_day']));
  assert.equal(result.weeklyStatus, 'restart_without_punishment');
  assert.equal(result.student_visible.title, 'Sem punição. Sem recomeço do zero.');
});

test('status semanal: 0/7 retorna restart_without_punishment', () => {
  const result = adaptWeeklyConsistency(makeStatuses(['recovery_day', 'missed_day', 'recovery_day', 'missed_day', 'missed_day', 'recovery_day', 'missed_day']));
  assert.equal(result.weeklyStatus, 'restart_without_punishment');
  assert.equal(result.continuityDays, 0);
});

test('status semanal: array vazio retorna no_data', () => {
  const result = adaptWeeklyConsistency([]);
  assert.equal(result.weeklyStatus, 'no_data');
  assert.equal(result.totalDays, 0);
  assert.equal(result.student_visible.title, 'Sua semana começa com uma ação.');
});

test('contagem: status de continuidade e não continuidade são calculados corretamente', () => {
  const result = adaptWeeklyConsistency(makeStatuses(['strong_day', 'strong_day', 'strong_day', 'continued', 'plan_b_win', 'recovery_day', 'missed_day']));
  assert.equal(result.continuityDays, 5);
  assert.deepEqual(result.counts, {
    strongDays: 3,
    continuedDays: 1,
    planBDays: 1,
    recoveryDays: 1,
    missedDays: 1
  });
});

test('normalização: aceita check-ins crus', () => {
  const result = adaptWeeklyConsistency([
    { date: '2026-07-01', workoutDone: true, nutritionDone: true },
    { date: '2026-07-02', workoutDone: true },
    { date: '2026-07-03', usedPlanB: true, hardDay: true },
    { date: '2026-07-04', hardDay: true }
  ]);
  assert.equal(result.weeklyStatus, 'building');
  assert.equal(result.continuityDays, 3);
  assert.equal(result.counts.recoveryDays, 1);
});

test('normalização: aceita status resolvido e mistura de ambos', () => {
  const result = adaptWeeklyConsistency([
    { date: '2026-07-01', status: 'strong_day' },
    { date: '2026-07-02', nutritionDone: true },
    { date: '2026-07-03', status: 'plan_b_win' },
    { date: '2026-07-04', hardDay: true },
    { date: '2026-07-05', status: 'missed_day' }
  ]);
  assert.equal(result.continuityDays, 3);
  assert.equal(result.totalDays, 5);
  assert.equal(result.student_visible.progressLabel, '3 de 5 dias de continuidade');
});

test('normalização: ignora nulos, limita aos últimos 7 válidos e ordena por data', () => {
  const result = adaptWeeklyConsistency([
    { date: '2026-07-09', status: 'missed_day' },
    null,
    { date: '2026-07-01', status: 'strong_day' },
    { date: '2026-07-08', status: 'plan_b_win' },
    { date: '2026-07-02', status: 'strong_day' },
    { date: '2026-07-03', status: 'strong_day' },
    { date: '2026-07-04', status: 'strong_day' },
    { date: '2026-07-05', status: 'strong_day' },
    { date: '2026-07-06', status: 'missed_day' },
    { date: '2026-07-07', status: 'recovery_day' }
  ]);
  assert.equal(result.totalDays, 7);
  assert.equal(result.continuityDays, 4);
  assert.deepEqual(result.counts, { strongDays: 3, continuedDays: 0, planBDays: 1, recoveryDays: 1, missedDays: 2 });
});

test('normalização: array menor que 7 não quebra', () => {
  const result = adaptWeeklyConsistency(makeStatuses(['strong_day', 'missed_day', 'continued']));
  assert.equal(result.totalDays, 3);
  assert.equal(result.student_visible.progressLabel, '2 de 3 dias de continuidade');
});

test('segurança: student_visible contém somente campos permitidos', () => {
  const visible = adaptWeeklyConsistency(makeStatuses(['strong_day', 'continued'])).student_visible;
  assert.deepEqual(Object.keys(visible).sort(), ['body', 'nextAction', 'progressLabel', 'title'].sort());
  for (const forbidden of ['weeklyStatus', 'continuityDays', 'counts', 'strongDays', 'missedDays', 'score', 'status', 'completed']) {
    assert.equal(Object.hasOwn(visible, forbidden), false);
  }
});

test('filosofia: textos não usam punição, compensação ou restrição', () => {
  const forbidden = ['falhou', 'fracassou', 'errou', 'perdeu tudo', 'compensar', 'queimar calorias', 'cardio extra', 'restrição'];
  for (const scenario of [[], makeStatuses(['strong_day']), makeStatuses(['strong_day', 'continued', 'plan_b_win']), makeStatuses(['missed_day'])]) {
    const text = textOf(adaptWeeklyConsistency(scenario));
    for (const word of forbidden) assert.equal(text.includes(word), false, `${word} apareceu em ${text}`);
  }
});

test('bridge resolveWeeklyConsistency retorna apenas student_visible', async () => {
  const previousWindow = globalThis.window;
  globalThis.window = { location: { hostname: 'localhost' }, dispatchEvent() {} };
  globalThis.CustomEvent = class CustomEvent { constructor(type) { this.type = type; } };

  await import(`../../../public/assets/js/project-lm-engine-services.js?consistency=${Date.now()}`);
  const output = globalThis.window.ProjectLmEngineServices.resolveWeeklyConsistency(makeStatuses(['strong_day', 'continued', 'plan_b_win']));

  assert.deepEqual(Object.keys(output).sort(), ['body', 'nextAction', 'progressLabel', 'title'].sort());
  assert.equal(output.progressLabel, '3 de 3 dias de continuidade');
  globalThis.window = previousWindow;
});
