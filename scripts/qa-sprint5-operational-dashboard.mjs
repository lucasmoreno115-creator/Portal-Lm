#!/usr/bin/env node
import { existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { replayMigrations } from './db-tool.mjs';
import { createGetProfessionalWorkspaceSummaryUseCase } from '../workers/premium/application/get-professional-workspace-summary.js';
import { presentWorkspaceSummary } from '../workers/premium/presenters/professional-workspace-summary-presenter.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const evidence = [];
const pass = (scope, message, details = {}) => evidence.push({ scope, message, ...details });
const fail = (scope, message, details = {}) => failures.push({ scope, message, ...details });
const assert = (condition, scope, message, details = {}) => condition ? pass(scope, message, details) : fail(scope, message, details);
const read = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8');

function auditDatabaseContract() {
  const scope = 'dashboard-database';
  const replay = replayMigrations();
  if (!replay.ok || !replay.database) {
    fail(scope, 'Replay de migrations falhou; dashboard não pôde ser auditado.', { error: replay.error });
    return;
  }
  const db = new DatabaseSync(replay.database);
  try {
    for (const table of ['premium_students','premium_pending_items','student_checkins','premium_anamnesis','nutrition_plans','premium_followup_entries']) {
      assert(Boolean(db.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name=?").get(table)), scope, `Fonte operacional presente: ${table}`);
    }
    const pendingIndexes = db.prepare('PRAGMA index_list(premium_pending_items)').all().map((row) => row.name);
    const feedbackIndexes = db.prepare('PRAGMA index_list(student_checkins)').all().map((row) => row.name);
    assert(pendingIndexes.length > 0, scope, 'Pendências possuem índices para contagem e filtros.', { pendingIndexes });
    assert(feedbackIndexes.includes('idx_student_checkins_week_status'), scope, 'Feedbacks possuem índice por semana e status.', { feedbackIndexes });
    assert(db.prepare('PRAGMA integrity_check').get()?.integrity_check === 'ok', scope, 'Integridade SQLite aprovada.');
    assert(db.prepare('PRAGMA foreign_key_check').all().length === 0, scope, 'Foreign keys aprovadas.');
  } finally {
    db.close();
    rmSync(path.dirname(replay.database), { recursive: true, force: true });
  }
}

function auditCodeContracts() {
  const scope = 'dashboard-code-contracts';
  const files = [
    'workers/premium/repositories/d1-professional-workspace-repository.js',
    'workers/premium/application/get-professional-workspace-summary.js',
    'workers/premium/presenters/professional-workspace-summary-presenter.js',
    'workers/api.js',
  ];
  for (const file of files) assert(existsSync(path.join(root, file)), scope, `Arquivo obrigatório presente: ${file}`);
  if (failures.some((item) => item.scope === scope)) return;
  const repository = read(files[0]);
  const useCase = read(files[1]);
  const presenter = read(files[2]);
  const worker = read(files[3]);
  const contracts = [
    [repository.includes('openPendingItems') && repository.includes("pi.status='OPEN'"), 'Contador de pendências abertas usa apenas status OPEN.'],
    [repository.includes('feedbacksAwaitingAnalysis') && repository.includes('ANALYZED'), 'Contador de feedbacks distingue itens analisados.'],
    [repository.includes('studentsWithoutResponse') && repository.includes('NOT EXISTS'), 'Contador de ausência usa inexistência de resposta na semana.'],
    [repository.includes('plansPendingUpdate') && repository.includes("type='CREATE_NUTRITION_PLAN'"), 'Planos pendentes usam pendência operacional canônica.'],
    [repository.includes('anamnesesAwaitingFill') && repository.includes("AWAITING_ANAMNESIS"), 'Anamneses não preenchidas usam lifecycle canônico.'],
    [repository.includes('anamnesesAwaitingAnalysis') && repository.includes('ANALISADA'), 'Anamneses aguardando análise excluem estados analisados.'],
    [repository.includes("feedback_status === 'AWAITING_ANALYSIS'") && repository.includes("has_pending === 'true'"), 'Student List possui filtros operacionais coerentes.'],
    [repository.includes('NEXT_PENDING_ORDER') && repository.includes("priority WHEN 'HIGH'"), 'Próxima pendência respeita prioridade e antiguidade.'],
    [useCase.includes('getSummary') && useCase.includes('getOperationalDashboard'), 'Use case agrega resumo e dashboard no mesmo snapshot.'],
    [presenter.includes('indicators') && presenter.includes('checkins') && presenter.includes('anamnesis'), 'Presenter expõe cards, check-ins e anamnese.'],
    [worker.includes('getProfessionalWorkspaceSummary') && worker.includes('presentWorkspaceSummary'), 'Worker registra endpoint e presenter do dashboard.'],
  ];
  for (const [condition, message] of contracts) assert(condition, scope, message);
}

async function auditApplicationSnapshot() {
  const scope = 'dashboard-application-snapshot';
  const summary = {
    date:'2026-07-22T16:30:00.000Z', weekRef:'2026-W30', openPendingItems:4,
    feedbacksAwaitingAnalysis:2, studentsWithoutResponse:3, plansPendingUpdate:1,
    anamnesesAwaitingFill:2, anamnesesAwaitingAnalysis:1, isSaturday:false,
  };
  const dashboard = {
    anamnesis:{ awaiting:2, underReview:1, readyToRelease:1, items:[{ student_id:'s-ready', name:'Aluno Pronto', consultation_status:'READY_TO_RELEASE' }] },
    checkins:{ awaitingReview:2, withoutRecentResponse:null, items:[{ student_id:'s-feedback', name:'Aluno Feedback', weekly_feedback_status:'AWAITING_ANALYSIS' }] },
  };
  const workspaceRepository = {
    async getSummary() { return structuredClone(summary); },
    async getOperationalDashboard() { return structuredClone(dashboard); },
  };
  const useCase = createGetProfessionalWorkspaceSummaryUseCase({ workspaceRepository });
  const result = await useCase({ featureEnabled:true });
  assert(result.ok === true, scope, 'Snapshot operacional é carregado com sucesso.');
  assert(result.data.openPendingItems === 4 && result.data.feedbacksAwaitingAnalysis === 2, scope, 'Contadores agregados preservam valores do repositório.');
  assert(result.data.anamnesis.readyToRelease === 1 && result.data.checkins.awaitingReview === 2, scope, 'Cards operacionais preservam seus totais.');
  assert(result.data.featureEnabled === true, scope, 'Feature flag é refletida no snapshot.');

  const presented = presentWorkspaceSummary(result.data);
  assert(presented.indicators.openPendingItems === 4, scope, 'Presenter mantém contador de pendências.');
  assert(presented.indicators.studentsWithoutResponse === 3, scope, 'Presenter mantém contador de alunos sem resposta.');
  assert(presented.anamnesis.items[0]?.student_id === 's-ready', scope, 'Card de anamnese preserva aluno prioritário.');
  assert(presented.checkins.items[0]?.weekly_feedback_status === 'AWAITING_ANALYSIS', scope, 'Card de check-in preserva badge operacional.');
  assert(presented.checkins.withoutRecentResponse === null, scope, 'Métrica sem política definida permanece explicitamente nula.');
  assert(presented.featureFlag.enabled === true, scope, 'Presenter preserva o estado da feature flag.');
}

async function main() {
  auditDatabaseContract();
  auditCodeContracts();
  await auditApplicationSnapshot();
  const report = { sprint:'QA 5.4', status:failures.length ? 'FAILED' : 'VALIDATED', generatedAt:new Date().toISOString(), summary:{ failures:failures.length, evidence:evidence.length }, failures, evidence };
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = failures.length ? 1 : 0;
}

await main();
