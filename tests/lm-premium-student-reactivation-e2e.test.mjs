import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import worker, { initializeSchemaForTests } from '../workers/api.js';
import { SqliteD1 } from './helpers/sqlite-d1.mjs';

const ENV={ADMIN_TOKEN:'admin-token',PREMIUM_PROFESSIONAL_WORKSPACE_ENABLED:'true'};
async function withDb(run){const dir=await mkdtemp(join(tmpdir(),'student-reactivation-'));const db=new SqliteD1(join(dir,'test.db'));try{await initializeSchemaForTests(db);await run(db)}finally{db.close();await rm(dir,{recursive:true,force:true})}}
async function http(db,method,path,body,{student,admin=true}={}){const headers={'content-type':'application/json'};if(student){headers['x-student-email']=student.email;headers['x-student-token']=student.token}else if(admin)headers['x-admin-token']=ENV.ADMIN_TOKEN;const response=await worker.fetch(new Request(`https://portal.test${path}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body)}),{DB:db,...ENV});return{status:response.status,body:await response.json()}}
const one=(db,sql,...args)=>db.prepare(sql).bind(...args).first();
async function premium(db,name='reactivate'){const email=`${name}@example.test`;const response=await http(db,'POST','/api/admin/premium/workspace/students',{name,email,whatsapp:'11999999999'});assert.equal(response.status,201);const student={id:response.body.data.studentId,email,token:response.body.data.token};await db.prepare("UPDATE premium_students SET consultation_status='ACTIVE' WHERE student_id=?").bind(student.id).run();return student}

test('real HTTP lifecycle reversibly restores the same operational work and Premium identity',async()=>withDb(async db=>{
 const student=await premium(db), now='2026-08-14T12:00:00.000Z';
 await db.prepare("INSERT INTO student_checkins(id,student_id,student_email,week_ref,coach_status,submitted_at,created_at) VALUES('checkin',?,?,?,'pending',?,?)").bind(student.id,student.email,'2026-W33',now,now).run();
 await db.prepare("INSERT INTO premium_anamnesis(id,student_id,student_name,student_email,status,answers_json,created_at,updated_at) VALUES('anamnesis',?,'Reactivate',?,'RECEBIDA','{}',?,?)").bind(student.id,student.email,now,now).run();
 for(const [id,type] of [['feedback-pending','ANALYZE_WEEKLY_FEEDBACK'],['plan-pending','CREATE_NUTRITION_PLAN']]) await db.prepare("INSERT INTO premium_pending_items(id,student_id,type,title,status,priority,source,created_at,updated_at) VALUES(?,?,?,'Trabalho preservado','OPEN','NORMAL','test',?,?)").bind(id,student.id,type,now,now).run();
 const snapshot=async()=>{const response=await http(db,'GET','/api/admin/premium/workspace/summary');assert.equal(response.status,200);return response.body.data};
 const active=await snapshot();assert.equal(active.pendingItems.open,2);assert.equal(active.checkins.awaitingReview,1);assert.deepEqual(active.indicators,{...active.indicators,openPendingItems:2,feedbacksAwaitingAnalysis:1,plansPendingUpdate:1,anamnesesAwaitingAnalysis:1});
 const accessBefore=await one(db,'SELECT * FROM student_access WHERE student_id=?',student.id);
 const ended=await http(db,'POST',`/api/admin/premium/workspace/students/${student.id}/deactivate`,{});assert.equal(ended.status,200);
 assert.equal((await http(db,'GET','/api/portal/premium/weekly-feedback/current',undefined,{student})).status,403);
 const hidden=await snapshot();assert.equal(hidden.pendingItems.open,0);assert.equal(hidden.checkins.awaitingReview,0);for(const key of ['openPendingItems','feedbacksAwaitingAnalysis','plansPendingUpdate','anamnesesAwaitingAnalysis'])assert.equal(hidden.indicators[key],0);
 assert.equal((await one(db,"SELECT COUNT(*) total FROM premium_pending_items WHERE status='OPEN' AND student_id=?",student.id)).total,2);
 const reactivated=await http(db,'POST',`/api/admin/premium/workspace/students/${student.id}/reactivate`,{});assert.equal(reactivated.status,200);assert.equal(reactivated.body.data.changed,true);
 const restored=await snapshot();assert.equal(restored.pendingItems.open,active.pendingItems.open);assert.equal(restored.checkins.awaitingReview,active.checkins.awaitingReview);for(const key of ['openPendingItems','feedbacksAwaitingAnalysis','plansPendingUpdate','anamnesesAwaitingAnalysis'])assert.equal(restored.indicators[key],active.indicators[key]);
 const queue=await http(db,'GET',`/api/admin/premium/workspace/pending-items?student_id=${student.id}`);assert.deepEqual(queue.body.data.items.map(item=>item.id).sort(),['feedback-pending','plan-pending']);
 assert.equal((await one(db,"SELECT COUNT(*) total FROM premium_pending_items WHERE student_id=?",student.id)).total,2,'reactivation does not create pending items');
 const row=await one(db,'SELECT consultation_status,access_status,deactivated_at,reactivated_at FROM premium_students WHERE student_id=?',student.id);assert.deepEqual({status:row.consultation_status,access:row.access_status},{status:'ACTIVE',access:'ACTIVE'});assert.equal(row.deactivated_at,ended.body.data.deactivatedAt);assert.ok(row.reactivated_at);
 assert.notEqual((await http(db,'GET','/api/portal/premium/weekly-feedback/current',undefined,{student})).status,403);assert.deepEqual(await one(db,'SELECT * FROM student_access WHERE student_id=?',student.id),accessBefore);
 const retry=await http(db,'POST',`/api/admin/premium/workspace/students/${student.id}/reactivate`,{});assert.equal(retry.status,200);assert.equal(retry.body.data.changed,false);assert.equal(retry.body.data.reactivatedAt,row.reactivated_at);assert.equal((await one(db,"SELECT COUNT(*) total FROM activity_timeline WHERE student_id=? AND event_type='STUDENT_REACTIVATED'",student.id)).total,1);
}));

test('reactivation rejects unauthorized, missing, inconsistent and never-ended Premium identities',async()=>withDb(async db=>{
 const student=await premium(db,'invalid');
 assert.equal((await http(db,'POST',`/api/admin/premium/workspace/students/${student.id}/reactivate`,{}, {admin:false})).status,401);
 assert.equal((await http(db,'POST',`/api/admin/premium/workspace/students/${student.id}/reactivate`,{}, {student})).status,401);
 const active=await http(db,'POST',`/api/admin/premium/workspace/students/${student.id}/reactivate`,{});assert.equal(active.status,409);assert.equal(active.body.code,'INVALID_LIFECYCLE_TRANSITION');
 assert.equal((await http(db,'POST','/api/admin/premium/workspace/students/missing/reactivate',{})).status,404);
 await db.prepare("UPDATE premium_students SET consultation_status='ENDED',access_status='ACTIVE' WHERE student_id=?").bind(student.id).run();assert.equal((await http(db,'POST',`/api/admin/premium/workspace/students/${student.id}/reactivate`,{})).status,409);
}));

test('reactivating Premium leaves the same dual-product identity and Projeto LM profile untouched',async()=>withDb(async db=>{
 const student=await premium(db,'dual');await db.prepare("UPDATE student_access SET plan='projeto_lm',plan_type='PROJECT_LM' WHERE student_id=?").bind(student.id).run();
 const access=await one(db,'SELECT id,status FROM student_access WHERE student_id=?',student.id);await db.prepare("INSERT INTO project_lm_profiles(user_id,name,goal,sex,weight_kg,height_cm,nutrition_plan_code,created_at,updated_at) VALUES(?,'Dual','Continuar','female',60,165,'F60','2026-08-14','2026-08-14')").bind(access.id).run();
 const projectBefore=await one(db,'SELECT * FROM project_lm_profiles WHERE user_id=?',access.id);assert.equal((await http(db,'GET','/api/portal/project-lm/profile',undefined,{student})).status,200);assert.notEqual((await http(db,'GET','/api/portal/premium/weekly-feedback/current',undefined,{student})).status,403);
 await http(db,'POST',`/api/admin/premium/workspace/students/${student.id}/deactivate`,{});assert.equal((await http(db,'GET','/api/portal/premium/weekly-feedback/current',undefined,{student})).status,403);assert.equal((await http(db,'GET','/api/portal/project-lm/profile',undefined,{student})).status,200);
 await http(db,'POST',`/api/admin/premium/workspace/students/${student.id}/reactivate`,{});assert.notEqual((await http(db,'GET','/api/portal/premium/weekly-feedback/current',undefined,{student})).status,403);assert.equal((await http(db,'GET','/api/portal/project-lm/profile',undefined,{student})).status,200);
 assert.deepEqual(await one(db,'SELECT * FROM project_lm_profiles WHERE user_id=?',access.id),projectBefore);assert.equal((await one(db,'SELECT status FROM student_access WHERE student_id=?',student.id)).status,'ACTIVE');
}));

test('each real deactivate/reactivate cycle records a distinct event and latest timestamps',async()=>withDb(async db=>{
 const student=await premium(db,'cycles');
 for(let cycle=0;cycle<2;cycle++){assert.equal((await http(db,'POST',`/api/admin/premium/workspace/students/${student.id}/deactivate`,{})).body.data.changed,true);await new Promise(resolve=>setTimeout(resolve,2));assert.equal((await http(db,'POST',`/api/admin/premium/workspace/students/${student.id}/reactivate`,{})).body.data.changed,true);await new Promise(resolve=>setTimeout(resolve,2));}
 assert.equal((await one(db,"SELECT COUNT(*) total FROM activity_timeline WHERE student_id=? AND event_type='STUDENT_DEACTIVATED'",student.id)).total,2);
 assert.equal((await one(db,"SELECT COUNT(*) total FROM activity_timeline WHERE student_id=? AND event_type='STUDENT_REACTIVATED'",student.id)).total,2);
}));
