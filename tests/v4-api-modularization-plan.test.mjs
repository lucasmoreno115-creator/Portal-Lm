import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const rootDir = process.cwd();
const docPath = path.join(rootDir, 'docs/v4-api-modularization-plan.md');

async function readPlan() {
  await assert.doesNotReject(access(docPath));
  return readFile(docPath, 'utf8');
}

test('documento V4 de plano de modularização da API existe', async () => {
  const plan = await readPlan();
  assert.match(plan, /# V4 API Modularization Plan/);
});

test('documento contém princípios de segurança', async () => {
  const plan = await readPlan();
  assert.match(plan, /## Princípios de segurança/);
});

test('documento contém ordem recomendada de extração', async () => {
  const plan = await readPlan();
  assert.match(plan, /## Ordem recomendada de extração/);
});

test('documento contém rotas críticas que não podem quebrar', async () => {
  const plan = await readPlan();
  assert.match(plan, /## Rotas críticas que não podem quebrar/);
});

test('documento recomenda Observabilidade como primeira extração', async () => {
  const plan = await readPlan();
  assert.match(plan, /## Primeira extração recomendada/);
  assert.match(plan, /começar por Observabilidade/);
});

test('documento contém anti-objetivos', async () => {
  const plan = await readPlan();
  assert.match(plan, /## Anti-objetivos/);
});
