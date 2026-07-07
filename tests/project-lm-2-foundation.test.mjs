import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

const lm2Html = await readFile('public/project-lm-2.html', 'utf8');
const lm2App = await readFile('public/assets/js/project-lm-2-app.js', 'utf8');
const lm2State = await readFile('public/assets/js/project-lm-2-state.js', 'utf8');
const lm2Router = await readFile('public/assets/js/project-lm-2-router.js', 'utf8');
const lm2NutritionData = await readFile('public/assets/js/project-lm-2-nutrition-data.js', 'utf8');
const lm2NutritionNormalizer = await readFile('public/assets/js/project-lm-2-nutrition-normalizer.js', 'utf8');
const lm2Css = await readFile('public/assets/css/project-lm-2.css', 'utf8');
const portalHtml = await readFile('portal.html', 'utf8');
const v5Html = await readFile('public/project-lm-v5.html', 'utf8');

const lm2AssetPaths = [
  'assets/js/project-lm-2-app.js',
  'assets/js/project-lm-2-state.js',
  'assets/js/project-lm-2-router.js',
  'assets/js/project-lm-2-nutrition-data.js',
  'assets/js/project-lm-2-nutrition-normalizer.js',
  'assets/css/project-lm-2.css'
];

const lm2Sources = [lm2App, lm2State, lm2Router, lm2NutritionData, lm2NutritionNormalizer, lm2Css];

test('project-lm-2.html exists and loads only the LM 2.0 foundation assets', () => {
  assert.match(lm2Html, /Projeto LM/);
  assert.match(lm2Html, /Você não precisa de mais motivação\./);
  assert.match(lm2Html, /Precisa de direção\./);
  assert.match(lm2Html, />COMEÇAR</);

  for (const assetPath of lm2AssetPaths) {
    assert.match(lm2Html, new RegExp(assetPath.replaceAll('/', '\\/').replace('.', '\\.')));
  }

  assert.doesNotMatch(lm2Html, /project-lm-v5/);
  assert.doesNotMatch(lm2Html, /lm-access\.js/);
});

test('portal and V5 entrypoints do not load LM 2.0 assets', () => {
  for (const assetPath of lm2AssetPaths) {
    assert.doesNotMatch(portalHtml, new RegExp(assetPath.replaceAll('/', '\\/').replace('.', '\\.')));
    assert.doesNotMatch(v5Html, new RegExp(assetPath.replaceAll('/', '\\/').replace('.', '\\.')));
  }
});

test('LM 2.0 assets do not import or reference V5 assets', () => {
  for (const source of lm2Sources) {
    assert.doesNotMatch(source, /project-lm-v5/);
    assert.doesNotMatch(source, /plmv5/);
  }
});


test('LM 2.0 nutrition architecture keeps data and normalization outside the main app', () => {
  assert.doesNotMatch(lm2App, /const nutritionPlans\s*=|const nutritionEquivalenceGroups\s*=|const nutritionMealIcons\s*=|const nutritionPlanNotes\s*=/);
  assert.match(lm2NutritionData, /const nutritionPlans\s*=\s*Object\.freeze/);
  assert.match(lm2NutritionData, /const nutritionEquivalenceGroups\s*=\s*Object\.freeze/);
  assert.match(lm2NutritionData, /const nutritionMealIcons\s*=\s*Object\.freeze/);
  assert.match(lm2NutritionData, /const nutritionPlanNotes\s*=\s*Object\.freeze/);
  for (const plan of ['H1', 'H2', 'H3', 'M1', 'M2', 'M3']) assert.match(lm2NutritionData, new RegExp(`${plan}:`));
  for (const fn of ['slugifyNutritionKey', 'parseNutritionItem', 'inferNutritionSubstitutions', 'normalizeNutritionMeal', 'resolveNutritionPlan']) {
    assert.match(lm2NutritionNormalizer, new RegExp(`function ${fn}\\(`));
  }
  assert.match(lm2App, /ProjectLm2NutritionNormalizer\?\.resolveNutritionPlan/);
  assert.doesNotMatch(lm2App, /Nutrition Focus Panel|🔄 Ver substituições/);
  assert.match(lm2App, /<summary>Substituições<\/summary>/);
});

test('LM 2.0 state layer exposes the minimum initial state contract', () => {
  assert.match(lm2State, /onboarding_completed:\s*false/);
  assert.match(lm2State, /current_week:\s*1/);
  assert.match(lm2State, /continuity_days_count:\s*0/);
  assert.match(lm2State, /required_days_count:\s*5/);
  assert.match(lm2State, /next_action:\s*'start_onboarding'/);
  assert.match(lm2State, /home_loaded:\s*false/);
  assert.match(lm2State, /home_data:\s*null/);
  assert.match(lm2State, /direction_loaded:\s*false/);
});

test('LM 2.0 router prepares the minimum internal routes', () => {
  for (const route of ['welcome', 'onboarding-name', 'onboarding-goal', 'onboarding-sex', 'onboarding-weight', 'direction-created', 'home', 'direction', 'week-1-placeholder', 'home-placeholder']) {
    assert.match(lm2Router, new RegExp(`${route}:|['"]${route}['"]`));
  }
});

test('LM 2.0 visual polish centralizes cards, controls, typography, states and responsive rules', () => {
  for (const token of ['--lm2-radius-card', '--lm2-radius-block', '--lm2-radius-control', '--lm2-shadow-card', '--lm2-shadow-focus']) {
    assert.match(lm2Css, new RegExp(token));
  }
  assert.match(lm2Css, /\.lm2-hero,\n\.lm2-card \{/);
  assert.match(lm2Css, /\.lm2-primary-button,\n\.lm2-secondary-button,\n\.lm2-option \{/);
  assert.match(lm2Css, /\.lm2-input:focus,\n\.lm2-input:focus-visible \{/);
  assert.match(lm2Css, /\.lm2-block,\n\.lm2-lesson,\n\.lm2-plan-b,\n\.lm2-celebration-cta \{/);
  assert.match(lm2Css, /@media \(max-width: 480px\)/);
});
