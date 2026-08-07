import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { compareReports, comparisonMarkdown, exitCodeForComparison, metricDelta, REQUIRED_METRICS } from '../scripts/compare-portal-performance.mjs';
import { aggregateRuns } from '../scripts/lib/portal-performance-core.mjs';
import { EXPECTED_PAGES } from '../scripts/lib/portal-performance-analysis.mjs';
import { buildPerformanceSource } from '../scripts/lib/portal-performance-analysis.mjs';

const root = path.resolve(import.meta.dirname, '..'), BASE = '9'.repeat(40), HEAD = 'a'.repeat(40), CHECKOUT = 'b'.repeat(40), WORKFLOW = 'c'.repeat(40);
const read = file => readFile(path.join(root, file), 'utf8');
const provenance = (changes = {}) => ({ baselineSha: BASE, headSha: HEAD, checkoutSha: CHECKOUT, workflowSha: WORKFLOW, eventName: 'pull_request', ref: 'refs/pull/401/merge', ...changes });
function report(sha, homeCls, source = {}) {
  const pages = EXPECTED_PAGES.map(page => ({ page, scenarios: ['COLD', 'WARM'].map(scenario => {
    const runs = Array.from({ length: 5 }, (_, index) => {
      const cls = page === '/portal-premium-home.html' && scenario === 'COLD' ? homeCls : 0;
      const metrics = { cls, lcp: 1000, fcp: 500, transferBytes: 10000, requestCount: 10, failedRequestCount: 0 };
      const resources = [{ url: page, status: 200, type: 'document' }];
      if (page === '/portal-premium-home.html') resources.push({ url: '/api/portal/notifications/unread-count', status: 200, type: 'xhr' });
      return { run: index + 1, page, scenario, metrics, resources, failedRequests: [], layoutShiftEvents: [], externalBlocked: [], externalRequestAttempted: false, unexpectedRedirect: null, mainDocumentLoaded: true, mainDocumentStatus: 200, completionStatus: 'MEASURED' };
    });
    return { scenario, runs, aggregate: aggregateRuns(runs) };
  }) }));
  return { status: 'MEASURED', source: { checkoutSha: sha, headSha: source.headSha ?? sha, workflowSha: source.workflowSha ?? (sha === CHECKOUT ? WORKFLOW : null), eventName: source.eventName ?? (sha === CHECKOUT ? 'pull_request' : 'local'), ref: source.ref ?? (sha === CHECKOUT ? 'refs/pull/401/merge' : 'local'), nodeVersion: 'v22.22.2', chromeVersion: 'Chrome/150', ...source }, profile: { runs: 5, viewport: { width: 390, height: 844 }, scenarios: ['COLD', 'WARM'], pages: EXPECTED_PAGES }, pages };
}
const valid = () => [report(BASE, .33), report(CHECKOUT, .05, { headSha: HEAD })];

