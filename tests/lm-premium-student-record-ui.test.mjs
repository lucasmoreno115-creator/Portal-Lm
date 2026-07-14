import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Prontuário LM renderiza estrutura, empty states e não expõe token', () => {
  const html = readFileSync(new URL('../public/admin-premium-student-record.html', import.meta.url), 'utf8');
  const js = readFileSync(new URL('../public/admin-premium-student-record.js', import.meta.url), 'utf8');
  assert.match(html, /Prontuário LM/);
  for (const text of ['Pendências', 'Anamnese', 'Plano alimentar atual', 'Feedbacks semanais', 'Evolução do acompanhamento']) assert.match(html, new RegExp(text));
  for (const text of ['Anamnese ainda não respondida', 'Plano alimentar ainda não criado', 'Nenhum feedback enviado', 'Nenhuma pendência aberta', 'Nenhum registro de evolução']) assert.match(js, new RegExp(text));
  assert.doesNotMatch(html + js, /access_token|x-admin-token'\s*:/);
  assert.match(js, /admin-nutrition-plan\.html\?email=/);
});

test('Student 360 expõe navegação do prontuário apenas com feature flag', () => {
  const html = readFileSync(new URL('../admin-student.html', import.meta.url), 'utf8');
  assert.match(html, /PREMIUM_STUDENT_RECORD_ENABLED/);
  assert.match(html, /admin-premium-student-record\.html\?student_id=/);
});
