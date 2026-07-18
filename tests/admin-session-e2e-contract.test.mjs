import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

async function authSandbox(fetchImpl = async () => new Response('{}')) {
  const source = await readFile('admin-auth.js', 'utf8');
  const store = new Map();
  const current = new URL('https://portal.test/admin-premium-workspace.html');
  const location = { origin: current.origin, protocol: current.protocol, pathname: current.pathname, search: '', hash: '', href: current.href };
  const document = { readyState: 'complete', addEventListener(){}, getElementById(){ return null; } };
  const sandbox = { window: { location }, document, localStorage: { getItem: k => store.get(k) || null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) }, fetch: fetchImpl, URL, Date, String, RegExp, console };
  sandbox.window.window = sandbox.window; sandbox.window.document = document; sandbox.window.localStorage = sandbox.localStorage; sandbox.window.fetch = fetchImpl;
  vm.runInNewContext(source, sandbox);
  return { window: sandbox.window, store };
}

test('admin session E2E contract: login, persist, reload headers and logout', async () => {
  const calls = [];
  const { window, store } = await authSandbox(async (url, opts = {}) => {
    calls.push({ url, opts });
    if (url === '/api/admin/session/login') return new Response(JSON.stringify({ ok: true, data: { session_id: 'session-123', expires_at: '2999-01-01T00:00:00.000Z' } }), { status: 200 });
    if (url === '/api/admin/session/logout') return new Response(JSON.stringify({ ok: true }), { status: 200 });
    return new Response(JSON.stringify({ ok: true, data: { items: [] } }), { status: 200 });
  });

  await window.LMAdminAuth.loginAdmin('valid-admin-token');
  assert.equal(store.get('lm_admin_session_id'), 'session-123');
  assert.equal(window.LMAdminAuth.getAdminSession(), 'session-123');
  assert.equal(JSON.stringify(window.LMAdminAuth.getAdminAuthHeaders()), JSON.stringify({ 'Content-Type': 'application/json', 'x-admin-session': 'session-123' }));
  assert.equal(window.LMAdminAuth.requireAdmin(), 'session-123');
  assert.equal(calls[0].opts.body, JSON.stringify({ token: 'valid-admin-token' }));

  await window.LMAdminAuth.logoutAdmin();
  assert.equal(store.get('lm_admin_session_id'), undefined);
  assert.equal(window.LMAdminAuth.requireAdmin(), '');
  assert.match(window.location.href, /admin-login\.html/);
});
