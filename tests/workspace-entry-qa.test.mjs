import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const WORKSPACE = '/admin-premium-workspace.html';
const LOGIN = '/admin-login.html';

async function read(path) {
  return readFile(path, 'utf8');
}

async function loadAuth({ pathname = WORKSPACE, search = '', store = new Map(), fetchImpl } = {}) {
  const source = await read('admin-auth.js');
  const current = new URL(`https://portal.test${pathname}${search}`);
  const location = {
    origin: current.origin,
    protocol: current.protocol,
    pathname: current.pathname,
    search: current.search,
    hash: current.hash,
    href: current.href,
    replace(value) { this.href = value; }
  };
  const document = {
    readyState: 'complete',
    addEventListener() {},
    getElementById() { return null; }
  };
  const sandbox = {
    window: { location },
    document,
    localStorage: {
      getItem: (key) => store.get(key) || null,
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: (key) => store.delete(key)
    },
    fetch: fetchImpl || (async () => new Response(JSON.stringify({ ok: true }), { status: 200 })),
    URL,
    Date,
    String,
    RegExp,
    Response
  };
  sandbox.window.window = sandbox.window;
  sandbox.window.document = document;
  sandbox.window.localStorage = sandbox.localStorage;
  vm.runInNewContext(source, sandbox);
  return { window: sandbox.window, store };
}

test('admin login uses Workspace as the canonical authenticated destination', async () => {
  const html = await read('public/admin-login.html');
  assert.match(html, /const workspace = ['"]\/admin-premium-workspace\.html['"]/);
  assert.match(html, /location\.replace\(window\.LMAdminAuth\.resolveAdminReturnTo\(params\.get\('returnTo'\), workspace\)\)/);
  assert.doesNotMatch(html, /Voltar ao Admin Hub/);
});

test('/admin entry never calls the legacy cutover endpoint or falls back to legacy admin', async () => {
  const html = await read('public/admin.html');
  assert.match(html, /\/admin-premium-workspace\.html/);
  assert.match(html, /getAdminSession/);
  assert.match(html, /getAdminLoginUrl/);
  assert.doesNotMatch(html, /cutover-route/);
  assert.doesNotMatch(html, /admin-legacy\.html/);
});

test('legacy compatibility entry redirects authenticated and anonymous users safely', async () => {
  const html = await read('public/admin-legacy.html');
  assert.match(html, /\/admin-premium-workspace\.html/);
  assert.match(html, /getAdminSession/);
  assert.match(html, /getAdminLoginUrl/);
  assert.doesNotMatch(html, /Command Center|Student 360|Cadastro de aluno/);
});

test('anonymous Workspace access redirects to login with Workspace returnTo', async () => {
  const { window } = await loadAuth();
  assert.equal(window.LMAdminAuth.requireAdmin(), '');
  assert.equal(window.location.href, `${LOGIN}?returnTo=%2Fadmin-premium-workspace.html`);
});

test('valid session survives page recreation and keeps Workspace available', async () => {
  const store = new Map([
    ['lm_admin_session_id', 'session-qa'],
    ['lm_admin_session_expires_at', '2999-01-01T00:00:00.000Z']
  ]);
  const first = await loadAuth({ store });
  assert.equal(first.window.LMAdminAuth.requireAdmin(), 'session-qa');
  const refreshed = await loadAuth({ store });
  assert.equal(refreshed.window.LMAdminAuth.requireAdmin(), 'session-qa');
  assert.equal(refreshed.window.location.href, 'https://portal.test/admin-premium-workspace.html');
});

test('expired session is cleared and blocked from Workspace', async () => {
  const store = new Map([
    ['lm_admin_session_id', 'expired-session'],
    ['lm_admin_session_expires_at', '2000-01-01T00:00:00.000Z']
  ]);
  const { window } = await loadAuth({ store });
  assert.equal(window.LMAdminAuth.requireAdmin(), '');
  assert.equal(store.has('lm_admin_session_id'), false);
  assert.equal(store.has('lm_admin_session_expires_at'), false);
  assert.equal(window.location.href, `${LOGIN}?returnTo=%2Fadmin-premium-workspace.html`);
});

test('logout clears session and prevents browser-history reuse of the protected page', async () => {
  const store = new Map([
    ['lm_admin_session_id', 'session-qa'],
    ['lm_admin_session_expires_at', '2999-01-01T00:00:00.000Z']
  ]);
  const calls = [];
  const { window } = await loadAuth({
    store,
    fetchImpl: async (url, options = {}) => {
      calls.push({ url, options });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
  });
  await window.LMAdminAuth.logoutAdmin();
  assert.equal(store.has('lm_admin_session_id'), false);
  assert.equal(store.has('lm_admin_session_expires_at'), false);
  assert.equal(calls[0].url, '/api/admin/session/logout');
  assert.equal(calls[0].options.headers['x-admin-session'], 'session-qa');

  const reopened = await loadAuth({ store });
  assert.equal(reopened.window.LMAdminAuth.requireAdmin(), '');
  assert.equal(reopened.window.location.href, `${LOGIN}?returnTo=%2Fadmin-premium-workspace.html`);
});

test('unsafe, login and legacy return targets resolve to the canonical Workspace', async () => {
  const { window } = await loadAuth({ pathname: LOGIN });
  for (const value of [
    '',
    '/admin',
    '/admin/',
    '/admin-login.html',
    '/admin-legacy.html',
    'https://evil.example/admin',
    '//evil.example/admin',
    'javascript:alert(1)'
  ]) {
    assert.equal(window.LMAdminAuth.resolveAdminReturnTo(value), WORKSPACE);
  }
});
