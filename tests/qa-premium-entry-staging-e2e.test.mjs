import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import {
  ANAMNESIS_ROUTE, reportIsSanitized, routeForPremiumAccess, runPremiumEntrySmoke,
  uniqueQaIdentity, validateCreation, validatePremiumEntryCalls,
} from '../scripts/qa-premium-entry-staging-e2e.mjs';

const env = { QA_BASE_URL: 'https://preview-123.example.test', QA_TARGET_ENVIRONMENT: 'staging', QA_ADMIN_SESSION: 'admin-secret', GITHUB_RUN_ID: '42', GITHUB_RUN_ATTEMPT: '1' };
const secret = 'dynamic-access-secret';
const response = (status, payload) => ({ ok: [200, 201, 401].includes(status), status, responseBody: JSON.stringify(payload), durationMs: 2 });

function successfulApi(overrides = {}) {
  const calls = [];
  const requestFn = async (path, options = {}) => {
    calls.push({ path, options });
    const email = options.body?.email;
    if (path === '/api/admin/premium/workspace/students') return response(201, { ok: true, data: { studentId: 'opaque-student-1', name: 'QA Premium Entry', email, status: 'AWAITING_ANAMNESIS', accessLink: `${env.QA_BASE_URL}/portal-login.html`, token: secret, ...overrides } });
    if (path === '/api/portal/login' && (email?.startsWith('wrong-') || options.body?.token !== secret)) return response(401, { ok: false });
    if (path === '/api/portal/login') return response(200, { ok: true, data: { email, plan: 'premium', planType: 'PREMIUM' } });
    return response(200, { ok: true, data: { experience: 'ONBOARDING', consultationStatus: overrides.status || 'AWAITING_ANAMNESIS', primaryAction: { type: 'OPEN_ANAMNESIS', href: ANAMNESIS_ROUTE } } });
  };
  return { calls, requestFn };
}

test('valid creation/access/login/lifecycle is validated and masks the dynamic secret', async () => {
  const api = successfulApi(); const masked = [];
  const report = await runPremiumEntrySmoke({ env, requestFn: api.requestFn, mask: value => masked.push(value) });
  assert.equal(report.status, 'VALIDATED');
  assert.deepEqual(masked, [secret]);
  assert.equal(reportIsSanitized(report, [secret, env.QA_ADMIN_SESSION]), true);
  assert.equal(api.calls[0].path, '/api/admin/premium/workspace/students');
});

test('creation fails closed without canonical student id', () => {
  assert.equal(validateCreation({ ok: true, data: { email: 'a@example.test', status: 'NEW', accessLink: 'https://x/portal-login.html', token: 'x' } }, 'a@example.test').code, 'CREATE_STUDENT_ID_MISSING');
});

test('creation fails closed on returned identity mismatch', () => {
  assert.equal(validateCreation({ ok: true, data: { studentId: '1', email: 'b@example.test', status: 'NEW', accessLink: 'https://x/portal-login.html', token: 'x' } }, 'a@example.test').code, 'CREATE_IDENTITY_MISMATCH');
});

test('creation fails closed without a usable credential', () => {
  assert.equal(validateCreation({ ok: true, data: { studentId: '1', email: 'a@example.test', status: 'NEW', accessLink: 'https://x/portal-login.html' } }, 'a@example.test').code, 'CREATE_ACCESS_UNAVAILABLE');
});

test('NEW and AWAITING_ANAMNESIS route to anamnesis while existing states remain unchanged', () => {
  assert.equal(routeForPremiumAccess({ experience: 'ONBOARDING', consultationStatus: 'NEW' }), ANAMNESIS_ROUTE);
  assert.equal(routeForPremiumAccess({ experience: 'ONBOARDING', consultationStatus: 'AWAITING_ANAMNESIS' }), ANAMNESIS_ROUTE);
  assert.equal(routeForPremiumAccess({ experience: 'ONBOARDING', consultationStatus: 'UNDER_REVIEW' }), '/portal-premium-onboarding.html');
  assert.equal(routeForPremiumAccess({ experience: 'PREMIUM_PORTAL', consultationStatus: 'ACTIVE' }), '/portal-premium-home.html');
});

