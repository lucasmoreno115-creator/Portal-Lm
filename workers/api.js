import { EVENT_TYPES } from './event-types.js';
import { nullableTrimmed, safeJsonParse, getWeekRef } from './lm-utils.js';
import { buildBaseTimeline, appendActivityRows } from './timeline-engine.js';
import { inferRiskLevelFromOutcome } from './student-lifecycle.js';
import { buildActionUrl } from './command-center.js';
import { buildStudentSummary } from './student360.js';
import { logOperationalEvent } from './services/operational-log-service.js';
import { createD1PremiumStudentRepository } from './premium/repositories/d1-premium-student-repository.js';
import { createD1AnamnesisRepository } from './premium/repositories/d1-anamnesis-repository.js';
import { createD1NutritionPlanRepository } from './premium/repositories/d1-nutrition-plan-repository.js';
import { createD1WeeklyFeedbackRepository } from './premium/repositories/d1-weekly-feedback-repository.js';
import { createD1PremiumEventRepository } from './premium/repositories/d1-premium-event-repository.js';
import { createStudentIdentityService } from './premium/services/student-identity-service.js';
import { createSaveNutritionPlanUseCase } from './premium/application/save-nutrition-plan.js';
import { createGetNutritionPlanUseCase } from './premium/application/get-nutrition-plan.js';
import { createSubmitWeeklyFeedbackUseCase } from './premium/application/submit-weekly-feedback.js';
import { createListWeeklyFeedbacksUseCase } from './premium/application/list-weekly-feedbacks.js';
import { createAnalyzeWeeklyFeedbackUseCase } from './premium/application/analyze-weekly-feedback.js';
import { createAnalyzeAnamnesisUseCase } from './premium/application/analyze-anamnesis.js';
import { createD1StudentRecordRepository } from './premium/repositories/d1-student-record-repository.js';
import { createD1FollowupEntryRepository } from './premium/repositories/d1-followup-entry-repository.js';
import { createD1PendingItemRepository } from './premium/repositories/d1-pending-item-repository.js';
import { createGetStudentRecordUseCase } from './premium/application/get-student-record.js';
import { createAddFollowupEntryUseCase } from './premium/application/add-followup-entry.js';
import { createCreatePendingItemUseCase } from './premium/application/create-pending-item.js';
import { createResolvePendingItemUseCase } from './premium/application/resolve-pending-item.js';
import { createUpdateConsultationStatusUseCase } from './premium/application/update-consultation-status.js';
import { createRecordProfessionalDecisionUseCase } from './premium/application/record-professional-decision.js';
import { presentStudentRecord } from './premium/presenters/student-record-presenter.js';
import { createD1FeedbackReminderRepository } from './premium/repositories/d1-feedback-reminder-repository.js';
import { createWeeklyFeedbackScheduleService } from './premium/services/weekly-feedback-schedule-service.js';
import { createWeeklyFeedbackReminderService } from './premium/services/weekly-feedback-reminder-service.js';
import { createGetCurrentWeeklyFeedbackUseCase } from './premium/application/get-current-weekly-feedback.js';
import { createGetWeeklyFeedbackForReviewUseCase } from './premium/application/get-weekly-feedback-for-review.js';
import { createListFeedbacksAwaitingAnalysisUseCase } from './premium/application/list-feedbacks-awaiting-analysis.js';
import { createListMissingWeeklyFeedbacksUseCase } from './premium/application/list-missing-weekly-feedbacks.js';
import { createPrepareWeeklyFeedbackRemindersUseCase } from './premium/application/prepare-weekly-feedback-reminders.js';
import { createGetCurrentNutritionPlanUseCase } from './premium/application/get-current-nutrition-plan.js';
import { createGetNutritionPlanHistoryUseCase } from './premium/application/get-nutrition-plan-history.js';
import { createGetNutritionPlanDraftUseCase } from './premium/application/get-nutrition-plan-draft.js';
import { createCreateNutritionPlanDraftUseCase } from './premium/application/create-nutrition-plan-draft.js';
import { createUpdateNutritionPlanDraftUseCase } from './premium/application/update-nutrition-plan-draft.js';
import { createPublishNutritionPlanUseCase } from './premium/application/publish-nutrition-plan.js';
import { createArchiveNutritionPlanUseCase } from './premium/application/archive-nutrition-plan.js';
import { createDraftFromPublishedPlanUseCase } from './premium/application/create-draft-from-published-plan.js';
import { presentPublicNutritionPlan } from './premium/presenters/nutrition-plan-public-presenter.js';
import { presentAdminNutritionPlan, presentAdminNutritionPlanSummary } from './premium/presenters/nutrition-plan-admin-presenter.js';
import { createD1ProfessionalWorkspaceRepository } from './premium/repositories/d1-professional-workspace-repository.js';
import { createGetProfessionalWorkspaceSummaryUseCase } from './premium/application/get-professional-workspace-summary.js';
import { createListProfessionalWorkspaceStudentsUseCase } from './premium/application/list-professional-workspace-students.js';
import { createSearchProfessionalWorkspaceStudentsUseCase } from './premium/application/search-professional-workspace-students.js';
import { createGetProfessionalWorkspaceStudentUseCase } from './premium/application/get-professional-workspace-student.js';
import { createListProfessionalWorkspacePendingItemsUseCase } from './premium/application/list-professional-workspace-pending-items.js';
import { createGetSaturdayReviewSummaryUseCase } from './premium/application/get-saturday-review-summary.js';
import { presentWorkspaceSummary } from './premium/presenters/professional-workspace-summary-presenter.js';
import { presentWorkspaceStudentSummary, presentWorkspaceStudentContext } from './premium/presenters/professional-workspace-student-presenter.js';
import { presentWorkspacePendingItems } from './premium/presenters/professional-workspace-pending-presenter.js';
import { presentSaturdayReview } from './premium/presenters/professional-workspace-saturday-presenter.js';


export { sanitizeOperationalMetadata } from './services/operational-log-service.js';
import { buildD1HealthCheck, tableExists } from './services/health-check-service.js';
import { jsonWithUsage } from './services/endpoint-usage-service.js';
import { createAdminSession, invalidateAdminSession, isAdminAuthorized, validateAdminLoginToken, validateStudent, normalizeStudentPlan } from './services/auth-service.js';
export { normalizeEmail, normalizeStudentPlan } from './services/auth-service.js';

const ensuredSchemaByDb = new WeakMap();

function createPremiumApplication(env, request) {
  const studentRepository = createD1PremiumStudentRepository(env.DB);
  const identityService = createStudentIdentityService({ repository: studentRepository });
  const log = (payload) => logOperationalEvent(env.DB, payload);
  const eventRepository = createD1PremiumEventRepository(env.DB);
  const studentRecordRepository = createD1StudentRecordRepository(env.DB);
  const followupEntryRepository = createD1FollowupEntryRepository(env.DB);
  const pendingItemRepository = createD1PendingItemRepository(env.DB);
  const weeklyFeedbackRepository = createD1WeeklyFeedbackRepository(env.DB);
  const reminderRepository = createD1FeedbackReminderRepository(env.DB);
  const scheduleService = createWeeklyFeedbackScheduleService();
  const reminderService = createWeeklyFeedbackReminderService({ scheduleService });
  const workspaceRepository = createD1ProfessionalWorkspaceRepository(env.DB, { scheduleService });
  return {
    anamnesisRepository: createD1AnamnesisRepository(env.DB),
    nutritionPlanRepository: createD1NutritionPlanRepository(env.DB),
    weeklyFeedbackRepository,
    eventRepository,
    studentRepository,
    studentRecordRepository,
    followupEntryRepository,
    pendingItemRepository,
    identityService,
    getNutritionPlan: createGetNutritionPlanUseCase({ identityService, nutritionPlanRepository: createD1NutritionPlanRepository(env.DB), log }),
    saveNutritionPlan: createSaveNutritionPlanUseCase({ identityService, nutritionPlanRepository: createD1NutritionPlanRepository(env.DB), eventRepository, log, randomUUID: () => crypto.randomUUID() }),
    submitWeeklyFeedback: createSubmitWeeklyFeedbackUseCase({ identityService, weeklyFeedbackRepository, pendingItemRepository, eventRepository, db: env.DB, log, randomUUID: () => crypto.randomUUID() }),
    listWeeklyFeedbacks: createListWeeklyFeedbacksUseCase({ identityService, weeklyFeedbackRepository, log }),
    analyzeWeeklyFeedback: createAnalyzeWeeklyFeedbackUseCase({ weeklyFeedbackRepository }),
    analyzeAnamnesis: createAnalyzeAnamnesisUseCase({ anamnesisRepository: createD1AnamnesisRepository(env.DB) }),
    getStudentRecord: createGetStudentRecordUseCase({ studentRepository, studentRecordRepository, pendingItemRepository, randomUUID: () => crypto.randomUUID() }),
    addFollowupEntry: createAddFollowupEntryUseCase({ studentRepository, followupEntryRepository, randomUUID: () => crypto.randomUUID() }),
    createPendingItem: createCreatePendingItemUseCase({ studentRepository, pendingItemRepository, followupEntryRepository, randomUUID: () => crypto.randomUUID() }),
    resolvePendingItem: createResolvePendingItemUseCase({ pendingItemRepository, followupEntryRepository, randomUUID: () => crypto.randomUUID() }),
    updateConsultationStatus: createUpdateConsultationStatusUseCase({ studentRepository, followupEntryRepository, db: env.DB, randomUUID: () => crypto.randomUUID() }),
    recordProfessionalDecision: createRecordProfessionalDecisionUseCase({ weeklyFeedbackRepository, followupEntryRepository, pendingItemRepository, db: env.DB, randomUUID: () => crypto.randomUUID() }),
    getCurrentWeeklyFeedback: createGetCurrentWeeklyFeedbackUseCase({ identityService, weeklyFeedbackRepository, scheduleService }),
    getWeeklyFeedbackForReview: createGetWeeklyFeedbackForReviewUseCase({ weeklyFeedbackRepository, pendingItemRepository, followupEntryRepository, scheduleService }),
    listFeedbacksAwaitingAnalysis: createListFeedbacksAwaitingAnalysisUseCase({ weeklyFeedbackRepository }),
    listMissingWeeklyFeedbacks: createListMissingWeeklyFeedbacksUseCase({ weeklyFeedbackRepository, scheduleService }),
    prepareWeeklyFeedbackReminders: createPrepareWeeklyFeedbackRemindersUseCase({ studentRepository, weeklyFeedbackRepository, reminderRepository, reminderService, scheduleService, randomUUID: () => crypto.randomUUID() }),
    getCurrentNutritionPlanWorkflow: createGetCurrentNutritionPlanUseCase({ studentRepository, nutritionPlanRepository: createD1NutritionPlanRepository(env.DB) }),
    getNutritionPlanHistory: createGetNutritionPlanHistoryUseCase({ studentRepository, nutritionPlanRepository: createD1NutritionPlanRepository(env.DB) }),
    getNutritionPlanDraft: createGetNutritionPlanDraftUseCase({ studentRepository, nutritionPlanRepository: createD1NutritionPlanRepository(env.DB) }),
    createNutritionPlanDraft: createCreateNutritionPlanDraftUseCase({ studentRepository, nutritionPlanRepository: createD1NutritionPlanRepository(env.DB), randomUUID: () => crypto.randomUUID() }),
    updateNutritionPlanDraft: createUpdateNutritionPlanDraftUseCase({ nutritionPlanRepository: createD1NutritionPlanRepository(env.DB) }),
    publishNutritionPlan: createPublishNutritionPlanUseCase({ nutritionPlanRepository: createD1NutritionPlanRepository(env.DB), randomUUID: () => crypto.randomUUID() }),
    archiveNutritionPlan: createArchiveNutritionPlanUseCase({ nutritionPlanRepository: createD1NutritionPlanRepository(env.DB) }),
    getProfessionalWorkspaceSummary: createGetProfessionalWorkspaceSummaryUseCase({ workspaceRepository }),
    listProfessionalWorkspaceStudents: createListProfessionalWorkspaceStudentsUseCase({ workspaceRepository }),
    searchProfessionalWorkspaceStudents: createSearchProfessionalWorkspaceStudentsUseCase({ workspaceRepository }),
    getProfessionalWorkspaceStudent: createGetProfessionalWorkspaceStudentUseCase({ workspaceRepository }),
    listProfessionalWorkspacePendingItems: createListProfessionalWorkspacePendingItemsUseCase({ workspaceRepository }),
    getSaturdayReviewSummary: createGetSaturdayReviewSummaryUseCase({ workspaceRepository }),
    createDraftFromPublishedPlan: createDraftFromPublishedPlanUseCase({ nutritionPlanRepository: createD1NutritionPlanRepository(env.DB), randomUUID: () => crypto.randomUUID() }),
  };
}



async function getPremiumGate(db, email) {
  const normalized = String(email || '').trim().toLowerCase();
  const row = await db.prepare(`SELECT consultation_status FROM premium_students WHERE normalized_email=? OR lower(trim(email))=? ORDER BY updated_at DESC LIMIT 1`).bind(normalized, normalized).first();
  const status = String(row?.consultation_status || '').toUpperCase();
  return { status: row ? status : 'LEGACY_COMPATIBLE', released: row ? status === 'ACTIVE' : true, legacyCompatible: !row };
}
function premiumLockedResponse() {
  return { ok: false, error: 'Seu planejamento está em preparação. Assim que o acompanhamento for liberado, os módulos publicados aparecerão aqui.' };
}

function publicNutritionPlan(plan) {
  if (!plan) return null;
  return {
    id: plan.id,
    student_email: plan.student_email,
    title: plan.title,
    goal: plan.goal,
    strategy: plan.strategy,
    meals: Array.isArray(plan.meals) ? plan.meals : safeJsonParseArray(plan.meals_json),
    substitutions: Array.isArray(plan.substitutions) ? plan.substitutions : safeJsonParseArray(plan.substitutions_json),
    adherence_rules: Array.isArray(plan.adherence_rules) ? plan.adherence_rules : safeJsonParseArray(plan.adherence_rules_json),
    notes: plan.notes,
    whatsapp_message: plan.whatsapp_message,
    created_at: plan.created_at,
    updated_at: plan.updated_at,
  };
}

