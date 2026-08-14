export function createDeactivatePremiumStudentUseCase({ db, now = () => new Date().toISOString(), log = console.info }) {
  return async ({ student_id, created_by = 'admin' }) => {
    const student = await db.prepare('SELECT student_id,email,consultation_status,access_status,deactivated_at FROM premium_students WHERE student_id=? LIMIT 1').bind(student_id).first();
    if (!student) return { ok: false, status: 404, error: 'Aluno Premium não encontrado.' };
    if (student.consultation_status === 'ENDED') {
      log({ action: 'premium_student_deactivate', studentId: student.student_id, changed: false });
      return { ok: true, data: { studentId: student.student_id, consultationStatus: 'ENDED', accessStatus: 'INACTIVE', deactivatedAt: student.deactivated_at, changed: false, unchanged: true } };
    }

    const timestamp = now();
    const eventId = `student-deactivated:${student.student_id}:${timestamp}`;
    const metadata = { student_id: student.student_id, previous_consultation_status: student.consultation_status, new_consultation_status: 'ENDED', timestamp };
    const results = await db.batch([
      db.prepare("UPDATE premium_students SET consultation_status='ENDED',access_status='INACTIVE',deactivated_at=?,updated_at=? WHERE student_id=? AND consultation_status=?")
        .bind(timestamp, timestamp, student.student_id, student.consultation_status),
      db.prepare("INSERT OR IGNORE INTO activity_timeline (id,student_id,student_email,event_type,source,title,metadata_json,created_at) SELECT ?,student_id,email,'STUDENT_DEACTIVATED','admin','Acompanhamento Premium encerrado',?,? FROM premium_students WHERE student_id=? AND consultation_status='ENDED' AND deactivated_at=?")
        .bind(eventId, JSON.stringify(metadata), timestamp, student.student_id, timestamp),
      db.prepare("INSERT OR IGNORE INTO premium_followup_entries (id,student_id,entry_type,title,content,source,created_by,created_at,updated_at) SELECT ?,student_id,'STUDENT_DEACTIVATED','Acompanhamento Premium encerrado',?,'admin',?,?,? FROM premium_students WHERE student_id=? AND consultation_status='ENDED' AND deactivated_at=?")
        .bind(`deactivation:${eventId}`, JSON.stringify({ ...metadata, created_by }), created_by, timestamp, timestamp, student.student_id, timestamp),
    ]);
    const changed = Number(results?.[0]?.meta?.changes ?? results?.[0]?.changes ?? 0) === 1;
    if (!changed) return { ok: false, status: 409, error: 'O estado do aluno mudou. Recarregue o prontuário.' };
    log({ action: 'premium_student_deactivate', studentId: student.student_id, changed: true });
    return { ok: true, data: { studentId: student.student_id, consultationStatus: 'ENDED', accessStatus: 'INACTIVE', deactivatedAt: timestamp, changed: true, unchanged: false } };
  };
}
