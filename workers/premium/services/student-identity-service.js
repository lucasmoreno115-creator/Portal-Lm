export function createStudentIdentityService() {
  return Object.freeze({
    normalizeEmail(email) {
      return String(email ?? '').trim().toLowerCase();
    },
    hasSameEmail(left, right) {
      return this.normalizeEmail(left) === this.normalizeEmail(right);
    },
  });
}
