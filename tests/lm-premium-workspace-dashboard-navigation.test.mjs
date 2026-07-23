import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import vm from 'node:vm';

class FakeNode {
  constructor(id = '', tag = 'div') { this.id = id; this.tag = tag; this.textContent = ''; this.children = []; this.dataset = {}; this.attributes = {}; this.classNames = new Set(); this.classList = { add: (name) => this.classNames.add(name), remove: (name) => this.classNames.delete(name), toggle: (name, active) => active ? this.classNames.add(name) : this.classNames.delete(name) }; }
  append(...nodes) { this.children.push(...nodes); this.textContent += nodes.map((node) => node?.textContent || '').join(''); }
  replaceChildren(...nodes) { this.children = nodes; this.textContent = nodes.map((node) => node?.textContent || '').join(''); }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  scrollIntoView(options) { this.scrollOptions = options; }
  focus(options) { this.focusOptions = options; }
}

async function boot({ summaryFailure = false, reduceMotion = false, hasMatchMedia = true, ids } = {}) {
  const source = await readFile('public/admin-premium-workspace.js', 'utf8');
  const nodes = new Map((ids || ['workspaceDashboard', 'anamnesisPendingCard', 'checkinsAnsweredCard', 'anamnesisPendingValue', 'anamnesisPendingHint', 'checkinsAnsweredValue', 'checkinsAnsweredHint', 'checkinsOpenValue', 'checkinsOpenHint', 'anamnesisOperationalPanel', 'anamnesisOperationalHeading', 'checkinsOperationalPanel', 'checkinsOperationalHeading', 'anamnesisDashboard', 'anamnesisItems', 'checkinDashboard', 'checkinItems', 'studentList', 'loadMore', 'error', 'errorText', 'adminLogoutBtn', 'studentsNav', 'students', 'overview']).map((id) => [id, new FakeNode(id)]));
  const document = { getElementById: (id) => nodes.get(id) || null, createElement: (tag) => new FakeNode('', tag) };
  const timers = [];
  const sandbox = { document, window: { location: { origin: 'https://portal.test', pathname: '/', assign() {} }, matchMedia: hasMatchMedia ? () => ({ matches: reduceMotion }) : undefined, scrollTo(options) { this.scrollOptions = options; }, LMAdminAuth: { requireAdmin: () => true, attachLogout() {}, getAdminAuthHeaders: () => ({}) } }, fetch: async (url) => new Response(JSON.stringify(summaryFailure && String(url).includes('/summary') ? { ok: false, error: 'indisponível' } : { ok: true, data: String(url).includes('/summary') ? { anamnesis: { awaiting: 2, underReview: 0, readyToRelease: 0, items: [] }, checkins: { awaitingReview: 3, withoutRecentResponse: null, items: [] } } : { items: [], nextCursor: null } }), { status: summaryFailure && String(url).includes('/summary') ? 500 : 200 }), URL, console: { info() {} }, setTimeout: (fn) => { timers.push(fn); return timers.length; }, clearTimeout() {}, encodeURIComponent, Promise, Array, String, Boolean };
  sandbox.window.window = sandbox.window;
  vm.runInNewContext(source, sandbox);
  await new Promise((resolve) => setImmediate(resolve));
  return { nodes, timers, window: sandbox.window };
}

test('navigable cards scroll, focus and temporarily highlight their official operational panels', async () => {
  const { nodes, timers } = await boot();
  const anamnesis = nodes.get('anamnesisPendingCard');
  const checkins = nodes.get('checkinsAnsweredCard');
  assert.equal(anamnesis.disabled, false);
  assert.equal(checkins.disabled, false);
  anamnesis.onclick();
  assert.equal(nodes.get('anamnesisOperationalPanel').scrollOptions.behavior, 'smooth'); assert.equal(nodes.get('anamnesisOperationalPanel').scrollOptions.block, 'start');
  assert.equal(nodes.get('anamnesisOperationalHeading').focusOptions.preventScroll, true);
  assert.equal(nodes.get('anamnesisOperationalPanel').classNames.has('operational-panel-highlight'), true);
  checkins.onclick();
  assert.equal(nodes.get('checkinsOperationalPanel').scrollOptions.behavior, 'smooth'); assert.equal(nodes.get('checkinsOperationalPanel').scrollOptions.block, 'start');
  assert.equal(nodes.get('checkinsOperationalHeading').focusOptions.preventScroll, true);
  timers.forEach((timer) => timer());
  assert.equal(nodes.get('anamnesisOperationalPanel').classNames.has('operational-panel-highlight'), false);
  assert.equal(nodes.get('checkinsOperationalPanel').classNames.has('operational-panel-highlight'), false);
});

