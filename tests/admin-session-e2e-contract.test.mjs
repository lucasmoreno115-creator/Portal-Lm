import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

async function authSandbox({ fetchImpl = async () => new Response('{}'), store = new Map(), pathname = '/admin-premium-workspace.html' } = {}) {
  const source = await readFile('admin-auth.js', 'utf8');
  const current = new URL(`https://portal.test${pathname}`);
  const location = {
    origin: current.origin,
    protocol: current.protocol,
    pathname: current.pathname,
    search: '',
    hash: '',
    href: current.href,
    replace(value) { this.href = value; }
  };
  const document = { readyState: 'complete', addEventListener(){}, getElementById(){ return null; } };
  const sandbox = { window: { location }, document, localStorage: { getItem: k => store.get(k) || null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) }, fetch: fetchImpl, URL, Date, String, RegExp, console };
  sandbox.window.window = sandbox.window; sandbox.window.document = document; sandbox.window.localStorage = sandbox.localStorage; sandbox.window.fetch = fetchImpl;
  vm.runInNewContext(source, sandbox);
  return { window: sandbox.window, store };
}

test('admin session persists across a real page recreation and logout clears shared storage', async () => {
  const store = new Map();
  const calls = [];
  const fetchImpl = async (url, opts = {}) => {
    calls.push({ url, opts });
    if (url === '/api/admin/session/login') return new Response(JSON.stringify({ ok: true, data: { session_id: 'session-123', expires_at: '2999-01-01T00:00:00.000Z' } }), { status: 200 });
    if (url === '/api/admin/session/logout') return new Response(JSON.stringify({ ok: true }), { status: 200 });
    return new Response(JSON.stringify({ ok: true, data: { items: [] } }), { status: 200 });
  };

  const first = await authSandbox({ fetchImpl, store });
  await first.window.LMAdminAuth.loginAdmin('valid-admin-token');
  assert.equal(store.get('lm_admin_session_id'), 'session-123');
  assert.equal(store.get('lm_admin_session_expires_at'), '2999-01-01T00:00:00.000Z');
  assert.equal(calls[0].opts.body, JSON.stringify({ token: 'valid-admin-token' }));

  const second = await authSandbox({ fetchImpl, store });
  assert.equal(second.window.LMAdminAuth.getAdminSession(), 'session-123');
  assert.equal(second.window.LMAdminAuth.requireAdmin(), 'session-123');
  assert.equal(second.window.location.href, 'https://portal.test/admin-premium-workspace.html');
  assert.equal(JSON.stringify(second.window.LMAdminAuth.getAdminAuthHeaders()), JSON.stringify({ 'Content-Type': 'application/json', 'x-admin-session': 'session-123' }));

  await second.window.LMAdminAuth.logoutAdmin();
  assert.equal(store.get('lm_admin_session_id'), undefined);
  assert.equal(store.get('lm_admin_session_expires_at'), undefined);

  const third = await authSandbox({ fetchImpl, store });
  assert.equal(third.window.LMAdminAuth.requireAdmin(), '');
  assert.equal(third.window.location.href, '/admin-login.html?returnTo=%2Fadmin-premium-workspace.html');
});