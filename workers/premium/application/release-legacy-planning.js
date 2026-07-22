function changedRows(result) { return Number(result?.meta?.changes ?? result?.changes ?? 0); }
function isProjectLm(access) { return /^(projeto_lm|project_lm|projeto lm|project lm|lm2)$/i.test(String(access?.plan || '').trim()) || /^(projeto_lm|project_lm|projeto lm|project lm|lm2)$/i.test(String(access?.plan_type || '').trim()); }

/** Releases a published legacy planning without changing the official lifecycle transition rules. */
export function createReleaseLegacyPlanningUseCase({ db, randomUUID = crypto.randomUUID }) {
  return async function releaseLegacyPlanning({ student_id, created_by = null }) {
    const identifier = String(student_id || '').trim();
    if (!identifier) return { ok: false, error: 'Aluno não identificado.', status: 404 };
    const access = await db.prepare(`SELECT * FROM student_access WHERE student_id=? LIMIT 2`).bind(identifier).all().then((r) => r.results || []);
    const premium = await db.prepare(`SELECT * FROM premium_students WHERE student_id=? LIMIT 2`).bind(identifier).all().then((r) => r.results || []);
    if (access.length > 1 || premium.length > 1) return { ok: false, error: 'Conflito de identidade do aluno.', status: 409 };
    let legacyAccess = access[0] || null;
    let student = premium[0] || null;
    if (!student && legacyAccess?.email) {
      const byEmail = await db.prepare(`SELECT * FROM premium_students WHERE normalized_email=lower(trim(?)) OR lower(trim(email))=lower(trim(?)) LIMIT 2`).bind(legacyAccess.email, legacyAccess.email).all().then((r) => r.results || []);
      if (byEmail.length > 1 || (byEmail[0] && byEmail[0].student_id !== identifier)) return { ok: false, error: 'Conflito de identidade do aluno.', status: 409 };
      student = byEmail[0] || null;
    }
    if (!legacyAccess && student?.email) {
      const byEmail = await db.prepare(`SELECT * FROM student_access WHERE lower(trim(email))=lower(trim(?)) LIMIT 2`).bind(student.email).all().then((r) => r.results || []);
      if (byEmail.length > 1 || (byEmail[0]?.student_id && byEmail[0].student_id !== identifier)) return { ok: false, error: 'Conflito de identidade do aluno.', status: 409 };
      legacyAccess = byEmail[0] || null;
    }
    if (!student && !legacyAccess) return { ok: false, error: 'Aluno Premium não encontrado.', status: 404 };
    if (isProjectLm(legacyAccess)) return { ok: false, error: 'Identidades do Projeto LM não podem ser liberadas pelo Premium.', status: 403 };
    const email = student?.email || legacyAccess?.email;
    const published = await db.prepare(`SELECT id, student_id FROM nutrition_plans WHERE is_active=1 AND status='PUBLISHED' AND (student_id=? OR (student_id IS NULL AND lower(trim(student_email))=lower(trim(?)))) LIMIT 2`).bind(identifier, email || '').all().then((r) => r.results || []);
    if (published.length !== 1) return { ok: false, error: 'O aluno precisa ter um planejamento alimentar publicado e ativo.', status: 409 };
    if (student?.consultation_status === 'ACTIVE') return { ok: true, data: { student_id: identifier, idempotent: true } };
    const now = new Date().toISOString();
    const from = student?.consultation_status || 'LEGACY_COMPATIBLE';
    const name = student?.display_name || legacyAccess?.name || null;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail) return { ok: false, error: 'Conflito de identidade do aluno.', status: 409 };
    const statements = [];
    if (!student) statements.push(db.prepare(`INSERT INTO premium_students (student_id,email,normalized_email,display_name,consultation_status,access_status,source,created_at,updated_at) VALUES (?,?,?,?, 'ACTIVE','ACTIVE','LEGACY_IMPORT',?,?)`).bind(identifier, email, normalizedEmail, name, now, now));
    else statements.push(db.prepare(`UPDATE premium_students SET consultation_status='ACTIVE', access_status='ACTIVE', updated_at=? WHERE student_id=? AND consultation_status=?`).bind(now, identifier, student.consultation_status));
    if (legacyAccess) statements.push(db.prepare(`UPDATE student_access SET status='ACTIVE' WHERE id=?`).bind(legacyAccess.id));
    if (published[0].student_id == null) statements.push(db.prepare(`UPDATE nutrition_plans SET student_id=?, updated_at=? WHERE id=? AND student_id IS NULL`).bind(identifier, now, published[0].id));
    const content = JSON.stringify({ student_id: identifier, from, to: 'ACTIVE', action: 'release-planning', origin: 'student_record', legacyCompatibility: true });
    statements.push(db.prepare(`INSERT INTO premium_followup_entries (id,student_id,entry_type,title,content,source,related_entity_type,related_entity_id,created_by,created_at,updated_at) VALUES (?,?,'CONSULTATION_STATUS_CHANGE','Planejamento legado liberado',?,'admin','premium_students',?,?,?, ?,?)`).bind(randomUUID(), identifier, content, identifier, created_by, now, now));
    const results = typeof db.batch === 'function' ? await db.batch(statements) : await Promise.all(statements.map((statement) => statement.run()));
    if (student && changedRows(results[0]) !== 1) return { ok: false, error: 'Status da consultoria mudou antes da conclusão. Recarregue o prontuário.', status: 409 };
    return { ok: true, data: { student_id: identifier, from, to: 'ACTIVE', idempotent: false } };
  };
}
