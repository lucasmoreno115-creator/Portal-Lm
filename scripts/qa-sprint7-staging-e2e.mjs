#!/usr/bin/env node
import process from 'node:process';

const failures = [];
const evidence = [];
const requiredEnv = [
  'QA_STAGING_BASE_URL',
  'QA_STUDENT_EMAIL',
  'QA_STUDENT_TOKEN',
  'QA_ADMIN_SESSION',
  'QA_ADMIN_TOKEN',
];

const pass = (scope, message, details = {}) => evidence.push({ scope, message, ...details });
const fail = (scope, message, details = {}) => failures.push({ scope, message, ...details });
const assert = (condition, scope, message, details = {}) => condition ? pass(scope, message, details) : fail(scope, message, details);

function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

async function request(path, { headers = {}, expectedStatus = [200], method = 'GET', body } = {}) {
  const url = `${normalizeBaseUrl(process.env.QA_STAGING_BASE_URL)}${path}`;
  const startedAt = Date.now();
  try {
    const response = await fetch(url, {
      method,
      headers: {
        accept: 'application/json, text/html;q=0.9, */*;q=0.8',
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      redirect: 'manual',
      signal: AbortSignal.timeout(20000),
    });
    const text = await response.text();
    return {
      ok: expectedStatus.includes(response.status),
      status: response.status,
      url,
      body: text.slice(0, 8000),
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    return { ok: false, status: null, url, error: error.message, durationMs: Date.now() - startedAt };
  }
}

function parseJson(result) {
  try { return JSON.parse(result.body || '{}'); }
  catch { return null; }
}

async function main() {
  const missing = requiredEnv.filter((name) => !process.env[name]);
  if (missing.length) {
    fail('configuration', 'Credenciais obrigatórias de staging não configuradas.', { missing });
  } else {
    pass('configuration', 'Credenciais obrigatórias de staging estão configuradas.');
  }

  if (missing.length === 0) {
    const publicPages = [
      ['/portal.html', 'Home do Portal Premium'],
      ['/portal-login.html', 'Login do Portal'],
      ['/portal-plano-alimentar.html', 'Plano alimentar do aluno'],
    ];
    for (const [path, label] of publicPages) {
      const result = await request(path, { expectedStatus: [200, 302] });
      assert(result.ok, 'staging-pages', `${label} está acessível em staging.`, result);
    }

    const studentHeaders = {
      'x-student-email': process.env.QA_STUDENT_EMAIL,
      'x-student-token': process.env.QA_STUDENT_TOKEN,
    };
    const adminHeaders = {
      'x-admin-session': process.env.QA_ADMIN_SESSION,
      'x-admin-token': process.env.QA_ADMIN_TOKEN,
    };

    const unauthenticated = await request('/api/portal/nutrition-plan', { expectedStatus: [401, 403] });
    assert(unauthenticated.ok, 'student-auth', 'Endpoint do plano rejeita acesso sem autenticação.', unauthenticated);

    const currentPlan = await request('/api/portal/nutrition-plan', { headers: studentHeaders, expectedStatus: [200] });
    const currentPlanJson = parseJson(currentPlan);
    assert(currentPlan.ok, 'student-auth', 'Aluno de staging autentica no endpoint do plano alimentar.', currentPlan);
    assert(currentPlanJson !== null, 'student-portal', 'Plano alimentar retorna contrato JSON válido.', { status: currentPlan.status });

    const workspace = await request('/api/admin/premium/workspace', { headers: adminHeaders, expectedStatus: [200] });
    const workspaceJson = parseJson(workspace);
    assert(workspace.ok, 'professional-auth', 'Profissional autentica no Workspace de staging.', workspace);
    assert(workspaceJson !== null, 'workspace', 'Workspace retorna contrato JSON válido.', { status: workspace.status });

    const portalPayload = currentPlanJson?.data ?? currentPlanJson?.plan ?? null;
    if (portalPayload) {
      assert(portalPayload.status === 'PUBLISHED' || portalPayload.is_active === 1 || portalPayload.isActive === true,
        'workspace-portal-integration',
        'Portal expõe somente plano publicado e ativo.',
        { id: portalPayload.id, status: portalPayload.status, is_active: portalPayload.is_active, isActive: portalPayload.isActive });
    } else {
      pass('workspace-portal-integration', 'Aluno de staging está autenticado, porém sem plano publicado para comparação.');
    }

    const projectLm = await request('/projeto-lm/', { expectedStatus: [200, 302] });
    assert(projectLm.ok, 'compatibility', 'Projeto LM permanece acessível em staging.', projectLm);
  }

  const report = {
    sprint: 'QA 7',
    environment: 'staging',
    status: failures.length ? 'NOT_VALIDATED' : 'VALIDATED',
    generatedAt: new Date().toISOString(),
    summary: { failures: failures.length, evidence: evidence.length },
    failures,
    evidence,
  };
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = failures.length ? 1 : 0;
}

await main();
