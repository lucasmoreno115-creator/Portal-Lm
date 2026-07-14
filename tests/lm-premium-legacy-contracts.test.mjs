import assert from 'node:assert/strict';
import test from 'node:test';
import { createSubmitWeeklyFeedbackUseCase } from '../workers/premium/application/submit-weekly-feedback.js';

test('payload público de envio de check-in permanece sem student_id ou metadados internos', async () => {
  const publicResponse = { ok: true, data: { id: 'c1', weekRef: '2026-W29', createdAt: 'now' } };
  assert.deepEqual(Object.keys(publicResponse.data), ['id', 'weekRef', 'createdAt']);
  assert.equal('student_id' in publicResponse.data, false);
  assert.equal('identity_method' in publicResponse.data, false);
  assert.equal('fallback' in publicResponse.data, false);
});

test('casos de uso recebem dependências por injeção e não expõem student_id automaticamente', async () => {
  const uc = createSubmitWeeklyFeedbackUseCase({
    identityService: { async resolve() { return { ok: true, student: { student_id: 'internal' } }; } },
    weeklyFeedbackRepository: { async create(record) { return record; } },
    eventRepository: { async append() {} },
    randomUUID: () => 'event-1',
  });
  const result = await uc.execute({ feedback: { id: 'c1', student_email: 'a@example.com', week_ref: '2026-W29', created_at: 'now' } });
  assert.equal(result.saved.student_id, 'internal');
  const publicResponse = { ok: true, data: { id: result.saved.id, weekRef: result.saved.week_ref, createdAt: result.saved.created_at } };
  assert.equal('student_id' in publicResponse.data, false);
});
