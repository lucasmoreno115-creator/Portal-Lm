import test from 'node:test'; import assert from 'node:assert/strict';
import { createD1NutritionPlanRepository } from '../workers/premium/repositories/d1-nutrition-plan-repository.js';
function d1() {
  const calls=[]; const state={published:false, inserted:false};
  return { calls, prepare(sql){ const call={sql,binds:[]}; calls.push(call); return {
    bind(...v){ call.binds=v; return this; },
    async first(){
      if (/SELECT \* FROM nutrition_plans WHERE id/.test(sql)) return { id: call.binds[0], student_id:'s1', student_email:'a@x.com', status: state.published ? 'PUBLISHED' : 'DRAFT', is_active: state.published ? 1 : 0, updated_at:'rev1', version_number: state.published ? 2 : null, published_by: state.published ? 'admin' : null, supersedes_plan_id:null, source_feedback_id:null, title:'Plano', meals_json:JSON.stringify([{name:'Café',items:[{food:'Ovos',quantity:'2'}]}]) };
      if (/status = 'DRAFT'/.test(sql) && /ORDER BY datetime/.test(sql)) return state.inserted ? { id:'d1', student_id:'s1', student_email:'a@x.com', status:'DRAFT', is_active:0, updated_at:'rev1', version_number: state.published ? 2 : null, published_by: state.published ? 'admin' : null, supersedes_plan_id:null, source_feedback_id:null, title:'Plano', meals_json:'[]' } : null;
      if (/MAX\(version_number\)/.test(sql)) return { next_version: 2 };
      if (/premium_followup_entries/.test(sql)) return { id:'plan-change:d1' };
      if (/COUNT\(1\) AS count/.test(sql)) return { count:0 };
      return null;
    },
    async all(){return {results:[]};},
    async run(){ if (/INSERT OR IGNORE INTO nutrition_plans/.test(sql)) state.inserted=true; if (/EXISTS \(SELECT 1 FROM nutrition_plans/.test(sql)) state.published=true; return {meta:{changes:1}}; }
  }; } };
}
test('repository exposes Build 5 lifecycle methods',()=>{ const repo=createD1NutritionPlanRepository(d1()); for (const m of ['findById','findCurrentByStudentId','findDraftByStudentId','listByStudentId','createDraft','updateDraft','publish','archive','findPreviousPublished','findBySourceFeedback']) assert.equal(typeof repo[m],'function'); });
test('createDraft uses INSERT OR IGNORE and relies on unique open draft index',async()=>{ const db=d1(); await createD1NutritionPlanRepository(db).createDraft({id:'d1',student_id:'s1',student_email:'a@x.com',title:'Plano',meals:[]}); assert.ok(db.calls.some(c=>/INSERT OR IGNORE INTO nutrition_plans/.test(c.sql))); });
test('updateDraft requires optimistic locking revision and protects published plans',async()=>{ const db=d1(); await assert.rejects(()=>createD1NutritionPlanRepository(db).updateDraft('d1',{title:'Novo'}),/REVISION_REQUIRED/); await createD1NutritionPlanRepository(db).updateDraft('d1',{title:'Novo',meals:[{name:'Café',items:[{food:'Ovos',quantity:'2'}]}],expected_updated_at:'rev1'}); const update=db.calls.find(c=>/UPDATE nutrition_plans SET title=/.test(c.sql)); assert.match(update.sql,/AND updated_at=\?/); assert.equal(update.binds.at(-1),'rev1'); });
test('publish validates draft with CAS before side effects',async()=>{ const db=d1(); await createD1NutritionPlanRepository(db).publish('d1',{published_by:'admin',now:'now'}); const publishCall=db.calls.find(c=>/EXISTS \(SELECT 1 FROM nutrition_plans/.test(c.sql)); assert.match(publishCall.sql,/id = \? AND student_id = \? AND status = 'DRAFT'/); const planChangeIndex=db.calls.findIndex(c=>/PLAN_CHANGE/.test(c.sql)); const publishIndex=db.calls.findIndex(c=>/EXISTS \(SELECT 1 FROM nutrition_plans/.test(c.sql)); assert.ok(publishIndex > -1 && planChangeIndex > publishIndex); });
