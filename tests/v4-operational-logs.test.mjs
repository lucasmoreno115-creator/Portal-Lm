import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeOperationalMetadata } from '../workers/api.js';

const rootDir = process.cwd();
const apiPath = path.join(rootDir, 'workers/api.js');
const operationalLogServicePath = path.join(rootDir, 'workers/services/operational-log-service.js');
const migrationPath = path.join(rootDir, 'migrations/0017_operational_logs.sql');

async function readApiSource() {
  return readFile(apiPath, 'utf8');
}

async function readOperationalLogServiceSource() {
  return readFile(operationalLogServicePath, 'utf8');
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


test('sanitizeOperationalMetadata bloqueia chaves exatas sensíveis', () => {
  const result = sanitizeOperationalMetadata({
    token: 'abc',
    access_token: 'abc',
    admin_token: 'abc',
    x_admin_token: 'abc',
    password: 'abc',
    senha: 'abc',
    secret: 'abc',
    authorization: 'abc',
    cookie: 'abc',
    set_cookie: 'abc',
    bearer: 'abc',
    credential: 'abc',
    credentials: 'abc',
    meal_plan: 'abc',
    nutrition_plan: 'abc',
    checkin_payload: 'abc',
    answers_json: 'abc',
    internal_scores_json: 'abc',
    safe_note: 'ok'
  });
  assert.deepEqual(result, { safe_note: 'ok' });
});

test('sanitizeOperationalMetadata bloqueia chaves sensíveis por correspondência parcial', () => {
  const result = sanitizeOperationalMetadata({
    accessToken: 'abc',
    portalToken: 'abc',
    adminPassword: 'abc',
    user_password: 'abc',
    auth_secret: 'abc',
    authorizationHeader: 'abc',
    session_cookie: 'abc',
    studentCredentials: 'abc',
    safe_status: 'ok'
  });
  assert.deepEqual(result, { safe_status: 'ok' });
});

test('sanitizeOperationalMetadata redige valores string com padrões sensíveis', () => {
  const result = sanitizeOperationalMetadata({
    header: 'Bearer abc123',
    adminHeader: 'x-admin-token: abc123',
    query: 'access_token=abc123',
    field: 'password=abc123',
    portugueseField: 'senha=abc123'
  });
  assert.deepEqual(result, {
    header: '[redacted]',
    adminHeader: '[redacted]',
    query: '[redacted]',
    field: '[redacted]',
    portugueseField: '[redacted]'
  });
});

test('sanitizeOperationalMetadata preserva valores simples seguros', () => {
  const result = sanitizeOperationalMetadata({
    route: '/api/admin/health-check',
    statusCode: 500,
    retriable: false,
    area: 'admin'
  });
  assert.deepEqual(result, {
    route: '/api/admin/health-check',
    statusCode: 500,
    retriable: false,
    area: 'admin'
  });
});

test('sanitizeOperationalMetadata ignora objetos, arrays, null e undefined', () => {
  const result = sanitizeOperationalMetadata({
    nested: { safe: 'no' },
    list: ['no'],
    empty: null,
    missing: undefined,
    safe: 'yes'
  });
  assert.deepEqual(result, { safe: 'yes' });
});

test('helper logOperationalEvent existe e possui try/catch interno', async () => {
  const source = await readOperationalLogServiceSource();
  const helper = extractFunctionSource(source, 'logOperationalEvent');
  assert.match(helper, /try\s*{/);
  assert.match(helper, /catch\s*{/);
  assert.match(helper, /INSERT INTO operational_logs/);
});

test('helper logOperationalEvent não registra termos sensíveis explícitos', async () => {
  const source = await readOperationalLogServiceSource();
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
