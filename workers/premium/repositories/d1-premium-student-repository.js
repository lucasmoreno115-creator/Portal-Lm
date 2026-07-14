import { normalizePremiumStudentEmail } from '../services/student-identity-service.js';

function rowResult(result) { return result?.results ?? []; }
function changedRows(result) { return Number(result?.meta?.changes ?? result?.changes ?? 0); }

const ASSOCIATION_QUERIES = Object.freeze({
  student_access: Object.freeze({
    select: 'SELECT id, email, student_id FROM student_access ORDER BY created_at ASC, id ASC',
    update: 'UPDATE student_access SET student_id = ? WHERE id = ? AND student_id IS NULL',
  }),
  premium_anamnesis: Object.freeze({
    select: 'SELECT id, student_email, student_id FROM premium_anamnesis ORDER BY created_at ASC, id ASC',
    update: 'UPDATE premium_anamnesis SET student_id = ? WHERE id = ? AND student_id IS NULL',
  }),
  nutrition_plans: Object.freeze({
    select: 'SELECT id, student_email, student_id FROM nutrition_plans ORDER BY created_at ASC, id ASC',
    update: 'UPDATE nutrition_plans SET student_id = ? WHERE id = ? AND student_id IS NULL',
  }),
  student_checkins: Object.freeze({
    select: 'SELECT id, student_email, student_id FROM student_checkins ORDER BY created_at ASC, id ASC',
    update: 'UPDATE student_checkins SET student_id = ? WHERE id = ? AND student_id IS NULL',
  }),
  activity_timeline: Object.freeze({
    select: 'SELECT id, student_email, student_id FROM activity_timeline ORDER BY created_at ASC, id ASC',
    update: 'UPDATE activity_timeline SET student_id = ? WHERE id = ? AND student_id IS NULL',
  }),
  weekly_plans: Object.freeze({
    select: 'SELECT id, student_email, student_id FROM weekly_plans ORDER BY created_at ASC, id ASC',
    update: 'UPDATE weekly_plans SET student_id = ? WHERE id = ? AND student_id IS NULL',
  }),
  progression_logs: Object.freeze({
    select: 'SELECT id, student_email, student_id FROM progression_logs ORDER BY created_at ASC, id ASC',
    update: 'UPDATE progression_logs SET student_id = ? WHERE id = ? AND student_id IS NULL',
  }),
  followup_logs: Object.freeze({
    select: 'SELECT id, student_email, student_id FROM followup_logs ORDER BY created_at ASC, id ASC',
    update: 'UPDATE followup_logs SET student_id = ? WHERE id = ? AND student_id IS NULL',
  }),
  retention_actions: Object.freeze({
    select: 'SELECT id, student_email, student_id FROM retention_actions ORDER BY created_at ASC, id ASC',
    update: 'UPDATE retention_actions SET student_id = ? WHERE id = ? AND student_id IS NULL',
  }),
});

function assertAllowedTable(table) {
  const query = ASSOCIATION_QUERIES[table];
  if (!query) throw new Error(`UNSUPPORTED_PREMIUM_STUDENT_IDENTITY_TABLE:${table}`);
  return query;
}

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
    async list({ status = null, limit = 100 } = {}) {
      const where = status ? 'WHERE consultation_status = ?' : '';
      const params = status ? [status, limit] : [limit];
      const result = await db.prepare(`SELECT * FROM premium_students ${where} ORDER BY display_name ASC, email ASC LIMIT ?`).bind(...params).all();
      return rowResult(result);
    },
    async listBackfillCandidates() {
      const result = await db.prepare(`SELECT id, name, email, status, plan, plan_type, student_id, created_at FROM student_access
        ORDER BY created_at ASC, email ASC`).all();
      return rowResult(result);
    },
    async listAssociationCandidates(tables = Object.keys(ASSOCIATION_QUERIES)) {
      const output = {};
      for (const table of tables) {
        const query = assertAllowedTable(table);
        const result = await db.prepare(query.select).all();
        output[table] = rowResult(result);
      }
      return output;
    },
    async associateStudentId(table, id, studentId) {
      const query = assertAllowedTable(table);
      const result = await db.prepare(query.update).bind(studentId, id).run();
      return changedRows(result);
    },
    async batchAssociateStudentIds(updates) {
      const statements = updates.map((update) => {
        const query = assertAllowedTable(update.table);
        return db.prepare(query.update).bind(update.student_id, update.id);
      });
      if (statements.length === 0) return [];
      if (typeof db.batch === 'function') {
        const results = await db.batch(statements);
        return results.map(changedRows);
      }
      const results = [];
      for (const statement of statements) {
        results.push(changedRows(await statement.run()));
      }
      return results;
    },
  });
}
