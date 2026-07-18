import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import worker from '../workers/api.js';
import { studentLinks } from '../workers/premium/presenters/professional-workspace-pending-presenter.js';

const html = () => readFileSync('public/admin-premium-workspace.html', 'utf8');
const js = () => readFileSync('public/admin-premium-workspace.js', 'utf8');
const redirects = () => readFileSync('public/_redirects', 'utf8');

function htmlIds(source) {
  return new Set([...source.matchAll(/\bid=["']([^"']+)["']/g)].map((m) => m[1]));
}

function existingRoute(pathname) {
  const clean = pathname.replace(/^\//, '').split('?')[0];
  return existsSync(clean) || existsSync(`public/${clean}`);
}

test('cutover flag routes /admin to workspace when enabled and legacy when disabled', async () => {
  const enabled = await worker.fetch(new Request('https://example.com/admin'), { PREMIUM_ADMIN_CUTOVER_ENABLED: 'true' });
  assert.equal(enabled.status, 302);
  assert.equal(enabled.headers.get('location'), 'https://example.com/admin-premium-workspace.html');

  const disabled = await worker.fetch(new Request('https://example.com/admin'), { PREMIUM_ADMIN_CUTOVER_ENABLED: 'false' });
  assert.equal(disabled.status, 302);
  assert.equal(disabled.headers.get('location'), 'https://example.com/admin-legacy.html');
});

test('redirects have one unambiguous rule per route and route /admin to the cutover bootstrap', () => {
  const parsed = redirects().split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => line.split(/\s+/));
  const seen = new Map();
  for (const [source, target] of parsed) {
    assert.ok(!seen.has(source), `${source} appears more than once in _redirects`);
    seen.set(source, target);
  }
  assert.equal(seen.get('/admin'), '/admin.html');
  for (const route of ['/admin-student.html', '/admin-legacy.html', '/admin-premium-workspace.html']) {
    if (seen.has(route)) assert.equal(seen.get(route), route, `${route} can only have a self rewrite for static inventory compatibility`);
  }
});

test('legacy rollback page is the real operational Admin Hub', () => {
  const legacy = readFileSync('public/admin-legacy.html', 'utf8');
  assert.match(legacy, /Legacy Admin — rollback only/);
  for (const text of ['Command Center', 'Student 360', 'Cadastro de aluno', 'adminLogoutBtn']) assert.match(legacy, new RegExp(text));
  assert.match(legacy, /admin-auth\.js/);
  assert.doesNotMatch(legacy, /http-equiv="refresh"/i);
});

test('workspace shell exposes minimal operational header without incomplete modules', () => {
  const source = html();
  for (const label of ['Workspace Premium', 'Buscar aluno', 'Atualizar', 'Sair', 'Alunos Premium', 'Contexto básico']) assert.match(source, new RegExp(label));
  for (const hidden of ['Visão Geral', 'Inbox operacional', 'Pendências', 'Feedback Semanal', 'Plano Alimentar', 'Student 360', 'Evolução', 'Configurações']) assert.doesNotMatch(source, new RegExp(hidden));
  assert.match(source, /data-admin-shell="premium-workspace"/);
  const ids = htmlIds(source);
  for (const [, hash] of source.matchAll(/href=["']#([^"']+)["']/g)) assert.ok(ids.has(hash), `Missing internal target #${hash}`);
});

test('student action contract uses student_id routes that point to real non-placeholder pages', () => {
  const links = studentLinks('student-123');
  for (const key of ['record', 'weeklyFeedback', 'nutritionPlan', 'anamnesis', 'student360']) {
    assert.ok(links[key], `${key} missing`);
    assert.match(links[key], /student_id=student-123/);
    const pathname = new URL(links[key], 'https://example.com').pathname;
    assert.ok(existingRoute(pathname), `${key} points to missing route ${pathname}`);
    assert.doesNotMatch(pathname, /admin-anamnesis\.html/);
  }
  assert.match(links.anamnesis, /admin-anamneses\.html\?student_id=/);
  assert.match(links.student360, /admin-student\.html\?student_id=/);
});

test('real Anamnese destination loads the existing functional admin screen', () => {
  const anamnesis = readFileSync('admin-anamneses.html', 'utf8');
  assert.match(anamnesis, /\/api\/admin\/anamneses/);
  assert.match(anamnesis, /window\.LMAdminAuth\.requireAdmin\(\)/);
  assert.match(anamnesis, /Carregar anamneses/);
});

test('Student 360 route remains functional and protected instead of redirecting to workspace', () => {
  const student360 = readFileSync('public/admin-student.html', 'utf8');
  assert.match(student360, /LM Student 360/);
  assert.match(student360, /student_id|studentSelect|studentEmailInput/);
  assert.match(student360, /\/api\/admin\/student-360/);
  assert.match(student360, /window\.LMAdminAuth\.getAdminAuthHeaders\(/);
  assert.doesNotMatch(student360, /http-equiv="refresh"/i);
});

test('workspace minimal load avoids incomplete operational modules and keeps cutover controlled elsewhere', () => {
  const source = js();
  assert.match(source.match(/async function loadAll\(\)[^{]*\{([^]*?)\n  function renderDashboardError/)?.[1] || '', /loadDashboard\(\)\.catch/);
  assert.match(source, /await loadStudents\(true\)/);
  assert.doesNotMatch(source, /Promise\.all\(\[loadSummary\(\), loadStudents/);
  assert.doesNotMatch(source, /loadSaturdayReview|loadPending\(/);
  assert.match(html(), /Workspace desligado por feature flag/);
});

test('selected student behavior opens only basic context and handles expired sessions safely', () => {
  const source = js();
  for (const action of ['Ver Feedbacks', 'Editar Plano Alimentar', 'Abrir Anamnese legada', 'Abrir Student 360', 'Ver Evolução', 'Pendência resolvida']) assert.doesNotMatch(source, new RegExp(action));
  assert.match(source, /loadContext\(id\)/);
  assert.match(source, /renderContext\(c\)/);
  assert.match(source, /window\.location\.assign/);
  assert.match(source, /Sessão expirada/);
  assert.match(source, /clearAdminSession/);
  assert.match(source, /Prontuário LM mínimo/);
});
