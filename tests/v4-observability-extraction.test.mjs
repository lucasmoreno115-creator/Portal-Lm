import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeOperationalMetadata } from '../workers/services/operational-log-service.js';

const rootDir = process.cwd();
const apiPath = path.join(rootDir, 'workers/api.js');
const operationalLogServicePath = path.join(rootDir, 'workers/services/operational-log-service.js');
const healthCheckServicePath = path.join(rootDir, 'workers/services/health-check-service.js');
const endpointUsageServicePath = path.join(rootDir, 'workers/services/endpoint-usage-service.js');

async function readSource(filePath) {
  return readFile(filePath, 'utf8');
}

function extractFunctionSource(source, functionName) {
  const declaration = `function ${functionName}`;
  const asyncDeclaration = `async function ${functionName}`;
  const exportDeclaration = `export function ${functionName}`;
  const exportAsyncDeclaration = `export async function ${functionName}`;
  const candidates = [declaration, asyncDeclaration, exportDeclaration, exportAsyncDeclaration]
    .map((candidate) => source.indexOf(candidate))
    .filter((index) => index >= 0);
  const start = Math.min(...candidates);
  assert.ok(Number.isFinite(start), `${functionName} não foi encontrada.`);

  const bodyStart = source.indexOf('{', start);
  assert.notEqual(bodyStart, -1, `${functionName} não possui corpo válido.`);

  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }

  assert.fail(`${functionName} não possui fechamento válido.`);
}

test('workers/api.js importa os serviços de observabilidade', async () => {
  const source = await readSource(apiPath);
  assert.match(source, /services\/operational-log-service\.js/);
  assert.match(source, /services\/health-check-service\.js/);
  assert.match(source, /services\/endpoint-usage-service\.js/);
});

test('sanitizeOperationalMetadata continua exportável e testável no módulo extraído', () => {
  assert.equal(typeof sanitizeOperationalMetadata, 'function');
  assert.deepEqual(sanitizeOperationalMetadata({ token: 'x', safe: 'ok' }), { safe: 'ok' });
});

test('logOperationalEvent continua com try\/catch interno', async () => {
  const source = await readSource(operationalLogServicePath);
  const helper = extractFunctionSource(source, 'logOperationalEvent');
  assert.match(helper, /try\s*{/);
  assert.match(helper, /catch\s*{/);
  assert.match(helper, /INSERT INTO operational_logs/);
});

test('buildD1HealthCheck continua existindo no módulo extraído', async () => {
  const source = await readSource(healthCheckServicePath);
  assert.match(source, /export async function buildD1HealthCheck\(db\)/);
});

test('logEndpointUsage continua usando logOperationalEvent', async () => {
  const source = await readSource(endpointUsageServicePath);
  const helper = extractFunctionSource(source, 'logEndpointUsage');
  assert.match(helper, /logOperationalEvent\(db, \{/);
});

test('rotas administrativas de observabilidade continuam declaradas', async () => {
  const source = await readSource(apiPath);
  assert.match(source, /url\.pathname === ['"]\/api\/admin\/health-check['"] && method === ['"]GET['"]/);
  assert.match(source, /url\.pathname === ['"]\/api\/admin\/operational-logs['"] && method === ['"]GET['"]/);
  assert.match(source, /url\.pathname === ['"]\/api\/admin\/endpoint-usage['"] && method === ['"]GET['"]/);
});
