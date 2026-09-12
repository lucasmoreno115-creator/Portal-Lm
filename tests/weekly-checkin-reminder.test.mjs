import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { isWeeklyCheckinReminderTime, runWeeklyCheckinReminder } from '../workers/services/weekly-checkin-reminder-service.js';

const saturday = Date.parse('2026-08-01T12:00:00.000Z');
const students = [
  { student_id: 'active', email: 'active@example.test', consultation_status: 'ACTIVE', access_status: 'ACTIVE' },
  { student_id: 'answered', email: 'answered@example.test', consultation_status: 'ACTIVE', access_status: 'ACTIVE' },
  { student_id: 'inactive-access', email: 'inactive@example.test', consultation_status: 'ACTIVE', access_status: 'INACTIVE' },
  { student_id: 'paused', email: 'paused@example.test', consultation_status: 'PAUSED', access_status: 'ACTIVE' },
];

function harness(overrides = {}) {
  const notifications = new Map();
  let pushes = 0;
  const defaultCandidates = students.filter((student) => student.student_id === 'active');
  const options = {
    scheduledTime: saturday,
    scheduleService: { getWeekRef: () => '2026-W31' },
    studentRepository: { list: async ({ status }) => students.filter((student) => student.consultation_status === status) },
    feedbackRepository: { listReminderCandidates: async () => defaultCandidates },
    createNotification: async (_env, input) => {
      const key = `${input.student_id}:${input.type}:${input.reference_key}`;
      if (notifications.has(key)) return { notification: notifications.get(key), created: false };
      const notification = { id: `n-${notifications.size}`, ...input };
      notifications.set(key, notification);
      return { notification, created: true };
    },
    deliverPush: async () => { pushes += 1; return { subscriptions: 1, sent: 1, failed: 0, expired: 0, deduplicated: 0 }; },
    ...overrides,
  };
  return { options, notifications, pushes: () => pushes };
}

test('validates Saturday at exactly 09:00 in America/Sao_Paulo', () => {
  assert.equal(isWeeklyCheckinReminderTime(new Date(saturday)), true);
  assert.equal(isWeeklyCheckinReminderTime(new Date('2026-08-01T13:00:00Z')), false);
  assert.equal(isWeeklyCheckinReminderTime(new Date('2026-07-31T12:00:00Z')), false);
});

test('Worker config has only the required cron and preserves fetch alongside scheduled', () => {
  const wrangler = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8');
  const worker = readFileSync(new URL('../workers/api.js', import.meta.url), 'utf8');
  assert.deepEqual([...wrangler.matchAll(/crons\s*=\s*\[([^\]]+)\]/g)].map((match) => match[1].trim()), ['"0 12 * * 6"']);
  assert.match(worker, /async fetch\(request, env\)/);
  assert.match(worker, /async scheduled\(controller, env, ctx\)/);
  assert.match(worker, /ctx\.waitUntil\(runWeeklyCheckinReminder/);
});

test('creates only for active unanswered Premium students using the operational week', async () => {
  const h = harness();
  const result = await runWeeklyCheckinReminder({ DB: {} }, h.options);
  assert.deepEqual({ eligible: result.eligible, created: result.created, answered: result.already_answered }, { eligible: 2, created: 1, answered: 1 });
  assert.equal(h.pushes(), 1);
  assert.equal([...h.notifications.values()][0].reference_key, 'weekly-checkin-reminder:active:2026-W31');
  assert.equal(h.notifications.has('inactive-access'), false);
});

test('cron retry deduplicates notification and does not retry push', async () => {
  const h = harness();
  await runWeeklyCheckinReminder({ DB: {} }, h.options);
  const retry = await runWeeklyCheckinReminder({ DB: {} }, h.options);
  assert.equal(retry.created, 0);
  assert.equal(retry.deduplicated, 1);
  assert.equal(h.pushes(), 1);
});

test('notification survives absent subscription or push failure', async () => {
  const noDevice = harness({ deliverPush: async () => ({ subscriptions: 0, sent: 0, failed: 0, expired: 0, deduplicated: 0 }) });
  assert.equal((await runWeeklyCheckinReminder({ DB: {} }, noDevice.options)).created, 1);
  const failure = harness({ deliverPush: async () => { throw new Error('provider down'); } });
  const result = await runWeeklyCheckinReminder({ DB: {} }, failure.options);
  assert.equal(result.created, 1);
  assert.equal(result.push.failed, 1);
  assert.equal(failure.notifications.size, 1);
});

test('isolates candidate failures and accepts an empty candidate set', async () => {
  const candidateSet = students.filter((student) => ['active', 'answered'].includes(student.student_id));
  const isolated = harness({
    feedbackRepository: { listReminderCandidates: async () => candidateSet },
    createNotification: async (_env, input) => {
      if (input.student_id === 'active') throw new Error('row error');
      return { created: true, notification: { id: 'n-answered', ...input } };
    },
  });
  const isolatedResult = await runWeeklyCheckinReminder({ DB: {} }, isolated.options);
  assert.equal(isolatedResult.failed_students, 1);
  assert.equal(isolatedResult.created, 1);

  const empty = harness({
    studentRepository: { list: async () => [] },
    feedbackRepository: { listReminderCandidates: async () => [] },
  });
  const result = await runWeeklyCheckinReminder({ DB: {} }, empty.options);
  assert.equal(result.eligible, 0);
  assert.equal(result.created, 0);
});
