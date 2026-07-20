import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import worker, { initializeSchemaForTests } from '../workers/api.js';

class SqliteD1 {
  constructor(file) { this.file = file; }
  prepare(sql) { return new SqliteD1Statement(this.file, sql); }
  async batch(statements) { const results = []; for (const statement of statements) results.push(await statement.run()); return results; }
}

class SqliteD1Statement {
  constructor(file, sql, params = []) { this.file = file; this.sql = sql; this.params = params; }
  bind(...params) { return new SqliteD1Statement(this.file, this.sql, params); }
  sqlWithParams() {
    let index = 0;
    return this.sql.replace(/\?/g, () => sqlValue(this.params[index++]));
  }
  async run() {
    execFileSync('sqlite3', [this.file], { input: this.sqlWithParams() + ';' });
    const readonly = /^\s*(CREATE|ALTER|DROP|PRAGMA|INSERT OR IGNORE)/i.test(this.sql);
    return { meta: { changes: readonly ? 0 : 1 } };
  }
  async all() {
    const out = execFileSync('sqlite3', ['-json', this.file, this.sqlWithParams()], { encoding: 'utf8' }).trim();
    return { results: out ? JSON.parse(out) : [] };
  }
  async first() {
    const { results } = await this.all();
    return results[0] ?? null;
  }
}

function sqlValue(value) {
  if (value == null) return 'NULL';
  if (typeof value === 'number') return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
}

async function withDb(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'portal-lm-premium-contract-'));
  const file = join(dir, 'test.db');
  const db = new SqliteD1(file);
  try {
    await initializeSchemaForTests(db);
    await fn(db);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function seedAccess(db, { id = 'access-1', email = 'student@example.com', token = 'token', plan = 'premium', planType = 'PREMIUM' } = {}) {
  await db.prepare(`INSERT INTO student_access (id, name, email, access_token, status, plan_type, plan, created_at) VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?, ?)`)
    .bind(id, 'Student', email, token, planType, plan, '2026-07-14T00:00:00.000Z').run();
}

async function seedPremiumStudent(db, { studentId = 'student-1', email = 'student@example.com', status = 'ACTIVE' } = {}) {
  await db.prepare(`INSERT INTO premium_students (student_id, email, normalized_email, display_name, consultation_status, access_status, source, created_at, updated_at) VALUES (?, ?, ?, 'Student', ?, 'ACTIVE', 'TEST', ?, ?)`).bind(studentId, email, email.toLowerCase(), status, '2026-07-14T00:00:00.000Z', '2026-07-14T00:00:00.000Z').run();
}

async function api(db, method, pathname, { body, email = 'student@example.com', token = 'token', admin = false } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (admin) headers['x-admin-token'] = 'admin-token';
  else { headers['x-student-email'] = email; headers['x-student-token'] = token; }
  const response = await worker.fetch(new Request(`https://portal.test${pathname}`, { method, headers, body: body ? JSON.stringify(body) : undefined }), { DB: db, ADMIN_TOKEN: 'admin-token' });
  return { status: response.status, body: await response.json() };
}

function assertNoInternalFields(value) {
  const text = JSON.stringify(value);
  assert.equal(text.includes('student_id'), false);
  assert.equal(text.includes('identity_method'), false);
  assert.equal(text.includes('fallback'), false);
}

test('GET /api/portal/nutrition-plan preserva contrato público e bloqueia Projeto LM', async () => withDb(async (db) => {
  await seedAccess(db);
  await seedPremiumStudent(db);
  await db.prepare(`INSERT INTO nutrition_plans (id, student_id, student_email, title, meals_json, substitutions_json, adherence_rules_json, is_active, created_at, updated_at) VALUES ('plan-1', 'student-1', 'student@example.com', 'Plano', '[]', '[]', '[]', 1, '2026-07-14T00:00:00.000Z', '2026-07-14T00:00:00.000Z')`).run();
  const response = await api(db, 'GET', '/api/portal/nutrition-plan');
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.data.id, 'plan-1');
  assertNoInternalFields(response.body);

  await seedAccess(db, { id: 'project-access', email: 'project@example.com', token: 'project-token', plan: 'projeto_lm', planType: 'projeto_lm' });
  const blocked = await api(db, 'GET', '/api/portal/nutrition-plan', { email: 'project@example.com', token: 'project-token' });
  assert.equal(blocked.status, 403);
  assert.equal(blocked.body.ok, false);
}));

