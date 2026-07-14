function rows(result) { return result?.results ?? []; }
function changes(result) { return Number(result?.meta?.changes ?? result?.changes ?? 0); }

export function createD1WeeklyFeedbackRepository(db) {
  return Object.freeze({
    findById(id) { return db.prepare('SELECT * FROM student_checkins WHERE id = ? LIMIT 1').bind(id).first(); },
    async listByStudentId(studentId, { limit = 20 } = {}) {
      return rows(await db.prepare('SELECT * FROM student_checkins WHERE student_id = ? ORDER BY datetime(created_at) DESC, id DESC LIMIT ?').bind(studentId, limit).all());
    },
    async listByEmail(email, { limit = 20 } = {}) {
      return rows(await db.prepare('SELECT * FROM student_checkins WHERE lower(student_email) = lower(?) ORDER BY datetime(created_at) DESC, id DESC LIMIT ?').bind(email, limit).all());
    },
    async create(record) {
      await db.prepare(`INSERT INTO student_checkins (
        id, student_id, student_email, week_ref, training_adherence, nutrition_adherence, cardio_adherence,
        free_meals, hunger_level, binge_or_snacking, sleep_quality, energy_level, stress_level,
        weekly_weight, waist, strength_status, main_difficulty, routine_context, weekly_score,
        support_needed, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
        record.id, record.student_id ?? null, record.student_email, record.week_ref, record.training_adherence ?? null,
        record.nutrition_adherence ?? null, record.cardio_adherence ?? null, record.free_meals ?? null,
        record.hunger_level ?? null, record.binge_or_snacking ?? null, record.sleep_quality ?? null,
        record.energy_level ?? null, record.stress_level ?? null, record.weekly_weight ?? null,
        record.waist ?? null, record.strength_status ?? null, record.main_difficulty ?? null,
        record.routine_context ?? null, record.weekly_score ?? null, record.support_needed ?? null, record.created_at
      ).run();
      return this.findById(record.id);
    },
    async markAnalyzed(id, { reviewed_at, reviewed_by, coach_status = 'reviewed' } = {}) {
      return changes(await db.prepare('UPDATE student_checkins SET coach_status = ?, reviewed_at = ?, reviewed_by = ? WHERE id = ?').bind(coach_status, reviewed_at ?? new Date().toISOString(), reviewed_by ?? null, id).run());
    },
    async saveProfessionalDecision(id, decision) {
      return changes(await db.prepare(`UPDATE student_checkins SET coach_reply = ?, coach_reply_at = ?, coach_status = ?, reviewed_at = ?, reviewed_by = ? WHERE id = ?`).bind(
        decision.coach_reply, decision.coach_reply_at, decision.coach_status ?? 'replied', decision.reviewed_at ?? decision.coach_reply_at, decision.reviewed_by ?? null, id
      ).run());
    },
  });
}
