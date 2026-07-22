#!/usr/bin/env node
import { existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { replayMigrations } from './db-tool.mjs';
import { createSubmitWeeklyFeedbackUseCase } from '../workers/premium/application/submit-weekly-feedback.js';
import { createGetStudentRecordUseCase } from '../workers/premium/application/get-student-record.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const evidence = [];
const pass = (scope, message, details = {}) => evidence.push({ scope, message, ...details });
const fail = (scope, message, details = {}) => failures.push({ scope, message, ...details });
const assert = (condition, scope, message, details = {}) => condition ? pass(scope, message, details) : fail(scope, message, details);
const read = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8');

function auditDatabaseContract() {
  const scope = 'feedback-database';
  const replay = replayMigrations();
  if (!replay.ok || !replay.database) {
    fail(scope, 'Replay de migrations falhou; pipeline de feedback não pôde ser auditado.', { error: replay.error });
    return;
  }
  const db = new DatabaseSync(replay.database);
  try {
    const columns = db.prepare('PRAGMA table_info(student_checkins)').all().map((row) => row.name);
    const required = ['id','student_id','student_email','week_ref','submitted_at','coach_status','coach_reply','created_at','updated_at'];
    const missing = required.filter((column) => !columns.includes(column));
    assert(missing.length === 0, scope, 'student_checkins possui campos de recebimento, análise e rastreabilidade.', { missing });
    const indexes = db.prepare('PRAGMA index_list(student_checkins)').all().map((row) => row.name);
    assert(indexes.includes('idx_student_checkins_student_id_week_unique'), scope, 'Existe unicidade de feedback por aluno e semana.', { indexes });
    assert(indexes.includes('idx_student_checkins_week_status'), scope, 'Existe índice operacional por semana e status.', { indexes });
    for (const table of ['premium_pending_items','activity_timeline','premium_students']) {
      const row = db.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name=?").get(table);
      assert(Boolean(row), scope, `Tabela integrada presente: ${table}`);
    }
    assert(db.prepare('PRAGMA foreign_key_check').all().length === 0, scope, 'Foreign keys permanecem íntegras após replay.');
  } finally {
    db.close();
    rmSync(path.dirname(replay.database), { recursive: true, force: true });
  }
}

function auditCodeContracts() {
  const scope = 'feedback-code-contracts';
  const files = [
    'portal-checkin.html',
    'portal-shared.js',
    'workers/premium/application/submit-weekly-feedback.js',
    'workers/premium/repositories/d1-weekly-feedback-repository.js',
    'workers/premium/repositories/d1-student-record-repository.js',
    'workers/api.js',
  ];
  for (const file of files) assert(existsSync(path.join(root, file)), scope, `Arquivo obrigatório presente: ${file}`);
  if (failures.some((item) => item.scope === scope)) return;
  const portal = read(files[0]);
  const shared = read(files[1]);
  const submit = read(files[2]);
  const repository = read(files[3]);
  const record = read(files[4]);
  const worker = read(files[5]);
  const contracts = [
    [portal.includes("api('/portal/checkin'") && portal.includes("method: 'POST'"), 'Portal envia feedback pelo endpoint canônico.'],
    [portal.includes("api('/portal/checkins')"), 'Portal carrega histórico do aluno.'],
    [shared.includes("x-student-email") && shared.includes("x-student-token"), 'Portal autentica o envio com identidade e token.'],
    [submit.includes('resolvePremiumIdentityForLegacyEmail') && submit.includes('student_id'), 'Use case resolve identidade canônica antes de persistir.'],
    [submit.includes('ANALYZE_WEEKLY_FEEDBACK') && submit.includes('premium_pending_items'), 'Recebimento cria pendência operacional de análise.'],
    [submit.includes('FEEDBACK_RECEIVED') && submit.includes('activity_timeline'), 'Recebimento registra evento na timeline.'],
    [repository.includes('findByStudentAndWeek') && repository.includes('idx_student_checkins_student_id_week_unique') === false, 'Repositório consulta feedback pela chave aluno/semana.'],
    [repository.includes("NOT IN ('REVIEWED','REPLIED','ANALYZED'"), 'Feedback analisado não pode ser sobrescrito pelo aluno.'],
    [record.includes('student_checkins') && record.includes('listRecentFeedbacks'), 'Student Record lê os feedbacks persistidos.'],
    [worker.includes('createSubmitWeeklyFeedbackUseCase') && worker.includes('createListWeeklyFeedbacksUseCase'), 'Worker registra envio e histórico de feedback.'],
  ];
  for (const [condition, message] of contracts) assert(condition, scope, message);
}

async function auditApplicationPipeline() {
  const scope = 'feedback-application-pipeline';
  const feedbacks = [];
  const pending = [];
  const events = [];
  let sequence = 0;
  const identityService = { resolveIdentifier: async () => ({ ok:true, student:{ student_id:'student-qa-5-1', email:'qa.feedback@lm.test' } }) };
  const weeklyFeedbackRepository = {
    async create(record) { const saved = { ...record, coach_status:'pending' }; feedbacks.push(saved); return saved; },
    async findByStudentAndWeek(studentId, weekRef) { return feedbacks.find((item) => item.student_id === studentId && item.week_ref === weekRef) ?? null; },
  };
  const submit = createSubmitWeeklyFeedbackUseCase({
    identityService,
    weeklyFeedbackRepository,
    pendingItemRepository: { create: async (item) => { pending.push(item); return item; } },
    eventRepository: { append: async (event) => { events.push(event); return event; } },
    randomUUID: () => `qa-5-1-${++sequence}`,
    log: async () => {},
  });
  const feedback = {
    id:'feedback-qa-1', student_email:'qa.feedback@lm.test', week_ref:'2026-W30',
    nutrition_adherence:'Boa', sleep_quality:'Bom', energy_level:'Normal', stress_level:'Moderado',
    main_difficulty:'Rotina', support_needed:'Não', created_at:'2026-07-22T15:00:00Z',
  };
  const submitted = await submit.execute({ feedback, route:'/api/portal/checkin', method:'POST' });
  assert(submitted.ok === true, scope, 'Feedback válido é recebido pelo use case.');
  assert(submitted.saved?.student_id === 'student-qa-5-1', scope, 'Feedback é vinculado ao student_id canônico.');
  assert(feedbacks.length === 1 && feedbacks[0].week_ref === '2026-W30', scope, 'Feedback é persistido com a semana correta.');
  assert(pending.length === 1 && pending[0].type === 'ANALYZE_WEEKLY_FEEDBACK', scope, 'Envio cria uma pendência de análise.');
  assert(events.length === 1 && events[0].event_type === 'FEEDBACK_RECEIVED', scope, 'Envio cria evento operacional auditável.');

  const createdPending = [];
  const recordUseCase = createGetStudentRecordUseCase({
    studentRepository: { findByStudentId: async () => null },
    identityService,
    studentRecordRepository: {
      getStudentHeader: async () => ({ student_id:'student-qa-5-1', consultation_status:'ACTIVE' }),
      getAnamnesis: async () => ({ id:'anam-1', status:'ANALYZED' }),
      getNutritionPlanWorkflow: async () => ({ current:{ id:'plan-1' }, draft:null, history:[] }),
      listRecentFeedbacks: async () => feedbacks,
      listFollowupEntries: async () => [],
      getCurrentSummary: async () => ({ unanalyzed_feedbacks_count:1, last_feedback_at:feedback.created_at }),
      listPendingItems: async () => [...pending, ...createdPending],
    },
    pendingItemRepository: { create: async (item) => { createdPending.push(item); return item; } },
    randomUUID: () => `record-pending-${++sequence}`,
  });
  const record = await recordUseCase({ student_id:'student-qa-5-1' });
  assert(record.ok === true && record.data.feedbacks.length === 1, scope, 'Student Record carrega o feedback recebido.');
  assert(record.data.summary.unanalyzed_feedbacks_count === 1, scope, 'Resumo operacional contabiliza feedback aguardando análise.');
  assert(record.data.pending_items.some((item) => item.type === 'ANALYZE_WEEKLY_FEEDBACK'), scope, 'Workspace/Student Record expõe a pendência vinculada ao feedback.');
}

async function main() {
  auditDatabaseContract();
  auditCodeContracts();
  await auditApplicationPipeline();
  const report = { sprint:'QA 5.1', status:failures.length ? 'FAILED' : 'VALIDATED', generatedAt:new Date().toISOString(), summary:{ failures:failures.length, evidence:evidence.length }, failures, evidence };
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = failures.length ? 1 : 0;
}

await main();
