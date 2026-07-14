function changes(result) { return Number(result?.meta?.changes ?? result?.changes ?? 0); }

export function createD1NutritionPlanRepository(db) {
  return Object.freeze({
    findCurrentByStudentId(studentId) {
      return db.prepare('SELECT * FROM nutrition_plans WHERE student_id = ? AND is_active = 1 ORDER BY datetime(updated_at) DESC, datetime(created_at) DESC, id DESC LIMIT 1').bind(studentId).first();
    },
    findCurrentByEmail(email) {
      return db.prepare('SELECT * FROM nutrition_plans WHERE lower(student_email) = lower(?) AND student_id IS NULL AND is_active = 1 ORDER BY datetime(updated_at) DESC, datetime(created_at) DESC, id DESC LIMIT 1').bind(email).first();
    },
    async saveCurrent(plan) {
      const now = plan.updated_at ?? plan.created_at ?? new Date().toISOString();
      const hasStudentId = Boolean(plan.student_id);
      if (!hasStudentId && !plan.allowLegacyFallback) throw new Error('LEGACY_EMAIL_FALLBACK_NOT_ALLOWED');
      const deactivate = hasStudentId
        ? db.prepare('UPDATE nutrition_plans SET is_active = 0, updated_at = ? WHERE student_id = ? AND is_active = 1').bind(now, plan.student_id)
        : db.prepare('UPDATE nutrition_plans SET is_active = 0, updated_at = ? WHERE lower(student_email) = lower(?) AND student_id IS NULL AND is_active = 1').bind(now, plan.student_email);
      const insert = db.prepare(`INSERT INTO nutrition_plans (
        id, student_id, student_email, title, goal, strategy, meals_json, substitutions_json,
        adherence_rules_json, notes, whatsapp_message, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`).bind(
        plan.id, plan.student_id ?? null, plan.student_email, plan.title ?? null, plan.goal ?? null, plan.strategy ?? null,
        plan.meals_json, plan.substitutions_json ?? '[]', plan.adherence_rules_json ?? '[]', plan.notes ?? null,
        plan.whatsapp_message ?? null, plan.created_at ?? now, now
      );
      if (typeof db.batch === 'function') await db.batch([deactivate, insert]);
      else { await deactivate.run(); await insert.run(); }
      return hasStudentId ? this.findCurrentByStudentId(plan.student_id) : this.findCurrentByEmail(plan.student_email);
    },
    async updateCurrent(id, updates) {
      const result = await db.prepare(`UPDATE nutrition_plans SET title = ?, goal = ?, strategy = ?, meals_json = ?, substitutions_json = ?, adherence_rules_json = ?, notes = ?, whatsapp_message = ?, updated_at = ? WHERE id = ? AND is_active = 1`).bind(
        updates.title ?? null, updates.goal ?? null, updates.strategy ?? null, updates.meals_json, updates.substitutions_json ?? '[]', updates.adherence_rules_json ?? '[]', updates.notes ?? null, updates.whatsapp_message ?? null, updates.updated_at ?? new Date().toISOString(), id
      ).run();
      return changes(result);
    },
  });
}
