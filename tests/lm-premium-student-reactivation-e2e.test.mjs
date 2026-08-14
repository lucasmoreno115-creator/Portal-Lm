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

test('real HTTP lifecycle restores the same Premium identity and preserved operational records idempotently',async()=>withDb(async db=>{
 const student=await premium(db), now='2026-08-14T12:00:00.000Z';
 await db.prepare("INSERT INTO premium_pending_items(id,student_id,type,title,status,priority,source,created_at,updated_at) VALUES('pending',?,'CREATE_NUTRITION_PLAN','Criar plano','OPEN','NORMAL','test',?,?)").bind(student.id,now,now).run();
 const accessBefore=await one(db,'SELECT * FROM student_access WHERE student_id=?',student.id);
 const ended=await http(db,'POST',`/api/admin/premium/workspace/students/${student.id}/deactivate`,{});assert.equal(ended.status,200);
 assert.equal((await http(db,'GET','/api/portal/premium/weekly-feedback/current',undefined,{student})).status,403);
 const reactivated=await http(db,'POST',`/api/admin/premium/workspace/students/${student.id}/reactivate`,{});assert.equal(reactivated.status,200);assert.equal(reactivated.body.data.changed,true);
 const row=await one(db,'SELECT consultation_status,access_status,deactivated_at,reactivated_at FROM premium_students WHERE student_id=?',student.id);
 assert.equal(row.consultation_status,'ACTIVE');assert.equal(row.access_status,'ACTIVE');assert.equal(row.deactivated_at,ended.body.data.deactivatedAt);assert.ok(row.reactivated_at);
 assert.notEqual((await http(db,'GET','/api/portal/premium/weekly-feedback/current',undefined,{student})).status,403);
 assert.deepEqual(await one(db,'SELECT * FROM student_access WHERE student_id=?',student.id),accessBefore);
 assert.equal((await one(db,"SELECT COUNT(*) total FROM premium_pending_items WHERE id='pending' AND status='OPEN'")).total,1);
 const retry=await http(db,'POST',`/api/admin/premium/workspace/students/${student.id}/reactivate`,{});assert.equal(retry.status,200);assert.equal(retry.body.data.changed,false);assert.equal(retry.body.data.reactivatedAt,row.reactivated_at);
 assert.equal((await one(db,"SELECT COUNT(*) total FROM activity_timeline WHERE student_id=? AND event_type='STUDENT_REACTIVATED'",student.id)).total,1);
 const record=await http(db,'GET',`/api/admin/premium/students/${student.id}/record`);assert.equal(record.body.data.student.reactivated_at,row.reactivated_at);
}));

test('reactivation rejects unauthorized, missing, inconsistent and never-ended Premium identities',async()=>withDb(async db=>{
 const student=await premium(db,'invalid');
 assert.equal((await http(db,'POST',`/api/admin/premium/workspace/students/${student.id}/reactivate`,{}, {admin:false})).status,401);
 assert.equal((await http(db,'POST',`/api/admin/premium/workspace/students/${student.id}/reactivate`,{}, {student})).status,401);
 const active=await http(db,'POST',`/api/admin/premium/workspace/students/${student.id}/reactivate`,{});assert.equal(active.status,409);assert.equal(active.body.code,'INVALID_LIFECYCLE_TRANSITION');
 assert.equal((await http(db,'POST','/api/admin/premium/workspace/students/missing/reactivate',{})).status,404);
 await db.prepare("UPDATE premium_students SET consultation_status='ENDED',access_status='ACTIVE' WHERE student_id=?").bind(student.id).run();assert.equal((await http(db,'POST',`/api/admin/premium/workspace/students/${student.id}/reactivate`,{})).status,409);
}));

test('each real deactivate/reactivate cycle records a distinct event and latest timestamps',async()=>withDb(async db=>{
 const student=await premium(db,'cycles');
 for(let cycle=0;cycle<2;cycle++){assert.equal((await http(db,'POST',`/api/admin/premium/workspace/students/${student.id}/deactivate`,{})).body.data.changed,true);await new Promise(resolve=>setTimeout(resolve,2));assert.equal((await http(db,'POST',`/api/admin/premium/workspace/students/${student.id}/reactivate`,{})).body.data.changed,true);await new Promise(resolve=>setTimeout(resolve,2));}
 assert.equal((await one(db,"SELECT COUNT(*) total FROM activity_timeline WHERE student_id=? AND event_type='STUDENT_DEACTIVATED'",student.id)).total,2);
 assert.equal((await one(db,"SELECT COUNT(*) total FROM activity_timeline WHERE student_id=? AND event_type='STUDENT_REACTIVATED'",student.id)).total,2);
}));
