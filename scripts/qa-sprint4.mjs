#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { ConsultationStatus, canTransitionConsultationStatus, transitionConsultationStatus } from '../workers/premium/domain/consultation-status.js';
import { createGetStudentRecordUseCase } from '../workers/premium/application/get-student-record.js';
import { createAddFollowupEntryUseCase } from '../workers/premium/application/add-followup-entry.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const evidence = [];
const pass = (scope, message, details = {}) => evidence.push({ scope, message, ...details });
const fail = (scope, message, details = {}) => failures.push({ scope, message, ...details });
const assert = (condition, scope, message, details = {}) => condition ? pass(scope, message, details) : fail(scope, message, details);
const read = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8');

function auditLifecycleDomain() {
  const scope = 'consultation-lifecycle';
  const expected = ['NEW','AWAITING_ANAMNESIS','UNDER_REVIEW','READY_TO_RELEASE','ACTIVE','PAUSED','ENDED'];
  assert(JSON.stringify(Object.values(ConsultationStatus)) === JSON.stringify(expected), scope, 'Estados canônicos do lifecycle estão completos.', { expected });
  const valid = [
    ['NEW','AWAITING_ANAMNESIS'], ['AWAITING_ANAMNESIS','UNDER_REVIEW'],
    ['UNDER_REVIEW','READY_TO_RELEASE'], ['READY_TO_RELEASE','ACTIVE'],
    ['ACTIVE','PAUSED'], ['ACTIVE','ENDED'], ['PAUSED','ACTIVE'], ['PAUSED','ENDED'],
  ];
  for (const [from, to] of valid) assert(canTransitionConsultationStatus(from, to), scope, `Transição válida: ${from} → ${to}`);
  const invalid = [['NEW','ACTIVE'], ['UNDER_REVIEW','ACTIVE'], ['READY_TO_RELEASE','PAUSED'], ['ENDED','ACTIVE']];
  for (const [from, to] of invalid) {
    let blocked = false;
    try { transitionConsultationStatus(from, to); } catch { blocked = true; }
    assert(blocked, scope, `Transição inválida bloqueada: ${from} → ${to}`);
  }
}

async function auditStudentRecord() {
  const scope = 'student-record';
  const createdPending = [];
  const recordRepo = {
    getStudentHeader: async () => ({ student_id:'student-1', consultation_status:'ACTIVE', email:'qa@lm.test' }),
    getAnamnesis: async () => ({ id:'anam-1', status:'RECEIVED' }),
    getNutritionPlanWorkflow: async () => ({ current:null, draft:null, history:[] }),
    listRecentFeedbacks: async () => [{ id:'feedback-1', coach_status:'PENDING' }],
    listFollowupEntries: async () => [{ id:'entry-1', entry_type:'PROFESSIONAL_NOTE' }],
    getCurrentSummary: async () => ({ pending_count:3 }),
    listPendingItems: async () => createdPending,
  };
  const useCase = createGetStudentRecordUseCase({
    studentRepository: { findByStudentId: async () => null },
    studentRecordRepository: recordRepo,
    pendingItemRepository: { create: async (item) => { createdPending.push(item); return item; } },
    identityService: { resolveIdentifier: async () => ({ ok:true, student:{ student_id:'student-1' } }) },
    randomUUID: (() => { let n=0; return () => `pending-${++n}`; })(),
  });
  const missing = await useCase({});
  assert(missing.status === 400, scope, 'Student Record exige student_id.');
  const result = await useCase({ student_id:'student-1' });
  assert(result.ok === true, scope, 'Student Record carrega com identidade canônica.');
  assert(result.data.student.student_id === 'student-1', scope, 'Cabeçalho do aluno foi carregado.');
  assert(Array.isArray(result.data.feedbacks) && result.data.feedbacks.length === 1, scope, 'Feedbacks recentes foram carregados.');
  assert(Array.isArray(result.data.followup_entries) && result.data.followup_entries.length === 1, scope, 'Histórico de follow-up foi carregado.');
  const types = createdPending.map((item) => item.type).sort();
  assert(types.includes('ANALYZE_ANAMNESIS'), scope, 'Pendência automática de anamnese foi criada.', { types });
  assert(types.includes('ANALYZE_WEEKLY_FEEDBACK'), scope, 'Pendência automática de feedback foi criada.', { types });
  assert(types.includes('CREATE_NUTRITION_PLAN'), scope, 'Pendência automática de plano alimentar foi criada.', { types });
}

async function auditFollowup() {
  const scope = 'followup';
  const appended = [];
  const useCase = createAddFollowupEntryUseCase({
    studentRepository: { findByStudentId: async (id) => id === 'student-1' ? { student_id:id } : null },
    followupEntryRepository: { append: async (entry) => { appended.push(entry); return entry; } },
    randomUUID: () => 'followup-1',
  });
  const missingStudent = await useCase({ entry_type:'PROFESSIONAL_NOTE', title:'Teste' });
  assert(missingStudent.status === 400, scope, 'Follow-up exige student_id.');
  const unknown = await useCase({ student_id:'unknown', entry_type:'PROFESSIONAL_NOTE', title:'Teste' });
  assert(unknown.status === 404, scope, 'Follow-up bloqueia aluno inexistente.');
  const result = await useCase({ student_id:'student-1', entry_type:'PROFESSIONAL_NOTE', title:'Registro QA', content:'Evidência' });
  assert(result.ok === true && appended.length === 1, scope, 'Follow-up válido é persistido.');
}

function auditCodeContracts() {
  const scope = 'student-record-contracts';
  const files = [
    'workers/premium/application/get-student-record.js',
    'workers/premium/application/update-consultation-status.js',
    'workers/premium/application/add-followup-entry.js',
    'workers/premium/application/create-pending-item.js',
    'workers/premium/application/resolve-pending-item.js',
    'workers/premium/presenters/student-record-presenter.js',
    'workers/api.js',
  ];
  for (const file of files) assert(existsSync(path.join(root, file)), scope, `Arquivo obrigatório presente: ${file}`);
  if (failures.some((item) => item.scope === scope)) return;
  const worker = read('workers/api.js');
  const statusUseCase = read('workers/premium/application/update-consultation-status.js');
  const recordUseCase = read('workers/premium/application/get-student-record.js');
  assert(worker.includes('getStudentRecord') && worker.includes('updateConsultationStatus'), scope, 'Worker registra Student Record e lifecycle.');
  assert(worker.includes('addFollowupEntry') && worker.includes('resolvePendingItem'), scope, 'Worker registra follow-up e resolução de pendências.');
  assert(statusUseCase.includes('CONSULTATION_STATUS_CHANGE'), scope, 'Mudança de status gera histórico operacional.');
  assert(statusUseCase.includes('409'), scope, 'Concorrência de atualização de status retorna conflito.');
  assert(recordUseCase.includes('ANALYZE_ANAMNESIS') && recordUseCase.includes('ANALYZE_WEEKLY_FEEDBACK') && recordUseCase.includes('CREATE_NUTRITION_PLAN'), scope, 'Student Record materializa pendências operacionais obrigatórias.');
}

auditLifecycleDomain();
await auditStudentRecord();
await auditFollowup();
auditCodeContracts();

const report = { sprint:'QA 4', status:failures.length ? 'FAILED' : 'VALIDATED', generatedAt:new Date().toISOString(), summary:{ failures:failures.length, evidence:evidence.length }, failures, evidence };
console.log(JSON.stringify(report, null, 2));
process.exitCode = failures.length ? 1 : 0;
