import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile('public/admin-premium-workspace.html', 'utf8');
const runtime = await readFile('public/admin-premium-workspace.js', 'utf8');
const css = await readFile('public/assets/css/admin-premium-workspace.css', 'utf8');

test('F3.1 separates primary navigation from Workspace actions and marks overview active', () => {
  assert.match(html, /<nav aria-label="Navegação principal">[\s\S]*?class="primary-navigation"[\s\S]*?id="overview"[^>]*aria-current="page"[\s\S]*?id="studentsNav"[\s\S]*?Biblioteca alimentar[\s\S]*?<\/nav>/);
  assert.match(html, /class="header-actions"[\s\S]*?id="openCreate"[\s\S]*?id="refresh"[\s\S]*?id="adminLogoutBtn"/);
  assert.match(css, /#overview\[aria-current="page"\]/);
});

test('F3.1 daily operation uses only current summary fields and exposes honest states', () => {
  assert.match(html, /Operação de hoje[\s\S]*?O que precisa da sua atenção[\s\S]*?<time id="workspaceDate"/);
  assert.match(runtime, /renderWorkspaceDate\(data\.date\)/);
  for (const field of ['data.anamnesis.awaiting', 'data.anamnesis.underReview', 'data.anamnesis.readyToRelease', 'data.checkins.awaitingReview', 'data.checkins.withoutRecentResponse']) assert.ok(runtime.includes(field));
  assert.match(runtime, /handleWorkspaceSummaryError[\s\S]*?Não foi possível carregar[\s\S]*?retryBlock/);
  assert.match(runtime, /if \(!items\.length\)[\s\S]*?Nenhuma pendência no momento/);
  assert.doesNotMatch(runtime, /\/api\/admin\/premium\/workspace\/(?:upcoming|critical)/);
});

test('F3.1 responsive layout prevents narrow operational grids and preserves touch targets', () => {
  assert.match(css, /\.operational-panels\{display:grid/);
  assert.match(css, /@media\(max-width:760px\)[\s\S]*?\.operational-panels \.dashboard-blocks[^}]*grid-template-columns:1fr/);
  assert.match(css, /button,a\.button\{min-height:44px/);
});
