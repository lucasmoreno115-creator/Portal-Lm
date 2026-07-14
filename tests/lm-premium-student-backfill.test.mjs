import assert from 'node:assert/strict';
import test from 'node:test';
import { BACKFILL_MODE, evaluatePremiumEligibility, runPremiumStudentIdentityBackfill } from '../scripts/premium-student-identity-backfill.mjs';

function memoryRepository(candidates, initialStudents = []) {
  const students = initialStudents.map((student) => ({ ...student }));
  const associatedCalls = [];
  return { students, associatedCalls,
    async listBackfillCandidates() { return candidates; },
    async findByNormalizedEmail(email) { return students.filter((s) => s.normalized_email === email); },
    async create(student) { students.push({ ...student }); return students.at(-1); },
    async batchAssociateStudentIds(updates) {
      const changes = [];
      for (const update of updates) {
        associatedCalls.push({ ...update });
        changes.push(1);
      }
      return changes;
    },
  };
}

test('elegibilidade exige classificação explícita e aceita Premium em plan ou plan_type', () => {
  assert.equal(evaluatePremiumEligibility({}).conflictType, 'MISSING_PRODUCT_CLASSIFICATION');
  assert.equal(evaluatePremiumEligibility({ plan_type: 'PREMIUM' }).eligible, true);
  assert.equal(evaluatePremiumEligibility({ plan: 'premium' }).eligible, true);
});

test('elegibilidade bloqueia conflito, Projeto LM em qualquer coluna e valor desconhecido', () => {
  assert.equal(evaluatePremiumEligibility({ plan: 'premium', plan_type: 'projeto_lm' }).conflictType, 'CONFLICTING_PRODUCT_CLASSIFICATION');
  assert.equal(evaluatePremiumEligibility({ plan: 'projeto_lm' }).conflictType, 'NON_PREMIUM_ACCESS');
  assert.equal(evaluatePremiumEligibility({ plan_type: 'project_lm' }).conflictType, 'NON_PREMIUM_ACCESS');
  assert.equal(evaluatePremiumEligibility({ plan: 'vip' }).conflictType, 'UNKNOWN_PRODUCT_CLASSIFICATION');
});

test('dry-run é padrão e não persiste criação nem associação', async () => {
  const repository = memoryRepository([{ id: 'access-1', name: 'Aluna', email: ' Aluna@Example.com ', status: 'ACTIVE', plan: 'premium' }]);
  const tables = { nutrition_plans: [{ id: 'plan-1', student_email: 'aluna@example.com' }] };
  const result = await runPremiumStudentIdentityBackfill({ repository, tables, randomUUID: () => 'uuid-1', now: () => '2026-07-13T00:00:00.000Z' });
  assert.equal(result.mode, BACKFILL_MODE.DRY_RUN);
  assert.equal(result.created, 0);
  assert.equal(result.associated, 0);
  assert.equal(result.planned_created, 1);
  assert.equal(result.planned_associated, 1);
  assert.equal(repository.students.length, 0);
  assert.equal(repository.associatedCalls.length, 0);
  assert.equal(tables.nutrition_plans[0].student_id, undefined);
});

test('apply persiste associações e segunda execução não duplica nem sobrescreve student_id válido', async () => {
  const repository = memoryRepository([{ id: 'access-1', name: 'Aluna', email: ' Aluna@Example.com ', status: 'ACTIVE', plan_type: 'PREMIUM' }]);
  const tables = {
    student_access: [{ id: 'access-1', email: 'aluna@example.com' }],
    nutrition_plans: [{ id: 'plan-1', student_email: 'aluna@example.com' }],
    student_checkins: [{ id: 'checkin-1', student_email: 'aluna@example.com', student_id: 'existing-id' }],
  };
  const first = await runPremiumStudentIdentityBackfill({ repository, tables, mode: BACKFILL_MODE.APPLY, randomUUID: () => 'uuid-1', now: () => '2026-07-13T00:00:00.000Z' });
  tables.student_access[0].student_id = 'uuid-1';
  tables.nutrition_plans[0].student_id = 'uuid-1';
  const second = await runPremiumStudentIdentityBackfill({ repository, tables, mode: BACKFILL_MODE.APPLY, randomUUID: () => 'uuid-2', now: () => '2026-07-13T00:00:00.000Z' });

  assert.equal(first.candidates, 1);
  assert.equal(first.created, 1);
  assert.equal(first.associated, 2);
  assert.equal(first.skipped, 1);
  assert.equal(second.created, 0);
  assert.equal(second.associated, 0);
  assert.equal(repository.students.length, 1);
  assert.equal(repository.students[0].student_id, 'uuid-1');
  assert.equal(tables.student_checkins[0].student_id, 'existing-id');
  assert.deepEqual(repository.associatedCalls.map((call) => call.id), ['access-1', 'plan-1']);
});