test('Home usa loading real e remove definitivamente o slot enabled antes do paint quando persistido', async () => {
  const [html, css, js] = await Promise.all([read('public/portal-premium-home.html'), read('public/portal.css'), read('public/assets/js/pwa-push-subscription.js')]);
  assert.match(html, /data-state='loading' aria-busy='true'/);
  assert.match(html, /lm_portal_push_enabled[^\n]+pwaPushCard[^\n]+hidden = true/);
  assert.match(js, /localStorage\.setItem\('lm_portal_push_enabled', 'true'\)/);
  assert.match(js, /card\.hidden = state === 'enabled'/);
  assert.doesNotMatch(css, /#pwaPushCard\[hidden\]\{display:grid/);
  assert.match(css, /@media\(max-width:720px\)[\s\S]*#pwaPushCard\{min-block-size:230px\}/);
});

test('estados loading, waiting, enabled, blocked, unsupported, install e error permanecem alcançáveis', async () => {
  const content = await read('public/portal-premium-home.html') + await read('public/assets/js/pwa-push-subscription.js');
  for (const state of ['loading', 'waiting', 'enabled', 'blocked', 'unsupported', 'install', 'error']) assert.ok(content.includes(state), state);
});

test('comparação aprovada é determinística, distingue merge-ref/head e aceita percentual null com zero', () => {
  const [before, after] = valid(), first = compareReports(before, after, provenance()), second = compareReports(before, after, provenance());
  assert.equal(first.status, 'PASSED'); assert.equal(first.after.sha, HEAD); assert.equal(first.after.source.checkoutSha, CHECKOUT); assert.notEqual(first.headSha, first.checkoutSha);
  assert.equal(comparisonMarkdown(first), comparisonMarkdown(second)); assert.equal(exitCodeForComparison(first.status), 0);
  assert.deepEqual(metricDelta(0, 0), { absolute: 0, percentage: null });
});

test('bloqueia baseline/head inválidos e SHAs iguais', () => { const reports = valid(); for (const p of [provenance({ baselineSha: 'abc' }), provenance({ headSha: 'NOT_EXECUTED' }), provenance({ headSha: BASE })]) assert.throws(() => compareReports(...reports, p), /INVALID|SAME_SHA/); });

test('bloqueia página, cenário e run ausentes', () => {
  for (const mutate of [r => r.pages.pop(), r => r.pages[0].scenarios.pop(), r => r.pages[0].scenarios[0].runs.pop()]) { const [before, after] = valid(); mutate(after); assert.throws(() => compareReports(before, after, provenance()), /PAGE_COUNT|SCENARIOS|RUN_COUNT/); }
});

test('bloqueia métrica obrigatória null, NaN ou infinita e status INCOMPLETE', () => {
  for (const value of [null, NaN, Infinity]) { const [before, after] = valid(); after.pages[0].scenarios[0].runs[0].metrics.lcp = value; assert.throws(() => compareReports(before, after, provenance()), /REQUIRED_METRIC/); }
  const [before, after] = valid(); after.status = 'INCOMPLETE'; assert.throws(() => compareReports(before, after, provenance()), /STATUS_INCOMPLETE/);
});

test('bloqueia request externo, HTTP 4xx/5xx e notificação diferente de 200', () => {
  const mutations = [r => { r.pages[0].scenarios[0].runs[0].externalRequestAttempted = true; }, r => { r.pages[0].scenarios[0].runs[0].resources[0].status = 500; }, r => { const run = r.pages.find(p => p.page.includes('home')).scenarios[0].runs[0]; run.resources.find(x => x.url.includes('notifications')).status = 204; }];
  for (const mutate of mutations) { const [before, after] = valid(); mutate(after); assert.throws(() => compareReports(before, after, provenance()), /EXTERNAL_REQUEST|HTTP_FAILURE|NOTIFICATIONS_NOT_200/); }
});

test('FAILED e INCONCLUSIVE nunca têm exit code zero', () => { assert.equal(exitCodeForComparison('FAILED'), 1); assert.equal(exitCodeForComparison('INCONCLUSIVE'), 1); });

test('workflow disponibiliza base, liga after ao head e preserva diagnóstico/upload após falha', async () => {
  const workflow = await read('.github/workflows/portal-performance-baseline.yml');
  for (const required of ['fetch-depth: 0', 'git cat-file -e', 'git worktree add --detach', 'trap cleanup EXIT', 'git worktree remove --force', 'env \\', '-u GITHUB_SHA', '-u PERFORMANCE_BASE_SHA', 'PERFORMANCE_EVENT_NAME=local', 'PERFORMANCE_REF=local', 'github.event.pull_request.head.sha || github.sha', 'continue-on-error: true', "if: always()", 'BEFORE_MEASUREMENT_FAILED', 'AFTER_MEASUREMENT_FAILED', 'artifacts/performance/s0.6/before/portal-performance-report.json', 'artifacts/performance/s0.6/']) assert.ok(workflow.includes(required), required);
  assert.equal((workflow.match(/run: npm test/g) || []).length, 1);
});

test('before isola GITHUB_SHA do pai e nasce com proveniência local válida', () => {
  const mergeSha = 'd'.repeat(40), baselineSha = '9fcbc86fa63ca9c0792b789d774de8cf13d2b366';
  assert.throws(() => buildPerformanceSource({ checkoutSha: baselineSha, chromeVersion: 'Chrome/150', nodeVersion: 'v22.22.2', env: { GITHUB_SHA: mergeSha, PERFORMANCE_CHECKOUT_SHA: baselineSha, PERFORMANCE_HEAD_SHA: baselineSha, PERFORMANCE_EVENT_NAME: 'local', PERFORMANCE_REF: 'local' } }), /proveniência local/);
  const isolated = buildPerformanceSource({ checkoutSha: baselineSha, chromeVersion: 'Chrome/150', nodeVersion: 'v22.22.2', env: { PERFORMANCE_CHECKOUT_SHA: baselineSha, PERFORMANCE_HEAD_SHA: baselineSha, PERFORMANCE_EVENT_NAME: 'local', PERFORMANCE_REF: 'local' } });
  assert.deepEqual(isolated, { baseSha: null, headSha: baselineSha, checkoutSha: baselineSha, workflowSha: null, canonicalMainSha: null, ref: 'local', eventName: 'local', nodeVersion: 'v22.22.2', chromeVersion: 'Chrome/150' });
});

test('after mantém todas as variáveis de proveniência pull_request', async () => {
  const workflow = await read('.github/workflows/portal-performance-baseline.yml');
  const after = workflow.slice(workflow.indexOf('- name: Measure S0.6 after'), workflow.indexOf('- name: Analyze measured after'));
  for (const variable of ['PERFORMANCE_BASE_SHA:', 'PERFORMANCE_HEAD_SHA:', 'PERFORMANCE_CHECKOUT_SHA:', 'PERFORMANCE_EVENT_NAME:', 'PERFORMANCE_REF:']) assert.ok(after.includes(variable), variable);
  assert.doesNotMatch(after, /-u (GITHUB_SHA|PERFORMANCE_BASE_SHA)/);
});

test('preserva métricas, scripts, sanitização e não introduz seletores exclusivos', async () => {
  assert.deepEqual(REQUIRED_METRICS, ['cls', 'lcp', 'fcp', 'transferBytes', 'requestCount', 'failedRequestCount']);
  const pkg = JSON.parse(await read('package.json')); for (const script of ['performance:portal', 'performance:portal:analyze', 'performance:portal:smoke', 'performance:portal:compare']) assert.ok(pkg.scripts[script]);
  assert.match(await read('scripts/lib/portal-performance-analysis.mjs'), /sanitizeSelectorValue/);
  const forbidden = new RegExp(`\\btest\\.(${['skip', 'only'].join('|')})\\b`); for (const file of await readdir(path.join(root, 'tests'))) if (file.endsWith('.mjs')) assert.doesNotMatch(await read(`tests/${file}`), forbidden);
});
