import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createD1ProfessionalWorkspaceRepository } from '../workers/premium/repositories/d1-professional-workspace-repository.js';
import { createWeeklyFeedbackScheduleService } from '../workers/premium/services/weekly-feedback-schedule-service.js';

class SqliteD1 { constructor(file){this.file=file;this.calls=[];} prepare(sql){this.calls.push(sql);return new Stmt(this.file,sql);} }
class Stmt { constructor(file,sql,params=[]){this.file=file;this.sql=sql;this.params=params;} bind(...params){return new Stmt(this.file,this.sql,params);} sqlWithParams(){let i=0;return this.sql.replace(/\?/g,()=>sqlValue(this.params[i++]));} async run(){execFileSync('sqlite3',[this.file],{input:this.sqlWithParams()+';'});return{meta:{changes:1}};} async all(){const out=execFileSync('sqlite3',['-json',this.file,this.sqlWithParams()],{encoding:'utf8'}).trim();return{results:out?JSON.parse(out):[]};} async first(){return (await this.all()).results[0]??null;} }
function sqlValue(v){ if(v==null)return'NULL'; if(typeof v==='number')return String(v); return `'${String(v).replaceAll("'","''")}'`; }
async function withDb(fn){const dir=await mkdtemp(join(tmpdir(),'workspace-repo-'));const db=new SqliteD1(join(dir,'test.db'));try{await schema(db);await seed(db);await fn(db,createD1ProfessionalWorkspaceRepository(db,{scheduleService:createWeeklyFeedbackScheduleService()}));}finally{await rm(dir,{recursive:true,force:true});}}
async function schema(db){for(const sql of [`CREATE TABLE premium_students(student_id TEXT PRIMARY KEY,email TEXT,normalized_email TEXT,display_name TEXT,consultation_status TEXT,access_status TEXT,source TEXT,created_at TEXT,updated_at TEXT)`,`CREATE TABLE student_access(id TEXT PRIMARY KEY,name TEXT,email TEXT,whatsapp TEXT,status TEXT,plan_type TEXT,plan TEXT,student_id TEXT,created_at TEXT)`,`CREATE TABLE premium_pending_items(id TEXT PRIMARY KEY,student_id TEXT,type TEXT,title TEXT,description TEXT,status TEXT,priority TEXT,source TEXT,related_entity_type TEXT,related_entity_id TEXT,due_at TEXT,resolved_at TEXT,created_by TEXT,created_at TEXT,updated_at TEXT)`,`CREATE TABLE student_checkins(id TEXT PRIMARY KEY,student_id TEXT,student_email TEXT,week_ref TEXT,coach_status TEXT,reviewed_at TEXT,created_at TEXT)`,`CREATE TABLE nutrition_plans(id TEXT PRIMARY KEY,student_id TEXT,student_email TEXT,title TEXT,goal TEXT,status TEXT,is_active INTEGER,version_number INTEGER,published_at TEXT,source_feedback_id TEXT,updated_at TEXT)`,`CREATE TABLE premium_anamnesis(id TEXT PRIMARY KEY,student_id TEXT,status TEXT,created_at TEXT,updated_at TEXT)`,`CREATE TABLE premium_followup_entries(id TEXT PRIMARY KEY,student_id TEXT,entry_type TEXT,title TEXT,content TEXT,source TEXT,related_entity_type TEXT,related_entity_id TEXT,created_by TEXT,created_at TEXT,updated_at TEXT)`]) await db.prepare(sql).run();}
async function seed(db){
  const students=[['s1','ana@example.com','Ana Maria','ACTIVE','5511999988888'],['s2','bruno_pipe@example.com','Bruno | Pipe','ACTIVE','5511888877777'],['s3','carla@example.com','Carla Percent % _','UNDER_REVIEW','5511777766666'],['s4','old@example.com','Histórico Antigo','ACTIVE','5511666655555'],['p1','projeto@example.com','Projeto LM','ACTIVE','5511555544444']];
  for(const [id,email,name,status,phone] of students){await db.prepare(`INSERT INTO premium_students(student_id,email,normalized_email,display_name,consultation_status,access_status,source,created_at,updated_at) VALUES(?,?,?,?,?,'ACTIVE','TEST','2026-07-01','2026-07-01')`).bind(id,email,email,name,status).run();await db.prepare(`INSERT INTO student_access(id,name,email,whatsapp,status,plan_type,plan,student_id,created_at) VALUES(?,?,?,?,?,?,?,?,?)`).bind(`a-${id}`,name,email,phone,'ACTIVE',id==='p1'?'PROJECT_LM':'PREMIUM',id==='p1'?'projeto_lm':'premium',id,'2026-07-01').run();}
  await db.prepare(`DELETE FROM premium_students WHERE student_id='p1'`).run();
  await db.prepare(`INSERT INTO student_checkins(id,student_id,student_email,week_ref,coach_status,created_at) VALUES('old-fb','s4','old@example.com','2026-W28',NULL,'2026-07-10')`).run();
  await db.prepare(`INSERT INTO student_checkins(id,student_id,student_email,week_ref,coach_status,created_at) VALUES('current-open','s1','ana@example.com','2026-W29',NULL,'2026-07-18')`).run();
  await db.prepare(`INSERT INTO student_checkins(id,student_id,student_email,week_ref,coach_status,reviewed_at,created_at) VALUES('current-reviewed','s2','bruno_pipe@example.com','2026-W29','REVIEWED','2026-07-18T12:00:00Z','2026-07-18')`).run();
  await db.prepare(`INSERT INTO premium_pending_items(id,student_id,type,title,description,status,priority,source,related_entity_type,related_entity_id,created_at,updated_at) VALUES('pend-special','s2','MANUAL','Título com | barra "aspas"','Linha 1
<script>alert(1)</script>','OPEN','HIGH','manual',NULL,NULL,'2026-07-14','2026-07-14')`).run();
  await db.prepare(`INSERT INTO premium_pending_items(id,student_id,type,title,description,status,priority,source,related_entity_type,related_entity_id,created_at,updated_at) VALUES('decision-plan','s1','CREATE_NUTRITION_PLAN','Atualizar plano','Criada por conduta','OPEN','NORMAL','professional_decision','student_checkins','current-open','2026-07-18','2026-07-18')`).run();
}

