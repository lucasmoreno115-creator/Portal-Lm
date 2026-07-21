import { generatePremiumStudentId, normalizePremiumStudentEmail } from '../workers/premium/services/student-identity-service.js';
import { createHash } from 'node:crypto';

export const BACKFILL_MODE = Object.freeze({ DRY_RUN: 'dry-run', APPLY: 'apply' });

export const PREMIUM_STUDENT_IDENTITY_TABLES = Object.freeze({
  student_access: Object.freeze({ emailColumn: 'email', idColumn: 'id' }),
});

// These tables are intentionally read-only in W2.6.3. Their records are
// audited for follow-up but are never changed by this identity backfill.
export const PREMIUM_RELATED_AUDIT_TABLES = Object.freeze({
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
  // `plan` and the legacy product aliases are explicit product identifiers.
  // Evaluate them before the generic `plan_type`: Project LM rows in the
  // legacy data may use `START` as their plan type.
  const explicitProducts = [row?.plan, row?.product, row?.produto]
    .map(classifyProductValue);
  const planType = classifyProductValue(row?.plan_type);
  const explicitPresent = explicitProducts.filter((entry) => entry.kind !== 'missing');
  const present = [...explicitPresent, planType].filter((entry) => entry.kind !== 'missing');

  if (present.length === 0) {
    return { eligible: false, conflictType: 'MISSING_PRODUCT_CLASSIFICATION', reason: 'plan e plan_type ausentes.' };
  }
  const hasExplicitPremium = explicitPresent.some((entry) => entry.kind === 'premium');
  const hasExplicitProjectLm = explicitPresent.some((entry) => entry.kind === 'project_lm');
  if (hasExplicitPremium && hasExplicitProjectLm) {
    return { eligible: false, conflictType: 'CONFLICTING_PRODUCT_CLASSIFICATION', reason: 'Campos explícitos indicam produtos diferentes.' };
  }
  if (hasExplicitProjectLm) {
    return { eligible: false, conflictType: 'NON_PREMIUM_ACCESS', reason: 'Acesso exclusivo do Projeto LM.' };
  }
  if (hasExplicitPremium) {
    if (planType.kind === 'project_lm') {
      return { eligible: false, conflictType: 'CONFLICTING_PRODUCT_CLASSIFICATION', reason: 'plan e plan_type indicam produtos diferentes.' };
    }
    return { eligible: true, conflictType: null, reason: 'Premium explícito.' };
  }
  if (explicitPresent.some((entry) => entry.kind === 'unknown')) {
    return { eligible: false, conflictType: 'UNKNOWN_PRODUCT_CLASSIFICATION', reason: 'Classificação de produto desconhecida.' };
  }
  if (planType.kind === 'project_lm') {
    return { eligible: false, conflictType: 'NON_PREMIUM_ACCESS', reason: 'Acesso exclusivo do Projeto LM.' };
  }
  if (planType.kind === 'unknown') {
    return { eligible: false, conflictType: 'UNKNOWN_PRODUCT_CLASSIFICATION', reason: 'Classificação de produto desconhecida.' };
  }
  return { eligible: true, conflictType: null, reason: 'Premium explícito.' };
}

export function createConflict(type, table, record, email, reason, recommended_action) {
  // Conflict objects may be persisted or surfaced by an administrative runner.
  // Keep only opaque record IDs and never expose e-mail addresses.
  return { type, table, record: String(record ?? ''), email: null, reason, recommended_action };
}

const RESTRICTED_BLOCKER_HASH_DOMAIN = 'portal-lm:premium-legacy-identity-backfill:v1:';

export function stableEmailHash(normalizedEmail) {
  if (!normalizedEmail) return null;
  return createHash('sha256').update(`${RESTRICTED_BLOCKER_HASH_DOMAIN}${normalizedEmail}`, 'utf8').digest('hex');
}

function opaqueIds(ids) {
  return [...new Set((Array.isArray(ids) ? ids : [ids])
    .filter((id) => id !== null && id !== undefined && String(id).trim())
    .map((id) => String(id)))];
}

function createRestrictedBlocker({
  type,
  table,
  recordIds = [],
  studentAccessIds = [],
  normalizedEmail = null,
  plan = null,
  planType = null,
  accessCount = 0,
  premiumIdentityCount = 0,
  recommendedAction,
}) {
  return {
    type,
    table,
    opaque_record_ids: opaqueIds(recordIds),
    student_access_ids: opaqueIds(studentAccessIds),
    stable_email_hash: stableEmailHash(normalizedEmail),
    plan: plan ?? null,
    plan_type: planType ?? null,
    access_count: accessCount,
    premium_identity_count: premiumIdentityCount,
    recommended_action: recommendedAction,
  };
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
    return repository.listAssociationCandidates([...Object.keys(PREMIUM_STUDENT_IDENTITY_TABLES), ...Object.keys(PREMIUM_RELATED_AUDIT_TABLES)]);
  }
  return tables;
}

