import assert from 'node:assert/strict';
import { SqliteD1 } from './helpers/sqlite-d1.mjs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import worker, { initializeSchemaForTests } from '../workers/api.js';
import { createPortalNotification, PORTAL_NOTIFICATION_TYPES, PortalNotificationValidationError } from '../workers/services/portal-notification-service.js';

async function fixture(run) {
  const directory = await mkdtemp(join(tmpdir(), 'notification-engine-'));
  const db = new SqliteD1(join(directory, 'test.db'));
  let testError;
  try {
    await initializeSchemaForTests(db);
    for (const [id, email, token] of [['student-1', 'one@example.com', 'token-one'], ['student-2', 'two@example.com', 'token-two']]) {
      await db.prepare(`INSERT INTO student_access (id,name,email,access_token,status,plan_type,plan,student_id,created_at) VALUES (?,?,?,?, 'ACTIVE','PREMIUM','premium',?,?)`)
        .bind(`access-${id}`, id, email, token, id, '2026-07-24T00:00:00.000Z').run();
      await db.prepare(`INSERT INTO premium_students (student_id,email,normalized_email,display_name,consultation_status,access_status,source,created_at,updated_at) VALUES (?,?,?,?, 'ACTIVE','ACTIVE','TEST',?,?)`)
        .bind(id, email, email, id, '2026-07-24T00:00:00.000Z', '2026-07-24T00:00:00.000Z').run();
    }
    await run(db);
  } catch (error) {
    testError = error;
    throw error;
  } finally {
    try { db.close(); } catch (closeError) { if (!testError) throw closeError; }
    await rm(directory, { recursive: true, force: true });
  }
}

const input = (studentId = 'student-1', overrides = {}) => ({
  student_id: studentId,
  student_email: studentId === 'student-1' ? 'one@example.com' : 'two@example.com',
  type: PORTAL_NOTIFICATION_TYPES.COACH_REPLY,
  title: 'Resposta disponível',
  body: 'Seu coach respondeu ao check-in.',
  action_url: '/portal-checkin.html',
  reference_key: 'checkin-42',
  ...overrides,
});

async function portal(db, student, method, path) {
  const response = await worker.fetch(new Request(`https://portal.test${path}`, { method, headers: { 'x-student-email': student === 1 ? 'one@example.com' : 'two@example.com', 'x-student-token': student === 1 ? 'token-one' : 'token-two' } }), { DB: db, ADMIN_TOKEN: 'admin-token' });
  return { status: response.status, body: await response.json() };
}
async function admin(db, studentId, body) {
  const response = await worker.fetch(new Request(`https://portal.test/api/admin/premium/students/${studentId}/notifications`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-admin-token': 'admin-token' }, body: JSON.stringify(body) }), { DB: db, ADMIN_TOKEN: 'admin-token' });
  return { status: response.status, body: await response.json() };
}

test('criação válida normaliza, persiste UNREAD e aplica idempotência por aluno/tipo/referência', () => fixture(async (db) => {
  const first = await createPortalNotification({ DB: db }, input());
  const duplicate = await createPortalNotification({ DB: db }, input('student-1', { title: 'Não substitui' }));
  assert.equal(first.id, duplicate.id);
  assert.equal(first.status, 'UNREAD');
  assert.equal(first.student_email, 'one@example.com');
  assert.equal((await db.prepare('SELECT COUNT(*) count FROM portal_notifications').first()).count, 1);
}));

test('valida tipo, título, body e protege action_url', () => fixture(async (db) => {
  for (const overrides of [{ type: 'OTHER' }, { title: ' ' }, { body: '' }, { action_url: '//evil.test' }, { action_url: 'https://evil.test' }, { action_url: 'javascript:alert(1)' }]) {
    await assert.rejects(() => createPortalNotification({ DB: db }, input('student-1', overrides)), PortalNotificationValidationError);
  }
}));

test('isola alunos, lista em ordem, conta e lê individualmente e em lote', () => fixture(async (db) => {
  const one = await createPortalNotification({ DB: db }, input());
  await createPortalNotification({ DB: db }, input('student-1', { type: PORTAL_NOTIFICATION_TYPES.CUSTOM, reference_key: null, title: 'Mais nova' }));
  await createPortalNotification({ DB: db }, input('student-2'));

  const listed = await portal(db, 1, 'GET', '/api/portal/notifications?limit=1');
  assert.equal(listed.status, 200);
  assert.equal(listed.body.data.items.length, 1);
  assert.equal(listed.body.data.pagination.has_more, true);
  assert.deepEqual(Object.keys(listed.body.data.items[0]), ['id', 'type', 'title', 'body', 'action_url', 'status', 'created_at', 'read_at']);
  assert.equal(JSON.stringify(listed.body).includes('student_email'), false);
  assert.equal((await portal(db, 1, 'GET', '/api/portal/notifications/unread-count')).body.data.count, 2);
  assert.equal((await portal(db, 2, 'PATCH', `/api/portal/notifications/${one.id}/read`)).status, 404);
  assert.equal((await portal(db, 1, 'PATCH', `/api/portal/notifications/${one.id}/read`)).body.data.status, 'READ');
  assert.equal((await portal(db, 1, 'PATCH', '/api/portal/notifications/read-all')).body.data.updated, 1);
  assert.equal((await portal(db, 1, 'GET', '/api/portal/notifications/unread-count')).body.data.count, 0);
  assert.equal((await portal(db, 2, 'GET', '/api/portal/notifications/unread-count')).body.data.count, 1);
}));

test('endpoint administrativo autentica, deriva identidade e reutiliza o serviço', () => fixture(async (db) => {
  const created = await admin(db, 'student-1', input('student-2'));
  assert.equal(created.status, 201);
  assert.equal(created.body.data.notification.status, 'UNREAD');
  assert.deepEqual(created.body.data.delivery, { subscriptions: 0, sent: 0, failed: 0, expired: 0, deduplicated: 0 });
  assert.equal(JSON.stringify(created.body).includes('student_id'), false);
  assert.equal(JSON.stringify(created.body).includes('VAPID_PRIVATE_KEY'), false);
  const persisted = await db.prepare('SELECT student_id, student_email FROM portal_notifications WHERE id=?').bind(created.body.data.notification.id).first();
  assert.deepEqual(persisted, { student_id: 'student-1', student_email: 'one@example.com' });
  assert.equal((await admin(db, 'missing', input())).status, 404);
}));

test('Web Push permanece canal separado da fonte oficial e tem listeners seguros', async () => {
  const [pushService, serviceWorker, migration] = await Promise.all([
    readFile('workers/services/portal-push-delivery-service.js', 'utf8'),
    readFile('public/sw.js', 'utf8'),
    readFile('migrations/0040_create_portal_push_deliveries.sql', 'utf8'),
  ]);
  assert.match(pushService, /WHERE student_id=\? AND status='ACTIVE'/);
  assert.doesNotMatch(pushService, /UPDATE portal_notifications|read_at/);
  assert.match(serviceWorker, /addEventListener\('push'/);
  assert.match(serviceWorker, /addEventListener\('notificationclick'/);
  assert.match(serviceWorker, /showNotification/);
  assert.match(migration, /UNIQUE\(notification_id, subscription_id\)/);
});
