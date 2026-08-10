#!/usr/bin/env node
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { request } from './qa-sprint7-staging-e2e.mjs';
import { ANAMNESIS_ROUTE, routeForPremiumAccess, uniqueQaIdentity, validateCreation } from './qa-premium-entry-staging-e2e.mjs';
import { createQaAnswers, validateRecord, validateSubmit } from './qa-premium-anamnesis-staging-e2e.mjs';

export const EXPECTED_AFTER_DECISION = 'READY_TO_RELEASE';
export const PREMIUM_OBJECTIVES_CALLS = new Set([
  'POST /api/admin/premium/workspace/students', 'POST /api/portal/login',
  'GET /api/portal/premium/access-state', 'POST /api/anamnese-premium',
  'GET /api/admin/premium/students/:studentId/record',
  'GET /api/admin/premium/students/:studentId/planning-objectives',
  'PUT /api/admin/premium/students/:studentId/planning-objectives',
  'PATCH /api/admin/premium/students/:studentId/status',
]);
const productionHosts = new Set(['portal.lucasmorenopersonal.com.br']);
const fields = ['training_focus','cardio_target','nutrition_focus','main_risk','coach_message'];
const parse = result => { try { return JSON.parse(result.responseBody || ''); } catch { return null; } };
const safeStaging = (env, base) => { try { const u = new URL(base); return env.QA_TARGET_ENVIRONMENT === 'staging' && u.protocol === 'https:' && !productionHosts.has(u.hostname.toLowerCase()); } catch { return false; } };
function canonicalCall(method, path) {
  if (/^\/api\/admin\/premium\/students\/[^/]+\/record$/.test(path)) return `${method} /api/admin/premium/students/:studentId/record`;
  if (/^\/api\/admin\/premium\/students\/[^/]+\/planning-objectives$/.test(path)) return `${method} /api/admin/premium/students/:studentId/planning-objectives`;
  if (/^\/api\/admin\/premium\/students\/[^/]+\/status$/.test(path)) return `${method} /api/admin/premium/students/:studentId/status`;
  return `${method} ${path}`;
}
export function validatePremiumObjectivesCalls(calls) { const unexpected = calls.map(x => canonicalCall(x.method || 'GET', x.path)).filter(x => !PREMIUM_OBJECTIVES_CALLS.has(x)); return { ok: unexpected.length === 0, unexpected }; }
export function createObjectives(marker) { return { training_focus:`QA F1.7 treino ${marker}`, cardio_target:`QA F1.7 cardio ${marker}`, nutrition_focus:`QA F1.7 alimentação ${marker}`, main_risk:`QA F1.7 objetivo principal ${marker}`, coach_message:`QA F1.7 conselho ${marker}` }; }
export function validateObjectivesSave(result, expected, studentId) { const body=parse(result), data=body?.data; return { ok:result.ok && result.status===200 && body?.ok===true && data?.student_id===studentId && fields.every(k=>data[k]===expected[k]), objectiveStudentId:data?.student_id||null, id:data?.id||null }; }
export function validateObjectivesReload(result, expected, studentId) { const body=parse(result), data=body?.data; const exact=fields.every(k=>data?.[k]===expected[k]); return { ok:result.ok && result.status===200 && body?.ok===true && data?.student_id===studentId && exact, objectiveStudentId:data?.student_id||null, markerPresent:exact }; }
export function validateDecision(result, studentId) { const body=parse(result), data=body?.data; return { ok:result.ok && result.status===200 && body?.ok===true && data?.student_id===studentId && data?.from==='UNDER_REVIEW' && data?.to===EXPECTED_AFTER_DECISION && typeof data?.followup_entry_id==='string', decisionStudentId:data?.student_id||null }; }

