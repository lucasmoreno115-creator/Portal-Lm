import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';

const wrangler = await readFile('wrangler.toml', 'utf8');
const workflow = await readFile('.github/workflows/cloudflare-deploy.yml', 'utf8');
const worker = await readFile('workers/api.js', 'utf8');
const publicEntrypoints = [
  'index.html', 'portal.html', 'admin-login.html', 'admin-premium-workspace.html',
  'admin-premium-student-record.html', 'admin-premium-nutrition-plan.html', 'projeto-lm/index.html',
  'assets/js/admin-premium-student-record.js', 'assets/css/admin-premium-student-record.css',
];

test('Cloudflare route covers the complete portal hostname exactly once', () => {
  assert.match(wrangler, /pattern\s*=\s*"portal\.lucasmorenopersonal\.com\.br\/\*"/);
  assert.doesNotMatch(wrangler, /portal\.lucasmorenopersonal\.com\.br\/api\/\*/);
  assert.match(wrangler, /zone_name\s*=\s*"lucasmorenopersonal\.com\.br"/);
});

test('native static assets stay asset-first and API/admin redirect paths are Worker-first', () => {
  assert.match(wrangler, /directory\s*=\s*"\.\/public"/);
  assert.match(wrangler, /binding\s*=\s*"ASSETS"/);
  assert.match(wrangler, /run_worker_first\s*=\s*\[[^\]]*"\/api\/\*"[^\]]*"\/admin"[^\]]*"\/admin\/"[^\]]*\]/);
  assert.doesNotMatch(wrangler, /run_worker_first\s*=\s*true/);
  assert.doesNotMatch(wrangler, /single-page-application/);
  assert.doesNotMatch(worker, /env\??\.ASSETS\??\.fetch\(/);
  assert.match(worker, /url\.pathname === '\/admin' \|\| url\.pathname === '\/admin\//);
});

test('public is the production frontend source for critical entrypoints and runtime markers', async () => {
  await Promise.all(publicEntrypoints.map((entrypoint) => access(`public/${entrypoint}`, constants.R_OK)));
  const html = await readFile('public/admin-premium-student-record.html', 'utf8');
  const js = await readFile('public/assets/js/admin-premium-student-record.js', 'utf8');
  assert.match(html, /Planejamento alimentar/);
  assert.match(js, /Editar planejamento alimentar/);
});

test('public HTML imports resolve inside the canonical static directory', async () => {
  const htmlFiles = (await Promise.all(publicEntrypoints.filter((path) => path.endsWith('.html')).map(async (entrypoint) => [entrypoint, await readFile(`public/${entrypoint}`, 'utf8')])));
  for (const [entrypoint, html] of htmlFiles) {
    for (const match of html.matchAll(/(?:src|href)=["']([^"'#?]+)(?:\?[^"']*)?["']/g)) {
      const reference = match[1];
      if (/^(?:https?:|data:|mailto:|tel:)|[${}]/.test(reference)) continue;
      const target = reference.startsWith('/') ? `public${reference}` : `public/${entrypoint.split('/').slice(0, -1).join('/')}${entrypoint.includes('/') ? '/' : ''}${reference}`;
      await access(target, constants.R_OK);
    }
  }
});

test('Pages deployment remains absent and Cloudflare smoke verifies canonical pages, redirects, API, assets, and isolated 404s', async () => {
  await assert.rejects(access('.github/workflows/pages-deploy.yml', constants.F_OK));
  for (const path of ['/api/health', '/', '/portal', '/admin-premium-student-record', '/assets/js/admin-premium-student-record.js', '/assets/css/admin-premium-student-record.css', '/admin-premium-nutrition-plan', '/api/rota-inexistente', '/arquivo-inexistente-${GITHUB_SHA}.html']) assert.match(workflow, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  for (const [legacyPath, canonicalPath] of [['/portal.html', '/portal'], ['/admin-premium-student-record.html', '/admin-premium-student-record'], ['/admin-premium-nutrition-plan.html', '/admin-premium-nutrition-plan']]) {
    assert.match(workflow, new RegExp(`redirect ${legacyPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} ${canonicalPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  }
  assert.match(workflow, /for attempt in 1 2 3 4 5; do/);
  assert.match(workflow, /curl --fail --silent --show-error --max-time 10/);
  assert.match(workflow, /\[ "\$status" = 307 \]/);
  assert.match(workflow, /new URL\(location, origin\)\.pathname/);
  assert.match(workflow, /cf-cache-status=/);
  assert.match(worker, /return json\(\{ ok: false, error: 'Not found' \}, 404\);/);
});
