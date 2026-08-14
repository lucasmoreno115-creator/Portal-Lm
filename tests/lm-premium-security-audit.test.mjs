import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import worker, { initializeSchemaForTests } from '../workers/api.js';
import { SqliteD1 } from './helpers/sqlite-d1.mjs';

const ENV = { ADMIN_TOKEN: 'audit-admin-token', PREMIUM_PROFESSIONAL_WORKSPACE_ENABLED: 'true' };
const STUDENT_A = { id: 'audit-a', accessId: 'access-a', email: 'audit-a@example.test', token: 'token-a' };
const STUDENT_B = { id: 'audit-b', accessId: 'access-b', email: 'audit-b@example.test', token: 'token-b' };

async function withAuditDb(run) {
  const directory = await mkdtemp(join(tmpdir(), 'lm-security-audit-'));
  const db = new SqliteD1(join(directory, 'audit.db'));
  try {
    await initializeSchemaForTests(db);
    for (const student of [STUDENT_A, STUDENT_B]) {
      await db.prepare(`INSERT INTO student_access(id,name,email,status,access_token,plan_type,plan,student_id,created_at)
        VALUES(?, ?, ?, 'ACTIVE', ?, 'PREMIUM', 'premium', ?, '2026-08-14T00:00:00.000Z')`)
        .bind(student.accessId, `Student ${student.id}`, student.email, student.token, student.id).run();
      await db.prepare(`INSERT INTO premium_students(student_id,email,normalized_email,display_name,consultation_status,access_status,source,created_at,updated_at)
        VALUES(?, ?, ?, ?, 'ACTIVE', 'ACTIVE', 'security-audit', '2026-08-14T00:00:00.000Z', '2026-08-14T00:00:00.000Z')`)
        .bind(student.id, student.email, student.email, `Student ${student.id}`).run();
    }
    await run(db);
  } finally {
    db.close();
    await rm(directory, { recursive: true, force: true });
  }
}

