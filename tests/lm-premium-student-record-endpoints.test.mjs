import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import worker, { initializeSchemaForTests } from '../workers/api.js';
class SqliteD1 { constructor(file){this.file=file;} prepare(sql){return new Stmt(this.file,sql);} async batch(stmts){const out=[]; for(const s of stmts) out.push(await s.run()); return out;} }
class Stmt { constructor(file,sql,params=[]){this.file=file;this.sql=sql;this.params=params;} bind(...p){return new Stmt(this.file,this.sql,p);} sqlWithParams(){let i=0; return this.sql.replace(/\?/g,()=>sqlValue(this.params[i++]));} async run(){execFileSync('sqlite3',[this.file],{input:this.sqlWithParams()+';'}); return {meta:{changes:1}};} async all(){const out=execFileSync('sqlite3',['-json',this.file,this.sqlWithParams()],{encoding:'utf8'}).trim(); return {results:out?JSON.parse(out):[]};} async first(){return (await this.all()).results[0]??null;} }
function sqlValue(v){ if(v==null) return 'NULL'; if(typeof v==='number') return String(v); return `'${String(v).replaceAll("'","''")}'`; }
async function withDb(fn){ const dir=await mkdtemp(join(tmpdir(),'record-')); const db=new SqliteD1(join(dir,'test.db')); try{ await initializeSchemaForTests(db); await seed(db); await fn(db);} finally{await rm(dir,{recursive:true,force:true});}}
async function seed(db){ await db.prepare(`INSERT INTO student_access (id, name, email, access_token, status, plan_type, plan, whatsapp, student_id, created_at) VALUES ('a1','Student','student@example.com','tok','ACTIVE','PREMIUM','premium','5511999999999','student-1','2026-07-14T00:00:00.000Z')`).run(); await db.prepare(`INSERT INTO premium_students (student_id,email,normalized_email,display_name,consultation_status,access_status,source,created_at,updated_at) VALUES ('student-1','student@example.com','student@example.com','Student','ACTIVE','ACTIVE','TEST','2026-07-14T00:00:00.000Z','2026-07-14T00:00:00.000Z')`).run(); await db.prepare(`INSERT INTO premium_anamnesis (id, student_id, student_name, student_email, student_phone, status, answers_json, created_at, updated_at) VALUES ('anam-1','student-1','Student','student@example.com','55','RECEBIDA','{}','2026-07-14T00:01:00.000Z','2026-07-14T00:01:00.000Z')`).run(); await db.prepare(`INSERT INTO student_checkins (id, student_id, student_email, week_ref, created_at) VALUES ('fb-1','student-1','student@example.com','2026-W29','2026-07-14T00:02:00.000Z')`).run(); await db.prepare(`INSERT INTO student_checkins (id, student_id, student_email, week_ref, coach_status, created_at) VALUES ('fb-reviewed','student-1','student@example.com','2026-W28',' Reviewed ','2026-07-13T00:02:00.000Z')`).run(); }
async function api(db,method,path,body,admin=true){ const headers={'content-type':'application/json'}; if(admin) headers['x-admin-token']='admin-token'; const res=await worker.fetch(new Request(`https://portal.test${path}`,{method,headers,body:body?JSON.stringify(body):undefined}),{DB:db,ADMIN_TOKEN:'admin-token'}); return {status:res.status, body:await res.json()}; }

test('endpoints administrativos do Prontuário exigem admin e preservam contrato seguro', async()=>withDb(async(db)=>{
  assert.equal((await api(db,'GET','/api/admin/premium/students/student-1/record',null,false)).status,401);
  const record=await api(db,'GET','/api/admin/premium/students/student-1/record');
  assert.equal(record.status,200); assert.equal(record.body.ok,true); assert.equal(record.body.data.student.student_id,'student-1'); assert.equal(record.body.data.feedbacks.length,2); assert.equal(JSON.stringify(record.body).includes('access_token'),false); assert.ok(record.body.data.pending_items.length>=2);
  const entry=await api(db,'POST','/api/admin/premium/students/student-1/followup-entries',{entry_type:'PROFESSIONAL_NOTE',title:'Nota',content:'Ok'}); assert.equal(entry.status,201);
  const pending=await api(db,'POST','/api/admin/premium/students/student-1/pending-items',{type:'CUSTOM',title:'Contato'}); assert.equal(pending.status,201);
  const resolved=await api(db,'PATCH',`/api/admin/premium/pending-items/${pending.body.data.id}/resolve`); assert.equal(resolved.body.data.status,'RESOLVED');
  const status=await api(db,'PATCH','/api/admin/premium/students/student-1/status',{status:'PAUSED'}); assert.equal(status.body.data.to,'PAUSED');
  const decision=await api(db,'POST','/api/admin/premium/feedbacks/fb-1/decision',{decision_type:'KEEP_STRATEGY',note:'Manter'}); assert.equal(decision.body.data.decision_type,'KEEP_STRATEGY');
}));


