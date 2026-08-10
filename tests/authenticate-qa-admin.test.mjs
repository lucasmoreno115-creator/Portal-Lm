import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { authenticateQaAdmin, persistSession, QaAdminAuthError } from '../scripts/authenticate-qa-admin.mjs';

const secret = 'stable-admin-token';
const session = 'fresh-ephemeral-session';
const response = (status, body) => new Response(typeof body === 'string' ? body : JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json' },
});
const loginBody = { ok: true, data: { session_id: session, expires_at: '2099-01-01T00:00:00.000Z', ttl_seconds: 28800 } };

function successfulFetch(calls = []) {
  return async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/api/admin/session/login')) return response(200, loginBody);
    return response(200, { ok: true, data: {} });
  };
}

async function rejectsCode(fn, code) {
  await assert.rejects(fn, (error) => error instanceof QaAdminAuthError && error.code === code);
}

test('real login contract emits a masked session and proves Workspace HTTP 200', async () => {
  const calls = []; const masks = [];
  const result = await authenticateQaAdmin({ baseUrl: 'https://qa.example/', adminToken: secret, fetchImpl: successfulFetch(calls), mask: value => masks.push(value) });
  assert.equal(result.session, session);
  assert.deepEqual(masks, [secret, session]);
  assert.deepEqual(JSON.parse(calls[0].options.body), { token: secret });
  assert.equal(new URL(calls[1].url).pathname, '/api/admin/premium/workspace/summary');
  assert.equal(calls[1].options.headers['x-admin-session'], session);
  assert.equal(calls[1].options.headers['x-admin-token'], undefined);
  assert.ok(masks.indexOf(session) > -1, 'session is masked before the Workspace request completes');
});

test('invalid credential and any login HTTP 401 fail closed', async () => {
  for (const body of [{ ok: false, error: 'Unauthorized' }, { ok: false }]) {
    await rejectsCode(() => authenticateQaAdmin({ baseUrl: 'https://qa.example', adminToken: secret, fetchImpl: async () => response(401, body) }), 'QA_ADMIN_LOGIN_FAILED');
  }
});

test('missing credentials, missing session, invalid JSON, and timeout are sanitized failures', async () => {
  await rejectsCode(() => authenticateQaAdmin({ baseUrl: '', adminToken: secret }), 'QA_ADMIN_CREDENTIALS_MISSING');
  await rejectsCode(() => authenticateQaAdmin({ baseUrl: 'https://qa.example', adminToken: secret, fetchImpl: async () => response(200, { ok: true, data: {} }) }), 'QA_ADMIN_SESSION_NOT_ISSUED');
  await rejectsCode(() => authenticateQaAdmin({ baseUrl: 'https://qa.example', adminToken: secret, fetchImpl: async () => response(200, '{not-json') }), 'QA_ADMIN_LOGIN_INVALID_RESPONSE');
  await rejectsCode(() => authenticateQaAdmin({ baseUrl: 'https://qa.example', adminToken: secret, fetchImpl: async () => { throw new DOMException('timed out', 'TimeoutError'); } }), 'QA_ADMIN_LOGIN_REQUEST_FAILED');
});

test('Workspace failures are fail-closed and classified without response details', async () => {
  for (const [status, code] of [[401, 'QA_ADMIN_WORKSPACE_UNAUTHORIZED'], [403, 'QA_ADMIN_WORKSPACE_FORBIDDEN'], [404, 'QA_ADMIN_WORKSPACE_REQUEST_FAILED']]) {
    let call = 0;
    const fetchImpl = async () => ++call === 1 ? response(200, loginBody) : response(status, { code: 'sensitive-server-detail' });
    await rejectsCode(() => authenticateQaAdmin({ baseUrl: 'https://qa.example', adminToken: secret, fetchImpl }), code);
  }
  let call = 0;
  const networkFailure = async () => ++call === 1 ? response(200, loginBody) : Promise.reject(new Error('network includes no credentials'));
  await rejectsCode(() => authenticateQaAdmin({ baseUrl: 'https://qa.example', adminToken: secret, fetchImpl: networkFailure }), 'QA_ADMIN_WORKSPACE_REQUEST_FAILED');
});

test('session transfer uses GITHUB_ENV without exposing credentials in stdout or stderr', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'qa-admin-auth-'));
  const githubEnv = join(directory, 'github-env');
  await persistSession(githubEnv, session);
  assert.equal(await readFile(githubEnv, 'utf8'), `QA_ADMIN_SESSION=${session}\n`);

  const logs = [];
  await authenticateQaAdmin({ baseUrl: 'https://qa.example', adminToken: secret, fetchImpl: successfulFetch(), mask: () => logs.push('::add-mask::***') });
  const output = logs.join('\n');
  assert.doesNotMatch(output, new RegExp(secret));
  assert.doesNotMatch(output, new RegExp(session));
});

test('helper is isolated from student and Projeto LM routes', async () => {
  const calls = [];
  await authenticateQaAdmin({ baseUrl: 'https://qa.example', adminToken: secret, fetchImpl: successfulFetch(calls) });
  assert.deepEqual(calls.map(call => new URL(call.url).pathname), ['/api/admin/session/login', '/api/admin/premium/workspace/summary']);
  assert.equal(calls.some(call => /projeto-lm|portal|student|checkin/i.test(new URL(call.url).pathname)), false);
});

test('workflow authenticates before smoke, scopes the stable token, and does not consume a static session secret', async () => {
  const workflow = await readFile('.github/workflows/qa-lm-staging.yml', 'utf8');
  const authStep = workflow.indexOf('- name: Authenticate QA administrator');
  const smokeStep = workflow.indexOf('- name: Execute authenticated staging QA');
  assert.ok(authStep > workflow.indexOf('- name: Wait for preview availability'));
  assert.ok(smokeStep > authStep);
  assert.match(workflow, /Authenticate QA administrator[\s\S]*?QA_ADMIN_TOKEN: \$\{\{ secrets\.QA_ADMIN_TOKEN \}\}[\s\S]*?authenticate-qa-admin\.mjs/);
  assert.doesNotMatch(workflow, /secrets\.QA_ADMIN_SESSION/);
  assert.match(await readFile('scripts/authenticate-qa-admin.mjs', 'utf8'), /::add-mask::\$\{value\}/);
});
