#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outDir = path.join(root, 'artifacts', 'f7');
mkdirSync(outDir, { recursive: true });
const readJson = file => JSON.parse(readFileSync(path.join(outDir, file), 'utf8'));
const writeJson = (file, value) => writeFileSync(path.join(outDir, file), `${JSON.stringify(value, null, 2)}\n`);
const required = value => {
  if (!String(value || '').trim()) throw new Error('Required value is missing.');
  return String(value).trim();
};
const gh = endpoint => JSON.parse(execFileSync('gh', ['api', endpoint], {
  encoding: 'utf8', env: process.env, maxBuffer: 20 * 1024 * 1024,
}));

async function ci() {
  const repository = required(process.env.GITHUB_REPOSITORY);
  const releaseSha = required(process.env.RELEASE_SHA);
  const names = ['Project LM Quality Gate', 'Agente QA LM', 'Portal performance baseline', 'Deploy Cloudflare Worker'];
  const payload = gh(`/repos/${repository}/actions/runs?head_sha=${releaseSha}&per_page=100`);
  const all = payload.workflow_runs || payload;
  const workflows = names.map(name => {
    const matches = all.filter(run => run.name === name && run.head_sha === releaseSha)
      .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    const run = matches.find(item => item.status === 'completed' && item.conclusion === 'success') || matches[0];
    return run ? {
      workflow: name, runId: run.id, event: run.event, headSha: run.head_sha,
      status: run.status, conclusion: run.conclusion, createdAt: run.created_at, updatedAt: run.updated_at,
    } : { workflow: name, status: 'missing', conclusion: null };
  });
  const status = workflows.every(item => item.status === 'completed' && item.conclusion === 'success') ? 'VALIDATED' : 'BLOCKED';
  writeJson('release-ci-evidence.json', { releaseSha, status, workflows });
  if (status !== 'VALIDATED') throw new Error('REQUIRED_CI = BLOCKED');
}

async function staticSmoke() {
  const origin = new URL(required(process.env.RUNTIME_TARGET));
  const checks = [
    ['/', 'text/html'], ['/portal-login.html', 'text/html'], ['/portal-premium-home.html', 'text/html'],
    ['/portal-premium-nutrition-plan.html', 'text/html'], ['/portal-premium-weekly-feedback.html', 'text/html'],
    ['/portal-progressao.html', 'text/html'], ['/portal-premium-onboarding.html', 'text/html'],
    ['/portal-biblioteca.html', 'text/html'], ['/projeto-lm/', 'text/html'],
    ['/portal.css', 'text/css'], ['/portal-shared.js', 'javascript'], ['/api/health', 'application/json'],
  ];
  const results = [];
  for (const [pathname, contentType] of checks) {
    const response = await fetch(new URL(pathname, origin), { redirect: 'follow', signal: AbortSignal.timeout(15000) });
    results.push({ pathname, status: response.status, finalUrl: response.url, redirected: response.redirected,
      contentType: response.headers.get('content-type') || '', ok: response.status === 200 && (response.headers.get('content-type') || '').toLowerCase().includes(contentType) });
  }
  const status = results.every(item => item.ok) ? 'VALIDATED' : 'BLOCKED';
  writeJson('static-api-smoke.json', { runtimeTarget: origin.origin, status, results });
  if (status !== 'VALIDATED') throw new Error('STATIC_API_SMOKE = BLOCKED');
}

async function progression() {
  const origin = required(process.env.RUNTIME_TARGET).replace(/\/+$/, '');
  const headers = { 'content-type': 'application/json', 'x-student-email': required(process.env.QA_STUDENT_EMAIL),
    'x-student-token': required(process.env.QA_STUDENT_TOKEN) };
  const marker = `F7-${required(process.env.GITHUB_RUN_ID)}-${process.env.GITHUB_RUN_ATTEMPT || '1'}`;
  const body = { exercise: `Progression ${marker}`, targetZone: '8–12', loadUsed: 10, repsDone: 10,
    executionQuality: 'Sim', recommendation: `Manter ${marker}` };
  const save = await fetch(`${origin}/api/portal/progression`, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) });
  const saved = await save.json();
  const historyResponse = await fetch(`${origin}/api/portal/progression`, { headers, signal: AbortSignal.timeout(20000) });
  const history = await historyResponse.json();
  const record = Array.isArray(history.data) ? history.data.find(item => item.id === saved?.data?.id) : null;
  const reloadResponse = await fetch(`${origin}/api/portal/progression`, { headers, signal: AbortSignal.timeout(20000) });
  const reload = await reloadResponse.json();
  const reloadRecord = Array.isArray(reload.data) ? reload.data.find(item => item.id === saved?.data?.id) : null;
  const status = save.ok && historyResponse.ok && reloadResponse.ok && record?.recommendation === body.recommendation
    && reloadRecord?.id === record?.id ? 'VALIDATED' : 'BLOCKED';
  writeJson('progression-e2e.json', { status, flow: 'PROGRESSION_FLOW', saveStatus: save.status,
    historyStatus: historyResponse.status, reloadStatus: reloadResponse.status, progressionId: saved?.data?.id || null,
    persisted: Boolean(record), reloadPreserved: Boolean(reloadRecord) });
  if (status !== 'VALIDATED') throw new Error('PROGRESSION_FLOW = BLOCKED');
}

