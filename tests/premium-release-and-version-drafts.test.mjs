import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { canTransitionConsultationStatus } from '../workers/premium/domain/consultation-status.js';
import { createDraftFromPublishedPlanUseCase } from '../workers/premium/application/create-draft-from-published-plan.js';

test('release lifecycle requires READY_TO_RELEASE before ACTIVE',()=>{
  assert.equal(canTransitionConsultationStatus('UNDER_REVIEW','READY_TO_RELEASE'),true);
  assert.equal(canTransitionConsultationStatus('UNDER_REVIEW','ACTIVE'),false);
  assert.equal(canTransitionConsultationStatus('READY_TO_RELEASE','ACTIVE'),true);
});
test('record and workspace keep release operations on the record surface',()=>{
  const record=fs.readFileSync('public/admin-premium-student-record.js','utf8');
  const workspace=fs.readFileSync('workers/premium/presenters/professional-workspace-student-presenter.js','utf8');
  assert.match(record,/Marcar planejamento como pronto/); assert.match(record,/Liberar acesso ao aluno/);
  assert.match(workspace,/action:'open-student'/); assert.doesNotMatch(workspace,/action:'mark-ready'/); assert.doesNotMatch(workspace,/action:'release'/);
  assert.equal(fs.readFileSync('public/admin-premium-student-record.js','utf8'),fs.readFileSync('public/assets/js/admin-premium-student-record.js','utf8'));
  assert.equal(fs.readFileSync('public/admin-premium-nutrition-plan.js','utf8'),fs.readFileSync('public/assets/js/admin-premium-nutrition-plan.js','utf8'));
});
test('version draft use case accepts immutable versions and rejects draft origins',async()=>{
  const source={id:'p',student_id:'s',student_email:'x',status:'PUBLISHED',title:'v2',goal:'g',strategy:'s',meals_json:'[{"primary_text":"text","items":["legacy"],"substitutions":[{"text":"swap"}]}]',substitutions_json:'[{"text":"global"}]',adherence_rules_json:'["rule"]'};
  let created; const repo={findById:async()=>source,findDraftByStudentId:async()=>null,createDraft:async plan=>(created=plan,{...plan,status:'DRAFT'})};
  const use=createDraftFromPublishedPlanUseCase({nutritionPlanRepository:repo,randomUUID:()=> 'd'});
  assert.equal((await use.execute({id:'p',student_id:'s'})).ok,true); assert.equal(created.meals[0].items[0],'legacy'); assert.equal(created.meals[0].substitutions[0].text,'swap');
  source.status='ARCHIVED'; assert.equal((await use.execute({id:'p',student_id:'s'})).ok,true);
  source.status='DRAFT'; assert.equal((await use.execute({id:'p',student_id:'s'})).error,'SOURCE_PLAN_NOT_VERSIONED');
});
test('existing draft reports structured conflict and repository requires atomic batch',async()=>{
  const source={id:'p',student_id:'s',status:'PUBLISHED',meals_json:'[]',substitutions_json:'[]',adherence_rules_json:'[]'};
  const existing={id:'old',title:'Draft',updated_at:'now'}; const repo={findById:async()=>source,findDraftByStudentId:async()=>existing};
  const use=createDraftFromPublishedPlanUseCase({nutritionPlanRepository:repo,randomUUID:()=> 'd'});
  const result=await use.execute({id:'p',student_id:'s'}); assert.equal(result.error,'DRAFT_ALREADY_EXISTS'); assert.deepEqual(result.data,{id:'old',updated_at:'now',title:'Draft'});
  const repository=fs.readFileSync('workers/premium/repositories/d1-nutrition-plan-repository.js','utf8');
  assert.match(repository,/NUTRITION_PLAN_DRAFT_REPLACE_ATOMICITY_REQUIRED/); assert.match(repository,/await db\.batch\(\[remove, insert\]\)/); assert.doesNotMatch(repository,/archive\(existing\.id\)/);
});
test('editor preserves conflict metadata, filters invalid history and uses readable modal',()=>{
 const src=fs.readFileSync('public/admin-premium-nutrition-plan.js','utf8');
 assert.match(src,/error\.code=data\.error/);assert.match(src,/error\.data=data\.data\|\|null/);assert.match(src,/error\.status=res\.status/);assert.match(src,/version_number!=null&&x\.published_at/);assert.doesNotMatch(src,/alert\(JSON\.stringify/);
});
