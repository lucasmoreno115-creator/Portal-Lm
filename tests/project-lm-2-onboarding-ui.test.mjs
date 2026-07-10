import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

const lm2Html = await readFile('public/project-lm-2.html', 'utf8');
const lm2App = await readFile('public/assets/js/project-lm-2-app.js', 'utf8');
const lm2State = await readFile('public/assets/js/project-lm-2-state.js', 'utf8');
const lm2Router = await readFile('public/assets/js/project-lm-2-router.js', 'utf8');
const v5Html = await readFile('public/project-lm-v5.html', 'utf8');
const premiumHtml = await readFile('anamnese-premium.html', 'utf8');

test('LM 2.0 renders the minimum welcome and onboarding screen copy', () => {
  for (const text of [
    'Projeto LM',
    'Você não precisa de mais motivação.',
    'Precisa de direção.',
    'Continuar mesmo quando a vida não sai como planejado.',
    'Como gostaria de ser chamado?',
    'Qual seu principal objetivo hoje?',
    'Sexo',
    'Qual seu peso e altura atuais?',
    'Sua direção está pronta: treino, plano alimentar e primeiros passos organizados.',
    'Sua jornada começa na Semana 1.',
    'Minha Direção',
    'Meu Treino',
    'Minha Alimentação',
    'Meu Plano B'
  ]) {
    assert.match(lm2Html + lm2App, new RegExp(escapeRegExp(text)));
  }
});

test('LM 2.0 onboarding navigation advances only through the requested routes', () => {
  for (const route of ['welcome', 'onboarding-name', 'onboarding-goal', 'onboarding-sex', 'onboarding-weight', 'direction-created', 'home', 'direction', 'week-1-placeholder', 'home-placeholder']) {
    assert.match(lm2Router, new RegExp(`["']?${escapeRegExp(route)}["']?:|["']${escapeRegExp(route)}["']`));
  }
  assert.match(lm2App, /data-route="onboarding-name"/);
  assert.match(lm2App, /routeTo\(root, 'onboarding-goal'\)/);
  assert.match(lm2App, /routeTo\(root, 'onboarding-sex'\)/);
  assert.match(lm2App, /routeTo\(root, 'onboarding-weight'\)/);
  assert.match(lm2App, /routeTo\(root, 'direction-created'\)/);
  assert.match(lm2App, /data-route="home"/);
  assert.match(lm2App, /data-route="direction"/);
  assert.match(lm2App, /week-1-placeholder/);
  assert.doesNotMatch(lm2App + lm2Router, /admin/i);
  assert.doesNotMatch(lm2App, /\/api\/.*premium/i);
});

test('LM 2.0 onboarding validates required fields with specified errors', () => {
  for (const message of [
    'Informe seu nome.',
    'Selecione um objetivo.',
    'Selecione uma opção.',
    'Informe um peso válido.',
    'Não foi possível criar sua direção. Tente novamente.'
  ]) {
    assert.match(lm2App, new RegExp(escapeRegExp(message)));
  }
});

test('LM 2.0 onboarding integrates POST onboarding and GET home on success', () => {
  assert.match(lm2App, /\/api\/project-lm-2\/onboarding/);
  assert.match(lm2App, /\/api\/project-lm-2\/home/);
  assert.match(lm2App, /method: 'POST'/);
  for (const field of ['name', 'goal', 'sex', 'weight_kg']) assert.match(lm2App, new RegExp(`\\b${field}\\b`));
  assert.match(lm2App, /onboarding_completed:\s*true/);
  assert.match(lm2App, /await requestLm2\(api\.home\)/);
});

test('LM 2.0 home waits for backend profile before deciding onboarding versus home', () => {
  assert.match(lm2App, /root\.dataset\.lm2NeedsHomeLoad = 'true';\s*render\(root, 'home'\);/);
  assert.match(lm2App, /if \(route === 'home'\) \{\s*if \(!state\.home_loaded && root\.dataset\.lm2NeedsHomeLoad === 'true'\) \{\s*delete root\.dataset\.lm2NeedsHomeLoad;\s*root\.innerHTML = renderLoadingCard\(\);\s*loadHome\(root\);\s*return;\s*\}\s*root\.innerHTML = renderHomeScreen\(state\);/s);
  assert.match(lm2App, /render\(root, homeData\.onboarding_completed === false \? 'welcome' : 'home'\)/);
  assert.doesNotMatch(lm2App, /if \(route === 'home'\) root\.innerHTML = renderHomeScreen\(state\);/);
});

test('LM 2.0 state tracks onboarding fields and completion only in LM 2.0 layer', () => {
  for (const field of ['name', 'goal', 'sex', 'weight_kg', 'onboarding_completed', 'home_loaded', 'home_data', 'direction_loaded']) {
    assert.match(lm2State, new RegExp(`${field}:`));
  }
  assert.match(lm2State, /updateState/);
  assert.match(lm2State, /resetState/);
});

test('V5 and Premium remain intact and do not load LM 2.0 onboarding UI', () => {
  assert.doesNotMatch(v5Html, /project-lm-2-app\.js|onboarding-name|CRIAR MINHA DIREÇÃO/);
  assert.doesNotMatch(premiumHtml, /project-lm-2-app\.js|onboarding-name|CRIAR MINHA DIREÇÃO/);
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
