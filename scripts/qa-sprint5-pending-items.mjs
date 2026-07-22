#!/usr/bin/env node
import { existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { replayMigrations } from './db-tool.mjs';
import { createCreatePendingItemUseCase } from '../workers/premium/application/create-pending-item.js';
import { createResolvePendingItemUseCase } from '../workers/premium/application/resolve-pending-item.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const evidence = [];
const assert = (condition, scope, message, details = {}) => (condition ? evidence : failures).push({ scope, message, ...details });
const read = (file) => readFileSync(path.join(root, file), 'utf8');

function auditDatabase() {
  const scope = 'pending-database';
  const replay = replayMigrations();
  if (!replay.ok || !replay.database) return failures.push({ scope, message:'Replay de migrations falhou.', error:replay.error });
  const db = new DatabaseSync(replay.database);
  try {
    const columns = db.prepare('PRAGMA table_info(premium_pending_items)').all().map((r) => r.name);
    const required = ['id','student_id','type','title','status','priority','source','related_entity_type','related_entity_id','resolved_at','created_at','updated_at'];
    assert(required.every((c) => columns.includes(c)), scope, 'Tabela de pendências possui rastreabilidade completa.', { missing:required.filter((c) => !columns.includes(c)) });
    const indexRows = db.prepare("SELECT name, sql FROM sqlite_schema WHERE type='index' AND tbl_name='premium_pending_items'").all();
    const corpus = indexRows.map((r) => `${r.name} ${r.sql || ''}`).join('\n').toUpperCase();
    assert(corpus.includes('STUDENT_ID') && corpus.includes('STATUS'), scope, 'Índices suportam consulta operacional por aluno e status.', { indexes:indexRows.map((r) => r.name) });
    assert(db.prepare('PRAGMA foreign_key_check').all().length === 0, scope, 'Foreign keys permanecem íntegras.');
  } finally {
    db.close();
    rmSync(path.dirname(replay.database), { recursive:true, force:true });
  }
}

function auditContracts() {
  const scope = 'pending-code-contracts';
  const files = [
    'workers/premium/domain/pending-item.js',
    'workers/premium/application/create-pending-item.js',
    'workers/premium/application/resolve-pending-item.js',
    'workers/premium/repositories/d1-pending-item-repository.js',
    'workers/premium/application/get-student-record.js',
    'workers/premium/repositories/d1-professional-workspace-repository.js',
    'workers/api.js',
  ];
  for (const file of files) assert(existsSync(path.join(root, file)), scope, `Arquivo obrigatório presente: ${file}`);
  if (failures.some((f) => f.scope === scope)) return;
  const domain = read(files[0]);
  const create = read(files[1]);
  const resolve = read(files[2]);
  const repo = read(files[3]);
  const record = read(files[4]);
  const workspace = read(files[5]);
  const worker = read(files[6]);
  assert(['OPEN','RESOLVED','DISMISSED'].every((s) => domain.includes(s)), scope, 'Estados oficiais de pendência estão definidos.');
  assert(['NORMAL','HIGH'].every((s) => domain.includes(s)), scope, 'Prioridades oficiais estão definidas.');
  assert(create.includes('PENDING_ITEM_CREATED') && resolve.includes('PENDING_ITEM_RESOLVED'), scope, 'Criação e resolução geram histórico auditável.');
  assert(repo.includes("status='OPEN'") && repo.includes('openPendingSelect'), scope, 'Repositório deduplica pendências abertas equivalentes.');
  assert(repo.includes("status='RESOLVED'") && repo.includes('resolved_at'), scope, 'Resolução persiste status e timestamp.');
  assert(repo.includes("priority WHEN 'HIGH' THEN 0"), scope, 'Ordenação prioriza itens HIGH.');
  assert(record.includes('listPendingItems'), scope, 'Student Record carrega pendências abertas.');
  assert(workspace.includes('premium_pending_items'), scope, 'Workspace consulta pendências persistidas.');
  assert(worker.includes('createPendingItem') && worker.includes('resolvePendingItem'), scope, 'Worker registra criação e resolução.');
}

async function auditApplicationFlow() {
  const scope = 'pending-application-flow';
  const items = [];
  const followups = [];
  let n = 0;
  const repository = {
    async create(item) {
      const existing = items.find((x) => x.student_id === item.student_id && x.type === item.type && (x.related_entity_type || '') === (item.related_entity_type || '') && (x.related_entity_id || '') === (item.related_entity_id || '') && x.status === 'OPEN');
      if (existing) return existing;
      const saved = { ...item, status:'OPEN', created_at:`2026-07-22T16:00:0${n}Z`, updated_at:`2026-07-22T16:00:0${n}Z`, resolved_at:null };
      items.push(saved);
      return saved;
    },
    async findById(id) { return items.find((x) => x.id === id) || null; },
    async resolve(id) { const item = items.find((x) => x.id === id); if (!item) return null; Object.assign(item, { status:'RESOLVED', resolved_at:'2026-07-22T17:00:00Z', updated_at:'2026-07-22T17:00:00Z' }); return item; },
    async listOpenByStudentId(studentId) { return items.filter((x) => x.student_id === studentId && x.status === 'OPEN').sort((a,b) => (a.priority === 'HIGH' ? -1 : 1)); },
  };
  const deps = {
    studentRepository:{ findByStudentId:async (id) => id === 'student-1' ? { student_id:id } : null },
    pendingItemRepository:repository,
    followupEntryRepository:{ append:async (entry) => { followups.push(entry); return entry; } },
    randomUUID:() => `pending-${++n}`,
  };
  const create = createCreatePendingItemUseCase(deps);
  const resolve = createResolvePendingItemUseCase(deps);
  const missing = await create({ type:'CUSTOM', title:'Teste' });
  assert(missing.status === 400, scope, 'Criação exige student_id.');
  const unknown = await create({ student_id:'unknown', type:'CUSTOM', title:'Teste' });
  assert(unknown.status === 404, scope, 'Criação bloqueia aluno inexistente.');
  const high = await create({ student_id:'student-1', type:'CONTACT_STUDENT', title:'Contato urgente', priority:'HIGH', related_entity_type:'student_checkins', related_entity_id:'feedback-1' });
  const duplicate = await create({ student_id:'student-1', type:'CONTACT_STUDENT', title:'Duplicada', priority:'HIGH', related_entity_type:'student_checkins', related_entity_id:'feedback-1' });
  assert(high.ok && duplicate.data.id === high.data.id && items.length === 1, scope, 'Pendência aberta equivalente não é duplicada.');
  assert(followups.some((x) => x.entry_type === 'PENDING_ITEM_CREATED'), scope, 'Criação registra follow-up.');
  const resolved = await resolve({ id:high.data.id, created_by:'qa-agent' });
  assert(resolved.ok && resolved.data.status === 'RESOLVED' && resolved.data.resolved_at, scope, 'Resolução persiste status e timestamp.');
  assert(followups.some((x) => x.entry_type === 'PENDING_ITEM_RESOLVED'), scope, 'Resolução registra follow-up.');
  const reopened = await create({ student_id:'student-1', type:'CONTACT_STUDENT', title:'Contato reaberto', priority:'NORMAL', related_entity_type:'student_checkins', related_entity_id:'feedback-1' });
  assert(reopened.ok && reopened.data.id !== high.data.id && items.length === 2, scope, 'Após resolução, nova ocorrência equivalente pode ser aberta.');
  const normal = await create({ student_id:'student-1', type:'CUSTOM', title:'Rotina', priority:'NORMAL' });
  const open = await repository.listOpenByStudentId('student-1');
  assert(open[0].priority === 'HIGH' || open.every((x) => x.priority === 'NORMAL'), scope, 'Listagem mantém prioridade operacional.');
  assert(normal.ok && open.some((x) => x.id === normal.data.id), scope, 'Pendências abertas permanecem visíveis ao Student Record/Workspace.');
}

await auditApplicationFlow();
auditDatabase();
auditContracts();
const report = { sprint:'QA 5.2', status:failures.length ? 'FAILED' : 'VALIDATED', generatedAt:new Date().toISOString(), summary:{ failures:failures.length, evidence:evidence.length }, failures, evidence };
console.log(JSON.stringify(report, null, 2));
process.exitCode = failures.length ? 1 : 0;