test('POST /api/portal/checkin e GET /api/portal/checkins preservam contrato público e autenticação', async () => withDb(async (db) => {
  const unauthorized = await worker.fetch(new Request('https://portal.test/api/portal/checkins'), { DB: db, ADMIN_TOKEN: 'admin-token' });
  assert.equal(unauthorized.status, 401);

  await seedAccess(db);
  await seedPremiumStudent(db);
  const created = await api(db, 'POST', '/api/portal/checkin', { body: { trainingAdherence: 'ok', weeklyScore: '8' } });
  assert.equal(created.status, 200);
  assert.deepEqual(Object.keys(created.body.data), ['id', 'weekRef', 'createdAt']);
  assertNoInternalFields(created.body);

  const listed = await api(db, 'GET', '/api/portal/checkins');
  assert.equal(listed.status, 200);
  assert.equal(listed.body.ok, true);
  assert.equal(Array.isArray(listed.body.data), true);
  assert.equal(listed.body.data.length, 1);
  assertNoInternalFields(listed.body);

  await seedAccess(db, { id: 'project-access', email: 'project@example.com', token: 'project-token', plan: 'projeto_lm', planType: 'projeto_lm' });
  const blocked = await api(db, 'POST', '/api/portal/checkin', { email: 'project@example.com', token: 'project-token', body: {} });
  assert.equal(blocked.status, 403);
}));

test('admin endpoints migrados preservam shape público sem campos internos', async () => withDb(async (db) => {
  await seedAccess(db);
  await seedPremiumStudent(db);
  const savedPlan = await api(db, 'POST', '/api/admin/nutrition-plan', { admin: true, body: { student_email: 'student@example.com', title: 'Plano', meals: [{ name: 'Café' }], substitutions: [], adherence_rules: [] } });
  assert.equal(savedPlan.status, 200);
  assert.equal(savedPlan.body.ok, true);
  assertNoInternalFields(savedPlan.body);

  await db.prepare(`INSERT INTO student_checkins (id, student_id, student_email, week_ref, created_at) VALUES ('checkin-1', 'student-1', 'student@example.com', '2026-W29', '2026-07-14T00:00:00.000Z')`).run();
  const replied = await api(db, 'PATCH', '/api/admin/checkins/checkin-1/reply', { admin: true, body: { coach_reply: 'Resposta', coach_status: 'replied' } });
  assert.equal(replied.status, 200);
  assert.deepEqual(Object.keys(replied.body.data), ['id', 'coach_status', 'coach_reply', 'coach_reply_at', 'reviewed_at', 'reviewed_by']);
  assertNoInternalFields(replied.body);

  await db.prepare(`INSERT INTO premium_anamnesis (id, student_id, student_name, student_email, student_phone, status, answers_json, created_at, updated_at) VALUES ('anam-1', 'student-1', 'Student', 'student@example.com', '11999999999', 'RECEBIDA', '{}', '2026-07-14T00:00:00.000Z', '2026-07-14T00:00:00.000Z')`).run();
  const anamnesis = await api(db, 'PATCH', '/api/admin/anamneses/anam-1', { admin: true, body: { status: 'ANALISADA' } });
  assert.equal(anamnesis.status, 200);
  assert.deepEqual(Object.keys(anamnesis.body.data), ['id', 'status', 'updated_at']);
  assertNoInternalFields(anamnesis.body);
}));

