import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const js = readFileSync('public/admin-premium-workspace.js', 'utf8');
const css = readFileSync('public/assets/css/admin-premium-workspace.css', 'utf8');

for (const runtime of ['admin-premium-workspace.js', 'public/admin-premium-workspace.js', 'public/assets/js/admin-premium-workspace.js']) {
  test(`${runtime} mantém o runtime operacional sincronizado`, () => {
    assert.equal(readFileSync(runtime, 'utf8'), js);
  });
}

test('lista operacional preserva os dados atuais como chips textuais', () => {
  assert.match(js, /student\.operationalStatusLabel, 'student-status-chip student-status-chip-planning'/);
  assert.match(js, /`Anamnese: \$\{student\.anamnesisStatusLabel\}`, 'student-status-chip student-status-chip-anamnesis'/);
  assert.match(js, /`Último check-in: \$\{student\.weeklyFeedbackStatusLabel\}`, 'student-status-chip student-status-chip-checkin'/);
  assert.match(css, /\.student-operational-chips/);
  assert.match(css, /\.student-status-chip/);
});

test('aluno selecionado fica em atendimento e mantém Abrir Prontuário desabilitado', () => {
  assert.match(js, /node\('span', 'Em atendimento', 'student-status-chip student-status-chip-active'\)/);
  assert.match(js, /openButton\.disabled = selected \|\| openButton\.dataset\.unavailable === 'true'/);
  assert.match(css, /\.student-item\.is-selected/);
  assert.match(css, /\.student-status-chip-active/);
});

test('estado vazio orienta o profissional sem criar CTA', () => {
  assert.match(js, /Nenhum aluno Premium encontrado\.', 'muted'\), node\('p', 'Cadastre um aluno para iniciar o acompanhamento\.', 'muted'/);
});
