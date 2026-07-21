import { STUDENT_IDENTITY_ERRORS } from '../services/student-identity-service.js';

export const PREMIUM_IDENTITY_POLICY_REASONS = Object.freeze({
  RESOLVED: 'RESOLVED',
  LEGACY_FALLBACK_ALLOWED: 'LEGACY_FALLBACK_ALLOWED',
  AMBIGUOUS_STUDENT_IDENTITY: STUDENT_IDENTITY_ERRORS.AMBIGUOUS_STUDENT_IDENTITY,
  NON_PREMIUM_STUDENT: STUDENT_IDENTITY_ERRORS.NON_PREMIUM_STUDENT,
  STUDENT_NOT_FOUND: STUDENT_IDENTITY_ERRORS.STUDENT_NOT_FOUND,
  EMAIL_REQUIRED: STUDENT_IDENTITY_ERRORS.EMAIL_REQUIRED,
  TECHNICAL_ERROR: 'TECHNICAL_ERROR',
});

function isBlockingIdentityError(error) {
  return error === STUDENT_IDENTITY_ERRORS.AMBIGUOUS_STUDENT_IDENTITY
    || error === STUDENT_IDENTITY_ERRORS.NON_PREMIUM_STUDENT
    || error === STUDENT_IDENTITY_ERRORS.EMAIL_REQUIRED;
}

function telemetryForPolicy(policy) {
  if (policy.blocked && (policy.reason === STUDENT_IDENTITY_ERRORS.AMBIGUOUS_STUDENT_IDENTITY || policy.reason === STUDENT_IDENTITY_ERRORS.NON_PREMIUM_STUDENT)) {
    return { event: 'PREMIUM_IDENTITY_ASSOCIATION_CONFLICT', level: 'warn' };
  }
  if (policy.allowFallback) return { event: 'PREMIUM_IDENTITY_EMAIL_FALLBACK_USED', level: 'info' };
  if (policy.blocked) return { event: 'PREMIUM_IDENTITY_DUAL_WRITE_SKIPPED', level: 'warn' };
  return { event: 'PREMIUM_IDENTITY_DUAL_WRITE_SUCCESS', level: 'info' };
}

export async function resolvePremiumIdentityForLegacyEmail({ identityService, email, log, area, route, method, allowLegacyFallback = false }) {
  let policy;
  try {
    const result = await identityService.resolve({ email });
    if (result.ok) {
      // Read use-cases that explicitly opt in retain legacy continuity after an
      // ID lookup misses; write callers still pass the same explicit policy.
      policy = { student_id: result.student.student_id, allowFallback: allowLegacyFallback, blocked: false, reason: PREMIUM_IDENTITY_POLICY_REASONS.RESOLVED, resolution: result };
    } else if (result.error === STUDENT_IDENTITY_ERRORS.STUDENT_NOT_FOUND && allowLegacyFallback) {
      policy = { student_id: null, allowFallback: true, blocked: false, reason: PREMIUM_IDENTITY_POLICY_REASONS.LEGACY_FALLBACK_ALLOWED, resolution: result };
    } else if (isBlockingIdentityError(result.error) || result.error === STUDENT_IDENTITY_ERRORS.STUDENT_NOT_FOUND) {
      policy = { student_id: null, allowFallback: false, blocked: true, reason: result.error, resolution: result };
    } else {
      policy = { student_id: null, allowFallback: false, blocked: true, reason: result.error || PREMIUM_IDENTITY_POLICY_REASONS.TECHNICAL_ERROR, resolution: result };
    }
  } catch (error) {
    policy = { student_id: null, allowFallback: false, blocked: true, reason: error?.message === STUDENT_IDENTITY_ERRORS.EMAIL_REQUIRED ? STUDENT_IDENTITY_ERRORS.EMAIL_REQUIRED : PREMIUM_IDENTITY_POLICY_REASONS.TECHNICAL_ERROR, resolution: { ok: false, error: error?.message || PREMIUM_IDENTITY_POLICY_REASONS.TECHNICAL_ERROR } };
  }

  const telemetry = telemetryForPolicy(policy);
  await log?.({ level: telemetry.level, area, event: telemetry.event, route, method, student_email: email, metadata: { student_id: policy.student_id, reason: policy.reason } });
  return policy;
}

export async function dualReadByIdentity({ identityService, repository, email, byStudentId, byEmail, log, area, route, method, allowLegacyFallback = false }) {
  const identity = await resolvePremiumIdentityForLegacyEmail({ identityService, email, log, area, route, method, allowLegacyFallback });
  if (identity.blocked) return { record: null, identity, method: 'blocked', blocked: true, reason: identity.reason };
  if (identity.student_id) {
    const record = await repository[byStudentId](identity.student_id);
    if (record) return { record, identity, method: 'student_id', blocked: false };
    if (!identity.allowFallback) return { record: null, identity, method: 'student_id', blocked: false };
  }
  if (!identity.allowFallback) return { record: null, identity, method: 'no_fallback', blocked: false };
  return { record: await repository[byEmail](email), identity, method: 'email_fallback', blocked: false };
}
