import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  pendingFor, sanitizeReport, submittedFeedbacks, validateAnalyzedRecord, validateCurrentWeeklyFeedbackContract, validateDetail,
  validateHttpSuccess, validateIdentity, validateInitialCheckinState, validateStudentResponse, validateUnavailableSubmitContract, validateWeeklyCheckinCalls,
} from '../scripts/qa-premium-weekly-checkin-response-staging-e2e.mjs';

const response=(data,status=200,ok=status>=200&&status<300)=>({ok,status,responseBody:JSON.stringify(data)});
const checkin={id:'checkin-1',student_id:'student-1',submitted_at:'2026-08-11T10:00:00Z',main_difficulty:'QA-F2.1-CHECKIN-run-1',coach_status:'pending'};
const pending={id:'pending-1',student_id:'student-1',type:'ANALYZE_WEEKLY_FEEDBACK',related_entity_type:'student_checkins',related_entity_id:'checkin-1',status:'OPEN'};
const temporalData=status=>({ok:true,data:{weekRef:'2026-W33',status,availableAt:'2026-08-14T03:00:00.000Z',recommendedDeadline:'2026-08-15T15:00:00.000Z',submittedAt:null,isLate:false,questions:{},professionalResponse:null}});

test('initial state permits fixture data but rejects a check-in marker before submit',()=>{
  const markers={fixtureMarker:'QA-F2.1-FIXTURE-run-1',checkinMarker:'QA-F2.1-CHECKIN-run-1',responseMarker:'QA-F2.1-RESPONSE-run-1'};
  const record={anamnesis:{marker:markers.fixtureMarker},objectives:{marker:markers.fixtureMarker},nutritionPlan:{notes:markers.fixtureMarker},feedbacks:[]};
  assert.deepEqual(validateInitialCheckinState(record,markers),{ok:true,fixtureMarkerPresent:true,checkinMarkerPresent:false,responseMarkerPresent:false});
  assert.deepEqual(validateInitialCheckinState({...record,feedbacks:[{main_difficulty:markers.checkinMarker}]},markers),{ok:false,fixtureMarkerPresent:true,checkinMarkerPresent:true,responseMarkerPresent:false});
});

test('submitted_at is the sole sent-checkin boundary',()=>{
  assert.deepEqual(submittedFeedbacks([checkin,{...checkin,id:'draft',submitted_at:null}]).map(x=>x.id),['checkin-1']);
});

test('canonical identity accepts the expected student and fails closed on divergence',()=>{
  assert.equal(validateIdentity(checkin,'student-1').ok,true);
  assert.equal(validateIdentity({...checkin,student_id:'student-2'},'student-1').ok,false);
  assert.equal(validateIdentity({...checkin,student_id:null},'student-1').ok,false);
});

test('HTTP success requires transport success, 2xx, and ok true',()=>{
  assert.equal(validateHttpSuccess(response({ok:true,data:{}})).ok,true);
  assert.equal(validateHttpSuccess(response({ok:false,data:{}},200)).ok,false);
  assert.equal(validateHttpSuccess(response({ok:true},500,false)).ok,false);
});

test('fresh fixture temporal contract accepts only AVAILABLE or NOT_AVAILABLE with complete schedule metadata',()=>{
  assert.equal(validateCurrentWeeklyFeedbackContract(response(temporalData('AVAILABLE'))).ok,true);
  assert.equal(validateCurrentWeeklyFeedbackContract(response(temporalData('NOT_AVAILABLE'))).ok,true);
  assert.equal(validateCurrentWeeklyFeedbackContract(response(temporalData('RESPONDED'))).ok,false);
  assert.equal(validateCurrentWeeklyFeedbackContract(response({ok:false,error:'boom'},500,false)).ok,false);
  assert.equal(validateCurrentWeeklyFeedbackContract(response({ok:true,data:{status:'NOT_AVAILABLE'}})).ok,false);
});

test('temporal validator preserves sanitized public 5xx diagnostics without accepting the failure',()=>{
  const result=validateCurrentWeeklyFeedbackContract(response({ok:false,code:'INTERNAL_ERROR',error:'D1 bind failed',message:'weekly feedback lookup failed',secret:'must-not-be-picked'},500,false));
  assert.equal(result.ok,false);
  assert.equal(result.httpStatus,500);
  assert.equal(result.code,'INTERNAL_ERROR');
  assert.equal(result.error,'D1 bind failed');
  assert.equal(result.message,'weekly feedback lookup failed');
  assert.deepEqual(result.responseKeys,['code','error','message','ok','secret']);
  assert.equal(Object.hasOwn(result,'secret'),false);
});

test('closed temporal window requires canonical 409 and never accepts a 5xx',()=>{
  const unavailable=response({ok:false,error:'Seu Feedback Semanal ainda não está disponível.'},409,true);
  assert.equal(validateUnavailableSubmitContract(unavailable).ok,true);
  assert.equal(validateUnavailableSubmitContract(response({ok:false,error:'internal'},500,false)).ok,false);
  assert.equal(validateUnavailableSubmitContract(response({ok:false,error:'outro conflito'},409,true)).ok,false);
});

test('detail proves canonical ID, identity, submitted_at, and complete marker-bearing answers',()=>{
  assert.equal(validateDetail(response({ok:true,data:{feedback:checkin}}),{checkinId:'checkin-1',studentId:'student-1',marker:'QA-F2.1-CHECKIN'}).ok,true);
  assert.equal(validateDetail(response({ok:true,data:{feedback:{...checkin,submitted_at:null}}}),{checkinId:'checkin-1',studentId:'student-1',marker:'QA-F2.1-CHECKIN'}).ok,false);
});

