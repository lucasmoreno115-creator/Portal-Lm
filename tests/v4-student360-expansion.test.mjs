import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const rootDir = process.cwd();
const studentPath = path.join(rootDir, 'admin-student.html');
const apiPath = path.join(rootDir, 'workers/api.js');

async function readStudent360() {
  await assert.doesNotReject(access(studentPath));
  return readFile(studentPath, 'utf8');
}

test('Student 360 contém blocos operacionais expandidos', async () => {
  const html = await readStudent360();
  for (const label of ['Bloco Check-ins', 'Bloco Plano Semanal', 'Bloco Plano Alimentar', 'Bloco Anamnese']) {
    assert.ok(html.includes(label), `Student 360 deve conter ${label}.`);
  }
});

test('Student 360 reutiliza endpoints e telas auxiliares existentes', async () => {
  const html = await readStudent360();
  for (const endpoint of [
    '/api/admin/student-360?email=',
    '/api/admin/checkins/${encodeURIComponent(latestCheckinId)}/reply',
    '/api/admin/weekly-plan',
    '/admin-checkins.html?email=',
    '/admin-weekly-plan.html?email=',
    '/admin-nutrition-plan.html?email=',
    '/admin-anamneses.html?email='
  ]) {
    assert.ok(html.includes(endpoint), `Student 360 deve reutilizar ${endpoint}.`);
  }
});

test('Student 360 mascara a senha temporária e não expõe dados brutos', async () => {
  const html = await readStudent360();
  assert.ok(!html.includes('access_token'), 'Student 360 não deve referenciar access_token.');
  assert.ok(!/answers_json[^\n]+innerHTML|innerHTML[^\n]+answers_json/.test(html), 'Student 360 não deve renderizar answers_json bruto.');
  assert.ok(html.includes('Senha temporária'), 'Student 360 deve nomear a credencial como senha temporária.');
  assert.ok(html.includes('maskCredential'), 'Student 360 deve mascarar a senha temporária por padrão.');
  assert.ok(html.includes('showCredentialBtn'), 'Student 360 deve ter ação para mostrar a credencial somente na sessão admin.');
  assert.ok(html.includes('Senha já alterada pelo aluno.'), 'Student 360 deve informar quando não houver senha temporária válida.');
});


test('Student 360 envia sessão e token legado nos fetches administrativos', async () => {
  const html = await readStudent360();

  assert.match(html, /window\.LMAdminAuth\.getAdminAuthHeaders\(/);

  for (const endpoint of [
    '/api/admin/students',
    '/api/admin/student-360?email=',
    '/api/admin/student-access/token',
    '/api/admin/student-access/activate',
    '/api/admin/student-access/status',
    '/api/admin/weekly-plan'
  ]) {
    assert.ok(html.includes(endpoint), `Student 360 deve preservar chamada para ${endpoint}.`);
  }

  assert.ok(!html.includes("'Authorization'"), 'Student 360 não deve trocar para Authorization.');
});


test('botão Liberar acesso usa o helper compartilhado com sessão e token admin', async () => {
  const html = await readStudent360();
  const activateHandlerMatch = html.match(new RegExp("activateAccessBtn\\.addEventListener\\('click', async \\(\\) => \\{[\\s\\S]*?fetch\\('/api/admin/student-access/activate',[\\s\\S]*?\\n\\s*\\}\\);"));

  assert.ok(activateHandlerMatch, 'Student 360 deve ter handler específico para o botão Liberar acesso.');

  const handler = activateHandlerMatch[0];
  assert.match(handler, /headers:\s*window\.LMAdminAuth\.getAdminAuthHeaders\(\{ 'Content-Type': 'application\/json' \}\)/, 'Liberar acesso deve usar LMAdminAuth.getAdminAuthHeaders.');
  assert.doesNotMatch(handler, /headers:\s*\{[\s\S]*?x-admin-(session|token)/, 'Liberar acesso não deve montar headers admin manualmente.');
  assert.ok(html.includes("activateAccessCardBtn.addEventListener('click', () => activateAccessBtn.click())"), 'Card Liberar acesso deve delegar para o mesmo handler autenticado.');
});


test('rota activate do Student 360 permanece dentro do gate admin compartilhado', async () => {
  const source = await readFile(apiPath, 'utf8');
  const gateIndex = source.indexOf("if (url.pathname.startsWith('/api/admin/'))");
  const activateIndex = source.indexOf("if (url.pathname === '/api/admin/student-access/activate' && method === 'POST')");

  assert.ok(gateIndex >= 0, 'API deve manter gate compartilhado para /api/admin/.');
  assert.ok(activateIndex > gateIndex, 'Rota student-access/activate deve ser avaliada dentro do gate admin compartilhado.');
  assert.match(source.slice(gateIndex, activateIndex), /isAdminAuthorized\(request, env\)/, 'Gate admin compartilhado deve validar isAdminAuthorized antes da rota activate.');
});

test('Student 360 possui fallbacks discretos por bloco operacional', async () => {
  const html = await readStudent360();
  for (const fallback of [
    'Sem check-in registrado.',
    'Sem objetivo do planejamento ativo na semana atual.',
    'Sem plano alimentar ativo.',
    'Sem anamnese registrada.',
    'Sem resposta registrada para o último check-in.'
  ]) {
    assert.ok(html.includes(fallback), `Fallback ausente: ${fallback}`);
  }
});

test('telas auxiliares preservadas continuam existindo', async () => {
  for (const screen of ['admin-checkins.html', 'admin-weekly-plan.html', 'admin-nutrition-plan.html', 'admin-anamneses.html']) {
    await assert.doesNotReject(access(path.join(rootDir, screen)), `${screen} deve existir.`);
  }
});
