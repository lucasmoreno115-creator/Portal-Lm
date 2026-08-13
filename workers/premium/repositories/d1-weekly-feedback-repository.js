import { uniqueLegacyCheckinStudentIdSql } from './legacy-checkin-identity-sql.js';

function rows(result) { return result?.results ?? []; }
function changes(result) { return Number(result?.meta?.changes ?? result?.changes ?? 0); }

export function createD1WeeklyFeedbackRepository(db) {
  const legacyStudentId = uniqueLegacyCheckinStudentIdSql('sc');
  const storedLegacyStudentId = uniqueLegacyCheckinStudentIdSql('student_checkins');
  return Object.freeze({
    findById(id) { return db.prepare(`SELECT sc.id, sc.student_email, sc.week_ref,
      sc.training_adherence, sc.nutrition_adherence, sc.cardio_adherence, sc.free_meals,
      sc.hunger_level, sc.binge_or_snacking, sc.sleep_quality, sc.energy_level, sc.stress_level,
      sc.weekly_weight, sc.waist, sc.strength_status, sc.main_difficulty, sc.routine_context,
      sc.weekly_score, sc.support_needed, sc.coach_status, sc.coach_reply, sc.coach_reply_at,
      sc.submitted_at, sc.available_at, sc.reviewed_at, sc.analyzed_at, sc.decision_type,
      sc.decision_note, sc.decision_at, sc.followup_at, sc.created_at, sc.updated_at,
      COALESCE(sc.student_id, ${legacyStudentId}) AS student_id
      FROM student_checkins sc WHERE sc.id = ?
      AND EXISTS (SELECT 1 FROM premium_students ps WHERE ps.student_id=COALESCE(sc.student_id, ${legacyStudentId}))
      LIMIT 1`).bind(id).first(); },
    async claimLegacyIdentity(id) {
      return changes(await db.prepare(`UPDATE student_checkins
        SET student_id=${storedLegacyStudentId}
        WHERE id=? AND ${storedLegacyStudentId} IS NOT NULL`).bind(id).run());
    },
    findByStudentAndWeek(studentId, weekRef) { return db.prepare('SELECT * FROM student_checkins WHERE student_id = ? AND week_ref = ? LIMIT 1').bind(studentId, weekRef).first(); },
    findAvailableByStudentId(studentId, weekRef) { return this.findByStudentAndWeek(studentId, weekRef); },
    async listByStudentId(studentId, { limit = 20 } = {}) {
      return rows(await db.prepare('SELECT * FROM student_checkins WHERE student_id = ? ORDER BY datetime(created_at) DESC, id DESC LIMIT ?').bind(studentId, limit).all());
    },
    async listByEmail(email, { limit = 20 } = {}) {
      return rows(await db.prepare('SELECT * FROM student_checkins WHERE lower(student_email) = lower(?) ORDER BY datetime(created_at) DESC, id DESC LIMIT ?').bind(email, limit).all());
    },
    async create(record) {
      await db.prepare(`INSERT OR IGNORE INTO student_checkins (
        id, student_id, student_email, week_ref, training_adherence, nutrition_adherence, cardio_adherence,
        free_meals, hunger_level, binge_or_snacking, sleep_quality, energy_level, stress_level,
        weekly_weight, waist, strength_status, main_difficulty, routine_context, weekly_score,
        support_needed, created_at, submitted_at, available_at, updated_at, coach_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`).bind(
        record.id, record.student_id ?? null, record.student_email, record.week_ref, record.training_adherence ?? null,
        record.nutrition_adherence ?? null, record.cardio_adherence ?? null, record.free_meals ?? null,
        record.hunger_level ?? null, record.binge_or_snacking ?? null, record.sleep_quality ?? null,
        record.energy_level ?? null, record.stress_level ?? null, record.weekly_weight ?? null,
        record.waist ?? null, record.strength_status ?? null, record.main_difficulty ?? null,
        record.routine_context ?? null, record.weekly_score ?? null, record.support_needed ?? null, record.created_at,
        record.submitted_at ?? record.created_at, record.available_at ?? null, record.updated_at ?? record.created_at
      ).run();
      const saved = record.student_id && record.week_ref ? await this.findByStudentAndWeek(record.student_id, record.week_ref) : await this.findById(record.id);
      if (!saved) return { ...record, student_id: record.student_id ?? null };
      if (saved.id !== record.id) return this.submit(saved.id, record);
      return saved;
    },
    async submit(id, record) {
      const result = await db.prepare(`UPDATE student_checkins SET training_adherence=?, nutrition_adherence=?, cardio_adherence=?, free_meals=?, hunger_level=?, binge_or_snacking=?, sleep_quality=?, energy_level=?, stress_level=?, weekly_weight=?, waist=?, strength_status=?, main_difficulty=?, routine_context=?, weekly_score=?, support_needed=?, submitted_at=COALESCE(submitted_at, ?), updated_at=? WHERE id=? AND (coach_status IS NULL OR upper(coalesce(coach_status,'')) NOT IN ('REVIEWED','REPLIED','ANALYZED','ANALISADO','ANALISADA'))`).bind(record.training_adherence ?? null, record.nutrition_adherence ?? null, record.cardio_adherence ?? null, record.free_meals ?? null, record.hunger_level ?? null, record.binge_or_snacking ?? null, record.sleep_quality ?? null, record.energy_level ?? null, record.stress_level ?? null, record.weekly_weight ?? null, record.waist ?? null, record.strength_status ?? null, record.main_difficulty ?? null, record.routine_context ?? null, record.weekly_score ?? null, record.support_needed ?? null, record.submitted_at ?? record.created_at ?? new Date().toISOString(), record.updated_at ?? new Date().toISOString(), id).run();
      const saved = await this.findById(id);
      if (changes(result) === 0 && saved && ['REVIEWED','REPLIED','ANALYZED','ANALISADO','ANALISADA'].includes(String(saved.coach_status || '').toUpperCase())) return { blocked: true, status: 409, record: saved };
      return saved;
    },
    async listPendingAnalysis({ limit = 50 } = {}) { return rows(await db.prepare(`SELECT * FROM student_checkins WHERE (coach_status IS NULL OR lower(coach_status) IN ('pending','responded')) AND submitted_at IS NOT NULL ORDER BY datetime(submitted_at) ASC LIMIT ?`).bind(limit).all()); },
    async listMissingResponses({ weekRef, deadline, limit = 50 } = {}) { return rows(await db.prepare(`SELECT ps.* FROM premium_students ps LEFT JOIN student_checkins sc ON sc.student_id=ps.student_id AND sc.week_ref=? WHERE ps.consultation_status='ACTIVE' AND ps.access_status='ACTIVE' AND (sc.id IS NULL OR sc.submitted_at IS NULL) ORDER BY ps.display_name ASC, ps.email ASC LIMIT ?`).bind(weekRef, limit).all()); },
    async markAnalyzed(id, { reviewed_at, reviewed_by, coach_status = 'reviewed' } = {}) {
      return changes(await db.prepare('UPDATE student_checkins SET coach_status = ?, reviewed_at = ?, reviewed_by = ?, analyzed_at = ? WHERE id = ?').bind(coach_status, reviewed_at ?? new Date().toISOString(), reviewed_by ?? null, reviewed_at ?? new Date().toISOString(), id).run());
    },

  });
}
