import { NUTRITION_PLAN_STATUS, assertDraftEditable } from '../domain/nutrition-plan-status.js';
import { serializeCanonicalNutritionPlan, validateNutritionPlanStructure } from '../domain/nutrition-plan-schema.js';
function changes(result) { return Number(result?.meta?.changes ?? result?.changes ?? 0); }
function nowIso(value) { return value ?? new Date().toISOString(); }
function bindPlan(stmt, plan, now) { const s = serializeCanonicalNutritionPlan(plan); return stmt.bind(plan.id, plan.student_id ?? null, plan.student_email ?? null, s.title, s.goal, s.strategy, s.meals_json, s.substitutions_json, s.adherence_rules_json, s.notes, s.whatsapp_message, plan.status, plan.version_number ?? null, plan.published_at ?? null, plan.published_by ?? null, plan.archived_at ?? null, plan.supersedes_plan_id ?? null, plan.source_feedback_id ?? null, Number(plan.is_active ?? 0), plan.created_at ?? now, plan.updated_at ?? now); }
export function createD1NutritionPlanRepository(db) {
  const repo = {
    findById(id) { return db.prepare('SELECT * FROM nutrition_plans WHERE id = ? LIMIT 1').bind(id).first(); },
    findCurrentByStudentId(studentId) { return db.prepare("SELECT * FROM nutrition_plans WHERE student_id = ? AND is_active = 1 AND (status = 'PUBLISHED' OR status IS NULL) ORDER BY version_number DESC, datetime(published_at) DESC LIMIT 1").bind(studentId).first(); },
    findCurrentByEmail(email) { return db.prepare("SELECT * FROM nutrition_plans WHERE lower(student_email) = lower(?) AND student_id IS NULL AND is_active = 1 AND (status = 'PUBLISHED' OR status IS NULL) ORDER BY datetime(updated_at) DESC, datetime(created_at) DESC LIMIT 1").bind(email).first(); },
    findDraftByStudentId(studentId) { return db.prepare("SELECT * FROM nutrition_plans WHERE student_id = ? AND status = 'DRAFT' ORDER BY datetime(updated_at) DESC LIMIT 1").bind(studentId).first(); },
    listByStudentId(studentId, { limit = 20, offset = 0 } = {}) { return db.prepare('SELECT * FROM nutrition_plans WHERE student_id = ? ORDER BY COALESCE(version_number, 0) DESC, datetime(updated_at) DESC LIMIT ? OFFSET ?').bind(studentId, limit, offset).all().then(r => r.results || []); },
    findPreviousPublished(studentId) { return this.findCurrentByStudentId(studentId); },
    findBySourceFeedback(sourceFeedbackId) { return db.prepare('SELECT * FROM nutrition_plans WHERE source_feedback_id = ? ORDER BY datetime(updated_at) DESC').bind(sourceFeedbackId).all().then(r => r.results || []); },
    async createDraft(plan) { const existing = await this.findDraftByStudentId(plan.student_id); if (existing && !plan.allow_multiple_drafts) return existing; const now = nowIso(plan.created_at); const draft = { ...plan, status: NUTRITION_PLAN_STATUS.DRAFT, is_active: 0, created_at: now, updated_at: now }; await bindPlan(db.prepare(`INSERT INTO nutrition_plans (id, student_id, student_email, title, goal, strategy, meals_json, substitutions_json, adherence_rules_json, notes, whatsapp_message, status, version_number, published_at, published_by, archived_at, supersedes_plan_id, source_feedback_id, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`), draft, now).run(); return this.findById(draft.id); },
    async updateDraft(id, updates) { const current = await this.findById(id); assertDraftEditable(current); const s = serializeCanonicalNutritionPlan({ ...current, ...updates }); const result = await db.prepare(`UPDATE nutrition_plans SET title=?, goal=?, strategy=?, meals_json=?, substitutions_json=?, adherence_rules_json=?, notes=?, whatsapp_message=?, source_feedback_id=COALESCE(?, source_feedback_id), updated_at=? WHERE id=? AND status='DRAFT'`).bind(s.title, s.goal, s.strategy, s.meals_json, s.substitutions_json, s.adherence_rules_json, s.notes, s.whatsapp_message, updates.source_feedback_id ?? null, nowIso(updates.updated_at), id).run(); if (!changes(result)) throw new Error('NUTRITION_PLAN_DRAFT_CONFLICT'); return this.findById(id); },
    async publish(id, { published_by = 'admin', professional_note = null, randomUUID = crypto.randomUUID, now = new Date().toISOString() } = {}) {
      const draft = await this.findById(id); assertDraftEditable(draft); const validation = validateNutritionPlanStructure(draft); if (!validation.ok) { const e = new Error('INVALID_NUTRITION_PLAN_STRUCTURE'); e.details = validation.errors; throw e; }
      const previous = await this.findCurrentByStudentId(draft.student_id); const versionRow = await db.prepare('SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version FROM nutrition_plans WHERE student_id = ?').bind(draft.student_id).first(); const version = Number(versionRow?.next_version || 1);
      const statements = [];
      if (previous) statements.push(db.prepare("UPDATE nutrition_plans SET status='ARCHIVED', is_active=0, archived_at=?, updated_at=? WHERE id=? AND status='PUBLISHED'").bind(now, now, previous.id));
      statements.push(db.prepare("UPDATE nutrition_plans SET status='PUBLISHED', is_active=1, version_number=?, published_at=?, published_by=?, supersedes_plan_id=?, updated_at=? WHERE id=? AND status='DRAFT'").bind(version, now, published_by, previous?.id ?? null, now, id));
      statements.push(db.prepare(`INSERT OR IGNORE INTO premium_followup_entries (id, student_id, entry_type, title, content, source, related_entity_type, related_entity_id, created_by, created_at, updated_at) VALUES (?, ?, 'PLAN_CHANGE', 'Plano alimentar publicado', ?, 'admin', 'nutrition_plans', ?, ?, ?, ?)` ).bind(`plan-change:${id}`, draft.student_id, JSON.stringify({ plan_id: id, previous_plan_id: previous?.id ?? null, version_number: version, source_feedback_id: draft.source_feedback_id ?? null, professional_note }), id, published_by, now, now));
      if (draft.source_feedback_id) statements.push(db.prepare("UPDATE premium_pending_items SET status='RESOLVED', resolved_at=?, updated_at=? WHERE student_id=? AND type='CREATE_NUTRITION_PLAN' AND status='OPEN' AND related_entity_id=?").bind(now, now, draft.student_id, draft.source_feedback_id));
      statements.push(db.prepare("UPDATE premium_pending_items SET status='RESOLVED', resolved_at=?, updated_at=? WHERE student_id=? AND type='CREATE_NUTRITION_PLAN' AND status='OPEN' AND (related_entity_id IS NULL OR related_entity_id=? OR related_entity_id=?)").bind(now, now, draft.student_id, id, draft.source_feedback_id ?? ''));
      if (typeof db.batch === 'function') await db.batch(statements); else for (const st of statements) await st.run();
      return this.findById(id);
    },
    async archive(id, { archived_at = new Date().toISOString() } = {}) { const row = await this.findById(id); if (!row) return null; if (row.status === 'ARCHIVED') return row; const result = await db.prepare("UPDATE nutrition_plans SET status='ARCHIVED', is_active=0, archived_at=?, updated_at=? WHERE id=? AND status <> 'ARCHIVED'").bind(archived_at, archived_at, id).run(); if (!changes(result)) throw new Error('NUTRITION_PLAN_ARCHIVE_CONFLICT'); return this.findById(id); },
    async saveCurrent(plan) {
      const now = plan.updated_at ?? plan.created_at ?? new Date().toISOString();
      const hasStudentId = Boolean(plan.student_id);
      if (!hasStudentId && !plan.allowLegacyFallback) throw new Error('LEGACY_EMAIL_FALLBACK_NOT_ALLOWED');
      const deactivate = hasStudentId
        ? db.prepare("UPDATE nutrition_plans SET is_active = 0, status = 'ARCHIVED', updated_at = ? WHERE student_id = ? AND is_active = 1").bind(now, plan.student_id)
        : db.prepare("UPDATE nutrition_plans SET is_active = 0, status = 'ARCHIVED', updated_at = ? WHERE lower(student_email) = lower(?) AND student_id IS NULL AND is_active = 1").bind(now, plan.student_email);
      const insert = db.prepare(`INSERT INTO nutrition_plans (
        id, student_id, student_email, title, goal, strategy, meals_json, substitutions_json,
        adherence_rules_json, notes, whatsapp_message, is_active, status, published_at, published_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'PUBLISHED', ?, 'legacy-admin', ?, ?)` ).bind(
        plan.id, plan.student_id ?? null, plan.student_email, plan.title ?? null, plan.goal ?? null, plan.strategy ?? null,
        plan.meals_json ?? JSON.stringify(plan.meals ?? []), plan.substitutions_json ?? '[]', plan.adherence_rules_json ?? '[]', plan.notes ?? null,
        plan.whatsapp_message ?? null, now, plan.created_at ?? now, now
      );
      if (typeof db.batch === 'function') await db.batch([deactivate, insert]); else { await deactivate.run(); await insert.run(); }
      return hasStudentId ? this.findCurrentByStudentId(plan.student_id) : this.findCurrentByEmail(plan.student_email);
    },
    async updateCurrent() { throw new Error('PUBLISHED_NUTRITION_PLAN_IMMUTABLE'); },
  };
  return Object.freeze(repo);
}
