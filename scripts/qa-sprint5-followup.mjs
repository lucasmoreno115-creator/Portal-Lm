#!/usr/bin/env node
import { existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { replayMigrations } from './db-tool.mjs';
import { FollowupEntryType } from '../workers/premium/domain/followup-entry.js';
import { createAddFollowupEntryUseCase } from '../workers/premium/application/add-followup-entry.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const evidence = [];
const pass = (scope, message, details = {}) => evidence.push({ scope, message, ...details });
const fail = (scope, message, details = {}) => failures.push({ scope, message, ...details });
const assert = (condition, scope, message, details = {}) => condition ? pass(scope, message, details) : fail(scope, message, details);
const read = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8');

function auditDatabaseContract() {
  const scope = 'followup-database';
  const replay = replayMigrations();
  if (!replay.ok || !replay.database) return fail(scope, 'Replay de migrations falhou.', { error: replay.error });
  const db = new DatabaseSync(replay.database);
  try {
    const columns = db.prepare('PRAGMA table_info(premium_followup_entries)').all().map((row) => row.name);
    const required = ['id','student_id','entry_type','title','content','source','related_entity_type','related_entity_id','created_by','created_at','updated_at'];
    const missing = required.filter((column) => !columns.includes(column));
    assert(missing.length === 0, scope, 'Tabela de follow-up possui campos de auditoria.', { missing });
    const indexes = db.prepare('PRAGMA index_list(premium_followup_entries)').all();
    assert(indexes.length > 0, scope, 'Follow-up possui índices operacionais.', { indexes: indexes.map((row) => row.name) });
    assert(db.prepare('PRAGMA foreign_key_check').all().length === 0, scope, 'Foreign keys permanecem íntegras.');
  } finally {
    db.close();
    rmSync(path.dirname(replay.database), { recursive: true, force: true });
  }
}

function auditCodeContracts() {
  const scope = 'followup-code-contracts';
  const files = [
    'workers/premium/domain/followup-entry.js',
    'workers/premium/application/add-followup-entry.js',
    'workers/premium/repositories/d1-followup-entry-repository.js',
    'workers/premium/application/record-professional-decision.js',
    'workers/premium/application/create-pending-item.js',
    'workers/premium/application/resolve-pending-item.js',
    'workers/premium/repositories/d1-student-record-repository.js',
    'workers/api.js',
  ];
  for (const file of files) assert(existsSync(path.join(root, file)), scope, `Arquivo obrigatório presente: ${file}`);
  if (failures.some((item) => item.scope === scope)) return;
  const repository = read(files[2]);
  const decision = read(files[3]);
  const createPending = read(files[4]);
  const resolvePending = read(files[5]);
  const record = read(files[6]);
  const worker = read(files[7]);
  assert(repository.includes('ORDER BY datetime(created_at) DESC, id DESC'), scope, 'Timeline possui ordenação estável do mais recente para o mais antigo.');
  assert(repository.includes('LIMIT ? OFFSET ?'), scope, 'Listagem suporta paginação.');
  assert(repository.includes('related_entity_type') && repository.includes('related_entity_id'), scope, 'Follow-up preserva vínculo com a entidade de origem.');
  assert(decision.includes("'PROFESSIONAL_DECISION'") && decision.includes("'student_checkins'"), scope, 'Conduta profissional gera entrada vinculada ao feedback.');
  assert(createPending.includes("'PENDING_ITEM_CREATED'"), scope, 'Criação de pendência gera follow-up.');
  assert(resolvePending.includes("'PENDING_ITEM_RESOLVED'"), scope, 'Resolução de pendência gera follow-up.');
  assert(record.includes('listFollowupEntries'), scope, 'Student Record carrega o histórico de follow-up.');
  assert(worker.includes('addFollowupEntry') && worker.includes('recordProfessionalDecision'), scope, 'Worker registra os fluxos de follow-up e decisão.');
}

async function auditApplicationFlow() {
  const scope = 'followup-application-flow';
  const entries = [];
  let sequence = 0;
  const repository = {
    async append(entry) { const saved = { ...entry, created_at: entry.created_at ?? `2026-07-22T16:00:0${sequence++}Z`, updated_at: entry.updated_at ?? `2026-07-22T16:00:0${sequence}Z` }; entries.push(saved); return saved; },
    async listByStudentId(studentId, { limit = 50, offset = 0 } = {}) { return entries.filter((entry) => entry.student_id === studentId).sort((a,b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id)).slice(offset, offset + limit); },
  };
  const useCase = createAddFollowupEntryUseCase({
    studentRepository: { findByStudentId: async (id) => id === 'student-qa-5-3' ? { student_id:id } : null },
    followupEntryRepository: repository,
    randomUUID: () => `followup-${++sequence}`,
  });
  const missing = await useCase({ entry_type:'PROFESSIONAL_NOTE', title:'Nota' });
  assert(missing.status === 400, scope, 'Follow-up exige student_id.');
  const unknown = await useCase({ student_id:'unknown', entry_type:'PROFESSIONAL_NOTE', title:'Nota' });
  assert(unknown.status === 404, scope, 'Follow-up bloqueia aluno inexistente.');
  let invalidBlocked = false;
  try { await useCase({ student_id:'student-qa-5-3', entry_type:'INVALID', title:'Inválido' }); } catch { invalidBlocked = true; }
  assert(invalidBlocked, scope, 'Tipo de follow-up inválido é bloqueado.');
  const first = await useCase({ student_id:'student-qa-5-3', entry_type:'PROFESSIONAL_NOTE', title:'Nota profissional', content:'Manter estratégia', source:'admin', created_by:'qa-agent' });
  const second = await useCase({ student_id:'student-qa-5-3', entry_type:'FEEDBACK_REVIEW', title:'Feedback analisado', content:'Ajuste confirmado', source:'admin', related_entity_type:'student_checkins', related_entity_id:'feedback-1', created_by:'qa-agent' });
  assert(first.ok && second.ok && entries.length === 2, scope, 'Entradas válidas são persistidas.');
  assert(second.data.related_entity_id === 'feedback-1', scope, 'Referência à entidade relacionada é preservada.');
  const timeline = await repository.listByStudentId('student-qa-5-3', { limit:1, offset:0 });
  assert(timeline.length === 1 && timeline[0].entry_type === 'FEEDBACK_REVIEW', scope, 'Timeline é ordenada e paginada de forma estável.');
  const expectedTypes = ['PROFESSIONAL_NOTE','PROFESSIONAL_DECISION','PLAN_CHANGE','ANAMNESIS_REVIEW','FEEDBACK_REVIEW','CONSULTATION_STATUS_CHANGE','PENDING_ITEM_CREATED','PENDING_ITEM_RESOLVED'];
  assert(JSON.stringify(Object.values(FollowupEntryType)) === JSON.stringify(expectedTypes), scope, 'Domínio oficial de tipos de follow-up está completo.', { expectedTypes });
}

async function main() {
  auditDatabaseContract();
  auditCodeContracts();
  await auditApplicationFlow();
  const report = { sprint:'QA 5.3', status:failures.length ? 'FAILED' : 'VALIDATED', generatedAt:new Date().toISOString(), summary:{ failures:failures.length, evidence:evidence.length }, failures, evidence };
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = failures.length ? 1 : 0;
}

await main();
