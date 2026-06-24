import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const rootDir = process.cwd();
const docPath = path.join(rootDir, 'docs/v4-architecture-freeze.md');

async function readFreezeDoc() {
  await assert.doesNotReject(access(docPath));
  return readFile(docPath, 'utf8');
}

test('documento V4 Architecture Freeze existe', async () => {
  const doc = await readFreezeDoc();
  assert.match(doc, /# V4 Architecture Freeze/);
});

test('documento lista V4-01 até V4-15 como concluídas', async () => {
  const doc = await readFreezeDoc();

  for (let step = 1; step <= 15; step += 1) {
    assert.match(doc, new RegExp(`V4-${String(step).padStart(2, '0')}`));
  }
});

test('documento contém fluxo Admin Login até Cadastro de Aluno', async () => {
  const doc = await readFreezeDoc();
  assert.match(doc, /Admin Login\s*↓\s*Command Center\s*↓\s*Student 360\s*↓\s*Cadastro de Aluno/);
});

test('documento contém Superfícies CORE', async () => {
  const doc = await readFreezeDoc();
  assert.match(doc, /## Superfícies CORE/);

  for (const surface of [
    'admin-login.html',
    'admin-command-center.html',
    'admin-student.html',
    'admin-students.html',
    'admin.html',
    'portal-login.html',
    'portal.html',
    'portal-checkin.html',
    'portal-plano-alimentar.html',
    'portal-progressao.html',
    'projeto-lm-jornada.html',
    'projeto-lm-planejamento.html',
    'projeto-lm-biblioteca.html',
    'projeto-lm-conquistas.html',
    'projeto-lm-onboarding.html',
  ]) {
    assert.match(doc, new RegExp(surface.replaceAll('.', '\\.')));
  }
});

test('documento contém Superfícies AUXILIARY preservadas', async () => {
  const doc = await readFreezeDoc();
  assert.match(doc, /## Superfícies AUXILIARY preservadas/);

  for (const surface of [
    'admin-checkins.html',
    'admin-weekly-plan.html',
    'admin-nutrition-plan.html',
    'admin-anamneses.html',
    'admin-followup.html',
    'admin-alerts.html',
  ]) {
    assert.match(doc, new RegExp(surface.replaceAll('.', '\\.')));
  }
});

test('documento contém serviços modularizados', async () => {
  const doc = await readFreezeDoc();

  for (const service of [
    'auth-service.js',
    'operational-log-service.js',
    'health-check-service.js',
    'endpoint-usage-service.js',
  ]) {
    assert.match(doc, new RegExp(service.replaceAll('.', '\\.')));
  }
});

test('documento contém regras para futuros PRs', async () => {
  const doc = await readFreezeDoc();
  assert.match(doc, /## Regras para futuros PRs/);
  assert.match(doc, /Não misturar feature com refatoração estrutural/);
  assert.match(doc, /Não remover endpoint sem checar route inventory e endpoint usage/);
  assert.match(doc, /Não alterar schema sem migration/);
});

test('documento referencia os inventários oficiais', async () => {
  const doc = await readFreezeDoc();

  for (const inventory of [
    'docs/v4-route-inventory.md',
    'docs/v4-dependency-inventory.md',
    'docs/v4-admin-flow-consolidation.md',
    'docs/v4-api-modularization-plan.md',
  ]) {
    assert.match(doc, new RegExp(inventory.replaceAll('.', '\\.')));
  }
});

test('documento contém critérios para iniciar V5', async () => {
  const doc = await readFreezeDoc();
  assert.match(doc, /## Critérios para iniciar V5/);
  assert.match(doc, /V4-16 estiver mergeada/);
  assert.match(doc, /npm test/);
  assert.match(doc, /Nenhuma rota crítica estiver quebrada/);
});
