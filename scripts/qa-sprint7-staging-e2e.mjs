#!/usr/bin/env node
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const REQUIRED_ENV = ['QA_STUDENT_EMAIL', 'QA_STUDENT_TOKEN', 'QA_ADMIN_SESSION'];

export async function request(baseUrl, path, { headers = {}, expectedStatus = [200], method = 'GET', body, timeoutMs = 20000 } = {}) {
  const url = `${baseUrl}${path}`;
  const startedAt = Date.now();
  try {
    // `follow` validates the final response. Node fetch also rejects redirect loops,
    // while the abort signal bounds stalled redirects and destinations.
    const response = await fetch(url, {
      method,
      headers: {
        accept: 'application/json, text/html;q=0.9, */*;q=0.8',
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    });
    const responseBody = await response.text();
    return {
      ok: expectedStatus.includes(response.status),
      status: response.status,
      finalUrl: response.url,
      redirected: response.redirected,
      responseBody: responseBody.slice(0, 8000),
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    return { ok: false, status: null, error: error?.name || 'REQUEST_FAILED', durationMs: Date.now() - startedAt };
  }
}

function parseJson(result) {
  try { return JSON.parse(result.responseBody || ''); }
  catch { return null; }
}

// Never put response bodies or authentication headers in the persisted report.
function reportDetails(result) {
  return {
    status: result.status,
    finalUrl: result.finalUrl,
    redirected: result.redirected,
    durationMs: result.durationMs,
    ...(result.error ? { error: result.error } : {}),
  };
}

export function isPublicNutritionPlan(payload) {
  if (!payload || payload.ok !== true || !payload.data || typeof payload.data !== 'object' || Array.isArray(payload.data)) return false;
  const plan = payload.data;
  return typeof plan.title === 'string' && Array.isArray(plan.meals) && Array.isArray(plan.substitutions);
}

export async function runSmoke({ env = process.env, requestFn } = {}) {
  const failures = [];
  const evidence = [];
  const baseUrl = String(env.QA_BASE_URL || env.QA_STAGING_BASE_URL || '').trim().replace(/\/+$/, '');
  const performRequest = requestFn || ((path, options) => request(baseUrl, path, options));
  const pass = (scope, message, details = {}) => evidence.push({ scope, message, ...details });
  const fail = (scope, message, details = {}) => failures.push({ scope, message, ...details });
  const assert = (condition, scope, message, details = {}) => condition ? pass(scope, message, details) : fail(scope, message, details);

  const missing = REQUIRED_ENV.filter((name) => !env[name]);
  if (!baseUrl) missing.unshift('QA_BASE_URL');
  if (missing.length) fail('configuration', 'URL ou credenciais obrigatórias de staging não configuradas.', { missing });
  else pass('configuration', 'URL resolvida e credenciais obrigatórias de staging estão configuradas.', { baseUrl });

  if (missing.length === 0) {
    const publicPages = [
      ['/portal.html', 'Home do Portal Premium'],
      ['/portal-login.html', 'Login do Portal'],
      ['/portal-plano-alimentar.html', 'Plano alimentar do aluno'],
    ];
    for (const [path, label] of publicPages) {
      const result = await performRequest(path, { expectedStatus: [200] });
      assert(result.ok, 'staging-pages', `${label} está acessível em staging.`, reportDetails(result));
    }

    const studentHeaders = { 'x-student-email': env.QA_STUDENT_EMAIL, 'x-student-token': env.QA_STUDENT_TOKEN };
    const adminHeaders = { 'x-admin-session': env.QA_ADMIN_SESSION };
    const unauthenticated = await performRequest('/api/portal/nutrition-plan', { expectedStatus: [401, 403] });
    assert(unauthenticated.ok, 'student-auth', 'Endpoint do plano rejeita acesso sem autenticação.', reportDetails(unauthenticated));

    const currentPlan = await performRequest('/api/portal/nutrition-plan', { headers: studentHeaders, expectedStatus: [200] });
    const currentPlanJson = parseJson(currentPlan);
    assert(currentPlan.ok, 'student-auth', 'Aluno de staging autentica no endpoint do plano alimentar.', reportDetails(currentPlan));
    if (currentPlan.ok) {
      assert(currentPlanJson !== null, 'student-portal', 'Plano alimentar retorna contrato JSON válido.', { status: currentPlan.status });
      assert(isPublicNutritionPlan(currentPlanJson), 'workspace-portal-integration',
        'Portal expõe um plano segundo o contrato público de plano publicado e ativo.', { status: currentPlan.status });
    }

    const workspace = await performRequest('/api/admin/premium/workspace', { headers: adminHeaders, expectedStatus: [200] });
    const workspaceJson = parseJson(workspace);
    assert(workspace.ok, 'professional-auth', 'Profissional autentica no Workspace de staging.', reportDetails(workspace));
    if (workspace.status === 401 || workspace.status === 403) {
      if (workspaceJson?.code === 'ADMIN_SESSION_EXPIRED') {
        fail('qa-fixture', 'Sessão administrativa de QA expirada.', { status: workspace.status, code: 'ADMIN_SESSION_EXPIRED' });
      }
    } else if (workspace.ok) {
      assert(workspaceJson !== null, 'workspace', 'Workspace retorna contrato JSON válido.', { status: workspace.status });
    }

    // Projeto LM is deliberately limited to a route compatibility probe. It does
    // not reuse any Premium authentication, nutrition, or check-in assertion.
    const projectLm = await performRequest('/projeto-lm/', { expectedStatus: [200] });
    assert(projectLm.ok, 'compatibility', 'Projeto LM permanece acessível em staging.', reportDetails(projectLm));
  }

  return {
    sprint: 'QA 7', environment: 'staging', baseUrl: baseUrl || null,
    status: failures.length ? 'NOT_VALIDATED' : 'VALIDATED', generatedAt: new Date().toISOString(),
    summary: { failures: failures.length, evidence: evidence.length }, failures, evidence,
  };
}

async function main() {
  const report = await runSmoke();
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.failures.length ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
