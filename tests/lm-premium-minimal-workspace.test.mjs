import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('minimal Workspace exposes only validated operational surface', async () => {
  const html = await readFile('public/admin-premium-workspace.html', 'utf8');
  for (const text of ['Workspace Premium', 'Buscar aluno', 'Cadastrar aluno', 'Operação', 'Atualizar', 'Sair', 'Alunos Premium', 'Contexto básico', 'Tentar novamente']) assert.match(html, new RegExp(text));
  for (const hidden of ['Inbox operacional', 'Revisão semanal', 'Filtros', 'Pendências', 'Feedback Semanal', 'Student 360']) assert.doesNotMatch(html, new RegExp(hidden));
});

test('minimal Workspace logs sanitized endpoint diagnostics and does not load pending in normal flow', async () => {
  const js = await readFile('public/admin-premium-workspace.js', 'utf8');
  for (const endpoint of ['/api/admin/premium/workspace/summary', '/api/admin/premium/workspace/students', '/api/admin/premium/workspace/pending-items']) assert.match(js, new RegExp(endpoint.replaceAll('/', '\\/')));
  assert.match(js, /endpoint_result/);
  assert.match(js, /aggregateCount/);
  assert.match(js, /diagnoseWorkspaceEndpoints/);
  assert.match(js.match(/async function loadAll\(\)[^{]*\{([^]*?)\n  function renderDashboardError/)?.[1] || '', /loadDashboard\(\)\.catch/);
  assert.doesNotMatch(js, /loadPending\(/);
  assert.doesNotMatch(js, /renderPlan|renderAnamnesis|loadSaturdayReview|resolvePending/);
});

