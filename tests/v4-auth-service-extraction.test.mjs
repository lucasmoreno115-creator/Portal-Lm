import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { extractWorkerRoutes } from './v4-route-inventory.test.mjs';
import { normalizeEmail, normalizeStudentPlan } from '../workers/api.js';

const rootDir = process.cwd();
const apiPath = path.join(rootDir, 'workers/api.js');
const authServicePath = path.join(rootDir, 'workers/services/auth-service.js');

async function readSource(filePath) {
  return readFile(filePath, 'utf8');
}

function extractFunctionSource(source, functionName) {
  const candidates = [
    `function ${functionName}`,
    `async function ${functionName}`,
    `export function ${functionName}`,
    `export async function ${functionName}`
  ].map((candidate) => source.indexOf(candidate)).filter((index) => index >= 0);
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

test('workers/api.js importa auth-service.js', async () => {
  const source = await readSource(apiPath);
  assert.match(source, /services\/auth-service\.js/);
});

test('auth-service.js contém helpers de autenticação e identidade extraídos', async () => {
  const source = await readSource(authServicePath);
  assert.match(source, /export function isAdminAuthorized\(request, env\)/);
  assert.match(source, /export async function validateStudent\(request, db\)/);
  assert.match(source, /export function normalizeEmail\(email\)/);
  assert.match(source, /export function normalizeStudentPlan\(plan\)/);
});

test('rotas de aluno continuam usando validateStudent', async () => {
  const source = await readSource(apiPath);
  const studentGuardIndex = source.indexOf("url.pathname.startsWith('/api/portal/') || url.pathname.startsWith('/api/project-lm/')");
  assert.notEqual(studentGuardIndex, -1, 'guard de rotas de aluno deve continuar declarado.');
  assert.match(source.slice(studentGuardIndex, studentGuardIndex + 420), /validateStudent\(request, env\.DB\)/);
});

test('rotas admin continuam usando isAdminAuthorized', async () => {
  const source = await readSource(apiPath);
  assert.match(source, /if \(!isAdminAuthorized\(request, env\)\)/);
});

test('normalizeEmail continua disponível via api.js', () => {
  assert.equal(typeof normalizeEmail, 'function');
  assert.equal(normalizeEmail(' Aluno@Email.COM '), 'aluno@email.com');
});

test('normalizeStudentPlan continua disponível via api.js', () => {
  assert.equal(typeof normalizeStudentPlan, 'function');
  assert.equal(normalizeStudentPlan('projeto_lm'), 'projeto_lm');
  assert.equal(normalizeStudentPlan('desconhecido'), 'premium');
});

test('nenhum endpoint declarado no Worker foi removido pela extração', async () => {
  const apiSource = await readSource(apiPath);
  const authSource = await readSource(authServicePath);
  const routes = extractWorkerRoutes(apiSource);
  assert.ok(routes.length > 0, 'api.js deve continuar declarando endpoints.');
  assert.equal(extractWorkerRoutes(authSource).length, 0, 'auth-service.js não deve declarar endpoints.');

  const declared = new Set(routes.map((route) => route.route));
  for (const requiredRoute of [
    '/api/portal/login',
    '/api/portal/me',
    '/api/admin/students',
    '/api/admin/health-check',
    '/api/project-lm/profile',
    '/api/portal/project-lm/current-mission'
  ]) {
    assert.ok(declared.has(requiredRoute), `${requiredRoute} deve continuar declarada no Worker.`);
  }
});

test('api.js não mantém duplicação local dos helpers extraídos', async () => {
  const source = await readSource(apiPath);
  for (const helper of ['isAdminAuthorized', 'validateStudent', 'normalizeEmail', 'normalizeStudentPlan']) {
    assert.throws(() => extractFunctionSource(source, helper), `${helper} não deve continuar implementada em api.js.`);
  }
});
