import assert from 'node:assert/strict';
import test from 'node:test';
import { createRemoteD1Client, executeRemoteBackfill, parseArguments, validateOperation } from '../scripts/run-premium-student-identity-backfill-remote.mjs';

const env = { CLOUDFLARE_API_TOKEN: 'private-token', CLOUDFLARE_ACCOUNT_ID: 'account-secret', CLOUDFLARE_D1_DATABASE_ID: 'database-secret' };
function response(result = { results: [], meta: { changes: 0 } }, status = 200, extra = {}) { return { ok: status >= 200 && status < 300, status, json: async () => ({ success: status < 300, result: [result], ...extra }) }; }

test('operation validation fails before API prerequisites for unsafe invocations', () => {
  assert.throws(() => validateOperation({ mode: 'apply' }), /BACKFILL_BATCH_ID_REQUIRED/);
  assert.throws(() => validateOperation({ mode: 'apply', batchId: 'b' }), /APPLY_CONFIRMATION_REQUIRED/);
  assert.throws(() => validateOperation({ mode: 'rollback' }), /BACKFILL_BATCH_ID_REQUIRED/);
  assert.throws(() => validateOperation({ mode: 'rollback', batchId: 'b' }), /ROLLBACK_CONFIRMATION_REQUIRED/);
  assert.deepEqual(parseArguments(['--dry-run']), { mode: 'dry-run', batchId: '' });
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
