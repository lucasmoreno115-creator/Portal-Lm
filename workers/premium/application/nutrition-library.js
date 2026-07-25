import { safeJsonArray } from '../domain/nutrition-plan-schema.js';

const TYPES = new Set(['LEGACY', 'PREMIUM']);
const STATUSES = new Set(['PUBLISHED', 'DRAFT', 'ARCHIVED']);

function integer(value, fallback, maximum = Number.MAX_SAFE_INTEGER) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.min(parsed, maximum) : fallback;
}

function normalizedStatusSql(alias = 'np') {
  return `CASE WHEN ${alias}.status IS NOT NULL THEN upper(${alias}.status) WHEN ${alias}.is_active=1 THEN 'PUBLISHED' ELSE 'ARCHIVED' END`;
}

function studentNameSql(alias = 'np') {
  return `COALESCE(
    (SELECT ps.display_name FROM premium_students ps WHERE ps.student_id=${alias}.student_id LIMIT 1),
    (SELECT ps.display_name FROM premium_students ps WHERE ps.normalized_email=lower(trim(${alias}.student_email)) LIMIT 1),
    (SELECT sa.name FROM student_access sa WHERE lower(trim(sa.email))=lower(trim(${alias}.student_email)) LIMIT 1),
    'Aluno'
  )`;
}

export function createNutritionLibrary({ db }) {
  return {
    async list(params = {}) {
      const q = String(params.q || '').trim().toLowerCase();
      const type = String(params.type || '').trim().toUpperCase();
      const status = String(params.status || '').trim().toUpperCase();
      const limit = integer(params.limit, 20, 50) || 20;
      const offset = integer(params.offset, 0);
      if (type && !TYPES.has(type)) return { ok: false, status: 400, error: 'type inválido.' };
      if (status && !STATUSES.has(status)) return { ok: false, status: 400, error: 'status inválido.' };

      const nameSql = studentNameSql();
      const planStatusSql = normalizedStatusSql();
      const where = [];
      const values = [];
      if (q) {
        const pattern = `%${q}%`;
        where.push(`(lower(COALESCE(np.student_email,'')) LIKE ? OR lower(COALESCE(np.title,'')) LIKE ? OR lower(${nameSql}) LIKE ?)`);
        values.push(pattern, pattern, pattern);
      }
      if (type === 'LEGACY') where.push('np.student_id IS NULL');
      if (type === 'PREMIUM') where.push('np.student_id IS NOT NULL');
      if (status) { where.push(`${planStatusSql}=?`); values.push(status); }
      const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const select = `SELECT np.id,np.student_email,${nameSql} student_name,np.title,
        CASE WHEN np.student_id IS NULL THEN 'LEGACY' ELSE 'PREMIUM' END type,
        ${planStatusSql} status,np.version_number,np.created_at,np.updated_at
        FROM nutrition_plans np ${clause}`;
      const [rows, count] = await Promise.all([
        db.prepare(`${select} ORDER BY datetime(np.updated_at) DESC,np.id DESC LIMIT ? OFFSET ?`).bind(...values, limit, offset).all(),
        db.prepare(`SELECT COUNT(*) total FROM nutrition_plans np ${clause}`).bind(...values).first(),
      ]);
      return { ok: true, data: { items: rows?.results || [], total: Number(count?.total || 0), limit, offset } };
    },

    async detail(planId) {
      const id = String(planId || '').trim();
      if (!id) return { ok: false, status: 404, error: 'Planejamento não encontrado.' };
      const row = await db.prepare(`SELECT np.id,np.student_email,${studentNameSql()} student_name,np.title,np.goal,np.strategy,
        np.meals_json,np.substitutions_json,np.adherence_rules_json,np.notes,
        CASE WHEN np.student_id IS NULL THEN 'LEGACY' ELSE 'PREMIUM' END type,
        ${normalizedStatusSql()} status,np.version_number,np.published_at,np.archived_at,np.created_at,np.updated_at
        FROM nutrition_plans np WHERE np.id=? LIMIT 1`).bind(id).first();
      if (!row) return { ok: false, status: 404, error: 'Planejamento não encontrado.' };
      const { meals_json, substitutions_json, adherence_rules_json, ...metadata } = row;
      return { ok: true, data: {
        ...metadata,
        meals: safeJsonArray(meals_json),
        substitutions: safeJsonArray(substitutions_json),
        adherence_rules: safeJsonArray(adherence_rules_json),
      } };
    },
  };
}
