import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('minimal Workspace exposes only validated operational surface', async () => {
  const html = await readFile('public/admin-premium-workspace.html', 'utf8');
  for (const pattern of [
    /<title>Workspace Premium<\/title>/,
    /<nav aria-label="Navegação principal">/,
    /<button id="studentsNav">Alunos<\/button>/,
    /<button id="openCreate">Cadastrar aluno<\/button>/,
    /<button id="refresh">Atualizar<\/button>/,
    /<section class="workspace-dashboard" aria-labelledby="workspaceDashboardHeading">/,
    /<article class="workspace-dashboard-card" data-dashboard-card="anamnesis-pending">[\s\S]*?Anamneses pendentes/,
    /<article class="workspace-dashboard-card" data-dashboard-card="checkins-answered">[\s\S]*?Check-ins respondidos/,
    /<article(?=[^>]*class="[^"]*\bworkspace-dashboard-card\b[^"]*")(?=[^>]*data-dashboard-card="checkins-open")(?=[^>]*(?:aria-disabled="true"|class="[^"]*\bis-unavailable\b[^"]*"))[^>]*>[\s\S]*?Check-ins em aberto/,
    /<section id="students" class="panel">[\s\S]*?<h2>Alunos Premium<\/h2>/,
    /<section id="record" class="panel context" hidden aria-labelledby="recordHeading">[\s\S]*?<h2 id="recordHeading" tabindex="-1">Prontuário LM<\/h2>/
  ]) assert.match(html, pattern);
  assert.doesNotMatch(html, /Contexto básico/);
  for (const hidden of ['Inbox operacional', 'Revisão semanal', 'Filtros', 'Pendências', 'Feedback Semanal', 'Student 360']) assert.doesNotMatch(html, new RegExp(hidden));
});

test('minimal Workspace logs sanitized endpoint diagnostics and does not load pending in normal flow', async () => {
  const js = await readFile('public/admin-premium-workspace.js', 'utf8');
  for (const endpoint of ['/api/admin/premium/workspace/summary', '/api/admin/premium/workspace/students', '/api/admin/premium/workspace/pending-items']) assert.match(js, new RegExp(endpoint.replaceAll('/', '\\/')));
  assert.match(js, /endpoint_result/);
  assert.match(js, /aggregateCount/);
  assert.match(js, /diagnoseWorkspaceEndpoints/);
  assert.match(js, /loadWorkspaceSummary\(\)\.catch\(handleWorkspaceSummaryError\)/);
  assert.match(js, /renderSummary\(data\)/);
  assert.match(js, /loadStudents\(\)\.catch/);
  assert.doesNotMatch(js, /loadPending\(/);
  assert.doesNotMatch(js, /renderPlan|loadSaturdayReview|resolvePending/);
});
