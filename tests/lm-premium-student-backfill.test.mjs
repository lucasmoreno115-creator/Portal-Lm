import assert from 'node:assert/strict';
import test from 'node:test';
import { BACKFILL_MODE, evaluatePremiumEligibility, rollbackPremiumStudentIdentityBackfill, runPremiumStudentIdentityBackfill, stableEmailHash } from '../scripts/premium-student-identity-backfill.mjs';

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

test('elegibilidade prioriza identificadores explícitos do Projeto LM sobre plan_type genérico', () => {
  assert.equal(evaluatePremiumEligibility({ plan: 'premium', plan_type: 'projeto_lm' }).conflictType, 'CONFLICTING_PRODUCT_CLASSIFICATION');
  const projetoLm = evaluatePremiumEligibility({ plan: 'projeto_lm', plan_type: 'START' });
  assert.equal(projetoLm.conflictType, 'NON_PREMIUM_ACCESS');
  assert.equal(projetoLm.reason, 'Acesso exclusivo do Projeto LM.');
  assert.equal(evaluatePremiumEligibility({ plan: 'project_lm' }).conflictType, 'NON_PREMIUM_ACCESS');
  assert.equal(evaluatePremiumEligibility({ plan: 'lm2' }).conflictType, 'NON_PREMIUM_ACCESS');
  assert.equal(evaluatePremiumEligibility({ plan: ' PROJETO_LM ' }).conflictType, 'NON_PREMIUM_ACCESS');
  assert.equal(evaluatePremiumEligibility({ plan_type: 'project_lm' }).conflictType, 'NON_PREMIUM_ACCESS');
  assert.equal(evaluatePremiumEligibility({ plan_type: 'START' }).conflictType, 'UNKNOWN_PRODUCT_CLASSIFICATION');
  assert.equal(evaluatePremiumEligibility({ plan: 'premium', plan_type: 'START' }).eligible, true);
  assert.equal(evaluatePremiumEligibility({ plan: 'vip' }).conflictType, 'UNKNOWN_PRODUCT_CLASSIFICATION');
});

test('dry-run classifica Projeto LM sem ambiguidade e preserva o resumo agregado esperado', async () => {
  const candidates = [
    ...Array.from({ length: 16 }, (_, index) => ({ id: `eligible-${index}`, email: `eligible-${index}@example.com`, status: 'ACTIVE', plan: 'premium' })),
    { id: 'migrated-1', email: 'migrated-1@example.com', status: 'ACTIVE', plan: 'premium' },
    { id: 'migrated-2', email: 'migrated-2@example.com', status: 'ACTIVE', plan_type: 'PREMIUM' },
    { id: 'project-start', email: 'project-start@example.com', status: 'ACTIVE', plan: 'projeto_lm', plan_type: 'START' },
    { id: 'project-lm2', email: 'project-lm2@example.com', status: 'ACTIVE', plan: 'lm2' },
  ];
  const repository = memoryRepository(candidates, [
    { student_id: 'migrated-1', email: 'migrated-1@example.com', normalized_email: 'migrated-1@example.com' },
    { student_id: 'migrated-2', email: 'migrated-2@example.com', normalized_email: 'migrated-2@example.com' },
  ]);
  const result = await runPremiumStudentIdentityBackfill({ repository, randomUUID: () => 'uuid-dry-run' });
  assert.deepEqual(result.classifications, { already_migrated: 2, eligible: 16, ambiguous: 0, invalid_email: 0, project_only: 2, inactive: 0, conflicting_student_id: 0, error: 0 });
  assert.equal(repository.students.length, 2);
  assert.equal(repository.associatedCalls.length, 0);
  assert.equal(result.conflicts.filter((conflict) => conflict.type === 'NON_PREMIUM_ACCESS').length, 2);
  assert.equal(result.conflicts.some((conflict) => conflict.type === 'UNKNOWN_PRODUCT_CLASSIFICATION'), false);
  assert.equal(result.restricted_blockers.some((blocker) => blocker.type === 'NON_PREMIUM_ACCESS' && blocker.plan === 'projeto_lm' && blocker.plan_type === 'START'), true);
});

test('dry-run é padrão e não persiste criação nem associação', async () => {
  const repository = memoryRepository([{ id: 'access-1', name: 'Aluna', email: ' Aluna@Example.com ', status: 'ACTIVE', plan: 'premium' }]);
  const tables = { nutrition_plans: [{ id: 'plan-1', student_email: 'aluna@example.com' }] };
  const result = await runPremiumStudentIdentityBackfill({ repository, tables, randomUUID: () => 'uuid-1', now: () => '2026-07-13T00:00:00.000Z' });
  assert.equal(result.mode, BACKFILL_MODE.DRY_RUN);
  assert.equal(result.created, 0);
  assert.equal(result.associated, 0);
  assert.equal(result.planned_created, 1);
  assert.equal(result.planned_associated, 0);
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
  const first = await runPremiumStudentIdentityBackfill({ repository, tables, mode: BACKFILL_MODE.APPLY, batchId: 'batch-test', randomUUID: () => 'uuid-1', now: () => '2026-07-13T00:00:00.000Z' });
  tables.student_access[0].student_id = 'uuid-1';
  tables.nutrition_plans[0].student_id = 'uuid-1';
  const second = await runPremiumStudentIdentityBackfill({ repository, tables, mode: BACKFILL_MODE.APPLY, batchId: 'batch-test', randomUUID: () => 'uuid-2', now: () => '2026-07-13T00:00:00.000Z' });

  assert.equal(first.candidates, 1);
  assert.equal(first.created, 1);
  assert.equal(first.associated, 1);
  assert.equal(first.skipped, 0);
  assert.equal(second.created, 0);
  assert.equal(second.associated, 0);
  assert.equal(repository.students.length, 1);
  assert.equal(repository.students[0].student_id, 'uuid-1');
  assert.equal(tables.student_checkins[0].student_id, 'existing-id');
  assert.deepEqual(repository.associatedCalls.map((call) => call.id), ['access-1']);
});

