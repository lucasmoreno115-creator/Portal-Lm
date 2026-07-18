import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import { isAdminAuthorized } from '../workers/services/auth-service.js';

const requestWithToken = (token) => new Request('https://portal.test/api/admin/health-check', {
  headers: token === undefined ? {} : { 'x-admin-token': token }
});

test('admin routes reject requests without token', async () => {
  assert.equal(await isAdminAuthorized(requestWithToken(), { ADMIN_TOKEN: 'secret-admin-token' }), false);
});

test('admin routes reject requests with invalid token', async () => {
  assert.equal(await isAdminAuthorized(requestWithToken('invalid-token'), { ADMIN_TOKEN: 'secret-admin-token' }), false);
});

test('admin routes accept requests with valid ADMIN_TOKEN only from environment', async () => {
  assert.equal(await isAdminAuthorized(requestWithToken('secret-admin-token'), { ADMIN_TOKEN: 'secret-admin-token' }), true);
});

test('production admin authorization fails closed when ADMIN_TOKEN is absent', async () => {
  assert.equal(await isAdminAuthorized(requestWithToken('secret-admin-token'), {}), false);
  assert.equal(await isAdminAuthorized(requestWithToken('secret-admin-token'), { ADMIN_TOKEN: '' }), false);
});

test('wrangler config does not hardcode admin secrets', async () => {
  const wrangler = await readFile('wrangler.toml', 'utf8');
  assert.doesNotMatch(wrangler, /ADMIN_TOKEN\s*=/);
  assert.doesNotMatch(wrangler, /PORTAL_ADMIN_TOKEN\s*=/);
  assert.doesNotMatch(wrangler, /admin4191luc/);
});

test('Projeto LM V5 official UI and API routes stay isolated from Premium entrypoints', async () => {
  const html = await readFile('public/project-lm-v5.html', 'utf8');
  const state = await readFile('public/assets/js/project-lm-v5-state.js', 'utf8');
  const app = await readFile('public/assets/js/project-lm-v5-app.js', 'utf8');
  const premium = await readFile('portal.html', 'utf8');

  assert.match(html, /project-lm-v5-app\.js/);
  assert.match(state, /\/api\/project-lm\/journey/);
  assert.match(app, /#project-lm\/journey/);
  assert.doesNotMatch(premium, /project-lm-v5-app\.js|project-lm-v5\.css/);
});
