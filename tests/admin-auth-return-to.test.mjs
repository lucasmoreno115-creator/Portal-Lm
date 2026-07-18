import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

async function loadAuth(pathname = '/admin-premium-workspace.html', search = '') {
  const source = await readFile('admin-auth.js', 'utf8');
  const store = new Map();
  const current = new URL(`https://portal.test${pathname}${search}`);
  const location = {
    origin: current.origin,
    protocol: current.protocol,
    pathname: current.pathname,
    search: current.search,
    hash: current.hash,
    href: current.href
  };
  const sandbox = {
    window: { location },
    document: { readyState: 'loading', addEventListener(){}, getElementById(){ return null; } },
    localStorage: {
      getItem: (key) => store.get(key) || null,
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: (key) => store.delete(key)
    },
    URL,
    Date,
    String,
    RegExp
  };
  sandbox.window.window = sandbox.window;
  sandbox.window.document = sandbox.document;
  sandbox.window.localStorage = sandbox.localStorage;
  vm.runInNewContext(source, sandbox);
  return sandbox;
}

test('direct workspace access without session redirects to login with returnTo', async () => {
  const { window } = await loadAuth('/admin-premium-workspace.html');
  assert.equal(window.LMAdminAuth.requireAdmin(), '');
  assert.equal(window.location.href, '/admin-login.html?returnTo=%2Fadmin-premium-workspace.html');
});

test('valid login flow returns to requested workspace', async () => {
  const { window } = await loadAuth('/admin-login.html', '?returnTo=%2Fadmin-premium-workspace.html');
  const params = new URLSearchParams(window.location.search);
  assert.equal(window.LMAdminAuth.resolveAdminReturnTo(params.get('returnTo'), '/admin'), '/admin-premium-workspace.html');
  const loginHtml = await readFile('admin-login.html', 'utf8');
  assert.match(loginHtml, /resolveAdminReturnTo\(params\.get\('returnTo'\), '\/admin'\)/);
});

test('missing returnTo falls back to canonical admin route', async () => {
  const { window } = await loadAuth('/admin-login.html');
  assert.equal(window.LMAdminAuth.resolveAdminReturnTo(new URLSearchParams(window.location.search).get('returnTo'), '/admin'), '/admin');
});

test('external and unsafe returnTo values are rejected', async () => {
  const { window } = await loadAuth('/admin-login.html');
  for (const unsafe of ['https://evil.example/admin', 'http://portal.test/admin', 'javascript:alert(1)', 'data:text/html,evil', '//evil.example/admin', '\\\\evil.example\\admin']) {
    assert.equal(window.LMAdminAuth.resolveAdminReturnTo(unsafe, '/admin'), '/admin');
  }
});

test('premium admin pages are allowed while login is not a return target', async () => {
  const { window } = await loadAuth('/admin-login.html');
  assert.equal(window.LMAdminAuth.resolveAdminReturnTo('/admin', '/fallback'), '/admin');
  assert.equal(window.LMAdminAuth.resolveAdminReturnTo('/admin-premium-weekly-feedbacks.html?student_id=1#top', '/fallback'), '/admin-premium-weekly-feedbacks.html?student_id=1#top');
  assert.equal(window.LMAdminAuth.resolveAdminReturnTo('/admin-premium-nutrition-plan.html', '/fallback'), '/admin-premium-nutrition-plan.html');
  assert.equal(window.LMAdminAuth.resolveAdminReturnTo('/admin-login.html', '/admin'), '/admin');
});

test('logout keeps returning to the login page', async () => {
  const source = await readFile('admin-auth.js', 'utf8');
  assert.match(source, /window\.location\.href = '\/admin-login\.html'/);
});
