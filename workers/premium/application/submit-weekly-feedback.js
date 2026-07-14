import { createPremiumUseCase } from './create-use-case.js';
import { resolvePremiumIdentityForLegacyEmail } from './dual-write-helpers.js';
import { isFeedbackAnalyzed } from '../domain/feedback-status.js';

const ANALYZE_WEEKLY_FEEDBACK = 'ANALYZE_WEEKLY_FEEDBACK';
const RECEIVED_EVENT_TYPE = 'FEEDBACK_RECEIVED';
function changedRows(result) { return Number(result?.meta?.changes ?? result?.changes ?? 0); }
function eventIdFor(studentId, weekRef) { return `weekly-feedback:${studentId}:${weekRef}:received`; }

export function createSubmitWeeklyFeedbackUseCase(depsOrHandler) {
  if (typeof depsOrHandler === 'function') return createPremiumUseCase('submit-weekly-feedback', depsOrHandler);
  const deps = depsOrHandler;
  return createPremiumUseCase('submit-weekly-feedback', async ({ feedback, route, method }) => {
    const identity = await resolvePremiumIdentityForLegacyEmail({ identityService: deps.identityService, email: feedback.student_email, log: deps.log, area: 'premium_weekly_feedback', route, method, allowLegacyFallback: true });
    if (identity.blocked) return { ok: false, blocked: true, reason: identity.reason, identity };
    const studentId = identity.student_id;
    if (!deps.db) {
      const saved = await deps.weeklyFeedbackRepository.create({ ...feedback, student_id: studentId });
      await deps.pendingItemRepository?.create?.({ id: deps.randomUUID(), student_id: studentId, type: ANALYZE_WEEKLY_FEEDBACK, title: 'Analisar Feedback Semanal', description: `Feedback semanal ${feedback.week_ref} enviado pelo aluno.`, priority: 'NORMAL', source: 'automatic', related_entity_type: 'student_checkins', related_entity_id: saved.id, created_at: feedback.created_at, updated_at: feedback.created_at });
      await deps.eventRepository?.append?.({ id: deps.randomUUID(), student_id: studentId, student_email: feedback.student_email, event_type: RECEIVED_EVENT_TYPE, source: 'portal', title: 'Check-in enviado', metadata: { checkin_id: saved.id, week_ref: feedback.week_ref }, created_at: feedback.created_at });
      return { ok: true, saved, identity };
    }
    const now = feedback.updated_at ?? feedback.submitted_at ?? feedback.created_at ?? new Date().toISOString();
    const eventId = eventIdFor(studentId, feedback.week_ref);
    const statements = [
      deps.db.prepare(`INSERT OR IGNORE INTO student_checkins (id, student_id, student_email, week_ref, created_at, submitted_at, available_at, updated_at, coach_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`).bind(feedback.id, studentId, feedback.student_email, feedback.week_ref, feedback.created_at ?? now, feedback.submitted_at ?? now, feedback.available_at ?? null, now),
      deps.db.prepare(`UPDATE student_checkins SET student_email=?, training_adherence=?, nutrition_adherence=?, cardio_adherence=?, free_meals=?, hunger_level=?, binge_or_snacking=?, sleep_quality=?, energy_level=?, stress_level=?, weekly_weight=?, waist=?, strength_status=?, main_difficulty=?, routine_context=?, weekly_score=?, support_needed=?, submitted_at=COALESCE(submitted_at, ?), available_at=COALESCE(available_at, ?), updated_at=? WHERE student_id=? AND week_ref=? AND NOT (upper(coalesce(coach_status,'')) IN ('REVIEWED','REPLIED','ANALYZED','ANALISADO','ANALISADA'))`).bind(feedback.student_email, feedback.training_adherence ?? null, feedback.nutrition_adherence ?? null, feedback.cardio_adherence ?? null, feedback.free_meals ?? null, feedback.hunger_level ?? null, feedback.binge_or_snacking ?? null, feedback.sleep_quality ?? null, feedback.energy_level ?? null, feedback.stress_level ?? null, feedback.weekly_weight ?? null, feedback.waist ?? null, feedback.strength_status ?? null, feedback.main_difficulty ?? null, feedback.routine_context ?? null, feedback.weekly_score ?? null, feedback.support_needed ?? null, feedback.submitted_at ?? now, feedback.available_at ?? null, now, studentId, feedback.week_ref),
      deps.db.prepare(`INSERT OR IGNORE INTO premium_pending_items (id, student_id, type, title, description, status, priority, source, related_entity_type, related_entity_id, due_at, resolved_at, created_by, created_at, updated_at) SELECT ?, student_id, ?, 'Analisar Feedback Semanal', ?, 'OPEN', 'NORMAL', 'automatic', 'student_checkins', id, NULL, NULL, NULL, ?, ? FROM student_checkins WHERE student_id=? AND week_ref=? AND NOT (upper(coalesce(coach_status,'')) IN ('REVIEWED','REPLIED','ANALYZED','ANALISADO','ANALISADA'))`).bind(deps.randomUUID(), ANALYZE_WEEKLY_FEEDBACK, `Feedback semanal ${feedback.week_ref} enviado pelo aluno.`, now, now, studentId, feedback.week_ref),
      deps.db.prepare(`INSERT OR IGNORE INTO activity_timeline (id, student_id, student_email, event_type, source, title, metadata_json, created_at) SELECT ?, student_id, student_email, ?, 'portal', 'Check-in enviado', json_object('checkin_id', id, 'week_ref', week_ref), ? FROM student_checkins WHERE student_id=? AND week_ref=? AND NOT (upper(coalesce(coach_status,'')) IN ('REVIEWED','REPLIED','ANALYZED','ANALISADO','ANALISADA'))`).bind(eventId, RECEIVED_EVENT_TYPE, now, studentId, feedback.week_ref),
    ];
    const results = typeof deps.db.batch === 'function' ? await deps.db.batch(statements) : [await statements[0].run(), await statements[1].run(), await statements[2].run(), await statements[3].run()];
    const saved = await deps.weeklyFeedbackRepository.findByStudentAndWeek(studentId, feedback.week_ref);
    if (!saved) return { ok: false, status: 409, error: 'Feedback não foi persistido.' };
    if (isFeedbackAnalyzed(saved.coach_status) && changedRows(results[1]) === 0) return { ok: false, blocked: true, status: 409, error: 'Este Feedback Semanal já foi analisado por Lucas.', saved, identity };
    if (changedRows(results[1]) === 0) return { ok: false, status: 409, error: 'Feedback não foi atualizado.', saved, identity };
    return { ok: true, saved, identity, event_id: eventId };
  });
}
