function rows(result) { return result?.results ?? []; }
function changes(result) { return Number(result?.meta?.changes ?? result?.changes ?? 0); }

export function createD1AnamnesisRepository(db) {
  return Object.freeze({
    findById(id) {
      return db.prepare('SELECT * FROM premium_anamnesis WHERE id = ? LIMIT 1').bind(id).first();
    },
    async findLatestByStudentId(studentId) {
      return db.prepare('SELECT * FROM premium_anamnesis WHERE student_id = ? ORDER BY datetime(created_at) DESC, id DESC LIMIT 1').bind(studentId).first();
    },
    async findLatestByEmail(email) {
      return db.prepare('SELECT * FROM premium_anamnesis WHERE lower(student_email) = lower(?) ORDER BY datetime(created_at) DESC, id DESC LIMIT 1').bind(email).first();
    },
    async create(record) {
      await db.prepare(`INSERT INTO premium_anamnesis (
        id, student_id, student_name, student_email, student_phone, status,
        answers_json, internal_scores_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
        record.id, record.student_id ?? null, record.student_name, record.student_email,
        record.student_phone ?? null, record.status ?? 'RECEBIDA', record.answers_json,
        record.internal_scores_json ?? null, record.created_at, record.updated_at ?? record.created_at
      ).run();
      return this.findById(record.id);
    },
    async createInitialIfAbsent(record) {
      const identityPredicate = record.student_id
        ? 'student_id = ?'
        : 'student_id IS NULL AND lower(student_email) = lower(?)';
      const identityValue = record.student_id ?? record.student_email;
      const result = await db.prepare(`INSERT INTO premium_anamnesis (
        id, student_id, student_name, student_email, student_phone, status,
        answers_json, internal_scores_json, created_at, updated_at
      ) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      WHERE NOT EXISTS (SELECT 1 FROM premium_anamnesis WHERE ${identityPredicate})`).bind(
        record.id, record.student_id ?? null, record.student_name, record.student_email,
        record.student_phone ?? null, record.status ?? 'RECEBIDA', record.answers_json,
        record.internal_scores_json ?? null, record.created_at, record.updated_at ?? record.created_at,
        identityValue
      ).run();
      if (changes(result) > 0) return { created: true, record: await this.findById(record.id) };
      const existing = record.student_id
        ? await this.findLatestByStudentId(record.student_id)
        : await this.findLatestByEmail(record.student_email);
      return { created: false, record: existing };
    },
    async markAnalyzed(id, { status = 'ANALISADA', updated_at } = {}) {
      const result = await db.prepare('UPDATE premium_anamnesis SET status = ?, updated_at = ? WHERE id = ?').bind(status, updated_at ?? new Date().toISOString(), id).run();
      return changes(result);
    },
  });
}
