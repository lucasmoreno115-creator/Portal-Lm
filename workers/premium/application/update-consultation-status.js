import { transitionConsultationStatus } from '../domain/consultation-status.js';

function changedRows(result) { return Number(result?.meta?.changes ?? result?.changes ?? 0); }

export function createUpdateConsultationStatusUseCase({ studentRepository, followupEntryRepository, db, randomUUID = crypto.randomUUID }) {
  return async function updateConsultationStatus({ student_id, status, created_by = null }) {
    const student = await studentRepository.findByStudentId(student_id);
    if (!student) return { ok: false, error: 'Aluno Premium não encontrado.', status: 404 };
    if (student.consultation_status === status) {
      return { ok: true, data: { student_id, from: status, to: status, unchanged: true, updated_at: student.updated_at ?? null } };
    }
    transitionConsultationStatus(student.consultation_status, status);
    const now = new Date().toISOString();
    const entryId = randomUUID();
    const statements = [
      db.prepare(`INSERT INTO premium_followup_entries (
        id, student_id, entry_type, title, content, source, related_entity_type,
        related_entity_id, created_by, created_at, updated_at
      ) SELECT ?, student_id, 'CONSULTATION_STATUS_CHANGE', ?, ?, 'admin', 'premium_students', ?, ?, ?, ?
        FROM premium_students
        WHERE student_id=? AND consultation_status=?`).bind(
        entryId, 'Status da consultoria alterado', JSON.stringify({ student_id, from: student.consultation_status, to: status, action: status === 'READY_TO_RELEASE' ? 'mark-ready' : status === 'ACTIVE' ? 'release' : 'status-change', origin: 'student_record' }),
        student_id, created_by, now, now, student_id, student.consultation_status
      ),
      db.prepare('UPDATE premium_students SET consultation_status=?, updated_at=? WHERE student_id=? AND consultation_status=?')
        .bind(status, now, student_id, student.consultation_status),
    ];
    const results = typeof db.batch === 'function'
      ? await db.batch(statements)
      : [await statements[0].run(), await statements[1].run()];
    if (changedRows(results[1]) === 0) {
      return { ok: false, error: 'Status da consultoria mudou antes da conclusão. Recarregue o prontuário.', status: 409 };
    }
    return { ok: true, data: { student_id, from: student.consultation_status, to: status, updated_at: now, followup_entry_id: entryId } };
  };
}
