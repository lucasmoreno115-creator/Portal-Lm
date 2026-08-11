#!/usr/bin/env node
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { request } from './qa-sprint7-staging-e2e.mjs';
import { uniqueQaIdentity, validateCreation } from './qa-premium-entry-staging-e2e.mjs';
import { createQaAnswers, validateSubmit } from './qa-premium-anamnesis-staging-e2e.mjs';
import { createObjectives, validateDecision, validateObjectivesSave, EXPECTED_AFTER_DECISION } from './qa-premium-objectives-staging-e2e.mjs';

export const WEEKLY_CHECKIN_CALLS = new Set([
  'POST /api/admin/premium/workspace/students', 'POST /api/portal/login', 'GET /api/portal/premium/access-state',
  'POST /api/anamnese-premium', 'PUT /api/admin/premium/students/:studentId/planning-objectives',
  'PATCH /api/admin/premium/students/:studentId/status', 'POST /api/admin/premium/students/:studentId/nutrition-plan/draft',
  'PATCH /api/admin/premium/nutrition-plans/:planId/draft', 'POST /api/admin/premium/nutrition-plans/:planId/publish',
  'GET /api/admin/premium/students/:studentId/record', 'GET /api/portal/premium/weekly-feedback/current',
  'POST /api/portal/premium/weekly-feedback/current', 'GET /api/admin/premium/weekly-feedbacks/:checkinId',
  'POST /api/admin/premium/weekly-feedbacks/:checkinId/decision', 'GET /api/portal/premium/weekly-feedback/history',
]);
const parse = result => { try { return JSON.parse(result?.responseBody || ''); } catch { return null; } };
const data = result => parse(result)?.data;
const diagnosticText = value => { const text=String(value??'').trim(); return text ? text.slice(0,240) : null; };
const analyzed = value => ['reviewed','replied','analyzed','analisado','analisada'].includes(String(value || '').trim().toLowerCase());
const canonical = (method, path) => {
  const patterns = [
    [/^\/api\/admin\/premium\/students\/[^/]+\/planning-objectives$/, '/api/admin/premium/students/:studentId/planning-objectives'],
    [/^\/api\/admin\/premium\/students\/[^/]+\/status$/, '/api/admin/premium/students/:studentId/status'],
    [/^\/api\/admin\/premium\/students\/[^/]+\/nutrition-plan\/draft$/, '/api/admin/premium/students/:studentId/nutrition-plan/draft'],
    [/^\/api\/admin\/premium\/nutrition-plans\/[^/]+\/(draft|publish)$/, '/api/admin/premium/nutrition-plans/:planId/$1'],
    [/^\/api\/admin\/premium\/students\/[^/]+\/record$/, '/api/admin/premium/students/:studentId/record'],
    [/^\/api\/admin\/premium\/weekly-feedbacks\/[^/]+\/decision$/, '/api/admin/premium/weekly-feedbacks/:checkinId/decision'],
    [/^\/api\/admin\/premium\/weekly-feedbacks\/[^/]+$/, '/api/admin/premium/weekly-feedbacks/:checkinId'],
  ];
  for (const [pattern, replacement] of patterns) if (pattern.test(path)) return `${method} ${replacement.replace('$1', path.split('/').at(-1))}`;
  return `${method} ${path}`;
};
export function validateWeeklyCheckinCalls(calls) { const unexpected=calls.map(({method='GET',path})=>canonical(method,path)).filter(call=>!WEEKLY_CHECKIN_CALLS.has(call)); return {ok:unexpected.length===0,unexpected}; }
export function submittedFeedbacks(records=[]) { return records.filter(item=>Boolean(item?.submitted_at)); }
export function validateIdentity(item, studentId) { return {ok:Boolean(item?.id)&&item?.student_id===studentId,checkinId:item?.id||null,studentId:item?.student_id||null}; }
export function pendingFor(record, checkinId) { return (record?.pending_items||[]).filter(item=>item.type==='ANALYZE_WEEKLY_FEEDBACK'&&item.related_entity_type==='student_checkins'&&item.related_entity_id===checkinId&&item.status==='OPEN'); }
export function validateHttpSuccess(result) { const body=parse(result); return {ok:Boolean(result?.ok&&result.status>=200&&result.status<300&&body?.ok===true),body}; }
export function validateCurrentWeeklyFeedbackContract(result) {
  const http=validateHttpSuccess(result), current=http.body?.data, status=String(current?.status||'');
  const freshFixtureStatus=status==='AVAILABLE'||status==='NOT_AVAILABLE';
  const shape=Boolean(current&&typeof current.weekRef==='string'&&current.weekRef&&typeof current.availableAt==='string'&&current.availableAt&&typeof current.recommendedDeadline==='string'&&current.recommendedDeadline);
  return {
    ok:Boolean(http.ok&&freshFixtureStatus&&shape),
    status:status||null,
    weekRef:current?.weekRef||null,
    availableAt:current?.availableAt||null,
    recommendedDeadline:current?.recommendedDeadline||null,
    httpStatus:result?.status??null,
    error:diagnosticText(http.body?.error),
    code:diagnosticText(http.body?.code),
    message:diagnosticText(http.body?.message),
    responseKeys:http.body&&typeof http.body==='object'&&!Array.isArray(http.body)?Object.keys(http.body).sort():[],
  };
}
export function validateUnavailableSubmitContract(result) {
  const body=parse(result), error=String(body?.error||'');
  return {ok:Boolean(result?.ok&&result.status===409&&body?.ok===false&&/ainda não está disponível/i.test(error)),httpStatus:result?.status??null,error:error||null};
}
export function validateDetail(result,{checkinId,studentId,marker}) { const body=parse(result), detail=body?.data, feedback=detail?.feedback; const serialized=JSON.stringify(feedback||{}); return {ok:validateHttpSuccess(result).ok&&feedback?.id===checkinId&&feedback?.student_id===studentId&&Boolean(feedback?.submitted_at)&&serialized.includes(marker),feedback,detail}; }
export function validateAnalyzedRecord(record,{checkinId,studentId,responseMarker}) { const feedback=submittedFeedbacks(record?.feedbacks).find(item=>item.id===checkinId), pending=pendingFor(record,checkinId); return {ok:Boolean(feedback&&feedback.student_id===studentId&&analyzed(feedback.coach_status)&&String(feedback.coach_reply||'').includes(responseMarker)&&(feedback.reviewed_at||feedback.coach_reply_at)&&pending.length===0),feedback,pendingCount:pending.length}; }
export function validateStudentResponse(result,{checkinId,responseMarker}) { const body=parse(result), current=body?.data; return {ok:validateHttpSuccess(result).ok&&current?.questions?.id===checkinId&&String(current?.professionalResponse?.message||'').includes(responseMarker)&&Boolean(current?.professionalResponse?.respondedAt),current}; }
export function validateInitialCheckinState(record,{fixtureMarker,checkinMarker,responseMarker}) { const serialized=JSON.stringify(record||{}), fixtureMarkerPresent=serialized.includes(fixtureMarker), checkinMarkerPresent=serialized.includes(checkinMarker), responseMarkerPresent=serialized.includes(responseMarker); return {ok:!checkinMarkerPresent&&!responseMarkerPresent,fixtureMarkerPresent,checkinMarkerPresent,responseMarkerPresent}; }
export function sanitizeReport(report,secrets=[]) { let text=JSON.stringify(report); for(const secret of secrets.filter(Boolean)) text=text.replaceAll(String(secret),'[REDACTED]'); return JSON.parse(text); }

