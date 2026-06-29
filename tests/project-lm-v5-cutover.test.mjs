import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

const portal = await readFile('portal.html', 'utf8');
const access = await readFile('public/assets/js/lm-access.js', 'utf8');
const lm2Html = await readFile('public/project-lm-2.html', 'utf8');
const legacyInventory = await readFile('docs/project-lm-legacy-inventory.md', 'utf8');
const lm2Router = await readFile('public/assets/js/project-lm-2-router.js', 'utf8');

const officialPortalRoute = '/projeto-lm#home';
const officialRuntimeRoute = '/projeto-lm#home';
const officialRoutes = [
  '#home',
  '#onboarding-name',
  '#week-1',
  '#week-2',
  '#week-3-placeholder',
  '#week-4-placeholder',
  '#program-completion',
  '#premium-bridge'
];
const lm2Assets = [
  'assets/js/project-lm-2-app.js',
  'assets/js/project-lm-2-state.js',
  'assets/js/project-lm-2-router.js',
  'assets/css/project-lm-2.css'
];
const legacyEntrypoints = [
  'projeto-lm-jornada.html',
  'project-lm-profile.html',
  'projeto-lm-planejamento.html'
];

test('Projeto LM 2.0 is the official frontend route for new Projeto LM users', () => {
  assert.ok(portal.includes(`window.location.replace('${officialPortalRoute}')`));
  assert.match(access, /projectLm2Route\('home'\)/);
  assert.equal('/projeto-lm#home', officialRuntimeRoute);

  for (const legacyEntrypoint of legacyEntrypoints) {
    assert.doesNotMatch(portal, new RegExp(`href=['"]${escapeRegExp(legacyEntrypoint)}['"]`));
  }
});

test('Premium dashboard does not load LM 2.0 assets', () => {
  for (const asset of lm2Assets) {
    assert.doesNotMatch(portal, new RegExp(escapeRegExp(asset)));
  }
});

test('Projeto LM 2.0 page loads only LM 2.0 assets and no Premium pages', () => {
  for (const asset of lm2Assets) {
    assert.match(lm2Html, new RegExp(escapeRegExp(asset)));
  }

  assert.doesNotMatch(lm2Html, /portal-checkin\.html|portal-plano-alimentar\.html|portal-progressao\.html|anamnese-premium\.html/);
});

test('official LM 2.0 routes remain addressable by the router contract', () => {
  for (const route of officialRoutes) {
    assert.match(lm2Router, new RegExp(escapeRegExp(route)));
  }
});

test('legacy Project LM files are classified and marked as non-official entrypoints', async () => {
  for (const legacyEntrypoint of legacyEntrypoints) {
    const source = await readFile(legacyEntrypoint, 'utf8');
    assert.match(source, /LEGACY - DO NOT EXTEND/);
    assert.match(source, /SUPERSEDED BY PROJECT LM V5/);
    assert.match(legacyInventory, new RegExp(escapeRegExp(legacyEntrypoint)));
  }

  assert.match(legacyInventory, /\| Componente \| Legado \| V5 \| Status \|/);
  assert.match(legacyInventory, /HISTÓRICO V5|oficial é `\/projeto-lm`/);
  assert.match(legacyInventory, /LEGACY/);
});

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