test('LM Premium 3.1 cadastro Workspace cria acesso inicial aguardando anamnese e rejeita duplicidade/Projeto LM', async () => withDb(async (db) => {
  const created = await api(db, 'POST', '/api/admin/premium/workspace/students', { admin: true, body: { name: 'Nova Aluna', email: '  NOVA@EXAMPLE.COM ', whatsapp: '(11) 99999-0000', planType: 'PREMIUM' } });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.email, 'nova@example.com');
  assert.equal(created.body.data.status, 'AWAITING_ANAMNESIS');
  assert.ok(created.body.data.token);
  const access = await db.prepare(`SELECT name,email,status,plan,plan_type,student_id FROM student_access WHERE lower(email)='nova@example.com'`).first();
  assert.equal(access.status, 'ACTIVE');
  assert.equal(access.plan, 'premium');
  const premium = await db.prepare(`SELECT consultation_status FROM premium_students WHERE normalized_email='nova@example.com'`).first();
  assert.equal(premium.consultation_status, 'AWAITING_ANAMNESIS');
  const duplicate = await api(db, 'POST', '/api/admin/premium/workspace/students', { admin: true, body: { name: 'Nova Aluna', email: 'nova@example.com' } });
  assert.equal(duplicate.status, 409);
  await seedAccess(db, { id: 'project-collision', email: 'project-collision@example.com', plan: 'projeto_lm', planType: 'projeto_lm' });
  const project = await api(db, 'POST', '/api/admin/premium/workspace/students', { admin: true, body: { name: 'Projeto', email: 'project-collision@example.com' } });
  assert.equal(project.status, 409);
}));

test('LM Premium 3.1 máquina de estados restringe mark-ready, release e pause', async () => withDb(async (db) => {
  await seedAccess(db);
  await seedPremiumStudent(db, { status: 'AWAITING_ANAMNESIS' });
  assert.equal((await api(db, 'POST', '/api/admin/premium/workspace/students/student-1/mark-ready', { admin: true, body: {} })).status, 409);
  assert.equal((await api(db, 'POST', '/api/admin/premium/workspace/students/student-1/release', { admin: true, body: {} })).status, 409);
  assert.equal((await api(db, 'POST', '/api/admin/premium/workspace/students/student-1/pause', { admin: true, body: {} })).status, 409);

  const anamnesis = await api(db, 'POST', '/api/anamnese-premium', { body: { answers: {} } });
  assert.equal(anamnesis.status, 200);
  let status = await db.prepare(`SELECT consultation_status FROM premium_students WHERE student_id='student-1'`).first();
  assert.equal(status.consultation_status, 'UNDER_REVIEW');
  assert.equal((await api(db, 'POST', '/api/admin/premium/workspace/students/student-1/release', { admin: true, body: {} })).status, 409);

  const ready = await api(db, 'POST', '/api/admin/premium/workspace/students/student-1/mark-ready', { admin: true, body: {} });
  assert.equal(ready.status, 200);
  status = await db.prepare(`SELECT consultation_status FROM premium_students WHERE student_id='student-1'`).first();
  assert.equal(status.consultation_status, 'READY_TO_RELEASE');
  assert.equal((await api(db, 'POST', '/api/admin/premium/workspace/students/student-1/pause', { admin: true, body: {} })).status, 409);

  await db.prepare(`INSERT INTO nutrition_plans (id, student_id, student_email, title, meals_json, substitutions_json, adherence_rules_json, status, is_active, created_at, updated_at) VALUES ('diet-only', 'student-1', 'student@example.com', 'Dieta', '[]', '[]', '[]', 'PUBLISHED', 1, '2026-07-14T00:00:00.000Z', '2026-07-14T00:00:00.000Z')`).run();
  const released = await api(db, 'POST', '/api/admin/premium/workspace/students/student-1/release', { admin: true, body: {} });
  assert.equal(released.status, 200);
  status = await db.prepare(`SELECT consultation_status FROM premium_students WHERE student_id='student-1'`).first();
  assert.equal(status.consultation_status, 'ACTIVE');
  const again = await api(db, 'POST', '/api/admin/premium/workspace/students/student-1/release', { admin: true, body: {} });
  assert.equal(again.status, 200);
  assert.equal(again.body.data.idempotent, true);
  const paused = await api(db, 'POST', '/api/admin/premium/workspace/students/student-1/pause', { admin: true, body: {} });
  assert.equal(paused.status, 200);
  status = await db.prepare(`SELECT consultation_status FROM premium_students WHERE student_id='student-1'`).first();
  assert.equal(status.consultation_status, 'PAUSED');
}));