export async function runPremiumObjectivesSmoke({ env=process.env, requestFn, mask=()=>{} }={}) {
  const startedAt=Date.now(), rows=[], calls=[], base=String(env.QA_BASE_URL||'').trim().replace(/\/+$/,'');
  const add=(flow,expected,evidence,status)=>rows.push({flow,expected,evidence,status});
  const perform=requestFn||((path,options)=>request(base,path,options));
  const call=async(path,options={})=>{calls.push({path,method:options.method||'GET'});return perform(path,options);};
  const finish=()=>{const isolation=validatePremiumObjectivesCalls(calls);add('project-lm-isolation','somente oito contratos Premium permitidos',{unexpectedCalls:isolation.unexpected.length},isolation.ok?'PASSED':'FAILED');return {flow:'Premium professional objectives',environment:'staging',status:rows.every(x=>x.status==='PASSED')?'VALIDATED':'NOT_VALIDATED',durationMs:Date.now()-startedAt,columns:['Fluxo','Resultado esperado','Evidência','Status'],rows};};
  if(!safeStaging(env,base)||!env.QA_ADMIN_SESSION){add('fixture-under-review','staging seguro e sessão administrativa',{code:'UNSAFE_OR_INCOMPLETE_TARGET'},'FAILED');return finish();}
  mask(env.QA_ADMIN_SESSION); const email=uniqueQaIdentity({runId:`${env.GITHUB_RUN_ID||'local'}-objectives`,attempt:env.GITHUB_RUN_ATTEMPT});mask(email);
  const adminHeaders={'x-admin-session':env.QA_ADMIN_SESSION};
  const created=await call('/api/admin/premium/workspace/students',{method:'POST',headers:adminHeaders,expectedStatus:[200,201],body:{name:'QA Premium Objectives',email}}), creation=validateCreation(parse(created),email);
  if(!created.ok||!creation.ok){add('fixture-under-review','fixture Premium criada legitimamente',{httpStatus:created.status,code:creation.code||'CREATE_HTTP_FAILED'},'FAILED');return finish();}
  const {studentId,token}=creation.data;mask(token); const studentHeaders={'x-student-email':email,'x-student-token':token};
  const login=await call('/api/portal/login',{method:'POST',expectedStatus:[200],body:{email,token}}), loginData=parse(login)?.data;
  const beforeAccess=await call('/api/portal/premium/access-state',{headers:studentHeaders,expectedStatus:[200]}), awaiting=parse(beforeAccess)?.data;
  const marker=`QA-F1.7-${env.GITHUB_RUN_ID||Date.now()}-${env.GITHUB_RUN_ATTEMPT||'1'}`;
  const submitted=await call('/api/anamnese-premium',{method:'POST',headers:studentHeaders,expectedStatus:[200],body:{answers:createQaAnswers(marker)}}), submit=validateSubmit(submitted);
  const underResult=await call('/api/portal/premium/access-state',{headers:studentHeaders,expectedStatus:[200]}), under=parse(underResult)?.data;
  const fixtureOk=login.ok&&loginData?.plan==='premium'&&awaiting?.consultationStatus==='AWAITING_ANAMNESIS'&&routeForPremiumAccess(awaiting)===ANAMNESIS_ROUTE&&submit.ok&&underResult.ok&&under?.consultationStatus==='UNDER_REVIEW';
  add('fixture-under-review','criação, login e anamnese levam a UNDER_REVIEW',{studentId,httpStatus:underResult.status,lifecycle:under?.consultationStatus||null},fixtureOk?'PASSED':'FAILED'); if(!fixtureOk)return finish();
  const recordResult=await call(`/api/admin/premium/students/${encodeURIComponent(studentId)}/record`,{headers:adminHeaders,expectedStatus:[200]}), record=validateRecord(parse(recordResult),{studentId,anamnesisId:submit.id,marker});
  const emptyResult=await call(`/api/admin/premium/students/${encodeURIComponent(studentId)}/planning-objectives`,{headers:adminHeaders,expectedStatus:[200]}), empty=parse(emptyResult)?.data;
  const preOk=recordResult.ok&&record.ok&&emptyResult.ok&&empty?.student_id===studentId&&empty?.status==='EMPTY'&&fields.every(k=>empty[k]==='');
  add('student-record-pre-decision','anamnese presente e objetivos da semana vazios',{httpStatus:recordResult.status,anamnesisPresent:record.ok,objectivesStatus:empty?.status||null},preOk?'PASSED':'FAILED'); if(!preOk)return finish();
  const objectives=createObjectives(marker), endpoint=`/api/admin/premium/students/${encodeURIComponent(studentId)}/planning-objectives`;
  const savedResult=await call(endpoint,{method:'PUT',headers:adminHeaders,expectedStatus:[200],body:objectives}), saved=validateObjectivesSave(savedResult,objectives,studentId);
  add('objectives-save','PUT retorna os cinco campos exatos e identidade canônica',{httpStatus:savedResult.status,objectiveStudentId:saved.objectiveStudentId},saved.ok?'PASSED':'FAILED'); if(!saved.ok)return finish();
  const reloadResult=await call(endpoint,{headers:adminHeaders,expectedStatus:[200]}), reloaded=validateObjectivesReload(reloadResult,objectives,studentId);
  add('objectives-persistence','nova leitura contém exatamente o marker em cinco campos',{httpStatus:reloadResult.status,marker,markerPresent:reloaded.markerPresent},reloaded.ok?'PASSED':'FAILED'); if(!reloaded.ok)return finish();
  const decisionResult=await call(`/api/admin/premium/students/${encodeURIComponent(studentId)}/status`,{method:'PATCH',headers:adminHeaders,expectedStatus:[200],body:{status:EXPECTED_AFTER_DECISION}}), decision=validateDecision(decisionResult,studentId);
  add('professional-decision','ação real do Prontuário confirma o planejamento',{httpStatus:decisionResult.status,decisionStudentId:decision.decisionStudentId},decision.ok?'PASSED':'FAILED');
  const afterResult=await call('/api/portal/premium/access-state',{headers:studentHeaders,expectedStatus:[200]}), after=parse(afterResult)?.data, lifecycleOk=afterResult.ok&&after?.consultationStatus===EXPECTED_AFTER_DECISION;
  add('lifecycle-after-decision',`UNDER_REVIEW avança para ${EXPECTED_AFTER_DECISION}`,{beforeLifecycle:under.consultationStatus,afterLifecycle:after?.consultationStatus||null},decision.ok&&lifecycleOk?'PASSED':'FAILED');
  const identityOk=record.recordStudentId===studentId&&record.anamnesisStudentId===studentId&&saved.objectiveStudentId===studentId&&reloaded.objectiveStudentId===studentId&&decision.decisionStudentId===studentId;
  add('identity-consistency','fixture, prontuário, objetivos e decisão usam o mesmo studentId',{studentId,recordStudentId:record.recordStudentId,objectiveStudentId:reloaded.objectiveStudentId,decisionStudentId:decision.decisionStudentId},identityOk?'PASSED':'FAILED');
  return finish();
}

async function main(){const report=await runPremiumObjectivesSmoke({mask:value=>process.stderr.write(`::add-mask::${value}\n`)});console.log(JSON.stringify(report,null,2));process.exitCode=report.status==='VALIDATED'?0:1;}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