function publicWeeklyFeedback(row) {
  return {
    id: row.id,
    student_email: row.student_email,
    week_ref: row.week_ref,
    training_adherence: row.training_adherence,
    nutrition_adherence: row.nutrition_adherence,
    cardio_adherence: row.cardio_adherence,
    free_meals: row.free_meals,
    hunger_level: row.hunger_level,
    binge_or_snacking: row.binge_or_snacking,
    sleep_quality: row.sleep_quality,
    energy_level: row.energy_level,
    stress_level: row.stress_level,
    weekly_weight: row.weekly_weight,
    waist: row.waist,
    strength_status: row.strength_status,
    main_difficulty: row.main_difficulty,
    routine_context: row.routine_context,
    weekly_score: row.weekly_score,
    support_needed: row.support_needed,
    created_at: row.created_at,
    coach_status: row.coach_status,
    coach_reply: row.coach_reply,
    coach_reply_at: row.coach_reply_at,
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method;
    const json = (payload, status = 200, matchedRoute = null) => jsonWithUsage(payload, status, request, env, matchedRoute, rawJson);

    if (method === 'OPTIONS') return corsResponse();

    if (method === 'GET' && (url.pathname === '/admin' || url.pathname === '/admin/')) {
      const target = env.PREMIUM_ADMIN_CUTOVER_ENABLED === 'true' ? '/admin-premium-workspace.html' : '/admin-legacy.html';
      return Response.redirect(new URL(target, url.origin).toString(), 302);
    }

    try {
      await ensureSchema(env.DB);

      if (url.pathname === '/api/admin/premium/cutover-route' && method === 'GET') {
        const cutoverEnabled = env.PREMIUM_ADMIN_CUTOVER_ENABLED === 'true';
        return json({ ok: true, data: { flag: 'PREMIUM_ADMIN_CUTOVER_ENABLED', cutoverEnabled, target: cutoverEnabled ? '/admin-premium-workspace.html' : '/admin-legacy.html' } }, 200, '/api/admin/premium/cutover-route');
      }

      if (url.pathname === '/api/health' && method === 'GET') {
        return json({ ok: true, status: 'healthy' });
      }

      if (url.pathname === '/api/diagnostic/evaluate' && method === 'POST') {
        const body = await safeJson(request);
        return json({ ok: true, data: { score: 0, received: body || {} } });
      }


      if (url.pathname === '/api/anamnese-premium' && method === 'POST') {
        const body = await safeJson(request);
        const studentName = nullableTrimmed(body?.student_name);
        const providedEmail = nullableTrimmed(body?.student_email)?.toLowerCase() || null;
        const studentPhone = nullableTrimmed(body?.student_phone);
        const studentEmail = providedEmail;
        const status = nullableTrimmed(body?.status) || 'RECEBIDA';
        const answers = body?.answers && typeof body.answers === 'object' ? body.answers : {};
        const internalScores = calculateAnamnesisInternalScores(answers);

        if (!studentName) {
          return json({ ok: false, error: 'student_name é obrigatório.' }, 400);
        }
        if (!studentEmail) {
          return json({ ok: false, error: 'student_email é obrigatório.' }, 400);
        }
        if (!studentPhone) {
          return json({ ok: false, error: 'student_phone é obrigatório.' }, 400);
        }

        const id = crypto.randomUUID();
        const now = new Date().toISOString();

        const premiumApp = createPremiumApplication(env, request);
        const identityResult = await premiumApp.identityService.resolve({ email: studentEmail });
        if (identityResult.error === 'AMBIGUOUS_STUDENT_IDENTITY' || identityResult.error === 'NON_PREMIUM_STUDENT') {
          await logOperationalEvent(env.DB, {
            level: 'warn',
            area: 'premium_anamnesis',
            event: 'PREMIUM_IDENTITY_ASSOCIATION_CONFLICT',
            route: url.pathname,
            method,
            student_email: studentEmail,
            metadata: { reason: identityResult.error }
          });
          return json({ ok: false, error: 'Não foi possível gravar dados Premium com segurança.' }, 403);
        }
        if (identityResult.error === 'EMAIL_REQUIRED') {
          return json({ ok: false, error: 'student_email é obrigatório.' }, 400);
        }
        const studentId = identityResult.ok ? identityResult.student.student_id : null;
        await logOperationalEvent(env.DB, {
          level: identityResult.ok ? 'info' : 'warn',
          area: 'premium_anamnesis',
          event: identityResult.ok ? 'PREMIUM_IDENTITY_DUAL_WRITE_SUCCESS' : 'PREMIUM_IDENTITY_EMAIL_FALLBACK_USED',
          route: url.pathname,
          method,
          student_email: studentEmail,
          metadata: { student_id: studentId, reason: identityResult.error || null }
        });
        await premiumApp.anamnesisRepository.create({
          id,
          student_id: studentId,
          student_name: studentName,
          student_email: studentEmail,
          student_phone: studentPhone,
          status,
          answers_json: JSON.stringify(answers),
          internal_scores_json: JSON.stringify(internalScores),
          created_at: now,
          updated_at: now,
        });
        await premiumApp.eventRepository.append({ id: crypto.randomUUID(), student_id: studentId, student_email: studentEmail, event_type: 'ANAMNESIS_SENT', source: 'portal', title: 'Anamnese enviada', metadata: { anamnesis_id: id, status }, created_at: now });
        if (studentId) await env.DB.prepare(`UPDATE premium_students SET consultation_status='UNDER_REVIEW', updated_at=? WHERE student_id=? AND consultation_status IN ('NEW','AWAITING_ANAMNESIS')`).bind(now, studentId).run();

        const normalizedWhatsapp = normalizeWhatsapp(studentPhone);
        const existingAccess = await env.DB.prepare(
          `SELECT id, name, email, access_token, status, plan_type, whatsapp
           FROM student_access
           WHERE lower(email)=?
           LIMIT 1`
        ).bind(studentEmail).first();

        let accessCreated = false;
        let accessStatus = 'PENDING_ONBOARDING';

        if (!existingAccess) {
          await env.DB.prepare(
            `INSERT INTO student_access (
              id, name, email, access_token, status, plan_type, whatsapp, created_at
            ) VALUES (?, ?, ?, ?, 'PENDING_ONBOARDING', 'PREMIUM', ?, ?)`
          ).bind(
            crypto.randomUUID(),
            studentName,
            studentEmail,
            generateAccessToken(),
            normalizedWhatsapp,
            now
          ).run();
          accessCreated = true;
        } else {
          const ensuredToken = nullableTrimmed(existingAccess.access_token) || generateAccessToken();
          accessStatus = nullableTrimmed(existingAccess.status) || 'PENDING_ONBOARDING';
          await env.DB.prepare(
            `UPDATE student_access
             SET name=?, access_token=?, status=?, plan_type=?, whatsapp=?
             WHERE id=?`
          ).bind(
            nullableTrimmed(existingAccess.name) || studentName,
            ensuredToken,
            accessStatus,
            nullableTrimmed(existingAccess.plan_type) || 'PREMIUM',
            nullableTrimmed(existingAccess.whatsapp) || normalizedWhatsapp,
            existingAccess.id
          ).run();
        }

        return json({ ok: true, data: { id, created_at: now, access_created: accessCreated, access_status: accessStatus } });
      }

      if (url.pathname === '/api/admin/session/login' && method === 'POST') {
        const body = await safeJson(request);
        const providedToken = String(body?.token || body?.admin_token || '').trim();

        if (!validateAdminLoginToken(providedToken, env)) {
          await logOperationalEvent(env.DB, {
            level: 'warn',
            area: 'admin',
            event: 'admin_login_failed',
            route: url.pathname,
            method,
            message: 'Login admin recusado.'
          });
          return json({ ok: false, error: 'Unauthorized' }, 401);
        }

        const session = createAdminSession();
        await logOperationalEvent(env.DB, {
          level: 'info',
          area: 'admin',
          event: 'admin_login_success',
          route: url.pathname,
          method,
          message: 'Sessão admin criada.'
        });
        return json({
          ok: true,
          data: {
            session_id: session.sessionId,
            expires_at: session.expiresAtIso,
            ttl_seconds: session.ttlSeconds
          }
        });
      }

      if (url.pathname === '/api/admin/session/logout' && method === 'POST') {
        invalidateAdminSession(request);
        return json({ ok: true });
      }

      if (url.pathname === '/api/portal/login' && method === 'POST') {
        const body = await safeJson(request);
        const email = String(body?.email || '').trim().toLowerCase();
        const token = String(body?.token || '').trim();

        if (!email || !token) {
          return json({ ok: false, error: 'Email e token são obrigatórios.' }, 400);
        }

        const student = await env.DB.prepare(
          `SELECT name, email, plan_type, plan FROM student_access WHERE lower(email)=? AND access_token=? AND status='ACTIVE'`
        ).bind(email, token).first();

        if (!student) {
          await logOperationalEvent(env.DB, {
            level: 'warn',
            area: 'student',
            event: 'student_login_failed',
            route: url.pathname,
            method,
            student_email: email,
            message: 'Credenciais inválidas.'
          });
          return json({ ok: false, error: 'Credenciais inválidas.' }, 401);
        }

        return json({
          ok: true,
          data: {
            name: student.name,
            email: student.email,
            planType: student.plan_type || 'PREMIUM',
            plan: normalizeStudentPlan(student.plan)
          }
        });
      }

      if (url.pathname.startsWith('/api/portal/') || url.pathname.startsWith('/api/project-lm/') || url.pathname.startsWith('/api/project-lm-2/')) {
        const auth = await validateStudent(request, env.DB);
        if (!auth.ok) {
          await logOperationalEvent(env.DB, {
            level: 'warn',
            area: 'student',
            event: 'validate_student_failed',
            route: url.pathname,
            method,
            student_email: request.headers.get('x-student-email'),
            message: auth.error
          });
          const isLm2Route = url.pathname.startsWith('/api/project-lm-2/');
          return json({ ok: false, error: isLm2Route ? 'Unauthorized' : auth.error }, 401);
        }

        const studentEmail = auth.student.email;
        const blockProjectLmOnPremiumCore = () => {
          if (!isPremiumPortalStudent(auth.student)) {
            return json({ ok: false, error: 'Recurso disponível apenas para alunos Premium.' }, 403);
          }
          return null;
        };


        if (url.pathname === '/api/project-lm-2/onboarding' && method === 'POST') {
          if (!isProjectLmPlan(auth.student)) return json(projectLm2Error('Recurso disponível apenas para Projeto LM.', 403, 'PROJECT_LM_ONLY').payload, 403);
          const body = await safeJson(request);
          const result = await projectLm2SaveOnboarding(env.DB, auth.student, body);
          return json(result.payload, result.status);
        }

        if (url.pathname === '/api/project-lm-2/profile' && method === 'PUT') {
          if (!isProjectLmPlan(auth.student)) return json(projectLm2Error('Recurso disponível apenas para Projeto LM.', 403, 'PROJECT_LM_ONLY').payload, 403);
          const body = await safeJson(request);
          const result = await projectLm2SaveOnboarding(env.DB, auth.student, body);
          return json(result.payload, result.status);
        }

        if (url.pathname === '/api/project-lm-2/home' && method === 'GET') {
          if (!isProjectLmPlan(auth.student)) return json(projectLm2Error('Recurso disponível apenas para Projeto LM.', 403, 'PROJECT_LM_ONLY').payload, 403);
          const result = await projectLm2GetHome(env.DB, auth.student);
          return json(result.payload, result.status);
        }

        if (url.pathname === '/api/project-lm-2/training' && method === 'GET') {
          if (!isProjectLmPlan(auth.student)) return json(projectLm2Error('Recurso disponível apenas para Projeto LM.', 403, 'PROJECT_LM_ONLY').payload, 403);
          const result = await projectLm2GetTraining(env.DB, auth.student);
          return json(result.payload, result.status);
        }

        if (url.pathname === '/api/project-lm-2/checkin' && method === 'POST') {
          if (!isProjectLmPlan(auth.student)) return json(projectLm2Error('Recurso disponível apenas para Projeto LM.', 403, 'PROJECT_LM_ONLY').payload, 403);
          const body = await safeJson(request);
          const result = await projectLm2SaveCheckin(env.DB, auth.student, body);
          return json(result.payload, result.status);
        }

        if (url.pathname === '/api/project-lm-2/progress' && method === 'GET') {
          if (!isProjectLmPlan(auth.student)) return json(projectLm2Error('Recurso disponível apenas para Projeto LM.', 403, 'PROJECT_LM_ONLY').payload, 403);
          const result = await projectLm2GetProgress(env.DB, auth.student);
          return json(result.payload, result.status);
        }

        if (url.pathname === '/api/project-lm-2/week-status' && method === 'GET') {
          if (!isProjectLmPlan(auth.student)) return json(projectLm2Error('Recurso disponível apenas para Projeto LM.', 403, 'PROJECT_LM_ONLY').payload, 403);
          const result = await projectLm2GetWeekStatus(env.DB, auth.student);
          return json(result.payload, result.status);
        }

        if (url.pathname === '/api/project-lm-2/week-1/video-complete' && method === 'POST') {
          if (!isProjectLmPlan(auth.student)) return json(projectLm2Error('Recurso disponível apenas para Projeto LM.', 403, 'PROJECT_LM_ONLY').payload, 403);
          const result = await projectLm2CompleteWeek1Video(env.DB, auth.student);
          return json(result.payload, result.status);
        }

        if (url.pathname === '/api/project-lm-2/plan-b' && method === 'POST') {
          if (!isProjectLmPlan(auth.student)) return json(projectLm2Error('Recurso disponível apenas para Projeto LM.', 403, 'PROJECT_LM_ONLY').payload, 403);
          const body = await safeJson(request);
          const result = await projectLm2SavePlanB(env.DB, auth.student, body);
          return json(result.payload, result.status);
        }

        if (url.pathname === '/api/project-lm-2/activate-week-2' && method === 'POST') {
          if (!isProjectLmPlan(auth.student)) return json(projectLm2Error('Recurso disponível apenas para Projeto LM.', 403, 'PROJECT_LM_ONLY').payload, 403);
          const result = await projectLm2ActivateWeek2(env.DB, auth.student);
          return json(result.payload, result.status);
        }

        if (url.pathname === '/api/project-lm-2/week-2/video-complete' && method === 'POST') {
          if (!isProjectLmPlan(auth.student)) return json(projectLm2Error('Recurso disponível apenas para Projeto LM.', 403, 'PROJECT_LM_ONLY').payload, 403);
          const result = await projectLm2CompleteWeek2Video(env.DB, auth.student);
          return json(result.payload, result.status);
        }

        if (url.pathname === '/api/project-lm-2/week-2/reflection' && method === 'POST') {
          if (!isProjectLmPlan(auth.student)) return json(projectLm2Error('Recurso disponível apenas para Projeto LM.', 403, 'PROJECT_LM_ONLY').payload, 403);
          const body = await safeJson(request);
          const result = await projectLm2SaveWeek2Reflection(env.DB, auth.student, body);
          return json(result.payload, result.status);
        }

        if (url.pathname === '/api/project-lm-2/week-2/status' && method === 'GET') {
          if (!isProjectLmPlan(auth.student)) return json(projectLm2Error('Recurso disponível apenas para Projeto LM.', 403, 'PROJECT_LM_ONLY').payload, 403);
          const result = await projectLm2GetWeek2Status(env.DB, auth.student);
          return json(result.payload, result.status);
        }

        if (url.pathname === '/api/project-lm-2/activate-week-3' && method === 'POST') {
          if (!isProjectLmPlan(auth.student)) return json(projectLm2Error('Recurso disponível apenas para Projeto LM.', 403, 'PROJECT_LM_ONLY').payload, 403);
          const result = await projectLm2ActivateWeek3(env.DB, auth.student);
          return json(result.payload, result.status);
        }

        if (url.pathname === '/api/project-lm-2/week-3/video-complete' && method === 'POST') {
          if (!isProjectLmPlan(auth.student)) return json(projectLm2Error('Recurso disponível apenas para Projeto LM.', 403, 'PROJECT_LM_ONLY').payload, 403);
          const result = await projectLm2CompleteWeekVideo(env.DB, auth.student, 3);
          return json(result.payload, result.status);
        }

        if (url.pathname === '/api/project-lm-2/week-3/reflection' && method === 'POST') {
          if (!isProjectLmPlan(auth.student)) return json(projectLm2Error('Recurso disponível apenas para Projeto LM.', 403, 'PROJECT_LM_ONLY').payload, 403);
          const body = await safeJson(request);
          const result = await projectLm2SaveWeekReflection(env.DB, auth.student, body, 3);
          return json(result.payload, result.status);
        }

        if (url.pathname === '/api/project-lm-2/week-3/complete' && method === 'POST') {
          if (!isProjectLmPlan(auth.student)) return json(projectLm2Error('Recurso disponível apenas para Projeto LM.', 403, 'PROJECT_LM_ONLY').payload, 403);
          const result = await projectLm2CompleteWeek(env.DB, auth.student, 3);
          return json(result.payload, result.status);
        }

        if (url.pathname === '/api/project-lm-2/week-4/video-complete' && method === 'POST') {
          if (!isProjectLmPlan(auth.student)) return json(projectLm2Error('Recurso disponível apenas para Projeto LM.', 403, 'PROJECT_LM_ONLY').payload, 403);
          const result = await projectLm2CompleteWeekVideo(env.DB, auth.student, 4);
          return json(result.payload, result.status);
        }

        if (url.pathname === '/api/project-lm-2/week-4/reflection' && method === 'POST') {
          if (!isProjectLmPlan(auth.student)) return json(projectLm2Error('Recurso disponível apenas para Projeto LM.', 403, 'PROJECT_LM_ONLY').payload, 403);
          const body = await safeJson(request);
          const result = await projectLm2SaveWeekReflection(env.DB, auth.student, body, 4);
          return json(result.payload, result.status);
        }

        if (url.pathname === '/api/project-lm-2/week-4/complete' && method === 'POST') {
          if (!isProjectLmPlan(auth.student)) return json(projectLm2Error('Recurso disponível apenas para Projeto LM.', 403, 'PROJECT_LM_ONLY').payload, 403);
          const result = await projectLm2CompleteWeek(env.DB, auth.student, 4);
          return json(result.payload, result.status);
        }

        if (url.pathname === '/api/project-lm-2/program-completion' && method === 'POST') {
          if (!isProjectLmPlan(auth.student)) return json(projectLm2Error('Recurso disponível apenas para Projeto LM.', 403, 'PROJECT_LM_ONLY').payload, 403);
          const result = await projectLm2CompleteProgram(env.DB, auth.student);
          return json(result.payload, result.status);
        }

        if (url.pathname === '/api/project-lm/journey' && method === 'GET') {
          if (!isProjectLmPlan(auth.student)) return json(projectLmV5Error('Recurso disponível apenas para Projeto LM.', 403, 'PROJECT_LM_ONLY').payload, 403);
          const journey = await projectLmV5GetOrCreateJourney(env.DB, auth.student);
          return json({ ok: true, data: projectLmV5BuildContract(journey) });
        }

        if (url.pathname === '/api/project-lm/stage-1/actions' && method === 'POST') {
          if (!isProjectLmPlan(auth.student)) return json(projectLmV5Error('Recurso disponível apenas para Projeto LM.', 403, 'PROJECT_LM_ONLY').payload, 403);
          const body = await safeJson(request);
          const result = await projectLmV5CreateStage1Actions(env.DB, auth.student, body?.actions);
          return json(result.payload, result.status);
        }

        const stage1CompleteMatch = url.pathname.match(/^\/api\/project-lm\/stage-1\/actions\/([^/]+)\/complete$/);
        if (stage1CompleteMatch && method === 'POST') {
          if (!isProjectLmPlan(auth.student)) return json(projectLmV5Error('Recurso disponível apenas para Projeto LM.', 403, 'PROJECT_LM_ONLY').payload, 403);
          const result = await projectLmV5CompleteStage1Action(env.DB, auth.student, decodeURIComponent(stage1CompleteMatch[1] || ''));
          return json(result.payload, result.status);
        }

        if (url.pathname === '/api/project-lm/plan-b' && method === 'POST') {
          if (!isProjectLmPlan(auth.student)) return json(projectLmV5Error('Recurso disponível apenas para Projeto LM.', 403, 'PROJECT_LM_ONLY').payload, 403);
          const body = await safeJson(request);
          const result = await projectLmV5SavePlanB(env.DB, auth.student, body);
          return json(result.payload, result.status);
        }

        if (url.pathname === '/api/project-lm/victories' && method === 'POST') {
          if (!isProjectLmPlan(auth.student)) return json(projectLmV5Error('Recurso disponível apenas para Projeto LM.', 403, 'PROJECT_LM_ONLY').payload, 403);
          const body = await safeJson(request);
          const result = await projectLmV5CreateVictory(env.DB, auth.student, body);
          return json(result.payload, result.status);
        }

        if (url.pathname === '/api/project-lm/recovery' && method === 'POST') {
          if (!isProjectLmPlan(auth.student)) return json(projectLmV5Error('Recurso disponível apenas para Projeto LM.', 403, 'PROJECT_LM_ONLY').payload, 403);
          const body = await safeJson(request);
          const result = await projectLmV5SaveRecovery(env.DB, auth.student, body);
          return json(result.payload, result.status);
        }

        if (url.pathname === '/api/project-lm/maintenance-goals' && method === 'POST') {
          if (!isProjectLmPlan(auth.student)) return json(projectLmV5Error('Recurso disponível apenas para Projeto LM.', 403, 'PROJECT_LM_ONLY').payload, 403);
          const body = await safeJson(request);
          const result = await projectLmV5CreateMaintenanceGoal(env.DB, auth.student, body);
          return json(result.payload, result.status);
        }

        if (url.pathname === '/api/portal/me' && method === 'GET') {
          return json({ ok: true, data: auth.student });
        }

        if ((url.pathname === '/api/project-lm/profile' || url.pathname === '/api/portal/project-lm/profile') && method === 'GET') {
          const profile = await getProjectLmProfile(env.DB, auth.student.id);
          return json({ success: true, ok: true, profile, data: profile });
        }

        if (url.pathname === '/api/portal/project-lm/current-mission' && method === 'GET') {
          if (!canUseProjectLmProgress(auth.student)) {
            return json({ ok: false, error: 'Recurso disponível apenas para Projeto LM ou Premium.' }, 403);
          }

          const mission = await getProjectLmCurrentMission(env.DB, auth.student.id);
          return json({ ok: true, data: mission });
        }

        if (url.pathname === '/api/portal/project-lm/daily-actions/summary' && method === 'GET') {
          if (!canUseProjectLmProgress(auth.student)) {
            return json({ ok: false, error: 'Recurso disponível apenas para Projeto LM ou Premium.' }, 403);
          }

          const summary = await getProjectLmDailyActionsSummary(env.DB, studentEmail);
          return json({ ok: true, data: summary });
        }

        if (url.pathname === '/api/portal/project-lm/consistency' && method === 'GET') {
          if (!canUseProjectLmProgress(auth.student)) {
            return json({ ok: false, error: 'Recurso disponível apenas para Projeto LM ou Premium.' }, 403);
          }

          const consistency = await getProjectLmConsistency(env.DB, studentEmail);
          return json({ ok: true, data: consistency });
        }


        if (url.pathname === '/api/portal/project-lm/library' && method === 'GET') {
          if (!canUseProjectLmProgress(auth.student)) {
            return json({ ok: false, error: 'Recurso disponível apenas para Projeto LM ou Premium.' }, 403);
          }

          const library = await getProjectLmLibrary(env.DB, studentEmail);
          return json({ ok: true, data: library });
        }

        if (/^\/api\/portal\/project-lm\/library\/[^/]+$/.test(url.pathname) && method === 'GET') {
          if (!canUseProjectLmProgress(auth.student)) {
            return json({ ok: false, error: 'Recurso disponível apenas para Projeto LM ou Premium.' }, 403);
          }

          const slug = decodeURIComponent(url.pathname.split('/').at(-1) || '').trim();
          const content = await getProjectLmLibraryContent(env.DB, studentEmail, slug);
          if (!content) return json({ ok: false, error: 'Conteúdo não encontrado.' }, 404);
          if (content.locked) return json({ ok: false, error: 'Conteúdo bloqueado para o seu momento atual.', data: content }, 403);
          return json({ ok: true, data: content });
        }

        if (url.pathname === '/api/portal/project-lm/library/complete' && method === 'POST') {
          if (!canUseProjectLmProgress(auth.student)) {
            return json({ ok: false, error: 'Recurso disponível apenas para Projeto LM ou Premium.' }, 403);
          }

          const body = await safeJson(request);
          const slug = nullableTrimmed(body?.slug);
          if (!slug) return json({ ok: false, error: 'slug é obrigatório.' }, 400);

          const content = await getProjectLmLibraryContent(env.DB, studentEmail, slug);
          if (!content) return json({ ok: false, error: 'Conteúdo não encontrado.' }, 404);
          if (content.locked) return json({ ok: false, error: 'Conteúdo bloqueado para o seu momento atual.' }, 403);

          const completed = await completeProjectLmLibraryContent(env.DB, studentEmail, slug);
          return json({ ok: true, data: completed });
        }

        if (url.pathname === '/api/portal/project-lm/daily-actions' && method === 'POST') {
          if (!canUseProjectLmProgress(auth.student)) {
            return json({ ok: false, error: 'Recurso disponível apenas para Projeto LM ou Premium.' }, 403);
          }

          const body = await safeJson(request);
          const actionType = nullableTrimmed(body?.actionType);

          if (!PROJECT_LM_DAILY_ACTION_TYPES.has(actionType)) {
            return json({ ok: false, error: 'actionType inválido.' }, 400);
          }

          const actionDate = formatDateOnly(new Date());
          const existing = await env.DB.prepare(
            `SELECT id, created_at
             FROM project_lm_daily_actions
             WHERE lower(student_email)=? AND action_date=? AND action_type=?
             LIMIT 1`
          ).bind(studentEmail.toLowerCase(), actionDate, actionType).first();

          if (existing) {
            return json({ ok: true, data: { id: existing.id, actionDate, actionType, alreadyCompleted: true } });
          }

          const id = crypto.randomUUID();
          const now = new Date().toISOString();
          await env.DB.prepare(
            `INSERT INTO project_lm_daily_actions (
              id, student_email, action_date, action_type, completed, created_at
            ) VALUES (?, ?, ?, ?, 1, ?)`
          ).bind(id, studentEmail, actionDate, actionType, now).run();

          return json({ ok: true, data: { id, actionDate, actionType, alreadyCompleted: false } });
        }

        if ((url.pathname === '/api/project-lm/profile' || url.pathname === '/api/portal/project-lm/profile') && method === 'POST') {
          if (!isProjectLmPlan(auth.student)) {
            return json({ success: false, ok: false, error: 'Recurso disponível apenas para Projeto LM.' }, 403);
          }

          const body = await safeJson(request);
          const validation = validateProjectLmProfilePayload(body);

          if (!validation.ok) {
            return json({ success: false, ok: false, error: validation.error }, 400);
          }

          const existing = await getProjectLmProfile(env.DB, auth.student.id);
          if (existing) {
            return json({ success: true, ok: true, profile: existing, data: existing });
          }

          const { name, objective, goal, sex, weightKg, heightCm } = validation.profile;
          const initialPlanCode = getInitialPlanCode(sex, weightKg);
          const now = new Date().toISOString();
          await env.DB.prepare(
            `INSERT INTO project_lm_profiles (user_id, name, goal, objective, sex, weight_kg, height_cm, nutrition_plan_code, initial_plan_code, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(auth.student.id, name, goal, objective, sex, weightKg, heightCm, initialPlanCode, initialPlanCode, now, now).run();

          const profile = await getProjectLmProfile(env.DB, auth.student.id);
          return json({ success: true, ok: true, profile, data: profile });
        }

        if (url.pathname === '/api/portal/weekly-plan' && method === 'GET') {
          const premiumOnlyResponse = blockProjectLmOnPremiumCore();
          if (premiumOnlyResponse) return premiumOnlyResponse;
          const gate = await getPremiumGate(env.DB, studentEmail);
          if (!gate.released) return json(premiumLockedResponse(), 403);
          const weeklyPlan = await env.DB.prepare(
            `SELECT training_focus, cardio_target, nutrition_focus, main_risk, coach_message
             FROM weekly_plans
             WHERE student_email=? AND status='ACTIVE'
             ORDER BY updated_at DESC
             LIMIT 1`
          ).bind(studentEmail).first();

          return json({ ok: true, data: weeklyPlan || null });
        }


        if ((url.pathname === '/api/portal/nutrition-plan' || url.pathname === '/api/portal/premium/nutrition-plan/current') && method === 'GET') {
          const premiumOnlyResponse = blockProjectLmOnPremiumCore();
          if (premiumOnlyResponse) return premiumOnlyResponse;
          const gate = await getPremiumGate(env.DB, studentEmail);
          if (!gate.released) return json(premiumLockedResponse(), 403);
          const premiumApp = createPremiumApplication(env, request);
          const result = await premiumApp.getNutritionPlan.execute({ email: studentEmail, route: url.pathname, method });
          if (result.blocked) return json({ ok: false, error: 'Não foi possível acessar dados Premium com segurança.' }, 403);
          const plan = url.pathname === '/api/portal/premium/nutrition-plan/current' ? presentPublicNutritionPlan(result.record) : publicNutritionPlan(result.record);
          if (!plan) {
            return json({
              ok: true,
              data: null,
              message: 'Seu plano alimentar ainda não foi liberado no portal. Assim que estiver disponível, ele aparecerá aqui.'
            });
          }
          return json({ ok: true, data: plan });
        }

        if (url.pathname === '/api/portal/checkin' && method === 'POST') {
          const premiumOnlyResponse = blockProjectLmOnPremiumCore();
          if (premiumOnlyResponse) return premiumOnlyResponse;
          const gate = await getPremiumGate(env.DB, studentEmail);
          if (!gate.released) return json(premiumLockedResponse(), 403);
          const body = await safeJson(request);
          const now = new Date().toISOString();
          const weekRef = getWeekRef(new Date());
          const id = crypto.randomUUID();

          const premiumApp = createPremiumApplication(env, request);
          const submitResult = await premiumApp.submitWeeklyFeedback.execute({
            route: url.pathname,
            method,
            feedback: {
              id,
              student_email: studentEmail,
              week_ref: weekRef,
              training_adherence: body?.trainingAdherence || null,
              nutrition_adherence: body?.nutritionAdherence || null,
              cardio_adherence: body?.cardioAdherence || null,
              free_meals: body?.freeMeals || null,
              hunger_level: body?.hungerLevel || null,
              binge_or_snacking: body?.bingeOrSnacking || null,
              sleep_quality: body?.sleepQuality || null,
              energy_level: body?.energyLevel || null,
              stress_level: body?.stressLevel || null,
              weekly_weight: body?.weeklyWeight || null,
              waist: body?.waist || null,
              strength_status: body?.strengthStatus || null,
              main_difficulty: body?.mainDifficulty || null,
              routine_context: body?.routineContext || null,
              weekly_score: body?.weeklyScore || null,
              support_needed: body?.supportNeeded || null,
              created_at: now,
            }
          });
          if (submitResult.blocked) return json({ ok: false, error: submitResult.error || 'Não foi possível gravar dados Premium com segurança.' }, submitResult.status || 403);
          if (submitResult.ok === false) return json({ ok: false, error: submitResult.error || 'Não foi possível gravar dados Premium com segurança.' }, submitResult.status || 409);

          return json({ ok: true, data: { id: submitResult.saved?.id || id, weekRef, createdAt: now } });
        }

        if (url.pathname === '/api/portal/checkins' && method === 'GET') {
          const premiumOnlyResponse = blockProjectLmOnPremiumCore();
          if (premiumOnlyResponse) return premiumOnlyResponse;
          const gate = await getPremiumGate(env.DB, studentEmail);
          if (!gate.released) return json(premiumLockedResponse(), 403);
          const premiumApp = createPremiumApplication(env, request);
          const result = await premiumApp.listWeeklyFeedbacks.execute({ email: studentEmail, limit: 20, route: url.pathname, method });
          if (result.blocked) return json({ ok: false, error: 'Não foi possível acessar dados Premium com segurança.' }, 403);
          return json({ ok: true, data: (result.records || []).map(publicWeeklyFeedback) });
        }


        if (url.pathname === '/api/portal/premium/weekly-feedback/current' && method === 'GET') {
          const premiumOnlyResponse = blockProjectLmOnPremiumCore();
          if (premiumOnlyResponse) return premiumOnlyResponse;
          const gate = await getPremiumGate(env.DB, studentEmail);
          if (!gate.released) return json(premiumLockedResponse(), 403);
          const premiumApp = createPremiumApplication(env, request);
          const result = await premiumApp.getCurrentWeeklyFeedback({ email: studentEmail });
          if (result.blocked) return json({ ok: false, error: 'Não foi possível acessar dados Premium com segurança.' }, 403);
          const feedback = result.data.feedback;
          return json({ ok: true, data: { weekRef: result.data.weekRef, status: result.data.status, availableAt: result.data.availableAt, recommendedDeadline: result.data.recommendedDeadline, submittedAt: result.data.submittedAt, isLate: result.data.isLate, questions: feedback ? publicWeeklyFeedback(feedback) : {}, professionalResponse: feedback?.coach_reply ? { message: feedback.coach_reply, respondedAt: feedback.coach_reply_at } : null } });
        }

        if (url.pathname === '/api/portal/premium/weekly-feedback/current' && method === 'POST') {
          const premiumOnlyResponse = blockProjectLmOnPremiumCore();
          if (premiumOnlyResponse) return premiumOnlyResponse;
          const gate = await getPremiumGate(env.DB, studentEmail);
          if (!gate.released) return json(premiumLockedResponse(), 403);
          const body = await safeJson(request);
          const now = new Date().toISOString();
          const premiumApp = createPremiumApplication(env, request);
          const current = await premiumApp.getCurrentWeeklyFeedback({ email: studentEmail });
          if (current.blocked) return json({ ok: false, error: 'Não foi possível gravar dados Premium com segurança.' }, 403);
          if (current.data.status === 'NOT_AVAILABLE') return json({ ok: false, error: 'Seu Feedback Semanal ainda não está disponível.' }, 409);
          if (current.data.status === 'ANALYZED') return json({ ok: false, error: 'Este Feedback Semanal já foi analisado por Lucas.' }, 409);
          const id = current.data.feedback?.id || crypto.randomUUID();
          const submitResult = await premiumApp.submitWeeklyFeedback.execute({ route: url.pathname, method, feedback: { id, student_email: studentEmail, week_ref: current.data.weekRef, training_adherence: body?.trainingAdherence || null, nutrition_adherence: body?.nutritionAdherence || null, cardio_adherence: body?.cardioAdherence || null, free_meals: body?.freeMeals || null, hunger_level: body?.hungerLevel || null, binge_or_snacking: body?.bingeOrSnacking || null, sleep_quality: body?.sleepQuality || null, energy_level: body?.energyLevel || null, stress_level: body?.stressLevel || null, weekly_weight: body?.weeklyWeight || null, waist: body?.waist || null, strength_status: body?.strengthStatus || null, main_difficulty: body?.mainDifficulty || null, routine_context: body?.routineContext || null, weekly_score: body?.weeklyScore || null, support_needed: body?.supportNeeded || null, created_at: now, submitted_at: now, available_at: current.data.availableAt, updated_at: now } });
          if (submitResult.blocked) return json({ ok: false, error: submitResult.error || 'Não foi possível gravar dados Premium com segurança.' }, submitResult.status || 403);
          if (submitResult.ok === false) return json({ ok: false, error: submitResult.error || 'Não foi possível gravar dados Premium com segurança.' }, submitResult.status || 409);
          return json({ ok: true, data: { id: submitResult.saved?.id || id, weekRef: current.data.weekRef, submittedAt: now, status: 'RESPONDED' } });
        }

        if (url.pathname === '/api/portal/premium/weekly-feedback/history' && method === 'GET') {
          const premiumOnlyResponse = blockProjectLmOnPremiumCore();
          if (premiumOnlyResponse) return premiumOnlyResponse;
          const gate = await getPremiumGate(env.DB, studentEmail);
          if (!gate.released) return json(premiumLockedResponse(), 403);
          const premiumApp = createPremiumApplication(env, request);
          const result = await premiumApp.listWeeklyFeedbacks.execute({ email: studentEmail, limit: 12, route: url.pathname, method });
          if (result.blocked) return json({ ok: false, error: 'Não foi possível acessar dados Premium com segurança.' }, 403);
          return json({ ok: true, data: (result.records || []).map(publicWeeklyFeedback) });
        }

        if (url.pathname === '/api/portal/progression' && method === 'POST') {
          const premiumOnlyResponse = blockProjectLmOnPremiumCore();
          if (premiumOnlyResponse) return premiumOnlyResponse;
          const gate = await getPremiumGate(env.DB, studentEmail);
          if (!gate.released) return json(premiumLockedResponse(), 403);
          const body = await safeJson(request);
          const id = crypto.randomUUID();
          const now = new Date().toISOString();

          await env.DB.prepare(
            `INSERT INTO progression_logs (
              id, student_email, exercise, target_zone, load_used, reps_done, rir, decision, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            id,
            studentEmail,
            body?.exercise || 'Exercício',
            body?.targetZone || '8–10',
            Number(body?.loadUsed || 0),
            Number(body?.repsDone || 0),
            body?.rir || 'Não sei',
            body?.decision || 'Manter carga',
            now
          ).run();
          await logActivityEvent(env.DB, { student_email: studentEmail, event_type: EVENT_TYPES.PROGRESSION_LOG_SUBMITTED, source: 'portal', title: 'Progresso registrado', payload: { progression_id: id } });

          return json({ ok: true, data: { id, createdAt: now } });
        }

        if (url.pathname === '/api/portal/progression' && method === 'GET') {
          const premiumOnlyResponse = blockProjectLmOnPremiumCore();
          if (premiumOnlyResponse) return premiumOnlyResponse;
          const gate = await getPremiumGate(env.DB, studentEmail);
          if (!gate.released) return json(premiumLockedResponse(), 403);
          const { results } = await env.DB.prepare(
            `SELECT * FROM progression_logs WHERE student_email=? ORDER BY created_at DESC LIMIT 30`
          ).bind(studentEmail).all();

          return json({ ok: true, data: results || [] });
        }
      }

      if (url.pathname.startsWith('/api/admin/')) {
        if (!isAdminAuthorized(request, env)) {
          await logOperationalEvent(env.DB, {
            level: 'warn',
            area: 'admin',
            event: 'admin_unauthorized',
            route: url.pathname,
            method,
            admin_context: request.headers.get('x-admin-user') || null,
            message: 'Tentativa admin não autorizada.'
          });
          return json({ ok: false, error: 'Unauthorized' }, 401);
        }


        if (url.pathname === '/api/admin/premium/workspace/summary' && method === 'GET') {
          const premiumApp = createPremiumApplication(env, request);
          const result = await premiumApp.getProfessionalWorkspaceSummary({ featureEnabled: env.PREMIUM_PROFESSIONAL_WORKSPACE_ENABLED === 'true' });
          return json(result.ok ? { ok: true, data: presentWorkspaceSummary(result.data) } : { ok: false, error: result.error }, result.status || 200);
        }
        if (url.pathname === '/api/admin/premium/workspace/students' && method === 'GET') {
          const premiumApp = createPremiumApplication(env, request);
          const params = Object.fromEntries(url.searchParams.entries());
          const result = await premiumApp.listProfessionalWorkspaceStudents(params);
          return json(result.ok ? { ok: true, data: { ...result.data, items: result.data.items.map(presentWorkspaceStudentSummary) } } : { ok: false, error: result.error }, result.status || 200);
        }
        if (url.pathname === '/api/admin/premium/workspace/students/search' && method === 'GET') {
          const premiumApp = createPremiumApplication(env, request);
          const result = await premiumApp.searchProfessionalWorkspaceStudents({ q: url.searchParams.get('q') || '', limit: url.searchParams.get('limit') || 20 });
          return json(result.ok ? { ok: true, data: { ...result.data, items: result.data.items.map(presentWorkspaceStudentSummary) } } : { ok: false, error: result.error }, result.status || 200);
        }
        const workspaceStudentMatch = url.pathname.match(/^\/api\/admin\/premium\/workspace\/students\/([^/]+)$/);
        if (workspaceStudentMatch && method === 'GET') {
          const premiumApp = createPremiumApplication(env, request);
          const result = await premiumApp.getProfessionalWorkspaceStudent(decodeURIComponent(workspaceStudentMatch[1]));
          return json(result.ok && result.data ? { ok: true, data: presentWorkspaceStudentContext(result.data) } : { ok: false, error: 'Aluno não encontrado' }, result.data ? 200 : 404);
        }

        if (url.pathname === '/api/admin/premium/workspace/students' && method === 'POST') {
          const body = await safeJson(request);
          const name = nullableTrimmed(body?.name);
          const email = nullableTrimmed(body?.email)?.toLowerCase();
          if (!name || !email) return json({ ok: false, error: 'Nome e e-mail são obrigatórios.' }, 400);
          const now = new Date().toISOString();
          const existing = await env.DB.prepare(`SELECT id, student_id, access_token FROM student_access WHERE lower(email)=? LIMIT 1`).bind(email).first();
          const project = await env.DB.prepare(`SELECT id FROM student_access WHERE lower(email)=? AND (lower(coalesce(plan,''))='projeto_lm' OR lower(coalesce(plan_type,''))='project_lm') LIMIT 1`).bind(email).first();
          if (project) return json({ ok: false, error: 'Este e-mail pertence ao Projeto LM e não pode ser cadastrado no Workspace Premium.' }, 409);
          const ps = await env.DB.prepare(`SELECT student_id FROM premium_students WHERE normalized_email=? LIMIT 1`).bind(email).first();
          if (existing && ps) return json({ ok: false, error: 'Aluno Premium já cadastrado.' }, 409);
          const studentId = existing?.student_id || ps?.student_id || crypto.randomUUID();
          const token = existing?.access_token || generateAccessToken();
          if (existing) await env.DB.prepare(`UPDATE student_access SET name=?, whatsapp=coalesce(?, whatsapp), plan='premium', plan_type='PREMIUM', status='ACTIVE', student_id=? WHERE id=?`).bind(name, normalizeWhatsapp(body?.whatsapp), studentId, existing.id).run();
          else await env.DB.prepare(`INSERT INTO student_access (id,name,email,access_token,status,plan_type,plan,whatsapp,student_id,created_at) VALUES (?,?,?,?, 'ACTIVE','PREMIUM','premium',?,?,?)`).bind(crypto.randomUUID(), name, email, token, normalizeWhatsapp(body?.whatsapp), studentId, now).run();
          await env.DB.prepare(`INSERT INTO premium_students (student_id,email,normalized_email,display_name,consultation_status,access_status,source,created_at,updated_at) VALUES (?,?,?,?, 'AWAITING_ANAMNESIS','ACTIVE','WORKSPACE',?,?) ON CONFLICT(student_id) DO UPDATE SET display_name=excluded.display_name,email=excluded.email,normalized_email=excluded.normalized_email,updated_at=excluded.updated_at`).bind(studentId, email, email, name, now, now).run();
          return json({ ok: true, data: { studentId, name, email, status: 'AWAITING_ANAMNESIS', statusLabel: 'Aguardando anamnese', accessLink: `${url.origin}/portal-login.html`, token } }, existing ? 200 : 201);
        }
        const workspaceActionMatch = url.pathname.match(/^\/api\/admin\/premium\/workspace\/students\/([^/]+)\/(mark-ready|release|pause)$/);
        if (workspaceActionMatch && method === 'POST') {
          const studentId = decodeURIComponent(workspaceActionMatch[1]); const action = workspaceActionMatch[2]; const now = new Date().toISOString();
          const current = await env.DB.prepare(`SELECT student_id, email, normalized_email, consultation_status FROM premium_students WHERE student_id=? OR normalized_email=? LIMIT 1`).bind(studentId, studentId.toLowerCase()).first();
          if (!current) return json({ ok: false, error: 'Aluno não encontrado.' }, 404);
          if (action === 'mark-ready') {
            if (current.consultation_status !== 'UNDER_REVIEW') return json({ ok: false, error: 'Só é possível marcar como pronto quando o planejamento está em preparação.' }, 409);
            await env.DB.prepare(`UPDATE premium_students SET consultation_status='READY_TO_RELEASE', updated_at=? WHERE student_id=?`).bind(now, current.student_id).run();
          }
          if (action === 'pause') {
            if (current.consultation_status !== 'ACTIVE') return json({ ok: false, error: 'Só é possível pausar um acompanhamento ativo.' }, 409);
            await env.DB.prepare(`UPDATE premium_students SET consultation_status='PAUSED', updated_at=? WHERE student_id=?`).bind(now, current.student_id).run();
          }
          if (action === 'release') {
            if (current.consultation_status === 'ACTIVE') return json({ ok: true, data: { studentId: current.student_id, action, updatedAt: now, idempotent: true } });
            if (current.consultation_status !== 'READY_TO_RELEASE') return json({ ok: false, error: 'O acompanhamento só pode ser liberado depois que o planejamento for marcado como pronto.' }, 409);
            await env.DB.prepare(`UPDATE premium_students SET consultation_status='ACTIVE', updated_at=? WHERE student_id=?`).bind(now, current.student_id).run();
          }
          return json({ ok: true, data: { studentId: current.student_id, action, updatedAt: now } });
        }
        if (url.pathname === '/api/admin/premium/workspace/pending-items' && method === 'GET') {
          const premiumApp = createPremiumApplication(env, request);
          const result = await premiumApp.listProfessionalWorkspacePendingItems(Object.fromEntries(url.searchParams.entries()));
          return json(result.ok ? { ok: true, data: { ...result.data, items: presentWorkspacePendingItems(result.data.items) } } : { ok: false, error: result.error }, result.status || 200);
        }
        if (url.pathname === '/api/admin/premium/workspace/saturday-review' && method === 'GET') {
          const premiumApp = createPremiumApplication(env, request);
          const result = await premiumApp.getSaturdayReviewSummary({});
          return json(result.ok ? { ok: true, data: presentSaturdayReview(result.data) } : { ok: false, error: result.error }, result.status || 200);
        }


        const premiumRecordMatch = url.pathname.match(/^\/api\/admin\/premium\/students\/([^/]+)\/record$/);
        if (premiumRecordMatch && method === 'GET') {
          const premiumApp = createPremiumApplication(env, request);
          const result = await premiumApp.getStudentRecord({ student_id: decodeURIComponent(premiumRecordMatch[1]) });
          return json(result.ok ? { ok: true, data: presentStudentRecord(result.data) } : { ok: false, error: result.error }, result.status || 200);
        }

        const followupEntryMatch = url.pathname.match(/^\/api\/admin\/premium\/students\/([^/]+)\/followup-entries$/);
        if (followupEntryMatch && method === 'POST') {
          const premiumApp = createPremiumApplication(env, request);
          const body = await safeJson(request);
          const result = await premiumApp.addFollowupEntry({ ...body, student_id: decodeURIComponent(followupEntryMatch[1]), created_by: request.headers.get('x-admin-user') || 'admin' });
          return json(result.ok ? { ok: true, data: result.data } : { ok: false, error: result.error }, result.status || 201);
        }

        const pendingItemMatch = url.pathname.match(/^\/api\/admin\/premium\/students\/([^/]+)\/pending-items$/);
        if (pendingItemMatch && method === 'POST') {
          const premiumApp = createPremiumApplication(env, request);
          const body = await safeJson(request);
          const result = await premiumApp.createPendingItem({ ...body, student_id: decodeURIComponent(pendingItemMatch[1]), created_by: request.headers.get('x-admin-user') || 'admin' });
          return json(result.ok ? { ok: true, data: result.data } : { ok: false, error: result.error }, result.status || 201);
        }

        const resolvePendingMatch = url.pathname.match(/^\/api\/admin\/premium\/pending-items\/([^/]+)\/resolve$/);
        if (resolvePendingMatch && method === 'PATCH') {
          const premiumApp = createPremiumApplication(env, request);
          const result = await premiumApp.resolvePendingItem({ id: decodeURIComponent(resolvePendingMatch[1]), created_by: request.headers.get('x-admin-user') || 'admin' });
          return json(result.ok ? { ok: true, data: result.data } : { ok: false, error: result.error }, result.status || 200);
        }

        const statusMatch = url.pathname.match(/^\/api\/admin\/premium\/students\/([^/]+)\/status$/);
        if (statusMatch && method === 'PATCH') {
          const premiumApp = createPremiumApplication(env, request);
          const body = await safeJson(request);
          const result = await premiumApp.updateConsultationStatus({ student_id: decodeURIComponent(statusMatch[1]), status: body?.status, created_by: request.headers.get('x-admin-user') || 'admin' });
          return json(result.ok ? { ok: true, data: result.data } : { ok: false, error: result.error }, result.status || 200);
        }

        const decisionMatch = url.pathname.match(/^\/api\/admin\/premium\/feedbacks\/([^/]+)\/decision$/);
        if (decisionMatch && method === 'POST') {
          const premiumApp = createPremiumApplication(env, request);
          const body = await safeJson(request);
          const result = await premiumApp.recordProfessionalDecision({ feedback_id: decodeURIComponent(decisionMatch[1]), decision_type: body?.decision_type, note: body?.note, created_by: request.headers.get('x-admin-user') || 'admin' });
          return json(result.ok ? { ok: true, data: result.data } : { ok: false, error: result.error }, result.status || 200);
        }


        if (url.pathname === '/api/admin/endpoint-usage' && method === 'GET') {
          const daysRaw = Number(url.searchParams.get('days') || 14);
          const days = Number.isFinite(daysRaw) ? Math.min(Math.max(Math.trunc(daysRaw), 1), 90) : 14;
          const area = nullableTrimmed(url.searchParams.get('area'));
          const route = nullableTrimmed(url.searchParams.get('route'));
          const where = ["event='endpoint_used'", "datetime(created_at) >= datetime('now', ?)"];
          const params = [`-${days} days`];

          if (area) { where.push('area=?'); params.push(area); }
          if (route) { where.push('route=?'); params.push(route); }

          const { results = [] } = await env.DB.prepare(
            `SELECT route, method, area, COUNT(*) AS hits, MAX(created_at) AS last_seen_at
             FROM operational_logs
             WHERE ${where.join(' AND ')}
             GROUP BY route, method, area
             ORDER BY hits ASC, datetime(last_seen_at) DESC
             LIMIT 200`
          ).bind(...params).all();

          return json({ ok: true, data: { days, items: results || [] } });
        }


        if (url.pathname === '/api/admin/operational-logs' && method === 'GET') {
          const level = nullableTrimmed(url.searchParams.get('level'));
          const area = nullableTrimmed(url.searchParams.get('area'));
          const studentEmail = nullableTrimmed(url.searchParams.get('student_email'))?.toLowerCase() || null;
          const limitRaw = Number(url.searchParams.get('limit') || 50);
          const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.trunc(limitRaw), 1), 100) : 50;
          const where = [];
          const params = [];

          if (level) { where.push('level=?'); params.push(level); }
          if (area) { where.push('area=?'); params.push(area); }
          if (studentEmail) { where.push('lower(student_email)=?'); params.push(studentEmail); }

          const query = `SELECT id, created_at, level, area, event, route, method, student_email, admin_context, message, metadata
             FROM operational_logs
             ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
             ORDER BY datetime(created_at) DESC
             LIMIT ?`;
          const { results = [] } = await env.DB.prepare(query).bind(...params, limit).all();
          return json({ ok: true, data: { logs: results || [] } });
        }


        if (url.pathname === '/api/admin/health-check' && method === 'GET') {
          const data = await buildD1HealthCheck(env.DB);
          return json({ ok: true, data });
        }


        if (url.pathname === '/api/admin/students' && method === 'GET') {
          const search = String(url.searchParams.get('search') || '').trim().toLowerCase();
          const where = [];
          const params = [];
          if (search) {
            where.push(`(lower(name) LIKE ? OR lower(email) LIKE ? OR lower(COALESCE(whatsapp, '')) LIKE ?)`);
            const term = `%${search}%`;
            params.push(term, term, term);
          }

          const query = `SELECT name, email, status, plan_type, whatsapp
             FROM student_access
             ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
             ORDER BY CASE upper(status)
               WHEN 'ACTIVE' THEN 0
               WHEN 'PENDING_ONBOARDING' THEN 1
               WHEN 'INACTIVE' THEN 2
               ELSE 3
             END,
             lower(name) ASC
             LIMIT 100`;
          const { results = [] } = await env.DB.prepare(query).bind(...params).all();

          return json((results || []).map((student) => ({
            name: student.name || '',
            email: student.email || '',
            status: student.status || '',
            plan_type: student.plan_type || '',
            whatsapp: student.whatsapp || ''
          })));
        }


        if (url.pathname === '/api/admin/student-360' && method === 'GET') {
          const email = String(url.searchParams.get('email') || '').trim().toLowerCase();
          if (!email) {
            return json({ ok: false, error: 'email é obrigatório.' }, 400);
          }

          const studentAccess = await env.DB.prepare(
            `SELECT student_id, name, email, whatsapp, plan_type, status, access_token
             FROM student_access
             WHERE lower(email)=?
             LIMIT 1`
          ).bind(email).first();

          const latestAnamnesis = await env.DB.prepare(
            `SELECT id, student_name, student_email, student_phone, status, answers_json, internal_scores_json, created_at, updated_at
             FROM premium_anamnesis
             WHERE lower(student_email)=?
             ORDER BY created_at DESC
             LIMIT 1`
          ).bind(email).first();

          const latestCheckin = await env.DB.prepare(
            `SELECT id, student_email, week_ref, training_adherence, nutrition_adherence, cardio_adherence, free_meals, hunger_level,
                    binge_or_snacking, sleep_quality, energy_level, stress_level, weekly_weight, waist, strength_status,
                    main_difficulty, routine_context, weekly_score, support_needed, coach_status, coach_reply, coach_reply_at, created_at
             FROM student_checkins
             WHERE lower(student_email)=?
             ORDER BY created_at DESC
             LIMIT 1`
          ).bind(email).first();

          const activeWeeklyPlan = await env.DB.prepare(
            `SELECT id, student_email, week_ref, training_focus, cardio_target, nutrition_focus, main_risk, coach_message, status, updated_at
             FROM weekly_plans
             WHERE lower(student_email)=? AND week_ref=?
             ORDER BY updated_at DESC
             LIMIT 1`
          ).bind(email, getWeekRef(new Date())).first();

          const activeNutritionPlan = await getActiveNutritionPlanByEmail(env.DB, email);


          const latestWeeklyPlanByEmail = await env.DB.prepare(
            `SELECT id, student_email, week_ref, training_focus, cardio_target, nutrition_focus, main_risk, coach_message, status, updated_at
             FROM weekly_plans
             WHERE lower(student_email)=?
             ORDER BY updated_at DESC
             LIMIT 1`
          ).bind(email).first();

          const hasAnyData = Boolean(
            studentAccess
            || latestAnamnesis
            || latestCheckin
            || activeNutritionPlan
            || latestWeeklyPlanByEmail
          );

          if (!hasAnyData) {
            return json({ ok: false, error: 'Nenhum dado encontrado para este email. Verifique se há acesso, anamnese, check-in ou plano alimentar cadastrado.' }, 404);
          }

          const student = { ...buildStudentSummary({ studentAccess, latestAnamnesis, latestCheckin, activeNutritionPlan, email }), student_id: studentAccess?.student_id || latestAnamnesis?.student_id || latestCheckin?.student_id || activeNutritionPlan?.student_id || null };
          const timeline = buildBaseTimeline({ latestAnamnesis, latestCheckin, activeWeeklyPlan, activeNutritionPlan });

          const timelineType = String(url.searchParams.get('timeline_type') || '').trim().toUpperCase() || null;
          const timelineLimitRaw = Number(url.searchParams.get('timeline_limit') || 30);
          const timelineLimit = Number.isFinite(timelineLimitRaw) ? Math.min(Math.max(Math.trunc(timelineLimitRaw), 1), 100) : 30;
          const whereTimeline = ['lower(student_email)=?'];
          const timelineParams = [email];
          if (timelineType) { whereTimeline.push('event_type=?'); timelineParams.push(timelineType); }
          const { results: activityRows = [] } = await env.DB.prepare(`SELECT event_type, created_at, title, metadata_json FROM activity_timeline WHERE ${whereTimeline.join(' AND ')} ORDER BY datetime(created_at) DESC LIMIT ?`).bind(...timelineParams, timelineLimit).all();
          appendActivityRows(timeline, activityRows);

          const clinicalPriority = computeClinicalPriority(latestCheckin, activeWeeklyPlan);
          const nextRecommendedAction = computeNextRecommendedAction(latestCheckin, activeWeeklyPlan);

          

          return json({
            ok: true,
            data: {
              student,
              latest_anamnesis: latestAnamnesis || null,
              latest_checkin: latestCheckin || null,
              active_weekly_plan: activeWeeklyPlan || null,
              active_nutrition_plan: activeNutritionPlan || null,
              clinical_priority: clinicalPriority,
              next_recommended_action: nextRecommendedAction,
              timeline
            }
          });
        }

        if (url.pathname === '/api/admin/student-access' && method === 'POST') {
          const body = await safeJson(request);

          const name = String(body?.name || '').trim();
          const email = String(body?.email || '').trim().toLowerCase();
          const accessToken = String(body?.access_token || '').trim();
          const plan = normalizeStudentPlan(body?.plan);
          const planType = String(body?.plan_type || 'PREMIUM').trim();
          const status = String(body?.status || 'ACTIVE').trim();
          const whatsapp = normalizeWhatsapp(body?.whatsapp);

          if (!name || !email || !accessToken) {
            return json({
              ok: false,
              error: 'name, email e access_token são obrigatórios.'
            }, 400);
          }

          const existing = await env.DB.prepare(
            `SELECT id FROM student_access WHERE lower(email)=? LIMIT 1`
          ).bind(email).first();

          if (existing) {
            await env.DB.prepare(
              `UPDATE student_access
               SET name=?, access_token=?, plan_type=?, plan=?, status=?, whatsapp=?
               WHERE id=?`
            ).bind(
              name,
              accessToken,
              planType,
              plan,
              status,
              whatsapp,
              existing.id
            ).run();
          } else {
            await env.DB.prepare(
              `INSERT INTO student_access (
                id, name, email, access_token, plan_type, plan, status, whatsapp, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(
              crypto.randomUUID(),
              name,
              email,
              accessToken,
              planType,
              plan,
              status,
              whatsapp,
              new Date().toISOString()
            ).run();
          }

          return json({
            ok: true,
            data: {
              name,
              email,
              planType,
              plan,
              status,
              whatsapp
            }
          });
        }

        if (url.pathname === '/api/admin/student-access/token' && method === 'POST') {
          const body = await safeJson(request);
          const email = String(body?.email || '').trim().toLowerCase();
          if (!email) {
            return json({ ok: false, error: 'email é obrigatório.' }, 400);
          }

          const existing = await env.DB.prepare(
            `SELECT id FROM student_access WHERE lower(email)=? LIMIT 1`
          ).bind(email).first();

          if (!existing) {
            return json({ ok: false, error: 'Aluno não encontrado no student_access.' }, 404);
          }

          const accessToken = generateAccessToken();
          await env.DB.prepare(
            `UPDATE student_access SET access_token=? WHERE id=?`
          ).bind(accessToken, existing.id).run();

          await logActivityEvent(env.DB, {
            student_email: email,
            event_type: EVENT_TYPES.STUDENT_TOKEN_UPDATED,
            source: 'admin',
            title: 'Token de acesso atualizado',
            payload: { reason: 'Token regenerado pelo Student 360' }
          });

          return json({ ok: true, data: { email, access_token: accessToken, token: accessToken } });
        }

        if (url.pathname === '/api/admin/student-access/activate' && method === 'POST') {
          const body = await safeJson(request);
          const email = String(body?.email || '').trim().toLowerCase();
          if (!email) {
            return json({ ok: false, error: 'email é obrigatório.' }, 400);
          }

          const existing = await env.DB.prepare(
            `SELECT id, status FROM student_access WHERE lower(email)=? LIMIT 1`
          ).bind(email).first();

          if (!existing) {
            return json({ ok: false, error: 'Aluno não encontrado no student_access.' }, 404);
          }

          await env.DB.prepare(
            `UPDATE student_access SET status='ACTIVE' WHERE id=?`
          ).bind(existing.id).run();

          const previousStatus = String(existing.status || '').toUpperCase();
          if (previousStatus !== 'ACTIVE') {
            await logActivityEvent(env.DB, {
              student_email: email,
              event_type: EVENT_TYPES.STUDENT_REACTIVATED,
              source: 'admin',
              title: 'Acesso liberado',
              payload: { previous_status: previousStatus || null, new_status: 'ACTIVE', reason: 'Liberação manual pelo Student 360' }
            });
          }

          return json({ ok: true, data: { email, status: 'ACTIVE' } });
        }

        if (url.pathname === '/api/admin/student-access/status' && method === 'POST') {
          const body = await safeJson(request);
          const email = String(body?.email || '').trim().toLowerCase();
          const requestedStatus = String(body?.status || '').trim().toUpperCase();
          const reason = nullableTrimmed(body?.reason);
          if (!email) {
            return json({ ok: false, error: 'email é obrigatório.' }, 400);
          }
          if (!['ACTIVE', 'INACTIVE'].includes(requestedStatus)) {
            return json({ ok: false, error: 'status deve ser ACTIVE ou INACTIVE.' }, 400);
          }

          const existing = await env.DB.prepare(
            `SELECT id, status FROM student_access WHERE lower(email)=? LIMIT 1`
          ).bind(email).first();
          if (!existing) {
            return json({ ok: false, error: 'Aluno não encontrado no student_access.' }, 404);
          }

          await env.DB.prepare(
            `UPDATE student_access SET status=? WHERE id=?`
          ).bind(requestedStatus, existing.id).run();

          const previousStatus = String(existing.status || '').toUpperCase();
          if (previousStatus !== requestedStatus) {
            const eventType = requestedStatus === 'INACTIVE' ? EVENT_TYPES.STUDENT_INACTIVATED : EVENT_TYPES.STUDENT_REACTIVATED;
            const title = requestedStatus === 'INACTIVE' ? 'Aluno inativado' : 'Aluno reativado';
            await logActivityEvent(env.DB, {
              student_email: email,
              event_type: eventType,
              source: 'admin',
              title,
              payload: { previous_status: previousStatus || null, new_status: requestedStatus, reason: reason || null }
            });
          }

          return json({ ok: true, data: { email, status: requestedStatus, reason: reason || null } });
        }

        if (url.pathname === '/api/admin/reactivation-contact' && method === 'POST') {
          const body = await readJson(request);
          const email = String(body?.email || '').trim().toLowerCase();
          if (!email) {
            return json({ ok: false, error: 'email é obrigatório.' }, 400);
          }
          const reason = nullableTrimmed(body?.reason) || 'Contato de reativação enviado pelo Command Center';
          await logActivityEvent(env.DB, {
            student_email: email,
            event_type: EVENT_TYPES.REACTIVATION_CONTACT_SENT,
            source: 'admin',
            title: 'Contato de reativação enviado',
            payload: { reason }
          });

          return json({ ok: true, data: { email, event_type: EVENT_TYPES.REACTIVATION_CONTACT_SENT, reason } });
        }

        if (url.pathname === '/api/admin/followup-log' && method === 'POST') {
          const body = await safeJson(request);
          const studentEmail = String(body?.student_email || '').trim().toLowerCase();
          const contactType = String(body?.contact_type || 'WHATSAPP').trim().toUpperCase() || 'WHATSAPP';
          const reason = body?.reason == null ? null : String(body.reason).trim() || null;
          const note = body?.note == null ? null : String(body.note).trim() || null;
          const outcome = body?.outcome == null ? null : String(body.outcome).trim().toUpperCase() || null;
          const incomingRiskLevel = body?.risk_level == null ? null : String(body.risk_level).trim().toUpperCase() || null;
          const nextAction = body?.next_action == null ? null : String(body.next_action).trim().toUpperCase() || null;
          const riskLevel = incomingRiskLevel || inferRiskLevelFromOutcome(outcome);

          if (!studentEmail) {
            return json({ ok: false, error: 'student_email é obrigatório.' }, 400);
          }

          const id = crypto.randomUUID();
          const createdAt = new Date().toISOString();
          const dueDate = resolveDueDate(nextAction, createdAt);
          const resolutionStatus = resolveResolutionStatus(nextAction, dueDate);

          await env.DB.prepare(
            `INSERT INTO followup_logs (
              id, student_email, contact_type, reason, note, outcome, risk_level, next_action, due_date, resolution_status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(id, studentEmail, contactType, reason, note, outcome, riskLevel, nextAction, dueDate, resolutionStatus, createdAt).run();
          await logActivityEvent(env.DB, { student_email: studentEmail, event_type: EVENT_TYPES.FOLLOWUP_LOGGED, source: 'admin', title: 'Follow-up registrado', payload: { followup_id: id } });

          return json({
            ok: true,
            data: {
              id,
              student_email: studentEmail,
              contact_type: contactType,
              reason,
              note,
              outcome,
              risk_level: riskLevel,
              next_action: nextAction,
              due_date: dueDate,
              resolution_status: resolutionStatus,
              created_at: createdAt
            }
          });
        }

        if (url.pathname === '/api/admin/followup-logs' && method === 'GET') {
          const { results = [] } = await env.DB.prepare(
            `SELECT id, student_email, contact_type, reason, note, outcome, risk_level, next_action, due_date, resolved_at, resolution_status, created_at
             FROM followup_logs
             ORDER BY created_at DESC
             LIMIT 30`
          ).all();

          return json({ ok: true, data: results });
        }



        if (url.pathname === '/api/admin/followup-resolve' && method === 'POST') {
          const body = await safeJson(request);
          const followupId = String(body?.id || '').trim();
          const studentEmail = String(body?.student_email || '').trim().toLowerCase();
          const resolutionStatus = String(body?.resolution_status || 'RESOLVED').trim().toUpperCase() || 'RESOLVED';

          if (!followupId && !studentEmail) {
            return json({ ok: false, error: 'id ou student_email é obrigatório.' }, 400);
          }

          const now = new Date().toISOString();

          if (followupId) {
            await env.DB.prepare(
              `UPDATE followup_logs
               SET resolved_at=?, resolution_status=?
               WHERE id=?`
            ).bind(now, resolutionStatus, followupId).run();
          } else {
            await env.DB.prepare(
              `UPDATE followup_logs
               SET resolved_at=?, resolution_status=?
               WHERE lower(student_email)=?
                 AND (resolution_status IS NULL OR resolution_status='OPEN')`
            ).bind(now, resolutionStatus, studentEmail).run();
          }

          return json({
            ok: true,
            data: {
              id: followupId || null,
              student_email: studentEmail || null,
              resolved_at: now,
              resolution_status: resolutionStatus
            }
          });
        }

        if (url.pathname === '/api/admin/retention-action' && method === 'POST') {
          const body = await safeJson(request);
          const studentEmail = String(body?.student_email || '').trim().toLowerCase();
          const financialReason = body?.financial_reason == null ? null : String(body.financial_reason).trim() || null;
          const proposedAction = String(body?.proposed_action || '').trim().toUpperCase();
          const acceptedStatus = String(body?.accepted_status || 'OFFERED').trim().toUpperCase() || 'OFFERED';
          const note = body?.note == null ? null : String(body.note).trim() || null;

          if (!studentEmail || !proposedAction) {
            return json({ ok: false, error: 'student_email e proposed_action são obrigatórios.' }, 400);
          }

          if (!RETENTION_PROPOSED_ACTIONS.includes(proposedAction)) {
            return json({ ok: false, error: 'proposed_action inválido.' }, 400);
          }

          if (!RETENTION_ACCEPTED_STATUS.includes(acceptedStatus)) {
            return json({ ok: false, error: 'accepted_status inválido.' }, 400);
          }

          const id = crypto.randomUUID();
          const createdAt = new Date().toISOString();

          await env.DB.prepare(
            `INSERT INTO retention_actions (
              id, student_email, financial_reason, proposed_action, accepted_status, note, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`
          ).bind(id, studentEmail, financialReason, proposedAction, acceptedStatus, note, createdAt).run();

          return json({
            ok: true,
            data: {
              id,
              student_email: studentEmail,
              financial_reason: financialReason,
              proposed_action: proposedAction,
              accepted_status: acceptedStatus,
              note,
              created_at: createdAt
            }
          });
        }

        if (url.pathname === '/api/admin/retention-actions' && method === 'GET') {
          const { results = [] } = await env.DB.prepare(
            `SELECT student_email, financial_reason, proposed_action, accepted_status, note, created_at
             FROM retention_actions
             ORDER BY created_at DESC
             LIMIT 30`
          ).all();

          return json({ ok: true, data: results });
        }

        if (url.pathname === '/api/admin/weekly-plan' && method === 'POST') {
          const body = await safeJson(request);

          const studentEmail = String(body?.student_email || '').trim().toLowerCase();
          const weekRef = String(body?.week_ref || '').trim();

          if (!studentEmail || !weekRef) {
            return json({ ok: false, error: 'student_email e week_ref são obrigatórios.' }, 400);
          }

          const now = new Date().toISOString();

          const existing = await env.DB.prepare(
            `SELECT id FROM weekly_plans WHERE student_email=? AND week_ref=? LIMIT 1`
          ).bind(studentEmail, weekRef).first();

          const trainingFocus = body?.training_focus || null;
          const cardioTarget = body?.cardio_target || null;
          const nutritionFocus = body?.nutrition_focus || null;
          const mainRisk = body?.main_risk || null;
          const coachMessage = body?.coach_message || null;

          const id = existing?.id || crypto.randomUUID();

          if (existing) {
            await env.DB.prepare(
              `UPDATE weekly_plans
               SET training_focus=?, cardio_target=?, nutrition_focus=?, main_risk=?, coach_message=?, status='ACTIVE', updated_at=?
               WHERE id=?`
            ).bind(
              trainingFocus,
              cardioTarget,
              nutritionFocus,
              mainRisk,
              coachMessage,
              now,
              id
            ).run();
          } else {
            await env.DB.prepare(
              `INSERT INTO weekly_plans (
                id, student_email, week_ref, training_focus, cardio_target,
                nutrition_focus, main_risk, coach_message, status, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`
            ).bind(
              id,
              studentEmail,
              weekRef,
              trainingFocus,
              cardioTarget,
              nutritionFocus,
              mainRisk,
              coachMessage,
              now,
              now
            ).run();
          }

          await logActivityEvent(env.DB, { student_email: studentEmail, event_type: EVENT_TYPES.WEEKLY_PLAN_UPDATED, source: 'admin', title: 'Objetivo do planejamento atualizado', payload: { weekly_plan_id: id, week_ref: weekRef } });

          const saved = await env.DB.prepare(
            `SELECT id, student_email, week_ref, training_focus, cardio_target,
                    nutrition_focus, main_risk, coach_message, status, created_at, updated_at
             FROM weekly_plans
             WHERE id=?`
          ).bind(id).first();

          return json({ ok: true, data: saved });
        }

        if (url.pathname === '/api/admin/nutrition-plan' && method === 'GET') {
          const email = String(url.searchParams.get('email') || '').trim().toLowerCase();
          if (!email) {
            return json({ ok: false, error: 'email é obrigatório.' }, 400);
          }

          const plan = await getActiveNutritionPlanByEmail(env.DB, email);
          return json({ ok: true, data: plan || null });
        }

        if (url.pathname === '/api/admin/nutrition-plan' && method === 'POST') {
          const body = await safeJson(request);
          const studentEmail = String(body?.student_email || '').trim().toLowerCase();
          const title = nullableTrimmed(body?.title);
          const goal = nullableTrimmed(body?.goal);
          const strategy = nullableTrimmed(body?.strategy);
          const notes = nullableTrimmed(body?.notes);
          const whatsappMessage = nullableTrimmed(body?.whatsapp_message);
          const meals = body?.meals;
          const substitutions = body?.substitutions ?? [];
          const adherenceRules = body?.adherence_rules ?? [];

          if (!studentEmail) return json({ ok: false, error: 'student_email é obrigatório.' }, 400);
          if (!Array.isArray(meals) || meals.length === 0) {
            return json({ ok: false, error: 'meals deve ser um array com pelo menos uma refeição.' }, 400);
          }
          if (!Array.isArray(substitutions)) {
            return json({ ok: false, error: 'substitutions deve ser um array.' }, 400);
          }
          if (!Array.isArray(adherenceRules)) {
            return json({ ok: false, error: 'adherence_rules deve ser um array.' }, 400);
          }

          const accessForPlan = await env.DB.prepare(`SELECT plan, plan_type AS planType FROM student_access WHERE lower(email)=? LIMIT 1`).bind(studentEmail).first();
          if (accessForPlan && isProjectLmPlan(accessForPlan)) {
            return json({ ok: false, error: 'Recurso disponível apenas para alunos Premium.' }, 403);
          }

          const now = new Date().toISOString();
          const id = crypto.randomUUID();

          const premiumApp = createPremiumApplication(env, request);
          const saveResult = await premiumApp.saveNutritionPlan.execute({
            route: url.pathname,
            method,
            plan: {
              id,
              student_email: studentEmail,
              title,
              goal,
              strategy,
              meals_json: JSON.stringify(meals),
              substitutions_json: JSON.stringify(substitutions),
              adherence_rules_json: JSON.stringify(adherenceRules),
              notes,
              whatsapp_message: whatsappMessage,
              created_at: now,
              updated_at: now,
            }
          });
          if (saveResult.blocked) return json({ ok: false, error: 'Não foi possível gravar dados Premium com segurança.' }, 403);
          const saved = publicNutritionPlan(saveResult.saved);
          return json({ ok: true, data: saved });
        }


        const adminNutritionStudentMatch = url.pathname.match(/^\/api\/admin\/premium\/students\/([^/]+)\/nutrition-plan(?:\/(history|draft))?$/);
        if (adminNutritionStudentMatch && method === 'GET') {
          const student_id = decodeURIComponent(adminNutritionStudentMatch[1]);
          const segment = adminNutritionStudentMatch[2] || null;
          const premiumApp = createPremiumApplication(env, request);
          if (segment === 'history') {
            const result = await premiumApp.getNutritionPlanHistory.execute({ student_id });
            if (!result.ok) return json(result, 404);
            return json({ ok: true, data: result.data.map(presentAdminNutritionPlanSummary) });
          }
          if (segment === 'draft') {
            const result = await premiumApp.getNutritionPlanDraft.execute({ student_id });
            if (!result.ok) return json(result, 404);
            return json({ ok: true, data: presentAdminNutritionPlan(result.data) });
          }
          const current = await premiumApp.getCurrentNutritionPlanWorkflow.execute({ student_id });
          const draft = await premiumApp.getNutritionPlanDraft.execute({ student_id });
          const history = await premiumApp.getNutritionPlanHistory.execute({ student_id, limit: 20 });
          return json({ ok: true, data: { current: presentAdminNutritionPlan(current.data), draft: presentAdminNutritionPlan(draft.data), history: (history.data || []).map(presentAdminNutritionPlanSummary), relatedPendingItem: null, sourceFeedback: null } });
        }
        if (adminNutritionStudentMatch && method === 'POST' && adminNutritionStudentMatch[2] === 'draft') {
          const student_id = decodeURIComponent(adminNutritionStudentMatch[1]);
          const body = await safeJson(request);
          const premiumApp = createPremiumApplication(env, request);
          const result = await premiumApp.createNutritionPlanDraft.execute({ student_id, plan: body?.plan || body || {}, source_feedback_id: body?.source_feedback_id || null });
          return json({ ok: result.ok, data: presentAdminNutritionPlan(result.data), error: result.error }, result.ok ? 200 : (result.conflict ? 409 : 404));
        }
        const adminNutritionPlanMatch = url.pathname.match(/^\/api\/admin\/premium\/nutrition-plans\/([^/]+)\/(draft|publish|archive|duplicate-as-draft)$/);
        if (adminNutritionPlanMatch && ['PATCH','POST'].includes(method)) {
          const id = decodeURIComponent(adminNutritionPlanMatch[1]);
          const action = adminNutritionPlanMatch[2];
          const body = await safeJson(request);
          const premiumApp = createPremiumApplication(env, request);
          const plan = await premiumApp.nutritionPlanRepository.findById(id);
          if (!plan) return json({ ok:false, error:'NOT_FOUND' }, 404);
          let result;
          if (action === 'draft' && method === 'PATCH') result = await premiumApp.updateNutritionPlanDraft.execute({ id, student_id: plan.student_id, updates: body || {} });
          else if (action === 'publish' && method === 'POST') result = await premiumApp.publishNutritionPlan.execute({ id, student_id: plan.student_id, published_by: 'admin', professional_note: body?.professional_note || null });
          else if (action === 'archive' && method === 'POST') result = await premiumApp.archiveNutritionPlan.execute({ id, student_id: plan.student_id });
          else if (action === 'duplicate-as-draft' && method === 'POST') result = await premiumApp.createDraftFromPublishedPlan.execute({ id, student_id: plan.student_id, source_feedback_id: body?.source_feedback_id || null });
          else return json({ ok:false, error:'METHOD_NOT_ALLOWED' }, 405);
          return json({ ok: result.ok, data: presentAdminNutritionPlan(result.data), error: result.error, details: result.details }, result.ok ? 200 : (result.conflict ? 409 : 400));
        }

        if (url.pathname === '/api/admin/checkins' && method === 'GET') {
          const statusFilter = nullableTrimmed(url.searchParams.get('status'));
          const studentEmailFilter = nullableTrimmed(url.searchParams.get('student_email'))?.toLowerCase() || null;
          const limitRaw = Number(url.searchParams.get('limit') || 50);
          const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.trunc(limitRaw), 1), 200) : 50;

          const where = [];
          const params = [];

          if (statusFilter && statusFilter !== 'all') {
            where.push('sc.coach_status = ?');
            params.push(statusFilter);
          }

          if (studentEmailFilter) {
            where.push(`(lower(sc.student_email) LIKE ? OR lower(coalesce(sa.name,'')) LIKE ?)`);
            const like = `%${studentEmailFilter}%`;
            params.push(like, like);
          }

          const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

          const query = `SELECT
              sc.id,
              sc.student_email,
              coalesce(sa.name, '') AS student_name,
              sc.created_at,
              sc.training_adherence,
              sc.nutrition_adherence,
              sc.cardio_adherence,
              sc.free_meals,
              sc.hunger_level,
              sc.binge_or_snacking,
              sc.sleep_quality,
              sc.energy_level,
              sc.stress_level,
              sc.weekly_weight,
              sc.waist,
              sc.strength_status,
              sc.main_difficulty,
              sc.routine_context,
              sc.weekly_score,
              sc.support_needed,
              sc.coach_status,
              sc.coach_reply,
              sc.coach_reply_at
            FROM student_checkins sc
            LEFT JOIN student_access sa ON lower(sa.email) = lower(sc.student_email)
            ${whereSql}
            ORDER BY sc.created_at DESC
            LIMIT ?`;

          const { results } = await env.DB.prepare(query).bind(...params, limit).all();
          return json({ ok: true, data: results || [] });
        }

        if (/^\/api\/admin\/checkins\/[^/]+\/reply$/.test(url.pathname) && method === 'PATCH') {
          const id = decodeURIComponent(url.pathname.split('/')[4] || '').trim();
          if (!id) {
            return json({ ok: false, error: 'id é obrigatório.' }, 400);
          }

          const body = await safeJson(request);
          const coachReply = nullableTrimmed(body?.coach_reply);
          const coachStatus = nullableTrimmed(body?.coach_status) || 'replied';

          if (!coachReply) {
            return json({ ok: false, error: 'coach_reply é obrigatório.' }, 400);
          }

          const now = new Date().toISOString();
          const reviewedBy = request.headers.get('x-admin-user') || 'admin';

          const existing = await env.DB.prepare(
            `SELECT id FROM student_checkins WHERE id=? LIMIT 1`
          ).bind(id).first();

          if (!existing) {
            return json({ ok: false, error: 'Check-in não encontrado.' }, 404);
          }

          const premiumApp = createPremiumApplication(env, request);
          await premiumApp.analyzeWeeklyFeedback.execute({ id, decision: { coach_reply: coachReply, coach_reply_at: now, coach_status: coachStatus, reviewed_at: now, reviewed_by: reviewedBy } });
          const studentEmailForActivity = await env.DB.prepare(`SELECT student_email, student_id FROM student_checkins WHERE id=? LIMIT 1`).bind(id).first();
          await premiumApp.eventRepository.append({ id: crypto.randomUUID(), student_id: studentEmailForActivity?.student_id ?? null, student_email: String(studentEmailForActivity?.student_email || '').toLowerCase(), event_type: 'FEEDBACK_ANALYZED', source: 'admin', title: 'Resposta do coach enviada', metadata: { checkin_id: id, coach_status: coachStatus }, created_at: now });

          const updated = await env.DB.prepare(
            `SELECT id, coach_status, coach_reply, coach_reply_at, reviewed_at, reviewed_by
             FROM student_checkins
             WHERE id=?`
          ).bind(id).first();

          return json({ ok: true, data: updated });
        }



        if (url.pathname === '/api/admin/premium/weekly-feedbacks/pending' && method === 'GET') {
          const premiumApp = createPremiumApplication(env, request);
          return json({ ok: true, data: await premiumApp.listFeedbacksAwaitingAnalysis({ limit: Math.min(Number(url.searchParams.get('limit') || 50), 50) }) });
        }
        if (url.pathname === '/api/admin/premium/weekly-feedbacks/missing' && method === 'GET') {
          const premiumApp = createPremiumApplication(env, request);
          return json({ ok: true, data: await premiumApp.listMissingWeeklyFeedbacks({ limit: Math.min(Number(url.searchParams.get('limit') || 50), 50) }) });
        }
        if (url.pathname === '/api/admin/premium/weekly-feedbacks/reminders/prepare' && method === 'POST') {
          const premiumApp = createPremiumApplication(env, request);
          const result = await premiumApp.prepareWeeklyFeedbackReminders({ env, now: new Date() });
          return json(result);
        }
        if (/^\/api\/admin\/premium\/weekly-feedbacks\/[^/]+$/.test(url.pathname) && method === 'GET') {
          const id = decodeURIComponent(url.pathname.split('/').pop() || '');
          const premiumApp = createPremiumApplication(env, request);
          const result = await premiumApp.getWeeklyFeedbackForReview({ id });
          return json(result.ok ? { ok: true, data: result.data } : { ok: false, error: result.error }, result.status || 200);
        }
        if (/^\/api\/admin\/premium\/(weekly-feedbacks|feedbacks)\/[^/]+\/decision$/.test(url.pathname) && method === 'POST') {
          const parts = url.pathname.split('/');
          const id = decodeURIComponent(parts[5] || '');
          const body = await safeJson(request);
          const premiumApp = createPremiumApplication(env, request);
          const result = await premiumApp.recordProfessionalDecision({ feedback_id: id, decision_type: body?.decision_type, note: nullableTrimmed(body?.note), created_by: request.headers.get('x-admin-user') || 'admin' });
          return json(result.ok ? { ok: true, data: result.data } : { ok: false, error: result.error }, result.status || 200);
        }

        if (url.pathname === '/api/admin/command-center' && method === 'GET') {
          const currentWeekRef = getWeekRef(new Date());
          const hasNutritionPlans = await tableExists(env.DB, 'nutrition_plans');
          const hasFollowupLogs = await tableExists(env.DB, 'followup_logs');
          

          const pendingCheckinsRow = await env.DB.prepare(
            `SELECT COUNT(*) AS total
             FROM student_checkins
             WHERE coach_status IS NULL
                OR coach_status='pending'`
          ).first();

          const studentsWithoutCheckinWeekRow = await env.DB.prepare(
            `SELECT COUNT(*) AS total
             FROM student_access sa
             WHERE sa.status='ACTIVE'
               AND NOT EXISTS (
                 SELECT 1
                 FROM student_checkins sc
                 WHERE lower(sc.student_email)=lower(sa.email)
                   AND sc.week_ref=?
               )`
          ).bind(currentWeekRef).first();

          const newAnamnesesRow = await env.DB.prepare(
            `SELECT COUNT(*) AS total
             FROM premium_anamnesis
             WHERE status='RECEBIDA'`
          ).first();
          const pendingOnboardingRow = await env.DB.prepare(
            `SELECT COUNT(*) AS total
             FROM student_access
             WHERE status='PENDING_ONBOARDING'`
          ).first();
          const inactiveStudentsRow = await env.DB.prepare(
            `SELECT COUNT(*) AS total
             FROM student_access
             WHERE status='INACTIVE'`
          ).first();

          const { results: inactiveStudentsListRaw = [] } = await env.DB.prepare(
            `SELECT sa.name,
                    sa.email,
                    sa.plan_type,
                    COALESCE((
                      SELECT at.created_at
                      FROM activity_timeline at
                      WHERE lower(at.student_email)=lower(sa.email)
                        AND at.event_type='STUDENT_INACTIVATED'
                      ORDER BY datetime(at.created_at) DESC
                      LIMIT 1
                    ), sa.created_at) AS inactivated_at,
                    (
                      SELECT at.metadata_json
                      FROM activity_timeline at
                      WHERE lower(at.student_email)=lower(sa.email)
                        AND at.event_type='STUDENT_INACTIVATED'
                      ORDER BY datetime(at.created_at) DESC
                      LIMIT 1
                    ) AS inactivation_meta
             FROM student_access sa
             WHERE sa.status='INACTIVE'
             ORDER BY datetime(inactivated_at) DESC
             LIMIT 10`
          ).all();

          const studentsWithoutWeeklyPlanRow = await env.DB.prepare(
            `SELECT COUNT(*) AS total
             FROM student_access sa
             WHERE sa.status='ACTIVE'
               AND NOT EXISTS (
                 SELECT 1
                 FROM weekly_plans wp
                 WHERE lower(wp.student_email)=lower(sa.email)
                   AND wp.week_ref=?
                   AND wp.status='ACTIVE'
               )`
          ).bind(currentWeekRef).first();

          const studentsWithoutNutritionPlanRow = hasNutritionPlans
            ? await env.DB.prepare(
              `SELECT COUNT(*) AS total
               FROM student_access sa
               WHERE sa.status='ACTIVE'
                 AND NOT EXISTS (
                   SELECT 1
                   FROM nutrition_plans np
                   WHERE lower(np.student_email)=lower(sa.email)
                     AND np.is_active=1
                 )`
            ).first()
            : { total: 0 };

          const overdueFollowupsRow = hasFollowupLogs
            ? await env.DB.prepare(
              `SELECT COUNT(*) AS total
               FROM followup_logs
               WHERE resolution_status='OPEN'
                 AND due_date IS NOT NULL
                 AND datetime(due_date) <= datetime('now')`
            ).first()
            : { total: 0 };

          const pendingCheckins = Number(pendingCheckinsRow?.total || 0);
          const studentsWithoutCheckinWeek = Number(studentsWithoutCheckinWeekRow?.total || 0);
          const newAnamneses = Number(newAnamnesesRow?.total || 0);
          const studentsWithoutWeeklyPlan = Number(studentsWithoutWeeklyPlanRow?.total || 0);
          const studentsWithoutNutritionPlan = Number(studentsWithoutNutritionPlanRow?.total || 0);
          const overdueFollowups = Number(overdueFollowupsRow?.total || 0);
          const pendingOnboarding = Number(pendingOnboardingRow?.total || 0);
          const inactiveStudents = Number(inactiveStudentsRow?.total || 0);
          const revenueByPlanType = {
            START: 0,
            PREMIUM: 497,
            VIP: 997
          };
          const reactivationRevenuePotential = (inactiveStudentsListRaw || []).reduce((sum, item) => {
            const planType = String(item?.plan_type || '').trim().toUpperCase();
            return sum + Number(revenueByPlanType[planType] || revenueByPlanType.PREMIUM);
          }, 0);
          const { results: recentActivitiesRaw = [] } = await env.DB.prepare(`SELECT student_email, event_type, title, created_at FROM activity_timeline ORDER BY datetime(created_at) DESC LIMIT 8`).all();

          const { results: pendingCheckinsListRaw = [] } = await env.DB.prepare(
            `SELECT sa.name,
                    COALESCE(sa.email, sc.student_email) AS email,
                    sc.created_at
             FROM student_checkins sc
             LEFT JOIN student_access sa ON lower(sa.email)=lower(sc.student_email)
             WHERE sc.coach_status IS NULL OR sc.coach_status='pending'
             ORDER BY datetime(sc.created_at) ASC
             LIMIT 10`
          ).all();

          const { results: studentsWithoutCheckinWeekListRaw = [] } = await env.DB.prepare(
            `SELECT sa.name, sa.email,
                    (
                      SELECT sc_last.created_at
                      FROM student_checkins sc_last
                      WHERE lower(sc_last.student_email)=lower(sa.email)
                      ORDER BY datetime(sc_last.created_at) DESC
                      LIMIT 1
                    ) AS last_checkin_at
             FROM student_access sa
             WHERE sa.status='ACTIVE'
               AND NOT EXISTS (
                 SELECT 1
                 FROM student_checkins sc
                 WHERE lower(sc.student_email)=lower(sa.email)
                   AND sc.week_ref=?
               )
             ORDER BY datetime(last_checkin_at) ASC NULLS FIRST, sa.name ASC
             LIMIT 10`
          ).bind(currentWeekRef).all();

          const { results: newAnamnesesListRaw = [] } = await env.DB.prepare(
            `SELECT student_name AS name, student_email AS email, created_at
             FROM premium_anamnesis
             WHERE status='RECEBIDA'
             ORDER BY datetime(created_at) ASC
             LIMIT 10`
          ).all();

          const { results: studentsWithoutWeeklyPlanListRaw = [] } = await env.DB.prepare(
            `SELECT sa.name, sa.email
             FROM student_access sa
             WHERE sa.status='ACTIVE'
               AND NOT EXISTS (
                 SELECT 1
                 FROM weekly_plans wp
                 WHERE lower(wp.student_email)=lower(sa.email)
                   AND wp.week_ref=?
                   AND wp.status='ACTIVE'
               )
             ORDER BY sa.name ASC
             LIMIT 10`
          ).bind(currentWeekRef).all();

          const studentsWithoutNutritionPlanListRaw = hasNutritionPlans
            ? (await env.DB.prepare(
              `SELECT sa.name, sa.email
               FROM student_access sa
               WHERE sa.status='ACTIVE'
                 AND NOT EXISTS (
                   SELECT 1
                   FROM nutrition_plans np
                   WHERE lower(np.student_email)=lower(sa.email)
                     AND np.is_active=1
                 )
               ORDER BY sa.name ASC
               LIMIT 10`
            ).all()).results || []
            : [];

          const overdueFollowupsListRaw = hasFollowupLogs
            ? (await env.DB.prepare(
              `SELECT sa.name,
                      COALESCE(sa.email, fl.student_email) AS email,
                      fl.due_date
               FROM followup_logs fl
               LEFT JOIN student_access sa ON lower(sa.email)=lower(fl.student_email)
               WHERE fl.resolution_status='OPEN'
                 AND fl.due_date IS NOT NULL
                 AND datetime(fl.due_date) <= datetime('now')
               ORDER BY datetime(fl.due_date) ASC
               LIMIT 10`
            ).all()).results || []
            : [];
          const { results: pendingOnboardingListRaw = [] } = await env.DB.prepare(
            `SELECT name, email, created_at
             FROM student_access
             WHERE status='PENDING_ONBOARDING'
             ORDER BY datetime(created_at) ASC
             LIMIT 10`
          ).all();

          const pendingCheckinsList = pendingCheckinsListRaw.map((item) => ({
            name: item.name || item.email,
            email: item.email,
            reason: 'Check-in aguardando resposta',
            last_event_at: item.created_at || null,
            action_url: buildActionUrl(item.email)
          }));

          const studentsWithoutCheckinWeekList = studentsWithoutCheckinWeekListRaw.map((item) => ({
            name: item.name || item.email,
            email: item.email,
            reason: 'Sem check-in na semana atual',
            last_event_at: item.last_checkin_at || null,
            action_url: buildActionUrl(item.email)
          }));

          const newAnamnesesList = newAnamnesesListRaw.map((item) => ({
            name: item.name || item.email,
            email: item.email,
            reason: 'Anamnese aguardando análise',
            last_event_at: item.created_at || null,
            action_url: buildActionUrl(item.email)
          }));

          const studentsWithoutWeeklyPlanList = studentsWithoutWeeklyPlanListRaw.map((item) => ({
            name: item.name || item.email,
            email: item.email,
            reason: 'Objetivo do planejamento ausente',
            last_event_at: null,
            action_url: buildActionUrl(item.email)
          }));

          const studentsWithoutNutritionPlanList = studentsWithoutNutritionPlanListRaw.map((item) => ({
            name: item.name || item.email,
            email: item.email,
            reason: 'Plano alimentar ausente',
            last_event_at: null,
            action_url: buildActionUrl(item.email)
          }));

          const overdueFollowupsList = overdueFollowupsListRaw.map((item) => ({
            name: item.name || item.email,
            email: item.email,
            reason: 'Follow-up vencido aguardando resolução',
            last_event_at: item.due_date || null,
            action_url: buildActionUrl(item.email)
          }));
          const pendingOnboardingList = pendingOnboardingListRaw.map((item) => ({
            name: item.name || item.email,
            email: item.email,
            reason: 'Aguardando liberação de acesso',
            last_event_at: item.created_at || null,
            action_url: buildActionUrl(item.email)
          }));
          const inactiveStudentsList = inactiveStudentsListRaw.map((item) => {
            const meta = safeJsonParse(item.inactivation_meta);
            const reason = String(meta?.reason || 'Sem motivo informado').trim();
            const inactivatedAt = item.inactivated_at || null;
            const daysSinceInactivation = inactivatedAt
              ? Math.max(0, Math.floor((Date.now() - new Date(inactivatedAt).getTime()) / (1000 * 60 * 60 * 24)))
              : null;
            return {
              name: item.name || item.email,
              email: item.email,
              reason,
              inactivated_at: inactivatedAt,
              days_since_inactivation: daysSinceInactivation,
              action_url: buildActionUrl(item.email)
            };
          });

          let priorityMessage = 'Operação em dia.';
          if (pendingCheckinsList.length > 0) {
            priorityMessage = `Comece respondendo o check-in de ${pendingCheckinsList[0].name}.`;
          } else if (studentsWithoutCheckinWeekList.length > 0) {
            priorityMessage = `Comece cobrando check-in de ${studentsWithoutCheckinWeekList[0].name}.`;
          } else if (newAnamnesesList.length > 0) {
            priorityMessage = `Comece analisando a anamnese de ${newAnamnesesList[0].name}.`;
          } else if (studentsWithoutWeeklyPlan > 0) {
            priorityMessage = 'Atualizar planos da semana.';
          }

          return json({
            ok: true,
            data: {
              pending_checkins: pendingCheckins,
              students_without_checkin_week: studentsWithoutCheckinWeek,
              new_anamneses: newAnamneses,
              students_without_weekly_plan: studentsWithoutWeeklyPlan,
              students_without_nutrition_plan: studentsWithoutNutritionPlan,
              overdue_followups: overdueFollowups,
              pending_onboarding: pendingOnboarding,
              inactive_students: inactiveStudents,
              reactivation_revenue_potential: reactivationRevenuePotential,
              pending_checkins_list: pendingCheckinsList,
              students_without_checkin_week_list: studentsWithoutCheckinWeekList,
              new_anamneses_list: newAnamnesesList,
              students_without_weekly_plan_list: studentsWithoutWeeklyPlanList,
              students_without_nutrition_plan_list: studentsWithoutNutritionPlanList,
              overdue_followups_list: overdueFollowupsList,
              pending_onboarding_list: pendingOnboardingList,
              inactive_students_list: inactiveStudentsList,
              recent_activities: (recentActivitiesRaw || []).map((row) => ({ student_email: row.student_email, type: row.event_type, title: row.title, at: row.created_at, action_url: buildActionUrl(row.student_email) })),
              priority_message: priorityMessage,
              schema_audit: {
                nutrition_plans_exists: hasNutritionPlans,
                followup_logs_exists: hasFollowupLogs
              }
            }
          });
        }


        if (url.pathname === '/api/admin/followup-alerts' && method === 'GET') {
          const currentWeekRef = getWeekRef(new Date());

          const { results: activeStudents = [] } = await env.DB.prepare(
            `SELECT name, email, plan_type, whatsapp
             FROM student_access
             WHERE status='ACTIVE'
             ORDER BY name ASC`
          ).all();

          const { results: lastCheckins = [] } = await env.DB.prepare(
            `SELECT email_key, created_at, week_ref
             FROM (
               SELECT
                 lower(student_email) AS email_key,
                 created_at,
                 week_ref,
                 ROW_NUMBER() OVER (
                   PARTITION BY lower(student_email)
                   ORDER BY created_at DESC
                 ) AS rn
               FROM student_checkins
             )
             WHERE rn=1`
          ).all();

          const lastCheckinByEmail = new Map(
            lastCheckins.map((row) => [row.email_key, row])
          );

          const { results: currentWeekCheckins = [] } = await env.DB.prepare(
            `SELECT DISTINCT lower(student_email) AS email_key
             FROM student_checkins
             WHERE week_ref=?`
          ).bind(currentWeekRef).all();

          const currentWeekCheckinSet = new Set(
            currentWeekCheckins.map((row) => row.email_key)
          );

          const { results: currentWeekPlans = [] } = await env.DB.prepare(
            `SELECT DISTINCT lower(student_email) AS email_key
             FROM weekly_plans
             WHERE week_ref=?
               AND status='ACTIVE'`
          ).bind(currentWeekRef).all();

          const currentWeekPlanSet = new Set(
            currentWeekPlans.map((row) => row.email_key)
          );

          const { results: latestFollowups = [] } = await env.DB.prepare(
            `SELECT email_key, created_at, outcome, risk_level, next_action, reason
             FROM (
               SELECT
                 lower(student_email) AS email_key,
                 created_at,
                 outcome,
                 risk_level,
                 next_action,
                 reason,
                 ROW_NUMBER() OVER (
                   PARTITION BY lower(student_email)
                   ORDER BY created_at DESC
                 ) AS rn
               FROM followup_logs
             )
             WHERE rn=1`
          ).all();

          const latestFollowupByEmail = new Map(
            latestFollowups.map((row) => [row.email_key, row])
          );

          const followupStudents = [];

          for (const student of activeStudents) {
            const normalizedEmail = String(student.email || '').toLowerCase();
            if (!normalizedEmail) continue;

            const lastCheckinMeta = lastCheckinByEmail.get(normalizedEmail);
            const latestFollowup = latestFollowupByEmail.get(normalizedEmail);
            const lastFollowupAt = latestFollowup?.created_at || null;
            const recentlyContacted = Boolean(lastFollowupAt);

            followupStudents.push({
              name: student.name || 'Aluno',
              email: student.email || '',
              planType: student.plan_type || 'N/A',
              lastCheckin: lastCheckinMeta?.created_at || null,
              lastCheckinWeek: lastCheckinMeta?.week_ref || null,
              hasCurrentWeekCheckin: currentWeekCheckinSet.has(normalizedEmail),
              hasCurrentWeekPlan: currentWeekPlanSet.has(normalizedEmail),
              whatsapp: normalizeWhatsapp(student.whatsapp),
              recentlyContacted,
              lastFollowupAt,
              latestOutcome: latestFollowup?.outcome || null,
              latestRiskLevel: latestFollowup?.risk_level || null,
              latestNextAction: latestFollowup?.next_action || null,
              latestReason: latestFollowup?.reason || null
            });
          }

          const missingMessage = `Seu check-in da semana ainda não foi enviado.

Ele é o que direciona seus próximos ajustes de treino, cardio e estratégia.

Leva menos de 2 minutos e evita que a semana fique sem direção.

Clique aqui para responder:
https://portal.lucasmorenopersonal.com.br/portal-checkin.html`;
          const highRiskMessage = `Percebi que você ficou algumas semanas sem enviar seu check-in.

Isso normalmente é o primeiro sinal de queda de consistência, e prefiro agir antes disso virar abandono.

Me responde aqui rapidamente:
o que mais está dificultando sua rotina agora?`;
          const criticalMessage = `Quero alinhar sua semana antes que a rotina perca direção.

Seu check-in ainda não foi enviado e seu objetivo do planejamento precisa ser atualizado com base no seu momento atual.

Me responde aqui para ajustarmos o foco da semana.`;

          const missingCheckins = [];
          const highRiskStudents = [];
          const criticalRiskStudents = [];
          const cancellationRiskStudents = [];
          const financialRiskStudents = [];

          const cancellationHighMessage = `Quero alinhar sua semana para evitar que a rotina perca força.

Me responde rapidamente o que mais está dificultando sua execução agora.`;
          const cancellationCriticalMessage = `Quero falar com você rapidamente para alinharmos sua continuidade.

Percebi um ponto importante no seu acompanhamento e prefiro ajustar antes que isso vire cancelamento.

Me responde assim que puder.`;

          const financialMessage = `Entendo totalmente seu ponto sobre o momento financeiro.

Antes de cancelar direto, quero te propor uma alternativa para mantermos sua evolução sem perder completamente o acompanhamento.

Me responde aqui para eu te explicar as opções.`;

          for (const student of followupStudents) {
            const missingWhatsappUrl = student.whatsapp
              ? `https://wa.me/${student.whatsapp}?text=${encodeURIComponent(missingMessage)}`
              : null;
            const highRiskWhatsappUrl = student.whatsapp
              ? `https://wa.me/${student.whatsapp}?text=${encodeURIComponent(highRiskMessage)}`
              : null;
            const criticalWhatsappUrl = student.whatsapp
              ? `https://wa.me/${student.whatsapp}?text=${encodeURIComponent(criticalMessage)}`
              : null;

            if (!student.hasCurrentWeekCheckin) {
              missingCheckins.push({
                name: student.name,
                email: student.email,
                planType: student.planType,
                lastCheckin: student.lastCheckin,
                priority: 'MEDIUM',
                reason: 'Check-in semanal pendente',
                whatsappUrl: missingWhatsappUrl,
                message: missingMessage,
                recentlyContacted: student.recentlyContacted,
                lastFollowupAt: student.lastFollowupAt
              });
            }

            const weeksWithoutCheckin = student.lastCheckinWeek
              ? weekRefDiff(student.lastCheckinWeek, currentWeekRef)
              : null;

            if (weeksWithoutCheckin === null || weeksWithoutCheckin >= 2) {
              highRiskStudents.push({
                name: student.name,
                email: student.email,
                planType: student.planType,
                lastCheckin: student.lastCheckin,
                weeksWithoutCheckin,
                priority: 'HIGH',
                reason: '2 semanas ou mais sem check-in',
                whatsappUrl: highRiskWhatsappUrl,
                message: highRiskMessage,
                recentlyContacted: student.recentlyContacted,
                lastFollowupAt: student.lastFollowupAt
              });
            }

            const riskLevel = String(student.latestRiskLevel || '').toUpperCase();
            if (riskLevel === 'HIGH' || riskLevel === 'CRITICAL') {
              const cancellationMessage = riskLevel === 'CRITICAL' ? cancellationCriticalMessage : cancellationHighMessage;
              const cancellationWhatsappUrl = student.whatsapp
                ? `https://wa.me/${student.whatsapp}?text=${encodeURIComponent(cancellationMessage)}`
                : null;

              cancellationRiskStudents.push({
                name: student.name,
                email: student.email,
                planType: student.planType,
                lastCheckin: student.lastCheckin,
                lastFollowupAt: student.lastFollowupAt,
                outcome: student.latestOutcome,
                riskLevel,
                nextAction: student.latestNextAction,
                reason: student.latestReason || 'Follow-up recente com risco de cancelamento',
                whatsappUrl: cancellationWhatsappUrl,
                message: cancellationMessage
              });
            }

            if (isFinancialRiskFollowup(student)) {
              const financialWhatsappUrl = student.whatsapp
                ? `https://wa.me/${student.whatsapp}?text=${encodeURIComponent(financialMessage)}`
                : null;

              financialRiskStudents.push({
                name: student.name,
                email: student.email,
                planType: student.planType,
                lastFollowupAt: student.lastFollowupAt,
                outcome: student.latestOutcome,
                riskLevel: student.latestRiskLevel,
                nextAction: student.latestNextAction,
                reason: student.latestReason || 'Risco financeiro identificado no follow-up',
                suggestedRetentionActions: RETENTION_ACTION_SUGGESTIONS,
                whatsappUrl: financialWhatsappUrl,
                message: financialMessage
              });
            }

            if (!student.hasCurrentWeekCheckin && !student.hasCurrentWeekPlan) {
              criticalRiskStudents.push({
                name: student.name,
                email: student.email,
                planType: student.planType,
                lastCheckin: student.lastCheckin,
                priority: 'CRITICAL',
                reason: 'Sem check-in e sem objetivo do planejamento',
                whatsappUrl: criticalWhatsappUrl,
                message: criticalMessage,
                recentlyContacted: student.recentlyContacted,
                lastFollowupAt: student.lastFollowupAt
              });
            }
          }


          const overdueMessage = `Seu retorno estava previsto para hoje e quero alinhar rapidamente sua continuidade.

Me responde aqui para ajustarmos o próximo passo e evitar que sua semana fique sem direção.`;
          const overdueFollowups = [];

          const { results: openFollowups = [] } = await env.DB.prepare(
            `SELECT id, student_email, reason, outcome, risk_level, next_action, due_date, created_at
             FROM followup_logs
             WHERE resolution_status='OPEN'
               AND due_date IS NOT NULL
               AND datetime(due_date) <= datetime('now')`
          ).all();

          const studentLookup = new Map(followupStudents.map((student) => [String(student.email || '').toLowerCase(), student]));

          for (const followup of openFollowups) {
            const email = String(followup.student_email || '').toLowerCase();
            const student = studentLookup.get(email);
            if (!student) continue;

            const followupTime = Date.parse(followup.created_at || '') || 0;
            const lastCheckinTime = Date.parse(student.lastCheckin || '') || 0;
            let computedRiskLevel = String(followup.risk_level || '').toUpperCase() || 'MEDIUM';
            if (computedRiskLevel === 'HIGH' && (!lastCheckinTime || lastCheckinTime <= followupTime)) {
              computedRiskLevel = 'CRITICAL';
            }

            const dueTime = Date.parse(followup.due_date || '') || 0;
            const nowTime = Date.now();
            const daysOverdue = Math.max(0, Math.floor((nowTime - dueTime) / 86400000));
            const whatsappUrl = student.whatsapp
              ? `https://wa.me/${student.whatsapp}?text=${encodeURIComponent(overdueMessage)}`
              : null;

            overdueFollowups.push({
              id: followup.id,
              name: student.name,
              email: student.email,
              planType: student.planType,
              whatsappUrl,
              message: overdueMessage,
              reason: followup.reason || null,
              outcome: followup.outcome || null,
              riskLevel: computedRiskLevel,
              nextAction: followup.next_action || null,
              dueDate: followup.due_date || null,
              createdAt: followup.created_at || null,
              daysOverdue
            });
          }

          overdueFollowups.sort((a, b) => {
            if (b.daysOverdue !== a.daysOverdue) return b.daysOverdue - a.daysOverdue;
            const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
            const riskDelta = (order[a.riskLevel] ?? 99) - (order[b.riskLevel] ?? 99);
            if (riskDelta !== 0) return riskDelta;
            return (Date.parse(b.createdAt || '') || 0) - (Date.parse(a.createdAt || '') || 0);
          });
          return json({
            ok: true,
            data: {
              overdueFollowups,
              missingCheckins,
              highRiskStudents,
              criticalRiskStudents,
              cancellationRiskStudents: cancellationRiskStudents.sort((a, b) => {
                const order = { CRITICAL: 0, HIGH: 1 };
                const riskDelta = (order[a.riskLevel] ?? 99) - (order[b.riskLevel] ?? 99);
                if (riskDelta !== 0) return riskDelta;
                const aTime = Date.parse(a.lastFollowupAt || '') || 0;
                const bTime = Date.parse(b.lastFollowupAt || '') || 0;
                return bTime - aTime;
              }),
              financialRiskStudents: financialRiskStudents.sort((a, b) => {
                const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
                const riskDelta = (order[String(a.riskLevel || '').toUpperCase()] ?? 99) - (order[String(b.riskLevel || '').toUpperCase()] ?? 99);
                if (riskDelta !== 0) return riskDelta;
                const aTime = Date.parse(a.lastFollowupAt || '') || 0;
                const bTime = Date.parse(b.lastFollowupAt || '') || 0;
                return bTime - aTime;
              })
            }
          });
        }

        if (url.pathname === '/api/admin/portal-alerts' && method === 'GET') {
          const currentWeekRef = getWeekRef(new Date());

          const activeStudentsResult = await env.DB.prepare(
            `SELECT name, email, plan_type FROM student_access WHERE status='ACTIVE' ORDER BY name ASC`
          ).all();

          const activeStudents = activeStudentsResult?.results || [];

          const { results: missingWeeklyPlan = [] } = await env.DB.prepare(
            `SELECT sa.email, sa.name, sa.plan_type AS planType
             FROM student_access sa
             LEFT JOIN weekly_plans wp
               ON lower(wp.student_email)=lower(sa.email)
               AND wp.week_ref=?
               AND wp.status='ACTIVE'
             WHERE sa.status='ACTIVE' AND wp.id IS NULL
             ORDER BY sa.name ASC`
          ).bind(currentWeekRef).all();

          const { results: missingCheckin = [] } = await env.DB.prepare(
            `SELECT sa.email, sa.name,
                    (SELECT MAX(sc.created_at)
                     FROM student_checkins sc
                     WHERE lower(sc.student_email)=lower(sa.email)) AS lastCheckin
             FROM student_access sa
             WHERE sa.status='ACTIVE'
               AND NOT EXISTS (
                 SELECT 1
                 FROM student_checkins scw
                 WHERE lower(scw.student_email)=lower(sa.email)
                   AND scw.week_ref=?
               )
             ORDER BY sa.name ASC`
          ).bind(currentWeekRef).all();

          const missingWeeklyPlanSet = new Set(
            missingWeeklyPlan.map((student) => String(student.email || '').toLowerCase())
          );

          const { results: latestCheckinWeeks = [] } = await env.DB.prepare(
            `SELECT email_key, week_ref
             FROM (
               SELECT lower(student_email) AS email_key,
                      week_ref,
                      ROW_NUMBER() OVER (
                        PARTITION BY lower(student_email)
                        ORDER BY created_at DESC
                      ) AS rn
               FROM student_checkins
             )
             WHERE rn=1`
          ).all();

          const checkinByEmail = new Map(
            latestCheckinWeeks.map((row) => [String(row.email_key || '').toLowerCase(), row.week_ref || null])
          );

          const riskStudents = [];

          for (const student of activeStudents) {
            const email = String(student.email || '').toLowerCase();
            const name = student.name;
            const hasNoWeeklyPlan = missingWeeklyPlanSet.has(email);
            const lastCheckinWeek = checkinByEmail.get(email);

            if (!lastCheckinWeek && hasNoWeeklyPlan) {
              riskStudents.push({
                email: student.email,
                name,
                reason: 'Sem objetivo do planejamento e sem check-in'
              });
              continue;
            }

            if (lastCheckinWeek) {
              const weeksDiff = weekRefDiff(lastCheckinWeek, currentWeekRef);
              if (weeksDiff >= 2) {
                riskStudents.push({
                  email: student.email,
                  name,
                  reason: `${weeksDiff} semanas sem check-in`
                });
              }
            }
          }

          return json({
            ok: true,
            data: {
              missingWeeklyPlan,
              missingCheckin,
              riskStudents
            }
          });
        }


        if (url.pathname === '/api/admin/anamneses' && method === 'GET') {
          const { results } = await env.DB.prepare(
            `SELECT id, student_name, student_email, student_phone, status, created_at, updated_at
             FROM premium_anamnesis
             ORDER BY created_at DESC`
          ).all();

          return json({ ok: true, data: results || [] });
        }

        const anamnesisDetailMatch = url.pathname.match(/^\/api\/admin\/anamneses\/([^/]+)$/);

        if (anamnesisDetailMatch && method === 'GET') {
          const id = anamnesisDetailMatch[1];
          const row = await env.DB.prepare(
            `SELECT * FROM premium_anamnesis WHERE id=? LIMIT 1`
          ).bind(id).first();

          if (!row) return json({ ok: false, error: 'Anamnese não encontrada.' }, 404);

          return json({
            ok: true,
            data: {
              ...row,
              answers: safeJsonParseObject(row.answers_json),
              internal_scores: safeJsonParseObject(row.internal_scores_json)
            }
          });
        }

        if (anamnesisDetailMatch && method === 'PATCH') {
          const id = anamnesisDetailMatch[1];
          const body = await safeJson(request);
          const status = nullableTrimmed(body?.status);

          if (!status) {
            return json({ ok: false, error: 'status é obrigatório.' }, 400);
          }

          const now = new Date().toISOString();
          const premiumApp = createPremiumApplication(env, request);
          const result = await premiumApp.analyzeAnamnesis.execute({ id, status, updated_at: now });

          if (!result?.ok) {
            return json({ ok: false, error: 'Anamnese não encontrada.' }, 404);
          }

          return json({ ok: true, data: { id, status, updated_at: now } });
        }

        if (url.pathname === '/api/admin/leads' && method === 'GET') {
          return json({ ok: true, data: [] });
        }

        if (url.pathname === '/api/admin/metrics' && method === 'GET') {
          return json({ ok: true, data: {} });
        }

        if (url.pathname === '/api/admin/alerts' && method === 'GET') {
          return json({ ok: true, data: [] });
        }

        if (url.pathname === '/api/admin/alerts/send' && method === 'POST') {
          return json({ ok: true });
        }

        if (/\/api\/admin\/leads\/[^/]+\/(status|commercial)$/.test(url.pathname) && method === 'PATCH') {
          return json({ ok: true });
        }
      }

      return json({ ok: false, error: 'Not found' }, 404);
    } catch (err) {
      await logOperationalEvent(env.DB, buildOperationalErrorPayload(request, err));
      return json({
        ok: false,
        error: 'Internal error',
        detail: String(err?.message || err)
      }, 500);
    }
  }
};

