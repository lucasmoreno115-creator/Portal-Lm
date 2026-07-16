import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, existsSync } from 'node:fs';

const html = () => readFileSync('public/admin-premium-workspace.html', 'utf8');
const js = () => readFileSync('public/admin-premium-workspace.js', 'utf8');

test('official admin entry is canonical /admin with legacy rollback redirects', () => {
  const redirects = readFileSync('public/_redirects', 'utf8');
  assert.match(redirects, /\/admin \/admin-premium-workspace\.html 200/);
  assert.match(redirects, /\/admin\.html \/admin 302/);
  assert.match(redirects, /\/admin-student\.html \/admin 302/);
  assert.match(html(), /<link rel="canonical" href="\/admin">/);
  assert.ok(existsSync('public/admin-legacy.html'));
  assert.match(readFileSync('public/admin-legacy.html', 'utf8'), /Legacy Admin — rollback only/);
});

test('workspace shell exposes unified admin navigation without redesigning visual base', () => {
  const source = html();
  for (const label of ['Visão Geral', 'Alunos', 'Pendências', 'Feedback Semanal', 'Prontuário LM', 'Plano Alimentar', 'Anamnese', 'Student 360', 'Evolução', 'Configurações', 'Sair']) assert.match(source, new RegExp(label));
  assert.match(source, /data-admin-shell="premium-workspace"/);
  assert.match(source, /id="contextBody"/);
  assert.match(source, /id="pendingList"/);
  assert.match(source, /id="studentList"/);
});

test('selected student context opens integrated modules by student_id routes', () => {
  const source = js();
  for (const action of ['Abrir Prontuário', 'Ver Feedbacks', 'Editar Plano Alimentar', 'Ver Anamnese', 'Abrir Student 360', 'Ver Evolução']) assert.match(source, new RegExp(action));
  assert.match(source, /state\.actions = c\.actions/);
  assert.match(source, /data-context-action/);
  assert.match(source, /encodeURIComponent\(id\)/);
});

test('inbox resolution refreshes counters and preserves list position with success feedback', () => {
  const source = js();
  assert.match(source, /state\.lastPendingScroll/);
  assert.match(source, /loadSummary\(\), loadPending\(\), loadStudents\(true\)/);
  assert.match(source, /Pendência resolvida\. Inbox atualizada\./);
  assert.match(source, /Abrir aluno e feedback/);
});

test('workspace has accessibility and feature flag states', () => {
  const source = html();
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /aria-label="Navegação administrativa"/);
  assert.match(source, /Workspace desligado por feature flag/);
  assert.match(source, /type="button"/);
});
