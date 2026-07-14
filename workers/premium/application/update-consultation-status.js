import { transitionConsultationStatus } from '../domain/consultation-status.js';
export function createUpdateConsultationStatusUseCase({ studentRepository, followupEntryRepository, db, randomUUID = crypto.randomUUID }) {
  return async function updateConsultationStatus({ student_id, status, created_by = null }) {
    const student = await studentRepository.findByStudentId(student_id); if (!student) return { ok: false, error: 'Aluno Premium não encontrado.', status: 404 };
    transitionConsultationStatus(student.consultation_status, status);
    const now = new Date().toISOString();
    await db.prepare('UPDATE premium_students SET consultation_status=?, updated_at=? WHERE student_id=?').bind(status, now, student_id).run();
    await followupEntryRepository.append({ id: randomUUID(), student_id, entry_type: 'CONSULTATION_STATUS_CHANGE', title: 'Status da consultoria alterado', content: `${student.consultation_status} → ${status}`, source: 'admin', created_by, created_at: now });
    return { ok: true, data: { student_id, from: student.consultation_status, to: status, updated_at: now } };
  };
}