async function ensureSchema(db) {
  if (db && (typeof db === 'object' || typeof db === 'function')) {
    const cachedEnsure = ensuredSchemaByDb.get(db);
    if (cachedEnsure) return cachedEnsure;

    const ensurePromise = ensureSchemaUncached(db).catch((error) => {
      ensuredSchemaByDb.delete(db);
      throw error;
    });
    ensuredSchemaByDb.set(db, ensurePromise);
    return ensurePromise;
  }

  return ensureSchemaUncached(db);
}

async function ensureSchemaUncached(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    created_at TEXT
  )`).run();

  await db.prepare(`CREATE TABLE IF NOT EXISTS diagnostic_results (
    id TEXT PRIMARY KEY,
    created_at TEXT
  )`).run();

  await db.prepare(`CREATE TABLE IF NOT EXISTS student_access (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    access_token TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    plan_type TEXT,
    plan TEXT DEFAULT 'premium',
    whatsapp TEXT,
    created_at TEXT NOT NULL
  )`).run();

  await ensureColumn(db, 'student_access', 'whatsapp', 'TEXT');
  await ensureColumn(db, 'student_access', 'plan', "TEXT DEFAULT 'premium'");
  await ensureColumn(db, 'student_access', 'student_id', 'TEXT');

  await db.prepare(`CREATE TABLE IF NOT EXISTS premium_students (
    student_id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    normalized_email TEXT NOT NULL,
    display_name TEXT,
    consultation_status TEXT NOT NULL DEFAULT 'NEW',
    access_status TEXT NOT NULL DEFAULT 'ACTIVE',
    source TEXT NOT NULL DEFAULT 'MIGRATION',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`).run();
  await db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_premium_students_normalized_email ON premium_students(normalized_email)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_premium_students_access_status ON premium_students(access_status)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_student_access_student_id ON student_access(student_id)`).run();


  await db.prepare(`CREATE TABLE IF NOT EXISTS project_lm_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT,
    goal TEXT,
    sex TEXT NOT NULL CHECK (sex IN ('female', 'male')),
    weight_kg REAL,
    height_cm REAL,
    nutrition_plan_code TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`).run();


  await ensureColumn(db, 'project_lm_profiles', 'name', 'TEXT');
  await ensureColumn(db, 'project_lm_profiles', 'goal', 'TEXT');
  await ensureColumn(db, 'project_lm_profiles', 'objective', 'TEXT');
  await ensureColumn(db, 'project_lm_profiles', 'weight_kg', 'REAL');
  await ensureColumn(db, 'project_lm_profiles', 'height_cm', 'REAL');
  await ensureColumn(db, 'project_lm_profiles', 'nutrition_plan_code', 'TEXT');
  await ensureColumn(db, 'project_lm_profiles', 'initial_plan_code', 'TEXT');

  await db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_project_lm_profiles_user_id
    ON project_lm_profiles(user_id)`).run();

  await db.prepare(`CREATE TABLE IF NOT EXISTS lm2_profiles (
    student_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    goal TEXT NOT NULL,
    sex TEXT NOT NULL CHECK (sex IN ('female', 'male')),
    weight_kg REAL NOT NULL,
    height_cm REAL,
    nutrition_plan_id TEXT NOT NULL,
    training_plan_id TEXT NOT NULL,
    onboarding_completed INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`).run();

  await ensureColumn(db, 'lm2_profiles', 'height_cm', 'REAL');
  await ensureColumn(db, 'lm2_profiles', 'onboarding_completed', 'INTEGER NOT NULL DEFAULT 1');

  await db.prepare(`CREATE TABLE IF NOT EXISTS lm2_journeys (
    student_id TEXT PRIMARY KEY,
    current_week INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'active',
    started_at TEXT NOT NULL,
    completed_at TEXT,
    week_started_at TEXT,
    week_completed_at TEXT,
    program_completed_at TEXT,
    premium_bridge_eligible INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`).run();

  await ensureColumn(db, 'lm2_journeys', 'week_started_at', 'TEXT');
  await ensureColumn(db, 'lm2_journeys', 'week_completed_at', 'TEXT');
  await ensureColumn(db, 'lm2_journeys', 'program_completed_at', 'TEXT');
  await ensureColumn(db, 'lm2_journeys', 'premium_bridge_eligible', 'INTEGER NOT NULL DEFAULT 0');

  await db.prepare(`CREATE TABLE IF NOT EXISTS lm2_week_1_foundation (
    student_id TEXT PRIMARY KEY,
    video_completed INTEGER NOT NULL DEFAULT 0,
    unable_to_train TEXT,
    overeating TEXT,
    no_motivation TEXT,
    video_completed_at TEXT,
    plan_b_saved_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`).run();

  await db.prepare(`CREATE TABLE IF NOT EXISTS lm2_week_2_foundation (
    student_id TEXT PRIMARY KEY,
    video_completed INTEGER NOT NULL DEFAULT 0,
    reflection TEXT,
    minimum_response TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`).run();

  await db.prepare(`CREATE TABLE IF NOT EXISTS lm2_week_3_foundation (
    student_id TEXT PRIMARY KEY,
    video_completed INTEGER NOT NULL DEFAULT 0,
    reflection TEXT,
    minimum_response TEXT,
    completed_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`).run();

  await db.prepare(`CREATE TABLE IF NOT EXISTS lm2_week_4_foundation (
    student_id TEXT PRIMARY KEY,
    video_completed INTEGER NOT NULL DEFAULT 0,
    reflection TEXT,
    minimum_response TEXT,
    completed_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`).run();

  await db.prepare(`CREATE TABLE IF NOT EXISTS lm2_checkins (
    student_id TEXT NOT NULL,
    checkin_date TEXT NOT NULL,
    week_number INTEGER NOT NULL,
    answer TEXT NOT NULL,
    continuity_point INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`).run();

  await db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_lm2_checkins_student_date
    ON lm2_checkins(student_id, checkin_date)`).run();


  await db.prepare(`CREATE TABLE IF NOT EXISTS training_plans (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    audience TEXT,
    location TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();

  await db.prepare(`CREATE TABLE IF NOT EXISTS training_sessions (
    id TEXT PRIMARY KEY,
    plan_id TEXT,
    plan_code TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    week_day INTEGER,
    order_index INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();

  await db.prepare(`CREATE TABLE IF NOT EXISTS training_exercises (
    id TEXT PRIMARY KEY,
    session_id TEXT,
    session_code TEXT NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 0,
    exercise_key TEXT,
    name TEXT NOT NULL,
    sets INTEGER NOT NULL,
    reps TEXT NOT NULL,
    rest_seconds INTEGER NOT NULL,
    instruction_url TEXT,
    video_url TEXT NOT NULL DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();

  await ensureColumn(db, 'training_sessions', 'plan_id', 'TEXT');
  await ensureColumn(db, 'training_exercises', 'session_id', 'TEXT');
  await ensureColumn(db, 'training_exercises', 'exercise_key', 'TEXT');
  await ensureColumn(db, 'training_exercises', 'instruction_url', 'TEXT');
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_training_sessions_plan ON training_sessions(plan_code, active, order_index)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_training_sessions_plan_id ON training_sessions(plan_id, active, order_index)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_training_exercises_session ON training_exercises(session_code, active, order_index)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_training_exercises_session_id ON training_exercises(session_id, active, order_index)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_training_exercises_key ON training_exercises(exercise_key)`).run();
  await seedProjectLmTrainingPlans(db);

  await db.prepare(`CREATE TABLE IF NOT EXISTS project_lm_daily_actions (
    id TEXT PRIMARY KEY,
    student_email TEXT NOT NULL,
    action_date TEXT NOT NULL,
    action_type TEXT NOT NULL,
    completed INTEGER DEFAULT 1,
    created_at TEXT
  )`).run();

  await db.prepare(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_project_lm_daily_actions_unique
     ON project_lm_daily_actions(student_email, action_date, action_type)`
  ).run();

  await db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_project_lm_daily_actions_student_date
     ON project_lm_daily_actions(student_email, action_date)`
  ).run();

  await db.prepare(`CREATE TABLE IF NOT EXISTS project_lm_library_content (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT,
    video_url TEXT,
    summary TEXT,
    action_text TEXT,
    unlock_rule TEXT NOT NULL DEFAULT 'always',
    sort_order INTEGER DEFAULT 0,
    created_at TEXT
  )`).run();

  await db.prepare(`CREATE TABLE IF NOT EXISTS project_lm_library_progress (
    id TEXT PRIMARY KEY,
    student_email TEXT NOT NULL,
    content_slug TEXT NOT NULL,
    completed INTEGER DEFAULT 0,
    completed_at TEXT
  )`).run();

  await db.prepare(`CREATE TABLE IF NOT EXISTS project_lm_weekly_missions (
    week_number INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    main_mission TEXT NOT NULL,
    success_criteria TEXT NOT NULL
  )`).run();

  await db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_project_lm_library_content_sort
     ON project_lm_library_content(sort_order)`
  ).run();

  await db.prepare(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_project_lm_library_progress_unique
     ON project_lm_library_progress(student_email, content_slug)`
  ).run();

  await db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_project_lm_library_progress_student
     ON project_lm_library_progress(student_email)`
  ).run();

  await seedProjectLmLibraryContent(db);
  await seedProjectLmWeeklyMissions(db);


  await db.prepare(`CREATE TABLE IF NOT EXISTS followup_logs (
    id TEXT PRIMARY KEY,
    student_email TEXT NOT NULL,
    contact_type TEXT NOT NULL DEFAULT 'WHATSAPP',
    reason TEXT,
    note TEXT,
    created_at TEXT NOT NULL
  )`).run();

  await ensureColumn(db, 'followup_logs', 'outcome', 'TEXT');
  await ensureColumn(db, 'followup_logs', 'risk_level', 'TEXT');
  await ensureColumn(db, 'followup_logs', 'next_action', 'TEXT');
  await ensureColumn(db, 'followup_logs', 'due_date', 'TEXT');
  await ensureColumn(db, 'followup_logs', 'resolved_at', 'TEXT');
  await ensureColumn(db, 'followup_logs', 'resolution_status', "TEXT DEFAULT 'OPEN'");
  await ensureColumn(db, 'followup_logs', 'student_id', 'TEXT');

  await db.prepare(`CREATE TABLE IF NOT EXISTS retention_actions (
    id TEXT PRIMARY KEY,
    student_email TEXT NOT NULL,
    financial_reason TEXT,
    proposed_action TEXT,
    accepted_status TEXT,
    note TEXT,
    created_at TEXT NOT NULL
  )`).run();

  await db.prepare(`CREATE TABLE IF NOT EXISTS student_checkins (
    id TEXT PRIMARY KEY,
    student_email TEXT NOT NULL,
    week_ref TEXT NOT NULL,
    training_adherence TEXT,
    nutrition_adherence TEXT,
    cardio_adherence TEXT,
    free_meals TEXT,
    hunger_level TEXT,
    binge_or_snacking TEXT,
    sleep_quality TEXT,
    energy_level TEXT,
    stress_level TEXT,
    weekly_weight TEXT,
    waist TEXT,
    strength_status TEXT,
    main_difficulty TEXT,
    routine_context TEXT,
    weekly_score TEXT,
    support_needed TEXT,
    created_at TEXT NOT NULL
  )`).run();

  await ensureColumn(db, 'student_checkins', 'coach_reply', 'TEXT');
  await ensureColumn(db, 'student_checkins', 'coach_reply_at', 'TEXT');
  await ensureColumn(db, 'student_checkins', 'coach_status', "TEXT DEFAULT 'pending'");
  await ensureColumn(db, 'student_checkins', 'reviewed_at', 'TEXT');
  await ensureColumn(db, 'student_checkins', 'reviewed_by', 'TEXT');
  await ensureColumn(db, 'student_checkins', 'student_id', 'TEXT');
  await ensureColumn(db, 'student_checkins', 'available_at', 'TEXT');
  await ensureColumn(db, 'student_checkins', 'submitted_at', 'TEXT');
  await ensureColumn(db, 'student_checkins', 'analyzed_at', 'TEXT');
  await ensureColumn(db, 'student_checkins', 'decision_type', 'TEXT');
  await ensureColumn(db, 'student_checkins', 'decision_note', 'TEXT');
  await ensureColumn(db, 'student_checkins', 'decision_by', 'TEXT');
  await ensureColumn(db, 'student_checkins', 'decision_at', 'TEXT');
  await ensureColumn(db, 'student_checkins', 'updated_at', 'TEXT');

  await db.prepare(`CREATE TABLE IF NOT EXISTS progression_logs (
    id TEXT PRIMARY KEY,
    student_email TEXT NOT NULL,
    exercise TEXT NOT NULL,
    target_zone TEXT NOT NULL,
    load_used REAL,
    reps_done INTEGER,
    rir TEXT,
    decision TEXT,
    created_at TEXT NOT NULL
  )`).run();

  await ensureColumn(db, 'progression_logs', 'student_id', 'TEXT');

  await db.prepare(`CREATE TABLE IF NOT EXISTS weekly_plans (
    id TEXT PRIMARY KEY,
    student_email TEXT NOT NULL,
    week_ref TEXT NOT NULL,
    training_focus TEXT,
    cardio_target TEXT,
    nutrition_focus TEXT,
    main_risk TEXT,
    coach_message TEXT,
    status TEXT DEFAULT 'ACTIVE',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`).run();

  await ensureColumn(db, 'weekly_plans', 'student_id', 'TEXT');
  await db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_weekly_plans_student_email ON weekly_plans(student_email)`
  ).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS nutrition_plans (
    id TEXT PRIMARY KEY,
    student_email TEXT NOT NULL,
    title TEXT,
    goal TEXT,
    strategy TEXT,
    meals_json TEXT NOT NULL,
    substitutions_json TEXT,
    adherence_rules_json TEXT,
    notes TEXT,
    whatsapp_message TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`).run();
  await ensureColumn(db, 'nutrition_plans', 'student_id', 'TEXT');
  await ensureColumn(db, 'nutrition_plans', 'status', 'TEXT');
  await ensureColumn(db, 'nutrition_plans', 'version_number', 'INTEGER');
  await ensureColumn(db, 'nutrition_plans', 'published_at', 'TEXT');
  await ensureColumn(db, 'nutrition_plans', 'published_by', 'TEXT');
  await ensureColumn(db, 'nutrition_plans', 'archived_at', 'TEXT');
  await ensureColumn(db, 'nutrition_plans', 'supersedes_plan_id', 'TEXT');
  await ensureColumn(db, 'nutrition_plans', 'source_feedback_id', 'TEXT');
  await ensureColumn(db, 'nutrition_plans', 'private_notes', 'TEXT');
  await db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_nutrition_plans_student_email ON nutrition_plans(student_email)`
  ).run();
  await db.prepare(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_nutrition_plans_single_active
     ON nutrition_plans(student_email)
     WHERE is_active = 1`
  ).run();

  await db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_student_checkins_student_week ON student_checkins(student_email, week_ref)`
  ).run();

  await db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_student_access_email ON student_access(email)`
  ).run();

  await db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_followup_logs_student_email ON followup_logs(student_email)`
  ).run();

  await db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_followup_logs_created_at ON followup_logs(created_at)`
  ).run();
  await db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_followup_logs_resolution_status_due_date ON followup_logs(resolution_status, due_date)`
  ).run();
  await db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_followup_logs_student_created ON followup_logs(student_email, created_at)`
  ).run();
  await ensureColumn(db, 'retention_actions', 'student_id', 'TEXT');
  await db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_retention_actions_student_email ON retention_actions(student_email)`
  ).run();


  await db.prepare(`CREATE TABLE IF NOT EXISTS activity_timeline (
    id TEXT PRIMARY KEY,
    student_email TEXT NOT NULL,
    event_type TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'system',
    title TEXT NOT NULL,
    metadata_json TEXT,
    created_at TEXT NOT NULL
  )`).run();

  await ensureColumn(db, 'activity_timeline', 'student_id', 'TEXT');
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_activity_timeline_student_created ON activity_timeline(student_email, created_at)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_activity_timeline_created ON activity_timeline(created_at)`).run();


  await db.prepare(`CREATE TABLE IF NOT EXISTS premium_followup_entries (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    entry_type TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    source TEXT NOT NULL DEFAULT 'admin',
    related_entity_type TEXT,
    related_entity_id TEXT,
    created_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_premium_followup_entries_student_created ON premium_followup_entries(student_id, created_at)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_premium_followup_entries_related ON premium_followup_entries(related_entity_type, related_entity_id)`).run();
  await db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_premium_followup_entries_decision_unique ON premium_followup_entries(entry_type, related_entity_type, related_entity_id) WHERE entry_type = 'PROFESSIONAL_DECISION' AND related_entity_type IS NOT NULL AND related_entity_id IS NOT NULL`).run();

  await db.prepare(`CREATE TABLE IF NOT EXISTS premium_pending_items (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'OPEN',
    priority TEXT NOT NULL DEFAULT 'NORMAL',
    source TEXT NOT NULL DEFAULT 'manual',
    related_entity_type TEXT,
    related_entity_id TEXT,
    due_at TEXT,
    resolved_at TEXT,
    created_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_premium_pending_items_student_status ON premium_pending_items(student_id, status)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_premium_pending_items_status ON premium_pending_items(status)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_premium_pending_items_created_at ON premium_pending_items(created_at)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_premium_pending_items_related ON premium_pending_items(related_entity_type, related_entity_id)`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS premium_feedback_reminders (id TEXT PRIMARY KEY, student_id TEXT NOT NULL, week_ref TEXT NOT NULL, reminder_type TEXT NOT NULL, channel TEXT NOT NULL DEFAULT 'OPERATIONAL_QUEUE', status TEXT NOT NULL DEFAULT 'PENDING', scheduled_for TEXT NOT NULL, sent_at TEXT, failure_reason TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`).run();
  await db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_premium_feedback_reminders_unique ON premium_feedback_reminders(student_id, week_ref, reminder_type, channel)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_premium_feedback_reminders_status ON premium_feedback_reminders(status, scheduled_for)`).run();

  await db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_premium_pending_items_open_unique ON premium_pending_items(student_id, type, COALESCE(related_entity_type, ''), COALESCE(related_entity_id, '')) WHERE status = 'OPEN'`).run();

  await db.prepare(`CREATE TABLE IF NOT EXISTS operational_logs (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    level TEXT NOT NULL,
    area TEXT NOT NULL,
    event TEXT NOT NULL,
    route TEXT,
    method TEXT,
    student_email TEXT,
    admin_context TEXT,
    message TEXT,
    metadata TEXT
  )`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_operational_logs_created_at ON operational_logs(created_at)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_operational_logs_level_created_at ON operational_logs(level, created_at)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_operational_logs_area_created_at ON operational_logs(area, created_at)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_operational_logs_student_email_created_at ON operational_logs(student_email, created_at)`).run();

  await db.prepare(`CREATE TABLE IF NOT EXISTS premium_anamnesis (
    id TEXT PRIMARY KEY,
    student_name TEXT NOT NULL,
    student_email TEXT NOT NULL,
    student_phone TEXT,
    status TEXT NOT NULL DEFAULT 'RECEBIDA',
    answers_json TEXT NOT NULL,
    internal_scores_json TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`).run();

  await ensureColumn(db, 'premium_anamnesis', 'student_id', 'TEXT');
  await db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_premium_anamnesis_created_at ON premium_anamnesis(created_at)`
  ).run();
  await db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_premium_anamnesis_student_email ON premium_anamnesis(student_email)`
  ).run();

  await db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_retention_actions_created_at ON retention_actions(created_at)`
  ).run();
  for (const statement of [
    'CREATE INDEX IF NOT EXISTS idx_premium_anamnesis_student_id ON premium_anamnesis(student_id)',
    'CREATE INDEX IF NOT EXISTS idx_nutrition_plans_student_id ON nutrition_plans(student_id)',
    'CREATE INDEX IF NOT EXISTS idx_nutrition_plans_student_status ON nutrition_plans(student_id, status)',
    'CREATE INDEX IF NOT EXISTS idx_student_checkins_student_id ON student_checkins(student_id)',
    'CREATE INDEX IF NOT EXISTS idx_activity_timeline_student_id ON activity_timeline(student_id)',
    'CREATE INDEX IF NOT EXISTS idx_weekly_plans_student_id ON weekly_plans(student_id)',
    'CREATE INDEX IF NOT EXISTS idx_progression_logs_student_id ON progression_logs(student_id)',
    'CREATE INDEX IF NOT EXISTS idx_followup_logs_student_id ON followup_logs(student_id)',
    'CREATE INDEX IF NOT EXISTS idx_retention_actions_student_id ON retention_actions(student_id)'
  ]) await db.prepare(statement).run();
}


async function logActivityEvent(db, event) {
  const studentEmail = String(event?.student_email || '').trim().toLowerCase();
  if (!studentEmail) return;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO activity_timeline (id, student_email, event_type, source, title, metadata_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    studentEmail,
    String(event?.event_type || 'UNKNOWN'),
    String(event?.source || 'system'),
    String(event?.title || 'Atividade'),
    JSON.stringify(event?.payload || {}),
    now
  ).run();
}



function buildOperationalErrorPayload(request, err) {
  const url = new URL(request.url);
  return {
    level: 'error',
    area: resolveOperationalArea(url.pathname),
    event: resolveOperationalEvent(url.pathname),
    route: url.pathname,
    method: request.method,
    student_email: request.headers.get('x-student-email'),
    admin_context: request.headers.get('x-admin-user') || null,
    message: String(err?.message || err || 'Internal error'),
    metadata: { name: err?.name || null }
  };
}

function resolveOperationalArea(pathname) {
  if (pathname.startsWith('/api/admin/')) return 'admin';
  if (pathname.includes('/project-lm/')) return 'project_lm';
  if (pathname.startsWith('/api/portal/')) return 'student';
  return 'system';
}

function resolveOperationalEvent(pathname) {
  if (pathname === '/api/portal/checkin') return 'checkin_submit_error';
  if (pathname === '/api/portal/progression') return 'progression_register_error';
  if (pathname === '/api/portal/nutrition-plan') return 'nutrition_plan_load_error';
  if (pathname === '/api/admin/command-center') return 'command_center_error';
  if (pathname === '/api/admin/student-360') return 'student_360_error';
  if (pathname === '/api/admin/student-access') return 'student_access_upsert_error';
  if (pathname === '/api/admin/health-check') return 'health_check_error';
  if (pathname.includes('/project-lm/profile')) return 'project_lm_onboarding_error';
  if (pathname.includes('/current-mission') || pathname.includes('/daily-actions')) return 'project_lm_milestones_error';
  if (pathname.includes('/library')) return 'project_lm_library_error';
  if (pathname.includes('/planning') || pathname.includes('/plano-inicial')) return 'project_lm_initial_planning_error';
  return 'request_error';
}

function __deprecated_safeJsonParse(value) {
  try { return value ? JSON.parse(value) : null; } catch { return null; }
}

const RETENTION_ACTION_SUGGESTIONS = [
  { value: 'PLANO_START_TEMPORARIO', label: 'Plano Start temporário' },
  { value: 'PAUSA_ESTRATEGICA_15_30_DIAS', label: 'Pausa estratégica de 15–30 dias' },
  { value: 'REDUCAO_ACOMPANHAMENTO', label: 'Redução temporária de acompanhamento' },
  { value: 'AJUSTE_TEMPORARIO_INVESTIMENTO', label: 'Ajuste temporário de investimento' },
  { value: 'RETORNO_AGENDADO', label: 'Preservar vínculo e agendar retorno' }
];

const RETENTION_PROPOSED_ACTIONS = [
  'PLANO_START_TEMPORARIO',
  'PAUSA_ESTRATEGICA_15_30_DIAS',
  'REDUCAO_ACOMPANHAMENTO',
  'AJUSTE_TEMPORARIO_INVESTIMENTO',
  'RETORNO_AGENDADO',
  'OUTRO'
];

const RETENTION_ACCEPTED_STATUS = ['OFFERED', 'ACCEPTED', 'DECLINED', 'CANCELLED_ANYWAY', 'PENDING'];

function isFinancialRiskFollowup(student) {
  const outcome = String(student.latestOutcome || '').toUpperCase();
  if (outcome === 'PROBLEMA_FINANCEIRO') return true;

  const riskLevel = String(student.latestRiskLevel || '').toUpperCase();
  if (riskLevel !== 'HIGH' && riskLevel !== 'CRITICAL') return false;

  const reason = `${student.latestReason || ''}`.toLowerCase();
  const terms = ['financeir', 'dinheiro', 'mensalidade', 'pagament', 'custo', 'investimento', 'valor'];
  return terms.some((term) => reason.includes(term));
}


async function ensureColumn(db, tableName, columnName, sqlType) {
  const columns = await db.prepare(`PRAGMA table_info(${tableName})`).all();
  const exists = (columns?.results || []).some((col) => col.name === columnName);
  if (!exists) {
    await db.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${sqlType}`).run();
  }
}


