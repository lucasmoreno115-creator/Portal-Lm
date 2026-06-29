import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

const portalLogin = await readFile('portal-login.html', 'utf8');
const portal = await readFile('portal.html', 'utf8');
const access = await readFile('public/assets/js/lm-access.js', 'utf8');
const adminLogin = await readFile('admin-login.html', 'utf8');
const legacyFreeze = await readFile('docs/project-lm-legacy-freeze.md', 'utf8');

const officialProjectRoute = '/projeto-lm';
const forbiddenOfficialTargets = [
  'project-lm-v5.html',
  'projeto-lm-jornada.html',
  'projeto-lm-onboarding.html',
  'projeto-lm-planejamento.html',
  'project-lm-profile.html'
];
const lm2AssetPattern = /project-lm-2-(?:app|state|router|[\w-]+)\.js|project-lm-2\.css/;

test('legacy freeze document defines official and deprecated Projeto LM surfaces', () => {
  assert.match(legacyFreeze, /URL pública oficial: `\/projeto-lm`/);
  assert.match(legacyFreeze, /Entrypoint interno: `public\/project-lm-2\.html`/);
  assert.match(legacyFreeze, /API oficial: `\/api\/project-lm-2\/\*`/);
  assert.match(legacyFreeze, /Banco oficial: tabelas `lm2_\*`/);
  assert.match(legacyFreeze, /V5 anterior — legado\/deprecated/);
  assert.match(legacyFreeze, /Legado antigo — histórico\/deprecated/);
  assert.match(legacyFreeze, /não podem\*\* usar arquivos, APIs, rotas ou tabelas legadas/i);
});

test('portal-login sends Projeto LM students to the canonical public route', () => {
  assert.match(portalLogin, /r\.data\.plan==='projeto_lm'\?'\/projeto-lm':'portal\.html'/);
  assert.doesNotMatch(portalLogin, /project-lm-2\.html|project-lm-v5\.html|projeto-lm-(?:jornada|onboarding|planejamento)\.html|project-lm-profile\.html/);
});

test('Projeto LM menus use canonical /projeto-lm hash routes only', () => {
  assert.match(access, /const LM_PROJECT_LM_2_ENTRY = '\/projeto-lm'/);
  assert.match(access, /const projectLm2Route = \(hash\) => `\$\{LM_PROJECT_LM_2_ENTRY\}#\$\{hash\}`/);

  const projectMenuBlock = access.slice(access.indexOf('const LM_MENU_ITEMS'), access.indexOf('function getCurrentUser'));
  assert.match(projectMenuBlock, /projectLm2Route\('home'\)/);
  assert.match(projectMenuBlock, /projectLm2Route\('week-1'\)/);
  assert.match(projectMenuBlock, /projectLm2Route\('daily-checkin'\)/);
  assert.match(projectMenuBlock, /projectLm2Route\('premium-bridge'\)/);

  for (const target of forbiddenOfficialTargets) {
    assert.doesNotMatch(projectMenuBlock, new RegExp(escapeRegExp(target)));
  }
});

test('public Projeto LM navigation avoids frozen legacy entrypoints', () => {
  const publicNavigationSources = [portalLogin, portal, access];

  for (const source of publicNavigationSources) {
    for (const target of forbiddenOfficialTargets) {
      assert.doesNotMatch(source, new RegExp(`(?:href|location\\.href|location\\.replace|window\\.open)\\s*(?:=|\\()\\s*['\"](?:\\/)?${escapeRegExp(target)}`));
    }
  }

  assert.match(portalLogin, new RegExp(escapeRegExp(officialProjectRoute)));
  assert.match(access, /const projectLm2Route = \(hash\) => `\$\{LM_PROJECT_LM_2_ENTRY\}#\$\{hash\}`/);
});

test('Premium and Admin remain isolated from LM 2.0 assets', () => {
  assert.doesNotMatch(portal, lm2AssetPattern);
  assert.doesNotMatch(adminLogin, lm2AssetPattern);
});

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
