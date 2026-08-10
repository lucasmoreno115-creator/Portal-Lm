import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createQaAnswers, runPremiumAnamnesisSmoke, validatePremiumAnamnesisCalls, validateRecord, validateSubmit } from '../scripts/qa-premium-anamnesis-staging-e2e.mjs';

const env = { QA_BASE_URL: 'https://preview.example.test', QA_TARGET_ENVIRONMENT: 'staging', QA_ADMIN_SESSION: 'admin-secret', GITHUB_RUN_ID: '416', GITHUB_RUN_ATTEMPT: '1' };
const token = 'student-secret', studentId = 'student-f16', anamnesisId = 'anam-f16';
const response = (status, body, ok = status >= 200 && status < 300) => ({ ok, status, responseBody: JSON.stringify(body), durationMs: 1 });

function api(change = {}) {
  let accessReads = 0; const calls = [];
  const requestFn = async (path, options = {}) => {
    calls.push({ path, options });
    if (path === '/api/admin/premium/workspace/students') return response(201, { ok: true, data: { studentId, email: options.body.email, status: 'AWAITING_ANAMNESIS', accessLink: `${env.QA_BASE_URL}/portal-login.html`, token } });
    if (path === '/api/portal/login') return response(200, { ok: true, data: { email: options.body.email, plan: 'premium' } });
    if (path === '/api/portal/premium/access-state') { accessReads++; const status = accessReads === 1 ? 'AWAITING_ANAMNESIS' : (change.after || 'UNDER_REVIEW'); return response(200, { ok: true, data: { consultationStatus: status, primaryAction: status === 'AWAITING_ANAMNESIS' ? { href: '/anamnese-premium.html' } : null } }); }
    if (path === '/api/anamnese-premium') return change.submit || response(200, { ok: true, data: { id: anamnesisId, alreadySubmitted: false } });
    const marker = `QA-F1.6-${env.GITHUB_RUN_ID}-${env.GITHUB_RUN_ATTEMPT}`;
    return response(200, { ok: true, data: { student: { student_id: change.recordStudentId || studentId }, anamnesis: change.noAnamnesis ? null : { id: anamnesisId, student_id: change.anamnesisStudentId || studentId, created_at: '2026-08-10T12:00:00.000Z', report: { sections: [{ value: change.marker || marker }] } } } });
  };
  return { calls, requestFn };
}

test('valid fixture, payload, submit, transition and canonical Student Record validate F1.6', async () => {
  const fake = api(), masked = []; const report = await runPremiumAnamnesisSmoke({ env, requestFn: fake.requestFn, mask: x => masked.push(x) });
  assert.equal(report.status, 'VALIDATED'); assert.deepEqual(report.rows.map(x => x.flow), ['fixture-entry','pre-anamnesis-state','anamnesis-submit','lifecycle-transition','student-record-anamnesis','identity-consistency','project-lm-isolation']);
  assert.ok(masked.includes(token) && masked.includes(env.QA_ADMIN_SESSION));
  const serialized = JSON.stringify(report); assert.doesNotMatch(serialized, /student-secret|admin-secret|@example\.test/i);
});

test('QA payload follows real LM_V2_2 answers shape and carries the marker', () => {
  const answers = createQaAnswers('MARKER'); assert.equal(answers.version, 'LM_V2_2'); assert.equal(answers.objectives.main_goal, 'QA F1.6 objetivo'); assert.equal(answers.observations.final_notes, 'MARKER'); assert.equal(answers.recovery.daily_energy, 8);
});

test('submit fails closed on HTTP 4xx, false success and replay response', () => {
  assert.equal(validateSubmit(response(400, { ok: false }, false)).ok, false);
  assert.equal(validateSubmit(response(200, { ok: false })).ok, false);
  assert.equal(validateSubmit(response(200, { ok: true, data: { id: 'x', alreadySubmitted: true } })).ok, false);
  assert.equal(validateSubmit(response(200, { ok: true, data: { id: 'x', alreadySubmitted: false } })).ok, true);
});

test('unchanged AWAITING_ANAMNESIS lifecycle is NOT_VALIDATED; UNDER_REVIEW passes', async () => {
  assert.equal((await runPremiumAnamnesisSmoke({ env, requestFn: api({ after: 'AWAITING_ANAMNESIS' }).requestFn })).status, 'NOT_VALIDATED');
  assert.equal((await runPremiumAnamnesisSmoke({ env, requestFn: api().requestFn })).status, 'VALIDATED');
});

test('Student Record requires anamnesis, exact IDs, timestamp and marker', () => {
  const expected = { studentId, anamnesisId, marker: 'MARKER' };
  const payload = (student = studentId, anam = studentId, marker = 'MARKER', present = true) => ({ ok: true, data: { student: { student_id: student }, anamnesis: present ? { id: anamnesisId, student_id: anam, created_at: 'now', report: { marker } } : null } });
  assert.equal(validateRecord(payload(), expected).ok, true);
  assert.equal(validateRecord(payload(studentId, studentId, 'OTHER'), expected).ok, false);
  assert.equal(validateRecord(payload('other'), expected).ok, false);
  assert.equal(validateRecord(payload(studentId, 'other'), expected).ok, false);
  assert.equal(validateRecord(payload(studentId, studentId, 'MARKER', false), expected).ok, false);
});

test('allowlist contains only five canonical Premium contracts and rejects Projeto LM', () => {
  assert.equal(validatePremiumAnamnesisCalls([{ method:'GET', path:`/api/admin/premium/students/${studentId}/record` }]).ok, true);
  for (const path of ['/api/project-lm/victories','/api/project-lm-2/checkin','/api/portal/checkin']) assert.equal(validatePremiumAnamnesisCalls([{ method:'POST', path }]).ok, false);
});

test('workflow orders F1.6 after F1.5, uploads evidence and keeps tee fail-closed', async () => {
  const workflow = await readFile('.github/workflows/qa-lm-staging.yml','utf8');
  assert.ok(workflow.indexOf('npm run qa:lm:premium-anamnesis') > workflow.indexOf('npm run qa:lm:premium-entry'));
  assert.match(workflow, /set -o pipefail\n\s+npm run qa:lm:premium-anamnesis \| tee qa-premium-anamnesis-report\.json/);
  assert.match(workflow, /qa-premium-anamnesis-report\.json/);
});

test('NOT_VALIDATED exits non-zero through a pipefail tee pipeline', async () => {
  const child = spawn('bash',['-o','pipefail','-c','node scripts/qa-premium-anamnesis-staging-e2e.mjs | tee /dev/null'],{ env:{...process.env, QA_BASE_URL:env.QA_BASE_URL,QA_TARGET_ENVIRONMENT:'staging',QA_ADMIN_SESSION:''},stdio:['ignore','pipe','pipe']});
  let out=''; child.stdout.on('data',x=>out+=x); const [code]=await once(child,'exit'); assert.equal(code,1); assert.match(out,/NOT_VALIDATED/);
});
