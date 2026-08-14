export function createReactivatePremiumStudentUseCase({ db, now = () => new Date().toISOString(), log = console.info }) {
  return async ({ student_id, created_by = 'admin' }) => {
    const student = await db.prepare('SELECT student_id,email,consultation_status,access_status,deactivated_at,reactivated_at FROM premium_students WHERE student_id=? LIMIT 1').bind(student_id).first();
    if (!student) return { ok: false, status: 404, error: 'Aluno Premium não encontrado.' };

    if (student.consultation_status === 'ACTIVE' && student.access_status === 'ACTIVE' && student.reactivated_at && student.deactivated_at) {
      log({ action: 'premium_student_reactivate', studentId: student.student_id, changed: false });
      return { ok: true, data: { studentId: student.student_id, consultationStatus: 'ACTIVE', accessStatus: 'ACTIVE', deactivatedAt: student.deactivated_at, reactivatedAt: student.reactivated_at, changed: false, unchanged: true } };
    }
    if (student.consultation_status !== 'ENDED' || student.access_status !== 'INACTIVE') {
      return { ok: false, status: 409, code: 'INVALID_LIFECYCLE_TRANSITION', error: 'O aluno não está encerrado e não pode ser reativado.' };
    }

    const timestamp = now();
    const eventId = `student-reactivated:${student.student_id}:${timestamp}`;
    const metadata = { student_id: student.student_id, previous_consultation_status: 'ENDED', new_consultation_status: 'ACTIVE', timestamp };
    const results = await db.batch([
      db.prepare("UPDATE premium_students SET consultation_status='ACTIVE',access_status='ACTIVE',reactivated_at=?,updated_at=? WHERE student_id=? AND consultation_status='ENDED' AND access_status='INACTIVE'")
        .bind(timestamp, timestamp, student.student_id),
      db.prepare("INSERT OR IGNORE INTO activity_timeline (id,student_id,student_email,event_type,source,title,metadata_json,created_at) SELECT ?,student_id,email,'STUDENT_REACTIVATED','admin','Acompanhamento Premium reativado',?,? FROM premium_students WHERE student_id=? AND consultation_status='ACTIVE' AND access_status='ACTIVE' AND reactivated_at=?")
        .bind(eventId, JSON.stringify(metadata), timestamp, student.student_id, timestamp),
      db.prepare("INSERT OR IGNORE INTO premium_followup_entries (id,student_id,entry_type,title,content,source,created_by,created_at,updated_at) SELECT ?,student_id,'STUDENT_REACTIVATED','Acompanhamento Premium reativado',?,'admin',?,?,? FROM premium_students WHERE student_id=? AND consultation_status='ACTIVE' AND access_status='ACTIVE' AND reactivated_at=?")
        .bind(`reactivation:${eventId}`, JSON.stringify({ ...metadata, created_by }), created_by, timestamp, timestamp, student.student_id, timestamp),
    ]);
    const changed = Number(results?.[0]?.meta?.changes ?? results?.[0]?.changes ?? 0) === 1;
    if (!changed) {
      const current = await db.prepare('SELECT consultation_status,access_status,deactivated_at,reactivated_at FROM premium_students WHERE student_id=?').bind(student.student_id).first();
      if (current?.consultation_status === 'ACTIVE' && current?.access_status === 'ACTIVE' && current?.reactivated_at) return { ok: true, data: { studentId: student.student_id, consultationStatus: 'ACTIVE', accessStatus: 'ACTIVE', deactivatedAt: current.deactivated_at, reactivatedAt: current.reactivated_at, changed: false, unchanged: true } };
      return { ok: false, status: 409, code: 'INVALID_LIFECYCLE_TRANSITION', error: 'O estado do aluno mudou. Recarregue o prontuário.' };
    }
    log({ action: 'premium_student_reactivate', studentId: student.student_id, changed: true });
    return { ok: true, data: { studentId: student.student_id, consultationStatus: 'ACTIVE', accessStatus: 'ACTIVE', deactivatedAt: student.deactivated_at, reactivatedAt: timestamp, changed: true, unchanged: false } };
  };
}
