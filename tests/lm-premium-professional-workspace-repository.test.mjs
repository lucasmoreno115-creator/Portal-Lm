import assert from 'node:assert/strict';
import test from 'node:test';
import { SqliteD1 } from './helpers/sqlite-d1.mjs';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createD1ProfessionalWorkspaceRepository } from '../workers/premium/repositories/d1-professional-workspace-repository.js';
import { createWeeklyFeedbackScheduleService } from '../workers/premium/services/weekly-feedback-schedule-service.js';

async function withDb(fn){const dir=await mkdtemp(join(tmpdir(),'workspace-repo-'));const db=new SqliteD1(join(dir,'test.db'));let testError;try{await schema(db);await seed(db);await fn(db,createD1ProfessionalWorkspaceRepository(db,{scheduleService:createWeeklyFeedbackScheduleService()}));}catch(error){testError=error;throw error;}finally{try{db.close();}catch(closeError){if(!testError)throw closeError;}await rm(dir,{recursive:true,force:true});}}
async function schema(db){for(const sql of [`CREATE TABLE premium_students(student_id TEXT PRIMARY KEY,email TEXT,normalized_email TEXT,display_name TEXT,consultation_status TEXT,access_status TEXT,source TEXT,created_at TEXT,updated_at TEXT)`,`CREATE TABLE student_access(id TEXT PRIMARY KEY,name TEXT,email TEXT,whatsapp TEXT,status TEXT,plan_type TEXT,plan TEXT,student_id TEXT,created_at TEXT)`,`CREATE TABLE premium_pending_items(id TEXT PRIMARY KEY,student_id TEXT,type TEXT,title TEXT,description TEXT,status TEXT,priority TEXT,source TEXT,related_entity_type TEXT,related_entity_id TEXT,due_at TEXT,resolved_at TEXT,created_by TEXT,created_at TEXT,updated_at TEXT)`,`CREATE TABLE student_checkins(id TEXT PRIMARY KEY,student_id TEXT,student_email TEXT,week_ref TEXT,coach_status TEXT,decision_type TEXT,coach_reply TEXT,reviewed_at TEXT,submitted_at TEXT,created_at TEXT)`,`CREATE TABLE nutrition_plans(id TEXT PRIMARY KEY,student_id TEXT,student_email TEXT,title TEXT,goal TEXT,status TEXT,is_active INTEGER,version_number INTEGER,published_at TEXT,source_feedback_id TEXT,updated_at TEXT)`,`CREATE TABLE premium_anamnesis(id TEXT PRIMARY KEY,student_id TEXT,student_email TEXT,status TEXT,created_at TEXT,updated_at TEXT)`,`CREATE TABLE premium_followup_entries(id TEXT PRIMARY KEY,student_id TEXT,entry_type TEXT,title TEXT,content TEXT,source TEXT,related_entity_type TEXT,related_entity_id TEXT,created_by TEXT,created_at TEXT,updated_at TEXT)`]) await db.prepare(sql).run();}
async function seed(db){
  const students=[['s1','ana@example.com','Ana Maria','ACTIVE','5511999988888'],['s2','bruno_pipe@example.com','Bruno | Pipe','ACTIVE','5511888877777'],['s3','carla@example.com','Carla Percent % _','UNDER_REVIEW','5511777766666'],['s4','old@example.com','Histórico Antigo','ACTIVE','5511666655555'],['p1','projeto@example.com','Projeto LM','ACTIVE','5511555544444']];
  for(const [id,email,name,status,phone] of students){await db.prepare(`INSERT INTO premium_students(student_id,email,normalized_email,display_name,consultation_status,access_status,source,created_at,updated_at) VALUES(?,?,?,?,?,'ACTIVE','TEST','2026-07-01','2026-07-01')`).bind(id,email,email,name,status).run();await db.prepare(`INSERT INTO student_access(id,name,email,whatsapp,status,plan_type,plan,student_id,created_at) VALUES(?,?,?,?,?,?,?,?,?)`).bind(`a-${id}`,name,email,phone,'ACTIVE',id==='p1'?'PROJECT_LM':'PREMIUM',id==='p1'?'projeto_lm':'premium',id,'2026-07-01').run();}
  await db.prepare(`DELETE FROM premium_students WHERE student_id='p1'`).run();
  await db.prepare(`INSERT INTO student_checkins(id,student_id,student_email,week_ref,coach_status,submitted_at,created_at) VALUES('old-fb','s4','old@example.com','2026-W28',NULL,'2026-07-10','2026-07-10')`).run();
  await db.prepare(`INSERT INTO student_checkins(id,student_id,student_email,week_ref,coach_status,submitted_at,created_at) VALUES('current-open','s1','ana@example.com','2026-W29',NULL,'2026-07-18','2026-07-18')`).run();
  await db.prepare(`INSERT INTO student_checkins(id,student_id,student_email,week_ref,coach_status,reviewed_at,submitted_at,created_at) VALUES('current-reviewed','s2','bruno_pipe@example.com','2026-W29','REVIEWED','2026-07-18T12:00:00Z','2026-07-18','2026-07-18')`).run();
  await db.prepare(`INSERT INTO premium_pending_items(id,student_id,type,title,description,status,priority,source,related_entity_type,related_entity_id,created_at,updated_at) VALUES('pend-special','s2','MANUAL','Título com | barra "aspas"','Linha 1
<script>alert(1)</script>','OPEN','HIGH','manual',NULL,NULL,'2026-07-14','2026-07-14')`).run();
  await db.prepare(`INSERT INTO premium_pending_items(id,student_id,type,title,description,status,priority,source,related_entity_type,related_entity_id,created_at,updated_at) VALUES('decision-plan','s1','CREATE_NUTRITION_PLAN','Atualizar plano','Criada por conduta','OPEN','NORMAL','professional_decision','student_checkins','current-open','2026-07-18','2026-07-18')`).run();
  await db.prepare(`INSERT INTO premium_pending_items(id,student_id,type,title,description,status,priority,source,related_entity_type,related_entity_id,created_at,updated_at) VALUES('old-decision','s4','CONTACT_STUDENT','Contato antigo','Outra semana','OPEN','NORMAL','professional_decision','student_checkins','old-fb','2026-07-10','2026-07-10')`).run();
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

test('operational check-in queue is the same eligible submitted historical backlog for count and items', async()=>withDb(async(db,repo)=>{
  await db.prepare(`UPDATE premium_students SET consultation_status='PAUSED' WHERE student_id='s3'`).run();
  await db.prepare(`UPDATE premium_students SET consultation_status='ENDED' WHERE student_id='s4'`).run();
  await db.prepare(`INSERT INTO student_checkins(id,student_id,student_email,week_ref,coach_status,submitted_at,created_at) VALUES
    ('previous-open','s2','bruno_pipe@example.com','2026-W28','pending','2026-07-11','2026-07-11'),
    ('paused-open','s3','carla@example.com','2026-W29','pending','2026-07-18','2026-07-18'),
    ('ended-open','s4','old@example.com','2026-W29','pending','2026-07-18','2026-07-18'),
    ('project-open','p1','projeto@example.com','2026-W29','pending','2026-07-18','2026-07-18'),
    ('not-submitted','s1','ana@example.com','2026-W27','pending',NULL,'2026-07-04')`).run();
  const dashboard=await repo.getOperationalDashboard();
  assert.equal(dashboard.checkins.awaitingReview,2);
  assert.deepEqual(new Set(dashboard.checkins.items.map((item)=>item.checkin_id)),new Set(['current-open','previous-open']));
  assert.equal(dashboard.checkins.items.length<=dashboard.checkins.awaitingReview,true);
  assert.equal(dashboard.checkins.items.every((item)=>item.submitted_at&&item.weekly_feedback_status==='AWAITING_ANALYSIS'&&!['PAUSED','ENDED'].includes(item.consultation_status)),true);
  assert.equal(dashboard.checkins.items.some((item)=>item.email==='projeto@example.com'),false);
  assert.equal(dashboard.checkins.withoutRecentResponse,null);
}));

test('all recognized analyzed statuses stay out of the historical check-in backlog', async()=>withDb(async(db,repo)=>{
  await db.prepare(`DELETE FROM student_checkins`).run();
  for(const [index,status] of ['REVIEWED','REPLIED','ANALYZED','ANALISADO','ANALISADA'].entries()) await db.prepare(`INSERT INTO student_checkins(id,student_id,student_email,week_ref,coach_status,submitted_at,created_at) VALUES(?,?,?,?,?,'2026-07-18','2026-07-18')`).bind(`analyzed-${index}`,'s1','ana@example.com','2026-W29',status).run();
  await db.prepare(`INSERT INTO student_checkins(id,student_id,student_email,week_ref,coach_status,submitted_at,created_at) VALUES('still-open','s2','bruno_pipe@example.com','2026-W20','responded','2026-05-15','2026-05-15')`).run();
  const dashboard=await repo.getOperationalDashboard();
  assert.equal(dashboard.checkins.awaitingReview,1);
  assert.deepEqual(dashboard.checkins.items.map((item)=>item.checkin_id),['still-open']);
}));

test('check-in backlog filters and orders before its operational limit', async()=>withDb(async(db,repo)=>{
  await db.prepare(`DELETE FROM student_checkins`).run();
  await db.prepare(`DELETE FROM premium_students`).run();
  await db.prepare(`DELETE FROM student_access`).run();
  for(let index=0;index<12;index++){
    const id=`active-${index}`; const email=`${id}@example.com`; const name=String.fromCharCode(65+index);
    await db.prepare(`INSERT INTO premium_students(student_id,email,normalized_email,display_name,consultation_status,access_status,source,created_at,updated_at) VALUES(?,?,?,?,'ACTIVE','ACTIVE','TEST','2026-07-01','2026-07-01')`).bind(id,email,email,name).run();
    await db.prepare(`INSERT INTO student_checkins(id,student_id,student_email,week_ref,coach_status,submitted_at,created_at) VALUES(?,?,?,'2026-W20','pending','2026-05-15','2026-05-15')`).bind(`checkin-${id}`,id,email).run();
  }
  await db.prepare(`INSERT INTO premium_students(student_id,email,normalized_email,display_name,consultation_status,access_status,source,created_at,updated_at) VALUES('release','z@example.com','z@example.com','Z','READY_TO_RELEASE','ACTIVE','TEST','2026-07-01','2026-07-01')`).run();
  await db.prepare(`INSERT INTO student_checkins(id,student_id,student_email,week_ref,coach_status,submitted_at,created_at) VALUES('checkin-release','release','z@example.com','2026-W20','pending','2026-05-15','2026-05-15')`).run();
  const dashboard=await repo.getOperationalDashboard();
  assert.equal(dashboard.checkins.awaitingReview,13);
  assert.equal(dashboard.checkins.items.length,12);
  assert.equal(dashboard.checkins.items[0].checkin_id,'checkin-release');
  assert.equal(dashboard.checkins.items.some((item)=>item.checkin_id==='checkin-release'),true);
}));

test('historical backlog ignores week changes while weekly indicator remains week-scoped', async()=>withDb(async(_db,repo)=>{
  const dashboardBefore=await repo.getOperationalDashboard();
  const dashboardAfter=await repo.getOperationalDashboard();
  assert.deepEqual(dashboardAfter.checkins,dashboardBefore.checkins);
  assert.equal(dashboardBefore.checkins.items.some((item)=>item.checkin_id==='old-fb'),true);
  assert.equal((await repo.getSummary({now:new Date('2026-07-18T15:00:00Z')})).feedbacksAwaitingAnalysis,1);
  assert.equal((await repo.getSummary({now:new Date('2026-07-25T15:00:00Z')})).feedbacksAwaitingAnalysis,0);
}));

test('saturday review returns real current-week lists and excludes Projeto LM', async()=>withDb(async(_db,repo)=>{
  const review=await repo.getSaturdayReview({now:new Date('2026-07-18T15:00:00Z'),limit:10});
  assert.equal(review.weekRef,'2026-W29'); assert.equal(review.isSaturday,true);
  assert.deepEqual(review.feedbacksAwaitingAnalysis.map(i=>i.student_id), ['s1']);
  assert.deepEqual(review.feedbacksAnalyzed.map(i=>i.student_id), ['s2']);
  assert.ok(review.studentsWithoutResponse.some(i=>i.student_id==='s4'), 'histórico antigo não conta como resposta da semana atual');
  assert.equal(review.studentsWithoutResponse.some(i=>i.student_id==='p1'), false);
  assert.deepEqual(review.pendingItemsCreatedByDecisions.map(i=>i.id), ['decision-plan']);
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

test('identity bridge prioritizes premium_students over legacy access for same email', async()=>withDb(async(db,repo)=>{
  await db.prepare(`INSERT INTO student_access(id,name,email,whatsapp,status,plan_type,plan,student_id,created_at) VALUES('legacy-s1','Legacy Ana','ANA@example.com','5500000000000','ACTIVE','PREMIUM','premium',NULL,'2026-07-02')`).run();
  const result=await repo.listStudents({student_id:'s1'});
  assert.equal(result.items.length,1);
  assert.equal(result.items[0].source,'premium');
  assert.equal(result.items[0].identity_mode,'student_id');
  assert.equal(result.items[0].name,'Ana Maria');
}));

test('identity bridge falls back to active student_access without creating student_id', async()=>withDb(async(db,repo)=>{
  await db.prepare(`DELETE FROM premium_students`).run();
  await db.prepare(`UPDATE student_access SET student_id=NULL WHERE id='a-s1'`).run();
  const result=await repo.listStudents({student_id:'ana@example.com'});
  assert.equal(result.items.length,1);
  assert.equal(result.items[0].source,'legacy');
  assert.equal(result.items[0].identity_mode,'email_bridge');
  assert.equal(result.items[0].student_id,'ana@example.com');
  const access=await db.prepare(`SELECT student_id FROM student_access WHERE id='a-s1'`).first();
  assert.equal(access.student_id,null);
}));

test('student context resolves by student_id and by normalized email bridge', async()=>withDb(async(db,repo)=>{
  assert.equal((await repo.getStudentContext('s1')).weeklyFeedback[0].id,'current-open');
  await db.prepare(`DELETE FROM premium_students`).run();
  await db.prepare(`UPDATE student_access SET student_id=NULL WHERE id='a-s1'`).run();
  await db.prepare(`UPDATE student_checkins SET student_id=NULL, student_email='ANA@EXAMPLE.COM' WHERE id='current-open'`).run();
  const context=await repo.getStudentContext('ANA@example.com');
  assert.equal(context.summary.source,'legacy');
  assert.equal(context.summary.identity_mode,'email_bridge');
  assert.equal(context.weeklyFeedback[0].id,'current-open');
}));

test('workspace lists the same 18 active legacy students and performs no write SQL', async()=>withDb(async(db,repo)=>{
  await db.prepare(`DELETE FROM premium_students`).run();
  await db.prepare(`DELETE FROM student_access`).run();
  for(let i=1;i<=18;i++) await db.prepare(`INSERT INTO student_access(id,name,email,whatsapp,status,plan_type,plan,student_id,created_at) VALUES(?,?,?,?,?,?,?,?,?)`).bind(`legacy-${i}`,`Legacy ${i}`,`legacy${i}@example.com`,null,'ACTIVE','PREMIUM','premium',null,'2026-07-01').run();
  db.calls=[];
  const result=await repo.listStudents({limit:25});
  assert.equal(result.items.length,18);
  assert.equal(result.items.every((s)=>s.source==='legacy'&&s.identity_mode==='email_bridge'),true);
  const sql=db.calls.join('\n').toUpperCase();
  assert.doesNotMatch(sql,/\bINSERT\b/);
  assert.doesNotMatch(sql,/\bUPDATE\b/);
  assert.doesNotMatch(sql,/\bDELETE\b/);
}));

test('Student 360 context opens all 18 active legacy email-bridge students', async()=>withDb(async(db,repo)=>{
  await db.prepare(`DELETE FROM premium_students`).run();
  await db.prepare(`DELETE FROM student_access`).run();
  for(let i=1;i<=18;i++) await db.prepare(`INSERT INTO student_access(id,name,email,whatsapp,status,plan_type,plan,student_id,created_at) VALUES(?,?,?,?,?,?,?,?,?)`).bind(`legacy-open-${i}`,`Legacy Open ${i}`,`legacy-open-${i}@example.com`,null,'ACTIVE','PREMIUM','premium',null,'2026-07-01').run();
  const list=await repo.listStudents({limit:25});
  assert.equal(list.items.length,18);
  for (const student of list.items) {
    const context=await repo.getStudentContext(student.student_id);
    assert.ok(context, `context should open for ${student.student_id}`);
    assert.equal(context.summary.source,'legacy');
    assert.equal(context.summary.identity_mode,'email_bridge');
  }
}));


test('legacy email-bridge resolves premium_anamnesis by normalized student_email without writes', async()=>withDb(async(db,repo)=>{
  await db.prepare(`DELETE FROM premium_students`).run();
  await db.prepare(`DELETE FROM student_access`).run();
  await db.prepare(`DELETE FROM premium_anamnesis`).run();
  await db.prepare(`INSERT INTO student_access(id,name,email,whatsapp,status,plan_type,plan,student_id,created_at) VALUES('legacy-anam','Legacy Anam','legacy-anam@example.com',NULL,'ACTIVE','PREMIUM','premium',NULL,'2026-07-01')`).run();
  await db.prepare(`INSERT INTO premium_anamnesis(id,student_id,student_email,status,created_at,updated_at) VALUES('anam-email',NULL,'  LEGACY-ANAM@EXAMPLE.COM  ','RECEBIDA','2026-07-18','2026-07-18')`).run();
  db.calls=[];
  const students=await repo.listStudents({student_id:'legacy-anam@example.com'});
  assert.equal(students.items.length,1);
  assert.equal(students.items[0].anamnesis_status,'RESPONDED');
  assert.equal(students.items[0].last_activity_at,'2026-07-18');
  const filtered=await repo.listStudents({anamnesis_status:'AWAITING_ANALYSIS'});
  assert.equal(filtered.items.some((student)=>student.student_id==='legacy-anam@example.com'),true);
  const context=await repo.getStudentContext(' LEGACY-ANAM@EXAMPLE.COM ');
  assert.equal(context.anamnesis.id,'anam-email');
  const summary=await repo.getSummary({now:new Date('2026-07-18T15:00:00Z')});
  assert.equal(summary.anamnesesAwaitingAnalysis,1);
  const sql=db.calls.join('\n').toUpperCase();
  assert.doesNotMatch(sql,/\bINSERT\b/);
  assert.doesNotMatch(sql,/\bUPDATE\b/);
  assert.doesNotMatch(sql,/\bDELETE\b/);
}));

test('student context pending items are explicitly scoped to requested Premium identity', async()=>withDb(async(db,repo)=>{
  await db.prepare(`INSERT INTO premium_pending_items(id,student_id,type,title,description,status,priority,source,created_at,updated_at) VALUES('pend-a-extra','s1','MANUAL','Pendência A','A','OPEN','NORMAL','manual','2026-07-18','2026-07-18')`).run();
  await db.prepare(`INSERT INTO premium_pending_items(id,student_id,type,title,description,status,priority,source,created_at,updated_at) VALUES('pend-b-extra','s2','MANUAL','Pendência B','B','OPEN','NORMAL','manual','2026-07-18','2026-07-18')`).run();
  const context=await repo.getStudentContext('s1');
  const ids=context.pendingItems.map((item)=>item.id);
  assert.equal(ids.includes('pend-a-extra'),true);
  assert.equal(ids.includes('pend-b-extra'),false);
  assert.equal(context.pendingItems.every((item)=>item.student_id==='s1'),true);
}));

test('legacy email-bridge context returns no pending items and does not leak Premium pending items', async()=>withDb(async(db,repo)=>{
  await db.prepare(`INSERT INTO student_access(id,name,email,whatsapp,status,plan_type,plan,student_id,created_at) VALUES('legacy-pending','Legacy Pending','legacy-pending@example.com',NULL,'ACTIVE','PREMIUM','premium',NULL,'2026-07-01')`).run();
  await db.prepare(`INSERT INTO premium_pending_items(id,student_id,type,title,description,status,priority,source,created_at,updated_at) VALUES('premium-only-pending','s1','MANUAL','Premium only','Premium','OPEN','NORMAL','manual','2026-07-18','2026-07-18')`).run();
  const context=await repo.getStudentContext('legacy-pending@example.com');
  assert.equal(context.summary.source,'legacy');
  assert.equal(context.summary.identity_mode,'email_bridge');
  assert.deepEqual(context.pendingItems,[]);
}));
