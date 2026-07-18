function rows(result) { return result?.results || []; }
function clampLimit(value, defaultValue = 25, max = 50) { const n = Number(value || defaultValue); return Number.isFinite(n) ? Math.min(Math.max(Math.trunc(n), 1), max) : defaultValue; }
function offset(value) { const n = Number(value || 0); return Number.isFinite(n) ? Math.min(Math.max(Math.trunc(n), 0), 100000) : 0; }
function escapeLike(value) { return String(value || '').replace(/[\\%_]/g, (char) => `\\${char}`); }
function normalizeSearchTerm(q) { return String(q || '').trim().replace(/\s+/g, ' '); }
function normalizeDigits(q) { return String(q || '').replace(/\D/g, ''); }
function normalizeEmail(value) { return String(value || '').trim().toLowerCase(); }
const IDENTITY_BRIDGE_CTE = `WITH identity_bridge AS (
  SELECT ps.student_id AS id, ps.student_id, ps.email, lower(trim(ps.email)) normalized_email, ps.display_name name, sa.whatsapp whatsapp, ps.consultation_status, ps.access_status, sa.status portal_access_status, ps.created_at, 'premium' source, CASE WHEN coalesce(ps.student_id,'')<>'' THEN 'student_id' ELSE 'email_bridge' END identity_mode
  FROM premium_students ps LEFT JOIN student_access sa ON sa.student_id=ps.student_id
  UNION ALL
  SELECT coalesce(sa.student_id, lower(trim(sa.email))) AS id, sa.student_id, sa.email, lower(trim(sa.email)) normalized_email, sa.name, sa.whatsapp whatsapp, 'ACTIVE' consultation_status, sa.status access_status, sa.status portal_access_status, sa.created_at, 'legacy' source, CASE WHEN coalesce(sa.student_id,'')<>'' THEN 'student_id' ELSE 'email_bridge' END identity_mode
  FROM student_access sa
  WHERE upper(coalesce(sa.status,''))='ACTIVE'
    AND (lower(coalesce(sa.plan,''))='premium' OR lower(coalesce(sa.plan_type,''))='premium')
    AND NOT EXISTS (SELECT 1 FROM premium_students ps WHERE lower(trim(ps.email))=lower(trim(sa.email)) OR (coalesce(sa.student_id,'')<>'' AND ps.student_id=sa.student_id))
)`;
function logIdentity(row) { if (row) console.info(`IDENTITY_SOURCE=${row.source || 'premium'} IDENTITY_MODE=${row.identity_mode || 'student_id'}`); }
function isSaturdayInSaoPaulo(now) { return new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short' }).format(now) === 'Sat'; }
const ANALYZED = "upper(coalesce(coach_status,'')) IN ('REVIEWED','REPLIED','ANALYZED','ANALISADO','ANALISADA')";
const NEXT_PENDING_ORDER = "ORDER BY CASE priority WHEN 'HIGH' THEN 0 WHEN 'NORMAL' THEN 1 ELSE 2 END, datetime(created_at) ASC, id ASC LIMIT 1";
const NEXT_PENDING_SELECT = `
  (SELECT id FROM premium_pending_items pi WHERE pi.student_id=ps.student_id AND pi.status='OPEN' ${NEXT_PENDING_ORDER}) next_pending_id,
  (SELECT type FROM premium_pending_items pi WHERE pi.student_id=ps.student_id AND pi.status='OPEN' ${NEXT_PENDING_ORDER}) next_pending_type,
  (SELECT title FROM premium_pending_items pi WHERE pi.student_id=ps.student_id AND pi.status='OPEN' ${NEXT_PENDING_ORDER}) next_pending_title,
  (SELECT description FROM premium_pending_items pi WHERE pi.student_id=ps.student_id AND pi.status='OPEN' ${NEXT_PENDING_ORDER}) next_pending_description,
  (SELECT priority FROM premium_pending_items pi WHERE pi.student_id=ps.student_id AND pi.status='OPEN' ${NEXT_PENDING_ORDER}) next_pending_priority,
  (SELECT source FROM premium_pending_items pi WHERE pi.student_id=ps.student_id AND pi.status='OPEN' ${NEXT_PENDING_ORDER}) next_pending_source,
  (SELECT created_at FROM premium_pending_items pi WHERE pi.student_id=ps.student_id AND pi.status='OPEN' ${NEXT_PENDING_ORDER}) next_pending_created_at,
  (SELECT related_entity_type FROM premium_pending_items pi WHERE pi.student_id=ps.student_id AND pi.status='OPEN' ${NEXT_PENDING_ORDER}) next_pending_related_entity_type,
  (SELECT related_entity_id FROM premium_pending_items pi WHERE pi.student_id=ps.student_id AND pi.status='OPEN' ${NEXT_PENDING_ORDER}) next_pending_related_entity_id`;
function mapFilters(filters) { const where = ['1=1']; const params = []; if (filters.student_id) { where.push('(ib.id=? OR ib.student_id=? OR ib.normalized_email=?)'); params.push(filters.student_id, filters.student_id, normalizeEmail(filters.student_id)); } if (filters.status) { where.push('ib.consultation_status=?'); params.push(filters.status); } return { where, params }; }
function expandNext(row) { if (row?.next_pending_id) row.next_pending = { id: row.next_pending_id, student_id: row.student_id, type: row.next_pending_type, title: row.next_pending_title, description: row.next_pending_description, priority: row.next_pending_priority, source: row.next_pending_source, created_at: row.next_pending_created_at, related_entity_type: row.next_pending_related_entity_type, related_entity_id: row.next_pending_related_entity_id, status: 'OPEN' }; for (const key of Object.keys(row || {})) if (key.startsWith('next_pending_')) delete row[key]; return row; }
export function createD1ProfessionalWorkspaceRepository(db, { scheduleService } = {}) {
  const weekRefFor = (now = new Date()) => scheduleService?.getWeekRef?.(now) || null;
  return Object.freeze({
    async getSummary({ now = new Date() } = {}) {
      const weekRef = weekRefFor(now);
      const feedbackWeekFilter = weekRef ? 'AND sc.week_ref=?' : '';
      const feedbackParams = weekRef ? [weekRef] : [];
      const missingWeekFilter = weekRef ? 'AND sc.week_ref=?' : '';
      const missingParams = weekRef ? [weekRef] : [];
      const sid = "coalesce(ib.student_id,'__email_bridge__')";
      const [pending, awaiting, missing, plan, anamnesis] = await Promise.all([
        db.prepare(IDENTITY_BRIDGE_CTE + ` SELECT COUNT(*) total FROM premium_pending_items pi JOIN identity_bridge ib ON pi.student_id=${sid} WHERE pi.status='OPEN'`).first(),
        db.prepare(IDENTITY_BRIDGE_CTE + ` SELECT COUNT(DISTINCT sc.id) total FROM student_checkins sc JOIN identity_bridge ib ON (sc.student_id=${sid} OR lower(trim(sc.student_email))=ib.normalized_email) WHERE NOT (${ANALYZED}) ${feedbackWeekFilter}`).bind(...feedbackParams).first(),
        db.prepare(IDENTITY_BRIDGE_CTE + ` SELECT COUNT(*) total FROM identity_bridge ib WHERE ib.consultation_status IN ('ACTIVE','UNDER_REVIEW') AND NOT EXISTS (SELECT 1 FROM student_checkins sc WHERE (sc.student_id=${sid} OR lower(trim(sc.student_email))=ib.normalized_email) ${missingWeekFilter})`).bind(...missingParams).first(),
        db.prepare(IDENTITY_BRIDGE_CTE + ` SELECT COUNT(DISTINCT ib.id) total FROM identity_bridge ib WHERE EXISTS (SELECT 1 FROM premium_pending_items pi WHERE pi.student_id=${sid} AND pi.status='OPEN' AND pi.type='CREATE_NUTRITION_PLAN')`).first(),
        db.prepare(IDENTITY_BRIDGE_CTE + ` SELECT COUNT(DISTINCT pa.student_id) total FROM premium_anamnesis pa JOIN identity_bridge ib ON pa.student_id=${sid} WHERE upper(coalesce(pa.status,'')) NOT IN ('ANALYZED','ANALISADA')`).first(),
      ]);
      return { weekRef, openPendingItems: pending?.total || 0, feedbacksAwaitingAnalysis: awaiting?.total || 0, studentsWithoutResponse: missing?.total || 0, plansPendingUpdate: plan?.total || 0, anamnesesAwaitingAnalysis: anamnesis?.total || 0, isSaturday: isSaturdayInSaoPaulo(now), date: now.toISOString() };
    },
    async listStudents(filters = {}) {
      const limit = clampLimit(filters.limit, 25); const offsetValue = offset(filters.cursor); const { where, params } = mapFilters(filters); const weekRef = weekRefFor(filters.now ? new Date(filters.now) : new Date());
      const sid = 'coalesce(ib.student_id,\'__email_bridge__\')';
      if (filters.has_pending === 'true') where.push(`EXISTS (SELECT 1 FROM premium_pending_items pi WHERE pi.student_id=${sid} AND pi.status='OPEN')`);
      if (filters.feedback_status === 'AWAITING_ANALYSIS') { where.push(`EXISTS (SELECT 1 FROM student_checkins sc WHERE (sc.student_id=${sid} OR lower(trim(sc.student_email))=ib.normalized_email) AND sc.week_ref=? AND NOT (${ANALYZED}))`); params.push(weekRef); }
      if (filters.nutrition_status === 'NO_PUBLISHED_PLAN') where.push(`NOT EXISTS (SELECT 1 FROM nutrition_plans np WHERE (np.student_id=${sid} OR lower(trim(np.student_email))=ib.normalized_email) AND np.status='PUBLISHED' AND np.is_active=1)`);
      if (filters.nutrition_status === 'PENDING_UPDATE') where.push(`EXISTS (SELECT 1 FROM premium_pending_items pi WHERE pi.student_id=${sid} AND pi.type='CREATE_NUTRITION_PLAN' AND pi.status='OPEN')`);
      if (filters.anamnesis_status === 'AWAITING_ANALYSIS') where.push(`EXISTS (SELECT 1 FROM premium_anamnesis pa WHERE pa.student_id=${sid} AND upper(coalesce(pa.status,'')) NOT IN ('ANALYZED','ANALISADA'))`);
      const result = await db.prepare(IDENTITY_BRIDGE_CTE + ` SELECT ib.id,ib.id student_id,ib.email,ib.name,ib.consultation_status,ib.access_status,ib.created_at,ib.whatsapp phone,ib.portal_access_status,ib.source,ib.identity_mode,(SELECT MAX(x.at) FROM (SELECT created_at at FROM premium_anamnesis WHERE student_id=${sid} UNION ALL SELECT created_at FROM student_checkins WHERE student_id=${sid} OR lower(trim(student_email))=ib.normalized_email UNION ALL SELECT updated_at FROM nutrition_plans WHERE student_id=${sid} OR lower(trim(student_email))=ib.normalized_email UNION ALL SELECT created_at FROM premium_followup_entries WHERE student_id=${sid}) x) last_activity_at,(SELECT COUNT(*) FROM premium_pending_items pi WHERE pi.student_id=${sid} AND pi.status='OPEN') open_pending_count,${NEXT_PENDING_SELECT.replaceAll('ps.student_id', sid)},CASE WHEN EXISTS (SELECT 1 FROM student_checkins sc WHERE (sc.student_id=${sid} OR lower(trim(sc.student_email))=ib.normalized_email) AND sc.week_ref=? AND NOT (${ANALYZED})) THEN 'AWAITING_ANALYSIS' WHEN EXISTS (SELECT 1 FROM student_checkins sc WHERE (sc.student_id=${sid} OR lower(trim(sc.student_email))=ib.normalized_email) AND sc.week_ref=? AND ${ANALYZED}) THEN 'ANALYZED' ELSE 'MISSING' END weekly_feedback_status,CASE WHEN EXISTS (SELECT 1 FROM premium_anamnesis pa WHERE pa.student_id=${sid} AND upper(coalesce(pa.status,'')) IN ('ANALYZED','ANALISADA')) THEN 'ANALYZED' WHEN EXISTS (SELECT 1 FROM premium_anamnesis pa WHERE pa.student_id=${sid}) THEN 'RESPONDED' ELSE 'NOT_STARTED' END anamnesis_status,CASE WHEN EXISTS (SELECT 1 FROM nutrition_plans np WHERE (np.student_id=${sid} OR lower(trim(np.student_email))=ib.normalized_email) AND np.status='DRAFT') THEN 'DRAFT' WHEN EXISTS (SELECT 1 FROM premium_pending_items pi WHERE pi.student_id=${sid} AND pi.type='CREATE_NUTRITION_PLAN' AND pi.status='OPEN') THEN 'PENDING_UPDATE' WHEN EXISTS (SELECT 1 FROM nutrition_plans np WHERE (np.student_id=${sid} OR lower(trim(np.student_email))=ib.normalized_email) AND np.status='PUBLISHED' AND np.is_active=1) THEN 'PUBLISHED' ELSE 'NO_PUBLISHED_PLAN' END nutrition_plan_status,EXISTS(SELECT 1 FROM nutrition_plans np WHERE (np.student_id=${sid} OR lower(trim(np.student_email))=ib.normalized_email) AND np.status='DRAFT') has_draft FROM identity_bridge ib WHERE ${where.join(' AND ')} ORDER BY lower(coalesce(ib.name,ib.email)) ASC LIMIT ? OFFSET ?`).bind(weekRef, weekRef, ...params, limit + 1, offsetValue).all();
      const resultRows = rows(result); resultRows.forEach(logIdentity); return { items: resultRows.slice(0, limit).map(expandNext), nextCursor: resultRows.length > limit ? String(offsetValue + limit) : null, limit };
    },
    async searchStudents({ q, limit = 20 } = {}) {
      const term = normalizeSearchTerm(q); const lim = clampLimit(limit, 20); if (term.length < 2) return { items: [], nextCursor: null, limit: lim };
      const conditions = ['lower(coalesce(ib.name,\'\')) LIKE ? ESCAPE \'\\\'', 'lower(ib.email) LIKE ? ESCAPE \'\\\''];
      const params = [`%${escapeLike(term.toLowerCase())}%`, `%${escapeLike(term.toLowerCase())}%`];
      const digits = normalizeDigits(term); if (digits.length >= 4) { conditions.push("replace(replace(replace(replace(coalesce(ib.whatsapp,''),' ',''),'-',''),'(',''),')','') LIKE ? ESCAPE '\\'"); params.push(`%${escapeLike(digits)}%`); }
      const result = await db.prepare(IDENTITY_BRIDGE_CTE + ` SELECT ib.id,ib.id student_id,ib.email,ib.name,ib.consultation_status,ib.access_status,ib.whatsapp phone,ib.source,ib.identity_mode,0 open_pending_count FROM identity_bridge ib WHERE ${conditions.join(' OR ')} ORDER BY lower(coalesce(ib.name,ib.email)) LIMIT ?`).bind(...params, lim).all();
      const items = rows(result); items.forEach(logIdentity); return { items, nextCursor: null, limit: lim };
    },
    async listPendingItems(filters = {}) {
      const limit = clampLimit(filters.limit, 25); const offsetValue = offset(filters.cursor); const where = ['1=1']; const params = []; const sid = "coalesce(ib.student_id,'__email_bridge__')";
      if (filters.status !== 'RESOLVED') where.push("pi.status='OPEN'"); else where.push("pi.status='RESOLVED'");
      if (filters.type) { where.push('pi.type=?'); params.push(filters.type); } if (filters.priority) { where.push('pi.priority=?'); params.push(filters.priority); } if (filters.student_id) { where.push(`pi.student_id=${sid}`); }
      const result = await db.prepare(IDENTITY_BRIDGE_CTE + ` SELECT pi.*,ib.name student_name,ib.email FROM premium_pending_items pi JOIN identity_bridge ib ON pi.student_id=${sid} WHERE ${where.join(' AND ')} ORDER BY CASE pi.priority WHEN 'HIGH' THEN 0 WHEN 'NORMAL' THEN 1 ELSE 2 END, datetime(pi.created_at) ASC LIMIT ? OFFSET ?`).bind(...params, limit + 1, offsetValue).all();
      const resultRows = rows(result); return { items: resultRows.slice(0, limit), nextCursor: resultRows.length > limit ? String(offsetValue + limit) : null, limit };
    },
    async getStudentContext(studentId) {
      const summary = (await this.listStudents({ limit: 1, student_id: studentId })).items[0]; if (!summary) return null;
      const identityId = summary.source === 'legacy' && summary.identity_mode === 'email_bridge' ? '__email_bridge__' : summary.student_id;
      const email = normalizeEmail(summary.email);
      const [pending, feedback, plan, anamnesis, evolution] = await Promise.all([
        this.listPendingItems({ student_id: identityId, limit: 10 }),
        db.prepare(`SELECT id,week_ref,created_at submittedAt,reviewed_at reviewedAt,coach_status coachStatus,decision_type decisionType,coach_reply coachReply FROM student_checkins WHERE student_id=? OR lower(trim(student_email))=? ORDER BY datetime(created_at) DESC LIMIT 5`).bind(identityId, email).all(),
        db.prepare(`SELECT id,title,goal,status,version_number,published_at,source_feedback_id,updated_at FROM nutrition_plans WHERE student_id=? OR lower(trim(student_email))=? ORDER BY CASE status WHEN 'PUBLISHED' THEN 0 WHEN 'DRAFT' THEN 1 ELSE 2 END, datetime(updated_at) DESC LIMIT 5`).bind(identityId, email).all(),
        db.prepare(`SELECT id,status,created_at respondedAt,updated_at analyzedAt FROM premium_anamnesis WHERE student_id=? ORDER BY datetime(created_at) DESC LIMIT 1`).bind(identityId).first(),
        db.prepare(`SELECT id,entry_type,title,content,created_by,created_at FROM premium_followup_entries WHERE student_id=? ORDER BY datetime(created_at) DESC LIMIT 10`).bind(identityId).all(),
      ]);
      return { summary, pendingItems: pending.items, weeklyFeedback: rows(feedback), nutritionPlan: rows(plan), anamnesis, evolution: rows(evolution) };
    },
    async getSaturdayReview({ now = new Date(), limit = 25 } = {}) {
      const weekRef = weekRefFor(now); const lim = clampLimit(limit, 25); const sid = "coalesce(ib.student_id,'__email_bridge__')";
      const [awaiting, missing, analyzedRows, pendingByDecision, plans] = await Promise.all([
        db.prepare(IDENTITY_BRIDGE_CTE + ` SELECT sc.id,sc.student_id,ib.name student_name,ib.email,sc.week_ref,sc.created_at submitted_at FROM student_checkins sc JOIN identity_bridge ib ON (sc.student_id=${sid} OR lower(trim(sc.student_email))=ib.normalized_email) WHERE sc.week_ref=? AND NOT (${ANALYZED}) ORDER BY datetime(sc.created_at) ASC LIMIT ?`).bind(weekRef, lim).all(),
        db.prepare(IDENTITY_BRIDGE_CTE + ` SELECT ib.id student_id,ib.name student_name,ib.email FROM identity_bridge ib WHERE ib.consultation_status IN ('ACTIVE','UNDER_REVIEW') AND NOT EXISTS (SELECT 1 FROM student_checkins sc WHERE (sc.student_id=${sid} OR lower(trim(sc.student_email))=ib.normalized_email) AND sc.week_ref=?) ORDER BY lower(coalesce(ib.name,ib.email)) LIMIT ?`).bind(weekRef, lim).all(),
        db.prepare(IDENTITY_BRIDGE_CTE + ` SELECT sc.id,sc.student_id,ib.name student_name,ib.email,sc.week_ref,sc.reviewed_at FROM student_checkins sc JOIN identity_bridge ib ON (sc.student_id=${sid} OR lower(trim(sc.student_email))=ib.normalized_email) WHERE sc.week_ref=? AND ${ANALYZED} ORDER BY datetime(coalesce(sc.reviewed_at,sc.created_at)) DESC LIMIT ?`).bind(weekRef, lim).all(),
        db.prepare(IDENTITY_BRIDGE_CTE + ` SELECT pi.id,pi.student_id,ib.name student_name,pi.type,pi.title,pi.description,pi.status,pi.priority,pi.source,pi.related_entity_type,pi.related_entity_id,pi.created_at,pi.updated_at FROM premium_pending_items pi JOIN identity_bridge ib ON pi.student_id=${sid} JOIN student_checkins sc ON sc.id=pi.related_entity_id AND (sc.student_id=${sid} OR lower(trim(sc.student_email))=ib.normalized_email) AND sc.week_ref=? WHERE pi.status='OPEN' AND pi.source='professional_decision' AND pi.related_entity_type='student_checkins' ORDER BY datetime(pi.created_at) DESC LIMIT ?`).bind(weekRef, lim).all(),
        db.prepare(IDENTITY_BRIDGE_CTE + ` SELECT pi.id,pi.student_id,ib.name student_name,pi.title,pi.created_at FROM premium_pending_items pi JOIN identity_bridge ib ON pi.student_id=${sid} WHERE pi.status='OPEN' AND pi.type='CREATE_NUTRITION_PLAN' ORDER BY datetime(pi.created_at) ASC LIMIT ?`).bind(lim).all(),
      ]);
      return { weekRef, isSaturday: isSaturdayInSaoPaulo(now), feedbacksAwaitingAnalysis: rows(awaiting), studentsWithoutResponse: rows(missing), feedbacksAnalyzed: rows(analyzedRows), pendingItemsCreatedByDecisions: rows(pendingByDecision), plansPendingUpdate: rows(plans) };
    },
  });
}
export const __professionalWorkspaceInternals = { escapeLike, normalizeSearchTerm, normalizeDigits };
