#!/usr/bin/env node
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { request } from './qa-sprint7-staging-e2e.mjs';

const PRODUCTION_HOSTS = new Set(['portal.lucasmorenopersonal.com.br']);
const SECRET_KEY = /password|senha|token|session|authorization/i;
export const ANAMNESIS_ROUTE = '/anamnese-premium.html';
const PREMIUM_ENTRY_CALLS = new Set([
  'POST /api/admin/premium/workspace/students',
  'POST /api/portal/login',
  'GET /api/portal/premium/access-state',
]);

export function routeForPremiumAccess(state) {
  if (state?.experience === 'PREMIUM_PORTAL') return '/portal-premium-home.html';
  if (['NEW', 'AWAITING_ANAMNESIS'].includes(state?.consultationStatus)) return ANAMNESIS_ROUTE;
  return '/portal-premium-onboarding.html';
}

export function uniqueQaIdentity({ now = Date.now(), runId = process.env.GITHUB_RUN_ID, attempt = process.env.GITHUB_RUN_ATTEMPT } = {}) {
  const suffix = [runId, attempt, now].filter(Boolean).join('-').replace(/[^a-zA-Z0-9-]/g, '');
  return `qa-premium-entry+${suffix}@example.test`.toLowerCase();
}

function json(result) {
  try { return JSON.parse(result.responseBody || ''); } catch { return null; }
}

function safeEvidence(value) {
  if (Array.isArray(value)) return value.map(safeEvidence);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !SECRET_KEY.test(key)).map(([key, item]) => [key, safeEvidence(item)]));
}

export function reportIsSanitized(report, secrets = []) {
  const serialized = JSON.stringify(report);
  return !SECRET_KEY.test(serialized) && secrets.every(secret => !secret || !serialized.includes(secret));
}

// An allowlist is intentionally stronger than trying to enumerate Projeto LM:
// it also blocks /api/portal/project-lm/*, LM2 and shared daily-checkin routes.
export function validatePremiumEntryCalls(calls) {
  const unexpected = calls.filter(({ path, method = 'GET' }) => !PREMIUM_ENTRY_CALLS.has(`${method} ${path}`));
  return { ok: unexpected.length === 0, unexpected: unexpected.map(({ path, method = 'GET' }) => `${method} ${path}`) };
}

export function validateCreation(payload, requestedEmail) {
  const data = payload?.ok === true && payload?.data && typeof payload.data === 'object' ? payload.data : null;
  if (!data) return { ok: false, code: 'CREATE_INVALID_RESPONSE' };
  if (!String(data.studentId || '').trim()) return { ok: false, code: 'CREATE_STUDENT_ID_MISSING' };
  if (String(data.email || '').trim().toLowerCase() !== requestedEmail) return { ok: false, code: 'CREATE_IDENTITY_MISMATCH' };
  if (!['NEW', 'AWAITING_ANAMNESIS'].includes(data.status)) return { ok: false, code: 'CREATE_LIFECYCLE_INVALID' };
  if (String(data.accessLink || '').trim() === '' || String(data.token || '').trim() === '') return { ok: false, code: 'CREATE_ACCESS_UNAVAILABLE' };
  return { ok: true, data };
}

function stagingTarget(env, baseUrl) {
  try {
    const url = new URL(baseUrl);
    return env.QA_TARGET_ENVIRONMENT === 'staging' && url.protocol === 'https:' && !PRODUCTION_HOSTS.has(url.hostname.toLowerCase());
  } catch { return false; }
}

