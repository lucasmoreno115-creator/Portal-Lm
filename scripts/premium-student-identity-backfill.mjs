import { generatePremiumStudentId, normalizePremiumStudentEmail } from '../workers/premium/services/student-identity-service.js';

export const PREMIUM_TABLE_EMAIL_COLUMNS = Object.freeze({
  student_access: 'email',
  premium_anamnesis: 'student_email',
  nutrition_plans: 'student_email',
  student_checkins: 'student_email',
  activity_timeline: 'student_email',
  weekly_plans: 'student_email',
  progression_logs: 'student_email',
  followup_logs: 'student_email',
  retention_actions: 'student_email',
});

export function createConflict(type, table, record, email, reason, recommended_action) {
  return { type, table, record: String(record ?? ''), email: email ?? null, reason, recommended_action };
}

function isPremiumAccess(row) {
  return String(row?.plan ?? 'premium').trim().toLowerCase() === 'premium';
}

function accessStatus(row) {
  return String(row?.status ?? 'ACTIVE').toUpperCase() === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE';
}

export async function runPremiumStudentIdentityBackfill({ repository, tables = {}, now = () => new Date().toISOString(), randomUUID } = {}) {
  const conflicts = [];
  const candidates = await repository.listBackfillCandidates();
  const byEmail = new Map();
  for (const candidate of candidates) {
    let normalizedEmail = '';
    try { normalizedEmail = normalizePremiumStudentEmail(candidate.email, { required: true }); }
    catch { conflicts.push(createConflict('EMPTY_EMAIL', 'student_access', candidate.id, candidate.email, 'E-mail vazio ou não normalizável.', 'Corrigir e-mail antes de executar novo backfill.')); continue; }
    if (!isPremiumAccess(candidate)) {
      conflicts.push(createConflict('NON_PREMIUM_ACCESS', 'student_access', candidate.id, candidate.email, 'Registro não pertence ao produto Premium.', 'Manter isolado do Premium 3.0.'));
      continue;
    }
    const bucket = byEmail.get(normalizedEmail) ?? [];
    bucket.push(candidate);
    byEmail.set(normalizedEmail, bucket);
  }

  let created = 0;
  let associated = 0;
  for (const [normalizedEmail, rows] of byEmail) {
    if (rows.length > 1) {
      conflicts.push(createConflict('MULTIPLE_ACCESS_RECORDS', 'student_access', rows.map((r) => r.id).join(','), normalizedEmail, 'Mais de um acesso para o mesmo e-mail normalizado.', 'Revisar manualmente antes de vincular.'));
      continue;
    }
    const access = rows[0];
    let students = await repository.findByNormalizedEmail(normalizedEmail);
    students = Array.isArray(students) ? students : students ? [students] : [];
    if (students.length > 1) {
      conflicts.push(createConflict('IDENTITY_COLLISION', 'premium_students', students.map((s) => s.student_id).join(','), normalizedEmail, 'Mais de uma identidade para o e-mail normalizado.', 'Resolver colisão manualmente.'));
      continue;
    }
    let student = students[0];
    if (!student) {
      student = await repository.create({ student_id: generatePremiumStudentId(randomUUID), email: access.email, normalized_email: normalizedEmail, display_name: access.name, consultation_status: 'NEW', access_status: accessStatus(access), source: 'BACKFILL', created_at: now(), updated_at: now() });
      created += 1;
    }
    for (const [table, rowsForTable = []] of Object.entries(tables)) {
      for (const record of rowsForTable) {
        const recordEmail = record.email ?? record.student_email;
        const recordNormalized = normalizePremiumStudentEmail(recordEmail);
        if (record.student_id) continue;
        if (recordNormalized === normalizedEmail) {
          record.student_id = student.student_id;
          associated += 1;
        }
      }
    }
  }

  for (const [table, rowsForTable = []] of Object.entries(tables)) {
    for (const record of rowsForTable) {
      const recordEmail = record.email ?? record.student_email;
      if (!record.student_id) conflicts.push(createConflict('PREMIUM_DATA_WITHOUT_ACCESS', table, record.id, recordEmail, 'Dado Premium sem acesso Premium correspondente.', 'Revisar origem antes de associar.'));
    }
  }
  return { candidates: candidates.length, created, associated, conflicts };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify({ message: 'Importe runPremiumStudentIdentityBackfill em um runner D1 autenticado. Tokens não são lidos nem impressos por este script.' }, null, 2));
}
