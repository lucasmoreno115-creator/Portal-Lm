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

test('login admin accepts valid token and creates session without returning ADMIN_TOKEN', async () => {
  assert.equal(validateAdminLoginToken('secret-admin-token', env), true);
  const session = await createAdminSession(env);
  assert.ok(session.sessionId);
  assert.notEqual(session.sessionId, env.ADMIN_TOKEN);
  assert.equal(JSON.stringify(session).includes(env.ADMIN_TOKEN), false);
});

test('login admin rejects invalid token', () => {
  assert.equal(validateAdminLoginToken('wrong-token', env), false);
});

test('admin call with valid session is authorized', async () => {
  const session = await createAdminSession(env);
  assert.equal(await isAdminAuthorized(req({ 'x-admin-session': session.sessionId }), env), true);
});

test('admin call without session is rejected', async () => {
  assert.equal(await isAdminAuthorized(req(), env), false);
});

test('expired session is rejected', async () => {
  const session = await createAdminSession(env, -1);
  assert.equal(await isAdminAuthorized(req({ 'x-admin-session': session.sessionId }), env), false);
});

test('logout clears locally only for stateless sessions', async () => {
  const session = await createAdminSession(env);
  const request = req({ 'x-admin-session': session.sessionId });
  assert.equal(await isAdminAuthorized(request, env), true);
  assert.equal(invalidateAdminSession(request), false);
  assert.equal(await isAdminAuthorized(request, env), true);
});

test('direct x-admin-token remains legacy-compatible and documented as deprecated', async () => {
  assert.equal(await isAdminAuthorized(req({ 'x-admin-token': env.ADMIN_TOKEN }), env), true);
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

test('signed admin session is stateless and valid in a simulated new Worker instance', async () => {
  const sessionFromInstanceA = await createAdminSession(env);
  const freshModule = await import(`../workers/services/auth-service.js?instance=${Date.now()}`);
  assert.equal(await freshModule.isAdminAuthorized(req({ 'x-admin-session': sessionFromInstanceA.sessionId }), env), true);
});

test('tampered signature and random tokens are rejected with explicit invalid code', async () => {
  const { validateAdminSession } = await import('../workers/services/auth-service.js');
  const session = await createAdminSession(env);
  const tampered = `${session.sessionId.slice(0, -1)}x`;
  assert.deepEqual(await validateAdminSession(req({ 'x-admin-session': tampered }), env), { ok: false, code: 'ADMIN_SESSION_INVALID' });
  assert.deepEqual(await validateAdminSession(req({ 'x-admin-session': 'random-token' }), env), { ok: false, code: 'ADMIN_SESSION_INVALID' });
});

test('expired signed session returns explicit expired code', async () => {
  const { validateAdminSession } = await import('../workers/services/auth-service.js');
  const session = await createAdminSession(env, -1);
  assert.deepEqual(await validateAdminSession(req({ 'x-admin-session': session.sessionId }), env), { ok: false, code: 'ADMIN_SESSION_EXPIRED' });
});

test('decoded signed session payload does not include ADMIN_TOKEN', async () => {
  const session = await createAdminSession(env);
  const [encodedPayload] = session.sessionId.split('.');
  const decoded = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(encodedPayload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(encodedPayload.length / 4) * 4, '=')), (char) => char.charCodeAt(0))));
  assert.equal(JSON.stringify(decoded).includes(env.ADMIN_TOKEN), false);
  assert.equal(decoded.v, 1);
  assert.ok(decoded.sessionId);
});
