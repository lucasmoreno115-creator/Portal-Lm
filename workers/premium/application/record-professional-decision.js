import { assertProfessionalDecisionType } from '../domain/followup-entry.js';
export function createRecordProfessionalDecisionUseCase({ weeklyFeedbackRepository, followupEntryRepository, randomUUID = crypto.randomUUID }) {
  return async function recordProfessionalDecision({ feedback_id, decision_type, note = null, created_by = null }) {
    assertProfessionalDecisionType(decision_type);
    const feedback = await weeklyFeedbackRepository.findById(feedback_id); if (!feedback?.student_id) return { ok: false, error: 'Feedback não encontrado.', status: 404 };
    const now = new Date().toISOString();
    await weeklyFeedbackRepository.saveProfessionalDecision(feedback_id, { coach_reply: note || decision_type, coach_reply_at: now, coach_status: 'reviewed', reviewed_at: now, reviewed_by: created_by });
    const entry = await followupEntryRepository.append({ id: randomUUID(), student_id: feedback.student_id, entry_type: 'PROFESSIONAL_DECISION', title: `Conduta: ${decision_type}`, content: note, source: 'admin', related_entity_type: 'student_checkins', related_entity_id: feedback_id, created_by, created_at: now });
    return { ok: true, data: { decision_type, note, entry } };
  };
}