test('operational navigation respects reduced motion and tolerates missing matchMedia', async () => {
  const reduced = await boot({ reduceMotion: true });
  reduced.nodes.get('anamnesisPendingCard').onclick();
  assert.equal(reduced.nodes.get('anamnesisOperationalPanel').scrollOptions.behavior, 'auto');
  assert.equal(reduced.nodes.get('anamnesisOperationalPanel').scrollOptions.block, 'start');
  assert.equal(reduced.nodes.get('anamnesisOperationalHeading').focusOptions.preventScroll, true);
  assert.equal(reduced.nodes.get('anamnesisOperationalPanel').classNames.has('operational-panel-highlight'), true);

  const defaultMotion = await boot();
  defaultMotion.nodes.get('anamnesisPendingCard').onclick();
  assert.equal(defaultMotion.nodes.get('anamnesisOperationalPanel').scrollOptions.behavior, 'smooth');

  const withoutMatchMedia = await boot({ hasMatchMedia: false });
  assert.doesNotThrow(() => withoutMatchMedia.nodes.get('anamnesisPendingCard').onclick());
  assert.equal(withoutMatchMedia.nodes.get('anamnesisOperationalPanel').scrollOptions.behavior, 'smooth');
});

test('cards remain inert during loading or summary error, and tolerate a partial dashboard DOM', async () => {
  const loading = await boot({ ids: ['workspaceDashboard', 'anamnesisPendingCard', 'checkinsAnsweredCard', 'studentList', 'loadMore', 'error', 'errorText', 'adminLogoutBtn', 'studentsNav', 'students', 'overview', 'anamnesisDashboard', 'anamnesisItems', 'checkinDashboard', 'checkinItems'] });
  assert.equal(loading.nodes.get('anamnesisPendingCard').disabled, false, 'successful load enables the official card even when its destination is absent');
  loading.nodes.get('anamnesisPendingCard').onclick();
  const failure = await boot({ summaryFailure: true });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(failure.nodes.get('anamnesisPendingCard').disabled, true);
  assert.equal(failure.nodes.get('checkinsAnsweredCard').disabled, true);
  assert.equal(typeof failure.nodes.get('anamnesisPendingCard').onclick, 'function');
});

test('markup keeps native button keyboard semantics and does not give check-ins open a false destination', async () => {
  const html = await readFile('public/admin-premium-workspace.html', 'utf8');
  assert.match(html, /<button id="anamnesisPendingCard"[\s\S]*?type="button"[\s\S]*?aria-label="Ver anamneses pendentes no painel operacional"/);
  assert.match(html, /<button id="checkinsAnsweredCard"[\s\S]*?type="button"[\s\S]*?aria-label="Ver check-ins respondidos no painel operacional"/);
  assert.match(html, /data-dashboard-card="checkins-open" aria-disabled="true"[\s\S]*?id="checkinsOpenHint"[^>]*>Carregando/);
  assert.match(html, /id="anamnesisOperationalPanel"[\s\S]*?id="anamnesisOperationalHeading" tabindex="-1"/);
  assert.match(html, /id="checkinsOperationalPanel"[\s\S]*?id="checkinsOperationalHeading" tabindex="-1"/);
  const source = await readFile('public/admin-premium-workspace.js', 'utf8');
  assert.match(source, /function prefersReducedMotion\(\) \{ return window\.matchMedia\?\.\('\(prefers-reduced-motion: reduce\)'\)\?\.matches === true; \}/);
  assert.match(source, /function navigateToElement\(\{ element, focusTarget, highlightClass, block = 'start' \}\)/);
  assert.match(source, /scrollIntoView\?\.\(\{ behavior: prefersReducedMotion\(\) \? 'auto' : 'smooth', block \}\)/);
  assert.doesNotMatch(source, /operationalHighlightTimers/);
  assert.match(source, /typeof withoutRecentResponse === 'number' \? 'Aguardando definição' : 'Lista ainda não definida'/);
  assert.doesNotMatch(source, /checkinsOpen(?:Card)?.*focusOperationalPanel/);
  const copies = await Promise.all(['admin-premium-workspace.js', 'public/admin-premium-workspace.js', 'public/assets/js/admin-premium-workspace.js'].map((file) => readFile(file, 'utf8')));
  assert.equal(copies[0], copies[1]);
  assert.equal(copies[1], copies[2]);
});


test('dashboard-card change does not modify Projeto LM files', async () => {
  const { stdout } = await promisify(execFile)('git', ['diff', '--name-only']);
  assert.doesNotMatch(stdout, /(?:^|\n)(?:project-lm|public\/project-lm|assets\/js\/project-lm)/i);
});


test('student and overview navigation derive motion from the shared preference helper', async () => {
  const smooth = await boot();
  smooth.nodes.get('studentsNav').onclick();
  smooth.nodes.get('overview').onclick();
  assert.equal(smooth.nodes.get('students').scrollOptions.behavior, 'smooth');
  assert.equal(smooth.nodes.get('students').scrollOptions.block, 'start');
  assert.equal(smooth.window.scrollOptions.behavior, 'smooth');

  const reduced = await boot({ reduceMotion: true });
  reduced.nodes.get('studentsNav').onclick();
  reduced.nodes.get('overview').onclick();
  assert.equal(reduced.nodes.get('students').scrollOptions.behavior, 'auto');
  assert.equal(reduced.window.scrollOptions.behavior, 'auto');
});
