import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

const lm2Html = await readFile('public/project-lm-2.html', 'utf8');
const lm2App = await readFile('public/assets/js/project-lm-2-app.js', 'utf8');
const lm2State = await readFile('public/assets/js/project-lm-2-state.js', 'utf8');
const lm2Router = await readFile('public/assets/js/project-lm-2-router.js', 'utf8');
const lm2Css = await readFile('public/assets/css/project-lm-2.css', 'utf8');
const portalHtml = await readFile('portal.html', 'utf8');
const v5Html = await readFile('public/project-lm-v5.html', 'utf8');

const lm2AssetPaths = [
  '/assets/js/project-lm-2-app.js',
  '/assets/js/project-lm-2-state.js',
  '/assets/js/project-lm-2-router.js',
  '/assets/css/project-lm-2.css'
];

const lm2Sources = [lm2App, lm2State, lm2Router, lm2Css];

test('project-lm-2.html exists and loads only the LM 2.0 foundation assets', () => {
  assert.match(lm2Html, /Projeto LM 2\.0/);
  assert.match(lm2Html, /Programa guiado de 30 dias para emagrecer sem recomeçar toda semana\./);
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

test('LM 2.0 state layer exposes the minimum initial state contract', () => {
  assert.match(lm2State, /onboarding_completed:\s*false/);
  assert.match(lm2State, /current_week:\s*1/);
  assert.match(lm2State, /continuity_days_count:\s*0/);
  assert.match(lm2State, /required_days_count:\s*5/);
  assert.match(lm2State, /next_action:\s*'start_onboarding'/);
});

test('LM 2.0 router prepares the minimum internal routes', () => {
  for (const route of ['welcome', 'onboarding', 'home', 'direction', 'week-1']) {
    assert.match(lm2Router, new RegExp(`${route}:|['"]${route}['"]`));
  }
});
