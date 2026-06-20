import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProjectLmConsistency } from '../workers/api.js';

const today = new Date('2026-06-20T12:00:00.000Z');

test('calcula dias ativos, sequência atual, maior sequência e calendário dos últimos 30 dias', () => {
  const result = buildProjectLmConsistency([
    { action_date: '2026-06-14' },
    { action_date: '2026-06-15' },
    { action_date: '2026-06-15' },
    { action_date: '2026-06-18' },
    { action_date: '2026-06-19' },
    { action_date: '2026-06-20' }
  ], today);

  assert.equal(result.activeDays, 5);
  assert.equal(result.currentStreak, 3);
  assert.equal(result.bestStreak, 3);
  assert.equal(result.calendar.length, 30);
  assert.deepEqual(result.calendar.at(0), { date: '2026-05-22', completed: false });
  assert.deepEqual(result.calendar.at(-1), { date: '2026-06-20', completed: true });
});

test('sequência atual é zero quando hoje não tem ação concluída', () => {
  const result = buildProjectLmConsistency([
    { action_date: '2026-06-17' },
    { action_date: '2026-06-18' },
    { action_date: '2026-06-19' }
  ], today);

  assert.equal(result.activeDays, 3);
  assert.equal(result.currentStreak, 0);
  assert.equal(result.bestStreak, 3);
});

test('ignora datas inválidas e aceita linhas já normalizadas como date', () => {
  const result = buildProjectLmConsistency([
    { date: '2026-06-20' },
    { action_date: 'invalid' },
    {},
    null
  ], today);

  assert.equal(result.activeDays, 1);
  assert.equal(result.currentStreak, 1);
  assert.equal(result.bestStreak, 1);
});
