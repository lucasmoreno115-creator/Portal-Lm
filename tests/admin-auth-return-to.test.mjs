import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

async function loadAuth(pathname = '/admin-premium-workspace.html', search = '', options = {}) {
  const source = await readFile('admin-auth.js', 'utf8');
  const store = options.store || new Map();
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
  const sandbox = {
    window: { location },
    document: { readyState: 'loading', addEventListener(){}, getElementById(id){ return options.elements?.[id] || null; } },
    localStorage: {
      getItem: (key) => store.get(key) || null,
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: (key) => store.delete(key)
    },
    URL,
    Date,
    String,
    RegExp,
    fetch: options.fetchImpl || (async () => new Response('{}'))
  };
  sandbox.window.window = sandbox.window;
  sandbox.window.document = sandbox.document;
  sandbox.window.localStorage = sandbox.localStorage;
  vm.runInNewContext(source, sandbox);
  return { ...sandbox, store };
}

test('direct workspace access without session redirects to login with returnTo', async () => {
  const { window } = await loadAuth('/admin-premium-workspace.html');
  assert.equal(window.LMAdminAuth.requireAdmin(), '');
  assert.equal(window.location.href, '/admin-login.html?returnTo=%2Fadmin-premium-workspace.html');
});

test('valid login flow returns to requested workspace', async () => {
  const { window } = await loadAuth('/admin-login.html', '?returnTo=%2Fadmin-premium-workspace.html');
  const params = new URLSearchParams(window.location.search);
  assert.equal(window.LMAdminAuth.resolveAdminReturnTo(params.get('returnTo')), '/admin-premium-workspace.html');
  const loginHtml = await readFile('public/admin-login.html', 'utf8');
  assert.match(loginHtml, /resolveAdminReturnTo\(params\.get\('returnTo'\), workspace\)/);
});

test('missing returnTo falls back to canonical workspace route', async () => {
  const { window } = await loadAuth('/admin-login.html');
  assert.equal(window.LMAdminAuth.resolveAdminReturnTo(new URLSearchParams(window.location.search).get('returnTo')), '/admin-premium-workspace.html');
});

test('external and unsafe returnTo values are rejected', async () => {
  const { window } = await loadAuth('/admin-login.html');
  for (const unsafe of ['https://evil.example/admin', 'http://portal.test/admin', 'javascript:alert(1)', 'data:text/html,evil', '//evil.example/admin', '\\\\evil.example\\admin']) {
    assert.equal(window.LMAdminAuth.resolveAdminReturnTo(unsafe), '/admin-premium-workspace.html');
  }
});

test('premium admin pages are allowed while legacy entry routes resolve to workspace', async () => {
  const { window } = await loadAuth('/admin-login.html');
  assert.equal(window.LMAdminAuth.resolveAdminReturnTo('/admin', '/fallback'), '/admin-premium-workspace.html');
  assert.equal(window.LMAdminAuth.resolveAdminReturnTo('/admin/', '/fallback'), '/admin-premium-workspace.html');
  assert.equal(window.LMAdminAuth.resolveAdminReturnTo('/admin-premium-weekly-feedbacks.html?student_id=1#top', '/fallback'), '/admin-premium-weekly-feedbacks.html?student_id=1#top');
  assert.equal(window.LMAdminAuth.resolveAdminReturnTo('/admin-premium-nutrition-plan.html', '/fallback'), '/admin-premium-nutrition-plan.html');
  assert.equal(window.LMAdminAuth.resolveAdminReturnTo('/admin-login.html'), '/admin-premium-workspace.html');
  assert.equal(window.LMAdminAuth.resolveAdminReturnTo('/admin-legacy.html'), '/admin-premium-workspace.html');
});

test('workspace logout clears session data and redirects to login with workspace returnTo', async () => {
  let clickHandler;
  const button = { addEventListener(event, handler) { if (event === 'click') clickHandler = handler; } };
  const store = new Map([
    ['lm_admin_session_id', 'session-123'],
    ['lm_admin_session_expires_at', '2099-01-01T00:00:00.000Z']
  ]);
  const { window } = await loadAuth('/admin-premium-workspace.html', '', { store, elements: { adminLogoutBtn: button }, fetchImpl: async () => new Response('{"ok":true}', { status: 200 }) });

  window.LMAdminAuth.attachLogout('adminLogoutBtn', '/admin-premium-workspace.html');
  assert.equal(typeof clickHandler, 'function');
  await clickHandler();

  assert.equal(store.has('lm_admin_session_id'), false);
  assert.equal(store.has('lm_admin_session_expires_at'), false);
  assert.equal(window.location.href, '/admin-login.html?returnTo=%2Fadmin-premium-workspace.html');
});

test('default logout returns to login with canonical workspace returnTo', async () => {
  let clickHandler;
  const button = { addEventListener(event, handler) { if (event === 'click') clickHandler = handler; } };
  const store = new Map([['lm_admin_session_id', 'session-123']]);
  const { window } = await loadAuth('/admin-alerts.html', '', { store, elements: { adminLogoutBtn: button }, fetchImpl: async () => new Response('{"ok":true}', { status: 200 }) });

  window.LMAdminAuth.attachLogout('adminLogoutBtn');
  await clickHandler();

  assert.equal(window.location.href, '/admin-login.html?returnTo=%2Fadmin-premium-workspace.html');
});

test('external returnTo cannot be used for logout login URL', async () => {
  const { window } = await loadAuth('/admin-login.html');
  assert.equal(window.LMAdminAuth.getAdminLoginUrl('https://evil.example/admin-premium-workspace.html'), '/admin-login.html?returnTo=%2Fadmin-premium-workspace.html');
});