import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import worker, { initializeSchemaForTests } from '../workers/api.js';
import { SqliteD1 } from './helpers/sqlite-d1.mjs';

const ENV = { ADMIN_TOKEN: 'admin-token', PREMIUM_PROFESSIONAL_WORKSPACE_ENABLED: 'true' };

async function withStudent(run) {
  const directory = await mkdtemp(join(tmpdir(), 'progression-persistence-'));
  const db = new SqliteD1(join(directory, 'test.db'));
  try {
    await initializeSchemaForTests(db);
    const created = await request(db, 'POST', '/api/admin/premium/workspace/students', {
      name: 'Aluno Progressão', email: 'progression@example.test', whatsapp: '11999990000', planType: 'PREMIUM',
    }, { admin: true });
    const student = { email: 'progression@example.test', token: created.body.data.token };
    await db.prepare("UPDATE premium_students SET consultation_status='ACTIVE' WHERE normalized_email=?").bind(student.email).run();
    await run(db, student);
  } finally {
    db.close();
    await rm(directory, { recursive: true, force: true });
  }
}

async function request(db, method, pathname, body, { student, admin = false } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (student) {
    headers['x-student-email'] = student.email;
    headers['x-student-token'] = student.token;
  } else if (admin) headers['x-admin-token'] = ENV.ADMIN_TOKEN;
  const response = await worker.fetch(new Request(`https://portal.test${pathname}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  }), { DB: db, ...ENV });
  return { status: response.status, body: await response.json() };
}

test('F4.1 canonical progression POST -> database -> GET is lossless', () => withStudent(async (db, student) => {
  const payloads = [
    { exercise: 'Supino reto', targetZone: '8–10', loadUsed: 80.5, repsDone: 10, executionQuality: 'Sim', recommendation: 'Subir carga na próxima sessão' },
    { exercise: 'Elevação lateral', targetZone: '12–15', loadUsed: 10, repsDone: 15, executionQuality: 'Não', recommendation: 'Não subir carga ainda' },
  ];
  for (const payload of payloads) {
    const saved = await request(db, 'POST', '/api/portal/progression', payload, { student });
    assert.equal(saved.status, 200);
  }
  const history = await request(db, 'GET', '/api/portal/progression', undefined, { student });
  assert.equal(history.status, 200);
  for (const expected of payloads) {
    const actual = history.body.data.find(row => row.exercise === expected.exercise);
    assert.deepEqual(Object.fromEntries(Object.keys(expected).map(key => [key, actual[key]])), expected);
    assert.equal(typeof actual.loadUsed, 'number');
    assert.equal(typeof actual.repsDone, 'number');
    assert.ok(actual.created_at);
  }
}));

test('F4.1 legacy decision/RIR remains readable and decision alias writes canonical output', () => withStudent(async (db, student) => {
  await db.prepare(`INSERT INTO progression_logs(id,student_email,exercise,target_zone,load_used,reps_done,rir,decision,created_at)
    VALUES('legacy-row',?,'Agachamento','6–8',100,7,'2','Manter carga','2026-08-01T00:00:00.000Z')`).bind(student.email).run();
  const alias = await request(db, 'POST', '/api/portal/progression', {
    exercise: 'Remada', targetZone: '10–12', loadUsed: 45, repsDone: 11, decision: 'Manter carga legacy',
  }, { student });
  assert.equal(alias.status, 200);
  const history = (await request(db, 'GET', '/api/portal/progression', undefined, { student })).body.data;
  const legacy = history.find(row => row.id === 'legacy-row');
  assert.equal(legacy.recommendation, 'Manter carga');
  assert.equal(legacy.executionQuality, null);
  assert.equal(legacy.rir, '2');
  const aliased = history.find(row => row.exercise === 'Remada');
  assert.equal(aliased.recommendation, 'Manter carga legacy');
  assert.equal(aliased.executionQuality, null);
}));

test('F4.1 rejects incomplete canonical mutations instead of persisting defaults', () => withStudent(async (db, student) => {
  const response = await request(db, 'POST', '/api/portal/progression', {
    exercise: 'Supino', targetZone: '8–10', loadUsed: 80.5, repsDone: 10, executionQuality: 'Sim',
  }, { student });
  assert.equal(response.status, 400);
  assert.match(response.body.error, /recommendation/);
  assert.equal((await db.prepare('SELECT COUNT(*) total FROM progression_logs').first()).total, 0);
}));

test('F4.1 student UI sends the canonical numeric DTO without decision or RIR', async () => {
  const html = await readFile(new URL('../public/portal-progressao.html', import.meta.url), 'utf8');
  const dto = html.match(/current = \{([\s\S]*?)\n\s*\};/)?.[1] || '';
  assert.match(dto, /executionQuality:/);
  assert.match(dto, /recommendation/);
  assert.match(dto, /loadUsed: Number\(load\.value\)/);
  assert.match(dto, /repsDone: Number\(reps\.value\)/);
  assert.doesNotMatch(dto, /\bdecision\b|\brir\b/);
});