export async function runPremiumStudentIdentityBackfill({
  repository,
  tables = {},
  mode = BACKFILL_MODE.DRY_RUN,
  now = () => new Date().toISOString(),
  randomUUID,
  batchId = null,
} = {}) {
  const selectedMode = validateMode(mode);
  const apply = selectedMode === BACKFILL_MODE.APPLY;
  if (apply && !batchId) throw new Error('BACKFILL_BATCH_ID_REQUIRED');
  const conflicts = [];
  const restrictedBlockers = [];
  const addConflict = (conflict, blocker) => {
    conflicts.push(conflict);
    restrictedBlockers.push(createRestrictedBlocker({
      type: conflict.type,
      table: conflict.table,
      recommendedAction: conflict.recommended_action,
      ...blocker,
    }));
  };
  const counts = { already_migrated: 0, eligible: 0, ambiguous: 0, invalid_email: 0, project_only: 0, inactive: 0, conflicting_student_id: 0, error: 0 };
  const candidates = await repository.listBackfillCandidates();
  const associationTables = await listAssociationCandidates(repository, tables);
  const accessByEmail = new Map();
  const eligibleByEmail = new Map();
  const blockedEmails = new Set();

  for (const candidate of candidates) {
    let normalizedEmail = '';
    try {
      normalizedEmail = normalizePremiumStudentEmail(candidate.email, { required: true });
    } catch {
      counts.invalid_email += 1;
      addConflict(createConflict('INVALID_EMAIL', 'student_access', candidate.id, null, 'E-mail vazio ou não normalizável.', 'Corrigir e-mail antes de executar novo backfill.'), { recordIds: candidate.id, studentAccessIds: candidate.id, plan: candidate.plan, planType: candidate.plan_type });
      continue;
    }

    const eligibility = evaluatePremiumEligibility(candidate);
    const entry = { ...candidate, normalized_email: normalizedEmail, eligibility };
    const allForEmail = accessByEmail.get(normalizedEmail) ?? [];
    allForEmail.push(entry);
    accessByEmail.set(normalizedEmail, allForEmail);

    if (String(candidate.status ?? 'ACTIVE').trim().toUpperCase() !== 'ACTIVE') {
      counts.inactive += 1;
      entry.eligibility = { eligible: false, conflictType: 'INACTIVE_ACCESS', reason: 'Acesso não está ACTIVE.' };
      addConflict(createConflict('INACTIVE_ACCESS', 'student_access', candidate.id, null, entry.eligibility.reason, 'Reativar o acesso antes de executar novo backfill.'), { recordIds: candidate.id, studentAccessIds: candidate.id, normalizedEmail, plan: candidate.plan, planType: candidate.plan_type, accessCount: 1 });
      continue;
    }

    if (!eligibility.eligible) {
      if (eligibility.conflictType === 'NON_PREMIUM_ACCESS') counts.project_only += 1;
      else counts.ambiguous += 1;
      addConflict(createConflict(eligibility.conflictType, 'student_access', candidate.id, candidate.email, eligibility.reason, 'Revisar classificação de produto antes de executar o backfill.'), { recordIds: candidate.id, studentAccessIds: candidate.id, normalizedEmail, plan: candidate.plan, planType: candidate.plan_type, accessCount: 1 });
      continue;
    }

    const eligibleForEmail = eligibleByEmail.get(normalizedEmail) ?? [];
    eligibleForEmail.push(entry);
    eligibleByEmail.set(normalizedEmail, eligibleForEmail);
  }

  for (const [normalizedEmail, accessRows] of accessByEmail) {
    const hasEligible = accessRows.some((row) => row.eligibility.eligible);
    const hasIneligible = accessRows.some((row) => !row.eligibility.eligible);
    if (hasEligible && hasIneligible) {
      blockedEmails.add(normalizedEmail);
      counts.ambiguous += 1;
      addConflict(createConflict(
        'MIXED_PRODUCT_ACCESS_FOR_EMAIL',
        'student_access',
        accessRows.map((row) => row.id).join(','),
        normalizedEmail,
        'Mesmo e-mail aparece em acessos Premium e não Premium/ambíguos; por regra conservadora o e-mail inteiro fica bloqueado neste backfill.',
        'Resolver manualmente a classificação por acesso antes de associar student_id.'
      ), { recordIds: accessRows.map((row) => row.id), studentAccessIds: accessRows.map((row) => row.id), normalizedEmail, accessCount: accessRows.length });
    }
  }

  let created = 0;
  let associated = 0;
  let skipped = 0;
  let existing_associations = 0;
  let planned_created = 0;
  let planned_associated = 0;

  for (const [normalizedEmail, rows] of eligibleByEmail) {
    if (blockedEmails.has(normalizedEmail)) continue;
    if (rows.length > 1) {
      counts.ambiguous += 1;
      addConflict(createConflict('MULTIPLE_ACCESS_RECORDS', 'student_access', rows.map((r) => r.id).join(','), normalizedEmail, 'Mais de um acesso Premium elegível para o mesmo e-mail normalizado.', 'Revisar manualmente antes de vincular.'), { recordIds: rows.map((row) => row.id), studentAccessIds: rows.map((row) => row.id), normalizedEmail, accessCount: rows.length });
      continue;
    }

    const access = rows[0];
    const accessStudentId = String(access.student_id ?? '').trim();
    const accessUsesEmailAsId = accessStudentId && normalizePremiumStudentEmail(accessStudentId) === normalizedEmail;
    let studentById = null;
    if (accessStudentId && !accessUsesEmailAsId) {
      studentById = await repository.findByStudentId?.(accessStudentId);
      if (repository.findByStudentId && (!studentById || normalizePremiumStudentEmail(studentById.email) !== normalizedEmail)) {
        counts.conflicting_student_id += 1;
        addConflict(createConflict('CONFLICTING_STUDENT_ID', 'student_access', access.id, null, 'student_id canônico não resolve para o mesmo e-mail Premium.', 'Revisar manualmente antes de executar o backfill.'), { recordIds: access.id, studentAccessIds: access.id, normalizedEmail, plan: access.plan, planType: access.plan_type, accessCount: 1, premiumIdentityCount: studentById ? 1 : 0 });
        continue;
      }
    }
    let students = studentById ? [studentById] : normalizeRows(await repository.findByNormalizedEmail(normalizedEmail));
    if (students.length > 1) {
      counts.ambiguous += 1;
      addConflict(createConflict('IDENTITY_COLLISION', 'premium_students', students.map((s) => s.student_id).join(','), normalizedEmail, 'Mais de uma identidade para o e-mail normalizado.', 'Resolver colisão manualmente.'), { recordIds: students.map((student) => student.student_id), studentAccessIds: access.id, normalizedEmail, plan: access.plan, planType: access.plan_type, accessCount: 1, premiumIdentityCount: students.length });
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
        source: 'LEGACY_BACKFILL',
        legacy_backfill_batch_id: batchId,
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
      counts.eligible += 1;
    } else {
      counts.already_migrated += 1;
    }

    const updates = [];
    for (const [table, config] of Object.entries(PREMIUM_STUDENT_IDENTITY_TABLES)) {
      const rowsForTable = associationTables[table] ?? [];
      for (const record of rowsForTable) {
        const recordEmail = record[config.emailColumn];
        const recordNormalized = normalizePremiumStudentEmail(recordEmail);
        if (recordNormalized !== normalizedEmail) continue;
        if (table === 'student_access' && record[config.idColumn] !== access.id) continue;
        const recordUsesEmailAsId = record.student_id && normalizePremiumStudentEmail(record.student_id) === normalizedEmail;
        if (record.student_id && !recordUsesEmailAsId) {
          if (record.student_id === student.student_id) {
            existing_associations += 1;
          } else {
            counts.conflicting_student_id += 1;
            addConflict(createConflict(
              'IDENTITY_ASSOCIATION_MISMATCH',
              table,
              record[config.idColumn],
              recordEmail,
              'Registro já possui student_id diferente da identidade Premium resolvida.',
              'Revisar manualmente antes de qualquer alteração; o backfill nunca sobrescreve student_id existente.'
            ), { recordIds: record[config.idColumn], studentAccessIds: access.id, normalizedEmail, plan: access.plan, planType: access.plan_type, accessCount: 1, premiumIdentityCount: student ? 1 : 0 });
          }
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
      for (const update of updates) await repository.createBackfillAudit?.({ id: generatePremiumStudentId(randomUUID), batch_id: batchId, student_access_id: update.id, previous_student_id: access.student_id ?? null, new_student_id: update.student_id, created_at: now() });
    }
  }

  for (const [table, config] of Object.entries(PREMIUM_RELATED_AUDIT_TABLES)) {
    const rowsForTable = associationTables[table] ?? [];
    for (const record of rowsForTable) {
      const recordEmail = record[config.emailColumn];
      const normalizedEmail = normalizePremiumStudentEmail(recordEmail);
      if (record.student_id) continue;
      if (!eligibleByEmail.has(normalizedEmail) && !accessByEmail.has(normalizedEmail)) {
        addConflict(createConflict('PREMIUM_DATA_WITHOUT_ACCESS', table, record[config.idColumn], recordEmail, 'Dado Premium sem acesso Premium correspondente.', 'Revisar origem antes de associar.'), { recordIds: record[config.idColumn], normalizedEmail, premiumIdentityCount: 0 });
      }
    }
  }

  return {
    mode: selectedMode,
    candidates: candidates.length,
    scanned: candidates.length,
    classifications: counts,
    created,
    associated,
    skipped,
    existing_associations,
    planned_created,
    planned_associated,
    conflicts,
    restricted_blockers: restrictedBlockers,
  };
}

export async function rollbackPremiumStudentIdentityBackfill({ repository, batchId, now = () => new Date().toISOString() } = {}) {
  if (!batchId) throw new Error('BACKFILL_BATCH_ID_REQUIRED');
  if (!repository?.rollbackBackfillBatch) throw new Error('BACKFILL_ROLLBACK_UNAVAILABLE');
  return repository.rollbackBackfillBatch(batchId, now());
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const mode = process.argv.includes('--apply') ? BACKFILL_MODE.APPLY : BACKFILL_MODE.DRY_RUN;
  const batchIdIndex = process.argv.indexOf('--batch-id');
  const batchId = batchIdIndex >= 0 ? process.argv[batchIdIndex + 1] : null;
  if (mode === BACKFILL_MODE.APPLY && !batchId) {
    console.error(JSON.stringify({ error: 'BACKFILL_BATCH_ID_REQUIRED', message: '--apply exige --batch-id; nenhuma escrita foi executada.' }));
    process.exitCode = 2;
  } else {
    console.log(JSON.stringify({ mode, batch_id: batchId, message: 'Módulo administrativo: execute-o pelo runner D1 autenticado. Dry-run é o padrão; tokens e e-mails completos nunca são impressos.' }, null, 2));
  }
}
