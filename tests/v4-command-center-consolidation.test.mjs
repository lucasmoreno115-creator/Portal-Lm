import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const rootDir = process.cwd();
const commandCenterPath = path.join(rootDir, 'admin-command-center.html');

async function readCommandCenter() {
  return readFile(commandCenterPath, 'utf8');
}

test('Command Center contém blocos operacionais consolidados', async () => {
  const source = await readCommandCenter();
  for (const label of ['Prioridade Operacional', 'Follow-ups', 'Alertas', 'Reativação', 'Saúde do sistema']) {
    assert.ok(source.includes(label), `Command Center deve conter o bloco ${label}.`);
  }
  assert.match(source, /id=['"]priorityMsg['"]/);
  assert.match(source, /id=['"]criticalPendingCount['"]/);
  assert.match(source, /id=['"]recommendedAction['"]/);
});

test('Command Center reutiliza endpoints administrativos existentes', async () => {
  const source = await readCommandCenter();
  for (const endpoint of [
    '/api/admin/command-center',
    '/api/admin/followup-alerts',
    '/api/admin/portal-alerts',
    '/api/admin/health-check',
    '/api/admin/operational-logs?level=error&limit=5'
  ]) {
    assert.ok(source.includes(endpoint), `Command Center deve reutilizar ${endpoint}.`);
  }
});

test('Command Center preserva telas antigas e gera links para Student 360 por email', async () => {
  const source = await readCommandCenter();
  assert.ok(source.includes('/admin-followup.html'), 'Deve preservar link para admin-followup.html.');
  assert.ok(source.includes('/admin-alerts.html'), 'Deve preservar link para admin-alerts.html.');
  assert.match(source, /\/admin-student\.html\?email=\$\{encodeURIComponent\(normalizedEmail\)\}/);
  await assert.doesNotReject(access(path.join(rootDir, 'admin-followup.html')));
  await assert.doesNotReject(access(path.join(rootDir, 'admin-alerts.html')));
});

test('Command Center evita dados sensíveis e payloads auxiliares brutos', async () => {
  const source = await readCommandCenter();
  assert.doesNotMatch(source, /access_token/i);
  assert.doesNotMatch(source, /metadata/i);
  assert.doesNotMatch(source, /payload bruto|raw payload/i);
});

test('Command Center possui fallbacks discretos por bloco auxiliar', async () => {
  const source = await readCommandCenter();
  assert.match(source, /Não foi possível carregar follow-ups agora\./);
  assert.match(source, /Não foi possível carregar alertas agora\./);
  assert.match(source, /Não foi possível carregar a saúde do sistema\./);
});