test('LM Premium 3.1 anamnese autenticada só aceita estado de onboarding e não duplica envio', async () => withDb(async (db) => {
  for (const [index, initial, expected, responseStatus] of [['a','AWAITING_ANAMNESIS','UNDER_REVIEW',200], ['p','PAUSED','PAUSED',409], ['e','ENDED','ENDED',409], ['r','READY_TO_RELEASE','READY_TO_RELEASE',409], ['ac','ACTIVE','ACTIVE',409]]) {
    const email = `${index}@example.com`;
    await seedAccess(db, { id: `access-${index}`, email, token: `token-${index}` });
    await seedPremiumStudent(db, { studentId: `student-${index}`, email, status: initial });
    const res = await api(db, 'POST', '/api/anamnese-premium', { email, token: `token-${index}`, body: { answers: {} } });
    assert.equal(res.status, responseStatus);
    const row = await db.prepare(`SELECT consultation_status FROM premium_students WHERE student_id=?`).bind(`student-${index}`).first();
    assert.equal(row.consultation_status, expected, initial);
  }
}));

test('LM Premium 3.1 anamnese exige sessão Premium e rejeita identidade no payload', async () => withDb(async (db) => {
  const missing = await worker.fetch(new Request('https://portal.test/api/anamnese-premium', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ answers: {} }) }), { DB: db, ADMIN_TOKEN: 'admin-token' });
  assert.equal(missing.status, 401);
  await seedAccess(db); await seedPremiumStudent(db, { status: 'AWAITING_ANAMNESIS' });
  const mismatch = await api(db, 'POST', '/api/anamnese-premium', { body: { student_email: 'other@example.com', answers: {} } });
  assert.equal(mismatch.status, 403); assert.equal(mismatch.body.code, 'IDENTITY_MISMATCH');
  const accessBefore = await db.prepare(`SELECT COUNT(*) AS total FROM student_access`).first();
  const studentBefore = await db.prepare(`SELECT COUNT(*) AS total FROM premium_students`).first();
  const accepted = await api(db, 'POST', '/api/anamnese-premium', { body: { answers: {} } });
  assert.equal(accepted.status, 200);
  assert.deepEqual(await db.prepare(`SELECT COUNT(*) AS total FROM student_access`).first(), accessBefore);
  assert.deepEqual(await db.prepare(`SELECT COUNT(*) AS total FROM premium_students`).first(), studentBefore);
}));

test('LM Premium 3.1 submissões concorrentes são atomicamente idempotentes', async () => withDb(async (db) => {
  await seedAccess(db); await seedPremiumStudent(db, { status: 'AWAITING_ANAMNESIS' });
  const accessBefore = await db.prepare(`SELECT id,name,email,access_token,status,plan_type,plan,student_id FROM student_access WHERE email='student@example.com'`).first();
  const studentsBefore = await db.prepare(`SELECT COUNT(*) AS total FROM premium_students`).first();
  const [first, second] = await Promise.all([
    api(db, 'POST', '/api/anamnese-premium', { body: { answers: { personal: { weight: '70' } } } }),
    api(db, 'POST', '/api/anamnese-premium', { body: { answers: { personal: { weight: '70' } } } })
  ]);
  assert.equal(first.status, 200); assert.equal(second.status, 200);
  assert.equal(new Set([first.body.data.id, second.body.data.id]).size, 1);
  assert.deepEqual([first.body.data.alreadySubmitted, second.body.data.alreadySubmitted].sort(), [false, true]);
  assert.equal((await db.prepare(`SELECT COUNT(*) AS total FROM premium_anamnesis WHERE student_email='student@example.com'`).first()).total, 1);
  assert.equal((await db.prepare(`SELECT COUNT(*) AS total FROM activity_timeline WHERE student_email='student@example.com' AND event_type='ANAMNESIS_SENT'`).first()).total, 1);
  assert.equal((await db.prepare(`SELECT consultation_status FROM premium_students WHERE student_id='student-1'`).first()).consultation_status, 'UNDER_REVIEW');
  assert.deepEqual(await db.prepare(`SELECT id,name,email,access_token,status,plan_type,plan,student_id FROM student_access WHERE email='student@example.com'`).first(), accessBefore);
  assert.deepEqual(await db.prepare(`SELECT COUNT(*) AS total FROM premium_students`).first(), studentsBefore);
  const retry = await api(db, 'POST', '/api/anamnese-premium', { body: { answers: {} } });
  assert.equal(retry.status, 200); assert.equal(retry.body.data.id, first.body.data.id); assert.equal(retry.body.data.alreadySubmitted, true);
}));

