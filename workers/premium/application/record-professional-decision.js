import { assertProfessionalDecisionType } from '../domain/followup-entry.js';

function changedRows(result) { return Number(result?.meta?.changes ?? result?.changes ?? 0); }

export function createRecordProfessionalDecisionUseCase({ weeklyFeedbackRepository, followupEntryRepository, db, randomUUID = crypto.randomUUID }) {
  return async function recordProfessionalDecision({ feedback_id, decision_type, note = null, created_by = null }) {
    assertProfessionalDecisionType(decision_type);
    const feedback = await weeklyFeedbackRepository.findById(feedback_id);
    if (!feedback?.student_id) return { ok: false, error: 'Feedback não encontrado.', status: 404 };
    const existingEntry = await followupEntryRepository.listByRelatedEntity('student_checkins', feedback_id)
      .then((entries) => entries.find((entry) => entry.entry_type === 'PROFESSIONAL_DECISION'));
    if (existingEntry && String(feedback.coach_status || '').trim().toUpperCase() === 'REVIEWED') {
      return { ok: true, data: { decision_type, note, entry: existingEntry, unchanged: true } };
    }
    const now = new Date().toISOString();
    const entryId = randomUUID();
    const reply = note || decision_type;
    const statements = [
      db.prepare(`INSERT OR IGNORE INTO premium_followup_entries (
        id, student_id, entry_type, title, content, source, related_entity_type,
        related_entity_id, created_by, created_at, updated_at
      ) SELECT ?, student_id, 'PROFESSIONAL_DECISION', ?, ?, 'admin', 'student_checkins', ?, ?, ?, ?
        FROM student_checkins
        WHERE id=? AND student_id=?`).bind(
        entryId, `Conduta: ${decision_type}`, note, feedback_id, created_by, now, now, feedback_id, feedback.student_id
      ),
      db.prepare(`UPDATE student_checkins
        SET coach_reply=?, coach_reply_at=?, coach_status='reviewed', reviewed_at=?, reviewed_by=?
        WHERE id=?`).bind(reply, now, now, created_by ?? null, feedback_id),
    ];
    const results = typeof db.batch === 'function'
      ? await db.batch(statements)
      : [await statements[0].run(), await statements[1].run()];
    if (changedRows(results[1]) === 0) {
      return { ok: false, error: 'Feedback não foi atualizado.', status: 409 };
    }
    const entry = await followupEntryRepository.listByRelatedEntity('student_checkins', feedback_id)
      .then((entries) => entries.find((item) => item.entry_type === 'PROFESSIONAL_DECISION'));
    return { ok: true, data: { decision_type, note, entry } };
  };
}