function resolveDueDate(nextAction, baseDateIso) {
  const base = new Date(baseDateIso || Date.now());
  const action = String(nextAction || '').toUpperCase();

  let daysToAdd = null;

  if (
    action === 'REVISAR_PLANO' ||
    action === 'AJUSTAR_DIETA' ||
    action === 'CHAMADA_ESTRATEGICA'
  ) {
    daysToAdd = 0;
  } else if (action === 'RETORNO_3_DIAS') {
    daysToAdd = 3;
  } else if (action === 'RETORNO_7_DIAS') {
    daysToAdd = 7;
  } else if (action === 'OUTRO') {
    daysToAdd = 3;
  } else if (action === 'SEM_ACAO_NECESSARIA') {
    return null;
  }

  if (daysToAdd === null) return null;

  const due = new Date(base);
  due.setUTCDate(due.getUTCDate() + daysToAdd);

  return due.toISOString();
}

function resolveResolutionStatus(nextAction, dueDate) {
  const action = String(nextAction || '').toUpperCase();

  if (action === 'SEM_ACAO_NECESSARIA') return 'NO_ACTION';
  if (dueDate) return 'OPEN';

  return 'OPEN';
}

function __deprecated_inferRiskLevelFromOutcome(outcome) {
  switch (String(outcome || '').toUpperCase()) {
    case 'PEDIU_CANCELAMENTO':
      return 'CRITICAL';
    case 'PROBLEMA_FINANCEIRO':
    case 'SEM_RESPOSTA':
    case 'DESMOTIVACAO':
      return 'HIGH';
    case 'SEMANA_ATIPICA_VIAGEM':
    case 'DOR_LIMITACAO':
    case 'DIFICULDADE_ALIMENTAR':
    case 'OUTRO':
      return 'MEDIUM';
    case 'RETOMOU_ROTINA':
    case 'VAI_RESPONDER_CHECKIN':
      return 'LOW';
    default:
      return null;
  }
}

