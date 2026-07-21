import assert from 'node:assert/strict';
import test from 'node:test';
import { createRemoteD1Binding, createRemoteD1Client, executeRemoteBackfill, operationFromEnv, parseArguments, validateOperation } from '../scripts/run-premium-student-identity-backfill-remote.mjs';

const env = { CLOUDFLARE_API_TOKEN: 'private-token', CLOUDFLARE_ACCOUNT_ID: 'account-secret', CLOUDFLARE_D1_DATABASE_ID: 'database-secret' };
function response(result = { results: [], meta: { changes: 0 } }, status = 200, extra = {}) { const output = Array.isArray(result) && result.every((item) => item?.success !== undefined) ? result : [result]; return { ok: status >= 200 && status < 300, status, json: async () => ({ success: status < 300, result: output, ...extra }) }; }

test('operation validation fails before API prerequisites for unsafe invocations', () => {
  assert.throws(() => validateOperation({ mode: 'apply' }), /BACKFILL_BATCH_ID_REQUIRED/);
  assert.throws(() => validateOperation({ mode: 'apply', batchId: 'b' }), /APPLY_CONFIRMATION_REQUIRED/);
  assert.throws(() => validateOperation({ mode: 'rollback' }), /BACKFILL_BATCH_ID_REQUIRED/);
  assert.throws(() => validateOperation({ mode: 'rollback', batchId: 'b' }), /ROLLBACK_CONFIRMATION_REQUIRED/);
  assert.deepEqual(parseArguments(['--dry-run']), { mode: 'dry-run', batchId: '' });
  assert.deepEqual(operationFromEnv({ BACKFILL_MODE: 'apply', BACKFILL_BATCH_ID: 'legacy-20260720-01', CONFIRM_APPLY: 'APPLY_LEGACY_PREMIUM_BACKFILL' }).batchId, 'legacy-20260720-01');
});

test('invalid batch identifiers fail before fetch while allowlisted identifiers are accepted', async () => {
  for (const batchId of ['space id', 'x;DROP', 'x&y', 'x|y', 'x$y', 'x\ny', 'x`y']) {
    let calls = 0;
    await assert.rejects(() => executeRemoteBackfill({ mode: 'apply', batchId, confirmApply: 'APPLY_LEGACY_PREMIUM_BACKFILL', env, fetchImpl: async () => { calls += 1; return response(); } }), /INVALID_BACKFILL_BATCH_ID/);
    assert.equal(calls, 0);
  }
  assert.doesNotThrow(() => validateOperation({ mode: 'rollback', batchId: 'legacy-20260720-01', confirmRollback: 'ROLLBACK_LEGACY_PREMIUM_BACKFILL' }));
});

test('remote D1 requests use a parameter array and do not expose token in failures', async () => {
  let request;
  const client = createRemoteD1Client({ token: env.CLOUDFLARE_API_TOKEN, accountId: env.CLOUDFLARE_ACCOUNT_ID, databaseId: env.CLOUDFLARE_D1_DATABASE_ID, fetchImpl: async (_url, options) => { request = options; return response(); } });
  await client.run('SELECT * FROM premium_students WHERE normalized_email = ?', ['person@example.com']);
  assert.deepEqual(JSON.parse(request.body), { sql: 'SELECT * FROM premium_students WHERE normalized_email = ?', params: ['person@example.com'] });
  await assert.rejects(() => createRemoteD1Client({ ...env, token: 'private-token', fetchImpl: async () => response({}, 401, { errors: [{ code: 10000 }] }) }).run('SELECT 1'), (error) => !error.message.includes('private-token') && /401:CF_10000/.test(error.message));
});

for (const status of [403, 500]) test(`HTTP ${status} is sanitized`, async () => {
  await assert.rejects(() => createRemoteD1Client({ ...env, token: 'private-token', fetchImpl: async () => response({}, status, { errors: [{ code: 999 }] }) }).run('SELECT 1'), /CLOUDFLARE_D1_HTTP_ERROR/);
});

test('timeout is sanitized', async () => {
  await assert.rejects(() => createRemoteD1Client({ ...env, fetchImpl: (_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(Object.assign(new Error('abort'), { name: 'AbortError' })))), timeoutMs: 1 }).run('SELECT 1'), /CLOUDFLARE_D1_TIMEOUT/);
});

