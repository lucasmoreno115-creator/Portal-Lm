import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const workspaceScript = () => readFile('public/admin-premium-workspace.js', 'utf8');

test('Workspace uses one centralized summary request to render cards and operational panels', async () => {
  const source = await workspaceScript();
  assert.equal((source.match(/api\('\/api\/admin\/premium\/workspace\/summary'\)/g) || []).length, 1);
  assert.match(source, /async function loadWorkspaceSummary\(\) \{ setDashboardLoading\(\); renderSummary\(await api\('\/api\/admin\/premium\/workspace\/summary'\)\); \}/);
  assert.match(source, /function renderSummary\(data\) \{ renderDashboardCards\(data\);[\s\S]*?anamnesisDashboard\.append[\s\S]*?checkinDashboard\.append/);
  assert.match(source, /loadWorkspaceSummary\(\)\.catch\(handleWorkspaceSummaryError\)/);
  assert.match(source, /Promise\.all\(\[loadRecord\(id\), loadStudents\(\), loadWorkspaceSummary\(\)\.catch\(handleWorkspaceSummaryError\)\]\)/);
});

test('Workspace maps official summary fields to the three dashboard cards', async () => {
  const source = await workspaceScript();
  assert.match(source, /anamnesisPendingValue[\s\S]*?data\.anamnesis\.awaiting/);
  assert.match(source, /checkinsAnsweredValue[\s\S]*?data\.checkins\.awaitingReview/);
  assert.match(source, /typeof withoutRecentResponse === 'number' \? withoutRecentResponse : '—'/);
  assert.match(source, /'checkinsOpenHint', typeof withoutRecentResponse[\s\S]*?'Aguardando definição'/);
});

test('Workspace clears card skeletons on both success and summary error', async () => {
  const source = await workspaceScript();
  assert.match(source, /function setDashboardCard[\s\S]*?if \(valueElement\)[\s\S]*?classList\?\.toggle\?\.\('skeleton', loading\)/);
  assert.match(source, /renderDashboardCards[\s\S]*?false\); \}/);
  assert.match(source, /handleWorkspaceSummaryError[\s\S]*?'Não foi possível carregar'[\s\S]*?false\)/);
  assert.match(source, /function setDashboardBusy/);
  assert.match(source, /workspaceDashboard'\)\?\.setAttribute\?\./);
});

test('Workspace markup provides stable identifiers for accessible card updates', async () => {
  const html = await readFile('public/admin-premium-workspace.html', 'utf8');
  for (const id of ['workspaceDashboard', 'anamnesisPendingValue', 'anamnesisPendingHint', 'checkinsAnsweredValue', 'checkinsAnsweredHint', 'checkinsOpenValue', 'checkinsOpenHint']) assert.match(html, new RegExp(`id="${id}"`));
});
