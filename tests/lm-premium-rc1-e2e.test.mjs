import test from 'node:test';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert/strict';
import { createRc1D1Fixture, RC1_PREMIUM_MIGRATIONS } from './helpers/lm-premium-rc1-d1-fixture.mjs';
import { createD1PremiumStudentRepository } from '../workers/premium/repositories/d1-premium-student-repository.js';
import { createD1AnamnesisRepository } from '../workers/premium/repositories/d1-anamnesis-repository.js';
import { createD1WeeklyFeedbackRepository } from '../workers/premium/repositories/d1-weekly-feedback-repository.js';
import { createD1PendingItemRepository } from '../workers/premium/repositories/d1-pending-item-repository.js';
import { createD1FollowupEntryRepository } from '../workers/premium/repositories/d1-followup-entry-repository.js';
import { createD1NutritionPlanRepository } from '../workers/premium/repositories/d1-nutrition-plan-repository.js';
import { createD1StudentRecordRepository } from '../workers/premium/repositories/d1-student-record-repository.js';
import { createD1ProfessionalWorkspaceRepository } from '../workers/premium/repositories/d1-professional-workspace-repository.js';
import { createStudentIdentityService } from '../workers/premium/services/student-identity-service.js';
import { createCreatePendingItemUseCase } from '../workers/premium/application/create-pending-item.js';
import { createAnalyzeAnamnesisUseCase } from '../workers/premium/application/analyze-anamnesis.js';
import { createUpdateConsultationStatusUseCase } from '../workers/premium/application/update-consultation-status.js';
import { createSubmitWeeklyFeedbackUseCase } from '../workers/premium/application/submit-weekly-feedback.js';
import { createRecordProfessionalDecisionUseCase } from '../workers/premium/application/record-professional-decision.js';
import { createCreateNutritionPlanDraftUseCase } from '../workers/premium/application/create-nutrition-plan-draft.js';
import { createUpdateNutritionPlanDraftUseCase } from '../workers/premium/application/update-nutrition-plan-draft.js';
import { createPublishNutritionPlanUseCase } from '../workers/premium/application/publish-nutrition-plan.js';
import { createGetStudentRecordUseCase } from '../workers/premium/application/get-student-record.js';
import { createGetProfessionalWorkspaceSummaryUseCase } from '../workers/premium/application/get-professional-workspace-summary.js';
import { createGetProfessionalWorkspaceStudentUseCase } from '../workers/premium/application/get-professional-workspace-student.js';
import { createSearchProfessionalWorkspaceStudentsUseCase } from '../workers/premium/application/search-professional-workspace-students.js';
import { presentPublicNutritionPlan } from '../workers/premium/presenters/nutrition-plan-public-presenter.js';
import { presentStudentRecord } from '../workers/premium/presenters/student-record-presenter.js';
import { presentWorkspaceSummary } from '../workers/premium/presenters/professional-workspace-summary-presenter.js';
import { presentWorkspaceStudentContext } from '../workers/premium/presenters/professional-workspace-student-presenter.js';

test('READY_TO_RELEASE migration upgrades an existing premium_students schema without data loss', () => {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`CREATE TABLE premium_students (student_id TEXT PRIMARY KEY,email TEXT NOT NULL,normalized_email TEXT NOT NULL,display_name TEXT,consultation_status TEXT NOT NULL DEFAULT 'NEW' CHECK (consultation_status IN ('NEW','AWAITING_ANAMNESIS','UNDER_REVIEW','ACTIVE','PAUSED','ENDED')),access_status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (access_status IN ('ACTIVE','INACTIVE')),source TEXT NOT NULL DEFAULT 'MIGRATION',created_at TEXT NOT NULL,updated_at TEXT NOT NULL,legacy_backfill_batch_id TEXT); CREATE UNIQUE INDEX idx_premium_students_normalized_email ON premium_students(normalized_email); CREATE INDEX idx_premium_students_access_status ON premium_students(access_status); CREATE INDEX idx_premium_students_consultation_status ON premium_students(consultation_status); CREATE INDEX idx_premium_students_legacy_backfill_batch ON premium_students(legacy_backfill_batch_id);`);
  sqlite.prepare(`INSERT INTO premium_students VALUES (?,?,?,?,?,?,?,?,?,?)`).run('student-old','old@example.com','old@example.com','Old','UNDER_REVIEW','ACTIVE','TEST','2026-01-01','2026-01-02','batch-old');
  sqlite.exec(readFileSync('migrations/0035_add_ready_to_release_consultation_status.sql','utf8'));
  assert.deepEqual({ ...sqlite.prepare('SELECT * FROM premium_students').get() }, { student_id:'student-old',email:'old@example.com',normalized_email:'old@example.com',display_name:'Old',consultation_status:'UNDER_REVIEW',access_status:'ACTIVE',source:'TEST',created_at:'2026-01-01',updated_at:'2026-01-02',legacy_backfill_batch_id:'batch-old' });
  sqlite.prepare(`UPDATE premium_students SET consultation_status='READY_TO_RELEASE' WHERE student_id='student-old'`).run();
  assert.equal(sqlite.prepare(`SELECT consultation_status FROM premium_students WHERE student_id='student-old'`).get().consultation_status,'READY_TO_RELEASE');
});

