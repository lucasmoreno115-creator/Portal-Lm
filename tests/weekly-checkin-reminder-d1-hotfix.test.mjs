import test from 'node:test';
import assert from 'node:assert/strict';

import { runWeeklyCheckinReminder } from '../workers/services/weekly-checkin-reminder-service.js';

test('weekly reminder selects candidates set-based without per-student check-in reads', async () => {
  const calls = { listStudents: 0, listCandidates: 0, notifications: 0, push: 0 };
  const studentRepository = {
    async list({ status, limit }) {
      calls.listStudents += 1;
      assert.equal(status, 'ACTIVE');
      assert.equal(limit, 10_000);
      return [
        { student_id: 's1', email: 'one@example.com', access_status: 'ACTIVE' },
        { student_id: 's2', email: 'two@example.com', access_status: 'ACTIVE' },
        { student_id: 's3', email: 'three@example.com', access_status: 'INACTIVE' },
      ];
    },
  };
  const feedbackRepository = {
    async listReminderCandidates({ weekRef, limit }) {
      calls.listCandidates += 1;
      assert.equal(weekRef, '2026-W37');
      assert.equal(limit, 10_000);
      return [{ student_id: 's2', email: 'two@example.com', access_status: 'ACTIVE' }];
    },
    async findByStudentAndWeek() {
      assert.fail('N+1 findByStudentAndWeek must not run from the scheduled reminder');
    },
  };

  const result = await runWeeklyCheckinReminder({ DB: {} }, {
    scheduledTime: Date.parse('2026-09-12T12:00:00.000Z'),
    scheduleService: { getWeekRef: () => '2026-W37' },
    studentRepository,
    feedbackRepository,
    createNotification: async (_env, input) => {
      calls.notifications += 1;
      assert.equal(input.student_id, 's2');
      return { created: true, notification: { id: 'n1', student_id: 's2' } };
    },
    deliverPush: async () => {
      calls.push += 1;
      return { subscriptions: 0, sent: 0, failed: 0, expired: 0, deduplicated: 0 };
    },
  });

  assert.equal(calls.listStudents, 1);
  assert.equal(calls.listCandidates, 1);
  assert.equal(calls.notifications, 1);
  assert.equal(calls.push, 1);
  assert.equal(result.eligible, 2);
  assert.equal(result.already_answered, 1);
  assert.equal(result.created, 1);
  assert.equal(result.failed_students, 0);
});

test('weekly reminder does no repository work outside Saturday 09:00 Sao Paulo', async () => {
  const result = await runWeeklyCheckinReminder({ DB: {} }, {
    scheduledTime: Date.parse('2026-09-12T13:00:00.000Z'),
    studentRepository: { list: async () => assert.fail('student repository should not run') },
    feedbackRepository: { listReminderCandidates: async () => assert.fail('feedback repository should not run') },
  });

  assert.equal(result.skipped, true);
  assert.equal(result.eligible, 0);
});