test('LM Premium 3.1 anamnese inicial permite alunos distintos e onboarding sem student_id usa e-mail', async () => withDb(async (db) => {
  await seedAccess(db); await seedPremiumStudent(db, { status: 'AWAITING_ANAMNESIS' });
  await seedAccess(db, { id: 'access-b', email: 'b@example.com', token: 'token-b' }); await seedPremiumStudent(db, { studentId: 'student-b', email: 'b@example.com', status: 'AWAITING_ANAMNESIS' });
  const [a, b] = await Promise.all([api(db, 'POST', '/api/anamnese-premium', { body: { answers: {} } }), api(db, 'POST', '/api/anamnese-premium', { email: 'b@example.com', token: 'token-b', body: { answers: {} } })]);
  assert.equal(a.body.data.alreadySubmitted, false); assert.equal(b.body.data.alreadySubmitted, false); assert.notEqual(a.body.data.id, b.body.data.id);
  await seedAccess(db, { id: 'email-onboarding', email: 'email-onboarding@example.com', token: 'email-token' });
  await db.prepare(`INSERT INTO premium_students (student_id,email,normalized_email,display_name,consultation_status,access_status,source,created_at,updated_at) VALUES (NULL,? ,? ,'Email onboarding','AWAITING_ANAMNESIS','ACTIVE','TEST',?,?)`).bind('email-onboarding@example.com', 'email-onboarding@example.com', '2026-07-14', '2026-07-14').run();
  const [emailFirst, emailSecond] = await Promise.all([api(db, 'POST', '/api/anamnese-premium', { email: 'email-onboarding@example.com', token: 'email-token', body: { answers: {} } }), api(db, 'POST', '/api/anamnese-premium', { email: 'email-onboarding@example.com', token: 'email-token', body: { answers: {} } })]);
  assert.equal(emailFirst.body.data.id, emailSecond.body.data.id);
  assert.equal((await db.prepare(`SELECT COUNT(*) AS total FROM premium_anamnesis WHERE student_id IS NULL AND student_email='email-onboarding@example.com'`).first()).total, 1);
  assert.equal((await db.prepare(`SELECT consultation_status FROM premium_students WHERE normalized_email='email-onboarding@example.com'`).first()).consultation_status, 'UNDER_REVIEW');
}));

test('LM Premium 3.1 legado sem premium_students não pode iniciar anamnese', async () => withDb(async (db) => {
  await seedAccess(db, { id: 'legacy-access', email: 'legacy@example.com', token: 'legacy-token' });
  const accessBefore = await db.prepare(`SELECT id,name,email,access_token,status,plan_type,plan,student_id FROM student_access WHERE email='legacy@example.com'`).first();
  const response = await api(db, 'POST', '/api/anamnese-premium', { email: 'legacy@example.com', token: 'legacy-token', body: { answers: {} } });
  assert.equal(response.status, 409); assert.equal(response.body.code, 'ANAMNESIS_NOT_AVAILABLE');
  assert.equal((await db.prepare(`SELECT COUNT(*) AS total FROM premium_anamnesis WHERE student_email='legacy@example.com'`).first()).total, 0);
  assert.equal((await db.prepare(`SELECT COUNT(*) AS total FROM activity_timeline WHERE student_email='legacy@example.com' AND event_type='ANAMNESIS_SENT'`).first()).total, 0);
  assert.deepEqual(await db.prepare(`SELECT id,name,email,access_token,status,plan_type,plan,student_id FROM student_access WHERE email='legacy@example.com'`).first(), accessBefore);
  const state = await api(db, 'GET', '/api/portal/premium/access-state', { email: 'legacy@example.com', token: 'legacy-token' });
  assert.equal(state.body.data.experience, 'PREMIUM_PORTAL');
  await seedAccess(db, { id: 'project-access', email: 'project@example.com', token: 'project-token', plan: 'projeto_lm', planType: 'projeto_lm' });
  assert.equal((await api(db, 'POST', '/api/anamnese-premium', { email: 'project@example.com', token: 'project-token', body: { answers: {} } })).status, 403);
}));