function normalizeWhatsapp(rawValue) {
  const digits = String(rawValue || '').replace(/\D+/g, '');
  if (!digits) return null;
  if (digits.startsWith('55')) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

function __deprecated_nullableTrimmed(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

async function getActiveNutritionPlanByEmail(db, email) {
  const row = await db.prepare(
    `SELECT id, student_email, title, goal, strategy, meals_json, substitutions_json,
            adherence_rules_json, notes, whatsapp_message, created_at, updated_at
     FROM nutrition_plans
     WHERE lower(student_email)=? AND is_active=1
     ORDER BY updated_at DESC
     LIMIT 1`
  ).bind(String(email || '').toLowerCase()).first();

  if (!row) return null;

  return {
    id: row.id,
    student_email: row.student_email,
    title: row.title,
    goal: row.goal,
    strategy: row.strategy,
    meals: safeJsonParseArray(row.meals_json),
    substitutions: safeJsonParseArray(row.substitutions_json),
    adherence_rules: safeJsonParseArray(row.adherence_rules_json),
    notes: row.notes,
    whatsapp_message: row.whatsapp_message,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}


function calculateAnamnesisInternalScores(answers) {
  const source = answers && typeof answers === 'object' ? answers : {};

  return {
    adherence_score: averageScore([
      scoreNumber(pickAnamnesisValue(source, ['adherence.change_readiness', 'adherence.readiness', 'change_readiness']), { min: 0, max: 10 }),
      scoreBarrier(pickAnamnesisValue(source, ['adherence.consistency_barrier', 'adherence.difficulty', 'consistency_barrier']), { invert: true }),
      scoreTriedBefore(pickAnamnesisValue(source, ['adherence.tried_before', 'adherence.previous_attempts', 'tried_before'])),
      scoreFrequency(pickAnamnesisValue(source, ['nutrition.weighs_food', 'weighs_food']), { positive: true }),
      scoreOrganization(pickAnamnesisValue(source, ['nutrition.self_evaluation', 'self_evaluation'])),
      scoreFrequency(pickAnamnesisValue(source, ['nutrition.off_plan_frequency', 'off_plan_frequency']), { positive: false }),
      scoreFrequency(pickAnamnesisValue(source, ['nutrition.stress_eating', 'stress_eating']), { positive: false }),
      scoreFrequency(pickAnamnesisValue(source, ['nutrition.binge_episodes', 'binge_episodes']), { positive: false })
    ], 2),
    risk_score: averageScore([
      scoreFrequency(pickAnamnesisValue(source, ['nutrition.binge_episodes', 'binge_episodes']), { positive: true }),
      scoreFrequency(pickAnamnesisValue(source, ['nutrition.stress_eating', 'stress_eating']), { positive: true }),
      scoreNumber(pickAnamnesisValue(source, ['recovery.stress_level', 'stress_level']), { min: 0, max: 10 }),
      scoreSleepQuality(pickAnamnesisValue(source, ['recovery.sleep_quality', 'sleep.sleep_quality', 'sleep_quality']), { invert: true }),
      scoreBarrier(pickAnamnesisValue(source, ['adherence.consistency_barrier', 'adherence.difficulty', 'consistency_barrier']), { invert: false }),
      scoreMedicalText(pickAnamnesisValue(source, ['training.injuries_pain', 'injuries_pain'])),
      scoreMedicalText(pickAnamnesisValue(source, ['health.conditions', 'clinical.conditions', 'conditions'])),
      scoreMedicalText(pickAnamnesisValue(source, ['health.medications', 'clinical.medications', 'medications'])),
      scoreMedicalText(pickAnamnesisValue(source, ['health.hormones', 'clinical.hormones', 'hormones']))
    ], 2),
    routine_score: averageScore([
      scoreYesNo(pickAnamnesisValue(source, ['routine.allows_planning', 'routine.availability', 'allows_planning']), { yes: 10, no: 2 }),
      scoreWorkHours(pickAnamnesisValue(source, ['routine.work_hours', 'work_hours'])),
      scoreRoutineFlow(pickAnamnesisValue(source, ['routine.flow', 'routine.routine_flow', 'flow'])),
      scoreBarrier(pickAnamnesisValue(source, ['routine.organization_barrier', 'organization_barrier']), { invert: true }),
      scoreYesNo(pickAnamnesisValue(source, ['routine.prepares_meals', 'prepares_meals']), { yes: 10, no: 3, sometimes: 6 }),
      scoreYesNo(pickAnamnesisValue(source, ['nutrition.defined_schedule', 'defined_schedule']), { yes: 10, no: 2 }),
      scoreMealsPerDay(pickAnamnesisValue(source, ['nutrition.meals_per_day', 'meals_per_day']))
    ], 2),
    recovery_score: averageScore([
      scoreSleepQuality(pickAnamnesisValue(source, ['recovery.sleep_quality', 'sleep.sleep_quality', 'sleep_quality'])),
      scoreSleepHours(pickAnamnesisValue(source, ['recovery.sleep_hours', 'sleep.hours', 'sleep_hours'])),
      scoreNumber(pickAnamnesisValue(source, ['recovery.stress_level', 'stress_level']), { min: 0, max: 10, invert: true }),
      scoreNumber(pickAnamnesisValue(source, ['recovery.daily_energy', 'daily_energy']), { min: 0, max: 10 }),
      scoreYesNo(pickAnamnesisValue(source, ['recovery.wakes_rested', 'wakes_rested']), { yes: 10, no: 2, sometimes: 6 })
    ], 2)
  };
}

function pickAnamnesisValue(source, paths) {
  for (const path of paths) {
    const value = path.split('.').reduce((current, key) => current?.[key], source);
    if (hasAnamnesisValue(value)) return value;
  }
  return null;
}

function hasAnamnesisValue(value) {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'string') return value.trim() !== '';
  return true;
}

function averageScore(values, minimumSignals = 2) {
  const valid = values.filter((value) => Number.isFinite(value));
  if (valid.length < minimumSignals) return null;
  const average = valid.reduce((sum, value) => sum + value, 0) / valid.length;
  return Math.max(0, Math.min(10, Math.round(average)));
}

function scoreNumber(value, { min = 0, max = 10, invert = false } = {}) {
  if (!hasAnamnesisValue(value)) return null;
  const parsed = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  if (!Number.isFinite(parsed)) return null;
  const normalized = ((parsed - min) / (max - min)) * 10;
  const score = invert ? 10 - normalized : normalized;
  return clampScore(score);
}

function scoreYesNo(value, { yes = 10, no = 0, sometimes = 5 } = {}) {
  const text = normalizeScoreText(value);
  if (!text) return null;
  if (text.includes('as vezes') || text.includes('às vezes') || text.includes('parcial') || text.includes('medio')) return sometimes;
  if (text.includes('sim') || text.includes('tenho') || text.includes('consigo')) return yes;
  if (text.includes('nao') || text.includes('não') || text.includes('nunca')) return no;
  return null;
}

function scoreFrequency(value, { positive = true } = {}) {
  const text = normalizeScoreText(value);
  if (!text) return null;
  let risk;
  if (text.includes('quase nunca') || text.includes('nunca') || text.includes('nao') || text.includes('não')) risk = 0;
  else if (text.includes('as vezes') || text.includes('às vezes') || text.includes('1-2') || text.includes('1 a 2') || text.includes('pouco')) risk = 3;
  else if (text.includes('sim')) risk = 8;
  else if (text.includes('3-4') || text.includes('3 a 4') || text.includes('moderad') || text.includes('razoavel')) risk = 6;
  else if (text.includes('5 ou mais') || text.includes('frequent') || text.includes('sempre') || text.includes('muito')) risk = 9;
  else return null;
  return positive ? risk : 10 - risk;
}

function scoreOrganization(value) {
  const text = normalizeScoreText(value);
  if (!text) return null;
  if (text.includes('muito desorganizada')) return 1;
  if (text.includes('pouco organizada')) return 3;
  if (text.includes('razoavelmente organizada')) return 6;
  if (text.includes('bem organizada')) return 8;
  if (text.includes('muito organizada')) return 10;
  return scoreBarrier(value, { invert: true });
}

function scoreSleepQuality(value, { invert = false } = {}) {
  const text = normalizeScoreText(value);
  if (!text) return null;
  let score = null;
  if (text.includes('muito ruim') || text.includes('pessim') || text.includes('péssim')) score = 1;
  else if (text.includes('ruim')) score = 3;
  else if (text.includes('regular') || text.includes('razoavel') || text.includes('razoável')) score = 5;
  else if (text.includes('boa') || text.includes('bom')) score = 8;
  else if (text.includes('excelente') || text.includes('muito boa')) score = 10;
  return score === null ? null : invert ? 10 - score : score;
}

function scoreSleepHours(value) {
  const text = String(value ?? '').toLowerCase();
  const match = text.match(/\d+(?:[,.]\d+)?/);
  if (!match) return null;
  const hours = Number(match[0].replace(',', '.'));
  if (!Number.isFinite(hours)) return null;
  if (hours >= 7 && hours <= 9) return 10;
  if (hours >= 6 && hours < 7) return 7;
  if (hours >= 5 && hours < 6) return 4;
  if (hours > 9 && hours <= 10) return 7;
  return 2;
}

function scoreMealsPerDay(value) {
  const text = normalizeScoreText(value);
  if (!text) return null;
  if (text.includes('1-2') || text.includes('1 a 2')) return 3;
  if (text.includes('3 refei')) return 7;
  if (text.includes('4 refei') || text.includes('5 refei')) return 10;
  if (text.includes('6 ou mais')) return 8;
  return null;
}

function scoreWorkHours(value) {
  const text = normalizeScoreText(value);
  if (!text) return null;
  const numbers = [...text.matchAll(/\d+(?:[,.]\d+)?/g)].map((match) => Number(match[0].replace(',', '.'))).filter(Number.isFinite);
  const hours = numbers.length ? Math.max(...numbers) : null;
  if (hours !== null) {
    if (hours <= 8) return 9;
    if (hours <= 10) return 7;
    if (hours <= 12) return 5;
    return 3;
  }
  if (text.includes('flexivel') || text.includes('flexível') || text.includes('tranquil')) return 9;
  if (text.includes('plantao') || text.includes('plantão') || text.includes('escala') || text.includes('muito')) return 4;
  return null;
}

function scoreRoutineFlow(value) {
  const text = normalizeScoreText(value);
  if (!text) return null;
  if (text.includes('organizada') || text.includes('previsivel') || text.includes('previsível') || text.includes('tranquil')) return 9;
  if (text.includes('corrida') || text.includes('imprevisivel') || text.includes('imprevisível') || text.includes('caotica') || text.includes('caótica')) return 3;
  if (text.includes('razoavel') || text.includes('razoável') || text.includes('regular')) return 6;
  return null;
}

function scoreBarrier(value, { invert = false } = {}) {
  const text = normalizeScoreText(value);
  if (!text) return null;
  let barrier;
  if (text.includes('nenhum') || text.includes('sem barreira') || text.includes('nao tenho') || text.includes('não tenho')) barrier = 0;
  else if (text.includes('pouco') || text.includes('pequeno')) barrier = 3;
  else if (text.includes('tempo') || text.includes('rotina') || text.includes('organiz') || text.includes('ansiedade') || text.includes('estresse')) barrier = 6;
  else if (text.includes('muito') || text.includes('sempre') || text.includes('compuls') || text.includes('lesao') || text.includes('lesão')) barrier = 8;
  else barrier = 5;
  return invert ? 10 - barrier : barrier;
}

function scoreTriedBefore(value) {
  const text = normalizeScoreText(value);
  if (!text) return null;
  if (text.includes('nunca') || text.includes('nao') || text.includes('não')) return 6;
  return 7;
}

function scoreMedicalText(value) {
  const text = normalizeScoreText(value);
  if (!text) return null;
  if (text.includes('nenhum') || text.includes('nao') || text.includes('não') || text.includes('sem ')) return 0;
  if (text.includes('grave') || text.includes('cron') || text.includes('crôn') || text.includes('lesao') || text.includes('lesão') || text.includes('dor')) return 8;
  return 5;
}

function clampScore(score) {
  if (!Number.isFinite(score)) return null;
  return Math.max(0, Math.min(10, score));
}

function normalizeScoreText(value) {
  if (!hasAnamnesisValue(value)) return '';
  return String(Array.isArray(value) ? value.join(' ') : value).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function safeJsonParseArray(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function safeJsonParseObject(raw) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,x-admin-session,x-admin-token,x-student-email,x-student-token'
  };
}

function corsResponse() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders()
  });
}