test('remote batch sends ordered statements in one parameterized request and rejects statement failures', async () => {
  const requests = [];
  const client = createRemoteD1Client({ token: 'private-token', accountId: 'account-secret', databaseId: 'database-secret', fetchImpl: async (_url, options) => { requests.push(JSON.parse(options.body)); return response([{ success: true, meta: { changes: 1 } }, { success: true, meta: { changes: 1 } }]); } });
  const db = createRemoteD1Binding(client);
  const results = await db.batch([db.prepare('UPDATE student_access SET student_id = ? WHERE id = ?').bind('student-1', 'access-1'), db.prepare('INSERT INTO premium_legacy_identity_backfill_audit (id) VALUES (?)').bind('audit-1')]);
  assert.equal(requests.length, 1);
  assert.equal(Array.isArray(requests[0]), false);
  assert.ok(Array.isArray(requests[0].batch));
  assert.deepEqual(requests[0], { batch: [{ sql: 'UPDATE student_access SET student_id = ? WHERE id = ?', params: ['student-1', 'access-1'] }, { sql: 'INSERT INTO premium_legacy_identity_backfill_audit (id) VALUES (?)', params: ['audit-1'] }] });
  assert.equal(results.length, 2);
  await assert.rejects(() => createRemoteD1Client({ token: 'private-token', accountId: 'account-secret', databaseId: 'database-secret', fetchImpl: async () => response([{ success: true }, { success: false }]) }).batch([db.prepare('SELECT 1').bind(), db.prepare('SELECT 2').bind()]), /CLOUDFLARE_D1_BATCH_FAILED/);
});

test('dry run sends SELECT statements only and returns aggregate counts', async () => {
  const sql = [];
  const fetchImpl = async (_url, options) => { sql.push(JSON.parse(options.body).sql); if (sql.at(-1).includes('FROM student_access')) return response({ results: [] }); return response({ results: [] }); };
  const result = await executeRemoteBackfill({ mode: 'dry-run', env, fetchImpl });
  assert.equal(result.mode, 'dry-run');
  assert.equal(result.scanned, 0);
  assert(sql.every((statement) => /^SELECT\b/i.test(statement)));
  assert(sql.every((statement) => !/\b(INSERT|UPDATE|DELETE)\b/i.test(statement)));
});

test('apply performs dry run before writes and aborts on ambiguity', async () => {
  const sql = [];
  const fetchImpl = async (_url, options) => { const statement = JSON.parse(options.body).sql; sql.push(statement); if (statement.includes('FROM student_access')) return response({ results: [{ id: 'a', email: 'a@example.com', status: 'ACTIVE', plan: 'premium' }, { id: 'b', email: 'a@example.com', status: 'ACTIVE', plan: 'premium' }] }); return response({ results: [] }); };
  await assert.rejects(() => executeRemoteBackfill({ mode: 'apply', batchId: 'batch-1', confirmApply: 'APPLY_LEGACY_PREMIUM_BACKFILL', env, fetchImpl }), /BACKFILL_APPLY_BLOCKED/);
  assert(sql.every((statement) => /^SELECT\b/i.test(statement)));
});

test('dry-run returns sanitized restricted blockers while retaining SELECT-only access', async () => {
  const sql = [];
  const email = 'private.student@example.com';
  const fetchImpl = async (_url, options) => {
    const statement = JSON.parse(options.body).sql;
    sql.push(statement);
    if (statement.includes('FROM student_access')) return response({ results: [
      { id: 'premium-access', name: 'Private Student', email, access_token: 'private-token', status: 'ACTIVE', plan: 'premium' },
      { id: 'project-access', name: 'Private Student', email, access_token: 'private-token', status: 'ACTIVE', plan: 'projeto_lm' },
    ] });
    return response({ results: [] });
  };
  const result = await executeRemoteBackfill({ mode: 'dry-run', env, fetchImpl });
  const serialized = JSON.stringify(result.restricted_blockers);
  assert(result.restricted_blockers.some((blocker) => blocker.type === 'MIXED_PRODUCT_ACCESS_FOR_EMAIL'));
  assert(!serialized.includes(email));
  assert(!serialized.includes('Private Student'));
  assert(!serialized.includes('private-token'));
  assert(sql.every((statement) => /^SELECT\b/i.test(statement)));
});
