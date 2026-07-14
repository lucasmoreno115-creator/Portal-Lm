import { STUDENT_IDENTITY_ERRORS } from '../services/student-identity-service.js';

export async function resolvePremiumIdentityForLegacyEmail({ identityService, email, log, area, route, method }) {
  try {
    const result = await identityService.resolve({ email });
    if (result.ok) {
      await log?.({ level: 'info', area, event: 'PREMIUM_IDENTITY_DUAL_WRITE_SUCCESS', route, method, student_email: email, metadata: { student_id: result.student.student_id } });
      return { student_id: result.student.student_id, resolution: result };
    }
    const event = result.error === STUDENT_IDENTITY_ERRORS.AMBIGUOUS_STUDENT_IDENTITY || result.error === STUDENT_IDENTITY_ERRORS.NON_PREMIUM_STUDENT
      ? 'PREMIUM_IDENTITY_ASSOCIATION_CONFLICT'
      : 'PREMIUM_IDENTITY_EMAIL_FALLBACK_USED';
    await log?.({ level: event.endsWith('CONFLICT') ? 'warn' : 'info', area, event, route, method, student_email: email, metadata: { reason: result.error } });
    return { student_id: null, resolution: result };
  } catch (error) {
    await log?.({ level: 'warn', area, event: 'PREMIUM_IDENTITY_DUAL_WRITE_SKIPPED', route, method, student_email: email, metadata: { reason: error?.message || 'IDENTITY_RESOLUTION_FAILED' } });
    return { student_id: null, resolution: { ok: false, error: error?.message || 'IDENTITY_RESOLUTION_FAILED' } };
  }
}

export async function dualReadByIdentity({ identityService, repository, email, byStudentId, byEmail, log, area, route, method }) {
  const identity = await resolvePremiumIdentityForLegacyEmail({ identityService, email, log, area, route, method });
  if (identity.student_id) {
    const record = await repository[byStudentId](identity.student_id);
    if (record) return { record, identity, method: 'student_id' };
  }
  return { record: await repository[byEmail](email), identity, method: 'email_fallback' };
}
