#!/usr/bin/env node
import { appendFile } from 'node:fs/promises';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

export class QaAdminAuthError extends Error {
  constructor(code) {
    super(code);
    this.name = 'QaAdminAuthError';
    this.code = code;
  }
}

function fail(code) {
  throw new QaAdminAuthError(code);
}

async function fetchWithTimeout(fetchImpl, url, options, timeoutMs) {
  try {
    return await fetchImpl(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
  } catch (_) {
    fail('QA_ADMIN_LOGIN_TIMEOUT');
  }
}

export async function authenticateQaAdmin({ baseUrl, adminToken, fetchImpl = fetch, timeoutMs = 20_000, mask = () => {} }) {
  const origin = String(baseUrl || '').trim().replace(/\/+$/, '');
  const token = String(adminToken || '').trim();
  if (!origin || !token) fail('QA_ADMIN_CREDENTIALS_MISSING');

  const login = await fetchWithTimeout(fetchImpl, `${origin}/api/admin/session/login`, {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({ token }),
  }, timeoutMs);

  let payload;
  try { payload = await login.json(); }
  catch (_) { fail('QA_ADMIN_LOGIN_INVALID_RESPONSE'); }
  if (!login.ok || payload?.ok !== true) fail('QA_ADMIN_LOGIN_FAILED');

  const session = String(payload?.data?.session_id || '').trim();
  if (!session) fail('QA_ADMIN_SESSION_NOT_ISSUED');
  mask(session);

  const workspace = await fetchWithTimeout(fetchImpl, `${origin}/api/admin/premium/workspace`, {
    method: 'GET',
    headers: { accept: 'application/json', 'x-admin-session': session },
  }, timeoutMs);
  if (!workspace.ok) fail('QA_ADMIN_WORKSPACE_AUTH_FAILED');

  return {
    session,
    expiresAt: String(payload?.data?.expires_at || ''),
    ttlSeconds: Number(payload?.data?.ttl_seconds) || null,
  };
}

export async function persistSession(githubEnv, session) {
  if (!githubEnv) fail('QA_ADMIN_GITHUB_ENV_MISSING');
  await appendFile(githubEnv, `QA_ADMIN_SESSION=${session}\n`, { encoding: 'utf8', mode: 0o600 });
}

async function main() {
  try {
    const result = await authenticateQaAdmin({
      baseUrl: process.env.QA_BASE_URL,
      adminToken: process.env.QA_ADMIN_TOKEN,
      mask: (value) => process.stdout.write(`::add-mask::${value}\n`),
    });
    await persistSession(process.env.GITHUB_ENV, result.session);
    console.log('Sessão administrativa efêmera emitida e Workspace validado com HTTP 200.');
  } catch (error) {
    console.error(error instanceof QaAdminAuthError ? error.code : 'QA_ADMIN_LOGIN_FAILED');
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
