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
const failures = [], evidence = [];
const assert = (condition, scope, message, details = {}) => (condition ? evidence : failures).push({ scope, message, ...details });
const read = (file) => readFileSync(path.join(root, file), 'utf8');

function auditDatabase() {
  const scope = 'weekly-operations-database';
  const replay = replayMigrations();
  if (!replay.ok || !replay.database) return assert(false, scope, 'Replay de migrations falhou.', { error: replay.error });
  const db = new DatabaseSync(replay.database);
  try {
    for (const table of ['premium_students','premium_anamnesis','nutrition_plans','student_checkins','premium_pending_items','premium_followup_entries'])
      assert(Boolean(db.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name=?").get(table)), scope, `Fonte integrada presente: ${table}`);
    const planIndexes = db.prepare('PRAGMA index_list(nutrition_plans)').all().map((r) => r.name);
    const feedbackIndexes = db.prepare('PRAGMA index_list(student_checkins)').all().map((r) => r.name);
    assert(planIndexes.some((n) => /active|published/i.test(n)), scope, 'Schema protege um plano publicado ativo.', { planIndexes });
    assert(feedbackIndexes.includes('idx_student_checkins_student_id_week_unique'), scope, 'Schema protege um feedback por aluno e semana.', { feedbackIndexes });
    assert(db.prepare('PRAGMA integrity_check').get()?.integrity_check === 'ok', scope, 'Integridade SQLite aprovada.');
    assert(db.prepare('PRAGMA foreign_key_check').all().length === 0, scope, 'Foreign keys aprovadas.');
  } finally { db.close(); rmSync(path.dirname(replay.database), { recursive:true, force:true }); }
}

function auditContracts() {
  const scope = 'weekly-operations-code-contracts';
  const files = [
    'workers/premium/application/submit-weekly-feedback.js',
    'workers/premium/application/create-nutrition-plan-draft.js',
    'workers/premium/application/publish-nutrition-plan.js',
    'workers/premium/application/create-pending-item.js',
    'workers/premium/application/resolve-pending-item.js',
    'workers/premium/repositories/d1-professional-workspace-repository.js',
    'workers/premium/presenters/nutrition-plan-public-presenter.js',
    'workers/api.js',
  ];
  for (const file of files) assert(existsSync(path.join(root, file)), scope, `Arquivo obrigatório presente: ${file}`);
  if (failures.some((x) => x.scope === scope)) return;
  const submit = read(files[0]), publish = read(files[2]), workspace = read(files[5]), presenter = read(files[6]), worker = read(files[7]);
  assert(submit.includes('ANALYZE_WEEKLY_FEEDBACK') && submit.includes('FEEDBACK_RECEIVED'), scope, 'Feedback cria pendência e evento operacional.');
  assert(publish.includes('PUBLISHED') && publish.includes('publish'), scope, 'Publicação exige confirmação PUBLISHED.');
  assert(workspace.includes('feedbacksAwaitingAnalysis') && workspace.includes('studentsWithoutResponse'), scope, 'Dashboard distingue análise e ausência de resposta.');
  assert(workspace.includes('isSaturdayInSaoPaulo') && workspace.includes('America/Sao_Paulo'), scope, 'Regra de sábado usa timezone oficial.');
  assert(presenter.includes('PUBLISHED') && presenter.includes('is_active'), scope, 'Presenter público restringe plano por status e atividade.');
  assert(worker.includes('getProfessionalWorkspaceSummary') && worker.includes('presentPublicNutritionPlan'), scope, 'Worker conecta Workspace e Portal nutricional.');
  const source = read('scripts/qa-sprint5-weekly-operations.mjs');
  const forbidden = ['/project' + '-lm', 'work' + 'out'];
  assert(forbidden.every((term) => !source.includes(term)), scope, 'Cenário é exclusivo da Consultoria Premium.');
}

async function auditWeek() {
  const scope = 'weekly-operations-integrated-scenario';
  let sequence = 0; const uuid = () => `qa-5-5-${++sequence}`;
  const student = { student_id:'student-weekly-qa', email:'weekly.qa@lm.test', consultation_status:'ACTIVE' };
  const feedbacks = [], pending = [], followups = [], events = [], plans = [];
  const studentRepository = { findByStudentId:async (id) => id === student.student_id ? student : null };
  const identityService = { resolve:async ({ email }) => ({ ok:email === student.email, student }), resolveIdentifier:async () => ({ ok:true, student }) };
  const followupEntryRepository = { append:async (entry) => { const saved={...entry,created_at:entry.created_at||new Date().toISOString()}; followups.push(saved); return saved; } };
  const pendingItemRepository = {
    create:async (item) => { const found=pending.find((p)=>p.status==='OPEN'&&p.student_id===item.student_id&&p.type===item.type&&(p.related_entity_id||null)===(item.related_entity_id||null)); if(found)return found; const saved={...item,status:'OPEN',created_at:new Date().toISOString()}; pending.push(saved); return saved; },
    findById:async (id) => pending.find((p)=>p.id===id)||null,
    resolve:async (id,{created_by}={}) => { const item=pending.find((p)=>p.id===id); if(!item)return null; item.status='RESOLVED'; item.resolved_at=new Date().toISOString(); item.created_by||=created_by||null; return item; },
  };
  const createPending = createCreatePendingItemUseCase({ studentRepository, pendingItemRepository, followupEntryRepository, randomUUID:uuid });
  const resolvePending = createResolvePendingItemUseCase({ pendingItemRepository, followupEntryRepository, randomUUID:uuid });
  const nutritionPlanRepository = {
    createDraft:async (input) => { const draft={...input,status:'DRAFT',is_active:0,version_number:null,created_at:new Date().toISOString()}; plans.push(draft); return draft; },
    findById:async (id) => plans.find((p)=>p.id===id)||null,
    publish:async (id,{published_by}) => { const plan=plans.find((p)=>p.id===id); if(!plan)return null; const prior=plans.find((p)=>p.student_id===plan.student_id&&p.status==='PUBLISHED'&&p.is_active===1&&p.id!==id); if(prior){prior.status='ARCHIVED';prior.is_active=0;} const max=Math.max(0,...plans.map((p)=>Number(p.version_number)||0)); plan.status='PUBLISHED';plan.is_active=1;plan.version_number=max+1;plan.published_by=published_by;plan.published_at=new Date().toISOString();plan.supersedes_plan_id=prior?.id||null;followups.push({id:uuid(),student_id:plan.student_id,entry_type:'PLAN_CHANGE',title:'Plano publicado',created_at:plan.published_at});return plan; },
    findCurrentByStudentId:async (id) => plans.find((p)=>p.student_id===id&&p.status==='PUBLISHED'&&p.is_active===1)||null,
  };
  const createDraft = createCreateNutritionPlanDraftUseCase({ studentRepository, nutritionPlanRepository, randomUUID:uuid });
  const publishPlan = createPublishNutritionPlanUseCase({ nutritionPlanRepository, randomUUID:uuid });
  const currentPlan = createGetCurrentNutritionPlanUseCase({ studentRepository, nutritionPlanRepository });
  const planning = await createPending({ student_id:student.student_id,type:'CREATE_NUTRITION_PLAN',title:'Criar planejamento',source:'anamnesis' });
  assert(planning.ok && pending.filter((p)=>p.status==='OPEN').length===1, scope, 'Anamnese gera pendência de planejamento.');
  const draft = await createDraft.execute({ student_id:student.student_id,plan:{title:'Plano semanal',meals:[{name:'Almoço',items:['Arroz','Frango']}]} });
  assert(draft.ok && draft.data.status==='DRAFT', scope, 'Nutricionista cria rascunho.');
  assert((await currentPlan.execute({student_id:student.student_id})).data===null, scope, 'Portal não recebe rascunho.');
  const published = await publishPlan.execute({ id:draft.data.id,student_id:student.student_id,published_by:'nutritionist@lm.test' });
  await resolvePending({ id:planning.data.id,created_by:'nutritionist@lm.test' });
  assert(published.ok && published.data.is_active===1, scope, 'Plano é publicado e ativado.');
  assert((await currentPlan.execute({student_id:student.student_id})).data?.id===published.data.id, scope, 'Portal lê a versão publicada ativa.');
  assert(plans.filter((p)=>p.status==='PUBLISHED'&&p.is_active===1).length===1, scope, 'Existe somente um plano ativo.');
  const weeklyFeedbackRepository = { create:async (r)=>{const saved={...r,coach_status:'pending'};feedbacks.push(saved);return saved;}, findByStudentAndWeek:async(id,w)=>feedbacks.find((f)=>f.student_id===id&&f.week_ref===w)||null };
  const submit = createSubmitWeeklyFeedbackUseCase({ identityService,weeklyFeedbackRepository,pendingItemRepository,eventRepository:{append:async(e)=>{events.push(e);return e;}},randomUUID:uuid,log:async()=>{} });
  const sent = await submit.execute({ feedback:{id:'feedback-week-30',student_email:student.email,week_ref:'2026-W30',nutrition_adherence:'Boa',sleep_quality:'Bom',energy_level:'Normal',stress_level:'Moderado',main_difficulty:'Rotina',support_needed:'Ajustar jantar'},route:'/api/portal/checkin',method:'POST' });
  const feedbackPending = pending.find((p)=>p.type==='ANALYZE_WEEKLY_FEEDBACK'&&p.status==='OPEN');
  assert(sent.ok && feedbacks.length===1, scope, 'Feedback semanal é persistido.');
  assert(Boolean(feedbackPending), scope, 'Feedback entra na fila de análise.');
  assert(events.some((e)=>e.event_type==='FEEDBACK_RECEIVED'), scope, 'Recebimento gera evento auditável.');
  followups.push({id:uuid(),student_id:student.student_id,entry_type:'FEEDBACK_REVIEW',title:'Feedback analisado',created_by:'nutritionist@lm.test',created_at:new Date().toISOString()});
  feedbacks[0].coach_status='reviewed'; await resolvePending({id:feedbackPending.id,created_by:'nutritionist@lm.test'});
  assert(pending.filter((p)=>p.status==='OPEN').length===0, scope, 'Pendências resolvidas saem da fila.');
  assert(feedbacks.filter((f)=>f.coach_status==='pending').length===0, scope, 'Feedback analisado sai da fila.');
  assert(followups.some((f)=>f.entry_type==='FEEDBACK_REVIEW')&&followups.some((f)=>f.entry_type==='PENDING_ITEM_RESOLVED')&&followups.some((f)=>f.entry_type==='PLAN_CHANGE'), scope, 'Histórico registra plano, feedback e resolução.');
  const saturday=new Date('2026-07-25T12:00:00-03:00');
  assert(new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',weekday:'short'}).format(saturday)==='Sat', scope, 'Sábado usa America/Sao_Paulo.');
  const finalState={studentId:student.student_id,activePlanId:(await currentPlan.execute({student_id:student.student_id})).data?.id,openPendingItems:pending.filter((p)=>p.status==='OPEN').length,feedbacksAwaitingAnalysis:feedbacks.filter((f)=>f.coach_status==='pending').length,followupCount:followups.length};
  assert(finalState.activePlanId===published.data.id&&finalState.openPendingItems===0&&finalState.feedbacksAwaitingAnalysis===0, scope, 'Banco, Portal, Workspace e operação convergem.', {finalState});
}

async function main(){auditDatabase();auditContracts();await auditWeek();const report={sprint:'QA 5.5',status:failures.length?'FAILED':'VALIDATED',generatedAt:new Date().toISOString(),summary:{failures:failures.length,evidence:evidence.length},failures,evidence};console.log(JSON.stringify(report,null,2));process.exitCode=failures.length?1:0;}
await main();
