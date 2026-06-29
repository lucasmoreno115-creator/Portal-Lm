import { access, readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

const v5Entrypoint = 'public/project-lm-v5.html';
const v5Html = await readFile(v5Entrypoint, 'utf8');
const portal = await readFile('portal.html', 'utf8');
const wrangler = await readFile('wrangler.toml', 'utf8');
const worker = await readFile('workers/api.js', 'utf8');
const productionRouteDoc = await readFile('docs/project-lm-v5-production-route-verification.md', 'utf8');

const historicalPath = '/project-lm-v5.html';
const historicalHashRoutes = [
  '#project-lm/journey',
  '#project-lm/stage-1-actions',
  '#project-lm/victories',
  '#project-lm/recovery'
];
const historicalAssets = [
  '/assets/js/project-lm-v5-app.js',
  '/assets/js/project-lm-v5-state.js',
  '/assets/js/project-lm-v5-screen-contracts.js',
  '/assets/css/project-lm-v5.css'
];

test('legacy V5 entrypoint remains present for historical compatibility in the public assets directory', async () => {
  await assert.doesNotReject(() => access(v5Entrypoint));
  assert.doesNotMatch(wrangler, /\[assets\][\s\S]*binding\s*=\s*"ASSETS"/);
});

test('hotfix keeps Worker scoped to APIs and out of static hosting', () => {
  assert.match(wrangler, /pattern\s*=\s*"portal\.lucasmorenopersonal\.com\.br\/api\/\*"/);
  assert.doesNotMatch(wrangler, /pattern\s*=\s*"portal\.lucasmorenopersonal\.com\.br\/\*"/);
  assert.doesNotMatch(worker, /!url\.pathname\.startsWith\('\/api\/'\)[\s\S]*serveStaticAsset\(request, env\)/);
  assert.doesNotMatch(worker, /env\?\.ASSETS\?\.fetch[\s\S]*env\.ASSETS\.fetch\(request\)/);
  assert.ok(v5Entrypoint.endsWith(historicalPath));
});

test('legacy V5 entrypoint references historical V5 assets', () => {
  for (const asset of historicalAssets) {
    assert.match(v5Html, new RegExp(escapeRegExp(asset)));
  }
});

test('legacy V5 hash routes are documented as historical browser-side routes', () => {
  assert.match(productionRouteDoc, new RegExp(escapeRegExp(historicalPath)));
  assert.match(productionRouteDoc, /hash nunca é enviado ao servidor/i);

  for (const hashRoute of historicalHashRoutes) {
    assert.match(productionRouteDoc, new RegExp(escapeRegExp(`${historicalPath}${hashRoute}`)));
  }
});

test('Premium dashboard remains isolated from V5 production assets', () => {
  for (const asset of historicalAssets) {
    assert.doesNotMatch(portal, new RegExp(escapeRegExp(asset)));
  }
});

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
