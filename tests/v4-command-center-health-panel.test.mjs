import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const rootDir = process.cwd();
const commandCenterPath = path.join(rootDir, 'admin-command-center.html');

async function readCommandCenter() {
  return readFile(commandCenterPath, 'utf8');
}

test('Command Center carrega o painel mínimo de saúde com os endpoints administrativos', async () => {
  const source = await readCommandCenter();
  assert.match(source, /id=['"]systemHealthStatus['"]/);
  assert.match(source, /fetch\(['"]\/api\/admin\/health-check['"]/);
  assert.match(source, /fetch\(['"]\/api\/admin\/operational-logs\?level=error&limit=5['"]/);
  assert.match(source, /'x-admin-token': token/);
});

test('painel de saúde renderiza status healthy e warning com total de inconsistências', async () => {
  const source = await readCommandCenter();
  assert.match(source, /Saúde do sistema: 🟢 Saudável/);
  assert.match(source, /Saúde do sistema: 🟡 Atenção necessária/);
  assert.match(source, /Total de inconsistências encontradas:/);
  assert.match(source, /getHealthInconsistencyTotal\(health\.checks\)/);
});

test('painel de saúde lista erros recentes sem exibir metadata sensível', async () => {
  const source = await readCommandCenter();
  const renderStart = source.indexOf('function renderSystemErrorLogs');
  const renderEnd = source.indexOf('async function loadSystemHealth', renderStart);
  const renderSource = source.slice(renderStart, renderEnd);

  for (const field of ['created_at', 'area', 'event', 'route', 'message']) {
    assert.match(renderSource, new RegExp(`log\\.${field}`));
  }
  assert.doesNotMatch(renderSource, /metadata/);
  assert.doesNotMatch(renderSource, /access_token/i);
  assert.doesNotMatch(renderSource, /password/i);
  assert.doesNotMatch(renderSource, /senha/i);
  assert.match(renderSource, /Nenhum erro crítico recente\./);
});

test('painel de saúde possui fallback discreto para erro de carregamento', async () => {
  const source = await readCommandCenter();
  assert.match(source, /catch \(error\)/);
  assert.match(source, /Não foi possível carregar a saúde do sistema\./);
});
