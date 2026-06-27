import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

const lm2App = await readFile('public/assets/js/project-lm-2-app.js', 'utf8');
const lm2State = await readFile('public/assets/js/project-lm-2-state.js', 'utf8');
const lm2Router = await readFile('public/assets/js/project-lm-2-router.js', 'utf8');
const v5Html = await readFile('public/project-lm-v5.html', 'utf8');
const premiumHtml = await readFile('anamnese-premium.html', 'utf8');
const adminHtml = await readFile('admin.html', 'utf8');

test('LM 2.0 Home renderiza CTA CONTINUAR PARA SEMANA 2', () => {
  assert.match(lm2App, /week_1_complete/);
  assert.match(lm2App, /Parabéns\./);
  assert.match(lm2App, /Você concluiu sua primeira semana\./);
  assert.match(lm2App, /CONTINUAR PARA SEMANA 2/);
  assert.match(lm2App, /data-route="\$\{state\.next_action === 'week_1_complete' \? 'week-complete'/);
});

test('LM 2.0 week-complete renderiza mensagem de celebração', () => {
  assert.match(lm2Router, /'week-complete': \{ path: '#week-complete'/);
  for (const text of ['Você não precisou ser perfeito.', 'Você precisou continuar.', 'Nos dias bons, você continuou.', 'Nos dias difíceis, você também encontrou uma forma de continuar.', 'E isso é o que realmente gera resultado.', 'IR PARA SEMANA 2']) {
    assert.match(lm2App, new RegExp(escapeRegExp(text)));
  }
});

test('LM 2.0 week-2 oficial existe e state acompanha Semana 2', () => {
  assert.match(lm2Router, /'week-2': \{ path: '#week-2'/);
  for (const text of ['Semana 2', 'Dias difíceis fazem parte.', 'Como continuar quando o dia sai do controle', 'Qual situação costuma fazer você abandonar o plano?', 'Quando essa situação acontecer novamente, qual será sua resposta mínima?', 'SALVAR REFLEXÃO', 'SALVAR RESPOSTA']) {
    assert.match(lm2App, new RegExp(escapeRegExp(text)));
  }
  assert.match(lm2State, /week_2_status: null/);
  assert.match(lm2State, /week_2_video_completed: false/);
  assert.match(lm2State, /week_2_reflection_completed: false/);
  assert.match(lm2State, /week_2_response_completed: false/);
});

test('V5, Premium e Admin permanecem intactos', () => {
  assert.doesNotMatch(v5Html, /week-complete|week-2|CONTINUAR PARA SEMANA 2/);
  assert.doesNotMatch(premiumHtml, /week-complete|week-2|CONTINUAR PARA SEMANA 2/);
  assert.doesNotMatch(adminHtml, /week-complete|week-2|CONTINUAR PARA SEMANA 2/);
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
