import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

const lm2App = await readFile('public/assets/js/project-lm-2-app.js', 'utf8');
const lm2State = await readFile('public/assets/js/project-lm-2-state.js', 'utf8');
const lm2Router = await readFile('public/assets/js/project-lm-2-router.js', 'utf8');
const lm2Css = await readFile('public/assets/css/project-lm-2.css', 'utf8');
const lm2Html = await readFile('public/project-lm-2.html', 'utf8');
const v5Html = await readFile('public/project-lm-v5.html', 'utf8');
const premiumHtml = await readFile('anamnese-premium.html', 'utf8');
const portalHtml = await readFile('portal.html', 'utf8');

const lm2Bundle = `${lm2App}\n${lm2State}\n${lm2Router}`;

test('Home renders as a contextual assistant with one dominant primary action', () => {
  for (const text of [
    'function getHomeContext(state)',
    'function renderHomeScreen(state)',
    'Hoje, registre como você continuou.',
    'Vamos continuar exatamente de onde você parou.',
    'Hoje, assista à aula da semana.',
    'lm2-focus-card',
    'lm2-progress-card',
    'lm2-tools',
    'lm2-insight'
  ]) {
    assert.match(lm2App, new RegExp(escapeRegExp(text)));
  }
  const homeRenderer = lm2App.slice(lm2App.indexOf('function renderHomeScreen'), lm2App.indexOf('async function loadHome'));
  assert.equal((homeRenderer.match(/lm2-focus-cta/g) || []).length, 1);
  assert.equal((homeRenderer.match(/lm2-primary-button/g) || []).length, 1);
  assert.doesNotMatch(homeRenderer, /data-route=\"direction\">MINHA DIREÇÃO|Atualizar informações<\/button>/);
  assert.match(lm2App, /requestLm2\(api\.home\)/);
  assert.match(lm2App, /const homeData = \{ \.\.\.\(home\.data \|\| home\), \.\.\.\(progress\.data \|\| \{\}\) \}/);
  assert.match(lm2App, /applyHomeData\(homeData\)/);
});

test('Minha Direção renders exactly the three requested blocks', () => {
  for (const text of ['Minha Direção', 'As ferramentas que vão ajudar você a continuar.', 'Meu Treino', 'Seu treino já foi definido para esta jornada.', 'Abrir meu treino', 'Minha Alimentação', 'Seu plano alimentar já foi definido para esta jornada.', 'Abrir meu plano alimentar', 'Meu Plano B', 'Sua estratégia para continuar quando a vida não sair como planejado.', 'EM BREVE']) {
    assert.match(lm2App, new RegExp(escapeRegExp(text)));
  }
  const directionScreen = lm2App.slice(lm2App.indexOf("if (route === 'direction')"), lm2App.indexOf("if (route === 'training')"));
  assert.equal((directionScreen.match(/<article class="lm2-block">/g) || []).length, 3);
});

test('Home, Direction, and Week 1 navigation is wired', () => {
  for (const route of ['home', 'direction', 'week-1', 'library']) {
    assert.match(lm2Router, new RegExp(`[\'\"]?${escapeRegExp(route)}[\'\"]?:|[\'\"]${escapeRegExp(route)}[\'\"]`));
  }
  assert.match(lm2App, /if \(route === 'direction'\) root\.innerHTML/);
  assert.match(lm2App, /data-route="home">VOLTAR PARA HOME/);
  assert.match(lm2App, /week-1-placeholder/);
  assert.match(lm2App, /Pare de Recomeçar/);
  assert.match(lm2App, /Por que você sempre recomeça\?/);
  assert.match(lm2App, /SALVAR MEU PLANO B/);
  assert.doesNotMatch(lm2Bundle, /data-check-in|progression|progressão/i);
});


test('Home secondary tools have equal structure and do not compete with the Focus Card', () => {
  const homeRenderer = lm2App.slice(lm2App.indexOf('function renderHomeScreen'), lm2App.indexOf('async function loadHome'));
  for (const tool of ['Treino', 'Plano Alimentar', 'Plano B', 'Biblioteca', 'Perfil']) {
    assert.match(homeRenderer, new RegExp(escapeRegExp(tool)));
  }
  assert.equal((homeRenderer.match(/renderToolButton\(/g) || []).length, 5);
  assert.match(lm2App, /function renderToolButton\(route, icon, label, description\)/);
  assert.match(lm2Router, /library: \{ path: '#library', label: 'Biblioteca' \}/);
});

test('Projeto LM router exposes internal training and nutrition routes', () => {
  assert.match(lm2Router, /training: \{ path: '#training', label: 'Treino' \}/);
  assert.match(lm2Router, /nutrition: \{ path: '#nutrition', label: 'Plano alimentar' \}/);
});

test('Projeto LM direction buttons navigate internally to training and nutrition screens', () => {
  assert.match(lm2App, /data-route="training">Abrir meu treino/);
  assert.match(lm2App, /data-route="nutrition">Abrir meu plano alimentar/);
  assert.match(lm2App, /if \(route === 'training'\) root\.innerHTML = renderTrainingScreen\(state\)/);
  assert.match(lm2App, /if \(route === 'nutrition'\) root\.innerHTML = renderNutritionScreen\(state\)/);
  assert.doesNotMatch(lm2App, /data-open-training|data-open-nutrition|project-lm-2-\$\{type\}\.html/);
});

test('Projeto LM internal training and nutrition screens handle recognized ids and friendly fallbacks', () => {
  for (const plan of ['gym_male', 'gym_female', 'home']) assert.match(lm2App, new RegExp(`${plan}:`));
  for (const plan of ['H1', 'H2', 'H3', 'M1', 'M2', 'M3']) assert.match(lm2App, new RegExp(`${plan}:`));
  assert.match(lm2App, /Seu treino ainda não está disponível\. Volte para a Home e tente novamente mais tarde\./);
  assert.match(lm2App, /Seu plano alimentar ainda não está disponível\. Volte para a Home e tente novamente mais tarde\./);
  assert.match(lm2App, /data-route="direction">VOLTAR PARA MINHA DIREÇÃO/);
  assert.match(lm2App, /data-route="home">VOLTAR PARA HOME/);
});


test('Projeto LM training screen renders an immersive guided workout mode', () => {
  for (const text of [
    'function getTrainingSession(plan = {})',
    'lm2-training-mode',
    'Projeto LM · Modo Treino',
    'O que eu preciso fazer agora?',
    'Exercício ${exercisePosition} de ${session.totalExercises}',
    'Supino reto',
    '4 séries',
    '8–10 repetições',
    'Descanso',
    'Carga anterior: —',
    'Registro de séries entra na próxima etapa.',
    'Próximo',
    'Sair'
  ]) {
    assert.match(lm2App, new RegExp(escapeRegExp(text)));
  }
  const trainingRenderer = lm2App.slice(lm2App.indexOf('function renderTrainingScreen'), lm2App.indexOf('function renderNutritionScreen'));
  assert.equal((trainingRenderer.match(/<ul class="lm2-list">/g) || []).length, 0);
  assert.match(lm2Css, /\.lm2-current-exercise h1 \{[\s\S]*font-size: clamp\(4\.2rem, 17vw, 11\.4rem\)/);
  assert.match(lm2Css, /\.lm2-exercise-prescription div \{[\s\S]*background: transparent/);
  assert.match(lm2Css, /\.lm2-next-exercise \{[\s\S]*opacity: 0\.62/);
  assert.doesNotMatch(trainingRenderer, /VOLTAR PARA MINHA DIREÇÃO|<article class="lm2-block"><h2>\$\{escapeHtml\(plan\.title\)\}/);
});

test('Projeto LM training and nutrition integration does not use physical pages or forbidden destinations', async () => {
  await assert.rejects(() => readFile('public/projeto-lm/treino/index.html', 'utf8'), /ENOENT/);
  await assert.rejects(() => readFile('public/projeto-lm/plano-alimentar/index.html', 'utf8'), /ENOENT/);
  for (const source of [lm2App, lm2Router]) {
    assert.doesNotMatch(source, /portal-plano-alimentar\.html|MFIT|project-lm-profile\.html|project-lm-v5\.html/);
    assert.doesNotMatch(source, /projeto-lm\/(treino|plano-alimentar)|projeto-lm-[\w-]+\.html|project-lm-2-\$\{type\}\.html/);
  }
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
