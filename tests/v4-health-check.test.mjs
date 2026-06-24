import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const rootDir = process.cwd();
const apiPath = path.join(rootDir, 'workers/api.js');

async function readApiSource() {
  return readFile(apiPath, 'utf8');
}

function extractFunctionSource(source, functionName) {
  const declaration = `function ${functionName}`;
  const start = source.indexOf(declaration);
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

test('rota /api/admin/health-check existe em workers/api.js', async () => {
  const source = await readApiSource();

  assert.match(source, /url\.pathname === ['"]\/api\/admin\/health-check['"] && method === ['"]GET['"]/);
  assert.match(source, /buildD1HealthCheck\(env\.DB\)/);
});

test('rota /api/admin/health-check exige autorização admin', async () => {
  const source = await readApiSource();
  const adminBlockStart = source.indexOf("url.pathname.startsWith('/api/admin/')");
  const routeStart = source.indexOf("url.pathname === '/api/admin/health-check'", adminBlockStart);

  assert.ok(adminBlockStart >= 0, 'Bloco administrativo não encontrado.');
  assert.ok(routeStart > adminBlockStart, 'Health-check deve estar dentro do bloco administrativo.');

  const guardBlock = source.slice(adminBlockStart, routeStart);
  assert.match(guardBlock, /isAdminAuthorized\(request, env\)/);
  assert.match(guardBlock, /Unauthorized/);
  assert.match(guardBlock, /401/);
});

test('resposta do health-check não contém access_token', async () => {
  const source = await readApiSource();
  const healthCheckSource = extractFunctionSource(source, 'buildD1HealthCheck');

  assert.doesNotMatch(healthCheckSource, /access_token/i);
});

test('resposta do health-check possui status healthy ou warning', async () => {
  const source = await readApiSource();
  const healthCheckSource = extractFunctionSource(source, 'buildD1HealthCheck');

  assert.match(healthCheckSource, /'warning'/);
  assert.match(healthCheckSource, /'healthy'/);
  assert.match(healthCheckSource, /return \{ summary, checks, status \}/);
});

test('health-check usa somente consultas de leitura', async () => {
  const source = await readApiSource();
  const healthCheckSource = extractFunctionSource(source, 'buildD1HealthCheck');

  assert.doesNotMatch(healthCheckSource, /\b(INSERT|UPDATE|DELETE|ALTER)\b/i);
});
