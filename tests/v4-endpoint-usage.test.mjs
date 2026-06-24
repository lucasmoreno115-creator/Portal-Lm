import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const rootDir = process.cwd();
const apiPath = path.join(rootDir, 'workers/api.js');
const docsPath = path.join(rootDir, 'docs/v4-route-inventory.md');
const endpointUsageServicePath = path.join(rootDir, 'workers/services/endpoint-usage-service.js');

async function readApiSource() {
  return readFile(apiPath, 'utf8');
}

async function readEndpointUsageServiceSource() {
  return readFile(endpointUsageServicePath, 'utf8');
}

function extractFunctionSource(source, functionName) {
  const declaration = `function ${functionName}`;
  const asyncDeclaration = `async function ${functionName}`;
  const start = source.indexOf(declaration) >= 0 ? source.indexOf(declaration) : source.indexOf(asyncDeclaration);
  assert.notEqual(start, -1, `${functionName} não foi encontrada.`);

  const bodyStart = source.indexOf('{', start);
  assert.notEqual(bodyStart, -1, `${functionName} não possui corpo válido.`);

  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }

  assert.fail(`${functionName} não possui fechamento válido.`);
}

test('logEndpointUsage existe e usa logOperationalEvent com evento endpoint_used', async () => {
  const source = await readEndpointUsageServiceSource();
  const helperSource = extractFunctionSource(source, 'logEndpointUsage');

  assert.match(helperSource, /logOperationalEvent\(db, \{/);
  assert.match(helperSource, /level:\s*['"]info['"]/);
  assert.match(helperSource, /event:\s*['"]endpoint_used['"]/);
  assert.match(helperSource, /message:\s*['"]Endpoint utilizado\.['"]/);
});

test('logEndpointUsage registra somente pathname, método, status e matched_route seguro', async () => {
  const source = await readEndpointUsageServiceSource();
  const helperSource = extractFunctionSource(source, 'logEndpointUsage');

  assert.match(helperSource, /const pathname = url\.pathname/);
  assert.match(helperSource, /route:\s*pathname/);
  assert.match(helperSource, /method:\s*request\.method/);
  assert.match(helperSource, /status_code:\s*statusCode/);
  assert.match(helperSource, /matched_route/);

  assert.doesNotMatch(helperSource, /searchParams|get\(['"]query|url\.search|request\.headers|headers|get\(['"]x-admin-token|request\.json|body|token|senha|password|nutrition_plan|meal_plan|checkin_payload/i);
});

test('logEndpointUsage resolve área por rota e não loga operational-logs nem health', async () => {
  const source = await readEndpointUsageServiceSource();
  const helperSource = extractFunctionSource(source, 'logEndpointUsage');
  const areaSource = extractFunctionSource(source, 'resolveEndpointUsageArea');

  assert.match(areaSource, /startsWith\(['"]\/api\/admin\/['"]\).*['"]admin['"]/s);
  assert.match(areaSource, /startsWith\(['"]\/api\/portal\/['"]\).*['"]student['"]/s);
  assert.match(areaSource, /startsWith\(['"]\/api\/project-lm\/['"]\).*['"]project_lm['"]/s);
  assert.match(areaSource, /includes\(['"]project-lm['"]\).*['"]project_lm['"]/s);
  assert.match(areaSource, /return ['"]system['"]/);
  assert.match(helperSource, /pathname === ['"]\/api\/admin\/operational-logs['"]/);
  assert.match(helperSource, /pathname === ['"]\/api\/health['"]/);
});

test('jsonWithUsage conecta respostas API bem-sucedidas ao helper de uso real', async () => {
  const apiSource = await readApiSource();
  const source = await readEndpointUsageServiceSource();
  const wrapperSource = extractFunctionSource(source, 'jsonWithUsage');

  assert.match(apiSource, /const json = \(payload, status = 200, matchedRoute = null\) => jsonWithUsage\(payload, status, request, env, matchedRoute, rawJson\)/);
  assert.match(wrapperSource, /const response = responseFactory\(payload, status\)/);
  assert.match(wrapperSource, /logEndpointUsage\(env\?\.DB, request, response\.status, matchedRoute\)/);
});

test('/api/admin/endpoint-usage existe, exige admin e consulta operational_logs', async () => {
  const source = await readApiSource();
  const adminBlockStart = source.indexOf("url.pathname.startsWith('/api/admin/')");
  const routeStart = source.indexOf("url.pathname === '/api/admin/endpoint-usage'", adminBlockStart);

  assert.ok(adminBlockStart >= 0, 'Bloco administrativo não encontrado.');
  assert.ok(routeStart > adminBlockStart, 'Endpoint usage deve estar dentro do bloco administrativo.');

  const guardBlock = source.slice(adminBlockStart, routeStart);
  assert.match(guardBlock, /isAdminAuthorized\(request, env\)/);
  assert.match(guardBlock, /Unauthorized/);
  assert.match(guardBlock, /401/);

  const routeSource = source.slice(routeStart, source.indexOf("url.pathname === '/api/admin/operational-logs'", routeStart));
  assert.match(routeSource, /method === ['"]GET['"]/);
  assert.match(routeSource, /FROM operational_logs/);
  assert.match(routeSource, /event='endpoint_used'/);
  assert.match(routeSource, /COUNT\(\*\) AS hits/);
  assert.match(routeSource, /MAX\(created_at\) AS last_seen_at/);
  assert.match(routeSource, /GROUP BY route, method, area/);
  assert.match(routeSource, /daysRaw/);
  assert.match(routeSource, /Math\.min\(Math\.max\(Math\.trunc\(daysRaw\), 1\), 90\)/);
});

test('documentação orienta observar possíveis órfãs antes de remover endpoints', async () => {
  const docs = await readFile(docsPath, 'utf8');
  assert.match(docs, /2–4 semanas de observação via \/api\/admin\/endpoint-usage/);
});
