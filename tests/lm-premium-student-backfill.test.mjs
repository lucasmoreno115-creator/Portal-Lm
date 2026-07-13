import assert from 'node:assert/strict';
import test from 'node:test';
import { runPremiumStudentIdentityBackfill } from '../scripts/premium-student-identity-backfill.mjs';

function memoryRepository(candidates) {
  const students = [];
  return { students,
    async listBackfillCandidates() { return candidates; },
    async findByNormalizedEmail(email) { return students.filter((s) => s.normalized_email === email); },
    async create(student) { students.push({ ...student }); return students.at(-1); },
  };
}

test('backfill cria identidade Premium elegível, associa registros e é idempotente', async () => {
  const repository = memoryRepository([{ id: 'access-1', name: 'Aluna', email: ' Aluna@Example.com ', status: 'ACTIVE', plan: 'premium' }]);
  const tables = { nutrition_plans: [{ id: 'plan-1', student_email: 'aluna@example.com' }] };
  const first = await runPremiumStudentIdentityBackfill({ repository, tables, randomUUID: () => 'uuid-1', now: () => '2026-07-13T00:00:00.000Z' });
  const second = await runPremiumStudentIdentityBackfill({ repository, tables, randomUUID: () => 'uuid-2', now: () => '2026-07-13T00:00:00.000Z' });
  assert.equal(first.candidates, 1);
  assert.equal(first.created, 1);
  assert.equal(first.associated, 1);
  assert.equal(second.created, 0);
  assert.equal(repository.students.length, 1);
  assert.equal(tables.nutrition_plans[0].student_id, 'uuid-1');
  assert.equal(first.conflicts.length, 0);
});

test('backfill não cria identidade para Projeto LM e registra conflito sem apagar dados', async () => {
  const candidate = { id: 'access-project', email: 'p@example.com', plan: 'projeto_lm' };
  const repository = memoryRepository([candidate]);
  const tables = { student_checkins: [{ id: 'checkin-1', student_email: 'p@example.com' }] };
  const result = await runPremiumStudentIdentityBackfill({ repository, tables, randomUUID: () => 'uuid-project' });
  assert.equal(repository.students.length, 0);
  assert.equal(tables.student_checkins.length, 1);
  assert(result.conflicts.some((c) => c.type === 'NON_PREMIUM_ACCESS'));
  assert(result.conflicts.some((c) => c.type === 'PREMIUM_DATA_WITHOUT_ACCESS'));
});

test('backfill registra e-mails vazios e múltiplos acessos normalizados', async () => {
  const repository = memoryRepository([
    { id: 'empty', email: '   ', plan: 'premium' },
    { id: 'a', email: 'dup@example.com', plan: 'premium' },
    { id: 'b', email: ' DUP@example.com ', plan: 'premium' },
  ]);
  const result = await runPremiumStudentIdentityBackfill({ repository });
  assert.equal(repository.students.length, 0);
  assert(result.conflicts.some((c) => c.type === 'EMPTY_EMAIL'));
  assert(result.conflicts.some((c) => c.type === 'MULTIPLE_ACCESS_RECORDS'));
});
