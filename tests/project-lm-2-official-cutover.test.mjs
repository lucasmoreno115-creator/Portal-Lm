import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const portal = await readFile('portal.html', 'utf8');
const access = await readFile('public/assets/js/lm-access.js', 'utf8');
const lm2Html = await readFile('public/project-lm-2.html', 'utf8');
const lm2CanonicalAlias = await readFile('projeto-lm/index.html', 'utf8');
const lm2App = await readFile('public/assets/js/project-lm-2-app.js', 'utf8');
const apiSource = await readFile('workers/api.js', 'utf8');
const premiumHtml = await readFile('anamnese-premium.html', 'utf8');
const adminHtml = await readFile('admin.html', 'utf8');

const officialPortalRoute = '/projeto-lm/#home';
const officialRuntimeRoute = '/projeto-lm/#home';
const legacyStudentEntrypoints = [
  'projeto-lm-jornada.html',
  'projeto-lm-onboarding.html',
  'projeto-lm-planejamento.html',
  'projeto-lm-plano-inicial.html',
  'projeto-lm-consistencia.html',
  'projeto-lm-dia-dificil.html',
  'projeto-lm-conteudo.html',
  'projeto-lm-conquistas.html',
  'projeto-lm-estatisticas.html',
  'projeto-lm-biblioteca.html',
  'project-lm-profile.html',
  'public/project-lm-v5.html'
];
const lm2RelativeAssets = [
  'assets/css/project-lm-2.css',
  'assets/js/project-lm-2-state.js',
  'assets/js/project-lm-2-router.js',
  'assets/js/project-lm-2-app.js'
];

test('Projeto LM login officially cuts over to LM 2.0 while Premium remains on portal.html', () => {
  assert.ok(portal.includes(`window.location.replace('${officialPortalRoute}')`));
  assert.match(access, /projectLm2Route\('home'\)/);
  assert.equal(officialRuntimeRoute, '/projeto-lm/#home');
  assert.match(access, /const LM_PROJECT_LM_2_ENTRY = '\/projeto-lm\/'/);
  assert.match(lm2CanonicalAlias, /id="project-lm-2-root"/);
  assert.match(access, /\{ feature: 'dashboard', label: 'Página inicial', href: 'portal\.html' \}/);
});


test('/projeto-lm canonical hash aliases resolve to the official LM 2.0 route', () => {
  const context = {
    localStorage: { getItem: () => '' },
    sessionStorage: { setItem() {} },
    window: { location: { href: '', pathname: '/projeto-lm/' } },
    api: async () => ({})
  };
  vm.runInNewContext(`${access}; globalThis.__lm2Routes = [projectLm2Route('home'), projectLm2Route('daily-checkin'), projectLm2Route('week-1'), projectLm2Route('premium-bridge')];`, context);
  assert.deepEqual(JSON.parse(JSON.stringify(context.__lm2Routes)), [
    '/projeto-lm/#home',
    '/projeto-lm/#daily-checkin',
    '/projeto-lm/#week-1',
    '/projeto-lm/#premium-bridge'
  ]);
});

test('active Projeto LM student navigation no longer points to legacy entrypoints', () => {
  for (const legacyEntrypoint of legacyStudentEntrypoints) {
    assert.doesNotMatch(portal, new RegExp(escapeRegExp(legacyEntrypoint)));
  }

  assert.doesNotMatch(access, /project-lm-v5|projeto-lm-jornada\.html|project-lm-profile\.html|projeto-lm-planejamento\.html/);
  assert.doesNotMatch(access, /project-lm-2\.html#|public\/project-lm-2\.html/);
});


test('GitHub Pages physical canonical alias serves LM 2.0 without V5 or legacy assets', () => {
  const canonicalAliasAssets = [
    '../public/assets/css/project-lm-2.css',
    '../public/assets/js/project-lm-2-state.js',
    '../public/assets/js/project-lm-2-router.js',
    '../public/assets/js/project-lm-2-app.js'
  ];

  assert.match(lm2CanonicalAlias, /<title>Projeto LM 2\.0<\/title>/);
  assert.match(lm2CanonicalAlias, /<main id="project-lm-2-root"/);
  for (const asset of canonicalAliasAssets) {
    assert.match(lm2CanonicalAlias, new RegExp(`(?:href|src)="${escapeRegExp(asset)}"`));
  }
  assert.doesNotMatch(lm2CanonicalAlias, /project-lm-v5|projeto-lm-jornada|projeto-lm-onboarding|projeto-lm-planejamento|project-lm-profile/);
  assert.doesNotMatch(lm2CanonicalAlias, /project-lm-v5-app\.js|project-lm-v5-state\.js|project-lm-v5\.css/);
});

test('Premium and Admin entrypoints remain isolated from LM 2.0 production alias assets', () => {
  assert.doesNotMatch(premiumHtml, /project-lm-2-(?:state|router|app)\.js|project-lm-2\.css|project-lm-2-root/);
  assert.doesNotMatch(adminHtml, /project-lm-2-(?:state|router|app)\.js|project-lm-2\.css|project-lm-2-root/);
});

test('LM 2.0 uses relative assets so public/project-lm-2.html can load without 404s', () => {
  for (const asset of lm2RelativeAssets) {
    assert.match(lm2Html, new RegExp(`(?:href|src)="${escapeRegExp(asset)}"`));
    assert.doesNotMatch(lm2Html, new RegExp(`(?:href|src)="/${escapeRegExp(asset)}"`));
  }
});

test('LM 2.0 onboarding and home APIs remain authenticated', () => {
  assert.match(lm2App, /\/api\/project-lm-2\/onboarding/);
  assert.match(lm2App, /\/api\/project-lm-2\/home/);
  assert.match(apiSource, /validateStudent\(request, env\.DB\)/);

  const lm2ApiBlock = apiSource.slice(
    apiSource.indexOf("if (url.pathname.startsWith('/api/portal/') || url.pathname.startsWith('/api/project-lm/') || url.pathname.startsWith('/api/project-lm-2/')"),
    apiSource.indexOf("if (url.pathname === '/api/project-lm/journey'")
  );
  assert.match(lm2ApiBlock, /validateStudent\(request, env\.DB\)/);
  assert.doesNotMatch(lm2ApiBlock, /allowUnauthenticated|skipAuth/i);
});

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
