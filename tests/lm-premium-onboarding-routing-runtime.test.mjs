import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const gateway = await readFile('portal.html', 'utf8');
const home = await readFile('portal-premium-home.html', 'utf8');
const login = await readFile('portal-login.html', 'utf8');
const inlineScripts = (source) => [...source.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
const tick = () => new Promise((resolve) => setImmediate(resolve));

async function runGateway(plan = 'premium') {
  const calls = [], redirects = [];
  const context = { getAuth: () => ({ email: 'student@example.com', token: 'valid-token' }), getUserPlan: () => plan, api: async (path) => { calls.push(path); return { data: { experience: 'PREMIUM_PORTAL' } }; }, window: { location: { replace: (target) => redirects.push(target) } } };
  vm.runInNewContext(inlineScripts(gateway)[0], context);
  await tick();
  return { calls, redirects };
}

async function runHome(experience) {
  const calls = [], redirects = [], body = { style: { visibility: 'hidden' } };
  const context = { requireAuth() {}, getUserPlan: () => 'premium', api: async (path) => { calls.push(path); return { data: { experience } }; }, document: { body }, window: { location: { replace: (target) => redirects.push(target) } }, Promise };
  vm.runInNewContext(inlineScripts(home)[0], context);
  await tick();
  return { calls, redirects, body };
}

test('gateway sends authenticated Projeto LM students directly to the official route without Premium access-state', async () => {
  const result = await runGateway('projeto_lm');
  assert.deepEqual(result.redirects, ['/projeto-lm/#home']);
  assert.deepEqual(result.calls, []);
});

test('active Home guard keeps blocked states hidden and only releases ACTIVE', async () => {
  const underReview = await runHome('ONBOARDING');
  assert.equal(underReview.body.style.visibility, 'hidden');
  assert.deepEqual(underReview.redirects, ['portal-premium-onboarding.html']);
  assert.deepEqual(underReview.calls, ['/portal/premium/access-state']);
  assert.equal(home.includes("api('/portal/checkins')"), false);
  assert.equal(home.includes('window.lmPremiumAccessReady.then((allowed)'), true);

  const active = await runHome('PREMIUM_PORTAL');
  assert.equal(active.body.style.visibility, 'visible');
  assert.deepEqual(active.redirects, []);

  const paused = await runHome('ONBOARDING');
  assert.equal(paused.body.style.visibility, 'hidden');
  assert.deepEqual(paused.redirects, ['portal-premium-onboarding.html']);
});

test('login distinguishes invalid credentials from temporary access-state routing failures without clearing a valid session', async () => {
  const elements = { email: { value: 'student@example.com' }, token: { value: 'valid-token' }, msg: { textContent: '', className: '' }, entrar: {} };
  const stored = new Map();
  const calls = [];
  const context = { document: { getElementById: (id) => elements[id] }, localStorage: { setItem: (key, value) => stored.set(key, value) }, window: { location: { href: '' } }, api: async (path) => { calls.push(path); if (path === '/portal/login') return { data: { email: 'student@example.com', name: 'Student', plan: 'premium', planType: 'PREMIUM' } }; throw new Error('temporary outage'); } };
  vm.runInNewContext(inlineScripts(login)[0], context);
  await elements.entrar.onclick();
  assert.deepEqual(calls, ['/portal/login', '/portal/premium/access-state']);
  assert.equal(stored.get('lm_student_token'), 'valid-token');
  assert.match(elements.msg.textContent, /temporariamente indisponível/);

  const invalid = { ...elements, msg: { textContent: '', className: '' }, entrar: {} };
  const invalidContext = { document: { getElementById: (id) => invalid[id] }, localStorage: { setItem() { throw new Error('must not persist invalid access'); } }, window: { location: { href: '' } }, api: async () => { throw new Error('invalid'); } };
  vm.runInNewContext(inlineScripts(login)[0], invalidContext);
  await invalid.entrar.onclick();
  assert.match(invalid.msg.textContent, /email e token/);
});