export async function runPremiumWeeklyCheckinResponseSmoke({env=process.env,requestFn,mask=()=>{}}={}) {
  const started=Date.now(), rows=[], calls=[], base=String(env.QA_BASE_URL||'').trim().replace(/\/+$/,'');
  let executionMode='FULL_RESPONSE_FLOW';
  const add=(flow,expected,evidence,ok)=>rows.push({flow,expected,evidence,status:ok?'PASSED':'FAILED'});
  const perform=requestFn||((path,options)=>request(base,path,options));
  const call=async(path,options={})=>{calls.push({path,method:options.method||'GET'});return perform(path,options);};
  const finish=()=>{const isolation=validateWeeklyCheckinCalls(calls);add('project-lm-isolation','allowlist contém exclusivamente contratos Premium',{unexpectedCalls:isolation.unexpected},isolation.ok);const report={flow:'Premium weekly check-in response F2.1',environment:'staging',executionMode,status:rows.every(row=>row.status==='PASSED')?'VALIDATED':'NOT_VALIDATED',durationMs:Date.now()-started,columns:['Fluxo','Resultado esperado','Evidência','Status'],rows};return sanitizeReport(report,[env.QA_ADMIN_SESSION]);};
  let target; try { target=new URL(base); } catch {}
  if(env.QA_TARGET_ENVIRONMENT!=='staging'||target?.protocol!=='https:'||target?.hostname==='portal.lucasmorenopersonal.com.br'||!env.QA_ADMIN_SESSION){add('fixture-active','staging não produtivo e sessão administrativa presentes',{code:'UNSAFE_OR_INCOMPLETE_TARGET'},false);return finish();}
  mask(env.QA_ADMIN_SESSION);
  const run=env.GITHUB_RUN_ID||Date.now(), attempt=env.GITHUB_RUN_ATTEMPT||'1', fixtureMarker=`QA-F2.1-FIXTURE-${run}-${attempt}`, checkinMarker=`QA-F2.1-CHECKIN-${run}-${attempt}`, responseMarker=`QA-F2.1-RESPONSE-${run}-${attempt}`;
  const email=uniqueQaIdentity({runId:`${run}-f21`,attempt}); mask(email); const ah={'x-admin-session':env.QA_ADMIN_SESSION};
  const created=await call('/api/admin/premium/workspace/students',{method:'POST',headers:ah,expectedStatus:[200,201],body:{name:'QA Premium F2.1',email}}), creation=validateCreation(parse(created),email);
  if(!created.ok||!creation.ok){add('fixture-active','fixture Premium única criada',{httpStatus:created.status},false);return finish();}
  const {studentId,token}=creation.data; mask(token); const sh={'x-student-email':email,'x-student-token':token};
  const login=await call('/api/portal/login',{method:'POST',expectedStatus:[200],body:{email,token}});
  const anamnesis=await call('/api/anamnese-premium',{method:'POST',headers:sh,expectedStatus:[200],body:{answers:createQaAnswers(fixtureMarker)}});
  const objectives=createObjectives(fixtureMarker), objectivesResult=await call(`/api/admin/premium/students/${encodeURIComponent(studentId)}/planning-objectives`,{method:'PUT',headers:ah,expectedStatus:[200],body:objectives});
  const ready=await call(`/api/admin/premium/students/${encodeURIComponent(studentId)}/status`,{method:'PATCH',headers:ah,expectedStatus:[200],body:{status:EXPECTED_AFTER_DECISION}});
  const draft=data(await call(`/api/admin/premium/students/${encodeURIComponent(studentId)}/nutrition-plan/draft`,{method:'POST',headers:ah,expectedStatus:[200],body:{plan:{title:`Plano ${fixtureMarker}`,meals:[],substitutions:[]}}}));
  const written=await call(`/api/admin/premium/nutrition-plans/${encodeURIComponent(draft?.id)}/draft`,{method:'PATCH',headers:ah,expectedStatus:[200],body:{student_id:studentId,title:`Plano ${fixtureMarker}`,meals:[{name:'Plano base',primary_text:fixtureMarker,items:[],substitutions:[]}],substitutions:[],adherence_rules:[],notes:fixtureMarker,expected_updated_at:draft?.updated_at}});
  const published=await call(`/api/admin/premium/nutrition-plans/${encodeURIComponent(draft?.id)}/publish`,{method:'POST',headers:ah,expectedStatus:[200],body:{student_id:studentId}});
  const release=await call(`/api/admin/premium/students/${encodeURIComponent(studentId)}/status`,{method:'PATCH',headers:ah,expectedStatus:[200],body:{status:'ACTIVE'}});
  const lifecycle=data(await call('/api/portal/premium/access-state',{headers:sh,expectedStatus:[200]}))?.consultationStatus;
  const fixtureOk=login.ok&&validateSubmit(anamnesis).ok&&validateObjectivesSave(objectivesResult,objectives,studentId).ok&&validateDecision(ready,studentId).ok&&written.ok&&published.ok&&release.ok&&lifecycle==='ACTIVE';
  add('fixture-active','plano publicado e acompanhamento ACTIVE por lifecycle legítimo',{studentId,lifecycle,planId:draft?.id||null},fixtureOk); if(!fixtureOk)return finish();
  const recordPath=`/api/admin/premium/students/${encodeURIComponent(studentId)}/record`;
  const initial=data(await call(recordPath,{headers:ah,expectedStatus:[200]})), initialState=validateInitialCheckinState(initial,{fixtureMarker,checkinMarker,responseMarker});
  add('checkin-initial-state','markers de check-in e resposta ainda não existem no Prontuário',{fixtureMarkerPresent:initialState.fixtureMarkerPresent,checkinMarkerPresent:initialState.checkinMarkerPresent,responseMarkerPresent:initialState.responseMarkerPresent},initialState.ok); if(!initialState.ok)return finish();
  const currentBefore=await call('/api/portal/premium/weekly-feedback/current',{headers:sh,expectedStatus:[200]}), temporal=validateCurrentWeeklyFeedbackContract(currentBefore);
  add('weekly-feedback-temporal-contract','GET current retorna contrato temporal íntegro para fixture nova',{endpoint:'GET /api/portal/premium/weekly-feedback/current',httpStatus:temporal.httpStatus,status:temporal.status,weekRef:temporal.weekRef,availableAt:temporal.availableAt,recommendedDeadline:temporal.recommendedDeadline,error:temporal.error,code:temporal.code,message:temporal.message,responseKeys:temporal.responseKeys},temporal.ok); if(!temporal.ok)return finish();
  const answers={trainingAdherence:'100%',nutritionAdherence:'Boa',cardioAdherence:'Completo',freeMeals:'1',hungerLevel:'Controlada',bingeOrSnacking:'Não',sleepQuality:'Boa',energyLevel:'Boa',stressLevel:'Baixo',weeklyWeight:'70',waist:'80',strengthStatus:'Mantida',mainDifficulty:checkinMarker,routineContext:`Rotina segura ${checkinMarker}`,weeklyScore:'9',supportNeeded:`Apoio ${checkinMarker}`};
  if(temporal.status==='NOT_AVAILABLE') {
    executionMode='TEMPORAL_WINDOW_CLOSED';
    const rejected=await call('/api/portal/premium/weekly-feedback/current',{method:'POST',headers:sh,expectedStatus:[409],body:answers}), unavailable=validateUnavailableSubmitContract(rejected);
    add('student-checkin-unavailable','fora da janela o POST é rejeitado por contrato com 409, nunca 5xx',{endpoint:'POST /api/portal/premium/weekly-feedback/current',httpStatus:unavailable.httpStatus,error:unavailable.error},unavailable.ok);
    const afterRejected=data(await call(recordPath,{headers:ah,expectedStatus:[200]})), rejectedState=validateInitialCheckinState(afterRejected,{fixtureMarker,checkinMarker,responseMarker});
    add('unavailable-no-persistence','rejeição temporal não persiste check-in nem resposta',{fixtureMarkerPresent:rejectedState.fixtureMarkerPresent,checkinMarkerPresent:rejectedState.checkinMarkerPresent,responseMarkerPresent:rejectedState.responseMarkerPresent},unavailable.ok&&rejectedState.ok);
    return finish();
  }
  const submitted=await call('/api/portal/premium/weekly-feedback/current',{method:'POST',headers:sh,expectedStatus:[200],body:answers}), submitBody=data(submitted), submitOk=validateHttpSuccess(submitted).ok&&Boolean(submitBody?.id)&&Boolean(submitBody?.submittedAt);
  add('student-checkin-submit','POST retorna ID canônico e submittedAt',{endpoint:'POST /api/portal/premium/weekly-feedback/current',httpStatus:submitted.status,checkinId:submitBody?.id||null,submittedAt:submitBody?.submittedAt||null,availabilityStatus:temporal.status},submitOk); if(!submitOk)return finish();
  const checkinId=submitBody.id, recordBefore=data(await call(recordPath,{headers:ah,expectedStatus:[200]})), feedback=submittedFeedbacks(recordBefore?.feedbacks).find(item=>item.id===checkinId), identity=validateIdentity(feedback,studentId);
  add('professional-checkin-list','Prontuário lista entre os 12 enviados o mesmo ID e marker',{checkinId,listedId:feedback?.id||null,submittedAt:feedback?.submitted_at||null,markerPresent:JSON.stringify(feedback||{}).includes(checkinMarker)},identity.ok&&Boolean(feedback?.submitted_at)&&JSON.stringify(feedback).includes(checkinMarker));
  const pendingBefore=pendingFor(recordBefore,checkinId); add('pending-before-analysis','existe exatamente uma pendência OPEN correlacionada',{count:pendingBefore.length,pendingId:pendingBefore[0]?.id||null},pendingBefore.length===1);
  const detailResult=await call(`/api/admin/premium/weekly-feedbacks/${encodeURIComponent(checkinId)}`,{headers:ah,expectedStatus:[200]}), detail=validateDetail(detailResult,{checkinId,studentId,marker:checkinMarker});
  add('professional-checkin-detail','detalhe separado expõe todas as respostas e identidade canônica',{httpStatus:detailResult.status,checkinId:detail.feedback?.id||null,answerKeys:Object.keys(detail.feedback||{}).filter(key=>answers[`${key.split('_')[0]}${key.split('_').slice(1).map(x=>x[0]?.toUpperCase()+x.slice(1)).join('')}`]!==undefined)},detail.ok); if(!identity.ok||pendingBefore.length!==1||!detail.ok)return finish();
  const decisionBody={decision_type:'KEEP_STRATEGY',note:`Conduta interna ${run}`,coach_reply:responseMarker,followup_at:null};
  const decisionResult=await call(`/api/admin/premium/weekly-feedbacks/${encodeURIComponent(checkinId)}/decision`,{method:'POST',headers:ah,expectedStatus:[200],body:decisionBody}), decisionHttp=validateHttpSuccess(decisionResult);
  add('professional-analysis','decisão e mensagem pública são registradas sem falso sucesso',{endpoint:'POST /api/admin/premium/weekly-feedbacks/:checkinId/decision',httpStatus:decisionResult.status,ok:parse(decisionResult)?.ok===true,decisionType:data(decisionResult)?.decision_type||null},decisionHttp.ok); if(!decisionHttp.ok)return finish();
  const after=data(await call(recordPath,{headers:ah,expectedStatus:[200]})), persisted=validateAnalyzedRecord(after,{checkinId,studentId,responseMarker});
  add('analysis-persistence','nova leitura preserva resposta, status e timestamp',{coachStatus:persisted.feedback?.coach_status||null,reviewedAt:persisted.feedback?.reviewed_at||null,responsePresent:String(persisted.feedback?.coach_reply||'').includes(responseMarker)},persisted.ok);
  add('pending-after-analysis','pendência correlacionada está resolvida e check-in permanece no histórico',{openCount:persisted.pendingCount,historyPresent:Boolean(persisted.feedback)},persisted.ok);
  const repeated=await call(`/api/admin/premium/weekly-feedbacks/${encodeURIComponent(checkinId)}/decision`,{method:'POST',headers:ah,expectedStatus:[200],body:decisionBody}), repeatedBody=data(repeated), finalRecord=data(await call(recordPath,{headers:ah,expectedStatus:[200]})), finalState=validateAnalyzedRecord(finalRecord,{checkinId,studentId,responseMarker}), decisions=(finalRecord?.followup_entries||[]).filter(item=>item.entry_type==='PROFESSIONAL_DECISION'&&item.related_entity_id===checkinId);
  add('idempotency','repetição retorna unchanged e não duplica decisão nem pendência',{httpStatus:repeated.status,unchanged:repeatedBody?.unchanged===true,decisionEntries:decisions.length,openPending:finalState.pendingCount},validateHttpSuccess(repeated).ok&&repeatedBody?.unchanged===true&&decisions.length===1&&finalState.ok);
  const studentResult=await call('/api/portal/premium/weekly-feedback/current',{headers:sh,expectedStatus:[200]}), studentResponse=validateStudentResponse(studentResult,{checkinId,responseMarker});
  add('student-response-contract','contrato current expõe somente professionalResponse correlacionada',{delivery:studentResponse.ok?'AVAILABLE_IN_CURRENT_CONTRACT':'NOT_AVAILABLE_IN_CURRENT_CONTRACT',httpStatus:studentResult.status,checkinId:studentResponse.current?.questions?.id||null,responsePresent:String(studentResponse.current?.professionalResponse?.message||'').includes(responseMarker),responseKeys:Object.keys(studentResponse.current?.professionalResponse||{}).sort()},studentResponse.ok);
  add('identity-consistency','submit, Prontuário, detalhe e reload mantêm studentId canônico',{studentId,listStudentId:feedback?.student_id||null,detailStudentId:detail.feedback?.student_id||null,reloadStudentId:finalState.feedback?.student_id||null},identity.ok&&detail.feedback?.student_id===studentId&&finalState.feedback?.student_id===studentId);
  return finish();
}

if(import.meta.url===pathToFileURL(process.argv[1]).href){const report=await runPremiumWeeklyCheckinResponseSmoke({mask:value=>process.stdout.write(`::add-mask::${value}\n`)});console.log(JSON.stringify(report,null,2));if(report.status!=='VALIDATED')process.exitCode=1;}
