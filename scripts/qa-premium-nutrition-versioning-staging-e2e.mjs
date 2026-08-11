#!/usr/bin/env node
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { request } from './qa-sprint7-staging-e2e.mjs';
import { uniqueQaIdentity, validateCreation } from './qa-premium-entry-staging-e2e.mjs';
import { createQaAnswers, validateSubmit } from './qa-premium-anamnesis-staging-e2e.mjs';
import { createObjectives, validateDecision, validateObjectivesSave, EXPECTED_AFTER_DECISION } from './qa-premium-objectives-staging-e2e.mjs';

export const VERSIONING_CALLS=new Set([
  'POST /api/admin/premium/workspace/students','POST /api/portal/login','GET /api/portal/premium/access-state','POST /api/anamnese-premium',
  'PUT /api/admin/premium/students/:studentId/planning-objectives','PATCH /api/admin/premium/students/:studentId/status',
  'GET /api/admin/premium/students/:studentId/nutrition-plan','POST /api/admin/premium/students/:studentId/nutrition-plan/draft',
  'PATCH /api/admin/premium/nutrition-plans/:planId/draft','POST /api/admin/premium/nutrition-plans/:planId/publish',
  'POST /api/admin/premium/nutrition-plans/:planId/duplicate-as-draft','GET /api/portal/nutrition-plan'
]);
const invalidId=value=>!value||['undefined','null','[object MouseEvent]','[object Object]'].includes(String(value));
const parse=result=>{try{return JSON.parse(result.responseBody||'');}catch{return null;}};
const payload=result=>parse(result)?.data;
function canonical(method,path){
  for(const [pattern,name] of [
    [/^\/api\/admin\/premium\/students\/[^/]+\/planning-objectives$/,'/api/admin/premium/students/:studentId/planning-objectives'],
    [/^\/api\/admin\/premium\/students\/[^/]+\/status$/,'/api/admin/premium/students/:studentId/status'],
    [/^\/api\/admin\/premium\/students\/[^/]+\/nutrition-plan$/,'/api/admin/premium/students/:studentId/nutrition-plan'],
    [/^\/api\/admin\/premium\/students\/[^/]+\/nutrition-plan\/draft$/,'/api/admin/premium/students/:studentId/nutrition-plan/draft'],
    [/^\/api\/admin\/premium\/nutrition-plans\/[^/]+\/(draft|publish|duplicate-as-draft)$/,'/api/admin/premium/nutrition-plans/:planId/$1']
  ])if(pattern.test(path))return `${method} ${name.replace('$1',path.split('/').at(-1))}`;
  return `${method} ${path}`;
}
export function validateVersioningCalls(calls){const unexpected=calls.map(x=>canonical(x.method||'GET',x.path)).filter(x=>!VERSIONING_CALLS.has(x));return {ok:unexpected.length===0,unexpected};}
export function validateCanonicalEditId(id){return {ok:!invalidId(id)&&typeof id==='string',id:invalidId(id)?null:id};}
export function validateVersionWorkflow(workflow,{v1Id,v2Id,v1Marker,v2Marker,phase}){
  const current=workflow?.current,draft=workflow?.draft,history=workflow?.history||[];
  if(phase==='draft')return {ok:current?.id===v1Id&&current.status==='PUBLISHED'&&draft?.id===v2Id&&v2Id!==v1Id&&draft.status==='DRAFT'&&JSON.stringify(current).includes(v1Marker)&&!JSON.stringify(current).includes(v2Marker)&&JSON.stringify(draft).includes(v2Marker),current,draft,history};
  const old=history.find(x=>x.id===v1Id);
  return {ok:current?.id===v2Id&&current.status==='PUBLISHED'&&draft==null&&Number(current.version_number)>Number(old?.version_number)&&old?.status==='ARCHIVED'&&JSON.stringify(old).includes(v1Marker)&&!JSON.stringify(old).includes(v2Marker),current,draft,history,old};
}
export function validatePortalVersion(result,{planId,present,absent}){const plan=payload(result),text=JSON.stringify(plan||{});return {ok:result.ok&&result.status===200&&plan?.id===planId&&text.includes(present)&&!text.includes(absent)&&plan.status!=='DRAFT'&&!Object.hasOwn(plan||{},'draft'),planId:plan?.id||null,present:text.includes(present),absent:!text.includes(absent)};}