test('invalid login evidence is required and a valid login mismatch fails closed', async () => {
  const api = successfulApi();
  const original = api.requestFn;
  api.requestFn = async (path, options) => path === '/api/portal/login' && options.body?.token === secret
    ? response(200, { ok: true, data: { email: 'another@example.test', plan: 'premium' } }) : original(path, options);
  const report = await runPremiumEntrySmoke({ env, requestFn: api.requestFn });
  assert.equal(report.status, 'NOT_VALIDATED');
  assert.ok(report.rows.some(row => row.flow === 'student-login' && row.status === 'FAILED'));
});

test('operational flow never writes to Projeto LM', async () => {
  const api = successfulApi();
  const report = await runPremiumEntrySmoke({ env, requestFn: api.requestFn });
  assert.ok(report.rows.some(row => row.flow === 'project-lm-isolation' && row.evidence.unexpectedCalls === 0));
  assert.deepEqual(api.calls.map(call => `${call.options.method || 'GET'} ${call.path}`), [
    'POST /api/admin/premium/workspace/students',
    'POST /api/portal/login', 'POST /api/portal/login', 'POST /api/portal/login',
    'GET /api/portal/premium/access-state',
  ]);
});

test('isolation allowlist rejects Projeto LM, LM2 and shared daily-checkin routes', () => {
  const forbidden = [
    { method: 'POST', path: '/api/project-lm/victories' },
    { method: 'POST', path: '/api/project-lm-2/checkin' },
    { method: 'POST', path: '/api/portal/project-lm/daily-actions' },
    { method: 'POST', path: '/api/portal/checkin' },
  ];
  assert.equal(validatePremiumEntryCalls(forbidden).ok, false);
  assert.equal(validatePremiumEntryCalls([
    { method: 'POST', path: '/api/admin/premium/workspace/students' },
    { method: 'POST', path: '/api/portal/login' },
    { method: 'GET', path: '/api/portal/premium/access-state' },
  ]).ok, true);
});

test('workflow tee steps preserve smoke failures with bash pipefail', async () => {
  const workflow = await readFile('.github/workflows/qa-lm-staging.yml', 'utf8');
  for (const command of ['npm run qa:lm:sprint7', 'npm run qa:lm:premium-entry']) {
    const escaped = command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(workflow, new RegExp(`shell: bash[\\s\\S]{0,80}set -o pipefail\\n\\s+${escaped} \\| tee`));
  }
});

test('NOT_VALIDATED exits non-zero and remains a failed bash pipefail pipeline with tee', async () => {
  const child = spawn('bash', ['-o', 'pipefail', '-c', 'node scripts/qa-premium-entry-staging-e2e.mjs | tee /dev/null'], {
    cwd: process.cwd(), env: { ...process.env, QA_BASE_URL: env.QA_BASE_URL, QA_TARGET_ENVIRONMENT: 'staging', QA_ADMIN_SESSION: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = ''; child.stdout.setEncoding('utf8'); child.stdout.on('data', chunk => { stdout += chunk; });
  const [code] = await once(child, 'exit');
  assert.equal(code, 1);
  assert.match(stdout, /"status": "NOT_VALIDATED"/);
});

test('report contains no password, token, session, authorization, email, or dynamic secret', async () => {
  const report = await runPremiumEntrySmoke({ env, requestFn: successfulApi().requestFn });
  const serialized = JSON.stringify(report);
  assert.doesNotMatch(serialized, /password|senha|token|session|authorization|@example\.test/i);
  assert.doesNotMatch(serialized, new RegExp(secret));
});

test('two executions generate distinct unambiguous identities', () => {
  const first = uniqueQaIdentity({ now: 1, runId: '42', attempt: '1' });
  const second = uniqueQaIdentity({ now: 2, runId: '42', attempt: '1' });
  assert.notEqual(first, second);
  assert.match(first, /^qa-premium-entry\+[a-z0-9-]+@example\.test$/);
});

test('production and targets without explicit staging declaration are rejected before writes', async () => {
  for (const unsafe of [{ ...env, QA_TARGET_ENVIRONMENT: '' }, { ...env, QA_BASE_URL: 'https://portal.lucasmorenopersonal.com.br' }]) {
    let called = false;
    const report = await runPremiumEntrySmoke({ env: unsafe, requestFn: async () => { called = true; } });
    assert.equal(report.status, 'NOT_VALIDATED'); assert.equal(called, false);
  }
});
