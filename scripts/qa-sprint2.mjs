#!/usr/bin/env node
import { existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { replayMigrations } from './db-tool.mjs';
import { createCreateNutritionPlanDraftUseCase } from '../workers/premium/application/create-nutrition-plan-draft.js';
import { createGetNutritionPlanDraftUseCase } from '../workers/premium/application/get-nutrition-plan-draft.js';
import { createUpdateNutritionPlanDraftUseCase } from '../workers/premium/application/update-nutrition-plan-draft.js';
import { createPublishNutritionPlanUseCase } from '../workers/premium/application/publish-nutrition-plan.js';
import { createGetCurrentNutritionPlanUseCase } from '../workers/premium/application/get-current-nutrition-plan.js';
import { createGetNutritionPlanHistoryUseCase } from '../workers/premium/application/get-nutrition-plan-history.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const evidence = [];
const fail = (scope, message, details = {}) => failures.push({ scope, message, ...details });
const pass = (scope, message, details = {}) => evidence.push({ scope, message, ...details });
const read = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8');
const assert = (condition, scope, message, details = {}) => condition ? pass(scope, message, details) : fail(scope, message, details);

function auditDatabaseContract() {
  const scope = 'nutrition-database';
  const replay = replayMigrations();
  if (!replay.ok || !replay.database) {
    fail(scope, 'Replay de migrations falhou; contrato nutricional não pôde ser auditado.', { error: replay.error, applied: replay.applied });
    return;
  }
  const db = new DatabaseSync(replay.database);
  try {
    const table = db.prepare("SELECT sql FROM sqlite_schema WHERE type='table' AND name='nutrition_plans'").get();
    assert(Boolean(table?.sql), scope, 'Tabela nutrition_plans existe.');
    if (!table?.sql) return;

    const columns = db.prepare('PRAGMA table_info(nutrition_plans)').all().map((row) => row.name);
    const requiredColumns = ['id','student_id','student_email','title','meals_json','substitutions_json','adherence_rules_json','status','version_number','published_at','published_by','archived_at','supersedes_plan_id','is_active','created_at','updated_at'];
    const missingColumns = requiredColumns.filter((column) => !columns.includes(column));
    assert(missingColumns.length === 0, scope, 'Colunas do lifecycle nutricional estão presentes.', { missingColumns });

    const indexes = db.prepare('PRAGMA index_list(nutrition_plans)').all();
    const indexSqlRows = db.prepare("SELECT name, sql FROM sqlite_schema WHERE type='index' AND tbl_name='nutrition_plans' AND sql IS NOT NULL").all();
    assert(indexes.length > 0, scope, 'nutrition_plans possui índices registrados.', { indexes: indexes.map((row) => row.name) });

    const protectionCorpus = [table.sql, ...indexSqlRows.map((row) => row.sql)].join('\n').toUpperCase();
    for (const status of ['DRAFT', 'PUBLISHED', 'ARCHIVED']) {
      assert(protectionCorpus.includes(status), scope, `Status ${status} está representado nas proteções de tabela ou índices.`);
    }
    assert(indexes.some((row) => row.name === 'idx_nutrition_plans_single_open_draft_student'), scope, 'Existe proteção contra múltiplos rascunhos abertos por aluno.');
    assert(indexes.some((row) => row.name === 'idx_nutrition_plans_single_published_student'), scope, 'Existe proteção contra múltiplos planos publicados ativos por aluno.');
    assert(indexes.some((row) => row.name === 'idx_nutrition_plans_student_version_unique'), scope, 'Existe proteção de unicidade de versão por aluno.');

    const fkFailures = db.prepare('PRAGMA foreign_key_check').all();
    assert(fkFailures.length === 0, scope, 'Foreign keys permanecem íntegras após replay.', { fkFailures });
  } finally {
    db.close();
    rmSync(path.dirname(replay.database), { recursive: true, force: true });
  }
}

function auditProductionCodeContracts() {
  const scope = 'nutrition-code-contracts';
  const files = [
    'workers/premium/repositories/d1-nutrition-plan-repository.js',
    'workers/premium/application/create-nutrition-plan-draft.js',
    'workers/premium/application/update-nutrition-plan-draft.js',
    'workers/premium/application/publish-nutrition-plan.js',
    'workers/premium/application/get-current-nutrition-plan.js',
    'workers/premium/application/get-nutrition-plan-history.js',
    'workers/premium/presenters/nutrition-plan-public-presenter.js',
    'workers/api.js',
  ];
  for (const file of files) assert(existsSync(path.join(root, file)), scope, `Arquivo obrigatório presente: ${file}`);
  if (failures.some((item) => item.scope === scope)) return;

  const repository = read(files[0]);
  const publishUseCase = read(files[3]);
  const updateUseCase = read(files[2]);
  const presenter = read(files[6]);
  const worker = read(files[7]);
  const contracts = [
    [repository.includes("status = 'DRAFT'"), 'Repositório possui leitura explícita do rascunho.'],
    [repository.includes("status = 'PUBLISHED'") && repository.includes('is_active = 1'), 'Leitura pública exige plano publicado e ativo.'],
    [repository.includes('MAX(version_number)') && repository.includes('next_version'), 'Publicação calcula nova versão.'],
    [repository.includes("ELSE 'ARCHIVED'") && repository.includes('is_active = CASE'), 'Publicação arquiva a versão anterior e ativa a nova.'],
    [repository.includes("'PLAN_CHANGE'"), 'Publicação registra mudança no histórico operacional.'],
    [repository.includes("type='CREATE_NUTRITION_PLAN'") && repository.includes("status='RESOLVED'"), 'Publicação resolve pendências de criação do plano.'],
    [publishUseCase.includes("plan.status !== 'DRAFT'") && publishUseCase.includes('PUBLISH_NOT_CONFIRMED'), 'Use case bloqueia estado inválido e exige confirmação da publicação.'],
    [updateUseCase.includes('expected_updated_at') && updateUseCase.includes('REVISION_REQUIRED'), 'Atualização de rascunho exige controle de concorrência.'],
    [worker.includes('createGetCurrentNutritionPlanUseCase') && worker.includes('createGetNutritionPlanHistoryUseCase'), 'Worker registra leitura atual e histórico.'],
    [worker.includes('createPublishNutritionPlanUseCase') && worker.includes('createUpdateNutritionPlanDraftUseCase'), 'Worker registra atualização e publicação.'],
    [presenter.includes('meals') && presenter.includes('substitutions') && presenter.includes('adherence'), 'Presenter público preserva refeições, substituições e regras de adesão.'],
  ];
  for (const [condition, message] of contracts) assert(condition, scope, message);
}

function createMemoryRepositories() {
  const student = { student_id: 'student-qa-2', email: 'qa.student@example.com' };
  const plans = [];
  let sequence = 0;
  const now = () => `2026-07-22T14:00:${String(sequence++).padStart(2, '0')}Z`;
  const studentRepository = { async findByStudentId(id) { return id === student.student_id ? student : null; } };
  const nutritionPlanRepository = {
    async findById(id) { return plans.find((plan) => plan.id === id) ?? null; },
    async findDraftByStudentId(studentId) { return plans.filter((plan) => plan.student_id === studentId && plan.status === 'DRAFT').sort((a,b) => b.updated_at.localeCompare(a.updated_at))[0] ?? null; },
    async createDraft(plan) { const existing = await this.findDraftByStudentId(plan.student_id); if (existing) return existing; const timestamp = now(); const draft = { ...plan, status:'DRAFT', version_number:null, is_active:0, created_at:timestamp, updated_at:timestamp }; plans.push(draft); return draft; },
    async updateDraft(id, updates) { const plan = await this.findById(id); if (!plan || plan.status !== 'DRAFT') throw Object.assign(new Error('NOT_DRAFT'), { conflict:true }); if (plan.updated_at !== updates.expected_updated_at) throw Object.assign(new Error('NUTRITION_PLAN_DRAFT_CONFLICT'), { conflict:true }); Object.assign(plan, updates, { updated_at:now() }); return plan; },
    async publish(id, { published_by='admin' } = {}) { const plan = await this.findById(id); if (!plan) return null; if (plan.status === 'PUBLISHED') return plan; const previous = plans.find((item) => item.student_id === plan.student_id && item.status === 'PUBLISHED' && item.is_active === 1); if (previous) Object.assign(previous, { status:'ARCHIVED', is_active:0, archived_at:now(), updated_at:now() }); const version = Math.max(0, ...plans.filter((item) => item.student_id === plan.student_id).map((item) => Number(item.version_number || 0))) + 1; Object.assign(plan, { status:'PUBLISHED', is_active:1, version_number:version, published_at:now(), published_by, supersedes_plan_id:previous?.id ?? null, updated_at:now() }); return plan; },
    async findCurrentByStudentId(studentId) { return plans.find((plan) => plan.student_id === studentId && plan.status === 'PUBLISHED' && plan.is_active === 1) ?? null; },
    async listByStudentId(studentId, { limit=20, offset=0 } = {}) { return plans.filter((plan) => plan.student_id === studentId).sort((a,b) => Number(b.version_number || 0) - Number(a.version_number || 0)).slice(offset, offset + limit); },
  };
  return { student, plans, studentRepository, nutritionPlanRepository };
}

async function auditApplicationFlow() {
  const scope = 'nutrition-application-flow';
  const { student, plans, studentRepository, nutritionPlanRepository } = createMemoryRepositories();
  let ids = 1;
  const randomUUID = () => `nutrition-qa-${ids++}`;
  const createDraft = createCreateNutritionPlanDraftUseCase({ studentRepository, nutritionPlanRepository, randomUUID });
  const getDraft = createGetNutritionPlanDraftUseCase({ studentRepository, nutritionPlanRepository });
  const updateDraft = createUpdateNutritionPlanDraftUseCase({ nutritionPlanRepository });
  const publish = createPublishNutritionPlanUseCase({ nutritionPlanRepository, randomUUID });
  const getCurrent = createGetCurrentNutritionPlanUseCase({ studentRepository, nutritionPlanRepository });
  const getHistory = createGetNutritionPlanHistoryUseCase({ studentRepository, nutritionPlanRepository });
  const content = { title:'Plano QA 2', goal:'Validar fluxo', strategy:'Consistência', meals:[{ id:'meal-1', name:'Café da manhã', primary_text:'2 ovos e 1 fruta', items:[], substitutions:[{ id:'sub-1', text:'Troca equivalente' }] }], substitutions:[], adherenceRules:['Seguir o plano'], notes:'Diagnóstico' };

  const created = await createDraft.execute({ student_id:student.student_id, plan:content });
  assert(created.ok && created.data?.status === 'DRAFT' && Number(created.data?.is_active) === 0, scope, 'Criação gera rascunho inativo.');
  const loaded = await getDraft.execute({ student_id:student.student_id });
  assert(loaded.ok && loaded.data?.id === created.data?.id, scope, 'Leitura de rascunho retorna o mesmo plano.');
  const noRevision = await updateDraft.execute({ id:created.data.id, student_id:student.student_id, updates:{ ...content, title:'Sem revisão' } });
  assert(!noRevision.ok && noRevision.error === 'REVISION_REQUIRED', scope, 'Salvar sem revisão é bloqueado.');
  const updated = await updateDraft.execute({ id:created.data.id, student_id:student.student_id, updates:{ ...content, title:'Plano QA 2 atualizado', expected_updated_at:created.data.updated_at } });
  assert(updated.ok && updated.data?.status === 'DRAFT' && updated.data?.title === 'Plano QA 2 atualizado', scope, 'Rascunho é atualizado sem alterar o status.');
  const v1 = await publish.execute({ id:created.data.id, student_id:student.student_id, published_by:'qa-agent' });
  assert(v1.ok && v1.data?.status === 'PUBLISHED' && v1.data?.is_active === 1 && v1.data?.version_number === 1, scope, 'Primeira publicação cria versão ativa 1.');
  const current1 = await getCurrent.execute({ student_id:student.student_id });
  assert(current1.ok && current1.data?.id === v1.data?.id, scope, 'Portal recebe a versão publicada ativa.');
  const draft2 = await createDraft.execute({ student_id:student.student_id, plan:{ ...content, title:'Plano QA 2 versão 2' } });
  assert(draft2.ok && draft2.data?.status === 'DRAFT', scope, 'Novo ciclo cria rascunho após publicação.');
  const beforeV2 = await getCurrent.execute({ student_id:student.student_id });
  assert(beforeV2.data?.id === v1.data?.id, scope, 'Rascunho novo não altera o plano visível ao aluno.');
  const v2 = await publish.execute({ id:draft2.data.id, student_id:student.student_id, published_by:'qa-agent' });
  const archivedV1 = plans.find((plan) => plan.id === v1.data.id);
  assert(v2.ok && v2.data?.version_number === 2 && v2.data?.supersedes_plan_id === v1.data.id, scope, 'Segunda publicação incrementa versão e referencia a anterior.');
  assert(archivedV1?.status === 'ARCHIVED' && archivedV1?.is_active === 0, scope, 'Versão anterior é arquivada e desativada.');
  const current2 = await getCurrent.execute({ student_id:student.student_id });
  assert(current2.data?.id === v2.data.id && current2.data?.version_number === 2, scope, 'Portal passa a consumir somente a versão 2.');
  const history = await getHistory.execute({ student_id:student.student_id });
  assert(history.ok && history.data?.length === 2 && history.data[0]?.version_number === 2 && history.data[1]?.status === 'ARCHIVED', scope, 'Histórico preserva e ordena versões.');
  const foreign = await publish.execute({ id:v2.data.id, student_id:'outro-aluno', published_by:'qa-agent' });
  assert(!foreign.ok && foreign.error === 'NOT_FOUND', scope, 'Publicação por student_id divergente é bloqueada.');
}

async function main() {
  auditDatabaseContract();
  auditProductionCodeContracts();
  await auditApplicationFlow();
  const report = { sprint:'QA 2', status:failures.length ? 'FAILED' : 'VALIDATED', generatedAt:new Date().toISOString(), summary:{ failures:failures.length, evidence:evidence.length }, failures, evidence };
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = failures.length ? 1 : 0;
}

main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