async function http(db, method, path, { student, body, admin = false } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (student) {
    headers['x-student-email'] = student.email;
    headers['x-student-token'] = student.token;
  }
  if (admin) headers['x-admin-token'] = ENV.ADMIN_TOKEN;
  const response = await worker.fetch(new Request(`https://audit.invalid${path}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  }), { DB: db, ...ENV });
  return { status: response.status, body: await response.json() };
}

test('F5.0 authentication and administrative authorization reject absent, invalid, and student credentials', () => withAuditDb(async (db) => {
  for (const student of [undefined, { email: STUDENT_A.email, token: 'invalid' }]) {
    const result = await http(db, 'GET', '/api/portal/premium/nutrition-plan/current', { student });
    assert.equal(result.status, 401);
  }
  const route = `/api/admin/premium/workspace/students/${STUDENT_A.id}/deactivate`;
  assert.equal((await http(db, 'POST', route)).status, 401);
  assert.equal((await http(db, 'POST', route, { student: STUDENT_A })).status, 401);
  assert.equal((await http(db, 'POST', route, { admin: true })).status, 200);
}));

test('F5.0 Student A cannot select Student B through IDs, email, or mass-assignment fields', () => withAuditDb(async (db) => {
  await db.prepare(`INSERT INTO progression_logs(id,student_email,exercise,target_zone,load_used,reps_done,decision,created_at)
    VALUES('progress-b', ?, 'Private B', '8–10', 10, 8, 'Keep B', '2026-08-14T00:00:00.000Z')`).bind(STUDENT_B.email).run();
  const before = await db.prepare('SELECT COUNT(*) total FROM progression_logs WHERE student_email=?').bind(STUDENT_B.email).first();
  const created = await http(db, 'POST', '/api/portal/progression', { student: STUDENT_A, body: {
    exercise: 'Audit A', targetZone: '8–10', loadUsed: 12, repsDone: 8, recommendation: 'Keep A',
    studentId: STUDENT_B.id, student_id: STUDENT_B.id, email: STUDENT_B.email,
    id: 'client-id', created_at: '1999-01-01T00:00:00.000Z', decision: 'client-decision',
  } });
  assert.equal(created.status, 200);
  const after = await db.prepare('SELECT COUNT(*) total FROM progression_logs WHERE student_email=?').bind(STUDENT_B.email).first();
  assert.equal(after.total, before.total);
  const list = await http(db, 'GET', `/api/portal/progression?studentId=${encodeURIComponent(STUDENT_B.id)}&email=${encodeURIComponent(STUDENT_B.email)}`, { student: STUDENT_A });
  assert.equal(list.status, 200);
  assert.equal(JSON.stringify(list.body).includes('Private B'), false);
  const stored = await db.prepare("SELECT id,student_email,created_at FROM progression_logs WHERE exercise='Audit A'").first();
  assert.equal(stored.student_email, STUDENT_A.email);
  assert.notEqual(stored.id, 'client-id');
  assert.notEqual(stored.created_at, '1999-01-01T00:00:00.000Z');
}));

test('F5.0 nutrition current exposes only A published data and omits draft/private fields', () => withAuditDb(async (db) => {
  const insert = (values) => db.prepare(`INSERT INTO nutrition_plans(id,student_id,student_email,title,status,is_active,version_number,notes,source_feedback_id,published_by,meals_json,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?, '[]','2026-08-14T00:00:00.000Z','2026-08-14T00:00:00.000Z')`).bind(...values).run();
  await insert(['a-v1', STUDENT_A.id, STUDENT_A.email, 'Published A', 'PUBLISHED', 1, 1, 'Public note', 'private-source', 'private-admin']);
  await insert(['a-v2', STUDENT_A.id, STUDENT_A.email, 'DRAFT_MARKER_A', 'DRAFT', 0, 2, 'private', 'private-source', 'private-admin']);
  await insert(['b-v1', STUDENT_B.id, STUDENT_B.email, 'PRIVATE_PLAN_B', 'PUBLISHED', 1, 1, 'private', 'private-source', 'private-admin']);
  const result = await http(db, 'GET', '/api/portal/premium/nutrition-plan/current?planId=b-v1&versionId=a-v2', { student: STUDENT_A });
  assert.equal(result.status, 200);
  const serialized = JSON.stringify(result.body);
  assert.match(serialized, /Published A/);
  for (const forbidden of ['DRAFT_MARKER_A', 'PRIVATE_PLAN_B', 'student_email', 'student_id', 'source_feedback_id', 'published_by', 'private-admin']) assert.equal(serialized.includes(forbidden), false);
}));

test('F5.1 stored XSS markers remain original API text and legacy renderers use safe DOM sinks', async () => {
  const marker = '<svg data-security-test="xss">';
  const progression = await readFile(new URL('../public/portal-progressao.html', import.meta.url), 'utf8');
  const legacyCheckin = await readFile(new URL('../public/portal-checkin.html', import.meta.url), 'utf8');
  const canonicalFeedback = await readFile(new URL('../public/assets/js/portal-premium-weekly-feedback.js', import.meta.url), 'utf8');
  for (const renderer of [progression, legacyCheckin]) {
    assert.doesNotMatch(renderer, /hist\.innerHTML/);
    assert.match(renderer, /document\.createElement/);
    assert.match(renderer, /\.textContent\s*=/);
  }
  assert.match(progression, /item\.textContent\s*=\s*`\$\{i\.created_at/);
  assert.match(legacyCheckin, /document\.createTextNode\(` · Treino: \$\{c\.training_adherence/);
  assert.match(legacyCheckin, /message\.textContent\s*=\s*c\.coach_reply/);
  assert.match(canonicalFeedback, /\.textContent=text/);
  await withAuditDb(async (db) => {
    const progressionResponse = await http(db, 'POST', '/api/portal/progression', { student: STUDENT_A, body: {
      exercise: marker, targetZone: '8–10', loadUsed: 10, repsDone: 8, recommendation: 'Keep',
    } });
    assert.equal(progressionResponse.status, 200);
    const progressionHistory = await http(db, 'GET', '/api/portal/progression', { student: STUDENT_A });
    assert.equal(progressionHistory.body.data[0].exercise, marker, 'SEC-PREM-002 keeps the original stored text while the renderer treats it as text');

    const checkinResponse = await http(db, 'POST', '/api/portal/checkin', { student: STUDENT_A, body: {
      trainingAdherence: 'Completo', mainDifficulty: marker,
    } });
    assert.equal(checkinResponse.status, 200);
    const checkinHistory = await http(db, 'GET', '/api/portal/checkins', { student: STUDENT_A });
    assert.equal(checkinHistory.body.data[0].main_difficulty, marker, 'SEC-PREM-001 keeps the original stored text while the renderer treats it as text');
  });
});