test('pendências abertas são realmente idempotentes e permitem recriação após resolução', async()=>withDb(async(db)=>{
  await Promise.all([
    api(db,'POST','/api/admin/premium/students/student-1/pending-items',{type:'CUSTOM',title:'Contato'}),
    api(db,'POST','/api/admin/premium/students/student-1/pending-items',{type:'CUSTOM',title:'Contato duplicado'})
  ]);
  let count = await db.prepare(`SELECT COUNT(*) AS total FROM premium_pending_items WHERE student_id='student-1' AND type='CUSTOM' AND status='OPEN' AND related_entity_type IS NULL AND related_entity_id IS NULL`).first();
  assert.equal(count.total, 1);

  await api(db,'POST','/api/admin/premium/students/student-1/pending-items',{type:'CONTACT_STUDENT',title:'Feedback A',related_entity_type:'student_checkins',related_entity_id:'fb-1'});
  await api(db,'POST','/api/admin/premium/students/student-1/pending-items',{type:'CONTACT_STUDENT',title:'Feedback B',related_entity_type:'student_checkins',related_entity_id:'fb-reviewed'});
  count = await db.prepare(`SELECT COUNT(*) AS total FROM premium_pending_items WHERE student_id='student-1' AND type='CONTACT_STUDENT' AND status='OPEN'`).first();
  assert.equal(count.total, 2);

  const open = await db.prepare(`SELECT id FROM premium_pending_items WHERE student_id='student-1' AND type='CUSTOM' AND status='OPEN' LIMIT 1`).first();
  await api(db,'PATCH',`/api/admin/premium/pending-items/${open.id}/resolve`);
  await api(db,'POST','/api/admin/premium/students/student-1/pending-items',{type:'CUSTOM',title:'Contato reapareceu'});
  count = await db.prepare(`SELECT COUNT(*) AS total FROM premium_pending_items WHERE student_id='student-1' AND type='CUSTOM'`).first();
  assert.equal(count.total, 2);
  count = await db.prepare(`SELECT COUNT(*) AS total FROM premium_pending_items WHERE student_id='student-1' AND type='CUSTOM' AND status='OPEN'`).first();
  assert.equal(count.total, 1);
}));

test('GET record concorrente não duplica pendências automáticas e normaliza coach_status', async()=>withDb(async(db)=>{
  await Promise.all([
    api(db,'GET','/api/admin/premium/students/student-1/record'),
    api(db,'GET','/api/admin/premium/students/student-1/record')
  ]);
  const anamnesis = await db.prepare(`SELECT COUNT(*) AS total FROM premium_pending_items WHERE student_id='student-1' AND type='ANALYZE_ANAMNESIS' AND status='OPEN'`).first();
  assert.equal(anamnesis.total, 1);
  const pendingFeedback = await db.prepare(`SELECT COUNT(*) AS total FROM premium_pending_items WHERE student_id='student-1' AND type='ANALYZE_WEEKLY_FEEDBACK' AND related_entity_id='fb-1' AND status='OPEN'`).first();
  assert.equal(pendingFeedback.total, 1);
  const reviewedFeedback = await db.prepare(`SELECT COUNT(*) AS total FROM premium_pending_items WHERE student_id='student-1' AND type='ANALYZE_WEEKLY_FEEDBACK' AND related_entity_id='fb-reviewed' AND status='OPEN'`).first();
  assert.equal(reviewedFeedback.total, 0);
}));

test('status e decisão profissional usam batch e não duplicam evolução em retry', async()=>withDb(async(db)=>{
  const firstStatus = await api(db,'PATCH','/api/admin/premium/students/student-1/status',{status:'PAUSED'});
  assert.equal(firstStatus.status, 200);
  const retryStatus = await api(db,'PATCH','/api/admin/premium/students/student-1/status',{status:'PAUSED'});
  assert.equal(retryStatus.body.data.unchanged, true);
  let count = await db.prepare(`SELECT COUNT(*) AS total FROM premium_followup_entries WHERE student_id='student-1' AND entry_type='CONSULTATION_STATUS_CHANGE'`).first();
  assert.equal(count.total, 1);

  const firstDecision = await api(db,'POST','/api/admin/premium/feedbacks/fb-1/decision',{decision_type:'KEEP_STRATEGY',note:'Manter'});
  assert.equal(firstDecision.status, 200);
  const retryDecision = await api(db,'POST','/api/admin/premium/feedbacks/fb-1/decision',{decision_type:'KEEP_STRATEGY',note:'Manter'});
  assert.equal(retryDecision.body.data.unchanged, true);
  count = await db.prepare(`SELECT COUNT(*) AS total FROM premium_followup_entries WHERE student_id='student-1' AND entry_type='PROFESSIONAL_DECISION' AND related_entity_id='fb-1'`).first();
  assert.equal(count.total, 1);
}));
