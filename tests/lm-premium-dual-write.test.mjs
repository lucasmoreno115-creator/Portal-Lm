import assert from 'node:assert/strict';
import test from 'node:test';
import { createSubmitWeeklyFeedbackUseCase } from '../workers/premium/application/submit-weekly-feedback.js';
import { createSaveNutritionPlanUseCase } from '../workers/premium/application/save-nutrition-plan.js';
import { dualReadByIdentity } from '../workers/premium/application/dual-write-helpers.js';
import { STUDENT_IDENTITY_ERRORS } from '../workers/premium/services/student-identity-service.js';

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

test('dual-write preserva fluxo legado sem student_id quando identidade está ausente e fallback é permitido', async () => {
  let plan;
  const uc = createSaveNutritionPlanUseCase({
    identityService: identity({ ok: false, error: STUDENT_IDENTITY_ERRORS.STUDENT_NOT_FOUND }),
    nutritionPlanRepository: { async saveCurrent(record) { plan = record; return record; } },
    eventRepository: { async append() {} },
    randomUUID: () => 'event-1',
  });
  const result = await uc.execute({ plan: { id: 'p1', student_email: 'legacy@example.com', meals_json: '[]', created_at: 'now', updated_at: 'now' } });
  assert.equal(result.blocked, undefined);
  assert.equal(plan.student_id, null);
  assert.equal(plan.allowLegacyFallback, true);
  assert.equal(plan.student_email, 'legacy@example.com');
});

test('dual-read não consulta fallback por e-mail para identidade ambígua ou não Premium', async () => {
  for (const error of [STUDENT_IDENTITY_ERRORS.AMBIGUOUS_STUDENT_IDENTITY, STUDENT_IDENTITY_ERRORS.NON_PREMIUM_STUDENT]) {
    let fallbackCalled = false;
    const result = await dualReadByIdentity({
      identityService: identity({ ok: false, error }),
      repository: {
        async findCurrentByStudentId() { throw new Error('ID_NOT_EXPECTED'); },
        async findCurrentByEmail() { fallbackCalled = true; return {}; },
      },
      email: 'dup@example.com',
      byStudentId: 'findCurrentByStudentId',
      byEmail: 'findCurrentByEmail',
      allowLegacyFallback: true,
    });
    assert.equal(result.blocked, true);
    assert.equal(result.reason, error);
    assert.equal(fallbackCalled, false);
  }
});

test('EMAIL_REQUIRED e erro técnico falham de forma segura sem fallback silencioso', async () => {
  for (const resolver of [identity({ ok: false, error: STUDENT_IDENTITY_ERRORS.EMAIL_REQUIRED }), { async resolve() { throw new Error('boom'); } }]) {
    let fallbackCalled = false;
    const result = await dualReadByIdentity({
      identityService: resolver,
      repository: { async byId() { return null; }, async byEmail() { fallbackCalled = true; return {}; } },
      email: '',
      byStudentId: 'byId',
      byEmail: 'byEmail',
      allowLegacyFallback: true,
    });
    assert.equal(result.blocked, true);
    assert.equal(fallbackCalled, false);
  }
});

test('writes Premium são bloqueadas para identidade ambígua ou não Premium', async () => {
  for (const error of [STUDENT_IDENTITY_ERRORS.AMBIGUOUS_STUDENT_IDENTITY, STUDENT_IDENTITY_ERRORS.NON_PREMIUM_STUDENT]) {
    let wrote = false;
    const uc = createSubmitWeeklyFeedbackUseCase({
      identityService: identity({ ok: false, error }),
      weeklyFeedbackRepository: { async create() { wrote = true; } },
      eventRepository: { async append() {} },
      randomUUID: () => 'event-1',
    });
    const result = await uc.execute({ feedback: { id: 'c1', student_email: 'dup@example.com', week_ref: '2026-W29', created_at: 'now' } });
    assert.equal(result.blocked, true);
    assert.equal(result.reason, error);
    assert.equal(wrote, false);
  }
});
