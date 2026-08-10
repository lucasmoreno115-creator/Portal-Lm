#!/usr/bin/env node
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { request } from './qa-sprint7-staging-e2e.mjs';
import { ANAMNESIS_ROUTE, routeForPremiumAccess, uniqueQaIdentity, validateCreation } from './qa-premium-entry-staging-e2e.mjs';

export const PREMIUM_ANAMNESIS_CALLS = new Set([
  'POST /api/admin/premium/workspace/students', 'POST /api/portal/login',
  'GET /api/portal/premium/access-state', 'POST /api/anamnese-premium',
  'GET /api/admin/premium/students/:studentId/record',
]);
const productionHosts = new Set(['portal.lucasmorenopersonal.com.br']);

function parse(result) { try { return JSON.parse(result.responseBody || ''); } catch { return null; } }
function staging(env, base) { try { const u = new URL(base); return env.QA_TARGET_ENVIRONMENT === 'staging' && u.protocol === 'https:' && !productionHosts.has(u.hostname.toLowerCase()); } catch { return false; } }
function canonicalCall(method, path) { return /^\/api\/admin\/premium\/students\/[^/]+\/record$/.test(path) ? `${method} /api/admin/premium/students/:studentId/record` : `${method} ${path}`; }
export function validatePremiumAnamnesisCalls(calls) { const unexpected = calls.map(x => canonicalCall(x.method || 'GET', x.path)).filter(x => !PREMIUM_ANAMNESIS_CALLS.has(x)); return { ok: !unexpected.length, unexpected }; }

export function createQaAnswers(marker) {
  return { version: 'LM_V2_2', personal: { birth_date: '1995-01-15', sex: 'NAO_INFORMAR', height: '170', weight: '70' }, objectives: { main_goal: 'QA F1.6 objetivo', current_pain: marker, importance: 'Alta', life_change: 'Validação sintética' }, training: { currently_trains: 'Sim', time_training: '1 ano', days_per_week: '3', where: 'Academia', best_time: 'Manhã', cardio: '2 vezes', injuries_pain: 'Nenhuma' }, nutrition: { meals_per_day: '4', defined_schedule: 'Sim', self_evaluation: 'Regular', hardest_meal: 'Jantar', hunger_peak: 'Tarde', off_plan_frequency: '1 vez', weighs_food: 'Não', stress_eating: 'Não', binge_episodes: 'Não', biggest_difficulty: 'Organização', restrictions: 'Nenhuma' }, recovery: { sleep_hours: '8', sleep_quality: 'Boa', daily_energy: 8, stress_level: 2, wakes_rested: 'Sim' }, observations: { final_notes: marker }, metadata: { source: 'authenticated-premium-anamnesis', form_version: 'LM_V2_2' } };
}
export function validateSubmit(result, payload) { const body = parse(result); return { ok: result.ok && result.status === 200 && body?.ok === true && body?.data && typeof body.data.id === 'string' && body.data.id.length > 0 && body.data.alreadySubmitted === false, id: body?.data?.id || null }; }
export function validateRecord(payload, { studentId, anamnesisId, marker }) {
  const data = payload?.ok === true ? payload.data : null, student = data?.student, anamnesis = data?.anamnesis;
  const markerPresent = JSON.stringify(anamnesis?.report || {}).includes(marker);
  return { ok: student?.student_id === studentId && anamnesis?.student_id === studentId && anamnesis?.id === anamnesisId && Boolean(anamnesis?.created_at) && markerPresent, recordStudentId: student?.student_id || null, anamnesisStudentId: anamnesis?.student_id || null, submittedAt: anamnesis?.created_at || null, markerPresent };
}