test('LM Premium 3.1 gate bloqueia módulos completos antes de ACTIVE e pause volta a bloquear', async () => withDb(async (db) => {
  await seedAccess(db);
  await seedPremiumStudent(db, { status: 'UNDER_REVIEW' });
  for (const path of ['/api/portal/weekly-plan', '/api/portal/nutrition-plan', '/api/portal/checkins', '/api/portal/premium/weekly-feedback/current', '/api/portal/progression']) {
    const blocked = await api(db, 'GET', path);
    assert.equal(blocked.status, 403, path);
  }
  const blockedPost = await api(db, 'POST', '/api/portal/checkin', { body: {} });
  assert.equal(blockedPost.status, 403);
  await db.prepare(`UPDATE premium_students SET consultation_status='ACTIVE' WHERE student_id='student-1'`).run();
  await db.prepare(`INSERT INTO weekly_plans (id, student_id, student_email, week_ref, training_focus, status, created_at, updated_at) VALUES ('training-active', 'student-1', 'student@example.com', '2026-W29', 'Treino publicado', 'ACTIVE', '2026-07-14T00:00:00.000Z', '2026-07-14T00:00:00.000Z')`).run();
  assert.equal((await api(db, 'GET', '/api/portal/weekly-plan')).status, 200);
  const paused = await api(db, 'POST', '/api/admin/premium/workspace/students/student-1/pause', { admin: true, body: {} });
  assert.equal(paused.status, 200);
  assert.equal((await api(db, 'GET', '/api/portal/weekly-plan')).status, 403);
}));

test('LM Premium 3.1 access-state roteia estados Premium, preserva legado e isola Projeto LM', async () => withDb(async (db) => {
  const statuses = ['NEW', 'AWAITING_ANAMNESIS', 'UNDER_REVIEW', 'READY_TO_RELEASE', 'PAUSED', 'ENDED'];
  for (const [index, status] of statuses.entries()) {
    const email = `${status.toLowerCase()}@example.com`;
    await seedAccess(db, { id: `access-${index}`, email, token: `token-${index}` });
    await seedPremiumStudent(db, { studentId: `student-${index}`, email, status });
    const response = await api(db, 'GET', '/api/portal/premium/access-state', { email, token: `token-${index}` });
    assert.equal(response.status, 200, status);
    assert.equal(response.body.data.experience, 'ONBOARDING', status);
    assert.equal(response.body.data.consultationStatus, status);
    assert.equal(response.body.data.primaryAction?.type, ['NEW', 'AWAITING_ANAMNESIS'].includes(status) ? 'OPEN_ANAMNESIS' : undefined);
    assert.equal(JSON.stringify(response.body).includes('token'), false);
  }
  await seedAccess(db, { id: 'active-access', email: 'active@example.com', token: 'active-token' });
  await seedPremiumStudent(db, { studentId: 'active-student', email: 'active@example.com', status: 'ACTIVE' });
  assert.equal((await api(db, 'GET', '/api/portal/premium/access-state', { email: 'active@example.com', token: 'active-token' })).body.data.experience, 'PREMIUM_PORTAL');
  await seedAccess(db, { id: 'legacy-access', email: 'legacy@example.com', token: 'legacy-token' });
  const legacy = await api(db, 'GET', '/api/portal/premium/access-state', { email: 'legacy@example.com', token: 'legacy-token' });
  assert.equal(legacy.body.data.experience, 'PREMIUM_PORTAL');
  await seedAccess(db, { id: 'lm-access', email: 'lm@example.com', token: 'lm-token', plan: 'projeto_lm', planType: 'projeto_lm' });
  assert.equal((await api(db, 'GET', '/api/portal/premium/access-state', { email: 'lm@example.com', token: 'lm-token' })).status, 403);
  const unauthorized = await worker.fetch(new Request('https://portal.test/api/portal/premium/access-state'), { DB: db, ADMIN_TOKEN: 'admin-token' });
  assert.equal(unauthorized.status, 401);
}));