test('pending transitions from exactly one open item to none and stays resolved after reload',()=>{
  assert.equal(pendingFor({pending_items:[pending]},'checkin-1').length,1);
  const reviewed={...checkin,coach_status:'reviewed',coach_reply:'QA-F2.1-RESPONSE-run-1',reviewed_at:'2026-08-11T11:00:00Z'};
  const record={feedbacks:[reviewed],pending_items:[{...pending,status:'RESOLVED'}]};
  assert.equal(validateAnalyzedRecord(record,{checkinId:'checkin-1',studentId:'student-1',responseMarker:'QA-F2.1-RESPONSE'}).ok,true);
  assert.equal(validateAnalyzedRecord(structuredClone(record),{checkinId:'checkin-1',studentId:'student-1',responseMarker:'QA-F2.1-RESPONSE'}).ok,true);
  assert.equal(submittedFeedbacks(record.feedbacks).some(x=>x.id==='checkin-1'),true);
});

test('duplicate open pending item makes the before-analysis exact-once gate fail',()=>{
  assert.equal(pendingFor({pending_items:[pending,{...pending,id:'pending-2'}]},'checkin-1').length,2);
});

test('student current contract correlates check-in and exposes only the public response object',()=>{
  const result=response({ok:true,data:{questions:checkin,professionalResponse:{message:'QA-F2.1-RESPONSE-run-1',respondedAt:'2026-08-11T11:00:00Z'}}});
  assert.equal(validateStudentResponse(result,{checkinId:'checkin-1',responseMarker:'QA-F2.1-RESPONSE'}).ok,true);
  assert.equal(validateStudentResponse(response({ok:true,data:{questions:checkin,professionalResponse:null}}),{checkinId:'checkin-1',responseMarker:'QA-F2.1-RESPONSE'}).ok,false);
});

test('allowlist rejects every Projeto LM route',()=>{
  assert.equal(validateWeeklyCheckinCalls([{method:'POST',path:'/api/project-lm-2/checkin'}]).ok,false);
  assert.equal(validateWeeklyCheckinCalls([{method:'GET',path:'/api/portal/premium/weekly-feedback/current'}]).ok,true);
});

test('legacy unique identity remains supported while ambiguous identity stays blocked by repository contract',()=>{
  const sql=fs.readFileSync('workers/premium/repositories/legacy-checkin-identity-sql.js','utf8');
  assert.match(sql,/COUNT\(\*\)[\s\S]*\)=1/);
  assert.match(sql,/student_id IS NULL/);
  const repository=fs.readFileSync('workers/premium/repositories/d1-student-record-repository.js','utf8');
  assert.match(repository,/COALESCE\(sc\.student_id, __LEGACY_IDENTITY__\)/);
  assert.match(repository,/sc\.submitted_at IS NOT NULL/);
});

test('smoke branches explicitly on NOT_AVAILABLE, requires 409 and records the temporal execution mode',()=>{
  const source=fs.readFileSync('scripts/qa-premium-weekly-checkin-response-staging-e2e.mjs','utf8');
  assert.match(source,/validateCurrentWeeklyFeedbackContract\(currentBefore\)/);
  assert.match(source,/temporal\.status===['"]NOT_AVAILABLE['"]/);
  assert.match(source,/executionMode=['"]TEMPORAL_WINDOW_CLOSED['"]/);
  assert.match(source,/expectedStatus:\[409\]/);
  assert.match(source,/unavailable-no-persistence/);
});

test('report sanitizer removes secrets and NOT_VALIDATED CLI exits nonzero',()=>{
  const clean=sanitizeReport({status:'NOT_VALIDATED',evidence:{token:'secret-token'}},['secret-token']);
  assert.equal(JSON.stringify(clean).includes('secret-token'),false);
  const source=fs.readFileSync('scripts/qa-premium-weekly-checkin-response-staging-e2e.mjs','utf8');
  assert.match(source,/report\.status!==['"]VALIDATED['"]\)process\.exitCode=1/);
});

test('workflow pins default staging target to exact git SHA preview and deploy creates that alias',()=>{
  const workflow=fs.readFileSync('.github/workflows/qa-lm-staging.yml','utf8');
  const deploy=fs.readFileSync('.github/workflows/cloudflare-deploy.yml','utf8');
  assert.match(workflow,/sha-\$\{EXPECTED_SHA\}-\$\{CF_WORKER_NAME\}/);
  assert.match(workflow,/Cloudflare SHA preview alias/);
  assert.match(workflow,/Verify preview fidelity/);
  assert.doesNotMatch(workflow,/versions\?per_page=1/);
  assert.match(deploy,/--preview-alias sha-\$\{\{ github\.sha \}\}/);
  assert.match(deploy,/--tag \$\{\{ github\.sha \}\}/);
});

test('workflow runs F2.1 after F1.8.1 with pipefail and uploads its report',()=>{
  const workflow=fs.readFileSync('.github/workflows/qa-lm-staging.yml','utf8');
  const previous=workflow.indexOf('npm run qa:lm:premium-nutrition-versioning');
  const f21=workflow.indexOf('npm run qa:lm:premium-weekly-checkin-response');
  assert.ok(previous>=0&&f21>previous);
  assert.match(workflow.slice(f21-80,f21),/set -o pipefail/);
  assert.match(workflow,/qa-premium-weekly-checkin-response-report\.json/);
});
