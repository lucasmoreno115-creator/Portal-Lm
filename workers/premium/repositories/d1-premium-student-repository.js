import { normalizePremiumStudentEmail } from '../services/student-identity-service.js';

function rowResult(result) { return result?.results ?? []; }

export function createD1PremiumStudentRepository(db) {
  return Object.freeze({
    async findByStudentId(studentId) {
      return db.prepare('SELECT * FROM premium_students WHERE student_id = ? LIMIT 1').bind(studentId).first();
    },
    async findByNormalizedEmail(normalizedEmail) {
      const result = await db.prepare('SELECT * FROM premium_students WHERE normalized_email = ? ORDER BY created_at ASC').bind(normalizedEmail).all();
      return rowResult(result);
    },
    async create(student) {
      const normalizedEmail = normalizePremiumStudentEmail(student.normalized_email ?? student.email, { required: true });
      const now = student.created_at ?? new Date().toISOString();
      await db.prepare(`INSERT INTO premium_students (student_id, email, normalized_email, display_name, consultation_status, access_status, source, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(student.student_id, student.email, normalizedEmail, student.display_name ?? null, student.consultation_status ?? 'NEW', student.access_status ?? 'ACTIVE', student.source ?? 'MIGRATION', now, student.updated_at ?? now).run();
      return this.findByStudentId(student.student_id);
    },
    async updateEmail(studentId, email) {
      const normalizedEmail = normalizePremiumStudentEmail(email, { required: true });
      await db.prepare('UPDATE premium_students SET email = ?, normalized_email = ?, updated_at = ? WHERE student_id = ?')
        .bind(email, normalizedEmail, new Date().toISOString(), studentId).run();
      return this.findByStudentId(studentId);
    },
    async listBackfillCandidates() {
      const result = await db.prepare(`SELECT id, name, email, status, plan, plan_type, student_id, created_at FROM student_access
        WHERE lower(coalesce(plan, 'premium')) = 'premium' ORDER BY created_at ASC, email ASC`).all();
      return rowResult(result);
    },
  });
}
