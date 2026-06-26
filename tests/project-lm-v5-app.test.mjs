import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const appSource = await readFile('public/assets/js/project-lm-v5-app.js', 'utf8');
const htmlSource = await readFile('public/project-lm-v5.html', 'utf8');
const cssSource = await readFile('public/assets/css/project-lm-v5.css', 'utf8');

const officialRoutes = [
  '#project-lm/journey',
  '#project-lm/stage-1-actions',
  '#project-lm/plan-b',
  '#project-lm/victories',
  '#project-lm/recovery',
  '#project-lm/maintenance-goals'
];

test('Project LM V5 app integrates only with V5 state and screen contracts', () => {
  assert.match(appSource, /ProjectLmV5State/);
  assert.match(appSource, /ProjectLmV5ScreenContracts/);
  assert.match(appSource, /loadJourney\s*\(/);
  assert.match(htmlSource, /project-lm-v5-state\.js/);
  assert.match(htmlSource, /project-lm-v5-screen-contracts\.js/);
  assert.match(htmlSource, /project-lm-v5-app\.js/);
  assert.match(htmlSource, /assets\/css\/project-lm-v5\.css/);
});

test('Project LM V5 HTML loads only isolated V5 assets', () => {
  const assetRefs = [...htmlSource.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1]).filter((ref) => ref.startsWith('/'));
  assert.deepEqual(assetRefs, [
    '/assets/css/project-lm-v5.css',
    '/assets/js/project-lm-v5-state.js',
    '/assets/js/project-lm-v5-screen-contracts.js',
    '/assets/js/project-lm-v5-app.js'
  ]);
});

