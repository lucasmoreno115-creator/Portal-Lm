import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const appSource = await readFile('public/assets/js/project-lm-v5-app.js', 'utf8');
const htmlSource = await readFile('public/project-lm-v5.html', 'utf8');

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
});

test('Project LM V5 app simplifies journey navigation and prevents locked cards from navigating', () => {
  assert.match(appSource, /appendRouteLink\(contracts\.getScreenByKey\('journey_overview'\), screenKey, 'Visão geral'\)/);
  assert.match(appSource, /appendRouteLink\(nextScreen, screenKey, 'Próxima ação'\)/);
  assert.doesNotMatch(appSource, /contracts\.screens\.forEach/);
  assert.match(appSource, /status === 'active' \|\| status === 'completed' \|\| status === 'maintenance'/);
  assert.match(appSource, /button\.disabled = !screen \|\| status === 'locked' \|\| status === 'completed'/);
  assert.match(appSource, /if \(screen && status !== 'locked' && status !== 'completed'\) navigateToScreen\(screen\.key\)/);
});

test('Project LM V5 app stays isolated from Premium references', () => {
  const combined = `${appSource}\n${htmlSource}`.toLowerCase();
  assert.doesNotMatch(combined, /student\s*360/);
  assert.doesNotMatch(combined, /check-in\s*premium/);
  assert.doesNotMatch(combined, /plano\s*alimentar\s*premium/);
  assert.doesNotMatch(combined, /premium/);
});