test('backfill registra classificação ausente, conflituosa, Projeto LM e desconhecida sem criar identidades', async () => {
  const repository = memoryRepository([
    { id: 'missing', email: 'missing@example.com' },
    { id: 'conflict', email: 'conflict@example.com', plan: 'premium', plan_type: 'project_lm' },
    { id: 'project-plan', email: 'project-plan@example.com', plan: 'projeto_lm' },
    { id: 'project-type', email: 'project-type@example.com', plan_type: 'lm2' },
    { id: 'unknown', email: 'unknown@example.com', plan: 'vip' },
  ]);
  const result = await runPremiumStudentIdentityBackfill({ repository, mode: BACKFILL_MODE.APPLY, randomUUID: () => 'uuid-never' });
  assert.equal(repository.students.length, 0);
  assert(result.conflicts.some((c) => c.type === 'MISSING_PRODUCT_CLASSIFICATION'));
  assert(result.conflicts.some((c) => c.type === 'CONFLICTING_PRODUCT_CLASSIFICATION'));
  assert.equal(result.conflicts.filter((c) => c.type === 'NON_PREMIUM_ACCESS').length, 2);
  assert(result.conflicts.some((c) => c.type === 'UNKNOWN_PRODUCT_CLASSIFICATION'));
});

test('backfill registra e-mails vazios e múltiplos acessos normalizados', async () => {
  const repository = memoryRepository([
    { id: 'empty', email: '   ', plan: 'premium' },
    { id: 'a', email: 'dup@example.com', plan: 'premium' },
    { id: 'b', email: ' DUP@example.com ', plan: 'premium' },
  ]);
  const result = await runPremiumStudentIdentityBackfill({ repository, mode: BACKFILL_MODE.APPLY });
  assert.equal(repository.students.length, 0);
  assert(result.conflicts.some((c) => c.type === 'EMPTY_EMAIL'));
  assert(result.conflicts.some((c) => c.type === 'MULTIPLE_ACCESS_RECORDS'));
});

function createFakeD1(initial) {
  const state = structuredClone(initial);
  const execute = (sql, params = []) => {
    if (sql.startsWith('SELECT id, name, email, status, plan, plan_type, student_id, created_at FROM student_access')) {
      return { results: state.student_access.map((row) => ({ ...row })) };
    }
    if (sql.startsWith('SELECT * FROM premium_students WHERE normalized_email')) {
      return { results: state.premium_students.filter((row) => row.normalized_email === params[0]).map((row) => ({ ...row })) };
    }
    if (sql.startsWith('SELECT * FROM premium_students WHERE student_id')) {
      return state.premium_students.find((row) => row.student_id === params[0]) ?? null;
    }
    if (sql.startsWith('INSERT INTO premium_students')) {
      state.premium_students.push({ student_id: params[0], email: params[1], normalized_email: params[2], display_name: params[3], consultation_status: params[4], access_status: params[5], source: params[6], created_at: params[7], updated_at: params[8] });
      return { meta: { changes: 1 } };
    }
    const selectMatch = sql.match(/^SELECT id, (email|student_email), student_id FROM (\w+)/);
    if (selectMatch) return { results: (state[selectMatch[2]] ?? []).map((row) => ({ ...row })) };
    const updateMatch = sql.match(/^UPDATE (\w+) SET student_id = \? WHERE id = \? AND student_id IS NULL$/);
    if (updateMatch) {
      const row = (state[updateMatch[1]] ?? []).find((item) => item.id === params[1]);
      if (row && !row.student_id) { row.student_id = params[0]; return { meta: { changes: 1 } }; }
      return { meta: { changes: 0 } };
    }
    throw new Error(`Unsupported SQL in fake D1: ${sql}`);
  };
  return { state,
    prepare(sql) {
      return { bind(...params) { return { all: async () => execute(sql, params), first: async () => execute(sql, params), run: async () => execute(sql, params) }; }, all: async () => execute(sql), run: async () => execute(sql) };
    },
    async batch(statements) { return Promise.all(statements.map((statement) => statement.run())); },
  };
}

test('D1 adapter em apply persiste student_id com queries parametrizadas e sem coalesce silencioso', async () => {
  const { createD1PremiumStudentRepository } = await import('../workers/premium/repositories/d1-premium-student-repository.js');
  const db = createFakeD1({
    premium_students: [],
    student_access: [{ id: 'access-1', name: 'Aluna', email: 'aluna@example.com', status: 'ACTIVE', plan: 'premium', plan_type: null, created_at: '2026-07-13' }],
    premium_anamnesis: [], nutrition_plans: [{ id: 'plan-1', student_email: 'aluna@example.com' }], student_checkins: [], activity_timeline: [], weekly_plans: [], progression_logs: [], followup_logs: [], retention_actions: [],
  });
  const repository = createD1PremiumStudentRepository(db);
  const result = await runPremiumStudentIdentityBackfill({ repository, mode: BACKFILL_MODE.APPLY, randomUUID: () => 'uuid-d1', now: () => '2026-07-13T00:00:00.000Z' });
  assert.equal(result.created, 1);
  assert.equal(result.associated, 2);
  assert.equal(db.state.premium_students.length, 1);
  assert.equal(db.state.student_access[0].student_id, 'uuid-d1');
  assert.equal(db.state.nutrition_plans[0].student_id, 'uuid-d1');
});
