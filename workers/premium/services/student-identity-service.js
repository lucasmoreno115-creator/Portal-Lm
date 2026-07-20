export const STUDENT_IDENTITY_ERRORS = Object.freeze({
  EMAIL_REQUIRED: 'EMAIL_REQUIRED',
  STUDENT_NOT_FOUND: 'STUDENT_NOT_FOUND',
  AMBIGUOUS_STUDENT_IDENTITY: 'AMBIGUOUS_STUDENT_IDENTITY',
  NON_PREMIUM_STUDENT: 'NON_PREMIUM_STUDENT',
});

export function normalizePremiumStudentEmail(email, { required = false } = {}) {
  const normalizedEmail = String(email ?? '').trim().toLowerCase();
  if (required && !normalizedEmail) {
    throw new Error(STUDENT_IDENTITY_ERRORS.EMAIL_REQUIRED);
  }
  return normalizedEmail;
}

function isValidEmailIdentifier(value) {
  // This intentionally accepts only a conventional, complete e-mail address;
  // identifiers are never searched with partial or fuzzy matching.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function generatePremiumStudentId(randomUUID = globalThis.crypto?.randomUUID?.bind(globalThis.crypto)) {
  if (typeof randomUUID !== 'function') {
    throw new Error('STUDENT_ID_GENERATOR_UNAVAILABLE');
  }
  return randomUUID();
}

function ok(method, student) {
  return { ok: true, method, student, error: null };
}

function fail(error, details = {}) {
  return { ok: false, method: null, student: null, error, details };
}

function isProjectOnly(student) {
  const plan = String(student?.plan ?? student?.plan_type ?? '').trim().toLowerCase();
  return plan === 'projeto_lm' || plan === 'project_lm' || plan === 'lm2';
}

export function createStudentIdentityService({ repository, events } = {}) {
  return Object.freeze({
    normalizeEmail(email, options) {
      return normalizePremiumStudentEmail(email, options);
    },
    generateStudentId(randomUUID) {
      return generatePremiumStudentId(randomUUID);
    },
    hasSameEmail(left, right) {
      return this.normalizeEmail(left) === this.normalizeEmail(right);
    },
    async resolve({ student_id, email } = {}) {
      if (student_id) {
        const student = await repository.findByStudentId(student_id);
        if (!student) return fail(STUDENT_IDENTITY_ERRORS.STUDENT_NOT_FOUND, { student_id });
        if (isProjectOnly(student)) return fail(STUDENT_IDENTITY_ERRORS.NON_PREMIUM_STUDENT, { student_id });
        events?.emit?.('PREMIUM_STUDENT_IDENTITY_RESOLVED_BY_ID');
        return ok('student_id', student);
      }

      const normalizedEmail = normalizePremiumStudentEmail(email, { required: true });
      const students = await repository.findByNormalizedEmail(normalizedEmail);
      const list = Array.isArray(students) ? students : students ? [students] : [];
      const premiumStudents = list.filter((student) => !isProjectOnly(student));
      if (premiumStudents.length === 0) return fail(STUDENT_IDENTITY_ERRORS.STUDENT_NOT_FOUND, { normalized_email: normalizedEmail });
      if (premiumStudents.length > 1 || list.length !== premiumStudents.length) {
        events?.emit?.('PREMIUM_STUDENT_IDENTITY_CONFLICT');
        return fail(STUDENT_IDENTITY_ERRORS.AMBIGUOUS_STUDENT_IDENTITY, { normalized_email: normalizedEmail, matches: list.length });
      }
      events?.emit?.('PREMIUM_STUDENT_IDENTITY_RESOLVED_BY_EMAIL_FALLBACK');
      return ok('normalized_email', premiumStudents[0]);
    },
    async resolveIdentifier(identifier) {
      const value = String(identifier ?? '').trim();
      if (!value) return fail(STUDENT_IDENTITY_ERRORS.STUDENT_NOT_FOUND);
      const direct = await repository.findByStudentId(value);
      if (direct && !isProjectOnly(direct)) return ok('student_id', direct);
      if (!isValidEmailIdentifier(value)) return fail(STUDENT_IDENTITY_ERRORS.STUDENT_NOT_FOUND);
      return this.resolve({ email: normalizePremiumStudentEmail(value, { required: true }) });
    },
  });
}
