import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateCanonicalEditId, validatePortalVersion, validateVersioningCalls, validateVersionWorkflow } from '../scripts/qa-premium-nutrition-versioning-staging-e2e.mjs';

const response=(data,status=200)=>({ok:status>=200&&status<300,status,responseBody:JSON.stringify({ok:status<400,data})});
const v1={id:'v1',student_id:'student-1',status:'ARCHIVED',version_number:1,published_at:'2026-08-11',meals:[{primary_text:'QA-F1.8.1-V1-run-1'}]};
const v2={id:'v2',student_id:'student-1',status:'PUBLISHED',version_number:2,supersedes_plan_id:'v1',meals:[{primary_text:'QA-F1.8.1-V2-run-1'}]};

test('regression #406 accepts only a canonical string planId and blocks event-like invalid identifiers',()=>{
  assert.deepEqual(validateCanonicalEditId('published-42'),{ok:true,id:'published-42'});
  for(const value of [undefined,null,'undefined','null','[object MouseEvent]','[object Object]',{}])assert.equal(validateCanonicalEditId(value).ok,false,String(value));
  const runtime=fs.readFileSync('public/admin-premium-nutrition-plan.js','utf8');
  assert.match(runtime,/addEventListener\('click',\(\)=>duplicatePublished\(state\.current\)\)/);
  assert.match(runtime,/duplicate-as-draft/);
  assert.match(runtime,/encodeURIComponent\(source\.id\)/);
});

test('draft version keeps immutable V1 current while V2 persists independently',()=>{
  const result=validateVersionWorkflow({current:{...v1,status:'PUBLISHED'},draft:{...v2,status:'DRAFT'},history:[]},{v1Id:'v1',v2Id:'v2',v1Marker:'V1-run',v2Marker:'V2-run',phase:'draft'});
  assert.equal(result.ok,true);
  assert.equal(validateVersionWorkflow({current:{...v2,status:'DRAFT'},draft:null},{v1Id:'v1',v2Id:'v2',v1Marker:'V1-run',v2Marker:'V2-run',phase:'draft'}).ok,false);
});

test('publication requires V2 current, greater version, no draft, and intact archived V1 history',()=>{
  assert.equal(validateVersionWorkflow({current:v2,draft:null,history:[v1]},{v1Id:'v1',v2Id:'v2',v1Marker:'V1-run',v2Marker:'V2-run',phase:'published'}).ok,true);
  assert.equal(validateVersionWorkflow({current:v2,draft:null,history:[]},{v1Id:'v1',v2Id:'v2',v1Marker:'V1-run',v2Marker:'V2-run',phase:'published'}).ok,false);
  assert.equal(validateVersionWorkflow({current:v2,draft:null,history:[{...v1,meals:[{primary_text:'V1-run V2-run'}]}]},{v1Id:'v1',v2Id:'v2',v1Marker:'V1-run',v2Marker:'V2-run',phase:'published'}).ok,false);
});

test('Portal stays on V1 during draft and switches to V2 only after publication',()=>{
  assert.equal(validatePortalVersion(response({id:'v1',title:'Plano',meals:v1.meals}),{planId:'v1',present:'V1-run',absent:'V2-run'}).ok,true);
  assert.equal(validatePortalVersion(response({id:'v2',title:'Plano',meals:v2.meals}),{planId:'v2',present:'V2-run',absent:'V1-run'}).ok,true);
  assert.equal(validatePortalVersion(response({id:'v2',status:'DRAFT',meals:v2.meals}),{planId:'v2',present:'V2-run',absent:'V1-run'}).ok,false);
  assert.equal(validatePortalVersion(response({id:'v1',meals:[...v1.meals,...v2.meals]}),{planId:'v1',present:'V1-run',absent:'V2-run'}).ok,false);
});

test('Premium allowlist accepts versioning contracts and fails closed for Projeto LM',()=>{
  const allowed=[
    {method:'GET',path:'/api/admin/premium/students/s1/nutrition-plan'},
    {method:'POST',path:'/api/admin/premium/nutrition-plans/v1/duplicate-as-draft'},
    {method:'PATCH',path:'/api/admin/premium/nutrition-plans/v2/draft'},
    {method:'POST',path:'/api/admin/premium/nutrition-plans/v2/publish'},
    {method:'GET',path:'/api/portal/nutrition-plan'}
  ];
  assert.equal(validateVersioningCalls(allowed).ok,true);
  assert.equal(validateVersioningCalls([...allowed,{method:'GET',path:'/api/projeto-lm/current-mission'}]).ok,false);
});

test('workflow uses pipefail, orders F1.8.1 after F1.8, and uploads its report',()=>{
  const workflow=fs.readFileSync('.github/workflows/qa-lm-staging.yml','utf8');
  const baseline=workflow.indexOf('npm run qa:lm:premium-nutrition-plan | tee');
  const versioning=workflow.indexOf('npm run qa:lm:premium-nutrition-versioning | tee');
  assert.ok(baseline>=0&&versioning>baseline);
  assert.match(workflow,/set -o pipefail\s+npm run qa:lm:premium-nutrition-versioning \| tee qa-premium-nutrition-versioning-report\.json/);
  assert.match(workflow,/qa-premium-nutrition-versioning-report\.json/);
  assert.equal(JSON.parse(fs.readFileSync('package.json')).scripts['qa:lm:premium-nutrition-versioning'],'node scripts/qa-premium-nutrition-versioning-staging-e2e.mjs');
});

test('report is fail-closed, masks credentials and never emits clinical payloads',()=>{
  const source=fs.readFileSync('scripts/qa-premium-nutrition-versioning-staging-e2e.mjs','utf8');
  assert.match(source,/process\.exitCode=1/);
  assert.match(source,/mask\(env\.QA_ADMIN_SESSION\)/);
  assert.match(source,/mask\(token\)/);
  assert.match(source,/mask\(email\)/);
  assert.doesNotMatch(source,/rows\.push\([^\n]*(?:token|email|answers)/);
  assert.match(source,/lifecycle-stability/);
  assert.match(source,/identity-consistency/);
});