function generateAccessToken() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}


const PROJECT_LM_LIBRARY_UNLOCK_RULES = new Set([
  'always',
  'first_victory',
  'hard_day_mode',
  'streak_3',
  'streak_7',
  'streak_14',
  'streak_21',
  'streak_30',
  'streak_45',
  'streak_60'
]);

const PROJECT_LM_LIBRARY_SEED = [
  ['como-comecar-e-continuar', 'Como começar e continuar', 'O primeiro passo para sair do ciclo de recomeços e proteger o básico.', 'always'],
  ['a-regra-do-minimo', 'A Regra do Mínimo', 'Como transformar dias difíceis em dias válidos, sem depender de perfeição.', 'always'],
  ['o-erro-de-recomecar-toda-segunda', 'O Erro de Recomeçar Toda Segunda', 'Por que esperar a próxima segunda enfraquece sua consistência.', 'first_victory'],
  ['consistencia-vence-intensidade', 'Consistência Vence Intensidade', 'Aprenda a construir resultado repetindo o possível.', 'hard_day_mode'],
  ['como-recomecar-sem-culpa', 'Como Recomeçar Sem Culpa', 'Um caminho simples para voltar sem compensação e sem extremos.', 'streak_3'],
  ['pare-de-procurar-a-dieta-perfeita', 'Pare de Procurar a Dieta Perfeita', 'Organização e aderência antes de trocar de método.', 'streak_7'],
  ['o-processo-acima-do-resultado', 'O Processo Acima do Resultado', 'Como medir evolução antes da balança confirmar.', 'streak_14'],
  ['como-nao-abandonar-depois-de-uma-semana-ruim', 'Como Não Abandonar Depois de uma Semana Ruim', 'Estratégia para manter identidade e direção após uma semana instável.', 'streak_21'],
  ['o-que-fazer-quando-a-motivacao-sumir', 'O Que Fazer Quando a Motivação Sumir', 'Como continuar quando a vontade não aparece.', 'streak_30'],
  ['a-pessoa-que-voce-esta-se-tornando', 'A Pessoa Que Você Está Se Tornando', 'Consolide a visão de longo prazo construída pelas pequenas ações.', 'streak_45']
];

const PROJECT_LM_WEEKLY_MISSIONS_SEED = [
  [1, 'Pare de Recomeçar', 'Seu objetivo nesta semana não é emagrecer rápido. É criar movimento.', 'Cumprir 3 ações mínimas.', '3 ações registradas.'],
  [2, 'Proteja os Dias Difíceis', 'Aprenda a continuar mesmo quando a rotina apertar.', 'Utilizar o Modo Dia Difícil pelo menos uma vez.', '1 utilização registrada.'],
  [3, 'Construa Repetição', 'O foco agora é repetir comportamentos simples.', 'Completar 5 dias ativos.', '5 registros de consistência.'],
  [4, 'Pensar Como Alguém Consistente', 'Consolidar tudo que foi construído.', 'Concluir a jornada inicial.', 'Finalizar as 4 semanas.']
];

function mapProjectLmLibraryRow(row, progress, unlockContext) {
  const completed = Boolean(progress?.has(row.slug));
  const unlocked = isProjectLmLibraryUnlocked(row.unlock_rule, unlockContext);
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    video_url: row.video_url || '',
    videoUrl: row.video_url || '',
    summary: row.summary || '',
    action_text: row.action_text || '',
    actionText: row.action_text || '',
    unlock_rule: row.unlock_rule || 'always',
    unlockRule: row.unlock_rule || 'always',
    sort_order: Number(row.sort_order || 0),
    sortOrder: Number(row.sort_order || 0),
    created_at: row.created_at,
    unlocked,
    locked: !unlocked,
    completed
  };
}

function isProjectLmLibraryUnlocked(rule, context = {}) {
  const normalizedRule = PROJECT_LM_LIBRARY_UNLOCK_RULES.has(rule) ? rule : 'always';
  if (normalizedRule === 'always') return true;
  if (normalizedRule === 'first_victory') return Boolean(context.firstVictoryCompleted);
  if (normalizedRule === 'hard_day_mode') return Boolean(context.hardDayModeCompleted);
  const streakMatch = normalizedRule.match(/^streak_(\d+)$/);
  if (streakMatch) return Number(context.bestStreak || context.currentStreak || 0) >= Number(streakMatch[1]);
  return false;
}

async function getProjectLmLibraryUnlockContext(db, studentEmail) {
  const [summary, consistency] = await Promise.all([
    getProjectLmDailyActionsSummary(db, studentEmail),
    getProjectLmConsistency(db, studentEmail)
  ]);
  return {
    firstVictoryCompleted: Boolean(summary.firstVictoryCompleted),
    hardDayModeCompleted: Boolean(summary.hardDayModeCompleted),
    currentStreak: Number(consistency.currentStreak || summary.currentStreak || 0),
    bestStreak: Number(consistency.bestStreak || summary.currentStreak || 0)
  };
}

async function getProjectLmLibraryProgress(db, studentEmail) {
  const { results = [] } = await db.prepare(
    `SELECT content_slug, completed_at
     FROM project_lm_library_progress
     WHERE lower(student_email)=? AND completed=1`
  ).bind(String(studentEmail || '').trim().toLowerCase()).all();
  return new Map((results || []).map((row) => [row.content_slug, row.completed_at]));
}

async function getProjectLmLibrary(db, studentEmail) {
  const { results = [] } = await db.prepare(
    `SELECT id, slug, title, description, video_url, summary, action_text, unlock_rule, sort_order, created_at
     FROM project_lm_library_content
     ORDER BY sort_order ASC, title ASC`
  ).all();
  const [progress, unlockContext] = await Promise.all([
    getProjectLmLibraryProgress(db, studentEmail),
    getProjectLmLibraryUnlockContext(db, studentEmail)
  ]);
  return (results || []).map((row) => mapProjectLmLibraryRow(row, progress, unlockContext));
}

async function getProjectLmLibraryContent(db, studentEmail, slug) {
  const row = await db.prepare(
    `SELECT id, slug, title, description, video_url, summary, action_text, unlock_rule, sort_order, created_at
     FROM project_lm_library_content
     WHERE slug=?
     LIMIT 1`
  ).bind(String(slug || '').trim()).first();
  if (!row) return null;
  const [progress, unlockContext] = await Promise.all([
    getProjectLmLibraryProgress(db, studentEmail),
    getProjectLmLibraryUnlockContext(db, studentEmail)
  ]);
  return mapProjectLmLibraryRow(row, progress, unlockContext);
}

async function completeProjectLmLibraryContent(db, studentEmail, slug) {
  const normalizedEmail = String(studentEmail || '').trim().toLowerCase();
  const normalizedSlug = String(slug || '').trim();
  const now = new Date().toISOString();
  const existing = await db.prepare(
    `SELECT id, completed_at
     FROM project_lm_library_progress
     WHERE lower(student_email)=? AND content_slug=?
     LIMIT 1`
  ).bind(normalizedEmail, normalizedSlug).first();

  if (existing) {
    await db.prepare(
      `UPDATE project_lm_library_progress
       SET completed=1, completed_at=COALESCE(completed_at, ?)
       WHERE id=?`
    ).bind(now, existing.id).run();
    return { id: existing.id, slug: normalizedSlug, completed: true, completed_at: existing.completed_at || now, alreadyCompleted: Boolean(existing.completed_at) };
  }

  const id = crypto.randomUUID();
  await db.prepare(
    `INSERT INTO project_lm_library_progress (id, student_email, content_slug, completed, completed_at)
     VALUES (?, ?, ?, 1, ?)`
  ).bind(id, normalizedEmail, normalizedSlug, now).run();
  return { id, slug: normalizedSlug, completed: true, completed_at: now, alreadyCompleted: false };
}

async function seedProjectLmLibraryContent(db) {
  const now = new Date().toISOString();
  for (const [index, item] of PROJECT_LM_LIBRARY_SEED.entries()) {
    const [slug, title, description, unlockRule] = item;
    await db.prepare(
      `INSERT OR IGNORE INTO project_lm_library_content (
        id, slug, title, description, video_url, summary, action_text, unlock_rule, sort_order, created_at
      ) VALUES (?, ?, ?, ?, '', ?, ?, ?, ?, ?)`
    ).bind(
      `project-lm-library-${String(index + 1).padStart(2, '0')}`,
      slug,
      title,
      description,
      `Resumo inicial preparado para o conteúdo “${title}”. O vídeo será cadastrado em uma etapa futura.`,
      'Escolha uma ação mínima relacionada ao tema e registre como você vai aplicá-la hoje.',
      unlockRule,
      index + 1,
      now
    ).run();
  }
}

async function seedProjectLmWeeklyMissions(db) {
  for (const mission of PROJECT_LM_WEEKLY_MISSIONS_SEED) {
    await db.prepare(
      `INSERT OR REPLACE INTO project_lm_weekly_missions (
        week_number, title, description, main_mission, success_criteria
      ) VALUES (?, ?, ?, ?, ?)`
    ).bind(...mission).run();
  }
}

const PROJECT_LM_GOALS = new Set([
  'emagrecer_com_consistencia',
  'voltar_a_treinar',
  'melhorar_alimentacao',
  'mais_energia',
  'recomecar_sem_extremos'
]);

const PROJECT_LM_DIFFICULTIES = new Set([
  'falta_de_tempo',
  'alimentacao_desorganizada',
  'cansaco',
  'falta_de_constancia',
  'abandono',
  'nao_sei_por_onde_comecar'
]);

const PROJECT_LM_PROFILE_SEXES = new Set(['female', 'male']);
const PROJECT_LM_PROFILE_GOALS = new Set([
  'Emagrecer com direção',
  'Voltar a ter constância',
  'Melhorar minha alimentação',
  'Sair do ciclo de recomeçar'
]);

const PROJECT_LM_DAILY_ACTION_TYPES = new Set([
  'primeira_vitoria',
  'modo_dia_dificil',
  'acao_minima',
  'treino',
  'alimentacao'
]);


function projectLm2Error(error, status = 400, code = 'PROJECT_LM_2_ERROR') {
  return { status, payload: { ok: false, error, code } };
}

function projectLm2Success(data, status = 200) {
  return { status, payload: { ok: true, data } };
}

function projectLm2StudentId(student) {
  return String(student?.id || student?.email || '').trim();
}

function projectLm2NutritionPlanId(sex, weightKg) {
  if (sex === 'female') {
    if (weightKg < 70) return 'M1';
    if (weightKg < 90) return 'M2';
    return 'M3';
  }
  if (weightKg < 80) return 'H1';
  if (weightKg < 100) return 'H2';
  return 'H3';
}

function projectLm2TrainingPlanId(sex) {
  return sex === 'female' ? 'gym_female' : 'gym_male';
}

function projectLm2ValidateOnboarding(body) {
  const name = requiredText(body?.name);
  if (!name) return projectLm2Error('name é obrigatório.', 400, 'NAME_REQUIRED');
  const goal = requiredText(body?.goal);
  if (!goal) return projectLm2Error('goal é obrigatório.', 400, 'GOAL_REQUIRED');
  const sex = String(body?.sex || '').trim().toLowerCase();
  if (!['male', 'female'].includes(sex)) return projectLm2Error('sex deve ser male ou female.', 400, 'INVALID_SEX');
  const weightKg = Number(body?.weight_kg);
  if (!Number.isFinite(weightKg) || weightKg <= 30 || weightKg >= 250) return projectLm2Error('weight_kg deve ser numérico e maior que 30 e menor que 250.', 400, 'INVALID_WEIGHT');
  const rawHeight = body?.height_cm ?? body?.heightCm;
  const heightCm = rawHeight === undefined || rawHeight === null || rawHeight === '' ? null : Number(rawHeight);
  if (heightCm !== null && (!Number.isFinite(heightCm) || heightCm <= 120 || heightCm >= 230)) return projectLm2Error('height_cm deve ser numérico e maior que 120 e menor que 230.', 400, 'INVALID_HEIGHT');
  return { ok: true, profile: { name, goal, sex, weightKg, heightCm } };
}

function projectLm2BuildWeek2Status(journey, week2 = null, progress = projectLm2ProgressData(0, false)) {
  const continuityDaysCount = Number(progress.continuity_days_count || 0);
  const requiredDaysCount = Number(progress.required_days_count || 5);
  const videoCompleted = Boolean(week2?.video_completed);
  const reflectionCompleted = Boolean(week2?.reflection);
  const minimumResponseCompleted = Boolean(week2?.minimum_response);
  const weekCompleted = videoCompleted && reflectionCompleted && minimumResponseCompleted && continuityDaysCount >= requiredDaysCount;
  return {
    current_week: Number(journey?.current_week || 2),
    week_completed: weekCompleted,
    video_completed: videoCompleted,
    reflection_completed: reflectionCompleted,
    minimum_response_completed: minimumResponseCompleted,
    continuity_days_count: continuityDaysCount,
    required_days_count: requiredDaysCount,
    remaining_days: Math.max(requiredDaysCount - continuityDaysCount, 0),
    next_week_available: weekCompleted
  };
}

function projectLm2Week2StatusData(week2 = null, progress = projectLm2ProgressData(0, false), journey = { current_week: 2 }) {
  return projectLm2BuildWeek2Status(journey, week2, progress);
}

function projectLm2NextAction(week1, todayCheckinCompleted = false, weekStatus = null, journey = null, week2 = null) {
  const currentWeek = Number(journey?.current_week || 1);
  if (journey?.status === 'completed' || journey?.program_completed_at) return 'program_completed';
  if (currentWeek === 2) {
    const week2Status = projectLm2Week2StatusData(week2, weekStatus || projectLm2ProgressData(0, todayCheckinCompleted), journey);
    if (week2Status.week_completed) return 'week_2_complete';
    if (!week2Status.video_completed) return 'week_2_video';
    if (!week2Status.reflection_completed) return 'week_2_reflection';
    if (!week2Status.minimum_response_completed) return 'week_2_minimum_response';
    if (!todayCheckinCompleted) return 'daily_checkin';
    return 'checkin_completed_today';
  }
  if (weekStatus?.week_completed) return 'week_1_complete';
  if (!week1?.video_completed) return 'week_1_video';
  if (!week1?.plan_b_saved_at) return 'create_plan_b';
  if (!todayCheckinCompleted) return 'daily_checkin';
  return 'checkin_completed_today';
}

function projectLm2WeekFoundationStatus(week = null) {
  const videoCompleted = Boolean(week?.video_completed);
  const reflectionCompleted = Boolean(week?.reflection);
  const minimumResponseCompleted = Boolean(week?.minimum_response);
  return {
    video_completed: videoCompleted,
    reflection_completed: reflectionCompleted,
    minimum_response_completed: minimumResponseCompleted,
    week_completed: Boolean(week?.completed_at)
  };
}

function projectLm2WeekTable(weekNumber) {
  if (Number(weekNumber) === 3) return 'lm2_week_3_foundation';
  if (Number(weekNumber) === 4) return 'lm2_week_4_foundation';
  return null;
}

function projectLm2BuildWeekStatus(journey, week1 = null, progress = projectLm2ProgressData(0, false)) {
  const continuityDaysCount = Number(progress.continuity_days_count || 0);
  const requiredDaysCount = Number(progress.required_days_count || 5);
  const videoCompleted = Boolean(week1?.video_completed);
  const planBCompleted = Boolean(week1?.plan_b_saved_at);
  const weekCompleted = videoCompleted && planBCompleted && continuityDaysCount >= requiredDaysCount;
  return {
    current_week: Number(journey?.current_week || 1),
    week_completed: weekCompleted,
    video_completed: videoCompleted,
    plan_b_completed: planBCompleted,
    continuity_days_count: continuityDaysCount,
    required_days_count: requiredDaysCount,
    remaining_days: Math.max(requiredDaysCount - continuityDaysCount, 0),
    next_week_available: weekCompleted
  };
}

function projectLm2HomeData(profile, journey, week1 = null, progress = projectLm2ProgressData(0, false), week2 = null, week3 = null, week4 = null) {
  const currentWeek = Number(journey?.current_week || 1);
  const weekStatus = currentWeek === 2 ? projectLm2BuildWeek2Status(journey, week2, progress) : projectLm2BuildWeekStatus(journey, week1, progress);
  const week2Status = projectLm2Week2StatusData(week2, progress, journey);
  const nextAction = projectLm2NextAction(week1, progress.today_checkin_completed, weekStatus, journey, week2);
  const week3Status = projectLm2WeekFoundationStatus(week3);
  const week4Status = projectLm2WeekFoundationStatus(week4);
  const nextActionLabels = {
    week_1_complete: 'Continuar para Semana 2',
    week_2_video: 'Assistir à aula da Semana 2',
    week_2_reflection: 'Salvar reflexão da Semana 2',
    week_2_minimum_response: 'Salvar resposta mínima da Semana 2',
    week_2_complete: 'Continuar para Semana 3',
    program_completed: 'Conhecer Consultoria Premium'
  };
  return {
    name: profile?.name,
    onboarding_completed: Boolean(profile?.onboarding_completed ?? 1),
    current_week: Number(journey?.current_week || 1),
    week_started_at: journey?.week_started_at || null,
    week_completed_at: journey?.week_completed_at || null,
    continuity_days_count: progress.continuity_days_count,
    required_days_count: progress.required_days_count,
    remaining_days: progress.remaining_days,
    goal_reached: progress.goal_reached,
    today_checkin_completed: progress.today_checkin_completed,
    week_status: weekStatus,
    week_completed: weekStatus.week_completed,
    next_week_available: weekStatus.next_week_available,
    next_action: nextAction,
    next_action_label: nextActionLabels[nextAction] || null,
    week_1_video_completed: Boolean(week1?.video_completed),
    plan_b_completed: Boolean(week1?.plan_b_saved_at),
    plan_b: {
      unable_to_train: week1?.unable_to_train || '',
      overeating: week1?.overeating || '',
      no_motivation: week1?.no_motivation || ''
    },
    week_2_status: week2Status,
    week_2_video_completed: week2Status.video_completed,
    week_2_reflection_completed: week2Status.reflection_completed,
    week_2_response_completed: week2Status.minimum_response_completed,
    week_2_completed: week2Status.week_completed,
    week_3_available: week2Status.next_week_available || currentWeek >= 3,
    week_2_reflection: week2?.reflection || '',
    week_2_minimum_response: week2?.minimum_response || '',
    week_3_video_completed: week3Status.video_completed,
    week_3_reflection_completed: week3Status.reflection_completed,
    week_3_response_completed: week3Status.minimum_response_completed,
    week_3_completed: week3Status.week_completed,
    week_3_reflection: week3?.reflection || '',
    week_3_minimum_response: week3?.minimum_response || '',
    week_4_video_completed: week4Status.video_completed,
    week_4_reflection_completed: week4Status.reflection_completed,
    week_4_response_completed: week4Status.minimum_response_completed,
    week_4_completed: week4Status.week_completed,
    week_4_reflection: week4?.reflection || '',
    week_4_minimum_response: week4?.minimum_response || '',
    program_completed: Boolean(journey?.program_completed_at || journey?.status === 'completed'),
    program_completed_at: journey?.program_completed_at || journey?.completed_at || null,
    premium_bridge_eligible: Boolean(journey?.premium_bridge_eligible),
    nutrition_ready: true,
    training_ready: true,
    nutrition_label: 'Seu plano alimentar está pronto.',
    training_label: 'Seu treino está pronto.',
    goal: profile?.goal,
    sex: profile?.sex,
    weight_kg: profile?.weight_kg,
    height_cm: profile?.height_cm || null
  };
}


function projectLm2Today() {
  return new Date().toISOString().slice(0, 10);
}

function projectLm2ProgressData(continuityDaysCount, todayCheckinCompleted = false) {
  const requiredDaysCount = 5;
  const continuity_days_count = Number(continuityDaysCount || 0);
  return {
    continuity_days_count,
    required_days_count: requiredDaysCount,
    remaining_days: Math.max(requiredDaysCount - continuity_days_count, 0),
    goal_reached: continuity_days_count >= requiredDaysCount,
    today_checkin_completed: Boolean(todayCheckinCompleted)
  };
}

async function projectLm2Progress(db, student, journey = null) {
  const studentId = projectLm2StudentId(student);
  const weekNumber = Number(journey?.current_week || 1);
  const today = projectLm2Today();
  const row = await db.prepare(`SELECT COALESCE(SUM(continuity_point), 0) AS total FROM lm2_checkins WHERE student_id=? AND week_number=?`).bind(studentId, weekNumber).first();
  const todayRow = await db.prepare(`SELECT answer FROM lm2_checkins WHERE student_id=? AND checkin_date=? LIMIT 1`).bind(studentId, today).first();
  return projectLm2ProgressData(row?.total || 0, Boolean(todayRow));
}

async function projectLm2GetProgress(db, student) {
  const journey = await projectLm2GetJourney(db, student);
  return projectLm2Success(await projectLm2Progress(db, student, journey || { current_week: 1 }));
}

async function projectLm2GetWeekStatus(db, student) {
  const profile = await projectLm2GetProfile(db, student);
  if (!profile) return projectLm2Error('Onboarding obrigatório antes do status semanal.', 409, 'ONBOARDING_REQUIRED');
  const journey = await projectLm2GetJourney(db, student);
  const currentJourney = journey || { current_week: 1 };
  const progress = await projectLm2Progress(db, student, currentJourney);
  if (Number(currentJourney.current_week || 1) === 2) {
    const week2 = await projectLm2EnsureWeek2(db, student);
    return projectLm2Success(projectLm2BuildWeek2Status(currentJourney, week2, progress));
  }
  const week1 = await projectLm2EnsureWeek1(db, student);
  return projectLm2Success(projectLm2BuildWeekStatus(currentJourney, week1, progress));
}

async function projectLm2GetWeek2Status(db, student) {
  const profile = await projectLm2GetProfile(db, student);
  if (!profile) return projectLm2Error('Onboarding obrigatório antes do status da Semana 2.', 409, 'ONBOARDING_REQUIRED');
  const journey = await projectLm2GetJourney(db, student);
  const week2 = await projectLm2EnsureWeek2(db, student);
  const progress = await projectLm2Progress(db, student, journey || { current_week: 2 });
  return projectLm2Success(projectLm2BuildWeek2Status(journey || { current_week: 2 }, week2, progress));
}