export async function runPremiumNutritionVersioningSmoke({env=process.env,requestFn,mask=()=>{}}={}){
  const started=Date.now(),rows=[],calls=[],base=String(env.QA_BASE_URL||'').replace(/\/+$/,'');
  const add=(flow,expected,evidence,ok)=>rows.push({flow,expected,evidence,status:ok?'PASSED':'FAILED'});
  const perform=requestFn||((path,options)=>request(base,path,options));
  const call=async(path,options={})=>{calls.push({path,method:options.method||'GET'});return perform(path,options);};
  const finish=()=>{const isolation=validateVersioningCalls(calls);add('project-lm-isolation','allowlist contém somente contratos Premium',{unexpectedCalls:isolation.unexpected},isolation.ok);return {flow:'Premium nutrition versioning F1.8.1',environment:'staging',status:rows.every(x=>x.status==='PASSED')?'VALIDATED':'NOT_VALIDATED',durationMs:Date.now()-started,columns:['Fluxo','Resultado esperado','Evidência','Status'],rows};};
  let target;try{target=new URL(base);}catch{} const safe=env.QA_TARGET_ENVIRONMENT==='staging'&&target?.protocol==='https:'&&target.hostname!=='portal.lucasmorenopersonal.com.br'&&env.QA_ADMIN_SESSION;
  if(!safe){add('fixture-v1-active','target staging seguro e sessão presentes',{code:'UNSAFE_OR_INCOMPLETE_TARGET'},false);return finish();}
  mask(env.QA_ADMIN_SESSION);const run=env.GITHUB_RUN_ID||Date.now(),attempt=env.GITHUB_RUN_ATTEMPT||'1',v1Marker=`QA-F1.8.1-V1-${run}-${attempt}`,v2Marker=`QA-F1.8.1-V2-${run}-${attempt}`;
  const email=uniqueQaIdentity({runId:`${run}-versioning`,attempt});mask(email);const ah={'x-admin-session':env.QA_ADMIN_SESSION};
  const created=await call('/api/admin/premium/workspace/students',{method:'POST',headers:ah,expectedStatus:[200,201],body:{name:'QA Premium Versioning',email}}),creation=validateCreation(parse(created),email);
  if(!created.ok||!creation.ok){add('fixture-v1-active','fixture Premium única criada',{httpStatus:created.status},false);return finish();}
  const {studentId,token}=creation.data;mask(token);const sh={'x-student-email':email,'x-student-token':token};
  const login=await call('/api/portal/login',{method:'POST',expectedStatus:[200],body:{email,token}});
  const before=await call('/api/portal/premium/access-state',{headers:sh,expectedStatus:[200]});
  const submitted=await call('/api/anamnese-premium',{method:'POST',headers:sh,expectedStatus:[200],body:{answers:createQaAnswers(v1Marker)}});
  const objectives=createObjectives(v1Marker),saved=await call(`/api/admin/premium/students/${encodeURIComponent(studentId)}/planning-objectives`,{method:'PUT',headers:ah,expectedStatus:[200],body:objectives});
  const decided=await call(`/api/admin/premium/students/${encodeURIComponent(studentId)}/status`,{method:'PATCH',headers:ah,expectedStatus:[200],body:{status:EXPECTED_AFTER_DECISION}});
  const fixtureReady=login.ok&&payload(before)?.consultationStatus==='AWAITING_ANAMNESIS'&&validateSubmit(submitted).ok&&validateObjectivesSave(saved,objectives,studentId).ok&&validateDecision(decided,studentId).ok;
  if(!fixtureReady){add('fixture-v1-active','onboarding legítimo chega a READY_TO_RELEASE',{studentId},false);return finish();}
  const endpoint=`/api/admin/premium/students/${encodeURIComponent(studentId)}/nutrition-plan`;
  const draft1=payload(await call(`${endpoint}/draft`,{method:'POST',headers:ah,expectedStatus:[200],body:{plan:{title:`Plano ${v1Marker}`,meals:[],substitutions:[]}}}));
  const meal1=[{name:'Café da manhã',time:'07:00',guidance:v1Marker,primary_text:`Conteúdo ${v1Marker}`,items:[{food:v1Marker,quantity:'1',unit:'unidade'}],substitutions:[]}];
  const write1=await call(`/api/admin/premium/nutrition-plans/${encodeURIComponent(draft1?.id)}/draft`,{method:'PATCH',headers:ah,expectedStatus:[200],body:{student_id:studentId,title:`Plano ${v1Marker}`,meals:meal1,substitutions:[],adherence_rules:[],notes:v1Marker,expected_updated_at:draft1?.updated_at}});
  const pub1=payload(await call(`/api/admin/premium/nutrition-plans/${encodeURIComponent(draft1?.id)}/publish`,{method:'POST',headers:ah,expectedStatus:[200],body:{student_id:studentId}}));
  const released=await call(`/api/admin/premium/students/${encodeURIComponent(studentId)}/status`,{method:'PATCH',headers:ah,expectedStatus:[200],body:{status:'ACTIVE'}});
  const active=payload(await call('/api/portal/premium/access-state',{headers:sh,expectedStatus:[200]}))?.consultationStatus;
  const v1Id=pub1?.id,v1Version=pub1?.version_number,v1Ok=write1.ok&&!invalidId(v1Id)&&pub1?.status==='PUBLISHED'&&active==='ACTIVE'&&released.ok;
  add('fixture-v1-active','V1 publicada, liberada e lifecycle ACTIVE',{studentId,v1PlanId:v1Id,v1Version,lifecycle:active},v1Ok);if(!v1Ok)return finish();
  const baseline=payload(await call(endpoint,{headers:ah,expectedStatus:[200]})),portal1=validatePortalVersion(await call('/api/portal/nutrition-plan',{headers:sh,expectedStatus:[200]}),{planId:v1Id,present:v1Marker,absent:v2Marker});
  add('v1-baseline','profissional current e Portal confirmam V1',{currentId:baseline?.current?.id,portalPlanId:portal1.planId,publishedAt:baseline?.current?.published_at},baseline?.current?.id===v1Id&&portal1.ok);if(baseline?.current?.id!==v1Id||!portal1.ok)return finish();
  const canonicalId=validateCanonicalEditId(baseline.current.id),editPath=`/api/admin/premium/nutrition-plans/${encodeURIComponent(canonicalId.id)}/duplicate-as-draft`;
  const duplicate=await call(editPath,{method:'POST',headers:ah,expectedStatus:[200],body:{student_id:studentId,replace_existing_draft:false}}),draft2=payload(duplicate),v2Id=draft2?.id;
  add('published-edit-start','POST duplicate-as-draft recebe o planId canônico, nunca evento JS',{endpoint:'POST /api/admin/premium/nutrition-plans/:planId/duplicate-as-draft',sentId:canonicalId.id,httpStatus:duplicate.status},canonicalId.ok&&duplicate.ok&&!invalidId(v2Id));
  add('v2-draft-created','novo DRAFT possui ID distinto e V1 não é alterada',{v1PlanId:v1Id,v2PlanId:v2Id,status:draft2?.status,supersedesPlanId:draft2?.supersedes_plan_id??null},duplicate.ok&&v2Id!==v1Id&&draft2?.status==='DRAFT');if(!duplicate.ok||v2Id===v1Id)return finish();
  const meals2=[{...meal1[0],guidance:v2Marker,primary_text:`Conteúdo substituído ${v2Marker}`,items:[{food:v2Marker,quantity:'2',unit:'unidades'}]}];
  const edit2=await call(`/api/admin/premium/nutrition-plans/${encodeURIComponent(v2Id)}/draft`,{method:'PATCH',headers:ah,expectedStatus:[200],body:{student_id:studentId,title:`Plano ${v2Marker}`,meals:meals2,substitutions:[],adherence_rules:[],notes:v2Marker,expected_updated_at:draft2.updated_at}});
  const during=payload(await call(endpoint,{headers:ah,expectedStatus:[200]})),duringCheck=validateVersionWorkflow(during,{v1Id,v2Id,v1Marker,v2Marker,phase:'draft'});
  add('v2-edit-persistence','reload independente mantém V1 current e marker V2 somente no draft',{currentId:during?.current?.id,draftId:during?.draft?.id},edit2.ok&&duringCheck.ok);
  const portalDuring=validatePortalVersion(await call('/api/portal/nutrition-plan',{headers:sh,expectedStatus:[200]}),{planId:v1Id,present:v1Marker,absent:v2Marker});
  add('student-remains-on-v1','Portal ACTIVE continua em V1 e não vaza V2',{planId:portalDuring.planId,v1Present:portalDuring.present,v2Absent:portalDuring.absent},portalDuring.ok);if(!edit2.ok||!duringCheck.ok||!portalDuring.ok)return finish();
  const published2=payload(await call(`/api/admin/premium/nutrition-plans/${encodeURIComponent(v2Id)}/publish`,{method:'POST',headers:ah,expectedStatus:[200],body:{student_id:studentId}})),versionOk=published2?.id===v2Id&&published2?.status==='PUBLISHED'&&Number(published2.version_number)>Number(v1Version);
  add('v2-publish','V2 é publicada com versão estritamente maior',{v2PlanId:published2?.id,v1Version,v2Version:published2?.version_number,status:published2?.status},versionOk);
  const after=payload(await call(endpoint,{headers:ah,expectedStatus:[200]})),afterCheck=validateVersionWorkflow(after,{v1Id,v2Id,v1Marker,v2Marker,phase:'published'});
  add('professional-current-v2','current muda para V2 e não sobra draft',{currentId:after?.current?.id,draftPresent:Boolean(after?.draft)},afterCheck.ok);
  const portal2=validatePortalVersion(await call('/api/portal/nutrition-plan',{headers:sh,expectedStatus:[200]}),{planId:v2Id,present:v2Marker,absent:v1Marker});
  add('student-switches-to-v2','Portal muda atomicamente para V2',{planId:portal2.planId,v2Present:portal2.present,v1Absent:portal2.absent},portal2.ok);
  add('v1-history-preserved','history administrativo preserva ID, versão e marker V1 sem contaminação V2',{v1PlanId:afterCheck.old?.id,v1Version:afterCheck.old?.version_number,status:afterCheck.old?.status,historyCount:afterCheck.history?.length},afterCheck.ok);
  const lineageOk=published2?.supersedes_plan_id===v1Id;
  add('version-lineage','V2 referencia V1 por supersedes_plan_id',{supersedesPlanId:published2?.supersedes_plan_id,v1PlanId:v1Id},lineageOk);
  const lifecycleDuring=payload(await call('/api/portal/premium/access-state',{headers:sh,expectedStatus:[200]}))?.consultationStatus;
  add('lifecycle-stability','lifecycle permanece ACTIVE antes, durante e depois',{before:'ACTIVE',during:'ACTIVE',after:lifecycleDuring},lifecycleDuring==='ACTIVE');
  add('identity-consistency','todas as versões pertencem à fixture canônica',{studentId,v1StudentId:pub1?.student_id,v2StudentId:published2?.student_id},pub1?.student_id===studentId&&published2?.student_id===studentId);
  return finish();
}

if(import.meta.url===pathToFileURL(process.argv[1]).href){const report=await runPremiumNutritionVersioningSmoke({mask:value=>process.stdout.write(`::add-mask::${value}\n`)});console.log(JSON.stringify(report,null,2));if(report.status!=='VALIDATED')process.exitCode=1;}