test('backfill registra classificação ausente, conflituosa, Projeto LM e desconhecida sem criar identidades', async () => {
  const repository = memoryRepository([
    { id: 'missing', email: 'missing@example.com' },
    { id: 'conflict', email: 'conflict@example.com', plan: 'premium', plan_type: 'project_lm' },
    { id: 'project-plan', email: 'project-plan@example.com', plan: 'projeto_lm' },
    { id: 'project-type', email: 'project-type@example.com', plan_type: 'lm2' },
    { id: 'unknown', email: 'unknown@example.com', plan: 'vip' },
  ]);
  const result = await runPremiumStudentIdentityBackfill({ repository, mode: BACKFILL_MODE.APPLY, batchId: 'batch-test', randomUUID: () => 'uuid-never' });
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
  const result = await runPremiumStudentIdentityBackfill({ repository, mode: BACKFILL_MODE.APPLY, batchId: 'batch-test' });
  assert.equal(repository.students.length, 0);
  assert(result.conflicts.some((c) => c.type === 'INVALID_EMAIL'));
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
    if (sql.startsWith('INSERT OR IGNORE INTO premium_legacy_identity_backfill_audit')) return { meta: { changes: 1 } };
    const selectMatch = sql.match(/^SELECT id, (email|student_email), student_id FROM (\w+)/);
    if (selectMatch) return { results: (state[selectMatch[2]] ?? []).map((row) => ({ ...row })) };
    const updateMatch = sql.match(/^UPDATE (\w+) SET student_id = \? WHERE id = \? AND \(student_id IS NULL OR lower\(trim\(student_id\)\)=lower\(trim\(email\)\)\)$/);
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
  const result = await runPremiumStudentIdentityBackfill({ repository, mode: BACKFILL_MODE.APPLY, batchId: 'batch-test', randomUUID: () => 'uuid-d1', now: () => '2026-07-13T00:00:00.000Z' });
  assert.equal(result.created, 1);
  assert.equal(result.associated, 1);
  assert.equal(db.state.premium_students.length, 1);
  assert.equal(db.state.student_access[0].student_id, 'uuid-d1');
  assert.equal(db.state.nutrition_plans[0].student_id, undefined);
});

test('Premium e Projeto LM com mesmo e-mail bloqueiam o e-mail e não compartilham student_id', async () => {
  const repository = memoryRepository([
    { id: 'premium-access', name: 'Aluna', email: 'same@example.com', status: 'ACTIVE', plan: 'premium' },
    { id: 'project-access', name: 'Aluna Projeto', email: ' SAME@example.com ', status: 'ACTIVE', plan: 'projeto_lm' },
  ]);
  const tables = {
    student_access: [
      { id: 'premium-access', email: 'same@example.com' },
      { id: 'project-access', email: 'same@example.com' },
    ],
  };
  const dryRun = await runPremiumStudentIdentityBackfill({ repository, tables, randomUUID: () => 'uuid-shared' });
  assert.equal(dryRun.created, 0);
  assert.equal(dryRun.associated, 0);
  assert.equal(repository.students.length, 0);
  assert.equal(tables.student_access[0].student_id, undefined);
  assert.equal(tables.student_access[1].student_id, undefined);
  assert(dryRun.conflicts.some((conflict) => conflict.type === 'MIXED_PRODUCT_ACCESS_FOR_EMAIL'));

  const apply = await runPremiumStudentIdentityBackfill({ repository, tables, mode: BACKFILL_MODE.APPLY, batchId: 'batch-test', randomUUID: () => 'uuid-shared' });
  assert.equal(apply.created, 0);
  assert.equal(apply.associated, 0);
  assert.equal(repository.students.length, 0);
  assert.equal(tables.student_access[0].student_id, undefined);
  assert.equal(tables.student_access[1].student_id, undefined);
  assert.equal(repository.associatedCalls.length, 0);
});

