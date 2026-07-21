import test from 'node:test'; import assert from 'node:assert/strict';
import { presentPublicNutritionPlan } from '../workers/premium/presenters/nutrition-plan-public-presenter.js';
import { createD1NutritionPlanRepository } from '../workers/premium/repositories/d1-nutrition-plan-repository.js';

test('public presenter exposes the complete published plan contract without administrative fields',()=>{
  assert.equal(presentPublicNutritionPlan({ status:'DRAFT', is_active:1 }), null);
  assert.equal(presentPublicNutritionPlan({ status:'PUBLISHED', is_active:0 }), null);
  const p=presentPublicNutritionPlan({
    status:'PUBLISHED', is_active:1, student_id:'s', id:'id', published_by:'admin', source_feedback_id:'feedback', title:'T', goal:'Definição', strategy:'Déficit leve',
    meals_json:JSON.stringify([{ name:'Café', time:'07:00', primary_text:'2 ovos e fruta', guidance:'Prepare sem fritura', items:[{ food:'Ovos', quantity:'2' }], substitutions:[{ text:'Iogurte natural' }] }]),
    substitutions_json:JSON.stringify([{ text:'Arroz por batata' }]), adherence_rules_json:JSON.stringify(['Planeje a semana']), notes:'Evite álcool', hydration:'2,5 L/dia', supplements_json:JSON.stringify([{ name:'Creatina', dosage:'3 g' }]),
  });
  assert.deepEqual(p.meals,[{ name:'Café', time:'07:00', primary_text:'2 ovos e fruta', guidance:'Prepare sem fritura', items:[{ food:'Ovos', quantity:'2' }], substitutions:[{ text:'Iogurte natural' }] }]);
  assert.deepEqual(p.substitutions,[{ text:'Arroz por batata' }]);
  assert.equal(p.observations,'Evite álcool'); assert.equal(p.hydration,'2,5 L/dia'); assert.deepEqual(p.supplements,[{ name:'Creatina', dosage:'3 g' }]); assert.deepEqual(p.adherence_rules,['Planeje a semana']);
  for (const field of ['student_id','id','published_by','source_feedback_id']) assert.equal(field in p,false);
});

test('public presenter preserves legacy meal items when primary text is unavailable',()=>{
  const p=presentPublicNutritionPlan({ status:'PUBLISHED', is_active:1, meals:[{ title:'Almoço', items:[{ food:'Frango', quantity:'120', unit:'g' }] }] });
  assert.deepEqual(p.meals,[{ name:'Almoço', time:null, primary_text:null, guidance:null, items:[{ food:'Frango', quantity:'120', unit:'g' }], substitutions:[] }]);
});

function effectDb({ failPlanChange = false, failPending = false } = {}) {
  const state = { planChange:false, pendingOpen:true, failPlanChange, failPending, calls:[] };
  return { state, prepare(sql) { const call={sql,binds:[]}; state.calls.push(call); return { bind(...v){ call.binds=v; return this; }, async first(){ if (/SELECT \* FROM nutrition_plans WHERE id/.test(sql)) return { id: call.binds[0], student_id:'s1', status:'PUBLISHED', is_active:1, version_number:2, source_feedback_id:'fb1', supersedes_plan_id:null, meals_json:'[]' }; if (/premium_followup_entries/.test(sql)) return state.planChange ? { id:'plan-change:p1' } : null; if (/COUNT\(1\) AS count/.test(sql)) return { count: state.pendingOpen ? 1 : 0 }; return null; }, async all(){ return { results:[] }; }, async run(){ if (/INSERT OR IGNORE INTO premium_followup_entries/.test(sql)) { if (state.failPlanChange) throw new Error('PLAN_CHANGE_WRITE_FAILED'); state.planChange=true; } if (/UPDATE premium_pending_items/.test(sql)) { if (state.failPending) throw new Error('PENDING_RESOLVE_FAILED'); state.pendingOpen=false; } return { meta:{ changes:1 } }; } }; }, async batch(statements){ for (const statement of statements) await statement.run(); } };
}

test('published retry does not return success while PLAN_CHANGE effect is missing and cannot be written', async()=>{ const db=effectDb({ failPlanChange:true }); await assert.rejects(()=>createD1NutritionPlanRepository(db).publish('p1',{published_by:'admin'}),/PLAN_CHANGE_WRITE_FAILED/); assert.equal(db.state.planChange,false); });

test('published retry does not return success while pending resolution effect is missing and cannot be written', async()=>{ const db=effectDb({ failPending:true }); await assert.rejects(()=>createD1NutritionPlanRepository(db).publish('p1',{published_by:'admin'}),/PENDING_RESOLVE_FAILED/); assert.equal(db.state.pendingOpen,true); });

test('published retry repairs missing PLAN_CHANGE and open pending item before returning success', async()=>{ const db=effectDb(); const result=await createD1NutritionPlanRepository(db).publish('p1',{published_by:'admin'}); assert.equal(result.status,'PUBLISHED'); assert.equal(db.state.planChange,true); assert.equal(db.state.pendingOpen,false); assert.equal(db.state.calls.filter(c=>/INSERT OR IGNORE INTO premium_followup_entries/.test(c.sql)).length,1); });