async function projectLm2SaveCheckin(db, student, body) {
  const answer = String(body?.answer || '').trim();
  const points = { on_track: 1, adapted: 1, off_track: 0 };
  if (!Object.prototype.hasOwnProperty.call(points, answer)) return projectLm2Error('Resposta inválida para o check-in.', 400, 'INVALID_CHECKIN_ANSWER');
  const profile = await projectLm2GetProfile(db, student);
  if (!profile) return projectLm2Error('Onboarding obrigatório antes do check-in.', 409, 'ONBOARDING_REQUIRED');
  const studentId = projectLm2StudentId(student);
  const journey = await projectLm2GetJourney(db, student);
  const weekNumber = Number(journey?.current_week || 1);
  const today = projectLm2Today();
  const existing = await db.prepare(`SELECT answer FROM lm2_checkins WHERE student_id=? AND checkin_date=? LIMIT 1`).bind(studentId, today).first();
  if (existing) return projectLm2Error('Você já registrou o check-in de hoje.', 409, 'CHECKIN_ALREADY_COMPLETED');
  const now = new Date().toISOString();
  await db.prepare(`INSERT INTO lm2_checkins (student_id, checkin_date, week_number, answer, continuity_point, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(studentId, today, weekNumber, answer, points[answer], now, now).run();
  return projectLm2Success(await projectLm2Progress(db, student, journey || { current_week: weekNumber }), 201);
}

async function projectLm2GetProfile(db, student) {
  return db.prepare(`SELECT * FROM lm2_profiles WHERE student_id=? LIMIT 1`).bind(projectLm2StudentId(student)).first();
}

async function projectLm2GetJourney(db, student) {
  return db.prepare(`SELECT * FROM lm2_journeys WHERE student_id=? LIMIT 1`).bind(projectLm2StudentId(student)).first();
}

async function projectLm2GetWeek1(db, student) {
  return db.prepare(`SELECT * FROM lm2_week_1_foundation WHERE student_id=? LIMIT 1`).bind(projectLm2StudentId(student)).first();
}

async function projectLm2EnsureWeek1(db, student) {
  const existing = await projectLm2GetWeek1(db, student);
  if (existing) return existing;
  const now = new Date().toISOString();
  await db.prepare(`INSERT INTO lm2_week_1_foundation (student_id, video_completed, created_at, updated_at) VALUES (?, 0, ?, ?)`).bind(projectLm2StudentId(student), now, now).run();
  return projectLm2GetWeek1(db, student);
}

async function projectLm2GetWeek2(db, student) {
  return db.prepare(`SELECT * FROM lm2_week_2_foundation WHERE student_id=? LIMIT 1`).bind(projectLm2StudentId(student)).first();
}

async function projectLm2EnsureWeek2(db, student) {
  const existing = await projectLm2GetWeek2(db, student);
  if (existing) return existing;
  const now = new Date().toISOString();
  await db.prepare(`INSERT INTO lm2_week_2_foundation (student_id, video_completed, created_at, updated_at) VALUES (?, 0, ?, ?)`).bind(projectLm2StudentId(student), now, now).run();
  return projectLm2GetWeek2(db, student);
}

async function projectLm2GetWeekFoundation(db, student, weekNumber) {
  const table = projectLm2WeekTable(weekNumber);
  if (!table) return null;
  return db.prepare(`SELECT * FROM ${table} WHERE student_id=? LIMIT 1`).bind(projectLm2StudentId(student)).first();
}

async function projectLm2EnsureWeekFoundation(db, student, weekNumber) {
  const table = projectLm2WeekTable(weekNumber);
  if (!table) return null;
  const existing = await projectLm2GetWeekFoundation(db, student, weekNumber);
  if (existing) return existing;
  const now = new Date().toISOString();
  await db.prepare(`INSERT INTO ${table} (student_id, video_completed, created_at, updated_at) VALUES (?, 0, ?, ?)`).bind(projectLm2StudentId(student), now, now).run();
  return projectLm2GetWeekFoundation(db, student, weekNumber);
}


async function seedProjectLmTrainingPlans(db) {
  await db.prepare(`INSERT OR IGNORE INTO training_plans (id, code, name, audience, location) VALUES
    ('plan_gym_male', 'gym_male', 'Treino Academia Masculino', 'male', 'gym'),
    ('plan_gym_female', 'gym_female', 'Treino Academia Feminino', 'female', 'gym'),
    ('plan_home', 'home', 'Treino em Casa', 'all', 'home')`).run();
  await db.prepare(`INSERT OR IGNORE INTO training_sessions (id, plan_id, plan_code, code, name, week_day, order_index) VALUES
    ('session_gym_male_upper_a', 'plan_gym_male', 'gym_male', 'gym_male_upper_a', 'Upper A', 1, 1),
    ('session_gym_male_lower_a', 'plan_gym_male', 'gym_male', 'gym_male_lower_a', 'Lower A', 2, 2),
    ('session_gym_male_upper_b', 'plan_gym_male', 'gym_male', 'gym_male_upper_b', 'Upper B', 4, 3),
    ('session_gym_male_lower_b', 'plan_gym_male', 'gym_male', 'gym_male_lower_b', 'Lower B', 5, 4),
    ('session_gym_female_lower_a', 'plan_gym_female', 'gym_female', 'gym_female_lower_a', 'Lower A', 1, 1),
    ('session_gym_female_upper_a', 'plan_gym_female', 'gym_female', 'gym_female_upper_a', 'Upper A', 2, 2),
    ('session_gym_female_lower_b', 'plan_gym_female', 'gym_female', 'gym_female_lower_b', 'Lower B', 4, 3),
    ('session_gym_female_upper_b', 'plan_gym_female', 'gym_female', 'gym_female_upper_b', 'Upper B', 5, 4),
    ('session_home_casa_a', 'plan_home', 'home', 'home_casa_a', 'Casa A', 1, 1),
    ('session_home_casa_b', 'plan_home', 'home', 'home_casa_b', 'Casa B', 3, 2),
    ('session_home_casa_c', 'plan_home', 'home', 'home_casa_c', 'Casa C', 5, 3)`).run();
  await db.prepare(`INSERT OR IGNORE INTO training_exercises (id, session_id, session_code, order_index, exercise_key, name, sets, reps, rest_seconds, instruction_url, video_url) VALUES
    ('exercise_gym_male_upper_a_1', 'session_gym_male_upper_a', 'gym_male_upper_a', 1, 'bench_press_barbell', 'Supino reto', 4, '10–12', 90, '', ''),
    ('exercise_gym_male_upper_a_2', 'session_gym_male_upper_a', 'gym_male_upper_a', 2, 'low_row_machine', 'Remada baixa', 4, '10–12', 90, '', ''),
    ('exercise_gym_male_upper_a_3', 'session_gym_male_upper_a', 'gym_male_upper_a', 3, 'seated_shoulder_press', 'Desenvolvimento sentado', 3, '10–12', 75, '', ''),
    ('exercise_gym_female_lower_a_1', 'session_gym_female_lower_a', 'gym_female_lower_a', 1, 'barbell_squat', 'Agachamento livre', 4, '10–12', 90, '', ''),
    ('exercise_gym_female_lower_a_2', 'session_gym_female_lower_a', 'gym_female_lower_a', 2, 'leg_press', 'Leg press', 4, '10–12', 90, '', ''),
    ('exercise_gym_female_lower_a_3', 'session_gym_female_lower_a', 'gym_female_lower_a', 3, 'hip_thrust', 'Elevação pélvica', 4, '10–12', 90, '', ''),
    ('exercise_home_casa_a_1', 'session_home_casa_a', 'home_casa_a', 1, 'bodyweight_squat', 'Agachamento livre', 4, '10–12', 60, '', ''),
    ('exercise_home_casa_a_2', 'session_home_casa_a', 'home_casa_a', 2, 'incline_push_up', 'Flexão inclinada', 4, '8–12', 60, '', ''),
    ('exercise_home_casa_a_3', 'session_home_casa_a', 'home_casa_a', 3, 'front_plank', 'Prancha', 3, '30–45s', 45, '', '')`).run();
  await backfillProjectLmTrainingModel(db);
}


async function backfillProjectLmTrainingModel(db) {
  await db.prepare(`UPDATE training_sessions
    SET plan_id = (SELECT training_plans.id FROM training_plans WHERE training_plans.code = training_sessions.plan_code LIMIT 1)
    WHERE plan_id IS NULL`).run();
  await db.prepare(`UPDATE training_exercises
    SET session_id = (SELECT training_sessions.id FROM training_sessions WHERE training_sessions.code = training_exercises.session_code LIMIT 1)
    WHERE session_id IS NULL`).run();
  await db.prepare(`UPDATE training_exercises SET instruction_url = COALESCE(instruction_url, video_url, '') WHERE instruction_url IS NULL`).run();
  await db.prepare(`UPDATE training_exercises SET exercise_key = 'bench_press_barbell' WHERE exercise_key IS NULL AND name = 'Supino reto'`).run();
  await db.prepare(`UPDATE training_exercises SET exercise_key = 'low_row_machine' WHERE exercise_key IS NULL AND name = 'Remada baixa'`).run();
  await db.prepare(`UPDATE training_exercises SET exercise_key = 'seated_shoulder_press' WHERE exercise_key IS NULL AND name = 'Desenvolvimento sentado'`).run();
  await db.prepare(`UPDATE training_exercises SET exercise_key = 'bodyweight_squat' WHERE exercise_key IS NULL AND id = 'exercise_home_casa_a_1'`).run();
  await db.prepare(`UPDATE training_exercises SET exercise_key = 'barbell_squat' WHERE exercise_key IS NULL AND name = 'Agachamento livre'`).run();
  await db.prepare(`UPDATE training_exercises SET exercise_key = 'leg_press' WHERE exercise_key IS NULL AND name = 'Leg press'`).run();
  await db.prepare(`UPDATE training_exercises SET exercise_key = 'hip_thrust' WHERE exercise_key IS NULL AND name = 'Elevação pélvica'`).run();
  await db.prepare(`UPDATE training_exercises SET exercise_key = 'incline_push_up' WHERE exercise_key IS NULL AND name = 'Flexão inclinada'`).run();
  await db.prepare(`UPDATE training_exercises SET exercise_key = 'front_plank' WHERE exercise_key IS NULL AND name = 'Prancha'`).run();
}

async function projectLm2GetTraining(db, student) {
  const profile = await projectLm2GetProfile(db, student);
  if (!profile) return projectLm2Error('Onboarding obrigatório antes do treino.', 409, 'ONBOARDING_REQUIRED');
  const plan = await db.prepare(`SELECT id, code, name FROM training_plans WHERE code=? AND active=1 LIMIT 1`).bind(profile.training_plan_id).first();
  if (!plan) return projectLm2Error('Treino indisponível.', 404, 'TRAINING_NOT_FOUND');
  const session = await db.prepare(`SELECT id, code, name FROM training_sessions WHERE plan_id=? AND active=1 ORDER BY order_index ASC LIMIT 1`).bind(plan.id).first();
  if (!session) return projectLm2Error('Sessão de treino indisponível.', 404, 'TRAINING_SESSION_NOT_FOUND');
  const { results = [] } = await db.prepare(`SELECT exercise_key, name, sets, reps, rest_seconds, instruction_url FROM training_exercises WHERE session_id=? AND active=1 ORDER BY order_index ASC`).bind(session.id).all();
  return projectLm2Success({ plan: { code: plan.code, name: plan.name }, session: { code: session.code, name: session.name }, exercises: results });
}

async function projectLm2SaveOnboarding(db, student, body) {
  const validation = projectLm2ValidateOnboarding(body);
  if (!validation.ok) return validation;
  const studentId = projectLm2StudentId(student);
  if (!studentId) return projectLm2Error('student_id autenticado é obrigatório.', 401, 'STUDENT_REQUIRED');
  const { name, goal, sex, weightKg, heightCm } = validation.profile;
  const nutritionPlanId = projectLm2NutritionPlanId(sex, weightKg);
  const trainingPlanId = projectLm2TrainingPlanId(sex);
  const now = new Date().toISOString();
  const existingProfile = await projectLm2GetProfile(db, student);
  if (existingProfile) {
    await db.prepare(`UPDATE lm2_profiles SET name=?, goal=?, sex=?, weight_kg=?, height_cm=?, nutrition_plan_id=?, training_plan_id=?, onboarding_completed=1, updated_at=? WHERE student_id=?`).bind(name, goal, sex, weightKg, heightCm, nutritionPlanId, trainingPlanId, now, studentId).run();
  } else {
    await db.prepare(`INSERT INTO lm2_profiles (student_id, name, goal, sex, weight_kg, height_cm, nutrition_plan_id, training_plan_id, onboarding_completed, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`).bind(studentId, name, goal, sex, weightKg, heightCm, nutritionPlanId, trainingPlanId, now, now).run();
  }
  let journey = await projectLm2GetJourney(db, student);
  if (!journey) {
    await db.prepare(`INSERT INTO lm2_journeys (student_id, current_week, status, started_at, completed_at, week_started_at, week_completed_at, created_at, updated_at) VALUES (?, 1, 'active', ?, NULL, NULL, NULL, ?, ?)`).bind(studentId, now, now, now).run();
    journey = await projectLm2GetJourney(db, student);
  }
  const profile = await projectLm2GetProfile(db, student);
  const week1 = await projectLm2EnsureWeek1(db, student);
  return projectLm2Success(projectLm2HomeData(profile, journey, week1, await projectLm2Progress(db, student, journey)));
}

async function projectLm2GetHome(db, student) {
  const profile = await projectLm2GetProfile(db, student);
  if (!profile) return projectLm2Success({ onboarding_completed: false, state: 'onboarding_required', next_action: 'start_onboarding' });
  const journey = await projectLm2GetJourney(db, student);
  const week1 = await projectLm2EnsureWeek1(db, student);
  const week2 = Number(journey?.current_week || 1) === 2 ? await projectLm2EnsureWeek2(db, student) : null;
  const week3 = Number(journey?.current_week || 1) >= 3 ? await projectLm2EnsureWeekFoundation(db, student, 3) : null;
  const week4 = Number(journey?.current_week || 1) >= 4 || journey?.program_completed_at ? await projectLm2EnsureWeekFoundation(db, student, 4) : null;
  const progress = await projectLm2Progress(db, student, journey || { current_week: 1 });
  return projectLm2Success(projectLm2HomeData(profile, journey || { current_week: 1 }, week1, progress, week2, week3, week4));
}

async function projectLm2CompleteWeek1Video(db, student) {
  const profile = await projectLm2GetProfile(db, student);
  if (!profile) return projectLm2Error('Onboarding obrigatório antes da Semana 1.', 409, 'ONBOARDING_REQUIRED');
  await projectLm2EnsureWeek1(db, student);
  const now = new Date().toISOString();
  await db.prepare(`UPDATE lm2_week_1_foundation SET video_completed=1, video_completed_at=COALESCE(video_completed_at, ?), updated_at=? WHERE student_id=?`).bind(now, now, projectLm2StudentId(student)).run();
  const week1 = await projectLm2GetWeek1(db, student);
  const journey = await projectLm2GetJourney(db, student);
  return projectLm2Success(await projectLm2BuildCurrentHome(db, student, profile, journey || { current_week: 1 }, week1));
}

async function projectLm2SavePlanB(db, student, body) {
  const profile = await projectLm2GetProfile(db, student);
  if (!profile) return projectLm2Error('Onboarding obrigatório antes do Plano B.', 409, 'ONBOARDING_REQUIRED');
  const unableToTrain = requiredText(body?.unable_to_train);
  const overeating = requiredText(body?.overeating);
  const noMotivation = requiredText(body?.no_motivation);
  if (!unableToTrain || !overeating || !noMotivation) return projectLm2Error('Todos os campos do Plano B são obrigatórios.', 400, 'PLAN_B_REQUIRED');
  await projectLm2EnsureWeek1(db, student);
  const now = new Date().toISOString();
  await db.prepare(`UPDATE lm2_week_1_foundation SET unable_to_train=?, overeating=?, no_motivation=?, plan_b_saved_at=?, updated_at=? WHERE student_id=?`).bind(unableToTrain, overeating, noMotivation, now, now, projectLm2StudentId(student)).run();
  const week1 = await projectLm2GetWeek1(db, student);
  const journey = await projectLm2GetJourney(db, student);
  return projectLm2Success(await projectLm2BuildCurrentHome(db, student, profile, journey || { current_week: 1 }, week1));
}

async function projectLm2ActivateWeek2(db, student) {
  const profile = await projectLm2GetProfile(db, student);
  if (!profile) return projectLm2Error('Onboarding obrigatório antes da ativação da Semana 2.', 409, 'ONBOARDING_REQUIRED');
  const journey = await projectLm2GetJourney(db, student);
  if (!journey) return projectLm2Error('Jornada obrigatória antes da ativação da Semana 2.', 409, 'JOURNEY_REQUIRED');

  if (Number(journey.current_week || 1) >= 2) {
    await projectLm2EnsureWeek2(db, student);
    return projectLm2Success({ current_week: 2, activated: true });
  }

  const week1 = await projectLm2EnsureWeek1(db, student);
  const progress = await projectLm2Progress(db, student, journey);
  const weekStatus = projectLm2BuildWeekStatus(journey, week1, progress);
  if (!weekStatus.week_completed) return projectLm2Error('Semana 1 precisa estar concluída antes de ativar a Semana 2.', 409, 'WEEK_1_NOT_COMPLETED');

  const now = new Date().toISOString();
  await db.prepare(`UPDATE lm2_journeys SET current_week=2, week_completed_at=COALESCE(week_completed_at, ?), week_started_at=COALESCE(week_started_at, ?), updated_at=? WHERE student_id=? AND current_week=1`).bind(now, now, now, projectLm2StudentId(student)).run();
  await projectLm2EnsureWeek2(db, student);
  return projectLm2Success({ current_week: 2, activated: true });
}

async function projectLm2ActivateWeek3(db, student) {
  const profile = await projectLm2GetProfile(db, student);
  if (!profile) return projectLm2Error('Onboarding obrigatório antes da ativação da Semana 3.', 409, 'ONBOARDING_REQUIRED');
  const journey = await projectLm2GetJourney(db, student);
  if (!journey) return projectLm2Error('Jornada obrigatória antes da ativação da Semana 3.', 409, 'JOURNEY_REQUIRED');
  if (Number(journey.current_week || 1) >= 3) return projectLm2Success({ current_week: Number(journey.current_week), activated: true });
  if (Number(journey.current_week || 1) !== 2) return projectLm2Error('Semana 2 precisa estar ativa antes de liberar a Semana 3.', 409, 'WEEK_2_NOT_ACTIVE');
  const week2 = await projectLm2EnsureWeek2(db, student);
  const progress = await projectLm2Progress(db, student, journey);
  const weekStatus = projectLm2BuildWeek2Status(journey, week2, progress);
  if (!weekStatus.week_completed) return projectLm2Error('Semana 2 precisa estar concluída antes de ativar a Semana 3.', 409, 'WEEK_2_NOT_COMPLETED');
  const now = new Date().toISOString();
  await db.prepare(`UPDATE lm2_journeys SET current_week=3, week_completed_at=COALESCE(week_completed_at, ?), week_started_at=COALESCE(week_started_at, ?), updated_at=? WHERE student_id=? AND current_week=2`).bind(now, now, now, projectLm2StudentId(student)).run();
  return projectLm2Success({ current_week: 3, activated: true });
}

async function projectLm2CompleteWeek2Video(db, student) {
  const profile = await projectLm2GetProfile(db, student);
  if (!profile) return projectLm2Error('Onboarding obrigatório antes da Semana 2.', 409, 'ONBOARDING_REQUIRED');
  await projectLm2EnsureWeek2(db, student);
  const now = new Date().toISOString();
  await db.prepare(`UPDATE lm2_week_2_foundation SET video_completed=1, updated_at=? WHERE student_id=?`).bind(now, projectLm2StudentId(student)).run();
  return projectLm2Success(await projectLm2BuildWeek2Home(db, student, profile));
}

async function projectLm2SaveWeek2Reflection(db, student, body) {
  const profile = await projectLm2GetProfile(db, student);
  if (!profile) return projectLm2Error('Onboarding obrigatório antes da Semana 2.', 409, 'ONBOARDING_REQUIRED');
  const reflection = requiredText(body?.reflection);
  const minimumResponse = requiredText(body?.minimum_response);
  if (reflection && reflection.length > 300) return projectLm2Error('reflection deve ter no máximo 300 caracteres.', 400, 'REFLECTION_TOO_LONG');
  if (minimumResponse && minimumResponse.length > 300) return projectLm2Error('minimum_response deve ter no máximo 300 caracteres.', 400, 'MINIMUM_RESPONSE_TOO_LONG');
  if (!reflection && !minimumResponse) return projectLm2Error('reflection ou minimum_response é obrigatório.', 400, 'WEEK_2_FIELD_REQUIRED');
  await projectLm2EnsureWeek2(db, student);
  const now = new Date().toISOString();
  if (reflection) {
    await db.prepare(`UPDATE lm2_week_2_foundation SET reflection=?, updated_at=? WHERE student_id=?`).bind(reflection, now, projectLm2StudentId(student)).run();
  }
  if (minimumResponse) {
    await db.prepare(`UPDATE lm2_week_2_foundation SET minimum_response=?, updated_at=? WHERE student_id=?`).bind(minimumResponse, now, projectLm2StudentId(student)).run();
  }
  return projectLm2Success(await projectLm2BuildWeek2Home(db, student, profile));
}

async function projectLm2CompleteWeekVideo(db, student, weekNumber) {
  const profile = await projectLm2GetProfile(db, student);
  if (!profile) return projectLm2Error(`Onboarding obrigatório antes da Semana ${weekNumber}.`, 409, 'ONBOARDING_REQUIRED');
  const journey = await projectLm2GetJourney(db, student);
  if (!journey || Number(journey.current_week || 1) < weekNumber) return projectLm2Error(`Semana ${weekNumber} ainda não está ativa.`, 409, `WEEK_${weekNumber}_NOT_ACTIVE`);
  const table = projectLm2WeekTable(weekNumber);
  await projectLm2EnsureWeekFoundation(db, student, weekNumber);
  const now = new Date().toISOString();
  await db.prepare(`UPDATE ${table} SET video_completed=1, updated_at=? WHERE student_id=?`).bind(now, projectLm2StudentId(student)).run();
  return projectLm2Success(await projectLm2BuildCurrentHome(db, student, profile));
}

async function projectLm2SaveWeekReflection(db, student, body, weekNumber) {
  const profile = await projectLm2GetProfile(db, student);
  if (!profile) return projectLm2Error(`Onboarding obrigatório antes da Semana ${weekNumber}.`, 409, 'ONBOARDING_REQUIRED');
  const journey = await projectLm2GetJourney(db, student);
  if (!journey || Number(journey.current_week || 1) < weekNumber) return projectLm2Error(`Semana ${weekNumber} ainda não está ativa.`, 409, `WEEK_${weekNumber}_NOT_ACTIVE`);
  const reflection = requiredText(body?.reflection);
  const minimumResponse = requiredText(body?.minimum_response);
  if (reflection && reflection.length > 300) return projectLm2Error('reflection deve ter no máximo 300 caracteres.', 400, 'REFLECTION_TOO_LONG');
  if (minimumResponse && minimumResponse.length > 300) return projectLm2Error('minimum_response deve ter no máximo 300 caracteres.', 400, 'MINIMUM_RESPONSE_TOO_LONG');
  if (!reflection && !minimumResponse) return projectLm2Error('reflection ou minimum_response é obrigatório.', 400, `WEEK_${weekNumber}_FIELD_REQUIRED`);
  const table = projectLm2WeekTable(weekNumber);
  await projectLm2EnsureWeekFoundation(db, student, weekNumber);
  const now = new Date().toISOString();
  if (reflection) {
    await db.prepare(`UPDATE ${table} SET reflection=?, updated_at=? WHERE student_id=?`).bind(reflection, now, projectLm2StudentId(student)).run();
  }
  if (minimumResponse) {
    await db.prepare(`UPDATE ${table} SET minimum_response=?, updated_at=? WHERE student_id=?`).bind(minimumResponse, now, projectLm2StudentId(student)).run();
  }
  return projectLm2Success(await projectLm2BuildCurrentHome(db, student, profile));
}

async function projectLm2CompleteWeek(db, student, weekNumber) {
  const profile = await projectLm2GetProfile(db, student);
  if (!profile) return projectLm2Error(`Onboarding obrigatório antes da Semana ${weekNumber}.`, 409, 'ONBOARDING_REQUIRED');
  const journey = await projectLm2GetJourney(db, student);
  if (!journey || Number(journey.current_week || 1) < weekNumber) return projectLm2Error(`Semana ${weekNumber} ainda não está ativa.`, 409, `WEEK_${weekNumber}_NOT_ACTIVE`);
  const table = projectLm2WeekTable(weekNumber);
  const week = await projectLm2EnsureWeekFoundation(db, student, weekNumber);
  const status = projectLm2WeekFoundationStatus(week);
  if (!status.video_completed || !status.reflection_completed || !status.minimum_response_completed) {
    return projectLm2Error(`Semana ${weekNumber} precisa estar concluída antes de avançar.`, 409, `WEEK_${weekNumber}_NOT_COMPLETED`);
  }
  const now = new Date().toISOString();
  await db.prepare(`UPDATE ${table} SET completed_at=COALESCE(completed_at, ?), updated_at=? WHERE student_id=?`).bind(now, now, projectLm2StudentId(student)).run();
  if (weekNumber === 3) {
    await db.prepare(`UPDATE lm2_journeys SET current_week=4, week_completed_at=?, week_started_at=?, updated_at=? WHERE student_id=? AND current_week=3`).bind(now, now, now, projectLm2StudentId(student)).run();
    await projectLm2EnsureWeekFoundation(db, student, 4);
  }
  return projectLm2Success(await projectLm2BuildCurrentHome(db, student, profile));
}

async function projectLm2CompleteProgram(db, student) {
  const profile = await projectLm2GetProfile(db, student);
  if (!profile) return projectLm2Error('Onboarding obrigatório antes de concluir o programa.', 409, 'ONBOARDING_REQUIRED');
  const journey = await projectLm2GetJourney(db, student);
  if (!journey || Number(journey.current_week || 1) < 4) return projectLm2Error('Semana 4 precisa estar ativa antes de concluir o programa.', 409, 'WEEK_4_NOT_ACTIVE');
  const week4 = await projectLm2EnsureWeekFoundation(db, student, 4);
  const week4Status = projectLm2WeekFoundationStatus(week4);
  if (!week4Status.week_completed) return projectLm2Error('Semana 4 precisa estar concluída antes de concluir o programa.', 409, 'WEEK_4_NOT_COMPLETED');
  const now = new Date().toISOString();
  await db.prepare(`UPDATE lm2_journeys SET status='completed', completed_at=COALESCE(completed_at, ?), program_completed_at=COALESCE(program_completed_at, ?), premium_bridge_eligible=1, updated_at=? WHERE student_id=?`).bind(now, now, now, projectLm2StudentId(student)).run();
  return projectLm2Success(await projectLm2BuildCurrentHome(db, student, profile));
}

async function projectLm2BuildCurrentHome(db, student, profile = null, journey = null, week1 = null) {
  const currentProfile = profile || await projectLm2GetProfile(db, student);
  const currentJourney = journey || await projectLm2GetJourney(db, student) || { current_week: 1 };
  const currentWeek1 = week1 || await projectLm2EnsureWeek1(db, student);
  const week2 = Number(currentJourney?.current_week || 1) >= 2 ? await projectLm2EnsureWeek2(db, student) : null;
  const week3 = Number(currentJourney?.current_week || 1) >= 3 ? await projectLm2EnsureWeekFoundation(db, student, 3) : null;
  const week4 = Number(currentJourney?.current_week || 1) >= 4 || currentJourney?.program_completed_at ? await projectLm2EnsureWeekFoundation(db, student, 4) : null;
  return projectLm2HomeData(currentProfile, currentJourney, currentWeek1, await projectLm2Progress(db, student, currentJourney), week2, week3, week4);
}

async function projectLm2BuildWeek2Home(db, student, profile) {
  const journey = await projectLm2GetJourney(db, student);
  const week1 = await projectLm2EnsureWeek1(db, student);
  const week2 = await projectLm2EnsureWeek2(db, student);
  const week3 = Number(journey?.current_week || 2) >= 3 ? await projectLm2EnsureWeekFoundation(db, student, 3) : null;
  const week4 = Number(journey?.current_week || 2) >= 4 || journey?.program_completed_at ? await projectLm2EnsureWeekFoundation(db, student, 4) : null;
  return projectLm2HomeData(profile, journey || { current_week: 2 }, week1, await projectLm2Progress(db, student, journey || { current_week: 2 }), week2, week3, week4);
}

// Projeto LM V5 foundation: isolated from legacy library, weekly missions, current mission, streak, hard day mode, and consistency flows.
const PROJECT_LM_V5_RECOVERY_FIELDS = ['overeating', 'missed_workout', 'travel', 'difficult_week', 'lack_of_motivation'];
const PROJECT_LM_V5_PLAN_B_FIELDS = ['emergency_meal', 'minimum_workout', 'minimum_movement', 'minimum_self_care'];

const PROJECT_LM_V5_VIEW_MODEL_COPY = {
  statusLabels: {
    active: 'Jornada em andamento',
    maintenance: 'Manutenção ativa'
  },
  progressLabels: [
    [0, 0, 'Comece pelas três ações mínimas.'],
    [10, 24, 'Continue concluindo suas ações mínimas.'],
    [25, 49, 'Crie seu Plano B.'],
    [50, 74, 'Registre vitórias concretas.'],
    [75, 99, 'Defina seus protocolos de recuperação.'],
    [100, 100, 'Você está em manutenção.']
  ],
  primaryMessages: {
    choose_stage_1_actions: 'Escolha 3 ações simples para fazer nesta semana.',
    complete_stage_1_actions: 'Conclua suas ações mínimas pendentes.',
    fill_plan_b: 'Monte seu Plano B para dias em que o plano ideal não couber.',
    record_victories: 'Registre 7 vitórias concretas da sua rotina.',
    fill_recovery_protocols: 'Defina como retomar após os obstáculos mais comuns.',
    maintenance: 'Defina uma meta simples para sustentar sua rotina.'
  },
  secondaryMessages: {
    choose_stage_1_actions: 'Use ações pequenas, claras e possíveis.',
    complete_stage_1_actions: 'Marque uma ação por vez.',
    fill_plan_b: 'Preencha alimentação, treino, movimento e autocuidado mínimos.',
    record_victories: 'Pode ser uma execução, uma escolha melhor ou uma retomada rápida.',
    fill_recovery_protocols: 'Deixe a resposta pronta antes de precisar dela.',
    maintenance: 'Escolha uma meta para os próximos dias.'
  },
  primaryCtas: {
    choose_stage_1_actions: { label: 'Definir minhas 3 ações', action: 'open_stage_1_actions' },
    complete_stage_1_actions: { label: 'Marcar ações concluídas', action: 'open_stage_1_actions' },
    fill_plan_b: { label: 'Criar meu Plano B', action: 'open_plan_b' },
    record_victories: { label: 'Registrar uma vitória', action: 'open_victories' },
    fill_recovery_protocols: { label: 'Definir protocolos de recuperação', action: 'open_recovery_protocols' },
    maintenance: { label: 'Definir meta de manutenção', action: 'open_maintenance_goals' }
  },
  stageSubtitles: {
    stage_1: 'Defina o mínimo executável desta semana.',
    stage_2: 'Prepare uma alternativa simples para dias apertados.',
    stage_3: 'Registre escolhas concretas da rotina.',
    stage_4: 'Defina como retomar sem improviso.',
    maintenance: 'Sustente uma meta simples por vez.'
  },
  stageStatusLabels: {
    locked: 'Bloqueado',
    active: 'Em andamento',
    completed: 'Concluído'
  }
};

function projectLmV5Error(error, status = 400, code = 'PROJECT_LM_V5_INTERNAL_ERROR') {
  return { status, payload: { ok: false, error, code } };
}

function projectLmV5Success(data, status = 200) {
  return { status, payload: { ok: true, data } };
}

function requiredText(value) {
  return nullableTrimmed(value);
}

function projectLmV5StudentId(student) {
  return String(student?.id || student?.email || '').trim();
}

async function projectLmV5GetJourneyRow(db, student) {
  return db.prepare(`SELECT * FROM project_lm_journeys WHERE student_id=? LIMIT 1`).bind(projectLmV5StudentId(student)).first();
}

async function projectLmV5GetOrCreateJourney(db, student) {
  const studentId = projectLmV5StudentId(student);
  const studentEmail = String(student?.email || '').trim().toLowerCase();
  let row = await projectLmV5GetJourneyRow(db, student);
  if (!row) {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    await db.prepare(`INSERT INTO project_lm_journeys (id, student_id, student_email, status, current_stage, created_at, updated_at) VALUES (?, ?, ?, 'active', 1, ?, ?)`).bind(id, studentId, studentEmail, now, now).run();
    row = await projectLmV5GetJourneyRow(db, student);
  }
  return projectLmV5HydrateJourney(db, row);
}

async function projectLmV5HydrateJourney(db, row) {
  const [actions, planB, victories, recovery, goals] = await Promise.all([
    db.prepare(`SELECT id, title, completed, completed_at, created_at, updated_at FROM project_lm_stage1_actions WHERE journey_id=? ORDER BY datetime(created_at) ASC`).bind(row.id).all(),
    db.prepare(`SELECT id, emergency_meal, minimum_workout, minimum_movement, minimum_self_care, created_at, updated_at FROM project_lm_plan_b WHERE journey_id=? LIMIT 1`).bind(row.id).first(),
    db.prepare(`SELECT id, description, created_at FROM project_lm_victories WHERE journey_id=? ORDER BY datetime(created_at) ASC`).bind(row.id).all(),
    db.prepare(`SELECT id, overeating, missed_workout, travel, difficult_week, lack_of_motivation, created_at, updated_at FROM project_lm_recovery_protocols WHERE journey_id=? LIMIT 1`).bind(row.id).first(),
    db.prepare(`SELECT id, goal, created_at, updated_at FROM project_lm_maintenance_goals WHERE journey_id=? ORDER BY datetime(created_at) DESC`).bind(row.id).all()
  ]);
  return { ...row, actions: actions.results || [], plan_b: planB || null, victories: victories.results || [], recovery_protocols: recovery || null, maintenance_goals: goals.results || [] };
}

function projectLmV5StageStatus(journey, stage) {
  if (stage === 1) return journey.current_stage > 1 ? 'completed' : 'active';
  if (stage === 2) return journey.current_stage < 2 ? 'locked' : journey.current_stage > 2 ? 'completed' : 'active';
  if (stage === 3) return journey.current_stage < 3 ? 'locked' : journey.current_stage > 3 ? 'completed' : 'active';
  if (stage === 4) {
    if (journey.status === 'maintenance') return 'completed';
    return journey.current_stage < 4 ? 'locked' : 'active';
  }
  return journey.status === 'maintenance' ? 'active' : 'locked';
}

function projectLmV5ProgressPercentage(journey) {
  if (journey.status === 'maintenance') return 100;
  if (journey.current_stage >= 4) return 75;

  // 50 é o marco oficial de Plano B concluído e entrada na Stage 3.
  if (journey.current_stage === 3) {
    const victoriesCount = (journey.victories || []).length;
    return Math.min(75, 50 + Math.floor((victoriesCount / 7) * 25));
  }

  // Stage 2 desbloqueada vale 25; concluir o Plano B avança para Stage 3.
  if (journey.current_stage === 2) return 25;

  const completedActions = (journey.actions || []).filter((action) => Number(action.completed) === 1).length;
  return Math.min(20, completedActions * 10);
}

function projectLmV5NextRequiredAction(journey) {
  if (journey.status === 'maintenance') return 'maintenance';
  if (journey.current_stage === 4) return 'fill_recovery_protocols';
  if (journey.current_stage === 3) return 'record_victories';
  if (journey.current_stage === 2) return 'fill_plan_b';
  return (journey.actions || []).length === 0 ? 'choose_stage_1_actions' : 'complete_stage_1_actions';
}

function projectLmV5CompletedStages(journey) {
  const stages = [];
  for (const stage of [1, 2, 3, 4]) {
    if (projectLmV5StageStatus(journey, stage) === 'completed') stages.push(stage);
  }
  return stages;
}

function projectLmV5LockedStages(journey) {
  return [1, 2, 3, 4].filter((stage) => projectLmV5StageStatus(journey, stage) === 'locked');
}

function projectLmV5CompletedFields(data, fields) {
  if (!data) return [];
  return fields.filter((field) => Boolean(requiredText(data[field])));
}

function projectLmV5ProgressLabel(percentage) {
  const match = PROJECT_LM_V5_VIEW_MODEL_COPY.progressLabels.find(([min, max]) => percentage >= min && percentage <= max);
  return match ? match[2] : PROJECT_LM_V5_VIEW_MODEL_COPY.progressLabels[0][2];
}

function projectLmV5StageCardCta(key) {
  const ctas = {
    stage_1: PROJECT_LM_V5_VIEW_MODEL_COPY.primaryCtas.complete_stage_1_actions,
    stage_2: PROJECT_LM_V5_VIEW_MODEL_COPY.primaryCtas.fill_plan_b,
    stage_3: PROJECT_LM_V5_VIEW_MODEL_COPY.primaryCtas.record_victories,
    stage_4: PROJECT_LM_V5_VIEW_MODEL_COPY.primaryCtas.fill_recovery_protocols,
    maintenance: PROJECT_LM_V5_VIEW_MODEL_COPY.primaryCtas.maintenance
  };
  return ctas[key];
}

function projectLmV5MaintenanceGoalsProgressText(count) {
  return `${count} ${count === 1 ? 'meta' : 'metas'} de manutenção`;
}

function projectLmV5StageCard(key, stage, progressText, emptyState = null) {
  return {
    key,
    title: stage.title,
    subtitle: PROJECT_LM_V5_VIEW_MODEL_COPY.stageSubtitles[key],
    status: stage.status,
    status_label: PROJECT_LM_V5_VIEW_MODEL_COPY.stageStatusLabels[stage.status],
    progress_text: progressText,
    cta: stage.status === 'active' ? projectLmV5StageCardCta(key) : null,
    empty_state: emptyState
  };
}

function projectLmV5BuildViewModel(contract) {
  const { journey, progress, stages } = contract;
  const nextAction = progress.next_required_action;
  return {
    page_title: 'Projeto LM',
    page_subtitle: 'Um passo simples por vez.',
    status_label: PROJECT_LM_V5_VIEW_MODEL_COPY.statusLabels[journey.status],
    progress_label: projectLmV5ProgressLabel(progress.percentage),
    primary_message: PROJECT_LM_V5_VIEW_MODEL_COPY.primaryMessages[nextAction],
    secondary_message: PROJECT_LM_V5_VIEW_MODEL_COPY.secondaryMessages[nextAction],
    primary_cta: PROJECT_LM_V5_VIEW_MODEL_COPY.primaryCtas[nextAction],
    secondary_cta: null,
    stage_cards: [
      projectLmV5StageCard('stage_1', stages.stage_1, `${stages.stage_1.completed_count}/3 ações concluídas`, stages.stage_1.items.length === 0 ? 'Defina suas 3 ações mínimas para começar.' : null),
      projectLmV5StageCard('stage_2', stages.stage_2, `${stages.stage_2.completed_fields.length}/4 campos preenchidos`),
      projectLmV5StageCard('stage_3', stages.stage_3, `${stages.stage_3.completed_count}/7 vitórias registradas`, stages.stage_3.items.length === 0 ? 'Registre uma escolha concreta de hoje.' : null),
      projectLmV5StageCard('stage_4', stages.stage_4, `${stages.stage_4.completed_fields.length}/5 protocolos criados`),
      projectLmV5StageCard('maintenance', stages.maintenance, projectLmV5MaintenanceGoalsProgressText(stages.maintenance.items.length), stages.maintenance.items.length === 0 ? 'Defina uma meta simples para os próximos dias.' : null)
    ],
    empty_state: null
  };
}

function projectLmV5BuildContract(journey) {
  const completedActions = (journey.actions || []).filter((action) => Number(action.completed) === 1).length;
  const planBCompletedFields = projectLmV5CompletedFields(journey.plan_b, PROJECT_LM_V5_PLAN_B_FIELDS);
  const recoveryCompletedFields = projectLmV5CompletedFields(journey.recovery_protocols, PROJECT_LM_V5_RECOVERY_FIELDS);
  const contract = {
    journey: {
      id: journey.id,
      status: journey.status,
      current_stage: journey.current_stage,
      created_at: journey.created_at,
      updated_at: journey.updated_at,
      stage_2_unlocked_at: journey.stage_2_unlocked_at || null,
      stage_3_unlocked_at: journey.stage_3_unlocked_at || null,
      stage_4_unlocked_at: journey.stage_4_unlocked_at || null,
      maintenance_started_at: journey.maintenance_started_at || null
    },
    progress: {
      current_stage: journey.current_stage,
      status: journey.status,
      percentage: projectLmV5ProgressPercentage(journey),
      completed_stages: projectLmV5CompletedStages(journey),
      locked_stages: projectLmV5LockedStages(journey),
      next_required_action: projectLmV5NextRequiredAction(journey)
    },
    stages: {
      stage_1: {
        key: 'stage_1',
        title: 'Escolha suas 3 ações mínimas',
        status: projectLmV5StageStatus(journey, 1),
        required_count: 3,
        completed_count: completedActions,
        items: journey.actions || []
      },
      stage_2: {
        key: 'stage_2',
        title: 'Construa seu Plano B',
        status: projectLmV5StageStatus(journey, 2),
        required_fields: PROJECT_LM_V5_PLAN_B_FIELDS,
        completed_fields: planBCompletedFields,
        data: journey.plan_b || null
      },
      stage_3: {
        key: 'stage_3',
        title: 'Registre 7 vitórias',
        status: projectLmV5StageStatus(journey, 3),
        required_count: 7,
        completed_count: (journey.victories || []).length,
        items: journey.victories || []
      },
      stage_4: {
        key: 'stage_4',
        title: 'Prepare seus protocolos de recuperação',
        status: projectLmV5StageStatus(journey, 4),
        required_fields: PROJECT_LM_V5_RECOVERY_FIELDS,
        completed_fields: recoveryCompletedFields,
        data: journey.recovery_protocols || null
      },
      maintenance: {
        key: 'maintenance',
        title: 'Manutenção',
        status: projectLmV5StageStatus(journey, 'maintenance'),
        items: journey.maintenance_goals || []
      }
    }
  };
  return { ...contract, view_model: projectLmV5BuildViewModel(contract) };
}

async function projectLmV5AdvanceJourney(db, journey, targetStage, fields = {}) {
  if (journey.current_stage >= targetStage && !(fields.status === 'maintenance')) return;
  const now = new Date().toISOString();
  await db.prepare(`UPDATE project_lm_journeys SET current_stage=?, status=COALESCE(?, status), stage_2_unlocked_at=COALESCE(stage_2_unlocked_at, ?), stage_3_unlocked_at=COALESCE(stage_3_unlocked_at, ?), stage_4_unlocked_at=COALESCE(stage_4_unlocked_at, ?), maintenance_started_at=COALESCE(maintenance_started_at, ?), updated_at=? WHERE id=?`).bind(
    targetStage,
    fields.status || null,
    targetStage >= 2 ? now : null,
    targetStage >= 3 ? now : null,
    targetStage >= 4 ? now : null,
    fields.status === 'maintenance' ? now : null,
    now,
    journey.id
  ).run();
}

async function projectLmV5CreateStage1Actions(db, student, actions) {
  const journey = await projectLmV5GetOrCreateJourney(db, student);
  if (journey.current_stage !== 1) return projectLmV5Error('Etapa 1 já foi concluída.', 409, 'STAGE_1_ALREADY_COMPLETED');
  if (!Array.isArray(actions) || actions.length !== 3) return projectLmV5Error('A Etapa 1 exige exatamente 3 ações.', 400, 'STAGE_1_EXACTLY_3_ACTIONS');
  const titles = actions.map((a) => requiredText(typeof a === 'string' ? a : a?.title));
  if (titles.some((title) => !title)) return projectLmV5Error('Todas as 3 ações devem ter título.', 400, 'STAGE_1_ACTION_TITLE_REQUIRED');
  const existing = await db.prepare(`SELECT COUNT(*) AS total FROM project_lm_stage1_actions WHERE journey_id=?`).bind(journey.id).first();
  if (Number(existing?.total || 0) > 0) return projectLmV5Error('As ações da Etapa 1 já foram criadas.', 409, 'STAGE_1_ALREADY_CREATED');
  const now = new Date().toISOString();
  const statements = titles.map((title) => db.prepare(`INSERT INTO project_lm_stage1_actions (id, journey_id, student_id, student_email, title, completed, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)`).bind(crypto.randomUUID(), journey.id, journey.student_id, journey.student_email, title, now, now));
  if (typeof db.batch === 'function') {
    await db.batch(statements);
  } else {
    for (const statement of statements) await statement.run();
  }
  const created = await db.prepare(`SELECT COUNT(*) AS total FROM project_lm_stage1_actions WHERE journey_id=?`).bind(journey.id).first();
  if (Number(created?.total || 0) !== 3) return projectLmV5Error('Falha ao criar exatamente 3 ações da Etapa 1.', 500, 'PROJECT_LM_V5_INTERNAL_ERROR');
  return projectLmV5Success(projectLmV5BuildContract(await projectLmV5HydrateJourney(db, await projectLmV5GetJourneyRow(db, student))), 201);
}

async function projectLmV5CompleteStage1Action(db, student, actionId) {
  const journey = await projectLmV5GetOrCreateJourney(db, student);
  if (journey.current_stage !== 1) return projectLmV5Error('Etapa 1 já foi concluída.', 409, 'STAGE_1_ALREADY_COMPLETED');
  const action = await db.prepare(`SELECT id FROM project_lm_stage1_actions WHERE id=? AND journey_id=? LIMIT 1`).bind(actionId, journey.id).first();
  if (!action) return projectLmV5Error('Ação não encontrada.', 404, 'STAGE_1_ACTION_NOT_FOUND');
  const now = new Date().toISOString();
  await db.prepare(`UPDATE project_lm_stage1_actions SET completed=1, completed_at=COALESCE(completed_at, ?), updated_at=? WHERE id=?`).bind(now, now, actionId).run();
  const count = await db.prepare(`SELECT COUNT(*) AS total FROM project_lm_stage1_actions WHERE journey_id=? AND completed=1`).bind(journey.id).first();
  if (Number(count?.total || 0) === 3) await projectLmV5AdvanceJourney(db, journey, 2);
  return projectLmV5Success(projectLmV5BuildContract(await projectLmV5HydrateJourney(db, await projectLmV5GetJourneyRow(db, student))));
}

async function projectLmV5SavePlanB(db, student, body) {
  const journey = await projectLmV5GetOrCreateJourney(db, student);
  if (journey.current_stage !== 2) return projectLmV5Error('Plano B só pode ser registrado na Etapa 2.', 403, 'PLAN_B_STAGE_LOCKED');
  const emergencyMeal = requiredText(body?.emergency_meal);
  const minimumWorkout = requiredText(body?.minimum_workout);
  const minimumMovement = requiredText(body?.minimum_movement);
  const minimumSelfCare = requiredText(body?.minimum_self_care);
  if (!emergencyMeal || !minimumWorkout || !minimumMovement || !minimumSelfCare) return projectLmV5Error('Todos os campos do Plano B são obrigatórios.', 400, 'PLAN_B_REQUIRED_FIELDS');
  const now = new Date().toISOString();
  const existing = await db.prepare(`SELECT id FROM project_lm_plan_b WHERE journey_id=? LIMIT 1`).bind(journey.id).first();
  if (existing) await db.prepare(`UPDATE project_lm_plan_b SET emergency_meal=?, minimum_workout=?, minimum_movement=?, minimum_self_care=?, updated_at=? WHERE id=?`).bind(emergencyMeal, minimumWorkout, minimumMovement, minimumSelfCare, now, existing.id).run();
  else await db.prepare(`INSERT INTO project_lm_plan_b (id, journey_id, student_id, student_email, emergency_meal, minimum_workout, minimum_movement, minimum_self_care, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(crypto.randomUUID(), journey.id, journey.student_id, journey.student_email, emergencyMeal, minimumWorkout, minimumMovement, minimumSelfCare, now, now).run();
  await projectLmV5AdvanceJourney(db, journey, 3);
  return projectLmV5Success(projectLmV5BuildContract(await projectLmV5HydrateJourney(db, await projectLmV5GetJourneyRow(db, student))));
}

async function projectLmV5CreateVictory(db, student, body) {
  const journey = await projectLmV5GetOrCreateJourney(db, student);
  if (journey.current_stage !== 3) return projectLmV5Error('Vitórias só podem ser registradas na Etapa 3.', 403, 'VICTORIES_STAGE_LOCKED');
  const description = requiredText(body?.description || body?.victory);
  if (!description) return projectLmV5Error('Descrição da vitória é obrigatória.', 400, 'VICTORY_DESCRIPTION_REQUIRED');
  const count = await db.prepare(`SELECT COUNT(*) AS total FROM project_lm_victories WHERE journey_id=?`).bind(journey.id).first();
  if (Number(count?.total || 0) >= 7) return projectLmV5Error('A Etapa 3 já possui 7 vitórias.', 409, 'VICTORIES_LIMIT_REACHED');
  const now = new Date().toISOString();
  await db.prepare(`INSERT INTO project_lm_victories (id, journey_id, student_id, student_email, description, created_at) VALUES (?, ?, ?, ?, ?, ?)`).bind(crypto.randomUUID(), journey.id, journey.student_id, journey.student_email, description, now).run();
  const nextCount = Number(count?.total || 0) + 1;
  if (nextCount === 7) await projectLmV5AdvanceJourney(db, journey, 4);
  return projectLmV5Success(projectLmV5BuildContract(await projectLmV5HydrateJourney(db, await projectLmV5GetJourneyRow(db, student))), 201);
}

async function projectLmV5SaveRecovery(db, student, body) {
  const journey = await projectLmV5GetOrCreateJourney(db, student);
  if (journey.current_stage !== 4 || journey.status === 'maintenance') return projectLmV5Error('Protocolos de recuperação só podem ser registrados na Etapa 4.', 403, 'RECOVERY_STAGE_LOCKED');
  const values = PROJECT_LM_V5_RECOVERY_FIELDS.map((field) => requiredText(body?.[field]));
  if (values.some((value) => !value)) return projectLmV5Error('Todos os protocolos de recuperação são obrigatórios.', 400, 'RECOVERY_REQUIRED_FIELDS');
  const now = new Date().toISOString();
  const existing = await db.prepare(`SELECT id FROM project_lm_recovery_protocols WHERE journey_id=? LIMIT 1`).bind(journey.id).first();
  if (existing) await db.prepare(`UPDATE project_lm_recovery_protocols SET overeating=?, missed_workout=?, travel=?, difficult_week=?, lack_of_motivation=?, updated_at=? WHERE id=?`).bind(...values, now, existing.id).run();
  else await db.prepare(`INSERT INTO project_lm_recovery_protocols (id, journey_id, student_id, student_email, overeating, missed_workout, travel, difficult_week, lack_of_motivation, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(crypto.randomUUID(), journey.id, journey.student_id, journey.student_email, ...values, now, now).run();
  await projectLmV5AdvanceJourney(db, journey, 4, { status: 'maintenance' });
  return projectLmV5Success(projectLmV5BuildContract(await projectLmV5HydrateJourney(db, await projectLmV5GetJourneyRow(db, student))));
}

async function projectLmV5CreateMaintenanceGoal(db, student, body) {
  const journey = await projectLmV5GetOrCreateJourney(db, student);
  if (journey.status !== 'maintenance') return projectLmV5Error('Metas de manutenção só podem ser registradas após concluir a Etapa 4.', 403, 'MAINTENANCE_GOALS_LOCKED');
  const goal = requiredText(body?.goal);
  if (!goal) return projectLmV5Error('Meta de manutenção é obrigatória.', 400, 'MAINTENANCE_GOAL_REQUIRED');
  const now = new Date().toISOString();
  await db.prepare(`INSERT INTO project_lm_maintenance_goals (id, journey_id, student_id, student_email, goal, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(crypto.randomUUID(), journey.id, journey.student_id, journey.student_email, goal, now, now).run();
  return projectLmV5Success(projectLmV5BuildContract(await projectLmV5HydrateJourney(db, await projectLmV5GetJourneyRow(db, student))), 201);
}

function isProjectLmPlan(student) {
  const plan = normalizeStudentPlan(student?.plan);
  const planType = String(student?.planType || '').trim().toLowerCase();
  return plan === 'projeto_lm' || planType === 'projeto_lm' || planType === 'project_lm';
}

function isPremiumPortalStudent(student) {
  return !isProjectLmPlan(student) && normalizeStudentPlan(student?.plan) === 'premium';
}

function canUseProjectLmProgress(student) {
  const plan = normalizeStudentPlan(student?.plan || student?.planType);
  return plan === 'projeto_lm' || plan === 'premium';
}

function formatDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function shiftDateOnly(dateOnly, days) {
  const date = new Date(`${dateOnly}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDateOnly(date);
}

async function getProjectLmConsistency(db, studentEmail, today = new Date()) {
  const normalizedEmail = String(studentEmail || '').trim().toLowerCase();
  const { results } = await db.prepare(
    `SELECT DISTINCT action_date
     FROM project_lm_daily_actions
     WHERE lower(student_email)=? AND completed=1
     ORDER BY action_date ASC`
  ).bind(normalizedEmail).all();

  return buildProjectLmConsistency(results || [], today);
}

export function buildProjectLmConsistency(rows, today = new Date()) {
  const todayDate = formatDateOnly(today);
  const completedDates = new Set(
    (rows || [])
      .map((row) => row?.action_date || row?.date)
      .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(String(date || '')))
  );

  const sortedDates = [...completedDates].sort();
  let bestStreak = 0;
  let runningStreak = 0;
  let previousDate = null;

  for (const actionDate of sortedDates) {
    runningStreak = previousDate && shiftDateOnly(previousDate, 1) === actionDate ? runningStreak + 1 : 1;
    bestStreak = Math.max(bestStreak, runningStreak);
    previousDate = actionDate;
  }

  let currentStreak = 0;
  let cursor = todayDate;
  while (completedDates.has(cursor)) {
    currentStreak += 1;
    cursor = shiftDateOnly(cursor, -1);
  }

  const calendar = [];
  for (let daysAgo = 29; daysAgo >= 0; daysAgo -= 1) {
    const date = shiftDateOnly(todayDate, -daysAgo);
    calendar.push({
      date,
      completed: completedDates.has(date)
    });
  }

  return {
    activeDays: completedDates.size,
    currentStreak,
    bestStreak,
    calendar
  };
}

async function getProjectLmDailyActionsSummary(db, studentEmail) {
  const normalizedEmail = String(studentEmail || '').trim().toLowerCase();
  const { results } = await db.prepare(
    `SELECT action_date, action_type
     FROM project_lm_daily_actions
     WHERE lower(student_email)=? AND completed=1
     ORDER BY action_date DESC, created_at DESC`
  ).bind(normalizedEmail).all();

  const actions = results || [];
  const completedDates = new Set(actions.map((action) => action.action_date).filter(Boolean));
  const lastActionDate = completedDates.size ? [...completedDates].sort().at(-1) : null;
  const firstVictoryCompleted = actions.some((action) => action.action_type === 'primeira_vitoria');
  const hardDayModeCompleted = actions.some((action) => action.action_type === 'modo_dia_dificil');

  let currentStreak = 0;
  if (lastActionDate) {
    let cursor = lastActionDate;
    while (completedDates.has(cursor)) {
      currentStreak += 1;
      cursor = shiftDateOnly(cursor, -1);
    }
  }

  return {
    completedDays: completedDates.size,
    currentStreak,
    firstVictoryCompleted,
    hardDayModeCompleted,
    lastActionDate
  };
}

function sanitizeProjectLmValue(value) {
  return nullableTrimmed(value);
}

function mapProjectLmProfile(row) {
  if (!row) return null;
  return {
    student_email: row.student_email,
    goal: row.goal,
    onboarding_completed: Number(row.onboarding_completed || 0),
    onboardingCompleted: Number(row.onboarding_completed || 0),
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function getInitialPlanCode(sex, weightKg) {
  if (sex === 'female') {
    if (weightKg < 70) return 'M1';
    if (weightKg < 90) return 'M2';
    return 'M3';
  }

  if (sex === 'male') {
    if (weightKg < 80) return 'H1';
    if (weightKg < 100) return 'H2';
    return 'H3';
  }

  return null;
}

function normalizeProjectLmSex(value) {
  const sex = nullableTrimmed(value)?.toLowerCase();
  if (['female', 'feminino', 'mulher'].includes(sex)) return 'female';
  if (['male', 'masculino', 'homem'].includes(sex)) return 'male';
  return sex || null;
}

function parsePositiveNumber(value) {
  return Number(typeof value === 'string' ? value.replace(',', '.') : value);
}

function validateProjectLmProfilePayload(body) {
  const name = nullableTrimmed(body?.name);
  const objective = nullableTrimmed(body?.objective ?? body?.goal);
  const goal = objective;
  const sex = normalizeProjectLmSex(body?.sex);
  const weightKg = parsePositiveNumber(body?.weightKg ?? body?.weight_kg);
  const heightCm = parsePositiveNumber(body?.heightCm ?? body?.height_cm);

  if (!name) return { ok: false, error: 'name é obrigatório.' };
  if (!objective) return { ok: false, error: 'objective é obrigatório.' };
  if (!sex) return { ok: false, error: 'sex é obrigatório.' };
  if (!PROJECT_LM_PROFILE_SEXES.has(sex)) return { ok: false, error: 'sex inválido.' };
  if (!Number.isFinite(weightKg) || weightKg <= 30) return { ok: false, error: 'weightKg deve ser numérico e maior que 30.' };
  if (weightKg >= 250) return { ok: false, error: 'weightKg deve ser menor que 250.' };
  if (!Number.isFinite(heightCm) || heightCm <= 120) return { ok: false, error: 'heightCm deve ser numérico e maior que 120.' };
  if (!Number.isInteger(heightCm)) {
    return { ok: false, error: 'heightCm deve ser informado em centímetros, sem casas decimais.' };
  }
  if (heightCm >= 230) return { ok: false, error: 'heightCm deve ser menor que 230.' };

  return { ok: true, profile: { name, objective, goal, sex, weightKg, heightCm } };
}

async function getProjectLmProfile(db, userId) {
  const row = await db.prepare(
    `SELECT name, goal, objective, sex, weight_kg, height_cm, nutrition_plan_code, initial_plan_code, created_at, updated_at
     FROM project_lm_profiles
     WHERE user_id=?
     LIMIT 1`
  ).bind(userId).first();
  if (!row) return null;

  const derivedPlanCode = row.sex && row.weight_kg
    ? getInitialPlanCode(row.sex, Number(row.weight_kg))
    : null;

  return {
    name: row.name,
    objective: row.objective || row.goal,
    goal: row.goal || row.objective,
    sex: row.sex,
    weightKg: row.weight_kg,
    heightCm: row.height_cm,
    weight_kg: row.weight_kg,
    height_cm: row.height_cm,
    initial_plan_code: row.initial_plan_code || row.nutrition_plan_code || derivedPlanCode,
    initialPlanCode: row.initial_plan_code || row.nutrition_plan_code || derivedPlanCode,
    nutrition_plan_code: row.nutrition_plan_code || row.initial_plan_code || derivedPlanCode,
    nutritionPlanCode: row.nutrition_plan_code || row.initial_plan_code || derivedPlanCode,
    onboarding_completed: 1,
    onboardingCompleted: 1,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function getProjectLmWeekFromCreatedAt(createdAt, now = new Date()) {
  const createdDate = createdAt ? new Date(createdAt) : null;
  if (!createdDate || Number.isNaN(createdDate.getTime())) return 1;

  const elapsedMs = now.getTime() - createdDate.getTime();
  const elapsedDays = Math.max(0, Math.floor(elapsedMs / 86400000));

  if (elapsedDays <= 6) return 1;
  if (elapsedDays <= 13) return 2;
  if (elapsedDays <= 20) return 3;
  return 4;
}

function mapProjectLmMission(row, fallbackWeek = 1) {
  const fallback = PROJECT_LM_WEEKLY_MISSIONS_SEED.find(([weekNumber]) => weekNumber === fallbackWeek) || PROJECT_LM_WEEKLY_MISSIONS_SEED[0];
  const source = row || {
    week_number: fallback[0],
    title: fallback[1],
    description: fallback[2],
    main_mission: fallback[3],
    success_criteria: fallback[4]
  };

  return {
    week: Number(source.week_number || fallbackWeek),
    title: source.title,
    description: source.description,
    mainMission: source.main_mission,
    successCriteria: source.success_criteria
  };
}

export async function getProjectLmCurrentMission(db, userId) {
  const profile = await getProjectLmProfile(db, userId);
  const week = getProjectLmWeekFromCreatedAt(profile?.created_at);
  const row = await db.prepare(
    `SELECT week_number, title, description, main_mission, success_criteria
     FROM project_lm_weekly_missions
     WHERE week_number=?
     LIMIT 1`
  ).bind(week).first();

  return mapProjectLmMission(row, week);
}

function buildFallbackAnamnesisEmail(studentName, studentPhone) {
  const normalizedName = String(studentName || '').toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '').slice(0, 24) || 'aluno';
  const normalizedPhone = String(studentPhone || '').replace(/\D+/g, '').slice(-8) || Date.now().toString().slice(-8);
  return `${normalizedName}.${normalizedPhone}@anamnese.local`;
}

function rawJson(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders()
    }
  });
}

async function safeJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function __deprecated_getWeekRef(date) {
  const d = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
  ));

  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);

  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);

  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function weekRefDiff(olderWeekRef, newerWeekRef) {
  const old = parseWeekRef(olderWeekRef);
  const newer = parseWeekRef(newerWeekRef);

  if (!old || !newer) return 0;

  const oldDate = isoWeekStartDate(old.year, old.week);
  const newDate = isoWeekStartDate(newer.year, newer.week);

  return Math.floor((newDate - oldDate) / (7 * 24 * 60 * 60 * 1000));
}

function parseWeekRef(weekRef) {
  const match = String(weekRef || '').match(/^(\d{4})-W(\d{2})$/);

  if (!match) return null;

  return {
    year: Number(match[1]),
    week: Number(match[2])
  };
}

function isoWeekStartDate(year, week) {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;

  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1);

  const target = new Date(week1Monday);
  target.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);

  return target;
}

function computeClinicalPriority(checkin, weeklyPlan) {
  if (!checkin) {
    return { level: 'HIGH', message: 'Sem check-in recente. Prioridade em reativar contato clínico.' };
  }

  const stress = Number(checkin.stress_level || 0);
  const energy = Number(checkin.energy_level || 0);
  const sleep = Number(checkin.sleep_quality || 0);
  const hasSupportSignal = String(checkin.support_needed || '').trim().length > 0;
  const pendingCoachReply = !checkin.coach_reply;
  const hasRiskInPlan = String(weeklyPlan?.main_risk || '').trim().length > 0;

  if (stress >= 8 || energy <= 3 || sleep <= 3 || hasSupportSignal) {
    return { level: 'CRITICAL', message: 'Aluno em sinal clínico agudo. Ajustar plano e responder hoje.' };
  }
  if (pendingCoachReply || !hasRiskInPlan) {
    return { level: 'HIGH', message: 'Ações clínicas pendentes na semana atual.' };
  }
  return { level: 'MODERATE', message: 'Aluno estável. Manter acompanhamento e microajustes.' };
}

function computeNextRecommendedAction(checkin, weeklyPlan) {
  if (!checkin) {
    return { code: 'REQUEST_CHECKIN', label: 'Cobrar check-in da semana', reason: 'Sem check-in disponível no Student 360.' };
  }
  if (!checkin.coach_reply) {
    return { code: 'REPLY_CHECKIN', label: 'Responder último check-in', reason: 'Existe check-in sem retorno do coach.' };
  }
  if (!weeklyPlan) {
    return { code: 'CREATE_WEEKLY_PLAN', label: 'Criar objetivo do planejamento atual', reason: 'Aluno sem objetivo do planejamento ativo.' };
  }
  return { code: 'REFINE_WEEKLY_PLAN', label: 'Refinar objetivo do planejamento', reason: 'Check-in respondido; revisar foco de execução.' };
}
