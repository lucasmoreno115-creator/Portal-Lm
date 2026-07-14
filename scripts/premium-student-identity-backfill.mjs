import { generatePremiumStudentId, normalizePremiumStudentEmail } from '../workers/premium/services/student-identity-service.js';

export const BACKFILL_MODE = Object.freeze({ DRY_RUN: 'dry-run', APPLY: 'apply' });

export const PREMIUM_STUDENT_IDENTITY_TABLES = Object.freeze({
  student_access: Object.freeze({ emailColumn: 'email', idColumn: 'id' }),
  premium_anamnesis: Object.freeze({ emailColumn: 'student_email', idColumn: 'id' }),
  nutrition_plans: Object.freeze({ emailColumn: 'student_email', idColumn: 'id' }),
  student_checkins: Object.freeze({ emailColumn: 'student_email', idColumn: 'id' }),
  activity_timeline: Object.freeze({ emailColumn: 'student_email', idColumn: 'id' }),
  weekly_plans: Object.freeze({ emailColumn: 'student_email', idColumn: 'id' }),
  progression_logs: Object.freeze({ emailColumn: 'student_email', idColumn: 'id' }),
  followup_logs: Object.freeze({ emailColumn: 'student_email', idColumn: 'id' }),
  retention_actions: Object.freeze({ emailColumn: 'student_email', idColumn: 'id' }),
});

export const PREMIUM_TABLE_EMAIL_COLUMNS = Object.freeze(Object.fromEntries(
  Object.entries(PREMIUM_STUDENT_IDENTITY_TABLES).map(([table, config]) => [table, config.emailColumn])
));

const PREMIUM_VALUES = new Set(['premium', 'lm_premium', 'consultoria_lm_premium']);
const PROJECT_LM_VALUES = new Set(['projeto_lm', 'project_lm', 'lm2', 'project_lm_2', 'project_lm_v5']);

function normalizeProduct(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized || null;
}

function classifyProductValue(value) {
  const normalized = normalizeProduct(value);
  if (!normalized) return { kind: 'missing', value: normalized };
  if (PREMIUM_VALUES.has(normalized)) return { kind: 'premium', value: normalized };
  if (PROJECT_LM_VALUES.has(normalized)) return { kind: 'project_lm', value: normalized };
  return { kind: 'unknown', value: normalized };
}

export function evaluatePremiumEligibility(row) {
  const plan = classifyProductValue(row?.plan);
  const planType = classifyProductValue(row?.plan_type);
  const present = [plan, planType].filter((entry) => entry.kind !== 'missing');

  if (present.length === 0) {
    return { eligible: false, conflictType: 'MISSING_PRODUCT_CLASSIFICATION', reason: 'plan e plan_type ausentes.' };
  }
  if (present.some((entry) => entry.kind === 'unknown')) {
    return { eligible: false, conflictType: 'UNKNOWN_PRODUCT_CLASSIFICATION', reason: 'Classificação de produto desconhecida.' };
  }
  const hasPremium = present.some((entry) => entry.kind === 'premium');
  const hasProjectLm = present.some((entry) => entry.kind === 'project_lm');
  if (hasPremium && hasProjectLm) {
    return { eligible: false, conflictType: 'CONFLICTING_PRODUCT_CLASSIFICATION', reason: 'plan e plan_type indicam produtos diferentes.' };
  }
  if (hasProjectLm) {
    return { eligible: false, conflictType: 'NON_PREMIUM_ACCESS', reason: 'Registro pertence ao Projeto LM.' };
  }
  return { eligible: true, conflictType: null, reason: 'Premium explícito.' };
}

export function createConflict(type, table, record, email, reason, recommended_action) {
  return { type, table, record: String(record ?? ''), email: email ?? null, reason, recommended_action };
}

function accessStatus(row) {
  return String(row?.status ?? 'ACTIVE').toUpperCase() === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE';
}

function normalizeRows(students) {
  return Array.isArray(students) ? students : students ? [students] : [];
}

function validateMode(mode) {
  if (mode === BACKFILL_MODE.DRY_RUN || mode === BACKFILL_MODE.APPLY) return mode;
  throw new Error(`INVALID_BACKFILL_MODE:${mode}`);
}

async function listAssociationCandidates(repository, tables) {
  if (repository.listAssociationCandidates) {
    return repository.listAssociationCandidates(Object.keys(PREMIUM_STUDENT_IDENTITY_TABLES));
  }
  return tables;
}