export async function runPremiumEntrySmoke({ env = process.env, requestFn, mask = () => {} } = {}) {
  const startedAt = Date.now();
  const baseUrl = String(env.QA_BASE_URL || '').trim().replace(/\/+$/, '');
  const rows = [];
  const calls = [];
  const add = (flow, expected, evidence, status) => rows.push({ flow, expected, evidence: safeEvidence(evidence), status });
  const perform = requestFn || ((path, options) => request(baseUrl, path, options));
  const call = async (path, options) => { calls.push({ path, method: options?.method || 'GET' }); return perform(path, options); };

  if (!stagingTarget(env, baseUrl) || !env.QA_ADMIN_SESSION) {
    add('configuration', 'staging explícito, HTTPS, fora do host de produção e sessão admin', { code: 'UNSAFE_OR_INCOMPLETE_TARGET' }, 'FAILED');
    return finish(rows, startedAt);
  }

  const email = uniqueQaIdentity({ runId: env.GITHUB_RUN_ID, attempt: env.GITHUB_RUN_ATTEMPT });
  const created = await call('/api/admin/premium/workspace/students', {
    method: 'POST', headers: { 'x-admin-session': env.QA_ADMIN_SESSION }, expectedStatus: [200, 201],
    body: { name: 'QA Premium Entry', email },
  });
  const creation = validateCreation(json(created), email);
  if (!created.ok || !creation.ok) {
    add('create-student', 'aluno Premium identificado canonicamente', { httpStatus: created.status, code: creation.code || 'CREATE_HTTP_FAILED', durationMs: created.durationMs }, 'FAILED');
    return finish(rows, startedAt);
  }

  const { studentId, status: lifecycle, token, accessLink } = creation.data;
  mask(token);
  add('create-student', 'aluno Premium identificado canonicamente', { httpStatus: created.status, studentId, lifecycle, durationMs: created.durationMs }, 'PASSED');
  const accessUrl = new URL(accessLink, baseUrl);
  const accessOk = accessUrl.origin === new URL(baseUrl).origin && accessUrl.pathname === '/portal-login.html';
  add('initial-access', 'credencial utilizável e login do mesmo staging', { httpStatus: created.status, code: accessOk ? 'ACCESS_CAPTURED_IN_MEMORY' : 'ACCESS_LINK_MISMATCH' }, accessOk ? 'PASSED' : 'FAILED');
  if (!accessOk) return finish(rows, startedAt, [token]);

  const invalidEmail = await call('/api/portal/login', { method: 'POST', expectedStatus: [401], body: { email: `wrong-${email}`, token } });
  const invalidToken = await call('/api/portal/login', { method: 'POST', expectedStatus: [401], body: { email, token: `${token}-invalid` } });
  add('negative-login', 'email e credencial incorretos são recusados', { emailHttpStatus: invalidEmail.status, credentialHttpStatus: invalidToken.status }, invalidEmail.ok && invalidToken.ok ? 'PASSED' : 'FAILED');

  const login = await call('/api/portal/login', { method: 'POST', expectedStatus: [200], body: { email, token } });
  const loginData = json(login)?.data;
  const loginOk = login.ok && String(loginData?.email || '').toLowerCase() === email && loginData?.plan === 'premium';
  add('student-login', 'identidade exata autentica no produto Premium', { httpStatus: login.status, code: loginOk ? 'IDENTITY_AUTHENTICATED' : 'LOGIN_CONTRACT_MISMATCH' }, loginOk ? 'PASSED' : 'FAILED');
  if (!loginOk) return finish(rows, startedAt, [token]);

  const stateResult = await call('/api/portal/premium/access-state', { headers: { 'x-student-email': email, 'x-student-token': token }, expectedStatus: [200] });
  const state = json(stateResult)?.data;
  const route = routeForPremiumAccess(state);
  const lifecycleOk = stateResult.ok && state?.consultationStatus === lifecycle && route === ANAMNESIS_ROUTE && state?.primaryAction?.href === ANAMNESIS_ROUTE;
  add('lifecycle-routing', 'lifecycle criado decide pela anamnese Premium', { httpStatus: stateResult.status, lifecycle: state?.consultationStatus || null, finalRoute: route }, lifecycleOk ? 'PASSED' : 'FAILED');

  const isolation = validatePremiumEntryCalls(calls);
  add('project-lm-isolation', 'somente rotas F1.5 Premium/admin/portal', { unexpectedCalls: isolation.unexpected.length }, isolation.ok ? 'PASSED' : 'FAILED');
  return finish(rows, startedAt, [token]);
}

function finish(rows, startedAt, secrets = []) {
  const report = { flow: 'Premium entry', environment: 'staging', status: rows.some(row => row.status === 'FAILED') ? 'NOT_VALIDATED' : 'VALIDATED', durationMs: Date.now() - startedAt, columns: ['Fluxo', 'Resultado esperado', 'Evidência', 'Status'], rows };
  if (!reportIsSanitized(report, secrets)) throw new Error('REPORT_SECRET_LEAK');
  return report;
}

async function main() {
  const report = await runPremiumEntrySmoke({ mask: value => process.stdout.write(`::add-mask::${value}\n`) });
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.status === 'VALIDATED' ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