test('Project LM V5 app registers hash router with official routes', () => {
  assert.match(appSource, /addEventListener\('hashchange',\s*hashChangeHandler\)/);
  for (const route of officialRoutes) assert.ok(appSource.includes(route), `missing route ${route}`);
  assert.match(appSource, /#project-lm\/journey/);
});

test('Project LM V5 app renders one route block at a time', () => {
  assert.match(appSource, /function renderCurrentRoute\(state\)/);
  assert.match(appSource, /const isOverviewRoute = route === '#project-lm\/journey'/);
  assert.match(appSource, /elements\.overview\.hidden = !isOverviewRoute/);
  assert.match(appSource, /elements\.stageCards\.hidden = !isOverviewRoute/);
  assert.match(appSource, /elements\.screen\.hidden = isOverviewRoute/);
  assert.match(appSource, /if \(isOverviewRoute\) \{\s*renderOverview\(state\);\s*renderStageCards\(state\);\s*\} else \{\s*renderScreen\(state\);\s*\}/s);
});

test('Project LM V5 app uses official contracts for navigation priority', () => {
  assert.match(appSource, /contracts\.getFlowForAction\(viewModel\.primary_cta\.action\)/);
  assert.match(appSource, /contracts\.getScreenForNextRequiredAction\(state\?\.progress\?\.next_required_action\)/);
  assert.match(appSource, /function getCurrentActionScreen\(state\)/);
  assert.match(appSource, /function getStageCardScreen\(card, state\)/);
  assert.doesNotMatch(appSource, /getScreenForStage\(/);
});

test('Project LM V5 app centralizes safe text rendering', () => {
  assert.match(appSource, /function safeText\(node, value\)/);
  assert.match(appSource, /node\.textContent = value === null \|\| value === undefined \? '' : String\(value\)/);
  assert.match(appSource, /safeText\(elements\.pageTitle/);
  assert.match(appSource, /safeText\(node, text\(content\)\)/);
});

test('Project LM V5 app stores unsubscribe and exposes destroy cleanup', () => {
  assert.match(appSource, /let unsubscribe = null/);
  assert.match(appSource, /unsubscribe = store\.subscribe\(render\)/);
  assert.match(appSource, /function destroy\(\)/);
  assert.match(appSource, /if \(typeof unsubscribe === 'function'\) unsubscribe\(\)/);
  assert.match(appSource, /removeEventListener\('hashchange', hashChangeHandler\)/);
  assert.match(appSource, /ProjectLmV5App = Object\.freeze\(\{[^}]*destroy/s);
});

test('Project LM V5 app renders form_contract placeholders and actions', () => {
  assert.match(appSource, /renderFormContract/);
  assert.match(appSource, /formContract\.fields/);
  assert.match(appSource, /formContract\.submit_action/);
  assert.match(appSource, /createStage1Actions/);
  assert.match(appSource, /savePlanB/);
  assert.match(appSource, /createVictory/);
  assert.match(appSource, /saveRecovery/);
  assert.match(appSource, /createMaintenanceGoal/);
  assert.match(appSource, /completeStage1Action/);
  assert.match(appSource, /actions:\s*formContract\.fields\.map/);
  assert.match(appSource, /field\.type === 'textarea'/);
  assert.match(appSource, /input\.required = Boolean\(field\.required\)/);
});

test('Project LM V5 app simplifies journey navigation and prevents locked cards from navigating', () => {
  assert.match(appSource, /appendRouteLink\(contracts\.getScreenByKey\('journey_overview'\), screenKey, 'Visão geral'\)/);
  assert.match(appSource, /appendRouteLink\(nextScreen, screenKey, 'Próxima ação'\)/);
  assert.doesNotMatch(appSource, /contracts\.screens\.forEach/);
  assert.match(appSource, /status === 'active' \|\| status === 'completed' \|\| status === 'locked' \|\| status === 'maintenance'/);
  assert.match(appSource, /button\.disabled = !screen \|\| status === 'locked' \|\| status === 'completed'/);
  assert.match(appSource, /if \(screen && status !== 'locked' && status !== 'completed'\) navigateToScreen\(screen\.key\)/);
});

test('Project LM V5 UI foundation renders header, progress, cards and visual states', () => {
  assert.match(htmlSource, /Projeto LM/);
  assert.match(htmlSource, /Continue mesmo nos dias difíceis\./);
  assert.match(htmlSource, /data-plmv5="percentage-text"/);
  assert.match(appSource, /state\?\.progress\?\.percentage/);
  assert.match(appSource, /readableAction\(state\?\.progress\?\.next_required_action\)/);
  assert.match(appSource, /plmv5-stage-card is-/);
  assert.match(appSource, /screenState\.status === 'locked'/);
  assert.match(appSource, /screenState\.status === 'completed'/);
  assert.match(appSource, /screenState\.status === 'maintenance'/);
  assert.match(appSource, /state\?\.saving/);
});

test('Project LM V5 CSS remains prefixed and responsive', () => {
  assert.match(cssSource, /\.plmv5-header/);
  assert.match(cssSource, /\.plmv5-status/);
  assert.match(cssSource, /\.plmv5-stage-card/);
  assert.match(cssSource, /\.plmv5-form/);
  assert.match(cssSource, /@media \(max-width: 900px\)/);
  assert.match(cssSource, /@media \(max-width: 560px\)/);
  assert.doesNotMatch(cssSource, /\.(?!plmv5|is-|:root|body|button|input|textarea|\*)[a-z][a-z0-9_-]*\s*\{/i);
});


test('Project LM V5 UX foundation adds guidance, accessible skip navigation and readable statuses', () => {
  assert.match(htmlSource, /plmv5-skip-link/);
  assert.match(htmlSource, /href="#plmv5-main-content"/);
  assert.match(htmlSource, /id="plmv5-main-content"/);
  assert.match(appSource, /const STATUS_LABELS = Object\.freeze/);
  assert.match(appSource, /const UX_COPY = Object\.freeze/);
  assert.match(appSource, /Seu próximo passo/);
  assert.match(appSource, /O foco agora não é fazer tudo/);
  assert.match(appSource, /function renderOverviewIntro\(state\)/);
  assert.match(appSource, /readableStatus\(screenState\.status\)/);
  assert.match(appSource, /UX_COPY\.lockedHint/);
  assert.match(appSource, /UX_COPY\.completedHint/);
  assert.match(appSource, /Voltar para a visão geral/);
  assert.match(appSource, /function focusMainContent\(\)/);
  assert.match(appSource, /main\.focus\(\{ preventScroll: true \}\)/);
  assert.match(cssSource, /\.plmv5-skip-link/);
  assert.match(cssSource, /\.plmv5-ux-intro/);
  assert.match(cssSource, /\.plmv5-back-link/);
});

test('Project LM V5 app implements official V5-09 emotional UX copy', () => {
  assert.match(appSource, /Preparando sua jornada/);
  assert.match(appSource, /Organizando o próximo passo para você continuar/);
  assert.match(appSource, /Registrando seu progresso/);
  assert.match(appSource, /Algo não saiu como esperado/);
  assert.match(appSource, /Sua jornada continua segura/);
  assert.match(appSource, /Pequenas ações repetidas vencem grandes planos abandonados/);
  assert.match(appSource, /Você está construindo sua base/);
  assert.match(appSource, /Você já começou a criar consistência/);
  assert.match(appSource, /Seu sistema está ficando mais forte/);
  assert.match(appSource, /Você está perto de concluir sua jornada/);
  assert.match(appSource, /Hora de proteger o que foi construído/);
});

test('Project LM V5 app implements official V5-09 state copy and feedback', () => {
  assert.match(appSource, /Jornada concluída/);
  assert.match(appSource, /Agora o objetivo é proteger o que você construiu/);
  assert.match(appSource, /Você já possui um sistema para continuar/);
  assert.match(appSource, /Você ainda não precisa se preocupar com esta etapa/);
  assert.match(appSource, /Concentre-se apenas no passo atual/);
  assert.match(appSource, /Esta etapa já faz parte da sua base/);
  assert.match(appSource, /Salvo com sucesso/);
  assert.match(appSource, /Mais um passo construído/);
  assert.match(appSource, /Ação concluída/);
  assert.match(appSource, /Continuar conta mais do que perfeição/);
  assert.match(appSource, /Vitória registrada/);
  assert.match(appSource, /Reconhecer o progresso ajuda a sustentar o processo/);
});

test('Project LM V5 app stays isolated from prohibited product and gamified references', () => {
  const combined = `${appSource}\n${htmlSource}\n${cssSource}`.toLowerCase();
  assert.doesNotMatch(combined, /student\s*360/);
  assert.doesNotMatch(combined, /check-in\s*premium/);
  assert.doesNotMatch(combined, /plano\s*alimentar\s*premium/);
  assert.doesNotMatch(combined, /biblioteca/);
  for (const prohibited of ['desafio', 'missão', 'missões', 'streak', 'sequência', 'pontuação', 'ranking', 'recompensa', 'conquista', 'conquistas', 'nível', 'performance']) {
    assert.doesNotMatch(combined, new RegExp(`(^|[^a-záàâãéêíóôõúç])${prohibited}([^a-záàâãéêíóôõúç]|$)`, 'i'));
  }
});