export async function runPremiumStudentIdentityBackfill({
  repository,
  tables = {},
  mode = BACKFILL_MODE.DRY_RUN,
  now = () => new Date().toISOString(),
  randomUUID,
} = {}) {
  const selectedMode = validateMode(mode);
  const apply = selectedMode === BACKFILL_MODE.APPLY;
  const conflicts = [];
  const candidates = await repository.listBackfillCandidates();
  const associationTables = await listAssociationCandidates(repository, tables);
  const byEmail = new Map();

  for (const candidate of candidates) {
    let normalizedEmail = '';
    try {
      normalizedEmail = normalizePremiumStudentEmail(candidate.email, { required: true });
    } catch {
      conflicts.push(createConflict('EMPTY_EMAIL', 'student_access', candidate.id, candidate.email, 'E-mail vazio ou não normalizável.', 'Corrigir e-mail antes de executar novo backfill.'));
      continue;
    }

    const eligibility = evaluatePremiumEligibility(candidate);
    if (!eligibility.eligible) {
      conflicts.push(createConflict(eligibility.conflictType, 'student_access', candidate.id, candidate.email, eligibility.reason, 'Revisar classificação de produto antes de executar o backfill.'));
      continue;
    }

    const bucket = byEmail.get(normalizedEmail) ?? [];
    bucket.push({ ...candidate, normalized_email: normalizedEmail });
    byEmail.set(normalizedEmail, bucket);
  }

  let created = 0;
  let associated = 0;
  let skipped = 0;
  let planned_created = 0;
  let planned_associated = 0;

  for (const [normalizedEmail, rows] of byEmail) {
    if (rows.length > 1) {
      conflicts.push(createConflict('MULTIPLE_ACCESS_RECORDS', 'student_access', rows.map((r) => r.id).join(','), normalizedEmail, 'Mais de um acesso para o mesmo e-mail normalizado.', 'Revisar manualmente antes de vincular.'));
      continue;
    }

    const access = rows[0];
    let students = normalizeRows(await repository.findByNormalizedEmail(normalizedEmail));
    if (students.length > 1) {
      conflicts.push(createConflict('IDENTITY_COLLISION', 'premium_students', students.map((s) => s.student_id).join(','), normalizedEmail, 'Mais de uma identidade para o e-mail normalizado.', 'Resolver colisão manualmente.'));
      continue;
    }

    let student = students[0];
    if (!student) {
      const newStudent = {
        student_id: generatePremiumStudentId(randomUUID),
        email: access.email,
        normalized_email: normalizedEmail,
        display_name: access.name,
        consultation_status: 'NEW',
        access_status: accessStatus(access),
        source: 'BACKFILL',
        created_at: now(),
        updated_at: now(),
      };
      planned_created += 1;
      if (apply) {
        student = await repository.create(newStudent);
        created += 1;
      } else {
        student = newStudent;
      }
    }

    const updates = [];
    for (const [table, config] of Object.entries(PREMIUM_STUDENT_IDENTITY_TABLES)) {
      const rowsForTable = associationTables[table] ?? [];
      for (const record of rowsForTable) {
        const recordEmail = record[config.emailColumn];
        const recordNormalized = normalizePremiumStudentEmail(recordEmail);
        if (recordNormalized !== normalizedEmail) continue;
        if (record.student_id) {
          skipped += 1;
          continue;
        }
        planned_associated += 1;
        updates.push({ table, id: record[config.idColumn], student_id: student.student_id });
      }
    }

    if (apply && updates.length > 0) {
      const persisted = repository.batchAssociateStudentIds
        ? await repository.batchAssociateStudentIds(updates)
        : await Promise.all(updates.map((update) => repository.associateStudentId(update.table, update.id, update.student_id)));
      associated += Array.isArray(persisted) ? persisted.reduce((total, value) => total + Number(value ?? 0), 0) : updates.length;
    }
  }

  for (const [table, config] of Object.entries(PREMIUM_STUDENT_IDENTITY_TABLES)) {
    const rowsForTable = associationTables[table] ?? [];
    for (const record of rowsForTable) {
      const recordEmail = record[config.emailColumn];
      const normalizedEmail = normalizePremiumStudentEmail(recordEmail);
      if (record.student_id) continue;
      if (!byEmail.has(normalizedEmail)) {
        conflicts.push(createConflict('PREMIUM_DATA_WITHOUT_ACCESS', table, record[config.idColumn], recordEmail, 'Dado Premium sem acesso Premium correspondente.', 'Revisar origem antes de associar.'));
      }
    }
  }

  return {
    mode: selectedMode,
    candidates: candidates.length,
    created,
    associated,
    skipped,
    planned_created,
    planned_associated,
    conflicts,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const mode = process.argv.includes('--apply') ? BACKFILL_MODE.APPLY : BACKFILL_MODE.DRY_RUN;
  console.log(JSON.stringify({ mode, message: 'Use este módulo com um repository D1 autenticado. Dry-run é padrão; --apply deve ser solicitado explicitamente. Tokens não são lidos nem impressos.' }, null, 2));
}
