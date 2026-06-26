import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

const portal = await readFile('portal.html', 'utf8');
const access = await readFile('public/assets/js/lm-access.js', 'utf8');
const v5Html = await readFile('public/project-lm-v5.html', 'utf8');
const cutoverDoc = await readFile('docs/project-lm-v5-cutover.md', 'utf8');
const legacyInventory = await readFile('docs/project-lm-legacy-inventory.md', 'utf8');
const v5App = await readFile('public/assets/js/project-lm-v5-app.js', 'utf8');

const officialPortalRoute = 'public/project-lm-v5.html#project-lm/journey';
const officialRuntimeRoute = '/project-lm-v5.html#project-lm/journey';
const officialHashes = [
  '#project-lm/journey',
  '#project-lm/stage-1-actions',
  '#project-lm/plan-b',
  '#project-lm/victories',
  '#project-lm/recovery',
  '#project-lm/maintenance'
];
const v5Assets = [
  '/assets/js/project-lm-v5-app.js',
  '/assets/js/project-lm-v5-state.js',
  '/assets/js/project-lm-v5-screen-contracts.js',
  '/assets/css/project-lm-v5.css'
];
const legacyEntrypoints = [
  'projeto-lm-jornada.html',
  'project-lm-profile.html',
  'projeto-lm-planejamento.html'
];

test('Projeto LM V5 is the official frontend route for new Projeto LM users', () => {
  assert.ok(portal.includes(`window.location.replace('${officialPortalRoute}')`));
  assert.match(access, /projectLmV5Route\('project-lm\/journey'\)/);
  assert.equal('/project-lm-v5.html#project-lm/journey', officialRuntimeRoute);

  for (const legacyEntrypoint of legacyEntrypoints) {
    assert.doesNotMatch(portal, new RegExp(`href=['"]${escapeRegExp(legacyEntrypoint)}['"]`));
  }
});

test('Premium dashboard does not load V5 assets', () => {
  for (const asset of v5Assets) {
    assert.doesNotMatch(portal, new RegExp(escapeRegExp(asset)));
  }
});

test('Projeto LM V5 page loads only V5 assets and no Premium pages', () => {
  for (const asset of v5Assets) {
    assert.match(v5Html, new RegExp(escapeRegExp(asset)));
  }

  assert.doesNotMatch(v5Html, /portal-checkin\.html|portal-plano-alimentar\.html|portal-progressao\.html|anamnese-premium\.html/);
});

test('official V5 hash routes are documented and remain addressable by the app contract', () => {
  for (const hash of officialHashes) {
    assert.match(cutoverDoc, new RegExp(escapeRegExp(hash)));
  }

  assert.match(v5App, /project-lm\/journey/);
  assert.match(v5App, /project-lm\/stage-1-actions/);
  assert.match(v5App, /project-lm\/plan-b/);
  assert.match(v5App, /project-lm\/victories/);
  assert.match(v5App, /project-lm\/recovery/);
  assert.match(v5App, /project-lm\/maintenance/);
});

test('legacy Project LM files are classified and marked as non-official entrypoints', async () => {
  for (const legacyEntrypoint of legacyEntrypoints) {
    const source = await readFile(legacyEntrypoint, 'utf8');
    assert.match(source, /LEGACY - DO NOT EXTEND/);
    assert.match(source, /SUPERSEDED BY PROJECT LM V5/);
    assert.match(legacyInventory, new RegExp(escapeRegExp(legacyEntrypoint)));
  }

  assert.match(legacyInventory, /\| Componente \| Legado \| V5 \| Status \|/);
  assert.match(legacyInventory, /OFFICIAL/);
  assert.match(legacyInventory, /LEGACY/);
});

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
