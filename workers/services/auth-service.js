const DEFAULT_STUDENT_PLAN = 'premium';

export function isAdminAuthorized(request, env) {
  const token = String(request.headers.get('x-admin-token') || '').trim();
  const adminToken = String(env.ADMIN_TOKEN || '').trim();
  const portalToken = String(env.PORTAL_ADMIN_TOKEN || '').trim();

  return !!token && (
    (!!portalToken && token === portalToken) ||
    (!!adminToken && token === adminToken)
  );
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
