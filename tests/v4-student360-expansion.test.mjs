import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const rootDir = process.cwd();
const studentPath = path.join(rootDir, 'admin-student.html');

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

test('Student 360 não expõe tokens nem answers_json bruto', async () => {
  const html = await readStudent360();
  assert.ok(!html.includes('access_token'), 'Student 360 não deve referenciar access_token.');
  assert.ok(!/answers_json[^\n]+innerHTML|innerHTML[^\n]+answers_json/.test(html), 'Student 360 não deve renderizar answers_json bruto.');
  assert.ok(html.includes('Oculto por segurança'), 'Token do aluno deve permanecer oculto na UI.');
});

test('Student 360 envia sessão e token legado nos fetches administrativos', async () => {
  const html = await readStudent360();

  assert.match(html, /function getAdminAuthHeaders\(extraHeaders\)/);
  assert.match(html, /'x-admin-session': token/);
  assert.match(html, /'x-admin-token': token/);

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
