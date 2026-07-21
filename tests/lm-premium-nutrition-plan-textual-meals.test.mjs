import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { serializeCanonicalNutritionPlan, toCanonicalNutritionPlan, validateNutritionPlanDraftStructure, validateNutritionPlanStructure } from '../workers/premium/domain/nutrition-plan-schema.js';

test('textual meals preserve multiline primary content and substitutions in canonical serialization', () => {
  const input={title:'Plano',meals:[{name:'Almoço',time:'12:00',primary_text:'100 g de arroz\n150 g de frango',substitutions:[{text:'150 g de batata\n150 g de carne moída'},{text:'120 g de macarrão\n150 g de frango'}]}]};
  assert.equal(validateNutritionPlanDraftStructure(input).ok,true);
  assert.equal(validateNutritionPlanStructure(input).ok,true);
  const saved=JSON.parse(serializeCanonicalNutritionPlan(input).meals_json);
  assert.equal(saved[0].primary_text,input.meals[0].primary_text);
  assert.equal(saved[0].substitutions[1].text,input.meals[0].substitutions[1].text);
});

test('an incomplete textual meal remains a valid draft but is blocked from publication', () => {
  const input={title:'Plano',meals:[{name:'Almoço',primary_text:'   ',substitutions:[]}]};
  assert.equal(validateNutritionPlanDraftStructure(input).ok,true);
  assert.equal(validateNutritionPlanStructure(input).ok,false);
  assert.ok(validateNutritionPlanStructure(input).errors.includes('MEAL_1_PRIMARY_TEXT_REQUIRED'));
});

test('legacy structured items survive normalization beside new textual fields', () => {
  const legacy={meals:[{id:'meal-1',name:'Almoço',items:[{id:'item-1',food:'Arroz',quantity:'100',unit:'g',substitutions:[{food:'Batata'}]}],substitutions:[{id:'old-sub',food:'Sem texto'}]}]};
  const meal=toCanonicalNutritionPlan(legacy).meals[0];
  assert.equal(meal.items[0].id,'item-1');
  assert.equal(meal.items[0].substitutions[0].food,'Batata');
  assert.equal(meal.primary_text,null);
  assert.equal(validateNutritionPlanStructure(legacy).ok,true);
});

test('workspace uses textareas, confirms nonempty substitution deletion, and portal renders text safely', () => {
  const editor=fs.readFileSync('public/admin-premium-nutrition-plan.js','utf8');
  const portal=fs.readFileSync('public/portal-premium-nutrition-plan.js','utf8');
  assert.match(editor,/Refeição principal/); assert.match(editor,/Descreva os alimentos e as quantidades desta refeição/); assert.match(editor,/\+ Adicionar substituição/); assert.doesNotMatch(editor,/\+ Adicionar alimento/); assert.match(editor,/confirm\('Excluir esta substituição\?'/);
  assert.match(portal,/meal\.primary_text/); assert.match(portal,/meal-substitutions/); assert.match(fs.readFileSync('public/portal-premium-nutrition-plan.css','utf8'),/white-space:pre-wrap/);
});