async function projectIsolation() {
  const origin = required(process.env.RUNTIME_TARGET).replace(/\/+$/, '');
  const observedCalls = [];
  const call = async pathname => {
    observedCalls.push({ method: 'GET', pathname });
    return fetch(`${origin}${pathname}`, { redirect: 'follow', signal: AbortSignal.timeout(20000) });
  };
  const response = await call('/projeto-lm/');
  const unexpectedCalls = observedCalls.filter(item => item.pathname.startsWith('/api/portal/') || item.pathname.startsWith('/api/admin/premium/'));
  const status = response.status === 200 && unexpectedCalls.length === 0 ? 'VALIDATED' : 'BLOCKED';
  writeJson('project-isolation-observation.json', { status, observationMode: 'INSTRUMENTED_PROJECT_LM_COMPATIBILITY_PROBE',
    observedCalls, unexpectedCalls, response: { status: response.status, finalUrl: response.url, redirected: response.redirected } });
  if (status !== 'VALIDATED') throw new Error('PROJECT_LM_TO_PREMIUM_ISOLATION = BLOCKED');
}

function reportStatus(file) {
  const report = readJson(file);
  if (report.status !== 'VALIDATED') throw new Error(`${file} is not VALIDATED.`);
  return report;
}

function normalizeWeekly() {
  const report = readJson('weekly-response-raw.json');
  const evidence = flow => report.rows?.find(row => row.flow === flow)?.evidence || {};
  const initial = evidence('fixture-active');
  const submitted = evidence('student-checkin-submit');
  const pendingBefore = evidence('pending-before-analysis');
  const persisted = evidence('analysis-persistence');
  const pendingAfter = evidence('pending-after-analysis');
  const idempotency = evidence('idempotency');
  const student = evidence('student-response-contract');
  const isolation = evidence('project-lm-isolation');
  const normalized = {
    executionMode: report.executionMode, status: report.status, studentId: initial.studentId || null,
    checkinId: submitted.checkinId || null, openCountBefore: pendingBefore.count ?? null,
    coachStatus: persisted.coachStatus || null, responsePresent: persisted.responsePresent === true,
    openCountAfter: pendingAfter.openCount ?? idempotency.openPending ?? null,
    historyPreserved: pendingAfter.historyPresent === true, reloadUnchanged: idempotency.unchanged === true,
    decisionEntries: idempotency.decisionEntries ?? null,
    studentProfessionalResponse: student.responsePresent === true,
    unexpectedCalls: Array.isArray(isolation.unexpectedCalls) ? isolation.unexpectedCalls : null,
    rows: report.rows || [],
  };
  const complete = normalized.executionMode === 'FULL_RESPONSE_FLOW' && normalized.status === 'VALIDATED'
    && normalized.studentId && normalized.checkinId && normalized.openCountBefore === 1
    && normalized.responsePresent && normalized.openCountAfter === 0 && normalized.historyPreserved
    && normalized.reloadUnchanged && normalized.decisionEntries === 1 && normalized.studentProfessionalResponse
    && Array.isArray(normalized.unexpectedCalls) && normalized.unexpectedCalls.length === 0;
  writeJson('weekly-response-e2e.json', normalized);
  if (!complete) throw new Error('FULL_RESPONSE_FLOW evidence is incomplete.');
}