function makeIds() { let n = 0; return () => `rc1-${++n}`; }
function scalar(sqlite, sql, ...params) { return sqlite.prepare(sql).get(...params); }
function all(sqlite, sql, ...params) { return sqlite.prepare(sql).all(...params); }
function seedAccess(sqlite, { id, name, email, plan, plan_type = plan, student_id = null }) {
  sqlite.prepare('INSERT INTO student_access (id,name,email,whatsapp,status,plan_type,created_at,plan,student_id) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(id, name, email, '+5511999999999', 'active', plan_type, '2026-07-14T00:00:00.000Z', plan, student_id);
}

test('RC1 fixture aplica a migration de auditoria do backfill legado e o repository aceita lote opcional', async () => {
  assert.ok(RC1_PREMIUM_MIGRATIONS.includes('migrations/0035_add_ready_to_release_consultation_status.sql'));
  assert.ok(RC1_PREMIUM_MIGRATIONS.includes('migrations/0036_scope_legacy_active_nutrition_plan_email_unique.sql'));
  assert.ok(RC1_PREMIUM_MIGRATIONS.indexOf('migrations/0035_add_ready_to_release_consultation_status.sql') < RC1_PREMIUM_MIGRATIONS.indexOf('migrations/0036_scope_legacy_active_nutrition_plan_email_unique.sql'));
  assert(RC1_PREMIUM_MIGRATIONS.indexOf('migrations/0035_add_ready_to_release_consultation_status.sql') > RC1_PREMIUM_MIGRATIONS.indexOf('migrations/0025_create_premium_students.sql'));
  const fixture = createRc1D1Fixture();
  assert(scalar(fixture.sqlite, "SELECT 1 AS present FROM pragma_table_info('premium_students') WHERE name='legacy_backfill_batch_id'"));
  assert(scalar(fixture.sqlite, "SELECT 1 AS present FROM sqlite_master WHERE type='table' AND name='premium_legacy_identity_backfill_audit'"));

  const repository = createD1PremiumStudentRepository(fixture.db);
  const withoutBatch = await repository.create({ student_id: 'legacy-null-batch', email: 'null-batch@example.com', display_name: 'Null batch', source: 'TEST', created_at: '2026-07-20T00:00:00.000Z' });
  const withBatch = await repository.create({ student_id: 'legacy-with-batch', email: 'with-batch@example.com', display_name: 'With batch', source: 'LEGACY_BACKFILL', legacy_backfill_batch_id: 'batch-rc1', created_at: '2026-07-20T00:00:00.000Z' });

  assert.equal(withoutBatch.legacy_backfill_batch_id, null);
  assert.equal(withBatch.legacy_backfill_batch_id, 'batch-rc1');
});
function deps() {
  const fixture = createRc1D1Fixture();
  const randomUUID = makeIds();
  const studentRepository = createD1PremiumStudentRepository(fixture.db);
  const anamnesisRepository = createD1AnamnesisRepository(fixture.db);
  const weeklyFeedbackRepository = createD1WeeklyFeedbackRepository(fixture.db);
  const pendingItemRepository = createD1PendingItemRepository(fixture.db);
  const followupEntryRepository = createD1FollowupEntryRepository(fixture.db);
  const nutritionPlanRepository = createD1NutritionPlanRepository(fixture.db);
  const studentRecordRepository = createD1StudentRecordRepository(fixture.db);
  const workspaceRepository = createD1ProfessionalWorkspaceRepository(fixture.db, { scheduleService: { getWeekRef: () => '2026-W28' } });
  const identityService = createStudentIdentityService({ repository: studentRepository });
  return { ...fixture, randomUUID, studentRepository, anamnesisRepository, weeklyFeedbackRepository, pendingItemRepository, followupEntryRepository, nutritionPlanRepository, studentRecordRepository, workspaceRepository, identityService };
}

test('RC1 E2E aplica migrations reais e exercita repositories/use cases dos Builds 1-6', async () => {
  const d = deps();
  assert.deepEqual(d.migrations, RC1_PREMIUM_MIGRATIONS);

  seedAccess(d.sqlite, { id: 'access-premium', name: 'Ana Premium', email: 'ana@example.com', plan: 'premium', student_id: 'student-premium' });
  seedAccess(d.sqlite, { id: 'access-project', name: 'Projeto LM', email: 'lm@example.com', plan: 'projeto_lm', student_id: 'student-project' });

  const premium = await d.studentRepository.create({ student_id: 'student-premium', email: 'ana@example.com', display_name: 'Ana Premium', consultation_status: 'NEW', access_status: 'ACTIVE', source: 'RC1_E2E', created_at: '2026-07-14T00:00:00.000Z' });
  assert.equal(premium.consultation_status, 'NEW');

  const createPending = createCreatePendingItemUseCase({ studentRepository: d.studentRepository, pendingItemRepository: d.pendingItemRepository, followupEntryRepository: d.followupEntryRepository, randomUUID: d.randomUUID });
  const analyzeAnamnesis = createAnalyzeAnamnesisUseCase({ anamnesisRepository: d.anamnesisRepository });
  const updateStatus = createUpdateConsultationStatusUseCase({ studentRepository: d.studentRepository, followupEntryRepository: d.followupEntryRepository, db: d.db, randomUUID: d.randomUUID });
  const getRecord = createGetStudentRecordUseCase({ studentRepository: d.studentRepository, studentRecordRepository: d.studentRecordRepository, pendingItemRepository: d.pendingItemRepository, randomUUID: d.randomUUID });
  const workspaceSummary = createGetProfessionalWorkspaceSummaryUseCase({ workspaceRepository: d.workspaceRepository });
  const workspaceStudent = createGetProfessionalWorkspaceStudentUseCase({ workspaceRepository: d.workspaceRepository });
  const workspaceSearch = createSearchProfessionalWorkspaceStudentsUseCase({ workspaceRepository: d.workspaceRepository });

  const invalidTransition = await updateStatus({ student_id: 'student-premium', status: 'ACTIVE', created_by: 'admin' }).catch((error) => ({ ok: false, error }));
  assert.equal(invalidTransition.ok, false);

  await d.anamnesisRepository.create({ id: 'anamnesis-1', student_id: 'student-premium', student_name: 'Ana Premium', student_email: 'ana@example.com', status: 'SUBMITTED', answers_json: JSON.stringify({ goal: 'performance' }), created_at: '2026-07-14T01:00:00.000Z' });
  const anamPending = await createPending({ student_id: 'student-premium', type: 'ANALYZE_ANAMNESIS', title: 'Analisar anamnese', related_entity_type: 'premium_anamnesis', related_entity_id: 'anamnesis-1', source: 'automatic' });
  assert.equal(anamPending.ok, true);
  assert.equal(scalar(d.sqlite, "SELECT COUNT(*) total FROM premium_pending_items WHERE type='ANALYZE_ANAMNESIS' AND status='OPEN'").total, 1);
  assert.equal((await analyzeAnamnesis.execute({ id: 'anamnesis-1', status: 'ANALYZED', updated_at: '2026-07-14T02:00:00.000Z' })).ok, true);
  await d.pendingItemRepository.resolveOpenByRelated({ student_id: 'student-premium', type: 'ANALYZE_ANAMNESIS', related_entity_type: 'premium_anamnesis', related_entity_id: 'anamnesis-1', resolved_at: '2026-07-14T02:01:00.000Z' });

  for (const status of ['AWAITING_ANAMNESIS', 'UNDER_REVIEW', 'READY_TO_RELEASE', 'ACTIVE']) assert.equal((await updateStatus({ student_id: 'student-premium', status, created_by: 'admin' })).ok, true);
  const releaseAudit = all(d.sqlite, "SELECT content FROM premium_followup_entries WHERE student_id='student-premium' AND entry_type='CONSULTATION_STATUS_CHANGE'").map((entry) => JSON.parse(entry.content));
  assert.equal(releaseAudit.some((entry) => entry.from === 'UNDER_REVIEW' && entry.to === 'READY_TO_RELEASE' && entry.action === 'mark-ready' && entry.origin === 'student_record'), true);
  assert.equal(releaseAudit.some((entry) => entry.from === 'READY_TO_RELEASE' && entry.to === 'ACTIVE' && entry.action === 'release' && entry.origin === 'student_record'), true);

  const previousPlan = await d.nutritionPlanRepository.saveCurrent({ id: 'legacy-plan', student_id: 'student-premium', student_email: 'ana@example.com', title: 'Plano anterior', goal: 'base', strategy: 'base', meals: [{ name: 'Café' }], substitutions: [], adherence_rules: [], notes: 'nota antiga', whatsapp_message: 'msg', created_at: '2026-07-13T00:00:00.000Z' });
  assert.equal(previousPlan.status, 'PUBLISHED');
  const recordAfterActivation = presentStudentRecord((await getRecord({ student_id: 'student-premium' })).data);
  assert.equal(recordAfterActivation.student.student_id, 'student-premium');
  const wsContextAfterActivation = presentWorkspaceStudentContext((await workspaceStudent('student-premium')).data);
  assert.equal(wsContextAfterActivation.summary.studentId, 'student-premium');

  const submitFeedback = createSubmitWeeklyFeedbackUseCase({ identityService: d.identityService, weeklyFeedbackRepository: d.weeklyFeedbackRepository, pendingItemRepository: d.pendingItemRepository, db: d.db, randomUUID: d.randomUUID, log: () => {} });
  const feedbackPayload = { id: 'feedback-1', student_email: 'ana@example.com', week_ref: '2026-W28', training_adherence: 'ok', nutrition_adherence: 'ok', created_at: '2026-07-14T03:00:00.000Z', submitted_at: '2026-07-14T03:00:00.000Z' };
  assert.equal((await submitFeedback.execute({ feedback: feedbackPayload, route: '/api/student/premium/weekly-feedback', method: 'POST' })).ok, true);
  assert.equal((await submitFeedback.execute({ feedback: { ...feedbackPayload, id: 'feedback-retry', main_difficulty: 'retry' }, route: '/api/student/premium/weekly-feedback', method: 'POST' })).ok, true);
  assert.equal(scalar(d.sqlite, "SELECT COUNT(*) total FROM student_checkins WHERE student_id='student-premium' AND week_ref='2026-W28'").total, 1);
  assert.equal(scalar(d.sqlite, "SELECT COUNT(*) total FROM premium_pending_items WHERE type='ANALYZE_WEEKLY_FEEDBACK' AND status='OPEN'").total, 1);

  const recordDecision = createRecordProfessionalDecisionUseCase({ weeklyFeedbackRepository: d.weeklyFeedbackRepository, followupEntryRepository: d.followupEntryRepository, pendingItemRepository: d.pendingItemRepository, db: d.db, randomUUID: d.randomUUID });
  assert.equal((await recordDecision({ feedback_id: 'feedback-1', decision_type: 'UPDATE_PLAN', note: 'Atualizar plano', created_by: 'admin' })).ok, true);
  assert.equal((await recordDecision({ feedback_id: 'feedback-1', decision_type: 'UPDATE_PLAN', note: 'Retry decisão', created_by: 'admin' })).data.unchanged, true);
  assert.equal(scalar(d.sqlite, "SELECT COUNT(*) total FROM premium_followup_entries WHERE entry_type='PROFESSIONAL_DECISION' AND related_entity_id='feedback-1'").total, 1);
  assert.equal(scalar(d.sqlite, "SELECT COUNT(*) total FROM premium_pending_items WHERE type='ANALYZE_WEEKLY_FEEDBACK' AND status='OPEN'").total, 0);
  assert.equal(scalar(d.sqlite, "SELECT COUNT(*) total FROM premium_pending_items WHERE type='CREATE_NUTRITION_PLAN' AND status='OPEN'").total, 1);

  const createDraft = createCreateNutritionPlanDraftUseCase({ studentRepository: d.studentRepository, nutritionPlanRepository: d.nutritionPlanRepository, randomUUID: d.randomUUID });
  const updateDraft = createUpdateNutritionPlanDraftUseCase({ nutritionPlanRepository: d.nutritionPlanRepository });
  const publishPlan = createPublishNutritionPlanUseCase({ nutritionPlanRepository: d.nutritionPlanRepository, randomUUID: d.randomUUID });
  const draftResult = await createDraft.execute({ student_id: 'student-premium', source_feedback_id: 'feedback-1', plan: { title: 'Plano RC1', goal: 'cut', strategy: 'periodizada', meals: [{ name: 'Almoço', items: [{ food: 'arroz', quantity: '100', unit: 'g' }] }], notes: 'orientacao publica rc1' } });
  assert.equal(draftResult.ok, true);
  const draft = draftResult.data;
  const updatedDraft = await updateDraft.execute({ id: draft.id, student_id: 'student-premium', updates: { expected_updated_at: draft.updated_at, updated_at: '2026-07-14T04:00:00.000Z', title: 'Plano RC1 v2', goal: 'cut', strategy: 'periodizada', meals: [{ name: 'Almoço', items: [{ food: 'arroz', quantity: '100', unit: 'g' }, { food: 'frango', quantity: '120', unit: 'g' }] }], substitutions: [], adherenceRules: [], notes: 'orientacao publica rc1', whatsappMessage: 'mensagem' } });
  assert.equal(updatedDraft.ok, true);
  const staleUpdate = await updateDraft.execute({ id: draft.id, student_id: 'student-premium', updates: { expected_updated_at: draft.updated_at, title: 'stale', meals: [{ name: 'Almoço', items: [{ food: 'arroz', quantity: '100', unit: 'g' }] }] } });
  assert.equal(staleUpdate.conflict, true);
  const published = await publishPlan.execute({ id: draft.id, student_id: 'student-premium', published_by: 'admin', professional_note: 'publicar' });
  assert.equal(published.ok, true);
  const publishRetry = await publishPlan.execute({ id: draft.id, student_id: 'student-premium', published_by: 'admin', professional_note: 'retry' });
  assert.equal(publishRetry.ok, true);
  assert.equal(publishRetry.idempotent, true);
  assert.equal(scalar(d.sqlite, "SELECT COUNT(*) total FROM nutrition_plans WHERE student_id='student-premium' AND status='PUBLISHED' AND is_active=1").total, 1);
  assert.equal(scalar(d.sqlite, "SELECT status FROM nutrition_plans WHERE id='legacy-plan'").status, 'ARCHIVED');
  assert.equal(scalar(d.sqlite, "SELECT COUNT(*) total FROM premium_followup_entries WHERE entry_type='PLAN_CHANGE' AND related_entity_id=?", draft.id).total, 1);
  assert.equal(scalar(d.sqlite, "SELECT COUNT(*) total FROM premium_pending_items WHERE type='CREATE_NUTRITION_PLAN' AND status='OPEN'").total, 0);
  const publicPlan = presentPublicNutritionPlan(await d.nutritionPlanRepository.findById(draft.id));
  assert.equal(publicPlan.title, 'Plano RC1 v2');
  assert.equal(JSON.stringify(publicPlan).includes('private notes'), false);
  assert.equal(presentPublicNutritionPlan(await d.nutritionPlanRepository.findDraftByStudentId('student-premium')), null);

  assert.equal((await updateStatus({ student_id: 'student-premium', status: 'PAUSED', created_by: 'admin' })).ok, true);
  assert.equal((await updateStatus({ student_id: 'student-premium', status: 'ACTIVE', created_by: 'admin' })).ok, true);
  assert.equal((await updateStatus({ student_id: 'student-premium', status: 'ENDED', created_by: 'admin' })).ok, true);
  const invalidAfterEnded = await updateStatus({ student_id: 'student-premium', status: 'ACTIVE', created_by: 'admin' }).catch((error) => ({ ok: false, error }));
  assert.equal(invalidAfterEnded.ok, false);
  assert.equal(scalar(d.sqlite, "SELECT COUNT(*) total FROM premium_followup_entries WHERE entry_type='CONSULTATION_STATUS_CHANGE'").total, 7);

  const finalRecord = presentStudentRecord((await getRecord({ student_id: 'student-premium' })).data);
  assert.equal(finalRecord.summary.has_current_nutrition_plan, true);
  assert.equal(finalRecord.summary.open_pending_items_count, 0);
  const finalWorkspace = presentWorkspaceSummary((await workspaceSummary({ featureEnabled: true, now: new Date('2026-07-18T12:00:00.000Z') })).data);
  assert.equal(finalWorkspace.featureFlag.enabled, true);
  const finalContext = presentWorkspaceStudentContext((await workspaceStudent('student-premium')).data);
  assert.equal(finalContext.summary.studentId, 'student-premium');

  assert.equal((await workspaceSearch({ q: 'lm@example.com', limit: 10 })).data.items.length, 0);
  assert.equal((await workspaceStudent('student-project')).status, 404);
  assert.equal((await getRecord({ student_id: 'student-project' })).status, 404);
  assert.equal(all(d.sqlite, "SELECT * FROM premium_students WHERE student_id='student-project'").length, 0);
  assert.equal(all(d.sqlite, "SELECT * FROM student_checkins WHERE student_id='student-project'").length, 0);
  assert.equal(all(d.sqlite, "SELECT * FROM nutrition_plans WHERE student_id='student-project'").length, 0);
  assert.equal(all(d.sqlite, "SELECT * FROM premium_pending_items WHERE student_id='student-project'").length, 0);
  assert.equal(all(d.sqlite, "SELECT * FROM premium_followup_entries WHERE student_id='student-project'").length, 0);
});