export async function runPremiumAnamnesisSmoke({ env = process.env, requestFn, mask = () => {} } = {}) {
  const startedAt = Date.now(), rows = [], calls = [], base = String(env.QA_BASE_URL || '').trim().replace(/\/+$/, '');
  const add = (flow, expected, evidence, status) => rows.push({ flow, expected, evidence, status });
  const perform = requestFn || ((path, options) => request(base, path, options));
  const call = async (path, options = {}) => { calls.push({ path, method: options.method || 'GET' }); return perform(path, options); };
  const finish = () => { const isolation = validatePremiumAnamnesisCalls(calls); add('project-lm-isolation', 'somente endpoints Premium necessários', { unexpectedCalls: isolation.unexpected.length }, isolation.ok ? 'PASSED' : 'FAILED'); return { flow: 'Premium anamnesis', environment: 'staging', status: rows.every(x => x.status === 'PASSED') ? 'VALIDATED' : 'NOT_VALIDATED', durationMs: Date.now() - startedAt, columns: ['Fluxo', 'Resultado esperado', 'Evidência', 'Status'], rows }; };
  if (!staging(env, base) || !env.QA_ADMIN_SESSION) { add('fixture-entry', 'staging seguro e sessão administrativa', { code: 'UNSAFE_OR_INCOMPLETE_TARGET' }, 'FAILED'); return finish(); }
  mask(env.QA_ADMIN_SESSION);
  const email = uniqueQaIdentity({ runId: `${env.GITHUB_RUN_ID || 'local'}-anamnesis`, attempt: env.GITHUB_RUN_ATTEMPT }); mask(email);
  const created = await call('/api/admin/premium/workspace/students', { method: 'POST', headers: { 'x-admin-session': env.QA_ADMIN_SESSION }, expectedStatus: [200, 201], body: { name: 'QA Premium Anamnesis', email } });
  const creation = validateCreation(parse(created), email);
  if (!created.ok || !creation.ok) { add('fixture-entry', 'fixture Premium canônica em onboarding', { httpStatus: created.status, code: creation.code || 'CREATE_HTTP_FAILED' }, 'FAILED'); return finish(); }
  const { studentId, token } = creation.data; mask(token);
  add('fixture-entry', 'fixture Premium canônica em onboarding', { httpStatus: created.status, studentId }, 'PASSED');
  const login = await call('/api/portal/login', { method: 'POST', expectedStatus: [200], body: { email, token } });
  const loginData = parse(login)?.data;
  if (!login.ok || loginData?.email?.toLowerCase() !== email || loginData?.plan !== 'premium') { add('pre-anamnesis-state', 'login e lifecycle AWAITING_ANAMNESIS', { httpStatus: login.status, code: 'LOGIN_FAILED' }, 'FAILED'); return finish(); }
  const studentHeaders = { 'x-student-email': email, 'x-student-token': token };
  const beforeResult = await call('/api/portal/premium/access-state', { headers: studentHeaders, expectedStatus: [200] }), before = parse(beforeResult)?.data;
  const beforeOk = beforeResult.ok && before?.consultationStatus === 'AWAITING_ANAMNESIS' && routeForPremiumAccess(before) === ANAMNESIS_ROUTE && before?.primaryAction?.href === ANAMNESIS_ROUTE;
  add('pre-anamnesis-state', 'AWAITING_ANAMNESIS direciona à anamnese', { httpStatus: beforeResult.status, lifecycle: before?.consultationStatus || null }, beforeOk ? 'PASSED' : 'FAILED');
  if (!beforeOk) return finish();
  const marker = `QA-F1.6-${env.GITHUB_RUN_ID || Date.now()}-${env.GITHUB_RUN_ATTEMPT || '1'}`;
  const submitted = await call('/api/anamnese-premium', { method: 'POST', headers: studentHeaders, expectedStatus: [200], body: { answers: createQaAnswers(marker) } }), submit = validateSubmit(submitted);
  add('anamnesis-submit', 'HTTP 200, ok true e novo registro', { httpStatus: submitted.status, anamnesisId: submit.id, marker }, submit.ok ? 'PASSED' : 'FAILED');
  if (!submit.ok) return finish();
  const afterResult = await call('/api/portal/premium/access-state', { headers: studentHeaders, expectedStatus: [200] }), after = parse(afterResult)?.data;
  const afterOk = afterResult.ok && after?.consultationStatus === 'UNDER_REVIEW' && after?.primaryAction == null && routeForPremiumAccess(after) === '/portal-premium-onboarding.html';
  add('lifecycle-transition', 'UNDER_REVIEW sem CTA de anamnese', { httpStatus: afterResult.status, before: before.consultationStatus, after: after?.consultationStatus || null }, afterOk ? 'PASSED' : 'FAILED');
  const recordResult = await call(`/api/admin/premium/students/${encodeURIComponent(studentId)}/record`, { headers: { 'x-admin-session': env.QA_ADMIN_SESSION }, expectedStatus: [200] });
  const record = validateRecord(parse(recordResult), { studentId, anamnesisId: submit.id, marker });
  add('student-record-anamnesis', 'prontuário contém anamnese e marcador da run', { httpStatus: recordResult.status, submittedAt: record.submittedAt, markerPresent: record.markerPresent }, recordResult.ok && record.ok ? 'PASSED' : 'FAILED');
  add('identity-consistency', 'fixture, anamnese e prontuário usam o mesmo studentId', { createdStudentId: studentId, anamnesisStudentId: record.anamnesisStudentId, recordStudentId: record.recordStudentId }, record.ok ? 'PASSED' : 'FAILED');
  return finish();
}

// Workflow commands go to stderr so stdout remains one valid, sanitized JSON artifact.
async function main() { const report = await runPremiumAnamnesisSmoke({ mask: value => process.stderr.write(`::add-mask::${value}\n`) }); console.log(JSON.stringify(report, null, 2)); process.exitCode = report.status === 'VALIDATED' ? 0 : 1; }
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
