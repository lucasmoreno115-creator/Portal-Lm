import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import worker, { initializeSchemaForTests } from '../workers/api.js';
import { SqliteD1 } from './helpers/sqlite-d1.mjs';

const NOW = '2026-08-14T13:00:00.000Z';
const ADMIN_ENV = { ADMIN_TOKEN: 'admin-token', PREMIUM_PROFESSIONAL_WORKSPACE_ENABLED: 'true' };

async function withDatabase(run) {
  const directory = await mkdtemp(join(tmpdir(), 'workspace-operational-e2e-'));
  const db = new SqliteD1(join(directory, 'test.db'));
  try { await initializeSchemaForTests(db); await run(db); }
  finally { db.close(); await rm(directory, { recursive: true, force: true }); }
}

async function http(db, method, pathname, body, student) {
  const headers = { 'content-type': 'application/json' };
  if (student) { headers['x-student-email'] = student.email; headers['x-student-token'] = student.token; }
  else headers['x-admin-token'] = ADMIN_ENV.ADMIN_TOKEN;
  const response = await worker.fetch(new Request(`https://portal.test${pathname}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  }), { DB: db, ...ADMIN_ENV });
  return { status: response.status, body: await response.json() };
}

const one = (db, sql, ...params) => db.prepare(sql).bind(...params).first();
const summary = async (db) => (await http(db, 'GET', '/api/admin/premium/workspace/summary')).body.data;

async function createPremiumStudent(db, suffix) {
  const email = `${suffix}@example.test`;
  const created = await http(db, 'POST', '/api/admin/premium/workspace/students', {
    name: `Aluno ${suffix}`, email, whatsapp: '11999990000', planType: 'PREMIUM',
  });
  assert.equal(created.status, 201);
  return { id: created.body.data.studentId, email, token: created.body.data.token, name: `Aluno ${suffix}` };
}

test('F3.3.7 moves a real Premium student through every public anamnesis lifecycle command', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(NOW) });
  await withDatabase(async (db) => {
    const student = await createPremiumStudent(db, 'lifecycle');
    const onboarding = await summary(db);
    assert.equal(onboarding.anamnesis.awaiting, 1);
    assert.ok(onboarding.anamnesis.queues.onboarding.some((item) => item.studentId === student.id));

    const submitted = await http(db, 'POST', '/api/anamnese-premium', { answers: { objective: 'Saúde e constância' } }, student);
    assert.equal(submitted.status, 200);
    assert.equal(submitted.body.data.alreadySubmitted, false);
    const underReview = await summary(db);
    assert.equal(underReview.anamnesis.awaiting, 0);
    assert.equal(underReview.anamnesis.underReview, 1);
    assert.equal(underReview.anamnesis.queues.onboarding.some((item) => item.studentId === student.id), false);
    assert.ok(underReview.anamnesis.queues.underReview.some((item) => item.studentId === student.id));
    // The submission currently changes the lifecycle and writes ANAMNESIS_SENT, but does
    // not materialize ANALYZE_ANAMNESIS (documented as NOT_IMPLEMENTED_DOMAIN_CONTRACT).
    assert.equal((await one(db, `SELECT COUNT(*) total FROM premium_pending_items WHERE student_id=? AND type='ANALYZE_ANAMNESIS'`, student.id)).total, 0);

    assert.equal((await http(db, 'POST', `/api/admin/premium/workspace/students/${student.id}/mark-ready`, {})).status, 200);
    const ready = await summary(db);
    assert.equal(ready.anamnesis.underReview, 0);
    assert.equal(ready.anamnesis.readyToRelease, 1);
    assert.ok(ready.anamnesis.queues.readyToRelease.some((item) => item.studentId === student.id));

    assert.equal((await http(db, 'POST', `/api/admin/premium/workspace/students/${student.id}/release`, {})).status, 200);
    const active = await summary(db);
    for (const queue of Object.values(active.anamnesis.queues)) assert.equal(queue.some((item) => item.studentId === student.id), false);
    assert.equal((await one(db, 'SELECT consultation_status FROM premium_students WHERE student_id=?', student.id)).consultation_status, 'ACTIVE');
  });
});

test('F3.3.7 proves weekly work before/after, presenter CTAs, retries, conflict, and Project LM isolation', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(NOW) });
  await withDatabase(async (db) => {
    const student = await createPremiumStudent(db, 'weekly');
    await db.prepare(`UPDATE premium_students SET consultation_status='ACTIVE' WHERE student_id=?`).bind(student.id).run();
    const current = await http(db, 'GET', '/api/portal/premium/weekly-feedback/current', undefined, student);
    assert.equal(current.body.data.status, 'AVAILABLE');
    const answers = { trainingAdherence: 'Quatro treinos', nutritionAdherence: 'Boa', cardioAdherence: 'Três', sleepQuality: 'Boa', energyLevel: 'Alta', weeklyWeight: '78', mainDifficulty: 'Agenda', routineContext: 'Trabalho', supportNeeded: 'Planejamento' };
    const sent = await http(db, 'POST', '/api/portal/premium/weekly-feedback/current', answers, student);
    assert.equal(sent.status, 200);
    const checkinId = sent.body.data.id;
    assert.deepEqual(await one(db, 'SELECT coach_status,submitted_at IS NOT NULL submitted FROM student_checkins WHERE id=?', checkinId), { coach_status: 'pending', submitted: 1 });
    assert.deepEqual(await one(db, `SELECT status,source,related_entity_type,related_entity_id FROM premium_pending_items WHERE student_id=? AND type='ANALYZE_WEEKLY_FEEDBACK'`, student.id), { status: 'OPEN', source: 'automatic', related_entity_type: 'student_checkins', related_entity_id: checkinId });

    const retrySubmission = await http(db, 'POST', '/api/portal/premium/weekly-feedback/current', answers, student);
    assert.equal(retrySubmission.body.data.id, checkinId);
    assert.equal((await one(db, `SELECT COUNT(*) total FROM premium_pending_items WHERE type='ANALYZE_WEEKLY_FEEDBACK' AND related_entity_id=?`, checkinId)).total, 1);

    const before = await summary(db);
    const backlog = before.checkins.items.find((item) => item.studentId === student.id && item.checkinId === checkinId);
    const pending = before.pendingItems.items.find((item) => item.type === 'ANALYZE_WEEKLY_FEEDBACK' && item.relatedEntity?.id === checkinId);
    assert.ok(backlog);
    // checkins.items is the specialized weekly-cycle view; pendingItems.items is the
    // general materialized operational queue. The shared check-in is intentional.
    assert.ok(pending);
    assert.deepEqual({ studentId: pending.studentId, studentName: pending.studentName, type: pending.type, typeLabel: pending.typeLabel, priority: pending.priority, priorityLabel: pending.priorityLabel, cta: pending.cta.label, record: pending.recordCta.label, canResolve: pending.canResolve }, { studentId: student.id, studentName: student.name, type: 'ANALYZE_WEEKLY_FEEDBACK', typeLabel: 'Analisar feedback semanal', priority: 'NORMAL', priorityLabel: 'Normal', cta: 'Revisar feedback', record: 'Abrir Prontuário', canResolve: true });
    for (const cta of [pending.cta, pending.recordCta]) assert.match(cta.url, /^\/admin-premium-/);

    // Malformed READ_MODEL_FIXTURE: domain data without a Premium identity must not leak.
    await db.prepare(`INSERT INTO student_checkins(id,student_id,student_email,week_ref,coach_status,submitted_at,created_at,updated_at) VALUES('project-checkin','project-lm-student','project@lm.test','2026-W33','pending',?,?,?)`).bind(NOW, NOW, NOW).run();
    await db.prepare(`INSERT INTO premium_pending_items(id,student_id,type,title,status,priority,source,related_entity_type,related_entity_id,created_at,updated_at) VALUES('project-pending','project-lm-student','MANUAL','Não vazar','OPEN','HIGH','manual','student_checkins','project-checkin',?,?)`).bind(NOW, NOW).run();
    const isolated = await summary(db);
    assert.equal(isolated.checkins.items.some((item) => item.studentId === 'project-lm-student'), false);
    assert.equal(isolated.pendingItems.items.some((item) => item.studentId === 'project-lm-student'), false);
    for (const queue of Object.values(isolated.anamnesis.queues)) assert.equal(queue.some((item) => item.studentId === 'project-lm-student'), false);

    const decision = { decision_type: 'UPDATE_PLAN', note: 'Ajustar estratégia.', coach_reply: 'Boa evolução. Vamos ajustar o planejamento.', followup_at: null };
    const decided = await http(db, 'POST', `/api/admin/premium/weekly-feedbacks/${checkinId}/decision`, decision);
    assert.equal(decided.status, 200);
    assert.equal(decided.body.data.unchanged, false);
    const after = await summary(db);
    assert.equal(before.checkins.awaitingReview - after.checkins.awaitingReview, 1);
    assert.equal(after.checkins.items.some((item) => item.checkinId === checkinId), false);
    assert.equal(after.pendingItems.items.some((item) => item.type === 'ANALYZE_WEEKLY_FEEDBACK' && item.relatedEntity?.id === checkinId), false);
    const derived = after.pendingItems.items.find((item) => item.type === 'CREATE_NUTRITION_PLAN' && item.relatedEntity?.id === checkinId);
    assert.deepEqual({ type: derived.type, typeLabel: derived.typeLabel, cta: derived.cta.label, record: derived.recordCta.label, studentId: derived.studentId }, { type: 'CREATE_NUTRITION_PLAN', typeLabel: 'Criar ou atualizar plano alimentar', cta: 'Abrir plano alimentar', record: 'Abrir Prontuário', studentId: student.id });
    assert.match(derived.cta.url, /^\/admin-premium-/);
    assert.equal((await one(db, `SELECT COUNT(*) total FROM premium_pending_items WHERE type='CREATE_NUTRITION_PLAN' AND related_entity_id=? AND status='OPEN'`, checkinId)).total, 1);
    assert.equal((await one(db, `SELECT COUNT(*) total FROM premium_pending_items WHERE type='ANALYZE_WEEKLY_FEEDBACK' AND related_entity_id=? AND status='RESOLVED'`, checkinId)).total, 1);

    const retryDecision = await http(db, 'POST', `/api/admin/premium/weekly-feedbacks/${checkinId}/decision`, decision);
    assert.equal(retryDecision.body.data.unchanged, true);
    const conflict = await http(db, 'POST', `/api/admin/premium/weekly-feedbacks/${checkinId}/decision`, { ...decision, decision_type: 'CONTACT_STUDENT' });
    assert.equal(conflict.status, 409);
    assert.equal(conflict.body.code, 'WEEKLY_FEEDBACK_ALREADY_REVIEWED');
    assert.equal((await one(db, `SELECT COUNT(*) total FROM premium_pending_items WHERE related_entity_id=?`, checkinId)).total, 2);
    assert.equal((await one(db, `SELECT COUNT(*) total FROM premium_followup_entries WHERE entry_type='PROFESSIONAL_DECISION' AND related_entity_id=?`, checkinId)).total, 1);
  });
});

test('F3.3.7 preserves pending ordering, real totals/window, decision presenter matrix, and UI load contract', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(NOW) });
  await withDatabase(async (db) => {
    const student = await createPremiumStudent(db, 'read-model');
    const fixtureTypes = ['CONTACT_STUDENT', 'REQUEST_INFORMATION', 'MANUAL'];
    for (let index = 0; index < 14; index += 1) {
      const type = fixtureTypes[index % fixtureTypes.length];
      const priority = index === 1 ? 'HIGH' : index === 13 ? 'LOW' : 'NORMAL';
      // READ_MODEL_FIXTURE: these types have no generic public creation command.
      await db.prepare(`INSERT INTO premium_pending_items(id,student_id,type,title,status,priority,source,related_entity_type,related_entity_id,created_at,updated_at) VALUES(?,?,?,?,'OPEN',?,'manual','read_model_fixture',?,?,?)`).bind(`fixture-${index}`, student.id, type, `Fixture ${index}`, priority, `fixture-${index}`, `2026-08-14T12:${String(index).padStart(2, '0')}:00.000Z`, NOW).run();
    }
    const data = await summary(db);
    assert.equal(data.pendingItems.open, 14);
    assert.equal(data.pendingItems.high, 1);
    assert.equal(data.pendingItems.items.length, 12);
    assert.ok(data.pendingItems.open > data.pendingItems.items.length);
    assert.equal(data.pendingItems.items[0].priority, 'HIGH');
    const contact = data.pendingItems.items.find((item) => item.type === 'CONTACT_STUDENT');
    const request = data.pendingItems.items.find((item) => item.type === 'REQUEST_INFORMATION');
    assert.deepEqual({ label: contact.typeLabel, cta: contact.cta.label }, { label: 'Entrar em contato com o aluno', cta: 'Ver contato' });
    assert.deepEqual({ label: request.typeLabel, cta: request.cta.label, record: request.recordCta.label }, { label: 'Solicitar mais informações', cta: 'Abrir contexto', record: 'Abrir Prontuário' });
  });

  const [html, runtime] = await Promise.all([readFile('public/admin-premium-workspace.html', 'utf8'), readFile('public/admin-premium-workspace.js', 'utf8')]);
  assert.match(html, /id="pendingItemsCard"[\s\S]*Pendências abertas/);
  assert.match(html, /id="pendingItemsOperationalPanel"[\s\S]*Pendências operacionais/);
  assert.match(html, /Fluxo de anamnese/);
  assert.match(runtime, /api\('\/api\/admin\/premium\/workspace\/summary'\)/);
  assert.doesNotMatch(runtime, /api\('\/api\/admin\/premium\/workspace\/pending-items/);
  assert.doesNotMatch(runtime, /pendingItems\.(?:splice|pop|shift)\(/);
  assert.doesNotMatch(runtime, /pending-items\/[^'`]*resolve/);
});
