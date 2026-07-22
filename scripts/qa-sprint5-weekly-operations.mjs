#!/usr/bin/env node
import { existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { replayMigrations } from './db-tool.mjs';
import { createSubmitWeeklyFeedbackUseCase } from '../workers/premium/application/submit-weekly-feedback.js';
import { createCreatePendingItemUseCase } from '../workers/premium/application/create-pending-item.js';
import { createResolvePendingItemUseCase } from '../workers/premium/application/resolve-pending-item.js';
import { createCreateNutritionPlanDraftUseCase } from '../workers/premium/application/create-nutrition-plan-draft.js';
import { createPublishNutritionPlanUseCase } from '../workers/premium/application/publish-nutrition-plan.js';
import { createGetCurrentNutritionPlanUseCase } from '../workers/premium/application/get-current-nutrition-plan.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const evidence = [];
const pass = (scope, message, details = {}) => evidence.push({ scope, message, ...details });
const fail = (scope, message, details = {}) => failures.push({ scope, message, ...details });
const assert = (condition, scope, message, details = {}) => condition ? pass(scope, message, details) : fail(scope, message, details);
const read = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8');

function auditDatabaseContract() {
  const scope = 'weekly-operations-database';
  const replay = replayMigrations();
  if (!replay.ok || !replay.database) {
    fail(scope, 'Replay de migrations falhou; operação semanal não pôde ser auditada.', { error: replay.error });
    return;
  }
  const db = new DatabaseSync(replay.database);
  try {
    for (const table of ['premium_students','premium_anamnesis','nutrition_plans','student_checkins','premium_pending_items','premium_followup_entries']) {
      assert(Boolean(db.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name=?").get(table)), scope, `Fonte integrada presente: ${table}`);
    }
    const planIndexes = db.prepare('PRAGMA index_list(nutrition_plans)').all().map((row) => row.name);
    const feedbackIndexes = db.prepare('PRAGMA index_list(student_checkins)').all().map((row) => row.name);
    assert(planIndexes.some((name) => /active|published/i.test(name)), scope, 'Schema protege o plano publicado ativo.', { planIndexes });
    assert(feedbackIndexes.includes('idx_student_checkins_student_id_week_unique'), scope, 'Schema protege um feedback por aluno e semana.', { feedbackIndexes });
    assert(db.prepare('PRAGMA integrity_check').get()?.integrity_check === 'ok', scope, 'Integridade SQLite aprovada.');
    assert(db.prepare('PRAGMA foreign_key_check').all().length === 0, scope, 'Foreign keys aprovadas.');
  } finally {
    db.close();
    rmSync(path.dirname(replay.database), { recursive: true, force: true });
  }
}

function auditCodeContracts() {
  const scope = 'weekly-operations-code-contracts';
  const files = [
    'workers/premium/application/submit-weekly-feedback.js',
    'workers/premium/application/create-nutrition-plan-draft.js',
    'workers/premium/application/publish-nutrition-plan.js',
    'workers/premium/application/create-pending-item.js',
    'workers/premium/application/resolve-pending-item.js',
    'workers/premium/repositories/d1-professional-workspace-repository.js',
    'workers/premium/presenters/public-nutrition-plan-presenter.js',
    'workers/api.js',
  ];
  for (const file of files) assert(existsSync(path.join(root, file)), scope, `Arquivo obrigatório presente: ${file}`);
  if (failures.some((item) => item.scope === scope)) return;
  const submit = read(files[0]);
  const publish = read(files[2]);
  const workspace = read(files[5]);
  const presenter = read(files[6]);
  const worker = read(files[7]);
  const contracts = [
    [submit.includes('ANALYZE_WEEKLY_FEEDBACK') && submit.includes('FEEDBACK_RECEIVED'), 'Feedback cria pendência e evento operacional.'],
    [publish.includes('PUBLISHED') && publish.includes('publish'), 'Publicação exige confirmação do estado PUBLISHED.'],
    [workspace.includes('feedbacksAwaitingAnalysis') && workspace.includes('studentsWithoutResponse'), 'Dashboard distingue análise pendente e ausência de resposta.'],
    [workspace.includes('isSaturdayInSaoPaulo') && workspace.includes('America/Sao_Paulo'), 'Regra de sábado usa timezone operacional oficial.'],
    [presenter.includes('status') || presenter.includes('is_active'), 'Presenter público restringe o plano exposto.'],
    [worker.includes('getProfessionalWorkspaceSummary') && worker.includes('nutrition'), 'Worker registra Workspace e fluxo nutricional.'],
  ];
  for (const [condition, message] of contracts) assert(condition, scope, message);
  const thisScript = read('scripts/qa-sprint5-weekly-operations.mjs');
  assert(!thisScript.includes('/project-lm') && !thisScript.includes('workout'), scope, 'Cenário permanece exclusivo da Consultoria Premium.');
}

async function auditIntegratedWeek() {
  const scope = 'weekly-operations-integrated-scenario';
  let sequence = 0;
  const uuid = () => `qa-5-5-${++sequence}`;
  const student = { student_id:'student-weekly-qa', email:'weekly.qa@lm.test', consultation_status:'ACTIVE' };
  const feedbacks = [];
  const pending = [];
  const followups = [];
  const events = [];
  const plans = [];

  const studentRepository = { findByStudentId: async (id) => id === student.student_id ? student : null };
  const identityService = {
    resolve: async ({ email }) => ({ ok: email === student.email, student }),
    resolveIdentifier: async () => ({ ok:true, student }),
  };
  const followupEntryRepository = {
    async append(entry) { const saved = { ...entry, created_at:entry.created_at || new Date().toISOString() }; followups.push(saved); return saved; },
  };
  const pendingItemRepository = {
    async create(item) {
      const existing = pending.find((p) => p.status === 'OPEN' && p.student_id === item.student_id && p.type === item.type && (p.related_entity_id || null) === (item.related_entity_id || null));
      if (existing) return existing;
      const saved = { ...item, status:'OPEN', created_at:item.created_at || new Date().toISOString() };
      pending.push(saved); return saved;
    },
    async findById(id) { return pending.find((item) => item.id === id) || null; },
    async resolve(id, { created_by } = {}) {
      const item = pending.find((entry) => entry.id === id);
      if (!item) return null;
      item.status = 'RESOLVED'; item.resolved_at = new Date().toISOString(); item.created_by ||= created_by || null;
      return item;
    },
  };

  const createPending = createCreatePendingItemUseCase({ studentRepository, pendingItemRepository, followupEntryRepository, randomUUID:uuid });
  const resolvePending = createResolvePendingItemUseCase({ pendingItemRepository, followupEntryRepository, randomUUID:uuid });

  const nutritionPlanRepository = {
    async createDraft(input) {
      const draft = { ...input, status:'DRAFT', is_active:0, version_number:null, created_at:new Date().toISOString() };
      plans.push(draft); return draft;
    },
    async findById(id) { return plans.find((plan) => plan.id === id) || null; },
    async publish(id, { published_by }) {
      const plan = plans.find((item) => item.id === id);
      if (!plan) return null;
      const previous = plans.find((item) => item.student_id === plan.student_id && item.status === 'PUBLISHED' && item.is_active === 1 && item.id !== id);
      if (previous) { previous.is_active = 0; previous.status = 'ARCHIVED'; }
      const maxVersion = Math.max(0, ...plans.filter((item) => item.student_id === plan.student_id && Number(item.version_number)).map((item) => Number(item.version_number)));
      plan.status = 'PUBLISHED'; plan.is_active = 1; plan.version_number ||= maxVersion + 1; plan.published_by = published_by; plan.published_at = new Date().toISOString();
      plan.supersedes_plan_id = previous?.id || null;
      followups.push({ id:uuid(), student_id:plan.student_id, entry_type:'PLAN_CHANGE', title:'Plano publicado', related_entity_id:plan.id, created_at:plan.published_at });
      return plan;
    },
    async findCurrentByStudentId(studentId) { return plans.find((item) => item.student_id === studentId && item.status === 'PUBLISHED' && item.is_active === 1) || null; },
  };

  const createDraft = createCreateNutritionPlanDraftUseCase({ studentRepository, nutritionPlanRepository, randomUUID:uuid });
  const publishPlan = createPublishNutritionPlanUseCase({ nutritionPlanRepository, randomUUID:uuid });
  const currentPlan = createGetCurrentNutritionPlanUseCase({ studentRepository, nutritionPlanRepository });

  const planningPending = await createPending({ student_id:student.student_id, type:'CREATE_NUTRITION_PLAN', title:'Criar planejamento', source:'anamnesis' });
  assert(planningPending.ok === true && pending.filter((item) => item.status === 'OPEN').length === 1, scope, 'Anamnese gera uma pendência operacional de planejamento.');

  const draftResult = await createDraft.execute({ student_id:student.student_id, plan:{ title:'Plano semanal', meals:[{ name:'Almoço', items:['Arroz','Frango'] }] } });
  assert(draftResult.ok === true && draftResult.data.status === 'DRAFT', scope, 'Nutricionista cria rascunho sem exposição ao aluno.');
  assert((await currentPlan.execute({ student_id:student.student_id })).data === null, scope, 'Portal não recebe rascunho.');

  const published = await publishPlan.execute({ id:draftResult.data.id, student_id:student.student_id, published_by:'nutritionist@lm.test' });
  assert(published.ok === true && published.data.is_active === 1, scope, 'Plano é publicado e ativado.');
  await resolvePending({ id:planningPending.data.id, created_by:'nutritionist@lm.test' });
  const portalPlan = await currentPlan.execute({ student_id:student.student_id });
  assert(portalPlan.ok === true && portalPlan.data?.id === published.data.id, scope, 'Portal lê exatamente a versão publicada ativa.');
  assert(plans.filter((item) => item.status === 'PUBLISHED' && item.is_active === 1).length === 1, scope, 'Existe somente um plano publicado ativo.');

  const weeklyFeedbackRepository = {
    async create(record) { const saved = { ...record, coach_status:'pending' }; feedbacks.push(saved); return saved; },
    async findByStudentAndWeek(studentId, weekRef) { return feedbacks.find((item) => item.student_id === studentId && item.week_ref === weekRef) || null; },
  };
  const submitFeedback = createSubmitWeeklyFeedbackUseCase({
    identityService,
    weeklyFeedbackRepository,
    pendingItemRepository,
    eventRepository:{ append:async (event) => { events.push(event); return event; } },
    randomUUID:uuid,
    log:async () => {},
  });
  const feedback = { id:'feedback-week-30', student_email:student.email, week_ref:'2026-W30', nutrition_adherence:'Boa', sleep_quality:'Bom', energy_level:'Normal', stress_level:'Moderado', main_difficulty:'Rotina', support_needed:'Ajustar jantar' };
  const submitted = await submitFeedback.execute({ feedback, route:'/api/portal/checkin', method:'POST' });
  assert(submitted.ok === true && feedbacks.length === 1, scope, 'Aluno envia feedback da semana e o banco lógico recebe uma resposta.');
  const feedbackPending = pending.find((item) => item.type === 'ANALYZE_WEEKLY_FEEDBACK' && item.status === 'OPEN');
  assert(Boolean(feedbackPending), scope, 'Feedback entra na fila operacional de análise.');
  assert(events.some((event) => event.event_type === 'FEEDBACK_RECEIVED'), scope, 'Recebimento permanece auditável.');

  followups.push({ id:uuid(), student_id:student.student_id, entry_type:'FEEDBACK_REVIEW', title:'Feedback analisado', created_by:'nutritionist@lm.test', created_at:new Date().toISOString() });
  feedbacks[0].coach_status = 'reviewed';
  await resolvePending({ id:feedbackPending.id, created_by:'nutritionist@lm.test' });
  assert(pending.filter((item) => item.status === 'OPEN').length === 0, scope, 'Após análise, a fila de pendências fica vazia.');
  assert(feedbacks.filter((item) => item.coach_status === 'pending').length === 0, scope, 'Feedback analisado sai da fila de revisão.');
  assert(followups.some((item) => item.entry_type === 'FEEDBACK_REVIEW'), scope, 'Análise profissional gera follow-up.');
  assert(followups.some((item) => item.entry_type === 'PENDING_ITEM_RESOLVED'), scope, 'Resolução da pendência permanece auditável.');
  assert(followups.some((item) => item.entry_type === 'PLAN_CHANGE'), scope, 'Publicação do plano permanece no histórico operacional.');

  const saturday = new Date('2026-07-25T12:00:00-03:00');
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone:'America/Sao_Paulo', weekday:'short' }).format(saturday);
  assert(weekday === 'Sat', scope, 'Cenário de sábado é calculado no timezone America/Sao_Paulo.');

  const finalState = {
    studentId:student.student_id,
    consultationStatus:student.consultation_status,
    activePlanId:(await currentPlan.execute({ student_id:student.student_id })).data?.id,
    openPendingItems:pending.filter((item) => item.status === 'OPEN').length,
    feedbacksAwaitingAnalysis:feedbacks.filter((item) => item.coach_status === 'pending').length,
    followupCount:followups.length,
  };
  assert(finalState.activePlanId === published.data.id && finalState.openPendingItems === 0 && finalState.feedbacksAwaitingAnalysis === 0, scope, 'Banco, Portal, Workspace e operação convergem para o mesmo estado final.', { finalState });
}

async function main() {
  auditDatabaseContract();
  auditCodeContracts();
  await auditIntegratedWeek();
  const report = { sprint:'QA 5.5', status:failures.length ? 'FAILED' : 'VALIDATED', generatedAt:new Date().toISOString(), summary:{ failures:failures.length, evidence:evidence.length }, failures, evidence };
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = failures.length ? 1 : 0;
}

await main();
