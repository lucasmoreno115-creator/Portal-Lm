import { assertProfessionalDecisionType } from '../domain/followup-entry.js';
import { presentProfessionalDecision } from '../presenters/professional-decision-presenter.js';

function changedRows(result) { return Number(result?.meta?.changes ?? result?.changes ?? 0); }
const EXTRA_PENDING = Object.freeze({ UPDATE_PLAN: 'CREATE_NUTRITION_PLAN', CONTACT_STUDENT: 'CONTACT_STUDENT', REQUEST_MORE_INFORMATION: 'REQUEST_INFORMATION' });
const LABELS = Object.freeze({ KEEP_STRATEGY: 'Manter estratégia', UPDATE_PLAN: 'Atualizar plano', CONTACT_STUDENT: 'Entrar em contato', REQUEST_MORE_INFORMATION: 'Solicitar mais informações' });
const REVIEWED_STATUSES = Object.freeze(['REVIEWED', 'REPLIED', 'ANALYZED', 'ANALISADO', 'ANALISADA']);

function normalizedDecision({ decision_type, note, coach_reply, followup_at }) {
  return {
    decision_type: String(decision_type || '').trim().toUpperCase(),
    note: String(note ?? '').trim() || null,
    coach_reply: String(coach_reply ?? '').trim(),
    followup_at: String(followup_at ?? '').trim() || null,
  };
}

function persistedDecision(feedback) {
  return normalizedDecision({ decision_type: feedback.decision_type, note: feedback.decision_note, coach_reply: feedback.coach_reply, followup_at: feedback.followup_at });
}

function decisionsEqual(left, right) { return Object.keys(left).every((key) => left[key] === right[key]); }
function conflict() { return { ok: false, status: 409, code: 'WEEKLY_FEEDBACK_ALREADY_REVIEWED', error: 'Este check-in já foi analisado. Recarregue o estado atual.' }; }

export function createRecordProfessionalDecisionUseCase({ weeklyFeedbackRepository, followupEntryRepository, db, randomUUID = crypto.randomUUID }) {
  return async function recordProfessionalDecision({ feedback_id, decision_type, note = null, coach_reply = null, followup_at = null, created_by = null }) {
    assertProfessionalDecisionType(decision_type);
    const requested = normalizedDecision({ decision_type, note, coach_reply, followup_at });
    if (!requested.coach_reply) return { ok: false, status: 400, code: 'COACH_REPLY_REQUIRED', error: 'A mensagem pública ao aluno é obrigatória.' };
    if (typeof db.batch !== 'function') return { ok: false, status: 503, code: 'ATOMIC_BATCH_UNAVAILABLE', error: 'Não foi possível concluir a análise de forma atômica.' };

    await weeklyFeedbackRepository.claimLegacyIdentity?.(feedback_id);
    let feedback = await weeklyFeedbackRepository.findById(feedback_id);
    if (!feedback?.student_id) return { ok: false, error: 'Feedback não encontrado.', status: 404, code: 'WEEKLY_FEEDBACK_NOT_FOUND' };
    let existingEntry = await findDecisionEntry(followupEntryRepository, feedback_id);
    if (existingEntry) return completedResult(requested, feedback, existingEntry);
    if (!feedback.submitted_at || REVIEWED_STATUSES.includes(String(feedback.coach_status || '').trim().toUpperCase())) return conflict();

    const now = new Date().toISOString();
    const entryId = randomUUID();
    const extraType = EXTRA_PENDING[requested.decision_type] || null;
    const ownership = `EXISTS (SELECT 1 FROM premium_followup_entries owner WHERE owner.id=? AND owner.entry_type='PROFESSIONAL_DECISION' AND owner.related_entity_type='student_checkins' AND owner.related_entity_id=?)`;
    const statements = [
      db.prepare(`INSERT OR IGNORE INTO premium_followup_entries (id, student_id, entry_type, title, content, source, related_entity_type, related_entity_id, created_by, created_at, updated_at) SELECT ?, sc.student_id, 'PROFESSIONAL_DECISION', ?, ?, 'admin', 'student_checkins', ?, ?, ?, ? FROM student_checkins sc WHERE sc.id=? AND sc.student_id=? AND sc.submitted_at IS NOT NULL AND upper(trim(coalesce(sc.coach_status,''))) NOT IN ('REVIEWED','REPLIED','ANALYZED','ANALISADO','ANALISADA')`).bind(entryId, `Conduta: ${LABELS[requested.decision_type]}`, requested.note, feedback_id, created_by, now, now, feedback_id, feedback.student_id),
      db.prepare(`UPDATE student_checkins SET coach_reply=?, coach_reply_at=?, coach_status='reviewed', reviewed_at=?, reviewed_by=?, analyzed_at=?, decision_type=?, decision_note=?, decision_by=?, decision_at=?, followup_at=?, updated_at=? WHERE id=? AND student_id=? AND ${ownership}`).bind(requested.coach_reply, now, now, created_by ?? null, now, requested.decision_type, requested.note, created_by ?? null, now, requested.followup_at, now, feedback_id, feedback.student_id, entryId, feedback_id),
      db.prepare(`UPDATE premium_pending_items SET status='RESOLVED', resolved_at=?, updated_at=?, created_by=COALESCE(created_by, ?) WHERE student_id=? AND type='ANALYZE_WEEKLY_FEEDBACK' AND related_entity_type='student_checkins' AND related_entity_id=? AND status='OPEN' AND ${ownership}`).bind(now, now, created_by ?? null, feedback.student_id, feedback_id, entryId, feedback_id),
    ];
    if (extraType) statements.push(db.prepare(`INSERT OR IGNORE INTO premium_pending_items (id, student_id, type, title, description, status, priority, source, related_entity_type, related_entity_id, created_by, created_at, updated_at) SELECT ?, ?, ?, ?, ?, 'OPEN', 'NORMAL', 'professional_decision', 'student_checkins', ?, ?, ?, ? WHERE ${ownership}`).bind(randomUUID(), feedback.student_id, extraType, LABELS[requested.decision_type], `Pendência criada pela conduta ${LABELS[requested.decision_type]}.`, feedback_id, created_by ?? null, now, now, entryId, feedback_id));

    const results = await db.batch(statements);
    feedback = await weeklyFeedbackRepository.findById(feedback_id);
    existingEntry = await findDecisionEntry(followupEntryRepository, feedback_id);
    if (changedRows(results[0]) === 0) return existingEntry ? completedResult(requested, feedback, existingEntry) : conflict();
    if (changedRows(results[1]) === 0 || !existingEntry) return { ok: false, status: 409, code: 'WEEKLY_FEEDBACK_DECISION_CONFLICT', error: 'Feedback não foi atualizado.' };
    return { ok: true, data: presentProfessionalDecision({ feedback, entry: existingEntry, unchanged: false, pendingResolved: changedRows(results[2]) > 0 }) };
  };
}

async function findDecisionEntry(repository, feedbackId) {
  return repository.listByRelatedEntity('student_checkins', feedbackId).then((entries) => entries.find((entry) => entry.entry_type === 'PROFESSIONAL_DECISION'));
}

function completedResult(requested, feedback, entry) {
  if (!decisionsEqual(requested, persistedDecision(feedback))) return conflict();
  return { ok: true, data: presentProfessionalDecision({ feedback, entry, unchanged: true, pendingResolved: false }) };
}
