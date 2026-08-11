#!/usr/bin/env node
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { request } from './qa-sprint7-staging-e2e.mjs';
import { uniqueQaIdentity, validateCreation } from './qa-premium-entry-staging-e2e.mjs';
import { createQaAnswers, validateSubmit } from './qa-premium-anamnesis-staging-e2e.mjs';
import { createObjectives, validateDecision, validateObjectivesSave, EXPECTED_AFTER_DECISION } from './qa-premium-objectives-staging-e2e.mjs';

export const PREMIUM_NUTRITION_PLAN_CALLS = new Set([
  'POST /api/admin/premium/workspace/students', 'POST /api/portal/login',
  'GET /api/portal/premium/access-state', 'POST /api/anamnese-premium',
  'PUT /api/admin/premium/students/:studentId/planning-objectives',
  'PATCH /api/admin/premium/students/:studentId/status',
  'GET /api/admin/premium/students/:studentId/nutrition-plan',
  'POST /api/admin/premium/students/:studentId/nutrition-plan/draft',
  'PATCH /api/admin/premium/nutrition-plans/:planId/draft',
  'POST /api/admin/premium/nutrition-plans/:planId/publish',
  'GET /api/portal/nutrition-plan',
]);
const productionHosts = new Set(['portal.lucasmorenopersonal.com.br']);
const invalidId = value => !value || ['undefined', 'null', '[object MouseEvent]'].includes(String(value));
const parse = result => { try { return JSON.parse(result.responseBody || ''); } catch { return null; } };
const data = result => parse(result)?.data;
const safeTarget = (env, base) => { try { const u = new URL(base); return env.QA_TARGET_ENVIRONMENT === 'staging' && u.protocol === 'https:' && !productionHosts.has(u.hostname.toLowerCase()); } catch { return false; } };
function canonicalCall(method, path) {
  if (/^\/api\/admin\/premium\/students\/[^/]+\/planning-objectives$/.test(path)) return `${method} /api/admin/premium/students/:studentId/planning-objectives`;
  if (/^\/api\/admin\/premium\/students\/[^/]+\/status$/.test(path)) return `${method} /api/admin/premium/students/:studentId/status`;
  if (/^\/api\/admin\/premium\/students\/[^/]+\/nutrition-plan$/.test(path)) return `${method} /api/admin/premium/students/:studentId/nutrition-plan`;
  if (/^\/api\/admin\/premium\/students\/[^/]+\/nutrition-plan\/draft$/.test(path)) return `${method} /api/admin/premium/students/:studentId/nutrition-plan/draft`;
  if (/^\/api\/admin\/premium\/nutrition-plans\/[^/]+\/draft$/.test(path)) return `${method} /api/admin/premium/nutrition-plans/:planId/draft`;
  if (/^\/api\/admin\/premium\/nutrition-plans\/[^/]+\/publish$/.test(path)) return `${method} /api/admin/premium/nutrition-plans/:planId/publish`;
  return `${method} ${path}`;
}
export function validatePremiumNutritionPlanCalls(calls) { const unexpected = calls.map(x => canonicalCall(x.method || 'GET', x.path)).filter(x => !PREMIUM_NUTRITION_PLAN_CALLS.has(x)); return { ok: unexpected.length === 0, unexpected }; }
// POST create/publish, professional GET and draft PATCH all use
// presentAdminNutritionPlan. Its HTTP shape includes identity, lifecycle status,
// version_number, published_at and published_by, but deliberately omits the
// persistence-only is_active column. Activation is therefore established by the
// independent professional current read and the authenticated portal read below.
export function validateDraft(result, studentId) { const body=parse(result), plan=body?.data; return { ok:result.ok&&result.status===200&&body?.ok===true&&!invalidId(plan?.id)&&plan?.student_id===studentId&&plan?.status==='DRAFT', planId:plan?.id||null, plan }; }
export function validateWrite(result, { planId, studentId, marker, deletedMarker=null, editedMarker=null }) { const body=parse(result), plan=body?.data, serialized=JSON.stringify(plan?.meals||[]); return { ok:result.ok&&result.status===200&&body?.ok===true&&plan?.id===planId&&plan?.student_id===studentId&&plan?.status==='DRAFT'&&serialized.includes(marker)&&(!deletedMarker||!serialized.includes(deletedMarker))&&(!editedMarker||serialized.includes(editedMarker)), plan }; }
export function validatePublish(result, { planId, studentId }) { const body=parse(result), plan=body?.data; return { ok:result.ok&&result.status===200&&body?.ok===true&&!invalidId(plan?.id)&&plan?.id===planId&&plan?.student_id===studentId&&plan?.status==='PUBLISHED'&&Number(plan?.version_number)>0, plan }; }
export function validateProfessionalCurrent(result, { planId, studentId, version, marker, editedMarker, deletedMarker }) { const body=parse(result), workflow=body?.data, current=workflow?.current, serialized=JSON.stringify(current?.meals||[]), identityOk=!Object.hasOwn(current||{},'student_id')||current.student_id===studentId; return { ok:result.ok&&result.status===200&&body?.ok===true&&current!=null&&current.id===planId&&identityOk&&current.status==='PUBLISHED'&&Number(current.version_number)===Number(version)&&Number(version)>0&&workflow.draft==null&&serialized.includes(marker)&&serialized.includes(editedMarker)&&!serialized.includes(deletedMarker), current, workflow }; }
export function validatePreReleaseStudentPlan(result) { const body=parse(result); return { ok:result.status===403&&body?.ok===false, body }; }
export function validateRelease(result, { studentId, from='READY_TO_RELEASE', to='ACTIVE' }) { const body=parse(result), release=body?.data; return { ok:result.ok&&result.status===200&&body?.ok===true&&release?.student_id===studentId&&release?.from===from&&release?.to===to&&release?.unchanged!==true, release }; }
export function validateReleasedLifecycle(result, { studentId, releaseStudentId }) { const body=parse(result), state=body?.data; return { ok:result.ok&&result.status===200&&body?.ok===true&&releaseStudentId===studentId&&state?.consultationStatus==='ACTIVE'&&state?.experience==='PREMIUM_PORTAL', state }; }
export function validateStudentPlan(result, { marker, editedMarker, deletedMarker, version }) { const body=parse(result), plan=body?.data, serialized=JSON.stringify(plan||{}); return { ok:result.ok&&result.status===200&&body?.ok===true&&plan?.status==='PUBLISHED'&&Number(plan?.version_number)===Number(version)&&Number(version)>0&&serialized.includes(marker)&&serialized.includes(editedMarker)&&!serialized.includes(deletedMarker)&&!serialized.includes('DRAFT'), plan }; }

