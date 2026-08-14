import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import worker, { initializeSchemaForTests } from '../workers/api.js';
import { SqliteD1 } from './helpers/sqlite-d1.mjs';

const ENV={ADMIN_TOKEN:'admin-token',PREMIUM_PROFESSIONAL_WORKSPACE_ENABLED:'true'};
async function withDb(run){const dir=await mkdtemp(join(tmpdir(),'student-deactivation-'));const db=new SqliteD1(join(dir,'test.db'));try{await initializeSchemaForTests(db);await run(db)}finally{db.close();await rm(dir,{recursive:true,force:true})}}
async function http(db,method,path,body,{student,admin=true}={}){const headers={'content-type':'application/json'};if(student){headers['x-student-email']=student.email;headers['x-student-token']=student.token}else if(admin)headers['x-admin-token']=ENV.ADMIN_TOKEN;const response=await worker.fetch(new Request(`https://portal.test${path}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body)}),{DB:db,...ENV});return{status:response.status,body:await response.json()}}
const one=(db,sql,...args)=>db.prepare(sql).bind(...args).first();
async function premium(db,name='ended'){const email=`${name}@example.test`;const response=await http(db,'POST','/api/admin/premium/workspace/students',{name,email,whatsapp:'11999999999'});assert.equal(response.status,201);const student={id:response.body.data.studentId,email,token:response.body.data.token};await db.prepare("UPDATE premium_students SET consultation_status='ACTIVE' WHERE student_id=?").bind(student.id).run();return student}

test('deactivation is atomic, durable, idempotent and immediately gates old Premium credentials without deleting history',async()=>withDb(async db=>{
 const student=await premium(db);const now='2026-08-14T12:00:00.000Z';
 await db.prepare("INSERT INTO student_checkins(id,student_id,student_email,week_ref,coach_status,submitted_at,created_at) VALUES('checkin',?,?,?,'pending',?,?)").bind(student.id,student.email,'2026-W33',now,now).run();
 await db.prepare("INSERT INTO premium_pending_items(id,student_id,type,title,status,priority,source,created_at,updated_at) VALUES('pending',?,'ANALYZE_WEEKLY_FEEDBACK','Analisar','OPEN','HIGH','weekly_feedback',?,?)").bind(student.id,now,now).run();
 await db.prepare("INSERT INTO nutrition_plans(id,student_id,student_email,title,status,is_active,version_number,meals_json,substitutions_json,adherence_rules_json,created_at,updated_at) VALUES('plan',?,?,'Plano','PUBLISHED',1,1,'[]','[]','[]',?,?)").bind(student.id,student.email,now,now).run();
 for(const path of ['/api/portal/premium/weekly-feedback/current','/api/portal/premium/nutrition-plan/current','/api/portal/weekly-plan']) assert.notEqual((await http(db,'GET',path,undefined,{student})).status,403);
 const first=await http(db,'POST',`/api/admin/premium/workspace/students/${student.id}/deactivate`,{});assert.equal(first.status,200);assert.equal(first.body.data.changed,true);const deactivatedAt=first.body.data.deactivatedAt;
 assert.deepEqual(await one(db,'SELECT consultation_status,access_status,deactivated_at FROM premium_students WHERE student_id=?',student.id),{consultation_status:'ENDED',access_status:'INACTIVE',deactivated_at:deactivatedAt});
 assert.equal((await one(db,'SELECT status FROM student_access WHERE student_id=?',student.id)).status,'ACTIVE','shared identity credential remains active');
 for(const path of ['/api/portal/premium/weekly-feedback/current','/api/portal/premium/nutrition-plan/current','/api/portal/weekly-plan']) assert.equal((await http(db,'GET',path,undefined,{student})).status,403);
 const summary=await http(db,'GET','/api/admin/premium/workspace/summary');assert.equal(summary.body.data.checkins.awaitingReview,0);assert.equal(summary.body.data.pendingItems.open,0);
 assert.equal((await one(db,"SELECT COUNT(*) total FROM student_checkins WHERE id='checkin'")).total,1);assert.equal((await one(db,"SELECT COUNT(*) total FROM premium_pending_items WHERE id='pending' AND status='OPEN'")).total,1);assert.equal((await one(db,"SELECT COUNT(*) total FROM nutrition_plans WHERE id='plan'")).total,1);
 const record=await http(db,'GET',`/api/admin/premium/students/${student.id}/record`);assert.equal(record.status,200);assert.equal(record.body.data.student.consultation_status,'ENDED');
 const students=await http(db,'GET','/api/admin/premium/workspace/students');assert.ok(students.body.data.items.some(x=>x.studentId===student.id));
 const retry=await http(db,'POST',`/api/admin/premium/workspace/students/${student.id}/deactivate`,{});assert.deepEqual({changed:retry.body.data.changed,unchanged:retry.body.data.unchanged,deactivatedAt:retry.body.data.deactivatedAt},{changed:false,unchanged:true,deactivatedAt});
 assert.equal((await one(db,"SELECT COUNT(*) total FROM activity_timeline WHERE student_id=? AND event_type='STUDENT_DEACTIVATED'",student.id)).total,1);
}));

test('command authorization, canonical identity boundary, early lifecycle and shared Project LM access isolation',async()=>withDb(async db=>{
 const review=await premium(db,'review');await db.prepare("UPDATE premium_students SET consultation_status='UNDER_REVIEW' WHERE student_id=?").bind(review.id).run();
 assert.equal((await http(db,'POST',`/api/admin/premium/workspace/students/${review.id}/deactivate`,{}, {student:review})).status,401);
 assert.equal((await http(db,'POST',`/api/admin/premium/workspace/students/${review.id}/deactivate`,{}, {admin:false})).status,401);
 assert.equal((await http(db,'POST','/api/admin/premium/workspace/students/missing/deactivate',{})).status,404);
 const ended=await http(db,'POST',`/api/admin/premium/workspace/students/${review.id}/deactivate`,{});assert.equal(ended.status,200);
 await db.prepare("INSERT INTO student_access(id,name,email,access_token,status,plan_type,plan,student_id,created_at) VALUES('project','Project','project@example.test','project-token','ACTIVE','PROJECT_LM','projeto_lm','project-id','2026-08-14')").run();
 assert.equal((await http(db,'POST','/api/admin/premium/workspace/students/project-id/deactivate',{})).status,404);
 const project={email:'project@example.test',token:'project-token'};assert.notEqual((await http(db,'GET','/api/project-lm/journey',undefined,{student:project})).status,401);
 assert.equal((await one(db,"SELECT status FROM student_access WHERE id='project'")).status,'ACTIVE');
}));
