import test from 'node:test';
import assert from 'node:assert/strict';
import { createGetCurrentWeeklyFeedbackUseCase } from '../workers/premium/application/get-current-weekly-feedback.js';
import { createWeeklyFeedbackScheduleService } from '../workers/premium/services/weekly-feedback-schedule-service.js';

function createSubject({ existing = null, identityResult = { ok: true, student: { student_id: 'student-1' } } } = {}) {
  const calls = [];
  const subject = createGetCurrentWeeklyFeedbackUseCase({
    identityService: {
      async resolve() {
        return identityResult;
      },
    },
    weeklyFeedbackRepository: {
      async findByStudentAndWeek(studentId, weekRef) {
        calls.push({ studentId, weekRef });
        assert.equal(studentId, 'student-1');
        return existing;
      },
    },
    scheduleService: createWeeklyFeedbackScheduleService(),
  });
  return { subject, calls };
}

test('GET current usa o student_id canônico resolvido e retorna NOT_AVAILABLE fora da janela', async () => {
  const now = new Date('2026-08-11T13:05:00.000Z'); // terça-feira, 10:05 em São Paulo
  const { subject, calls } = createSubject();

  const result = await subject({ email: 'qa@example.com', now });

  assert.equal(result.ok, true);
  assert.equal(result.data.status, 'NOT_AVAILABLE');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].studentId, 'student-1');
  assert.equal(calls[0].weekRef, result.data.weekRef);
  assert.ok(result.data.availableAt);
  assert.ok(result.data.recommendedDeadline);
});

test('GET current retorna AVAILABLE dentro da janela quando ainda não existe feedback', async () => {
  const now = new Date('2026-08-14T13:00:00.000Z'); // sexta-feira
  const { subject } = createSubject();

  const result = await subject({ email: 'qa@example.com', now });

  assert.equal(result.ok, true);
  assert.equal(result.data.status, 'AVAILABLE');
  assert.equal(result.data.feedback, null);
});

test('identidade bloqueada encerra fail-closed sem consultar feedback semanal', async () => {
  let repositoryCalled = false;
  const subject = createGetCurrentWeeklyFeedbackUseCase({
    identityService: {
      async resolve() {
        return { ok: false, error: 'AMBIGUOUS_STUDENT_IDENTITY' };
      },
    },
    weeklyFeedbackRepository: {
      async findByStudentAndWeek() {
        repositoryCalled = true;
        return null;
      },
    },
    scheduleService: createWeeklyFeedbackScheduleService(),
  });

  const result = await subject({ email: 'ambiguous@example.com', now: new Date('2026-08-11T13:05:00.000Z') });

  assert.equal(result.blocked, true);
  assert.equal(result.reason, 'AMBIGUOUS_STUDENT_IDENTITY');
  assert.equal(repositoryCalled, false);
});
