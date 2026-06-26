import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAdminSession,
  invalidateAdminSession,
  isAdminAuthorized,
  validateAdminLoginToken
} from '../workers/services/auth-service.js';

const env = { ADMIN_TOKEN: 'secret-admin-token' };
const req = (headers = {}) => new Request('https://portal.test/api/admin/health-check', { headers });

test('login admin accepts valid token and creates session without returning ADMIN_TOKEN', () => {
  assert.equal(validateAdminLoginToken('secret-admin-token', env), true);
  const session = createAdminSession();
  assert.ok(session.sessionId);
  assert.notEqual(session.sessionId, env.ADMIN_TOKEN);
  assert.equal(JSON.stringify(session).includes(env.ADMIN_TOKEN), false);
});

test('login admin rejects invalid token', () => {
  assert.equal(validateAdminLoginToken('wrong-token', env), false);
});

test('admin call with valid session is authorized', () => {
  const session = createAdminSession();
  assert.equal(isAdminAuthorized(req({ 'x-admin-session': session.sessionId }), env), true);
});

test('admin call without session is rejected', () => {
  assert.equal(isAdminAuthorized(req(), env), false);
});

test('expired session is rejected', () => {
  const session = createAdminSession(-1);
  assert.equal(isAdminAuthorized(req({ 'x-admin-session': session.sessionId }), env), false);
});

test('logout invalidates session', () => {
  const session = createAdminSession();
  const request = req({ 'x-admin-session': session.sessionId });
  assert.equal(isAdminAuthorized(request, env), true);
  assert.equal(invalidateAdminSession(request), true);
  assert.equal(isAdminAuthorized(request, env), false);
});

test('direct x-admin-token remains legacy-compatible and documented as deprecated', async () => {
  assert.equal(isAdminAuthorized(req({ 'x-admin-token': env.ADMIN_TOKEN }), env), true);
  const doc = await readFile('docs/admin-session-hardening.md', 'utf8');
  assert.match(doc, /x-admin-token/i);
  assert.match(doc, /legad|deprecated/i);
});

test('admin-auth does not persist raw admin token in localStorage', async () => {
  const source = await readFile('admin-auth.js', 'utf8');
  assert.doesNotMatch(source, /localStorage\.setItem\(LEGACY_ADMIN_TOKEN_KEY/);
  assert.doesNotMatch(source, /localStorage\.setItem\(['"]lm_admin_token/);
  assert.match(source, /localStorage\.removeItem\(LEGACY_ADMIN_TOKEN_KEY\)/);
  assert.match(source, /x-admin-session/);
});