export async function runPremiumNutritionPlanSmoke({ env=process.env, requestFn, mask=()=>{} }={}) {
  const startedAt=Date.now(), rows=[], calls=[], base=String(env.QA_BASE_URL||'').trim().replace(/\/+$/,'');
  const add=(flow,expected,evidence,status)=>rows.push({flow,expected,evidence,status});
  const perform=requestFn||((path,options)=>request(base,path,options));
  const call=async(path,options={})=>{calls.push({path,method:options.method||'GET'});return perform(path,options);};
  const finish=()=>{const isolation=validatePremiumNutritionPlanCalls(calls);add('project-lm-isolation','somente contratos Premium explicitamente permitidos',{unexpectedCalls:isolation.unexpected.length},isolation.ok?'PASSED':'FAILED');return {flow:'Premium nutrition planning F1.8',environment:'staging',status:rows.every(x=>x.status==='PASSED')?'VALIDATED':'NOT_VALIDATED',durationMs:Date.now()-startedAt,columns:['Fluxo','Resultado esperado','Evidência','Status'],rows};};
  if(!safeTarget(env,base)||!env.QA_ADMIN_SESSION){add('fixture-ready','staging seguro e sessão administrativa',{code:'UNSAFE_OR_INCOMPLETE_TARGET'},'FAILED');return finish();}
  mask(env.QA_ADMIN_SESSION);const email=uniqueQaIdentity({runId:`${env.GITHUB_RUN_ID||'local'}-nutrition`,attempt:env.GITHUB_RUN_ATTEMPT});mask(email);
  const marker=`QA-F1.8-${env.GITHUB_RUN_ID||Date.now()}-${env.GITHUB_RUN_ATTEMPT||'1'}`, editedMarker=`${marker}-EDITADO`, deletedMarker=`${marker}-EXCLUIR`;
  const adminHeaders={'x-admin-session':env.QA_ADMIN_SESSION};
  const created=await call('/api/admin/premium/workspace/students',{method:'POST',headers:adminHeaders,expectedStatus:[200,201],body:{name:'QA Premium Nutrition',email}}), creation=validateCreation(parse(created),email);
  if(!created.ok||!creation.ok){add('fixture-ready','fixture Premium criada legitimamente',{httpStatus:created.status,code:creation.code||'CREATE_FAILED'},'FAILED');return finish();}
  const {studentId,token}=creation.data;mask(token);const studentHeaders={'x-student-email':email,'x-student-token':token};
  const login=await call('/api/portal/login',{method:'POST',expectedStatus:[200],body:{email,token}});
  const accessBefore=await call('/api/portal/premium/access-state',{headers:studentHeaders,expectedStatus:[200]});
  const submitted=await call('/api/anamnese-premium',{method:'POST',headers:studentHeaders,expectedStatus:[200],body:{answers:createQaAnswers(marker)}}), submit=validateSubmit(submitted);
  const objectives=createObjectives(marker), objectiveResult=await call(`/api/admin/premium/students/${encodeURIComponent(studentId)}/planning-objectives`,{method:'PUT',headers:adminHeaders,expectedStatus:[200],body:objectives}), objective=validateObjectivesSave(objectiveResult,objectives,studentId);
  const decisionResult=await call(`/api/admin/premium/students/${encodeURIComponent(studentId)}/status`,{method:'PATCH',headers:adminHeaders,expectedStatus:[200],body:{status:EXPECTED_AFTER_DECISION}}), decision=validateDecision(decisionResult,studentId);
  const readyResult=await call('/api/portal/premium/access-state',{headers:studentHeaders,expectedStatus:[200]}), lifecycle=data(readyResult)?.consultationStatus;
  const fixtureOk=login.ok&&data(accessBefore)?.consultationStatus==='AWAITING_ANAMNESIS'&&submit.ok&&objective.ok&&decision.ok&&lifecycle===EXPECTED_AFTER_DECISION;
  add('fixture-ready','fixture chega legitimamente a READY_TO_RELEASE',{studentId,lifecycle,httpStatus:readyResult.status},fixtureOk?'PASSED':'FAILED');if(!fixtureOk)return finish();
  const endpoint=`/api/admin/premium/students/${encodeURIComponent(studentId)}/nutrition-plan`;
  const initial=await call(endpoint,{headers:adminHeaders,expectedStatus:[200]}), initialData=data(initial), initialOk=initial.ok&&initialData?.current==null&&initialData?.draft==null;
  add('planning-initial-state','sem versão publicada ou rascunho',{httpStatus:initial.status,current:Boolean(initialData?.current),draft:Boolean(initialData?.draft)},initialOk?'PASSED':'FAILED');if(!initialOk)return finish();
  const draftResult=await call(`${endpoint}/draft`,{method:'POST',headers:adminHeaders,expectedStatus:[200],body:{plan:{title:`Plano ${marker}`,meals:[],substitutions:[]}}}), draft=validateDraft(draftResult,studentId);
  const draftBody=parse(draftResult), draftData=draftBody?.data, hasIsActive=Boolean(draftData&&Object.hasOwn(draftData,'is_active'));
  add('draft-create','rascunho criado com ID canônico, identidade e status DRAFT',{httpStatus:draftResult.status,planId:draft.planId,status:draft.plan?.status||null,hasStudentId:Boolean(draftData&&Object.hasOwn(draftData,'student_id')),hasIsActive,isActiveType:hasIsActive?typeof draftData.is_active:'absent',isActive:hasIsActive?draftData.is_active:null,topLevelKeys:draftBody&&typeof draftBody==='object'?Object.keys(draftBody).sort():[],dataKeys:draftData&&typeof draftData==='object'?Object.keys(draftData).sort():[]},draft.ok?'PASSED':'FAILED');if(!draft.ok)return finish();
  const mealPayload=[
    {name:'Café da manhã',time:'07:00',guidance:marker,primary_text:`Café QA ${marker}`,items:[{food:`Aveia ${marker}`,quantity:'40',unit:'g'},{food:`Banana ${marker}`,quantity:'1',unit:'unidade'}],substitutions:[]},
    {name:'Almoço',time:'12:00',guidance:marker,primary_text:`Almoço QA ${marker}`,items:[],substitutions:[]},
    {name:deletedMarker,time:'16:00',primary_text:deletedMarker,items:[],substitutions:[]},
  ];
  const writePath=`/api/admin/premium/nutrition-plans/${encodeURIComponent(draft.planId)}/draft`;
  const firstWriteResult=await call(writePath,{method:'PATCH',headers:adminHeaders,expectedStatus:[200],body:{student_id:studentId,title:`Plano ${marker}`,meals:mealPayload,substitutions:[],adherence_rules:[],notes:marker,expected_updated_at:draft.plan.updated_at}}), firstWrite=validateWrite(firstWriteResult,{planId:draft.planId,studentId,marker});
  const firstMeals=firstWrite.plan?.meals||[], idsOk=firstMeals.length===3&&firstMeals.every(meal=>!invalidId(meal.id));
  add('meal-create','Adicionar refeição persiste tipo, ordem e IDs',{httpStatus:firstWriteResult.status,mealIds:firstMeals.map(x=>x.id),mealCount:firstMeals.length},firstWrite.ok&&idsOk?'PASSED':'FAILED');
  const itemCount=firstMeals.reduce((n,m)=>n+(m.items?.length||0),0);add('item-create','dois alimentos estruturados persistem',{itemCount},firstWrite.ok&&itemCount===2?'PASSED':'FAILED');if(!firstWrite.ok||!idsOk||itemCount!==2)return finish();
  const reload1=await call(endpoint,{headers:adminHeaders,expectedStatus:[200]}), reloadData=data(reload1), reloadDraft=reloadData?.draft, persistenceOk=reload1.ok&&reloadData?.current==null&&reloadDraft?.id===draft.planId&&reloadDraft?.status==='DRAFT'&&JSON.stringify(reloadDraft.meals).includes(marker)&&reloadDraft.meals?.length===3;
  add('draft-persistence','leitura profissional mantém o draft e não o expõe como current',{httpStatus:reload1.status,planId:reloadDraft?.id||null,status:reloadDraft?.status||null,currentPresent:Boolean(reloadData?.current),mealCount:reloadDraft?.meals?.length||0},persistenceOk?'PASSED':'FAILED');if(!persistenceOk)return finish();
  const editedMeals=reloadDraft.meals.slice(0,2).map((meal,index)=>index===0?{...meal,guidance:editedMarker}:meal);
  const editResult=await call(writePath,{method:'PATCH',headers:adminHeaders,expectedStatus:[200],body:{student_id:studentId,title:`Plano ${marker}`,meals:editedMeals,substitutions:reloadDraft.substitutions||[],adherence_rules:reloadDraft.adherence_rules||[],notes:marker,expected_updated_at:reloadDraft.updated_at}}), edit=validateWrite(editResult,{planId:draft.planId,studentId,marker,deletedMarker,editedMarker});
  const reload2=await call(endpoint,{headers:adminHeaders,expectedStatus:[200]}), finalDraft=data(reload2)?.draft, finalText=JSON.stringify(finalDraft?.meals||[]), editOk=edit.ok&&reload2.ok&&finalDraft?.id===draft.planId&&finalText.includes(editedMarker);
  add('meal-edit','PATCH usa planId real e edição sobrevive ao reload',{httpStatus:editResult.status,planId:draft.planId,markerPresent:finalText.includes(editedMarker)},editOk?'PASSED':'FAILED');
  const deleteOk=edit.ok&&finalDraft?.meals?.length===2&&!finalText.includes(deletedMarker)&&finalText.includes(marker);
  add('meal-delete','remoção elimina somente refeição descartável',{mealCount:finalDraft?.meals?.length||0,deletedMarkerPresent:finalText.includes(deletedMarker)},deleteOk?'PASSED':'FAILED');if(!editOk||!deleteOk)return finish();
  const publishResult=await call(`/api/admin/premium/nutrition-plans/${encodeURIComponent(draft.planId)}/publish`,{method:'POST',headers:adminHeaders,expectedStatus:[200],body:{student_id:studentId}}), published=validatePublish(publishResult,{planId:draft.planId,studentId});
  const publishBody=parse(publishResult), publishData=publishBody?.data, publishHasIsActive=Boolean(publishData&&Object.hasOwn(publishData,'is_active'));
  add('publish','publicação confirma identidade, status e versão',{httpStatus:publishResult.status,planId:published.plan?.id||null,status:published.plan?.status||null,version:published.plan?.version_number||null,publishedAtPresent:Boolean(published.plan?.published_at),hasIsActive:publishHasIsActive,isActiveType:publishHasIsActive?typeof publishData.is_active:'absent',isActive:publishHasIsActive?publishData.is_active:null,topLevelKeys:publishBody&&typeof publishBody==='object'?Object.keys(publishBody).sort():[],dataKeys:publishData&&typeof publishData==='object'?Object.keys(publishData).sort():[]},published.ok?'PASSED':'FAILED');if(!published.ok)return finish();
  const professional=await call(endpoint,{headers:adminHeaders,expectedStatus:[200]}), current=validateProfessionalCurrent(professional,{planId:draft.planId,studentId,version:published.plan.version_number,marker,editedMarker,deletedMarker});
  add('professional-reload','leitura profissional prova a versão publicada ativa e nenhum draft',{httpStatus:professional.status,currentId:current.current?.id||null,currentStatus:current.current?.status||null,currentVersion:current.current?.version_number||null,draftPresent:Boolean(current.workflow?.draft)},current.ok?'PASSED':'FAILED');
  const afterPublish=await call('/api/portal/premium/access-state',{headers:studentHeaders,expectedStatus:[200]}), afterLifecycle=data(afterPublish)?.consultationStatus;
  add('identity-consistency','writes usam studentId e publicação não libera acompanhamento',{studentId,planStudentId:published.plan?.student_id||null,lifecycleBefore:lifecycle,lifecycleAfter:afterLifecycle},published.plan?.student_id===studentId&&afterLifecycle===EXPECTED_AFTER_DECISION?'PASSED':'FAILED');
  if(!current.ok||published.plan?.student_id!==studentId||afterLifecycle!==EXPECTED_AFTER_DECISION)return finish();
  const unauth=await call('/api/portal/nutrition-plan',{expectedStatus:[401]});
  const preReleaseResult=await call('/api/portal/nutrition-plan',{headers:studentHeaders,expectedStatus:[403]}), preRelease=validatePreReleaseStudentPlan(preReleaseResult);
  add('student-plan-pre-release','sem autenticação é 401; em READY_TO_RELEASE o plano publicado permanece bloqueado',{unauthenticatedStatus:unauth.status,httpStatus:preReleaseResult.status,lifecycle:afterLifecycle},unauth.status===401&&preRelease.ok?'PASSED':'FAILED');
  if(unauth.status!==401||!preRelease.ok)return finish();
  const releaseResult=await call(`/api/admin/premium/students/${encodeURIComponent(studentId)}/status`,{method:'PATCH',headers:adminHeaders,expectedStatus:[200],body:{status:'ACTIVE'}}), release=validateRelease(releaseResult,{studentId});
  add('professional-release','ação real do Prontuário libera o acompanhamento com identidade e transição canônicas',{endpoint:'PATCH /api/admin/premium/students/:studentId/status',httpStatus:releaseResult.status,studentId:release.release?.student_id||null,from:release.release?.from||null,to:release.release?.to||null},release.ok?'PASSED':'FAILED');
  if(!release.ok)return finish();
  const afterReleaseResult=await call('/api/portal/premium/access-state',{headers:studentHeaders,expectedStatus:[200]}), releasedLifecycle=validateReleasedLifecycle(afterReleaseResult,{studentId,releaseStudentId:release.release.student_id});
  add('lifecycle-after-release','reload canônico confirma ACTIVE e experiência Premium',{studentId,lifecycle:releasedLifecycle.state?.consultationStatus||null,experience:releasedLifecycle.state?.experience||null},releasedLifecycle.ok?'PASSED':'FAILED');
  if(!releasedLifecycle.ok)return finish();
  const portal=await call('/api/portal/nutrition-plan',{headers:studentHeaders,expectedStatus:[200]}), studentPlan=validateStudentPlan(portal,{marker,editedMarker,deletedMarker,version:published.plan.version_number});
  add('student-plan-post-release','a mesma identidade recebe a versão publicada após a liberação',{httpStatus:portal.status,studentId,version:studentPlan.plan?.version_number||null,status:studentPlan.plan?.status||null},studentPlan.ok?'PASSED':'FAILED');
  add('content-consistency','Portal contém edição e marker, sem refeição excluída ou draft',{marker,editedMarkerPresent:JSON.stringify(studentPlan.plan||{}).includes(editedMarker),deletedMarkerPresent:JSON.stringify(studentPlan.plan||{}).includes(deletedMarker)},studentPlan.ok?'PASSED':'FAILED');
  return finish();
}

async function main(){const report=await runPremiumNutritionPlanSmoke({mask:value=>process.stderr.write(`::add-mask::${value}\n`)});console.log(JSON.stringify(report,null,2));process.exitCode=report.status==='VALIDATED'?0:1;}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
