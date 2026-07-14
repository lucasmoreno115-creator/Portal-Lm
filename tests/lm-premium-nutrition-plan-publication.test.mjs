import test from 'node:test'; import assert from 'node:assert/strict';
import { presentPublicNutritionPlan } from '../workers/premium/presenters/nutrition-plan-public-presenter.js';
test('public presenter exposes only published student fields',()=>{ assert.equal(presentPublicNutritionPlan({status:'DRAFT'}), null); const p=presentPublicNutritionPlan({status:'PUBLISHED',student_id:'s',id:'id',title:'T',meals_json:'[]',is_active:1}); assert.equal(p.title,'T'); assert.equal('student_id' in p,false); assert.equal('id' in p,false); });
