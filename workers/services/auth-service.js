const DEFAULT_STUDENT_PLAN = 'premium';
export const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
export const ADMIN_SESSION_HEADER = 'x-admin-session';
export const LEGACY_ADMIN_TOKEN_HEADER = 'x-admin-token';
export const ADMIN_SESSION_INVALID = 'ADMIN_SESSION_INVALID';
export const ADMIN_SESSION_EXPIRED = 'ADMIN_SESSION_EXPIRED';

function nowMs() {
  return Date.now();
}

function getAdminTokenFromEnv(env) {
  return String(env?.ADMIN_TOKEN || '').trim();
}

function getAdminSessionSecret(env) {
  return String(env?.ADMIN_SESSION_SECRET || env?.ADMIN_TOKEN || '').trim();
}

function getAdminSessionCandidate(request) {
  return String(request.headers.get(ADMIN_SESSION_HEADER) || '').trim();
}

function getLegacyAdminTokenCandidate(request) {
  return String(request.headers.get(LEGACY_ADMIN_TOKEN_HEADER) || '').trim();
}

function bytesToBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value) {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function jsonToBase64Url(value) {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function parseBase64UrlJson(value) {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(value)));
}

async function importHmacKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

async function signAdminSessionPayload(encodedPayload, env) {
  const secret = getAdminSessionSecret(env);
  if (!secret) return '';
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(encodedPayload));
  return bytesToBase64Url(new Uint8Array(signature));
}

async function verifyAdminSessionSignature(encodedPayload, encodedSignature, env) {
  const secret = getAdminSessionSecret(env);
  if (!secret || !encodedPayload || !encodedSignature) return false;
  try {
    const key = await importHmacKey(secret);
    return await crypto.subtle.verify(
      'HMAC',
      key,
      base64UrlToBytes(encodedSignature),
      new TextEncoder().encode(encodedPayload)
    );
  } catch (_) {
    return false;
  }
}

export async function createAdminSession(env, ttlMs = ADMIN_SESSION_TTL_MS) {
  const issuedAt = nowMs();
  const expiresAt = issuedAt + ttlMs;
  const payload = {
    v: 1,
    issuedAt,
    expiresAt,
    sessionId: crypto.randomUUID()
  };
  const encodedPayload = jsonToBase64Url(payload);
  const encodedSignature = await signAdminSessionPayload(encodedPayload, env);
  const sessionId = encodedSignature ? `${encodedPayload}.${encodedSignature}` : '';
  return {
    sessionId,
    expiresAt,
    expiresAtIso: new Date(expiresAt).toISOString(),
    ttlSeconds: Math.floor(ttlMs / 1000)
  };
}

export function invalidateAdminSession() {
  // Stateless admin sessions are not stored server-side. Logout clears the browser copy.
  // Immediate revocation requires a separate revocation store keyed by sessionId/nonce.
  return false;
}

export async function validateAdminSession(request, env) {
  const sessionId = getAdminSessionCandidate(request);
  if (!sessionId) return { ok: false, code: ADMIN_SESSION_INVALID };
  const parts = sessionId.split('.');
  if (parts.length !== 2) return { ok: false, code: ADMIN_SESSION_INVALID };
  const [encodedPayload, encodedSignature] = parts;
  const signatureOk = await verifyAdminSessionSignature(encodedPayload, encodedSignature, env);
  if (!signatureOk) return { ok: false, code: ADMIN_SESSION_INVALID };
  let payload;
  try {
    payload = parseBase64UrlJson(encodedPayload);
  } catch (_) {
    return { ok: false, code: ADMIN_SESSION_INVALID };
  }
  if (payload?.v !== 1 || !payload?.sessionId || !Number.isFinite(payload?.issuedAt) || !Number.isFinite(payload?.expiresAt)) {
    return { ok: false, code: ADMIN_SESSION_INVALID };
  }
  if (payload.expiresAt <= nowMs()) return { ok: false, code: ADMIN_SESSION_EXPIRED };
  return { ok: true, payload };
}

export async function isAdminSessionValid(request, env) {
  return (await validateAdminSession(request, env)).ok;
}

export function isLegacyAdminTokenAuthorized(request, env) {
  const token = getLegacyAdminTokenCandidate(request);
  const adminToken = getAdminTokenFromEnv(env);

  return !!token && !!adminToken && token === adminToken;
}

export async function validateAdminAuthorization(request, env) {
  const session = getAdminSessionCandidate(request);
  if (session) {
    const sessionResult = await validateAdminSession(request, env);
    if (!sessionResult.ok) return sessionResult;
    return { ok: true, mode: 'session' };
  }
  if (isLegacyAdminTokenAuthorized(request, env)) return { ok: true, mode: 'legacy-token' };
  return { ok: false, code: ADMIN_SESSION_INVALID };
}

export function isAdminAuthorized(request, env) {
  return validateAdminAuthorization(request, env).then((result) => result.ok);
}

export function validateAdminLoginToken(token, env) {
  const providedToken = String(token || '').trim();
  const adminToken = getAdminTokenFromEnv(env);
  return !!providedToken && !!adminToken && providedToken === adminToken;
}

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function normalizeStudentPlan(plan) {
  if (!plan) return DEFAULT_STUDENT_PLAN;
  const normalized = String(plan).trim().toLowerCase();
  if (normalized === 'premium' || normalized === 'projeto_lm') return normalized;
  return DEFAULT_STUDENT_PLAN;
}

export async function validateStudent(request, db) {
  const email = String(request.headers.get('x-student-email') || '').trim().toLowerCase();
  const token = String(request.headers.get('x-student-token') || '').trim();

  if (!email || !token) {
    return { ok: false, error: 'Credenciais do aluno ausentes.' };
  }

  const student = await db.prepare(
    `SELECT id, name, email, plan_type, plan
     FROM student_access
     WHERE lower(email)=?
       AND access_token=?
       AND status='ACTIVE'`
  ).bind(email, token).first();

  if (!student) {
    return { ok: false, error: 'Acesso inválido.' };
  }

  return {
    ok: true,
    student: {
      id: student.id,
      name: student.name,
      email: student.email,
      planType: student.plan_type || 'PREMIUM',
      plan: normalizeStudentPlan(student.plan)
    }
  };
}

// Premium-only enrichment must never make the shared Portal authentication query
// incompatible with legacy Projeto LM/V5 schemas.
export async function getOptionalPremiumStudentAccessFields(db, accessId) {
  try {
    const access = await db.prepare(
      'SELECT whatsapp, student_id FROM student_access WHERE id = ? LIMIT 1'
    ).bind(accessId).first();
    return { whatsapp: access?.whatsapp || null, studentId: access?.student_id || null };
  } catch (_) {
    return { whatsapp: null, studentId: null };
  }
}
