import assert from 'node:assert/strict';
import test from 'node:test';
import { createSubmitWeeklyFeedbackUseCase } from '../workers/premium/application/submit-weekly-feedback.js';
import { createSaveNutritionPlanUseCase } from '../workers/premium/application/save-nutrition-plan.js';

function identity(result) { return { async resolve() { return result; } }; }

test('dual-write grava student_id e e-mail legado quando identidade Premium é resolvida', async () => {
  let saved;
  const uc = createSubmitWeeklyFeedbackUseCase({
    identityService: identity({ ok: true, student: { student_id: 's1' } }),
    weeklyFeedbackRepository: { async create(record) { saved = record; return record; } },
    eventRepository: { async append() {} },
    randomUUID: () => 'event-1',
  });
  await uc.execute({ feedback: { id: 'c1', student_email: 'a@example.com', week_ref: '2026-W29', created_at: 'now' } });
  assert.equal(saved.student_id, 's1');
  assert.equal(saved.student_email, 'a@example.com');
});

test('dual-write preserva fluxo legado sem student_id quando identidade está ausente', async () => {
  let plan;
  const uc = createSaveNutritionPlanUseCase({
    identityService: identity({ ok: false, error: 'STUDENT_NOT_FOUND' }),
    nutritionPlanRepository: { async saveCurrent(record) { plan = record; return record; } },
    eventRepository: { async append() {} },
    randomUUID: () => 'event-1',
  });
  await uc.execute({ plan: { id: 'p1', student_email: 'legacy@example.com', meals_json: '[]', created_at: 'now', updated_at: 'now' } });
  assert.equal(plan.student_id, null);
  assert.equal(plan.student_email, 'legacy@example.com');
});