test('student_access usa apenas o id exato do candidato Premium elegível', async () => {
  const repository = memoryRepository([{ id: 'premium-access', name: 'Aluna', email: 'aluna@example.com', status: 'ACTIVE', plan: 'premium' }]);
  const tables = {
    student_access: [
      { id: 'premium-access', email: 'aluna@example.com' },
      { id: 'other-access-same-email', email: 'aluna@example.com' },
    ],
  };
  const result = await runPremiumStudentIdentityBackfill({ repository, tables, mode: BACKFILL_MODE.APPLY, batchId: 'batch-test', randomUUID: () => 'uuid-exact' });
  assert.equal(result.created, 1);
  assert.equal(result.associated, 1);
  assert.deepEqual(repository.associatedCalls.map((call) => call.id), ['premium-access']);
});

test('student_id existente correto conta como associação existente e execução continua idempotente', async () => {
  const repository = memoryRepository(
    [{ id: 'premium-access', name: 'Aluna', email: 'aluna@example.com', status: 'ACTIVE', plan: 'premium' }],
    [{ student_id: 'uuid-ok', email: 'aluna@example.com', normalized_email: 'aluna@example.com' }]
  );
  const tables = { student_access: [{ id: 'premium-access', email: 'aluna@example.com', student_id: 'uuid-ok' }] };
  const first = await runPremiumStudentIdentityBackfill({ repository, tables, mode: BACKFILL_MODE.APPLY, batchId: 'batch-test', randomUUID: () => 'uuid-new' });
  const second = await runPremiumStudentIdentityBackfill({ repository, tables, mode: BACKFILL_MODE.APPLY, batchId: 'batch-test', randomUUID: () => 'uuid-newer' });
  assert.equal(first.created, 0);
  assert.equal(first.associated, 0);
  assert.equal(first.existing_associations, 1);
  assert.equal(second.created, 0);
  assert.equal(second.associated, 0);
  assert.equal(second.existing_associations, 1);
  assert.equal(repository.students.length, 1);
  assert.equal(tables.student_access[0].student_id, 'uuid-ok');
});

test('student_id existente diferente gera conflito e nunca sobrescreve', async () => {
  const repository = memoryRepository(
    [{ id: 'premium-access', name: 'Aluna', email: 'aluna@example.com', status: 'ACTIVE', plan: 'premium' }],
    [{ student_id: 'uuid-resolved', email: 'aluna@example.com', normalized_email: 'aluna@example.com' }]
  );
  const tables = { student_access: [{ id: 'premium-access', email: 'aluna@example.com', student_id: 'other-id' }] };
  const result = await runPremiumStudentIdentityBackfill({ repository, tables, mode: BACKFILL_MODE.APPLY, batchId: 'batch-test', randomUUID: () => 'uuid-unused' });
  assert.equal(result.created, 0);
  assert.equal(result.associated, 0);
  assert.equal(tables.student_access[0].student_id, 'other-id');
  assert(result.conflicts.some((conflict) => conflict.type === 'IDENTITY_ASSOCIATION_MISMATCH'));
});

test('rollback é delimitado ao lote e preserva linhas modificadas posteriormente', async () => {
  const calls = [];
  const repository = { async rollbackBackfillBatch(batchId, timestamp) { calls.push({ batchId, timestamp }); return { restored: 1, deleted: 1, audited: 2 }; } };
  assert.deepEqual(await rollbackPremiumStudentIdentityBackfill({ repository, batchId: 'batch-1', now: () => '2026-07-20T00:00:00.000Z' }), { restored: 1, deleted: 1, audited: 2 });
  assert.deepEqual(calls, [{ batchId: 'batch-1', timestamp: '2026-07-20T00:00:00.000Z' }]);
  await assert.rejects(() => rollbackPremiumStudentIdentityBackfill({ repository }), /BACKFILL_BATCH_ID_REQUIRED/);
});

test('dry-run restricted blockers are allowlisted and never expose direct identifiers', async () => {
  const email = 'private.student@example.com';
  const name = 'Nome Privado';
  const token = 'access-token-private';
  const result = await runPremiumStudentIdentityBackfill({
    repository: memoryRepository([
      { id: 'access-premium', name, email, access_token: token, status: 'ACTIVE', plan: 'premium' },
      { id: 'access-project', name, email, access_token: token, status: 'ACTIVE', plan_type: 'projeto_lm' },
    ]),
  });
  const permittedKeys = new Set(['type', 'table', 'opaque_record_ids', 'student_access_ids', 'stable_email_hash', 'plan', 'plan_type', 'access_count', 'premium_identity_count', 'recommended_action']);
  assert(result.restricted_blockers.some((blocker) => blocker.type === 'MIXED_PRODUCT_ACCESS_FOR_EMAIL'));
  for (const blocker of result.restricted_blockers) assert.deepEqual(Object.keys(blocker).sort(), [...permittedKeys].sort());
  const serialized = JSON.stringify({ restricted_blockers: result.restricted_blockers });
  assert(!serialized.includes(email));
  assert(!serialized.includes(name));
  assert(!serialized.includes(token));
  assert.match(result.restricted_blockers.find((blocker) => blocker.stable_email_hash)?.stable_email_hash ?? '', /^[a-f0-9]{64}$/);
  assert.equal(stableEmailHash(email), stableEmailHash(email));
  assert.notEqual(stableEmailHash(email), stableEmailHash('other@example.com'));
  assert.notEqual(stableEmailHash(email), email);
});
