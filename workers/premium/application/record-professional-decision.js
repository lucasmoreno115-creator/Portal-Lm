import { assertProfessionalDecisionType } from '../domain/followup-entry.js';

function changedRows(result) { return Number(result?.meta?.changes ?? result?.changes ?? 0); }
const EXTRA_PENDING = Object.freeze({ UPDATE_PLAN: 'CREATE_NUTRITION_PLAN', CONTACT_STUDENT: 'CONTACT_STUDENT', REQUEST_MORE_INFORMATION: 'REQUEST_INFORMATION' });
const LABELS = Object.freeze({ KEEP_STRATEGY: 'Manter estratégia', UPDATE_PLAN: 'Atualizar plano', CONTACT_STUDENT: 'Entrar em contato', REQUEST_MORE_INFORMATION: 'Solicitar mais informações' });

export function createRecordProfessionalDecisionUseCase({ weeklyFeedbackRepository, followupEntryRepository, pendingItemRepository, db, randomUUID = crypto.randomUUID }) {
  return async function recordProfessionalDecision({ feedback_id, decision_type, note = null, coach_reply = null, followup_at = null, created_by = null }) {
    assertProfessionalDecisionType(decision_type);
    // Older internal callers may still record only a decision.  They must not
    // turn the internal note into a public reply; the Workspace always sends it.
    const publicReply = coach_reply == null ? null : String(coach_reply).trim();
    if (coach_reply != null && !publicReply) return { ok: false, error: 'A mensagem pública ao aluno é obrigatória.', status: 400 };
    const feedback = await weeklyFeedbackRepository.findById(feedback_id);
    if (!feedback?.student_id) return { ok: false, error: 'Feedback não encontrado.', status: 404 };
    const existingEntry = await followupEntryRepository.listByRelatedEntity('student_checkins', feedback_id).then((entries) => entries.find((entry) => entry.entry_type === 'PROFESSIONAL_DECISION'));
    if (existingEntry) {
      // A prior internal-only decision may predate X3.  Publishing its explicit
      // public message updates the same check-in, without creating a second
      // decision or follow-up entry.
      if (publicReply) await db.prepare(`UPDATE student_checkins SET coach_reply=?, coach_reply_at=?, analyzed_at=COALESCE(analyzed_at, ?), followup_at=COALESCE(?, followup_at) WHERE id=? AND student_id=?`).bind(publicReply, new Date().toISOString(), new Date().toISOString(), followup_at || null, feedback_id, feedback.student_id).run();
      return { ok: true, data: { decision_type: feedback.decision_type || decision_type, note: feedback.decision_note || note, entry: existingEntry, unchanged: true } };
    }
    const now = new Date().toISOString();
    const entryId = randomUUID();
    const extraType = EXTRA_PENDING[decision_type] || null;
    const statements = [
      db.prepare(`INSERT OR IGNORE INTO premium_followup_entries (id, student_id, entry_type, title, content, source, related_entity_type, related_entity_id, created_by, created_at, updated_at) SELECT ?, student_id, 'PROFESSIONAL_DECISION', ?, ?, 'admin', 'student_checkins', ?, ?, ?, ? FROM student_checkins WHERE id=? AND student_id=?`).bind(entryId, `Conduta: ${LABELS[decision_type]}`, note, feedback_id, created_by, now, now, feedback_id, feedback.student_id),
      // decision_type/decision_note are the X2 names for the internal decision code/reason.
      // coach_reply is deliberately supplied separately: it is the only text exposed to the Portal.
      db.prepare(`UPDATE student_checkins SET coach_reply=COALESCE(?, coach_reply), coach_reply_at=CASE WHEN ? IS NULL THEN coach_reply_at ELSE ? END, coach_status='reviewed', reviewed_at=?, reviewed_by=?, analyzed_at=?, decision_type=?, decision_note=?, decision_by=?, decision_at=?, followup_at=? WHERE id=? AND student_id=?`).bind(publicReply, publicReply, now, now, created_by ?? null, now, decision_type, note, created_by ?? null, now, followup_at || null, feedback_id, feedback.student_id),
      db.prepare(`UPDATE premium_pending_items SET status='RESOLVED', resolved_at=?, updated_at=?, created_by=COALESCE(created_by, ?) WHERE student_id=? AND type='ANALYZE_WEEKLY_FEEDBACK' AND related_entity_type='student_checkins' AND related_entity_id=? AND status='OPEN'`).bind(now, now, created_by ?? null, feedback.student_id, feedback_id),
    ];
    if (extraType) statements.push(db.prepare(`INSERT OR IGNORE INTO premium_pending_items (id, student_id, type, title, description, status, priority, source, related_entity_type, related_entity_id, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'OPEN', 'NORMAL', 'professional_decision', 'student_checkins', ?, ?, ?, ?)`).bind(randomUUID(), feedback.student_id, extraType, LABELS[decision_type], `Pendência criada pela conduta ${LABELS[decision_type]}.`, feedback_id, created_by ?? null, now, now));
    const results = typeof db.batch === 'function' ? await db.batch(statements) : await Promise.all(statements.map((s) => s.run()));
    if (changedRows(results[1]) === 0) return { ok: false, error: 'Feedback não foi atualizado.', status: 409 };
    const entry = await followupEntryRepository.listByRelatedEntity('student_checkins', feedback_id).then((entries) => entries.find((item) => item.entry_type === 'PROFESSIONAL_DECISION'));
    return { ok: true, data: { decision_type, note, entry } };
  };
}