test('workspace search covers name, missing name, email, phone, escaped wildcards and normalized spaces', async()=>withDb(async(_db,repo)=>{
  assert.deepEqual((await repo.searchStudents({q:' Ana   Maria '})).items.map(i=>i.student_id), ['s1']);
  assert.equal((await repo.searchStudents({q:'Nome Inexistente'})).items.length, 0);
  assert.deepEqual((await repo.searchStudents({q:'bruno_pipe@example.com'})).items.map(i=>i.student_id), ['s2']);
  assert.deepEqual((await repo.searchStudents({q:'99998888'})).items.map(i=>i.student_id), ['s1']);
  assert.equal((await repo.searchStudents({q:'Ana'})).items.some(i=>i.student_id==='s4'), false, 'busca alfabética não deve ativar LIKE telefônico %%');
  assert.deepEqual((await repo.searchStudents({q:'% _'})).items.map(i=>i.student_id), ['s3']);
}));

test('phone predicate is only added when there are enough digits and never binds %%', async()=>withDb(async(db,repo)=>{
  await repo.searchStudents({q:'abc'}); const alphaSql=db.calls.at(-1); assert.doesNotMatch(alphaSql,/whatsapp,''\)/);
  await repo.searchStudents({q:'12'}); const twoDigitsSql=db.calls.at(-1); assert.doesNotMatch(twoDigitsSql,/whatsapp,''\)/);
  await repo.searchStudents({q:'8888'}); const phoneSql=db.calls.at(-1); assert.match(phoneSql,/whatsapp,''\)/);
}));

test('summary uses current operational week instead of all feedback history', async()=>withDb(async(_db,repo)=>{
  const summary=await repo.getSummary({now:new Date('2026-07-18T15:00:00Z')});
  assert.equal(summary.weekRef,'2026-W29');
  assert.equal(summary.feedbacksAwaitingAnalysis,1);
  assert.equal(summary.studentsWithoutResponse,2);
}));

test('saturday review returns real current-week lists and excludes Projeto LM', async()=>withDb(async(_db,repo)=>{
  const review=await repo.getSaturdayReview({now:new Date('2026-07-18T15:00:00Z'),limit:10});
  assert.equal(review.weekRef,'2026-W29'); assert.equal(review.isSaturday,true);
  assert.deepEqual(review.feedbacksAwaitingAnalysis.map(i=>i.student_id), ['s1']);
  assert.deepEqual(review.feedbacksAnalyzed.map(i=>i.student_id), ['s2']);
  assert.ok(review.studentsWithoutResponse.some(i=>i.student_id==='s4'), 'histórico antigo não conta como resposta da semana atual');
  assert.equal(review.studentsWithoutResponse.some(i=>i.student_id==='p1'), false);
  assert.equal(review.pendingItemsCreatedByDecisions.length, 1);
  assert.equal(review.plansPendingUpdate.length, 1);
  assert.equal(JSON.stringify(review).includes('coach_reply'), false);
}));

test('official schedule keeps Friday/Sunday in same cycle and Monday in next cycle', async()=>withDb(async(_db,repo)=>{
  assert.equal((await repo.getSaturdayReview({now:new Date('2026-07-17T15:00:00Z')})).weekRef,'2026-W29');
  assert.equal((await repo.getSaturdayReview({now:new Date('2026-07-19T15:00:00Z')})).weekRef,'2026-W29');
  assert.equal((await repo.getSaturdayReview({now:new Date('2026-07-20T15:00:00Z')})).weekRef,'2026-W30');
}));

test('next pending read model does not split on pipes, quotes, newlines or malicious text', async()=>withDb(async(_db,repo)=>{
  const students=await repo.listStudents({student_id:'s2'}); const next=students.items[0].next_pending;
  assert.equal(next.title,'Título com | barra "aspas"');
  assert.equal(next.description,`Linha 1\n<script>alert(1)</script>`);
}));
