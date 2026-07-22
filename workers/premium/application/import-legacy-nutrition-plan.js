function rows(result) { return result?.results ?? []; }
function isProjectLm(access) { return /^(projeto_lm|project_lm|projeto lm|project lm|lm2)$/i.test(String(access?.plan || '').trim()) || /^(projeto_lm|project_lm|projeto lm|project lm|lm2)$/i.test(String(access?.plan_type || '').trim()); }
function isValidLegacyPlan(plan) {
  if (!plan || Number(plan.is_active) !== 1 || !['PUBLISHED', null].includes(plan.status)) return false;
  try { return Array.isArray(JSON.parse(plan.meals_json || '[]')); } catch { return false; }
}

/**
 * Copies the pre-lifecycle legacy row in `nutrition_plans` (status IS NULL) into
 * an immutable Premium PUBLISHED snapshot. The legacy row and any current DRAFT
 * are deliberately never updated by this operation.
 */
export function createImportLegacyNutritionPlanUseCase({ db, randomUUID = () => crypto.randomUUID(), now = () => new Date().toISOString() }) {
  return async function importLegacyNutritionPlan({ student_id, created_by = null }) {
    const studentId = String(student_id || '').trim();
    if (!studentId) return { ok: false, error: 'Aluno não identificado.', status: 404 };
    const [students, accesses] = await Promise.all([
      db.prepare('SELECT * FROM premium_students WHERE student_id=? LIMIT 2').bind(studentId).all().then(rows),
      db.prepare('SELECT * FROM student_access WHERE student_id=? LIMIT 2').bind(studentId).all().then(rows),
    ]);
    if (students.length !== 1 || accesses.length > 1) return { ok: false, error: 'Conflito de identidade do aluno.', status: 409 };
    const student = students[0]; const access = accesses[0] || null;
    if (isProjectLm(access)) return { ok: false, error: 'Projeto LM não permite importar planejamento legado.', status: 403 };
    const email = String(student.email || access?.email || '').trim();
    if (!email) return { ok: false, error: 'Conflito de identidade do aluno.', status: 409 };

    const published = await db.prepare("SELECT id FROM nutrition_plans WHERE student_id=? AND status='PUBLISHED' AND is_active=1 LIMIT 2").bind(studentId).all().then(rows);
    if (published.length > 1) return { ok: false, error: 'Conflito de planos publicados do aluno.', status: 409 };
    if (published.length === 1) return { ok: true, data: { student_id: studentId, nutrition_plan_id: published[0].id, idempotent: true } };

    // Backfilled legacy rows are PUBLISHED but remain unassociated (student_id IS NULL).
    // NULL status is retained solely for partially migrated environments.
    const legacy = await db.prepare("SELECT * FROM nutrition_plans WHERE is_active=1 AND student_id IS NULL AND (status='PUBLISHED' OR status IS NULL) AND lower(trim(student_email))=lower(trim(?)) ORDER BY CASE WHEN status='PUBLISHED' THEN 0 ELSE 1 END, datetime(updated_at) DESC, datetime(created_at) DESC LIMIT 2").bind(email).all().then(rows);
    if (legacy.length > 1) return { ok: false, error: 'Mais de um planejamento legado foi encontrado; revise antes de importar.', status: 409 };
    if (!isValidLegacyPlan(legacy[0])) return { ok: false, error: 'Nenhum planejamento legado válido foi encontrado para este aluno.', status: 404 };
    const source = legacy[0]; const importedId = randomUUID(); const importedAt = now();
    // Migration 0036 scopes active-email uniqueness to unassociated legacy rows,
    // so the immutable snapshot can retain the student's official email.
    const snapshotEmail = email;
    const compatibility = JSON.stringify({ origin: 'LEGACY_IMPORT', legacy_plan_id: source.id, legacy_student_email: source.student_email, legacy_private_notes: source.private_notes ?? null });
    const insert = db.prepare(`INSERT INTO nutrition_plans (id,student_id,student_email,title,goal,strategy,meals_json,substitutions_json,adherence_rules_json,notes,whatsapp_message,is_active,status,version_number,published_at,published_by,supersedes_plan_id,source_feedback_id,private_notes,created_at,updated_at)
      SELECT ?,?,?,?,?,?,?,?,?,?,?,1,'PUBLISHED',(SELECT COALESCE(MAX(version_number),0)+1 FROM nutrition_plans WHERE student_id=?),?,? ,?,NULL,?,?,?
      WHERE EXISTS (SELECT 1 FROM nutrition_plans WHERE id=? AND student_id IS NULL AND is_active=1 AND (status='PUBLISHED' OR status IS NULL))
        AND NOT EXISTS (SELECT 1 FROM nutrition_plans WHERE student_id=? AND status='PUBLISHED' AND is_active=1)`).bind(importedId, studentId, snapshotEmail, source.title, source.goal, source.strategy, source.meals_json, source.substitutions_json, source.adherence_rules_json, source.notes, source.whatsapp_message, studentId, importedAt, created_by || 'legacy-import', source.id, compatibility, importedAt, importedAt, source.id, studentId);
    const audit = db.prepare("INSERT INTO premium_followup_entries (id,student_id,entry_type,title,content,source,related_entity_type,related_entity_id,created_by,created_at,updated_at) VALUES (?,?,'PLAN_CHANGE','Planejamento antigo importado',?,'admin','nutrition_plans',?,?,?,?)").bind(`plan-change:${importedId}`, studentId, JSON.stringify({ action: 'import-legacy-nutrition-plan', origin: 'LEGACY_IMPORT', legacy_plan_id: source.id, imported_plan_id: importedId }), importedId, created_by, importedAt, importedAt);
    if (typeof db.batch !== 'function') return { ok: false, error: 'A importação exige uma transação atômica; nenhuma alteração foi realizada.', status: 503 };
    try { await db.batch([insert, audit]); } catch { return { ok: false, error: 'Não foi possível importar o planejamento legado; nenhuma liberação foi realizada.', status: 409 }; }
    const imported = await db.prepare("SELECT id FROM nutrition_plans WHERE id=? AND student_id=? AND status='PUBLISHED' AND is_active=1 LIMIT 1").bind(importedId, studentId).first();
    if (!imported) return { ok: false, error: 'O planejamento legado mudou antes da importação. Recarregue o prontuário.', status: 409 };
    return { ok: true, data: { student_id: studentId, nutrition_plan_id: imported.id, legacy_plan_id: source.id, idempotent: false } };
  };
}
