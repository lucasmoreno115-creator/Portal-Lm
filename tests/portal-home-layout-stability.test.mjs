import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { compareReports, comparisonMarkdown, metricDelta } from '../scripts/compare-portal-performance.mjs';

const root = path.resolve(import.meta.dirname, '..');
const read = file => readFile(path.join(root, file), 'utf8');

test('Home reserva espaço antes das respostas assíncronas sem altura fixa ou corte', async () => {
  const [html, css] = await Promise.all([read('public/portal-premium-home.html'), read('public/portal.css')]);
  assert.match(html, /id='pwaPushCard'[^>]+data-state='loading'[^>]+aria-busy='true'/);
  assert.match(html, /id='weekly-plan-section'[^>]+data-state='loading'[^>]+aria-busy='true'/);
  assert.match(css, /\.portal-home-v7 #pwaPushCard\{min-block-size:174px\}/);
  assert.match(css, /\.portal-home-v7 #weekly-plan-section\{min-block-size:438px\}/);
  assert.doesNotMatch(css, /\.portal-home-v7 #(pwaPushCard|weekly-plan-section)\{[^}]*\bheight:/);
  assert.doesNotMatch(css, /\.portal-home-v7 #(pwaPushCard|weekly-plan-section)\{[^}]*overflow:hidden/);
});

test('card preserva carregando, disponível, concedido, negado, sem suporte, oculto e erro', async () => {
  const js = await read('public/assets/js/pwa-push-subscription.js');
  for (const state of ['loading', 'waiting', 'enabled', 'blocked', 'unsupported', 'install', 'error']) assert.ok((await read('public/portal-premium-home.html') + js).includes(state), state);
  assert.match(js, /card\.hidden = state === 'enabled'/);
  assert.match(await read('public/portal.css'), /#pwaPushCard\[hidden\]\{display:grid !important;visibility:hidden;pointer-events:none\}/);
});

test('planejamento preserva carregando, disponível, vazio e erro com fallback aplicável', async () => {
  const html = await read('public/portal-premium-home.html');
  for (const state of ['loading', 'available', 'empty', 'error']) assert.match(html, new RegExp(`['\"]${state}['\"]`));
  assert.match(html, /finally \{\s*weeklyPlanSection\.setAttribute\('aria-busy', 'false'\)/);
  assert.match(html, /Use o treino no MFIT como base da semana/);
});

test('mobile longo cresce sem corte, mantém ordem visual e controles no fluxo de teclado', async () => {
  const [html, css] = await Promise.all([read('public/portal-premium-home.html'), read('public/portal.css')]);
  assert.match(css, /@media\(max-width:720px\)[\s\S]*#weekly-plan-section\{min-block-size:770px\}/);
  assert.ok(html.indexOf("id='pwaPushCard'") < html.indexOf("id='weekly-plan-section'"));
  assert.ok(html.indexOf("id='weekly-plan-section'") < html.indexOf("class='primary-actions'"));
  assert.doesNotMatch(html, /tabindex=['"]-1['"][^>]*id='pwaPushButton'/);
});

const report = (sha, cls) => ({ source: { checkoutSha: sha, nodeVersion: 'v22', chromeVersion: 'Chrome/150' }, status: 'MEASURED', profile: { runs: 1 }, pages: [{ page: '/portal-premium-home.html', scenarios: ['COLD', 'WARM'].map(scenario => ({ scenario, aggregate: { cls: { median: cls, p75: cls }, lcp: { median: null, p75: null }, fcp: { median: 1, p75: 1 }, transferBytes: { median: 0, p75: 0 }, requestCount: { median: 2, p75: 2 }, failedRequestCount: { median: 0, p75: 0 } }, runs: [{ completionStatus: 'MEASURED', metrics: { cls }, layoutShiftEvents: [], externalBlocked: [] }] })) }] });

test('comparação preserva null, denominador zero e ordenação determinística', () => {
  assert.deepEqual(metricDelta(0, 1), { absolute: 1, percentage: null });
  assert.deepEqual(metricDelta(null, 1), { absolute: null, percentage: null });
  const result = compareReports(report('a'.repeat(40), 0), report('b'.repeat(40), 0.05));
  assert.equal(result.pages[0].scenarios[0].metrics.cls.p75Delta.percentage, null);
  assert.equal(result.pages[0].scenarios[0].metrics.lcp.after.p75, null);
  assert.equal(comparisonMarkdown(result), comparisonMarkdown(result));
});

test('preserva scripts npm, sanitização e não introduz seletores exclusivos', async () => {
  const pkg = JSON.parse(await read('package.json'));
  for (const script of ['performance:portal', 'performance:portal:analyze', 'performance:portal:smoke']) assert.ok(pkg.scripts[script]);
  assert.match(await read('scripts/lib/portal-performance-analysis.mjs'), /sanitizeSelectorValue/);
  const forbidden = new RegExp(`\\btest\\.(${['skip', 'only'].join('|')})\\b`);
  for (const file of await readdir(path.join(root, 'tests'))) if (file.endsWith('.mjs')) assert.doesNotMatch(await read(`tests/${file}`), forbidden);
});
