import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const rootDir = process.cwd();
const apiPath = path.join(rootDir, 'workers/api.js');
const migrationPath = path.join(rootDir, 'migrations/0017_operational_logs.sql');

async function readApiSource() {
  return readFile(apiPath, 'utf8');
}

function extractFunctionSource(source, functionName) {
  const declaration = `function ${functionName}`;
  const asyncDeclaration = `async function ${functionName}`;
  const start = source.indexOf(declaration) >= 0 ? source.indexOf(declaration) : source.indexOf(asyncDeclaration);
  assert.notEqual(start, -1, `${functionName} não foi encontrada.`);
  const bodyStart = source.indexOf('{', start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  assert.fail(`${functionName} não possui fechamento válido.`);
}

test('migration cria tabela operational_logs e índices', async () => {
  const source = await readFile(migrationPath, 'utf8');
  assert.match(source, /CREATE TABLE IF NOT EXISTS operational_logs/i);
  for (const column of ['id TEXT PRIMARY KEY', 'created_at TEXT NOT NULL', 'level TEXT NOT NULL', 'area TEXT NOT NULL', 'event TEXT NOT NULL', 'metadata TEXT']) {
    assert.match(source, new RegExp(column.replace(/ /g, '\\s+'), 'i'));
  }
  for (const index of ['idx_operational_logs_created_at', 'idx_operational_logs_level_created_at', 'idx_operational_logs_area_created_at', 'idx_operational_logs_student_email_created_at']) {
    assert.match(source, new RegExp(index));
  }
});

test('helper logOperationalEvent existe e possui try/catch interno', async () => {
  const source = await readApiSource();
  const helper = extractFunctionSource(source, 'logOperationalEvent');
  assert.match(helper, /try\s*{/);
  assert.match(helper, /catch\s*{/);
  assert.match(helper, /INSERT INTO operational_logs/);
});

test('helper logOperationalEvent não registra termos sensíveis explícitos', async () => {
  const source = await readApiSource();
  const helper = extractFunctionSource(source, 'logOperationalEvent');
  assert.doesNotMatch(helper, /access_token/i);
  assert.doesNotMatch(helper, /password/i);
  assert.doesNotMatch(helper, /senha/i);
});

test('endpoint /api/admin/operational-logs existe e exige autorização admin', async () => {
  const source = await readApiSource();
  const adminBlockStart = source.indexOf("url.pathname.startsWith('/api/admin/')");
  const routeStart = source.indexOf("url.pathname === '/api/admin/operational-logs'", adminBlockStart);
  assert.ok(routeStart > adminBlockStart, 'Rota deve ficar no bloco administrativo.');
  const guardBlock = source.slice(adminBlockStart, routeStart);
  assert.match(guardBlock, /isAdminAuthorized\(request, env\)/);
  assert.match(guardBlock, /Unauthorized/);
  assert.match(guardBlock, /401/);
});

test('endpoint /api/admin/operational-logs possui LIMIT máximo 100', async () => {
  const source = await readApiSource();
  const routeStart = source.indexOf("url.pathname === '/api/admin/operational-logs'");
  const routeEnd = source.indexOf("url.pathname === '/api/admin/health-check'", routeStart);
  const route = source.slice(routeStart, routeEnd);
  assert.match(route, /Math\.min[\s\S]*100/);
  assert.match(route, /ORDER BY datetime\(created_at\) DESC/);
  assert.match(route, /LIMIT \?/);
});