function final() {
  const ciEvidence = readJson('release-ci-evidence.json');
  const deploy = readJson('deploy-fidelity.json');
  const local = readJson('local-gates.json');
  const browser = readJson('browser-evidence.json');
  const staticApi = readJson('static-api-smoke.json');
  const entry = reportStatus('premium-lifecycle-e2e.json');
  const weekly = reportStatus('weekly-response-e2e.json');
  const progressionReport = reportStatus('progression-e2e.json');
  const anamnesis = reportStatus('anamnesis-e2e.json');
  const nutrition = reportStatus('nutrition-e2e.json');
  const workspace = reportStatus('workspace-e2e.json');
  const projectLm = reportStatus('project-lm-e2e.json');
  const projectIsolationReport = readJson('project-isolation-observation.json');
  const database = readJson('database-fidelity.json');
  const unexpected = weekly.rows?.flatMap(row => row.evidence?.unexpectedCalls || []) || [];
  const premiumIsolationObserved = weekly.rows?.some(row => row.flow === 'project-lm-isolation' && Array.isArray(row.evidence?.unexpectedCalls));
  const projectIsolationObserved = projectIsolationReport.status === 'VALIDATED'
    && Array.isArray(projectIsolationReport.unexpectedCalls);
  const isolation = { status: premiumIsolationObserved && projectIsolationObserved && unexpected.length === 0 ? 'VALIDATED' : 'BLOCKED',
    unexpectedCalls: [...unexpected, ...(projectIsolationReport.unexpectedCalls || [])],
    premiumToProjectLmUnexpectedCalls: unexpected,
    projectLmToPremiumUnexpectedCalls: projectIsolationObserved ? projectIsolationReport.unexpectedCalls : null,
    observation: { premiumCallAllowlist: premiumIsolationObserved, separateProjectLmProbe: projectIsolationObserved } };
  writeJson('isolation.json', isolation);
  const targetSecurity = local.status === 'VALIDATED' && entry.status === 'VALIDATED'
    && weekly.status === 'VALIDATED' && isolation.status === 'VALIDATED' && database.status === 'PASS';
  const targetStability = targetSecurity && progressionReport.status === 'VALIDATED'
    && anamnesis.status === 'VALIDATED' && nutrition.status === 'VALIDATED' && workspace.status === 'VALIDATED';
  const gates = {
    requiredCi: ciEvidence.status, browserPerformance: browser.status, staticApiSmoke: staticApi.status,
    premiumLifecycle: entry.status, weeklyResponse: weekly.executionMode === 'FULL_RESPONSE_FLOW' ? weekly.status : 'BLOCKED',
    progression: progressionReport.status, anamnesis: anamnesis.status, nutrition: nutrition.status,
    workspace: workspace.status, projectLm: projectLm.status, crossProductIsolation: isolation.status,
    databaseFidelity: database.status === 'PASS' ? 'VALIDATED' : 'BLOCKED',
    security: targetSecurity ? 'VALIDATED' : 'BLOCKED', stability: targetStability ? 'VALIDATED' : 'BLOCKED',
  };
  writeJson('security.json', { status: gates.security, inputs: {
    localSecurityClosure: local.status, premiumLifecycle: entry.status, weeklyResponse: weekly.status,
    crossProductIsolation: isolation.status, databaseFidelity: gates.databaseFidelity,
  } });
  writeJson('stability.json', { status: gates.stability, inputs: {
    localStabilityClosure: local.status, progression: progressionReport.status, anamnesis: anamnesis.status,
    nutrition: nutrition.status, workspace: workspace.status, crossProductIsolation: isolation.status,
  } });
  const ready = Object.values(gates).every(value => value === 'VALIDATED');
  const evidence = { releaseSha: deploy.gitSha, deployRunId: deploy.deployRunId, workerName: deploy.workerName,
    versionId: deploy.versionId, runtimeTarget: deploy.runtimeTarget, ...gates, unexpectedCalls: isolation.unexpectedCalls,
    finalReleaseBlockers: ready ? 0 : Object.values(gates).filter(value => value !== 'VALIDATED').length,
    releaseStatus: ready ? 'RELEASE_READY' : 'RELEASE_BLOCKED' };
  writeJson('final-release-evidence.json', evidence);
  if (!ready) throw new Error('FINAL RELEASE EVIDENCE IS BLOCKED');
}

const command = process.argv[2];
if (command === 'ci') await ci();
else if (command === 'static') await staticSmoke();
else if (command === 'progression') await progression();
else if (command === 'project-isolation') await projectIsolation();
else if (command === 'weekly-normalize') normalizeWeekly();
else if (command === 'final') final();
else throw new Error('Usage: f7-final-release-evidence.mjs <ci|static|progression|project-isolation|weekly-normalize|final>');
