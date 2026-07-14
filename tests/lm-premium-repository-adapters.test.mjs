import assert from 'node:assert/strict';
import test from 'node:test';
import { createD1AnamnesisRepository } from '../workers/premium/repositories/d1-anamnesis-repository.js';
import { createD1NutritionPlanRepository } from '../workers/premium/repositories/d1-nutrition-plan-repository.js';
import { createD1WeeklyFeedbackRepository } from '../workers/premium/repositories/d1-weekly-feedback-repository.js';
import { createD1PremiumEventRepository } from '../workers/premium/repositories/d1-premium-event-repository.js';

function d1() {
  const calls = [];
  const db = {
    calls,
    prepare(sql) {
      const call = { sql, binds: [] };
      calls.push(call);
      return {
        bind(...values) { call.binds = values; return this; },
        async first() { return null; },
        async all() { return { results: [] }; },
        async run() { return { meta: { changes: 1 } }; },
      };
    },
  };
  return db;
}

test('adapters D1 usam queries parametrizadas e preferem student_id', async () => {
  const db = d1();
  await createD1AnamnesisRepository(db).findLatestByStudentId('student-1');
  await createD1NutritionPlanRepository(db).findCurrentByStudentId('student-1');
  await createD1WeeklyFeedbackRepository(db).listByStudentId('student-1');
  await createD1PremiumEventRepository(db).listByStudentId('student-1');
  assert(db.calls.every((call) => call.sql.includes('?')));
  assert(db.calls.every((call) => call.binds.includes('student-1')));
});

test('adapters preservam fallback por e-mail com lower(?) parametrizado', async () => {
  const db = d1();
  await createD1AnamnesisRepository(db).findLatestByEmail('A@EXAMPLE.COM');
  await createD1NutritionPlanRepository(db).findCurrentByEmail('A@EXAMPLE.COM');
  await createD1WeeklyFeedbackRepository(db).listByEmail('A@EXAMPLE.COM');
  await createD1PremiumEventRepository(db).listByEmail('A@EXAMPLE.COM');
  assert(db.calls.every((call) => /lower\([^)]*\) = lower\(\?\)/.test(call.sql)));
});

test('criações gravam student_id quando disponível e null quando fallback legado é permitido', async () => {
  const db = d1();
  await createD1AnamnesisRepository(db).create({ id: 'a1', student_id: 's1', student_name: 'A', student_email: 'a@example.com', answers_json: '{}', created_at: 'now' });
  await createD1WeeklyFeedbackRepository(db).create({ id: 'c1', student_email: 'b@example.com', week_ref: '2026-W29', created_at: 'now' });
  assert.equal(db.calls[0].binds[1], 's1');
  assert.equal(db.calls[2].binds[1], null);
});

test('adapter Premium de eventos rejeita eventos que não pertencem ao Premium', async () => {
  const db = d1();
  await createD1PremiumEventRepository(db).append({ id: 'e1', student_email: 'a@example.com', event_type: 'FEEDBACK_RECEIVED', title: 'Feedback', created_at: 'now' });
  await assert.rejects(() => createD1PremiumEventRepository(db).append({ id: 'e2', student_email: 'a@example.com', event_type: 'PROJECT_LM_ACTION', title: 'Projeto', created_at: 'now' }), /INVALID_PREMIUM_EVENT/);
});
