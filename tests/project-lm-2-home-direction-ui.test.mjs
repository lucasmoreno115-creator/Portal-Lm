import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

const lm2App = await readFile('public/assets/js/project-lm-2-app.js', 'utf8');
const lm2State = await readFile('public/assets/js/project-lm-2-state.js', 'utf8');
const lm2Router = await readFile('public/assets/js/project-lm-2-router.js', 'utf8');
const lm2Html = await readFile('public/project-lm-2.html', 'utf8');
const v5Html = await readFile('public/project-lm-v5.html', 'utf8');
const premiumHtml = await readFile('anamnese-premium.html', 'utf8');
const portalHtml = await readFile('portal.html', 'utf8');

const lm2Bundle = `${lm2App}\n${lm2State}\n${lm2Router}`;

test('Home renders the requested minimum journey data from GET home', () => {
  for (const text of ['Olá ${escapeHtml(state.name)}', 'Semana ${state.current_week} de 4', 'Dias de continuidade', '${state.continuity_days_count} de ${state.required_days_count} necessários', 'Próxima ação:', 'Sua jornada começa na Semana 1.']) {
    assert.match(lm2App, new RegExp(escapeRegExp(text)));
  }
  assert.match(lm2App, /requestLm2\(api\.home\)/);
  assert.match(lm2App, /applyHomeData\(\{ \.\.\.\(home\.data \|\| home\), \.\.\.\(progress\.data \|\| \{\}\) \}\)/);
});

test('Minha Direção renders exactly the three requested blocks', () => {
  for (const text of ['Minha Direção', 'As ferramentas que vão ajudar você a continuar.', 'Meu Treino', 'Seu treino já foi definido para esta jornada.', 'ABRIR TREINO', 'Minha Alimentação', 'Seu plano alimentar já foi definido para esta jornada.', 'ABRIR PLANO', 'Meu Plano B', 'Sua estratégia para continuar quando a vida não sair como planejado.', 'EM BREVE']) {
    assert.match(lm2App, new RegExp(escapeRegExp(text)));
  }
  assert.equal((lm2App.match(/<article class="lm2-block">/g) || []).length, 3);
});

test('Home, Direction, and Week 1 navigation is wired', () => {
  for (const route of ['home', 'direction', 'week-1']) {
    assert.match(lm2Router, new RegExp(`${route}:|['"]${route}['"]`));
  }
  assert.match(lm2App, /data-route="direction">MINHA DIREÇÃO/);
  assert.match(lm2App, /data-route="home">VOLTAR PARA HOME/);
  assert.match(lm2App, /week-1-placeholder/);
  assert.match(lm2App, /Pare de Recomeçar/);
  assert.match(lm2App, /Por que você sempre recomeça\?/);
  assert.match(lm2App, /SALVAR MEU PLANO B/);
  assert.doesNotMatch(lm2Bundle, /data-check-in|progression|progressão/i);
});

test('LM 2.0 state tracks only the requested new screen flags', () => {
  for (const field of ['home_loaded', 'home_data', 'direction_loaded']) {
    assert.match(lm2State, new RegExp(`${field}:`));
  }
  assert.match(lm2State, /week_status:/);
  assert.match(lm2State, /week_completed: false/);
  assert.match(lm2State, /next_week_available: false/);
  assert.doesNotMatch(lm2State, /week_1_loaded/i);
});

test('V5, Premium, Admin, and LM 2.0 asset isolation remain intact', () => {
  assert.doesNotMatch(v5Html, /project-lm-2-app\.js|Minha Direção|week-1/);
  assert.doesNotMatch(premiumHtml, /project-lm-2-app\.js|Minha Direção|week-1/);
  assert.doesNotMatch(portalHtml, /project-lm-2-app\.js|Minha Direção|week-1/);
  assert.match(lm2Html, /project-lm-2-app\.js/);
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
