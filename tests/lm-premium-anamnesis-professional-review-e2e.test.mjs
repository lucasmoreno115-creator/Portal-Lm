import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import worker, { initializeSchemaForTests } from '../workers/api.js';
import { SqliteD1 } from './helpers/sqlite-d1.mjs';

const ENV={ADMIN_TOKEN:'admin-token',PREMIUM_PROFESSIONAL_WORKSPACE_ENABLED:'true'};
async function withDb(run){const dir=await mkdtemp(join(tmpdir(),'anamnesis-review-'));const db=new SqliteD1(join(dir,'test.db'));try{await initializeSchemaForTests(db);await run(db)}finally{db.close();await rm(dir,{recursive:true,force:true})}}
async function http(db,method,path,body,{student,admin=true}={}){const headers={'content-type':'application/json'};if(student){headers['x-student-email']=student.email;headers['x-student-token']=student.token}else if(admin)headers['x-admin-token']=ENV.ADMIN_TOKEN;const response=await worker.fetch(new Request(`https://portal.test${path}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body)}),{DB:db,...ENV});return{status:response.status,body:await response.json()}}
const one=(db,sql,...args)=>db.prepare(sql).bind(...args).first();
async function premium(db,name='review'){const email=`${name}@example.test`;const response=await http(db,'POST','/api/admin/premium/workspace/students',{name,email,whatsapp:'11999999999'});assert.equal(response.status,201);return{id:response.body.data.studentId,email,token:response.body.data.token}}

test('professional review persists analyzed_at and completes the real Premium lifecycle idempotently',async()=>withDb(async db=>{
 const student=await premium(db);const submitted=await http(db,'POST','/api/anamnese-premium',{answers:{goal:'Saúde'}},{student});assert.equal(submitted.status,200);const anamnesisId=submitted.body.data.id;
 assert.deepEqual(await one(db,'SELECT consultation_status FROM premium_students WHERE student_id=?',student.id),{consultation_status:'UNDER_REVIEW'});assert.equal((await one(db,'SELECT analyzed_at FROM premium_anamnesis WHERE id=?',anamnesisId)).analyzed_at,null);
 assert.deepEqual(await one(db,"SELECT status,related_entity_type,related_entity_id FROM premium_pending_items WHERE student_id=? AND type='ANALYZE_ANAMNESIS'",student.id),{status:'OPEN',related_entity_type:'premium_anamnesis',related_entity_id:anamnesisId});
 const before=await http(db,'GET','/api/admin/premium/workspace/summary');assert.ok(before.body.data.pendingItems.items.some(x=>x.relatedEntity?.id===anamnesisId));
 const analyzed=await http(db,'POST',`/api/admin/premium/anamnesis/${student.id}/analyze`,{});assert.equal(analyzed.status,200);assert.equal(analyzed.body.data.changed,true);assert.ok(analyzed.body.data.analyzed_at);const original=analyzed.body.data.analyzed_at;
 assert.deepEqual(await one(db,'SELECT analyzed_at FROM premium_anamnesis WHERE id=?',anamnesisId),{analyzed_at:original});assert.equal((await one(db,'SELECT consultation_status FROM premium_students WHERE student_id=?',student.id)).consultation_status,'UNDER_REVIEW');assert.equal((await one(db,"SELECT status FROM premium_pending_items WHERE related_entity_id=? AND type='ANALYZE_ANAMNESIS'",anamnesisId)).status,'RESOLVED');assert.equal((await one(db,"SELECT COUNT(*) total FROM activity_timeline WHERE event_type='ANAMNESIS_ANALYZED' AND student_id=?",student.id)).total,1);
 const after=await http(db,'GET','/api/admin/premium/workspace/summary');assert.equal(after.body.data.pendingItems.items.some(x=>x.relatedEntity?.id===anamnesisId),false);
 const retry=await http(db,'POST',`/api/admin/premium/anamnesis/${student.id}/analyze`,{});assert.deepEqual({changed:retry.body.data.changed,unchanged:retry.body.data.unchanged,analyzed_at:retry.body.data.analyzed_at},{changed:false,unchanged:true,analyzed_at:original});assert.equal((await one(db,"SELECT COUNT(*) total FROM activity_timeline WHERE event_type='ANAMNESIS_ANALYZED' AND student_id=?",student.id)).total,1);assert.deepEqual(await one(db,"SELECT COUNT(*) total,status FROM premium_pending_items WHERE related_entity_id=? AND type='ANALYZE_ANAMNESIS'",anamnesisId),{total:1,status:'RESOLVED'});
 assert.equal((await http(db,'POST',`/api/admin/premium/workspace/students/${student.id}/mark-ready`,{})).status,200);assert.equal((await one(db,'SELECT consultation_status FROM premium_students WHERE student_id=?',student.id)).consultation_status,'READY_TO_RELEASE');assert.equal((await http(db,'POST',`/api/admin/premium/workspace/students/${student.id}/release`,{})).status,200);assert.equal((await one(db,'SELECT consultation_status FROM premium_students WHERE student_id=?',student.id)).consultation_status,'ACTIVE');
}));

test('analyze command rejects unauthenticated, missing Premium/anamnesis, and Project LM identities',async()=>withDb(async db=>{
 const noAnamnesis=await premium(db,'empty');assert.equal((await http(db,'POST',`/api/admin/premium/anamnesis/${noAnamnesis.id}/analyze`,{}, {admin:false})).status,401);assert.equal((await http(db,'POST','/api/admin/premium/anamnesis/missing/analyze',{})).status,404);assert.equal((await http(db,'POST',`/api/admin/premium/anamnesis/${noAnamnesis.id}/analyze`,{})).status,404);
 await db.prepare("INSERT INTO student_access(id,name,email,access_token,status,plan_type,plan,student_id,created_at) VALUES('project','Project','project@example.test','token','ACTIVE','PROJECT_LM','projeto_lm','project-id','2026-08-13')").run();assert.equal((await http(db,'POST','/api/admin/premium/anamnesis/project-id/analyze',{})).status,404);
}));
