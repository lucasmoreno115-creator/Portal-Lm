import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import worker from '../workers/api.js';

class SqliteD1 {
  constructor(file) { this.file = file; }
  prepare(sql) { return new SqliteD1Statement(this.file, sql); }
  async batch(statements) { const results = []; for (const statement of statements) results.push(await statement.run()); return results; }
}

class SqliteD1Statement {
  constructor(file, sql, params = []) { this.file = file; this.sql = sql; this.params = params; }
  bind(...params) { return new SqliteD1Statement(this.file, this.sql, params); }
  sqlWithParams() { let index = 0; return this.sql.replace(/\?/g, () => sqlValue(this.params[index++])); }
  async run() { execFileSync('sqlite3', [this.file], { input: this.sqlWithParams() + ';' }); return { meta: { changes: 1 } }; }
  async all() {
    const out = execFileSync('sqlite3', ['-json', this.file, this.sqlWithParams()], { encoding: 'utf8' }).trim();
    return { results: out ? JSON.parse(out) : [] };
  }
  async first() { const { results } = await this.all(); return results[0] ?? null; }
}

function sqlValue(value) {
  if (value == null) return 'NULL';
  if (typeof value === 'number') return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
}

async function withDb(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'portal-lm-durable-admin-'));
  const db = new SqliteD1(join(dir, 'test.db'));
  try {
    await worker.fetch(new Request('https://portal.test/api/health'), { DB: db, ADMIN_TOKEN: 'admin-token', ADMIN_SESSION_SECRET: 'admin-session-secret' });
    await fn(db);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function jsonResponse(response) {
  return { status: response.status, body: await response.json() };
}

test('signed admin login in instance A authorizes Workspace POST and GET in instance B without exposing ADMIN_TOKEN', async () => withDb(async (db) => {
  const env = { DB: db, ADMIN_TOKEN: 'admin-token', ADMIN_SESSION_SECRET: 'admin-session-secret', PREMIUM_PROFESSIONAL_WORKSPACE_ENABLED: 'true' };
  const loginRequest = new Request('https://portal.test/api/admin/session/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: env.ADMIN_TOKEN })
  });
  const login = await jsonResponse(await worker.fetch(loginRequest, env));
  assert.equal(login.status, 200);
  assert.equal(login.body.ok, true);
  const sessionId = login.body.data.session_id;
  assert.ok(sessionId);
  assert.equal(JSON.stringify(login.body).includes(env.ADMIN_TOKEN), false);

  const [encodedPayload] = sessionId.split('.');
  const decodedPayload = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(encodedPayload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(encodedPayload.length / 4) * 4, '=')), (char) => char.charCodeAt(0))));
  assert.equal(JSON.stringify(decodedPayload).includes(env.ADMIN_TOKEN), false);

  const instanceB = await import(`../workers/api.js?durable_admin_instance=${Date.now()}`);
  const postRequest = new Request('https://portal.test/api/admin/premium/workspace/students', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-admin-session': sessionId },
    body: JSON.stringify({ name: 'Durable Admin', email: 'durable-admin@example.com', whatsapp: '11999999999', planType: 'PREMIUM' })
  });
  const created = await jsonResponse(await instanceB.default.fetch(postRequest, env));
  assert.equal(created.status, 201);
  assert.equal(created.body.ok, true);
  assert.equal(created.body.data.email, 'durable-admin@example.com');
  assert.equal(JSON.stringify(created.body).includes(env.ADMIN_TOKEN), false);

  const getRequest = new Request('https://portal.test/api/admin/premium/workspace/students?limit=25', {
    headers: { 'x-admin-session': sessionId }
  });
  const listed = await jsonResponse(await instanceB.default.fetch(getRequest, env));
  assert.equal(listed.status, 200);
  assert.equal(listed.body.ok, true);
  assert.ok(listed.body.data.items.some((item) => item.email === 'durable-admin@example.com'));
  assert.equal(JSON.stringify(listed.body).includes(env.ADMIN_TOKEN), false);

  const count = await db.prepare(`SELECT COUNT(*) AS total FROM premium_students WHERE normalized_email='durable-admin@example.com'`).first();
  assert.equal(count.total, 1);

  const logs = await db.prepare(`SELECT event, message, admin_context, metadata FROM operational_logs`).all();
  assert.equal(JSON.stringify(logs).includes(env.ADMIN_TOKEN), false);
}));

test('Workspace runtime copies stay byte-identical', async () => {
  const rootCopy = await readFile('admin-premium-workspace.js', 'utf8');
  const publicCopy = await readFile('public/admin-premium-workspace.js', 'utf8');
  const assetCopy = await readFile('public/assets/js/admin-premium-workspace.js', 'utf8');
  assert.equal(rootCopy, publicCopy);
  assert.equal(publicCopy, assetCopy);
});

test('admin authorization helpers are not used synchronously', async () => {
  const files = ['workers/api.js', 'workers/services/auth-service.js'];
  for (const file of files) {
    const source = (await readFile(file, 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    assert.doesNotMatch(source, /(?<!await\s+)\bif\s*\(\s*!?\s*isAdminAuthorized\s*\(\s*request\s*,\s*env\s*\)/, `${file} must await admin authorization checks`);
  }
});
