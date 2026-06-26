const DEFAULT_STUDENT_PLAN = 'premium';
export const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
export const ADMIN_SESSION_HEADER = 'x-admin-session';
export const LEGACY_ADMIN_TOKEN_HEADER = 'x-admin-token';

const adminSessions = new Map();

function nowMs() {
  return Date.now();
}

function getAdminTokenFromEnv(env) {
  return String(env?.ADMIN_TOKEN || '').trim();
}

function getSessionCandidate(request) {
  return String(
    request.headers.get(ADMIN_SESSION_HEADER) ||
    request.headers.get(LEGACY_ADMIN_TOKEN_HEADER) ||
    ''
  ).trim();
}

function pruneExpiredAdminSessions(currentTime = nowMs()) {
  for (const [sessionId, session] of adminSessions.entries()) {
    if (!session?.expiresAt || session.expiresAt <= currentTime) adminSessions.delete(sessionId);
  }
}

export function createAdminSession(ttlMs = ADMIN_SESSION_TTL_MS) {
  pruneExpiredAdminSessions();
  const sessionId = crypto.randomUUID();
  const createdAt = nowMs();
  const expiresAt = createdAt + ttlMs;
  adminSessions.set(sessionId, { createdAt, expiresAt });
  return {
    sessionId,
    expiresAt,
    expiresAtIso: new Date(expiresAt).toISOString(),
    ttlSeconds: Math.floor(ttlMs / 1000)
  };
}

export function invalidateAdminSession(requestOrSessionId) {
  const sessionId = typeof requestOrSessionId === 'string'
    ? requestOrSessionId
    : getSessionCandidate(requestOrSessionId);
  if (!sessionId) return false;
  return adminSessions.delete(sessionId);
}

export function isAdminSessionValid(request) {
  pruneExpiredAdminSessions();
  const sessionId = getSessionCandidate(request);
  if (!sessionId) return false;
  const session = adminSessions.get(sessionId);
  if (!session || session.expiresAt <= nowMs()) {
    adminSessions.delete(sessionId);
    return false;
  }
  return true;
}

export function isLegacyAdminTokenAuthorized(request, env) {
  const token = String(request.headers.get(LEGACY_ADMIN_TOKEN_HEADER) || '').trim();
  const adminToken = getAdminTokenFromEnv(env);

  return !!token && !!adminToken && token === adminToken;
}

export function isAdminAuthorized(request, env) {
  return isAdminSessionValid(request) || isLegacyAdminTokenAuthorized(request, env);
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
